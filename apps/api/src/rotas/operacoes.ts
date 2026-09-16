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
import { ehNomeDeOperacao, OPERACOES, reviverArgumentos, type NomeDeOperacao } from "@n1/dominio/operations/registro";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { MembroDaSessao } from "../plugins/autenticacao";
import { executar, type ResultadoTransacao } from "../persistencia/unidade-de-trabalho";
import { convidarMembro } from "../servicos/convidar-membro";

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

/** Lançado por um serviço em `SERVICOS` quando `args[0]` não bate com o
 * schema esperado — tratado aqui mesmo, nunca sobe ao `setErrorHandler`
 * genérico de `app.ts` (que devolveria 500 para o que é, na verdade, uma
 * entrada inválida — 400). */
class ErroDeEntrada extends Error {}

const ENTRADA_INVITE_MEMBER = z.object({ email: z.string(), roleId: z.string() }).strip();

/**
 * Operações que precisam de I/O ANTES da Unidade de Trabalho — hoje só
 * `inviteMember`, que resolve e-mail → `userId` contra o Supabase Auth
 * (PERS-09). O serviço recebe os mesmos `args` que a operação receberia
 * (mesma forma de `REGISTRO[nome](state, actingMemberId, ...args)`), só que
 * compõe I/O antes de entrar na transação em vez de rodar dentro dela. Uma
 * operação sem entrada aqui segue o caminho de hoje: `executar()` direto.
 */
const SERVICOS: Partial<
  Record<NomeDeOperacao, (membro: MembroDaSessao, args: readonly unknown[]) => Promise<ResultadoTransacao<unknown>>>
> = {
  // T-1-08 — `.strip()` descarta qualquer `userId` que o cliente mande em
  // `args[0]`: a única fonte de `userId` é `resolverUsuarioPorEmail`, dentro
  // de `convidarMembro`, nunca o corpo da requisição.
  inviteMember: (membro, args) => {
    const entrada = ENTRADA_INVITE_MEMBER.safeParse(args[0]);
    if (!entrada.success) throw new ErroDeEntrada("Entrada inválida para inviteMember.");
    return convidarMembro({
      workspaceId: membro.workspaceId,
      actingMemberId: membro.id,
      email: entrada.data.email,
      roleId: entrada.data.roleId,
    });
  },
};

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
      const servico = SERVICOS[nome];

      let resultado: ResultadoTransacao<unknown>;
      try {
        resultado = servico
          ? await servico(request.membro, args)
          : await executar(request.membro.workspaceId, (state) => {
              const operacao = REGISTRO[nome]!;
              return operacao(state, request.membro.id, ...args);
            });
      } catch (erro) {
        if (erro instanceof ErroDeEntrada) {
          return reply.code(400).send({ ok: false, error: erro.message });
        }
        throw erro;
      }

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
