---
phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista
plan: 15
subsystem: api
tags: [scheduler, automacoes, lixeira, previa, ponte, postgres, dominio]

requires:
  - phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista
    provides: "10-05 — agenda-do-relogio.ts (regime e ator por Lista) e o catálogo do agendador com duas fontes"
  - phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista
    provides: "10-03 — purgeExpiredTasks e previsaoDeEliminacao (a regra da retenção da lixeira)"
provides:
  - "tarefasDaLixeiraVencidas(state, listId, hoje) no domínio: a regra única que o expurgo e a prévia usam"
  - "npm run automacoes:previa -w @n1/api: tabela só leitura do que o relógio faria por Lista (sem título de Tarefa)"
  - "candidatosDaLixeira como terceira fonte de catalogoDeListasComAgenda (Q3 = direto)"
  - "agendaDoDia com o quinto parâmetro opcional OpcoesDaAgenda; a rodarAgenda da ponte compõe os três relógios (F4)"
affects: [10-16 retirada do botão e checkpoint D-04, deploy com AUTOMACOES_WORKER_ATIVO=true]

status: complete
actuals:
  tokens: 12300
  tasks: 3
  commits: 3
plan_head_before: 478574792deed4dfb53374243efbcf0c7af36d8a
plan_head_after: ab5132898d5f8b43fe31e6623ff3f1ef802cf457

tech-stack:
  added: []
  patterns:
    - "Prévia só leitura: hidratar dentro de begin read only + rollback, saída só com contagens e nomes de Lista/Membro"
    - "Regra de negócio extraída uma vez no domínio (tarefasDaLixeiraVencidas) e consumida pelo expurgo e pela prévia, nunca duplicada no SQL"

key-files:
  created:
    - apps/api/src/automacoes/previa.ts
    - apps/api/src/automacoes/previa.cli.ts
    - apps/api/src/automacoes/previa.test.ts
    - .planning/phases/10-clone-clickup-cont-ineres-espa-o-pasta-e-lista/10-PROVAS.md
  modified:
    - packages/dominio/src/operations/tasks.ts
    - packages/dominio/src/operations/agenda-do-relogio.test.ts
    - apps/api/package.json
    - apps/api/src/automacoes/scheduler-worker.ts
    - apps/api/src/automacoes/scheduler-worker.test.ts
    - apps/api/src/automacoes/invocar-agente.ts
    - apps/api/src/automacoes/invocar-agente.test.ts
    - apps/api/src/automacoes/CONTEXT.md

key-decisions:
  - "Q3 = direto (decisão do dono, 2026-10-29, depois de ver a prévia de produção): a Lista que entra no catálogo só pela lixeira roda a primeira volta sem ensaio e elimina o que passou da retenção; a ponte passa a expurgar Contas a pagar e Contas a receber."
  - "candidatosDaLixeira mora em scheduler-worker.ts (com as outras duas fontes) e previa.ts a reexporta: evita o import circular previa <-> scheduler-worker que o Task 1 deixou."
  - "Q1 (autoria humana da Atividade do relógio) continua assunção a confirmar com o dono no checkpoint D-04 do 10-16; na produção, Lista 1 e Lista do subgrupo do ws_n1 seriam assinadas por Maryane Generozo."

patterns-established:
  - "Checkpoint de efeito irreversível com a contagem real de produção antes do código que o alcança"

requirements-completed: [EST-01]

