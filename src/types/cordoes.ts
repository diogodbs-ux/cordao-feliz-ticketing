// Sistema de cordões numerados sequenciais por cor
// Vínculo: protocolo (check-in) -> códigos -> ciclos de espaço (jornada individual)
import { CordaoColor } from './index';

export type CordaoStatus =
  | 'disponivel'      // impresso, ainda não entregue
  | 'entregue'        // vinculado a um protocolo no check-in
  | 'devolvido';      // (futuro) saída do parque

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
  vinculadoEm?: string;      // ISO
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
  criadoEm: string;
  criadoPor?: string;
  observacao?: string;
}

const STORAGE_CORDOES = 'sentinela_cordoes';
const STORAGE_LOTES = 'sentinela_cordoes_lotes';

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
}
export function readLotes(): LoteCordao[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_LOTES) || '[]'); } catch { return []; }
}
export function writeLotes(list: LoteCordao[]) {
  localStorage.setItem(STORAGE_LOTES, JSON.stringify(list));
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
  ctx: { protocolo: string; grupoId: string; membroNome?: string; membroTipo?: 'crianca' | 'adulto' }
): { ok: true; cordao: CordaoUnidade } | { ok: false; erro: string } {
  const parsed = parseCodigo(codigo);
  if (!parsed) return { ok: false, erro: `Código inválido: ${codigo}` };
  const code = formatCodigo(parsed.cor, parsed.numero);
  const all = readCordoes();
  const idx = all.findIndex(c => c.codigo === code);
  if (idx < 0) return { ok: false, erro: `Cordão ${code} não cadastrado. Imprima o lote no Admin.` };
  const c = all[idx];
  if (c.status === 'entregue' && c.protocolo && c.protocolo !== ctx.protocolo) {
    return { ok: false, erro: `Cordão ${code} já vinculado ao protocolo ${c.protocolo}.` };
  }
  const updated: CordaoUnidade = {
    ...c,
    status: 'entregue',
    protocolo: ctx.protocolo,
    grupoId: ctx.grupoId,
    membroNome: ctx.membroNome,
    membroTipo: ctx.membroTipo,
    vinculadoEm: new Date().toISOString(),
  };
  all[idx] = updated;
  writeCordoes(all);
  return { ok: true, cordao: updated };
}

/** Registra entrada de um cordão num ciclo de espaço. */
export function registrarEntradaEspaco(
  codigo: string,
  visita: { cicloId: string; espacoId: string; espacoNome: string }
): { ok: true; cordao: CordaoUnidade } | { ok: false; erro: string } {
  const parsed = parseCodigo(codigo);
  if (!parsed) return { ok: false, erro: `Código inválido: ${codigo}` };
  const code = formatCodigo(parsed.cor, parsed.numero);
  const all = readCordoes();
  const idx = all.findIndex(c => c.codigo === code);
  if (idx < 0) return { ok: false, erro: `Cordão ${code} não cadastrado.` };
  const c = all[idx];
  if (c.status === 'disponivel') {
    return { ok: false, erro: `Cordão ${code} ainda não foi entregue no guichê.` };
  }
  // Evita duplicar entrada no mesmo ciclo
  if ((c.visitas || []).some(v => v.cicloId === visita.cicloId)) {
    return { ok: false, erro: `Cordão ${code} já registrado neste ciclo.` };
  }
  const updated: CordaoUnidade = {
    ...c,
    visitas: [...(c.visitas || []), { ...visita, entrada: new Date().toISOString() }],
  };
  all[idx] = updated;
  writeCordoes(all);
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
