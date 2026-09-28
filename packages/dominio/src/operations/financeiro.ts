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
import type { AgentExecution, Contact, Id, Task } from "../types";
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

/* ═══════════════ O de-para chega por parâmetro (D3-02/D3-03) ═══════════════
 *
 * As três tabelas acima foram inventadas para o protótipo. O de-para de
 * verdade já existe e está em produção (`conciliador_contas_pagar_tria`,
 * D3-02), num outro projeto Supabase (DEC-08/OQ-SYN-03) — alcançado por HTTP,
 * nunca por JOIN. Gerar um segundo de-para aqui criaria uma cópia que diverge
 * no dia em que alguém mexer no plano de contas do Omie.
 *
 * Por isso o domínio **recebe** o de-para e nunca o busca: quem lê a fonte é
 * a rota nova do `automation/` (03-07) e a ponte do `apps/api` (03-11). Os
 * tipos abaixo são a FORMA desse recebimento — o contrato entre os três.
 */

/** Como o de-para diz "não tenho confiança suficiente" (corte: `CATEGORY_MIN_SIMILARITY`). */
export type VereditoDeCategoria = "resolvida" | "revisar";

/** O que o RESUMO conclui — `"ausente"` é a chave que não veio no de-para recebido. */
export type VereditoDoResumo = VereditoDeCategoria | "ausente";

/**
 * Obrigatório, nunca opcional (T-3-07): um lançamento real feito com a tabela
 * fictícia do protótipo tem que ser visível na Execução, não silencioso.
 */
export type OrigemDoDePara = "prototipo" | "omie";

/**
 * A classificação de UMA Categoria, discriminada por `veredito` — o mesmo
 * padrão de `ApprovalRequest.origin`/`ExecutionStep.kind`. No ramo `"revisar"`
 * a `similaridade` e o `motivo` são obrigatórios: não se manda uma conta para
 * revisão humana sem dizer por quê e sem o número que motivou.
 */
export type ResolucaoDeCategoria =
  | { readonly veredito: "resolvida"; readonly nome: string; readonly codigo: string; readonly similaridade?: number }
  | { readonly veredito: "revisar"; readonly nome: string; readonly codigo: string; readonly similaridade: number; readonly motivo: string };

/**
 * O de-para resolvido que `buildResumoDePagamento` e `runLancamentoAgent`
 * recebem. Um dicionário de UMA entrada é um dicionário válido, e é o caso
 * normal: 03-07 resolve só a Categoria da Tarefa em questão, em vez de
 * despejar o plano de contas inteiro a cada lançamento.
 */
export interface DeParaDeLancamento {
  /** Chave = nome da Tag `conta *`, em minúsculas (as mesmas de `CONTA_POR_TAG`). */
  readonly contaPorTag: Readonly<Record<string, string>>;
  /** Chave = valor do Campo "Categoria de pagamento" (`CP.fields.categoria`). */
  readonly categoriaPorCampo: Readonly<Record<string, ResolucaoDeCategoria>>;
  readonly origem: OrigemDoDePara;
}

/**
 * O de-para do protótipo, montado das duas tabelas acima — é o padrão do
 * parâmetro, o que mantém o comportamento de hoje idêntico para quem não
 * passa nada. A origem "protótipo" é o que o torna legível na `AgentExecution`.
 */
export const DE_PARA_DO_PROTOTIPO: DeParaDeLancamento = {
  contaPorTag: CONTA_POR_TAG,
  categoriaPorCampo: Object.fromEntries(
    Object.entries(CATEGORIA_OMIE).map(([campo, { nome, codigo }]): [string, ResolucaoDeCategoria] => [campo, { veredito: "resolvida", nome, codigo }]),
  ),
  origem: "prototipo",
};

