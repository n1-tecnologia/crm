---
phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista
plan: 05
subsystem: api
tags: [scheduler, automacoes, recorrencia, postgres, fastify, dominio]

requires:
  - phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista
    provides: "10-18 — operações de contêiner no domínio (ordem da fase, sem dependência de arquivo)"
provides:
  - "agenda-do-relogio.ts no domínio: listaTemAgendaPorVencimento, regimeDaPrimeiraVolta, atorDoRelogio (puras)"
  - "catálogo do agendador com Listas que têm Tarefa recorrente por calendário (D-01)"
  - "ator e regime escolhidos por Lista dentro do executar(); código SEM_ATOR"
  - "iniciar() que drena a fila até maxPorVolta (F5)"
affects: [10-15 lixeira vencida no relógio, 10-16 retirada do botão e checkpoint D-04, Fase 12 custo de hidratação]

actuals:
  tokens: 14000
  tasks: 2
  commits: 4
plan_head_before: 2c06ce42392632f6e92b80eacf9e55d63f3b95ea
plan_head_after: 6d7dbf3165099dd836a5777d35ffdf6a9397472c

tech-stack:
  added: []
  patterns:
    - "Escolha por Lista no domínio, SQL só candidato: regime e ator saem de funções puras chamadas dentro do executar()"
    - "Pontos de extensão de teste no worker (escolherAtor, escolherRegime) para preservar casos antigos sem tocá-los"

key-files:
  created:
    - packages/dominio/src/operations/agenda-do-relogio.ts
    - packages/dominio/src/operations/agenda-do-relogio.test.ts
  modified:
    - packages/dominio/src/operations/automations.ts
    - apps/api/src/automacoes/scheduler-worker.ts
    - apps/api/src/automacoes/scheduler-worker.test.ts
    - apps/api/src/automacoes/CONTEXT.md
    - apps/api/.env.example

key-decisions:
  - "Autoria humana da Atividade do relógio (Q1/A1) segue como assunção a confirmar com o dono no checkpoint D-04 do 10-16; se ele preferir autoria Sistema, a mudança é no domínio (variantes com ActorRef)."
  - "O Agente do pipeline NÃO ganha administrar em Espaço nenhum (T-10-14): o ator é escolhido por Lista, dentro do processo."
  - "parar() interrompe a drenagem entre duas linhas (a linha em curso fecha) em vez de esperar até maxPorVolta linhas."
  - "publishedVersion passou a ser exportada de automations.ts para a regra de regime repetir a de runScheduledAutomations sem cópia."

patterns-established:
  - "Regime e ator por Lista: decisão do domínio sobre o estado hidratado, nunca do SQL do catálogo nem do worker"

requirements-completed: [EST-01]

coverage:
  - id: D1
    description: "Lista fora de Contas a pagar/receber, só com Tarefa recorrente por calendário vencida e sem Automação, recebe a próxima ocorrência numa volta do agendador, direto, assinada por um Membro humano que a administra; a linha fecha concluido sem ENSAIO_PRIMEIRA_VOLTA"
    requirement: EST-01
    verification:
      - kind: integration
        ref: "apps/api/src/automacoes/scheduler-worker.test.ts#(t) Lista sem Automação, com Tarefa recorrente vencida"
        status: pass
    human_judgment: false
  - id: D2
    description: "Regime da primeira volta e ator do relógio como funções puras do domínio (ensaio x direto; preferido, Proprietário, Administrador, undefined)"
    requirement: EST-01
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/agenda-do-relogio.test.ts (14 casos)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Lista com Automação por vencimento mantém o ensaio (ENSAIO_PRIMEIRA_VOLTA, nada gravado)"
    verification:
      - kind: integration
        ref: "apps/api/src/automacoes/scheduler-worker.test.ts#(u)"
        status: pass
    human_judgment: false
  - id: D4
    description: "iniciar() drena a fila (três linhas numa volta; maxPorVolta limita; parar() não deixa linha em processando)"
    verification:
      - kind: integration
        ref: "apps/api/src/automacoes/scheduler-worker.test.ts#(v) (w) (x)"
        status: pass
    human_judgment: false
  - id: D5
    description: "SEM_ATOR fecha a linha falhou com motivo claro, sem gravar, e o dia seguinte não repete a linha"
    verification:
      - kind: integration
        ref: "apps/api/src/automacoes/scheduler-worker.test.ts#(y)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Autoria humana da Atividade 'Próxima ocorrência criada' é aceitável para o dono (Q1/A1)"
    verification: []
    human_judgment: true
    rationale: "Decisão de produto que o dono confirma no checkpoint D-04 do 10-16; nenhum teste a decide."

