// Predição leve baseada no ml.ts já existente.
// Usa histograma das últimas horas para estimar entradas nos próximos 30 min.
import { CheckinRegistro } from '@/types';
import { linearRegression, predict } from '@/lib/ml';

export interface PredicaoSuperlotacao {
  proximos30min: number;        // entradas previstas
  proximos60min: number;
  tendencia: 'subindo' | 'estavel' | 'caindo';
  risco: 'baixo' | 'medio' | 'alto';
  confianca: number;            // 0..1 (R²)
  recomendacao: string;
}

export function preverProximos30Min(checkins: CheckinRegistro[]): PredicaoSuperlotacao {
  const agora = new Date();
  const baseHora = agora.getHours();

  // Conta entradas por hora nas últimas 4 horas (incluindo a atual)
  const buckets: { h: number; count: number }[] = [];
  for (let i = 3; i >= 0; i--) {
    const h = baseHora - i;
    if (h < 0) continue;
    const c = checkins.filter(x => {
      const d = new Date(x.dataHora);
      return d.toDateString() === agora.toDateString() && d.getHours() === h;
    }).length;
    buckets.push({ h, count: c });
  }

  // Regressão linear sobre as horas para projetar
  const xs = buckets.map((b, i) => i);
  const ys = buckets.map(b => b.count);
  let proximos60 = 0;
  let confianca = 0;
  if (xs.length >= 2) {
    const m = linearRegression(xs, ys);
    proximos60 = Math.max(0, Math.round(predict(m, xs.length)));
    confianca = Math.max(0, Math.min(1, m.r2));
  } else if (ys.length === 1) {
    proximos60 = ys[0];
  }
  const proximos30 = Math.round(proximos60 / 2);

  // Tendência
  const ultima = ys[ys.length - 1] || 0;
  const anterior = ys[ys.length - 2] || 0;
  let tendencia: PredicaoSuperlotacao['tendencia'] = 'estavel';
  if (ultima > anterior * 1.2) tendencia = 'subindo';
  else if (ultima < anterior * 0.8) tendencia = 'caindo';

  // Risco simples — calibrado para um parque típico (~80/hora = pico)
  let risco: PredicaoSuperlotacao['risco'] = 'baixo';
  if (proximos60 >= 60) risco = 'alto';
  else if (proximos60 >= 30) risco = 'medio';

  const rec =
    risco === 'alto'
      ? `Antecipar redistribuição de recreadores. Esperando ~${proximos30} entradas nos próximos 30 min.`
      : risco === 'medio'
      ? `Manter equipe alerta. Previsão ~${proximos30} entradas nos próximos 30 min.`
      : `Fluxo previsível. ~${proximos30} entradas nos próximos 30 min.`;

  return { proximos30min: proximos30, proximos60min: proximos60, tendencia, risco, confianca, recomendacao: rec };
}
