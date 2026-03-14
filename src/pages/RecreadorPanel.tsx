import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getCordaoTailwindBg, getCordaoTailwindText, getCordaoLabel, GrupoVisita } from '@/types';
import { Search, Users, CheckCircle2, Accessibility, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import CordaoPopup from '@/components/CordaoPopup';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export default function RecreadorPanel() {
  const { user } = useAuth();
  const { grupos, marcarCheckin } = useData();
  const [busca, setBusca] = useState('');
  const [selectedGrupo, setSelectedGrupo] = useState<GrupoVisita | null>(null);

  const guiche = user?.guiche || 1;

  const filtrados = useMemo(() => {
    if (!busca.trim()) return grupos.filter(g => !g.checkinRealizado);
    const term = busca.toLowerCase();
    return grupos.filter(g => {
      if (g.checkinRealizado) return false;
      return (
        g.responsavel.nome.toLowerCase().includes(term) ||
        g.responsavel.contato.includes(term) ||
        g.responsavel.criancas.some(c => c.nome.toLowerCase().includes(term))
      );
    });
  }, [busca, grupos]);

  const checkinHoje = useMemo(() => {
    const hoje = new Date().toLocaleDateString('pt-BR');
    return grupos.filter(g => g.checkinRealizado && g.checkinData === hoje).length;
  }, [grupos]);

  const handleConfirm = () => {
    if (!selectedGrupo || !user) return;
    marcarCheckin(selectedGrupo.id, guiche, user.nome);
    toast.success(`Check-in realizado com sucesso no Guichê ${String(guiche).padStart(2, '0')}.`, {
      description: `${selectedGrupo.responsavel.nome} — ${selectedGrupo.responsavel.criancas.length} criança(s)`,
    });
    setSelectedGrupo(null);
    setBusca('');
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Check-in de Visitantes</h1>
          <p className="text-sm text-muted-foreground">Guichê {String(guiche).padStart(2, '0')} — {user?.nome}</p>
        </div>
        <div className="flex items-center gap-2 bg-card rounded-xl shadow-card px-4 py-3">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-2xl font-bold text-foreground font-mono-data">{checkinHoje}</p>
            <p className="text-[10px] text-muted-foreground">atendidos hoje</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome do responsável, criança ou telefone..."
          className="pl-12 h-14 text-lg rounded-xl shadow-card border-0"
          autoFocus
        />
      </div>

      {/* Results */}
      <div className="space-y-3">
        {filtrados.length === 0 && busca && (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p className="text-lg font-medium">Nenhum visitante encontrado</p>
            <p className="text-sm">CPF não encontrado na base de hoje. Deseja realizar cadastro manual?</p>
          </div>
        )}

        {filtrados.slice(0, 20).map((grupo, i) => (
          <motion.div
            key={grupo.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="bg-card rounded-xl shadow-card p-4 hover:shadow-elevated transition-shadow cursor-pointer"
            onClick={() => setSelectedGrupo(grupo)}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-foreground truncate">{grupo.responsavel.nome}</h3>
                  {grupo.responsavel.criancas.some(c => c.pcd) && (
                    <Accessibility className="h-4 w-4 text-primary animate-pulse-glow flex-shrink-0" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {grupo.responsavel.contato} · {grupo.responsavel.bairro}, {grupo.responsavel.cidade}
                </p>
                <div className="flex items-center gap-1.5 mt-2">
                  <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold', getCordaoTailwindBg('rosa'), getCordaoTailwindText('rosa'))}>
                    Rosa
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
                <Button size="sm" className="gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Check-in
                </Button>
              </div>
            </div>
          </motion.div>
        ))}

        {!busca && filtrados.length > 0 && (
          <p className="text-center text-sm text-muted-foreground py-4">
            {filtrados.length} visitante(s) pendente(s) — digite para buscar
          </p>
        )}
      </div>

      {/* Cordão Popup */}
      <CordaoPopup
        grupo={selectedGrupo}
        guiche={guiche}
        onConfirm={handleConfirm}
        onClose={() => setSelectedGrupo(null)}
      />
    </div>
  );
}
