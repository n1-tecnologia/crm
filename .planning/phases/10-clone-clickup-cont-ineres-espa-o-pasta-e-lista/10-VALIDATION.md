---
phase: "10"
slug: "clone-clickup-cont-ineres-espa-o-pasta-e-lista"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-28"
---

# Phase 10 — Validation Strategy

> Contrato de validação da fase para amostragem de feedback durante a execução. Fonte: `10-RESEARCH.md` § Validation Architecture. O planejador troca "Plano/Onda" pelos números reais e o `gsd-plan-checker` confere a Dimensão 8.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.0.1 nos três workspaces; jsdom 30 + Testing Library no `apps/web`; Playwright só para e2e de produção |
| **Config file** | `packages/dominio/vitest.config.mts` (node) · `apps/web/vitest.config.mts` (node; `// @vitest-environment jsdom` por arquivo) · `apps/api/vitest.config.mts` (`fileParallelism: false`, timeout 180 s) |
| **Quick run command** | por arquivo: `cd packages/dominio && npx vitest run <arq>` · `cd apps/web && npx vitest run <arq>` · `cd apps/api && DATABASE_URL= npx vitest run <arq>` |
| **Full suite command** | `npm run check` (raiz; 13–17 min; baseline: `lote-contas-a-pagar (d)` falha por rede) — só no fim da fase |
| **Estimated runtime** | quick ≈ 1–5 s por arquivo; `tsc --noEmit` ≈ 2 s por workspace; full ≈ 13–17 min |

**Regra de ouro dos testes de `apps/api`:** sempre prefixar `DATABASE_URL=` (vazio) ou uma URL `localhost`. Testes que usam `Boolean(process.env.DATABASE_URL)` leem o `.env` e falam com o Postgres remoto de produção. Testes novos de banco usam `describeComBanco`.

**Postgres local descartável (testes de banco desta fase):**

```
docker run -d --rm --name crm-n1-pg-1001 -e POSTGRES_PASSWORD=x -p 55701:5432 postgres:16
export DATABASE_URL=postgres://postgres:x@localhost:55701/postgres DATABASE_URL_MIGRACAO=$DATABASE_URL
cd apps/api && npm run migrar && npx vitest run <arquivo>
```

Convenção da fase: `crm-n1-pg-10NN` / porta `557NN`. O contêiner Supabase de outro projeto em 54322 não se usa.

---

## Sampling Rate

- **After every task commit:** o(s) arquivo(s) de teste tocados (≤ 5 s cada) + `npx tsc --noEmit` do workspace tocado
- **After every plan wave:** `npx tsc --noEmit` nos três workspaces + `npm run lint -w @n1/web` + `npm run verificar:tokens` + os arquivos de teste da onda
- **Before `/gsd-verify-work`:** `npm run check` em segundo plano; comparar só o conjunto de falhas com o baseline (se sair código 124, api sem o e2e `lote-contas-a-pagar`, depois web e domínio)
- **Suíte de segurança:** `cd apps/api && npx vitest run src/seguranca src/rotas/estado.test.ts` com Postgres local como `n1_api` (job `seguranca` do CI)
- **Max feedback latency:** 10 s por tarefa

---

## Per-Task Verification Map

