/**
 * A Unidade de Trabalho: onde uma operação do domínio vira uma transação.
 *
 * Hidrata o Espaço de Trabalho, roda a operação **pura** — a mesma função que
 * `apps/web` roda em memória, sem variante de servidor —, grava o que mudou e
 * confirma. Nada aqui sabe o que a operação faz; se soubesse, haveria duas
 * versões de cada regra, e elas divergiriam.
 *
 * Concorrência: a revisão do Espaço de Trabalho é lida no início e conferida
 * no fim. Se outra escrita entrou no meio, esta não sobrescreve — devolve
 * conflito para quem chamou tentar de novo sobre o estado novo. É o grão certo
 * porque é o grão que a operação enxerga: ela lê o grafo inteiro, então duas
 * escritas simultâneas no mesmo Espaço podem se invalidar mesmo tocando
 * registros diferentes.
 */

import type { PoolClient } from "pg";
import type { DataState, Diferenca, OperationResult } from "@n1/dominio";
import { DIFERENCA_VAZIA } from "@n1/dominio";
import { syncIdSequence } from "@n1/dominio/operations";
import { limitesDoPool, pool } from "./conexao";
import { execucoesNovas, eventosDeNotificacaoPorCanal } from "./eventos-de-canal";
import { gravarEventos, type EventoDeSaida } from "./outbox";
import { acrescentarCanaisProjetados, carregarCanaisProjetados, semCanaisProjetados } from "./canais-projetados";
import { gravar, hidratar } from "./repositorio";

export type Conflito = { readonly ok: false; readonly conflito: true; readonly error: string };

export type ResultadoTransacao<T> =
  | (OperationResult<T> & { readonly diferenca: Diferenca; readonly revisao: number; readonly revisaoAnterior: number })
  | Conflito;

/** Como a chamada de `executar()` terminou — o `desfecho` de `MedicaoDaExecucao`. */
export type DesfechoDaExecucao = "gravou" | "recusou" | "conflito" | "excecao";

/**
 * O tempo de cada etapa de uma chamada de `executar()` (Fase 12, D-02), em
 * milissegundos com uma casa decimal, SOMADO entre as tentativas — o que a
 * pessoa sente é o total, e `tentativas` diz quantas voltas ele teve.
 *
 * Chega a quem chamou por callback (`OpcoesExecucao.aoMedir`) e NÃO como campo
 * de `ResultadoTransacao`: o resultado vira corpo de resposta HTTP em vários
 * pontos de `rotas/` e a medição nunca pode sair no corpo (D-03). Pelo callback
 * ela não tem como vazar por construção, e cobre também o conflito e a exceção,
 * que não devolvem resultado de sucesso.
 *
 *   - `conexaoMs`: `pool().connect()` — a espera pelo pool.
 *   - `inicioMs`: o `begin` com os três prazos do servidor.
 *   - `hidratarMs`: `hidratar()` — a leitura do Espaço inteiro.
 *   - `canaisMs`: a projeção dos Canais relacionais (também por tentativa).
 *   - `operacaoMs`: a operação pura do domínio.
 *   - `atualizaMs`: só o `update plataforma.workspaces … revisao`.
 *   - `travaMs`: o tempo até a revisão estar GARANTIDA. Neste regime
 *     (revisão otimista) é a duração do `update … where revisao = $2`; no
 *     regime travado de 12-04 será o `select … for update` mais o `update`.
 *     Mesma definição nos dois, para a coluna ser comparável (Open Question 3);
 *     `atualizaMs` isola o `update` sozinho.
 *   - `gravarMs`: `gravar()` — o diff contra `plataforma.registros`.
 *   - `eventosMs`: os eventos de saída (outbox) mais o `aoConfirmar`.
 *   - `commitMs`: o `commit`.
 *
 * `linhasLidas` conta os registros do Espaço hidratado (`plataforma.registros`;
 * os Canais projetados têm `canaisMs` à parte) e `linhasGravadas`, os gravados
 * mais os removidos da diferença.
 */
