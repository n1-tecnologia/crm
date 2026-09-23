---
phase: 03-contas-a-pagar
plan: 09
subsystem: domain
tags: [contas-a-pagar, importacao, clickup, historico, automacoes, trilha-de-atividade, d3-04]

# Dependency graph
requires:
  - phase: 02-solicitacoes
    provides: "`importarSolicitacaoHistorica` e `importActor`/`jaImportada` (`operations/importacao.ts`) — o precedente direto, reusado sem ser reescrito"
  - phase: 03-contas-a-pagar
    provides: "03-01 registrou a convenção `origem = 'clickup:901107637383'` sobre o `plataforma.importacao_ledger` existente — nenhum ledger novo"
provides:
  - "`importarContaAPagarHistorica(state, actingMemberId, entrada)` — a operação de domínio que o Plan 03-10 chama 2.861 vezes"
  - "`EntradaDeContaAPagarHistorica` — o contrato de entrada que 03-10 preenche a partir do export em disco"
  - "`TransicaoHistoricaDeStatus` — `{ em, statusId?, nomeLegado }`, o `status_history` do ClickUp já convertido"
  - "`contaAPagarJaImportada(state, legacyTaskId)` — a barreira em memória de T-3-02, delegada a `jaImportada`"
  - "`ORIGEM_CONTAS_A_PAGAR = 'clickup:901107637383'` — `provenance.sourceName` aqui e `importacao_ledger.origem` em 03-10, numa fonte só"
  - "lacuna nova de importação: `status_final_diverge_do_historico`"
  - "`jaImportada` exportada de `operations/importacao.ts` (uma palavra)"
