---
phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup
plan: 22
subsystem: database
tags: [importacao, dominio, postgres, pg, solicitacao-de-pagamento, sol-09, sanitizacao]

# Dependency graph
requires:
  - phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup
    provides: "Plan 02-06 (catálogo CATALOGO_SOLICITACAO_DE_PAGAMENTO, Status/Campos) e Plan 02-08 (evoluirConfiguracaoDeSolicitacoes materializando a Lista real)"
provides:
  - "importarSolicitacaoHistorica (@n1/dominio/operations/importacao): operação atômica que cria Tarefa histórica já fechada, sem disparo para o automation/, sem registro em OPERACOES"
  - "importActor(origem): Ator de importação de sistema, no estilo formActor"
  - "lerSolicitacoesLegadas (apps/api): leitor somente-leitura paginado de public.solicitacoes_pagamentos, allowlist literal de colunas"
  - "classificarLinha (apps/api): classificação válida/rejeitada/ambígua por D-24/D-25, sem reconstrução de dado"
  - "resolverAutoriaLegada (apps/api/de-para.ts): de-para de autoria só por memberIdConhecido, nunca convida Membro"
  - "fixture sanitizada solicitacoes-sanitizadas.json: 32 linhas fictícias, matriz hostil completa (fecha a lacuna de Wave 0 de V02-09B)"
affects: [02-25]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Operação de domínio fora de OPERACOES para caminhos não-Membro (mesmo padrão de submitForm): actingMemberId empresta permissão, o Ator de negócio é resolvido à parte"
    - "Rollback atômico por snapshot de contagens + splice, reaplicado de submitForm/scale.ts"
    - "Substituição de entrada em state.tasks (spread) para honrar createdAt readonly do tipo Task sem contornar o tipo"
    - "Allowlist literal de colunas (não denylist) para leitura de banco legado, com barreira dupla de somente-leitura (papel do Postgres + SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY)"

key-files:
  created:
    - packages/dominio/src/operations/importacao.ts
    - packages/dominio/src/operations/importacao.test.ts
    - apps/api/src/importacao/financeiro/solicitacoes.ts
    - apps/api/src/importacao/financeiro/de-para.ts
    - apps/api/src/importacao/financeiro/CONTEXT.md
    - apps/api/src/importacao/financeiro/solicitacoes.test.ts
    - apps/api/src/importacao/financeiro/fixtures/solicitacoes-sanitizadas.json
  modified:
    - packages/dominio/src/operations/index.ts

key-decisions:
  - "provenance.kind usa o literal 'import' (inglês, já existente em types/primitives.ts), não 'importacao' como o texto do plano sugeria em prosa — types/primitives.ts está fora do território deste plano e o literal em inglês já é consistente com os demais kinds do mesmo tipo (template, recurrence, form, deal…)."
  - "O cabeçalho de packages/dominio/src/operations/registro.ts NÃO foi atualizado com a justificativa de exclusão de importarSolicitacaoHistorica de OPERACOES, apesar do texto do plano pedir isso — registro.ts não está em files_modified nem no território declarado deste agente (só packages/dominio/src/operations/importacao.ts, importacao.test.ts e index.ts). O comportamento (não estar em OPERACOES) está correto e provado por teste; só a atualização de comentário em arquivo de fora do território ficou pendente."
  - "resumo vira Comentário por escrita direta em task.comments (não via addTaskComment): addTaskComment recusa um Ator 'member' diferente de actingMemberId ('Um Membro não comenta em nome de outro Membro') — regra desenhada para uso ao vivo, incompatível com reconstruir autoria histórica de um Membro que não é quem roda a importação."
  - "COLUNAS de apps/api/src/importacao/financeiro/solicitacoes.ts inclui valor, documento e created_at como HIPÓTESE não confirmada: as duas migrações do financeiro-tria citadas no plano (20260511130000_rls_solicitacoes_pagamentos.sql, 20260526130000_add_empresa_solicitacoes.sql) não puderam ser lidas neste ambiente — o repositório financeiro-tria não está clonado ao lado deste worktree e não há DATABASE_URL/credencial de leitura no .env. Documentado em CONTEXT.md; quem rodar o --apply do Plan 02-25 confirma os três nomes contra o schema real antes da primeira execução."

