/**
 * A ponte de Canais (D-11, Fase 8): projeta `plataforma.canais` (008) em
 * `state.channels` para o resto do app, que ainda lê o modelo antigo em inglês.
 *
 * Este é o ÚNICO módulo da ponte. A projeção entra só em `GET /estado`
 * (`rotas/estado.ts`) e, em 08-07, em `executar()` — NUNCA em `hidratar()`:
 * `hidratar()` também é chamado por bootstraps e métricas que depois podem
 * `gravar()`, e `gravar()` copiaria o Canal projetado para `plataforma.registros`
 * (duas fontes de verdade). Some na unificação (T-08-06).
 *
 * Guarda `to_regclass` (Pitfall 1, T-08-05): num banco sem a 008 — o da
 * plataforma antes de 08-14, ou um cliente falso de teste — a tabela não existe
 * e a consulta lançaria 42P01, derrubando `GET /estado`. Sem tabela, devolve
 * `[]` sem segunda consulta. Só o resultado POSITIVO fica em cache de módulo:
 * uma tabela que ainda não existe pode passar a existir (a 008 é aplicada com o
 * processo no ar), então o negativo é reconsultado.
 */

import type { Pool, PoolClient } from "pg";
import type { Channel, DataState } from "@n1/dominio";
import type { Canal } from "@n1/dominio/crm/canais";
import { criarRepositorioDeCanaisPg } from "../repositorios/crm/canais";
import { canonico } from "./repositorio";

let tabelaDeCanaisExiste = false;

/** Só para teste: zera o cache positivo da guarda. */
export function redefinirGuardaDaTabelaDeCanais(): void {
  tabelaDeCanaisExiste = false;
}

/** A fotografia dos projetados no momento em que entraram no estado (08-07 a usa para detectar mudança). */
export interface FotografiaDosProjetados {
  readonly ids: ReadonlySet<string>;
  readonly json: ReadonlyMap<string, string>;
}

/** O Canal da 008 na forma do modelo antigo. O `id` é o UUID cru da tabela: não colide com `chn_*` do seed. */
export function canalParaChannel(canal: Canal, workspaceId: string): Channel {
  return {
    id: canal.id,
    workspaceId,
    createdBy: { kind: "member", id: canal.criadoPor },
    createdAt: canal.criadoEm,
    lifecycle: canal.estado,
    ...(canal.arquivadoEm !== null ? { archivedAt: canal.arquivadoEm } : {}),
    name: canal.nome,
    channelType: canal.tipo,
    externalId: canal.identificadorExterno,
    connection: canal.conexao === "com_erro" ? "comErro" : canal.conexao,
    configuredByMemberId: canal.configuradoPor,
    ...(canal.filaPadraoId !== null ? { defaultQueueId: canal.filaPadraoId } : {}),
    ...(canal.proprietarioPadraoId !== null ? { defaultContactOwnerMemberId: canal.proprietarioPadraoId } : {}),
    ...(canal.origemPadraoId !== null ? { defaultOriginId: canal.origemPadraoId } : {}),
    messageTemplates: [],
    groupsEnabled: canal.gruposHabilitados,
    provider: canal.provedor,
    relational: true,
    simulatedConnection: canal.conexaoSimulada,
  };
}

export async function carregarCanaisProjetados(cliente: Pool | PoolClient, workspaceId: string): Promise<Channel[]> {
  if (!tabelaDeCanaisExiste) {
    const guarda = await cliente.query<{ existe: string | null }>("select to_regclass('plataforma.canais') as existe");
    const existe = guarda.rows[0]?.existe ?? null;
    if (existe === null) return [];
    tabelaDeCanaisExiste = true;
  }
  const canais = await criarRepositorioDeCanaisPg(cliente).todos(workspaceId);
  return canais.map((canal) => canalParaChannel(canal, workspaceId));
}

/**
 * Acrescenta os Canais projetados ao FIM de `state.channels`, pulando os que
 * colidem por `id` com um Canal já hidratado. Lista vazia não toca o estado
 * (o `hidratar` falso dos testes da Unidade de Trabalho nem tem `channels`).
 */
export function acrescentarCanaisProjetados(state: DataState, canais: readonly Channel[]): FotografiaDosProjetados {
  const ids = new Set<string>();
  const json = new Map<string, string>();
  if (canais.length === 0) return { ids, json };
  const existentes = new Set(state.channels.map((canal) => canal.id));
  for (const canal of canais) {
    if (existentes.has(canal.id)) continue;
    state.channels.push(canal);
    ids.add(canal.id);
    json.set(canal.id, canonico(canal));
  }
  return { ids, json };
}

/**
 * O estado que `gravar()` pode persistir: o de `executar()` SEM os Canais
 * projetados (D-11, Pitfall 3). Devolve uma cópia rasa com `channels` filtrado,
 * sem mutar `state` (a Unidade de Trabalho ainda precisa dele inteiro para os
 * eventos de Canal). Como os projetados entram no FIM de `state.channels` e não
 * estão no que `hidratar()` leu, tirá-los não gera remoção nem reordena os
 * Canais do seed.
 *
 * Se uma operação do modelo antigo mudou (ou tirou) um projetado, lança: a
 * tabela própria é a única fonte do Canal, e descartar a mudança em silêncio
 * faria a tela mostrar um gesto que o servidor não guardou. A transação é
 * desfeita por quem chamou. Fotografia vazia devolve o próprio `state`.
 */
export function semCanaisProjetados(state: DataState, fotografia: FotografiaDosProjetados): DataState {
  if (fotografia.ids.size === 0) return state;
  for (const [id, json] of fotografia.json) {
    const atual = state.channels.find((canal) => canal.id === id);
    if (!atual || canonico(atual) !== json) {
      throw new Error(`Uma operação alterou o Canal ${id} da tabela própria; ele só muda pela api de Canais.`);
    }
  }
  return { ...state, channels: state.channels.filter((canal) => !fotografia.ids.has(canal.id)) };
}
