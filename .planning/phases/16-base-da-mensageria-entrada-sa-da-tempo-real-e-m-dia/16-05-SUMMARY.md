---
phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia
plan: 05
subsystem: api
tags: [mensageria, outbox, saida, provedor, postgres, vitest, tdd]

requires:
  - phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia
    provides: "`ProvedorDeMensageria`, `provedorDoCanal`/`canalParaProvedor` e o provedor de teste com `programarEnvio` (16-02)"
  - phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia
    provides: "`mensagem.enviar.v1` no outbox, `enfileirarEnvio` e o filtro `tiposDeEvento` do worker (16-04)"
provides:
  - "`criarEntregadorDeMensagens` e `criarWorkerDeSaida` (`mensageria/entregar-mensagem.ts`): o worker so de `mensagem.enviar.v1`, que entrega por `provedorDoCanal(canal).enviar` e grava o desfecho na Mensagem"
  - "`outbox-worker.ts`: opcao `entregador` (`DesfechoDaEntrega`, `EntregadorDoOutbox`), `recuperarTravasVencidasMs`, `acordar()`, `registrar` e o padrao `apikey` em `sanitizarErro`"
  - "repositorio de Mensagens: `obter`, `gravarEnvio` (so de `pendente`) e `marcarFalha` (so de `pendente` ou `enviada`)"
  - "`MENSAGERIA_WORKER_ATIVO=true` sobe o worker de saida ao lado do processador de entrada; `acordadores.saida` para o 16-07"
affects: [16-06, 16-07, 16-09, 16-11, 16-12]

actuals:
  tokens: 14000
  tasks: 3
  commits: 7

tech-stack:
  added: []
  patterns:
    - "worker do outbox com entregador injetado: o worker aplica o desfecho (`entregue`, `tentar_de_novo`, `desistir`) a linha, o entregador decide o que gravar no agregado"
    - "volta do worker que esvazia a fila, com `acordar()` pedindo mais uma volta em vez de abrir outra (mesmo molde do processador de entrada)"
    - "excecao depois que o provedor aceitou nunca volta a fila: tenta gravar de novo e, se nao der, desiste com `ENVIADO_SEM_REGISTRO`"

key-files:
  created:
    - apps/api/src/mensageria/entregar-mensagem.ts
    - apps/api/src/mensageria/entregar-mensagem.test.ts
    - apps/api/src/e2e/mensageria.test.ts
  modified:
    - apps/api/src/persistencia/outbox-worker.ts
    - apps/api/src/persistencia/outbox-worker.test.ts
    - apps/api/src/repositorios/crm/mensagens.ts
    - apps/api/src/index.ts

key-decisions:
  - "Ambiguo antes de transitorio: um `ResultadoDoEnvio` com `ambiguo: true` vira `falhou` com a frase de sem confirmacao mesmo marcado `transitorio`; e uma excecao que escapa de dentro de `provedor.enviar` tambem vale ambigua (nao diz se saiu). So a excecao ANTES da chamada (cofre, registro) e transitoria."
  - "Depois do aceite do provedor, uma falha do banco em `gravarEnvio` e repetida 3 vezes na hora; se nada resolver a linha desiste (`ENVIADO_SEM_REGISTRO`) em vez de voltar a fila, porque repetir a linha inteira reenviaria ao cliente."
  - "A recuperacao de trava manda para `failed/TRAVA_VENCIDA` a linha que ja gastou as tentativas (como o processador de entrada do 16-03), para uma linha que derruba o processo nao voltar para sempre."
  - "Uma volta do worker esvazia a fila (a linha que falha volta com `available_at` no futuro, entao o laco termina); sem `registrar`, um erro da volta sobe como sempre subiu no worker do `automation/`."
  - "`criarWorkerDeSaida` aceita `workspaceId` opcional (em producao ausente: worker global): so os testes o passam, para nao reivindicarem a fila de outro arquivo de teste na mesma tabela."
  - "`motivo_falha` do provedor passa por `sanitizarErro` (sem `apikey`, Bearer nem documento) e cai em \"O provedor recusou a Mensagem.\" quando vem vazio."

