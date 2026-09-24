/**
 * A metade "ler e entender" de REC-01: lê o export em disco da Lista
 * `901107648977` (ClickUp) e traduz cada Tarefa para o contrato que
 * `importarContaAReceberHistorica` (`@n1/dominio/operations/importacao-contas-a-receber`,
 * Plan 05-11 Task 1) espera. O `--apply` que de fato chama a operação e grava
 * `plataforma.importacao_ledger` mora em `./importar-contas-a-receber.ts`;
 * este arquivo não abre transação nenhuma.
 *
 * A leitura do disco (`task/*.json` + `time-in-status/*.json`, a conferência
 * de `sha256` contra `MANIFESTO.json`) é GENÉRICA e já existe em
 * `./contas-a-pagar.ts` (Plan 03-10) — reaproveitada aqui por referência
 * (`lerContasAReceberDoExport`/`verificarIntegridadeDoExport` são o MESMO
 * leitor, sem nenhuma linha específica de Contas a pagar dentro do corpo).
 * Reescrevê-lo aqui duplicaria a única parte do módulo que já foi testada
 * contra o export real (03-10, caso k) sem ganhar nada — regra de dependência
 * do `../CONTEXT.md` (`apps/api` conhece `@n1/dominio`; entre si, os dois
 * mapeadores de `clickup/` podem se conhecer, nenhum conhece rota nem SQL).
 *
 * O que é regra de importação — o que faz uma Conta a receber histórica
 * válida, o que vira Registro de Atividade — é de `@n1/dominio`. Aqui só se
 * traduz o vocabulário do ClickUp (nomes de Status, Tags, o nome da Tarefa,
 * o Vínculo com o cliente) para os ids da plataforma.
 *
 * ## Assinatura de `mapearContaAReceber`
 *
 * O plano descreve `mapearContaAReceber(tarefaDoExport, contexto):
 * EntradaDeContaAReceberHistorica`. Na prática, como no irmão de Contas a
 * pagar, uma linha pode ser RECUSADA antes de virar entrada (Status final sem
 * equivalente — "status-legado-desconhecido" — a Tarefa não é importada, só
 * contada). A assinatura real devolve `ClassificacaoDeContaAReceber`
 * (resultado "valida" | "rejeitada"), no molde de `classificarTarefaLegada`,
 * e recebe `historico` como segundo parâmetro (o `status_history`, sem o
 * qual não há transição nenhuma para preencher `entrada.transicoes`) — o
 * "tarefaDoExport" do plano é o par (tarefa, histórico) junto.
 *
 * ## O catálogo de clientes — por que entra como `contexto`, não é lido aqui
 *
 * Resolver "Daniel Botelho" contra o CRM real (Contato ou Empresa, D5-12)
 * exige o `DataState` hidratado do Espaço de Trabalho — algo que só existe
 * dentro de uma transação Postgres. Este arquivo não abre transação (não faz
 * I/O nenhum, ponto), então o catálogo chega pronto em `contexto` — a
 * orquestração (`./importar-contas-a-receber.ts`, Task 3) hidrata `ws_n1`
 * UMA vez, no início, e monta `ContextoDeMapeamento.catalogoDeClientes` a
 * partir de `state.contacts`/`state.companies`.
 *
 * ## O que nunca entra em `motivo`/`lacunas` (D-25, T-02-21)
 *
 * Categoria e `legacyTaskId`, nunca o nome do cliente nem um valor
 * monetário. Duas categorias citam o id legado do OUTRO lado da história
 * (nunca um nome): `parcela-duplicada:<idDaOutra>` (RN-CR-07) e
 * `subtarefa-desamarrada:<idDoPai>` (RN-CR-06) — a orquestração agrupa por
 * categoria cortando no primeiro `:`, então o relatório por categoria
 * continua contando "quantas parcela-duplicada", não uma linha por par.
 */

import { CP, CR } from "@n1/dominio/operations/financeiro";
import {
  ORIGEM_CONTAS_A_RECEBER,
  type EntradaDeContaAReceberHistorica,
  type TransicaoHistoricaDeStatusCR,
} from "@n1/dominio/operations/importacao-contas-a-receber";
import type { CivilDate, FieldValue, Id, Instant, TaskDate } from "@n1/dominio/types/primitives";

