import { useEffect, useState, useCallback } from 'react';

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

export function usePWAInstall() {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches
  );

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as BIPEvent); };
    const onInstalled = () => { setInstalled(true); setEvt(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!evt) return false;
    await evt.prompt();
    const res = await evt.userChoice;
    setEvt(null);
    return res.outcome === 'accepted';
  }, [evt]);

  return { canInstall: !!evt && !installed, installed, promptInstall };
}