patterns-established:
  - "Quem entrega e quem decide o que a Mensagem vira: o worker generico do outbox nao conhece Mensagem nem provedor."
  - "Teste de worker com `available_at` no passado (2 s): o relogio do Postgres de Docker pode estar alguns ms atras do processo de teste."

requirements-completed: [MSG-02]

coverage:
  - id: D1
    description: "A resposta escrita na Caixa num Canal simulado e conectado sai pelo provedor de teste (destino = Identificador do Contato, conteudo, mensagemId) e a Mensagem fica `enviada` com `id_externo` `teste-...` e `status_entrega_em`; a linha do outbox fica `delivered`"
    requirement: MSG-02
    verification:
      - kind: e2e
        ref: "apps/api/src/e2e/mensageria.test.ts#a resposta escrita na Caixa nasce pendente, sai pelo provedor de teste e fica enviada com o id do provedor"
        status: pass
    human_judgment: false
  - id: D2
    description: "Erro transitorio duas vezes: a terceira tentativa entrega (tres envios ao provedor); cinco transitorios seguidos: `falhou` com \"O provedor nao respondeu depois de varias tentativas.\" e exatamente cinco envios"
    requirement: MSG-02
    verification:
      - kind: e2e
        ref: "apps/api/src/e2e/mensageria.test.ts#erro transitório duas vezes: a terceira tentativa entrega e a Mensagem fica enviada, com três envios ao provedor"
        status: pass
      - kind: integration
        ref: "apps/api/src/mensageria/entregar-mensagem.test.ts#cinco transitórios seguidos: na quinta, falhou com a frase de várias tentativas"
        status: pass
    human_judgment: false
  - id: D3
    description: "Resposta ambigua vira `falhou` com a frase de sem confirmacao e o provedor nunca e chamado de novo; recusa permanente grava o motivo do provedor; nenhuma delas volta a fila (prohibition de MSG-02)"
    requirement: MSG-02
    verification:
      - kind: integration
        ref: "apps/api/src/mensageria/entregar-mensagem.test.ts#resposta ambígua: falhou com a frase de sem confirmação e o provedor nunca é chamado de novo"
        status: pass
      - kind: integration
        ref: "apps/api/src/mensageria/entregar-mensagem.test.ts#recusa permanente: falhou com o motivo do provedor, a linha failed e nenhuma nova tentativa"
        status: pass
    human_judgment: false
  - id: D4
    description: "Canal que caiu entre enfileirar e entregar nao tenta: Mensagem `pendente` e linha `failed/CANAL_DESCONECTADO`; Contato sem Identificador do tipo do Canal, Canal real sem provedor e Mensagem que ja nao esta `pendente` tem desfecho proprio sem chamar o provedor de teste"
    requirement: MSG-02
    verification:
      - kind: integration
        ref: "apps/api/src/mensageria/entregar-mensagem.test.ts (Canal que caiu, Contato sem Identificador, Canal real sem provedor, Mensagem que já não está pendente)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Linha `delivering` com `locked_at` vencido (2 min) volta a `pending` e e entregue; a de 30 s nao e tomada; a que ja gastou as tentativas vira `failed/TRAVA_VENCIDA`; a recuperacao so toca os tipos do worker"
    requirement: MSG-02
    verification:
      - kind: integration
        ref: "apps/api/src/persistencia/outbox-worker.test.ts#(s), (t) e (u)"
        status: pass
      - kind: integration
        ref: "apps/api/src/mensageria/entregar-mensagem.test.ts#linha delivering com trava de 3 min (worker que caiu)"
        status: pass
    human_judgment: false
  - id: D6
    description: "`sanitizarErro` remove `apikey` (texto, `=`, JSON, maiusculas): nem `last_error_summary` nem `motivo_falha` carregam a chave do provedor"
    requirement: MSG-02
    verification:
      - kind: unit
        ref: "apps/api/src/persistencia/outbox-worker.test.ts#(o) remove a apikey do provedor"
        status: pass
      - kind: integration
        ref: "apps/api/src/mensageria/entregar-mensagem.test.ts#motivo do provedor com apikey"
        status: pass
    human_judgment: false
  - id: D7
    description: "`acordar()` entrega a linha disponivel em menos de 500 ms com intervalo de 60 s e nunca abre duas voltas juntas; `MENSAGERIA_WORKER_ATIVO=true` sobe o worker de saida e o para em `aoEncerrar` antes do `app.close()`"
    requirement: MSG-02
    verification:
      - kind: integration
        ref: "apps/api/src/persistencia/outbox-worker.test.ts#(v) e (w)"
        status: pass
      - kind: other
        ref: "grep criarWorkerDeSaida/saida.parar em apps/api/src/index.ts (o index.ts sobe o servidor e nao tem teste)"
        status: pass
    human_judgment: true
    rationale: "O `index.ts` abre porta e liga workers por variavel de ambiente; nenhum teste o importa. A ligacao foi conferida por criterio de aceite (grep) e `tsc`, nao por execucao: confirmar no primeiro deploy com `MENSAGERIA_WORKER_ATIVO=true`."

