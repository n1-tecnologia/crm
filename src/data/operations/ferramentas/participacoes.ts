/**
 * Os atos internos sobre Participações (24, 7.1) que Grupos, Comunidades,
 * Links e Automações compartilham: abrir, encerrar, resolver o Contato de um
 * número, reconciliar o Grupo de avisos. Nenhum deles é uma Ferramenta por si
 * — as Ferramentas (grupos.ts) os chamam e emitem os Eventos.
 */

import type { DataState } from "../../state";
import type { ActorRef, Channel, Contact, Grupo, Id, OrigemDaParticipacao, PapelNaParticipacao, ParticipacaoDeGrupo } from "../../types";
import { contactDisplayName } from "../../derive";
import { gruposComuns, membrosDoGrupo, participacoesVigentes } from "../../derive-ferramentas";
import { nextId, recordActivity, systemActor } from "../activity";
import { canonicalIdentifier } from "../contacts";

const now = (): string => new Date().toISOString();

/** Todo Registro de um Grupo passa por aqui: mesmo objectType, mesmo nome. */
export function registrarNoGrupo(
  state: DataState,
  grupo: Grupo,
  input: { readonly actor: ActorRef; readonly delegate?: ActorRef; readonly action: string; readonly result?: "ok" | "denied" | "failed"; readonly before?: string; readonly after?: string; readonly detail?: string; readonly at?: string },
): void {
  recordActivity(state, { ...input, objectType: "grupo", objectId: grupo.id, objectName: grupo.nome });
}

/** RN-GRP-11 — o número é de um Canal do Espaço de Trabalho? Então nunca vira Contato. */
export const canalPeloNumero = (state: DataState, numero: string): Channel | undefined =>
  state.channels.find((c) => c.channelType === "whatsapp" && canonicalIdentifier("identidadeDeWhatsApp", c.externalId) === canonicalIdentifier("identidadeDeWhatsApp", numero));

/**
 * RN-GRP-10 — resolve o Contato pelo Identificador `identidadeDeWhatsApp`
 * (B13); um `mesclado` resolve ao sobrevivente (B14); sem Contato, o Sistema
 * cria um "Não identificado" com Proprietário pela cadeia Canal → Caixa →
 * Proprietário do ET (DO-CXE-05) e Origem padrão do Canal.
 */
export function resolverOuCriarContato(state: DataState, canal: Channel, numero: string, detalhe: string): Contact {
  const valor = canonicalIdentifier("identidadeDeWhatsApp", numero);
  let contato = state.contacts.find((c) => c.identifiers.some((i) => i.type === "identidadeDeWhatsApp" && i.value === valor));
  let saltos = 0;
  while (contato?.lifecycle === "mesclado" && contato.mergedIntoId && saltos < 10) {
    const alvo = state.contacts.find((c) => c.id === contato?.mergedIntoId);
    if (!alvo) break;
    contato = alvo;
    saltos += 1;
  }
  if (contato) return contato;

  const dono =
    canal.defaultContactOwnerMemberId ??
    state.queues.find((q) => q.id === canal.defaultQueueId)?.defaultContactOwnerMemberId ??
    state.inbox.defaultContactOwnerMemberId ??
    state.workspace.ownerMemberId;
  const exibicao = valor.length === 13 ? `+${valor.slice(0, 2)} ${valor.slice(2, 4)} ${valor.slice(4, 9)}-${valor.slice(9)}` : `+${valor}`;
  const criado: Contact = {
    id: nextId("cnt"),
    workspaceId: state.workspace.id,
    createdBy: systemActor,
    createdAt: now(),
    lifecycle: "ativo",
    firstName: "",
    lastName: "",
    ownerMemberId: dono,
    creationMode: "automaticoPorGrupo",
    ...(canal.defaultOriginId ? { originId: canal.defaultOriginId } : {}),
    description: "",
    identifiers: [
      {
        id: nextId("cid"),
        type: "identidadeDeWhatsApp",
        value: valor,
        displayValue: exibicao,
        channelOriginId: canal.id,
        verified: true,
        principal: true,
        createdBy: systemActor,
        createdAt: now(),
      },
    ],
    consents: [],
    addresses: [],
    tagIds: [],
    fieldValues: [],
    comments: [],
  };
  state.contacts.push(criado);
  recordActivity(state, {
    actor: systemActor,
    action: "Contato criado por Participação em Grupo",
    objectType: "contact",
    objectId: criado.id,
    objectName: contactDisplayName(criado),
    detail: detalhe,
  });
  return criado;
}

export interface AberturaDeParticipacao {
  readonly contactId?: Id;
  readonly canalParticipanteId?: Id;
  readonly identificadorExterno: string;
  readonly papel?: PapelNaParticipacao;
  readonly origem: OrigemDaParticipacao;
  readonly at?: string;
  readonly estimada?: boolean;
  readonly adicionadoPor?: ActorRef;
  readonly linkDeCaptacaoId?: Id;
  readonly cliqueId?: Id;
  readonly origemInferida?: boolean;
  /** Evento do provedor: acima da Capacidade marca divergência em vez de recusar (INV-GRP-03). */
  readonly doProvedor?: boolean;
}

