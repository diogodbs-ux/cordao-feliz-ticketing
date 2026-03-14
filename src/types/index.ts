export type UserRole = 'admin' | 'coordenador' | 'recreador';

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

export interface Crianca {
  id: string;
  nome: string;
  idade: number;
  genero: string;
  pcd: boolean;
  pcdDescricao?: string;
  cordaoCor: CordaoColor;
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
}

export interface GrupoVisita {
  id: string;
  responsavel: Responsavel;
  checkinRealizado: boolean;
  checkinData?: string;
  checkinHora?: string;
  guiche?: number;
  atendidoPor?: string;
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