import {
  comoDiaCivil,
  comoInstanteDeEpoch,
  lerTarefasDoExport,
  verificarIntegridadeDoExport,
  type HistoricoClickUpBruto,
  type TarefaClickUpBruta,
} from "./contas-a-pagar";

// `ORIGEM_CONTAS_A_RECEBER` reexportada só para o CLI nunca precisar importar
// de dois lugares — o valor em si vem de `@n1/dominio`, nunca é reescrito.
export { ORIGEM_CONTAS_A_RECEBER };

// Leitor de disco genérico (ver cabeçalho) — mesmo corpo, nomes que fazem
// sentido do lado de Contas a receber.
export const lerContasAReceberDoExport = lerTarefasDoExport;
export const verificarIntegridadeDoExportDeContasAReceber = verificarIntegridadeDoExport;
export { comoDiaCivil, comoInstanteDeEpoch };

/* ─────────────────────────── De-para de Status ─────────────────────────── */

/**
 * Os 6 Status do Conjunto efetivo da Lista (`list.json`), 1-para-1 com
 * `CR.status` — os nomes batem exatamente, sem prefixo nem variação de caixa.
 * `to do`/`a pagar` aparecem no HISTÓRICO (`time-in-status`) sem equivalente
 * — viajam só como `nomeLegado`, nunca travam a importação (a recusa é só
 * quando o Status FINAL não resolve).
 */
export const DE_PARA_DE_STATUS_CR = {
  "para receber": CR.status.paraReceber,
  "disponível para saque": CR.status.disponivelSaque,
  pendente: CR.status.pendente,
  estornado: CR.status.estornado,
  descartado: CR.status.descartado,
  recebido: CR.status.recebido,
} as const satisfies Readonly<Record<string, Id>>;

/* ─────────────────────────── De-para de Campos ─────────────────────────── */

/** `A-Centro de Custo`, `B-BU`, `C-Empresa`, `U-Integração manual` — Definições herdadas do Espaço "Gestão", MESMOS ids de Contas a pagar (docs §4). */
const ID_CAMPO_CENTRO_DE_CUSTO = "8489b2e2-e5fe-47bf-bfbc-5ea900ab5f93";
const ID_CAMPO_BU = "4508f196-15be-4ca7-982a-657790490a78";
const ID_CAMPO_EMPRESA = "cc3ddcec-de22-42ce-9f44-5421b6cbb5e4";
const ID_CAMPO_INTEGRACAO_MANUAL = "d209c79e-a6a7-4e15-891c-2e4ca966a574";
/** `T-Valor` — MESMO id de Contas a pagar (Valor é da Pasta, não da Lista). */
const ID_CAMPO_VALOR = "ad484dcb-4a13-478d-9191-b1fe71658e50";
/** `Data de pagamento` — Definição EXCLUSIVA desta Lista (docs §4); tratada à parte, nunca em `campos` (D5-16). */
const ID_CAMPO_DATA_DE_PAGAMENTO = "c41d9418-824c-4beb-9264-e5b03e815c9d";
/** `Gestão de Clientes` (relacionamento → Lista `901109161381`, NÃO recriada, D5-12) — só alimenta a resolução de cliente, nunca em `campos`. */
const ID_CAMPO_GESTAO_DE_CLIENTES = "96bfbe25-cd92-4efe-9cb3-5d939c746764";

/** Destino de campo simples (singleSelect, herdado da Pasta) — mesmos 3 usados por Contas a receber no export real. */
const DE_PARA_DE_CAMPOS_SIMPLES = {
  [ID_CAMPO_CENTRO_DE_CUSTO]: CP.fields.centroDeCusto,
  [ID_CAMPO_BU]: CP.fields.bu,
  [ID_CAMPO_EMPRESA]: CP.fields.empresa,
  [ID_CAMPO_INTEGRACAO_MANUAL]: CP.fields.integracaoManual,
} as const satisfies Readonly<Record<string, Id>>;

