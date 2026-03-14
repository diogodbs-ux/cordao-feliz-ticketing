import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User, UserRole } from '@/types';

interface AuthContextType {
  user: User | null;
  login: (email: string, senha: string) => boolean;
  logout: () => void;
  isAuthenticated: boolean;
  hasRole: (role: UserRole) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const DEFAULT_ADMIN: User = {
  id: 'admin-001',
  nome: 'Administrador TI',
  email: 'admin',
  senha: 'admin123',
  role: 'admin',
  ativo: true,
  criadoEm: new Date().toISOString(),
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('sentinela_user');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    // Ensure default admin exists
    const users = JSON.parse(localStorage.getItem('sentinela_users') || '[]') as User[];
    if (!users.find(u => u.id === DEFAULT_ADMIN.id)) {
      users.push(DEFAULT_ADMIN);
      localStorage.setItem('sentinela_users', JSON.stringify(users));
    }
  }, []);

  const login = useCallback((email: string, senha: string): boolean => {
    const users = JSON.parse(localStorage.getItem('sentinela_users') || '[]') as User[];
    const found = users.find(u => u.email === email && u.senha === senha && u.ativo);
    if (found) {
      setUser(found);
      localStorage.setItem('sentinela_user', JSON.stringify(found));
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('sentinela_user');
  }, []);

  const hasRole = useCallback((role: UserRole) => user?.role === role, [user]);

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
