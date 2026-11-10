---
phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia
plan: 06
subsystem: api
tags: [mensageria, outbox, tentar-de-novo, status-de-entrega, reenfileirar, postgres, vitest, tdd]

requires:
  - phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia
    provides: "processador de entrada com o ponto de troca dos eventos `status` e `conexao`, e o indice unico `integration_outbox_mensagem_enviar_uniq` (16-03)"
  - phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia
    provides: "`enfileirarEnvio` e o evento `mensagem.enviar.v1` (16-04)"
  - phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia
    provides: "o entregador (so envia `pendente`), `gravarEnvio` e `marcarFalha` (16-05)"
provides:
  - "`POST /mensagens/:id/reenviar` e `ServicoDeMensagens.reenviar`: so a Mensagem `enviada` que `falhou` volta a `pendente` e a mesma linha do outbox reabre"
  - "`reenfileirarEnvio` e `reenfileirarPendentesDoCanal` (`mensageria/fila-de-saida.ts`): `on conflict ... do update` com o predicado do indice parcial, so reabre `failed`/`delivered`"
  - "`proximoStatusDeEntrega` (dominio): o status do provedor so avanca; `falhou` so de `pendente`/`enviada`"
  - "repositorio de Mensagens: `voltarParaPendente` e `atualizarStatusDeEntrega` (`for update` por Canal e id externo)"
  - "o processador de entrada trata `status` e `conexao`; `simularConexao` reenfileira as pendentes do Canal na mesma transacao"
affects: [16-07, 16-08, 16-09, 16-11, 16-12, 16-14]

actuals:
  tokens: 17400
  tasks: 3
  commits: 7

tech-stack:
  added: []
  patterns:
    - "reenfileirar = upsert que REABRE a linha unica do agregado e so toca `failed`/`delivered`: nunca solta a trava de uma `delivering` nem zera uma `pending`"
    - "a Mensagem volta a `pendente` ANTES de a linha reabrir (o entregador so envia `pendente` e da por resolvida a que nao esta)"
    - "evento do provedor aplicado numa transacao propria com `for update` e a regra no dominio (`proximoStatusDeEntrega`), o repositorio so grava"
    - "ramo final do laco de eventos exaustivo (`never`): um tipo novo de `EventoDoProvedor` quebra a compilacao ate ganhar ramo"

key-files:
  created: []
  modified:
    - apps/api/src/mensageria/fila-de-saida.ts
    - apps/api/src/repositorios/crm/mensagens.ts
    - apps/api/src/servicos/crm/mensagens.ts
    - apps/api/src/servicos/crm/canais.ts
    - apps/api/src/rotas/crm/mensagens.ts
    - apps/api/src/mensageria/processador-de-entrada.ts
    - packages/dominio/src/crm/mensagens.ts

key-decisions:
  - "`reenfileirarEnvio` so reabre linha `failed` ou `delivered` (`do update ... where status in (...)`). Uma `pending` ja vai ser entregue e uma `delivering` esta com um worker: zera-las soltaria a trava e a Mensagem poderia sair duas vezes (um evento `conexao` repetido num Canal ja conectado reenfileira as pendentes)."
  - "`available_at = clock_timestamp()` na reabertura: varias Mensagens reabertas na mesma transacao saem na ordem de escrita, nao num empate de `now()` desfeito pelo uuid."
  - "Evento `conexao` repetido (Canal real ja no estado do evento): nao sobe a revisao do Espaco, mas ainda reenfileira as pendentes se `conectada` (rede para a Mensagem guardada; o upsert nao toca `pending`/`delivering`)."
  - "O processador trava na ordem do WR-02 (linha do Espaco, depois o Canal `for update`) e relê o Canal dentro da transacao antes de decidir `conexao_simulada`."
  - "Status que nao avanca grava `resultado = ignorado:status_atrasado` e id externo sem Mensagem do Canal grava `ignorado:status_sem_mensagem`; `em` invalido do provedor cai no relogio do processo; `motivo` do `falhou` passa por `sanitizarErro` e vazio vira \"O provedor recusou a Mensagem.\"."
  - "O ramo final do laco de eventos do processador virou exaustivo (`never`): `sem_tratamento:<tipo>` deixa de existir para os tipos conhecidos e fica so como rede de execucao."

