/**
 * Suporte compartilhado por `dois-servicos.test.ts` e `falhas-injetadas.test.ts`
 * (Plan 02-26) — deliberadamente FORA do padrão `*.test.ts`.
 *
 * Achado real desta execução: um `*.test.ts` que faz `import` de OUTRO
 * `*.test.ts` faz o Vitest avaliar o módulo importado no MESMO contexto de
 * coleta de testes do arquivo que importa — os `describe()`/`it()` de nível
 * de módulo do arquivo importado voltam a rodar, AGORA TAMBÉM dentro da
 * execução do arquivo que importa (confirmado empiricamente: `vitest run
 * src/e2e/falhas-injetadas.test.ts` chegou a listar a suíte inteira de
 * `dois-servicos.test.ts` nos resultados, com dois Fastify + dois Express
 * reais disputando o mesmo Postgres ao mesmo tempo — falhas cruzadas que não
 * existem quando cada arquivo roda sozinho). A correção é esta: o que os dois
 * arquivos de teste precisam um do outro fica num módulo `.ts` comum, nunca
 * `.test.ts` — `apps/api/vitest.config.mts` só trata `src/**\/*.test.ts` como
 * ponto de entrada de suíte, então importar ESTE arquivo nunca reexecuta nada.
 *
 * Nunca instancia `PaymentAutomationService` real (fala com o Supabase de
 * PRODUÇÃO do `financeiro-tria` e com o Omie real, por baixo de várias
 * camadas — exatamente o que esta execução proíbe). `criarServicoFalso()`
 * implementa só os DOIS métodos que os webhooks chamam de fato
 * (`syncAndAssignResponsible`, `handlePlatformApprovalDecision`), cada um
 * chamando o adapter REAL (`criarPlataformaAdapter`, HTTP de verdade) — a
 * mesma peça de produção, só o serviço em volta dela é falso.
 *
 * Import cross-repo por especificador NÃO LITERAL (`importarAutomation`,
 * abaixo): com uma string literal, o TypeScript tentaria resolver e tipar o
 * módulo do outro repositório no `npm run typecheck -w @n1/api` — e falharia
 * duro em qualquer ambiente sem `../financeiro-tria` clonado ao lado. Uma
 * especificador CALCULADO (não literal) faz o TypeScript tratar o retorno
 * como `unknown`/`any`, sem tentar resolver o módulo em tempo de compilação;
 * as formas usadas pelos dois arquivos de teste são redeclaradas localmente
 * (`PaymentServiceFalso`, `ClienteDeReceiptsFalso` etc.), só com o que de
 * fato se consome.
 */

import { existsSync } from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { carregarEnv } from "../persistencia/conexao";

carregarEnv();
export const temBanco = Boolean(process.env.DATABASE_URL);

// ── Caminho do repositório irmão — sempre por import DINÂMICO e não-literal ──

export const AQUI = fileURLToPath(new URL(".", import.meta.url));
export const RAIZ_MONOREPO = path.resolve(AQUI, "../../../../");
export const FINANCEIRO_TRIA_DIR = process.env.FINANCEIRO_TRIA_DIR
  ? path.resolve(RAIZ_MONOREPO, process.env.FINANCEIRO_TRIA_DIR)
  : path.resolve(RAIZ_MONOREPO, "..", "financeiro-tria");
export const AUTOMATION_SRC_DIR = path.join(FINANCEIRO_TRIA_DIR, "automation", "src");
export const temFinanceiroTria = existsSync(AUTOMATION_SRC_DIR);

/**
 * `caminho` é relativo a `automation/src/` (ex.: `"http/webhooks-plataforma"`).
 * O especificador final é montado por `path.join`/`pathToFileURL` — uma
 * VARIÁVEL, nunca uma string literal na chamada de `import()` — para o
 * TypeScript nunca tentar resolver este módulo estaticamente (ver cabeçalho).
 */
export async function importarAutomation<T = unknown>(caminho: string): Promise<T> {
  const absoluto = path.join(AUTOMATION_SRC_DIR, `${caminho}.ts`);
  const especificador = pathToFileURL(absoluto).href;
  return (await import(especificador)) as T;
}

