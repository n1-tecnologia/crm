---
phase: 12-clone-clickup-grava-o-mais-r-pida
plan: 02
subsystem: api
tags: [observabilidade, medicao, fastify, postgres, vite-node, producao]

requires:
  - phase: 12-clone-clickup-grava-o-mais-r-pida
    provides: a linha de log "gravacao medida" por gravação de POST /operacoes/:nome (12-01, D-03)
provides:
  - o comando `npm run gravacao:medir -w @n1/api` (Fastify próprio em loopback, stub de token só no `.cli.ts`)
  - medicao-da-gravacao.ts (lógica pura: ler a linha, mediana, pior caso, resumo por gesto, relatório)
  - medir-gravacao.ts (os quatro gestos por HTTP, select 1, D-05, hidratar direto, GET /estado)
  - 12-PROVAS.md com a rodada "antes" de produção (SHA 5a74ee7, ws_n1, 10 amostras por gesto)
affects: [12-03, 12-04, 12-10]

actuals:
  tokens: 21400
  tasks: 3
  commits: 4
plan_head_before: b25bec3193c534c438f4d721e48787bff661d430
plan_head_after: 5a74ee7548d5437745677e997484ff5b1f906657

tech-stack:
  added: []
  patterns:
    - "Comando de medição que sobe o próprio Fastify em 127.0.0.1:0 e lê as etapas do log, em vez de campo na resposta (D-17)"
    - "Lógica pura fora do .cli.ts (molde de previa.ts), exercitada contra Postgres local; o stub de token não sai do .cli.ts"

key-files:
  created:
    - apps/api/src/observabilidade/medicao-da-gravacao.ts
    - apps/api/src/observabilidade/medicao-da-gravacao.test.ts
    - apps/api/src/observabilidade/medir-gravacao.ts
    - apps/api/src/observabilidade/medir-gravacao.test.ts
    - apps/api/src/observabilidade/medir-gravacao.cli.ts
    - .planning/phases/12-clone-clickup-grava-o-mais-r-pida/12-PROVAS.md
  modified:
    - apps/api/package.json
    - apps/api/src/observabilidade/CONTEXT.md

key-decisions:
  - "Mediana = média dos dois valores do meio (10 repetições: média da 5ª e da 6ª); pior caso = máximo."
  - "Gesto da lixeira: o `restoreContainer` do domínio foi aceito, então o mesmo Espaço de teste volta fora da medição a cada repetição (o relatório de produção diz isso na seção Observações)."
  - "Task 3 fechada sem o passo 2 (D-03 no serviço real) por decisão explícita do dono; o ponto fica aberto para o 12-10."

patterns-established:
  - "Saída do comando só com nomes de operação e de coleção, contagens, bytes e ms; conferida contra o seed antes de ir para o git"

requirements-completed: [GRV-01]

coverage:
  - id: D1
    description: "O comando mede createList, updateContainer, trashContainer e changeTaskStatus ×N contra um Fastify em loopback, mais select 1, hidratar direto, GET /estado e o tamanho de plataforma.registros, sem tocar o que não criou"
    requirement: GRV-01
    verification:
      - kind: unit
        ref: "apps/api/src/observabilidade/medicao-da-gravacao.test.ts"
        status: pass
      - kind: integration
        ref: "apps/api/src/observabilidade/medir-gravacao.test.ts (Postgres 16 em Docker, contêiner crm-n1-pg-1202, porta 55622, rodado nas Tasks 1 e 2 pelo executor anterior)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A rodada 'antes' em produção (SHA 5a74ee7, ws_n1, 10 amostras por gesto, desfecho 'gravou 10' nos quatro) está registrada em 12-PROVAS.md, com a saída colada sem edição"
    requirement: GRV-01
    verification:
      - kind: other
        ref: "diff entre o bloco de 12-PROVAS.md e o arquivo de resposta do dono: idêntico; revisão impressa = SHA do publicar.sh"
        status: pass
    human_judgment: false
  - id: D3
    description: "A linha 'gravacao medida' observada no serviço real, por requisição vinda de uma tela (D-03 em produção)"
    verification: []
    human_judgment: true
    rationale: "Não foi obtida: nenhuma requisição do app do dono chegou ao serviço. O D-03 está provado em teste, não no serviço real; o 12-10 tenta de novo."

