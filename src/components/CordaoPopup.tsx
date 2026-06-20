import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GrupoVisita, getCordaoTailwindBg, getCordaoTailwindText, getCordaoLabel, CordaoColor } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, Accessibility, X, Printer, Tag, ScanLine, AlertTriangle, Cake } from 'lucide-react';
import { cn } from '@/lib/utils';
import { imprimirCordoes, imprimirCartaoRastreamento, CordaoPrintItem } from '@/lib/print';
import { gerarOuObterToken, buildPublicUrl } from '@/lib/rastreamento';
import { aniversarianteDeHoje, ehAniversarianteHoje } from '@/lib/aniversariantes';
import { CordaoUnidade, vincularCordao, parseCodigo, formatCodigo, getCordaoByCodigo, readCordoes, subscribeCordoesChange } from '@/types/cordoes';
import { toast } from 'sonner';

interface CordaoPopupProps {
  grupo: GrupoVisita | null;
  guiche: number;
  onConfirm: () => void;
  onClose: () => void;
}

interface MembroEntrega {
  key: string;
  nome: string;
  cor: CordaoColor;
  tipo: string;
  membroTipo: 'crianca' | 'adulto';
  idade?: number;
  pcd?: boolean;
  pcdDesc?: string;
  codigoCordao?: string;
}

