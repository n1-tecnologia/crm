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
import type { ApprovalRequest, Comment, DataState, Id, OperationResult } from "@n1/dominio";
import { ehNomeDeOperacao, OPERACOES, reviverArgumentos, type NomeDeOperacao } from "@n1/dominio/operations/registro";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { cutucarPonte, type ParDaPonte } from "../automacoes/ponte-ativa";
import type { MembroDaSessao } from "../plugins/autenticacao";
import type { EventoDeSaida } from "../persistencia/outbox";
import { executar, type ResultadoTransacao } from "../persistencia/unidade-de-trabalho";
import { recortarDiferenca, recortarValor, visibilidadePara } from "@n1/dominio/derive-visibilidade";
import { maiorIdDe } from "@n1/dominio/operations";
import { convidarMembro } from "../servicos/convidar-membro";
import { LISTA_SOLICITACOES_DE_PAGAMENTO_ID } from "../servicos/dto-solicitacao";
import { esquemaDeArgumentos } from "./esquemas-de-argumentos";

/**
 * As duas operações desta rota que o pipeline de pagamento precisa ouvir (D-09, contrato v1 §8):
 * a decisão de aprovação por clique e o comentário humano numa Solicitação — o que o
 * classificador do fallback por comentário lê. Mesmos eventos que `classificacoes.ts` e
 * `integracao-solicitacoes.ts` já gravam; as outras ~200 operações seguem sem evento.
 * `eraReplay`: repetir a mesma decisão é sucesso sem efeito no domínio, e não pode reenviar.
 */
export function eventosDeSaidaDaOperacao(
  nome: string,
  entrada: {
    readonly args: readonly unknown[];
    readonly valor: unknown;
    readonly state: DataState;
    readonly membroId: Id;
    readonly eraReplay: boolean;
  },
): EventoDeSaida[] {
  if (nome === "decideProcessApproval") {
    const aprovacao = entrada.valor as ApprovalRequest;
    const decisao = aprovacao.decision;
    if (entrada.eraReplay || aprovacao.origin.kind !== "processTask") return [];
    // Conferência do Resumo (`processStep: "resumo"`, Fase 6) não é Solicitação:
    // o evento iria a `handlePlatformApprovalDecision` (06-REVIEW CR-04). Lista
    // de permissão, não de exclusão: um `processStep` novo não herda o evento
    // por acidente.
    if (aprovacao.origin.processStep !== "pagamento") return [];
    if (decisao !== "aprovada" && decisao !== "rejeitada") return [];
    return [
      {
        type: "solicitacao.aprovacao-decidida.v1",
        aggregateType: "task",
        aggregateId: aprovacao.origin.taskId,
        payload: {
          taskId: aprovacao.origin.taskId,
          approvalId: aprovacao.id,
          decision: decisao,
          source: aprovacao.decisionSource ?? "click",
          decidedByMemberId: entrada.membroId,
        },
      },
    ];
  }
  if (nome === "addTaskComment") {
    const taskId = entrada.args[0] as Id;
    const tarefa = entrada.state.tasks.find((t) => t.id === taskId);
    if (tarefa?.listId !== LISTA_SOLICITACOES_DE_PAGAMENTO_ID) return [];
    const comentario = entrada.valor as Comment;
    return [
      {
        type: "solicitacao.comentario-criado.v1",
        aggregateType: "task",
        aggregateId: taskId,
        payload: {
          taskId,
          commentId: comentario.id,
          ...(comentario.parentCommentId ? { parentCommentId: comentario.parentCommentId } : {}),
          authorMemberId: entrada.membroId,
        },
      },
    ];
  }
  return [];
}

/**
 * D6-12 — as gravações numa Tarefa que interessam à ponte do Agente de
 * lançamento (Campo, dados, Status, Comentário, Tags, fio resolvido, decisão
 * de Conferência, Status em lote) e, desde 06-13 (crm:IN-04), a conta que
 * nasce, muda de Lista, vai para a lixeira ou volta dela, e os anexos da
 * Tarefa (que entraram na chave da ponte, crm:WR-02, e vão no `/lancar`).
 * Depois de uma delas, a rota cutuca a ponte, que roda um ciclo em até 2 s em
 * vez de esperar o relógio.
 */
const OPERACOES_QUE_CUTUCAM_A_PONTE: ReadonlySet<string> = new Set([
  "setTaskFieldValue",
  "updateTask",
  "changeTaskStatus",
  "addTaskComment",
  "editTaskComment",
  "deleteTaskComment",
  "setTaskTags",
  "resolveTaskComment",
  "decideProcessApproval",
  "alterarStatusEmLote",
  "createTask",
  "moveTask",
  "trashTask",
  "restoreTask",
  "attachFile",
  "removeAttachment",
]);

/**
 * O par (Espaço, Lista) de cada Tarefa que a operação gravou — `args[0]` (um
 * id, ou a lista de ids do lote), a origem da Aprovação decidida, ou, em
 * `createTask`, a Tarefa criada (o `valor`: `args[0]` ali é a entrada). O
 * estado é o JÁ mutado: a Tarefa movida é achada na Lista de destino. Quem
 * decide se o par é o da ponte é `cutucarPonte` (a Lista da ponte vem do
 * ambiente, não do seed). Puro: lê o estado, não grava nada.
 */
