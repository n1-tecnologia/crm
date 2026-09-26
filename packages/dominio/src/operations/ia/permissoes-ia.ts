/**
 * As recusas da área de IA (Habilidades, Conhecimento, Agentes, Automações,
 * Integrações), numa só voz: cada função devolve a frase que a operação usa
 * em `fail` E que a tela mostra em `disabledReason`, para o botão desligado
 * dizer exatamente o que a operação diria. `undefined` = permitido.
 *
 * Regra do protótipo, só sobre os Papéis de base (D7): Convidado nada; Membro
 * cria, e edita/administra em `próprios` (Proprietário ou Criador);
 * Administrador e Proprietário do Espaço de Trabalho tudo; Coleção privada só
 * o Proprietário (B38a por analogia — nem o Administrador entra).
 */

import type { DataState } from "../../state";
import type { Agent, Automation, Collection, Id, KnowledgeDocument, Skill, SystemRole } from "../../types";

/** A base do Papel do Membro; `undefined` quando o Membro ou o Papel não existe. */
export function baseDoPapel(state: DataState, memberId: Id): SystemRole | undefined {
  const member = state.members.find((m) => m.id === memberId);
  if (!member) return undefined;
  return state.roles.find((r) => r.id === member.roleId)?.base;
}

/** Proprietário do Espaço de Trabalho ou Administrador por Papel (17.1). */
export function administraOEspaco(state: DataState, memberId: Id): boolean {
  const base = baseDoPapel(state, memberId);
  return base === "proprietario" || base === "administrador";
}

/** Só um Membro ativo age; pendente, suspenso e removido não têm voz sobre a IA. */
export function recusaDeMembroAtivo(state: DataState, memberId: Id): string | undefined {
  const member = state.members.find((m) => m.id === memberId);
  if (!member || member.state !== "ativo") return "Só um Membro ativo age sobre a IA do Espaço de Trabalho.";
  return undefined;
}

/** Ontologia 17.2 — um Convidado não tem nada sobre a IA por Papel. `oQue` é a ação no presente: "cria Habilidade". */
export function recusaDeConvidado(state: DataState, memberId: Id, oQue: string): string | undefined {
  const ativo = recusaDeMembroAtivo(state, memberId);
  if (ativo) return ativo;
  if (baseDoPapel(state, memberId) === "convidado") return `O Papel Convidado não ${oQue}.`;
  return undefined;
}

/** `próprios`: o Membro é o Criador do registro. */
const criouORegistro = (registro: { readonly createdBy: { readonly kind: string; readonly id: Id } }, memberId: Id): boolean =>
  registro.createdBy.kind === "member" && registro.createdBy.id === memberId;

/**
 * Agente (17): `editar` e `administrar` cabem a quem administra o Espaço de
 * Trabalho e, por `próprios`, ao Proprietário ou Criador do Agente.
 */
export function recusaDeGovernarAgente(state: DataState, memberId: Id, agent: Agent, acao: "editar" | "administrar"): string | undefined {
  const convidado = recusaDeConvidado(state, memberId, "edita Agente");
  if (convidado) return convidado;
  if (administraOEspaco(state, memberId)) return undefined;
  if (agent.ownerMemberId === memberId || criouORegistro(agent, memberId)) return undefined;
  return acao === "editar"
    ? "Editar este Agente exige ser o seu Proprietário ou administrar o Espaço de Trabalho."
    : "Administrar este Agente exige ser o seu Proprietário ou administrar o Espaço de Trabalho.";
}

/**
 * Habilidade (18): tem Criador e Publicador, nunca Proprietário (B71). Editar
 * é do Criador ou de quem administra o Espaço; publicar e obsoletar exigem
 * `administrar` — o Criador ou um Administrador. A da plataforma ninguém
 * governa por aqui (INV-HAB-07).
 */
export function recusaDeGovernarHabilidade(state: DataState, memberId: Id, skill: Skill, acao: "editar" | "administrar"): string | undefined {
  const convidado = recusaDeConvidado(state, memberId, "edita Habilidade");
  if (convidado) return convidado;
  if (skill.ownership === "plataforma") return "Uma Habilidade da plataforma não é editada pelo Espaço de Trabalho: copie-a (INV-HAB-07).";
  if (administraOEspaco(state, memberId) || criouORegistro(skill, memberId)) return undefined;
  return acao === "editar"
    ? "Editar esta Habilidade exige ser o seu Criador ou administrar o Espaço de Trabalho."
    : "Publicar e obsoletar exigem administrar esta Habilidade: o Criador ou um Administrador.";
}