patterns-established:
  - "Tentar de novo = `voltarParaPendente` (where status = falhou, decide a corrida entre dois cliques) + `reenfileirarEnvio` (so se o Canal esta conectado), na mesma transacao."
  - "Canal que volta (botao ou evento) = `reenfileirarPendentesDoCanal` dentro do `comTransacao`/transacao que muda a conexao."

requirements-completed: [MSG-02]

coverage:
  - id: D1
    description: "Mensagem `enviada` que `falhou` volta pela rota `POST /mensagens/:id/reenviar` a `pendente` sem o motivo, a MESMA linha do outbox reabre (`pending`, 0 tentativas, uma linha so) e a segunda tentativa sai pelo provedor (`enviada` com id externo)"
    requirement: MSG-02
    verification:
      - kind: e2e
        ref: "apps/api/src/e2e/mensageria.test.ts#Tentar de novo (16-06): a Mensagem que falhou volta a pendente, a MESMA linha do outbox reabre e a segunda tentativa sai pelo provedor"
        status: pass
    human_judgment: false
  - id: D2
    description: "Reenviar duas vezes seguidas uma Mensagem que voltou a falhar nao lanca 23505: a linha e reaberta, nunca duplicada"
    requirement: MSG-02
    verification:
      - kind: e2e
        ref: "apps/api/src/e2e/mensageria.test.ts#Tentar de novo duas vezes seguidas numa Mensagem que voltou a falhar nao lanca 23505"
        status: pass
    human_judgment: false
  - id: D3
    description: "Mensagem que nao falhou (pendente, enviada, interna) 409 NAO_FALHOU; inexistente ou de outro Espaco 404; Convidado 403; Membro suspenso 403 SUSPENSO; Canal fora do ar volta a pendente sem linha; Conversa na lixeira 409"
    requirement: MSG-02
    verification:
      - kind: integration
        ref: "apps/api/src/rotas/crm/mensagens.test.ts#Tentar de novo (16-06, 3.7.3) (7 testes) e os 3 do servico falso"
        status: pass
    human_judgment: false
  - id: D4
    description: "`proximoStatusDeEntrega` so avanca: lida seguida de entregue atrasado continua lida; falhou so de pendente/enviada; nada sai de falhou; sem status (recebida/interna) devolve null"
    requirement: MSG-02
    verification:
      - kind: unit
        ref: "packages/dominio/src/crm/mensagens.test.ts#proximoStatusDeEntrega (3.6.5: o status do provedor so avanca)"
        status: pass
    human_judgment: false
  - id: D5
    description: "O evento `status` do provedor chega a Mensagem pelo processador: lida com o `em` do evento, entregue atrasado ignorado, id desconhecido ou de outro Espaco ignorado, falhou com motivo saneado e uma ja entregue continua entregue"
    requirement: MSG-02
    verification:
      - kind: integration
        ref: "apps/api/src/mensageria/processador-de-entrada.test.ts (4 testes de status)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Canal que volta a `conectada` (Simular conexao ou evento `conexao` de Canal real) reenfileira as Mensagens `pendente` dele no mesmo commit; `failed` reabre, `delivering`/`delivered` e o outro Canal nao sao tocados; evento `conexao` em Canal simulado e ignorado"
    requirement: MSG-02
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/canais.test.ts#Canal que volta ao ar reenfileira as pendentes (3 testes)"
        status: pass
      - kind: integration
        ref: "apps/api/src/mensageria/processador-de-entrada.test.ts (4 testes de conexao)"
        status: pass
    human_judgment: false

plan_head_before: 88026b4a378d415abee538bb78b77ec56f1e5f38
plan_head_after: 89cae252f8a49afd5bb85aa8a171e2d7b9166855

duration: 11min
completed: 2026-11-09
status: complete
---

# Phase 16 Plan 06: Tentar de novo, o status do provedor e o Canal que volta ao ar Summary

**`POST /mensagens/:id/reenviar` volta a Mensagem que falhou a `pendente` e reabre a MESMA linha do outbox por `on conflict ... do update` (sem 23505); `proximoStatusDeEntrega` faz o status do provedor so avancar; e o Canal que volta a `conectada` (botao ou evento `conexao` de Canal real) reenfileira as pendentes dele na mesma transacao.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-11-09T18:15:09Z
- **Completed:** 2026-11-09T18:26:11Z
- **Tasks:** 3
- **Files modified:** 12 (7 de codigo, 5 de teste), 888 linhas inseridas

## Accomplishments

