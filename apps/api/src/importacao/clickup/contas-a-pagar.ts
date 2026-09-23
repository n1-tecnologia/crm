/**
 * A metade "ler e entender" de PAG-01: lê o export em disco da Lista
 * `901107637383` (ClickUp) e traduz cada Tarefa para o contrato que
 * `importarContaAPagarHistorica` (`@n1/dominio/operations/importacao-contas-a-pagar`,
 * Plan 03-09) espera. O `--apply` que de fato chama a operação e grava
 * `plataforma.importacao_ledger` mora em `./importar-contas-a-pagar.ts`; este
 * arquivo não abre transação nenhuma.
 *
 * A regra de importação inteira — o que faz uma Conta a pagar histórica
 * válida, como o Status final é resolvido, o que vira Registro de Atividade —
 * é de `@n1/dominio`. Aqui não se decide nada sobre isso: só se traduz o
 * vocabulário do ClickUp (nomes de Status, ids de Campo, nomes de Tag, ids de
 * usuário) para os ids da plataforma. Regra de dependência do `../CONTEXT.md`
 * — `apps/api` conhece `@n1/dominio`, nunca o contrário.
 *
 * ## `time_in_status` — a ressalva medida
 *
 * `./CONTEXT.md` § "Histórico de status" já registra que a API pública do
 * ClickUp não expõe uma trilha cronológica de transições — `time_in_status`
 * é tempo acumulado por Status DISTINTO, não por transição. Uma Tarefa que
 * voltou ao mesmo Status (reentrada) aparece nele UMA vez só, com o tempo das
 * duas passagens somado; o intervalo entre o `since` daquela entrada e o
 * `since` da entrada seguinte (ou o instante da exportação, para a última)
 * fica menor que `by_minute`. **630 das 2.861 Tarefas do export** (22%) dão
 * esse sinal — cada uma recebe a lacuna `tempo_acumulado_maior_que_o_intervalo`
 * em vez de uma métrica de "tempo em Status" silenciosamente errada.
 *
 * ## O que nunca entra em `motivo`/`lacunas` (D-25, T-3-25)
 *
 * Categoria e `legacyTaskId`, nunca o valor de um Campo, o título da Tarefa
 * ou o nome de um fornecedor. `motivo` de uma rejeição é sempre um dos
 * literais fechados abaixo — a mesma disciplina de `../financeiro/solicitacoes.ts`.
 */

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { CP } from "@n1/dominio/operations/financeiro";
import {
  ORIGEM_CONTAS_A_PAGAR,
  type EntradaDeContaAPagarHistorica,
  type TransicaoHistoricaDeStatus,
} from "@n1/dominio/operations/importacao-contas-a-pagar";
import type { CivilDate, FieldValue, Id, Instant, TaskDate } from "@n1/dominio/types/primitives";

import { entradaPorClickupId } from "./de-para-usuarios";
import { hashDoArquivo } from "./manifesto";
import type { Manifesto } from "./manifesto";

// `ORIGEM_CONTAS_A_PAGAR` é reexportada aqui só para o CLI (`./importar-contas-a-pagar.ts`)
// nunca precisar importar de dois lugares diferentes — o valor em si vem de
// `@n1/dominio`, nunca é reescrito.
export { ORIGEM_CONTAS_A_PAGAR };

/* ─────────────────────────── De-para de Status ─────────────────────────── */

/**
 * Os 8 Status do Conjunto efetivo da Lista (`list.json`). Os outros 14 nomes
 * que aparecem só no histórico (`em autorização`, `em solicitação`, `em
 * lançamento`, `para fazer`, `em aprovação`, `aprovação head`, `não
 * aprovado`, `em análise`, `aprovação sócio`, `a pagar`, `complete`, `to
 * do`, `in progress`, `pendente`) não têm equivalente e viajam só como
 * `nomeLegado` — 3.870 das 12.490 transições do export.
 */
export const DE_PARA_DE_STATUS = {
  "para pagar": CP.status.paraPagar,
  "em lançamento omie": CP.status.emLancamento,
  "lançado omie": CP.status.lancado,
  "em remessa bancária": CP.status.emRemessa,
  "em autorização bancária": CP.status.emAutorizacao,
  aprovado: CP.status.aprovado,
  negado: CP.status.negado,
  pago: CP.status.pago,
} as const satisfies Readonly<Record<string, Id>>;

