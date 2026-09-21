/**
 * Leitura somente-leitura de `public.solicitacoes_pagamentos` (Supabase do
 * `financeiro-tria`) e classificação de cada linha em válida, rejeitada ou
 * ambígua — a metade "ler e entender" de SOL-09 (D-24). O `--apply` que de
 * fato chama `importarSolicitacaoHistorica` (`@n1/dominio/operations`) para
 * cada linha válida é o Plan 02-25; este arquivo só lê e classifica.
 *
 * ## A allowlist de colunas (D-25)
 *
 * `COLUNAS` é o único ponto de contato com o schema legado — uma coluna
 * nova na origem nunca aparece aqui por omissão (allowlist, não denylist).
 * As colunas documentadas em `01-inventario-financeiro-tria.md` §"Tabelas
 * principais" para `public.solicitacoes_pagamentos` são: `id`, `TaskID`,
 * `ThreadID`, `ComentarioID`, `Aprovado`, `comentario`, `Data_previsao`,
 * `id_responsavel`, `comentario_aprovacao`, `centro_custo`, `empresa`,
 * `tipo` — mais `app_key`, `app_secret` (credenciais Omie por linha) e
 * `banco_de_categorias` (o banco vetorial citado em D-25), nenhuma das três
 * entra em `COLUNAS`.
 *
 * `valor`, `documento` e `created_at` — candidatas a existir para dar
 * suporte a Valor (T-Valor) e Documento (G-CNPJ/H-CPF) da Solicitação —
 * NÃO estão nas duas migrações do inventário disponíveis neste ambiente
 * (`../financeiro-tria/supabase/migrations/2026051113…`/`2026052613…`, que
 * este agente não conseguiu ler: o repositório `financeiro-tria` não está
 * clonado ao lado deste, e não há `DATABASE_URL`/credencial de leitura no
 * `.env` deste worktree). Ficam na allowlist como HIPÓTESE, documentada
 * aqui e no `CONTEXT.md` desta pasta — quem roda o `--apply` do Plan 02-25
 * confirma os três nomes contra o schema real antes da primeira execução;
 * se um deles não existir, a consulta falha alto e explícito (coluna
 * inexistente), nunca silenciosamente.
 */

import { Client } from "pg";
import { CAMPOS_SOLICITACAO_DE_PAGAMENTO } from "@n1/dominio/solicitacao-de-pagamento";
import type { Id } from "@n1/dominio/types/primitives";

/**
 * Segunda barreira de leitura, além do papel/credencial de leitura em si
 * (que já deve ser um usuário Postgres sem `INSERT`/`UPDATE`/`DELETE` no
 * `financeiro-tria`): a sessão inteira recusa qualquer escrita, mesmo se um
 * bug de código tentasse uma. Usada tanto no comentário quanto no código —
 * é a query literal que abre cada leitura.
 */
export const SOMENTE_LEITURA = "set session characteristics as transaction read only" as const;

/** Allowlist literal — nunca `select *`. Ver o cabeçalho para a proveniência de cada nome. */
const COLUNAS = [
  "id",
  "TaskID",
  "Aprovado",
  "comentario",
  "comentario_aprovacao",
  "centro_custo",
  "empresa",
  "tipo",
  "id_responsavel",
  "Data_previsao",
  // Hipótese não confirmada contra o schema real — ver cabeçalho do arquivo.
  "valor",
  "documento",
  "created_at",
] as const;

/** Uma linha bruta, só com as colunas de `COLUNAS` — nunca `app_key`, `app_secret` ou `banco_de_categorias`. */
export type LinhaLegadaBruta = Readonly<Record<(typeof COLUNAS)[number], unknown>>;

function campoPorRotulo(rotulo: string): (typeof CAMPOS_SOLICITACAO_DE_PAGAMENTO)[number] {
  const campo = CAMPOS_SOLICITACAO_DE_PAGAMENTO.find((c) => c.rotulo === rotulo);
  if (!campo) throw new Error(`Campo "${rotulo}" não existe mais no catálogo de Solicitação de pagamento.`);
  return campo;
}

const CAMPO_CENTRO_DE_CUSTO = campoPorRotulo("Centro de Custo");
const CAMPO_EMPRESA = campoPorRotulo("Empresa");
const CAMPO_DATA_VENCIMENTO = campoPorRotulo("Data Vencimento");
const CAMPO_VALOR = campoPorRotulo("Valor");
const CAMPO_FORNECEDOR = campoPorRotulo("Fornecedor");
const CAMPO_CPF = campoPorRotulo("CPF");
const CAMPO_CNPJ = campoPorRotulo("CNPJ");

