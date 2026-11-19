/**
 * O SQL do e-mail: a conta da caixa ligada a um Canal e o cursor de leitura (017), e a credencial
 * no cofre (009, ver `credencial.ts`). Só o provedor de e-mail usa estas tabelas; o Canal continua
 * sendo de `repositorios/crm/canais.ts`, e o Contato, de `receberMensagem`.
 *
 * Toda consulta filtra por `workspace_id` (T-17-13): uma conta ou um cursor de outro Espaço nunca
 * aparece. NENHUM endereço, servidor nem motivo de queda vai a log, resposta de erro ou mensagem
 * de exceção daqui: o endereço da caixa é dado pessoal.
 */

import type { Pool, PoolClient } from "pg";
import { TIPO_DA_CREDENCIAL } from "./credencial";

type Cliente = Pick<Pool | PoolClient, "query">;

export type TipoDeLoginDoEmail = "senha" | "google" | "microsoft";
export type AppendEmEnviados = "auto" | "sim" | "nao";

export interface ServidorDoEmail {
  readonly host: string;
  readonly porta: number;
}

/** A conta da caixa de um Canal: tudo que NÃO é segredo (o segredo mora no cofre). */
export interface ContaDeEmail {
  readonly workspaceId: string;
  readonly canalId: string;
  readonly endereco: string;
  readonly tipoDeLogin: TipoDeLoginDoEmail;
  readonly imap: ServidorDoEmail;
  readonly smtp: ServidorDoEmail;
  /** O `sub` do Google ou `oid:tid` da Microsoft; `null` no login por usuário e senha. */
  readonly contaExternaId: string | null;
  readonly appendEnviados: AppendEmEnviados;
  readonly pastaEnviados: string | null;
  /** Por que a caixa parou de ser lida (D-17-20); `null` enquanto está tudo bem. */
  readonly motivoDaQueda: string | null;
  /** ISO 8601. */
  readonly caiuEm: string | null;
  readonly conectadaPor: string;
  /** ISO 8601. */
  readonly conectadaEm: string;
}

/** O que `gravarConta` recebe: a conta sem o que o banco preenche (queda e instante da conexão). */
export interface ContaParaGravar {
  readonly workspaceId: string;
  readonly canalId: string;
  readonly endereco: string;
  readonly tipoDeLogin: TipoDeLoginDoEmail;
  readonly imap: ServidorDoEmail;
  readonly smtp: ServidorDoEmail;
  readonly contaExternaId?: string | null;
  readonly appendEnviados?: AppendEmEnviados;
  readonly pastaEnviados?: string | null;
  readonly conectadaPor: string;
}

/** Até onde a pasta foi lida: o `UIDVALIDITY` (texto: é `bigint` no cliente IMAP) e o próximo UID a ler (`UIDNEXT`). */
export interface CursorDaCaixa {
  readonly pasta: string;
  readonly uidValidity: string;
  readonly proximoUid: number;
}

interface LinhaDeConta {
  readonly workspace_id: string;
  readonly canal_id: string;
  readonly endereco: string;
  readonly tipo_de_login: TipoDeLoginDoEmail;
  readonly imap_host: string;
  readonly imap_porta: number;
  readonly smtp_host: string;
  readonly smtp_porta: number;
  readonly conta_externa_id: string | null;
  readonly append_enviados: AppendEmEnviados;
  readonly pasta_enviados: string | null;
  readonly motivo_da_queda: string | null;
  readonly caiu_em: Date | null;
  readonly conectada_por: string;
  readonly conectada_em: Date;
}

const COLUNAS_DA_CONTA = `c.workspace_id, c.canal_id, c.endereco, c.tipo_de_login, c.imap_host, c.imap_porta, c.smtp_host,
  c.smtp_porta, c.conta_externa_id, c.append_enviados, c.pasta_enviados, c.motivo_da_queda, c.caiu_em, c.conectada_por, c.conectada_em`;

function paraConta(linha: LinhaDeConta): ContaDeEmail {
  return {
    workspaceId: linha.workspace_id,
    canalId: linha.canal_id,
    endereco: linha.endereco,
    tipoDeLogin: linha.tipo_de_login,
    imap: { host: linha.imap_host, porta: linha.imap_porta },
    smtp: { host: linha.smtp_host, porta: linha.smtp_porta },
    contaExternaId: linha.conta_externa_id,
    appendEnviados: linha.append_enviados,
    pastaEnviados: linha.pasta_enviados,
    motivoDaQueda: linha.motivo_da_queda,
    caiuEm: linha.caiu_em ? linha.caiu_em.toISOString() : null,
    conectadaPor: linha.conectada_por,
    conectadaEm: linha.conectada_em.toISOString(),
  };
}

/** Uma conta por Canal: gravar de novo (reconectar) troca os dados, zera a queda e renova `conectada_em`. */
export async function gravarConta(cliente: Cliente, conta: ContaParaGravar): Promise<void> {
  await cliente.query(
    `insert into plataforma.email_contas
       (workspace_id, canal_id, endereco, tipo_de_login, imap_host, imap_porta, smtp_host, smtp_porta,
        conta_externa_id, append_enviados, pasta_enviados, conectada_por)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     on conflict (workspace_id, canal_id) do update
       set endereco = excluded.endereco, tipo_de_login = excluded.tipo_de_login,
           imap_host = excluded.imap_host, imap_porta = excluded.imap_porta,
           smtp_host = excluded.smtp_host, smtp_porta = excluded.smtp_porta,
           conta_externa_id = excluded.conta_externa_id, append_enviados = excluded.append_enviados,
           pasta_enviados = excluded.pasta_enviados, conectada_por = excluded.conectada_por,
           motivo_da_queda = null, caiu_em = null, conectada_em = now()`,
    [
      conta.workspaceId,
      conta.canalId,
      conta.endereco,
      conta.tipoDeLogin,
      conta.imap.host,
      conta.imap.porta,
      conta.smtp.host,
      conta.smtp.porta,
      conta.contaExternaId ?? null,
      conta.appendEnviados ?? "auto",
      conta.pastaEnviados ?? null,
      conta.conectadaPor,
    ],
  );
}

