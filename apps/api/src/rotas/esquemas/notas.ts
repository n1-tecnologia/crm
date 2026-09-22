/**
 * A FORMA dos `args` das operações de
 * `packages/dominio/src/operations/ferramentas/notas.ts` — 1 operação. Ver
 * `../esquemas/CONTEXT.md` para a regra da pasta e `./fragmentos.ts` para o
 * porquê da validação ser de transporte, não de regra de negócio.
 */

import type { TipoDeAtivo } from "@n1/dominio/operations/ferramentas/notas";
import { z } from "zod";
import { type Confere, type Esquemas, type Igual } from "./fragmentos";

const TIPO_DE_ATIVO = z.enum(["grupo", "comunidade", "flow", "linkDeCaptacao"]);

/**
 * `satisfies` (sobre o tipo `Esquemas` de `./fragmentos`) é o portão de
 * drift: uma entrada cuja aridade ou tipo não bata com `ArgumentosDe<N>` não
 * compila. Se uma entrada não compilar, o erro está na entrada — não relaxar
 * para `z.ZodTypeAny`.
 */
export const NOTAS = {
  adicionarNotaNoAtivo: z.tuple([TIPO_DE_ATIVO, z.string(), z.string()]),
} satisfies Esquemas;

// ── Portão de enum bidirecional — falta ou sobra de membro não compila ──

type _EnumsCompletos = Confere<[Igual<z.infer<typeof TIPO_DE_ATIVO>, TipoDeAtivo>]>;
