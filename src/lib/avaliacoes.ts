// Avaliação de Espaços e Recreadores — feita pelo responsável (público, sem login),
// validada por protocolo do guichê + telefone do responsável. Moderação por supervisores.
import { GrupoVisita, User } from '@/types';
import { logAuditoria } from '@/lib/auditoria';

const STORAGE_AVALIACOES = 'sentinela_avaliacoes_v1';
const STORAGE_CONFIG = 'sentinela_avaliacoes_config_v1';
export const AVALIACOES_EVENT = 'sentinela:avaliacoes-changed';

export type AvaliacaoStatus = 'pendente' | 'aprovada' | 'rejeitada';
export type AvaliacaoTipo = 'espaco' | 'recreador';

export interface Avaliacao {
  id: string;
  tipo: AvaliacaoTipo;
  /** espaço avaliado (sempre presente — recreador é avaliado dentro de um espaço) */
  espacoId: string;
  espacoNome: string;
  recreadorId?: string;
  recreadorNome?: string;
  /** 1 a 5 (emoji) */
  nota: number;
  comentario?: string;
  protocolo: string;
  responsavelNome: string;
  telefoneUltimos4: string;
  criadoEm: string;
  status: AvaliacaoStatus;
  moderadoPor?: string;
  moderadoEm?: string;
  motivoRejeicao?: string;
}

export interface AvaliacaoConfig {
  /** captação habilitada */
  ativo: boolean;
  /** janela diária de captação (HH:MM) */
  horaAbertura: string;
  horaFechamento: string;
  /** exigir aprovação do supervisor antes de exibir publicamente */
  exigirModeracao: boolean;
  /** permitir comentário livre */
  permitirComentario: boolean;
  mensagemBoasVindas: string;
}

export const DEFAULT_AVALIACAO_CONFIG: AvaliacaoConfig = {
  ativo: true,
  horaAbertura: '08:00',
  horaFechamento: '18:00',
  exigirModeracao: true,
  permitirComentario: true,
  mensagemBoasVindas: 'Sua opinião ajuda a melhorar a experiência das crianças no parque!',
};

export const EMOJIS: { nota: number; emoji: string; label: string }[] = [
  { nota: 1, emoji: '😠', label: 'Muito ruim' },
  { nota: 2, emoji: '🙁', label: 'Ruim' },
  { nota: 3, emoji: '😐', label: 'Regular' },
  { nota: 4, emoji: '🙂', label: 'Bom' },
  { nota: 5, emoji: '🤩', label: 'Excelente' },
];

export function emojiDaNota(nota: number): string {
  return EMOJIS.find(e => e.nota === Math.round(nota))?.emoji || '😐';
}

/* ---------- persistência ---------- */

export function readAvaliacoes(): Avaliacao[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_AVALIACOES) || '[]'); } catch { return []; }
}

function writeAvaliacoes(list: Avaliacao[]) {
  localStorage.setItem(STORAGE_AVALIACOES, JSON.stringify(list));
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(AVALIACOES_EVENT));
}

export function readAvaliacaoConfig(): AvaliacaoConfig {
  try {
    const raw = localStorage.getItem(STORAGE_CONFIG);
    if (!raw) return DEFAULT_AVALIACAO_CONFIG;
    return { ...DEFAULT_AVALIACAO_CONFIG, ...(JSON.parse(raw) as Partial<AvaliacaoConfig>) };
  } catch { return DEFAULT_AVALIACAO_CONFIG; }
}

export function writeAvaliacaoConfig(cfg: AvaliacaoConfig) {
  localStorage.setItem(STORAGE_CONFIG, JSON.stringify(cfg));
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(AVALIACOES_EVENT));
}

