/**
 * Ativos de Canal: Grupos, Comunidades, Links de Captação e Flows.
 * Ontologia: documentos 23 (Flow), 24 (Grupo), 25 (Comunidade) — rascunhos
 * "Ativos de Canal". O documento 22 (a base comum: Sincronização, Ferramentas
 * do Canal, Link de Captação) NÃO existe no repositório; o que ele fixaria
 * está aqui como decisão provisória de produto, marcado "(22)".
 *
 * Os identificadores são pt-BR, como em `iniciarConversa` e `financeiro.ts`:
 * o vocabulário é o da ontologia, e a tela o repete palavra por palavra.
 */

import type { ChannelType } from "./crm";
import type { ActorRef, Comment, FieldValue, Id, Instant, Provenance, RecordBase } from "./primitives";
import type { VersionState } from "./ai";

// ── Base comum (22, 6) ─────────────────────────────────────────────────────

/**
 * (22, 11) — o que a plataforma sabe do objeto no provedor. `nuncaConferido`
 * exige `sincronizar` antes de qualquer Ferramenta externa (RN-ATV-08).
 */
export type EstadoDeSincronizacao =
  | "nuncaConferido"
  | "sincronizado"
  | "inacessivel"
  | "semPrivilegio"
  | "orfao";

/** (22, 7.3) — o que o Canal é dentro do objeto no provedor. */
export type PapelDoCanal = "administrador" | "participante" | "ausente";

export interface Sincronizacao {
  estado: EstadoDeSincronizacao;
  conferidoEm?: Instant;
  papelDoCanal: PapelDoCanal;
  /** Frase do provedor ou da plataforma explicando o estado. */
  detalhe?: string;
}

export type OrigemDeCriacao = "importado" | "criadoPelaPlataforma";

/** (22, 6) — os atributos comuns a todo Ativo de Canal. */
export interface AtivoDeCanal extends RecordBase {
  nome: string;
  readonly tipoDeCanal: ChannelType;
  /** Como o provedor identifica o objeto; obrigatório e único depois de existir lá (INV-ATV-01). */
  identificadorExterno?: string;
  /** O Canal administrador (0..1). Ausente ⇒ `orfao`. */
  canalId?: Id;
  sincronizacao: Sincronizacao;
  readonly origemDeCriacao: OrigemDeCriacao;
  tagIds: Id[];
  fieldValues: FieldValue[];
  comments: Comment[];
  provenance?: Provenance;
}

// ── Grupo (24) ─────────────────────────────────────────────────────────────

/** 24, 6 — catálogo fixo pela Capacidade do Tipo de Canal; espelhado. */
export interface ConfiguracoesDoGrupo {
  somenteAdministradoresEnviam: boolean;
  somenteAdministradoresEditamDados: boolean;
  administradoresAprovamEntrada: boolean;
  somenteAdministradoresAdicionamParticipantes: boolean;
}

/** 24, 7.3 — objeto de valor; ausente quando o Canal não é administrador. */
export interface LinkDeConvite {
  endereco: string;
  estado: "valido" | "invalido" | "desconhecido";
  validadoEm?: Instant;
}

export type PapelNaParticipacao = "membro" | "administrador";

export type OrigemDaParticipacao =
  | "linkDeCaptacao"
  | "linkDeConvite"
  | "adicionado"
  | "importado"
  | "desconhecida";

export type CausaDaSaida = "saiu" | "removido" | "banidoPeloProvedor" | "desconhecida";

/**
 * 24, 7.1 — nunca eliminada individualmente: encerra-se (INV-GRP-07). É a
 * fonte de "membros atuais", "entradas e saídas" e dos Gatilhos de Grupo.
 */
