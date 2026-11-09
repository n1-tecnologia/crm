---
phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia
plan: 07
subsystem: api
tags: [mensageria, tempo-real, sse, listen-notify, postgres, fastify, hub-de-eventos, vitest, tdd]

requires:
  - phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia
    provides: "`receberMensagem`, a unica porta da recebida (16-01)"
  - phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia
    provides: "`enfileirarEnvio` e o evento `mensagem.enviar.v1` (16-04)"
  - phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia
    provides: "o entregador, `gravarEnvio`/`marcarFalha` e `acordadores.saida` em `index.ts` (16-05)"
  - phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia
    provides: "`reenviar`, `atualizarStatusDeEntrega` e os ramos `status` e `conexao` do processador (16-06)"
provides:
  - "`@n1/dominio/crm/eventos`: `TIPOS_DE_EVENTO_DO_CRM`, `EventoDoCrm`, `EventoParaATela`, `lerEventoDoCrm`, `lerEventoParaATela` (so tipo e ids, sem campo a mais)"
  - "`mensageria/avisar.ts`: `avisarCrm(cliente, evento)` faz `pg_notify('crm_eventos', json)` no cliente da transacao; o unico lugar com `pg_notify`"
  - "`mensageria/ouvinte-pg.ts`: `criarOuvinteDoCrm`, uma conexao `LISTEN` por processo, fora do pool, com reconexao de 1 s a 30 s"
  - "`mensageria/hub-de-eventos.ts`: `criarHubDeEventos` (filtra por Espaco, reconfere o Papel, 5 fluxos por Membro, `encerrarTodos`)"
  - "`GET /eventos` (SSE, JWT, `X-Accel-Buffering: no`, batida de 25 s, fecha em 45 min) e `OpcoesDoApp.eventos`"
  - "avisos em `receberMensagem`, `enviar`, `reenviar`, abrir Conversa, entregador (enviada e falhou), status do provedor e os seis gestos da Conversa"
  - "variavel `TEMPO_REAL_ATIVO` (padrao ligado) e o ouvinte acordando o worker de saida a cada `mensagem.nova` e `mensagem.status`"
affects: [16-08, 16-11, 16-14, 16-15, 16-16]

actuals:
  tokens: 22900
  tasks: 3
  commits: 6
plan_head_before: 6974f566510b72acc39e9bdc5ceb3e782072989b
plan_head_after: 54b48ee4d986ed34dea2493e6c19fc26374d7b7b

tech-stack:
  added: []
  patterns:
    - "o aviso ao tempo real vai no MESMO cliente da transacao do gesto (`pg_notify` so entrega no commit): a aba nunca ouve uma gravacao que nao existiu"
    - "SSE por `reply.send(PassThrough)`: o Fastify aplica os cabecalhos ja definidos, CORS inclusive; nunca o socket cru da resposta"
    - "desligamento: `hub.encerrarTodos()` antes do `app.close()` (em `aoEncerrar`), senao `close()` pendura com um fluxo aberto"
    - "o evento so leva tipo e ids; `workspaceId` filtra no hub e nao sai para a aba"
    - "um `podeLer` que lanca (banco falhou) nao e negacao: o fluxo fica e a proxima volta tenta de novo"

key-files:
  created:
    - packages/dominio/src/crm/eventos.ts
    - apps/api/src/mensageria/avisar.ts
    - apps/api/src/mensageria/ouvinte-pg.ts
    - apps/api/src/mensageria/hub-de-eventos.ts
    - apps/api/src/rotas/eventos.ts
  modified:
    - apps/api/src/app.ts
    - apps/api/src/index.ts
    - apps/api/src/servicos/crm/recebimento.ts
    - apps/api/src/servicos/crm/mensagens.ts
    - apps/api/src/servicos/crm/conversas.ts
    - apps/api/src/mensageria/entregar-mensagem.ts
    - apps/api/src/mensageria/processador-de-entrada.ts

