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
