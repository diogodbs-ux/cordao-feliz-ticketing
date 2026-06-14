import { CordaoColor, getCordaoLabel } from '@/types';
import QRCode from 'qrcode';

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

/**
 * Imprime um cartão de acompanhamento ao vivo (QR público + token + instruções).
 * Vai para o responsável, dispensa login.
 */
export async function imprimirCartaoRastreamento(opts: {
  token: string;
  url: string;
  responsavelNome: string;
  protocolo: string;
  largura?: '58mm' | '80mm';
}) {
  const largura = opts.largura || '80mm';
  const qrDataUrl = await QRCode.toDataURL(opts.url, { width: 260, margin: 1, errorCorrectionLevel: 'M' });

  const win = window.open('', '_blank', 'width=400,height=600');
  if (!win) { alert('Habilite popups para imprimir o cartão.'); return; }

  win.document.write(`<!doctype html>
<html><head><meta charset="utf-8"><title>Acompanhamento — ${escapeHtml(opts.responsavelNome)}</title>
<style>
  @page { size: ${largura} auto; margin: 2mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; padding: 0; color: #000; }
  .card { padding: 4mm 3mm; text-align: center; }
  .titulo { background: linear-gradient(135deg,#2563eb,#7c3aed); color:#fff; padding: 3mm; border-radius: 6px; font-weight: 800; font-size: 11pt; letter-spacing: .5px; }
  .qr { margin: 4mm auto 2mm; width: 60mm; max-width: 100%; }
  .qr img { width: 100%; height: auto; }
  .token { font-family: ui-monospace, Menlo, monospace; font-size: 14pt; font-weight: 800; letter-spacing: 3px; margin: 1mm 0; }
  .resp { font-size: 10pt; font-weight: 700; }
  .proto { font-size: 8pt; color: #555; margin-bottom: 2mm; }
  .inst { font-size: 8pt; color: #333; text-align: left; margin-top: 3mm; line-height: 1.4; border-top: 1px dashed #999; padding-top: 2mm; }
  .inst b { color: #2563eb; }
  @media screen { body { padding: 12px; background: #f5f5f5; } .card { background:#fff; max-width: 300px; margin: 0 auto; box-shadow: 0 1px 3px rgba(0,0,0,.1); border-radius: 6px; } }
</style></head><body>
<div class="card">
  <div class="titulo">📍 Acompanhamento ao Vivo</div>
  <div class="qr"><img src="${qrDataUrl}" alt="QR" /></div>
  <div class="token">${escapeHtml(opts.token)}</div>
  <div class="resp">${escapeHtml(opts.responsavelNome)}</div>
  <div class="proto">Protocolo ${escapeHtml(opts.protocolo)}</div>
  <div class="inst">
    <b>1.</b> Aponte a câmera do celular para o QR.<br/>
    <b>2.</b> Digite o <b>nome da sua criança</b>.<br/>
    <b>3.</b> Veja em tempo real onde ela está e quanto tempo já está no espaço.<br/>
    <br/>Link válido até as 17h00 de hoje.
  </div>
</div>
<script>window.onload=function(){setTimeout(function(){window.print();},250);};</script>
</body></html>`);
  win.document.close();
}