key-decisions:
  - "`HubDeEventos` ganhou `podeLer(membro)` (a rota o chama ao abrir o fluxo): o `<interfaces>` do plano nao o expunha, mas a rota nao deve importar persistencia nem `servicos/crm/acesso`."
  - "O ouvinte do `index.ts` acorda o worker de saida a cada `mensagem.nova` E `mensagem.status`: o `reenviar` so produz `mensagem.status`, e assim o Tentar de novo sai sem esperar os 5 s sem tocar em `servicos/crm/canais.ts` (fora dos `files_modified`)."
  - "O processador de entrada ganhou `acordarSaida?`: depois do commit que reenfileira as pendentes de um Canal real que voltou a `conectada` (evento `conexao`). `aplicarConexao` nao avisa a tela: nenhum dos tres tipos cabe (nao ha Conversa), e a revisao do Espaco que ele ja sobe cobre a tela."
  - "O entregador grava o desfecho numa transacao propria (`begin`/`commit` no cliente do pool) para o aviso sair com o commit; so avisa se o `where` do repositorio de fato mudou a Mensagem."
  - "`mover` avisa tambem a Conversa que ele resolve (`resolverExistente`): ela muda e a aba dela precisa saber."
  - "Ouvinte sem `DATABASE_URL` nao derruba o boot: loga e o hub fica indisponivel (503), como com `TEMPO_REAL_ATIVO=false`."
  - "Aba lenta que nao le (mais de 64 KiB parados no buffer do fluxo) e encerrada pelo servidor; a aba reconecta."

patterns-established:
  - "Quem muda Mensagem ou Conversa chama `avisarCrm` dentro da transacao, depois da gravacao e antes de devolver sucesso; recusa (`!ok`) faz rollback e o NOTIFY some."

requirements-completed: [MSG-03]

