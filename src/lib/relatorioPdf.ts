// Geração de Relatório Final de Operação em PDF profissional (jsPDF + autoTable)
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoUrl from '@/assets/logo-completa.png';
import { CordaoColor, getCordaoLabel } from '@/types';

export interface RelatorioFinalData {
  periodoLabel: string;
  dataLabel: string;
  totalVisitantes: number;
  totalCriancas: number;
  totalAdultos: number;
  totalResponsaveis: number;
  totalPCD: number;
  totalCordoes: number;
  primeiroCheckin: string;
  ultimoCheckin: string;
  tempoOperacao: string;
  avgPerGuiche: number;
  pendentes: number;
  porCor: Record<CordaoColor, number>;
  porGuiche: Record<number, number>;
  hourly: Record<number, number>;
  checkins: Array<{
    responsavel: string;
    bairroCidade: string;
    criancas: number;
    guiche: number;
    atendente: string;
    horario: string;
    cordoes: string;
  }>;
}

const CORDAO_HEX: Record<CordaoColor, string> = {
  azul: '#4A90D9', verde: '#3CB371', amarelo: '#F5C518',
  vermelho: '#E74C3C', rosa: '#E96D9B', cinza: '#6B7B8D', preto: '#1E293B',
};

async function loadImageAsDataURL(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export async function gerarRelatorioFinalPDF(d: RelatorioFinalData): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;

  let logoData: string | null = null;
  try { logoData = await loadImageAsDataURL(logoUrl); } catch { /* ignore */ }

  // ---------- HEADER (em cada página via didDrawPage) ----------
  const drawHeader = () => {
    doc.setFillColor(247, 249, 252);
    doc.rect(0, 0, pageW, 22, 'F');
    if (logoData) {
      try { doc.addImage(logoData, 'PNG', margin, 5, 14, 14); } catch { /* */ }
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(20, 25, 40);
    doc.text('Relatório Final de Operação', margin + 18, 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(110, 120, 140);
    doc.text(`Cidade Mais Infância · Sentinela · ${d.periodoLabel} (${d.dataLabel})`, margin + 18, 16);
    doc.setDrawColor(220, 226, 234);
    doc.setLineWidth(0.2);
    doc.line(margin, 22, pageW - margin, 22);
  };

  const drawFooter = (pageNum: number, total: number) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(140, 150, 165);
    doc.text(
      `Gerado em ${new Date().toLocaleString('pt-BR')}`,
      margin, pageH - 8,
    );
    doc.text(`Página ${pageNum} / ${total}`, pageW - margin, pageH - 8, { align: 'right' });
  };

  drawHeader();
  let y = 30;

  // ---------- KPIs ----------
  const kpis = [
    { label: 'Total Visitantes', value: d.totalVisitantes, color: '#3B82F6' },
    { label: 'Crianças', value: d.totalCriancas, color: '#3CB371' },
    { label: 'Adultos (Rosa)', value: d.totalAdultos, color: '#E96D9B' },
    { label: 'PCD Atendidos', value: d.totalPCD, color: '#1E293B' },
  ];
  const kpiW = (pageW - margin * 2 - 9) / 4;
  kpis.forEach((k, i) => {
    const x = margin + i * (kpiW + 3);
    const [r, g, b] = hexToRgb(k.color);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(225, 230, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, kpiW, 22, 2, 2, 'FD');
    doc.setFillColor(r, g, b);
    doc.rect(x, y, 1.5, 22, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(20, 25, 40);
    doc.text(String(k.value), x + 5, y + 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(110, 120, 140);
    doc.text(k.label.toUpperCase(), x + 5, y + 17);
  });
  y += 28;

  // ---------- DADOS DA OPERAÇÃO ----------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(20, 25, 40);
  doc.text('Dados da Operação', margin, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 2.5, textColor: [40, 50, 70] },
    headStyles: { fillColor: [241, 245, 249], textColor: [60, 70, 90], fontStyle: 'bold' },
    head: [['Primeiro Check-in', 'Último Check-in', 'Tempo de Operação', 'Média/Guichê', 'Pendentes (Hoje)']],
    body: [[
      d.primeiroCheckin || '—',
      d.ultimoCheckin || '—',
      d.tempoOperacao || '—',
      `${d.avgPerGuiche} atend.`,
      String(d.pendentes),
    ]],
    didDrawPage: () => { drawHeader(); },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // ---------- CONTAGEM DE CORDÕES ----------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(20, 25, 40);
  doc.text(`Contagem Oficial de Cordões — ${d.periodoLabel}`, margin, y);
  y += 4;

  const total = d.totalCordoes || 1;
  const cores: CordaoColor[] = ['azul', 'verde', 'amarelo', 'vermelho', 'rosa', 'cinza', 'preto'];
  const rowH = 7;
  cores.forEach(cor => {
    const qtd = d.porCor[cor] || 0;
    const [r, g, b] = hexToRgb(CORDAO_HEX[cor]);
    // bullet
    doc.setFillColor(r, g, b);
    doc.circle(margin + 2, y + 2.5, 2, 'F');
    // label
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(40, 50, 70);
    doc.text(getCordaoLabel(cor), margin + 7, y + 3.5);
    // bar bg
    const barX = margin + 65;
    const barW = pageW - margin - barX - 18;
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(barX, y, barW, rowH - 2, 1.2, 1.2, 'F');
    if (qtd > 0) {
      const w = Math.max((qtd / total) * barW, 4);
      doc.setFillColor(r, g, b);
      doc.roundedRect(barX, y, w, rowH - 2, 1.2, 1.2, 'F');
    }
    // value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(20, 25, 40);
    doc.text(String(qtd), pageW - margin, y + 3.7, { align: 'right' });
    y += rowH;
  });
  y += 2;
  doc.setDrawColor(220, 226, 234);
  doc.line(margin, y, pageW - margin, y);
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Total de Cordões Entregues', margin, y);
  doc.setFontSize(14);
  doc.setTextColor(59, 130, 246);
  doc.text(String(d.totalCordoes), pageW - margin, y + 1, { align: 'right' });
  y += 10;

  // ---------- PERFORMANCE POR GUICHÊ ----------
  if (y > pageH - 60) { doc.addPage(); drawHeader(); y = 30; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(20, 25, 40);
  doc.text('Performance por Guichê', margin, y);
  y += 4;
  const guicheRow = [1, 2, 3, 4, 5, 6].map(g => [
    `Guichê ${String(g).padStart(2, '0')}`,
    String(d.porGuiche[g] || 0),
  ]);
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [241, 245, 249], textColor: [60, 70, 90], fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    head: [['Guichê', 'Atendimentos']],
    body: guicheRow,
    didDrawPage: () => { drawHeader(); },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // ---------- FLUXO POR HORA ----------
  const hourly = Object.entries(d.hourly).sort(([a], [b]) => Number(a) - Number(b));
  if (hourly.length > 0) {
    if (y > pageH - 60) { doc.addPage(); drawHeader(); y = 30; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(20, 25, 40);
    doc.text('Fluxo por Hora', margin, y);
    y += 6;

    const chartH = 35;
    const chartW = pageW - margin * 2;
    const maxV = Math.max(...hourly.map(([, v]) => v));
    const barW = (chartW - 10) / hourly.length;
    // axis
    doc.setDrawColor(220, 226, 234);
    doc.line(margin, y + chartH, margin + chartW, y + chartH);
    hourly.forEach(([h, v], i) => {
      const bh = (Number(v) / maxV) * (chartH - 4);
      const bx = margin + 5 + i * barW;
      doc.setFillColor(59, 130, 246);
      doc.roundedRect(bx, y + chartH - bh, barW * 0.7, bh, 0.8, 0.8, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(110, 120, 140);
      doc.text(`${h}h`, bx + (barW * 0.7) / 2, y + chartH + 4, { align: 'center' });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(40, 50, 70);
      doc.text(String(v), bx + (barW * 0.7) / 2, y + chartH - bh - 1.5, { align: 'center' });
    });
    y += chartH + 10;
  }

  // ---------- REGISTRO DETALHADO ----------
  if (d.checkins.length > 0) {
    if (y > pageH - 50) { doc.addPage(); drawHeader(); y = 30; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(20, 25, 40);
    doc.text(`Registro Detalhado de Check-ins (${d.checkins.length})`, margin, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
      head: [['Responsável', 'Bairro/Cidade', 'Cri.', 'Guichê', 'Atendente', 'Horário', 'Cordões']],
      body: d.checkins.map(c => [
        c.responsavel, c.bairroCidade, c.criancas, String(c.guiche).padStart(2, '0'),
        c.atendente, c.horario, c.cordoes,
      ]),
      columnStyles: {
        2: { halign: 'center' }, 3: { halign: 'center' },
        5: { halign: 'center' },
      },
      didDrawPage: () => { drawHeader(); },
    });
  }

  // ---------- FOOTERS ----------
  const total2 = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= total2; i++) {
    doc.setPage(i);
    drawFooter(i, total2);
  }

  doc.save(`relatorio-final-${d.periodoLabel.toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`);
}
