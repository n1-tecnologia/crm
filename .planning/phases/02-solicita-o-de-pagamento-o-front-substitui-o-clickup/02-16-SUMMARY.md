---
phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup
plan: 16
subsystem: api
tags: [fastify, zod, public-routes, rate-limiting, supabase-storage, outbox, postgres]

requires:
  - phase: 02-05
    provides: submitForm atômico (packages/dominio/src/operations/scale.ts) com Ator formActor(formId)
  - phase: 02-08
    provides: evolver da Lista "Solicitações de pagamento"
  - phase: 02-10
    provides: outbox transacional (gravarEventos dentro de executar())
  - phase: 02-11
    provides: upload em duas fases (servicos/storage-uploads.ts, persistencia/sessoes-de-upload.ts)
  - phase: 02-13
    provides: padrão de rotas HTTP sobre a Unidade de Trabalho (rotas/integracao-solicitacoes.ts)
provides:
  - "GET /v1/public/forms/:secret — DTO sanitizado do Formulário, sem login"
  - "POST /v1/public/forms/:secret/uploads — ticket de upload de escopo mínimo"
  - "POST /v1/public/forms/:secret/submissions — envio atômico: Tarefa+Campos+anexos+Atividade+evento no mesmo commit"
  - "criarLimiteDeTaxa — janela deslizante em memória, reutilizável por outras rotas públicas futuras"
  - "OpcoesExecucao.aoConfirmar — hook genérico da Unidade de Trabalho para participar da mesma transação pós-outbox"
affects: [02-20, 02-15]

tech-stack:
  added: []
  patterns:
    - "Rota pública com config:{publica:true} + DI (lerEstado/limitePorIp/limitePorSegredo) para rodar testes sem DATABASE_URL, mesmo padrão de verificarToken/resolverMembro em app.ts"
    - "I/O externo (confirmarObjeto) resolvido ANTES de entrar em executar() — o mesmo padrão SERVICOS de rotas/operacoes.ts"
    - "Resposta 404 uniforme via uma única função, para segredo inexistente e Formulário pausado nunca divergirem"

key-files:
  created:
    - apps/api/src/servicos/limite-de-taxa.ts
    - apps/api/src/rotas/esquemas/formularios-publicos.ts
    - apps/api/src/rotas/formularios-publicos.ts
    - apps/api/src/rotas/formularios-publicos.test.ts
  modified:
    - apps/api/src/app.ts
    - apps/api/src/persistencia/unidade-de-trabalho.ts
    - apps/api/src/rotas/CONTEXT.md

key-decisions:
  - "Unidade de Trabalho ganhou opcoes.aoConfirmar(cliente, valor, state), rodando depois do outbox e antes do commit, em vez de expor o PoolClient inteiro à rota — menos superfície para escrita fora da revisão otimista"
  - "Reenvio da mesma submissionId depois de consumida responde 409 (não 200 idempotente): o domínio não sabe o que é uma sessão de upload, e a Unidade de Trabalho já desfez a transação inteira antes da rota decidir o HTTP"
  - "Recusa de domínio com field definido devolve a mensagem real do domínio (erro por campo, UI-SPEC); sem field, devolve a copy genérica — nunca a mensagem interna de refusals estruturais como Formulário desatualizado"

requirements-completed: [SOL-02, SOL-07]

duration: 35min
completed: 2026-09-21
---

# Phase 02 Plan 16: Rotas públicas do Formulário Summary

**As três rotas HTTP sem login que fazem o pedido de pagamento nascer no Postgres — DTO sanitizado, ticket de upload em duas fases, e submissão atômica com Tarefa/anexos/evento no mesmo commit via um novo hook `aoConfirmar` na Unidade de Trabalho.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-09-21 (leitura de contexto + `npm install` no worktree)
- **Completed:** 2026-09-21T19:18:52Z
- **Tasks:** 3/3
- **Files modified:** 7 (4 criados, 3 modificados)