/**
 * O domínio dos três Campos `singleSelect` herdados, copiado de
 * `packages/dominio/src/seed-financeiro.ts` (mesmas listas que
 * `./contas-a-pagar.ts` usa) — contra ele, não contra `type_config.options`
 * do ClickUp, que a opção resolvida precisa bater.
 */
const DOMINIO_DOS_CAMPOS: Readonly<Partial<Record<Id, readonly string[]>>> = {
  [CP.fields.centroDeCusto]: [
    "Marcos Paulo", "Renato Cariani", "Igor Alves", "Kaka Diniz", "PLX Apoio", "TRIA", "Anthony Miranda",
    "Tria Tech", "IVL", "Roberth Resende", "Presidência", "USI", "Konq", "Auton Health", "Kops", "Inevitaveis",
  ],
  [CP.fields.bu]: [
    "Roberth Resende", "Igor Alves", "CLAIRIS", "Marcos Paulo", "Instituto Visão Livre", "Renato Cariani",
    "TRIA - Apoio Funcional", "Kaka Diniz", "Iallas Oliveira", "Tria Tech", "Expert Lucrativo", "KONQ", "Auton Heath",
  ],
  [CP.fields.empresa]: [
    "Tria Company", "Oliveira Participações", "EXO Loteamento", "EXO Participações", "Loovi", "PLX digital",
    "IVL", "USI", "Konq Intermediações", "O2", "Inevitaveis",
  ],
  [CP.fields.integracaoManual]: ["Manual"],
};

/* ────────────────────────────── De-para de Tags ────────────────────────────── */

/**
 * "conta X" → o texto que `CR.fields.contaRecebimento` aceita (D5-17). Só
 * "conta tria" aparece no export real (2 Tarefas, docs §6); os outros 7 nomes
 * são o mesmo vocabulário de `./contas-a-pagar.ts` (`DE_PARA_DE_TAGS`),
 * cobertos por robustez, não porque o export os use.
 */
const DE_PARA_DE_TAG_PARA_CONTA: Readonly<Record<string, string>> = {
  "conta tria": "TRIA",
  "conta konq": "KONQ",
  "conta kops": "KOPS",
  "conta roberth": "ROBERTH",
  "conta auton": "AUTON",
  "conta tf tria": "TF TRIA",
  "conta arkline": "ARKLINE",
  "conta inevitaveis": "INEVITAVEIS",
};

/* ─────────────────────── D5-18 — as duas duplicatas e a subtarefa ─────────────────────── */

/**
 * RN-CR-07 — os quatro ids exatos de `docs/07-processos/contas-a-receber.md`
 * §11/§12: duas "7ª Parcela – Gabriela Melo" e duas "2ª Parcela – Sidney
 * Garcês". Mapa SIMÉTRICO (cada id aponta para o outro do par) — nem fusão,
 * nem exclusão: as duas entram, cada uma citando a outra (D5-18).
 */
const PAR_DUPLICADO: Readonly<Record<string, string>> = {
  "868cpd8zg": "868ffg91u",
  "868ffg91u": "868cpd8zg",
  "868cpdatn": "868dg4wy3",
  "868dg4wy3": "868cpdatn",
};

/** RN-CR-06 — a única Subtarefa indevida do export real; citada por id, não por regra genérica (a Lista tem Subtarefas desabilitadas por desenho). */
const ID_SUBTAREFA_INDEVIDA = "868cpdawp";

/* ─────────────────────────────── Conversores ───────────────────────────────── */

function comoTexto(valor: unknown): string | undefined {
  if (typeof valor === "string") {
    const texto = valor.trim();
    return texto === "" ? undefined : texto;
  }
  if (typeof valor === "number") return String(valor);
  return undefined;
}

/** Número com duas casas — mesmo molde de `comoMoeda` em `./contas-a-pagar.ts`. */
function comoMoeda(valor: unknown): number | undefined {
  const texto = typeof valor === "number" ? String(valor) : typeof valor === "string" ? valor : undefined;
  if (texto === undefined) return undefined;
  const numero = Number(texto.replace(",", "."));
  return Number.isFinite(numero) ? Number(numero.toFixed(2)) : undefined;
}

interface OpcaoBrutaDeClickUp {
  readonly name?: string;
  readonly label?: string;
}

