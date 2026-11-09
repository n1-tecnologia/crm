---
phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia
plan: 04
subsystem: api
tags: [mensageria, outbox, fila-de-saida, postgres, vitest, tdd]

requires:
  - phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia
    provides: "indice unico `integration_outbox_mensagem_enviar_uniq` na 013 (16-03)"
  - phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia
    provides: "`receberMensagem` e a base do dominio de Mensagem (16-01)"
provides:
  - "`statusInicialDeEnvio` sempre `pendente` (so o provedor diz que saiu)"
  - "evento `mensagem.enviar.v1` (`{ mensagemId, conversaId, canalId }`, `.strict()`) em `EVENTOS` e `EVENTOS_DA_MENSAGERIA`"
  - "`enfileirarEnvio(cliente, workspaceId, mensagem, canal)` em `mensageria/fila-de-saida.ts`"
  - "os tres pontos que gravam Mensagem `enviada` enfileirando na mesma transacao"
  - "`OpcoesOutboxWorker.tiposDeEvento` e o filtro padrao `not like 'mensagem.%'` no worker do `automation/`"
affects: [16-05, 16-06, 16-07]

actuals:
  tokens: 11000
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "evento de outbox gravado pelo `gravarEventos` no `PoolClient` da transacao de negocio, so com ids"
    - "worker do outbox com filtro de tipo: padrao exclui `mensagem.%`, `tiposDeEvento` e inclusivo"

key-files:
  created:
    - apps/api/src/mensageria/fila-de-saida.ts
    - .planning/phases/16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia/deferred-items.md
  modified:
    - packages/dominio/src/crm/mensagens.ts
    - packages/dominio/src/crm/mensagens.test.ts
    - apps/api/src/persistencia/outbox.ts
    - apps/api/src/persistencia/outbox-worker.ts
    - apps/api/src/persistencia/outbox-worker.test.ts
    - apps/api/src/servicos/crm/mensagens.ts
    - apps/api/src/servicos/crm/mensagens.test.ts
    - apps/api/src/servicos/crm/conversas.ts
    - apps/api/src/servicos/crm/conversas.test.ts
    - apps/api/src/servicos/crm/tarefas-conversacionais.test.ts
    - apps/api/src/rotas/crm/mensagens.test.ts
    - apps/api/src/e2e/canais-fluxo.test.ts

key-decisions:
  - "`aggregate_type = \"mensagem\"` e `aggregate_id = mensagemId`, casando com o indice unico da 013."
  - "O worker antigo exclui `mensagem.%` por padrao (em vez de listar os quatro eventos de hoje): um evento novo do `automation/` continua saindo sem editar o filtro."
  - "`CAMINHO_POR_EVENTO` e `Record<Exclude<NomeDeEvento, \"mensagem.enviar.v1\">, string>`: o evento da mensageria nao tem caminho HTTP no `automation/`."
  - "`statusInicialDeEnvio` mantem o parametro `conexao` (agora `_conexao`) na assinatura para nao mexer nos chamadores."
  - "Os testes limpam `integration_outbox` por conta propria no `afterAll` (a tabela nao tem FK para o Espaco, e `limparEspaco` nao a conhece); `banco-crm.ts` nao esta no escopo do plano."

patterns-established:
  - "Quem grava Mensagem `enviada` chama `enfileirarEnvio` com o cliente da transacao; Canal fora de `conectada` guarda sem linha (B69)."

requirements-completed: [MSG-02]

coverage:
  - id: D1
    description: "A Mensagem `enviada` nasce `pendente` e, num Canal conectado, entra no outbox como `mensagem.enviar.v1` (so ids) no mesmo commit; o rollback do evento leva a Mensagem junto"
    requirement: MSG-02
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/mensagens.test.ts#fila de saida (16-04, 3.7.1)"
        status: pass
      - kind: unit
        ref: "packages/dominio/src/crm/mensagens.test.ts#statusInicialDeEnvio (B69)"
        status: pass
    human_judgment: false
  - id: D2
    description: "`POST /conversas` e a Tarefa conversacional (criar e trocar Canal) enfileiram a primeira Mensagem pelo mesmo `enfileirarEnvio`; Canal desconectado guarda sem linha (B69)"
    requirement: MSG-02
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/conversas.test.ts#a mesma Ana abre Conversa nos dois WhatsApps"
        status: pass
      - kind: integration
        ref: "apps/api/src/servicos/crm/tarefas-conversacionais.test.ts (criar e trocarCanal)"
        status: pass
      - kind: e2e
        ref: "apps/api/src/e2e/canais-fluxo.test.ts#(f), (g) e (h)"
        status: pass
    human_judgment: false
  - id: D3
    description: "O worker do `automation/` nunca reivindica `mensagem.%`; com `tiposDeEvento` reivindica so o tipo pedido"
    requirement: MSG-02
    verification:
      - kind: integration
        ref: "apps/api/src/persistencia/outbox-worker.test.ts#convivencia com a fila da mensageria (16-04, Pitfall 1)"
        status: pass
    human_judgment: false

