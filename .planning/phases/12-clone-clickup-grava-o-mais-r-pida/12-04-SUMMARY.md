---
phase: 12-clone-clickup-grava-o-mais-r-pida
plan: 04
subsystem: api
tags: [persistencia, concorrencia, postgres, trava, executar, regime]

requires:
  - phase: 12-clone-clickup-grava-o-mais-r-pida
    provides: aoMedir e MedicaoDaExecucao em executar() (12-01); o comando gravacao:medir e o "antes" (12-02); a parada do dono, sem meta numérica (12-03)
provides:
  - executar() com dois regimes — travado (padrão: select … for update antes de hidratar, uma tentativa) e otimista (as importações longas, até 3 tentativas)
  - OpcoesExecucao como união por regime, TRAVA_DE_RESERVA_MS e inicioDaTransacaoTravada
  - MedicaoDaExecucao.regime na linha "gravacao medida"
  - unidade-de-trabalho-concorrencia.test.ts (GRV-03 contra Postgres local) e regime-dos-chamadores.test.ts (D-10)
  - persistencia/CONTEXT.md com a trava no começo, os dois regimes e o tamanho medido do Espaço
affects: [12-05, 12-10]

actuals:
  tokens: 12600
  tasks: 3
  commits: 5
plan_head_before: 347651e00d0e7933322969b0aa72cdb6f63b576c
plan_head_after: 8d98b76e2de8eddcab85fceeeda687dd18e56d01

tech-stack:
  added: []
  patterns:
    - "Regime de gravação escolhido por opção tipada (união discriminada): a opção que só vale num regime não compila no outro"
    - "Teste de ordem de instruções com marcador de hidratar na mesma lista de consultas da fake de pool"
    - "Teste que lê o código-fonte (sem banco) para impedir que uma regra de arquitetura escorregue"

key-files:
  created:
    - apps/api/src/persistencia/unidade-de-trabalho-concorrencia.test.ts
    - apps/api/src/persistencia/regime-dos-chamadores.test.ts
  modified:
    - apps/api/src/persistencia/unidade-de-trabalho.ts
    - apps/api/src/persistencia/unidade-de-trabalho-trava.test.ts
    - apps/api/src/persistencia/unidade-de-trabalho.test.ts
    - apps/api/src/rotas/operacoes-medicao.test.ts
    - apps/api/src/importacao/clickup/importar-contas-a-pagar.ts
    - apps/api/src/importacao/clickup/importar-contas-a-receber.ts
    - apps/api/src/importacao/financeiro/importar.ts
    - apps/api/src/importacao/clickup/corrigir-data-de-pagamento-cr.ts
    - apps/api/src/persistencia/CONTEXT.md
    - apps/api/src/persistencia/repositorio.ts
    - apps/api/src/observabilidade/medir-gravacao.test.ts

key-decisions:
  - "A trava é uma instrução própria depois do begin (begin + set local, depois select … for update, depois hidratar). Fundir begin e trava numa consulta só (Pitfall 9) fica para depois da medição, não deste plano."
  - "OpcoesExecucao é união por regime: sem regime ou 'travado' não aceita tentativas (tipo never); só 'otimista' aceita (padrão 3). O corpo de uma tentativa virou a função de módulo umaTentativa, que devolve concluída ou conflito."
  - "No travado, o update da revisão com rowCount 0 lança 'Espaço de Trabalho … não existe.' (o Espaço sumiu com a linha travada) — não é conflito; e um 55P03 no update do travado sobe como exceção."
  - "Com Q = 0 o travado abre com begin; set local lock_timeout = 10000 (TRAVA_DE_RESERVA_MS); o begin puro fica só no otimista."
  - "regime-dos-chamadores.test.ts ignora linhas de comentário e o arquivo que define os regimes, e distingue o campo de interface 'readonly tentativas' (coluna da agenda) de uma opção passada a executar()."

