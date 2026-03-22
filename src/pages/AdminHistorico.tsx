import { useMemo, useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { calcAdultCordoes, CordaoColor } from '@/types';
import { BarChart3, TrendingUp, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, PieChart, Pie, Cell,
} from 'recharts';

const CORDAO_HEX: Record<CordaoColor, string> = {
  azul: '#4A90D9', verde: '#3CB371', amarelo: '#F5C518',
  vermelho: '#E74C3C', rosa: '#E96D9B', cinza: '#6B7B8D', preto: '#1E293B',
};

type ViewMode = 'diario' | 'semanal' | 'mensal';

export default function AdminHistorico() {
  const { grupos, checkins } = useData();
  const [viewMode, setViewMode] = useState<ViewMode>('diario');

  // Build daily data from checkins
  const dailyData = useMemo(() => {
    const map = new Map<string, { date: string; visitantes: number; criancas: number; adultos: number; checkins: number }>();

    checkins.forEach(c => {
      const d = new Date(c.dataHora).toLocaleDateString('pt-BR');
      if (!map.has(d)) map.set(d, { date: d, visitantes: 0, criancas: 0, adultos: 0, checkins: 0 });
      const entry = map.get(d)!;
      const grupo = grupos.find(g => g.id === c.grupoVisitaId);
      if (grupo) {
        const numKids = grupo.responsavel.criancas.length;
        entry.criancas += numKids;
        entry.adultos += calcAdultCordoes(numKids);
        entry.visitantes += numKids + calcAdultCordoes(numKids);
      }
      entry.checkins++;
    });

    return Array.from(map.values()).sort((a, b) => {
      const [da, ma, ya] = a.date.split('/').map(Number);
      const [db, mb, yb] = b.date.split('/').map(Number);
      return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
    });
  }, [checkins, grupos]);

  // Weekly aggregation
  const weeklyData = useMemo(() => {
    const map = new Map<string, { week: string; visitantes: number; criancas: number; checkins: number }>();
    checkins.forEach(c => {
      const d = new Date(c.dataHora);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = weekStart.toLocaleDateString('pt-BR');
      if (!map.has(key)) map.set(key, { week: `Sem. ${key}`, visitantes: 0, criancas: 0, checkins: 0 });
      const entry = map.get(key)!;
      const grupo = grupos.find(g => g.id === c.grupoVisitaId);
      if (grupo) {
        entry.criancas += grupo.responsavel.criancas.length;
        entry.visitantes += grupo.responsavel.criancas.length + calcAdultCordoes(grupo.responsavel.criancas.length);
      }
      entry.checkins++;
    });
    return Array.from(map.values());
  }, [checkins, grupos]);

  // Geographic data
  const geoData = useMemo(() => {
    const bairros = new Map<string, number>();
    const cidades = new Map<string, number>();
    const estados = new Map<string, number>();

    const checkedGrupos = grupos.filter(g => g.checkinRealizado);
    checkedGrupos.forEach(g => {
      const b = g.responsavel.bairro?.toUpperCase().trim();
      const c = g.responsavel.cidade?.toUpperCase().trim();
      const u = g.responsavel.uf?.toUpperCase().trim();
      if (b) bairros.set(b, (bairros.get(b) || 0) + 1);
      if (c) cidades.set(c, (cidades.get(c) || 0) + 1);
      if (u) estados.set(u, (estados.get(u) || 0) + 1);
    });

    return {
      bairros: Array.from(bairros.entries()).sort((a, b) => b[1] - a[1]),
      cidades: Array.from(cidades.entries()).sort((a, b) => b[1] - a[1]),
      estados: Array.from(estados.entries()).sort((a, b) => b[1] - a[1]),
    };
  }, [grupos]);

  const COLORS = ['hsl(217, 91%, 60%)', 'hsl(142, 50%, 45%)', 'hsl(45, 93%, 53%)', 'hsl(0, 78%, 56%)', 'hsl(340, 72%, 65%)', 'hsl(210, 15%, 47%)', 'hsl(215, 25%, 18%)'];

  const cidadesPieData = geoData.cidades.slice(0, 8).map(([name, value], i) => ({
    name, value, fill: COLORS[i % COLORS.length],
  }));

  const chartData = viewMode === 'diario' ? dailyData : viewMode === 'semanal' ? weeklyData : dailyData;
  const xKey = viewMode === 'diario' ? 'date' : viewMode === 'semanal' ? 'week' : 'date';

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Histórico & Geográfico</h1>
          <p className="text-sm text-muted-foreground">Comparativos entre dias/semanas e distribuição geográfica dos visitantes</p>
        </div>
        <div className="flex items-center gap-1 bg-card rounded-xl shadow-card p-1">
          {([
            { value: 'diario' as ViewMode, label: 'Diário' },
            { value: 'semanal' as ViewMode, label: 'Semanal' },
          ]).map(p => (
            <button
              key={p.value}
              onClick={() => setViewMode(p.value)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                viewMode === p.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Historical comparison chart */}
      <div className="bg-card rounded-xl shadow-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          Comparativo de Visitantes — {viewMode === 'diario' ? 'Por Dia' : 'Por Semana'}
        </h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey={xKey} tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="visitantes" fill="hsl(var(--primary))" name="Total Visitantes" radius={[4, 4, 0, 0]} />
              <Bar dataKey="criancas" fill={CORDAO_HEX.verde} name="Crianças" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">Sem dados históricos</div>
        )}
      </div>

      {/* Trend line */}
      {dailyData.length > 1 && (
        <div className="bg-card rounded-xl shadow-card p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Linha de Tendência — Atendimentos Diários
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="checkins" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} name="Check-ins" />
              <Line type="monotone" dataKey="visitantes" stroke={CORDAO_HEX.rosa} strokeWidth={2} dot={{ r: 3 }} name="Visitantes" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Geographic Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cities pie chart */}
        <div className="bg-card rounded-xl shadow-card p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            Municípios — Top 8
          </h3>
          {cidadesPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={cidadesPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={100} paddingAngle={2}>
                  {cidadesPieData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
          )}
        </div>

        {/* States */}
        <div className="bg-card rounded-xl shadow-card p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            Estados
          </h3>
          <div className="space-y-2">
            {geoData.estados.length > 0 ? geoData.estados.map(([uf, count]) => (
              <div key={uf} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <span className="text-sm font-medium text-foreground">{uf}</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 bg-secondary rounded-full h-4 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.min((count / (geoData.estados[0]?.[1] || 1)) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-foreground font-mono-data w-8 text-right">{count}</span>
                </div>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground text-center py-4">Sem dados</p>
            )}
          </div>
        </div>
      </div>

      {/* Bairros ranking */}
      <div className="bg-card rounded-xl shadow-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          Top 20 Bairros
        </h3>
        {geoData.bairros.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
            {geoData.bairros.slice(0, 20).map(([bairro, count], i) => (
              <div key={bairro} className="flex items-center justify-between py-1.5 border-b border-border/50">
                <span className="text-xs text-muted-foreground w-6">{i + 1}.</span>
                <span className="text-sm text-foreground flex-1 truncate">{bairro}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 bg-secondary rounded-full h-3 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-cordao-verde transition-all"
                      style={{ width: `${Math.min((count / (geoData.bairros[0]?.[1] || 1)) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-foreground font-mono-data w-6 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">Sem dados geográficos</p>
        )}
      </div>

      {/* All cities table */}
      <div className="bg-card rounded-xl shadow-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Todos os Municípios ({geoData.cidades.length})</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {geoData.cidades.map(([cidade, count]) => (
            <div key={cidade} className="flex items-center justify-between bg-secondary/30 rounded-lg px-3 py-2">
              <span className="text-xs text-foreground truncate">{cidade}</span>
              <span className="text-xs font-bold text-primary font-mono-data ml-2">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
