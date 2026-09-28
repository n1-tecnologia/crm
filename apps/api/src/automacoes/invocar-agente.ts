/**
 * A ponte HTTP do Agente de lançamento — a ÚNICA peça do monorepo que fala
 * com o `automation/` a respeito de Contas a pagar. Existe porque
 * `packages/dominio` não faz I/O (regra de `./CONTEXT.md`, D3-02): o domínio
 * RECEBE o de-para do lançamento, nunca o busca. Quem lê a fonte de verdade
 * (o plano de contas real do Omie e o RAG de categorias) é a rota do
 * `automation/` (03-07, `POST /v1/integrations/contas-a-pagar/{resolver,lancar}`).
 *
 * **O gatilho é o Status, não o calendário** (plano pós-auditoria,
 * `docs/08-migracao-financeiro/07-plano-de-correcoes-pos-auditoria.md`, 1.4 e
 * 1.5). A cada ciclo, toda conta ativa da Lista configurada que ENTROU em "em
 * lançamento omie" por um movimento na plataforma é lançada: confere o que o
 * Omie exige (`erpMissingFields`, a mesma regra da saída de "para pagar"),
 * chama `/resolver` e `/lancar`, e com o lançamento confirmado publica o
 * Resumo e move a conta para "lançado omie" numa transação só. A A7 (véspera
 * do vencimento) saiu do seed; `rodarAgenda` só garante que uma A7 legada
 * ainda ativa nunca lance (ver lá). Nenhuma chamada ao Omie nasce para conta
 * em "para pagar" — o antigo pré-aquecimento do de-para, que chamava
 * `/resolver` para todas elas a cada ciclo, era custo puro no Omie e na
 * OpenAI.
 *
 * **Ninguém fica repetindo chamadas ao Omie.** A ponte guarda, em memória e
 * por conta, a impressão digital do que decide o lançamento
 * (`impressaoDaConta`: Campos, vencimento, Tags, Status e o Registro da
 * entrada em "em lançamento omie"). Depois de uma recusa comentada — dado
 * faltando, erro permanente do `automation/`, categoria sem confiança,
 * lançamento não confirmado, três falhas transitórias seguidas —, a conta
 * não é mais processada (nenhum `/resolver`, nenhum `/lancar`) até a
 * impressão mudar: alguém corrigir um Campo, ou a conta sair e voltar para
 * "em lançamento omie" (a volta é um Registro novo, logo impressão nova).
 * Quando a conta sai do Status, o estado dela é apagado.
 *
 * **Só lança o que entrou por movimento.** Uma conta que NASCEU em "em
 * lançamento omie" — a importação histórica do ClickUp
 * (`contas-a-pagar:importar`, `nasceNoStatusPedido`) — pode já ter sido
 * lançada no Omie pelo processo antigo, com outro código de integração que a
 * consulta-antes-de-incluir não enxerga: lançá-la seria duplicata. A ponte
 * pede, uma vez, que alguém confira e a mova para "para pagar" e de volta.
 *
 * D3-03 em uma frase, e a sua consequência mecânica: o padrão é ENSAIO — só
 * o literal `lancar` em `AGENTE_CONTAS_A_PAGAR_MODO` liga a caneta, e mesmo
 * ele exige credencial e URL presentes; qualquer outra coisa (ausente,
 * vazio, erro de digitação) cai em ensaio COM AVISO, nunca em silêncio. Em
 * ensaio a ponte só chama `/resolver` — o endereço que 03-07 construiu sem
 * porta de escrita — e só registra em log o que lançaria: nenhum Comentário,
 * nenhum Status, nada gravado na conta. Durante a primeira semana, o erro
 * barato é não lançar; o erro caro é lançar.
 */

import { randomUUID } from "node:crypto";
import type { ActivityRecord, DataState, Id, OperationResult, Task } from "@n1/dominio";
import { ok } from "@n1/dominio";
import { newestFirst, statusDefinition } from "@n1/dominio/derive";
import { runScheduledAutomations } from "@n1/dominio/operations/automations";
import {
  CP,
  INVOCADOR_DO_LANCAMENTO,
  avisadoDoLancamento,
  buildResumoDePagamento,
  erpMissingFields,
  runLancamentoAgent,
  type DeParaDeLancamento,
} from "@n1/dominio/operations/financeiro";
import { addTaskComment, changeTaskStatus } from "@n1/dominio/operations/tasks";
import { pool } from "../persistencia/conexao";
import { resolverMembroAgenteDoPipeline } from "../persistencia/credenciais-de-servico";
import { executar } from "../persistencia/unidade-de-trabalho";
import { hidratar } from "../persistencia/repositorio";
import { sanitizarErro } from "../persistencia/outbox-worker";
import type { RodarAgenda } from "./scheduler-worker";

