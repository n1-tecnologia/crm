/**
 * Processo "Contas a pagar" — a parte que é código do processo e não da
 * plataforma: o Agente de lançamento e o de-para para o ERP. O resto do
 * processo (Status, Campos, Tags, Automações, permissões) é configuração,
 * montada em `seed-financeiro.ts` com as entidades da ontologia.
 *
 * O de-para (Centro de Custo, Tag) → Conta de pagamento e Categoria →
 * (Categoria Omie, Código) vivia na cabeça do usuário "ADM Tria Company".
 * Aqui ele é uma tabela: a Coleção de Conhecimento do Agente publica o mesmo
 * conteúdo em texto, e este módulo o aplica.
 */

import { agentSeesTask, contactDisplayName, effectiveLifecycleOfTask, memberSeesTask, statusDefinition } from "../derive";
import { fail, ok, type DataState, type OperationResult } from "../state";
import type { Contact, Id, Task } from "../types";
import { memberActor, nextId, recordActivity } from "./activity";
import { addMonths } from "./collaboration";
import { addTaskComment, createTask, setTaskFieldValue, trashTask, unmetRequirements } from "./tasks";

const now = (): string => new Date().toISOString();

/** Ids fixos do processo — a configuração (seed) e o código apontam para os mesmos. */
export const CP = {
  spaceId: "spc_gestao",
  folderId: "fld_financeiro",
  listId: "lst_contas_a_pagar",
  taskTypeId: "tt_conta",
  agentId: "agt_lancamento",
  financeiroId: "mem_maryane",
  aprovadorId: "mem_marcos_paulo",
  aprovadorKonqId: "mem_walter",
  fields: {
    centroDeCusto: "fd_cp_centro",
    bu: "fd_cp_bu",
    empresa: "fd_cp_empresa",
    integracaoManual: "fd_cp_integracao",
    categoria: "fd_cp_categoria",
    pessoa: "fd_cp_pessoa",
    fornecedor: "fd_cp_fornecedor",
    cnpj: "fd_cp_cnpj",
    cpf: "fd_cp_cpf",
    nomeFornecedor: "fd_cp_nome_fornecedor",
    anexo: "fd_cp_anexo",
    dataEmissao: "fd_cp_data_emissao",
    valor: "fd_cp_valor",
    forma: "fd_cp_forma",
    chavePix: "fd_cp_chave_pix",
    codigoBarras: "fd_cp_cod_barras",
    pixCopiaECola: "fd_cp_pix_copia",
    boleto: "fd_cp_boleto",
    qrCode: "fd_cp_qrcode",
    solicitante: "fd_cp_solicitante",
    whatsapp: "fd_cp_whatsapp",
  },
  status: {
    paraPagar: "st_cp_para_pagar",
    emLancamento: "st_cp_em_lancamento",
    lancado: "st_cp_lancado",
    emRemessa: "st_cp_em_remessa",
    emAutorizacao: "st_cp_em_autorizacao",
    aprovado: "st_cp_aprovado",
    negado: "st_cp_negado",
    pago: "st_cp_pago",
  },
} as const;

/** CNPJ de cada Empresa pagadora — o que a cobrança da nota pede (seção 6.2). */
export const CNPJ_POR_EMPRESA: Readonly<Record<string, string>> = {
  // Números fictícios: o protótipo não carrega o CNPJ real de ninguém.
  "Tria Company": "11.222.333/0001-81",
  "Konq Intermediações": "44.555.666/0001-72",
};

/** Tag `conta *` → Conta de pagamento no ERP. */
export const CONTA_POR_TAG: Readonly<Record<string, string>> = {
  "conta tria": "TRIA",
  "conta konq": "KONQ",
  "conta kops": "KOPS",
  "conta roberth": "ROBERTH",
  "conta auton": "AUTON",
  "conta tf tria": "TF TRIA",
  "conta arkline": "ARKLINE",
  "conta inevitaveis": "INEVITAVEIS",
};

