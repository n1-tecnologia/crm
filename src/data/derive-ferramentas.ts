/**
 * Leituras derivadas dos Ativos de Canal (docs 23–25). Nada aqui é gravado:
 * Ocupação, Membros, Cliques contabilizados, elegibilidade de Link, Versão
 * corrente e métricas de Flow são recomputados do estado a cada leitura, como
 * a ontologia exige (24, 6; 25, 6; 23, 6.1).
 */

import type { DataState } from "./state";
import type {
  ComponenteDeFlow,
  Comunidade,
  Contact,
  Conversation,
  Flow,
  Grupo,
  Id,
  LinkDeCaptacao,
  Message,
  ParticipacaoDeGrupo,
  PedidoDeEntrada,
  TelaDeFlow,
  TipoDeComponente,
  VersaoDeFlow,
} from "./types";
import { CATALOGO_DE_COMPONENTES } from "./operations/ferramentas/flows-catalogo";

// ── Grupo ──────────────────────────────────────────────────────────────────

/** Participações sem saída (24, 11). */
export const participacoesVigentes = (grupo: Grupo): ParticipacaoDeGrupo[] =>
  grupo.participacoes.filter((p) => p.saidaEm === undefined);

/** RN-GRP-12 — "Membros do Grupo" vem das Participações vigentes, nunca da Conversa; o Canal não conta. */
export const membrosDoGrupo = (grupo: Grupo): ParticipacaoDeGrupo[] =>
  participacoesVigentes(grupo).filter((p) => p.canalParticipanteId === undefined);

/** RN-GRP-09 — o teto próprio de captação, quando menor que a Capacidade. */
export const tetoEfetivo = (grupo: Grupo): number =>
  grupo.captacao.tetoDeCaptacao !== undefined && grupo.captacao.tetoDeCaptacao < grupo.capacidade
    ? grupo.captacao.tetoDeCaptacao
    : grupo.capacidade;

export type FaixaDeOcupacao = "baixa" | "moderada" | "alta" | "cheio";

export interface Ocupacao {
  readonly vigentes: number;
  readonly capacidade: number;
  readonly teto: number;
  /** vigentes / teto, entre 0 e 1 (pode passar de 1 com divergência do provedor). */
  readonly fracao: number;
  /** As faixas são configuração de exibição, não estado (24, 6). */
  readonly faixa: FaixaDeOcupacao;
}

export function ocupacao(grupo: Grupo): Ocupacao {
  const vigentes = participacoesVigentes(grupo).length;
  const teto = tetoEfetivo(grupo);
  const fracao = teto > 0 ? vigentes / teto : 1;
  const faixa: FaixaDeOcupacao = vigentes >= teto ? "cheio" : fracao >= 0.8 ? "alta" : fracao >= 0.4 ? "moderada" : "baixa";
  return { vigentes, capacidade: grupo.capacidade, teto, fracao, faixa };
}

export const grupoCheio = (grupo: Grupo): boolean => ocupacao(grupo).faixa === "cheio";

/** Cliques que apontaram para este Grupo depois do último `zerar cliques` (RN-GRP-08). */
export function cliquesContabilizados(state: DataState, grupo: Grupo): number {
  const desde = grupo.captacao.cliquesZeradosEm ?? "";
  let total = 0;
  for (const link of state.linksDeCaptacao) {
    for (const clique of link.cliques) if (clique.grupoId === grupo.id && clique.em >= desde) total += 1;
  }
  return total;
}

/** 24, 11 — cliques ≥ Limite de cliques, ou cheio. */
export function esgotadoParaCaptacao(state: DataState, grupo: Grupo): boolean {
  if (grupoCheio(grupo)) return true;
  const limite = grupo.captacao.limiteDeCliques;
  return limite !== undefined && limite > 0 && cliquesContabilizados(state, grupo) >= limite;
}

export type MarcadorDoGrupo = "canalAusente" | "semPrivilegio" | "linkInvalido" | "esgotado" | "cheio" | "orfao";

/** 24, 11 — estados derivados de exibição; base dos Filtros e alertas. */
export function marcadoresDoGrupo(state: DataState, grupo: Grupo): MarcadorDoGrupo[] {
  const marcas: MarcadorDoGrupo[] = [];
  if (grupo.canalId === undefined || grupo.sincronizacao.estado === "orfao") marcas.push("orfao");
  if (grupo.sincronizacao.papelDoCanal === "ausente") marcas.push("canalAusente");
  if (grupo.sincronizacao.papelDoCanal === "participante") marcas.push("semPrivilegio");
  if (grupo.linkDeConvite?.estado === "invalido") marcas.push("linkInvalido");
  if (grupoCheio(grupo)) marcas.push("cheio");
  else if (esgotadoParaCaptacao(state, grupo)) marcas.push("esgotado");
  return marcas;
}

