/**
 * `POST /operacoes/:nome` — a rota genérica que serve as 200 operações do
 * registro (`OPERACOES`, `@n1/dominio/operations/registro`). CON-02 ("uma
 * rota por operação") é satisfeito pelo path param mapeado 1:1 a uma função
 * exportada: o contrato HTTP é idêntico ao de uma rota por operação, sem
 * repetir a mesma casca 200 vezes.
 *
 * A rota não reimplementa regra de negócio nem toca banco diretamente
 * (`apps/api/src/rotas/CONTEXT.md`). Uma recusa do domínio
 * (`OperationResult.ok:false`) viaja em 200: é valor, não falha de
 * transporte (Pitfall 2, RESEARCH.md) — 4xx/5xx são reservados a falhas de
 * transporte:
 *   - 401/403 do hook de autenticação;
 *   - 404 nome fora do registro (`OPERACOES`);
 *   - 400 entrada inválida — schema da operação (todas as 200 têm o seu,
 *     `esquemas-de-argumentos.ts`, CR-02) ou aninhamento de `args` além do
 *     que `reviverArgumentos` suporta (WR-10);
 *   - 409 conflito de revisão;
 *   - 500 qualquer exceção dentro da operação (inclusive `TypeError`): é
 *     bug, não entrada — sobe ao `setErrorHandler` de `app.ts` com log
 *     `error`, de propósito (WR-11: o mapeamento `TypeError → 400` que
 *     existia para operações sem schema próprio foi removido por inteiro,
 *     não estreitado — não existe mais operação sem schema).
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
 * assinaturas das 200 funções, que TypeScript não deixa chamar diretamente.
 * A ASSINATURA é garantida pela regra de inclusão de `registro.ts` — toda
 * entrada tem a forma `(state, actingMemberId, ...args) => OperationResult`
 * —; a FORMA dos `args` é garantida por `esquemaDeArgumentos()`
 * (`esquemas-de-argumentos.ts`, CR-02) para TODAS as operações, ANTES do
 * despacho. O cast aqui só relaxa o que o compilador não consegue expressar
 * sem um genérico por chamada.
 */
const REGISTRO = OPERACOES as Record<
  string,
  (state: DataState, actingMemberId: Id, ...args: unknown[]) => OperationResult<unknown>
>;

/** Lançado quando a entrada de uma operação não bate com a forma esperada —
 * de uma única origem depois desta rodada (WR-11): o schema de um serviço
 * em `SERVICOS` (`args[0]`, ex. `inviteMember`). O 400 do schema por
 * operação (`esquemaDeArgumentos()`) e o do `RangeError` de
 * `reviverArgumentos` (WR-10) respondem direto, sem passar por esta classe.
 * Tratado aqui mesmo, nunca sobe ao `setErrorHandler` genérico de `app.ts`
 * (que devolveria 500 para o que é, na verdade, uma entrada inválida —
 * 400). */
class ErroDeEntrada extends Error {}

/**
 * Mensagem única de 400 — nunca a `message` do zod nem a de uma exceção
 * (T-1-06): o detalhe completo vai ao `request.log.warn`, nunca ao corpo da
 * resposta.
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

      // WR-10 — `JSON.parse` do Node é iterativo e aceita qualquer
      // profundidade abaixo do `bodyLimit`; `reviver` (`registro.ts`) é
      // recursão direta e estoura a pilha a partir de ~3.000 níveis
      // (medido) — por isso o revive é o PRIMEIRO ponto que precisa de
      // proteção, antes de qualquer schema. O `RangeError` é capturado AQUI
      // e não limitado dentro do próprio `reviver` porque o reviver mora em
      // `packages/dominio`, que não conhece HTTP (regra de camada,
      // `CONTEXT.md` da raiz).
      let revividos: unknown[];
      try {
        revividos = reviverArgumentos(request.body.args);
      } catch (erro) {
        if (erro instanceof RangeError) {
          request.log.warn(
            { operacao: nome, membro: request.membro.id, causa: "RangeError em reviverArgumentos" },
            "Argumentos aninhados além do que o reviver suporta — tratado como entrada inválida",
          );
          return reply.code(400).send({ ok: false, error: mensagemDeEntradaInvalida(nome) });
        }
        throw erro;
      }

      // CR-02 — a FORMA dos args, validada ANTES do despacho: schema
      // próprio para TODAS as 200 operações (`ESQUEMAS satisfies
      // EsquemasCompletos`, Plan 01-16), sem fallback. O dado que segue é
      // `validacao.data`, re-criado pelo zod só com o que o schema conhece
      // (`.strict()`; `null` de posicional opcional já virado `undefined`)
      // — nunca os `args` crus do corpo.
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
              // WR-11 — `args` já tem exatamente a forma da assinatura
              // (schema próprio, `satisfies EsquemasCompletos`); um erro
              // aqui dentro (inclusive `TypeError`) só pode ser estado
              // hidratado inconsistente ou bug do domínio, nunca entrada —
              // sobe sem mapeamento, `executar()` já faz rollback antes de
              // relançar, e o `setErrorHandler` de `app.ts` devolve 500 com
              // log `error`, de propósito, para não ficar escondido atrás
              // de um 400 ao cliente.
              //
              // CR-05 — o evento de Canal não é mais derivado aqui: a
              // Unidade de Trabalho (`persistencia/unidade-de-trabalho.ts`)
              // deriva sozinha, obrigatoriamente, a partir das
              // `AutomationExecution` que nasceram na transação.
              return REGISTRO[nome]!(state, request.membro.id, ...args);
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
