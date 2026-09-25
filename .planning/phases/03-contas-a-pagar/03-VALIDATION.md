---
phase: 3
slug: contas-a-pagar
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-09-22
audited: 2026-09-25
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
- **Before `/gsd-verify-work`:** suíte completa verde, incluindo os testes de `financeiro-tria/automation` que esta fase tocar (`cd ../financeiro-tria/automation && npx tsx --test src/http/contas-a-pagar-routes.test.ts src/tenants/tria/contas-a-pagar-*.test.ts`)
- **Max feedback latency:** 45 segundos

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | 03-09/03-10 | 1/3 | PAG-01 | T-3-02 (replay duplicado) | Tarefa importada preserva `date_created`/`date_closed`/histórico de status com a data original; replay do CLI não duplica (padrão `jaImportada()`/`importacao_ledger` de 02-22/02-25) | unit (domínio, puro) | `npm run test --workspace=@n1/dominio -- importacao-contas-a-pagar` | ✅ | ✅ green |
| TBD | 03-09 | 1 | PAG-01 | — | "Tempo em `para pagar`" continua mensurável a partir dos Registros de Atividade importados (29–31 dias é o ciclo normal) | unit (domínio) | `npm run test --workspace=@n1/dominio -- importacao-contas-a-pagar` | ✅ | ✅ green |
| TBD | 03-09 | 1 | PAG-01 | T-3-02 | A importação **não** chama `changeTaskStatus` para replay — nenhuma das 9 Automações dispara durante a importação histórica | unit (domínio) — asserção de que nenhuma `AutomationExecution` nasce no replay | `npm run test --workspace=@n1/dominio -- importacao-contas-a-pagar` | ✅ | ✅ green |
| TBD | 03-03 | 1 | PAG-02 / A1 | — | Recorrência: uma ocorrência por fechamento, mesmo reabrindo (RN-CP-06) | unit (domínio) | `npm run test --workspace=@n1/dominio -- -t "RN-CP-06"` | ✅ | ✅ green |
| TBD | 03-02 | 1 | PAG-02 / A2–A4, A9 | — | Automações de evento disparam dentro da mesma transação, cada uma com Execução auditável | unit (domínio) | `npm run test --workspace=@n1/dominio -- automations` | ✅ | ✅ green |
| TBD | 03-02 | 1 | PAG-02 / A5–A7 | — | Automações de agenda disparam no dia certo e **não repetem** ao rodar duas vezes com o mesmo `today` | unit (domínio, `today: Date` injetado) | `npm run test --workspace=@n1/dominio -- automations` | ✅ | ✅ green |
| TBD | 03-08 | 2 | AUTO-01 | T-3-04 (log vazando dado financeiro) | Poller chama `runScheduledAutomations` ≥ 1×/dia por Lista, **mesmo após reinício**; erro passa por `sanitizarErro()` antes de ir ao log | integration (Postgres real, `Relogio` injetável — padrão `outbox-worker.test.ts`) | `npm run test -w @n1/api -- automacoes/scheduler-worker` | ✅ | ✅ green |
| TBD | 03-04 | 1 | PAG-03 | T-3-03 (endpoint sem auth/idempotência) | Cálculo do lançamento separado da execução; Ensaio (D3-03) grava o que lançaria **sem nenhuma escrita no Omie**; idempotente por `codigo_lancamento_integracao` | unit (domínio, `buildResumoDePagamento` parametrizada) | `npm run test --workspace=@n1/dominio -- financeiro` | ✅ | ✅ green |
| TBD | 03-07 | 2 | PAG-03 | T-3-03 | Novo endpoint de lançamento em `automation/` exige credencial de serviço (D-15) e `Idempotency-Key`; **não escreve status em lugar nenhum** | integration (Omie falso) | `cd ../financeiro-tria/automation && npx tsx --test src/http/contas-a-pagar-routes.test.ts src/tenants/tria/contas-a-pagar-*.test.ts` | ✅ | ✅ green |
| TBD | 03-04/03-07/03-11 | 1/2/3 | PAG-04 | — | Categorias e contas vêm do plano real do Omie (`ListarCategorias`/`ListarDepartamentos`/RAG), não de `CATEGORIA_OMIE`/`CONTA_POR_TAG` (03-04) nem de `CNPJ_POR_EMPRESA` (03-11) fictícios; `REVISAR` abaixo de `CATEGORY_MIN_SIMILARITY` | unit + integration (Omie falso) | `npm run test --workspace=@n1/dominio -- financeiro` + `cd ../financeiro-tria/automation && npx tsx --test src/http/contas-a-pagar-routes.test.ts src/tenants/tria/contas-a-pagar-*.test.ts` | ✅ | ✅ green |
| TBD | 03-04 | 1 | PAG-04 | — | RESUMO no formato exato de CON-CP-08, atribuído ao Financeiro (não ao Agente) | unit (domínio, asserção de string) | `npm run test --workspace=@n1/dominio -- financeiro` | ✅ | ✅ green |
| TBD | 03-12 | 3 | PAG-05 | — | 61 fechamentos em lote, cada um dispara A1 uma vez; tempo de lock medido contra DEC-06 | integration (Postgres real) | `cd apps/api && npx vitest run src/e2e/lote-contas-a-pagar.test.ts` | ✅ | ✅ green |
| TBD | 03-05 | 2 | PAG-06 | T-3-01 (Information Disclosure) | Pessoa A **não vê** Tarefa da Pessoa B (não só "Pessoa A vê a própria"); edita só Anexo e Data de Emissão | unit (domínio) | `npm run test --workspace=@n1/dominio -- pessoa-da-conta` | ✅ | ✅ green |
| TBD | 03-05 | 2 | PAG-06 | 03-05/T-3-11 | **A visibilidade é derivada do valor do Campo Pessoa** (`List.sharedWithDefinitionIds` + `memberNamedOnTask`), não concedida por Grant — 03-05 escolheu a Opção A e apaga as `gr_cp_pessoa_*` estáticas do seed; guarda de tipo `person` obrigatória | unit (domínio) | `npm run test --workspace=@n1/dominio -- pessoa-da-conta` | ✅ | ✅ green |
| TBD | 03-14 | 5 | PAG-03 (Ensaio) | 03-14/T-3-65, T-3-67 | Comparação Ensaio × lançamento humano: `REVISAR` conta como recusa correta e fica **fora** do denominador; dia sem medição ⇒ `INCONCLUSIVO` e nenhuma taxa impressa; o relatório versionado não imprime fornecedor, valor, chave Pix nem código de barras | unit (domínio) | `npm run test --workspace=@n1/dominio -- ensaio-do-agente` | ✅ | ✅ green |
| TBD | 03-14 | 5 | PAG-03 (Ensaio) | 03-14/T-3-65 | O agregado publicado passa por varredura de padrão de documento; zero CPF/CNPJ/Pix na saída | integration | `npm run test -w @n1/api -- relatorios/ensaio-do-agente` | ✅ | ✅ green |
| TBD | 03-14 | 5 | PAG-03 (Ensaio) | 03-14/T-3-70 | O diálogo de registro do lançamento humano é texto livre, sem lista de categorias (não contamina a medição por viés de assentimento) e não coleta Pix/valor/fornecedor | unit (web) | `npm run test -w @n1/web -- lancamento-no-omie-dialog` | ✅ | ✅ green |
| TBD | 03-15 | 4 | PAG-06 (tela) | T-3-01 | A Pessoa alcança a própria Tarefa pela tela e **não** vê a de outro fornecedor; a busca e "Todas do Espaço" deixam de listar Tarefa sem filtro de visibilidade | unit (web) | `npm run test -w @n1/web -- compartilhadas-comigo` | ✅ | ✅ green |
| TBD | todos | — | todos (portão CON-05) | — | `npm run check` verde nos três workspaces; os testes do domínio anteriores seguem idênticos; `automation/` com o mesmo `git log` fora o adapter/endpoint novo | full suite | `npm run check` | ✅ | ⬜ pending — ver Validation Audit |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Cada teste nasce no mesmo plano/task que cria o código que ele prova.

