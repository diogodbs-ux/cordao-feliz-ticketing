import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import logo from '@/assets/logo-completa.png';
import { Button } from '@/components/ui/button';
import {
  LogOut, Users, LayoutDashboard, Settings, ClipboardCheck, ChevronRight, Eye,
  FileSpreadsheet, BarChart3, History, Cake, Building, Presentation, QrCode,
  MapPin, FileBarChart, Target, Tag, Route as RouteIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS: Record<string, { label: string; icon: any; path: string }[]> = {
  admin: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/admin' },
    { label: 'Importar Dados', icon: ClipboardCheck, path: '/admin/importar' },
    { label: 'Listas Especiais', icon: Cake, path: '/admin/listas-especiais' },
    { label: 'QR Codes', icon: QrCode, path: '/admin/qrcodes' },
    { label: 'Espaços Lúdicos', icon: MapPin, path: '/admin/espacos' },
    { label: 'Cordões Numerados', icon: Tag, path: '/admin/cordoes' },
    { label: 'Fechamento 17h', icon: FileBarChart, path: '/fechamento' },
    { label: 'Histórico & Geo', icon: History, path: '/admin/historico' },
    { label: 'Consolidado Anual', icon: Target, path: '/admin/consolidado' },
    { label: 'Relatórios', icon: BarChart3, path: '/admin/relatorios' },
    { label: 'Usuários', icon: Users, path: '/admin/usuarios' },
    { label: 'Configurações', icon: Settings, path: '/admin/configuracoes' },
    { label: 'Apresentação', icon: Presentation, path: '/apresentacao' },
  ],
  coordenador: [
    { label: 'Painel em Tempo Real', icon: LayoutDashboard, path: '/coordenador' },
    { label: 'Espaços Lúdicos', icon: MapPin, path: '/coordenador/espacos' },
    { label: 'Jornadas (cordão)', icon: RouteIcon, path: '/coordenador/jornadas' },
    { label: 'Fechamento 17h', icon: FileBarChart, path: '/fechamento' },
    { label: 'Listas Especiais', icon: Cake, path: '/admin/listas-especiais' },
  ],
  supervisor: [
    { label: 'Fechamento 17h', icon: FileBarChart, path: '/fechamento' },
    { label: 'Painel em Tempo Real', icon: LayoutDashboard, path: '/coordenador' },
    { label: 'Espaços Lúdicos', icon: MapPin, path: '/coordenador/espacos' },
  ],
  recreador: [
    { label: 'Check-in', icon: ClipboardCheck, path: '/recreador' },
  ],
  recreador_espaco: [
    { label: 'Meu Espaço', icon: MapPin, path: '/espaco' },
  ],
  observador: [
    { label: 'Check-in (Observador)', icon: Eye, path: '/recreador' },
  ],
};

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) return null;

  const navItems = NAV_ITEMS[user.role] || [];

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-64 bg-card border-r border-border flex flex-col shadow-card">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Logo" className="h-10 w-auto opacity-80" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">Sentinela</p>
              <p className="text-[10px] text-muted-foreground truncate">Cidade Mais Infância</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(item => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path + item.label}
                onClick={() => navigate(item.path)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                )}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{item.label}</span>
                {active && <ChevronRight className="h-3 w-3 ml-auto" />}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
              {user.nome.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">{user.nome}</p>
              <p className="text-[10px] text-muted-foreground capitalize">{user.role}{user.guiche ? ` — Guichê ${user.guiche}` : ''}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground hover:text-destructive"
            onClick={() => { logout(); navigate('/login'); }}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