duration: 7min (esta continuação; as Tasks 1 e 2 foram de outro executor)
completed: 2026-10-31
status: complete
---

# Phase 12 Plan 02: O comando `gravacao:medir` e o "antes" de produção Summary

**O comando `gravacao:medir` (Fastify próprio em loopback, etapas lidas da linha de log de 12-01) mede os quatro gestos de gravação com mediana e pior caso por etapa, e a rodada "antes" de produção (SHA `5a74ee7`, `ws_n1`, 10 amostras por gesto) está em `12-PROVAS.md`, com um desvio aprovado pelo dono: a linha do D-03 não foi observada no serviço real.**

## Performance

- **Duration:** 7 min nesta continuação (Task 3 e fechamento); as Tasks 1 e 2 foram de um executor anterior
- **Completed:** 2026-10-31T04:20Z
- **Tasks:** 3 de 3 (a Task 1 é o traçador; a Task 3 é o checkpoint do dono)
- **Files modified:** 8 (6 novos)

## Accomplishments

- `medicao-da-gravacao.ts` (puro): `lerLinhaDeMedicao`, `mediana`, `piorCaso`, `resumirGesto`, `formatarRelatorio`, `LIMITE_DO_HIDRATAR_MS = 300`. Sem `pg` nem `pool(`.
- `medir-gravacao.ts`: os quatro gestos por HTTP, só sobre ids que o comando cria; `select 1`; `hidratar` direto em transação só de leitura; `GET /estado` pelo total; consulta de D-05 em transação `read only`; lixeira num `finally`.
- `medir-gravacao.cli.ts`: o comando; o stub de `verificarToken` aceita só o `randomUUID` do próprio processo, escuta em `127.0.0.1` porta 0, não exporta nada e ninguém o importa. Script `gravacao:medir` no `package.json`; seção própria em `observabilidade/CONTEXT.md`.
- Rodada "antes" em produção, registrada em `12-PROVAS.md`: `select 1` 51.7 ms de mediana, `hidratar` direto 147.5 ms (abaixo dos 300 ms de D-07), `GET /estado` 370.6 ms; `createList` 495.5 ms de `totalMs` e 551.0 ms de `pedidoMs` na mediana; `plataforma.registros` com 4601 registros, 2415.1 KB comprimidos, `activity` com 3786 deles.

## Task Commits

1. **Task 1 (traçador), RED** - `7c5593e` (test)
2. **Task 1 (traçador), GREEN** - `37c3f94` (feat): `medirGravacao` repete `createList` em loopback
3. **Task 2, RED** - `4959457` (test)
4. **Task 2, GREEN** - `5a74ee7` (feat): quatro gestos, medidas de referência e `gravacao:medir`
5. **Task 3** (checkpoint do dono, sem código): publicação, rodada e saídas feitas pelo dono; o agente conferiu e registrou em `12-PROVAS.md`.

**Plan metadata:** commit `docs(12-02)` que carrega este SUMMARY, `12-PROVAS.md`, STATE, ROADMAP e REQUIREMENTS.

Tracer feedback gate (Task 1): o `<verify>` era só automatizado; foi rodado de ponta a ponta antes da expansão, sem checkpoint.

## Verification

Conferências da Task 3, feitas nesta continuação sobre a resposta do dono:

