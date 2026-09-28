/**
 * Evolver idempotente de configuração (`02-RESEARCH.md`, Open Question #3):
 * transforma `CATALOGO_SOLICITACAO_DE_PAGAMENTO` (Plan 02-06) numa Lista de
 * verdade no `DataState` — a peça que falta porque `bootstrapGestao()`
 * (Fase 1, `apps/api/src/bootstrap/gestao.ts`) só grava em Espaço vazio
 * (`count(*) > 0` recusa) e não serve para acrescentar uma Lista a um Espaço
 * "Gestão" que já opera com "Contas a pagar" em produção.
 *
 * Regra central — criar-ou-conferir, nunca substituir:
 *   - id do catálogo ausente no estado → cria;
 *   - id do catálogo presente no estado → compara campo a campo; qualquer
 *     divergência é reportada, nunca sobrescrita;
 *   - id presente no estado mas ausente do catálogo (Status ou Campo a mais
 *     na Lista) → reportado como divergência, nunca removido.
 *
 * Três regras duras, vigiadas pelo grep do plano (V02-01A):
 *   1. NUNCA remove nada — Status, Campo, Tag ou Papel a mais no estado é
 *      divergência reportada, não item deletado.
 *   2. NUNCA toca `state.tasks` nem qualquer Comentário ou valor de Campo já
 *      gravado — este arquivo não lê nem escreve `state.tasks` em nenhuma
 *      linha.
 *   3. Ids são sempre os literais do catálogo (ou os literais definidos
 *      abaixo para a Lista), nunca gerados por contador de sequência —
 *      reexecutar não pode produzir um id diferente do já gravado (mesma
 *      regra do cabeçalho de `bootstrap-gestao.ts`).
 */

import { CP, CR } from "./operations/financeiro";
import { memberActor, nextId, recordActivity } from "./operations/activity";
import { grantGovernanceAccess, inviteMember } from "./operations/members";
import {
  CATALOGO_SOLICITACAO_DE_PAGAMENTO,
  SOL,
  type CampoDaSolicitacao,
  type PapelDaSolicitacao,
} from "./solicitacao-de-pagamento";
import { fail, ok, type DataState, type OperationResult } from "./state";
import type {
  ActorRef,
  FieldDefinition,
  Id,
  List,
  PermissionScope,
  Role,
  SystemRole,
} from "./types";

/* ── Ids literais e estáveis da Lista (nunca gerados por sequência) ───────
 * O catálogo do Plan 02-06 não inclui a Lista em si (é dado pré-workspace,
 * sem `parentId`/estrutura) — este arquivo é quem a materializa. */
export const LISTA_ID: Id = "lst_solicitacoes_de_pagamento";
const LISTA_NOME = "Solicitações de pagamento";

export interface DivergenciaDeConfiguracao {
  readonly id: Id;
  readonly campo: string;
  readonly esperado: string;
  readonly encontrado: string;
}

export interface DiffDeConfiguracao {
  readonly criados: string[];
  readonly conferidos: string[];
  readonly divergentes: DivergenciaDeConfiguracao[];
  /** Presente só quando a elevação de fato acontece (item 4 da ordem abaixo). */
  readonly tasksPerList?: { readonly antes: number; readonly depois: number };
  /**
   * Ids dos Membros que ocupam o "Agente do pipeline" e ganharam `ver` na
   * Lista nesta execução (item 5). Ausente quando ninguém ocupa o Papel ou
   * todos já tinham a concessão — reaplicar é no-op.
   */
  readonly concedidos?: string[];
  /** Id do Membro de serviço do "Agente do pipeline" criado nesta execução (item 4b). Ausente quando já existia. */
  readonly membroDeServicoCriado?: string;
  /**
   * As concessões de governança dadas nesta execução (item 6), no formato
   * `<memberId>→<listId>:administrar`. Ausente quando já existiam todas.
   */
  readonly concessoesDeGovernanca?: string[];
}

