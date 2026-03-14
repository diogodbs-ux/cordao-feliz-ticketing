import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import logo from '@/assets/logo-completa.png';
import { motion } from 'framer-motion';
import { Shield, AlertCircle } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    const success = login(email, senha);
    if (success) {
      navigate('/');
    } else {
      setErro('Credenciais inválidas. Verifique usuário e senha.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        <div className="bg-card rounded-xl shadow-elevated p-8 space-y-6">
          <div className="flex flex-col items-center space-y-4">
            <img src={logo} alt="Cidade Mais Infância" className="h-24 w-auto" />
            <div className="text-center">
              <h1 className="text-2xl font-bold text-foreground">Sentinela Infância</h1>
              <p className="text-sm text-muted-foreground mt-1">Sistema de Gestão Operacional</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-primary/5 rounded-lg p-3">
            <Shield className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-xs text-muted-foreground">Acesso restrito a colaboradores autorizados</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-foreground">Usuário</Label>
              <Input
                id="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Seu usuário"
                className="h-11"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="senha" className="text-sm font-medium text-foreground">Senha</Label>
              <Input
                id="senha"
                type="password"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                placeholder="Sua senha"
                className="h-11"
              />
            </div>

            {erro && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 bg-destructive/10 text-destructive rounded-lg p-3"
              >
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm">{erro}</span>
              </motion.div>
            )}

            <Button type="submit" className="w-full h-11 font-semibold">
              Entrar no Sistema
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            Governo do Estado do Ceará — Cidade Mais Infância
          </p>
        </div>
      </motion.div>
    </div>
  );
}