export interface MedicaoDaExecucao {
  readonly conexaoMs: number;
  readonly inicioMs: number;
  readonly travaMs: number;
  readonly hidratarMs: number;
  readonly canaisMs: number;
  readonly operacaoMs: number;
  readonly atualizaMs: number;
  readonly gravarMs: number;
  readonly eventosMs: number;
  readonly commitMs: number;
  readonly tentativas: number;
  readonly linhasLidas: number;
  readonly linhasGravadas: number;
  readonly desfecho: DesfechoDaExecucao;
}

export interface OpcoesExecucao<T = unknown> {
  /**
   * Fase 12 (D-02/D-03) — recebe a medição por etapa, UMA vez por chamada de
   * `executar()`, inclusive na recusa do domínio, no conflito e na exceção
   * (`desfecho` diz qual). Um `aoMedir` que lança é engolido: medir nunca
   * muda o resultado de uma gravação. Quem recebe (a rota) é quem decide
   * onde a medição vai — para o log do servidor, nunca para a resposta.
   */
  readonly aoMedir?: (medicao: MedicaoDaExecucao) => void;
  /** Quantas vezes repetir em caso de conflito antes de desistir. */
  readonly tentativas?: number;
  /**
   * Função pura que A ROTA fornece, derivando SEUS PRÓPRIOS eventos de saída
   * do resultado da operação — nunca do `diferenca` (D-18, T-02-16). A
   * operação de domínio continua sem saber que outbox existe: é o mesmo
   * princípio do cabeçalho deste arquivo, "nada aqui reescreve regra de
   * negócio", agora aplicado ao lado de fora dele.
   *
   * O evento de Canal (`automacao.notificar-canal.v1`) NÃO entra por aqui:
   * `executar()` o deriva sozinho, obrigatoriamente (CR-05), a partir das
   * `AutomationExecution` que nasceram na transação — nunca opt-in por rota.
   * Os eventos que a rota fornecer aqui são somados aos de Canal, nunca os
   * substituem.
   */
  readonly eventos?: (valor: T, state: DataState) => readonly EventoDeSaida[];
  /**
   * Quem passa `true` declara que esta transação NÃO PODE gravar evento de
   * saída de nenhum tipo — nem os que `eventos` acima devolveria, nem o de
   * Canal derivado obrigatoriamente. Se, ainda assim, a lista de eventos não
   * estiver vazia, `executar()` lança ANTES de `gravarEventos` e a exceção
   * desfaz a transação inteira (mesmo caminho de qualquer outra exceção
   * dentro deste bloco). Uso: as importações históricas (CR-05/T-5-57), que
   * rodam com `runAutomations: false` e não podem, por construção, acordar
   * Automação nenhuma — muito menos gravar o aviso dela.
   */
  readonly semEventosDeSaida?: true;
  /**
   * Plan 02-16 — roda DEPOIS de gravar Tarefa/anexos e o(s) evento(s) de
   * outbox, ANTES do `commit`: o MESMO `cliente`, a MESMA transação. Único
   * uso até aqui é `consumirSessao` (`./sessoes-de-upload.ts`) — a submissão
   * pública do Formulário precisa marcar a sessão de upload como consumida
   * no mesmo commit que grava a Tarefa (T-02-06: uma sessão vira anexo uma
   * vez só), sem que a Unidade de Trabalho precise saber o que é uma
   * "sessão de upload". Escolhida em vez de expor o `cliente` inteiro à
   * rota: menos superfície para quem chama `executar()` errar (um `cliente`
   * solto convidaria a rodar SQL de negócio fora da revisão otimista desta
   * função). Lançar aqui desfaz a transação inteira — mesmo efeito de uma
   * exceção dentro de `operacao`.
   */
  readonly aoConfirmar?: (cliente: PoolClient, valor: T, state: DataState) => Promise<void>;
}

