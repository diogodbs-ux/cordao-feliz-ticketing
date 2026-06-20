// Página PÚBLICA — sem login.
// O responsável escaneia o QR impresso na etiqueta, digita o nome da criança
// e acompanha a localização ao vivo dentro do parque.
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MapPin, Clock, ShieldCheck, ShieldAlert, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { buscarToken, consultarLocalizacao } from '@/lib/rastreamento';
import { ativarPush, desativarPush, estaAtivo, iniciarPolling, isPushSupported } from '@/lib/pushNotif';
import { Bell, BellOff } from 'lucide-react';
import { CordaoColor, getCordaoLabel } from '@/types';
import { cn } from '@/lib/utils';

const CORD_BG: Record<string, string> = {
  azul: 'bg-blue-500', verde: 'bg-green-500', amarelo: 'bg-yellow-400',
  vermelho: 'bg-red-500', rosa: 'bg-pink-500', cinza: 'bg-gray-500', preto: 'bg-gray-900',
};
const CORD_TX: Record<string, string> = { amarelo: 'text-gray-900' };

function fmtHora(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function fmtDuracao(desdeIso: string, ate: Date = new Date()) {
  const ms = ate.getTime() - new Date(desdeIso).getTime();
  if (ms < 0) return '0 min';
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60); const m = min % 60;
  return `${h}h ${m}min`;
}

export default function AcompanharPublico() {
  const { token = '' } = useParams();
  const tokenInfo = useMemo(() => buscarToken(token), [token]);

  const [nome, setNome] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ReturnType<typeof consultarLocalizacao> | null>(null);
  const [tick, setTick] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Auto-refresh a cada 15s quando consulta autorizada
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => setTick(t => t + 1), 15000);
    return () => clearInterval(id);
  }, [autoRefresh]);

  useEffect(() => {
    if (!autoRefresh || !resultado || resultado.ok === false) return;
    const r = consultarLocalizacao(token, nome);
    setResultado(r);
  }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConsultar = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    setTimeout(() => {
      const r = consultarLocalizacao(token, nome);
      if (r.ok === false) { setErro(r.erro); setResultado(null); setAutoRefresh(false); }
      else { setResultado(r); setAutoRefresh(true); }
      setLoading(false);
    }, 300);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <header className="border-b border-slate-200 bg-white/70 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-foreground leading-tight">Acompanhamento ao Vivo</h1>
            <p className="text-xs text-muted-foreground">Cidade Mais Infância · Sentinela</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {!tokenInfo ? (
          <Card className="p-8 text-center space-y-3 border-red-200 bg-red-50/40">
            <ShieldAlert className="h-10 w-10 text-red-500 mx-auto" />
            <h2 className="text-lg font-bold text-foreground">Link inválido ou expirado</h2>
            <p className="text-sm text-muted-foreground">
              Este QR Code não está mais ativo. Procure o guichê para gerar um novo acompanhamento.
            </p>
          </Card>
        ) : !resultado || resultado.ok === false ? (
          <Card className="p-6 space-y-5">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-emerald-600 text-xs font-semibold uppercase tracking-wider">
                <ShieldCheck className="h-4 w-4" />
                Acesso seguro
              </div>
              <h2 className="text-xl font-bold text-foreground">Olá, responsável por <span className="text-primary">{tokenInfo.responsavelNome}</span></h2>
              <p className="text-sm text-muted-foreground">
                Para sua proteção, informe o <b>primeiro nome da sua criança</b> para confirmar que é você.
              </p>
            </div>

            <form onSubmit={handleConsultar} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nome da criança</label>
                <Input
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder="Ex: Maria"
                  autoFocus
                  className="h-12 text-base mt-1"
                />
              </div>
              {erro && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5">
                  {erro}
                </p>
              )}
              <Button type="submit" className="w-full h-12 text-base" disabled={loading || nome.trim().length < 2}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ver localização'}
              </Button>
            </form>

            <p className="text-[11px] text-muted-foreground text-center">
              Protocolo {tokenInfo.protocolo} · Link válido até as 17h00
            </p>
          </Card>
        ) : (
          <ResultadoView
            data={resultado}
            onAtualizar={() => setTick(t => t + 1)}
            autoRefresh={autoRefresh}
            onToggleAuto={() => setAutoRefresh(v => !v)}
          />
        )}

        <p className="text-center text-[11px] text-muted-foreground pt-4">
          ⓘ Esta tela atualiza automaticamente conforme as crianças entram e saem dos espaços lúdicos.
        </p>
      </main>
    </div>
  );
}

function ResultadoView({
  data, onAtualizar, autoRefresh, onToggleAuto,
}: {
  data: Extract<ReturnType<typeof consultarLocalizacao>, { ok: true }>;
  onAtualizar: () => void;
  autoRefresh: boolean;
  onToggleAuto: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="text-xs text-muted-foreground">Protocolo {data.protocolo}</p>
          <h2 className="text-lg font-bold">{data.responsavelNome}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onAtualizar} className="gap-1.5 h-9">
            <RefreshCw className="h-3.5 w-3.5" />
            Atualizar
          </Button>
          <Button size="sm" variant={autoRefresh ? 'default' : 'outline'} onClick={onToggleAuto} className="h-9">
            Auto {autoRefresh ? 'ON' : 'OFF'}
          </Button>
        </div>
      </div>

      <div className="grid gap-3">
        {data.criancas.map(c => {
          const cor = c.cor as CordaoColor;
          const bg = CORD_BG[cor] || 'bg-gray-300';
          const tx = CORD_TX[cor] || 'text-white';
          return (
            <Card key={c.codigoCordao} className="overflow-hidden">
              <div className={cn('px-4 py-2 flex items-center justify-between', bg, tx)}>
                <div className="flex items-center gap-2">
                  <span className="font-bold tracking-wider uppercase text-sm">{cor}</span>
                  <span className="opacity-75 text-xs">· {getCordaoLabel(cor)}</span>
                </div>
                <span className="font-mono text-xs opacity-90">{c.codigoCordao}</span>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <p className="text-lg font-bold leading-tight">{c.nome}</p>
                  {c.idade != null && <p className="text-xs text-muted-foreground">{c.idade} anos</p>}
                </div>

                {c.espacoAtual ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] uppercase tracking-wider text-emerald-700 font-semibold">Agora está em</p>
                      <p className="font-bold text-emerald-900">{c.espacoAtual.espacoNome}</p>
                      <p className="text-xs text-emerald-700 flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3" />
                        há {fmtDuracao(c.espacoAtual.entrada)} (entrou {fmtHora(c.espacoAtual.entrada)})
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-muted-foreground">
                    {c.totalEspacosVisitados > 0
                      ? 'Saiu do último espaço. Em circulação no parque.'
                      : 'Ainda não entrou em nenhum espaço lúdico.'}
                  </div>
                )}

                {c.visitas.length > 0 && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground select-none">
                      Histórico do dia ({c.visitas.length} espaço(s))
                    </summary>
                    <ul className="mt-2 space-y-1.5 pl-1">
                      {c.visitas.slice().reverse().map((v, i) => (
                        <li key={i} className="text-xs flex items-center gap-2 border-l-2 border-slate-200 pl-3 py-1">
                          <span className="font-semibold">{v.espacoNome}</span>
                          <span className="text-muted-foreground">{fmtHora(v.entrada)}{v.saida ? ` → ${fmtHora(v.saida)}` : ' · em curso'}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
