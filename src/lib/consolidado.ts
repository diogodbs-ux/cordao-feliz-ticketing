// Consolidação mensal/anual e comparativos YoY
import { GrupoVisita, CheckinRegistro, calcAdultCordoes } from '@/types';

export interface MesAgregado {
  ano: number;
  mes: number; // 1..12
  label: string; // "Jan", "Fev"...
  checkins: number;
  responsaveis: number;
  criancas: number;
  adultos: number;
  visitantes: number;
  pcd: number;
}

const MES_LABEL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function parseCheckinDate(c: CheckinRegistro): Date | null {
  const d = new Date(c.dataHora);
  if (isNaN(d.getTime())) return null;
  return d;
}

export function agregadoMensalDoAno(
  ano: number,
  grupos: GrupoVisita[],
  checkins: CheckinRegistro[]
): MesAgregado[] {
  const grupoMap = new Map(grupos.map(g => [g.id, g]));
  const meses: MesAgregado[] = MES_LABEL.map((label, i) => ({
    ano, mes: i + 1, label,
    checkins: 0, responsaveis: 0, criancas: 0, adultos: 0, visitantes: 0, pcd: 0,
  }));

  checkins.forEach(c => {
    const d = parseCheckinDate(c);
    if (!d || d.getFullYear() !== ano) return;
    const m = meses[d.getMonth()];
    m.checkins++;
    m.responsaveis++;
    const g = grupoMap.get(c.grupoVisitaId);
    if (g) {
      const k = g.responsavel.criancas.length;
      m.criancas += k;
      m.adultos += calcAdultCordoes(k);
      m.visitantes += k + calcAdultCordoes(k);
      m.pcd += g.responsavel.criancas.filter(x => x.pcd).length;
    }
  });

  return meses;
}

export function totalAnual(meses: MesAgregado[]): MesAgregado {
  return meses.reduce((acc, m) => ({
    ano: m.ano, mes: 0, label: 'Total',
    checkins: acc.checkins + m.checkins,
    responsaveis: acc.responsaveis + m.responsaveis,
    criancas: acc.criancas + m.criancas,
    adultos: acc.adultos + m.adultos,
    visitantes: acc.visitantes + m.visitantes,
    pcd: acc.pcd + m.pcd,
  }), { ano: meses[0]?.ano || 0, mes: 0, label: 'Total', checkins: 0, responsaveis: 0, criancas: 0, adultos: 0, visitantes: 0, pcd: 0 });
}

export function anosComDados(checkins: CheckinRegistro[]): number[] {
  const set = new Set<number>();
  checkins.forEach(c => {
    const d = new Date(c.dataHora);
    if (!isNaN(d.getTime())) set.add(d.getFullYear());
  });
  if (set.size === 0) set.add(new Date().getFullYear());
  return Array.from(set).sort((a, b) => b - a);
}