/* ─────────────────────────── De-para de Campos ─────────────────────────── */

/** `L-Data Vencimento` — nunca em `campos`: vai para o vencimento NATIVO (D3-04, obrigação 3). */
const ID_DO_CAMPO_L_DATA_VENCIMENTO = "21d726f9-ddc0-4d90-b482-3ed3fe5d78d4";

/**
 * As 24 Definições de Campo de `fields.json` → id de `CP.fields`, exceto as
 * três sem destino de Valor de Campo:
 *
 * - `L-Data Vencimento` (`21d726f9-…`, tratada à parte, nunca aqui);
 * - `Y-Produto` (`4dfa2280-…`, 6 usos no export) — sem equivalente na
 *   plataforma, vira lacuna `campo_sem_destino`;
 * - `W-Equipe` (`749292dc-…`, 1 uso) — idem.
 *
 * As outras 21 mapeiam 1-para-1, inclusive as três de anexo (`J-Anexo`,
 * `R-Boleto`, `S-QR Code`): elas TÊM destino, mas nunca produzem valor — ver
 * `CAMPOS_DE_ANEXO` abaixo (exclusão declarada, não omissão; `./CONTEXT.md`).
 */
export const DE_PARA_DE_CAMPOS = {
  "8489b2e2-e5fe-47bf-bfbc-5ea900ab5f93": CP.fields.centroDeCusto, // A-Centro de Custo
  "4508f196-15be-4ca7-982a-657790490a78": CP.fields.bu, // B-BU
  "cc3ddcec-de22-42ce-9f44-5421b6cbb5e4": CP.fields.empresa, // C-Empresa
  "a3b55d09-8c93-4686-9040-9dbe3ad28c1e": CP.fields.categoria, // D-Categoria de pagamento
  "406a9144-e5a8-45cd-84e6-446b36700e0d": CP.fields.pessoa, // E-Pessoa
  "2ba6e01d-02c1-4dee-b609-f85b8ab1822c": CP.fields.fornecedor, // F-Fornecedor
  "3587c428-cfb4-43c3-887f-5097f2c7b89b": CP.fields.cnpj, // G-CNPJ
  "766be44f-54d0-4aa5-a26b-ddccace021fb": CP.fields.cpf, // H-CPF
  "2de8a598-7fc1-47dd-afd1-61d96aff33d4": CP.fields.nomeFornecedor, // I-Nome do fornecedor
  "5b82307c-90c8-4590-831c-36d5bd50f3f2": CP.fields.anexo, // J-Anexo — nunca produz valor
  "f63f3169-94f2-4d31-94fa-44e740c2e7db": CP.fields.dataEmissao, // K-Data de Emissão
  "d73d5a97-0662-44c5-a772-b567facc9602": CP.fields.forma, // M-Forma de pagamento
  "881dd2b9-4fcf-470a-94aa-e536f9277f5b": CP.fields.chavePix, // N-Chave pix
  "71787192-f4d3-4562-81a0-e0d2557ae947": CP.fields.codigoBarras, // O-Código de barras
  "525d8a0d-75b7-4b9c-9399-5aa29c5402d1": CP.fields.pixCopiaECola, // P-Pix copia e cola
  "16fa41ad-a766-4d79-8498-eaefe2105610": CP.fields.boleto, // R-Boleto — nunca produz valor
  "23b9ba4c-a750-4d15-b736-d54a99909184": CP.fields.qrCode, // S-QR Code — nunca produz valor
  "ad484dcb-4a13-478d-9191-b1fe71658e50": CP.fields.valor, // T-Valor
  "d209c79e-a6a7-4e15-891c-2e4ca966a574": CP.fields.integracaoManual, // U-Integração manual
  "832f9725-d695-4282-8ba2-7609d35c338b": CP.fields.solicitante, // X-Nome do solicitante
  "f447f835-7439-4c39-be7e-b8cd048af232": CP.fields.whatsapp, // Z-WhatsApp
  // "21d726f9-…" (L-Data Vencimento) — vencimento nativo, nunca aqui.
  // "4dfa2280-…" (Y-Produto, 6 usos) — sem equivalente: campo_sem_destino.
  // "749292dc-…" (W-Equipe, 1 uso) — sem equivalente: campo_sem_destino.
} as const satisfies Readonly<Record<string, Id>>;

