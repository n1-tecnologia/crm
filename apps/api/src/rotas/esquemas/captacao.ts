/**
 * A FORMA dos `args` das operações de
 * `packages/dominio/src/operations/ferramentas/captacao.ts` — 4 operações.
 * `registrarClique` e `simularEntradaPorClique` não entram em `OPERACOES`
 * (Evento do clique público, sem `actingMemberId`) e por isso não têm schema
 * aqui. Ver `../esquemas/CONTEXT.md` para a regra da pasta e
 * `./fragmentos.ts` para o porquê da validação ser de transporte, não de
 * regra de negócio.
 */

import type { CriterioDeCaptacao } from "@n1/dominio";
import { ID, type Confere, type Esquemas, type Igual } from "./fragmentos";
import { z } from "zod";

const CRITERIO_DE_CAPTACAO = z.enum(["porOrdem", "porCliques"]);

const CRIAR_LINK_INPUT = z
  .object({
    nome: z.string(),
    slug: z.string().optional(),
    gruposElegiveisIds: z.array(ID),
    criterio: CRITERIO_DE_CAPTACAO.optional(),
    ativo: z.boolean().optional(),
  })
  .strict();

const EDITAR_LINK_INPUT = z
  .object({
    nome: z.string().optional(),
    gruposElegiveisIds: z.array(ID).optional(),
    criterio: CRITERIO_DE_CAPTACAO.optional(),
    ativo: z.boolean().optional(),
  })
  .strict();

/**
 * `satisfies` (sobre o tipo `Esquemas` de `./fragmentos`) é o portão de
 * drift: uma entrada cuja aridade ou tipo não bata com `ArgumentosDe<N>` não
 * compila. Se uma entrada não compilar, o erro está na entrada — não relaxar
 * para `z.ZodTypeAny`.
 */
export const CAPTACAO = {
  criarLinkDeCaptacao: z.tuple([CRIAR_LINK_INPUT]),
  editarLinkDeCaptacao: z.tuple([ID, EDITAR_LINK_INPUT]),
  enviarLinkALixeira: z.tuple([ID]),
  restaurarLinkDaLixeira: z.tuple([ID]),
} satisfies Esquemas;

// ── Portão de enum bidirecional — falta ou sobra de membro não compila ──

type _EnumsCompletos = Confere<[Igual<z.infer<typeof CRITERIO_DE_CAPTACAO>, CriterioDeCaptacao>]>;
