# persistencia

Ler primeiro: [`../../CONTEXT.md`](../../CONTEXT.md) e [`../CONTEXT.md`](../CONTEXT.md)

A ponte entre o `DataState` que o domínio conhece e o Postgres da plataforma
(`plataforma.registros` + `plataforma.workspaces`, schema próprio no projeto
Supabase `epomplsskqpluxuujpxl`). Nada aqui reescreve regra de negócio — a
aposta desta pasta é que hidratar → operação pura → gravar o diff é
suficiente para o domínio nunca saber que existe um banco.

| Arquivo | O que faz |
|---|---|
| `conexao.ts` | `carregarEnv()` lê `apps/api/.env` sem `dotenv`; `pool()` é o `Pool` do `pg`, singleton lazy. |
| `repositorio.ts` | `hidratar()` (banco → `DataState`), `gravar()` (diff por comparação canônica de JSON), `reordenar()` (posição fracionária), `semear()` (escreve um `DataState` inteiro num Espaço vazio — base do bootstrap e da importação). |
| `unidade-de-trabalho.ts` | `executar()`: hidratar → operação pura → revisão otimista (3 tentativas) → `gravar()`. A rota HTTP é uma casca em volta disto. |
| `migrar.ts` + `migrar.cli.ts` | Aplica `apps/api/migracoes/NNN-*.sql` em ordem, uma vez cada, dentro de transação, registrado em `plataforma.migracoes`. |
| `persistencia.test.ts`, `colunas-geradas.test.ts`, `integracao.test.ts`, `agenda-de-automacoes.test.ts` | Testes de integração contra Postgres real; pulam sem `DATABASE_URL` (`temBanco ? describe : describe.skip`, D-DEC-09). |

## Os prazos do servidor e a trava esgotada (06-13)

`inicioDaTransacao()` abre toda Unidade de Trabalho com três prazos do lado do
servidor, derivados do `query_timeout` Q do pool (`DATABASE_QUERY_TIMEOUT_MS`,
30 s por padrão):

- `idle_in_transaction_session_timeout = Q`: a sessão cujo cliente sumiu
  depois de travar a revisão é encerrada;
- `statement_timeout = 80 % de Q`: o servidor cancela a instrução antes de o
  cliente desistir dela;
- `lock_timeout = Q / 3`: a espera pela trava da revisão do Espaço tem prazo.

Os três ficam com no mínimo 1 ms, porque `0` desliga. Com Q = 0, a transação
abre com o `begin` puro.

O motivo é o diagnóstico H4 de `06-13-SUMMARY.md`. O `query_timeout` é um
temporizador do CLIENTE: quando ele estoura, o `pg` devolve `Query read timeout`
e não cancela nada no servidor. Um `update ... revisao` órfão podia continuar
esperando a trava, e depois segurá-la, enquanto os escritores seguintes
estouravam os seus 30 s.

Em `executar()`, `55P03` (trava esgotada) no `update ... revisao` é tratado
como **conflito**, igual a uma revisão que mudou:
- desfaz a transação e tenta de novo, até `tentativas`;
- devolve `{ conflito: true }` (409 na rota, transitório na ponte);
- a conexão está sã e volta ao pool.

Qualquer outro erro, inclusive `57014` (cancelado pelo `statement_timeout`) e
um `55P03` fora da revisão, sobe como antes e descarta a conexão.

**Os prazos valem para todo chamador de `executar()` (06-19, crm2:IN-05).**
O `statement_timeout` (80 % de Q) vale também para o `gravar` em lote dos
importadores e para o `aoConfirmar` dos formulários públicos: uma instrução
entre 0,8·Q e Q, que antes de 06-13 passava, agora é cancelada com `57014`.
Por isso a importação longa (`importar-contas-a-pagar`,
`importar-contas-a-receber`, `financeiro/importar`) roda com
`DATABASE_QUERY_TIMEOUT_MS=0` na execução manual (Q = 0 abre a transação com
o `begin` puro) — nunca no processo da API, que continua com os prazos. E o
`lock_timeout` vale para QUALQUER instrução da transação, não só para o
`update … revisao`: um `55P03` fora dela (ex.: o `consumirSessao … for update`
dos formulários públicos, ou a hidratação durante uma DDL) sobe como exceção
(500), não como 409. É seguro: a Unidade de Trabalho desfaz a transação
inteira, e a submissão pública é idempotente pelo `submissionId` — o cliente
repete sem duplicar. Tratar esse `55P03` como 409 em `formularios-publicos`
fica para depois (exige o Postgres real para provar).

## A regra das migrações

Numeradas (`apps/api/migracoes/NNN-*.sql`), aplicadas uma vez por
`npm run migrar -w @n1/api`, registradas em `plataforma.migracoes`. Depois de
aplicado, um arquivo é imutável (D-DEC-10): uma correção é a migração
seguinte, nunca uma edição no arquivo já aplicado.

