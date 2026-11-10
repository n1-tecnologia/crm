/**
 * A troca dos Vínculos na mesclagem de Contatos (3.2.2, INV-CON-07).
 *
 * Dois pedaços, um só comportamento:
 *   - `reapontarContatoNosVinculos` é a função pura que a `mergeContacts`
 *     antiga (`contacts.ts`) e a mesclagem do modelo novo compartilham: todo
 *     Vínculo que toca o absorvido passa ao sobrevivente, e dois que ficam
 *     iguais se fundem, ficando o mais antigo.
 *   - `mesclarContatoNoEspaco` é a operação que a api chama dentro do gesto
 *     misto: o Contato mora em `plataforma.contatos`, e aqui só o que mora em
 *     `registros` muda (Vínculos, âncoras de Sessão de Chat, Atividade).
 *
 * `mesclarContatoNoEspaco` está FORA de `OPERACOES` (`registro.ts`), pelo mesmo
 * motivo das variantes `…NasTabelas`: os dois Contatos chegam em `referencias`,
 * lidos e conferidos pelo servidor dentro da transação (ele já exigiu o Papel e
 * a regra de `validarMesclagem`). Abri-la em `POST /operacoes/:nome` deixaria o
 * navegador dizer que qualquer id é "o Contato mesclado".
 *
 * D-01: não traduz id antigo em novo. Reaponta só o Vínculo que já usa o id da
 * tabela nova; os do modelo inglês seguem pela `mergeContacts`.
 */

import { fail, ok, type DataState, type OperationResult } from "../state";
import type { Id, Link } from "../types";
import { memberActor, recordActivity } from "./activity";

const tocaContato = (vinculo: Link, contatoId: Id): boolean =>
  (vinculo.toType === "contact" && vinculo.toId === contatoId) || (vinculo.fromType === "contact" && vinculo.fromId === contatoId);

/**
 * Passa ao sobrevivente os Vínculos do absorvido (os que chegam nele e os que
 * saem dele) e funde os que ficam iguais (mesma origem, destino e papel). Fica o
 * MAIS ANTIGO: `state.links` só cresce por append, então a ordem do array é a
 * ordem de criação e o primeiro visto é o mais antigo. Não muda a lista de entrada.
 */
export function reapontarContatoNosVinculos(links: readonly Link[], absorvidoId: Id, sobreviventeId: Id): Link[] {
  const reapontados = links.map((vinculo) =>
    tocaContato(vinculo, absorvidoId)
      ? {
          ...vinculo,
          ...(vinculo.toType === "contact" && vinculo.toId === absorvidoId ? { toId: sobreviventeId } : {}),
          ...(vinculo.fromType === "contact" && vinculo.fromId === absorvidoId ? { fromId: sobreviventeId } : {}),
        }
      : vinculo,
  );
  const vistos = new Set<string>();
  return reapontados.filter((vinculo) => {
    if (!tocaContato(vinculo, sobreviventeId)) return true;
    const chave = `${vinculo.fromType}|${vinculo.fromId}|${vinculo.toType}|${vinculo.toId}|${vinculo.role ?? ""}`;
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
}

/** Os dois Contatos que a api leu e conferiu nas tabelas: id e nome de exibição. */
export interface ReferenciasDaMesclagem {
  readonly sobrevivente: { readonly id: Id; readonly nome: string };
  readonly absorvido: { readonly id: Id; readonly nome: string };
}

/**
 * A parte da mesclagem que mora em `registros`: reaponta os Vínculos, as
 * âncoras das Sessões de Chat (trocando o valor, nunca mexendo no interior) e
 * grava as duas Atividades de hoje. Devolve quantos Vínculos tocavam o absorvido.
 */
export function mesclarContatoNoEspaco(
  state: DataState,
  actingMemberId: Id,
  referencias: ReferenciasDaMesclagem,
): OperationResult<{ readonly vinculosReapontados: number }> {
  const { sobrevivente, absorvido } = referencias;
  if (sobrevivente.id === absorvido.id) return fail("Escolha dois Contatos diferentes.");

  const vinculosReapontados = state.links.filter((vinculo) => tocaContato(vinculo, absorvido.id)).length;
  state.links = reapontarContatoNosVinculos(state.links, absorvido.id, sobrevivente.id);
  for (const sessao of state.chatSessions) {
    if (sessao.anchor?.type === "contact" && sessao.anchor.id === absorvido.id) {
      sessao.anchor = { ...sessao.anchor, id: sobrevivente.id };
    }
  }

  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Contato sobrevivente da mesclagem",
    objectType: "contact",
    objectId: sobrevivente.id,
    objectName: sobrevivente.nome,
  });
  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Contato mesclado",
    objectType: "contact",
    objectId: absorvido.id,
    objectName: absorvido.nome,
    after: sobrevivente.nome,
  });
  return ok({ vinculosReapontados });
}
