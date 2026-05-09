import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DataProvider } from "@/contexts/DataContext";
import Login from "@/pages/Login";
import Layout from "@/components/Layout";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminImport from "@/pages/AdminImport";
import AdminUsers from "@/pages/AdminUsers";
import AdminRelatorios from "@/pages/AdminRelatorios";
import AdminConfiguracoes from "@/pages/AdminConfiguracoes";
import AdminHistorico from "@/pages/AdminHistorico";
import AdminConsolidado from "@/pages/AdminConsolidado";
import CoordenadorEspacos from "@/pages/CoordenadorEspacos";
import ListasEspeciais from "@/pages/ListasEspeciais";
import CoordenadorPanel from "@/pages/CoordenadorPanel";
import RecreadorPanel from "@/pages/RecreadorPanel";
import ApresentacaoExecutiva from "@/pages/ApresentacaoExecutiva";
import AdminQRCodes from "@/pages/AdminQRCodes";
import AdminEspacos from "@/pages/AdminEspacos";
import FechamentoOperacional from "@/pages/FechamentoOperacional";
import RecreadorEspacoPanel from "@/pages/RecreadorEspacoPanel";
import AdminCordoes from "@/pages/AdminCordoes";
import JornadaCordoes from "@/pages/JornadaCordoes";
import AdminPermissoes from "@/pages/AdminPermissoes";
import NotFound from "@/pages/NotFound";
import { hasUserMenuAccess } from "@/lib/permissoes";

const queryClient = new QueryClient();

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles && user && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function PermissionRoute({ children, path, roles }: { children: React.ReactNode; path: string; roles?: string[] }) {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  void roles;
  if (!user || !hasUserMenuAccess(user, path)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  if (user.role === 'coordenador') return <Navigate to="/coordenador" replace />;
  if (user.role === 'supervisor') return <Navigate to="/fechamento" replace />;
  if (user.role === 'recreador_espaco') return <Navigate to="/espaco" replace />;
  return <Navigate to="/recreador" replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <DataProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route index element={<HomeRedirect />} />
                <Route path="admin" element={<PermissionRoute path="/admin" roles={['admin']}><AdminDashboard /></PermissionRoute>} />
                <Route path="admin/importar" element={<PermissionRoute path="/admin/importar" roles={['admin']}><AdminImport /></PermissionRoute>} />
                <Route path="admin/usuarios" element={<PermissionRoute path="/admin/usuarios" roles={['admin']}><AdminUsers /></PermissionRoute>} />
                <Route path="admin/relatorios" element={<PermissionRoute path="/admin/relatorios" roles={['admin', 'supervisor']}><AdminRelatorios /></PermissionRoute>} />
                <Route path="admin/configuracoes" element={<PermissionRoute path="/admin/configuracoes" roles={['admin']}><AdminConfiguracoes /></PermissionRoute>} />
                <Route path="admin/historico" element={<PermissionRoute path="/admin/historico" roles={['admin']}><AdminHistorico /></PermissionRoute>} />
                <Route path="admin/consolidado" element={<PermissionRoute path="/admin/consolidado" roles={['admin']}><AdminConsolidado /></PermissionRoute>} />
                <Route path="coordenador/espacos" element={<PermissionRoute path="/coordenador/espacos" roles={['admin', 'coordenador', 'supervisor']}><CoordenadorEspacos /></PermissionRoute>} />
                <Route path="admin/listas-especiais" element={<PermissionRoute path="/admin/listas-especiais" roles={['admin', 'coordenador']}><ListasEspeciais /></PermissionRoute>} />
                <Route path="coordenador" element={<PermissionRoute path="/coordenador" roles={['coordenador', 'admin', 'supervisor']}><CoordenadorPanel /></PermissionRoute>} />
                <Route path="recreador" element={<PermissionRoute path="/recreador" roles={['recreador', 'admin', 'observador']}><RecreadorPanel /></PermissionRoute>} />
                <Route path="apresentacao" element={<PermissionRoute path="/apresentacao" roles={['admin']}><ApresentacaoExecutiva /></PermissionRoute>} />
                <Route path="admin/qrcodes" element={<PermissionRoute path="/admin/qrcodes" roles={['admin']}><AdminQRCodes /></PermissionRoute>} />
                <Route path="admin/espacos" element={<PermissionRoute path="/admin/espacos" roles={['admin']}><AdminEspacos /></PermissionRoute>} />
                <Route path="fechamento" element={<PermissionRoute path="/fechamento" roles={['admin', 'coordenador', 'supervisor']}><FechamentoOperacional /></PermissionRoute>} />
                <Route path="espaco" element={<PermissionRoute path="/espaco" roles={['admin', 'recreador_espaco']}><RecreadorEspacoPanel /></PermissionRoute>} />
                <Route path="admin/cordoes" element={<PermissionRoute path="/admin/cordoes" roles={['admin']}><AdminCordoes /></PermissionRoute>} />
                <Route path="coordenador/jornadas" element={<PermissionRoute path="/coordenador/jornadas" roles={['admin', 'coordenador', 'supervisor']}><JornadaCordoes /></PermissionRoute>} />
                <Route path="admin/permissoes" element={<ProtectedRoute roles={['admin']}><AdminPermissoes /></ProtectedRoute>} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </DataProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
