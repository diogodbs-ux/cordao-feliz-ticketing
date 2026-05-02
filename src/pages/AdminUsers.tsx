import { useState, useEffect } from 'react';
import { User, UserRole } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState({ nome: '', email: '', senha: '', role: 'recreador' as UserRole, guiche: '' });

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('sentinela_users') || '[]');
    setUsers(stored);
  }, []);

  const save = (list: User[]) => {
    setUsers(list);
    localStorage.setItem('sentinela_users', JSON.stringify(list));
  };

  const openCreate = () => {
    setEditingUser(null);
    setForm({ nome: '', email: '', senha: '', role: 'recreador', guiche: '' });
    setDialogOpen(true);
  };

  const openEdit = (u: User) => {
    setEditingUser(u);
    setForm({ nome: u.nome, email: u.email, senha: u.senha, role: u.role, guiche: u.guiche?.toString() || '' });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.nome || !form.email || !form.senha) {
      toast.error('Preencha todos os campos obrigatórios.');
      return;
    }

    if (editingUser) {
      const updated = users.map(u =>
        u.id === editingUser.id
          ? { ...u, nome: form.nome, email: form.email, senha: form.senha, role: form.role, guiche: form.guiche ? parseInt(form.guiche) : undefined }
          : u
      );
      save(updated);
      toast.success('Usuário atualizado com sucesso.');
    } else {
      if (users.some(u => u.email === form.email)) {
        toast.error('Já existe um usuário com esse login.');
        return;
      }
      const newUser: User = {
        id: crypto.randomUUID(),
        nome: form.nome,
        email: form.email,
        senha: form.senha,
        role: form.role,
        guiche: form.guiche ? parseInt(form.guiche) : undefined,
        ativo: true,
        criadoEm: new Date().toISOString(),
      };
      save([...users, newUser]);
      toast.success('Usuário criado com sucesso.');
    }
    setDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    if (id === 'admin-001') {
      toast.error('Não é possível excluir o administrador padrão.');
      return;
    }
    if (confirm('Deseja excluir este usuário?')) {
      save(users.filter(u => u.id !== id));
      toast.success('Usuário removido.');
    }
  };

  const roleLabel: Record<UserRole, string> = { admin: 'Administrador', coordenador: 'Coordenador', supervisor: 'Supervisor', recreador: 'Recreador', recreador_espaco: 'Recreador de Espaço', observador: 'Observador (Teste)' };
  const roleBadge: Record<UserRole, string> = { admin: 'bg-cordao-preto text-primary-foreground', coordenador: 'bg-primary text-primary-foreground', supervisor: 'bg-cordao-amarelo text-foreground', recreador: 'bg-cordao-verde text-primary-foreground', recreador_espaco: 'bg-cordao-azul text-primary-foreground', observador: 'bg-cordao-cinza text-primary-foreground' };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestão de Usuários</h1>
          <p className="text-sm text-muted-foreground">Criar e gerenciar acessos ao sistema</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Usuário
        </Button>
      </div>

      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Usuário</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Login</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Perfil</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Guichê</th>
              <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                <td className="px-5 py-3">
                  <p className="text-sm font-medium text-foreground">{u.nome}</p>
                </td>
                <td className="px-5 py-3">
                  <span className="text-sm font-mono-data text-muted-foreground">{u.email}</span>
                </td>
                <td className="px-5 py-3">
                  <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-bold', roleBadge[u.role])}>
                    {roleLabel[u.role]}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <span className="text-sm font-mono-data text-muted-foreground">{u.guiche || '—'}</span>
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(u.id)} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome Completo</Label>
              <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Login (usuário)</Label>
              <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Senha</Label>
              <Input type="password" value={form.senha} onChange={e => setForm(f => ({ ...f, senha: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Perfil</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v as UserRole }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="coordenador">Coordenador</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="recreador">Recreador (Guichê)</SelectItem>
                  <SelectItem value="recreador_espaco">Recreador de Espaço</SelectItem>
                  <SelectItem value="observador">Observador (Teste)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.role === 'observador' && (
              <div className="bg-secondary/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">
                  O perfil <strong>Observador</strong> pode visualizar o sistema como um recreador, mas <strong>não ocupa guichê</strong> e seus check-ins são marcados como teste.
                </p>
              </div>
            )}
            {(form.role === 'recreador' || form.role === 'observador') && (
              <div className="space-y-2">
                <Label>Guichê (1-6) {form.role === 'observador' && <span className="text-muted-foreground">(opcional)</span>}</Label>
                <Input type="number" min={1} max={6} value={form.guiche} onChange={e => setForm(f => ({ ...f, guiche: e.target.value }))} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit}>{editingUser ? 'Salvar' : 'Criar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
