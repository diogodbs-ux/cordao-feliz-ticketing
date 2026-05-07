// Matriz de permissões por papel (role) -> rotas/menus permitidos.
// Persistida em localStorage. Pode ser editada pelo Admin.
import { UserRole } from '@/types';

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
  { path: '/admin/usuarios', label: 'Usuários' },
  { path: '/admin/configuracoes', label: 'Configurações' },
  { path: '/apresentacao', label: 'Apresentação Executiva' },
  { path: '/coordenador', label: 'Painel em Tempo Real' },
  { path: '/coordenador/espacos', label: 'Espaços Lúdicos' },
  { path: '/coordenador/jornadas', label: 'Jornadas (cordão)' },
  { path: '/recreador', label: 'Check-in (Guichê)' },
  { path: '/espaco', label: 'Meu Espaço' },
];

export type PermissoesMap = Record<UserRole, string[]>;

// Defaults: espelham a navegação atual do Layout.tsx
export const DEFAULT_PERMISSOES: PermissoesMap = {
  admin: ALL_MENU_ITEMS.map(i => i.path),
  coordenador: [
    '/coordenador', '/coordenador/espacos', '/coordenador/jornadas',
    '/fechamento', '/admin/listas-especiais',
  ],
  supervisor: [
    '/fechamento', '/coordenador', '/coordenador/espacos', '/coordenador/jornadas',
    '/admin/relatorios',
  ],
  recreador: ['/recreador'],
  recreador_espaco: ['/espaco'],
  observador: ['/recreador'],
};

export function readPermissoes(): PermissoesMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PERMISSOES;
    const parsed = JSON.parse(raw) as Partial<PermissoesMap>;
    // Merge to ensure all roles exist
    return { ...DEFAULT_PERMISSOES, ...parsed };
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

export function resetPermissoes() {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event('sentinela:permissoes-changed'));
}
