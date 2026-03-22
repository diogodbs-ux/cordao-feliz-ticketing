import { useState, useEffect } from 'react';
import { AlertConfig, DEFAULT_ALERT_CONFIG } from '@/types/listas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Settings, Bell, Shield, Save } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { UserRole } from '@/types';

const STORAGE_KEY = 'sentinela_alert_config';

function loadConfig(): AlertConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? { ...DEFAULT_ALERT_CONFIG, ...JSON.parse(stored) } : DEFAULT_ALERT_CONFIG;
  } catch { return DEFAULT_ALERT_CONFIG; }
}

export default function AdminConfiguracoes() {
  const [config, setConfig] = useState<AlertConfig>(loadConfig);
  const [milestonesStr, setMilestonesStr] = useState(config.milestones.join(', '));

  const saveConfig = () => {
    const milestones = milestonesStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n > 0);
    const toSave = { ...config, milestones };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    setConfig(toSave);
    toast.success('Configurações salvas com sucesso!');
  };

  const roleDescriptions: Record<UserRole, { label: string; desc: string; color: string }> = {
    admin: { label: 'Administrador', desc: 'Acesso total: dashboard, importação, usuários, relatórios, configurações, listas especiais e gráficos históricos.', color: 'bg-cordao-preto' },
    coordenador: { label: 'Coordenador', desc: 'Painel em tempo real, alertas operacionais, visão de todos os guichês e métricas de performance.', color: 'bg-primary' },
    recreador: { label: 'Recreador', desc: 'Check-in de visitantes no guichê designado, cadastro manual, visualização de cordões e detalhes do visitante.', color: 'bg-cordao-verde' },
    observador: { label: 'Observador (Teste)', desc: 'Acesso de visualização como recreador sem ocupar guichê. Check-ins são marcados como teste e não contam no relatório oficial.', color: 'bg-cordao-cinza' },
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground">Ajustes de alertas e definição de perfis do sistema</p>
      </div>

      {/* Alert Configuration */}
      <div className="bg-card rounded-xl shadow-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" />
          Configuração de Alertas
        </h3>

        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Capacidade Máxima Diária</Label>
              <Input
                type="number"
                value={config.capacidadeMaxima}
                onChange={e => setConfig(c => ({ ...c, capacidadeMaxima: parseInt(e.target.value) || 500 }))}
              />
              <p className="text-[10px] text-muted-foreground">Número máximo de visitantes por dia</p>
            </div>
            <div className="space-y-2">
              <Label>Limiar Alto Volume (multiplicador)</Label>
              <Input
                type="number"
                step="0.1"
                min="1"
                value={config.limiarAltoVolume}
                onChange={e => setConfig(c => ({ ...c, limiarAltoVolume: parseFloat(e.target.value) || 1.5 }))}
              />
              <p className="text-[10px] text-muted-foreground">Ex: 1.5 = alerta quando guichê atender 50% acima da média</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Marcos de Atendimento (milestones)</Label>
            <Input
              value={milestonesStr}
              onChange={e => setMilestonesStr(e.target.value)}
              placeholder="50, 100, 200, 300, 400, 500"
            />
            <p className="text-[10px] text-muted-foreground">Separados por vírgula. Alertas são gerados ao atingir cada marco.</p>
          </div>

          <div className="border-t border-border pt-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tipos de Alerta</p>
            {[
              { key: 'alertaPCD' as const, label: 'Visitante PCD', desc: 'Notificar quando visitante PCD fizer check-in' },
              { key: 'alertaCapacidade75' as const, label: 'Capacidade 75%', desc: 'Alerta de atenção ao atingir 75% da lotação' },
              { key: 'alertaCapacidade90' as const, label: 'Capacidade 90%', desc: 'Alerta crítico ao atingir 90% da lotação' },
              { key: 'alertaAltoVolume' as const, label: 'Alto Volume Guichê', desc: 'Guichê com atendimentos acima do limiar' },
              { key: 'alertaGuicheInativo' as const, label: 'Guichê Inativo', desc: 'Guichê sem atendimento registrado no dia' },
              { key: 'alertaMilestones' as const, label: 'Marcos de Atendimento', desc: 'Celebrar ao atingir marcos definidos acima' },
              { key: 'alertaPendentes' as const, label: 'Pendentes na Tarde', desc: 'Muitos visitantes sem check-in após 14h' },
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <Switch
                  checked={config[item.key]}
                  onCheckedChange={v => setConfig(c => ({ ...c, [item.key]: v }))}
                />
              </div>
            ))}
          </div>

          <Button onClick={saveConfig} className="gap-2">
            <Save className="h-4 w-4" />
            Salvar Configurações
          </Button>
        </div>
      </div>

      {/* Profile Definitions */}
      <div className="bg-card rounded-xl shadow-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          Definição de Perfis
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(Object.entries(roleDescriptions) as [UserRole, typeof roleDescriptions.admin][]).map(([role, info]) => (
            <div key={role} className="bg-secondary/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={cn('h-3 w-3 rounded-full', info.color)} />
                <p className="text-sm font-bold text-foreground">{info.label}</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{info.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
