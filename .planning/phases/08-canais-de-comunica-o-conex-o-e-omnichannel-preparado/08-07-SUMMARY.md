---
phase: 08-canais-de-comunica-o-conex-o-e-omnichannel-preparado
plan: 07
subsystem: persistencia
tags: [postgres, unidade-de-trabalho, ponte, canais, vitest, omnichannel]

requires:
  - phase: 08-canais-de-comunica-o-conex-o-e-omnichannel-preparado
    provides: "canais-projetados.ts (carregarCanaisProjetados com guarda to_regclass, acrescentarCanaisProjetados, FotografiaDosProjetados) e a 008 (08-01); capacidadesDoCanal e configurarCanal recusando Canal relacional (08-02)"
provides:
  - "semCanaisProjetados(state, fotografia): estado sem os Canais projetados para gravar(); lanca se uma operacao mudou um deles"
  - "executar() projeta os Canais de plataforma.canais em state.channels logo depois de hidratar, por tentativa, e grava sem eles"
  - "persistencia/CONTEXT.md com a secao 'A ponte dos Canais (Fase 8)'"
affects: [08-09, 08-10, 08-13, 08-14]

actuals:
  tokens: 4400
  tasks: 2
  commits: 3
plan_head_before: 8555a338caaf4ec8e0da8efacba13b66502c6d67
plan_head_after: a785815ff69edaa1e392c8dceff62b82ef0ac51c

tech-stack:
  added: []
  patterns:
    - "Projecao por tentativa dentro da Unidade de Trabalho: entra no fim de state.channels e sai antes de gravar(), com fotografia canonica para detectar mudanca"
    - "Mudanca de entidade projetada por operacao antiga lanca (rollback) em vez de ser descartada"

key-files:
  created: []
  modified:
    - apps/api/src/persistencia/canais-projetados.ts
    - apps/api/src/persistencia/unidade-de-trabalho.ts
    - apps/api/src/persistencia/canais-projetados.test.ts
    - apps/api/src/persistencia/CONTEXT.md

key-decisions:
  - "Um Canal projetado removido do estado por uma operacao tambem lanca (a fotografia nao o encontra), nao so um alterado."
  - "opcoes.eventos, eventosDeNotificacaoPorCanal e aoConfirmar seguem recebendo antes.state com os projetados; o payload de automacao.notificar-canal.v1 leva o tipo, nao o id."
  - "hidratar() continua sem a projecao: so GET /estado e executar() a usam."

patterns-established:
  - "Ponte de leitura que nunca vira escrita: o que entra em memoria para a operacao enxergar sai antes do diff ir ao banco"

requirements-completed: [CXE-A4]

coverage:
  - id: D1
    description: "executar() roda startConversation e sendMessage sobre um Canal relacional: a Conversa vai para plataforma.registros com channelId = UUID da tabela e o Canal nao e copiado (count de colecao 'channels' inalterado)"
    requirement: CXE-A4
    verification:
      - kind: integration
        ref: "apps/api/src/persistencia/canais-projetados.test.ts#startConversation e sendMessage sobre o Canal relacional gravam a Conversa em registros sem copiar o Canal"
        status: pass
    human_judgment: false
  - id: D2
    description: "Uma operacao que altera o Canal projetado lanca a frase da ponte, a transacao e desfeita e a revisao do Espaco nao muda"
    requirement: CXE-A4
    verification:
      - kind: integration
        ref: "apps/api/src/persistencia/canais-projetados.test.ts#uma operacao que altera o Canal projetado lanca e a revisao do Espaco nao muda"
        status: pass
    human_judgment: false
  - id: D3
    description: "semCanaisProjetados: fotografia vazia devolve o proprio estado; projetado intacto sai numa copia rasa sem mutar o original; alterado ou removido lanca"
    requirement: CXE-A4
    verification:
      - kind: unit
        ref: "apps/api/src/persistencia/canais-projetados.test.ts#semCanaisProjetados — sem banco (08-07)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Banco so com 001..007: carregarCanaisProjetados devolve [] sem lancar; testes existentes da Unidade de Trabalho e o contrato automacao.notificar-canal.v1 seguem verdes sem edicao"
    requirement: CXE-A4
    verification:
      - kind: integration
        ref: "apps/api/src/persistencia/canais-projetados.test.ts#banco so com 001..007: carregarCanaisProjetados devolve [] sem lancar"
        status: pass
      - kind: unit
        ref: "apps/api/src/persistencia/unidade-de-trabalho.test.ts, unidade-de-trabalho-trava.test.ts, src/contratos/notificar-canal.contrato.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "CONTEXT.md de persistencia documenta onde a ponte entra, onde nunca entra e quando some"
    verification: []
    human_judgment: true
    rationale: "Documentacao viva em prosa: so um leitor julga se esta no tom e na estrutura do arquivo."

duration: 12min
completed: 2026-10-12
status: complete
---

# Phase 8 Plan 07: A ponte no executar() Summary

**`executar()` passa a projetar os Canais relacionais de `plataforma.canais` em `state.channels` por tentativa e a gravar o estado sem eles (`semCanaisProjetados`), de modo que `startConversation`/`sendMessage` do modelo antigo funcionam sobre um Canal da tabela nova sem copiá-lo para `plataforma.registros`.**

## Performance

- **Duration:** 12 min
- **Completed:** 2026-10-12T17:36:00Z
- **Tasks:** 2 (1 TDD, 3 commits no total)
- **Files modified:** 4

## Accomplishments

