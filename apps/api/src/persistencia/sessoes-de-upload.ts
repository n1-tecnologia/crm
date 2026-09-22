/**
 * Acesso a `plataforma.upload_sessions`/`upload_objects` (migração `003`,
 * comentário na própria tabela) — a sessão de upload é o que faz um objeto
 * de arquivo pertencer a UMA submissão, nunca a outra (T-02-06, D-04).
 *
 * Funções finas: cada uma faz uma consulta sobre uma das duas tabelas, nada
 * mais. Nenhuma função aqui conhece o provedor de armazenamento de arquivos,
 * caminho de rede ou credencial — isso é `servicos/storage-uploads.ts`. Todas
 * aceitam um `PoolClient` opcional para poderem participar da MESMA
 * transação que grava a Tarefa (`unidade-de-trabalho.ts`); sem um, caem no
 * `pool()` de módulo — o padrão de `conexao.ts`.
 *
 * `consumirSessao` é a exceção: recebe o `PoolClient` como PRIMEIRO
 * parâmetro, sempre obrigatório, porque ela SÓ faz sentido dentro da
 * transação da submissão — consumir a sessão fora de uma transação que
 * também grava a Tarefa reabriria a janela que T-02-06 fecha.
 */

import type { Pool, PoolClient } from "pg";
import { pool } from "./conexao";

type Executor = Pool | PoolClient;

function executor(cliente?: PoolClient): Executor {
  return cliente ?? pool();
}

export type EstadoDoObjeto = "reservado" | "enviado" | "consumido" | "expirado";

export interface SessaoDeUpload {
  readonly id: string;
  readonly workspaceId: string;
  readonly formId: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly consumedAt: Date | null;
}

export interface ObjetoDeUpload {
  readonly id: string;
  readonly sessionId: string;
  readonly objectKey: string;
  readonly displayName: string;
  readonly mediaType: string;
  readonly sizeBytes: number | null;
  readonly sha256: string | null;
  readonly state: EstadoDoObjeto;
  readonly createdAt: Date;
}

export interface SessaoExpirada {
  readonly id: string;
  readonly workspaceId: string;
  readonly formId: string;
  readonly expiresAt: Date;
}

interface LinhaObjeto {
  readonly id: string;
  readonly session_id: string;
  readonly object_key: string;
  readonly display_name: string;
  readonly media_type: string;
  readonly size_bytes: string | number | null;
  readonly sha256: string | null;
  readonly state: EstadoDoObjeto;
  readonly created_at: Date;
}

function paraObjeto(linha: LinhaObjeto): ObjetoDeUpload {
  return {
    id: linha.id,
    sessionId: linha.session_id,
    objectKey: linha.object_key,
    displayName: linha.display_name,
    mediaType: linha.media_type,
    sizeBytes: linha.size_bytes === null ? null : Number(linha.size_bytes),
    sha256: linha.sha256,
    state: linha.state,
    createdAt: linha.created_at,
  };
}

/**
 * Busca a sessão por id, sem os objetos. `servicos/storage-uploads.ts` usa
 * isto para validar existência/expiração/consumo ANTES de reservar um
 * objeto novo — `emitirTicket` precisa do `workspaceId`/`formId` da sessão
 * para montar o caminho aleatório do objeto (D-04).
 */
export async function obterSessao(sessionId: string, cliente?: PoolClient): Promise<SessaoDeUpload | undefined> {
  const resultado = await executor(cliente).query<{
    id: string;
    workspace_id: string;
    form_id: string;
    created_at: Date;
    expires_at: Date;
    consumed_at: Date | null;
  }>(
    `select id, workspace_id, form_id, created_at, expires_at, consumed_at
       from plataforma.upload_sessions
      where id = $1`,
    [sessionId],
  );
  const linha = resultado.rows[0];
  if (!linha) return undefined;
  return {
    id: linha.id,
    workspaceId: linha.workspace_id,
    formId: linha.form_id,
    createdAt: linha.created_at,
    expiresAt: linha.expires_at,
    consumedAt: linha.consumed_at,
  };
}

