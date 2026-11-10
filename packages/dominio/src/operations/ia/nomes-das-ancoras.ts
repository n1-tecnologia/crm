/**
 * O nome de uma Âncora do CRM novo (Negócio, Contato, Empresa, Conversa), como o
 * servidor o leu das tabelas (Fase 15, 3.4.9). Fica fora de `../ai` porque
 * `../ai` importa `./agentes` e `./agentes` também precisa dele (ensaio).
 */

import type { Id, NomesDasAncoras } from "../../types";

/**
 * `Object.hasOwn`: um id como "constructor" ou "__proto__" não herda nome do
 * protótipo de `nomes`. Sem entrada para o id, `undefined` — o registro não
 * existe neste Espaço (ou o Membro não pode lê-lo).
 */
export function nomeLidoDoCrm(nomes: NomesDasAncoras, id: Id): string | undefined {
  return Object.hasOwn(nomes, id) ? nomes[id] : undefined;
}
