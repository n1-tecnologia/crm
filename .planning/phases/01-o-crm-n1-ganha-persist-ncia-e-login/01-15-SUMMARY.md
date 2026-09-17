---
phase: 01-o-crm-n1-ganha-persist-ncia-e-login
plan: 15
subsystem: api
tags: [zod, validation, cr-02, planejamento, escala, membros, estrutura]

# Dependency graph
requires:
  - phase: 01-o-crm-n1-ganha-persist-ncia-e-login (Plan 01-12)
    provides: "esquemas/fragmentos.ts (portão de enum bidirecional Igual<A,B>/Confere<T>, opcional()) + molde 'um arquivo por módulo, satisfies Esquemas' (tarefas.ts/automacoes.ts/financeiro.ts)"
provides:
  - "esquemas/planejamento.ts: PLANEJAMENTO (11 schemas de planning.ts)"
  - "esquemas/escala.ts: ESCALA (14 schemas de scale.ts), VIEW_FILTERS/GOAL_INPUT/GOAL_INPUT_PARCIAL/FORM_INPUT/FORM_INPUT_PARCIAL fechados"
  - "esquemas/membros.ts: MEMBROS (5 schemas de members.ts), inviteMember com .strip() (T-1-08), PERMISSION_ACTION com Igual"
  - "esquemas/estrutura.ts: ESTRUTURA (3 schemas de structure.ts), STATUS_SET/STATUS_DEFINITION/FIELD_REQUIREMENT fechados"
  - "33/33 operações de planejamento/escala/membros/estrutura com schema próprio, provado contra os call sites reais de apps/web e as duas reproduções literais do verificador — ainda não compostas em ESQUEMAS (Plan 01-16)"
affects: [esquemas-01-16, rotas-api]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mesmo molde de 01-12/01-13/01-14 (fragmentos.ts → <modulo>.ts, satisfies Esquemas parcial) aplicado aos quatro últimos módulos do domínio sem tocar em arquivo compartilhado — os três planos da onda 2 (01-13/14/15) rodaram em paralelo"
    - "GOAL_INPUT_PARCIAL e FORM_INPUT_PARCIAL escritos por extenso (nunca .partial()) — .strict() explícito em cada campo opcional, comprovado pelo caso 'updateGoal com lixo continua caindo'"
    - "O único .strip() da pasta (inviteMember, membros.ts) documentado com comentário-bloco citando T-1-08 — duas barreiras independentes (schema da rota + SERVICOS.inviteMember em operacoes.ts), nenhuma removida"

key-files:
  created:
    - apps/api/src/rotas/esquemas/planejamento.ts
    - apps/api/src/rotas/esquemas/planejamento.test.ts
    - apps/api/src/rotas/esquemas/escala.ts
    - apps/api/src/rotas/esquemas/escala.test.ts
    - apps/api/src/rotas/esquemas/membros.ts
    - apps/api/src/rotas/esquemas/membros.test.ts
    - apps/api/src/rotas/esquemas/estrutura.ts
    - apps/api/src/rotas/esquemas/estrutura.test.ts
  modified: []

key-decisions:
  - "PERS-04 NÃO marcado como requisito concluído nesta rodada — a composição final (ESQUEMAS satisfies EsquemasCompletos, remoção do fallback) é do Plan 01-16, instrução explícita do orquestrador para os planos da onda 2"
  - "inviteMember ganha entrada em ESQUEMAS com .strip() (não .strict()) — a MESMA forma que SERVICOS.inviteMember (operacoes.ts) já valida; operacoes.ts não foi editado, a segunda barreira é redundante de propósito (T-1-08 não depende de uma via só)"
  - "GOAL_INPUT_PARCIAL/FORM_INPUT_PARCIAL escritos por extenso, não via .partial() — .partial() deixaria .strict() implícito e menos legível na leitura do diff; a escrita explícita é o que o teste '(c) updateGoal com lixo' prova"

