import { useState, useMemo, useEffect } from 'react';
import { useData } from '@/contexts/DataContext';
import MLInsightsPanel from '@/components/MLInsightsPanel';
import { CordaoColor, getCordaoLabel, PeriodoFiltro, filtrarPorPeriodo } from '@/types';
import { Users, Baby, Accessibility, Activity, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

const CORDAO_HEX: Record<CordaoColor, string> = {
  azul: '#4A90D9',
  verde: '#3CB371',
  amarelo: '#F5C518',
  vermelho: '#E74C3C',
  rosa: '#E96D9B',
  cinza: '#6B7B8D',
  preto: '#1E293B',
};

const PERIODOS: { value: PeriodoFiltro; label: string }[] = [
  { value: 'hoje', label: 'Hoje' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mês' },
  { value: 'ano', label: 'Ano' },
  { value: 'todos', label: 'Todos' },
];

export default function CoordenadorPanel() {
  const { stats, grupos, checkins } = useData();
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('hoje');
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(interval);
  }, []);

  const filteredCheckins = useMemo(() =>
    filtrarPorPeriodo(checkins, periodo, 'dataHora'),
  [checkins, periodo]);

  const filteredGrupos = useMemo(() => {
    const checkedInIds = new Set(filteredCheckins.map(c => c.grupoVisitaId));
    return grupos.filter(g => checkedInIds.has(g.id));
  }, [grupos, filteredCheckins]);

  const filteredStats = useMemo(() => {
    const porCor: Record<CordaoColor, number> = { azul: 0, verde: 0, amarelo: 0, vermelho: 0, rosa: 0, cinza: 0, preto: 0 };
    const porGuiche: Record<number, number> = {};
    let totalPCD = 0;

    filteredGrupos.forEach(g => {
      porCor.rosa += 1;
      g.responsavel.criancas.forEach(c => {
        porCor[c.cordaoCor] = (porCor[c.cordaoCor] || 0) + 1;
        if (c.pcd) totalPCD++;
      });
      if (g.guiche) porGuiche[g.guiche] = (porGuiche[g.guiche] || 0) + 1;
    });

    return {
      totalVisitantes: filteredGrupos.reduce((a, g) => a + 1 + g.responsavel.criancas.length, 0),
      totalCriancas: filteredGrupos.reduce((a, g) => a + g.responsavel.criancas.length, 0),
      totalResponsaveis: filteredGrupos.length,
      totalPCD,
      porCor,
      porGuiche,
    };
  }, [filteredGrupos]);

  const porCorData = Object.entries(filteredStats.porCor)
    .map(([cor, qtd]) => ({
      name: cor.charAt(0).toUpperCase() + cor.slice(1),
      label: getCordaoLabel(cor as CordaoColor),
      value: qtd,
      fill: CORDAO_HEX[cor as CordaoColor],
    }));

  const porGuicheData = [1, 2, 3, 4, 5, 6].map(g => ({
    name: `G${g}`,
    atendimentos: filteredStats.porGuiche[g] || 0,
  }));

  // Pendentes = only today's scheduled visitors not checked in
  const hoje = new Date().toLocaleDateString('pt-BR');
  const gruposHoje = grupos.filter(g => {
    if (g.dataAgendamento) return g.dataAgendamento === hoje;
    const created = new Date(g.criadoEm);
    return created.toLocaleDateString('pt-BR') === hoje;
  });
  const pendentes = gruposHoje.filter(g => !g.checkinRealizado).length;
  const totalAgendados = gruposHoje.length;

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
        <div className="flex items-center gap-1 bg-card rounded-xl shadow-card p-1">
          {PERIODOS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriodo(p.value)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                periodo === p.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-secondary'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Big counter */}
      <div className="bg-card rounded-2xl shadow-elevated p-8 text-center">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2">
          Total Atendidos ({PERIODOS.find(p => p.value === periodo)?.label})
        </p>
        <p className="text-7xl font-bold text-foreground font-mono-data">{filteredStats.totalVisitantes}</p>
        <p className="text-sm text-muted-foreground mt-2">
          {filteredStats.totalResponsaveis} responsáveis + {filteredStats.totalCriancas} crianças
        </p>
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Agendados', value: totalAgendados, icon: Users },
          { label: 'Check-ins', value: filteredCheckins.length, icon: Baby },
          { label: 'Pendentes', value: pendentes, icon: Users },
          { label: 'PCD', value: filteredStats.totalPCD, icon: Accessibility },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-xl shadow-card p-4">
            <s.icon className="h-4 w-4 text-muted-foreground mb-2" />
            <p className="text-2xl font-bold text-foreground font-mono-data">{s.value}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Cordão distribution */}
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
                    width: `${filteredStats.totalVisitantes > 0 ? Math.max((d.value / filteredStats.totalVisitantes * 100), d.value > 0 ? 8 : 0) : 0}%`,
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
        {filteredStats.totalVisitantes > 0 ? (
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

      <MLInsightsPanel />
    </div>
  );
}
