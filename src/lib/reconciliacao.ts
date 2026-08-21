// Reconciliação operacional: compara check-ins (guichê), protocolos, cordões vinculados
// e ciclos de espaço para destacar divergências (pendentes, sem vínculo, duplicados).
import { GrupoVisita, CheckinRegistro } from '@/types';
import { CordaoUnidade, readCordoes } from '@/types/cordoes';
import { CicloEspaco, readCiclos } from '@/types/espacos';
import { readModulos } from '@/lib/modulos';

export type Severidade = 'critico' | 'atencao' | 'info';

export interface Divergencia {
  id: string;
  tipo:
    | 'pendente'              // agendado para o dia e sem check-in
    | 'sem_vinculo'           // check-in feito, nenhum cordão vinculado
    | 'vinculo_parcial'       // menos cordões que membros esperados
    | 'duplicado_checkin'     // mais de um registro de check-in para o mesmo grupo
    | 'duplicado_cordao'      // mesmo membro com mais de um cordão
    | 'cordao_orfao'          // cordão vinculado a protocolo sem check-in
    | 'ciclo_sem_checkin';    // ciclo de espaço com protocolo que não passou pelo guichê
  severidade: Severidade;
  titulo: string;
  detalhe: string;
  protocolo?: string;
  guiche?: number;
  operador?: string;
  acao?: string;
}

export interface PresencaCiclos {
  criancas: number;
  adultos: number;
  ciclos: number;
  protocolosSemCheckin: string[];
}

export interface ReconciliacaoResultado {
  data: string;
  totalGruposDia: number;
  totalCheckins: number;
  totalCordoesVinculados: number;
  divergencias: Divergencia[];
  porTipo: Record<Divergencia['tipo'], number>;
  presencaCiclos: PresencaCiclos;
  contabilizarCiclos: boolean;
}

function ddmmyyyy(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR');
}

function membrosEsperados(g: GrupoVisita): number {
  const adultos = 1 + (g.responsavel.acompanhantes?.length || 0);
  return g.responsavel.criancas.length + adultos;
}

/** Presença estimada a partir dos ciclos de espaço (visitantes que não passaram pelo guichê). */
export function presencaDeCiclos(
  data: string,
  grupos: GrupoVisita[],
  ciclos: CicloEspaco[] = readCiclos(),
): PresencaCiclos {
  const ciclosDia = ciclos.filter(c => ddmmyyyy(c.inicio) === data);
  const protocolosComCheckin = new Set(
    grupos
      .filter(g => g.checkinRealizado && g.checkinData === data && g.responsavel.protocolo)
      .map(g => g.responsavel.protocolo!.trim().toLowerCase()),
  );

  // Dedupe por protocolo (a mesma criança passa por vários espaços no dia)
  const porProtocolo = new Map<string, { criancas: number; adultos: number; label: string }>();
  const semProtocolo: CicloEspaco[] = [];

  ciclosDia.forEach(c => {
    const lista = c.protocolos || [];
    if (lista.length === 0) { semProtocolo.push(c); return; }
    lista.forEach(p => {
      const key = (p.protocolo || '').trim().toLowerCase();
      if (!key || protocolosComCheckin.has(key)) return;
      const prev = porProtocolo.get(key);
      const criancas = p.numCriancas || 0;
      const adultos = p.numAdultos || 0;
      if (!prev) porProtocolo.set(key, { criancas, adultos, label: p.protocolo });
      else porProtocolo.set(key, {
        criancas: Math.max(prev.criancas, criancas),
        adultos: Math.max(prev.adultos, adultos),
        label: prev.label,
      });
    });
  });

  let criancas = 0;
  let adultos = 0;
  porProtocolo.forEach(v => { criancas += v.criancas; adultos += v.adultos; });

  // Ciclos sem protocolo informado: usa o maior ciclo do dia como estimativa mínima
  // (evita multiplicar a mesma criança que circulou por vários espaços).
  if (semProtocolo.length > 0) {
    criancas += Math.max(...semProtocolo.map(c => c.totalCriancas || 0));
    adultos += Math.max(...semProtocolo.map(c => c.totalAdultos || 0));
  }

  return {
    criancas,
    adultos,
    ciclos: ciclosDia.length,
    protocolosSemCheckin: Array.from(porProtocolo.values()).map(v => v.label),
  };
}

