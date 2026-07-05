// Notificações Push com Service Worker dedicado + opt-in seguro.
//
// Modelo:
//   - Um SW dedicado (`/push-sw.js`) que NÃO faz cache de app-shell — apenas
//     lida com push/notificationclick/message. Isso satisfaz a diretriz de
//     "messaging worker" (fora do app-shell PWA), evita quebrar o preview do
//     Lovable e permite notificações mesmo com a aba minimizada por alguns
//     minutos (via clients.postMessage + showNotification).
//   - Foreground polling (20s) continua ativo enquanto a aba estiver aberta;
//     ao detectar mudança de espaço, envia SHOW_NOTIFICATION para o SW.
//   - Armazenamento local minimiza o que persiste: apenas token + primeiro
//     nome (que o responsável já digitou publicamente) + último espaço
//     conhecido. Não armazena PII sensível nem tokens de push reais.
//   - Registro do SW é bloqueado no preview do Lovable e em iframes.
//
// Web Push real (background com servidor VAPID) fica preparado: o SW já ouve
// o evento `push`. Basta adicionar `pushManager.subscribe` num backend futuro.

import { consultarLocalizacao } from './rastreamento';

const STORAGE = 'sentinela_push_subs_v2';
const SW_URL = '/push-sw.js';
const SW_SCOPE = '/';

export type PushPermissionState = 'default' | 'granted' | 'denied' | 'unsupported' | 'blocked-preview';

interface PushSub {
  token: string;
  nomeCrianca: string;
  ativadoEm: string;
  ultimoEspacoPorCrianca: Record<string, string>;
}

// ---------- Storage helpers ----------
function readSubs(): PushSub[] {
  try { return JSON.parse(localStorage.getItem(STORAGE) || '[]'); } catch { return []; }
}
function writeSubs(s: PushSub[]) {
  try { localStorage.setItem(STORAGE, JSON.stringify(s)); } catch { /* quota */ }
}

// ---------- Environment guards ----------
export function isPushSupported(): boolean {
  return typeof window !== 'undefined'
    && 'Notification' in window
    && 'serviceWorker' in navigator;
}

/** Preview do Lovable / iframe — não registrar SW nesses contextos. */
function isBlockedContext(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    if (window.self !== window.top) return true;
  } catch { return true; }
  const h = window.location.hostname;
  if (h.startsWith('id-preview--') || h.startsWith('preview--')) return true;
  if (h === 'lovableproject.com' || h.endsWith('.lovableproject.com')) return true;
  if (h === 'lovableproject-dev.com' || h.endsWith('.lovableproject-dev.com')) return true;
  if (h === 'beta.lovable.dev' || h.endsWith('.beta.lovable.dev')) return true;
  return false;
}

export function getPermissionState(): PushPermissionState {
  if (!isPushSupported()) return 'unsupported';
  if (isBlockedContext()) return 'blocked-preview';
  return Notification.permission as PushPermissionState;
}

// ---------- Service Worker registration ----------
let swPromise: Promise<ServiceWorkerRegistration | null> | null = null;
async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported() || isBlockedContext()) return null;
  if (!swPromise) {
    swPromise = navigator.serviceWorker
      .register(SW_URL, { scope: SW_SCOPE })
      .catch(err => {
        console.warn('[push] SW register failed', err);
        return null;
      });
  }
  return swPromise;
}

/** Chamado no boot da página pública para pré-registrar o SW quando aplicável. */
export async function ensureServiceWorker(): Promise<void> {
  if (getPermissionState() === 'granted') {
    await getRegistration();
  }
}

// ---------- Public API ----------

