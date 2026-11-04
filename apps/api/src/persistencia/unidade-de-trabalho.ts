/**
 * A Unidade de Trabalho: onde uma operação do domínio vira uma transação.
 *
 * Hidrata o Espaço de Trabalho, roda a operação **pura** — a mesma função que
 * `apps/web` roda em memória, sem variante de servidor —, grava o que mudou e
 * confirma. Nada aqui sabe o que a operação faz; se soubesse, haveria duas
 * versões de cada regra, e elas divergiriam.
 *
 * Concorrência (Fase 12, D-09/D-10): o domínio lê o grafo inteiro do Espaço,
 * então duas escritas simultâneas no mesmo Espaço podem se invalidar mesmo
 * tocando registros diferentes — o grão da exclusão é o Espaço, e a revisão
 * dele (`plataforma.workspaces.revisao`) é o que se disputa. Dois regimes:
 *
 *   - `travado` (o padrão): logo depois do `begin`, `select … for update` na
 *     linha do Espaço, como instrução própria; só depois a leitura. Quem chega
 *     durante outra gravação ESPERA a vez (no máximo o `lock_timeout`, 10 s com
 *     o `query_timeout` padrão) e hidrata o que o escritor anterior confirmou:
 *     uma tentativa só, sem repetir. `55P03` na trava é conflito como valor
 *     (409 na rota), com um `rollback` e a conexão de volta ao pool; um `55P03`
 *     em qualquer outro ponto (no `commit`, no `aoConfirmar`) sobe como exceção.
 *   - `otimista` (só as importações manuais longas, D-10): a revisão é lida na
 *     hidratação e conferida no `update` do fim; se outra escrita entrou no
 *     meio, devolve conflito e o laço tenta de novo sobre o estado novo, até 3
 *     vezes (`tentativas`). Travar o Espaço no começo seguraria o `ws_n1`
 *     inteiro durante os minutos de uma importação. `55P03` no `update` é
 *     conflito, como a revisão que mudou. O `update` do fim toma a mesma
 *     trava e a segura durante o `gravar()` do lote, os eventos e o `commit`:
 *     uma gravação da tela nessa janela espera o `lock_timeout` (10 s) e vira
 *     409 — e a tela reverte o que já tinha mostrado. Rode as importações fora
 *     do horário de uso.
 *
 * Idas ao banco (Fase 13): cada uma custa a distância até ele (cerca de 52 ms
 * de Chicago a Oregon, medido em produção), e a Fase 12 fazia sete por
 * gravação (oito com remoção ou na primeira do processo). O `travado` as junta
 * em duas mensagens de várias instruções: a de entrada (`begin`, prazos,
 * trava, leitura do Espaço e Canais) e a de saída (`update` da revisão,
 * escritas e `commit`). A de saída só vale sem evento de saída nem
 * `aoConfirmar`, que precisam de instruções depois das escritas; com eles, o
 * fim segue instrução por instrução. `idasEVoltas` em `MedicaoDaExecucao` diz
 * quantas foram.
 */

import type { PoolClient, QueryResult } from "pg";
import type { Channel, DataState, Diferenca, OperationResult } from "@n1/dominio";
import { DIFERENCA_VAZIA } from "@n1/dominio";
import { syncIdSequence } from "@n1/dominio/operations";
import { limitesDoPool, pool } from "./conexao";
import { execucoesNovas, eventosDeNotificacaoPorCanal } from "./eventos-de-canal";
import { gravarEventos, type EventoDeSaida } from "./outbox";
import {
  acrescentarCanaisProjetados,
  canaisProjetadosDasLinhas,
  carregarCanaisProjetados,
  semCanaisProjetados,
  tabelaDeCanaisConfirmada,
} from "./canais-projetados";
import { estadoDasLinhas, gravar, hidratar, planejarGravacao, sqlDeHidratar, sqlsDoPlano, type EstadoHidratado } from "./repositorio";
import { literalEntreDolares } from "./sql-literal";
import { sqlDeTodosOsCanais, type LinhaDoBancoDeCanal } from "../repositorios/crm/canais";

