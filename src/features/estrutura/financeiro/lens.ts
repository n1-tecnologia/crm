/**
 * A lente financeira sobre as Listas do Financeiro (Contas a pagar, Contas a
 * receber): puro, sem React, para ser testado. Os grupos (a pagar, vencidas,
 * em cobrança, recebidas…) são derivados do Status e do vencimento — nunca
 * gravados na Tarefa. O que difere entre as duas Listas está no
 * `FinanceProfile`; a tabela, o drawer e os filtros são os mesmos.
 */

import { CP, CR, clienteDe } from "@/data/operations/financeiro";
import {
  contactDisplayName,
  effectiveListConfig,
  isOverdue,
  isTerminalCategory,
  statusCategory,
} from "@/data/derive";
import type { DataState } from "@/data/state";
import type { Id, Task } from "@/data/types";

export type FinanceGroup =
  | "autorizacao"
  | "aPagar"
  | "vencidas"
  | "programadas"
  | "pagas"
  | "negadas"
  | "aReceber"
  | "emCobranca"
  | "saque"
  | "recebidas"
  | "descartadas";

export const GROUP_LABEL: Record<FinanceGroup, string> = {
  autorizacao: "Aguardando autorização",
  aPagar: "A pagar",
  vencidas: "Vencidas",
  programadas: "Programadas",
  pagas: "Pagas",
  negadas: "Negadas",
  aReceber: "A receber",
  emCobranca: "Em cobrança",
  saque: "Disponível para saque",
  recebidas: "Recebidas",
  descartadas: "Descartadas e estornadas",
};

/** Uma ação rápida da linha/drawer: leva a conta a um Status, com confirmação. */
export interface FinanceQuickAction {
  readonly label: string;
  readonly statusId: Id;
  /** Por que não se aplica a ESTA conta (antes das regras da Lista). */
  readonly notApplicable: (task: Task) => string | undefined;
}

/**
 * O que muda entre Contas a pagar e Contas a receber: os grupos, os cartões,
 * as ações rápidas, quem é a contraparte e as palavras. A tabela, o drawer e
 * os filtros são os mesmos.
 */
export interface FinanceProfile {
  readonly listId: Id;
  readonly kind: "pagar" | "receber";
  readonly groups: readonly FinanceGroup[];
  readonly groupOf: (state: DataState, task: Task, now: Date) => FinanceGroup;
  /** Os quatro cartões, na ordem; `pagas`/`recebidas` ganha a nota "neste mês". */
  readonly cards: ReadonlyArray<{ readonly grupo: FinanceGroup; readonly label: string }>;
  readonly settledStatusId: Id;
  readonly quickActions: readonly [FinanceQuickAction, FinanceQuickAction];
  readonly counterpart: (state: DataState, task: Task) => string;
  readonly labels: {
    readonly description: string;
    readonly nova: string;
    readonly novaPlaceholder: string;
    readonly buscar: string;
    readonly contraparte: string;
    readonly semContas: string;
    readonly settledNota: string;
  };
  /** Campos com arquivo que o drawer lista como anexos. */
  readonly attachmentFieldIds: readonly Id[];
  /** Linhas do drawer além de contraparte, Empresa e Centro de custo; `data` é um dia civil que a tela formata. */
  readonly drawerRows: (state: DataState, task: Task) => ReadonlyArray<{ readonly rotulo: string; readonly valor: string; readonly data?: string }>;
}

const pagarGroupOf = (state: DataState, task: Task, now: Date): FinanceGroup => {
  const categoria = statusCategory(state, task);
  if (task.statusId === CP.status.pago) return "pagas";
  if (task.statusId === CP.status.negado) return "negadas";
  if (!isTerminalCategory(categoria) && isOverdue(state, task, now)) return "vencidas";
  if (task.statusId === CP.status.emAutorizacao) return "autorizacao";
  if (task.statusId === CP.status.paraPagar) return "aPagar";
  return "programadas";
};

const receberGroupOf = (state: DataState, task: Task, now: Date): FinanceGroup => {
  if (task.statusId === CR.status.recebido) return "recebidas";
  if (task.statusId === CR.status.descartado || task.statusId === CR.status.estornado) return "descartadas";
  if (task.statusId === CR.status.pendente) return "emCobranca";
  if (task.statusId === CR.status.disponivelSaque) return "saque";
  if (isOverdue(state, task, now)) return "vencidas";
  return "aReceber";
};

