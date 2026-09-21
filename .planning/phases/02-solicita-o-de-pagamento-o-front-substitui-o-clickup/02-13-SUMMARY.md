---
phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup
plan: 13
subsystem: api
tags: [fastify, zod, postgres, idempotency, http-contract, payment-requests]

# Dependency graph
requires:
  - phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup
    provides: "Plan 02-02 (contrato v1 + fixtures canônicas), Plan 02-09 (credencial de serviço + hook autenticacao-servico), Plan 02-10 (outbox transacional), Plan 02-11 (storage-uploads/urlDeDownload)"
provides:
  - "As 7 rotas HTTP /v1/integrations/payment-requests/* (getTask, listPaymentRequestTasks, getCommentReplies, createComment, addTaskTag, updateTaskDueDate, updateTaskStatus)"
  - "Serviço de idempotência HTTP (comIdempotencia) sobre plataforma.http_idempotency"
  - "Projeção Tarefa/Comentário -> PaymentRequestDtoV1/CommentDtoV1 (paraDtoV1, paraCommentDtoV1)"
  - "Código de erro CONFLITO_DE_REVISAO no catálogo do contrato (409, retryable)"
  - "7 fixtures erro-401.json reconciliadas para CREDENCIAL_AUSENTE"
affects: ["02-17 (adapter automation/plataforma.ts)", "02-21 (aprovação por clique)", "fase 4 (leituras autenticadas)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Validação manual de schema (.safeParse) dentro do handler em vez de `{ schema: {...} }` do Fastify, para responder o envelope do contrato v1 em vez do genérico de app.ts::setErrorHandler"
    - "Pré-checagem de existência (hidratarSomente) antes de comIdempotencia, para um 404 não consumir a chave de idempotência"
    - "Captura de DataState pós-operação via variável de fechamento (estadoFinal) dentro do callback de executar(), para projetar o DTO com o estado já mutado"
    - "comSaneamentoDeErro: wrapper try/catch por rota, traduzindo qualquer exceção não prevista para ERRO_INTERNO no envelope do contrato"

key-files:
  created:
    - apps/api/src/servicos/idempotencia.ts
    - apps/api/src/servicos/dto-solicitacao.ts
    - apps/api/src/rotas/integracao-solicitacoes.ts
    - apps/api/src/rotas/esquemas/integracao-solicitacoes.ts
    - apps/api/src/rotas/integracao-solicitacoes.test.ts
  modified:
    - apps/api/src/app.ts
    - apps/api/src/contratos/erros.ts
    - apps/api/src/rotas/CONTEXT.md
    - docs/08-migracao-financeiro/04-contrato-plataforma-v1.md
    - "contratos/payment-requests-v1/*.erro-401.json (7 arquivos)"
    - .planning/phases/02-solicita-o-de-pagamento-o-front-substitui-o-clickup/deferred-items.md

key-decisions:
  - "updateTaskStatus mapeia recusa de domínio (changeTaskStatus ok:false) para 409 CONFLITO_DE_ORDEM, não 422 REGRA_DE_DOMINIO como o texto do plano sugeria — a fixture canônica updateTaskStatus.erro-409.json (Plan 02-02) é normativa; as outras três escritas usam 422 REGRA_DE_DOMINIO, confirmado pelas próprias fixtures erro-422.json"
  - "Acrescentado o código CONFLITO_DE_REVISAO (409, retryable:true) ao catálogo de erros — ausente antes porque nenhuma rota produzia conflito de revisão otimista da UoW; necessário para o próprio texto do plano (Task 2) mapear esse caso"
  - "As 7 fixtures *.erro-401.json foram reconciliadas de CREDENCIAL_INVALIDA para CREDENCIAL_AUSENTE, fechando o deferred item que o Plan 02-09 deixou explicitamente para quem construísse estas rotas"
  - "Identidade de serviço da suíte de teste resolve para um Membro comum (mem_maryane), não para o Papel real 'Agente do pipeline' — ver Known Limitations"
  - "manualReason sempre null: não existe Campo dedicado no catálogo de 25 Campos para o motivo do Fluxo Manual (só a seleção 'Manual' existe); o motivo vive apenas em Registro de Atividade, inacessível a esta projeção"
  - "attachments[].mediaType usa a categoria ampla de WorkspaceFile.mediaType (document/image/...), não o MIME bruto (application/pdf) — o domínio não persiste o MIME original; o schema do contrato é z.string() livre, então valida, mas não é o MIME de fato"
  - "reason (body de PUT /:taskId/status) é aceito e validado pelo schema mas não tem efeito de domínio: changeTaskStatus não aceita motivo e não há Campo dedicado — mesma lacuna de manualReason"

patterns-established:
  - "Rotas de integração v1 nunca usam o schema attachment do Fastify — só validação manual + erroDoContrato, para manter o envelope de erro do §3 do contrato em toda resposta 4xx/5xx"
  - "Toda rota de escrita: 404 pré-checado fora da idempotência → comIdempotencia → executarEscrita (UoW + mapa de erro) → responderIdempotente"

requirements-completed: [SOL-05, SOL-07]

duration: ~50min
completed: 2026-09-21
---

# Phase 02 Plan 13: Rotas HTTP v1 de Solicitação de Pagamento Summary

**As sete rotas `/v1/integrations/payment-requests/*` do `apps/api`, autenticadas por credencial de serviço, idempotentes via `plataforma.http_idempotency`, com projeção Tarefa→`PaymentRequestDtoV1` fiel ao contrato v1 e sem vazamento de dado financeiro em erro ou log.**

## Performance

- **Duration:** ~50 min (leitura intensiva do contrato/fixtures/domínio antes de escrever código, dada a complexidade de mapear 25 Campos e o modelo de permissão)
- **Tasks:** 3/3 completas
- **Files modified:** 13 (5 criados, 8 modificados)

## Accomplishments

- Serviço de idempotência HTTP (`comIdempotencia`) sobre `plataforma.http_idempotency`: grava `in_progress`, replay com mesmo hash devolve a resposta gravada, hash diferente é `409 IDEMPOTENCY_KEY_REUSED`, falha na execução apaga a linha para não travar a chave
- Projeção `paraDtoV1`/`paraCommentDtoV1` (`servicos/dto-solicitacao.ts`): de-para completo do §4/§5 do contrato, ids de Campo resolvidos por `ordem` a partir do catálogo exportado (nunca strings soltas duplicadas), `amountCents` com `Math.round`, `downloadUrl` sempre gerada na leitura
- As 7 rotas `/v1/integrations/payment-requests/*` registradas dentro do plugin de serviço de `app.ts` (Plan 02-09), cada uma com `config: { escopo }`, `actingMemberId` sempre `request.servico.memberId`
- Suíte `app.inject` cobrindo os 13 casos (a)-(m) do plano — 6 rodam sem banco, 12 pulam sem `DATABASE_URL` (esperado neste worktree)
- `npm run check` verde nos três workspaces (typecheck + lint@web + tokens + testes, incluindo os 86 casos de `contratos/v1.test.ts` que dependiam das fixtures reconciliadas)

## Task Commits

1. **Task 1: Idempotência HTTP e projeção do DTO** - `1872860` (feat)
2. **Task 2: As sete rotas `/v1/integrations/payment-requests/*`** - `7e10017` (feat)
3. **Task 3: Suíte `app.inject` de auth, schema, replay e conflito** - `1f021ce` (test)

## Files Created/Modified

- `apps/api/src/servicos/idempotencia.ts` - `comIdempotencia<T>`: protocolo completo de replay/conflito sobre `plataforma.http_idempotency`
- `apps/api/src/servicos/dto-solicitacao.ts` - `paraDtoV1`, `paraCommentDtoV1`, `LISTA_SOLICITACOES_DE_PAGAMENTO_ID`, `ID_DO_STATUS` (exportados para as rotas)
- `apps/api/src/rotas/integracao-solicitacoes.ts` - `rotasDeIntegracaoDeSolicitacoes`: as 7 rotas, `executarEscrita`, `comSaneamentoDeErro`, paginação por cursor opaco
- `apps/api/src/rotas/esquemas/integracao-solicitacoes.ts` - `params`/`query`/`body`/`headers` por método, compostos de `EsquemasV1`
- `apps/api/src/rotas/integracao-solicitacoes.test.ts` - suíte `app.inject`, casos (a)-(m)
- `apps/api/src/app.ts` - registra `rotasDeIntegracaoDeSolicitacoes` dentro do plugin de `/v1/integrations`
- `apps/api/src/contratos/erros.ts` - novo código `CONFLITO_DE_REVISAO`
- `apps/api/src/rotas/CONTEXT.md` - seção "Rotas de integração (v1)"
- `docs/08-migracao-financeiro/04-contrato-plataforma-v1.md` - linha de `CONFLITO_DE_REVISAO` no §3
- `contratos/payment-requests-v1/*.erro-401.json` (7 arquivos) - reconciliados para `CREDENCIAL_AUSENTE`
- `.planning/phases/.../deferred-items.md` - fecha o item 02-09 sobre `erro-401.json`; abre um novo item bloqueante sobre `taskWriteRefusal`/Convidado

## Decisions Made

Ver `key-decisions` no frontmatter — resumo:
1. `updateTaskStatus` usa `409 CONFLITO_DE_ORDEM` para recusa de domínio (fixture canônica manda, não a prosa do plano).
2. Código `CONFLITO_DE_REVISAO` acrescentado ao catálogo (ausente, necessário).
3. Fixtures `erro-401.json` reconciliadas (deferred item do Plan 02-09, fechado agora).
4. `manualReason` e `reason` (status) sempre sem efeito/`null`: sem Campo dedicado no catálogo de 25 Campos.
5. `attachments[].mediaType` é uma aproximação (categoria ampla, não MIME bruto) — domínio não persiste o MIME original.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — texto do plano vs. fixture canônica] `updateTaskStatus` usa 409, não 422, para recusa de domínio**
- **Found during:** Task 2
- **Issue:** O texto da Task 2 diz "transição inválida é 422 (regra de domínio), não 400" — mas a fixture `contratos/payment-requests-v1/updateTaskStatus.erro-409.json` (Plan 02-02, "a closest thing to a spec") espera `409 CONFLITO_DE_ORDEM` para exatamente esse cenário ("Transição inválida — de aprovado direto para para fazer").
- **Fix:** `executarEscrita` da rota `updateTaskStatus` usa `recusa: { status: 409, codigo: "CONFLITO_DE_ORDEM" }`; as outras três escritas mantêm o padrão `422 REGRA_DE_DOMINIO` (confirmado pelas fixtures `erro-422.json` de `createComment`/`addTaskTag`/`updateTaskDueDate`).
- **Files modified:** `apps/api/src/rotas/integracao-solicitacoes.ts`
- **Verification:** `npm run typecheck -w @n1/api`; leitura manual da fixture.
- **Committed in:** `7e10017`

