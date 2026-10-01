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

import { agentSeesTask, contactDisplayName, effectiveLifecycleOfTask, memberSeesTask, newestFirst, statusDefinition } from "../derive";
import { fail, ok, type DataState, type OperationResult } from "../state";
import type { Agent, AgentExecution, ApprovalRequest, Comment, Contact, Id, Task } from "../types";
import { memberActor, nextId, recordActivity } from "./activity";
// Sem ciclo em tempo de carga: `./ai` importa `./tasks`, que importa
// `./automations`, que importa este arquivo — mas nenhum deles usa o outro no
// topo do módulo, só dentro de funções. O que `./ai` e `./tasks` precisam
// daqui mora em dois módulos-folha que não importam este arquivo: os textos
// em `./financeiro-textos` e a impressão, a Conferência vigente e os
// revisores em `./financeiro-base` (06-11, só `import type`). Nenhum dos dois
// importa `./financeiro`.
import { decideProcessApproval, podeDecidirAConferencia, solicitarConferenciaDoResumo } from "./ai";
import { addMonths } from "./collaboration";
import {
  CP,
  MOTIVO_DA_DISPENSA,
  PREFIXO_LANCAMENTO_HUMANO,
  PRAZO_DO_LANCAMENTO_EM_CURSO_MS,
  REGISTRO_LANCADO_NO_OMIE,
  REGISTRO_LANCAMENTO_EM_CURSO,
  REGISTRO_LANCAMENTO_FALHOU,
  REGISTRO_LANCAMENTO_INTERROMPIDO,
  conferenciaMaisRecente,
  conferenciaVigente,
  dispensaSemManual,
  ehConferenciaDoResumo,
  fieldValue,
  impressaoDeLancamento,
  lancamentoEmCursoDe,
  type ConferenciaDoResumo,
} from "./financeiro-base";
import { FORMAS_CANONICAS_DO_FIO, TEXTOS_DA_CONFERENCIA, type AnexoDoLancamento } from "./financeiro-textos";
import { addTaskComment, changeTaskStatus, createTask, setTaskFieldValue, trashTask, unmetRequirements } from "./tasks";

export {
  CP,
  FORMA_DO_CODIGO_DE_CATEGORIA,
  MOTIVO_DA_DISPENSA,
  PREFIXO_LANCAMENTO_HUMANO,
  PRAZO_DO_LANCAMENTO_EM_CURSO_MS,
  RECUSA_LANCAMENTO_EM_CURSO,
  REGISTRO_LANCADO_NO_OMIE,
  REGISTRO_LANCAMENTO_EM_CURSO,
  REGISTRO_LANCAMENTO_FALHOU,
  REGISTRO_LANCAMENTO_INTERROMPIDO,
  conferenciaMaisRecente,
  dispensaDaConferencia,
  dispensaSemManual,
  impressaoDeLancamento,
  lancamentoEmCursoDe,
  lancamentoSemCodigo,
  revisoresDoResumo,
  type ConferenciaDoResumo,
} from "./financeiro-base";
export {
  FORMAS_CANONICAS_DO_FIO,
  PREFIXOS_DO_PROCESSO,
  TEXTOS_DA_CONFERENCIA,
  type AnexoDoLancamento,
  type CampoDivergente,
  type DadosDoLancado,
} from "./financeiro-textos";

const now = (): string => new Date().toISOString();

/**
 * Quem a `AgentExecution` do lançamento nomeia como invocador (`invokedBy`)
 * desde que a A7 saiu do seed (plano pós-auditoria, 1.5, opção simples): a
 * ponte do `apps/api` (`automacoes/invocar-agente.ts`), quando a conta ENTRA
 * em "em lançamento omie". O id é o da antiga A7 de propósito — em `ws_n1` ela
 * continua gravada (pausada por `contas-a-pagar:configurar`), e as Execuções
 * de antes e de depois da troca ficam sob o mesmo invocador. Nenhuma
 * Automação com este id nasce do seed, e `runLancamentoAgent` não exige que
 * ela exista: o id só identifica quem pediu, não autoriza nada.
 */
export const INVOCADOR_DO_LANCAMENTO: Id = "aut_cp_a7";

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
 * Quem a recusa do Agente menciona: o Financeiro (`CP.financeiroId`, seção 9
 * do processo — "Comentário aberto atribuído ao Financeiro"), quando é Membro
 * ativo do Espaço; senão, quem invocou. Enquanto quem invocava era a A7 em
 * nome do Financeiro, as duas coisas coincidiam; desde o plano pós-auditoria
 * (2.2) quem invoca é o Membro de serviço do "Agente do pipeline", que
 * ninguém lê — mencioná-lo seria pedir a ninguém. A ponte do `apps/api` usa a
 * mesma função nos Comentários que ela mesma escreve.
 */
export function avisadoDoLancamento(state: DataState, actingMemberId: Id): Id {
  return state.members.some((m) => m.id === CP.financeiroId && m.state === "ativo") ? CP.financeiroId : actingMemberId;
}

/**
 * Quem os atos da Conferência do Resumo mencionam (Fase 6): `avisarId`
 * quando é um Membro ATIVO do Espaço; senão, a regra de sempre
 * (`avisadoDoLancamento`). É a porta que a ponte do `apps/api` usa em
 * ambiente de teste (`AGENTE_CONTAS_A_PAGAR_AVISAR_ID`) para que nenhuma
 * Menção chegue a uma pessoa real; sem `avisarId`, nada muda. Nunca devolve
 * um id que não seja Membro ativo, ou quem age.
 */
