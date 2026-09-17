/**
 * A FORMA dos `args` de `POST /operacoes/:nome` — CR-02 (`01-REVIEW.md`).
 *
 * Isto é validação de TRANSPORTE, não regra de negócio: cada schema espelha
 * o TIPO TypeScript da assinatura de uma operação do domínio, nada mais. Uma
 * regra ("título não pode ficar vazio", "e-mail precisa ser válido", limites
 * numéricos) continua exclusivamente em `packages/dominio` — por isso nenhum
 * schema usa `.min()`, `.max()`, `.email()` ou faixa numérica; quem decide
 * isso é a operação, depois de receber a forma certa.
 *
 * Objetos são `.strict()`: uma chave que o domínio não conhece não é
 * inofensiva — é ruído que `gravar()` persistiria no `jsonb` compartilhado
 * (`plataforma.registros`), que TODOS os Membros do Espaço hidratam em
 * `GET /estado`. `.strict()` fecha essa porta antes da Unidade de Trabalho.
 *
 * A validação roda DEPOIS de `reviverArgumentos` (`registro.ts`) — por isso
 * os schemas usam `z.date()`, não a forma serializada `{ $tipo: "Date", iso }`
 * que só existe no corpo HTTP.
 *
 * Cobertura: os schemas vivem em `esquemas/<modulo>.ts` — um arquivo por
 * módulo do domínio, ver `esquemas/CONTEXT.md`. ATÉ o Plan 01-16, este
 * arquivo compõe `tarefas` + `automacoes` + `financeiro` (23) e as demais
 * operações continuam no fallback estrutural `ARGUMENTOS_GENERICOS`; o
 * fallback e `esquemaDeArgumentos` saem no Plan 01-16, quando a composição
 * passar a `satisfies EsquemasCompletos`.
 *
 * `inviteMember` fica DE PROPÓSITO fora de `ESQUEMAS`: `SERVICOS.inviteMember`
 * (`operacoes.ts`) já valida com `.strip()`, e é o ÚNICO lugar que descarta
 * `userId` do corpo (T-1-08) — um `.strict()` aqui quebraria
 * `convidar-membro.test.ts` (c), que depende do estrutural deixar
 * `{ email, roleId, userId }` passar para o `.strip()` fazer seu trabalho.
 */

import type { NomeDeOperacao } from "@n1/dominio/operations/registro";
import { z } from "zod";
import { AUTOMACOES } from "./esquemas/automacoes";
import { type Esquemas } from "./esquemas/fragmentos";
import { FINANCEIRO } from "./esquemas/financeiro";
import { TAREFAS } from "./esquemas/tarefas";

export type { ArgumentosDe } from "./esquemas/fragmentos";

/** Composição por spread — preserva o tipo literal de cada chave. */
export const ESQUEMAS = { ...TAREFAS, ...AUTOMACOES, ...FINANCEIRO } satisfies Esquemas;

/** A forma mais funda que uma operação recebe hoje tem 4 níveis
 * (`AgentDraft.knowledgeSources[].kind`) — 6 é folga, não aperto. `z.date()`
 * recusa `Invalid Date`, que `reviverArgumentos` produz de um `iso` lixo. O
 * que o estrutural NÃO garante — e a rota compensa mapeando `TypeError` — é
 * tipo-por-campo nas operações sem schema próprio. */
const PROFUNDIDADE_MAXIMA = 6;

function valorJson(nivel: number): z.ZodTypeAny {
  const folha = z.union([z.string(), z.number(), z.boolean(), z.null(), z.date()]);
  if (nivel === 0) return folha;
  const proximoNivel = valorJson(nivel - 1);
  return z.union([folha, z.array(proximoNivel), z.record(z.string(), proximoNivel)]);
}

/** Fallback estrutural para operações sem entrada em `ESQUEMAS`. */
export const ARGUMENTOS_GENERICOS: z.ZodType<unknown[]> = z.array(valorJson(PROFUNDIDADE_MAXIMA));

/** `ESQUEMAS[nome] ?? ARGUMENTOS_GENERICOS`. */
export function esquemaDeArgumentos(nome: NomeDeOperacao): z.ZodType<unknown[]> {
  // `ESQUEMAS` é `Partial<Record<...>>` na prática (nem toda operação tem
  // entrada) — o cast é só isso; a FORMA de cada valor já foi garantida pelo
  // portão de drift dos arquivos de `esquemas/`.
  const esquemasPorNome = ESQUEMAS as Partial<Record<NomeDeOperacao, z.ZodType<unknown[]>>>;
  return esquemasPorNome[nome] ?? ARGUMENTOS_GENERICOS;
}
