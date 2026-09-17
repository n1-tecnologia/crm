---
phase: 01-o-crm-n1-ganha-persist-ncia-e-login
plan: 14
subsystem: api
tags: [zod, validation, cr-02, ia, colaboracao, configuracao]

# Dependency graph
requires:
  - phase: 01-o-crm-n1-ganha-persist-ncia-e-login (Plan 01-12)
    provides: "esquemas/fragmentos.ts (portão de enum bidirecional Igual<A,B>/Confere<T>, opcional()) + molde 'um arquivo por módulo, satisfies Esquemas' (tarefas.ts/automacoes.ts/financeiro.ts)"
provides:
  - "esquemas/ia.ts: IA (7 schemas de ai.ts), CHAT_ANCHOR_TYPE com Igual"
  - "esquemas/pastas-de-chat.ts: PASTAS_DE_CHAT (4 schemas de chat-folders.ts)"
  - "esquemas/construtor-de-agentes.ts: CONSTRUTOR_DE_AGENTES (2 schemas de agent-builder.ts), AGENT_DRAFT"
  - "esquemas/configuracao.ts: CONFIGURACAO (14 schemas de configuration.ts), FIELD_TYPE/FEATURE com Igual"
  - "esquemas/colaboracao.ts: COLABORACAO (9 schemas de collaboration.ts), DEPENDENCY_KIND/MEDIA_TYPE/RECURRENCE_RULE com Igual"
  - "36/36 operações de IA/pastas de chat/construtor de Agentes/configuração/colaboração com schema próprio, provado contra os call sites reais de apps/web — ainda não compostas em ESQUEMAS (Plan 01-16)"
affects: [esquemas-01-16, rotas-api]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mesmo molde de 01-12/01-13 (fragmentos.ts → <modulo>.ts, satisfies Esquemas parcial) aplicado aos cinco módulos de IA/configuração/colaboração sem tocar em arquivo compartilhado — os três planos da onda 2 (01-13/14/15) rodam em paralelo"
    - "?: T | null (configureChatSession) vira .nullable().optional() — diferente de opcional() (que colapsa null→undefined): aqui ausente é 'não mexe' e null é 'limpa', os dois precisam sobreviver distintos"

key-files:
  created:
    - apps/api/src/rotas/esquemas/ia.ts
    - apps/api/src/rotas/esquemas/ia.test.ts
    - apps/api/src/rotas/esquemas/pastas-de-chat.ts
    - apps/api/src/rotas/esquemas/pastas-de-chat.test.ts
    - apps/api/src/rotas/esquemas/construtor-de-agentes.ts
    - apps/api/src/rotas/esquemas/construtor-de-agentes.test.ts
    - apps/api/src/rotas/esquemas/configuracao.ts
    - apps/api/src/rotas/esquemas/configuracao.test.ts
    - apps/api/src/rotas/esquemas/colaboracao.ts
    - apps/api/src/rotas/esquemas/colaboracao.test.ts
  modified: []

key-decisions:
  - "PERS-04 NÃO marcado como requisito concluído nesta rodada — a composição final (ESQUEMAS satisfies EsquemasCompletos, remoção do fallback) é do Plan 01-16, instrução explícita do orquestrador para os planos da onda 2"
  - "createChatFolder ganha schema .strict() próprio ({ name: z.string() }) — o caso (q) de operacoes.test.ts (name: 123 hoje estoura TypeError dentro da operação, mapeado para 400) passa a cair no schema, ANTES de executar(); a retirada do mapeamento TypeError→400 e o reapontamento do caso (q) ficam para o Plan 01-16, como o plano instrui"

patterns-established: []

requirements-completed: []

# Metrics
duration: 40min
completed: 2026-09-17
---

# Phase 01 Plan 14: esquemas/ia.ts + pastas-de-chat.ts + construtor-de-agentes.ts + configuracao.ts + colaboracao.ts (CR-02, onda 2/3, rodada 2/5) Summary

**Schema próprio para os 36 casos de uso de IA/Chat (`ai.ts` 7, `chat-folders.ts` 4, `agent-builder.ts` 2) e de configuração/colaboração de Tarefas (`configuration.ts` 14, `collaboration.ts` 9) — tupla dos argumentos por operação, objetos `.strict()`, `ChatAnchor["type"]`/`FieldType`/`keyof EnabledFeatures`/`DependencyKind`/`Attachment["mediaType"]` fechados nos dois sentidos por `Igual<A,B>` — cada um provado contra as formas literais que `apps/web` envia hoje, inclusive `AgentDraft` (4 níveis) e `RecurrenceRule` (com `copies` aninhado).**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-09-17T13:14Z (aprox.)
- **Completed:** 2026-09-17T13:20Z (aprox.)
- **Tasks:** 2/2
- **Files modified:** 10 (todos novos)

## Accomplishments