export type Conflito = { readonly ok: false; readonly conflito: true; readonly error: string };

export type ResultadoTransacao<T> =
  | (OperationResult<T> & { readonly diferenca: Diferenca; readonly revisao: number; readonly revisaoAnterior: number })
  | Conflito;

/**
 * Como `executar()` evita que duas gravações no mesmo Espaço se invalidem (D-09/D-10):
 * `travado` trava a linha do Espaço no começo e grava com uma tentativa só;
 * `otimista` confere a revisão no fim e repete em conflito.
 */
export type RegimeDaExecucao = "travado" | "otimista";

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
 *   - `inicioMs`: o `begin` com os três prazos do servidor. No regime
 *     `travado` (Fase 13) é o lote de ENTRADA inteiro: `begin`, trava, leitura
 *     do Espaço e Canais numa ida só, inclusive a espera pela vez.
 *   - `hidratarMs`: `hidratar()` — a leitura do Espaço inteiro. No `travado` é
 *     só o processador (montar o estado a partir das linhas): a ida e volta
 *     está em `inicioMs`.
 *   - `canaisMs`: a projeção dos Canais relacionais (também por tentativa); no
 *     `travado` com a tabela já confirmada, só o processador.
 *   - `operacaoMs`: a operação pura do domínio.
 *   - `atualizaMs`: só o `update plataforma.workspaces … revisao`. 0 no lote de saída.
 *   - `travaMs`: o tempo até a revisão estar GARANTIDA. No regime `otimista`
 *     é a duração do `update … where revisao = $2`; no `travado` é o
 *     `select … for update` (inclusive a ESPERA pela vez) mais o `update`.
 *     Mesma definição nos dois, para a coluna ser comparável (Open Question 3);
 *     `atualizaMs` isola o `update` sozinho. 0 no lote de entrada e no de saída:
 *     a trava vai dentro de `inicioMs` e o `update`, dentro de `gravarMs`.
 *   - `gravarMs`: `gravar()` — o diff contra `plataforma.registros`. No lote de
 *     SAÍDA (`travado`, sem evento nem `aoConfirmar`) é o diff mais a mensagem
 *     única: `update` da revisão, escritas e `commit`.
 *   - `eventosMs`: os eventos de saída (outbox) mais o `aoConfirmar`.
 *   - `commitMs`: o `commit`. 0 no lote de saída.
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
  /** Quantas vezes a gravação foi ao banco (cada `query` é uma ida e volta; o `connect` não conta) — Fase 13. */
  readonly idasEVoltas: number;
  readonly desfecho: DesfechoDaExecucao;
  /** O regime com que a chamada rodou (D-09/D-10): `travado` é o padrão. */
  readonly regime: RegimeDaExecucao;
}

/** As opções de `executar()` que valem nos dois regimes. */
export interface OpcoesComunsDaExecucao<T = unknown, L = undefined> {
  /**
   * Fase 12 (D-02/D-03) — recebe a medição por etapa, UMA vez por chamada de
   * `executar()`, inclusive na recusa do domínio, no conflito e na exceção
   * (`desfecho` diz qual). Um `aoMedir` que lança é engolido: medir nunca
   * muda o resultado de uma gravação. Quem recebe (a rota) é quem decide
   * onde a medição vai — para o log do servidor, nunca para a resposta.
   */
  readonly aoMedir?: (medicao: MedicaoDaExecucao) => void;
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
  readonly aoConfirmar?: (cliente: PoolClient, valor: T, state: DataState, lido: L) => Promise<void>;
  /**
   * Fase 14 (3.2.1, o gesto misto) — lê as tabelas do CRM NO MESMO `cliente`,
   * depois da trava do Espaço, da hidratação e da projeção dos Canais, e antes
   * da `operacao`. O que devolve chega à `operacao` (2º argumento) e a
   * `aoConfirmar` (4º): é por aí que um gesto que mexe nas duas bases enxerga
   * o CRM sem abrir outra transação. Recebe o `state` já com os Canais
   * projetados (a troca de Canal da Tarefa precisa achar o Contato pelo
   * Vínculo antes de ler o CRM).
   *
   * Quem a usa trava com `for update`, em ordem de id, as linhas do CRM de que
   * a escrita depende; a trava do Espaço já é a primeira. NÃO avançar a
   * revisão do Espaço por fora daqui: `executar()` já a sobe, e inverter a
   * ordem das travas abre deadlock com o REST de Canal. Lançar desfaz a
   * transação e a conexão sai do pool, como qualquer exceção do bloco. O tempo
   * soma em `hidratarMs` (é leitura dentro da transação); a medição não ganha
   * campo.
   */
  readonly lerDoCrm?: (cliente: PoolClient, state: DataState) => Promise<L>;
}

