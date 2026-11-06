/**
 * Os atos internos sobre Participações (24, 7.1) que Grupos, Comunidades,
 * Links e Automações compartilham: abrir, encerrar, resolver o Contato de um
 * número, reconciliar o Grupo de avisos. Nenhum deles é uma Ferramenta por si
 * — as Ferramentas (grupos.ts) os chamam e emitem os Eventos.
 */

import type { DataState } from "../../state";
import { CRM_DAS_FERRAMENTAS_VAZIO, type ActorRef, type CrmDasFerramentas, type Grupo, type Id, type OrigemDaParticipacao, type PapelNaParticipacao, type ParticipacaoDeGrupo } from "../../types";
import { gruposComuns, membrosDoGrupo, participacoesVigentes } from "../../derive-ferramentas";
import { nextId, recordActivity, systemActor } from "../activity";
import { canalNoCrm, canalPeloNumeroNoCrm, canonicalIdentifier } from "./permissoes";
import { gruposNovosDoProvedor } from "./provedor-simulado";

const now = (): string => new Date().toISOString();

/** Todo Registro de um Grupo passa por aqui: mesmo objectType, mesmo nome. */
export function registrarNoGrupo(
  state: DataState,
  grupo: Grupo,
  input: { readonly actor: ActorRef; readonly delegate?: ActorRef; readonly action: string; readonly result?: "ok" | "denied" | "failed"; readonly before?: string; readonly after?: string; readonly detail?: string; readonly at?: string },
): void {
  recordActivity(state, { ...input, objectType: "grupo", objectId: grupo.id, objectName: grupo.nome });
}

const soDigitos = (valor: string): string => valor.replace(/\D/g, "");

/**
 * Os números que o servidor precisa resolver ANTES da operação (3.4.8): `ler` os procura em
 * `plataforma.contato_identificadores` e gera o id dos que faltam; a operação usa o mesmo conjunto.
 * Fonte única — a leitura e a operação não podem divergir sobre quem é Participante. Um número de
 * Canal do Espaço nunca vira Contato (RN-GRP-11), então não entra.
 *
 * `args` são os da operação sem o Membro e sem o `crm`. Só `importarGruposDoCanal` e os três eventos do
 * provedor (Pedido de Entrada, entrada no Grupo, clique de Captação) criam Contato; qualquer outro
 * nome não resolve número nenhum.
 */
export function numerosAResolver(nome: string, state: DataState, args: readonly unknown[], crm?: CrmDasFerramentas): readonly string[] {
  const noCrm = crm ?? CRM_DAS_FERRAMENTAS_VAZIO;
  const texto = (v: unknown): string[] => (typeof v === "string" && v.trim() !== "" ? [v] : []);
  let numeros: string[];
  switch (nome) {
    case "importarGruposDoCanal": {
      const canal = canalNoCrm(noCrm, typeof args[0] === "string" ? args[0] : undefined);
      numeros = canal ? gruposNovosDoProvedor(state, canal).flatMap((g) => g.participantes) : [];
      break;
    }
    // Eventos do provedor (não são operações de `POST /operacoes`): o servidor os lê com as mesmas funções.
    case "receberPedidoDeEntrada": // (grupoId, numero)
    case "simularEntradaPorClique": // (cliqueId, numero)
      numeros = texto(args[1]);
      break;
    case "registrarEntradaNoGrupo": { // (grupoId, { numero })
      const entrada = args[1];
      numeros = typeof entrada === "object" && entrada !== null ? texto((entrada as { numero?: unknown }).numero) : [];
      break;
    }
    default:
      numeros = [];
  }
  const vistos = new Set<string>();
  const unicos: string[] = [];
  for (const numero of numeros) {
    const digitos = soDigitos(numero);
    if (digitos === "" || vistos.has(digitos) || canalPeloNumeroNoCrm(noCrm, numero)) continue;
    vistos.add(digitos);
    unicos.push(numero);
  }
  return unicos;
}

