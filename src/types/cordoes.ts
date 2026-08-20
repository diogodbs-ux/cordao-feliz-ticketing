// Sistema de cordões numerados sequenciais por cor
// Vínculo: protocolo (check-in) -> códigos -> ciclos de espaço (jornada individual)
import { CordaoColor } from './index';
import { logAuditoria } from '@/lib/auditoria';
import { enqueue } from '@/lib/syncQueue';


export type CordaoStatus =
  | 'disponivel'      // impresso, ainda não entregue
  | 'entregue'        // vinculado a um protocolo no check-in
  | 'devolvido';      // devolvido no portão (fim da visita)

export interface CordaoUnidade {
  codigo: string;            // ex: "AZ-0457"
  cor: CordaoColor;
  numero: number;            // 457
  status: CordaoStatus;
  loteId?: string;
  // Vínculo
  protocolo?: string;
  grupoId?: string;
  membroNome?: string;       // nome da criança (ou "Responsável", "Acompanhante")
  membroTipo?: 'crianca' | 'adulto';
  membroIdade?: number;
  pcd?: boolean;
  pcdDescricao?: string;
  vinculadoEm?: string;      // ISO
  devolvidoEm?: string;      // ISO — devolução no portão
  duracaoTotalSeg?: number;  // tempo total no parque (segundos)
  autismo?: boolean;         // etiqueta impressa com o selo TEA (fita de peças)
  // Auditoria do vínculo
  vinculadoGuiche?: number;
  vinculadoPor?: string;
  // Trilha de visitas (preenchida pelo recreador de espaço)
  visitas?: VisitaCordao[];
  criadoEm: string;
}

export interface VisitaCordao {
  cicloId: string;
  espacoId: string;
  espacoNome: string;
  entrada: string;           // ISO
  saida?: string;            // ISO (preenchida no fim do ciclo)
}

export interface LoteCordao {
  id: string;
  cor: CordaoColor;
  inicio: number;            // primeiro número do lote
  fim: number;               // último número do lote
  quantidade: number;
  autismo?: boolean;         // lote impresso com o selo TEA
  criadoEm: string;
  criadoPor?: string;
  observacao?: string;
}


const STORAGE_CORDOES = 'sentinela_cordoes';
const STORAGE_LOTES = 'sentinela_cordoes_lotes';
const EVENT_CORDOES_CHANGED = 'sentinela:cordoes-changed';

const COR_PREFIXO: Record<CordaoColor, string> = {
  azul: 'AZ',
  verde: 'VD',
  amarelo: 'AM',
  vermelho: 'VM',
  rosa: 'RS',
  cinza: 'CZ',
  preto: 'PT',
};

export function prefixoCor(cor: CordaoColor): string {
  return COR_PREFIXO[cor];
}

export function corFromPrefixo(prefixo: string): CordaoColor | null {
  const up = prefixo.toUpperCase();
  for (const [cor, p] of Object.entries(COR_PREFIXO)) {
    if (p === up) return cor as CordaoColor;
  }
  return null;
}

export function formatCodigo(cor: CordaoColor, numero: number): string {
  return `${COR_PREFIXO[cor]}-${String(numero).padStart(4, '0')}`;
}

export function parseCodigo(raw: string): { cor: CordaoColor; numero: number } | null {
  const clean = raw.trim().toUpperCase().replace(/\s+/g, '');
  const m = clean.match(/^([A-Z]{2})-?(\d{1,6})$/);
  if (!m) return null;
  const cor = corFromPrefixo(m[1]);
  if (!cor) return null;
  const numero = parseInt(m[2], 10);
  if (!Number.isFinite(numero) || numero <= 0) return null;
  return { cor, numero };
}

export function readCordoes(): CordaoUnidade[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_CORDOES) || '[]'); } catch { return []; }
}
export function writeCordoes(list: CordaoUnidade[]) {
  localStorage.setItem(STORAGE_CORDOES, JSON.stringify(list));
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT_CORDOES_CHANGED));
}
export function readLotes(): LoteCordao[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_LOTES) || '[]'); } catch { return []; }
}
export function writeLotes(list: LoteCordao[]) {
  localStorage.setItem(STORAGE_LOTES, JSON.stringify(list));
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT_CORDOES_CHANGED));
}

export function subscribeCordoesChange(callback: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (!e.key || e.key === STORAGE_CORDOES || e.key === STORAGE_LOTES) callback();
  };
  window.addEventListener(EVENT_CORDOES_CHANGED, callback);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(EVENT_CORDOES_CHANGED, callback);
    window.removeEventListener('storage', onStorage);
  };
}

