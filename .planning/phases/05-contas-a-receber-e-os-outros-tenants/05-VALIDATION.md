---
phase: 5
slug: contas-a-receber-e-os-outros-tenants
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-23
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derivada de `05-RESEARCH.md` §Validation Architecture. Três entregas com
> maturidades diferentes (TEN-01 e AUTO-02 prescritivos; REC-01 atrás de um
> checkpoint humano) — a amostragem reflete isso.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (`crm-n1`)** | Vitest (`vitest run` em `packages/dominio`, `apps/api`, `apps/web`) |
| **Framework (`financeiro-tria/automation`)** | `node:test` via `tsx --test --test-concurrency=1 "src/**/*.test.ts"` |
| **Config file** | `vitest.config.mts` por workspace; `automation/` sem config além do script |
| **Quick run command** | `npm run test --workspace=@n1/dominio -- contas-a-receber` · `-- automations` · `npm test -w automation -- <termo>` |
| **Full suite command** | `npm run check` (raiz) **e** `cd ../financeiro-tria/automation && npm test` |
| **Estimated runtime** | ~90 s (`npm run check`) + ~30 s (`automation/`) |

---

## Sampling Rate

- **After every task commit:** teste focado do módulo tocado, no repositório dele.
- **After every plan wave:** `npm run check` nos três workspaces **e** `npm test`
  no `automation/` — separadamente, porque são repositórios distintos e CON-05
  proíbe alterar no `automation/` o que não é desta fase.
- **Before `/gsd-verify-work`:** as duas suítes verdes.
- **Max feedback latency:** 120 s.

**Portão bloqueante desta fase (D5-02):** nenhuma tarefa de código de REC-01
começa antes de (a) a conferência somente-leitura de `ws_n1` ter rodado e (b) o
checkpoint de D7 ter sido respondido **ou** o default (ramo processo) ter sido
acionado explicitamente. Código escrito antes disso é retrabalho por construção.

---

## Per-Task Verification Map

