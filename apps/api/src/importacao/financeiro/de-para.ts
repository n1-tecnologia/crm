/**
 * De-para de autoria: `id_responsavel` (ClickUp user id, coluna de
 * `public.solicitacoes_pagamentos`) → Membro JÁ EXISTENTE na plataforma.
 *
 * Reaproveita `DE_PARA_USUARIOS` do Plan 00-02
 * (`../clickup/de-para-usuarios.ts`) em vez de um segundo de-para
 * divergente. A diferença para o uso que aquele arquivo já tem: aqui só
 * conta `memberIdConhecido` — um Membro que já existe de fato no
 * `DataState` (hoje só a Maryane, `mem_maryane`). As demais entradas do
 * de-para (Elifas, Fabíola, Thiago, Iallas) têm e-mail resolvido mas ainda
 * NÃO são Membro: `memberActor(id)` exigiria um Membro que não existe, e
 * esta função nunca chama `inviteMember` para criar um (Task 2 do Plan
 * 02-22 é explícita: "a importação NÃO chama inviteMember" — quem convida,
 * se algum dia convidar, é um plano à parte). Para qualquer id sem
 * `memberIdConhecido` — incluindo o item em aberto `81581802`, sem e-mail
 * resolvido (`fonteDoEmail: "nao-resolvido"`) — a autoria não é
 * demonstrável: `importarSolicitacaoHistorica` usa `importActor`, não um
 * Membro inventado (D-25).
 */

import type { Id } from "@n1/dominio/types/primitives";
import { entradaPorClickupId } from "../clickup/de-para-usuarios";

export interface AutoriaLegadaResolvida {
  readonly memberId: Id;
}

/**
 * `undefined` — "autoria não demonstrável" — sempre que `clickupUserId`
 * estiver ausente, não tiver entrada no de-para, ou tiver entrada sem
 * `memberIdConhecido`. Nunca lança; nunca inventa e-mail ou Membro.
 */
export function resolverAutoriaLegada(clickupUserId: string | null | undefined): AutoriaLegadaResolvida | undefined {
  if (!clickupUserId) return undefined;
  const entrada = entradaPorClickupId(clickupUserId);
  if (!entrada?.memberIdConhecido) return undefined;
  return { memberId: entrada.memberIdConhecido };
}