export function reconciliar(
  data: string,
  grupos: GrupoVisita[],
  checkins: CheckinRegistro[],
  opts?: { cordoes?: CordaoUnidade[]; ciclos?: CicloEspaco[] },
): ReconciliacaoResultado {
  const cordoes = opts?.cordoes ?? readCordoes();
  const ciclos = opts?.ciclos ?? readCiclos();
  const divergencias: Divergencia[] = [];

  const gruposDia = grupos.filter(g => {
    if (g.dataAgendamento) return g.dataAgendamento === data;
    return ddmmyyyy(g.criadoEm) === data;
  });
  const checkinsDia = checkins.filter(c => ddmmyyyy(c.dataHora) === data);
  const cordoesVinculadosDia = cordoes.filter(c => c.vinculadoEm && ddmmyyyy(c.vinculadoEm) === data && c.protocolo);

  // 1) Pendentes
  gruposDia.filter(g => !g.checkinRealizado).forEach(g => {
    divergencias.push({
      id: `pendente-${g.id}`,
      tipo: 'pendente',
      severidade: 'info',
      titulo: g.responsavel.nome,
      detalhe: `Agendado para ${data} · ${g.responsavel.criancas.length} criança(s) · sem check-in`,
      protocolo: g.responsavel.protocolo,
      acao: 'Aguardando chegada — realizar check-in no Guichê.',
    });
  });

  // 2/3) Sem vínculo e vínculo parcial
  const cordoesPorProtocolo = new Map<string, CordaoUnidade[]>();
  cordoesVinculadosDia.forEach(c => {
    const key = c.protocolo!.trim().toLowerCase();
    cordoesPorProtocolo.set(key, [...(cordoesPorProtocolo.get(key) || []), c]);
  });

  const checkedIn = gruposDia.filter(g => g.checkinRealizado && g.checkinData === data);
  checkedIn.forEach(g => {
    const key = (g.responsavel.protocolo || '').trim().toLowerCase();
    const vinculados = key ? (cordoesPorProtocolo.get(key) || []) : [];
    const esperados = membrosEsperados(g);
    if (vinculados.length === 0) {
      divergencias.push({
        id: `semvinculo-${g.id}`,
        tipo: 'sem_vinculo',
        severidade: 'atencao',
        titulo: g.responsavel.nome,
        detalhe: `Check-in ${g.checkinHora || ''} · nenhum cordão vinculado (esperado ${esperados})`,
        protocolo: g.responsavel.protocolo,
        guiche: g.guiche,
        operador: g.atendidoPor,
        acao: 'Vincular os códigos das etiquetas em Cordões / reabrir o check-in.',
      });
    } else if (vinculados.length < esperados) {
      divergencias.push({
        id: `parcial-${g.id}`,
        tipo: 'vinculo_parcial',
        severidade: 'atencao',
        titulo: g.responsavel.nome,
        detalhe: `${vinculados.length} de ${esperados} membros com cordão vinculado`,
        protocolo: g.responsavel.protocolo,
        guiche: g.guiche,
        operador: g.atendidoPor,
        acao: 'Complete o vínculo dos membros faltantes.',
      });
    }

    // 5) Duplicado de cordão por membro
    const porMembro = new Map<string, CordaoUnidade[]>();
    vinculados.forEach(c => {
      const nome = (c.membroNome || '—').trim().toLowerCase();
      porMembro.set(nome, [...(porMembro.get(nome) || []), c]);
    });
    porMembro.forEach((list, nome) => {
      if (list.length > 1 && nome !== '—') {
        divergencias.push({
          id: `dupcordao-${g.id}-${nome}`,
          tipo: 'duplicado_cordao',
          severidade: 'critico',
          titulo: `${list[0].membroNome} (${g.responsavel.nome})`,
          detalhe: `${list.length} cordões para o mesmo membro: ${list.map(c => c.codigo).join(', ')}`,
          protocolo: g.responsavel.protocolo,
          guiche: list[0].vinculadoGuiche,
          operador: list[0].vinculadoPor,
          acao: 'Verificar qual etiqueta foi entregue e desvincular a duplicada.',
        });
      }
    });
  });

  // 4) Check-in duplicado (mais de um registro para o mesmo grupo)
  const porGrupo = new Map<string, CheckinRegistro[]>();
  checkinsDia.forEach(c => porGrupo.set(c.grupoVisitaId, [...(porGrupo.get(c.grupoVisitaId) || []), c]));
  porGrupo.forEach((list, grupoId) => {
    if (list.length > 1) {
      divergencias.push({
        id: `dupcheckin-${grupoId}`,
        tipo: 'duplicado_checkin',
        severidade: 'critico',
        titulo: list[0].responsavelNome,
        detalhe: `${list.length} registros de check-in · guichês ${Array.from(new Set(list.map(c => c.guiche))).join(', ')}`,
        guiche: list[0].guiche,
        operador: list[0].atendidoPor,
        acao: 'Conferir com os guichês envolvidos — contagem duplicada nos painéis.',
      });
    }
  });

  // 6) Cordão órfão: vinculado a protocolo sem check-in no dia
  const protocolosCheckin = new Set(
    checkedIn.map(g => (g.responsavel.protocolo || '').trim().toLowerCase()).filter(Boolean),
  );
  cordoesPorProtocolo.forEach((list, key) => {
    if (!protocolosCheckin.has(key)) {
      divergencias.push({
        id: `orfao-${key}`,
        tipo: 'cordao_orfao',
        severidade: 'critico',
        titulo: `Protocolo ${list[0].protocolo}`,
        detalhe: `${list.length} cordão(ões) entregue(s) sem check-in correspondente: ${list.map(c => c.codigo).join(', ')}`,
        protocolo: list[0].protocolo,
        guiche: list[0].vinculadoGuiche,
        operador: list[0].vinculadoPor,
        acao: 'Registrar o check-in do grupo ou corrigir o protocolo do cordão.',
      });
    }
  });

  // 7) Ciclos de espaço com protocolo que não passou pelo guichê
  const presencaCiclos = presencaDeCiclos(data, grupos, ciclos);
  presencaCiclos.protocolosSemCheckin.forEach(p => {
    divergencias.push({
      id: `ciclosemcheckin-${p}`,
      tipo: 'ciclo_sem_checkin',
      severidade: 'atencao',
      titulo: `Protocolo ${p}`,
      detalhe: 'Registrado em ciclo de espaço, mas sem check-in no guichê',
      protocolo: p,
      acao: 'Ativar “contabilizar ciclos como presença” ou registrar o check-in retroativo.',
    });
  });

  const porTipo = divergencias.reduce((acc, d) => {
    acc[d.tipo] = (acc[d.tipo] || 0) + 1;
    return acc;
  }, {} as Record<Divergencia['tipo'], number>);

  return {
    data,
    totalGruposDia: gruposDia.length,
    totalCheckins: checkinsDia.length,
    totalCordoesVinculados: cordoesVinculadosDia.length,
    divergencias,
    porTipo,
    presencaCiclos,
    contabilizarCiclos: readModulos().contabilizarCiclosComoPresenca,
  };
}

export const TIPO_LABEL: Record<Divergencia['tipo'], string> = {
  pendente: 'Pendentes (sem check-in)',
  sem_vinculo: 'Check-in sem cordão vinculado',
  vinculo_parcial: 'Vínculo parcial',
  duplicado_checkin: 'Check-in duplicado',
  duplicado_cordao: 'Cordão duplicado',
  cordao_orfao: 'Cordão sem check-in (órfão)',
  ciclo_sem_checkin: 'Ciclo sem check-in',
};
