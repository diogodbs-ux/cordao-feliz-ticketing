import { useEffect, useMemo, useState } from 'react';
import { CicloEspaco, EspacoLudico, readCiclos, readEspacos, subscribeEspacosChange, idadesDeCiclos } from '@/types/espacos';
import { CordaoUnidade, readCordoes, subscribeCordoesChange } from '@/types/cordoes';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { BarChart3, Clock, Users, Baby, MapPin, Play, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

const FAIXAS: { label: string; min: number; max: number }[] = [
  { label: '0-3', min: 0, max: 3 },
  { label: '4-6', min: 4, max: 6 },
  { label: '7-9', min: 7, max: 9 },
  { label: '10-12', min: 10, max: 12 },
];

function toISO(d: Date) { return d.toLocaleDateString('en-CA'); }

export default function AdminCiclosDashboard() {
  const [espacos, setEspacos] = useState<EspacoLudico[]>([]);
  const [ciclos, setCiclos] = useState<CicloEspaco[]>([]);
  const [cordoes, setCordoes] = useState<CordaoUnidade[]>([]);
  const hojeISO = toISO(new Date());
  const [de, setDe] = useState(hojeISO);
  const [ate, setAte] = useState(hojeISO);

  useEffect(() => {
    const carregar = () => {
      setEspacos(readEspacos().filter(e => e.ativo));
      setCiclos(readCiclos());
      setCordoes(readCordoes());
    };
    carregar();
    const offE = subscribeEspacosChange(carregar);
    const offC = subscribeCordoesChange(carregar);
    return () => { offE(); offC(); };
  }, []);

  const dentroPeriodo = (iso?: string) => {
    if (!iso) return false;
    const d = new Date(iso).toLocaleDateString('en-CA');
    return d >= de && d <= ate;
  };

  const ciclosPeriodo = useMemo(() => ciclos.filter(c => dentroPeriodo(c.inicio)), [ciclos, de, ate]);

  const totais = useMemo(() => {
    const iniciados = ciclosPeriodo.length;
    const ativos = ciclosPeriodo.filter(c => !c.fim).length;
    const finalizados = ciclosPeriodo.filter(c => !!c.fim).length;
    const criancas = ciclosPeriodo.reduce((a, c) => a + c.totalCriancas, 0);
    const adultos = ciclosPeriodo.reduce((a, c) => a + c.totalAdultos, 0);
    return { iniciados, ativos, finalizados, criancas, adultos };
  }, [ciclosPeriodo]);

  const porEspaco = useMemo(() => {
    return espacos.map(e => {
      const cs = ciclosPeriodo.filter(c => c.espacoId === e.id);
      const visitas = cordoes.flatMap(c => (c.visitas || [])
        .filter(v => v.espacoId === e.id && dentroPeriodo(v.entrada))
        .map(v => ({ cordao: c })));
      const idades: Record<string, number> = { '0-3': 0, '4-6': 0, '7-9': 0, '10-12': 0 };
      visitas.forEach(({ cordao }) => {
        if (cordao.membroTipo !== 'crianca' || cordao.membroIdade === undefined) return;
        const faixa = FAIXAS.find(f => cordao.membroIdade! >= f.min && cordao.membroIdade! <= f.max);
        if (faixa) idades[faixa.label]++;
      });
      return {
        espaco: e,
        iniciados: cs.length,
        ativos: cs.filter(c => !c.fim).length,
        finalizados: cs.filter(c => !!c.fim).length,
        criancas: cs.reduce((a, c) => a + c.totalCriancas, 0),
        adultos: cs.reduce((a, c) => a + c.totalAdultos, 0),
        rastreados: visitas.length,
        idades,
      };
    }).sort((a, b) => b.iniciados - a.iniciados || b.criancas - a.criancas);
  }, [espacos, ciclosPeriodo, cordoes, de, ate]);

  const maxCiclos = Math.max(1, ...porEspaco.map(p => p.iniciados));
  const idadesGlobal = useMemo(() => {
    const acc: Record<string, number> = { '0-3': 0, '4-6': 0, '7-9': 0, '10-12': 0 };
    porEspaco.forEach(p => Object.entries(p.idades).forEach(([k, v]) => { acc[k] += v; }));
    return acc;
  }, [porEspaco]);
  const totalIdades = Math.max(1, Object.values(idadesGlobal).reduce((a, b) => a + b, 0));

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="h-6 w-6 text-primary" /> Dashboard de Ciclos por Espaço</h1>
          <p className="text-sm text-muted-foreground">Ciclos iniciados, ativos e finalizados, com distribuição por idade — em tempo real.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">De</label>
            <Input type="date" value={de} onChange={e => setDe(e.target.value)} className="h-9 w-[160px]" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Até</label>
            <Input type="date" value={ate} onChange={e => setAte(e.target.value)} className="h-9 w-[160px]" />
          </div>
          <Button size="sm" variant="outline" onClick={() => { const t = toISO(new Date()); setDe(t); setAte(t); }}>Hoje</Button>
          <Button size="sm" variant="outline" onClick={() => {
            const d = new Date(); d.setDate(d.getDate() - 7);
            setDe(toISO(d)); setAte(toISO(new Date()));
          }}>7 dias</Button>
          <Button size="sm" variant="outline" onClick={() => {
            const d = new Date(); d.setDate(d.getDate() - 30);
            setDe(toISO(d)); setAte(toISO(new Date()));
          }}>30 dias</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <CardStat icon={<Play className="h-3.5 w-3.5" />} label="Ciclos iniciados" value={totais.iniciados} />
        <CardStat icon={<Clock className="h-3.5 w-3.5" />} label="Ativos agora" value={totais.ativos} tone="primary" />
        <CardStat icon={<Square className="h-3.5 w-3.5" />} label="Finalizados" value={totais.finalizados} tone="ok" />
        <CardStat icon={<Baby className="h-3.5 w-3.5" />} label="Crianças" value={totais.criancas} />
        <CardStat icon={<Users className="h-3.5 w-3.5" />} label="Adultos" value={totais.adultos} />
      </div>

      <div className="bg-card rounded-xl shadow-card p-5">
        <h2 className="text-sm font-semibold mb-3">Distribuição global por faixa etária</h2>
        <div className="grid grid-cols-4 gap-3">
          {FAIXAS.map(f => {
            const v = idadesGlobal[f.label];
            const pct = Math.round((v / totalIdades) * 100);
            return (
              <div key={f.label} className="rounded-lg border border-border bg-secondary/30 p-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{f.label} anos</p>
                <p className="text-2xl font-bold font-mono-data text-foreground">{v}</p>
                <div className="h-1.5 bg-secondary rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{pct}%</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-card rounded-xl shadow-card p-5">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /> Ranking de espaços no período</h2>
        {porEspaco.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum dado no período.</p>
        ) : (
          <div className="space-y-2">
            {porEspaco.map(p => (
              <div key={p.espaco.id} className="rounded-lg border border-border bg-secondary/20 p-3">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground truncate">{p.espaco.nome}</p>
                      {p.ativos > 0 && <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded font-bold">{p.ativos} ATIVO(S)</span>}
                    </div>
                    <div className="h-2 bg-secondary rounded-full mt-1.5 overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${(p.iniciados / maxCiclos) * 100}%` }} />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1 flex flex-wrap gap-x-3">
                      <span>{p.iniciados} iniciados</span>
                      <span className="text-cordao-verde">{p.finalizados} finalizados</span>
                      <span><Baby className="h-3 w-3 inline" /> {p.criancas} crianças</span>
                      <span><Users className="h-3 w-3 inline" /> {p.adultos} adultos</span>
                      <span>{p.rastreados} cordões lidos</span>
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-1.5 mt-2">
                  {FAIXAS.map(f => (
                    <div key={f.label} className="bg-card rounded px-2 py-1 text-center border border-border/60">
                      <p className="text-[9px] text-muted-foreground">{f.label}a</p>
                      <p className="text-sm font-bold font-mono-data">{p.idades[f.label]}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CardStat({ label, value, icon, tone }: { label: string; value: number; icon?: React.ReactNode; tone?: 'ok' | 'primary' }) {
  return (
    <div className="rounded-xl p-4 border border-border bg-card shadow-card">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">{icon} {label}</p>
      <p className={cn('text-3xl font-bold font-mono-data mt-1',
        tone === 'ok' && 'text-cordao-verde',
        tone === 'primary' && 'text-primary',
        !tone && 'text-foreground')}>{value}</p>
    </div>
  );
}
