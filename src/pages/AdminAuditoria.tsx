import { useEffect, useMemo, useState } from 'react';
import { AuditoriaEvento, readAuditoria, subscribeAuditoria, limparAuditoria } from '@/lib/auditoria';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, Trash2, AlertTriangle, CheckCircle2, Download, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const ACAO_COR: Record<string, string> = {
  'cordao.vincular.ok': 'text-cordao-verde bg-cordao-verde/10',
  'cordao.vincular.erro': 'text-cordao-vermelho bg-cordao-vermelho/10',
  'cordao.vincular.conflito_protocolo': 'text-cordao-vermelho bg-cordao-vermelho/15',
  'cordao.entrada.ok': 'text-primary bg-primary/10',
  'cordao.entrada.erro': 'text-cordao-vermelho bg-cordao-vermelho/10',
  'ciclo.iniciar': 'text-primary bg-primary/10',
  'ciclo.finalizar': 'text-cordao-verde bg-cordao-verde/10',
  'ciclo.descartar': 'text-muted-foreground bg-secondary',
  'checkin.confirmar': 'text-cordao-verde bg-cordao-verde/10',
};

export default function AdminAuditoria() {
  const [eventos, setEventos] = useState<AuditoriaEvento[]>([]);
  const [busca, setBusca] = useState('');
  const [filtroAcao, setFiltroAcao] = useState<string>('todas');
  const hojeISO = new Date().toLocaleDateString('en-CA');
  const [data, setData] = useState<string>(hojeISO);
  const [todasDatas, setTodasDatas] = useState(false);

  useEffect(() => {
    const refresh = () => setEventos(readAuditoria());
    refresh();
    return subscribeAuditoria(refresh);
  }, []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return eventos.filter(e => {
      if (filtroAcao !== 'todas' && e.acao !== filtroAcao) return false;
      if (!todasDatas) {
        const d = new Date(e.quando).toLocaleDateString('en-CA');
        if (d !== data) return false;
      }
      if (q && !`${e.codigo} ${e.protocolo} ${e.usuarioNome} ${e.espacoNome} ${e.membroNome} ${e.detalhe}`.toLowerCase().includes(q)) return false;
      return true;
    }).slice().reverse();
  }, [eventos, busca, filtroAcao, data, todasDatas]);

  const stats = useMemo(() => {
    const total = filtrados.length;
    const conflitos = filtrados.filter(e => e.acao === 'cordao.vincular.conflito_protocolo').length;
    const erros = filtrados.filter(e => e.acao.endsWith('.erro')).length;
    const ok = filtrados.filter(e => e.acao.endsWith('.ok')).length;
    return { total, conflitos, erros, ok };
  }, [filtrados]);

  const exportarCSV = () => {
    if (!filtrados.length) { toast.error('Nada para exportar'); return; }
    const rows = [['Data/Hora', 'Ação', 'Usuário', 'Papel', 'Cordão', 'Protocolo', 'Protocolo Correto', 'Espaço', 'Membro', 'Detalhe']];
    filtrados.forEach(e => rows.push([
      new Date(e.quando).toLocaleString('pt-BR'), e.acao,
      e.usuarioNome || '', e.usuarioRole || '', e.codigo || '', e.protocolo || '',
      e.protocoloEsperado || '', e.espacoNome || '', e.membroNome || '', e.detalhe || '',
    ]));
    const csv = rows.map(r => r.map(f => `"${String(f).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `auditoria-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Shield className="h-6 w-6 text-primary" /> Log de Auditoria</h1>
          <p className="text-sm text-muted-foreground">Quem fez o quê: vínculos, entradas em espaços, conflitos e ciclos.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportarCSV} className="gap-2"><Download className="h-4 w-4" /> CSV</Button>
          <Button variant="outline" onClick={() => { if (confirm('Limpar todo o log de auditoria local?')) { limparAuditoria(); toast.success('Log limpo'); } }} className="gap-2 text-destructive">
            <Trash2 className="h-4 w-4" /> Limpar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <CardStat label="Eventos" value={stats.total} />
        <CardStat label="Sucesso" value={stats.ok} tone="ok" />
        <CardStat label="Erros" value={stats.erros} tone="erro" />
        <CardStat label="Conflitos de protocolo" value={stats.conflitos} tone="erro" icon={<AlertTriangle className="h-3.5 w-3.5" />} />
      </div>

      <div className="bg-card rounded-xl shadow-card p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por cordão, protocolo, usuário, espaço…" className="pl-9" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Ação</label>
            <Select value={filtroAcao} onValueChange={setFiltroAcao}>
              <SelectTrigger className="h-9 w-[240px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as ações</SelectItem>
                <SelectItem value="cordao.vincular.ok">Vínculo OK</SelectItem>
                <SelectItem value="cordao.vincular.erro">Vínculo com erro</SelectItem>
                <SelectItem value="cordao.vincular.conflito_protocolo">Conflito de protocolo</SelectItem>
                <SelectItem value="cordao.entrada.ok">Entrada em espaço OK</SelectItem>
                <SelectItem value="cordao.entrada.erro">Entrada com erro</SelectItem>
                <SelectItem value="ciclo.iniciar">Ciclo iniciado</SelectItem>
                <SelectItem value="ciclo.finalizar">Ciclo finalizado</SelectItem>
                <SelectItem value="ciclo.descartar">Ciclo descartado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Data</label>
            <Input type="date" value={data} onChange={e => setData(e.target.value)} disabled={todasDatas} className="h-9 w-[160px]" />
          </div>
          <Button size="sm" variant={todasDatas ? 'default' : 'outline'} onClick={() => setTodasDatas(s => !s)}>
            {todasDatas ? 'Todos os dias' : 'Apenas dia selecionado'}
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        {filtrados.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Nenhum evento encontrado para os filtros aplicados.</div>
        ) : (
          <div className="divide-y divide-border max-h-[60vh] overflow-auto">
            {filtrados.map(e => (
              <div key={e.id} className="p-4 flex items-start gap-3 text-sm">
                <span className={cn('px-2 py-1 rounded-md text-[10px] font-bold whitespace-nowrap', ACAO_COR[e.acao] || 'bg-secondary text-muted-foreground')}>
                  {e.acao.replace('cordao.', '').replace('ciclo.', '')}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 items-baseline">
                    {e.codigo && <span className="font-mono-data font-bold text-foreground">{e.codigo}</span>}
                    {e.membroNome && <span className="text-foreground">{e.membroNome}</span>}
                    {e.protocolo && <span className="text-xs text-muted-foreground">protocolo {e.protocolo}</span>}
                    {e.protocoloEsperado && <span className="text-xs text-cordao-vermelho font-semibold">✗ correto: {e.protocoloEsperado}</span>}
                    {e.espacoNome && <span className="text-xs text-muted-foreground">em {e.espacoNome}</span>}
                  </div>
                  {e.detalhe && <p className="text-xs text-muted-foreground mt-1">{e.detalhe}</p>}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {new Date(e.quando).toLocaleString('pt-BR')} · {e.usuarioNome || 'sistema'} {e.usuarioRole ? `(${e.usuarioRole})` : ''}
                  </p>
                </div>
                {e.acao.endsWith('.ok') ? <CheckCircle2 className="h-4 w-4 text-cordao-verde flex-shrink-0" /> :
                 e.acao.endsWith('.erro') || e.acao.includes('conflito') ? <AlertTriangle className="h-4 w-4 text-cordao-vermelho flex-shrink-0" /> : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CardStat({ label, value, tone, icon }: { label: string; value: number; tone?: 'ok' | 'erro'; icon?: React.ReactNode }) {
  return (
    <div className={cn('rounded-xl p-4 border bg-card shadow-card',
      tone === 'ok' && 'border-cordao-verde/30',
      tone === 'erro' && 'border-cordao-vermelho/30')}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">{icon} {label}</p>
      <p className={cn('text-3xl font-bold font-mono-data mt-1',
        tone === 'ok' && 'text-cordao-verde',
        tone === 'erro' && 'text-cordao-vermelho',
        !tone && 'text-foreground')}>{value}</p>
    </div>
  );
}