## Colunas geradas e índices de `002`

`002-registros-colunas-geradas.sql` estende `plataforma.registros` com três
colunas geradas (`status_id`, `list_id`, `due_date`, todas
`generated always as (dados->>'campo') stored`) e seis índices parciais
(`where colecao = 'tasks'` ou `'members'`) para o que a tela de Contas a
pagar filtra — status, Lista, vencimento, Tag `conta *`, Responsável, Pessoa —
mais a resolução de sessão por `dados->>'userId'` que o hook de autenticação
roda em toda requisição. **Nada em `repositorio.ts` sabe delas: são para
consultas de tela e para o hook de sessão**, nunca para o INSERT/UPDATE que
`gravar()` já faz sobre `dados`.

## Tabelas de transporte (Fase 2)

`003-integracao-e-importacao.sql` cria seis tabelas no schema `plataforma`:
`integration_outbox`, `http_idempotency`, `service_credentials`,
`upload_sessions`, `upload_objects` e `importacao_ledger`. `registros`
continua sendo o único armazenamento canônico das entidades da ontologia —
estas seis são transporte e auditoria (evento, replay, credencial de
serviço, sessão de upload, reconciliação de importação), não conceito de
domínio. Nenhuma delas entra em `hidratar()`/`gravar()`, nenhuma é lida pelo
`repositorio.ts`: quem grava e lê é o código de integração/importação da
Fase 2 (Planos 02-10, 02-11, 02-13, 02-25), direto contra o `pg.Client` da
sua própria transação.

Quem mexer aqui precisa manter a regra que motivou a existência dessas
tabelas separadas de `registros`: nenhuma coluna guarda CPF/CNPJ, chave
Pix, código de barras, conteúdo de anexo ou segredo em texto puro
(`integration_outbox.payload`, `importacao_ledger.motivo`,
`http_idempotency.response_body`, `service_credentials.secret_hash` são os
pontos onde isso poderia vazar — ver os comentários de cada tabela na
migração e o registro STRIDE T-02-21/T-02-12 no Plan 02-03). Os invariantes
de unicidade e lease dessas tabelas (evento único por agregado, lease
exclusiva por `for update skip locked`, idempotência HTTP, `object_key`
único, ledger idempotente por `(origem, legacy_task_id)`) estão provados
contra o Postgres real em `integracao.test.ts`, não só descritos aqui.

## Agenda do motor de Automações (Fase 3)

`005-agenda-de-automacoes.sql` cria **uma** tabela, `plataforma.automacao_agenda`
(PK `(workspace_id, list_id, dia_civil)`), para o motor de Automações
(AUTO-01). Ela é exclusão mútua e auditoria — **nunca idempotência**. A
idempotência de Automação agendada mora em `AutomationExecution` e na
checagem `jaRodou` de `runScheduledAutomations`
(`packages/dominio/src/operations/automations.ts`), que é pura e já decide
sozinha se um par (Automação, Tarefa) rodou hoje; repetir esse controle aqui
criaria uma segunda fonte de verdade a manter sincronizada com a primeira.

O que só o banco dá, e é por isso que a tabela existe: (1) duas instâncias do
`apps/api` não processam o mesmo dia, porque a reivindicação é
`for update skip locked` sobre `estado in ('pendente','falhou')` com
`locked_by`/`locked_at` — o mesmo padrão de lease de
`outbox-worker.ts::reivindicar()` — e DEC-06 serializa escrita por Espaço, de
modo que duas hidratações simultâneas do mesmo Espaço só dariam conflito de
revisão; (2) o dia processado fica observável: uma linha `falhou`, ou uma
`processando` com `locked_at` vencido, é o sinal de que o processo caiu antes
de fechar o dia, e a varredura devolve a linha para `falhou` em vez de o dia
sumir. As quatro garantias (um dia por Lista, reivindicação exclusiva,
`estado` fora do check recusado, dia retomável) estão provadas contra o
Postgres real em `agenda-de-automacoes.test.ts`.

Como as seis tabelas de `003`, esta **não entra em `hidratar()`/`gravar()`** e
`repositorio.ts` não a conhece: quem escreve nela é o scheduler-worker da
Fase 3, direto contra o `pg.Client` da sua própria transação.
`last_error_code`/`last_error_summary` só recebem a saída de
`sanitizarErro()`; nenhuma coluna guarda CPF, CNPJ, chave Pix, código de
barras, valor ou nome de fornecedor (T-3-04).

A importação histórica de Contas a pagar (Planos 03-09/03-10) **reusa**
`plataforma.importacao_ledger` de `003` com `origem = 'clickup:901107637383'` —
nenhum ledger novo nasce para este domínio, porque dois ledgers para a mesma
reconciliação seriam duas contagens a manter iguais.
