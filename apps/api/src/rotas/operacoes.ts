/**
 * `POST /operacoes/:nome` — a rota genérica que serve as ~130 operações do
 * registro (`OPERACOES`, `@n1/dominio/operations/registro`). CON-02 ("uma
 * rota por operação") é satisfeito pelo path param mapeado 1:1 a uma função
 * exportada: o contrato HTTP é idêntico ao de uma rota por operação, sem
 * repetir a mesma casca ~130 vezes.
 *
 * A rota não reimplementa regra de negócio nem toca banco diretamente
 * (`apps/api/src/rotas/CONTEXT.md`). Uma recusa do domínio
 * (`OperationResult.ok:false`) viaja em 200: é valor, não falha de
 * transporte (Pitfall 2, RESEARCH.md) — 4xx/5xx são reservados a falhas de
 * transporte (401/403 do hook, 404 nome fora do registro, 409 conflito de
 * revisão, 500 erro não tratado, que sobe ao `setErrorHandler` de `app.ts`).
 *
 * O Membro atuante é SEMPRE `request.membro.id`, resolvido pelo hook de
 * autenticação a partir do token — nada do corpo o substitui (T-1-02).
 */

import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { DataState, Id, OperationResult } from "@n1/dominio";
import { ehNomeDeOperacao, OPERACOES, reviverArgumentos } from "@n1/dominio/operations/registro";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { executar } from "../persistencia/unidade-de-trabalho";

const PARAMS = z.object({
  nome: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z][a-zA-Z0-9]*$/, "nome de operação inválido"),
});

const BODY = z.object({
  args: z.array(z.unknown()).max(32),
  // Aceito e ignorado pelo servidor nesta fase: quem decide entre aplicar o
  // diff e re-hidratar é o cliente, por `revisaoAnterior` (D-06) — não o
  // servidor por um número que o cliente mande. Mantido no schema para o
  // contrato não mudar quando for útil registrar defasagem em log.
  revisao: z.number().int().nonnegative().optional(),
});

/**
 * `OPERACOES` é `as const satisfies Record<...>`: indexar por um
 * `NomeDeOperacao` genérico (não um literal específico) devolve a união das
 * assinaturas de todas as ~130 funções, que TypeScript não deixa chamar
 * diretamente. O runtime é seguro — toda entrada tem a forma
 * `(state, actingMemberId, ...args) => OperationResult` (regra de inclusão
 * de `registro.ts`) — então o cast aqui só relaxa o que o compilador não
 * consegue expressar sem um genérico por chamada.
 */
const REGISTRO = OPERACOES as Record<
  string,
  (state: DataState, actingMemberId: Id, ...args: unknown[]) => OperationResult<unknown>
>;

export async function rotasDeOperacoes(app: FastifyInstance): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().post(
    "/operacoes/:nome",
    { schema: { params: PARAMS, body: BODY } },
    async (request, reply) => {
      const { nome } = request.params;
      if (!ehNomeDeOperacao(nome)) {
        return reply.code(404).send({ ok: false, error: `Operação "${nome}" não existe.` });
      }

      const args = reviverArgumentos(request.body.args);
      const operacao = REGISTRO[nome]!;

      const resultado = await executar(request.membro.workspaceId, (state) =>
        operacao(state, request.membro.id, ...args),
      );

      if ("conflito" in resultado && resultado.conflito) {
        return reply.code(409).send(resultado);
      }

      // `OperationResult` é valor, mesmo quando `ok:false` — nunca lança, e
      // a rota preserva isso: 200 sempre que a Unidade de Trabalho não
      // devolveu conflito.
      return reply.code(200).send(resultado);
    },
  );
}
