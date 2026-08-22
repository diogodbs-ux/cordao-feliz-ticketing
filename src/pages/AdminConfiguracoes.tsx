import { useState, useEffect, useMemo } from 'react';
import { AlertConfig, DEFAULT_ALERT_CONFIG } from '@/types/listas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Settings, Bell, Shield, Save, Target, Image as ImageIcon, Upload, Trash2, RotateCcw, EyeOff, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { UserRole } from '@/types';
import { MetaAnual, getMetaDoAno, upsertMeta } from '@/types/metas';
import { ModulosConfig, readModulos, writeModulos } from '@/lib/modulos';
import { ALL_MENU_ITEMS } from '@/lib/permissoes';
import { Branding, getBranding, saveBranding, resetBranding, fileToLogoDataUrl, getLogoSrc, subscribeBranding } from '@/lib/branding';

const STORAGE_KEY = 'sentinela_alert_config';

function loadConfig(): AlertConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? { ...DEFAULT_ALERT_CONFIG, ...JSON.parse(stored) } : DEFAULT_ALERT_CONFIG;
  } catch { return DEFAULT_ALERT_CONFIG; }
}

const MESES_LBL = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

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

  // ---- Módulos / telas visíveis ----
  const [modulos, setModulos] = useState<ModulosConfig>(() => readModulos());
  const salvarModulos = (next: ModulosConfig) => {
    setModulos(next);
    writeModulos(next);
    toast.success('Módulos atualizados');
  };
  const toggleTela = (path: string, visivel: boolean) => {
    const ocultas = new Set(modulos.telasOcultas);
    if (visivel) ocultas.delete(path); else ocultas.add(path);
    salvarModulos({ ...modulos, telasOcultas: Array.from(ocultas) });
  };

  // ---- Metas ----
  const anoCorrente = new Date().getFullYear();
  const [anoMeta, setAnoMeta] = useState<number>(anoCorrente);
  const metaExistente = useMemo(() => getMetaDoAno(anoMeta), [anoMeta]);
  const [metaTotal, setMetaTotal] = useState<string>(metaExistente?.metaTotal?.toString() || '');
  const [metaMensal, setMetaMensal] = useState<Record<number, string>>(
    () => Object.fromEntries(MESES_LBL.map((_, i) => [i + 1, metaExistente?.metaMensal?.[i + 1]?.toString() || '']))
  );

  useEffect(() => {
    const m = getMetaDoAno(anoMeta);
    setMetaTotal(m?.metaTotal?.toString() || '');
    setMetaMensal(Object.fromEntries(MESES_LBL.map((_, i) => [i + 1, m?.metaMensal?.[i + 1]?.toString() || ''])));
  }, [anoMeta]);

  const salvarMeta = () => {
    const total = parseInt(metaTotal) || 0;
    if (total <= 0) { toast.error('Informe a meta anual total (> 0)'); return; }
    const mensal: Partial<Record<number, number>> = {};
    Object.entries(metaMensal).forEach(([k, v]) => {
      const n = parseInt(v);
      if (!isNaN(n) && n > 0) mensal[parseInt(k)] = n;
    });
    const meta: MetaAnual = {
      ano: anoMeta, metaTotal: total,
      metaMensal: Object.keys(mensal).length ? mensal : undefined,
      atualizadoEm: new Date().toISOString(),
    };
    upsertMeta(meta);
    toast.success(`Meta de ${anoMeta} salva!`);
  };

  // ---- Branding (logo customizável — período eleitoral) ----
  const [branding, setBranding] = useState<Branding>(getBranding());
  const [logoPreview, setLogoPreview] = useState<string>(getLogoSrc());
  useEffect(() => subscribeBranding(() => {
    setBranding(getBranding());
    setLogoPreview(getLogoSrc());
  }), []);

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>, campo: 'logoDataUrl' | 'logoSecundariaDataUrl') => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Selecione um arquivo de imagem (PNG, JPG, SVG).'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Imagem muito grande. Limite: 5 MB.'); return; }
    try {
      const dataUrl = await fileToLogoDataUrl(file, 512);
      saveBranding({ [campo]: dataUrl });
      toast.success('Logo atualizada!');
    } catch { toast.error('Não foi possível processar a imagem.'); }
  };

  const salvarTextos = () => {
    saveBranding({ orgName: branding.orgName, orgFooter: branding.orgFooter, ocultarLogoPadrao: branding.ocultarLogoPadrao });
    toast.success('Identidade salva!');
  };



  const roleDescriptions: Record<UserRole, { label: string; desc: string; color: string }> = {
    admin: { label: 'Administrador', desc: 'Acesso total: dashboard, importação, usuários, relatórios, configurações, listas especiais e gráficos históricos.', color: 'bg-cordao-preto' },
    coordenador: { label: 'Coordenador', desc: 'Painel em tempo real, alertas operacionais, visão de todos os guichês e métricas de performance.', color: 'bg-primary' },
    supervisor: { label: 'Supervisor', desc: 'Acesso ao Fechamento Operacional 17h, geração de relatórios consolidados (texto/PDF/imagem) para divulgação e visão de coordenação.', color: 'bg-cordao-amarelo' },
    recreador: { label: 'Recreador (Guichê)', desc: 'Check-in de visitantes no guichê designado, cadastro manual, visualização de cordões e detalhes do visitante.', color: 'bg-cordao-verde' },
    recreador_espaco: { label: 'Recreador de Espaço', desc: 'Operação dentro do parque: registra ciclos de entrada nos espaços lúdicos (piscina, escola, ceart etc.) com contagem rápida por cor de cordão.', color: 'bg-cordao-azul' },
    observador: { label: 'Observador (Teste)', desc: 'Acesso de visualização como recreador sem ocupar guichê. Check-ins são marcados como teste e não contam no relatório oficial.', color: 'bg-cordao-cinza' },
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground">Ajustes de alertas e definição de perfis do sistema</p>
      </div>

      {/* Identidade Visual / Branding */}
      <div className="bg-card rounded-xl shadow-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-primary" />
          Identidade Visual (Logos e Nome)
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Personalize a logo e o nome exibido em telas, crachás, etiquetas e relatórios.
          Útil em <b>períodos eleitorais</b>: substitua a logo institucional pela logo neutra
          (ex.: Governo do Estado) e reverta depois com um clique.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Logo principal */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider">Logo principal</Label>
            <div className="border-2 border-dashed border-border rounded-lg p-4 flex flex-col items-center gap-3 bg-secondary/20 min-h-[160px] justify-center">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo atual" className="max-h-24 max-w-full object-contain" />
              ) : (
                <div className="text-xs text-muted-foreground text-center px-4">
                  Nenhuma logo ativa.<br />O sistema exibirá apenas o nome.
                </div>
              )}
              <div className="flex gap-2 flex-wrap justify-center">
                <label className="cursor-pointer">
                  <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" onChange={e => handleUploadLogo(e, 'logoDataUrl')} />
                  <span className="inline-flex items-center gap-1.5 text-xs bg-primary text-primary-foreground rounded-md px-3 py-1.5 hover:bg-primary/90">
                    <Upload className="h-3.5 w-3.5" /> Enviar nova
                  </span>
                </label>
                {branding.logoDataUrl && (
                  <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => { saveBranding({ logoDataUrl: '' }); toast.success('Logo customizada removida.'); }}>
                    <Trash2 className="h-3.5 w-3.5" /> Remover custom
                  </Button>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground text-center">PNG/JPG/SVG · até 5 MB · redimensionado para 512px</p>
            </div>
            <div className="flex items-center justify-between gap-2 pt-1">
              <div>
                <p className="text-xs font-medium">Ocultar logo padrão</p>
                <p className="text-[10px] text-muted-foreground">Ative durante período eleitoral para não exibir a logo institucional se não houver customização.</p>
              </div>
              <Switch
                checked={branding.ocultarLogoPadrao}
                onCheckedChange={v => setBranding(b => ({ ...b, ocultarLogoPadrao: v }))}
              />
            </div>
          </div>

          {/* Logo secundária */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider">Logo secundária (opcional)</Label>
            <div className="border-2 border-dashed border-border rounded-lg p-4 flex flex-col items-center gap-3 bg-secondary/20 min-h-[160px] justify-center">
              {branding.logoSecundariaDataUrl ? (
                <img src={branding.logoSecundariaDataUrl} alt="Logo secundária" className="max-h-24 max-w-full object-contain" />
              ) : (
                <div className="text-xs text-muted-foreground text-center px-4">
                  Nenhuma logo secundária.<br />Ex.: Governo do Estado, patrocinador.
                </div>
              )}
              <div className="flex gap-2 flex-wrap justify-center">
                <label className="cursor-pointer">
                  <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" onChange={e => handleUploadLogo(e, 'logoSecundariaDataUrl')} />
                  <span className="inline-flex items-center gap-1.5 text-xs bg-primary text-primary-foreground rounded-md px-3 py-1.5 hover:bg-primary/90">
                    <Upload className="h-3.5 w-3.5" /> Enviar
                  </span>
                </label>
                {branding.logoSecundariaDataUrl && (
                  <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => { saveBranding({ logoSecundariaDataUrl: '' }); toast.success('Logo secundária removida.'); }}>
                    <Trash2 className="h-3.5 w-3.5" /> Remover
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <div className="space-y-2">
            <Label>Nome da organização (exibido em telas e relatórios)</Label>
            <Input value={branding.orgName} onChange={e => setBranding(b => ({ ...b, orgName: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Rodapé / crédito institucional</Label>
            <Input value={branding.orgFooter} onChange={e => setBranding(b => ({ ...b, orgFooter: e.target.value }))} />
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Button onClick={salvarTextos} className="gap-2">
            <Save className="h-4 w-4" /> Salvar identidade
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => { resetBranding(); toast.success('Identidade restaurada para o padrão.'); }}>
            <RotateCcw className="h-4 w-4" /> Restaurar padrão
          </Button>
        </div>

        {branding.atualizadoEm && (
          <p className="text-[10px] text-muted-foreground mt-3">
            Última alteração: {new Date(branding.atualizadoEm).toLocaleString('pt-BR')}
          </p>
        )}
      </div>


      {/* Metas Anuais */}
      <div className="bg-card rounded-xl shadow-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Metas Anuais (aparecem no Dashboard e no Consolidado)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="space-y-2">
            <Label>Ano</Label>
            <Input type="number" value={anoMeta} onChange={e => setAnoMeta(parseInt(e.target.value) || anoCorrente)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Meta Anual Total (visitantes)</Label>
            <Input
              type="number"
              placeholder="Ex: 100000"
              value={metaTotal}
              onChange={e => setMetaTotal(e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground">Total de visitantes (crianças + adultos) esperados no ano.</p>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Metas Mensais (opcional)</p>
          <p className="text-[10px] text-muted-foreground mb-3">Se em branco, o sistema distribui a meta anual igualmente nos 12 meses.</p>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {MESES_LBL.map((lbl, i) => (
              <div key={lbl} className="space-y-1">
                <Label className="text-[10px]">{lbl}</Label>
                <Input
                  type="number"
                  placeholder="—"
                  value={metaMensal[i + 1] || ''}
                  onChange={e => setMetaMensal(s => ({ ...s, [i + 1]: e.target.value }))}
                  className="text-sm"
                />
              </div>
            ))}
          </div>
        </div>

        <Button onClick={salvarMeta} className="gap-2 mt-4">
          <Save className="h-4 w-4" /> Salvar Meta de {anoMeta}
        </Button>
      </div>

      {/* Alert Configuration */}
      <div className="bg-card rounded-xl shadow-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" />
          Configuração de Alertas
        </h3>

        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <Label>Guichês Ativos</Label>
              <Input
                type="number"
                min="1"
                max="20"
                value={config.guichesAtivos}
                onChange={e => setConfig(c => ({ ...c, guichesAtivos: parseInt(e.target.value) || 5 }))}
              />
              <p className="text-[10px] text-muted-foreground">Quantidade de guichês em operação. Alertas de inatividade só consideram guichês ativos.</p>
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

      {/* Módulos & travas operacionais */}
      <div className="bg-card rounded-xl shadow-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
          <EyeOff className="h-4 w-4 text-muted-foreground" />
          Módulos & Telas Visíveis
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Desative telas que não fazem parte da operação atual — elas desaparecem do menu de todos os perfis (inclusive admin) e a rota fica bloqueada.
          Ex.: se os cordões forem descartáveis, desative <strong>Portaria — Devolução</strong>.
        </p>

        <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-secondary/30 p-4 mb-4">
          <div>
            <p className="text-sm font-medium text-foreground flex items-center gap-2"><Lock className="h-3.5 w-3.5" /> Travar navegação durante ciclo ativo</p>
            <p className="text-xs text-muted-foreground">O recreador fica preso na tela <strong>Meu Espaço</strong> até finalizar (ou descartar) o ciclo aberto.</p>
          </div>
          <Switch
            checked={modulos.travarNavegacaoCicloAtivo}
            onCheckedChange={v => salvarModulos({ ...modulos, travarNavegacaoCicloAtivo: v })}
          />
        </div>

        <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-secondary/30 p-4 mb-4">
          <div>
            <p className="text-sm font-medium text-foreground">Contabilizar ciclos do recreador como presença</p>
            <p className="text-xs text-muted-foreground">
              Soma aos painéis gerenciais (Dashboard, Coordenação, Relatório Final) a presença estimada dos ciclos de espaço
              de protocolos que <strong>não passaram pelo guichê</strong>. A contagem é deduplicada por protocolo e marcada como <em>estimada</em>.
            </p>
          </div>
          <Switch
            checked={modulos.contabilizarCiclosComoPresenca}
            onCheckedChange={v => salvarModulos({ ...modulos, contabilizarCiclosComoPresenca: v })}
          />
        </div>


        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
          {ALL_MENU_ITEMS.map(item => {
            const visivel = !modulos.telasOcultas.includes(item.path);
            return (
              <div key={item.path} className="flex items-center justify-between gap-3 py-2 border-b border-border/60">
                <div className="min-w-0">
                  <p className={cn('text-sm truncate', visivel ? 'text-foreground' : 'text-muted-foreground line-through')}>{item.label}</p>
                  <p className="text-[10px] text-muted-foreground font-mono-data truncate">{item.path}</p>
                </div>
                <Switch checked={visivel} onCheckedChange={v => toggleTela(item.path, v)} />
              </div>
            );
          })}
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
