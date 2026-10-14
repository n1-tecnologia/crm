/**
 * As três rotas públicas do Formulário (D-02) — o único caminho de entrada
 * da Solicitação que chega ao Postgres sem `Authorization: Bearer`:
 *
 *   `GET  /v1/public/forms/:secret`              — o DTO sanitizado
 *   `POST /v1/public/forms/:secret/uploads`       — o ticket de upload (Plan 02-11)
 *   `POST /v1/public/forms/:secret/submissions`   — o envio atômico
 *
 * Por que não passam por `POST /operacoes/:nome`: a rota genérica
 * (`./operacoes.ts`) exige Membro autenticado — `request.membro`, resolvido
 * de JWT do Supabase — e `/f/<segredo>` nunca tem sessão (02-RESEARCH.md,
 * achado 2). As três rotas aqui nascem isentas do hook de
 * `../plugins/autenticacao.ts`, pela mesma marca de config que `GET /saude` usa.
 *
 * D-19 — a confirmação (o `201`) vem da persistência, nunca do
 * `automation/`: o evento de outbox entra no MESMO commit que a Tarefa
 * (`../persistencia/unidade-de-trabalho.ts::executar`, `opcoes.eventos`) e a
 * entrega ao pipeline é responsabilidade exclusiva de `outbox-worker.ts`,
 * fora deste caminho — um `automation/` fora do ar nunca atrasa nem derruba
 * a resposta HTTP.
 *
 * T-02-03 (enumeração) — segredo inexistente e Formulário pausado respondem
 * EXATAMENTE o mesmo 404, byte a byte: `responderFormularioIndisponivel` é
 * o único lugar que produz essa resposta, para as duas rotas GET e POST que
 * resolvem um Formulário por segredo.
 *
 * T-02-06 (um objeto alheio não vira anexo) — cada `objectId` declarado em
 * `POST .../submissions` é resolvido contra `objetosDaSessao(submissionId)`
 * (pertence à sessão?) e depois `confirmarObjeto` (existe de fato, tamanho e
 * assinatura conferem?) ANTES da Unidade de Trabalho — o padrão `SERVICOS`
 * de `./operacoes.ts`: I/O externo primeiro, transação depois.
 *
 * Nenhuma rota loga corpo, resposta, nome de fornecedor, documento ou valor
 * (T-02-14): `request.log` recebe só `{ rota, formId, submissionId, status }`.
 */

import type { DataState, Task } from "@n1/dominio";
import { formBySecret, formOutdatedReason, submitForm, type SubmitFormAttachment } from "@n1/dominio/operations/scale";
import { LISTA_ID as LISTA_DE_SOLICITACOES } from "@n1/dominio/solicitacao-de-pagamento-evolver";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { pool } from "../persistencia/conexao";
import { hidratar } from "../persistencia/repositorio";
import { consumirSessao, garantirSessao, objetosDaSessao } from "../persistencia/sessoes-de-upload";
import { executar, type ResultadoTransacao } from "../persistencia/unidade-de-trabalho";
import { criarLimiteDeTaxa, type LimiteDeTaxa } from "../servicos/limite-de-taxa";
import { abrirSessaoDeUpload, confirmarObjeto, emitirTicket, TIPOS_ACEITOS, TTL_UPLOAD } from "../servicos/storage-uploads";
import { CORPO_SUBMISSAO, CORPO_TICKET, PARAMS_SEGREDO } from "./esquemas/formularios-publicos";

const ROTA = {
  getForm: "GET /v1/public/forms/:secret",
  createUploadTicket: "POST /v1/public/forms/:secret/uploads",
  submitForm: "POST /v1/public/forms/:secret/submissions",
} as const;

/** Copy única do UI-SPEC ("Unavailable form body") — segredo inexistente e Formulário pausado nunca se distinguem (T-02-03). */
const COPY_INDISPONIVEL = "Este link não está disponível. Peça um novo link ao Financeiro.";
/**
 * Checklist 1.5 — a mesma frase que o envio já devolve (`submitForm`): agora
 * também ao abrir e ao subir arquivo, para ninguém preencher tudo e só
 * descobrir no fim. O motivo interno (qual Campo) não sai: é da Lista.
 */
