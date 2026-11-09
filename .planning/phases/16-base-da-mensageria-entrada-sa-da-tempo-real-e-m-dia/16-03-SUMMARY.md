---
phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia
plan: 03
subsystem: api
tags: [mensageria, webhook, fila-de-entrada, postgres, fastify, migracao, vitest, tdd]

requires:
  - phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia
    provides: "`receberMensagem` idempotente por (Canal, idExterno) e as recusas 4xx com `codigo` (16-01)"
  - phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia
    provides: "`ProvedorDeMensageria`, `provedorDoCanal`/`canalParaProvedor`, `CABECALHO_DO_SEGREDO`, provedor de teste e segredo do Canal no cofre (16-02)"
provides:
  - "migracao `013-mensageria.sql`: `plataforma.webhooks_recebidos` (fila de entrada) e o indice unico `integration_outbox_mensagem_enviar_uniq`"
  - "`POST /webhooks/mensageria/:canalId` publica: chamada verificada -> uma linha `pendente`, 200 na hora, acorda o processador"
  - "`criarProcessadorDeEntrada` (`iniciar`, `parar`, `processarUm`, `acordar`) ligado por `MENSAGERIA_WORKER_ATIVO`"
  - "`OpcoesDoApp.webhooksDeMensageria` e a rota publica no inventario de rotas"
affects: [16-04, 16-05, 16-07, 16-09, 16-10, 16-11, 16-12]

actuals:
  tokens: 18500
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "fila de entrada em tabela com reivindicacao `for update skip locked`, trava vencida devolvida a pendente e backoff, no molde do outbox"
    - "rota publica com a mesma 401 para toda causa de recusa e uma comparacao em tempo constante contra um valor de sombra em cada recusa"
    - "acordador por referencia (`acordadores.entrada`) para a rota, criada em `buildApp`, chamar um processador criado depois"
    - "ciclo unico com `pedirOutraVolta`: `acordar()` durante um ciclo em voo pede mais uma volta em vez de abrir outro ciclo"

key-files:
  created:
    - apps/api/migracoes/013-mensageria.sql
    - apps/api/src/persistencia/migracao-013.test.ts
    - apps/api/src/rotas/webhooks-de-mensageria.ts
    - apps/api/src/rotas/webhooks-de-mensageria.test.ts
    - apps/api/src/mensageria/processador-de-entrada.ts
    - apps/api/src/mensageria/processador-de-entrada.test.ts
    - apps/api/src/e2e/mensageria-entrada.test.ts
  modified:
    - apps/api/src/app.ts
    - apps/api/src/index.ts
    - apps/api/src/testes/banco-crm.ts
    - apps/api/src/seguranca/inventario-de-rotas.test.ts
    - apps/api/src/persistencia/CONTEXT.md

key-decisions:
  - "A 013 ja cria o indice unico do `mensagem.enviar.v1` (3.7.1) para a fase ter uma migracao so; `webhooks_recebidos` ganha `chave`, `disponivel_em`, `resultado`, `processado_em` e FK `(workspace_id, canal_id)` para `canais`."
  - "O teto por IP (300/min, 429) fica na API, no `onRequest` da rota, antes do corpo e de qualquer consulta, e nao no nginx: nao exige edicao manual do dono e nao derruba a rajada legitima da Evolution."
  - "Recusa 4xx do recebimento (Canal arquivado, valor invalido) e permanente: `falhou` com o `codigo` em `ultimo_erro`. Excecao (banco, cofre, provedor indisponivel) e transitoria: volta a `pendente` com `backoff()` ate 8 tentativas."
  - "Canal arquivado depois da chamada e recusado pelo processador sem passar pelo registro (um Canal arquivado nunca e simulado, entao `provedorDoCanal` lancaria `PROVEDOR_INDISPONIVEL` e a linha voltaria a tentar para sempre)."
  - "Falha do banco na rota, depois da verificacao, sobe como 500 (o provedor reenvia); so provedor indisponivel e cofre que nao decifra viram a 401 uniforme."
  - "Eventos `status` e `conexao` ficam `processado` com `resultado = \"sem_tratamento:<tipo>\"`; o 16-05 os trata."