/** Categoria de pagamento → (Categoria Omie, Código do plano de contas). */
export const CATEGORIA_OMIE: Readonly<Record<string, { readonly nome: string; readonly codigo: string }>> = {
  "Prestação de Serviços": { nome: "Prestação serviços - ADM", codigo: "2.04.08" },
  "Distribuição de Lucro": { nome: "Distribuição de lucros", codigo: "3.01.01" },
  Impostos: { nome: "Impostos e taxas", codigo: "2.06.01" },
  "Móveis e Utensílios": { nome: "Móveis e utensílios", codigo: "1.02.03" },
  Administrativo: { nome: "Despesas administrativas", codigo: "2.04.01" },
  Evento: { nome: "Eventos", codigo: "2.07.02" },
  "Contas de consumo": { nome: "Energia, água e telefone", codigo: "2.03.05" },
  "A identificar": { nome: "A classificar", codigo: "9.99.99" },
  "Cursos e treinamentos": { nome: "Treinamento e desenvolvimento", codigo: "2.08.01" },
  Comissão: { nome: "Comissões", codigo: "2.02.03" },
  "Tráfego Pago": { nome: "Mídia paga", codigo: "2.07.01" },
  Ferramentas: { nome: "Software e assinaturas", codigo: "2.05.02" },
  Insumos: { nome: "Insumos", codigo: "2.05.01" },
  "Viagens e Hospedagens": { nome: "Viagens", codigo: "2.04.05" },
  Aporte: { nome: "Aporte de capital", codigo: "3.02.01" },
  Aluguel: { nome: "Aluguel e condomínio", codigo: "2.03.01" },
  Tarifas: { nome: "Tarifas bancárias", codigo: "2.06.03" },
  "Ação Gente e Cultura": { nome: "Gente e cultura", codigo: "2.08.02" },
  "Devolução/Estorno de venda": { nome: "Devoluções", codigo: "4.01.02" },
  Editora: { nome: "Editora", codigo: "2.05.04" },
  "Correios e Transportadora": { nome: "Fretes e correios", codigo: "2.04.06" },
  Doação: { nome: "Doações", codigo: "2.09.01" },
  "Publicidade de Marca / Patrocínio": { nome: "Publicidade e patrocínio", codigo: "2.07.03" },
  Salário: { nome: "Folha de pagamento", codigo: "2.01.01" },
};

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dataBr = (iso: string | undefined): string => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");

function fieldValue(task: Task, definitionId: Id): string {
  const v = task.fieldValues.find((x) => x.definitionId === definitionId && x.state === "ativo")?.value;
  if (v === undefined || v === null) return "";
  return Array.isArray(v) ? v.join(", ") : String(v);
}

/** O que o ERP exige e, quando falta, o que o Agente pede ao Financeiro. */
export function erpMissingFields(state: DataState, task: Task): string[] {
  const nome = (id: Id) => state.fieldDefinitions.find((d) => d.id === id)?.name ?? id;
  const faltando: string[] = [];
  if (!fieldValue(task, CP.fields.centroDeCusto)) faltando.push(nome(CP.fields.centroDeCusto));
  if (!fieldValue(task, CP.fields.valor)) faltando.push(nome(CP.fields.valor));
  if (!task.dueDate) faltando.push("Data de vencimento");
  const forma = fieldValue(task, CP.fields.forma);
  if (!forma) faltando.push(nome(CP.fields.forma));
  if (forma === "Chave Pix" && !fieldValue(task, CP.fields.chavePix)) faltando.push(nome(CP.fields.chavePix));
  if (forma === "Boleto" && !fieldValue(task, CP.fields.codigoBarras)) faltando.push(nome(CP.fields.codigoBarras));
  if (forma === "QRCode Pix" && !fieldValue(task, CP.fields.pixCopiaECola)) faltando.push(nome(CP.fields.pixCopiaECola));
  const fornecedor = fieldValue(task, CP.fields.fornecedor);
  if (fornecedor === "CPF" && !fieldValue(task, CP.fields.cpf)) faltando.push(nome(CP.fields.cpf));
  if (fornecedor === "CNPJ" && !fieldValue(task, CP.fields.cnpj)) faltando.push(nome(CP.fields.cnpj));
  // O que o Status atual exige para sair (Boleto, QR Code…): lançar sem poder mover seria lançar duas vezes.
  for (const extra of unmetRequirements(state, task, statusDefinition(state, task.listId, task.statusId)?.exitRequirements ?? [])) {
    if (!faltando.includes(extra)) faltando.push(extra);
  }
  return faltando;
}

