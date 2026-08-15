// Heatmap visual do parque: cada espaço é uma bolinha. Tamanho/cor refletem ocupação,
// e bolinhas com >=80% piscam. Atualiza em tempo real via subscribe.
import { useEffect, useMemo, useState } from 'react';
import { readEspacos, readCiclos, subscribeEspacosChange, EspacoLudico, CicloEspaco } from '@/types/espacos';
import { useData } from '@/contexts/DataContext';
import { preverProximos30Min } from '@/lib/predicao';
import { Activity, TrendingUp, AlertTriangle, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NodeEspaco {
  espaco: EspacoLudico;
  ativos: number;
  capacidade: number;
  taxa: number; // 0..1
  cx: number;
  cy: number;
  r: number;
  ciclo?: CicloEspaco;
}

function tempoDecorrido(inicioISO: string, agora: number) {
  const seg = Math.max(0, Math.floor((agora - new Date(inicioISO).getTime()) / 1000));
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  const s = seg % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}


function ocupacaoCor(taxa: number): string {
  if (taxa >= 0.9) return 'hsl(0 84% 56%)';      // vermelho
  if (taxa >= 0.8) return 'hsl(25 95% 53%)';     // laranja
  if (taxa >= 0.5) return 'hsl(48 96% 53%)';     // amarelo
  if (taxa >= 0.2) return 'hsl(142 71% 45%)';    // verde
  return 'hsl(217 91% 60%)';                     // azul
}

export default function AdminHeatmap() {
  const { checkins } = useData();
  const [espacos, setEspacos] = useState<EspacoLudico[]>(readEspacos);
  const [ciclos, setCiclos] = useState<CicloEspaco[]>(readCiclos);
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    const refresh = () => { setEspacos(readEspacos()); setCiclos(readCiclos()); };
    refresh();
    return subscribeEspacosChange(refresh);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const nodes: NodeEspaco[] = useMemo(() => {
    const ativos = espacos.filter(e => e.ativo);
    const W = 1000, H = 560;
    const cols = Math.max(4, Math.ceil(Math.sqrt(ativos.length * (W / H))));
    const rows = Math.max(1, Math.ceil(ativos.length / cols));
    const padX = 80, padY = 70;
    const stepX = (W - padX * 2) / Math.max(1, cols - 1);
    const stepY = (H - padY * 2) / Math.max(1, rows - 1);

    return ativos.map((e, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cicloAberto = ciclos.find(c => c.espacoId === e.id && !c.fim);
      const ativosCount = cicloAberto?.totalCriancas || 0;
      const cap = e.capacidadeCiclo || 30;
      const taxa = Math.min(1, ativosCount / Math.max(1, cap));
      const r = 20 + taxa * 32;
      return {
        espaco: e,
        ativos: ativosCount,
        capacidade: cap,
        taxa,
        cx: padX + col * stepX,
        cy: padY + row * stepY,
        r,
        ciclo: cicloAberto,
      };
    });
  }, [espacos, ciclos]);

  const totalAtivos = nodes.reduce((a, n) => a + n.ativos, 0);
  const lotados = nodes.filter(n => n.taxa >= 0.8).length;
  const emAndamento = useMemo(
    () => ciclos.filter(c => !c.fim).sort((a, b) => b.inicio.localeCompare(a.inicio)),
    [ciclos]
  );
  const predicao = useMemo(() => preverProximos30Min(checkins), [checkins]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Heatmap do Parque</h1>
          <p className="text-sm text-muted-foreground">Visão de gargalos em tempo real — bolinhas piscando indicam &ge; 80% de ocupação.</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <Stat icon={<Users className="h-4 w-4 text-primary" />} label="Crianças ativas" value={totalAtivos} />
          <Stat icon={<AlertTriangle className="h-4 w-4 text-amber-500" />} label="Espaços lotados" value={lotados} />
          <Stat icon={<Activity className="h-4 w-4 text-cordao-verde" />} label="Atividades em andamento" value={emAndamento.length} />
          <Stat icon={<Activity className="h-4 w-4 text-muted-foreground" />} label="Espaços ativos" value={nodes.length} />
        </div>
      </div>

      {/* Atividades em andamento — quem iniciou, onde e há quanto tempo */}
      <div className="bg-card rounded-2xl shadow-card p-5">
        <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-cordao-verde" /> Atividades em andamento
        </p>
        {emAndamento.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma atividade iniciada agora. Quando um recreador iniciar um ciclo em “Meu Espaço”, ele aparece aqui em tempo real.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {emAndamento.map(c => (
              <div key={c.id} className="rounded-xl border border-cordao-verde/30 bg-cordao-verde/5 p-4">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-cordao-verde animate-pulse" />
                  <p className="text-sm font-bold text-foreground truncate">{c.espacoNome}</p>
                  <span className="ml-auto text-sm font-mono-data font-bold text-foreground">{tempoDecorrido(c.inicio, agora)}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  Recreador: <span className="font-medium text-foreground">{c.recreadorNome || '—'}</span>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Início às {new Date(c.inicio).toLocaleTimeString('pt-BR')} · {c.totalCriancas} criança(s) · {c.totalAdultos} adulto(s)
                </p>
              </div>
            ))}
          </div>
        )}
      </div>


      {/* Predição */}
      <div className={cn(
        'rounded-2xl p-5 border flex items-center gap-4',
        predicao.risco === 'alto' ? 'bg-destructive/5 border-destructive/30' :
        predicao.risco === 'medio' ? 'bg-amber-500/5 border-amber-500/30' :
        'bg-primary/5 border-primary/20'
      )}>
        <TrendingUp className="h-8 w-8 text-primary flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">Predição ML — próximos 30 min</p>
          <p className="text-xs text-muted-foreground">{predicao.recomendacao}</p>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div><p className="text-2xl font-extrabold font-mono-data">{predicao.proximos30min}</p><p className="text-[10px] text-muted-foreground">30 min</p></div>
          <div><p className="text-2xl font-extrabold font-mono-data">{predicao.proximos60min}</p><p className="text-[10px] text-muted-foreground">60 min</p></div>
          <div>
            <p className={cn('text-xl font-bold uppercase',
              predicao.risco === 'alto' ? 'text-destructive' :
              predicao.risco === 'medio' ? 'text-amber-600' : 'text-cordao-verde'
            )}>{predicao.risco}</p>
            <p className="text-[10px] text-muted-foreground">{Math.round(predicao.confianca * 100)}% conf.</p>
          </div>
        </div>
      </div>

      {/* SVG heatmap */}
      <div className="bg-card rounded-2xl shadow-card p-4 overflow-hidden">
        <svg viewBox="0 0 1000 560" className="w-full h-auto">
          <defs>
            <radialGradient id="parkBg" cx="50%" cy="50%" r="70%">
              <stop offset="0%" stopColor="hsl(var(--background))" />
              <stop offset="100%" stopColor="hsl(var(--secondary))" />
            </radialGradient>
            <style>{`
              @keyframes pulseDot {
                0%, 100% { opacity: 1; transform-origin: center; }
                50% { opacity: 0.55; }
              }
              .pulsing { animation: pulseDot 1.2s ease-in-out infinite; }
            `}</style>
          </defs>
          <rect width="1000" height="560" fill="url(#parkBg)" rx="16" />
          {nodes.map(n => (
            <g key={n.espaco.id}>
              <circle
                cx={n.cx} cy={n.cy} r={n.r + 6}
                fill={ocupacaoCor(n.taxa)}
                opacity={0.15}
                className={n.taxa >= 0.8 ? 'pulsing' : ''}
              />
              <circle
                cx={n.cx} cy={n.cy} r={n.r}
                fill={ocupacaoCor(n.taxa)}
                className={n.taxa >= 0.8 ? 'pulsing' : ''}
              />
              <text
                x={n.cx} y={n.cy + 4}
                textAnchor="middle"
                fontSize="13"
                fontWeight="800"
                fill="white"
              >{n.ativos}</text>
              <text
                x={n.cx} y={n.cy + n.r + 16}
                textAnchor="middle"
                fontSize="11"
                fill="hsl(var(--foreground))"
              >{n.espaco.nome.length > 18 ? n.espaco.nome.slice(0, 17) + '…' : n.espaco.nome}</text>
              <text
                x={n.cx} y={n.cy + n.r + 30}
                textAnchor="middle"
                fontSize="10"
                fill="hsl(var(--muted-foreground))"
              >{Math.round(n.taxa * 100)}% • cap {n.capacidade}</text>
            </g>
          ))}
        </svg>

        <div className="flex flex-wrap items-center gap-3 mt-4 text-xs">
          <span className="font-semibold text-foreground">Legenda:</span>
          {[
            { l: '0-20%', t: 0.1 }, { l: '20-50%', t: 0.3 }, { l: '50-80%', t: 0.6 },
            { l: '80-90%', t: 0.85 }, { l: '90-100%', t: 0.95 },
          ].map(x => (
            <span key={x.l} className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full" style={{ background: ocupacaoCor(x.t) }} />
              {x.l}
            </span>
          ))}
          <span className="text-muted-foreground ml-auto">Bolinhas piscando = ≥ 80% — atenção!</span>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <div>
        <p className="text-xs text-muted-foreground leading-none">{label}</p>
        <p className="text-lg font-bold text-foreground font-mono-data leading-tight">{value}</p>
      </div>
    </div>
  );
}