coverage:
  - id: D1
    description: "Um `avisarCrm` confirmado chega a uma aba aberta em `GET /eventos` como `data:` so com tipo e ids (sem `workspaceId`); a resposta traz `text/event-stream; charset=utf-8`, `no-cache, no-transform`, `X-Accel-Buffering: no` e o CORS da origem permitida; sem `Authorization` 401"
    requirement: MSG-03
    verification:
      - kind: e2e
        ref: "apps/api/src/e2e/mensageria-tempo-real.test.ts#um avisarCrm confirmado chega à aba como data: só com o tipo e os ids, sem o workspaceId"
        status: pass
      - kind: e2e
        ref: "apps/api/src/e2e/mensageria-tempo-real.test.ts#a aba autenticada recebe os cabeçalhos do SSE (com o CORS da origem permitida) e o quadro de abertura"
        status: pass
    human_judgment: false
  - id: D2
    description: "A Mensagem que chega pelo webhook do provedor de teste vira `mensagem.nova` nas duas abas do mesmo Membro em menos de 1000 ms medidos do POST, e a aba de um Membro de outro Espaco nao recebe nada em 1500 ms; a repetida nao avisa de novo"
    requirement: MSG-03
    verification:
      - kind: e2e
        ref: "apps/api/src/e2e/mensageria-tempo-real.test.ts#MSG-03: a Mensagem do webhook chega como mensagem.nova às duas abas do mesmo Membro em menos de 1 s; a do outro Espaço não ouve nada"
        status: pass
      - kind: e2e
        ref: "apps/api/src/e2e/mensageria-tempo-real.test.ts#a Mensagem repetida do provedor não avisa de novo"
        status: pass
    human_judgment: false
  - id: D3
    description: "Os pontos que mudam Mensagem ou Conversa avisam: `POST /mensagens` (`mensagem.nova`), a entrega pelo worker, a falha, o Tentar de novo e o status do provedor (`mensagem.status`, so quando avancou), abrir Conversa (`mensagem.nova`) e resolver/reabrir/atribuir/lixeira/restaurar/mover (`conversa.mudou`)"
    requirement: MSG-03
    verification:
      - kind: e2e
        ref: "apps/api/src/e2e/mensageria-tempo-real.test.ts#POST /mensagens gera mensagem.nova; a entrega pelo worker gera mensagem.status; o status do provedor gera outro"
        status: pass
      - kind: e2e
        ref: "apps/api/src/e2e/mensageria-tempo-real.test.ts#a falha da entrega e o Tentar de novo avisam mensagem.status"
        status: pass
      - kind: e2e
        ref: "apps/api/src/e2e/mensageria-tempo-real.test.ts#os gestos da Conversa (resolver, reabrir, atribuir, lixeira, restaurar, mover) avisam conversa.mudou"
        status: pass
      - kind: e2e
        ref: "apps/api/src/e2e/mensageria-tempo-real.test.ts#abrir uma Conversa (POST /conversas) grava a primeira Mensagem e avisa mensagem.nova"
        status: pass
    human_judgment: false
  - id: D4
    description: "O NOTIFY so chega depois do commit (nada depois do rollback), dois eventos distintos da mesma transacao chegam os dois, o payload so tem as chaves do evento e um evento mal formado lanca"
    requirement: MSG-03
    verification:
      - kind: integration
        ref: "apps/api/src/mensageria/avisar.test.ts"
        status: pass
      - kind: unit
        ref: "packages/dominio/src/crm/eventos.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "O hub entrega so ao Espaco do evento, reconfere o Papel (fecha quem nao le mais), limita 5 fluxos por Membro (o mais antigo cai), encerra todos em `encerrarTodos`/`definirDisponivel(false)`; a rota responde 401/403/503, batida `: batida`, fecha na duracao maxima, e `app.close()` com fluxo aberto termina em menos de 1 s depois de `encerrarTodos()`"
    requirement: MSG-03
    verification:
      - kind: unit
        ref: "apps/api/src/mensageria/hub-de-eventos.test.ts"
        status: pass
      - kind: unit
        ref: "apps/api/src/rotas/eventos.test.ts"
        status: pass
      - kind: unit
        ref: "apps/api/src/seguranca/inventario-de-rotas.test.ts"
        status: pass
    human_judgment: false
  - id: D6
    description: "Em producao, atras do nginx da VM, o evento chega a aba sem ficar preso no buffer e a batida de 25 s segura a conexao abaixo do `proxy_read_timeout` de 120 s; e o `LISTEN/NOTIFY` pelo pooler real (5432, papel `n1_api`)"
    requirement: MSG-03
    verification: []
    human_judgment: true
    rationale: "Depende do nginx da VM e do pooler do Supabase, que so o dono alcanca; provado por `provar-nginx.sh` (16-15) e pela prova ao vivo (16-16). O teste local so mostra o cabecalho `X-Accel-Buffering: no` e a batida."

duration: 22min
completed: 2026-11-09
status: complete
---

# Phase 16 Plan 07: Tempo real da mensageria (LISTEN/NOTIFY + SSE) Summary

**Os servicos avisam por `pg_notify` no mesmo commit, uma conexao `LISTEN` por processo alimenta um hub que filtra por Espaco e Papel, e `GET /eventos` entrega por SSE (`PassThrough`): a Mensagem do webhook chega a duas abas em menos de 1 s localmente e o Espaco de fora nao ouve nada.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-11-09T18:29:00Z
- **Completed:** 2026-11-09T18:51:22Z
- **Tasks:** 3
- **Files modified:** 17 (7 de codigo alterado ou novo na api, 1 novo no dominio, 8 de teste e o `app.ts`/`index.ts`), 1593 linhas inseridas

## Accomplishments

