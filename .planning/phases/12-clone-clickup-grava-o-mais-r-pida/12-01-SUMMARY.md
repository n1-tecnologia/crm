---
phase: 12-clone-clickup-grava-o-mais-r-pida
plan: 01
subsystem: api
tags: [observabilidade, medicao, fastify, pino, postgres, unidade-de-trabalho]

requires:
  - phase: 09-seguran-a-dos-dados-e-base-de-produ-o
    provides: logger com redact (observabilidade/log.ts) e o recorte por Membro (visibilidadePara) que a rota passa a medir
provides:
  - MedicaoDaExecucao, DesfechoDaExecucao e a opção aoMedir de executar()
  - a linha de log "gravacao medida" por gravação de POST /operacoes/:nome (200, recusa, 409, 500)
  - deps.aoMedir em convidarMembro e o quarto parâmetro aoMedir em SERVICOS
affects: [12-02, 12-04, gravacao:medir, observabilidade/medicao-da-gravacao]

actuals:
  tokens: 11300
  tasks: 2
  commits: 4
plan_head_before: 292497366f0289ef746680dbf01812757c493a3d
plan_head_after: 36a6eb7775eb5a614d873cf776bf07de21e74bbb

tech-stack:
  added: []
  patterns:
    - "Medição por callback (aoMedir) em vez de campo no resultado: o resultado vira corpo HTTP, o callback não vaza por construção"
    - "Acumulador local com performance.now() por etapa, somado entre tentativas, entregue em try/finally exatamente uma vez"

key-files:
  created:
    - apps/api/src/rotas/operacoes-medicao.test.ts
  modified:
    - apps/api/src/persistencia/unidade-de-trabalho.ts
    - apps/api/src/persistencia/unidade-de-trabalho.test.ts
    - apps/api/src/rotas/operacoes.ts
    - apps/api/src/servicos/convidar-membro.ts
    - apps/api/src/rotas/CONTEXT.md

key-decisions:
  - "Callback aoMedir em vez do campo medicao em ResultadoTransacao: o resultado é espalhado em cinco pontos de resposta; o callback elimina o vazamento por construção e cobre conflito e exceção."
  - "travaMs significa 'tempo até a revisão estar garantida' nos dois regimes; aqui é o update ... where revisao = $2 (igual a atualizaMs), em 12-04 será select for update mais update."
  - "Unidade em ms com uma casa decimal (Math.round(x * 10) / 10); o regime de executar() não muda neste plano, para o 'antes' de 12-02 medir o código de hoje."

patterns-established:
  - "Linha de medição só com nome de operação já validado, números e desfecho; nunca args, value, título, e-mail ou valor"
  - "Teste de rota sem banco: pool, repositório, outbox e eventos de Canal falsos por vi.mock, logger de pino num array"

requirements-completed: [GRV-01]

coverage:
  - id: D1
    description: "executar() mede cada etapa (conexão, begin, hidratar, canais, operação, trava/update, gravar, eventos, commit) somando as tentativas e entrega por aoMedir uma vez por chamada, com desfecho gravou/recusou/conflito/excecao"
    requirement: GRV-01
    verification:
      - kind: unit
        ref: "apps/api/src/persistencia/unidade-de-trabalho.test.ts#medição por etapa (D-02)"
        status: pass
    human_judgment: false
  - id: D2
    description: "POST /operacoes/:nome escreve uma linha 'gravacao medida' por gravação (200, recusa, 409, 500) com recorteMs e totalMs, e nenhuma resposta carrega a medição"
    requirement: GRV-01
    verification:
      - kind: unit
        ref: "apps/api/src/rotas/operacoes-medicao.test.ts"
        status: pass
      - kind: integration
        ref: "Postgres 16 em Docker: vitest run src/rotas/operacoes.test.ts src/rotas/estado.test.ts src/servicos/convidar-membro.test.ts (53 passed, 0 skipped)"
        status: pass
    human_judgment: false
  - id: D3
    description: "inviteMember mede pela entrada de SERVICOS (deps.aoMedir) e a linha não leva o e-mail do convite"
    requirement: GRV-01
    verification:
      - kind: unit
        ref: "apps/api/src/rotas/operacoes-medicao.test.ts#inviteMember (por SERVICOS)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A linha de medição está documentada em rotas/CONTEXT.md, com os campos, a unidade e como lê-la na VPS"
    verification: []
    human_judgment: true
    rationale: "Documentação em prosa: só uma pessoa julga se está clara para quem vai ler o journalctl na VPS."

duration: 8min
completed: 2026-10-30
status: complete
---

# Phase 12 Plan 01: Instrumentar a gravação Summary

**`executar()` mede cada etapa da transação por callback `aoMedir` e `POST /operacoes/:nome` escreve uma linha de log "gravacao medida" por gravação, sem nada na resposta HTTP e com o regime de revisão otimista intocado.**

## Performance

- **Duration:** 8 min
- **Tasks:** 2 de 2 (a Task 1 é o traçador)
- **Files modified:** 6 (1 novo)

## Accomplishments

