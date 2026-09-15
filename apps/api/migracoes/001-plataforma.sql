-- Schema da plataforma. Mora ao lado do `public` legado do financeiro, no
-- mesmo banco, sem encostar nele: os dois se enxergam por JOIN quando
-- precisarem, e nenhuma migration daqui toca nas 26 tabelas de lá.

create schema if not exists plataforma;

/*
 * Um registro por entidade com identidade da ontologia.
 *
 * `colecao` é o nome do array em `DataState` ("tasks", "contacts", "activity"),
 * e `dados` é o registro exatamente como o domínio o conhece. A forma genérica
 * é deliberada nesta etapa: o domínio tem 45 coleções, e tipar as 45 antes de
 * saber quais são consultadas por coluna seria decidir no escuro. As que forem
 * — Tarefa em primeiro lugar — ganham colunas geradas depois, sem migrar dado:
 *
 *   alter table plataforma.registros
 *     add column status_id text generated always as (dados->>'statusId') stored;
 *
 * `revisao` é o controle otimista: quem grava diz de qual revisão partiu, e a
 * escrita falha se alguém tiver passado na frente.
 */
create table if not exists plataforma.registros (
  workspace_id   text        not null,
  colecao        text        not null,
  id             text        not null,
  dados          jsonb       not null,
  -- A posição do registro no array do `DataState`. O Postgres devolve linhas
  -- sem ordem, e a ordem de algumas coleções carrega sentido: o Registro de
  -- Atividade é um log escrito com `unshift`, e lê-lo embaralhado muda o que a
  -- tela mostra.
  --
  -- É fracionária de propósito. Com posição inteira, inserir no início do log
  -- deslocaria todos os registros seguintes e uma única operação regravaria a
  -- coleção inteira. Com fração, o novo recebe um valor antes do primeiro e
  -- ninguém mais se move.
  ordem          double precision not null default 0,
  revisao        bigint      not null default 1,
  atualizado_em  timestamptz not null default now(),
  primary key (workspace_id, colecao, id)
);

create index if not exists registros_colecao_idx
  on plataforma.registros (workspace_id, colecao, ordem);

/*
 * O relógio de escrita do Espaço de Trabalho. Uma operação lê a revisão aqui
 * antes de hidratar e grava a mesma no fim; se divergiu, outra escrita entrou
 * no meio e esta recomeça. É mais barato que comparar revisão registro a
 * registro, e casa com a granularidade real: a operação enxerga o Espaço de
 * Trabalho inteiro, então é nele que a concorrência precisa ser resolvida.
 */
create table if not exists plataforma.workspaces (
  workspace_id   text        primary key,
  revisao        bigint      not null default 1,
  atualizado_em  timestamptz not null default now()
);