/**
 * RN-GRP-07 — por que este Grupo NÃO recebe cliques de Link nenhum; vazio =
 * elegível. Avaliado a cada Clique, nunca gravado.
 */
export function motivoDeInelegibilidade(state: DataState, grupo: Grupo): string | undefined {
  if (grupo.lifecycle !== "ativo") return "O Grupo não está ativo.";
  if (grupo.papelNaComunidade === "avisos") return "O Grupo de avisos de uma Comunidade não admite entrada direta (INV-GRP-06).";
  if (grupo.captacao.estado === "inativa") return "A Captação deste Grupo está inativa.";
  if (grupo.canalId === undefined || grupo.sincronizacao.estado === "orfao") return "O Grupo está sem Canal administrador.";
  if (grupo.sincronizacao.estado === "inacessivel" || grupo.sincronizacao.papelDoCanal === "ausente") return "O Grupo está inacessível: o Canal não está nele.";
  if (grupo.sincronizacao.papelDoCanal !== "administrador") return "O Canal não administra este Grupo: o provedor não entrega o Link de convite.";
  if (!grupo.linkDeConvite) return "O Grupo não tem Link de convite.";
  if (grupo.linkDeConvite.estado === "invalido") return "O Link de convite do Grupo está inválido.";
  if (grupoCheio(grupo)) return "O Grupo está cheio.";
  if (esgotadoParaCaptacao(state, grupo)) return "O Grupo esgotou o Limite de cliques.";
  return undefined;
}

export const gruposElegiveisDoLink = (state: DataState, link: LinkDeCaptacao): Grupo[] =>
  link.gruposElegiveisIds
    .map((id) => state.grupos.find((g) => g.id === id))
    .filter((g): g is Grupo => g !== undefined && motivoDeInelegibilidade(state, g) === undefined);

/** Cliques do Link que foram a cada Grupo, contando só os depois do `zerar` do Grupo. */
export function cliquesPorGrupo(state: DataState, link: LinkDeCaptacao): Map<Id, number> {
  const contagem = new Map<Id, number>();
  for (const clique of link.cliques) {
    if (!clique.grupoId) continue;
    const grupo = state.grupos.find((g) => g.id === clique.grupoId);
    const desde = grupo?.captacao.cliquesZeradosEm ?? "";
    if (clique.em < desde) continue;
    contagem.set(clique.grupoId, (contagem.get(clique.grupoId) ?? 0) + 1);
  }
  return contagem;
}

/**
 * (22, 7.1) — para onde o próximo Clique vai: `porOrdem` é o primeiro
 * elegível; `porCliques` é o elegível com menos cliques deste Link.
 */
export function proximoGrupoDoLink(state: DataState, link: LinkDeCaptacao): Grupo | undefined {
  const elegiveis = gruposElegiveisDoLink(state, link);
  if (elegiveis.length === 0) return undefined;
  if (link.criterio === "porOrdem") return elegiveis[0];
  const contagem = cliquesPorGrupo(state, link);
  return [...elegiveis].sort((a, b) => (contagem.get(a.id) ?? 0) - (contagem.get(b.id) ?? 0))[0];
}

/** INV-GRP-05 — a única Conversa não eliminada com o Identificador de grupo no Canal administrador. */
export const conversaDoGrupo = (state: DataState, grupo: Grupo): Conversation | undefined =>
  grupo.identificadorExterno === undefined
    ? undefined
    : state.conversations.find(
        (c) =>
          c.lifecycle === "ativo" &&
          c.channelId === grupo.canalId &&
          c.groupIdentifier?.externalId === grupo.identificadorExterno,
      );

export const pedidosPendentes = (grupo: Grupo): PedidoDeEntrada[] =>
  grupo.pedidosDeEntrada.filter((p) => p.estado === "pendente");

/** 20.1 — um Contato em doze Grupos são doze Participações vigentes. */
export const gruposDoContato = (state: DataState, contactId: Id): Grupo[] =>
  state.grupos.filter((g) => g.lifecycle !== "naLixeira" && participacoesVigentes(g).some((p) => p.contactId === contactId));

export const linksDoGrupo = (state: DataState, grupoId: Id): LinkDeCaptacao[] =>
  state.linksDeCaptacao.filter((l) => l.lifecycle === "ativo" && l.gruposElegiveisIds.includes(grupoId));

// ── Comunidade ─────────────────────────────────────────────────────────────