/** O que a metade que DECIDE devolve à metade que EXECUTA. */
export interface ResumoDePagamento {
  readonly texto: string;
  readonly conta: string;
  readonly categoria: string;
  readonly codigo: string;
  readonly veredito: VereditoDoResumo;
  readonly origem: OrigemDoDePara;
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dataBr = (iso: string | undefined): string => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");

function fieldValue(task: Task, definitionId: Id): string {
  const v = task.fieldValues.find((x) => x.definitionId === definitionId && x.state === "ativo")?.value;
  if (v === undefined || v === null) return "";
  return Array.isArray(v) ? v.join(", ") : String(v);
}

/**
 * O que o ERP exige e, quando falta, o que o Agente pede ao Financeiro.
 *
 * É a MESMA lista que a saída de "para pagar" exige (`seed-financeiro.ts`,
 * `dadoDePagamento`), e é a única que a ponte do `apps/api` consulta antes de
 * chamar o Omie (plano pós-auditoria, 2.1): a tela que recusa mover a conta e
 * o Agente que recusa lançá-la falam da mesma coisa, com as mesmas palavras.
 * Categoria, Fornecedor (CPF/CNPJ), o documento e o Nome do fornecedor entram
 * porque o `/lancar` do `automation/` procura ou cadastra o fornecedor no
 * Omie antes de incluir o título — sem eles o Omie recusa, e a recusa chega
 * tarde, depois de a conta já ter saído de "para pagar".
 */
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
  if (!fieldValue(task, CP.fields.categoria)) faltando.push(nome(CP.fields.categoria));
  // O tipo do fornecedor decide qual documento o Omie recebe: sem ele não há
  // documento a conferir, e presumir CNPJ seria inventar dado.
  const fornecedor = fieldValue(task, CP.fields.fornecedor);
  if (!fornecedor) faltando.push(nome(CP.fields.fornecedor));
  if (fornecedor === "CPF" && !fieldValue(task, CP.fields.cpf)) faltando.push(nome(CP.fields.cpf));
  if (fornecedor === "CNPJ" && !fieldValue(task, CP.fields.cnpj)) faltando.push(nome(CP.fields.cnpj));
  if (!fieldValue(task, CP.fields.nomeFornecedor)) faltando.push(nome(CP.fields.nomeFornecedor));
  // O que o Status atual exige para sair (Boleto, QR Code…): lançar sem poder mover seria lançar duas vezes.
  for (const extra of unmetRequirements(state, task, statusDefinition(state, task.listId, task.statusId)?.exitRequirements ?? [])) {
    if (!faltando.includes(extra)) faltando.push(extra);
  }
  return faltando;
}

/**
 * O "Resumo de pagamento" no formato exato que o processo já usa (CON-CP-08),
 * travado byte a byte por `agente-de-lancamento.test.ts`.
 *
 * O de-para é o terceiro parâmetro, opcional no fim: quem não passa nada
 * continua com o do protótipo, e nenhum chamador existente muda de aridade.
 * Os dois fallbacks são regra de RENDERIZAÇÃO, não de-para — por isso ficam
 * aqui mesmo quando a resolução é fraca: quem formata tolera, quem executa
 * (`runLancamentoAgent`) recusa.
 */
export function buildResumoDePagamento(state: DataState, task: Task, dePara: DeParaDeLancamento = DE_PARA_DO_PROTOTIPO): ResumoDePagamento {
  const centro = fieldValue(task, CP.fields.centroDeCusto);
  const tag = task.tagIds.map((id) => state.tags.find((t) => t.id === id)?.name ?? "").find((n) => n.startsWith("conta ")) ?? "";
  const conta = dePara.contaPorTag[tag] ?? (centro ? centro.toUpperCase() : "A DEFINIR");
  const categoriaCampo = fieldValue(task, CP.fields.categoria);
  const resolucao = dePara.categoriaPorCampo[categoriaCampo];
  const cat = resolucao ?? { nome: categoriaCampo || "A classificar", codigo: "9.99.99" };
  const veredito: VereditoDoResumo = resolucao ? resolucao.veredito : "ausente";
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
  return { texto, conta, categoria: cat.nome, codigo: cat.codigo, veredito, origem: dePara.origem };
}