export interface ParticipacaoDeGrupo {
  readonly id: Id;
  readonly grupoId: Id;
  /** Ausente só quando "É o Canal" (RN-GRP-11) ou anonimizada. */
  readonly contactId?: Id;
  /** RN-GRP-11 — o participante é um Canal do Espaço de Trabalho; não há Contato. */
  readonly canalParticipanteId?: Id;
  readonly identificadorExternoDoParticipante: string;
  readonly entradaEm: Instant;
  /** Verdadeiro quando o momento é o da Sincronização que a viu, não o do provedor. */
  readonly entradaEstimada: boolean;
  /** Vazio = vigente. */
  saidaEm?: Instant;
  saidaEstimada?: boolean;
  papel: PapelNaParticipacao;
  readonly origem: OrigemDaParticipacao;
  readonly linkDeCaptacaoId?: Id;
  readonly cliqueId?: Id;
  /** 20.3 — Origem atribuída a um Link por janela temporal, não por evento. */
  readonly origemInferida?: boolean;
  readonly adicionadoPor?: ActorRef;
  causaDaSaida?: CausaDaSaida;
  removidoPor?: ActorRef;
  /** INV-GRP-04 — o Contato foi eliminado; a Participação fica sem pessoa. */
  anonimizada?: boolean;
}

export type EstadoDoPedido = "pendente" | "aprovado" | "recusado" | "expirado";

/** 24, 7.2 — só em Grupos com `administradoresAprovamEntrada`. */
export interface PedidoDeEntrada {
  readonly id: Id;
  readonly grupoId: Id;
  readonly contactId: Id;
  readonly identificadorExternoDoSolicitante: string;
  readonly solicitadoEm: Instant;
  estado: EstadoDoPedido;
  decididoPor?: ActorRef;
  decididoEm?: Instant;
  /** Catálogo `motivoPerda` do Espaço de Trabalho (0..1) — não há catálogo próprio ainda. */
  motivoDaRecusaId?: Id;
  readonly origemInformada?: "linkDeConvite" | "linkDeCaptacao";
  readonly linkDeCaptacaoId?: Id;
}

/** 24, 7.4 — objeto de valor DA PLATAFORMA; nunca espelhado (RN-GRP-02). */
export interface Captacao {
  estado: "ativa" | "inativa";
  /** Vazio = sem limite; usado pelos Links com Critério `porCliques`. */
  limiteDeCliques?: number;
  /** RN-GRP-09 — teto próprio menor que a Capacidade, sem alterar o provedor. */
  tetoDeCaptacao?: number;
  /** RN-GRP-08 — só os Cliques depois deste momento contam. */
  cliquesZeradosEm?: Instant;
}

export type PapelNaComunidade = "comum" | "avisos";

export interface Grupo extends AtivoDeCanal {
  descricao: string;
  fotoFileId?: Id;
  configuracoes: ConfiguracoesDoGrupo;
  linkDeConvite?: LinkDeConvite;
  /** Limite de participantes do provedor (1 024) ou menor, se ele informar. */
  capacidade: number;
  /** INV-GRP-03 — o provedor mostrou mais vigentes do que a Capacidade. */
  divergenciaDeCapacidade?: string;
  participacoes: ParticipacaoDeGrupo[];
  pedidosDeEntrada: PedidoDeEntrada[];
  comunidadeId?: Id;
  papelNaComunidade?: PapelNaComunidade;
  vinculadoAComunidadeEm?: Instant;
  captacao: Captacao;
  /**
   * O Contato escolhido como CRIADOR do grupo quando a plataforma o cria
   * (2026-09-28, extensão de produto — C40). Entra como administrador. Não é
   * o Criador da ontologia (o Ator que criou o registro, aqui o Membro), e no
   * provedor quem executa a criação continua sendo o Canal administrador.
   */
  contatoCriadorId?: Id;
  /**
   * A CAPA do grupo (2026-09-29, extensão de produto — C41): uma imagem larga
   * (3:1) que só a plataforma mostra, na ficha e na prévia. O WhatsApp não
   * tem capa de grupo: ela nunca vai ao provedor e não é espelhada (a Foto,
   * `fotoFileId`, é).
   */
  capaFileId?: Id;
}

// ── Comunidade (25) ────────────────────────────────────────────────────────

export interface ConfiguracoesDaComunidade {
  somenteAdministradoresAdicionamGrupos: boolean;
  somenteAdministradoresAdicionamParticipantes: boolean;
}

/** 25 — os Grupos são derivados (`grupo.comunidadeId`); o de avisos tem Papel `avisos`. */
export interface Comunidade extends AtivoDeCanal {
  descricao: string;
  fotoFileId?: Id;
  configuracoes: ConfiguracoesDaComunidade;
  /** À época: 100, incluindo o Grupo de avisos. */
  limiteDeGruposDoProvedor: number;
}

// ── Link de Captação (22, 7.1 — mínimo) ────────────────────────────────────

