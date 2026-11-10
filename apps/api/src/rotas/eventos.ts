/**
 * `GET /eventos` (16-07, 3.8.3, D-16-01, MSG-03): o fluxo SSE (`text/event-stream`) que leva à aba o que o hub recebe do
 * ouvinte `LISTEN`. Registrada na RAIZ do app, depois do hook de autenticação: herda o JWT de Membro (o `Authorization:
 * Bearer` que o `fetch` da tela manda; o `EventSource` não manda cabeçalho) e NÃO é pública.
 *
 * O fluxo é um `PassThrough` entregue por `reply.send(...)`: assim o Fastify aplica os cabeçalhos já definidos, inclusive
 * os do `@fastify/cors` (a resposta tomada à mão, pelo socket cru, perderia o `Access-Control-Allow-Origin` e o
 * navegador a recusaria). `X-Accel-Buffering: no` desliga o buffer do nginx da VM para esta resposta, e a batida
 * `: batida` a cada 25 s segura a conexão abaixo do `proxy_read_timeout` de 120 s.
 *
 * O JWT só é conferido ao abrir: por isso o fluxo fecha sozinho em 45 min (o JWT do Supabase vale cerca de 1 h; a aba
 * reconecta com a sessão renovada) e o hub reconfere o Papel a cada 60 s. Sem o ouvinte `LISTEN` de pé o hub fica
 * indisponível: 503 `TEMPO_REAL_INDISPONIVEL`, e a tela cai na releitura de 5 s.
 *
 * O que vai à aba é `{ tipo, conversaId, mensagemId? }` (ids e tipo): a tela busca o resto pelas rotas que já conferem
 * o acesso. Nada aqui loga o evento.
 */

import { PassThrough } from "node:stream";
import type { FastifyInstance } from "fastify";
import { BATIDA_DO_FLUXO_MS } from "@n1/dominio/crm/eventos";
import type { HubDeEventos } from "../mensageria/hub-de-eventos";

export interface OpcoesDeEventos {
  /** Sem hub a rota responde 503. `index.ts` o cria antes do `buildApp`. */
  readonly hub?: HubDeEventos;
  /** Padrão `BATIDA_DO_FLUXO_MS` (25 s, o contrato com a aba): o comentário `: batida` que segura a conexão atrás do proxy. */
  readonly batidaMs?: number;
  /** Padrão 45 min: o servidor fecha o fluxo e a aba reconecta com o token renovado. */
  readonly duracaoMaximaMs?: number;
}

const DURACAO_MAXIMA_PADRAO_MS = 45 * 60_000;

export async function rotasDeEventos(app: FastifyInstance, opcoes: OpcoesDeEventos): Promise<void> {
  const batidaMs = opcoes.batidaMs ?? BATIDA_DO_FLUXO_MS;
  const duracaoMaximaMs = opcoes.duracaoMaximaMs ?? DURACAO_MAXIMA_PADRAO_MS;

  app.get("/eventos", async (request, reply) => {
    const hub = opcoes.hub;
    if (!hub?.disponivel) {
      return reply.status(503).send({ ok: false, error: "O tempo real está indisponível agora.", codigo: "TEMPO_REAL_INDISPONIVEL" });
    }
    if (!(await hub.podeLer(request.membro))) {
      return reply.status(403).send({ ok: false, error: "Seu Papel não permite acompanhar as Conversas.", codigo: "PERMISSAO" });
    }
    // Entre a conferência acima e a assinatura o ouvinte pode ter caído.
    if (!hub.disponivel) {
      return reply.status(503).send({ ok: false, error: "O tempo real está indisponível agora.", codigo: "TEMPO_REAL_INDISPONIVEL" });
    }

    const fluxo = new PassThrough();
    reply
      .header("content-type", "text/event-stream; charset=utf-8")
      .header("cache-control", "no-cache, no-transform")
      .header("x-accel-buffering", "no");
    fluxo.write(": aberto\n\n");

    let sair: (() => void) | undefined;
    const batida = setInterval(() => fluxo.write(": batida\n\n"), batidaMs);
    const limite = setTimeout(() => encerrar(), duracaoMaximaMs);
    batida.unref();
    limite.unref();

    // Idempotente: o cliente que fecha, o hub que encerra e o limite de tempo chegam aqui, e o fluxo termina uma vez só.
    let encerrado = false;
    function encerrar(): void {
      if (encerrado) return;
      encerrado = true;
      clearInterval(batida);
      clearTimeout(limite);
      sair?.();
      fluxo.end();
    }

    sair = hub.assinar(
      request.membro,
      (evento) => {
        if (encerrado) return;
        fluxo.write(`data: ${JSON.stringify(evento)}\n\n`);
        // Aba lenta que não lê: o buffer cresceria sem fim. Passou de 64 KiB parados, o fluxo cai e a aba reconecta.
        if (fluxo.writableLength > 64 * 1024) encerrar();
      },
      encerrar,
    );
    request.raw.on("close", encerrar);
    fluxo.on("error", encerrar);

    return reply.send(fluxo);
  });
}
