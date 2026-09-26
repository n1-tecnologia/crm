/**
 * Os nomes pt-BR e os tons de cada estado dos Ativos de Canal (docs 23–25).
 * Um só lugar: a lista, o popup e o construtor dizem a mesma palavra para o
 * mesmo código.
 */

import type {
  CategoriaDeFlow,
  CausaDaSaida,
  CriterioDeCaptacao,
  EstadoDeSincronizacao,
  EstadoDoPedido,
  EstadoNoProvedor,
  OrigemDaParticipacao,
  OrigemDeCriacao,
  PapelDoCanal,
  PapelNaComunidade,
  PapelNaParticipacao,
  TipoDeAcao,
  TipoDeDadoDeTela,
  TipoDeEntradaDeTexto,
  VersionState,
} from "@n1/dominio/types";
import type { FaixaDeOcupacao, MarcadorDaComunidade, MarcadorDoGrupo } from "@n1/dominio/derive-ferramentas";
import type { TomPilula } from "@/features/shell/ui";

export const SINCRONIZACAO_LABEL: Record<EstadoDeSincronizacao, string> = {
  nuncaConferido: "nunca conferido",
  sincronizado: "sincronizado",
  inacessivel: "inacessível",
  semPrivilegio: "sem privilégio",
  orfao: "órfão",
};

export const SINCRONIZACAO_TOM: Record<EstadoDeSincronizacao, TomPilula> = {
  nuncaConferido: "neutro",
  sincronizado: "sucesso",
  inacessivel: "erro",
  semPrivilegio: "aviso",
  orfao: "erro",
};

export const PAPEL_DO_CANAL_LABEL: Record<PapelDoCanal, string> = {
  administrador: "administrador",
  participante: "participante",
  ausente: "ausente",
};

export const PAPEL_DO_CANAL_TOM: Record<PapelDoCanal, TomPilula> = {
  administrador: "acento",
  participante: "aviso",
  ausente: "erro",
};

export const ORIGEM_DE_CRIACAO_LABEL: Record<OrigemDeCriacao, string> = {
  importado: "importado",
  criadoPelaPlataforma: "criado pela plataforma",
};

export const FAIXA_DE_OCUPACAO_LABEL: Record<FaixaDeOcupacao, string> = {
  baixa: "baixa",
  moderada: "moderada",
  alta: "alta",
  cheio: "cheio",
};

export const FAIXA_DE_OCUPACAO_TOM: Record<FaixaDeOcupacao, TomPilula> = {
  baixa: "neutro",
  moderada: "info",
  alta: "aviso",
  cheio: "erro",
};

export const MARCADOR_DO_GRUPO_LABEL: Record<MarcadorDoGrupo, string> = {
  orfao: "sem Canal",
  canalAusente: "Canal ausente",
  semPrivilegio: "sem privilégio",
  linkInvalido: "link inválido",
  esgotado: "esgotado para captação",
  cheio: "cheio",
};

export const MARCADOR_DO_GRUPO_TOM: Record<MarcadorDoGrupo, "neutral" | "warning" | "danger"> = {
  orfao: "danger",
  canalAusente: "danger",
  semPrivilegio: "warning",
  linkInvalido: "warning",
  esgotado: "neutral",
  cheio: "neutral",
};

export const MARCADOR_DA_COMUNIDADE_LABEL: Record<MarcadorDaComunidade, string> = {
  orfao: "sem Canal",
  canalAusente: "Canal ausente",
  semPrivilegio: "sem privilégio",
  semGrupoDeAvisos: "sem Grupo de avisos",
  noLimite: "no limite de Grupos",
};

export const MARCADOR_DA_COMUNIDADE_TOM: Record<MarcadorDaComunidade, "neutral" | "warning" | "danger"> = {
  orfao: "danger",
  canalAusente: "danger",
  semPrivilegio: "warning",
  semGrupoDeAvisos: "danger",
  noLimite: "neutral",
};

export const PAPEL_NA_PARTICIPACAO_LABEL: Record<PapelNaParticipacao, string> = {
  membro: "membro",
  administrador: "administrador",
};

export const ORIGEM_DA_PARTICIPACAO_LABEL: Record<OrigemDaParticipacao, string> = {
  linkDeCaptacao: "Link de Captação",
  linkDeConvite: "Link de convite",
  adicionado: "adicionado",
  importado: "importado",
  desconhecida: "desconhecida",
};

