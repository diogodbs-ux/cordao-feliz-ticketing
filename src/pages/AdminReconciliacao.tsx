import { useMemo, useState, useEffect } from 'react';
import { useData } from '@/contexts/DataContext';
import { Button } from '@/components/ui/button';
import DataOperacionalPicker from '@/components/DataOperacionalPicker';
import { reconciliar, TIPO_LABEL, Divergencia } from '@/lib/reconciliacao';
import { readModulos, subscribeModulos, writeModulos } from '@/lib/modulos';
import { subscribeCordoesChange } from '@/types/cordoes';
import { subscribeEspacosChange } from '@/types/espacos';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, Download, ListChecks, RefreshCw, ShieldAlert, Info } from 'lucide-react';
import { toast } from 'sonner';

function hojeBR(): string {
  const n = new Date();
  return `${String(n.getDate()).padStart(2, '0')}/${String(n.getMonth() + 1).padStart(2, '0')}/${n.getFullYear()}`;
}

const SEV_STYLE: Record<Divergencia['severidade'], string> = {
  critico: 'border-destructive/40 bg-destructive/5',
  atencao: 'border-cordao-amarelo/50 bg-cordao-amarelo/5',
  info: 'border-border bg-secondary/30',
};

const PASSOS = [
  {
    titulo: '1. Importar a planilha do dia',
    detalhe: 'Administração → Importar Dados. Confira se a data de agendamento é a data operacional de hoje.',
    valida: 'Check-in (Guichê) passa a listar os grupos pendentes; Dashboard mostra o número em “Pendentes”.',
  },
  {
    titulo: '2. Fazer o check-in no guichê',
    detalhe: 'Receptivo → Check-in. Busque o responsável e confirme. O guichê e o operador do usuário logado são gravados no registro.',
    valida: 'Contador “atendidos” do guichê, Dashboard (Total Atendidos / Crianças / Responsáveis) e Painel em Tempo Real.',
  },
  {
    titulo: '3. Vincular os cordões no popup',
    detalhe: 'No popup do cordão, escaneie ou digite o código de cada etiqueta (criança e adultos). Só códigos gerados em Cordões Numerados são aceitos.',
    valida: 'Seção “Atendidos hoje” mostra X/Y cordões; aqui as divergências “sem vínculo” e “vínculo parcial” desaparecem.',
  },
  {
    titulo: '4. Rodar um ciclo em Meu Espaço',
    detalhe: 'Espaços Lúdicos → Meu Espaço: iniciar ciclo, ler os cordões das crianças e finalizar o ciclo.',
    valida: 'Ciclos por Espaço, Heatmap do Parque, Espaços Lúdicos (coordenação) e Jornadas (cordão).',
  },
  {
    titulo: '5. Conferir o fechamento',
    detalhe: 'Fechamento 17h / Relatórios e Consolidado Anual devem bater com os números do Dashboard.',
    valida: 'Relatório Final (PDF/CSV), Consolidado Anual e esta tela sem divergências críticas.',
  },
];

