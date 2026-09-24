/**
 * Projeção Tarefa (domínio) → `PaymentRequestDtoV1`/`CommentDtoV1` (contrato
 * v1) — o de-para do §4/§5 de
 * `docs/08-migracao-financeiro/04-contrato-plataforma-v1.md`, em código.
 *
 * `paraDtoV1`/`paraCommentDtoV1` são as únicas funções deste arquivo que leem
 * a forma interna da Tarefa (`fieldValues` por id de Campo, `state.files`
 * para anexo) — nenhuma rota faz essa leitura direta; toda rota chama uma
 * destas duas.
 *
 * Os ids de Campo são os literais estáveis de
 * `packages/dominio/src/solicitacao-de-pagamento.ts` (nunca gerados por
 * sequência, por definição daquele arquivo) — aqui resolvidos por `ordem`
 * (1..25, A..Z) a partir de `CATALOGO_SOLICITACAO_DE_PAGAMENTO.campos`
 * (exportado por `@n1/dominio`), nunca copiados como string solta: se a
 * ordem de um Campo mudasse no catálogo, a leitura aqui mudaria junto, em vez
 * de silenciosamente apontar para o Campo errado.
 *
 * `LISTA_SOLICITACOES_DE_PAGAMENTO_ID` é o mesmo literal de
 * `solicitacao-de-pagamento-evolver.ts::LISTA_ID` — não exportado por aquele
 * módulo (`packages/dominio` fora de `files_modified` deste plano), por isso
 * copiado aqui como o mesmo tipo de literal estável que o resto do catálogo
 * já usa.
 */

import type { ActorRef, Comment, DataState, Id, Task } from "@n1/dominio";
import { CATALOGO_SOLICITACAO_DE_PAGAMENTO, SOL } from "@n1/dominio";
import type { z } from "zod";
import { CommentDtoV1 as CommentDtoV1Schema, PaymentRequestDtoV1 as PaymentRequestDtoV1Schema } from "../contratos/v1";

export type PaymentRequestDtoV1 = z.infer<typeof PaymentRequestDtoV1Schema>;
export type CommentDtoV1 = z.infer<typeof CommentDtoV1Schema>;

/**
 * Mesmo literal de `solicitacao-de-pagamento-evolver.ts::LISTA_ID` — ver
 * cabeçalho do arquivo. Exportado para `../rotas/integracao-solicitacoes.ts`
 * filtrar Tarefas da Lista certa sem duplicar o literal uma terceira vez.
 */
export const LISTA_SOLICITACOES_DE_PAGAMENTO_ID: Id = "lst_solicitacoes_de_pagamento";

const CAMPOS_POR_ORDEM = new Map(CATALOGO_SOLICITACAO_DE_PAGAMENTO.campos.map((campo) => [campo.ordem, campo.id]));

/** A..Z (menos V) → posição 1..25, na mesma ordem do §4 do contrato. */
const ORDEM = {
  centroDeCusto: 1,
  bu: 2,
  empresa: 3,
  categoriaDePagamento: 4,
  pessoa: 5,
  fornecedor: 6,
  cnpj: 7,
  cpf: 8,
  nomeDoFornecedor: 9,
  anexo: 10,
  dataDeEmissao: 11,
  dataVencimento: 12,
  formaDePagamento: 13,
  chavePix: 14,
  codigoDeBarras: 15,
  pixCopiaECola: 16,
  linkDePagamento: 17,
  boleto: 18,
  qrCode: 19,
  valor: 20,
  integracaoManual: 21,
  nomeDoSolicitante: 23,
  produto: 24,
  whatsapp: 25,
} as const;

function idDoCampo(ordem: number): Id {
  const id = CAMPOS_POR_ORDEM.get(ordem);
  if (!id) {
    throw new Error(
      `CATALOGO_SOLICITACAO_DE_PAGAMENTO sem Campo de ordem ${ordem} — divergiu do de-para do contrato v1 (§4).`,
    );
  }
  return id;
}

function valorDoCampo(task: Task, definitionId: Id): Task["fieldValues"][number]["value"] | undefined {
  return task.fieldValues.find((fv) => fv.definitionId === definitionId && fv.state === "ativo")?.value;
}

/** Texto ou `null` — nunca string vazia (Campo ausente vira `null`, nunca valor inventado). */
function texto(task: Task, ordem: number): string | null {
  const valor = valorDoCampo(task, idDoCampo(ordem));
  return typeof valor === "string" && valor !== "" ? valor : null;
}

