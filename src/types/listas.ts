import { CordaoColor, getCordaoCor } from './index';

export type TipoListaEspecial = 'aniversariante' | 'instituicao';

export interface ConvidadoAniversario {
  id: string;
  nome: string;
  idade?: number;
  tipo: 'crianca' | 'acompanhante';
  pcd: boolean;
  pcdDescricao?: string;
  cordaoCor?: CordaoColor;
  presente?: boolean;
}

export interface ListaAniversariante {
  id: string;
  tipo: 'aniversariante';
  nomeAniversariante: string;
  dataNascimento: string;
  responsavelNome: string;
  responsavelCPF: string;
  responsavelCelular: string;
  responsavelEmail: string;
  dataVisita: string;
  convidados: ConvidadoAniversario[];
  totalPresentes?: number;
  checkinRealizado: boolean;
  checkinData?: string;
  checkinHora?: string;
  guiche?: number;
  atendidoPor?: string;
  observacao?: string;
  criadoEm: string;
}

export interface AdultoInstituicao {
  id: string;
  nome: string;
  cpf: string;
  presente?: boolean;
}

export interface CriancaInstituicao {
  id: string;
  nome: string;
  idade: number;
  genero: string;
  pcd: boolean;
  pcdDescricao?: string;
  cordaoCor: CordaoColor;
  presente?: boolean;
}

export interface ListaInstituicao {
  id: string;
  tipo: 'instituicao';
  nomeInstituicao: string;
  tipoInstituicao: string;
  cnpj: string;
  endereco: string;
  bairro: string;
  cidade: string;
  estado: string;
  dataVisita: string;
  responsavelNome: string;
  responsavelCPF: string;
  responsavelCelular: string;
  responsavelEmail: string;
  adultos: AdultoInstituicao[];
  criancas: CriancaInstituicao[];
  totalPresentes?: number;
  checkinRealizado: boolean;
  checkinData?: string;
  checkinHora?: string;
  guiche?: number;
  atendidoPor?: string;
  observacao?: string;
  criadoEm: string;
}

export type ListaEspecial = ListaAniversariante | ListaInstituicao;

export interface AlertConfig {
  capacidadeMaxima: number;
  alertaCapacidade75: boolean;
  alertaCapacidade90: boolean;
  alertaPCD: boolean;
  alertaGuicheInativo: boolean;
  alertaAltoVolume: boolean;
  alertaMilestones: boolean;
  alertaPendentes: boolean;
  milestones: number[];
  limiarAltoVolume: number; // multiplier (e.g. 1.5 = 50% above avg)
  guichesAtivos: number; // total active booths
}

export const DEFAULT_ALERT_CONFIG: AlertConfig = {
  capacidadeMaxima: 500,
  alertaCapacidade75: true,
  alertaCapacidade90: true,
  alertaPCD: true,
  alertaGuicheInativo: true,
  alertaAltoVolume: true,
  alertaMilestones: true,
  alertaPendentes: true,
  milestones: [50, 100, 200, 300, 400, 500],
  limiarAltoVolume: 1.5,
  guichesAtivos: 5,
};
