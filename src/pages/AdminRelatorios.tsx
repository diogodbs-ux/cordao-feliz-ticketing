import { useData } from '@/contexts/DataContext';
import { Button } from '@/components/ui/button';
import { Download, FileText, Calendar } from 'lucide-react';
import { getCordaoLabel, CordaoColor } from '@/types';
import { toast } from 'sonner';

export default function AdminRelatorios() {
  const { grupos, checkins, stats } = useData();

  const exportCSV = () => {
    const rows = [['Responsável', 'Crianças', 'Guichê', 'Atendido Por', 'Data/Hora', 'Cordões']];
    checkins.forEach(c => {
      rows.push([
        c.responsavelNome,
        c.totalCriancas.toString(),
        c.guiche.toString(),
        c.atendidoPor,
        new Date(c.dataHora).toLocaleString('pt-BR'),
        c.cordoes.map(co => `${co.quantidade}x ${co.cor}`).join(', '),
      ]);
    });
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-checkins-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Relatório exportado com sucesso!');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
          <p className="text-sm text-muted-foreground">Exportar e analisar dados da operação</p>
        </div>
        <Button onClick={exportCSV} className="gap-2" disabled={checkins.length === 0}>
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      {/* Relatório de Contagem de Cordões */}
      <div className="bg-card rounded-xl shadow-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          Contagem de Cordões — {new Date().toLocaleDateString('pt-BR')}
        </h3>
        <div className="space-y-3">
          {(Object.entries(stats.porCor) as [CordaoColor, number][]).map(([cor, qtd]) => (
            <div key={cor} className="flex items-center gap-4">
              <div className={`h-4 w-4 rounded-full bg-cordao-${cor}`} />
              <span className="text-sm text-foreground w-48">{getCordaoLabel(cor)}</span>
              <div className="flex-1 bg-secondary rounded-full h-6 overflow-hidden">
                <div
                  className={`h-full bg-cordao-${cor} rounded-full transition-all duration-500`}
                  style={{ width: `${stats.totalVisitantes > 0 ? (qtd / stats.totalVisitantes * 100) : 0}%` }}
                />
              </div>
              <span className="text-lg font-bold text-foreground font-mono-data w-12 text-right">{qtd}</span>
            </div>
          ))}
          <div className="pt-3 border-t border-border flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Total de Visitantes</span>
            <span className="text-2xl font-bold text-foreground font-mono-data">{stats.totalVisitantes}</span>
          </div>
        </div>
      </div>

      {/* Performance por Guichê */}
      <div className="bg-card rounded-xl shadow-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          Atendimentos por Guichê
        </h3>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map(g => (
            <div key={g} className="bg-secondary/50 rounded-xl p-4 text-center">
              <p className="text-xs text-muted-foreground">Guichê</p>
              <p className="text-2xl font-bold text-foreground">{String(g).padStart(2, '0')}</p>
              <p className="text-lg font-bold text-primary font-mono-data mt-1">{stats.porGuiche[g] || 0}</p>
              <p className="text-[10px] text-muted-foreground">atendimentos</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
