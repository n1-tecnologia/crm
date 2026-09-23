/**
 * A FORMA dos `args` das operações do processo Financeiro — 3 operações: as 2
 * de `packages/dominio/src/operations/financeiro.ts` mais a conversão de
 * Solicitação aprovada em Conta a pagar (D3-08), que no domínio mora em
 * `operations/conversao-de-solicitacao.ts` — arquivo próprio lá para não criar
 * o ciclo `financeiro ⇄ automations`, mesmo processo aqui. Ver
 * `../esquemas/CONTEXT.md` para a regra da pasta.
 */

import type { OrigemDoDePara, ResolucaoDeCategoria, VereditoDeCategoria } from "@n1/dominio/operations/financeiro";
import { ID, opcional, type Confere, type Esquemas, type Igual } from "./fragmentos";
import { z } from "zod";

const RECEIVABLE_SERIES_INPUT = z
  .object({
    contactId: ID,
    centroDeCusto: z.string(),
    empresa: z.string().optional(),
    produto: z.string().optional(),
    forma: z.string().optional(),
    valorEntrada: z.number().optional(),
    vencimentoEntrada: z.string().optional(),
    valorParcela: z.number(),
    parcelas: z.number(),
    primeiroVencimento: z.string(),
  })
  .strict();

/**
 * O de-para do lançamento (D3-02/D3-03) atravessa um processo e uma rede antes
 * de virar argumento de uma função pura do domínio, que não tem como conferi-lo
 * contra a fonte. Daí o `.strict()` em cada objeto (campo a mais é 400) e o
 * `origem` obrigatório: um lançamento feito com a tabela fictícia do protótipo
 * precisa ser legível na Execução, não silencioso (T-3-07).
 */
const ORIGEM_DO_DE_PARA = z.enum(["prototipo", "omie"]);

const RESOLUCAO_DE_CATEGORIA = z.discriminatedUnion("veredito", [
  z.object({ veredito: z.literal("resolvida"), nome: z.string(), codigo: z.string(), similaridade: z.number().optional() }).strict(),
  // `"revisar"`: não se manda uma conta para revisão sem o motivo e sem o número que o motivou.
  z.object({ veredito: z.literal("revisar"), nome: z.string(), codigo: z.string(), similaridade: z.number(), motivo: z.string() }).strict(),
]);

const DE_PARA_DE_LANCAMENTO = z
  .object({
    contaPorTag: z.record(z.string(), z.string()),
    categoriaPorCampo: z.record(z.string(), RESOLUCAO_DE_CATEGORIA),
    origem: ORIGEM_DO_DE_PARA,
  })
  .strict();

const OPCOES_DE_LANCAMENTO = z.object({ dePara: DE_PARA_DE_LANCAMENTO, rehearsal: z.boolean().optional() }).strict();

export const FINANCEIRO = {
  createReceivableSeries: z.tuple([RECEIVABLE_SERIES_INPUT]),
  // `opcoes?: OpcoesDeLancamento` — parâmetro posicional opcional no fim.
  runLancamentoAgent: z.tuple([ID, ID, ID, opcional(OPCOES_DE_LANCAMENTO)]),
  // D3-08 — um id e nada mais: quem decide o Status de destino, o de-para dos
  // Campos, o vencimento e as lacunas é o domínio, não o corpo da requisição.
  converterSolicitacaoEmContaAPagar: z.tuple([ID]),
} satisfies Esquemas;

// ── Portão de enum bidirecional — falta ou sobra de membro não compila ──

type _EnumsCompletos = Confere<
  [Igual<z.infer<typeof ORIGEM_DO_DE_PARA>, OrigemDoDePara>, Igual<ResolucaoDeCategoria["veredito"], VereditoDeCategoria>]
>;
