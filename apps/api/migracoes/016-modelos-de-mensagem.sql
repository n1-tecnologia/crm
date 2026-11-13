-- As Mensagens de modelo do WhatsApp oficial (Sessao 7 - item 7.3 de TAREFAS-POR-SESSAO.md).
--
-- O modelo e CRIADO e APROVADO na Meta (Gerenciador do WhatsApp). O CRM so o sincroniza: lê
-- `GET /{waba-id}/message_templates` e guarda uma linha por (Canal, nome, idioma), para a Caixa de
-- Entrada oferecer os aprovados quando a janela de 24 h fecha ou antes da primeira mensagem do Contato.
--
-- O QUE ENTRA:
--   `plataforma.modelos_de_mensagem`:
--     - `id_no_provedor` e o id do modelo na Meta; `nome` e `idioma` sao o que a Cloud API usa para ENVIAR
--       (`template.name` e `template.language.code`). A chave natural e (Canal, nome, idioma): o mesmo nome em
--       dois idiomas sao dois modelos, e a sincronizacao atualiza a linha em vez de duplicar;
--     - `categoria` e `estado` sao os da Meta traduzidos (`UTILITY`/`MARKETING`/`AUTHENTICATION`;
--       `APPROVED`/`PENDING`/`REJECTED`/`PAUSED`/`DISABLED` e os estados de apelacao, sinalizado e exclusao, que a
--       sincronizacao reduz a esses cinco). So `aprovado` e oferecido para enviar;
--     - `motivo_rejeicao` e o `rejected_reason` da Meta, para a ficha do Canal mostrar por que um modelo foi recusado;
--     - `componentes` e o jsonb que a Meta devolve (HEADER, BODY, FOOTER, BUTTONS), sem traducao: guardar o formato
--       dela evita perder campo que ainda nao usamos. `quantidade_de_variaveis` e a maior `{{n}}` do corpo, guardada para
--       a lista nao reler o jsonb;
--     - `sincronizado_em` e quando a lista do Canal foi lida da Meta pela ultima vez. A sincronizacao APAGA os modelos que
--       sumiram da Meta (o Canal passa a ter exatamente o que ela tem).
--
-- A tabela de respostas de Flow (7.4) NAO entra aqui: fica em migracao propria, quando os Flows forem construidos.
-- Migracao aplicada e imutavel: ajuste e a seguinte.
--
-- Os modelos de um Canal vao embora com ele (`on delete cascade`). Desconectar o numero NAO apaga os modelos: eles sao
-- da conta do WhatsApp Business, e voltam a ser lidos na proxima conexao.
--
-- Sem `grant`: a 009 concede DML ao `n1_api` por `alter default privileges`, e `npm run banco:conceder` e a rede.
-- Roda inteira dentro da transacao de `migrar()`. Idempotente: `create ... if not exists`.

create table if not exists plataforma.modelos_de_mensagem (
  id                      text        not null default gen_random_uuid()::text,
  workspace_id            text        not null,
  canal_id                text        not null,
  id_no_provedor          text        not null,
  nome                    text        not null,
  idioma                  text        not null,
  categoria               text        not null,
  estado                  text        not null,
  motivo_rejeicao         text,
  componentes             jsonb       not null default '[]'::jsonb,
  quantidade_de_variaveis integer     not null default 0,
  sincronizado_em         timestamptz not null default now(),
  criado_em               timestamptz not null default now(),
  atualizado_em           timestamptz not null default now(),
  primary key (workspace_id, id),
  foreign key (workspace_id, canal_id) references plataforma.canais (workspace_id, id) on delete cascade,
  constraint modelos_de_mensagem_nome_ck check (length(btrim(nome)) > 0),
  constraint modelos_de_mensagem_idioma_ck check (length(btrim(idioma)) > 0),
  constraint modelos_de_mensagem_categoria_ck check (categoria in ('utilidade', 'marketing', 'autenticacao')),
  constraint modelos_de_mensagem_estado_ck check (estado in ('aprovado', 'pendente', 'rejeitado', 'pausado', 'desativado')),
  constraint modelos_de_mensagem_variaveis_ck check (quantidade_de_variaveis >= 0),
  constraint modelos_de_mensagem_componentes_ck check (jsonb_typeof(componentes) = 'array')
);

-- A chave natural da Meta: o mesmo nome em idiomas diferentes sao modelos diferentes.
create unique index if not exists modelos_de_mensagem_canal_nome_idioma_uq
  on plataforma.modelos_de_mensagem (workspace_id, canal_id, nome, idioma);

-- A lista de um Canal por estado (a Caixa pede so os aprovados).
create index if not exists modelos_de_mensagem_canal_estado_idx
  on plataforma.modelos_de_mensagem (workspace_id, canal_id, estado);

drop trigger if exists modelos_de_mensagem_atualizado_em on plataforma.modelos_de_mensagem;
create trigger modelos_de_mensagem_atualizado_em before update on plataforma.modelos_de_mensagem
  for each row execute function plataforma.crm_toque_atualizado_em();

-- Decisao F7 da 009: sem RLS ate a Sessao 12. Bloco copiado da 009 (e da 013, 014 e 015): desliga em toda
-- tabela de `plataforma` que nasceu com RLS ligada pelo event trigger `ensure_rls`.
do $$
declare
  t record;
begin
  for t in
    select c.relname
      from pg_class c
     where c.relnamespace = 'plataforma'::regnamespace
       and c.relkind in ('r', 'p')
       and c.relrowsecurity
  loop
    execute format('alter table plataforma.%I disable row level security', t.relname);
  end loop;
end $$;
