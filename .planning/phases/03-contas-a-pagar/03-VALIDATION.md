---
phase: 3
slug: contas-a-pagar
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-22
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derivado de `03-RESEARCH.md` § Validation Architecture. As linhas do mapa por
> tarefa ganham `Task ID`/`Plan`/`Wave` quando os PLAN.md existirem — hoje o mapa
> é por requisito, que é o que o planner consome.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 5.0.0 (já configurado nos três workspaces) |
| **Config file** | `packages/dominio/vitest.config.mts`, `apps/api/vitest.config.mts` |
| **Quick run command** | `npm run test --workspace=@n1/dominio` (em memória, sem banco) |
| **Full suite command** | `npm run check` (tipos + lint + tokens + testes nos três workspaces) |
| **Estimated runtime** | ~20 s sem `DATABASE_URL` (os testes de persistência do `apps/api` pulam, DEC-09); com banco, somar o tempo do lote de 61 (PAG-05) |

---

## Sampling Rate

- **After every task commit:** `npm run test --workspace=@n1/dominio` (rápido, em memória)
- **After every plan wave:** `npm run check` — com `DATABASE_URL` setado localmente quando a onda tocar persistência
- **Before `/gsd-verify-work`:** suíte completa verde, incluindo os testes de `financeiro-tria/automation` que esta fase tocar (`cd ../financeiro-tria/automation && npm test`)
- **Max feedback latency:** 45 segundos

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | PAG-01 | T-3-02 (replay duplicado) | Tarefa importada preserva `date_created`/`date_closed`/histórico de status com a data original; replay do CLI não duplica (padrão `jaImportada()`/`importacao_ledger` de 02-22/02-25) | unit (domínio, puro) | `npm run test --workspace=@n1/dominio -- importacao-contas-a-pagar` | ❌ W0 — arquivo novo | ⬜ pending |
| TBD | TBD | TBD | PAG-01 | — | "Tempo em `para pagar`" continua mensurável a partir dos Registros de Atividade importados (29–31 dias é o ciclo normal) | unit (domínio) | `npm run test --workspace=@n1/dominio -- importacao-contas-a-pagar` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PAG-01 | T-3-02 | A importação **não** chama `changeTaskStatus` para replay — nenhuma das 9 Automações dispara durante a importação histórica | unit (domínio) — asserção de que nenhuma `AutomationExecution` nasce no replay | `npm run test --workspace=@n1/dominio -- importacao-contas-a-pagar` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PAG-02 / A1 | — | Recorrência: uma ocorrência por fechamento, mesmo reabrindo (RN-CP-06) | unit (domínio) | `npm run test --workspace=@n1/dominio -- -t "RN-CP-06"` | ✅ já existe (`operations.test.ts` ~3665) | ⬜ pending |
| TBD | TBD | TBD | PAG-02 / A2–A4, A9 | — | Automações de evento disparam dentro da mesma transação, cada uma com Execução auditável | unit (domínio) | `npm run test --workspace=@n1/dominio -- automations` | ⚠️ W0 — confirmar se estende `operations.test.ts` ou nasce dedicado | ⬜ pending |
| TBD | TBD | TBD | PAG-02 / A5–A7 | — | Automações de agenda disparam no dia certo e **não repetem** ao rodar duas vezes com o mesmo `today` | unit (domínio, `today: Date` injetado) | `npm run test --workspace=@n1/dominio -- automations` | ⚠️ W0 — cobrir "processo caiu e retomou" | ⬜ pending |
| TBD | TBD | TBD | AUTO-01 | T-3-04 (log vazando dado financeiro) | Poller chama `runScheduledAutomations` ≥ 1×/dia por Lista, **mesmo após reinício**; erro passa por `sanitizarErro()` antes de ir ao log | integration (Postgres real, `Relogio` injetável — padrão `outbox-worker.test.ts`) | `npm run test -w @n1/api -- automacoes/scheduler-worker` | ❌ W0 — arquivo novo | ⬜ pending |
| TBD | TBD | TBD | PAG-03 | T-3-03 (endpoint sem auth/idempotência) | Cálculo do lançamento separado da execução; Ensaio (D3-03) grava o que lançaria **sem nenhuma escrita no Omie**; idempotente por `codigo_lancamento_integracao` | unit (domínio, `buildResumoDePagamento` parametrizada) | `npm run test --workspace=@n1/dominio -- financeiro` | ⚠️ W0 — função existe, parametrização não | ⬜ pending |
| TBD | TBD | TBD | PAG-03 | T-3-03 | Novo endpoint de lançamento em `automation/` exige credencial de serviço (D-15) e `Idempotency-Key`; **não escreve status em lugar nenhum** | integration (Omie falso) | `cd ../financeiro-tria/automation && npm test` | ⚠️ W0 — `src/testing/omie-falso.ts` existe e é reusável; o endpoint não | ⬜ pending |
| TBD | TBD | TBD | PAG-04 | — | Categorias e contas vêm do plano real do Omie (`ListarCategorias`/`ListarDepartamentos`/RAG), não de `CATEGORIA_OMIE`/`CONTA_POR_TAG`/`CNPJ_POR_EMPRESA` fictícios; `REVISAR` abaixo de `CATEGORY_MIN_SIMILARITY` | unit + integration (Omie falso) | `npm run test --workspace=@n1/dominio -- financeiro` + `cd ../financeiro-tria/automation && npm test` | ⚠️ W0 | ⬜ pending |
| TBD | TBD | TBD | PAG-04 | — | RESUMO no formato exato de CON-CP-08, atribuído ao Financeiro (não ao Agente) | unit (domínio, asserção de string) | `npm run test --workspace=@n1/dominio -- financeiro` | ⚠️ W0 | ⬜ pending |
| TBD | TBD | TBD | PAG-05 | — | 61 fechamentos em lote, cada um dispara A1 uma vez; tempo de lock medido contra DEC-06 | integration (Postgres real) | `npm run test -w @n1/api -- lote-contas-a-pagar` | ❌ W0 — arquivo novo | ⬜ pending |
| TBD | TBD | TBD | PAG-06 | T-3-01 (Information Disclosure) | Pessoa A **não vê** Tarefa da Pessoa B (não só "Pessoa A vê a própria"); edita só Anexo e Data de Emissão | unit (domínio) | `npm run test --workspace=@n1/dominio -- tasks` | ⚠️ W0 — a checagem existe; o teste do caso negativo não | ⬜ pending |
| TBD | TBD | TBD | PAG-06 | T-3-01 | Grant da Pessoa da conta é concedida **dinamicamente** quando o campo Pessoa é preenchido, não só estática no seed | unit (domínio) | `npm run test --workspace=@n1/dominio -- tasks` | ❌ W0 — o mecanismo dinâmico não existe hoje | ⬜ pending |
| TBD | TBD | TBD | todos (portão CON-05) | — | `npm run check` verde nos três workspaces; os testes do domínio anteriores seguem idênticos; `automation/` com o mesmo `git log` fora o adapter/endpoint novo | full suite | `npm run check` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Cada teste nasce no mesmo plano/task que cria o código que ele prova.