/* ────────────────────────── Leitura (Plan 02-25 chama isto) ────────────────────────── */

export interface OpcoesDeLeitura {
  /** Credencial somente-leitura do `financeiro-tria` — nunca a do `apps/api`. */
  readonly connectionString: string;
  readonly lote: number;
  /** `id` da última linha da página anterior; ausente = primeira página. */
  readonly cursor?: string;
}

export interface PaginaDeLeitura {
  readonly linhas: readonly LinhaLegadaBruta[];
  /** Ausente quando a página veio incompleta — não há próxima. */
  readonly proximoCursor?: string;
}

/**
 * Abre uma conexão somente-leitura, pagina por `id` (chave estável,
 * crescente) e devolve as linhas cruas — sem transformar nada além de
 * restringir à allowlist. Fecha a conexão sempre, mesmo em erro. Este
 * módulo só é chamado pelo CLI de importação (Plan 02-25); abrir o banco do
 * `financeiro-tria` de dentro do runtime normal do `apps/api` é erro de
 * arquitetura (ver `CONTEXT.md`).
 */
export async function lerSolicitacoesLegadas(opcoes: OpcoesDeLeitura): Promise<PaginaDeLeitura> {
  const cliente = new Client({ connectionString: opcoes.connectionString, ssl: { rejectUnauthorized: false } });
  await cliente.connect();
  try {
    await cliente.query(SOMENTE_LEITURA);
    const colunas = COLUNAS.map((c) => `"${c}"`).join(", ");
    const cursorId = opcoes.cursor ? Number(opcoes.cursor) : 0;
    const resultado = await cliente.query(
      `select ${colunas} from public.solicitacoes_pagamentos where "id" > $1 order by "id" asc limit $2`,
      [cursorId, opcoes.lote],
    );
    const linhas = resultado.rows as LinhaLegadaBruta[];
    const ultima = linhas.at(-1);
    const proximoCursor = linhas.length === opcoes.lote && ultima ? String(ultima.id) : undefined;
    return { linhas, proximoCursor };
  } finally {
    await cliente.end();
  }
}

/* ────────────────────────── Classificação (pura, sem I/O) ────────────────────────── */

export type ResultadoDeClassificacao = "valida" | "rejeitada" | "ambigua";

/**
 * O que `importarSolicitacaoHistorica` (`@n1/dominio/operations/importacao`)
 * espera receber, menos `autoriaConhecida` — resolvida à parte por
 * `resolverAutoriaLegada` (`./de-para.ts`), porque cruzar identidade não é
 * classificar uma linha.
 */
export interface EntradaClassificada {
  readonly legacyTaskId: string;
  readonly origem: "clickup";
  readonly status: "aprovado" | "não aprovado";
  readonly titulo: string;
  readonly campos: Readonly<Record<Id, string | boolean | readonly string[]>>;
  readonly resumo?: string;
  readonly criadaEm?: string;
  readonly lacunas: readonly string[];
}

export interface ClassificacaoDeLinha {
  readonly resultado: ResultadoDeClassificacao;
  /** Categoria, nunca o valor do campo problemático (T-02-21). */
  readonly motivo?: string;
  /** Só o suficiente para localizar a linha na reconciliação — nunca o resto do dado bruto. */
  readonly taskId?: string;
  /** Presente só quando `resultado === "valida"`. */
  readonly entrada?: EntradaClassificada;
}

function textoOuAusente(valor: unknown): string | undefined {
  if (valor === null || valor === undefined) return undefined;
  const texto = String(valor).trim();
  return texto === "" ? undefined : texto;
}

/** `YYYY-MM-DD` — a mesma forma que `setTaskFieldValue` exige para um Campo `date` (@n1/dominio/operations/tasks). */
function comoDataCivil(valor: unknown): string | undefined {
  const texto = textoOuAusente(valor);
  if (!texto) return undefined;
  const normalizado = texto.length >= 10 ? texto.slice(0, 10) : texto;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizado) || Number.isNaN(Date.parse(`${normalizado}T00:00:00Z`))) return undefined;
  return normalizado;
}

/** ISO 8601 completo — o que `Instant` exige. */
function comoInstante(valor: unknown): string | undefined {
  const texto = textoOuAusente(valor);
  if (!texto) return undefined;
  const ms = Date.parse(texto);
  return Number.isNaN(ms) ? undefined : new Date(ms).toISOString();
}

function comoNumero(valor: unknown): number | undefined {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : undefined;
  const texto = textoOuAusente(valor);
  if (!texto) return undefined;
  const numero = Number(texto.replace(",", "."));
  return Number.isFinite(numero) ? numero : undefined;
}

const SOMENTE_DIGITOS = /\D/g;

