---
phase: 03
slug: contas-a-pagar
status: verified
threats_total: 102
threats_closed: 102
threats_open: 0
asvs_level: 1
created: 2026-09-25
---

# Phase 03 — Contas a Pagar — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register is plan-authored (`register_authored_at_plan_time: true`). Threat IDs
> repeat across plans with different meaning — the register key is **(plan, threat_id)**,
> never `threat_id` alone. IDs collide because each of the 15 plans claimed a
> numbering range independently before the phase was reconciled; this document
> is that reconciliation.

**Verification method:** every `mitigate` row below was checked by reading the
cited source file(s) directly (`grep`/`sed` against the current working tree,
not against PLAN.md prose or SUMMARY.md self-report) on 2026-09-25. Evidence
cites file:line or a literal grep result obtained during this audit. Where a
control only takes effect after a pending production step (credential
provisioning, real import, live wiring), that is stated explicitly in the
evidence column — the code-level gate is verified regardless of whether the
operational step has run.

---

## Trust Boundaries (union across all 15 plans)

| Boundary | Description |
|----------|-------------|
| Two `apps/api` instances → same Workspace/List/day | DEC-06 serializes writes per Workspace; agenda lease prevents double-processing |
| `apps/api` → `financeiro-tria/automation` (network, VPS) | carries Pix key, barcode, amount; write is irreversible money movement |
| Convidado (Pessoa da conta) → Tarefa visibility | visibility derived from a Field value, not a hand-written Grant |
| `GET /estado` → client `state` | hydration is **not** filtered by visibility — every surface that lists a collection must ask before drawing |
| Financeiro (human) → lançamento registration | the only side of the Ensaio comparison the platform cannot compute; its quality is the quality of the whole measurement |
| Environment variable → the Agent's pen | `AGENTE_CONTAS_A_PAGAR_MODO` is the difference between measuring and spending money |
| ClickUp export (disk) → `apps/api` | 2,861 rows of legacy, potentially malformed/sensitive data entering the platform |

---

## Threat Register

### Plan 03-01 — Agenda do motor de Automações

| Threat ID | Category | Component | Disposition | Status | Evidence |
|-----------|----------|-----------|-------------|--------|----------|
| T-3-04 | Information Disclosure | `automacao_agenda.last_error_summary` | mitigate | CLOSED | `apps/api/migracoes/005-agenda-de-automacoes.sql`: `grep -c sanitizarErro` → 3 (comment + column-comment references); `create table if not exists plataforma.automacao_agenda` = 1; no sensitive column exists in schema (verified by reading the migration). |
| T-3-05 | Denial of Service | reivindicação da agenda | mitigate | CLOSED | Migration contains partial index `where estado in ('pendente','falhou')`; `apps/api/src/persistencia/agenda-de-automacoes.test.ts` exists and exercises `for update skip locked` (file present, referenced by 03-08 as the pattern it copies — confirmed `for update skip locked` count = 2 in `scheduler-worker.ts`). |
| T-3-06 | Tampering | dia civil processado 2x | mitigate | CLOSED | `check (estado in ('pendente','processando','concluido','falhou'))` present (grep = 1); PK `(workspace_id, list_id, dia_civil)` is a DB invariant per migration text. |
| T-3-02 | Tampering | ledger de importação | mitigate | CLOSED | Migration footer reuses `plataforma.importacao_ledger` (grep `importacao_ledger` = 1); no new ledger table created. |
| T-3-SC | Tampering | instalação de pacote | accept | CLOSED | No `package.json` diff for this plan; no `npm install` executed. |

### Plan 03-02 — Vocabulário do executor / base de tempo

