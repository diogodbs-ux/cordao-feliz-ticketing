import { GrupoVisita, CordaoColor, calcAdultCordoes } from '@/types';

export interface FechamentoNumeros {
  data: string; // dd/mm/yyyy
  porCor: Record<CordaoColor, number>;
  totalCriancas: number;
  totalAdultos: number;
  total: number;
  totalPCD: number;
  porGuiche: Record<number, number>;
  totalGrupos: number;
}

export function calcularFechamento(grupos: GrupoVisita[], dataAlvo: string): FechamentoNumeros {
  const checkedIn = grupos.filter(g => g.checkinRealizado && g.checkinData === dataAlvo);
  const porCor: Record<CordaoColor, number> = { azul: 0, verde: 0, amarelo: 0, vermelho: 0, rosa: 0, cinza: 0, preto: 0 };
  const porGuiche: Record<number, number> = {};
  let totalCriancas = 0, totalAdultos = 0, totalPCD = 0;

  checkedIn.forEach(g => {
    const numCriancas = g.responsavel.criancas.length;
    const numAdultos = calcAdultCordoes(numCriancas);
    totalCriancas += numCriancas;
    totalAdultos += numAdultos;
    porCor.rosa += numAdultos;
    g.responsavel.criancas.forEach(c => {
      porCor[c.cordaoCor] = (porCor[c.cordaoCor] || 0) + 1;
      if (c.pcd) totalPCD++;
    });
    if (g.guiche) porGuiche[g.guiche] = (porGuiche[g.guiche] || 0) + 1;
  });

  return {
    data: dataAlvo,
    porCor,
    totalCriancas,
    totalAdultos,
    total: totalCriancas + totalAdultos,
    totalPCD,
    porGuiche,
    totalGrupos: checkedIn.length,
  };
}

export function formatWhatsApp(f: FechamentoNumeros): string {
  const linhas: string[] = [];
  linhas.push(f.data);
  linhas.push('');
  if (f.porCor.azul > 0) linhas.push(`Azul: ${f.porCor.azul}`);
  if (f.porCor.verde > 0) linhas.push(`Verde: ${f.porCor.verde}`);
  if (f.porCor.amarelo > 0) linhas.push(`Amarelo: ${f.porCor.amarelo}`);
  if (f.porCor.vermelho > 0) linhas.push(`Vermelho: ${f.porCor.vermelho}`);
  if (f.porCor.rosa > 0) linhas.push(`Rosas: ${f.porCor.rosa}`);
  if (f.porCor.cinza > 0) linhas.push(`Cinzas: ${f.porCor.cinza}`);
  if (f.porCor.preto > 0) linhas.push(`Pretos: ${f.porCor.preto}`);
  linhas.push('');
  linhas.push(`Crianças: ${f.totalCriancas}`);
  linhas.push(`Adultos: ${f.totalAdultos}`);
  linhas.push(`Total: ${f.total}`);
  return linhas.join('\n');
}

const COR_HEX: Record<CordaoColor, string> = {
  azul: '#4A90D9', verde: '#3CB371', amarelo: '#F5C518',
  vermelho: '#E74C3C', rosa: '#E96D9B', cinza: '#6B7B8D', preto: '#1E293B',
};
const COR_LABEL: Record<CordaoColor, string> = {
  azul: 'Azul', verde: 'Verde', amarelo: 'Amarelo',
  vermelho: 'Vermelho', rosa: 'Rosas', cinza: 'Cinzas', preto: 'Pretos',
};

