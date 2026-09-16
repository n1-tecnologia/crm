---
phase: 01-o-crm-n1-ganha-persist-ncia-e-login
plan: 10
subsystem: domain
tags: [domain, invite, rn-et-11, gap-closure, vitest]

# Dependency graph
requires:
  - phase: 01-o-crm-n1-ganha-persist-ncia-e-login (Plan 01-08)
    provides: "inviteMember(state, acting, { email, roleId, userId? }) casando existing por userId antes de invitedIdentity; convidarMembro/resolverUsuarioPorEmail em apps/api"
provides:
  - "inviteMember casando existing pelos DOIS critérios em paralelo: porUserId (só quando input.userId vem) e porEmail (sempre, por invitedIdentity) — existing = porUserId ?? porEmail, com userId prevalecendo"
  - "3 casos novos em members-reconvite.test.ts (g/h/i) provando o caminho irmão de RN-ET-11: pendente só por invitedIdentity cujo e-mail resolve um userId depois"
  - "1 caso novo em convidar-membro.test.ts (e) provando o cenário CR-01 completo pelo serviço, contra o Postgres real"
affects: [01-VERIFICATION, 01-REVIEW]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Busca por dois critérios independentes combinados por ?? (não um ternário condicional) — o segundo critério roda SEMPRE, não só quando o primeiro falta, porque os dois vetores de duplicata são independentes"

key-files:
  created: []
  modified:
    - packages/dominio/src/operations/members.ts
    - packages/dominio/src/operations/members-reconvite.test.ts
    - apps/api/src/servicos/convidar-membro.test.ts

key-decisions:
  - "porEmail é calculado incondicionalmente (não só quando userId está ausente) — é essa mudança, e só ela, que fecha a lacuna CR-01: antes, quando userId vinha preenchido, invitedIdentity nunca era consultado, e um Membro pendente-só-por-e-mail nunca era reencontrado"
  - "existing = porUserId ?? porEmail preserva a prevalência de userId sobre invitedIdentity quando os dois acham Membros diferentes (caso i) — a recusa é sempre a do Membro achado por userId"
  - "Tudo depois da linha de existing ficou byte a byte como estava: a reativação RN-ET-11 (incluindo a gravação condicional de existing.userId) já cobria o caminho (h) sem precisar de nenhuma mudança adicional"

patterns-established:
  - "Quando dois critérios de identidade podem apontar para registros diferentes por caminhos de vida distintos do mesmo dado (aqui: e-mail antes/depois de virar Usuário no Auth), a busca correta é OR dos dois, nunca um fallback condicional de um para o outro"

requirements-completed: [PERS-09]

# Metrics
duration: ~10min
completed: 2026-09-16
---

# Phase 1 Plan 10: `inviteMember` casa `existing` pelos dois critérios em paralelo (CR-01) Summary

**`packages/dominio/src/operations/members.ts` fecha o gap CR-01 do `01-REVIEW.md`: `existing = porUserId ?? porEmail`, com `porEmail` calculado sempre — antes só rodava quando `input.userId` estava ausente, deixando um Membro `pendente` sem conta no Auth virar um segundo Membro quando o e-mail passasse a resolver um `userId`.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-09-16T16:41:31-03:00 (logo após `cd553a8`, fim do Plan 01-11)
- **Completed:** 2026-09-16T16:49:00-03:00
- **Tasks:** 2/2
- **Files modified:** 3

## Accomplishments

- `inviteMember` (`packages/dominio/src/operations/members.ts`): o ternário que decidia `existing` por UM critério (userId OU invitedIdentity, nunca os dois) virou três declarações — `porUserId` (condicional a `input.userId !== undefined`), `porEmail` (SEMPRE, por `invitedIdentity.value` normalizado) e `existing = porUserId ?? porEmail`. Tudo depois (as duas mensagens de recusa, RN-ET-23, a reativação RN-ET-11 com a gravação condicional de `userId`, a criação do Membro novo) ficou byte a byte como estava — a correção é só na busca.
- Comentário-bloco acima de `existing` reescrito em pt-BR explicando os dois lados da lacuna (e-mail some do estado depois do aceite / Membro nasce só com `invitedIdentity` antes de ter conta no Auth) e citando "CR-01 (01-REVIEW.md)" para rastreabilidade.
- `members-reconvite.test.ts`: três casos novos, ao fim do arquivo, num `describe` próprio — (g) prova a recusa "Já existe um convite pendente" sem duplicata quando o e-mail de um `pendente`-só-por-`invitedIdentity` resolve um `userId` depois; (h) prova que um `removido` reencontrado só por `invitedIdentity` reativa o MESMO Membro e grava o `userId` resolvido; (i) prova que `userId` prevalece sobre `invitedIdentity` quando apontam para Membros diferentes (a recusa é a do Membro `ativo` achado por `userId`). Os 6 casos (a)–(f) existentes não foram tocados.
- `convidar-membro.test.ts`: caso (e) reproduz o cenário "Ana" de CR-01 de ponta a ponta pelo serviço, contra o Postgres real — convite sem conta no Auth (`resolverSemConta`), depois reconvite com a conta já criada (`resolverComConta` devolvendo `ANA_USER`), recusa em vez de segundo Membro, confirmado por `hidratar()` antes e depois. Os casos (a)–(d) existentes não foram tocados; `convidar-membro.ts` e a rota não mudaram.
- `npm run test -w @n1/dominio`: **253 testes** verdes (250 anteriores + 3 novos). `npm run test -w @n1/api -- src/servicos/convidar-membro.test.ts`: **5 casos** verdes, listando (a), (b), (e), (c) e (d) — rodou contra o Postgres e o Supabase Auth reais deste ambiente. `npm run check` (raiz, três workspaces): verde — dominio 253, api 73, web 53.
- `git diff d713253 -- packages/dominio/src/operations/operations.test.ts packages/dominio/src/seed-produto.test.ts packages/dominio/src/contas-a-receber.test.ts` → vazio (Critério 4 do ROADMAP intacto).

