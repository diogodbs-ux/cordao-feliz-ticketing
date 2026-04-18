import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { GrupoVisita, getCordaoTailwindBg, getCordaoTailwindText, getCordaoLabel, CordaoColor, calcAdultCordoes, calcVagasAcompanhante } from '@/types';
import { Accessibility, Mail, Phone, MapPin, Users, Baby, UserCheck, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { imprimirCordoes, CordaoPrintItem } from '@/lib/print';
import { cn } from '@/lib/utils';

interface Props {
  grupo: GrupoVisita | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function VisitanteDetailDialog({ grupo, open, onOpenChange }: Props) {
  if (!grupo) return null;

  const r = grupo.responsavel;
  const numCriancas = r.criancas.length;
  const numAcompanhantes = r.acompanhantes?.length || 0;
  const totalAdultos = 1 + numAcompanhantes; // responsável + acompanhantes
  const maxAdultos = calcAdultCordoes(numCriancas);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Detalhes do Visitante</DialogTitle>
        </DialogHeader>

        {/* Responsável info */}
        <div className="space-y-4">
          <div className="bg-secondary/30 rounded-xl p-4 space-y-2">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Responsável
            </h3>
            <p className="text-lg font-semibold text-foreground">{r.nome}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{r.contato}</span>
              <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{r.email}</span>
              <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{r.bairro}, {r.cidade} - {r.uf}</span>
              <span>Protocolo: {r.protocolo}</span>
            </div>
            {r.tipoAgendamento && <p className="text-xs text-muted-foreground">Tipo: {r.tipoAgendamento}</p>}
            {r.nomeInstituicao && r.nomeInstituicao !== '-' && (
              <p className="text-xs text-muted-foreground">Instituição: {r.nomeInstituicao}</p>
            )}
            {grupo.dataAgendamento && (
              <p className="text-xs text-muted-foreground">Agendado para: {grupo.dataAgendamento}</p>
            )}
          </div>

          {/* Business rule - adult slots */}
          <div className="bg-primary/10 rounded-xl p-4">
            <p className="text-sm font-semibold text-foreground">Regra de Cordões Adultos</p>
            <p className="text-sm text-muted-foreground mt-1">
              {numCriancas} criança(s) → direito a <strong className="text-foreground">{maxAdultos} cordão(ões) rosa</strong> (adultos)
            </p>
            <div className="flex gap-1.5 mt-2">
              {Array.from({ length: maxAdultos }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'h-3 w-3 rounded-full',
                    i < totalAdultos ? 'bg-cordao-rosa' : 'bg-muted border border-border'
                  )}
                  title={i === 0 ? 'Responsável' : i < totalAdultos ? `Acompanhante ${i}` : 'Vaga disponível'}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalAdultos}/{maxAdultos} adultos cadastrados (1 responsável + {numAcompanhantes} acompanhante(s))
            </p>
          </div>

          {/* Acompanhantes */}
          {r.acompanhantes && r.acompanhantes.length > 0 && (
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2 mb-3">
                <UserCheck className="h-4 w-4 text-muted-foreground" />
                Acompanhantes ({r.acompanhantes.length})
              </h3>
              <div className="space-y-2">
                {r.acompanhantes.map(a => (
                  <div key={a.id} className="flex items-center gap-3 bg-cordao-rosa/10 rounded-lg p-3">
                    <div className={cn('w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold bg-cordao-rosa text-primary-foreground')}>
                      ROS
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{a.nome}</p>
                      {a.parentesco && <p className="text-xs text-muted-foreground">{a.parentesco}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Crianças */}
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2 mb-3">
              <Baby className="h-4 w-4 text-muted-foreground" />
              Crianças ({numCriancas})
            </h3>
            <div className="space-y-2">
              {r.criancas.map(c => (
                <div key={c.id} className="flex items-center gap-3 bg-secondary/20 rounded-lg p-3">
                  <div className={cn('w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold', getCordaoTailwindBg(c.cordaoCor), getCordaoTailwindText(c.cordaoCor))}>
                    {c.cordaoCor.slice(0, 3).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">{c.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.idade} anos · {c.genero} · {getCordaoLabel(c.cordaoCor)}
                    </p>
                  </div>
                  {c.pcd && (
                    <div className="flex items-center gap-1 text-primary">
                      <Accessibility className="h-4 w-4" />
                      <span className="text-xs font-semibold">{c.pcdDescricao || 'PCD'}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Resumo cordões */}
          <div className="bg-secondary/30 rounded-xl p-4">
            <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
              <p className="text-sm font-medium text-foreground">Cordões a entregar:</p>
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => {
                  const items: CordaoPrintItem[] = [
                    { nome: r.nome, cor: 'rosa', detalhe: 'Responsável', guiche: grupo.guiche },
                    ...(r.acompanhantes || []).map(a => ({ nome: a.nome, cor: 'rosa' as CordaoColor, detalhe: a.parentesco || 'Acompanhante', guiche: grupo.guiche })),
                    ...r.criancas.map(c => ({ nome: c.nome, cor: c.cordaoCor, detalhe: `${c.idade} anos`, pcd: c.pcd, pcdDescricao: c.pcdDescricao, guiche: grupo.guiche })),
                  ];
                  imprimirCordoes(items, { titulo: `Cordões — ${r.nome}` });
                }}
              >
                <Printer className="h-3.5 w-3.5" />
                Imprimir Cordões
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold', getCordaoTailwindBg('rosa'), getCordaoTailwindText('rosa'))}>
                {totalAdultos}x ROSA (Adultos)
              </span>
              {Object.entries(
                r.criancas.reduce((acc, c) => {
                  acc[c.cordaoCor] = (acc[c.cordaoCor] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>)
              ).map(([cor, qtd]) => (
                <span
                  key={cor}
                  className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold', getCordaoTailwindBg(cor as CordaoColor), getCordaoTailwindText(cor as CordaoColor))}
                >
                  {qtd}x {cor.toUpperCase()}
                </span>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