export function tarefasAfetadasPelaOperacao(nome: string, args: readonly unknown[], valor: unknown, state: DataState): ParDaPonte[] {
  if (!OPERACOES_QUE_CUTUCAM_A_PONTE.has(nome)) return [];
  let ids: unknown[];
  if (nome === "decideProcessApproval") {
    const origem = (valor as { readonly origin?: { readonly kind?: unknown; readonly taskId?: unknown } } | undefined)?.origin;
    ids = origem?.kind === "processTask" ? [origem.taskId] : [];
  } else if (nome === "alterarStatusEmLote") {
    ids = Array.isArray(args[0]) ? args[0] : [];
  } else if (nome === "createTask") {
    ids = [(valor as { readonly id?: unknown } | undefined)?.id];
  } else {
    ids = [args[0]];
  }
  const pares = new Map<string, ParDaPonte>();
  for (const id of ids) {
    const tarefa = typeof id === "string" ? state.tasks.find((t) => t.id === id) : undefined;
    if (tarefa) pares.set(tarefa.listId, { workspaceId: state.workspace.id, listId: tarefa.listId });
  }
  return [...pares.values()];
}

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
  Record<
    NomeDeOperacao,
    (membro: MembroDaSessao, args: readonly unknown[], aoTerminar: (state: DataState) => void) => Promise<ResultadoTransacao<unknown>>
  >
> = {
  // T-1-08 — `.strip()` descarta qualquer `userId` que o cliente mande em
  // `args[0]`: a única fonte de `userId` é `resolverUsuarioPorEmail`, dentro
  // de `convidarMembro`, nunca o corpo da requisição.
  inviteMember: (membro, args, aoTerminar) => {
    const entrada = ENTRADA_INVITE_MEMBER.safeParse(args[0]);
    if (!entrada.success) throw new ErroDeEntrada(mensagemDeEntradaInvalida("inviteMember"));
    return convidarMembro(
      {
        workspaceId: membro.workspaceId,
        actingMemberId: membro.id,
        email: entrada.data.email,
        roleId: entrada.data.roleId,
      },
      { aoTerminar },
    );
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
      let eraReplay = false;
      let afetadas: ParDaPonte[] = [];
      // PRIV-03 / 1.1.5 — o estado DEPOIS da operação (a última tentativa), para
      // recortar o diff e o `value` pelo que este Membro enxerga antes de responder.
      // Os dois ramos o preenchem: `executar()` direto e o serviço de `SERVICOS`.
      let depois: DataState | undefined;
      try {
        resultado = servico
          ? await servico(request.membro, args, (state) => {
              depois = state;
            })
          : await executar(
              request.membro.workspaceId,
              (state) => {
                depois = state;
                if (nome === "decideProcessApproval") {
                  eraReplay = state.approvals.find((a) => a.id === args[0])?.decision === args[1];
                }
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
                const r = REGISTRO[nome]!(state, request.membro.id, ...args);
                // D6-12 — só ANOTA quais Tarefas foram gravadas; a cutucada
                // sai depois do commit, nunca dentro da transação.
                if (r.ok) afetadas = tarefasAfetadasPelaOperacao(nome, args, r.value, state);
                return r;
              },
              {
                eventos: (valor, state) =>
                  eventosDeSaidaDaOperacao(nome, { args, valor, state, membroId: request.membro.id, eraReplay }),
              },
            );
      } catch (erro) {
        if (erro instanceof ErroDeEntrada) {
          return reply.code(400).send({ ok: false, error: erro.message });
        }
        throw erro;
      }

      if ("conflito" in resultado && resultado.conflito) {
        return reply.code(409).send(resultado);
      }

      if (resultado.ok) {
        for (const par of afetadas) {
          try {
            cutucarPonte(par);
          } catch (erro) {
            request.log.warn({ operacao: nome, causa: erro instanceof Error ? erro.message.slice(0, 200) : "erro" }, "Não consegui cutucar a ponte do Agente");
          }
        }
      }

      // `OperationResult` é valor, mesmo quando `ok:false` — nunca lança, e
      // a rota preserva isso: 200 sempre que a Unidade de Trabalho não
      // devolveu conflito.
      //
      // PRIV-03 / F1 / 1.1.5 — a resposta volta recortada pelo que este Membro
      // enxerga, com UM único `visibilidadePara` sobre o estado DEPOIS da
      // operação: o diff sem registro oculto e sem o que é de outro (segredo de
      // link, Memória, e-mail de convite), o `value` (a Tarefa inteira, por
      // exemplo) idem, e o contador de ids do estado inteiro, como `GET /estado`.
      // O recorte roda aqui, DEPOIS de `executar()`, e nunca dentro do callback:
      // o evento `automacao.notificar-canal.v1` continua derivado do estado
      // inteiro (R6).
      if (depois && "diferenca" in resultado) {
        const { ocultos } = visibilidadePara(depois, request.membro.id);
        return reply.code(200).send({
          ...resultado,
          diferenca: recortarDiferenca(resultado.diferenca, depois, request.membro.id, ocultos),
          ...(resultado.ok ? { value: recortarValor(resultado.value, depois, request.membro.id, ocultos) } : {}),
          sequencia: maiorIdDe(depois),
        });
      }
      return reply.code(200).send(resultado);
    },
  );
}
