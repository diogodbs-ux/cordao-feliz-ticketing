// Módulos/telas visíveis + travas operacionais. Persistido em localStorage.
const STORAGE_KEY = 'sentinela_modulos_v1';
export const MODULOS_EVENT = 'sentinela:modulos-changed';

export interface ModulosConfig {
  /** Caminhos de menu desativados globalmente (não aparecem para ninguém, nem admin) */
  telasOcultas: string[];
  /** Trava a navegação do recreador enquanto houver ciclo aberto */
  travarNavegacaoCicloAtivo: boolean;
  /** Soma a presença estimada dos ciclos de espaço aos painéis gerenciais */
  contabilizarCiclosComoPresenca: boolean;
}

export const DEFAULT_MODULOS: ModulosConfig = {
  telasOcultas: ['/portaria/devolucao'],
  travarNavegacaoCicloAtivo: false,
  contabilizarCiclosComoPresenca: false,
};

export function readModulos(): ModulosConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_MODULOS;
    const parsed = JSON.parse(raw) as Partial<ModulosConfig>;
    return {
      telasOcultas: Array.isArray(parsed.telasOcultas) ? parsed.telasOcultas : [],
      travarNavegacaoCicloAtivo: !!parsed.travarNavegacaoCicloAtivo,
      contabilizarCiclosComoPresenca: !!parsed.contabilizarCiclosComoPresenca,
    };
  } catch {
    return DEFAULT_MODULOS;
  }
}

export function writeModulos(cfg: ModulosConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  window.dispatchEvent(new Event(MODULOS_EVENT));
}

export function isTelaOculta(path: string): boolean {
  return readModulos().telasOcultas.includes(path);
}

export function subscribeModulos(cb: () => void): () => void {
  window.addEventListener(MODULOS_EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(MODULOS_EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}