- `esquemas/ia.ts` (novo): `IA` com as 7 operações de `ai.ts` — `decideApproval`, `publishAutomation`, `restoreAgent`, `restoreAutomation`, `createChatSession`, `configureChatSession`, `sendChatMessage`. `CHAT_ANCHOR_TYPE` (9 membros, lida a união inteira até `knowledgeDocument`) fechado por `Confere<[Igual<...>]>` contra `ChatAnchor["type"]` do domínio. `configureChatSession` usa `.nullable().optional()` em vez de `opcional()` — `folderId`/`skillId`/`chosenModelId`/`mainAgentId`/`anchor` são `?: T | null`, onde ausente ("não mexe") e `null` ("limpa") precisam permanecer distintos, diferente do parâmetro posicional opcional no fim de uma assinatura.
- `esquemas/pastas-de-chat.ts` (novo): `PASTAS_DE_CHAT` com as 4 operações de `chat-folders.ts` — `createChatFolder`, `renameChatFolder`, `deleteChatFolder`, `moveChatSessionToFolder`. `createChatFolder: z.tuple([z.object({ name: z.string() }).strict()])` — `{ name: 123 }` cai no schema, o caso (q) de `operacoes.test.ts` (hoje prova `TypeError → 400`) passa a cair ANTES de `executar()`; o Plan 01-16 retira o mapeamento e reaponta o caso. `moveChatSessionToFolder` usa `ID.nullable()` (não `opcional()`) — `null` é "raiz", valor de domínio.
- `esquemas/construtor-de-agentes.ts` (novo): `CONSTRUTOR_DE_AGENTES` com `createAgent` e `publishAgentVersion`. `AGENT_DRAFT` espelha as 9 chaves de `AgentDraft` — a forma mais funda do registro (`knowledgeSources[].kind`, 4 níveis de aninhamento). `responseFormat`, `knowledgeSources[].kind` e `accessPoints[]` fechados por `Confere<[Igual<...>, Igual<...>, Igual<...>]>` (3 conferências).
- `esquemas/configuracao.ts` (novo): `CONFIGURACAO` com as 14 operações de `configuration.ts` — Definições de Campo, Status, Tipos de Tarefa e Funcionalidades. `FIELD_TYPE` (18 membros, até `formula`) e `FEATURE` (12 chaves de `EnabledFeatures`, até `compartilhamentoPublico`) fechados por `Igual` nos dois sentidos. `setContainerFeature` usa `z.boolean().nullable()` — `null` é "herdar", valor de domínio.
- `esquemas/colaboracao.ts` (novo): `COLABORACAO` com as 9 operações de `collaboration.ts` — dependências, tempo, anexos, recorrência. `DEPENDENCY_KIND` (3), `MEDIA_TYPE` (9, até `other`) e `RECURRENCE_RULE` (inclusive `copies.fieldValuesExcept`, o maior vetor de `jsonb` malformado fora do CRM) fechados. `setRecurrence` usa `RECURRENCE_RULE.nullable()` — `null` é "sem recorrência".
- Cinco arquivos de teste puros (`ia.test.ts`, `pastas-de-chat.test.ts`, `construtor-de-agentes.test.ts`, `configuracao.test.ts`, `colaboracao.test.ts`): caso (a) cobertura (`Object.keys(X).sort()` contra a lista literal de `registro.ts`), caso (b) formas literais do web via `viaJson` (imita `JSON.parse(JSON.stringify(...))` do transporte), caso (c) formas hostis (`title` numérico, `type` de Âncora fora da lista, `responseFormat: "xml"`, `type` de Campo fora da lista, `category` fora da lista, funcionalidade desconhecida, `mediaType: "exe"`, `frequency: "quinzenal"`, `copies` faltando ou incompleto, chave desconhecida em `copies`) — todas com `success === false`. As formas do caso (b) foram lidas diretamente dos call sites reais: `ia/aprovacoes/page.tsx`, `ia/automacoes/[automacao]/page.tsx`, `configuracoes/lixeira/page.tsx`, `page.tsx`, `ia/chat/page.tsx`, `ia/chat/[sessao]/page.tsx`, `chat-folder-dialogs.tsx`, `app-shell.tsx`, `agent-builder.tsx`, `configuration-editors.tsx`, `configuracoes/campos/page.tsx`, `collaboration-editors.tsx`.
- `npm run check` verde nos três workspaces (dominio 253, web 53, api 145 — os 25 arquivos de teste do workspace, incluindo persistência/e2e/importação ClickUp ativados por `apps/api/.env`); `git diff --quiet` contra `esquemas-de-argumentos.ts`, `operacoes.ts`, `packages/dominio` e `apps/web` confirma que nenhum desses arquivos mudou — nem `ESQUEMAS` nem a rota, como o plano exige.

## Task Commits

Each task was committed atomically:

1. **Task 1: `esquemas/ia.ts`, `pastas-de-chat.ts`, `construtor-de-agentes.ts` (13 schemas) com testes puros** - `738778f` (feat)
2. **Task 2: `esquemas/configuracao.ts` (14) + `esquemas/colaboracao.ts` (9) com testes puros** - `a60ac4b` (feat)