/** O "Resumo de pagamento" no formato exato que o processo já usa. */
export function buildResumoDePagamento(state: DataState, task: Task): { readonly texto: string; readonly conta: string; readonly categoria: string; readonly codigo: string } {
  const centro = fieldValue(task, CP.fields.centroDeCusto);
  const tag = task.tagIds.map((id) => state.tags.find((t) => t.id === id)?.name ?? "").find((n) => n.startsWith("conta ")) ?? "";
  const conta = CONTA_POR_TAG[tag] ?? (centro ? centro.toUpperCase() : "A DEFINIR");
  const categoriaCampo = fieldValue(task, CP.fields.categoria);
  const cat = CATEGORIA_OMIE[categoriaCampo] ?? { nome: categoriaCampo || "A classificar", codigo: "9.99.99" };
  const valor = Number(fieldValue(task, CP.fields.valor));
  const forma = fieldValue(task, CP.fields.forma);
  const dado =
    forma === "Chave Pix" ? fieldValue(task, CP.fields.chavePix) : forma === "Boleto" ? fieldValue(task, CP.fields.codigoBarras) : fieldValue(task, CP.fields.pixCopiaECola);
  const observacao = tag
    ? `Conta de Pagamento definida como "${conta}" pela Tag "${tag}" e mapeamento por Centro de Custo "${centro}". Código da categoria conforme de-para "${categoriaCampo}".`
    : `Sem Tag "conta *": Conta de Pagamento inferida do Centro de Custo "${centro}". Confirmar antes da remessa.`;
  const texto = [
    "📋 RESUMO DE PAGAMENTO",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    `O que pagar:    ${task.title}`,
    `Centro de custo: ${centro || "—"}`,
    `Conta pagamento: ${conta}`,
    `Categoria:      ${cat.nome}`,
    `Código:         ${cat.codigo}`,
    "",
    `📅 Vencimento:        ${dataBr(task.dueDate?.value)}`,
    `📅 Previsão pagto:    ${dataBr(task.dueDate?.value)}`,
    `💰 Valor:             ${Number.isFinite(valor) ? brl.format(valor) : "—"}`,
    "",
    "💳 Forma de pagamento:",
    `  • Tipo: ${forma || "—"}${dado ? `: ${dado}` : ""}`,
    "",
    `📝 Observações: ${observacao}`,
    "",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "O que é e como será utilizado. Caso hajam parcelas, especifique aqui:",
    task.description || "—",
  ].join("\n");
  return { texto, conta, categoria: cat.nome, codigo: cat.codigo };
}

/**
 * O Agente de lançamento, invocado pela Automação A7 em nome do Financeiro:
 * lê a Tarefa, publica o Resumo (resolvido) e devolve o que fez. Se faltar
 * dado, comenta o que falta — aberto, com Menção ao Financeiro — e falha, o
 * que impede a Automação de mover o Status. Tudo vira Execução de Agente.
 */
