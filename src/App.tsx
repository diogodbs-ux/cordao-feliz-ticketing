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
import ListasEspeciais from "@/pages/ListasEspeciais";
import CoordenadorPanel from "@/pages/CoordenadorPanel";
import RecreadorPanel from "@/pages/RecreadorPanel";
import ApresentacaoExecutiva from "@/pages/ApresentacaoExecutiva";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles && user && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  if (user.role === 'coordenador') return <Navigate to="/coordenador" replace />;
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
                <Route path="admin" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
                <Route path="admin/importar" element={<ProtectedRoute roles={['admin']}><AdminImport /></ProtectedRoute>} />
                <Route path="admin/usuarios" element={<ProtectedRoute roles={['admin']}><AdminUsers /></ProtectedRoute>} />
                <Route path="admin/relatorios" element={<ProtectedRoute roles={['admin']}><AdminRelatorios /></ProtectedRoute>} />
                <Route path="admin/configuracoes" element={<ProtectedRoute roles={['admin']}><AdminConfiguracoes /></ProtectedRoute>} />
                <Route path="admin/historico" element={<ProtectedRoute roles={['admin']}><AdminHistorico /></ProtectedRoute>} />
                <Route path="admin/listas-especiais" element={<ProtectedRoute roles={['admin', 'coordenador']}><ListasEspeciais /></ProtectedRoute>} />
                <Route path="coordenador" element={<ProtectedRoute roles={['coordenador', 'admin']}><CoordenadorPanel /></ProtectedRoute>} />
                <Route path="recreador" element={<ProtectedRoute roles={['recreador', 'admin', 'observador']}><RecreadorPanel /></ProtectedRoute>} />
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