- Revisão impressa pelo comando (`5a74ee7548d5437745677e997484ff5b1f906657`) igual ao SHA que o `publicar.sh` imprimiu como no ar: PASS. (O `cat REVISION` à parte não foi colado.)
- Quatro gestos (`createList`, `updateContainer`, `trashContainer`, `changeTaskStatus`) com "10 amostra(s)" e "desfechos: gravou 10": PASS.
- Nenhum título de Tarefa, nome de Contato ou e-mail na saída: PASS. 84 strings de nome/título/e-mail do seed (`packages/dominio/src/seed.ts`) varridas contra a saída; a única coincidência foi a palavra "Revisão" do cabeçalho; nenhuma ocorrência de `@`, URL, nem de nomes de pessoas do seed.
- Nada do `api.env`, chave, passphrase, URL com senha nem a linha `usuário@host` em `12-PROVAS.md`: PASS (o IP da VPS não aparece; o texto diz "VPS de produção").
- Bloco "Antes" de `12-PROVAS.md` idêntico ao do arquivo do dono (`diff` sem saída).

Verificação do plano que não depende de produção:

- `cd apps/api && npx tsc --noEmit`: exit 0.
- `cd apps/api && DATABASE_URL= DATABASE_URL_MIGRACAO= npx vitest run` (sem banco, sem o `.env`): 122 arquivos passaram, 36 pulados; 1197 testes passaram, 523 pulados, 1 todo; nenhuma falha.
- O teste de banco (`medir-gravacao.test.ts`) foi provado contra Postgres 16 descartável nas Tasks 1 e 2 (executor anterior); não foi reexecutado aqui porque esta continuação não mexe em código.

Critérios de aceitação da Task 2, reconferidos: `gravacao:medir` no `package.json` (1), `^export ` no `.cli.ts` (0), ninguém importa o `.cli.ts` fora do teste, `127.0.0.1` (3) e `randomUUID` (3) no `.cli.ts`, `gravacao:medir` no `CONTEXT.md` (3), `pg`/`pool(` em `medicao-da-gravacao.ts` (0), `LIMITE_DO_HIDRATAR_MS = 300`. Critérios da Task 3: as cinco seções existem, `ZZ-MEDICAO` aparece em `12-PROVAS.md`, a revisão registrada é igual ao SHA publicado.

## Decisions Made

Ver `key-decisions`. Registro do caminho do gesto da lixeira pedido pelo plano: valeu o caminho principal (o domínio aceitou `restoreContainer`), então não houve um Espaço novo por repetição.

## Deviations from Plan

### Aprovados pelo dono

**1. [Desvio aprovado pelo dono] Task 3 fechada sem o passo 2 (a linha "gravacao medida" no serviço real)**
- **Found during:** Task 3 (checkpoint do dono)
- **Issue:** O passo 2 pedia que o dono renomeasse uma Lista na tela de produção e colasse UMA linha "gravacao medida" do `journalctl` do serviço. A linha não apareceu em três tentativas. O dono, perguntado, escolheu explicitamente "Seguir sem o passo 2".
- **Motivo factual (b):** o journal do serviço tinha 80 linhas: 34 `request completed`, 34 `incoming request` e três linhas de inicialização; das 34 requisições, 33 eram `GET` de varredura de bots e as demais `GET /saude` e `GET /`; nenhum `POST /operacoes/...` e nenhum `GET /estado`. Uma segunda busca filtrada por `/operacoes|/estado|/v1` voltou vazia. Ou seja, nenhuma requisição do app que o dono usou chegou ao serviço da VPS. **A causa não foi apurada**; as hipóteses levantadas (renomeação numa tela local, `NEXT_PUBLIC_API_URL` da Vercel apontando para outra API, build da tela anterior à hidratação pela API) não foram confirmadas.
- **Efeito:** o D-03 está provado em teste (`operacoes-medicao.test.ts`: 200, recusa, 409, 500), e o próprio `gravacao:medir` leu a linha em produção (as etapas do relatório vêm dela), mas a linha NÃO foi observada no serviço real por uma requisição vinda de uma tela. Não há linha de log em `12-PROVAS.md`, e nenhuma foi escrita à mão.
- **Ponto aberto para o 12-10:** tentar de novo quando a tela de produção falar com a API.
- **Files modified:** `12-PROVAS.md` (seção "D-03 em produção" com a franqueza acima)

