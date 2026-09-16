---
phase: 01-o-crm-n1-ganha-persist-ncia-e-login
plan: 07
subsystem: frontend-data
tags: [zustand, fetch, optimistic-update, next-server-component, diff-apply]

# Dependency graph
requires:
  - phase: 01-o-crm-n1-ganha-persist-ncia-e-login (Plan 01-03)
    provides: "gravarChamadas/instrumentar (gravador de chamadas), serializarArgumentos, syncIdSequence, aplicarDiferenca/Diferenca/Ordens/DIFERENCA_VAZIA"
  - phase: 01-o-crm-n1-ganha-persist-ncia-e-login (Plan 01-02)
    provides: "apps/api no ar com GET /saude, hook de autenticação, NEXT_PUBLIC_API_URL/API_URL documentados"
provides:
  - "apps/web/src/dados/transporte.ts — Transporte (transporteHttp/transporteEmMemoria), o contrato HTTP exato do Plan 01-04 do lado do cliente"
  - "apps/web/src/dados/estado-inicial.ts — carregarEstadoInicial() server-only, GET /estado com o token do cookie"
  - "apps/web/src/dados/store.ts — run() híbrido (D-05/D-06), StoreProvider(sessao, estadoInicial, transporte), criarStore exposta para teste"
  - "Casca ((shell)/layout.tsx, sessao-provider.tsx) resolvendo sessão e estado pela API; PublicoProvider em memória"
