/**
 * A ponte HTTP do Agente de lançamento — a ÚNICA peça do monorepo que fala
 * com o `automation/` a respeito de Contas a pagar. Existe porque
 * `packages/dominio` não faz I/O (regra de `./CONTEXT.md`, D3-02): o domínio
 * RECEBE o de-para do lançamento, nunca o busca. Quem lê a fonte de verdade
 * (o plano de contas real do Omie e o RAG de categorias) é a rota do
 * `automation/` (03-07, `POST /v1/integrations/contas-a-pagar/{resolver,lancar}`,
 * contrato v1.1 de 06-02).
 *
 * **Dois momentos (Fase 6, Fluxos 5, 6 e 7).** A cada ciclo — pelo relógio
 * (`intervaloMs`) ou cutucada por uma gravação na conta (`cutucar()`, D6-12)
 * —, a ponte olha as contas ativas da Lista em "para pagar" e "em lançamento
 * omie" (ou só nesta, D6-01) e, para cada uma:
 *
 *   1. Momento 1 — o Resumo para conferência (Fluxo 5): conta completa
 *      (`erpMissingFields` vazio) sem Resumo para os dados atuais ⇒ UM
 *      `/resolver` e UM `publicarResumoParaConferencia` do domínio: o
 *      `📋 RESUMO DE PAGAMENTO` no fio da conta, aberto ao Financeiro, e uma
 *      Conferência pendente.
 *   2. A conferência pelo fio (Fluxo 6): com a Conferência pendente, as
 *      respostas pendentes dos revisores são lidas EM LOTE
 *      (`decisaoDasRespostasPendentes`, 06-12, crm:WR-04) — o primeiro ajuste
 *      vence a aprovação do mesmo lote — e a que decide vira decisão em nome
 *      de quem a escreveu (`decideProcessApproval`, `source: "comment"`,
 *      D6-02); um pedido de ajuste faz o ciclo seguinte chamar `/resolver`
 *      com `pedidoDeRevisao` (e o código `d.dd.dd` que o pedido citar) e
 *      republicar no mesmo fio — só se a conta ainda estiver como o ciclo a
 *      leu (`impressaoEsperada`/`conferenciaRejeitadaId`, crm:WR-12).
 *   3. Momento 2 — o lançamento (Fluxo 7): conta que ENTROU em "em lançamento
 *      omie" por movimento, com a Conferência aprovada para os dados atuais ⇒
 *      `/lancar` com o código conferido e os anexos, e o domínio registra o
 *      título (`registrarLancamentoNoOmie`) ou a falha, que volta a conta
 *      para "para pagar" (`registrarFalhaDoLancamento`, D6-03). **Sem
 *      Conferência aprovada, nenhuma requisição a `/lancar`** — aprovada
 *      para o estado relido imediatamente antes da chamada (06-12, crm:CR-01):
 *      entre a hidratação do ciclo e o `/lancar` cabem vários `/resolver` e
 *      `/lancar`, então a ponte relê o Espaço e pergunta tudo de novo
 *      (`motivoParaNaoLancar`), e o corpo sai do estado relido.
 *
 * **Três modos (D6-11), só por literal exato.** `ensaio` (padrão) só chama
 * `/resolver` e registra em log o que publicaria/lançaria — nada gravado na
 * conta. `conferencia` publica Resumos, lê o fio e revisa, mas NUNCA chama
 * `/lancar`: com a conta conferida em "em lançamento omie", comenta uma vez
 * que o lançamento está desligado neste ambiente. `lancar` faz tudo. Qualquer
 * outro valor cai em `ensaio` com aviso. Nos dois primeiros modos o
 * `/lancar` é inalcançável — o erro barato é não lançar; o erro caro é lançar.
 *
 * **Ninguém fica repetindo chamadas ao Omie.** A ponte guarda, em memória e
 * por conta, uma chave do que decide o próximo passo — a impressão de
 * lançamento do domínio (`impressaoDeLancamento`, D6-10), o Status, o
 * Registro da última mudança de Status e a Conferência vigente com a sua
 * decisão. Depois de uma recusa comentada — dado faltando, erro permanente
 * do `automation/`, lançamento não confirmado, três falhas transitórias
 * seguidas —, a conta não é mais processada até essa chave mudar: alguém
 * corrigir um Campo, mover a conta, ou decidir a Conferência. Conta fora dos
 * dois Status é esquecida.
 *
 * **O legado importado nunca é varrido (G1).** Uma conta importada do ClickUp
 * (`provenance.kind === "import"`) só entra na ponte depois de um movimento
 * de Status feito AQUI, posterior à importação — a mesma regra de
 * `entrouPorMovimento`. Sem isso, o primeiro ciclo em `conferencia` publicaria
 * um Resumo e mencionaria o Financeiro em cada conta importada completa.
 *
 * **Portas de ambiente de teste (G2, G3).** `soTitulosCom` restringe os dois
 * momentos às contas cujo título contém o texto (ex.: "TESTE
 * AUTOMATIZADO"); `avisarId` troca QUEM toda Menção da ponte avisa (o
 * Financeiro, por padrão). Produção deixa as duas vazias.
 *
 * T-3-04 — o que vai ao log é lista fechada: ids, `code`, contagens e a
 * tripla conta · categoria · código. Nunca o texto do Resumo, chave Pix,
 * código de barras, valor, documento ou nome do fornecedor, título, URL
 * assinada, o pedido de revisão ou o `details.motivo`.
 */

import { randomUUID } from "node:crypto";
import type { ActivityRecord, DataState, Id, OperationResult, Task } from "@n1/dominio";
import { ok } from "@n1/dominio";
import { effectiveLifecycleOfTask, newestFirst, statusDefinition } from "@n1/dominio/derive";
import { decideProcessApproval } from "@n1/dominio/operations/ai";
import { runScheduledAutomations } from "@n1/dominio/operations/automations";
import {
  CP,
  TEXTOS_DA_CONFERENCIA,
  avisadoDaConferencia,
  avisadoDoLancamento,
  buildResumoDePagamento,
  conferenciaDoResumo,
  decisaoDasRespostasPendentes,
  erpMissingFields,
  impressaoDeLancamento,
  lancamentoHumanoDe,
  lancamentoSemCodigo,
  movidaDepoisDaImportacao,
  publicarResumoParaConferencia,
  registrarFalhaDoLancamento,
  registrarLancamentoNoOmie,
  type AnexoDoLancamento,
  type ConferenciaDoResumo,
  type DeParaDeLancamento,
} from "@n1/dominio/operations/financeiro";
import { addTaskComment } from "@n1/dominio/operations/tasks";
import { pool } from "../persistencia/conexao";
import { resolverMembroAgenteDoPipeline } from "../persistencia/credenciais-de-servico";
import { executar } from "../persistencia/unidade-de-trabalho";
import { hidratar } from "../persistencia/repositorio";
import { sanitizarErro } from "../persistencia/outbox-worker";
import { anexosDaConta, type AssinarDownload } from "./anexos-da-conta";
import type { RodarAgenda } from "./scheduler-worker";

/* ─────────────────────────── Funções puras ─────────────────────────── */

export type ModoDaPonte = "ensaio" | "conferencia" | "lancar";

/**
 * D6-11 (e D3-03 antes dele) — só os literais exatos `"conferencia"` e
 * `"lancar"` mudam o modo. Qualquer outra coisa — ausente, vazio, maiúscula,
 * acento, espaço, erro de digitação — cai em `"ensaio"`, com aviso apenas
 * quando o valor não é um dos esperados (ausente ou `"ensaio"` explícito não
 * avisam). O aviso nomeia a variável, nunca o seu conteúdo.
 */
export function resolverModo(bruto: string | undefined): { readonly modo: ModoDaPonte; readonly aviso?: string } {
  if (bruto === "lancar") return { modo: "lancar" };
  if (bruto === "conferencia") return { modo: "conferencia" };
  if (bruto === undefined || bruto === "ensaio") return { modo: "ensaio" };
  return {
    modo: "ensaio",
    aviso: 'AGENTE_CONTAS_A_PAGAR_MODO tem um valor não reconhecido — caiu em "ensaio" (só os literais "conferencia" e "lancar" mudam o modo).',
  };
}

/** As três decisões de `06-CONTEXT.md` que o dono troca sem código (D6-01, D6-02, D6-04). */
export interface OpcoesDeDecisao {
  /** D6-01 — de onde o Resumo aparece. */
  readonly resumoAPartirDe: "para-pagar" | "em-lancamento-omie";
  /** D6-02 — uma resposta de aprovação no fio vale como conferência. */
  readonly conferenciaPorComentario: boolean;
  /** D6-04 — o que "Integração manual = Manual" quer dizer para a ponte. */
  readonly integracaoManual: "nao-encosta" | "sem-conferencia";
}

export const DECISOES_PADRAO: OpcoesDeDecisao = {
  resumoAPartirDe: "para-pagar",
  conferenciaPorComentario: true,
  integracaoManual: "nao-encosta",
};