- "Tentar de novo" na api: so a Mensagem `enviada` com `falhou` (409 `NAO_FALHOU` com a frase do produto para o resto, 404 para ausente ou de outro Espaco, 403 sem poder `enviar` ou suspenso, 409 para Conversa na lixeira e Canal arquivado). A Mensagem volta a `pendente` antes de a linha reabrir; Canal fora do ar so guarda, sem linha.
- `reenfileirarEnvio` reabre a linha unica da Mensagem (zera `attempts`, `locked_*`, `last_error_*`, `delivered_at`) e so toca `failed`/`delivered`; `reenfileirarPendentesDoCanal` varre as `pendente` do Canal na ordem de escrita.
- `proximoStatusDeEntrega` no dominio e `atualizarStatusDeEntrega` no repositorio (`for update` por Canal e id externo): uma `lida` seguida de um `entregue` atrasado continua `lida` (prohibition de MSG-02, T-16-22).
- O processador de entrada deixou de classificar `status` e `conexao` como "sem tratamento": o `status` muda a Mensagem; o `conexao` so muda Canal real (simulado fica `ignorado:conexao_simulada`), sobe a revisao do Espaco e reenfileira as pendentes quando `conectada`.
- "Simular conexao" reenfileira as pendentes do Canal no mesmo `comTransacao` da conexao.

## Task Commits

1. **Task 1 (tracador), RED** - `8587da7` (test): e2e do Tentar de novo; falhou por asserção (`expected 404 to be 200`, a rota nao existia), depois de a Mensagem chegar a `falhou` pelo caminho real.
2. **Task 1, GREEN** - `dabbf5e` (feat): `reenfileirarEnvio`/`reenfileirarPendentesDoCanal`, `voltarParaPendente`, `reenviar`, a rota.
3. **Task 1, testes de rota** - `f625e8f` (test): 401/403/404/409, Canal fora do ar e lixeira (ver Gate Compliance).
4. **Task 2, RED** - `6cee4ed` (test): `proximoStatusDeEntrega` como esqueleto que devolve o atual (7 de 36 falham) e 4 testes de status do processador (falham por asserção).
5. **Task 2, GREEN** - `3fd6c0e` (feat): a regra no dominio, `atualizarStatusDeEntrega`, o ramo `status` do processador.
6. **Task 3, RED** - `9ec2469` (test): 3 testes do servico de Canais e 5 do processador (conexao).
7. **Task 3, GREEN** - `89cae25` (feat): `simularConexao` reenfileira; o ramo `conexao` do processador.

**Plan metadata:** commit `docs(16-06)` seguinte (STATE, ROADMAP, REQUIREMENTS).

## Files Created/Modified

- `apps/api/src/mensageria/fila-de-saida.ts` - `reenfileirarEnvio` e `reenfileirarPendentesDoCanal`
- `apps/api/src/repositorios/crm/mensagens.ts` - `voltarParaPendente` e `atualizarStatusDeEntrega`
- `apps/api/src/servicos/crm/mensagens.ts` - `reenviar` (e `deps.reenfileirar` so para teste de rollback)
- `apps/api/src/rotas/crm/mensagens.ts` - `POST /mensagens/:id/reenviar` (params `{ id }`, sem corpo, 200)
- `apps/api/src/servicos/crm/canais.ts` - `mudarConexao` reenfileira ao deixar o Canal `conectada`
- `apps/api/src/mensageria/processador-de-entrada.ts` - `aplicarStatus` e `aplicarConexao`; ramo final exaustivo
- `packages/dominio/src/crm/mensagens.ts` - `proximoStatusDeEntrega`
- testes: `e2e/mensageria.test.ts` (+2), `rotas/crm/mensagens.test.ts` (+10), `processador-de-entrada.test.ts` (+8), `servicos/crm/canais.test.ts` (+3), `packages/dominio/src/crm/mensagens.test.ts` (+29 casos)

## Decisions Made

