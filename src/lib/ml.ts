// Machine Learning utilities for Sentinela Infância
// Implements: Linear Regression, Peak Prediction, Anomaly Detection, Trend Analysis

import { CheckinRegistro, CordaoColor } from '@/types';

// ============================================
// 1. REGRESSÃO LINEAR SIMPLES
// ============================================
interface LinearModel {
  slope: number;
  intercept: number;
  r2: number;
}

export function linearRegression(xs: number[], ys: number[]): LinearModel {
  const n = xs.length;
  if (n < 2) return { slope: 0, intercept: ys[0] || 0, r2: 0 };

  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0);
  const sumXX = xs.reduce((a, x) => a + x * x, 0);
  const sumYY = ys.reduce((a, y) => a + y * y, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // R² (coeficiente de determinação)
  const meanY = sumY / n;
  const ssRes = ys.reduce((a, y, i) => a + Math.pow(y - (slope * xs[i] + intercept), 2), 0);
  const ssTot = ys.reduce((a, y) => a + Math.pow(y - meanY, 2), 0);
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

  return { slope, intercept, r2 };
}

export function predict(model: LinearModel, x: number): number {
  return Math.max(0, Math.round(model.slope * x + model.intercept));
}

// ============================================
// 2. PREVISÃO DE HORÁRIO DE PICO
// ============================================
export interface HourlyData {
  hour: number;
  count: number;
  predicted?: number;
}

export function analyzeHourlyPattern(checkins: CheckinRegistro[]): HourlyData[] {
  const hourCounts: Record<number, number[]> = {};

  // Agrupar por hora
  checkins.forEach(c => {
    const date = new Date(c.dataHora);
    const hour = date.getHours();
    if (!hourCounts[hour]) hourCounts[hour] = [];
    hourCounts[hour].push(1 + c.totalCriancas);
  });

  // Gerar dados por hora (8h-18h para horário operacional)
  const data: HourlyData[] = [];
  for (let h = 8; h <= 18; h++) {
    const counts = hourCounts[h] || [];
    const avg = counts.length > 0 ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;
    data.push({ hour: h, count: Math.round(avg) });
  }

  // Aplicar regressão para previsão das próximas horas
  const xs = data.filter(d => d.count > 0).map(d => d.hour);
  const ys = data.filter(d => d.count > 0).map(d => d.count);

  if (xs.length >= 3) {
    // Usar regressão polinomial simples (quadrática) para capturar o pico
    const model = quadraticRegression(xs, ys);
    data.forEach(d => {
      if (d.count === 0) {
        d.predicted = Math.max(0, Math.round(model.a * d.hour * d.hour + model.b * d.hour + model.c));
      }
    });
  }

  return data;
}

interface QuadraticModel {
  a: number;
  b: number;
  c: number;
  r2: number;
}

function quadraticRegression(xs: number[], ys: number[]): QuadraticModel {
  const n = xs.length;
  if (n < 3) return { a: 0, b: 0, c: ys[0] || 0, r2: 0 };

  // Solving: y = ax² + bx + c using normal equations
  let sumX = 0, sumX2 = 0, sumX3 = 0, sumX4 = 0;
  let sumY = 0, sumXY = 0, sumX2Y = 0;

  for (let i = 0; i < n; i++) {
    const x = xs[i], y = ys[i];
    sumX += x; sumX2 += x * x; sumX3 += x * x * x; sumX4 += x * x * x * x;
    sumY += y; sumXY += x * y; sumX2Y += x * x * y;
  }

  const det = n * (sumX2 * sumX4 - sumX3 * sumX3) - sumX * (sumX * sumX4 - sumX2 * sumX3) + sumX2 * (sumX * sumX3 - sumX2 * sumX2);
  if (Math.abs(det) < 1e-10) return { a: 0, b: 0, c: sumY / n, r2: 0 };

  const a = (sumY * (sumX2 * sumX4 - sumX3 * sumX3) - sumX * (sumXY * sumX4 - sumX2Y * sumX3) + sumX2 * (sumXY * sumX3 - sumX2Y * sumX2)) / det;
  const b = (n * (sumXY * sumX4 - sumX2Y * sumX3) - sumY * (sumX * sumX4 - sumX2 * sumX3) + sumX2 * (sumX * sumX2Y - sumX2 * sumXY)) / det;
  const c = (n * (sumX2 * sumX2Y - sumX3 * sumXY) - sumX * (sumX * sumX2Y - sumX2 * sumXY) + sumY * (sumX * sumX3 - sumX2 * sumX2)) / det;

  const meanY = sumY / n;
  const ssRes = ys.reduce((acc, y, i) => acc + Math.pow(y - (a * xs[i] * xs[i] + b * xs[i] + c), 2), 0);
  const ssTot = ys.reduce((acc, y) => acc + Math.pow(y - meanY, 2), 0);
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

  return { a, b, c, r2 };
}