/** Campos de anexo: têm destino em `DE_PARA_DE_CAMPOS`, mas nunca produzem valor (exclusão declarada). */
const CAMPOS_DE_ANEXO: ReadonlySet<Id> = new Set([CP.fields.anexo, CP.fields.boleto, CP.fields.qrCode]);
const CAMPOS_DE_MOEDA: ReadonlySet<Id> = new Set([CP.fields.valor]);
const CAMPOS_DE_DATA: ReadonlySet<Id> = new Set([CP.fields.dataEmissao]);
const CAMPOS_DE_PESSOA: ReadonlySet<Id> = new Set([CP.fields.pessoa]);

/**
 * O domínio de cada Campo `singleSelect`, copiado de
 * `packages/dominio/src/seed-financeiro.ts` (linhas 186-207) — é contra ele,
 * não contra `type_config.options` do ClickUp, que a opção resolvida precisa
 * bater: `setTaskFieldValue` recusa qualquer string fora deste conjunto.
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
  [CP.fields.categoria]: [
    "Distribuição de Lucro", "Impostos", "Prestação de Serviços", "Móveis e Utensílios", "Administrativo", "Evento",
    "Contas de consumo", "A identificar", "Cursos e treinamentos", "Comissão", "Tráfego Pago", "Ferramentas",
    "Insumos", "Viagens e Hospedagens", "Aporte", "Aluguel", "Tarifas", "Ação Gente e Cultura",
    "Devolução/Estorno de venda", "Editora", "Correios e Transportadora", "Doação",
    "Publicidade de Marca / Patrocínio", "Salário",
  ],
  [CP.fields.fornecedor]: ["CPF", "CNPJ"],
  [CP.fields.forma]: ["Chave Pix", "Boleto", "QRCode Pix"],
  [CP.fields.integracaoManual]: ["Manual"],
};

/* ──────────────────────────── De-para de Tags ───────────────────────────── */

/**
 * As 8 Tags do seed (`seed-financeiro.ts`, `tag_cp_1`…`tag_cp_8`, na mesma
 * ordem que `applyContasAPagar` as cria). As outras 11 do export não têm
 * equivalente — `conta plx - apoio`, `conta mp`, `conta tf`, `conta cariani`,
 * `conta kaka`, `conta ivl`, `depósito bancário`, `exo participação`,
 * `aluguel`, `equipamento`, `limpeza` — e viram a lacuna `tag_sem_equivalente`
 * (1.348 das 2.861 Tarefas carregam ao menos uma).
 */
export const DE_PARA_DE_TAGS = {
  "conta tria": "tag_cp_1",
  "conta konq": "tag_cp_2",
  "conta kops": "tag_cp_3",
  "conta roberth": "tag_cp_4",
  "conta auton": "tag_cp_5",
  "conta tf tria": "tag_cp_6",
  "conta arkline": "tag_cp_7",
  "conta inevitaveis": "tag_cp_8",
} as const satisfies Readonly<Record<string, Id>>;

/* ────────────────────────────── Leitura do disco ────────────────────────────── */

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

interface UsuarioBrutoDeClickUp {
  readonly id: number | string;
}

interface TagBrutaDeClickUp {
  readonly name: string;
}

/** O suficiente de `task/<id>.json` para classificar — nunca o objeto inteiro é reserializado. */
export interface TarefaClickUpBruta {
  readonly id: string;
  readonly name: string;
  readonly archived?: boolean;
  readonly status: { readonly status: string };
  readonly date_created?: string;
  readonly date_closed?: string | null;
  readonly due_date?: string | null;
  readonly creator?: UsuarioBrutoDeClickUp;
  readonly assignees?: readonly UsuarioBrutoDeClickUp[];
  readonly watchers?: readonly UsuarioBrutoDeClickUp[];
  readonly tags?: readonly TagBrutaDeClickUp[];
  readonly custom_fields?: readonly CampoBrutoDeClickUp[];
}

interface EntradaDeHistoricoBruta {
  readonly status: string;
  readonly total_time?: { readonly since?: string | number; readonly by_minute?: number };
}

/** O suficiente de `time-in-status/<id>.json` — ver a ressalva no cabeçalho deste arquivo. */
export interface HistoricoClickUpBruto {
  readonly status_history?: readonly EntradaDeHistoricoBruta[];
}