export const COPY_DESATUALIZADO = "Este Formulário está desatualizado: peça a quem o enviou para revisá-lo.";
/** Copy única do UI-SPEC ("Generic public error") — o resto de uma recusa que não é sobre um campo do próprio Formulário. */
const COPY_ERRO_GENERICO = "Não foi possível enviar a solicitação. Seus dados continuam aqui; tente novamente.";
const COPY_SESSAO_INVALIDA =
  "Esta solicitação já foi enviada ou o link de envio expirou. Recarregue a página e tente novamente.";

export interface OpcoesDeFormulariosPublicos {
  readonly workspaceId: string;
  /**
   * Como ler o estado atual, sem transação. Padrão: hidrata contra
   * `pool()`. Testes injetam um stub — os casos de segredo/DTO/limite de
   * taxa de `formularios-publicos.test.ts` provam a superfície pública sem
   * depender de `DATABASE_URL` (D-DEC-09), do mesmo jeito que
   * `../app.ts` injeta `verificarToken`/`resolverMembro` para
   * `operacoes.test.ts`.
   */
  readonly lerEstado?: (workspaceId: string) => Promise<DataState>;
  /** Padrão: 30 por IP a cada minuto. Testes injetam uma janela curta para provar o 429 sem 31 requisições reais. */
  readonly limitePorIp?: LimiteDeTaxa;
  /** Padrão: 60 por segredo a cada minuto — mais folgado que o de IP porque várias pessoas podem compartilhar rede. */
  readonly limitePorSegredo?: LimiteDeTaxa;
}

async function lerEstadoReal(workspaceId: string): Promise<DataState> {
  const cliente = await pool().connect();
  try {
    return (await hidratar(cliente, workspaceId)).state;
  } finally {
    cliente.release();
  }
}

function logarRotaPublica(
  request: FastifyRequest,
  args: { readonly rota: string; readonly formId?: string; readonly submissionId?: string; readonly status: number },
): void {
  request.log.info({
    rota: args.rota,
    ...(args.formId ? { formId: args.formId } : {}),
    ...(args.submissionId ? { submissionId: args.submissionId } : {}),
    status: args.status,
  });
}

function responderFormularioIndisponivel(request: FastifyRequest, reply: FastifyReply, rota: string): FastifyReply {
  logarRotaPublica(request, { rota, status: 404 });
  return reply.code(404).send({ ok: false, error: COPY_INDISPONIVEL });
}

/** Checklist 1.5 — 409: o link existe, mas o Formulário precisa de revisão de quem o enviou. */
function responderDesatualizado(request: FastifyRequest, reply: FastifyReply, rota: string, formId: string): FastifyReply {
  logarRotaPublica(request, { rota, formId, status: 409 });
  return reply.code(409).send({ ok: false, error: COPY_DESATUALIZADO, desatualizado: true });
}

function responderLimiteExcedido(request: FastifyRequest, reply: FastifyReply, rota: string, restanteMs: number): FastifyReply {
  logarRotaPublica(request, { rota, status: 429 });
  return reply
    .code(429)
    .header("Retry-After", String(Math.max(Math.ceil(restanteMs / 1000), 1)))
    .send({ ok: false, error: "Muitas tentativas. Aguarde um instante e tente novamente." });
}

/**
 * A chave de limite de taxa por IP — `request.ip` considera o encaminhamento
 * do nginx à frente (D-15) só quando `TRUST_PROXY` confia nele (`app.ts`).
 */
function chaveDeIp(request: FastifyRequest): string {
  return request.ip;
}

/**
 * O DTO público — só o que quem responde precisa para preencher: nunca
 * `ownerMemberId`, o container onde a Lista vive, ids de Campo internos,
 * configuração da Lista, regra de roteamento, opções invisíveis nem
 * contagem de envios (T-02-03).
 */
export function paraDtoPublico(state: DataState, form: NonNullable<ReturnType<typeof formBySecret>>) {
  return {
    formId: form.id,
    title: form.name,
    ...(form.description ? { intro: form.description } : {}),
    questions: form.questions.map((pergunta) => paraPerguntaPublica(state, pergunta)),
  };
}

/**
 * Checklist 1.3 — a máscara de apresentação vem do CAMPO (o nome da
 * Definição, ou o tipo telefone), nunca do rótulo da pergunta: renomear a
 * pergunta não tira a máscara.
 */