duration: 14min
completed: 2026-10-29
status: complete
---

# Phase 10 Plan 05: Relógio da recorrência por calendário Summary

**O agendador do servidor passa a gerar a próxima ocorrência das Listas só com Recorrência por calendário: catálogo ampliado por SQL candidato, ator e regime (direto x ensaio) escolhidos por Lista no domínio, código SEM_ATOR e volta que drena até 200 linhas.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-10-29T09:21:00Z
- **Completed:** 2026-10-29T09:35:00Z
- **Tasks:** 2 (a Task 1 em RED, GREEN do domínio e GREEN do worker)
- **Files modified:** 7

## Accomplishments

- `agenda-do-relogio.ts` no domínio: `listaTemAgendaPorVencimento`, `regimeDaPrimeiraVolta` e `atorDoRelogio`, puras, com 14 testes sobre `buildSeed()`.
- O catálogo do worker ganhou a segunda fonte candidata (`tasks` com `recurrence.triggerMode = porCalendario`, pela coluna gerada `list_id`); a decisão do que roda continua no domínio.
- A Lista só com recorrência por calendário nasce direto; a com Automação por vencimento (também a que tem as duas coisas) mantém o ensaio. Provado contra Postgres 16 local.
- O ator é escolhido dentro do `executar()`: preferido se administra; senão o Proprietário do Espaço; senão o primeiro Proprietário ou Administrador ativo que administra a Lista. Sem nenhum: `falhou` com `SEM_ATOR`. O Agente do pipeline não ganhou concessão (`grantGovernanceAccess` = 0 no worker).
- `iniciar()` drena: uma volta fecha as três linhas do teste; `maxPorVolta: 2` fecha duas e a terceira sai na volta seguinte.
- Documentação do operador: seção "Quais Listas o relógio visita (Fase 10)" no `CONTEXT.md` e comentários do `.env.example`.

## Task Commits

1. **Task 1: Traçador (RED)** - `00bf961` (test)
2. **Task 1: domínio (GREEN)** - `591dcee` (feat)
3. **Task 1: worker — catálogo, ator, regime, SEM_ATOR** - `7930396` (feat)
4. **Task 2: drenagem, SEM_ATOR provado, documentação** - `6d7dbf3` (feat)

**Plan metadata:** commit de docs que inclui este SUMMARY (a seguir).

## Files Created/Modified

- `packages/dominio/src/operations/agenda-do-relogio.ts` — regime e ator do relógio, puros.
- `packages/dominio/src/operations/agenda-do-relogio.test.ts` — 14 casos de domínio.
- `packages/dominio/src/operations/automations.ts` — `publishedVersion` exportada.
- `apps/api/src/automacoes/scheduler-worker.ts` — catálogo ampliado, `SEM_ATOR`, `maxPorVolta`, `drenar()`, ator/regime por Lista.
- `apps/api/src/automacoes/scheduler-worker.test.ts` — casos (t)-(y) de banco, invólucro para os casos antigos, migração no `beforeAll`.
- `apps/api/src/automacoes/CONTEXT.md`, `apps/api/.env.example` — documentação.

## Decisions Made