function lerEnum<T extends string>(env: Readonly<Record<string, string | undefined>>, nome: string, aceitos: readonly T[], padrao: T, avisos: string[]): T {
  const bruto = env[nome];
  if (bruto === undefined || bruto === "") return padrao;
  if ((aceitos as readonly string[]).includes(bruto)) return bruto as T;
  avisos.push(`${nome} tem um valor não reconhecido — vale o padrão "${padrao}" (aceitos: ${aceitos.join(", ")}).`);
  return padrao;
}

/**
 * As três variáveis de decisão. Valor desconhecido ⇒ o padrão, com um aviso
 * que nomeia a variável (nunca o valor lido).
 */
export function lerOpcoesDeDecisao(env: Readonly<Record<string, string | undefined>>): OpcoesDeDecisao & { readonly avisos: readonly string[] } {
  const avisos: string[] = [];
  const resumoAPartirDe = lerEnum(env, "AGENTE_CONTAS_A_PAGAR_RESUMO_A_PARTIR_DE", ["para-pagar", "em-lancamento-omie"] as const, DECISOES_PADRAO.resumoAPartirDe, avisos);
  const porComentario = lerEnum(env, "AGENTE_CONTAS_A_PAGAR_CONFERENCIA_POR_COMENTARIO", ["true", "false"] as const, "true", avisos);
  const integracaoManual = lerEnum(env, "AGENTE_CONTAS_A_PAGAR_INTEGRACAO_MANUAL", ["nao-encosta", "sem-conferencia"] as const, DECISOES_PADRAO.integracaoManual, avisos);
  return { resumoAPartirDe, conferenciaPorComentario: porComentario === "true", integracaoManual, avisos };
}

/**
 * G2/G3 — as duas portas de ambiente de teste. Vazias (o padrão de
 * produção), nada muda. Espaços nas pontas são ignorados; `soTitulosCom` é
 * comparado com o título exatamente como está (maiúsculas contam).
 */
export function lerOpcoesDeEscopo(env: Readonly<Record<string, string | undefined>>): { readonly soTitulosCom?: string; readonly avisarId?: Id } {
  const soTitulosCom = env.AGENTE_CONTAS_A_PAGAR_SO_TITULOS_COM?.trim();
  const avisarId = env.AGENTE_CONTAS_A_PAGAR_AVISAR_ID?.trim();
  return { ...(soTitulosCom ? { soTitulosCom } : {}), ...(avisarId ? { avisarId } : {}) };
}

/** O resumo das portas de teste para a linha de partida do log (sem o id do Membro). */
export function descreverEscopo(soTitulosCom: string | undefined): string {
  return soTitulosCom ? `escopo=titulos-com:${JSON.stringify(soTitulosCom)}` : "escopo=todas";
}

/**
 * Fluxo 6 — o código de Categoria que um pedido de ajuste cita ("use 2.02.98
 * por favor"), para o `/resolver` validar no plano de contas real sem
 * perguntar ao RAG de novo. Sem código, `undefined`.
 */
export function codigoNoPedido(texto: string): string | undefined {
  return /(?<![\d.])(\d(?:\.\d{2}){2,3})(?!\.?\d)/.exec(texto)?.[1];
}

/**
 * `tria:contas-a-pagar:<taskId>` — a mesma convenção que 03-07 fixou dos
 * dois lados, e o `codigo_lancamento_integracao` que o Omie usa para
 * deduplicar. `Date.now()`/`randomUUID()` na chave é o defeito do caminho
 * legado (preservado lá de propósito, ver `03-RESEARCH.md`, "Don't
 * Hand-Roll") — proibido aqui: a chave precisa ser a MESMA em toda repetição
 * da mesma Tarefa, nunca uma nova a cada tentativa.
 */
export function chaveDeIdempotencia(taskId: string): string {
  return `tria:contas-a-pagar:${taskId}`;
}

/**
 * Os prazos por chamada (plano pós-auditoria, 1.4). `/resolver` só lê (de-para
 * e plano de contas): 10 s bastam. `/lancar` procura ou cadastra o
 * fornecedor, consulta antes de incluir, inclui e sobe os anexos — várias
 * chamadas em série ao Omie, que o `automation/` limita a 4 por segundo: 10 s
 * cortariam um lançamento que estava dando certo, e o corte vira falha
 * transitória.
 */
export const TIMEOUT_RESOLVER_MS = 10_000;
export const TIMEOUT_LANCAR_MS = 60_000;

/** D6-12 — quanto a ponte espera depois de uma cutucada antes de rodar o ciclo (coalesce as cutucadas desse intervalo). */
export const ATRASO_DA_CUTUCADA_MS = 2_000;

/** Quantas falhas transitórias seguidas uma conta aguenta antes de a ponte desistir dela e avisar (1.4). */
export const TENTATIVAS_TRANSITORIAS = 3;

/** O teto do contrato v1.1 para `pedidoDeRevisao`. */
const TAMANHO_MAXIMO_DO_PEDIDO = 500;

const STATUS_PERMANENTES: readonly number[] = [400, 401, 403, 404, 422];

interface EnvelopeDeErro {
  readonly error?: {
    readonly code?: unknown;
    readonly message?: unknown;
    readonly retryable?: unknown;
    readonly details?: { readonly motivo?: unknown };
  };
}

function erroDoEnvelope(corpo: unknown): EnvelopeDeErro["error"] {
  if (typeof corpo !== "object" || corpo === null) return undefined;
  return (corpo as EnvelopeDeErro).error;
}

function retryableDoEnvelope(corpo: unknown): boolean | undefined {
  const retryable = erroDoEnvelope(corpo)?.retryable;
  return typeof retryable === "boolean" ? retryable : undefined;
}

function codigoDoEnvelope(corpo: unknown): string | undefined {
  const code = erroDoEnvelope(corpo)?.code;
  return typeof code === "string" ? code : undefined;
}

/** O teto do contrato para `details.motivo` — reaplicado aqui porque o texto vai para um Comentário. */
const TAMANHO_MAXIMO_DO_MOTIVO = 300;

/**
 * O motivo legível que o `automation/` põe no envelope dos erros permanentes
 * (`error.details.motivo`, ≤ 300 caracteres; ex.: o `faultstring` do Omie
 * numa recusa `OMIE_RECUSOU`). Sem ele, a `message` fixa do envelope. Linhas
 * e espaços repetidos viram um espaço só; o que passar do teto é cortado.
 *
 * O motivo vai para o Comentário da conta — que só quem já vê a conta lê —,
 * NUNCA para o log (T-3-04): pode trazer nome de fornecedor ou documento.
 */
export function motivoDoEnvelope(corpo: unknown): string | undefined {
  const erro = erroDoEnvelope(corpo);
  for (const candidato of [erro?.details?.motivo, erro?.message]) {
    if (typeof candidato !== "string") continue;
    const limpo = candidato.replace(/\s+/g, " ").trim();
    if (limpo) return limpo.length > TAMANHO_MAXIMO_DO_MOTIVO ? `${limpo.slice(0, TAMANHO_MAXIMO_DO_MOTIVO - 1)}…` : limpo;
  }
  return undefined;
}

/**
 * Permanente cobre `[400,401,403,404,422]` (a lista de `outbox-worker.ts::entregar`),
 * qualquer status com `retryable === false` no envelope de 03-07 (é assim
 * que `503 CONFIGURACAO_AUSENTE` vira permanente) e status DESCONHECIDO — por
 * segurança, como 03-07 fez do outro lado. Transitório cobre erro de
 * rede/`AbortError` (sem `status`), `429`, `5xx` com `retryable === true` ou
 * sem `retryable` declarado.
 */
export function classificar(status: number | undefined, corpo: unknown, erroDeRede: unknown): { readonly permanente: boolean; readonly code: string } {
  if (status === undefined) {
    void erroDeRede; // registrado por quem chama, via `sanitizarErro`; aqui só decide a classificação.
    return { permanente: false, code: codigoDoEnvelope(corpo) ?? "ERRO_DE_REDE" };
  }
  const retryable = retryableDoEnvelope(corpo);
  const code = codigoDoEnvelope(corpo) ?? `HTTP_${status}`;
  if (retryable === true) return { permanente: false, code };
  if (retryable === false) return { permanente: true, code };
  if (status === 429 || (status >= 500 && status < 600)) return { permanente: false, code };
  if (STATUS_PERMANENTES.includes(status)) return { permanente: true, code };
  return { permanente: true, code }; // status desconhecido — por segurança, permanente.
}

const REGEX_CNPJ = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/;

/**
 * JSON `{ "<Empresa>": "<CNPJ formatado>" }` → mapa. Qualquer defeito
 * (JSON inválido, não é objeto, valor não-string, valor fora do formato)
 * derruba o mapa INTEIRO em vez de aceitar metade: meia tabela de CNPJ é
 * pior que nenhuma, porque a metade que falta vira `da Empresa X` (seguro) e
 * a que sobra pode estar errada (perigoso). O aviso nomeia só a variável.
 */