Ver `key-decisions`. O que mais pesa para os proximos planos: `reenfileirarEnvio` NAO reabre uma linha `pending` nem `delivering`; o evento `status` ainda nao avisa a tela (o 16-07 liga o aviso/SSE dentro de `aplicarStatus` e `aplicarConexao`); `resultado` ganhou `ignorado:status_sem_mensagem`, `ignorado:status_atrasado`, `ignorado:conexao_simulada`, `ignorado:canal_nao_encontrado` e `ignorado:canal_arquivado`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] `reenfileirarEnvio` nao pode reabrir uma linha `pending` ou `delivering`**
- **Found during:** Task 1 (desenho do SQL do Pattern 3)
- **Issue:** o Pattern 3 da RESEARCH (e o `<interfaces>`) reabre a linha sempre. Um evento `conexao: conectada` repetido, ou o Canal que volta com uma Mensagem em entrega, soltaria a trava de uma linha `delivering` debaixo de um worker e a Mensagem sairia duas vezes ao cliente (a prohibition de MSG-02).
- **Fix:** `do update ... where plataforma.integration_outbox.status in ('failed', 'delivered')`; a funcao devolve `boolean` (inseriu ou reabriu). Teste: a `delivering` e a `delivered` ficam como estavam, a `failed` reabre zerada.
- **Files modified:** `apps/api/src/mensageria/fila-de-saida.ts`
- **Verification:** `canais.test.ts#a linha failed ... reabre com as tentativas zeradas; a delivering e a Mensagem ja enviada nao sao tocadas`
- **Committed in:** `dabbf5e`

**2. [Rule 1 - Bug] O ramo final do laco de eventos do processador ficou `never`**
- **Found during:** Task 3
- **Issue:** com `status` e `conexao` tratados, `evento.tipo` no `else` e `never` e o `tsc` falhava.
- **Fix:** o `else` virou uma checagem exaustiva (`const naoTratado: never = evento`) que ainda grava `sem_tratamento:<tipo>` se o provedor inventar um tipo em tempo de execucao.
- **Files modified:** `apps/api/src/mensageria/processador-de-entrada.ts`
- **Committed in:** `89cae25`

**3. [Rule 1 - Bug] Fixture de teste repetia o Identificador do Contato**
- **Found during:** Task 2 (GREEN)
- **Issue:** `mensagemEnviada` do teste do processador criava dois Contatos com o mesmo WhatsApp no mesmo Espaco (`contato_identificadores_unico`).
- **Fix:** um numero por chamada.
- **Files modified:** `apps/api/src/mensageria/processador-de-entrada.test.ts`
- **Committed in:** `3fd6c0e`

### Decisoes do planejador que o plano deixou abertas

- Status que nao avanca grava `resultado = ignorado:status_atrasado` (o plano so pedia que a Mensagem continuasse `lida`); evento `conexao` repetido num Canal real nao sobe a revisao do Espaco; `em` invalido do provedor cai no relogio do processo.

---

**Total deviations:** 3 auto-fixed (1 Rule 2, 2 Rule 1)
**Impact on plan:** nenhuma muda o contrato do `<interfaces>` alem de `reenfileirarEnvio` devolver `boolean` (compativel com `Promise<void>` para quem ignora o valor). Sem scope creep.

## TDD Gate Compliance

O plano e `type: execute`; `workflow.tdd_mode` nao se aplica, entao nao usei `gsd_run check tdd-red-evidence`; a avaliacao semantica foi manual (o alvo executou contra o Postgres de Docker e falhou na asserção planejada, nunca por import ou sintaxe).

- **Task 1 (tracador):** RED `8587da7`: os dois testes novos falharam em `expected 404 to be 200` no `POST .../reenviar`, depois de a Mensagem chegar a `falhou` e a linha a `failed` (os 2 testes anteriores do arquivo passaram). GREEN `dabbf5e`: 4 passando. Tracador reverificado: e2e re-rodado fim a fim passou e a execucao seguiu para a expansao (sem `blocking-human` e sem `<human-check>`). Os testes de rota (`f625e8f`) nasceram verdes por construcao; a mutacao "sem `exigir`" derrubou o teste do Convidado (403); a mutacao "sem checar `falhou` no servico" sobrevive de proposito, porque o `where status = 'falhou'` de `voltarParaPendente` e a segunda defesa (e o proprio teste da corrida entre dois cliques).
- **Task 2:** RED `6cee4ed`: 7 de 36 do dominio falham por asserção (os casos "nao anda para tras" passam por construcao com o esqueleto, que devolve o atual) e 4 do processador (`resultado` era `sem_tratamento:status`). GREEN `3fd6c0e`.
- **Task 3:** RED `9ec2469`: 3 do servico de Canais (falham nas asserções depois da reconexao) e 5 do processador (`resultado` era `sem_tratamento:conexao`). GREEN `89cae25`.
- **REFACTOR:** nao houve.

## Issues Encountered