- Autoria humana da Atividade segue como assunção Q1/A1, a confirmar no checkpoint D-04 (10-16). Se o dono preferir "Sistema", a mudança é no domínio e mais invasiva.
- `parar()` interrompe a drenagem entre duas linhas (a linha em curso termina e fecha) em vez de esperar a drenagem inteira, para o desligamento não ficar refém de até 200 linhas. O plano dizia "agora a drenagem inteira"; ver Deviations.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Casos antigos do worker não sobrevivem às escolhas por Lista**
- **Found during:** Task 1 (worker)
- **Issue:** Os casos (a)-(s) rodam uma espiã de `rodarAgenda` sobre Espaço sem Membro algum, com `resolverAtor: "mem_teste"` e primeira volta sempre em ensaio. Com `atorDoRelogio`/`regimeDaPrimeiraVolta` de verdade, todos fechariam `SEM_ATOR` ou direto, contrariando "os blocos antigos não mudam".
- **Fix:** Pontos de extensão `escolherAtor` e `escolherRegime` em `OpcoesSchedulerWorker` (padrão: as funções do domínio) e um invólucro `criarSchedulerWorker` no teste que os fixa em "preferido" e "ensaio". Nenhuma chamada antiga foi editada; os casos da Fase 10 usam `criarSchedulerWorkerDaFase10`.
- **Files modified:** `apps/api/src/automacoes/scheduler-worker.ts`, `apps/api/src/automacoes/scheduler-worker.test.ts`
- **Verification:** os 23 casos anteriores continuam passando; os 6 novos passam.
- **Committed in:** `7930396`

**2. [Rule 3 - Blocking] Migrações no arquivo de teste**
- **Found during:** Task 1 (baseline)
- **Issue:** Num contêiner novo os blocos antigos falham (`plataforma.integration_outbox` não existe) porque só o bloco novo chamaria `prepararBancoCrm()`.
- **Fix:** `beforeAll` de arquivo com `if (temBancoCrm) await prepararBancoCrm()`; contra banco remoto não migra nada (T-07-08).
- **Committed in:** `7930396`

**3. [Rule 2 - Missing critical] `publishedVersion` exportada**
- **Found during:** Task 1 (domínio)
- **Issue:** a regra de regime precisa repetir `publishedVersion` de `automations.ts`; copiá-la criaria duas fontes de verdade (arquivo fora de `files_modified`).
- **Fix:** `export` na função, com comentário.
- **Committed in:** `591dcee`

**4. [Rule 1 - Judgment] `parar()` interrompe a drenagem entre linhas**
- **Found during:** Task 2
- **Issue:** esperar a drenagem inteira (até `maxPorVolta` = 200 linhas) seguraria o desligamento e a recarga do `vite-node --watch` (T-10-16).
- **Fix:** `drenar()` sai quando `temporizador` foi limpo; a linha em curso fecha, nenhuma fica em `processando` (teste (x)).
- **Committed in:** `6d7dbf3`

---

**Total deviations:** 4 (2 blocking, 1 missing-critical, 1 judgment)
**Impact on plan:** todas necessárias para manter os casos antigos verdes e o desligamento limitado; sem mudança de escopo.

## Issues Encountered

- O seed (`buildSeed()`) traz também as Listas de Contas a pagar e a receber no catálogo; os testes contam `semear()` relativo ao catálogo e restringem `listId` do worker.
- A suíte inteira (`npm test`) não foi rodada, conforme orientação (13-17 min); rodados: domínio inteiro (108 arquivos, 2116 testes) e `apps/api/src/automacoes` (21 arquivos, 377 passados, 1 skip preexistente do contrato `financeiro-tria`), mais `tsc --noEmit` nos dois pacotes. Banco: contêiner `crm-n1-pg-1005` (porta 55705), removido ao fim.
- Lacunas aceitas, registradas no plano: Lista que ganha Automação por vencimento depois de já ter voltas reais não volta ao ensaio; cada linha hidrata o Espaço inteiro (conta para a Fase 12).

## TDD Gate Compliance

RED `00bf961` (14 casos, 10 falhando por asserção sobre o esqueleto; as 4 passagens são o default do esqueleto) e GREEN `591dcee`. `tdd_mode` está desligado e o gate formal `check tdd-red-evidence` não foi acionado.

## User Setup Required

None. Para ligar em produção (decisão do 10-16/D-04): `AUTOMACOES_WORKER_ATIVO=true`, `AUTOMACOES_ATOR_MEMBER_ID` vazio e `AUTOMACOES_LISTA_ID` vazio (preenchido, o relógio só visita aquela Lista).

## Next Phase Readiness

- Pronto para 10-15 (lixeira vencida como terceira fonte do catálogo; ponte do Agente de lançamento) e 10-16 (retirar o botão após publicar e ligar isto em produção; confirmar Q1/A1 com o dono).
- Nada gravado em banco de produção por este plano.

## Self-Check: PASSED

---
*Phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista*
*Completed: 2026-10-29*