export function lerCnpjPorEmpresa(bruto: string | undefined): { readonly mapa: Readonly<Record<string, string>>; readonly aviso?: string } {
  const AVISO = "AGENTE_CONTAS_A_PAGAR_CNPJ_POR_EMPRESA inválida — nenhum CNPJ será usado (fallback: \"da Empresa <nome>\").";
  if (!bruto) return { mapa: {} };
  let json: unknown;
  try {
    json = JSON.parse(bruto);
  } catch {
    return { mapa: {}, aviso: AVISO };
  }
  if (typeof json !== "object" || json === null || Array.isArray(json)) return { mapa: {}, aviso: AVISO };
  for (const valor of Object.values(json as Record<string, unknown>)) {
    if (typeof valor !== "string" || !REGEX_CNPJ.test(valor)) return { mapa: {}, aviso: AVISO };
  }
  return { mapa: json as Readonly<Record<string, string>> };
}

/**
 * O Registro "Status alterado" mais recente da conta — de onde ela veio para
 * o Status em que está. `newestFirst` desempata instantes iguais pela
 * sequência do id, como a Atividade da tela.
 */
function ultimaMudancaDeStatus(state: DataState, task: Task): ActivityRecord | undefined {
  return newestFirst(state.activity.filter((a) => a.objectType === "task" && a.objectId === task.id && a.action === "Status alterado"))[0];
}

/**
 * G1 — a conta pode entrar na ponte: não é importada, ou o seu último
 * movimento de Status foi feito AQUI, depois da importação. É a mesma régua
 * de `entrouPorMovimento`, aplicada a qualquer Status. A função mora no
 * domínio (`@n1/dominio/operations/financeiro`) porque a tela usa a mesma
 * régua para não prometer um Resumo que a ponte nunca publicará; o
 * reexport mantém o nome onde os testes da ponte o importam.
 */
export { movidaDepoisDaImportacao };

/**
 * A conta ENTROU em "em lançamento omie" por um movimento na plataforma
 * (`changeTaskStatus`, `tasks.ts` — o Registro "Status alterado" com `after`
 * igual ao nome do Status), e não nasceu nele.
 *
 * O cuidado que a regra exige: a importação histórica (`contas-a-pagar:importar`,
 * `importarContaAPagarHistorica`) TAMBÉM escreve Registros "Status alterado"
 * — um por transição do `status_history` do ClickUp, com o instante
 * original —, e a última delas pode ser justamente a entrada em "em
 * lançamento omie". O que as separa de um movimento de verdade é o tempo: a
 * reprodução do histórico é sempre anterior ao instante da importação
 * (`provenance.at`), e um movimento feito aqui é sempre posterior. Um relógio
 * adiantado na máquina que importou só erra para o lado seguro — pedir que a
 * conta seja movida de novo.
 */
export function entrouPorMovimento(state: DataState, task: Task): boolean {
  const nome = statusDefinition(state, task.listId, CP.status.emLancamento)?.name;
  if (!nome || task.statusId !== CP.status.emLancamento) return false;
  const ultima = ultimaMudancaDeStatus(state, task);
  if (!ultima || ultima.after !== nome) return false;
  if (task.provenance?.kind === "import" && Date.parse(ultima.at) <= Date.parse(task.provenance.at)) return false;
  return true;
}

/** O de-para que `rodarAgenda` passa: vazio e de origem Omie — nunca o do protótipo (T-3-39). */
const DE_PARA_VAZIO: DeParaDeLancamento = { contaPorTag: {}, categoriaPorCampo: {}, origem: "omie" };

/* ─────────────────────────── A ponte ─────────────────────────── */

export interface OpcoesDaPonte {
  /** Origem do `automation/`, sem barra final. */
  readonly destinoUrl: string;
  readonly token: string;
  /** O par (Espaço, Lista) do Financeiro — a ponte é ESPECÍFICA por desenho, diferente do agendador (03-08), que é genérico. */
  readonly workspaceId: Id;
  readonly listId: Id;
  readonly modo: ModoDaPonte;
  /** D6-01, D6-02, D6-04 — o que faltar vale o padrão (`DECISOES_PADRAO`). */
  readonly decisoes?: Partial<OpcoesDeDecisao>;
  /** G2 — só as contas cujo título contém este texto (exato, maiúsculas contam). Ausente: todas. */
  readonly soTitulosCom?: string;
  /** G3 — quem toda Menção da ponte avisa, no lugar do Financeiro, quando é Membro ativo. Ausente: a regra de sempre. */
  readonly avisarId?: Id;
  readonly cnpjPorEmpresa?: Readonly<Record<string, string>>;
  readonly fetchImpl?: typeof fetch;
  /** Prazo de `/resolver`, em ms. Padrão `TIMEOUT_RESOLVER_MS` (10 s). */
  readonly timeoutResolverMs?: number;
  /** Prazo de `/lancar`, em ms. Padrão `TIMEOUT_LANCAR_MS` (60 s). */
  readonly timeoutLancarMs?: number;
  /** Intervalo entre ciclos, em ms. Padrão 15 min. */
  readonly intervaloMs?: number;
  /** Espera entre a cutucada e o ciclo, em ms. Padrão `ATRASO_DA_CUTUCADA_MS` (2 s). */
  readonly atrasoDaCutucadaMs?: number;
  readonly registrar?: (nivel: "info" | "warn", mensagem: string, dados?: Record<string, string | number>) => void;
  /**
   * Padrão: hidrata `workspaceId` do Postgres real (`pool()`/`hidratar()`,
   * leitura fora de qualquer transação). Injetável só para o teste: os casos
   * de `servidorFalso` (HTTP local) precisam rodar sem `DATABASE_URL`.
   */
  readonly hidratarEstado?: () => Promise<DataState>;
  /**
   * Quem assina o que o Agente grava (Comentários, Resumo, decisões,
   * lançamento). Padrão: o Membro de serviço do Papel "Agente do pipeline"
   * (D-15; criado por `solicitacoes:configurar`, plano pós-auditoria 2.2).
   * Só é resolvido nos modos que gravam — o ensaio não grava nada.
   */
  readonly resolverAtor?: (workspaceId: Id) => Promise<Id>;
  /**
   * Padrão: `executar()` — uma Unidade de Trabalho no Postgres real.
   * Injetável só para o teste, pela mesma razão de `hidratarEstado`.
   */
  readonly executarOperacao?: (
    operacao: (state: DataState) => OperationResult<unknown>,
  ) => Promise<{ readonly ok: true } | { readonly ok: false; readonly error: string; readonly conflito?: boolean }>;
  /** Padrão: `urlDeDownload` (Storage, 5 min). Injetável só para o teste. */
  readonly assinarAnexo?: AssinarDownload;
}

export interface PonteDoAgente {
  readonly rodarAgenda: RodarAgenda;
  /** Um ciclo dos dois momentos. Fora de qualquer transação até cada gravação. */
  processarContas(): Promise<void>;
  /** O nome de antes da Fase 6 — o mesmo ciclo (`processarContas`). */
  lancarContasEmLancamento(): Promise<void>;
  /**
   * D6-12 — pede um ciclo: roda em `atrasoDaCutucadaMs` (2 s), e N cutucadas
   * nesse intervalo viram UM ciclo; uma cutucada com um ciclo em voo vira
   * exatamente um ciclo a mais, logo depois dele. Nunca lança exceção.
   */
  cutucar(): void;
  /** Roda um ciclo de imediato, depois a cada `intervaloMs`. Chamar duas vezes é no-op. */
  iniciar(): void;
  /** Para o relógio e a cutucada pendente; resolve quando o ciclo em voo (se houver) terminar. */
  parar(): Promise<void>;
}

/** Por que a ponte parou de processar uma conta, até a chave dela mudar. */
type MotivoDaParada = "recusa" | "transitorias" | "nasceu" | "manual" | "ensaio" | "conferencia";

interface EstadoDaConta {
  readonly chave: string;
  /** Falhas transitórias SEGUIDAS com esta chave. */
  transitorias: number;
  parada?: MotivoDaParada;
  /** O Comentário que não chegou a ser gravado (conflito, por ex.) — tentado de novo sem chamar o Omie. */
  comentarioPendente?: string;
  /** A última resposta do fio já lida e deixada de lado (ignorada, ou recusada pelo domínio) — não é relida. */
  respostaLida?: Id;
}

function valorDoCampo(task: Task, definitionId: Id): string {
  const v = task.fieldValues.find((x) => x.definitionId === definitionId && x.state === "ativo")?.value;
  if (v === undefined || v === null) return "";
  return Array.isArray(v) ? v.join(", ") : String(v);
}

/** A Tag `conta *` da Tarefa, se houver — o mesmo critério de `financeiro.ts::buildResumoDePagamento`. */
function tagDaContaDe(state: DataState, task: Task): string | undefined {
  return task.tagIds.map((id) => state.tags.find((t) => t.id === id)?.name ?? "").find((n) => n.startsWith("conta "));
}

/** G2 — a conta está no escopo da ponte. Por desestruturação, como `corpoResolverDe`. */
function dentroDoEscopo(task: Task, soTitulosCom: string | undefined): boolean {
  if (!soTitulosCom) return true;
  const { title: titulo } = task;
  return titulo.includes(soTitulosCom);
}

