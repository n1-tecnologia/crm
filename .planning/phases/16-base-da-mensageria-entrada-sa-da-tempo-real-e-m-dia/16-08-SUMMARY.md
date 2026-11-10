---
phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia
plan: 08
subsystem: web
tags: [mensageria, tempo-real, sse, fetch, swr, reconexao, vitest, tdd]

requires:
  - phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia
    provides: "`GET /eventos` (SSE, JWT em `Authorization: Bearer`), `lerEventoParaATela` e `EventoParaATela` de `@n1/dominio/crm/eventos` (16-07)"
provides:
  - "`apps/web/src/dados/tempo-real.ts`: `lerQuadrosSse`, `chavesDoEvento`, `chavesDosEventos`, `criarConexaoDoTempoReal`, `AcompanhanteDoTempoReal`, `CHAVES_DE_BASE` e as constantes de tempo"
  - "`invalidarCrmComArrays(prefixo)` em `dados/crm/cliente-crm.ts`: revalida chave de texto E chave array pelo primeiro item"
  - "`AcompanhanteDoTempoReal` montado no `StoreProvider` ao lado do `AcompanhanteDaRevisao`"
affects: [16-11, 16-14, 16-16]

actuals:
  tokens: 8000
  tasks: 2
  commits: 4
plan_head_before: b9afa7b5be066305dc3db2c247d58369165b5139
plan_head_after: f4b8496cddf8a45c2dd79ea054331b92e4c7f4bf

tech-stack:
  added: []
  patterns:
    - "o tempo real da tela e `fetch` com `Authorization: Bearer` + `getReader`/`TextDecoder`, nunca `EventSource` (que nao manda cabecalho)"
    - "um evento so revalida chaves SWR (fio, lista, resumo); sem toast, som nem titulo da aba (D-16-02)"
    - "o servidor nao reenvia o que se perdeu: a tela relê tudo a cada conexao aberta e a cada 5 s sem conexao"
    - "o acompanhante so conecta fora do Vitest (`ativo` com padrao `NODE_ENV !== \"test\"`), para os testes de tela que contam `fetch` nao verem um `GET /eventos` a mais"

key-files:
  created:
    - apps/web/src/dados/tempo-real.ts
    - apps/web/src/dados/tempo-real.test.ts
  modified:
    - apps/web/src/dados/crm/cliente-crm.ts
    - apps/web/src/dados/crm/cliente-crm.test.ts
    - apps/web/src/dados/store.ts

key-decisions:
  - "`OpcoesDaConexao` ganhou `aoReler()` alem de `aoAbrir`/`aoCair`: quem religa a releitura de 5 s e o proprio modulo da conexao, e ela precisa chamar a revalidacao das chaves de base sem conhecer o SWR; o acompanhante liga `aoReler` a `invalidarCrmComArrays` de `CHAVES_DE_BASE`."
  - "`aoCair` avisa uma vez por episodio de queda (a primeira falha), nao a cada tentativa que falha em seguida; `aoAbrir` encerra o episodio."
  - "Um unico `AbortController` por conexao (nao por tentativa): `parar()` aborta o `fetch` em voo e qualquer tentativa agendada ja nasce parada."
  - "`aoAbrir` dispara no primeiro pedaco do corpo (o `: aberto` que o servidor manda ao abrir), nao no cabecalho da resposta."
  - "`chavesDoEvento` usa `URLSearchParams` para `conversaId`, igual a `chaveDasMensagens`; a chave de prefixo `/mensagens?conversaId=c1` tambem casa `c10...` (revalida a mais, nunca a menos)."

patterns-established:
  - "Componente de efeito colateral montado no `StoreProvider` recebe `ativo` com padrao desligado sob `NODE_ENV === \"test\"` quando um `fetch` novo quebraria a contagem de pedidos dos testes de tela."

requirements-completed: [MSG-03]

