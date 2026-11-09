/**
 * O webhook de mensageria por Canal (16-03, 3.6.3, MSG-01): `POST /webhooks/mensageria/:canalId`, o
 * endereço que um provedor (o de teste agora; a Evolution e a Meta depois) chama para entregar o que
 * chegou. É rota PÚBLICA (`config: { publica: true }`, o gancho de `/saude`): não há `Authorization:
 * Bearer`, a confiança é o segredo do Canal que o provedor manda no cabeçalho `x-n1-webhook-segredo`
 * (D-16-03), guardado no cofre e conferido pelo próprio provedor do Canal (`verificarChamada`).
 *
 * O que a rota faz: acha o Canal só pelo `id` da URL (o Espaço vem da linha do Canal, nunca do cliente),
 * resolve o provedor pelo Canal (`provedorDoCanal`, nunca por cabeçalho nem corpo), verifica a chamada e
 * grava UMA linha `pendente` em `plataforma.webhooks_recebidos`; responde 200 na hora e acorda o
 * processador de entrada (`mensageria/processador-de-entrada.ts`), que é quem interpreta o corpo e chama
 * `receberMensagem`. Nada é processado dentro da requisição (o provedor reenvia o que não receber 200 logo).
 *
 * Plugin PRÓPRIO, irmão de `rotasDeWebhookMeta` e fora de `rotasDeCrm`: o parser do corpo cru fica
 * encapsulado aqui, e `publica: true` vale só para esta rota. `webhook-meta.ts` não muda (D-16-07).
 *
 * Nada deste arquivo loga o corpo, os cabeçalhos nem o segredo: o log leva só o `canalId` e o desfecho.
 */

import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { criarRepositorioDeCanaisPg } from "../repositorios/crm/canais";
import { canalParaProvedor, provedorDoCanal, registroPadrao, type RegistroDeProvedores } from "../mensageria/registro";
import { lerChavesDoCofre, type ChavesDoCofre } from "../servicos/cofre";
import { pool as poolPadrao } from "../persistencia/conexao";

export const CAMINHO_WEBHOOK_DE_MENSAGERIA = "/webhooks/mensageria/:canalId";

export interface OpcoesDeWebhooksDeMensageria {
  /** Padrão: o pool do processo. Testes injetam o pool (ou um espião dele). */
  readonly pool?: () => Pool;
  /** Padrão: `lerChavesDoCofre()` (`COFRE_CHAVE`), lido a cada chamada. */
  readonly chaves?: ChavesDoCofre;
  /** Padrão: `registroPadrao()`. */
  readonly registro?: RegistroDeProvedores;
  /** Chamado depois do 200: acorda o processador de entrada. Nunca derruba a resposta. */
  readonly acordarProcessador?: () => void;
  readonly limitePorIp?: { readonly janelaMs: number; readonly maximo: number };
}

/** O corpo como o parser o entrega: o JSON lido e os bytes exatos (o provedor pode assinar o corpo). */
interface CorpoDoWebhook {
  readonly bruto: Buffer;
  readonly json: unknown;
}

const LIMITE_DO_CORPO_BYTES = 2 * 1024 * 1024;

const NAO_AUTORIZADO = { ok: false, error: "Não autorizado." } as const;

/** Um valor de cabeçalho do Node pode ser lista; o provedor lê só o primeiro. */
function cabecalhosEmTexto(cabecalhos: Readonly<Record<string, string | string[] | undefined>>): Record<string, string | undefined> {
  const saida: Record<string, string | undefined> = {};
  for (const [nome, valor] of Object.entries(cabecalhos)) saida[nome] = Array.isArray(valor) ? valor[0] : valor;
  return saida;
}

export async function rotasDeWebhooksDeMensageria(app: FastifyInstance, opcoes: OpcoesDeWebhooksDeMensageria = {}): Promise<void> {
  const pool = opcoes.pool ?? poolPadrao;
  const registro = opcoes.registro ?? registroPadrao();

  // Encapsulado neste plugin (como o da Meta): guarda os bytes cruos junto do JSON.
  app.addContentTypeParser("application/json", { parseAs: "buffer", bodyLimit: LIMITE_DO_CORPO_BYTES }, (_request, bruto, feito) => {
    const buffer = bruto as Buffer;
    try {
      const json: unknown = buffer.length === 0 ? null : JSON.parse(buffer.toString("utf8"));
      feito(null, { bruto: buffer, json } satisfies CorpoDoWebhook);
    } catch {
      feito(Object.assign(new Error("JSON inválido."), { statusCode: 400 }), undefined);
    }
  });

  app.post<{ Params: { canalId: string } }>(
    CAMINHO_WEBHOOK_DE_MENSAGERIA,
    { config: { publica: true }, bodyLimit: LIMITE_DO_CORPO_BYTES },
    async (request, reply) => {
      const { canalId } = request.params;
      const recusar = (desfecho: string) => {
        request.log.info({ rota: "webhook-de-mensageria", canalId, status: 401, desfecho }, "chamada de mensageria recusada");
        return reply.code(401).send(NAO_AUTORIZADO);
      };

      const achados = await pool().query<{ workspace_id: string; estado: string }>(
        "select workspace_id, estado from plataforma.canais where id = $1 limit 2",
        [canalId],
      );
      const achado = achados.rows.length === 1 ? achados.rows[0] : undefined;
      if (!achado || achado.estado !== "ativo") return recusar("canal");

      const canal = await criarRepositorioDeCanaisPg(pool()).obter(achado.workspace_id, canalId);
      if (!canal) return recusar("canal");

      const corpo = request.body as CorpoDoWebhook | undefined;
      let provedorDaChamada: string;
      let chave: string | null;
      try {
        const chaves = opcoes.chaves ?? lerChavesDoCofre();
        const paraOProvedor = await canalParaProvedor(pool(), chaves, achado.workspace_id, canal);
        const provedor = provedorDoCanal(canal, registro);
        const verificada = provedor.verificarChamada(
          { cabecalhos: cabecalhosEmTexto(request.headers), corpoCru: corpo?.bruto ?? Buffer.alloc(0), corpo: corpo?.json ?? null },
          paraOProvedor,
        );
        if (!verificada) return recusar("segredo");
        provedorDaChamada = provedor.provedor;
        chave = provedor.chaveDaChamada?.(corpo?.json ?? null) ?? null;
      } catch (erro) {
        // Provedor indisponível, cofre que não decifra: mesma 401 (D-16-03). O log leva só o tipo do erro.
        request.log.warn({ rota: "webhook-de-mensageria", canalId, erro: erro instanceof Error ? erro.name : "erro" }, "chamada de mensageria não verificada");
        return reply.code(401).send(NAO_AUTORIZADO);
      }

      // Falha do banco aqui sobe como 500: o provedor reenvia, que é o certo para uma chamada verificada.
      await pool().query(
        `insert into plataforma.webhooks_recebidos (workspace_id, canal_id, provedor, chave, corpo)
         values ($1, $2, $3, $4, $5::jsonb)
         on conflict (workspace_id, canal_id, chave) where chave is not null do nothing`,
        [achado.workspace_id, canalId, provedorDaChamada, chave, JSON.stringify(corpo?.json ?? null)],
      );

      reply.code(200).send({ ok: true });
      try {
        opcoes.acordarProcessador?.();
      } catch {
        // O acordador é um atalho: o intervalo do processador cobre uma falha dele.
      }
      return reply;
    },
  );
}
