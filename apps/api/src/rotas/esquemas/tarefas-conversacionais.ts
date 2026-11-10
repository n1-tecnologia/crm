/**
 * A FORMA dos `args` das operações de
 * `packages/dominio/src/operations/tarefas-conversacionais.ts` — 2
 * operações (o modelo e os canais da Lista). A Tarefa conversacional em si
 * nasce e muda pelas rotas `/tarefas-conversacionais`, não por aqui (14-17).
 * Ver `../esquemas/CONTEXT.md` para a regra da pasta.
 */

import { ID, MODELO_DE_TAREFA, opcional, type Esquemas } from "./fragmentos";
import type { Canal } from "@n1/dominio/crm/canais";
import { z } from "zod";

/**
 * 3.3.7 — o `Canal[]` que a execução local de `definirCanaisDaLista` e de
 * `createList` leva como último argumento. O servidor NUNCA o usa: `LER_DO_CRM`
 * (`rotas/operacoes.ts`) o troca pelo que leu de `plataforma.canais` na
 * transação (T-14-29). Aqui só cabe a forma (um `id` por item, `.passthrough()`
 * para o resto do Canal) e o tamanho (T-14-30); o conteúdo é descartado.
 *
 * O tipo de saída declarado é o do domínio (`readonly Canal[]`) só para o
 * schema satisfazer a assinatura de `definirCanaisDaLista` e `createList`
 * (`Esquemas`): o valor que sai daqui nunca chega ao domínio, porque quem
 * despacha sobrescreve a posição pelo que `lerDoCrm` leu.
 */
export const CANAIS_DO_NAVEGADOR = z.array(z.object({ id: ID }).passthrough()).max(100) as unknown as z.ZodType<readonly Canal[]>;

export const TAREFAS_CONVERSACIONAIS = {
  alterarModeloDaLista: z.tuple([ID, MODELO_DE_TAREFA]),
  definirCanaisDaLista: z.tuple([ID, z.array(ID), opcional(CANAIS_DO_NAVEGADOR)]),
} satisfies Esquemas;
