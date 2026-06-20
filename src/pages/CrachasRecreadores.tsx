// Crachás dos recreadores — gera QR para cada usuário com role recreador/recreador_espaco.
// Coordenador escaneia (ou abre o link) e vê em qual espaço está alocado, quantas horas,
// quantas crianças passaram. Página pública (rota /cracha/:userId) e listagem admin.
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { User } from '@/types';
import { readCiclos, CicloEspaco, subscribeEspacosChange } from '@/types/espacos';
import { Printer, MapPin, Clock, Users as UsersIcon, IdCard } from 'lucide-react';
import { Button } from '@/components/ui/button';

function readUsers(): User[] {
  try { return JSON.parse(localStorage.getItem('sentinela_users') || '[]'); } catch { return []; }
}

function formatDur(seg: number): string {
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}min`;
}

interface ResumoRecreador {
  user: User;
  cicloAtual: CicloEspaco | null;
  horasNoCiclo: number; // segundos
  totalCriancasHoje: number;
  espacosHoje: string[];
}

function resumir(user: User, ciclos: CicloEspaco[]): ResumoRecreador {
  const hoje = new Date().toDateString();
  const meus = ciclos.filter(c => c.recreadorId === user.id && new Date(c.inicio).toDateString() === hoje);
  const cicloAtual = meus.find(c => !c.fim) || null;
  const horasNoCiclo = cicloAtual
    ? Math.floor((Date.now() - new Date(cicloAtual.inicio).getTime()) / 1000)
    : 0;
  const totalCriancasHoje = meus.reduce((a, c) => a + (c.totalCriancas || 0), 0);
  const espacosHoje = Array.from(new Set(meus.map(c => c.espacoNome)));
  return { user, cicloAtual, horasNoCiclo, totalCriancasHoje, espacosHoje };
}

/** Lista admin com todos os crachás imprimíveis. */
export function CrachasRecreadoresAdmin() {
  const [users, setUsers] = useState<User[]>(readUsers);
  const [ciclos, setCiclos] = useState<CicloEspaco[]>(readCiclos);
  const [qrs, setQrs] = useState<Record<string, string>>({});

  useEffect(() => {
    setUsers(readUsers());
    const refresh = () => setCiclos(readCiclos());
    refresh();
    return subscribeEspacosChange(refresh);
  }, []);

  const recreadores = useMemo(
    () => users.filter(u => u.ativo && (u.role === 'recreador' || u.role === 'recreador_espaco')),
    [users]
  );

  useEffect(() => {
    (async () => {
      const out: Record<string, string> = {};
      const origin = window.location.origin;
      for (const u of recreadores) {
        out[u.id] = await QRCode.toDataURL(`${origin}/cracha/${u.id}`, { width: 260, margin: 1 });
      }
      setQrs(out);
    })();
  }, [recreadores.length]);

  const imprimir = () => window.print();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Crachás dos Recreadores</h1>
          <p className="text-sm text-muted-foreground">Imprima e distribua. Coordenador escaneia → vê alocação e métricas do dia.</p>
        </div>
        <Button onClick={imprimir} className="gap-2"><Printer className="h-4 w-4" /> Imprimir todos</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-2">
        {recreadores.map(u => {
          const r = resumir(u, ciclos);
          return (
            <div key={u.id} className="rounded-2xl border-2 border-primary/20 bg-card p-4 shadow-card break-inside-avoid">
              <div className="flex items-center gap-3 pb-3 border-b border-border">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <IdCard className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{u.nome}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{u.role.replace('_', ' ')}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 pt-3">
                {qrs[u.id] && <img src={qrs[u.id]} alt="QR" className="h-24 w-24" />}
                <div className="text-xs space-y-1 text-muted-foreground">
                  <p className="font-semibold text-foreground text-[10px] uppercase tracking-wider">Hoje</p>
                  <p className="flex items-center gap-1"><UsersIcon className="h-3 w-3" /> {r.totalCriancasHoje} crianças</p>
                  <p className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {r.espacosHoje.length} espaços</p>
                  {r.cicloAtual && (
                    <p className="flex items-center gap-1 text-primary font-semibold">
                      <Clock className="h-3 w-3" /> {formatDur(r.horasNoCiclo)} no ciclo
                    </p>
                  )}
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2 text-center font-mono-data">/cracha/{u.id.slice(0, 8)}</p>
            </div>
          );
        })}
      </div>
      {recreadores.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">Nenhum recreador cadastrado.</div>
      )}
    </div>
  );
}

/** Página pública (sem auth, mas dentro do app) acessada via QR. */
export function CrachaPublico() {
  const { userId = '' } = useParams();
  const [users] = useState<User[]>(readUsers);
  const [ciclos, setCiclos] = useState<CicloEspaco[]>(readCiclos);
  useEffect(() => {
    const refresh = () => setCiclos(readCiclos());
    refresh();
    return subscribeEspacosChange(refresh);
  }, []);

  const user = users.find(u => u.id === userId);
  if (!user) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Recreador não encontrado.</div>;
  }
  const r = resumir(user, ciclos);

  return (
    <div className="min-h-screen bg-background p-6 max-w-md mx-auto space-y-5">
      <div className="text-center pt-8">
        <div className="inline-flex h-20 w-20 rounded-3xl bg-primary/10 items-center justify-center mb-3">
          <IdCard className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">{user.nome}</h1>
        <p className="text-sm text-muted-foreground capitalize">{user.role.replace('_', ' ')}</p>
      </div>

      <div className="bg-card rounded-2xl shadow-card p-5 space-y-3">
        <h2 className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Alocação atual</h2>
        {r.cicloAtual ? (
          <>
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-primary" />
              <div>
                <p className="text-lg font-bold text-foreground">{r.cicloAtual.espacoNome}</p>
                <p className="text-xs text-muted-foreground">desde {new Date(r.cicloAtual.inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Metric label="No ciclo" value={formatDur(r.horasNoCiclo)} icon={<Clock className="h-4 w-4" />} />
              <Metric label="Crianças no ciclo" value={String(r.cicloAtual.totalCriancas)} icon={<UsersIcon className="h-4 w-4" />} />
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Sem ciclo aberto agora.</p>
        )}
      </div>

      <div className="bg-card rounded-2xl shadow-card p-5 space-y-3">
        <h2 className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Resumo do dia</h2>
        <div className="grid grid-cols-2 gap-3">
          <Metric label="Crianças atendidas" value={String(r.totalCriancasHoje)} icon={<UsersIcon className="h-4 w-4" />} />
          <Metric label="Espaços trabalhados" value={String(r.espacosHoje.length)} icon={<MapPin className="h-4 w-4" />} />
        </div>
        {r.espacosHoje.length > 0 && (
          <div className="pt-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Espaços</p>
            <div className="flex flex-wrap gap-1">
              {r.espacosHoje.map(e => (
                <span key={e} className="text-[10px] bg-secondary px-2 py-1 rounded-full">{e}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="text-center text-[10px] text-muted-foreground">Sentinela Infância — Crachá Digital</p>
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-secondary/50 rounded-xl p-3">
      <div className="flex items-center gap-1 text-muted-foreground text-[10px] uppercase tracking-wider mb-1">{icon}{label}</div>
      <p className="text-lg font-extrabold text-foreground font-mono-data">{value}</p>
    </div>
  );
}

export default CrachasRecreadoresAdmin;
