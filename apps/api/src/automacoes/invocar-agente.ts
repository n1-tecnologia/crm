/**
 * A ponte HTTP do Agente de lançamento — a ÚNICA peça do monorepo que fala
 * com o `automation/` a respeito de Contas a pagar. Existe porque
 * `packages/dominio` não faz I/O (regra de `./CONTEXT.md`, D3-02): o domínio
 * RECEBE o de-para do lançamento, nunca o busca. Quem lê a fonte de verdade
 * (o plano de contas real do Omie e o RAG de categorias) é a rota nova do
 * `automation/` (03-07, `POST /v1/integrations/contas-a-pagar/{resolver,lancar}`);
 * este arquivo chama essa rota e injeta o resultado no motor de Automações
 * (`@n1/dominio/operations/automations`, `OpcoesDaAgenda`) pela costura que
 * 03-08 expôs — a opção `rodarAgenda` de `criarSchedulerWorker`.
 *
 * Por que a resolução é um MAPA e não uma pergunta por Tarefa: `RodarAgenda`
 * é síncrona — é a mesma assinatura de `runScheduledAutomations`, uma função
 * pura chamada dentro da transação de `executar()`. No instante em que o
 * domínio precisa do de-para já não há mais oportunidade de `await`. Por
 * isso todo `fetch` acontece ANTES, num pré-passo (`aquecer()`) que hidrata o
 * Espaço só para LER (nunca dentro de uma Unidade de Trabalho — precedente:
 * `../bootstrap/solicitacoes.ts`, o dry-run que hidrata e dá `rollback`) e
 * monta o de-para de todas as candidatas de uma vez.
 *
 * Por que a ponte tem relógio próprio, mais curto que o do agendador
 * (`intervaloMs` padrão 15 min contra 1h): o agendador recebe `rodarAgenda`
 * UMA VEZ, na construção, e só descobre `(workspaceId, listId, diaCivil)` ao
 * reivindicar a linha do dia — tarde demais para um `await`. A ponte aquece
 * um cache por conta própria, com relógio mais rápido, para o cache estar
 * quente quando o agendador bater. Cache frio para o par configurado é
 * recusa (`fail`), nunca um lançamento com o de-para do protótipo — o
 * agendador fecha a linha `falhou`/`RECUSA_DO_DOMINIO` e a reivindica de
 * novo na volta seguinte, já quente (03-08 já implementa isso; este arquivo
 * não altera).
 *
 * D3-03 em uma frase, e a sua consequência mecânica: o padrão é ENSAIO — só
 * o literal `lancar` em `AGENTE_CONTAS_A_PAGAR_MODO` liga a caneta, e mesmo
 * ele exige credencial e URL presentes; qualquer outra coisa (ausente,
 * vazio, erro de digitação) cai em ensaio COM AVISO, nunca em silêncio. Em
 * ensaio a ponte só chama `/resolver` — o endereço que 03-07 construiu sem
 * porta de escrita, então rehearsar e escrever por acidente é impossível por
 * construção, não por disciplina. Durante a primeira semana de D3-03, o
 * erro barato é não lançar; o erro caro é lançar.
 */

import { randomUUID } from "node:crypto";
import type { DataState, Id, OperationResult, Task } from "@n1/dominio";
import { fail, ok } from "@n1/dominio";
import { runScheduledAutomations, type OpcoesDaAgenda } from "@n1/dominio/operations/automations";
import {
  CP,
  buildResumoDePagamento,
  erpMissingFields,
  runLancamentoAgent,
  type DeParaDeLancamento,
  type ResolucaoDeCategoria,
} from "@n1/dominio/operations/financeiro";
import { addTaskComment, changeTaskStatus } from "@n1/dominio/operations/tasks";
import { pool } from "../persistencia/conexao";
import { resolverMembroAgenteDoPipeline } from "../persistencia/credenciais-de-servico";
import { executar } from "../persistencia/unidade-de-trabalho";
import { hidratar } from "../persistencia/repositorio";
import { sanitizarErro } from "../persistencia/outbox-worker";
import { type Relogio, relogioDoSistema } from "../testes/relogio";
import { diasCiveisPendentes, type RodarAgenda } from "./scheduler-worker";

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

