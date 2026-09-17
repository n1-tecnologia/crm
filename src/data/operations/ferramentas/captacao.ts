/**
 * Links de Captação (22, 7.1 — o mínimo que os documentos 24 e 25 exigem): um
 * endereço público que manda cada Clique ao Link de convite de um Grupo
 * elegível. A elegibilidade é do Grupo e é avaliada a cada Clique (RN-GRP-07);
 * o Link referencia Grupos, nunca endereços (RN-GRP-06), e nunca a Comunidade
 * nem o Grupo de avisos (RN-COM-07).
 *
 * O clique é público: não há Membro. A entrada no grupo que o clique gera é
 * um Evento do provedor, simulado por `simularEntradaPorClique`.
 */

import { fail, ok, type DataState, type OperationResult } from "../../state";
import type { ActorRef, CliqueDeLink, CriterioDeCaptacao, Grupo, Id, LinkDeCaptacao, ParticipacaoDeGrupo } from "../../types";
import { motivoDeInelegibilidade, proximoGrupoDoLink } from "../../derive-ferramentas";
import { memberActor, nextId, recordActivity, systemActor } from "../activity";
import { receberPedidoDeEntrada, registrarEntradaNoGrupo } from "./grupos";
import { recusaDeMembroAtivo } from "./permissoes";

const now = (): string => new Date().toISOString();

const registrarNoLink = (state: DataState, link: LinkDeCaptacao, input: { readonly actor: ActorRef; readonly action: string; readonly result?: "ok" | "denied" | "failed"; readonly detail?: string; readonly before?: string; readonly after?: string }) =>
  recordActivity(state, { ...input, objectType: "linkDeCaptacao", objectId: link.id, objectName: link.nome });

export const slugDe = (texto: string): string =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

/** Por que um Grupo não pode ser elegível deste Link — para a opção desligada dizer. */
export function recusaDeElegibilidade(state: DataState, grupo: Grupo, tipoDeCanal?: string): string | undefined {
  if (grupo.lifecycle === "naLixeira") return "O Grupo está na lixeira.";
  if (grupo.papelNaComunidade === "avisos") return "O Grupo de avisos nunca é elegível (RN-COM-07).";
  if (tipoDeCanal && grupo.tipoDeCanal !== tipoDeCanal) return "O Grupo é de outro Tipo de Canal.";
  return undefined;
}

export interface CriarLinkInput {
  readonly nome: string;
  readonly slug?: string;
  readonly gruposElegiveisIds: readonly Id[];
  readonly criterio?: CriterioDeCaptacao;
  readonly ativo?: boolean;
}

export function criarLinkDeCaptacao(state: DataState, actingMemberId: Id, input: CriarLinkInput): OperationResult<LinkDeCaptacao> {
  const membro = recusaDeMembroAtivo(state, actingMemberId);
  if (membro) return fail(membro);
  const nome = input.nome.trim();
  if (!nome) return fail("Dê um nome ao Link.", "nome");
  const slug = slugDe(input.slug?.trim() || nome);
  if (!slug) return fail("O endereço (slug) precisa de ao menos uma letra ou dígito.", "slug");
  if (state.linksDeCaptacao.some((l) => l.slug === slug && l.lifecycle !== "naLixeira")) return fail(`Já existe um Link em /l/${slug}.`, "slug");
  const ids = [...new Set(input.gruposElegiveisIds)];
  if (ids.length === 0) return fail("Escolha ao menos um Grupo elegível.", "grupos");
  const grupos = ids.map((id) => state.grupos.find((g) => g.id === id));
  let tipoDeCanal: Grupo["tipoDeCanal"] | undefined;
  for (const grupo of grupos) {
    if (!grupo) return fail("Um dos Grupos não existe.", "grupos");
    const recusa = recusaDeElegibilidade(state, grupo, tipoDeCanal);
    if (recusa) return fail(`${grupo.nome}: ${recusa}`, "grupos");
    tipoDeCanal ??= grupo.tipoDeCanal;
  }
  const link: LinkDeCaptacao = {
    id: nextId("lcp"),
    workspaceId: state.workspace.id,
    createdBy: memberActor(actingMemberId),
    createdAt: now(),
    lifecycle: "ativo",
    nome,
    slug,
    tipoDeCanal: tipoDeCanal ?? "whatsapp",
    gruposElegiveisIds: ids,
    criterio: input.criterio ?? "porOrdem",
    ativo: input.ativo ?? true,
    cliques: [],
    tagIds: [],
    comments: [],
  };
  state.linksDeCaptacao.push(link);
  registrarNoLink(state, link, { actor: memberActor(actingMemberId), action: "Link de Captação criado", detail: `/l/${slug} · ${ids.length} Grupo${ids.length > 1 ? "s" : ""} · ${link.criterio === "porOrdem" ? "por ordem" : "por cliques"}` });
  return ok(link);
}