coverage:
  - id: D1
    description: "Um `mensagem.nova` no fluxo revalida o fio da Conversa (`/mensagens?conversaId=<id>`), a lista (`/conversas`) e o resumo das Tarefas (`/tarefas-conversacionais/resumo`, inclusive a chave array), com o token so no cabecalho `authorization` para `${NEXT_PUBLIC_API_URL}/eventos`; `mensagem.status` e `conversa.mudou` revalidam o subconjunto do D-16-02"
    requirement: MSG-03
    verification:
      - kind: unit
        ref: "apps/web/src/dados/tempo-real.test.ts#AcompanhanteDoTempoReal (traçador) > um mensagem.nova no fluxo revalida o fio da Conversa, a lista da Caixa e o resumo das Tarefas, com o token só no cabeçalho"
        status: pass
      - kind: unit
        ref: "apps/web/src/dados/tempo-real.test.ts#chavesDoEvento (D-16-02)"
        status: pass
      - kind: unit
        ref: "apps/web/src/dados/crm/cliente-crm.test.ts#invalidarCrmComArrays (16-08, Pitfall 4)"
        status: pass
    human_judgment: false
  - id: D2
    description: "O leitor SSE junta pedacos, deixa o quadro cortado no resto, ignora comentario, JSON invalido e evento com campo a mais"
    requirement: MSG-03
    verification:
      - kind: unit
        ref: "apps/web/src/dados/tempo-real.test.ts#lerQuadrosSse"
        status: pass
    human_judgment: false
  - id: D3
    description: "Cai (rede, 503, 401, sem token, fim do fluxo): releitura a cada 5 s e nova tentativa em 1, 2, 4, 8, 16, 30 e 30 s; 401 pega o token renovado; abre: releitura completa uma vez, releitura de 5 s para e a espera volta a 1 s; dez eventos em 100 ms viram uma rodada so; `parar()` aborta o fetch e zera os temporizadores"
    requirement: MSG-03
    verification:
      - kind: unit
        ref: "apps/web/src/dados/tempo-real.test.ts#criarConexaoDoTempoReal — reconexão, releitura de 5 s e rajada (3.8.4)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A chegada de uma Mensagem nao dispara `Notification`, `Audio` nem muda `document.title` (D-16-02); sem sessao a conexao nao abre; desmontar aborta o fluxo"
    requirement: MSG-03
    verification:
      - kind: unit
        ref: "apps/web/src/dados/tempo-real.test.ts#AcompanhanteDoTempoReal — D-16-02 e a sessão"
        status: pass
    human_judgment: false
  - id: D5
    description: "Duas abas abertas na mesma Conversa mostram a Mensagem recebida em menos de 2 s, e derrubar a api e religar reconecta sozinho (api real, SWR real, nginx da VM)"
    requirement: MSG-03
    verification: []
    human_judgment: true
    rationale: "Backstop do plano: so a prova ao vivo (16-16) mede a latencia ponta a ponta e a reconexao com a api real; os testes locais usam `fetch` falso e temporizadores falsos."

duration: 14min
completed: 2026-11-09
status: complete
---

# Phase 16 Plan 08: Tempo real na tela (SSE por fetch, reconexao e releitura) Summary

**A web abre `GET /eventos` por `fetch` com `Authorization: Bearer`, le o corpo em fluxo e revalida o fio, a lista da Caixa e o resumo das Tarefas a cada evento; cai e reconecta com espera de 1 s a 30 s, relendo tudo a cada 5 s sem conexao e uma vez a cada reconexao.**

## Performance

- **Duration:** 14 min (aprox.)
- **Completed:** 2026-11-09T19:10:00Z
- **Tasks:** 2
- **Files:** 5 (2 novos, 3 alterados), 714 linhas inseridas

## Accomplishments

- `lerQuadrosSse` pura (junta `resto` + pedaco, quebra em `\n\n`, so linhas `data:`, ignora comentario, JSON invalido e campo a mais) e `chavesDoEvento`/`chavesDosEventos` (D-16-02, unidas sem repetir).
- `criarConexaoDoTempoReal`: token pedido a cada tentativa (401 pega o renovado; sem sessao nao chama `fetch`), espera `min(1 s * 2^n, 30 s)`, releitura de 5 s enquanto cai, releitura completa ao abrir, agrupamento de 300 ms, `parar()` que aborta e limpa tudo.
- `invalidarCrmComArrays(prefixo)`: alcanca a chave array do resumo das Tarefas; `invalidarCrm` ficou como estava e continua sem casar array.
- `AcompanhanteDoTempoReal` montado no `StoreProvider` ao lado do `AcompanhanteDaRevisao` (que continua): o SSE soma, nao substitui. Nada aparece na tela.