patterns-established:
  - "Rota publica de provedor: plugin irmao do da Meta, parser de corpo cru encapsulado, `publica: true` so nela, motivo escrito no inventario de rotas."
  - "Nada de corpo, cabecalho, telefone ou segredo em log: `registrar` do processador so leva id da linha, contagens e codigos."

requirements-completed: [MSG-01, MSG-05]

coverage:
  - id: D1
    description: "Chamada verificada do provedor de teste ao webhook do Canal vira uma linha pendente e, pelo processador, Contato automatico_mensagem, Conversa aberta e Mensagem recebida, uma vez so"
    requirement: MSG-01
    verification:
      - kind: e2e
        ref: "apps/api/src/e2e/mensageria-entrada.test.ts#com o segredo do Canal: 200, uma linha pendente do provedor de teste; o processador cria Contato, Conversa e Mensagem"
        status: pass
    human_judgment: false
  - id: D2
    description: "Canal inexistente, arquivado, real sem provedor, sem segredo, segredo errado, sem cabecalho e id de Canal em dois Espacos recebem a mesma 401 sem gravar nada"
    requirement: MSG-01
    verification:
      - kind: integration
        ref: "apps/api/src/rotas/webhooks-de-mensageria.test.ts#Canal inexistente, arquivado, real sem provedor, sem segredo, segredo errado e sem cabecalho: a mesma 401 e nada gravado"
        status: pass
      - kind: integration
        ref: "apps/api/src/rotas/webhooks-de-mensageria.test.ts#o mesmo id de Canal em dois Espacos: 401, mesmo com o segredo certo"
        status: pass
    human_judgment: false
  - id: D3
    description: "Teto por IP responde 429 antes de qualquer consulta; corpo de 3 MiB da 413 e JSON invalido 400; apikey do topo nao e guardada; a mesma chamada duas vezes grava uma linha; o acordador roda so depois do 200"
    requirement: MSG-01
    verification:
      - kind: integration
        ref: "apps/api/src/rotas/webhooks-de-mensageria.test.ts (7 testes)"
        status: pass
    human_judgment: false
  - id: D4
    description: "O processador devolve a trava vencida a pendente (Mensagem uma vez so), tenta de novo com espera e desiste na 8a, trata a recusa 4xx como permanente, grava o motivo de ignorado/sem tratamento e acorda sem dois ciclos juntos"
    requirement: MSG-01
    verification:
      - kind: integration
        ref: "apps/api/src/mensageria/processador-de-entrada.test.ts (9 testes)"
        status: pass
    human_judgment: false
  - id: D5
    description: "A 013: restricoes com nome, indice unico do mensagem.enviar.v1, idempotencia, falha no fim sem deixar registro, RLS desligada, sem grant, registros intacto"
    requirement: MSG-01
    verification:
      - kind: integration
        ref: "apps/api/src/persistencia/migracao-013.test.ts (6 testes)"
        status: pass
      - kind: other
        ref: "npm run migrar num Postgres 16 novo de Docker lista `aplicada  013-mensageria.sql`"
        status: pass
    human_judgment: false
  - id: D6
    description: "Rota publica declarada no inventario com motivo; webhook-meta.ts e as migracoes 001-012 sem diff"
    requirement: MSG-01
    verification:
      - kind: unit
        ref: "apps/api/src/seguranca/inventario-de-rotas.test.ts#as rotas sem JWT sao exatamente ROTAS_PUBLICAS (e todas tem motivo)"
        status: pass
    human_judgment: false