- Dominio: `EventoDoCrm` com os tres tipos (`mensagem.nova`, `mensagem.status`, `conversa.mudou`) e dois leitores que recusam campo a mais, id vazio ou com mais de 64 caracteres; a web e a api leem a mesma forma.
- `avisarCrm` valida pelo dominio e faz `pg_notify` no cliente da transacao: nada chega antes do `commit`, nada depois do `rollback`. E o unico `pg_notify` do `apps/api`.
- Ouvinte `LISTEN` fora do pool (`keepAlive`, sem `query_timeout`, mesmo TLS do pool, reconexao de 1 s a 30 s); cair desliga o hub, que encerra os fluxos, e a rota responde 503 `TEMPO_REAL_INDISPONIVEL` ate voltar.
- `GET /eventos`: cabecalhos do SSE com o CORS preservado, `: aberto`, batida de 25 s, 403 sem poder ler, 503 sem ouvinte, fecha em 45 min, aba lenta cai a 64 KiB; entregue por `reply.send(PassThrough)`.
- Hub: filtra por `workspaceId`, so manda `{ tipo, conversaId, mensagemId? }`, reconfere o Papel a cada 60 s (uma consulta por Membro), no maximo 5 fluxos por Membro, `encerrarTodos` antes do `app.close()`.
- Avisos em todos os pontos: recebida, enviar, abrir Conversa, entregador (enviada e falhou, cada um agora numa transacao propria), status do provedor (so se mudou), Tentar de novo e os seis gestos da Conversa.
- `index.ts`: hub antes do `buildApp`, ouvinte salvo `TEMPO_REAL_ATIVO=false`, e o ouvinte acorda o worker de saida a cada `mensagem.nova`/`mensagem.status`.

## Task Commits

Plano `type: execute`, tarefas `tdd="true"`; Task 1 e o tracador.

1. **Task 1 (tracador), RED** - `eb7e152` (test): e2e do tracador + esqueletos que compilam; 3 falhas por asserção (`expected 503 to be 200`, ouvinte `ouvindo` falso) e 3 do dominio.
2. **Task 1, GREEN** - `b9141ba` (feat): dominio, `avisarCrm`, ouvinte, hub minimo, a rota; e2e 4/4. Tracador reverificado fim a fim (comando do plano em Postgres novo) antes da expansao.
3. **Task 2, RED** - `94cf7ee` (test): 20 testes sem banco; 4 falham por asserção (reconferencia e `maxPorMembro`).
4. **Task 2, GREEN** - `4d6e166` (feat): reconferencia, limite por Membro, a montagem no `index.ts`.
5. **Task 3, RED** - `2aad893` (test): `avisar.test.ts` e o e2e completo; 5 falham no aviso esperado.
6. **Task 3, GREEN** - `54b48ee` (feat): os avisos nos servicos, no entregador e no processador.

**Plan metadata:** commit `docs(16-07)` seguinte (STATE, ROADMAP, REQUIREMENTS).

## Files Created/Modified

- `packages/dominio/src/crm/eventos.ts` - o evento do CRM e os leitores
- `apps/api/src/mensageria/avisar.ts` - `avisarCrm`, `CANAL_DO_NOTIFY`
- `apps/api/src/mensageria/ouvinte-pg.ts` - `criarOuvinteDoCrm`
- `apps/api/src/mensageria/hub-de-eventos.ts` - `criarHubDeEventos`
- `apps/api/src/rotas/eventos.ts` - `GET /eventos`
- `apps/api/src/app.ts` - `OpcoesDoApp.eventos` e o `register` na raiz
- `apps/api/src/index.ts` - hub, ouvinte, desmontagem, `acordarSaida`
- `apps/api/src/servicos/crm/{recebimento,mensagens,conversas}.ts` - os avisos
- `apps/api/src/mensageria/{entregar-mensagem,processador-de-entrada}.ts` - aviso do entregador e do status; `acordarSaida`
- testes: `e2e/mensageria-tempo-real.test.ts` (10), `mensageria/avisar.test.ts` (6), `mensageria/hub-de-eventos.test.ts` (10), `rotas/eventos.test.ts` (10), `crm/eventos.test.ts` do dominio (8)