patterns-established:
  - "Quem precisa do lote longo escolhe regime: 'otimista' com um comentário citando D-10; o teste lista os quatro e o motivo de cada um"

requirements-completed: [GRV-03]

coverage:
  - id: D1
    description: "Duas executar() simultâneas no mesmo Espaço esperam a vez na trava, gravam com uma tentativa cada, hidratar roda 2 vezes, as revisões saem n+1 e n+2 e a segunda hidratação enxerga o que a primeira gravou; no otimista o mesmo roteiro hidrata 3 vezes"
    requirement: GRV-03
    verification:
      - kind: integration
        ref: "apps/api/src/persistencia/unidade-de-trabalho-concorrencia.test.ts (Postgres 16 em Docker, contêiner crm-n1-pg-1204, porta 55624): 5 testes passaram, nenhum pulado"
        status: pass
    human_judgment: false
  - id: D2
    description: "55P03 na trava vira conflito sem repetir (um rollback, conexão volta ao pool, sem commit e sem hidratar); 55P03 fora da trava sobe como exceção; no otimista continua 3 tentativas"
    requirement: GRV-03
    verification:
      - kind: unit
        ref: "apps/api/src/persistencia/unidade-de-trabalho-trava.test.ts, unidade-de-trabalho.test.ts, rotas/operacoes-medicao.test.ts (409 com tentativas 1 e regime travado)"
        status: pass
      - kind: integration
        ref: "unidade-de-trabalho-concorrencia.test.ts, caso da trava esgotada (lock_timeout de 500 ms, conflito em ~0,5 s, hidratar 0 vezes, nada gravado)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Só as quatro importações manuais longas gravam no regime otimista; nenhum bootstrap/ passa regime"
    requirement: GRV-03
    verification:
      - kind: unit
        ref: "apps/api/src/persistencia/regime-dos-chamadores.test.ts (5 testes)"
        status: pass
      - kind: integration
        ref: "apps/api/src/importacao/** contra Postgres local no bloco da Task 3 (junto dos demais arquivos do bloco: 38 passaram, 1 pulado)"
        status: pass
    human_judgment: false
  - id: D4
    description: "O travaMs 'depois' é comparável ao 'antes' e o regime travado não piora a gravação sem concorrência por causa da ida e volta a mais da trava"
    verification: []
    human_judgment: true
    rationale: "Só a medição 'depois' em produção (12-10) diz se a ida e volta a mais da trava custa mais do que as repetições que ela elimina; aqui há apenas o contador de tentativas (1) e o regime na linha de log, provados no Postgres local."

duration: 27min
completed: 2026-11-02
status: complete
---

# Phase 12 Plan 04: A trava no começo e os dois regimes de `executar()` Summary

**`executar()` passa a travar a linha do Espaço de Trabalho com `select … for update` antes de hidratar e grava com uma tentativa só (`55P03` na trava vira 409 sem repetir); as quatro importações manuais longas ficam no regime `otimista`, e duas gravações simultâneas no mesmo Espaço, provadas contra Postgres 16 local, hidratam 2 vezes em vez de 3.**

## Performance

- **Duration:** 27 min
- **Completed:** 2026-11-02T13:30Z
- **Tasks:** 3 de 3 (a Task 1 é o traçador; o plano é `autonomous: true`, sem checkpoint)
- **Files modified:** 13 (2 novos), 887 linhas acrescentadas e 200 removidas

## Accomplishments

