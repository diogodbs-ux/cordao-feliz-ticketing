import { useEffect, useState } from 'react';
import { UserRole } from '@/types';
import {
  ALL_MENU_ITEMS, DEFAULT_PERMISSOES, PermissoesMap,
  readPermissoes, writePermissoes, resetPermissoes,
} from '@/lib/permissoes';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Shield, Save, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const ROLES: { value: UserRole; label: string; descr: string }[] = [
  { value: 'admin', label: 'Administrador', descr: 'Acesso total ao sistema' },
  { value: 'coordenador', label: 'Coordenador', descr: 'Operação e acompanhamento de espaços' },
  { value: 'supervisor', label: 'Supervisor', descr: 'Acompanha e fecha a operação' },
  { value: 'recreador', label: 'Recreador (Guichê)', descr: 'Realiza check-in' },
  { value: 'recreador_espaco', label: 'Recreador de Espaço', descr: 'Opera ciclos no espaço lúdico' },
  { value: 'observador', label: 'Observador', descr: 'Acesso somente leitura / teste' },
];

export default function AdminPermissoes() {
  const [perms, setPerms] = useState<PermissoesMap>(DEFAULT_PERMISSOES);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { setPerms(readPermissoes()); }, []);

  const toggle = (role: UserRole, path: string) => {
    setPerms(prev => {
      const cur = new Set(prev[role] || []);
      if (cur.has(path)) cur.delete(path); else cur.add(path);
      return { ...prev, [role]: Array.from(cur) };
    });
    setDirty(true);
  };

  const save = () => {
    writePermissoes(perms);
    setDirty(false);
    toast.success('Permissões salvas. As mudanças aparecem imediatamente no menu.');
  };

  const reset = () => {
    if (!confirm('Restaurar permissões padrão? Suas customizações serão perdidas.')) return;
    resetPermissoes();
    setPerms(DEFAULT_PERMISSOES);
    setDirty(false);
    toast.success('Permissões restauradas ao padrão.');
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" /> Matriz de Permissões
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Controle quais menus e telas cada perfil pode acessar. As alterações têm efeito imediato.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={reset} className="gap-2">
            <RotateCcw className="h-4 w-4" /> Restaurar padrão
          </Button>
          <Button onClick={save} disabled={!dirty} className="gap-2">
            <Save className="h-4 w-4" /> Salvar alterações
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-foreground sticky left-0 bg-secondary/40 z-10 min-w-[260px]">
                  Tela / Menu
                </th>
                {ROLES.map(r => (
                  <th key={r.value} className="px-3 py-3 text-center min-w-[120px]">
                    <p className="text-xs font-bold text-foreground">{r.label}</p>
                    <p className="text-[10px] text-muted-foreground font-normal mt-0.5">{r.descr}</p>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ALL_MENU_ITEMS.map(item => (
                <tr key={item.path} className="border-t border-border hover:bg-secondary/20">
                  <td className="px-4 py-2 sticky left-0 bg-card z-10">
                    <p className="font-medium text-foreground">{item.label}</p>
                    <p className="text-[10px] text-muted-foreground font-mono-data">{item.path}</p>
                  </td>
                  {ROLES.map(r => {
                    const checked = (perms[r.value] || []).includes(item.path);
                    return (
                      <td key={r.value} className="px-3 py-2 text-center">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggle(r.value, item.path)}
                          className={cn(checked && 'border-primary')}
                          disabled={r.value === 'admin'}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-secondary/40 rounded-lg p-4 text-xs text-muted-foreground">
        <strong className="text-foreground">Observação:</strong> o perfil <strong>Administrador</strong> tem
        acesso total e não pode ser restringido. Estas permissões controlam o menu lateral; rotas digitadas
        diretamente também serão validadas pelo sistema.
      </div>
    </div>
  );
}
