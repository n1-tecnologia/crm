---
phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup
plan: 02
subsystem: api
tags: [zod, fastify, contrato-http, idempotencia, clickup, financeiro, vitest]

# Dependency graph
requires:
  - phase: 01-o-crm-n1-ganha-persist-ncia-e-login
    provides: "apps/api/src/rotas/esquemas/fragmentos.ts (portão Igual<>/Confere<> de enum bidirecional), padrão de envelope de erro sanitizado de rotas/operacoes.ts"
provides:
  - "Documento canônico docs/08-migracao-financeiro/04-contrato-plataforma-v1.md — auth/envelope, códigos de erro, PaymentRequestDtoV1, CommentDtoV1, mapa de endpoints, idempotência, eventos de saída, versionamento"
  - "Schemas zod executáveis apps/api/src/contratos/v1.ts (PaymentRequestDtoV1, CommentDtoV1, AnexoDtoV1, StatusSolicitacaoV1, FormaDePagamentoV1, EsquemasV1, CabecalhosDeEscritaV1) e apps/api/src/contratos/erros.ts (CODIGOS_DE_ERRO, erroDoContrato)"
  - "Matriz de 79 fixtures canônicas em contratos/payment-requests-v1/ (raiz do monorepo) e apps/api/src/contratos/v1.test.ts que a prova (86 casos)"