// ── Formas mínimas do lado `automation/` — redeclaradas aqui, nunca importadas
// estaticamente (ver cabeçalho). Espelham exatamente o que os dois arquivos
// de teste consomem de `../http/routes.ts` (`PaymentService`) e
// `../http/webhooks-plataforma.ts` (`DepsWebhooksDaPlataforma`/`ClienteDeReceipts`)
// do repositório irmão.

export interface PaymentServiceFalso {
  syncAndAssignResponsible(taskId: string): Promise<unknown>;
  reviseSummary(input: unknown): Promise<unknown>;
  syncAndAnalyzeComment(...args: unknown[]): Promise<unknown>;
  processManualPayment(taskId: string): Promise<unknown>;
  launchFromStatusChange(taskId: string): Promise<unknown>;
  syncPaymentRequestFromClickUp(taskId: string): Promise<unknown>;
  approveRun(...args: unknown[]): Promise<unknown>;
  requestReview(...args: unknown[]): Promise<unknown>;
  retryRun(...args: unknown[]): Promise<unknown>;
  cancelRun(...args: unknown[]): Promise<unknown>;
  syncAllPaymentRequestsFromClickUp(): Promise<unknown>;
  handlePlatformApprovalDecision(taskId: string, decision: "aprovada" | "rejeitada", decidedByMemberId: string): Promise<unknown>;
}

interface ResultadoDeConsulta {
  readonly data: Array<Record<string, unknown>> | null;
  readonly error: { readonly code?: string; readonly message: string } | null;
}
interface FiltroDeAtualizacao {
  eq(coluna: string, valor: unknown): FiltroDeAtualizacao;
  select(colunas: string): Promise<ResultadoDeConsulta>;
}
export interface ClienteDeReceiptsFalso {
  from(tabela: string): {
    upsert(linha: Record<string, unknown>, opcoes: { readonly onConflict: string; readonly ignoreDuplicates?: boolean }): {
      select(colunas: string): Promise<ResultadoDeConsulta>;
    };
    select(colunas: string): { eq(coluna: string, valor: unknown): Promise<ResultadoDeConsulta> };
    update(patch: Record<string, unknown>): { eq(coluna: string, valor: unknown): FiltroDeAtualizacao };
  };
}

interface LinhaReceiptFalsa {
  readonly event_id: string;
  readonly event_type: string;
  status: string;
  attempts: number;
}

/**
 * Fake em memória de `ClienteDeReceipts` (`webhooks-plataforma.ts`) — nunca o
 * Supabase real do `financeiro-tria` (hard limit 1). Implementa exatamente
 * os três métodos que `reivindicarReceipt`/`fecharReceipt`
 * (`receipts-da-plataforma.ts`) chamam: `upsert(...).select()`,
 * `select().eq()`, `update(...).eq(...).{eq,select}()`.
 */
export function criarClienteDeReceiptsFalso(): { cliente: ClienteDeReceiptsFalso; linhas: Map<string, LinhaReceiptFalsa> } {
  const linhas = new Map<string, LinhaReceiptFalsa>();

  function filtroDeAtualizacao(patch: Record<string, unknown>, condicoes: Array<[string, unknown]>): FiltroDeAtualizacao {
    return {
      eq(coluna, valor) {
        return filtroDeAtualizacao(patch, [...condicoes, [coluna, valor]]);
      },
      async select() {
        const afetadas: LinhaReceiptFalsa[] = [];
        for (const linha of linhas.values()) {
          const bate = condicoes.every(([coluna, valor]) => (linha as unknown as Record<string, unknown>)[coluna] === valor);
          if (bate) {
            Object.assign(linha, patch);
            afetadas.push(linha);
          }
        }
        return { data: afetadas.map((l) => ({ event_id: l.event_id })), error: null };
      },
    };
  }

  const cliente: ClienteDeReceiptsFalso = {
    from() {
      return {
        upsert(linha) {
          return {
            async select() {
              const eventId = linha.event_id as string;
              if (linhas.has(eventId)) return { data: [], error: null };
              linhas.set(eventId, {
                event_id: eventId,
                event_type: linha.event_type as string,
                status: linha.status as string,
                attempts: 0,
              });
              return { data: [{ event_id: eventId }], error: null };
            },
          };
        },
        select() {
          return {
            async eq(coluna: string, valor: unknown) {
              if (coluna !== "event_id") return { data: [], error: null };
              const linha = linhas.get(valor as string);
              return { data: linha ? [{ status: linha.status, attempts: linha.attempts }] : [], error: null };
            },
          };
        },
        update(patch: Record<string, unknown>) {
          return {
            eq(coluna: string, valor: unknown) {
              return filtroDeAtualizacao(patch, [[coluna, valor]]);
            },
          };
        },
      };
    },
  };

  return { cliente, linhas };
}