/** Próximo número disponível para uma cor (continua a sequência). */
export function proximoNumero(cor: CordaoColor): number {
  const all = readCordoes().filter(c => c.cor === cor);
  if (all.length === 0) return 1;
  return Math.max(...all.map(c => c.numero)) + 1;
}

/** Gera um lote sequencial de cordões para uma cor. */
export function gerarLote(cor: CordaoColor, quantidade: number, criadoPor?: string, observacao?: string): { lote: LoteCordao; novos: CordaoUnidade[] } {
  if (quantidade <= 0) throw new Error('Quantidade inválida');
  const inicio = proximoNumero(cor);
  const fim = inicio + quantidade - 1;
  const loteId = crypto.randomUUID();
  const now = new Date().toISOString();
  const lote: LoteCordao = { id: loteId, cor, inicio, fim, quantidade, criadoEm: now, criadoPor, observacao };

  const novos: CordaoUnidade[] = [];
  for (let n = inicio; n <= fim; n++) {
    novos.push({
      codigo: formatCodigo(cor, n),
      cor, numero: n,
      status: 'disponivel',
      loteId,
      criadoEm: now,
    });
  }
  writeLotes([...readLotes(), lote]);
  writeCordoes([...readCordoes(), ...novos]);
  return { lote, novos };
}

/** Vincula um cordão a um protocolo (no check-in). Retorna mensagem de erro se houver. */
export function vincularCordao(
  codigo: string,
  ctx: { protocolo: string; grupoId: string; membroNome?: string; membroTipo?: 'crianca' | 'adulto'; membroIdade?: number; pcd?: boolean; pcdDescricao?: string }
): { ok: true; cordao: CordaoUnidade } | { ok: false; erro: string } {
  const parsed = parseCodigo(codigo);
  if (!parsed) {
    logAuditoria('cordao.vincular.erro', { codigo, protocolo: ctx.protocolo, detalhe: 'Código inválido' });
    return { ok: false, erro: `Código inválido: ${codigo}` };
  }
  const code = formatCodigo(parsed.cor, parsed.numero);
  const all = readCordoes();
  const idx = all.findIndex(c => c.codigo === code);
  if (idx < 0) {
    logAuditoria('cordao.vincular.erro', { codigo: code, protocolo: ctx.protocolo, detalhe: 'Cordão não cadastrado no estoque' });
    return { ok: false, erro: `Cordão ${code} não cadastrado. Imprima o lote no Admin.` };
  }
  const c = all[idx];
  if (c.protocolo && c.protocolo !== ctx.protocolo) {
    logAuditoria('cordao.vincular.conflito_protocolo', {
      codigo: code, protocolo: ctx.protocolo, protocoloEsperado: c.protocolo,
      membroNome: c.membroNome,
      detalhe: `Tentativa de vincular cordão de outro protocolo (correto: ${c.protocolo}).`,
    });
    return { ok: false, erro: `Cordão ${code} pertence ao protocolo ${c.protocolo}. Protocolo correto deste cordão: ${c.protocolo}.` };
  }
  const updated: CordaoUnidade = {
    ...c,
    status: 'entregue',
    protocolo: ctx.protocolo,
    grupoId: ctx.grupoId,
    membroNome: ctx.membroNome,
    membroTipo: ctx.membroTipo,
    membroIdade: ctx.membroIdade,
    pcd: ctx.pcd,
    pcdDescricao: ctx.pcdDescricao,
    vinculadoEm: new Date().toISOString(),
  };
  all[idx] = updated;
  writeCordoes(all);
  logAuditoria('cordao.vincular.ok', { codigo: code, protocolo: ctx.protocolo, membroNome: ctx.membroNome });
  try { enqueue('cordao.vincular', { codigo: code, protocolo: ctx.protocolo, grupoId: ctx.grupoId, membroNome: ctx.membroNome }); } catch { /* noop */ }
  return { ok: true, cordao: updated };
}