export function runLancamentoAgent(
  state: DataState,
  actingMemberId: Id,
  agentId: Id,
  taskId: Id,
  automationId: Id,
): OperationResult<string> {
  const agent = state.agents.find((a) => a.id === agentId);
  if (!agent || agent.lifecycle !== "ativo") return fail("Agente de lançamento não está ativo.");
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task || effectiveLifecycleOfTask(state, taskId) !== "ativo") return fail("Tarefa não encontrada ou inativa.");
  if (!memberSeesTask(state, actingMemberId, taskId)) return fail("Quem invoca não alcança a Tarefa.");
  // Seção 9 — o Agente só age onde tem concessão: "nada fora dela".
  if (!agentSeesTask(state, agentId, taskId)) return fail("O Agente de lançamento não tem concessão nesta Lista.");
  const version = agent.versions.at(-1);
  if (!version) return fail("Agente sem versão.");
  // Idempotente: um Resumo já publicado não se repete nem relança no ERP.
  if (task.comments.some((c) => !c.deletedAt && c.content.startsWith("📋 RESUMO DE PAGAMENTO"))) {
    return ok("Resumo de pagamento já publicado; nada a lançar.");
  }

  const execution = {
    id: nextId("exe"),
    workspaceId: state.workspace.id,
    agentId,
    agentVersion: version.number,
    state: "executando" as const,
    origin: "automacao" as const,
    invokedBy: { kind: "automation" as const, id: automationId },
    delegate: { kind: "member" as const, id: actingMemberId },
    chain: { depth: 1, visitedAgentIds: [agentId], visitedAutomationObjects: [{ automationId, objectId: taskId }] },
    anchor: { type: "task", id: taskId },
    modelId: version.modelId,
    effectiveAutonomy: version.autonomy,
    rehearsal: false,
    input: `Lançar no ERP: ${task.title}`,
    steps: [] as Array<{ index: number; kind: "ferramenta" | "raciocinio"; toolId?: string; input?: string; output?: string; result: "concluido" | "falhou"; at: string }>,
    contextComposition: { anchor: { type: "task", id: taskId, name: task.title }, readRecordIds: [taskId], fragmentRefs: [], memoryItemIds: [], chatMessageIds: [] },
    knowledgeReferences: [],
    cost: { modelUnits: 1, toolCalls: 0, childExecutions: 0, durationMs: 0 },
    startedAt: now(),
  };
  const finish = (ok_: boolean, output: string) => {
    state.agentExecutions.push({
      ...execution,
      state: ok_ ? "concluida" : "falhou",
      steps: execution.steps,
      output,
      ...(ok_ ? {} : { terminationReason: output }),
      cost: { ...execution.cost, toolCalls: execution.steps.length },
      endedAt: now(),
    });
  };

  const faltando = erpMissingFields(state, task);
  if (faltando.length > 0) {
    const texto = `Não consegui lançar no Omie: falta ${faltando.join(", ")}. Preencha e a próxima rodada tenta de novo.`;
    const r = addTaskComment(state, actingMemberId, taskId, { content: texto, mentions: [{ type: "member", id: actingMemberId }], actor: { kind: "agent", id: agentId } });
    execution.steps.push({ index: 0, kind: "ferramenta", toolId: "criar_comentario", input: "faltantes", output: r.ok ? "Comentário aberto ao Financeiro" : r.error, result: r.ok ? "concluido" : "falhou", at: now() });
    finish(false, texto);
    return fail(texto);
  }

  const resumo = buildResumoDePagamento(state, task);
  execution.steps.push({ index: 0, kind: "raciocinio", input: "de-para ERP", output: `Conta ${resumo.conta} · ${resumo.categoria} · ${resumo.codigo}`, result: "concluido", at: now() });
  const comentario = addTaskComment(state, actingMemberId, taskId, { content: resumo.texto, actor: { kind: "agent", id: agentId } });
  if (!comentario.ok) {
    execution.steps.push({ index: 1, kind: "ferramenta", toolId: "criar_comentario", output: comentario.error, result: "falhou", at: now() });
    finish(false, comentario.error);
    return fail(comentario.error);
  }
  // O Resumo nasce resolvido: é registro, não pergunta. Quem o resolve é o próprio Agente.
  comentario.value.resolved = { by: agentId, at: now() };
  execution.steps.push({ index: 1, kind: "ferramenta", toolId: "criar_comentario", output: "Resumo de pagamento publicado e resolvido", result: "concluido", at: now() });
  execution.steps.push({ index: 2, kind: "ferramenta", toolId: "omie_lancar_conta_a_pagar", input: `${resumo.conta} · ${resumo.codigo}`, output: "Lançamento simulado (Integração ERP do protótipo)", result: "concluido", at: now() });
  finish(true, `Lançado: ${resumo.conta} · ${resumo.categoria} (${resumo.codigo})`);
  recordActivity(state, {
    actor: { kind: "agent", id: agentId },
    action: "Resumo de pagamento publicado",
    objectType: "task",
    objectId: task.id,
    objectName: task.title,
    detail: `${resumo.conta} · ${resumo.categoria} · ${resumo.codigo}`,
  });
  return ok(`Resumo publicado: ${resumo.conta} · ${resumo.categoria} (${resumo.codigo})`);
}