> Preenchido por plano durante `/gsd-plan-phase`. As linhas abaixo são o mapa
> mínimo derivado de `05-RESEARCH.md`.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 1 | TEN-01 | — | Evolver acrescenta a Empresa ao Campo `Empresa` sem duplicar nem sobrescrever quando roda duas vezes (idempotência, molde do evolver de 02-08) | unit (domínio) | `npm run test --workspace=@n1/dominio -- evolver` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | TEN-01 | — | O 5º Status `em revisão` só é alcançável pela Automação da Empresa que o declara; TRIA nunca chega lá | unit (domínio) | `npm run test --workspace=@n1/dominio -- automations` | ✅ (arquivo existe; caso novo) | ⬜ pending |
| TBD | TBD | 1 | TEN-01 | T-5-SEC | Nenhum `app_key`/`app_secret` entra no schema `plataforma`: a Integração guarda rótulo, situação e data de rotação — provado por nome de campo | unit (domínio) | `npm run test --workspace=@n1/dominio -- integracao` | ❌ W0 | ⬜ pending |
| TBD | TBD | 2 | TEN-01 | T-5-ROUTE | Roteamento de tenant vem do payload, não do path — `webhooks-plataforma.ts:347` deixa de ter `tenantId: "tria"` fixo; Empresa desconhecida é recusa, nunca cai em TRIA por omissão | integration (`automation/`) | `npm test -w automation -- webhooks-plataforma` | ❌ W0 | ⬜ pending |
| TBD | TBD | 2 | AUTO-02 | — | `notificar` com Campo de destino vazio recusa visivelmente na Execução e **não envia nada** — nunca um número padrão | unit (domínio) | `npm run test --workspace=@n1/dominio -- automations` | ❌ W0 | ⬜ pending |
| TBD | TBD | 2 | AUTO-02 | T-5-TX | O evento de canal grava no outbox **dentro** da transação (mesma garantia de D-18); nenhuma chamada de rede dentro da UoW | integration (`apps/api`) | `npm run test --workspace=@n1/api -- outbox` | ❌ W0 | ⬜ pending |
| TBD | TBD | 3 | AUTO-02 | T-5-AUTH | Rota de canal no `automation/` recusa sem Bearer válido (tempo constante) e é idempotente no replay | integration (`automation/`) | `npm test -w automation -- notificar-canal` | ❌ W0 | ⬜ pending |
| TBD | TBD | 4 | REC-01 | — | **Checkpoint bloqueante:** `ws_n1` conferido contra `seed-contas-a-receber.ts` e contra `docs/07-processos/contas-a-receber.md`; divergências listadas | manual/checkpoint | leitura somente-leitura com `DATABASE_URL` real | N/A | ⬜ pending |
| TBD | TBD | 5 | REC-01 | — | A importação das 240 Tarefas históricas **não dispara Automação nenhuma** no replay (molde de 03-09: `recordActivity` com o `at` original, nunca `changeTaskStatus`) | unit (domínio) | `npm run test --workspace=@n1/dominio -- importacao-contas-a-receber` | ❌ W0 | ⬜ pending |
| TBD | TBD | 5 | REC-01 | — | R2/R4/R5 são descobertos pelo `scheduler-worker.ts` sem código novo no motor — `CR.listId` aparece no catálogo dinâmico | integration (`apps/api`, requer Postgres) | `npm run test --workspace=@n1/api -- scheduler-worker` | ✅ (arquivo existe; caso novo) | ⬜ pending |
| TBD | TBD | 5 | REC-01 | — | RN-CR-01..07 e INV-CR-01/02 cobertas; Saque exige Valor > 0 (D5-14) e duplicata vira lacuna registrada, nunca fusão (D5-18) | unit (domínio) | `npm run test --workspace=@n1/dominio -- contas-a-receber` | ✅ parcial | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Evolver de configuração por Empresa (Campo `Empresa` + registro da Integração) — molde: o evolver idempotente de 02-08
- [ ] Caso `notificar` com canal em `automations*.test.ts` (destino vazio ⇒ recusa)
- [ ] Tipo de evento de canal em `apps/api/src/persistencia/outbox.ts` + teste de gravação transacional
- [ ] Rota de canal em `../financeiro-tria/automation/` + teste `tsx --test` (molde: `contas-a-pagar-routes.ts`)
- [ ] Teste do hardcode de tenant em `webhooks-plataforma.ts` (hoje inexistente)
- [ ] `importarContaAReceberHistorica` + teste (molde: `importacao-contas-a-pagar.test.ts`, Plan 03-09)
- [ ] Caso de `scheduler-worker.ts` cobrindo `CR.listId` (hoje só há caso para `CP.listId`)
- [ ] Nenhum framework novo, e **nenhum pacote novo** em nenhum dos dois repositórios

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| **D7 — onde o recebimento é controlado hoje** | REC-01 | É fato sobre a operação do Financeiro, não propriedade do código. Nenhum teste responde. | Uma pergunta ao Financeiro, com a evidência reunida ao lado (linhas de `contas_a_receber`, a Lista dormente desde out/2025, `grep -c "Receber"` = 0 em `adapters/omie.ts`). Sem resposta dentro da fase, acionar o default de D5-02 explicitamente e registrar a decisão. |
| Conferência de `ws_n1` contra o catálogo de Contas a receber | REC-01 / D5-02b | Precisa do banco de produção; nenhum teste local prova o que está lá | `DATABASE_URL` real, leitura somente-leitura, comparando Lista/Status/Campos/Automações com `seed-contas-a-receber.ts` |
| Corte conjunto de MP e FO | TEN-01 / D5-07 | Estado operacional no ClickUp | Confirmar que `901111928443` é mesmo a Lista compartilhada, desligar os webhooks **antes** de arquivar, e provar zero double-write no Omie por coorte |
| Prazos reais de R4/R5 | REC-01 / D5-15 | 30/60 dias vêm de um caso só (Kennedy) | Perguntar ao Financeiro; até lá o valor inicial fica na configuração, não no código |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120 s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
