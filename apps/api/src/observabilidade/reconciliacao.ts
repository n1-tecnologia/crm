/**
 * A reconciliação diária do ensaio de duas semanas (Plan 02-27, D-27):
 * agrupa por ORIGEM (`plataforma`/`clickup`) as contagens de entrada,
 * aprovação, RESUMO publicado, tentativa e resultado Omie; e cruza
 * `codigo_lancamento_integracao` entre as duas coortes para afirmar ZERO
 * interseção — T-02-23, "lançar a mesma obrigação duas vezes é dano
 * financeiro real".
 *
 * Mesma decisão de `./metricas.ts` (ver o cabeçalho de lá): as contagens que
 * vivem no `financeiro-tria` (RESUMOs publicados, tentativas/resultados
 * Omie, comandos do adapter, e a lista de códigos de integração por origem)
 * chegam por `opcoes.amostra` — nenhuma leitura SQL deste módulo tenta
 * adivinhar um schema que ele não pode verificar em produção. Sem
 * `opcoes.amostra`, `reconciliarDia` ainda reconcilia o que É seu — o outbox
 * local — e devolve zero para o resto, nunca um número inventado.
 *
 * `falhasNaoTratadas` soma eventos `failed` do outbox (local, sempre real)
 * com comandos `failed` do adapter (do `financeiro-tria`, só quando
 * `opcoes.amostra.comandosDoAdapterFalhos` vem informado).
 */

import type { PoolClient } from "pg";
import { pool } from "../persistencia/conexao";

export type Origem = "plataforma" | "clickup";

export interface ResultadoOmiePorOrigem {
  readonly sucesso: number;
  readonly falha: number;
}

export interface EntradaPorOrigem {
  readonly entradas: number;
  readonly aprovacoes: number;
  readonly resumosPublicados: number;
  readonly tentativasOmie: number;
  readonly resultadosOmie: ResultadoOmiePorOrigem;
  /** `codigo_lancamento_integracao` de cada tentativa Omie desta origem no
   * dia — nunca outro dado (T-02-14): só o código, que já é um id técnico,
   * nunca valor/categoria/conta. */
  readonly codigosDeIntegracao: readonly string[];
}

/** As duas coortes, na ordem em que o CLI as imprime. */
export const ORIGENS: readonly Origem[] = ["plataforma", "clickup"];

const ENTRADA_VAZIA: EntradaPorOrigem = {
  entradas: 0,
  aprovacoes: 0,
  resumosPublicados: 0,
  tentativasOmie: 0,
  resultadosOmie: { sucesso: 0, falha: 0 },
  codigosDeIntegracao: [],
};

export type PorOrigem = Readonly<Record<Origem, EntradaPorOrigem>>;

interface LinhaDeOutboxParaReconciliacao {
  readonly status: "pending" | "delivering" | "delivered" | "failed";
}

export interface AmostraDaReconciliacao {
  readonly outbox: readonly LinhaDeOutboxParaReconciliacao[];
  readonly porOrigem: PorOrigem;
  /** Comandos `failed` do `platform_adapter_commands` (financeiro-tria) no dia. */
  readonly comandosDoAdapterFalhos: number;
}

export interface OpcoesDeReconciliacao {
  readonly dia: string;
  /** Ver cabeçalho — presente em teste e quando o CLI recebe `--resumo=<json>`. */
  readonly amostra?: AmostraDaReconciliacao;
  readonly workspaceId?: string;
  readonly cliente?: PoolClient;
}

export interface ResultadoDaReconciliacao {
  readonly dia: string;
  readonly porOrigem: PorOrigem;
  readonly codigosDuplicados: readonly string[];
  readonly falhasNaoTratadas: number;
}

const WORKSPACE_PADRAO = "ws_n1";

/** Interseção dos dois conjuntos — o invariante D-27 exige que dê sempre vazia. */
function cruzarCodigos(porOrigem: PorOrigem): readonly string[] {
  const daPlataforma = new Set(porOrigem.plataforma.codigosDeIntegracao);
  const duplicados = porOrigem.clickup.codigosDeIntegracao.filter((codigo) => daPlataforma.has(codigo));
  return [...new Set(duplicados)].sort();
}

async function contarOutboxFalhoDoDia(dia: string, workspaceId: string, clienteInformado: PoolClient | undefined): Promise<number> {
  const cliente = clienteInformado ?? (await pool().connect());
  const devePoolLiberar = clienteInformado === undefined;
  try {
    const resultado = await cliente.query<{ n: string }>(
      `select count(*)::text as n
         from plataforma.integration_outbox
        where workspace_id = $1 and status = 'failed' and created_at::date = $2::date`,
      [workspaceId, dia],
    );
    return Number(resultado.rows[0]?.n ?? "0");
  } finally {
    if (devePoolLiberar) cliente.release();
  }
}

export async function reconciliarDia(opcoes: OpcoesDeReconciliacao): Promise<ResultadoDaReconciliacao> {
  const porOrigem: PorOrigem = opcoes.amostra?.porOrigem ?? {
    plataforma: ENTRADA_VAZIA,
    clickup: ENTRADA_VAZIA,
  };
  const comandosDoAdapterFalhos = opcoes.amostra?.comandosDoAdapterFalhos ?? 0;

  const outboxFalhos = opcoes.amostra
    ? opcoes.amostra.outbox.filter((e) => e.status === "failed").length
    : await contarOutboxFalhoDoDia(opcoes.dia, opcoes.workspaceId ?? WORKSPACE_PADRAO, opcoes.cliente);

  return {
    dia: opcoes.dia,
    porOrigem,
    codigosDuplicados: cruzarCodigos(porOrigem),
    falhasNaoTratadas: outboxFalhos + comandosDoAdapterFalhos,
  };
}
