---
phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup
plan: 04
subsystem: domain
tags: [zod, dominio, approval-workflow, discriminated-union, fastify]

# Dependency graph
requires:
  - phase: 01-o-crm-n1-ganha-persist-ncia-e-login
    provides: "POST /operacoes/:nome, o registro OPERACOES/ESQUEMAS e o portão satisfies EsquemasCompletos que toda operação nova precisa atravessar"
provides:
  - "ApprovalOrigin (união discriminada agentExecution | processTask) em packages/dominio/src/types/ai.ts"
  - "decideApproval reescrito sobre origin, com regressão provada do fluxo de Agente (prazo, expiração, cancelamento)"
  - "solicitarAprovacao e decideProcessApproval — a fundação de domínio para SOL-03, sem AgentExecution"
  - "normalizeApprovalOrigin — traduz registros antigos (executionId solto) na primeira leitura de state.approvals"
  - "schemas .strict() das duas operações novas em apps/api/src/rotas/esquemas/ia.ts"
affects: [02-06, 02-10, 02-24]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "União discriminada por kind para origem de entidade (ApprovalOrigin), mesmo padrão de ExecutionStep.kind"
    - "Normalização lazy de registros legados na primeira leitura da coleção, não na hidratação genérica"
    - "Decisão canônica compartilhada por clique e comentário (decideProcessApproval com options.source)"

key-files:
  created:
    - packages/dominio/src/operations/aprovacao-de-processo.test.ts
  modified:
    - packages/dominio/src/types/ai.ts
    - packages/dominio/src/operations/ai.ts
    - packages/dominio/src/operations/registro.ts
    - packages/dominio/src/operations/index.ts
    - apps/api/src/rotas/esquemas/ia.ts
    - packages/dominio/CONTEXT.md
    - packages/dominio/src/seed.ts
    - packages/dominio/src/seed-produto.ts
    - apps/web/src/app/(shell)/ia/aprovacoes/page.tsx
    - "apps/web/src/app/(shell)/ia/execucoes/[execucao]/page.tsx"
    - apps/web/src/app/(shell)/notificacoes/page.tsx

key-decisions:
  - "ApprovalOrigin discrimina agentExecution (com deadline) de processTask (sem deadline) — o tipo impede estado inválido em vez de checagem defensiva em runtime (D-06, D-11)"
  - "normalizeApprovalOrigin roda na primeira leitura de state.approvals dentro de cada operação (ensureApprovalsNormalized), não na hidratação genérica de apps/api/src/persistencia/repositorio.ts, que é um JSON.parse por coleção sem conhecimento de domínio"
  - "decideApproval e decideProcessApproval compartilham a resolução de autorização (mayDecideApproval) — o aprovador designado ou administrador/proprietário"

requirements-completed: [SOL-03]

# Metrics
duration: 45min
completed: 2026-09-21
---

# Phase 02 Plan 04: ApprovalOrigin discriminada + fundação da aprovação de processo Summary

**`ApprovalRequest.origin` vira união discriminada (`agentExecution` | `processTask`); `solicitarAprovacao`/`decideProcessApproval` nascem no domínio e no registro HTTP, sem tocar `AgentExecution`.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 3
- **Files modified:** 16 (1 criado, 15 modificados)

## Accomplishments

- `ApprovalRequest.origin: ApprovalOrigin` substitui `executionId`/`stepIndex`/`deadline` soltos; o ramo `processTask` não tem `deadline` — nenhum código consegue ler prazo de uma aprovação de processo porque o campo não existe.
- `decideApproval` reescrito para ler `origin` com guarda de `kind`, recusando uma aprovação `processTask`; o comportamento do fluxo de Agente (autorização, expiração, cancelamento da Execução, Registro de Atividade) é idêntico ao anterior — provado por regressão explícita.
- `solicitarAprovacao` (cria a `ApprovalRequest` `processTask`, move a Tarefa para `em aprovação`, idempotente por Tarefa) e `decideProcessApproval` (a decisão canônica que clique e comentário compartilham: publica `✅ Aprovado por <nome>` / `❌ Reprovado por <nome>` como resposta ao tópico, registra Atividade com a fonte, muda o Status) nascem em `packages/dominio/src/operations/ai.ts`, registradas em `OPERACOES`/`ESQUEMAS`.
- 13 casos novos de teste (V02-03A regressão + V02-03B matriz autorizado/replay/conflito/idempotência) em `aprovacao-de-processo.test.ts`.
- `npm run check` verde nos três workspaces (dominio 266, web 53, api 117 + 46 skipped sem `DATABASE_URL`).

