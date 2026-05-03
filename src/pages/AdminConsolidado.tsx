import { useMemo, useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { agregadoMensalDoAno, anosComDados, totalAnual, MesAgregado } from '@/lib/consolidado';
import { getMetaDoAno, getMetaMes, MetaAnual } from '@/types/metas';
import { Target, TrendingUp, Calendar, BarChart3 } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line,
} from 'recharts';
import { cn } from '@/lib/utils';

export default function AdminConsolidado() {
  const { grupos, checkins } = useData();
  const anos = useMemo(() => anosComDados(checkins), [checkins]);
  const anoCorrente = new Date().getFullYear();
  const [anoA, setAnoA] = useState<number>(anos[0] ?? anoCorrente);
  const [anoB, setAnoB] = useState<number>(anos[1] ?? anoA - 1);

  const mesesA = useMemo(() => agregadoMensalDoAno(anoA, grupos, checkins), [anoA, grupos, checkins]);
  const mesesB = useMemo(() => agregadoMensalDoAno(anoB, grupos, checkins), [anoB, grupos, checkins]);
  const totA = useMemo(() => totalAnual(mesesA), [mesesA]);
  const totB = useMemo(() => totalAnual(mesesB), [mesesB]);

  const metaA = useMemo(() => getMetaDoAno(anoA), [anoA, checkins]);
  const metaTotal = metaA?.metaTotal || 0;
  const progressoPct = metaTotal > 0 ? Math.min(100, (totA.visitantes / metaTotal) * 100) : 0;

  // dados para gráfico comparativo
  const compData = mesesA.map((m, i) => ({
    mes: m.label,
    [`${anoA}`]: m.visitantes,
    [`${anoB}`]: mesesB[i]?.visitantes || 0,
    meta: getMetaMes(metaA, m.mes),
  }));

  const yoy = (a: number, b: number) => {
    if (b === 0) return a > 0 ? 100 : 0;
    return ((a - b) / b) * 100;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Consolidado Anual</h1>
          <p className="text-sm text-muted-foreground">Mês a mês, comparativo entre anos e progresso da meta</p>
        </div>
        <div className="flex items-center gap-2">
          <Selector label="Ano A" value={anoA} options={anos} onChange={setAnoA} />
          <Selector label="Ano B" value={anoB} options={[...anos, anoA - 1, anoA - 2].filter((v, i, a) => a.indexOf(v) === i)} onChange={setAnoB} />
        </div>
      </div>

      {/* Cartões anuais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label={`Visitantes ${anoA}`} value={totA.visitantes} icon={<Calendar className="h-4 w-4" />} />
        <Kpi label={`Crianças ${anoA}`} value={totA.criancas} sub={`Adultos: ${totA.adultos}`} />
        <Kpi label={`PCD ${anoA}`} value={totA.pcd} />
        <Kpi
          label={`vs ${anoB}`}
          value={`${yoy(totA.visitantes, totB.visitantes).toFixed(1)}%`}
          sub={`${totB.visitantes.toLocaleString('pt-BR')} em ${anoB}`}
          accent={yoy(totA.visitantes, totB.visitantes) >= 0 ? 'positive' : 'negative'}
        />
      </div>

      {/* Progresso da meta */}
      {metaTotal > 0 ? (
        <div className="bg-card rounded-xl shadow-card p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> Meta {anoA}
            </h3>
            <span className="text-xs text-muted-foreground">
              {totA.visitantes.toLocaleString('pt-BR')} / {metaTotal.toLocaleString('pt-BR')} visitantes
            </span>
          </div>
          <div className="h-4 w-full bg-secondary rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', progressoPct >= 100 ? 'bg-cordao-verde' : 'bg-primary')}
              style={{ width: `${progressoPct}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>{progressoPct.toFixed(1)}% da meta</span>
            <span>Faltam {Math.max(0, metaTotal - totA.visitantes).toLocaleString('pt-BR')}</span>
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-xl shadow-card p-6 text-center text-sm text-muted-foreground">
          Nenhuma meta definida para {anoA}. Configure em <strong>Admin → Configurações → Metas</strong>.
        </div>
      )}

      {/* Gráfico mês a mês */}
      <div className="bg-card rounded-xl shadow-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          Visitantes mês a mês — {anoA} vs {anoB} {metaA && '· linha = meta mensal'}
        </h3>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={compData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey={`${anoA}`} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            <Bar dataKey={`${anoB}`} fill="hsl(210, 15%, 60%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tendência acumulada */}
      <div className="bg-card rounded-xl shadow-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          Acumulado vs Meta — {anoA}
        </h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={accAcum(mesesA, metaA)}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="real" stroke="hsl(var(--primary))" strokeWidth={2.5} name="Realizado" />
            {metaTotal > 0 && (
              <Line type="monotone" dataKey="meta" stroke="hsl(142, 50%, 45%)" strokeWidth={2} strokeDasharray="5 5" name="Meta" />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Tabela detalhada */}
      <div className="bg-card rounded-xl shadow-card p-6 overflow-auto">
        <h3 className="text-sm font-semibold text-foreground mb-4">Detalhamento mensal — {anoA}</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase text-muted-foreground">
              <th className="text-left py-2">Mês</th>
              <th className="text-right py-2">Visitantes</th>
              <th className="text-right py-2">Crianças</th>
              <th className="text-right py-2">Adultos</th>
              <th className="text-right py-2">PCD</th>
              <th className="text-right py-2">Meta</th>
              <th className="text-right py-2">% meta</th>
              <th className="text-right py-2">vs {anoB}</th>
            </tr>
          </thead>
          <tbody>
            {mesesA.map((m, i) => {
              const metaMes = getMetaMes(metaA, m.mes);
              const pct = metaMes > 0 ? (m.visitantes / metaMes) * 100 : 0;
              const y = yoy(m.visitantes, mesesB[i]?.visitantes || 0);
              return (
                <tr key={m.mes} className="border-b border-border/40">
                  <td className="py-2 font-medium">{m.label}</td>
                  <td className="text-right font-mono-data">{m.visitantes.toLocaleString('pt-BR')}</td>
                  <td className="text-right font-mono-data">{m.criancas.toLocaleString('pt-BR')}</td>
                  <td className="text-right font-mono-data">{m.adultos.toLocaleString('pt-BR')}</td>
                  <td className="text-right font-mono-data">{m.pcd}</td>
                  <td className="text-right font-mono-data text-muted-foreground">{metaMes ? metaMes.toLocaleString('pt-BR') : '—'}</td>
                  <td className={cn('text-right font-mono-data', pct >= 100 ? 'text-cordao-verde' : pct >= 70 ? 'text-cordao-amarelo' : 'text-muted-foreground')}>
                    {metaMes ? `${pct.toFixed(0)}%` : '—'}
                  </td>
                  <td className={cn('text-right font-mono-data', y >= 0 ? 'text-cordao-verde' : 'text-cordao-vermelho')}>
                    {(mesesB[i]?.visitantes || 0) === 0 && m.visitantes === 0 ? '—' : `${y >= 0 ? '+' : ''}${y.toFixed(0)}%`}
                  </td>
                </tr>
              );
            })}
            <tr className="font-bold bg-secondary/30">
              <td className="py-2">Total</td>
              <td className="text-right font-mono-data">{totA.visitantes.toLocaleString('pt-BR')}</td>
              <td className="text-right font-mono-data">{totA.criancas.toLocaleString('pt-BR')}</td>
              <td className="text-right font-mono-data">{totA.adultos.toLocaleString('pt-BR')}</td>
              <td className="text-right font-mono-data">{totA.pcd}</td>
              <td className="text-right font-mono-data">{metaTotal ? metaTotal.toLocaleString('pt-BR') : '—'}</td>
              <td className="text-right font-mono-data">{metaTotal ? `${progressoPct.toFixed(0)}%` : '—'}</td>
              <td className={cn('text-right font-mono-data', yoy(totA.visitantes, totB.visitantes) >= 0 ? 'text-cordao-verde' : 'text-cordao-vermelho')}>
                {totB.visitantes === 0 && totA.visitantes === 0 ? '—' : `${yoy(totA.visitantes, totB.visitantes) >= 0 ? '+' : ''}${yoy(totA.visitantes, totB.visitantes).toFixed(0)}%`}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function accAcum(meses: MesAgregado[], meta: MetaAnual | undefined) {
  let realAcc = 0, metaAcc = 0;
  return meses.map(m => {
    realAcc += m.visitantes;
    metaAcc += getMetaMes(meta, m.mes);
    return { mes: m.label, real: realAcc, meta: metaAcc };
  });
}

function Kpi({ label, value, sub, icon, accent }: { label: string; value: number | string; sub?: string; icon?: React.ReactNode; accent?: 'positive' | 'negative' }) {
  return (
    <div className="bg-card rounded-xl shadow-card p-5">
      <div className="flex items-center justify-between mb-2 text-muted-foreground">
        {icon}
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <p className={cn('text-3xl font-bold font-mono-data',
        accent === 'positive' && 'text-cordao-verde',
        accent === 'negative' && 'text-cordao-vermelho',
        !accent && 'text-foreground')}>
        {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
      </p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

function Selector({ label, value, options, onChange }: { label: string; value: number; options: number[]; onChange: (n: number) => void }) {
  return (
    <div className="bg-card rounded-xl shadow-card px-3 py-1.5 flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <select
        className="bg-transparent text-sm font-bold text-foreground focus:outline-none"
        value={value}
        onChange={e => onChange(parseInt(e.target.value))}
      >
        {Array.from(new Set(options)).sort((a, b) => b - a).map(o => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}
