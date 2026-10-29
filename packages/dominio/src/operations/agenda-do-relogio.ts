/**
 * O relógio de uma Lista, em duas decisões puras: EM QUE REGIME a volta roda
 * e QUEM assina. Leituras, não operações — não gravam nada, por isso não
 * entram em `registro.ts`. O worker de `apps/api` (`automacoes/scheduler-worker.ts`)
 * as chama DENTRO do `executar()`, sobre o estado hidratado; o SQL do catálogo
 * é só CANDIDATO e nunca repete estas regras (uma regra de negócio no SQL seria
 * a que ninguém testa pelo domínio).
 *
 * D-01 (Fase 10, 2.1.2, escolha A): o servidor passa a gerar a Recorrência por
 * calendário das Listas que hoje dependem do botão. O catálogo do agendador
 * enxerga também as Listas com Tarefa `porCalendario`.
 *
 * D-02 — a Lista que só tem recorrência por calendário nasce DIRETO: o ensaio
 * da primeira volta (D3-03) existe para a Automação por vencimento, cujos
 * disparos em lote (A5/A6/A7: Comentário, Status, invocação de Agente) custam
 * dinheiro ou mandam mensagem sobre backlog importado. Uma Tarefa recorrente
 * vencida só cria a próxima ocorrência, e a série anda UM passo por dia
 * processado (`runCalendarRecurrences`) — não há lote a medir. A Lista com
 * Automação por vencimento (inclusive a que tem as duas coisas) mantém o
 * ensaio. A regra repete a de `runScheduledAutomations`: Automação `ativo`,
 * de escopo Lista, cuja ÚLTIMA versão publicada tem gatilho `condicaoTemporal`.
 * Lacuna aceita (RESEARCH §2 item 6): uma Lista que ganha Automação por
 * vencimento DEPOIS de já ter voltas reais não volta ao ensaio.
 *
 * F3 + Q1 — o ator. `runScheduledAutomations` e `runCalendarRecurrences`
 * recusam quem não administra a Lista, e o Agente do pipeline (o ator de hoje)
 * só administra Contas a pagar e Contas a receber (concessões de
 * `solicitacao-de-pagamento-evolver.ts`). Em vez de alargar essas concessões —
 * o Agente do pipeline também é a credencial de serviço usada por HTTP
 * externo, e `administrar` em todo Espaço ampliaria o raio dela (T-10-14) —,
 * o ator é escolhido POR LISTA, dentro do processo: o preferido (Agente do
 * pipeline, ou `AUTOMACOES_ATOR_MEMBER_ID`) quando ele administra a Lista;
 * senão um Membro humano ativo que a administra. A Atividade "Próxima
 * ocorrência criada" passa a ser autoria desse Membro. ASSUNÇÃO A CONFIRMAR
 * COM O DONO (Q1/A1, checkpoint D-04 do 10-16): autoria humana; se ele
 * preferir "Sistema", a mudança é no domínio (variantes com `ActorRef`).
 */

import { containerAdminRefusal } from "../derive";
import type { DataState } from "../state";
import type { Id } from "../types";
import { publishedVersion } from "./automations";

/**
 * A Lista tem Automação que o relógio precisa medir antes de gravar: alguma
 * `ativo`, de escopo Lista, cuja versão publicada vigente tem gatilho
 * `condicaoTemporal` — o mesmo filtro de `runScheduledAutomations`.
 */
export function listaTemAgendaPorVencimento(state: DataState, listId: Id): boolean {
  return state.automations.some(
    (a) => a.lifecycle === "ativo" && a.scopeType === "list" && a.scopeId === listId && publishedVersion(a)?.trigger?.kind === "condicaoTemporal",
  );
}

/** `ensaio`: a primeira volta real mede e não grava (D3-03). `direto`: a primeira volta já é real. */
export type RegimeDaPrimeiraVolta = "ensaio" | "direto";

/** D-02 — só a Lista com Automação por vencimento passa pelo ensaio. */
export function regimeDaPrimeiraVolta(state: DataState, listId: Id): RegimeDaPrimeiraVolta {
  return listaTemAgendaPorVencimento(state, listId) ? "ensaio" : "direto";
}

/**
 * Quem assina a volta do relógio desta Lista. Um candidato vale se é Membro
 * `ativo` e administra a Lista (`containerAdminRefusal` indefinido — o que
 * `runScheduledAutomations`/`runCalendarRecurrences` exigem de quem as roda).
 * A ordem: o preferido; o Proprietário do Espaço de Trabalho; depois os demais
 * Membros de Papel base Proprietário ou Administrador, na ordem de
 * `state.members`. `undefined` quando ninguém serve — o worker fecha a linha
 * como `SEM_ATOR`.
 */
export function atorDoRelogio(state: DataState, listId: Id, preferidoId: Id | undefined): Id | undefined {
  const administra = (memberId: Id): boolean => containerAdminRefusal(state, memberId, "list", listId) === undefined;
  const baseDoPapel = (roleId: Id) => state.roles.find((r) => r.id === roleId)?.base;

  if (preferidoId !== undefined && administra(preferidoId)) return preferidoId;
  if (administra(state.workspace.ownerMemberId)) return state.workspace.ownerMemberId;
  const humano = state.members.find((m) => {
    const base = baseDoPapel(m.roleId);
    return (base === "proprietario" || base === "administrador") && administra(m.id);
  });
  return humano?.id;
}
