---
phase: 14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa
plan: 02
subsystem: dominio
tags: [dominio, tarefa-conversacional, vinculos, canais, vitest, tdd]

requires:
  - phase: 14-01
    provides: guardas de D-06 (`sem-listas-espelho`) e o Contato `mesclado` no domínio
provides:
  - `vinculosDoCrmDaTarefa` e os Canais da Lista sobre `Canal[]` (`canaisDaListaNasTabelas`, `canaisDaListaQueAlcancamNasTabelas`, `listaSemCanaisNasTabelas`)
  - `VinculoDeNascimento.alvoConferido` e `canalForaDaListaNasTabelas`
  - as quatro operações `…NasTabelas` da Tarefa conversacional, fora de `OPERACOES`
affects: [14-03, 14-13, 14-14, 14-16, 14-17]

actuals:
  tokens: 10600
  tasks: 2
  commits: 4
plan_head_before: 40e0aa68aa009f83b2fcbaba7687bcb62e7a6c11
plan_head_after: 756ed3caa8511093593c2a957e4f64f43c13a00a
commits: 4

tech-stack:
  added: []
  patterns:
    - "função nova ao lado da antiga com sufixo `NasTabelas`, sem mudar a assinatura da antiga (D-01)"
    - "operação que recebe `referencias` já conferidas pelo servidor e fica fora de `OPERACOES` (precedente `…SemConferencia`)"
    - "esqueleto que lança `não implementado` como RED de uma operação nova"

key-files:
  created:
    - packages/dominio/src/operations/tarefa-conversacional-nas-tabelas.ts
    - packages/dominio/src/operations/tarefa-conversacional-nas-tabelas.test.ts
  modified:
    - packages/dominio/src/derive-conversacional.ts
    - packages/dominio/src/derive-conversacional.test.ts
    - packages/dominio/src/operations/tasks.ts
    - packages/dominio/src/operations/canais.ts
    - packages/dominio/src/operations/index.ts
    - packages/dominio/CONTEXT.md

key-decisions:
  - "`vinculosDoCrmDaTarefa` devolve o PRIMEIRO Vínculo de cada tipo (papel \"… da Tarefa\" na frente, raiz depois) sem conferir o alvo; lixeira e `mesclado` são da api (3.3.2). Por isso Negócio na lixeira não é suspenso aqui, ao contrário de `negocioDaTarefa`."
  - "`ligarNegocioNovoATarefaNasTabelas` recusa com qualquer Vínculo task→deal (leitura por id), não só o de papel Negócio: é o mesmo critério de `negocioDaTarefa`, que também conta o espelho de \"Meus negócios\"."
  - "`trocarCanalDaTarefaNasTabelas` compara a Conversa nova com a atual por `conversaId` (não por Canal); a api é quem decide qual Conversa abrir."
  - "`moveTask` aceita o Contato achado por id OU pela leitura antiga; o segundo ramo sai no plano 14-17."

patterns-established:
  - "Teste de domínio sobre `buildSeed()` com `contacts`, `conversations`, `channels` e `deals` esvaziados prova que a leitura/operação não depende do CRM antigo."
  - "Nos testes de `…NasTabelas`, a Lista conversacional recebe `canaisDeAtendimento` com UUIDs inventados; `referencias` usa os mesmos."

requirements-completed: [UNI-12, UNI-13, UNI-15, UNI-16, UNI-01]

