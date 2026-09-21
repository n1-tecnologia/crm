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
| `persistencia.test.ts`, `colunas-geradas.test.ts`, `integracao.test.ts` | Testes de integração contra Postgres real; pulam sem `DATABASE_URL` (`temBanco ? describe : describe.skip`, D-DEC-09). |

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