plan_head_before: c753943891dc38befeaf82fc7875f86553cc0638
plan_head_after: 1edc97e5fa2e140df35f8846614497dcf4584d5c

duration: 9min
completed: 2026-11-09
status: complete
---

# Phase 16 Plan 03: A porta de entrada da mensageria Summary

**Migracao 013 com a fila `webhooks_recebidos`, rota publica `POST /webhooks/mensageria/:canalId` (mesma 401 para toda recusa, teto por IP, `apikey` fora do corpo guardado) e processador de entrada com `for update skip locked`, trava vencida, backoff e acordar pela rota, ligado por `MENSAGERIA_WORKER_ATIVO`.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-11-09T17:26:05Z
- **Completed:** 2026-11-09T17:35:00Z
- **Tasks:** 3
- **Files modified:** 12 (7 criados, 5 alterados)

## Accomplishments

- `013-mensageria.sql`: `plataforma.webhooks_recebidos` (estados, `chave` unica parcial por Canal, `disponivel_em`, `resultado`, FK para `canais`, dois indices da fila) e `integration_outbox_mensagem_enviar_uniq`; transacional, idempotente, com o bloco que desliga a RLS e sem `grant`. Aplicada so no Postgres de Docker (porta 55718).
- Rota publica: acha o Canal so pelo `id`, resolve o provedor pelo Canal, verifica e grava uma linha `pendente` (`on conflict ... do nothing` pela `chave`); 200 na hora e `acordarProcessador()` depois. Canal inexistente, ambiguo entre Espacos, arquivado, sem segredo, sem provedor ou segredo errado: a mesma 401 (`{ ok: false, error: "Nao autorizado." }`).
- Teto por IP de 300/min no `onRequest` (429 antes de corpo e consulta), `bodyLimit` de 2 MiB (413), JSON invalido 400, `apikey` do topo retirada antes do `insert`; nenhum log de corpo, cabecalho ou segredo.
- Processador de entrada: reivindica por `for update skip locked`, devolve a trava vencida (2 min) a `pendente` (ou a `falhou/TRAVA_VENCIDA` ao esgotar as tentativas), recusa 4xx permanente com o codigo, excecao com `backoff()` e erro saneado ate a 8a, `resultado` com `ignorado:<motivo>` / `sem_tratamento:<tipo>`, `acordar()` com ciclo unico.
- `index.ts` liga o processador por `MENSAGERIA_WORKER_ATIVO=true` (e `MENSAGERIA_WORKER_ID`) e o acordador da rota por referencia; `inventario-de-rotas` ganha a rota com o motivo; `persistencia/CONTEXT.md` ganha o paragrafo da 013.

## Task Commits

1. **Task 1 (tracador), RED** - `0155aaf` (test): 013, rota e processador como esqueletos, e2e com 2 falhas por assercao (501 no lugar de 401/200).
2. **Task 1, GREEN** - `399f9c2` (feat): rota (verifica e grava) e processador (reivindica, chama `receberMensagem`); e2e 2 passando.
3. **Task 2, RED** - `b7e8775` (test): 9 testes do processador, 8 falhando, 1 passando por construcao.
4. **Task 2, GREEN** - `cc9d70d` (feat): trava vencida, retry, recusa permanente, `resultado`, ciclo unico, `index.ts`.
5. **Task 3, RED** - `a943775` (test): 7 testes da rota (2 falham: 429 e `apikey`) e 6 da 013.
6. **Task 3, GREEN** - `1edc97e` (feat): teto por IP, comparacao de sombra, `apikey` fora, inventario de rotas e CONTEXT.

**Plan metadata:** commit `docs(16-03)` seguinte (SUMMARY, STATE, ROADMAP, REQUIREMENTS).

## Files Created/Modified

