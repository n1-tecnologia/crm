---
phase: 04-as-outras-telas-do-financeiro-tria
plan: 03
subsystem: ui
tags: [nextjs, react, shell-navigation, lucide-react, vitest, memberReachesContainer]

# Dependency graph
requires:
  - phase: 03-contas-a-pagar
    provides: "memberReachesContainer e CP.folderId (fld_financeiro) já existentes no domínio, provados por PAG-06 (03-05)"
provides:
  - "ASSUNTO_FINANCEIRO, TELAS_DO_FINANCEIRO e vePastaFinanceiro em apps/web/src/features/financeiro/navegacao-financeiro.ts"
  - "/financeiro como sexto assunto do trilho do shell, com visibilidade condicional derivada (não uma Concessão nova)"
  - "formaDe() reconhecendo /financeiro (painel) e /financeiro/extratos (formulario)"
affects: [04-04, 04-05, 04-06, 04-07, 04-08, 04-09, 04-10, 04-11, 04-12, 04-13, 04-14]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Módulo de navegação puro e testável (sem JSX, sem \"use client\") consumido pelo shell client component"
    - "Visibilidade de item de trilho derivada de memberReachesContainer, nunca de Concessão gravada — mesmo caminho de PAG-06"

key-files:
  created:
    - apps/web/src/features/financeiro/navegacao-financeiro.ts
    - apps/web/src/features/financeiro/navegacao-financeiro.test.ts
  modified:
    - apps/web/src/features/shell/app-shell.tsx
    - apps/web/src/features/shell/rotas.ts
    - apps/web/src/features/shell/rotas.test.ts

key-decisions:
  - "assuntosVisiveis calculado dentro de Navegacao (não de AppShell): é o componente que de fato mapeia ASSUNTOS e já consome useData/useSession — AppShell não tem acesso a nenhum dos dois"
  - "Só existe UM ponto no código que mapeia o array ASSUNTOS inteiro (o trilho, ~linha 389); o \"painel de telas\" (~linha 513) mapeia assunto.telas, não ASSUNTOS, e continua correto sem alteração — assuntoDe() já resolve isso lendo ASSUNTOS sem filtro, como o próprio UI-SPEC prescreve"

requirements-completed: [TELA-01]

# Metrics
duration: ~55min
completed: 2026-09-23
---

# Phase 4 Plan 03: O lugar de `/financeiro` na casca do CRM N1 Summary

**Sexto assunto do trilho (`/financeiro`, 8 sub-rotas) com visibilidade derivada de `memberReachesContainer` sobre a Pasta "Financeiro", zero Concessão nova, e `formaDe()` reconhecendo o esqueleto de painel e de formulário.**

## Performance

- **Duration:** ~55 min
- **Completed:** 2026-09-23
- **Tasks:** 3/3
- **Files modified:** 5 (2 criados, 3 editados) + 1 arquivo de registro fora do escopo de código (`deferred-items.md`)

## Accomplishments

- `navegacao-financeiro.ts`: módulo puro com `TELAS_DO_FINANCEIRO` (as oito leituras, ordem e rótulos do UI-SPEC), `ASSUNTO_FINANCEIRO` (no formato de `Assunto` do shell) e `vePastaFinanceiro` — que decide só o que aparece, nunca o que pode ser lido.
- `app-shell.tsx`: `/financeiro` entra como sexto assunto do trilho; `assuntoDe()` reconhece o prefixo; a primeira e única condicional de visibilidade do trilho (`assuntosVisiveis`) esconde o item para quem não alcança a Pasta "Financeiro" — sem tabela de permissão nova.
- `rotas.ts`: `formaDe("/financeiro")` → `"painel"`, `formaDe("/financeiro/extratos")` → `"formulario"`; as outras seis rotas caem no padrão `"tabela"` já correto.
- 5 testes novos em `navegacao-financeiro.test.ts` (ordem/rótulos, ausência de `/ferramentas`, alcance verdadeiro/falso sobre `buildSeed()` real, `null`/`""`) + 6 asserções novas em `rotas.test.ts`.

## Task Commits

Each task was committed atomically:

1. **Task 1: O assunto Financeiro como módulo puro e testável** - `bac1696` (feat)
2. **Task 2: Ligar o assunto no trilho, com a única condicional do shell** - `6f05ab1` (feat)
3. **Task 3: A forma do esqueleto das oito rotas** - `742778c` (feat)

**Plan metadata:** (este commit) `docs(04-03): complete o-lugar-de-financeiro-na-casca-do-crm-n1 plan`

## Files Created/Modified

- `apps/web/src/features/financeiro/navegacao-financeiro.ts` - `ASSUNTO_FINANCEIRO`, `TELAS_DO_FINANCEIRO`, `vePastaFinanceiro`
- `apps/web/src/features/financeiro/navegacao-financeiro.test.ts` - 5 casos provando ordem, ausência de `/ferramentas` e o alcance nos dois sentidos sobre o seed real
- `apps/web/src/features/shell/app-shell.tsx` - sexto assunto em `ASSUNTOS`, união de `chave` ampliada, `assuntoDe()` reconhece `/financeiro`, `assuntosVisiveis` filtra o trilho
- `apps/web/src/features/shell/rotas.ts` - `formaDe()` ganha duas guardas (`painel`/`formulario`)
- `apps/web/src/features/shell/rotas.test.ts` - 6 asserções novas cobrindo as oito rotas e a prova de que `chaveDeChegada` não colapsa nenhuma delas
- `.planning/phases/04-as-outras-telas-do-financeiro-tria/deferred-items.md` - registro de uma falha de teste pré-existente e fora de escopo (ver Deviations)

## Decisions Made

- **`assuntosVisiveis` mora em `Navegacao`, não em `AppShell`.** O plano pedia "dentro do componente `AppShell`", mas `AppShell` não mapeia `ASSUNTOS` nem consome `useData`/`useSession` — quem faz as duas coisas é o componente `Navegacao`, que desenha o trilho. Implementado onde o código realmente vive, reusando `session.memberId` e um novo `useData((current) => current)` (não havia assinatura de estado inteiro em `Navegacao` ainda — não duplica nenhuma existente).
- **Só existe um ponto de mapeamento de `ASSUNTOS` no shell**, não dois como o UI-SPEC/CONTEXT.md presumiam. O "painel de telas" (linha ~513 do arquivo) itera `assunto.telas` (as telas do assunto ATIVO, resolvido por `assuntoDe(pathname)` a partir da URL), não o array `ASSUNTOS` inteiro — e o próprio UI-SPEC prescreve que `assuntoDe()` continua lendo `ASSUNTOS` sem filtro ("quem chega por URL sem alcance vê o 403 da página, não um trilho quebrado"). Nenhuma segunda filtragem foi necessária nem criada.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Referência incorreta do plano] Localização real de `assuntosVisiveis` e contagem real de pontos de mapeamento**

