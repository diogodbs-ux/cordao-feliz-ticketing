import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { User, UserRole } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Camera, ChevronDown, Pencil, Plus, Trash2, UserPlus, Users } from 'lucide-react';
import {
  ROLE_LABEL, buildOrganograma, comprimirFoto, isRecreador, membrosVisiveis,
  papeisQuePodeCadastrar, readUsers, removerMembro, resumoEquipe, salvarMembro, subscribeEquipes,
} from '@/lib/equipes';
import { readEspacos } from '@/types/espacos';

type FormState = {
  nome: string; email: string; senha: string; role: UserRole;
  telefone: string; funcao: string; fotoUrl: string; guiche: string;
  espacoId: string; supervisorId: string; coordenadorId: string;
};

const EMPTY: FormState = {
  nome: '', email: '', senha: '', role: 'recreador', telefone: '', funcao: '',
  fotoUrl: '', guiche: '', espacoId: '', supervisorId: '', coordenadorId: '',
};

function Avatar({ user, size = 'md' }: { user: { nome: string; fotoUrl?: string }; size?: 'sm' | 'md' | 'lg' }) {
  const cls = size === 'lg' ? 'h-16 w-16 text-lg' : size === 'sm' ? 'h-8 w-8 text-[10px]' : 'h-11 w-11 text-sm';
  if (user.fotoUrl) {
    return <img src={user.fotoUrl} alt={`Foto de ${user.nome}`} className={cn(cls, 'rounded-full object-cover border border-border')} />;
  }
  return (
    <div className={cn(cls, 'rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center border border-border')}>
      {user.nome.charAt(0).toUpperCase()}
    </div>
  );
}

