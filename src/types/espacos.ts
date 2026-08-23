// Tipos para espaços lúdicos do parque (~35 espaços)
import { CordaoColor } from './index';

export interface EspacoLudico {
  id: string;
  nome: string;
  categoria?: string; // ex: 'piscina_bolinhas', 'escola', 'hospital', 'ceart'
  capacidadeCiclo?: number; // crianças por ciclo
  duracaoCicloMin?: number; // minutos
  ativo: boolean;
  criadoEm: string;
}

export interface VisitaProtocolo {
  protocolo: string;
  responsavelNome?: string;
  numCriancas?: number;
  numAdultos?: number;
  registradoEm: string; // ISO
}

export interface CicloEspaco {
  id: string;
  espacoId: string;
  espacoNome: string;
  recreadorId: string;
  recreadorNome: string;
  inicio: string; // ISO
  fim?: string; // ISO
  // contagem por cor de cordão (crianças que entraram)
  porCor: Partial<Record<CordaoColor, number>>;
  totalCriancas: number;
  totalAdultos: number;
  observacao?: string;
  // Rastreio semi-individual: protocolos dos grupos que entraram neste ciclo
  protocolos?: VisitaProtocolo[];
}

// Jornada agregada de um protocolo: por quais espaços passou e quando.
export interface JornadaProtocolo {
  protocolo: string;
  responsavelNome?: string;
  visitas: { espacoId: string; espacoNome: string; quando: string }[];
}

export function buildJornadas(ciclos: CicloEspaco[]): Map<string, JornadaProtocolo> {
  const map = new Map<string, JornadaProtocolo>();
  ciclos.forEach(c => {
    (c.protocolos || []).forEach(p => {
      if (!p.protocolo) return;
      const key = p.protocolo.trim();
      if (!map.has(key)) {
        map.set(key, { protocolo: key, responsavelNome: p.responsavelNome, visitas: [] });
      }
      const j = map.get(key)!;
      if (p.responsavelNome && !j.responsavelNome) j.responsavelNome = p.responsavelNome;
      j.visitas.push({ espacoId: c.espacoId, espacoNome: c.espacoNome, quando: p.registradoEm });
    });
  });
  // ordenar visitas por tempo
  map.forEach(j => j.visitas.sort((a, b) => a.quando.localeCompare(b.quando)));
  return map;
}

const STORAGE_ESPACOS = 'sentinela_espacos';
const STORAGE_CICLOS = 'sentinela_ciclos_espaco';
const EVENT_ESPACOS_CHANGED = 'sentinela:espacos-changed';
const EVENT_CICLOS_CHANGED = 'sentinela:ciclos-changed';

export function readEspacos(): EspacoLudico[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_ESPACOS) || '[]'); } catch { return []; }
}
export function writeEspacos(list: EspacoLudico[]) {
  localStorage.setItem(STORAGE_ESPACOS, JSON.stringify(list));
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT_ESPACOS_CHANGED));
}
export function readCiclos(): CicloEspaco[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_CICLOS) || '[]'); } catch { return []; }
}
export function writeCiclos(list: CicloEspaco[]) {
  localStorage.setItem(STORAGE_CICLOS, JSON.stringify(list));
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT_CICLOS_CHANGED));
}

export function subscribeEspacosChange(callback: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (!e.key || e.key === STORAGE_ESPACOS || e.key === STORAGE_CICLOS) callback();
  };
  window.addEventListener(EVENT_ESPACOS_CHANGED, callback);
  window.addEventListener(EVENT_CICLOS_CHANGED, callback);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(EVENT_ESPACOS_CHANGED, callback);
    window.removeEventListener(EVENT_CICLOS_CHANGED, callback);
    window.removeEventListener('storage', onStorage);
  };
}

/** Faixa etária correspondente à cor do cordão (usada nos painéis de ciclos). */
export const FAIXA_POR_COR: Partial<Record<CordaoColor, string>> = {
  azul: '0-3',
  verde: '4-6',
  amarelo: '7-9',
  vermelho: '10-12',
};

/** Distribuição por faixa etária a partir das contagens rápidas por cor dos ciclos. */
export function idadesDeCiclos(ciclos: CicloEspaco[]): Record<string, number> {
  const acc: Record<string, number> = { '0-3': 0, '4-6': 0, '7-9': 0, '10-12': 0 };
  ciclos.forEach(c => {
    Object.entries(c.porCor || {}).forEach(([cor, qtd]) => {
      const faixa = FAIXA_POR_COR[cor as CordaoColor];
      if (faixa) acc[faixa] += Number(qtd) || 0;
    });
  });
  return acc;
}