plan_head_before: 5c9668d570a934709ad7abdaef3365707fe674f3
plan_head_after: 2ed4b296d079689d7f8b41ba9e9fa45b99851bd4

duration: 16min
completed: 2026-11-09
status: complete
---

# Phase 16 Plan 05: A saida da mensageria pelo provedor do Canal Summary

**Worker de saida so de `mensagem.enviar.v1` que entrega por `provedorDoCanal(canal).enviar`, passa a Mensagem de `pendente` a `enviada` com `id_externo` ou a `falhou` com motivo legivel, e nunca reenvia sozinho depois de resposta ambigua; o worker generico do outbox ganhou `entregador`, recuperacao de trava vencida, `acordar()` e o padrao `apikey`.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-11-09T17:52:18Z
- **Completed:** 2026-11-09T18:08:00Z
- **Tasks:** 3
- **Files modified:** 7 (3 criados, 4 alterados), 1018 linhas inseridas

## Accomplishments

- A resposta escrita na Caixa (`POST /mensagens`) num Canal simulado e conectado sai pelo provedor de teste e a Mensagem fica `enviada` com o id do provedor, ponta a ponta pelo HTTP real do `buildApp` (3.7.2).
- Politica de tentativas que nao duplica ao cliente: transitorio volta a fila na escada de `backoff()` ate 5 tentativas; permanente e ambiguo viram `falhou` com frase de produto e nao voltam; Canal fora de `conectada` nao tenta e deixa a Mensagem `pendente` (B69).
- `outbox-worker.ts` com entregador injetado, recuperacao de trava vencida (so dos tipos do worker), `acordar()` com volta unica e o padrao `apikey` em `sanitizarErro`; o caminho HTTP do `automation/` ficou como era.
- `MENSAGERIA_WORKER_ATIVO=true` sobe o worker de saida ao lado do processador de entrada, parado em `aoEncerrar`.

## Task Commits

1. **Task 1 (tracador), RED** - `47a41b6` (test): e2e do envio e esqueleto de `criarWorkerDeSaida` que devolvia `false`; falhou por asserção (`expected false to be true`).
2. **Task 1, GREEN** - `3937642` (feat): `entregador` no outbox, `obter`/`gravarEnvio`/`marcarFalha`, `criarEntregadorDeMensagens` com a politica inteira e `criarWorkerDeSaida`.
3. **Task 2** - `313c5cf` (test): 10 testes do entregador, 6 do worker com entregador, 1 de `apikey` e o e2e do transitorio 2x. Nasceram verdes (ver Gate Compliance); `886df88` (refactor): o comentario de topo cita a frase pela constante, para o criterio de aceite contar 1.
4. **Task 3** - `b4ca9a7` (test): `acordar()` (v) e (w); `b79511a` (feat): o worker de saida no `index.ts`.
5. **Correcao do gate amplo** - `2ed4b29` (fix): `workspaceId` opcional no worker de saida, usado so pelos testes.