function mascaraDoCampo(nome: string | undefined, tipo: string | undefined): "cpf" | "cnpj" | "telefone" | undefined {
  if (tipo === "phone") return "telefone";
  const normalizado = (nome ?? "").trim().toUpperCase();
  return normalizado === "CPF" ? "cpf" : normalizado === "CNPJ" ? "cnpj" : undefined;
}

function paraPerguntaPublica(state: DataState, pergunta: NonNullable<ReturnType<typeof formBySecret>>["questions"][number]) {
  // Checklist 1.2/1.3 — seção, ajuda e condição são do Formulário; a página pública lê daqui.
  const base = {
    id: pergunta.id,
    label: pergunta.label,
    required: pergunta.required,
    ...(pergunta.section ? { section: pergunta.section } : {}),
    ...(pergunta.showWhen ? { showWhen: { questionId: pergunta.showWhen.questionId, values: [...pergunta.showWhen.values] } } : {}),
  };
  const alvo = pergunta.target;
  if (alvo.kind === "title") return { ...base, ...(pergunta.help ? { help: pergunta.help } : {}), kind: "text" as const };
  if (alvo.kind === "description") return { ...base, ...(pergunta.help ? { help: pergunta.help } : {}), kind: "longText" as const };

  const definicao = state.fieldDefinitions.find((d) => d.id === alvo.definitionId);
  const ajuda = pergunta.help ?? definicao?.description;
  const mascara = mascaraDoCampo(definicao?.name, definicao?.type);
  const comAjuda = { ...(ajuda ? { help: ajuda } : {}), ...(mascara ? { mask: mascara } : {}) };
  if (definicao?.type === "singleSelect" || definicao?.type === "multiSelect") {
    return { ...base, ...comAjuda, kind: definicao.type, options: definicao.options ?? [] };
  }
  if (definicao?.type === "file") {
    return { ...base, ...comAjuda, kind: "file" as const, accept: TIPOS_ACEITOS };
  }
  return { ...base, ...comAjuda, kind: definicao?.type ?? "text" };
}