/**
 * As opções de `executar()`: as comuns mais o regime (D-09/D-10).
 *
 *   - sem `regime`, ou `regime: "travado"` (o padrão): uma tentativa só. NÃO
 *     existe `tentativas` aqui — o tipo recusa, porque repetir não tem o que
 *     fazer depois de uma trava que espera a vez.
 *   - `regime: "otimista"`: o de antes da Fase 12, só para as importações
 *     manuais longas (`tentativas` repete em conflito, padrão 3). Quem passa
 *     `otimista` sem ser uma dessas quatro importações falha em
 *     `regime-dos-chamadores.test.ts`.
 */
export type OpcoesExecucao<T = unknown, L = undefined> = OpcoesComunsDaExecucao<T, L> &
  (
    | { readonly regime?: "travado"; readonly tentativas?: never }
    | {
        readonly regime: "otimista";
        /** Quantas vezes repetir em caso de conflito de revisão antes de desistir (padrão 3). */
        readonly tentativas?: number;
      }
  );

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
 * (`DATABASE_QUERY_TIMEOUT_MS=0`, migração longa à mão), fica o `begin` puro —
 * o que só o regime `otimista` usa (ver `inicioDaTransacaoTravada`).
 */
export function inicioDaTransacao(env: NodeJS.ProcessEnv = process.env): string {
  const prazo = limitesDoPool(env).query_timeout;
  if (!prazo) return "begin";
  const instrucao = Math.max(1, Math.floor(prazo * 0.8));
  const trava = Math.max(1, Math.floor(prazo / 3));
  return `begin; set local idle_in_transaction_session_timeout = ${prazo}; set local statement_timeout = ${instrucao}; set local lock_timeout = ${trava}`;
}

/**
 * A espera pela trava do Espaço quando o `query_timeout` está desligado (Q = 0):
 * o mesmo 10 s que Q = 30 s dá a `lock_timeout` (Q / 3).
 */
export const TRAVA_DE_RESERVA_MS = 10_000;

/**
 * O `begin` do regime `travado`: igual a `inicioDaTransacao(env)` com Q > 0.
 *
 * Com Q = 0 (`DATABASE_QUERY_TIMEOUT_MS=0`, que é a prática das importações
 * manuais longas e que um CLI de `bootstrap/` pode herdar do shell do operador)
 * o `begin` puro deixaria o `select … for update` esperar SEM PRAZO por um
 * escritor lento — o Postgres não tem `lock_timeout` por padrão. Então só o
 * `lock_timeout` de reserva (`TRAVA_DE_RESERVA_MS`) entra: o `begin` puro fica
 * só no regime `otimista` (RESEARCH, Pitfall 7; T-12-10).
 */
export function inicioDaTransacaoTravada(env: NodeJS.ProcessEnv = process.env): string {
  if (!limitesDoPool(env).query_timeout) return `begin; set local lock_timeout = ${TRAVA_DE_RESERVA_MS}`;
  return inicioDaTransacao(env);
}