- **Regime travado (padrão).** Depois do `begin` com os prazos, `select revisao from plataforma.workspaces where workspace_id = $1 for update` como instrução própria; só então `hidratar`. O `update … revisao = revisao + 1` não confere mais a revisão. `55P03` na trava devolve `{ ok: false, conflito: true, error: "Outra alteração entrou antes desta. Tente de novo." }` com um `rollback` e a conexão de volta ao pool; `55P03` em outro ponto (no `commit`, no `aoConfirmar`) sobe como exceção.
- **Regime otimista.** O caminho de antes da Fase 12 (revisão conferida no `update` do fim, `tentativas ?? 3`), só para as quatro importações longas. `OpcoesExecucao` é união: `tentativas` não existe no travado (o `tsc` recusa, com `@ts-expect-error` no teste).
- **Q = 0.** `inicioDaTransacaoTravada()` abre com `begin; set local lock_timeout = 10000` (`TRAVA_DE_RESERVA_MS`), para um CLI de `bootstrap/` com a variável herdada nunca esperar a trava sem prazo.
- **Medição.** `MedicaoDaExecucao.regime`; no travado `travaMs` soma o `select … for update` (inclusive a espera pela vez) e o `update`, `atualizaMs` isola o `update`.
- **Prova contra Postgres real.** `unidade-de-trabalho-concorrencia.test.ts` (arquivo próprio: o `-trava` mocka `./conexao` e `./repositorio`): travado hidrata 2 vezes, `tentativas` 1 nas duas, revisões `n+1` e `n+2`, a segunda vê a Lista da primeira e `travaMs` da segunda passa de 200 ms; otimista (contraste) hidrata 3 vezes e a segunda grava na tentativa 2; a mesma `createList` duas vezes ao mesmo tempo grava uma (a outra é recusada pelo domínio, "Já existe uma Lista chamada…", sem repetir, revisão +1); trava esgotada por conexão de fora (`lock_timeout` de 500 ms) dá conflito em ~0,5 s, sem hidratar e sem gravar; exceção no `aoConfirmar` desfaz tudo e a gravação seguinte passa.
- **D-10 vigiado.** `regime-dos-chamadores.test.ts` lê o código-fonte e falha, com arquivo e linha, se um chamador com `semEventosDeSaida: true` não passar `otimista`, se outro arquivo passar `otimista`, se um chamador de `executar()` passar `tentativas`, ou se um `bootstrap/` ganhar `regime:`.
- **Documentação.** `persistencia/CONTEXT.md` reescrito (a trava é o `select … for update`; o que `55P03` vira em cada regime; Q = 0; escritores esperando seguram conexão, Pitfall 2). Comentário de `repositorio.ts`: 4601 registros e 2422.8 KB de texto (`ws_n1`, medido em 2026-10-31, `12-PROVAS.md`) no lugar de 900 e 475 KB.

## Task Commits

1. **Task 1 (traçador), RED** — `68b9f6b` (test): fakes do travado e do otimista, o 409 da rota vindo da trava, o arquivo de concorrência. Falhou nas asserções esperadas: `hidratar` chamado 3 vezes, `regime` indefinido, `inicioDaTransacaoTravada` inexistente.
2. **Task 1 (traçador), GREEN** — `5f27e3f` (feat): `executar()` com os dois regimes.
3. **Task 2, RED** — `86acf33` (test): `regime-dos-chamadores.test.ts` falhando nos quatro importadores.
4. **Task 2, GREEN** — `20c79fd` (feat): `regime: "otimista"` nos quatro importadores.
5. **Task 3** — `8d98b76` (docs): `persistencia/CONTEXT.md`, comentário de `repositorio.ts`, asserção de regime em `medir-gravacao.test.ts`.

**Plan metadata:** commit `docs(12-04)` que carrega este SUMMARY, STATE, ROADMAP e REQUIREMENTS.

Tracer feedback gate (Task 1): o `<verify>` era só automatizado; foi rodado de ponta a ponta (fakes, `tsc` e o arquivo de banco contra o contêiner) antes de a Task 2 começar, sem checkpoint.

## TDD Gate Compliance

Tasks 1 e 2: `test(12-04)` antes de `feat(12-04)`, nessa ordem, nos dois ciclos. Nenhum `refactor`. RED da Task 1 (semântica): as fakes falharam em `expect(...).toBe(...)` sobre o comportamento planejado (um `TypeError: inicioDaTransacaoTravada is not a function` nos dois casos do bloco (k)/(m) que importam a função nova) e o arquivo de banco falhou com `expected 3 to be 2` em `hidratar`; RED da Task 2: duas das cinco asserções falharam listando os quatro arquivos por linha.

