---
phase: "11"
slug: "clone-clickup-tarefa-checklist-descri-o-e-tempo"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
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
| 11-01-T1 | 11-01 | 1 | TAR-01 | T-11-01, T-11-02 | recusa por `taskWriteRefusal`, Tarefa inativa, Lista sem Subtarefas e nível máximo, antes de qualquer efeito; esquema de 3 argumentos | unit (domínio) + esquema | `cd packages/dominio && npx vitest run src/operations/conversao-de-item.test.ts src/operations/operations.test.ts src/operations/remover-checklist-e-item.test.ts src/operations/recusas-sem-codigo.test.ts src/quem-pode.test.ts && npx tsc --noEmit` · `cd apps/api && DATABASE_URL= npx vitest run src/rotas/esquemas-de-argumentos.test.ts && npx tsc --noEmit` | ✅ criado na task | ✅ green |
| 11-01-T2 | 11-01 | 1 | TAR-03 | — | `removeChecklistItem` remove só o Item; nenhum uso de Subitem no domínio | unit + grep | `cd packages/dominio && npx vitest run src/operations/remover-checklist-e-item.test.ts src/tarefa-publica.test.ts src/operations/conversao-de-item.test.ts src/operations/operations.test.ts && npx tsc --noEmit` | ✅ (editar) | ✅ green |
| 11-01-T3 | 11-01 | 1 | TAR-03 | T-11-03 | nenhum `parentItemId` sobra em `packages`/`apps`; três `tsc` verdes | grep + tsc | `! grep -rn "parentItemId" packages apps --include='*.ts' --include='*.tsx' --exclude-dir=node_modules --exclude-dir=.next` · `cd packages/dominio && npx tsc --noEmit && cd ../../apps/api && npx tsc --noEmit && cd ../web && npx tsc --noEmit` | ✅ | ✅ green |
| 11-02-T1 | 11-02 | 2 | TAR-04, TAR-06 | T-11-04, T-11-07, T-11-08 | Membro inexistente recusado antes de mutar; lista derivada do texto; `before`/`after` cortados em 2.000 + "…"; esquema `.strict()` aceita `descriptionMentions` | unit + esquema | `cd packages/dominio && npx vitest run src/operations/descricao-da-tarefa.test.ts src/operations/operations.test.ts src/operations/recusas-sem-codigo.test.ts src/quem-pode.test.ts && npx tsc --noEmit` · `cd apps/api && DATABASE_URL= npx vitest run src/rotas/esquemas-de-argumentos.test.ts && npx tsc --noEmit` | ✅ criado na task | ✅ green |
| 11-02-T2 | 11-02 | 2 | TAR-04, TAR-06 | T-11-05 | filtro na leitura (D-09); Atividade com texto não chega a quem não vê a Tarefa (D-14) | unit | `cd packages/dominio && npx vitest run src/operations/descricao-da-tarefa.test.ts src/derive-visibilidade.test.ts && npx tsc --noEmit` | ✅ (estender) | ✅ green |
| 11-03-T1 | 11-03 | 2 | TAR-07 | T-11-09 | `tempoRegistrado` só de `state`; editor mostra o número do domínio | unit + componente | `cd packages/dominio && npx vitest run src/tempo-registrado.test.ts && npx tsc --noEmit` · `cd apps/web && npx vitest run src/features/estrutura/tempo-da-tarefa.test.tsx && npx tsc --noEmit` | ✅ criado na task | ✅ green |
| 11-03-T2 | 11-03 | 2 | TAR-07 | — | bordas (zero, só aberto, lixeira, ciclo), sem relógio, mesmo formatador na linha | unit | `cd packages/dominio && npx vitest run src/tempo-registrado.test.ts` · `cd apps/web && npx vitest run src/features/estrutura/tempo.test.ts src/features/estrutura/tempo-da-tarefa.test.tsx` | ✅ criado na task | ✅ green |
| 11-04-T1 | 11-04 | 3 | TAR-05 | T-11-10, T-11-12 | variante `descricao` em `pendingMentions`; página de Notificações mostra o trecho como texto | unit + componente | `cd packages/dominio && npx vitest run src/operations/mencao-na-descricao.test.ts src/operations/pessoa-da-conta.test.ts src/operations/automations-motor.test.ts src/operations/tags-e-observadores.test.ts src/operations/operations.test.ts && npx tsc --noEmit` · `cd apps/web && npx vitest run "src/app/(shell)/notificacoes/notificacoes.test.tsx" src/features/inicio && npx tsc --noEmit` | ✅ criado na task | ✅ green |
| 11-04-T2 | 11-04 | 3 | TAR-05 | T-11-10, T-11-11 | some ao fechar/lixeira/tirar o nome; forjada e quem não vê não recebem | unit + componente | `cd packages/dominio && npx vitest run src/operations/mencao-na-descricao.test.ts` · `cd apps/web && npx vitest run "src/app/(shell)/notificacoes/notificacoes.test.tsx"` | ✅ criado na T1 | ✅ green |
| 11-05-T1 | 11-05 | 3 | TAR-04 | T-11-13 | "@Jú" abre o menu; Salvar manda `descriptionMentions` derivada do texto | componente (jsdom) | `cd apps/web && npx vitest run src/features/estrutura/mencoes.test.tsx && npx tsc --noEmit` | ✅ criado na task | ✅ green |
| 11-05-T2 | 11-05 | 3 | TAR-04 | T-11-14 | Comentário no mesmo hook, teclado igual; escolhidos de antes mantidos | componente (jsdom) | `cd apps/web && npx vitest run src/features/estrutura/mencoes.test.tsx src/features/tarefa/timeline.test.tsx src/features/estrutura/sem-codigo-de-regra.test.ts` | ✅ criado na T1 | ✅ green |
| 11-06-T1 | 11-06 | 3 | TAR-06 | T-11-15, T-11-16 | "Ver alteração" no Feed; integração sem botão; texto puro | componente (jsdom) | `cd apps/web && npx vitest run src/features/tarefa/alteracao-de-descricao.test.tsx src/features/tarefa/feed-de-atividade.test.tsx && npx tsc --noEmit` | ✅ criado na task | ✅ green |
| 11-06-T2 | 11-06 | 3 | TAR-06 | T-11-15 | Timeline com o mesmo componente | componente (jsdom) | `cd apps/web && npx vitest run src/features/tarefa/timeline.test.tsx src/features/tarefa/timeline-responder.test.tsx` | ✅ (estender) | ✅ green |
| 11-06-T3 | 11-06 | 3 | TAR-06 | — | Auditoria e Reunião sem o texto inline | tsc + grep | `cd apps/web && npx tsc --noEmit && npx eslint "src/app/(shell)/configuracoes/auditoria/page.tsx" "src/app/(shell)/crm/reunioes/[reuniao]/page.tsx"` | ✅ | ✅ green |
| 11-07-T1 | 11-07 | 3 | TAR-02 | T-11-18, T-11-19 | botão só onde a derivada deixa; um clique; id do servidor; cartão sem gesto | componente (jsdom) + UAT | `cd apps/web && npx vitest run src/features/estrutura/conversao-de-item.test.tsx src/features/estrutura/sem-codigo-de-regra.test.ts && npx tsc --noEmit` | ✅ criado na task | ✅ green |
| 11-07-T2 | 11-07 | 3 | TAR-04 | T-11-17 | `@Nome` destacado por `<span>`, sem HTML | componente (jsdom) + UAT | `cd apps/web && npx vitest run src/features/estrutura/descricao-da-tarefa.test.tsx && npx tsc --noEmit` | ✅ criado na task | ✅ green |
| 11-07-T3 | 11-07 | 3 | TAR-07 | — | linha "Rastrear tempo" = editor; arquivo não cresce | tsc + pasta | `cd apps/web && npx tsc --noEmit && npx eslint src/features/estrutura && npx vitest run src/features/estrutura` · `wc -l "apps/web/src/features/estrutura/tarefa-completa.tsx" \| awk '{ exit ($1 > 2371) }'` | ✅ | ✅ green |
| 11-08-T1 | 11-08 | 4 | TAR-04, TAR-06 | T-11-20, T-11-21 | e2e local de `POST /operacoes` e `GET /estado` (Docker, porta 55618) | e2e (api) | `cd apps/api && DATABASE_URL=postgres://postgres:x@localhost:55618/postgres DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:55618/postgres npx vitest run src/rotas/operacoes.test.ts src/rotas/estado.test.ts src/seguranca/dados-de-outro-membro.test.ts && npx tsc --noEmit` | ✅ (estender) | ✅ green |
| 11-08-T2 | 11-08 | 4 | TAR-03 | — | portão `npm run check` no banco local; "Quem pode" coberto | suíte | `DATABASE_URL=… DATABASE_URL_MIGRACAO=… npm run check` (segundo plano) · `cd packages/dominio && npx vitest run src/quem-pode.test.ts` | ✅ | ✅ green |
| 11-08-T3 | 11-08 | 4 | TAR-03 | — | consulta de produção (A1) e UAT | manual (checkpoint) | — (dono) | — | ✅ green (manual: dono, 29/10/2026; A1 = 0) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Cada arquivo novo nasce na própria task que o usa (tarefas `tdd="true"`), não numa onda 0 separada:

- [x] `packages/dominio/src/operations/conversao-de-item.test.ts` — TAR-01 (11-01-T1)
- [x] `packages/dominio/src/operations/descricao-da-tarefa.test.ts` — TAR-04/06 (11-02-T1)
- [x] `packages/dominio/src/operations/mencao-na-descricao.test.ts` — TAR-05 (11-04-T1)
- [x] `packages/dominio/src/tempo-registrado.test.ts` — TAR-07 (11-03-T1)
- [x] `apps/web/src/features/estrutura/tempo.test.ts`, `tempo-da-tarefa.test.tsx` — TAR-07 (11-03)
- [x] `apps/web/src/app/(shell)/notificacoes/notificacoes.test.tsx` — TAR-05 (11-04-T1)
- [x] `apps/web/src/features/estrutura/mencoes.test.tsx` — TAR-04 (11-05-T1)
- [x] `apps/web/src/features/tarefa/alteracao-de-descricao.test.tsx`, `feed-de-atividade.test.tsx` — TAR-06 (11-06-T1)
- [x] `apps/web/src/features/estrutura/conversao-de-item.test.tsx`, `descricao-da-tarefa.test.tsx` — TAR-02/04 (11-07)
- [x] Framework install: nenhum.

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

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s (por arquivo, 0,5 a 5 s; a suíte inteira roda só no portão da fase)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validado em 29/10/2026 (suíte `npm run check` verde no Postgres local; itens manuais aprovados pelo dono)

## Validation Audit 2026-10-29

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