export default function AdminEquipes() {
  const { user } = useAuth();
  const [version, setVersion] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<User | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => subscribeEquipes(() => setVersion(v => v + 1)), []);

  const users = useMemo(() => readUsers(), [version]);
  const organograma = useMemo(() => buildOrganograma(users), [users]);
  const resumo = useMemo(() => resumoEquipe(users), [users]);
  const espacos = useMemo(() => readEspacos().filter(e => e.ativo), [version]);

  const papeis = user ? papeisQuePodeCadastrar(user.role) : [];
  const geridos = useMemo(() => (user ? membrosVisiveis(user, users) : []), [user, users]);
  const supervisores = users.filter(u => u.role === 'supervisor' && u.ativo !== false);
  const coordenadores = users.filter(u => u.role === 'coordenador' && u.ativo !== false);

  if (!user) return null;

  const podeEditar = (alvo: User) => {
    if (user.role === 'admin') return alvo.role !== 'admin';
    return geridos.some(g => g.id === alvo.id);
  };

  const openCreate = (role?: UserRole, supervisorId?: string, coordenadorId?: string) => {
    if (papeis.length === 0) { toast.error('Seu perfil não pode cadastrar membros de equipe.'); return; }
    setEditando(null);
    setForm({
      ...EMPTY,
      role: role && papeis.includes(role) ? role : papeis[0],
      supervisorId: supervisorId || (user.role === 'supervisor' ? user.id : ''),
      coordenadorId: coordenadorId || (user.role === 'coordenador' ? user.id : ''),
    });
    setDialogOpen(true);
  };

  const openEdit = (u: User) => {
    setEditando(u);
    setForm({
      nome: u.nome, email: u.email, senha: '', role: u.role,
      telefone: u.telefone || '', funcao: u.funcao || '', fotoUrl: u.fotoUrl || '',
      guiche: u.guiche?.toString() || '', espacoId: u.espacoId || '',
      supervisorId: u.supervisorId || '', coordenadorId: u.coordenadorId || '',
    });
    setDialogOpen(true);
  };

  const onFoto = async (file?: File) => {
    if (!file) return;
    try {
      const dataUrl = await comprimirFoto(file);
      setForm(f => ({ ...f, fotoUrl: dataUrl }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível carregar a foto.');
    }
  };

  const submit = () => {
    const espaco = espacos.find(e => e.id === form.espacoId);
    const res = salvarMembro({
      nome: form.nome,
      email: form.email,
      senha: form.senha,
      role: form.role,
      telefone: form.telefone.trim() || undefined,
      funcao: form.funcao.trim() || undefined,
      fotoUrl: form.fotoUrl || undefined,
      guiche: form.guiche ? parseInt(form.guiche) : undefined,
      espacoId: espaco?.id,
      espacoNome: espaco?.nome,
      supervisorId: form.role === 'coordenador' ? (form.supervisorId || undefined) : undefined,
      coordenadorId: isRecreador({ role: form.role } as User) ? (form.coordenadorId || undefined) : undefined,
    }, editando?.id || null, user.nome);
    if (!res.ok) { toast.error(res.erro); return; }
    toast.success(editando ? 'Membro atualizado.' : 'Membro cadastrado na equipe.');
    setDialogOpen(false);
    setVersion(v => v + 1);
  };

  const excluir = (u: User) => {
    if (!confirm(`Remover ${u.nome} da equipe? O acesso dele será excluído.`)) return;
    const res = removerMembro(u.id, user.nome);
    if (!res.ok) { toast.error(res.erro || 'Falha ao remover.'); return; }
    toast.success('Membro removido.');
    setVersion(v => v + 1);
  };

  const MembroRow = ({ m }: { m: User }) => (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2">
      <Avatar user={m} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">{m.nome}</p>
        <p className="text-[11px] text-muted-foreground truncate">
          {m.funcao || ROLE_LABEL[m.role]}
          {m.espacoNome ? ` — ${m.espacoNome}` : m.guiche ? ` — Guichê ${m.guiche}` : ''}
          {m.telefone ? ` — ${m.telefone}` : ''}
        </p>
      </div>
      {!m.fotoUrl && <span className="text-[10px] font-bold text-cordao-amarelo-foreground bg-cordao-amarelo/30 px-2 py-0.5 rounded-full">sem foto</span>}
      {podeEditar(m) && (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEdit(m)}><Pencil className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => excluir(m)}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      )}
    </div>
  );

  const CoordBloco = ({ node }: { node: { coordenador: User; recreadores: User[] } }) => {
    const key = node.coordenador.id;
    const aberto = abertos[key] !== false;
    return (
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center gap-3 p-3">
          <Avatar user={node.coordenador} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground truncate">{node.coordenador.nome}</p>
            <p className="text-[11px] text-muted-foreground">{node.coordenador.funcao || 'Coordenador'} — {node.recreadores.length} recreador(es)</p>
          </div>
          {podeEditar(node.coordenador) && (
            <Button variant="ghost" size="sm" onClick={() => openEdit(node.coordenador)}><Pencil className="h-3.5 w-3.5" /></Button>
          )}
          {papeis.includes('recreador') && (
            <Button variant="outline" size="sm" className="gap-1" onClick={() => openCreate('recreador', undefined, node.coordenador.id)}>
              <UserPlus className="h-3.5 w-3.5" /> Recreador
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setAbertos(a => ({ ...a, [key]: !aberto }))}>
            <ChevronDown className={cn('h-4 w-4 transition-transform', !aberto && '-rotate-90')} />
          </Button>
        </div>
        {aberto && (
          <div className="border-t border-border p-3 space-y-2">
            {node.recreadores.length === 0
              ? <p className="text-xs text-muted-foreground">Nenhum recreador vinculado a este coordenador.</p>
              : node.recreadores.map(r => <MembroRow key={r.id} m={r} />)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Equipes & Organograma</h1>
          <p className="text-sm text-muted-foreground">Supervisores cadastram coordenadores; coordenadores cadastram seus recreadores com foto.</p>
        </div>
        {papeis.length > 0 && (
          <Button className="gap-2" onClick={() => openCreate()}><Plus className="h-4 w-4" /> Novo membro</Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Supervisores', value: resumo.supervisores },
          { label: 'Coordenadores', value: resumo.coordenadores },
          { label: 'Recreadores', value: resumo.recreadores },
          { label: 'Sem foto', value: resumo.semFoto },
          { label: 'Sem equipe', value: resumo.semEquipe },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-xl bg-card shadow-card p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{kpi.label}</p>
            <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="organograma">
        <TabsList>
          <TabsTrigger value="organograma" className="gap-2"><Users className="h-4 w-4" /> Organograma</TabsTrigger>
          <TabsTrigger value="minha">Minha equipe ({geridos.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="organograma" className="space-y-5 pt-4">
          {organograma.supervisores.map(node => (
            <div key={node.supervisor.id} className="rounded-2xl border border-border bg-secondary/30 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Avatar user={node.supervisor} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Supervisão</p>
                  <p className="text-base font-bold text-foreground truncate">{node.supervisor.nome}</p>
                  <p className="text-xs text-muted-foreground">{node.coordenadores.length} coordenador(es) — {node.coordenadores.reduce((s, c) => s + c.recreadores.length, 0)} recreador(es)</p>
                </div>
                {podeEditar(node.supervisor) && (
                  <Button variant="ghost" size="sm" onClick={() => openEdit(node.supervisor)}><Pencil className="h-3.5 w-3.5" /></Button>
                )}
                {papeis.includes('coordenador') && (
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => openCreate('coordenador', node.supervisor.id)}>
                    <UserPlus className="h-3.5 w-3.5" /> Coordenador
                  </Button>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {node.coordenadores.length === 0
                  ? <p className="text-xs text-muted-foreground">Nenhum coordenador cadastrado nesta supervisão.</p>
                  : node.coordenadores.map(c => <CoordBloco key={c.coordenador.id} node={c} />)}
              </div>
            </div>
          ))}

          {organograma.coordenadoresSemSupervisor.length > 0 && (
            <div className="rounded-2xl border border-dashed border-border p-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Coordenadores sem supervisor</p>
              <div className="grid gap-3 md:grid-cols-2">
                {organograma.coordenadoresSemSupervisor.map(c => <CoordBloco key={c.coordenador.id} node={c} />)}
              </div>
            </div>
          )}

          {organograma.recreadoresSemEquipe.length > 0 && (
            <div className="rounded-2xl border border-dashed border-border p-4 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Recreadores sem coordenador</p>
              {organograma.recreadoresSemEquipe.map(r => <MembroRow key={r.id} m={r} />)}
            </div>
          )}

          {organograma.supervisores.length === 0 && organograma.coordenadoresSemSupervisor.length === 0 && organograma.recreadoresSemEquipe.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum membro de equipe cadastrado ainda.</p>
          )}
        </TabsContent>

        <TabsContent value="minha" className="space-y-2 pt-4">
          {geridos.length === 0
            ? <p className="text-sm text-muted-foreground">Você ainda não tem membros sob sua responsabilidade.</p>
            : geridos.map(m => <MembroRow key={m.id} m={m} />)}
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar membro' : 'Novo membro da equipe'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-4">
              <Avatar user={{ nome: form.nome || '?', fotoUrl: form.fotoUrl }} size="lg" />
              <div className="space-y-2">
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => onFoto(e.target.files?.[0])} />
                <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => fileRef.current?.click()}>
                  <Camera className="h-4 w-4" /> {form.fotoUrl ? 'Trocar foto' : 'Adicionar foto'}
                </Button>
                {form.fotoUrl && (
                  <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setForm(f => ({ ...f, fotoUrl: '' }))}>Remover foto</Button>
                )}
                <p className="text-[11px] text-muted-foreground">A foto aparece para os pais na avaliação.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2 col-span-2">
                <Label>Nome completo</Label>
                <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Login</Label>
                <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{editando ? 'Nova senha (opcional)' : 'Senha'}</Label>
                <Input type="password" value={form.senha} onChange={e => setForm(f => ({ ...f, senha: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Perfil</Label>
                <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v as UserRole }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(editando ? Array.from(new Set([...papeis, editando.role])) : papeis).map(r => (
                      <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Telefone (interno)</Label>
                <Input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Função / cargo (exibido no organograma)</Label>
                <Input value={form.funcao} placeholder="Ex.: Coordenador de Espaços Lúdicos" onChange={e => setForm(f => ({ ...f, funcao: e.target.value }))} />
              </div>

              {form.role === 'coordenador' && (
                <div className="space-y-2 col-span-2">
                  <Label>Supervisor responsável</Label>
                  <Select value={form.supervisorId || 'none'} onValueChange={v => setForm(f => ({ ...f, supervisorId: v === 'none' ? '' : v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem supervisor</SelectItem>
                      {supervisores.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {(form.role === 'recreador' || form.role === 'recreador_espaco') && (
                <>
                  <div className="space-y-2">
                    <Label>Coordenador responsável</Label>
                    <Select value={form.coordenadorId || 'none'} onValueChange={v => setForm(f => ({ ...f, coordenadorId: v === 'none' ? '' : v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem coordenador</SelectItem>
                        {coordenadores.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {form.role === 'recreador_espaco' ? (
                    <div className="space-y-2">
                      <Label>Espaço lúdico</Label>
                      <Select value={form.espacoId || 'none'} onValueChange={v => setForm(f => ({ ...f, espacoId: v === 'none' ? '' : v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sem espaço fixo</SelectItem>
                          {espacos.map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label>Guichê</Label>
                      <Input value={form.guiche} inputMode="numeric" onChange={e => setForm(f => ({ ...f, guiche: e.target.value.replace(/\D/g, '') }))} />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={submit}>{editando ? 'Salvar' : 'Cadastrar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
