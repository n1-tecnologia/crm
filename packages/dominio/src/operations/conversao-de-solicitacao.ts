/**
 * Solicitação aprovada → Conta a pagar (D3-08): a conversão dentro da
 * plataforma.
 *
 * O que morre com o critério 1 da Fase 3: hoje quem cria a Conta é
 * `payment-automation-service.ts` do `automation/`, escrevendo uma Tarefa nova
 * na Lista ClickUp `901107637383` por `legacyClickUpRaw().updateTaskStatus` e
 * `addAssignees`. Arquivada aquela Lista, a primeira Solicitação aprovada
 * depois do corte não viraria conta nenhuma — e o Financeiro reabriria o
 * ClickUp na mesma semana em que deveria ter parado. D3-08 mandou a operação
 * nascer aqui, em `packages/dominio`, porque é "o que a coisa é": uma
 * Solicitação aprovada passa a ter uma Conta correspondente.
 *
 * `convertida` deixa de ser erro **como conversão, não como quinto Status**. O
 * catálogo da Lista de Solicitações continua com os quatro Status de D-01 e a
 * Solicitação continua terminando em `aprovado`; o que marca a conversão é o
 * par que D-14 prometeu à Fase 3 — a Conta a pagar e o Vínculo estruturado —
 * mais a `provenance` da Conta. O preço verificado de um quinto Status (dois
 * arquivos de teste do domínio e a união `PaymentRequestDtoV1["status"]` do
 * contrato v1) está escrito em `packages/dominio/CONTEXT.md`, seção
 * "Solicitação aprovada → Conta a pagar".
 *
 * Este arquivo é o espelho INVERTIDO de `./importacao-contas-a-pagar.ts`. Lá
 * nenhuma Automação pode acordar: a conta é histórica e um gatilho seria
 * desastre de dados. Aqui a conta é VIVA e A9 **deve** disparar — por isso
 * `runAutomations: false` é adiamento, não desligamento: o evento
 * `tarefaCriada` é disparado à mão no fim, quando Campos e Tags já estão
 * prontos. A9 alcança a Pessoa da conta por `fromFieldDefinitionId`, e
 * disparar antes a deixaria de fora dos Observadores.
 *
 * Ao contrário das duas operações de importação, esta **está** em `OPERACOES`
 * (`./registro.ts`), portanto alcançável por
 * `POST /operacoes/converterSolicitacaoEmContaAPagar`: quem converte é um
 * Membro do Financeiro usando a interface, não um CLI.
 *
 * Nada a dispara sozinha. Ligar o gatilho ao `aprovado` mora em
 * `./tasks.ts` (na operação de mudar Status) ou num tipo de ação novo de
 * Automação, e é trabalho de quem for dono daqueles arquivos — não deste.
 *
 * Arquivo próprio, e não `./financeiro.ts`, por um motivo mecânico: a
 * conversão precisa de `runListAutomations`, que mora em `./automations.ts`,
 * e `./automations.ts` já importa de `./financeiro.ts`. Pôr a conversão lá
 * criaria o ciclo `financeiro ⇄ automations`.
 *
 * Não faz I/O nenhum: sem rede, sem disco, sem variável de ambiente
 * (`../../CONTEXT.md`, a regra de dependência).
 */

import { effectiveLifecycleOfTask, memberSeesTask, statusDefinition } from "../derive";
import { SOL } from "../solicitacao-de-pagamento";
import { LISTA_ID as LISTA_SOLICITACOES } from "../solicitacao-de-pagamento-evolver";
import { fail, ok, type DataState, type OperationResult } from "../state";
import type { FieldValue, Id, Task, TaskDate } from "../types";
import { memberActor, nextId, recordActivity } from "./activity";
import { runListAutomations } from "./automations";
import { CP } from "./financeiro";
import { createTask, setTaskFieldValue, setTaskTags } from "./tasks";

const agoraISO = (): string => new Date().toISOString();

/** O `role` do Vínculo `task→task` que liga a Solicitação à Conta gerada. */
export const PAPEL_DO_VINCULO = "conta a pagar gerada";

