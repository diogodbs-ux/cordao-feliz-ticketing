// Matriz de permissões por papel (role) -> rotas/menus permitidos.
// Persistida em localStorage. Pode ser editada pelo Admin.
import { User, UserRole } from '@/types';

const STORAGE_KEY = 'sentinela_permissoes_v1';

export interface MenuItemDef {
  path: string;
  label: string;
}

// Catálogo de TODOS os menus existentes na navegação (devem bater com Layout.tsx)
export const ALL_MENU_ITEMS: MenuItemDef[] = [
  { path: '/admin', label: 'Dashboard' },
  { path: '/admin/importar', label: 'Importar Dados' },
  { path: '/admin/listas-especiais', label: 'Listas Especiais' },
  { path: '/admin/qrcodes', label: 'QR Codes' },
  { path: '/admin/espacos', label: 'Espaços Lúdicos (Admin)' },
  { path: '/admin/cordoes', label: 'Cordões Numerados' },
  { path: '/fechamento', label: 'Fechamento 17h' },
  { path: '/admin/historico', label: 'Histórico & Geo' },
  { path: '/admin/consolidado', label: 'Consolidado Anual' },
  { path: '/admin/relatorios', label: 'Relatórios' },
  { path: '/admin/reconciliacao', label: 'Reconciliação Operacional' },
  { path: '/admin/ciclos', label: 'Ciclos por Espaço (Dashboard)' },
  { path: '/admin/rastreamento', label: 'Acompanhamento Público (Tokens)' },
  { path: '/admin/auditoria', label: 'Auditoria' },
  { path: '/admin/permissoes', label: 'Permissões' },
  { path: '/admin/usuarios', label: 'Usuários' },
  { path: '/admin/configuracoes', label: 'Configurações' },
  { path: '/apresentacao', label: 'Apresentação Executiva' },
  { path: '/coordenador', label: 'Painel em Tempo Real' },
  { path: '/coordenador/espacos', label: 'Espaços Lúdicos' },
  { path: '/coordenador/jornadas', label: 'Jornadas (cordão)' },
  { path: '/portaria/devolucao', label: 'Portaria — Devolução' },
  { path: '/admin/encerramento', label: 'Encerramento 18h (Auto)' },
  { path: '/admin/heatmap', label: 'Heatmap do Parque' },
  { path: '/admin/crachas', label: 'Crachás dos Recreadores' },
  { path: '/recreador', label: 'Check-in (Guichê)' },
  { path: '/espaco', label: 'Meu Espaço' },
];

export type PermissoesMap = Record<UserRole, string[]>;

// Defaults: espelham a navegação atual do Layout.tsx
export const DEFAULT_PERMISSOES: PermissoesMap = {
  admin: [],
  coordenador: [
    '/coordenador', '/coordenador/espacos', '/coordenador/jornadas',
    '/fechamento', '/admin/listas-especiais', '/admin/ciclos',
    '/admin/rastreamento', '/portaria/devolucao', '/admin/encerramento',
    '/admin/heatmap', '/admin/crachas',
  ],
  supervisor: [
    '/fechamento', '/coordenador', '/coordenador/espacos', '/coordenador/jornadas',
    '/admin/relatorios', '/admin/ciclos', '/admin/auditoria', '/admin/rastreamento',
    '/admin/heatmap',
  ],
  recreador: ['/recreador', '/portaria/devolucao'],
  recreador_espaco: ['/espaco', '/portaria/devolucao'],
  observador: ['/recreador'],
};

export function readPermissoes(): PermissoesMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PERMISSOES;
    const parsed = JSON.parse(raw) as Partial<PermissoesMap>;
    const merged = { ...DEFAULT_PERMISSOES } as PermissoesMap;
    (Object.keys(DEFAULT_PERMISSOES) as UserRole[]).forEach(role => {
      if (role === 'admin') merged[role] = ALL_MENU_ITEMS.map(i => i.path);
      else merged[role] = parsed[role] || DEFAULT_PERMISSOES[role];
    });
    return merged;
  } catch {
    return DEFAULT_PERMISSOES;
  }
}

export function writePermissoes(p: PermissoesMap) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  // Notifica outras abas / Layout
  window.dispatchEvent(new Event('sentinela:permissoes-changed'));
}

export function hasMenuAccess(role: UserRole, path: string): boolean {
  const perms = readPermissoes();
  return (perms[role] || []).includes(path);
}

export function getAllowedPathsForUser(user: User): string[] {
  if (user.role === 'admin') return ALL_MENU_ITEMS.map(i => i.path);
  const base = new Set(readPermissoes()[user.role] || []);
  (user.permissoesExtras || []).forEach(path => base.add(path));
  (user.permissoesBloqueadas || []).forEach(path => base.delete(path));
  return Array.from(base);
}

export function hasUserMenuAccess(user: User, path: string): boolean {
  if (user.role === 'admin') return true;
  return getAllowedPathsForUser(user).includes(path);
}

export function resetPermissoes() {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event('sentinela:permissoes-changed'));
}