patterns-established:
  - "Pattern: operação de importação histórica não registrada em OPERACOES, exportada crua (export * em operations/index.ts) para o CLI do apps/api consumir diretamente."
  - "Pattern: allowlist literal (COLUNAS) como único ponto de contato com um schema externo/legado, nunca select *, com hipóteses não confirmadas marcadas explicitamente em comentário e CONTEXT.md."

requirements-completed: []

# Metrics
duration: 28min
completed: 2026-09-21
---

# Phase 02 Plan 22: Leitura, classificação e operação de domínio da importação histórica (SOL-09) Summary

**`importarSolicitacaoHistorica` (domínio) + leitura somente-leitura/classificação da tabela legada (apps/api) + fixture hostil de 32 linhas — a metade "ler e entender" de SOL-09, sem gravar nada em produção.**

## Performance

- **Duration:** ~28 min (primeiro commit de tarefa 15:20:03, último 15:28:44, mais leitura/checagens antes e depois)
- **Started:** 2026-09-21T15:04:58-03:00 (base do worktree)
- **Completed:** 2026-09-21T15:28:44-03:00
- **Tasks:** 3/3
- **Files modified:** 8 (7 criados, 1 modificado)

## Accomplishments
- `importarSolicitacaoHistorica` (`packages/dominio/src/operations/importacao.ts`): cria uma Tarefa histórica JÁ FECHADA em "aprovado"/"não aprovado" na Lista "Solicitações de pagamento", compondo `createTask` + `setTaskFieldValue` + `changeTaskStatus` — nunca gravando `state.tasks` por fora dessas funções. Ator resolvido (Membro conhecido ou `importActor` de sistema), lacunas viram Registro de Atividade, `resumo` vira Comentário do RESUMO preservado byte a byte, rollback atômico em caso de Campo recusado, sem nenhum parâmetro ou menção a disparo de saída para o `automation/`, e sem entrar em `OPERACOES`.
- Leitura somente-leitura de `public.solicitacoes_pagamentos` (`lerSolicitacoesLegadas`): allowlist literal de colunas (`COLUNAS`), segunda barreira `SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY`, paginação por `id` crescente.
- `classificarLinha`: classifica cada linha em válida/rejeitada/ambígua exatamente pelas regras de D-24/D-25 — nunca reconstrói data, autoria ou valor; Centro de Custo (o único Campo obrigatório da Lista) ausente ou fora do catálogo rejeita a linha antes de chegar no `--apply`, para não falhar lá.
- `resolverAutoriaLegada`: de-para de autoria reaproveitando `DE_PARA_USUARIOS` (Plan 00-02) — só conta como demonstrável quando já existe `memberIdConhecido`; o revisor FO (`81581802`, `fonteDoEmail: "nao-resolvido"`) e qualquer id sem Membro já existente devolvem "autoria não demonstrável", nunca convite nem e-mail inventado.
- Fixture sanitizada de 32 linhas fictícias (`fixtures/solicitacoes-sanitizadas.json`) cobrindo toda a matriz hostil exigida por V02-09B — fecha essa lacuna de Wave 0.
- `npm run check` verde nos três workspaces (typecheck, lint, tokens, testes), sem `DATABASE_URL`.

## Task Commits

Each task was committed atomically:

1. **Task 1: `importarSolicitacaoHistorica` — a operação de domínio** - `c8b26d5` (feat)
2. **Task 2: Leitura sanitizada da tabela legada e classificação** - `ce8e4d5` (feat)
3. **Task 3: Fixture sanitizada e testes da classificação** - `da8b400` (test)

