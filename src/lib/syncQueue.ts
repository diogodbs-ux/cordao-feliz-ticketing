// Fila offline-ready: ações são enfileiradas e marcadas como pendentes.
// Hoje: tudo persiste em localStorage, então a fila apenas registra para auditoria
// e prepara o terreno para Lovable Cloud (Supabase) quando ativarmos no futuro.

export type SyncOp =
  | { type: 'cordao.vincular'; payload: any }
  | { type: 'cordao.entrada'; payload: any }
  | { type: 'cordao.saida'; payload: any }
  | { type: 'ciclo.create'; payload: any }
  | { type: 'checkin.create'; payload: any };

export interface SyncItem {
  id: string;
  op: SyncOp['type'];
  payload: any;
  criadoEm: string;
  status: 'pendente' | 'sincronizado' | 'erro';
  erro?: string;
  tentativas: number;
}

const KEY = 'sentinela_sync_queue';

export function readQueue(): SyncItem[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
export function writeQueue(q: SyncItem[]) {
  localStorage.setItem(KEY, JSON.stringify(q));
  window.dispatchEvent(new CustomEvent('sync-queue-changed'));
}
export function enqueue(op: SyncOp['type'], payload: any) {
  const item: SyncItem = {
    id: crypto.randomUUID(),
    op, payload,
    criadoEm: new Date().toISOString(),
    status: 'pendente',
    tentativas: 0,
  };
  writeQueue([...readQueue(), item]);
  return item;
}
export function pendentes(): number {
  return readQueue().filter(i => i.status === 'pendente').length;
}
export function limparSincronizados() {
  writeQueue(readQueue().filter(i => i.status !== 'sincronizado'));
}

/** Placeholder: quando Supabase estiver ativo, processa fila aqui. */
export async function processarFila(): Promise<{ ok: number; erro: number }> {
  // Por ora, apenas marca como sincronizado se estiver online (modo localStorage).
  if (!navigator.onLine) return { ok: 0, erro: 0 };
  const q = readQueue();
  let ok = 0;
  q.forEach(i => {
    if (i.status === 'pendente') { i.status = 'sincronizado'; ok++; }
  });
  writeQueue(q);
  return { ok, erro: 0 };
}

export function isOnline(): boolean {
  return navigator.onLine;
}