export async function rotasDeFormulariosPublicos(app: FastifyInstance, opcoes: OpcoesDeFormulariosPublicos): Promise<void> {
  const { workspaceId } = opcoes;
  const lerEstado = opcoes.lerEstado ?? lerEstadoReal;
  const limitePorIp = opcoes.limitePorIp ?? criarLimiteDeTaxa({ janelaMs: 60_000, maximo: 30 });
  const limitePorSegredo = opcoes.limitePorSegredo ?? criarLimiteDeTaxa({ janelaMs: 60_000, maximo: 60 });

  // ── GET /v1/public/forms/:secret ──────────────────────────────────────

  app.get("/v1/public/forms/:secret", { config: { publica: true } }, async (request, reply) => {
    const limite = limitePorIp.consumir(chaveDeIp(request));
    if (!limite.permitido) return responderLimiteExcedido(request, reply, ROTA.getForm, limite.restanteMs);

    const params = PARAMS_SEGREDO.safeParse(request.params);
    if (!params.success) return responderFormularioIndisponivel(request, reply, ROTA.getForm);

    const state = await lerEstado(workspaceId);
    const form = formBySecret(state, params.data.secret);
    if (!form || !form.enabled) return responderFormularioIndisponivel(request, reply, ROTA.getForm);
    if (formOutdatedReason(state, form)) return responderDesatualizado(request, reply, ROTA.getForm, form.id);

    logarRotaPublica(request, { rota: ROTA.getForm, formId: form.id, status: 200 });
    return reply.code(200).send(paraDtoPublico(state, form));
  });

  // ── POST /v1/public/forms/:secret/uploads ─────────────────────────────

  app.post("/v1/public/forms/:secret/uploads", { config: { publica: true } }, async (request, reply) => {
    const limiteIp = limitePorIp.consumir(chaveDeIp(request));
    if (!limiteIp.permitido) return responderLimiteExcedido(request, reply, ROTA.createUploadTicket, limiteIp.restanteMs);

    const params = PARAMS_SEGREDO.safeParse(request.params);
    if (!params.success) return responderFormularioIndisponivel(request, reply, ROTA.createUploadTicket);

    const limiteSegredo = limitePorSegredo.consumir(params.data.secret);
    if (!limiteSegredo.permitido) {
      return responderLimiteExcedido(request, reply, ROTA.createUploadTicket, limiteSegredo.restanteMs);
    }

    const body = CORPO_TICKET.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ ok: false, error: "Entrada inválida para este envio." });

    const state = await lerEstado(workspaceId);
    const form = formBySecret(state, params.data.secret);
    if (!form || !form.enabled) return responderFormularioIndisponivel(request, reply, ROTA.createUploadTicket);
    if (formOutdatedReason(state, form)) return responderDesatualizado(request, reply, ROTA.createUploadTicket, form.id);

    try {
      const submissionId = body.data.submissionId ?? (await abrirSessaoDeUpload({ workspaceId, formId: form.id })).submissionId;
      const ticket = await emitirTicket({
        submissionId,
        displayName: body.data.displayName,
        mediaType: body.data.mediaType,
      });
      logarRotaPublica(request, { rota: ROTA.createUploadTicket, formId: form.id, submissionId, status: 201 });
      // Nenhuma service role aqui: `token`/`uploadUrl` são de escopo mínimo, o navegador fala direto com o Storage (Plan 02-11).
      return reply.code(201).send({
        submissionId,
        objectId: ticket.objectId,
        uploadUrl: ticket.uploadUrl,
        token: ticket.token,
        expiresAt: ticket.expiresAt.toISOString(),
      });
    } catch (erro) {
      request.log.warn({ rota: ROTA.createUploadTicket, formId: form.id, erro: erro instanceof Error ? erro.message : erro }, "Ticket de upload recusado");
      logarRotaPublica(request, { rota: ROTA.createUploadTicket, formId: form.id, status: 400 });
      return reply.code(400).send({ ok: false, error: "Não foi possível preparar o envio deste arquivo." });
    }
  });

  // ── POST /v1/public/forms/:secret/submissions ─────────────────────────

  app.post("/v1/public/forms/:secret/submissions", { config: { publica: true } }, async (request, reply) => {
    const limiteIp = limitePorIp.consumir(chaveDeIp(request));
    if (!limiteIp.permitido) return responderLimiteExcedido(request, reply, ROTA.submitForm, limiteIp.restanteMs);

    const params = PARAMS_SEGREDO.safeParse(request.params);
    if (!params.success) return responderFormularioIndisponivel(request, reply, ROTA.submitForm);

    const limiteSegredo = limitePorSegredo.consumir(params.data.secret);
    if (!limiteSegredo.permitido) {
      return responderLimiteExcedido(request, reply, ROTA.submitForm, limiteSegredo.restanteMs);
    }

    // CORPO_SUBMISSAO é `.strict()`: `ownerId`/`actorId`/`status`/`origem`/`taskId` no corpo — 400, nunca ignorados (T-02-04).
    const body = CORPO_SUBMISSAO.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ ok: false, error: "Entrada inválida para este envio." });

    // 2 — resolver o Formulário; mesma resposta 404 uniforme de `GET`.
    const state = await lerEstado(workspaceId);
    const form = formBySecret(state, params.data.secret);
    if (!form || !form.enabled) return responderFormularioIndisponivel(request, reply, ROTA.submitForm);

    const { submissionId } = body.data;
    const anexosDeclarados = body.data.attachments ?? [];

    // 3 — cada anexo declarado precisa pertencer a ESTA sessão e ser confirmado de verdade (T-02-06), ANTES da UoW.
    const objetosDaSubmissao = anexosDeclarados.length > 0 ? await objetosDaSessao(submissionId) : [];
    const anexosConfirmados: SubmitFormAttachment[] = [];
    for (const anexo of anexosDeclarados) {
      const objeto = objetosDaSubmissao.find((o) => o.id === anexo.objectId);
      if (!objeto) {
        logarRotaPublica(request, { rota: ROTA.submitForm, formId: form.id, submissionId, status: 400 });
        return reply.code(400).send({ ok: false, error: COPY_ERRO_GENERICO });
      }
      const confirmacao = await confirmarObjeto({ submissionId, objectId: anexo.objectId });
      if (!confirmacao.ok) {
        request.log.warn({ rota: ROTA.submitForm, formId: form.id, submissionId, motivo: confirmacao.motivo }, "Anexo recusado antes da submissão");
        logarRotaPublica(request, { rota: ROTA.submitForm, formId: form.id, submissionId, status: 400 });
        return reply.code(400).send({ ok: false, error: COPY_ERRO_GENERICO });
      }
      anexosConfirmados.push({
        questionId: anexo.questionId,
        objectKey: objeto.objectKey,
        displayName: objeto.displayName,
        mediaType: objeto.mediaType,
        sizeBytes: confirmacao.sizeBytes,
        ...(confirmacao.sha256 ? { sha256: confirmacao.sha256 } : {}),
      });
    }

    // 4/5 — a Tarefa, os Campos, os `WorkspaceFile`, a Atividade e o evento no MESMO commit; a sessão só é
    // consumida se a operação de domínio teve sucesso (`aoConfirmar` só roda depois do `resultado.ok`, ver
    // `../persistencia/unidade-de-trabalho.ts`) — uma recusa de domínio deixa a sessão livre para retry (caso h).
    let transacao: ResultadoTransacao<Task>;
    try {
      // A sessão pode ainda não existir: sem anexo, `pedirTicket` nunca é chamado e nada a criou. O
      // `submissionId` vem do cliente e é estável em todo retry — é ele que dá idempotência ao envio, e
      // por isso não se pode simplesmente pular `consumirSessao` quando não há arquivo (dois cliques
      // criariam duas Solicitações). `garantirSessao` fecha a lacuna verificando o escopo: uma sessão de
      // outro Espaço ou outro Formulário é recusada, não reaproveitada.
      await garantirSessao({ id: submissionId, workspaceId, formId: form.id, ttlSegundos: TTL_UPLOAD });

      transacao = await executar(
        workspaceId,
        (estadoDaTransacao) => submitForm(estadoDaTransacao, params.data.secret, { answers: body.data.answers, attachments: anexosConfirmados }),
        {
          // PIPE-05 — `solicitacao.criada.v1` é o evento do pipeline de pagamento (contrato v1, §8):
          // só a Tarefa que nasce na Lista de Solicitações de pagamento o emite. Um Formulário de
          // outra Lista cria a Tarefa e nada mais — o `automation/` não tem o que fazer com ela.
          eventos: (task) =>
            task.listId === LISTA_DE_SOLICITACOES
              ? [
                  {
                    type: "solicitacao.criada.v1",
                    aggregateType: "task",
                    aggregateId: task.id,
                    payload: { taskId: task.id, readableId: task.readableId ?? task.id, listId: task.listId, origin: "plataforma" },
                  },
                ]
              : [],
          aoConfirmar: async (cliente) => {
            await consumirSessao(cliente, submissionId);
          },
        },
      );
    } catch (erro) {
      // `consumirSessao` lança `sessao_*` quando a MESMA `submissionId` é reenviada depois de já consumida,
      // inexistente ou vencida — a Unidade de Trabalho já desfez a transação inteira (nenhuma segunda Tarefa
      // fica gravada, caso i). Qualquer outra exceção é bug: sobe ao `setErrorHandler` de `../app.ts` (500).
      if (erro instanceof Error && erro.message.startsWith("sessao_")) {
        request.log.warn({ rota: ROTA.submitForm, formId: form.id, submissionId, causa: erro.message }, "Sessão de envio inválida na confirmação");
        logarRotaPublica(request, { rota: ROTA.submitForm, formId: form.id, submissionId, status: 409 });
        return reply.code(409).send({ ok: false, error: COPY_SESSAO_INVALIDA, retryable: false });
      }
      throw erro;
    }

    if ("conflito" in transacao && transacao.conflito) {
      logarRotaPublica(request, { rota: ROTA.submitForm, formId: form.id, submissionId, status: 409 });
      return reply.code(409).send({ ok: false, error: transacao.error, retryable: true });
    }
    if (!transacao.ok) {
      logarRotaPublica(request, { rota: ROTA.submitForm, formId: form.id, submissionId, status: 400 });
      // Erro por campo (o UI-SPEC pede erro pela própria pergunta) usa a mensagem do domínio; o resto — Formulário
      // desatualizado, falha ao criar a Tarefa — usa a copy genérica: nada de expor razão interna ao navegador.
      return "field" in transacao && transacao.field
        ? reply.code(400).send({ ok: false, error: transacao.error, field: transacao.field })
        : reply.code(400).send({ ok: false, error: COPY_ERRO_GENERICO });
    }

    // 6 — só o identificador legível. Nada de taskId, Status, aprovador ou link de acompanhamento (D-05).
    logarRotaPublica(request, { rota: ROTA.submitForm, formId: form.id, submissionId, status: 201 });
    return reply.code(201).send({ readableId: transacao.value.readableId ?? transacao.value.id });
  });
}