## Accomplishments
- `GET /v1/public/forms/:secret`, `POST .../uploads` e `POST .../submissions` registradas em `app.ts` como as únicas rotas sem `Authorization: Bearer` da instância, com limite de taxa por IP e por segredo.
- A submissão grava Tarefa, Campos, `WorkspaceFile`s, a Atividade do Ator `formulario:<id>` e o evento `solicitacao.criada.v1` no MESMO commit Postgres, e só então marca a sessão de upload como consumida — tudo dentro de `executar()`.
- Segredo inexistente e Formulário pausado respondem a mesma 404, byte a byte — sem distinção que permita enumeração.

## Task Commits

1. **Task 1: Limite de taxa e schemas das três rotas** - `8e9ae43` (feat)
2. **Task 2: As três rotas públicas** - `b34ff23` (feat)
3. **Task 3: Suíte de segredo, atomicidade e superfície** - `1f104bd` (test)

**Plan metadata:** pending (this commit)

## Files Created/Modified
- `apps/api/src/servicos/limite-de-taxa.ts` - `criarLimiteDeTaxa`: janela deslizante em memória, chaveada por quem chama (IP, segredo)
- `apps/api/src/rotas/esquemas/formularios-publicos.ts` - `PARAMS_SEGREDO`/`CORPO_TICKET`/`CORPO_SUBMISSAO`, os três `.strict()`
- `apps/api/src/rotas/formularios-publicos.ts` - `rotasDeFormulariosPublicos`: as três rotas, o DTO sanitizado, a submissão atômica
- `apps/api/src/rotas/formularios-publicos.test.ts` - suíte (a)-(f) sem banco + (g)-(k) contra Postgres/Storage reais
- `apps/api/src/app.ts` - registra `rotasDeFormulariosPublicos`; `OpcoesDoApp.formulariosPublicos` para injeção de teste
- `apps/api/src/persistencia/unidade-de-trabalho.ts` - `OpcoesExecucao.aoConfirmar` (deviation, ver abaixo)
- `apps/api/src/rotas/CONTEXT.md` - documenta a nova família de rotas públicas

## Decisions Made
- **`aoConfirmar` em vez de expor o `PoolClient`:** o plano deixava a forma em aberto ("expor o cliente ou aceitar um `aoConfirmar(cliente)`; escolher a forma menos invasiva"). Optei pelo hook porque ele mantém a Unidade de Trabalho sem saber o que é uma "sessão de upload" — o mesmo princípio já documentado no cabeçalho do arquivo para `opcoes.eventos`.
- **409 (não 200) no reenvio da mesma `submissionId`:** `consumirSessao` lança dentro da transação; a Unidade de Trabalho já fez rollback da segunda Tarefa antes da rota decidir o HTTP. Tratar como sucesso idempotente exigiria guardar e devolver a resposta original (padrão `comIdempotencia` de `servicos/idempotencia.ts`) — fora do escopo deste plano, que só pede "recusa (sessão já consumida)".
- **DTO público deriva `kind` do `FieldType` do domínio** (`text`, `longText`, `singleSelect`, `file`, etc.) em vez de inventar um vocabulário próprio — o Plan 02-20 (consumidor) already conhece esse vocabulário pelo `apps/web` atual.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] `apps/api/src/persistencia/unidade-de-trabalho.ts` ganhou `opcoes.aoConfirmar`**
- **Found during:** Task 2 (as três rotas públicas)
- **Issue:** O arquivo não estava em `files_modified` do plano, mas o próprio texto da Task 2 exige que `executar()` participe da mesma transação para `consumirSessao` — sem isso, a sessão de upload não poderia ser consumida no mesmo commit que a Tarefa (T-02-06), quebrando a atomicidade que é o objetivo central do plano.
- **Fix:** Adicionado `OpcoesExecucao.aoConfirmar?(cliente, valor, state): Promise<void>`, chamado depois de `gravarEventos` e antes do `commit`, com o mesmo `cliente`/transação. Lançar dentro dele desfaz a transação inteira (mesmo efeito de uma exceção em `operacao`).
- **Files modified:** `apps/api/src/persistencia/unidade-de-trabalho.ts`
- **Verification:** `npm run typecheck -w @n1/api` (0), `npm run test -w @n1/api` (261 passed, 92 skipped — nenhuma regressão nos consumidores existentes de `executar()`: `operacoes.ts`, `outbox.test.ts`, `integracao-solicitacoes.ts`). Exercício funcional do novo hook coberto pelos casos (g)-(k) de `formularios-publicos.test.ts` (skip sem `DATABASE_URL`/bucket neste worktree, mesmo gate de `storage-uploads.test.ts`).
- **Committed in:** `b34ff23` (Task 2 commit)

