/**
 * Os helpers de fixture da ponte do Agente de lançamento
 * (`../automacoes/invocar-agente.ts`) para os testes NOVOS de 06-12 e 06-13
 * (CON-05: regra nova, arquivo novo). São cópias, sem mudança de
 * comportamento, dos helpers de `../automacoes/invocar-agente.test.ts`
 * (linhas 70-220 e `ponteSobre`, 551-564) — aquele arquivo mantém as suas
 * cópias de propósito, para que nenhum caso existente mude por causa deste
 * módulo.
 *
 * Harness, não produção: nenhum código de `src/` fora de teste importa daqui.
 * O módulo não importa o executor de testes: onde o original conferia uma
 * pré-condição com uma asserção, aqui ele lança `Error` com o que não bateu.
 */

import { buildSeed } from "@n1/dominio/seed";
import { decideProcessApproval } from "@n1/dominio/operations/ai";
import { CP, conferenciaDoResumo, publicarResumoParaConferencia, type ConferenciaDoResumo } from "@n1/dominio/operations/financeiro";
import { addTaskComment, changeTaskStatus } from "@n1/dominio/operations/tasks";
import type { DataState, Task, WorkspaceFile } from "@n1/dominio";
import { chaveDeIdempotencia, criarPonteDoAgente, type OpcoesDaPonte } from "../automacoes/invocar-agente";
import type { ServidorFalso } from "./servidor-falso";

export { buildSeed };

export const S = CP.status;
export const F = CP.fields;
export const MARYANE = CP.financeiroId;
/** O Membro que assina pela ponte nos testes (o "Agente do pipeline" de ws_n1 faz o papel em produção). */
export const ATOR = "mem_thiago";
export const RESOLVER = "/v1/integrations/contas-a-pagar/resolver";
export const LANCAR = "/v1/integrations/contas-a-pagar/lancar";

export function conta(estado: DataState, id: string): Task {
  const t = estado.tasks.find((x) => x.id === id);
  if (!t) throw new Error(`sem ${id}`);
  return t;
}

export function definir(task: Task, definitionId: string, value: string): void {
  task.fieldValues = task.fieldValues.filter((v) => v.definitionId !== definitionId);
  task.fieldValues.push({ definitionId, value, state: "ativo" });
}

/**
 * Só `id` fica nos Status que a ponte olha ("para pagar" e "em lançamento
 * omie"): as outras contas do seed saem do jogo (isolamento de fixture, não
 * regra), porque o Momento 1 publicaria um Resumo em cada conta completa.
 */
export function isolar(estado: DataState, id: string, categoria = "Impostos"): Task {
  for (const t of estado.tasks) {
    if (t.listId === CP.listId && t.id !== id && (t.statusId === S.emLancamento || t.statusId === S.paraPagar)) t.statusId = S.lancado;
  }
  const t = conta(estado, id);
  definir(t, F.categoria, categoria);
  return t;
}

/**
 * Isola `id` e o faz ENTRAR em "em lançamento omie" por movimento:
 * `changeTaskStatus` da Maryane, que confere as exigências de saída de "para
 * pagar" — o caminho real que a ponte espera.
 */
export function prepararEmLancamento(estado: DataState, id: string, categoria: string): Task {
  const t = isolar(estado, id, categoria);
  if (t.statusId !== S.paraPagar) throw new Error(`pré-condição: ${id} deveria estar em "para pagar" (está em ${t.statusId})`);
  const movida = changeTaskStatus(estado, MARYANE, t.id, S.emLancamento);
  if (!movida.ok) throw new Error(movida.error);
  return t;
}

export function mover(estado: DataState, id: string, statusId: string): void {
  const r = changeTaskStatus(estado, MARYANE, id, statusId);
  if (!r.ok) throw new Error(r.error);
}

/** Sai e volta para "em lançamento omie", por movimento — o gesto que pede nova tentativa. */
export function sairEVoltar(estado: DataState, id: string): void {
  mover(estado, id, S.paraPagar);
  mover(estado, id, S.emLancamento);
}

/** A Unidade de Trabalho em memória: aplica a operação no estado do teste. */
export function executarEmMemoria(estado: DataState) {
  return async (operacao: (s: DataState) => { readonly ok: boolean; readonly error?: string }) => {
    const r = operacao(estado);
    return r.ok ? ({ ok: true } as const) : ({ ok: false, error: r.error ?? "recusado" } as const);
  };
}

