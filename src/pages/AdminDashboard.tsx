import { useState, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import MLInsightsPanel from '@/components/MLInsightsPanel';
import { CordaoColor, getCordaoLabel, PeriodoFiltro, filtrarPorPeriodo, getOrigemLabel } from '@/types';
import { Users, Baby, Accessibility, BarChart3, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

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

export default function AdminDashboard() {
  const { stats, grupos, checkins } = useData();
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('hoje');

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
    .filter(([, v]) => v > 0)
    .map(([cor, qtd]) => ({
      name: cor.charAt(0).toUpperCase() + cor.slice(1),
      value: qtd,
      fill: CORDAO_HEX[cor as CordaoColor],
    }));

  const porGuicheData = Object.entries(filteredStats.porGuiche).map(([g, qtd]) => ({
    name: `Guichê ${g}`,
    atendimentos: qtd,
  }));

  // Pendentes = only today's scheduled visitors not checked in
  const hoje = new Date().toLocaleDateString('pt-BR');
  const gruposHoje = grupos.filter(g => {
    if (g.dataAgendamento) return g.dataAgendamento === hoje;
    const created = new Date(g.criadoEm);
    return created.toLocaleDateString('pt-BR') === hoje;
  });
  const pendentes = gruposHoje.filter(g => !g.checkinRealizado).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard Administrativo</h1>
          <p className="text-sm text-muted-foreground">Visão geral da operação — {new Date().toLocaleDateString('pt-BR')}</p>
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

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Atendidos', value: filteredStats.totalVisitantes, icon: Users, color: 'text-primary' },
          { label: 'Crianças', value: filteredStats.totalCriancas, icon: Baby, color: 'text-cordao-verde' },
          { label: 'Responsáveis', value: filteredStats.totalResponsaveis, icon: Users, color: 'text-cordao-rosa' },
          { label: 'PCD Atendidos', value: filteredStats.totalPCD, icon: Accessibility, color: 'text-primary' },
          { label: 'Pendentes', value: pendentes, icon: Calendar, color: 'text-cordao-amarelo' },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-xl shadow-card p-5">
            <div className="flex items-center justify-between mb-3">
              <s.icon className={cn('h-5 w-5', s.color)} />
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{s.label}</span>
            </div>
            <p className="text-3xl font-bold text-foreground font-mono-data">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl shadow-card p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            Distribuição de Cordões
          </h3>
          {porCorData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={porCorData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3}>
                  {porCorData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">Sem dados no período</div>
          )}
        </div>

        <div className="bg-card rounded-xl shadow-card p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            Performance por Guichê
          </h3>
          {porGuicheData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={porGuicheData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={80} />
                <Tooltip />
                <Bar dataKey="atendimentos" fill="hsl(217 91% 60%)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">Sem dados no período</div>
          )}
        </div>
      </div>

      {/* Recent checkins with responsible details */}
      <div className="bg-card rounded-xl shadow-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Últimos Check-ins ({filteredCheckins.length})</h3>
        <div className="space-y-2">
          {filteredCheckins.slice(-15).reverse().map(c => {
            const grupo = grupos.find(g => g.id === c.grupoVisitaId);
            return (
              <div key={c.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="text-sm font-medium text-foreground">{c.responsavelNome}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.totalCriancas} criança(s) · Guichê {c.guiche} · {c.atendidoPor}
                    {grupo?.origem && grupo.origem !== 'agendamento' && (
                      <span className="ml-1 text-[10px] bg-secondary px-1 py-0.5 rounded">{getOrigemLabel(grupo.origem)}</span>
                    )}
                  </p>
                  {grupo && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {grupo.responsavel.bairro}, {grupo.responsavel.cidade} · {grupo.responsavel.contato}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {c.cordoes.map((co, i) => (
                    <span key={i} className="text-xs font-mono-data text-muted-foreground">
                      {co.quantidade}x {co.cor}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
          {filteredCheckins.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum check-in no período</p>}
        </div>
      </div>

      <MLInsightsPanel />
    </div>
  );
}
