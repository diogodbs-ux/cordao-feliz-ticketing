import { useEffect, useMemo, useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { QrCode, Search, Printer, Download, Tag } from 'lucide-react';
import { generateQRDataURL } from '@/lib/qr';
import { ListaAniversariante, ListaInstituicao } from '@/types/listas';
import { imprimirCordoes, CordaoPrintItem } from '@/lib/print';
import { CordaoColor } from '@/types';
import jsPDF from 'jspdf';
import { toast } from 'sonner';

const STORAGE_ANIVERSARIANTES = 'sentinela_aniversariantes';
const STORAGE_INSTITUICOES = 'sentinela_instituicoes';

interface QRItem {
  tipo: 'g' | 'a' | 'i';
  id: string;
  titulo: string;
  subtitulo: string;
  qr: string;
  dataISO?: string; // YYYY-MM-DD para filtro
}

function toISO(d: Date) { return d.toISOString().slice(0, 10); }
function brToISO(br: string): string | null {
  const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export default function AdminQRCodes() {
  const { grupos } = useData();
  const [busca, setBusca] = useState('');
  const [items, setItems] = useState<QRItem[]>([]);
  const [aniversariantes, setAniversariantes] = useState<ListaAniversariante[]>([]);
  const [instituicoes, setInstituicoes] = useState<ListaInstituicao[]>([]);
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'g' | 'a' | 'i'>('todos');
  const hojeISO = toISO(new Date());
  const [dataDe, setDataDe] = useState<string>(hojeISO);
  const [dataAte, setDataAte] = useState<string>(hojeISO);
  const [semData, setSemData] = useState(false);

  useEffect(() => {
    try { setAniversariantes(JSON.parse(localStorage.getItem(STORAGE_ANIVERSARIANTES) || '[]')); } catch {}
    try { setInstituicoes(JSON.parse(localStorage.getItem(STORAGE_INSTITUICOES) || '[]')); } catch {}
  }, []);

  // Generate QR codes for all visible visitors
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const all: { tipo: 'g' | 'a' | 'i'; id: string; titulo: string; subtitulo: string; dataISO?: string }[] = [];

      grupos.forEach(g => {
        const data = brToISO(g.dataAgendamento || '') || toISO(new Date(g.criadoEm));
        all.push({
          tipo: 'g',
          id: g.id,
          titulo: g.responsavel.nome,
          subtitulo: `${g.responsavel.criancas.length} criança(s) · ${g.dataAgendamento || ''}`,
          dataISO: data,
        });
      });
      aniversariantes.forEach(a => {
        all.push({
          tipo: 'a',
          id: a.id,
          titulo: `🎂 ${a.nomeAniversariante}`,
          subtitulo: `Resp: ${a.responsavelNome} · ${a.dataVisita}`,
          dataISO: brToISO(a.dataVisita) || undefined,
        });
      });
      instituicoes.forEach(i => {
        all.push({
          tipo: 'i',
          id: i.id,
          titulo: `🏫 ${i.nomeInstituicao}`,
          subtitulo: `Resp: ${i.responsavelNome} · ${i.dataVisita}`,
          dataISO: brToISO(i.dataVisita) || undefined,
        });
      });

      const generated: QRItem[] = [];
      for (const it of all) {
        const qr = await generateQRDataURL({ v: 1, t: it.tipo, id: it.id }, 220);
        if (cancelled) return;
        generated.push({ ...it, qr });
      }
      if (!cancelled) setItems(generated);
    })();
    return () => { cancelled = true; };
  }, [grupos, aniversariantes, instituicoes]);

  const filtrados = useMemo(() => {
    let r = items;
    if (filtroTipo !== 'todos') r = r.filter(i => i.tipo === filtroTipo);
    if (!semData && (dataDe || dataAte)) {
      r = r.filter(i => {
        if (!i.dataISO) return false;
        if (dataDe && i.dataISO < dataDe) return false;
        if (dataAte && i.dataISO > dataAte) return false;
        return true;
      });
    }
    if (busca.trim()) {
      const t = busca.toLowerCase();
      r = r.filter(i => i.titulo.toLowerCase().includes(t) || i.subtitulo.toLowerCase().includes(t));
    }
    return r;
  }, [items, filtroTipo, busca, dataDe, dataAte, semData]);


  const exportarPDF = async () => {
    if (!filtrados.length) {
      toast.error('Nenhum QR Code para exportar');
      return;
    }
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = 210;
    const cardW = 60;
    const cardH = 75;
    const cols = 3;
    const rows = 3;
    const marginX = (pageW - cols * cardW) / 2;
    const marginY = 15;
    let i = 0;
    for (const it of filtrados) {
      const idx = i % (cols * rows);
      if (idx === 0 && i > 0) pdf.addPage();
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = marginX + col * cardW;
      const y = marginY + row * cardH;

      pdf.setDrawColor(220);
      pdf.rect(x + 2, y + 2, cardW - 4, cardH - 4);
      pdf.addImage(it.qr, 'PNG', x + 10, y + 6, cardW - 20, cardW - 20);

      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      const titulo = it.titulo.length > 28 ? it.titulo.slice(0, 26) + '…' : it.titulo;
      pdf.text(titulo, x + cardW / 2, y + cardW - 2, { align: 'center' });

      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(120);
      const sub = it.subtitulo.length > 36 ? it.subtitulo.slice(0, 34) + '…' : it.subtitulo;
      pdf.text(sub, x + cardW / 2, y + cardW + 4, { align: 'center' });
      pdf.setTextColor(0);

      i++;
    }
    pdf.save(`sentinela-qrcodes-${Date.now()}.pdf`);
    toast.success(`PDF gerado com ${filtrados.length} QR Code(s)`);
  };

  const imprimirTudo = () => {
    if (!filtrados.length) return;
    const win = window.open('', '_blank');
    if (!win) return;
    const html = filtrados.map(it => `
      <div class="card">
        <img src="${it.qr}" alt="QR" />
        <div class="t">${escape(it.titulo)}</div>
        <div class="s">${escape(it.subtitulo)}</div>
      </div>
    `).join('');
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>QR Codes</title>
    <style>
      @page { size: A4; margin: 10mm; }
      body { font-family: Arial, sans-serif; margin: 0; }
      .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6mm; }
      .card { border: 1px solid #ddd; border-radius: 6px; padding: 4mm; text-align: center; page-break-inside: avoid; }
      .card img { width: 90%; height: auto; }
      .t { font-size: 11pt; font-weight: 700; margin-top: 2mm; }
      .s { font-size: 8pt; color: #666; margin-top: 1mm; }
    </style></head><body><div class="grid">${html}</div>
    <script>window.onload=function(){setTimeout(function(){window.print();},250);};</script>
    </body></html>`);
    win.document.close();
  };

  const counts = useMemo(() => ({
    g: items.filter(i => i.tipo === 'g').length,
    a: items.filter(i => i.tipo === 'a').length,
    i: items.filter(i => i.tipo === 'i').length,
  }), [items]);

  const imprimirCordoesDoDia = () => {
    const hoje = new Date().toLocaleDateString('pt-BR');
    const grupHoje = grupos.filter(g => {
      if (g.dataAgendamento) return g.dataAgendamento === hoje;
      return new Date(g.criadoEm).toLocaleDateString('pt-BR') === hoje;
    });
    if (!grupHoje.length) {
      toast.error('Nenhum visitante agendado para hoje');
      return;
    }
    const labels: CordaoPrintItem[] = [];
    grupHoje.forEach(g => {
      const r = g.responsavel;
      labels.push({ nome: r.nome, cor: 'rosa', detalhe: 'Responsável', guiche: g.guiche });
      (r.acompanhantes || []).forEach(a => {
        labels.push({ nome: a.nome, cor: 'rosa', detalhe: a.parentesco || 'Acompanhante', guiche: g.guiche });
      });
      r.criancas.forEach(c => {
        labels.push({ nome: c.nome, cor: c.cordaoCor, detalhe: `${c.idade} anos`, pcd: c.pcd, pcdDescricao: c.pcdDescricao, guiche: g.guiche });
      });
    });
    imprimirCordoes(labels, { titulo: `Cordões do Dia — ${hoje}` });
    toast.success(`${labels.length} cordão(ões) enviados para impressão`);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <QrCode className="h-6 w-6 text-primary" />
            QR Codes de Visitantes
          </h1>
          <p className="text-sm text-muted-foreground">
            Gere e imprima QR Codes para acelerar o check-in no guichê
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={imprimirCordoesDoDia} className="gap-2">
            <Tag className="h-4 w-4" />
            Imprimir Cordões do Dia
          </Button>
          <Button variant="outline" onClick={imprimirTudo} className="gap-2">
            <Printer className="h-4 w-4" />
            Imprimir QRs
          </Button>
          <Button onClick={exportarPDF} className="gap-2">
            <Download className="h-4 w-4" />
            Exportar PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button onClick={() => setFiltroTipo('todos')} className={`text-left p-3 rounded-lg border transition ${filtroTipo === 'todos' ? 'bg-primary/10 border-primary' : 'bg-card border-border'}`}>
          <p className="text-xs text-muted-foreground">Todos</p>
          <p className="text-2xl font-bold">{items.length}</p>
        </button>
        <button onClick={() => setFiltroTipo('g')} className={`text-left p-3 rounded-lg border transition ${filtroTipo === 'g' ? 'bg-primary/10 border-primary' : 'bg-card border-border'}`}>
          <p className="text-xs text-muted-foreground">Agendamentos</p>
          <p className="text-2xl font-bold">{counts.g}</p>
        </button>
        <button onClick={() => setFiltroTipo('a')} className={`text-left p-3 rounded-lg border transition ${filtroTipo === 'a' ? 'bg-primary/10 border-primary' : 'bg-card border-border'}`}>
          <p className="text-xs text-muted-foreground">Aniversários</p>
          <p className="text-2xl font-bold">{counts.a}</p>
        </button>
        <button onClick={() => setFiltroTipo('i')} className={`text-left p-3 rounded-lg border transition ${filtroTipo === 'i' ? 'bg-primary/10 border-primary' : 'bg-card border-border'}`}>
          <p className="text-xs text-muted-foreground">Instituições</p>
          <p className="text-2xl font-bold">{counts.i}</p>
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome…"
          className="pl-10 h-11"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filtrados.slice(0, 60).map(it => (
          <Card key={it.tipo + it.id} className="p-4 text-center space-y-2">
            <img src={it.qr} alt="QR" className="w-full h-auto rounded" />
            <p className="text-sm font-bold leading-tight line-clamp-2">{it.titulo}</p>
            <p className="text-xs text-muted-foreground line-clamp-2">{it.subtitulo}</p>
          </Card>
        ))}
      </div>

      {filtrados.length > 60 && (
        <p className="text-center text-sm text-muted-foreground">
          Exibindo 60 de {filtrados.length} — use o filtro/busca ou exporte para PDF para ver todos
        </p>
      )}

      {!filtrados.length && (
        <div className="text-center py-12 text-muted-foreground">
          Nenhum visitante encontrado. Importe agendamentos primeiro.
        </div>
      )}
    </div>
  );
}

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
