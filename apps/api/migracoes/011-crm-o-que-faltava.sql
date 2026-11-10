-- O que o modelo novo do CRM ganha para absorver o antigo (Fase 14 - Unificacao do CRM).
-- Fonte: TAREFAS-POR-SESSAO.md 3.1.2 e 3.1.5; decisoes D-03, D-04, D-05 e D-06 do
-- CONTEXT da Fase 14; "Desenho da migracao 011" da pesquisa.
--
-- O QUE ENTRA (D-04, so o essencial):
--   (a) `contatos.mesclado_em_id` / `mesclado_em` e o estado `mesclado` (RN-CON-14:
--       o Contato absorvido fica, terminal e so de leitura, apontando o sobrevivente);
--   (b) `contato_consentimentos` (so insercao), `contato_notas` e `conversa_marcacoes`
--       (estrela e leitura, POR Membro);
--   (c) `conversas.na_lixeira_em` (a tela de Lixeira mostra quando foi) e os indices
--       parciais de `atribuido_id` e `fila_id` que os filtros de `GET /conversas` usam;
--   (d) `crm_de_para` e `registros_crm_antigo`: o livro-razao e a copia de seguranca
--       do script de migracao dos dados (Fase 15). Nenhuma rota e nenhum `hidratar()`
--       as le: so o script. Guardam dado pessoal das colecoes antigas.
--
-- O QUE FICA DE FORA, por decisao:
--   - coluna de Grupo na Conversa e as duas colunas de Flow na Mensagem (D-05: a Conversa
--     de Grupo e as Mensagens de Flow ficam no modelo antigo ate as Sessoes 6 e 7);
--   - campo de Funil na Lista (D-06: as Listas espelho de Meus negocios foram aposentadas);
--   - Tags, varios Contatos por Negocio, historico de Etapas, Requisitos de Etapa e
--     Anexos (D-04: ficam so em `registros_crm_antigo`);
--   - `webhooks_recebidos` e o indice do evento de saida de mensagem (Fase 16).
--
-- D-03: nao apaga nem altera nenhuma linha de `plataforma.registros`. As duas tabelas
-- de copia nascem vazias.
--
-- A regra "sem cadeia" (RN-CON-14: o sobrevivente nunca e `mesclado`) nao cabe numa
-- constraint simples: e do servico de mesclagem.
--
-- Roda inteira dentro da transacao de `migrar()` (begin/commit/rollback por arquivo):
-- se qualquer passo falhar, nem as colunas nem o registro em plataforma.migracoes
-- ficam aplicados. Idempotente: `drop constraint if exists` antes de cada `add
-- constraint` e `create ... if not exists`; rodar de novo, depois de aplicada, nao muda
-- nada.
--
-- Sem `grant`: a 009 concede DML ao `n1_api` por `alter default privileges`, e
-- `npm run banco:conceder` e a rede. Migracao aplicada e imutavel: ajuste e a `012`.

-- (a) Contato mesclado -------------------------------------------------------
alter table plataforma.contatos add column if not exists mesclado_em_id text;
alter table plataforma.contatos add column if not exists mesclado_em timestamptz;

alter table plataforma.contatos drop constraint if exists contatos_estado_ck;
alter table plataforma.contatos add constraint contatos_estado_ck
  check (estado in ('ativo', 'arquivado', 'na_lixeira', 'mesclado'));

-- `mesclado` se e so se ha sobrevivente; alvo e data andam juntos; ninguem se mescla
-- em si mesmo.
alter table plataforma.contatos drop constraint if exists contatos_mesclado_ck;
alter table plataforma.contatos add constraint contatos_mesclado_ck check (
  (estado = 'mesclado') = (mesclado_em_id is not null)
  and (mesclado_em_id is null) = (mesclado_em is null)
  and mesclado_em_id is distinct from id);

alter table plataforma.contatos drop constraint if exists contatos_mesclado_em_fk;
alter table plataforma.contatos add constraint contatos_mesclado_em_fk
  foreign key (workspace_id, mesclado_em_id) references plataforma.contatos (workspace_id, id);

create index if not exists contatos_mesclado_em_idx
  on plataforma.contatos (workspace_id, mesclado_em_id) where mesclado_em_id is not null;

