import { useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { CordaoColor, getCordaoLabel, getCordaoTailwindBg } from '@/types';
import { Shield, Users, Baby, Accessibility, CheckCircle2, BarChart3, Clock, Building, Cake, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const CORDAO_HEX: Record<CordaoColor, string> = {
  azul: '#3B82F6',
  verde: '#22C55E',
  amarelo: '#EAB308',
  vermelho: '#EF4444',
  rosa: '#EC4899',
  cinza: '#9CA3AF',
  preto: '#1F2937',
};

function getHojeDDMMYYYY(): string {
  const now = new Date();
  return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
}

export default function ApresentacaoExecutiva() {
  const { grupos, checkins, stats } = useData();
  const hoje = getHojeDDMMYYYY();

  const gruposHoje = useMemo(() =>
    grupos.filter(g => {
      if (g.dataAgendamento) return g.dataAgendamento === hoje;
      return new Date(g.criadoEm).toLocaleDateString('pt-BR') === hoje;
    }),
  [grupos, hoje]);

  const checkinsHoje = useMemo(() =>
    checkins.filter(c => new Date(c.dataHora).toLocaleDateString('pt-BR') === hoje),
  [checkins, hoje]);

  const totalAgendados = gruposHoje.length;
  const totalAtendidos = checkinsHoje.length;
  const totalCriancas = gruposHoje.reduce((a, g) => a + g.responsavel.criancas.length, 0);
  const totalCriancasAtendidas = gruposHoje.filter(g => g.checkinRealizado).reduce((a, g) => a + g.responsavel.criancas.length, 0);
  const totalPCD = gruposHoje.reduce((a, g) => a + g.responsavel.criancas.filter(c => c.pcd).length, 0);
  const taxaPresenca = totalAgendados > 0 ? Math.round((totalAtendidos / totalAgendados) * 100) : 0;

  // Data for pie chart - cordão distribution
  const cordaoData = useMemo(() => {
    const counts: Partial<Record<CordaoColor, number>> = {};
    gruposHoje.forEach(g => {
      g.responsavel.criancas.forEach(c => {
        counts[c.cordaoCor] = (counts[c.cordaoCor] || 0) + 1;
      });
    });
    return Object.entries(counts).map(([cor, qty]) => ({
      name: getCordaoLabel(cor as CordaoColor).split(' (')[0],
      value: qty,
      color: CORDAO_HEX[cor as CordaoColor],
    }));
  }, [gruposHoje]);

  // Data for bar chart - check-ins by booth
  const guicheData = useMemo(() => {
    const counts: Record<number, number> = {};
    checkinsHoje.forEach(c => {
      counts[c.guiche] = (counts[c.guiche] || 0) + 1;
    });
    return Object.entries(counts).map(([g, count]) => ({
      name: `G${String(g).padStart(2, '0')}`,
      atendimentos: count,
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [checkinsHoje]);

  // Timeline data - check-ins by hour
  const timelineData = useMemo(() => {
    const hours: Record<string, number> = {};
    checkinsHoje.forEach(c => {
      const h = new Date(c.dataHora).getHours();
      const label = `${String(h).padStart(2, '0')}h`;
      hours[label] = (hours[label] || 0) + 1;
    });
    return Object.entries(hours).map(([hora, count]) => ({ hora, atendimentos: count })).sort((a, b) => a.hora.localeCompare(b.hora));
  }, [checkinsHoje]);

  const StatCard = ({ icon: Icon, label, value, sub, accent }: { icon: any; label: string; value: string | number; sub?: string; accent?: string }) => (
    <div className="bg-card rounded-2xl shadow-card p-6 flex flex-col items-center text-center">
      <div className={cn('h-12 w-12 rounded-xl flex items-center justify-center mb-3', accent || 'bg-primary/10')}>
        <Icon className={cn('h-6 w-6', accent ? 'text-primary-foreground' : 'text-primary')} />
      </div>
      <p className="text-3xl font-extrabold text-foreground font-mono-data">{value}</p>
      <p className="text-sm font-semibold text-foreground mt-1">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-3 bg-primary/10 px-4 py-2 rounded-full">
          <Shield className="h-5 w-5 text-primary" />
          <span className="text-sm font-bold text-primary tracking-wider uppercase">Sentinela Infância</span>
        </div>
        <h1 className="text-3xl font-extrabold text-foreground">Painel Executivo</h1>
        <p className="text-muted-foreground">Resumo operacional — {hoje}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard icon={Users} label="Agendados" value={totalAgendados} sub="grupos hoje" />
        <StatCard icon={CheckCircle2} label="Atendidos" value={totalAtendidos} sub={`${taxaPresenca}% presença`} />
        <StatCard icon={Baby} label="Crianças" value={totalCriancas} sub={`${totalCriancasAtendidas} com check-in`} />
        <StatCard icon={Accessibility} label="PCD" value={totalPCD} sub="atenção especial" accent="bg-primary" />
        <StatCard icon={TrendingUp} label="Taxa Presença" value={`${taxaPresenca}%`} sub="do total agendado" />
        <StatCard icon={Clock} label="Pendentes" value={totalAgendados - totalAtendidos} sub="aguardando check-in" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cordão Distribution */}
        <div className="bg-card rounded-2xl shadow-card p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Distribuição por Faixa Etária</h3>
          {cordaoData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={cordaoData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {cordaoData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
          )}
        </div>

        {/* Check-ins by Booth */}
        <div className="bg-card rounded-2xl shadow-card p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Atendimentos por Guichê</h3>
          {guicheData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={guicheData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Bar dataKey="atendimentos" fill="hsl(217, 91%, 60%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
          )}
        </div>

        {/* Timeline */}
        <div className="bg-card rounded-2xl shadow-card p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Fluxo por Hora</h3>
          {timelineData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="hora" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Bar dataKey="atendimentos" fill="hsl(142, 71%, 45%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
          )}
        </div>
      </div>

      {/* Cordão Legend */}
      <div className="bg-card rounded-2xl shadow-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Legenda de Cordões</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {(['azul', 'verde', 'amarelo', 'vermelho', 'rosa', 'cinza', 'preto'] as CordaoColor[]).map(cor => (
            <div key={cor} className="flex items-center gap-2 bg-secondary/30 rounded-lg p-3">
              <div className={cn('h-4 w-4 rounded-full', getCordaoTailwindBg(cor))} />
              <span className="text-xs font-medium text-foreground">{getCordaoLabel(cor)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* System overview */}
      <div className="bg-card rounded-2xl shadow-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Sobre o Sistema</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground leading-relaxed">
          <div className="space-y-2">
            <p><strong className="text-foreground">Sentinela Infância</strong> é um sistema de gestão operacional para controle de visitantes em espaços culturais e recreativos voltados ao público infantil.</p>
            <p>Controla o fluxo de entrada com cordões coloridos por faixa etária, garantindo segurança e organização na recepção de crianças, acompanhantes e grupos especiais.</p>
          </div>
          <div className="space-y-2">
            <p><strong className="text-foreground">Funcionalidades:</strong></p>
            <ul className="list-disc list-inside space-y-1">
              <li>Importação de planilhas de agendamento</li>
              <li>Check-in em tempo real com múltiplos guichês</li>
              <li>Listas especiais (aniversários e instituições)</li>
              <li>Alertas operacionais inteligentes (PCD, capacidade, volume)</li>
              <li>Relatórios e dashboards executivos</li>
              <li>Perfis: Admin, Coordenador, Recreador e Observador</li>
            </ul>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Sentinela Infância © {new Date().getFullYear()} — Sistema de Gestão de Visitantes
      </p>
    </div>
  );
}