**2. [Rule 2 - Missing Critical] `apps/api/src/rotas/CONTEXT.md` documenta a nova família de rotas**
- **Found during:** Task 2/3
- **Issue:** Não estava em `files_modified`, mas o arquivo existe justamente para listar "os arquivos deste diretório" — deixá-lo silenciosamente desatualizado prejudicaria o Plan 02-20 (consumidor direto destas rotas) e qualquer plano futuro que abra este diretório.
- **Fix:** Acrescentada a seção "Rotas públicas do Formulário", no mesmo estilo da seção "Rotas de integração (v1)" já existente.
- **Files modified:** `apps/api/src/rotas/CONTEXT.md`
- **Verification:** Leitura manual — prosa consistente com o resto do arquivo, sem alterar nenhuma regra existente.
- **Committed in:** `1f104bd` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (ambos Rule 2 — funcionalidade/documentação crítica ausente)
**Impact on plan:** Nenhum scope creep — os dois eram pré-requisitos implícitos do próprio texto do plano (atomicidade real exige o hook; a rota nova exige que o índice do diretório a mencione).

## Issues Encountered
- `apps/api/src/rotas/formularios-publicos.ts` tinha a frase `config: { publica: true }` também no comentário de cabeçalho, o que fazia `grep -c 'publica: true'` contar 4 em vez de 3 (o acceptance criteria da Task 2 exige exatamente 3 — uma por rota). Reescrevi o comentário para não repetir a string literal; o grep confere 3 depois do ajuste.
- Este worktree não tem `DATABASE_URL`/`SUPABASE_STORAGE_BUCKET` (ambiente descrito no prompt: IPv6 indisponível, sem `apps/api/.env`) — os casos (g)-(k) de `formularios-publicos.test.ts` (a atomicidade real contra Postgres+Storage) só puderam ser validados por leitura cuidadosa e pelo mesmo padrão já comprovado em `servicos/storage-uploads.test.ts`/`persistencia/outbox.test.ts`, não por execução real. `npm run test -w @n1/api` confirma que eles pulam corretamente (`describe.skip`) em vez de falhar.

## User Setup Required

None - nenhuma configuração externa nova. As rotas reaproveitam o bucket privado e as credenciais do Supabase já configuradas pelo Plan 02-11.

## Next Phase Readiness
- Plan 02-20 (consumidor `apps/web`) pode trocar o `/f/[segredo]` em memória por estas três rotas HTTP: o DTO público, o fluxo de upload de duas fases e o envio já existem e respondem exatamente o que o UI-SPEC pede (`readableId`, copy única de indisponibilidade, copy genérica de erro).
- Pendência para quem rodar este plano contra CI/staging: confirmar os casos (g)-(k) (`DATABASE_URL` + `SUPABASE_STORAGE_BUCKET`/`SUPABASE_URL`/`SUPABASE_SECRET_KEY` presentes) e a linha "Uma submissão real produz 1 Tarefa e exatamente 1 linha em `plataforma.integration_outbox`" do `<verification>` do plano — não executável neste worktree isolado.

---
*Phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup*
*Completed: 2026-09-21*

## Self-Check: PASSED

- FOUND: `apps/api/src/servicos/limite-de-taxa.ts`
- FOUND: `apps/api/src/rotas/esquemas/formularios-publicos.ts`
- FOUND: `apps/api/src/rotas/formularios-publicos.ts`
- FOUND: `apps/api/src/rotas/formularios-publicos.test.ts`
- FOUND: `apps/api/src/app.ts`
- FOUND: `apps/api/src/persistencia/unidade-de-trabalho.ts`
- FOUND: `apps/api/src/rotas/CONTEXT.md`
- FOUND: `.planning/phases/02-solicita-o-de-pagamento-o-front-substitui-o-clickup/02-16-SUMMARY.md`
- FOUND commit: `8e9ae43` (Task 1)
- FOUND commit: `b34ff23` (Task 2)
- FOUND commit: `1f104bd` (Task 3)