**Plan metadata:** commit ainda não criado — este SUMMARY.md é o que falta antes dele.

## Files Created/Modified
- `packages/dominio/src/operations/importacao.ts` - `importarSolicitacaoHistorica` + `importActor`, rollback atômico, sem evento
- `packages/dominio/src/operations/importacao.test.ts` - os 7 casos (a)-(g) do plano
- `packages/dominio/src/operations/index.ts` - `export * from "./importacao"` (cru, fora de `OPERACOES`)
- `apps/api/src/importacao/financeiro/solicitacoes.ts` - `lerSolicitacoesLegadas` + `classificarLinha` + `COLUNAS`/`SOMENTE_LEITURA`
- `apps/api/src/importacao/financeiro/de-para.ts` - `resolverAutoriaLegada`
- `apps/api/src/importacao/financeiro/CONTEXT.md` - fonte (D-24), allowlist, hipótese não confirmada, proibição de abrir o banco legado fora do CLI, lacuna-em-vez-de-invenção
- `apps/api/src/importacao/financeiro/solicitacoes.test.ts` - os 10 casos (a)-(j) do plano
- `apps/api/src/importacao/financeiro/fixtures/solicitacoes-sanitizadas.json` - 32 linhas fictícias, matriz hostil completa

## Decisions Made
- `provenance.kind` usa `"import"` (literal já existente em `types/primitives.ts`), não `"importacao"` — ver `key-decisions` no frontmatter para o raciocínio completo.
- Comentário do RESUMO escrito direto em `task.comments` (não via `addTaskComment`) — ver `key-decisions`.
- `COLUNAS` inclui `valor`/`documento`/`created_at` como hipótese não confirmada contra o schema real do `financeiro-tria` — ver `key-decisions` e `CONTEXT.md`.
- Cabeçalho de `registro.ts` não atualizado (fora do território declarado deste agente) — ver `key-decisions`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `provenance.kind` usa o literal existente `"import"`, não `"importacao"`**
- **Found during:** Task 1
- **Issue:** O texto do plano usa `provenance.kind === "importacao"` em prosa, mas `Provenance.kind` (`packages/dominio/src/types/primitives.ts`) só aceita o literal em inglês `"import"` — usar `"importacao"` não compilaria (união literal fechada) e `types/primitives.ts` está fora do território deste plano (não está em `files_modified`).
- **Fix:** Usado `kind: "import"`, consistente com os demais valores em inglês do mesmo tipo (`"template"`, `"recurrence"`, `"form"`, `"deal"`…). Documentado no cabeçalho de `importacao.ts` e neste SUMMARY.
- **Files modified:** `packages/dominio/src/operations/importacao.ts`, `packages/dominio/src/operations/importacao.test.ts`
- **Verification:** `npm run typecheck -w @n1/dominio` e `npm run test -w @n1/dominio -- src/operations/importacao.test.ts` (caso a) passam.
- **Committed in:** `c8b26d5`

**2. [Rule 2 - Missing Critical] Centro de Custo ausente/fora do catálogo rejeita a linha em `classificarLinha`, antes do `--apply`**
- **Found during:** Task 2
- **Issue:** O texto do plano para `classificarLinha` não menciona explicitamente a obrigatoriedade de Centro de Custo (RN-SP-01, único Campo obrigatório da Lista). Sem essa checagem, uma linha sem Centro de Custo válido seria classificada "válida", e só falharia (com rollback) quando `importarSolicitacaoHistorica` chamasse `setTaskFieldValue` no `--apply` do Plan 02-25 — tarde demais para o relatório de classificação servir de guia confiável.
- **Fix:** `classificarLinha` rejeita com `centro_custo_ausente`/`centro_custo_invalido` antes de chegar em `entrada`.
- **Files modified:** `apps/api/src/importacao/financeiro/solicitacoes.ts`, `apps/api/src/importacao/financeiro/solicitacoes.test.ts` (casos extras de cobertura, linhas 24/25 da fixture)
- **Verification:** `npm run test -w @n1/api -- src/importacao/financeiro/solicitacoes.test.ts` passa; caso (i) confirma que nenhum valor do campo problemático vaza.
- **Committed in:** `ce8e4d5`