export interface ChamadaRegistrada {
  readonly metodo: string;
  readonly args: readonly unknown[];
}

/**
 * O serviço FALSO — nunca `PaymentAutomationService` real (hard limit 1).
 * `syncAndAssignResponsible` e `handlePlatformApprovalDecision` são os DOIS
 * métodos que os três webhooks de `montarWebhooksDaPlataforma` de fato
 * chamam (ver `routes.ts#automationRouter`); os outros existem só para
 * satisfazer a forma estrutural de `PaymentService` e nunca são chamados
 * nesta jornada — chamá-los é erro de teste, não caminho esperado.
 */
export function criarServicoFalso(deps: {
  readonly adapter: {
    getTask(taskId: string): Promise<Record<string, unknown>>;
    createComment(
      taskId: string,
      text: string,
      options: { readonly parentCommentId?: string; readonly mentionMemberIds?: string[]; readonly idempotencyKey: string },
    ): Promise<{ readonly id: string }>;
    updateTaskStatus(taskId: string, status: string, options: { readonly idempotencyKey: string }): Promise<void>;
  };
  readonly aprovadorMemberId: string;
}): { servico: PaymentServiceFalso; chamadas: ChamadaRegistrada[] } {
  const chamadas: ChamadaRegistrada[] = [];
  const naoUsadoNestaJornada = (metodo: string) => async (...args: unknown[]) => {
    chamadas.push({ metodo, args });
    throw new Error(`${metodo} não é usado nesta jornada — chamá-lo é erro de teste, não caminho esperado.`);
  };

  const servico: PaymentServiceFalso = {
    async syncAndAssignResponsible(taskId: string) {
      chamadas.push({ metodo: "syncAndAssignResponsible", args: [taskId] });
      // 3 — getTask real (contrato v1), com downloadUrl assinada (quando houver anexo).
      const tarefa = await deps.adapter.getTask(taskId);
      // 4 — o comentário de roteamento, com Idempotency-Key derivada do passo lógico (D-20).
      const comentario = await deps.adapter.createComment(taskId, `Fulano, para aprovação`, {
        mentionMemberIds: [deps.aprovadorMemberId],
        idempotencyKey: `comment:${taskId}:routing`,
      });
      // e muda o Status para "em aprovação" — a escrita que guestStatusWriter (§9) autoriza.
      await deps.adapter.updateTaskStatus(taskId, "em aprovação", { idempotencyKey: `status:${taskId}:em-aprovacao` });
      return { taskId, tarefa, routingCommentId: comentario.id };
    },
    reviseSummary: naoUsadoNestaJornada("reviseSummary"),
    syncAndAnalyzeComment: naoUsadoNestaJornada("syncAndAnalyzeComment"),
    processManualPayment: naoUsadoNestaJornada("processManualPayment"),
    launchFromStatusChange: naoUsadoNestaJornada("launchFromStatusChange"),
    syncPaymentRequestFromClickUp: naoUsadoNestaJornada("syncPaymentRequestFromClickUp"),
    approveRun: naoUsadoNestaJornada("approveRun"),
    requestReview: naoUsadoNestaJornada("requestReview"),
    retryRun: naoUsadoNestaJornada("retryRun"),
    cancelRun: naoUsadoNestaJornada("cancelRun"),
    syncAllPaymentRequestsFromClickUp: naoUsadoNestaJornada("syncAllPaymentRequestsFromClickUp"),
    async handlePlatformApprovalDecision(taskId, decision, decidedByMemberId) {
      chamadas.push({ metodo: "handlePlatformApprovalDecision", args: [taskId, decision, decidedByMemberId] });
      return { taskId, decision, decidedByMemberId };
    },
  };

  return { servico, chamadas };
}

