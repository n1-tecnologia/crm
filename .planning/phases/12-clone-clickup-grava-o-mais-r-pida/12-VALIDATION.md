---
phase: "12"
slug: "clone-clickup-grava-o-mais-r-pida"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-30"
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Fonte: `12-RESEARCH.md` § Validation Architecture (comandos verificados na sessão de pesquisa).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 5.0.1 nas duas camadas (`apps/api`, `apps/web`) |
| **Config file** | `apps/api/vitest.config.mts` (`fileParallelism: false`, timeouts 180 s); `apps/web/vitest.config.mts` (`environment: "node"`; `// @vitest-environment jsdom` por arquivo `.tsx`) |
| **Quick run (api, sem banco)** | `cd apps/api && DATABASE_URL= DATABASE_URL_MIGRACAO= npx vitest run src/persistencia/unidade-de-trabalho-trava.test.ts src/persistencia/unidade-de-trabalho.test.ts src/rotas/operacoes-medicao.test.ts && npx tsc --noEmit` |
| **Quick run (web)** | `cd apps/web && npx tsc --noEmit && npx vitest run src/dados` |
| **Full suite (api, sem banco)** | `cd apps/api && DATABASE_URL= DATABASE_URL_MIGRACAO= npx vitest run` (119 arquivos passam, 36 pulam, 1164 testes) |
| **Full suite (web)** | `cd apps/web && npx vitest run && npm run lint -w @n1/web` (92 arquivos, 847 testes) |
| **Com banco real (GRV-03)** | Postgres local descartável por Docker (`postgres:16`), `npm run migrar`, e `DATABASE_URL`/`DATABASE_URL_MIGRACAO` explícitas — **nunca** contra o `.env` |
| **Estimated runtime** | quick api ~1 s · quick web ~2 s · full api ~52 s · full web ~13 s |

`npm test` da raiz leva 13–17 min e `lote-contas-a-pagar (d)` falha sempre por rede; usar rodadas dirigidas por workspace.

---

## Sampling Rate

- **After every task commit:** quick run da camada tocada (API: arquivos acima + `npx tsc --noEmit`; web: `npx tsc --noEmit && npx vitest run src/dados`)
- **After every plan wave:** suíte completa sem banco da API (52 s) **e** da web (13 s) — obrigatório nas ondas do store (D-13 inverte suposições de testes de tela)
- **Before `/gsd-verify-work`:** rodada com Postgres local (concorrência, `operacoes.test.ts`, `estado.test.ts`) + `npm run check` local/Docker; tudo verde exceto o baseline conhecido (`lote-contas-a-pagar`)
- **Max feedback latency:** 60 s

---

## Per-Task Verification Map