/**
 * O `begin` e, no MESMO ida-e-volta, os três prazos do lado do servidor.
 *
 *   - `idle_in_transaction_session_timeout` = Q (o `query_timeout` do pool):
 *     se este cliente sumir no meio da transação (o pooler derrubou a conexão
 *     sem aviso), o Postgres encerra a sessão parada e solta a revisão do
 *     Espaço de Trabalho — que o `update ... revisao` abaixo trava até o
 *     `commit`. Sem isto, em 2026-09-29, toda escrita no `ws_n1` ficou
 *     esperando o TCP desistir (16 e 10 minutos).
 *   - `statement_timeout` = 80 % de Q e `lock_timeout` = Q / 3 (06-13, H4 do
 *     diagnóstico em `06-13-SUMMARY.md`): o `query_timeout` é um temporizador
 *     DO CLIENTE — ao estourar, o `pg` devolve `Query read timeout` e NÃO
 *     cancela a instrução no servidor. Atrás do pooler, um `update ...
 *     revisao` que esperava a trava podia seguir vivo, órfão, e pegar a
 *     revisão depois que o cliente já tinha desistido; o próximo escritor
 *     estourava também (06-PROVAS: 3 × `Query read timeout` enquanto a tela
 *     gravava). Com os dois prazos ABAIXO de Q, o servidor desiste antes do
 *     cliente, e a espera pela trava vira `55P03` em Q / 3 — conflito, não
 *     exceção (ver `executar`).
 *
 * Mínimo 1 ms: `0` no Postgres DESLIGA o prazo, o contrário do que se quer.
 * `set local` vale só para esta transação; com o `query_timeout` desligado
 * (`DATABASE_QUERY_TIMEOUT_MS=0`, migração longa à mão), fica o `begin` puro.
 */
export function inicioDaTransacao(env: NodeJS.ProcessEnv = process.env): string {
  const prazo = limitesDoPool(env).query_timeout;
  if (!prazo) return "begin";
  const instrucao = Math.max(1, Math.floor(prazo * 0.8));
  const trava = Math.max(1, Math.floor(prazo / 3));
  return `begin; set local idle_in_transaction_session_timeout = ${prazo}; set local statement_timeout = ${instrucao}; set local lock_timeout = ${trava}`;
}

/** SQLSTATE `lock_not_available`: o `lock_timeout` do `begin` esgotou esperando a trava. */
const TRAVA_ESGOTADA = "55P03";

function sqlstateDe(erro: unknown): unknown {
  return typeof erro === "object" && erro !== null ? (erro as { readonly code?: unknown }).code : undefined;
}

/** Milissegundos com uma casa decimal: o que `MedicaoDaExecucao` entrega. */
function umaCasa(ms: number): number {
  return Math.round(ms * 10) / 10;
}

/** Soma os Maps internos de `original` (coleção > id > json): quantos registros o Espaço tinha. */
function registrosLidos(original: ReadonlyMap<string, ReadonlyMap<string, unknown>> | undefined): number {
  let total = 0;
  for (const porColecao of original?.values() ?? []) total += porColecao.size;
  return total;
}

