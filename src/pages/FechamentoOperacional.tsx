import { useState, useMemo, useEffect } from 'react';
import { useData } from '@/contexts/DataContext';
import { Button } from '@/components/ui/button';
import { Copy, Download, Image as ImageIcon, FileText, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { calcularFechamento, formatWhatsApp, gerarImagemPNG, gerarPDF } from '@/lib/fechamento';
import DataOperacionalPicker from '@/components/DataOperacionalPicker';
import { cn } from '@/lib/utils';
import { CordaoColor } from '@/types';

const CORDAO_HEX: Record<CordaoColor, string> = {
  azul: '#4A90D9', verde: '#3CB371', amarelo: '#F5C518',
  vermelho: '#E74C3C', rosa: '#E96D9B', cinza: '#6B7B8D', preto: '#1E293B',
};
const CORDAO_LABEL: Record<CordaoColor, string> = {
  azul: 'Azul', verde: 'Verde', amarelo: 'Amarelo',
  vermelho: 'Vermelho', rosa: 'Rosas', cinza: 'Cinzas', preto: 'Pretos',
};

export default function FechamentoOperacional() {
  const { grupos } = useData();
  const hojeReal = new Date().toLocaleDateString('pt-BR');
  const [data, setData] = useState(hojeReal);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const fechamento = useMemo(() => calcularFechamento(grupos, data), [grupos, data]);
  const texto = useMemo(() => formatWhatsApp(fechamento), [fechamento]);

  const horaAtual = now.getHours() * 60 + now.getMinutes();
  const dentroJanela = horaAtual >= 16 * 60 + 30; // a partir de 16:30
  const ehHoje = data === hojeReal;

  const copiar = async () => {
    await navigator.clipboard.writeText(texto);
    toast.success('Relatório copiado! Cole no WhatsApp.');
  };

  const baixarPNG = async () => {
    try {
      const blob = await gerarImagemPNG(fechamento);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `fechamento-${data.replace(/\//g, '-')}.png`;
      a.click(); URL.revokeObjectURL(url);
      toast.success('Imagem baixada.');
    } catch (e) {
      toast.error('Erro ao gerar imagem.');
    }
  };

  const baixarPDF = async () => {
    try {
      const blob = await gerarPDF(fechamento);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `fechamento-${data.replace(/\//g, '-')}.pdf`;
      a.click(); URL.revokeObjectURL(url);
      toast.success('PDF baixado.');
    } catch (e) {
      toast.error('Erro ao gerar PDF.');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fechamento Operacional</h1>
          <p className="text-sm text-muted-foreground">
            Relatório consolidado para divulgação no grupo de WhatsApp ou comunicação oficial
          </p>
        </div>
        <DataOperacionalPicker value={data} onChange={setData} hojeReal={hojeReal} />
      </div>

      {/* Status janela 17h */}
      {ehHoje && (
        <div className={cn(
          'rounded-xl p-4 flex items-center gap-3 border',
          dentroJanela
            ? 'bg-cordao-verde/10 border-cordao-verde/30 text-cordao-verde'
            : 'bg-cordao-amarelo/10 border-cordao-amarelo/30 text-foreground'
        )}>
          {dentroJanela ? <CheckCircle2 className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
          <div className="flex-1">
            <p className="text-sm font-semibold">
              {dentroJanela ? 'Janela de fechamento aberta (após 16:30)' : 'Aguardando janela de fechamento (16:30)'}
            </p>
            <p className="text-xs opacity-80">
              Hora atual: {now.toLocaleTimeString('pt-BR')} · A partir das 16:30 não há novas entradas no parque.
            </p>
          </div>
        </div>
      )}

      {fechamento.total === 0 && (
        <div className="bg-cordao-amarelo/10 border border-cordao-amarelo/30 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-cordao-amarelo" />
          <p className="text-sm text-foreground">Nenhum check-in registrado para {data}. Nada a relatar.</p>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Preview WhatsApp */}
        <div className="bg-card rounded-2xl shadow-elevated p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Texto para WhatsApp</h3>
            <Button size="sm" onClick={copiar} className="gap-2">
              <Copy className="h-4 w-4" /> Copiar
            </Button>
          </div>
          <pre className="bg-secondary/50 rounded-lg p-4 text-sm font-mono whitespace-pre-wrap text-foreground border border-border min-h-[280px]">
{texto}
          </pre>
          <p className="text-[11px] text-muted-foreground mt-3">
            Formato idêntico ao usado atualmente no grupo. Adultos = crianças × 2 (regra oficial). Cores zeradas são omitidas.
          </p>
        </div>

        {/* Preview visual */}
        <div className="bg-card rounded-2xl shadow-elevated p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Resumo visual</h3>
          <div className="space-y-2">
            {(Object.keys(CORDAO_LABEL) as CordaoColor[]).map(cor => {
              const v = fechamento.porCor[cor];
              if (v === 0) return null;
              return (
                <div key={cor} className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: CORDAO_HEX[cor] }} />
                  <span className="text-sm text-foreground flex-1">{CORDAO_LABEL[cor]}</span>
                  <span className="text-base font-bold font-mono-data" style={{ color: CORDAO_HEX[cor] }}>{v}</span>
                </div>
              );
            })}
          </div>
          <div className="border-t border-border mt-4 pt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Crianças</span>
              <span className="font-bold font-mono-data">{fechamento.totalCriancas}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Adultos</span>
              <span className="font-bold font-mono-data">{fechamento.totalAdultos}</span>
            </div>
          </div>
          <div className="bg-primary/10 rounded-xl p-4 mt-4 text-center">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Total de Visitantes</p>
            <p className="text-5xl font-bold text-primary font-mono-data mt-1">{fechamento.total}</p>
          </div>
        </div>
      </div>

      {/* Exports */}
      <div className="bg-card rounded-xl shadow-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Exportar relatório</h3>
        <div className="grid sm:grid-cols-3 gap-3">
          <Button onClick={copiar} variant="outline" className="gap-2 h-auto py-4 flex-col">
            <Copy className="h-5 w-5" />
            <span className="text-sm font-semibold">Texto WhatsApp</span>
            <span className="text-[10px] text-muted-foreground">Copiar para área de transferência</span>
          </Button>
          <Button onClick={baixarPNG} variant="outline" className="gap-2 h-auto py-4 flex-col">
            <ImageIcon className="h-5 w-5" />
            <span className="text-sm font-semibold">Imagem PNG</span>
            <span className="text-[10px] text-muted-foreground">Card visual 1080x1350 (story/feed)</span>
          </Button>
          <Button onClick={baixarPDF} variant="outline" className="gap-2 h-auto py-4 flex-col">
            <FileText className="h-5 w-5" />
            <span className="text-sm font-semibold">PDF Profissional</span>
            <span className="text-[10px] text-muted-foreground">Documento A4 com guichês e PCD</span>
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Substitui a contagem manual cordão a cordão. Números calculados automaticamente a partir dos check-ins do dia.
      </p>
    </div>
  );
}