/**
 * Os padrões de um Contato que o Sistema cria por um Canal, na cadeia de DO-CXE-05: Proprietário do
 * Canal, senão o da Fila do Canal, senão o da Caixa, senão o Proprietário do Espaço de Trabalho; e a
 * Origem padrão do Canal pelo NOME no catálogo (a coluna `origem` do Contato é texto). Roda no
 * `aoConfirmar`, com o estado de depois da operação: a operação pura não conhece o Proprietário.
 */
export function padroesDoContatoCriado(
  state: DataState,
  canal: { readonly proprietarioPadraoId: Id | null; readonly filaPadraoId: Id | null; readonly origemPadraoId: Id | null },
): { readonly proprietarioId: Id; readonly origem?: string } {
  const proprietarioId =
    canal.proprietarioPadraoId ??
    state.queues.find((q) => q.id === canal.filaPadraoId)?.defaultContactOwnerMemberId ??
    state.inbox.defaultContactOwnerMemberId ??
    state.workspace.ownerMemberId;
  const origem = canal.origemPadraoId ? state.catalog.find((i) => i.id === canal.origemPadraoId && i.kind === "origem")?.name : undefined;
  return { proprietarioId, ...(origem ? { origem } : {}) };
}

/** O número como o Contato criado o mostra: `+55 11 97000-2474` quando é um celular brasileiro, senão `+<dígitos>`. */
export function numeroExibido(numero: string): string {
  const valor = canonicalIdentifier("identidadeDeWhatsApp", numero);
  return valor.length === 13 ? `+${valor.slice(0, 2)} ${valor.slice(2, 4)} ${valor.slice(4, 9)}-${valor.slice(9)}` : `+${valor}`;
}

/** O Contato de um Participante como as Ferramentas o usam: o id e o nome de exibição. */
export interface ContatoDoParticipante {
  readonly id: Id;
  readonly nome: string;
}

export const SEM_CONTATO_DO_PARTICIPANTE = "Contato do participante não resolvido.";

/**
 * O Contato que o servidor já deixou à mão para o número, sem registrar nada: o que ele leu de
 * `plataforma.contatos` (`crm.contatos`; um `mesclado` já vem resolvido ao sobrevivente, B14) ou, sem
 * esse, o `ContatoACriar` do mesmo número, com o id que o servidor gerou (`crm.contatosACriar`).
 */
export function contatoJaResolvido(crm: CrmDasFerramentas | undefined, numero: string): (ContatoDoParticipante & { readonly novo: boolean }) | undefined {
  const noCrm = crm ?? CRM_DAS_FERRAMENTAS_VAZIO;
  const digitos = soDigitos(canonicalIdentifier("identidadeDeWhatsApp", numero));
  const existente = noCrm.contatos.find((c) => c.whatsapp !== null && soDigitos(c.whatsapp) === digitos);
  if (existente) return { id: existente.id, nome: existente.nome, novo: false };
  const aCriar = (noCrm.contatosACriar ?? []).find((c) => soDigitos(c.whatsapp) === digitos);
  return aCriar ? { id: aCriar.id, nome: aCriar.nome, novo: true } : undefined;
}

/**
 * RN-GRP-10 — resolve o Contato pelo Identificador `whatsapp` (B13) com `contatoJaResolvido`. NUNCA
 * inventa um id: sem Contato lido nem `ContatoACriar` devolve o erro, e quem chama recusa a operação.
 * O INSERT do Contato novo é do `aoConfirmar`, no mesmo commit; aqui só se decide e se registra a
 * Atividade. O número não vai para a frase de erro.
 */
export function resolverOuCriarContato(state: DataState, numero: string, detalhe: string, crm?: CrmDasFerramentas): ContatoDoParticipante | { readonly erro: string } {
  const contato = contatoJaResolvido(crm, numero);
  if (!contato) return { erro: SEM_CONTATO_DO_PARTICIPANTE };
  if (contato.novo) {
    const jaRegistrado = state.activity.some((a) => a.objectType === "contact" && a.objectId === contato.id && a.action === "Contato criado por Participação em Grupo");
    if (!jaRegistrado) {
      recordActivity(state, { actor: systemActor, action: "Contato criado por Participação em Grupo", objectType: "contact", objectId: contato.id, objectName: contato.nome, detail: detalhe });
    }
  }
  return { id: contato.id, nome: contato.nome };
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
