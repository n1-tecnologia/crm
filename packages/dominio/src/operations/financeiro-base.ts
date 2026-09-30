/**
 * O módulo-folha da Conferência do Resumo (06-11, crm:WR-08): o que `./ai`
 * (decidir a Conferência) e `./tasks` (resolver o fio do Resumo) precisam
 * ler — a impressão de lançamento, a Conferência vigente e quem revisa — sem
 * importar `./financeiro`, que importa os dois. Por isso este arquivo só tem
 * `import type`: qualquer módulo do domínio o importa sem ciclo, nem em tempo
 * de carga nem em tempo de tipo.
 *
 * `./financeiro` reexporta `CP`, `impressaoDeLancamento`, `revisoresDoResumo`,
 * `FORMA_DO_CODIGO_DE_CATEGORIA`, `lancamentoSemCodigo`, o tipo
 * `ConferenciaDoResumo` e, desde 06-18, `MOTIVO_DA_DISPENSA`,
 * `dispensaDaConferencia`, `dispensaSemManual` e `conferenciaMaisRecente`:
 * quem já os importa de lá continua importando de lá.
 *
 * Puro: nenhuma dependência de execução, nenhum I/O.
 */

import type { DataState } from "../state";
import type { ApprovalOrigin, ApprovalRequest, Id, Task } from "../types";

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

export function fieldValue(task: Task, definitionId: Id): string {
  const v = task.fieldValues.find((x) => x.definitionId === definitionId && x.state === "ativo")?.value;
  if (v === undefined || v === null) return "";
  return Array.isArray(v) ? v.join(", ") : String(v);
}

/** A `ApprovalRequest` de uma Conferência do Resumo — o ramo `resumo` de `ApprovalOrigin`. */
export type ConferenciaDoResumo = ApprovalRequest & { origin: Extract<ApprovalOrigin, { readonly processStep: "resumo" }> };

export function ehConferenciaDoResumo(a: ApprovalRequest): a is ConferenciaDoResumo {
  // Um registro hidratado de antes da Fase 2 pode chegar sem `origin` (`normalizeApprovalOrigin`).
  const origin = a.origin as ApprovalOrigin | undefined;
  return origin?.kind === "processTask" && origin.processStep === "resumo";
}

/**
 * A Conferência do Resumo MAIS RECENTE da Tarefa, qualquer que seja a decisão
 * (por `createdAt`, empate pela ordem de gravação) — mesmo cancelada. É onde
 * mora o fio do Resumo: depois de uma superação, o Resumo novo responde no
 * fio dela (06-18, crm2:IN-01), e a conta continua com um fio só.
 */
export function conferenciaMaisRecente(state: DataState, taskId: Id): ConferenciaDoResumo | undefined {
  let maisRecente: ConferenciaDoResumo | undefined;
  for (const a of state.approvals) {
    if (!ehConferenciaDoResumo(a) || a.origin.taskId !== taskId) continue;
    if (!maisRecente || a.createdAt >= maisRecente.createdAt) maisRecente = a;
  }
  return maisRecente;
}

/**
 * A Conferência que vale: a MAIS RECENTE da Tarefa (`conferenciaMaisRecente`);
 * se ela estiver `cancelada` ou `expirada`, nenhuma.
 *
 * 06-12 (crm:WR-09): até aqui a regra era "a mais recente que não foi
 * cancelada". Todo fluxo existente dá o mesmo resultado, porque o único
 * cancelamento era o das pendentes MAIS ANTIGAS quando sai um Resumo novo
 * (`solicitarConferenciaDoResumo`). A superação de
 * `registrarFalhaDoLancamento(…, { superarConferencia: true })` é o primeiro
 * caso em que a mais recente é cancelada — e uma Conferência antiga
 * (rejeitada ou aprovada) nunca pode voltar a ser a vigente: ela afirmou
 * outra coisa, sobre outro momento da conta.
 */
export function conferenciaVigente(state: DataState, taskId: Id): ConferenciaDoResumo | undefined {
  const maisRecente = conferenciaMaisRecente(state, taskId);
  if (!maisRecente || maisRecente.decision === "cancelada" || maisRecente.decision === "expirada") return undefined;
  return maisRecente;
}

/**
 * D6-04 `sem-conferencia` — o motivo que a ponte grava na dispensa (e no
 * Registro "Aprovação decidida"). Mora no domínio desde 06-18: a leitura de
 * compatibilidade de `dispensaDaConferencia` depende desta string exata.
 */
export const MOTIVO_DA_DISPENSA = "Conferência dispensada (Integração manual)";

/**
 * A Conferência foi DISPENSADA (D6-04), não conferida por uma pessoa: aprovada
 * com `decisionWaiver === "integracaoManual"` (06-18, crm2:CR-01).
 *
 * Leitura de compatibilidade, fail-closed, para os registros gravados antes de
 * 06-18 (sem o campo): a forma que só a ponte gravava — o motivo exato
 * `MOTIVO_DA_DISPENSA` e o decisor igual ao aprovador (o Membro de serviço que
 * se designou). Ela só torna uma aprovação MENOS válida, nunca mais.
 */
export function dispensaDaConferencia(c: ApprovalRequest): boolean {
  if (c.decision !== "aprovada") return false;
  if (c.decisionWaiver === "integracaoManual") return true;
  return c.decisionWaiver === undefined && c.decisionReason === MOTIVO_DA_DISPENSA && c.decidedByMemberId === c.approverMemberId;
}