- `apps/api/migracoes/013-mensageria.sql` - fila de entrada e indice unico do `mensagem.enviar.v1`
- `apps/api/src/rotas/webhooks-de-mensageria.ts` (+ `.test.ts`, 7 testes) - `rotasDeWebhooksDeMensageria`, `OpcoesDeWebhooksDeMensageria`
- `apps/api/src/mensageria/processador-de-entrada.ts` (+ `.test.ts`, 9 testes) - `criarProcessadorDeEntrada`
- `apps/api/src/persistencia/migracao-013.test.ts` - 6 testes (5 com banco descartavel `m013_<8>`, 1 sem banco)
- `apps/api/src/e2e/mensageria-entrada.test.ts` - 2 testes ponta a ponta
- `apps/api/src/app.ts` - `OpcoesDoApp.webhooksDeMensageria` e o `register` ao lado do da Meta
- `apps/api/src/index.ts` - acordador por referencia e o bloco `MENSAGERIA_WORKER_ATIVO`
- `apps/api/src/testes/banco-crm.ts` - `webhooks_recebidos` em `limparEspaco` antes de `canais`
- `apps/api/src/seguranca/inventario-de-rotas.test.ts` - a rota publica com o motivo
- `apps/api/src/persistencia/CONTEXT.md` - a 013

## Decisions Made

Ver `key-decisions`. Em resumo: o teto por IP fica na API; recusa de regra e permanente e excecao e transitoria; Canal arquivado nao passa pelo registro; falha de banco na rota e 500 (o provedor reenvia), nao 401.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Trava vencida de linha que ja gastou as tentativas vira `falhou`, nao `pendente`**
- **Found during:** Task 2
- **Issue:** o plano manda devolver toda trava vencida a `pendente`. Uma linha cujo corpo derruba o processo (a queda mata o worker antes de qualquer `marcar*`) seria reivindicada e travaria de novo para sempre, porque o contador so e conferido no caminho de excecao.
- **Fix:** antes de devolver, as travas vencidas com `tentativas >= maxTentativas` viram `falhou` com `ultimo_erro = 'TRAVA_VENCIDA'`; as demais voltam a `pendente`.
- **Files modified:** `apps/api/src/mensageria/processador-de-entrada.ts`, `processador-de-entrada.test.ts` (teste proprio)
- **Verification:** `processador-de-entrada.test.ts#a trava vencida de uma linha que ja gastou as tentativas vira falhou`
- **Committed in:** `cc9d70d`

**2. [Rule 1 - Bug] Canal arquivado depois da chamada nunca chegaria a `receberMensagem`**
- **Found during:** Task 2
- **Issue:** um Canal arquivado e sempre desconectado e portanto nao simulado (008); `provedorDoCanal` lancaria `PROVEDOR_INDISPONIVEL` e a linha ficaria em retentativa ate a 8a, em vez de `falhou/CANAL_ARQUIVADO`, que e o que o plano espera.
- **Fix:** o processador confere `canal.estado === "arquivado"` antes do registro e marca `falhou` com `CANAL_ARQUIVADO`. A recusa 409 vinda do proprio `receberMensagem` tambem e testada (servico falso).
- **Files modified:** `apps/api/src/mensageria/processador-de-entrada.ts`
- **Verification:** `processador-de-entrada.test.ts#Canal arquivado depois da chamada` e `#recusa de regra do recebimento (409 CANAL_ARQUIVADO)`
- **Committed in:** `cc9d70d`

**3. [Rule 1 - Bug] Falha do banco na rota nao pode virar 401**
- **Found during:** Task 1
- **Issue:** colocar o `insert` dentro do `try` que traduz erro de provedor em 401 faria o provedor achar que o segredo esta errado e nao reenviar uma chamada verificada que so nao foi gravada.
- **Fix:** o `try` cobre so o cofre, o registro e a verificacao; o `insert` fica fora e sobe como 500.
- **Files modified:** `apps/api/src/rotas/webhooks-de-mensageria.ts`
- **Committed in:** `399f9c2`

