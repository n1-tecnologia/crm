/**
 * Credenciais de serviço em `plataforma.service_credentials`
 * (`003-integracao-e-importacao.sql`) — a identidade que o `automation/` usa
 * para autenticar em `/v1/integrations/*` sem JWT humano nem service role do
 * Supabase (D-15).
 *
 * `id` é o prefixo público do token (o que pode aparecer em log); o segredo
 * em si NUNCA é persistido nem logado — só `secret_hash = sha256(segredo)`.
 * O token apresentado no header é `${id}.${segredo}`; `resolverCredencial`
 * separa os dois pelo primeiro `.` e compara o hash em tempo constante
 * (`timingSafeEqual`) — o sha-256 tem tamanho fixo (32 bytes), então a
 * comparação nunca lança por tamanhos diferentes, e o tempo gasto não
 * vaza quantos bytes do segredo bateram (T-02-12, Spoofing).
 *
 * `state` `ativa` e `rotacionando` são as duas versões válidas simultâneas
 * do §2 do contrato — a rotação nunca tem uma janela sem credencial válida.
 * `revogada` é corte imediato: sem "prazo de graça" no banco, só o aviso que
 * o CLI imprime (`servicos/credencial.cli.ts`).
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { SOL } from "@n1/dominio";
import { pool } from "./conexao";

const PREFIXO_ID_PUBLICO = "svc_";
// base32 minúsculo sem 0/1/8/9 e sem l/o — evita confusão visual num id que
// pode acabar num log ou numa tela de administração.
const ALFABETO_ID_PUBLICO = "abcdefghijkmnpqrstuvwxyz234567";
const TAMANHO_SUFIXO_ID = 12;
const TAMANHO_SEGREDO_EM_BYTES = 32;

export type EstadoDaCredencial = "ativa" | "rotacionando" | "revogada";

export interface CredencialResolvida {
  readonly id: string;
  readonly workspaceId: string;
  readonly memberId: string;
  readonly scopes: readonly string[];
  readonly state: "ativa" | "rotacionando";
}

export interface CredencialEmitida {
  readonly id: string;
  /** Existe só neste retorno — nunca é gravado nem logado de novo. */
  readonly segredo: string;
}

export interface CredencialResumida {
  readonly id: string;
  readonly nome: string;
  readonly scopes: readonly string[];
  readonly state: EstadoDaCredencial;
  readonly createdAt: string;
  readonly lastUsedAt: string | null;
  readonly revokedAt: string | null;
}

interface LinhaDeCredencial {
  readonly id: string;
  readonly workspace_id: string;
  readonly nome: string;
  readonly secret_hash: string;
  readonly scopes: readonly string[];
  readonly member_id: string;
  readonly state: EstadoDaCredencial;
  readonly created_at: string;
  readonly last_used_at: string | null;
  readonly revoked_at: string | null;
}

function gerarIdPublico(): string {
  const bytes = randomBytes(TAMANHO_SUFIXO_ID);
  let sufixo = "";
  for (let indice = 0; indice < TAMANHO_SUFIXO_ID; indice += 1) {
    sufixo += ALFABETO_ID_PUBLICO[bytes[indice]! % ALFABETO_ID_PUBLICO.length];
  }
  return `${PREFIXO_ID_PUBLICO}${sufixo}`;
}

function hashDoSegredo(segredo: string): string {
  return createHash("sha256").update(segredo, "utf8").digest("hex");
}

/**
 * Localiza o Membro que ocupa o Papel "Agente do pipeline"
 * (`SOL.papeis.agentePipeline`, §9 da spec) dentro do Espaço de Trabalho.
 * Recusa se não existir — o Papel pode estar materializado pelo evolver
 * (Plan 02-08) sem que nenhum Membro real o ocupe ainda; um Membro nasce
 * nele por convite/atribuição, fora deste arquivo.
 */
export async function resolverMembroAgenteDoPipeline(workspaceId: string): Promise<{ readonly id: string }> {
  const resultado = await pool().query<{ dados: { readonly id: string } }>(
    `select dados
       from plataforma.registros
      where workspace_id = $1
        and colecao = 'members'
        and dados->>'roleId' = $2
      limit 1`,
    [workspaceId, SOL.papeis.agentePipeline],
  );
  const membro = resultado.rows[0]?.dados;
  if (!membro) {
    throw new Error(
      `Nenhum Membro ocupa o Papel "Agente do pipeline" (${SOL.papeis.agentePipeline}) no Espaço "${workspaceId}" — ` +
        "crie-o (convite/atribuição) antes de emitir uma credencial de serviço; ver Plan 02-08.",
    );
  }
  return { id: membro.id };
}