/**
 * A trava do regime `travado`: a linha do Espaço, numa instrução ANTERIOR a `hidratar` (em READ COMMITTED a hidratação enxerga, assim, o que o escritor anterior confirmou).
 * O id é `$1` ou um literal: no lote de entrada (Fase 13) não há parâmetros.
 */
function sqlDaTrava(workspaceId: string): string {
  return `select revisao from plataforma.workspaces where workspace_id = ${workspaceId} for update`;
}

/** Regime `travado`: a revisão sobe sem conferência — a linha é desta transação até o `commit`. */
function sqlDaRevisaoTravada(workspaceId: string): string {
  return `update plataforma.workspaces set revisao = revisao + 1, atualizado_em = now() where workspace_id = ${workspaceId} returning revisao`;
}

/** Regime `otimista`: a revisão só sobe se ainda for a que a hidratação leu. */
const SQL_REVISAO_OTIMISTA =
  "update plataforma.workspaces set revisao = revisao + 1, atualizado_em = now() where workspace_id = $1 and revisao = $2 returning revisao";

const MENSAGEM_DO_CONFLITO = "Outra alteração entrou antes desta. Tente de novo.";

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

/** O acumulador da medição (D-02): `performance.now()` por etapa, somando as tentativas. */
interface Acumulador {
  conexaoMs: number;
  inicioMs: number;
  travaMs: number;
  hidratarMs: number;
  canaisMs: number;
  operacaoMs: number;
  atualizaMs: number;
  gravarMs: number;
  eventosMs: number;
  commitMs: number;
  tentativas: number;
  linhasLidas: number;
  linhasGravadas: number;
  idasEVoltas: number;
}

/** O que UMA tentativa devolve: o resultado da chamada, ou o conflito (a trava esgotou, a revisão mudou). */
type Tentativa<T> =
  | { readonly tipo: "concluida"; readonly resultado: ResultadoTransacao<T>; readonly desfecho: "gravou" | "recusou" }
  | { readonly tipo: "conflito"; readonly conflito: Conflito };

export async function executar<T, L = undefined>(
  workspaceId: string,
  operacao: (state: DataState, lido: L) => OperationResult<T>,
  opcoes: OpcoesExecucao<T, L> = {},
): Promise<ResultadoTransacao<T>> {
  const regime: RegimeDaExecucao = opcoes.regime ?? "travado";
  // D-09: o travado grava com UMA tentativa — esperou a vez, não há o que repetir.
  // `tentativas` só existe (e só vale) no otimista, onde é o que sempre foi: 3.
  const tentativas = opcoes.regime === "otimista" ? (opcoes.tentativas ?? 3) : 1;
  let ultimo: Conflito | undefined;

  // D-02 — o acumulador da medição. Só mede: não muda SQL, número de tentativas
  // nem a ordem das instruções.
  const acc: Acumulador = {
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
    idasEVoltas: 0,
  };
  let desfecho: DesfechoDaExecucao = "excecao";

  try {
    for (let n = 0; n < tentativas; n += 1) {
      acc.tentativas += 1;
      const tentativa = await umaTentativa(workspaceId, operacao, opcoes, regime, acc);
      if (tentativa.tipo === "concluida") {
        desfecho = tentativa.desfecho;
        return tentativa.resultado;
      }
      ultimo = tentativa.conflito;
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
          idasEVoltas: acc.idasEVoltas,
          desfecho,
          regime,
        });
      } catch {
        // A medição nunca derruba uma gravação: um `aoMedir` que lança não pode
        // trocar o resultado já decidido (nem mascarar a exceção que está subindo).
      }
    }
  }
}

