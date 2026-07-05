// Sistema de branding customizável.
// Permite substituir a logo e o nome da organização durante o ano eleitoral
// (ou qualquer contexto) sem tocar no código. Persistência em localStorage;
// pode ser resetado a qualquer momento para voltar aos valores padrão.
import defaultLogo from '@/assets/logo-completa.png';

const KEY = 'sentinela_branding_v1';
const EVT = 'sentinela:branding-changed';

export interface Branding {
  /** Data URL (base64) da logo principal. Se vazio, usa a logo padrão. */
  logoDataUrl: string;
  /** Data URL da logo secundária (ex.: Governo do Estado). Opcional. */
  logoSecundariaDataUrl: string;
  /** Nome curto que aparece na sidebar, cabeçalhos e relatórios. */
  orgName: string;
  /** Texto exibido em rodapés e créditos. */
  orgFooter: string;
  /** Se true, oculta o logo padrão até que uma customização seja carregada. */
  ocultarLogoPadrao: boolean;
  atualizadoEm?: string;
}

const DEFAULT: Branding = {
  logoDataUrl: '',
  logoSecundariaDataUrl: '',
  orgName: 'Cidade Mais Infância',
  orgFooter: 'Governo do Estado do Ceará — Cidade Mais Infância',
  ocultarLogoPadrao: false,
};

export function getBranding(): Branding {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT };
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch { return { ...DEFAULT }; }
}

export function saveBranding(b: Partial<Branding>) {
  const merged = { ...getBranding(), ...b, atualizadoEm: new Date().toISOString() };
  localStorage.setItem(KEY, JSON.stringify(merged));
  window.dispatchEvent(new CustomEvent(EVT));
}

export function resetBranding() {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new CustomEvent(EVT));
}

/** URL utilizável em <img src> — data URL customizada ou fallback ao asset padrão. */
export function getLogoSrc(): string {
  const b = getBranding();
  if (b.logoDataUrl) return b.logoDataUrl;
  if (b.ocultarLogoPadrao) return ''; // esconde durante período eleitoral se não subiu nada
  return defaultLogo;
}

export function getLogoSecundariaSrc(): string {
  return getBranding().logoSecundariaDataUrl || '';
}

/** Data URL da logo (para uso em PDF/canvas). Retorna vazio se não houver logo válida. */
export async function getLogoDataUrlForCanvas(): Promise<string> {
  const src = getLogoSrc();
  if (!src) return '';
  if (src.startsWith('data:')) return src;
  // carrega o asset padrão como data URL
  try {
    const res = await fetch(src);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch { return ''; }
}

export function subscribeBranding(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener(EVT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(EVT, handler);
    window.removeEventListener('storage', handler);
  };
}

/** Converte um File (upload) em data URL, opcionalmente reescalando para caber em maxSide px. */
export async function fileToLogoDataUrl(file: File, maxSide = 512): Promise<string> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  // Reescala para PNG compacto (~<200KB) preservando transparência.
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = rawDataUrl;
    });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    if (!ctx) return rawDataUrl;
    ctx.drawImage(img, 0, 0, w, h);
    return cv.toDataURL('image/png');
  } catch {
    return rawDataUrl;
  }
}