**2. [Rule 2 — funcionalidade crítica ausente] Código `CONFLITO_DE_REVISAO` acrescentado ao catálogo**
- **Found during:** Task 2
- **Issue:** O texto do plano pede explicitamente "conflito de revisão da UoW → 409 CONFLITO_DE_REVISAO com retryable: true", mas esse código não existia em `apps/api/src/contratos/erros.ts` — nenhuma rota anterior produzia esse caso.
- **Fix:** Acrescentado `CONFLITO_DE_REVISAO: { status: 409, retryable: true, ... }` ao catálogo, com a linha correspondente no §3 de `docs/08-migracao-financeiro/04-contrato-plataforma-v1.md`. Aditivo — não quebra `contratos/v1.test.ts` (sem checagem de exaustividade sobre `CODIGOS_DE_ERRO`).
- **Files modified:** `apps/api/src/contratos/erros.ts`, `docs/08-migracao-financeiro/04-contrato-plataforma-v1.md`
- **Verification:** `npm run test -w @n1/api -- src/contratos/v1.test.ts` (86 casos, todos verdes).
- **Committed in:** `7e10017`

**3. [Rule 2 — funcionalidade crítica ausente] `comSaneamentoDeErro`: toda rota responde o envelope do contrato em exceção não prevista**
- **Found during:** Task 3 (desenhando o caso (l), sanitização)
- **Issue:** Sem tratamento próprio, uma exceção dentro de uma rota v1 (ex.: `paraDtoV1` lançando por um Status corrompido fora do Conjunto oficial) subiria ao `setErrorHandler` genérico de `app.ts`, que devolve `{ ok:false, error: "Erro interno." }` — um formato DIFERENTE do envelope `erroDoContrato` que o §3 do contrato exige para TODA resposta de erro, inclusive 500.
- **Fix:** Acrescentado `comSaneamentoDeErro`, um wrapper try/catch aplicado às 7 rotas; qualquer exceção não prevista responde `500 { error: { code: "ERRO_INTERNO", ... } }`, com o detalhe completo só em `request.log.error`.
- **Files modified:** `apps/api/src/rotas/integracao-solicitacoes.ts`
- **Verification:** Caso (l) da suíte de teste (gated por `DATABASE_URL`, não executado neste worktree — ver Known Limitations sobre execução local).
- **Committed in:** `1f021ce`