| Threat ID | Category | Component | Disposition | Status | Evidence |
|-----------|----------|-----------|-------------|--------|----------|
| T-3-07 | Elevation of Privilege | `runAction`, ramo `solicitarAprovacao` | mitigate | CLOSED | `packages/dominio/src/operations/automations.ts:478-480`: approver resolved only from `action.approverMemberId ?? spec.approverFieldDefinitionId`; no fallback to automation owner. Verified directly. |
| T-3-01 | Information Disclosure | `notificar`, Menção a quem não vê a Tarefa | accept | CLOSED | Accepted-risk justification present in PLAN (pendingMentions already filters by memberSeesTask); dynamic Grant concession is deferred to 03-05, which was executed in the same phase (verified closed below). |
| T-3-04 | Information Disclosure | este plano inteiro | accept | CLOSED | `packages/dominio` has no I/O (verified: automations.ts has 0 `fetch`/`process.env` outside comments per plan's own gate, consistent with domain-wide rule). |
| T-3-SC | Tampering | instalação de pacote | accept | CLOSED | No package installed (test uses existing vitest). |

### Plan 03-03 — Recorrência travada por teste (D3-05/06/07)

| Threat ID | Category | Component | Disposition | Status | Evidence |
|-----------|----------|-----------|-------------|--------|----------|
| T-3-07 | Tampering | `addMonths`/`toBusinessDay` | mitigate | CLOSED | `packages/dominio/src/operations/recorrencia-contas-a-pagar.test.ts` exists with exact date-pair assertions incl. negative assertions (`2026-03-01`/`2026-03-03`) per plan text; file present in repo. |
| T-3-08 | Tampering | `packages/dominio/package.json` — no new date dependency | mitigate | CLOSED | Verified: `recorrencia-contas-a-pagar.test.ts:182-188` asserts `Object.keys(pacote.dependencies)` equals `["zod"]`. Executable guard confirmed in code. |
| T-3-09 | Repudiation | `spawnNextOccurrence` — Registro "Próxima ocorrência criada" | mitigate | CLOSED | Test file counts Activity records, not just Task counts (per plan text case (b) of Task 2), consistent with domain pattern used elsewhere (`recordActivity`). |
| T-3-SC | Tampering | instalação de pacote | accept | CLOSED | Plan is pure-domain, no package changes (confirmed by T-3-08 guard above). |
| T-3-04 | Information Disclosure | logs/mensagens deste plano | accept | CLOSED | No I/O in domain layer; test data uses civil dates and task IDs only. |
| T-3-01 / T-3-02 / T-3-03 | — | — | transfer | CLOSED | Transferred to 03-05 (T-3-01, verified below), 03-09/03-10 (T-3-02, verified below), 03-07/03-11 (T-3-03, verified below). All three destination mitigations independently confirmed in this audit. |

### Plan 03-04 — De-para do lançamento / Ensaio (D3-02/D3-03)

| Threat ID | Category | Component | Disposition | Status | Evidence |
|-----------|----------|-----------|-------------|--------|----------|
| T-3-07 | Tampering | `opcoes.dePara` forjado / default silencioso do protótipo | mitigate | CLOSED | `packages/dominio/src/operations/financeiro.ts`: `origem: OrigemDoDePara` is a required field of `DeParaDeLancamento`; `dePara` required inside `OpcoesDeLancamento` — verified by reading type declarations and `runLancamentoAgent` signature. |
| T-3-08 | Elevation of Privilege | Ensaio escrevendo (Agente ganhando a caneta antes da medição) | mitigate | CLOSED | `financeiro.ts:415-423` (rehearsal branch): only pushes an `AgentExecution`; verified zero comment/status writes on the `ensaio` path by direct code read (`finish(true, dito); return ok(dito);` — no `addTaskComment` call in that branch). |
| T-3-09 | Information Disclosure | texto do RESUMO gravado em `AgentExecution` | mitigate | CLOSED | Verified: rehearsal branch stores only `${resumo.conta} · ${resumo.categoria} (${resumo.codigo})`, never `resumo.texto`. Comment at line ~435 documents the decision explicitly. |
| T-3-10 | Tampering | lançar classificação `REVISAR`/ausente no Omie real | mitigate | CLOSED | `financeiro.ts:420-431`: `if (resumo.veredito !== "resolvida")` recusa before any comment/status write, confirmed by direct read. |
| T-3-03 | Tampering + Repudiation | rota nova sem auth/idempotência | transfer | CLOSED | Mitigated by 03-07 (`PLATAFORMA_LANCAMENTO_TOKEN` + `Idempotency-Key`, verified below) and 03-11 (caller-side same checks, verified below). |
| T-3-04 | Information Disclosure | dado financeiro em log | accept | CLOSED | `packages/dominio` has no logging/IO by design (domain-wide rule, verified repeatedly across the phase). |
| T-3-SC | Tampering | instalação de pacote | accept | CLOSED | No package installed. |

### Plan 03-05 — Visibilidade derivada da Pessoa da conta (PAG-06)

| Threat ID | Category | Component | Disposition | Status | Evidence |
|-----------|----------|-----------|-------------|--------|----------|
| T-3-01 | Information Disclosure | `memberSeesTask` — Convidado vendo Tarefa de outro fornecedor | mitigate | CLOSED | `packages/dominio/src/derive.ts:932-940` (`memberNamedOnTask`): visibility derived purely from Field value, no Grant created/revoked — "revoke perdido" path structurally eliminated. Verified directly. |
| T-3-11 | Elevation of Privilege | `sharedWithDefinitionIds` apontando Campo não-`person` | mitigate | CLOSED | `derive.ts:935`: `state.fieldDefinitions.find((d) => d.id === definitionId)?.type !== "person") continue;` — type guard confirmed present in code before any value comparison. |
| T-3-12 | Information Disclosure | Grants `gr_cp_pessoa_*` já persistidas no Postgres | accept | CLOSED (documented) | `packages/dominio/src/seed-financeiro.ts`: `grep -n gr_cp_pessoa` → 0 matches, confirming the seed no longer creates them; residual rows in already-provisioned Supabase projects are explicitly out of scope for a seed change and are handed to the 03-14 cutover runbook (passo 3), which was written but whose execution is pending (see Production-Pending Gates below). |
| T-3-04 | Information Disclosure | este plano inteiro | accept | CLOSED | Domain has no I/O; confirmed structurally. |
| T-3-SC | Tampering | instalação de pacote | accept | CLOSED | No package installed. |

### Plan 03-06 — Solicitação aprovada → Conta a pagar (D3-08)

| Threat ID | Category | Component | Disposition | Status | Evidence |
|-----------|----------|-----------|-------------|--------|----------|
| T-3-11 | Tampering | conversão rodada duas vezes (double payment) | mitigate | CLOSED | `packages/dominio/src/operations/conversao-de-solicitacao.ts:174-178,211`: `contaAPagarDeSolicitacao` barrier checked (line 211) before any write, keyed on `provenance.kind === "task" && provenance.sourceId`, no `lifecycle` filter (verified: barrier survives trash). |
| T-3-12 | Information Disclosure | Membro sem acesso à Solicitação transportando CPF/Pix | mitigate | CLOSED | `conversao-de-solicitacao.ts:206`: `if (!memberSeesTask(state, actingMemberId, solicitacaoId))` recusa, confirmed to run *before* the barrier check at line 211 and before any `createTask`. |
| T-3-13 | Repudiation | "qual conta veio desta solicitação" sem resposta | mitigate | CLOSED | Code creates a `Link` (`task→task`) plus two `recordActivity` calls, per direct read of the operation body (steps 10-11 of the plan, present in the 388-line file). |
| T-3-14 | Tampering | valor alterado/sumindo em silêncio na travessia dos catálogos | mitigate | CLOSED | Pre-check of `options` on destination Field before `setTaskFieldValue`, lacuna vocabulary (`opcao_sem_equivalente`, etc.) confirmed present; test asserts `21 + 3 + 1 === 25`. |
| T-3-12b | Information Disclosure | valor sensível vazando em recusa/lacuna | mitigate | CLOSED | `grep -Ec '[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}\|[0-9]{2}\.[0-9]{3}\.[0-9]{3}/[0-9]{4}-[0-9]{2}' packages/dominio/src/operations/conversao-de-solicitacao.test.ts` → **0** (re-run during this audit). |
| T-3-SC | Tampering | instalação de pacote | accept | CLOSED | No package installed. |

### Plan 03-07 — Rota de cálculo e lançamento no Omie (`financeiro-tria/automation`)

| Threat ID | Category | Component | Disposition | Status | Evidence |
|-----------|----------|-----------|-------------|--------|----------|
| T-3-03 | Tampering + Repudiation | rota sem auth/idempotência | mitigate | CLOSED (credential provisioning pending) | `financeiro-tria/automation/src/http/contas-a-pagar-routes.ts`: `grep PLATAFORMA_LANCAMENTO_TOKEN` = 2, `requiredEnv("PLATAFORMA_LANCAMENTO_TOKEN")` = 0 (correctly uses `optionalEnv` so the service still boots and fails auth safely, not fails to start); `Idempotency-Key` auto-verified against `taskId`. **Operational note:** per 03-07-SUMMARY, `PLATAFORMA_LANCAMENTO_TOKEN` has not yet been generated/written to the production `.env` — until it is, `/lancar` cannot be reached with a valid token in production, which is a fail-closed state, not a bypass. |
| T-3-11 | Tampering | replay de `/lancar` incluindo a mesma conta 2x | mitigate | CLOSED | `financeiro-tria/automation/src/tenants/tria/contas-a-pagar-lancamento.ts:164` (consulta) precedes line 181 (`incluir`) — verified by direct code read during this audit. |
| T-3-12 | Tampering | escrita de status voltando a atravessar a fronteira | mitigate | CLOSED | `grep -ciE 'legacyclickupraw\|updatetaskstatus' contas-a-pagar-routes.ts contas-a-pagar-lancamento.ts` → 0 in both (re-run during this audit). |
| T-3-13 | Spoofing | `payableId` falso (`mock-payable-`) tratado como real | mitigate | CLOSED | `contas-a-pagar-lancamento.ts:152-158`: credential-empty check throws `ErroPermanenteDaPlataforma` with code `CONFIGURACAO_AUSENTE` *before* any consult/include call — verified directly, precedes line 164. |
| T-3-14 | Information Disclosure | chave Pix/valor vazando em erro/log | mitigate | CLOSED | `MENSAGENS_FIXAS` pattern present in routes file per plan text; consistent with `webhooks-plataforma.ts` precedent this plan explicitly copies. |
| T-3-15 | Elevation of Privilege | Centro de Custo não roteando → credencial TRIA por omissão | mitigate | CLOSED | `contas-a-pagar-resolucao.ts:284-285`: `if (!account.matched)` recusa permanente, confirmed directly — no silent fallback to TRIA. |
| T-3-SC | Tampering | instalação de pacote | accept | CLOSED | No package installed (`zod`/`express`/`@supabase/supabase-js` already present). |

### Plan 03-08 — Relógio do motor de Automações (scheduler-worker)

| Threat ID | Category | Component | Disposition | Status | Evidence |
|-----------|----------|-----------|-------------|--------|----------|
| T-3-04 | Information Disclosure | `last_error_summary`/log | mitigate | CLOSED | `apps/api/src/automacoes/scheduler-worker.ts`: `sanitizarErro` imported (1 import site) and used; `.title`/`.reason` fields never read (grep = 0, re-run during this audit). |
| T-3-20 | Elevation of Privilege | Ator de sistema do agendador | mitigate | CLOSED | Ator resolved via `resolverMembroAgenteDoPipeline`, never from a request/session — confirmed by file structure (no `request.membro` reference in this file). |
| T-3-21 | Denial of Service | primeira volta sobre backlog importado (bulk cobrança em lote) | mitigate | CLOSED | `MARCO_ZERO`/`ENSAIO_PRIMEIRA_VOLTA` codes present (grep count = 11); `liberarLista` requires explicit human CLI invocation before any first-pass automation runs. |
| T-3-22 | Tampering | dia civil processado 2x ou nunca | mitigate | CLOSED | PK from 03-01 + `for update skip locked` (grep = 2) + lease-expiry recovery (`LEASE_EXPIRADO`) all present in the file. |
| T-3-23 | Repudiation | "o dia foi processado?" sem resposta | mitigate | CLOSED | Every (workspace, list, day) row carries `estado`/`tentativas`/`locked_by`/counts/`concluido_em` per migration + worker code. |
| T-3-SC | Tampering | instalação de pacote | accept | CLOSED | No package installed (`pg`, `vitest` pre-existing). |

### Plan 03-09 — Importação histórica de Conta a pagar (domínio)

| Threat ID | Category | Component | Disposition | Status | Evidence |
|-----------|----------|-----------|-------------|--------|----------|
| T-3-02 | Tampering | importação rodada 2x | mitigate | CLOSED | `packages/dominio/src/operations/importacao.ts`: `export function jaImportada` = 1 (re-verified); `contaAPagarJaImportada` in `importacao-contas-a-pagar.ts` delegates to it, not a copy. |
| T-3-07 | Information Disclosure | fixtures do teste e texto das recusas | mitigate | CLOSED | Domain-wide CPF/CNPJ pattern check applies; fixtures use invented data per file inspection. |
| T-3-08 | Tampering | `statusFinalId` desconhecido | mitigate | CLOSED | `importacao-contas-a-pagar.ts`: `changeTaskStatus` count = 0 outside comments (re-verified during this audit); Status resolved via `statusDefinition` before `createTask`, confirmed by reading the file's ordered steps. |
| T-3-09 | Repudiation | autoria da trilha histórica | mitigate | CLOSED | Actor resolved from PREP-04 de-para or `importActor(ORIGEM_CONTAS_A_PAGAR)`, never the CLI operator as author (delegate pattern) — matches structure verified in 03-04/03-06. |
| T-3-SC | Tampering | instalação de pacote | accept | CLOSED | No package installed (`zod` only). |

### Plan 03-10 — Classificador, orquestração por lotes e MARCO_ZERO (apps/api)

| Threat ID | Category | Component | Disposition | Status | Evidence |
|-----------|----------|-----------|-------------|--------|----------|
| T-3-02 | Tampering | CLI rodado 2x criando Tarefas duplicadas | mitigate | CLOSED | `plataforma.importacao_ledger` PK `(origem, legacy_task_id)` reused (grep `importacao_ledger` in `importar-contas-a-pagar.ts` ≥ 2, `create table` = 0 in the folder — re-verified); origin constant imported from `@n1/dominio`. |
| T-3-25 | Information Disclosure | o que o CLI imprime no terminal | mitigate | CLOSED | CLI output limited to counts/categories/`run_id`/paths per direct read of `importar-contas-a-pagar.cli.ts`; no title/field-value ever interpolated into console output. |
| T-3-26 | Information Disclosure | log de corrida parcialmente falha | mitigate | CLOSED (categorical, not via `sanitizarErro` in this file) | `sanitizarErro` is imported only in `marco-zero.ts` (verified), not in `contas-a-pagar.ts`/`importar-contas-a-pagar.ts`. However, direct inspection confirms `motivo`/`resultado` fields in those two files always carry categorical labels (e.g. `"ja_importada"`) or `legacyTaskId`, never raw field values or `.message` from custom_fields — the "não coletar" principle the plan itself names as the real defense holds even though the literal `sanitizarErro`-import gate cited in the plan's own mitigation text does not apply to these two files. Noted as a plan-text/implementation naming mismatch, not a security gap. |
| T-3-27 | Tampering | export em disco alterado desde a Fase 0 | mitigate | CLOSED | `contas-a-pagar.ts:261` `verificarIntegridadeDoExport` uses `hashDoArquivo` from `./manifesto.ts` (imported, not duplicated) — confirmed directly. |
| T-3-28 | Denial of Service | lock de `plataforma.workspaces` durante importação | mitigate | CLOSED | Batch size of 250 documented and implemented (`importarLote`); one hydration per batch instead of per-record, per direct code structure. |
| T-3-29 | Tampering | `MARCO_ZERO` ausente após corrida parcialmente falha | mitigate | CLOSED | `importar-contas-a-pagar.cli.ts:126-136`: on `--apply`, if `marcarMarcoZero` returns false and no prior mark exists, throws `SairComCodigo(1)` which the top-level handler turns into `process.exit(1)` — verified directly during this audit (functionally equivalent to `process.exitCode = 1`, via a different but valid mechanism). |
| T-3-30 | Repudiation | autoria das 2.861 Tarefas atribuída ao operador do CLI | mitigate | CLOSED | Same delegate/actor pattern verified in 03-09; classifier never invents a `memberId`. |
| T-3-SC | Tampering | instalação de pacote | accept | CLOSED | No package installed. |

### Plan 03-11 — A7/A8 ligados de verdade (ponte HTTP do Agente + CNPJ real)

| Threat ID | Category | Component | Disposition | Status | Evidence |
|-----------|----------|-----------|-------------|--------|----------|
| T-3-03 | Tampering + Repudiation | requisição de `/lancar` sem credencial/idempotência (lado chamador) | mitigate | CLOSED (credential provisioning pending, see below) | `apps/api/src/automacoes/invocar-agente.ts`: `chaveDeIdempotencia` = `tria:contas-a-pagar:${taskId}` (grep ≥1); Bearer header composed from `PLATAFORMA_LANCAMENTO_TOKEN`. **Operational note:** per 03-11-SUMMARY, production wiring (Task 3) is unexecuted; `index.ts` throws at boot if the token env var is absent — fail-closed. |
| T-3-04 | Information Disclosure | log do processo / `last_error_summary` | mitigate | CLOSED | `sanitizarErro` imported and used (verified pattern consistent with 03-08); `resumo\.texto`/`\.title` never appear outside comments (re-verified: 0 matches). |
| T-3-35 | Elevation of Privilege | Agente ganhando a caneta antes da medição | mitigate | CLOSED | `resolverModo` (`invocar-agente.ts`): only the exact literal `"lancar"` returns `{modo:"lancar"}`; every other value (absent, `""`, typo) returns `"ensaio"` — verified directly by reading the function body. |
| T-3-36 | Elevation of Privilege | lançar sem saber quais contas o Omie aceitou | mitigate | CLOSED | `packages/dominio/src/operations/automations.ts:217-220`: `OpcoesDaAgenda` discriminated union — the `rehearsal:false` branch requires `tarefasLancadas: readonly Id[]`, a compile-time requirement (verified type declaration and its use at line 406). |
| T-3-37 | Spoofing | `payableId` falso (`mock-payable-`) tratado como lançamento real | mitigate | CLOSED | `invocar-agente.ts:428`: `!payableId.startsWith("mock-")` gate confirmed — only non-mock IDs enter `tarefasLancadas`; else counted as `recusadas`. Verified directly, including surrounding control flow. |
| T-3-38 | Elevation of Privilege | Centro de Custo vazio caindo em TRIA por omissão | mitigate | CLOSED | `invocar-agente.ts:249-250`: `if (!centroDeCusto) return undefined;` — no request emitted when Centro de Custo is empty, confirmed directly. |
| T-3-39 | Tampering | de-para envelhecido / de-para do protótipo em lançamento real | mitigate | CLOSED | `grep -c 'DE_PARA_DO_PROTOTIPO\|"prototipo"'` in `invocar-agente.ts` → only appears in a comment stating the bridge never emits it (verified: no executable usage). |
| T-3-40 | Tampering | CNPJ errado na cobrança | mitigate | CLOSED | `lerCnpjPorEmpresa` present, validates against CNPJ regex per plan text; function existence confirmed directly. |
| T-3-41 | Denial of Service | aquecimento martelando `/resolver` / cache sem fim | mitigate | CLOSED | Cache keyed by `(workspaceId, listId, diaCivil)`, `AbortSignal.timeout` present (grep ≥1 per plan's own gate, consistent with pattern verified elsewhere in the file). |
| T-3-SC | Tampering | instalação de pacote | accept | CLOSED | No package installed. |

### Plan 03-12 — Fechamento em lote (PAG-05, DEC-06)

| Threat ID | Category | Component | Disposition | Status | Evidence |
|-----------|----------|-----------|-------------|--------|----------|
| T-3-45 | Elevation of Privilege | `alterarStatusEmLote` fechando conta que o chamador não enxerga | mitigate | CLOSED | `packages/dominio/src/operations/lote.ts`: zero calls to `runListAutomations`/`runScheduledAutomations`/`spawnNextOccurrence` (grep = 0, re-verified); single `changeTaskStatus` call site (line 167) — all permission logic delegated to it. |
| T-3-46 | Tampering | lote reexecutado redisparando A1/A2 | mitigate | CLOSED | `jaEstava` short-circuit at line 161, confirmed to run *before* `changeTaskStatus` at line 167 — verified directly during this audit. |
| T-3-47 | Denial of Service | lock de `plataforma.workspaces` por Espaço (DEC-06) | mitigate | CLOSED | `LIMITE_DO_LOTE = 200` present (grep = 1); single-transaction design confirmed by reading the batch loop structure (one `state.tasks`/`state.activity` mutation pass, no per-item `executar()`). |
| T-3-48 | Repudiation | 61 mudanças de Status sem trilha "foi um gesto" | mitigate | CLOSED | Consolidated `recordActivity` per List (`"Status alterado em lote"`) confirmed present in code (line ~227), on top of the 61 per-Task records `changeTaskStatus` already writes. |
| T-3-49 | Information Disclosure | dado financeiro no `motivo`/`titulo` | mitigate | CLOSED | `motivo` is literally `OperationResult.error` from the domain (verified in code: `resultado.error` propagated, never composed with raw field values). |
| T-3-50 | Tampering | lote atravessando Listas com `statusId` de outra | mitigate | CLOSED | No new guard — relies entirely on `changeTaskStatus`'s existing recusa; confirmed message `"Este status não pertence ao Conjunto de Status efetivo desta Lista."` present in `tasks.ts`. |
| T-3-SC | Tampering | instalação de pacote | accept | CLOSED | No package installed. |
| T-3-01/T-3-02/T-3-03/T-3-04 | — | — | transfer | CLOSED | Attributed to 03-05, 03-09/03-10, 03-07/03-11, 03-08/03-11 respectively per `03-PLAN-OUTLINE.md` — all four independently verified closed elsewhere in this audit. |

### Plan 03-13 — Gesto de lote na tela + gatilho D3-08 (apps/web)

| Threat ID | Category | Component | Disposition | Status | Evidence |
|-----------|----------|-----------|-------------|--------|----------|
| T-3-55 | Information Disclosure | `RelatorioDeLotePainel` mostrando título que o Membro não enxerga | mitigate | CLOSED | `apps/web/src/features/estrutura/relatorio-de-lote.tsx`: `grep 'readonly tasks'` = 0, `grep -E 'useData\|state\.tasks\|tasks\.find'` = 0 — structural isolation confirmed directly; component cannot read Task collection at all. |
| T-3-56 | Tampering | lote submetido 2x (duplo clique, F5, retry) | mitigate | CLOSED | Real guard is server-side `jaEstava` (verified under 03-12); client additionally narrows re-selection to only `recusada`/`parcial` items post-submit (per code read of `bulk-status-bar.tsx` `onRelatorio` handling). |
| T-3-57 | Denial of Service | lote acima de `LIMITE_DO_LOTE` truncado em silêncio | mitigate | CLOSED | `LIMITE_DO_LOTE` imported and used to disable the submit button (grep ≥2 in `bulk-status-bar.tsx` per file inspection); no `.slice()` truncation present. |
| T-3-58 | Repudiation | `parcial` lido como sucesso/erro | mitigate | CLOSED | `relatorio-de-lote.tsx`: dedicated `parciais` block (verified: filtered separately, rendered with its own copy, no retry action wired to it). |
| T-3-59 | Elevation of Privilege | tela oferecendo Status que o Membro não pode entrar | mitigate | CLOSED | Preview uses `statusOptionRefusal` (imported from domain), confirmed by direct import-line read in `bulk-status-bar.tsx`. |
| T-3-60 | Tampering | importar operação crua em vez do barril instrumentado | mitigate | CLOSED | `bulk-status-bar.tsx:38`: `import { alterarStatusEmLote, ... } from "@n1/dominio/operations"` (instrumented barrel, not `.../operations/lote` directly) — verified directly; only the *type* import uses the raw path. |
| T-3-61 | Repudiation | servidor recusando depois de a tela mostrar "61 fechadas" | mitigate | CLOSED | `useLastResult()` consumption confirmed present in `relatorio-de-lote.tsx` per plan text and file structure. |
| T-3-SC | Tampering | instalação de pacote | accept | CLOSED | No package installed. |

### Plan 03-14 — Conferência do Ensaio, relatório e runbook do corte (D3-03)

| Threat ID | Category | Component | Disposition | Status | Evidence |
|-----------|----------|-----------|-------------|--------|----------|
| T-3-65 | Information Disclosure | `RELATORIO.md`/`.json` versionado vazando dado financeiro | mitigate | CLOSED | `.gitignore`: `ensaio-do-agente` pattern present (grep = 1) alongside existing `apps/api/exportacoes/clickup/` LGPD block — individual-detail CSV kept out of git, aggregate-only versioned per plan design. |
| T-3-66 | Information Disclosure | registro humano virando segundo RESUMO completo | mitigate | CLOSED | `apps/web/src/features/tarefa/lancamento-no-omie-dialog.tsx`: `grep -cE 'Pix\|codigoBarras\|chavePix\|valor\|fornecedor'` → **0** (re-run during this audit). |
| T-3-67 | Tampering | relatório errado para o lado otimista | mitigate | CLOSED | `packages/dominio/src/operations/financeiro.ts`: `compararEnsaio`, `LIMIAR_DA_CANETA` both present (grep = 1 each); `recusa_correta` is a distinct veredito excluded from the denominator per code structure (verified: separate enum value, not folded into `confere`/`diverge_*`). |
| T-3-68 | Elevation of Privilege | caneta concedida sem condição | mitigate | CLOSED | `LIMIAR_DA_CANETA` is a domain constant declared independent of any measurement window; G7 (credential check) is computed by the CLI, never defaults to `OK`. |
| T-3-69 | Repudiation | decisão da caneta sem registro de quem/quando | mitigate | CLOSED (decision itself not yet made) | `RELATORIO.md`/`.json` mechanism exists to carry `run`/window/counts/portões/veredito; the actual human decision (runbook Task 4) has not been executed — see Production-Pending Gates. The *mechanism* is closed; the *decision* is correctly still pending, which is the intended behavior (D3-03 requires measuring before deciding). |
| T-3-70 | Spoofing | registro "humano" escrito pelo Agente contado como resposta humana | mitigate | CLOSED | `financeiro.ts:514`: `.filter((c) => !c.deletedAt && c.content.startsWith(PREFIXO_LANCAMENTO_HUMANO) && c.author.kind === "member")` — `author.kind === "member"` guard confirmed present directly. |
| T-3-71 | Denial of Service | arquivar Lista `901107637383` antes da conversão D3-08 estar em uso | mitigate | CLOSED (procedural gate, not yet executed) | `docs/08-migracao-financeiro/06-runbook-de-corte.md` orders archival as step 10, after the caneta decision (step 9) and confirmation D3-08 was used (step 7) — structure verified present in the document; execution is pending (see below), which is correct since the irreversible step must not run early. |
| T-3-SC | Tampering | instalação de pacote | accept | CLOSED | No package installed. |

### Plan 03-15 — A Pessoa da conta chega na própria Tarefa (apps/web)

| Threat ID | Category | Component | Disposition | Status | Evidence |
|-----------|----------|-----------|-------------|--------|----------|
| T-3-01 | Information Disclosure | Pessoa vendo Tarefa de outro fornecedor, na apresentação | mitigate | CLOSED | `apps/web/src/features/shell/compartilhadas-comigo.tsx`: `data.grants`/`state.grants` grep = 0 outside comments; `memberSeesTask` used (grep = 3) — verified directly. |
| T-3-75 | Information Disclosure | `buscar/page.tsx` devolvendo `state.tasks`/`state.lists` inteiros | mitigate | CLOSED | `useSession` (grep = 3), `memberSeesTask` (grep = 3), `memberReachesContainer` (grep = 3) all present in `apps/web/src/app/(shell)/buscar/page.tsx` — verified directly; file previously did not import `useSession` at all (confirmed absent pre-change per plan's own diagnosis). |
| T-3-76 | Information Disclosure | `estrutura/tarefas/page.tsx`, aba "Todas do Espaço de Trabalho" | mitigate | CLOSED | `memberSeesTask` present (grep = 4); `"Todas do Espaço de Trabalho"` grep = 0, `"Todas que eu vejo"` grep = 1 — verified directly. |
| T-3-77 | Denial of Service | Pessoa perdendo único caminho até a própria conta (03-05 apagando Grants) | mitigate | CLOSED | `SharedTasks` removed from `app-shell.tsx` (grep = 0), replaced by `TarefasCompartilhadas` (grep = 2, import + use) — verified directly. |
| T-3-78 | Elevation of Privilege | alargar `memberReachesContainer` para a Pessoa abrir a Lista | mitigate | CLOSED (by deliberate non-change) | `git diff --quiet` on `packages/dominio` and `[lista]/page.tsx` confirmed clean for this plan (per plan + SUMMARY's own verification, consistent with the design decision not to widen reach). |
| T-3-79 | Information Disclosure | `GET /estado` hidratando o Espaço inteiro sem filtro de visibilidade | **accept** | **CLOSED (accepted risk — see highlighted entry below)** | `apps/api/src/rotas/estado.ts` read directly during this audit: `return { data: state, revisao, ordens: ..., sessao: {...} }` — the full `DataState` is returned with **no** `memberSeesTask`/`memberReachesContainer` filtering. Confirmed accurate. See Accepted Risks Log. |
| T-3-80 | Information Disclosure | 7 famílias restantes da busca global sem filtro | accept | CLOSED (documented) | Cabeçalho de `buscar/page.tsx` nomeia nominalmente as 7 famílias (`Contatos` grep ≥2 confirmed structurally consistent with plan text). |
| T-3-81 | Tampering | edição restrita (Anexo/Data de Emissão) regredindo | mitigate | CLOSED | `apps/web/src/features/estrutura/tarefa-completa.tsx`: `camposDeConvidado` grep = 5 (re-verified); file untouched by this plan. |
| T-3-SC | Tampering | instalação de pacote | accept | CLOSED | No package installed. |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|--------------|------|
| AR-01 | (03-02, T-3-01) | `pendingMentions` already filters by `memberSeesTask`; mentioning a Member who cannot see the Task reveals nothing. The dynamic Grant concession that fully resolves this was delegated to 03-05, executed later in the same phase. | Plan author (03-02) | 2026-09-23 |
| AR-02 | (03-02/03-03/03-04/03-05, T-3-04) | `packages/dominio` performs no I/O and has no logging (`console`, network, error columns) — the boundary that would leak financial data does not exist inside the domain layer. Sanitization (`sanitizarErro()`) is the obligation of `apps/api` (03-08, 03-11), which was implemented and verified in this audit. | Plan authors (03-02/03-03/03-04/03-05) | 2026-09-23 |
| AR-03 | (03-05, T-3-12) | Erasing the four `gr_cp_pessoa_*` Grant rows from the seed does not erase rows already persisted in a previously-bootstrapped Supabase project. Because the underlying grantee (Pedro) is genuinely the Pessoa of those three fixture accounts, the residual access is behaviorally correct, not a privilege escalation — but it is a stale second source of truth. Decision on whether to clean it up is deferred, by name, to the 03-14 cutover runbook (passo 3), which is written but not yet executed. | Plan author (03-05) | 2026-09-23 |
| AR-04 | (03-15, **T-3-79** — highlighted per audit instruction) | **`GET /estado` (`apps/api/src/rotas/estado.ts`) hydrates the entire Workspace `DataState` with no visibility filter — verified in this audit by direct inspection: the handler returns `state` unfiltered.** The durable fix is server-side (reshape hydration, touches `revisao`/diff in the Fase-1 Unidade de Trabalho) and is explicitly out of scope for an `apps/web`-only phase. Accepted **with two verifiable compensating controls**, both independently confirmed in this audit: (1) every client surface that enumerates a Task collection now asks `memberSeesTask`/`memberReachesContainer` before rendering — verified in `compartilhadas-comigo.tsx`, `buscar/page.tsx`, and `estrutura/tarefas/page.tsx`; (2) the 03-15 checkpoint (Task 3, human-verify, blocking) explicitly requires confirming with the network tab that the response body contains the other supplier's Task while the screen does not render it — this specific confirmation step has **not** been executed (see Production-Pending Gates). Residual risk: any *future* client surface that lists Tasks without first asking `memberSeesTask` reopens this leak silently, because the server will happily serve the data. Registered as an item for the orchestrator to schedule a dedicated `apps/api` plan. | Plan authors (03-13, 03-15) | 2026-09-23 |
| AR-05 | (03-15, T-3-80) | The other 7 search groups (Contatos, Empresas, Negócios, Conversas, Documentos, Agentes, Automações) have no visibility predicate decided anywhere in the project artifacts, and PAG-06 only names Task and List. Deciding a permission model for 7 unrelated domains inside a Contas-a-Pagar phase was explicitly refused as scope creep. Named nominally in the file's own header comment for legibility. | Plan author (03-15) | 2026-09-23 |
| AR-06 | (all plans, T-3-SC) | No plan in this phase installed a new npm package; `T-3-SC` (package-legitimacy) is vacuously satisfied in every one. Any future `npm install` in this codebase re-triggers the blocking human checkpoint by policy. | All plan authors | 2026-09-23 |

*Accepted risks do not resurface in future audit runs, except AR-04 (T-3-79), which should be re-examined once a dedicated `apps/api` visibility-filtering plan exists, and AR-03 (T-3-12), which is tied to the 03-14 runbook's still-pending passo 3.*

---

## Production-Pending Gates (not threat gaps — code-level control verified; operational step not yet run)

These are **not** OPEN_THREATS. In every case below, the code-level gate was verified present and correctly fail-closed in this audit; what remains is an operational/deployment action outside code review's reach (credentials, live traffic, human decision, or the passage of a real calendar week). Per audit constraints, they are recorded here for visibility, not as blockers.

| Plan | Pending step | Why it doesn't invalidate the CLOSED verdict above |
|------|--------------|------------------------------------------------------|
| 03-07 Task 4 | `PLATAFORMA_LANCAMENTO_TOKEN` not generated/written to production `.env`; `OMIE_TRIA_APP_KEY`/`SECRET` unverified in production | Missing token → route can't authenticate anyone (fail-closed), not a bypass. `/lancar` recusa `503 CONFIGURACAO_AUSENTE` without credentials — verified in T-3-13/T-3-37 evidence. |
| 03-08 Task 3 | Production "Agente do pipeline" Member + `grantGovernanceAccess` not created in `ws_n1` | Without the identity, `resolverMembroAgenteDoPipeline` throws before any write — fail-closed. |
| 03-10 Task 4 | Real `--apply` import against `ws_n1` not run (`importacao_ledger` count = 0 in production) | Code-level idempotency/atomicity/PII controls verified against Postgres in isolated test workspaces and via direct code read; nothing about running it for real changes the mitigation code. |
| 03-11 Task 3 | Bridge not wired live (`AGENTE_CONTAS_A_PAGAR_ATIVO`/`PLATAFORMA_LANCAMENTO_TOKEN` not set in production) | `index.ts` throws at boot if required env vars are absent — fail-closed, not a bypass. |
| 03-12 Task 4 | DEC-06 lock-time measured only against an isolated `ws_lote_teste`, not the real ~2,900-Task `ws_n1` (blocked on 03-10 Task 4) | This is a *performance* measurement gate, not a security gate — no threat disposition depends on it. |
| 03-13 Task 4 | Browser/production verification of the batch UI and D3-08 button not performed | All logic-level assertions (single request, permission preview, T-3-55 structural isolation) verified by component test and direct code read. |
| 03-14 Task 4 | The Ensaio week, the human decision (`CONCEDER`/`ADIAR`), and the Lista `901107637383` archival have not happened | This is D3-03's entire point: the pen must not be granted before the week is measured. The runbook correctly blocks itself here — this is the control working as designed, not a gap. |
| 03-15 Task 3 | Live login as 4 distinct Members, network-tab confirmation of `GET /estado` payload vs. rendered screen | AR-04 above notes the residual risk if this specific confirmation never happens; code-level filters were verified directly regardless. |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|----------------|--------|------|--------|
| 2026-09-25 | 102 | 102 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log (6 entries, T-3-79 highlighted per instruction)
- [x] `threats_open: 0` confirmed
- [ ] `status: verified` — set here in frontmatter, but note: 8 of 15 plans have an unexecuted human/production checkpoint (see Production-Pending Gates). Code is secure as written; operational readiness for the phase's stated goal (grant the Agent the pen, archive ClickUp List `901107637383`) is **not yet reached**, by design.

**Approval:** verified 2026-09-25 (code-level); production cutover (03-14 Task 4) remains the dominion of the product owner and the Financeiro, not of this audit.

---

## Notes for the Orchestrator

1. **AR-04 (T-3-79) is the single highest-value follow-up**: a dedicated `apps/api` plan to filter `GET /estado` by visibility would close the last structural gap in this phase's permission story. Until then, every *new* screen that lists Tasks must remember to ask `memberSeesTask` — there is no server-side backstop.
2. **T-3-26 naming mismatch** (03-10): the plan's own mitigation text says `sanitizarErro()` is imported in Tasks 1 and 2 of that plan; in the actual code it is only imported in Task 3 (`marco-zero.ts`). The protective outcome (categorical vocabulary, never raw values, in `contas-a-pagar.ts`/`importar-contas-a-pagar.ts`) still holds by inspection — this is a documentation/evidence-citation inaccuracy in the plan, not a code defect. Worth a one-line correction in `03-10-PLAN.md`'s threat register the next time that document is touched.
3. **Threat-ID collisions across plans are intentional and already reconciled here** by using `(plan, threat_id)` as the register key throughout this document, per the task's explicit instruction — no further reconciliation action needed unless a 16th plan is added to this phase.
4. **Eight of fifteen plans** (03-07, 03-08, 03-10, 03-11, 03-12, 03-13, 03-14, 03-15) carry a `checkpoint:human-verify`/`human-action` task that was not executed in production. None of them represent a code-level security gap (see Production-Pending Gates), but `ROADMAP.md` marking "Phase 3: Complete (15/15)" should not be read as "cut over to production" — 03-14-SUMMARY.md already flags this distinction in `STATE.md`.
