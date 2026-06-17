// Encerramento automático da operação — às 18h do dia operacional o sistema
// fecha visitas abertas e devolve todos os cordões em uso (devolução em lote
// no portão lógico), gerando métricas individuais de permanência.
import { readCordoes, writeCordoes, CordaoUnidade } from '@/types/cordoes';
import { logAuditoria } from '@/lib/auditoria';

const STORAGE_CONFIG = 'sentinela_encerramento_config';
const STORAGE_HISTORICO = 'sentinela_encerramento_historico';

export interface EncerramentoConfig {
  horaFechamento: number;   // 0-23 (default 18)
  minuto: number;           // 0-59 (default 0)
  autoEncerrar: boolean;    // default true
}

export interface EncerramentoResultado {
  data: string;             // dd/mm/yyyy
  executadoEm: string;      // ISO
  motivo: 'automatico' | 'manual';
  totalDevolvidos: number;
  tempoMedioSeg: number;
  tempoMedianoSeg: number;
  tempoMinSeg: number;
  tempoMaxSeg: number;
  picoEntradaHora: number | null;     // hora (0-23) com mais entradas
  histogramaEntradas: Record<number, number>; // hora -> qtd
}

const DEFAULT_CONFIG: EncerramentoConfig = { horaFechamento: 18, minuto: 0, autoEncerrar: true };

export function getEncerramentoConfig(): EncerramentoConfig {
  try {
    const raw = localStorage.getItem(STORAGE_CONFIG);
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch { return DEFAULT_CONFIG; }
}

export function setEncerramentoConfig(cfg: Partial<EncerramentoConfig>) {
  const merged = { ...getEncerramentoConfig(), ...cfg };
  localStorage.setItem(STORAGE_CONFIG, JSON.stringify(merged));
}

export function listarHistoricoEncerramentos(): EncerramentoResultado[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_HISTORICO) || '[]'); } catch { return []; }
}

function persistHistorico(r: EncerramentoResultado) {
  const list = listarHistoricoEncerramentos();
  // sobrescreve se já houver entrada para a mesma data
  const filtered = list.filter(x => x.data !== r.data);
  filtered.push(r);
  localStorage.setItem(STORAGE_HISTORICO, JSON.stringify(filtered.slice(-180)));
}

export function getEncerramentoDoDia(data = new Date().toLocaleDateString('pt-BR')): EncerramentoResultado | null {
  return listarHistoricoEncerramentos().find(r => r.data === data) || null;
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/** Executa o encerramento — devolve em lote todos os cordões em uso e gera métricas. */
export function executarEncerramento(motivo: 'automatico' | 'manual'): EncerramentoResultado {
  const all = readCordoes();
  const now = new Date();
  const fimISO = now.toISOString();
  const dataOper = now.toLocaleDateString('pt-BR');

  const tempos: number[] = [];
  const histo: Record<number, number> = {};
  let devolvidos = 0;

  const updated: CordaoUnidade[] = all.map(c => {
    if (c.status !== 'entregue' || !c.protocolo) return c;
    const inicioMs = c.vinculadoEm ? new Date(c.vinculadoEm).getTime() : now.getTime();
    const duracaoSeg = Math.max(0, Math.floor((now.getTime() - inicioMs) / 1000));
    tempos.push(duracaoSeg);
    if (c.vinculadoEm) {
      const h = new Date(c.vinculadoEm).getHours();
      histo[h] = (histo[h] || 0) + 1;
    }
    const visitas = (c.visitas || []).map(v => v.saida ? v : { ...v, saida: fimISO });
    devolvidos++;
    return { ...c, status: 'devolvido', devolvidoEm: fimISO, duracaoTotalSeg: duracaoSeg, visitas };
  });
  writeCordoes(updated);

  const tempoMedio = tempos.length ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : 0;
  const picoHora = Object.keys(histo).length
    ? Number(Object.entries(histo).sort((a, b) => b[1] - a[1])[0][0])
    : null;

  const resultado: EncerramentoResultado = {
    data: dataOper,
    executadoEm: fimISO,
    motivo,
    totalDevolvidos: devolvidos,
    tempoMedioSeg: tempoMedio,
    tempoMedianoSeg: median(tempos),
    tempoMinSeg: tempos.length ? Math.min(...tempos) : 0,
    tempoMaxSeg: tempos.length ? Math.max(...tempos) : 0,
    picoEntradaHora: picoHora,
    histogramaEntradas: histo,
  };

  persistHistorico(resultado);
  logAuditoria('encerramento.executado', {
    detalhe: `${motivo} · ${devolvidos} cordões devolvidos · média ${Math.floor(tempoMedio/60)}min · pico ${picoHora ?? '—'}h`,
  });
  return resultado;
}

/** Avalia se está na hora de executar o encerramento automático e ainda não foi feito hoje. */
export function deveExecutarAgora(): boolean {
  const cfg = getEncerramentoConfig();
  if (!cfg.autoEncerrar) return false;
  const now = new Date();
  const minutosNow = now.getHours() * 60 + now.getMinutes();
  const minutosAlvo = cfg.horaFechamento * 60 + cfg.minuto;
  if (minutosNow < minutosAlvo) return false;
  const hoje = now.toLocaleDateString('pt-BR');
  return !getEncerramentoDoDia(hoje);
}