export interface PedidoDeEmissao {
  readonly workspaceId: string;
  readonly nome: string;
  readonly scopes: readonly string[];
  /**
   * Nunca decide o `member_id` gravado — serve só como checagem de defesa em
   * profundidade: se informado e diferente do Agente do pipeline resolvido,
   * a emissão recusa. O `member_id` da linha é sempre o resolvido por
   * `resolverMembroAgenteDoPipeline`, nunca um valor externo (T-02-12,
   * Elevation of Privilege).
   */
  readonly memberId?: string;
}

/**
 * Gera `{ id, segredo }`, persiste só `secret_hash = sha256(segredo)` e
 * devolve os dois — esta é a ÚNICA chamada em que o segredo existe fora de
 * quem o recebeu. `memberId` da linha é sempre o Agente do pipeline
 * confirmado, nunca um Membro humano.
 */
export async function emitirCredencial(pedido: PedidoDeEmissao): Promise<CredencialEmitida> {
  const agente = await resolverMembroAgenteDoPipeline(pedido.workspaceId);
  if (pedido.memberId !== undefined && pedido.memberId !== agente.id) {
    throw new Error(
      `memberId informado (${pedido.memberId}) não é o Agente do pipeline (${agente.id}) — ` +
        "uma credencial de serviço nunca aponta para outro Membro.",
    );
  }

  const id = gerarIdPublico();
  const segredo = randomBytes(TAMANHO_SEGREDO_EM_BYTES).toString("base64url");
  const secretHash = hashDoSegredo(segredo);

  await pool().query(
    `insert into plataforma.service_credentials
       (id, workspace_id, nome, secret_hash, scopes, member_id, state)
     values ($1, $2, $3, $4, $5, $6, 'ativa')`,
    [id, pedido.workspaceId, pedido.nome, secretHash, pedido.scopes, agente.id],
  );

  return { id, segredo };
}

/**
 * Verifica `id.segredo` contra `plataforma.service_credentials`. `id`
 * inexistente e segredo errado devolvem o MESMO `undefined` — quem chama
 * (`plugins/autenticacao-servico.ts`) responde com o mesmo envelope de erro
 * nos dois casos, para não permitir enumeração de credenciais (T-02-12).
 * Aceita `state` `ativa` e `rotacionando`; `revogada` sempre falha.
 */
export async function resolverCredencial(token: string): Promise<CredencialResolvida | undefined> {
  const corte = token.indexOf(".");
  if (corte <= 0 || corte === token.length - 1) return undefined;
  const id = token.slice(0, corte);
  const segredo = token.slice(corte + 1);

  const resultado = await pool().query<LinhaDeCredencial>(
    `select id, workspace_id, nome, secret_hash, scopes, member_id, state, created_at, last_used_at, revoked_at
       from plataforma.service_credentials
      where id = $1
      limit 1`,
    [id],
  );
  const linha = resultado.rows[0];
  if (!linha) return undefined;
  if (linha.state === "revogada") return undefined;

  const hashRecebido = Buffer.from(hashDoSegredo(segredo), "hex");
  const hashGuardado = Buffer.from(linha.secret_hash, "hex");
  if (hashRecebido.length !== hashGuardado.length || !timingSafeEqual(hashRecebido, hashGuardado)) {
    return undefined;
  }

  await pool().query(`update plataforma.service_credentials set last_used_at = now() where id = $1`, [id]);

  return {
    id: linha.id,
    workspaceId: linha.workspace_id,
    memberId: linha.member_id,
    scopes: linha.scopes,
    state: linha.state as "ativa" | "rotacionando",
  };
}

/** Corte imediato: marca `revogada`. Uma credencial `revogada` nunca reabre. */
export async function revogarCredencial(id: string): Promise<void> {
  await pool().query(
    `update plataforma.service_credentials set state = 'revogada', revoked_at = now() where id = $1`,
    [id],
  );
}

/** Marca a linha como `rotacionando` — usado por `credencial.cli.ts` depois de emitir a substituta. */
export async function marcarComoRotacionando(id: string): Promise<void> {
  await pool().query(
    `update plataforma.service_credentials set state = 'rotacionando' where id = $1 and state <> 'revogada'`,
    [id],
  );
}

/** Leitura administrativa — nunca devolve `secret_hash`; usada só pelo CLI para imprimir estado. */
export async function credencialPorId(id: string): Promise<CredencialResumida | undefined> {
  const resultado = await pool().query<LinhaDeCredencial>(
    `select id, workspace_id, nome, secret_hash, scopes, member_id, state, created_at, last_used_at, revoked_at
       from plataforma.service_credentials
      where id = $1
      limit 1`,
    [id],
  );
  const linha = resultado.rows[0];
  if (!linha) return undefined;
  return {
    id: linha.id,
    nome: linha.nome,
    scopes: linha.scopes,
    state: linha.state,
    createdAt: linha.created_at,
    lastUsedAt: linha.last_used_at,
    revokedAt: linha.revoked_at,
  };
}
