/**
 * Instrumentação do navegador (D-13, SEG-10). O Next a executa depois do HTML e
 * antes da hidratação, então o `Sentry.init` precisa ser síncrono e de topo.
 *
 * Só erros: sem tracing, sem `replayIntegration`, sem `onRouterTransitionStart`
 * (que só serve a navegação com tracing). `NEXT_PUBLIC_SENTRY_DSN` é lido em
 * tempo de build; vazio, o SDK nem é iniciado. Tudo que sai passa por
 * `limparEvento`/`limparMigalha`: o `Referer`, a URL de `/f/` e `/p/` e a query
 * não vão ao Sentry.
 */

import * as Sentry from "@sentry/nextjs";
import { opcoesDoSentryNaWeb } from "@/features/observabilidade/limpar-evento";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();

if (dsn) Sentry.init(opcoesDoSentryNaWeb(dsn));