**3. [Rule 3 - Blocking] Cabeçalho de `registro.ts` não atualizado — território do plano restringe o agente**
- **Found during:** Task 1
- **Issue:** O texto do plano pede para "acrescentar a justificativa no cabeçalho de `registro.ts`, do mesmo jeito que `submitForm` já está justificado lá". `registro.ts` não está em `files_modified` deste plano nem no território declarado ao agente (`packages/dominio/src/operations/importacao.ts`, `importacao.test.ts`, `operations/index.ts`).
- **Fix:** Não modificado. O comportamento correto (não registrar em `OPERACOES`) está implementado e provado por teste (a operação não está em `OPERACOES`; `index.ts` a exporta crua via `export *`). Só a atualização de comentário documental em arquivo fora do território ficou pendente — sinalizado aqui para quem fizer o próximo plano de dominio tocar `registro.ts`.
- **Files modified:** nenhum (decisão de não modificar)
- **Verification:** `grep` confirma que `importarSolicitacaoHistorica` não aparece em `OPERACOES` (`packages/dominio/src/operations/registro.ts`).
- **Committed in:** N/A (não é uma mudança de código)

---

**Total deviations:** 3 (1 bug de tipo, 1 funcionalidade crítica ausente, 1 item de documentação fora do território)
**Impact on plan:** Todos necessários para correção/segurança ou para respeitar a fronteira de arquivos declarada ao agente paralelo. Sem scope creep: nenhuma mudança fora dos arquivos listados em `files_modified` do plano.

## Issues Encountered
- `../financeiro-tria` (o repositório com as migrações reais de `public.solicitacoes_pagamentos`) não está clonado ao lado deste worktree, e não há `DATABASE_URL`/credencial de leitura no `.env` deste ambiente — impossível confirmar o schema real da tabela legada. A allowlist `COLUNAS` foi construída a partir da lista documentada em `docs/08-migracao-financeiro/01-inventario-financeiro-tria.md` (12 das 15 colunas reais, excluindo `app_key`/`app_secret`/`banco_de_categorias`); `valor`, `documento` e `created_at` são hipóteses não confirmadas, claramente marcadas em `CONTEXT.md` e no código — quem rodar o `--apply` do Plan 02-25 precisa confirmar os três nomes contra o schema real antes da primeira execução com dado de produção.

## User Setup Required

None - no external service configuration required. O `--apply` do Plan 02-25 vai precisar de uma credencial de leitura para o Supabase do `financeiro-tria` (fora do escopo deste plano).

## Next Phase Readiness
- `packages/dominio/src/operations/importacao.ts` e `apps/api/src/importacao/financeiro/` estão prontos para o Plan 02-25 (`--apply`, anexos, manifesto, `importacao_ledger`).
- Pendências explícitas para o Plan 02-25: confirmar `valor`/`documento`/`created_at` contra o schema real; decidir o tratamento de `comentario_aprovacao` (hoje fora do escopo da leitura); atualizar o cabeçalho de `packages/dominio/src/operations/registro.ts` com a justificativa de exclusão de `importarSolicitacaoHistorica` de `OPERACOES`, se esse plano tocar `registro.ts` de qualquer forma.
- `npm run check` verde nos três workspaces confirma que nada foi quebrado para os planos irmãos (02-13, 02-15, 02-19) que rodam em paralelo.

---
*Phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup*
*Completed: 2026-09-21*

## Self-Check: PASSED

Todos os 8 arquivos declarados em `files_modified` mais este SUMMARY.md foram
confirmados no disco; os 3 hashes de commit de task (`c8b26d5`, `ce8e4d5`,
`da8b400`) foram confirmados em `git log --oneline`. Nada faltando.
