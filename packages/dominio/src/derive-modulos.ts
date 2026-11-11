/**
 * 12.2.1 — quem acessa qual módulo. Os seis módulos são os assuntos do trilho
 * (Trabalho, CRM, IA, Ferramentas, Painéis e Financeiro); a decisão 12.1.3
 * escolheu liberá-los por Papel: `Role.modulos` diz quais, e a ausência do
 * campo quer dizer todos.
 *
 * A regra mora aqui para que o trilho, as páginas e a api façam a MESMA
 * pergunta (12.6). Ninguém repete a regra fora deste arquivo.
 */

import { memberReachesContainer } from "./derive";
import { CP } from "./operations/financeiro-base";
import type { DataState } from "./state";
import type { Id, Modulo, Role } from "./types";

/** Os seis módulos, na ordem do trilho. */
export const MODULOS: readonly Modulo[] = ["trabalho", "crm", "ia", "ferramentas", "paineis", "financeiro"];

export const ROTULO_DO_MODULO: Readonly<Record<Modulo, string>> = {
  trabalho: "Trabalho",
  crm: "CRM",
  ia: "IA",
  ferramentas: "Ferramentas",
  paineis: "Painéis",
  financeiro: "Financeiro",
};

export function ehModulo(valor: string): valor is Modulo {
  return (MODULOS as readonly string[]).includes(valor);
}

/** Os módulos que o Papel libera, na ordem do trilho. Sem `modulos`, todos. */
export function modulosDoPapel(papel: Pick<Role, "modulos">): readonly Modulo[] {
  if (!papel.modulos) return MODULOS;
  return MODULOS.filter((m) => papel.modulos!.includes(m));
}

/**
 * O Papel do Membro libera o módulo. No Financeiro, o Membro também precisa
 * alcançar a Pasta "Financeiro" (`CP.folderId`), como o trilho já exigia antes
 * da Sessão 12 (`vePastaFinanceiro`): o Papel libera o módulo, e o acesso à
 * Pasta continua valendo por cima dele.
 */
export function membroAcessaModulo(state: DataState, memberId: Id, modulo: Modulo): boolean {
  const membro = state.members.find((m) => m.id === memberId);
  if (!membro) return false;
  const papel = state.roles.find((r) => r.id === membro.roleId);
  if (!papel) return false;
  if (!modulosDoPapel(papel).includes(modulo)) return false;
  if (modulo === "financeiro") return memberReachesContainer(state, memberId, "folder", CP.folderId);
  return true;
}