**2. [Sem desvio, anotado] O passo 4 não ocorreu:** a consulta de D-05 não foi recusada pelo banco (a tabela veio impressa), então nada foi rodado à mão no `psql`.

**3. [Sem desvio, anotado] Caminho (b) de publicação:** o dono publicou direto o SHA do ramo `fase-11` (não passou pela `main` do `n1`); estava no ar `a627a38`.

---

**Total deviations:** 1 aprovado pelo dono (passo 2 da Task 3), 0 auto-fixados.
**Impact on plan:** A prova "antes" está completa; só a observação do D-03 no serviço real ficou para o 12-10. Não bloqueia o 12-03.

## Issues Encountered

- Nenhum durante a continuação. A rodada de produção sobrou rastro previsto (D-04, T-12-06): Espaços `ZZ-MEDICAO-<carimbo>` e `ZZ-MEDICAO-<carimbo>-lixeira` no `ws_n1`, com Listas `ZZ-MEDICAO-…` e uma Tarefa `ZZ-MEDICAO-tarefa`, e Atividades assinadas pelo Proprietário. A saída colada não imprimiu o carimbo nem o estado final da lixeira; a conferência na lixeira é do dono, pelo prefixo `ZZ-MEDICAO`.

## Leitura do "antes" (só números impressos)

- A ida e volta do `select 1` (51.7 ms na mediana) é praticamente igual ao custo de cada etapa de uma ida só (`inicioMs`, `travaMs`, `canaisMs`, `atualizaMs`, `commitMs`: 51.3 a 53.0 ms de mediana nos quatro gestos). Os números não dizem mais que isso; a causa não foi afirmada.
- `hidratarMs` (147.9 a 154.6 ms) fica perto do `hidratar` direto (147.5 ms); o `GET /estado` (370.6 ms) tem 223.1 ms a mais que ele.
- 12-03 fixa a meta com esta tabela na mão; as colunas "Depois" e "Meta" de `12-PROVAS.md` estão vazias de propósito.

## Known Stubs

None.

## Threat Flags

None. A superfície nova (comando com stub de token) está no `<threat_model>` do plano (T-12-03 a T-12-07). T-12-05 (saída para o git): conferida de novo na Task 3, sem nome, e-mail ou segredo. T-12-07: o agente não publicou, não acessou a VPS e não tocou na chave de deploy.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 12-03 (a parada `[BLOCKING]`: meta do dono, caminho B e a sessão C se `hidratar` > 300 ms) tem a tabela "antes": o `hidratar` direto está em 147.5 ms de mediana, abaixo do limite de 300 ms de D-07.
- Aberto para 12-10: observar a linha "gravacao medida" no serviço real (D-03) e conferir a lixeira do `ws_n1` pelo prefixo `ZZ-MEDICAO`.
- Observação para o 12-04: as linhas do "antes" não trazem `regime` (impresso "a linha não traz"), como esperado; o 12-04 acrescenta `medicao.regime`.

## Self-Check: PASSED

Comandos rodados antes de escrever esta linha:

- `[ -f ]` em `12-PROVAS.md`, `medicao-da-gravacao.ts`, `medir-gravacao.ts`, `medir-gravacao.cli.ts` e os dois testes: FOUND.
- `git merge-base --is-ancestor` para `7c5593e`, `37c3f94`, `4959457`, `5a74ee7`: FOUND.
- `git rev-list --count b25bec3..HEAD` = 4 (medido imediatamente antes de escrever o SUMMARY).
- `grep -c ZZ-MEDICAO 12-PROVAS.md` >= 1.