- `semCanaisProjetados(state, fotografia)` em `canais-projetados.ts`: copia rasa sem os ids projetados, sem mutar o estado; lança "Uma operação alterou o Canal <id> da tabela própria; ele só muda pela api de Canais." se o `canonico()` de algum projetado mudou ou se ele sumiu; fotografia vazia devolve o próprio `state`.
- Ganchos em `executar()`: `acrescentarCanaisProjetados` logo depois de `hidratar` (antes de `syncIdSequence`) e `gravar` recebendo `semCanaisProjetados(antes.state, fotografia)`. Nada mais na Unidade de Trabalho mudou; `hidratar()` segue sem a projeção.
- Provado contra Postgres 16 local: a Conversa aberta sobre o Canal relacional entra em `registros` com `channelId` = UUID da tabela, `sendMessage` seguinte funciona, a contagem de `colecao = 'channels'` não muda; uma operação que renomeia o projetado é recusada e a revisão do Espaço e o nome na tabela ficam iguais.
- `CONTEXT.md` de `persistencia/` ganhou a linha de `canais-projetados.ts` e a seção "A ponte dos Canais (Fase 8)".

## Task Commits

1. **Task 1 (RED): testes da ponte** - `c22866c` (test)
2. **Task 1 (GREEN): semCanaisProjetados e ganchos em executar()** - `0bbd2f9` (feat)
3. **Task 2: regra da ponte no CONTEXT.md** - `a785815` (docs)

Sem REFACTOR (nada a limpar).

## Files Created/Modified

- `apps/api/src/persistencia/canais-projetados.ts` - `semCanaisProjetados`
- `apps/api/src/persistencia/unidade-de-trabalho.ts` - projeção por tentativa e gravação sem os projetados
- `apps/api/src/persistencia/canais-projetados.test.ts` - 4 testes sem banco e 3 com banco (executar, rollback, banco 001..007)
- `apps/api/src/persistencia/CONTEXT.md` - linha na tabela de arquivos e seção da ponte

## TDD Gate Compliance

- **RED** (`c22866c`): 6 testes falharam. O alvo, `startConversation e sendMessage sobre o Canal relacional gravam a Conversa em registros sem copiar o Canal`, falhou em `expect(aberta.ok).toBe(true)` (recebeu `false`) porque `executar()` ainda não via o Canal ("Canal não encontrado"). Evidência capturada com `vitest --reporter=tap-flat` e `gsd_run check tdd-red-evidence` devolveu `RED_EVIDENCE_OK` (`target_test_failed`). Uma primeira tentativa foi `INVALID_RED` (`invalid_record`) porque o `toMatchObject` produzia um diff multilinha que o adaptador TAP não parseia; troquei por `expect(x.ok).toBe(true)` e reexecutei antes de implementar. `semanticAssessment`: o alvo executou e falhou na asserção planejada, pelo motivo certo.
- **Teste que já passava no RED:** `banco so com 001..007: carregarCanaisProjetados devolve [] sem lancar` passou no RED porque a guarda `to_regclass` já existe desde 08-01. Não é um RED fabricado: ele protege a regressão (Pitfall 1) ao ligar a consulta dentro da transação, e a asserção `to_regclass('plataforma.canais') is null` no banco à parte prova que o cenário é de fato o sem-008 (não vacuoso).
- **GREEN** (`0bbd2f9`): os 4 arquivos do verify passam (33 testes). **REFACTOR:** não houve.

## Decisions Made

- Um projetado removido do estado por uma operação também lança, não só um alterado: a fotografia não o encontra e a mudança não pode sumir em silêncio.
- `opcoes.eventos`, `eventosDeNotificacaoPorCanal` e `aoConfirmar` seguem com `antes.state` (com os projetados), como o plano previu.

## Deviations from Plan

None - plan executed exactly as written. (A troca do `toMatchObject` pelo `.ok` no teste foi ajuste de formato de evidência dentro do RED, antes do commit.)

## Issues Encountered

- Ao rodar `src/persistencia` inteiro em paralelo no mesmo banco, `outbox-worker.test.ts > (h) 503 volta para 'pending'` falhou uma vez (`attempts` 0 em vez de 1). Isolado, o arquivo passa (15/15). É interferência entre arquivos de teste que compartilham a mesma `integration_outbox`, não relacionada às mudanças deste plano (nenhuma toca o worker). Fora do escopo; sem item adiado.
- A suíte completa de `apps/api` não foi rodada (40-50 min, conforme orientação); verificação: `tsc --noEmit` limpo, `src/persistencia` (146 testes, 145 verdes + o flake acima, verde isolado), `rotas/estado`, `rotas/operacoes*` e o contrato `notificar-canal`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 08-09 ("Simular conexão") e 08-10 ("Responder por") podem usar um Canal da tabela nova pelo modelo antigo no servidor. 08-14 precisa aplicar a 008 no banco da plataforma antes do portão; até lá a guarda `to_regclass` mantém `executar()` como hoje.

## Self-Check: PASSED

- Arquivos modificados existem; commits `c22866c`, `0bbd2f9`, `a785815` são ancestrais de HEAD; `git log` dos três arquivos de teste existentes (`unidade-de-trabalho.test.ts`, `unidade-de-trabalho-trava.test.ts`, `notificar-canal.contrato.test.ts`) desde o início do plano não imprime nada.

---
*Phase: 08-canais-de-comunica-o-conex-o-e-omnichannel-preparado*
*Completed: 2026-10-12*