export interface EditarLinkInput {
  readonly nome?: string;
  readonly gruposElegiveisIds?: readonly Id[];
  readonly criterio?: CriterioDeCaptacao;
  readonly ativo?: boolean;
}

export function editarLinkDeCaptacao(state: DataState, actingMemberId: Id, linkId: Id, input: EditarLinkInput): OperationResult<LinkDeCaptacao> {
  const membro = recusaDeMembroAtivo(state, actingMemberId);
  if (membro) return fail(membro);
  const link = state.linksDeCaptacao.find((l) => l.id === linkId);
  if (!link) return fail("Link não encontrado.");
  if (link.lifecycle !== "ativo") return fail("Só um Link ativo é editado.");
  const mudancas: string[] = [];
  if (input.nome !== undefined && input.nome.trim() && input.nome.trim() !== link.nome) {
    mudancas.push(`nome: “${link.nome}” → “${input.nome.trim()}”`);
    link.nome = input.nome.trim();
  }
  if (input.gruposElegiveisIds) {
    const ids = [...new Set(input.gruposElegiveisIds)];
    if (ids.length === 0) return fail("Escolha ao menos um Grupo elegível.", "grupos");
    for (const id of ids) {
      const grupo = state.grupos.find((g) => g.id === id);
      if (!grupo) return fail("Um dos Grupos não existe.", "grupos");
      const recusa = recusaDeElegibilidade(state, grupo, link.tipoDeCanal);
      if (recusa) return fail(`${grupo.nome}: ${recusa}`, "grupos");
    }
    if (ids.join() !== link.gruposElegiveisIds.join()) {
      link.gruposElegiveisIds = ids;
      mudancas.push(`${ids.length} Grupo${ids.length > 1 ? "s" : ""} elegíve${ids.length > 1 ? "is" : "l"}`);
    }
  }
  if (input.criterio !== undefined && input.criterio !== link.criterio) {
    link.criterio = input.criterio;
    mudancas.push(`critério: ${input.criterio === "porOrdem" ? "por ordem" : "por cliques"}`);
  }
  if (input.ativo !== undefined && input.ativo !== link.ativo) {
    link.ativo = input.ativo;
    mudancas.push(input.ativo ? "ativado" : "inativado");
  }
  if (mudancas.length === 0) return ok(link);
  registrarNoLink(state, link, { actor: memberActor(actingMemberId), action: "Link de Captação alterado", detail: mudancas.join("; ") });
  return ok(link);
}

export function enviarLinkALixeira(state: DataState, actingMemberId: Id, linkId: Id): OperationResult<LinkDeCaptacao> {
  const membro = recusaDeMembroAtivo(state, actingMemberId);
  if (membro) return fail(membro);
  const link = state.linksDeCaptacao.find((l) => l.id === linkId);
  if (!link) return fail("Link não encontrado.");
  if (link.lifecycle === "naLixeira") return ok(link);
  link.lifecycleBeforeTrash = link.lifecycle;
  link.lifecycle = "naLixeira";
  link.trashedAt = now();
  registrarNoLink(state, link, { actor: memberActor(actingMemberId), action: "Link de Captação enviado à lixeira", detail: "O endereço deixa de encaminhar; os Cliques ficam na história." });
  return ok(link);
}

