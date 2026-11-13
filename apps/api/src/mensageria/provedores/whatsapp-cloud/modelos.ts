/**
 * Os modelos de mensagem do WhatsApp oficial entre a Meta e o CRM (Sessão 7, 7.3.2).
 *
 *   `traduzirModelo`      puro: o modelo no formato da Meta → o do CRM (categoria e estado traduzidos, motivo, variáveis);
 *   `sincronizarModelos`  lê a lista da Meta com o token do Canal e a grava (`substituirDoCanal`): o Canal fica com
 *                         exatamente o que a Meta tem. Quem chama decide quando: ao conectar, pelo botão da ficha, de
 *                         hora em hora e quando a Meta avisa (`message_template_status_update`).
 *
 * A leitura da Meta vem ANTES da transação (a transação só grava e não fica aberta esperando a rede). Nada aqui loga o corpo
 * dos modelos nem o token.
 */

import type { Pool, PoolClient } from "pg";
import { quantidadeDeVariaveis, type CategoriaDeModelo, type ComponenteDeModelo, type EstadoDeModelo } from "@n1/dominio/crm/modelos";
import { criarRepositorioDeModelosPg, type ModeloLido, type ResultadoDaSubstituicao } from "../../../repositorios/crm/modelos";
import { comTransacao } from "../../../servicos/crm/transacao";
import { sucesso } from "../../../servicos/crm/resultado";
import type { ClienteDaCloudApi, ModeloDaMeta } from "./cliente";

const CATEGORIAS: Readonly<Record<string, CategoriaDeModelo>> = {
  UTILITY: "utilidade",
  MARKETING: "marketing",
  AUTHENTICATION: "autenticacao",
};

/**
 * Os estados da Meta reduzidos aos cinco do CRM. Só `APPROVED` envia. Apelação é "pendente" (a Meta ainda decide); sinalizado
 * e acima do limite de envios são "pausado" (existe, mas a Meta barrou); excluído e arquivado são "desativado".
 */
const ESTADOS: Readonly<Record<string, EstadoDeModelo>> = {
  APPROVED: "aprovado",
  PENDING: "pendente",
  IN_APPEAL: "pendente",
  REJECTED: "rejeitado",
  PAUSED: "pausado",
  FLAGGED: "pausado",
  LIMIT_EXCEEDED: "pausado",
  DISABLED: "desativado",
  DELETED: "desativado",
  PENDING_DELETION: "desativado",
  ARCHIVED: "desativado",
};

/** O que a Meta manda como `rejected_reason` quando não há motivo. */
const SEM_MOTIVO: ReadonlySet<string> = new Set(["NONE", ""]);

function componentesDe(brutos: readonly unknown[]): ComponenteDeModelo[] {
  return brutos.flatMap((bruto) => {
    if (typeof bruto !== "object" || bruto === null) return [];
    const c = bruto as Record<string, unknown>;
    return typeof c.type === "string" ? [c as unknown as ComponenteDeModelo] : [];
  });
}

/**
 * Um modelo da Meta no formato do CRM, ou `undefined` se a categoria ou o estado são desconhecidos. Um modelo que a Meta
 * criou numa categoria nova (que ainda não existe aqui) fica de fora em vez de entrar com um valor que o banco recusa.
 */
export function traduzirModelo(m: ModeloDaMeta): ModeloLido | undefined {
  const categoria = CATEGORIAS[m.category.toUpperCase()];
  const estado = ESTADOS[m.status.toUpperCase()];
  if (!categoria || !estado) return undefined;
  const componentes = componentesDe(m.components);
  const motivo = m.rejected_reason?.trim();
  return {
    idNoProvedor: m.id,
    nome: m.name,
    idioma: m.language,
    categoria,
    estado,
    motivoDeRejeicao: estado === "rejeitado" && motivo && !SEM_MOTIVO.has(motivo.toUpperCase()) ? motivo.slice(0, 500) : null,
    componentes,
    quantidadeDeVariaveis: quantidadeDeVariaveis(componentes),
  };
}

export interface ResultadoDaSincronizacao extends ResultadoDaSubstituicao {
  /** Modelos da Meta que ficaram de fora por categoria ou estado desconhecidos. */
  readonly ignorados: number;
}

export interface DependenciasDaSincronizacao {
  readonly pool: () => Pool;
  readonly cliente: ClienteDaCloudApi;
}

/**
 * Lê os modelos da conta e deixa o Canal com exatamente eles. Lança `ErroDaCloudApi` se a Meta recusa ou não responde: quem
 * chama decide o que dizer (a conexão ignora, o botão da ficha mostra). Se a leitura falha, NADA é apagado.
 */
export async function sincronizarModelos(
  deps: DependenciasDaSincronizacao,
  canal: { readonly workspaceId: string; readonly canalId: string; readonly token: string; readonly wabaId: string },
): Promise<ResultadoDaSincronizacao> {
  const daMeta = await deps.cliente.listarModelos(canal.token, canal.wabaId);
  const traduzidos = daMeta.map(traduzirModelo);
  const lidos = traduzidos.filter((m): m is ModeloLido => m !== undefined);
  const resultado = await comTransacao(deps.pool, async (transacao: PoolClient) =>
    sucesso(await criarRepositorioDeModelosPg(transacao).substituirDoCanal(canal.workspaceId, canal.canalId, lidos)),
  );
  if (!resultado.ok) throw new Error("A transação da sincronização de modelos foi recusada.");
  return { ...resultado.valor, ignorados: traduzidos.length - lidos.length };
}