export async function ativarPush(token: string, nomeCrianca: string): Promise<{ ok: boolean; motivo?: string; state: PushPermissionState }> {
  const state = getPermissionState();
  if (state === 'unsupported') {
    return { ok: false, state, motivo: 'Seu navegador não suporta notificações. Tente usar Chrome, Edge ou Safari mais recente.' };
  }
  if (state === 'blocked-preview') {
    return { ok: false, state, motivo: 'As notificações não funcionam no modo de pré-visualização. Elas ficam ativas na versão publicada do sistema.' };
  }
  if (state === 'denied') {
    return { ok: false, state, motivo: 'As notificações estão bloqueadas nas configurações do navegador. Toque no cadeado 🔒 na barra de endereço e permita notificações para este site.' };
  }

  if (Notification.permission !== 'granted') {
    let p: NotificationPermission;
    try { p = await Notification.requestPermission(); }
    catch { return { ok: false, state: 'denied', motivo: 'Não foi possível solicitar permissão.' }; }
    if (p !== 'granted') {
      return { ok: false, state: p as PushPermissionState, motivo: 'Permissão não concedida. Você pode ativar depois pelo cadeado 🔒 na barra de endereço.' };
    }
  }

  // Registra SW (não bloqueia se falhar — degrada para Notification tradicional)
  await getRegistration();

  const subs = readSubs().filter(s => !(s.token === token && s.nomeCrianca === nomeCrianca));
  subs.push({ token, nomeCrianca, ativadoEm: new Date().toISOString(), ultimoEspacoPorCrianca: {} });
  writeSubs(subs);

  await notify({
    title: 'Acompanhamento ativado',
    body: `Vamos te avisar quando ${nomeCrianca} mudar de espaço.`,
    tag: `welcome-${token}-${nomeCrianca}`,
    url: window.location.pathname,
  });

  return { ok: true, state: 'granted' };
}

export function desativarPush(token: string, nomeCrianca: string) {
  writeSubs(readSubs().filter(s => !(s.token === token && s.nomeCrianca === nomeCrianca)));
}

export function estaAtivo(token: string, nomeCrianca: string): boolean {
  return readSubs().some(s => s.token === token && s.nomeCrianca === nomeCrianca);
}

/** Envia uma notificação — prefere o SW (background friendly), cai para Notification simples. */
async function notify(payload: { title: string; body: string; tag?: string; url?: string }) {
  try {
    const reg = await getRegistration();
    if (reg && reg.active) {
      reg.active.postMessage({ type: 'SHOW_NOTIFICATION', payload });
      return;
    }
    if (reg) {
      await reg.showNotification(payload.title, {
        body: payload.body, tag: payload.tag, icon: '/icon-512.png', badge: '/icon-512.png',
        data: { url: payload.url },
      });
      return;
    }
  } catch { /* fallback */ }
  try { new Notification(payload.title, { body: payload.body, tag: payload.tag }); } catch { /* noop */ }
}

/**
 * Polling em foreground para detectar mudança de espaço. Retorna cleanup.
 */
export function iniciarPolling(intervaloMs = 20_000): () => void {
  if (!isPushSupported() || isBlockedContext()) return () => { /* noop */ };

  const tick = async () => {
    const subs = readSubs();
    if (subs.length === 0) return;
    let mudou = false;
    for (const sub of subs) {
      const r = consultarLocalizacao(sub.token, sub.nomeCrianca);
      if (!r.ok) continue;
      for (const c of r.criancas) {
        const espacoAtual = c.espacoAtual?.espacoNome || '';
        const anterior = sub.ultimoEspacoPorCrianca[c.nome];
        if (anterior !== undefined && anterior !== espacoAtual) {
          await notify({
            title: espacoAtual ? `${c.nome} entrou em ${espacoAtual}` : `${c.nome} saiu do espaço`,
            body: espacoAtual ? 'Toque para acompanhar em tempo real.' : 'Aguardando próximo registro.',
            tag: `${sub.token}-${c.nome}`,
            url: window.location.pathname,
          });
        }
        sub.ultimoEspacoPorCrianca[c.nome] = espacoAtual;
        mudou = true;
      }
    }
    if (mudou) writeSubs(subs);
  };

  tick();
  const id = setInterval(tick, intervaloMs);
  return () => clearInterval(id);
}
