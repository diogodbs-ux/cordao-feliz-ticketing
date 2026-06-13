// Bootstrap global de sincronização offline.
// Quando voltar a conexão, processa automaticamente a fila pendente.
import { processarFila, pendentes } from './syncQueue';
import { toast } from 'sonner';

let started = false;

export function initOfflineAutoSync() {
  if (started) return;
  started = true;

  const tryProcess = async (motivo: 'online' | 'tick' | 'manual') => {
    if (!navigator.onLine) return;
    const qtd = pendentes();
    if (qtd === 0) return;
    const r = await processarFila();
    if (r.ok > 0) {
      toast.success(`Sincronização automática: ${r.ok} ação(ões) enviadas`, {
        description: motivo === 'online' ? 'Conexão restabelecida.' : undefined,
      });
    }
  };

  window.addEventListener('online', () => {
    toast.success('Conexão restabelecida — sincronizando ações pendentes…');
    tryProcess('online');
  });
  window.addEventListener('offline', () => {
    toast.warning('Sem conexão — ações serão enfileiradas e enviadas depois.');
  });

  // Pulse periódico em segundo plano
  setInterval(() => tryProcess('tick'), 30000);

  // Tenta imediatamente ao abrir
  setTimeout(() => tryProcess('tick'), 1500);
}