/** `cliente.query()` conta uma ida e volta em `acc.idasEVoltas`: a medida de quantas vezes a gravação foi ao banco (Fase 13). */
function contandoIdasEVoltas(cliente: PoolClient, acc: Acumulador): PoolClient {
  return new Proxy(cliente, {
    get(alvo, propriedade) {
      const valor: unknown = Reflect.get(alvo, propriedade, alvo);
      if (propriedade === "query") {
        return (...argumentos: unknown[]) => {
          acc.idasEVoltas += 1;
          return (valor as (...a: unknown[]) => unknown).apply(alvo, argumentos);
        };
      }
      return typeof valor === "function" ? (valor as (...a: unknown[]) => unknown).bind(alvo) : valor;
    },
  });
}

/**
 * Várias instruções numa ida só: o protocolo simples devolve um resultado por
 * instrução, na ordem. Sem `$1` — o que seria parâmetro vai como literal
 * (`literalEntreDolares`).
 */
async function emLote(cliente: PoolClient, instrucoes: readonly string[]): Promise<QueryResult[]> {
  const resultados = (await cliente.query(instrucoes.join("; "))) as unknown as QueryResult | QueryResult[];
  return Array.isArray(resultados) ? resultados : [resultados];
}

type Entrada =
  | { readonly tipo: "aberta"; readonly antes: EstadoHidratado; readonly canais: Channel[] }
  | { readonly tipo: "conflito"; readonly conflito: Conflito };

/**
 * A entrada do regime `travado` numa ida só (Fase 13): `begin` com os prazos,
 * a trava da linha do Espaço, a leitura do Espaço inteiro e, quando a guarda
 * já confirmou a tabela, os Canais — quatro idas e voltas viram uma.
 *
 * A ordem das instruções é a de antes, e é ela que importa: em READ COMMITTED
 * cada instrução tira o próprio retrato quando COMEÇA, então a leitura, que
 * vem depois da trava, enxerga o que o escritor anterior confirmou. Juntar a
 * trava e a leitura numa CONSULTA só daria registros velhos com a revisão nova;
 * juntá-las na mesma MENSAGEM não.
 */
async function abrirTravado(cliente: PoolClient, workspaceId: string, acc: Acumulador): Promise<Entrada> {
  const espaco = literalEntreDolares(workspaceId);
  const canaisNoLote = tabelaDeCanaisConfirmada();
  const t = performance.now();
  let resultados: QueryResult[];
  try {
    resultados = await emLote(cliente, [
      inicioDaTransacaoTravada(),
      sqlDaTrava(espaco),
      sqlDeHidratar(espaco),
      ...(canaisNoLote ? [sqlDeTodosOsCanais(espaco)] : []),
    ]);
  } catch (erro) {
    acc.inicioMs += performance.now() - t;
    // 06-13 (H4) / D-09 — a vez não chegou dentro do `lock_timeout`: outra
    // gravação segura o Espaço. É conflito como valor (409 na rota), SEM
    // repetir. Nenhuma instrução de leitura espera trava, então `55P03` aqui só
    // pode ser a da trava. A conexão está sã e volta ao pool; qualquer outro
    // erro sobe (e a conexão sai).
    if (sqlstateDe(erro) !== TRAVA_ESGOTADA) throw erro;
    await cliente.query("rollback");
    return { tipo: "conflito", conflito: { ok: false, conflito: true, error: MENSAGEM_DO_CONFLITO } };
  }
  acc.inicioMs += performance.now() - t;

  // Os três últimos resultados (ou dois, sem Canais) são sempre a trava, a leitura e os Canais.
  const dosCanais = canaisNoLote ? resultados.at(-1) : undefined;
  const daLeitura = resultados.at(canaisNoLote ? -2 : -1)!;
  const daTrava = resultados.at(canaisNoLote ? -3 : -2)!;
  // A mesma frase de `hidratar`: o Espaço não existe, e isso não é conflito.
  if (daTrava.rowCount === 0) throw new Error(`Espaço de Trabalho "${workspaceId}" não existe.`);

  // A ida e volta já foi paga acima: `hidratarMs` e `canaisMs` ficam só com o processador.
  let t2 = performance.now();
  const antes = estadoDasLinhas(workspaceId, daLeitura as unknown as Parameters<typeof estadoDasLinhas>[1]);
  acc.hidratarMs += performance.now() - t2;
  // As fakes de teste devolvem `{ state, revisao }` sem `original`: padrão 0.
  acc.linhasLidas += registrosLidos(antes.original);

  t2 = performance.now();
  const canais = dosCanais
    ? canaisProjetadosDasLinhas(dosCanais.rows as LinhaDoBancoDeCanal[], workspaceId)
    : await carregarCanaisProjetados(cliente, workspaceId);
  acc.canaisMs += performance.now() - t2;
  return { tipo: "aberta", antes, canais };
}

