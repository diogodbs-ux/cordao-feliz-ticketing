import { useEffect, useState } from 'react';
import { Wifi, WifiOff, CloudUpload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { pendentes, processarFila } from '@/lib/syncQueue';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function OfflineBadge() {
  const [online, setOnline] = useState(navigator.onLine);
  const [qtd, setQtd] = useState(pendentes());

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    const upd = () => setQtd(pendentes());
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    window.addEventListener('sync-queue-changed', upd);
    const id = setInterval(upd, 5000);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      window.removeEventListener('sync-queue-changed', upd);
      clearInterval(id);
    };
  }, []);

  const sincronizar = async () => {
    const r = await processarFila();
    setQtd(pendentes());
    toast.success(`${r.ok} ação(ões) sincronizada(s)`);
  };

  return (
    <div className="flex items-center gap-2">
      <div className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-semibold',
        online ? 'bg-cordao-verde/10 text-cordao-verde' : 'bg-cordao-vermelho/10 text-cordao-vermelho'
      )} title={online ? 'Online — dados salvos localmente' : 'Offline — ações enfileiradas'}>
        {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
        {online ? 'Online' : 'Offline'}
      </div>
      {qtd > 0 && (
        <Button size="sm" variant="outline" className="h-6 px-2 gap-1 text-[10px]" onClick={sincronizar} disabled={!online}>
          <CloudUpload className="h-3 w-3" />
          {qtd} pendente(s)
        </Button>
      )}
    </div>
  );
}