## Decisions Made

Ver `key-decisions`. O que mais pesa para os proximos planos: o contrato de `GET /eventos` para o 16-08 (o corpo e `data: {"tipo","conversaId","mensagemId?"}` por quadro, o comentario `: aberto` abre e `: batida` segura; 503 `TEMPO_REAL_INDISPONIVEL`, 403 `PERMISSAO`, 401 sem token; o servidor fecha em 45 min e a aba reconecta); `HubDeEventos` expoe `podeLer`; nao existe evento `ressincronizar`: a tela relê tudo ao reconectar.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] `HubDeEventos.podeLer` e o entregador em transacao propria**
- **Found during:** Task 1 (a rota precisa perguntar o Papel sem importar `servicos/crm/acesso`) e Task 3 (`gravarEnvio`/`marcarFalha` rodavam direto no pool, sem transacao onde pendurar o NOTIFY)
- **Issue:** o `<interfaces>` nao expunha `podeLer` no hub; e um `pg_notify` fora de transacao explicita sairia no ato, antes de qualquer garantia.
- **Fix:** `podeLer` repassa a funcao recebida; o entregador abre `begin`/`commit` no cliente do pool (o plano ja previa isto para o entregador), com `rollback` se falhar.
- **Files modified:** `apps/api/src/mensageria/hub-de-eventos.ts`, `apps/api/src/mensageria/entregar-mensagem.ts`
- **Verification:** `hub-de-eventos.test.ts`, `entregar-mensagem.test.ts` (verde na rodada ampla), e2e `a falha da entrega e o Tentar de novo`
- **Committed in:** `b9141ba`, `54b48ee`

**2. [Rule 2 - Missing Critical] Aba lenta e ouvinte sem `DATABASE_URL`**
- **Found during:** Task 1
- **Issue:** uma aba que para de ler faria o buffer do `PassThrough` crescer sem fim (T-16-26); e o ouvinte sem `DATABASE_URL` derrubaria o boot de dev.
- **Fix:** o fluxo cai quando passa de 64 KiB parados; sem URL, o ouvinte loga e nao inicia (hub indisponivel, rota 503).
- **Files modified:** `apps/api/src/rotas/eventos.ts`, `apps/api/src/mensageria/ouvinte-pg.ts`
- **Committed in:** `b9141ba`

**3. [Rule 1 - Bug] O ouvinte acorda a saida tambem em `mensagem.status`, e o processador acorda ao reenfileirar**
- **Found during:** Task 3
- **Issue:** o plano acorda a saida so em `mensagem.nova`; o `reenviar` (Tentar de novo) so produz `mensagem.status` e o Canal que volta a `conectada` por evento `conexao` reenfileira sem avisar: as duas esperariam os 5 s de reserva (a nota do 16-06 pedia `acordadores.saida()` nesses pontos).
- **Fix:** `mensagem.status` tambem acorda a saida (barato e idempotente: `acordar()` e seguro repetido); `aplicarConexao` chama `acordarSaida` depois do commit que reenfileirou.
- **Files modified:** `apps/api/src/index.ts`, `apps/api/src/mensageria/processador-de-entrada.ts`
- **Committed in:** `4d6e166`, `54b48ee`

### Decisoes do planejador que o plano deixou abertas

- `mover` avisa tambem a Conversa que `resolverExistente` resolve.
- `aplicarConexao` nao emite evento ao tela (nenhum dos tres tipos cabe sem Conversa).

---

**Total deviations:** 3 auto-fixed (2 Rule 2, 1 Rule 1)
**Impact on plan:** nenhuma muda o contrato publico do `<interfaces>` alem de `HubDeEventos.podeLer` (acrescimo) e de `OpcoesDoProcessadorDeEntrada.acordarSaida` (opcional). Sem scope creep.