affects: [01-08, 01-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Transporte como interface pequena: produção (transporteHttp) e teste/rotas-públicas (transporteEmMemoria) atrás do mesmo contrato, sem tocar em nenhum componente"
    - "run() híbrido: clone + gravador de chamadas ligado decide a recusa instantânea; enviar() interno dispara sem await e aplica o diff por cima do estado real (mutação em lugar, nunca troca de referência)"
    - "Vitest com Transporte falso (vi.fn tipado pela própria assinatura da interface) em vez de fetch falso para testar store.ts; fetch falso (vi.stubGlobal) só em transporte.test.ts"

key-files:
  created:
    - apps/web/src/dados/transporte.ts
    - apps/web/src/dados/transporte.test.ts
    - apps/web/src/dados/estado-inicial.ts
    - apps/web/src/dados/store.test.ts
    - .planning/phases/01-o-crm-n1-ganha-persist-ncia-e-login/deferred-items.md
  modified:
    - apps/web/src/dados/store.ts
    - apps/web/src/dados/sessao-provider.tsx
    - apps/web/src/dados/publico-provider.tsx
    - apps/web/src/app/(shell)/layout.tsx
    - apps/web/CONTEXT.md

key-decisions:
  - "PedidoDeGravacao ganhou um campo resultado (OperationResult<unknown> da cópia) além do que a interface original do plano listava — necessário para transporteEmMemoria devolver esse resultado junto do novo 'estado', exatamente como a ação da Task 1 pediu"
  - "gravar() com > 1 chamada grava em sequência e para na primeira resposta que não for 'diferenca', devolvendo essa — cobre o caso de (shell)/page.tsx (createChatSession + sendChatMessage no mesmo run)"
  - "gravar() com 0 chamadas nunca chama fetch e devolve falha explicando que a tela precisa de uma operação de domínio — é o caso de configuracoes/membros/[membro]/page.tsx (muda roleId direto na cópia); registrado aqui como stub conhecido, não corrigido (fora do escopo desta fase)"
  - "run()'s branch 'diferenca' com resultado.ok===false faz DOIS set() (revisaoDoServidor+revision, depois lastResult+revision) em vez de um só combinado — mais literal ao passo-a-passo do plano, sem custo funcional (o diff nesse caso é DIFERENCA_VAZIA)"
  - "npm run build -w @n1/web falhou em /entrar (useSearchParams sem Suspense) — confirmado pré-existente (commit d713253, fora de files_modified deste plano); gate usado no lugar: typecheck + lint + verificar:tokens + test, todos verdes — registrado em deferred-items.md"

requirements-completed: [PERS-05]

# Metrics
duration: ~25min
completed: 2026-09-16
---

# Phase 1 Plan 07: `store.ts` hidrata da API — run() híbrido, Transporte, casca resolvida pelo servidor Summary

**`store.ts` deixou de montar `buildProductSeed()`: hidrata via `GET /estado` (`estado-inicial.ts`, chamado pelo Server Component da casca) e grava via `POST /operacoes/:nome` (`transporte.ts`); `run()` continua com a mesma assinatura pública, mas agora clona o estado, decide a recusa do domínio instantaneamente sem rede (D-05), e só muda o `DataState` real quando o diff volta do servidor — revisão defasada ou 409 re-hidratam em vez de aplicar diff parcial (D-06).**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-16T12:56:00Z (aprox., após 01-02)
- **Completed:** 2026-09-16T13:16:00Z
- **Tasks:** 3/3
- **Files modified:** 10 (5 criados, 5 modificados)

## Accomplishments

- `Transporte` é a fronteira nova entre `store.ts` e o mundo: `transporteHttp` fala o contrato exato do Plan 01-04 (`POST /operacoes/:nome`, `GET /estado`, mapeamento de 200/409/401/403/404/500), `transporteEmMemoria` mantém as rotas públicas funcionando sem servidor — sem nenhum `apps/api` no ar, provado por `fetch` falso (11 casos).
- `run()` é o híbrido de D-05 em produção: `structuredClone` + `syncIdSequence` + `gravarChamadas` decidem a recusa na hora, sem UMA requisição; o sucesso dispara `enviar()` sem `await` e devolve sincronamente — a API pública (`useData`, `useSession`, `useCurrentMember`, `useRun`, `useLastResult`, `run`) não mudou uma linha de assinatura, e nenhum dos ~143 pontos de chamada em `apps/web/src/app`/`src/features` precisou de edição (provado por `git diff --stat` restrito a essas pastas, que mostra só `(shell)/layout.tsx`).
- D-06 aplicado: revisão defasada (`revisaoAnterior` não bate) ou `tipo: "conflito"` (409) sempre re-hidratam por `GET /estado` — o store nunca aplica um diff parcial sobre um estado que já não é o de agora.
- `buildProductSeed()` saiu do caminho autenticado: só sobrevive em `publico-provider.tsx` (confirmado por `grep -rln buildProductSeed apps/web/src`), documentado como decisão adiada (OQ-PF-01).
- A casca (`(shell)/layout.tsx`) resolve o Membro pela API (`sessao.memberId` de `GET /estado`), não mais pelo mapa `USUARIOS_DO_SEED`; ganhou um estado "Servidor indisponível" visualmente coerente com a tela "Sem acesso" existente.
- `npm run check` (raiz) verde: 232 + 24 + 53 = 309 testes; typecheck/lint/tokens dos três workspaces sem alteração de comportamento fora do escopo.

## Task Commits

Each task was committed atomically:

1. **Task 1: `Transporte` — HTTP (fetch + Bearer) e memória — e `carregarEstadoInicial()` no servidor** - `4d40526` (feat)
2. **Task 2: `run()` híbrido em `store.ts` — clone, recusa na hora, POST, diff, re-hidratação — com teste** - `94ba111` (feat)
3. **Task 3: A casca resolve sessão e estado pela API; rotas públicas ficam em memória; `apps/web/CONTEXT.md`** - `dd27d53` (feat)

**Plan metadata:** pending (this commit)

## Files Created/Modified

- `apps/web/src/dados/transporte.ts` - `Transporte`, `RespostaDeGravacao`, `PedidoDeGravacao`, `EstadoDoServidor`, `transporteHttp`, `transporteEmMemoria`
- `apps/web/src/dados/transporte.test.ts` - 11 casos com `fetch` falso: URL/headers/corpo, 200/409/401/rede/500, zero e duas chamadas, hidratar, transporte em memória
- `apps/web/src/dados/estado-inicial.ts` - `carregarEstadoInicial` (server-only, `cache()`), `EstadoInicial` (`ok`/`semSessao`/`semAcesso`/`indisponivel`)
- `apps/web/src/dados/store.ts` - `criarStore`/`StoreProvider` com `estadoInicial`/`transporte`; `StoreShape` ganha `ordens`, `revisaoDoServidor`, `pendentes`, `rehidratar`; `run()` híbrido; `reset()`/`buildProductSeed` removidos
- `apps/web/src/dados/store.test.ts` - 9 casos com `Transporte` falso: recusa sem rede, otimismo antes do diff, aplicação do diff, revisão defasada, conflito, falha, ids determinísticos, duas chamadas, `rehidratar()`
- `apps/web/src/dados/sessao-provider.tsx` - prop `inicial` (`EstadoInicial` ok/semAcesso); `transporteHttp` memoizado com token do navegador
- `apps/web/src/dados/publico-provider.tsx` - `transporteEmMemoria()` memoizado; único lugar com `buildProductSeed`
- `apps/web/src/app/(shell)/layout.tsx` - `carregarEstadoInicial()`; `semSessao`→`/entrar`, `indisponivel`→tela própria, `semAcesso`/`ok`→`SessaoProvider`
- `apps/web/CONTEXT.md` - "A fronteira que importa" descreve o caminho novo (`GET /estado`, `POST /operacoes/:nome`, `NEXT_PUBLIC_API_URL`)
- `.planning/phases/01-o-crm-n1-ganha-persist-ncia-e-login/deferred-items.md` - achado fora de escopo do build (`/entrar` sem `Suspense`)

## Decisions Made

- `PedidoDeGravacao` ganhou `resultado: OperationResult<unknown>` (além de `chamadas`/`revisao`/`copia`) — o esboço do bloco `<interfaces>` do plano não o listava, mas a ação da Task 1 pedia explicitamente ("ajuste") para o transporte em memória devolver o resultado da cópia junto do novo estado.
- `gravar()` com mais de uma chamada grava em sequência e para na primeira resposta que não for `"diferenca"`, devolvendo essa — cobre `(shell)/page.tsx` (Sessão de Chat + mensagem no mesmo `run`).
- `gravar()` com zero chamadas nunca chama `fetch`; devolve uma falha explicando que a ação não passa por uma operação do domínio — cobre `configuracoes/membros/[membro]/page.tsx`, que muta `roleId` direto na cópia sem operação registrada (ver "Known Stubs").
- No ramo `"diferenca"` com `resultado.ok === false` (servidor recusou por não-determinismo o que a cópia aceitou), `enviar()` faz dois `set()` separados (um para `revisaoDoServidor`/`revision`, outro para `lastResult`/`revision`) em vez de um só combinado — segue o passo-a-passo literal do plano; sem custo funcional porque o diff nesse caso é `DIFERENCA_VAZIA`.
- Um comentário em `transporte.ts` que citava `` `buildProductSeed()` `` em prosa foi reescrito para não colidir com o `grep -rln buildProductSeed apps/web/src` do critério de aceitação da Task 3 (mesmo cuidado já registrado nas SUMMARYs de 01-02/01-03).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Comentário de `transporte.ts` colidia com o grep de "só `publico-provider.tsx` usa `buildProductSeed`"**
- **Found during:** Task 3, verificação do critério de aceitação (`grep -rln buildProductSeed apps/web/src`)
- **Issue:** O comentário de topo de `transporteEmMemoria()` citava `` `buildProductSeed()` `` em prosa, fazendo `transporte.ts` aparecer na lista — o critério exige que SÓ `publico-provider.tsx` apareça.
- **Fix:** Reescrito para descrever "o seed do produto montado pelo `PublicoProvider`" sem repetir o nome literal da função.
- **Files modified:** `apps/web/src/dados/transporte.ts`
- **Verification:** `grep -rln buildProductSeed apps/web/src` agora lista só `apps/web/src/dados/publico-provider.tsx`.
- **Committed in:** `dd27d53` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — colisão de grep, sem mudança de comportamento).
**Impact on plan:** Nenhum — ajuste de texto de comentário para satisfazer um critério de aceitação literal.

