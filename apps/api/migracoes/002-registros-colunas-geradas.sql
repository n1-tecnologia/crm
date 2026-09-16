-- Colunas geradas e índices sobre `plataforma.registros` para o que a tela de
-- Contas a pagar filtra: Tarefa primeiro (D-DEC-02), como `001-plataforma.sql`
-- já anunciava no comentário da tabela. Nada em `repositorio.ts` sabe destas
-- colunas: `hidratar()` lê `dados`, `gravar()` grava `dados` — o INSERT nunca
-- as menciona. Elas existem só para o `where` de uma consulta de tela e para o
-- hook de autenticação (Plan 01-02) resolver a sessão sem varrer o `jsonb`.
--
-- Nenhum índice abaixo usa o modificador que constrói em segundo plano sem
-- bloquear escritas: o Postgres recusa esse modificador dentro de uma
-- transação, e `migrar.ts` aplica cada arquivo dentro de `begin`/`commit`. A
-- tabela é pequena (~900 linhas por Espaço de Trabalho), então o lock de
-- escrita que um `create index` comum toma dura milissegundos — não há Espaço
-- de Trabalho grande o bastante ainda para essa troca valer a pena.

/*
 * Escalares: coluna gerada + índice B-tree parcial.
 *
 * Uma coluna gerada copia o valor do `jsonb` para uma coluna de verdade a
 * cada gravação — não referencia outra coluna gerada, só a própria linha
 * (postgresql.org/docs/current/ddl-generated-columns.html).
 * Parcial (`where colecao = 'tasks'`) porque só a coleção `tasks` é
 * consultada por estas colunas: as outras 44 coleções não pagam a
 * manutenção de um índice que nunca usam.
 */
alter table plataforma.registros
  add column status_id text generated always as (dados->>'statusId') stored;

alter table plataforma.registros
  add column list_id text generated always as (dados->>'listId') stored;

alter table plataforma.registros
  add column due_date text generated always as (dados->'dueDate'->>'value') stored;
  -- `TaskDate` é `{ form, value }` (packages/dominio/src/types): `value` é
  -- `YYYY-MM-DD` quando `form = "civilDay"`, ou um instante ISO quando
  -- `form = "instant"`. Os dois comparam e ordenam corretamente como texto em
  -- ISO 8601 (Assumption A2, 01-RESEARCH.md) — por isso a coluna é `text`, não
  -- `date`. Tipar como `date` exigiria tratar `instant` à parte, e esta
  -- migração não confirma que só `civilDay` aparece em `dueDate` de Conta
  -- (CAND-02 sugere que sim, mas não fecha a questão).

create index if not exists registros_tasks_list_status_idx
  on plataforma.registros (workspace_id, list_id, status_id)
  where colecao = 'tasks';
  -- Uso: where workspace_id = $1 and colecao = 'tasks' and list_id = $2 and status_id = $3
  -- (a Lista de Contas a pagar filtrada por Status.)

create index if not exists registros_tasks_list_due_date_idx
  on plataforma.registros (workspace_id, list_id, due_date)
  where colecao = 'tasks';
  -- Uso: ... and list_id = $2 and due_date between $3 and $4
  -- (a Lista de Contas a pagar filtrada por faixa de vencimento.)

/*
 * Arrays: índice GIN de expressão, sem coluna gerada.
 *
 * `tagIds`, `assignees` e `fieldValues` são arrays no domínio — não cabem numa
 * coluna gerada escalar (uma coluna gerada não "achata" um array), então o
 * índice indexa a expressão `jsonb` diretamente. `jsonb_path_ops` (e não o
 * `jsonb_ops` default) porque o único operador usado aqui é `@>` (contenção):
 * `jsonb_path_ops` é 20–30% do tamanho de `jsonb_ops` e mais rápido para `@>`;
 * só perde o operador `?` (existência de chave), que nenhuma destas consultas
 * usa (pganalyze.com/blog/gin-index).
 */
create index if not exists registros_tasks_tag_ids_idx
  on plataforma.registros using gin ((dados->'tagIds') jsonb_path_ops)
  where colecao = 'tasks';
  -- Uso: ... and dados->'tagIds' @> '["tag_cp_1"]'::jsonb
  -- (filtro por Tag `conta *`.)

create index if not exists registros_tasks_assignees_idx
  on plataforma.registros using gin ((dados->'assignees') jsonb_path_ops)
  where colecao = 'tasks';
  -- Uso: ... and dados->'assignees' @> '[{"id":"mem_x"}]'::jsonb
  -- (filtro por Responsável.)

create index if not exists registros_tasks_field_values_idx
  on plataforma.registros using gin ((dados->'fieldValues') jsonb_path_ops)
  where colecao = 'tasks';
  -- Uso (Pessoa, fd_cp_pessoa): ... and dados->'fieldValues' @>
  --   '[{"definitionId":"fd_cp_pessoa","value":"mem_x"}]'::jsonb

/*
 * Sessão: índice de expressão sobre `members`.
 *
 * `Member.userId` é o UUID do Supabase Auth (`usuarios-do-seed.ts`); o hook
 * de autenticação (Plan 01-02) resolve o Membro a partir do `sub` do JWT em
 * toda requisição — sem índice, isso varreria `dados` por igualdade de texto
 * a cada chamada.
 */
create index if not exists registros_members_user_id_idx
  on plataforma.registros (workspace_id, (dados->>'userId'))
  where colecao = 'members';
  -- Uso: where workspace_id = $1 and colecao = 'members' and dados->>'userId' = $2
