import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  executarEncerramento, getEncerramentoConfig, setEncerramentoConfig,
  listarHistoricoEncerramentos, getEncerramentoDoDia, EncerramentoResultado,
} from '@/lib/encerramento';
import { readCordoes, subscribeCordoesChange } from '@/types/cordoes';
import { Clock, DoorClosed, TrendingUp, Users, Timer, AlertTriangle, History as HistoryIcon } from 'lucide-react';

function fmtDur(seg?: number) {
  if (!seg && seg !== 0) return '—';
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

export default function AdminEncerramento() {
  const [cfg, setCfg] = useState(getEncerramentoConfig());
  const [now, setNow] = useState(new Date());
  const [bump, setBump] = useState(0);
  const [historico, setHistorico] = useState<EncerramentoResultado[]>(listarHistoricoEncerramentos());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    const unsub = subscribeCordoesChange(() => setBump(v => v + 1));
    return () => { window.clearInterval(id); unsub(); };
  }, []);

  const cordoes = useMemo(() => { void bump; return readCordoes(); }, [bump]);
  const ativos = cordoes.filter(c => c.status === 'entregue');
  const hoje = new Date().toLocaleDateString('pt-BR');
  const encerramentoHoje = getEncerramentoDoDia(hoje);

  // Métricas em tempo real (entradas de hoje, baseadas em vinculadoEm)
  const entradasHoje = cordoes.filter(c => c.vinculadoEm && new Date(c.vinculadoEm).toLocaleDateString('pt-BR') === hoje);
  const histoEntradas: Record<number, number> = {};
  entradasHoje.forEach(c => {
    if (!c.vinculadoEm) return;
    const h = new Date(c.vinculadoEm).getHours();
    histoEntradas[h] = (histoEntradas[h] || 0) + 1;
  });
  const maxHisto = Math.max(1, ...Object.values(histoEntradas));
  const horasUteis = Array.from({ length: cfg.horaFechamento - 7 + 1 }, (_, i) => 7 + i);
  const picoEntradaHora = Object.entries(histoEntradas).sort((a, b) => b[1] - a[1])[0]?.[0];

  const tempoMedioParcial = (() => {
    const finalizados = cordoes.filter(c => c.status === 'devolvido' && c.devolvidoEm && new Date(c.devolvidoEm).toLocaleDateString('pt-BR') === hoje);
    if (!finalizados.length) return 0;
    return Math.round(finalizados.reduce((a, c) => a + (c.duracaoTotalSeg || 0), 0) / finalizados.length);
  })();

  const minutosAteFechamento = (() => {
    const alvo = cfg.horaFechamento * 60 + cfg.minuto;
    const atual = now.getHours() * 60 + now.getMinutes();
    return alvo - atual;
  })();

  const salvarConfig = () => {
    setEncerramentoConfig(cfg);
    toast.success('Configuração salva');
  };

  const encerrarAgora = () => {
    if (!confirm(`Encerrar a operação AGORA?\n\nIsto devolverá ${ativos.length} cordão(ões) em uso e gerará as métricas finais do dia.`)) return;
    const r = executarEncerramento('manual');
    setHistorico(listarHistoricoEncerramentos());
    toast.success(`Operação encerrada · ${r.totalDevolvidos} cordões devolvidos · tempo médio ${fmtDur(r.tempoMedioSeg)}`);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <DoorClosed className="h-6 w-6 text-primary" /> Encerramento Operacional
        </h1>
        <p className="text-sm text-muted-foreground">
          Ao atingir o horário de fechamento, o sistema devolve automaticamente todos os cordões em uso,
          fecha as visitas em aberto e calcula o tempo individual de permanência de cada visitante.
        </p>
      </div>

      {/* Status do dia */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-[10px] uppercase tracking-wider"><Clock className="h-3 w-3" /> Agora</div>
          <p className="text-2xl font-bold font-mono-data mt-1">{now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
          <p className="text-[10px] text-muted-foreground">{hoje}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-[10px] uppercase tracking-wider"><Users className="h-3 w-3" /> Em uso</div>
          <p className="text-2xl font-bold font-mono-data text-primary mt-1">{ativos.length}</p>
          <p className="text-[10px] text-muted-foreground">cordões ativos</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-[10px] uppercase tracking-wider"><Timer className="h-3 w-3" /> Permanência média</div>
          <p className="text-2xl font-bold font-mono-data mt-1">{fmtDur(tempoMedioParcial)}</p>
          <p className="text-[10px] text-muted-foreground">já finalizados hoje</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-[10px] uppercase tracking-wider"><TrendingUp className="h-3 w-3" /> Pico de entrada</div>
          <p className="text-2xl font-bold font-mono-data mt-1">{picoEntradaHora ? `${picoEntradaHora}h` : '—'}</p>
          <p className="text-[10px] text-muted-foreground">hora com mais check-ins</p>
        </div>
      </div>

      {/* Configuração + Encerrar */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-card rounded-xl shadow-card p-6 space-y-4">
          <h3 className="font-semibold flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Configuração do fechamento</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Hora</Label>
              <Input type="number" min={0} max={23} value={cfg.horaFechamento}
                onChange={e => setCfg({ ...cfg, horaFechamento: Math.max(0, Math.min(23, parseInt(e.target.value || '18', 10))) })}
                className="font-mono-data" />
            </div>
            <div>
              <Label className="text-xs">Minuto</Label>
              <Input type="number" min={0} max={59} value={cfg.minuto}
                onChange={e => setCfg({ ...cfg, minuto: Math.max(0, Math.min(59, parseInt(e.target.value || '0', 10))) })}
                className="font-mono-data" />
            </div>
          </div>
          <div className="flex items-center justify-between bg-secondary/40 rounded-lg p-3">
            <div>
              <p className="text-sm font-medium">Encerrar automaticamente</p>
              <p className="text-[11px] text-muted-foreground">Ao atingir o horário, devolve todos os cordões em uso.</p>
            </div>
            <Switch checked={cfg.autoEncerrar} onCheckedChange={v => setCfg({ ...cfg, autoEncerrar: v })} />
          </div>
          <Button onClick={salvarConfig} className="w-full">Salvar configuração</Button>
          {cfg.autoEncerrar && !encerramentoHoje && (
            <p className="text-[11px] text-muted-foreground text-center">
              {minutosAteFechamento > 0
                ? `Faltam ${Math.floor(minutosAteFechamento / 60)}h ${minutosAteFechamento % 60}min para o encerramento automático.`
                : 'Horário atingido — encerramento será disparado nos próximos 60s.'}
            </p>
          )}
        </div>

        <div className="bg-card rounded-xl shadow-card p-6 space-y-4">
          <h3 className="font-semibold flex items-center gap-2"><DoorClosed className="h-4 w-4 text-primary" /> Encerramento manual</h3>
          {encerramentoHoje ? (
            <div className="bg-cordao-verde/10 border border-cordao-verde/40 rounded-lg p-4 text-xs space-y-1">
              <p className="font-bold text-cordao-verde uppercase tracking-wider">Encerrado hoje</p>
              <p>Executado às {new Date(encerramentoHoje.executadoEm).toLocaleTimeString('pt-BR')} ({encerramentoHoje.motivo})</p>
              <p>{encerramentoHoje.totalDevolvidos} cordões · tempo médio {fmtDur(encerramentoHoje.tempoMedioSeg)} · mediana {fmtDur(encerramentoHoje.tempoMedianoSeg)}</p>
              <p>Min {fmtDur(encerramentoHoje.tempoMinSeg)} · Max {fmtDur(encerramentoHoje.tempoMaxSeg)} · Pico de entrada {encerramentoHoje.picoEntradaHora ?? '—'}h</p>
            </div>
          ) : (
            <div className="bg-secondary/40 rounded-lg p-4 text-xs">
              <p className="text-muted-foreground">Nenhum encerramento registrado hoje.</p>
              <p className="text-muted-foreground mt-1">{ativos.length} cordão(ões) ainda em uso.</p>
            </div>
          )}
          <Button onClick={encerrarAgora} variant="destructive" className="w-full gap-2" disabled={ativos.length === 0 && !!encerramentoHoje}>
            <AlertTriangle className="h-4 w-4" /> Encerrar operação agora
          </Button>
          <p className="text-[10px] text-muted-foreground text-center">Use em caso de fechamento antecipado, evacuação ou fim de turno especial.</p>
        </div>
      </div>

      {/* Histograma de entradas */}
      <div className="bg-card rounded-xl shadow-card p-6">
        <h3 className="font-semibold flex items-center gap-2 mb-4"><TrendingUp className="h-4 w-4 text-primary" /> Horário de entrada — hoje</h3>
        {entradasHoje.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum check-in registrado hoje.</p>
        ) : (
          <div className="space-y-2">
            {horasUteis.map(h => {
              const qtd = histoEntradas[h] || 0;
              const pct = Math.round((qtd / maxHisto) * 100);
              return (
                <div key={h} className="flex items-center gap-3 text-xs">
                  <span className="w-10 font-mono-data text-muted-foreground">{String(h).padStart(2, '0')}h</span>
                  <div className="flex-1 bg-secondary/40 rounded-full h-6 relative overflow-hidden">
                    <div className="bg-primary/80 h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                    <span className="absolute inset-0 flex items-center px-2 font-mono-data text-[11px] text-foreground">{qtd > 0 ? qtd : ''}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Histórico */}
      <div className="bg-card rounded-xl shadow-card p-6">
        <h3 className="font-semibold flex items-center gap-2 mb-4"><HistoryIcon className="h-4 w-4 text-primary" /> Histórico de encerramentos</h3>
        {historico.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum encerramento registrado.</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground uppercase tracking-wider text-[10px] border-b border-border">
                  <th className="py-2">Data</th><th>Hora</th><th>Modo</th>
                  <th className="text-right">Devolvidos</th>
                  <th className="text-right">Tempo médio</th>
                  <th className="text-right">Mediana</th>
                  <th className="text-right">Pico</th>
                </tr>
              </thead>
              <tbody>
                {historico.slice().reverse().slice(0, 30).map(r => (
                  <tr key={r.data + r.executadoEm} className="border-b border-border/40">
                    <td className="py-2 font-mono-data">{r.data}</td>
                    <td className="font-mono-data">{new Date(r.executadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="capitalize">{r.motivo}</td>
                    <td className="text-right font-mono-data">{r.totalDevolvidos}</td>
                    <td className="text-right font-mono-data">{fmtDur(r.tempoMedioSeg)}</td>
                    <td className="text-right font-mono-data">{fmtDur(r.tempoMedianoSeg)}</td>
                    <td className="text-right font-mono-data">{r.picoEntradaHora != null ? `${r.picoEntradaHora}h` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