/* ═══════ A conferência do Ensaio: o par escritor/leitor do de-para (D3-03) ═══════
 *
 * `runLancamentoAgent` grava o passo de raciocínio do de-para como DUAS
 * strings soltas em `ExecutionStep` (`input`/`output`) — não há campo
 * estruturado para a tripla conta/categoria/código em `AgentExecution`
 * (B18/`types/ai.ts`). `descreverPassoDeDePara` e `lerPassoDeDePara` vivem
 * lado a lado de propósito: o formato é de 03-04, e a garantia contra deriva
 * entre quem escreve e quem lê é o caso (a) de `ensaio-do-agente.test.ts`
 * (que chama `runLancamentoAgent` de verdade e lê o resultado de volta) —
 * não a disciplina de quem editar este arquivo depois.
 */

/** As duas strings exatas que `runLancamentoAgent` grava em `steps[0]`. */
export function descreverPassoDeDePara(resumo: ResumoDePagamento, origem: OrigemDoDePara): { readonly input: string; readonly output: string } {
  return { input: `de-para ERP (${origem})`, output: `Conta ${resumo.conta} · ${resumo.categoria} · ${resumo.codigo}` };
}

const ORIGENS_DO_DEPARA: readonly OrigemDoDePara[] = ["prototipo", "omie"];

/**
 * O inverso de `descreverPassoDeDePara`. Qualquer desvio de forma — segmentos
 * a mais ou a menos, prefixo `"Conta "` ausente, origem fora do vocabulário —
 * devolve `undefined`, nunca um palpite: um relatório que decide sobre
 * dinheiro não adivinha o formato de quem escreveu.
 */
export function lerPassoDeDePara(
  passo: { readonly input?: string; readonly output?: string } | undefined,
): { readonly conta: string; readonly categoria: string; readonly codigo: string; readonly origem: OrigemDoDePara } | undefined {
  if (!passo?.input || !passo.output) return undefined;
  const partes = passo.output.split(" · ");
  if (partes.length !== 3) return undefined;
  const [contaBruta, categoria, codigo] = partes;
  if (contaBruta === undefined || categoria === undefined || codigo === undefined) return undefined;
  if (!contaBruta.startsWith("Conta ")) return undefined;
  const conta = contaBruta.slice("Conta ".length);
  if (!conta || !categoria || !codigo) return undefined;
  const origem = /\(([^)]+)\)/.exec(passo.input)?.[1];
  if (!origem || !ORIGENS_DO_DEPARA.includes(origem as OrigemDoDePara)) return undefined;
  return { conta, categoria, codigo, origem: origem as OrigemDoDePara };
}

/**
 * Como se invoca o Agente com o de-para de verdade e/ou em Ensaio. `dePara` é
 * obrigatório de propósito (T-3-07): não se liga o Ensaio sem dizer contra
 * qual de-para se ensaiou — meia especificação é a porta do default silencioso.
 */
export interface OpcoesDeLancamento {
  readonly dePara: DeParaDeLancamento;
  /** B82 — `true`: o Agente calcula e registra o que lançaria, sem escrever na Tarefa. */
  readonly rehearsal?: boolean;
}

/**
 * O Agente de lançamento, invocado pela Automação A7 em nome do Financeiro:
 * lê a Tarefa, publica o Resumo (resolvido) e devolve o que fez. Se faltar
 * dado, comenta o que falta — aberto, com Menção ao Financeiro — e falha, o
 * que impede a Automação de mover o Status. Tudo vira Execução de Agente.
 *
 * Duas coisas acontecem quando `opcoes` chega:
 *
 * - **Ensaio** (`rehearsal: true`, D3-03): o Agente passa a primeira semana
 *   calculando em voz alta. Nenhum Comentário nasce, nenhum Status muda,
 *   nenhum Registro de Atividade é gravado — a única linha nova no estado é a
 *   `AgentExecution` de sombra, que 03-14 compara com o que o humano lançou.
 * - **Recusa por confiança** (T-3-10): um `veredito` que não seja `"resolvida"`
 *   devolve `fail`, e `execute` (`automations.ts`) interrompe o laço de ações
 *   — é assim que A8 não move a conta para "lançado omie". A conta vai para
 *   revisão humana em vez de ser lançada com a categoria errada.
 */