const STATUS_PERMANENTES: readonly number[] = [400, 401, 403, 404, 422];

function retryableDoEnvelope(corpo: unknown): boolean | undefined {
  if (typeof corpo !== "object" || corpo === null) return undefined;
  const envelope = corpo as { readonly error?: { readonly retryable?: unknown } };
  return typeof envelope.error?.retryable === "boolean" ? envelope.error.retryable : undefined;
}

function codigoDoEnvelope(corpo: unknown): string | undefined {
  if (typeof corpo !== "object" || corpo === null) return undefined;
  const envelope = corpo as { readonly error?: { readonly code?: unknown } };
  return typeof envelope.error?.code === "string" ? envelope.error.code : undefined;
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
 * Mescla o de-para de várias candidatas resolvidas na mesma rodada de
 * aquecimento. `categoriaPorCampo`: a mesma chave em vereditos diferentes
 * resolve para o mais conservador (`"revisar"` vence `"resolvida"`) — o
 * contrário faria a classificação fraca de uma Tarefa "sumir" atrás da forte
 * de outra. `contaPorTag`: a mesma Tag com contas DIVERGENTES é ERRO, não
 * escolha — o de-para deixou de ser função, e escolher um vencedor seria o
 * default silencioso que T-3-07 proíbe. `origem` do resultado é sempre
 * `"omie"`: a ponte nunca emite `"prototipo"`.
 */
export function mesclarDePara(partes: readonly DeParaDeLancamento[]): { readonly dePara: DeParaDeLancamento } | { readonly erro: string } {
  const contaPorTag: Record<string, string> = {};
  for (const parte of partes) {
    for (const [tag, conta] of Object.entries(parte.contaPorTag)) {
      const existente = contaPorTag[tag];
      if (existente !== undefined && existente !== conta) return { erro: `Conta divergente para a Tag "${tag}".` };
      contaPorTag[tag] = conta;
    }
  }
  const categoriaPorCampo: Record<string, ResolucaoDeCategoria> = {};
  for (const parte of partes) {
    for (const [campo, resolucao] of Object.entries(parte.categoriaPorCampo)) {
      const existente = categoriaPorCampo[campo];
      if (!existente || (existente.veredito === "resolvida" && resolucao.veredito === "revisar")) {
        categoriaPorCampo[campo] = resolucao;
      }
    }
  }
  return { dePara: { contaPorTag, categoriaPorCampo, origem: "omie" } };
}

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
  readonly relogio?: Relogio;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
  /** Intervalo entre aquecimentos, em ms. Padrão 15 min — mais curto que o do agendador, de propósito. */
  readonly intervaloMs?: number;
  readonly registrar?: (nivel: "info" | "warn", mensagem: string, dados?: Record<string, string | number>) => void;
  /**
   * Padrão: hidrata `workspaceId` do Postgres real (`pool()`/`hidratar()`,
   * leitura fora de qualquer transação). Injetável só para o teste: os casos
   * de `servidorFalso` (HTTP local) precisam rodar sem `DATABASE_URL`, e essa
   * é a única porta de I/O de `aquecer()` que não é `fetch`.
   */
  readonly hidratarEstado?: () => Promise<DataState>;
  /**
   * Quem assina o que o Agente grava ao lançar (Resumo e troca de Status).
   * Padrão: o Membro do Papel "Agente do pipeline" (D-15).
   */
  readonly resolverAtor?: (workspaceId: Id) => Promise<Id>;
  /**
   * Padrão: `executar()` — uma Unidade de Trabalho no Postgres real.
   * Injetável só para o teste, pela mesma razão de `hidratarEstado`.
   */
  readonly executarOperacao?: (
    operacao: (state: DataState) => OperationResult<unknown>,
  ) => Promise<{ readonly ok: true } | { readonly ok: false; readonly error: string }>;
}

