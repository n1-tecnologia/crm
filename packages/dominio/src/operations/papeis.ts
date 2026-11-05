/**
 * 12.4.1 — criar e editar Papel personalizado.
 *
 * Decisões 12.1.3 (A) e 12.1.4 (B): um Papel personalizado escolhe a base e os
 * módulos que libera, e a lista de permissões (`Role.permissions`) não é
 * oferecida — nasce vazia e fica só para os dois casos que já a leem. A base é
 * teto (B30) e não muda depois de criada; um Papel de sistema é imutável.
 *
 * Mora fora de `members.ts` para não disputar o arquivo com a Sessão 3.
 */

import { MODULOS, ROTULO_DO_MODULO, ehModulo, modulosDoPapel } from "../derive-modulos";
import { fail, ok, type DataState, type OperationResult } from "../state";
import type { Id, Modulo, Role, SystemRole } from "../types";
import { recusaDeGovernanca } from "./governanca";
import { memberActor, nextId, recordActivity } from "./activity";

const TAMANHO_MAXIMO_DO_NOME = 60;

const ROTULO_DA_BASE: Readonly<Record<SystemRole, string>> = {
  proprietario: "Proprietário",
  administrador: "Administrador",
  membro: "Membro",
  convidado: "Convidado",
};

export interface NovoPapel {
  readonly nome: string;
  /** `proprietario` é recusado: o Proprietário é um só e muda por transferência. */
  readonly base: SystemRole;
  readonly modulos: readonly Modulo[];
}

export interface AlteracaoDePapel {
  readonly nome?: string;
  readonly modulos?: readonly Modulo[];
}

export function createRole(state: DataState, actingMemberId: Id, input: NovoPapel): OperationResult<Role> {
  const recusa = recusaDeGovernanca(state, actingMemberId, "cria um Papel");
  if (recusa) return fail(recusa);

  const nome = validarNome(state, input.nome);
  if (!nome.ok) return nome;

  if (input.base === "proprietario") {
    return fail("Um Papel personalizado não tem base Proprietário: o Proprietário é um só e muda por transferência.", "base");
  }
  if (!(input.base in ROTULO_DA_BASE)) return fail("Escolha a base do Papel.", "base");

  const modulos = validarModulos(input.modulos);
  if (!modulos.ok) return modulos;

  const papel: Role = {
    id: nextId("role"),
    workspaceId: state.workspace.id,
    name: nome.value,
    system: false,
    base: input.base,
    permissions: [],
    modulos: modulos.value,
  };
  state.roles.push(papel);

  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Papel personalizado criado",
    objectType: "role",
    objectId: papel.id,
    objectName: papel.name,
    after: descrever(papel),
  });
  return ok(papel, papel.id);
}

export function updateRole(
  state: DataState,
  actingMemberId: Id,
  roleId: Id,
  input: AlteracaoDePapel,
): OperationResult<Role> {
  const recusa = recusaDeGovernanca(state, actingMemberId, "edita um Papel");
  if (recusa) return fail(recusa);

  const indice = state.roles.findIndex((r) => r.id === roleId);
  const atual = state.roles[indice];
  if (!atual) return fail("Papel não encontrado.");
  if (atual.system) return fail("Um Papel de sistema não se edita.");

  let nome = atual.name;
  if (input.nome !== undefined) {
    const validado = validarNome(state, input.nome, atual.id);
    if (!validado.ok) return validado;
    nome = validado.value;
  }

  let modulos = modulosDoPapel(atual);
  if (input.modulos !== undefined) {
    const validados = validarModulos(input.modulos);
    if (!validados.ok) return validados;
    modulos = validados.value;
  }

  const mesmosModulos = modulos.length === modulosDoPapel(atual).length && modulos.every((m) => modulosDoPapel(atual).includes(m));
  if (nome === atual.name && mesmosModulos) return ok(atual, atual.id);

  // `Role` é readonly: a edição troca o objeto no mesmo lugar do array.
  const editado: Role = { ...atual, name: nome, modulos };
  state.roles[indice] = editado;

  recordActivity(state, {
    actor: memberActor(actingMemberId),
    action: "Papel personalizado alterado",
    objectType: "role",
    objectId: editado.id,
    objectName: editado.name,
    before: descrever(atual),
    after: descrever(editado),
  });
  return ok(editado, editado.id);
}

function validarNome(state: DataState, bruto: string, proprioId?: Id): OperationResult<string> {
  const nome = bruto.trim();
  if (!nome) return fail("Dê um nome ao Papel.", "nome");
  if (nome.length > TAMANHO_MAXIMO_DO_NOME) {
    return fail(`O nome do Papel tem no máximo ${TAMANHO_MAXIMO_DO_NOME} caracteres.`, "nome");
  }
  const igual = state.roles.find((r) => r.id !== proprioId && r.name.trim().toLowerCase() === nome.toLowerCase());
  if (igual) return fail(`Já existe um Papel chamado "${igual.name}" neste Espaço de Trabalho.`, "nome");
  return ok(nome);
}

function validarModulos(brutos: readonly string[]): OperationResult<readonly Modulo[]> {
  if (brutos.some((m) => !ehModulo(m))) return fail("Módulo desconhecido.", "modulos");
  const modulos = MODULOS.filter((m) => brutos.includes(m));
  if (modulos.length === 0) return fail("Escolha ao menos um módulo para o Papel.", "modulos");
  return ok(modulos);
}

/** O que a Atividade grava antes e depois: nome, base e módulos, por extenso. */
function descrever(papel: Role): string {
  const modulos = modulosDoPapel(papel).map((m) => ROTULO_DO_MODULO[m]).join(", ");
  return `${papel.name} · Base: ${ROTULO_DA_BASE[papel.base]} · Módulos: ${modulos}`;
}