export interface ParDeArquivosDoExport {
  readonly tarefa: TarefaClickUpBruta;
  readonly historico: HistoricoClickUpBruto;
}

/**
 * Enumera `task/*.json` e abre o `time-in-status/<taskId>.json`
 * correspondente — devolve o par cru, sem transformar nada. A ausência do
 * arquivo de histórico (não deveria acontecer: `MANIFESTO.md` diz 2.861
 * detalhes para 2.861 `time_in_status`) vira histórico vazio, que
 * `classificarTarefaLegada` recusa com `historico_vazio` — nunca lançada.
 */
export async function* lerTarefasDoExport(pastaDaLista: string): AsyncGenerator<ParDeArquivosDoExport> {
  const pastaDeTarefas = path.join(pastaDaLista, "task");
  const arquivos = (await readdir(pastaDeTarefas)).filter((nome) => nome.endsWith(".json")).sort();
  for (const arquivo of arquivos) {
    const tarefa = JSON.parse(await readFile(path.join(pastaDeTarefas, arquivo), "utf8")) as TarefaClickUpBruta;
    let historico: HistoricoClickUpBruto = { status_history: [] };
    try {
      const bruto = await readFile(path.join(pastaDaLista, "time-in-status", `${tarefa.id}.json`), "utf8");
      historico = JSON.parse(bruto) as HistoricoClickUpBruto;
    } catch {
      // Ver comentário acima: histórico ausente vira `historico_vazio`, não exceção.
    }
    yield { tarefa, historico };
  }
}

/**
 * Confere o `sha256` de cada `task/*.json` e `time-in-status/*.json` lido
 * contra `MANIFESTO.json` (T-3-27) — devolve os caminhos que divergem
 * (vazio quando tudo bate). `hashDoArquivo` é importada de `./manifesto.ts`,
 * nunca reescrita.
 */
export async function verificarIntegridadeDoExport(pastaDaLista: string, manifesto: Manifesto): Promise<readonly string[]> {
  const listId = path.basename(pastaDaLista);
  const porCaminho = new Map(manifesto.arquivos.map((entrada) => [entrada.caminho, entrada] as const));
  const divergencias: string[] = [];
  for (const subpasta of ["task", "time-in-status"] as const) {
    const pastaDoRecurso = path.join(pastaDaLista, subpasta);
    let arquivos: readonly string[];
    try {
      arquivos = (await readdir(pastaDoRecurso)).filter((nome) => nome.endsWith(".json"));
    } catch {
      continue;
    }
    for (const arquivo of arquivos) {
      const caminhoRelativo = `${listId}/${subpasta}/${arquivo}`;
      const esperado = porCaminho.get(caminhoRelativo);
      if (!esperado) {
        divergencias.push(caminhoRelativo);
        continue;
      }
      const { sha256 } = await hashDoArquivo(path.join(pastaDoRecurso, arquivo));
      if (sha256 !== esperado.sha256) divergencias.push(caminhoRelativo);
    }
  }
  return divergencias;
}

/* ───────────────────────────────── Conversores ───────────────────────────────── */

function paraEpochMs(valor: unknown): number | undefined {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : undefined;
  if (typeof valor === "string" && valor.trim() !== "") {
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : undefined;
  }
  return undefined;
}

/** Epoch-ms (string ou número) → ISO-8601. Não-numérico devolve `undefined`, nunca lança. */
export function comoInstanteDeEpoch(valor: unknown): Instant | undefined {
  const ms = paraEpochMs(valor);
  return ms === undefined ? undefined : new Date(ms).toISOString();
}

/**
 * Epoch-ms → `YYYY-MM-DD` no fuso `America/Sao_Paulo`. A escolha do fuso é
 * explícita, não acidental: no export atual nenhum `due_date` cai entre
 * 00:00 e 03:00 UTC (a hora mínima observada é 03:00), então UTC e São Paulo
 * dariam o mesmo dia civil hoje — mas a regra é São Paulo porque é o fuso do
 * Espaço de Trabalho, não porque o dado atual perdoa a troca.
 */
const FORMATADOR_DE_DIA_CIVIL = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function comoDiaCivil(valor: unknown): CivilDate | undefined {
  const ms = paraEpochMs(valor);
  return ms === undefined ? undefined : FORMATADOR_DE_DIA_CIVIL.format(new Date(ms));
}

