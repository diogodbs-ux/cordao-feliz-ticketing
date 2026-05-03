import { useEffect, useMemo, useState } from 'react';
import { CicloEspaco, EspacoLudico, JornadaProtocolo, buildJornadas, readCiclos, readEspacos } from '@/types/espacos';
import { CordaoColor, getCordaoLabel } from '@/types';
import { MapPin, Activity, Users, Clock, TrendingUp, AlertTriangle, Search, Route } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

const COR_HEX: Record<CordaoColor, string> = {
  azul: '#4A90D9', verde: '#3CB371', amarelo: '#F5C518',
  vermelho: '#E74C3C', rosa: '#E96D9B', cinza: '#6B7B8D', preto: '#1E293B',
};

function diffMin(a: string, b: string) {
  return (new Date(b).getTime() - new Date(a).getTime()) / 60000;
}

export default function CoordenadorEspacos() {
  const [espacos, setEspacos] = useState<EspacoLudico[]>([]);
  const [ciclos, setCiclos] = useState<CicloEspaco[]>([]);
  const [, setTick] = useState(0);
  const [busca, setBusca] = useState('');

  useEffect(() => {
    const reload = () => {
      setEspacos(readEspacos());
      setCiclos(readCiclos());
    };
    reload();
    const i = setInterval(reload, 5000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    const i = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(i);
  }, []);

  const hojeStr = new Date().toLocaleDateString('pt-BR');
  const ciclosHoje = useMemo(() =>
    ciclos.filter(c => new Date(c.inicio).toLocaleDateString('pt-BR') === hojeStr),
  [ciclos, hojeStr]);

  const ciclosAtivos = useMemo(() => ciclosHoje.filter(c => !c.fim), [ciclosHoje]);

  // Por espaço: total criancas, ciclos, tempo médio, capacidade, ocupação atual
  const porEspaco = useMemo(() => {
    return espacos.map(e => {
      const cs = ciclosHoje.filter(c => c.espacoId === e.id);
      const ativos = cs.filter(c => !c.fim);
      const finalizados = cs.filter(c => c.fim);
      const totCriancas = cs.reduce((a, c) => a + c.totalCriancas, 0);
      const totAdultos = cs.reduce((a, c) => a + c.totalAdultos, 0);
      const tempoMedio = finalizados.length > 0
        ? finalizados.reduce((a, c) => a + diffMin(c.inicio, c.fim!), 0) / finalizados.length
        : 0;
      const ocupacaoAtual = ativos.reduce((a, c) => a + c.totalCriancas, 0);
      const cap = e.capacidadeCiclo || 0;
      const ocupacaoPct = cap > 0 ? (ocupacaoAtual / cap) * 100 : 0;
      return {
        espaco: e, totalCiclos: cs.length, totCriancas, totAdultos,
        tempoMedio, ocupacaoAtual, ocupacaoPct, ativosCount: ativos.length, cs,
      };
    });
  }, [espacos, ciclosHoje]);

  const ranking = useMemo(() =>
    [...porEspaco].sort((a, b) => b.totCriancas - a.totCriancas),
  [porEspaco]);

  const totaisDia = useMemo(() => ({
    ciclos: ciclosHoje.length,
    ativos: ciclosAtivos.length,
    criancas: ciclosHoje.reduce((a, c) => a + c.totalCriancas, 0),
    adultos: ciclosHoje.reduce((a, c) => a + c.totalAdultos, 0),
  }), [ciclosHoje, ciclosAtivos]);

  // Distribuição por cor (hoje)
  const distCor = useMemo(() => {
    const acc: Record<string, number> = {};
    ciclosHoje.forEach(c => {
      Object.entries(c.porCor).forEach(([cor, q]) => {
        acc[cor] = (acc[cor] || 0) + (q || 0);
      });
    });
    return Object.entries(acc).map(([cor, q]) => ({ cor, q, fill: COR_HEX[cor as CordaoColor] || '#888' }));
  }, [ciclosHoje]);

  // Jornadas (rastreio criança→espaços via protocolo)
  const jornadas = useMemo(() => {
    const map = buildJornadas(ciclosHoje);
    return Array.from(map.values());
  }, [ciclosHoje]);

  const jornadasFiltradas = useMemo(() => {
    if (!busca.trim()) return jornadas;
    const q = busca.toLowerCase();
    return jornadas.filter(j =>
      j.protocolo.toLowerCase().includes(q) ||
      (j.responsavelNome || '').toLowerCase().includes(q)
    );
  }, [jornadas, busca]);

  const alertas = useMemo(() => {
    const out: { tipo: string; msg: string; sev: 'warn' | 'crit' }[] = [];
    porEspaco.forEach(p => {
      if (p.ocupacaoPct >= 100) out.push({ tipo: 'lotacao', sev: 'crit', msg: `${p.espaco.nome}: superlotação (${p.ocupacaoAtual}/${p.espaco.capacidadeCiclo})` });
      else if (p.ocupacaoPct >= 80) out.push({ tipo: 'lotacao', sev: 'warn', msg: `${p.espaco.nome}: ocupação alta (${p.ocupacaoPct.toFixed(0)}%)` });
    });
    return out;
  }, [porEspaco]);

  if (espacos.length === 0) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center">
        <MapPin className="h-12 w-12 mx-auto text-muted-foreground opacity-30 mb-3" />
        <h2 className="text-lg font-semibold text-foreground">Nenhum espaço cadastrado</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Cadastre os espaços lúdicos em <strong>Admin → Espaços Lúdicos</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <MapPin className="h-6 w-6 text-primary" /> Espaços Lúdicos — Coordenação
        </h1>
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Activity className="h-3 w-3 text-cordao-verde animate-pulse" /> Tempo real · {hojeStr}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Ciclos hoje" value={totaisDia.ciclos} icon={<Clock className="h-4 w-4" />} />
        <Kpi label="Ciclos ativos" value={totaisDia.ativos} icon={<Activity className="h-4 w-4 text-cordao-verde" />} accent />
        <Kpi label="Crianças atendidas" value={totaisDia.criancas} icon={<Users className="h-4 w-4" />} />
        <Kpi label="Adultos" value={totaisDia.adultos} icon={<Users className="h-4 w-4" />} />
      </div>

      {/* Alertas */}
      {alertas.length > 0 && (
        <div className="bg-card rounded-xl shadow-card p-5 border-l-4 border-cordao-vermelho">
          <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-cordao-vermelho" /> Alertas de Ocupação
          </h3>
          <div className="space-y-1">
            {alertas.map((a, i) => (
              <p key={i} className={cn('text-xs', a.sev === 'crit' ? 'text-cordao-vermelho font-semibold' : 'text-cordao-amarelo')}>
                • {a.msg}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Ranking + Ocupação atual */}
      <div className="bg-card rounded-xl shadow-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          Ranking — Espaços mais visitados hoje
        </h3>
        <div className="space-y-2">
          {ranking.map((p, i) => (
            <div key={p.espaco.id} className="flex items-center gap-3 py-2 border-b border-border/40 last:border-0">
              <span className="text-xs font-bold text-muted-foreground w-6">{i + 1}.</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{p.espaco.nome}</p>
                <p className="text-[10px] text-muted-foreground">
                  {p.totalCiclos} ciclos · tempo médio {p.tempoMedio > 0 ? `${p.tempoMedio.toFixed(0)} min` : '—'}
                  {p.ativosCount > 0 && <span className="ml-2 text-cordao-verde">● {p.ativosCount} ativo(s)</span>}
                </p>
              </div>
              <div className="w-32">
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${ranking[0].totCriancas > 0 ? (p.totCriancas / ranking[0].totCriancas) * 100 : 0}%` }} />
                </div>
              </div>
              <div className="text-right w-20">
                <p className="text-lg font-bold font-mono-data text-foreground">{p.totCriancas}</p>
                <p className="text-[9px] text-muted-foreground uppercase">crianças</p>
              </div>
              {p.espaco.capacidadeCiclo ? (
                <div className="text-right w-24">
                  <p className={cn('text-xs font-bold font-mono-data',
                    p.ocupacaoPct >= 100 ? 'text-cordao-vermelho' : p.ocupacaoPct >= 80 ? 'text-cordao-amarelo' : 'text-muted-foreground')}>
                    {p.ocupacaoAtual}/{p.espaco.capacidadeCiclo}
                  </p>
                  <p className="text-[9px] text-muted-foreground">ocup. atual</p>
                </div>
              ) : <div className="w-24" />}
            </div>
          ))}
        </div>
      </div>

      {/* Distribuição por cor */}
      {distCor.length > 0 && (
        <div className="bg-card rounded-xl shadow-card p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Crianças por cor de cordão (todos os espaços, hoje)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={distCor}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="cor" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="q" radius={[4, 4, 0, 0]}>
                {distCor.map((d, i) => <Bar key={i} dataKey="q" fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 justify-center mt-2">
            {distCor.map(d => (
              <div key={d.cor} className="flex items-center gap-1.5 text-xs">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.fill }} />
                <span className="text-muted-foreground">{getCordaoLabel(d.cor as CordaoColor).split(' ')[0]}: <strong className="text-foreground">{d.q}</strong></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Jornadas (rastreio criança→espaços) */}
      <div className="bg-card rounded-xl shadow-card p-6">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Route className="h-4 w-4 text-muted-foreground" />
            Jornadas — rastreio por protocolo ({jornadas.length} grupos hoje)
          </h3>
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Buscar protocolo ou responsável..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="pl-8 h-9 w-72 text-sm"
            />
          </div>
        </div>
        {jornadasFiltradas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {jornadas.length === 0
              ? 'Nenhum protocolo registrado nos espaços hoje. Os recreadores de espaço podem digitar o protocolo do grupo ao iniciar/finalizar o ciclo.'
              : 'Nenhum resultado para a busca.'}
          </p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-auto">
            {jornadasFiltradas.slice(0, 50).map(j => <JornadaItem key={j.protocolo} j={j} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function JornadaItem({ j }: { j: JornadaProtocolo }) {
  return (
    <div className="bg-secondary/30 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground truncate">
            {j.responsavelNome || '(sem nome)'} <span className="text-xs font-mono-data text-muted-foreground ml-1">#{j.protocolo}</span>
          </p>
        </div>
        <span className="text-xs text-muted-foreground">{j.visitas.length} espaço(s)</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {j.visitas.map((v, i) => (
          <div key={i} className="flex items-center gap-1">
            <span className="text-[11px] bg-card border border-border rounded-md px-2 py-0.5 text-foreground">
              {v.espacoNome}
              <span className="text-muted-foreground ml-1">{new Date(v.quando).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
            </span>
            {i < j.visitas.length - 1 && <span className="text-muted-foreground">→</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function Kpi({ label, value, icon, accent }: { label: string; value: number; icon?: React.ReactNode; accent?: boolean }) {
  return (
    <div className="bg-card rounded-xl shadow-card p-4">
      <div className="flex items-center justify-between mb-2 text-muted-foreground">
        {icon}
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <p className={cn('text-2xl font-bold font-mono-data', accent ? 'text-cordao-verde' : 'text-foreground')}>{value}</p>
    </div>
  );
}