- `MedicaoDaExecucao` e `DesfechoDaExecucao` exportados de `unidade-de-trabalho.ts`; `executar()` acumula `conexaoMs`, `inicioMs`, `hidratarMs`, `canaisMs`, `operacaoMs`, `atualizaMs`/`travaMs`, `gravarMs`, `eventosMs` (outbox mais `aoConfirmar`) e `commitMs` somando as tentativas, mais `tentativas`, `linhasLidas` e `linhasGravadas`. Um `try/finally` externo chama `aoMedir` exatamente uma vez, e um `aoMedir` que lança é engolido.
- `ResultadoTransacao` não ganhou campo; SQL, ordem das instruções e número de tentativas ficaram como estavam (`and revisao = $2` continua no `update`).
- `POST /operacoes/:nome` mede `recorteMs` (o bloco `visibilidadePara` + `recortarDiferenca` + `recortarValor` + `maiorIdDe`) e `totalMs` e escreve a linha `{ operacao, medicao }` em 200, recusa, 409 e 500. Os caminhos 400/403/404 não escrevem.
- `convidarMembro` aceita `deps.aoMedir`; `SERVICOS[nome]` ganhou o quarto parâmetro, então `inviteMember` também mede.
- `rotas/operacoes-medicao.test.ts` (novo, sem banco) prova a ausência da chave `medicao` no corpo e de `Server-Timing` nos caminhos 200, recusa, 409, 500 e `inviteMember`, e que a linha não contém o nome da Lista nem o e-mail do convite.
- `rotas/CONTEXT.md` ganhou o parágrafo "A linha de medição de `POST /operacoes` (Fase 12, D-02/D-03)" com os campos, a unidade, o comando de leitura na VPS e o aviso de que `gravacao:medir` (12-02) lê a mesma linha.

## Task Commits

1. **Task 1 (traçador), RED** - `c821b53` (test): cinco casos de `aoMedir` e o caso 200 da rota
2. **Task 1 (traçador), GREEN** - `4b3fd10` (feat): `executar()` mede, a rota escreve a linha no recorte
3. **Task 2, RED** - `157342d` (test): recusa, 409, 500, `inviteMember` e 400/404 sem linha
4. **Task 2, GREEN** - `36a6eb7` (feat): `registrarMedicao` em 409/500/resposta final, `deps.aoMedir`, `CONTEXT.md`

Tracer feedback gate: o `<verify>` do traçador é só automatizado (sem `<human-check>`) e o `gate` não é `blocking-human`; foi rodado de ponta a ponta antes da expansão (3 arquivos, 20 testes verdes, `tsc` limpo), sem checkpoint.

## Verification

- `DATABASE_URL= npx vitest run src/rotas/operacoes-medicao.test.ts src/persistencia/unidade-de-trabalho.test.ts src/persistencia/unidade-de-trabalho-trava.test.ts` verde; `npx tsc --noEmit` limpo.
- `DATABASE_URL= DATABASE_URL_MIGRACAO= npx vitest run` (suíte sem banco): 120 arquivos passaram, 36 pulados, 1175 testes passaram, nenhuma falha nova.
- E2e local contra Postgres 16 descartável em Docker (porta 55621, nunca o `.env`): `operacoes.test.ts`, `estado.test.ts` e `convidar-membro.test.ts`, 53 passaram e 0 pulados. O container foi removido ao final.
- Critérios de aceitação conferidos: `MedicaoDaExecucao` presente, `aoMedir` e `"gravacao medida"` em `operacoes.ts`, 0 ocorrências de `medicao` em `ResultadoTransacao` e em `anexos-da-tarefa.ts`, `and revisao = $2` mantido, `gravacao medida` em `CONTEXT.md`.

## Decisions Made

Ver `key-decisions` no frontmatter: callback no lugar de campo do resultado, `travaMs` com a mesma definição nos dois regimes, e ms com uma casa decimal.

## Deviations from Plan

None - plan executed exactly as written.

Uma observação sem desvio: na recusa do domínio a rota ainda recorta (há `depois` e `diferenca`), então a linha de recusa também traz `recorteMs`. O texto do plano diz "sem `recorteMs` quando a rota não recortou", que continua valendo; o teste de recusa afirma o desfecho e o `totalMs`, não a ausência do recorte.

## Issues Encountered

- Um comando de e2e usou `timeout`, que não existe neste macOS; o container foi removido pelo `docker rm` seguinte e a primeira rodada falhou por falta de banco. Refeito como um único comando, sem `timeout`: 53 testes verdes.

## Known Stubs

None.

## Threat Flags

None. A linha de log é a única superfície nova e já está no `<threat_model>` (T-12-01, T-12-02), com teste.

## Next Phase Readiness

12-02 pode ler a linha `"gravacao medida"` (contrato em `<interfaces>` do plano e em `rotas/CONTEXT.md`) para montar o comando `gravacao:medir`. O regime de `executar()` continua o de hoje, então a rodada "antes" mede o código atual. 12-04 acrescenta `regime` a `MedicaoDaExecucao` e troca `travaMs` pelo `select … for update` mais o `update`.

## Self-Check: PASSED

- FOUND: apps/api/src/rotas/operacoes-medicao.test.ts
- FOUND: commits c821b53, 4b3fd10, 157342d, 36a6eb7 (ancestrais de HEAD)