export const PAGAR_PROFILE: FinanceProfile = {
  listId: CP.listId,
  kind: "pagar",
  groups: ["autorizacao", "aPagar", "vencidas", "programadas", "pagas", "negadas"],
  groupOf: pagarGroupOf,
  cards: [
    { grupo: "aPagar", label: "A pagar" },
    { grupo: "vencidas", label: "Vencidas" },
    { grupo: "autorizacao", label: "Aguardando autorização" },
    { grupo: "pagas", label: "Pagas" },
  ],
  settledStatusId: CP.status.pago,
  quickActions: [
    {
      label: "Autorizar pagamento",
      statusId: CP.status.aprovado,
      notApplicable: (task) => (task.statusId !== CP.status.emAutorizacao ? "Só uma conta em autorização bancária se autoriza." : undefined),
    },
    {
      label: "Marcar como paga",
      statusId: CP.status.pago,
      notApplicable: (task) => (task.statusId === CP.status.pago ? "Já está paga." : undefined),
    },
  ],
  counterpart: (state, task) => fornecedorDe(state, task),
  labels: {
    description: "Gerencie autorizações, vencimentos e pagamentos",
    nova: "+ Nova conta",
    novaPlaceholder: "Nome da conta (fornecedor ou despesa)",
    buscar: "Buscar conta ou fornecedor",
    contraparte: "Fornecedor",
    semContas: "Nenhuma conta nesta Lista ainda.",
    settledNota: "neste mês",
  },
  attachmentFieldIds: [CP.fields.anexo, CP.fields.boleto, CP.fields.qrCode],
  drawerRows: (state, task) => {
    const campo = (id: Id) => textoDoCampo(task, id);
    const forma = campo(CP.fields.forma);
    const dado = campo(CP.fields.chavePix) || campo(CP.fields.codigoBarras) || campo(CP.fields.pixCopiaECola);
    return [
      { rotulo: "Categoria", valor: campo(CP.fields.categoria) || "—" },
      { rotulo: "Forma de pagamento", valor: forma ? `${forma}${dado ? ` · ${dado}` : ""}` : "—" },
      { rotulo: "Data de emissão", valor: "—", ...(campo(CP.fields.dataEmissao) ? { data: campo(CP.fields.dataEmissao) } : {}) },
    ];
  },
};

export const RECEBER_PROFILE: FinanceProfile = {
  listId: CR.listId,
  kind: "receber",
  groups: ["emCobranca", "vencidas", "aReceber", "saque", "recebidas", "descartadas"],
  groupOf: receberGroupOf,
  cards: [
    { grupo: "aReceber", label: "A receber" },
    { grupo: "vencidas", label: "Vencidas" },
    { grupo: "emCobranca", label: "Em cobrança" },
    { grupo: "recebidas", label: "Recebidas" },
  ],
  settledStatusId: CR.status.recebido,
  quickActions: [
    {
      label: "Iniciar cobrança",
      statusId: CR.status.pendente,
      notApplicable: (task) => (task.statusId === CR.status.pendente ? "Já está em cobrança." : task.statusId !== CR.status.paraReceber ? "Só uma conta “para receber” entra em cobrança." : undefined),
    },
    {
      label: "Marcar como recebida",
      statusId: CR.status.recebido,
      notApplicable: (task) => (task.statusId === CR.status.recebido ? "Já foi recebida." : undefined),
    },
  ],
  counterpart: (state, task) => {
    const cliente = clienteDe(state, task);
    if (cliente) return contactDisplayName(cliente);
    return textoDoCampo(task, CR.fields.tipo) === CR.tipos.saque ? "Plataforma" : "—";
  },
  labels: {
    description: "Acompanhe vencimentos, recebimentos e cobranças",
    nova: "+ Nova conta a receber",
    novaPlaceholder: "Nome da conta (cliente ou plataforma)",
    buscar: "Buscar conta ou cliente",
    contraparte: "Cliente",
    semContas: "Nenhuma conta a receber nesta Lista ainda.",
    settledNota: "neste mês",
  },
  attachmentFieldIds: [],
  drawerRows: (state, task) => {
    const campo = (id: Id) => textoDoCampo(task, id);
    const numero = campo(CR.fields.numeroParcela);
    const total = campo(CR.fields.totalParcelas);
    return [
      { rotulo: "Tipo", valor: `${campo(CR.fields.tipo) || "—"}${numero ? ` ${numero}/${total || "?"}` : ""}` },
      { rotulo: "Situação de cobrança", valor: campo(CR.fields.situacao) || "—" },
      { rotulo: "Forma de recebimento", valor: campo(CR.fields.forma) || "—" },
      { rotulo: "Data de pagamento", valor: "—", ...(campo(CR.fields.dataPagamento) ? { data: campo(CR.fields.dataPagamento) } : {}) },
      { rotulo: "Produto", valor: campo(CR.fields.produto) || "—" },
      { rotulo: "Conta de recebimento", valor: campo(CR.fields.contaRecebimento) || "—" },
    ];
  },
};

const PROFILES: Readonly<Record<Id, FinanceProfile>> = {
  [CP.listId]: PAGAR_PROFILE,
  [CR.listId]: RECEBER_PROFILE,
};