export async function gerarImagemPNG(f: FechamentoNumeros): Promise<Blob> {
  const W = 1080, H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0F172A');
  grad.addColorStop(1, '#1E293B');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

  // Header
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 48px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Fechamento Operacional', W / 2, 90);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '28px system-ui, -apple-system, sans-serif';
  ctx.fillText('Cidade Mais Infância — ' + f.data, W / 2, 140);

  // Cordões
  ctx.textAlign = 'left';
  let y = 230;
  const cores: CordaoColor[] = ['azul', 'verde', 'amarelo', 'vermelho', 'rosa', 'cinza', 'preto'];
  cores.forEach(cor => {
    const qtd = f.porCor[cor];
    if (qtd === 0) return;
    // bullet
    ctx.fillStyle = COR_HEX[cor];
    ctx.beginPath(); ctx.arc(120, y - 14, 22, 0, Math.PI * 2); ctx.fill();
    // label
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '36px system-ui, -apple-system, sans-serif';
    ctx.fillText(COR_LABEL[cor], 170, y);
    // value
    ctx.textAlign = 'right';
    ctx.font = 'bold 44px ui-monospace, monospace';
    ctx.fillStyle = COR_HEX[cor];
    ctx.fillText(String(qtd), W - 100, y);
    ctx.textAlign = 'left';
    y += 75;
  });

  // Divider
  y += 20;
  ctx.strokeStyle = '#334155'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(100, y); ctx.lineTo(W - 100, y); ctx.stroke();
  y += 60;

  // Totals
  const totals = [
    { label: 'Crianças', value: f.totalCriancas, color: '#60A5FA' },
    { label: 'Adultos', value: f.totalAdultos, color: '#E96D9B' },
  ];
  totals.forEach(t => {
    ctx.fillStyle = '#CBD5E1';
    ctx.font = '34px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(t.label, 120, y);
    ctx.fillStyle = t.color;
    ctx.font = 'bold 44px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(String(t.value), W - 100, y);
    y += 70;
  });

  // Total grande
  y += 20;
  ctx.fillStyle = '#1E40AF';
  ctx.fillRect(80, y, W - 160, 180);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '32px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('TOTAL DE VISITANTES', W / 2, y + 60);
  ctx.font = 'bold 96px ui-monospace, monospace';
  ctx.fillText(String(f.total), W / 2, y + 150);

  // Footer
  ctx.fillStyle = '#64748B';
  ctx.font = '20px system-ui, -apple-system, sans-serif';
  ctx.fillText('Sentinela Infância · Gerado em ' + new Date().toLocaleString('pt-BR'), W / 2, H - 40);

  return new Promise((resolve) => {
    canvas.toBlob(b => resolve(b!), 'image/png');
  });
}

export async function gerarPDF(f: FechamentoNumeros): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  let y = 20;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Fechamento Operacional Diário', W / 2, y, { align: 'center' });
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(100);
  doc.text('Cidade Mais Infância', W / 2, y, { align: 'center' });
  y += 6;
  doc.setFontSize(11);
  doc.text(`Data de operação: ${f.data}`, W / 2, y, { align: 'center' });
  y += 4;
  doc.text(`Emitido em: ${new Date().toLocaleString('pt-BR')}`, W / 2, y, { align: 'center' });
  y += 12;

  doc.setDrawColor(200);
  doc.line(15, y, W - 15, y);
  y += 10;

  // Cordões
  doc.setTextColor(20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Distribuição por Cor de Cordão', 15, y);
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);

  const cores: CordaoColor[] = ['azul', 'verde', 'amarelo', 'vermelho', 'rosa', 'cinza', 'preto'];
  cores.forEach(cor => {
    const qtd = f.porCor[cor];
    if (qtd === 0) return;
    const [r, g, b] = hexToRgb(COR_HEX[cor]);
    doc.setFillColor(r, g, b);
    doc.circle(20, y - 1.5, 2.5, 'F');
    doc.setTextColor(20);
    doc.text(COR_LABEL[cor], 27, y);
    doc.setFont('helvetica', 'bold');
    doc.text(String(qtd), W - 20, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += 8;
  });

  y += 4;
  doc.line(15, y, W - 15, y);
  y += 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Resumo Final', 15, y);
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);

  const linhas = [
    ['Crianças', f.totalCriancas],
    ['Adultos', f.totalAdultos],
    ['Total de Visitantes', f.total],
    ['Grupos atendidos', f.totalGrupos],
    ['Visitantes PCD', f.totalPCD],
  ];
  linhas.forEach(([label, val]) => {
    doc.text(String(label), 20, y);
    doc.setFont('helvetica', 'bold');
    doc.text(String(val), W - 20, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += 7;
  });

  // Guichês
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Atendimentos por Guichê', 15, y);
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  for (let g = 1; g <= 6; g++) {
    doc.text(`Guichê ${String(g).padStart(2, '0')}`, 20, y);
    doc.setFont('helvetica', 'bold');
    doc.text(String(f.porGuiche[g] || 0), W - 20, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += 7;
  }

  // Footer
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text('Sentinela Infância · Relatório gerado automaticamente a partir dos check-ins do dia.', W / 2, 285, { align: 'center' });

  return doc.output('blob');
}

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '');
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
}