**4. [Rule 3 - Blocking] `inventario-de-rotas.test.ts` ficou vermelho entre a Task 1 e a Task 3**
- **Found during:** Task 3 (RED)
- **Issue:** registrar a rota publica na Task 1 (como o plano manda) quebra `as rotas sem JWT sao exatamente ROTAS_PUBLICAS`, que so e atualizado na Task 3. Nenhum commit intermediario do plano e verde nesse teste.
- **Fix:** nenhum: a entrada foi adicionada na Task 3 como planejado; registrado aqui para quem bisecar.
- **Committed in:** `1edc97e`

---

**Total deviations:** 4 (2 Rule 1, 1 Rule 2, 1 Rule 3 so de ordenacao)
**Impact on plan:** nenhuma muda o contrato do `<interfaces>`. Sem scope creep; a 1 e a 2 protegem o processador de retentativa infinita, a 3 a retentativa do provedor.

## TDD Gate Compliance

- **Task 1 (tracador):** RED `0155aaf`: 013, rota (501) e processador (sempre `false`) como esqueletos; os 2 testes do e2e falharam por asserção (`expected 501 to be 401` e `expected 501 to be 200`), com o Postgres rodando e a 013 aplicada. GREEN `399f9c2`: 2 passando. O plano e `type: execute` e `workflow.tdd_mode` e `false`, entao nao usei `gsd_run check tdd-red-evidence`; a avaliacao semantica foi manual (o alvo executou e falhou na asserção planejada).
- **Task 2:** RED `b7e8775`: 8 de 9 falham contra o processador simples da Task 1 (7 por asserção, 1 pela excecao nao tratada do provedor que lanca, que e o comportamento a corrigir; o 9o, "trava recente nao e tomada", ja era verdade por construcao). GREEN `cc9d70d`: 9 passando.
- **Task 3:** RED `a943775`: 2 de 7 falham na rota (`expected 200 to be 429`, `apikey` guardada); os outros 5 (mesma 401, dois Espaços, 413/400, dedup, acordador) passaram de primeira porque a verificacao e a deduplicacao ja estavam na Task 1 e o 413 e o 400 sao do Fastify. `migracao-013.test.ts` (6) passa de primeira por construcao: a 013 ja existia desde a Task 1. O `inventario-de-rotas` ja estava vermelho (desvio 4). GREEN `1edc97e`.
- **REFACTOR:** nao houve.

## Issues Encountered

- O primeiro rascunho do teste da rota semeou dois Canais com o mesmo nome (`canais_nome_uq`, RN-CXE-31); cada Canal passou a levar nome e numero proprios.
- O teste (b) da migracao contava as restricoes sem a `webhooks_recebidos_pkey`; a expectativa foi corrigida.
- `timeout` nao existe no macOS desta maquina; a rodada do subconjunto sem banco usou o proprio vitest.

## Verification Run

- Postgres 16 em Docker (`crm-n1-pg-1603`, porta 55718), `npm run --silent migrar` num banco novo (lista `aplicada  013-mensageria.sql`), contêiner removido no fim:
  - `src/e2e/mensageria-entrada.test.ts`, `src/mensageria`, `src/bootstrap/canal-segredo-de-teste.test.ts`, `src/rotas/webhooks-de-mensageria.test.ts`, `src/persistencia/migracao-013.test.ts`, `src/persistencia/migrar-seco.test.ts`, `src/seguranca/banco-n1-api.test.ts`, `src/servicos/crm/recebimento.test.ts`, `src/e2e/canais-fluxo.test.ts`: 11 arquivos, 103 testes passando, nenhum pulado.
  - Por tarefa: e2e 2; `processador-de-entrada.test.ts` 9; `webhooks-de-mensageria.test.ts` 7; `migracao-013.test.ts` 6.
