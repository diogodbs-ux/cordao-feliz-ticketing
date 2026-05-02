import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { EspacoLudico, readEspacos, writeEspacos } from '@/types/espacos';
import { Plus, Trash2, Edit, MapPin } from 'lucide-react';
import { toast } from 'sonner';

const SEED_CATEGORIAS = ['Piscina de Bolinhas', 'Escola', 'Hospital', 'CEART', 'Brinquedoteca', 'Outro'];

export default function AdminEspacos() {
  const [list, setList] = useState<EspacoLudico[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EspacoLudico | null>(null);
  const [form, setForm] = useState({ nome: '', categoria: '', capacidadeCiclo: '', duracaoCicloMin: '', ativo: true });

  useEffect(() => { setList(readEspacos()); }, []);

  const save = (next: EspacoLudico[]) => { writeEspacos(next); setList(next); };

  const openCreate = () => {
    setEditing(null);
    setForm({ nome: '', categoria: '', capacidadeCiclo: '', duracaoCicloMin: '', ativo: true });
    setOpen(true);
  };
  const openEdit = (e: EspacoLudico) => {
    setEditing(e);
    setForm({
      nome: e.nome,
      categoria: e.categoria || '',
      capacidadeCiclo: e.capacidadeCiclo?.toString() || '',
      duracaoCicloMin: e.duracaoCicloMin?.toString() || '',
      ativo: e.ativo,
    });
    setOpen(true);
  };

  const handleSave = () => {
    if (!form.nome.trim()) { toast.error('Nome obrigatório'); return; }
    const data: EspacoLudico = {
      id: editing?.id || crypto.randomUUID(),
      nome: form.nome.trim(),
      categoria: form.categoria || undefined,
      capacidadeCiclo: form.capacidadeCiclo ? parseInt(form.capacidadeCiclo) : undefined,
      duracaoCicloMin: form.duracaoCicloMin ? parseInt(form.duracaoCicloMin) : undefined,
      ativo: form.ativo,
      criadoEm: editing?.criadoEm || new Date().toISOString(),
    };
    if (editing) save(list.map(x => x.id === editing.id ? data : x));
    else save([...list, data]);
    setOpen(false);
    toast.success(editing ? 'Espaço atualizado' : 'Espaço criado');
  };

  const handleDelete = (id: string) => {
    if (!confirm('Excluir este espaço? Os ciclos já registrados serão preservados.')) return;
    save(list.filter(x => x.id !== id));
    toast.success('Espaço removido');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Espaços Lúdicos</h1>
          <p className="text-sm text-muted-foreground">Cadastro dos ~35 espaços do parque (piscina, escola, CEART etc.)</p>
        </div>
        <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" />Novo Espaço</Button>
      </div>

      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        {list.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <MapPin className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhum espaço cadastrado ainda.</p>
            <p className="text-xs mt-1">Cadastre os espaços lúdicos para que os recreadores possam registrar ciclos.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-4">Nome</th>
                <th className="text-left p-4">Categoria</th>
                <th className="text-left p-4">Capacidade/Ciclo</th>
                <th className="text-left p-4">Duração</th>
                <th className="text-left p-4">Status</th>
                <th className="text-right p-4">Ações</th>
              </tr>
            </thead>
            <tbody>
              {list.map(e => (
                <tr key={e.id} className="border-t border-border">
                  <td className="p-4 font-medium text-foreground">{e.nome}</td>
                  <td className="p-4 text-muted-foreground">{e.categoria || '—'}</td>
                  <td className="p-4 text-muted-foreground">{e.capacidadeCiclo ?? '—'}</td>
                  <td className="p-4 text-muted-foreground">{e.duracaoCicloMin ? `${e.duracaoCicloMin} min` : '—'}</td>
                  <td className="p-4">
                    <span className={`text-xs px-2 py-1 rounded-full ${e.ativo ? 'bg-cordao-verde/20 text-cordao-verde' : 'bg-cordao-cinza/20 text-cordao-cinza'}`}>
                      {e.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(e)}><Edit className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(e.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Editar Espaço' : 'Novo Espaço Lúdico'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Piscina de Bolinhas Central" />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Input list="cat-list" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} placeholder="Ex: Piscina de Bolinhas" />
              <datalist id="cat-list">{SEED_CATEGORIAS.map(c => <option key={c} value={c} />)}</datalist>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Capacidade por ciclo</Label>
                <Input type="number" value={form.capacidadeCiclo} onChange={e => setForm({ ...form, capacidadeCiclo: e.target.value })} placeholder="Ex: 20" />
              </div>
              <div className="space-y-2">
                <Label>Duração do ciclo (min)</Label>
                <Input type="number" value={form.duracaoCicloMin} onChange={e => setForm({ ...form, duracaoCicloMin: e.target.value })} placeholder="Ex: 15" />
              </div>
            </div>
            <div className="flex items-center justify-between bg-secondary/50 rounded-lg p-3">
              <Label>Ativo</Label>
              <Switch checked={form.ativo} onCheckedChange={v => setForm({ ...form, ativo: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
