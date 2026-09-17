/**
 * A FORMA dos `args` das operações de
 * `packages/dominio/src/operations/chat-folders.ts` — 4 operações. Ver
 * `../esquemas/CONTEXT.md` para a regra da pasta e `./fragmentos.ts` para o
 * porquê da validação ser de transporte, não de regra de negócio.
 */

import { ID, type Esquemas } from "./fragmentos";
import { z } from "zod";

/**
 * `satisfies` (sobre o tipo `Esquemas` de `./fragmentos`) é o portão de
 * drift: uma entrada cuja aridade ou tipo não bata com `ArgumentosDe<N>` não
 * compila. Se uma entrada não compilar, o erro está na entrada — não relaxar
 * para `z.ZodTypeAny`.
 */
export const PASTAS_DE_CHAT = {
  createChatFolder: z.tuple([z.object({ name: z.string() }).strict()]),
  renameChatFolder: z.tuple([ID, z.string()]),
  deleteChatFolder: z.tuple([ID]),
  // `null` é "raiz", valor de domínio — não usar `opcional()`, que o
  // transformaria em `undefined`.
  moveChatSessionToFolder: z.tuple([ID, ID.nullable()]),
} satisfies Esquemas;