## Task Commits

1. **Task 1: `ApprovalOrigin` como união discriminada** (inclui o corpo das duas operações do Task 2, que vivem no mesmo arquivo) — `fd94d88` (feat)
2. **Task 2: registro em `OPERACOES` e nos schemas HTTP** — `b0ec637` (feat)
3. **Task 3: matriz de testes + `CONTEXT.md`** — `08eedf2` (test)

_Nota de agrupamento: `solicitarAprovacao`/`decideProcessApproval` foram escritas em `packages/dominio/src/operations/ai.ts` na Task 1 porque reúsam `mayDecideApproval`/`ensureApprovalsNormalized`/`resolveProcessStatusId` — as mesmas funções que a correção de `decideApproval` precisava. Separar por hunk teria exigido edição manual de patch sem ganho de rastreabilidade; a Task 2 ficou com a parte que é genuinamente independente: a entrada em `OPERACOES`/`ESQUEMAS` que torna as operações alcançáveis por `POST /operacoes/:nome`. Cada um dos três commits deixa `npm run check` verde por si (verificado)._

## Files Created/Modified

- `packages/dominio/src/types/ai.ts` — `ApprovalOrigin`, `ApprovalRequest.origin`, `decisionSource`/`decisionReason`, `reason: "processo"`
- `packages/dominio/src/operations/ai.ts` — `normalizeApprovalOrigin`, `ensureApprovalsNormalized`, `mayDecideApproval`, `resolveProcessStatusId`, `decideApproval` (reescrito), `solicitarAprovacao`, `decideProcessApproval`
- `packages/dominio/src/operations/registro.ts`, `packages/dominio/src/operations/index.ts` — entrada em `OPERACOES` e barril instrumentado
- `apps/api/src/rotas/esquemas/ia.ts` — schemas `.strict()` de `solicitarAprovacao`/`decideProcessApproval`
- `packages/dominio/src/operations/aprovacao-de-processo.test.ts` (novo) — os 13 casos (a)-(m)
- `packages/dominio/CONTEXT.md` — seção "Aprovação: duas origens, uma decisão por origem"
- `packages/dominio/src/seed.ts`, `packages/dominio/src/seed-produto.ts` — fixture/poda ajustadas ao novo formato de `origin`
- `apps/web/src/app/(shell)/ia/aprovacoes/page.tsx`, `.../ia/execucoes/[execucao]/page.tsx`, `.../notificacoes/page.tsx` — leitura de `deadline`/`executionId` passa por `origin.kind === "agentExecution"`
- `apps/api/src/rotas/esquemas-de-argumentos.test.ts`, `apps/api/src/rotas/esquemas/ia.test.ts` — contagem de operações 132 → 134, formas novas cobertas

## Decisions Made