/** Por que a ponte não chama o `/lancar` agora (06-12, crm:CR-01) — só o código vai ao log. */
export type CodigoDeAdiamento =
  | "CONTA_SUMIU"
  | "INATIVA"
  | "SAIU_DE_EM_LANCAMENTO"
  | "NAO_ENTROU_POR_MOVIMENTO"
  | "FORA_DO_ESCOPO"
  | "MANUAL"
  | "LANCAMENTO_HUMANO"
  | "SEM_CONFERENCIA_APROVADA"
  | "CONFERENCIA_TROCADA";

/**
 * crm:CR-01 (06-12) — a mesma lista de condições do laço de
 * `processarContas`, perguntada de novo sobre o estado de AGORA: entre a
 * hidratação do ciclo e o `/lancar` cabem vários `/resolver` (10 s) e
 * `/lancar` (60 s) de outras contas, e lançar com o que se leu minutos antes
 * é gastar dinheiro com dado velho. A primeira pergunta que falha decide o
 * código; `undefined` quer dizer "pode lançar".
 *
 * `conferidaId` é a Conferência que o ciclo leu: a vigente de agora tem de
 * ser ELA, e `conferida` (o que já quer dizer "aprovada para a impressão
 * atual"). Manual só conta sob `nao-encosta` — em `sem-conferencia` a conta
 * Manual É lançada (D6-04). Pura.
 */
export function motivoParaNaoLancar(
  fresco: DataState,
  taskId: Id,
  conferidaId: Id,
  criterio: { readonly listId: Id; readonly soTitulosCom?: string; readonly integracaoManual: OpcoesDeDecisao["integracaoManual"] },
): CodigoDeAdiamento | undefined {
  const atual = fresco.tasks.find((t) => t.id === taskId && t.listId === criterio.listId);
  if (!atual) return "CONTA_SUMIU";
  if (effectiveLifecycleOfTask(fresco, atual.id) !== "ativo") return "INATIVA";
  if (atual.statusId !== CP.status.emLancamento) return "SAIU_DE_EM_LANCAMENTO";
  if (!entrouPorMovimento(fresco, atual)) return "NAO_ENTROU_POR_MOVIMENTO";
  if (!dentroDoEscopo(atual, criterio.soTitulosCom)) return "FORA_DO_ESCOPO";
  if (criterio.integracaoManual === "nao-encosta" && valorDoCampo(atual, CP.fields.integracaoManual) === "Manual") return "MANUAL";
  if (lancamentoHumanoDe(fresco, atual) !== undefined) return "LANCAMENTO_HUMANO";
  const { estado, conferencia } = conferenciaDoResumo(fresco, atual);
  if (estado !== "conferida" || !conferencia) return "SEM_CONFERENCIA_APROVADA";
  if (conferencia.id !== conferidaId) return "CONFERENCIA_TROCADA";
  return undefined;
}

interface CorpoResolver {
  readonly taskId: string;
  readonly centroDeCusto: string;
  readonly categoriaDePagamento: string;
  readonly titulo: string;
  readonly descricao?: string;
  readonly tagDaConta?: string;
}

/**
 * `undefined` quando falta Centro de Custo (D3-01) — nenhuma requisição
 * nasce sem ele. `titulo`/`descricao` saem de `task` por desestruturação
 * — o mesmo dado, mas fora do padrão textual que o `grep` de T-3-04 varre:
 * aqui é campo do CORPO da requisição que o contrato de 03-07 exige, não um
 * log.
 */
function corpoResolverDe(state: DataState, task: Task): CorpoResolver | undefined {
  const centroDeCusto = valorDoCampo(task, CP.fields.centroDeCusto);
  if (!centroDeCusto) return undefined;
  const { title: titulo, description: descricao } = task;
  const tag = tagDaContaDe(state, task);
  return {
    taskId: task.id,
    centroDeCusto,
    categoriaDePagamento: valorDoCampo(task, CP.fields.categoria),
    titulo,
    ...(descricao ? { descricao } : {}),
    ...(tag ? { tagDaConta: tag } : {}),
  };
}

/**
 * O corpo de `/lancar` — o de `/resolver` mais o que só o lançamento
 * precisa. `undefined` quando o Valor não é um número maior que zero ou falta
 * vencimento. O tipo do fornecedor vem do Campo, sem padrão inventado:
 * `erpMissingFields` já exige que ele esteja preenchido.
 */
function corpoLancarDe(task: Task, base: CorpoResolver): Record<string, unknown> | undefined {
  const valorCentavos = Math.round(Number(valorDoCampo(task, CP.fields.valor)) * 100);
  const vencimento = task.dueDate?.value.slice(0, 10);
  if (!vencimento || !Number.isFinite(valorCentavos) || valorCentavos <= 0) return undefined;
  const forma = valorDoCampo(task, CP.fields.forma);
  const fornecedorTipo = valorDoCampo(task, CP.fields.fornecedor);
  const documento = fornecedorTipo === "CPF" ? valorDoCampo(task, CP.fields.cpf) : valorDoCampo(task, CP.fields.cnpj);
  const dataDeEmissao = valorDoCampo(task, CP.fields.dataEmissao).slice(0, 10);
  return {
    ...base,
    valorCentavos,
    vencimento,
    // v1.1 — a Data de Emissão vai ao Omie (e está na impressão de lançamento, D6-10).
    ...(/^\d{4}-\d{2}-\d{2}$/.test(dataDeEmissao) ? { dataDeEmissao } : {}),
    formaDePagamento: forma,
    ...(forma === "Chave Pix" ? { chavePix: valorDoCampo(task, CP.fields.chavePix) } : {}),
    ...(forma === "Boleto" ? { codigoDeBarras: valorDoCampo(task, CP.fields.codigoBarras) } : {}),
    ...(forma === "QRCode Pix" ? { pixCopiaECola: valorDoCampo(task, CP.fields.pixCopiaECola) } : {}),
    fornecedor: { tipo: fornecedorTipo, documento, nome: valorDoCampo(task, CP.fields.nomeFornecedor) },
  };
}

/** Uma URL no texto de erro de um anexo vira `[url]` — o Comentário nunca carrega um link assinado. */
function semUrl(texto: string): string {
  return texto.replace(/https?:\/\/\S+/g, "[url]").slice(0, 200);
}

/**
 * Os anexos da resposta do `/lancar` como o domínio os conta
 * (`TEXTOS_DA_CONFERENCIA.lancado`): nome (o devolvido, senão o enviado na
 * mesma posição), ok e erro. A `url` da resposta é descartada aqui mesmo.
 */
function anexosDaResposta(corpo: unknown, enviados: ReadonlyArray<{ readonly nome: string }>): AnexoDoLancamento[] {
  const lista = (corpo as { readonly anexos?: unknown } | undefined)?.anexos;
  if (!Array.isArray(lista)) return [];
  return lista.map((item: unknown, i) => {
    const a = (typeof item === "object" && item !== null ? item : {}) as { readonly nome?: unknown; readonly ok?: unknown; readonly erro?: unknown };
    const nome = typeof a.nome === "string" && a.nome ? a.nome : (enviados[i]?.nome ?? `anexo ${i + 1}`);
    return { nome, ok: a.ok === true, ...(typeof a.erro === "string" && a.erro ? { erro: semUrl(a.erro) } : {}) };
  });
}

/* Os textos que a ponte comenta na conta — os fixos do plano (1.4) e os de apoio. */

export function textoDaRecusaPermanente(motivo: string | undefined, code: string): string {
  return `Não consegui lançar no Omie: ${motivo ?? "o Financeiro recusou a chamada"} (${code}).`;
}

/** Momento 1 — o `/resolver` recusou: não há Resumo a publicar. */
export function textoDaRecusaDoResumo(motivo: string | undefined, code: string): string {
  return `Não consegui preparar o Resumo desta conta: ${motivo ?? "o Financeiro recusou a chamada"} (${code}). Tento de novo quando algum Campo mudar.`;
}

export function textoDasTransitorias(code: string): string {
  return `O Omie não respondeu depois de ${TENTATIVAS_TRANSITORIAS} tentativas (${code}). Tento de novo quando algum Campo da conta mudar ou ela sair e voltar para "em lançamento omie".`;
}

export const TEXTO_NASCEU_EM_LANCAMENTO =
  'Não lancei esta conta no Omie: ela chegou em "em lançamento omie" pela importação do ClickUp, não por um movimento aqui, e pode já ter sido lançada pelo processo antigo. Confira no Omie; se ainda não estiver lá, mova-a para "para pagar" e de volta para "em lançamento omie" que eu lanço.';

/**
 * Só alcançável por uma Conferência aprovada ANTES de 06-11 — hoje o domínio
 * recusa aprovar um Resumo sem código (`recusaSemCodigo`). Ali a Conferência
 * já está decidida, e "peça ajuste" também seria beco: o texto aponta a saída
 * real — alterar a Categoria muda a impressão, a Conferência fica
 * `desatualizada` e sai um Resumo novo, onde o ajuste está aberto.
 */