/* ─────────────────────────── Funções puras ─────────────────────────── */

/**
 * Só o literal exato `"lancar"` liga a caneta. Qualquer outra coisa —
 * ausente, vazio, um erro de digitação — cai em `"ensaio"`, com aviso
 * apenas quando o valor não é um dos dois esperados (ausente ou `"ensaio"`
 * explícito não avisam; são o estado normal da primeira semana). A
 * assimetria é proposital: a lista de valores que ligam a caneta tem UM
 * elemento; a lista dos que a mantêm no bolso é tudo o mais, inclusive o
 * erro de digitação.
 */
export function resolverModo(bruto: string | undefined): { readonly modo: "ensaio" | "lancar"; readonly aviso?: string } {
  if (bruto === "lancar") return { modo: "lancar" };
  if (bruto === undefined || bruto === "ensaio") return { modo: "ensaio" };
  return {
    modo: "ensaio",
    aviso: 'AGENTE_CONTAS_A_PAGAR_MODO tem um valor não reconhecido — caiu em "ensaio" (só o literal "lancar" liga a caneta).',
  };
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
 * fornecedor, consulta antes de incluir e inclui — de 6 a 8 chamadas em
 * série ao Omie, que o `automation/` limita a 4 por segundo: 10 s cortariam um
 * lançamento que estava dando certo, e o corte vira falha transitória.
 */
export const TIMEOUT_RESOLVER_MS = 10_000;
export const TIMEOUT_LANCAR_MS = 60_000;

/** Quantas falhas transitórias seguidas uma conta aguenta antes de a ponte desistir dela e avisar (1.4). */
export const TENTATIVAS_TRANSITORIAS = 3;

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

/**
 * A impressão digital do que decide um lançamento — muda quando alguém
 * corrige um Campo, ou quando a conta sai e volta para "em lançamento omie"
 * (a volta é um Registro "Status alterado" novo); não muda quando o Agente
 * comenta. É a chave do "uma vez só" da ponte.
 */
function impressaoDaConta(state: DataState, task: Task): string {
  return JSON.stringify([task.fieldValues, task.dueDate, task.tagIds, task.statusId, ultimaMudancaDeStatus(state, task)?.id ?? null]);
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
  readonly modo: "ensaio" | "lancar";
  readonly cnpjPorEmpresa?: Readonly<Record<string, string>>;
  readonly fetchImpl?: typeof fetch;
  /** Prazo de `/resolver`, em ms. Padrão `TIMEOUT_RESOLVER_MS` (10 s). */
  readonly timeoutResolverMs?: number;
  /** Prazo de `/lancar`, em ms. Padrão `TIMEOUT_LANCAR_MS` (60 s). */
  readonly timeoutLancarMs?: number;
  /** Intervalo entre ciclos, em ms. Padrão 15 min. */
  readonly intervaloMs?: number;
  readonly registrar?: (nivel: "info" | "warn", mensagem: string, dados?: Record<string, string | number>) => void;
  /**
   * Padrão: hidrata `workspaceId` do Postgres real (`pool()`/`hidratar()`,
   * leitura fora de qualquer transação). Injetável só para o teste: os casos
   * de `servidorFalso` (HTTP local) precisam rodar sem `DATABASE_URL`.
   */
  readonly hidratarEstado?: () => Promise<DataState>;
  /**
   * Quem assina o que o Agente grava (Comentários, Resumo, troca de Status).
   * Padrão: o Membro de serviço do Papel "Agente do pipeline" (D-15; criado
   * por `solicitacoes:configurar`, plano pós-auditoria 2.2). Só é resolvido
   * no modo `lancar` — o ensaio não grava nada.
   */
  readonly resolverAtor?: (workspaceId: Id) => Promise<Id>;
  /**
   * Padrão: `executar()` — uma Unidade de Trabalho no Postgres real.
   * Injetável só para o teste, pela mesma razão de `hidratarEstado`.
   */
  readonly executarOperacao?: (
    operacao: (state: DataState) => OperationResult<unknown>,
  ) => Promise<{ readonly ok: true } | { readonly ok: false; readonly error: string; readonly conflito?: boolean }>;
}

export interface PonteDoAgente {
  readonly rodarAgenda: RodarAgenda;
  /**
   * O gatilho por Status: toda conta que entrou em "em lançamento omie" é
   * lançada no Omie e vai para "lançado omie". Fora de qualquer transação até
   * o fim.
   */
  lancarContasEmLancamento(): Promise<void>;
  /** Roda um ciclo de imediato, depois a cada `intervaloMs`. Chamar duas vezes é no-op. */
  iniciar(): void;
  /** Para o relógio; resolve quando o ciclo em voo (se houver) terminar. */
  parar(): Promise<void>;
}

/** Por que a ponte parou de processar uma conta, até a impressão dela mudar. */
type MotivoDaParada = "recusa" | "transitorias" | "nasceu" | "manual" | "ensaio";

interface EstadoDaConta {
  readonly impressao: string;
  /** Falhas transitórias SEGUIDAS nesta impressão. */
  transitorias: number;
  parada?: MotivoDaParada;
  /** O Comentário que não chegou a ser gravado (conflito, por ex.) — tentado de novo sem chamar o Omie. */
  comentarioPendente?: string;
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
 * (nunca `task.title`/`task.description`) — o mesmo dado, mas fora do
 * padrão textual que o `grep` de T-3-04 varre: aqui é campo do CORPO da
 * requisição que o contrato de 03-07 exige, não um log.
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
  return {
    ...base,
    valorCentavos,
    vencimento,
    formaDePagamento: forma,
    ...(forma === "Chave Pix" ? { chavePix: valorDoCampo(task, CP.fields.chavePix) } : {}),
    ...(forma === "Boleto" ? { codigoDeBarras: valorDoCampo(task, CP.fields.codigoBarras) } : {}),
    ...(forma === "QRCode Pix" ? { pixCopiaECola: valorDoCampo(task, CP.fields.pixCopiaECola) } : {}),
    fornecedor: { tipo: fornecedorTipo, documento, nome: valorDoCampo(task, CP.fields.nomeFornecedor) },
  };
}

/* Os textos que a ponte comenta na conta — os três fixos do plano (1.4) e os de apoio. */

export function textoDaRecusaPermanente(motivo: string | undefined, code: string): string {
  return `Não consegui lançar no Omie: ${motivo ?? "o Financeiro recusou a chamada"} (${code}).`;
}

export function textoDasTransitorias(code: string): string {
  return `O Omie não respondeu depois de ${TENTATIVAS_TRANSITORIAS} tentativas (${code}). Tento de novo quando algum Campo da conta mudar ou ela sair e voltar para "em lançamento omie".`;
}

export const TEXTO_NASCEU_EM_LANCAMENTO =
  'Não lancei esta conta no Omie: ela chegou em "em lançamento omie" pela importação do ClickUp, não por um movimento aqui, e pode já ter sido lançada pelo processo antigo. Confira no Omie; se ainda não estiver lá, mova-a para "para pagar" e de volta para "em lançamento omie" que eu lanço.';

export function criarPonteDoAgente(opcoes: OpcoesDaPonte): PonteDoAgente {
  const fetchImpl = opcoes.fetchImpl ?? fetch;
  const timeoutResolverMs = opcoes.timeoutResolverMs ?? TIMEOUT_RESOLVER_MS;
  const timeoutLancarMs = opcoes.timeoutLancarMs ?? TIMEOUT_LANCAR_MS;
  const intervaloMs = opcoes.intervaloMs ?? 900_000;
  const registrar = opcoes.registrar ?? (() => undefined);
  const { destinoUrl, token, workspaceId, listId, modo, cnpjPorEmpresa } = opcoes;
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
   * idempotência é sempre `chaveDeIdempotencia(taskId)`.
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
    // fornecedor) nem o `details.motivo`, que pode citar o fornecedor.
    // `sanitizarErro` é IMPORTADA de `outbox-worker.ts`, nunca reescrita.
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
    // acontece mais pela agenda. `rehearsal: false` com `tarefasLancadas: []`
    // faz qualquer A7 legada ainda ativa falhar "Lançamento não confirmado"
    // ANTES de invocar o Agente — nunca lança, e o de-para (vazio, origem
    // "omie") nunca é o do protótipo (T-3-39). As outras Automações por data
    // (A5/A6) rodam como sempre, com o CNPJ da Empresa injetado.
    return runScheduledAutomations(state, atorId, listId, diaCivilData, {
      ...(cnpjPorEmpresa ? { cnpjPorEmpresa } : {}),
      lancamento: { rehearsal: false, tarefasLancadas: [], dePara: DE_PARA_VAZIO },
    });
  };

  /** O estado da ponte por conta — só das contas em "em lançamento omie"; as que saem são esquecidas. */
  const estadoPorConta = new Map<Id, EstadoDaConta>();

  async function lancarContasEmLancamento(): Promise<void> {
    // T-3-35 — em modo `lancar`, credencial ou URL ausentes: nenhuma
    // requisição, NUNCA queda silenciosa para ensaio.
    if (modo === "lancar" && (!token || !destinoUrl)) return;
    const state = await hidratarEstado();
    const contas = state.tasks.filter((t) => t.listId === listId && t.lifecycle === "ativo" && t.statusId === CP.status.emLancamento);

    // Saiu de "em lançamento omie" (ou deixou de existir): esquece. Sair e
    // voltar reprocessa — a volta é também impressão nova, então nem um
    // ciclo perdido no meio do vaivém prende a conta.
    const presentes = new Set(contas.map((t) => t.id));
    for (const id of [...estadoPorConta.keys()]) if (!presentes.has(id)) estadoPorConta.delete(id);
    if (contas.length === 0) return;

    let ator: Id | undefined;
    const atorDaEscrita = async (): Promise<Id> => (ator ??= await resolverAtor(workspaceId));

    for (const task of contas) {
      const impressao = impressaoDaConta(state, task);
      let estado = estadoPorConta.get(task.id);
      if (!estado || estado.impressao !== impressao) {
        estado = { impressao, transitorias: 0 };
        estadoPorConta.set(task.id, estado);
      }
      const daConta = { workspaceId, listId, taskId: task.id };

      /** Grava o Comentário do Agente (modo `lancar`); falhando, fica pendente para o próximo ciclo — sem chamar o Omie de novo. */
      const comentar = async (texto: string): Promise<void> => {
        const atorId = await atorDaEscrita();
        const r = await executarOperacao((s) =>
          addTaskComment(s, atorId, task.id, {
            content: texto,
            mentions: [{ type: "member", id: avisadoDoLancamento(s, atorId) }],
            actor: { kind: "agent", id: CP.agentId },
          }),
        );
        if (r.ok) delete estado.comentarioPendente;
        else {
          estado.comentarioPendente = texto;
          registrar("warn", "Não consegui gravar o Comentário do Agente; tento de novo no próximo ciclo.", daConta);
        }
      };

      /**
       * Para de processar a conta até a impressão mudar. Em `lancar`, avisa
       * na própria conta (uma vez, porque a parada impede a repetição); em
       * `ensaio`, só registra — o ensaio não escreve na conta (D3-03).
       */
      const parar = async (motivo: MotivoDaParada, texto: string, log: string): Promise<void> => {
        estado.parada = motivo;
        if (modo === "lancar") await comentar(texto);
        else registrar("info", `Ensaio — não lançaria: ${log}`, daConta);
      };

      if (estado.parada) {
        if (estado.comentarioPendente && modo === "lancar") await comentar(estado.comentarioPendente);
        continue;
      }

      // "Integração manual" = o lançamento no ERP não é do Agente (seção 9).
      // Sem Comentário: a conta é de quem a marcou; só não se chama o Omie.
      if (valorDoCampo(task, CP.fields.integracaoManual) === "Manual") {
        estado.parada = "manual";
        registrar("info", "Conta com Integração manual: o Agente não lança.", daConta);
        continue;
      }

      if (!entrouPorMovimento(state, task)) {
        await parar("nasceu", TEXTO_NASCEU_EM_LANCAMENTO, "a conta nasceu em \"em lançamento omie\" (importação), não entrou por movimento.");
        continue;
      }

      const faltando = erpMissingFields(state, task);
      if (faltando.length > 0) {
        await parar("recusa", `Não consegui lançar no Omie: falta ${faltando.join(", ")}. Preencha e eu tento de novo.`, `faltam ${faltando.length} Campo(s).`);
        continue;
      }

      const corpoResolver = corpoResolverDe(state, task);
      const corpoLancar = corpoResolver ? corpoLancarDe(task, corpoResolver) : undefined;
      if (!corpoResolver || !corpoLancar) {
        await parar("recusa", "Não consegui lançar no Omie: o Valor precisa ser um número maior que zero. Corrija e eu tento de novo.", "Valor inválido.");
        continue;
      }

      /** Falha transitória: conta a seguida; na terceira, desiste da conta até a impressão mudar e avisa. */
      const falhaTransitoria = async (code: string, aviso = textoDasTransitorias(code)): Promise<void> => {
        estado.transitorias += 1;
        if (estado.transitorias >= TENTATIVAS_TRANSITORIAS) {
          await parar("transitorias", aviso, `${TENTATIVAS_TRANSITORIAS} falhas transitórias seguidas (${code}).`);
        }
      };

      const respostaResolver = await chamar("/v1/integrations/contas-a-pagar/resolver", corpoResolver, { timeoutMs: timeoutResolverMs });
      if (!respostaResolver.ok) {
        if (respostaResolver.permanente) {
          await parar("recusa", textoDaRecusaPermanente(respostaResolver.motivo, respostaResolver.code), `recusa permanente (${respostaResolver.code}).`);
        } else await falhaTransitoria(respostaResolver.code);
        continue;
      }
      const dePara = (respostaResolver.corpo as { readonly dePara?: DeParaDeLancamento } | undefined)?.dePara;
      if (!dePara) {
        await parar("recusa", textoDaRecusaPermanente("o Financeiro respondeu sem o de-para da conta", "RESPOSTA_INVALIDA"), "resposta sem de-para (RESPOSTA_INVALIDA).");
        continue;
      }
      const resumo = buildResumoDePagamento(state, task, dePara);

      if (modo !== "lancar") {
        // D3-03 — em ensaio, só `/resolver` e o log do que lançaria. Nada é
        // gravado; a parada evita pedir o mesmo de-para a cada ciclo.
        estado.parada = "ensaio";
        registrar(
          "info",
          resumo.veredito === "resolvida"
            ? `Ensaio — lançaria: ${resumo.conta} · ${resumo.categoria} (${resumo.codigo}).`
            : `Ensaio — não lançaria: categoria sem confiança (${resumo.veredito}).`,
          daConta,
        );
        continue;
      }

      if (resumo.veredito !== "resolvida") {
        // T-3-10 — quem executa recusa: o Agente explica a categoria sem
        // confiança num Comentário ABERTO ao Financeiro (a Execução falha) e a
        // conta fica onde está, sem chamar `/lancar`.
        const atorId = await atorDaEscrita();
        let escreveu = false;
        const r = await executarOperacao((s) => {
          const alvo = s.tasks.find((t) => t.id === task.id);
          const antes = alvo?.comments.length ?? 0;
          runLancamentoAgent(s, atorId, CP.agentId, task.id, INVOCADOR_DO_LANCAMENTO, { dePara, rehearsal: false });
          escreveu = (alvo?.comments.length ?? 0) > antes;
          return ok(undefined);
        });
        if (r.ok && escreveu) estado.parada = "recusa";
        else if (r.ok) {
          // O Agente nem chegou a decidir (inativo, sem alcance, Resumo antigo
          // já publicado…): a conta não fica parada em silêncio.
          await parar(
            "recusa",
            textoDaRecusaPermanente(`a Categoria da conta não passou do corte de confiança do de-para (${resumo.veredito}); confirme a Categoria e eu tento de novo`, "CATEGORIA_EM_REVISAO"),
            `categoria sem confiança (${resumo.veredito}).`,
          );
        } else if (r.conflito) await falhaTransitoria("CONFLITO_DE_REVISAO");
        else {
          // O domínio recusou até escrever a recusa: parar evita pedir o mesmo
          // de-para a cada ciclo; o log diz o porquê.
          estado.parada = "recusa";
          registrar("warn", `Não consegui registrar a recusa por categoria: ${r.error.slice(0, 200)}`, daConta);
        }
        continue;
      }

      const respostaLancar = await chamar("/v1/integrations/contas-a-pagar/lancar", corpoLancar, {
        timeoutMs: timeoutLancarMs,
        idempotencyKey: chaveDeIdempotencia(task.id),
      });
      if (!respostaLancar.ok) {
        if (respostaLancar.permanente) {
          await parar("recusa", textoDaRecusaPermanente(respostaLancar.motivo, respostaLancar.code), `recusa permanente (${respostaLancar.code}).`);
        } else await falhaTransitoria(respostaLancar.code);
        continue;
      }
      const payableId = (respostaLancar.corpo as { readonly payableId?: unknown } | undefined)?.payableId;
      // T-3-37 — `mock-payable-<timestamp>` (credencial Omie vazia) não é
      // lançamento: mover para "lançado omie" seria mentir. `reaproveitado:
      // true` (consulta-antes-de-incluir) É sucesso.
      if (typeof payableId !== "string" || payableId.length === 0 || payableId.startsWith("mock-")) {
        await parar("recusa", "O Omie não confirmou o lançamento desta conta. Nada foi movido.", "lançamento não confirmado (payableId ausente ou mock).");
        continue;
      }

      // Lançado no Omie: o Agente publica o Resumo e a conta vai para "lançado omie", numa transação só.
      const atorId = await atorDaEscrita();
      let saiuAntes = false;
      const r = await executarOperacao((s) => {
        const atual = s.tasks.find((t) => t.id === task.id);
        saiuAntes = !atual || atual.statusId !== CP.status.emLancamento;
        if (saiuAntes) return ok(undefined);
        const publicado = runLancamentoAgent(s, atorId, CP.agentId, task.id, INVOCADOR_DO_LANCAMENTO, { dePara, rehearsal: false });
        if (!publicado.ok) return publicado;
        const movida = changeTaskStatus(s, atorId, task.id, CP.status.lancado);
        return movida.ok ? ok("Lançada no Omie.") : movida;
      });
      if (r.ok && saiuAntes) {
        // Alguém moveu a conta durante o `/lancar`: o título existe no Omie,
        // mas nada foi publicado nem movido aqui. Se ela voltar para "em
        // lançamento omie", a mesma chave devolve o mesmo título
        // (`reaproveitado`) e o Resumo sai — sem lançar de novo.
        estadoPorConta.delete(task.id);
        registrar("warn", 'Lançada no Omie, mas a conta saiu de "em lançamento omie" antes da gravação; nada foi publicado nem movido.', daConta);
        await comentar('O Omie confirmou o lançamento desta conta, mas ela saiu de "em lançamento omie" antes de eu publicar o Resumo. Se ela voltar para "em lançamento omie", eu publico o Resumo sem lançar de novo.');
      } else if (r.ok) {
        estadoPorConta.delete(task.id);
        registrar("info", 'Conta lançada no Omie e movida para "lançado omie".', daConta);
      } else if (r.conflito) {
        // Outra escrita entrou no meio: o próximo ciclo repete com a MESMA
        // chave, e o Omie devolve o mesmo título (`reaproveitado`).
        registrar("warn", "Lançada no Omie, mas a gravação conflitou; tento de novo no próximo ciclo.", daConta);
        await falhaTransitoria(
          "CONFLITO_DE_REVISAO",
          `O Omie confirmou o lançamento desta conta, mas não consegui publicar o Resumo e movê-la para "lançado omie" depois de ${TENTATIVAS_TRANSITORIAS} tentativas (CONFLITO_DE_REVISAO). Confira e mova à mão.`,
        );
      } else {
        registrar("warn", `Lançada no Omie, mas não consegui publicar o Resumo e mover o Status: ${r.error.slice(0, 200)}`, daConta);
        await parar(
          "recusa",
          `O Omie confirmou o lançamento desta conta, mas não consegui publicar o Resumo nem movê-la para "lançado omie": ${r.error} Confira e mova à mão.`,
          "lançada, mas sem Resumo.",
        );
      }
    }
  }

  let temporizador: ReturnType<typeof setInterval> | undefined;
  let emVoo: Promise<void> | undefined;

  function ciclo(): void {
    if (emVoo) return;
    emVoo = lancarContasEmLancamento()
      .catch((erro: unknown) => {
        registrar("warn", "Falha no ciclo do Agente de lançamento.", { workspaceId, listId, summary: erro instanceof Error ? erro.message.slice(0, 200) : "erro" });
      })
      .finally(() => {
        emVoo = undefined;
      });
  }

  return {
    rodarAgenda,
    lancarContasEmLancamento,
    iniciar() {
      if (temporizador) return;
      ciclo();
      temporizador = setInterval(ciclo, intervaloMs);
    },
    async parar() {
      if (temporizador) clearInterval(temporizador);
      temporizador = undefined;
      await emVoo;
    },
  };
}