/**
 * INV-CP-01 — uma conta no caminho do ERP (`lançado omie`, `em remessa`) tem
 * Resumo ou Integração manual. Quem pulou o ERP (seção 6.4: para pagar →
 * autorização → pago) não deve nada ao Omie e não é apontada.
 */
export function contaSemResumo(state: DataState, task: Task): boolean {
  if (task.listId !== CP.listId) return false;
  const ordem: readonly string[] = [CP.status.lancado, CP.status.emRemessa];
  if (!ordem.includes(task.statusId)) return false;
  if (fieldValue(task, CP.fields.integracaoManual) === "Manual") return false;
  return !task.comments.some((c) => !c.deletedAt && c.content.startsWith("📋 RESUMO DE PAGAMENTO"));
}

/* ═══════════════════════════ Contas a receber ═══════════════════════════ */

/**
 * Processo "Contas a receber" (`docs/07-processos/contas-a-receber.md`): a
 * Lista irmã na mesma Pasta. Compartilha com Contas a pagar o Tipo "Conta",
 * o Valor (na Pasta) e os Campos do Espaço; o que é só dela está em `CR`.
 * O cliente é um Contato do CRM, ligado por Vínculo (decisão da seção 12).
 */
export const CR = {
  listId: "lst_contas_a_receber",
  /** Comercial / relacionamento: dona dos registros de cliente no CRM. */
  comercialId: "mem_julia",
  fields: {
    produto: "fd_gst_produto",
    dataPagamento: "fd_cr_data_pagamento",
    numeroParcela: "fd_cr_numero_parcela",
    totalParcelas: "fd_cr_total_parcelas",
    tipo: "fd_cr_tipo",
    forma: "fd_cr_forma",
    situacao: "fd_cr_situacao",
    contaRecebimento: "fd_cr_conta",
  },
  status: {
    paraReceber: "st_cr_para_receber",
    disponivelSaque: "st_cr_disponivel_saque",
    pendente: "st_cr_pendente",
    estornado: "st_cr_estornado",
    descartado: "st_cr_descartado",
    recebido: "st_cr_recebido",
  },
  tipos: { entrada: "Entrada", parcela: "Parcela", saque: "Saque de plataforma", avulso: "Avulso" },
  situacoes: { emDia: "em dia", emCobranca: "em cobrança", inadimplente: "inadimplente" },
  /** Papel do Vínculo Tarefa → Contato. */
  linkRole: "cliente",
} as const;

/** O Contato do CRM que deve esta conta (RN-CR-02). */
export function clienteDe(state: DataState, task: Task): Contact | undefined {
  const link = state.links.find((l) => l.fromType === "task" && l.fromId === task.id && l.toType === "contact");
  return link ? state.contacts.find((c) => c.id === link.toId) : undefined;
}

/** RN-CR-02 — Entrada ou Parcela sem cliente: a soma por cliente fica errada. */
export function contaSemCliente(state: DataState, task: Task): boolean {
  if (task.listId !== CR.listId) return false;
  const tipo = fieldValue(task, CR.fields.tipo);
  if (tipo !== CR.tipos.entrada && tipo !== CR.tipos.parcela) return false;
  return clienteDe(state, task) === undefined;
}

