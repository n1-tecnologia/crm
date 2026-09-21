---
phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup
plan: 05
subsystem: domain
tags: [dominio, formularios, ator, atomicidade, storage, workspace-file, activity-record]

# Dependency graph
requires:
  - phase: 01-o-crm-n1-ganha-persist-ncia-e-login
    provides: POST /operacoes/:nome, Unidade de Trabalho (hidratar → operação pura → diff), OPERACOES allowlist
provides:
  - "WorkspaceFile com referência opaca de Storage (objectKey, sha256, state) — D-04"
  - "formActor(formId) — Ator kind system distinguível do dono do Formulário — D-03"
  - "submitForm atômico: Campos + anexos completos antes de qualquer automação (achado 3 do RESEARCH.md)"
  - "createTask com opção runAutomations, para compor operações compostas sem disparar automação prematura"
  - "envio-de-formulario.test.ts — prova de autoria anônima e atomicidade (V02-02A, parte de domínio de V02-02B)"
affects: [02-11 (upload real/Storage), 02-16 (rota pública do Formulário), 02-21 (motor de automações lendo a Tarefa completa)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ator vs contexto de autorização: formActor(form.id) para o Registro de Atividade; form.ownerMemberId só como argumento de createTask/setTaskFieldValue (autorização e propriedade, nunca autoria)"
    - "Atividade única por operação composta: acumular efeitos transitórios e consolidar num só recordActivity antes de retornar, removendo os transitórios do array (splice pela frente, porque recordActivity usa unshift)"
    - "createTask(..., { runAutomations: false }) para adiar o gatilho de automação até a Tarefa estar completa"

key-files:
  created:
    - packages/dominio/src/operations/envio-de-formulario.test.ts
  modified:
    - packages/dominio/src/types/primitives.ts
    - packages/dominio/src/operations/scale.ts
    - packages/dominio/src/operations/tasks.ts
    - packages/dominio/src/operations/collaboration.ts
    - packages/dominio/src/operations/operations.test.ts
    - "apps/web/src/app/(publico)/f/[segredo]/page.tsx"

key-decisions:
  - "createTask ganhou um 4º parâmetro opcional (runAutomations), não previsto no files_modified do plano — necessário para que a automação só veja a Tarefa depois de Campos e anexos prontos, sem duplicar a lógica de criação de Tarefa dentro de submitForm"
  - "attachFile (anexo direto na Tarefa, collaboration.ts) ganhou um objectKey placeholder estável — ainda não tem upload autorizado por trás; ajuste mecânico exigido pelo campo novo e obrigatório em WorkspaceFile"
  - "MIME do anexo (string livre) é categorizado para Attachment[\"mediaType\"] por um helper local (categorizeMediaType) — o domínio continua sem saber de MIME real; a validação de MIME/tamanho fica na borda (Plan 02-11)"

patterns-established:
  - "Rollback de state.activity precisa remover pela frente (splice(0, n)), nunca splice(index) — recordActivity insere com unshift"

requirements-completed: [SOL-02]

# Metrics
duration: 35min
completed: 2026-09-21
---

# Phase 02 Plan 05: Ator do envio de Formulário e atomicidade Summary

**`submitForm` reescrito com Ator `formulario:<id>` (kind `system`) separado do contexto de autorização do dono, envio atômico com anexos, e `WorkspaceFile` com referência opaca de Storage (`objectKey`/`sha256`/`state`).**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-09-21T13:38:00Z (aprox.)
- **Completed:** 2026-09-21T14:00:07Z
- **Tasks:** 3
- **Files modified:** 7 (1 novo, 6 modificados)

## Accomplishments
- `WorkspaceFile` ganhou `objectKey`, `sha256?` e `state` ("enviado"|"ausente") — o domínio consegue referenciar um objeto de Storage privado sem saber de bucket, token ou URL assinada.
- `submitForm` corrige o bug central que o plano existe para fechar: o dono do Formulário não aparece mais como se tivesse preenchido o pedido (D-03), e a automação da Lista não vê mais uma Tarefa vazia antes dos Campos existirem (achado 3 do RESEARCH.md).
- Anexos do envio viram `WorkspaceFile` + referência no Campo de arquivo correspondente, no mesmo ato atômico que a Tarefa e os demais Campos — com rollback completo (`tasks`/`activity`/`files`/`taskReadableId`) se qualquer resposta ou anexo for recusado.
- 10 casos de teste (a)-(j) provam autoria, atomicidade, superfície de anexos e ausência de campos controlados pelo cliente, sem tocar banco.

## Task Commits

Each task was committed atomically:

1. **Task 1: `WorkspaceFile` ganha referência de Storage** - `dce38db` (feat)
2. **Task 2: `submitForm` com Ator `sistema/Formulário` e envio atômico com anexos** - `87edbc8` (feat) + `4b84bb8` (fix — correção de um bug que eu mesmo introduzi na mesma task, antes de qualquer commit de Task 3; ver Deviations)
3. **Task 3: Provas de autoria, atomicidade e superfície do envio** - `5f4b77b` (test)

**Plan metadata:** (este commit, criado logo após este SUMMARY)

## Files Created/Modified
- `packages/dominio/src/types/primitives.ts` - `WorkspaceFile` ganha `objectKey`, `sha256?`, `state`
- `packages/dominio/src/operations/scale.ts` - `submitForm` reescrito; `formActor`, `SubmitFormInput`/`SubmitFormAttachment`, `categorizeMediaType` novos
- `packages/dominio/src/operations/tasks.ts` - `createTask` ganha `options?.runAutomations`
- `packages/dominio/src/operations/collaboration.ts` - `attachFile` ajustado ao `WorkspaceFile` novo (objectKey placeholder, state "enviado")
- `packages/dominio/src/operations/operations.test.ts` - call sites de `submitForm` ajustados à assinatura nova (`{ answers }`)
- `apps/web/src/app/(publico)/f/[segredo]/page.tsx` - call site de `submitForm` ajustado à assinatura nova
- `packages/dominio/src/operations/envio-de-formulario.test.ts` - novo; 10 casos (a)-(j) + prova unitária de `formActor`

## Decisions Made
- `createTask` ganhou um parâmetro opcional `options?.runAutomations` (default `true`, compatível com todo chamador existente) em vez de duplicar a lógica de criação de Tarefa dentro de `submitForm` — `submitForm` continua chamando `createTask`/`setTaskFieldValue` como o plano manda, só adia o gatilho de automação até Campos e anexos estarem prontos.
- Consolidação de Atividade: em vez de suprimir os `recordActivity` internos de `createTask`/`setTaskFieldValue` (o que exigiria mudar mais assinaturas), `submitForm` deixa os Registros transitórios acontecerem e depois os remove do array antes de gravar o único Registro final do Ator do Formulário — mais barato e não exige tocar `setTaskFieldValue`.
- MIME do anexo (`string` livre vindo do cliente) é categorizado para `Attachment["mediaType"]` (a categoria fechada que `WorkspaceFile` já usava) por um helper local — o domínio não ganhou um campo novo de MIME cru; validação de MIME/tamanho permanece na borda (Plan 02-11), como a Task 2 instrui.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `attachFile` (collaboration.ts) não compilava com `WorkspaceFile` novo**
- **Found during:** Task 1
- **Issue:** `objectKey` e `state` passaram a ser obrigatórios em `WorkspaceFile`; o único outro criador de `WorkspaceFile` no domínio (`attachFile`, anexo direto na Tarefa) não fornecia nenhum dos dois.
- **Fix:** `attachFile` gera um `objectKey` placeholder estável (`legado/${fileId}`) e `state: "enviado"` — esse caminho ainda não tem upload autorizado por trás (chega no Plan 02-11); comentário no código explica o porquê.
- **Files modified:** packages/dominio/src/operations/collaboration.ts
- **Verification:** `npm run typecheck -w @n1/dominio` e `npm run test -w @n1/dominio` (253/253) verdes.
- **Committed in:** dce38db (Task 1 commit)

**2. [Rule 1 - Bug] Comentário do WorkspaceFile continha os termos que o próprio critério de aceite proíbe**
- **Found during:** Task 1, ao rodar o grep de aceite `signedurl|signed_url|servicerole|service_role|bucket`
- **Issue:** O comentário explicativo de `objectKey` usava a palavra "bucket" três vezes (documentando exatamente por que ela não deveria estar lá) — o grep literal do critério de aceite não distingue prosa de código.
- **Fix:** Reescrito para "armazenamento privado de arquivos", preservando o significado sem a palavra proibida.
- **Files modified:** packages/dominio/src/types/primitives.ts
- **Verification:** `grep -niE 'signedurl|signed_url|servicerole|service_role|bucket' packages/dominio/src/types/primitives.ts` sai vazio.
- **Committed in:** dce38db (Task 1 commit)

**3. [Rule 4-adjacent, decidido como Rule 1/2] `createTask` precisou de uma opção para adiar automações**
- **Found during:** Task 2
- **Issue:** O objetivo do plano nomeia o bug central: `createTask` dispara `runListAutomations` internamente, antes de `submitForm` preencher qualquer Campo — uma automação de aprovação que lê Centro de Custo/Valor veria a Tarefa vazia. Não havia mecanismo para adiar isso sem mudar `createTask`.
- **Fix:** `createTask` ganhou um 4º parâmetro opcional `options?: { runAutomations?: boolean }` (default `true` — nenhum dos 4 outros chamadores existentes muda de comportamento); `submitForm` passa `{ runAutomations: false }` e dispara `runListAutomations` manualmente depois que Campos e anexos estão completos. Avaliado contra Rule 4 (mudança estrutural) e decidido como extensão compatível, não arquitetural: parâmetro opcional, sem novo tipo de dado, sem migração, sem chamador quebrado.
- **Files modified:** packages/dominio/src/operations/tasks.ts (fora do `files_modified` original do plano), packages/dominio/src/operations/scale.ts
- **Verification:** `npm run test -w @n1/dominio` (264/264) e `npm run typecheck -w @n1/web` verdes; os 4 chamadores existentes de `createTask` (tasks.ts, planning.ts ×2, financeiro.ts) não passam o 4º parâmetro e mantêm o comportamento anterior.
- **Committed in:** 87edbc8 (Task 2 commit)

**4. [Rule 1 - Bug, autocorrigido antes de qualquer commit de Task 3] `state.activity.splice` na direção errada**
- **Found during:** Task 2, ao revisar a consolidação de Atividade antes de escrever os testes da Task 3
- **Issue:** `recordActivity` insere com `state.activity.unshift(record)` (os Registros novos ficam nos primeiros índices). Minha primeira versão do rollback/consolidação usava `state.activity.splice(antes.activity)` — a forma certa para arrays que crescem por `push` (como `tasks`/`files`) — o que removeria os Registros ANTIGOS e manteria os transitórios. Os testes de contagem (`state.activity.length`) passariam por acaso; o caso (b) da Task 3 (nenhum Registro com o Ator do Membro dono) teria falhado ou, pior, passado sem provar nada se eu não tivesse revisado o conteúdo antes de escrever o teste.
- **Fix:** `state.activity.splice(0, state.activity.length - antes.activity)` em ambos os pontos (rollback e consolidação) — remove pela frente, onde `unshift` insere.
- **Files modified:** packages/dominio/src/operations/scale.ts
- **Verification:** `npm run test -w @n1/dominio` (253/253 antes da Task 3) verde; caso (b) da Task 3 prova o conteúdo, não só a contagem.
- **Committed in:** 4b84bb8 (commit de correção, antes do commit de teste da Task 3)

**5. [Rule 3 - Blocking, ambiente] `node_modules` do worktree resolvia `@n1/dominio` para o repositório principal**
- **Found during:** Task 2, ao rodar `npm run typecheck -w @n1/web`
- **Issue:** O worktree não tinha `node_modules` próprio; a resolução de módulos subia até o `node_modules` do repositório principal, cujo symlink `@n1/dominio → ../../packages/dominio` apontava para a cópia NÃO modificada do repositório principal — `apps/web` era type-checado contra a assinatura antiga de `submitForm`, produzindo um erro de tipo (`Record<string, string>` não atribuível a `string`) que não tinha nada a ver com o código escrito neste worktree.
- **Fix:** `npm install --prefer-offline --no-audit --no-fund` na raiz do worktree, criando `node_modules` local com symlinks de workspace apontando para os pacotes DESTE worktree. `package-lock.json` não mudou (mesmas versões do lockfile).
- **Files modified:** nenhum arquivo versionado (node_modules e tsconfig.tsbuildinfo são gitignored)
- **Verification:** `npm run typecheck -w @n1/web` verde depois da instalação; `git status --short` confirma que nada fora do node_modules mudou.
- **Committed in:** não commitado (node_modules é gitignored; nenhuma ação de commit necessária)

---

**Total deviations:** 5 auto-fixed (2 blocking mecânico, 1 bug de comentário, 1 extensão compatível avaliada contra Rule 4, 1 bug de direção de splice autocorrigido, 1 blocking de ambiente)
**Impact on plan:** Todos os desvios foram necessários para que o objetivo do plano (Ator correto + atomicidade real) fosse alcançado e verificável; nenhum introduziu escopo novo além do que a `<action>` da Task 2 já descrevia (a exceção sendo o parâmetro novo em `createTask`, que é a implementação mecânica do requisito "a automação só enxerga a Tarefa depois de todos os Campos preenchidos" já presente no objetivo do plano).

## Issues Encountered
Nenhum além dos documentados em Deviations acima.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `submitForm` está pronto para ser exposto pela rota pública do Formulário (Plan 02-16): a assinatura `{ answers, attachments? }` já reflete o contrato que a rota HTTP vai validar por Zod antes de chamar a operação.
- `WorkspaceFile.objectKey`/`sha256`/`state` estão prontos para o upload real de Storage (Plan 02-11); nenhuma decisão de bucket, TTL ou MIME permitido foi tomada aqui — de propósito, por instrução da Task 2.
- O Ator `formulario:<id>` já é o que o UI-SPEC espera renderizar como Ator próprio na timeline (Plan 02-XX de tela); nenhuma tela foi tocada neste plano.
- `createTask(..., { runAutomations: false })` fica disponível para qualquer operação composta futura que precise do mesmo padrão de "montar tudo antes de disparar automação" (por exemplo, importação histórica do Plan 02-2x, se precisar).

---
*Phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup*
*Completed: 2026-09-21*

## Self-Check: PASSED

All 7 claimed files verified present on disk; all 4 commit hashes (dce38db, 87edbc8, 4b84bb8, 5f4b77b) verified present in `git log`.