export const TEXTO_SEM_CODIGO_CONFERIDO =
  "Não consegui lançar no Omie: o Resumo conferido não tem um código de Categoria do Omie, e esta conferência não pode mais ser ajustada. Altere a Categoria da conta para eu publicar um Resumo novo; se ele também vier sem código, peça ajuste nele citando o código (ex.: 2.02.98).";

/**
 * A conta saiu de "em lançamento omie" durante o `/lancar`. Não promete
 * registrar "sem lançar de novo": desde 06-08 o `automation/` compara o
 * título existente com o pedido (`TITULO_EXISTENTE_DIVERGENTE`), então o
 * título só é reaproveitado se tiver os dados da Conferência vigente.
 */
export const TEXTO_SAIU_ANTES_DO_REGISTRO =
  'O Omie confirmou o lançamento desta conta, mas ela saiu de "em lançamento omie" antes de eu registrá-lo: nada foi registrado aqui, e o título continua no Omie. Confira o título no Omie. Se a conta voltar para "em lançamento omie", eu só registro este título se ele tiver os dados da Conferência vigente; se não tiver, aviso e não lanço de novo.';

/** O título existe no Omie, mas o domínio recusou o registro (06-12): o aviso cita o título, para ninguém lançar à mão em dobro. */
export function textoDoRegistroRecusado(payableId: string, erro: string): string {
  return `O Omie confirmou o lançamento desta conta (título ${payableId}), mas não consegui registrá-lo nem movê-la para "lançado omie": ${erro} Confira e mova à mão.`;
}

/** O título existe no Omie, mas o registro conflitou em todas as tentativas (06-12). */
export function textoDoRegistroEmConflito(payableId: string): string {
  return `O Omie confirmou o lançamento desta conta (título ${payableId}), mas não consegui registrá-lo e movê-la para "lançado omie" depois de ${TENTATIVAS_TRANSITORIAS} tentativas (CONFLITO_DE_REVISAO). Confira e mova à mão.`;
}

/** D6-04 `sem-conferencia` — o motivo gravado na decisão (e no Registro "Aprovação decidida"). */
export const MOTIVO_DA_DISPENSA = "Conferência dispensada (Integração manual)";

const CAMINHO_RESOLVER = "/v1/integrations/contas-a-pagar/resolver";
const CAMINHO_LANCAR = "/v1/integrations/contas-a-pagar/lancar";