/**
 * Classifica UMA linha. `vistos` é o conjunto de `TaskID` já processados —
 * do próprio lote e, quando o chamador cruzar com `plataforma.importacao_ledger`
 * (Plan 02-25), também os já importados antes; esta função nunca lê o
 * ledger sozinha (D-01: nenhum SQL fora de `lerSolicitacoesLegadas`). Quem
 * itera o lote decide quando acrescentar um `TaskID` a `vistos` — tipicamente
 * depois de classificar a linha atual, nunca antes.
 */
export function classificarLinha(linha: LinhaLegadaBruta, vistos: ReadonlySet<string> = new Set()): ClassificacaoDeLinha {
  const taskId = textoOuAusente(linha.TaskID);
  if (!taskId) return { resultado: "rejeitada", motivo: "taskid_ausente" };
  if (vistos.has(taskId)) return { resultado: "rejeitada", motivo: "taskid_duplicado", taskId };

  const aprovado = linha.Aprovado;
  let status: "aprovado" | "não aprovado";
  if (aprovado === true) status = "aprovado";
  else if (aprovado === false) status = "não aprovado";
  else return { resultado: "ambigua", motivo: "aprovado_ambiguo", taskId };

  const lacunas: string[] = [];
  const campos: Record<Id, string | boolean | readonly string[]> = {};

  // A — Centro de Custo, o único obrigatório da Lista (RN-SP-01): sem valor
  // válido, `setTaskFieldValue` recusaria a Tarefa inteira no `--apply` — a
  // linha é rejeitada aqui, não deixada para falhar lá.
  const centroDeCusto = textoOuAusente(linha.centro_custo);
  if (!centroDeCusto) return { resultado: "rejeitada", motivo: "centro_custo_ausente", taskId };
  if (!(CAMPO_CENTRO_DE_CUSTO.opcoes ?? []).includes(centroDeCusto)) {
    return { resultado: "rejeitada", motivo: "centro_custo_invalido", taskId };
  }
  campos[CAMPO_CENTRO_DE_CUSTO.id] = centroDeCusto;

  // C — Empresa: não obrigatório; fora do domínio vira lacuna, não recusa a linha.
  const empresa = textoOuAusente(linha.empresa);
  if (empresa && (CAMPO_EMPRESA.opcoes ?? []).includes(empresa)) campos[CAMPO_EMPRESA.id] = empresa;
  else if (empresa) lacunas.push("empresa_fora_do_dominio");

  // L — Data Vencimento, de `Data_previsao`. Nunca fonte de `criadaEm` (vencimento não é criação).
  const dataVencimento = comoDataCivil(linha.Data_previsao);
  if (dataVencimento) campos[CAMPO_DATA_VENCIMENTO.id] = dataVencimento;
  else if (linha.Data_previsao !== null && linha.Data_previsao !== undefined) lacunas.push("data_vencimento_formato_inesperado");

  // T — Valor. D-25: nunca reconstruído de texto livre — só o valor já estruturado da coluna.
  if (linha.valor === null || linha.valor === undefined || textoOuAusente(linha.valor) === undefined) {
    lacunas.push("valor_ausente");
  } else {
    const numero = comoNumero(linha.valor);
    if (numero === undefined) lacunas.push("valor_nao_numerico");
    else campos[CAMPO_VALOR.id] = numero.toFixed(2);
  }

  // G/H — Documento (CPF ou CNPJ), inferido só pela contagem de dígitos do valor já presente — nunca inventado.
  const documento = textoOuAusente(linha.documento);
  if (!documento) {
    lacunas.push("documento_ausente");
  } else {
    const digitos = documento.replace(SOMENTE_DIGITOS, "");
    if (digitos.length === 11) {
      campos[CAMPO_FORNECEDOR.id] = "CPF";
      campos[CAMPO_CPF.id] = documento;
    } else if (digitos.length === 14) {
      campos[CAMPO_FORNECEDOR.id] = "CNPJ";
      campos[CAMPO_CNPJ.id] = documento;
    } else {
      lacunas.push("documento_formato_inesperado");
    }
  }

  const criadaEm = comoInstante(linha.created_at);
  if (!criadaEm) lacunas.push("data_de_criacao_ausente");

  const resumo = textoOuAusente(linha.comentario);

  return {
    resultado: "valida",
    taskId,
    entrada: {
      legacyTaskId: taskId,
      origem: "clickup",
      status,
      titulo: `Solicitação importada — ClickUp ${taskId}`,
      campos,
      ...(resumo !== undefined ? { resumo: String(linha.comentario) } : {}),
      ...(criadaEm !== undefined ? { criadaEm } : {}),
      lacunas,
    },
  };
}