## Task Commits

Each task was committed atomically:

1. **Task 1: `inviteMember` casa `existing` pelos dois critérios (`porUserId ?? porEmail`) — casos (g), (h), (i) em `members-reconvite.test.ts`** - `982558d` (feat)
2. **Task 2: Caso (e) em `convidar-membro.test.ts` — convite sem conta, conta criada depois, reconvite recusado sem segundo Membro (pelo serviço, contra o Postgres)** - `7639f75` (test)

**Plan metadata:** pending (this commit)

## Files Created/Modified

- `packages/dominio/src/operations/members.ts` - `existing` em `inviteMember` casa por `porUserId ?? porEmail`; comentário reescrito citando CR-01
- `packages/dominio/src/operations/members-reconvite.test.ts` - 3 casos novos (g)/(h)/(i) no caminho irmão de RN-ET-11 (CR-01), ao fim do arquivo
- `apps/api/src/servicos/convidar-membro.test.ts` - caso (e), pelo serviço contra o Postgres real, reproduzindo o cenário CR-01 de ponta a ponta

## Decisions Made

- `porEmail` passa a ser calculado incondicionalmente — antes só rodava no `else` do ternário quando `userId` estava ausente. É a única mudança de comportamento do plano: fecha exatamente o vetor descrito em CR-01 sem tocar em nenhuma outra parte de `inviteMember`.
- A ordem `porUserId ?? porEmail` (não `porEmail ?? porUserId`) preserva a prevalência de `userId`, que já era o comportamento correto desde o Plan 01-08 e que o caso (i) agora prova explicitamente contra o novo código.
- O caso (e) reaproveita o mesmo `describe`/`WS`/seed do `beforeAll`/`afterAll` já existentes em `convidar-membro.test.ts` — não criou um segundo Espaço de Trabalho de teste, seguindo o padrão dos casos (a)/(b) que já compartilham `WS`.

## Deviations from Plan

None - plan executed exactly as written. Os três arquivos tocados são exatamente os do `files_modified` do frontmatter; nenhum arquivo fora da lista mudou.

## Issues Encountered

Nenhum. `apps/api/.env` já tinha `DATABASE_URL`, `SUPABASE_URL` e `SUPABASE_SECRET_KEY` configurados desde plans anteriores, então o caso (e) e o caso (c) pré-existente rodaram de fato contra o Postgres e o Auth reais nesta execução (nenhum caso pulado por falta de credencial).

## User Setup Required

None - `DATABASE_URL`/`SUPABASE_URL`/`SUPABASE_SECRET_KEY` já configurados em `apps/api/.env` desde plans anteriores; nenhuma credencial nova necessária para este plano.

## Next Phase Readiness

- Critério 5 do ROADMAP fechado sem ressalva nos dois caminhos de RN-ET-11: o do Usuário que já foi `ativo` (Plan 01-08, casos (a)/(c)) e o caminho irmão do `pendente` por `invitedIdentity` cujo e-mail resolve `userId` depois (este plano, casos (g)/(h)/(i)/(e)).
- Gap 1 de `01-VERIFICATION.md` (CR-01) fechado: `members.ts` mostra `porUserId ?? porEmail`; o caso (g) reproduz literalmente o `missing[1]` do gap.
- Fase 1 com os 11 planos GSD executados (9 originais + 01-11 CR-02 + 01-10 CR-01) — pronta para uma nova rodada de `/gsd-verify-phase 1` confirmar que os dois gaps do `01-REVIEW.md` estão fechados.
- Nenhum bloqueio novo. PERS-08 (onde o `apps/api` roda) continua bloqueado por D11, fora do escopo deste plano.

---
*Phase: 01-o-crm-n1-ganha-persist-ncia-e-login*
*Completed: 2026-09-16*

## Self-Check: PASSED

Os 3 arquivos de código citados + este SUMMARY.md encontrados em disco; os dois hashes de task (`982558d`, `7639f75`) encontrados em `git log --oneline --all`.