function comoTexto(valor: unknown): string | undefined {
  if (typeof valor === "string") {
    const texto = valor.trim();
    return texto === "" ? undefined : texto;
  }
  if (typeof valor === "number") return String(valor);
  return undefined;
}

/** Número com duas casas — no molde de `comoNumero` de `../financeiro/solicitacoes.ts`. */
function comoMoeda(valor: unknown): number | undefined {
  const texto = typeof valor === "number" ? String(valor) : typeof valor === "string" ? valor : undefined;
  if (texto === undefined) return undefined;
  const numero = Number(texto.replace(",", "."));
  return Number.isFinite(numero) ? Number(numero.toFixed(2)) : undefined;
}

/** O valor de um `drop_down` é o ÍNDICE da opção; o nome resolvido passa por `.trim()` antes de qualquer comparação (caso e). */
function nomeDaOpcaoEscolhida(campo: CampoBrutoDeClickUp): string | undefined {
  if (typeof campo.value !== "number") return undefined;
  const opcao = campo.type_config?.options?.[campo.value];
  const nome = opcao?.name ?? opcao?.label;
  return nome === undefined ? undefined : nome.trim();
}

function possuiValor(campo: CampoBrutoDeClickUp): boolean {
  return "value" in campo && campo.value !== null && campo.value !== undefined;
}

/* ───────────────────────────── Classificação (pura) ───────────────────────────── */

export type ResultadoDeClassificacao = "valida" | "rejeitada";

export interface ClassificacaoDeLinha {
  readonly resultado: ResultadoDeClassificacao;
  /** Categoria, nunca o valor problemático (D-25, T-3-25). */
  readonly motivo?: string;
  readonly legacyTaskId?: string;
  /** Presente só quando `resultado === "valida"`. */
  readonly entrada?: EntradaDeContaAPagarHistorica;
}

export interface OpcoesDeClassificacao {
  /** O instante em que o export foi gerado — teto do último intervalo de `time_in_status` (caso j). */
  readonly instanteDaExportacao: Instant;
}

function adicionarLacuna(lacunas: string[], categoria: string): void {
  if (!lacunas.includes(categoria)) lacunas.push(categoria);
}

/**
 * Classifica UMA Tarefa. Pura, sem I/O. Ordem do corpo:
 * legacyTaskId → Status final → datas → transições (+ reentrada) →
 * vencimento (D3-04) → Campos → Tags → Pessoas (PREP-04) → arquivamento.
 */
