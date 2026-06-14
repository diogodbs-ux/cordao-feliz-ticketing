// Sistema de rastreamento público — sem login.
// O responsável escaneia QR impresso na etiqueta → digita nome da criança → vê localização ao vivo.
// Token = chave curta atrelada ao protocolo. Expira ao fim do dia operacional (17h).

import { GrupoVisita } from '@/types';
import { readCordoes, CordaoUnidade } from '@/types/cordoes';
import { logAuditoria } from '@/lib/auditoria';

const STORAGE_KEY = 'sentinela_rastreamento_tokens';

export interface RastreioToken {
  token: string;          // ex: "T-9X4K2"
  protocolo: string;
  grupoId: string;
  responsavelNome: string;
  criadoEm: string;       // ISO
  expiraEm: string;       // ISO — fim do dia operacional (17h00 local)
}

interface CriancaLocalizacao {
  nome: string;
  idade?: number;
  cor: string;
  codigoCordao: string;
  espacoAtual: { espacoId: string; espacoNome: string; entrada: string } | null;
  totalEspacosVisitados: number;
  visitas: { espacoNome: string; entrada: string; saida?: string }[];
}

function read(): RastreioToken[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function write(list: RastreioToken[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function fimDoDiaOperacional(base: Date = new Date()): Date {
  const d = new Date(base);
  d.setHours(17, 0, 0, 0);
  // se já passou das 17h, expira amanhã 17h
  if (d.getTime() <= base.getTime()) d.setDate(d.getDate() + 1);
  return d;
}

function gerarCodigoCurto(): string {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O/1/I
  let s = '';
  for (let i = 0; i < 5; i++) s += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  return `T-${s}`;
}

/** Gera (ou retorna existente) o token público para o protocolo do grupo. */
export function gerarOuObterToken(grupo: GrupoVisita): RastreioToken {
  const all = read();
  const protocolo = grupo.responsavel.protocolo || grupo.id;
  const agora = new Date();
  const existente = all.find(t => t.protocolo === protocolo && new Date(t.expiraEm) > agora);
  if (existente) return existente;

  let token = gerarCodigoCurto();
  while (all.some(t => t.token === token)) token = gerarCodigoCurto();

  const novo: RastreioToken = {
    token,
    protocolo,
    grupoId: grupo.id,
    responsavelNome: grupo.responsavel.nome,
    criadoEm: agora.toISOString(),
    expiraEm: fimDoDiaOperacional(agora).toISOString(),
  };
  write([...all, novo]);
  logAuditoria('rastreamento.token.gerado', { protocolo, token, detalhe: `Token público criado para ${grupo.responsavel.nome}` });
  return novo;
}

export function obterTokenPorProtocolo(protocolo: string): RastreioToken | null {
  return read().find(t => t.protocolo === protocolo) || null;
}

export function buscarToken(token: string): RastreioToken | null {
  const t = read().find(x => x.token.toUpperCase() === token.trim().toUpperCase());
  if (!t) return null;
  if (new Date(t.expiraEm) <= new Date()) return null;
  return t;
}

/** URL pública pronta para o QR. */
export function buildPublicUrl(token: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/acompanhar/${token}`;
}

/** Valida nome da criança (case/acento-insensitive, substring). */
function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/**
 * Resolve a localização atual de cada criança do protocolo,
 * validando o nome informado pelo responsável.
 */
export function consultarLocalizacao(
  token: string,
  nomeCriancaInformado: string
): { ok: true; criancas: CriancaLocalizacao[]; responsavelNome: string; protocolo: string } | { ok: false; erro: string } {
  const t = buscarToken(token);
  if (!t) return { ok: false, erro: 'Token inválido ou expirado. Solicite um novo QR no guichê.' };

  const nomeBusca = normalizar(nomeCriancaInformado);
  if (nomeBusca.length < 2) return { ok: false, erro: 'Informe pelo menos 2 caracteres do nome da criança.' };

  const cordoes = readCordoes().filter(c => c.protocolo === t.protocolo);
  const criancasCordoes = cordoes.filter(c => c.membroTipo === 'crianca');

  if (criancasCordoes.length === 0) {
    return { ok: false, erro: 'Nenhuma criança vinculada ainda. Aguarde o check-in.' };
  }

  // valida que o nome informado bate com pelo menos uma criança do grupo
  const algumBate = criancasCordoes.some(c => c.membroNome && normalizar(c.membroNome).includes(nomeBusca));
  if (!algumBate) {
    logAuditoria('rastreamento.consulta.bloqueada', { protocolo: t.protocolo, token, detalhe: `Nome não confere: "${nomeCriancaInformado}"` });
    return { ok: false, erro: 'Nome não confere com nenhuma criança deste protocolo. Confira a grafia.' };
  }

  const out = criancasCordoes.map(formatarLocalizacao);

  logAuditoria('rastreamento.consulta.ok', { protocolo: t.protocolo, token, detalhe: `Consulta de ${nomeCriancaInformado} — ${out.length} criança(s)` });

  return { ok: true, criancas: out, responsavelNome: t.responsavelNome, protocolo: t.protocolo };
}

function formatarLocalizacao(c: CordaoUnidade): CriancaLocalizacao {
  const visitas = (c.visitas || []).slice().sort((a, b) => a.entrada.localeCompare(b.entrada));
  const aberta = visitas.find(v => !v.saida) || null;
  return {
    nome: c.membroNome || '—',
    idade: c.membroIdade,
    cor: c.cor,
    codigoCordao: c.codigo,
    espacoAtual: aberta ? { espacoId: aberta.espacoId, espacoNome: aberta.espacoNome, entrada: aberta.entrada } : null,
    totalEspacosVisitados: visitas.length,
    visitas: visitas.map(v => ({ espacoNome: v.espacoNome, entrada: v.entrada, saida: v.saida })),
  };
}

/** Limpa tokens expirados (chamado oportunisticamente). */
export function limparExpirados(): number {
  const all = read();
  const validos = all.filter(t => new Date(t.expiraEm) > new Date());
  if (validos.length !== all.length) write(validos);
  return all.length - validos.length;
}
