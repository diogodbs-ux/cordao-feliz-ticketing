import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, X, AlertCircle } from 'lucide-react';

interface QRScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (raw: string) => void;
}

const REGION_ID = 'qr-scanner-region';

export default function QRScanner({ open, onClose, onScan }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setError(null);
    setStarting(true);

    const start = async () => {
      try {
        // Wait a tick for the DOM region to render
        await new Promise(r => setTimeout(r, 50));
        if (cancelled) return;

        const instance = new Html5Qrcode(REGION_ID, { verbose: false });
        scannerRef.current = instance;

        await instance.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 260, height: 260 } },
          (decodedText) => {
            // Stop immediately on first read
            instance.stop().catch(() => {}).finally(() => {
              onScan(decodedText);
            });
          },
          () => {
            // ignore per-frame decode errors
          }
        );
        if (!cancelled) setStarting(false);
      } catch (err: any) {
        console.error('QR scanner error:', err);
        if (!cancelled) {
          setError(err?.message || 'Não foi possível acessar a câmera. Verifique as permissões.');
          setStarting(false);
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      const inst = scannerRef.current;
      if (inst) {
        Promise.resolve(inst.stop()).catch(() => {}).finally(() => {
          try { inst.clear(); } catch {}
        });
        scannerRef.current = null;
      }
    };
  }, [open, onScan]);

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            Ler QR Code do Visitante
          </DialogTitle>
          <DialogDescription>
            Aponte a câmera para o QR Code impresso ou no celular do visitante.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {error ? (
            <div className="flex items-start gap-2 bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ) : (
            <div className="relative bg-foreground/5 rounded-lg overflow-hidden aspect-square">
              <div id={REGION_ID} className="w-full h-full" />
              {starting && (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                  Iniciando câmera…
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose} className="gap-2">
              <X className="h-4 w-4" />
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
