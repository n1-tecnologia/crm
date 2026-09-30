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
 * por conta, uma chave do que decide o próximo passo (`chaveDaPonte`) — a
 * impressão de lançamento do domínio (`impressaoDeLancamento`, D6-10), o
 * Status, o Registro da última mudança de Status, a Conferência vigente com a
 * sua decisão e, desde 06-13 (crm:WR-02), TODOS os Valores de Campo ativos e
 * os anexos da Tarefa. Depois de uma recusa comentada — dado faltando, erro
 * permanente do `automation/`, lançamento não confirmado, três falhas
 * transitórias seguidas —, a conta não é mais processada até essa chave
 * mudar: alguém corrigir um Campo, subir um arquivo, mover a conta, ou
 * decidir a Conferência. Conta fora dos dois Status é esquecida. A memória
 * sobrevive ao reinício pelo fio (crm:WR-07): na primeira vez que o processo
 * vê a conta, o aviso de parada mais recente do Agente
 * (`PADROES_DAS_PARADAS`), se é posterior à última mudança humana
 * (`ultimaMudancaHumana`), restaura a parada sem requisição nem Comentário.
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
 * Financeiro, por padrão). Produção deixa as duas vazias. A porta FECHA
 * quando está errada (06-13, crm:WR-01): `avisarId` que não é Membro ativo
 * deixa a ponte parada — nenhuma requisição, nenhuma gravação, um aviso por
 * ciclo (`AVISAR_ID_INVALIDO`) —, em vez de mencionar o Financeiro real; e
 * `avisarId` sem `soTitulosCom` nem deixa a API subir
 * (`recusaDasPortasDeTeste`).
 *
 * **O ciclo e o banco (06-13, diagnóstico dos timeouts em `06-13-SUMMARY.md`).**
 * Um ciclo por vez (single-flight: relógio, cutucada e chamada direta de
 * `processarContas` dividem o MESMO ciclo em voo). Invariante: nenhuma
 * hidratação ou gravação fica aberta enquanto a ponte espera o `automation/`
 * ou o Storage — cada leitura devolve o cliente antes da rede, e cada
 * gravação é uma Unidade de Trabalho curta, sem rede dentro. Erro de BANCO no
 * ciclo (tempo de consulta ou de conexão, conexão que caiu, trava esgotada,
 * instrução cancelada pelo servidor — `codigoDaFalhaDoCiclo`) encerra o
 * ciclo ali, com log de código fixo, e agenda UM ciclo de recuperação
 * (`atrasoDeRecuperacaoMs`, 10 s, dobrando até 60 s, zerado no primeiro ciclo
 * bom); nunca conta como falha do Omie nem vira Comentário. Um ciclo faz no
 * máximo `maximoDeGravacoesPorCiclo` (20) gravações; o resto sai no ciclo
 * seguinte, cutucado. Ciclo acima de `limiarDoCicloLentoMs` (5 s) registra só
 * números (`Ciclo da ponte demorou.`).
 *
 * T-3-04 — o que vai ao log é lista fechada: ids, `code`, contagens e a
 * tripla conta · categoria · código. Nunca o texto do Resumo, chave Pix,
 * código de barras, valor, documento ou nome do fornecedor, título, URL
 * assinada, o pedido de revisão ou o `details.motivo`.
 */

import { randomUUID } from "node:crypto";
import type { ActivityRecord, DataState, Id, OperationResult, Task } from "@n1/dominio";
import { fail } from "@n1/dominio";
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
  dispensaSemManual,
  dispensarConferenciaDoResumo,
  encerrarLancamentoEmCurso,
  erpMissingFields,
  impressaoDeLancamento,
  lancamentoHumanoDe,
  lancamentoSemCodigo,
  marcarLancamentoEmCurso,
  movidaDepoisDaImportacao,
  publicarResumoParaConferencia,
  registrarFalhaDoLancamento,
  registrarLancamentoNoOmie,
  respostaSemEfeitoNoFio,
  type AnexoDoLancamento,
  type CampoDivergente,
  type ConferenciaDoResumo,
  type DeParaDeLancamento,
} from "@n1/dominio/operations/financeiro";
import { addTaskComment } from "@n1/dominio/operations/tasks";
import { pool } from "../persistencia/conexao";
import { resolverMembroAgenteDoPipeline } from "../persistencia/credenciais-de-servico";
import { executar } from "../persistencia/unidade-de-trabalho";
import { hidratar } from "../persistencia/repositorio";
import { sanitizarErro } from "../persistencia/outbox-worker";
import { LIMITE_DE_ANEXOS, anexosDaConta, type AssinarDownload } from "./anexos-da-conta";
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

/**
 * crm:WR-01 (06-13) — `AVISAR_ID` sozinho é a combinação perigosa: sem
 * `SO_TITULOS_COM`, a ponte publicaria Resumos em TODAS as contas reais com
 * o Membro de teste como aprovador. `index.ts` recusa subir com ela, como
 * recusa subir sem URL ou token. O texto nomeia as variáveis, nunca os
 * valores.
 */
