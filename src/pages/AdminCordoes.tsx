import { useState, useEffect, useMemo } from 'react';
import JsBarcode from 'jsbarcode';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  CordaoUnidade, LoteCordao, gerarLote, readCordoes, readLotes,
  formatCodigo, prefixoCor,
} from '@/types/cordoes';
import { CordaoColor, getCordaoLabel, getCordaoTailwindBg, getCordaoTailwindText } from '@/types';
import { Printer, Plus, Tag, Layers, Search, Download } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const CORES_CORDAO: CordaoColor[] = ['azul', 'verde', 'amarelo', 'vermelho', 'rosa', 'cinza', 'preto'];

export default function AdminCordoes() {
  const { user } = useAuth();
  const [cordoes, setCordoes] = useState<CordaoUnidade[]>([]);
  const [lotes, setLotes] = useState<LoteCordao[]>([]);

  const [novaCor, setNovaCor] = useState<CordaoColor>('azul');
  const [novaQtd, setNovaQtd] = useState(50);
  const [obs, setObs] = useState('');

  const [busca, setBusca] = useState('');

  const refresh = () => { setCordoes(readCordoes()); setLotes(readLotes()); };
  useEffect(() => { refresh(); }, []);

  const stats = useMemo(() => {
    const acc: Record<CordaoColor, { total: number; entregues: number; disponiveis: number }> = {} as any;
    CORES_CORDAO.forEach(c => acc[c] = { total: 0, entregues: 0, disponiveis: 0 });
    cordoes.forEach(c => {
      acc[c.cor].total++;
      if (c.status === 'entregue') acc[c.cor].entregues++;
      if (c.status === 'disponivel') acc[c.cor].disponiveis++;
    });
    return acc;
  }, [cordoes]);

  const lotesOrdenados = useMemo(() =>
    [...lotes].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)),
  [lotes]);

  const cordoesFiltrados = useMemo(() => {
    const q = busca.trim().toUpperCase();
    if (!q) return [];
    return cordoes.filter(c =>
      c.codigo.includes(q) ||
      (c.protocolo || '').toUpperCase().includes(q) ||
      (c.membroNome || '').toUpperCase().includes(q)
    ).slice(0, 50);
  }, [busca, cordoes]);

  const handleGerar = () => {
    if (novaQtd <= 0 || novaQtd > 5000) {
      toast.error('Quantidade entre 1 e 5000.');
      return;
    }
    try {
      const { lote } = gerarLote(novaCor, novaQtd, user?.nome, obs.trim() || undefined);
      toast.success(`Lote gerado: ${formatCodigo(lote.cor, lote.inicio)} → ${formatCodigo(lote.cor, lote.fim)}`);
      setObs('');
      refresh();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao gerar lote');
    }
  };

  const imprimirLote = (lote: LoteCordao) => {
    const itens = cordoes.filter(c => c.loteId === lote.id);
    abrirImpressao(itens, `Lote ${prefixoCor(lote.cor)} ${lote.inicio}–${lote.fim}`);
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Cordões Numerados</h1>
        <p className="text-sm text-muted-foreground">
          Gere lotes sequenciais por cor (AZ-0001…), imprima as etiquetas com código de barras e
          acompanhe a vinculação a cada protocolo. A leitura/digitação no check-in e nos espaços
          permite o rastreio individual da criança.
        </p>
      </div>

      {/* Estoque por cor */}
      <div className="bg-card rounded-xl shadow-card p-5">
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" /> Estoque por cor
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {CORES_CORDAO.map(cor => (
            <div key={cor} className="rounded-lg border border-border overflow-hidden">
              <div className={cn('h-8 flex items-center justify-center text-xs font-bold uppercase', getCordaoTailwindBg(cor), getCordaoTailwindText(cor))}>
                {prefixoCor(cor)} · {cor}
              </div>
              <div className="p-3 text-center">
                <p className="text-2xl font-bold font-mono-data text-foreground">{stats[cor].disponiveis}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">disponíveis</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {stats[cor].entregues} entregues · {stats[cor].total} total
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Gerar novo lote */}
      <div className="bg-card rounded-xl shadow-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Plus className="h-4 w-4 text-muted-foreground" /> Gerar novo lote
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Cor</Label>
            <Select value={novaCor} onValueChange={v => setNovaCor(v as CordaoColor)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CORES_CORDAO.map(c => (
                  <SelectItem key={c} value={c}>{prefixoCor(c)} — {getCordaoLabel(c)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Quantidade</Label>
            <Input type="number" min={1} max={5000} value={novaQtd}
              onChange={e => setNovaQtd(parseInt(e.target.value) || 0)} className="mt-1" />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Observação (opcional)</Label>
            <Input value={obs} onChange={e => setObs(e.target.value)} placeholder="ex.: reposição operação 2026-05-05" className="mt-1" />
          </div>
        </div>
        <Button onClick={handleGerar} className="gap-2">
          <Plus className="h-4 w-4" /> Gerar lote sequencial
        </Button>
      </div>

      {/* Lotes existentes */}
      <div className="bg-card rounded-xl shadow-card p-5">
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Tag className="h-4 w-4 text-muted-foreground" /> Lotes gerados ({lotes.length})
        </h2>
        {lotesOrdenados.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhum lote gerado ainda.</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-auto">
            {lotesOrdenados.map(l => (
              <div key={l.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-secondary/40">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={cn('px-2 py-1 rounded text-[10px] font-bold uppercase', getCordaoTailwindBg(l.cor), getCordaoTailwindText(l.cor))}>
                    {prefixoCor(l.cor)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground font-mono-data">
                      {formatCodigo(l.cor, l.inicio)} → {formatCodigo(l.cor, l.fim)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {l.quantidade} cordões · {new Date(l.criadoEm).toLocaleString('pt-BR')}
                      {l.criadoPor && ` · por ${l.criadoPor}`}
                      {l.observacao && ` · ${l.observacao}`}
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => imprimirLote(l)} className="gap-1.5 flex-shrink-0">
                  <Printer className="h-3.5 w-3.5" /> Imprimir
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Busca individual */}
      <div className="bg-card rounded-xl shadow-card p-5">
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" /> Buscar cordão
        </h2>
        <Input
          placeholder="Digite código (AZ-0457), protocolo ou nome…"
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
        {cordoesFiltrados.length > 0 && (
          <div className="mt-3 space-y-1.5 max-h-72 overflow-auto">
            {cordoesFiltrados.map(c => (
              <div key={c.codigo} className="flex items-center justify-between text-xs p-2 rounded bg-secondary/40">
                <div className="flex items-center gap-2">
                  <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-bold', getCordaoTailwindBg(c.cor), getCordaoTailwindText(c.cor))}>
                    {c.codigo}
                  </span>
                  <span className="text-foreground">{c.membroNome || '—'}</span>
                  {c.protocolo && <span className="text-muted-foreground">· {c.protocolo}</span>}
                </div>
                <div className="text-right">
                  <span className={cn('text-[10px] uppercase font-semibold',
                    c.status === 'entregue' ? 'text-cordao-verde' :
                    c.status === 'devolvido' ? 'text-muted-foreground' : 'text-primary'
                  )}>{c.status}</span>
                  {c.visitas && c.visitas.length > 0 && (
                    <p className="text-[10px] text-muted-foreground">{c.visitas.length} visita(s)</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- impressão (folha A4 com etiquetas + barcode) ----
function abrirImpressao(itens: CordaoUnidade[], titulo: string) {
  if (itens.length === 0) {
    toast.error('Nenhum cordão para imprimir.');
    return;
  }
  // Renderiza barcodes em um SVG para cada item e injeta numa janela nova
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) { toast.error('Permita pop-ups para imprimir.'); return; }

  const corHex: Record<CordaoColor, string> = {
    azul: '#4A90D9', verde: '#3CB371', amarelo: '#F5C518',
    vermelho: '#E74C3C', rosa: '#E96D9B', cinza: '#6B7B8D', preto: '#1E293B',
  };

  const cards = itens.map(it => {
    // gera SVG do barcode em string
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    JsBarcode(svg, it.codigo, {
      format: 'CODE128', width: 1.6, height: 38, displayValue: false, margin: 0,
    });
    const svgStr = new XMLSerializer().serializeToString(svg);
    return `
      <div class="card">
        <div class="bar" style="background:${corHex[it.cor]};color:${it.cor === 'amarelo' ? '#000' : '#fff'}">${it.cor.toUpperCase()}</div>
        <div class="bc">${svgStr}</div>
        <div class="code">${it.codigo}</div>
      </div>
    `;
  }).join('');

  w.document.write(`
    <html><head><title>${titulo}</title>
    <style>
      @page { size: A4; margin: 8mm; }
      body { font-family: -apple-system, system-ui, sans-serif; margin:0; padding:0; }
      .header { padding: 6px 4px 10px; border-bottom: 1px solid #ddd; margin-bottom: 8px; }
      .header h1 { font-size: 13px; margin: 0; }
      .header p { font-size: 10px; color: #666; margin: 2px 0 0; }
      .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; }
      .card { border: 1px dashed #999; border-radius: 4px; overflow: hidden; page-break-inside: avoid; }
      .bar { font-size: 10px; font-weight: 800; text-align: center; padding: 3px 0; letter-spacing: 1px; }
      .bc { display: flex; justify-content: center; padding: 4px 4px 0; }
      .bc svg { width: 90%; height: 38px; }
      .code { text-align: center; font-family: 'Courier New', monospace; font-size: 13px; font-weight: 700; padding: 2px 0 6px; }
      @media print { .no-print { display:none; } }
    </style>
    </head><body>
      <div class="header">
        <h1>${titulo}</h1>
        <p>${itens.length} cordões · gerado em ${new Date().toLocaleString('pt-BR')}</p>
      </div>
      <div class="grid">${cards}</div>
      <script>window.onload = () => { setTimeout(() => window.print(), 300); };</script>
    </body></html>
  `);
  w.document.close();
}