**4. [Rule 2 — funcionalidade crítica ausente] Reconciliação das 7 fixtures `erro-401.json`**
- **Found during:** Task 3, ao escrever o caso (a)
- **Issue:** Deferred item explícito do Plan 02-09 (`deferred-items.md`): as 7 fixtures de ausência de credencial ainda usavam `CREDENCIAL_INVALIDA`, escritas antes de `CREDENCIAL_AUSENTE` existir. O `upstream_context` deste plano pediu explicitamente para reconciliar agora que as rotas existem.
- **Fix:** As 7 `*.erro-401.json` (`getTask`, `listPaymentRequestTasks`, `getCommentReplies`, `createComment`, `addTaskTag`, `updateTaskDueDate`, `updateTaskStatus`) mudaram `code`/`message` para `CREDENCIAL_AUSENTE`/"Credencial de serviço ausente.".
- **Files modified:** `contratos/payment-requests-v1/*.erro-401.json` (7 arquivos), `deferred-items.md` (linha marcada resolvida)
- **Verification:** `npm run test -w @n1/api -- src/contratos/v1.test.ts` (verde); caso (a) da nova suíte confirma o comportamento real do hook.
- **Committed in:** `7e10017`

---

**Total deviations:** 4 auto-fixed (1 correção de mapeamento de erro contra fixture, 2 funcionalidade crítica ausente, 1 reconciliação de fixture stale)
**Impact on plan:** Todas necessárias para fidelidade ao contrato canônico (fixtures) ou para completar um requisito que o próprio texto do plano já pedia. Nenhum scope creep.

