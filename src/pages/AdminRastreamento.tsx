import { useEffect, useState } from 'react';
import { listarTokensAtivos, buildPublicUrl, limparExpirados, RastreioToken } from '@/lib/rastreamento';
import { readCordoes } from '@/types/cordoes';
import { QrCode, Eye, Clock, Copy, ExternalLink, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function AdminRastreamento() {
  const [tokens, setTokens] = useState<RastreioToken[]>([]);
  const [filtro, setFiltro] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    limparExpirados();
    const carregar = () => setTokens(listarTokensAtivos());
    carregar();
    const id = setInterval(() => { carregar(); setTick(t => t + 1); }, 5000);
    return () => clearInterval(id);
  }, []);
  void tick;

  const cordoes = readCordoes();
  const filtrados = tokens.filter(t =>
    !filtro.trim()
    || t.token.toLowerCase().includes(filtro.toLowerCase())
    || t.protocolo.toLowerCase().includes(filtro.toLowerCase())
    || t.responsavelNome.toLowerCase().includes(filtro.toLowerCase())
  );

  const ativosUltimaHora = tokens.filter(t => t.ultimaConsulta && (Date.now() - new Date(t.ultimaConsulta).getTime()) < 3600_000).length;
  const totalConsultas = tokens.reduce((a, t) => a + (t.consultas || 0), 0);

  const copiarUrl = (token: string) => {
    const url = buildPublicUrl(token);
    navigator.clipboard.writeText(url);
    toast.success('Link copiado');
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><QrCode className="h-6 w-6 text-primary" /> Acompanhamento Público — Tokens Ativos</h1>
        <p className="text-sm text-muted-foreground">Cada token corresponde a um QR Code entregue ao responsável no check-in. Eles expiram às 17h do dia operacional.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card label="Tokens ativos" value={tokens.length} />
        <Card label="Pais consultando (1h)" value={ativosUltimaHora} />
        <Card label="Consultas no dia" value={totalConsultas} />
      </div>

      <div className="bg-card rounded-xl shadow-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Input placeholder="Filtrar por token, protocolo ou nome do responsável..." value={filtro} onChange={e => setFiltro(e.target.value)} />
        </div>
        {filtrados.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum token ativo no momento.</p>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-auto">
            {filtrados.map(t => {
              const criancas = cordoes.filter(c => c.protocolo === t.protocolo && c.membroTipo === 'crianca');
              const ativasEspaco = criancas.filter(c => (c.visitas || []).some(v => !v.saida));
              return (
                <div key={t.token} className="rounded-lg border border-border bg-secondary/30 p-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="font-mono-data text-lg font-bold text-primary">{t.token}</p>
                      <p className="text-sm font-medium text-foreground truncate">{t.responsavelNome}</p>
                      <p className="text-[11px] text-muted-foreground">protocolo {t.protocolo} · expira {new Date(t.expiraEm).toLocaleTimeString('pt-BR')}</p>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {criancas.length} criança(s)</span>
                      <span className="inline-flex items-center gap-1 text-cordao-verde font-semibold"><Eye className="h-3 w-3" /> {t.consultas || 0} consulta(s)</span>
                      <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {t.ultimaConsulta ? new Date(t.ultimaConsulta).toLocaleTimeString('pt-BR') : '—'}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => copiarUrl(t.token)} className="gap-1"><Copy className="h-3 w-3" /> Link</Button>
                      <Button size="sm" variant="outline" onClick={() => window.open(buildPublicUrl(t.token), '_blank')} className="gap-1"><ExternalLink className="h-3 w-3" /> Abrir</Button>
                    </div>
                  </div>
                  {ativasEspaco.length > 0 && (
                    <p className="text-[11px] text-muted-foreground mt-2">
                      <strong className="text-cordao-verde">●</strong> {ativasEspaco.length} criança(s) em espaço agora
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground mb-1">Como o responsável usa</p>
        <ol className="list-decimal ml-4 space-y-0.5">
          <li>No guichê, ao confirmar a entrega dos cordões, um cartão é impresso com QR Code.</li>
          <li>O responsável escaneia com a câmera do celular — abre a página pública sem login.</li>
          <li>Digita o primeiro nome de uma das crianças (validação) → vê onde cada uma está e há quanto tempo.</li>
          <li>A página atualiza sozinha a cada 15s; o token expira automaticamente às 17h.</li>
        </ol>
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 text-center">
      <p className="text-3xl font-bold text-primary font-mono-data">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
