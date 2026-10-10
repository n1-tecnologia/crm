/**
 * A transação dos serviços do CRM e a tradução de SQLSTATE em recusa.
 *
 * Os serviços PRÉ-CHECAM as regras para dar a mensagem rica (D-07/D-09: quem
 * bloqueia, quantos Negócios abertos). O SQLSTATE é a rede contra a corrida:
 * entre a pré-checagem e a escrita outra requisição pode entrar, e então é o
 * constraint do banco que segura — `traduzirErroDePg` o transforma em 409 com
 * uma frase em português, SEM o nome do constraint (T-07-06).
 *
 * Três SQLSTATE têm tradução: `23505` (unique), `23503` (foreign key) e
 * `23514` (check — inclusive o constraint trigger deferido que a 007 usa para
 * "toda Empresa tem ao menos um Contato admin" e que só dispara no `commit`,
 * Pitfall 1). Qualquer outro, ou um destes sem frase cadastrada, é relançado
 * e vira o 500 genérico do `setErrorHandler` de `app.ts` (T-1-06).
 */

import type { Pool, PoolClient } from "pg";
import type { Recusa, ResultadoCrm } from "./resultado";

/** Frase por nome de constraint. O nome fica aqui; o texto que sai não o carrega. */
export type FrasesDeRestricao = Readonly<Record<string, { codigo: string; error: string; status?: 409 | 404 }>>;

const SQLSTATE_TRADUZIVEIS: ReadonlySet<string> = new Set(["23505", "23503", "23514"]);

export function traduzirErroDePg(erro: unknown, frases: FrasesDeRestricao): Recusa | undefined {
  if (typeof erro !== "object" || erro === null) return undefined;
  const { code, constraint } = erro as { code?: unknown; constraint?: unknown };
  if (typeof code !== "string" || !SQLSTATE_TRADUZIVEIS.has(code)) return undefined;
  if (typeof constraint !== "string") return undefined;
  const frase = frases[constraint];
  if (!frase) return undefined;
  return { status: frase.status ?? 409, error: frase.error, codigo: frase.codigo };
}

/**
 * `begin` → `fn` → `commit` (sucesso) ou `rollback` (recusa). O `commit` fica
 * DENTRO do `try` que tem o `catch` de tradução: o constraint trigger deferido
 * só roda ali. A conexão volta ao pool no `finally`, qualquer que seja o fim.
 */
export async function comTransacao<T>(
  pool: () => Pool,
  fn: (cliente: PoolClient) => Promise<ResultadoCrm<T>>,
  frases: FrasesDeRestricao = {},
): Promise<ResultadoCrm<T>> {
  const cliente = await pool().connect();
  try {
    await cliente.query("begin");
    const resultado = await fn(cliente);
    if (!resultado.ok) {
      await cliente.query("rollback");
      return resultado;
    }
    await cliente.query("commit");
    return resultado;
  } catch (erro) {
    try {
      await cliente.query("rollback");
    } catch {
      // a conexão pode já estar fora da transação (ou quebrada); o erro que importa é o original
    }
    const traduzido = traduzirErroDePg(erro, frases);
    if (traduzido) return { ok: false, ...traduzido };
    throw erro;
  } finally {
    cliente.release();
  }
}