export function subscribeAvaliacoes(cb: () => void): () => void {
  window.addEventListener(AVALIACOES_EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(AVALIACOES_EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

/* ---------- janela de captação ---------- */

function minutos(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function janelaAberta(cfg = readAvaliacaoConfig(), agora = new Date()): { aberta: boolean; motivo?: string } {
  if (!cfg.ativo) return { aberta: false, motivo: 'A captação de avaliações está desativada pela coordenação.' };
  const nowMin = agora.getHours() * 60 + agora.getMinutes();
  if (nowMin < minutos(cfg.horaAbertura)) return { aberta: false, motivo: `As avaliações abrem às ${cfg.horaAbertura}.` };
  if (nowMin > minutos(cfg.horaFechamento)) return { aberta: false, motivo: `As avaliações encerraram às ${cfg.horaFechamento}.` };
  return { aberta: true };
}

/* ---------- validação do visitante ---------- */

function readGrupos(): GrupoVisita[] {
  try { return JSON.parse(localStorage.getItem('sentinela_grupos') || '[]'); } catch { return []; }
}

function soDigitos(s: string): string {
  return (s || '').replace(/\D/g, '');
}

export interface VisitanteValidado {
  protocolo: string;
  responsavelNome: string;
  telefoneUltimos4: string;
  grupoId: string;
  totalCriancas: number;
}

/**
 * Confere protocolo do guichê + telefone do responsável para provar que quem avalia é visitante.
 * Exige check-in realizado (recreador não consegue se auto-beneficiar sem visita real).
 */
export function validarVisitante(protocoloInput: string, telefoneInput: string):
  { ok: true; visitante: VisitanteValidado } | { ok: false; erro: string } {
  const protocolo = (protocoloInput || '').trim();
  const tel = soDigitos(telefoneInput);
  if (protocolo.length < 3) return { ok: false, erro: 'Informe o protocolo entregue no guichê.' };
  if (tel.length < 8) return { ok: false, erro: 'Informe o telefone completo do responsável (com DDD).' };

  const grupo = readGrupos().find(g => (g.responsavel.protocolo || '').trim().toLowerCase() === protocolo.toLowerCase());
  if (!grupo) return { ok: false, erro: 'Protocolo não encontrado. Confira o número impresso no comprovante do guichê.' };
  if (!grupo.checkinRealizado) return { ok: false, erro: 'Este protocolo ainda não teve check-in no guichê. Avaliação liberada somente após a visita.' };

  const telCadastro = soDigitos(grupo.responsavel.contato);
  const confere = telCadastro.length >= 8 && telCadastro.slice(-8) === tel.slice(-8);
  if (!confere) {
    logAuditoria('avaliacao.validacao.bloqueada', { protocolo, detalhe: 'Telefone não confere com o cadastro do responsável.' });
    return { ok: false, erro: 'O telefone não confere com o cadastro deste protocolo.' };
  }

  return {
    ok: true,
    visitante: {
      protocolo: grupo.responsavel.protocolo || grupo.id,
      responsavelNome: grupo.responsavel.nome,
      telefoneUltimos4: telCadastro.slice(-4),
      grupoId: grupo.id,
      totalCriancas: grupo.responsavel.criancas.length,
    },
  };
}

/* ---------- registro ---------- */

export interface NovaAvaliacao {
  tipo: AvaliacaoTipo;
  espacoId: string;
  espacoNome: string;
  recreadorId?: string;
  recreadorNome?: string;
  nota: number;
  comentario?: string;
}

export function registrarAvaliacoes(visitante: VisitanteValidado, itens: NovaAvaliacao[]):
  { ok: true; total: number } | { ok: false; erro: string } {
  const cfg = readAvaliacaoConfig();
  const janela = janelaAberta(cfg);
  if (!janela.aberta) return { ok: false, erro: janela.motivo || 'Fora da janela de avaliação.' };
  const validos = itens.filter(i => i.nota >= 1 && i.nota <= 5);
  if (validos.length === 0) return { ok: false, erro: 'Escolha pelo menos uma nota para enviar.' };

  const all = readAvaliacoes();
  const hoje = new Date().toISOString().slice(0, 10);
  const jaAvaliou = (i: NovaAvaliacao) => all.some(a =>
    a.protocolo === visitante.protocolo &&
    a.criadoEm.slice(0, 10) === hoje &&
    a.tipo === i.tipo &&
    a.espacoId === i.espacoId &&
    (a.recreadorId || '') === (i.recreadorId || '')
  );
  const novos: Avaliacao[] = validos.filter(i => !jaAvaliou(i)).map(i => ({
    id: crypto.randomUUID(),
    tipo: i.tipo,
    espacoId: i.espacoId,
    espacoNome: i.espacoNome,
    recreadorId: i.recreadorId,
    recreadorNome: i.recreadorNome,
    nota: i.nota,
    comentario: cfg.permitirComentario ? (i.comentario || '').trim().slice(0, 500) || undefined : undefined,
    protocolo: visitante.protocolo,
    responsavelNome: visitante.responsavelNome,
    telefoneUltimos4: visitante.telefoneUltimos4,
    criadoEm: new Date().toISOString(),
    status: cfg.exigirModeracao ? 'pendente' : 'aprovada',
  }));

  if (novos.length === 0) return { ok: false, erro: 'Você já avaliou estes itens hoje. Obrigado!' };

  writeAvaliacoes([...all, ...novos]);
  logAuditoria('avaliacao.registrada', {
    protocolo: visitante.protocolo,
    detalhe: `${novos.length} avaliação(ões) enviadas por ${visitante.responsavelNome}`,
  });
  return { ok: true, total: novos.length };
}

export function moderarAvaliacao(id: string, status: 'aprovada' | 'rejeitada', moderador: string, motivo?: string) {
  const all = readAvaliacoes();
  const idx = all.findIndex(a => a.id === id);
  if (idx < 0) return;
  all[idx] = { ...all[idx], status, moderadoPor: moderador, moderadoEm: new Date().toISOString(), motivoRejeicao: motivo };
  writeAvaliacoes(all);
  logAuditoria('avaliacao.moderada', {
    protocolo: all[idx].protocolo,
    detalhe: `${status === 'aprovada' ? 'Aprovada' : 'Rejeitada'} por ${moderador}${motivo ? ` — ${motivo}` : ''}`,
  });
}

/* ---------- rankings & histórico ---------- */

export interface RankItem {
  id: string;
  nome: string;
  total: number;
  media: number;
  distribuicao: Record<number, number>;
}

function agregar(list: Avaliacao[], keyId: (a: Avaliacao) => string, keyNome: (a: Avaliacao) => string): RankItem[] {
  const map = new Map<string, RankItem>();
  list.forEach(a => {
    const id = keyId(a);
    if (!id) return;
    if (!map.has(id)) map.set(id, { id, nome: keyNome(a), total: 0, media: 0, distribuicao: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } });
    const item = map.get(id)!;
    item.total += 1;
    item.distribuicao[a.nota] = (item.distribuicao[a.nota] || 0) + 1;
    item.media = ((item.media * (item.total - 1)) + a.nota) / item.total;
  });
  return Array.from(map.values()).sort((a, b) => b.media - a.media || b.total - a.total);
}

export function rankingEspacos(list = aprovadas()): RankItem[] {
  return agregar(list.filter(a => a.tipo === 'espaco'), a => a.espacoId, a => a.espacoNome);
}

export function rankingRecreadores(list = aprovadas()): RankItem[] {
  return agregar(list.filter(a => a.tipo === 'recreador'), a => a.recreadorId || '', a => a.recreadorNome || '—');
}

/** Desempenho do recreador em cada espaço — registro que acompanha o recreador mesmo trocando de espaço. */
export function historicoRecreador(recreadorId: string, list = aprovadas()): { porEspaco: RankItem[]; geral: RankItem | null; comentarios: Avaliacao[] } {
  const dele = list.filter(a => a.tipo === 'recreador' && a.recreadorId === recreadorId);
  const porEspaco = agregar(dele, a => a.espacoId, a => a.espacoNome);
  const geral = agregar(dele, () => recreadorId, a => a.recreadorNome || '—')[0] || null;
  return { porEspaco, geral, comentarios: dele.filter(a => a.comentario).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)) };
}

export function aprovadas(list = readAvaliacoes()): Avaliacao[] {
  return list.filter(a => a.status === 'aprovada');
}

export function pendentes(list = readAvaliacoes()): Avaliacao[] {
  return list.filter(a => a.status === 'pendente').sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}

/* ---------- recreadores com foto ---------- */

export interface RecreadorPublico {
  id: string;
  nome: string;
  fotoUrl?: string;
  espacoId?: string;
  espacoNome?: string;
}

export function readUsuarios(): User[] {
  try { return JSON.parse(localStorage.getItem('sentinela_users') || '[]'); } catch { return []; }
}

/** Recreadores ativos elegíveis a avaliação (guichê e espaço). */
export function recreadoresAvaliaveis(): RecreadorPublico[] {
  return readUsuarios()
    .filter(u => u.ativo && (u.role === 'recreador' || u.role === 'recreador_espaco'))
    .map(u => ({ id: u.id, nome: u.nome, fotoUrl: u.fotoUrl, espacoId: u.espacoId, espacoNome: u.espacoNome }));
}

export function exportarAvaliacoesCSV(list: Avaliacao[]): string {
  const head = ['Data', 'Tipo', 'Espaço', 'Recreador', 'Nota', 'Comentário', 'Protocolo', 'Responsável', 'Status'];
  const rows = list.map(a => [
    new Date(a.criadoEm).toLocaleString('pt-BR'),
    a.tipo === 'espaco' ? 'Espaço' : 'Recreador',
    a.espacoNome,
    a.recreadorNome || '',
    String(a.nota),
    (a.comentario || '').replace(/[\n;]/g, ' '),
    a.protocolo,
    a.responsavelNome,
    a.status,
  ]);
  return [head, ...rows].map(r => r.join(';')).join('\n');
}