plan_head_before: 4d52f6280735d72033c7d589238f4349aa44c7f8
plan_head_after: 7ac813d0340fd7cbcbcc1f6d3d8f5260cbee912e

duration: 9min
completed: 2026-11-09
status: complete
---

# Phase 16 Plan 04: Fila de saida na mesma transacao da Mensagem Summary

**Mensagem `enviada` nasce sempre `pendente` e, num Canal conectado, grava `mensagem.enviar.v1` (so ids) no outbox pelo mesmo `PoolClient`, nos tres pontos de gravacao via `enfileirarEnvio`; o worker do `automation/` passa a ignorar `mensagem.%`.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-11-09T17:35:00Z
- **Completed:** 2026-11-09T17:45:00Z
- **Tasks:** 3
- **Files modified:** 13 (1 criado em `apps/api/src`, 1 de planejamento, 11 alterados)

## Accomplishments

- `statusInicialDeEnvio` devolve `pendente` para qualquer conexao (3.7.1, MSG-02): o atendente so vera "enviada" quando o provedor confirmar (o 16-05 faz essa passagem).
- `EVENTOS["mensagem.enviar.v1"]` com tres ids e `.strict()`, `EVENTOS_DA_MENSAGERIA`, e `enfileirarEnvio` (`mensageria/fila-de-saida.ts`): grava pelo `gravarEventos` no cliente da transacao so quando o Canal esta `conectada`; devolve se enfileirou. Sem texto, sem telefone.
- Os tres pontos que gravam Mensagem `enviada` (`ServicoDeMensagens.enviar`, `abrirConversaNoCliente` de `POST /conversas` e a Tarefa conversacional, que herda) enfileiram pela mesma funcao; `criarServicoDeMensagens` ganha `deps.enfileirar?` so para o teste de rollback.
- Worker antigo: `tiposDeEvento?` inclusivo e, sem ele, `event_type not like 'mensagem.%'`; uma linha `mensagem.enviar.v1` segue `pending`, `attempts = 0`, depois de dois `processarUm()`.

## Task Commits

1. **Task 1 (tracador), RED** - `743110f` (test): dominio e servico esperam `pendente`, uma linha de outbox e rollback; 1 falha no dominio e 5 no servico, todas por asserção.
2. **Task 1, GREEN** - `66ab2db` (feat): regra do dominio, evento, `enfileirarEnvio`, `enviar` enfileira, tipo de `CAMINHO_POR_EVENTO`.
3. **Task 2, RED** - `40db358` (test): `POST /conversas`, Tarefa conversacional (criar e trocar Canal) e e2e esperam `pendente` e a linha na fila; 7 falhas.
4. **Task 2, GREEN** - `1e2be3b` (feat): `abrirConversaNoCliente` chama `enfileirarEnvio`.
5. **Task 3, RED** - `fb24895` (test): dois casos do worker (2 falhas por asserção).
6. **Task 3, GREEN** - `7ac813d` (feat): `tiposDeEvento` e o filtro padrao.

**Plan metadata:** commit `docs(16-04)` seguinte (SUMMARY, deferred-items, STATE, ROADMAP, REQUIREMENTS).

## Files Created/Modified

- `apps/api/src/mensageria/fila-de-saida.ts` - `enfileirarEnvio`
- `apps/api/src/persistencia/outbox.ts` - evento `mensagem.enviar.v1` e `EVENTOS_DA_MENSAGERIA`
- `apps/api/src/persistencia/outbox-worker.ts` - `tiposDeEvento`, filtro de tipo e o tipo de `CAMINHO_POR_EVENTO`
- `apps/api/src/servicos/crm/mensagens.ts` e `conversas.ts` - enfileiram a Mensagem `enviada`; comentarios de topo atualizados
- `packages/dominio/src/crm/mensagens.ts` - `statusInicialDeEnvio` sempre `pendente`
- testes: `mensagens.test.ts` (dominio e servico), `conversas.test.ts`, `tarefas-conversacionais.test.ts`, `rotas/crm/mensagens.test.ts`, `e2e/canais-fluxo.test.ts`, `outbox-worker.test.ts`

## Decisions Made

Ver `key-decisions`. O mais relevante para os proximos planos: o worker antigo nao pega `mensagem.%` por padrao, entao o entregador do 16-05 DEVE criar o seu worker com `tiposDeEvento: ["mensagem.enviar.v1"]` (ou uma reivindicacao propria) e nao pode contar com o padrao.

## Deviations from Plan

None - plan executed exactly as written.

(Dois ajustes pequenos dentro do escopo: o `afterAll` dos quatro arquivos de teste que gravam Mensagem num Canal conectado apaga as linhas de `integration_outbox` do Espaco, porque a tabela nao tem FK e `testes/banco-crm.ts` nao esta nos `files_modified`; e `statusInicialDeEnvio` ficou com o parametro `_conexao`.)

## TDD Gate Compliance

O plano e `type: execute` e `workflow.tdd_mode` nao se aplica; usei o ciclo RED/GREEN manual por tarefa, com avaliacao semantica manual (o alvo executou e falhou na asserção planejada, nunca por erro de import/sintaxe):

