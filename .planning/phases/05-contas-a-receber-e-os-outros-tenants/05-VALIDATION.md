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

> **Atualizado em 2026-09-23**, depois que os 12 planos existiram: as colunas
> Plan e Wave deixaram de ser `TBD` e passaram a apontar o plano real. Duas
> linhas novas entraram (o enum do contrato v1 e o corte conjunto) porque o
> planejamento achou verificações que este mapa não previa.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| — | 05-01 | 1 | TEN-01 | — | Evolver acrescenta a Empresa ao Campo `Empresa` sem duplicar nem sobrescrever quando roda duas vezes (idempotência, molde do evolver de 02-08) | unit (domínio) | `npm run test --workspace=@n1/dominio -- evolver` | ❌ W0 | ⬜ pending |
| — | 05-01 | 1 | TEN-01 | T-5-SEC | Nenhum `app_key`/`app_secret` entra no schema `plataforma`: a Integração guarda rótulo, situação e data de rotação — provado por **nome de campo** contra `/app_?key\|app_?secret\|secret\|senha\|password\|token/i` | unit (domínio) | `npm run test --workspace=@n1/dominio -- integracao` | ❌ W0 | ⬜ pending |
| — | 05-02 | 2 | TEN-01 | — | O 5º Status `em revisão` aparece desabilitado com motivo para quem não o declara; TRIA nunca o alcança | unit (domínio/web) | `npm run test --workspace=@n1/dominio -- automations` | ✅ (arquivo existe; caso novo) | ⬜ pending |
| — | **05-03** | **2** | TEN-01 | T-5-ENUM | **O 5º Status atravessa o contrato v1 nos DOIS repositórios.** `StatusSolicitacaoV1` (`apps/api/src/contratos/v1.ts:37`) e `PaymentRequestDtoSchema.status` (`../financeiro-tria/automation/src/adapters/plataforma.ts:126`) são hoje `z.enum` de 4 valores com `.strict()` — sem esta linha, a primeira Solicitação do Family Office em `em revisão` derruba `getTask` do outro lado do fio. **Tem de passar antes da onda 4 (05-05).** | contract (ambos os repos) | `npm run test -w @n1/api -- contratos` e `npm test -w automation -- plataforma` | ❌ W0 | ⬜ pending |
| — | 05-04 | 3 | TEN-01 | T-5-ROUTE | Roteamento de tenant vem do payload, não do path — `webhooks-plataforma.ts:347` deixa de ter `tenantId: "tria"` fixo; Empresa desconhecida é 422 `EMPRESA_DESCONHECIDA` com zero chamadas de serviço, nunca cai em TRIA por omissão | integration (`automation/`) | `npm test -w automation -- webhooks-plataforma` | ❌ W0 | ⬜ pending |
| — | **05-05** | **4** | TEN-01 | — | **O corte conjunto:** webhooks de MP e FO desligados **antes** do arquivamento; `901109642259` e `901111928443` arquivadas no mesmo gesto (a segunda serve aos dois tenants); zero double-write no Omie por coorte; rollback declarado | manual/checkpoint | runbook de 05-05, conferido por quem opera | N/A | ⬜ pending |
| — | 05-06 | 2 | AUTO-02 | — | `notificar` com destino vazio recusa visivelmente na Execução e **não envia nada** — nunca um número padrão; os dois modos juntos, ou nenhum, também é recusa | unit (domínio) | `npm run test --workspace=@n1/dominio -- automations` | ❌ W0 | ⬜ pending |
| — | 05-07 | 3 | AUTO-02 | T-5-TX | O evento `automacao.notificar-canal.v1` grava no outbox **dentro** da transação (garantia de D-18); nenhuma chamada de rede dentro da UoW | integration (`apps/api`) | `npm run test --workspace=@n1/api -- outbox` | ❌ W0 | ⬜ pending |
| — | 05-08 | 4 | AUTO-02 | T-5-AUTH | Rota de canal no `automation/` recusa sem Bearer válido (tempo constante) e é idempotente no replay | integration (`automation/`) | `npm test -w automation -- notificar-canal` | ❌ W0 | ⬜ pending |
| — | 05-09 | 5 | REC-01 | — | **Checkpoint bloqueante:** `ws_n1` conferido contra `seed-contas-a-receber.ts` e contra `docs/07-processos/contas-a-receber.md`; divergências listadas em `05-CONFERENCIA-WS-N1.md`; D7 respondida **ou** o default de D5-02 acionado por decisão registrada, nunca por silêncio | manual/checkpoint | leitura somente-leitura com `DATABASE_URL` real | N/A | ⬜ pending |
| — | 05-10 | 6 | REC-01 | — | R2/R4/R5 são descobertos pelo `scheduler-worker.ts` sem código novo no motor — `CR.listId` aparece no catálogo dinâmico | integration (`apps/api`, requer Postgres) | `npm run test --workspace=@n1/api -- scheduler-worker` | ✅ (arquivo existe; caso novo) | ⬜ pending |
| — | 05-10 | 6 | REC-01 | — | **R7 existe em produção.** `garantirSaqueRecorrente` cria o Saque recorrente com Valor > 0 (D5-14) — o seed só o criava atrás de `fixtures: true`, e `applyContasAReceber(..., { fixtures: false })` nunca o criou | unit (domínio) | `npm run test --workspace=@n1/dominio -- contas-a-receber` | ❌ W0 | ⬜ pending |
| — | 05-11 | 7 | REC-01 | — | A importação das 240 Tarefas históricas **não dispara Automação nenhuma** no replay (molde de 03-09: `createTask` com `runAutomations: false` + `recordActivity` com o `at` original, nunca `changeTaskStatus`); zero `automationExecutions` **e** zero linhas novas de outbox | unit (domínio) | `npm run test --workspace=@n1/dominio -- importacao-contas-a-receber` | ❌ W0 | ⬜ pending |
| — | 05-12 | 7 | REC-01 | — | RN-CR-01..07 e INV-CR-01/02 cobertas; duplicata vira lacuna registrada, nunca fusão (D5-18); a série mostra linha a linha o que vai criar **antes** de confirmar | unit (domínio/web) | `npm run test --workspace=@n1/dominio -- contas-a-receber` | ✅ parcial | ⬜ pending |

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

> **Por que tudo abaixo está desmarcado, e isso é a leitura certa.** Os arquivos
> de teste da Wave 0 **ainda não existem** — são trabalho das tasks dos próprios
> planos. `nyquist_compliant` e `wave_0_complete` só passam a `true` quando a
> execução os tiver criado e verdes, não quando o planejamento os tiver
> previsto. Marcá-los agora seria afirmar cobertura que não existe. Quem fecha
> estas caixas é `/gsd-verify-work`, ao fim da fase.
>
> *(Nota acrescentada em 2026-09-23 a pedido do `gsd-plan-checker`, que leu o
> estado desmarcado como possível esquecimento. É decisão, não esquecimento.)*

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120 s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending — liberado por `/gsd-verify-work` ao fim da Phase 5
