/**
 * O primeiro arquivo de `apps/api/src/servicos/` — o exemplo do contrato que
 * `CONTEXT.md` já previa: I/O ANTES de entrar na Unidade de Trabalho, depois
 * a operação pura DENTRO da transação. Existe porque PERS-09 precisa de duas
 * coisas em sequência que `executar()` sozinho não compõe: resolver o e-mail
 * do convite contra o Supabase Auth (Admin API — só `apps/api` alcança) e só
 * então rodar `inviteMember` (domínio puro, sem I/O).
 *
 * 12.3.2 — o convite passa a mandar e-mail de verdade. Quando o e-mail ainda
 * não tem Usuário, o Auth cria o Usuário e manda o convite
 * (`AuthDeConvite.convidar`), e o Membro nasce `pendente` já com esse `userId`.
 * Quando o e-mail já tem Usuário, nenhum e-mail sai: a pessoa entra com a senha
 * que já tem e aceita no primeiro acesso (`POST /convites/aceitar`).
 *
 * Antes de mandar o e-mail, o serviço ENSAIA `inviteMember` sobre o estado
 * lido do banco: um e-mail só sai se o domínio aceitaria o convite. Sem o
 * ensaio, quem não pode convidar (ou um convite repetido) faria o Auth mandar
 * um e-mail real antes de a recusa acontecer — um jeito de disparar e-mail com
 * o remetente da Tria para qualquer endereço. Se o domínio recusar mesmo assim
 * (outra gravação passou na frente entre o ensaio e a transação), o Usuário
 * recém-criado é apagado.
 *
 * A rota (`rotas/operacoes.ts`) não sabe do Auth; o domínio
 * (`packages/dominio`) não sabe do Auth; só este arquivo (e o adaptador
 * `autenticacao/auth-de-convite.ts`) sabe.
 */

import type { DataState, Member } from "@n1/dominio";
import { inviteMember } from "@n1/dominio/operations/members";
import { authDeConviteDoSupabase, type AuthDeConvite } from "../autenticacao/auth-de-convite";
import { resolverUsuarioPorEmail, type ResolverUsuario } from "../autenticacao/resolver-usuario";
import { pool } from "../persistencia/conexao";
import { hidratar } from "../persistencia/repositorio";
import { executar, type MedicaoDaExecucao, type ResultadoTransacao } from "../persistencia/unidade-de-trabalho";

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
    /** 12.3.2 — o Auth do convite por e-mail; os testes passam um falso. */
    readonly auth?: AuthDeConvite;
    /**
     * 1.1.5 — chamado DENTRO do callback de `executar()`, com o estado depois de
     * `inviteMember`. A rota guarda esse estado para recortar a resposta pelo
     * que quem convidou enxerga, igual ao caminho de `executar()` direto. O
     * convite roda no regime `travado` (uma tentativa só): o callback roda uma
     * vez por chamada.
     */
    readonly aoTerminar?: (state: DataState) => void;
    /**
     * Fase 12 (D-02) — repassado a `executar()` (`opcoes.aoMedir`): a medição por
     * etapa do convite chega à rota, que a escreve no log. Nunca vai ao corpo.
     */
    readonly aoMedir?: (medicao: MedicaoDaExecucao) => void;
  } = {},
): Promise<ResultadoTransacao<Member>> {
  // Resolve ANTES da transação: se existir uma conta no Auth com este
  // e-mail, `userId` reativa o MESMO Membro removido (RN-ET-11) e nenhum
  // e-mail sai.
  const resolver = deps.resolverUsuario ?? resolverUsuarioPorEmail;
  const auth = deps.auth ?? authDeConviteDoSupabase;
  const existente = await resolver(pedido.email);

  let criado: string | undefined;
  if (existente === undefined && (await dominioAceitaria(pedido))) {
    criado = await auth.convidar(pedido.email.trim().toLowerCase());
  }
  const userId = existente ?? criado;

  let resultado: ResultadoTransacao<Member>;
  try {
    resultado = await executar(
      pedido.workspaceId,
      (state) => {
        const r = inviteMember(state, pedido.actingMemberId, {
          email: pedido.email,
          roleId: pedido.roleId,
          ...(userId !== undefined ? { userId } : {}),
        });
        deps.aoTerminar?.(state);
        return r;
      },
      deps.aoMedir ? { aoMedir: deps.aoMedir } : {},
    );
  } catch (erro) {
    if (criado !== undefined) await apagarSemEngolir(auth, criado, erro);
    throw erro;
  }
  if (criado !== undefined && !resultado.ok) await auth.apagar(criado);
  return resultado;
}

/** O ensaio: `inviteMember` sobre o estado lido agora, numa cópia que ninguém grava. */
async function dominioAceitaria(pedido: PedidoDeConvite): Promise<boolean> {
  const cliente = await pool().connect();
  try {
    const { state } = await hidratar(cliente, pedido.workspaceId);
    return inviteMember(state, pedido.actingMemberId, { email: pedido.email, roleId: pedido.roleId }).ok;
  } finally {
    cliente.release();
  }
}

/** Apaga o Usuário criado sem esconder a exceção original: se o apagar também falhar, as duas sobem juntas. */
async function apagarSemEngolir(auth: AuthDeConvite, userId: string, original: unknown): Promise<void> {
  try {
    await auth.apagar(userId);
  } catch (falhaAoApagar) {
    throw new AggregateError([original, falhaAoApagar], "O convite falhou e o Usuário criado no Auth não foi apagado.");
  }
}