## Task Commits

Plano `type: execute`, tarefas `tdd="true"`; Task 1 e o tracador.

1. **Task 1 (tracador), RED** - `efd7acc` (test): esqueletos que compilam; 7 falhas por asserção (quadro cortado, chaves por tipo, acompanhante sem chamar invalidacao, filtro de chave array).
2. **Task 1, GREEN** - `c4a2a09` (feat): leitor, `invalidarCrmComArrays`, acompanhante, montagem no `StoreProvider`; 79 testes em `tempo-real`, `cliente-crm` e `store`. Tracador reverificado com o `<automated>` (vitest + `tsc`) antes da expansao: `⚡ Tracer verified end-to-end — expanding`.
3. **Task 2, RED** - `5b16352` (test): 9 de 18 falham por asserção contra o tracador (sem reconexao, sem releitura de 5 s, sem agrupamento, `parar()` com evento na janela).
4. **Task 2, GREEN** - `f4b8496` (feat): reconexao, releitura, agrupamento, `ativo` sob o Vitest; 19/19 em `tempo-real.test.ts`.

**Plan metadata:** commit `docs(16-08)` seguinte (STATE, ROADMAP).

## Files Created/Modified

- `apps/web/src/dados/tempo-real.ts` - o leitor SSE, a conexao e o acompanhante
- `apps/web/src/dados/tempo-real.test.ts` - 19 testes (leitor, chaves, tracador, reconexao com temporizadores falsos, D-16-02)
- `apps/web/src/dados/crm/cliente-crm.ts` / `.test.ts` - `invalidarCrmComArrays`
- `apps/web/src/dados/store.ts` - `createElement(AcompanhanteDoTempoReal)` no `StoreProvider`

## Decisions Made

Ver `key-decisions`. O que pesa para os proximos: o fluxo nao entrega o que passou no intervalo, entao a tela relê as chaves de base (`/mensagens`, `/conversas`, o resumo) a cada conexao aberta; os gestos que a 16-07 deixou sem aviso (mesclar, sucessao, marcacao, troca de Canal, vinculo de Negocio, simular conexao) so aparecem na outra aba pela releitura de 5 s da revisao do Espaco ou pelo proximo evento.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] O acompanhante so conecta fora do Vitest (`ativo`)**
- **Found during:** Task 2 (rodada completa de `npm run test -w @n1/web`)
- **Issue:** com o acompanhante montado no `StoreProvider`, 6 arquivos de teste de tela (19 testes: `arvore-menu`, `arvore-salvando`, `busca-e-lixeira-do-crm`, `use-notificacoes`, outros) que montam o `StoreProvider` com `NEXT_PUBLIC_API_URL` e um `fetch` falso que conta pedidos viram um `GET /eventos` a mais e quebram a contagem; alguns esgotam o tempo.
- **Fix:** `AcompanhanteDoTempoReal({ ativo })` com padrao `process.env.NODE_ENV !== "test"` (ligado em producao e em `next dev`, desligado sob o Vitest); os testes do proprio modulo passam `ativo: true`; um teste documenta que, sem `ativo`, sob o Vitest nao ha conexao. Os 6 arquivos de tela ficaram intocados.
- **Files modified:** `apps/web/src/dados/tempo-real.ts`, `apps/web/src/dados/tempo-real.test.ts`
- **Verification:** `npm run test -w @n1/web`: 133 arquivos, 1320 testes passando (antes do ajuste: 6 arquivos com falha, 19 testes).
- **Committed in:** `f4b8496`

**2. [Planejador deixou em aberto] `OpcoesDaConexao.aoReler` e o aviso `aoCair` por episodio**
- O `<interfaces>` do plano nao tinha como a conexao pedir a releitura das chaves de base (a de 5 s e a de cada abertura); acrescentei `aoReler()` (aditivo, sem quebrar `aoEventos`/`aoAbrir`/`aoCair`). `aoCair` avisa a primeira falha de cada episodio, nao cada tentativa.

---

**Total deviations:** 1 auto-fixed (Rule 3), 1 acrescimo de interface
**Impact on plan:** sem scope creep; a unica mudanca de comportamento visivel e que, sob o Vitest, o acompanhante nao conecta sozinho.

## TDD Gate Compliance

