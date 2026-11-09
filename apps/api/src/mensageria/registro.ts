/**
 * O registro de provedores (3.6.1, D-16-03, MSG-05): qual implementação fala por um Canal.
 *
 * Regra única: o provedor de teste serve SÓ a Canal com `conexaoSimulada = true`. Um Canal real sem
 * implementação registrada para o seu provedor lança `ErroDeProvedor("PROVEDOR_INDISPONIVEL")`: nunca
 * cai no provedor de teste, para o atendente jamais ver "enviada" numa Mensagem que não saiu para o
 * WhatsApp. Um Canal que deixa de ser simulado (`desconectar` zera `conexao_simulada`) perde o de teste.
 *
 * `canalParaProvedor` monta o `CanalParaProvedor`: lê do cofre o segredo do webhook e, para Canal real,
 * a credencial do provedor (`tipo` = o nome do provedor). Nenhum dos dois é logado aqui.
 */

import type { PoolClient } from "pg";
import type { Canal } from "@n1/dominio/crm/canais";
import type { ProvedorDeCanal } from "@n1/dominio/crm/capacidades";
import { lerCredencial, type ChavesDoCofre } from "../servicos/cofre";
import { ErroDeProvedor, TIPO_DO_SEGREDO_DO_WEBHOOK, type CanalParaProvedor, type ProvedorDeMensageria } from "./provedor";
import { provedorDeTeste } from "./provedores/teste";

export interface RegistroDeProvedores {
  readonly teste: ProvedorDeMensageria;
  readonly porProvedor: Partial<Record<ProvedorDeCanal, ProvedorDeMensageria>>;
}

/** Nesta fase só o de teste; o 16-11 acrescenta `whatsapp-nao-oficial`. */
export function registroPadrao(): RegistroDeProvedores {
  return { teste: provedorDeTeste, porProvedor: {} };
}

export function provedorDoCanal(
  canal: Pick<Canal, "conexaoSimulada" | "provedor">,
  registro: RegistroDeProvedores = registroPadrao(),
): ProvedorDeMensageria {
  if (canal.conexaoSimulada) return registro.teste;
  const provedor = registro.porProvedor[canal.provedor];
  if (!provedor) {
    throw new ErroDeProvedor("PROVEDOR_INDISPONIVEL", `Não há provedor registrado para o Canal (${canal.provedor}).`);
  }
  return provedor;
}

export async function canalParaProvedor(
  cliente: Pick<PoolClient, "query">,
  chaves: ChavesDoCofre,
  workspaceId: string,
  canal: Canal,
): Promise<CanalParaProvedor> {
  const dono = { workspaceId, donoTipo: "canal", donoId: canal.id } as const;
  const segredoDoWebhook = await lerCredencial(cliente, chaves, { ...dono, tipo: TIPO_DO_SEGREDO_DO_WEBHOOK });
  const credencial = canal.conexaoSimulada ? undefined : await lerCredencial(cliente, chaves, { ...dono, tipo: canal.provedor });
  return {
    workspaceId,
    canal,
    ...(segredoDoWebhook === undefined ? {} : { segredoDoWebhook }),
    ...(credencial === undefined ? {} : { credencial }),
  };
}