export default function AdminReconciliacao() {
  const { grupos, checkins } = useData();
  const [data, setData] = useState<string>(hojeBR());
  const [tick, setTick] = useState(0);
  const [modulos, setModulos] = useState(() => readModulos());
  const [feitos, setFeitos] = useState<Record<number, boolean>>({});

  useEffect(() => subscribeModulos(() => setModulos(readModulos())), []);
  useEffect(() => subscribeCordoesChange(() => setTick(t => t + 1)), []);
  useEffect(() => subscribeEspacosChange(() => setTick(t => t + 1)), []);

  const res = useMemo(() => reconciliar(data, grupos, checkins), [data, grupos, checkins, tick, modulos]);

  const exportarCSV = () => {
    if (res.divergencias.length === 0) { toast.info('Nenhuma divergência para exportar'); return; }
    const head = ['Tipo', 'Severidade', 'Título', 'Detalhe', 'Protocolo', 'Guichê', 'Operador', 'Ação'];
    const rows = res.divergencias.map(d => [
      TIPO_LABEL[d.tipo], d.severidade, d.titulo, d.detalhe, d.protocolo || '', d.guiche ?? '', d.operador || '', d.acao || '',
    ]);
    const csv = [head, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `reconciliacao_${data.replace(/\//g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Divergências exportadas em CSV');
  };

  const criticos = res.divergencias.filter(d => d.severidade === 'critico').length;
  const atencao = res.divergencias.filter(d => d.severidade === 'atencao').length;

  const grupasPorTipo = useMemo(() => {
    const map = new Map<Divergencia['tipo'], Divergencia[]>();
    res.divergencias.forEach(d => map.set(d.tipo, [...(map.get(d.tipo) || []), d]));
    return Array.from(map.entries());
  }, [res]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reconciliação Operacional</h1>
          <p className="text-sm text-muted-foreground">
            Compara check-ins do guichê × protocolos × cordões vinculados × ciclos de espaço — {data}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <DataOperacionalPicker value={data} onChange={setData} hojeReal={hojeBR()} />
          <Button variant="outline" className="gap-2" onClick={() => setTick(t => t + 1)}>
            <RefreshCw className="h-4 w-4" /> Atualizar
          </Button>
          <Button className="gap-2" onClick={exportarCSV}>
            <Download className="h-4 w-4" /> Exportar CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Grupos do dia', value: res.totalGruposDia },
          { label: 'Check-ins', value: res.totalCheckins },
          { label: 'Cordões vinculados', value: res.totalCordoesVinculados },
          { label: 'Divergências críticas', value: criticos },
          { label: 'Pontos de atenção', value: atencao },
        ].map(c => (
          <div key={c.label} className="bg-card rounded-xl shadow-card p-5">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{c.label}</p>
            <p className="text-3xl font-bold text-foreground font-mono-data mt-2">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Presença estimada por ciclos */}
      <div className="bg-card rounded-xl shadow-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Presença estimada pelos ciclos de espaço</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {res.presencaCiclos.ciclos} ciclo(s) no dia · {res.presencaCiclos.criancas} criança(s) e {res.presencaCiclos.adultos} adulto(s)
              sem check-in no guichê (deduplicado por protocolo).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Contar nos painéis</span>
            <Switch
              checked={modulos.contabilizarCiclosComoPresenca}
              onCheckedChange={v => writeModulos({ ...readModulos(), contabilizarCiclosComoPresenca: v })}
            />
          </div>
        </div>
      </div>

      {/* Divergências */}
      <div className="space-y-4">
        {res.divergencias.length === 0 ? (
          <div className="bg-card rounded-xl shadow-card p-10 text-center">
            <CheckCircle2 className="h-10 w-10 mx-auto text-cordao-verde mb-3" />
            <p className="text-sm font-medium text-foreground">Nenhuma divergência em {data}</p>
            <p className="text-xs text-muted-foreground">Check-ins, protocolos e cordões estão consistentes.</p>
          </div>
        ) : (
          grupasPorTipo.map(([tipo, lista]) => (
            <div key={tipo} className="bg-card rounded-xl shadow-card p-6">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                {lista[0].severidade === 'critico'
                  ? <ShieldAlert className="h-4 w-4 text-destructive" />
                  : lista[0].severidade === 'atencao'
                    ? <AlertTriangle className="h-4 w-4 text-cordao-amarelo" />
                    : <Info className="h-4 w-4 text-muted-foreground" />}
                {TIPO_LABEL[tipo]} <span className="text-muted-foreground font-normal">({lista.length})</span>
              </h3>
              <div className="space-y-2">
                {lista.map(d => (
                  <div key={d.id} className={cn('rounded-lg border p-3', SEV_STYLE[d.severidade])}>
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{d.titulo}</p>
                        <p className="text-xs text-muted-foreground">{d.detalhe}</p>
                        {d.acao && <p className="text-xs text-primary mt-1">→ {d.acao}</p>}
                      </div>
                      <div className="text-right text-[10px] text-muted-foreground font-mono-data">
                        {d.protocolo && <p>#{d.protocolo}</p>}
                        {d.guiche ? <p>Guichê {String(d.guiche).padStart(2, '0')}</p> : null}
                        {d.operador && <p>{d.operador}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Passo a passo de teste operacional */}
      <div className="bg-card rounded-xl shadow-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-primary" />
          Teste operacional ponta a ponta
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Siga na ordem e marque cada passo. Depois de cada passo, confira as telas indicadas — os números devem bater.
        </p>
        <div className="space-y-2">
          {PASSOS.map((p, i) => (
            <label
              key={p.titulo}
              className={cn(
                'flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
                feitos[i] ? 'border-cordao-verde/40 bg-cordao-verde/5' : 'border-border bg-secondary/20'
              )}
            >
              <input
                type="checkbox"
                checked={!!feitos[i]}
                onChange={e => setFeitos(f => ({ ...f, [i]: e.target.checked }))}
                className="mt-0.5 h-4 w-4 accent-current"
              />
              <div className="min-w-0">
                <p className={cn('text-sm font-medium', feitos[i] ? 'text-muted-foreground line-through' : 'text-foreground')}>{p.titulo}</p>
                <p className="text-xs text-muted-foreground">{p.detalhe}</p>
                <p className="text-xs text-primary mt-1">Deve atualizar: {p.valida}</p>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