export function runLancamentoAgent(
  state: DataState,
  actingMemberId: Id,
  agentId: Id,
  taskId: Id,
  automationId: Id,
  opcoes?: OpcoesDeLancamento,
): OperationResult<string> {
  const dePara = opcoes?.dePara ?? DE_PARA_DO_PROTOTIPO;
  const ensaio = opcoes?.rehearsal === true;
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
  // Uma Tarefa tem UM registro de sombra — é o que o relatório de 03-14
  // compara. A guarda só vale no Ensaio: um lançamento real depois da semana
  // de sombra não pode ser bloqueado pelo próprio ensaio.
  if (ensaio && state.agentExecutions.some((e) => e.agentId === agentId && e.anchor?.id === taskId && e.rehearsal && e.state === "concluida")) {
    return ok("Ensaio já registrado para esta conta; nada a recalcular.");
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
    rehearsal: ensaio,
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

  /**
   * Toda recusa do Agente é a mesma coisa: um pedido ABERTO ao Financeiro,
   * com Menção, e uma Execução que falhou — o que faz `execute` interromper
   * o laço de ações e A8 não mover o Status. No Ensaio o pedido não vira
   * Comentário (o Agente não encosta na Tarefa): vira passo de raciocínio.
   */
  const recusar = (index: number, rotulo: string, texto: string): OperationResult<string> => {
    if (ensaio) {
      execution.steps.push({ index, kind: "raciocinio", input: rotulo, output: `Ensaio — pediria ao Financeiro: ${texto}`, result: "falhou", at: now() });
    } else {
      const r = addTaskComment(state, actingMemberId, taskId, { content: texto, mentions: [{ type: "member", id: actingMemberId }], actor: { kind: "agent", id: agentId } });
      execution.steps.push({ index, kind: "ferramenta", toolId: "criar_comentario", input: rotulo, output: r.ok ? "Comentário aberto ao Financeiro" : r.error, result: r.ok ? "concluido" : "falhou", at: now() });
    }
    finish(false, texto);
    return fail(texto);
  };

  const faltando = erpMissingFields(state, task);
  if (faltando.length > 0) {
    return recusar(0, "faltantes", `Não consegui lançar no Omie: falta ${faltando.join(", ")}. Preencha e a próxima rodada tenta de novo.`);
  }

  const resumo = buildResumoDePagamento(state, task, dePara);
  execution.steps.push({ index: 0, kind: "raciocinio", ...descreverPassoDeDePara(resumo, dePara.origem), result: "concluido", at: now() });

  // T-3-10 — quem formata tolera, quem executa recusa: uma classificação que
  // não passou do corte de confiança (ou que o de-para nem trouxe) vai para
  // revisão humana. Lançar "A classificar" no Omie real é pior que não lançar.
  if (resumo.veredito !== "resolvida") {
    const categoriaCampo = fieldValue(task, CP.fields.categoria);
    const resolucao = dePara.categoriaPorCampo[categoriaCampo];
    const texto =
      resolucao && resolucao.veredito === "revisar"
        ? `Não lancei no Omie: a Categoria "${categoriaCampo}" resolveu para "${resolucao.nome}" (${resolucao.codigo}) com similaridade ${resolucao.similaridade.toFixed(2).replace(".", ",")}, abaixo do corte de confiança — ${resolucao.motivo}. Confirme a categoria e a próxima rodada tenta de novo.`
        : `Não lancei no Omie: o de-para não trouxe a Categoria "${categoriaCampo}". A conta fica parada até alguém classificá-la.`;
    return recusar(1, "categoria sem confiança", texto);
  }

  if (ensaio) {
    // D3-03 é mais estrito que o Ensaio da Fase 2 (02-27, onde os dois
    // caminhos escreviam): aqui a única linha nova no estado é esta Execução.
    //
    // T-3-09 — o que fica gravado é a TRIPLA (conta/categoria/código), nunca
    // `resumo.texto`: o RESUMO carrega chave Pix, código de barras e valor, e
    // a página de Execução tem alcance diferente do da Lista de Contas a
    // pagar. A tripla é o que 03-14 mede, e é determinística a partir da
    // Tarefa — guardar só ela basta e é estritamente mais seguro. Não
    // "corrigir" isto gravando o texto completo depois.
    const dito = `Ensaio — lançaria: ${resumo.conta} · ${resumo.categoria} (${resumo.codigo})`;
    finish(true, dito);
    return ok(dito);
  }
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

/* ═══════ A conferência do Ensaio: onde o humano responde (D3-03) ═══════
 *
 * O Agente, em Ensaio, deixa rastro estruturado (`AgentExecution` acima). O
 * humano lança à mão dentro do Omie e não deixa rastro nenhum — a menos que
 * diga. Este bloco decide onde ele diz: um Comentário de prefixo fixo, no
 * molde exato de `PREFIXO_MOTIVO_FLUXO_MANUAL` (`fluxo-manual-dialog.tsx`).
 *
 * A junção com a Tarefa é pelo id dela — nunca por (fornecedor, vencimento,
 * valor): um lançamento manual no Omie não carrega
 * `codigo_lancamento_integracao`, e um relatório que decide sobre dinheiro
 * não se apoia numa junção aproximada.
 */

/**
 * O registro do lançamento feito à mão pelo Financeiro durante o Ensaio de
 * D3-03 — o lado humano da comparação que 03-14 mede contra o Ensaio do
 * Agente. O prefixo é contrato entre `apps/web` (escreve, por
 * `textoDoLancamentoHumano`) e `apps/api` (lê, por `lancamentoHumanoDe`),
 * sem que nenhum dos dois conheça o outro.
 */
export const PREFIXO_LANCAMENTO_HUMANO = "Lançado no Omie: ";

export interface LancamentoHumano {
  readonly conta: string;
  readonly categoria: string;
  readonly codigo: string;
  readonly por: Id;
  readonly em: string;
}

/**
 * A MESMA forma do `output` de `descreverPassoDeDePara` — os dois lados são
 * lidos pelo mesmo separador (`lerPassoDeDePara`). Nada além dos três campos
 * entra no texto: sem valor, sem fornecedor, sem chave Pix, sem código de
 * barras (T-3-66) — nem como opcional.
 */
export function textoDoLancamentoHumano(l: { readonly conta: string; readonly categoria: string; readonly codigo: string }): string {
  return `${PREFIXO_LANCAMENTO_HUMANO}Conta ${l.conta} · ${l.categoria} · ${l.codigo}`;
}

/**
 * O Comentário de registro mais recente publicado por um MEMBRO — nunca por
 * um Agente ou automação (T-3-70): um Comentário com o mesmo prefixo
 * publicado com `actor: { kind: "agent" }` é ignorado por construção, não
 * por convenção.
 */
export function lancamentoHumanoDe(state: DataState, task: Task): LancamentoHumano | undefined {
  const comentario = [...task.comments]
    .filter((c) => !c.deletedAt && c.content.startsWith(PREFIXO_LANCAMENTO_HUMANO) && c.author.kind === "member")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!comentario) return undefined;
  const lido = lerPassoDeDePara({ input: "de-para ERP (omie)", output: comentario.content.slice(PREFIXO_LANCAMENTO_HUMANO.length) });
  if (!lido) return undefined;
  return { conta: lido.conta, categoria: lido.categoria, codigo: lido.codigo, por: comentario.author.id, em: comentario.createdAt };
}

/** O vocabulário fechado da conferência — oito vereditos, quatro deles nem acerto nem erro. */
export type VereditoDaConferencia =
  | "confere"
  | "diverge_categoria"
  | "diverge_conta"
  | "diverge_ambos"
  | "recusa_correta"
  | "sem_ensaio"
  | "sem_lancamento_humano"
  | "nao_medivel";

/**
 * As triplas viajam no resultado porque o relatório detalhado (fora do git,
 * `conferencia-detalhada.csv`) as usa; o relatório versionado NÃO as imprime
 * individualmente (T-3-65).
 */
export interface ResultadoDaConferencia {
  readonly taskId: Id;
  readonly veredito: VereditoDaConferencia;
  readonly semTagDeConta: boolean;
  readonly nomeDaCategoriaDiverge: boolean;
  readonly origem?: OrigemDoDePara;
  readonly agente?: { readonly conta: string; readonly categoria: string; readonly codigo: string };
  readonly humano?: { readonly conta: string; readonly categoria: string; readonly codigo: string };
}

/** A `AgentExecution` de sombra da conta — a mais recente por `startedAt` (uma por Tarefa, por desenho de 03-04). */
export function ensaioDaConta(state: DataState, taskId: Id): AgentExecution | undefined {
  return [...state.agentExecutions].filter((e) => e.rehearsal === true && e.anchor?.id === taskId).sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
}

/** Verdadeiro quando nenhuma Tag da Tarefa nomeia a conta — a mesma condição que `buildResumoDePagamento` usa para a segunda frase do `observacao`. */
function semTagDeContaEm(state: DataState, task: Task): boolean {
  return !task.tagIds.some((id) => (state.tags.find((t) => t.id === id)?.name ?? "").startsWith("conta "));
}

/**
 * A regra de acerto — mora no domínio (`./CONTEXT.md` na raiz) porque o que
 * conta como acerto é regra de negócio, não regra de relatório. `apps/api`
 * só agrega e imprime; quem decide é esta função.
 *
 * Ordem de precedência (ela própria a regra): (1) sem Ensaio e sem registro
 * humano ⇒ `undefined` — a Tarefa não entra na amostra; (2) Ensaio que
 * terminou `falhou` ⇒ `recusa_correta`, mesmo havendo registro humano — o
 * Agente se calou, e calar-se é o resultado correto; (3) Ensaio ilegível por
 * `lerPassoDeDePara` ou com `origem: "prototipo"` ⇒ `nao_medivel` — medir a
 * tabela fictícia contra o Omie real não prova nada; (4) falta um dos lados
 * ⇒ `sem_ensaio` / `sem_lancamento_humano`; (5) comparar.
 */
export function compararEnsaio(state: DataState, task: Task): ResultadoDaConferencia | undefined {
  const ensaio = ensaioDaConta(state, task.id);
  const humano = lancamentoHumanoDe(state, task);
  const semTag = semTagDeContaEm(state, task);
  const humanoResultado = humano ? { conta: humano.conta, categoria: humano.categoria, codigo: humano.codigo } : undefined;

  if (!ensaio && !humano) return undefined;

  if (ensaio?.state === "falhou") {
    return { taskId: task.id, veredito: "recusa_correta", semTagDeConta: semTag, nomeDaCategoriaDiverge: false, humano: humanoResultado };
  }

  const passo = ensaio ? lerPassoDeDePara(ensaio.steps[0]) : undefined;
  if (ensaio && (!passo || passo.origem === "prototipo")) {
    return {
      taskId: task.id,
      veredito: "nao_medivel",
      semTagDeConta: semTag,
      nomeDaCategoriaDiverge: false,
      origem: passo?.origem,
      agente: passo ? { conta: passo.conta, categoria: passo.categoria, codigo: passo.codigo } : undefined,
      humano: humanoResultado,
    };
  }

  if (!ensaio || !passo) {
    return { taskId: task.id, veredito: "sem_ensaio", semTagDeConta: semTag, nomeDaCategoriaDiverge: false, humano: humanoResultado };
  }

  if (!humano) {
    return {
      taskId: task.id,
      veredito: "sem_lancamento_humano",
      semTagDeConta: semTag,
      nomeDaCategoriaDiverge: false,
      origem: passo.origem,
      agente: { conta: passo.conta, categoria: passo.categoria, codigo: passo.codigo },
    };
  }

  const contaIgual = passo.conta.trim().toLowerCase() === humano.conta.trim().toLowerCase();
  const codigoIgual = passo.codigo.trim() === humano.codigo.trim();
  const nomeDaCategoriaDiverge = passo.categoria.trim().toLowerCase() !== humano.categoria.trim().toLowerCase();
  const veredito: VereditoDaConferencia = codigoIgual && contaIgual ? "confere" : !codigoIgual && !contaIgual ? "diverge_ambos" : !codigoIgual ? "diverge_categoria" : "diverge_conta";

  return {
    taskId: task.id,
    veredito,
    semTagDeConta: semTag,
    nomeDaCategoriaDiverge,
    origem: passo.origem,
    agente: { conta: passo.conta, categoria: passo.categoria, codigo: passo.codigo },
    humano: humanoResultado,
  };
}

/**
 * O limiar da caneta — declarado ANTES de a semana de dados existir (D3-03).
 * Medir primeiro e decidir depois o que conta como bom é racionalizar; esta
 * constante fecha esse modo de falha por construção. Mudá-la depois de rodar
 * o relatório é mudar a régua depois da medida — e o `git blame` desta linha
 * é o que torna isso visível.
 */
export const LIMIAR_DA_CANETA = {
  /** G1 — com menos de 20 pares, uma única divergência move a taxa em mais de 5 pontos: não dá para distinguir acerto de ruído do limiar de G2. */
  paresMinimos: 20,
  /** G2 — categoria errada é erro contábil, corrigível por reclassificação no Omie depois do fato. */
  acertoDeCodigo: 0.95,
  /** G3 — conta errada é dinheiro saindo da conta bancária errada; não é corrigível por tecla, a barra é mais alta de propósito. */
  acertoDeConta: 0.98,
  /** G6 — acima de 20% dos Ensaios sem registro humano, a taxa deixa de ser confiável: é o vetor de viés de seleção (o Financeiro pode registrar só as contas fáceis). */
  tetoDeSemRegistroHumano: 0.2,
  /** Reportado, não bloqueante — acima de 40% de recusa o Agente está cauteloso demais para poupar trabalho. */
  tetoDeRecusaParaUtilidade: 0.4,
} as const;

/**
 * INV-CP-01 — uma conta no caminho do ERP (`lançado omie`, `em remessa`) tem
 * Resumo, Integração manual, OU um registro de lançamento humano (D3-03):
 * este último responde "por onde esta conta foi ao ERP" com mais precisão do
 * que `Integração manual`, que só diz "não foi o Agente". Sem esta terceira
 * forma, toda conta lançada na semana de Ensaio acenderia o aviso — e um
 * aviso sempre aceso é um aviso que ninguém lê. Quem pulou o ERP (seção 6.4:
 * para pagar → autorização → pago) não deve nada ao Omie e não é apontada.
 */
export function contaSemResumo(state: DataState, task: Task): boolean {
  if (task.listId !== CP.listId) return false;
  const ordem: readonly string[] = [CP.status.lancado, CP.status.emRemessa];
  if (!ordem.includes(task.statusId)) return false;
  if (fieldValue(task, CP.fields.integracaoManual) === "Manual") return false;
  if (lancamentoHumanoDe(state, task) !== undefined) return false;
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
  return ok(criadas, criadas[0]?.id);
}
