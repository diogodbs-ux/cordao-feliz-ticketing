import { useData } from '@/contexts/DataContext';
import { CordaoColor, getCordaoLabel } from '@/types';
import { Users, Baby, Accessibility, BarChart3 } from 'lucide-react';
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

export default function AdminDashboard() {
  const { stats, grupos, checkins } = useData();

  const porCorData = Object.entries(stats.porCor)
    .filter(([, v]) => v > 0)
    .map(([cor, qtd]) => ({
      name: cor.charAt(0).toUpperCase() + cor.slice(1),
      value: qtd,
      fill: CORDAO_HEX[cor as CordaoColor],
    }));

  const porGuicheData = Object.entries(stats.porGuiche).map(([g, qtd]) => ({
    name: `Guichê ${g}`,
    atendimentos: qtd,
  }));

  const pendentes = grupos.filter(g => !g.checkinRealizado).length;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard Administrativo</h1>
        <p className="text-sm text-muted-foreground">Visão geral da operação — {new Date().toLocaleDateString('pt-BR')}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total no Parque', value: stats.totalVisitantes, icon: Users, color: 'text-primary' },
          { label: 'Crianças', value: stats.totalCriancas, icon: Baby, color: 'text-cordao-verde' },
          { label: 'Responsáveis', value: stats.totalResponsaveis, icon: Users, color: 'text-cordao-rosa' },
          { label: 'PCD Atendidos', value: stats.totalPCD, icon: Accessibility, color: 'text-primary' },
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

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card rounded-xl shadow-card p-5">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Pendentes</p>
          <p className="text-3xl font-bold text-foreground font-mono-data">{pendentes}</p>
        </div>
        <div className="bg-card rounded-xl shadow-card p-5">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Check-ins Hoje</p>
          <p className="text-3xl font-bold text-foreground font-mono-data">{checkins.length}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribuição por Cor */}
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
            <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
          )}
        </div>

        {/* Performance por Guichê */}
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
            <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
          )}
        </div>
      </div>

      {/* Recent checkins */}
      <div className="bg-card rounded-xl shadow-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Últimos Check-ins</h3>
        <div className="space-y-2">
          {checkins.slice(-10).reverse().map(c => (
            <div key={c.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div>
                <p className="text-sm font-medium text-foreground">{c.responsavelNome}</p>
                <p className="text-xs text-muted-foreground">{c.totalCriancas} criança(s) · Guichê {c.guiche} · {c.atendidoPor}</p>
              </div>
              <div className="flex items-center gap-1.5">
                {c.cordoes.map((co, i) => (
                  <span key={i} className="text-xs font-mono-data text-muted-foreground">
                    {co.quantidade}x {co.cor}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {checkins.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum check-in registrado</p>}
        </div>
      </div>
    </div>
  );
}
