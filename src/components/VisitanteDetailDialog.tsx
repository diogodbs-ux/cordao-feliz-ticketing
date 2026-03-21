import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { GrupoVisita, getCordaoTailwindBg, getCordaoTailwindText, getCordaoLabel, CordaoColor, calcAdultCordoes } from '@/types';
import { Accessibility, Mail, Phone, MapPin, Users, Baby } from 'lucide-react';
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
  const numAdultos = calcAdultCordoes(numCriancas);

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

          {/* Business rule alert */}
          <div className="bg-primary/10 rounded-xl p-4">
            <p className="text-sm font-semibold text-foreground">Regra de Cordões Adultos</p>
            <p className="text-sm text-muted-foreground mt-1">
              {numCriancas} criança(s) → direito a <strong className="text-foreground">{numAdultos} cordão(ões) rosa</strong> (adultos)
            </p>
          </div>

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
            <p className="text-sm font-medium text-foreground mb-2">Cordões a entregar:</p>
            <div className="flex flex-wrap gap-2">
              <span className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold', getCordaoTailwindBg('rosa'), getCordaoTailwindText('rosa'))}>
                {numAdultos}x ROSA (Adultos)
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