export function criarPonteDoAgente(opcoes: OpcoesDaPonte): PonteDoAgente {
  const fetchImpl = opcoes.fetchImpl ?? fetch;
  const timeoutResolverMs = opcoes.timeoutResolverMs ?? TIMEOUT_RESOLVER_MS;
  const timeoutLancarMs = opcoes.timeoutLancarMs ?? TIMEOUT_LANCAR_MS;
  const intervaloMs = opcoes.intervaloMs ?? 900_000;
  const atrasoDaCutucadaMs = opcoes.atrasoDaCutucadaMs ?? ATRASO_DA_CUTUCADA_MS;
  const registrar = opcoes.registrar ?? (() => undefined);
  const { destinoUrl, token, workspaceId, listId, modo, cnpjPorEmpresa, soTitulosCom } = opcoes;
  const decisoes: OpcoesDeDecisao = { ...DECISOES_PADRAO, ...opcoes.decisoes };
  /** Os modos que gravam na conta. O ensaio nunca grava (D3-03). */
  const escreve = modo !== "ensaio";
  const hidratarEstado =
    opcoes.hidratarEstado ??
    (async () => {
      const cliente = await pool().connect();
      try {
        // Leitura, não Unidade de Trabalho: nada é gravado e nenhuma revisão
        // é reivindicada — precedente: `../bootstrap/solicitacoes.ts` (dry-run).
        return (await hidratar(cliente, workspaceId)).state;
      } finally {
        cliente.release();
      }
    });
  const executarOperacao =
    opcoes.executarOperacao ??
    (async (operacao: (state: DataState) => OperationResult<unknown>) => {
      const r = await executar(workspaceId, operacao);
      if ("conflito" in r) return { ok: false as const, error: r.error, conflito: true };
      return r.ok ? { ok: true as const } : { ok: false as const, error: r.error };
    });
  const resolverAtor = opcoes.resolverAtor ?? (async (ws: Id) => (await resolverMembroAgenteDoPipeline(ws)).id);

  /**
   * `POST` no molde literal de `outbox-worker.ts::entregar`: mesmos
   * cabeçalhos, `AbortSignal.timeout` com o prazo DA CHAMADA (1.4).
   * `idempotencyKey` só existe em `/lancar` (`/resolver` não muta nada).
   * `randomUUID()` aqui é `x-request-id` — CORRELAÇÃO, nunca idempotência; a
   * idempotência é sempre `chaveDeIdempotencia(taskId)`. O corpo (com as URLs
   * assinadas dos anexos e o pedido de revisão) NUNCA é registrado: a defesa
   * é não coletar — `sanitizarErro` ainda redige URL com query string.
   */
  async function chamar(
    caminho: string,
    corpo: unknown,
    prazo: { readonly timeoutMs: number; readonly idempotencyKey?: string },
  ): Promise<
    | { readonly ok: true; readonly corpo: unknown }
    | { readonly ok: false; readonly permanente: boolean; readonly code: string; readonly motivo?: string | undefined }
  > {
    let resposta: Response | undefined;
    let erroDeRede: unknown;
    try {
      resposta = await fetchImpl(`${destinoUrl}${caminho}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
          ...(prazo.idempotencyKey ? { "idempotency-key": prazo.idempotencyKey } : {}),
          "x-request-id": randomUUID(),
        },
        body: JSON.stringify(corpo),
        signal: AbortSignal.timeout(prazo.timeoutMs),
      });
    } catch (erro) {
      erroDeRede = erro;
    }
    let corpoResposta: unknown;
    if (resposta) {
      try {
        corpoResposta = await resposta.json();
      } catch {
        corpoResposta = undefined;
      }
    }
    if (resposta?.ok) return { ok: true, corpo: corpoResposta };
    const classificacao = classificar(resposta?.status, corpoResposta, erroDeRede);
    // T-3-04 — lista fechada: workspaceId/listId/code/summary. NUNCA o corpo
    // da requisição/resposta (chave Pix, código de barras, valor, título,
    // fornecedor, URLs dos anexos, pedido de revisão) nem o `details.motivo`,
    // que pode citar o fornecedor. `sanitizarErro` é IMPORTADA de
    // `outbox-worker.ts`, nunca reescrita.
    const erro = sanitizarErro(erroDeRede ?? new Error(`HTTP ${resposta?.status ?? "sem resposta"} de ${destinoUrl}${caminho}`), classificacao.code);
    registrar("warn", "Falha ao chamar o Agente de lançamento.", { workspaceId, listId, code: erro.code, summary: erro.summary });
    return {
      ok: false,
      permanente: classificacao.permanente,
      code: classificacao.code,
      ...(classificacao.permanente ? { motivo: motivoDoEnvelope(corpoResposta) } : {}),
    };
  }

  const rodarAgenda: RodarAgenda = (state, atorId, listIdRecebido, diaCivilData) => {
    // A ponte só age sobre o par configurado — qualquer outra Lista (mesmo
    // Espaço ou outro) segue o padrão do agendador. A ponte não pode quebrar
    // a agenda das outras Listas.
    if (state.workspace.id !== workspaceId || listIdRecebido !== listId) {
      return runScheduledAutomations(state, atorId, listIdRecebido, diaCivilData);
    }
    // Plano pós-auditoria, 1.4/1.5 — sem cache e sem rede: o lançamento não
    // acontece pela agenda. `rehearsal: false` com `tarefasLancadas: []`
    // faz qualquer A7 legada ainda ativa falhar "Lançamento não confirmado"
    // ANTES de invocar o Agente — nunca lança, e o de-para (vazio, origem
    // "omie") nunca é o do protótipo (T-3-39). As outras Automações por data
    // (A5/A6) rodam como sempre, com o CNPJ da Empresa injetado.
    return runScheduledAutomations(state, atorId, listId, diaCivilData, {
      ...(cnpjPorEmpresa ? { cnpjPorEmpresa } : {}),
      lancamento: { rehearsal: false, tarefasLancadas: [], dePara: DE_PARA_VAZIO },
    });
  };

  /** O estado da ponte por conta — só das contas nos Status que ela olha; as que saem são esquecidas. */
  const estadoPorConta = new Map<Id, EstadoDaConta>();
  /** G1 — a última contagem registrada de contas importadas fora da ponte (o log só sai quando ela muda). */
  let ultimaContagemDeImportadas = 0;
  /** G3 — o aviso de `avisarId` inválido sai uma vez só por processo. */
  let avisouAvisarInvalido = false;

  /** G3 — `avisarId` quando é Membro ativo AGORA; senão, a regra de sempre (e um aviso, uma vez). */
  function avisarDoCiclo(state: DataState): Id | undefined {
    const pedido = opcoes.avisarId;
    if (!pedido) return undefined;
    if (state.members.some((m) => m.id === pedido && m.state === "ativo")) return pedido;
    if (!avisouAvisarInvalido) {
      avisouAvisarInvalido = true;
      registrar("warn", "AGENTE_CONTAS_A_PAGAR_AVISAR_ID não é um Membro ativo do Espaço — as Menções da ponte seguem a regra de sempre (o Financeiro).", { workspaceId, listId });
    }
    return undefined;
  }

  async function processarContas(): Promise<void> {
    // T-3-35 — num modo que grava, credencial ou URL ausentes: nenhuma
    // requisição, NUNCA queda silenciosa para ensaio.
    if (escreve && (!token || !destinoUrl)) return;
    const state = await hidratarEstado();
    const statusOlhados: readonly Id[] =
      decisoes.resumoAPartirDe === "para-pagar" ? [CP.status.paraPagar, CP.status.emLancamento] : [CP.status.emLancamento];
    const contas = state.tasks.filter(
      (t) => t.listId === listId && t.lifecycle === "ativo" && statusOlhados.includes(t.statusId) && dentroDoEscopo(t, soTitulosCom),
    );

    // Saiu dos Status olhados (ou do escopo, ou deixou de existir): esquece.
    // Sair e voltar reprocessa — a volta é também chave nova, então nem um
    // ciclo perdido no meio do vaivém prende a conta.
    const presentes = new Set(contas.map((t) => t.id));
    for (const id of [...estadoPorConta.keys()]) if (!presentes.has(id)) estadoPorConta.delete(id);

    const avisar = avisarDoCiclo(state);
    let ator: Id | undefined;
    const atorDaEscrita = async (): Promise<Id> => (ator ??= await resolverAtor(workspaceId));
    let importadasForaDaPonte = 0;

    for (const task of contas) {
      const emLancamento = task.statusId === CP.status.emLancamento;
      // G1 — o legado importado nunca é varrido. Só a exceção de sempre: em
      // `lancar`, a conta importada que está em "em lançamento omie" recebe,
      // uma vez, o pedido de conferir no Omie (`TEXTO_NASCEU_EM_LANCAMENTO`).
      const importadaParada = !movidaDepoisDaImportacao(state, task);
      if (importadaParada && !(modo === "lancar" && emLancamento)) {
        importadasForaDaPonte += 1;
        estadoPorConta.delete(task.id);
        continue;
      }

      const conf = conferenciaDoResumo(state, task);
      const chave = JSON.stringify([
        impressaoDeLancamento(state, task),
        task.statusId,
        ultimaMudancaDeStatus(state, task)?.id ?? null,
        conf.conferencia?.id ?? null,
        conf.conferencia?.decision ?? null,
      ]);
      let estado = estadoPorConta.get(task.id);
      if (!estado || estado.chave !== chave) {
        estado = { chave, transitorias: 0 };
        estadoPorConta.set(task.id, estado);
      }
      const daConta = { workspaceId, listId, taskId: task.id };
      const deste = estado;

      /** Grava o Comentário do Agente (modos que gravam); falhando, fica pendente para o próximo ciclo — sem chamar o Omie de novo. */
      const comentar = async (texto: string, parentCommentId?: Id): Promise<void> => {
        const atorId = await atorDaEscrita();
        const r = await executarOperacao((s) =>
          addTaskComment(s, atorId, task.id, {
            content: texto,
            mentions: [{ type: "member", id: avisar ?? avisadoDoLancamento(s, atorId) }],
            actor: { kind: "agent", id: CP.agentId },
            ...(parentCommentId ? { parentCommentId } : {}),
          }),
        );
        if (r.ok) delete deste.comentarioPendente;
        else {
          deste.comentarioPendente = texto;
          registrar("warn", "Não consegui gravar o Comentário do Agente; tento de novo no próximo ciclo.", daConta);
        }
      };

      /**
       * Para de processar a conta até a chave mudar. Nos modos que gravam,
       * avisa na própria conta (uma vez, porque a parada impede a
       * repetição); em `ensaio`, só registra — o ensaio não escreve (D3-03).
       */
      const parar = async (motivo: MotivoDaParada, texto: string, log: string, momento: "publicaria" | "lançaria"): Promise<void> => {
        deste.parada = motivo;
        if (escreve) await comentar(texto);
        else registrar("info", `Ensaio — não ${momento}: ${log}`, daConta);
      };

      /** Falha transitória: conta a seguida; na terceira, desiste da conta até a chave mudar e avisa. */
      const falhaTransitoria = async (code: string, momento: "publicaria" | "lançaria", aviso = textoDasTransitorias(code)): Promise<void> => {
        deste.transitorias += 1;
        if (deste.transitorias >= TENTATIVAS_TRANSITORIAS) {
          await parar("transitorias", aviso, `${TENTATIVAS_TRANSITORIAS} falhas transitórias seguidas (${code}).`, momento);
        }
      };

      if (estado.parada) {
        if (estado.comentarioPendente && escreve) await comentar(estado.comentarioPendente);
        continue;
      }

      if (importadaParada) {
        // Só chega aqui em `lancar`, com a conta em "em lançamento omie".
        await parar("nasceu", TEXTO_NASCEU_EM_LANCAMENTO, 'a conta nasceu em "em lançamento omie" (importação), não entrou por movimento.', "lançaria");
        continue;
      }

      // D6-04 — "Integração manual" = Manual. Padrão: o Agente não encosta
      // (sem Resumo, sem `/lancar`, sem Comentário). `sem-conferencia`: segue,
      // e a Conferência é dispensada em nome do Membro de serviço.
      const manual = valorDoCampo(task, CP.fields.integracaoManual) === "Manual";
      if (manual && decisoes.integracaoManual === "nao-encosta") {
        estado.parada = "manual";
        registrar("info", "Conta com Integração manual: o Agente não encosta.", daConta);
        continue;
      }

      const faltando = erpMissingFields(state, task);
      if (faltando.length > 0) {
        // Em "para pagar" a conta está sendo preenchida: silêncio. Em "em
        // lançamento omie", o pedido de sempre, uma vez.
        if (emLancamento) {
          await parar("recusa", `Não consegui lançar no Omie: falta ${faltando.join(", ")}. Preencha e eu tento de novo.`, `faltam ${faltando.length} Campo(s).`, "lançaria");
        }
        continue;
      }

      if (conf.estado === "pendente" && conf.conferencia) {
        if (!escreve) continue; // o ensaio não decide nada
        // D6-04 com um Resumo sem código: o domínio recusaria a dispensa
        // (crm:WR-03), então o Financeiro pede ajuste pelo fio, como numa
        // conta qualquer; o Resumo revisado com código é dispensado.
        if (manual && !lancamentoSemCodigo(conf.conferencia.origin.lancamento)) await dispensar(conf.conferencia);
        else await lerRespostas(conf.conferencia);
        continue;
      }

      if (conf.estado === "sem-resumo" || conf.estado === "desatualizada" || conf.estado === "ajuste-pedido") {
        await momentoDoResumo();
        continue;
      }

      // `conferida`: em "para pagar", espera o humano mover.
      if (!conf.conferencia || !emLancamento) continue;
      const conferencia = conf.conferencia;
      const { conta, categoria, codigo } = conferencia.origin.lancamento;

      if (!entrouPorMovimento(state, task)) {
        if (modo === "lancar") {
          await parar("nasceu", TEXTO_NASCEU_EM_LANCAMENTO, 'a conta está em "em lançamento omie" sem ter entrado por movimento.', "lançaria");
        } else {
          estado.parada = "nasceu";
          registrar("info", `${modo === "ensaio" ? "Ensaio" : "Conferência"} — não lançaria: a conta não entrou em "em lançamento omie" por movimento.`, daConta);
        }
        continue;
      }

      if (modo === "ensaio") {
        estado.parada = "ensaio";
        registrar("info", `Ensaio — lançaria: ${conta} · ${categoria} (${codigo}).`, daConta);
        continue;
      }
      if (modo === "conferencia") {
        // D6-11 — ZERO `/lancar`: diz no fio, uma vez por chave, que nada foi lançado.
        estado.parada = "conferencia";
        registrar("info", `Conferência — lançaria: ${conta} · ${categoria} (${codigo}).`, daConta);
        await comentar(TEXTOS_DA_CONFERENCIA.modoConferencia, conferencia.origin.threadCommentId);
        continue;
      }
      await momentoDoLancamento(conferencia);

      /* ─── os passos, como funções da conta (fecham sobre `task`, `estado`, `conf`) ─── */

      /**
       * Fluxo 6 (D6-02, crm:WR-04) — TODAS as respostas pendentes do fio, em
       * lote (`decisaoDasRespostasPendentes`): o primeiro ajuste vence a
       * aprovação do mesmo lote, e a resposta que decide vira decisão em nome
       * de quem a escreveu. Nada é relido enquanto não chega resposta nova.
       */
      async function lerRespostas(pendente: ConferenciaDoResumo): Promise<void> {
        const lote = decisaoDasRespostasPendentes(state, task, { aprovacaoPorComentario: decisoes.conferenciaPorComentario });
        const { ultimaLida } = lote;
        if (!ultimaLida || ultimaLida === deste.respostaLida) return;
        // Com `CONFERENCIA_POR_COMENTARIO=false`, só o clique confere; o fio
        // continua pedindo ajuste (D6-02).
        if (lote.sentido === "nenhum") {
          deste.respostaLida = ultimaLida;
          return;
        }
        const { resposta, sentido } = lote;
        const autor = resposta.author.id;
        const pedido = resposta.content.trim();
        const r = await executarOperacao((s) =>
          decideProcessApproval(s, autor, pendente.id, sentido === "aprovacao" ? "aprovada" : "rejeitada", {
            source: "comment",
            ...(sentido === "ajuste" ? { reason: pedido } : {}),
          }),
        );
        if (r.ok) {
          registrar("info", sentido === "aprovacao" ? "Resumo conferido por resposta no fio." : "Ajuste do Resumo pedido por resposta no fio.", daConta);
        } else if (!("conflito" in r && r.conflito)) {
          deste.respostaLida = ultimaLida;
          // T-3-04: o código, nunca `r.error` (pode citar a conta).
          registrar("warn", "A resposta no fio não virou decisão.", { ...daConta, code: "RESPOSTA_RECUSADA_PELO_DOMINIO" });
          // Quem disse "ok" a um Resumo sem código fica sabendo por quê (crm:WR-03).
          if (r.error === TEXTOS_DA_CONFERENCIA.recusaSemCodigo) await comentar(TEXTOS_DA_CONFERENCIA.recusaSemCodigo, pendente.origin.threadCommentId);
        }
      }

      /** D6-04 `sem-conferencia` — a Conferência pendente de uma conta Manual é dispensada pelo Membro de serviço. */
      async function dispensar(pendente: ConferenciaDoResumo): Promise<void> {
        const atorId = await atorDaEscrita();
        const r = await executarOperacao((s) => decideProcessApproval(s, atorId, pendente.id, "aprovada", { source: "click", reason: MOTIVO_DA_DISPENSA }));
        if (!r.ok && !("conflito" in r && r.conflito)) {
          deste.parada = "recusa";
          registrar("warn", `Não consegui dispensar a Conferência: ${r.error.slice(0, 200)}`, daConta);
        }
      }

      /** Momento 1 (Fluxo 5, e a revisão do Fluxo 6) — UM `/resolver` e UM Resumo publicado. */
      async function momentoDoResumo(): Promise<void> {
        const base = corpoResolverDe(state, task);
        if (!base) {
          await parar("recusa", "Não consegui preparar o Resumo desta conta: falta Centro de Custo.", "falta Centro de Custo.", "publicaria");
          return;
        }
        const pedido = conf.estado === "ajuste-pedido" ? conf.conferencia?.decisionReason?.trim() || undefined : undefined;
        const codigoConfirmado = pedido ? codigoNoPedido(pedido) : undefined;
        const corpo = {
          ...base,
          ...(pedido ? { pedidoDeRevisao: pedido.slice(0, TAMANHO_MAXIMO_DO_PEDIDO) } : {}),
          ...(codigoConfirmado ? { codigoCategoriaConfirmado: codigoConfirmado } : {}),
        };
        const resposta = await chamar(CAMINHO_RESOLVER, corpo, { timeoutMs: timeoutResolverMs });
        if (!resposta.ok) {
          if (resposta.permanente) {
            await parar("recusa", textoDaRecusaDoResumo(resposta.motivo, resposta.code), `recusa permanente (${resposta.code}).`, "publicaria");
          } else await falhaTransitoria(resposta.code, "publicaria");
          return;
        }
        const dePara = (resposta.corpo as { readonly dePara?: DeParaDeLancamento } | undefined)?.dePara;
        if (!dePara) {
          await parar("recusa", textoDaRecusaDoResumo("o Financeiro respondeu sem o de-para da conta", "RESPOSTA_INVALIDA"), "resposta sem de-para (RESPOSTA_INVALIDA).", "publicaria");
          return;
        }
        if (!escreve) {
          // D3-03 — em ensaio, só `/resolver` e o log do que publicaria. A
          // parada evita pedir o mesmo de-para a cada ciclo.
          const previa = buildResumoDePagamento(state, task, dePara);
          deste.parada = "ensaio";
          registrar("info", `Ensaio — publicaria: ${previa.conta} · ${previa.categoria} (${previa.codigo}) — ${previa.veredito}.`, daConta);
          return;
        }
        const atorId = await atorDaEscrita();
        // crm:WR-12 — o de-para foi resolvido para a conta como o ciclo a
        // leu. Se ela mudou até a gravação (ou, num ajuste, outro publicador
        // já respondeu à Conferência rejeitada), nada é publicado: o ciclo
        // seguinte refaz o `/resolver` sobre o estado novo. As guardas do
        // domínio (`impressaoEsperada`, `conferenciaRejeitadaId`) são a defesa.
        let adiado = false;
        let dispensou = false;
        const r = await executarOperacao((s) => {
          const fresca = s.tasks.find((t) => t.id === task.id);
          const agora = fresca ? conferenciaDoResumo(s, fresca) : undefined;
          adiado =
            !fresca ||
            !agora ||
            agora.impressaoAtual !== conf.impressaoAtual ||
            (conf.estado === "ajuste-pedido" && (agora.conferencia?.id !== conf.conferencia?.id || agora.conferencia?.decision !== "rejeitada"));
          if (adiado || !fresca) return ok(undefined);
          // crm:WR-03 — um Resumo sem código de Categoria não se aprova (o
          // domínio recusa), então também não se dispensa (D6-04): sai como
          // Conferência normal, e a resposta no fio diz como seguir.
          const previa = buildResumoDePagamento(s, fresca, dePara);
          const semCodigo = lancamentoSemCodigo({ codigo: previa.codigo, veredito: previa.veredito });
          const dispensa = manual && !semCodigo;
          const publicado = publicarResumoParaConferencia(s, atorId, task.id, {
            dePara,
            impressaoEsperada: conf.impressaoAtual,
            ...(conf.estado === "ajuste-pedido" && conf.conferencia ? { conferenciaRejeitadaId: conf.conferencia.id } : {}),
            ...(pedido ? { pedidoDeRevisao: pedido } : {}),
            ...(conf.estado === "desatualizada" ? { motivo: "dados-mudaram" as const } : {}),
            // Na dispensa (D6-04), o aprovador é o próprio Membro de serviço —
            // é ele quem decide logo abaixo, e nenhuma pessoa é chamada a conferir.
            ...(dispensa ? { avisarId: atorId } : avisar ? { avisarId: avisar } : {}),
          });
          if (!publicado.ok) return publicado;
          if (semCodigo) {
            const resposta = addTaskComment(s, atorId, task.id, {
              content: TEXTOS_DA_CONFERENCIA.recusaSemCodigo,
              mentions: [{ type: "member", id: avisadoDaConferencia(s, atorId, avisar) }],
              actor: { kind: "agent", id: CP.agentId },
              parentCommentId: publicado.value.conferencia.origin.threadCommentId,
            });
            if (!resposta.ok) return resposta;
          }
          if (!dispensa) return publicado;
          dispensou = true;
          return decideProcessApproval(s, atorId, publicado.value.conferencia.id, "aprovada", { source: "click", reason: MOTIVO_DA_DISPENSA });
        });
        if (r.ok && adiado) {
          estadoPorConta.delete(task.id);
          registrar("info", "Resumo adiado: a conta mudou depois da leitura do ciclo.", { ...daConta, code: "RESUMO_ADIADO" });
        } else if (r.ok) {
          registrar("info", dispensou ? "Resumo publicado com a Conferência dispensada (Integração manual)." : "Resumo publicado para conferência.", daConta);
        } else if ("conflito" in r && r.conflito) {
          await falhaTransitoria("CONFLITO_DE_REVISAO", "publicaria");
        } else {
          deste.parada = "recusa";
          registrar("warn", `Não consegui publicar o Resumo: ${r.error.slice(0, 200)}`, daConta);
        }
      }

      /**
       * Momento 2 (Fluxo 7) — só com Conferência aprovada para os dados
       * atuais, só no modo `lancar`. crm:CR-01 (06-12): as guardas
       * persistentes saem do snapshot, sem releitura; depois a ponte RELÊ o
       * Espaço e pergunta tudo de novo (`motivoParaNaoLancar`) imediatamente
       * antes do `/lancar`, e o corpo sai do estado relido.
       */
      async function momentoDoLancamento(conferida: ConferenciaDoResumo): Promise<void> {
        const criterio = { listId, ...(soTitulosCom ? { soTitulosCom } : {}), integracaoManual: decisoes.integracaoManual };
        // (1) Sobre o snapshot: o que não muda sozinho (na prática, o
        // lançamento humano — o resto o laço já filtrou). Sem Comentário.
        const doSnapshot = motivoParaNaoLancar(state, task.id, conferida.id, criterio);
        if (doSnapshot) {
          deste.parada = "recusa";
          registrar("info", "Lançamento não sai: a conta não está pronta.", { ...daConta, code: doSnapshot });
          return;
        }
        // `ausente` (a Categoria não casou no de-para) traz o código de
        // preenchimento do Resumo (`9.99.99`), não um código do Omie: conferir
        // esse Resumo não confirma Categoria nenhuma. A régua é a do domínio.
        if (lancamentoSemCodigo(conferida.origin.lancamento)) {
          await parar("recusa", TEXTO_SEM_CODIGO_CONFERIDO, "Resumo conferido sem código de Categoria válido.", "lançaria");
          return;
        }

        // (2) A releitura. Falhar ⇒ nenhuma requisição, e uma falha
        // transitória com código fixo (nunca a mensagem da exceção).
        let fresco: DataState;
        try {
          fresco = await hidratarEstado();
        } catch {
          registrar("warn", "Não consegui reler a conta antes do lançamento.", { ...daConta, code: "RELEITURA_FALHOU" });
          await falhaTransitoria("RELEITURA_FALHOU", "lançaria");
          return;
        }

        // (3) As mesmas perguntas, sobre o estado de agora. Qualquer diferença
        // ⇒ ZERO `/lancar`: a conta é esquecida e reavaliada no ciclo seguinte.
        const adiamento = motivoParaNaoLancar(fresco, task.id, conferida.id, criterio);
        const atual = fresco.tasks.find((t) => t.id === task.id);
        const confAtual = atual ? conferenciaDoResumo(fresco, atual).conferencia : undefined;
        if (adiamento || !atual || !confAtual) {
          estadoPorConta.delete(task.id);
          registrar("info", "Lançamento adiado: a conta mudou depois da leitura do ciclo.", { ...daConta, code: adiamento ?? "CONTA_SUMIU" });
          return;
        }

        // (4) Daqui em diante, tudo sai do estado relido.
        const base = corpoResolverDe(fresco, atual);
        const corpoLancar = base ? corpoLancarDe(atual, base) : undefined;
        if (!corpoLancar) {
          await parar("recusa", "Não consegui lançar no Omie: o Valor precisa ser um número maior que zero. Corrija e eu tento de novo.", "Valor inválido.", "lançaria");
          return;
        }
        const codigoAtual = confAtual.origin.lancamento.codigo;
        // As URLs valem 5 min: geradas agora, logo antes do `/lancar`. Só a contagem vai ao log.
        const { anexos, avisos } = await anexosDaConta(fresco, atual, opcoes.assinarAnexo);
        if (avisos.length > 0) registrar("warn", "Anexos da conta que não vão ao Omie.", { ...daConta, anexos: anexos.length, avisos: avisos.length });
        const corpo = { ...corpoLancar, codigoCategoriaConfirmado: codigoAtual, ...(anexos.length > 0 ? { anexos } : {}) };
        // (5)
        const resposta = await chamar(CAMINHO_LANCAR, corpo, { timeoutMs: timeoutLancarMs, idempotencyKey: chaveDeIdempotencia(task.id) });
        if (!resposta.ok) {
          if (resposta.permanente) await falhaPermanente(resposta.motivo, resposta.code);
          else await falhaTransitoria(resposta.code, "lançaria");
          return;
        }
        const devolvido = resposta.corpo as { readonly payableId?: unknown; readonly reaproveitado?: unknown } | undefined;
        const payableId = devolvido?.payableId;
        // T-3-37 — `mock-payable-<timestamp>` (credencial Omie vazia) não é
        // lançamento: registrar seria mentir. `reaproveitado: true`
        // (consulta-antes-de-incluir) É sucesso.
        if (typeof payableId !== "string" || payableId.length === 0 || payableId.startsWith("mock-")) {
          await parar("recusa", "O Omie não confirmou o lançamento desta conta. Nada foi movido.", "lançamento não confirmado (payableId ausente ou mock).", "lançaria");
          return;
        }
        const resultado = { payableId, reaproveitado: devolvido?.reaproveitado === true, anexos: anexosDaResposta(resposta.corpo, anexos) };
        const atorId = await atorDaEscrita();
        let saiuAntes = false;
        const r = await executarOperacao((s) => {
          const naHora = s.tasks.find((t) => t.id === task.id);
          saiuAntes = !naHora || naHora.statusId !== CP.status.emLancamento;
          if (saiuAntes) return ok(undefined);
          return registrarLancamentoNoOmie(s, atorId, task.id, resultado);
        });
        if (r.ok && saiuAntes) {
          // Alguém moveu a conta durante o `/lancar`: o título existe no
          // Omie, mas nada foi registrado aqui. Se ela voltar para "em
          // lançamento omie", a mesma chave só reaproveita o título se ele
          // tiver os dados do pedido (06-08, `TITULO_EXISTENTE_DIVERGENTE`).
          estadoPorConta.delete(task.id);
          registrar("warn", 'Lançada no Omie, mas a conta saiu de "em lançamento omie" antes do registro; nada foi gravado.', { ...daConta, payableId });
          await comentar(TEXTO_SAIU_ANTES_DO_REGISTRO);
        } else if (r.ok) {
          estadoPorConta.delete(task.id);
          registrar("info", 'Conta lançada no Omie e movida para "lançado omie".', { ...daConta, anexos: resultado.anexos.length });
        } else if ("conflito" in r && r.conflito) {
          // Outra escrita entrou no meio: o próximo ciclo repete com a MESMA
          // chave, e o Omie devolve o mesmo título (`reaproveitado`).
          registrar("warn", "Lançada no Omie, mas a gravação conflitou; tento de novo no próximo ciclo.", { ...daConta, payableId, code: "CONFLITO_DE_REVISAO" });
          await falhaTransitoria("CONFLITO_DE_REVISAO", "lançaria", textoDoRegistroEmConflito(payableId));
        } else {
          // T-3-04: o log leva o id do título e o código, nunca `r.error`.
          registrar("warn", "Lançada no Omie, mas não consegui registrar o lançamento.", { ...daConta, payableId, code: "REGISTRO_RECUSADO_PELO_DOMINIO" });
          await parar("recusa", textoDoRegistroRecusado(payableId, r.error), "lançada, mas sem registro.", "lançaria");
        }
      }

      /** D6-03 — falha permanente do `/lancar`: o domínio comenta o motivo e volta a conta para "para pagar". */
      async function falhaPermanente(motivo: string | undefined, code: string): Promise<void> {
        deste.parada = "recusa";
        const atorId = await atorDaEscrita();
        const r = await executarOperacao((s) =>
          registrarFalhaDoLancamento(s, atorId, task.id, { motivo: motivo ?? "o Financeiro recusou a chamada", code }, avisar ? { avisarId: avisar } : {}),
        );
        if (r.ok) registrar("info", 'Lançamento recusado; a conta voltou para "para pagar".', { ...daConta, code });
        else {
          registrar("warn", "Não consegui registrar a falha do lançamento; aviso por Comentário.", { ...daConta, code });
          await comentar(textoDaRecusaPermanente(motivo, code));
        }
      }
    }

    if (importadasForaDaPonte !== ultimaContagemDeImportadas) {
      ultimaContagemDeImportadas = importadasForaDaPonte;
      registrar("info", "Contas importadas sem movimento depois da importação ficam fora da ponte.", { workspaceId, listId, contas: importadasForaDaPonte });
    }
  }

  let temporizador: ReturnType<typeof setInterval> | undefined;
  let emVoo: Promise<void> | undefined;
  let cutucada: ReturnType<typeof setTimeout> | undefined;
  let repetir = false;
  let parado = false;

  function ciclo(): void {
    if (parado || emVoo) return;
    emVoo = processarContas()
      .catch((erro: unknown) => {
        registrar("warn", "Falha no ciclo do Agente de lançamento.", { workspaceId, listId, summary: erro instanceof Error ? erro.message.slice(0, 200) : "erro" });
      })
      .finally(() => {
        emVoo = undefined;
        if (repetir && !parado) {
          repetir = false;
          ciclo();
        }
      });
  }

  function cutucar(): void {
    if (parado) return;
    if (emVoo) {
      repetir = true;
      return;
    }
    if (cutucada) return;
    cutucada = setTimeout(() => {
      cutucada = undefined;
      if (emVoo) repetir = true; // o relógio começou um ciclo durante a espera
      else ciclo();
    }, atrasoDaCutucadaMs);
  }

  return {
    rodarAgenda,
    processarContas,
    lancarContasEmLancamento: processarContas,
    cutucar,
    iniciar() {
      if (temporizador) return;
      parado = false;
      ciclo();
      temporizador = setInterval(ciclo, intervaloMs);
    },
    async parar() {
      parado = true;
      if (temporizador) clearInterval(temporizador);
      temporizador = undefined;
      if (cutucada) clearTimeout(cutucada);
      cutucada = undefined;
      repetir = false;
      while (emVoo) await emVoo;
    },
  };
}
