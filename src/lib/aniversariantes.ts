// Helper para detectar se um responsável/criança é aniversariante hoje.
import { ListaAniversariante } from '@/types/listas';

const STORAGE = 'sentinela_aniversariantes';

function read(): ListaAniversariante[] {
  try { return JSON.parse(localStorage.getItem(STORAGE) || '[]'); } catch { return []; }
}

function hojeStr(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function norm(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/** Retorna o nome do aniversariante de hoje associado a um responsável ou criança, se houver. */
export function aniversarianteDeHoje(nomeResponsavel: string, nomesCriancas: string[] = []): string | null {
  const hoje = hojeStr();
  const lista = read().filter(l => l.dataVisita === hoje);
  if (lista.length === 0) return null;
  const respN = norm(nomeResponsavel);
  const criN = nomesCriancas.map(norm);
  for (const l of lista) {
    if (norm(l.responsavelNome) === respN) return l.nomeAniversariante;
    if (criN.includes(norm(l.nomeAniversariante))) return l.nomeAniversariante;
    // também aceitar match em convidado-criança
    const conv = (l.convidados || []).find(c => criN.includes(norm(c.nome)));
    if (conv) return l.nomeAniversariante;
  }
  return null;
}

/** Verifica se um nome específico é aniversariante hoje. */
export function ehAniversarianteHoje(nome: string): boolean {
  const hoje = hojeStr();
  const n = norm(nome);
  return read().some(l => l.dataVisita === hoje && norm(l.nomeAniversariante) === n);
}