**Plan metadata:** commit pendente (este SUMMARY + STATE.md + ROADMAP.md)

## Files Created/Modified

- `apps/api/src/rotas/esquemas/ia.ts` - `IA` (7), `CHAT_ANCHOR_TYPE`/`CHAT_ANCHOR`/`CREATE_CHAT_SESSION_INPUT`/`CONFIGURE_CHAT_SESSION_INPUT` locais, `_EnumsCompletos`
- `apps/api/src/rotas/esquemas/ia.test.ts` - casos (a)/(b)/(c)
- `apps/api/src/rotas/esquemas/pastas-de-chat.ts` - `PASTAS_DE_CHAT` (4)
- `apps/api/src/rotas/esquemas/pastas-de-chat.test.ts` - casos (a)/(b)/(c), inclusive o caso (q) de `operacoes.test.ts`
- `apps/api/src/rotas/esquemas/construtor-de-agentes.ts` - `CONSTRUTOR_DE_AGENTES` (2), `AGENT_DRAFT` local, `_EnumsCompletos` (3 conferências)
- `apps/api/src/rotas/esquemas/construtor-de-agentes.test.ts` - casos (a)/(b)/(c), `AgentDraft` literal de `agent-builder.tsx`
- `apps/api/src/rotas/esquemas/configuracao.ts` - `CONFIGURACAO` (14), `FIELD_TYPE`/`FEATURE`/`FOLDER_OU_LIST`/`CREATE_FIELD_DEFINITION_INPUT`/`UPDATE_FIELD_DEFINITION_INPUT`/`ADD_STATUS_INPUT`/`UPDATE_STATUS_INPUT`/`CREATE_TASK_TYPE_INPUT` locais, `_EnumsCompletos` (2)
- `apps/api/src/rotas/esquemas/configuracao.test.ts` - casos (a)/(b)/(c)
- `apps/api/src/rotas/esquemas/colaboracao.ts` - `COLABORACAO` (9), `DEPENDENCY_KIND`/`MEDIA_TYPE`/`RECURRENCE_COPIES`/`RECURRENCE_RULE`/`ADD_TIME_ENTRY_INPUT`/`ATTACH_FILE_INPUT` locais, `_EnumsCompletos` (4)
- `apps/api/src/rotas/esquemas/colaboracao.test.ts` - casos (a)/(b)/(c)

## Decisions Made

Ver `key-decisions` no frontmatter.

## Deviations from Plan

None — plano executado como escrito. Todas as formas do caso (b) foram confirmadas contra o código real dos call sites listados no `<read_first>` antes de escrever o teste (nenhuma forma inventada); a forma máxima de `RecurrenceRule` (`weekDays`, `endsOn`, `businessDays`, `defaultAssigneeMemberId`, `copies.fieldValuesExcept`) não tem um único call site que use todas as chaves ao mesmo tempo em `collaboration-editors.tsx` (o editor só expõe `frequency`/`interval`/`triggerMode`/`endsAfter`/`copies`), então foi montada como literal sintético a partir do tipo `RecurrenceRule` do domínio — o comportamento pedido pelo plano (`<behavior>`) explicitamente pede essa forma combinada para provar o schema, não uma citação literal de tela.

## Issues Encountered

None.

## User Setup Required

None - nenhuma configuração de serviço externo. Nenhuma dependência nova.

## Next Phase Readiness

- 36/36 operações de IA/pastas de chat/construtor de Agentes/configuração/colaboração com schema próprio, drift de aridade/tipo/enum barrado em compilação, formas do web provadas caso a caso — pronto para o Plan 01-16 compor (`{ ...TAREFAS, ...AUTOMACOES, ...FINANCEIRO, ...NEGOCIOS, ...CONVERSAS, ...CONTATOS, ...IA, ...PASTAS_DE_CHAT, ...CONSTRUTOR_DE_AGENTES, ...CONFIGURACAO, ...COLABORACAO, ... }`).
- Roda em paralelo com 01-13 (negócios/conversas/contatos) e 01-15 (planejamento, escala, membros, estrutura) — nenhum dos três tocou `esquemas-de-argumentos.ts`, `operacoes.ts`, `packages/dominio` ou `apps/web`, confirmado por `git diff --quiet`.
- `createChatFolder` já tem `{ name: z.string() }.strict()` pronto para o Plan 01-16 reapontar o caso (q) de `operacoes.test.ts` e retirar o mapeamento `TypeError → 400` — a prova por HTTP fica para lá, como o plano instrui.
- CR-02 (efeito 2) permanece parcialmente aberto até 01-15 e 01-16 fecharem; PERS-04 continua com a mesma ressalva de `01-VERIFICATION.md`.

---
*Phase: 01-o-crm-n1-ganha-persist-ncia-e-login*
*Completed: 2026-09-17*

## Self-Check: PASSED

Todos os 10 arquivos de `files_modified` e este SUMMARY existem em disco; os dois hashes de commit (`738778f`, `a60ac4b`) existem em `git log`.
