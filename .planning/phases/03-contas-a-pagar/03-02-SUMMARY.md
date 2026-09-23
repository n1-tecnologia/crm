---
phase: 03-contas-a-pagar
plan: 02
subsystem: domain
tags: [automacoes, motor, vocabulario-de-controle, tempo-injetado, vitest, auto-01]

# Dependency graph
requires:
  - phase: 01-fundacao
    provides: "executor de Automações (runListAutomations/runScheduledAutomations), AutomationExecution e o padrão de Ação tipada"
  - phase: 02-solicitacao-de-pagamento
    provides: "operations/ai.ts::solicitarAprovacao (decisão de processo ancorada em Tarefa, D-06) e a Lista de Solicitações com o status `em aprovação`"
provides:
  - "vocabulário de controle fechado: invocarAgente, notificar, solicitarAprovacao, aguardar e encerrar tratados em runAction"
  - "base de tempo única no motor — `instante(quando?)` e `mesmoDiaCivil()`; o `today` injetado é o relógio da Execução agendada"
  - "halt interno (`encerrar`/`aguardar`) com passos `pulado`/`aguardando` e execution.state `concluida`/`pendente`"
  - "automations-motor.test.ts: A2–A9 por evento e por agenda com datas injetadas, mais a metade de auditoria (Execução, passos, autoria) que não tinha teste"
affects: [03-08 scheduler worker, 03-11 ponte A7/A8, Phase 5 contas a receber R2-R7, C34 tempo em Status]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "relógio injetável em operação pura: um único `new Date()` sem argumento no módulo, atrás de helper"
    - "ContextoDeExecucao (quando/trigger/indice) passado às Ações em vez de cada Ação ler o relógio"
    - "recusa por construção: `aguardar` exige gatilho de agenda e índice 0, porque a retomada roda a Execução do começo"

key-files:
  created:
    - packages/dominio/src/operations/automations-motor.test.ts
  modified:
    - packages/dominio/src/operations/automations.ts

key-decisions:
  - "`ApprovalOrigin` não ganhou um terceiro ramo: `solicitarAprovacao` reusa `processTask`, e o achado (passo sempre `pagamento`, Lista precisa do status `em aprovação`) ficou registrado em prosa no cabeçalho do módulo — alargar a união arrastaria types/ai.ts e quatro consumidores de apps/web, fora da posse deste plano"
  - "`cost.durationMs` continua em `Date.now()` nas duas pontas: é duração, não data civil; nenhum comportamento se ramifica nela"
  - "`jaRodou` passou a contar também a Execução `pendente` do mesmo dia civil — sem isso duas chamadas com o mesmo `today` empilhariam duas esperas"
  - "O Aprovador de `solicitarAprovacao` nunca cai no dono da Automação por omissão (T-3-07): vem de `approverMemberId` ou de um Campo pessoa nomeado em params, ou a Ação falha"

patterns-established:
  - "Arquivo de teste do MOTOR separado do de processo: automations-motor.test.ts nunca lê o relógio da máquina (0 `new Date()`) e nunca nasce data de string ISO (fuso de São Paulo jogaria o dia para trás)"
  - "Prova de 'mesma transação' sem banco: capturar automationExecutions.length, chamar a operação, assertar na linha seguinte — 0 `await` no arquivo"

requirements-completed: [PAG-02, AUTO-01]

# Metrics
duration: 10min
completed: 2026-09-22
---

# Phase 03 Plan 02: Vocabulário do executor e base de tempo única Summary

**O motor de Automações passou a falar as quatro Ações que o ROADMAP atribui a AUTO-01 — mais `encerrar` — e a ter um relógio só: o `today` injetado agora é o relógio da Execução agendada, de ponta a ponta, de modo que "rodar duas vezes no mesmo dia" virou afirmação provada em vez de esperança.**

## Performance

- **Duration:** ~10 min de trabalho de execução (23:41 → 23:51 -03)
- **Started:** 2026-09-23T02:41:09Z (commit da Task 1)
- **Completed:** 2026-09-23T02:50:51Z (commit da Task 3)
- **Tasks:** 3
- **Files modified:** 2 (1 novo, 1 alterado)