export function classificarTarefaLegada(
  tarefa: TarefaClickUpBruta,
  historico: HistoricoClickUpBruto,
  opcoes: OpcoesDeClassificacao,
): ClassificacaoDeLinha {
  const legacyTaskId = comoTexto(tarefa.id);
  if (!legacyTaskId) return { resultado: "rejeitada", motivo: "taskid_ausente" };

  // É a única recusa de CONTEÚDO do classificador: 03-09 já recusa um
  // `statusFinalId` desconhecido, e deixar chegar lá gastaria uma transação
  // inteira para a mesma resposta.
  const statusFinalId = (DE_PARA_DE_STATUS as Readonly<Record<string, Id>>)[tarefa.status.status];
  if (!statusFinalId) return { resultado: "rejeitada", motivo: "status_final_sem_equivalente", legacyTaskId };

  const criadaEm = comoInstanteDeEpoch(tarefa.date_created);
  if (!criadaEm) return { resultado: "rejeitada", motivo: "criadaEm_ausente", legacyTaskId };
  // `date_closed` ausente em Tarefa `pago` (4 no export) NÃO é lacuna nem
  // recusa: 03-09 já cobre isso usando o instante da última transição.
  const fechadaEm = comoInstanteDeEpoch(tarefa.date_closed);

  const lacunas: string[] = [];

  /* ── Transições (passo 8) ──────────────────────────────────────────── */
  const transicoes: TransicaoHistoricaDeStatus[] = [];
  for (const entradaHistorico of historico.status_history ?? []) {
    const em = comoInstanteDeEpoch(entradaHistorico.total_time?.since);
    if (!em) {
      adicionarLacuna(lacunas, "transicao_sem_instante");
      continue;
    }
    const statusId = (DE_PARA_DE_STATUS as Readonly<Record<string, Id>>)[entradaHistorico.status];
    transicoes.push({ em, ...(statusId ? { statusId } : {}), nomeLegado: entradaHistorico.status });
  }
  // 03-09 recusa `transicoes` vazio — a mesma recusa nasce aqui primeiro.
  if (transicoes.length === 0) return { resultado: "rejeitada", motivo: "historico_vazio", legacyTaskId };

  /* ── Reentrada de Status (passo 9) ──────────────────────────────────── */
  const historicoOrdenado = (historico.status_history ?? [])
    .map((e) => ({ ms: paraEpochMs(e.total_time?.since), byMinute: e.total_time?.by_minute }))
    .filter((e): e is { ms: number; byMinute: number | undefined } => e.ms !== undefined)
    .sort((a, b) => a.ms - b.ms);
  const instanteDaExportacaoMs = Date.parse(opcoes.instanteDaExportacao);
  for (let indice = 0; indice < historicoOrdenado.length; indice += 1) {
    const atual = historicoOrdenado[indice]!;
    const proximoMs = indice + 1 < historicoOrdenado.length ? historicoOrdenado[indice + 1]!.ms : instanteDaExportacaoMs;
    const intervaloEmMinutos = (proximoMs - atual.ms) / 60_000;
    if (atual.byMinute !== undefined && atual.byMinute > intervaloEmMinutos + 60) {
      adicionarLacuna(lacunas, "tempo_acumulado_maior_que_o_intervalo");
    }
  }

  /* ── Vencimento — D3-04, obrigação 3 (passo 4) ──────────────────────── */
  // A precedência é decisão deste plano, com evidência: das 117 contas ainda
  // em "para pagar", 83 têm os dois e 82 divergem (L em média 26,3 dias mais
  // cedo — uma volta de recorrência atrás); todo `L` é subconjunto do
  // nativo (1.007 vs 2.830 Tarefas). Usar `L` não acrescentaria uma Tarefa e
  // poria 82 contas vivas com vencimento no passado — o gatilho de A5/A6/A7.
  // O nativo vence; a divergência vira lacuna auditável, nunca escolha
  // silenciosa.
  const nativo = comoDiaCivil(tarefa.due_date);
  const campoL = (tarefa.custom_fields ?? []).find((c) => c.id === ID_DO_CAMPO_L_DATA_VENCIMENTO && possuiValor(c));
  const valorDeL = campoL ? comoDiaCivil(campoL.value) : undefined;
  let vencimento: TaskDate | undefined;
  if (nativo) {
    vencimento = { form: "civilDay", value: nativo };
    if (valorDeL && valorDeL !== nativo) adicionarLacuna(lacunas, "vencimento_l_diverge_do_nativo");
  } else if (!valorDeL) {
    adicionarLacuna(lacunas, "vencimento_ausente");
  }

  /* ── Campos (passo 5) ────────────────────────────────────────────────── */
  const campos: Record<Id, FieldValue["value"]> = {};
  for (const campo of tarefa.custom_fields ?? []) {
    if (campo.id === ID_DO_CAMPO_L_DATA_VENCIMENTO) continue; // nunca em `campos` — só no vencimento nativo acima.
    if (!possuiValor(campo)) continue;

    const destino = (DE_PARA_DE_CAMPOS as Readonly<Record<string, Id>>)[campo.id];
    if (!destino) {
      adicionarLacuna(lacunas, "campo_sem_destino"); // Y-Produto, W-Equipe
      continue;
    }
    if (CAMPOS_DE_ANEXO.has(destino)) {
      adicionarLacuna(lacunas, "anexo_nao_importado"); // J-Anexo, R-Boleto, S-QR Code — exclusão declarada
      continue;
    }
    const dominio = DOMINIO_DOS_CAMPOS[destino];
    if (dominio) {
      const nomeEscolhido = nomeDaOpcaoEscolhida(campo);
      if (nomeEscolhido === undefined) continue;
      if (!dominio.includes(nomeEscolhido)) {
        adicionarLacuna(lacunas, "opcao_fora_do_dominio");
        continue;
      }
      campos[destino] = nomeEscolhido;
      continue;
    }
    if (CAMPOS_DE_MOEDA.has(destino)) {
      const numero = comoMoeda(campo.value);
      if (numero !== undefined) campos[destino] = numero;
      continue;
    }
    if (CAMPOS_DE_DATA.has(destino)) {
      const dia = comoDiaCivil(campo.value);
      if (dia !== undefined) campos[destino] = dia;
      continue;
    }
    if (CAMPOS_DE_PESSOA.has(destino)) {
      const usuarios = Array.isArray(campo.value) ? (campo.value as ReadonlyArray<{ readonly id?: number | string }>) : [];
      const primeiro = usuarios[0];
      const encontrado = primeiro?.id !== undefined ? entradaPorClickupId(String(primeiro.id)) : undefined;
      if (encontrado?.memberIdConhecido) campos[destino] = encontrado.memberIdConhecido;
      else adicionarLacuna(lacunas, "pessoa_nao_resolvida");
      continue;
    }
    const texto = comoTexto(campo.value);
    if (texto !== undefined) campos[destino] = texto;
  }
  // Ao contrário de `classificarLinha` (que rejeita sem Centro de Custo): a
  // ausência aqui é lacuna, não recusa — recusar apagaria contas históricas
  // reais (D3-04 não torna Centro de Custo obrigatório na importação).
  if (!(CP.fields.centroDeCusto in campos)) adicionarLacuna(lacunas, "centro_de_custo_ausente");

  /* ── Tags (passo 6) ──────────────────────────────────────────────────── */
  const tags: Id[] = [];
  for (const tag of tarefa.tags ?? []) {
    const destino = (DE_PARA_DE_TAGS as Readonly<Record<string, Id>>)[tag.name];
    if (destino) tags.push(destino);
    else adicionarLacuna(lacunas, "tag_sem_equivalente");
  }

  /* ── Pessoas — PREP-04 (passo 7) ─────────────────────────────────────── */
  // Só `entradaPorClickupId(...).memberIdConhecido` é aceito: 864 Tarefas
  // têm criador resolvível; 2.558 têm ao menos um Responsável que não
  // resolve (o de-para cobre 6 ids ClickUp e só um já é Membro real — quem
  // convida um Membro novo é a importação de outra camada, D-09, nunca
  // este módulo).
  const memberIdDoCriador = tarefa.creator ? entradaPorClickupId(String(tarefa.creator.id))?.memberIdConhecido : undefined;
  if (tarefa.creator && !memberIdDoCriador) adicionarLacuna(lacunas, "autoria_nao_resolvida");

  const responsaveis: Id[] = [];
  for (const assignee of tarefa.assignees ?? []) {
    const memberId = entradaPorClickupId(String(assignee.id))?.memberIdConhecido;
    if (memberId) responsaveis.push(memberId);
    else adicionarLacuna(lacunas, "responsavel_nao_resolvido");
  }

  const observadores: Id[] = [];
  for (const watcher of tarefa.watchers ?? []) {
    const memberId = entradaPorClickupId(String(watcher.id))?.memberIdConhecido;
    if (memberId) observadores.push(memberId);
    else adicionarLacuna(lacunas, "observador_nao_resolvido");
  }

  /* ── Arquivamento na origem (passo 10) ───────────────────────────────── */
  // São 2 no export — o que explica 2.861 arquivos de detalhe para 2.859
  // Tarefas ativas em `MANIFESTO.md` (a divergência "2.861 vs 2.859" do
  // ROADMAP: os dois números estão certos, contam coisas diferentes).
  if (tarefa.archived === true) adicionarLacuna(lacunas, "tarefa_arquivada_na_origem");

  const entrada: EntradaDeContaAPagarHistorica = {
    legacyTaskId,
    titulo: tarefa.name,
    statusFinalId,
    criadaEm,
    ...(fechadaEm ? { fechadaEm } : {}),
    ...(vencimento ? { vencimento } : {}),
    transicoes,
    campos,
    ...(tags.length > 0 ? { tags } : {}),
    ...(responsaveis.length > 0 ? { responsaveis } : {}),
    ...(observadores.length > 0 ? { observadores } : {}),
    ...(memberIdDoCriador ? { autoriaConhecida: { memberId: memberIdDoCriador } } : {}),
    lacunas,
  };

  // Nunca preencher `origem`: `EntradaDeContaAPagarHistorica` (03-09) não tem
  // esse campo de propósito — o valor único vem de `ORIGEM_CONTAS_A_PAGAR`.
  return { resultado: "valida", legacyTaskId, entrada };
}
