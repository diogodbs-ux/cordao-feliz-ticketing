import { useState, useMemo, useRef } from 'react';
import { useData } from '@/contexts/DataContext';
import { Button } from '@/components/ui/button';
import { Download, FileText, Calendar, Clock, Users, Baby, Accessibility, FileDown, BarChart3 } from 'lucide-react';
import { getCordaoLabel, CordaoColor, calcAdultCordoes, PeriodoFiltro, filtrarPorPeriodo, getCordaoTailwindBg, getCordaoTailwindText } from '@/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { gerarRelatorioFinalPDF } from '@/lib/relatorioPdf';

const CORDAO_HEX: Record<CordaoColor, string> = {
  azul: '#4A90D9', verde: '#3CB371', amarelo: '#F5C518',
  vermelho: '#E74C3C', rosa: '#E96D9B', cinza: '#6B7B8D', preto: '#1E293B',
};

const PERIODOS: { value: PeriodoFiltro; label: string }[] = [
  { value: 'hoje', label: 'Hoje' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mês' },
  { value: 'ano', label: 'Ano' },
  { value: 'todos', label: 'Todos' },
];

export default function AdminRelatorios() {
  const { grupos, checkins, stats } = useData();
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('hoje');
  const reportRef = useRef<HTMLDivElement>(null);

  const hoje = new Date().toLocaleDateString('pt-BR');

  const filteredCheckins = useMemo(() =>
    filtrarPorPeriodo(checkins, periodo, 'dataHora'),
  [checkins, periodo]);

  const filteredGrupos = useMemo(() => {
    const ids = new Set(filteredCheckins.map(c => c.grupoVisitaId));
    return grupos.filter(g => ids.has(g.id));
  }, [grupos, filteredCheckins]);

  const reportStats = useMemo(() => {
    const porCor: Record<CordaoColor, number> = { azul: 0, verde: 0, amarelo: 0, vermelho: 0, rosa: 0, cinza: 0, preto: 0 };
    const porGuiche: Record<number, number> = {};
    let totalPCD = 0;
    let totalAdultos = 0;

    filteredGrupos.forEach(g => {
      const numAdultos = calcAdultCordoes(g.responsavel.criancas.length);
      totalAdultos += numAdultos;
      porCor.rosa += numAdultos;
      g.responsavel.criancas.forEach(c => {
        porCor[c.cordaoCor] = (porCor[c.cordaoCor] || 0) + 1;
        if (c.pcd) totalPCD++;
      });
      if (g.guiche) porGuiche[g.guiche] = (porGuiche[g.guiche] || 0) + 1;
    });

    const totalCriancas = filteredGrupos.reduce((a, g) => a + g.responsavel.criancas.length, 0);
    const totalVisitantes = totalAdultos + totalCriancas;

    // Time stats
    let primeiroCheckin = '';
    let ultimoCheckin = '';
    let tempoOperacao = '';
    if (filteredCheckins.length > 0) {
      const sorted = [...filteredCheckins].sort((a, b) => new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime());
      const first = new Date(sorted[0].dataHora);
      const last = new Date(sorted[sorted.length - 1].dataHora);
      primeiroCheckin = first.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      ultimoCheckin = last.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const diffMs = last.getTime() - first.getTime();
      const hours = Math.floor(diffMs / 3600000);
      const mins = Math.floor((diffMs % 3600000) / 60000);
      tempoOperacao = `${hours}h${String(mins).padStart(2, '0')}min`;
    }

    // Avg per booth
    const guicheEntries = Object.entries(porGuiche);
    const avgPerGuiche = guicheEntries.length > 0
      ? Math.round(guicheEntries.reduce((a, [, v]) => a + v, 0) / guicheEntries.length)
      : 0;

    // Hourly distribution
    const hourly: Record<number, number> = {};
    filteredCheckins.forEach(c => {
      const h = new Date(c.dataHora).getHours();
      hourly[h] = (hourly[h] || 0) + 1;
    });

    // Origem breakdown
    const porOrigem: Record<string, number> = {};
    filteredGrupos.forEach(g => {
      const o = g.origem || 'agendamento';
      porOrigem[o] = (porOrigem[o] || 0) + 1;
    });

    return {
      totalVisitantes, totalCriancas, totalAdultos,
      totalResponsaveis: filteredGrupos.length,
      totalPCD, porCor, porGuiche,
      primeiroCheckin, ultimoCheckin, tempoOperacao,
      avgPerGuiche, hourly, porOrigem,
      totalCordoes: Object.values(porCor).reduce((a, b) => a + b, 0),
    };
  }, [filteredGrupos, filteredCheckins]);

  const gruposHoje = useMemo(() =>
    grupos.filter(g => {
      if (g.dataAgendamento) return g.dataAgendamento === hoje;
      return new Date(g.criadoEm).toLocaleDateString('pt-BR') === hoje;
    }),
  [grupos, hoje]);

  const pendentes = gruposHoje.filter(g => !g.checkinRealizado).length;

  const porCorData = Object.entries(reportStats.porCor)
    .filter(([, v]) => v > 0)
    .map(([cor, qtd]) => ({ name: getCordaoLabel(cor as CordaoColor), value: qtd, fill: CORDAO_HEX[cor as CordaoColor] }));

  const porGuicheData = [1, 2, 3, 4, 5, 6].map(g => ({
    name: `G${g}`, atendimentos: reportStats.porGuiche[g] || 0,
  }));

  const hourlyData = Object.entries(reportStats.hourly)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([h, count]) => ({ hora: `${h}h`, visitantes: count }));

  const exportCSV = () => {
    const rows = [['Responsável', 'Contato', 'Email', 'Bairro', 'Cidade', 'UF', 'Crianças', 'PCD', 'Guichê', 'Atendido Por', 'Data/Hora', 'Cordões', 'Origem']];
    filteredCheckins.forEach(c => {
      const grupo = grupos.find(g => g.id === c.grupoVisitaId);
      rows.push([
        c.responsavelNome,
        grupo?.responsavel.contato || '',
        grupo?.responsavel.email || '',
        grupo?.responsavel.bairro || '',
        grupo?.responsavel.cidade || '',
        grupo?.responsavel.uf || '',
        c.totalCriancas.toString(),
        grupo?.responsavel.criancas.filter(cr => cr.pcd).length.toString() || '0',
        c.guiche.toString(),
        c.atendidoPor,
        new Date(c.dataHora).toLocaleString('pt-BR'),
        c.cordoes.map(co => `${co.quantidade}x ${co.cor}`).join(', '),
        grupo?.origem || 'agendamento',
      ]);
    });
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-operacao-${periodo}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Relatório CSV exportado com sucesso!');
  };

  const printReport = () => {
    window.print();
  };

  const exportSummaryTxt = () => {
    const lines = [
      `═══════════════════════════════════════════`,
      `  RELATÓRIO FINAL DE OPERAÇÃO`,
      `  Cidade Mais Infância — Sentinela`,
      `  Período: ${PERIODOS.find(p => p.value === periodo)?.label} — ${hoje}`,
      `═══════════════════════════════════════════`,
      ``,
      `RESUMO GERAL`,
      `─────────────────────────────────`,
      `  Total de Visitantes:    ${reportStats.totalVisitantes}`,
      `  Adultos (Rosa):         ${reportStats.totalAdultos}`,
      `  Crianças:               ${reportStats.totalCriancas}`,
      `  Responsáveis:           ${reportStats.totalResponsaveis}`,
      `  Visitantes PCD:         ${reportStats.totalPCD}`,
      `  Total Cordões Entregues:${reportStats.totalCordoes}`,
      `  Pendentes (hoje):       ${pendentes}`,
      ``,
      `OPERAÇÃO`,
      `─────────────────────────────────`,
      `  Primeiro Check-in:      ${reportStats.primeiroCheckin || 'N/A'}`,
      `  Último Check-in:        ${reportStats.ultimoCheckin || 'N/A'}`,
      `  Tempo de Operação:      ${reportStats.tempoOperacao || 'N/A'}`,
      `  Média por Guichê:       ${reportStats.avgPerGuiche}`,
      ``,
      `CONTAGEM DE CORDÕES`,
      `─────────────────────────────────`,
      ...Object.entries(reportStats.porCor).map(([cor, qtd]) =>
        `  ${getCordaoLabel(cor as CordaoColor).padEnd(28)}${qtd}`
      ),
      `  ${'─'.repeat(33)}`,
      `  ${'TOTAL'.padEnd(28)}${reportStats.totalCordoes}`,
      ``,
      `PERFORMANCE POR GUICHÊ`,
      `─────────────────────────────────`,
      ...[1, 2, 3, 4, 5, 6].map(g =>
        `  Guichê ${String(g).padStart(2, '0')}:               ${reportStats.porGuiche[g] || 0} atendimentos`
      ),
      ``,
      `═══════════════════════════════════════════`,
      `  Gerado em: ${new Date().toLocaleString('pt-BR')}`,
      `═══════════════════════════════════════════`,
    ];

    const txt = lines.join('\n');
    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-final-${periodo}-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Relatório final exportado!');
  };

  return (
    <div className="p-6 space-y-6 print:p-0">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatório Final de Operação</h1>
          <p className="text-sm text-muted-foreground">Contagem oficial e saldo de visitantes</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-card rounded-xl shadow-card p-1 mr-2">
            {PERIODOS.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriodo(p.value)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  periodo === p.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Button variant="outline" onClick={printReport} className="gap-2">
            <Printer className="h-4 w-4" />
            Imprimir
          </Button>
          <Button variant="outline" onClick={exportSummaryTxt} className="gap-2">
            <FileText className="h-4 w-4" />
            Relatório TXT
          </Button>
          <Button onClick={exportCSV} className="gap-2" disabled={filteredCheckins.length === 0}>
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Print header */}
      <div className="hidden print:block text-center mb-6">
        <h1 className="text-xl font-bold">Relatório Final de Operação — Cidade Mais Infância</h1>
        <p className="text-sm text-muted-foreground">{PERIODOS.find(p => p.value === periodo)?.label} — {hoje}</p>
      </div>

      {/* Big summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" ref={reportRef}>
        <div className="bg-card rounded-xl shadow-card p-5 text-center">
          <Users className="h-5 w-5 text-primary mx-auto mb-2" />
          <p className="text-4xl font-bold text-foreground font-mono-data">{reportStats.totalVisitantes}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Total Visitantes</p>
        </div>
        <div className="bg-card rounded-xl shadow-card p-5 text-center">
          <Baby className="h-5 w-5 text-cordao-verde mx-auto mb-2" />
          <p className="text-4xl font-bold text-foreground font-mono-data">{reportStats.totalCriancas}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Crianças</p>
        </div>
        <div className="bg-card rounded-xl shadow-card p-5 text-center">
          <Users className="h-5 w-5 text-cordao-rosa mx-auto mb-2" />
          <p className="text-4xl font-bold text-foreground font-mono-data">{reportStats.totalAdultos}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Adultos (Rosa)</p>
        </div>
        <div className="bg-card rounded-xl shadow-card p-5 text-center">
          <Accessibility className="h-5 w-5 text-primary mx-auto mb-2" />
          <p className="text-4xl font-bold text-foreground font-mono-data">{reportStats.totalPCD}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">PCD Atendidos</p>
        </div>
      </div>

      {/* Operation time */}
      <div className="bg-card rounded-xl shadow-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Dados da Operação
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Primeiro Check-in', value: reportStats.primeiroCheckin || '—' },
            { label: 'Último Check-in', value: reportStats.ultimoCheckin || '—' },
            { label: 'Tempo de Operação', value: reportStats.tempoOperacao || '—' },
            { label: 'Média/Guichê', value: `${reportStats.avgPerGuiche} atend.` },
            { label: 'Pendentes (Hoje)', value: String(pendentes) },
          ].map(item => (
            <div key={item.label} className="text-center">
              <p className="text-xl font-bold text-foreground font-mono-data">{item.value}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Cordão count - official */}
      <div className="bg-card rounded-xl shadow-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          Contagem Oficial de Cordões — {PERIODOS.find(p => p.value === periodo)?.label}
        </h3>
        <div className="space-y-3">
          {(Object.entries(reportStats.porCor) as [CordaoColor, number][]).map(([cor, qtd]) => (
            <div key={cor} className="flex items-center gap-4">
              <div className={cn('h-6 w-6 rounded-full flex-shrink-0', getCordaoTailwindBg(cor))} />
              <span className="text-sm text-foreground w-52">{getCordaoLabel(cor)}</span>
              <div className="flex-1 bg-secondary rounded-full h-7 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 flex items-center justify-end pr-2"
                  style={{
                    width: `${reportStats.totalCordoes > 0 ? Math.max((qtd / reportStats.totalCordoes * 100), qtd > 0 ? 8 : 0) : 0}%`,
                    backgroundColor: CORDAO_HEX[cor],
                  }}
                >
                  {qtd > 0 && <span className={cn('text-xs font-bold', getCordaoTailwindText(cor))}>{qtd}</span>}
                </div>
              </div>
              <span className="text-lg font-bold text-foreground font-mono-data w-12 text-right">{qtd}</span>
            </div>
          ))}
          <div className="pt-4 border-t border-border flex items-center justify-between">
            <span className="text-base font-bold text-foreground">Total de Cordões Entregues</span>
            <span className="text-3xl font-bold text-primary font-mono-data">{reportStats.totalCordoes}</span>
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie chart */}
        <div className="bg-card rounded-xl shadow-card p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            Distribuição Visual
          </h3>
          {porCorData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={porCorData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={110} paddingAngle={3}>
                  {porCorData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
          )}
        </div>

        {/* Hourly chart */}
        <div className="bg-card rounded-xl shadow-card p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Fluxo por Hora
          </h3>
          {hourlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="hora" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="visitantes" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Visitantes" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
          )}
        </div>
      </div>

      {/* Guichê performance */}
      <div className="bg-card rounded-xl shadow-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          Performance por Guichê
        </h3>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
          {porGuicheData.map((g, i) => (
            <div key={i} className="bg-secondary/50 rounded-xl p-4 text-center">
              <p className="text-xs text-muted-foreground">Guichê</p>
              <p className="text-2xl font-bold text-foreground">{String(i + 1).padStart(2, '0')}</p>
              <p className="text-2xl font-bold text-primary font-mono-data mt-1">{g.atendimentos}</p>
              <p className="text-[10px] text-muted-foreground">atendimentos</p>
            </div>
          ))}
        </div>
      </div>

      {/* Detailed checkin log */}
      <div className="bg-card rounded-xl shadow-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          Registro Detalhado de Check-ins ({filteredCheckins.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">Responsável</th>
                <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">Bairro/Cidade</th>
                <th className="text-center py-2 px-3 text-xs text-muted-foreground font-medium">Crianças</th>
                <th className="text-center py-2 px-3 text-xs text-muted-foreground font-medium">Guichê</th>
                <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">Atendente</th>
                <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">Horário</th>
                <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">Cordões</th>
              </tr>
            </thead>
            <tbody>
              {filteredCheckins.slice(-50).reverse().map(c => {
                const grupo = grupos.find(g => g.id === c.grupoVisitaId);
                return (
                  <tr key={c.id} className="border-b border-border/50 hover:bg-secondary/20">
                    <td className="py-2 px-3 font-medium text-foreground">{c.responsavelNome}</td>
                    <td className="py-2 px-3 text-muted-foreground text-xs">
                      {grupo ? `${grupo.responsavel.bairro}, ${grupo.responsavel.cidade}` : '—'}
                    </td>
                    <td className="py-2 px-3 text-center font-mono-data">{c.totalCriancas}</td>
                    <td className="py-2 px-3 text-center font-mono-data">{String(c.guiche).padStart(2, '0')}</td>
                    <td className="py-2 px-3 text-muted-foreground text-xs">{c.atendidoPor}</td>
                    <td className="py-2 px-3 text-muted-foreground text-xs">
                      {new Date(c.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex gap-1">
                        {c.cordoes.map((co, i) => (
                          <span
                            key={i}
                            className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full', getCordaoTailwindBg(co.cor), getCordaoTailwindText(co.cor))}
                          >
                            {co.quantidade}x
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredCheckins.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum check-in no período</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
