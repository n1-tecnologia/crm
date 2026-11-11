-- O Instagram de verdade (Sessao 8 - Instagram, itens 8.2 e 8.3 de TAREFAS-POR-SESSAO.md).
--
-- O Instagram e um `ProvedorDeMensageria` (`mensageria/provedores/instagram/`): a Mensagem entra
-- pela fila `plataforma.webhooks_recebidos` (013) e por `receberMensagem`, e sai pelo outbox
-- (`mensagem.enviar.v1`), como qualquer provedor. Esta migracao so guarda o que e do Instagram.
--
-- O QUE ENTRA:
--   `plataforma.instagram_contas`: a conta profissional ligada a um Canal `instagram-graph`
--   pelo login do Instagram (OAuth). Uma linha por Canal conectado; desconectar, arquivar ou a
--   Meta avisar que o acesso foi retirado APAGAM a linha (e a credencial no cofre).
--     - `conta_id` e o id da conta profissional (`user_id` de `GET /me`): e o `entry[].id` do
--       webhook, por onde a rota da Meta acha o Canal de cada evento. O webhook nao conhece o
--       Espaco de Trabalho, por isso o indice unico e GLOBAL: uma conta do Instagram fica ligada
--       a um Canal so na plataforma inteira;
--     - `id_no_app` e o id que o login devolve (`user_id` da troca do codigo). A desautorizacao
--       e o pedido de exclusao de dados da Meta chegam com um dos dois; guardamos ambos.
--   `plataforma.instagram_remetentes`: quem escreveu para a conta. O webhook identifica a
--   pessoa por um id do Instagram proprio de cada conta conectada (IGSID), nunca pelo @. Esta
--   tabela guarda o @ e o nome que o perfil da pessoa deu para aquele IGSID: a entrada troca o
--   IGSID pelo @ antes de `receberMensagem`, e a saida troca o @ do Contato pelo IGSID.
--
-- DECISAO (8.3.1): o plano oferecia (A) um tipo novo de Identificador no Contato, ou (B) o id
-- no tipo `instagram`. Ficou uma terceira forma: o IGSID mora nesta tabela do provedor, e o
-- Contato recebe o Identificador `instagram` normal, com o @, por `receberMensagem`. O check de
-- tipos da 007, a regra da Conversa (`TIPO_DE_IDENTIFICADOR_DO_CANAL`) e as telas do Contato nao
-- mudam, e a busca por @ continua funcionando. Sem `contato_id` aqui: quem acha ou cria o Contato
-- e `receberMensagem`, pelo @.
--
-- A credencial NAO esta aqui: fica cifrada em `plataforma.credenciais` (009), com `tipo` =
-- `instagram-graph` (o nome do provedor, o que `canalParaProvedor` le).
--
-- ATENCAO: `instagram_remetentes` tem dado pessoal de terceiro (o @ e o nome). Nunca vai a log.
--
-- Sem `grant`: a 009 concede DML ao `n1_api` por `alter default privileges`, e
-- `npm run banco:conceder` e a rede. Roda inteira dentro da transacao de `migrar()`.
-- Idempotente: `create ... if not exists`. Migracao aplicada e imutavel: ajuste e a seguinte.

create table if not exists plataforma.instagram_contas (
  workspace_id   text        not null,
  canal_id       text        not null,
  conta_id       text        not null,
  id_no_app      text,
  usuario        text        not null,
  conectada_por  text        not null,
  conectada_em   timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  primary key (workspace_id, canal_id),
  foreign key (workspace_id, canal_id) references plataforma.canais (workspace_id, id) on delete cascade,
  constraint instagram_contas_conta_ck check (length(btrim(conta_id)) > 0),
  constraint instagram_contas_usuario_ck check (length(btrim(usuario)) > 0)
);

-- Uma conta do Instagram, um Canal: o webhook acha o Canal so por `conta_id`.
create unique index if not exists instagram_contas_conta_uq on plataforma.instagram_contas (conta_id);
create index if not exists instagram_contas_id_no_app_idx on plataforma.instagram_contas (id_no_app);

drop trigger if exists instagram_contas_atualizado_em on plataforma.instagram_contas;
create trigger instagram_contas_atualizado_em before update on plataforma.instagram_contas
  for each row execute function plataforma.crm_toque_atualizado_em();

create table if not exists plataforma.instagram_remetentes (
  workspace_id   text        not null,
  canal_id       text        not null,
  igsid          text        not null,
  usuario        text        not null,
  nome           text,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  primary key (workspace_id, canal_id, igsid),
  foreign key (workspace_id, canal_id) references plataforma.canais (workspace_id, id) on delete cascade,
  constraint instagram_remetentes_igsid_ck check (length(btrim(igsid)) > 0),
  -- A forma canonica do Identificador `instagram` (`normalizarInstagram`): sem @, minusculas.
  constraint instagram_remetentes_usuario_ck check (usuario ~ '^[a-z0-9._]{1,30}$')
);

-- A saida acha o IGSID pelo @ do Contato.
create index if not exists instagram_remetentes_usuario_idx
  on plataforma.instagram_remetentes (workspace_id, canal_id, usuario);

drop trigger if exists instagram_remetentes_atualizado_em on plataforma.instagram_remetentes;
create trigger instagram_remetentes_atualizado_em before update on plataforma.instagram_remetentes
  for each row execute function plataforma.crm_toque_atualizado_em();

-- Decisao F7 da 009: sem RLS ate a Sessao 12. Bloco copiado da 009 (e da 013): desliga em toda
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
