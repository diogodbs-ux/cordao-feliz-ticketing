import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import BrandLogo from '@/components/BrandLogo';
import { getBranding } from '@/lib/branding';
import { readEspacos } from '@/types/espacos';
import {
  EMOJIS, NovaAvaliacao, VisitanteValidado, janelaAberta, readAvaliacaoConfig,
  recreadoresAvaliaveis, registrarAvaliacoes, validarVisitante,
} from '@/lib/avaliacoes';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { CheckCircle2, Clock, ShieldCheck, Star } from 'lucide-react';

function EmojiPicker({ value, onChange }: { value?: number; onChange: (n: number) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {EMOJIS.map(e => (
        <button
          key={e.nota}
          type="button"
          onClick={() => onChange(e.nota)}
          aria-label={e.label}
          aria-pressed={value === e.nota}
          className={cn(
            'flex flex-col items-center gap-1 rounded-xl border px-3 py-2 min-w-16 min-h-16 transition-all',
            value === e.nota ? 'border-primary bg-primary/10 scale-105' : 'border-border hover:bg-secondary'
          )}
        >
          <span className="text-2xl leading-none">{e.emoji}</span>
          <span className="text-[10px] text-muted-foreground">{e.label}</span>
        </button>
      ))}
    </div>
  );
}