## Verification

- `cd apps/api && npx tsc --noEmit`: exit 0.
- `cd apps/api && DATABASE_URL= DATABASE_URL_MIGRACAO= npx vitest run` (sem banco): 123 arquivos passaram, 37 pulados; 1215 testes passaram, 528 pulados, 1 todo; nenhuma falha.
- Bloco de Docker da Task 3 (contêiner `crm-n1-pg-1204`, porta 55624, `postgres:16`, `npm run migrar` antes, 001 a 010 aplicadas), `src/persistencia`, `rotas/operacoes`, `rotas/estado`, `rotas/formularios-publicos`, `automacoes/scheduler-worker`, `observabilidade/medir-gravacao`, `e2e/criar-conta`, `e2e/lote-contas-a-pagar`, `e2e/falhas-injetadas` e `src/importacao`: 38 arquivos passaram, 1 pulado; 398 testes passaram, 10 pulados, 1 todo; exit 0. Vistos rodando (não pulados): `unidade-de-trabalho-concorrencia.test.ts` (5), `medir-gravacao.test.ts`, `regime-dos-chamadores.test.ts`, `operacoes.test.ts`, `estado.test.ts`, `formularios-publicos.test.ts`, `scheduler-worker.test.ts`, `criar-conta.test.ts`, `lote-contas-a-pagar.test.ts` e os testes de importação com banco. O pulado dentro da lista do plano é `falhas-injetadas.test.ts` (ver Deviations).
- `medir-gravacao.test.ts` contra o contêiner: o comando de verdade (`spawnSync`) e `medirGravacao` mostram os quatro gestos com `regimes` igual a `["travado"]` e `tentativas` mediana 1, desfecho `gravou` — o regime novo chega à linha de log e ao relatório.
- Critérios de aceitação da Task 1: `select … for update` (1), `where workspace_id = $1 returning revisao` (1), `and revisao = $2` (1), `export const TRAVA_DE_RESERVA_MS` (1), `describeComBanco` no arquivo de concorrência (3). Task 2: `corrigir-data-de-pagamento-cr.ts` com `regime: "otimista"` (1); nenhum `regime:` em `bootstrap/` (0). Task 3: `for update` no `CONTEXT.md` (6), `TRAVA_DE_RESERVA_MS` (1), a linha "revisão otimista (3 tentativas)" não existe mais, `12-PROVAS` no `repositorio.ts` (1).
- `git status --porcelain -- apps/api/migracoes` vazio e nenhum commit do plano toca `apps/api/migracoes/`.
- `docker ps -a | grep -c crm-n1-pg` = 0 depois de cada bloco.

## Decisions Made

Ver `key-decisions`. A mensagem do conflito virou a constante `MENSAGEM_DO_CONFLITO` (a mesma frase de sempre, usada pelos dois regimes).

## Deviations from Plan

### Auto-fixed Issues

Nenhum.

### Registrados, sem mudança de código

**1. [Ambiental] `falhas-injetadas.test.ts` saiu "skipped" no bloco da Task 3**
- **Found during:** Task 3 (portão)
- **Issue:** o `<verify>` do plano diz que algum arquivo da lista listado como pulado reprova. O arquivo pula por outra pré-condição, não pelo Docker: `describe.skip` quando `temFinanceiroTria` é falso (o repositório irmão `financeiro-tria`, com `automation/src`, não está ao lado de `crm-n1` nesta máquina). O mesmo ocorre com os outros e2e que sobem o `automation/` real.
- **Efeito:** a Fault-Injection Matrix de duas processos não rodou aqui; ela exercita a ponte do Financeiro e o outbox, que passam por `executar()` no regime travado, mas a composição entre processos não foi provada neste plano. O que prova GRV-03 (`unidade-de-trabalho-concorrencia.test.ts`) rodou e passou. Ficou para quem tiver o repositório irmão (ou para o 12-10).

