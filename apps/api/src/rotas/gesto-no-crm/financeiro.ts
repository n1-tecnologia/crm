/**
 * Gesto misto de Contas a receber (Fase 15, 3.4.10, UCR-08): quem é o cliente de uma série vem de
 * `plataforma.contatos`, não do Contato do modelo antigo no estado, que some na 3.5.4.
 *
 * `createReceivableSeries(input, clientes)`: o servidor lê só o Contato que `input.contactId` cita,
 * do Espaço da sessão e em qualquer estado — quem decide se vale (`ativo`) é o domínio. O `clientes`
 * que o navegador mandou (só para a execução local) é DESCARTADO: a posição é sobrescrita com o que
 * a tabela devolveu (T-15-48). Um Contato de outro Espaço ou inexistente fica fora de `clientes` e a
 * operação recusa com "Cliente não encontrado.".
 *
 * O nome e o Proprietário do cliente só são lidos quando o Membro da sessão pode `ler` Contato
 * (`podeNoCrm`, T-15-49): sem permissão a leitura devolve vazio e a operação recusa com a mesma
 * frase de "não existe", sem revelar o nome (ele vai para o título das contas) nem que o Contato existe.
 *
 * A série cobra só Contato (`input.contactId`); `empresas` segue vazio até a operação aceitar Empresa
 * como cliente. Fica num arquivo próprio para que os planos paralelos não disputem o mesmo arquivo;
 * `index.ts` compõe.
 */

import type { DataState } from "@n1/dominio";
import { podeNoCrm } from "@n1/dominio/crm/permissoes";
import { criarRepositorioDeContatosPg } from "../../repositorios/crm/contatos";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import type { LeituraDoCrm, TabelaDeConfirmacoes, TabelaDeLeituras } from "./tipos";

const SEM_CLIENTES = { contatos: [], empresas: [] } as const;

const objetoOuVazio = (valor: unknown): Record<string, unknown> => (typeof valor === "object" && valor !== null ? (valor as Record<string, unknown>) : {});

/** O Membro da sessão pode `ler` Contato? (a frase de `podeNoCrm` quando não; `undefined` quando pode.) */
function recusaDeLerContato(state: DataState, membro: MembroDaSessao): string | undefined {
  const registro = state.members.find((m) => m.id === membro.id);
  const base = registro ? state.roles.find((r) => r.id === registro.roleId)?.base : undefined;
  return podeNoCrm(base, registro?.state, "ler", "contato");
}

export const leituraDoClienteDaSerie: LeituraDoCrm = {
  posicao: 1,
  ler: async (cliente, workspaceId, args, state, membro) => {
    const { contactId } = objetoOuVazio(args[0]);
    if (typeof contactId !== "string") return { clientes: SEM_CLIENTES };
    if (recusaDeLerContato(state, membro) !== undefined) return { clientes: SEM_CLIENTES };
    const contatos = await criarRepositorioDeContatosPg(cliente).clientesPorIds(workspaceId, [contactId]);
    return { clientes: { contatos, empresas: [] } };
  },
  argumento: (lido) => lido.clientes ?? SEM_CLIENTES,
};

export const LER_DO_CRM_FINANCEIRO: TabelaDeLeituras = {
  createReceivableSeries: leituraDoClienteDaSerie,
};

export const AO_CONFIRMAR_FINANCEIRO: TabelaDeConfirmacoes = {};