export interface PonteDoAgente {
  readonly rodarAgenda: RodarAgenda;
  /** O pré-passo: resolve o de-para de todas as candidatas de hoje, fora de qualquer transação. */
  aquecer(): Promise<void>;
  /**
   * O gatilho por Status: toda conta em "em lançamento omie" é lançada no
   * Omie e vai para "lançado omie". Fora de qualquer transação até o fim.
   */
  lancarContasEmLancamento(): Promise<void>;
  /** Chama `aquecer()` uma vez de imediato, depois a cada `intervaloMs`. Chamar duas vezes é no-op. */
  iniciar(): void;
  parar(): void;
}

type EntradaDeCache =
  | { readonly estado: "pronta"; readonly dePara: DeParaDeLancamento; readonly tarefasLancadas: readonly Id[] }
  | { readonly estado: "recusada"; readonly code: string };

/** O inverso de `dataCivil` (`./scheduler-worker.ts`) — não exportado de lá, então mirrado aqui: pequeno e puro. */
function formatarDiaCivil(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

/** O corpo de `/lancar` — o de `/resolver` mais o que só o lançamento precisa. `undefined` quando falta valor ou vencimento. */
function corpoLancarDe(task: Task, base: CorpoResolver): Record<string, unknown> | undefined {
  const valorCentavos = Math.round(Number(valorDoCampo(task, CP.fields.valor)) * 100);
  const vencimento = task.dueDate?.value.slice(0, 10);
  if (!vencimento || !Number.isFinite(valorCentavos)) return undefined;
  const forma = valorDoCampo(task, CP.fields.forma);
  const fornecedorTipo = valorDoCampo(task, CP.fields.fornecedor) || "CNPJ";
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

/**
 * A seleção de candidatas é DELIBERADAMENTE mais larga que a do domínio
 * (que também confere `dueDateOffsetDays`, `integracaoManual` e `valor` —
 * ver `automations.ts::runScheduledAutomations`): toda Tarefa ativa da Lista
 * configurada em "para pagar". Resolver o de-para de uma Tarefa a mais custa
 * uma requisição a `/resolver`; resolver de menos custa um lançamento com
 * de-para ausente — a `AgentExecution` recusaria por `veredito: "ausente"`,
 * mas só depois de o dia já ter sido processado. Errar para o lado largo é
 * a única direção seguRA aqui.
 */
function candidatas(state: DataState, listId: Id): readonly Task[] {
  return state.tasks.filter((t) => t.listId === listId && t.lifecycle === "ativo" && t.statusId === CP.status.paraPagar);
}

/**
 * O que o Omie exige além das regras de saída de "para pagar": a rota
 * `/lancar` do `automation/` recusa (HTTP 400) sem Categoria e sem os dados
 * do fornecedor. Conferir aqui transforma o 400 opaco num pedido legível.
 */
export function faltantesParaOmie(state: DataState, task: Task): string[] {
  const nome = (id: Id) => state.fieldDefinitions.find((d) => d.id === id)?.name ?? id;
  const faltando = erpMissingFields(state, task);
  const exigir = (id: Id) => {
    if (!valorDoCampo(task, id) && !faltando.includes(nome(id))) faltando.push(nome(id));
  };
  exigir(CP.fields.categoria);
  const tipo = valorDoCampo(task, CP.fields.fornecedor) || "CNPJ";
  exigir(tipo === "CPF" ? CP.fields.cpf : CP.fields.cnpj);
  exigir(CP.fields.nomeFornecedor);
  return faltando;
}

/** A impressão digital do que decide um lançamento — muda quando alguém corrige um Campo, não quando o Agente comenta. */
function impressaoDaConta(task: Task): string {
  return JSON.stringify([task.fieldValues, task.dueDate, task.tagIds, task.statusId]);
}

export function criarPonteDoAgente(opcoes: OpcoesDaPonte): PonteDoAgente {
  const relogio = opcoes.relogio ?? relogioDoSistema;
  const fetchImpl = opcoes.fetchImpl ?? fetch;
  const timeoutMs = opcoes.timeoutMs ?? 10_000;
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

  // Uma entrada por dia civil — `aquecer()` descarta o resto a cada rodada.
  const cache = new Map<string, EntradaDeCache>();

  /**
   * `POST` no molde literal de `outbox-worker.ts::entregar`: mesmos
   * cabeçalhos, mesmo `AbortSignal.timeout`. `idempotencyKey` só existe em
   * `/lancar` (`/resolver` não muta nada). `randomUUID()` aqui é
   * `x-request-id` — CORRELAÇÃO, nunca idempotência; a idempotência é
   * sempre `chaveDeIdempotencia(taskId)`.
   */
  async function chamar(
    caminho: string,
    corpo: unknown,
    idempotencyKey?: string,
  ): Promise<{ readonly ok: true; readonly corpo: unknown } | { readonly ok: false; readonly permanente: boolean; readonly code: string }> {
    let resposta: Response | undefined;
    let erroDeRede: unknown;
    try {
      resposta = await fetchImpl(`${destinoUrl}${caminho}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
          ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
          "x-request-id": randomUUID(),
        },
        body: JSON.stringify(corpo),
        signal: AbortSignal.timeout(timeoutMs),
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
    // fornecedor). `sanitizarErro` é IMPORTADA de `outbox-worker.ts`, nunca
    // reescrita — e como ela não redige nome de fornecedor (achado de
    // 03-08), a defesa complementar é não coletar, não redigir.
    const erro = sanitizarErro(erroDeRede ?? new Error(`HTTP ${resposta?.status ?? "sem resposta"} de ${destinoUrl}${caminho}`), classificacao.code);
    registrar("warn", "Falha ao chamar o Agente de lançamento.", { workspaceId, listId, code: erro.code, summary: erro.summary });
    return { ok: false, permanente: classificacao.permanente, code: classificacao.code };
  }

  async function aquecer(): Promise<void> {
    const hojeCivil = diasCiveisPendentes(undefined, relogio.agora(), 1)[0]!;
    const chave = `${workspaceId}|${listId}|${hojeCivil}`;
    // Dias anteriores somem — o cache não cresce sem fim.
    for (const k of cache.keys()) if (k !== chave) cache.delete(k);

    // T-3-35 — em modo `lancar`, credencial ou URL ausentes é recusa
    // PERMANENTE, NUNCA queda silenciosa para ensaio: "ensaiar achando que
    // se lança" é a mentira que D3-03 existe para impedir. Nenhuma
    // requisição é emitida — nem `/resolver`.
    if (modo === "lancar" && (!token || !destinoUrl)) {
      cache.set(chave, { estado: "recusada", code: "CONFIGURACAO_AUSENTE" });
      registrar("warn", 'AGENTE_CONTAS_A_PAGAR_MODO="lancar" sem credencial/URL — nenhuma requisição emitida.', { workspaceId, listId });
      return;
    }

    const state = await hidratarEstado();

    const partes: DeParaDeLancamento[] = [];
    const tarefasLancadas: Id[] = [];
    let recusadas = 0;

    for (const task of candidatas(state, listId)) {
      const corpoResolver = corpoResolverDe(state, task);
      if (!corpoResolver) {
        recusadas += 1; // D3-01 — Centro de Custo vazio: pulada sem requisição.
        continue;
      }
      const respostaResolver = await chamar("/v1/integrations/contas-a-pagar/resolver", corpoResolver);
      if (!respostaResolver.ok) {
        recusadas += 1;
        continue;
      }
      const dePara = (respostaResolver.corpo as { readonly dePara?: DeParaDeLancamento } | undefined)?.dePara;
      if (!dePara) {
        recusadas += 1;
        continue;
      }
      partes.push(dePara);

      // O lançamento real não acontece mais em "para pagar": quem lança é
      // `lancarContasEmLancamento`, quando a conta entra em "em lançamento omie".
    }

    const mesclado = mesclarDePara(partes);
    if ("erro" in mesclado) {
      cache.set(chave, { estado: "recusada", code: "DE_PARA_DIVERGENTE" });
      registrar("warn", mesclado.erro, { workspaceId, listId });
      return;
    }
    cache.set(chave, { estado: "pronta", dePara: mesclado.dePara, tarefasLancadas });
    registrar("info", `Aquecimento concluído: ${partes.length} resolvida(s), ${recusadas} recusada(s), ${tarefasLancadas.length} lançada(s).`, {
      workspaceId,
      listId,
      diaCivil: hojeCivil,
    });
  }

  const rodarAgenda: RodarAgenda = (state, atorId, listIdRecebido, diaCivilData) => {
    // A ponte só age sobre o par configurado — qualquer outra Lista (mesmo
    // Espaço ou outro) segue o padrão do agendador, sem cache e sem recusa.
    // A ponte não pode quebrar a agenda das outras Listas.
    if (state.workspace.id !== workspaceId || listIdRecebido !== listId) {
      return runScheduledAutomations(state, atorId, listIdRecebido, diaCivilData);
    }
    const diaCivilTexto = formatarDiaCivil(diaCivilData);
    const entrada = cache.get(`${workspaceId}|${listId}|${diaCivilTexto}`);
    if (!entrada || entrada.estado === "recusada") {
      // Cache frio ⇒ recusa, NUNCA o de-para do protótipo (T-3-39). O
      // agendador (03-08) fecha a linha `falhou`/`RECUSA_DO_DOMINIO` e a
      // reivindica de novo na volta seguinte, já quente.
      return fail(`Agente de lançamento: de-para ainda não resolvido para ${listId} em ${diaCivilTexto}.`);
    }
    const opcoesDaAgenda: OpcoesDaAgenda = {
      ...(cnpjPorEmpresa ? { cnpjPorEmpresa } : {}),
      lancamento:
        modo === "ensaio"
          ? { dePara: entrada.dePara, rehearsal: true }
          : { dePara: entrada.dePara, rehearsal: false, tarefasLancadas: entrada.tarefasLancadas },
    };
    return runScheduledAutomations(state, atorId, listId, diaCivilData, opcoesDaAgenda);
  };

  const executarOperacao = opcoes.executarOperacao ?? ((operacao) => executar(workspaceId, operacao));
  const resolverAtor = opcoes.resolverAtor ?? (async (ws: Id) => (await resolverMembroAgenteDoPipeline(ws)).id);
  /** A última recusa comentada por conta: o Agente não repete o mesmo pedido a cada volta. */
  const recusasComentadas = new Map<Id, string>();

  /** Comenta a recusa na conta uma vez por versão dos Campos — e nunca muda o Status. */
  async function comentarRecusa(task: Task, atorId: Id, texto: string): Promise<void> {
    const impressao = impressaoDaConta(task);
    if (recusasComentadas.get(task.id) === impressao) return;
    const r = await executarOperacao((state) =>
      addTaskComment(state, atorId, task.id, { content: texto, mentions: [{ type: "member", id: atorId }], actor: { kind: "agent", id: CP.agentId } }),
    );
    if (r.ok) recusasComentadas.set(task.id, impressao);
    registrar("warn", "Lançamento recusado.", { workspaceId, listId, taskId: task.id });
  }

  async function lancarContasEmLancamento(): Promise<void> {
    if (modo === "lancar" && (!token || !destinoUrl)) return;
    const state = await hidratarEstado();
    const contas = state.tasks.filter((t) => t.listId === listId && t.lifecycle === "ativo" && t.statusId === CP.status.emLancamento);
    if (contas.length === 0) return;
    const atorId = await resolverAtor(workspaceId);

    for (const task of contas) {
      const faltando = faltantesParaOmie(state, task);
      if (faltando.length > 0) {
        await comentarRecusa(task, atorId, `Não consegui lançar no Omie: falta ${faltando.join(", ")}. Preencha e eu tento de novo.`);
        continue;
      }
      const corpoResolver = corpoResolverDe(state, task);
      if (!corpoResolver) continue;
      const respostaResolver = await chamar("/v1/integrations/contas-a-pagar/resolver", corpoResolver);
      if (!respostaResolver.ok) {
        if (respostaResolver.permanente) {
          await comentarRecusa(task, atorId, `Não consegui lançar no Omie: o Financeiro recusou a consulta (${respostaResolver.code}). Confira os Campos da conta.`);
        }
        continue;
      }
      const dePara = (respostaResolver.corpo as { readonly dePara?: DeParaDeLancamento } | undefined)?.dePara;
      if (!dePara) continue;
      const resumo = buildResumoDePagamento(state, task, dePara);

      if (modo !== "lancar") {
        registrar("info", `Ensaio — lançaria: ${resumo.conta} · ${resumo.categoria} (${resumo.codigo}).`, { workspaceId, listId, taskId: task.id });
        continue;
      }
      if (resumo.veredito !== "resolvida") {
        // O Agente explica a categoria sem confiança num Comentário — a conta fica onde está.
        const impressao = impressaoDaConta(task);
        if (recusasComentadas.get(task.id) === impressao) continue;
        const r = await executarOperacao((s) => {
          runLancamentoAgent(s, atorId, CP.agentId, task.id, "aut_cp_a7", { dePara, rehearsal: false });
          return ok(undefined);
        });
        if (r.ok) recusasComentadas.set(task.id, impressao);
        continue;
      }

      const corpoLancar = corpoLancarDe(task, corpoResolver);
      if (!corpoLancar) continue;
      const respostaLancar = await chamar("/v1/integrations/contas-a-pagar/lancar", corpoLancar, chaveDeIdempotencia(task.id));
      if (!respostaLancar.ok) {
        if (respostaLancar.permanente) {
          await comentarRecusa(task, atorId, `O Omie recusou o lançamento (${respostaLancar.code}). A conta fica em "em lançamento omie" até ser corrigida.`);
        }
        continue;
      }
      const payableId = (respostaLancar.corpo as { readonly payableId?: unknown } | undefined)?.payableId;
      // T-3-37 — `mock-payable-<timestamp>` (credencial Omie vazia) não é
      // lançamento: mover para "lançado omie" seria mentir. `reaproveitado:
      // true` (consulta-antes-de-incluir) É sucesso.
      if (typeof payableId !== "string" || payableId.length === 0 || payableId.startsWith("mock-")) {
        await comentarRecusa(task, atorId, "O Omie não confirmou o lançamento desta conta. Nada foi movido.");
        continue;
      }

      // Lançado no Omie: o Agente publica o Resumo e a conta vai para "lançado omie", numa transação só.
      const r = await executarOperacao((s) => {
        const atual = s.tasks.find((t) => t.id === task.id);
        if (!atual || atual.statusId !== CP.status.emLancamento) return ok("A conta saiu de “em lançamento omie” antes de o lançamento voltar.");
        runLancamentoAgent(s, atorId, CP.agentId, task.id, "aut_cp_a7", { dePara, rehearsal: false });
        const movida = changeTaskStatus(s, atorId, task.id, CP.status.lancado);
        return movida.ok ? ok("Lançada no Omie.") : movida;
      });
      if (r.ok) {
        recusasComentadas.delete(task.id);
        registrar("info", `Conta lançada no Omie e movida para "lançado omie".`, { workspaceId, listId, taskId: task.id });
      } else {
        registrar("warn", `Lançada no Omie, mas não consegui mover o Status: ${r.error}`, { workspaceId, listId, taskId: task.id });
      }
    }
  }

  let temporizador: ReturnType<typeof setInterval> | undefined;
  let emAndamento = false;

  function cicloDeAquecimento(): void {
    if (emAndamento) return;
    emAndamento = true;
    void aquecer()
      .then(() => lancarContasEmLancamento())
      .catch((erro: unknown) => {
        registrar("warn", "Falha no ciclo do Agente de lançamento.", { workspaceId, listId, summary: erro instanceof Error ? erro.message.slice(0, 200) : "erro" });
      })
      .finally(() => {
        emAndamento = false;
      });
  }

  return {
    rodarAgenda,
    aquecer,
    lancarContasEmLancamento,
    iniciar() {
      if (temporizador) return;
      cicloDeAquecimento();
      temporizador = setInterval(cicloDeAquecimento, intervaloMs);
    },
    parar() {
      if (temporizador) clearInterval(temporizador);
      temporizador = undefined;
    },
  };
}