O plano e `type: execute` e `workflow.tdd_mode` nao esta ligado, entao nao usei `gsd_run check tdd-red-evidence`; a avaliacao semantica foi manual (o alvo executou e falhou na asserção planejada, nunca por import ou sintaxe).

- **Task 1 (tracador):** RED `efd7acc`: 7 de 15 falham por asserção (`lerQuadrosSse` devolvia `eventos: []`, `chavesDoEvento` `[]`, o acompanhante nao chamava a invalidacao, `mutate` do filtro nunca recebido); 8 passaram por construcao (o teste de `invalidarCrm` que ja existia no codigo, os 6 testes antigos). GREEN `c4a2a09`.
- **Task 2:** RED `5b16352`: 9 de 18 falham por asserção (`expected called 2 times, but got 1`, `aoEventos called 10 times`). Os 9 restantes **nasceram verdes por construcao**: `parar()` abortando o `fetch`, `lerQuadrosSse`, `chavesDoEvento`, o teste de D-16-02 (o tracador nunca chamou `Notification`/`Audio`) e o de desmontagem ja valiam desde o tracador. GREEN `f4b8496`.
- **REFACTOR:** nao houve.

## Issues Encountered

- A primeira versao do teste de releitura esperava `aoCair` uma vez por tentativa e a implementacao avisava por tentativa; ficou por episodio (decisao acima) e o teste correspondente foi ajustado no GREEN.
- `createElement(AcompanhanteDoTempoReal, { ativo })` nao compila com `= {}` no parametro; sem o default (React sempre passa o objeto de props) compila.

## Verification Run

- `cd apps/web && npx vitest run src/dados/tempo-real.test.ts src/dados/crm/cliente-crm.test.ts src/dados/store.test.ts` + `npx tsc --noEmit`: 79 testes passando, `tsc` limpo.
- `npm run typecheck -w @n1/web`: ok. `npm run lint -w @n1/web`: 0 erros, 2 avisos antigos (`KnowledgeDocument` e `Target`, de outros arquivos). `npm run verificar:tokens -w @n1/web`: 0 falhas.
- `npm run test -w @n1/web`: 133 arquivos, 1320 testes, todos passando (43 s).
- Criterios de aceite: `export function invalidarCrmComArrays` 1; `AcompanhanteDoTempoReal` em `store.ts` 3, `AcompanhanteDaRevisao` 3; `EventSource`/`apps/api` em `tempo-real.ts` 0; `Notification|new Audio|document.title|toast` 0; `ESPERA_MAXIMA_DE_RECONEXAO_MS|INTERVALO_SEM_TEMPO_REAL_MS` 5.
- Nao rodei `npm run check` inteiro. Nenhum Postgres foi necessario (so web).

## Known Stubs

None.

## Threat Flags

None. T-16-29 (token so no cabecalho, URL sem token, nenhum `console`; teste confere a URL), T-16-30 (agrupamento de 300 ms e chaves unidas, teste de dez eventos) e T-16-SC (nenhum pacote novo) cobertos.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 16-11 (telas da Caixa/fio): nao precisa chamar nada do tempo real; o fio (`useMensagens`) e a lista (`useConversas`) ja atualizam por SWR. Um teste de tela que monte o `StoreProvider` nao abre conexao (`ativo` desligado sob o Vitest).
- 16-16 (prova ao vivo): medir as duas abas (< 2 s) e derrubar/religar a api; lembrar do `X-Accel-Buffering` atras do nginx.
- Documentacao devida (arquivos fora dos `files_modified`, para o 16-14): `apps/web/CONTEXT.md` (nova secao sobre `dados/tempo-real.ts`: fetch com Bearer e nao `EventSource`, as chaves por tipo de evento, releitura de 5 s e a cada conexao, `invalidarCrmComArrays`, `ativo` sob o Vitest; e que o SSE soma ao `AcompanhanteDaRevisao`).

## Self-Check: PASSED

- Arquivos existem: `tempo-real.ts`, `tempo-real.test.ts` (novos) e os 3 alterados constam de `git diff --stat b9afa7b..HEAD`.
- Commits na branch: `efd7acc`, `c4a2a09`, `5b16352`, `f4b8496`.

---
*Phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia*
*Completed: 2026-11-09*