> Os IDs de tarefa são preenchidos pelo planejador; as linhas abaixo ficam por requisito até lá.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 12-xx-xx | — | — | GRV-01 | V7 / vazamento de `medicao` | `medicao` fora do corpo (200, recusa, 409); log só com nome da operação e números | integração sem banco | `cd apps/api && DATABASE_URL= npx vitest run src/rotas/operacoes-medicao.test.ts` | ❌ W0 | ⬜ pending |
| 12-xx-xx | — | — | GRV-01 | — | etapas, `tentativas`, `linhasLidas` coletados; `aoMedir` também em conflito/exceção | unit | `cd apps/api && DATABASE_URL= npx vitest run src/persistencia/unidade-de-trabalho.test.ts` | ✅ (estender) | ⬜ pending |
| 12-xx-xx | — | — | GRV-01 | — | mediana, pior caso e tabela do comando | unit puro | `cd apps/api && DATABASE_URL= npx vitest run src/observabilidade/medicao-da-gravacao.test.ts` | ❌ W0 | ⬜ pending |
| 12-xx-xx | — | — | GRV-03 | pool esgotado por espera de trava | trava é a 1ª instrução após `begin`; `55P03` → 409 sem repetir; regime otimista mantém 3 tentativas | unit (fake) | `cd apps/api && DATABASE_URL= npx vitest run src/persistencia/unidade-de-trabalho-trava.test.ts` | ✅ (reescrever linhas 101 e 110) | ⬜ pending |
| 12-xx-xx | — | — | GRV-03 | — | 2 `executar()` simultâneas gravam, 1 tentativa cada, `hidratar` ×2 | integração, Postgres local | `cd apps/api && DATABASE_URL=<docker> DATABASE_URL_MIGRACAO=<docker> npx vitest run src/persistencia/unidade-de-trabalho-concorrencia.test.ts` | ❌ W0 | ⬜ pending |
| 12-xx-xx | — | — | GRV-03 | — | as 4 importações longas passam `regime: "otimista"`; os demais, não | unit | `cd apps/api && DATABASE_URL= npx vitest run src/importacao` | ✅ (estender) | ⬜ pending |
| 12-xx-xx | — | — | GRV-04 | — | `run` com 2 chamadas aplica 2 diferenças em ordem e não chama `hidratar` | unit (transporte falso) | `cd apps/web && npx vitest run src/dados/store.test.ts` | ✅ (novo caso) | ⬜ pending |
| 12-xx-xx | — | — | GRV-04 | — | `transporteHttp.gravar` devolve a lista, parando na 1ª que não for `diferenca` | unit (`fetch` falso) | `cd apps/web && npx vitest run src/dados/transporte.test.ts` | ✅ (ajustar `(g)`) | ⬜ pending |
| 12-xx-xx | — | — | GRV-05 | mudança mostrada e perdida | `data.lists` já tem a Lista antes de o transporte responder; `ok:false` a remove e `lastResult.error` traz a mensagem | unit (transporte lento) | `cd apps/web && npx vitest run src/dados/store.test.ts` | ✅ (novo; inverter `(b)`) | ⬜ pending |
| 12-xx-xx | — | — | GRV-05 | — | dois `run` seguidos: 1 pedido em voo por vez, ordem preservada; recusa do 1º refaz o 2º | unit | `cd apps/web && npx vitest run src/dados/store.test.ts` | ❌ W0 | ⬜ pending |
| 12-xx-xx | — | — | GRV-05 | segredo de link antes de existir | lista de exceções: chaves válidas e motivos não vazios; gesto com exceção não vira `data` na hora | unit | `cd apps/web && npx vitest run src/dados/operacoes-que-esperam.test.ts` | ❌ W0 | ⬜ pending |
| 12-xx-xx | — | — | GRV-05 | — | lista nova aparece sem link e com `aria-busy` até confirmar | jsdom | `cd apps/web && npx vitest run src/features/shell` | ✅ (estender) | ⬜ pending |
| 12-xx-xx | — | — | GRV-05 | mudança mostrada e perdida | `beforeunload` só avisa com `pendentes > 0` | unit da função pura | `cd apps/web && npx vitest run src/dados/store.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/rotas/operacoes-medicao.test.ts` — GRV-01 (sem vazamento + linha de log)
- [ ] `apps/api/src/observabilidade/medicao-da-gravacao.test.ts` — GRV-01 (mediana/pior caso/tabela)
- [ ] `apps/api/src/persistencia/unidade-de-trabalho-concorrencia.test.ts` — GRV-03 (Postgres local, `describeComBanco`)
- [ ] `apps/web/src/dados/operacoes-que-esperam.test.ts` — GRV-05
- [ ] Ajuste dos fakes de `unidade-de-trabalho*.test.ts` (linha do `select … for update`, `linhasLidas` defensivo)
- [ ] Auxiliar de teste do transporte lento/controlável (promessa que o teste solta, como `store.test.ts (o)` com `soltar`) — GRV-05
- [ ] Container Docker local `postgres:16` para os testes com banco (já disponível; sem instalação)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| O comando repete os 4 gestos ×10 em produção e imprime a tabela "antes"; tamanho de `plataforma.registros` | GRV-01 | roda na VPS contra o banco real; ação do dono | `ssh … 'cd /opt/n1-crm/current && npm run gravacao:medir -w @n1/api -- --repeticoes=10'` → `12-PROVAS.md` |
| Parada `[BLOCKING]` com a tabela "antes" na mão do dono; meta fixada | GRV-02 | decisão do dono | preencher "Meta (fixada na parada)" no `12-CONTEXT.md`; conferir com `grep -n "Meta (fixada na parada)" -A3 .planning/phases/12-*/12-CONTEXT.md` (sem "A preencher") |
| Tabela "depois" com o mesmo comando, comparada à meta | GRV-06 | roda na VPS; ação do dono | idem GRV-01, depois de publicar a trava e o store |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