export const CAUSA_DA_SAIDA_LABEL: Record<CausaDaSaida, string> = {
  saiu: "saiu",
  removido: "removido",
  banidoPeloProvedor: "banido pelo provedor",
  desconhecida: "desconhecida",
};

export const ESTADO_DO_PEDIDO_LABEL: Record<EstadoDoPedido, string> = {
  pendente: "pendente",
  aprovado: "aprovado",
  recusado: "recusado",
  expirado: "expirado",
};

export const ESTADO_DO_PEDIDO_TOM: Record<EstadoDoPedido, TomPilula> = {
  pendente: "aviso",
  aprovado: "sucesso",
  recusado: "erro",
  expirado: "neutro",
};

export const PAPEL_NA_COMUNIDADE_LABEL: Record<PapelNaComunidade, string> = {
  comum: "comum",
  avisos: "avisos",
};

export const CRITERIO_LABEL: Record<CriterioDeCaptacao, string> = {
  porOrdem: "por ordem",
  porCliques: "por cliques",
};

export const CONFIGURACAO_DO_GRUPO_LABEL = {
  somenteAdministradoresEnviam: { titulo: "Somente administradores enviam", curto: "Só administradores enviam", dica: "Os membros leem; só quem administra publica." },
  somenteAdministradoresEditamDados: { titulo: "Somente administradores editam dados", curto: "Só administradores editam", dica: "Nome, descrição e foto do grupo ficam com os administradores." },
  administradoresAprovamEntrada: { titulo: "Administradores aprovam entrada", curto: "Aprovação de entrada", dica: "Quem entra pelo link vira Pedido de Entrada até alguém aprovar." },
  somenteAdministradoresAdicionamParticipantes: { titulo: "Somente administradores adicionam participantes", curto: "Só administradores adicionam", dica: "Um membro não traz outro; só quem administra." },
} as const;

export const CONFIGURACAO_DA_COMUNIDADE_LABEL = {
  somenteAdministradoresAdicionamGrupos: { titulo: "Somente administradores adicionam Grupos", curto: "Só administradores vinculam Grupos", dica: "Um membro não vincula o próprio grupo à Comunidade." },
  somenteAdministradoresAdicionamParticipantes: { titulo: "Somente administradores adicionam participantes", curto: "Só administradores adicionam", dica: "Vale para o Grupo de avisos e para a Comunidade em si." },
} as const;

export const VERSAO_LABEL: Record<VersionState, string> = {
  rascunho: "rascunho",
  publicada: "publicada",
  obsoleta: "obsoleta",
};

export const VERSAO_TOM: Record<VersionState, TomPilula> = {
  rascunho: "aviso",
  publicada: "sucesso",
  obsoleta: "neutro",
};

export const CATEGORIA_DE_FLOW_LABEL: Record<CategoriaDeFlow, string> = {
  formularioDeCadastro: "formulário de cadastro",
  agendamento: "agendamento",
  pesquisa: "pesquisa",
  outro: "outro",
};

export const ESTADO_NO_PROVEDOR_LABEL: Record<EstadoNoProvedor, string> = {
  publicado: "publicado",
  bloqueadoPeloProvedor: "bloqueado pelo provedor",
  descontinuado: "descontinuado",
  removido: "removido",
};

export const ESTADO_NO_PROVEDOR_TOM: Record<EstadoNoProvedor, TomPilula> = {
  publicado: "sucesso",
  bloqueadoPeloProvedor: "erro",
  descontinuado: "aviso",
  removido: "neutro",
};

export const TIPO_DE_ACAO_LABEL: Record<TipoDeAcao, string> = {
  navegar: "navegar",
  concluir: "concluir",
  trocaDeDados: "troca de dados",
  abrirEndereco: "abrir endereço",
  atualizarDados: "atualizar dados",
};

export const TIPO_DE_DADO_LABEL: Record<TipoDeDadoDeTela, string> = {
  texto: "texto",
  numero: "número",
  booleano: "booleano",
  lista: "lista",
};

export const TIPO_DE_ENTRADA_LABEL: Record<TipoDeEntradaDeTexto, string> = {
  texto: "texto",
  numero: "número",
  email: "e-mail",
  senha: "senha",
  codigo: "código",
  telefone: "telefone",
};

/** "812 / 1 024" — a Ocupação como o cabeçalho a lê. */
export const ocupacaoTexto = (vigentes: number, teto: number, formatar: (n: number) => string): string => `${formatar(vigentes)} / ${formatar(teto)}`;
