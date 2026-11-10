-- A Atividade do CRM novo (Fase 15 - Unificacao do CRM, plano 15-04).
-- Fonte: decisao D-15-09 do CONTEXT da Fase 15; "forma da tabela" (candidata 1) da pesquisa.
--
-- O QUE ENTRA:
--   `plataforma.crm_atividades`: o Registro de Atividade (A6.2) do CRM novo. Espelha
--   `ActivityRecord` do dominio 1:1 — ator, delegante ("em nome de"), acao, tipo/id/nome do
--   objeto, momento, resultado, antes, depois e detalhe. E a linha do tempo dos gestos que o
--   CRM novo faz (nota, mover, atribuir, lixeira, estrela, leitura, transferir Identificador,
--   consentimento, sucessao). A Auditoria e a Reuniao leem daqui.
--
-- DECISOES DE FORMA:
--   - SEM chave estrangeira para o objeto: a Atividade sobrevive a eliminacao do objeto
--     (INV-ET-12), por isso guarda `objeto_nome` e nunca aponta para a linha do objeto;
--   - `objeto_tipo` usa as cadeias que `ActivityRecord.objectType` ja usa no modelo antigo
--     (`contact`, `company`, `deal`, `conversation`, `funnel`, `channel`), para os
--     componentes de linha do tempo e o filtro da Auditoria funcionarem sem traducao.
--     Nao ha check de lista: o vocabulario vive no dominio e cresce sem migracao;
--   - SO INSERCAO, por contrato do repositorio (como `contato_notas`): a api nao tem
--     caminho de `update` nem `delete` desta tabela. Sem trigger no banco.
--
-- Nao toca `plataforma.registros` (D-03). Sem `grant`: a 009 concede DML ao `n1_api` por
-- `alter default privileges`, e `npm run banco:conceder` e a rede. Esta migracao so vai a
-- producao no corte da Fase 15, pelo dono.
--
-- Roda inteira dentro da transacao de `migrar()` (begin/commit/rollback por arquivo): se
-- qualquer passo falhar, nem a tabela nem o registro em plataforma.migracoes ficam
-- aplicados. Idempotente: `create ... if not exists`; rodar de novo nao muda nada.
-- Migracao aplicada e imutavel: ajuste e a `013`.

create table if not exists plataforma.crm_atividades (
  id             text        not null default gen_random_uuid()::text,
  workspace_id   text        not null,
  ator_tipo      text        not null,
  ator_id        text        not null,
  delegante_tipo text,
  delegante_id   text,
  acao           text        not null,
  objeto_tipo    text        not null,
  objeto_id      text        not null,
  objeto_nome    text        not null,
  em             timestamptz not null default now(),
  resultado      text        not null default 'ok',
  antes          text,
  depois         text,
  detalhe        text,
  primary key (workspace_id, id),
  constraint crm_atividades_ator_ck check (ator_tipo in ('member', 'agent', 'automation', 'integration', 'system')),
  -- Delegante: o tipo e o id andam juntos, e o tipo e um dos cinco do ator.
  constraint crm_atividades_delegante_ck check (
    (delegante_tipo is null) = (delegante_id is null)
    and (delegante_tipo is null or delegante_tipo in ('member', 'agent', 'automation', 'integration', 'system'))
  ),
  constraint crm_atividades_resultado_ck check (resultado in ('ok', 'denied', 'failed')),
  constraint crm_atividades_acao_ck check (length(btrim(acao)) > 0)
);

-- A linha do tempo de um objeto (Contato, Conversa...) e a leitura por tempo da Auditoria.
create index if not exists crm_atividades_objeto_idx
  on plataforma.crm_atividades (workspace_id, objeto_tipo, objeto_id, em desc);
create index if not exists crm_atividades_em_idx
  on plataforma.crm_atividades (workspace_id, em desc);

-- Decisao F7 da 009: sem RLS ate a Sessao 12. Se o projeto tem o event trigger `ensure_rls`
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