**Plan metadata:** commit `docs(16-05)` seguinte (STATE, ROADMAP, REQUIREMENTS).

## Files Created/Modified

- `apps/api/src/mensageria/entregar-mensagem.ts` - `criarEntregadorDeMensagens`, `criarWorkerDeSaida`, `FRASES_DA_SAIDA`
- `apps/api/src/mensageria/entregar-mensagem.test.ts` - 10 testes da politica de tentativas (Postgres de Docker)
- `apps/api/src/e2e/mensageria.test.ts` - 2 testes ponta a ponta (envio e transitorio 2x)
- `apps/api/src/persistencia/outbox-worker.ts` - `entregador`, `DesfechoDaEntrega`, `recuperarTravasVencidasMs`, `acordar()`, `registrar`, padrao `apikey`, volta que esvazia a fila
- `apps/api/src/persistencia/outbox-worker.test.ts` - (o) a (w) novos e o `available_at` com folga no helper
- `apps/api/src/repositorios/crm/mensagens.ts` - `obter`, `gravarEnvio`, `marcarFalha`
- `apps/api/src/index.ts` - o worker de saida em `MENSAGERIA_WORKER_ATIVO` e `acordadores.saida`

## Decisions Made

Ver `key-decisions`. O mais relevante para os proximos planos: `gravarEnvio` so age de `pendente` e `marcarFalha` so de `pendente` ou `enviada` (16-06 e 16-09 podem confiar que uma Mensagem `entregue`/`lida` nao regride); o 16-07 acorda a saida por `acordadores.saida()` (hoje so e preenchido com `MENSAGERIA_WORKER_ATIVO=true`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] O worker de saida dos testes reivindicava a fila de outro arquivo**
- **Found during:** gate amplo (suite inteira do `apps/api`, 207 arquivos)
- **Issue:** `criarWorkerDeSaida` sem `workspaceId` e global; com arquivos de teste rodando em paralelo na mesma `integration_outbox`, o worker de um arquivo reivindicava linhas `mensagem.enviar.v1` de outro (o teste "cinco transitorios" falhava na rodada ampla).
- **Fix:** `workspaceId` opcional em `OpcoesDoWorkerDeSaida`, repassado ao `criarOutboxWorker` (que ja o suportava); os testes passam o Espaco. Em producao fica ausente.
- **Files modified:** `apps/api/src/mensageria/entregar-mensagem.ts`, `entregar-mensagem.test.ts`, `e2e/mensageria.test.ts`
- **Verification:** suite inteira sem falha nos arquivos do plano.
- **Committed in:** `2ed4b29`

**2. [Rule 1 - Bug] Casos (h) a (k) do `outbox-worker.test.ts` instaveis por relogio**
- **Found during:** Task 2
- **Issue:** `inserirLinhaPendente` gravava `available_at` com `new Date()` do processo; o Postgres de Docker, alguns ms atras, ainda nao a via elegivel e `processarUm()` devolvia `false`. Era o "baseline h a k" que os planos anteriores anotaram.
- **Fix:** o padrao do helper passou a 2 s no passado. Quatro rodadas paralelas dos tres arquivos do plano sairam verdes.
- **Files modified:** `apps/api/src/persistencia/outbox-worker.test.ts`
- **Committed in:** `313c5cf`

