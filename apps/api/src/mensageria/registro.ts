/** Esqueleto do RED (16-02): o registro ainda não decide nada. */

import type { Pool, PoolClient } from "pg";
import type { Canal } from "@n1/dominio/crm/canais";
import type { ProvedorDeCanal } from "@n1/dominio/crm/capacidades";
import type { ChavesDoCofre } from "../servicos/cofre";
import type { CanalParaProvedor, ProvedorDeMensageria } from "./provedor";
import { provedorDeTeste } from "./provedores/teste";

export interface RegistroDeProvedores {
  readonly teste: ProvedorDeMensageria;
  readonly porProvedor: Partial<Record<ProvedorDeCanal, ProvedorDeMensageria>>;
}

export function registroPadrao(): RegistroDeProvedores {
  return { teste: provedorDeTeste, porProvedor: {} };
}

export function provedorDoCanal(
  _canal: Pick<Canal, "conexaoSimulada" | "provedor">,
  registro: RegistroDeProvedores = registroPadrao(),
): ProvedorDeMensageria {
  return registro.teste;
}

export async function canalParaProvedor(
  _cliente: Pick<Pool | PoolClient, "query">,
  _chaves: ChavesDoCofre,
  workspaceId: string,
  canal: Canal,
): Promise<CanalParaProvedor> {
  return { workspaceId, canal };
}