- [x] `packages/dominio/src/operations/importacao-contas-a-pagar.test.ts` — PAG-01 (trilha com data original, "tempo em `para pagar`", e a asserção-chave: nenhuma Automação dispara no replay)
- [x] `apps/api/src/automacoes/scheduler-worker.test.ts` — AUTO-01, no padrão de `outbox-worker.test.ts` (relógio injetável, `processarUm()` sem esperar `intervaloMs`)
- [x] Teste do novo endpoint de lançamento em `financeiro-tria/automation` — PAG-03/04; **reusar** `automation/src/testing/omie-falso.ts`, não recriar
- [x] Teste de concessão dinâmica da Grant da Pessoa da conta — PAG-06; não existe hoje porque o mecanismo também não existe
- [x] `apps/api/src/.../lote-contas-a-pagar.test.ts` — PAG-05, medindo o tempo de lock das 61 escritas contra DEC-06
- [x] Ampliar a cobertura de `automations` para A2–A9 (decidir: arquivo dedicado ou `describe` novo em `operations.test.ts`)

Acrescentados em 2026-09-22, depois que os planos existiram (não estavam nesta
lista quando ela foi escrita — o portão do plan-checker apontou a lacuna):

- [x] `packages/dominio/src/operations/ensaio-do-agente.test.ts` — PAG-03/D3-03, a comparação Ensaio × humano — Plan 03-14
- [x] `apps/api/src/relatorios/ensaio-do-agente.test.ts` — PAG-03, cobertura da janela e sanitização do agregado — Plan 03-14
- [x] `apps/web/src/features/tarefa/lancamento-no-omie-dialog.test.tsx` — PAG-03, o registro do lançamento humano — Plan 03-14
- [x] `apps/web/src/features/shell/compartilhadas-comigo.test.tsx` — PAG-06, o caminho da Pessoa até a Tarefa e o caso negativo **na tela** — Plan 03-15