- **Task 1:** RED `743110f` (dominio: `expected 'enviada' to be 'pendente'`; servico: 5 falhas por asserção, entre elas "promise resolved instead of rejecting" no rollback). GREEN `66ab2db` (19 e 19 passando).
- **Task 2:** RED `40db358` (7 falhas: `expected [] to deeply equal [...]` nas linhas de fila; (g) a (i) do e2e falham em cascata porque (f) interrompe antes de guardar `conversaSuporteId`). O caso de `rotas/crm/mensagens.test.ts` ja passava no RED porque o servico da Task 1 ja devolvia `pendente`. GREEN `1e2be3b` (5 arquivos, 178 testes passando).
- **Task 3:** RED `fb24895` (2 falhas por asserção: `true` onde esperava `false` e `attempts 0` onde esperava 1). GREEN `7ac813d`.
- **REFACTOR:** nao houve.

## Issues Encountered

- `outbox-worker.test.ts` casos (h) a (k) falharam quando rodei o arquivo junto de `outbox.test.ts` no mesmo `vitest run` (baseline conhecido: dois arquivos mexem na mesma tabela); isolado, os 17 passam, e `outbox.test.ts` isolado passa os 7.
- `servicos/cofre.test.ts` ("nenhum arquivo de rotas/ importa servicos/cofre") falha na rodada ampla: vem de `rotas/webhooks-de-mensageria.ts` (16-03), fora do escopo; registrado em `deferred-items.md`.

## Verification Run

- Postgres 16 em Docker (`crm-n1-pg-1604`, porta 55719), `npm run --silent migrar` num banco novo (lista `aplicada  013-mensageria.sql`), container removido no fim; nenhum teste pulado nos arquivos do plano:
  - Dominio `src/crm/mensagens.test.ts`: 19 passando; `npx tsc --noEmit`: ok.
  - `servicos/crm/mensagens.test.ts`: 19; `conversas.test.ts`, `tarefas-conversacionais.test.ts`, `rotas/crm/mensagens.test.ts`, `e2e/canais-fluxo.test.ts`, `migracao-crm/mapeador.test.ts`: 5 arquivos, 178 testes passando.
  - `persistencia/outbox-worker.test.ts` isolado: 17 passando; `outbox.test.ts` isolado: 7 passando.
  - Rodada ampla `src/servicos src/rotas src/e2e src/mensageria src/repositorios` + `outbox.test.ts` + `migracao-013.test.ts`: 97 arquivos passando, 1 falha (o do cofre, anterior ao plano), 1288 testes passando.
  - `npx tsc --noEmit` em `apps/api`: ok.
- Criterios de aceite: `"mensagem.enviar.v1"` em `outbox.ts` 2; `enfileirarEnvio|enfileirar(` em `servicos/crm/mensagens.ts` 6; `conteudo|telefone|valor:` fora de comentario em `fila-de-saida.ts` 0; `enfileirarEnvio` em `conversas.ts` 3; `statusInicialDeEnvio` fora de import em `apps/api/src` 4; `not like 'mensagem.%'` em `outbox-worker.ts` 1; `tiposDeEvento` 3.
- Nao rodei `npm run check` inteiro (13-17 min), conforme o plano.

## Known Stubs

None.

## Threat Flags

None. T-16-13 (filtro `not like 'mensagem.%'` + teste com as duas linhas), T-16-14 (`.strict()` com tres ids e criterio contra `conteudo`/`valor`), T-16-15 (mesmo `PoolClient` + teste de rollback com `deps.enfileirar` que lanca) e T-16-SC (nenhum pacote novo) estao cobertos.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 16-05: o entregador reivindica `mensagem.enviar.v1` com `OutboxWorker` + `tiposDeEvento: ["mensagem.enviar.v1"]` (o padrao do worker antigo a exclui) e passa a Mensagem `pendente` a `enviada`/`falhou`; a linha `entregar()` de hoje cairia em `/webhooks/plataforma/desconhecido` para esse tipo, entao o entregador nao pode usar o `entregar` HTTP do `automation/`.
- 16-06: `reenfileirarEnvio` e `reenfileirarPendentesDoCanal` entram em `mensageria/fila-de-saida.ts`; o indice unico da 013 por (Espaco, agregado, evento) ja impede duas linhas para a mesma Mensagem, entao o reenfileirar precisa reabrir a linha existente (ou usar `on conflict`), nao inserir outra.
- Mensagens `enviada` que ja existiam em producao continuam `enviada` (nada migra); so as novas nascem `pendente`.
- `persistencia/CONTEXT.md` e `mensageria/CONTEXT.md` ainda nao citam `mensagem.enviar.v1`, `enfileirarEnvio` nem `tiposDeEvento` (nao estavam nos `files_modified` do plano).

## Self-Check: PASSED

- Arquivo criado existe: `apps/api/src/mensageria/fila-de-saida.ts`.
- Commits na branch: `743110f`, `66ab2db`, `40db358`, `1e2be3b`, `fb24895`, `7ac813d`.

---
*Phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia*
*Completed: 2026-11-09*
