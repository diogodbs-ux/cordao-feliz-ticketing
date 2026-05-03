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

export function readEspacos(): EspacoLudico[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_ESPACOS) || '[]'); } catch { return []; }
}
export function writeEspacos(list: EspacoLudico[]) {
  localStorage.setItem(STORAGE_ESPACOS, JSON.stringify(list));
}
export function readCiclos(): CicloEspaco[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_CICLOS) || '[]'); } catch { return []; }
}
export function writeCiclos(list: CicloEspaco[]) {
  localStorage.setItem(STORAGE_CICLOS, JSON.stringify(list));
}
