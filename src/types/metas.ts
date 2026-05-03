// Sistema de Metas anuais e mensais
// Permite definir alvos no Admin e acompanhar progresso no Dashboard / Consolidado.

export interface MetaAnual {
  ano: number;
  // Meta global (total visitantes = crianças + adultos)
  metaTotal: number;
  // Metas opcionais por mês (1..12). Se ausente, distribui igualmente.
  metaMensal?: Partial<Record<number, number>>;
  atualizadoEm: string;
}

const STORAGE_METAS = 'sentinela_metas';

export function readMetas(): MetaAnual[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_METAS) || '[]');
  } catch {
    return [];
  }
}

export function writeMetas(list: MetaAnual[]) {
  localStorage.setItem(STORAGE_METAS, JSON.stringify(list));
}

export function getMetaDoAno(ano: number): MetaAnual | undefined {
  return readMetas().find(m => m.ano === ano);
}

export function upsertMeta(meta: MetaAnual) {
  const list = readMetas();
  const idx = list.findIndex(m => m.ano === meta.ano);
  const next: MetaAnual = { ...meta, atualizadoEm: new Date().toISOString() };
  if (idx >= 0) list[idx] = next;
  else list.push(next);
  writeMetas(list);
}

export function getMetaMes(meta: MetaAnual | undefined, mes: number): number {
  if (!meta) return 0;
  const m = meta.metaMensal?.[mes];
  if (typeof m === 'number' && m > 0) return m;
  // distribuição uniforme
  return Math.round(meta.metaTotal / 12);
}
