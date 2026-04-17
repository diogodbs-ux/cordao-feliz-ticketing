import QRCode from 'qrcode';

/**
 * QR Code payload structure for Sentinela Infância visitors.
 * Uses a short, stable identifier (group ID) so the scanner can look up
 * the visitor regardless of changes to name/phone.
 */
export interface QRPayload {
  v: 1; // version
  t: 'g' | 'a' | 'i'; // grupo | aniversariante | instituicao
  id: string;
}

export function encodePayload(p: QRPayload): string {
  return `SENT:${p.v}:${p.t}:${p.id}`;
}

export function decodePayload(raw: string): QRPayload | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('SENT:')) {
    // Fallback: treat raw value as a grupo id (for QR codes coming from SPS-CE)
    return { v: 1, t: 'g', id: trimmed };
  }
  const parts = trimmed.split(':');
  if (parts.length !== 4) return null;
  const [, v, t, id] = parts;
  if (v !== '1') return null;
  if (t !== 'g' && t !== 'a' && t !== 'i') return null;
  return { v: 1, t: t as QRPayload['t'], id };
}

export async function generateQRDataURL(payload: QRPayload, size = 256): Promise<string> {
  return QRCode.toDataURL(encodePayload(payload), {
    width: size,
    margin: 1,
    errorCorrectionLevel: 'M',
  });
}