coverage:
  - id: D1
    description: "A prévia (automacoes:previa) lista por Lista candidata o regime, o ator e a contagem de Tarefas vencidas na lixeira, sem gravar nada e sem imprimir título de Tarefa"
    requirement: EST-01
    verification:
      - kind: integration
        ref: "apps/api/src/automacoes/previa.test.ts#três Listas, três jeitos de entrar"
        status: pass
      - kind: integration
        ref: "apps/api/src/automacoes/previa.test.ts#o texto impresso não contém o título de nenhuma Tarefa do Espaço (T-10-39)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A Lista que só tem Tarefa na lixeira entra no catálogo e a primeira volta real a expurga direto: fecha concluido sem ENSAIO_PRIMEIRA_VOLTA, elimina as vencidas e preserva a que está na retenção"
    requirement: EST-01
    verification:
      - kind: integration
        ref: "apps/api/src/automacoes/scheduler-worker.test.ts#(z1) (z2) (z3)"
        status: pass
      - kind: unit
        ref: "packages/dominio/src/operations/agenda-do-relogio.test.ts#Q3 = direto (10-15)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A rodarAgenda da ponte do Agente de lançamento compõe os três relógios: série por calendário vencida gera a próxima ocorrência em Lista que não é a da ponte, e o expurgo roda na Lista dela sem perder as opções (CNPJ)"
    requirement: EST-01
    verification:
      - kind: unit
        ref: "apps/api/src/automacoes/invocar-agente.test.ts#F4"
        status: pass
    human_judgment: false
  - id: D4
    description: "O dono viu a prévia de produção antes da primeira volta real e escolheu o regime da lixeira"
    requirement: EST-01
    verification: []
    human_judgment: true
    rationale: "Decisão do dono (checkpoint Q3), registrada em 10-PROVAS.md; não há teste que asserte uma escolha humana."
---

# Phase 10 Plan 15: lixeira vencida no relógio e ponte dos três relógios Summary

**Prévia só leitura do relógio (`automacoes:previa`), decisão Q3 = direto registrada em 10-PROVAS.md, a lixeira como terceira fonte do catálogo do agendador e a ponte do Agente de lançamento compondo Automação por vencimento, Recorrência por calendário e expurgo por `agendaDoDia`.**

## Performance

- **Duration:** cerca de 2 h de relógio, em duas sessões (a decisão do dono no checkpoint Q3 fica entre elas)
- **Completed:** 2026-10-29
- **Tasks:** 3 (Task 1 tracer, Task 2 checkpoint de decisão, Task 3)
- **Files:** 11 (excluindo `.planning`: 738 inserções, 25 remoções)

## Accomplishments

- **Task 1 (tracer, `1e913a4`).** `tarefasDaLixeiraVencidas` extraída de `purgeExpiredTasks` (mesmo resultado nos testes existentes); `previaDaAgenda` une o catálogo do worker com os candidatos da lixeira, hidrata cada Espaço em `begin read only` + rollback e calcula regime, ator (`atorDoRelogio`), lixeira vencida e séries por calendário; `previa.cli.ts` imprime a tabela e a soma. Os testes de banco local comparam as contagens de `plataforma.registros`, `plataforma.automacao_agenda` e a revisão do Espaço antes e depois: nada é gravado; e procuram os títulos de todas as Tarefas do Espaço na saída: nenhum vaza.
- **Task 2 (checkpoint Q3, `9f860e1`).** O dono rodou a prévia em produção: 86 Listas candidatas, a primeira volta real eliminaria 65 Tarefas, todas em 13 Espaços de teste; 0 no Espaço real `ws_n1` e 0 em Contas a pagar e Contas a receber em todos os Espaços. Respondeu `direto`. Prévia e escolha ficam em `10-PROVAS.md`, seção "Q3 — lixeira vencida (10-15)".
- **Task 3 (`ab51328`).** `candidatosDaLixeira` entra em `catalogoDeListasComAgenda` (movida de `previa.ts` para `scheduler-worker.ts`, reexportada pela prévia); `agendaDoDia` ganha o quinto parâmetro `OpcoesDaAgenda`, repassado a `runScheduledAutomations`; os dois ramos da `rodarAgenda` da ponte chamam `agendaDoDia`. `regimeDaPrimeiraVolta` não mudou: já devolve `direto` para a Lista sem Automação por vencimento, que é exatamente a escolha do dono. `CONTEXT.md` de `automacoes` registra a terceira fonte, a prévia e a ponte.

## Verification

