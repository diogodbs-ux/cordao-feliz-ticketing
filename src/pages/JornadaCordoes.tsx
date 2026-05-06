import { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CordaoUnidade, readCordoes, parseCodigo, formatCodigo, cordoesPorProtocolo } from '@/types/cordoes';
import { CordaoColor, getCordaoTailwindBg, getCordaoTailwindText } from '@/types';
import { Search, MapPin, Clock, User, Hash, ArrowRight, Download, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import { toast } from 'sonner';

const CORES: CordaoColor[] = ['azul', 'verde', 'amarelo', 'vermelho', 'rosa', 'cinza', 'preto'];

function toISO(d: Date) { return d.toISOString().slice(0, 10); }

export default function JornadaCordoes() {
  const [todos, setTodos] = useState<CordaoUnidade[]>([]);
  const [busca, setBusca] = useState('');
  const hojeISO = toISO(new Date());
  const [dataDe, setDataDe] = useState<string>(hojeISO);
  const [dataAte, setDataAte] = useState<string>(hojeISO);
  const [filtroCor, setFiltroCor] = useState<'todas' | CordaoColor>('todas');
  const [semFiltroData, setSemFiltroData] = useState(false);

  useEffect(() => { setTodos(readCordoes()); }, []);

  const resultados = useMemo(() => {
    let base = todos;

    // Busca
    const q = busca.trim();
    if (q) {
      const parsed = parseCodigo(q);
      if (parsed) {
        const code = formatCodigo(parsed.cor, parsed.numero);
        base = base.filter(c => c.codigo === code);
      } else {
        const porProto = cordoesPorProtocolo(q);
        if (porProto.length > 0) {
          const codes = new Set(porProto.map(c => c.codigo));
          base = base.filter(c => codes.has(c.codigo));
        } else {
          const qLower = q.toLowerCase();
          base = base.filter(c =>
            (c.membroNome || '').toLowerCase().includes(qLower) ||
            (c.protocolo || '').toLowerCase().includes(qLower)
          );
        }
      }
    }

    // Cor
    if (filtroCor !== 'todas') base = base.filter(c => c.cor === filtroCor);

    // Filtro de data: pelo menos uma visita no intervalo OU vinculadoEm no intervalo
    if (!semFiltroData && (dataDe || dataAte)) {
      base = base.filter(c => {
        const visitas = c.visitas || [];
        const vinc = c.vinculadoEm ? c.vinculadoEm.slice(0, 10) : null;
        const datasISO = [
          ...visitas.map(v => v.entrada.slice(0, 10)),
          ...(vinc ? [vinc] : []),
        ];
        if (datasISO.length === 0) return false;
        return datasISO.some(d => (!dataDe || d >= dataDe) && (!dataAte || d <= dataAte));
      });
    }

    if (!q) {
      base = [...base].filter(c => (c.visitas?.length || 0) > 0)
        .sort((a, b) => (b.visitas?.length || 0) - (a.visitas?.length || 0));
    }
    return base.slice(0, 200);
  }, [busca, todos, dataDe, dataAte, filtroCor, semFiltroData]);

  const grupos = useMemo(() => {
    const m = new Map<string, CordaoUnidade[]>();
    resultados.forEach(c => {
      const k = c.protocolo || `__sem__${c.codigo}`;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(c);
    });
    return Array.from(m.entries()).map(([proto, lista]) => ({
      protocolo: proto.startsWith('__sem__') ? null : proto,
      cordoes: lista.sort((a, b) => a.codigo.localeCompare(b.codigo)),
    }));
  }, [resultados]);

  const exportarCSV = () => {
    if (!resultados.length) { toast.error('Nada para exportar'); return; }
    const rows = [['Codigo', 'Cor', 'Protocolo', 'Nome', 'Tipo', 'Espaço', 'Entrada', 'Saída', 'Duração (min)']];
    resultados.forEach(c => {
      const visitas = c.visitas || [];
      if (visitas.length === 0) {
        rows.push([c.codigo, c.cor, c.protocolo || '', c.membroNome || '', c.membroTipo || '', '', '', '', '']);
      } else {
        visitas.forEach(v => {
          const dur = v.saida ? Math.round((new Date(v.saida).getTime() - new Date(v.entrada).getTime()) / 60000) : '';
          rows.push([c.codigo, c.cor, c.protocolo || '', c.membroNome || '', c.membroTipo || '',
            v.espacoNome, v.entrada, v.saida || '', String(dur)]);
        });
      }
    });
    const csv = rows.map(r => r.map(f => `"${String(f).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `jornadas-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportado');
  };

  const exportarPDF = () => {
    if (!resultados.length) { toast.error('Nada para exportar'); return; }
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    let y = 15;
    pdf.setFontSize(14); pdf.setFont('helvetica', 'bold');
    pdf.text('Jornadas por cordão — Sentinela Infância', 105, y, { align: 'center' }); y += 6;
    pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(120);
    const periodo = semFiltroData ? 'todos os períodos' : `${dataDe} a ${dataAte}`;
    pdf.text(`Período: ${periodo}  ·  Cor: ${filtroCor}  ·  ${resultados.length} cordão(ões)`, 105, y, { align: 'center' });
    pdf.setTextColor(0); y += 8;

    grupos.forEach(g => {
      if (y > 270) { pdf.addPage(); y = 15; }
      pdf.setFontSize(10); pdf.setFont('helvetica', 'bold');
      pdf.text(g.protocolo ? `Protocolo: ${g.protocolo}` : 'Sem protocolo', 14, y); y += 5;
      g.cordoes.forEach(c => {
        if (y > 275) { pdf.addPage(); y = 15; }
        pdf.setFontSize(9); pdf.setFont('helvetica', 'bold');
        pdf.text(`${c.codigo}  ${c.membroNome || ''}`, 16, y); y += 4;
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(80);
        (c.visitas || []).forEach(v => {
          if (y > 280) { pdf.addPage(); y = 15; }
          const dur = v.saida ? `${Math.round((new Date(v.saida).getTime() - new Date(v.entrada).getTime()) / 60000)}min` : '—';
          const ent = new Date(v.entrada).toLocaleString('pt-BR');
          pdf.text(`• ${v.espacoNome} · ${ent} · ${dur}`, 20, y); y += 4;
        });
        pdf.setTextColor(0); y += 1;
      });
      y += 2;
    });

    pdf.save(`jornadas-${Date.now()}.pdf`);
    toast.success('PDF exportado');
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Jornada por cordão</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe o percurso individual de cada criança/adulto pelos espaços lúdicos.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportarCSV} className="gap-2"><Download className="h-4 w-4" /> CSV</Button>
          <Button onClick={exportarPDF} className="gap-2"><FileText className="h-4 w-4" /> PDF</Button>
        </div>
      </div>

      <div className="bg-card rounded-xl shadow-card p-5 space-y-3">
        <div className="relative">
          <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Código (AZ-0457), protocolo ou nome do responsável/criança…"
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">De</label>
            <Input type="date" value={dataDe} onChange={e => setDataDe(e.target.value)} disabled={semFiltroData} className="h-9 w-[160px]" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Até</label>
            <Input type="date" value={dataAte} onChange={e => setDataAte(e.target.value)} disabled={semFiltroData} className="h-9 w-[160px]" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Cor</label>
            <Select value={filtroCor} onValueChange={v => setFiltroCor(v as any)}>
              <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {CORES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" variant="outline" onClick={() => { const t = toISO(new Date()); setDataDe(t); setDataAte(t); setSemFiltroData(false); }}>Hoje</Button>
          <Button size="sm" variant={semFiltroData ? 'default' : 'outline'} onClick={() => setSemFiltroData(s => !s)}>
            {semFiltroData ? 'Sem filtro de data' : 'Ver todos os períodos'}
          </Button>
          <span className="text-[11px] text-muted-foreground ml-auto">{resultados.length} cordão(ões)</span>
        </div>
      </div>

      {grupos.length === 0 ? (
        <div className="bg-card rounded-xl shadow-card p-12 text-center">
          <MapPin className="h-10 w-10 mx-auto text-muted-foreground opacity-30 mb-3" />
          <p className="text-sm text-muted-foreground">
            {busca ? 'Nenhum cordão encontrado para os filtros aplicados.' : 'Ainda não há cordões com visitas registradas.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {grupos.map(g => (
            <div key={g.protocolo || g.cordoes[0].codigo} className="bg-card rounded-xl shadow-card overflow-hidden">
              {g.protocolo && (
                <div className="px-5 py-3 bg-secondary/40 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-mono-data font-bold text-foreground">{g.protocolo}</span>
                    <span className="text-[10px] text-muted-foreground">· {g.cordoes.length} cordão(ões)</span>
                  </div>
                </div>
              )}
              <div className="divide-y divide-border">
                {g.cordoes.map(c => <CordaoRow key={c.codigo} cordao={c} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CordaoRow({ cordao }: { cordao: CordaoUnidade }) {
  const visitas = cordao.visitas || [];
  const tempoTotal = visitas.reduce((acc, v) => {
    if (v.saida) acc += new Date(v.saida).getTime() - new Date(v.entrada).getTime();
    return acc;
  }, 0);
  const minutos = Math.round(tempoTotal / 60000);

  return (
    <div className="p-5">
      <div className="flex items-center gap-3 flex-wrap mb-3">
        <span className={cn('px-2.5 py-1 rounded text-xs font-bold font-mono-data',
          getCordaoTailwindBg(cordao.cor), getCordaoTailwindText(cordao.cor))}>
          {cordao.codigo}
        </span>
        {cordao.membroNome && (
          <div className="flex items-center gap-1 text-sm">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium text-foreground">{cordao.membroNome}</span>
            <span className="text-[10px] text-muted-foreground">({cordao.membroTipo})</span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>{visitas.length} espaço(s) visitado(s)</span>
          {minutos > 0 && (
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {minutos} min total</span>
          )}
        </div>
      </div>

      {visitas.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Sem visitas registradas em espaços.</p>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          {visitas.map((v, i) => {
            const dur = v.saida ? Math.round((new Date(v.saida).getTime() - new Date(v.entrada).getTime()) / 60000) : null;
            return (
              <div key={v.cicloId} className="flex items-center gap-2">
                <div className="bg-secondary/50 rounded-lg px-3 py-1.5">
                  <p className="text-xs font-medium text-foreground">{v.espacoNome}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(v.entrada).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    {dur !== null && ` · ${dur}min`}
                  </p>
                </div>
                {i < visitas.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