export function recusaDasPortasDeTeste(escopo: { readonly soTitulosCom?: string; readonly avisarId?: Id }): string | undefined {
  if (escopo.avisarId && !escopo.soTitulosCom) {
    return (
      "AGENTE_CONTAS_A_PAGAR_AVISAR_ID exige AGENTE_CONTAS_A_PAGAR_SO_TITULOS_COM: trocar quem é mencionado só vale junto com " +
      "restringir as contas — sozinha, a ponte publicaria Resumos em todas as contas reais com um Membro de teste como " +
      "aprovador. Defina as duas, ou nenhuma."
    );
  }
  return undefined;
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

/** 06-13 — o primeiro ciclo de recuperação depois de uma falha de banco; dobra a cada falha seguida. */
export const ATRASO_DE_RECUPERACAO_MS = 10_000;

/** 06-13 — o teto do recuo da recuperação. */
export const ATRASO_MAXIMO_DE_RECUPERACAO_MS = 60_000;

/**
 * 06-13 (H3) — quantas gravações (Unidades de Trabalho) um ciclo faz no
 * máximo. Cada gravação hidrata o Espaço INTEIRO dentro da transação e
 * disputa a revisão com a tela; o resto sai no ciclo seguinte, cutucado.
 */
export const MAXIMO_DE_GRAVACOES_POR_CICLO = 20;

/** 06-13 — acima disto, o ciclo registra quanto demorou (só números). */
export const LIMIAR_DO_CICLO_LENTO_MS = 5_000;

const SQLSTATE = /^[0-9A-Z]{5}$/;

/**
 * 06-13 — o código fixo de uma exceção no ciclo, e se ela é do banco. A
 * mensagem NUNCA sai daqui (crm:WR-11, T-3-04): a do `pg` pode citar valores
 * de coluna, e a do domínio, nomes. As três mensagens do driver são as que a
 * prova de 06-06 viu (`pg/lib/client.js` e `pg-pool/index.js`); "connection
 * timeout" é perguntado antes do genérico "Connection terminated". O
 * `sqlstate` só acompanha o código genérico `ERRO_DE_BANCO` — é um código do
 * Postgres, não texto.
 */
export function codigoDaFalhaDoCiclo(erro: unknown): { readonly code: string; readonly deBanco: boolean; readonly sqlstate?: string } {
  const mensagem = erro instanceof Error ? erro.message : "";
  const bruto = typeof erro === "object" && erro !== null ? (erro as { readonly code?: unknown }).code : undefined;
  const sqlstate = typeof bruto === "string" ? bruto : undefined;
  if (mensagem === "Query read timeout") return { code: "TEMPO_DE_CONSULTA_ESGOTADO", deBanco: true };
  if (mensagem.includes("connection timeout") || mensagem.includes("timeout exceeded when trying to connect")) {
    return { code: "TEMPO_DE_CONEXAO_ESGOTADO", deBanco: true };
  }
  if (mensagem.startsWith("Connection terminated")) return { code: "CONEXAO_CAIU", deBanco: true };
  if (sqlstate === "55P03") return { code: "TRAVA_ESGOTADA", deBanco: true };
  if (sqlstate === "57014") return { code: "CONSULTA_CANCELADA_PELO_BANCO", deBanco: true };
  if (sqlstate && SQLSTATE.test(sqlstate)) return { code: "ERRO_DE_BANCO", deBanco: true, sqlstate };
  return { code: "ERRO_NO_CICLO", deBanco: false };
}

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

/** Os nomes de campo que o 422 `TITULO_EXISTENTE_DIVERGENTE` pode citar (`CampoDivergente`, contrato v1.2). */
const CAMPOS_DIVERGENTES: ReadonlySet<string> = new Set<CampoDivergente>(["valor", "vencimento", "categoria", "fornecedor", "contaCorrente"]);

function textoCurto(valor: unknown, teto: number): string | undefined {
  if (typeof valor !== "string") return undefined;
  const limpo = valor.replace(/\s+/g, " ").trim();
  return limpo && limpo.length <= teto ? limpo : undefined;
}

/**
 * crm:CR-02 e crm:WR-09 (06-12) — o motivo do Comentário para os dois 422 da
 * v1.2, com os textos do domínio: `TITULO_EXISTENTE_DIVERGENTE` com
 * `details.payableId` (≤ 40) e `details.campos` (só os cinco nomes do
 * contrato; os outros são descartados) ⇒ `tituloDivergente`;
 * `CONTA_DIVERGENTE` com `details.conferida` e `details.resolvida` (≤ 120)
 * ⇒ `contaDivergente`. `details` que não servem ⇒ `undefined`, e quem chama
 * usa o motivo de sempre (`motivoDoEnvelope`). O resultado vai só para o
 * Comentário, nunca para o log (T-3-04).
 */
export function motivoDosDetalhes(code: string, detalhes: unknown): string | undefined {
  if (typeof detalhes !== "object" || detalhes === null) return undefined;
  const d = detalhes as Readonly<Record<string, unknown>>;
  if (code === "TITULO_EXISTENTE_DIVERGENTE") {
    const payableId = textoCurto(d.payableId, 40);
    if (!payableId || !Array.isArray(d.campos)) return undefined;
    const campos = d.campos.filter((c): c is CampoDivergente => typeof c === "string" && CAMPOS_DIVERGENTES.has(c));
    return TEXTOS_DA_CONFERENCIA.tituloDivergente(payableId, campos);
  }
  if (code === "CONTA_DIVERGENTE") {
    const conferida = textoCurto(d.conferida, 120);
    const resolvida = textoCurto(d.resolvida, 120);
    return conferida && resolvida ? TEXTOS_DA_CONFERENCIA.contaDivergente(conferida, resolvida) : undefined;
  }
  return undefined;
}

/** O que `conferenciaDoReaproveitado` acha de um título reaproveitado que não é o da Conferência. */
export type DivergenciaDoReaproveitado =
  | { readonly code: "TITULO_EXISTENTE_DIVERGENTE"; readonly campos: readonly CampoDivergente[] }
  | { readonly code: "REAPROVEITADO_SEM_DE_PARA" };

/**
 * crm2:WR-02 (06-18) — o título REAPROVEITADO só vira o lançamento da
 * Conferência se o Omie mostra a conta corrente e o código conferidos. O
 * contrato v1.2 devolve, no reaproveitado, o `dePara` LIDO DO TÍTULO; a ponte
 * o confere contra a tripla da Conferência relida (`buildResumoDePagamento`
 * sobre a conta relida). Sem `dePara` com a forma do contrato (um
 * `automation/` v1.1) ⇒ `REAPROVEITADO_SEM_DE_PARA`; código ou conta
 * diferentes ⇒ `TITULO_EXISTENTE_DIVERGENTE` com os campos, nessa ordem
 * (`categoria`, `contaCorrente`); igual ⇒ `undefined`. Pura, fail-closed.
 */
export function conferenciaDoReaproveitado(
  fresco: DataState,
  atual: Task,
  conferencia: ConferenciaDoResumo,
  corpo: unknown,
): DivergenciaDoReaproveitado | undefined {
  const dePara = typeof corpo === "object" && corpo !== null ? (corpo as { readonly dePara?: unknown }).dePara : undefined;
  if (typeof dePara !== "object" || dePara === null) return { code: "REAPROVEITADO_SEM_DE_PARA" };
  const { contaPorTag, categoriaPorCampo } = dePara as { readonly contaPorTag?: unknown; readonly categoriaPorCampo?: unknown };
  if (typeof contaPorTag !== "object" || contaPorTag === null || typeof categoriaPorCampo !== "object" || categoriaPorCampo === null) {
    return { code: "REAPROVEITADO_SEM_DE_PARA" };
  }
  const r = buildResumoDePagamento(fresco, atual, dePara as DeParaDeLancamento);
  const campos: CampoDivergente[] = [];
  if (r.codigo !== conferencia.origin.lancamento.codigo) campos.push("categoria");
  if (r.conta !== conferencia.origin.lancamento.conta) campos.push("contaCorrente");
  return campos.length === 0 ? undefined : { code: "TITULO_EXISTENTE_DIVERGENTE", campos };
}

/** O motivo do Comentário quando o reaproveitado chega sem o `dePara` do título (06-18, crm2:WR-02). Só o id do título. */
export function motivoDoReaproveitadoSemDePara(payableId: string): string {
  return `o Omie devolveu o título ${payableId}, que já existia, sem os dados para eu conferir se ele é o desta Conferência (o automation/ precisa estar na v1.2): confira o título no Omie antes de mover a conta de novo para "em lançamento omie"`;
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
  /** 06-13 — o primeiro ciclo de recuperação depois de uma falha de banco, em ms. Padrão `ATRASO_DE_RECUPERACAO_MS` (10 s). */
  readonly atrasoDeRecuperacaoMs?: number;
  /** 06-13 — o teto do recuo da recuperação, em ms. Padrão `ATRASO_MAXIMO_DE_RECUPERACAO_MS` (60 s). */
  readonly atrasoMaximoDeRecuperacaoMs?: number;
  /** 06-13 — gravações por ciclo, no máximo. Padrão `MAXIMO_DE_GRAVACOES_POR_CICLO` (20). */
  readonly maximoDeGravacoesPorCiclo?: number;
  /** 06-13 — acima disto, o ciclo registra quanto demorou. Padrão `LIMIAR_DO_CICLO_LENTO_MS` (5 s). */
  readonly limiarDoCicloLentoMs?: number;
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
  /**
   * Um ciclo dos dois momentos. Fora de qualquer transação até cada gravação.
   * Single-flight (06-13): com um ciclo em voo, devolve ESSE ciclo.
   */
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
  /** Para o relógio, a cutucada e a recuperação pendentes; resolve quando o ciclo em voo (se houver) terminar. */
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
  /**
   * 06-19 (crm2:WR-05) — falhas SEGUIDAS do Comentário do Agente com esta
   * chave (a porta G3 não conta). Em `TENTATIVAS_TRANSITORIAS`, o pendente é
   * desistido (`COMENTARIO_PENDENTE_DESISTIDO`); a chave nova zera.
   */
  tentativasDoComentario?: number;
  /** A última resposta do fio já lida e deixada de lado (ignorada, ou recusada pelo domínio) — não é relida. */
  respostaLida?: Id;
  /**
   * 06-21 (crm2:WR-05 residual, 06-REVIEW-3 WR-01) — o id do Comentário
   * (`semEfeito.resposta.id`) ao qual a ponte já desistiu de responder no
   * fio. PRÓPRIO de `lerRespostas`: nunca reaproveita `comentarioPendente`/
   * `tentativasDoComentario` de `comentar()`, que qualquer gravação de
   * Comentário desta conta compartilha (uma parada por dado faltando e uma
   * resposta sem efeito não podem disputar o mesmo contador). A desistência é
   * LOCAL a esta resposta — nunca `estado.parada`: uma resposta nova (outro
   * id) ou uma decisão de verdade no mesmo fio continuam sendo lidas e
   * processadas normalmente.
   */
  semEfeitoDesistidoId?: Id;
  /** Falhas SEGUIDAS de `comentar()` para a resposta de `semEfeitoTentativaId`. */
  tentativasSemEfeito?: number;
  /** A resposta (id) para a qual `tentativasSemEfeito` conta agora — muda (outra resposta sem efeito) ⇒ o contador zera. */
  semEfeitoTentativaId?: Id;
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

function membroAtivo(state: DataState, id: Id): boolean {
  return state.members.some((m) => m.id === id && m.state === "ativo");
}

/** Por que a ponte não chama o `/lancar` agora (06-12, crm:CR-01) — só o código vai ao log. */
export type CodigoDeAdiamento =
  | "CONTA_SUMIU"
  | "AVISAR_ID_INVALIDO"
  | "INATIVA"
  | "SAIU_DE_EM_LANCAMENTO"
  | "NAO_ENTROU_POR_MOVIMENTO"
  | "FORA_DO_ESCOPO"
  | "MANUAL"
  | "LANCAMENTO_HUMANO"
  /**
   * 06-18 (crm2:CR-01) — a Conferência vigente foi DISPENSADA (D6-04) e a
   * conta não é mais "Manual": a dispensa só vale enquanto "Manual", em
   * qualquer modo (inclusive depois de voltar para `nao-encosta`). Ninguém
   * conferiu nada; o ciclo seguinte publica um Resumo para uma pessoa.
   */
  | "DISPENSA_SEM_MANUAL"
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
 * Manual É lançada (D6-04). Mas a DISPENSA só vale enquanto a conta é
 * "Manual", em qualquer modo (06-18, crm2:CR-01): dispensada e desmarcada ⇒
 * `DISPENSA_SEM_MANUAL`, antes de `SEM_CONFERENCIA_APROVADA`. Pura.
 */
export function motivoParaNaoLancar(
  fresco: DataState,
  taskId: Id,
  conferidaId: Id,
  criterio: {
    readonly listId: Id;
    readonly soTitulosCom?: string;
    readonly integracaoManual: OpcoesDeDecisao["integracaoManual"];
    /** G3 — o Membro indicado tem de continuar ativo AGORA (06-13, crm:WR-01). */
    readonly avisarId?: Id;
  },
): CodigoDeAdiamento | undefined {
  const atual = fresco.tasks.find((t) => t.id === taskId && t.listId === criterio.listId);
  if (!atual) return "CONTA_SUMIU";
  if (criterio.avisarId && !membroAtivo(fresco, criterio.avisarId)) return "AVISAR_ID_INVALIDO";
  if (effectiveLifecycleOfTask(fresco, atual.id) !== "ativo") return "INATIVA";
  if (atual.statusId !== CP.status.emLancamento) return "SAIU_DE_EM_LANCAMENTO";
  if (!entrouPorMovimento(fresco, atual)) return "NAO_ENTROU_POR_MOVIMENTO";
  if (!dentroDoEscopo(atual, criterio.soTitulosCom)) return "FORA_DO_ESCOPO";
  if (criterio.integracaoManual === "nao-encosta" && valorDoCampo(atual, CP.fields.integracaoManual) === "Manual") return "MANUAL";
  if (lancamentoHumanoDe(fresco, atual) !== undefined) return "LANCAMENTO_HUMANO";
  const { estado, conferencia } = conferenciaDoResumo(fresco, atual);
  if (conferencia && dispensaSemManual(atual, conferencia)) return "DISPENSA_SEM_MANUAL";
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

/**
 * `CodigoDoAnexo` — a lista fechada do contrato v1.2 para `anexos[].erro`
 * (`06-GAPS-OUTLINE.md` § v1.2; o domínio não a exporta como valor). Qualquer
 * outro texto é descartado: nunca erro de rede cru no Comentário.
 */
const CODIGOS_DO_ANEXO: ReadonlySet<string> = new Set([
  "ANEXO_HOST_NAO_PERMITIDO",
  "ANEXO_DOWNLOAD_FALHOU",
  "ANEXO_TEMPO_ESGOTADO",
  "ANEXO_GRANDE_DEMAIS",
  "ANEXO_OMIE_RECUSOU",
]);

/**
 * Os anexos da resposta do `/lancar` v1.2 como o domínio os conta
 * (`TEXTOS_DA_CONFERENCIA.lancado`): para cada anexo ENVIADO, na ordem do
 * envio, o primeiro item ainda não usado da resposta com o mesmo `nome`
 * (aparado) vira `{ nome: <o enviado>, ok, jaExistia?, erro? }` — `erro` só
 * quando o anexo não subiu E o código é da lista fechada. Enviado sem par não
 * vira item (o domínio conta "sem resposta do Omie" pela diferença para
 * `anexosPedidos`); item da resposta sem par vira só a contagem `semPar`. A
 * `url` e qualquer texto livre da resposta morrem aqui.
 */
function anexosDaResposta(corpo: unknown, enviados: ReadonlyArray<{ readonly nome: string }>): { readonly itens: AnexoDoLancamento[]; readonly semPar: number } {
  const lista = (corpo as { readonly anexos?: unknown } | undefined)?.anexos;
  const recebidos = (Array.isArray(lista) ? lista : []).map(
    (item: unknown) => (typeof item === "object" && item !== null ? item : {}) as { readonly nome?: unknown; readonly ok?: unknown; readonly erro?: unknown; readonly jaExistia?: unknown },
  );
  const usados = new Set<number>();
  const itens: AnexoDoLancamento[] = [];
  for (const enviado of enviados) {
    const alvo = enviado.nome.trim();
    const i = recebidos.findIndex((r, posicao) => !usados.has(posicao) && typeof r.nome === "string" && r.nome.trim() === alvo);
    if (i < 0) continue;
    usados.add(i);
    const r = recebidos[i]!;
    const ok = r.ok === true;
    itens.push({
      nome: enviado.nome,
      ok,
      ...(r.jaExistia === true ? { jaExistia: true } : {}),
      ...(!ok && typeof r.erro === "string" && CODIGOS_DO_ANEXO.has(r.erro) ? { erro: r.erro } : {}),
    });
  }
  return { itens, semPar: recebidos.length - usados.size };
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

/** Em "em lançamento omie", o pedido do dado que falta (`erpMissingFields`). */
export function textoDoDadoFaltando(faltando: readonly string[]): string {
  return `Não consegui lançar no Omie: falta ${faltando.join(", ")}. Preencha e eu tento de novo.`;
}

/** D3-01 — nenhuma requisição nasce sem Centro de Custo. */
export const TEXTO_SEM_CENTRO_DE_CUSTO = "Não consegui preparar o Resumo desta conta: falta Centro de Custo.";

export const TEXTO_VALOR_INVALIDO = "Não consegui lançar no Omie: o Valor precisa ser um número maior que zero. Corrija e eu tento de novo.";

/** T-3-37 — `payableId` ausente ou `mock-…`: não é lançamento. */
export const TEXTO_LANCAMENTO_NAO_CONFIRMADO = "O Omie não confirmou o lançamento desta conta. Nada foi movido.";

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

/**
 * O que ficou de fora do pedido pelo teto de anexos do `/lancar` v1.2
 * (`LIMITE_DE_ANEXOS`): um Comentário à parte, depois do registro.
 */
export function textoDosAnexosAcimaDoLimite(n: number): string {
  return n === 1
    ? `1 anexo desta conta não foi enviado ao Omie: o limite é de ${LIMITE_DE_ANEXOS} por lançamento. Se for necessário, suba-o no Omie à mão.`
    : `${n} anexos desta conta não foram enviados ao Omie: o limite é de ${LIMITE_DE_ANEXOS} por lançamento. Se forem necessários, suba-os no Omie à mão.`;
}

/**
 * D6-04 `sem-conferencia` — o motivo gravado na decisão (e no Registro
 * "Aprovação decidida"). Mora no domínio desde 06-18 (a leitura de
 * compatibilidade de `dispensaDaConferencia` depende dele); reexportado aqui
 * com o mesmo nome para quem já o importava da ponte.
 */
export { MOTIVO_DA_DISPENSA } from "@n1/dominio/operations/financeiro";

/* ───────────── A memória que sobrevive ao reinício (06-13, crm:WR-07) ───────────── */

const CURINGA_TEXTO = "\u0000T\u0000";
const CURINGA_CODIGO = "\u0000C\u0000";

/**
 * Um padrão ANCORADO a partir do próprio texto, montado com curingas no lugar
 * das partes variáveis: texto livre (`[\s\S]+`) e código de erro
 * (`[A-Z0-9_]+`). Mudar um texto muda o padrão junto; nada é copiado à mão.
 */
function padraoDoTexto(molde: string): RegExp {
  const escapado = molde.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escapado.split(CURINGA_TEXTO).join("[\\s\\S]+").split(CURINGA_CODIGO).join("[A-Z0-9_]+")}$`);
}

/**
 * Os avisos de PARADA que o Agente publica — os de `parar()` e o
 * `falhaSemVolta` do domínio (a conta NÃO voltou para "para pagar": sem
 * parada, um reinício chamaria o `/lancar` de novo). Um padrão por texto; um
 * texto de parada casa com exatamente um (o caso (k) de
 * `ponte-portas-e-paradas.test.ts` trava isso).
 *
 * O aviso de reserva `textoDaRecusaPermanente` (quando o registro da falha é
 * recusado) é coberto pelo padrão de `falhaSemVolta` SEM recusa: as duas
 * formas são a mesma, de propósito, e um padrão a mais faria o texto casar
 * com dois. Mudar um texto sem o outro quebra o caso (n) de
 * `ponte-reaproveitado-conferido.test.ts` (06-18, crm2:IN-03).
 *
 * Fora de propósito: `TEXTOS_DA_CONFERENCIA.falha` (a conta VOLTOU para "para
 * pagar" — ali não há parada a restaurar: a conta conferida espera o humano,
 * e a superada por `CONTA_DIVERGENTE` precisa do Resumo novo), o Resumo, a
 * resposta `recusaSemCodigo`, os anexos acima do limite e o aviso do modo
 * conferência (que tem regra própria, `avisoDoModoNoFio`).
 */
export const PADROES_DAS_PARADAS: readonly RegExp[] = [
  textoDaRecusaDoResumo(CURINGA_TEXTO, CURINGA_CODIGO),
  textoDasTransitorias(CURINGA_CODIGO),
  TEXTO_NASCEU_EM_LANCAMENTO,
  TEXTO_SEM_CODIGO_CONFERIDO,
  textoDoDadoFaltando([CURINGA_TEXTO]),
  TEXTO_SEM_CENTRO_DE_CUSTO,
  TEXTO_VALOR_INVALIDO,
  TEXTO_LANCAMENTO_NAO_CONFIRMADO,
  textoDoRegistroRecusado(CURINGA_TEXTO, CURINGA_TEXTO),
  textoDoRegistroEmConflito(CURINGA_TEXTO),
  TEXTOS_DA_CONFERENCIA.falhaSemVolta(CURINGA_TEXTO, CURINGA_CODIGO),
  TEXTOS_DA_CONFERENCIA.falhaSemVolta(CURINGA_TEXTO, CURINGA_CODIGO, CURINGA_TEXTO),
].map(padraoDoTexto);

/**
 * Um ponto no tempo do Espaço: o instante e a sequência do id que o gerou
 * (`nextId`, um contador só para todos os prefixos) — no mesmo milissegundo,
 * a sequência desempata, como `newestFirst` faz com a Atividade.
 */
export interface Marco {
  readonly at: string;
  readonly sequencia: number;
}

const PADRAO_DO_ID = /^[a-z]+_([0-9a-z]{6})$/;

function sequenciaDoId(id: string): number {
  const m = PADRAO_DO_ID.exec(id);
  return m ? Number.parseInt(m[1]!, 36) : 0;
}

function depoisDe(a: Marco, b: Marco): boolean {
  const ta = Date.parse(a.at);
  const tb = Date.parse(b.at);
  return ta > tb || (ta === tb && a.sequencia > b.sequencia);
}

function maisRecente(marcos: ReadonlyArray<Marco | undefined>): Marco | undefined {
  let melhor: Marco | undefined;
  for (const m of marcos) if (m && (!melhor || depoisDe(m, melhor))) melhor = m;
  return melhor;
}

/**
 * crm:WR-07 — a última mudança HUMANA na conta: o Registro de Atividade
 * mais recente da Tarefa feito por um Membro que não é o de serviço (Campo,
 * Status, Comentário — inclusive a resposta no fio que a ponte converteu em
 * decisão, que é gravada em nome de quem respondeu); a criação da Conferência
 * vigente (um Resumo novo é chave nova); e a decisão dela, quando não foi o
 * Membro de serviço quem decidiu. O que o Agente grava (Comentários, Resumo,
 * falhas) tem ator Agente e não conta.
 */
export function ultimaMudancaHumana(state: DataState, task: Task, atorDoServico: Id): Marco | undefined {
  const marcos: Marco[] = [];
  for (const a of state.activity) {
    if (a.objectType !== "task" || a.objectId !== task.id) continue;
    if (a.actor.kind !== "member" || a.actor.id === atorDoServico) continue;
    marcos.push({ at: a.at, sequencia: sequenciaDoId(a.id) });
  }
  const vigente = conferenciaDoResumo(state, task).conferencia;
  if (vigente) {
    marcos.push({ at: vigente.createdAt, sequencia: sequenciaDoId(vigente.id) });
    if (vigente.decidedAt && vigente.decidedByMemberId !== atorDoServico) marcos.push({ at: vigente.decidedAt, sequencia: 0 });
  }
  return maisRecente(marcos);
}

const doAgente = (c: Task["comments"][number]): boolean => c.author.kind === "agent" && c.author.id === CP.agentId && !c.deletedAt;

/** O aviso de parada mais recente do Agente no fio da conta (`PADROES_DAS_PARADAS`), como Marco. */
function ultimaParadaNoFio(task: Task): Marco | undefined {
  return maisRecente(
    task.comments
      .filter((c) => doAgente(c) && PADROES_DAS_PARADAS.some((p) => p.test(c.content)))
      .map((c) => ({ at: c.createdAt, sequencia: sequenciaDoId(c.id) })),
  );
}

/**
 * crm:WR-07 — o aviso do modo `conferencia` sai uma vez por ENTRADA em "em
 * lançamento omie": já está no fio da Conferência, publicado depois do mais
 * recente entre o último "Status alterado" e a decisão dela? Então não sai de
 * novo — nem depois de um reinício, nem quando um Campo fora da impressão
 * muda a chave (WR-02). Sair e voltar é Registro novo, e o aviso volta.
 */
function avisoDoModoNoFio(state: DataState, task: Task, conferencia: ConferenciaDoResumo): boolean {
  const status = ultimaMudancaDeStatus(state, task);
  const desde = maisRecente([
    status ? { at: status.at, sequencia: sequenciaDoId(status.id) } : undefined,
    conferencia.decidedAt ? { at: conferencia.decidedAt, sequencia: 0 } : undefined,
  ]);
  return task.comments.some(
    (c) =>
      doAgente(c) &&
      c.parentCommentId === conferencia.origin.threadCommentId &&
      c.content === TEXTOS_DA_CONFERENCIA.modoConferencia &&
      (!desde || depoisDe({ at: c.createdAt, sequencia: sequenciaDoId(c.id) }, desde)),
  );
}

/**
 * crm:WR-02 (06-13) — a chave da parada. A impressão de lançamento (D6-10)
 * foi desenhada para o LANÇAMENTO e deixa de fora os Campos de arquivo e a
 * Integração manual; mas `erpMissingFields` também depende das exigências de
 * saída do Status (qualquer Campo exigido, arquivos inclusive), e a
 * Integração manual decide a parada `manual`. Por isso a chave leva também
 * TODOS os Valores de Campo ativos (pares [definição, valor], ordenados) e os
 * anexos da Tarefa: subir o Boleto que faltava, ou desmarcar Manual, destrava
 * a conta na hora. Um Comentário não muda a chave.
 */
export function chaveDaPonte(state: DataState, task: Task): string {
  const conf = conferenciaDoResumo(state, task);
  const valores = task.fieldValues
    .filter((v) => v.state === "ativo")
    .map((v) => [v.definitionId, v.value ?? null] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return JSON.stringify([
    impressaoDeLancamento(state, task),
    task.statusId,
    ultimaMudancaDeStatus(state, task)?.id ?? null,
    conf.conferencia?.id ?? null,
    conf.conferencia?.decision ?? null,
    valores,
    task.attachments.map((a) => a.fileId),
  ]);
}

/**
 * 06-19 (crm2:IN-02) — a recusa sentinela dos ramos da ponte que decidem,
 * DENTRO da Unidade de Trabalho, não mudar nada (o Resumo adiado, a saída
 * antes do registro, a marca adiada). Uma recusa faz a Unidade de Trabalho
 * desfazer sem o `update … revisao`: a tela não reidrata e ninguém disputa a
 * trava por uma gravação vazia. Fora da operação, `!r.ok && r.error ===
 * SEM_EFEITO` é o caminho do adiamento — o mesmo log e o mesmo Comentário de
 * antes. Exportada para os testes.
 */
export const SEM_EFEITO = "PONTE_SEM_EFEITO";

function semEfeito(): OperationResult<never> {
  return fail(SEM_EFEITO);
}

/** `r` é a recusa sentinela `SEM_EFEITO` (e não um conflito). */
function foiSemEfeito(r: { readonly ok: boolean; readonly error?: string; readonly conflito?: boolean }): boolean {
  return !r.ok && !r.conflito && r.error === SEM_EFEITO;
}

const CAMINHO_RESOLVER = "/v1/integrations/contas-a-pagar/resolver";
const CAMINHO_LANCAR = "/v1/integrations/contas-a-pagar/lancar";

export function criarPonteDoAgente(opcoes: OpcoesDaPonte): PonteDoAgente {
  const fetchImpl = opcoes.fetchImpl ?? fetch;
  const timeoutResolverMs = opcoes.timeoutResolverMs ?? TIMEOUT_RESOLVER_MS;
  const timeoutLancarMs = opcoes.timeoutLancarMs ?? TIMEOUT_LANCAR_MS;
  const intervaloMs = opcoes.intervaloMs ?? 900_000;
  const atrasoDaCutucadaMs = opcoes.atrasoDaCutucadaMs ?? ATRASO_DA_CUTUCADA_MS;
  const atrasoDeRecuperacaoMs = opcoes.atrasoDeRecuperacaoMs ?? ATRASO_DE_RECUPERACAO_MS;
  const atrasoMaximoDeRecuperacaoMs = opcoes.atrasoMaximoDeRecuperacaoMs ?? ATRASO_MAXIMO_DE_RECUPERACAO_MS;
  const maximoDeGravacoesPorCiclo = opcoes.maximoDeGravacoesPorCiclo ?? MAXIMO_DE_GRAVACOES_POR_CICLO;
  const limiarDoCicloLentoMs = opcoes.limiarDoCicloLentoMs ?? LIMIAR_DO_CICLO_LENTO_MS;
  const registrar = opcoes.registrar ?? (() => undefined);
  const { destinoUrl, token, workspaceId, listId, modo, cnpjPorEmpresa, soTitulosCom } = opcoes;
  const decisoes: OpcoesDeDecisao = { ...DECISOES_PADRAO, ...opcoes.decisoes };
  /** Os modos que gravam na conta. O ensaio nunca grava (D3-03). */
  const escreve = modo !== "ensaio";
  /** 06-13 — o que o ciclo em voo fez; zerado no começo de cada ciclo (um por vez). Só números vão ao log. */
  let medida = { hidratacoes: 0, gravacoes: 0, conflitos: 0, requisicoes: 0 };
  const hidratarDoBanco =
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
  const executarNoBanco =
    opcoes.executarOperacao ??
    (async (operacao: (state: DataState) => OperationResult<unknown>) => {
      const r = await executar(workspaceId, operacao);
      if ("conflito" in r) return { ok: false as const, error: r.error, conflito: true };
      return r.ok ? { ok: true as const } : { ok: false as const, error: r.error };
    });
  const hidratarEstado = async (): Promise<DataState> => {
    medida.hidratacoes += 1;
    return hidratarDoBanco();
  };
  const executarOperacao: typeof executarNoBanco = async (operacao) => {
    medida.gravacoes += 1;
    const r = await executarNoBanco(operacao);
    if (!r.ok && "conflito" in r && r.conflito) medida.conflitos += 1;
    return r;
  };
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
    | { readonly ok: false; readonly permanente: boolean; readonly code: string; readonly motivo?: string | undefined; readonly detalhes?: unknown }
  > {
    medida.requisicoes += 1;
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
      // `detalhes` (o `error.details` do envelope) só alimenta o texto do
      // Comentário dos 422 v1.2 (`motivoDosDetalhes`) — nunca o log acima.
      ...(classificacao.permanente ? { motivo: motivoDoEnvelope(corpoResposta), detalhes: erroDoEnvelope(corpoResposta)?.details } : {}),
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
  /**
   * G3 — quem as Menções da ponte avisam neste ciclo: `avisarId` (já
   * conferido como Membro ativo no começo do ciclo — o inválido nem chega
   * aqui, crm:WR-01) ou a regra de sempre.
   */
  function avisarDoCiclo(): Id | undefined {
    return opcoes.avisarId;
  }

  /**
   * 06-19 (crm2:WR-05) — o cursor rotativo: a conta em que o orçamento do
   * ciclo anterior se esgotou. O ciclo seguinte começa por ela (nunca
   * pulando), e um laço que chega ao fim o zera — nenhuma conta do fim da
   * lista passa fome atrás de contas que gastam gravação a cada ciclo.
   */
  let cursor: Id | undefined;
  /**
   * 06-19 (crm2:WR-05) — o orçamento se esgotou: o próximo ciclo é agendado
   * pelo temporizador da cutucada (`atrasoDaCutucadaMs`) quando este
   * terminar, nunca como `repetir` imediato (o laço quente contra o banco).
   */
  let continuar = false;

  /**
   * 06-13 — uma falha de banco no ciclo: log de código fixo (nunca a
   * mensagem, crm:WR-11) com os contadores do ciclo, e UM ciclo de
   * recuperação agendado. `false` quando o erro não é do banco — quem chamou
   * o relança.
   */
  function falhaDeBancoNoCiclo(erro: unknown, taskId?: Id): boolean {
    const falha = codigoDaFalhaDoCiclo(erro);
    if (!falha.deBanco) return false;
    const recuperacaoEmMs = agendarRecuperacao();
    registrar("warn", "Falha de banco no ciclo do Agente de lançamento.", {
      workspaceId,
      listId,
      ...(taskId ? { taskId } : {}),
      code: falha.code,
      ...(falha.sqlstate ? { sqlstate: falha.sqlstate } : {}),
      ...(recuperacaoEmMs !== undefined ? { recuperacaoEmMs } : {}),
      ...medida,
    });
    return true;
  }

  /** O laço das contas. `true` quando uma falha de banco o parou (a recuperação já está agendada). */
  async function percorrerContas(): Promise<boolean> {
    // T-3-35 — num modo que grava, credencial ou URL ausentes: nenhuma
    // requisição, NUNCA queda silenciosa para ensaio.
    if (escreve && (!token || !destinoUrl)) return false;
    let state: DataState;
    try {
      state = await hidratarEstado();
    } catch (erro) {
      if (falhaDeBancoNoCiclo(erro)) return true;
      throw erro;
    }
    // crm:WR-01 — a porta de teste mal configurada deixa a ponte PARADA: sem
    // requisição, sem gravação, em todos os modos, com um aviso por ciclo
    // (sem o id). Falhar aberto mencionaria o Financeiro real.
    if (opcoes.avisarId && !membroAtivo(state, opcoes.avisarId)) {
      registrar("warn", "AGENTE_CONTAS_A_PAGAR_AVISAR_ID não é um Membro ativo do Espaço: a ponte não age neste ciclo (a porta de teste está mal configurada).", {
        workspaceId,
        listId,
        code: "AVISAR_ID_INVALIDO",
      });
      return false;
    }
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

    const avisar = avisarDoCiclo();
    let ator: Id | undefined;
    const atorDaEscrita = async (): Promise<Id> => (ator ??= await resolverAtor(workspaceId));
    let importadasForaDaPonte = 0;
    /**
     * 06-19 (crm2:WR-04) — a porta G3 fechou NO MEIO do ciclo: uma gravação
     * recusou porque `avisarId` deixou de ser Membro ativo. O mesmo aviso do
     * começo do ciclo (uma vez, sem o id), e o laço para antes da próxima
     * conta — nenhuma gravação a mais. O ciclo seguinte para no começo.
     */
    let portaDoCicloFechada = false;
    const portaFechada = (): void => {
      if (portaDoCicloFechada) return;
      portaDoCicloFechada = true;
      registrar("warn", "AGENTE_CONTAS_A_PAGAR_AVISAR_ID deixou de ser um Membro ativo do Espaço no meio do ciclo: a ponte parou (a porta de teste está mal configurada).", {
        workspaceId,
        listId,
        code: "AVISAR_ID_INVALIDO",
      });
    };
    /** A recusa do domínio (ou da ponte, dentro da operação) é a da porta G3. */
    const ehRecusaDaPorta = (r: { readonly ok: boolean; readonly error?: string }): boolean =>
      !r.ok && r.error === TEXTOS_DA_CONFERENCIA.recusaAvisarInativo;

    // 06-19 (crm2:WR-05) — começa de onde o ciclo anterior parou.
    const inicio = cursor === undefined ? -1 : contas.findIndex((t) => t.id === cursor);
    const naOrdem = inicio > 0 ? [...contas.slice(inicio), ...contas.slice(0, inicio)] : contas;

    for (const task of naOrdem) {
      if (portaDoCicloFechada) {
        // 06-21 (crm2:IN-01) — o cursor rotativo também é gravado quando é a
        // porta G3 que fecha o ciclo no meio do laço, não só quando o
        // orçamento esgota: o ciclo seguinte recomeça exatamente por esta
        // conta (ainda não processada), nos dois casos.
        cursor = task.id;
        return false;
      }
      // 06-13 (H3) — o orçamento: cada gravação hidrata o Espaço inteiro e
      // disputa a revisão com a tela. Esgotado, o resto sai no ciclo
      // seguinte — que começa por esta conta (o cursor) e espera
      // `atrasoDaCutucadaMs` (a continuação, 06-19).
      if (medida.gravacoes >= maximoDeGravacoesPorCiclo) {
        registrar("info", "Orçamento de gravações do ciclo esgotado; as outras contas ficam para o ciclo seguinte.", {
          workspaceId,
          listId,
          code: "ORCAMENTO_DO_CICLO_ESGOTADO",
          gravacoes: medida.gravacoes,
        });
        cursor = task.id;
        continuar = true;
        return false;
      }
      try {
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
        const chave = chaveDaPonte(state, task);
        const daConta = { workspaceId, listId, taskId: task.id };
        let estado = estadoPorConta.get(task.id);
        if (!estado || estado.chave !== chave) {
          const primeiraVista = !estado;
          estado = { chave, transitorias: 0 };
          estadoPorConta.set(task.id, estado);
          // crm:WR-07 — o fio é a memória. Na PRIMEIRA vez que este processo
          // vê a conta (reinício, deploy), o aviso de parada mais recente do
          // Agente, se é posterior à última mudança humana, restaura a parada
          // — sem requisição e sem Comentário. Com o processo vivo, a chave
          // decide como sempre.
          if (primeiraVista && escreve) {
            const parada = ultimaParadaNoFio(task);
            const humana = parada ? ultimaMudancaHumana(state, task, await atorDaEscrita()) : undefined;
            if (parada && (!humana || depoisDe(parada, humana))) {
              estado.parada = "recusa";
              registrar("info", "Parada restaurada do fio depois de reiniciar.", { ...daConta, code: "PARADA_RESTAURADA" });
            }
          }
        }
        const deste = estado;

        /**
         * Grava o Comentário do Agente (modos que gravam); falhando, fica
         * pendente para o próximo ciclo — sem chamar o Omie de novo.
         *
         * 06-21 (crm2:WR-05 residual, 06-REVIEW-3 WR-01) — devolve
         * `Promise<boolean>` (verdadeiro só quando de fato gravou): antes
         * devolvia `Promise<void>`, e `lerRespostas` não tinha como saber se
         * `RESPOSTA_SEM_EFEITO` podia sair de verdade.
         */
        const comentar = async (texto: string, parentCommentId?: Id): Promise<boolean> => {
          const atorId = await atorDaEscrita();
          const r = await executarOperacao((s) => {
            // crm2:WR-04 (06-19) — a porta G3 conferida DENTRO da operação:
            // um Membro de teste inativo nunca é mencionado, e a Maryane não
            // entra no lugar dele.
            if (avisar && !membroAtivo(s, avisar)) return fail(TEXTOS_DA_CONFERENCIA.recusaAvisarInativo);
            return addTaskComment(s, atorId, task.id, {
              content: texto,
              mentions: [{ type: "member", id: avisar ?? avisadoDoLancamento(s, atorId) }],
              actor: { kind: "agent", id: CP.agentId },
              ...(parentCommentId ? { parentCommentId } : {}),
            });
          });
          if (r.ok) {
            delete deste.comentarioPendente;
            deste.tentativasDoComentario = 0;
            return true;
          } else if (ehRecusaDaPorta(r)) {
            // Fica pendente, sem contar tentativa: volta quando a porta for arrumada.
            deste.comentarioPendente = texto;
            portaFechada();
            return false;
          } else {
            deste.comentarioPendente = texto;
            deste.tentativasDoComentario = (deste.tentativasDoComentario ?? 0) + 1;
            registrar("warn", "Não consegui gravar o Comentário do Agente; tento de novo no próximo ciclo.", daConta);
            // crm2:WR-05 (06-19) — um Comentário que falha sempre (Agente
            // pausado, Convidado sem concessão) não gasta o orçamento de todo
            // ciclo: depois de `TENTATIVAS_TRANSITORIAS`, desiste. A parada
            // continua; a chave nova a reabre.
            if (deste.tentativasDoComentario >= TENTATIVAS_TRANSITORIAS) {
              delete deste.comentarioPendente;
              registrar("info", "Desisti de gravar o Comentário do Agente nesta conta.", { ...daConta, code: "COMENTARIO_PENDENTE_DESISTIDO" });
            }
            return false;
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
            await parar("recusa", textoDoDadoFaltando(faltando), `faltam ${faltando.length} Campo(s).`, "lançaria");
          }
          continue;
        }

        if (conf.estado === "pendente" && conf.conferencia) {
          if (!escreve) continue; // o ensaio não decide nada
          // D6-04 com um Resumo sem código: o domínio recusaria a dispensa
          // (crm:WR-03), então o Financeiro pede ajuste pelo fio, como numa
          // conta qualquer; o Resumo revisado com código é dispensado.
          // 06-21 (crm2:CR-01 residual, 06-REVIEW-3 Crítico): remarcar "Manual"
          // nunca dispensa por cima de uma resposta humana (ajuste ou
          // aprovação) ainda não lida no fio da Conferência vigente — o mesmo
          // sinal que o domínio confere dentro de `dispensarConferenciaDoResumo`,
          // calculado aqui ANTES, para nem tentar a dispensa quando há resposta
          // pendente: ela é lida, nunca engolida.
          const pendenteNoFio = decisaoDasRespostasPendentes(state, task, { aprovacaoPorComentario: true }).sentido !== "nenhum";
          if (manual && !pendenteNoFio && !lancamentoSemCodigo(conf.conferencia.origin.lancamento)) await dispensar(conf.conferencia);
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
          // D6-11 — ZERO `/lancar`: diz no fio, uma vez por entrada no Status,
          // que nada foi lançado (crm:WR-07: o fio decide, não a memória).
          estado.parada = "conferencia";
          registrar("info", `Conferência — lançaria: ${conta} · ${categoria} (${codigo}).`, daConta);
          if (!avisoDoModoNoFio(state, task, conferencia)) await comentar(TEXTOS_DA_CONFERENCIA.modoConferencia, conferencia.origin.threadCommentId);
          continue;
        }
        await momentoDoLancamento(conferencia);

        /* ─── os passos, como funções da conta (fecham sobre `task`, `estado`, `conf`) ─── */

        /**
         * Fluxo 6 (D6-02, crm:WR-04) — TODAS as respostas pendentes do fio, em
         * lote (`decisaoDasRespostasPendentes`): o primeiro ajuste vence a
         * aprovação do mesmo lote, e a resposta que decide vira decisão em nome
         * de quem a escreveu. Nada é relido enquanto não chega resposta nova.
         *
         * 06-18 (crm2:WR-03): antes de tudo, o "ok" que não confere — de quem
         * não pode decidir esta Conferência, ou com a decisão por comentário
         * desligada — recebe a resposta do domínio no fio
         * (`respostaSemEfeitoNoFio`), nunca silêncio. A memória é o fio: o
         * domínio descarta a resposta já dada, e nada novo vai a `EstadoDaConta`.
         */
        async function lerRespostas(pendente: ConferenciaDoResumo): Promise<void> {
          const semEfeito = respostaSemEfeitoNoFio(state, task, { aprovacaoPorComentario: decisoes.conferenciaPorComentario });
          if (semEfeito) {
            if (semEfeito.resposta.id === deste.semEfeitoDesistidoId) {
              // 06-21 (crm2:WR-05 residual, 06-REVIEW-3 WR-01) — já desisti
              // desta resposta: não tenta `comentar()` de novo, não gasta
              // orçamento, não repete o log a cada ciclo. Local à resposta:
              // `estado.parada` nunca é tocado aqui.
            } else {
              // É uma resposta nova (outro id) ou ainda não desistida: o
              // contador é dela, não de `comentar()` em geral (que qualquer
              // Comentário desta conta compartilha).
              if (deste.semEfeitoTentativaId !== semEfeito.resposta.id) {
                deste.semEfeitoTentativaId = semEfeito.resposta.id;
                deste.tentativasSemEfeito = 0;
              }
              if ((deste.tentativasSemEfeito ?? 0) >= TENTATIVAS_TRANSITORIAS) {
                // Já são `TENTATIVAS_TRANSITORIAS` falhas SEGUIDAS para esta
                // resposta: desisto ANTES de tentar de novo — sem gravação
                // nova, sem gastar orçamento. `estado.parada` nunca é tocado.
                deste.semEfeitoDesistidoId = semEfeito.resposta.id;
                registrar("info", "Não consegui responder ao Comentário sem efeito nesta resposta; parei de tentar só para ela.", {
                  ...daConta,
                  code: "SEM_EFEITO_DESISTIDO",
                });
              } else {
                const gravou = await comentar(semEfeito.texto, pendente.origin.threadCommentId);
                // Falhando, não fica pendente em memória: o fio é a memória, e o
                // ciclo seguinte pergunta de novo ao domínio.
                if (deste.comentarioPendente === semEfeito.texto) delete deste.comentarioPendente;
                if (gravou) {
                  delete deste.tentativasSemEfeito;
                  delete deste.semEfeitoTentativaId;
                  delete deste.semEfeitoDesistidoId;
                  registrar("info", "Resposta no fio sem efeito: a ponte respondeu por quê.", { ...daConta, code: "RESPOSTA_SEM_EFEITO" });
                } else {
                  deste.tentativasSemEfeito = (deste.tentativasSemEfeito ?? 0) + 1;
                }
              }
            }
          }
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

        /**
         * D6-04 `sem-conferencia` — a Conferência pendente de uma conta Manual
         * é dispensada pelo Membro de serviço, PELO DOMÍNIO
         * (`dispensarConferenciaDoResumo`, 06-18, crm2:CR-01), que confere
         * "Manual" no estado da gravação — nunca no `manual` do snapshot. Se a
         * conta deixou de ser "Manual" entre a leitura e a gravação, a
         * dispensa é adiada (`DISPENSA_ADIADA`), sem parada: o ciclo seguinte
         * relê e cai na leitura do fio.
         */
        async function dispensar(pendente: ConferenciaDoResumo): Promise<void> {
          const atorId = await atorDaEscrita();
          const r = await executarOperacao((s) => dispensarConferenciaDoResumo(s, atorId, pendente.id));
          if (!r.ok && !("conflito" in r && r.conflito) && r.error === TEXTOS_DA_CONFERENCIA.recusaDispensaSemManual) {
            estadoPorConta.delete(task.id);
            registrar("info", "Dispensa adiada: a conta deixou de ser Manual.", { ...daConta, code: "DISPENSA_ADIADA" });
          } else if (
            !r.ok &&
            !("conflito" in r && r.conflito) &&
            r.error === TEXTOS_DA_CONFERENCIA.recusaDispensaComRespostaPendente
          ) {
            // 06-21 (crm2:CR-01 residual, 06-REVIEW-3 Crítico): a corrida entre
            // a leitura do fio (sem resposta pendente no snapshot) e a
            // gravação (uma resposta chegou antes da operação rodar) — o
            // domínio recusou dentro da transação. Adiada, nunca recusa: o
            // ciclo seguinte relê e cai em `lerRespostas`.
            estadoPorConta.delete(task.id);
            registrar("info", "Dispensa adiada: uma resposta chegou no fio antes da gravação.", { ...daConta, code: "DISPENSA_ADIADA_RESPOSTA_PENDENTE" });
          } else if (!r.ok && !("conflito" in r && r.conflito)) {
            deste.parada = "recusa";
            // crm:WR-11 — o código, nunca `r.error` (o domínio cita nomes).
            registrar("warn", "Não consegui dispensar a Conferência.", { ...daConta, code: "DISPENSA_RECUSADA_PELO_DOMINIO" });
          }
        }

        /** Momento 1 (Fluxo 5, e a revisão do Fluxo 6) — UM `/resolver` e UM Resumo publicado. */
        async function momentoDoResumo(): Promise<void> {
          const base = corpoResolverDe(state, task);
          if (!base) {
            await parar("recusa", TEXTO_SEM_CENTRO_DE_CUSTO, "falta Centro de Custo.", "publicaria");
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
            // 06-18 (crm2:CR-01): a Integração manual do estado da GRAVAÇÃO.
            // Mudou desde a leitura do ciclo ⇒ adia, como a impressão (sem
            // parada): a dispensa nunca sai sobre um "Manual" que já não é.
            const manualAgora = fresca ? valorDoCampo(fresca, CP.fields.integracaoManual) === "Manual" : manual;
            adiado =
              !fresca ||
              !agora ||
              agora.impressaoAtual !== conf.impressaoAtual ||
              manualAgora !== manual ||
              (conf.estado === "ajuste-pedido" && (agora.conferencia?.id !== conf.conferencia?.id || agora.conferencia?.decision !== "rejeitada"));
            // crm2:IN-02 — nada a gravar: a recusa sentinela desfaz sem subir a revisão.
            if (adiado || !fresca) return semEfeito();
            // crm:WR-03 — um Resumo sem código de Categoria não se aprova (o
            // domínio recusa), então também não se dispensa (D6-04): sai como
            // Conferência normal, e a resposta no fio diz como seguir.
            const previa = buildResumoDePagamento(s, fresca, dePara);
            const semCodigo = lancamentoSemCodigo({ codigo: previa.codigo, veredito: previa.veredito });
            const dispensa = manualAgora && !semCodigo;
            const publicado = publicarResumoParaConferencia(s, atorId, task.id, {
              dePara,
              // crm2:WR-03 — sem decisão por comentário, nenhum texto pede "ok".
              aprovacaoPorComentario: decisoes.conferenciaPorComentario,
              impressaoEsperada: conf.impressaoAtual,
              ...(conf.estado === "ajuste-pedido" && conf.conferencia ? { conferenciaRejeitadaId: conf.conferencia.id } : {}),
              ...(pedido ? { pedidoDeRevisao: pedido } : {}),
              ...(conf.estado === "desatualizada" ? { motivo: "dados-mudaram" as const } : {}),
              // Na dispensa (D6-04), o aprovador é o próprio Membro de serviço —
              // é ele quem decide logo abaixo, e nenhuma pessoa é chamada a conferir.
              ...(dispensa ? { avisarId: atorId } : avisar ? { avisarId: avisar } : {}),
              // crm2:WR-04 (06-19) — a porta G3 falha FECHADA também no meio
              // do ciclo: com o Membro de teste inativo, o domínio recusa em
              // vez de fazer a Maryane aprovadora.
              ...(dispensa || avisar ? { avisarEstrito: true as const } : {}),
            });
            if (!publicado.ok) return publicado;
            if (semCodigo) {
              // 06-21 (crm2:IN-02) — a checagem de `avisar`/`membroAtivo` saiu
              // daqui: código morto. `publicarResumoParaConferencia` (acima)
              // já recebeu `avisarEstrito: true` sempre que há `avisar`, e
              // `publicado.ok` já seria `false` se ele estivesse inativo — a
              // mesma `s`, síncrono, sem mudança de estado entre as duas.
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
            return dispensarConferenciaDoResumo(s, atorId, publicado.value.conferencia.id);
          });
          if (foiSemEfeito(r) && adiado) {
            estadoPorConta.delete(task.id);
            registrar("info", "Resumo adiado: a conta mudou depois da leitura do ciclo.", { ...daConta, code: "RESUMO_ADIADO" });
          } else if (r.ok) {
            registrar("info", dispensou ? "Resumo publicado com a Conferência dispensada (Integração manual)." : "Resumo publicado para conferência.", daConta);
          } else if ("conflito" in r && r.conflito) {
            await falhaTransitoria("CONFLITO_DE_REVISAO", "publicaria");
          } else if (ehRecusaDaPorta(r)) {
            // Nada é parado na conta: o ciclo seguinte decide pela porta do começo.
            portaFechada();
          } else {
            deste.parada = "recusa";
            // crm:WR-11 — o código, nunca `r.error` (o domínio cita nomes).
            registrar("warn", "Não consegui publicar o Resumo.", { ...daConta, code: "RESUMO_RECUSADO_PELO_DOMINIO" });
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
          const criterio = {
            listId,
            ...(soTitulosCom ? { soTitulosCom } : {}),
            ...(opcoes.avisarId ? { avisarId: opcoes.avisarId } : {}),
            integracaoManual: decisoes.integracaoManual,
          };
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
          } catch (erro) {
            // 06-13 — erro de BANCO na releitura é do ciclo, não do Omie: sobe
            // para o laço, que para e agenda a recuperação. O resto segue a
            // regra de 06-12 (transitória, código fixo).
            if (codigoDaFalhaDoCiclo(erro).deBanco) throw erro;
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
            await parar("recusa", TEXTO_VALOR_INVALIDO, "Valor inválido.", "lançaria");
            return;
          }
          // A impressão da conta de onde o corpo saiu — a marca confere contra ela.
          const impressaoDoCorpo = impressaoDeLancamento(fresco, atual);
          const codigoAtual = confAtual.origin.lancamento.codigo;
          // As URLs valem 5 min: geradas agora, logo antes do `/lancar`. Só a contagem vai ao log.
          const { anexos, avisos, acimaDoLimite = 0 } = await anexosDaConta(fresco, atual, opcoes.assinarAnexo);
          if (avisos.length > 0 || acimaDoLimite > 0) {
            registrar("warn", "Anexos da conta que não vão ao Omie.", { ...daConta, anexos: anexos.length, avisos: avisos.length, anexosAcimaDoLimite: acimaDoLimite });
          }
          // v1.2 (crm:WR-09): `contaConfirmada` é a conta que o Financeiro
          // conferiu; o `automation/` recusa (`CONTA_DIVERGENTE`) se a conta
          // corrente que ele resolveria agora for outra.
          const corpo = {
            ...corpoLancar,
            codigoCategoriaConfirmado: codigoAtual,
            contaConfirmada: confAtual.origin.lancamento.conta,
            ...(anexos.length > 0 ? { anexos } : {}),
          };
          // (5) crm2:WR-01 (06-19) — a marca "Lançamento no Omie em curso",
          // numa Unidade de Trabalho IMEDIATAMENTE antes do `/lancar`, que
          // pergunta de novo sobre o estado DA GRAVAÇÃO: a impressão é a do
          // corpo (senão `IMPRESSAO_MUDOU`) e `motivoParaNaoLancar` não tem
          // nada a opor. A releitura de 06-12 monta o corpo; esta é a
          // reconferência atômica. Com a marca, ninguém mais move a conta nem
          // registra o lançamento à mão até o registro, a falha, o
          // encerramento ou o prazo (`PRAZO_DO_LANCAMENTO_EM_CURSO_MS`).
          const atorId = await atorDaEscrita();
          let adiadoNaMarca: CodigoDeAdiamento | "IMPRESSAO_MUDOU" | undefined;
          const marca = await executarOperacao((s) => {
            const naGravacao = s.tasks.find((t) => t.id === task.id);
            adiadoNaMarca =
              naGravacao && impressaoDeLancamento(s, naGravacao) !== impressaoDoCorpo
                ? "IMPRESSAO_MUDOU"
                : motivoParaNaoLancar(s, task.id, conferida.id, criterio);
            if (adiadoNaMarca) return semEfeito();
            return marcarLancamentoEmCurso(s, atorId, task.id);
          });
          if (!marca.ok) {
            if ("conflito" in marca && marca.conflito) await falhaTransitoria("CONFLITO_DE_REVISAO", "lançaria");
            else if (foiSemEfeito(marca)) {
              estadoPorConta.delete(task.id);
              registrar("info", "Lançamento adiado: a conta mudou antes da marca.", { ...daConta, code: adiadoNaMarca ?? "CONTA_SUMIU" });
            } else {
              deste.parada = "recusa";
              // T-3-04: o código, nunca `marca.error`.
              registrar("warn", "O domínio recusou a marca de lançamento em curso; nada foi lançado.", { ...daConta, code: "MARCA_RECUSADA_PELO_DOMINIO" });
            }
            return;
          }

          /**
           * Tira a marca quando a ponte desiste do `/lancar` sem registro nem
           * falha permanente registrada. A falha só vai ao log: o prazo cobre.
           */
          const encerrar = async (code: string): Promise<void> => {
            const r = await executarOperacao((s) => encerrarLancamentoEmCurso(s, atorId, task.id, code));
            if (!r.ok) registrar("warn", "Não consegui encerrar a marca de lançamento em curso; o prazo a encerra.", { ...daConta, code: "MARCA_NAO_ENCERRADA" });
          };

          // (6)
          const resposta = await chamar(CAMINHO_LANCAR, corpo, { timeoutMs: timeoutLancarMs, idempotencyKey: chaveDeIdempotencia(task.id) });
          if (!resposta.ok) {
            // A falha permanente registrada encerra a marca pelo domínio
            // ("Lançamento no Omie falhou"); a recusa dela, em `falhaPermanente`.
            if (resposta.permanente) await falhaPermanente(resposta.motivo, resposta.code, resposta.detalhes);
            else {
              await encerrar(resposta.code);
              await falhaTransitoria(resposta.code, "lançaria");
            }
            return;
          }
          const devolvido = resposta.corpo as { readonly payableId?: unknown; readonly reaproveitado?: unknown } | undefined;
          const payableId = devolvido?.payableId;
          // T-3-37 — `mock-payable-<timestamp>` (credencial Omie vazia) não é
          // lançamento: registrar seria mentir. `reaproveitado: true`
          // (consulta-antes-de-incluir) É sucesso.
          if (typeof payableId !== "string" || payableId.length === 0 || payableId.startsWith("mock-")) {
            await encerrar("LANCAMENTO_NAO_CONFIRMADO");
            await parar("recusa", TEXTO_LANCAMENTO_NAO_CONFIRMADO, "lançamento não confirmado (payableId ausente ou mock).", "lançaria");
            return;
          }
          // crm2:WR-02 (06-18) — o título reaproveitado só vira o lançamento
          // desta Conferência se o Omie mostra a conta e o código conferidos
          // (o `dePara` lido do título, contra a Conferência relida). Senão,
          // falha permanente sem registro: a conta volta para "para pagar" e
          // a Conferência fica (como no 422 do mesmo nome). O log leva o id e
          // o código, nunca o `dePara` nem os valores (T-3-04).
          if (devolvido?.reaproveitado === true) {
            const divergencia = conferenciaDoReaproveitado(fresco, atual, confAtual, resposta.corpo);
            if (divergencia) {
              registrar("warn", "Título reaproveitado que não confere com a Conferência; nada registrado.", { ...daConta, payableId, code: divergencia.code });
              if (divergencia.code === "TITULO_EXISTENTE_DIVERGENTE") {
                await falhaPermanente(undefined, "TITULO_EXISTENTE_DIVERGENTE", { payableId, campos: divergencia.campos });
              } else {
                await falhaPermanente(motivoDoReaproveitadoSemDePara(payableId), "REAPROVEITADO_SEM_DE_PARA");
              }
              return;
            }
          }
          // v1.2 — os anexos pelo status real, casados pelo nome com o que foi
          // ENVIADO; `anexosPedidos` é o número enviado (≤ 20), para que a
          // confirmação nunca diga "sem anexos" quando havia anexos (crm:IN-03).
          const lidos = anexosDaResposta(resposta.corpo, anexos);
          const resultado = { payableId, reaproveitado: devolvido?.reaproveitado === true, anexos: lidos.itens, anexosPedidos: anexos.length };
          let saiuAntes = false;
          const r = await executarOperacao((s) => {
            const naHora = s.tasks.find((t) => t.id === task.id);
            saiuAntes = !naHora || naHora.statusId !== CP.status.emLancamento;
            // crm2:IN-02 — nada a gravar: a recusa sentinela desfaz sem subir a revisão.
            if (saiuAntes) return semEfeito();
            return registrarLancamentoNoOmie(s, atorId, task.id, resultado);
          });
          if (foiSemEfeito(r) && saiuAntes) {
            // A conta saiu de "em lançamento omie" durante o `/lancar` por um
            // caminho que a marca não cobre (fora do domínio, ou a marca
            // vencida): o título existe no Omie, mas nada foi registrado
            // aqui. Se ela voltar para "em lançamento omie", a mesma chave só
            // reaproveita o título se ele tiver os dados do pedido (06-08,
            // `TITULO_EXISTENTE_DIVERGENTE`).
            estadoPorConta.delete(task.id);
            registrar("warn", 'Lançada no Omie, mas a conta saiu de "em lançamento omie" antes do registro; nada foi gravado.', { ...daConta, payableId });
            await comentar(TEXTO_SAIU_ANTES_DO_REGISTRO);
            await encerrar("SAIU_ANTES_DO_REGISTRO");
          } else if (r.ok) {
            estadoPorConta.delete(task.id);
            registrar("info", 'Conta lançada no Omie e movida para "lançado omie".', {
              ...daConta,
              anexos: resultado.anexos.length,
              ...(lidos.semPar > 0 ? { anexosSemPar: lidos.semPar } : {}),
              ...(acimaDoLimite > 0 ? { anexosAcimaDoLimite: acimaDoLimite } : {}),
            });
            // Um Comentário à parte, fora da operação do registro: se ele
            // falhar, o lançamento registrado não volta atrás.
            if (acimaDoLimite > 0) await comentar(textoDosAnexosAcimaDoLimite(acimaDoLimite), confAtual.origin.threadCommentId);
          } else if ("conflito" in r && r.conflito) {
            // Outra escrita entrou no meio: o próximo ciclo repete com a MESMA
            // chave, e o Omie devolve o mesmo título (`reaproveitado`). A
            // marca FICA enquanto a repetição vier — o título existe, e é
            // exatamente esse intervalo que ela protege (e vence no prazo). Só
            // a falha que vira parada a encerra.
            registrar("warn", "Lançada no Omie, mas a gravação conflitou; tento de novo no próximo ciclo.", { ...daConta, payableId, code: "CONFLITO_DE_REVISAO" });
            if (deste.transitorias + 1 >= TENTATIVAS_TRANSITORIAS) await encerrar("CONFLITO_DE_REVISAO");
            await falhaTransitoria("CONFLITO_DE_REVISAO", "lançaria", textoDoRegistroEmConflito(payableId));
          } else {
            // T-3-04: o log leva o id do título e o código, nunca `r.error`.
            registrar("warn", "Lançada no Omie, mas não consegui registrar o lançamento.", { ...daConta, payableId, code: "REGISTRO_RECUSADO_PELO_DOMINIO" });
            await encerrar("REGISTRO_RECUSADO_PELO_DOMINIO");
            await parar("recusa", textoDoRegistroRecusado(payableId, r.error), "lançada, mas sem registro.", "lançaria");
          }
        }

        /**
         * D6-03 — falha permanente do `/lancar`: o domínio comenta o motivo e
         * volta a conta para "para pagar". Os dois 422 v1.2 (06-12) levam o
         * texto do domínio (`motivoDosDetalhes`); `CONTA_DIVERGENTE` também
         * supera a Conferência aprovada — ela afirmou uma conta corrente que o
         * Omie não usaria mais, e o ciclo seguinte publica um Resumo novo com a
         * conta de agora. `TITULO_EXISTENTE_DIVERGENTE` não supera: o que está
         * errado é o título no Omie, e o caminho é corrigi-lo ou excluí-lo lá e
         * mover a conta de novo.
         */
        async function falhaPermanente(motivo: string | undefined, code: string, detalhes?: unknown): Promise<void> {
          deste.parada = "recusa";
          const atorId = await atorDaEscrita();
          const texto = motivoDosDetalhes(code, detalhes) ?? motivo;
          const opcoesDaFalha = {
            // crm2:WR-04 (06-19) — com o Membro de teste inativo, recusa em vez de mencionar a Maryane.
            ...(avisar ? { avisarId: avisar, avisarEstrito: true as const } : {}),
            ...(code === "CONTA_DIVERGENTE" ? { superarConferencia: true as const } : {}),
          };
          const r = await executarOperacao((s) =>
            registrarFalhaDoLancamento(s, atorId, task.id, { motivo: texto ?? "o Financeiro recusou a chamada", code }, opcoesDaFalha),
          );
          if (r.ok) registrar("info", 'Lançamento recusado; a conta voltou para "para pagar".', { ...daConta, code });
          else {
            if (ehRecusaDaPorta(r)) portaFechada();
            else registrar("warn", "Não consegui registrar a falha do lançamento; aviso por Comentário.", { ...daConta, code });
            // crm2:WR-01 — sem o Registro "Lançamento no Omie falhou", a marca
            // sai pelo encerramento (só chega aqui depois dela, no `/lancar`).
            const fim = await executarOperacao((s) => encerrarLancamentoEmCurso(s, atorId, task.id, code));
            if (!fim.ok) registrar("warn", "Não consegui encerrar a marca de lançamento em curso; o prazo a encerra.", { ...daConta, code: "MARCA_NAO_ENCERRADA" });
            await comentar(textoDaRecusaPermanente(texto, code));
          }
        }
      } catch (erro) {
        // 06-13 — erro de banco: o laço PARA (não martelar o banco que está
        // sofrendo) e a recuperação é agendada. Nada de Comentário, e a
        // contagem de transitórias do Omie não sobe. O resto sobe como antes.
        if (falhaDeBancoNoCiclo(erro, task.id)) return true;
        throw erro;
      }
    }

    // O laço chegou ao fim: o próximo começa do início (06-19, crm2:WR-05).
    cursor = undefined;
    // G1 — só o ciclo que terminou o laço conhece a contagem inteira.
    if (importadasForaDaPonte !== ultimaContagemDeImportadas) {
      ultimaContagemDeImportadas = importadasForaDaPonte;
      registrar("info", "Contas importadas sem movimento depois da importação ficam fora da ponte.", { workspaceId, listId, contas: importadasForaDaPonte });
    }
    return false;
  }

  /** Um ciclo, com a medição. Só `processarContas` o chama (single-flight). */
  async function cicloDasContas(): Promise<void> {
    medida = { hidratacoes: 0, gravacoes: 0, conflitos: 0, requisicoes: 0 };
    const inicio = Date.now();
    let parouPorBanco: boolean;
    try {
      parouPorBanco = await percorrerContas();
    } finally {
      const ms = Date.now() - inicio;
      if (ms > limiarDoCicloLentoMs) registrar("info", "Ciclo da ponte demorou.", { workspaceId, listId, ms, ...medida });
    }
    // O primeiro ciclo que termina sem falha de banco zera o recuo.
    if (!parouPorBanco) proximoAtrasoDeRecuperacao = atrasoDeRecuperacaoMs;
  }

  let temporizador: ReturnType<typeof setInterval> | undefined;
  let emVoo: Promise<void> | undefined;
  let cutucada: ReturnType<typeof setTimeout> | undefined;
  let recuperacao: ReturnType<typeof setTimeout> | undefined;
  let proximoAtrasoDeRecuperacao = atrasoDeRecuperacaoMs;
  let repetir = false;
  let parado = false;

  /**
   * 06-13 (F1, H2) — o guarda do single-flight. Com um ciclo em voo, devolve
   * a MESMA promessa: relógio, cutucada e chamada direta nunca rodam dois
   * ciclos ao mesmo tempo (duas pontes no mesmo processo leriam e gravariam
   * o mesmo Espaço em paralelo, e disputariam a revisão uma com a outra).
   * Um ciclo que começa torna desnecessária a recuperação agendada.
   */
  function processarContas(): Promise<void> {
    if (emVoo) return emVoo;
    if (recuperacao) clearTimeout(recuperacao);
    recuperacao = undefined;
    const voo = cicloDasContas().finally(() => {
      emVoo = undefined;
      // 06-19 (crm2:WR-05) — a continuação do orçamento esgotado espera
      // `atrasoDaCutucadaMs`, pelo MESMO temporizador da cutucada (que
      // `parar()` cancela). Uma cutucada de fora, pedida durante o ciclo,
      // continua valendo como `repetir`.
      if (continuar) {
        continuar = false;
        if (!repetir && !parado) cutucar();
      }
      if (repetir && !parado) {
        repetir = false;
        ciclo();
      }
    });
    emVoo = voo;
    return voo;
  }

  /** O ciclo do relógio, da cutucada e da recuperação: nunca lança; a exceção vira só um código no log (crm:WR-11). */
  function ciclo(): void {
    if (parado || emVoo) return;
    processarContas().catch((erro: unknown) => {
      registrar("warn", "Falha no ciclo do Agente de lançamento.", { workspaceId, listId, code: codigoDaFalhaDoCiclo(erro).code });
    });
  }

  /**
   * 06-13 (F3) — UM ciclo de recuperação depois de uma falha de banco: o
   * atraso dobra a cada falha seguida, até o teto; se já houver um ciclo em
   * voo quando ele disparar, vira `repetir`. Devolve o atraso agendado (vai
   * ao log), ou `undefined` com a ponte parada.
   */
  function agendarRecuperacao(): number | undefined {
    if (parado) return undefined;
    if (recuperacao) clearTimeout(recuperacao);
    const atraso = proximoAtrasoDeRecuperacao;
    proximoAtrasoDeRecuperacao = Math.min(atraso * 2, atrasoMaximoDeRecuperacaoMs);
    recuperacao = setTimeout(() => {
      recuperacao = undefined;
      if (emVoo) repetir = true;
      else ciclo();
    }, atraso);
    return atraso;
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
      if (recuperacao) clearTimeout(recuperacao);
      recuperacao = undefined;
      repetir = false;
      while (emVoo) await emVoo.catch(() => undefined);
    },
  };
}