patterns-established: []

requirements-completed: []

# Metrics
duration: 35min
completed: 2026-09-17
---

# Phase 01 Plan 15: esquemas/planejamento.ts + esquemas/escala.ts + esquemas/membros.ts + esquemas/estrutura.ts (CR-02, onda 2/3, rodada 2/5) Summary

**Schema próprio para os 33 casos de uso de planejamento (`planning.ts` 11), escala (`scale.ts` 14), Membros (`members.ts` 5) e estrutura (`structure.ts` 3) — tupla dos argumentos por operação, objetos `.strict()` (exceto `inviteMember`, o único `.strip()` da pasta), `View["kind"]`/`Goal["kind"]`/`PermissionAction`/enums de `Goal["measure"]` fechados nos dois sentidos por `Igual<A,B>` — as DUAS formas hostis que o verificador reproduziu contra `ARGUMENTOS_GENERICOS` (`createGoal` com `kind: 42` + `anchor.lixo`, `saveView` com `filters` arbitrário) agora caem em teste puro.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-09-17T12:57Z (aprox., em paralelo com 01-13/01-14)
- **Completed:** 2026-09-17T13:28Z
- **Tasks:** 2/2
- **Files modified:** 8 (todos novos)

## Accomplishments

- `esquemas/planejamento.ts` (novo): `PLANEJAMENTO` com as 11 operações de `planning.ts` — `setMemberCapacity`, `enableSprints`, `disableSprints`, `createNextSprint`, `closeSprint`, `saveListAsTemplate`, `saveTaskAsTemplate`, `instantiateTaskTemplate`, `instantiateListTemplate`, `renameTemplate`, `setTemplateArchived`. Sem enum nomeado — sem `_EnumsCompletos`, como o plano instrui.
- `esquemas/escala.ts` (novo): `ESCALA` com as 14 operações de `scale.ts` — Visualizações salvas, Metas, Formulários, compartilhamento público. `VIEW_FILTERS` `.strict()` é exatamente o que o verificador reproduziu com `filters: { qualquer: … }`; `GOAL_INPUT`/`GOAL_INPUT_PARCIAL` e `FORM_INPUT`/`FORM_INPUT_PARCIAL` escritos por extenso (nunca `.partial()`) para manter o `.strict()` inequívoco; `FORM_QUESTION_TARGET` como `z.discriminatedUnion("kind", …)`. `View["kind"]`, `View["groupBy"]`, `Goal["kind"]`, `Goal["measure"]["scopeType"]` e `Goal["measure"]["aggregation"]` fechados por `Confere<[Igual<...>, ...]>` (5 conferências). As duas formas hostis do verificador (`createGoal` com `kind: 42` + `anchor.lixo`, `saveView` com `filters: { qualquer: { coisa: true } }`) provadas com `success === false`, mais três variações (só `kind: 42`, só `anchor.lixo`, `saveView` com `kind` fora do enum).
- `esquemas/membros.ts` (novo): `MEMBROS` com as 5 operações de `members.ts` — `removeMember`, `transferWorkspaceOwnership`, `inviteMember`, `deleteRole`, `grantGovernanceAccess`. `PERMISSION_ACTION` (7 membros, até `executar`) fechado por `Confere<[Igual<...>]>`. `inviteMember: z.tuple([z.object({ email: z.string(), roleId: ID }).strip()])` — o ÚNICO objeto `.strip()` da pasta, com comentário-bloco citando T-1-08: a mesma forma que `SERVICOS.inviteMember` (`operacoes.ts`, não editado) já valida — duas barreiras independentes, nenhuma removida.
- `esquemas/estrutura.ts` (novo): `ESTRUTURA` com as 3 operações de `structure.ts` — `createSpace`, `createFolder`, `createList`. `STATUS_SET`→`STATUS_DEFINITION`→`FIELD_REQUIREMENT` todos `.strict()` para o `statusSet` opcional de `createSpace`, inclusive `entryFromStatusIds`. `FieldRequirement["attribute"]` fechado por `Igual` com `NonNullable<>` dos dois lados (campo `?:` exigiu o ajuste que o plano já antecipava).
- Quatro arquivos de teste puros (`planejamento.test.ts`, `escala.test.ts`, `membros.test.ts`, `estrutura.test.ts`): caso (a) cobertura (`Object.keys(X).sort()` contra a lista literal de `registro.ts`), caso (b) formas literais do web via `viaJson` (imita `JSON.parse(JSON.stringify(...))` do transporte — `transferWorkspaceOwnership(..., keepRoleId || undefined)` chega como `[id, null]` e prova `opcional()`), caso (c) formas hostis — inclusive `membros.test.ts` com o caso "(c) inviteMember descarta userId do corpo (T-1-08)" provando `success === true` E `"userId" in data[0]` `false`. As formas do caso (b) foram lidas diretamente dos call sites reais: `configuracoes/membros/page.tsx`, `sprint-panel.tsx`, `template-dialogs.tsx`, `create-container-dialog.tsx`, `configuracoes/templates/page.tsx`, `view-bar.tsx`, `estrutura/metas/page.tsx`, `forms-editor.tsx`, `share-task-dialog.tsx`, `transfer-ownership-dialog.tsx`, `delete-role-dialog.tsx`, `governance-access-dialog.tsx`.
- `npm run check` verde nos três workspaces (dominio 253, web 53, api 159 — os 29 arquivos de teste do workspace, incluindo persistência/e2e/importação ClickUp ativados por `apps/api/.env`); `git diff --quiet` contra `esquemas-de-argumentos.ts`, `operacoes.ts`, `packages/dominio` e `apps/web` confirma que nenhum desses arquivos mudou — nem `ESQUEMAS` nem a rota, como o plano exige.