/**
 * `express` nunca é dependência de `@n1/api` (fora de `files_modified` — não
 * cabe acrescentar ao `package.json` deste workspace só para um harness de
 * teste). Resolvido do `node_modules` do PRÓPRIO `financeiro-tria/automation`
 * — o mesmo `express` que `montarWebhooksDaPlataforma` já importa por
 * dentro — por um especificador NÃO LITERAL (mesmo motivo do cabeçalho do
 * arquivo: nunca dar ao TypeScript uma string estática para resolver).
 */
async function importarExpress(): Promise<() => { use: (caminho: string, handler: unknown) => void }> {
  const caminho = path.join(FINANCEIRO_TRIA_DIR, "automation", "node_modules", "express", "index.js");
  const especificador = pathToFileURL(caminho).href;
  const modulo = (await import(especificador)) as { default: () => { use: (caminho: string, handler: unknown) => void } };
  return modulo.default;
}

/**
 * Sobe o Express do `automation/` de teste: `montarWebhooksDaPlataforma`
 * REAL, mesma peça de produção, montada em `/webhooks/plataforma` — o único
 * prefixo que `outbox-worker.ts` (`apps/api`) chama (`CAMINHO_POR_EVENTO`).
 * Nenhuma outra rota do `automation/` entra aqui: esta jornada só precisa
 * dos três webhooks do contrato v1 §8.
 */
export async function subirAutomationDeTeste(deps: {
  readonly servicos: Record<string, PaymentServiceFalso>;
  readonly supabase: ClienteDeReceiptsFalso;
  readonly tokenEsperado: string;
  readonly classificador?: (evento: unknown) => Promise<unknown>;
  /**
   * `resolverTenantDaTarefa` (`webhooks-plataforma.ts`) sempre busca a Tarefa de volta pela
   * credencial de serviço para ler `fields.company` (Plan 05-04, TEN-01) — sem injetar isto,
   * o módulo tenta montar o padrão real via `PLATAFORMA_BASE_URL`/`PLATAFORMA_SERVICE_TOKEN`
   * do ambiente, ausentes neste harness de teste.
   */
  readonly obterTarefa: (taskId: string) => Promise<{ readonly fields: { readonly company: string | null } }>;
}): Promise<{ url: string; fechar: () => Promise<void> }> {
  const { montarWebhooksDaPlataforma } = await importarAutomation<{
    montarWebhooksDaPlataforma: (deps: unknown) => unknown;
  }>("http/webhooks-plataforma");
  const express = await importarExpress();

  // Nenhum `express.json()` global montado — de propósito (nota de mount do
  // cabeçalho de `webhooks-plataforma.ts`, gap conhecido em `server.ts` de
  // produção): este harness prova a garantia "auth antes do parse" da forma
  // que produção DEVERIA montar, não replica o gap.
  const app = express();
  app.use(
    "/webhooks/plataforma",
    montarWebhooksDaPlataforma({
      servicos: deps.servicos,
      supabase: deps.supabase,
      tokenEsperado: deps.tokenEsperado,
      obterTarefa: deps.obterTarefa,
      ...(deps.classificador ? { classificador: deps.classificador } : {}),
    }),
  );

  const servidor = http.createServer(app as unknown as http.RequestListener);
  await new Promise<void>((resolve) => servidor.listen(0, resolve));
  const endereco = servidor.address() as AddressInfo;
  const url = `http://127.0.0.1:${endereco.port}`;
  const fechar = () => new Promise<void>((resolve, reject) => servidor.close((erro) => (erro ? reject(erro) : resolve())));

  return { url, fechar };
}