O planejador substitui "TBD" pelos IDs reais de tarefa (`10-NN-MM`). Uma linha por comportamento verificável de cada requisito.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | EST-01 | agendador sem ator que administre a Lista | regime (ensaio × direto) e ator por Lista, puros; a Lista só-lixeira não elimina Tarefa sem o dono ter visto a contagem | unit (domínio) | `cd packages/dominio && npx vitest run src/operations/agenda-do-relogio.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | EST-01 | — | catálogo inclui só-recorrência e só-lixeira; Lista fora de CP/CR processada; a volta drena N linhas; a ponte compõe os 3 relógios | integration (Postgres local) | `cd apps/api && npx vitest run src/automacoes/scheduler-worker.test.ts src/automacoes/invocar-agente.test.ts` | ✅ (casos novos ❌ W0) | ⬜ pending |
| TBD | TBD | TBD | EST-01 | — | nenhuma tela tem "Rodar agenda…" nem "Rodar automações por vencimento" | grep-as-test | `cd apps/web && npx vitest run src/features/estrutura/sem-rodar-agenda.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | EST-02 | — | `SelecaoEmLote` única nas três lentes; `BulkStatusBar` intacta | unit/jsdom | `cd apps/web && npx vitest run src/features/estrutura/bulk-status-bar.test.tsx src/features/estrutura/selecao-em-lote.test.tsx` | ✅ / ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | EST-02 | — | `listas/[lista]/page.tsx` abaixo de 1.000 linhas | shell | `test "$(wc -l < 'apps/web/src/app/(shell)/estrutura/listas/[lista]/page.tsx')" -lt 1000` | n/a | ⬜ pending |
| TBD | TBD | TBD | EST-02 | — | "Mostrando X de Y Tarefas." | unit/jsdom | `cd apps/web && npx vitest run src/features/estrutura/contagem-filtrada.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | EST-03 | — | `?aba=` abre a aba; aba desconhecida cai em `geral`; "Aspectos configuráveis" ausente | jsdom + grep | `cd apps/web && npx vitest run src/features/estrutura/container-settings.test.tsx` e `! grep -rn 'Aspectos configuráveis' apps/web/src` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | EST-04 | — | 9 cadeias da web e 4 do domínio sem código de regra | unit | `cd apps/web && npx vitest run src/features/estrutura/sem-codigo-de-regra.test.ts` e `cd packages/dominio && npx vitest run src/operations/contas-a-receber.test.ts src/operations/operations.test.ts` | ❌ W0 / ✅ (editar `contas-a-receber.test.ts:129`) | ⬜ pending |
| TBD | TBD | TBD | EST-05 | mover quebra privacidade, herança ou bloqueio | mesmo Conjunto, outro com e sem mapeamento, Campo arquivado, Pasta com Subpastas recusada, promoção/rebaixamento, destino que bloqueia, colisão de nome, Formulário, Tipo, `order`; reordenar por grupo | unit (domínio) | `cd packages/dominio && npx vitest run src/operations/mover-conteiner.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | EST-06 | — | zona de soltura (função pura) | unit | `cd apps/web && npx vitest run src/features/shell/zona-de-soltura.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | EST-06 | Convidado arrasta | arrastar/soltar na árvore, ordem por `order`, árvore inerte para Convidado | jsdom | `cd apps/web && npx vitest run src/features/shell/arvore-arrastavel.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | EST-06 | — | mover/reordenar persiste e sobrevive ao recarregar | integration (Postgres local) | `cd apps/api && npx vitest run src/rotas/mover-conteiner.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | EST-07 | — | sem Carga nem capacidade; `saveView kind: carga` ⇒ 400 | unit + grep | `cd apps/api && DATABASE_URL= npx vitest run src/rotas/esquemas/escala.test.ts src/rotas/esquemas/planejamento.test.ts` e `! grep -rn 'workload\|weeklyCapacityMinutes' packages apps --include='*.ts' --include='*.tsx'` | ✅ (editar) | ⬜ pending |
| TBD | TBD | TBD | EST-08 | — | disponíveis/inicial herdam pelo caminho; `null` volta a herdar; recusa vazio e inicial fora; salva de tipo indisponível some e volta | unit (domínio) + jsdom | `cd packages/dominio && npx vitest run src/operations/visualizacoes-padrao.test.ts` e `cd apps/web && npx vitest run src/features/estrutura/tipo-de-visualizacao.test.ts src/features/estrutura/view-bar.test.tsx` | ❌ W0 / ✅ (editar) | ⬜ pending |
| TBD | TBD | TBD | EST-09 | — | o tipo recusa `blocks` em Lista; `bloqueado` fora de `InheritanceMode` | typecheck | `cd packages/dominio && npx tsc --noEmit` (+ `// @ts-expect-error` num teste de tipos) | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | EST-10 | bloquear sem avisar quem sobrescreve | `setContainerBlock` recusa nomeando só as Pastas/Listas alcançáveis; os aspectos que acumulam não recusam; `criarAutomacao` recusada sob bloqueio | unit (domínio) | `cd packages/dominio && npx vitest run src/operations/bloqueio-de-aspecto.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | EST-11 | DML em produção | `010`: contagens 0, idempotente, não toca outras coleções; pós-condição desfaz a transação se sobrar linha | integration (Postgres local) | `cd apps/api && npx vitest run src/persistencia/migracao-010.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | EST-11 | operação nova sem esquema ou sem linha em "Quem pode" | as 4 operações novas na tabela; esquemas e contagem 286 → 289 | unit | `cd packages/dominio && npx vitest run src/quem-pode.test.ts` e `cd apps/api && DATABASE_URL= npx vitest run src/rotas/esquemas-de-argumentos.test.ts` | ✅ (editar) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/dominio/src/operations/mover-conteiner.test.ts` — EST-05
- [ ] `packages/dominio/src/operations/visualizacoes-padrao.test.ts` — EST-08
- [ ] `packages/dominio/src/operations/bloqueio-de-aspecto.test.ts` — EST-10
- [ ] `packages/dominio/src/operations/agenda-do-relogio.test.ts` — EST-01
- [ ] `apps/web/src/features/shell/zona-de-soltura.test.ts`, `arvore-arrastavel.test.tsx` — EST-06
- [ ] `apps/web/src/features/estrutura/container-settings.test.tsx`, `selecao-em-lote.test.tsx`, `contagem-filtrada.test.tsx` — EST-02, EST-03
- [ ] `apps/web/src/features/estrutura/sem-codigo-de-regra.test.ts`, `sem-rodar-agenda.test.ts` — EST-04, EST-01
- [ ] `apps/api/src/rotas/mover-conteiner.test.ts`, `apps/api/src/persistencia/migracao-010.test.ts` — EST-06, EST-11
- [ ] casos novos em `apps/api/src/automacoes/scheduler-worker.test.ts` e `invocar-agente.test.ts` (os de banco com `describeComBanco`) — EST-01
- [ ] Framework: nada a instalar; `apps/web` já tem jsdom + Testing Library.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Agendador ligado em produção antes de o botão sair (D-04) | EST-01 | Estado da VPS e variáveis de ambiente de produção só o dono alcança | (a) no `api.env` da VPS ler `AUTOMACOES_WORKER_ATIVO`, `AUTOMACOES_ESPACO_ID`, `AUTOMACOES_LISTA_ID`, `AUTOMACOES_ATOR_MEMBER_ID` (deve estar vazio), `AUTOMACOES_ENSAIO_PRIMEIRA_VOLTA`, `AGENTE_CONTAS_A_PAGAR_ATIVO`; (b) log "scheduler de Automações ativo"; (c) Membro ativo no Papel `rol_sp_agente_pipeline` com `administrar` em CP/CR; (d) tratar os ~14 Espaços de teste (`AUTOMACOES_ESPACO_ID=ws_n1`); (e) contar Tarefas na lixeira acima do prazo por Lista; (f) no dia seguinte, uma linha nova em `plataforma.automacao_agenda` por Lista com agenda e nenhuma `falhou`/`RECUSA_DO_DOMINIO` |
| `010` aplicada em produção (D-19) | EST-11 | Produção tem dado real; migração aplicada é imutável | depois do deploy do código: `npm run migrar -w @n1/api -- --seco` (mostra `010` pendente), consultas de contagem prontas, aplicar, contagens = 0 |
| Arrastar no navegador real, auto-scroll, `draggable={false}` no Safari, toque | EST-06 | jsdom não reproduz o arrastar nativo | abrir a árvore e arrastar Lista, Pasta e Espaço (UAT de fim de fase) |
| Lista, Espaço, Pasta e Configurações aprovados pelo dono | EST-02, EST-03, EST-08, EST-10 | `human_verify_mode: end-of-phase` | o dono abre cada tela e aprova na UAT de fim de fase |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10 s por tarefa
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