- **`normalizeApprovalOrigin` roda na primeira leitura, não na hidratação.** `apps/api/src/persistencia/repositorio.ts::hidratar` é um `JSON.parse` genérico por coleção, sem conhecimento de domínio — confirmado por leitura do arquivo antes de decidir. A normalização mora em `operations/ai.ts` e é chamada por `ensureApprovalsNormalized(state)` no início de `decideApproval`, `solicitarAprovacao` e `decideProcessApproval`, exatamente como o plano previu para esse caso.
- **`origin` não é `readonly`** (diferente do resto do objeto imutável de `ApprovalRequest`) — precisa ser escrito pela normalização de registros legados na primeira leitura; documentado no tipo.
- **Autorização compartilhada.** `mayDecideApproval` extrai a resolução (aprovador designado, dono do Agente — só no ramo `agentExecution` —, ou administrador/proprietário) que `decideApproval` já fazia inline, reusada por `decideProcessApproval` sem reescrever a regra (instrução explícita do plano).
- **Status resolvido por nome.** `solicitarAprovacao`/`decideProcessApproval` não recebem `statusId`: resolvem `"em aprovação"`/`"aprovado"`/`"não aprovado"` pelo nome no Conjunto de Status efetivo da Lista (`resolveProcessStatusId`), porque a Lista real (com esses nomes exatos, D-01) só nasce no Plan 02-06.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `packages/dominio/src/seed.ts` e `seed-produto.ts` ajustados ao novo formato de `ApprovalOrigin`**
- **Found during:** Task 1
- **Issue:** `buildApprovals()` em `seed.ts` montava `ApprovalRequest` com `executionId`/`stepIndex`/`deadline` soltos (o formato antigo); `seed-produto.ts` lia `a.executionId` direto na poda por Espaço/Lista removidos. Nenhum dos dois compila mais depois que `ApprovalRequest.origin` substitui esses campos — `packages/dominio` inteiro (inclusive os 253 testes existentes) para de compilar sem o ajuste.
- **Fix:** `seed.ts` monta `origin: { kind: "agentExecution", executionId, stepIndex, deadline }`; `seed-produto.ts` guarda a leitura com `a.origin.kind === "agentExecution"`.
- **Files modified:** `packages/dominio/src/seed.ts`, `packages/dominio/src/seed-produto.ts`
- **Verification:** `npm run typecheck -w @n1/dominio` e `npm run test -w @n1/dominio` (266/266)
- **Committed in:** `fd94d88` (Task 1 commit)

**2. [Rule 3 - Blocking] `apps/web` — três telas liam `approval.executionId`/`approval.deadline` direto**
- **Found during:** Task 1 (acceptance criteria explícita do plano: "se algum componente lia executionId direto, ele foi ajustado nesta task")
- **Issue:** `ia/aprovacoes/page.tsx`, `ia/execucoes/[execucao]/page.tsx` e `notificacoes/page.tsx` acessavam os campos removidos de `ApprovalRequest` diretamente; `npm run typecheck -w @n1/web` quebrava com `Property 'executionId'/'deadline' does not exist`.
- **Fix:** leitura guardada por `approval.origin.kind === "agentExecution"` (helpers `approvalExecutionId`/`approvalDeadline` em `aprovacoes/page.tsx`); uma aprovação `processTask` nessas telas hoje aparece "sem prazo" — o redesenho completo para discriminar as duas origens na UI é de um plano posterior (ver `apps/web/src/features/tarefa/painel-aprovacao.tsx` no mapa de padrões da fase).
- **Files modified:** as três telas + `apps/web/src/features/shell/format.ts` (rótulo `processo` em `APPROVAL_REASON_LABEL`)
- **Verification:** `npm run typecheck -w @n1/web` sai 0
- **Committed in:** `fd94d88` (Task 1 commit)

**3. [Rule 1 - Bug] Teste existente de `operations.test.ts` mutava `deadline` no campo antigo**
- **Found during:** Task 1
- **Issue:** dois testes de `decideApproval` (expiração) faziam `Object.assign(approval, { deadline: ... })` — sem efeito depois da mudança de tipo (o campo não existe mais na raiz), fazendo o teste de expiração falhar silenciosamente (o resultado deixava de expirar).
- **Fix:** `Object.assign(approval.origin, { deadline: ... })`, guardado por `origin.kind === "agentExecution"`.
- **Files modified:** `packages/dominio/src/operations/operations.test.ts`
- **Verification:** os 253 testes originais de `@n1/dominio` continuam passando
- **Committed in:** `fd94d88` (Task 1 commit)

