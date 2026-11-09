/** Esqueleto (16-07, RED): o hub ainda não entrega nada a ninguém. */

import type { EventoDoCrm, EventoParaATela } from "@n1/dominio/crm/eventos";
import type { MembroDaSessao } from "../plugins/autenticacao";

export interface OpcoesDoHubDeEventos {
  podeLer(membro: MembroDaSessao): Promise<boolean>;
  readonly maxPorMembro?: number;
  readonly reconferirMs?: number;
}

export interface HubDeEventos {
  podeLer(membro: MembroDaSessao): Promise<boolean>;
  assinar(membro: MembroDaSessao, enviar: (evento: EventoParaATela) => void, fechar: () => void): () => void;
  publicar(evento: EventoDoCrm): void;
  encerrarTodos(): void;
  definirDisponivel(sim: boolean): void;
  readonly disponivel: boolean;
  readonly assinantes: number;
}

export function criarHubDeEventos(opcoes: OpcoesDoHubDeEventos): HubDeEventos {
  return {
    podeLer: opcoes.podeLer,
    assinar: () => () => undefined,
    publicar() {},
    encerrarTodos() {},
    definirDisponivel() {},
    disponivel: false,
    assinantes: 0,
  };
}