export function dePara200(categoria: string, resolucao: { readonly veredito: "resolvida" | "revisar"; readonly similaridade?: number; readonly motivo?: string }) {
  return {
    dePara: {
      contaPorTag: { "conta tria": "TRIA COMPANY - ITAU" },
      categoriaPorCampo: {
        [categoria]:
          resolucao.veredito === "resolvida"
            ? { veredito: "resolvida" as const, nome: "Impostos e taxas", codigo: "2.06.01", similaridade: resolucao.similaridade ?? 0.9 }
            : { veredito: "revisar" as const, nome: "Impostos e taxas", codigo: "2.06.01", similaridade: resolucao.similaridade ?? 0.4, motivo: resolucao.motivo ?? "abaixo do corte" },
      },
      origem: "omie" as const,
    },
  };
}

export const RESOLVIDA = { kind: "ok", status: 200, corpo: dePara200("Impostos", { veredito: "resolvida" }) } as const;
export const LANCADO_200 = {
  kind: "ok",
  status: 200,
  corpo: { payableId: "pay_das_1", codigoLancamentoIntegracao: chaveDeIdempotencia("tsk_cp_das"), reaproveitado: false, anexos: [] },
} as const;

export function erro422(code: string, motivo?: string, message = "A plataforma recusou o lançamento.") {
  return {
    kind: "ok",
    status: 422,
    corpo: { error: { code, message, requestId: "req_1", retryable: false, ...(motivo !== undefined ? { details: { motivo } } : {}) } },
  } as const;
}

export function erro503(code = "OMIE_INDISPONIVEL") {
  return { kind: "ok", status: 503, corpo: { error: { code, message: "Tente de novo.", requestId: "req_2", retryable: true } } } as const;
}

export const comentariosDoAgente = (t: Task) => t.comments.filter((c) => c.author.kind === "agent" && c.author.id === CP.agentId);
export const resumosDe = (t: Task) => comentariosDoAgente(t).filter((c) => c.content.startsWith("📋 RESUMO DE PAGAMENTO"));

/** A Conferência vigente da conta (lança se não houver). */
export function vigente(estado: DataState, t: Task): ConferenciaDoResumo {
  const c = conferenciaDoResumo(estado, t).conferencia;
  if (!c) throw new Error("sem Conferência");
  return c;
}

/** Publica o Resumo pelo domínio (como a ponte faria) e o confere por clique da Maryane. */
export function conferirPeloDominio(estado: DataState, t: Task): ConferenciaDoResumo {
  const p = publicarResumoParaConferencia(estado, ATOR, t.id, { dePara: dePara200("Impostos", { veredito: "resolvida" }).dePara });
  if (!p.ok) throw new Error(p.error);
  const d = decideProcessApproval(estado, MARYANE, p.value.conferencia.id, "aprovada", { source: "click" });
  if (!d.ok) throw new Error(d.error);
  return p.value.conferencia;
}

/** `das` isolada, conferida e movida para "em lançamento omie" — pronta para o Momento 2. */
export function conferidaEmLancamento(estado: DataState, id = "tsk_cp_das"): Task {
  const t = isolar(estado, id);
  conferirPeloDominio(estado, t);
  mover(estado, id, S.emLancamento);
  const estadoDaConferencia = conferenciaDoResumo(estado, t).estado;
  if (estadoDaConferencia !== "conferida") throw new Error(`pré-condição: a Conferência deveria estar "conferida" (está "${estadoDaConferencia}")`);
  return t;
}

/** Um revisor responde no fio do Resumo. */
export function responder(estado: DataState, t: Task, autor: string, texto: string): void {
  const c = vigente(estado, t);
  const r = addTaskComment(estado, autor, t.id, { content: texto, parentCommentId: c.origin.threadCommentId });
  if (!r.ok) throw new Error(r.error);
}

export function arquivo(estado: DataState, id: string, name: string): WorkspaceFile {
  const f: WorkspaceFile = {
    id,
    workspaceId: estado.workspace.id,
    name,
    mediaType: "document",
    sizeBytes: 100,
    createdBy: { kind: "member", id: MARYANE },
    createdAt: "2026-09-01T12:00:00.000Z",
    objectKey: `obj/${id}`,
    state: "enviado",
  };
  estado.files.push(f);
  return f;
}

export const assinarFalso = async (objectKey: string) => ({ downloadUrl: `https://storage.exemplo.invalid/${objectKey}?token=segredo-assinado` });

/** A ponte em modo `lancar` sobre `estado`, com tudo em memória — igual a `ponteSobre` de `invocar-agente.test.ts`. */
export function ponteSobre(servidor: ServidorFalso, estado: DataState, extra: Partial<OpcoesDaPonte> = {}) {
  return criarPonteDoAgente({
    destinoUrl: servidor.url,
    token: "tok-lancar",
    workspaceId: estado.workspace.id,
    listId: CP.listId,
    modo: "lancar",
    hidratarEstado: async () => estado,
    resolverAtor: async () => ATOR,
    executarOperacao: executarEmMemoria(estado),
    assinarAnexo: assinarFalso,
    ...extra,
  });
}
