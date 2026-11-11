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
import { lerChavesDoCofre, lerCredencial, type ChavesDoCofre } from "../servicos/cofre";
import { ErroDeProvedor, TIPO_DO_SEGREDO_DO_WEBHOOK, type CanalParaProvedor, type ProvedorDeMensageria } from "./provedor";
import { criarProvedorEvolution } from "./provedores/evolution/provedor";
import { provedorInstagramDoAmbiente } from "./provedores/instagram/do-ambiente";
import { provedorDeTeste } from "./provedores/teste";

export interface RegistroDeProvedores {
  readonly teste: ProvedorDeMensageria;
  readonly porProvedor: Partial<Record<ProvedorDeCanal, ProvedorDeMensageria>>;
}

/**
 * O de teste, mais a Evolution (`whatsapp-nao-oficial`) SÓ quando `EVOLUTION_URL` existe (16-12): sem ela, um Canal
 * real `whatsapp-nao-oficial` continua sem provedor e a Mensagem não é dada como enviada (MSG-05). A URL é o host fixo
 * da Evolution; nenhum corpo de webhook o troca.
 *
 * Sessão 8: o Instagram (`instagram-graph`) entra pela mesma regra, SÓ com `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET` e
 * `INSTAGRAM_REDIRECT_URI` (ver `provedores/instagram/do-ambiente.ts`).
 */
export function registroPadrao(): RegistroDeProvedores {
  const urlDaEvolution = process.env.EVOLUTION_URL?.trim();
  // Sessão 4: a chave global (`EVOLUTION_API_KEY`) só serve para o provedor ler o dono do número ao conferir a conexão.
  const apikeyGlobal = process.env.EVOLUTION_API_KEY?.trim();
  const instagram = provedorInstagramDoAmbiente();
  return {
    teste: provedorDeTeste,
    porProvedor: {
      ...(urlDaEvolution
        ? { "whatsapp-nao-oficial": criarProvedorEvolution({ url: urlDaEvolution, ...(apikeyGlobal ? { apikeyGlobal } : {}) }) }
        : {}),
      ...(instagram ? { "instagram-graph": instagram } : {}),
    },
  };
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

export type { ChavesDoCofre };

/**
 * `chavesInformadas` é a injeção dos testes; sem ela a chave mestra é lida do ambiente aqui, na camada
 * de serviço: `rotas/` nunca importa `servicos/cofre` (cofre.test.ts).
 */
export async function canalParaProvedor(
  cliente: Pick<PoolClient, "query">,
  chavesInformadas: ChavesDoCofre | undefined,
  workspaceId: string,
  canal: Canal,
): Promise<CanalParaProvedor> {
  const chaves = chavesInformadas ?? lerChavesDoCofre();
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
