import { motion, AnimatePresence } from 'framer-motion';
import { GrupoVisita, getCordaoTailwindBg, getCordaoTailwindText, getCordaoLabel, CordaoColor, calcAdultCordoes } from '@/types';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Accessibility, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CordaoPopupProps {
  grupo: GrupoVisita | null;
  guiche: number;
  onConfirm: () => void;
  onClose: () => void;
}

export default function CordaoPopup({ grupo, guiche, onConfirm, onClose }: CordaoPopupProps) {
  if (!grupo) return null;

  const numAcompanhantes = grupo.responsavel.acompanhantes?.length || 0;
  const totalAdultos = 1 + numAcompanhantes; // responsável + acompanhantes cadastrados

  const membros: { nome: string; cor: CordaoColor; idade?: number; pcd?: boolean; pcdDesc?: string; tipo: string }[] = [
    // Responsável (always 1)
    {
      nome: grupo.responsavel.nome,
      cor: 'rosa' as CordaoColor,
      tipo: 'Responsável',
    },
    // Only registered companions
    ...(grupo.responsavel.acompanhantes || []).map((a, i) => ({
      nome: a.nome || `Acompanhante ${i + 1}`,
      cor: 'rosa' as CordaoColor,
      tipo: a.parentesco || 'Acompanhante',
    })),
    ...grupo.responsavel.criancas.map(c => ({
      nome: c.nome,
      cor: c.cordaoCor,
      idade: c.idade,
      pcd: c.pcd,
      pcdDesc: c.pcdDescricao,
      tipo: `${c.idade} anos`,
    })),
  ];

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
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div>
              <h2 className="text-xl font-bold text-foreground">Matriz de Entrega de Cordões</h2>
              <p className="text-sm text-muted-foreground mt-1">Guichê {String(guiche).padStart(2, '0')} — Verifique as cores e entregue os cartões</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-secondary rounded-lg transition-colors">
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          {/* Grid de membros */}
          <div className="p-6">
            <div className={cn(
              'grid gap-4',
              membros.length <= 2 ? 'grid-cols-1 sm:grid-cols-2' :
              membros.length <= 4 ? 'grid-cols-2 md:grid-cols-4' :
              'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
            )}>
              {membros.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="rounded-xl overflow-hidden shadow-card border border-border"
                >
                  {/* Faixa de cor */}
                  <div className={cn('h-16 flex items-center justify-center', getCordaoTailwindBg(m.cor))}>
                    <span className={cn('text-lg font-bold uppercase tracking-wider', getCordaoTailwindText(m.cor))}>
                      {m.cor}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="p-4 space-y-2">
                    <p className="text-lg font-bold text-foreground leading-tight">{m.nome}</p>
                    <p className="text-sm text-muted-foreground">{m.tipo}</p>
                    {m.pcd && (
                      <div className="flex items-center gap-1.5 text-primary">
                        <Accessibility className="h-4 w-4 animate-pulse-glow" />
                        <span className="text-xs font-semibold">{m.pcdDesc || 'PCD'}</span>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">{getCordaoLabel(m.cor)}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Summary */}
            <div className="mt-6 bg-secondary/50 rounded-xl p-4">
              <p className="text-sm font-medium text-foreground mb-2">Resumo de Cordões para Entregar:</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(
                  membros.reduce((acc, m) => {
                    acc[m.cor] = (acc[m.cor] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)
                ).map(([cor, qtd]) => (
                  <span
                    key={cor}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold',
                      getCordaoTailwindBg(cor as CordaoColor),
                      getCordaoTailwindText(cor as CordaoColor)
                    )}
                  >
                    {qtd}x {cor.toUpperCase()}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-border flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={onConfirm} className="gap-2 px-8">
              <CheckCircle2 className="h-4 w-4" />
              Confirmar Entrega e Check-in
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
