import { CordaoColor, getCordaoLabel } from '@/types';

export interface CordaoPrintItem {
  nome: string;
  cor: CordaoColor;
  detalhe?: string; // idade, parentesco, etc.
  pcd?: boolean;
  pcdDescricao?: string;
  guiche?: number;
}

const CORD_HEX: Record<CordaoColor, string> = {
  azul: '#1e88e5',
  verde: '#43a047',
  amarelo: '#fdd835',
  vermelho: '#e53935',
  rosa: '#ec407a',
  cinza: '#757575',
  preto: '#212121',
};

/**
 * Open a print window optimized for thermal label printers (58mm or 80mm).
 * Each item becomes one label. Works with any printer the OS recognizes.
 */
export function imprimirCordoes(items: CordaoPrintItem[], opts?: { largura?: '58mm' | '80mm'; titulo?: string }) {
  if (!items.length) return;
  const largura = opts?.largura || '80mm';
  const titulo = opts?.titulo || 'Cordões — Sentinela Infância';

  const win = window.open('', '_blank', 'width=400,height=600');
  if (!win) {
    alert('Não foi possível abrir a janela de impressão. Habilite popups para este site.');
    return;
  }

  const labels = items
    .map(item => {
      const hex = CORD_HEX[item.cor];
      const isLight = item.cor === 'amarelo';
      const text = isLight ? '#000' : '#fff';
      return `
        <div class="label">
          <div class="band" style="background:${hex};color:${text};">
            <div class="band-cor">${item.cor.toUpperCase()}</div>
            ${item.pcd ? '<div class="pcd">★ PCD</div>' : ''}
          </div>
          <div class="info">
            <div class="nome">${escapeHtml(item.nome)}</div>
            ${item.detalhe ? `<div class="detalhe">${escapeHtml(item.detalhe)}</div>` : ''}
            <div class="categ">${escapeHtml(getCordaoLabel(item.cor))}</div>
            ${item.pcd && item.pcdDescricao ? `<div class="pcd-desc">${escapeHtml(item.pcdDescricao)}</div>` : ''}
            ${item.guiche ? `<div class="guiche">Guichê ${String(item.guiche).padStart(2, '0')}</div>` : ''}
          </div>
        </div>
      `;
    })
    .join('');

  win.document.write(`<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(titulo)}</title>
<style>
  @page { size: ${largura} auto; margin: 2mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; padding: 0; color: #000; }
  .label { width: 100%; page-break-after: always; padding: 4mm 2mm; border-bottom: 1px dashed #999; }
  .label:last-child { page-break-after: auto; }
  .band { padding: 8mm 4mm; border-radius: 6px; text-align: center; font-weight: 800; position: relative; }
  .band-cor { font-size: 18pt; letter-spacing: 2px; }
  .pcd { position: absolute; top: 2mm; right: 2mm; font-size: 9pt; background: rgba(255,255,255,0.25); padding: 1mm 2mm; border-radius: 3px; }
  .info { padding: 3mm 2mm 0; text-align: center; }
  .nome { font-size: 16pt; font-weight: 800; line-height: 1.1; margin-bottom: 1mm; }
  .detalhe { font-size: 11pt; color: #444; margin-bottom: 1mm; }
  .categ { font-size: 9pt; color: #666; }
  .pcd-desc { font-size: 9pt; color: #c00; margin-top: 1mm; font-weight: 600; }
  .guiche { font-size: 9pt; color: #333; margin-top: 2mm; border-top: 1px solid #ddd; padding-top: 1mm; }
  @media screen { body { padding: 12px; background: #f5f5f5; } .label { background: #fff; max-width: ${largura === '58mm' ? '220px' : '300px'}; margin: 0 auto 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-radius: 4px; border-bottom: none; } }
</style>
</head><body>${labels}
<script>window.onload = function(){ setTimeout(function(){ window.print(); }, 250); };</script>
</body></html>`);
  win.document.close();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
