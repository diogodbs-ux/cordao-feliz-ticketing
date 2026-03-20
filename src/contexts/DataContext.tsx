import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { GrupoVisita, CheckinRegistro, DashboardStats, CordaoColor, getCordaoCor, OrigemVisitante } from '@/types';

interface DataContextType {
  grupos: GrupoVisita[];
  checkins: CheckinRegistro[];
  stats: DashboardStats;
  setGrupos: (g: GrupoVisita[]) => void;
  addCheckin: (checkin: CheckinRegistro) => void;
  marcarCheckin: (grupoId: string, guiche: number, atendidoPor: string) => void;
  getGruposByData: (data: string) => GrupoVisita[];
  importarCSV: (rows: any[]) => void;
  addGrupoManual: (grupo: GrupoVisita) => void;
}

const DataContext = createContext<DataContextType | null>(null);

const STORAGE_KEY_GRUPOS = 'sentinela_grupos';
const STORAGE_KEY_CHECKINS = 'sentinela_checkins';

function readGrupos(): GrupoVisita[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_GRUPOS) || '[]');
  } catch { return []; }
}

function readCheckins(): CheckinRegistro[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_CHECKINS) || '[]');
  } catch { return []; }
}

function calcStats(grupos: GrupoVisita[], checkins: CheckinRegistro[]): DashboardStats {
  const checkedIn = grupos.filter(g => g.checkinRealizado);
  const porCor: Record<CordaoColor, number> = { azul: 0, verde: 0, amarelo: 0, vermelho: 0, rosa: 0, cinza: 0, preto: 0 };
  const porGuiche: Record<number, number> = {};

  checkedIn.forEach(g => {
    porCor.rosa += 1;
    g.responsavel.criancas.forEach(c => {
      porCor[c.cordaoCor] = (porCor[c.cordaoCor] || 0) + 1;
    });
    if (g.guiche) {
      porGuiche[g.guiche] = (porGuiche[g.guiche] || 0) + 1;
    }
  });

  return {
    totalVisitantes: checkedIn.reduce((acc, g) => acc + 1 + g.responsavel.criancas.length, 0),
    totalCriancas: checkedIn.reduce((acc, g) => acc + g.responsavel.criancas.length, 0),
    totalResponsaveis: checkedIn.length,
    totalPCD: checkedIn.reduce((acc, g) => acc + g.responsavel.criancas.filter(c => c.pcd).length, 0),
    porCor,
    porGuiche,
  };
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [grupos, setGruposState] = useState<GrupoVisita[]>(readGrupos);
  const [checkins, setCheckins] = useState<CheckinRegistro[]>(readCheckins);
  const [stats, setStats] = useState<DashboardStats>(() => calcStats(grupos, checkins));
  const syncRef = useRef(false);

  // Cross-tab sync via storage event — enables simultaneous usage from multiple guichês
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_GRUPOS) {
        const parsed = e.newValue ? JSON.parse(e.newValue) : [];
        setGruposState(parsed);
      }
      if (e.key === STORAGE_KEY_CHECKINS) {
        const parsed = e.newValue ? JSON.parse(e.newValue) : [];
        setCheckins(parsed);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  // Also poll every 3s for same-origin tabs that don't fire storage events
  useEffect(() => {
    const interval = setInterval(() => {
      const latestGrupos = readGrupos();
      const latestCheckins = readCheckins();
      // Only update if data actually changed (compare lengths as fast check)
      setGruposState(prev => {
        if (JSON.stringify(prev) !== JSON.stringify(latestGrupos)) return latestGrupos;
        return prev;
      });
      setCheckins(prev => {
        if (JSON.stringify(prev) !== JSON.stringify(latestCheckins)) return latestCheckins;
        return prev;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_GRUPOS, JSON.stringify(grupos));
    localStorage.setItem(STORAGE_KEY_CHECKINS, JSON.stringify(checkins));
    setStats(calcStats(grupos, checkins));
  }, [grupos, checkins]);

  const setGrupos = useCallback((g: GrupoVisita[]) => setGruposState(g), []);

  const addGrupoManual = useCallback((grupo: GrupoVisita) => {
    setGruposState(prev => {
      const fresh = readGrupos();
      // Merge with freshest data to avoid overwriting concurrent writes
      const ids = new Set(fresh.map(g => g.id));
      if (ids.has(grupo.id)) return fresh;
      return [...fresh, grupo];
    });
  }, []);

  const marcarCheckin = useCallback((grupoId: string, guiche: number, atendidoPor: string) => {
    // Read fresh data to avoid overwriting concurrent changes
    const freshGrupos = readGrupos();
    const grupo = freshGrupos.find(g => g.id === grupoId);
    
    if (!grupo || grupo.checkinRealizado) return;

    const now = new Date();
    const updatedGrupos = freshGrupos.map(g => {
      if (g.id !== grupoId) return g;
      return {
        ...g,
        checkinRealizado: true,
        checkinData: now.toLocaleDateString('pt-BR'),
        checkinHora: now.toLocaleTimeString('pt-BR'),
        guiche,
        atendidoPor,
      };
    });
    
    localStorage.setItem(STORAGE_KEY_GRUPOS, JSON.stringify(updatedGrupos));
    setGruposState(updatedGrupos);

    const cordoes: { cor: CordaoColor; quantidade: number }[] = [];
    const corCount: Record<string, number> = { rosa: 1 };
    grupo.responsavel.criancas.forEach(c => {
      corCount[c.cordaoCor] = (corCount[c.cordaoCor] || 0) + 1;
    });
    Object.entries(corCount).forEach(([cor, qtd]) => {
      cordoes.push({ cor: cor as CordaoColor, quantidade: qtd });
    });

    const registro: CheckinRegistro = {
      id: crypto.randomUUID(),
      grupoVisitaId: grupoId,
      responsavelNome: grupo.responsavel.nome,
      totalCriancas: grupo.responsavel.criancas.length,
      guiche,
      atendidoPor,
      dataHora: new Date().toISOString(),
      cordoes,
    };
    
    const freshCheckins = readCheckins();
    const updatedCheckins = [...freshCheckins, registro];
    localStorage.setItem(STORAGE_KEY_CHECKINS, JSON.stringify(updatedCheckins));
    setCheckins(updatedCheckins);
  }, []);

  const addCheckin = useCallback((checkin: CheckinRegistro) => {
    setCheckins(prev => [...prev, checkin]);
  }, []);

  const getGruposByData = useCallback((data: string) => {
    return grupos.filter(g => g.checkinData === data);
  }, [grupos]);

  const importarCSV = useCallback((rows: any[]) => {
    const gruposMap = new Map<string, GrupoVisita>();

    rows.forEach((row: any) => {
      const protocolo = row['Protocolo'] || '';
      const nomeResp = row['Nome Responsável'] || row['Nome Responsavel'] || '';
      const nomeCrianca = row['Nome da Criança'] || row['Nome da Crianca'] || '';
      const idadeStr = row['Idade'] || '0';
      const idade = parseInt(idadeStr) || 0;
      const pcd = (row['Possui Deficiência'] || row['Possui Deficiencia'] || '').toUpperCase() === 'SIM';
      const pcdDesc = row['Descrição Deficiência'] || row['Descricao Deficiencia'] || '';

      const key = protocolo || nomeResp;
      if (!key) return;

      if (!gruposMap.has(key)) {
        gruposMap.set(key, {
          id: crypto.randomUUID(),
          responsavel: {
            id: crypto.randomUUID(),
            protocolo,
            nome: nomeResp,
            contato: row['Contato'] || '',
            email: row['E-mail'] || '',
            bairro: row['Bairro'] || '',
            cidade: row['Cidade'] || '',
            uf: row['UF'] || '',
            tipoAgendamento: row['Tipo Agendamento'] || '',
            nomeInstituicao: row['Nome Instituição'] || row['Nome Instituicao'] || '',
            criancas: [],
          },
          checkinRealizado: false,
          origem: 'agendamento',
          criadoEm: new Date().toISOString(),
        });
      }

      const grupo = gruposMap.get(key)!;
      if (nomeCrianca && nomeCrianca !== '-') {
        grupo.responsavel.criancas.push({
          id: crypto.randomUUID(),
          nome: nomeCrianca,
          idade,
          genero: row['Gênero'] || row['Genero'] || '',
          pcd,
          pcdDescricao: pcd && pcdDesc !== '-' ? pcdDesc : undefined,
          cordaoCor: getCordaoCor(idade),
        });
      }
    });

    const newGrupos = Array.from(gruposMap.values());
    setGruposState(prev => {
      const existingProtocolos = new Set(prev.map(g => g.responsavel.protocolo));
      const toAdd = newGrupos.filter(g => !existingProtocolos.has(g.responsavel.protocolo));
      return [...prev, ...toAdd];
    });
  }, []);

  return (
    <DataContext.Provider value={{ grupos, checkins, stats, setGrupos, addCheckin, marcarCheckin, getGruposByData, importarCSV, addGrupoManual }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
