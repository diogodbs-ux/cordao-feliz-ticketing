import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EspacoLudico, CicloEspaco, VisitaProtocolo, readEspacos, readCiclos, writeCiclos } from '@/types/espacos';
import { CordaoColor, getCordaoLabel } from '@/types';
import { Plus, Minus, Play, Square, History, MapPin, RotateCcw, Tag, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const COR_HEX: Record<CordaoColor, string> = {
  azul: '#4A90D9', verde: '#3CB371', amarelo: '#F5C518',
  vermelho: '#E74C3C', rosa: '#E96D9B', cinza: '#6B7B8D', preto: '#1E293B',
};
const CORES_CRIANCA: CordaoColor[] = ['azul', 'verde', 'amarelo', 'vermelho'];

export default function RecreadorEspacoPanel() {
  const { user } = useAuth();
  const { grupos } = useData();
  const [espacos, setEspacos] = useState<EspacoLudico[]>([]);
  const [ciclos, setCiclos] = useState<CicloEspaco[]>([]);
  const [espacoId, setEspacoId] = useState<string>('');
  const [cicloAtual, setCicloAtual] = useState<CicloEspaco | null>(null);
  const [protocoloInput, setProtocoloInput] = useState('');

  useEffect(() => {
    setEspacos(readEspacos().filter(e => e.ativo));
    setCiclos(readCiclos());
  }, []);

  const espaco = espacos.find(e => e.id === espacoId);

  const persistCiclos = (next: CicloEspaco[]) => {
    writeCiclos(next);
    setCiclos(next);
  };

  const iniciarCiclo = () => {
    if (!espaco || !user) return;
    const novo: CicloEspaco = {
      id: crypto.randomUUID(),
      espacoId: espaco.id,
      espacoNome: espaco.nome,
      recreadorId: user.id,
      recreadorNome: user.nome,
      inicio: new Date().toISOString(),
      porCor: {},
      totalCriancas: 0,
      totalAdultos: 0,
    };
    setCicloAtual(novo);
    toast.success(`Ciclo iniciado em ${espaco.nome}`);
  };

  const ajustar = (cor: CordaoColor | 'adulto', delta: number) => {
    if (!cicloAtual) return;
    const next = { ...cicloAtual };
    if (cor === 'adulto') {
      next.totalAdultos = Math.max(0, next.totalAdultos + delta);
    } else {
      const v = (next.porCor[cor] || 0) + delta;
      next.porCor = { ...next.porCor, [cor]: Math.max(0, v) };
      next.totalCriancas = CORES_CRIANCA.reduce((a, c) => a + (next.porCor[c] || 0), 0)
        + (next.porCor.rosa || 0) * 0; // rosa não é criança
    }
    setCicloAtual(next);
  };

  const finalizar = () => {
    if (!cicloAtual) return;
    if (cicloAtual.totalCriancas === 0 && cicloAtual.totalAdultos === 0) {
      if (!confirm('Ciclo está vazio. Finalizar mesmo assim?')) return;
    }
    const finalizado: CicloEspaco = { ...cicloAtual, fim: new Date().toISOString() };
    persistCiclos([...ciclos, finalizado]);
    setCicloAtual(null);
    setProtocoloInput('');
    toast.success('Ciclo registrado!');
  };

  const cancelar = () => {
    if (confirm('Descartar este ciclo? A contagem será perdida.')) {
      setCicloAtual(null);
      setProtocoloInput('');
    }
  };

  const adicionarProtocolo = () => {
    if (!cicloAtual) return;
    const p = protocoloInput.trim();
    if (!p) return;
    if (cicloAtual.protocolos?.some(x => x.protocolo.toLowerCase() === p.toLowerCase())) {
      toast.info('Protocolo já registrado neste ciclo.'); return;
    }
    const grupo = grupos.find(g => g.responsavel.protocolo?.toLowerCase() === p.toLowerCase());
    const visita: VisitaProtocolo = {
      protocolo: p,
      responsavelNome: grupo?.responsavel.nome,
      numCriancas: grupo?.responsavel.criancas.length,
      registradoEm: new Date().toISOString(),
    };
    setCicloAtual({ ...cicloAtual, protocolos: [...(cicloAtual.protocolos || []), visita] });
    setProtocoloInput('');
    toast.success(grupo ? `Grupo "${grupo.responsavel.nome}" adicionado` : `Protocolo ${p} registrado`);
  };

  const removerProtocolo = (proto: string) => {
    if (!cicloAtual) return;
    setCicloAtual({ ...cicloAtual, protocolos: (cicloAtual.protocolos || []).filter(x => x.protocolo !== proto) });
  };

  const hojeReal = new Date().toLocaleDateString('pt-BR');
  const ciclosHoje = useMemo(() => ciclos.filter(c => {
    return new Date(c.inicio).toLocaleDateString('pt-BR') === hojeReal
      && (!espacoId || c.espacoId === espacoId);
  }), [ciclos, espacoId, hojeReal]);

  const totaisHoje = useMemo(() => {
    const acc = { criancas: 0, adultos: 0, ciclos: ciclosHoje.length };
    ciclosHoje.forEach(c => { acc.criancas += c.totalCriancas; acc.adultos += c.totalAdultos; });
    return acc;
  }, [ciclosHoje]);

  if (espacos.length === 0) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center">
        <MapPin className="h-12 w-12 mx-auto text-muted-foreground opacity-30 mb-3" />
        <h2 className="text-lg font-semibold text-foreground">Nenhum espaço disponível</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Solicite ao administrador o cadastro dos espaços lúdicos em <strong>Admin → Espaços</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Recreador de Espaço</h1>
        <p className="text-sm text-muted-foreground">Registre ciclos de entrada por contagem rápida — substitui a planilha manual</p>
      </div>

      {/* Seletor de espaço */}
      <div className="bg-card rounded-xl shadow-card p-5">
        <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Espaço atual</label>
        <Select value={espacoId} onValueChange={setEspacoId} disabled={!!cicloAtual}>
          <SelectTrigger className="mt-2"><SelectValue placeholder="Selecione um espaço..." /></SelectTrigger>
          <SelectContent>
            {espacos.map(e => (
              <SelectItem key={e.id} value={e.id}>
                {e.nome} {e.categoria ? `· ${e.categoria}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Ciclo ativo / iniciar */}
      {!cicloAtual ? (
        <div className="bg-card rounded-xl shadow-card p-8 text-center">
          <Play className="h-10 w-10 mx-auto text-muted-foreground opacity-40 mb-3" />
          <p className="text-sm text-muted-foreground mb-4">
            {espaco ? `Pronto para iniciar um ciclo em ${espaco.nome}` : 'Selecione um espaço para começar'}
          </p>
          <Button size="lg" onClick={iniciarCiclo} disabled={!espaco} className="gap-2">
            <Play className="h-4 w-4" /> Iniciar novo ciclo
          </Button>
        </div>
      ) : (
        <div className="bg-card rounded-2xl shadow-elevated p-6 space-y-5 border-2 border-primary/40">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-cordao-verde font-bold flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-cordao-verde animate-pulse" /> Ciclo em andamento
              </p>
              <p className="text-lg font-bold text-foreground mt-1">{cicloAtual.espacoNome}</p>
              <p className="text-xs text-muted-foreground">
                Iniciado às {new Date(cicloAtual.inicio).toLocaleTimeString('pt-BR')}
                {espaco?.capacidadeCiclo && ` · Cap.: ${espaco.capacidadeCiclo}`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-4xl font-bold font-mono-data text-primary">{cicloAtual.totalCriancas}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">crianças</p>
            </div>
          </div>

          {/* Contadores por cor */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {CORES_CRIANCA.map(cor => (
              <ContadorCor
                key={cor}
                cor={cor}
                valor={cicloAtual.porCor[cor] || 0}
                onChange={d => ajustar(cor, d)}
              />
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <ContadorCor cor="rosa" label="Adultos" valor={cicloAtual.totalAdultos} onChange={d => ajustar('adulto', d)} />
            <div className={cn(
              'rounded-xl p-4 border flex flex-col justify-center',
              espaco?.capacidadeCiclo && cicloAtual.totalCriancas > espaco.capacidadeCiclo
                ? 'bg-cordao-vermelho/10 border-cordao-vermelho/40'
                : 'bg-secondary/50 border-border'
            )}>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Total no ciclo</p>
              <p className="text-3xl font-bold font-mono-data text-foreground">
                {cicloAtual.totalCriancas + cicloAtual.totalAdultos}
              </p>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={cancelar} className="gap-2">
              <RotateCcw className="h-4 w-4" /> Descartar
            </Button>
            <Button onClick={finalizar} className="flex-1 gap-2" size="lg">
              <Square className="h-4 w-4" /> Finalizar ciclo e registrar
            </Button>
          </div>
        </div>
      )}

      {/* Resumo do dia */}
      <div className="bg-card rounded-xl shadow-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          Hoje {espaco ? `· ${espaco.nome}` : '· todos os espaços'}
        </h3>
        <div className="grid grid-cols-3 gap-4 mb-5">
          <Stat label="Ciclos" value={totaisHoje.ciclos} />
          <Stat label="Crianças" value={totaisHoje.criancas} />
          <Stat label="Adultos" value={totaisHoje.adultos} />
        </div>
        {ciclosHoje.length > 0 && (
          <div className="space-y-2 max-h-64 overflow-auto">
            {ciclosHoje.slice().reverse().map(c => (
              <div key={c.id} className="flex items-center justify-between text-xs bg-secondary/40 rounded-lg p-3">
                <div>
                  <p className="font-medium text-foreground">{c.espacoNome}</p>
                  <p className="text-muted-foreground">
                    {new Date(c.inicio).toLocaleTimeString('pt-BR')}
                    {c.fim && ` → ${new Date(c.fim).toLocaleTimeString('pt-BR')}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono-data font-bold">{c.totalCriancas + c.totalAdultos}</p>
                  <p className="text-muted-foreground">{c.totalCriancas}c · {c.totalAdultos}a</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ContadorCor({ cor, valor, onChange, label }: { cor: CordaoColor; valor: number; onChange: (d: number) => void; label?: string }) {
  return (
    <div className="rounded-xl border-2 p-3 flex flex-col items-center" style={{ borderColor: COR_HEX[cor] + '40', backgroundColor: COR_HEX[cor] + '10' }}>
      <div className="flex items-center gap-1 mb-1">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COR_HEX[cor] }} />
        <span className="text-[11px] font-semibold text-foreground">{label || getCordaoLabel(cor).split(' ')[0]}</span>
      </div>
      <div className="text-3xl font-bold font-mono-data" style={{ color: COR_HEX[cor] }}>{valor}</div>
      <div className="flex gap-1 mt-2">
        <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => onChange(-1)}><Minus className="h-3 w-3" /></Button>
        <Button size="sm" className="h-8 w-8 p-0" onClick={() => onChange(1)} style={{ backgroundColor: COR_HEX[cor] }}><Plus className="h-3 w-3" /></Button>
        <Button size="sm" variant="outline" className="h-8 px-2 text-[10px]" onClick={() => onChange(5)}>+5</Button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-secondary/50 rounded-lg p-3 text-center">
      <p className="text-2xl font-bold font-mono-data text-foreground">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