export function avisadoDaConferencia(state: DataState, actingMemberId: Id, avisarId?: Id): Id {
  if (avisarId && state.members.some((m) => m.id === avisarId && m.state === "ativo")) return avisarId;
  return avisadoDoLancamento(state, actingMemberId);
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
 * O Agente de lançamento, invocado em nome de quem age: lê a Tarefa, publica o
 * Resumo (resolvido) e devolve o que fez. Se faltar dado, comenta o que falta
 * — aberto, com Menção a quem age — e falha, o que impede quem invocou de
 * mover o Status. Tudo vira Execução de Agente.
 *
 * Quem invoca, desde o plano pós-auditoria (1.5): a ponte do `apps/api`,
 * depois de o Omie confirmar o lançamento de uma conta que entrou em "em
 * lançamento omie" (`automationId` = `INVOCADOR_DO_LANCAMENTO`). Uma Automação
 * com a ação `invocarAgente` (a A7 legada, ainda gravada em `ws_n1`) continua
 * chegando aqui pelo motor (`automations.ts::runAction`).
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
      const r = addTaskComment(state, actingMemberId, taskId, { content: texto, mentions: [{ type: "member", id: avisadoDoLancamento(state, actingMemberId) }], actor: { kind: "agent", id: agentId } });
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

/*
 * O registro do lançamento feito à mão pelo Financeiro durante o Ensaio de
 * D3-03 — o lado humano da comparação que 03-14 mede contra o Ensaio do
 * Agente. O prefixo (`PREFIXO_LANCAMENTO_HUMANO`) é contrato entre `apps/web`
 * (escreve, por `textoDoLancamentoHumano`) e `apps/api` (lê, por
 * `lancamentoHumanoDe`), sem que nenhum dos dois conheça o outro. Desde 06-19
 * ele mora em `./financeiro-base` (reexportado acima): `./tasks` recusa o
 * registro humano enquanto o Agente lança (crm2:WR-01).
 */

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

/* ═══════════ A Conferência do Resumo (Fase 6 — Fluxos 5, 6 e 7) ═══════════
 *
 * O Agente publica o RESUMO ANTES do lançamento, aberto ao Financeiro, e
 * abre uma Conferência (`ApprovalRequest` de processo, `processStep:
 * "resumo"`). O Financeiro confere (clique ou "ok" no fio) ou pede ajuste
 * (qualquer outra resposta); só uma Conferência aprovada para os dados ATUAIS
 * da conta deixa o lançamento ser registrado.
 *
 * D6-10 — a tripla conta · categoria · código e a impressão de lançamento são
 * DADO da Conferência (`origin.lancamento`, `origin.impressao`). Nenhuma
 * função daqui lê a tripla do TEXTO de um Comentário: o texto do RESUMO é
 * saída (CON-CP-08), e reparseá-lo é a fragilidade do legado.
 */

const nomeDoMembro = (state: DataState, id: Id): string => state.members.find((m) => m.id === id)?.displayName ?? id;

/**
 * G1 (Fase 6) — a conta pode entrar na ponte do Agente: não é importada, ou
 * o seu último movimento de Status foi feito na plataforma, depois da
 * importação. A reprodução do `status_history` do ClickUp
 * (`importarContaAPagarHistorica`) grava Registros "Status alterado" sempre
 * ANTERIORES a `provenance.at`; um movimento feito aqui é sempre posterior.
 * Mora no domínio porque os dois lados precisam da mesma régua: a ponte
 * (`apps/api`) não varre a conta importada parada, e a tela não promete um
 * Resumo que não virá. `newestFirst` desempata instantes iguais pela
 * sequência do id, como a Atividade da tela.
 */
export function movidaDepoisDaImportacao(state: DataState, task: Task): boolean {
  if (task.provenance?.kind !== "import") return true;
  const ultima = newestFirst(state.activity.filter((a) => a.objectType === "task" && a.objectId === task.id && a.action === "Status alterado"))[0];
  return ultima !== undefined && Date.parse(ultima.at) > Date.parse(task.provenance.at);
}

export type EstadoDaConferencia = "sem-resumo" | "pendente" | "conferida" | "ajuste-pedido" | "desatualizada";

/**
 * Onde a conta está na Conferência. `desatualizada` vence qualquer decisão:
 * uma aprovação para uma impressão que não é mais a da conta não vale.
 * Conferências canceladas (superadas por um Resumo mais novo) não contam.
 *
 * 06-18 (crm2:CR-01): também `desatualizada` quando a Conferência foi
 * DISPENSADA (D6-04) e a conta não é mais "Manual" (`dispensaSemManual`). A
 * dispensa vale enquanto a conta é "Manual"; desmarcada, ninguém conferiu
 * nada, e todo consumidor (ponte, `registrarLancamentoNoOmie`, tela) passa a
 * ver uma Conferência que não cobre a conta — o próximo Resumo vai a uma
 * pessoa.
 */
export function conferenciaDoResumo(
  state: DataState,
  task: Task,
): { readonly estado: EstadoDaConferencia; readonly conferencia?: ConferenciaDoResumo; readonly impressaoAtual: string } {
  const impressaoAtual = impressaoDeLancamento(state, task);
  const conferencia = conferenciaVigente(state, task.id);
  if (!conferencia) return { estado: "sem-resumo", impressaoAtual };
  const estado: EstadoDaConferencia =
    conferencia.origin.impressao !== impressaoAtual || dispensaSemManual(task, conferencia)
      ? "desatualizada"
      : conferencia.decision === "aprovada"
        ? "conferida"
        : conferencia.decision === "rejeitada"
          ? "ajuste-pedido"
          : "pendente";
  return { estado, conferencia, impressaoAtual };
}

/**
 * As respostas de quem confere no fio do Resumo que ainda não viraram decisão:
 * só enquanto a Conferência vigente está sem decisão; só respostas ao raiz do
 * fio publicadas DEPOIS do Resumo vigente (na ordem do fio); só de Membros que
 * podem decidir ESTA Conferência (`podeDecidirAConferencia` — nunca do
 * Agente); nunca as respostas canônicas que a decisão publica em nome do
 * decisor (`FORMAS_CANONICAS_DO_FIO`). Ordenadas por `createdAt`.
 *
 * 06-18 (crm2:WR-03): o filtro de autoria era `revisoresDoResumo`, e o
 * conjunto de quem confere pelo fio divergia do de quem confere pelo clique
 * (o aprovador de G3 sem papel de Administrador respondia em silêncio; a
 * Maryane sob G3 era lida e recusada). D6-09 continua como regra de tela
 * para resolver o fio; quem DECIDE é `podeDecidirAConferencia`.
 *
 * 06-11 (crm:WR-04): as mensagens do processo saem pela AUTORIA (as do Agente)
 * e pela FORMA EXATA (as canônicas escritas por Membro), nunca pelo emoji
 * inicial — um revisor que escreve "⚠️ o valor está errado" está pedindo
 * ajuste, e "✅" sozinho é aprovação. Quem as transforma em decisão é
 * `decisaoDasRespostasPendentes`, e quem decide é a ponte.
 */
export function respostasDeConferenciaPendentes(state: DataState, task: Task): Comment[] {
  const conferencia = conferenciaVigente(state, task.id);
  if (!conferencia || conferencia.decision !== undefined) return [];
  const posicaoDoResumo = task.comments.findIndex((c) => c.id === conferencia.origin.resumoCommentId);
  if (posicaoDoResumo < 0) return [];
  return task.comments
    .slice(posicaoDoResumo + 1)
    .filter(
      (c) =>
        !c.deletedAt &&
        c.parentCommentId === conferencia.origin.threadCommentId &&
        c.author.kind === "member" &&
        podeDecidirAConferencia(state, c.author.id, conferencia) &&
        !FORMAS_CANONICAS_DO_FIO.some((f) => f.test(c.content.trimStart())),
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** O que o lote de respostas pendentes pede: uma decisão com a resposta que a motivou, ou nada. */
export type DecisaoDasRespostasPendentes =
  | { readonly sentido: "aprovacao" | "ajuste"; readonly resposta: Comment; readonly ultimaLida: Id }
  | { readonly sentido: "nenhum"; readonly ultimaLida?: Id };

/**
 * 06-11 (crm:WR-04) — o que TODAS as respostas pendentes do fio pedem, lidas
 * em ordem: o PRIMEIRO `ajuste` decide, e vence qualquer `aprovacao` do mesmo
 * lote (antes ou depois dele); sem ajuste, a primeira `aprovacao` decide, mas
 * só com `opcoes.aprovacaoPorComentario` (D6-02,
 * `AGENTE_CONTAS_A_PAGAR_CONFERENCIA_POR_COMENTARIO`); o resto é `nenhum`.
 * Uma pergunta depois de um pedido de ajuste não o esconde, e um "ok" de um
 * revisor não atropela o ajuste de outro.
 *
 * `ultimaLida` é o id da última resposta pendente — a ponte a guarda para não
 * reler o mesmo lote. O parâmetro é obrigatório: não há padrão silencioso.
 * Pura, e não decide nada: quem chama `decideProcessApproval(..., { source:
 * "comment", reason: resposta.content.trim() })` em nome de
 * `resposta.author.id` é a ponte.
 */
export function decisaoDasRespostasPendentes(
  state: DataState,
  task: Task,
  opcoes: { readonly aprovacaoPorComentario: boolean },
): DecisaoDasRespostasPendentes {
  const respostas = respostasDeConferenciaPendentes(state, task);
  const ultima = respostas.at(-1);
  if (!ultima) return { sentido: "nenhum" };
  let aprovacao: Comment | undefined;
  for (const resposta of respostas) {
    const sentido = classificarRespostaDeConferencia(resposta.content);
    if (sentido === "ajuste") return { sentido: "ajuste", resposta, ultimaLida: ultima.id };
    if (sentido === "aprovacao" && !aprovacao) aprovacao = resposta;
  }
  if (aprovacao && opcoes.aprovacaoPorComentario) return { sentido: "aprovacao", resposta: aprovacao, ultimaLida: ultima.id };
  return { sentido: "nenhum", ultimaLida: ultima.id };
}

/**
 * 06-18 (crm2:WR-03) — o "ok" no fio que NÃO confere, e o que o Agente
 * responde a ele: nunca silêncio. Pura; quem comenta é a ponte.
 *
 * Só com a Conferência vigente pendente. Olha as respostas de Membro ao raiz
 * do fio, depois do Resumo vigente, fora de `FORMAS_CANONICAS_DO_FIO`, que
 * `classificarRespostaDeConferencia` dá `aprovacao`. Candidatas:
 *   (i) de quem não pode decidir esta Conferência (`podeDecidirAConferencia`)
 *       ⇒ `okDeQuemNaoConfere(<aprovador>)`;
 *  (ii) de quem decide, com `aprovacaoPorComentario === false` e o lote em
 *       `nenhum` (um ajuste no lote decide, e nada há a responder) ⇒
 *       `okPeloFioDesligado`.
 * O fio é a memória (como em crm:WR-07): descarta a candidata que já tem,
 * DEPOIS dela no fio, um Comentário do Agente com exatamente esse texto — a
 * mesma resposta nunca sai duas vezes, nem depois de um reinício. Devolve a
 * MAIS RECENTE que sobrar.
 */
export function respostaSemEfeitoNoFio(
  state: DataState,
  task: Task,
  opcoes: { readonly aprovacaoPorComentario: boolean },
): { readonly resposta: Comment; readonly texto: string } | undefined {
  const vigente = conferenciaVigente(state, task.id);
  if (!vigente || vigente.decision !== undefined) return undefined;
  const posicaoDoResumo = task.comments.findIndex((c) => c.id === vigente.origin.resumoCommentId);
  if (posicaoDoResumo < 0) return undefined;
  const fio = vigente.origin.threadCommentId;
  const lote = decisaoDasRespostasPendentes(state, task, opcoes);
  const aprovador = nomeDoMembro(state, vigente.approverMemberId);
  let escolhida: { readonly resposta: Comment; readonly texto: string } | undefined;
  for (let i = posicaoDoResumo + 1; i < task.comments.length; i++) {
    const c = task.comments[i];
    if (!c || c.deletedAt || c.parentCommentId !== fio || c.author.kind !== "member") continue;
    if (FORMAS_CANONICAS_DO_FIO.some((f) => f.test(c.content.trimStart()))) continue;
    if (classificarRespostaDeConferencia(c.content) !== "aprovacao") continue;
    const texto = !podeDecidirAConferencia(state, c.author.id, vigente)
      ? TEXTOS_DA_CONFERENCIA.okDeQuemNaoConfere(aprovador)
      : !opcoes.aprovacaoPorComentario && lote.sentido === "nenhum"
        ? TEXTOS_DA_CONFERENCIA.okPeloFioDesligado
        : undefined;
    if (texto === undefined) continue;
    const jaRespondida = task.comments
      .slice(i + 1)
      .some((r) => r.author.kind === "agent" && r.author.id === CP.agentId && !r.deletedAt && r.parentCommentId === fio && r.content === texto);
    if (!jaRespondida) escolhida = { resposta: c, texto };
  }
  return escolhida;
}

/* A heurística portada do classificador do legado
 * (`financeiro-tria/automation/src/adapters/ai.ts`, `classificarAprovacaoPorHeuristica`),
 * SEM IA — mesma normalização, mesmos radicais, mesma ordem. */
const RADICAIS_DE_AJUSTE = ["reprov", "desaprov", "recus", "rejeit", "negad", "negativ", "errad", "cancel", "ajust", "corrig", "corrij", "mud", "troc", "alter"];
// "ajustado"/"corrigido" descrevem o ajuste JÁ FEITO ("valor ajustado, ok"), não um pedido.
const RADICAIS_DE_CONSERTO = ["ajust", "corrig"];
const PARTICIPIO = /(ad|id)[oa]s?$/;
const RADICAIS_DE_APROVACAO_NEGAVEL = ["aprov", "autoriz", "liber", "positiv", "confer"];
const PALAVRAS_DE_APROVACAO_NEGAVEL = new Set(["pode", "podem", "posso", "segue", "seguir", "sigo", "ok", "okay", "sim", "certo", "certa", "correto", "correta", "lancar"]);
const PALAVRAS_DE_APROVACAO = new Set([
  "aprovado", "aprovada", "aprovados", "aprovadas", "aprovo", "aprovamos",
  "ok", "okay", "sim", "positivo",
  "conferido", "conferida", "confere",
  "certo", "certa", "correto", "correta",
  "liberado", "liberada", "liberados", "liberadas",
  "autorizado", "autorizada", "autorizados", "autorizadas", "autorizo",
]);
const COMPLEMENTOS_DE_PODE = new Set(["seguir", "pagar", "lancar", "liberar", "prosseguir"]);
/** As palavras que acompanham uma aprovação sem pedir nada ("tudo certo, pode lançar, obrigada"). */
const CONECTIVOS_DA_APROVACAO = new Set(["pode", "segue", "tudo", "esta", "ta", "e", "obrigado", "obrigada", "valeu", "por", "favor", "pra", "para"]);
/** 06-11 (crm:CR-03) — as únicas palavras que uma mensagem de aprovação pode ter. */
const PALAVRAS_DA_APROVACAO_ESTRITA = new Set([...PALAVRAS_DE_APROVACAO, ...COMPLEMENTOS_DE_PODE, ...CONECTIVOS_DA_APROVACAO]);
/** Mais palavras que isso já é conversa, não aprovação ("tudo certo, pode lançar, obrigada" tem 5). */
const TETO_DE_PALAVRAS_DA_APROVACAO = 6;
/** O polegar (com ou sem tom de pele), o visto e o seletor de emoji: os únicos sinais fora das letras. */
const SINAIS_DE_APROVACAO = /👍|✅|[\u{1F3FB}-\u{1F3FF}]|\u{FE0F}/gu;
/** Sem os sinais acima, só letras, espaço e pontuação leve: nenhum dígito, emoji ou outro símbolo. */
const SO_TEXTO_DE_APROVACAO = /^[a-z\s.,;:!]*$/;
const VERBOS_DE_ADIAMENTO = new Set(["verificar", "conferir", "analisar", "ver", "checar", "olhar"]);
const PALAVRAS_DE_ESPERA = new Set(["espera", "esperar", "espere"]);
const comecaCom = (palavra: string, radicais: readonly string[]): boolean => radicais.some((r) => palavra.startsWith(r));

/**
 * D6-02 — o que uma resposta de revisor no fio do Resumo quer dizer. Pura,
 * sem IA. Ordem (a mesma do legado): (1) recusa/pedido de mudança por radical,
 * "não" na mesma cláusula de um termo de aprovação, ou "Não" seco no começo ⇒
 * `ajuste`; (2) pergunta, "aguardando", "vou verificar" ⇒ `ignorar`; (3)
 * a mensagem INTEIRA é aprovação ⇒ `aprovacao`; (4) o resto ⇒ `ajuste`.
 *
 * O passo 3 é estrito (06-11, crm:CR-03) — quatro condições juntas: (i) toda
 * palavra normalizada está em `PALAVRAS_DA_APROVACAO_ESTRITA` (as palavras de
 * aprovação, os complementos de "pode" e os conectivos); (ii) no máximo
 * `TETO_DE_PALAVRAS_DA_APROVACAO` palavras; (iii) sem 👍, ✅, tom de pele e
 * seletor de emoji, o texto só tem letras, espaço e pontuação leve — nenhum
 * dígito, nenhum outro emoji ("👎", "❌", "⚠️"), nenhum outro símbolo ("/",
 * "$", "-", ":)"); (iv) há ao menos um sinal de aprovação (👍/✅, uma palavra
 * de aprovação, "pode" + complemento, ou "segue") — "valeu" sozinho não aprova.
 *
 * Duas diferenças deliberadas do legado (`adapters/ai.ts:305-343`):
 * - lá, "nada casou" é `irrelevant`; aqui, no fio do Resumo, é `ajuste` — o
 *   Fluxo 6 trata qualquer resposta de revisor ao RESUMO como pedido de
 *   revisão ("segunda-feira" vira um Resumo revisado com esse pedido, e é o
 *   Financeiro quem o lê);
 * - lá, basta QUALQUER cláusula ter palavra de aprovação; aqui, a mensagem
 *   inteira tem de ser aprovação. O erro, quando houver, tem de cair do lado
 *   do ajuste (custa um Resumo revisado), nunca do lado da aprovação (custa
 *   um título errado no Omie). Os contraexemplos do review, todos `ajuste`:
 *   "O valor está certo, mas o vencimento é dia 15", "sim, mas o fornecedor é
 *   outro", "ok, só falta o boleto", "certo o valor mas a conta é Itaú",
 *   "👍 mas a categoria é comercial" e "pode lançar dia 20".
 */
export function classificarRespostaDeConferencia(texto: string): "aprovacao" | "ajuste" | "ignorar" {
  if (!texto.trim()) return "ignorar";
  const normalizado = texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const clausulas = normalizado
    .split(/[.,;:!?\n]+/)
    .map((clausula) => clausula.split(/[^a-z0-9]+/).filter(Boolean))
    .filter((palavras) => palavras.length > 0);
  const palavras = clausulas.flat();

  // 1) Ajuste — antes de qualquer sinal de aprovação.
  if (palavras.some((p) => comecaCom(p, RADICAIS_DE_AJUSTE) && !(comecaCom(p, RADICAIS_DE_CONSERTO) && PARTICIPIO.test(p)))) return "ajuste";
  const negaAprovacao = clausulas.some(
    (clausula) => clausula.includes("nao") && clausula.some((p) => PALAVRAS_DE_APROVACAO_NEGAVEL.has(p) || comecaCom(p, RADICAIS_DE_APROVACAO_NEGAVEL)),
  );
  if (negaAprovacao) return "ajuste";
  if (clausulas[0]?.length === 1 && clausulas[0][0] === "nao") return "ajuste";

  // 2) Pergunta ou adiamento não é decisão.
  if (normalizado.includes("?")) return "ignorar";
  if (palavras.some((p) => p.startsWith("aguard") || PALAVRAS_DE_ESPERA.has(p))) return "ignorar";
  if (clausulas.some((clausula) => clausula.some((p, i) => p === "vou" && VERBOS_DE_ADIAMENTO.has(clausula[i + 1] ?? "")))) return "ignorar";

  // 3) Aprovação: a mensagem INTEIRA, e nada além dela (crm:CR-03).
  const soPalavrasDeAprovacao = palavras.every((p) => PALAVRAS_DA_APROVACAO_ESTRITA.has(p));
  const dentroDoTeto = palavras.length <= TETO_DE_PALAVRAS_DA_APROVACAO;
  const semOutroSimbolo = SO_TEXTO_DE_APROVACAO.test(normalizado.replace(SINAIS_DE_APROVACAO, ""));
  const temSinal =
    texto.includes("👍") ||
    texto.includes("✅") ||
    palavras.some((p) => PALAVRAS_DE_APROVACAO.has(p) || p === "segue") ||
    clausulas.some((clausula) => clausula.some((p, i) => p === "pode" && COMPLEMENTOS_DE_PODE.has(clausula[i + 1] ?? "")));
  if (soPalavrasDeAprovacao && dentroDoTeto && semOutroSimbolo && temSinal) return "aprovacao";

  // 4) Fluxo 6: toda resposta de revisor ao RESUMO é revisão.
  return "ajuste";
}

type PassoDaExecucao = { index: number; kind: "ferramenta" | "raciocinio"; toolId?: string; input?: string; output?: string; result: "concluido" | "falhou"; at: string };

/** A `AgentExecution` de um ato da Conferência — a mesma forma que `runLancamentoAgent` grava, nunca em Ensaio. */
function gravarExecucaoDoLancamento(
  state: DataState,
  agent: Agent,
  actingMemberId: Id,
  task: Task,
  input: string,
  steps: PassoDaExecucao[],
  output: string,
): void {
  const version = agent.versions.at(-1);
  if (!version) return;
  const inicio = now();
  state.agentExecutions.push({
    id: nextId("exe"),
    workspaceId: state.workspace.id,
    agentId: agent.id,
    agentVersion: version.number,
    state: "concluida",
    origin: "automacao",
    invokedBy: { kind: "automation", id: INVOCADOR_DO_LANCAMENTO },
    delegate: { kind: "member", id: actingMemberId },
    chain: { depth: 1, visitedAgentIds: [agent.id], visitedAutomationObjects: [{ automationId: INVOCADOR_DO_LANCAMENTO, objectId: task.id }] },
    anchor: { type: "task", id: task.id },
    modelId: version.modelId,
    effectiveAutonomy: version.autonomy,
    rehearsal: false,
    input,
    steps,
    contextComposition: { anchor: { type: "task", id: task.id, name: task.title }, readRecordIds: [task.id], fragmentRefs: [], memoryItemIds: [], chatMessageIds: [] },
    knowledgeReferences: [],
    cost: { modelUnits: 1, toolCalls: steps.length, childExecutions: 0, durationMs: 0 },
    output,
    startedAt: inicio,
    endedAt: now(),
  });
}

/** As guardas comuns aos atos do Agente sobre uma Conta a pagar — na ordem de `runLancamentoAgent`. */
function guardasDoAgente(state: DataState, actingMemberId: Id, taskId: Id): { readonly agent: Agent; readonly task: Task } | string {
  const agent = state.agents.find((a) => a.id === CP.agentId);
  if (!agent || agent.lifecycle !== "ativo") return "Agente de lançamento não está ativo.";
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task || task.listId !== CP.listId || effectiveLifecycleOfTask(state, taskId) !== "ativo") return "Conta a pagar não encontrada ou inativa.";
  if (!memberSeesTask(state, actingMemberId, taskId)) return "Quem invoca não alcança a Tarefa.";
  if (!agentSeesTask(state, agent.id, taskId)) return "O Agente de lançamento não tem concessão nesta Lista.";
  if (!agent.versions.at(-1)) return "Agente sem versão.";
  return { agent, task };
}

export interface OpcoesDaConferencia {
  readonly dePara: DeParaDeLancamento;
  /** O que o revisor pediu (Fluxo 6) — o Resumo sai revisado, no mesmo fio. */
  readonly pedidoDeRevisao?: string;
  /** Quem pediu o ajuste; sem ele, quem rejeitou a Conferência anterior, ou quem age. */
  readonly pedidoPor?: Id;
  /** A conta mudou depois da conferência — a ponte republica. */
  readonly motivo?: "dados-mudaram";
  /**
   * Quem o Resumo menciona, chama pelo nome e designa como aprovador da
   * Conferência, no lugar do Financeiro (`avisadoDaConferencia`). Opcional e
   * aditivo: sem ele, a regra de sempre. Não muda `revisoresDoResumo`.
   */
  readonly avisarId?: Id;
  /**
   * A impressão de lançamento sobre a qual quem chama resolveu o de-para (o
   * snapshot da ponte). Diferente da impressão atual ⇒ recusa sem efeito: o
   * de-para foi resolvido para OUTRA conta (06-11, crm:WR-12). Opcional e
   * aditivo: sem ela, nada muda.
   */
  readonly impressaoEsperada?: string;
  /**
   * A Conferência rejeitada que este Resumo revisado responde. Se ela não é
   * mais a vigente, ou não está `rejeitada`, recusa sem efeito — um segundo
   * Resumo revisado para o mesmo pedido nunca sai em dobro (06-11,
   * crm:WR-12). A regra depende desta opção, e não de `pedidoDeRevisao`
   * sozinho, porque revisar sobre uma Conferência PENDENTE é um uso válido do
   * domínio (`conferencia-do-resumo.test.ts` (e) e (i)); só a ponte revisa
   * depois de uma rejeição, e por isso é ela quem diz qual.
   */
  readonly conferenciaRejeitadaId?: Id;
  /**
   * 06-18 (crm2:WR-03): `false` quando o "ok" pelo fio não confere
   * (`AGENTE_CONTAS_A_PAGAR_CONFERENCIA_POR_COMENTARIO=false`): os textos do
   * Resumo pedem a conferência pelo botão, e a Conferência guarda
   * `origin.aprovacaoPeloFio = false`, que a tela lê. Opcional e aditivo:
   * padrão `true`, o texto de sempre.
   */
  readonly aprovacaoPorComentario?: boolean;
  /**
   * 06-19 (crm2:WR-04) — a porta de teste G3 falha FECHADA: com `avisarId`
   * definido que não é Membro ativo, recusa sem efeito
   * (`TEXTOS_DA_CONFERENCIA.recusaAvisarInativo`), antes de qualquer escrita
   * e antes da idempotência — em vez de cair em silêncio na regra de sempre
   * (`avisadoDaConferencia`), que faria a Maryane aprovadora e a mencionaria.
   * A ponte passa a opção sempre que tem `avisarId`. Opcional e aditivo: sem
   * ela, nada muda.
   */
  readonly avisarEstrito?: true;
  /**
   * D6-04 — o Resumo vai ser dispensado logo em seguida (Integração manual):
   * nenhuma pessoa é chamada a conferir, então o texto diz que a conferência
   * é dispensada em vez de pedir "confira", e ninguém é mencionado.
   */
  readonly dispensada?: true;
}

/** 06-19 (crm2:WR-04) — `avisarEstrito` com um `avisarId` que não é Membro ativo: a recusa, ou `undefined`. */
function recusaDoAvisarEstrito(state: DataState, opcoes: { readonly avisarId?: Id; readonly avisarEstrito?: true }): string | undefined {
  if (!opcoes.avisarEstrito || opcoes.avisarId === undefined) return undefined;
  return state.members.some((m) => m.id === opcoes.avisarId && m.state === "ativo") ? undefined : TEXTOS_DA_CONFERENCIA.recusaAvisarInativo;
}

/**
 * Fluxo 5/6 — o Agente publica o RESUMO no fio da conta, ABERTO ao
 * Financeiro, e abre a Conferência. Na primeira vez o Comentário é raiz; nas
 * seguintes (ajuste pedido, dados mudaram) é resposta no mesmo fio, e a
 * Conferência pendente anterior é cancelada. O bloco do RESUMO sai exatamente
 * como `buildResumoDePagamento` o monta (CON-CP-08); a chamada ao Financeiro
 * vem DEPOIS dele (`TEXTOS_DA_CONFERENCIA`, em `./financeiro-textos`):
 * `{financeiro}, confira: responda "ok" para eu lançar, ou diga o que ajustar.`
 *
 * Idempotente: sem pedido de revisão, uma Conferência pendente ou conferida
 * para a mesma impressão é devolvida como está — nada novo no fio.
 * Uma categoria `revisar` NÃO recusa: o Resumo sai, e é o Financeiro quem
 * decide no fio (é para isso que a Conferência existe).
 *
 * Tudo ou nada: uma recusa depois do Comentário desfaz o Comentário e os
 * Registros.
 *
 * 06-11 (crm:WR-12): com `opcoes.impressaoEsperada`, recusa sem efeito se a
 * conta mudou desde a leitura de quem chama; com
 * `opcoes.conferenciaRejeitadaId`, recusa sem efeito se essa Conferência não
 * é mais a vigente rejeitada. As duas guardas vêm antes da idempotência e de
 * qualquer escrita.
 *
 * 06-18: o fio é o da Conferência MAIS RECENTE, mesmo cancelada
 * (crm2:IN-01) — depois de `superarConferencia`, o Resumo novo é resposta no
 * fio de antes, com o sufixo `superada`; e `opcoes.aprovacaoPorComentario:
 * false` (crm2:WR-03) troca o pedido do "ok" pelo do botão nos quatro
 * sufixos e grava `origin.aprovacaoPeloFio = false`.
 *
 * 06-19 (crm2:WR-04): com `opcoes.avisarEstrito`, um `avisarId` que não é
 * Membro ativo recusa sem efeito, logo depois das guardas do Agente.
 */
export function publicarResumoParaConferencia(
  state: DataState,
  actingMemberId: Id,
  taskId: Id,
  opcoes: OpcoesDaConferencia,
): OperationResult<{ readonly comentario: Comment; readonly conferencia: ConferenciaDoResumo; readonly resumo: ResumoDePagamento }> {
  const guardas = guardasDoAgente(state, actingMemberId, taskId);
  if (typeof guardas === "string") return fail(guardas);
  const { agent, task } = guardas;
  const avisarInativo = recusaDoAvisarEstrito(state, opcoes);
  if (avisarInativo) return fail(avisarInativo);
  const faltando = erpMissingFields(state, task);
  if (faltando.length > 0) return fail(`Não publico o Resumo: falta ${faltando.join(", ")}.`);

  const atual = conferenciaDoResumo(state, task);
  const anterior = atual.conferencia;
  if (opcoes.impressaoEsperada !== undefined && opcoes.impressaoEsperada !== atual.impressaoAtual) {
    return fail("Os dados da conta mudaram desde a leitura: o Resumo não foi publicado.");
  }
  if (opcoes.conferenciaRejeitadaId !== undefined && (anterior?.id !== opcoes.conferenciaRejeitadaId || anterior.decision !== "rejeitada")) {
    return fail("A Conferência que pediu este ajuste não é mais a vigente: o Resumo revisado não foi publicado.");
  }
  const resumo = buildResumoDePagamento(state, task, opcoes.dePara);
  const pedidoInformado = opcoes.pedidoDeRevisao?.trim() || undefined;

  if (!pedidoInformado && anterior && (atual.estado === "pendente" || atual.estado === "conferida")) {
    const comentario = task.comments.find((c) => c.id === anterior.origin.resumoCommentId && !c.deletedAt);
    if (comentario) return ok({ comentario, conferencia: anterior, resumo }, anterior.id);
  }

  // Um ajuste pedido por clique (motivo na decisão) vira o pedido do Resumo revisado.
  const pedido = pedidoInformado ?? (atual.estado === "ajuste-pedido" ? anterior?.decisionReason?.trim() || undefined : undefined);
  const quemPediu = opcoes.pedidoPor ?? (anterior?.decision === "rejeitada" ? anterior.decidedByMemberId : undefined) ?? actingMemberId;
  const financeiroId = avisadoDaConferencia(state, actingMemberId, opcoes.avisarId);
  const financeiro = nomeDoMembro(state, financeiroId);
  const porComentario = opcoes.aprovacaoPorComentario !== false;
  const dispensada = opcoes.dispensada === true;
  // 06-18 (crm2:IN-01): o fio é o da Conferência MAIS RECENTE, mesmo
  // cancelada — depois de uma superação, o Resumo novo responde no fio de
  // antes, e a conta continua com um fio só de Resumo.
  const maisRecente = conferenciaMaisRecente(state, task.id);
  const sufixo = pedido
    ? TEXTOS_DA_CONFERENCIA.revisado(nomeDoMembro(state, quemPediu), pedido, financeiro, porComentario, dispensada)
    : opcoes.motivo === "dados-mudaram" || atual.estado === "desatualizada"
      ? TEXTOS_DA_CONFERENCIA.dadosMudaram(financeiro, porComentario, dispensada)
      : !anterior && maisRecente?.decision === "cancelada"
        ? TEXTOS_DA_CONFERENCIA.superada(financeiro, porComentario, dispensada)
        : TEXTOS_DA_CONFERENCIA.chamada(financeiro, porComentario, dispensada);

  const raiz = maisRecente ? task.comments.find((c) => c.id === maisRecente.origin.threadCommentId && !c.deletedAt) : undefined;
  const antes = { activity: state.activity.length, comments: task.comments.length, approvals: state.approvals.length, resolvido: raiz?.resolved };
  const desfazer = (motivo: string): OperationResult<never> => {
    task.comments.splice(antes.comments);
    state.approvals.splice(antes.approvals);
    // `recordActivity` insere no INÍCIO: os Registros novos estão nos primeiros índices.
    state.activity.splice(0, state.activity.length - antes.activity);
    if (raiz && antes.resolvido) raiz.resolved = antes.resolvido;
    return fail(motivo);
  };

  // Um fio resolvido (conferido antes de a conta mudar) reabre: há de novo o que conferir.
  if (raiz?.resolved) {
    delete raiz.resolved;
    recordActivity(state, {
      actor: { kind: "agent", id: agent.id },
      delegate: memberActor(actingMemberId),
      action: "Comentário reaberto",
      objectType: "task",
      objectId: task.id,
      objectName: task.title,
    });
  }

  const comentario = addTaskComment(state, actingMemberId, task.id, {
    content: `${resumo.texto}${sufixo}`,
    mentions: dispensada ? [] : [{ type: "member", id: financeiroId }],
    actor: { kind: "agent", id: agent.id },
    ...(raiz ? { parentCommentId: raiz.id } : {}),
  });
  if (!comentario.ok) return desfazer(comentario.error);

  const conferencia = solicitarConferenciaDoResumo(state, actingMemberId, {
    taskId: task.id,
    threadCommentId: raiz?.id ?? comentario.value.id,
    resumoCommentId: comentario.value.id,
    impressao: atual.impressaoAtual,
    lancamento: { conta: resumo.conta, categoria: resumo.categoria, codigo: resumo.codigo, veredito: resumo.veredito },
    approverMemberId: financeiroId,
    ...(porComentario ? {} : { aprovacaoPeloFio: false as const }),
  });
  if (!conferencia.ok) return desfazer(conferencia.error);
  const aberta = conferencia.value;
  if (!ehConferenciaDoResumo(aberta)) return desfazer("A Conferência aberta não é de Resumo.");

  const tripla = `${resumo.conta} · ${resumo.categoria} · ${resumo.codigo}`;
  gravarExecucaoDoLancamento(
    state,
    agent,
    actingMemberId,
    task,
    `Publicar Resumo para conferência: ${task.title}`,
    [
      { index: 0, kind: "raciocinio", ...descreverPassoDeDePara(resumo, opcoes.dePara.origem), result: "concluido", at: now() },
      { index: 1, kind: "ferramenta", toolId: "criar_comentario", input: raiz ? "resposta no fio do Resumo" : "Comentário raiz", output: "Resumo de pagamento publicado para conferência", result: "concluido", at: now() },
    ],
    `Resumo publicado para conferência: ${resumo.conta} · ${resumo.categoria} (${resumo.codigo})`,
  );
  recordActivity(state, {
    actor: { kind: "agent", id: agent.id },
    delegate: memberActor(actingMemberId),
    action: "Resumo de pagamento publicado para conferência",
    objectType: "task",
    objectId: task.id,
    objectName: task.title,
    detail: tripla,
  });
  return ok({ comentario: comentario.value, conferencia: aberta, resumo }, aberta.id);
}

/**
 * D6-04 `sem-conferencia` — a ponte DISPENSA a Conferência de uma conta de
 * Integração manual (06-18, crm2:CR-01). Fora de `OPERACOES` e da rota: só a
 * ponte chama, como `publicarResumoParaConferencia`.
 *
 * A decisão é tomada sobre o estado RECEBIDO — dentro da Unidade de Trabalho,
 * o da gravação, nunca o snapshot do começo do ciclo. Ordem, e toda recusa
 * antes de qualquer escrita: a Conferência existe e é do Resumo;
 * `guardasDoAgente`; ela é a vigente e está sem decisão; a conta é "Manual"
 * AGORA (senão `recusaDispensaSemManual`); então `decideProcessApproval`
 * (clique, `MOTIVO_DA_DISPENSA` — as guardas de impressão e de código
 * continuam valendo) e, só com `ok`, a marca `decisionWaiver =
 * "integracaoManual"`, que faz a dispensa valer só enquanto a conta for
 * "Manual" (`dispensaSemManual`).
 */
export function dispensarConferenciaDoResumo(
  state: DataState,
  actingMemberId: Id,
  conferenciaId: Id,
  opcoes?: { readonly aprovacaoPorComentario?: boolean },
): OperationResult<ApprovalRequest> {
  const conferencia = state.approvals.find((a) => a.id === conferenciaId);
  if (!conferencia || !ehConferenciaDoResumo(conferencia)) return fail("Conferência do Resumo não encontrada.");
  const guardas = guardasDoAgente(state, actingMemberId, conferencia.origin.taskId);
  if (typeof guardas === "string") return fail(guardas);
  const { task } = guardas;
  if (conferenciaVigente(state, task.id)?.id !== conferencia.id || conferencia.decision !== undefined) {
    return fail("Esta Conferência não é mais a vigente pendente: nada foi dispensado.");
  }
  if (fieldValue(task, CP.fields.integracaoManual) !== "Manual") return fail(TEXTOS_DA_CONFERENCIA.recusaDispensaSemManual);
  // 06-21 (crm2:CR-01 residual, 06-REVIEW-3 Crítico): uma resposta de Membro
  // ainda não processada no fio da Conferência vigente (ajuste OU aprovação)
  // bloqueia a dispensa — mesmo com "Manual" marcado agora. 06-22
  // (06-REVIEW-4 Aviso): o padrão é `true` (preserva o comportamento de
  // 06-21, e sempre bloqueia `ajuste` — o ramo `ajuste` de
  // `decisaoDasRespostasPendentes` ignora esta opção de qualquer forma), mas
  // a ponte agora pode passar a política REAL do espaço de trabalho
  // (`decisoes.conferenciaPorComentario`), para que um "ok" trivial sob a
  // política desligada não trave a dispensa automática para sempre.
  const aprovacaoPorComentario = opcoes?.aprovacaoPorComentario ?? true;
  if (decisaoDasRespostasPendentes(state, task, { aprovacaoPorComentario }).sentido !== "nenhum") {
    return fail(TEXTOS_DA_CONFERENCIA.recusaDispensaComRespostaPendente);
  }
  const decidida = decideProcessApproval(state, actingMemberId, conferencia.id, "aprovada", { source: "click", reason: MOTIVO_DA_DISPENSA });
  if (!decidida.ok) return decidida;
  decidida.value.decisionWaiver = "integracaoManual";
  return decidida;
}

/** O que a ponte recebe do `/lancar` e entrega ao domínio. */
export interface ResultadoDoLancamento {
  readonly payableId: string;
  /** O Omie já tinha o título (consulta antes de incluir): nada novo foi criado. */
  readonly reaproveitado: boolean;
  readonly anexos: ReadonlyArray<AnexoDoLancamento>;
  /** Quantos anexos a ponte pediu (06-11, aditivo) — a confirmação conta pelo pedido, não só pela resposta. */
  readonly anexosPedidos?: number;
}

const RECUSA_POR_ESTADO: Readonly<Record<Exclude<EstadoDaConferencia, "conferida">, string>> = {
  "sem-resumo": "a conta não tem Resumo publicado",
  pendente: "o Resumo ainda não foi conferido",
  "ajuste-pedido": "o Financeiro pediu ajuste no Resumo",
  desatualizada: "os dados da conta mudaram depois da conferência",
};

/**
 * Fluxo 7 — o Omie devolveu o título: o domínio registra o lançamento. Só
 * com Conferência APROVADA para a impressão ATUAL (D6-10) e com a conta em
 * "em lançamento omie". Publica no fio a confirmação
 * (`✅ Lançado no Omie — título … · anexos …`), resolve o fio, grava a
 * `AgentExecution` com o `payableId` real e move para "lançado omie" — tudo
 * ou nada: se o Status recusar, o Comentário, a Execução e os Registros
 * saem juntos.
 */
export function registrarLancamentoNoOmie(state: DataState, actingMemberId: Id, taskId: Id, resultado: ResultadoDoLancamento): OperationResult<Task> {
  const guardas = guardasDoAgente(state, actingMemberId, taskId);
  if (typeof guardas === "string") return fail(guardas);
  const { agent, task } = guardas;
  if (task.statusId !== CP.status.emLancamento) {
    return fail("O lançamento só se registra com a conta em “em lançamento omie”.");
  }
  const { estado, conferencia } = conferenciaDoResumo(state, task);
  if (estado !== "conferida" || !conferencia) {
    return fail(`Sem Conferência aprovada para os dados atuais (${estado}): ${RECUSA_POR_ESTADO[estado === "conferida" ? "sem-resumo" : estado]}.`);
  }
  const payableId = resultado.payableId.trim();
  // Defesa em profundidade — a ponte já recusa: um título simulado nunca vira "lançado omie".
  if (!payableId || payableId.startsWith("mock-")) return fail("O Omie não devolveu um título válido.");

  const { conta, categoria, codigo } = conferencia.origin.lancamento;
  const texto = TEXTOS_DA_CONFERENCIA.lancado({
    payableId,
    conta,
    categoria,
    codigo,
    reaproveitado: resultado.reaproveitado,
    anexos: resultado.anexos,
    ...(resultado.anexosPedidos !== undefined ? { anexosPedidos: resultado.anexosPedidos } : {}),
  });
  const raiz = task.comments.find((c) => c.id === conferencia.origin.threadCommentId && !c.deletedAt);
  const antes = { activity: state.activity.length, comments: task.comments.length, executions: state.agentExecutions.length, resolvido: raiz?.resolved };
  const desfazer = (motivo: string, field?: string): OperationResult<Task> => {
    task.comments.splice(antes.comments);
    state.agentExecutions.splice(antes.executions);
    // `recordActivity` insere no INÍCIO: os Registros novos estão nos primeiros índices.
    state.activity.splice(0, state.activity.length - antes.activity);
    if (raiz) {
      if (antes.resolvido) raiz.resolved = antes.resolvido;
      else delete raiz.resolved;
    }
    return fail(motivo, field);
  };

  const comentario = addTaskComment(state, actingMemberId, task.id, {
    content: texto,
    actor: { kind: "agent", id: agent.id },
    ...(raiz ? { parentCommentId: raiz.id } : {}),
  });
  if (!comentario.ok) return desfazer(comentario.error);
  if (raiz && !raiz.resolved) {
    // Como `runLancamentoAgent`: quem fecha o fio no lançamento é o próprio Agente.
    raiz.resolved = { by: agent.id, at: now() };
    recordActivity(state, {
      actor: { kind: "agent", id: agent.id },
      delegate: memberActor(actingMemberId),
      action: "Comentário resolvido",
      objectType: "task",
      objectId: task.id,
      objectName: task.title,
    });
  }

  const tripla = `${conta} · ${categoria} · ${codigo}`;
  gravarExecucaoDoLancamento(
    state,
    agent,
    actingMemberId,
    task,
    `Lançar no ERP: ${task.title}`,
    [
      { index: 0, kind: "raciocinio", input: "Conferência do Resumo aprovada", output: `Conta ${tripla}`, result: "concluido", at: now() },
      { index: 1, kind: "ferramenta", toolId: "omie_lancar_conta_a_pagar", input: tripla, output: `título ${payableId}`, result: "concluido", at: now() },
    ],
    `Lançado: ${conta} · ${categoria} (${codigo})`,
  );
  recordActivity(state, {
    actor: { kind: "agent", id: agent.id },
    delegate: memberActor(actingMemberId),
    action: REGISTRO_LANCADO_NO_OMIE,
    objectType: "task",
    objectId: task.id,
    objectName: task.title,
    detail: `título ${payableId}${resultado.reaproveitado ? " (já existia)" : ""} · ${tripla}`,
  });

  const movida = changeTaskStatus(state, actingMemberId, task.id, CP.status.lancado);
  if (!movida.ok) return desfazer(movida.error, movida.field);
  return ok(task, task.id);
}

/**
 * Fluxo 7, falha permanente (D6-03, como o backend legado): o Agente comenta
 * o motivo no fio (resposta, se há fio; raiz, se não), com Menção ao
 * Financeiro, e a conta VOLTA para "para pagar" — texto canônico
 * `Não consegui lançar no Omie: {motivo} ({code}). A conta voltou para "para pagar".`
 * O `motivo` fica só no Comentário (pode citar fornecedor); o Registro
 * guarda o `code`.
 *
 * Tudo ou nada (06-11, crm:WR-10): as guardas são `guardasDoAgente`, as
 * mesmas das operações irmãs, e a ordem é pensada para que uma recusa nunca
 * deixe metade:
 *   1. decide se tenta voltar (só a partir de "em lançamento omie");
 *   2. publica o aviso PRIMEIRO — se o Comentário for recusado, nada foi
 *      escrito ainda;
 *   3. volta o Status; se a volta for RECUSADA, desfaz o aviso recém-criado
 *      (Comentário, Registro, `updatedAt`) e publica no lugar dele o texto que
 *      diz que a conta NÃO voltou, com o porquê — o aviso vale mais que a
 *      simetria (06-01), e o texto nunca afirma uma volta que não houve;
 *   4. grava o Registro da falha (`REGISTRO_LANCAMENTO_FALHOU`) por último.
 * O Comentário vem antes do Status porque ele se desfaz com segurança, e a
 * mudança de Status não (roda as Automações da Lista).
 *
 * Alternativa de D6-03 (ficar em "em lançamento omie"): é tirar o passo 3
 * (`tentaVoltar` sempre falso).
 *
 * `opcoes.avisarId` (aditivo): quem a Menção avisa, no lugar do Financeiro —
 * ver `avisadoDaConferencia`. Com `opcoes.avisarEstrito` (06-19, crm2:WR-04),
 * um `avisarId` que não é Membro ativo recusa sem efeito, antes de qualquer
 * escrita — a porta de teste falha fechada, e a Maryane não é mencionada.
 *
 * `opcoes.superarConferencia` (aditivo, 06-12): com a Conferência vigente
 * `aprovada`, o passo 4 é precedido da superação dela — `decision =
 * "cancelada"` e o Registro "Conferência superada", no molde de
 * `solicitarConferenciaDoResumo`. É a saída depois de `CONTA_DIVERGENTE`
 * (crm:WR-09): a Conferência afirmou uma conta corrente que o Omie não usaria
 * mais, e só um Resumo NOVO, com a conta de agora, pode ser conferido — sem a
 * superação, `publicarResumoParaConferencia` devolveria a aprovada para a
 * mesma impressão, e a conta ficaria sem saída. No
 * `TITULO_EXISTENTE_DIVERGENTE` a opção NÃO vai: a Conferência continua certa
 * sobre a conta; o que está errado é o título antigo no Omie, e o caminho é
 * corrigi-lo ou excluí-lo lá e mover a conta de novo (o texto de
 * `tituloDivergente`). Nada da superação pode falhar: não há o que desfazer.
 */
export function registrarFalhaDoLancamento(
  state: DataState,
  actingMemberId: Id,
  taskId: Id,
  falha: { readonly motivo: string; readonly code: string },
  opcoes: { readonly avisarId?: Id; readonly avisarEstrito?: true; readonly superarConferencia?: true } = {},
): OperationResult<Task> {
  const guardas = guardasDoAgente(state, actingMemberId, taskId);
  if (typeof guardas === "string") return fail(guardas);
  const { agent, task } = guardas;
  const avisarInativo = recusaDoAvisarEstrito(state, opcoes);
  if (avisarInativo) return fail(avisarInativo);
  const motivo = falha.motivo.trim() || "motivo não informado";
  const code = falha.code.trim() || "SEM_CODIGO";

  const tentaVoltar = task.statusId === CP.status.emLancamento;
  const vigente = conferenciaVigente(state, task.id);
  const raiz = vigente ? task.comments.find((c) => c.id === vigente.origin.threadCommentId && !c.deletedAt) : undefined;
  const avisar = (texto: string) =>
    addTaskComment(state, actingMemberId, task.id, {
      content: texto,
      mentions: [{ type: "member", id: avisadoDaConferencia(state, actingMemberId, opcoes.avisarId) }],
      actor: { kind: "agent", id: agent.id },
      ...(raiz ? { parentCommentId: raiz.id } : {}),
    });

  const antes = { activity: state.activity.length, comments: task.comments.length, updatedAt: task.updatedAt };
  const aviso = avisar(tentaVoltar ? TEXTOS_DA_CONFERENCIA.falha(motivo, code) : TEXTOS_DA_CONFERENCIA.falhaSemVolta(motivo, code));
  if (!aviso.ok) return fail(aviso.error, aviso.field);

  let recusaDoStatus: string | undefined;
  if (tentaVoltar) {
    const volta = changeTaskStatus(state, actingMemberId, task.id, CP.status.paraPagar);
    if (!volta.ok) {
      recusaDoStatus = volta.error;
      // O aviso publicado dizia que a conta voltou: sai, e entra o que diz que não.
      task.comments.splice(antes.comments);
      // `recordActivity` insere no INÍCIO: os Registros novos estão nos primeiros índices.
      state.activity.splice(0, state.activity.length - antes.activity);
      task.updatedAt = antes.updatedAt;
      const semVolta = avisar(TEXTOS_DA_CONFERENCIA.falhaSemVolta(motivo, code, recusaDoStatus));
      if (!semVolta.ok) return fail(semVolta.error, semVolta.field);
    }
  }

  if (opcoes.superarConferencia && vigente && vigente.decision === "aprovada") {
    vigente.decision = "cancelada";
    vigente.decidedAt = now();
    recordActivity(state, {
      actor: { kind: "agent", id: agent.id },
      delegate: memberActor(actingMemberId),
      action: "Conferência superada",
      objectType: "approvalRequest",
      objectId: vigente.id,
      objectName: task.title,
      before: "aprovada",
      after: "cancelada",
      detail: `A conferência não serve mais ao lançamento (${code}): um Resumo novo será publicado`,
    });
  }

  recordActivity(state, {
    actor: { kind: "agent", id: agent.id },
    delegate: memberActor(actingMemberId),
    action: REGISTRO_LANCAMENTO_FALHOU,
    objectType: "task",
    objectId: task.id,
    objectName: task.title,
    detail: recusaDoStatus ? `${code} — Status não voltou: ${recusaDoStatus}` : code,
  });
  return ok(task, task.id);
}

/**
 * 06-19 (crm2:WR-01) — a marca "Lançamento no Omie em curso": a ponte vai
 * chamar o `/lancar` desta conta AGORA. Fora de `OPERACOES` e da rota: só a
 * ponte chama, numa Unidade de Trabalho imediatamente antes do `/lancar`, e
 * depois de perguntar de novo, sobre o estado da gravação, se a conta ainda
 * pode ser lançada.
 *
 * Enquanto a marca vale (`lancamentoEmCursoDe`: até o registro, a falha, o
 * encerramento ou `PRAZO_DO_LANCAMENTO_EM_CURSO_MS`), nenhum OUTRO Membro muda
 * o Status da conta nem registra o lançamento à mão (`./tasks`). Quem marcou
 * passa: é ele quem move em `registrarLancamentoNoOmie` e
 * `registrarFalhaDoLancamento`, e esses Registros encerram a marca.
 *
 * Toda recusa antes da escrita: `guardasDoAgente`; a conta em "em lançamento
 * omie"; a Conferência `conferida`; nenhuma marca vigente de outro Membro.
 * Uma marca vigente do MESMO Membro é renovada (Registro novo, prazo novo) —
 * a repetição do `/lancar` depois de um conflito no registro.
 */
export function marcarLancamentoEmCurso(state: DataState, actingMemberId: Id, taskId: Id): OperationResult<Task> {
  const guardas = guardasDoAgente(state, actingMemberId, taskId);
  if (typeof guardas === "string") return fail(guardas);
  const { agent, task } = guardas;
  if (task.statusId !== CP.status.emLancamento) return fail("O lançamento só começa com a conta em “em lançamento omie”.");
  const { estado } = conferenciaDoResumo(state, task);
  if (estado !== "conferida") return fail(`Sem Conferência aprovada para os dados atuais (${estado}): o lançamento não começa.`);
  const agora = now();
  const vigente = lancamentoEmCursoDe(state, task, agora);
  if (vigente && vigente.porMembroId !== actingMemberId) return fail("Outro lançamento desta conta já está em curso.");
  recordActivity(state, {
    actor: { kind: "agent", id: agent.id },
    delegate: memberActor(actingMemberId),
    action: REGISTRO_LANCAMENTO_EM_CURSO,
    objectType: "task",
    objectId: task.id,
    objectName: task.title,
    at: agora,
    detail: `até ${new Date(Date.parse(agora) + PRAZO_DO_LANCAMENTO_EM_CURSO_MS).toISOString()}`,
  });
  return ok(task, task.id);
}

/**
 * 06-19 (crm2:WR-01) — a ponte desiste do `/lancar` sem registro e sem falha
 * permanente registrada (falha transitória, título não confirmado, conta que
 * saiu antes do registro, registro recusado, conflito que vira parada): a
 * marca sai, com um Registro "Lançamento no Omie interrompido" cujo `detail`
 * é SÓ o código fixo — nunca texto livre. Fora de `OPERACOES`.
 *
 * Sem marca vigente, ou com a marca de outro Membro: recusa sem efeito (o
 * prazo cobre o que ficar).
 */
export function encerrarLancamentoEmCurso(state: DataState, actingMemberId: Id, taskId: Id, code: string): OperationResult<Task> {
  const guardas = guardasDoAgente(state, actingMemberId, taskId);
  if (typeof guardas === "string") return fail(guardas);
  const { agent, task } = guardas;
  const vigente = lancamentoEmCursoDe(state, task);
  if (!vigente) return fail("Não há lançamento desta conta em curso.");
  if (vigente.porMembroId !== actingMemberId) return fail("O lançamento em curso desta conta é de outro Membro.");
  recordActivity(state, {
    actor: { kind: "agent", id: agent.id },
    delegate: memberActor(actingMemberId),
    action: REGISTRO_LANCAMENTO_INTERROMPIDO,
    objectType: "task",
    objectId: task.id,
    objectName: task.title,
    detail: code.trim() || "SEM_CODIGO",
  });
  return ok(task, task.id);
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