/** Cria a sessão; `expiresAt` é calculado pelo próprio banco a partir do TTL pedido. */
export async function criarSessao(
  args: { readonly workspaceId: string; readonly formId: string; readonly ttlSegundos: number },
  cliente?: PoolClient,
): Promise<{ readonly id: string; readonly expiresAt: Date }> {
  const resultado = await executor(cliente).query<{ id: string; expires_at: Date }>(
    `insert into plataforma.upload_sessions (workspace_id, form_id, expires_at)
     values ($1, $2, now() + make_interval(secs => $3))
     returning id, expires_at`,
    [args.workspaceId, args.formId, args.ttlSegundos],
  );
  const linha = resultado.rows[0]!;
  return { id: linha.id, expiresAt: linha.expires_at };
}

/**
 * Garante que existe uma sessão com ESTE id, para este Formulário.
 *
 * Por que existe: o Formulário público gera um `submissionId` estável no
 * cliente (`crypto.randomUUID()`) e o manda em todo retry — é ele que dá
 * idempotência ao envio. Quando a Solicitação não tem anexo, `pedirTicket`
 * nunca é chamado e nenhuma sessão nasce; sem esta função, `consumirSessao`
 * não acharia nada e todo envio sem arquivo receberia 409 (o caminho mais
 * comum do Formulário).
 *
 * O id vir do cliente é o custo de manter a idempotência, e por isso o
 * escopo é verificado: uma sessão que já existe para OUTRO Espaço ou OUTRO
 * Formulário é recusada em vez de reaproveitada — senão quem descobrisse o
 * `submissionId` alheio poderia consumir a sessão de outra pessoa. O
 * `on conflict do nothing` mantém a operação atômica sob corrida: dois
 * envios simultâneos do mesmo id não criam duas linhas, e o segundo cai em
 * `sessao_ja_consumida` na hora de consumir, como sempre.
 */
export async function garantirSessao(
  args: {
    readonly id: string;
    readonly workspaceId: string;
    readonly formId: string;
    readonly ttlSegundos: number;
  },
  cliente?: PoolClient,
): Promise<{ readonly id: string; readonly expiresAt: Date }> {
  const exec = executor(cliente);
  await exec.query(
    `insert into plataforma.upload_sessions (id, workspace_id, form_id, expires_at)
     values ($1, $2, $3, now() + make_interval(secs => $4))
     on conflict (id) do nothing`,
    [args.id, args.workspaceId, args.formId, args.ttlSegundos],
  );
  const resultado = await exec.query<{ workspace_id: string; form_id: string; expires_at: Date }>(
    `select workspace_id, form_id, expires_at from plataforma.upload_sessions where id = $1`,
    [args.id],
  );
  const linha = resultado.rows[0];
  if (!linha) throw new Error(`sessao_inexistente: ${args.id}`);
  if (linha.workspace_id !== args.workspaceId || linha.form_id !== args.formId) {
    throw new Error(`sessao_de_outro_formulario: ${args.id}`);
  }
  return { id: args.id, expiresAt: linha.expires_at };
}

/**
 * Reserva um objeto para a sessão, `state='reservado'`. O `unique
 * (object_key)` da migração `003` recusa — erro de constraint, não valor de
 * retorno — reusar o mesmo caminho entre sessões: é a defesa de T-02-06
 * sendo do banco, não de uma checagem que uma corrida poderia furar.
 */
export async function reservarObjeto(
  args: {
    readonly sessionId: string;
    readonly objectKey: string;
    readonly displayName: string;
    readonly mediaType: string;
  },
  cliente?: PoolClient,
): Promise<ObjetoDeUpload> {
  const resultado = await executor(cliente).query<LinhaObjeto>(
    `insert into plataforma.upload_objects (session_id, object_key, display_name, media_type)
     values ($1, $2, $3, $4)
     returning id, session_id, object_key, display_name, media_type, size_bytes, sha256, state, created_at`,
    [args.sessionId, args.objectKey, args.displayName, args.mediaType],
  );
  return paraObjeto(resultado.rows[0]!);
}

