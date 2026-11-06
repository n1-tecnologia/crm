/**
 * Os clientes das contas de uma Lista, lidos de `plataforma.contatos` para a agenda (15-42, WINDOWS #35).
 *
 * As Automações de Contas a receber (R4/R5) dizem o nome do cliente e mencionam o dono dele no comentário de
 * cobrança. O estado não guarda mais Contato (3.5.4): o nome e o dono saem da tabela, na MESMA transação da
 * volta (`lerDoCrm` de `executar()`), e entram na rodada por `OpcoesDaAgenda.clientes`. O domínio só os recebe.
 *
 * Lê só os Contatos que as Tarefas da Lista citam por Vínculo `cliente` (`clienteDe`), do Espaço da volta, em
 * lotes do teto de `clientesPorIds`. Um id sem linha na tabela (Contato antigo, de outro Espaço) fica de fora:
 * a Automação então diz "o cliente" e não menciona ninguém, como sempre fez sem o dado.
 */

import type { PoolClient } from "pg";
import type { DataState, Id } from "@n1/dominio";
import { clienteDe, type ClientesLidos } from "@n1/dominio/operations/financeiro";
import { TETO_DE_CONTATOS_RESUMIDOS, criarRepositorioDeContatosPg } from "../repositorios/crm/contatos";

/** Os ids de Contato que as Tarefas ativas da Lista citam como cliente, sem repetição. */
export function idsDosClientesDaLista(state: DataState, listId: Id): string[] {
  const ids = new Set<string>();
  for (const task of state.tasks) {
    if (task.listId !== listId) continue;
    const cliente = clienteDe(state, task);
    if (cliente?.tipo === "contact") ids.add(cliente.id);
  }
  return [...ids];
}

export async function lerClientesDaLista(cliente: PoolClient, workspaceId: string, state: DataState, listId: Id): Promise<ClientesLidos> {
  const ids = idsDosClientesDaLista(state, listId);
  if (ids.length === 0) return { contatos: [], empresas: [] };
  const repositorio = criarRepositorioDeContatosPg(cliente);
  const contatos = [];
  for (let i = 0; i < ids.length; i += TETO_DE_CONTATOS_RESUMIDOS) {
    contatos.push(...(await repositorio.clientesPorIds(workspaceId, ids.slice(i, i + TETO_DE_CONTATOS_RESUMIDOS))));
  }
  return { contatos, empresas: [] };
}
