---
phase: 01-o-crm-n1-ganha-persist-ncia-e-login
plan: 06
subsystem: database
tags: [postgres, generated-columns, gin-index, jsonb, migration]

# Dependency graph
requires: []
provides:
  - "Migração 002 aplicada no Supabase do projeto (epomplsskqpluxuujpxl): plataforma.registros.status_id/list_id/due_date (generated always as, stored)"
  - "6 índices: registros_tasks_list_status_idx, registros_tasks_list_due_date_idx, registros_tasks_tag_ids_idx (GIN jsonb_path_ops), registros_tasks_assignees_idx (GIN jsonb_path_ops), registros_tasks_field_values_idx (GIN jsonb_path_ops), registros_members_user_id_idx"
  - "apps/api/src/persistencia/CONTEXT.md — primeiro CONTEXT.md da pasta, documenta hidratar/gravar/UoW e a regra de migrações"
  - "apps/api/src/persistencia/colunas-geradas.test.ts — prova coluna ≡ jsonb e índice usável, contra o banco real"
affects: [01-04, 01-07, 01-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Coluna gerada escalar (generated always as (dados->>'campo') stored) para o que a tela filtra por igualdade/range; índice GIN jsonb_path_ops de expressão direto sobre dados->'campo' para arrays — nunca coluna gerada para array"
    - "Índice parcial (where colecao = 'tasks' | 'members') sobre a tabela genérica plataforma.registros — só a coleção consultada paga a manutenção do índice"
    - "analyze depois de semear() em teste de integração que verifica o plano do planejador — sem isso a tabela recém-populada tem estatística obsoleta e o plano fica instável"

key-files:
  created:
    - apps/api/migracoes/002-registros-colunas-geradas.sql
    - apps/api/src/persistencia/colunas-geradas.test.ts
    - apps/api/src/persistencia/CONTEXT.md
  modified: []

key-decisions:
  - "O teste do planejador (Task 3, caso h) verifica 'não é Seq Scan' + índice dentre os dois candidatos válidos para a consulta status_id/list_id — registros_tasks_list_status_idx e registros_tasks_list_due_date_idx compartilham o prefixo (workspace_id, list_id) e, com poucas linhas batendo, o planejador pode escolher qualquer um dos dois com custo igual; exigir o nome exato de um só seria um teste frágil, não uma prova mais forte"
  - "beforeAll roda `analyze plataforma.registros` depois de semear(): sem isso o Postgres decide o plano com estatística de uma tabela vazia (a coleta de estatística é assíncrona via autovacuum em produção, mas síncrona aqui é o que torna o teste do planejador determinístico)"
  - "Task 2 (aplicar a migração) não gerou nenhum arquivo novo para commitar — o SQL já estava commitado na Task 1 e ficou imutável a partir do momento em que rodou com sucesso (D-DEC-10); por isso não há um commit de Task 2 separado"

requirements-completed: [PERS-07]

# Metrics
duration: 22min
completed: 2026-09-16
---

# Phase 1 Plan 06: Migração 002 — colunas geradas e índices em `plataforma.registros` Summary

**Três colunas geradas (`status_id`, `list_id`, `due_date`) e seis índices parciais (`where colecao = 'tasks'`/`'members'`) sobre `plataforma.registros`, aplicados no Supabase do projeto e provados contra o banco real por 8 casos de teste de integração.**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-09-16T14:16:28Z (aprox., a partir do commit anterior)
- **Completed:** 2026-09-16T14:38:00Z (aprox.)
- **Tasks:** 3/3
- **Files modified:** 3 (todos criados; nenhum arquivo preexistente tocado)

## Accomplishments

- A Lista de Contas a pagar agora pode filtrar por Status, Lista e vencimento sem varrer `jsonb`: `status_id`/`list_id`/`due_date` são colunas de verdade, geradas a partir de `dados` a cada gravação (`generated always as ... stored`), com dois índices B-tree parciais (`where colecao = 'tasks'`).
- Tag `conta *`, Responsável (`assignees`) e Pessoa (`fieldValues` com `fd_cp_pessoa`) têm índice GIN de expressão `jsonb_path_ops` — arrays não cabem em coluna gerada escalar, então o índice indexa `dados->'campo'` direto (RESEARCH.md, Alternatives Considered).
- A resolução de sessão do hook de autenticação (Plan 01-02, `dados->>'userId'` em `members`) tem índice de expressão — antes desta migração, cada requisição varreria `plataforma.registros` inteiro para achar o Membro do `sub` do JWT.
- Migração `002` aplicada uma vez no Supabase do projeto (`epomplsskqpluxuujpxl`), registrada em `plataforma.migracoes`, e agora imutável (D-DEC-10). Rodar `npm run migrar -w @n1/api` de novo confirma "Nada a aplicar".
- 8 casos de teste de integração provam, contra o banco real: cada coluna/índice bate byte a byte com o mesmo filtro feito em JS sobre `buildSeed()`; os 6 índices existem; o planejador os escolhe (não `Seq Scan`) quando forçado a não varrer sequencialmente. `persistencia.test.ts` (4 testes, incluindo `toStrictEqual` do `DataState` inteiro) continua verde — as colunas geradas não entram em `hidratar()`/`gravar()`.
- `apps/api/src/persistencia/CONTEXT.md` nasce (pasta não tinha nenhum): documenta hidratar/gravar/UoW, a regra de migrações imutáveis, e a frase-chave "nada em `repositorio.ts` sabe delas: são para consultas de tela e para o hook de sessão".
- `npm run check` verde nos três workspaces (277 testes: 232 domínio + 33 web + 12 api) depois da mudança.

## Task Commits

Each task was committed atomically:

1. **Task 1: Escrever `002-registros-colunas-geradas.sql`** - `62d80a7` (feat)
2. **Task 2: [BLOCKING] Aplicar a migração 002 no banco de desenvolvimento** - sem commit (nenhum arquivo mudou; ver "Decisions Made")
3. **Task 3: Teste de integração — colunas refletem o `jsonb`, índices existem e são usáveis** - `0c1a26b` (test)

**Plan metadata:** pending (this commit)

## Files Created/Modified

- `apps/api/migracoes/002-registros-colunas-geradas.sql` - 3 colunas geradas, 6 índices parciais (2 B-tree escalares, 3 GIN de expressão `jsonb_path_ops`, 1 de expressão para `members`), sem `CONCURRENTLY` (proibido dentro da transação de `migrar.ts`)
- `apps/api/src/persistencia/colunas-geradas.test.ts` - 8 casos: status_id+list_id, due_date (ordem e valor), Tag, Responsável, Pessoa, userId, existência dos 6 índices, planejador escolhe índice (com `analyze` prévio)
- `apps/api/src/persistencia/CONTEXT.md` - novo: tabela de arquivos da pasta, regra de migrações, o que `002` adiciona e por quê

## Decisions Made

- Migração aplicada com sucesso no primeiro `npm run migrar -w @n1/api` (1710 ms) contra o Supabase do projeto — nenhuma iteração de correção do SQL foi necessária, então o arquivo nunca precisou ser editado depois de escrito (D-DEC-10 nunca foi testado em sua cláusula de "se falhar no meio").
- O caso de teste do planejador (h) verifica, para a consulta `status_id`/`list_id`, que o plano **não** é `Seq Scan` e usa um dos dois índices que compartilham o prefixo `(workspace_id, list_id)` — em vez de exigir o nome exato de um só. Com poucas linhas batendo o predicado no seed de teste, os dois índices têm custo igual aos olhos do planejador; exigir um nome específico tornaria o teste dependente de uma escolha arbitrária de tie-break do Postgres, não de uma propriedade real do schema. Uma segunda consulta, por faixa de `due_date`, prova o `registros_tasks_list_due_date_idx` isoladamente (sem ambiguidade, porque nenhum outro índice serve `between`).
- `beforeAll` roda `analyze plataforma.registros` depois de `semear()`: sem isso, o Postgres decide o plano com estatística de uma tabela vazia (a tabela acabou de ganhar ~900 linhas do seed) e escolhe planos arbitrários por não ter noção de seletividade — o teste do planejador ficava instável (dois `Index Scan` diferentes em execuções sucessivas) até este ajuste.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Assinatura da comparação do planejador rígida demais para uma escolha de tie-break legítima do Postgres**
- **Found during:** Task 3, primeira execução do teste
- **Issue:** `expect(...).toContain("registros_tasks_list_status_idx")` falhou porque o Postgres escolheu `registros_tasks_list_due_date_idx` para a mesma consulta (mesmo prefixo `(workspace_id, list_id)`, custo idêntico com poucas linhas) — não era um bug de schema, era uma asserção que assumia uma escolha determinística onde há duas igualmente válidas.
- **Fix:** Reescrita para verificar "não é `Seq Scan`" + índice dentre os dois válidos (regex), mais uma segunda consulta por `due_date between` que prova `registros_tasks_list_due_date_idx` sem ambiguidade.
- **Files modified:** `apps/api/src/persistencia/colunas-geradas.test.ts`
- **Verification:** `npm run test -w @n1/api -- src/persistencia/colunas-geradas.test.ts` verde.
- **Committed in:** `0c1a26b` (Task 3 commit — a versão final já nasceu corrigida, sem commit intermediário com o bug)

**2. [Rule 1 - Bug] Teste do índice GIN de `tagIds` instável por estatística obsoleta**
- **Found during:** Task 3, segunda execução do teste (depois do fix acima)
- **Issue:** `EXPLAIN` para a consulta com `dados->'tagIds' @> ...` escolheu um índice B-tree (Filter em vez de Index Cond) em vez do índice GIN — a tabela de teste foi semeada na mesma execução, sem `analyze`, então o planejador não tinha estatística de seletividade e decidiu por custo genérico.
- **Fix:** `analyze plataforma.registros` adicionado ao fim do `beforeAll`, depois de `semear()`.
- **Files modified:** `apps/api/src/persistencia/colunas-geradas.test.ts`
- **Verification:** `npm run test -w @n1/api -- src/persistencia/colunas-geradas.test.ts src/persistencia/persistencia.test.ts` — 12/12 verdes, reproduzido duas vezes.
- **Committed in:** `0c1a26b` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 — ambos no próprio teste novo desta plan, nenhum no SQL da migração nem no código de produção)
**Impact on plan:** Nenhum. Os dois ajustes corrigiram o teste, não a migração; `002-registros-colunas-geradas.sql` (Task 1) rodou sem alteração desde a primeira escrita.