/** RN-CR-07 — (cliente, Tipo, Número da parcela) é único entre as contas ativas. */
export function parcelaDuplicada(state: DataState, task: Task): Task | undefined {
  if (task.listId !== CR.listId) return undefined;
  const cliente = clienteDe(state, task);
  const tipo = fieldValue(task, CR.fields.tipo);
  if (!cliente || !tipo) return undefined;
  const numero = fieldValue(task, CR.fields.numeroParcela);
  return state.tasks.find(
    (t) =>
      t.id !== task.id &&
      t.listId === CR.listId &&
      effectiveLifecycleOfTask(state, t.id) === "ativo" &&
      fieldValue(t, CR.fields.tipo) === tipo &&
      fieldValue(t, CR.fields.numeroParcela) === numero &&
      clienteDe(state, t)?.id === cliente.id,
  );
}

export interface ReceivableSeriesInput {
  readonly contactId: Id;
  readonly centroDeCusto: string;
  readonly empresa?: string;
  readonly produto?: string;
  readonly forma?: string;
  /** Entrada: valor e vencimento; sem valor, a série começa na 1ª parcela. */
  readonly valorEntrada?: number;
  readonly vencimentoEntrada?: string;
  readonly valorParcela: number;
  readonly parcelas: number;
  /** Dia civil `AAAA-MM-DD` da 1ª parcela; as seguintes vencem no mesmo dia dos meses seguintes. */
  readonly primeiroVencimento: string;
}

const civil = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parseCivil = (value: string): Date | undefined => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  const date = new Date(y, m - 1, d);
  // 2026-13-45 "existe" para o Date (vira 2027-02-14); aqui não.
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : undefined;
};

/**
 * R1 sem Gestão contratual: a série "Entrada + N parcelas" criada de uma vez,
 * como o Financeiro fazia à mão (seção 5). Cada conta passa por `createTask`
 * (alcance, Tipo, Status inicial) e ganha Vínculo com o cliente. Uma recusa
 * no meio desfaz o que já nasceu — meia série é pior que nenhuma.
 */
