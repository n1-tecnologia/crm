/**
 * Checklist 6.1/6.2 — a `revisao` que o `/resolver` do `automation/` devolve
 * ao lado do `dePara` (contrato `contas-a-pagar-v1`, v1.3): a leitura que a
 * IA fez do pedido de ajuste. É ela que vira escrita nos Campos da conta
 * (`publicarResumoParaConferencia`, `mudancasDoPedido`), então a ponte a
 * valida inteira, `.strict()`, antes de usar: uma chave a mais, um tipo
 * errado ou um valor fora do limite é resposta inválida — nada se aplica pela
 * metade.
 *
 * Os limites são os do produtor (`contas-a-pagar-routes.ts#revisaoDoPedido`,
 * `LIMITES_DA_LEITURA`); a forma de `mudancas` é `MudancasDoPedido` do
 * domínio.
 */

import { FORMAS_DO_PEDIDO, type MudancasDoPedido } from "@n1/dominio/operations/financeiro";
import { z } from "zod";

const dataIso = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const instante = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(instante.getTime()) && instante.toISOString().slice(0, 10) === v;
  }, "data inexistente");

const MUDANCAS = z
  .object({
    valorCentavos: z.number().int().positive().max(10_000_000_000).optional(),
    vencimento: dataIso.optional(),
    formaDePagamento: z.enum(FORMAS_DO_PEDIDO).optional(),
    chavePix: z.string().min(1).max(500).optional(),
    codigoDeBarras: z.string().min(1).max(500).optional(),
    pixCopiaECola: z.string().min(1).max(500).optional(),
    descricao: z.string().min(1).max(2000).optional(),
  })
  .strict();

const REVISAO = z
  .object({
    categoria: z.object({ codigo: z.string().regex(/^\d(\.\d{2}){2,3}$/), nome: z.string().min(1) }).strict().optional(),
    mudancas: MUDANCAS,
    naoEntendido: z.string().min(1).max(300).optional(),
  })
  .strict();

export interface RevisaoDoResolver {
  readonly categoria?: { readonly codigo: string; readonly nome: string };
  readonly mudancas: MudancasDoPedido;
  readonly naoEntendido?: string;
}

/**
 * A `revisao` do corpo do `/resolver`: ausente ⇒ `{ ok: true }` sem revisão
 * (sem pedido, sem IA, ou um `automation/` v1.2); presente e válida ⇒ a
 * revisão; presente e inválida ⇒ `{ ok: false }` — a ponte recusa a resposta
 * inteira, como recusa um corpo sem `dePara`.
 */
export function revisaoDoCorpo(corpo: unknown): { readonly ok: true; readonly revisao?: RevisaoDoResolver } | { readonly ok: false } {
  const bruta = corpo && typeof corpo === "object" ? (corpo as { readonly revisao?: unknown }).revisao : undefined;
  if (bruta === undefined) return { ok: true };
  const lida = REVISAO.safeParse(bruta);
  if (!lida.success) return { ok: false };
  const { categoria, mudancas, naoEntendido } = lida.data;
  return {
    ok: true,
    revisao: {
      ...(categoria ? { categoria } : {}),
      mudancas: Object.fromEntries(Object.entries(mudancas).filter(([, v]) => v !== undefined)) as MudancasDoPedido,
      ...(naoEntendido ? { naoEntendido } : {}),
    },
  };
}