/**
 * A dispensa não vale mais: a Conferência foi dispensada e a conta deixou de
 * ser "Manual" (06-18, crm2:CR-01). Desmarcar "Integração manual" é o sinal
 * de "agora quero conferir": ninguém conferiu nada, e a Conferência não cobre
 * a conta — em qualquer modo da ponte, inclusive depois de voltar para
 * `nao-encosta`.
 */
export function dispensaSemManual(task: Task, c: ApprovalRequest): boolean {
  return dispensaDaConferencia(c) && fieldValue(task, CP.fields.integracaoManual) !== "Manual";
}

/** JSON com as chaves ordenadas em todos os níveis: a mesma conta dá sempre a mesma string, seja qual for a ordem de montagem. */
function jsonCanonico(valor: unknown): string {
  if (Array.isArray(valor)) return `[${valor.map(jsonCanonico).join(",")}]`;
  if (valor !== null && typeof valor === "object") {
    const registro = valor as Record<string, unknown>;
    const chaves = Object.keys(registro)
      .filter((k) => registro[k] !== undefined)
      .sort();
    return `{${chaves.map((k) => `${JSON.stringify(k)}:${jsonCanonico(registro[k])}`).join(",")}}`;
  }
  return JSON.stringify(valor ?? null);
}

function tagDeContaDe(state: DataState, task: Task): string {
  return task.tagIds.map((id) => state.tags.find((t) => t.id === id)?.name ?? "").find((n) => n.startsWith("conta ")) ?? "";
}

/**
 * A impressão de lançamento (D6-10): tudo o que vai ao Omie, e nada além.
 * Se ela muda depois da Conferência, a Conferência fica `desatualizada` — o
 * Financeiro conferiu OUTRA conta. Anexo, Boleto, QR Code e Comentários não
 * entram (não mudam o título); a Data de Emissão entra (vai ao Omie).
 * É a mesma função que a ponte usa para a parada por impressão.
 */
export function impressaoDeLancamento(state: DataState, task: Task): string {
  const forma = fieldValue(task, CP.fields.forma);
  const tipo = fieldValue(task, CP.fields.fornecedor);
  const dado =
    forma === "Chave Pix"
      ? fieldValue(task, CP.fields.chavePix)
      : forma === "Boleto"
        ? fieldValue(task, CP.fields.codigoBarras)
        : forma === "QRCode Pix"
          ? fieldValue(task, CP.fields.pixCopiaECola)
          : "";
  return jsonCanonico({
    centro: fieldValue(task, CP.fields.centroDeCusto),
    empresa: fieldValue(task, CP.fields.empresa),
    categoria: fieldValue(task, CP.fields.categoria),
    fornecedor: {
      tipo,
      documento: tipo === "CPF" ? fieldValue(task, CP.fields.cpf) : tipo === "CNPJ" ? fieldValue(task, CP.fields.cnpj) : "",
      nome: fieldValue(task, CP.fields.nomeFornecedor),
    },
    forma,
    dado,
    valor: fieldValue(task, CP.fields.valor),
    vencimento: task.dueDate?.value ?? "",
    dataEmissao: fieldValue(task, CP.fields.dataEmissao),
    tag: tagDeContaDe(state, task),
    titulo: task.title,
    descricao: task.description ?? "",
  });
}

/**
 * D6-09 — quem confere o Resumo: o Financeiro (`CP.financeiroId`, quando
 * Membro ativo) e todo Membro ativo de Papel base Administrador/Proprietário.
 * Uma função só, para o Papel "Revisor do Resumo" (L-11) entrar depois sem
 * tocar o resto.
 */
export function revisoresDoResumo(state: DataState): Id[] {
  const revisores: Id[] = [];
  const financeiro = state.members.find((m) => m.id === CP.financeiroId && m.state === "ativo");
  if (financeiro) revisores.push(financeiro.id);
  for (const m of state.members) {
    if (m.state !== "ativo" || revisores.includes(m.id)) continue;
    const base = state.roles.find((r) => r.id === m.roleId)?.base;
    if (base === "administrador" || base === "proprietario") revisores.push(m.id);
  }
  return revisores;
}

/**
 * A forma de um código do plano de contas do Omie — a do contrato
 * `contas-a-pagar-v1` v1.1, e a régua que a ponte usa desde 06-12:
 * `2.06.01` e `2.02.98.01`. Não é `d.dd.dd` estrito de propósito: o plano de
 * contas real tem códigos de quatro níveis, e recusá-los seria regressão.
 */
export const FORMA_DO_CODIGO_DE_CATEGORIA = /^\d(\.\d{2}){2,3}$/;

/**
 * crm:WR-03 (06-11) — o Resumo não tem código de Categoria que se confira:
 * a Categoria veio `ausente` do de-para (o `9.99.99` é preenchimento, "A
 * classificar", não código), ou o código está fora da forma do contrato.
 * Sem `trim`: o código é DADO da Conferência (D6-10), não texto a limpar.
 * `revisar` com código bem formado NÃO é "sem código" (D6-02: quem decide é
 * o Financeiro); `9.99.99` com `resolvida` (de-para do protótipo) também
 * não — quem valida o código no plano de contas real é o `/lancar`.
 */
export function lancamentoSemCodigo(l: { readonly codigo: string; readonly veredito: "resolvida" | "revisar" | "ausente" }): boolean {
  return l.veredito === "ausente" || !FORMA_DO_CODIGO_DE_CATEGORIA.test(l.codigo);
}
