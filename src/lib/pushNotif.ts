// Notificações Push (Web Notification API) para responsáveis acompanhando filhos.
// Modelo: opt-in vinculado a um token público de rastreamento. Polling local detecta
// mudança de espaço da criança e dispara notificação local do navegador.
//
// Observação: Web Push real (background) exige Service Worker + servidor VAPID.
// Esta implementação é foreground-friendly e funciona enquanto a aba/PWA está aberta,
// o que cobre o caso de pais com o cartão de acompanhamento no celular.

import { consultarLocalizacao } from './rastreamento';

const STORAGE = 'sentinela_push_subs';

interface PushSub {
  token: string;
  nomeCrianca: string;
  ativadoEm: string;
  ultimoEspacoPorCrianca: Record<string, string>; // nome → espacoNome|''
}

function readSubs(): PushSub[] {
  try { return JSON.parse(localStorage.getItem(STORAGE) || '[]'); } catch { return []; }
}
function writeSubs(s: PushSub[]) { localStorage.setItem(STORAGE, JSON.stringify(s)); }

export function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function ativarPush(token: string, nomeCrianca: string): Promise<{ ok: boolean; motivo?: string }> {
  if (!isPushSupported()) return { ok: false, motivo: 'Notificações não suportadas neste navegador.' };
  if (Notification.permission === 'denied') {
    return { ok: false, motivo: 'Permissão de notificações bloqueada. Habilite nas configurações do navegador.' };
  }
  if (Notification.permission !== 'granted') {
    const p = await Notification.requestPermission();
    if (p !== 'granted') return { ok: false, motivo: 'Permissão não concedida.' };
  }
  const subs = readSubs().filter(s => !(s.token === token && s.nomeCrianca === nomeCrianca));
  subs.push({ token, nomeCrianca, ativadoEm: new Date().toISOString(), ultimoEspacoPorCrianca: {} });
  writeSubs(subs);
  // Notificação de boas-vindas
  try { new Notification('Acompanhamento ativado', { body: `Vamos te avisar quando ${nomeCrianca} mudar de espaço.` }); } catch { /* noop */ }
  return { ok: true };
}

export function desativarPush(token: string, nomeCrianca: string) {
  writeSubs(readSubs().filter(s => !(s.token === token && s.nomeCrianca === nomeCrianca)));
}

export function estaAtivo(token: string, nomeCrianca: string): boolean {
  return readSubs().some(s => s.token === token && s.nomeCrianca === nomeCrianca);
}

/**
 * Inicia polling global para todas as subscriptions e dispara notificações
 * quando o espaço atual de alguma criança muda. Retorna função de cleanup.
 */
export function iniciarPolling(intervaloMs = 20_000): () => void {
  if (!isPushSupported()) return () => { /* noop */ };

  const tick = () => {
    const subs = readSubs();
    if (subs.length === 0) return;
    let mudou = false;
    subs.forEach(sub => {
      const r = consultarLocalizacao(sub.token, sub.nomeCrianca);
      if (!r.ok) return;
      r.criancas.forEach(c => {
        const espacoAtual = c.espacoAtual?.espacoNome || '';
        const anterior = sub.ultimoEspacoPorCrianca[c.nome];
        if (anterior !== undefined && anterior !== espacoAtual) {
          try {
            if (espacoAtual) {
              new Notification(`${c.nome} entrou em ${espacoAtual}`, { body: 'Toque para ver detalhes.', tag: `${sub.token}-${c.nome}` });
            } else {
              new Notification(`${c.nome} saiu do espaço`, { body: 'Aguardando próximo registro.', tag: `${sub.token}-${c.nome}` });
            }
          } catch { /* noop */ }
        }
        sub.ultimoEspacoPorCrianca[c.nome] = espacoAtual;
        mudou = true;
      });
    });
    if (mudou) writeSubs(subs);
  };

  tick();
  const id = setInterval(tick, intervaloMs);
  return () => clearInterval(id);
}