export function createReceivableSeries(state: DataState, actingMemberId: Id, input: ReceivableSeriesInput): OperationResult<Task[]> {
  const contact = state.contacts.find((c) => c.id === input.contactId);
  if (!contact || contact.lifecycle !== "ativo") return fail("Escolha um Contato ativo do CRM como cliente.", "contactId");
  if (!input.centroDeCusto.trim()) return fail("Centro de Custo é obrigatório (RN-CR-01).", "centroDeCusto");
  if (!Number.isInteger(input.parcelas) || input.parcelas < 1 || input.parcelas > 60) return fail("Informe de 1 a 60 parcelas.", "parcelas");
  if (!(input.valorParcela > 0)) return fail("O valor da parcela precisa ser maior que zero.", "valorParcela");
  if (input.valorEntrada !== undefined && !(input.valorEntrada > 0)) return fail("O valor da entrada precisa ser maior que zero, ou fique em branco.", "valorEntrada");
  const primeiro = parseCivil(input.primeiroVencimento);
  if (!primeiro) return fail("Informe o vencimento da 1ª parcela.", "primeiroVencimento");
  const vencimentoEntrada = input.valorEntrada !== undefined ? parseCivil(input.vencimentoEntrada ?? "") : undefined;
  if (input.valorEntrada !== undefined && !vencimentoEntrada) return fail("Informe o vencimento da entrada.", "vencimentoEntrada");
  const nome = contactDisplayName(contact);

  // RN-CR-07 antes de criar: uma série sobre outra faria a soma do cliente dobrar.
  const existentes = state.tasks.filter((t) => t.listId === CR.listId && effectiveLifecycleOfTask(state, t.id) === "ativo" && clienteDe(state, t)?.id === contact.id);
  const numeros = new Set(existentes.filter((t) => fieldValue(t, CR.fields.tipo) === CR.tipos.parcela).map((t) => fieldValue(t, CR.fields.numeroParcela)));
  if (input.valorEntrada !== undefined && existentes.some((t) => fieldValue(t, CR.fields.tipo) === CR.tipos.entrada)) {
    return fail(`${nome} já tem uma Entrada em aberto ou recebida nesta Lista (RN-CR-07).`, "contactId");
  }
  for (let n = 1; n <= input.parcelas; n += 1) {
    if (numeros.has(String(n))) return fail(`${nome} já tem a ${n}ª Parcela nesta Lista (RN-CR-07). Descarte a série antiga antes de criar outra.`, "contactId");
  }

  const criadas: Task[] = [];
  const desfazer = (motivo: string): OperationResult<Task[]> => {
    // Meia série é pior que nenhuma: as contas vão para a lixeira e o Vínculo
    // e a concessão que nasceram com elas somem junto.
    for (const t of criadas) {
      trashTask(state, actingMemberId, t.id);
      state.links = state.links.filter((l) => !(l.fromType === "task" && l.fromId === t.id));
      state.grants = state.grants.filter((g) => !(g.resourceType === "task" && g.resourceId === t.id));
    }
    return fail(motivo);
  };
  const comuns: Array<[Id, string | number]> = [
    [CP.fields.centroDeCusto, input.centroDeCusto],
    ...(input.empresa ? ([[CP.fields.empresa, input.empresa]] as Array<[Id, string]>) : []),
    ...(input.forma ? ([[CR.fields.forma, input.forma]] as Array<[Id, string]>) : []),
    [CR.fields.situacao, CR.situacoes.emDia],
    [CR.fields.totalParcelas, input.parcelas],
  ];
  const nascer = (title: string, tipo: string, valor: number, due: Date, numero?: number): string | undefined => {
    const r = createTask(state, actingMemberId, { listId: CR.listId, title, taskTypeId: CP.taskTypeId, assignees: [memberActor(CP.financeiroId)], dueDate: { form: "civilDay", value: civil(due) } });
    if (!r.ok) return r.error;
    criadas.push(r.value);
    const valores: Array<[Id, string | number | string[]]> = [
      ...comuns,
      [CP.fields.valor, valor],
      [CR.fields.tipo, tipo],
      ...(numero !== undefined ? ([[CR.fields.numeroParcela, numero]] as Array<[Id, number]>) : []),
      ...(input.produto ? ([[CR.fields.produto, [input.produto]]] as Array<[Id, string[]]>) : []),
    ];
    for (const [definitionId, value] of valores) {
      const f = setTaskFieldValue(state, actingMemberId, r.value.id, definitionId, value);
      if (!f.ok) return f.error;
    }
    state.links.push({ id: nextId("lnk"), fromType: "task", fromId: r.value.id, toType: "contact", toId: contact.id, role: CR.linkRole, createdBy: memberActor(actingMemberId), createdAt: now() });
    // Seção 10 — o dono do cliente no CRM vê e comenta as contas dos seus clientes, e só elas.
    state.grants.push({ id: nextId("gr"), workspaceId: state.workspace.id, subjectKind: "member", subjectId: contact.ownerMemberId, action: "comentar", resourceType: "task", resourceId: r.value.id, scope: "subarvore", origin: "concessaoDireta", grantedBy: actingMemberId, grantedAt: now() });
    return undefined;
  };
  if (input.valorEntrada !== undefined && vencimentoEntrada) {
    const erro = nascer(`Entrada – ${nome}`, CR.tipos.entrada, input.valorEntrada, vencimentoEntrada);
    if (erro) return desfazer(erro);
  }
  for (let n = 1; n <= input.parcelas; n += 1) {
    const due = new Date(primeiro.getTime());
    addMonths(due, n - 1);
    const erro = nascer(`${n}ª Parcela – ${nome}`, CR.tipos.parcela, input.valorParcela, due, n);
    if (erro) return desfazer(erro);
  }
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Série de parcelas criada",
    objectType: "list",
    objectId: CR.listId,
    objectName: "Contas a receber",
    detail: `${nome}: ${input.valorEntrada !== undefined ? "entrada + " : ""}${input.parcelas} parcela(s) de ${brl.format(input.valorParcela)}`,
  });
  return ok(criadas);
}