- Sem banco (`DATABASE_URL=`): `inventario-de-rotas.test.ts` + `webhook-meta.test.ts` 26 passando; `src/seguranca src/rotas src/app.test.ts src/sem-*`: 63 arquivos passando, 267 testes de banco pulados por falta de `DATABASE_URL` (esperado nesse modo).
- `npx tsc --noEmit` em `apps/api`: ok.
- Criterios de aceite: `disable row level security` 1; `grant ` fora de comentario 0; `integration_outbox_mensagem_enviar_uniq` 2; `publica: true` 3; `skip locked` 2; `MENSAGERIA_WORKER_ATIVO` 3; `processador.parar` 1; `locked_at <` 2; `registrar` com corpo/conteudo/cargaBruta/segredo 0; rota no inventario 1; `criarLimiteDeTaxa` 3; log com corpo/headers/cabecalhos/segredo 0; `013` no CONTEXT 2; `git diff` das migracoes 001-012 e de `webhook-meta.ts` vazio.
- Nao rodei `npm run check` inteiro (13-17 min), conforme o plano.

## Known Stubs

None.

## Threat Flags

None. A superficie nova (rota publica, fila com dado pessoal, processador) esta coberta por T-16-07 (segredo do Canal no cofre, tempo constante), T-16-08 (mesma 401, sombra, ambiguo e 401), T-16-09 (teto por IP antes do banco, 413), T-16-10 (`apikey` fora, sem log de corpo, `ultimo_erro` saneado), T-16-11 (`webhooks_recebidos_chave_uq`, `receberMensagem` idempotente, trava vencida volta uma vez), T-16-12 (plugin irmao, `publica: true` so nele, inventario) e T-16-SC (nenhum pacote novo).

## User Setup Required

None - no external service configuration required. Para ligar em producao (so quando o dono mandar): a 013 (backup do schema `plataforma`, `npm run migrar -w @n1/api -- --seco`, publicar, `npm run banco:conceder -w @n1/api`), `MENSAGERIA_WORKER_ATIVO=true` e `COFRE_CHAVE` no `api.env`. `.env.example` ainda nao cita `MENSAGERIA_WORKER_ATIVO` nem `MENSAGERIA_WORKER_ID` (fora do `files_modified` deste plano).

## Next Phase Readiness

- 16-04/16-05: o evento `status` e o `conexao` chegam ao processador e ficam `processado` com `resultado = "sem_tratamento:status"`/`"sem_tratamento:conexao"`; o ponto de troca e o `else` final do laco de eventos em `processar()`.
- 16-11/16-12: ao registrar a Evolution em `porProvedor`, a rota ja a resolve por Canal (`provedorDoCanal`) e o `apikey` do topo do corpo ja e retirado antes de guardar; `chaveDaChamada` do provedor define a deduplicacao (sem ela a linha nao deduplica na rota e so o `idExterno` protege no recebimento).
- 16-07: `receberMensagem` nao sobe a revisao do Espaco; o aviso a tela e o SSE. O processador tem um `registrar` e nenhum gancho de evento ainda: o 16-07 liga o aviso depois de `receberMensagem` (dentro de `processar()`).
- `limparEspaco` agora apaga `webhooks_recebidos` antes de `canais`; teste que semeia credencial de Canal ainda apaga `plataforma.credenciais` por conta propria.
- O limite por IP e em memoria (por processo), como o do Formulario publico, e as marcas por IP nunca sao podadas fora da janela de quem volta: aceitavel com um processo atras do nginx.

## Self-Check: PASSED

- Arquivos criados existem: `013-mensageria.sql`, `migracao-013.test.ts`, `webhooks-de-mensageria.ts`, `webhooks-de-mensageria.test.ts`, `processador-de-entrada.ts`, `processador-de-entrada.test.ts`, `mensageria-entrada.test.ts`.
- Commits na branch: `0155aaf`, `399f9c2`, `b7e8775`, `cc9d70d`, `a943775`, `1edc97e`.

---
*Phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia*
*Completed: 2026-11-09*
