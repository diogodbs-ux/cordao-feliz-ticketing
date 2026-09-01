import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Avaliacao, AvaliacaoConfig, aprovadas, emojiDaNota, exportarAvaliacoesCSV, historicoRecreador,
  moderarAvaliacao, pendentes, rankingEspacos, rankingRecreadores, readAvaliacaoConfig,
  readAvaliacoes, recreadoresAvaliaveis, subscribeAvaliacoes, writeAvaliacaoConfig,
} from '@/lib/avaliacoes';
import { Check, Clock, Download, Link2, Star, ThumbsDown, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

function MediaBadge({ media, total }: { media: number; total: number }) {
  return (
    <div className="text-right">
      <p className="text-lg font-bold text-foreground leading-none">{media.toFixed(2)} <span className="text-base">{emojiDaNota(media)}</span></p>
      <p className="text-[10px] text-muted-foreground">{total} avaliação(ões)</p>
    </div>
  );
}

export default function AdminAvaliacoes() {
  const { user } = useAuth();
  const [version, setVersion] = useState(0);
  const [cfg, setCfg] = useState<AvaliacaoConfig>(() => readAvaliacaoConfig());
  const [motivos, setMotivos] = useState<Record<string, string>>({});
  const [recSelecionado, setRecSelecionado] = useState<string>('');

  useEffect(() => subscribeAvaliacoes(() => setVersion(v => v + 1)), []);

  const todas = useMemo(() => readAvaliacoes(), [version]);
  const fila = useMemo(() => pendentes(todas), [todas]);
  const validas = useMemo(() => aprovadas(todas), [todas]);
  const rankEspacos = useMemo(() => rankingEspacos(validas), [validas]);
  const rankRecreadores = useMemo(() => rankingRecreadores(validas), [validas]);
  const recreadores = useMemo(() => recreadoresAvaliaveis(), [version]);
  const historico = useMemo(() => recSelecionado ? historicoRecreador(recSelecionado, validas) : null, [recSelecionado, validas]);

  const salvarCfg = (patch: Partial<AvaliacaoConfig>) => {
    const next = { ...cfg, ...patch };
    setCfg(next);
    writeAvaliacaoConfig(next);
  };

  const moderar = (a: Avaliacao, status: 'aprovada' | 'rejeitada') => {
    moderarAvaliacao(a.id, status, user?.nome || 'Supervisor', status === 'rejeitada' ? motivos[a.id] : undefined);
    setVersion(v => v + 1);
    toast.success(status === 'aprovada' ? 'Avaliação liberada.' : 'Avaliação rejeitada.');
  };

  const baixarCSV = () => {
    const blob = new Blob([exportarAvaliacoesCSV(todas)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `avaliacoes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const linkPublico = `${window.location.origin}/avaliar`;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Avaliação de Espaços & Recreadores</h1>
          <p className="text-sm text-muted-foreground">Moderação, ranking e histórico de desempenho por espaço</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => { navigator.clipboard.writeText(linkPublico); toast.success('Link público copiado.'); }}>
            <Link2 className="h-4 w-4" /> Link público
          </Button>
          <Button variant="outline" className="gap-2" onClick={baixarCSV}><Download className="h-4 w-4" /> CSV</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Pendentes', value: fila.length, icon: Clock },
          { label: 'Aprovadas', value: validas.length, icon: Check },
          { label: 'Espaços avaliados', value: rankEspacos.length, icon: Star },
          { label: 'Recreadores avaliados', value: rankRecreadores.length, icon: Users },
        ].map(k => (
          <div key={k.label} className="rounded-xl bg-card shadow-card p-4">
            <k.icon className="h-4 w-4 text-primary" />
            <p className="text-2xl font-bold text-foreground mt-2">{k.value}</p>
            <p className="text-xs text-muted-foreground">{k.label}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="moderacao">
        <TabsList>
          <TabsTrigger value="moderacao">Moderação ({fila.length})</TabsTrigger>
          <TabsTrigger value="ranking">Rankings</TabsTrigger>
          <TabsTrigger value="recreador">Histórico por recreador</TabsTrigger>
          <TabsTrigger value="config">Configuração</TabsTrigger>
        </TabsList>

        <TabsContent value="moderacao" className="space-y-3 pt-4">
          {fila.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma avaliação aguardando liberação.</p>}
          {fila.map(a => (
            <div key={a.id} className="rounded-xl bg-card shadow-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {a.tipo === 'espaco' ? `Espaço · ${a.espacoNome}` : `Recreador · ${a.recreadorNome}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {a.tipo === 'recreador' && `em ${a.espacoNome} · `}
                    {new Date(a.criadoEm).toLocaleString('pt-BR')} · protocolo {a.protocolo} · tel ****{a.telefoneUltimos4}
                  </p>
                  {a.comentario && <p className="text-sm text-foreground mt-2 rounded-lg bg-secondary/50 p-2">“{a.comentario}”</p>}
                </div>
                <span className="text-2xl">{emojiDaNota(a.nota)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  className="max-w-xs"
                  placeholder="Motivo da rejeição (opcional)"
                  value={motivos[a.id] || ''}
                  onChange={e => setMotivos(m => ({ ...m, [a.id]: e.target.value }))}
                />
                <Button size="sm" className="gap-1" onClick={() => moderar(a, 'aprovada')}><Check className="h-3.5 w-3.5" /> Liberar</Button>
                <Button size="sm" variant="outline" className="gap-1 text-destructive" onClick={() => moderar(a, 'rejeitada')}><ThumbsDown className="h-3.5 w-3.5" /> Rejeitar</Button>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="ranking" className="grid gap-4 md:grid-cols-2 pt-4">
          {[{ titulo: 'Ranking de espaços', dados: rankEspacos }, { titulo: 'Ranking de recreadores', dados: rankRecreadores }].map(bloco => (
            <div key={bloco.titulo} className="rounded-xl bg-card shadow-card p-4 space-y-3">
              <h2 className="text-sm font-bold text-foreground">{bloco.titulo}</h2>
              {bloco.dados.length === 0 && <p className="text-xs text-muted-foreground">Sem avaliações aprovadas ainda.</p>}
              {bloco.dados.map((item, i) => (
                <div key={item.id} className="flex items-center justify-between gap-3 border-b border-border last:border-0 pb-2 last:pb-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn('h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold',
                      i === 0 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground')}>{i + 1}</span>
                    <span className="text-sm text-foreground truncate">{item.nome}</span>
                  </div>
                  <MediaBadge media={item.media} total={item.total} />
                </div>
              ))}
            </div>
          ))}
        </TabsContent>

        <TabsContent value="recreador" className="space-y-4 pt-4">
          <div className="flex flex-wrap gap-2">
            {recreadores.map(r => (
              <button
                key={r.id}
                onClick={() => setRecSelecionado(r.id)}
                className={cn('flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm',
                  recSelecionado === r.id ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-secondary')}
              >
                {r.fotoUrl
                  ? <img src={r.fotoUrl} alt={`Foto de ${r.nome}`} className="h-6 w-6 rounded-full object-cover" />
                  : <span className="h-6 w-6 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold">{r.nome.charAt(0)}</span>}
                {r.nome}
              </button>
            ))}
            {recreadores.length === 0 && <p className="text-sm text-muted-foreground">Cadastre recreadores em Usuários (com foto e espaço).</p>}
          </div>

          {historico && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl bg-card shadow-card p-4 space-y-3">
                <h2 className="text-sm font-bold text-foreground">Desempenho por espaço</h2>
                {historico.porEspaco.length === 0 && <p className="text-xs text-muted-foreground">Sem avaliações aprovadas para este recreador.</p>}
                {historico.porEspaco.map(e => (
                  <div key={e.id} className="flex items-center justify-between gap-3 border-b border-border last:border-0 pb-2 last:pb-0">
                    <span className="text-sm text-foreground truncate">{e.nome}</span>
                    <MediaBadge media={e.media} total={e.total} />
                  </div>
                ))}
                {historico.geral && (
                  <div className="rounded-lg bg-secondary/50 p-3 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Média geral</span>
                    <MediaBadge media={historico.geral.media} total={historico.geral.total} />
                  </div>
                )}
              </div>
              <div className="rounded-xl bg-card shadow-card p-4 space-y-2">
                <h2 className="text-sm font-bold text-foreground">Comentários dos responsáveis</h2>
                {historico.comentarios.length === 0 && <p className="text-xs text-muted-foreground">Nenhum comentário.</p>}
                {historico.comentarios.map(c => (
                  <div key={c.id} className="rounded-lg bg-secondary/40 p-2">
                    <p className="text-sm text-foreground">{emojiDaNota(c.nota)} “{c.comentario}”</p>
                    <p className="text-[10px] text-muted-foreground">{c.espacoNome} · {new Date(c.criadoEm).toLocaleString('pt-BR')}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="config" className="pt-4">
          <div className="rounded-xl bg-card shadow-card p-5 space-y-5 max-w-xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label>Captação ativa</Label>
                <p className="text-xs text-muted-foreground">Libera a página pública de avaliação.</p>
              </div>
              <Switch checked={cfg.ativo} onCheckedChange={v => salvarCfg({ ativo: v })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="abre">Abre às</Label>
                <Input id="abre" type="time" value={cfg.horaAbertura} onChange={e => salvarCfg({ horaAbertura: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fecha">Fecha às</Label>
                <Input id="fecha" type="time" value={cfg.horaFechamento} onChange={e => salvarCfg({ horaFechamento: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label>Exigir liberação do supervisor</Label>
                <p className="text-xs text-muted-foreground">Avaliações ficam pendentes até aprovação.</p>
              </div>
              <Switch checked={cfg.exigirModeracao} onCheckedChange={v => salvarCfg({ exigirModeracao: v })} />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label>Permitir comentários</Label>
                <p className="text-xs text-muted-foreground">Campo de texto livre para o responsável.</p>
              </div>
              <Switch checked={cfg.permitirComentario} onCheckedChange={v => salvarCfg({ permitirComentario: v })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="msg">Mensagem de boas-vindas</Label>
              <Textarea id="msg" value={cfg.mensagemBoasVindas} onChange={e => salvarCfg({ mensagemBoasVindas: e.target.value })} />
            </div>
            <p className="text-[11px] text-muted-foreground font-mono-data">Link público: {linkPublico}</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