export function getPeakHour(data: HourlyData[]): { hour: number; count: number } {
  const all = data.map(d => ({ hour: d.hour, count: d.count || d.predicted || 0 }));
  return all.reduce((max, d) => d.count > max.count ? d : max, { hour: 0, count: 0 });
}

// ============================================
// 3. DETECÇÃO DE ANOMALIAS (Z-Score)
// ============================================
export interface AnomalyResult {
  isAnomaly: boolean;
  zScore: number;
  message: string;
  severity: 'info' | 'warning' | 'critical';
}

export function detectAnomaly(currentValue: number, historicalValues: number[]): AnomalyResult {
  if (historicalValues.length < 3) {
    return { isAnomaly: false, zScore: 0, message: 'Dados insuficientes para análise', severity: 'info' };
  }

  const mean = historicalValues.reduce((a, b) => a + b, 0) / historicalValues.length;
  const stdDev = Math.sqrt(historicalValues.reduce((a, v) => a + Math.pow(v - mean, 2), 0) / historicalValues.length);

  if (stdDev === 0) {
    return { isAnomaly: currentValue !== mean, zScore: 0, message: 'Variação constante', severity: 'info' };
  }

  const zScore = (currentValue - mean) / stdDev;
  const absZ = Math.abs(zScore);

  if (absZ > 3) {
    return {
      isAnomaly: true,
      zScore,
      message: zScore > 0 ? 'Volume excepcionalmente alto — possível evento especial' : 'Volume excepcionalmente baixo — verificar operação',
      severity: 'critical',
    };
  }
  if (absZ > 2) {
    return {
      isAnomaly: true,
      zScore,
      message: zScore > 0 ? 'Volume acima do normal' : 'Volume abaixo do esperado',
      severity: 'warning',
    };
  }
  return { isAnomaly: false, zScore, message: 'Dentro da faixa normal', severity: 'info' };
}

// ============================================
// 4. TENDÊNCIA E PROJEÇÃO
// ============================================
export interface TrendAnalysis {
  direction: 'up' | 'down' | 'stable';
  percentChange: number;
  projectedTotal: number;
  confidence: number;
  description: string;
}

export function analyzeTrend(checkins: CheckinRegistro[]): TrendAnalysis {
  if (checkins.length < 5) {
    return { direction: 'stable', percentChange: 0, projectedTotal: 0, confidence: 0, description: 'Dados insuficientes para análise de tendência' };
  }

  // Agrupar por dia
  const dailyCounts: Record<string, number> = {};
  checkins.forEach(c => {
    const day = new Date(c.dataHora).toLocaleDateString('pt-BR');
    dailyCounts[day] = (dailyCounts[day] || 0) + 1 + c.totalCriancas;
  });

  const days = Object.keys(dailyCounts).sort();
  const xs = days.map((_, i) => i);
  const ys = days.map(d => dailyCounts[d]);

  const model = linearRegression(xs, ys);
  const lastValue = ys[ys.length - 1];
  const projectedNext = predict(model, xs.length);

  const percentChange = lastValue > 0 ? ((projectedNext - lastValue) / lastValue) * 100 : 0;

  let direction: 'up' | 'down' | 'stable' = 'stable';
  if (model.slope > 0.5) direction = 'up';
  else if (model.slope < -0.5) direction = 'down';

  const descriptions: Record<string, string> = {
    up: `Tendência de crescimento de ${Math.abs(percentChange).toFixed(1)}% no próximo período`,
    down: `Tendência de queda de ${Math.abs(percentChange).toFixed(1)}% no próximo período`,
    stable: 'Volume estável, sem variação significativa detectada',
  };

  return {
    direction,
    percentChange,
    projectedTotal: projectedNext,
    confidence: Math.min(model.r2 * 100, 100),
    description: descriptions[direction],
  };
}

// ============================================
// 5. CLUSTERING SIMPLES (K-Means simplificado)
// ============================================
export interface VisitorCluster {
  label: string;
  count: number;
  avgCriancas: number;
  pcdRate: number;
  topBairros: string[];
}

