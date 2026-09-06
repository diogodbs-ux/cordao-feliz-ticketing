// Organograma operacional: Supervisor -> Coordenador -> Recreador (guichê / espaço).
// Persistido no mesmo storage de usuários (sentinela_users), usando supervisorId/coordenadorId.
import { User, UserRole } from '@/types';
import { logAuditoria } from '@/lib/auditoria';

const STORAGE_USERS = 'sentinela_users';
export const EQUIPES_EVENT = 'sentinela:equipes-changed';

export function readUsers(): User[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_USERS) || '[]'); } catch { return []; }
}

export function writeUsers(list: User[]) {
  localStorage.setItem(STORAGE_USERS, JSON.stringify(list));
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EQUIPES_EVENT));
}

export function subscribeEquipes(cb: () => void): () => void {
  window.addEventListener(EQUIPES_EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(EQUIPES_EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Administrador',
  coordenador: 'Coordenador',
  supervisor: 'Supervisor',
  recreador: 'Recreador (Guichê)',
  recreador_espaco: 'Recreador de Espaço',
  observador: 'Observador',
};

export function isRecreador(u: User): boolean {
  return u.role === 'recreador' || u.role === 'recreador_espaco';
}

export interface NoOrganograma {
  supervisor: User;
  coordenadores: { coordenador: User; recreadores: User[] }[];
}

export interface Organograma {
  supervisores: NoOrganograma[];
  /** coordenadores ainda sem supervisor definido */
  coordenadoresSemSupervisor: { coordenador: User; recreadores: User[] }[];
  /** recreadores ainda sem coordenador definido */
  recreadoresSemEquipe: User[];
}

export function buildOrganograma(users = readUsers()): Organograma {
  const ativos = users.filter(u => u.ativo !== false);
  const supervisores = ativos.filter(u => u.role === 'supervisor');
  const coordenadores = ativos.filter(u => u.role === 'coordenador');
  const recreadores = ativos.filter(isRecreador);

  const equipeDo = (coordId: string) => recreadores.filter(r => r.coordenadorId === coordId);
  const nodeCoord = (c: User) => ({ coordenador: c, recreadores: equipeDo(c.id) });

  return {
    supervisores: supervisores.map(s => ({
      supervisor: s,
      coordenadores: coordenadores.filter(c => c.supervisorId === s.id).map(nodeCoord),
    })),
    coordenadoresSemSupervisor: coordenadores.filter(c => !c.supervisorId || !supervisores.some(s => s.id === c.supervisorId)).map(nodeCoord),
    recreadoresSemEquipe: recreadores.filter(r => !r.coordenadorId || !coordenadores.some(c => c.id === r.coordenadorId)),
  };
}

/** Escopo de equipe: quem o usuário logado pode cadastrar/gerenciar. */
export function papeisQuePodeCadastrar(role: UserRole): UserRole[] {
  if (role === 'admin') return ['supervisor', 'coordenador', 'recreador', 'recreador_espaco'];
  if (role === 'supervisor') return ['coordenador', 'recreador', 'recreador_espaco'];
  if (role === 'coordenador') return ['recreador', 'recreador_espaco'];
  return [];
}

export function membrosVisiveis(user: User, users = readUsers()): User[] {
  if (user.role === 'admin') return users.filter(u => u.role !== 'admin');
  if (user.role === 'supervisor') {
    const meusCoords = users.filter(u => u.role === 'coordenador' && u.supervisorId === user.id);
    const ids = new Set(meusCoords.map(c => c.id));
    return [...meusCoords, ...users.filter(u => isRecreador(u) && u.coordenadorId && ids.has(u.coordenadorId))];
  }
  if (user.role === 'coordenador') return users.filter(u => isRecreador(u) && u.coordenadorId === user.id);
  return [];
}

export interface MembroInput {
  nome: string;
  email: string;
  senha: string;
  role: UserRole;
  telefone?: string;
  funcao?: string;
  fotoUrl?: string;
  guiche?: number;
  espacoId?: string;
  espacoNome?: string;
  supervisorId?: string;
  coordenadorId?: string;
}

export function salvarMembro(input: MembroInput, editandoId: string | null, autor: string):
  { ok: true; user: User } | { ok: false; erro: string } {
  const nome = input.nome.trim();
  const email = input.email.trim().toLowerCase();
  if (nome.length < 3) return { ok: false, erro: 'Informe o nome completo do membro.' };
  if (email.length < 3) return { ok: false, erro: 'Informe o login do membro.' };
  if (!editandoId && input.senha.trim().length < 4) return { ok: false, erro: 'A senha precisa ter ao menos 4 caracteres.' };

  const users = readUsers();
  if (users.some(u => u.email.trim().toLowerCase() === email && u.id !== editandoId)) {
    return { ok: false, erro: 'Já existe um usuário com esse login.' };
  }

  if (editandoId) {
    const idx = users.findIndex(u => u.id === editandoId);
    if (idx < 0) return { ok: false, erro: 'Membro não encontrado.' };
    const atualizado: User = {
      ...users[idx],
      nome, email, role: input.role,
      senha: input.senha.trim() ? input.senha : users[idx].senha,
      telefone: input.telefone, funcao: input.funcao, fotoUrl: input.fotoUrl,
      guiche: input.guiche, espacoId: input.espacoId, espacoNome: input.espacoNome,
      supervisorId: input.supervisorId, coordenadorId: input.coordenadorId,
    };
    users[idx] = atualizado;
    writeUsers(users);
    logAuditoria('equipe.membro.atualizado', { detalhe: `${nome} (${ROLE_LABEL[input.role]}) atualizado por ${autor}` });
    return { ok: true, user: atualizado };
  }

  const novo: User = {
    id: crypto.randomUUID(),
    nome, email, senha: input.senha, role: input.role,
    telefone: input.telefone, funcao: input.funcao, fotoUrl: input.fotoUrl,
    guiche: input.guiche, espacoId: input.espacoId, espacoNome: input.espacoNome,
    supervisorId: input.supervisorId, coordenadorId: input.coordenadorId,
    ativo: true,
    criadoEm: new Date().toISOString(),
  };
  writeUsers([...users, novo]);
  logAuditoria('equipe.membro.criado', { detalhe: `${nome} (${ROLE_LABEL[input.role]}) cadastrado por ${autor}` });
  return { ok: true, user: novo };
}

export function removerMembro(id: string, autor: string): { ok: boolean; erro?: string } {
  const users = readUsers();
  const alvo = users.find(u => u.id === id);
  if (!alvo) return { ok: false, erro: 'Membro não encontrado.' };
  if (alvo.role === 'admin') return { ok: false, erro: 'Não é possível remover um administrador aqui.' };
  const restantes = users.filter(u => u.id !== id).map(u => ({
    ...u,
    supervisorId: u.supervisorId === id ? undefined : u.supervisorId,
    coordenadorId: u.coordenadorId === id ? undefined : u.coordenadorId,
  }));
  writeUsers(restantes);
  logAuditoria('equipe.membro.removido', { detalhe: `${alvo.nome} removido por ${autor}` });
  return { ok: true };
}

/** Redimensiona a foto para dataURL leve (evita estourar o localStorage). */
export function comprimirFoto(file: File, max = 320): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Selecione um arquivo de imagem.'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Imagem inválida.'));
      img.onload = () => {
        const escala = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * escala);
        const h = Math.round(img.height * escala);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Falha ao processar a imagem.'));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export interface ResumoEquipe {
  supervisores: number;
  coordenadores: number;
  recreadores: number;
  semFoto: number;
  semEquipe: number;
}

export function resumoEquipe(users = readUsers()): ResumoEquipe {
  const ativos = users.filter(u => u.ativo !== false);
  const recs = ativos.filter(isRecreador);
  return {
    supervisores: ativos.filter(u => u.role === 'supervisor').length,
    coordenadores: ativos.filter(u => u.role === 'coordenador').length,
    recreadores: recs.length,
    semFoto: recs.filter(r => !r.fotoUrl).length,
    semEquipe: recs.filter(r => !r.coordenadorId).length,
  };
}