Donos dos seis itens originais, confirmados pelo plan-checker: 03-09, 03-08,
03-07, 03-05, 03-12 e 03-02+03-03.

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

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — conferido pelo plan-checker nos 15 planos
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references — os 6 itens originais mais os 4 acrescentados têm dono
- [x] No watch-mode flags
- [x] Feedback latency < 45s
- [x] `nyquist_compliant: true` set in frontmatter

**`wave_0_complete: true` desde a auditoria de 2026-09-25:** todos os arquivos
da Wave 0 existem e rodam verdes (ver Validation Audit abaixo).

**Approval:** approved 2026-09-22 (pré-execução, após o portão do plan-checker)

---

## Validation Audit 2026-09-25

Auditoria pós-execução (`/gsd-validate-phase 3`, estado A). Os 19 comportamentos do
mapa têm teste automatizado existente e verde — nenhuma lacuna, nenhum teste novo gerado.

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

Rodadas desta auditoria:

| Escopo | Comando | Resultado |
|--------|---------|-----------|
| `@n1/dominio` (suíte inteira) | `npm run test -w @n1/dominio` | 30 arquivos, 545/545 |
| `@n1/web` (suíte inteira) | `npm run test -w @n1/web` | 17 arquivos, 169/169 |
| `@n1/api` (9 arquivos da fase, Postgres real) | `npx vitest run` em `scheduler-worker`, `invocar-agente`, `relatorios/ensaio-do-agente`, `importacao/clickup/{contas-a-pagar,importar-contas-a-pagar,marco-zero,politica-do-marco-zero}`, `persistencia/agenda-de-automacoes`, `e2e/lote-contas-a-pagar` | 9 arquivos, 120/120, 0 pulados, 295 s |
| `financeiro-tria/automation` (3 arquivos da fase) | `npx tsx --test` em `contas-a-pagar-routes`, `contas-a-pagar-lancamento`, `contas-a-pagar-resolucao` | 24/24 |

Observações:
- A suíte inteira de `@n1/api` não foi rodada pelo agente (passa de 9 min contra o
  banco real); só os arquivos desta fase. O dono rodou `npm run check` em seguida:
  tokens e contratos OK, mas `src/e2e/dois-servicos.test.ts` falhou em (8)/(9)
  (ECONNREFUSED no callback do classificador). Esse arquivo NÃO é da Fase 3: está
  fora do git (untracked, ligado a 02-26) e estava sendo editado por outra sessão
  no momento da rodada (mtime 12:59, com instrumentação `_debug`). A saída colada
  terminou com `lote-contas-a-pagar` em 2/6, então a rodada não chegou ao fim.
  A linha do portão CON-05 fica `pending` até um `npm run check` completo e verde. O caso `(d)` de `lote-contas-a-pagar` — o que estourou
  180 s em `deferred-items.md` — passou nesta rodada.
- O mapa cita `npm test` para o `automation/`, mas o runner lá é `node:test` via
  `tsx`, não vitest; o comando da linha foi corrigido.
- Os comportamentos manuais seguem manuais. As duas decisões de produto de A1
  (feriado, dia inexistente) foram resolvidas em 03-03 (D3-06, D3-07) e estão
  travadas por `recorrencia-contas-a-pagar.test.ts`; a semana sem ClickUp, a taxa
  do Ensaio e as credenciais Omie de produção continuam pendentes de operação real.