**3. [Rule 2 - Missing Critical] Excecao depois do aceite do provedor nao pode reenviar**
- **Found during:** Task 1
- **Issue:** o plano nao diz o que fazer se `gravarEnvio` lancar DEPOIS de o provedor aceitar; devolver `tentar_de_novo` reenviaria ao cliente (a prohibition de MSG-02). O mesmo vale para uma excecao que escapa de `provedor.enviar`.
- **Fix:** tres tentativas imediatas de `gravarEnvio`, e se falharem a linha desiste com `ENVIADO_SEM_REGISTRO`; excecao dentro de `enviar` vira ambigua (`falhou` com a frase de sem confirmacao).
- **Files modified:** `apps/api/src/mensageria/entregar-mensagem.ts`
- **Committed in:** `3937642`

**4. [Rule 2 - Missing Critical] Trava vencida de linha que ja gastou as tentativas**
- **Found during:** Task 1 (mesmo achado que o 16-03 fez no processador de entrada)
- **Issue:** devolver toda trava vencida a `pending` faria uma linha que derruba o processo voltar para sempre.
- **Fix:** `recuperarTravasVencidasMs` manda a que tem `attempts >= maxTentativas` para `failed/TRAVA_VENCIDA` e devolve as demais; teste (t).
- **Files modified:** `apps/api/src/persistencia/outbox-worker.ts`, `outbox-worker.test.ts`
- **Committed in:** `3937642` / `313c5cf`

---

**Total deviations:** 4 auto-fixed (2 Rule 1, 2 Rule 2)
**Impact on plan:** nenhuma muda o contrato do `<interfaces>` (`workspaceId` e so um campo opcional a mais). Sem scope creep.

## TDD Gate Compliance

O plano e `type: execute` e `workflow.tdd_mode` e `false`: sem `gsd_run check tdd-red-evidence`; avaliacao semantica manual.

- **Task 1 (tracador):** RED `47a41b6`: o alvo executou contra o Postgres de Docker e falhou na asserção planejada (`expected false to be true` no primeiro `processarUm()`), nao por import nem sintaxe. GREEN `3937642`. Tracador reverificado: o e2e re-rodado fim a fim passou e a execucao seguiu para a expansao.
- **Task 2 e Task 3:** NAO houve RED por tarefa: a politica de tentativas, a recuperacao de trava, a `apikey` e o `acordar()` ficaram na GREEN da Task 1 (sao parte da forma do entregador e do worker, que nao se constroem pela metade). Os testes nasceram verdes ("unexpected green" por construcao). Para provar que enxergam defeitos, apliquei mutacoes temporarias e as reverti: ambiguo tratado como transitorio derruba o teste do ambiguo; sem o padrao `apikey` derruba tres testes; sem `recuperarTravasVencidas` derruba (s), (t) e o teste de trava do entregador; sem checar `conexao` derruba o do Canal desconectado; `acordar()` vazio derruba (v) e (w) e sem a volta em voo derruba (w). Nenhuma mutacao ficou no codigo.
- **REFACTOR:** `886df88` (so comentario).

## Issues Encountered

- A primeira versao do teste (w) ficava num laco sem prazo e travou a rodada da mutacao; os laços de espera ganharam prazo de 2 s.
- Falhas na suite inteira que NAO vem deste plano: `persistencia/colunas-geradas.test.ts` (2 testes: ordem de `due_date` e plano do Postgres) falha so depois da suite inteira no mesmo banco, e passa em banco novo, tambem depois de rodar os arquivos deste plano. Anotado em `deferred-items.md` pelo orquestrador, se quiser.

## Verification Run

- Postgres 16 em Docker (`crm-n1-pg-1605`, porta 55720), `npm run --silent migrar` num banco novo (lista ate `013-mensageria.sql`), contêiner removido no fim; nenhum teste pulado nos arquivos do plano:
  - `entregar-mensagem.test.ts` 10, `e2e/mensageria.test.ts` 2, `outbox-worker.test.ts` 26: 3 arquivos, 38 passando (quatro rodadas paralelas e uma sequencial).
  - Banco novo: `src/mensageria`, `e2e/mensageria.test.ts`, `e2e/mensageria-entrada.test.ts`, `outbox-worker.test.ts`, `outbox.test.ts`: 8 arquivos, 81 passando; depois, `colunas-geradas.test.ts` 8 passando.
  - Suite inteira do `apps/api` (207 arquivos): 204 passando, 2 pulados, 1 com falha (`colunas-geradas.test.ts`, descrita acima); 2602 testes passando.
  - `npx tsc --noEmit` em `apps/api`: ok.