/**
 * Os 21 pares do de-para, na ordem A..Z do catálogo da Solicitação. O lado
 * `de` é sempre um id literal do catálogo (`../solicitacao-de-pagamento.ts`);
 * o lado `para` é sempre `CP.fields.*`, nunca a string literal do Campo de
 * Contas a pagar — uma renomeação de id do processo não pode passar por aqui
 * despercebida.
 *
 * 21 pares + 3 Campos sem equivalente + 1 vencimento nativo = os 25 Campos da
 * Solicitação. A soma é travada por teste: um 26º Campo na origem quebra o
 * teste em vez de sumir na conversão.
 */
export const DE_PARA_DE_CAMPOS: ReadonlyArray<{ readonly de: Id; readonly para: Id }> = [
  { de: "fld_sp_a_centro_de_custo", para: CP.fields.centroDeCusto },
  { de: "fld_sp_b_bu", para: CP.fields.bu },
  { de: "fld_sp_c_empresa", para: CP.fields.empresa },
  { de: "fld_sp_d_categoria_de_pagamento", para: CP.fields.categoria },
  { de: "fld_sp_e_pessoa", para: CP.fields.pessoa },
  { de: "fld_sp_f_fornecedor", para: CP.fields.fornecedor },
  { de: "fld_sp_g_cnpj", para: CP.fields.cnpj },
  { de: "fld_sp_h_cpf", para: CP.fields.cpf },
  { de: "fld_sp_i_nome_do_fornecedor", para: CP.fields.nomeFornecedor },
  { de: "fld_sp_j_anexo", para: CP.fields.anexo },
  { de: "fld_sp_k_data_de_emissao", para: CP.fields.dataEmissao },
  { de: "fld_sp_m_forma_de_pagamento", para: CP.fields.forma },
  { de: "fld_sp_n_chave_pix", para: CP.fields.chavePix },
  { de: "fld_sp_o_codigo_de_barras", para: CP.fields.codigoBarras },
  { de: "fld_sp_p_pix_copia_e_cola", para: CP.fields.pixCopiaECola },
  { de: "fld_sp_r_boleto", para: CP.fields.boleto },
  { de: "fld_sp_s_qr_code", para: CP.fields.qrCode },
  { de: "fld_sp_t_valor", para: CP.fields.valor },
  { de: "fld_sp_u_integracao_manual", para: CP.fields.integracaoManual },
  { de: "fld_sp_x_nome_do_solicitante", para: CP.fields.solicitante },
  { de: "fld_sp_z_whatsapp", para: CP.fields.whatsapp },
];

/**
 * Os três Campos da Solicitação que a Lista de Contas a pagar não representa:
 *
 * - `Link de pagamento` (`url`) — o processo de destino guarda o dado de
 *   pagamento por forma (chave Pix, código de barras, pix copia e cola), e não
 *   tem Campo de URL.
 * - `Equipe` — Campo órfão já na origem (D-08), sem uso registrado; não
 *   existe do lado de Contas a pagar por nunca ter existido no processo real.
 * - `Produto` (`multiSelect`, LACUNA-SP-Y) — o eixo de Produto vive em Contas
 *   a receber (`CR`), não em Contas a pagar.
 *
 * Preenchido na origem, cada um vira Registro `Lacuna de conversão` com o NOME
 * do Campo — nunca com o valor.
 */
export const CAMPOS_SEM_EQUIVALENTE: readonly Id[] = [
  "fld_sp_q_link_de_pagamento",
  "fld_sp_w_equipe",
  "fld_sp_y_produto",
];

/** O 25º item da soma: vira `task.dueDate` nativo, nunca um Valor de Campo (D3-04). */
export const CAMPO_DE_VENCIMENTO_DA_SOLICITACAO: Id = "fld_sp_l_data_vencimento";

/**
 * Anexo, Boleto e QR Code: Campos de tipo `file`. `setTaskFieldValue` não os
 * escreve — `file` não está no `switch` de tipos e cai no `default`, que exige
 * texto. O caminho é o de `submitForm` (`./scale.ts`): empurrar o Valor direto
 * em `task.fieldValues`, COPIANDO os ids de `WorkspaceFile`. Um objeto no
 * Storage, dois Valores apontando para ele (A8: remover o Valor nunca remove o
 * Arquivo).
 */
