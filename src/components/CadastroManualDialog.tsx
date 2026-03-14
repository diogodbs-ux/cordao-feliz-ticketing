import { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { getCordaoCor, GrupoVisita, Crianca } from '@/types';
import { Plus, Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

interface CadastroManualDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CadastroManualDialog({ open, onOpenChange }: CadastroManualDialogProps) {
  const { setGrupos, grupos } = useData();

  const [resp, setResp] = useState({
    nome: '', contato: '', email: '', bairro: '', cidade: 'FORTALEZA', uf: 'CE', tipoAgendamento: 'FAMILIAR',
  });

  const [criancas, setCriancas] = useState<{
    nome: string; idade: string; genero: string; pcd: boolean; pcdDescricao: string;
  }[]>([{ nome: '', idade: '', genero: 'MASCULINO', pcd: false, pcdDescricao: '' }]);

  const addCrianca = () => {
    setCriancas(prev => [...prev, { nome: '', idade: '', genero: 'MASCULINO', pcd: false, pcdDescricao: '' }]);
  };

  const removeCrianca = (idx: number) => {
    if (criancas.length <= 1) return;
    setCriancas(prev => prev.filter((_, i) => i !== idx));
  };

  const updateCrianca = (idx: number, field: string, value: any) => {
    setCriancas(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  };

  const resetForm = () => {
    setResp({ nome: '', contato: '', email: '', bairro: '', cidade: 'FORTALEZA', uf: 'CE', tipoAgendamento: 'FAMILIAR' });
    setCriancas([{ nome: '', idade: '', genero: 'MASCULINO', pcd: false, pcdDescricao: '' }]);
  };

  const handleSubmit = () => {
    if (!resp.nome.trim()) {
      toast.error('Nome do responsável é obrigatório.');
      return;
    }
    if (criancas.some(c => !c.nome.trim() || !c.idade)) {
      toast.error('Preencha nome e idade de todas as crianças.');
      return;
    }

    const novoCriancas: Crianca[] = criancas.map(c => {
      const idade = parseInt(c.idade) || 0;
      return {
        id: crypto.randomUUID(),
        nome: c.nome.toUpperCase(),
        idade,
        genero: c.genero,
        pcd: c.pcd,
        pcdDescricao: c.pcd ? c.pcdDescricao : undefined,
        cordaoCor: getCordaoCor(idade),
      };
    });

    const novoGrupo: GrupoVisita = {
      id: crypto.randomUUID(),
      responsavel: {
        id: crypto.randomUUID(),
        protocolo: `MANUAL-${Date.now()}`,
        nome: resp.nome.toUpperCase(),
        contato: resp.contato,
        email: resp.email,
        bairro: resp.bairro.toUpperCase(),
        cidade: resp.cidade.toUpperCase(),
        uf: resp.uf.toUpperCase(),
        tipoAgendamento: resp.tipoAgendamento,
        criancas: novoCriancas,
      },
      checkinRealizado: false,
    };

    setGrupos([...grupos, novoGrupo]);
    toast.success(`Cadastro manual realizado! ${resp.nome} com ${criancas.length} criança(s).`);
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Cadastro Manual de Visitante
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Responsável */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Dados do Responsável</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">Nome Completo *</Label>
                <Input value={resp.nome} onChange={e => setResp(r => ({ ...r, nome: e.target.value }))} placeholder="Nome do responsável" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Contato</Label>
                <Input value={resp.contato} onChange={e => setResp(r => ({ ...r, contato: e.target.value }))} placeholder="85999999999" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">E-mail</Label>
                <Input value={resp.email} onChange={e => setResp(r => ({ ...r, email: e.target.value }))} placeholder="email@exemplo.com" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Bairro</Label>
                <Input value={resp.bairro} onChange={e => setResp(r => ({ ...r, bairro: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Cidade</Label>
                <Input value={resp.cidade} onChange={e => setResp(r => ({ ...r, cidade: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">UF</Label>
                <Input value={resp.uf} onChange={e => setResp(r => ({ ...r, uf: e.target.value }))} maxLength={2} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo</Label>
                <Select value={resp.tipoAgendamento} onValueChange={v => setResp(r => ({ ...r, tipoAgendamento: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FAMILIAR">Familiar</SelectItem>
                    <SelectItem value="INSTITUCIONAL">Institucional</SelectItem>
                    <SelectItem value="AVULSO">Avulso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Crianças */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Crianças</h3>
              <Button variant="outline" size="sm" onClick={addCrianca} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Adicionar Criança
              </Button>
            </div>

            <div className="space-y-4">
              {criancas.map((c, idx) => (
                <div key={idx} className="bg-secondary/30 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">Criança {idx + 1}</span>
                    {criancas.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => removeCrianca(idx)} className="text-destructive h-7 px-2">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2 space-y-1.5">
                      <Label className="text-xs">Nome *</Label>
                      <Input value={c.nome} onChange={e => updateCrianca(idx, 'nome', e.target.value)} placeholder="Nome da criança" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Idade *</Label>
                      <Input type="number" min={0} max={17} value={c.idade} onChange={e => updateCrianca(idx, 'idade', e.target.value)} placeholder="0" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Gênero</Label>
                      <Select value={c.genero} onValueChange={v => updateCrianca(idx, 'genero', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MASCULINO">Masculino</SelectItem>
                          <SelectItem value="FEMININO">Feminino</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2 flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Switch checked={c.pcd} onCheckedChange={v => updateCrianca(idx, 'pcd', v)} />
                        <Label className="text-xs">Possui Deficiência</Label>
                      </div>
                      {c.pcd && (
                        <Input
                          value={c.pcdDescricao}
                          onChange={e => updateCrianca(idx, 'pcdDescricao', e.target.value)}
                          placeholder="Tipo de deficiência"
                          className="flex-1"
                        />
                      )}
                    </div>
                  </div>
                  {c.idade && (
                    <p className="text-xs text-muted-foreground">
                      Cordão: <span className="font-bold capitalize">{getCordaoCor(parseInt(c.idade) || 0)}</span>
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>Cancelar</Button>
          <Button onClick={handleSubmit} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Cadastrar Visitante
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
