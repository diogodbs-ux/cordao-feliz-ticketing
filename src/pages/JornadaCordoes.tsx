import { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CordaoUnidade, readCordoes, parseCodigo, formatCodigo, cordoesPorProtocolo, prefixoCor } from '@/types/cordoes';
import { CordaoColor, getCordaoTailwindBg, getCordaoTailwindText } from '@/types';
import { Search, MapPin, Clock, User, Hash, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function JornadaCordoes() {
  const [todos, setTodos] = useState<CordaoUnidade[]>([]);
  const [busca, setBusca] = useState('');

  useEffect(() => { setTodos(readCordoes()); }, []);

  const resultados = useMemo(() => {
    const q = busca.trim();
    if (!q) {
      // Mostra os com mais visitas
      return [...todos].filter(c => (c.visitas?.length || 0) > 0)
        .sort((a, b) => (b.visitas?.length || 0) - (a.visitas?.length || 0))
        .slice(0, 30);
    }
    // Tenta como código
    const parsed = parseCodigo(q);
    if (parsed) {
      const code = formatCodigo(parsed.cor, parsed.numero);
      return todos.filter(c => c.codigo === code);
    }
    // Busca por protocolo
    const porProto = cordoesPorProtocolo(q);
    if (porProto.length > 0) return porProto;
    // Busca por nome
    const qLower = q.toLowerCase();
    return todos.filter(c =>
      (c.membroNome || '').toLowerCase().includes(qLower) ||
      (c.protocolo || '').toLowerCase().includes(qLower)
    ).slice(0, 50);
  }, [busca, todos]);

  // Agrupa por protocolo p/ visualização de família
  const grupos = useMemo(() => {
    const m = new Map<string, CordaoUnidade[]>();
    resultados.forEach(c => {
      const k = c.protocolo || `__sem__${c.codigo}`;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(c);
    });
    return Array.from(m.entries()).map(([proto, lista]) => ({
      protocolo: proto.startsWith('__sem__') ? null : proto,
      cordoes: lista.sort((a, b) => a.codigo.localeCompare(b.codigo)),
    }));
  }, [resultados]);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Jornada por cordão</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe o percurso individual de cada criança/adulto pelos espaços lúdicos.
          Busque por código (AZ-0457), protocolo ou nome.
        </p>
      </div>

      <div className="bg-card rounded-xl shadow-card p-5">
        <div className="relative">
          <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Código, protocolo ou nome…"
            className="pl-9"
          />
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          {busca ? `${resultados.length} cordão(ões) encontrado(s)` : `Mostrando os ${resultados.length} cordões mais ativos`}
        </p>
      </div>

      {grupos.length === 0 ? (
        <div className="bg-card rounded-xl shadow-card p-12 text-center">
          <MapPin className="h-10 w-10 mx-auto text-muted-foreground opacity-30 mb-3" />
          <p className="text-sm text-muted-foreground">
            {busca ? 'Nenhum cordão encontrado.' : 'Ainda não há cordões com visitas registradas.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {grupos.map(g => (
            <div key={g.protocolo || g.cordoes[0].codigo} className="bg-card rounded-xl shadow-card overflow-hidden">
              {g.protocolo && (
                <div className="px-5 py-3 bg-secondary/40 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-mono-data font-bold text-foreground">{g.protocolo}</span>
                    <span className="text-[10px] text-muted-foreground">· {g.cordoes.length} cordão(ões)</span>
                  </div>
                </div>
              )}
              <div className="divide-y divide-border">
                {g.cordoes.map(c => <CordaoRow key={c.codigo} cordao={c} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CordaoRow({ cordao }: { cordao: CordaoUnidade }) {
  const visitas = cordao.visitas || [];
  const tempoTotal = visitas.reduce((acc, v) => {
    if (v.saida) acc += new Date(v.saida).getTime() - new Date(v.entrada).getTime();
    return acc;
  }, 0);
  const minutos = Math.round(tempoTotal / 60000);

  return (
    <div className="p-5">
      <div className="flex items-center gap-3 flex-wrap mb-3">
        <span className={cn('px-2.5 py-1 rounded text-xs font-bold font-mono-data',
          getCordaoTailwindBg(cordao.cor), getCordaoTailwindText(cordao.cor))}>
          {cordao.codigo}
        </span>
        {cordao.membroNome && (
          <div className="flex items-center gap-1 text-sm">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium text-foreground">{cordao.membroNome}</span>
            <span className="text-[10px] text-muted-foreground">({cordao.membroTipo})</span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>{visitas.length} espaço(s) visitado(s)</span>
          {minutos > 0 && (
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {minutos} min total</span>
          )}
        </div>
      </div>

      {visitas.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Sem visitas registradas em espaços.</p>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          {visitas.map((v, i) => {
            const dur = v.saida ? Math.round((new Date(v.saida).getTime() - new Date(v.entrada).getTime()) / 60000) : null;
            return (
              <div key={v.cicloId} className="flex items-center gap-2">
                <div className="bg-secondary/50 rounded-lg px-3 py-1.5">
                  <p className="text-xs font-medium text-foreground">{v.espacoNome}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(v.entrada).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    {dur !== null && ` · ${dur}min`}
                  </p>
                </div>
                {i < visitas.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