/** V02-01B — teto mínimo antes de qualquer importação (`02-RESEARCH.md`, ~1.110 Tarefas históricas). */
const TASKS_PER_LIST_PADRAO = 5000;

/**
 * O e-mail do Membro de serviço que ocupa o "Agente do pipeline" (plano
 * pós-auditoria, 2.2). Domínio `.invalid` de propósito (RFC 2606): o endereço
 * nunca entrega mensagem nem colide com um Usuário de verdade — este Membro
 * não faz login, e o que o identifica é o Papel e a credencial de serviço.
 */
export const EMAIL_DO_AGENTE_DO_PIPELINE = "agente-do-pipeline@servico.n1.invalid";
const NOME_DO_AGENTE_DO_PIPELINE = "Agente do pipeline";

/**
 * As Listas em que o "Agente do pipeline" age fora das Solicitações (item 6):
 * o agendador (`apps/api/src/automacoes/scheduler-worker.ts`) roda a agenda
 * de Automações de Contas a pagar e de Contas a receber em nome dele, e a
 * ponte do lançamento (`invocar-agente.ts`) comenta, publica o Resumo e move
 * o Status das contas a pagar. `runScheduledAutomations` exige `administrar`
 * na Lista — "rodar o relógio da Lista é administrá-la" —, e as duas moram
 * no Espaço privado "Gestão", onde um Convidado só entra por concessão.
 */
// Função, não constante de módulo: `operations/automations.ts` importa este
// arquivo, e no ciclo de imports `CR` ainda não existe quando o módulo é
// avaliado — lido só na chamada, já existe.
const listasDoAgenteDoPipeline = (): readonly Id[] => [CP.listId, CR.listId];
const MOTIVO_DA_CONCESSAO =
  'Plano pós-auditoria 2.2: o "Agente do pipeline" roda a agenda de Automações desta Lista (exige administrar) ' +
  'e, em Contas a pagar, publica o Resumo e move o Status depois do lançamento no Omie.';

export interface OpcoesDaEvolucaoDeSolicitacoes {
  readonly tasksPerListMinimo?: number | undefined;
  /**
   * Plano pós-auditoria, 2.2 — cria o Membro de serviço que ocupa o Papel
   * "Agente do pipeline" quando ninguém o ocupa (item 4b) e dá a quem o
   * ocupa o alcance que o agendador e a ponte usam (item 6). É opcional de
   * propósito: D-13 manda este evolver não nomear ocupante por conta própria;
   * quem pede é o CLI `solicitacoes:configurar` (sempre), nunca os testes
   * que usam o evolver como construtor de fixture.
   */
  readonly membroDeServico?: { readonly email: string } | undefined;
}

function conferirCampos(
  divergentes: DivergenciaDeConfiguracao[],
  id: Id,
  pares: ReadonlyArray<readonly [campo: string, esperado: string, encontrado: string]>,
): void {
  for (const [campo, esperado, encontrado] of pares) {
    if (esperado !== encontrado) divergentes.push({ id, campo, esperado, encontrado });
  }
}

function formatarDivergencias(divergentes: readonly DivergenciaDeConfiguracao[]): string {
  const linhas = divergentes.map((d) => `${d.id}.${d.campo}: esperado "${d.esperado}", encontrado "${d.encontrado}"`);
  return `Configuração da Lista "${LISTA_NOME}" diverge do catálogo — nada foi sobrescrito:\n${linhas.join("\n")}`;
}

function montarLista(workspaceId: Id, agora: string, ator: ActorRef): List {
  return {
    id: LISTA_ID,
    workspaceId,
    createdBy: ator,
    createdAt: agora,
    lifecycle: "ativo",
    name: LISTA_NOME,
    description: "Uma Tarefa por pedido de pagamento; nasce em \"para fazer\" e termina em \"aprovado\" ou \"não aprovado\" (D-14) — antecede \"Contas a pagar\".",
    order: 1,
    isPrivate: false,
    modes: { statusSet: "sobrescrito", features: "sobrescrito" },
    blocks: {},
    statusSet: { id: CATALOGO_SOLICITACAO_DE_PAGAMENTO.statusSet.id, definitions: [] },
    features: { subtarefas: false, checklists: false, dependencias: false, compartilhamentoPublico: false },
    parentType: "folder",
    parentId: CP.folderId,
    modeloDeTarefa: "operacional",
  };
}