export type CriterioDeCaptacao = "porOrdem" | "porCliques";

/** Um Clique no Link: para qual Grupo foi, ou `semDestino` quando nenhum era elegível. */
export interface CliqueDeLink {
  readonly id: Id;
  readonly em: Instant;
  readonly grupoId?: Id;
  readonly semDestino?: boolean;
}

/**
 * (22, 7.1) — endereço público da plataforma que redireciona cada Clique ao
 * Link de convite de um Grupo elegível (RN-GRP-07). Referencia o Grupo, nunca
 * o endereço do convite (RN-GRP-06). Nunca a Comunidade nem o avisos (RN-COM-07).
 */
export interface LinkDeCaptacao extends RecordBase {
  nome: string;
  readonly slug: string;
  readonly tipoDeCanal: ChannelType;
  /** Ordenados: com `porOrdem`, o primeiro elegível recebe o Clique. */
  gruposElegiveisIds: Id[];
  criterio: CriterioDeCaptacao;
  ativo: boolean;
  cliques: CliqueDeLink[];
  tagIds: Id[];
  comments: Comment[];
}

// ── Flow (23) ──────────────────────────────────────────────────────────────

export type CategoriaDeFlow = "formularioDeCadastro" | "agendamento" | "pesquisa" | "outro";

/** 23, 11 — espelhado, só depois de publicado. */
export type EstadoNoProvedor = "publicado" | "bloqueadoPeloProvedor" | "descontinuado" | "removido";

/** 23, 6.1 — a chave privada nunca é gravada nem exibida (INV-FLW-09). */
export interface PontoDeTrocaDeDados {
  endereco: string;
  chavePublica: string;
  chavesGeradasEm: Instant;
}

/** 23, 7.4 — o catálogo do esquema 7.3. Mudar de tipo é remover e criar. */
export type TipoDeComponente =
  | "titulo"
  | "subtitulo"
  | "paragrafo"
  | "legenda"
  | "textoRico"
  | "imagem"
  | "carrosselDeImagens"
  | "campoDeTexto"
  | "areaDeTexto"
  | "escolhaUnica"
  | "multiplaEscolha"
  | "menuSuspenso"
  | "chips"
  | "consentimento"
  | "seletorDeData"
  | "calendario"
  | "coletaDeFotos"
  | "listaDeNavegacao"
  | "formulario"
  | "condicional"
  | "linkIncorporado"
  | "rodape";

export type TipoDeAcao = "navegar" | "concluir" | "trocaDeDados" | "abrirEndereco" | "atualizarDados";

/** 23, 6.4 — a Ação de um Rodapé, Link incorporado, Consentimento, Lista de navegação ou Opção. */
export interface AcaoDeComponente {
  tipo: TipoDeAcao;
  /** Identificador de Tela (`navegar`, `trocaDeDados`). */
  telaDeDestino?: string;
  /** Mapa nome → valor ou Expressão (`{formulario.x}`, `{dados.x}`). */
  cargaUtil?: Record<string, string>;
  /** `abrirEndereco`. */
  endereco?: string;
}

export interface OpcaoDeComponente {
  readonly id: string;
  titulo: string;
  descricao?: string;
  imagemFileId?: Id;
  habilitada?: boolean;
  acao?: AcaoDeComponente;
}

export type OperadorDeCondicao = "igual" | "diferente" | "contem" | "naoContem" | "maior" | "menor" | "preenchido";

/** 23, 6.4 — só em `condicional`: variável, operador, valor; ou Expressão manual. */
export interface CondicaoDeComponente {
  variavel?: string;
  operador?: OperadorDeCondicao;
  valor?: string;
  expressao?: string;
}

export type TipoDeEntradaDeTexto = "texto" | "numero" | "email" | "senha" | "codigo" | "telefone";

/**
 * 23, 6.4 — tipadas pelo Tipo; o catálogo (`flows-catalogo.ts`) diz quais
 * valem para cada um. `habilitado`/`visivel` aceitam booleano ou Expressão.
 */
