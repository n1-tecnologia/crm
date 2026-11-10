/**
 * O SQL do Instagram: a conta conectada e quem escreveu para ela (014), e a credencial no
 * cofre (009). Só o provedor do Instagram usa estas tabelas; o Canal continua sendo de
 * `repositorios/crm/canais.ts`, e o Contato, de `receberMensagem`.
 */

import type { Pool, PoolClient } from "pg";

type Cliente = Pick<Pool | PoolClient, "query">;

/**
 * O `tipo` da credencial do Canal no cofre: o nome do provedor, como a Evolution
 * (`whatsapp-nao-oficial`). É o que `canalParaProvedor` decifra e o que
 * `ligadoAoProvedor` (CR-01) confere para esconder "Simular conexão".
 */
export const TIPO_DA_CREDENCIAL = "instagram-graph";

export interface ContaConectada {
  readonly workspaceId: string;
  readonly canalId: string;
  readonly contaId: string;
  readonly idNoApp: string | null;
  readonly usuario: string;
}

interface LinhaDeConta {
  readonly workspace_id: string;
  readonly canal_id: string;
  readonly conta_id: string;
  readonly id_no_app: string | null;
  readonly usuario: string;
}

const COLUNAS_DA_CONTA = "workspace_id, canal_id, conta_id, id_no_app, usuario";

function paraConta(linha: LinhaDeConta): ContaConectada {
  return {
    workspaceId: linha.workspace_id,
    canalId: linha.canal_id,
    contaId: linha.conta_id,
    idNoApp: linha.id_no_app,
    usuario: linha.usuario,
  };
}

export async function contaDoCanal(cliente: Cliente, workspaceId: string, canalId: string): Promise<ContaConectada | undefined> {
  const { rows } = await cliente.query<LinhaDeConta>(
    `select ${COLUNAS_DA_CONTA} from plataforma.instagram_contas where workspace_id = $1 and canal_id = $2`,
    [workspaceId, canalId],
  );
  return rows[0] ? paraConta(rows[0]) : undefined;
}

/** O webhook não conhece o Espaço: acha a conta pelo `entry[].id`, em toda a plataforma. */
export async function contaPeloId(cliente: Cliente, contaId: string): Promise<ContaConectada | undefined> {
  const { rows } = await cliente.query<LinhaDeConta>(
    `select ${COLUNAS_DA_CONTA} from plataforma.instagram_contas where conta_id = $1`,
    [contaId],
  );
  return rows[0] ? paraConta(rows[0]) : undefined;
}

/** A desautorização e a exclusão de dados trazem um `user_id`: pode ser o da conta ou o do login. */
export async function contasDoUsuarioDaMeta(cliente: Cliente, userId: string): Promise<ContaConectada[]> {
  const { rows } = await cliente.query<LinhaDeConta>(
    `select ${COLUNAS_DA_CONTA} from plataforma.instagram_contas where conta_id = $1 or id_no_app = $1`,
    [userId],
  );
  return rows.map(paraConta);
}

export async function gravarConta(cliente: Cliente, conta: ContaConectada & { readonly conectadaPor: string }): Promise<void> {
  await cliente.query(
    `insert into plataforma.instagram_contas (workspace_id, canal_id, conta_id, id_no_app, usuario, conectada_por)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (workspace_id, canal_id) do update
       set conta_id = excluded.conta_id, id_no_app = excluded.id_no_app, usuario = excluded.usuario,
           conectada_por = excluded.conectada_por, conectada_em = now()`,
    [conta.workspaceId, conta.canalId, conta.contaId, conta.idNoApp, conta.usuario, conta.conectadaPor],
  );
}

/**
 * Desconectar, arquivar, a desautorização e o pedido de exclusão da Meta: somem a conta,
 * quem escreveu para ela e a credencial, APAGADA do cofre (não só revogada). É o que a
 * Revisão do app promete: "Tokens are deleted when the business disconnects the account."
 * As Conversas e Mensagens ficam: são dado do cliente da plataforma.
 */
export async function esquecerConta(cliente: Cliente, workspaceId: string, canalId: string): Promise<void> {
  await cliente.query("delete from plataforma.instagram_remetentes where workspace_id = $1 and canal_id = $2", [workspaceId, canalId]);
  await cliente.query("delete from plataforma.instagram_contas where workspace_id = $1 and canal_id = $2", [workspaceId, canalId]);
  await cliente.query(
    "delete from plataforma.credenciais where workspace_id = $1 and dono_tipo = 'canal' and dono_id = $2 and tipo = $3",
    [workspaceId, canalId, TIPO_DA_CREDENCIAL],
  );
}

/** Quem escreveu: o @ (forma canônica, sem `@`) e o nome do perfil que a Meta deu para o IGSID. */
export interface Remetente {
  readonly igsid: string;
  readonly usuario: string;
  readonly nome: string | null;
  /** ISO 8601: quando o perfil foi lido da Meta pela última vez. */
  readonly atualizadoEm: string;
}

/** A porta que o provedor usa; `remetentesPg` é a do banco, os testes de contrato usam uma em memória. */
export interface RemetentesDoInstagram {
  doIgsid(workspaceId: string, canalId: string, igsid: string): Promise<Remetente | undefined>;
  /** O IGSID de quem usa este @ nesta conta: a saída responde pelo IGSID, nunca pelo @. */
  igsidDoUsuario(workspaceId: string, canalId: string, usuario: string): Promise<string | undefined>;
  gravar(workspaceId: string, canalId: string, remetente: Omit<Remetente, "atualizadoEm">): Promise<void>;
}

export function remetentesPg(pool: () => Cliente): RemetentesDoInstagram {
  return {
    async doIgsid(workspaceId, canalId, igsid) {
      const { rows } = await pool().query<{ igsid: string; usuario: string; nome: string | null; atualizado_em: Date }>(
        `select igsid, usuario, nome, atualizado_em from plataforma.instagram_remetentes
          where workspace_id = $1 and canal_id = $2 and igsid = $3`,
        [workspaceId, canalId, igsid],
      );
      const linha = rows[0];
      return linha ? { igsid: linha.igsid, usuario: linha.usuario, nome: linha.nome, atualizadoEm: linha.atualizado_em.toISOString() } : undefined;
    },

    async igsidDoUsuario(workspaceId, canalId, usuario) {
      // O mais recente: se dois IGSID já tiveram o mesmo @ (a pessoa trocou de @ e outra o pegou), vale o último lido.
      const { rows } = await pool().query<{ igsid: string }>(
        `select igsid from plataforma.instagram_remetentes
          where workspace_id = $1 and canal_id = $2 and usuario = $3
          order by atualizado_em desc limit 1`,
        [workspaceId, canalId, usuario],
      );
      return rows[0]?.igsid;
    },

    async gravar(workspaceId, canalId, remetente) {
      await pool().query(
        `insert into plataforma.instagram_remetentes (workspace_id, canal_id, igsid, usuario, nome)
         values ($1, $2, $3, $4, $5)
         on conflict (workspace_id, canal_id, igsid) do update
           set usuario = excluded.usuario, nome = coalesce(excluded.nome, plataforma.instagram_remetentes.nome), atualizado_em = now()`,
        [workspaceId, canalId, remetente.igsid, remetente.usuario, remetente.nome],
      );
    },
  };
}