export default function AvaliacaoPublica() {
  const brand = getBranding();
  const cfg = readAvaliacaoConfig();
  const janela = janelaAberta(cfg);

  const espacos = useMemo(() => readEspacos().filter(e => e.ativo), []);
  const recreadores = useMemo(() => recreadoresAvaliaveis(), []);

  const [protocolo, setProtocolo] = useState('');
  const [telefone, setTelefone] = useState('');
  const [visitante, setVisitante] = useState<VisitanteValidado | null>(null);
  const [enviado, setEnviado] = useState(false);

  const [espacoId, setEspacoId] = useState('');
  const [notaEspaco, setNotaEspaco] = useState<number | undefined>();
  const [comentarioEspaco, setComentarioEspaco] = useState('');
  const [notasRec, setNotasRec] = useState<Record<string, number>>({});
  const [comentariosRec, setComentariosRec] = useState<Record<string, string>>({});

  const espaco = espacos.find(e => e.id === espacoId);
  const recreadoresDoEspaco = recreadores.filter(r => !r.espacoId || r.espacoId === espacoId);

  const validar = () => {
    const res = validarVisitante(protocolo, telefone);
    if ('erro' in res) { toast.error(res.erro); return; }
    setVisitante(res.visitante);
  };

  const enviar = () => {
    if (!visitante || !espaco) { toast.error('Escolha o espaço que você visitou.'); return; }
    const itens: NovaAvaliacao[] = [];
    if (notaEspaco) {
      itens.push({ tipo: 'espaco', espacoId: espaco.id, espacoNome: espaco.nome, nota: notaEspaco, comentario: comentarioEspaco });
    }
    Object.entries(notasRec).forEach(([recId, nota]) => {
      const rec = recreadores.find(r => r.id === recId);
      if (!rec || !nota) return;
      itens.push({
        tipo: 'recreador', espacoId: espaco.id, espacoNome: espaco.nome,
        recreadorId: rec.id, recreadorNome: rec.nome, nota, comentario: comentariosRec[recId],
      });
    });
    const res = registrarAvaliacoes(visitante, itens);
    if ('erro' in res) { toast.error(res.erro); return; }
    setEnviado(true);
    toast.success(`Obrigado! ${res.total} avaliação(ões) enviadas.`);
  };

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-2xl px-5 py-4 flex items-center gap-3">
          <BrandLogo className="h-10 w-10 object-contain rounded" fallbackInitials />
          <div className="min-w-0">
            <h1 className="text-base font-bold text-foreground truncate">Avaliação de Espaços e Recreadores</h1>
            <p className="text-xs text-muted-foreground truncate">{brand.orgName}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-6 space-y-5">
        {!janela.aberta && (
          <div className="rounded-xl border border-border bg-secondary/40 p-4 flex items-start gap-3">
            <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">Avaliação indisponível agora</p>
              <p className="text-xs text-muted-foreground">{janela.motivo} Horário de captação: {cfg.horaAbertura} às {cfg.horaFechamento}.</p>
            </div>
          </div>
        )}

        {enviado ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center space-y-2">
            <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
            <h2 className="text-lg font-bold text-foreground">Avaliação enviada!</h2>
            <p className="text-sm text-muted-foreground">
              {cfg.exigirModeracao
                ? 'Sua avaliação será revisada pela supervisão antes de aparecer nos painéis.'
                : 'Sua avaliação já foi registrada nos painéis da coordenação.'}
            </p>
          </div>
        ) : !visitante ? (
          <section className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div>
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Identificação do visitante</h2>
              <p className="text-xs text-muted-foreground mt-1">{cfg.mensagemBoasVindas}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="protocolo">Protocolo do guichê</Label>
              <Input id="protocolo" value={protocolo} onChange={e => setProtocolo(e.target.value)} placeholder="Ex.: 2026-004512" autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone do responsável (com DDD)</Label>
              <Input id="telefone" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(85) 90000-0000" inputMode="tel" />
            </div>
            <Button className="w-full min-h-11" onClick={validar} disabled={!janela.aberta}>Continuar</Button>
            <p className="text-[11px] text-muted-foreground">
              Só é possível avaliar com protocolo que passou pelo check-in — isso garante que a avaliação vem de um visitante real.
            </p>
          </section>
        ) : (
          <>
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
              <p className="text-xs uppercase tracking-wider text-primary font-bold">Responsável validado</p>
              <p className="text-sm font-semibold text-foreground">{visitante.responsavelNome}</p>
              <p className="text-xs text-muted-foreground font-mono-data">Protocolo {visitante.protocolo} · tel ****{visitante.telefoneUltimos4}</p>
            </div>

            <section className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2"><Star className="h-4 w-4 text-primary" /> Avaliação do espaço</h2>
              <div className="space-y-2">
                <Label>Qual espaço vocês visitaram?</Label>
                <Select value={espacoId} onValueChange={setEspacoId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o espaço" /></SelectTrigger>
                  <SelectContent>
                    {espacos.map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {espaco && (
                <>
                  <div className="space-y-2">
                    <Label>Como foi a experiência da criança em {espaco.nome}?</Label>
                    <EmojiPicker value={notaEspaco} onChange={setNotaEspaco} />
                  </div>
                  {cfg.permitirComentario && (
                    <div className="space-y-2">
                      <Label htmlFor="com-espaco">Comentário (opcional)</Label>
                      <Textarea id="com-espaco" maxLength={500} value={comentarioEspaco} onChange={e => setComentarioEspaco(e.target.value)} placeholder="O que mais gostaram? O que pode melhorar?" />
                    </div>
                  )}
                </>
              )}
            </section>

            {espaco && (
              <section className="rounded-xl border border-border bg-card p-5 space-y-4">
                <div>
                  <h2 className="text-sm font-bold text-foreground">Avaliação dos recreadores</h2>
                  <p className="text-xs text-muted-foreground">Escolha o emoji para quem atendeu vocês em {espaco.nome}.</p>
                </div>
                {recreadoresDoEspaco.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum recreador cadastrado para este espaço.</p>
                ) : recreadoresDoEspaco.map(r => (
                  <div key={r.id} className="rounded-lg border border-border p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      {r.fotoUrl ? (
                        <img src={r.fotoUrl} alt={`Foto do recreador ${r.nome}`} className="h-14 w-14 rounded-full object-cover border border-border" loading="lazy" />
                      ) : (
                        <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                          {r.nome.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{r.nome}</p>
                        <p className="text-xs text-muted-foreground truncate">{r.espacoNome || espaco.nome}</p>
                      </div>
                    </div>
                    <EmojiPicker value={notasRec[r.id]} onChange={n => setNotasRec(s => ({ ...s, [r.id]: n }))} />
                    {cfg.permitirComentario && notasRec[r.id] && (
                      <Textarea
                        maxLength={500}
                        placeholder={`Comentário sobre ${r.nome} (opcional)`}
                        value={comentariosRec[r.id] || ''}
                        onChange={e => setComentariosRec(s => ({ ...s, [r.id]: e.target.value }))}
                      />
                    )}
                  </div>
                ))}
              </section>
            )}

            <Button className="w-full min-h-11" onClick={enviar} disabled={!janela.aberta || !espaco}>Enviar avaliação</Button>
          </>
        )}
      </main>
    </div>
  );
}
