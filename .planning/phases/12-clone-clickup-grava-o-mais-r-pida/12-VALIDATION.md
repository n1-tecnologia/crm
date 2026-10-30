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

> IDs `12-PP-TT` = plano PP, tarefa TT. "Docker" = Postgres local `postgres:16` com `DATABASE_URL`/`DATABASE_URL_MIGRACAO` explícitos (contêiner `crm-n1-pg-12PP`, porta 556(20+PP)); o comando completo está no `<verify>` de cada tarefa.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 12-01 | 1 | GRV-01 | T-12-01 | medição fora do corpo no 200; linha "gravacao medida" com as etapas; `aoMedir` em sucesso, recusa, conflito e exceção | unit + integração sem banco | `cd apps/api && DATABASE_URL= npx vitest run src/rotas/operacoes-medicao.test.ts src/persistencia/unidade-de-trabalho.test.ts src/persistencia/unidade-de-trabalho-trava.test.ts && npx tsc --noEmit` | ❌ W0 (`operacoes-medicao.test.ts` nasce na tarefa) | ⬜ pending |
| 12-01-02 | 12-01 | 1 | GRV-01 | T-12-01, T-12-02 | recusa, 409, 500 e `inviteMember` sem medição no corpo; linha sem nome de Lista nem e-mail | integração sem banco + e2e Docker | `cd apps/api && DATABASE_URL= npx vitest run src/rotas/operacoes-medicao.test.ts src/servicos/convidar-membro.test.ts src/persistencia/unidade-de-trabalho.test.ts && npx tsc --noEmit` + Docker `operacoes.test.ts` e `estado.test.ts` | ✅ | ⬜ pending |
| 12-02-01 | 12-02 | 2 | GRV-01 | — | mediana, pior caso, formatação; `createList` medido num Fastify em loopback | unit puro + Docker | `cd apps/api && DATABASE_URL= npx vitest run src/observabilidade/medicao-da-gravacao.test.ts && npx tsc --noEmit` + Docker `medir-gravacao.test.ts` | ❌ W0 | ⬜ pending |
| 12-02-02 | 12-02 | 2 | GRV-01 | T-12-03, T-12-04, T-12-05 | quatro gestos; registros pré-existentes com o mesmo `md5`; saída sem nomes; códigos de saída do comando; stub sem `export` | Docker + grep | `cd apps/api && DATABASE_URL= npx vitest run src/observabilidade && npx tsc --noEmit` + Docker `medir-gravacao.test.ts` | ❌ W0 | ⬜ pending |
| 12-02-03 | 12-02 | 2 | GRV-01 | T-12-07 | o "antes" em produção, com o SHA publicado | manual (dono) | `ssh … 'cd /opt/n1-crm/current && PATH=/opt/n1-crm/node/bin:$PATH npm run --silent gravacao:medir -w @n1/api -- --repeticoes=10'` | n/a | ⬜ pending |
| 12-03-01 | 12-03 | 3 | GRV-02 | — | gatilho de D-07 e "onde está o custo" a partir da saída colada | grep | `grep -c "Parada (2.2.2" .planning/phases/12-clone-clickup-grava-o-mais-r-pida/12-PROVAS.md` | n/a | ⬜ pending |
| 12-03-02 | 12-03 | 3 | GRV-02 | T-12-08 | decisão do dono (meta, B, sessão C) | manual (`checkpoint:decision`, `blocking-human`) | — | n/a | ⬜ pending |
| 12-03-03 | 12-03 | 3 | GRV-02 | T-12-08 | meta registrada; sessão C no ROADMAP se disparou | grep | `grep -A6 "### Meta (fixada na parada)" .planning/phases/12-clone-clickup-grava-o-mais-r-pida/12-CONTEXT.md \| grep -c "Fixada em"` | n/a | ⬜ pending |
| 12-04-01 | 12-04 | 4 | GRV-03 | T-12-09, T-12-10 | trava é a 1ª instrução após o `begin`; `55P03` → 409 sem repetir; Q=0 com trava de reserva; 2 `executar()` simultâneas com `hidratar` ×2 | unit (fake) + Docker | `cd apps/api && DATABASE_URL= npx vitest run src/persistencia/unidade-de-trabalho-trava.test.ts src/persistencia/unidade-de-trabalho.test.ts src/rotas/operacoes-medicao.test.ts && npx tsc --noEmit` + Docker `unidade-de-trabalho-concorrencia.test.ts` | ✅ + ❌ W0 (concorrência) | ⬜ pending |
| 12-04-02 | 12-04 | 4 | GRV-03 | T-12-11 | só as quatro importações longas no regime otimista | unit (lê o código-fonte) | `cd apps/api && DATABASE_URL= npx vitest run src/persistencia/regime-dos-chamadores.test.ts src/importacao && npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 12-04-03 | 12-04 | 4 | GRV-03 | T-12-12 | portão contra Postgres local e suíte sem banco inteira | Docker + suíte | Docker `src/persistencia`, `operacoes`, `estado`, `formularios-publicos`, `scheduler-worker`, `medir-gravacao`, e2e; `cd apps/api && DATABASE_URL= DATABASE_URL_MIGRACAO= npx vitest run && npx tsc --noEmit` | ✅ | ⬜ pending |
| 12-05-01 | 12-05 | 5 | GRV-04 | T-12-13 | `run` com 2 chamadas aplica 2 diferenças e não chama `hidratar`; `transporteHttp.gravar` devolve a lista | unit (transporte e `fetch` falsos) | `cd apps/web && npx tsc --noEmit && npx vitest run src/dados/store.test.ts src/dados/transporte.test.ts` | ✅ (novos casos) | ⬜ pending |
| 12-05-02 | 12-05 | 5 | GRV-04 | T-12-13 | resposta fora de ordem re-hidrata 1 vez; conflito e falha no meio | unit + suíte web | `cd apps/web && npx vitest run && cd ../.. && npm run lint -w @n1/web` | ✅ | ⬜ pending |
| 12-06-01 | 12-06 | 6 | GRV-05 | T-12-14 | `data.lists` tem a Lista antes de o transporte responder; recusa e falha a tiram com `lastResult.error` | unit (transporte lento) + suíte web | `cd apps/web && npx tsc --noEmit && npx vitest run src/dados` + `cd apps/web && npx vitest run` | ✅ (inverter `(b)`) | ⬜ pending |
| 12-06-02 | 12-06 | 6 | GRV-05 | T-12-15, T-12-16 | um pedido por vez na ordem do clique; recusa do 1º refaz o 2º; `rehidratar` de fora espera a vez (Pitfall 3) | unit + suíte web | `cd apps/web && npx vitest run && cd ../.. && npm run lint -w @n1/web` | ✅ (novos casos) | ⬜ pending |
| 12-07-01 | 12-07 | 7 | GRV-05 | T-12-17, T-12-18 | `createForm` espera o servidor e mostra o segredo dele; chaves válidas, motivos não vazios | unit | `cd apps/web && npx tsc --noEmit && npx vitest run src/dados/operacoes-que-esperam.test.ts src/dados/store.test.ts` | ❌ W0 | ⬜ pending |
| 12-07-02 | 12-07 | 7 | GRV-05 | T-12-17 | levantamento fechado; conjunto de chaves igual ao registrado | unit + grep | `cd apps/web && npx tsc --noEmit && npx vitest run src/dados` | ❌ W0 | ⬜ pending |
| 12-08-01 | 12-08 | 8 | GRV-05 | T-12-19 | Lista nova sem link e com `aria-busy` até confirmar; depois com link | jsdom | `cd apps/web && npx tsc --noEmit && npx vitest run src/features/shell src/dados` | ❌ W0 (`arvore-salvando.test.tsx`) | ⬜ pending |
| 12-08-02 | 12-08 | 8 | GRV-05 | T-12-19 | Tarefa e Subtarefa pendentes não abrem; "Abrir em página cheia" desligado | jsdom + suíte web | `cd apps/web && npx tsc --noEmit && npx vitest run src/features/estrutura/tarefa-salvando.test.tsx src/features/estrutura/pagina-da-lista-visualizacoes.test.tsx` + `cd apps/web && npx vitest run && cd ../.. && npm run lint -w @n1/web` | ❌ W0 | ⬜ pending |
| 12-09-01 | 12-09 | 9 | GRV-05 | T-12-24, T-12-21 | com o `StoreProvider` de verdade, a guarda cancela `click`/`auxclick` em âncora com id pendente e só ela; solta depois da confirmação e ao desmontar | jsdom + unit | `cd apps/web && npx tsc --noEmit && npx vitest run src/dados` | ❌ W0 (`guarda-de-navegacao.test.tsx`) | ⬜ pending |
| 12-09-02 | 12-09 | 9 | GRV-05 | T-12-20 | `beforeunload` só com `pendentes > 0`; suíte web, lint e build | unit + suíte web + build | `cd apps/web && npx tsc --noEmit && npx vitest run src/dados` + `cd apps/web && npx vitest run && cd ../.. && npm run lint -w @n1/web && npm run build` | ✅ (novo caso em `store.test.ts`) | ⬜ pending |
| 12-10-01 | 12-10 | 10 | GRV-06 | T-12-22 | `npm run check` verde contra Postgres local; regime travado na saída do comando | suíte inteira (Docker) | `npm run migrar -w @n1/api` + `npm run check` com `DATABASE_URL`/`DATABASE_URL_MIGRACAO` do Docker | ✅ | ⬜ pending |
| 12-10-02 | 12-10 | 10 | GRV-06 | T-12-22, T-12-23 | o "depois" em produção com o mesmo comando; Lista aparece na hora na tela | manual (dono) | o mesmo `ssh … gravacao:medir … --repeticoes=10` do "antes" | n/a | ⬜ pending |
| 12-10-03 | 12-10 | 10 | GRV-06 | — | tabela antes/depois/meta e pronto da 2.2 | grep | `grep -c "Comparação com a meta (D-08)" .planning/phases/12-clone-clickup-grava-o-mais-r-pida/12-PROVAS.md` | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Cada arquivo nasce na primeira tarefa que o usa (TDD dentro da própria tarefa):

- [ ] `apps/api/src/rotas/operacoes-medicao.test.ts` — GRV-01 (12-01-01)
- [ ] `apps/api/src/observabilidade/medicao-da-gravacao.test.ts` — GRV-01 (12-02-01)
- [ ] `apps/api/src/observabilidade/medir-gravacao.test.ts` — GRV-01, Postgres local (12-02-01)
- [ ] `apps/api/src/persistencia/unidade-de-trabalho-concorrencia.test.ts` — GRV-03, Postgres local, `describeComBanco` (12-04-01)
- [ ] `apps/api/src/persistencia/regime-dos-chamadores.test.ts` — GRV-03 (12-04-02)
- [ ] `apps/web/src/dados/operacoes-que-esperam.test.ts` — GRV-05 (12-07-01)
- [ ] `apps/web/src/features/shell/arvore-salvando.test.tsx` — GRV-05 (12-08-01)
- [ ] `apps/web/src/features/estrutura/tarefa-salvando.test.tsx` — GRV-05 (12-08-02)
- [ ] `apps/web/src/dados/guarda-de-navegacao.test.tsx` — GRV-05 (12-09-01, traçador do plano)
- [ ] Ajuste dos fakes de `unidade-de-trabalho*.test.ts` (linha do `select … for update`, `linhasLidas` defensivo) — 12-01-01 e 12-04-01
- [ ] Auxiliar `transporteLento` em `store.test.ts` (promessa que o teste solta) — 12-06-01
- [ ] Contêiner Docker local `postgres:16` para os testes com banco (já disponível; sem instalação)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| O comando repete os 4 gestos ×10 em produção e imprime a tabela "antes"; tamanho de `plataforma.registros` | GRV-01 | roda na VPS contra o banco real; ação do dono | `ssh … 'cd /opt/n1-crm/current && npm run gravacao:medir -w @n1/api -- --repeticoes=10'` → `12-PROVAS.md` |
| Parada `[BLOCKING]` com a tabela "antes" na mão do dono; meta fixada | GRV-02 | decisão do dono | preencher "Meta (fixada na parada)" no `12-CONTEXT.md`; conferir com `grep -n "Meta (fixada na parada)" -A3 .planning/phases/12-*/12-CONTEXT.md` (sem "A preencher") |
| Tabela "depois" com o mesmo comando, comparada à meta | GRV-06 | roda na VPS; ação do dono | idem GRV-01, depois de publicar a trava e o store (12-10-02) |
| A linha "gravacao medida" no log do serviço real (D-03) | GRV-01, GRV-06 | log da VPS | `sudo journalctl --no-pager -u n1-crm-api.service -n 80 \| grep "gravacao medida"` depois de um gesto na tela (12-02-03 e 12-10-02) |
| Criar uma Lista em produção aparece na árvore na hora, "salvando" e sem link, e vira link | GRV-05 | comportamento visual em produção | 12-10-02, passo 3 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
