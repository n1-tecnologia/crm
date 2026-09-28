/**
 * A FORMA dos `args` das operações de
 * `packages/dominio/src/operations/members.ts` — 5 operações. Ver
 * `../esquemas/CONTEXT.md` para a regra da pasta e `./fragmentos.ts` para o
 * porquê da validação ser de transporte, não de regra de negócio.
 */

import type { PermissionAction } from "@n1/dominio";
import { ID, opcional, type Confere, type Esquemas, type Igual } from "./fragmentos";
import { z } from "zod";

const PERMISSION_ACTION = z.enum(["ver", "comentar", "criar", "editar", "excluir", "administrar", "executar"]);

/**
 * O ÚNICO objeto `.strip()` da pasta — T-1-08: a única fonte de `userId` é
 * `resolverUsuarioPorEmail` dentro de `convidarMembro`, nunca o corpo. Um
 * `.strict()` aqui responderia 400 a um corpo com `userId` (informativo
 * demais para quem tenta) e quebraria `convidar-membro.test.ts` (c).
 * `.strip()` descarta a chave em silêncio, e `SERVICOS.inviteMember`
 * (`apps/api/src/rotas/operacoes.ts`) faz o mesmo de novo — duas barreiras
 * independentes, nenhuma removida. Validade de e-mail é regra do domínio
 * (`inviteMember`), não forma.
 */
const INVITE_MEMBER_INPUT = z.object({ email: z.string(), roleId: ID }).strip();

const DELETE_ROLE_DESTINATION = z.object({ memberRoleId: ID.optional(), agentRoleId: ID.optional() }).strict();

const GRANT_GOVERNANCE_ACCESS_INPUT = z
  .object({
    subjectKind: z.enum(["member", "team"]),
    subjectId: ID,
    resourceType: z.string(),
    resourceId: ID,
    actions: z.array(PERMISSION_ACTION),
    reason: z.string(),
  })
  .strict();

/**
 * `satisfies` (sobre o tipo `Esquemas` de `./fragmentos`) é o portão de
 * drift: uma entrada cuja aridade ou tipo não bata com `ArgumentosDe<N>` não
 * compila. Se uma entrada não compilar, o erro está na entrada — não relaxar
 * para `z.ZodTypeAny`.
 */
export const MEMBROS = {
  alterarEmailDoConvite: z.tuple([z.object({ memberId: ID, email: z.string().max(254) }).strict()]),
  alterarPapelDoMembro: z.tuple([z.object({ memberId: ID, roleId: ID }).strict()]),
  removeMember: z.tuple([ID, ID]),
  // `keepRoleId || undefined` em `transfer-ownership-dialog.tsx` — é a
  // origem do helper `opcional()` (`fragmentos.ts`).
  transferWorkspaceOwnership: z.tuple([ID, opcional(ID)]),
  inviteMember: z.tuple([INVITE_MEMBER_INPUT]),
  deleteRole: z.tuple([ID, DELETE_ROLE_DESTINATION]),
  grantGovernanceAccess: z.tuple([GRANT_GOVERNANCE_ACCESS_INPUT]),
} satisfies Esquemas;

// ── Portão de enum bidirecional — falta ou sobra de membro não compila ──

type _EnumsCompletos = Confere<[Igual<z.infer<typeof PERMISSION_ACTION>, PermissionAction>]>;