## Task Commits

Each task was committed atomically:

1. **Task 1: `esquemas/planejamento.ts` (11) + `esquemas/escala.ts` (14) com testes — as duas formas hostis do verificador caem** - `6fe6977` (feat)
2. **Task 2: `esquemas/membros.ts` (5, com `inviteMember` em `.strip()`) + `esquemas/estrutura.ts` (3) com testes** - `6f191f7` (feat)

**Plan metadata:** commit pendente (este SUMMARY + STATE.md + ROADMAP.md)

## Files Created/Modified

- `apps/api/src/rotas/esquemas/planejamento.ts` - `PLANEJAMENTO` (11), `TEMPLATE_INPUT`/`INSTANTIATE_LIST_TEMPLATE_INPUT` locais
- `apps/api/src/rotas/esquemas/planejamento.test.ts` - casos (a)/(b)/(c)
- `apps/api/src/rotas/esquemas/escala.ts` - `ESCALA` (14), `VIEW_KIND`/`VIEW_FILTERS`/`GROUP_BY`/`SORT_BY`/`SAVE_VIEW_INPUT`/`GOAL_ANCHOR`/`GOAL_KIND`/`GOAL_MEASURE`/`GOAL_INPUT`/`GOAL_INPUT_PARCIAL`/`FORM_QUESTION_TARGET`/`FORM_QUESTION`/`FORM_INPUT`/`FORM_INPUT_PARCIAL`/`SHARE_OPTIONS` locais, `_EnumsCompletos` (5 conferências)
- `apps/api/src/rotas/esquemas/escala.test.ts` - casos (a)/(b)/(c), inclusive as duas formas literais do verificador (`kind: 42`, `qualquer: { coisa: true }`)
- `apps/api/src/rotas/esquemas/membros.ts` - `MEMBROS` (5), `PERMISSION_ACTION`/`INVITE_MEMBER_INPUT` (`.strip()`)/`DELETE_ROLE_DESTINATION`/`GRANT_GOVERNANCE_ACCESS_INPUT` locais, `_EnumsCompletos`
- `apps/api/src/rotas/esquemas/membros.test.ts` - casos (a)/(b)/(c), prova do `.strip()` (T-1-08)
- `apps/api/src/rotas/esquemas/estrutura.ts` - `ESTRUTURA` (3), `FIELD_REQUIREMENT`/`STATUS_DEFINITION`/`STATUS_SET`/`CREATE_SPACE_INPUT`/`CREATE_CONTAINER_INPUT` locais, `_EnumsCompletos`
- `apps/api/src/rotas/esquemas/estrutura.test.ts` - casos (a)/(b)/(c)

