import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getCordaoTailwindBg, getCordaoTailwindText, GrupoVisita, getOrigemLabel } from '@/types';
import { Search, Users, CheckCircle2, Accessibility, UserPlus, Eye, Info, Cake, Building } from 'lucide-react';
import { cn } from '@/lib/utils';
import CordaoPopup from '@/components/CordaoPopup';
import CadastroManualDialog from '@/components/CadastroManualDialog';
import VisitanteDetailDialog from '@/components/VisitanteDetailDialog';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { ListaAniversariante, ListaInstituicao } from '@/types/listas';

const STORAGE_ANIVERSARIANTES = 'sentinela_aniversariantes';
const STORAGE_INSTITUICOES = 'sentinela_instituicoes';

function readAniversariantes(): ListaAniversariante[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_ANIVERSARIANTES) || '[]'); } catch { return []; }
}
function readInstituicoes(): ListaInstituicao[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_INSTITUICOES) || '[]'); } catch { return []; }
}

function getHojeDDMMYYYY(): string {
  const now = new Date();
  return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
}

export default function RecreadorPanel() {
  const { user } = useAuth();
  const { grupos, marcarCheckin } = useData();
  const [busca, setBusca] = useState('');
  const [visibleCount, setVisibleCount] = useState(30);
  const [selectedGrupo, setSelectedGrupo] = useState<GrupoVisita | null>(null);
  const [detailGrupo, setDetailGrupo] = useState<GrupoVisita | null>(null);
  const [cadastroOpen, setCadastroOpen] = useState(false);
  const [aniversariantes, setAniversariantes] = useState<ListaAniversariante[]>(readAniversariantes);
  const [instituicoes, setInstituicoes] = useState<ListaInstituicao[]>(readInstituicoes);

  const isObservador = user?.role === 'observador';
  const guiche = user?.guiche || 0;
  const hoje = getHojeDDMMYYYY();

  // Poll special lists every 3s (same as DataContext pattern)
  useEffect(() => {
    const interval = setInterval(() => {
      setAniversariantes(readAniversariantes());
      setInstituicoes(readInstituicoes());
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Only show visitors scheduled for today
  const gruposHoje = useMemo(() => {
    return grupos.filter(g => {
      if (g.dataAgendamento) return g.dataAgendamento === hoje;
      const created = new Date(g.criadoEm);
      return created.toLocaleDateString('pt-BR') === hoje;
    });
  }, [grupos, hoje]);

  // Special lists for today
  const anivHoje = useMemo(() => aniversariantes.filter(a => a.dataVisita === hoje), [aniversariantes, hoje]);
  const instHoje = useMemo(() => instituicoes.filter(i => i.dataVisita === hoje), [instituicoes, hoje]);

  const filtrados = useMemo(() => {
    const pending = gruposHoje.filter(g => !g.checkinRealizado);
    if (!busca.trim()) return pending;
    const term = busca.toLowerCase();
    return pending.filter(g =>
      g.responsavel.nome.toLowerCase().includes(term) ||
      g.responsavel.contato.includes(term) ||
      g.responsavel.criancas.some(c => c.nome.toLowerCase().includes(term))
    );
  }, [busca, gruposHoje]);

  const anivFiltrados = useMemo(() => {
    const pending = anivHoje.filter(a => !a.checkinRealizado);
    if (!busca.trim()) return pending;
    const term = busca.toLowerCase();
    return pending.filter(a =>
      a.nomeAniversariante.toLowerCase().includes(term) ||
      a.responsavelNome.toLowerCase().includes(term)
    );
  }, [busca, anivHoje]);

  const instFiltrados = useMemo(() => {
    const pending = instHoje.filter(i => !i.checkinRealizado);
    if (!busca.trim()) return pending;
    const term = busca.toLowerCase();
    return pending.filter(i =>
      i.nomeInstituicao.toLowerCase().includes(term) ||
      i.responsavelNome.toLowerCase().includes(term)
    );
  }, [busca, instHoje]);

  // Total counts for today (all types)
  const checkinHoje = useMemo(() => {
    const grupoCheckins = gruposHoje.filter(g => g.checkinRealizado && g.checkinData === hoje).length;
    const anivCheckins = anivHoje.filter(a => a.checkinRealizado).length;
    const instCheckins = instHoje.filter(i => i.checkinRealizado).length;
    return grupoCheckins + anivCheckins + instCheckins;
  }, [gruposHoje, anivHoje, instHoje, hoje]);

  const totalCriancasHoje = useMemo(() => {
    const fromGrupos = gruposHoje.filter(g => g.checkinRealizado).reduce((a, g) => a + g.responsavel.criancas.length, 0);
    const fromAniv = anivHoje.filter(a => a.checkinRealizado).reduce((a, l) => a + l.convidados.filter(c => c.tipo === 'crianca').length, 0);
    const fromInst = instHoje.filter(i => i.checkinRealizado).reduce((a, l) => a + l.criancas.length, 0);
    return fromGrupos + fromAniv + fromInst;
  }, [gruposHoje, anivHoje, instHoje]);

  const handleConfirm = () => {
    if (!selectedGrupo || !user) return;
    if (isObservador) {
      toast.info('Modo observador: check-in simulado (não registrado).');
      setSelectedGrupo(null);
      setBusca('');
      return;
    }
    marcarCheckin(selectedGrupo.id, guiche, user.nome);
    toast.success(`Check-in realizado com sucesso no Guichê ${String(guiche).padStart(2, '0')}.`, {
      description: `${selectedGrupo.responsavel.nome} — ${selectedGrupo.responsavel.criancas.length} criança(s)`,
    });
    setSelectedGrupo(null);
    setBusca('');
  };

  const marcarCheckinAniv = (id: string) => {
    if (isObservador) { toast.info('Modo observador.'); return; }
    const list = readAniversariantes().map(a => {
      if (a.id !== id) return a;
      return { ...a, checkinRealizado: true, checkinData: hoje, checkinHora: new Date().toLocaleTimeString('pt-BR'), guiche, atendidoPor: user?.nome };
    });
    localStorage.setItem(STORAGE_ANIVERSARIANTES, JSON.stringify(list));
    setAniversariantes(list);
    toast.success('Check-in do grupo de aniversário registrado!');
  };

  const marcarCheckinInst = (id: string) => {
    if (isObservador) { toast.info('Modo observador.'); return; }
    const list = readInstituicoes().map(i => {
      if (i.id !== id) return i;
      return { ...i, checkinRealizado: true, checkinData: hoje, checkinHora: new Date().toLocaleTimeString('pt-BR'), guiche, atendidoPor: user?.nome };
    });
    localStorage.setItem(STORAGE_INSTITUICOES, JSON.stringify(list));
    setInstituicoes(list);
    toast.success('Check-in da instituição registrado!');
  };

  const totalPendentes = filtrados.length + anivFiltrados.length + instFiltrados.length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Check-in de Visitantes
            {isObservador && (
              <span className="ml-2 inline-flex items-center gap-1 text-sm font-normal text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                <Eye className="h-3 w-3" />
                Modo Observador
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            {guiche > 0 ? `Guichê ${String(guiche).padStart(2, '0')} — ` : ''}{user?.nome} · {hoje}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => setCadastroOpen(true)} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Cadastro Manual
          </Button>
          <div className="flex items-center gap-4 bg-card rounded-xl shadow-card px-4 py-3">
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground font-mono-data">{checkinHoje}</p>
              <p className="text-[10px] text-muted-foreground">atendidos</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground font-mono-data">{totalCriancasHoje}</p>
              <p className="text-[10px] text-muted-foreground">crianças</p>
            </div>
          </div>
        </div>
      </div>

      {/* Summary badges for special lists */}
      {(anivHoje.length > 0 || instHoje.length > 0) && (
        <div className="flex items-center gap-3 flex-wrap">
          {anivHoje.length > 0 && (
            <div className="inline-flex items-center gap-1.5 bg-cordao-rosa/10 text-cordao-rosa px-3 py-1.5 rounded-lg text-sm font-medium">
              <Cake className="h-4 w-4" />
              {anivHoje.length} aniversário(s) hoje · {anivHoje.filter(a => a.checkinRealizado).length} presente(s)
            </div>
          )}
          {instHoje.length > 0 && (
            <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1.5 rounded-lg text-sm font-medium">
              <Building className="h-4 w-4" />
              {instHoje.length} instituição(ões) hoje · {instHoje.filter(i => i.checkinRealizado).length} presente(s)
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome do responsável, criança, instituição ou telefone..."
          className="pl-12 h-14 text-lg rounded-xl shadow-card border-0"
          autoFocus
        />
      </div>

      {/* Results */}
      <div className="space-y-3">
        {/* Aniversariantes section */}
        {anivFiltrados.length > 0 && (
          <>
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mt-2">
              <Cake className="h-4 w-4 text-cordao-rosa" />
              Aniversariantes ({anivFiltrados.length} pendente{anivFiltrados.length > 1 ? 's' : ''})
            </div>
            {anivFiltrados.map((aniv, i) => {
              const kids = aniv.convidados.filter(c => c.tipo === 'crianca').length;
              const adults = aniv.convidados.filter(c => c.tipo === 'acompanhante').length;
              return (
                <motion.div
                  key={aniv.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="bg-card rounded-xl shadow-card p-4 hover:shadow-elevated transition-shadow border-l-4 border-cordao-rosa"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Cake className="h-4 w-4 text-cordao-rosa flex-shrink-0" />
                        <h3 className="text-base font-bold text-foreground truncate">🎂 {aniv.nomeAniversariante}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Resp: {aniv.responsavelNome} · {aniv.responsavelCelular}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {kids} criança(s) · {adults} acompanhante(s) · {aniv.convidados.length} convidados total
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 ml-4">
                      <span className="text-xs text-muted-foreground">{aniv.convidados.length} convidado(s)</span>
                      <Button
                        size="sm"
                        className="gap-1.5"
                        onClick={() => marcarCheckinAniv(aniv.id)}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Check-in
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </>
        )}

        {/* Instituições section */}
        {instFiltrados.length > 0 && (
          <>
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mt-2">
              <Building className="h-4 w-4 text-primary" />
              Instituições ({instFiltrados.length} pendente{instFiltrados.length > 1 ? 's' : ''})
            </div>
            {instFiltrados.map((inst, i) => (
              <motion.div
                key={inst.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="bg-card rounded-xl shadow-card p-4 hover:shadow-elevated transition-shadow border-l-4 border-primary"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-primary flex-shrink-0" />
                      <h3 className="text-base font-bold text-foreground truncate">🏫 {inst.nomeInstituicao}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Resp: {inst.responsavelNome} · {inst.responsavelCelular}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {inst.criancas.length} criança(s) · {inst.adultos.length} adulto(s) · {inst.cidade}/{inst.estado}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 ml-4">
                    <span className="text-xs text-muted-foreground">{inst.criancas.length + inst.adultos.length} pessoas</span>
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={() => marcarCheckinInst(inst.id)}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Check-in
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </>
        )}

        {/* Agendamentos regulares */}
        {filtrados.length > 0 && (anivFiltrados.length > 0 || instFiltrados.length > 0) && (
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mt-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Agendamentos ({filtrados.length} pendente{filtrados.length > 1 ? 's' : ''})
          </div>
        )}

        {filtrados.map((grupo, i) => {
          const numAdultos = 1 + (grupo.responsavel.acompanhantes?.length || 0);
          return (
            <motion.div
              key={grupo.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="bg-card rounded-xl shadow-card p-4 hover:shadow-elevated transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => setDetailGrupo(grupo)}
                >
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-foreground truncate">{grupo.responsavel.nome}</h3>
                    <button
                      onClick={e => { e.stopPropagation(); setDetailGrupo(grupo); }}
                      className="p-0.5 rounded hover:bg-secondary transition-colors"
                      title="Ver detalhes"
                    >
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    {grupo.responsavel.criancas.some(c => c.pcd) && (
                      <Accessibility className="h-4 w-4 text-primary animate-pulse-glow flex-shrink-0" />
                    )}
                    {grupo.origem && grupo.origem !== 'agendamento' && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-secondary text-muted-foreground flex-shrink-0">
                        {getOrigemLabel(grupo.origem)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {grupo.responsavel.contato} · {grupo.responsavel.bairro}, {grupo.responsavel.cidade}
                  </p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold', getCordaoTailwindBg('rosa'), getCordaoTailwindText('rosa'))}>
                      {numAdultos}x Rosa
                    </span>
                    {grupo.responsavel.criancas.map(c => (
                      <span
                        key={c.id}
                        className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold', getCordaoTailwindBg(c.cordaoCor), getCordaoTailwindText(c.cordaoCor))}
                      >
                        {c.cordaoCor.charAt(0).toUpperCase() + c.cordaoCor.slice(1)}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 ml-4">
                  <span className="text-xs text-muted-foreground">{grupo.responsavel.criancas.length} criança(s)</span>
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedGrupo(grupo);
                    }}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Check-in
                  </Button>
                </div>
              </div>
            </motion.div>
          );
        })}

        {totalPendentes === 0 && busca && (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p className="text-lg font-medium">Nenhum visitante encontrado para hoje</p>
            <p className="text-sm">Não encontrado na base de hoje ({hoje}). Deseja realizar cadastro manual?</p>
            <Button variant="outline" className="mt-4 gap-2" onClick={() => setCadastroOpen(true)}>
              <UserPlus className="h-4 w-4" />
              Cadastro Manual / Lista Adicional
            </Button>
          </div>
        )}

        {!busca && totalPendentes > 0 && (
          <p className="text-center text-sm text-muted-foreground py-4">
            {totalPendentes} visitante(s)/grupo(s) pendente(s) para hoje — digite para buscar
          </p>
        )}

        {!busca && totalPendentes === 0 && gruposHoje.length === 0 && anivHoje.length === 0 && instHoje.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p className="text-lg font-medium">Nenhum visitante agendado para hoje</p>
            <p className="text-sm">Importe a planilha do dia no painel administrativo ou cadastre manualmente.</p>
          </div>
        )}
      </div>

      <CordaoPopup
        grupo={selectedGrupo}
        guiche={guiche}
        onConfirm={handleConfirm}
        onClose={() => setSelectedGrupo(null)}
      />

      <VisitanteDetailDialog
        grupo={detailGrupo}
        open={!!detailGrupo}
        onOpenChange={(open) => { if (!open) setDetailGrupo(null); }}
      />

      <CadastroManualDialog open={cadastroOpen} onOpenChange={setCadastroOpen} />
    </div>
  );
}
