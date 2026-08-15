import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import BrandLogo from '@/components/BrandLogo';
import { getBranding, subscribeBranding } from '@/lib/branding';
import { Button } from '@/components/ui/button';
import {
  LogOut, Users, LayoutDashboard, Settings, ClipboardCheck, ChevronRight, Eye,
  BarChart3, History, Cake, Presentation, QrCode, Download,
  MapPin, FileBarChart, Target, Tag, Route as RouteIcon, Shield, Activity, DoorOpen, DoorClosed,
  Flame, IdCard,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import OfflineBadge from '@/components/OfflineBadge';
import { getAllowedPathsForUser } from '@/lib/permissoes';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useAutoEncerramento } from '@/hooks/useAutoEncerramento';

type NavItem = { label: string; icon: any; path: string };
type NavGroup = { section: string; hint: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    section: 'Receptivo (Guichê)',
    hint: 'Entrada de visitantes',
    items: [
      { label: 'Check-in', icon: ClipboardCheck, path: '/recreador' },
      { label: 'Portaria — Devolução', icon: DoorOpen, path: '/portaria/devolucao' },
      { label: 'QR Codes', icon: QrCode, path: '/admin/qrcodes' },
    ],
  },
  {
    section: 'Espaços Lúdicos (Recreadores)',
    hint: 'Operação dentro dos espaços',
    items: [
      { label: 'Meu Espaço', icon: MapPin, path: '/espaco' },
      { label: 'Crachás dos Recreadores', icon: IdCard, path: '/admin/crachas' },
    ],
  },
  {
    section: 'Coordenação (Tempo Real)',
    hint: 'Monitoramento da operação',
    items: [
      { label: 'Painel em Tempo Real', icon: LayoutDashboard, path: '/coordenador' },
      { label: 'Espaços Lúdicos', icon: MapPin, path: '/coordenador/espacos' },
      { label: 'Heatmap do Parque', icon: Flame, path: '/admin/heatmap' },
      { label: 'Ciclos por Espaço', icon: Activity, path: '/admin/ciclos' },
      { label: 'Jornadas (cordão)', icon: RouteIcon, path: '/coordenador/jornadas' },
      { label: 'Acompanhamento (Tokens)', icon: QrCode, path: '/admin/rastreamento' },
    ],
  },
  {
    section: 'Gestão & Análise',
    hint: 'Indicadores e relatórios',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, path: '/admin' },
      { label: 'Relatórios', icon: BarChart3, path: '/admin/relatorios' },
      { label: 'Fechamento 17h', icon: FileBarChart, path: '/fechamento' },
      { label: 'Encerramento 18h (Auto)', icon: DoorClosed, path: '/admin/encerramento' },
      { label: 'Histórico & Geo', icon: History, path: '/admin/historico' },
      { label: 'Consolidado Anual', icon: Target, path: '/admin/consolidado' },
      { label: 'Apresentação', icon: Presentation, path: '/apresentacao' },
    ],
  },
  {
    section: 'Administração',
    hint: 'Cadastros e configurações',
    items: [
      { label: 'Importar Dados', icon: ClipboardCheck, path: '/admin/importar' },
      { label: 'Listas Especiais', icon: Cake, path: '/admin/listas-especiais' },
      { label: 'Espaços Lúdicos (Admin)', icon: MapPin, path: '/admin/espacos' },
      { label: 'Cordões Numerados', icon: Tag, path: '/admin/cordoes' },
      { label: 'Usuários', icon: Users, path: '/admin/usuarios' },
      { label: 'Permissões', icon: Shield, path: '/admin/permissoes' },
      { label: 'Auditoria', icon: Shield, path: '/admin/auditoria' },
      { label: 'Configurações', icon: Settings, path: '/admin/configuracoes' },
    ],
  },
];


export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [permsVersion, setPermsVersion] = useState(0);
  const [brandTick, setBrandTick] = useState(0);
  useEffect(() => subscribeBranding(() => setBrandTick(t => t + 1)), []);
  const brand = getBranding();
  void brandTick;
  const { canInstall, promptInstall } = usePWAInstall();
  useAutoEncerramento();

  useEffect(() => {
    const handler = () => setPermsVersion(v => v + 1);
    window.addEventListener('sentinela:permissoes-changed', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('sentinela:permissoes-changed', handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  if (!user) return null;

  const allowed = getAllowedPathsForUser(user);
  // Mantém ordem original de ALL_NAV; usa o primeiro label encontrado para cada path permitido
  const seen = new Set<string>();
  const navItems = ALL_NAV.filter(item => {
    if (!allowed.includes(item.path)) return false;
    const key = item.path;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  void permsVersion;

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-64 bg-card border-r border-border flex flex-col shadow-card">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <BrandLogo className="h-10 w-10 object-contain opacity-90 rounded" fallbackInitials />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">Sentinela</p>
              <p className="text-[10px] text-muted-foreground truncate">{brand.orgName}</p>
            </div>
          </div>
          <div className="mt-3"><OfflineBadge /></div>
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
          {canInstall && (
            <Button size="sm" variant="outline" className="w-full justify-start gap-2 mb-2" onClick={promptInstall}>
              <Download className="h-4 w-4" /> Instalar app
            </Button>
          )}
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
