---
phase: 01-o-crm-n1-ganha-persist-ncia-e-login
plan: 13
subsystem: api
tags: [zod, validation, cr-02, crm]

# Dependency graph
requires:
  - phase: 01-o-crm-n1-ganha-persist-ncia-e-login (Plan 01-12)
    provides: "esquemas/fragmentos.ts (portão de enum bidirecional Igual<A,B>/Confere<T>, opcional()) + molde 'um arquivo por módulo, satisfies Esquemas' (tarefas.ts/automacoes.ts/financeiro.ts)"
provides:
  - "esquemas/negocios.ts: NEGOCIOS (12 schemas de deals.ts), DEAL_CONTACT_ROLE com Igual"
  - "esquemas/conversas.ts: CONVERSAS (11 schemas de conversations.ts), SEND_MESSAGE_INPUT"
  - "esquemas/contatos.ts: CONTATOS (17 schemas de contacts.ts), CONTACT_IDENTIFIER_TYPE e COMPANY_IDENTIFIER_TYPE com Igual, IMPORT_ROW"
  - "40/40 operações do CRM (deals/conversations/contacts) com schema próprio, provado contra os call sites reais de apps/web — ainda não compostas em ESQUEMAS (Plan 01-16)"
affects: [esquemas-01-16, rotas-api]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mesmo molde de 01-12 (fragmentos.ts → <modulo>.ts, satisfies Esquemas parcial) aplicado aos três módulos do CRM sem tocar em arquivo compartilhado — os três planos da onda 2 (01-13/14/15) rodam em paralelo"
    - "Import de Confere/Igual como type-only (import { ..., type Confere, type Esquemas, type Igual } from \"./fragmentos\") quando o arquivo de módulo declara seu próprio _EnumsCompletos — necessário porque isolatedModules não infere automaticamente"

key-files:
  created:
    - apps/api/src/rotas/esquemas/negocios.ts
    - apps/api/src/rotas/esquemas/negocios.test.ts
    - apps/api/src/rotas/esquemas/conversas.ts
    - apps/api/src/rotas/esquemas/conversas.test.ts
    - apps/api/src/rotas/esquemas/contatos.ts
    - apps/api/src/rotas/esquemas/contatos.test.ts
  modified: []

key-decisions:
  - "PERS-04 NÃO marcado como requisito concluído nesta rodada — a composição final (ESQUEMAS satisfies EsquemasCompletos, remoção do fallback) é do Plan 01-16, instrução explícita do orquestrador para os planos da onda 2"
  - "Import de Confere/Igual marcado type-only (não estava em nenhum arquivo de módulo anterior, só em fragmentos.ts) — necessário para negocios.ts e contatos.ts, que declaram _EnumsCompletos próprio; conversas.ts não precisou (nenhum enum nomeado novo, o kind de ACTOR_REF já é conferido em fragmentos.ts)"

patterns-established: []

requirements-completed: []

# Metrics
duration: 20min
completed: 2026-09-17
---

# Phase 01 Plan 13: esquemas/negocios.ts + esquemas/conversas.ts + esquemas/contatos.ts (CR-02, onda 2/3, rodada 2/5) Summary

**Schema próprio para os 40 casos de uso do CRM (`deals.ts` 12, `conversations.ts` 11, `contacts.ts` 17) — tupla dos argumentos por operação, objetos `.strict()`, `DEAL_CONTACT_ROLE`/`CONTACT_IDENTIFIER_TYPE`/`COMPANY_IDENTIFIER_TYPE` fechados nos dois sentidos por `Igual<A,B>` — cada um provado contra as formas literais que `apps/web` envia hoje em 24 arquivos diferentes.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-09-17T13:01Z (aprox.)
- **Completed:** 2026-09-17T13:21Z (aprox.)
- **Tasks:** 2/2
- **Files modified:** 6 (todos novos)

## Accomplishments

