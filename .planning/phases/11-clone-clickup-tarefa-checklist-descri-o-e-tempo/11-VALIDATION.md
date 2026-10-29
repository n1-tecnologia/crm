---
phase: "11"
slug: "clone-clickup-tarefa-checklist-descri-o-e-tempo"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-29"
---

# Phase 11 — Validation Strategy

> Contrato de validação por fase para amostragem de feedback durante a execução.
> Fonte: `11-RESEARCH.md` § Validation Architecture. A coluna "Task ID" é preenchida pelo planejador quando os planos existirem.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 5.0.1 nos 3 workspaces; `@testing-library/react` + jsdom no `apps/web` (jsdom por pragma de arquivo) |
| **Config file** | `packages/dominio/vitest.config.mts`, `apps/api/vitest.config.mts` (`fileParallelism: false`, timeout 180 s), `apps/web/vitest.config.mts` |
| **Quick run command** | por arquivo, ex.: `cd packages/dominio && npx vitest run <arquivos> && npx tsc --noEmit` · `cd apps/api && DATABASE_URL= npx vitest run src/rotas/esquemas-de-argumentos.test.ts` · `cd apps/web && npx vitest run <arquivos>` |
| **Full suite command** | `npm run check` (cerca de 3 min com Postgres local; 13–17 min com o remoto) — só no gate da fase, em segundo plano |
| **Estimated runtime** | quick: ≤ 5 s por comando · onda: poucos segundos · fase: ~3 min com Postgres de Docker local |

---

## Sampling Rate

- **After every task commit:** o comando da linha do requisito (≤ 5 s) + `npx tsc --noEmit` do workspace tocado
- **After every plan wave:** `cd packages/dominio && npx vitest run` e `cd apps/web && npx vitest run src/features/estrutura src/features/tarefa`
- **Before `/gsd-verify-work`:** `npm run check` com Postgres local (Docker) + e2e local de `GET /estado` / `POST /operacoes` (o campo novo e o `before`/`after` maior trafegam por essas rotas)
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| a definir | — | — | TAR-01 | V4 | recusa por `taskWriteRefusal`, Lista sem Subtarefas e nível máximo, antes de qualquer efeito | unit (domínio) | `cd packages/dominio && npx vitest run src/operations/conversao-de-item.test.ts src/operations/operations.test.ts -t "onvers"` | ❌ W0 | ⬜ pending |
| a definir | — | — | TAR-02 | V4 | botão só onde `conversaoDeItemRecusada` devolve `undefined`; cartão do Quadro sem gesto | componente (jsdom) + UAT | `cd apps/web && npx vitest run src/features/estrutura/conversao-de-item.test.tsx` | ❌ W0 | ⬜ pending |
| a definir | — | — | TAR-03 | — | nenhum `parentItemId` sobra; `removeChecklistItem` remove só o item | grep + unit | `grep -rn parentItemId packages apps --exclude-dir=node_modules --exclude-dir=.next` (vazio) · `cd packages/dominio && npx vitest run src/operations/remover-checklist-e-item.test.ts src/tarefa-publica.test.ts && npx tsc --noEmit` | ✅ (editar) | ⬜ pending |
| a definir | — | — | TAR-04 | V5 | Membro inexistente recusado; esquema `.strict()` aceita `descriptionMentions`; texto React, sem `dangerouslySetInnerHTML` | unit + esquema + componente | `cd packages/dominio && npx vitest run src/operations/descricao-da-tarefa.test.ts` · `cd apps/api && DATABASE_URL= npx vitest run src/rotas/esquemas-de-argumentos.test.ts` · `cd apps/web && npx vitest run src/features/estrutura/mencoes.test.tsx` | ❌ W0 (3 novos); esquema ✅ | ⬜ pending |
| a definir | — | — | TAR-05 | V4 | menção avisa só com `@Nome` no texto, Tarefa aberta e `memberSeesTask` | unit + componente | `cd packages/dominio && npx vitest run src/operations/descricao-da-tarefa.test.ts src/operations/pessoa-da-conta.test.ts src/operations/automations-motor.test.ts src/operations/tags-e-observadores.test.ts` | ❌ W0; 3 existentes ✅ (narrowing da união) | ⬜ pending |
| a definir | — | — | TAR-06 | V4, V8 | Ator de integração sem `before`/`after`; Atividade de Tarefa oculta não chega a quem não a vê; texto puro, sem `Rico` | unit + componente | `cd packages/dominio && npx vitest run src/operations/descricao-da-tarefa.test.ts src/derive-visibilidade.test.ts` · `cd apps/web && npx vitest run src/features/tarefa/timeline.test.tsx src/features/tarefa/feed-de-atividade.test.tsx` | ❌ W0 (Feed); `timeline.test.tsx` ✅ | ⬜ pending |
| a definir | — | — | TAR-07 | — | `tempoRegistrado` não lê o relógio; mesmo número na linha e no editor | unit + componente | `cd packages/dominio && npx vitest run src/tempo-registrado.test.ts` · `cd apps/web && npx vitest run src/features/estrutura/tempo.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/dominio/src/operations/conversao-de-item.test.ts` — TAR-01/03
- [ ] `packages/dominio/src/operations/descricao-da-tarefa.test.ts` — TAR-04/05/06 (usar `buildSeed()`, `tsk_seed_1`, `mem_thiago`)
- [ ] `packages/dominio/src/tempo-registrado.test.ts` — TAR-07
- [ ] `apps/web/src/features/tarefa/feed-de-atividade.test.tsx`, `apps/web/src/features/tarefa/alteracao-de-descricao.test.tsx` — TAR-06
- [ ] `apps/web/src/features/estrutura/mencoes.test.tsx`, `conversao-de-item.test.tsx`, `tempo.test.ts` — TAR-02/04/07
- [ ] Framework install: nenhum.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Destaque visual do nome mencionado na descrição (cor e contraste) | TAR-04 | percepção visual, não assertável em jsdom | abrir uma Tarefa, escrever "@Júlia revisar" na descrição, salvar e conferir o destaque nos temas claro e escuro |
| "Abrir" leva à Subtarefa real após a confirmação do servidor | TAR-02 | o id vem do servidor | converter um item numa Lista com Subtarefas, clicar em "Abrir" no aviso e conferir que abre a Subtarefa nova |
| A sensação de "um clique" e a cor normal do botão | TAR-02 | julgamento de interface | conferir que "Converter em Subtarefa" está na cor normal e que a confirmação não pede digitar |
| Botão ausente numa Lista real sem Subtarefas e em Tarefa no último nível | TAR-02 | depende de dados reais da Lista | abrir uma Tarefa dessas Listas e conferir que o botão não aparece |
| O aviso aparece no sino e no Início da pessoa mencionada | TAR-05 | exige login como outro Membro | mencionar um Membro na descrição, entrar como ele e conferir Notificações › "Menções a você"; tirar o nome e conferir que some |
| Nenhum registro de produção carrega `parentItemId` (A1) | TAR-03 | o banco remoto não é acessível ao pesquisador | consulta só de leitura do Q1 do `11-RESEARCH.md`; checkpoint `human-verify` no último plano; zero achados = sem ação de migração |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