function montarCampo(campo: CampoDaSolicitacao, workspaceId: Id): FieldDefinition {
  return {
    id: campo.id,
    workspaceId,
    name: campo.rotulo,
    ...(campo.descricao !== undefined ? { description: campo.descricao } : {}),
    type: campo.tipo,
    ...(campo.opcoes !== undefined ? { options: campo.opcoes } : {}),
    required: campo.obrigatorio,
    target: "task",
    definedAtType: "list",
    definedAtId: LISTA_ID,
    lifecycle: "ativo",
  };
}

/**
 * §9 do catálogo: "Agente do pipeline" é um Convidado com `editar` restrito a
 * Status; os outros quatro Papéis (Solicitante, Aprovador, Financeiro,
 * Revisor do RESUMO) são ocupados por Membros reais do Espaço de Trabalho.
 */
function baseParaPapel(papel: PapelDaSolicitacao): SystemRole {
  return papel.id === SOL.papeis.agentePipeline ? "convidado" : "membro";
}

/**
 * `PermissionScope` (registro|subarvore|proprios) é mais estreito que o
 * vocabulário de negócio do catálogo (proprias|roteadas|aprovadas|todas):
 * "roteadas" depende de `resolverAprovador` (RN-SP-03) e "aprovadas" de
 * Status — nenhum dos dois é um recorte estrutural que `Role.permissions`
 * saiba expressar. Aproximamos para o valor estrutural mais próximo; a
 * aplicação fina do recorte é leitura em tempo de execução pelos Plans
 * 02-13/02-21 (aprovação por clique), não deste Papel materializado.
 */
function escopoParaPermissao(escopo: PapelDaSolicitacao["escopo"]): PermissionScope {
  if (escopo === "proprias") return "proprios";
  return "subarvore";
}

/**
 * §9 — `editarRestritoA` só se aplica à permissão de `editar`; as demais
 * ações do Papel (ver, comentar, ...) nascem sem restrição, como sempre.
 */
function permissoesEsperadas(papel: PapelDaSolicitacao): Role["permissions"] {
  return papel.capacidades.map((acao) => ({
    action: acao,
    resourceType: "task",
    scope: escopoParaPermissao(papel.escopo),
    ...(acao === "editar" && papel.editarRestritoA ? { restrictedTo: papel.editarRestritoA } : {}),
  }));
}

/**
 * Evolui a configuração da Lista "Solicitações de pagamento" sobre um
 * `DataState` já bootstrapado pela Fase 1 (Espaço "Gestão" › Pasta
 * "Financeiro" precisam existir — este evolver não os recria). Reaplicar é
 * seguro: a segunda chamada sobre o próprio resultado devolve `ok` com
 * `criados` e `divergentes` vazios.
 *
 * Ordem, conforme o plano:
 *   1. localizar Espaço/Pasta; recusar se ausentes;
 *   2. criar-ou-conferir cada elemento do catálogo (Lista, Status, Campos,
 *      Tag, Papéis);
 *   3. qualquer divergência → `fail` com diff legível, nada mais muda;
 *   4. elevar `tasksPerList` para `max(atual, mínimo)`;
 *   5. uma Atividade por elemento criado + uma pela elevação do limite;
 *   6. `ok(diff)`.
 *
 * Com `opcoes.membroDeServico` (plano pós-auditoria, 2.2 — o CLI sempre
 * pede), mais dois passos, em blocos próprios abaixo: 4b cria e ativa o
 * Membro de serviço do "Agente do pipeline" quando ninguém ativo ocupa o
 * Papel (um convite pendente no Papel é divergência do passo 3), e 6 dá a
 * quem o ocupa `administrar` nas Listas de Contas a pagar e a receber, por
 * ato de governança. As Atividades desses passos são as das próprias
 * operações (`inviteMember`, `grantGovernanceAccess`) mais a da ativação.
 */
