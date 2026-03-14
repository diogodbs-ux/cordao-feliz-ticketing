import { useState, useRef } from 'react';
import { useData } from '@/contexts/DataContext';
import { Button } from '@/components/ui/button';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react';
import Papa from 'papaparse';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export default function AdminImport() {
  const { importarCSV, grupos } = useData();
  const [importing, setImporting] = useState(false);
  const [lastResult, setLastResult] = useState<{ total: number; novos: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setImporting(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete: (result) => {
        const before = grupos.length;
        importarCSV(result.data);
        // Need to wait for state update
        setTimeout(() => {
          const after = JSON.parse(localStorage.getItem('sentinela_grupos') || '[]').length;
          setLastResult({ total: result.data.length, novos: after - before });
          toast.success(`Importação concluída! ${result.data.length} linhas processadas.`);
          setImporting(false);
        }, 200);
      },
      error: () => {
        toast.error('Erro ao processar o arquivo CSV.');
        setImporting(false);
      },
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Importar Dados</h1>
        <p className="text-sm text-muted-foreground">Importe a planilha de agendamento exportada do sistema</p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        className="bg-card rounded-xl shadow-card border-2 border-dashed border-border hover:border-primary/50 transition-colors p-12 text-center cursor-pointer"
        onClick={() => fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-lg font-medium text-foreground">Arraste o arquivo CSV aqui</p>
        <p className="text-sm text-muted-foreground mt-1">ou clique para selecionar o arquivo</p>
        <p className="text-xs text-muted-foreground mt-4">Formato esperado: relatório exportado do sistema de agendamento</p>
      </div>

      {importing && (
        <div className="flex items-center gap-3 bg-primary/5 rounded-xl p-4">
          <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-foreground">Processando importação...</span>
        </div>
      )}

      {lastResult && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-xl shadow-card p-6 flex items-start gap-4"
        >
          <CheckCircle2 className="h-6 w-6 text-cordao-verde flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Importação Concluída</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {lastResult.total} linha(s) processada(s), {lastResult.novos} novo(s) grupo(s) adicionado(s).
            </p>
          </div>
        </motion.div>
      )}

      {/* Current data stats */}
      <div className="bg-card rounded-xl shadow-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
          Base Atual
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-2xl font-bold text-foreground font-mono-data">{grupos.length}</p>
            <p className="text-xs text-muted-foreground">Grupos</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground font-mono-data">
              {grupos.reduce((a, g) => a + g.responsavel.criancas.length, 0)}
            </p>
            <p className="text-xs text-muted-foreground">Crianças</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground font-mono-data">
              {grupos.filter(g => g.checkinRealizado).length}
            </p>
            <p className="text-xs text-muted-foreground">Check-ins</p>
          </div>
        </div>

        {grupos.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                if (confirm('Tem certeza que deseja limpar toda a base de dados?')) {
                  localStorage.removeItem('sentinela_grupos');
                  localStorage.removeItem('sentinela_checkins');
                  window.location.reload();
                }
              }}
            >
              <AlertCircle className="h-3.5 w-3.5 mr-1.5" />
              Limpar Base
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
