// Log de auditoria operacional (quem, quando, o quê).
// Persistido em localStorage; pronto para sincronizar quando Supabase entrar.
import { enqueue } from './syncQueue';

export type AuditoriaAcao =
  | 'cordao.vincular.ok'
  | 'cordao.vincular.erro'
  | 'cordao.vincular.conflito_protocolo'
  | 'cordao.entrada.ok'
  | 'cordao.entrada.erro'
  | 'cordao.devolver.ok'
  | 'ciclo.iniciar'
  | 'ciclo.finalizar'
  | 'ciclo.descartar'
  | 'checkin.confirmar'
  | 'rastreamento.token.gerado'
  | 'rastreamento.consulta.ok'
  | 'rastreamento.consulta.bloqueada'
  | 'alerta.superlotacao'
  | 'alerta.pcd_entrada'
  | 'encerramento.executado'
  | 'avaliacao.validacao.bloqueada'
  | 'avaliacao.registrada'
  | 'avaliacao.moderada'
  | 'equipe.membro.criado'
  | 'equipe.membro.atualizado'
  | 'equipe.membro.removido';

export interface AuditoriaEvento {
  id: string;
  acao: AuditoriaAcao;
  quando: string; // ISO
  usuarioId?: string;
  usuarioNome?: string;
  usuarioRole?: string;
  codigo?: string;       // cordão
  protocolo?: string;
  protocoloEsperado?: string; // em conflito
  cicloId?: string;
  espacoId?: string;
  espacoNome?: string;
  membroNome?: string;
  guiche?: number;             // guichê que executou (receptivo)
  recreadorNome?: string;      // recreador responsável (espaços)
  detalhe?: string;
}


const KEY = 'sentinela_auditoria';
const EVENT = 'sentinela:auditoria-changed';
const MAX_REGISTROS = 5000;

function getUsuarioAtual(): { id?: string; nome?: string; role?: string } {
  try {
    const raw = localStorage.getItem('sentinela_user');
    if (!raw) return {};
    const u = JSON.parse(raw);
    return { id: u.id, nome: u.nome, role: u.role };
  } catch { return {}; }
}

export function readAuditoria(): AuditoriaEvento[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

export function writeAuditoria(list: AuditoriaEvento[]) {
  const sliced = list.slice(-MAX_REGISTROS);
  localStorage.setItem(KEY, JSON.stringify(sliced));
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT));
}

export function logAuditoria(acao: AuditoriaAcao, dados: Partial<AuditoriaEvento> = {}): AuditoriaEvento {
  const u = getUsuarioAtual();
  const ev: AuditoriaEvento = {
    id: crypto.randomUUID(),
    acao,
    quando: new Date().toISOString(),
    usuarioId: u.id,
    usuarioNome: u.nome,
    usuarioRole: u.role,
    ...dados,
  };
  const all = readAuditoria();
  all.push(ev);
  writeAuditoria(all);
  // Enfileira para futura sincronização (Supabase)
  try { enqueue('checkin.create', { kind: 'auditoria', ...ev }); } catch { /* noop */ }
  return ev;
}

export function subscribeAuditoria(cb: () => void) {
  const onStorage = (e: StorageEvent) => { if (!e.key || e.key === KEY) cb(); };
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', onStorage);
  };
}

export function limparAuditoria() {
  localStorage.removeItem(KEY);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT));
}