/** A lente financeira desta Lista, se ela for uma das do processo do Financeiro. */
export function financeProfileOf(listId: Id): FinanceProfile | undefined {
  return PROFILES[listId];
}

/** Compatibilidade: o grupo de uma conta pela lente da Lista dela. */
export function financeGroupOf(state: DataState, task: Task, now: Date): FinanceGroup {
  return (financeProfileOf(task.listId) ?? PAGAR_PROFILE).groupOf(state, task, now);
}

export const valorDaConta = (task: Task): number => {
  const v = task.fieldValues.find(
    (x) => x.definitionId === CP.fields.valor && x.state === "ativo",
  )?.value;
  return typeof v === "number" ? v : Number(v ?? 0) || 0;
};

export const textoDoCampo = (task: Task, definitionId: string): string => {
  const v = task.fieldValues.find(
    (x) => x.definitionId === definitionId && x.state === "ativo",
  )?.value;
  return v === undefined || v === null
    ? ""
    : Array.isArray(v)
      ? v.join(", ")
      : String(v);
};

/** O fornecedor que aparece na tabela: Pessoa (Membro), Nome do fornecedor, ou CNPJ/CPF. */
export function fornecedorDe(state: DataState, task: Task): string {
  const pessoa = textoDoCampo(task, CP.fields.pessoa);
  if (pessoa)
    return state.members.find((m) => m.id === pessoa)?.displayName ?? pessoa;
  return (
    textoDoCampo(task, CP.fields.nomeFornecedor) ||
    textoDoCampo(task, CP.fields.cnpj) ||
    textoDoCampo(task, CP.fields.cpf) ||
    "—"
  );
}

/**
 * Quando a conta foi paga. `completedAt` marca a conclusão (já em
 * "aprovado", que é terminal), então o momento do pagamento é a última
 * entrada em "pago" na Atividade; sem registro, cai no `completedAt`.
 */
export function pagoEm(state: DataState, task: Task): number | undefined {
  const settled = (financeProfileOf(task.listId) ?? PAGAR_PROFILE).settledStatusId;
  if (task.statusId !== settled) return undefined;
  const nome = effectiveListConfig(state, task.listId)?.statusSet.definitions.find(
    (d) => d.id === settled,
  )?.name;
  const entrada = state.activity
    .filter(
      (a) =>
        a.objectType === "task" &&
        a.objectId === task.id &&
        a.action === "Status alterado" &&
        a.result === "ok" &&
        a.after === nome,
    )
    .map((a) => Date.parse(a.at))
    .reduce<number | undefined>(
      (max, t) => (max === undefined || t > max ? t : max),
      undefined,
    );
  if (entrada !== undefined) return entrada;
  return task.completedAt ? Date.parse(task.completedAt) : undefined;
}

export interface FinanceFilters {
  readonly texto: string;
  readonly empresa: string;
  readonly periodo: "mes" | "30dias" | "vencidas" | "todos";
  readonly grupo: FinanceGroup | "";
}

export const FILTROS_INICIAIS: FinanceFilters = {
  texto: "",
  empresa: "",
  periodo: "todos",
  grupo: "",
};

/** Vencimento como instante local (dia civil ao meio-dia, como o seed). */
export const vencimentoDe = (t: Task): number =>
  t.dueDate
    ? Date.parse(
        t.dueDate.form === "civilDay"
          ? `${t.dueDate.value}T12:00:00`
          : t.dueDate.value,
      )
    : Number.NaN;

export function applyFinanceFilters(
  state: DataState,
  tasks: readonly Task[],
  f: FinanceFilters,
  now: Date,
): Task[] {
  const texto = f.texto.trim().toLocaleLowerCase("pt-BR");
  const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const fimMes = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
  ).getTime();
  const hoje = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const em30 = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 30,
  ).getTime();
  return tasks.filter((t) => {
    if (
      texto &&
      !(
        t.title.toLocaleLowerCase("pt-BR").includes(texto) ||
        (financeProfileOf(t.listId) ?? PAGAR_PROFILE).counterpart(state, t).toLocaleLowerCase("pt-BR").includes(texto) ||
        (t.readableId ?? "").toLocaleLowerCase("pt-BR").includes(texto)
      )
    )
      return false;
    if (f.empresa && textoDoCampo(t, CP.fields.empresa) !== f.empresa)
      return false;
    const grupo = financeGroupOf(state, t, now);
    if (f.grupo && grupo !== f.grupo) return false;
    const v = vencimentoDe(t);
    if (f.periodo === "mes" && !(v >= inicioMes && v <= fimMes)) return false;
    if (f.periodo === "30dias" && !(v >= hoje && v <= em30)) return false;
    if (f.periodo === "vencidas" && grupo !== "vencidas") return false;
    return true;
  });
}