export const gruposDaComunidade = (state: DataState, comunidadeId: Id): Grupo[] =>
  state.grupos.filter((g) => g.comunidadeId === comunidadeId && g.lifecycle !== "naLixeira");

export const grupoDeAvisos = (state: DataState, comunidadeId: Id): Grupo | undefined =>
  gruposDaComunidade(state, comunidadeId).find((g) => g.papelNaComunidade === "avisos");

export const gruposComuns = (state: DataState, comunidadeId: Id): Grupo[] =>
  gruposDaComunidade(state, comunidadeId).filter((g) => g.papelNaComunidade !== "avisos");

/** RN-COM-06 — união das Participações vigentes dos Grupos `comum`, um Contato uma vez. */
export function membrosDaComunidade(state: DataState, comunidadeId: Id): Id[] {
  const ids = new Set<Id>();
  for (const grupo of gruposComuns(state, comunidadeId)) {
    for (const p of membrosDoGrupo(grupo)) if (p.contactId) ids.add(p.contactId);
  }
  return [...ids];
}

export function ocupacaoAgregada(state: DataState, comunidadeId: Id): { readonly vigentes: number; readonly capacidade: number } {
  let vigentes = 0;
  let capacidade = 0;
  for (const grupo of gruposComuns(state, comunidadeId)) {
    vigentes += participacoesVigentes(grupo).length;
    capacidade += grupo.capacidade;
  }
  return { vigentes, capacidade };
}

/** 25, 11 — Grupos vinculados (com o de avisos) = Limite do provedor. */
export const noLimiteDeGrupos = (state: DataState, comunidade: Comunidade): boolean =>
  gruposDaComunidade(state, comunidade.id).length >= comunidade.limiteDeGruposDoProvedor;

export const comunidadeDoGrupo = (state: DataState, grupo: Grupo): Comunidade | undefined =>
  grupo.comunidadeId === undefined ? undefined : state.comunidades.find((c) => c.id === grupo.comunidadeId);

export type MarcadorDaComunidade = "semGrupoDeAvisos" | "noLimite" | "semPrivilegio" | "canalAusente" | "orfao";

export function marcadoresDaComunidade(state: DataState, comunidade: Comunidade): MarcadorDaComunidade[] {
  const marcas: MarcadorDaComunidade[] = [];
  if (comunidade.canalId === undefined || comunidade.sincronizacao.estado === "orfao") marcas.push("orfao");
  if (comunidade.sincronizacao.papelDoCanal === "ausente") marcas.push("canalAusente");
  if (comunidade.sincronizacao.papelDoCanal === "participante") marcas.push("semPrivilegio");
  if (comunidade.sincronizacao.estado === "sincronizado" && !grupoDeAvisos(state, comunidade.id)) marcas.push("semGrupoDeAvisos");
  if (noLimiteDeGrupos(state, comunidade)) marcas.push("noLimite");
  return marcas;
}

// ── Flow ───────────────────────────────────────────────────────────────────

/** 23, 6.1 — a única `rascunho` (0..1). */
export const versaoCorrente = (flow: Flow): VersaoDeFlow | undefined => flow.versoes.find((v) => v.estado === "rascunho");

/** 23, 6.1 — a única `publicada` (0..1). */
export const versaoPublicada = (flow: Flow): VersaoDeFlow | undefined => flow.versoes.find((v) => v.estado === "publicada");

export const telasOrdenadas = (versao: VersaoDeFlow): TelaDeFlow[] => [...versao.telas].sort((a, b) => a.ordem - b.ordem);

/** 23, 6.2 — a primeira da ordem. */
export const telaInicial = (versao: VersaoDeFlow): TelaDeFlow | undefined => telasOrdenadas(versao)[0];

/** A árvore achatada, em ordem de leitura; os filhos vêm logo depois do pai. */
export function componentesDaTela(tela: TelaDeFlow): Array<{ readonly componente: ComponenteDeFlow; readonly paiId?: Id; readonly nivel: number }> {
  const saida: Array<{ readonly componente: ComponenteDeFlow; readonly paiId?: Id; readonly nivel: number }> = [];
  const visitar = (lista: readonly ComponenteDeFlow[], paiId: Id | undefined, nivel: number) => {
    for (const componente of lista) {
      saida.push(paiId === undefined ? { componente, nivel } : { componente, paiId, nivel });
      if (componente.filhos) visitar(componente.filhos, componente.id, nivel + 1);
    }
  };
  visitar(tela.componentes, undefined, 0);
  return saida;
}

export const ehComponenteDeEntrada = (tipo: TipoDeComponente): boolean => CATALOGO_DE_COMPONENTES[tipo].entrada;