export async function executar<T>(
  workspaceId: string,
  operacao: (state: DataState) => OperationResult<T>,
  opcoes: OpcoesExecucao<T> = {},
): Promise<ResultadoTransacao<T>> {
  const tentativas = opcoes.tentativas ?? 3;
  let ultimo: Conflito | undefined;

  // D-02 — o acumulador da medição. `performance.now()` em volta de cada etapa,
  // somando as tentativas. Só mede: não muda SQL, número de tentativas nem a
  // ordem das instruções (o regime de gravação muda em 12-04, não aqui).
  const acc = {
    conexaoMs: 0,
    inicioMs: 0,
    travaMs: 0,
    hidratarMs: 0,
    canaisMs: 0,
    operacaoMs: 0,
    atualizaMs: 0,
    gravarMs: 0,
    eventosMs: 0,
    commitMs: 0,
    tentativas: 0,
    linhasLidas: 0,
    linhasGravadas: 0,
  };
  let desfecho: DesfechoDaExecucao = "excecao";

  try {
    for (let n = 0; n < tentativas; n += 1) {
      acc.tentativas += 1;
      let t = performance.now();
      const cliente = await pool().connect();
      acc.conexaoMs += performance.now() - t;
      let falhou = false;
      try {
        t = performance.now();
        await cliente.query(inicioDaTransacao());
        acc.inicioMs += performance.now() - t;

        t = performance.now();
        const antes = await hidratar(cliente, workspaceId);
        acc.hidratarMs += performance.now() - t;
        // As fakes de teste devolvem `{ state, revisao }` sem `original`: padrão 0.
        acc.linhasLidas += registrosLidos(antes.original);

        // D-11 (Pitfall 4) — os Canais relacionais (`plataforma.canais`) entram em
        // `state.channels` para a operação do modelo antigo enxergá-los; sem isso
        // `startConversation`/`sendMessage` dariam "Canal não encontrado" e
        // desfariam o gesto da tela. É por tentativa: um retry por conflito
        // recarrega. `hidratar()` em si não sabe deles.
        t = performance.now();
        const fotografia = acrescentarCanaisProjetados(
          antes.state,
          await carregarCanaisProjetados(cliente, workspaceId),
        );
        acc.canaisMs += performance.now() - t;
        // O contador de `nextId` é de módulo: sem sincronizar com o maior id já
        // presente no estado hidratado, um processo recém-subido geraria
        // `act_000001` de novo e o upsert sobrescreveria um registro real. A
        // operação é síncrona, então reset + execução acontecem no mesmo turno
        // do event loop — duas requisições concorrentes não se misturam (a
        // revisão otimista cuida do resto).
        syncIdSequence(antes.state);
        // CR-05 — capturado AQUI, dentro do laço de tentativas, para que um
        // retry por conflito de revisão recomece do zero: o mesmo cuidado que
        // `rotas/operacoes.ts` e `automacoes/scheduler-worker.ts` já
        // documentavam quando a captura ainda morava em cada chamador.
        const idsAntes = new Set(antes.state.automationExecutions.map((e) => e.id));
        t = performance.now();
        const resultado = operacao(antes.state);
        acc.operacaoMs += performance.now() - t;

        if (!resultado.ok) {
          // A recusa é resposta legítima do domínio, não falha: nada foi gravado,
          // mas a transação fecha limpa para não segurar conexão.
          await cliente.query("rollback");
          desfecho = "recusou";
          return { ...resultado, diferenca: DIFERENCA_VAZIA, revisao: antes.revisao, revisaoAnterior: antes.revisao };
        }

        let travada;
        t = performance.now();
        try {
          travada = await cliente.query<{ revisao: string }>(
            "update plataforma.workspaces set revisao = revisao + 1, atualizado_em = now() where workspace_id = $1 and revisao = $2 returning revisao",
            [workspaceId, antes.revisao],
          );
        } catch (erro) {
          // 06-13 (H4) — a trava da revisão não saiu dentro do `lock_timeout`:
          // outra escrita está segurando o Espaço. É conflito, como a revisão
          // que mudou: desfaz, e a próxima tentativa (ou quem chamou) começa do
          // zero sobre o estado novo. A conexão está sã — não sai do pool.
          // Qualquer outro erro sobe como sempre (e a conexão é descartada).
          if (sqlstateDe(erro) !== TRAVA_ESGOTADA) throw erro;
          const gasto = performance.now() - t;
          acc.atualizaMs += gasto;
          acc.travaMs += gasto;
          await cliente.query("rollback");
          ultimo = { ok: false, conflito: true, error: "Outra alteração entrou antes desta. Tente de novo." };
          continue;
        }
        const gastoNoUpdate = performance.now() - t;
        acc.atualizaMs += gastoNoUpdate;
        acc.travaMs += gastoNoUpdate;
        if (travada.rowCount === 0) {
          await cliente.query("rollback");
          ultimo = { ok: false, conflito: true, error: "Outra alteração entrou antes desta. Tente de novo." };
          continue;
        }

        // D-11 (Pitfall 3) — `gravar` recebe o estado SEM os projetados: copiá-los
        // para `plataforma.registros` criaria uma segunda fonte de verdade do
        // Canal. Se a operação mudou algum, `semCanaisProjetados` lança e a
        // transação é desfeita. `opcoes.eventos`/`aoConfirmar` seguem com
        // `antes.state` (o payload de `automacao.notificar-canal.v1` leva o tipo,
        // não o id do Canal).
        t = performance.now();
        const diferenca = await gravar(cliente, workspaceId, semCanaisProjetados(antes.state, fotografia), antes);
        acc.gravarMs += performance.now() - t;
        // A fake de `gravar` devolve `{}`: padrão 0.
        acc.linhasGravadas += (diferenca.gravados?.length ?? 0) + (diferenca.removidos?.length ?? 0);
        // D-18 — o evento nasce no MESMO `cliente`, ANTES do commit: Tarefa e
        // evento são a mesma transação, sem que a operação de domínio saiba
        // que outbox existe. Nunca chamar `fetch`/HTTP neste bloco — a entrega
        // é responsabilidade exclusiva de `outbox-worker.ts`, fora da UoW.
        //
        // CR-05 — o evento de Canal é derivado AQUI, obrigatoriamente, a
        // partir das Execuções que nasceram NESTA transação (nunca do
        // `diferenca`, D-18) — soma-se ao que a rota fornecer em `opcoes.eventos`,
        // para que nenhuma rota que rode Automação consiga esquecê-lo.
        t = performance.now();
        const eventos = [
          ...(opcoes.eventos?.(resultado.value, antes.state) ?? []),
          ...eventosDeNotificacaoPorCanal(antes.state, execucoesNovas(antes.state, idsAntes)),
        ];
        if (opcoes.semEventosDeSaida && eventos.length > 0) {
          throw new Error("Esta operação não pode gravar evento de saída — plataforma.integration_outbox não pode crescer.");
        }
        await gravarEventos(cliente, workspaceId, eventos);
        if (opcoes.aoConfirmar) await opcoes.aoConfirmar(cliente, resultado.value, antes.state);
        acc.eventosMs += performance.now() - t;
        t = performance.now();
        await cliente.query("commit");
        acc.commitMs += performance.now() - t;
        // A nova revisão é a que o `update ... returning revisao` devolveu —
        // usar o valor lido em vez de `antes.revisao + 1` evita depender de
        // aritmética paralela com o que o banco de fato gravou.
        desfecho = "gravou";
        return { ...resultado, diferenca, revisao: Number(travada.rows[0]!.revisao), revisaoAnterior: antes.revisao };
      } catch (erro) {
        falhou = true;
        await cliente.query("rollback").catch(() => undefined);
        throw erro;
      } finally {
        // Com falha, a conexão sai do pool (`release(true)` a destrói): a que ficou
        // sem resposta no meio da transação não pode servir à próxima requisição.
        cliente.release(falhou);
      }
    }

    desfecho = "conflito";
    return ultimo ?? { ok: false, conflito: true, error: "Não foi possível gravar após várias tentativas." };
  } finally {
    if (opcoes.aoMedir) {
      try {
        opcoes.aoMedir({
          conexaoMs: umaCasa(acc.conexaoMs),
          inicioMs: umaCasa(acc.inicioMs),
          travaMs: umaCasa(acc.travaMs),
          hidratarMs: umaCasa(acc.hidratarMs),
          canaisMs: umaCasa(acc.canaisMs),
          operacaoMs: umaCasa(acc.operacaoMs),
          atualizaMs: umaCasa(acc.atualizaMs),
          gravarMs: umaCasa(acc.gravarMs),
          eventosMs: umaCasa(acc.eventosMs),
          commitMs: umaCasa(acc.commitMs),
          tentativas: acc.tentativas,
          linhasLidas: acc.linhasLidas,
          linhasGravadas: acc.linhasGravadas,
          desfecho,
        });
      } catch {
        // A medição nunca derruba uma gravação: um `aoMedir` que lança não pode
        // trocar o resultado já decidido (nem mascarar a exceção que está subindo).
      }
    }
  }
}
