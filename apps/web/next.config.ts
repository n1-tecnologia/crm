import type { NextConfig } from "next";
// `@sentry/nextjs/config` e não `@sentry/nextjs`: na 10.76 o `withSentryConfig` do
// pacote raiz está deprecado e avisa no build; o subcaminho é o mesmo código, calado.
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  /**
   * `@n1/dominio` é publicado como TypeScript cru, sem etapa de build: o
   * bundler compila a fonte junto com o app. O Turbopack já faz isso sozinho
   * para pacotes do workspace; a lista deixa explícito e cobre o webpack.
   */
  transpilePackages: ["@n1/dominio"],

  /**
   * O Next 16 recusa os recursos de desenvolvimento — inclusive o WebSocket de
   * HMR — quando a origem não está nesta lista, e sem HMR a árvore cliente não
   * hidrata: a interface fica de pé e não responde a clique nenhum.
   *
   * `localhost` já vale por padrão; estes dois são para abrir pelo IP da
   * máquina ou de outro aparelho na mesma rede.
   */
  allowedDevOrigins: ["127.0.0.1", "172.16.0.127"],
  /** Ferramentas saiu do CRM e virou assunto próprio: a rota antiga redireciona, com as subrotas. */
  async redirects() {
    return [
      { source: "/crm/ferramentas", destination: "/ferramentas/grupos", permanent: true },
      { source: "/crm/ferramentas/:caminho*", destination: "/ferramentas/:caminho*", permanent: true },
    ];
  },
};

/**
 * Sentry (D-13, SEG-10). O build NÃO fala com a rede nem precisa de token: sem
 * telemetria do plugin, sem envio de source maps, sem criação de release. Ligar
 * source maps é outro passo, com `SENTRY_AUTH_TOKEN` configurado na Vercel.
 *
 * Bundle mínimo: só erros, então os trechos de depuração e de tracing do SDK
 * saem do pacote, e o de Session Replay também (nunca o ligamos).
 */
export default withSentryConfig(nextConfig, {
  telemetry: false,
  silent: true,
  sourcemaps: { disable: true },
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
    excludeTracing: true,
    excludeReplayShadowDom: true,
    excludeReplayIframe: true,
    excludeReplayWorker: true,
  },
});