## Decisions Made

Ver `key-decisions` no frontmatter.

## Deviations from Plan

None — plano executado como escrito. Duas notas de processo (não mudanças de plano):

**1.** O plano importava `opcional` de `./fragmentos` para `escala.ts`, mas nenhuma operação de `scale.ts` tem parâmetro posicional opcional no fim (todos os opcionais de `ESCALA` são campos `?:` dentro de objeto, resolvidos por `.optional()`); o import foi omitido para não deixar `opcional` sem uso — nenhuma acceptance criteria do plano exigia o import em si, só o comportamento de `opcional()` já coberto por `transferWorkspaceOwnership` em `membros.ts`.

**2.** `estrutura.ts` não usou o fragmento `CONTAINER_TYPE` (que inclui `"list"`): `parentType` de `createFolder`/`createList` é `"space" | "folder"` — um subconjunto — então ficou como `z.enum(["space", "folder"])` inline, igual ao que `planejamento.ts` faz para `instantiateListTemplate`. Import de `CONTAINER_TYPE` omitido pelo mesmo motivo do item 1.

## Issues Encountered

None.

## User Setup Required

None - nenhuma configuração de serviço externo. Nenhuma dependência nova.

## Next Phase Readiness

- 33/33 operações de planejamento/escala/Membros/estrutura com schema próprio, drift de aridade/tipo/enum barrado em compilação, formas do web provadas caso a caso, as duas reproduções literais do verificador fechadas em teste puro — pronto para o Plan 01-16 compor (`{ ...TAREFAS, ...AUTOMACOES, ...FINANCEIRO, ...NEGOCIOS, ...CONVERSAS, ...CONTATOS, ...IA, ...PASTAS_DE_CHAT, ...CONSTRUTOR_DE_AGENTES, ...CONFIGURACAO, ...COLABORACAO, ...PLANEJAMENTO, ...ESCALA, ...MEMBROS, ...ESTRUTURA }`).
- Roda em paralelo com 01-13 (negócios/conversas/contatos) e 01-14 (IA/pastas de chat/construtor de Agentes/configuração/colaboração) — nenhum dos três tocou `esquemas-de-argumentos.ts`, `operacoes.ts`, `packages/dominio` ou `apps/web`, confirmado por `git diff --quiet`.
- `inviteMember` já tem `.strip()` pronto em `ESQUEMAS` para o Plan 01-16 compor; `SERVICOS.inviteMember`/`ENTRADA_INVITE_MEMBER` em `operacoes.ts` continuam intocados — a segunda barreira de T-1-08 é aditiva.
- CR-02 (efeito 2) permanece parcialmente aberto até 01-16 fechar a composição (`ESQUEMAS satisfies EsquemasCompletos`, remoção do fallback `ARGUMENTOS_GENERICOS`, limpeza da rota). PERS-04 continua com a mesma ressalva de `01-VERIFICATION.md`.

---
*Phase: 01-o-crm-n1-ganha-persist-ncia-e-login*
*Completed: 2026-09-17*

## Self-Check: PASSED

Todos os 8 arquivos de `files_modified` e este SUMMARY existem em disco; os dois hashes de commit (`6fe6977`, `6f191f7`) existem em `git log`.
