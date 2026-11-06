/**
 * O gesto misto da IA (Chat e Agentes): as operações que ancoram uma Sessão de
 * Chat ou um ensaio num Negócio, Contato, Empresa ou Conversa leem o NOME do
 * registro nas tabelas do CRM novo (`plataforma.negocios`, `contatos`,
 * `empresas`, `conversas`), não no modelo antigo do estado, que some na 3.5.4.
 * Fase 15, 3.4.9 (UCR-08).
 *
 * O `nomes` que o navegador mandou (último argumento, só para a execução local)
 * é DESCARTADO: a posição é sobrescrita com o que o servidor leu, deste Espaço
 * e em qualquer estado (T-15-24). Quem decide se a Âncora vale é o domínio,
 * com esse conjunto: id que não existe no Espaço fica fora de `nomes` e a
 * operação recusa.
 *
 * O nome só é lido quando o Membro da sessão pode `ler` aquele recurso
 * (`podeNoCrm`, T-15-23): sem permissão a leitura devolve `{}` e a operação
 * recusa com a mesma frase de "não existe", sem revelar o nome nem que o
 * registro existe.
 *
 * `AO_CONFIRMAR_IA` libera, no MESMO commit do Agente na lixeira ou arquivado
 * (RN-AGE-20), as Conversas de `plataforma.conversas` atribuídas a ele; o
 * domínio libera Tarefas e as Conversas de Grupo que ainda moram em `registros`.
 *
 * Fica num arquivo próprio para que os planos paralelos não disputem o mesmo
 * arquivo; `index.ts` compõe.
 */

import type { DataState } from "@n1/dominio";
import { nomeDeExibicaoDaEmpresa } from "@n1/dominio/crm/empresas";
import { podeNoCrm, type RecursoCrm } from "@n1/dominio/crm/permissoes";
import { criarRepositorioDeContatosPg } from "../../repositorios/crm/contatos";
import { criarRepositorioDeConversasPg } from "../../repositorios/crm/conversas";
import { criarRepositorioDeEmpresasPg } from "../../repositorios/crm/empresas";
import { liberarDoAgente } from "../../repositorios/crm/liberacao-do-agente";
import { criarRepositorioDeNegociosPg } from "../../repositorios/crm/negocios";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import type { AoConfirmarNoCrm, LeituraDoCrm, TabelaDeConfirmacoes, TabelaDeLeituras } from "./tipos";
import type { PoolClient } from "pg";

/** De onde sai o `{ type, id }` da Âncora nos `args` já validados pelo esquema. */
type AncoraNosArgs = (args: readonly unknown[]) => { readonly type: unknown; readonly id: unknown } | undefined;

/** O recurso do CRM que cada tipo de Âncora cita; os demais tipos (Tarefa, Lista...) não passam por aqui. */
const RECURSO_DA_ANCORA: Readonly<Record<string, RecursoCrm>> = {
  deal: "negocio",
  contact: "contato",
  company: "empresa",
  conversation: "conversa",
};

const objetoOuVazio = (valor: unknown): Record<string, unknown> => (typeof valor === "object" && valor !== null ? (valor as Record<string, unknown>) : {});

/** `createChatSession(input, nomes)`: a Âncora está em `input.anchor`. */
const ancoraDoCriarSessao: AncoraNosArgs = (args) => ancoraDe(objetoOuVazio(args[0]).anchor);

/** `configureChatSession(sessaoId, input, nomes)`: a Âncora está em `input.anchor` (pode ser `null`, que limpa). */
const ancoraDoConfigurarSessao: AncoraNosArgs = (args) => ancoraDe(objetoOuVazio(args[1]).anchor);

/** `ensaiarAgente(agenteId, input, nomes)`: a Âncora está em `input.anchor`. */
const ancoraDoEnsaio: AncoraNosArgs = (args) => ancoraDe(objetoOuVazio(args[1]).anchor);

function ancoraDe(valor: unknown): { readonly type: unknown; readonly id: unknown } | undefined {
  if (typeof valor !== "object" || valor === null) return undefined;
  const { type, id } = valor as Record<string, unknown>;
  return { type, id };
}

/** O nome do registro na tabela do Espaço, ou `undefined` se ele não existe ali. */
async function nomeNaTabela(cliente: PoolClient, workspaceId: string, tipo: string, id: string): Promise<string | undefined> {
  switch (tipo) {
    case "deal":
      return (await criarRepositorioDeNegociosPg(cliente).obter(workspaceId, id))?.titulo;
    case "contact":
      return (await criarRepositorioDeContatosPg(cliente).resumidosPorIds(workspaceId, [id]))[0]?.nome;
    case "company": {
      const empresa = await criarRepositorioDeEmpresasPg(cliente).obter(workspaceId, id);
      return empresa ? nomeDeExibicaoDaEmpresa(empresa) : undefined;
    }
    case "conversation":
      return (await criarRepositorioDeConversasPg(cliente).obter(workspaceId, id))?.titulo;
    default:
      return undefined;
  }
}

/** A frase de `podeNoCrm` quando o Membro da sessão não pode `ler` o recurso; `undefined` quando pode. */
function recusaDeLer(state: DataState, membro: MembroDaSessao, recurso: RecursoCrm): string | undefined {
  const registro = state.members.find((m) => m.id === membro.id);
  const base = registro ? state.roles.find((r) => r.id === registro.roleId)?.base : undefined;
  return podeNoCrm(base, registro?.state, "ler", recurso);
}

/**
 * A leitura de uma operação de IA com Âncora: o nome do registro citado, só se
 * o Membro pode `ler` o recurso. `posicao` é o índice de `nomes` em `args`
 * (depois dos argumentos que a operação recebe do navegador).
 */
export const leituraDasAncoras = (posicao: number, ancoraNosArgs: AncoraNosArgs): LeituraDoCrm => ({
  posicao,
  ler: async (cliente, workspaceId, args, state, membro) => {
    const ancora = ancoraNosArgs(args);
    if (typeof ancora?.type !== "string" || typeof ancora.id !== "string") return { nomes: {} };
    const recurso = RECURSO_DA_ANCORA[ancora.type];
    if (!recurso) return { nomes: {} };
    if (recusaDeLer(state, membro, recurso) !== undefined) return { nomes: {} };
    const nome = await nomeNaTabela(cliente, workspaceId, ancora.type, ancora.id);
    return { nomes: nome === undefined ? {} : { [ancora.id]: nome } };
  },
  argumento: (lido) => lido.nomes ?? {},
});

export const LER_DO_CRM_IA: TabelaDeLeituras = {
  createChatSession: leituraDasAncoras(1, ancoraDoCriarSessao),
  configureChatSession: leituraDasAncoras(2, ancoraDoConfigurarSessao),
  ensaiarAgente: leituraDasAncoras(2, ancoraDoEnsaio),
};

/**
 * RN-AGE-20 — arquivar e enviar à lixeira soltam o Agente das Conversas dele. As que moram em
 * `plataforma.conversas` saem aqui, no commit do gesto; `args[0]` é o id do Agente. Só roda
 * depois do `ok` do domínio, então repetir (que o domínio recusa) ou recusar não solta nada.
 */
const soltarConversasDoAgente: AoConfirmarNoCrm = async (cliente, args, membro) => {
  const agenteId = args[0];
  if (typeof agenteId !== "string") return;
  await liberarDoAgente(cliente, membro.workspaceId, agenteId);
};

export const AO_CONFIRMAR_IA: TabelaDeConfirmacoes = {
  arquivarAgente: soltarConversasDoAgente,
  enviarAgenteALixeira: soltarConversasDoAgente,
};