- `esquemas/negocios.ts` (novo): `NEGOCIOS` com as 12 operações de `deals.ts` — `moveDealToStage`, `winDeal`, `loseDeal`, `reopenDeal`, `linkContactToDeal`, `removeStage`, `migrateDealsToFunnel`, `restoreDeal`, `moveDealToFunnel`, `createDeal`, `unlinkContactFromDeal`, `setDealFieldValue`. `DEAL_CONTACT_ROLE` (6 membros) fechado por `Confere<[Igual<...>]>` contra `DealContactRole` do domínio — prova negativa executada (remover `"outro"` quebra `npm run typecheck -w @n1/api` na linha do portão) e desfeita.
- `esquemas/conversas.ts` (novo): `CONVERSAS` com as 11 operações de `conversations.ts` — `sendMessage`, `resolveConversation`, `reopenConversation`, `assignConversation`, `trashConversation`, `moveConversationToContact`, `discardDraft`, `restoreConversation`, `startConversation`, `toggleConversationStar`, `markConversationRead`. `receiveMessage` fica de fora de propósito: não é operação de Membro (sem `actingMemberId` como segundo parâmetro) e não está em `OPERACOES`. Sem enum nomeado novo — `kind` de `ACTOR_REF` já conferido em `fragmentos.ts`.
- `esquemas/contatos.ts` (novo): `CONTATOS` com as 17 operações de `contacts.ts`, inclusive `importContacts` — o maior vetor de `jsonb` malformado do CRM, com `IMPORT_ROW`/`IMPORT_OPTIONS` `.strict()`. `CONTACT_IDENTIFIER_TYPE` (7 membros, lida a união inteira até `perfilDeTikTok`) e `COMPANY_IDENTIFIER_TYPE` (3 membros) fechados por `Confere<[Igual<...>, Igual<...>]>`.
- Três arquivos de teste puros (`negocios.test.ts`, `conversas.test.ts`, `contatos.test.ts`): caso (a) cobertura (`Object.keys(X).sort()` contra a lista literal de `registro.ts`), caso (b) formas literais do web via `viaJson` (imita `JSON.parse(JSON.stringify(...))` do transporte — `undefined` posicional vira `null` e volta a `undefined` em `moveDealToFunnel`, `assignConversation`, `setContactCatalogValue`), caso (c) formas hostis (`funnelId` numérico, `role` fora da lista, `onCollision: "ignorar"`, `type` de Identificador fora da lista, chave desconhecida) — todas com `success === false`. As formas do caso (b) foram lidas diretamente dos call sites reais: `deal-screen.tsx`, `create-record-dialog.tsx`, `conversation-thread.tsx`, `caixa-de-entrada/[conversa]/page.tsx`, `move-conversation-dialog.tsx`, `contatos/[contato]/page.tsx`, `empresas/[empresa]/page.tsx`, `import-contacts-dialog.tsx`, `contact-card.tsx`, `configuracoes/lixeira/page.tsx`, entre outros.
- `npm run check` verde nos três workspaces (dominio 253, web 53, api 130 — os 20 arquivos de teste do workspace, incluindo persistência/e2e/importação ClickUp ativados por `apps/api/.env`); `git diff --quiet` contra `esquemas-de-argumentos.ts`, `operacoes.ts`, `packages/dominio` e `apps/web` confirma que nenhum desses arquivos mudou — nem `ESQUEMAS` nem a rota, como o plano exige.

## Task Commits

Each task was committed atomically:

1. **Task 1: `esquemas/negocios.ts` + `esquemas/conversas.ts` (23 schemas) com testes puros** - `949d50a` (feat)
2. **Task 2: `esquemas/contatos.ts` (17 schemas) com teste puro** - `9718fd6` (feat)

**Plan metadata:** commit pendente (este SUMMARY + STATE.md + ROADMAP.md)

## Files Created/Modified

- `apps/api/src/rotas/esquemas/negocios.ts` - `NEGOCIOS` (12), `DEAL_CONTACT_ROLE`, `WIN_DEAL_INPUT`/`LOSE_DEAL_INPUT`/`CREATE_DEAL_INPUT` locais, `_EnumsCompletos`
- `apps/api/src/rotas/esquemas/negocios.test.ts` - casos (a)/(b)/(c), tabela `FORMAS_DO_WEB`
- `apps/api/src/rotas/esquemas/conversas.ts` - `CONVERSAS` (11), `SEND_MESSAGE_INPUT` local
- `apps/api/src/rotas/esquemas/conversas.test.ts` - casos (a)/(b)/(c)
- `apps/api/src/rotas/esquemas/contatos.ts` - `CONTATOS` (17), `CONTACT_IDENTIFIER_TYPE`/`COMPANY_IDENTIFIER_TYPE`/`IMPORT_ROW`/`IMPORT_OPTIONS`/`CREATE_CONTACT_INPUT`/`CREATE_COMPANY_INPUT`/`LINK_CONTACT_TO_COMPANY_INPUT` locais, `_EnumsCompletos`
- `apps/api/src/rotas/esquemas/contatos.test.ts` - casos (a)/(b)/(c)

## Decisions Made

Ver `key-decisions` no frontmatter.

## Deviations from Plan

None — plano executado como escrito. Todas as formas do caso (b) foram confirmadas contra o código real dos call sites listados no `<read_first>` antes de escrever o teste (nenhuma forma inventada); a prova negativa do portão de enum (remover `"outro"` de `DEAL_CONTACT_ROLE`) foi executada e desfeita, confirmando `TS2344` na linha exata de `_EnumsCompletos`.

## Issues Encountered

None.

## User Setup Required

None - nenhuma configuração de serviço externo. Nenhuma dependência nova.

## Next Phase Readiness

- 40/40 operações do CRM (`deals`/`conversations`/`contacts`) com schema próprio, drift de aridade/tipo/enum barrado em compilação, formas do web provadas caso a caso — pronto para o Plan 01-16 compor (`{ ...TAREFAS, ...AUTOMACOES, ...FINANCEIRO, ...NEGOCIOS, ...CONVERSAS, ...CONTATOS, ... }`).
- Roda em paralelo com 01-14 (IA, configuração, colaboração) e 01-15 (planejamento, escala, membros, estrutura) — nenhum dos três tocou `esquemas-de-argumentos.ts`, `operacoes.ts`, `packages/dominio` ou `apps/web`, confirmado por `git diff --quiet`.
- CR-02 (efeito 2) permanece parcialmente aberto até 01-14, 01-15 e 01-16 fecharem; PERS-04 continua com a mesma ressalva de `01-VERIFICATION.md`.

---
*Phase: 01-o-crm-n1-ganha-persist-ncia-e-login*
*Completed: 2026-09-17*

## Self-Check: PASSED

Todos os 6 arquivos de `files_modified` e este SUMMARY existem em disco; os dois hashes de commit (`949d50a`, `9718fd6`) existem em `git log`.