## Accomplishments

- `runAction` trocou o `if (action.kind === "controle")` de ramo único por um `switch` de cinco ramos. `ramificar` continua deliberadamente fora de escopo e é o único que ainda cai em "Controle não suportado".
- Uma base de tempo só: `now()` virou `instante(quando?: Date)`, `execute` ganhou o parâmetro `quando`, e `runScheduledAutomations` passa o `today` recebido. `tarefa.definirCampo` com `today: true` grava o dia da Execução, não o da máquina. Sobrou exatamente **um** `new Date()` sem argumento no arquivo.
- `mesmoDiaCivil()` pôs as duas pontas de `jaRodou` na mesma base de tempo — antes a comparação era entre `startedAt` (relógio real) e `today` (injetado), que é precisamente por onde o critério 3 escorria.
- `aguardar` recusa por construção, não por documentação: exige gatilho de agenda (uma Execução de evento não tem quem a retome) e exige ser a primeira Ação (a retomada roda a Execução do começo).
- `automations-motor.test.ts` (533 linhas, novo) cobre A2/A3/A4/A9 por evento e A5/A6/A7 por agenda com datas fixas injetadas, e assere a metade que não tinha teste nenhum: a `AutomationExecution`, seus passos e a autoria do Registro.

## Task Commits

1. **Task 1: Uma base de tempo só — o `today` injetado é o relógio da Automação agendada** — `b62946a` (test) + `699dbf1` (feat)
2. **Task 2: As cinco Ações de controle** — `54c866a` (feat)
3. **Task 3: A2/A3/A4/A9 por evento — mesma transação, Execução auditável** — `0690400` (test)

## Files Created/Modified

- `packages/dominio/src/operations/automations-motor.test.ts` (novo, 533 linhas) — o arquivo do MOTOR: evento e agenda, A2–A9, datas injetadas pelo construtor numérico (`new Date(2026, 7, 31)`, nunca `new Date("2026-08-31")`, que em América/São_Paulo cairia no dia 30).
- `packages/dominio/src/operations/automations.ts` (+238 −20) — `switch` de controle, `instante`, `mesmoDiaCivil`, `membrosMencionados`, `esperaCumprida`, `ContextoDeExecucao`, `halt` no retorno interno de `runAction`. Nenhum símbolo exportado novo: o módulo continua exportando só `ListEvent`, `runListAutomations` e `runScheduledAutomations`.

## Decisions Made

- **`ApprovalOrigin` não foi alargada.** O ramo `solicitarAprovacao` reusa `processTask` — honesto (é decisão de processo ancorada numa Tarefa, D-06), mas herda que o passo de processo fica sempre `"pagamento"` e que a Lista precisa ter o status `em aprovação`. Fechar direito pede um terceiro ramo, o que arrasta `types/ai.ts` e os consumidores de `apps/web` (`painel-aprovacao.tsx`, `timeline.tsx` e dois testes de tela) — fora da posse de arquivos deste plano. **Achado registrado em prosa no cabeçalho do módulo e aqui, para o orquestrador.**
- **`notificar` é in-app nesta fase.** O alvo passa a enxergar o aviso por `pendingMentions`; por Canal é Phase 5 (`03-CONTEXT.md` § Adiado).
- **`jaRodou` conta `pendente`.** Uma espera que ainda não venceu não é reavaliada duas vezes no mesmo dia; o dia seguinte reavalia normalmente.

## Deviations from Plan

Nenhuma sob as Regras 1–4. Nenhum pacote instalado (T-3-SC preservado). Nenhuma mudança de tipo: `git diff --quiet packages/dominio/src/types/ai.ts` sai 0.

## Verification