affects: [02-09 (D-15, credencial de serviço/Agente do pipeline), 02-13 (rotas que consomem EsquemasV1), 02-26 (cópia das fixtures para financeiro-tria)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Contrato HTTP versionado como três artefatos que mudam juntos: documento canônico em docs/, schemas zod executáveis, fixtures JSON lidas de arquivo (nunca inline) por um teste que prova a matriz"
    - "Fixtures copiadas por diretório (hash agregado), não compartilhadas por pacote npm entre dois repositórios"

key-files:
  created:
    - docs/08-migracao-financeiro/04-contrato-plataforma-v1.md
    - apps/api/src/contratos/v1.ts
    - apps/api/src/contratos/erros.ts
    - apps/api/src/contratos/CONTEXT.md
    - apps/api/src/contratos/v1.test.ts
    - contratos/payment-requests-v1/README.md
    - contratos/payment-requests-v1/*.json (79 fixtures)
  modified: []

key-decisions:
  - "StatusSolicitacaoV1 e FormaDePagamentoV1 não passam pelo portão Igual<>/Confere<> de fragmentos.ts porque não existe hoje um tipo TypeScript no domínio para eles — a Lista/Campos da Solicitação ainda não são entidade do domínio nesta onda; são a fonte canônica em si, travada por D-01/D-08. CommentDtoV1.author.kind, que TEM tipo real (ActorKind), passa pelo mesmo portão."
  - "Matriz de fixtures desenhada como 9 categorias para os 3 métodos GET (sem 409/422/replay — idempotência é conceito de escrita) e 13 categorias para os 4 métodos de escrita, totalizando 79 arquivos"
  - "invalido-* e sucesso-* são validados contra o schema de RESPOSTA de cada endpoint (não contra o schema de request) — decisão de projeto do teste, coerente com o fato de todo método ter uma 'resposta' mas nem todo método ter 'body'"

patterns-established:
  - "Pasta apps/api/src/contratos/ é o contrato v1 e só isso — sem banco, sem Fastify, sem DataState mutável"
  - "erroDoContrato()/CODIGOS_DE_ERRO centraliza status HTTP + retryable por código; nunca serializar mensagem crua de exceção/ZodError no corpo da resposta"

requirements-completed: [SOL-05, SOL-06]

# Metrics
duration: 35min
completed: 2026-09-21
---

# Phase 02 Plan 02: Contrato HTTP v1 — sete métodos do adapter Summary

**Contrato HTTP v1 canônico (doc + schemas zod + 79 fixtures + teste) para os sete métodos do adapter `plataforma.ts` que substituem `clickup.ts`, congelado antes de qualquer linha do adapter (D-16, CON-13)**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-09-21T13:40:00Z (aprox.)
- **Completed:** 2026-09-21T13:49:28Z
- **Tasks:** 3
- **Files modified:** 86 (1 doc, 3 código, 79 fixtures + README + test)

## Accomplishments

- `docs/08-migracao-financeiro/04-contrato-plataforma-v1.md` — documento canônico em pt-BR com as 9 seções pedidas (escopo, auth/envelope, erros, `PaymentRequestDtoV1` com de-para completo das 25 letras da spec, `CommentDtoV1`, mapa de endpoints, idempotência, eventos de saída, versionamento/deriva); política fail-closed explícita e seção única isolando as formas do ClickUp que não cruzam a fronteira.
- `apps/api/src/contratos/v1.ts` e `erros.ts` — os DTOs e o envelope de erro como zod 4 executável, todo objeto `.strict()`, `amountCents` inteiro nunca float, `CommentDtoV1.author.kind` fechado contra `ActorKind` do domínio pelo mesmo portão `Igual<>`/`Confere<>` de `fragmentos.ts`.
- 79 fixtures canônicas em `contratos/payment-requests-v1/` (raiz do monorepo) + `apps/api/src/contratos/v1.test.ts` provando, lendo do disco, que sucesso é aceito, forma inválida é rejeitada, todo envelope de erro casa com `CODIGOS_DE_ERRO`, e a contagem por método bate com a matriz — 86 casos, todos verdes.
- `npm run check` verde nos três workspaces (dominio 253, web 53, api 203 — 46 skipped por falta de `DATABASE_URL`, esperado).

## Task Commits

Each task was committed atomically:

1. **Task 1: Documento canônico do contrato v1** - `acc7781` (docs)
2. **Task 2: Schemas zod e envelope de erro em `apps/api/src/contratos/`** - `4783c7d` (feat)
3. **Task 3: Fixtures canônicas em `contratos/payment-requests-v1/`** - `892d293` (test)

**Plan metadata:** (este commit, a seguir)

## Files Created/Modified

- `docs/08-migracao-financeiro/04-contrato-plataforma-v1.md` — contrato canônico legível, 9 seções, de-para de 21 chaves de `fields`
- `apps/api/src/contratos/v1.ts` — `PaymentRequestDtoV1`, `CommentDtoV1`, `AnexoDtoV1`, `StatusSolicitacaoV1`, `FormaDePagamentoV1`, `EsquemasV1` (request/response dos 7 métodos), `CabecalhosDeEscritaV1`
- `apps/api/src/contratos/erros.ts` — `CODIGOS_DE_ERRO`, `erroDoContrato()`, `statusHttpDoErro()`
- `apps/api/src/contratos/CONTEXT.md` — regra da pasta e nota sobre os enums sem domínio para fechar contra
- `apps/api/src/contratos/v1.test.ts` — 86 casos lendo as fixtures do disco
- `contratos/payment-requests-v1/README.md` + 79 `*.json` — matriz de fixtures (getTask, listPaymentRequestTasks, getCommentReplies: 9 cada; createComment, addTaskTag, updateTaskDueDate, updateTaskStatus: 13 cada)

## Decisions Made

- **`StatusSolicitacaoV1`/`FormaDePagamentoV1` sem portão de domínio:** a Lista "Solicitações de pagamento" ainda não é entidade do `@n1/dominio` nesta onda do plano (Status/Forma de pagamento nascerão como dado configurado — Conjunto de Status, opções de Campo — não como union TypeScript hardcoded). Diferente de `PRIORITY`/`STATUS_CATEGORY` em `fragmentos.ts`, não há hoje um tipo real para fechar `Igual<>`/`Confere<>` contra. Documentado em `apps/api/src/contratos/CONTEXT.md` para não ser lido como omissão. `CommentDtoV1.author.kind`, que TEM tipo real (`ActorKind`), passa pelo mesmo portão que `fragmentos.ts` já usa.
- **Fixtures validadas contra o schema de RESPOSTA, não de request:** `invalido-campo-obrigatorio-ausente` e `invalido-enum-desconhecido` testam a forma que o corpo de resposta (`PaymentRequestDtoV1`/`CommentDtoV1`/wrapper de lista) deve rejeitar — decisão de projeto do teste porque todo método tem `resposta` no `EsquemasV1`, mas nem todo método tem `body`/`query` (GETs não têm corpo de request).
- **Matriz assimétrica GET/escrita:** os 3 métodos de leitura não geram `erro-409`, `erro-422` nem fixtures `replay-*` — idempotência HTTP (§7 do contrato) é conceito exclusivo de escrita; a matriz reflete isso em vez de gerar arquivos vazios de categoria não aplicável.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Bug no gerador de fixtures: `erro()` espalhado no nível errado do objeto**
- **Found during:** Task 3 (primeira execução do teste `v1.test.ts`)
- **Issue:** O script gerador (temporário, fora do repositório) usava `...erro(codigo, requestId)` espalhado diretamente nas propriedades do objeto raiz do arquivo de fixture, em vez de atribuído à chave `resposta`. As 47 fixtures `erro-*`/`replay-chave-igual-payload-diferente` nasceram sem a chave `resposta`, fazendo `fixture.resposta.corpo` estourar `TypeError` no teste.
- **Fix:** Corrigido o gerador (`resposta: erro(...)` em vez de `...erro(...)`) e todas as 79 fixtures foram regeneradas do zero antes do primeiro commit — nenhuma fixture com o bug chegou a ser commitada.
- **Files modified:** nenhum arquivo do repositório continha o bug no momento do commit (o script gerador vive só no scratchpad, fora do git); as 79 `contratos/payment-requests-v1/*.json` foram geradas já corretas.
- **Verification:** `npm run test -w @n1/api -- src/contratos/v1.test.ts` — 86/86 casos verdes após a correção.
- **Committed in:** `892d293` (Task 3 commit, já com a fixture correta)

---

**Total deviations:** 1 auto-fixed (1 bug, corrigido antes de qualquer commit)
**Impact on plan:** Nenhum — o bug nunca chegou ao histórico do git; a correção só custou uma regeneração das fixtures antes do primeiro commit da Task 3.

## Issues Encountered

None além do desvio acima.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- O contrato v1 está congelado como texto, tipo e fixture — os planos 02-09 (credencial de serviço), 02-13 (rotas que consomem `EsquemasV1`) e o lado `financeiro-tria` de `adapters/plataforma.ts` podem nascer sem inferir forma.
- Plan 02-26 (cópia das fixtures para `financeiro-tria`) depende diretamente de `contratos/payment-requests-v1/` existir e ser estável — está pronto para ser copiado.
- Pendência aberta e documentada (não bloqueante): `StatusSolicitacaoV1`/`FormaDePagamentoV1` não têm ainda contraparte no domínio para o portão `Igual<>`/`Confere<>` — quando a Lista "Solicitações de pagamento" nascer como entidade do domínio (planos posteriores desta fase), vale revisitar se esses dois enums devem ganhar o mesmo fechamento bidirecional.

---
*Phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup*
*Completed: 2026-09-21*
