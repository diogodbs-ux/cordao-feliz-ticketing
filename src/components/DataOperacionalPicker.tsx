import { useState } from 'react';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { format, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface Props {
  /** Date string in dd/MM/yyyy format. */
  value: string;
  onChange: (ddmmyyyy: string) => void;
  /** Today (real) string for comparison and reset */
  hojeReal: string;
  className?: string;
}

/**
 * Date picker for operational panels (Recreador / Coordenador).
 * When the selected date differs from today, shows a "MODO HOMOLOGAÇÃO" indicator.
 */
export default function DataOperacionalPicker({ value, onChange, hojeReal, className }: Props) {
  const [open, setOpen] = useState(false);
  // Visual-only flag: indicates the picker is on a date other than today.
  // This is NOT homologation mode — it's just historical/future navigation.
  const isOutroDia = value !== hojeReal;

  const dateObj = (() => {
    try {
      return parse(value, 'dd/MM/yyyy', new Date());
    } catch {
      return new Date();
    }
  })();

  const handleSelect = (d: Date | undefined) => {
    if (!d) return;
    onChange(format(d, 'dd/MM/yyyy'));
    setOpen(false);
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {isOutroDia && (
        <button
          onClick={() => onChange(hojeReal)}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          title="Voltar para hoje"
        >
          <X className="h-3 w-3" />
          Visualizando outro dia
        </button>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'gap-2 h-9',
              isOutroDia && 'border-primary/40 bg-primary/5'
            )}
          >
            <CalendarIcon className="h-4 w-4" />
            {format(dateObj, "EEE, dd 'de' MMM", { locale: ptBR })}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={dateObj}
            onSelect={handleSelect}
            initialFocus
            locale={ptBR}
            className={cn('p-3 pointer-events-auto')}
          />
          <div className="p-2 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => { onChange(hojeReal); setOpen(false); }}
            >
              Voltar para hoje ({hojeReal})
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