- Criterios de aceite: `tiposDeEvento` em `entregar-mensagem.ts` 1; `mensagem.enviar.v1|EVENTOS_DA_MENSAGERIA` 3; `gravarEnvio(` no repositorio 2; `fetch(` em `entregar-mensagem.ts` 0; frase de sem confirmacao 1; `CANAL_DESCONECTADO` 2; `apikey` em `outbox-worker.ts` 2; `criarWorkerDeSaida` em `index.ts` 3, `saida.parar` 1; `acordar()` em `outbox-worker.ts` 2.
- Nao rodei `npm run check` inteiro (13-17 min), conforme o plano; `apps/web` e `packages/dominio` nao foram tocados.

## Known Stubs

None.

## Threat Flags

None. T-16-16 (ambiguo e excecao dentro de `enviar` viram `falhou` sem reenvio; excecao depois do aceite nao volta a fila), T-16-17 (`sanitizarErro` com `apikey`, `motivo_falha` so frase de produto ou motivo sanitizado), T-16-18 (recuperacao de trava de 2 min, testada), T-16-19 (destino sempre o Identificador do Contato DA Conversa, por `identificadorDoCanal`, com `workspace_id` em toda leitura) e T-16-SC (nenhum pacote novo) estao cobertos.

## User Setup Required

None - no external service configuration required. Em producao, `MENSAGERIA_WORKER_ATIVO=true` (ja prevista no 16-03) agora tambem liga a saida; `MENSAGERIA_WORKER_ID` ganha o sufixo `-saida` para a instancia de saida. `.env.example` ainda nao cita essas variaveis (fora do `files_modified`).

## Next Phase Readiness

- 16-06: `reenfileirarEnvio` e `reenfileirarPendentesDoCanal` reabrem a linha `failed` (a 013 tem indice unico por agregado e evento): a do `CANAL_DESCONECTADO` fica `failed` com a Mensagem `pendente`, e a de ambiguo/permanente tem a Mensagem `falhou` (so a pessoa reenvia, por "Tentar de novo": a Mensagem volta a `pendente` antes de a linha reabrir, senao o entregador a ve como ja resolvida).
- 16-07: acordar a saida logo depois do commit com `acordadores.saida()` (em `index.ts`); `OutboxWorker.acordar()` e seguro de chamar muitas vezes.
- 16-09: o evento `status` do provedor ainda cai no `else` final do processador de entrada (`sem_tratamento:status`); `marcarFalha` aceita `enviada`, entao uma recusa tardia do provedor pode virar `falhou` por ela.
- 16-11/16-12: ao registrar a Evolution, `enviar` deve devolver `ambiguo: true` para tempo esgotado e resposta perdida: e o que impede o reenvio; `motivo` pode ser o texto do provedor (passa por `sanitizarErro`).
- `mensageria/CONTEXT.md` e `persistencia/CONTEXT.md` ainda nao citam o entregador, `recuperarTravasVencidasMs` nem `acordar()` (nao estavam nos `files_modified`).

## Self-Check: PASSED

- Arquivos criados existem: `apps/api/src/mensageria/entregar-mensagem.ts`, `entregar-mensagem.test.ts`, `apps/api/src/e2e/mensageria.test.ts`.
- Commits na branch: `47a41b6`, `3937642`, `313c5cf`, `886df88`, `b4ca9a7`, `b79511a`, `2ed4b29`.

---
*Phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia*
*Completed: 2026-11-09*