- `packages/dominio`: `npx vitest run` completo, 109 arquivos e 2125 testes verdes; `tsc --noEmit` limpo.
- `apps/api`, contra Postgres 16 local (porta 55715, `DATABASE_URL` e `DATABASE_URL_MIGRACAO` explícitos): `npx vitest run src/automacoes`, 22 arquivos, 387 passam e 1 pulado (a cópia verbatim do contrato do produtor, sem relação com o plano); `tsc --noEmit` limpo. Os casos novos de banco rodaram (não aparecem como skipped).
- Acceptance: `grep -c "agendaDoDia(" invocar-agente.ts` = 2; `grep -c candidatosDaLixeira scheduler-worker.ts` = 2 (escolha `direto`); `read only` em `previa.ts` = 3; DML em `previa.ts` = 0; `"automacoes:previa"` em `package.json` presente; `10-PROVAS.md` tem a escolha e o que foi implementado.
- O `npm test` inteiro não foi rodado (13 a 17 min, e um e2e falha sempre por rede); `npm run lint` existe só para o `apps/web`, que este plano não tocou.
- O contêiner `crm-n1-pg-1015` foi removido ao fim; nenhum processo ficou de pé.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Import circular previa.ts <-> scheduler-worker.ts**
- **Found during:** Task 3 (o worker precisa de `candidatosDaLixeira`, que o Task 1 criou em `previa.ts`, que já importa o worker)
- **Issue:** o plano manda o worker importar `candidatosDaLixeira` de `previa.ts`; o Task 1 já tinha deixado `previa.ts` importando `catalogoDeListasComAgenda` do worker. Funcionaria só porque ambos usam o import dentro de funções.
- **Fix:** `candidatosDaLixeira` passou a morar em `scheduler-worker.ts`, ao lado das outras duas fontes; `previa.ts` a reexporta, então `previa.test.ts` e a prévia seguem importando de `./previa`.
- **Files modified:** apps/api/src/automacoes/scheduler-worker.ts, apps/api/src/automacoes/previa.ts
- **Commit:** ab51328

**2. [Rule 1 - Bug no teste] (z1) assumia que só uma Lista do seed tem lixeira**
- **Found during:** Task 3 (primeira rodada dos testes)
- **Issue:** o seed já tem Tarefa na lixeira em `lst_piloto`; a asserção `toEqual([lst_prospeccao])` falhou.
- **Fix:** `toContain(lst_prospeccao)`.
- **Files modified:** apps/api/src/automacoes/scheduler-worker.test.ts
- **Commit:** ab51328

**Total deviations:** 2 auto-fixed (1 bloqueio estrutural, 1 teste). **Impact:** nenhum no comportamento entregue.

## Known Stubs

None.

## Threat Flags

None. A prévia (T-10-38, T-10-39) e a primeira volta do expurgo (T-10-37) já estavam no `threat_model`; nenhuma superfície nova foi criada.

## Issues Encountered

None.

## Pendências para o 10-16 e o deploy

- **Q1 segue em aberto.** Na produção, Lista 1 e Lista do subgrupo do `ws_n1` (entram pela lixeira) seriam assinadas por Maryane Generozo, uma pessoa; Contas a pagar e Contas a receber, pelo Agente do pipeline. A confirmação formal da autoria é o checkpoint D-04 do 10-16.
- **Primeira volta real depois do deploy.** Com `direto`, o que está na coluna "Lixeira vencida" some na primeira volta com `AUTOMACOES_WORKER_ATIVO=true`. Hoje isso é 0 no `ws_n1` e 65 Tarefas em Espaços de teste. Se entre a prévia e o deploy alguém mandar Tarefa do `ws_n1` à lixeira e ela vencer, a contagem muda: reconferir com `npm run automacoes:previa -w @n1/api -- ws_n1` perto do deploy.

## Next Phase Readiness

Pronto para 10-16 (retirada do botão de Recorrência e checkpoint D-04).

## Self-Check: PASSED

- Arquivos criados e alterados existem (previa.ts, previa.cli.ts, previa.test.ts, 10-PROVAS.md e os modificados).
- Commits na branch: 1e913a4, 9f860e1, ab51328.
