import { useEffect } from 'react';
import { deveExecutarAgora, executarEncerramento } from '@/lib/encerramento';
import { toast } from 'sonner';

/** Verifica a cada minuto se atingiu o horário de encerramento operacional. */
export function useAutoEncerramento() {
  useEffect(() => {
    const tick = () => {
      try {
        if (deveExecutarAgora()) {
          const r = executarEncerramento('automatico');
          if (r.totalDevolvidos > 0) {
            toast.success(`Operação encerrada automaticamente · ${r.totalDevolvidos} cordões devolvidos`, { duration: 8000 });
          }
        }
      } catch { /* noop */ }
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);
}