interface CampoBrutoDeClickUp {
  readonly id: string;
  readonly type: string;
  readonly type_config?: { readonly options?: readonly OpcaoBrutaDeClickUp[] };
  readonly value?: unknown;
}

/** O valor de um `drop_down` é o ÍNDICE da opção; o nome resolvido passa por `.trim()` antes de qualquer comparação. */
function nomeDaOpcaoEscolhida(campo: CampoBrutoDeClickUp): string | undefined {
  if (typeof campo.value !== "number") return undefined;
  const opcao = campo.type_config?.options?.[campo.value];
  const nome = opcao?.name ?? opcao?.label;
  return nome === undefined ? undefined : nome.trim();
}

function possuiValor(campo: CampoBrutoDeClickUp): boolean {
  return "value" in campo && campo.value !== null && campo.value !== undefined;
}

/* ─────────────────────────── D5-12 — o catálogo de clientes ─────────────────────────── */

export interface ClienteDoCatalogo {
  readonly tipo: "contact" | "company";
  readonly id: Id;
  /** Nome de exibição já pronto para comparar (Contato: nome completo; Empresa: nome fantasia ou razão social). */
  readonly nome: string;
}

export interface ContextoDeMapeamento {
  readonly catalogoDeClientes: readonly ClienteDoCatalogo[];
}