coverage:
  - id: D1
    description: "A Tarefa conversacional se lê por ids (Contato, Conversa, Negócio) só de `state.links`, num estado sem CRM antigo; a Subtarefa lê a raiz e o papel certo vence"
    requirement: UNI-13
    verification:
      - kind: unit
        ref: "packages/dominio/src/derive-conversacional.test.ts#leituras por id (3.3.2)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Os Canais da Lista sobre `Canal[]`: só ativos, na ordem marcada, filtrados pelo tipo de Identificador; Lista operacional vazia"
    requirement: UNI-12
    verification:
      - kind: unit
        ref: "packages/dominio/src/derive-conversacional.test.ts#leituras por id (3.3.2)"
        status: pass
    human_judgment: false
  - id: D3
    description: "`createTask` com `alvoConferido` nasce sem o Contato/Conversa/Negócio no estado, sem ele recusa como hoje; `moveTask` aceita o Contato achado só por Vínculo"
    requirement: UNI-13
    verification:
      - kind: unit
        ref: "packages/dominio/src/derive-conversacional.test.ts#createTask com alvoConferido; #moveTask aceita entrar"
        status: pass
    human_judgment: false
  - id: D4
    description: "As quatro operações criam e alteram a Tarefa conversacional com ids das tabelas novas, com as mesmas recusas e frases das antigas, e desfazem tudo quando `createTask` recusa"
    requirement: UNI-15
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/tarefa-conversacional-nas-tabelas.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "Nenhuma das quatro está em `OPERACOES`, e as guardas de D-06 e `quem-pode` seguem verdes"
    requirement: UNI-16
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/tarefa-conversacional-nas-tabelas.test.ts#fora do registro; src/quem-pode.test.ts; src/sem-listas-espelho.test.ts"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-11-04
status: complete
---

# Phase 14 Plan 02: A Tarefa conversacional sobre ids das tabelas novas Summary

**`vinculosDoCrmDaTarefa`, os Canais da Lista sobre `Canal[]`, `alvoConferido` no nascimento da Tarefa e quatro operações `…NasTabelas` (criar, trocar Canal, ligar/desligar Negócio, ligar Negócio novo) que rodam sem o CRM antigo no estado e ficam fora de `OPERACOES`.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-11-04T17:33:30Z
- **Completed:** 2026-11-04T17:39:00Z
- **Tasks:** 2
- **Files modified:** 8 (2 criados, 6 alterados)

## Accomplishments

- A leitura por id (`vinculosDoCrmDaTarefa`) e as três leituras de Canal da Lista sobre `Canal[]` existem ao lado das antigas, que não mudaram.
- `createTask` aceita Vínculos de nascimento com `alvoConferido: true` sem procurar o alvo em `state.contacts`, `state.conversations` ou `state.deals`; `moveTask` aceita entrar numa Lista conversacional pela leitura por id.
- As quatro operações novas cobrem o gesto inteiro do domínio (3.3.4 a 3.3.6) sobre `referencias` conferidas pelo servidor, sem abrir Conversa no estado (D-07).
- Teste confirma que nenhuma delas entra em `OPERACOES`; `CONTEXT.md` do domínio as nomeia ao lado das variantes `…SemConferencia`.

## Task Commits

1. **Task 1: leituras por id e `alvoConferido`**
   - `baae099` (test) RED: o `describe` "leituras por id (3.3.2)" falha (`is not a function` nas leituras novas; "Contato não encontrado." no `createTask` e no `moveTask`)
   - `c610934` (feat) GREEN: leituras, `alvoConferido`, `moveTask`, `canalForaDaListaNasTabelas`
2. **Task 2: as quatro operações**
   - `24f1295` (test) RED: esqueleto que lança `não implementado` e 27 testes (26 falham)
   - `756ed3c` (feat) GREEN: as quatro operações, export no `index.ts`, `CONTEXT.md`

**Plan metadata:** commit de docs que fecha o plano (SUMMARY, STATE, ROADMAP, REQUIREMENTS).

## TDD Gate Compliance

- **RED Task 1** (`baae099`): 10 testes do `describe` novo falharam, os que chamam função inexistente com `TypeError: ... is not a function` e os de `createTask`/`moveTask` com `Contato não encontrado.`. Avaliação semântica: a falha é a ausência planejada do comportamento, o alvo executou; os 23 testes antigos do arquivo seguiram passando. `check tdd-red-evidence` não foi rodado (relatório do vitest não persistido no formato do classificador); a evidência é a saída do vitest.
- **RED Task 2** (`24f1295`): como o módulo não existia, o RED usou um esqueleto com as assinaturas finais que lança `não implementado`, para os testes executarem e falharem na asserção/chamada, e não por erro de carga. 26 de 27 falharam; o que passou é a guarda "fora do registro", que vale antes e depois.
- **GREEN** (`c610934`, `756ed3c`): todos passam; domínio inteiro 2237/2237.
- Nenhum commit `refactor`.

