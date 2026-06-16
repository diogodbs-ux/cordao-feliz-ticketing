import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { devolverCordao, getCordaoByCodigo, readCordoes, subscribeCordoesChange, CordaoUnidade } from '@/types/cordoes';
import { ScanLine, DoorOpen, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { beepOk } from '@/lib/sounds';

function fmtDur(seg?: number) {
  if (!seg && seg !== 0) return '—';
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

export default function PortariaDevolucao() {
  const [codigo, setCodigo] = useState('');
  const [ultimo, setUltimo] = useState<{ cordao: CordaoUnidade; duracaoSeg: number } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [todos, setTodos] = useState<CordaoUnidade[]>([]);

  useEffect(() => {
    const carregar = () => setTodos(readCordoes());
    carregar();
    return subscribeCordoesChange(carregar);
  }, []);

  const hoje = new Date().toLocaleDateString('pt-BR');
  const ativos = todos.filter(c => c.status === 'entregue');
  const devolvidosHoje = todos.filter(c => c.status === 'devolvido' && c.devolvidoEm && new Date(c.devolvidoEm).toLocaleDateString('pt-BR') === hoje);
  const tempoMedio = devolvidosHoje.length
    ? Math.round(devolvidosHoje.reduce((a, c) => a + (c.duracaoTotalSeg || 0), 0) / devolvidosHoje.length)
    : 0;

  const processar = () => {
    setErro(null);
    const raw = codigo.trim();
    if (!raw) return;
    const r = devolverCordao(raw);
    if (r.ok === false) {
      setErro(r.erro);
      toast.error(r.erro);
      return;
    }
    setUltimo({ cordao: r.cordao, duracaoSeg: r.duracaoSeg });
    beepOk();
    toast.success(`${r.cordao.codigo} devolvido — permanência ${fmtDur(r.duracaoSeg)}`);
    setCodigo('');
  };

  const previa = codigo.trim() ? getCordaoByCodigo(codigo.trim()) : null;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><DoorOpen className="h-6 w-6 text-primary" /> Devolução de Cordões — Portão</h1>
        <p className="text-sm text-muted-foreground">Escaneie cada cordão na saída para encerrar o ciclo e calcular o tempo total no parque.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 text-center"><p className="text-3xl font-bold text-primary font-mono-data">{ativos.length}</p><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Em uso</p></div>
        <div className="bg-card border border-border rounded-xl p-4 text-center"><p className="text-3xl font-bold text-cordao-verde font-mono-data">{devolvidosHoje.length}</p><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Devolvidos hoje</p></div>
        <div className="bg-card border border-border rounded-xl p-4 text-center"><p className="text-3xl font-bold text-foreground font-mono-data">{fmtDur(tempoMedio)}</p><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Tempo médio</p></div>
      </div>

      <div className="bg-card rounded-xl shadow-card p-6">
        <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Código do cordão</label>
        <div className="flex gap-2 mt-2">
          <Input
            value={codigo}
            onChange={e => { setCodigo(e.target.value.toUpperCase()); setErro(null); }}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); processar(); } }}
            placeholder="AZ-0001"
            className="font-mono-data text-lg h-12"
            autoFocus
          />
          <Button onClick={processar} disabled={!codigo.trim()} size="lg" className="gap-2"><ScanLine className="h-4 w-4" /> Devolver</Button>
        </div>
        {previa && previa.status === 'entregue' && (
          <p className="text-xs text-muted-foreground mt-2">→ {previa.membroNome || 'sem nome'} · protocolo {previa.protocolo}</p>
        )}
        {erro && <p className="text-xs text-cordao-vermelho mt-2 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {erro}</p>}
      </div>

      {ultimo && (
        <div className="bg-cordao-verde/10 border border-cordao-verde/40 rounded-xl p-6">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-cordao-verde" />
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wider text-cordao-verde font-bold">Cordão devolvido</p>
              <p className="text-lg font-bold text-foreground">{ultimo.cordao.codigo} — {ultimo.cordao.membroNome || '—'}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-2"><Clock className="h-3 w-3" /> Tempo no parque: <strong>{fmtDur(ultimo.duracaoSeg)}</strong> · {(ultimo.cordao.visitas || []).length} espaço(s) visitado(s)</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-card rounded-xl shadow-card p-6">
        <h3 className="text-sm font-semibold mb-3">Devoluções recentes (hoje)</h3>
        {devolvidosHoje.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma devolução registrada hoje.</p>
        ) : (
          <div className="space-y-1.5 max-h-80 overflow-auto">
            {devolvidosHoje.slice().reverse().slice(0, 30).map(c => (
              <div key={c.codigo} className="flex items-center justify-between text-xs bg-secondary/40 rounded-lg p-2.5">
                <div>
                  <p className="font-mono-data font-bold text-foreground">{c.codigo} <span className="font-sans text-muted-foreground font-normal">· {c.membroNome || '—'}</span></p>
                  <p className="text-muted-foreground">{c.protocolo} · devolvido {new Date(c.devolvidoEm!).toLocaleTimeString('pt-BR')}</p>
                </div>
                <p className="font-mono-data text-foreground">{fmtDur(c.duracaoTotalSeg)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