export interface PropriedadesDeComponente {
  texto?: string;
  rotulo?: string;
  obrigatorio?: boolean;
  opcoes?: OpcaoDeComponente[];
  minimo?: number;
  maximo?: number;
  /** Validação por padrão (expressão regular do provedor) em `campoDeTexto`. */
  padrao?: string;
  textoDeAjuda?: string;
  valorInicial?: string;
  mensagemDeErro?: string;
  habilitado?: boolean | string;
  visivel?: boolean | string;
  tipoDeEntrada?: TipoDeEntradaDeTexto;
  peso?: "normal" | "negrito" | "italico";
  tachado?: boolean;
  markdown?: boolean;
  imagemFileId?: Id;
  imagensFileIds?: Id[];
  textoAlternativo?: string;
  proporcao?: string;
  modo?: "unico" | "intervalo";
  origemDaFoto?: "cameraEGaleria" | "galeria" | "camera";
  legendasDoRodape?: { esquerda?: string; centro?: string; direita?: string };
}

export interface ComponenteDeFlow {
  readonly id: Id;
  readonly tipo: TipoDeComponente;
  /** Obrigatório nos de entrada; único na Versão (INV-FLW-04); chave da Resposta. */
  nome?: string;
  propriedades: PropriedadesDeComponente;
  acao?: AcaoDeComponente;
  /** Só em `formulario` e `condicional`. */
  filhos?: ComponenteDeFlow[];
  condicao?: CondicaoDeComponente;
}

export type TipoDeDadoDeTela = "texto" | "numero" | "booleano" | "lista";

/** 23, 6.3 — o que a Tela recebe da anterior ou do Ponto de troca de dados. */
export interface DadoDeTela {
  nome: string;
  tipo: TipoDeDadoDeTela;
  exemplo?: string;
}

export interface TelaDeFlow {
  readonly id: Id;
  /** `[a-z_]+`, único na Versão; alvo das Ações `navegar`. */
  identificador: string;
  titulo: string;
  ordem: number;
  terminal: boolean;
  dados: DadoDeTela[];
  componentes: ComponenteDeFlow[];
}

/** 23, 6.2 — `publicada` e `obsoleta` são imutáveis, inclusive Telas e Componentes (RN-FLW-04). */
export interface VersaoDeFlow {
  readonly id: Id;
  readonly flowId: Id;
  readonly numero: number;
  estado: VersionState;
  readonly versaoDeEsquema: string;
  telas: TelaDeFlow[];
  notas?: string;
  publicadaPor?: ActorRef;
  publicadaEm?: Instant;
  canalPublicadorId?: Id;
  /** RN-FLW-11 — a Definição publicável no momento da publicação, para auditoria. */
  instantaneoPublicado?: string;
  obsoletaEm?: Instant;
  /** Versão a partir da qual foi criada (identificador e Número à época). */
  proveniencia?: { readonly versaoId: Id; readonly numero: number };
  readonly createdAt: Instant;
}

export interface Flow extends AtivoDeCanal {
  descricao: string;
  categoria: CategoriaDeFlow;
  versoes: VersaoDeFlow[];
  pontoDeTrocaDeDados?: PontoDeTrocaDeDados;
  estadoNoProvedor?: EstadoNoProvedor;
}

/** 23, 7.6 — o que uma Mensagem `enviada` carrega quando leva um Flow. */
export interface EnvioDeFlow {
  readonly flowId: Id;
  readonly versaoId: Id;
  readonly numeroDaVersao: number;
  readonly flowNome: string;
  readonly cabecalho?: string;
  readonly rodape?: string;
  readonly rotuloDoBotao: string;
  readonly telaInicial: string;
  readonly dadosIniciais?: Record<string, string>;
}

/** 23, 7.6 — o conteúdo estruturado de uma Mensagem `recebida` em resposta a um Flow. */
export interface RespostaDeFlow {
  readonly flowId: Id;
  readonly versaoId: Id;
  readonly numeroDaVersao: number;
  readonly flowNome: string;
  readonly identificadorDeRespostaDoProvedor: string;
  readonly em: Instant;
  readonly valores: Record<string, string | number | boolean | readonly string[]>;
  readonly telaDeConclusao: string;
  readonly mensagemDeOrigemId?: Id;
  /** 20.5 — trouxe Nome que não existe na Versão; persistida íntegra, nunca descartada. */
  readonly naoConforme?: boolean;
}

/** (22, 7.5) — classe de efeito de uma Ferramenta do Canal. */
export type ClasseDeEfeito = "interna" | "externa" | "externaIrreversivel";