export type AcaoNaColecao = "criar" | "comentar" | "editar" | "excluir" | "administrar";

/**
 * Coleção (20): criar e comentar são de qualquer Membro; editar, excluir e
 * administrar são do Proprietário ou de quem administra o Espaço. Privada, só
 * o Proprietário entra — nem o Administrador (B38a por analogia).
 */
export function recusaNaColecao(state: DataState, memberId: Id, colecao: Collection, acao: AcaoNaColecao): string | undefined {
  const ativo = recusaDeMembroAtivo(state, memberId);
  if (ativo) return ativo;
  if (baseDoPapel(state, memberId) === "convidado") return "O Papel Convidado não age sobre Coleções.";
  const proprietario = colecao.ownerMemberId === memberId;
  if (colecao.isPrivate && !proprietario) return "Esta Coleção é privada: só o Proprietário age nela.";
  if (acao === "criar" || acao === "comentar") return undefined;
  if (proprietario || administraOEspaco(state, memberId)) return undefined;
  if (acao === "administrar") return "Administrar esta Coleção exige ser o seu Proprietário ou administrar o Espaço de Trabalho.";
  return acao === "editar"
    ? "Editar nesta Coleção exige ser o seu Proprietário ou administrar o Espaço de Trabalho."
    : "Excluir nesta Coleção exige ser o seu Proprietário ou administrar o Espaço de Trabalho.";
}

/**
 * Documento: as regras da Coleção, e editar/excluir cabem também ao Criador
 * do Documento (`próprios`). Sem a Coleção não há em que agir.
 */
export function recusaNoDocumento(state: DataState, memberId: Id, documento: KnowledgeDocument, acao: "comentar" | "editar" | "excluir"): string | undefined {
  const colecao = state.collections.find((c) => c.id === documento.collectionId);
  if (!colecao) return "A Coleção deste Documento não existe mais.";
  if (acao !== "comentar" && criouORegistro(documento, memberId)) {
    // O Criador entra pela Coleção como quem comenta (Membro; privada só o Proprietário).
    return recusaNaColecao(state, memberId, colecao, "comentar");
  }
  return recusaNaColecao(state, memberId, colecao, acao);
}

export type AcaoNaAutomacao = "publicar" | "editar" | "pausar" | "arquivar" | "restaurar";

const VERBO: Record<AcaoNaAutomacao, string> = {
  publicar: "publica uma Versão de Automação",
  editar: "edita uma Automação",
  pausar: "pausa ou retoma uma Automação",
  arquivar: "arquiva uma Automação",
  restaurar: "restaura uma Automação",
};

const EXIGE_ADMINISTRAR: Record<AcaoNaAutomacao, string> = {
  publicar: "Publicar uma Versão exige administrar esta Automação.",
  editar: "Editar o rascunho exige administrar esta Automação.",
  pausar: "Pausar ou retomar exige administrar esta Automação.",
  arquivar: "Arquivar exige administrar esta Automação.",
  restaurar: "Restaurar exige administrar esta Automação.",
};

/**
 * Automação (19): `administrar` cabe ao Proprietário do Espaço de Trabalho e
 * aos Administradores por Papel, e ao Proprietário ou Criador da Automação por
 * `próprios` (documento 12, 12.2 e a tabela de 17.1). Um Convidado não tem
 * nada sobre Automação por Papel.
 */
export function recusaDeAdministrarAutomacao(state: DataState, memberId: Id, automation: Automation, acao: AcaoNaAutomacao): string | undefined {
  const member = state.members.find((m) => m.id === memberId);
  if (!member || member.state !== "ativo") return `Só um Membro ativo ${VERBO[acao]}.`;
  const base = baseDoPapel(state, memberId);
  const pode =
    base === "proprietario" ||
    base === "administrador" ||
    (base !== "convidado" && (automation.ownerMemberId === memberId || criouORegistro(automation, memberId)));
  return pode ? undefined : EXIGE_ADMINISTRAR[acao];
}

/** B35 — a Integração não tem Proprietário: conectar e desconectar é ato de Administrador. */
export function recusaDeAdministrarIntegracao(state: DataState, memberId: Id): string | undefined {
  const ativo = recusaDeMembroAtivo(state, memberId);
  if (ativo) return ativo;
  if (!administraOEspaco(state, memberId)) return "Conectar ou desconectar uma Integração é ato de Administrador (B35).";
  return undefined;
}