export default function CordaoPopup({ grupo, guiche, onConfirm, onClose }: CordaoPopupProps) {
  const inputsRef = useRef<Record<string, HTMLInputElement | null>>({});
  const [membros, setMembros] = useState<MembroEntrega[]>(() => buildMembros(grupo));
  const [vincularAtivo, setVincularAtivo] = useState(false);
  const [cordoesBase, setCordoesBase] = useState<CordaoUnidade[]>(() => readCordoes());

  // Reset when group changes (defensive)
  useEffect(() => { setMembros(buildMembros(grupo)); setVincularAtivo(false); setCordoesBase(readCordoes()); }, [grupo?.id]);
  useEffect(() => {
    const refresh = () => setCordoesBase(readCordoes());
    refresh();
    const unsubscribe = subscribeCordoesChange(refresh);
    const id = setInterval(refresh, 1500);
    return () => { unsubscribe(); clearInterval(id); };
  }, []);

  if (!grupo) return null;

  const totalMembros = membros.length;
  const vinculados = membros.filter(m => m.codigoCordao && getCordaoByCodigo(m.codigoCordao)).length;
  const codigosEmUso = new Set(membros.map(m => m.codigoCordao).filter(Boolean));

  const sugestoesPorCor = useMemo(() => {
    const acc: Record<CordaoColor, CordaoUnidade[]> = { azul: [], verde: [], amarelo: [], vermelho: [], rosa: [], cinza: [], preto: [] };
    cordoesBase
      .filter(c => c.status === 'disponivel' || c.protocolo === (grupo.responsavel.protocolo || grupo.id))
      .forEach(c => acc[c.cor].push(c));
    return acc;
  }, [cordoesBase, grupo.id, grupo.responsavel.protocolo]);

  const focarProximo = (currentKey: string) => {
    const idx = membros.findIndex(m => m.key === currentKey);
    for (let i = idx + 1; i < membros.length; i++) {
      if (!membros[i].codigoCordao) {
        const el = inputsRef.current[membros[i].key];
        if (el) { el.focus(); el.select(); }
        return;
      }
    }
  };

  const lerCodigo = (key: string, raw: string) => {
    const parsed = parseCodigo(raw);
    if (!parsed) {
      toast.error(`Código inválido: "${raw}". Use o formato AZ-0001.`);
      return;
    }
    const code = formatCodigo(parsed.cor, parsed.numero);
    const membro = membros.find(m => m.key === key)!;
    const existente = getCordaoByCodigo(code);
    if (!existente) {
      toast.error(`Cordão ${code} não existe no estoque. Gere/imprima o lote em Admin → Cordões Numerados.`);
      setMembros(prev => prev.map(m => m.key === key ? { ...m, codigoCordao: '' } : m));
      return;
    }
    if (existente.protocolo && existente.protocolo !== (grupo.responsavel.protocolo || grupo.id)) {
      toast.error(`Cordão ${code} pertence ao protocolo ${existente.protocolo}. Use esse protocolo para localizar o responsável correto.`);
      setMembros(prev => prev.map(m => m.key === key ? { ...m, codigoCordao: '' } : m));
      return;
    }
    if (parsed.cor !== membro.cor) {
      toast.warning(`Atenção: cordão ${code} é da cor ${parsed.cor.toUpperCase()}, mas ${membro.nome} deveria receber ${membro.cor.toUpperCase()}.`);
    }
    if (membros.some(m => m.codigoCordao === code && m.key !== key)) {
      toast.error(`Cordão ${code} já está vinculado a outro membro neste grupo.`);
      return;
    }
    setMembros(prev => prev.map(m => m.key === key ? { ...m, codigoCordao: code } : m));
    setTimeout(() => focarProximo(key), 50);
  };

  const handleConfirmar = () => {
    // Se vinculação foi habilitada, exigir todos os códigos
    if (vincularAtivo) {
      const faltando = membros.filter(m => !m.codigoCordao || !getCordaoByCodigo(m.codigoCordao));
      if (faltando.length > 0) {
        toast.error(`Faltam ${faltando.length} cordão(ões) válidos. Use somente códigos gerados no estoque.`);
        return;
      }
      // Persistir vínculo
      const erros: string[] = [];
      membros.forEach(m => {
        const r = vincularCordao(m.codigoCordao!, {
          protocolo: grupo.responsavel.protocolo || grupo.id,
          grupoId: grupo.id,
          membroNome: m.nome,
          membroTipo: m.membroTipo,
          membroIdade: m.idade,
          pcd: m.pcd,
          pcdDescricao: m.pcdDesc,
        });
        if (r.ok === false) erros.push(r.erro);
      });
      if (erros.length > 0) {
        toast.error(erros[0]);
        return;
      }
      toast.success(`${membros.length} cordões vinculados ao protocolo.`);
      // Gera token público + imprime cartão de acompanhamento para o responsável.
      try {
        const tk = gerarOuObterToken(grupo);
        const url = buildPublicUrl(tk.token);
        imprimirCartaoRastreamento({
          token: tk.token, url,
          responsavelNome: grupo.responsavel.nome,
          protocolo: grupo.responsavel.protocolo || grupo.id,
        }).catch(() => { /* noop */ });
        toast.message('Cartão de acompanhamento gerado', { description: `Token ${tk.token} — entregue ao responsável.` });
      } catch { /* noop */ }
    }
    onConfirm();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-foreground/60 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', duration: 0.3, bounce: 0.1 }}
          className="bg-card rounded-2xl shadow-popup w-full max-w-4xl max-h-[90vh] overflow-auto"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div>
              <h2 className="text-xl font-bold text-foreground">Matriz de Entrega de Cordões</h2>
              <p className="text-sm text-muted-foreground mt-1">Guichê {String(guiche).padStart(2, '0')} — Verifique as cores e entregue os cordões</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-secondary rounded-lg transition-colors">
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          {(() => {
            const aniv = aniversarianteDeHoje(grupo.responsavel.nome, grupo.responsavel.criancas.map(c => c.nome));
            if (!aniv) return null;
            return (
              <motion.div
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                className="mx-6 mt-4 rounded-2xl p-4 bg-gradient-to-r from-amber-400 via-pink-400 to-fuchsia-500 text-white shadow-popup flex items-center gap-3"
              >
                <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center text-3xl">
                  🎂
                </div>
                <div className="flex-1">
                  <p className="text-[11px] uppercase tracking-[0.2em] font-bold opacity-90 flex items-center gap-1">
                    <Cake className="h-3 w-3" /> Aniversariante de hoje!
                  </p>
                  <p className="text-xl font-extrabold leading-tight">{aniv}</p>
                  <p className="text-xs opacity-90">Atenção especial — parabenize na entrega do cordão.</p>
                </div>
              </motion.div>
            );
          })()}

          <div className="p-6">
            {/* Toggle de vinculação */}
            <div className={cn(
              'mb-4 rounded-xl border p-3 flex items-center justify-between gap-3',
              vincularAtivo ? 'bg-primary/5 border-primary/30' : 'bg-secondary/50 border-border'
            )}>
              <div className="flex items-start gap-2 min-w-0">
                <Tag className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <div className="text-xs">
                  <p className="font-semibold text-foreground">Rastreio individual por cordão</p>
                  <p className="text-muted-foreground">
                    Escaneie o código de barras de cada cordão entregue para registrar a jornada da criança nos espaços.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant={vincularAtivo ? 'default' : 'outline'}
                onClick={() => setVincularAtivo(v => !v)}
                className="gap-1.5 flex-shrink-0"
              >
                <ScanLine className="h-3.5 w-3.5" />
                {vincularAtivo ? `${vinculados}/${totalMembros}` : 'Ativar'}
              </Button>
            </div>

            <div className={cn(
              'grid gap-4',
              membros.length <= 2 ? 'grid-cols-1 sm:grid-cols-2' :
              membros.length <= 4 ? 'grid-cols-2 md:grid-cols-4' :
              'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
            )}>
              {membros.map((m, i) => (
                <motion.div
                  key={m.key}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="rounded-xl overflow-hidden shadow-card border border-border"
                >
                  <div className={cn('h-16 flex items-center justify-center', getCordaoTailwindBg(m.cor))}>
                    <span className={cn('text-lg font-bold uppercase tracking-wider', getCordaoTailwindText(m.cor))}>
                      {m.cor}
                    </span>
                  </div>
                  <div className="p-3 space-y-1.5">
                    <p className="text-base font-bold text-foreground leading-tight">{m.nome}</p>
                    <p className="text-xs text-muted-foreground">{m.tipo}</p>
                    {m.pcd && (
                      <div className="flex items-center gap-1 text-primary">
                        <Accessibility className="h-3.5 w-3.5 animate-pulse-glow" />
                        <span className="text-[10px] font-semibold">{m.pcdDesc || 'PCD'}</span>
                      </div>
                    )}
                    {vincularAtivo && (
                      <div className="pt-2">
                        <Input
                          ref={el => { inputsRef.current[m.key] = el; }}
                          list={`cordoes-${m.key}`}
                          placeholder={`${m.cor.slice(0, 2).toUpperCase()}-0000`}
                          value={m.codigoCordao || ''}
                          onChange={e => setMembros(prev => prev.map(x => x.key === m.key ? { ...x, codigoCordao: e.target.value.toUpperCase() } : x))}
                          onBlur={e => {
                            const v = e.target.value.trim();
                            if (v) lerCodigo(m.key, v);
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const v = (e.target as HTMLInputElement).value.trim();
                              if (v) lerCodigo(m.key, v);
                            }
                          }}
                          className={cn('h-9 text-sm font-mono-data',
                            m.codigoCordao && getCordaoByCodigo(m.codigoCordao) ? 'border-cordao-verde bg-cordao-verde/5' : 'border-primary/40'
                          )}
                          autoFocus={i === 0}
                        />
                        <datalist id={`cordoes-${m.key}`}>
                          {(sugestoesPorCor[m.cor] || [])
                            .filter(c => !codigosEmUso.has(c.codigo) || c.codigo === m.codigoCordao)
                            .slice(0, 80)
                            .map(c => (
                              <option key={c.codigo} value={c.codigo}>{c.membroNome ? `${c.codigo} — ${c.membroNome}` : c.codigo}</option>
                            ))}
                        </datalist>
                        {m.codigoCordao && getCordaoByCodigo(m.codigoCordao) ? (
                          <p className="text-[10px] text-cordao-verde font-semibold mt-1 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> vinculado
                          </p>
                        ) : m.codigoCordao ? (
                          <p className="text-[10px] text-cordao-vermelho font-semibold mt-1 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> código não encontrado
                          </p>
                        ) : (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {sugestoesPorCor[m.cor]?.length || 0} disponível(is) desta cor
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="mt-6 bg-secondary/50 rounded-xl p-4">
              <p className="text-sm font-medium text-foreground mb-2">Resumo de Cordões para Entregar:</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(
                  membros.reduce((acc, m) => { acc[m.cor] = (acc[m.cor] || 0) + 1; return acc; }, {} as Record<string, number>)
                ).map(([cor, qtd]) => (
                  <span
                    key={cor}
                    className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold',
                      getCordaoTailwindBg(cor as CordaoColor), getCordaoTailwindText(cor as CordaoColor))}
                  >
                    {qtd}x {cor.toUpperCase()}
                  </span>
                ))}
              </div>
            </div>

            {vincularAtivo && vinculados < totalMembros && (
              <div className="mt-3 flex items-center gap-2 text-xs text-primary bg-primary/5 rounded-lg p-2.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Escaneie ou digite o código impresso em cada cordão. Pressione Enter para validar.
              </div>
            )}
          </div>

          <div className="p-6 border-t border-border flex justify-between items-center gap-3 flex-wrap">
            <Button
              variant="outline"
              onClick={() => {
                const items: CordaoPrintItem[] = membros.map(m => ({
                  nome: m.nome, cor: m.cor, detalhe: m.tipo,
                  pcd: m.pcd, pcdDescricao: m.pcdDesc, guiche,
                }));
                imprimirCordoes(items, { titulo: `Cordões — ${grupo.responsavel.nome}` });
              }}
              className="gap-2"
            >
              <Printer className="h-4 w-4" /> Imprimir Cordões
            </Button>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button onClick={handleConfirmar} className="gap-2 px-8">
                <CheckCircle2 className="h-4 w-4" />
                Confirmar Entrega e Check-in
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function buildMembros(grupo: GrupoVisita | null): MembroEntrega[] {
  if (!grupo) return [];
  const arr: MembroEntrega[] = [];
  arr.push({
    key: `resp-${grupo.responsavel.id}`,
    nome: grupo.responsavel.nome, cor: 'rosa', tipo: 'Responsável', membroTipo: 'adulto',
  });
  (grupo.responsavel.acompanhantes || []).forEach((a, i) => arr.push({
    key: `acom-${a.id || i}`,
    nome: a.nome || `Acompanhante ${i + 1}`, cor: 'rosa',
    tipo: a.parentesco || 'Acompanhante', membroTipo: 'adulto',
  }));
  grupo.responsavel.criancas.forEach(c => arr.push({
    key: `cri-${c.id}`,
    nome: c.nome, cor: c.cordaoCor, tipo: `${c.idade} anos`,
    membroTipo: 'crianca', idade: c.idade, pcd: c.pcd, pcdDesc: c.pcdDescricao,
  }));
  return arr;
}