/**
 * INV-GRP-02 — no máximo uma vigente por (Contato, Grupo): se já há, devolve
 * a existente. INV-GRP-03 — a plataforma não passa da Capacidade; o provedor
 * pode, e então fica a divergência marcada.
 */
export function abrirParticipacao(state: DataState, grupo: Grupo, input: AberturaDeParticipacao): { readonly participacao: ParticipacaoDeGrupo; readonly nova: boolean } | { readonly erro: string } {
  const vigente = participacoesVigentes(grupo).find((p) =>
    input.contactId !== undefined ? p.contactId === input.contactId : input.canalParticipanteId !== undefined ? p.canalParticipanteId === input.canalParticipanteId : p.identificadorExternoDoParticipante === input.identificadorExterno,
  );
  if (vigente) return { participacao: vigente, nova: false };
  const vigentes = participacoesVigentes(grupo).length;
  if (vigentes >= grupo.capacidade) {
    if (!input.doProvedor) return { erro: `O Grupo está cheio (${vigentes} de ${grupo.capacidade}).` };
    grupo.divergenciaDeCapacidade = `O provedor mostra ${vigentes + 1} participantes para uma Capacidade de ${grupo.capacidade}.`;
  }
  const momento = input.at ?? now();
  const participacao: ParticipacaoDeGrupo = {
    id: nextId("prg"),
    grupoId: grupo.id,
    ...(input.contactId !== undefined ? { contactId: input.contactId } : {}),
    ...(input.canalParticipanteId !== undefined ? { canalParticipanteId: input.canalParticipanteId } : {}),
    identificadorExternoDoParticipante: input.identificadorExterno,
    entradaEm: momento,
    entradaEstimada: input.estimada ?? false,
    papel: input.papel ?? "membro",
    origem: input.origem,
    ...(input.linkDeCaptacaoId !== undefined ? { linkDeCaptacaoId: input.linkDeCaptacaoId } : {}),
    ...(input.cliqueId !== undefined ? { cliqueId: input.cliqueId } : {}),
    ...(input.origemInferida ? { origemInferida: true } : {}),
    ...(input.adicionadoPor ? { adicionadoPor: input.adicionadoPor } : {}),
  };
  grupo.participacoes.push(participacao);
  return { participacao, nova: true };
}

/** INV-GRP-07 — nunca eliminada: encerra-se com causa e momento. */
export function encerrarParticipacao(
  grupo: Grupo,
  participacao: ParticipacaoDeGrupo,
  input: { readonly causa: ParticipacaoDeGrupo["causaDaSaida"]; readonly removidoPor?: ActorRef; readonly at?: string; readonly estimada?: boolean },
): void {
  if (participacao.saidaEm !== undefined) return;
  participacao.saidaEm = input.at ?? now();
  participacao.causaDaSaida = input.causa;
  if (input.estimada) participacao.saidaEstimada = true;
  if (input.removidoPor) participacao.removidoPor = input.removidoPor;
  // Se saiu quem estava acima da Capacidade, a divergência acabou.
  if (grupo.divergenciaDeCapacidade && participacoesVigentes(grupo).length <= grupo.capacidade) delete grupo.divergenciaDeCapacidade;
}

export const nomeDoParticipante = (state: DataState, p: ParticipacaoDeGrupo): string => {
  if (p.canalParticipanteId) return state.channels.find((c) => c.id === p.canalParticipanteId)?.name ?? "o Canal";
  const contato = p.contactId ? state.contacts.find((c) => c.id === p.contactId) : undefined;
  return contato ? contactDisplayName(contato) : p.identificadorExternoDoParticipante;
};

/**
 * RN-COM-04 — as Participações do Grupo de avisos são a união dos membros dos
 * Grupos `comum`, mantidas pelo provedor: a plataforma só espelha. Quem
 * entrou num `comum` aparece no avisos; quem saiu de todos, some de lá.
 */
export function reconciliarGrupoDeAvisos(state: DataState, comunidadeId: Id, at?: string): void {
  const avisos = state.grupos.find((g) => g.comunidadeId === comunidadeId && g.papelNaComunidade === "avisos" && g.lifecycle !== "naLixeira");
  if (!avisos) return;
  const membros = new Map<string, ParticipacaoDeGrupo>();
  for (const grupo of gruposComuns(state, comunidadeId)) {
    for (const p of membrosDoGrupo(grupo)) if (!membros.has(p.identificadorExternoDoParticipante)) membros.set(p.identificadorExternoDoParticipante, p);
  }
  for (const p of membrosDoGrupo(avisos)) {
    if (!membros.has(p.identificadorExternoDoParticipante)) encerrarParticipacao(avisos, p, { causa: "removido", ...(at ? { at } : {}), estimada: true });
  }
  for (const [numero, origem] of membros) {
    if (participacoesVigentes(avisos).some((p) => p.identificadorExternoDoParticipante === numero)) continue;
    abrirParticipacao(state, avisos, {
      ...(origem.contactId !== undefined ? { contactId: origem.contactId } : {}),
      identificadorExterno: numero,
      origem: "adicionado",
      ...(at ? { at } : {}),
      estimada: true,
      doProvedor: true,
    });
  }
}