- **Found during:** Task 2
- **Issue:** O plano (e o UI-SPEC/CONTEXT.md de onde herdou a leitura) afirma que `assuntosVisiveis` deve ser calculado "dentro do componente `AppShell`" e que existem "dois pontos onde `ASSUNTOS` é mapeado" (trilho e painel de telas). Nenhuma das duas afirmações bate com o código: `AppShell` não mapeia `ASSUNTOS` nem tem `useData`/`useSession`; o componente que faz isso é `Navegacao`. E só existe UM ponto que mapeia o array `ASSUNTOS` inteiro (o trilho, ~linha 389) — o "painel de telas" (~linha 513) mapeia `assunto.telas`, um array diferente, resolvido por `assuntoDe(pathname)` a partir da URL, e o próprio plano instrui explicitamente que `assuntoDe()` não deve ser filtrado.
- **Fix:** `assuntosVisiveis` foi implementado dentro de `Navegacao`, reusando `session.memberId` e uma nova assinatura `useData((current) => current)` (a única necessária); o único ponto real de mapeamento (`ASSUNTOS.map` → `assuntosVisiveis.map`) foi trocado. `assuntoDe()` não foi tocado além de reconhecer o novo prefixo, como o plano pediu.
- **Files modified:** `apps/web/src/features/shell/app-shell.tsx`
- **Verification:** `git diff --stat` = 11 linhas (dentro do teto de 12 do plano); `npm run typecheck -w @n1/web`, `npm run lint -w @n1/web` e `npm run verificar:tokens -w @n1/web` — todos código 0; `npm run test -w @n1/web` — 149/149 verdes, incluindo os testes existentes de shell que exercitam `AppShell`/`Navegacao`.
- **Committed in:** `6f05ab1` (Task 2 commit)

**Achado de verificação, não corrigido (fora de escopo — ver `deferred-items.md`):** `npm run check` completo roda com 1 teste falhando em `@n1/api` (`scheduler-worker.test.ts`, `liberar.cli.ts — validação de argumentos`), reproduzido isoladamente e não causado por este plano — o arquivo foi tocado pela última vez no Plan 03-08. `@n1/web` (149/149) e `@n1/dominio` (480/480) estão inteiramente verdes; `@n1/api` está 359 passed / 138 skipped / 1 failed. Documentado em `deferred-items.md` conforme a regra de SCOPE BOUNDARY.

---

**Total deviations:** 1 auto-fixed (correção de referência factual do plano, Rule 1) + 1 achado fora de escopo registrado, não corrigido.
**Impact on plan:** Nenhum. O resultado funcional é idêntico ao pretendido pelo plano (D4-08/D4-14 cumpridos); a única diferença é ONDE no arquivo o código foi escrito, porque é onde ele funciona de verdade.

## Issues Encountered

Nenhum bloqueio. A única fricção foi a discrepância de localização/contagem descrita acima, resolvida por leitura direta do código-fonte em vez da referência do UI-SPEC/CONTEXT.md.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- O trilho existe e está estável antes das oito telas (objetivo explícito do plano: "senão cada plano de tela mexeria no mesmo `app-shell.tsx` e nenhuma onda paralelizaria").
- Os planos 04-04..04-14 (as oito telas + a superfície `/v1/leituras/*`) podem agora navegar para `/financeiro/*` e contar com `formaDe()`/`chaveDeChegada` corretos e com `NoAccessState` sendo a única forma de recusa (403 real do `apps/api`, não a ausência do link).
- Nenhum bloqueio novo. A falha pré-existente de `@n1/api` (`scheduler-worker.test.ts`) não impede planos seguintes desta fase, que não tocam esse arquivo.

---
*Phase: 04-as-outras-telas-do-financeiro-tria*
*Completed: 2026-09-23*

## Self-Check: PASSED

- Todos os 6 arquivos listados em Files Created/Modified existem no disco.
- Os 3 hashes de commit (`bac1696`, `6f05ab1`, `742778c`) existem em `git log`.
