-- Banco fechado e cofre de credenciais (Fase 9 - Seguranca dos dados).
-- Fonte: TAREFAS-POR-SESSAO.md 1.3.3 e 1.4.1; decisoes D-04, D-05, D-06 e D-17 do
-- CONTEXT da Fase 9; achados F6 e F7 da pesquisa.
--
-- O que esta migracao faz, nesta ordem (a ORDEM importa):
--   (c) cria plataforma.credenciais ANTES de qualquer grant/revoke, para que os
--       privilegios abaixo a alcancem;
--   (d) fixa o search_path das tres funcoes da 007 (a 007 e imutavel);
--   (a) fecha o schema para anon, authenticated e public (D-04: torna declarativo
--       o que a conferencia de 22/10 achou no banco de producao) e desliga a RLS
--       (D-05: sem RLS nesta fase - F7, um event trigger `ensure_rls` liga RLS
--       em tabela nova sem policy e `n1_api`, sem bypassrls, enxergaria zero linhas);
--   (b) concede so DML ao papel `n1_api`, SE ele existir (o app deixa de rodar
--       como dono do banco; migracao e DDL ficam com o dono - D-07);
--   (e) revoga o EXECUTE de public.rls_auto_enable(), SE ela existir.
--
-- Roda no Postgres puro dos testes (sem anon/authenticated, F6), no Supabase com
-- e sem `n1_api`, e inteira dentro da transacao de `migrar()`: se algo falhar,
-- nem a linha em plataforma.migracoes nem os revoke ficam aplicados.
--
-- O papel `n1_api` pode nascer DEPOIS desta migracao. Editar a 009 aplicada e
-- proibido; a recuperacao e `npm run banco:conceder` (apps/api/deploy/
-- conceder-n1-api.sql, idempotente, fora de migracoes/). O bloco (b) daqui e o
-- do script sao o mesmo SQL, e um teste compara os dois resultados.
--
-- A 007 e a 008 sao imutaveis; esta tambem sera, depois de aplicada em producao.
-- TODA migracao FUTURA que criar tabela em `plataforma` repete o bloco de desligar
-- RLS (abaixo) se o `ensure_rls` existir no projeto.

create schema if not exists plataforma;

-- (c) O cofre. A chave (workspace_id, id) e a PK como na 008; o segredo so existe
-- cifrado (AES-256-GCM, feito na aplicacao): segredo_cifrado + iv + etiqueta, e a
-- versao da chave que o cifrou. `revogado_em` aposenta a credencial sem apagar.
create table if not exists plataforma.credenciais (
  id               text        not null default gen_random_uuid()::text,
  workspace_id     text        not null,
  dono_tipo        text        not null,
  dono_id          text        not null,
  tipo             text        not null,
  segredo_cifrado  bytea       not null,
  iv               bytea       not null,
  etiqueta         bytea       not null,
  versao_da_chave  int         not null,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),
  revogado_em      timestamptz,
  primary key (workspace_id, id),
  constraint credenciais_dono_tipo_ck check (dono_tipo in ('canal', 'integracao')),
  constraint credenciais_versao_ck check (versao_da_chave >= 1)
);

-- Uma credencial ATIVA por dono e tipo; as revogadas ficam como historico.
create unique index if not exists credenciais_ativa_unica
  on plataforma.credenciais (workspace_id, dono_tipo, dono_id, tipo)
  where revogado_em is null;

drop trigger if exists credenciais_atualizado_em on plataforma.credenciais;
create trigger credenciais_atualizado_em before update on plataforma.credenciais
  for each row execute function plataforma.crm_toque_atualizado_em();

-- (d) search_path fixo nas tres funcoes da 007 (assinaturas exatas da 007).
alter function plataforma.crm_toque_atualizado_em()     set search_path = pg_catalog, plataforma;
alter function plataforma.crm_exige_admin_na_empresa()  set search_path = pg_catalog, plataforma;
alter function plataforma.crm_confere_admin(text, text) set search_path = pg_catalog, plataforma;

-- (a) Fechar. anon e authenticated so existem no Supabase (F6): sem a guarda por
-- pg_roles, `revoke ... from anon` quebra o Postgres puro. Nenhum revoke de
-- EXECUTE em funcao de `plataforma`: crm_exige_admin_na_empresa chama
-- crm_confere_admin com os privilegios de quem faz o DML.
do $$
declare
  papel text;
begin
  foreach papel in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = papel) then
      execute format('revoke all on schema plataforma from %I', papel);
      execute format('revoke all on all tables in schema plataforma from %I', papel);
      execute format('revoke all on all sequences in schema plataforma from %I', papel);
      execute format('alter default privileges in schema plataforma revoke all on tables from %I', papel);
      execute format('alter default privileges in schema plataforma revoke all on sequences from %I', papel);
    end if;
  end loop;
end $$;

revoke all on schema plataforma from public;

-- D-05 / F7: sem RLS nesta fase. Se o projeto tem o event trigger `ensure_rls`
-- (rls_auto_enable), cada tabela nova de `plataforma` nasceu com RLS ligada e sem
-- policy. Desligar aqui, em toda tabela, inclusive a credenciais acima. A RLS por
-- workspace_id fica para a Sessao 12 (decisao 12.1), com policy.
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

-- (b) n1_api: so DML. Nunca superusuario, nunca bypassrls, nunca DDL, nunca
-- escreve em plataforma.migracoes. Se o papel ainda nao existe, nada e concedido
-- e nada falha: `npm run banco:conceder` faz isto depois.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'n1_api') then
    grant usage on schema plataforma to n1_api;
    grant select, insert, update, delete on all tables in schema plataforma to n1_api;
    grant usage, select on all sequences in schema plataforma to n1_api;
    grant execute on all functions in schema plataforma to n1_api;
    alter default privileges in schema plataforma grant select, insert, update, delete on tables to n1_api;
    alter default privileges in schema plataforma grant usage, select on sequences to n1_api;
    alter default privileges in schema plataforma grant execute on functions to n1_api;
    revoke insert, update, delete, truncate on plataforma.migracoes from n1_api;
  end if;
end $$;

-- (e) public.rls_auto_enable() e a funcao do event trigger `ensure_rls` do guia do
-- Supabase: ela existe no projeto de producao e pode nao existir num projeto novo.
-- Revogar o EXECUTE de anon/authenticated/public e o conserto que o proprio
-- Supabase manda (lints 0028/0029) e nao impede o event trigger de disparar. O dono
-- da funcao pode nao ser quem roda a migracao: nesse caso o revoke fica para o
-- dono do Supabase (aviso, sem derrubar o deploy).
do $$
declare
  papel text;
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    begin
      foreach papel in array array['anon', 'authenticated'] loop
        if exists (select 1 from pg_roles where rolname = papel) then
          execute format('revoke execute on function public.rls_auto_enable() from %I', papel);
        end if;
      end loop;
      revoke execute on function public.rls_auto_enable() from public;
    exception
      when insufficient_privilege then
        raise notice 'rls_auto_enable: sem privilegio para revogar (dono diferente); fica para o dono do Supabase';
      when undefined_object then
        null; -- anon/authenticated inexistentes (Postgres local)
    end;
  end if;
end $$;