affects: [03-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Replay histórico em Lista com Automações: Status na criação + `runAutomations: false`, trilha por `recordActivity({ at })` — nunca `changeTaskStatus`"
    - "Resolver o Status final por `statusDefinition` ANTES de `createTask`, porque `createTask` cai no primeiro `naoIniciado` em silêncio"
    - "Prova não-vazia: o teste afirma primeiro que as sete Automações existem, depois que nenhuma rodou"

key-files:
  created:
    - packages/dominio/src/operations/importacao-contas-a-pagar.ts
    - packages/dominio/src/operations/importacao-contas-a-pagar.test.ts
  modified:
    - packages/dominio/src/operations/importacao.ts
    - packages/dominio/src/operations/index.ts
    - packages/dominio/CONTEXT.md

key-decisions:
  - "`completedAt` cai para o instante da última transição quando `fechadaEm` não vem: o export tem contas em `pago` com `date_closed: null`, e a transição é prova demonstrável — nunca uma data inventada"
  - "Status final não terminal não fecha conta, mesmo com `fechadaEm` preenchido — `isTerminalCategory` decide, não a presença do campo"
  - "Divergência entre `statusFinalId` e a última transição resolvida vira Registro `Lacuna de importação`, não recusa: parar 2.861 linhas por isso seria pior"
  - "`createdByDelegate` gravado na Tarefa quando o Ator não é Membro — o operador do CLI aparece como delegado, nunca como autor (T-3-09)"
  - "O caso (h) usa `fd_cr_situacao` (Campo real de Contas a receber) em vez de um id inventado: prova a recusa por 'a Lista não enxerga este Campo', não por 'Campo não existe'"

patterns-established:
  - "Mutação de verificação: ligar `runAutomations` e confirmar que o caso (a) falha, antes de confiar no verde"

requirements-completed: [PAG-01]

# Metrics
duration: 15min
completed: 2026-09-23
---

# Phase 03 Plan 09: A Conta a pagar histórica nasce no Status final, e nenhuma Automação percebe

**Uma Tarefa da Lista `901107637383` entra na plataforma com a data em que nasceu, a data em que fechou e cada passo entre as duas — construída por `createTask` já no Status final com `runAutomations: false` e por um `recordActivity` datado por transição, sem que o código toque `changeTaskStatus` uma única vez.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-09-23T09:40Z
- **Completed:** 2026-09-23T09:55Z
- **Tasks:** 2
- **Files modified:** 5 (2 criados, 3 modificados)

## Accomplishments

- **O replay é mudo, e a prova não é vazia.** O caso (a) afirma primeiro que a Lista tem `>= 7` Automações ativas no bootstrap e só então que `state.automationExecutions.length` é `0`, `state.tasks` cresce exatamente `1` (nenhuma recorrência fantasma de A1), `task.comments.length` é `0` (nenhuma cobrança de A5/A6) e `assignees` é exatamente o que a entrada mandou (A2/A3 não mexeram).
- **A trilha carrega a data de origem.** Um Registro `Status alterado` por transição, com o `at` daquela transição; o conjunto dos `at` é igual ao conjunto dos `em` da entrada; e **nenhum** Registro da Tarefa é posterior ao maior instante do histórico — a prova, por comparação lexicográfica de ISO-8601 em UTC, de que nada foi datado com o relógio da importação.
- **"Tempo em `para pagar`" é conta que se faz.** `diasEmStatus(state, taskId, nome)` vive no arquivo de teste, lê só `state.activity` (ordenando por `at`, porque `recordActivity` faz `unshift`) e devolve 30 dias para um ciclo real — a métrica sai do que a importação gravou, sem nenhum dado auxiliar.
- **Status final desconhecido é recusa.** `createTask` cai no primeiro `naoIniciado` quando `input.statusId` não resolve (`tasks.ts:126-133`); a operação resolve por `statusDefinition` antes e falha citando o id. Sem isso (T-3-08) uma linha malclassificada viraria uma conta em `para pagar` para alguém pagar de novo.
- **Reimportação e rollback fechados.** `contaAPagarJaImportada` delega a `jaImportada` de `importacao.ts` — exportada, não copiada (T-3-02). Um Campo que a Lista não enxerga desfaz Tarefa, Registros e o identificador legível consumido, com a recusa citando o `definitionId` e nunca o valor (T-3-07).
- **O `apps/api` enxerga a operação.** `export * from "./importacao-contas-a-pagar"` no barril, crua (a função não está em `OPERACOES`, pela mesma razão do precedente: quem importa é o CLI, não um Membro na interface).

## Task Commits

1. **Task 1: a operação `importarContaAPagarHistorica`** — `536e78d` (feat) — `importacao-contas-a-pagar.ts` + `export` em `jaImportada` + a linha do barril
2. **Task 2: os nove casos (a)…(i) e o contrato em `CONTEXT.md`** — `1eee1e1` (test)

**Plan metadata:** o commit `docs(03-09): …` (SUMMARY + STATE + ROADMAP + REQUIREMENTS), logo depois destes dois.

## Files Created/Modified

- `packages/dominio/src/operations/importacao-contas-a-pagar.ts` *(criado, 281 linhas)* — cabeçalho de intenção no tom do precedente (por que a autorização de `importacao.ts:34-41` **não** se estende a esta Lista), `ORIGEM_CONTAS_A_PAGAR`, os dois tipos do contrato, `contaAPagarJaImportada` e a operação
- `packages/dominio/src/operations/importacao-contas-a-pagar.test.ts` *(criado, 9 casos)* — (a) replay mudo, (b) trilha datada na origem, (c) `diasEmStatus`, (d) conta aberta, (e) vencimento só no campo nativo, (f) reimportação, (g) Status desconhecido, (h) rollback, (i) autoria e lacunas
- `packages/dominio/src/operations/importacao.ts` — **uma palavra**: `export` em `jaImportada` (`git diff --numstat` = `1 1`); `importacao.test.ts` intocado
- `packages/dominio/src/operations/index.ts` — uma linha, ao lado de `export * from "./importacao"`
- `packages/dominio/CONTEXT.md` — seção `## Importação histórica de Contas a pagar (Fase 3)`, inserida entre a do de-para (03-04) e a de Recorrência (03-03), que ficaram intactas

## Decisions Made

- **`completedAt` = `fechadaEm ?? o instante da última transição.`** O export tem Tarefas em `pago` com `date_closed: null`. A transição para o Status final é prova demonstrável; um `new Date()` ali seria data inventada, exatamente o que D-25 proíbe.
- **Categoria terminal manda, não a presença do campo.** `completedAt` só existe quando `isTerminalCategory(statusFinal.category)`. Uma conta importada em `para pagar` com `fechadaEm` preenchido por engano do de-para não nasce fechada.
- **Divergência é lacuna, não recusa.** Quando a última transição com `statusId` resolvido não é o `statusFinalId`, a operação acrescenta `status_final_diverge_do_historico` às lacunas e segue. Recusar interromperia a importação inteira por um desacordo que o Financeiro precisa ver, não evitar.
- **O operador do CLI é delegado, nunca autor.** Sem `autoriaConhecida`, `createdBy` e o `actor` de todo Registro são `{ kind: "system", id: "importacao:clickup:901107637383" }`, com `delegate` no `actingMemberId` — inclusive `createdByDelegate` na própria Tarefa (T-3-09).
- **Um só `new Date()` no arquivo**, no `at` de `provenance` — que é legitimamente o instante em que a importação rodou. Todo `recordActivity` passa `at` explícito.

## Deviations from Plan

Nenhuma. O plano foi executado como escrito: os tipos, os nomes, a ordem do corpo (12 passos), os critérios de `grep` e os nove casos do teste saíram exatamente como especificados.

Dois detalhes ficaram mais estritos do que o texto pedia, sem mudar escopo:

- `createdByDelegate` também é gravado na Tarefa (o plano só nomeava o `delegate` dos Registros) — coerente com "nunca o operador se passando pelo autor original".
- O caso (h) usa `fd_cr_situacao`, um Campo real definido na Lista de Contas a receber, em vez de um id inexistente: assim a recusa exercitada é "a Lista desta Tarefa não enxerga este Campo", que é a de T-3-07, e não "Campo não encontrado".

## Issues Encountered

- **O verde de primeira é suspeito.** O teste passou na primeira execução, o que não distingue "a operação está correta" de "a asserção não morde". Verificação por mutação: `runAutomations: false` → `true` no arquivo de implementação fez o caso (a) falhar com `automationExecutions` `+1` (três Execuções) — a prova morde. O arquivo foi restaurado byte a byte (`git diff --quiet` contra `536e78d`) e o teste voltou a passar antes do commit da Task 2.
- **`npm run check` monolítico continua estourando o teto de 600 s da ferramenta.** Decomposto por workspace, como 03-03 e 03-04 já haviam feito.

## Verificação do portão (CON-05)

`npm run check` decomposto, tudo verde, sem `DATABASE_URL` no ambiente:

| Etapa | Resultado |
|---|---|
| `typecheck` @n1/dominio | 0 |
| `typecheck` @n1/api | 0 |
| `typecheck` @n1/web | 0 |
| `lint` (eslint) | 0 |
| `verificar:tokens` | ✓ 392 definidos · 211 arquivos · 0 falhas |
| `test` @n1/dominio | 418 passed (409 antes + os 9 novos) |
| `test` @n1/web | 107 passed |
| `test` @n1/api | 380 passed, 12 skipped — `env -u DATABASE_URL`, 176 s |

Critérios de `grep` do plano, todos satisfeitos:

| Critério | Resultado |
|---|---|
| `changeTaskStatus` fora de comentário | `0` |
| `fetch(` / `process.env` / `require(` / `node:` fora de comentário | `0` |
| `export function jaImportada` em `importacao.ts` | `1`, com `git diff --numstat` = `1 1` |
| `git diff --quiet importacao.test.ts operations.test.ts` | `0` (intocados) |
| `importacao-contas-a-pagar` em `index.ts` | `1` |
| `automationExecutions` / `diasEmStatus` no teste | `1` / `2` |
| padrão de CPF/CNPJ no teste (T-3-07) | `0` |
| `CONTEXT.md` contém as três strings exigidas | sim |

`apps/web`, `apps/api` e `../financeiro-tria/automation` sem uma linha de diff nesta rodada.

## Threat Flags

Nenhuma superfície nova fora do `<threat_model>` do plano: a operação não abre endpoint, não toca auth, não lê disco e não muda esquema. `T-3-07`, `T-3-08`, `T-3-09` e a metade `jaImportada` de `T-3-02` estão mitigadas e cada uma tem caso de teste nomeado.

## What's Next

- **Plan 03-10** consome esta assinatura: ler `apps/api/exportacoes/clickup/901107637383/`, converter `status_history[].since` (epoch-ms em string, fora de ordem cronológica) para ISO-8601, resolver o de-para de usuários (PREP-04), chamar `importarContaAPagarHistorica` sob transação e gravar `plataforma.importacao_ledger` com `origem = ORIGEM_CONTAS_A_PAGAR`.
- **Ponta solta declarada, para 03-08/03-10 decidirem:** contas importadas que ficam em `para pagar` com vencimento no passado são alvo legítimo de A5/A6/A7 na primeira volta do agendador. Esta operação não dispara nada e não opina; a decisão ("a primeira volta ignora o passado?") não é dela.
- **Fora de escopo por decisão do plano:** os 4.266 Comentários do export não entram nesta operação. PAG-01, o critério 2 do ROADMAP e D3-04 nomeiam `date_created`, `date_closed` e o histórico de status — Comentário não aparece em nenhum dos três.

## Known Stubs

Nenhum. A operação está completa e o Plan 03-10 a alcança pelo barril.

## Self-Check: PASSED

Os dois arquivos criados e o SUMMARY existem em disco; os commits `536e78d` e `1eee1e1` existem no histórico.
