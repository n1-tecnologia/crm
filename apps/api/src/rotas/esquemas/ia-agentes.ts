/**
 * A FORMA dos `args` das operações de
 * `packages/dominio/src/operations/ia/agentes.ts` — 8 operações. Ver
 * `../esquemas/CONTEXT.md` para a regra da pasta.
 */

import { ID, NOMES_DO_NAVEGADOR, opcional, type Esquemas } from "./fragmentos";
import { z } from "zod";

/** `anchor.type` é `string` no domínio (não uma união) — espelhado como tal. */
const ENSAIO_INPUT = z
  .object({
    texto: z.string(),
    anchor: z.object({ type: z.string(), id: ID }).strict().optional(),
  })
  .strict();

export const IA_AGENTES = {
  ativarAgente: z.tuple([ID]),
  pausarAgente: z.tuple([ID]),
  arquivarAgente: z.tuple([ID]),
  enviarAgenteALixeira: z.tuple([ID]),
  transferirAgente: z.tuple([ID, ID]),
  // `nomes` opcional no fim: o navegador pode mandá-lo, o servidor o descarta (T-15-24).
  ensaiarAgente: z.tuple([ID, ENSAIO_INPUT, opcional(NOMES_DO_NAVEGADOR)]),
  // `motivo?` posicional no fim — `opcional()` aceita ausente e `null`.
  cancelarExecucao: z.tuple([ID, opcional(z.string())]),
  apagarItemDeMemoria: z.tuple([ID, ID]),
} satisfies Esquemas;