/** Devolve um cordão no portão: fecha visitas abertas, marca status devolvido e calcula tempo total. */
export function devolverCordao(codigo: string): { ok: true; cordao: CordaoUnidade; duracaoSeg: number } | { ok: false; erro: string } {
  const parsed = parseCodigo(codigo);
  if (!parsed) return { ok: false, erro: `Código inválido: ${codigo}` };
  const code = formatCodigo(parsed.cor, parsed.numero);
  const all = readCordoes();
  const idx = all.findIndex(c => c.codigo === code);
  if (idx < 0) return { ok: false, erro: `Cordão ${code} não cadastrado.` };
  const c = all[idx];
  if (c.status === 'devolvido') return { ok: false, erro: `Cordão ${code} já foi devolvido em ${new Date(c.devolvidoEm!).toLocaleString('pt-BR')}.` };
  if (c.status !== 'entregue' || !c.protocolo) return { ok: false, erro: `Cordão ${code} não está em uso (status: ${c.status}).` };
  const now = new Date();
  const fim = now.toISOString();
  const visitas = (c.visitas || []).map(v => v.saida ? v : { ...v, saida: fim });
  const inicio = c.vinculadoEm ? new Date(c.vinculadoEm).getTime() : now.getTime();
  const duracaoSeg = Math.max(0, Math.floor((now.getTime() - inicio) / 1000));
  const updated: CordaoUnidade = { ...c, status: 'devolvido', devolvidoEm: fim, duracaoTotalSeg: duracaoSeg, visitas };
  all[idx] = updated;
  writeCordoes(all);
  logAuditoria('cordao.devolver.ok', {
    codigo: code, protocolo: c.protocolo, membroNome: c.membroNome,
    detalhe: `Devolução no portão · permanência ${Math.floor(duracaoSeg/60)}min`,
  });
  try { enqueue('cordao.devolver', { codigo: code, protocolo: c.protocolo, duracaoSeg }); } catch { /* noop */ }
  return { ok: true, cordao: updated, duracaoSeg };
}

/** Registra entrada de um cordão num ciclo de espaço. */
export function registrarEntradaEspaco(
  codigo: string,
  visita: { cicloId: string; espacoId: string; espacoNome: string }
): { ok: true; cordao: CordaoUnidade } | { ok: false; erro: string } {
  const parsed = parseCodigo(codigo);
  if (!parsed) {
    logAuditoria('cordao.entrada.erro', { codigo, cicloId: visita.cicloId, espacoId: visita.espacoId, espacoNome: visita.espacoNome, detalhe: 'Código inválido' });
    return { ok: false, erro: `Código inválido: ${codigo}` };
  }
  const code = formatCodigo(parsed.cor, parsed.numero);
  const all = readCordoes();
  const idx = all.findIndex(c => c.codigo === code);
  if (idx < 0) {
    logAuditoria('cordao.entrada.erro', { codigo: code, cicloId: visita.cicloId, espacoNome: visita.espacoNome, detalhe: 'Cordão não cadastrado' });
    return { ok: false, erro: `Cordão ${code} não cadastrado.` };
  }
  const c = all[idx];
  if (c.status === 'disponivel') {
    logAuditoria('cordao.entrada.erro', { codigo: code, cicloId: visita.cicloId, espacoNome: visita.espacoNome, detalhe: 'Cordão não vinculado a protocolo' });
    return { ok: false, erro: `Cordão ${code} ainda não foi vinculado a um protocolo. Realize o vínculo (Check-in) antes de rastrear nos espaços.` };
  }
  if ((c.visitas || []).some(v => v.cicloId === visita.cicloId)) {
    return { ok: false, erro: `Cordão ${code} já registrado neste ciclo.` };
  }
  const updated: CordaoUnidade = {
    ...c,
    visitas: [...(c.visitas || []), { ...visita, entrada: new Date().toISOString() }],
  };
  all[idx] = updated;
  writeCordoes(all);
  logAuditoria('cordao.entrada.ok', {
    codigo: code, protocolo: c.protocolo, cicloId: visita.cicloId,
    espacoId: visita.espacoId, espacoNome: visita.espacoNome, membroNome: c.membroNome,
  });
  try { enqueue('cordao.entrada', { codigo: code, cicloId: visita.cicloId, espacoId: visita.espacoId }); } catch { /* noop */ }
  return { ok: true, cordao: updated };
}

/** Marca saída (fim do ciclo) para todos os cordões com entrada nesse ciclo sem saída. */
export function fecharSaidasDoCiclo(cicloId: string): number {
  const all = readCordoes();
  const fim = new Date().toISOString();
  let count = 0;
  all.forEach(c => {
    (c.visitas || []).forEach(v => {
      if (v.cicloId === cicloId && !v.saida) { v.saida = fim; count++; }
    });
  });
  if (count > 0) writeCordoes(all);
  return count;
}

export function getCordaoByCodigo(codigo: string): CordaoUnidade | null {
  const parsed = parseCodigo(codigo);
  if (!parsed) return null;
  const code = formatCodigo(parsed.cor, parsed.numero);
  return readCordoes().find(c => c.codigo === code) || null;
}

export function cordoesPorProtocolo(protocolo: string): CordaoUnidade[] {
  const p = protocolo.trim().toLowerCase();
  return readCordoes().filter(c => c.protocolo?.toLowerCase() === p);
}