export async function contaDoCanal(cliente: Cliente, workspaceId: string, canalId: string): Promise<ContaDeEmail | undefined> {
  const { rows } = await cliente.query<LinhaDeConta>(
    `select ${COLUNAS_DA_CONTA} from plataforma.email_contas c where c.workspace_id = $1 and c.canal_id = $2`,
    [workspaceId, canalId],
  );
  return rows[0] ? paraConta(rows[0]) : undefined;
}

/**
 * As caixas que o leitor mantém abertas: Canal `email-imap-smtp`, ativo, `conectada`, REAL (não simulado) e com
 * conta. Um Canal `com_erro` (a caixa caiu) ou desconectado sai da lista e o leitor fecha a sessão dele. Atravessa
 * os Espaços de propósito: o leitor é um processo da plataforma, não uma rota de um Espaço.
 */
export async function contasParaLer(cliente: Cliente): Promise<ContaDeEmail[]> {
  const { rows } = await cliente.query<LinhaDeConta>(
    `select ${COLUNAS_DA_CONTA}
       from plataforma.email_contas c
       join plataforma.canais k on k.workspace_id = c.workspace_id and k.id = c.canal_id
      where k.provedor = 'email-imap-smtp'
        and k.estado = 'ativo'
        and k.conexao = 'conectada'
        and k.conexao_simulada = false
      order by c.workspace_id, c.canal_id`,
  );
  return rows.map(paraConta);
}

export async function lerCursor(cliente: Cliente, workspaceId: string, canalId: string, pasta: string): Promise<CursorDaCaixa | undefined> {
  const { rows } = await cliente.query<{ pasta: string; uidvalidity: string; proximo_uid: string }>(
    `select pasta, uidvalidity, proximo_uid from plataforma.cursores_de_canal
      where workspace_id = $1 and canal_id = $2 and pasta = $3`,
    [workspaceId, canalId, pasta],
  );
  const linha = rows[0];
  // `bigint` volta como texto do `pg`; um UID IMAP cabe em 32 bits, então `Number` é exato.
  return linha ? { pasta: linha.pasta, uidValidity: linha.uidvalidity, proximoUid: Number(linha.proximo_uid) } : undefined;
}

/**
 * Grava (ou avança) o cursor da pasta. Recebe o cliente de quem chama porque o leitor o grava na MESMA transação do
 * `insert` da fila (D-17-08): a linha entra na fila e o cursor passa dela, ou nenhuma das duas coisas acontece.
 * Exige a conta (FK): conectar grava a conta antes do cursor.
 */
export async function gravarCursor(cliente: Cliente, workspaceId: string, canalId: string, cursor: CursorDaCaixa): Promise<void> {
  await cliente.query(
    `insert into plataforma.cursores_de_canal (workspace_id, canal_id, pasta, uidvalidity, proximo_uid)
     values ($1, $2, $3, $4, $5)
     on conflict (workspace_id, canal_id, pasta) do update
       set uidvalidity = excluded.uidvalidity, proximo_uid = excluded.proximo_uid`,
    [workspaceId, canalId, cursor.pasta, cursor.uidValidity, cursor.proximoUid],
  );
}

/** A caixa caiu (D-17-20): guarda o motivo e o instante. O estado do Canal é de quem chama (`com_erro`). */
export async function marcarQueda(cliente: Cliente, workspaceId: string, canalId: string, motivo: string): Promise<void> {
  await cliente.query(
    "update plataforma.email_contas set motivo_da_queda = $3, caiu_em = now() where workspace_id = $1 and canal_id = $2",
    [workspaceId, canalId, motivo],
  );
}

export async function limparQueda(cliente: Cliente, workspaceId: string, canalId: string): Promise<void> {
  await cliente.query(
    "update plataforma.email_contas set motivo_da_queda = null, caiu_em = null where workspace_id = $1 and canal_id = $2",
    [workspaceId, canalId],
  );
}

/**
 * Desconectar e arquivar o Canal (D-17-06): somem a conta, o cursor e a credencial, APAGADA do cofre (não só
 * revogada). As Conversas e Mensagens ficam: são dado do cliente da plataforma. Só a credencial de e-mail DESTE
 * Canal sai; a de outro Canal, de outro Espaço ou de outro tipo (o segredo do webhook) não é tocada.
 */
export async function esquecerContaDoEmail(cliente: Cliente, workspaceId: string, canalId: string): Promise<void> {
  // O cursor tem FK em cascata para a conta; apagar à mão deixa a intenção escrita e não depende da cascata.
  await cliente.query("delete from plataforma.cursores_de_canal where workspace_id = $1 and canal_id = $2", [workspaceId, canalId]);
  await cliente.query("delete from plataforma.email_contas where workspace_id = $1 and canal_id = $2", [workspaceId, canalId]);
  await cliente.query(
    "delete from plataforma.credenciais where workspace_id = $1 and dono_tipo = 'canal' and dono_id = $2 and tipo = $3",
    [workspaceId, canalId, TIPO_DA_CREDENCIAL],
  );
}