function numero(task: Task, ordem: number): number | null {
  const valor = valorDoCampo(task, idDoCampo(ordem));
  return typeof valor === "number" ? valor : null;
}

function lista(task: Task, ordem: number): string[] {
  const valor = valorDoCampo(task, idDoCampo(ordem));
  return Array.isArray(valor) ? valor.map(String) : [];
}

const STATUS_POR_ID: Readonly<Record<string, PaymentRequestDtoV1["status"]>> = {
  [SOL.status.paraFazer]: "para fazer",
  [SOL.status.emAprovacao]: "em aprovação",
  [SOL.status.naoAprovado]: "não aprovado",
  [SOL.status.aprovado]: "aprovado",
  [SOL.status.emRevisao]: "em revisão",
};

/** O inverso de `STATUS_POR_ID` — `PUT /:taskId/status` traduz o `status` do contrato para o id que `changeTaskStatus` espera. */
export const ID_DO_STATUS: Readonly<Record<PaymentRequestDtoV1["status"], Id>> = {
  "para fazer": SOL.status.paraFazer,
  "em aprovação": SOL.status.emAprovacao,
  "não aprovado": SOL.status.naoAprovado,
  aprovado: SOL.status.aprovado,
  "em revisão": SOL.status.emRevisao,
};

function dueDateNativo(task: Task): string | null {
  if (!task.dueDate) return null;
  // `form: "civilDay"` já é `YYYY-MM-DD`; `form: "instant"` (Instant ISO) tem
  // a parte de data nos 10 primeiros caracteres — sem timezone própria
  // (primitives.ts), a leitura literal do prefixo é a única sem inventar fuso.
  return task.dueDate.form === "civilDay" ? task.dueDate.value : task.dueDate.value.slice(0, 10);
}

interface GrupoDeAnexo {
  readonly ordem: number;
  readonly role: "invoice" | "boleto" | "qrCode";
}

/** J → invoice, R → boleto, S → qrCode (§4 do contrato) — os únicos três Campos que viram `attachments[]`. */
const GRUPOS_DE_ANEXO: readonly GrupoDeAnexo[] = [
  { ordem: ORDEM.anexo, role: "invoice" },
  { ordem: ORDEM.boleto, role: "boleto" },
  { ordem: ORDEM.qrCode, role: "qrCode" },
];

export interface DepsDeProjecao {
  /** `../servicos/storage-uploads.ts::urlDeDownload` (Plan 02-11) — sempre uma URL nova, nunca reaproveitada. */
  readonly urlDeDownload: (objectKey: string) => Promise<{ readonly downloadUrl: string; readonly expiresAt: Date }>;
}

async function montarAnexos(state: DataState, task: Task, deps: DepsDeProjecao): Promise<PaymentRequestDtoV1["attachments"]> {
  const anexos: PaymentRequestDtoV1["attachments"] = [];
  for (const grupo of GRUPOS_DE_ANEXO) {
    for (const fileId of lista(task, grupo.ordem)) {
      const arquivo = state.files.find((f) => f.id === fileId);
      // Um id de arquivo órfão (removido do Storage sem o Campo ser limpo)
      // nunca vira anexo inventado — só é pulado.
      if (!arquivo) continue;
      const { downloadUrl, expiresAt } = await deps.urlDeDownload(arquivo.objectKey);
      anexos.push({
        id: arquivo.id,
        role: grupo.role,
        name: arquivo.name,
        // Aproximação conhecida: `WorkspaceFile.mediaType` guarda a categoria
        // ampla (`document`/`image`/...), não o MIME bruto (`application/pdf`)
        // — o domínio não persiste o MIME original (ver SUMMARY do Plan
        // 02-13, "Known Limitations"). `mediaType` no contrato é `z.string()`
        // livre, então a categoria valida, mas não é o MIME de fato.
        mediaType: arquivo.mediaType,
        size: arquivo.sizeBytes,
        downloadUrl,
        expiresAt: expiresAt.toISOString(),
      });
    }
  }
  return anexos;
}

/**
 * Projeta uma Tarefa em `PaymentRequestDtoV1`. Devolve `undefined` quando a
 * Tarefa não é da Lista "Solicitações de pagamento" — só Solicitações
 * atravessam este contrato (§1 do documento).
 */
