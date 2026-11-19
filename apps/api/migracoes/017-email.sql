-- O e-mail de verdade (Sessao 9 - E-mail, Fase 17, plano 17-04; decisoes D-17-05, D-17-06, D-17-08, D-17-13 e D-17-20).
--
-- O e-mail e um `ProvedorDeMensageria` (`mensageria/provedores/email/`): a mensagem recebida entra pela
-- fila `plataforma.webhooks_recebidos` (013), escrita pelo leitor IMAP, e a resposta sai pelo outbox
-- (`mensagem.enviar.v1`) por SMTP, como o Instagram (014). Esta migracao so guarda o que e do e-mail.
--
-- O QUE ENTRA:
--   `plataforma.email_contas`: a caixa ligada a um Canal `email-imap-smtp`. Uma linha por Canal
--   conectado; desconectar ou arquivar o Canal APAGAM a linha, o cursor e a credencial no cofre.
--     - `endereco` e o endereco da caixa (o `identificador_externo` do Canal);
--     - `tipo_de_login` diz como a caixa foi aberta: usuario e a palavra-passe da propria caixa, ou o
--       login de um dos dois servicos (Google, Microsoft). So um rotulo: nada que abra a caixa mora aqui;
--     - servidores e portas de IMAP e SMTP: o banco so confere que e uma porta possivel (1 a 65535). As
--       portas PERMITIDAS sao regra da guarda de rede (17-03), aplicada a cada conexao: os duplos de
--       teste escutam em portas efemeras, e o banco nao as repete;
--     - `conta_externa_id` e o identificador estavel da conta no servico de login (o `sub` do Google,
--       `oid:tid` da Microsoft); nulo no login por usuario e palavra-passe;
--     - `append_enviados` e `pasta_enviados`: se o envio copia a mensagem para a pasta de Enviados da
--       caixa (`auto` decide pelo servidor) e qual e a pasta;
--     - `motivo_da_queda` e `caiu_em`: por que a caixa parou de ser lida (D-17-20). O Canal nao tem
--       coluna de motivo e a regra do Canal nao muda; a ficha le o motivo daqui.
--   `plataforma.cursores_de_canal`: ate onde o leitor ja leu, por pasta da caixa. `uidvalidity` fica em
--   texto (e `bigint` no cliente IMAP e nao cabe num `number`), e `proximo_uid` e o proximo UID a ler
--   (o `UIDNEXT`): o valor inicial e exatamente o `UIDNEXT` da caixa, sem conta de mais ou de menos
--   um. A mesma transacao que grava a linha da fila grava o cursor (D-17-08).
--   `plataforma.mensagens.corpo_html`: o HTML do e-mail recebido, como `{ objectKey, tamanhoBytes }`
--   do objeto no bucket. O HTML nao vai em `anexos`, que so tem arquivo para baixar (D-17-13).
--
-- A credencial NAO esta aqui: fica cifrada em `plataforma.credenciais` (009), com `tipo` =
-- `email-imap-smtp` (o nome do provedor, o que `canalParaProvedor` le), num JSON versionado. Nenhuma
-- tabela desta migracao tem coluna que guarde segredo de acesso: esta e a unica porta de mao unica da
-- fase e ela e fechada de proposito.
--
-- ATENCAO: `email_contas.endereco` e dado pessoal. Nunca vai a log.
--
-- Sem `grant`: a 009 concede DML ao `n1_api` por `alter default privileges`, e
-- `npm run banco:conceder` e a rede. Roda inteira dentro da transacao de `migrar()`.
-- Idempotente: `create ... if not exists`, constraints precedidas de `drop constraint if exists`.
-- Migracao aplicada e imutavel: ajuste e a seguinte (`018`).

create table if not exists plataforma.email_contas (
  workspace_id      text        not null,
  canal_id          text        not null,
  endereco          text        not null,
  tipo_de_login     text        not null,
  imap_host         text        not null,
  imap_porta        int         not null,
  smtp_host         text        not null,
  smtp_porta        int         not null,
  conta_externa_id  text,
  append_enviados   text        not null default 'auto',
  pasta_enviados    text,
  motivo_da_queda   text,
  caiu_em           timestamptz,
  conectada_por     text        not null,
  conectada_em      timestamptz not null default now(),
  atualizado_em     timestamptz not null default now(),
  primary key (workspace_id, canal_id),
  foreign key (workspace_id, canal_id) references plataforma.canais (workspace_id, id) on delete cascade,
  constraint email_contas_endereco_ck check (length(btrim(endereco)) > 0),
  constraint email_contas_tipo_de_login_ck check (tipo_de_login in ('senha', 'google', 'microsoft')),
  constraint email_contas_imap_host_ck check (length(btrim(imap_host)) > 0),
  constraint email_contas_smtp_host_ck check (length(btrim(smtp_host)) > 0),
  constraint email_contas_imap_porta_ck check (imap_porta between 1 and 65535),
  constraint email_contas_smtp_porta_ck check (smtp_porta between 1 and 65535),
  constraint email_contas_append_enviados_ck check (append_enviados in ('auto', 'sim', 'nao')),
  constraint email_contas_queda_ck check ((motivo_da_queda is null) = (caiu_em is null))
);

drop trigger if exists email_contas_atualizado_em on plataforma.email_contas;
create trigger email_contas_atualizado_em before update on plataforma.email_contas
  for each row execute function plataforma.crm_toque_atualizado_em();

create table if not exists plataforma.cursores_de_canal (
  workspace_id   text        not null,
  canal_id       text        not null,
  pasta          text        not null,
  uidvalidity    text        not null,
  proximo_uid    bigint      not null,
  atualizado_em  timestamptz not null default now(),
  primary key (workspace_id, canal_id, pasta),
  foreign key (workspace_id, canal_id) references plataforma.email_contas (workspace_id, canal_id) on delete cascade,
  constraint cursores_de_canal_pasta_ck check (length(btrim(pasta)) > 0),
  constraint cursores_de_canal_uidvalidity_ck check (uidvalidity ~ '^[0-9]+$'),
  constraint cursores_de_canal_proximo_uid_ck check (proximo_uid >= 1)
);

drop trigger if exists cursores_de_canal_atualizado_em on plataforma.cursores_de_canal;
create trigger cursores_de_canal_atualizado_em before update on plataforma.cursores_de_canal
  for each row execute function plataforma.crm_toque_atualizado_em();

-- O HTML do e-mail recebido: so a referencia ao objeto no bucket. Nulo para toda Mensagem que nao e e-mail.
alter table plataforma.mensagens add column if not exists corpo_html jsonb;

alter table plataforma.mensagens drop constraint if exists mensagens_corpo_html_ck;
alter table plataforma.mensagens
  add constraint mensagens_corpo_html_ck
  check (corpo_html is null or (jsonb_typeof(corpo_html) = 'object' and corpo_html ? 'objectKey'));

-- Decisao F7 da 009: sem RLS ate a Sessao 12. Bloco copiado da 009 (e da 013 e da 014): desliga em toda
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
