-- Tabelas de transporte e auditoria para a Fase 2. `plataforma.registros`
-- continua sendo o armazenamento canônico das entidades da ontologia — estas
-- seis tabelas não são entidades, são o que faz evento, replay, credencial,
-- upload e importação terem durabilidade sem virar conceito de domínio
-- (02-RESEARCH.md §"Plataforma (crm-n1)"). Nenhuma delas entra em
-- `hidratar()`/`gravar()`.

/*
 * Outbox transacional. Uma linha aqui nasce no MESMO `pg.Client` da
 * transação que grava a Tarefa em `plataforma.registros` — é o que garante
 * que o evento existe se e somente se a escrita da Tarefa existiu (sem essa
 * garantia, um crash entre as duas escritas perderia o evento ou o
 * duplicaria). `id` é também o `eventId`/idempotency key que o receptor usa.
 *
 * O índice único parcial abaixo é o invariante V02-07A ("um e só um evento
 * por commit") sendo do banco, não do código: duas tentativas de emitir
 * `solicitacao.criada.v1` para o mesmo agregado colidem na constraint, não
 * numa checagem que uma corrida poderia furar.
 *
 * `payload` nunca guarda CPF/CNPJ, chave Pix, código de barras ou conteúdo
 * de anexo — só os campos que o `automation/` precisa para buscar a Tarefa
 * de volta pela API.
 */
create table if not exists plataforma.integration_outbox (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       text not null,
  aggregate_type     text not null,
  aggregate_id       text not null,
  event_type         text not null,
  event_version      int not null default 1,
  payload            jsonb not null,
  status             text not null default 'pending'
                        check (status in ('pending', 'delivering', 'delivered', 'failed')),
  attempts           int not null default 0,
  available_at       timestamptz not null default now(),
  locked_at          timestamptz,
  locked_by          text,
  last_error_code    text,
  last_error_summary text,
  created_at         timestamptz not null default now(),
  delivered_at       timestamptz
);

create index if not exists integration_outbox_pending_idx
  on plataforma.integration_outbox (available_at, id)
  where status = 'pending';
  -- Uso: o worker reivindica a próxima linha pendente com
  -- `for update skip locked`, sem duas conexões pegarem a mesma.

create index if not exists integration_outbox_aggregate_idx
  on plataforma.integration_outbox (aggregate_type, aggregate_id);

create unique index if not exists integration_outbox_solicitacao_criada_uniq
  on plataforma.integration_outbox (aggregate_type, aggregate_id, event_type)
  where event_type = 'solicitacao.criada.v1';
  -- Uma Tarefa nasce uma vez só: o segundo insert para o mesmo agregado
  -- com este event_type viola a constraint (V02-07A é do banco).

/*
 * Idempotência de escrita serviço-a-serviço. Toda chamada HTTP do
 * `automation/` para o `apps/api` (e vice-versa) que muda estado carrega uma
 * `idempotency_key`; a chave composta é o que impede reaplicar o mesmo
 * efeito quando o chamador repete por timeout sem saber se a primeira
 * tentativa chegou.
 *
 * `response_body` nunca guarda CPF/CNPJ, chave Pix, código de barras ou
 * conteúdo de anexo — só o suficiente para responder de novo com a mesma
 * resposta da primeira vez.
 */
create table if not exists plataforma.http_idempotency (
  service_id      text not null,
  route_template  text not null,
  idempotency_key text not null,
  request_hash    text not null,
  status          text not null
                     check (status in ('in_progress', 'completed')),
  response_status int,
  response_body   jsonb,
  created_at      timestamptz not null default now(),
  completed_at    timestamptz,
  primary key (service_id, route_template, idempotency_key)
);

create index if not exists http_idempotency_created_at_idx
  on plataforma.http_idempotency (created_at);
  -- Uso: limpeza das linhas com mais de 90 dias.

/*
 * Credenciais de serviço. `id` é o prefixo público do token (o que aparece
 * em log); `secret_hash` é o sha-256 do segredo — o segredo em si nunca é
 * persistido em texto puro, só o hash (D-15/D-20, T-02-12). `member_id`
 * aponta para o Membro "Agente do pipeline" que a credencial representa: a
 * credencial de serviço resolve para um Membro identificável, não para uma
 * identidade anônima.
 *
 * `state` permite rotação com duas linhas válidas ao mesmo tempo
 * (`ativa` e `rotacionando`) sem reabrir uma credencial já `revogada`.
 */
create table if not exists plataforma.service_credentials (
  id            text primary key,
  workspace_id  text not null,
  nome          text not null,
  secret_hash   text not null,
  scopes        text[] not null,
  member_id     text not null,
  state         text not null default 'ativa'
                   check (state in ('ativa', 'rotacionando', 'revogada')),
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz,
  revoked_at    timestamptz
);

create index if not exists service_credentials_active_idx
  on plataforma.service_credentials (workspace_id)
  where state <> 'revogada';

/*
 * Sessões de upload. Um objeto de Storage só vira anexo de uma Tarefa
 * dentro da sessão que o gerou (D-04): a sessão tem expiração, e o objeto
 * (tabela filha) é único globalmente por `object_key` — é essa unicidade
 * que impede uma submissão reusar o objeto de outra (T-02-06).
 */
create table if not exists plataforma.upload_sessions (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  text not null,
  form_id       text not null,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  consumed_at   timestamptz,
  object_count  int not null default 0
);

create table if not exists plataforma.upload_objects (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references plataforma.upload_sessions (id) on delete cascade,
  object_key   text not null unique,
  display_name text not null,
  media_type   text not null,
  size_bytes   bigint,
  sha256       text,
  state        text not null default 'reservado'
                  check (state in ('reservado', 'enviado', 'consumido', 'expirado')),
  created_at   timestamptz not null default now()
);

/*
 * Ledger da importação histórica do ClickUp/financeiro-tria. A primary key
 * composta `(origem, legacy_task_id)` é o que torna reaplicar o import
 * idempotente por construção (D-25): rodar a importação duas vezes não
 * duplica linha, a segunda tentativa para o mesmo par colide na PK.
 *
 * `motivo` é texto curto de categoria (`taskid_ausente`, `aprovado_ambiguo`,
 * etc.) — nunca o conteúdo da linha de origem, que poderia carregar dado
 * financeiro identificável (T-02-21).
 */
create table if not exists plataforma.importacao_ledger (
  origem         text not null,
  legacy_task_id text not null,
  run_id         uuid not null,
  task_id        text,
  resultado      text not null
                    check (resultado in ('importada', 'rejeitada', 'avisada')),
  motivo         text,
  source_hash    text not null,
  created_at     timestamptz not null default now(),
  primary key (origem, legacy_task_id)
);

create index if not exists importacao_ledger_run_resultado_idx
  on plataforma.importacao_ledger (run_id, resultado);
  -- Uso: relatório de reconciliação por execução de importação.