export async function paraDtoV1(
  state: DataState,
  task: Task,
  deps: DepsDeProjecao,
): Promise<PaymentRequestDtoV1 | undefined> {
  if (task.listId !== LISTA_SOLICITACOES_DE_PAGAMENTO_ID) return undefined;

  const status = STATUS_POR_ID[task.statusId];
  if (!status) {
    throw new Error(
      `Tarefa "${task.id}" na Lista "Solicitações de pagamento" com Status "${task.statusId}" fora do Conjunto oficial (D-01) — configuração divergiu do catálogo.`,
    );
  }

  const supplierType = texto(task, ORDEM.fornecedor) as PaymentRequestDtoV1["fields"]["supplierType"];
  const supplierDocument =
    supplierType === "CNPJ" ? texto(task, ORDEM.cnpj) : supplierType === "CPF" ? texto(task, ORDEM.cpf) : null;

  const valorReais = numero(task, ORDEM.valor);
  const amountCents = valorReais === null ? null : Math.round(valorReais * 100);

  const paymentMethod = texto(task, ORDEM.formaDePagamento) as PaymentRequestDtoV1["fields"]["paymentMethod"];

  return {
    id: task.id,
    readableId: task.readableId ?? task.id,
    origin: task.provenance?.kind === "import" ? "clickup" : "plataforma",
    title: task.title,
    description: task.description || null,
    status,
    dueDate: dueDateNativo(task),
    assigneeIds: task.assignees.map((a) => a.id),
    tagIds: [...task.tagIds],
    fields: {
      costCenter: texto(task, ORDEM.centroDeCusto) ?? "",
      businessUnit: texto(task, ORDEM.bu),
      company: texto(task, ORDEM.empresa),
      paymentCategory: texto(task, ORDEM.categoriaDePagamento),
      personId: texto(task, ORDEM.pessoa),
      supplierType,
      supplierDocument,
      supplierName: texto(task, ORDEM.nomeDoFornecedor),
      requesterName: texto(task, ORDEM.nomeDoSolicitante),
      requesterWhatsApp: texto(task, ORDEM.whatsapp),
      issueDate: texto(task, ORDEM.dataDeEmissao),
      dueDate: texto(task, ORDEM.dataVencimento),
      amountCents,
      paymentMethod,
      pixKey: texto(task, ORDEM.chavePix),
      barcode: texto(task, ORDEM.codigoDeBarras),
      pixCopyPaste: texto(task, ORDEM.pixCopiaECola),
      paymentLink: texto(task, ORDEM.linkDePagamento),
      manual: texto(task, ORDEM.integracaoManual) === "Manual",
      // Sem Campo dedicado no catálogo hoje (só a seleção "Manual" existe) —
      // o motivo do Fluxo Manual (D-12) fica só no Registro de Atividade, não
      // num FieldValue consultável aqui. `null` é o valor correto para um
      // Campo que não existe, não uma lacuna desta projeção.
      manualReason: null,
      productIds: lista(task, ORDEM.produto),
    },
    attachments: await montarAnexos(state, task, deps),
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

function autorDto(state: DataState, actor: ActorRef): CommentDtoV1["author"] {
  switch (actor.kind) {
    case "member": {
      const membro = state.members.find((m) => m.id === actor.id);
      return { kind: "member", id: actor.id, displayName: membro?.displayName ?? "Membro removido" };
    }
    case "agent": {
      const agente = state.agents.find((a) => a.id === actor.id);
      return { kind: "agent", id: actor.id, displayName: agente?.name ?? "Agente" };
    }
    case "automation": {
      const automacao = state.automations.find((a) => a.id === actor.id);
      return { kind: "automation", id: actor.id, displayName: automacao?.name ?? "Automação" };
    }
    case "integration": {
      const integracao = state.integrations.find((i) => i.id === actor.id);
      return { kind: "integration", id: actor.id, displayName: integracao?.name ?? "Integração" };
    }
    case "system":
      // `sistema/Formulário` (`formActor`, `packages/dominio/src/operations/scale.ts`)
      // é o único Ator `system` que o domínio produz hoje.
      return { kind: "system", id: actor.id, displayName: actor.id.startsWith("formulario:") ? "Formulário" : "Sistema" };
  }
}

/** Projeta um Comentário (raiz ou resposta) em `CommentDtoV1`. */
export function paraCommentDtoV1(state: DataState, taskId: Id, comment: Comment): CommentDtoV1 {
  return {
    id: comment.id,
    taskId,
    parentCommentId: comment.parentCommentId ?? null,
    author: autorDto(state, comment.author),
    text: comment.content,
    mentionMemberIds: comment.mentions.filter((m) => m.type === "member").map((m) => m.id),
    createdAt: comment.createdAt,
  };
}