## Files Created/Modified

- `packages/dominio/src/derive-conversacional.ts` - `VinculosDoCrmDaTarefa`, `vinculosDoCrmDaTarefa`, `canaisDaListaNasTabelas`, `canaisDaListaQueAlcancamNasTabelas`, `listaSemCanaisNasTabelas`.
- `packages/dominio/src/operations/tasks.ts` - `VinculoDeNascimento.alvoConferido`; `vinculoRefusal` o respeita; `moveTask` lê por id ou pela leitura antiga.
- `packages/dominio/src/operations/canais.ts` - `canalForaDaListaNasTabelas`.
- `packages/dominio/src/operations/tarefa-conversacional-nas-tabelas.ts` - as quatro operações e as interfaces `ReferenciasDaTarefaConversacional` e `CriarTarefaConversacionalNasTabelasInput`.
- `packages/dominio/src/operations/index.ts` - reexporta o arquivo novo; `registro.ts` intocado.
- `packages/dominio/CONTEXT.md` - a frase das variantes fora do registro nomeia as quatro.
- Testes: `derive-conversacional.test.ts` (describe novo) e `tarefa-conversacional-nas-tabelas.test.ts` (novo).

## Decisions Made

- Ver `key-decisions`. O que os planos 14-13 e 14-14 precisam saber: `ligarNegocioNovoATarefaNasTabelas` devolve `ok(task, negocio.id)`; `trocarCanalDaTarefaNasTabelas` devolve `{ task, mudou }` e sem `id` quando `mudou` é falso; `criarTarefaConversacionalNasTabelas` devolve só `{ task }` (a Conversa é da api).

## Deviations from Plan

None - plan executed exactly as written.

Notas sem desvio: o plano previa o caso de `createTask`/`moveTask` com `alvoConferido` em `derive-conversacional.test.ts` ou no teste da Task 2; ficou no primeiro. `sem-listas-espelho.test.ts` já existia (14-01) e foi rodado junto, como a verificação pede. `operations.test.ts` não foi editado.

## Issues Encountered

- Nos testes, `moveTask` entre Listas com Status diferentes exige mapeamento; o teste cria a Tarefa numa Lista operacional, liga o Contato por Vínculo e mapeia o Status para o primeiro da Lista do Suporte.

## Verification

- `cd packages/dominio && npx tsc --noEmit` ok; `npx vitest run`: 2237 testes passando (inclui `quem-pode` e `sem-listas-espelho`).
- `apps/api`: `tsc --noEmit` ok e `src/sem-listas-espelho.test.ts` 2/2. `apps/web`: `tsc --noEmit` ok. As suítes inteiras de api e web não foram rodadas (o plano é só de domínio).
- Critérios de aceite das duas tasks conferidos por `grep` (4 funções exportadas, `NasTabelas` ausente de `registro.ts`, `startConversation` ausente, `NasTabelas` presente no `CONTEXT.md`, nenhuma das duas palavras proibidas por D-06 nos arquivos novos).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Pronto para 14-13 e 14-14: as rotas `/tarefas-conversacionais` chamam as quatro funções dentro do gesto misto, depois de conferir Contato (resolvendo `mesclado`), Canal, Conversa e Negócio nas tabelas e de abrir a Conversa em `plataforma.conversas`.
- A apagar no corte (14-17): `contatoAlcancado`, as leituras e operações antigas sem chamador e o segundo ramo de `moveTask`.

## Self-Check: PASSED

- Arquivos criados existem (`tarefa-conversacional-nas-tabelas.ts` e `.test.ts`).
- Commits `baae099`, `c610934`, `24f1295` e `756ed3c` presentes na branch.
- `git rev-list --count 40e0aa6..HEAD` = 4 antes deste commit de docs.

---
*Phase: 14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa*
*Completed: 2026-11-04*
