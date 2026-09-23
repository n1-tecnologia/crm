-- Estado do motor de Automações (Fase 3, AUTO-01). Uma única tabela: a
-- agenda por (Espaço de Trabalho, Lista, dia civil) que o scheduler-worker
-- de `apps/api` vai reivindicar. `plataforma.registros` continua sendo o
-- único armazenamento canônico das entidades da ontologia — esta tabela não
-- é uma entidade, é transporte e auditoria, no mesmo espírito das seis
-- tabelas de `003-integracao-e-importacao.sql`. Não entra em
-- `hidratar()`/`gravar()`.

/*
 * `plataforma.automacao_agenda` NÃO é fonte de idempotência. A idempotência
 * de Automação agendada mora em `AutomationExecution` e na checagem
 * `jaRodou` de `runScheduledAutomations`
 * (`packages/dominio/src/operations/automations.ts`) — essa função já
 * decide sozinha, de forma pura, se um par (Automação, Tarefa) já rodou
 * hoje. Duplicar esse controle aqui criaria uma segunda fonte de verdade a
 * manter sincronizada com a primeira; esta tabela nunca pergunta "isto já
 * rodou", só "alguém já está processando este dia".
 *
 * Ela existe, primeiro, para exclusão mútua entre instâncias do processo
 * `apps/api`: DEC-06 serializa escrita por Espaço de Trabalho, então duas
 * hidratações simultâneas do mesmo Espaço só produziriam conflito de
 * revisão, nunca um resultado correto. A reivindicação usa
 * `for update skip locked` sobre `estado in ('pendente', 'falhou')`, com
 * `locked_by`/`locked_at` marcando quem está com a linha — o mesmo padrão
 * de lease que `outbox-worker.ts::reivindicar()` já usa para
 * `integration_outbox`.
 *
 * Ela existe, segundo, para tornar observável que o dia foi processado. Uma
 * linha `falhou` ou uma linha `processando` com `locked_at` antigo é o
 * sinal de que o processo caiu antes de fechar o dia — e é assim que o
 * critério 3 do ROADMAP ("a agenda não é pulada quando o processo cai no
 * minuto errado") deixa de depender de fé: o dia continua na tabela,
 * reivindicável, até um `estado` terminal (`concluido`) ser escrito.
 */
create table if not exists plataforma.automacao_agenda (
  workspace_id       text not null,
  list_id            text not null,
  dia_civil          date not null,
  estado             text not null default 'pendente'
                        check (estado in ('pendente','processando','concluido','falhou')),
  tentativas         int not null default 0,
  locked_at          timestamptz,
  locked_by          text,
  last_error_code    text,
  last_error_summary text,
  executadas         int,
  falhadas           int,
  puladas            int,
  criado_em          timestamptz not null default now(),
  concluido_em       timestamptz,
  primary key (workspace_id, list_id, dia_civil)
);

-- `last_error_code`/`last_error_summary` só recebem a saída de
-- `sanitizarErro()` (`apps/api/src/persistencia/outbox-worker.ts`) — nunca o
-- erro bruto. Nenhuma coluna desta tabela guarda CPF, CNPJ, chave Pix,
-- código de barras, valor ou nome de fornecedor (T-3-04): a Tarefa que a
-- Automação processou é identificada só por `list_id`/`dia_civil`, nunca
-- por um dado da própria Conta a pagar.
comment on column plataforma.automacao_agenda.last_error_code is
  'Só recebe sanitizarErro().code (outbox-worker.ts) — nunca o erro bruto.';
comment on column plataforma.automacao_agenda.last_error_summary is
  'Só recebe sanitizarErro().summary (outbox-worker.ts). Nunca CPF, CNPJ, chave Pix, código de barras, valor ou nome de fornecedor (T-3-04).';

create index if not exists automacao_agenda_pendente
  on plataforma.automacao_agenda (criado_em, workspace_id, list_id)
  where estado in ('pendente','falhou');
  -- Uso: o scheduler-worker reivindica a próxima linha pendente/retomável
  -- com `for update skip locked`, sem duas instâncias pegarem o mesmo dia.

-- Nenhuma tabela de ledger nova nasce aqui. A importação histórica de
-- Contas a pagar (Plans 03-09/03-10) reusa `plataforma.importacao_ledger`
-- (criada em `003-integracao-e-importacao.sql`, PK `(origem, legacy_task_id)`)
-- com `origem = 'clickup:901107637383'` — quem for importar não cria um
-- segundo ledger para este domínio.
