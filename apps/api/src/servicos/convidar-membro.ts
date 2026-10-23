/**
 * O primeiro arquivo de `apps/api/src/servicos/` — o exemplo do contrato que
 * `CONTEXT.md` já previa: I/O ANTES de entrar na Unidade de Trabalho, depois
 * a operação pura DENTRO da transação. Existe porque PERS-09 precisa de duas
 * coisas em sequência que `executar()` sozinho não compõe: resolver o e-mail
 * do convite contra o Supabase Auth (Admin API — só `apps/api` alcança) e só
 * então rodar `inviteMember` (domínio puro, sem I/O).
 *
 * A rota (`rotas/operacoes.ts`) não sabe do Auth; o domínio
 * (`packages/dominio`) não sabe do Auth; só este arquivo sabe.
 */

import type { DataState, Member } from "@n1/dominio";
import { inviteMember } from "@n1/dominio/operations/members";
import { resolverUsuarioPorEmail, type ResolverUsuario } from "../autenticacao/resolver-usuario";
import { executar, type ResultadoTransacao } from "../persistencia/unidade-de-trabalho";

export interface PedidoDeConvite {
  readonly workspaceId: string;
  readonly actingMemberId: string;
  readonly email: string;
  readonly roleId: string;
}

export async function convidarMembro(
  pedido: PedidoDeConvite,
  deps: {
    readonly resolverUsuario?: ResolverUsuario;
    /**
     * 1.1.5 — chamado DENTRO do callback de `executar()`, com o estado depois de
     * `inviteMember`. A rota guarda esse estado para recortar a resposta pelo
     * que quem convidou enxerga, igual ao caminho de `executar()` direto. A
     * última tentativa (conflito de revisão repete o callback) é a que vale.
     */
    readonly aoTerminar?: (state: DataState) => void;
  } = {},
): Promise<ResultadoTransacao<Member>> {
  // Resolve ANTES da transação: se existir uma conta no Auth com este
  // e-mail, `userId` reativa o MESMO Membro removido (RN-ET-11); se não
  // existir, `inviteMember` segue o caminho de hoje — Membro `pendente` por
  // `invitedIdentity`, sem `userId` (comportamento inalterado).
  const resolver = deps.resolverUsuario ?? resolverUsuarioPorEmail;
  const userId = await resolver(pedido.email);

  return executar(pedido.workspaceId, (state) => {
    const resultado = inviteMember(state, pedido.actingMemberId, {
      email: pedido.email,
      roleId: pedido.roleId,
      ...(userId !== undefined ? { userId } : {}),
    });
    deps.aoTerminar?.(state);
    return resultado;
  });
}