## TDD Gate Compliance

O plano e `type: execute` e `workflow.tdd_mode` e `false`, entao nao usei `gsd_run check tdd-red-evidence`; a avaliacao semantica foi manual (o alvo executou e falhou na asserção planejada, nunca por import ou sintaxe).

- **Task 1 (tracador):** RED `eb7e152`: contra os esqueletos, `o ouvinte LISTEN fica de pe` falhou em `expected false to be true`, os dois testes de aba em `expected 503 to be 200`/quadro ausente, e 3 de 8 do dominio em `undefined`; o teste de 401 passou por construcao. GREEN `b9141ba`: 4/4 e 8/8. Tracador reverificado: o comando `<automated>` do plano, num Postgres novo, passou e a execucao seguiu para a expansao (sem `blocking-human` e sem `<human-check>`, `human_verify_mode` `end-of-phase`).
- **Task 2:** RED `94cf7ee`: 4 de 20 falham por asserção (`fechar` nao chamado na reconferencia, 2 de `maxPorMembro`, `podeLer` que lanca nao reconsultado). Os 16 restantes (rota inteira, isolamento por Espaco, `encerrarTodos`) **nasceram verdes por construcao**: a rota, a duracao maxima, a limpeza idempotente e o hub minimo ja existiam desde o tracador, que precisava terminar o fluxo e filtrar por Espaco. GREEN `4d6e166`.
- **Task 3:** RED `2aad893`: 5 de 6 do e2e novo falham no aviso esperado (`expected undefined to be defined`, `resolver: expected +0 to be 1`); `avisar.test.ts` (6) e o teste da repetida passaram por construcao (o contrato do NOTIFY ja era da Task 1; a repetida nunca avisou). GREEN `54b48ee`: 16/16.
- **REFACTOR:** nao houve.

## Issues Encountered

- Duas contagens dos criterios de aceite estouraram por comentario e foram ajustadas: `x-accel-buffering` aparecia em minusculo no cabecalho de `rotas/eventos.ts` (passou a `X-Accel-Buffering`, no codigo continua em minusculo uma vez) e `zod` aparecia num comentario do dominio.
- `sed -i` do macOS nao aceita o formato do Linux; as trocas foram feitas por `python3`.
- Nada falhou nas rodadas amplas; 2 arquivos pulados (`dois-servicos.test.ts` e `integracao-solicitacoes.test.ts`, dependem de Storage real e sao anteriores a esta fase).

## Verification Run

- Postgres 16 em Docker (`crm-n1-pg-1607`, porta 55722), `npm run --silent migrar` ate `013-mensageria.sql`, conteiner removido no fim:
  - `avisar.test.ts` 6, `e2e/mensageria-tempo-real.test.ts` 10, `e2e/mensageria.test.ts`, `servicos/crm/conversas.test.ts`, `servicos/crm/recebimento.test.ts`: 5 arquivos, 95 testes passando (comando `<automated>` da Task 3 verbatim).
  - Rodada ampla `src/mensageria src/servicos src/rotas src/e2e src/repositorios src/seguranca` + `outbox.test.ts`, `outbox-worker.test.ts`, `migracao-013.test.ts`: 116 arquivos passando, 2 pulados (Storage, anteriores), 1514 testes passando, nenhuma falha (3 min).
- Sem banco (`DATABASE_URL=`): `hub-de-eventos.test.ts` 10, `rotas/eventos.test.ts` 10, `seguranca/inventario-de-rotas.test.ts` 7 = 27 passando (inventario: `GET /eventos` exige JWT, coberto sem editar o arquivo).
- Dominio inteiro: 131 arquivos, 2423 testes passando; `crm/eventos.test.ts` 8.
- `npx tsc --noEmit` em `apps/api` e em `packages/dominio`: ok. `apps/web` nao foi tocado.
- Criterios de aceite: `pg_notify` em `avisar.ts` 3; `x-accel-buffering` na rota 1; `PassThrough` 3; `hijack` fora de comentario 0; `publica: true` 0; `from "../`/`zod` no dominio 0; `TEMPO_REAL_ATIVO` e `hub.encerrarTodos` no `index.ts` presentes; `maxPorMembro|reconferirMs` no hub 7; `avisarCrm` em `conversas.ts` 3, `recebimento.ts` 3, `entregar-mensagem.ts` 3; `pg_notify` fora de `mensageria/avisar` e de testes 0.
- Nao rodei `npm run check` inteiro (13-17 min), conforme o plano.

