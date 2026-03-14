import { useData } from '@/contexts/DataContext';
import { analyzeHourlyPattern, getPeakHour, analyzeTrend, detectAnomaly, clusterVisitors, calcAvgServiceTime, forecastCapacity } from '@/lib/ml';
import { Brain, TrendingUp, TrendingDown, Minus, AlertTriangle, Clock, Users, Zap, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, ReferenceLine } from 'recharts';

export default function MLInsightsPanel() {
  const { checkins, stats, grupos } = useData();

  const hourlyData = analyzeHourlyPattern(checkins);
  const peakHour = getPeakHour(hourlyData);
  const trend = analyzeTrend(checkins);
  const anomaly = detectAnomaly(stats.totalVisitantes, checkins.map(c => 1 + c.totalCriancas));
  const clusters = clusterVisitors(checkins, grupos);
  const avgTime = calcAvgServiceTime(checkins);
  const capacity = forecastCapacity(stats.totalVisitantes, checkins);

  const TrendIcon = trend.direction === 'up' ? TrendingUp : trend.direction === 'down' ? TrendingDown : Minus;

  const chartData = hourlyData.map(d => ({
    hora: `${d.hour}h`,
    real: d.count || undefined,
    previsão: d.predicted || undefined,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Brain className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold text-foreground">Inteligência Operacional</h2>
        <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">ML</span>
      </div>

      {/* Key ML Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl shadow-card p-4">
          <Clock className="h-4 w-4 text-muted-foreground mb-2" />
          <p className="text-2xl font-bold text-foreground font-mono-data">{peakHour.hour}h</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Horário de Pico</p>
          <p className="text-xs text-muted-foreground mt-1">~{peakHour.count} visitantes/h</p>
        </div>

        <div className="bg-card rounded-xl shadow-card p-4">
          <TrendIcon className={cn('h-4 w-4 mb-2', trend.direction === 'up' ? 'text-cordao-verde' : trend.direction === 'down' ? 'text-destructive' : 'text-muted-foreground')} />
          <p className="text-2xl font-bold text-foreground font-mono-data">
            {trend.percentChange > 0 ? '+' : ''}{trend.percentChange.toFixed(1)}%
          </p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Tendência</p>
          <p className="text-xs text-muted-foreground mt-1">Confiança: {trend.confidence.toFixed(0)}%</p>
        </div>

        <div className="bg-card rounded-xl shadow-card p-4">
          <Zap className="h-4 w-4 text-muted-foreground mb-2" />
          <p className="text-2xl font-bold text-foreground font-mono-data">{avgTime || '—'}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Min/Atendimento</p>
          <p className="text-xs text-muted-foreground mt-1">Tempo médio por guichê</p>
        </div>

        <div className="bg-card rounded-xl shadow-card p-4">
          <BarChart3 className="h-4 w-4 text-muted-foreground mb-2" />
          <p className="text-2xl font-bold text-foreground font-mono-data">{capacity.occupancyRate}%</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Ocupação</p>
          {capacity.estimatedFullAt && (
            <p className="text-xs text-cordao-vermelho mt-1">Lotação às {capacity.estimatedFullAt}</p>
          )}
        </div>
      </div>

      {/* Anomaly Alert */}
      {anomaly.isAnomaly && (
        <div className={cn(
          'rounded-xl p-4 flex items-start gap-3',
          anomaly.severity === 'critical' ? 'bg-destructive/10' : 'bg-accent/30'
        )}>
          <AlertTriangle className={cn('h-5 w-5 flex-shrink-0 mt-0.5', anomaly.severity === 'critical' ? 'text-destructive' : 'text-cordao-amarelo')} />
          <div>
            <p className="text-sm font-semibold text-foreground">Anomalia Detectada</p>
            <p className="text-sm text-muted-foreground">{anomaly.message}</p>
            <p className="text-xs text-muted-foreground mt-1">Z-Score: {anomaly.zScore.toFixed(2)}</p>
          </div>
        </div>
      )}

      {/* Hourly Pattern Chart */}
      <div className="bg-card rounded-xl shadow-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Padrão Horário & Previsão de Pico</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" />
            <XAxis dataKey="hora" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="real" fill="hsl(217 91% 60%)" radius={[4, 4, 0, 0]} name="Real" />
            <Bar dataKey="previsão" fill="hsl(217 91% 60% / 0.3)" radius={[4, 4, 0, 0]} name="Previsão" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Capacity Forecast */}
      <div className="bg-card rounded-xl shadow-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-3">Previsão de Capacidade</h3>
        <div className="relative h-6 bg-secondary rounded-full overflow-hidden mb-3">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-700',
              capacity.occupancyRate > 90 ? 'bg-destructive' :
              capacity.occupancyRate > 75 ? 'bg-cordao-amarelo' : 'bg-cordao-verde'
            )}
            style={{ width: `${Math.min(capacity.occupancyRate, 100)}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{capacity.currentOccupancy} visitantes</span>
          <span>Capacidade: {capacity.maxCapacity}</span>
        </div>
        <p className="text-sm text-foreground mt-3">{capacity.recommendation}</p>
      </div>

      {/* Visitor Clusters */}
      {clusters.length > 0 && (
        <div className="bg-card rounded-xl shadow-card p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Segmentação de Visitantes (Clustering)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {clusters.map((c, i) => (
              <div key={i} className="bg-secondary/30 rounded-xl p-4">
                <p className="text-sm font-semibold text-foreground">{c.label}</p>
                <p className="text-2xl font-bold text-foreground font-mono-data mt-1">{c.count}</p>
                <p className="text-xs text-muted-foreground mt-1">Média: {c.avgCriancas} crianças</p>
                {c.topBairros.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Bairros: {c.topBairros.join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trend Description */}
      <div className="bg-card rounded-xl shadow-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-2">Análise de Tendência</h3>
        <p className="text-sm text-muted-foreground">{trend.description}</p>
        {trend.projectedTotal > 0 && (
          <p className="text-sm text-foreground mt-2">
            Projeção para próximo período: <span className="font-bold font-mono-data">{trend.projectedTotal}</span> visitantes
          </p>
        )}
      </div>
    </div>
  );
}
