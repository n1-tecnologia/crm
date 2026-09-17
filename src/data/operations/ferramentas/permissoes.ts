/**
 * As recusas dos Ativos de Canal, numa só voz: cada função devolve a frase
 * que a operação usa em `fail` E que a tela mostra em `disabledReason`, para
 * o botão desligado dizer exatamente o que a operação diria. `undefined` =
 * permitido.
 *
 * A ordem de cada verificação é a ordem em que a ontologia manda olhar:
 * ciclo de vida → Canal (existe, ativo, conectado) → Sincronização
 * (`nuncaConferido` exige `sincronizar` antes de qualquer Ferramenta externa —
 * RN-ATV-08) → Papel do Canal (RN-GRP-05: administração exige `administrador`;
 * `sincronizar` e `sair` aceitam `participante`).
 */

import type { DataState } from "../../state";
import type { Channel, Comunidade, Flow, Grupo, Id } from "../../types";
import { versaoPublicada } from "../../derive-ferramentas";
import { CAPACIDADES_DE_ATIVOS } from "./capacidades";

/** Só um Membro ativo age; um Convidado só alcança o que foi compartilhado. */
export function recusaDeMembroAtivo(state: DataState, memberId: Id): string | undefined {
  const member = state.members.find((m) => m.id === memberId);
  if (!member || member.state !== "ativo") return "Só um Membro ativo usa as Ferramentas do Canal.";
  const base = state.roles.find((r) => r.id === member.roleId)?.base;
  if (base === "convidado") return "Um Convidado não usa as Ferramentas do Canal.";
  return undefined;
}

/** `administrar` (17): publicar, despublicar, sair, trocar Canal, regenerar chaves — Proprietário ou Administrador. */
export function recusaDeAdministracao(state: DataState, memberId: Id): string | undefined {
  const geral = recusaDeMembroAtivo(state, memberId);
  if (geral) return geral;
  const member = state.members.find((m) => m.id === memberId);
  const base = state.roles.find((r) => r.id === member?.roleId)?.base;
  if (base !== "proprietario" && base !== "administrador") return "Esta Ferramenta exige administrar: Proprietário ou Administrador.";
  return undefined;
}

export const canalDoAtivo = (state: DataState, ativo: { readonly canalId?: Id }): Channel | undefined =>
  ativo.canalId === undefined ? undefined : state.channels.find((c) => c.id === ativo.canalId);

/** Um Canal ativo, conectado e cujo Tipo tem a Capacidade pedida. */
export function recusaDoCanal(state: DataState, canalId: Id | undefined, capacidade: "gruposAdministraveis" | "comunidades" | "formulariosInterativos"): string | undefined {
  if (canalId === undefined) return "Escolha o Canal.";
  const canal = state.channels.find((c) => c.id === canalId);
  if (!canal) return "Canal não encontrado.";
  if (canal.lifecycle !== "ativo") return `O Canal ${canal.name} está arquivado.`;
  if (!CAPACIDADES_DE_ATIVOS[canal.channelType][capacidade]) {
    const nome = capacidade === "gruposAdministraveis" ? "grupos administráveis" : capacidade === "comunidades" ? "comunidades" : "formulários interativos";
    return `O Tipo de Canal ${canal.channelType} não tem a Capacidade “${nome}”.`;
  }
  if (canal.connection !== "conectada") return `O Canal ${canal.name} está ${canal.connection === "comErro" ? "com erro" : "desconectado"}: a Ferramenta não chega ao provedor.`;
  return undefined;
}

export type ExigenciaDePapel = "administrador" | "participante";

/**
 * Uma Ferramenta EXTERNA sobre o Grupo: chega ao provedor pelo Canal
 * administrador, então precisa de tudo que o caminho até lá exige.
 */
export function recusaExternaNoGrupo(state: DataState, grupo: Grupo, exige: ExigenciaDePapel = "administrador"): string | undefined {
  if (grupo.lifecycle === "naLixeira") return "O Grupo está na lixeira.";
  if (grupo.lifecycle === "arquivado") return "O Grupo está arquivado: restaure-o antes.";
  if (grupo.canalId === undefined || grupo.sincronizacao.estado === "orfao") return "O Grupo está sem Canal administrador (órfão).";
  const canal = recusaDoCanal(state, grupo.canalId, "gruposAdministraveis");
  if (canal) return canal;
  if (grupo.sincronizacao.estado === "nuncaConferido") return "Sincronize o Grupo antes de qualquer Ferramenta externa (RN-ATV-08).";
  if (grupo.sincronizacao.estado === "inacessivel" || grupo.sincronizacao.papelDoCanal === "ausente") return "O Grupo está inacessível: o Canal não está mais nele.";
  if (exige === "administrador" && grupo.sincronizacao.papelDoCanal !== "administrador") return "O Canal é só participante deste Grupo: sem privilégio para administrá-lo (RN-GRP-05).";
  return undefined;
}