- [ ] `packages/dominio/src/operations/importacao-contas-a-pagar.test.ts` — PAG-01 (trilha com data original, "tempo em `para pagar`", e a asserção-chave: nenhuma Automação dispara no replay)
- [ ] `apps/api/src/automacoes/scheduler-worker.test.ts` — AUTO-01, no padrão de `outbox-worker.test.ts` (relógio injetável, `processarUm()` sem esperar `intervaloMs`)
- [ ] Teste do novo endpoint de lançamento em `financeiro-tria/automation` — PAG-03/04; **reusar** `automation/src/testing/omie-falso.ts`, não recriar
- [ ] Teste de concessão dinâmica da Grant da Pessoa da conta — PAG-06; não existe hoje porque o mecanismo também não existe
- [ ] `apps/api/src/.../lote-contas-a-pagar.test.ts` — PAG-05, medindo o tempo de lock das 61 escritas contra DEC-06
- [ ] Ampliar a cobertura de `automations` para A2–A9 (decidir: arquivo dedicado ou `describe` novo em `operations.test.ts`)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| O Financeiro passa uma semana sem abrir o ClickUp | Critério 1 | Observacional — mede comportamento humano ao longo de dias, não estado de código | Ao fim da semana: confirmar com o Financeiro; conferir que a Lista `901107637383` está arquivada no ClickUp |
| Ensaio do Agente: taxa de acerto do que ele lançaria vs. o que o humano lançou | PAG-03, critério 4, D3-03 | Exige uma semana de dados reais e julgamento humano sobre os casos divergentes | Ao fim da primeira semana: exportar os registros de sombra e comparar com os lançamentos humanos; decidir se o Agente ganha a caneta |
| Credenciais Omie (TRIA) válidas para escrita real | PAG-03/04 | Fora do alcance do repositório — vive no `.env` de produção do `automation/` | Confirmar antes do fim da primeira semana de Ensaio, não antes de começar |
| Regra de feriado na recorrência | PAG-02 / A1, D3-05 lacuna 1 | Decisão de produto — os dados reais não respondem (ver Open Question #2) | Checkpoint com o Financeiro antes de codificar A1 |
| Regra de dia inexistente no mês | PAG-02 / A1, D3-05 lacuna 2 | Decisão de produto — `addMonths` já satura no último dia do mês; falta confirmar que é a intenção | Checkpoint com o Financeiro antes de codificar A1 |

---

## Sampling Risk — como o tempo é injetado

A5 (D-5), A6 (D-2) e A7 (D-1) disparam **uma vez por dia civil**. Um teste que roda em
1 segundo não pode esperar um dia real, e "esperar de verdade" é exatamente o
antipadrão que faria a suíte mentir.

A saída já existe no código e é obrigatória para qualquer peça nova:

- `runScheduledAutomations` recebe `today: Date` como parâmetro explícito — **não**
  lê `new Date()` internamente. O teste injeta datas arbitrárias
  (`2026-08-31`, depois `2026-09-01`) e simula a passagem de dias sem esperar.
- O scheduler-worker novo de `apps/api` precisa do **mesmo cuidado**: seguir
  `outbox-worker.ts`, que aceita um `Relogio` injetável (`apps/api/src/testes/relogio.ts`)
  em vez de chamar `Date.now()`/`new Date()` direto.

Sem isso, o critério 3 — "se o processo cair no minuto errado, a agenda não é
pulada" — não é testável a não ser esperando tempo real, e portanto não seria
testado. Chamar `runScheduledAutomations` duas vezes com o mesmo `today` e
provar que nada dispara duas vezes é o teste que fecha esse critério.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