## Issues Encountered

- `npm run build -w @n1/web` falhou em "Error occurred prerendering page /entrar" — `useSearchParams()` sem `<Suspense>` em `apps/web/src/app/entrar/page.tsx`. Confirmado pré-existente (`git log` mostra o último commit nesse arquivo em `d713253`, de um plano anterior; `/entrar` não está em `files_modified` deste plano). Fora do escopo (scope boundary do executor); registrado em `deferred-items.md`. Gate usado no lugar, conforme a própria ação do plano previa para esse cenário: `npm run typecheck -w @n1/web && npm run lint -w @n1/web && npm run verificar:tokens -w @n1/web && npm run test -w @n1/web` — todos verdes, e confirmados de novo pelo `npm run check` da raiz (309 testes).

## Known Stubs

- **`apps/web/src/app/(shell)/configuracoes/membros/[membro]/page.tsx` — `changeRole` muda `roleId` direto na cópia, sem operação de domínio.** Quando essa tela chamar `run()`, o `Transporte` (`transporte.ts`, `gravar()` com zero chamadas) devolve `{ tipo: "falha", erro: "Esta ação não passa por uma operação do domínio e não foi gravada." }` — a tela mostra sucesso otimista (o `OperationResult` hardcoded que o closure devolve) e, no próximo tick, `lastResult` vira essa falha. Pré-existente ao plano (a tela já fazia isso antes de `run()` falar com a API); agora fica visível porque não há mais mutação em lugar sem rede por baixo. Corrigir exige uma operação de domínio própria para trocar o Papel de um Membro (`packages/dominio/src/operations/members.ts`) — fora do escopo desta fase; registrado aqui para o próximo plano que tocar Configurações › Membros.