export function evoluirConfiguracaoDeSolicitacoes(
  state: DataState,
  actingMemberId: Id,
  opcoes: OpcoesDaEvolucaoDeSolicitacoes = {},
): OperationResult<DiffDeConfiguracao> {
  if (!state.spaces.some((e) => e.id === CP.spaceId)) {
    return fail(`Espaço "Gestão" (${CP.spaceId}) não existe — rode o bootstrap da Fase 1 (bootstrapGestao) antes de evoluir esta configuração.`);
  }
  if (!state.folders.some((f) => f.id === CP.folderId)) {
    return fail(`Pasta "Financeiro" (${CP.folderId}) não existe — rode o bootstrap da Fase 1 (bootstrapGestao) antes de evoluir esta configuração.`);
  }

  const workspaceId = state.workspace.id;
  const agora = new Date().toISOString();
  const ator = memberActor(actingMemberId);

  const criados: string[] = [];
  const conferidos: string[] = [];
  const divergentes: DivergenciaDeConfiguracao[] = [];

  const registrarCriacao = (objectType: string, objectId: Id, objectName: string): void => {
    criados.push(objectId);
    recordActivity(state, { actor: ator, action: "criar", objectType, objectId, objectName, at: agora });
  };

  /* ── Lista + Status (o Conjunto de Status vive dentro da Lista) ───────── */
  let lista = state.lists.find((l) => l.id === LISTA_ID);
  const listaEraNova = lista === undefined;
  if (!lista) {
    lista = montarLista(workspaceId, agora, ator);
    state.lists.push(lista);
    registrarCriacao("list", lista.id, lista.name);
  } else {
    conferirCampos(divergentes, lista.id, [
      ["name", LISTA_NOME, lista.name],
      ["parentId", CP.folderId, lista.parentId],
    ]);
    conferidos.push(lista.id);
  }

  for (const statusCatalogo of CATALOGO_SOLICITACAO_DE_PAGAMENTO.statusSet.definitions) {
    const existente = lista.statusSet!.definitions.find((s) => s.id === statusCatalogo.id);
    if (!existente) {
      lista.statusSet!.definitions.push({ ...statusCatalogo });
      registrarCriacao("status", statusCatalogo.id, statusCatalogo.name);
    } else {
      conferirCampos(divergentes, statusCatalogo.id, [
        ["name", statusCatalogo.name, existente.name],
        ["color", statusCatalogo.color, existente.color],
        ["category", statusCatalogo.category, existente.category],
        ["order", String(statusCatalogo.order), String(existente.order)],
      ]);
      conferidos.push(statusCatalogo.id);
    }
  }
  // Status a mais na Lista, fora do catálogo — nunca removido, só reportado.
  // Só se aplica quando a Lista já existia: numa Lista nova, `statusSet` foi
  // montado do zero por este mesmo laço, logo não pode ter sobra.
  if (!listaEraNova) {
    for (const extra of lista.statusSet!.definitions) {
      if (!CATALOGO_SOLICITACAO_DE_PAGAMENTO.statusSet.definitions.some((s) => s.id === extra.id)) {
        divergentes.push({ id: extra.id, campo: "presença", esperado: "ausente do catálogo", encontrado: `Status "${extra.name}" presente mas não previsto no catálogo` });
      }
    }
  }

  /* ── Tag ───────────────────────────────────────────────────────────────
   * `state.tags` é compartilhado com o resto do Espaço (as 8 `conta *` de
   * "Contas a pagar" moram na mesma coleção) — não fazemos checagem de
   * "sobra": isso acusaria toda Tag de outra Lista como divergência. */
  for (const tagCatalogo of CATALOGO_SOLICITACAO_DE_PAGAMENTO.tags) {
    const existente = state.tags.find((t) => t.id === tagCatalogo.id);
    if (!existente) {
      state.tags.push({ id: tagCatalogo.id, workspaceId, name: tagCatalogo.nome, color: tagCatalogo.cor, lifecycle: "ativo" });
      registrarCriacao("tag", tagCatalogo.id, tagCatalogo.nome);
    } else {
      conferirCampos(divergentes, tagCatalogo.id, [
        ["name", tagCatalogo.nome, existente.name],
        ["color", tagCatalogo.cor, existente.color],
      ]);
      conferidos.push(tagCatalogo.id);
    }
  }

  /* ── Campos (25, na ordem A..Z do catálogo) ───────────────────────────── */
  for (const campoCatalogo of CATALOGO_SOLICITACAO_DE_PAGAMENTO.campos) {
    const existente = state.fieldDefinitions.find((f) => f.id === campoCatalogo.id);
    if (!existente) {
      state.fieldDefinitions.push(montarCampo(campoCatalogo, workspaceId));
      registrarCriacao("fieldDefinition", campoCatalogo.id, campoCatalogo.rotulo);
    } else {
      conferirCampos(divergentes, campoCatalogo.id, [
        ["name", campoCatalogo.rotulo, existente.name],
        ["type", campoCatalogo.tipo, existente.type],
        ["required", String(campoCatalogo.obrigatorio), String(existente.required)],
      ]);
      conferidos.push(campoCatalogo.id);
    }
  }
  // Campo a mais LIGADO A ESTA LISTA, fora do catálogo — nunca removido, só
  // reportado (V02-01A, caso (h)). Escopado por `definedAtId` para não acusar
  // Campos de "Contas a pagar" definidos na mesma Pasta/Espaço.
  for (const extra of state.fieldDefinitions) {
    if (extra.definedAtType !== "list" || extra.definedAtId !== LISTA_ID) continue;
    if (!CATALOGO_SOLICITACAO_DE_PAGAMENTO.campos.some((c) => c.id === extra.id)) {
      divergentes.push({ id: extra.id, campo: "presença", esperado: "ausente do catálogo", encontrado: `Campo "${extra.name}" presente na Lista mas não previsto no catálogo` });
    }
  }

  /* ── Papéis → Role (D-13: sem ocupante hardcoded; quem ocupa um Papel é
   * decidido por convite/atribuição, fora deste evolver) ─────────────────
   *
   * O alcance, porém, nasce aqui: ver a seção 5 abaixo. Um Convidado não
   * chega a contêiner nenhum por Papel (B70) — sem concessão na Lista, o
   * "Agente do pipeline" enxerga zero Solicitações e `guestStatusWriter`
   * recusa por `memberSeesTask`, não pela regra do §9. */
  for (const papelCatalogo of CATALOGO_SOLICITACAO_DE_PAGAMENTO.papeis) {
    const existente = state.roles.find((r) => r.id === papelCatalogo.id);
    const esperadas = permissoesEsperadas(papelCatalogo);
    if (!existente) {
      state.roles.push({ id: papelCatalogo.id, workspaceId, name: papelCatalogo.nome, system: false, base: baseParaPapel(papelCatalogo), permissions: esperadas });
      registrarCriacao("role", papelCatalogo.id, papelCatalogo.nome);
    } else {
      conferirCampos(divergentes, papelCatalogo.id, [
        ["name", papelCatalogo.nome, existente.name],
        ["base", baseParaPapel(papelCatalogo), existente.base],
        ["permissions.length", String(esperadas.length), String(existente.permissions.length)],
      ]);
      conferidos.push(papelCatalogo.id);
    }
  }

  /* ── Membro de serviço: um convite pendente no Papel é ambiguidade ─────
   * Um Membro de serviço não aceita convite (não há Usuário), e o que o
   * agendador resolve pelo Papel precisa ser um Membro ativo. Um `pendente`
   * no Papel é convite de alguém a uma pessoa: criar outro ao lado deixaria
   * dois ocupantes, e decidir entre eles não é deste evolver. */
  if (opcoes.membroDeServico) {
    const pendente = state.members.find((m) => m.roleId === SOL.papeis.agentePipeline && m.state === "pendente");
    if (pendente) {
      divergentes.push({ id: pendente.id, campo: "state", esperado: "ativo (Membro de serviço)", encontrado: "pendente (convite não aceito no Papel \"Agente do pipeline\")" });
    }
  }

  /* ── 3. Qualquer divergência recusa — nada mais muda a partir daqui ──── */
  if (divergentes.length > 0) {
    return fail(formatarDivergencias(divergentes));
  }

  /* ── 4. Elevar tasksPerList (só sobe, nunca desce) ────────────────────── */
  const minimo = opcoes.tasksPerListMinimo ?? TASKS_PER_LIST_PADRAO;
  const antes = state.workspace.limits.tasksPerList;
  const depois = Math.max(antes, minimo);
  let tasksPerList: DiffDeConfiguracao["tasksPerList"];
  if (depois !== antes) {
    state.workspace.limits.tasksPerList = depois;
    recordActivity(state, {
      actor: ator,
      action: "elevarLimite",
      objectType: "workspace",
      objectId: workspaceId,
      objectName: "tasksPerList",
      before: String(antes),
      after: String(depois),
      at: agora,
    });
    tasksPerList = { antes, depois };
  }

  /* ── 4b. O Membro de serviço do "Agente do pipeline" (plano pós-auditoria, 2.2)
   *
   * Sem ele, tudo o que o agendador e a ponte gravam em nome do Papel falha
   * (`apps/api/src/persistencia/credenciais-de-servico.ts`,
   * `resolverMembroAgenteDoPipeline`). Nasce pela operação de sempre —
   * `inviteMember`, com a regra de quem convida, o limite de Membros e o
   * Registro de Atividade — e é "aceito" aqui mesmo: um Membro de serviço não
   * tem Usuário no Auth, então o aceite do convite (que ainda não é operação)
   * nunca chegaria. Fica SEM `userId` de propósito: nenhum JWT resolve para
   * ele (o hook humano casa Membro por `userId`), e quem age por ele é só o
   * próprio processo e a credencial de serviço (`member_id`). O
   * `invitedIdentity` fica: é o e-mail de serviço que impede um segundo
   * convite para o mesmo endereço. */
  let membroDeServicoCriado: Id | undefined;
  if (opcoes.membroDeServico) {
    const jaOcupado = state.members.some((m) => m.roleId === SOL.papeis.agentePipeline && m.state === "ativo");
    if (!jaOcupado) {
      const convite = inviteMember(state, actingMemberId, { email: opcoes.membroDeServico.email, roleId: SOL.papeis.agentePipeline });
      if (!convite.ok) return fail(`Não consegui criar o Membro "${NOME_DO_AGENTE_DO_PIPELINE}": ${convite.error}`);
      const membro = convite.value;
      membro.state = "ativo";
      membro.joinedAt = agora;
      membro.displayName = NOME_DO_AGENTE_DO_PIPELINE;
      recordActivity(state, {
        actor: ator,
        action: "Membro de serviço ativado",
        objectType: "member",
        objectId: membro.id,
        objectName: membro.displayName,
        before: "pendente",
        after: "ativo",
        detail: "Sem Usuário no Auth: age só pelo processo e pela credencial de serviço.",
        at: agora,
      });
      membroDeServicoCriado = membro.id;
    }
  }

  /* ── 5. Alcance do "Agente do pipeline" sobre a Lista ──────────────────
   *
   * `guestStatusWriter` (operations/tasks.ts) deixa este Convidado mudar
   * Status, mas ainda exige `memberSeesTask` — e um Convidado nunca alcança
   * contêiner por Papel (B70, `memberReachesContainer`). Sem uma concessão,
   * as rotas de integração recusam por falta de acesso, não pela regra.
   *
   * D-13 continua valendo: nada aqui nomeia um ocupante. Concede-se a quem
   * JÁ ocupa o Papel, e só isso — atribuir o Papel a alguém e rodar o
   * configurador de novo é o fluxo. `ver` na Lista basta: a linha 915 de
   * `derive.ts` abre o alvo por concessão em qualquer nó do caminho, e Tags
   * e Vencimento seguem na recusa categórica de `taskWriteRefusal`. */
  const ocupantes = state.members.filter(
    (m) => m.roleId === SOL.papeis.agentePipeline && m.state !== "removido",
  );
  const concedidos: string[] = [];
  for (const ocupante of ocupantes) {
    const jaTem = state.grants.some(
      (g) =>
        g.subjectKind === "member" &&
        g.subjectId === ocupante.id &&
        g.resourceType === "list" &&
        g.resourceId === LISTA_ID &&
        g.action === "ver",
    );
    if (jaTem) continue;
    state.grants.push({
      id: nextId("grn"),
      workspaceId,
      subjectKind: "member",
      subjectId: ocupante.id,
      action: "ver",
      resourceType: "list",
      resourceId: LISTA_ID,
      scope: "subarvore",
      origin: "concessaoDireta",
      grantedBy: actingMemberId,
      grantedAt: agora,
    });
    concedidos.push(ocupante.id);
    recordActivity(state, {
      actor: ator,
      action: "conceder",
      objectType: "list",
      objectId: LISTA_ID,
      objectName: LISTA_NOME,
      after: ocupante.displayName,
      at: agora,
    });
  }

  /* ── 6. Alcance do "Agente do pipeline" em Contas a pagar e a receber ──
   *
   * Só com `membroDeServico` (o pedido explícito do CLI). O Espaço "Gestão" é
   * privado e o Papel é Convidado: sem concessão, o Membro não vê conta
   * nenhuma. `administrar` é o que `runScheduledAutomations` exige para rodar
   * a agenda da Lista, e basta também para a ponte: ver a conta
   * (`memberSeesTask`), comentar e publicar o Resumo (a Lista libera Campos a
   * Convidado, e o Papel concede `comentar`) e mover o Status
   * (`guestStatusWriter`, `editar` restrito a Status). O Papel continua
   * Convidado: `taskWriteRefusal` segue recusando título, Vencimento, Tags e
   * os demais Campos. Pela operação de governança, com motivo e Registro —
   * nunca uma concessão silenciosa num Espaço privado (B38b). */
  const concessoesDeGovernanca: string[] = [];
  if (opcoes.membroDeServico) {
    const ocupantesAtivos = state.members.filter((m) => m.roleId === SOL.papeis.agentePipeline && m.state === "ativo");
    for (const listaId of listasDoAgenteDoPipeline()) {
      if (!state.lists.some((l) => l.id === listaId)) continue;
      for (const ocupante of ocupantesAtivos) {
        const jaTem = state.grants.some(
          (g) =>
            g.subjectKind === "member" &&
            g.subjectId === ocupante.id &&
            g.resourceType === "list" &&
            g.resourceId === listaId &&
            g.action === "administrar",
        );
        if (jaTem) continue;
        const concessao = grantGovernanceAccess(state, actingMemberId, {
          subjectKind: "member",
          subjectId: ocupante.id,
          resourceType: "list",
          resourceId: listaId,
          actions: ["administrar"],
          reason: MOTIVO_DA_CONCESSAO,
        });
        if (!concessao.ok) return fail(`Não consegui dar ao "${NOME_DO_AGENTE_DO_PIPELINE}" o alcance da Lista ${listaId}: ${concessao.error}`);
        concessoesDeGovernanca.push(`${ocupante.id}→${listaId}:administrar`);
      }
    }
  }

  return ok({
    criados,
    conferidos,
    divergentes,
    ...(concedidos.length ? { concedidos } : {}),
    ...(tasksPerList ? { tasksPerList } : {}),
    ...(membroDeServicoCriado ? { membroDeServicoCriado } : {}),
    ...(concessoesDeGovernanca.length ? { concessoesDeGovernanca } : {}),
  });
}
