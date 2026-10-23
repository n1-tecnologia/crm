/**
 * As opções do logger do Fastify (pino) com o segredo de link e os tokens
 * fora da linha (D-18, 1.5.1; T-09-25, T-09-26, T-09-27).
 *
 * Três proteções, nesta ordem de importância:
 *
 * 1. `serializers.req` troca o segredo da URL por `***` com
 *    `mascararSegredoDeUrl` — a regra mora no domínio porque o Sentry da api e
 *    o da web precisam da mesma (a api e a web não se conhecem). Sem isto a
 *    linha de entrada de `GET /v1/public/forms/<segredo>` grava o segredo.
 * 2. `redact` censura com "[oculto]" cabeçalhos de sessão (`authorization`,
 *    `cookie`) e qualquer campo `segredo`/`secret`/`token`/`senha` de um objeto
 *    logado. O pino só casa o curinga `*.token` um nível abaixo do topo, então
 *    cada campo também entra sem o curinga, para o objeto logado direto.
 * 3. `level` vem de `LOG_LEVEL` (padrão `info`).
 *
 * O nginx tem a sua própria máscara no `access_log` (Plan 09-06): o log do
 * Node e o do nginx são dois arquivos diferentes e os dois precisam dela.
 */

import { mascararSegredoDeUrl } from "@n1/dominio/url-segura";
import type { FastifyRequest } from "fastify";

const CAMPOS_SECRETOS = ["segredo", "secret", "token", "senha"] as const;

export const CAMINHOS_CENSURADOS: readonly string[] = [
  "req.headers.authorization",
  "req.headers.cookie",
  ...CAMPOS_SECRETOS.flatMap((campo) => [campo, `*.${campo}`]),
];

export function opcoesDoLogger(env: NodeJS.ProcessEnv = process.env, destino?: { write(linha: string): void }) {
  return {
    level: env.LOG_LEVEL?.trim() || "info",
    redact: { paths: [...CAMINHOS_CENSURADOS], censor: "[oculto]" },
    serializers: {
      // No Fastify 5 o serializador recebe a `FastifyRequest` (o `host` é a propriedade nova do `hostname`).
      req: (req: FastifyRequest) => ({
        method: req.method,
        url: mascararSegredoDeUrl(req.url ?? ""),
        host: req.host,
        remoteAddress: req.ip,
        remotePort: req.socket?.remotePort,
      }),
    },
    ...(destino ? { stream: destino } : {}),
  };
}