**4. [Rule 3 - Blocking] Dois testes com a contagem de operações hardcoded (132) quebraram ao registrar as 2 operações novas**
- **Found during:** Task 2
- **Issue:** `esquemas-de-argumentos.test.ts` e `esquemas/ia.test.ts` tinham `expect(...).toBe(132)` e a lista literal das 7 chaves de `ai.ts` — os dois esperados pelo próprio design de CR-02 (Plan 01-16) como rede de regressão contra drift, não como acaso.
- **Fix:** contagem atualizada para 134; listas de chaves e formas literais/hostis ampliadas com `solicitarAprovacao`/`decideProcessApproval`.
- **Files modified:** `apps/api/src/rotas/esquemas-de-argumentos.test.ts`, `apps/api/src/rotas/esquemas/ia.test.ts`
- **Verification:** `npm run test -w @n1/api -- src/rotas/esquemas-de-argumentos.test.ts` e o arquivo `esquemas/ia.test.ts` saem 0
- **Committed in:** `b0ec637` (Task 2 commit)

**5. [Rule 3 - Blocking, ambiente] Resolução de `@n1/dominio` no worktree caía no checkout principal**
- **Found during:** Task 1 (ao rodar `npm run typecheck -w @n1/web` pela primeira vez)
- **Issue:** o worktree não tem `node_modules` próprio; a resolução de módulo (`@n1/dominio`, `@n1/api`, `@n1/web`) subia o diretório até achar `node_modules/@n1/*` no repositório principal — que aponta (por symlink) para o `packages/dominio` do checkout principal, **não** para as edições deste worktree. `tsc` via typechecks anteriores (dominio/api) não expôs o problema porque `vitest`/`tsc` rodam com `cwd` dentro do próprio pacote e resolvem `../` relativo; só a importação `@n1/dominio` por especificador de pacote (usada em `apps/web`) expôs o desalinhamento.
- **Fix:** criados `node_modules/@n1/{dominio,api,web}` **dentro do worktree**, symlinks para `../../packages/dominio`, `../../apps/api`, `../../apps/web` locais — mesma estrutura que o repositório principal já tem, mas apontando para as edições desta sessão. `node_modules/` é `.gitignore`d; nada disso é rastreado ou comitado.
- **Files modified:** nenhum arquivo versionado — só `node_modules/@n1/*` (gitignored) dentro do worktree
- **Verification:** `npm run typecheck -w @n1/web` passou a refletir as edições reais do worktree (a rodada anterior apontava erros que já não existiam no código editado)
- **Committed in:** não aplicável (gitignored)

---

**Total deviations:** 5 auto-fixed (4 Rule 3 - blocking, 1 Rule 1 - bug)
**Impact on plan:** Todos os ajustes eram necessários para o `packages/dominio`/`apps/web`/`apps/api` compilarem e testarem depois da mudança de tipo que a própria Task 1 do plano pedia; nenhum é escopo novo não anunciado pelo plano (a acceptance criteria da Task 1 já previa expressamente os ajustes em `apps/web`).

## Issues Encountered

None além do já documentado em Deviations.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SOL-03 tem fundação de domínio: `solicitarAprovacao`/`decideProcessApproval` existem, são idempotentes, autorizadas e auditáveis, e a Lista de Solicitações (Plan 02-06) pode chamá-las já sabendo o formato exato de `origin`/`decisionSource`/`decisionReason`.
- A UI de aprovações (`apps/web/src/app/(shell)/ia/aprovacoes/page.tsx`, `apps/web/src/features/tarefa/painel-aprovacao.tsx`) ainda não discrimina `processTask` de `agentExecution` visualmente — hoje uma aprovação de processo aparece "sem prazo" nas telas existentes; um plano de UI mais adiante (fila/card por Tarefa, D-08) precisa decidir a apresentação.
- Nenhum bloqueio conhecido para o Plan 02-06 (catálogo/Lista real) nem para o Plan 02-10 (UoW/evento de saída) consumirem estas duas operações.

---
*Phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup*
*Completed: 2026-09-21*

## Self-Check: PASSED

All key files found on disk (types/ai.ts, operations/ai.ts, registro.ts, index.ts, aprovacao-de-processo.test.ts, CONTEXT.md, esquemas/ia.ts, this SUMMARY.md). All 4 commits (fd94d88, b0ec637, 08eedf2, 542329c) found in `git log`.