export const CAMPOS_DE_ARQUIVO: readonly Id[] = [
  "fld_sp_j_anexo",
  "fld_sp_r_boleto",
  "fld_sp_s_qr_code",
];

/**
 * As categorias de lacuna. Contrato herdado de D-25: a lacuna nomeia a
 * CATEGORIA e o CAMPO, nunca o valor que não coube.
 */
export type CategoriaDeLacunaDeConversao =
  | "opcao_sem_equivalente"
  | "campo_sem_equivalente"
  | "vencimento_ausente"
  | "tag_conta_ausente";

interface LacunaDeConversao {
  readonly categoria: CategoriaDeLacunaDeConversao;
  /** Nome do Campo (ou do eixo, para a Tag) — nunca o valor. */
  readonly alvo: string;
}

const ACAO_DE_LACUNA = "Lacuna de conversão";

function nomeDoCampo(state: DataState, definitionId: Id): string {
  return state.fieldDefinitions.find((d) => d.id === definitionId)?.name ?? definitionId;
}

function valorAtivo(task: Task, definitionId: Id): FieldValue["value"] | undefined {
  return task.fieldValues.find((v) => v.definitionId === definitionId && v.state === "ativo")?.value;
}

function vazio(valor: FieldValue["value"] | undefined): boolean {
  return valor === null || valor === undefined || valor === "" || (Array.isArray(valor) && valor.length === 0);
}

/**
 * A barreira de T-3-11: a Conta gerada por uma Solicitação, se existir.
 * Espelha `jaImportada` (`./importacao.ts`) e, como ele, **não filtra
 * `lifecycle`** — uma Conta enviada à lixeira continua barrando a
 * reconversão, porque o risco aqui é pagamento em dobro, não Tarefa faltando.
 *
 * É leitura derivada, não operação: não entra em `OPERACOES`.
 */
export function contaAPagarDeSolicitacao(state: DataState, solicitacaoId: Id): Task | undefined {
  return state.tasks.find(
    (t) => t.listId === CP.listId && t.provenance?.kind === "task" && t.provenance.sourceId === solicitacaoId,
  );
}

/**
 * Converte uma Solicitação aprovada em Conta a pagar. Ver o cabeçalho do
 * arquivo para o desenho completo (a ordem das guardas, a fronteira entre
 * lacuna e rollback, e por que o gatilho de Automação é adiado).
 */