- O criterio de aceite `grep -c "/mensagens/:id/reenviar" == 1` contou 2 por causa do cabecalho da rota; o comentario passou a escrever `{id}`. O de `ignorado:conexao_simulada == 1` pediu o mesmo ajuste no cabecalho do processador.
- Nada falhou na rodada ampla; os 2 arquivos pulados (`dois-servicos.test.ts` e `integracao-solicitacoes.test.ts` `(m)`) dependem de Storage real e sao anteriores a esta fase.

## Verification Run

- Postgres 16 em Docker (`crm-n1-pg-1606`, porta 55721), `npm run --silent migrar` num banco novo (lista ate `013-mensageria.sql`), conteiner removido no fim:
  - `e2e/mensageria.test.ts` 4; `rotas/crm/mensagens.test.ts` 29; `processador-de-entrada.test.ts` 16; `servicos/crm/canais.test.ts` 21 (37 com o do processador); `e2e/canais-fluxo.test.ts`: os quatro arquivos da Task 3 somam 75 testes passando.
  - Rodada ampla `src/servicos src/rotas src/e2e src/mensageria src/repositorios src/seguranca` + `outbox.test.ts`, `outbox-worker.test.ts`, `migracao-013.test.ts`: 112 arquivos passando, 2 pulados (Storage, anteriores), 1478 testes passando, nenhuma falha.
  - Dominio inteiro: 130 arquivos, 2415 testes passando; `src/crm/mensagens.test.ts` 36.
  - `npx tsc --noEmit` em `packages/dominio` e em `apps/api`: ok.
- Criterios de aceite: `/mensagens/:id/reenviar` na rota 1; `where event_type = 'mensagem.enviar.v1'` em `fila-de-saida.ts` 1; `"enviar", "mensagem"` no servico 2; `export function proximoStatusDeEntrega` 1; `atualizarStatusDeEntrega` no processador 2; `sem_tratamento:status` 0; `reenfileirarPendentesDoCanal` em `canais.ts` 3; `ignorado:conexao_simulada` no processador 1.
- Nao rodei `npm run check` inteiro (13-17 min), conforme o plano; `apps/web` nao foi tocado.

## Known Stubs

None.

## Threat Flags

None. T-16-20 (`exigir(..., "enviar", "mensagem")` antes de tudo, `workspace_id` da sessao em toda leitura; testes 403/404), T-16-21 (`on conflict ... do update` com o predicado do indice parcial; teste de reenviar duas vezes), T-16-22 (`proximoStatusDeEntrega` so avanca, `for update`), T-16-23 (evento `conexao` so vale para Canal real, relido com trava dentro da transacao; o webhook ja e verificado no 16-03) e T-16-SC (nenhum pacote novo) estao cobertos.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 16-07: ligar o aviso/SSE depois de `atualizarStatusDeEntrega` (em `aplicarStatus`, so quando `mudou`) e depois de `aplicarConexao` (a revisao do Espaco ja sobe) e depois do `reenviar` (a Mensagem muda de `falhou` para `pendente`); `acordadores.saida()` deve ser chamado depois do commit do `reenviar` e de `simularConexao` para a saida nao esperar os 5 s.
- 16-08/16-09 (tela): "Tentar de novo" e `POST /mensagens/:id/reenviar` sem corpo, 200 com a Mensagem; erros 409 `NAO_FALHOU`, `CONVERSA_NA_LIXEIRA`, `CANAL_ARQUIVADO`.
- 16-11/16-12: uma Mensagem `falhou` por resposta ambigua pode ter saido; a frase "Sem confirmacao do provedor..." ja avisa, e "Tentar de novo" a reenvia assumindo isso. O evento `status` da Evolution entra por `EventoDoProvedor` `status` com `idExterno`, `status` e `em` ISO.
- Documentacao devida (arquivos fora dos `files_modified` do plano, para o 16-14): `mensageria/CONTEXT.md` (a linha `processador de entrada` agora trata `status` e `conexao`; `reenfileirarEnvio` so reabre `failed`/`delivered`; os novos valores de `resultado`) e `persistencia/CONTEXT.md`/`rotas/CONTEXT.md` (a rota `POST /mensagens/:id/reenviar`).

## Self-Check: PASSED

- Arquivos de codigo e de teste do plano existem (os 12 de `git diff --stat`).
- Commits na branch: `8587da7`, `dabbf5e`, `f625e8f`, `6cee4ed`, `3fd6c0e`, `9ec2469`, `89cae25`.

---
*Phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia*
*Completed: 2026-11-09*