export interface CampoDeFlow {
  readonly nome: string;
  readonly tipoDeValor: "texto" | "numero" | "booleano" | "lista";
  readonly telaId: Id;
  readonly telaIdentificador: string;
  readonly componenteId: Id;
  readonly tipo: TipoDeComponente;
}

const TIPO_DE_VALOR: Partial<Record<TipoDeComponente, CampoDeFlow["tipoDeValor"]>> = {
  multiplaEscolha: "lista",
  chips: "lista",
  coletaDeFotos: "lista",
  consentimento: "booleano",
};

/** 23, 7.3 — {Nome, Tipo de valor, Tela, Componente} de todo Componente de entrada com Nome. */
export function camposDaTela(tela: TelaDeFlow): CampoDeFlow[] {
  return componentesDaTela(tela)
    .filter(({ componente }) => ehComponenteDeEntrada(componente.tipo) && componente.nome)
    .map(({ componente }) => ({
      nome: componente.nome ?? "",
      tipoDeValor: TIPO_DE_VALOR[componente.tipo] ?? (componente.tipo === "campoDeTexto" && componente.propriedades.tipoDeEntrada === "numero" ? "numero" : "texto"),
      telaId: tela.id,
      telaIdentificador: tela.identificador,
      componenteId: componente.id,
      tipo: componente.tipo,
    }));
}

export const camposDeFlow = (versao: VersaoDeFlow): CampoDeFlow[] => telasOrdenadas(versao).flatMap(camposDaTela);

/** Toda Mensagem `enviada` que leva este Flow (por Versão quando pedido). */
export function enviosDoFlow(state: DataState, flowId: Id, versaoId?: Id): Array<{ readonly conversa: Conversation; readonly mensagem: Message }> {
  const saida: Array<{ readonly conversa: Conversation; readonly mensagem: Message }> = [];
  for (const conversa of state.conversations) {
    for (const mensagem of conversa.messages) {
      if (mensagem.direction !== "enviada" || mensagem.flow?.flowId !== flowId) continue;
      if (versaoId !== undefined && mensagem.flow.versaoId !== versaoId) continue;
      saida.push({ conversa, mensagem });
    }
  }
  return saida.sort((a, b) => b.mensagem.createdAt.localeCompare(a.mensagem.createdAt));
}

export function respostasDoFlow(state: DataState, flowId: Id, versaoId?: Id): Array<{ readonly conversa: Conversation; readonly mensagem: Message }> {
  const saida: Array<{ readonly conversa: Conversation; readonly mensagem: Message }> = [];
  for (const conversa of state.conversations) {
    for (const mensagem of conversa.messages) {
      if (mensagem.direction !== "recebida" || mensagem.respostaDeFlow?.flowId !== flowId) continue;
      if (versaoId !== undefined && mensagem.respostaDeFlow.versaoId !== versaoId) continue;
      saida.push({ conversa, mensagem });
    }
  }
  return saida.sort((a, b) => b.mensagem.createdAt.localeCompare(a.mensagem.createdAt));
}

/** 23, 6.1 — envios, respostas e taxa de conclusão; nunca gravados. Abandono não existe (7.6). */
export function metricasDoFlow(state: DataState, flowId: Id, versaoId?: Id): { readonly envios: number; readonly respostas: number; readonly taxa: number | null } {
  const envios = enviosDoFlow(state, flowId, versaoId).length;
  const respostas = respostasDoFlow(state, flowId, versaoId).length;
  return { envios, respostas, taxa: envios === 0 ? null : Math.min(1, respostas / envios) };
}

export const respostasDeFlowDoContato = (state: DataState, contactId: Id): Message[] =>
  state.conversations
    .filter((c) => c.contactId === contactId)
    .flatMap((c) => c.messages.filter((m) => m.respostaDeFlow !== undefined))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

/** Contatos com Identificador que o WhatsApp resolve — os que podem entrar num Grupo ou receber um Flow. */
/** O endereço de uma imagem do Espaço (a foto e a capa de um Grupo), quando ela tem conteúdo local. */
export const urlDoArquivo = (state: DataState, fileId: string | undefined): string | undefined =>
  fileId ? state.files.find((f) => f.id === fileId)?.url : undefined;

export const contatosComWhatsApp = (state: DataState): Contact[] =>
  state.contacts.filter((c) => c.lifecycle === "ativo" && c.identifiers.some((i) => i.type === "identidadeDeWhatsApp"));

export const identidadeDeWhatsApp = (contact: Contact): string | undefined =>
  contact.identifiers.find((i) => i.type === "identidadeDeWhatsApp")?.value;
