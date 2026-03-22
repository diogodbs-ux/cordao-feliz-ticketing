import { useMemo, useState, useEffect } from 'react';
import { useData } from '@/contexts/DataContext';
import { calcAdultCordoes, CordaoColor, getCordaoLabel } from '@/types';
import { AlertConfig, DEFAULT_ALERT_CONFIG } from '@/types/listas';
import { AlertTriangle, Accessibility, TrendingUp, Users, Bell, X, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';

function loadAlertConfig(): AlertConfig {
  try {
    const stored = localStorage.getItem('sentinela_alert_config');
    return stored ? { ...DEFAULT_ALERT_CONFIG, ...JSON.parse(stored) } : DEFAULT_ALERT_CONFIG;
  } catch { return DEFAULT_ALERT_CONFIG; }
}
import { motion, AnimatePresence } from 'framer-motion';

interface Alert {
  id: string;
  type: 'pcd' | 'high_volume' | 'capacity' | 'idle' | 'milestone';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  timestamp: Date;
  dismissed?: boolean;
}

export default function AlertsPanel() {
  const { grupos, checkins, stats } = useData();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(true);
  const config = loadAlertConfig();

  const hoje = new Date().toLocaleDateString('pt-BR');

  const todayCheckins = useMemo(() =>
    checkins.filter(c => new Date(c.dataHora).toLocaleDateString('pt-BR') === hoje),
  [checkins, hoje]);

  const gruposHoje = useMemo(() =>
    grupos.filter(g => {
      if (g.dataAgendamento) return g.dataAgendamento === hoje;
      return new Date(g.criadoEm).toLocaleDateString('pt-BR') === hoje;
    }),
  [grupos, hoje]);

  const alerts = useMemo(() => {
    const list: Alert[] = [];

    // 1. PCD check-in alerts (last 5 minutes)
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    todayCheckins.forEach(c => {
      const grupo = grupos.find(g => g.id === c.grupoVisitaId);
      if (!grupo) return;
      const hasPCD = grupo.responsavel.criancas.some(cr => cr.pcd);
      if (hasPCD && new Date(c.dataHora).getTime() > fiveMinAgo) {
        const pcdKids = grupo.responsavel.criancas.filter(cr => cr.pcd);
        list.push({
          id: `pcd-${c.id}`,
          type: 'pcd',
          severity: 'warning',
          title: 'Visitante PCD no Check-in',
          message: `${grupo.responsavel.nome} — Guichê ${c.guiche}: ${pcdKids.map(k => `${k.nome} (${k.pcdDescricao || 'PCD'})`).join(', ')}`,
          timestamp: new Date(c.dataHora),
        });
      }
    });

    // 2. High volume booth alerts
    const guicheCounts: Record<number, number> = {};
    todayCheckins.forEach(c => {
      guicheCounts[c.guiche] = (guicheCounts[c.guiche] || 0) + 1;
    });
    const avgPerGuiche = todayCheckins.length / Math.max(Object.keys(guicheCounts).length, 1);
    Object.entries(guicheCounts).forEach(([g, count]) => {
      if (count > avgPerGuiche * 1.5 && count >= 5) {
        list.push({
          id: `highvol-${g}`,
          type: 'high_volume',
          severity: 'info',
          title: `Guichê ${g} com Alto Volume`,
          message: `${count} atendimentos (média: ${Math.round(avgPerGuiche)}). Considere redistribuir o fluxo.`,
          timestamp: new Date(),
        });
      }
    });

    // 3. Idle booth alerts
    const activeGuiches = new Set(Object.keys(guicheCounts).map(Number));
    for (let g = 1; g <= 6; g++) {
      if (!activeGuiches.has(g) && todayCheckins.length > 10) {
        list.push({
          id: `idle-${g}`,
          type: 'idle',
          severity: 'info',
          title: `Guichê ${g} Inativo`,
          message: `Nenhum atendimento registrado hoje. Verificar se está operacional.`,
          timestamp: new Date(),
        });
      }
    }

    // 4. Capacity alerts
    const totalAtendidos = stats.totalVisitantes;
    const maxCapacity = 500;
    const occupancy = (totalAtendidos / maxCapacity) * 100;
    if (occupancy > 90) {
      list.push({
        id: 'cap-critical',
        type: 'capacity',
        severity: 'critical',
        title: 'Capacidade Crítica',
        message: `${Math.round(occupancy)}% da capacidade (${totalAtendidos}/${maxCapacity}). Considere restringir entrada.`,
        timestamp: new Date(),
      });
    } else if (occupancy > 75) {
      list.push({
        id: 'cap-warning',
        type: 'capacity',
        severity: 'warning',
        title: 'Capacidade Alta',
        message: `${Math.round(occupancy)}% da capacidade (${totalAtendidos}/${maxCapacity}). Monitorar fluxo.`,
        timestamp: new Date(),
      });
    }

    // 5. Milestone alerts
    const milestones = [50, 100, 200, 300, 400, 500];
    milestones.forEach(m => {
      if (totalAtendidos >= m && totalAtendidos < m + 5) {
        list.push({
          id: `milestone-${m}`,
          type: 'milestone',
          severity: 'info',
          title: `Marco: ${m} Visitantes!`,
          message: `O parque atingiu ${m} visitantes atendidos hoje.`,
          timestamp: new Date(),
        });
      }
    });

    // 6. Pending visitors alert
    const pendentes = gruposHoje.filter(g => !g.checkinRealizado).length;
    const totalAgendados = gruposHoje.length;
    if (pendentes > 0 && todayCheckins.length > 0) {
      const pctPendente = (pendentes / totalAgendados) * 100;
      if (pctPendente > 50 && new Date().getHours() >= 14) {
        list.push({
          id: 'pending-high',
          type: 'high_volume',
          severity: 'warning',
          title: 'Muitos Pendentes',
          message: `${pendentes} de ${totalAgendados} agendados ainda não fizeram check-in (${Math.round(pctPendente)}%). Tarde avançada.`,
          timestamp: new Date(),
        });
      }
    }

    return list.sort((a, b) => {
      const sev = { critical: 0, warning: 1, info: 2 };
      return sev[a.severity] - sev[b.severity];
    });
  }, [todayCheckins, grupos, gruposHoje, stats]);

  const visibleAlerts = alerts.filter(a => !dismissedIds.has(a.id));
  const criticalCount = visibleAlerts.filter(a => a.severity === 'critical').length;
  const warningCount = visibleAlerts.filter(a => a.severity === 'warning').length;

  const dismiss = (id: string) => setDismissedIds(prev => new Set([...prev, id]));

  const severityStyles = {
    critical: 'bg-destructive/10 border-destructive/30 text-destructive',
    warning: 'bg-cordao-amarelo/10 border-cordao-amarelo/30',
    info: 'bg-primary/5 border-primary/20',
  };

  const severityIcon = {
    critical: <AlertTriangle className="h-4 w-4 text-destructive" />,
    warning: <AlertTriangle className="h-4 w-4 text-cordao-amarelo" />,
    info: <TrendingUp className="h-4 w-4 text-primary" />,
  };

  const typeIcon = {
    pcd: <Accessibility className="h-4 w-4" />,
    high_volume: <TrendingUp className="h-4 w-4" />,
    capacity: <Users className="h-4 w-4" />,
    idle: <AlertTriangle className="h-4 w-4" />,
    milestone: <Bell className="h-4 w-4" />,
  };

  if (visibleAlerts.length === 0) return null;

  return (
    <div className="bg-card rounded-xl shadow-card overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <Bell className="h-5 w-5 text-foreground" />
            {(criticalCount + warningCount) > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 bg-destructive text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                {criticalCount + warningCount}
              </span>
            )}
          </div>
          <h3 className="text-sm font-semibold text-foreground">
            Alertas Operacionais ({visibleAlerts.length})
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {criticalCount > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-destructive text-primary-foreground">
              {criticalCount} CRÍTICO
            </span>
          )}
          {warningCount > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cordao-amarelo text-foreground">
              {warningCount} ATENÇÃO
            </span>
          )}
        </div>
      </button>

      {/* Alerts List */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-2">
              {visibleAlerts.map(alert => (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-lg border transition-colors',
                    severityStyles[alert.severity]
                  )}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {typeIcon[alert.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{alert.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{alert.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {alert.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <button
                    onClick={() => dismiss(alert.id)}
                    className="flex-shrink-0 p-1 rounded hover:bg-secondary transition-colors"
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