export function recusaExternaNaComunidade(state: DataState, comunidade: Comunidade, exige: ExigenciaDePapel = "administrador"): string | undefined {
  if (comunidade.lifecycle === "naLixeira") return "A Comunidade está na lixeira.";
  if (comunidade.lifecycle === "arquivado") return "A Comunidade está arquivada: restaure-a antes.";
  if (comunidade.canalId === undefined || comunidade.sincronizacao.estado === "orfao") return "A Comunidade está sem Canal administrador (órfã).";
  const canal = recusaDoCanal(state, comunidade.canalId, "comunidades");
  if (canal) return canal;
  if (comunidade.sincronizacao.estado === "nuncaConferido") return "Sincronize a Comunidade antes de qualquer Ferramenta externa (RN-ATV-08).";
  if (comunidade.sincronizacao.estado === "inacessivel" || comunidade.sincronizacao.papelDoCanal === "ausente") return "A Comunidade está inacessível: o Canal não está mais nela.";
  if (exige === "administrador" && comunidade.sincronizacao.papelDoCanal !== "administrador") return "O Canal é só participante desta Comunidade: sem privilégio para administrá-la.";
  return undefined;
}

/**
 * RN-GRP-13 — enviar ao Grupo é enviar na Conversa de grupo. Precisa do
 * Canal no Grupo (participante basta), e, se só administradores enviam, do
 * Papel `administrador`.
 */
export function recusaDeEnvioAoGrupo(state: DataState, grupo: Grupo): string | undefined {
  if (grupo.lifecycle === "naLixeira") return "O Grupo está na lixeira.";
  if (grupo.canalId === undefined || grupo.sincronizacao.estado === "orfao") return "O Grupo está sem Canal: não há por onde enviar.";
  const canal = state.channels.find((c) => c.id === grupo.canalId);
  if (!canal || canal.lifecycle !== "ativo") return "O Canal do Grupo está arquivado.";
  if (grupo.sincronizacao.estado === "nuncaConferido") return "Sincronize o Grupo antes de enviar (RN-ATV-08).";
  if (grupo.sincronizacao.estado === "inacessivel" || grupo.sincronizacao.papelDoCanal === "ausente") return "O Canal não está mais no Grupo.";
  if (grupo.configuracoes.somenteAdministradoresEnviam && grupo.sincronizacao.papelDoCanal !== "administrador") {
    return "Só administradores enviam neste Grupo, e o Canal é participante.";
  }
  return undefined;
}

/** RN-FLW-06 / RN-FLW-13 — publicar exige Flow ativo, Canal publicador do mesmo Tipo, ativo e conectado. */
export function recusaDePublicacao(state: DataState, flow: Flow): string | undefined {
  if (flow.lifecycle === "naLixeira") return "O Flow está na lixeira.";
  if (flow.lifecycle === "arquivado") return "Um Flow arquivado não publica (RN-FLW-13).";
  if (flow.canalId === undefined) return "Escolha o Canal publicador antes de publicar.";
  const canal = recusaDoCanal(state, flow.canalId, "formulariosInterativos");
  if (canal) return canal;
  const publicador = state.channels.find((c) => c.id === flow.canalId);
  if (publicador && publicador.channelType !== flow.tipoDeCanal) return "O Canal publicador precisa ser do mesmo Tipo do Flow.";
  if (flow.estadoNoProvedor === "bloqueadoPeloProvedor") return "O provedor bloqueou este Flow.";
  return undefined;
}

/** RN-FLW-01 / INV-FLW-02 / RN-FLW-13 — só uma Versão `publicada` de um Flow ativo é enviável. */
export function recusaDeEnvioDeFlow(state: DataState, flow: Flow): string | undefined {
  if (flow.lifecycle !== "ativo") return "Um Flow arquivado ou na lixeira não é enviável (RN-FLW-13).";
  if (!versaoPublicada(flow)) return "O Flow não tem Versão publicada: publique antes de enviar (RN-FLW-01).";
  if (flow.canalId === undefined) return "O Flow está sem Canal publicador.";
  const canal = state.channels.find((c) => c.id === flow.canalId);
  if (!canal || canal.lifecycle !== "ativo") return "O Canal publicador está arquivado: o Flow ficou órfão (20.3).";
  if (flow.estadoNoProvedor === "bloqueadoPeloProvedor") return "O provedor bloqueou este Flow: não enviável.";
  if (flow.estadoNoProvedor === "descontinuado") return "A Versão de esquema foi descontinuada pelo provedor: migre o rascunho e publique.";
  if (flow.estadoNoProvedor === "removido") return "O Flow foi removido no provedor.";
  return undefined;
}
