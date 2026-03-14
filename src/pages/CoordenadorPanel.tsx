import { useData } from '@/contexts/DataContext';
import MLInsightsPanel from '@/components/MLInsightsPanel';
import { CordaoColor, getCordaoLabel } from '@/types';
import { Users, Baby, Accessibility, Activity, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useEffect, useState } from 'react';

const CORDAO_HEX: Record<CordaoColor, string> = {
  azul: '#4A90D9',
  verde: '#3CB371',
  amarelo: '#F5C518',
  vermelho: '#E74C3C',
  rosa: '#E96D9B',
  cinza: '#6B7B8D',
  preto: '#1E293B',
};

export default function CoordenadorPanel() {
  const { stats, grupos, checkins } = useData();
  const [, setTick] = useState(0);

  // Auto-refresh every 5s for real-time feel
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(interval);
  }, []);

  const porCorData = Object.entries(stats.porCor)
    .map(([cor, qtd]) => ({
      name: cor.charAt(0).toUpperCase() + cor.slice(1),
      label: getCordaoLabel(cor as CordaoColor),
      value: qtd,
      fill: CORDAO_HEX[cor as CordaoColor],
    }));

  const porGuicheData = [1, 2, 3, 4, 5, 6].map(g => ({
    name: `G${g}`,
    atendimentos: stats.porGuiche[g] || 0,
  }));

  const pendentes = grupos.filter(g => !g.checkinRealizado).length;
  const totalAgendados = grupos.length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Painel de Coordenação</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Activity className="h-3 w-3 text-cordao-verde animate-pulse" />
            Tempo real — {new Date().toLocaleDateString('pt-BR')}
          </p>
        </div>
      </div>

      {/* Big counter */}
      <div className="bg-card rounded-2xl shadow-elevated p-8 text-center">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2">Total no Parque Agora</p>
        <p className="text-7xl font-bold text-foreground font-mono-data">{stats.totalVisitantes}</p>
        <p className="text-sm text-muted-foreground mt-2">
          {stats.totalResponsaveis} responsáveis + {stats.totalCriancas} crianças
        </p>
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Agendados', value: totalAgendados, icon: Users },
          { label: 'Check-ins', value: checkins.length, icon: Baby },
          { label: 'Pendentes', value: pendentes, icon: Users },
          { label: 'PCD', value: stats.totalPCD, icon: Accessibility },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-xl shadow-card p-4">
            <s.icon className="h-4 w-4 text-muted-foreground mb-2" />
            <p className="text-2xl font-bold text-foreground font-mono-data">{s.value}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Cordão distribution - horizontal bars */}
      <div className="bg-card rounded-xl shadow-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          Distribuição por Cor de Cordão
        </h3>
        <div className="space-y-3">
          {porCorData.map(d => (
            <div key={d.name} className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: d.fill }} />
              <span className="text-sm text-foreground w-36 truncate">{d.label}</span>
              <div className="flex-1 bg-secondary rounded-full h-8 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 flex items-center justify-end pr-2"
                  style={{
                    width: `${stats.totalVisitantes > 0 ? Math.max((d.value / stats.totalVisitantes * 100), d.value > 0 ? 8 : 0) : 0}%`,
                    backgroundColor: d.fill,
                  }}
                >
                  {d.value > 0 && <span className="text-xs font-bold text-primary-foreground">{d.value}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Guichê performance */}
      <div className="bg-card rounded-xl shadow-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Performance por Guichê</h3>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
          {porGuicheData.map((g, i) => (
            <div key={i} className="bg-secondary/50 rounded-xl p-4 text-center">
              <p className="text-xs text-muted-foreground">Guichê</p>
              <p className="text-xl font-bold text-foreground">{String(i + 1).padStart(2, '0')}</p>
              <p className="text-2xl font-bold text-primary font-mono-data mt-1">{g.atendimentos}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Donut chart */}
      <div className="bg-card rounded-xl shadow-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Distribuição Visual</h3>
        {stats.totalVisitantes > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={porCorData.filter(d => d.value > 0)} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={110} paddingAngle={3}>
                {porCorData.filter(d => d.value > 0).map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
            Aguardando check-ins...
          </div>
        )}
      </div>
    </div>
  );
}
