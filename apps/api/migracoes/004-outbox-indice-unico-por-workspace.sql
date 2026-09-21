-- `integration_outbox_solicitacao_criada_uniq` (003) chaveava
-- `(aggregate_type, aggregate_id, event_type)` sem `workspace_id`. Isso
-- presumia `aggregate_id` globalmente único, o que não é verdade: `nextId()`
-- em `packages/dominio/src/operations/activity.ts` é um contador de módulo
-- local ao processo, e `resetIdSequence`/`syncIdSequence` o reposicionam a
-- partir do MAIOR id do estado HIDRATADO — ou seja, por Espaço de Trabalho.
-- Dois Espaços hidratados a partir do mesmo seed (que chama
-- `resetIdSequence()` a partir de zero) produzem os mesmos ids baixos para
-- Tarefas diferentes.
--
-- Consequência em produção: se dois Espaços têm uma Tarefa com o mesmo id e
-- ambos emitem `solicitacao.criada.v1`, o segundo commit colide na
-- constraint do primeiro — o evento do segundo Espaço nunca chega ao
-- `automation/`, uma perda silenciosa de evento exatamente na fronteira que
-- o outbox existe para proteger.
--
-- O invariante que o comentário de 003 descreve — "Uma Tarefa nasce uma vez
-- só" — continua verdadeiro, só que por Espaço de Trabalho, não
-- globalmente: é isso que a chave abaixo expressa. Não "simplificar" de
-- volta para a chave sem `workspace_id` — isso reabre exatamente esta perda
-- de evento entre Espaços.
drop index if exists plataforma.integration_outbox_solicitacao_criada_uniq;

create unique index if not exists integration_outbox_solicitacao_criada_uniq
  on plataforma.integration_outbox (workspace_id, aggregate_type, aggregate_id, event_type)
  where event_type = 'solicitacao.criada.v1';