/** Marca o objeto como `enviado`, com o tamanho e o hash apurados pelo serviço. */
export async function marcarEnviado(
  args: { readonly objectId: string; readonly sizeBytes: number; readonly sha256?: string },
  cliente?: PoolClient,
): Promise<void> {
  await executor(cliente).query(
    `update plataforma.upload_objects
        set state = 'enviado', size_bytes = $2, sha256 = $3
      where id = $1`,
    [args.objectId, args.sizeBytes, args.sha256 ?? null],
  );
}

/** Lista os objetos da sessão, em qualquer estado, na ordem em que foram reservados. */
export async function objetosDaSessao(sessionId: string, cliente?: PoolClient): Promise<readonly ObjetoDeUpload[]> {
  const resultado = await executor(cliente).query<LinhaObjeto>(
    `select id, session_id, object_key, display_name, media_type, size_bytes, sha256, state, created_at
       from plataforma.upload_objects
      where session_id = $1
      order by created_at`,
    [sessionId],
  );
  return resultado.rows.map(paraObjeto);
}

/**
 * Consome a sessão dentro da transação de quem chama: marca `consumed_at` e
 * todos os objetos `enviado` como `consumido`. Recusa (lança) se a sessão já
 * tiver `consumed_at` — uma sessão vira anexo uma vez só — ou se
 * `expires_at` já passou. `for update` trava a linha da sessão para a
 * duração da transação, para duas submissões concorrentes sobre a MESMA
 * sessão não consumirem as duas.
 */
export async function consumirSessao(cliente: PoolClient, sessionId: string): Promise<void> {
  const resultado = await cliente.query<{ consumed_at: Date | null; expires_at: Date }>(
    `select consumed_at, expires_at
       from plataforma.upload_sessions
      where id = $1
      for update`,
    [sessionId],
  );
  const sessao = resultado.rows[0];
  if (!sessao) throw new Error(`sessao_inexistente: ${sessionId}`);
  if (sessao.consumed_at) throw new Error(`sessao_ja_consumida: ${sessionId}`);
  if (new Date(sessao.expires_at).getTime() < Date.now()) throw new Error(`sessao_expirada: ${sessionId}`);

  await cliente.query(`update plataforma.upload_sessions set consumed_at = now() where id = $1`, [sessionId]);
  await cliente.query(
    `update plataforma.upload_objects set state = 'consumido' where session_id = $1 and state = 'enviado'`,
    [sessionId],
  );
}

/**
 * Sessões vencidas e nunca consumidas — candidatas à coleta de órfãos
 * (`servicos/storage-uploads.ts#coletarOrfaos`). Não toca os objetos; quem
 * chama decide o que fazer com o armazenamento antes de `marcarExpirados`.
 */
export async function sessoesExpiradas(limite: number, cliente?: PoolClient): Promise<readonly SessaoExpirada[]> {
  const resultado = await executor(cliente).query<{
    id: string;
    workspace_id: string;
    form_id: string;
    expires_at: Date;
  }>(
    `select id, workspace_id, form_id, expires_at
       from plataforma.upload_sessions
      where consumed_at is null
        and expires_at < now()
      order by expires_at
      limit $1`,
    [limite],
  );
  return resultado.rows.map((linha) => ({
    id: linha.id,
    workspaceId: linha.workspace_id,
    formId: linha.form_id,
    expiresAt: linha.expires_at,
  }));
}

/**
 * Marca `expirado` os objetos (ainda `reservado`/`enviado`) das sessões
 * informadas — o passo final da coleta de órfãos, depois que o serviço já
 * removeu o conteúdo do armazenamento externo.
 */
export async function marcarExpirados(sessionIds: readonly string[], cliente?: PoolClient): Promise<void> {
  if (sessionIds.length === 0) return;
  await executor(cliente).query(
    `update plataforma.upload_objects
        set state = 'expirado'
      where session_id = any($1)
        and state in ('reservado', 'enviado')`,
    [sessionIds],
  );
}
