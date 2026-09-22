/**
 * Notas (Comentários, A8) nos Ativos de Canal: o mesmo gesto de
 * `addCompanyNote`, para Grupo, Comunidade, Link e Flow. Uma nota nunca sai
 * da plataforma — não é Mensagem.
 */

import { fail, ok, type DataState, type OperationResult } from "../../state";
import type { Comment, Id } from "../../types";
import { memberActor, nextId, recordActivity } from "../activity";
import { recusaDeMembroAtivo } from "./permissoes";

export type TipoDeAtivo = "grupo" | "comunidade" | "flow" | "linkDeCaptacao";

function ativoPorTipo(state: DataState, tipo: TipoDeAtivo, id: Id): { readonly id: Id; readonly nome: string; readonly comments: Comment[]; readonly lifecycle: string } | undefined {
  switch (tipo) {
    case "grupo":
      return state.grupos.find((g) => g.id === id);
    case "comunidade":
      return state.comunidades.find((c) => c.id === id);
    case "flow":
      return state.flows.find((f) => f.id === id);
    case "linkDeCaptacao":
      return state.linksDeCaptacao.find((l) => l.id === id);
  }
}

export function adicionarNotaNoAtivo(state: DataState, actingMemberId: Id, tipo: TipoDeAtivo, id: Id, content: string): OperationResult<Comment> {
  const membro = recusaDeMembroAtivo(state, actingMemberId);
  if (membro) return fail(membro);
  const ativo = ativoPorTipo(state, tipo, id);
  if (!ativo) return fail("Registro não encontrado.");
  if (ativo.lifecycle === "naLixeira") return fail("Um registro na lixeira não recebe notas.");
  const texto = content.trim();
  if (!texto) return fail("Escreva a nota antes de enviar.", "conteudo");
  const comment: Comment = {
    id: nextId("cmt"),
    author: memberActor(actingMemberId),
    content: texto,
    attachments: [],
    mentions: [],
    createdAt: new Date().toISOString(),
  };
  ativo.comments.push(comment);
  recordActivity(state, { actor: memberActor(actingMemberId), action: "Nota registrada", objectType: tipo, objectId: ativo.id, objectName: ativo.nome });
  return ok(comment);
}