/** NFD, minúsculas, espaços colapsados — mesma técnica de `duplicateSuspicions` (`@n1/dominio/derive.ts`), duplicada aqui porque não é exportada de lá. */
function normalizarNome(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Resolve um nome do ClickUp (o `name` do relacionamento "Gestão de
 * Clientes") contra o catálogo — Contato ou Empresa, D5-12. Comparação exata
 * após normalizar; `undefined` quando não há candidato no catálogo. NUNCA
 * cria Contato nem Empresa (a função só lê `contexto.catalogoDeClientes`).
 */
export function resolverClienteNoCatalogo(nomeDoClickUp: string, contexto: ContextoDeMapeamento): ClienteDoCatalogo | undefined {
  const alvo = normalizarNome(nomeDoClickUp);
  if (!alvo) return undefined;
  return contexto.catalogoDeClientes.find((c) => normalizarNome(c.nome) === alvo);
}

/* ─────────────────────────── Nome → Tipo / Número da parcela (D5-17) ─────────────────────────── */

const REGEX_PARCELA = /^(\d+)\s*ª?\s*parcela\b/i;

interface ClassificacaoDoNome {
  readonly tipo: string;
  readonly numeroParcela?: number;
  /** `true` quando o nome não casou com nenhum dos quatro padrões e caiu em "Avulso" (lacuna `tipo-inferido`). */
  readonly inferido: boolean;
}

/** Vocabulário da spec §5: "Entrada – X", "Nª Parcela – X", "Saque X" → os quatro `CR.tipos`. Nenhum casamento → Avulso + lacuna. */
function classificarNome(titulo: string): ClassificacaoDoNome {
  const normalizado = titulo.trim();
  if (/^entrada\b/i.test(normalizado)) return { tipo: CR.tipos.entrada, inferido: false };
  const parcela = normalizado.match(REGEX_PARCELA);
  if (parcela?.[1]) return { tipo: CR.tipos.parcela, numeroParcela: Number(parcela[1]), inferido: false };
  if (/^saque\b/i.test(normalizado)) return { tipo: CR.tipos.saque, inferido: false };
  return { tipo: CR.tipos.avulso, inferido: true };
}

/* ─────────────────────────────── Classificação (pura) ─────────────────────────────── */

export type ResultadoDeClassificacaoCR = "valida" | "rejeitada";

export interface ClassificacaoDeContaAReceber {
  readonly resultado: ResultadoDeClassificacaoCR;
  /** Categoria, nunca o valor problemático (D-25). */
  readonly motivo?: string;
  readonly legacyTaskId?: string;
  /** Presente só quando `resultado === "valida"`. */
  readonly entrada?: EntradaDeContaAReceberHistorica;
}

function adicionarLacuna(lacunas: string[], categoria: string): void {
  if (!lacunas.includes(categoria)) lacunas.push(categoria);
}

/* ─────────────────── Data de pagamento — a precedência de D5-16 (CR-06) ─────────────────── */

/** O que `instanteDaDataDePagamento` resolveu: o instante bruto e de onde ele veio. */
export interface ResolucaoDeDataDePagamento {
  readonly instante: Instant;
  readonly origem: "campo" | "date_closed";
}

/**
 * A precedência de D5-16 (Campo "Data de pagamento" sobre `date_closed`),
 * extraída para uma função exportada — mora AQUI e só aqui, para que a
 * correção auditada dos dados já importados (05-22) use exatamente a MESMA
 * regra, em vez de reimplementá-la contra o export cru. `mapearContaAReceber`
 * chama esta função; nada externo bisbilhota `custom_fields`/`date_closed`
 * por conta própria.
 *
 * O dia civil (CR-06) é resolvido pelo CHAMADOR (`comoDiaCivil` em
 * `America/Sao_Paulo`, o mesmo formatador do vencimento) — esta função só
 * devolve o instante bruto e a origem; ela não escolhe fuso.
 */
export function instanteDaDataDePagamento(tarefa: TarefaClickUpBruta): ResolucaoDeDataDePagamento | undefined {
  const campoDataDePagamento = (tarefa.custom_fields ?? []).find(
    (c): c is CampoBrutoDeClickUp => (c as CampoBrutoDeClickUp).id === ID_CAMPO_DATA_DE_PAGAMENTO && possuiValor(c as CampoBrutoDeClickUp),
  );
  if (campoDataDePagamento) {
    const instante = comoInstanteDeEpoch(campoDataDePagamento.value);
    if (instante) return { instante, origem: "campo" };
  }
  const fechadaEm = comoInstanteDeEpoch(tarefa.date_closed);
  if (fechadaEm) return { instante: fechadaEm, origem: "date_closed" };
  return undefined;
}

/**
 * Classifica UMA Tarefa de Contas a receber. Pura quanto ao disco (não lê
 * nada); depende só do `contexto` já pronto (catálogo de clientes) — ver o
 * cabeçalho do arquivo. Ordem: legacyTaskId → Status final → datas →
 * transições → Nome (Tipo/Parcela) → Campos → Valor do Saque (D5-14) → Data
 * de pagamento (D5-16) → Tags → duplicatas/subtarefa (D5-18) → Cliente (D5-12).
 */
export function mapearContaAReceber(
  tarefa: TarefaClickUpBruta,
  historico: HistoricoClickUpBruto,
  contexto: ContextoDeMapeamento,
): ClassificacaoDeContaAReceber {
  const legacyTaskId = comoTexto(tarefa.id);
  if (!legacyTaskId) return { resultado: "rejeitada", motivo: "taskid_ausente" };

  const statusFinalId = (DE_PARA_DE_STATUS_CR as Readonly<Record<string, Id>>)[tarefa.status.status];
  if (!statusFinalId) return { resultado: "rejeitada", motivo: "status-legado-desconhecido", legacyTaskId };

  const criadaEm = comoInstanteDeEpoch(tarefa.date_created);
  if (!criadaEm) return { resultado: "rejeitada", motivo: "criadaEm_ausente", legacyTaskId };
  const fechadaEm = comoInstanteDeEpoch(tarefa.date_closed);

  const lacunas: string[] = [];

  /* ── Transições ────────────────────────────────────────────────────── */
  const transicoes: TransicaoHistoricaDeStatusCR[] = [];
  for (const entradaHistorico of historico.status_history ?? []) {
    const em = comoInstanteDeEpoch(entradaHistorico.total_time?.since);
    if (!em) continue; // sem instante: não vira transição (mesma disciplina de descartar em vez de inventar).
    const statusId = (DE_PARA_DE_STATUS_CR as Readonly<Record<string, Id>>)[entradaHistorico.status];
    transicoes.push({ em, ...(statusId ? { statusId } : {}), nomeLegado: entradaHistorico.status });
  }
  if (transicoes.length === 0) return { resultado: "rejeitada", motivo: "historico_vazio", legacyTaskId };

  /* ── Vencimento nativo — mesmo portador único do irmão, sem duplicar em Campo ── */
  const vencimento: TaskDate | undefined = tarefa.due_date ? { form: "civilDay", value: comoDiaCivil(tarefa.due_date) ?? "" } : undefined;
  const vencimentoValido = vencimento && vencimento.value !== "" ? vencimento : undefined;

  /* ── Nome → Tipo de recebimento / Número da parcela (D5-17) ─────────── */
  const nome = classificarNome(tarefa.name);
  if (nome.inferido) adicionarLacuna(lacunas, "tipo-inferido");
  // D5-17 — o total não está no nome; nunca contado a partir das parcelas
  // presentes (inventaria dado). Só relevante quando há número de parcela.
  if (nome.tipo === CR.tipos.parcela) adicionarLacuna(lacunas, "total-de-parcelas-ausente");

  /* ── Campos herdados (A/B/C/U) ───────────────────────────────────────── */
  const campos: Record<Id, FieldValue["value"]> = {};
  let valorClickUp: number | undefined;
  for (const campoBruto of (tarefa.custom_fields ?? []) as readonly CampoBrutoDeClickUp[]) {
    if (campoBruto.id === ID_CAMPO_DATA_DE_PAGAMENTO || campoBruto.id === ID_CAMPO_GESTAO_DE_CLIENTES) continue; // tratados à parte
    if (!possuiValor(campoBruto)) continue;

    if (campoBruto.id === ID_CAMPO_VALOR) {
      valorClickUp = comoMoeda(campoBruto.value);
      continue;
    }
    const destino = (DE_PARA_DE_CAMPOS_SIMPLES as Readonly<Record<string, Id>>)[campoBruto.id];
    if (!destino) continue; // Y-Produto, W-Equipe — fora do escopo deste plano (não pedidos pela Task 2).
    const dominio = DOMINIO_DOS_CAMPOS[destino];
    if (dominio) {
      const nomeEscolhido = nomeDaOpcaoEscolhida(campoBruto);
      if (nomeEscolhido === undefined) continue;
      if (!dominio.includes(nomeEscolhido)) {
        adicionarLacuna(lacunas, "opcao_fora_do_dominio");
        continue;
      }
      campos[destino] = nomeEscolhido;
      continue;
    }
    const texto = comoTexto(campoBruto.value);
    if (texto !== undefined) campos[destino] = texto;
  }
  campos[CR.fields.tipo] = nome.tipo;
  if (nome.numeroParcela !== undefined) campos[CR.fields.numeroParcela] = nome.numeroParcela;

  /* ── Valor — D5-14: Saque exige Valor > 0; Valor 0/ausente nunca é gravado como legítimo ── */
  if (nome.tipo === CR.tipos.saque) {
    if (valorClickUp !== undefined && valorClickUp > 0) {
      campos[CP.fields.valor] = valorClickUp;
    } else {
      adicionarLacuna(lacunas, "saque-sem-valor");
    }
  } else if (valorClickUp !== undefined) {
    campos[CP.fields.valor] = valorClickUp;
  }

  /* ── Data de pagamento — D5-16/CR-06: a precedência mora em `instanteDaDataDePagamento`, o dia civil é resolvido AQUI, em São Paulo ── */
  const resolucaoDataDePagamento = instanteDaDataDePagamento(tarefa);
  let dataPagamento: CivilDate | undefined;
  if (resolucaoDataDePagamento) {
    // `comoDiaCivil` espera epoch (número/string numérica), não um `Instant`
    // ISO — `Date.parse` do instante já resolvido devolve o mesmo epoch que
    // gerou aquele instante (round-trip exato, mesmo formatador de São Paulo
    // do vencimento). O corte em UTC (`instante.slice(0, 10)`) morreu com CR-06.
    dataPagamento = comoDiaCivil(Date.parse(resolucaoDataDePagamento.instante));
    if (resolucaoDataDePagamento.origem === "date_closed") adicionarLacuna(lacunas, "data-de-pagamento-por-date-closed");
  }

  /* ── Tags → Campo (D5-17) — nunca viram Tag ──────────────────────────── */
  let situacaoDeTag: string | undefined;
  let contaDeTag: string | undefined;
  for (const tag of tarefa.tags ?? []) {
    if (tag.name === "inadimplência") situacaoDeTag = CR.situacoes.inadimplente;
    else if (tag.name === "em cobrança" && situacaoDeTag !== CR.situacoes.inadimplente) situacaoDeTag = CR.situacoes.emCobranca;
    const conta = DE_PARA_DE_TAG_PARA_CONTA[tag.name];
    if (conta) contaDeTag = conta;
  }
  campos[CR.fields.situacao] = situacaoDeTag ?? CR.situacoes.emDia;
  if (contaDeTag) campos[CR.fields.contaRecebimento] = contaDeTag;

  /* ── D5-18 — duplicata (RN-CR-07) e subtarefa indevida (RN-CR-06) ───── */
  const idDaDuplicata = PAR_DUPLICADO[legacyTaskId];
  if (idDaDuplicata) adicionarLacuna(lacunas, `parcela-duplicada:${idDaDuplicata}`);
  // `TarefaClickUpBruta` (do irmão de Contas a pagar) não declara `parent` —
  // Contas a pagar não usa Subtarefa. O JSON bruto do export TEM o campo
  // (verificado contra `868cpdawp.json`); o acesso é tipado localmente em
  // vez de estender a interface do irmão (fora do território deste plano).
  const paiNoClickUp = (tarefa as unknown as { readonly parent?: string | null }).parent;
  const temSubtarefaIndevida = legacyTaskId === ID_SUBTAREFA_INDEVIDA && paiNoClickUp !== null && paiNoClickUp !== undefined;
  if (temSubtarefaIndevida) adicionarLacuna(lacunas, `subtarefa-desamarrada:${paiNoClickUp}`);
  // `parentTaskId` nunca é populado (RN-CR-06): a própria Lista tem
  // Subtarefas desabilitadas (`seed-contas-a-receber.ts`, `features.subtarefas:
  // false`) — `EntradaDeContaAReceberHistorica` nem tem esse campo.

  /* ── Cliente — D5-12 ──────────────────────────────────────────────────
   * O valor bruto do relacionamento "Gestão de Clientes" é um array de
   * Tarefas relacionadas da Lista `901109161381`; o primeiro item é o
   * candidato (o export real nunca tem mais de dois, e o segundo é sempre
   * uma variação do mesmo nome comercial — RN-CR-02 não distingue "vários
   * clientes", só "cliente ausente"). */
  const campoCliente = (tarefa.custom_fields ?? []).find(
    (c): c is CampoBrutoDeClickUp => (c as CampoBrutoDeClickUp).id === ID_CAMPO_GESTAO_DE_CLIENTES && possuiValor(c as CampoBrutoDeClickUp),
  );
  const relacionados = (campoCliente?.value as ReadonlyArray<{ readonly name?: string }> | undefined) ?? [];
  const nomeDoCliente = relacionados[0]?.name;
  let clienteRef: EntradaDeContaAReceberHistorica["clienteRef"];
  if (nomeDoCliente) {
    const resolvido = resolverClienteNoCatalogo(nomeDoCliente, contexto);
    if (resolvido) clienteRef = { tipo: resolvido.tipo, id: resolvido.id };
    else adicionarLacuna(lacunas, "cliente-nao-encontrado");
  }
  // Sem `nomeDoCliente` (RN-CR-02: Romero Albuquerque e outro): nenhuma
  // lacuna própria aqui — a lacuna "sem-cliente" nasce dentro da própria
  // operação de domínio (Task 1), que é quem decide se o Vínculo entra.

  const entrada: EntradaDeContaAReceberHistorica = {
    legacyTaskId,
    titulo: tarefa.name,
    statusFinalId,
    criadaEm,
    ...(fechadaEm ? { fechadaEm } : {}),
    ...(vencimentoValido ? { vencimento: vencimentoValido } : {}),
    transicoes,
    campos,
    ...(clienteRef ? { clienteRef } : {}),
    ...(dataPagamento !== undefined ? { dataPagamento } : {}),
    lacunas,
  };

  return { resultado: "valida", legacyTaskId, entrada };
}
