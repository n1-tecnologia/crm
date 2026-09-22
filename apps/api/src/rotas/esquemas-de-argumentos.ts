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
 * Cobertura: TODAS as operações de `OPERACOES` (132) — um arquivo por módulo
 * do domínio em `esquemas/`, ver `esquemas/CONTEXT.md`, composto aqui sob o
 * portão de completude abaixo: registrar uma operação nova em `OPERACOES`
 * sem acrescentar o schema correspondente a algum dos 15 arquivos de
 * `esquemas/` é erro de COMPILAÇÃO, apontando o nome que falta — não existe
 * mais fallback estrutural, nem operação alcançável por HTTP sem schema
 * próprio.
 *
 * `inviteMember` está em `esquemas/membros.ts`, com o único `.strip()` da
 * pasta: `SERVICOS.inviteMember` (`operacoes.ts`) também valida com
 * `.strip()` e é quem de fato descarta `userId` do corpo (T-1-08) — as duas
 * barreiras são redundantes de propósito, nenhuma substitui a outra.
 *
 * Assimetria de IN-10: `satisfies` prende só a checagem de schema NUM
 * sentido — a saída do schema precisa ser atribuível ao tipo da assinatura;
 * um schema MAIS ESTRITO (um campo obrigatório que na assinatura é
 * opcional, um `.strict()` que esqueça uma chave) compila sem erro e viraria
 * 400 falso para uma chamada legítima do `apps/web`. A rede contra essa
 * assimetria é dupla: `Igual<A,B>` (`fragmentos.ts`) fecha os `z.enum` nos
 * dois sentidos, e o caso "(b) formas literais do web" de cada
 * `esquemas/<modulo>.test.ts` prova, call site a call site, que a forma real
 * passa — uma checagem de tipo bidirecional para OBJETOS não fecha por causa
 * de `readonly`/`?:` vs `| undefined`, por isso não é tentada aqui.
 *
 * Segunda rodada de CR-02 (Plans 01-12..01-16): 01-12 fechou WR-10 e criou a
 * fundação (`esquemas/fragmentos.ts` + o molde `tarefas`/`automacoes`/
 * `financeiro`); 01-13/14/15 escreveram os outros 12 módulos em paralelo;
 * este arquivo (01-16) fecha a composição.
 */

import type { NomeDeOperacao } from "@n1/dominio/operations/registro";
import { z } from "zod";
import { AUTOMACOES } from "./esquemas/automacoes";
import { CAPTACAO } from "./esquemas/captacao";
import { COLABORACAO } from "./esquemas/colaboracao";
import { COMUNIDADES } from "./esquemas/comunidades";
import { CONFIGURACAO } from "./esquemas/configuracao";
import { CONSTRUTOR_DE_AGENTES } from "./esquemas/construtor-de-agentes";
import { CONTATOS } from "./esquemas/contatos";
import { CONVERSAS } from "./esquemas/conversas";
import { ESCALA } from "./esquemas/escala";
import { ESTRUTURA } from "./esquemas/estrutura";
import { type EsquemasCompletos } from "./esquemas/fragmentos";
import { FINANCEIRO } from "./esquemas/financeiro";
import { IA } from "./esquemas/ia";
import { INICIAR_CONVERSA } from "./esquemas/iniciar-conversa";
import { MEMBROS } from "./esquemas/membros";
import { NEGOCIOS } from "./esquemas/negocios";
import { NOTAS } from "./esquemas/notas";
import { PASTAS_DE_CHAT } from "./esquemas/pastas-de-chat";
import { PLANEJAMENTO } from "./esquemas/planejamento";
import { TAREFAS } from "./esquemas/tarefas";

export type { ArgumentosDe } from "./esquemas/fragmentos";

/**
 * Composição por spread — preserva o tipo literal de cada chave. O
 * `satisfies` abaixo é o portão de completude: faltar UMA operação de
 * `OPERACOES` (132) não compila, apontando o nome dela.
 */
export const ESQUEMAS = {
  ...TAREFAS,
  ...AUTOMACOES,
  ...FINANCEIRO,
  ...NEGOCIOS,
  ...CONVERSAS,
  ...CONTATOS,
  ...IA,
  ...PASTAS_DE_CHAT,
  ...CONSTRUTOR_DE_AGENTES,
  ...CONFIGURACAO,
  ...COLABORACAO,
  ...PLANEJAMENTO,
  ...ESCALA,
  ...MEMBROS,
  ...ESTRUTURA,
  ...NOTAS,
  ...CAPTACAO,
  ...COMUNIDADES,
  ...INICIAR_CONVERSA,
} satisfies EsquemasCompletos;

/**
 * `ESQUEMAS[nome]` — nunca fallback: toda operação do registro tem schema
 * próprio (portão `EsquemasCompletos` acima). O cast relaxa só a união das
 * 132 assinaturas específicas que a rota — genérica sobre `NomeDeOperacao`
 * — não consegue indexar sem um genérico por chamada; a FORMA de cada valor
 * já foi garantida pelo portão de completude e pelo `satisfies` de cada
 * arquivo de `esquemas/`.
 */
export function esquemaDeArgumentos(nome: NomeDeOperacao): z.ZodType<unknown[]> {
  return (ESQUEMAS as Record<NomeDeOperacao, z.ZodType<unknown[]>>)[nome];
}