## Issues Encountered

**Gap de domínio confirmado empiricamente — bloqueante para o Plan 02-17 (não corrigido aqui, fora de `packages/dominio`/`files_modified`):**

O Membro real que ocupa o Papel "Agente do pipeline" (a única identidade que uma credencial de serviço de produção resolve, via `resolverMembroAgenteDoPipeline`) é sempre um Convidado (`base: "convidado"`, `solicitacao-de-pagamento-evolver.ts::baseParaPapel`). `taskWriteRefusal` (`packages/dominio/src/derive.ts`), usada por `changeTaskStatus`/`setTaskTags`/`updateTask` — as operações que `PUT /:taskId/status`, `PUT /:taskId/tags/:tagId` e `PUT /:taskId/due-date` compõem — recusa QUALQUER Convidado categoricamente, sem checar `editarRestritoA`. Confirmado com um script de verificação em memória durante a Task 1: `changeTaskStatus` com o Membro real do Papel devolve `"Um Convidado não altera Tarefa: ele alcança só o que foi compartilhado com ele."`, mesmo para uma transição de Status legítima.

Na prática, com o `DataState` real (evolver aplicado em produção), as três rotas acima SEMPRE devolveriam `422`/`409` para a credencial de serviço real — o adapter `automation/` (Plan 02-17) receberia erro em toda escrita de Status/Tag/vencimento. Só `createComment` tem uma chance de passar, e só se existir um `Grant` direto de `comentar`/`editar` sobre o recurso (nenhum código cria esse Grant hoje).

