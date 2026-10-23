/**
 * Instrumentação do servidor do Next 16 (D-13, SEG-10).
 *
 * `register()` roda uma vez por instância, antes de o servidor atender. Só o
 * ramo `nodejs` inicia o SDK: o `proxy.ts` do Next 16 roda em Node.js e esta
 * aplicação não tem rota em runtime `edge`, então não há ramo `edge` a
 * instrumentar.
 *
 * Sem `SENTRY_DSN` o SDK nem é iniciado e a web roda como sempre rodou: iniciar
 * sem DSN não enviaria nada, mas ainda instalaria a instrumentação do Node
 * (OpenTelemetry) à toa. O que sai do servidor passa por `limparEvento`
 * (`features/observabilidade`): sem cabeçalho, corpo, cookie, query nem o
 * segredo de `/f/` e `/p/`.
 *
 * `onRequestError` entrega ao Sentry o erro que o Next captura no servidor
 * (Server Components, Route Handlers, Server Actions, Proxy). Sem SDK iniciado
 * é um no-op.
 */

import * as Sentry from "@sentry/nextjs";
import { opcoesDoSentryNaWeb } from "@/features/observabilidade/limpar-evento";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return;
  Sentry.init(opcoesDoSentryNaWeb(dsn));
}

export const onRequestError = Sentry.captureRequestError;