## Issues Encountered

None além dos dois deviations acima (que já cobrem o que aconteceu durante a Task 3).

## User Setup Required

None - a migração já rodou contra o Supabase do projeto (`epomplsskqpluxuujpxl`) como parte da execução desta plan (Task 2, marcada `[BLOCKING]`). Nenhuma ação externa pendente.

## Next Phase Readiness

- PERS-07 fechado: a migração `002` está aplicada, registrada em `plataforma.migracoes`, e imutável — qualquer ajuste futuro de índice é a migração `003`.
- Plan 01-04 (rotas HTTP) e Plan 01-02 (hook de autenticação) podem contar com `registros_members_user_id_idx` já existindo quando forem escritos/testados — não precisam esperar por esta migração porque ela já está no banco.
- Plan 01-09 (o próximo que a plan explicitamente cita como dependente da migração aplicada) pode prosseguir sem bloqueio.
- Nenhum bloqueio conhecido para os planos seguintes desta fase.

---
*Phase: 01-o-crm-n1-ganha-persist-ncia-e-login*
*Completed: 2026-09-16*

## Self-Check: PASSED

All 4 created files found on disk (`002-registros-colunas-geradas.sql`, `colunas-geradas.test.ts`, `CONTEXT.md`, this summary); both task commit hashes (`62d80a7`, `0c1a26b`) found in `git log --oneline --all`.
