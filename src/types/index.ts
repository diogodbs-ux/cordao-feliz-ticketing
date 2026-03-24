export type UserRole = 'admin' | 'coordenador' | 'recreador' | 'observador';

export interface User {
  id: string;
  nome: string;
  email: string;
  senha: string;
  role: UserRole;
  guiche?: number;
  ativo: boolean;
  criadoEm: string;
}

export type CordaoColor = 'azul' | 'verde' | 'amarelo' | 'vermelho' | 'rosa' | 'cinza' | 'preto';

export type OrigemVisitante = 'agendamento' | 'lista_adicional' | 'manual' | 'problema_sistema';

export interface Crianca {
  id: string;
  nome: string;
  idade: number;
  genero: string;
  pcd: boolean;
  pcdDescricao?: string;
  cordaoCor: CordaoColor;
}

export interface Acompanhante {
  id: string;
  nome: string;
  parentesco?: string;
}

export interface Responsavel {
  id: string;
  protocolo: string;
  nome: string;
  contato: string;
  email: string;
  bairro: string;
  cidade: string;
  uf: string;
  tipoAgendamento: string;
  nomeInstituicao?: string;
  criancas: Crianca[];
  acompanhantes?: Acompanhante[];
}

export interface GrupoVisita {
  id: string;
  responsavel: Responsavel;
  checkinRealizado: boolean;
  checkinData?: string;
  checkinHora?: string;
  guiche?: number;
  atendidoPor?: string;
  origem: OrigemVisitante;
  observacao?: string;
  dataAgendamento?: string; // dd/mm/yyyy from CSV
  criadoEm: string;
}

// Business rule: each child entitles 2 adults (responsável + acompanhantes)
export function calcAdultCordoes(numCriancas: number): number {
  return numCriancas * 2; // 1 child = 2 adult wristbands
}

// How many companion slots are still available
export function calcVagasAcompanhante(numCriancas: number, numAcompanhantes: number): number {
  const maxAdultos = numCriancas * 2; // total adult wristbands
  const ocupados = 1 + numAcompanhantes; // 1 = responsável
  return Math.max(0, maxAdultos - ocupados);
}

export interface CheckinRegistro {
  id: string;
  grupoVisitaId: string;
  responsavelNome: string;
  totalCriancas: number;
  guiche: number;
  atendidoPor: string;
  dataHora: string;
  cordoes: { cor: CordaoColor; quantidade: number }[];
}

export interface DashboardStats {
  totalVisitantes: number;
  totalCriancas: number;
  totalResponsaveis: number;
  totalPCD: number;
  porCor: Record<CordaoColor, number>;
  porGuiche: Record<number, number>;
}

export type PeriodoFiltro = 'hoje' | 'semana' | 'mes' | 'ano' | 'todos';

export function getCordaoCor(idade: number): CordaoColor {
  if (idade >= 0 && idade <= 3) return 'azul';
  if (idade >= 4 && idade <= 6) return 'verde';
  if (idade >= 7 && idade <= 9) return 'amarelo';
  if (idade >= 10 && idade <= 12) return 'vermelho';
  return 'rosa';
}

export function getCordaoLabel(cor: CordaoColor): string {
  const labels: Record<CordaoColor, string> = {
    azul: 'Azul (0-3 anos)',
    verde: 'Verde (4-6 anos)',
    amarelo: 'Amarelo (7-9 anos)',
    vermelho: 'Vermelho (10-12 anos)',
    rosa: 'Rosa (Adulto)',
    cinza: 'Cinza (Terceirizado)',
    preto: 'Preto (Serviço)',
  };
  return labels[cor];
}

export function getCordaoTailwindBg(cor: CordaoColor): string {
  const map: Record<CordaoColor, string> = {
    azul: 'bg-cordao-azul',
    verde: 'bg-cordao-verde',
    amarelo: 'bg-cordao-amarelo',
    vermelho: 'bg-cordao-vermelho',
    rosa: 'bg-cordao-rosa',
    cinza: 'bg-cordao-cinza',
    preto: 'bg-cordao-preto',
  };
  return map[cor];
}

export function getCordaoTailwindText(cor: CordaoColor): string {
  if (cor === 'amarelo') return 'text-foreground';
  return 'text-primary-foreground';
}

export function getOrigemLabel(origem: OrigemVisitante): string {
  const labels: Record<OrigemVisitante, string> = {
    agendamento: 'Agendamento',
    lista_adicional: 'Lista Adicional',
    manual: 'Cadastro Manual',
    problema_sistema: 'Problema no Sistema',
  };
  return labels[origem];
}

export function filtrarPorPeriodo<T extends { dataHora?: string; criadoEm?: string; checkinData?: string }>(
  items: T[],
  periodo: PeriodoFiltro,
  dateField: keyof T = 'criadoEm' as keyof T
): T[] {
  if (periodo === 'todos') return items;
  
  const now = new Date();
  const hoje = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  return items.filter(item => {
    const raw = item[dateField] as string | undefined;
    if (!raw) return false;
    
    // Handle dd/mm/yyyy format
    let itemDate: Date;
    if (raw.includes('/')) {
      const [d, m, y] = raw.split('/').map(Number);
      itemDate = new Date(y, m - 1, d);
    } else {
      itemDate = new Date(raw);
    }
    
    if (isNaN(itemDate.getTime())) return false;
    
    switch (periodo) {
      case 'hoje':
        return itemDate >= hoje;
      case 'semana': {
        const inicioSemana = new Date(hoje);
        inicioSemana.setDate(hoje.getDate() - hoje.getDay());
        return itemDate >= inicioSemana;
      }
      case 'mes':
        return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
      case 'ano':
        return itemDate.getFullYear() === now.getFullYear();
      default:
        return true;
    }
  });
}