-- (b) Consentimentos, notas e marcacoes -------------------------------------
-- So insercao: a decisao mais recente por (Contato, finalidade, tipo de canal) vale.
-- `finalidade_id` aponta para um item do Catalogo, que mora em `registros`: sem FK.
create table if not exists plataforma.contato_consentimentos (
  id                    text        not null default gen_random_uuid()::text,
  workspace_id          text        not null,
  contato_id            text        not null,
  finalidade_id         text        not null,
  tipo_de_canal         text        not null,
  decisao               text        not null,
  em                    timestamptz not null,
  origem                text        not null,
  evidencia_mensagem_id text,
  registrado_por        text        not null,
  registrado_em         timestamptz not null default now(),
  primary key (workspace_id, id),
  foreign key (workspace_id, contato_id) references plataforma.contatos (workspace_id, id) on delete cascade,
  constraint contato_consentimentos_canal_ck check (tipo_de_canal in ('whatsapp', 'instagram', 'email', 'todos')),
  constraint contato_consentimentos_decisao_ck check (decisao in ('concedido', 'revogado')),
  constraint contato_consentimentos_origem_ck check (origem in ('mensagem', 'formulario', 'verbal', 'importacao', 'automacao'))
);
create index if not exists contato_consentimentos_contato_idx
  on plataforma.contato_consentimentos (workspace_id, contato_id, finalidade_id, em);

create table if not exists plataforma.contato_notas (
  id            text        not null default gen_random_uuid()::text,
  workspace_id  text        not null,
  contato_id    text        not null,
  conteudo      text        not null,
  autor_id      text        not null,
  criado_em     timestamptz not null default now(),
  primary key (workspace_id, id),
  foreign key (workspace_id, contato_id) references plataforma.contatos (workspace_id, id) on delete cascade,
  constraint contato_notas_conteudo_ck check (length(btrim(conteudo)) > 0)
);
create index if not exists contato_notas_contato_idx
  on plataforma.contato_notas (workspace_id, contato_id, criado_em desc);

-- Estrela e leitura da Conversa, por Membro (no modelo antigo: `starredBy` e leitura).
create table if not exists plataforma.conversa_marcacoes (
  workspace_id  text        not null,
  conversa_id   text        not null,
  membro_id     text        not null,
  estrela       boolean     not null default false,
  lida_ate      timestamptz,
  atualizado_em timestamptz not null default now(),
  primary key (workspace_id, conversa_id, membro_id),
  foreign key (workspace_id, conversa_id) references plataforma.conversas (workspace_id, id) on delete cascade
);

drop trigger if exists conversa_marcacoes_atualizado_em on plataforma.conversa_marcacoes;
create trigger conversa_marcacoes_atualizado_em before update on plataforma.conversa_marcacoes
  for each row execute function plataforma.crm_toque_atualizado_em();

-- (c) Lixeira e indices da Conversa -----------------------------------------
alter table plataforma.conversas add column if not exists na_lixeira_em timestamptz;

-- Backfill ANTES do check: a Conversa que ja esta na lixeira ganha a data do ultimo toque.
update plataforma.conversas
   set na_lixeira_em = atualizado_em
 where estado = 'na_lixeira' and na_lixeira_em is null;

alter table plataforma.conversas drop constraint if exists conversas_na_lixeira_em_ck;
alter table plataforma.conversas add constraint conversas_na_lixeira_em_ck
  check ((estado = 'na_lixeira') = (na_lixeira_em is not null));

create index if not exists conversas_atribuido_idx
  on plataforma.conversas (workspace_id, atribuido_id) where atribuido_id is not null;
create index if not exists conversas_fila_idx
  on plataforma.conversas (workspace_id, fila_id) where fila_id is not null;

-- (d) Livro-razao e copia de seguranca do script da Fase 15 -----------------
create table if not exists plataforma.crm_de_para (
  workspace_id   text        not null,
  colecao_antiga text        not null,
  id_antigo      text        not null,
  tabela_nova    text        not null,
  id_novo        text        not null,
  migrado_em     timestamptz not null default now(),
  primary key (workspace_id, colecao_antiga, id_antigo)
);

-- Copia so para ler de volta; `hidratar()` nao a conhece (D-03).
create table if not exists plataforma.registros_crm_antigo (
  workspace_id text             not null,
  colecao      text             not null,
  id           text             not null,
  dados        jsonb            not null,
  ordem        double precision not null default 0,
  copiado_em   timestamptz      not null default now(),
  primary key (workspace_id, colecao, id)
);

-- Decisao D-05 / F7 da 009 (nao a D-05 desta fase): sem RLS ate a Sessao 12. Se o projeto tem o event trigger `ensure_rls`
-- (rls_auto_enable), cada tabela nova de `plataforma` nasceu com RLS ligada e sem
-- policy. Bloco copiado da 009: desliga em toda tabela que a tenha ligada.
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