## Known Stubs

None.

## Threat Flags

None. T-16-24 (hub filtra por `workspaceId`; teste com dois Espaços no hub e no e2e), T-16-25 (Papel reconferido, fluxo fecha em 45 min, 403 na abertura), T-16-26 (5 por Membro, handler sem I/O, batida, 64 KiB), T-16-27 (so tipo e ids; `workspaceId` nao sai) e T-16-28 (`encerrarTodos` antes do `close()`, medido em menos de 1 s) estao cobertos; T-16-SC: nenhum pacote novo.

## User Setup Required

None - no external service configuration required. A variavel `TEMPO_REAL_ATIVO` (padrao ligado; `false` desliga o ouvinte e a rota responde 503) nao precisa ser definida.

## Next Phase Readiness

- 16-08 (tela): `GET /eventos` com `Authorization: Bearer` por `fetch` (nao `EventSource`); o quadro e `data: {"tipo":"mensagem.nova|mensagem.status|conversa.mudou","conversaId":"...","mensagemId":"..."?}`; `: aberto` e `: batida` sao comentarios. Reconectar com espera crescente e reler tudo ao reconectar (as notificacoes do intervalo se perdem); sem conexao, releitura de 5 s. Em 503 `TEMPO_REAL_INDISPONIVEL` cair na releitura. `conversa.mudou` nao leva `mensagemId`.
- Fora de alcance deste plano, e por isso SEM aviso: `POST /contatos/:id/mesclar` e a sucessao do Membro (movem ou liberam Conversas), `PUT /conversas/:id/marcacao` (estrela e leitura por Membro), a troca de Canal e o vinculo de Negocio da Tarefa conversacional, e `simularConexao` (so reenfileira; a saida espera os 5 s de reserva). A tela cobre todos pela releitura de 5 s.
- 16-14/16-15/16-16: o pressuposto A9 (o pooler 5432 com `n1_api` entrega `LISTEN/NOTIFY`) e o `X-Accel-Buffering` atras do nginx so o dono prova. Com `DATABASE_SSL_INSECURE` ou sem CA, `construirSsl` lanca ao subir o ouvinte (o laco termina com `error` no log e o hub fica indisponivel).
- Documentacao devida (arquivos fora dos `files_modified` do plano, para o 16-14): `apps/api/src/mensageria/CONTEXT.md` (as linhas `avisar, ouvinte, hub de eventos`: o contrato do NOTIFY, o ouvinte que cai e reconecta, o hub e seus limites, `acordarSaida`); `apps/api/src/rotas/CONTEXT.md` (`GET /eventos`: SSE, JWT, 503/403, batida, 45 min); `apps/api/src/persistencia/CONTEXT.md` (o `avisarCrm` no mesmo commit dos serviços do CRM e do entregador); `apps/api/.env.example` (`TEMPO_REAL_ATIVO`) e a unidade systemd (o ouvinte soma 1 conexao ao orcamento do pool de 10).

## Self-Check: PASSED

- Os 10 arquivos novos existem (cinco de codigo, cinco de teste) e os 7 modificados constam de `git diff --stat`.
- Commits na branch: `eb7e152`, `b9141ba`, `94cf7ee`, `4d6e166`, `2aad893`, `54b48ee`.

---
*Phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia*
*Completed: 2026-11-09*
