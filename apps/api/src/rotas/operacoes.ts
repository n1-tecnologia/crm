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
 * transporte (401/403 do hook, 404 nome fora do registro, 400 entrada
 * inválida — schema da operação (`esquemas-de-argumentos.ts`) ou `TypeError`
 * dentro dela (CR-02), 409 conflito de revisão, 500 erro não tratado, que
 * sobe ao `setErrorHandler` de `app.ts`).
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
import { esquemaDeArgumentos } from "./esquemas-de-argumentos";

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
 * diretamente. A ASSINATURA é garantida pela regra de inclusão de
 * `registro.ts` — toda entrada tem a forma
 * `(state, actingMemberId, ...args) => OperationResult` —; a FORMA dos
 * `args` é garantida por `esquemaDeArgumentos()` (`esquemas-de-argumentos.ts`,
 * CR-02) ANTES do despacho. O cast aqui só relaxa o que o compilador não
 * consegue expressar sem um genérico por chamada.
 */
const REGISTRO = OPERACOES as Record<
  string,
  (state: DataState, actingMemberId: Id, ...args: unknown[]) => OperationResult<unknown>
>;

/** Lançado quando a entrada de uma operação não bate com a forma esperada —
 * de três origens: o schema de um serviço em `SERVICOS` (`args[0]`), o
 * schema por operação de `esquemaDeArgumentos()` (antes do despacho) ou um
 * `TypeError` lançado DENTRO da própria operação (CR-02). Tratado aqui
 * mesmo, nunca sobe ao `setErrorHandler` genérico de `app.ts` (que
 * devolveria 500 para o que é, na verdade, uma entrada inválida — 400). */
class ErroDeEntrada extends Error {}

/**
 * Mensagem única de 400 para as três origens de `ErroDeEntrada` — nunca a
 * `message` do zod nem a de um `TypeError` (T-1-06): o detalhe completo vai
 * ao `request.log.warn`, nunca ao corpo da resposta.
 */
function mensagemDeEntradaInvalida(nome: string, problema?: { readonly path: ReadonlyArray<PropertyKey> }): string {
  const caminho = problema && problema.path.length > 0 ? ` em ${problema.path.join(".")}` : "";
  return `Entrada inválida para "${nome}"${caminho}.`;
}

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
    if (!entrada.success) throw new ErroDeEntrada(mensagemDeEntradaInvalida("inviteMember"));
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

      // CR-02 — a FORMA dos args, validada ANTES do despacho: schema por
      // operação para as 23 mais expostas, estrutural para as demais. O
      // dado que segue é `validacao.data`, re-criado pelo zod só com o que
      // o schema conhece (`.strict()`; `null` de posicional opcional já
      // virado `undefined`) — nunca os `args` crus do corpo.
      const revividos = reviverArgumentos(request.body.args);
      const validacao = esquemaDeArgumentos(nome).safeParse(revividos);
      if (!validacao.success) {
        request.log.warn(
          { operacao: nome, membro: request.membro.id, problemas: validacao.error.issues },
          "Entrada inválida para a operação",
        );
        return reply.code(400).send({ ok: false, error: mensagemDeEntradaInvalida(nome, validacao.error.issues[0]) });
      }
      const args: unknown[] = validacao.data;
      const servico = SERVICOS[nome];

      let resultado: ResultadoTransacao<unknown>;
      try {
        resultado = servico
          ? await servico(request.membro, args)
          : await executar(request.membro.workspaceId, (state) => {
              const operacao = REGISTRO[nome]!;
              try {
                return operacao(state, request.membro.id, ...args);
              } catch (erro) {
                // As operações confiam nos tipos do TypeScript, que não
                // existem em runtime; para quem não tem schema próprio, um
                // `TypeError` é o sinal de forma errada, e forma errada é
                // 400 — `executar()` já faz rollback antes de relançar
                // (CR-02), então nada é gravado. `RangeError` NÃO é mapeado
                // de propósito: com `z.date()` recusando `Invalid Date`, um
                // `RangeError` já não é sinal de entrada.
                if (erro instanceof TypeError) {
                  request.log.warn(
                    { operacao: nome, membro: request.membro.id, causa: erro.message },
                    "TypeError dentro da operação — tratado como entrada inválida",
                  );
                  throw new ErroDeEntrada(mensagemDeEntradaInvalida(nome));
                }
                throw erro;
              }
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