export function restaurarLinkDaLixeira(state: DataState, actingMemberId: Id, linkId: Id): OperationResult<LinkDeCaptacao> {
  const membro = recusaDeMembroAtivo(state, actingMemberId);
  if (membro) return fail(membro);
  const link = state.linksDeCaptacao.find((l) => l.id === linkId);
  if (!link) return fail("Link não encontrado.");
  if (link.lifecycle !== "naLixeira") return fail("O Link não está na lixeira.");
  if (state.linksDeCaptacao.some((l) => l.id !== link.id && l.slug === link.slug && l.lifecycle !== "naLixeira")) return fail(`Outro Link já ocupa /l/${link.slug}.`);
  link.lifecycle = link.lifecycleBeforeTrash ?? "ativo";
  delete link.lifecycleBeforeTrash;
  delete link.trashedAt;
  registrarNoLink(state, link, { actor: memberActor(actingMemberId), action: "Link de Captação restaurado" });
  return ok(link);
}

/**
 * Um Clique no endereço público. Sem Membro. Escolhe o Grupo elegível pelo
 * Critério e grava o Clique; sem elegível, grava `semDestino` — o Clique
 * aconteceu e não se perde, e o Link diz que está "cego".
 */
export function registrarClique(state: DataState, slugOuId: string): OperationResult<{ readonly link: LinkDeCaptacao; readonly clique: CliqueDeLink; readonly grupo?: Grupo }> {
  const link = state.linksDeCaptacao.find((l) => (l.slug === slugOuId || l.id === slugOuId) && l.lifecycle === "ativo");
  if (!link) return fail("Este endereço não encaminha para lugar nenhum.");
  if (!link.ativo) return fail(`O Link ${link.nome} está inativo.`);
  const grupo = proximoGrupoDoLink(state, link);
  const clique: CliqueDeLink = { id: nextId("clk"), em: now(), ...(grupo ? { grupoId: grupo.id } : { semDestino: true }) };
  link.cliques.push(clique);
  if (!grupo) {
    const motivos = link.gruposElegiveisIds
      .map((id) => state.grupos.find((g) => g.id === id))
      .filter((g): g is Grupo => g !== undefined)
      .map((g) => `${g.nome}: ${motivoDeInelegibilidade(state, g) ?? "?"}`);
    registrarNoLink(state, link, { actor: systemActor, action: "Clique sem destino", result: "failed", detail: motivos.join(" · ") });
    return ok({ link, clique });
  }
  return ok({ link, clique, grupo });
}

/**
 * O provedor avisou que quem clicou entrou no grupo (em geral ele não
 * correlaciona; aqui a simulação correlaciona pelo Clique). Com
 * `administradoresAprovamEntrada`, vira Pedido de Entrada em vez de Participação.
 */
export function simularEntradaPorClique(state: DataState, cliqueId: Id, numero: string): OperationResult<{ readonly participacao?: ParticipacaoDeGrupo; readonly pedidoId?: Id; readonly grupo: Grupo }> {
  const link = state.linksDeCaptacao.find((l) => l.cliques.some((c) => c.id === cliqueId));
  const clique = link?.cliques.find((c) => c.id === cliqueId);
  if (!link || !clique) return fail("Clique não encontrado.");
  if (!clique.grupoId) return fail("Este Clique não foi encaminhado a Grupo nenhum.");
  const grupo = state.grupos.find((g) => g.id === clique.grupoId);
  if (!grupo) return fail("O Grupo do Clique não existe mais.");
  if (grupo.configuracoes.administradoresAprovamEntrada) {
    const pedido = receberPedidoDeEntrada(state, grupo.id, numero, { linkDeCaptacaoId: link.id });
    if (!pedido.ok) return pedido;
    return ok({ pedidoId: pedido.value.id, grupo });
  }
  const r = registrarEntradaNoGrupo(state, grupo.id, { numero, origem: "linkDeCaptacao", linkDeCaptacaoId: link.id, cliqueId: clique.id });
  if (!r.ok) return r;
  return ok({ participacao: r.value, grupo });
}