| Critério | Resultado |
|---|---|
| `npm run test --workspace=@n1/dominio` | **374 passed** (16 arquivos), exit 0 — eram 355 antes deste plano |
| `new Date()` sem argumento em `automations.ts` (fora de comentário) | `1` (esperado 1) |
| `Date.now()` em `automations.ts` (fora de comentário) | `2` (as duas pontas de `durationMs`) |
| `new Date()` / `new Date("` no teste | `0` / `0` |
| Teste contém `2026, 7, 31` e `2026, 8, 1` | 17 e 2 |
| `case "notificar"` / `"solicitarAprovacao"` / `"aguardar"` / `"encerrar"` | 1 cada |
| `solicitarAprovacaoDeProcesso` (import + chamada) | `2` |
| Referências ao Financeiro em `automations.ts` (fora de comentário) | `4` — o mesmo de antes da fase; o motor não ganhou nenhuma |
| `pendingMentions` no teste | `4` |
| `await` no teste | `0` — o motor de evento é síncrono e o teste não finge o contrário |
| `automationExecutions` no teste | `7` |
| `aut_cp_a2/a3/a4/a9` no teste | presentes |
| CON-05: `operations.test.ts`, `contas-a-receber.test.ts`, `types/ai.ts` | `git diff --quiet` sai 0 — sem diff |
| `git diff --name-only f109407..HEAD` | exatamente os dois arquivos declarados |

## Threat Model Compliance

| Threat | Disposição | Como ficou |
|---|---|---|
| T-3-07 (elevação por Aprovador implícito) | mitigate | Aprovador vem de `approverMemberId` ou de Campo pessoa nomeado em `params`; sem nenhum dos dois a Ação falha. `solicitarAprovacao` continua exigindo Membro ativo e `mayDecideApproval` continua governando quem decide |
| T-3-01 (Menção a quem não vê a Tarefa) | accept | `pendingMentions` já filtra por `memberSeesTask`; a concessão dinâmica da Grant da Pessoa da conta é o Plan 03-05 |
| T-3-04 (vazamento em log) | accept | `packages/dominio` não faz I/O e não loga |
| T-3-SC (instalação de pacote) | accept | nada instalado |

## Issues Encountered

- **A sessão do executor foi interrompida duas vezes** — uma por suspensão da máquina host no meio da resposta, outra por estol do watchdog (600 s sem progresso) enquanto rodava o gate completo. As quatro tarefas já estavam commitadas; o que faltou foi só o fechamento. O orquestrador verificou os critérios de aceitação por conta própria (tabela acima, todos conferidos contra o código no disco) e escreveu este SUMMARY. **Nenhum resultado foi herdado de relato: a suíte de domínio foi reexecutada do zero (374 passed).**
- Fica o registro operacional da Fase 3: o gate completo (`npm run check` nos três workspaces) custa ~10 min por causa da suíte do `apps/api` contra o Supabase remoto e estoura o teto de 600 s de uma chamada de ferramenta. Para planos que só tocam `packages/dominio`, `npm run test --workspace=@n1/dominio` roda em 1,6 s e é o gate certo.

## Known Stubs

Nenhum. `ramificar` continua fora de escopo por decisão, não por omissão — e é o único `controlKind` que cai no `default`.

## Next Phase Readiness

- **Plan 03-08 (scheduler worker) desbloqueado do lado do domínio:** `runScheduledAutomations` agora tem base de tempo única e `jaRodou` que respeita `pendente`, que é o que o worker precisa para catch-up sem duplicar Execução.
- **Plan 03-11 (ponte A7/A8):** `invocarAgente` ficou intacto no `switch`; a parametrização do de-para é do Plan 03-04, que roda depois nesta mesma onda.
- **Phase 5 (R2–R7) e C34:** o vocabulário fechado é genérico — nenhuma Ação nova nomeia Lista, Status, Campo ou Membro do Financeiro.
- **Aberto para o orquestrador:** o terceiro ramo de `ApprovalOrigin`. Não bloqueia esta fase; vale decidir antes que um quarto consumidor de `processTask` apareça.

## Self-Check: PASSED

- `packages/dominio/src/operations/automations-motor.test.ts` — existe
- `packages/dominio/src/operations/automations.ts` — existe (modificado)
- `.planning/phases/03-contas-a-pagar/03-02-SUMMARY.md` — existe
- Commits `b62946a`, `699dbf1`, `54c866a`, `0690400` — presentes no histórico
- `npm run test --workspace=@n1/dominio` — 374 passed, exit 0 (reexecutado pelo orquestrador)

---
*Phase: 03-contas-a-pagar*
*Completed: 2026-09-22*
