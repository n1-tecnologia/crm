/**
 * O gesto misto (Fase 14, 3.2.1): um gesto que grava nas tabelas do CRM E em
 * `plataforma.registros` no mesmo commit — tudo ou nada.
 *
 * Mesclar Contatos e as rotas da Tarefa conversacional precisam das duas bases
 * juntas; duas transações deixariam uma Tarefa sem Conversa (ou o inverso) no
 * primeiro erro entre elas. Aqui a transação é a de `executar()`
 * (`persistencia/unidade-de-trabalho.ts`), que já tem a trava do Espaço, a
 * revisão, os eventos de Canal e o `rollback`:
 *
 *   1. `lerDoCrm` roda no mesmo cliente, depois da trava do Espaço e da
 *      hidratação, e é onde a pré-checagem dá a frase rica. Quem a escreve trava
 *      com `for update`, EM ORDEM DE ID, as linhas do CRM de que a escrita
 *      depende (mesclar A em B e B em A ao mesmo tempo, sem a ordem, é `40P01`).
 *   2. `operacao` é a operação pura sobre o `registros`, e recebe o que
 *      `lerDoCrm` leu.
 *   3. `gravarNoCrm` roda em `aoConfirmar`: depois das escritas de `registros`,
 *      antes do `commit`. Se ele lança, a transação inteira é desfeita.
 *
 * A recusa é VALOR, nunca exceção: uma exceção destrói a conexão do pool
 * (`release(true)`), e a recusa previsível (Contato que não existe, Conversa que
 * já está aberta) não pode custar uma conexão. O SQLSTATE é a rede da corrida:
 * entre a pré-checagem e a escrita outra requisição pode entrar, e então é o
 * índice do banco que segura; `23505`, `23503` e `23514` viram 409 com a frase
 * que o serviço passou em `frases`, SEM o nome do constraint (T-07-06).
 *
 * D-01: este arquivo não traduz id antigo em novo. Cada lado grava os ids que já
 * são seus; não há ponte entre as duas bases.
 *
 * Este arquivo também não sobe a revisão do Espaço por fora: a trava do Espaço
 * já é a primeira e `executar()` a sobe. Inverter a ordem das travas abre
 * deadlock com o REST de Canal (ver `persistencia/CONTEXT.md`, "O gesto misto").
 */

import type { PoolClient } from "pg";
import type { DataState, OperationResult } from "@n1/dominio";
import { fail } from "@n1/dominio/state";
import { executar, type ResultadoTransacao } from "../../persistencia/unidade-de-trabalho";
import { recusa, sucesso, type Recusa, type ResultadoCrm } from "./resultado";
import { traduzirErroDePg, type FrasesDeRestricao } from "./transacao";

export interface GestoMisto<L, T> {
  /** Pré-checa e lê o CRM no mesmo cliente; uma recusa aqui volta como valor e nada roda depois. */
  readonly lerDoCrm: (cliente: PoolClient, state: DataState) => Promise<ResultadoCrm<L>>;
  /** A operação pura sobre o estado de `registros`. */
  readonly operacao: (state: DataState, lido: L) => OperationResult<T>;
  /**
   * A escrita nas tabelas do CRM. Pode devolver uma recusa (`ok: false`), que
   * desfaz tudo e volta como valor: só para o que a pré-checagem de `lerDoCrm`
   * não pegou (a conexão sai do pool, como em qualquer exceção do bloco).
   */
  readonly gravarNoCrm: (cliente: PoolClient, valor: T, lido: L) => Promise<ResultadoCrm<void> | void>;
}

export interface DesfechoDoGestoMisto<T> {
  readonly valor: T;
  readonly resultado: ResultadoTransacao<T> & { readonly ok: true };
  /** O estado depois da operação, inteiro: é sobre ele que a resposta é recortada por Membro. */
  readonly depois: DataState;
}

/** Leva uma recusa de `gravarNoCrm` até o `catch` de `executarGestoMisto`, desfazendo a transação no caminho. */
class RecusaDentroDoGesto extends Error {
  constructor(readonly recusa: Recusa) {
    super(recusa.error);
  }
}

export async function executarGestoMisto<L, T>(
  workspaceId: string,
  gesto: GestoMisto<L, T>,
  frases: FrasesDeRestricao = {},
): Promise<ResultadoCrm<DesfechoDoGestoMisto<T>>> {
  let recusaDoCrm: Recusa | undefined;
  let depois: DataState | undefined;
  try {
    const resultado = await executar<T, ResultadoCrm<L>>(
      workspaceId,
      (state, lido) => {
        // A recusa de `lerDoCrm` vira `fail` para `executar()` desfazer limpo
        // (desfecho "recusou", conexão de volta ao pool); o status e o código
        // dela voltam pela variável do fechamento.
        if (!lido.ok) {
          recusaDoCrm = lido;
          return fail(lido.error);
        }
        depois = state;
        return gesto.operacao(state, lido.valor);
      },
      {
        lerDoCrm: gesto.lerDoCrm,
        aoConfirmar: async (cliente, valor, _state, lido) => {
          if (!lido.ok) return;
          const saida = (await gesto.gravarNoCrm(cliente, valor, lido.valor)) as ResultadoCrm<void> | undefined;
          if (saida && !saida.ok) throw new RecusaDentroDoGesto(saida);
        },
      },
    );

    if ("conflito" in resultado) return recusa(409, resultado.error, { codigo: "CONFLITO" });
    if (recusaDoCrm) return { ok: false, ...recusaDoCrm };
    if (!resultado.ok) return recusa(409, resultado.error, { codigo: "RECUSA_DO_DOMINIO", ...(resultado.field === undefined ? {} : { campo: resultado.field }) });
    if (!depois) throw new Error("O gesto misto gravou sem passar pela operação.");
    return sucesso({ valor: resultado.value, resultado, depois });
  } catch (erro) {
    if (erro instanceof RecusaDentroDoGesto) return { ok: false, ...erro.recusa };
    const traduzido = traduzirErroDePg(erro, frases);
    if (traduzido) return { ok: false, ...traduzido };
    throw erro;
  }
}