/**
 * Uma tentativa de gravação: uma conexão, uma transação. O laço de `executar`
 * a roda uma vez no regime `travado` e até `tentativas` vezes no `otimista`.
 *
 * Cada ida ao banco custa a distância até ele (cerca de 52 ms de Chicago a
 * Oregon, medido em produção), então o que pesa é QUANTAS vezes se vai. O
 * regime `travado` vai duas: o lote de entrada (`abrirTravado`) e o de saída
 * (o `update` da revisão, as escritas e o `commit` numa mensagem só), sempre
 * que não há evento de saída nem `aoConfirmar` — esses precisam de mais
 * instruções depois das escritas e seguem pelo caminho de sempre. O regime
 * `otimista` não mudou: uma instrução por ida, como na Fase 12.
 */
async function umaTentativa<T, L>(
  workspaceId: string,
  operacao: (state: DataState, lido: L) => OperationResult<T>,
  opcoes: OpcoesExecucao<T, L>,
  regime: RegimeDaExecucao,
  acc: Acumulador,
): Promise<Tentativa<T>> {
  let t = performance.now();
  const bruto = await pool().connect();
  acc.conexaoMs += performance.now() - t;
  const cliente = contandoIdasEVoltas(bruto, acc);
  let falhou = false;
  try {
    let antes: EstadoHidratado;
    let canais: Channel[];
    if (regime === "travado") {
      // D-09 — a trava vem ANTES da leitura (ver `abrirTravado`).
      const entrada = await abrirTravado(cliente, workspaceId, acc);
      if (entrada.tipo === "conflito") return entrada;
      ({ antes, canais } = entrada);
    } else {
      t = performance.now();
      await cliente.query(inicioDaTransacao());
      acc.inicioMs += performance.now() - t;

      t = performance.now();
      antes = await hidratar(cliente, workspaceId);
      acc.hidratarMs += performance.now() - t;
      // As fakes de teste devolvem `{ state, revisao }` sem `original`: padrão 0.
      acc.linhasLidas += registrosLidos(antes.original);

      t = performance.now();
      canais = await carregarCanaisProjetados(cliente, workspaceId);
      acc.canaisMs += performance.now() - t;
    }

    // D-11 (Pitfall 4) — os Canais relacionais (`plataforma.canais`) entram em
    // `state.channels` para a operação do modelo antigo enxergá-los; sem isso
    // `startConversation`/`sendMessage` dariam "Canal não encontrado" e
    // desfariam o gesto da tela. É por tentativa: um retry por conflito
    // recarrega. `hidratar()` em si não sabe deles.
    t = performance.now();
    const fotografia = acrescentarCanaisProjetados(antes.state, canais);
    acc.canaisMs += performance.now() - t;
    // Fase 14 (3.2.1) — a leitura do CRM (`lerDoCrm`) vai pelo MESMO cliente, depois da trava,
    // da hidratação e da projeção dos Canais, e antes da operação. Sem a opção,
    // o lido é `undefined` e nada muda para quem já chama `executar()`.
    t = performance.now();
    const lido = opcoes.lerDoCrm ? await opcoes.lerDoCrm(cliente, antes.state) : (undefined as L);
    acc.hidratarMs += performance.now() - t;
    // O contador de `nextId` é de módulo: sem sincronizar com o maior id já
    // presente no estado hidratado, um processo recém-subido geraria
    // `act_000001` de novo e o upsert sobrescreveria um registro real. A
    // operação é síncrona, então reset + execução acontecem no mesmo turno
    // do event loop — duas requisições concorrentes não se misturam (a
    // trava, ou a revisão otimista, cuida do resto).
    syncIdSequence(antes.state);
    // CR-05 — capturado AQUI, dentro da tentativa, para que um retry por
    // conflito de revisão (regime otimista) recomece do zero: o mesmo cuidado
    // que `rotas/operacoes.ts` e `automacoes/scheduler-worker.ts` já
    // documentavam quando a captura ainda morava em cada chamador.
    const idsAntes = new Set(antes.state.automationExecutions.map((e) => e.id));
    t = performance.now();
    const resultado = operacao(antes.state, lido);
    acc.operacaoMs += performance.now() - t;

    if (!resultado.ok) {
      // A recusa é resposta legítima do domínio, não falha: nada foi gravado,
      // mas a transação fecha limpa para não segurar conexão (nem a trava).
      await cliente.query("rollback");
      return {
        tipo: "concluida",
        desfecho: "recusou",
        resultado: { ...resultado, diferenca: DIFERENCA_VAZIA, revisao: antes.revisao, revisaoAnterior: antes.revisao },
      };
    }

    // D-18 — o evento nasce no MESMO `cliente`, ANTES do commit: Tarefa e
    // evento são a mesma transação, sem que a operação de domínio saiba
    // que outbox existe. Nunca chamar `fetch`/HTTP neste bloco — a entrega
    // é responsabilidade exclusiva de `outbox-worker.ts`, fora da UoW.
    //
    // CR-05 — o evento de Canal é derivado AQUI, obrigatoriamente, a
    // partir das Execuções que nasceram NESTA transação (nunca do
    // `diferenca`, D-18) — soma-se ao que a rota fornecer em `opcoes.eventos`,
    // para que nenhuma rota que rode Automação consiga esquecê-lo.
    //
    // Fase 13 — derivados ANTES das escritas: são funções puras do estado, e
    // saber se há evento decide se o fim da transação cabe numa ida só.
    t = performance.now();
    const eventos = [
      ...(opcoes.eventos?.(resultado.value, antes.state) ?? []),
      ...eventosDeNotificacaoPorCanal(antes.state, execucoesNovas(antes.state, idsAntes)),
    ];
    acc.eventosMs += performance.now() - t;
    if (opcoes.semEventosDeSaida && eventos.length > 0) {
      throw new Error("Esta operação não pode gravar evento de saída — plataforma.integration_outbox não pode crescer.");
    }
    // D-11 (Pitfall 3) — as escritas recebem o estado SEM os projetados: copiá-los
    // para `plataforma.registros` criaria uma segunda fonte de verdade do
    // Canal. Se a operação mudou algum, `semCanaisProjetados` lança e a
    // transação é desfeita. `opcoes.eventos`/`aoConfirmar` seguem com
    // `antes.state` (o payload de `automacao.notificar-canal.v1` leva o tipo,
    // não o id do Canal).
    const paraGravar = semCanaisProjetados(antes.state, fotografia);

    if (regime === "travado" && eventos.length === 0 && !opcoes.aoConfirmar) {
      // Fase 13 — o fim da transação numa ida só: a revisão sobe (a linha já é
      // desta transação, desde a trava), as escritas entram e o `commit` vai
      // junto. Se qualquer instrução falha, o servidor descarta o resto da
      // mensagem — o `commit` não roda — e o `catch` abaixo desfaz.
      t = performance.now();
      const plano = planejarGravacao(paraGravar, antes);
      const resultados = await emLote(cliente, [sqlDaRevisaoTravada(literalEntreDolares(workspaceId)), ...sqlsDoPlano(workspaceId, plano), "commit"]);
      acc.gravarMs += performance.now() - t;
      const daRevisao = resultados[0]!;
      // A linha estava travada por esta transação: só pode ter sumido o Espaço.
      if (daRevisao.rowCount === 0) throw new Error(`Espaço de Trabalho "${workspaceId}" não existe.`);
      acc.linhasGravadas += plano.diferenca.gravados.length + plano.diferenca.removidos.length;
      return {
        tipo: "concluida",
        desfecho: "gravou",
        resultado: { ...resultado, diferenca: plano.diferenca, revisao: Number(daRevisao.rows[0]!.revisao), revisaoAnterior: antes.revisao },
      };
    }

    let travada;
    t = performance.now();
    try {
      travada =
        regime === "travado"
          ? await cliente.query<{ revisao: string }>(sqlDaRevisaoTravada("$1"), [workspaceId])
          : await cliente.query<{ revisao: string }>(SQL_REVISAO_OTIMISTA, [workspaceId, antes.revisao]);
    } catch (erro) {
      // 06-13 (H4) — só no otimista: a trava da revisão não saiu dentro do
      // `lock_timeout`, outra escrita está segurando o Espaço. É conflito, como a
      // revisão que mudou: desfaz, e a próxima tentativa (ou quem chamou)
      // começa do zero sobre o estado novo. A conexão está sã — não sai do pool.
      // No travado a linha já é desta transação, então um erro aqui nunca é
      // espera de trava: sobe. Qualquer outro erro sobe como sempre (e a
      // conexão é descartada).
      if (regime === "travado" || sqlstateDe(erro) !== TRAVA_ESGOTADA) throw erro;
      const gasto = performance.now() - t;
      acc.atualizaMs += gasto;
      acc.travaMs += gasto;
      await cliente.query("rollback");
      return { tipo: "conflito", conflito: { ok: false, conflito: true, error: MENSAGEM_DO_CONFLITO } };
    }
    const gastoNoUpdate = performance.now() - t;
    acc.atualizaMs += gastoNoUpdate;
    acc.travaMs += gastoNoUpdate;
    if (travada.rowCount === 0) {
      // Otimista: a revisão mudou — conflito. Travado: a linha estava travada por
      // esta transação, então só pode ter sumido o Espaço; isso não é conflito.
      if (regime === "travado") throw new Error(`Espaço de Trabalho "${workspaceId}" não existe.`);
      await cliente.query("rollback");
      return { tipo: "conflito", conflito: { ok: false, conflito: true, error: MENSAGEM_DO_CONFLITO } };
    }

    t = performance.now();
    const diferenca = await gravar(cliente, workspaceId, paraGravar, antes);
    acc.gravarMs += performance.now() - t;
    // A fake de `gravar` devolve `{}`: padrão 0.
    acc.linhasGravadas += (diferenca.gravados?.length ?? 0) + (diferenca.removidos?.length ?? 0);
    t = performance.now();
    await gravarEventos(cliente, workspaceId, eventos);
    if (opcoes.aoConfirmar) await opcoes.aoConfirmar(cliente, resultado.value, antes.state, lido);
    acc.eventosMs += performance.now() - t;
    t = performance.now();
    await cliente.query("commit");
    acc.commitMs += performance.now() - t;
    // A nova revisão é a que o `update ... returning revisao` devolveu —
    // usar o valor lido em vez de `antes.revisao + 1` evita depender de
    // aritmética paralela com o que o banco de fato gravou.
    return {
      tipo: "concluida",
      desfecho: "gravou",
      resultado: { ...resultado, diferenca, revisao: Number(travada.rows[0]!.revisao), revisaoAnterior: antes.revisao },
    };
  } catch (erro) {
    falhou = true;
    await cliente.query("rollback").catch(() => undefined);
    throw erro;
  } finally {
    // Com falha, a conexão sai do pool (`release(true)` a destrói): a que ficou
    // sem resposta no meio da transação não pode servir à próxima requisição.
    bruto.release(falhou);
  }
}