export function clusterVisitors(checkins: CheckinRegistro[], grupos: any[]): VisitorCluster[] {
  // Cluster por perfil de visita
  const clusters: VisitorCluster[] = [
    { label: 'Famílias Pequenas (1-2 crianças)', count: 0, avgCriancas: 0, pcdRate: 0, topBairros: [] },
    { label: 'Famílias Grandes (3+ crianças)', count: 0, avgCriancas: 0, pcdRate: 0, topBairros: [] },
    { label: 'Visitantes PCD', count: 0, avgCriancas: 0, pcdRate: 100, topBairros: [] },
  ];

  const bairroCount: Record<string, Record<number, number>> = { '0': {}, '1': {}, '2': {} };

  grupos.forEach((g: any) => {
    const nCriancas = g.responsavel?.criancas?.length || 0;
    const hasPCD = g.responsavel?.criancas?.some((c: any) => c.pcd) || false;
    const bairro = g.responsavel?.bairro || 'Desconhecido';

    let clusterIdx = nCriancas >= 3 ? 1 : 0;
    if (hasPCD) clusterIdx = 2;

    clusters[clusterIdx].count++;
    clusters[clusterIdx].avgCriancas += nCriancas;
    bairroCount[clusterIdx.toString()][bairro] = (bairroCount[clusterIdx.toString()][bairro] || 0) + 1;
  });

  clusters.forEach((c, i) => {
    if (c.count > 0) c.avgCriancas = Math.round((c.avgCriancas / c.count) * 10) / 10;
    const sorted = Object.entries(bairroCount[i.toString()]).sort((a, b) => b[1] - a[1]);
    c.topBairros = sorted.slice(0, 3).map(([b]) => b);
  });

  return clusters.filter(c => c.count > 0);
}

// ============================================
// 6. TEMPO MÉDIO DE ATENDIMENTO
// ============================================
export function calcAvgServiceTime(checkins: CheckinRegistro[]): number {
  if (checkins.length < 2) return 0;
  const sorted = [...checkins].sort((a, b) => new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime());

  // Agrupar por guichê e calcular intervalo entre atendimentos
  const guicheCheckins: Record<number, Date[]> = {};
  sorted.forEach(c => {
    if (!guicheCheckins[c.guiche]) guicheCheckins[c.guiche] = [];
    guicheCheckins[c.guiche].push(new Date(c.dataHora));
  });

  const intervals: number[] = [];
  Object.values(guicheCheckins).forEach(dates => {
    for (let i = 1; i < dates.length; i++) {
      const diff = (dates[i].getTime() - dates[i - 1].getTime()) / 60000; // minutes
      if (diff > 0 && diff < 30) intervals.push(diff); // filter outliers
    }
  });

  if (intervals.length === 0) return 0;
  return Math.round((intervals.reduce((a, b) => a + b, 0) / intervals.length) * 10) / 10;
}

// ============================================
// 7. PREVISÃO DE CAPACIDADE
// ============================================
export interface CapacityForecast {
  currentOccupancy: number;
  maxCapacity: number;
  occupancyRate: number;
  estimatedFullAt: string | null;
  recommendation: string;
}

export function forecastCapacity(
  currentTotal: number,
  checkins: CheckinRegistro[],
  maxCapacity: number = 500
): CapacityForecast {
  const rate = (currentTotal / maxCapacity) * 100;

  // Calcular taxa de entrada por hora
  const now = new Date();
  const lastHourCheckins = checkins.filter(c => {
    const diff = (now.getTime() - new Date(c.dataHora).getTime()) / 3600000;
    return diff <= 1;
  });

  const entryRate = lastHourCheckins.reduce((a, c) => a + 1 + c.totalCriancas, 0);
  let estimatedFullAt: string | null = null;

  if (entryRate > 0 && currentTotal < maxCapacity) {
    const hoursToFull = (maxCapacity - currentTotal) / entryRate;
    const fullTime = new Date(now.getTime() + hoursToFull * 3600000);
    estimatedFullAt = fullTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  let recommendation = 'Operação normal';
  if (rate > 90) recommendation = '⚠️ Próximo da capacidade máxima — considere restringir entrada';
  else if (rate > 75) recommendation = 'Atenção: ocupação alta — monitorar fluxo de entrada';
  else if (rate > 50) recommendation = 'Fluxo moderado — operação estável';

  return { currentOccupancy: currentTotal, maxCapacity, occupancyRate: Math.round(rate), estimatedFullAt, recommendation };
}
