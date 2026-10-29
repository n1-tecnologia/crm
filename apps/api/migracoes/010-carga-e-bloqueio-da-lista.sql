-- A Carga sai das Visualizacoes e o bloqueio sai da Lista (Fase 10 - Clone ClickUp).
-- Fonte: TAREFAS-POR-SESSAO.md 2.5.3 e 2.6.3; decisoes D-18 e D-19 do CONTEXT da
-- Fase 10; achado F9 e Pitfalls 4, 5 e 9 da pesquisa.
--
-- SO DADOS. Nenhum DDL: nenhuma tabela, coluna, indice, funcao ou privilegio muda.
-- Idempotente: rodar de novo, depois de aplicada, nao acha linha e nao muda nada.
--
-- O que esta migracao faz, num unico comando (as tres atualizacoes enxergam o
-- mesmo retrato do banco):
--   (a) as Visualizacoes gravadas com `kind` carga passam a `lista`
--       (so a colecao `views`, so quando o `kind` e carga - 2.5.3);
--   (b) as Listas perdem a chave `blocks` (so a colecao `lists` - 2.6.3): a Lista
--       nao tem descendente que configure, entao bloquear nela nunca teve efeito;
--       Espaco e Pasta mantem o `blocks`;
--   (c) sobe `plataforma.workspaces.revisao` SO dos Espacos de Trabalho que tiveram
--       linha alterada em (a) ou (b), para o cliente aberto reidratar na proxima
--       verificacao de revisao em vez de esperar a proxima gravacao (A6).
-- Depois, a POS-CONDICAO: se sobrar uma Visualizacao carga ou uma Lista com
-- `blocks`, a excecao desfaz a transacao inteira.
--
-- Roda inteira dentro da transacao de `migrar()` (begin/commit/rollback por
-- arquivo): se qualquer passo falhar, nem as linhas alteradas nem o registro em
-- plataforma.migracoes ficam aplicados.
--
-- ORDEM em producao (Pitfall 4): o codigo que tolera o dado antigo (a tela que
-- nao le `blocks` de Lista; `abaDaView` total) JA esta no ar desde o merge A da
-- 10-16. Por isso este arquivo so existe depois dele: escrito antes, entraria no
-- mesmo merge do codigo e o deploy a aplicaria junto.
--
-- `--seco` so lista nomes de arquivo (F9): as contagens de antes e depois estao
-- em 10-PROVAS.md. Migracao aplicada e imutavel: correcao e a `011`.

with carga_virou_lista as (
  update plataforma.registros
     set dados = jsonb_set(dados, '{kind}', '"lista"')
   where colecao = 'views'
     and dados->>'kind' = 'carga'
  returning workspace_id
),
lista_sem_bloqueio as (
  update plataforma.registros
     set dados = dados - 'blocks'
   where colecao = 'lists'
     and dados ? 'blocks'
  returning workspace_id
)
update plataforma.workspaces
   set revisao = revisao + 1,
       atualizado_em = now()
 where workspace_id in (
   select workspace_id from carga_virou_lista
   union
   select workspace_id from lista_sem_bloqueio
 );

-- POS-CONDICAO
do $$
begin
  if exists (select 1 from plataforma.registros where colecao = 'views' and dados->>'kind' = 'carga')
     or exists (select 1 from plataforma.registros where colecao = 'lists' and dados ? 'blocks') then
    raise exception '010: ainda ha Visualizacao carga ou Lista com blocks';
  end if;
end $$;