**2. [Critério literal] `grep -rln 'regime: "otimista"'` lista cinco arquivos, não quatro**
- O quinto é `persistencia/unidade-de-trabalho.ts`, onde o texto aparece no tipo `OpcoesExecucao` (a definição do regime) e em comentário. Os quatro importadores continuam sendo os únicos que PASSAM o regime; `regime-dos-chamadores.test.ts` exclui o arquivo de definição e as linhas de comentário de propósito.

**3. [Sem desvio, anotado]** A primeira execução do bloco de Docker abortou com `timeout: command not found` (macOS), antes de rodar qualquer teste; o contêiner foi removido e o bloco foi refeito por um script em `bash` com a mesma lista de arquivos. Durante a escrita de `regime-dos-chamadores.test.ts`, a regra de `tentativas` pegou o campo de interface `readonly tentativas: number` da agenda do `scheduler-worker.ts` (falso positivo do próprio teste); a expressão regular foi refinada antes do commit RED.

---

**Total deviations:** 0 auto-fixados; 1 ambiental (arquivo pulado por pré-condição externa) e 1 de critério literal, sem mudança de comportamento.
**Impact on plan:** nenhum no escopo. GRV-03 está provado no que o plano nomeia (`hidratar` × 2, 409 sem repetir, importações no otimista, `CONTEXT.md`); a matriz de falhas entre processos fica sem rodar aqui.

## Issues Encountered

- Nenhum durante a implementação. `outbox-worker.test.ts` (k), o caso intermitente conhecido, passou no bloco de Docker e na suíte sem banco.

## Known Stubs

None.

## Threat Flags

None. T-12-09 (pool esgotado por escritores esperando): mitigado por `lock_timeout` de 10 s, uma tentativa, 409 limpo e documentado em `persistencia/CONTEXT.md`; `conexaoMs` e `travaMs` já estão na linha de medição. T-12-10 (Q = 0 no travado): `inicioDaTransacaoTravada` e dois casos no bloco (k). T-12-11 (importação longa segurando o `ws_n1`): `regime: "otimista"` nos quatro e `regime-dos-chamadores.test.ts`. T-12-12 (ciclo de espera com `avancarRevisaoDoEspaco`): aceito no plano; os testes `src/persistencia` (inclui `canais-projetados.test.ts`) e `rotas/operacoes` passaram contra o Postgres local.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- A coluna "Depois" de `12-PROVAS.md` ainda não existe: o 12-10 mede de novo em produção. Dois pontos para olhar nela, sinalizados no plano: (a) o `travaMs` do "depois" inclui uma ida e volta a mais no caminho sem concorrência (o `select … for update`); se o "depois" sair pior que o "antes" sem concorrência, é isto, e juntar `begin` e trava numa consulta só (Pitfall 9) é decisão para depois da medição; (b) o agendador e a ponte do Agente agora esperam a vez atrás dos gestos de tela no mesmo Espaço — conferir `conexaoMs` e `travaMs` na linha de log.
- Nada foi publicado: o código novo só chega à VPS por um `publicar.sh` mandado pelo dono.
- 12-05 (o primeiro plano do store web) não foi aberto.

## Self-Check: PASSED

Comandos rodados antes de escrever esta linha:

- `[ -f ]` em `unidade-de-trabalho.ts`, `unidade-de-trabalho-concorrencia.test.ts`, `regime-dos-chamadores.test.ts`, `persistencia/CONTEXT.md` e `repositorio.ts`: FOUND.
- `git merge-base --is-ancestor` para `68b9f6b`, `5f27e3f`, `86acf33`, `20c79fd`, `8d98b76`: FOUND.
- `git rev-list --count 347651e..HEAD` = 5 (medido imediatamente antes de escrever o SUMMARY, a partir do registro em disco do ponto de partida).
