"use client";

/**
 * Os nomes dos clientes das contas de Contas a receber (Fase 15, 3.4.10, UCR-08).
 *
 * O Vínculo "cliente" de uma conta só guarda a referência (`clienteDe` devolve tipo e id), e o
 * store não tem mais o CRM. O nome vem de `POST /crm/nomes` (`useNomesDoCrm`), em lote: junta o
 * cliente de cada conta passada numa chamada só. A chave de SWR é estável (alvos únicos e
 * ordenados), então a mesma lista em outra ordem compartilha a chamada.
 *
 * Devolve `id → nome` só dos clientes com nome; sem nome (ainda carregando, o Papel não lê o
 * tipo, ou a api recusou) o id fica fora e a lente mostra "Cliente" (`counterpart`).
 */

import { useMemo } from "react";
import type { AlvoDoCrm } from "@n1/dominio/crm/nomes";
import { clienteDe } from "@n1/dominio/operations/financeiro";
import type { DataState } from "@n1/dominio/state";
import type { Task } from "@n1/dominio/types";
import { useNomesDoCrm } from "@/dados/crm/nomes";
import type { NomesDosClientes } from "./lens";

/** O cliente de cada conta como alvo da chamada de nomes, sem repetir. Contas sem cliente não entram. */
export function alvosDosClientes(state: DataState, tasks: readonly Task[]): AlvoDoCrm[] {
  const vistos = new Map<string, AlvoDoCrm>();
  for (const task of tasks) {
    const cliente = clienteDe(state, task);
    if (cliente) vistos.set(`${cliente.tipo}:${cliente.id}`, { tipo: cliente.tipo, id: cliente.id });
  }
  return [...vistos.values()];
}

export function useNomesDosClientes(state: DataState, tasks: readonly Task[]): NomesDosClientes {
  const alvos = useMemo(() => alvosDosClientes(state, tasks), [state, tasks]);
  const nomes = useNomesDoCrm(alvos);
  return useMemo(() => {
    const porId = new Map<string, string>();
    for (const alvo of alvos) {
      const nome = nomes.porAlvo.get(`${alvo.tipo}:${alvo.id}`);
      if (typeof nome === "string" && nome.trim() !== "") porId.set(alvo.id, nome);
    }
    return porId;
  }, [alvos, nomes.porAlvo]);
}