## User Setup Required

None - `NEXT_PUBLIC_API_URL`/`API_URL` já documentados em `apps/web/.env.local.example` desde o Plan 01-02; o valor default (`http://localhost:3002`) só é usado se a variável não estiver definida, e o código nunca lança durante SSR por falta dela fora de `estado-inicial.ts` (que lança de propósito, server-only, se as duas faltarem).

## Next Phase Readiness

- Plan 01-08/01-09 (bootstrap, e2e) podem contar com o caminho inteiro tela → `run()` → `Transporte` → `apps/api` já implementado do lado do cliente; falta só o `apps/api` responder de verdade (`GET /estado`, `POST /operacoes/:nome` — Plan 01-04, onda seguinte) para o critério de aceitação humano do ROADMAP (criar Conta, F5, recusa instantânea) ser verificável de ponta a ponta.
- `apps/web` ainda sobe e todos os testes passam mesmo sem `apps/api` no ar, porque nenhum teste desta plan depende de rede real — só de `Transporte`/`fetch` falsos.
- Bloqueio conhecido, não desta plan: `npm run build -w @n1/web` continua falhando em `/entrar` (ver Known Issues / `deferred-items.md`) — algum plano futuro que toque autenticação deveria envolver `useSearchParams()` num `<Suspense>` ali.
- Stub conhecido, não desta plan: Configurações › Membros › mudar Papel não persiste de verdade até ganhar uma operação de domínio (ver "Known Stubs").

---
*Phase: 01-o-crm-n1-ganha-persist-ncia-e-login*
*Completed: 2026-09-16*

## Self-Check: PASSED

Todos os 11 arquivos citados em Files Created/Modified (mais este SUMMARY.md) encontrados em disco; os três hashes de task (`4d40526`, `94ba111`, `dd27d53`) encontrados em `git log --oneline --all`.