As rotas deste plano fazem exatamente o que o contrato pede (`actingMemberId` sempre `request.servico.memberId`, nunca o corpo — grep confirmado, zero linhas) — o gap é de permissão no domínio, não de transporte. Documentado em `deferred-items.md` com a correção sugerida (consultar `PapelDaSolicitacao.editarRestritoA` em `taskWriteRefusal` antes de recusar um Convidado). **Quem planejar o Plan 02-17 precisa resolver isto primeiro.**

A suíte de teste (`integracao-solicitacoes.test.ts`) documenta o gap no cabeçalho e usa deliberadamente um Membro comum (`mem_maryane`) como identidade de serviço, para provar a mecânica HTTP das rotas (V02-05A) sem fingir que o gap de permissão não existe.

## Known Limitations

- **Execução local sem `DATABASE_URL`:** este worktree não tem `apps/api/.env` — os 12 dos 18 testes de `integracao-solicitacoes.test.ts` que precisam de Postgres real (`(d)`, `(f)`, `(h)`-`(l)`) pulam aqui, como esperado (`describe.skip` via `temBanco`). Validados por um script de verificação em memória (não commitado) que exercitou `evoluirConfiguracaoDeSolicitacoes` → `createTask` → `setTaskFieldValue` → `paraDtoV1`/`paraCommentDtoV1` contra os schemas zod reais, confirmando a construção de estado e a projeção — mas o caminho HTTP completo (rota → UoW → Postgres) não foi exercitado ponta-a-ponta neste ambiente.
- **Caso (m) é `it.skip` incondicional:** provar "URL nova a cada leitura" exige um `WorkspaceFile` com `objectKey` real num bucket do Supabase Storage — o fluxo de duas fases inteiro que `servicos/storage-uploads.test.ts` (Plan 02-11) já prova como integração. Não reimplementado aqui por escopo/tempo.
- **`attachments[].mediaType`** é a categoria ampla de `WorkspaceFile.mediaType` (`document`/`image`/...), não o MIME bruto (`application/pdf`) que a fixture canônica mostra — o domínio não persiste o MIME original hoje. O schema do contrato é `z.string()` livre, então valida; só não é o MIME de fato.
- **`manualReason` e `reason` (status)** sempre `null`/sem efeito: nenhum Campo do catálogo de 25 Campos guarda o motivo do Fluxo Manual ou da decisão de Status — só a seleção "Manual" existe. O motivo real fica apenas em Registro de Atividade.
- **Gap de permissão Convidado/`taskWriteRefusal`** — ver "Issues Encountered" acima. Bloqueante para o Plan 02-17 em produção real.

## User Setup Required

None - no external service configuration required. (`DATABASE_URL`/Supabase Storage são pré-requisitos de execução de teste, não de configuração deste plano.)

## Next Phase Readiness

- O lado plataforma de SOL-05 está pronto no nível de transporte: sete rotas v1 autenticadas por serviço, idempotentes, com DTOs fiéis ao contrato.
- **Bloqueio real para o Plan 02-17** (adapter `automation/`): o gap de permissão Convidado documentado acima precisa de uma correção de domínio (fora deste plano) antes que a credencial de serviço de produção consiga de fato mudar Status/Tag/vencimento de uma Solicitação.
- Suíte de teste cobre a mecânica HTTP; os testes com banco real precisam rodar num ambiente com `DATABASE_URL` (e, para o caso (m), Supabase Storage) para provar o caminho ponta-a-ponta.

---
*Phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup*
*Plan: 13*
*Completed: 2026-09-21*

## Self-Check: PASSED

- FOUND: apps/api/src/servicos/idempotencia.ts
- FOUND: apps/api/src/servicos/dto-solicitacao.ts
- FOUND: apps/api/src/rotas/integracao-solicitacoes.ts
- FOUND: apps/api/src/rotas/esquemas/integracao-solicitacoes.ts
- FOUND: apps/api/src/rotas/integracao-solicitacoes.test.ts
- FOUND commit: 1872860 (feat — Task 1)
- FOUND commit: 7e10017 (feat — Task 2)
- FOUND commit: 1f021ce (test — Task 3)
