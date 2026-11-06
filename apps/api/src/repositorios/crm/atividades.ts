/**
 * Esqueleto do RED (15-04): a assinatura que o teste do traçador chama, sem
 * comportamento. A implementação entra no commit seguinte.
 */

import type { ActivityRecord } from "@n1/dominio/types/primitives";

export async function registrarAtividade(_cliente: unknown, _workspaceId: string, _entrada: unknown): Promise<void> {
  throw new Error("não implementado");
}

export async function listar(
  _cliente: unknown,
  _workspaceId: string,
  _filtro: unknown,
  _tiposPermitidos: readonly string[],
): Promise<ActivityRecord[]> {
  throw new Error("não implementado");
}