export function converterSolicitacaoEmContaAPagar(
  state: DataState,
  actingMemberId: Id,
  solicitacaoId: Id,
): OperationResult<Task> {
  /* 1 — a origem precisa ser uma Solicitação aprovada que este Membro enxerga. */
  const solicitacao = state.tasks.find((t) => t.id === solicitacaoId);
  if (!solicitacao) return fail("Solicitação não encontrada.");
  if (solicitacao.listId !== LISTA_SOLICITACOES) {
    return fail("Só uma Tarefa da Lista de Solicitações de pagamento vira Conta a pagar.");
  }
  if (effectiveLifecycleOfTask(state, solicitacaoId) !== "ativo") {
    return fail("Esta Solicitação não está ativa. Restaure-a antes de convertê-la.");
  }
  if (solicitacao.statusId !== SOL.status.aprovado) {
    const atual = statusDefinition(state, solicitacao.listId, solicitacao.statusId)?.name ?? solicitacao.statusId;
    return fail(`Só uma Solicitação aprovada vira Conta a pagar; esta está em “${atual}”.`);
  }
  // T-3-12 — quem não enxerga a Solicitação não transporta o CPF e a chave Pix
  // dela para outra Lista, mesmo podendo criar Tarefa em Contas a pagar. A
  // segunda metade da guarda é o `listWriteRefusal` que `createTask` aplica.
  if (!memberSeesTask(state, actingMemberId, solicitacaoId)) {
    return fail("Você não tem acesso a esta Solicitação.");
  }

  /* 2 — T-3-11: a barreira de dupla conversão, ANTES de qualquer escrita. */
  const existente = contaAPagarDeSolicitacao(state, solicitacaoId);
  if (existente) {
    return fail(`Esta Solicitação já virou a Conta a pagar ${existente.readableId ?? existente.id}.`);
  }

  const agora = agoraISO();
  const lacunas: LacunaDeConversao[] = [];

  /* 4 — o vencimento é resolvido ANTES de criar: a Conta nasce com ele. */
  let vencimento: TaskDate | undefined = solicitacao.dueDate;
  if (!vencimento) {
    // A Solicitação carrega a data nos dois lugares (o nativo e o Campo L); o
    // nativo ganha, e a Conta recebe SÓ o nativo (D3-04).
    const bruto = valorAtivo(solicitacao, CAMPO_DE_VENCIMENTO_DA_SOLICITACAO);
    if (typeof bruto === "string" && /^\d{4}-\d{2}-\d{2}$/.test(bruto)) {
      vencimento = { form: "civilDay", value: bruto };
    }
  }
  if (!vencimento) {
    lacunas.push({ categoria: "vencimento_ausente", alvo: nomeDoCampo(state, CAMPO_DE_VENCIMENTO_DA_SOLICITACAO) });
  }

  /* 3 — tudo ou nada, no molde de `submitForm`/`./importacao.ts`. */
  const antes = {
    tasks: state.tasks.length,
    activity: state.activity.length,
    links: state.links.length,
    readable: state.workspace.taskReadableId.next,
  };
  const desfazer = (motivo: string, field?: Id): OperationResult<Task> => {
    state.tasks.splice(antes.tasks);
    state.links.splice(antes.links);
    // `recordActivity` insere no INÍCIO (`unshift`): os Registros novos estão
    // nos primeiros índices, então remove pela frente, não pelo fim.
    state.activity.splice(0, state.activity.length - antes.activity);
    state.workspace.taskReadableId.next = antes.readable;
    return fail(motivo, field);
  };

  /* 5 — a Conta nasce; nenhuma Automação a enxerga ainda. */
  const criada = createTask(
    state,
    actingMemberId,
    {
      listId: CP.listId,
      title: solicitacao.title,
      statusId: CP.status.paraPagar,
      taskTypeId: CP.taskTypeId,
      // Seção 6.1 de `docs/07-processos/contas-a-pagar.md`: a conta nasce com o
      // Financeiro como Responsável.
      assignees: [memberActor(CP.financeiroId)],
      ...(vencimento ? { dueDate: vencimento } : {}),
    },
    { runAutomations: false },
  );
  // Nada a desfazer ainda: a recusa veio antes de qualquer escrita nossa.
  if (!criada.ok) return criada;
  const conta = criada.value;

  /* 6 — o que `CreateTaskInput` não aceita, por mutação direta. */
  conta.description = solicitacao.description;
  conta.provenance = { kind: "task", sourceId: solicitacao.id, sourceName: solicitacao.title, at: agora };

  /* 7 — o laço do de-para. */
  for (const par of DE_PARA_DE_CAMPOS) {
    const valor = valorAtivo(solicitacao, par.de);
    if (vazio(valor) || valor === undefined) continue;

    if (CAMPOS_DE_ARQUIVO.includes(par.de)) {
      // Campo de arquivo: o Valor é uma lista de ids de `WorkspaceFile`, que
      // `setTaskFieldValue` não escreve. Copiar os ids — nunca reenviar.
      const ids = Array.isArray(valor) ? [...valor] : [String(valor)];
      conta.fieldValues.push({ definitionId: par.para, value: ids, state: "ativo" });
      continue;
    }

    // A FRONTEIRA que separa lacuna de rollback: recusa por a Lista destino não
    // conseguir REPRESENTAR o valor é lacuna (a conta nasce, o Financeiro vê o
    // que falta); qualquer outra recusa é rollback. Sem esta pré-conferência,
    // uma Solicitação com uma forma de pagamento que o destino não enumera não
    // geraria conta nenhuma — e o Financeiro voltaria ao ClickUp exatamente
    // pelo caso que o critério 1 quer eliminar.
    const destino = state.fieldDefinitions.find((d) => d.id === par.para);
    if (destino && (destino.type === "singleSelect" || destino.type === "multiSelect")) {
      const opcoes = destino.options ?? [];
      const escolhidos = Array.isArray(valor) ? valor.map(String) : [String(valor)];
      if (escolhidos.some((escolha) => !opcoes.includes(escolha))) {
        lacunas.push({ categoria: "opcao_sem_equivalente", alvo: nomeDoCampo(state, par.de) });
        continue;
      }
    }

    const r = setTaskFieldValue(state, actingMemberId, conta.id, par.para, valor);
    // A recusa cita o `definitionId`, nunca o valor (T-3-12b).
    if (!r.ok) return desfazer(`Campo “${par.para}”: ${r.error}`, par.para);
  }

  /* 8 — o que não tem para onde ir aparece na trilha, não some. */
  for (const orfao of CAMPOS_SEM_EQUIVALENTE) {
    if (vazio(valorAtivo(solicitacao, orfao))) continue;
    lacunas.push({ categoria: "campo_sem_equivalente", alvo: nomeDoCampo(state, orfao) });
  }

  /* 9 — a Tag `conta *` (RN-CP-07), resolvida pelo NOME. */
  const tagsDaConta: Id[] = [];
  for (const tagId of solicitacao.tagIds) {
    const origem = state.tags.find((t) => t.id === tagId);
    if (!origem || !origem.name.startsWith("conta ")) continue;
    // A Tag de mesmo nome do catálogo de Contas a pagar. Quando o Espaço de
    // Trabalho tem uma só com esse nome, ela serve aos dois lados.
    const correspondente =
      state.tags.find((t) => t.id !== origem.id && t.name === origem.name && t.lifecycle === "ativo") ??
      (origem.lifecycle === "ativo" ? origem : undefined);
    if (correspondente && !tagsDaConta.includes(correspondente.id)) tagsDaConta.push(correspondente.id);
  }
  if (tagsDaConta.length > 0) {
    const t = setTaskTags(state, actingMemberId, conta.id, tagsDaConta);
    if (!t.ok) return desfazer(t.error);
  } else {
    // RN-CP-07 exige exatamente uma Tag `conta *`, e o Agente de lançamento lê
    // essa Tag para saber de qual conta bancária o dinheiro sai.
    lacunas.push({ categoria: "tag_conta_ausente", alvo: "Tag da conta de pagamento" });
  }

  /* 10 — o Vínculo. Um só: o Vínculo é bidirecional por definição (A8). */
  state.links.push({
    id: nextId("lnk"),
    fromType: "task",
    fromId: solicitacao.id,
    toType: "task",
    toId: conta.id,
    role: PAPEL_DO_VINCULO,
    createdBy: memberActor(actingMemberId),
    createdAt: agora,
  });

  /* 11 — a trilha: os transitórios da montagem saem, os dois fatos entram. */
  state.activity.splice(0, state.activity.length - antes.activity);
  const ator = memberActor(actingMemberId);
  // T-3-13 — "de onde veio esta conta?" e "para onde foi esta solicitação?" se
  // respondem só com `state.activity`, sem ninguém precisar lembrar.
  recordActivity(state, {
    actor: ator,
    action: "Conta a pagar criada por conversão",
    objectType: "task",
    objectId: conta.id,
    objectName: conta.title,
    detail: `Solicitação ${solicitacao.readableId ?? solicitacao.id}`,
    at: agora,
  });
  recordActivity(state, {
    actor: ator,
    action: "Convertida em Conta a pagar",
    objectType: "task",
    objectId: solicitacao.id,
    objectName: solicitacao.title,
    detail: `Conta a pagar ${conta.readableId ?? conta.id}`,
    at: agora,
  });
  for (const lacuna of lacunas) {
    recordActivity(state, {
      actor: ator,
      action: ACAO_DE_LACUNA,
      objectType: "task",
      objectId: conta.id,
      objectName: conta.title,
      detail: `${lacuna.categoria}: ${lacuna.alvo}`,
      at: agora,
    });
  }

  /* 12 — SÓ AGORA a Automação enxerga a Tarefa. A9 lê o Campo Pessoa por
   * `fromFieldDefinitionId`; disparar antes do laço do de-para deixaria a
   * Pessoa de fora dos Observadores da própria conta. */
  runListAutomations(state, { kind: "tarefaCriada", taskId: conta.id });

  return ok(conta);
}
