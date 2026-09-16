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
| `persistencia.test.ts`, `colunas-geradas.test.ts` | Testes de integração contra Postgres real; pulam sem `DATABASE_URL` (`temBanco ? describe : describe.skip`, D-DEC-09). |

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
