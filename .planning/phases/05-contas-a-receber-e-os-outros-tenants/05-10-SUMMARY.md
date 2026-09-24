---
phase: 05-contas-a-receber-e-os-outros-tenants
plan: 10
subsystem: dominio+api
tags: [contas-a-receber, evolver, automacoes, recorrencia, scheduler, runbook]

# Dependency graph
requires:
  - phase: 05-contas-a-receber-e-os-outros-tenants
    provides: "A conferência somente-leitura de 05-09 (`05-CONFERENCIA-WS-N1.md`) — o escopo exato do que faltava em ws_n1, sem inventar divergência"
provides:
  - "O evolver `evoluirConfiguracaoDeContasAReceber` (criar-ou-conferir, nunca sobrescreve), os prazos de R4/R5 ajustáveis por comando com trilha, e R7 (Saque de plataforma) com Regra de Recorrência mensal — tudo testado, nada aplicado em ws_n1"
  - "O runbook operador (ordem 05-11 → MARCO_ZERO → Ensaio → liberar) registrado para quem executar a Task 4"
affects: [rec-01, futuro-relogio-de-contas-a-receber, 05-11]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Evolver criar-ou-conferir no mesmo molde de solicitacao-de-pagamento-evolver.ts: nunca remove, nunca sobrescreve, divergência vira relato — reaplicado para Contas a receber", "Prazo de Automação como dado de configuração no temporalPredicate da versão publicada, nunca constante de código (D-07/D5-15)", "Regra de Recorrência nativa da Tarefa (B6, aoConcluir) para R7, em vez de motor de Automações — mecanismo já existente, só garantido em produção"]

key-files:
  created:
    - packages/dominio/src/contas-a-receber-evolver.ts
    - packages/dominio/src/contas-a-receber-evolver.test.ts
    - apps/api/src/bootstrap/contas-a-receber.ts
    - apps/api/src/bootstrap/contas-a-receber.cli.ts
    - apps/api/src/bootstrap/contas-a-receber.test.ts
  modified:
    - packages/dominio/src/seed-contas-a-receber.ts
    - apps/api/package.json
    - apps/api/src/automacoes/scheduler-worker.test.ts

key-decisions:
  - "Execução PARCIAL por decisão explícita do usuário, verbatim: 'Relógio depois do 05-11 (Recomendado)' — resposta à pergunta do orquestrador sobre a ordem entre o relógio de Contas a receber (Task 4 deste plano) e a importação (05-11)."
  - "Tasks 1, 2 e 3 (todas `type=\"auto\"`) foram executadas por inteiro, testadas e commitadas. A Task 4 (`checkpoint:human-verify`, `gate=\"blocking-human\"`) NÃO foi executada — nenhum MARCO_ZERO foi gravado para (ws_n1, lst_contas_a_receber), nenhum Ensaio rodou, nenhuma liberação aconteceu."
  - "REC-01 permanece em aberto. Este SUMMARY não marca a requirement como concluída — isso é responsabilidade do orquestrador (STATE.md/ROADMAP.md/REQUIREMENTS.md intocados por esta sessão, por instrução explícita)."
  - "Achado que motivou a decisão do usuário: a liberação (`automacoes:liberar`) é por Lista, não por dia civil — uma vez liberada, `primeiraVoltaPendente()` nunca mais volta a ser true para (ws_n1, lst_contas_a_receber). ws_n1 tem 0 Tarefas em CR.listId hoje; rodar o Ensaio agora mediria uma Lista vazia e não provaria nada, e os 240 registros que 05-11 vai importar rodariam depois sem a rede de segurança do Ensaio (T-5-31/D3-03). A ordem certa é: 05-11 importa → MARCO_ZERO → Ensaio da primeira volta → ler o relato → liberar."
  - "Dry-run contra ws_n1 confirma o resultado da conferência de 05-09: 0 criados, 23 conferidos, 0 divergentes (1 Lista + 6 Status + 8 Campos + 6 Automações + 0 Concessões + 2 Visões). `--apply` não foi rodado nesta sessão — só o dry-run, que não grava nada."

patterns-established:
  - "Runbook operador com ordem de passos numerados e query SQL de verificação embutida no SUMMARY, no mesmo molde que 03-08/03-10 usaram para o relógio de Contas a pagar — reaplicável para o próximo módulo que precisar ligar um relógio de Automações."

requirements-completed: []

# Metrics
duration: ~2h
completed: 2026-09-24
---

# Phase 5 Plan 10: O evolver de Contas a receber, os prazos ajustáveis e R7 — PARTIAL Summary

**Evolver, ajuste de prazo e Saque recorrente escritos, testados e commitados (`5c41395`, `d3d5838`, `1fdc578`, `1d8e99d`) — o relógio da Lista (Task 4) fica para depois de 05-11 importar as 240 Tarefas históricas, por decisão do usuário.**

## Escopo desta execução — LEIA ANTES DE ASSUMIR QUE O PLANO ESTÁ FEITO

O plano 05-10 (`autonomous: false`) tem quatro tasks. As Tasks 1, 2 e 3
(`type="auto"`) foram executadas por inteiro: o evolver, os prazos de R4/R5
ajustáveis e a Regra de Recorrência de R7. A Task 4 é
`checkpoint:human-verify` com `gate="blocking-human"` — ligar o relógio da
Lista com `MARCO_ZERO`, Ensaio da primeira volta e liberação — e **não foi
executada**.

O orquestrador apresentou o estado do plano ao usuário e perguntou como
seguir a ordem entre o relógio (Task 4 deste plano) e a importação (05-11).
A resposta, verbatim: **"Relógio depois do 05-11 (Recomendado)"**. O motivo
técnico que sustenta essa ordem: a liberação de uma Lista no scheduler é
definitiva — uma vez chamado `automacoes:liberar`, `primeiraVoltaPendente()`
nunca mais volta a ser `true` para aquele par (workspace, Lista). Como
`ws_n1` tem hoje **0 Tarefas** em `CR.listId`, rodar o Ensaio agora mediria
uma Lista vazia (nada a executar, nada a pular, nada a falhar) e não
provaria absolutamente nada sobre R2/R4/R5/R7 contra dado real — e pior, os
240 registros que `05-11` vai importar depois entrariam direto no relógio já
liberado, sem a rede de segurança do Ensaio (T-5-31, D3-03). A ordem certa é
importar primeiro, marcar `MARCO_ZERO`, deixar a primeira volta correr em
Ensaio, ler o relato, e só então liberar.

**Nem todas as quatro tasks do plano estão concluídas — Tasks 1-3 sim, Task
4 não.** Este SUMMARY documenta o que foi construído e testado, e deixa
escrito o runbook exato para quem executar a Task 4 depois de 05-11.
`REC-01` continua aberta.

## O que foi feito

### Task 1 — O evolver (`5c41395`)

`packages/dominio/src/contas-a-receber-evolver.ts`, no mesmo molde de
`solicitacao-de-pagamento-evolver.ts`: `evoluirConfiguracaoDeContasAReceber`
constrói o catálogo esperado chamando `applyContasAReceber` sobre um estado
vazio com `{ fixtures: false }` — a mesma técnica do conferidor de 05-09 —
e confere/cria, nesta ordem: a Lista `CR.listId`; os 6 Status (com
`entryRequirements`/`entryFromStatusIds` comparados por JSON estável); os
Campos de `CR.fields`; as 6 Automações `aut_cr_*`; Concessões e Visões.
Três regras duras: nunca remove nada, nunca toca `state.tasks` nem valor de
Campo já gravado, divergência é relatada e nunca sobrescrita.

- **D5-13** — comentário no evolver documentando por que os seis Status
  ficam os seis: `estornado` só é alcançável a partir de `recebido` (é a
  reversão de um recebimento) e `descartado` tem entrada e significado
  diferentes ("não será mais cobrado"). Fundi-los perderia a distinção.
- **D5-14** — confirmado por leitura que `entryRequirements` de
  `CR.status.recebido` já exigia Valor e Data de pagamento sem exceção por
  tipo — o seed **não** tinha exceção para Saque de plataforma, então nada
  foi alterado nessa regra (registrado, não corrigido, porque já estava
  certo).
- **D5-17** — quatro dos cinco Campos de §9 já estavam em `CR.fields`
  (`numeroParcela`/`totalParcelas`, `tipo`, `forma`, `situacao`), e "conta
  tria" já era o Campo `contaRecebimento`, não Tag. O quinto, "Contrato"
  (Vínculo → Gestão contratual), **não foi criado**: Gestão contratual não
  existe na plataforma e está em Deferred Ideas. Registrado como LACUNA no
  padrão D-25, com comentário em `seed-contas-a-receber.ts:101-109`
  explicando por quê.

Do lado da API: `apps/api/src/bootstrap/contas-a-receber.ts` e
`contas-a-receber.cli.ts`, espelhando `solicitacoes.ts`/`solicitacoes.cli.ts`
(dry-run por padrão, `--apply` explícito, `--workspace`, `--membro`), mais
`"contas-a-receber:configurar": "vite-node src/bootstrap/contas-a-receber.cli.ts"`
em `apps/api/package.json:16`.

### Task 2 — Prazos de R4/R5 ajustáveis (`d3d5838`)

Procedência anotada em `seed-contas-a-receber.ts` (≥5 ocorrências de
"Kennedy"): 30 e 60 dias vêm de **um único caso observado**
(`docs/07-processos/contas-a-receber.md` §12) e valem como valor INICIAL
até o Financeiro informar o prazo real (D5-15) — o mesmo mecanismo de D-07.

`ajustarPrazosDeCobranca({ workspaceId, actingMemberId, dryRun, prazoR4,
prazoR5 })` em `apps/api/src/bootstrap/contas-a-receber.ts`: localiza
`aut_cr_r4`/`aut_cr_r5`, grava um `temporalPredicate` novo na versão
publicada com `recordActivity` registrando antes/depois. Duas guardas:
prazo não inteiro ou ≤ 0 é recusa; prazo de R5 ≤ prazo de R4 é recusa (o
escalonamento tem que escalonar). Exposto no CLI:
`npm run contas-a-receber:configurar -w @n1/api -- --prazo-r4=45 --prazo-r5=90 --apply`
— nunca junto com o modo padrão de evolução (dois gestos, dois comandos).

### Task 3 — R7, o Saque recorrente (`1fdc578`)

`garantirSaqueRecorrente({ workspaceId, actingMemberId, dryRun, valor })`:
procura em `CR.listId` uma Tarefa `CR.tipos.saque` com `recurrence`
definida; se existir, CONFERE campo a campo e relata divergência sem
sobrescrever; se não existir, cria UMA Tarefa "Saque da plataforma de
cursos" em `CR.status.disponivelSaque`, com Responsável
`CP.financeiroId`, os Campos `tipo`/`forma`/`contaRecebimento`/`situacao`
corretos, vencimento no primeiro dia útil do mês corrente, e a Regra de
Recorrência copiada campo a campo do seed (`frequency: "mensal"`,
`interval: 1`, `triggerMode: "aoConcluir"`, `businessDays: "posterior"`,
`defaultAssigneeMemberId`, `copies.checklists/subtasks/assignees: false`,
`copies.fieldValues: true`, `copies.fieldValuesExcept: [dataPagamento]`).

D5-14 aplicada aqui também: a Tarefa só nasce com `--valor` informado e
maior que zero; ausente ou zero recusa sem criar nada. Testado que mover o
Saque criado para `recebido` faz nascer a ocorrência do mês seguinte
(B6, `changeTaskStatus`), sem herdar a Data de pagamento.

### Task 4, parte de código (`1d8e99d`)

Caso novo em `apps/api/src/automacoes/scheduler-worker.test.ts` provando
que `catalogoDeListasComAgenda` descobre `CR.listId` sozinho — um estado com
as Automações `aut_cr_r2`/`aut_cr_r4`/`aut_cr_r5` publicadas faz `CR.listId`
aparecer no catálogo ao lado de `CP.listId`, sem nenhuma linha de código
nova no motor. Isso é a única fração da Task 4 executada; os passos
operacionais (marcar `MARCO_ZERO`, rodar o Ensaio, ler o relato, liberar)
ficam pendentes.

## O que NÃO foi feito, e quem faz cada parte

| Pendência | Task do plano | Dono |
|---|---|---|
| Importar as 240 Tarefas históricas de Contas a receber em ws_n1 | pré-requisito da Task 4 (fora deste plano) | 05-11 |
| Gravar `MARCO_ZERO` para `(ws_n1, lst_contas_a_receber)` via `marcarMarcoZero`/`--so-marco-zero` | 4, passo 1 | Executor (backstop; idempotente se 05-11 já gravou) |
| Deixar a primeira volta rodar em Ensaio (`ensaioNaPrimeiraVolta`, apps/api com `AUTOMACOES_WORKER_ATIVO=true`) | 4, passo 2 | Executor/dono do produto (acesso ao processo apps/api em produção) |
| Ler o relato em `plataforma.automacao_agenda` (`last_error_code = 'ENSAIO_PRIMEIRA_VOLTA'`) e comparar com a contagem de Tarefas | 4, passo 3 | Executor/dono do produto (acesso ao Postgres) |
| Liberar a Lista: `npm run automacoes:liberar -w @n1/api -- ws_n1 lst_contas_a_receber` | 4, passo 4 | Executor/dono do produto |
| Confirmar que a primeira volta real bate com o Ensaio e nenhuma Execução agiu antes de `MARCO_ZERO` | 4, passo 5 | Executor/dono do produto |
| `--apply` do evolver (Task 1), do ajuste de prazo (Task 2) e do Saque recorrente (Task 3) contra ws_n1 | — | Dono do produto, quando decidir aplicar (dry-run já confirmou zero divergências) |

## Runbook operador para a Task 4 (registrado para execução futura, em ordem)

1. `npm run contas-a-receber:importar -w @n1/api -- --so-marco-zero` —
   backstop; idempotente se o `--apply` de 05-11 já gravou `MARCO_ZERO`.
2. Deixar a primeira volta rodar em Ensaio (`ensaioNaPrimeiraVolta` default
   `true`, `apps/api/src/index.ts:120`), com `apps/api` rodando e
   `AUTOMACOES_WORKER_ATIVO=true`. **Caveat:** `worker.iniciar()` usa
   `setInterval` — a primeira volta só acontece depois de
   `AUTOMACOES_INTERVALO_MS` (default 1h); não existe CLI de "rodar uma vez"
   em produção.
3. Ler:
   ```sql
   select dia_civil, estado, last_error_code, executadas, falhadas, puladas, concluido_em
   from plataforma.automacao_agenda
   where workspace_id='ws_n1' and list_id='lst_contas_a_receber'
   order by dia_civil;
   ```
   Esperado: uma linha com `ENSAIO_PRIMEIRA_VOLTA`.
4. Só então: `npm run automacoes:liberar -w @n1/api -- ws_n1 lst_contas_a_receber`.
5. Depois da primeira volta real: as Execuções batem com o Ensaio; nenhuma
   agiu sobre Tarefa anterior a `MARCO_ZERO`.

**Expectativa do Ensaio depois da importação das 240** (a partir da
distribuição de status do próprio plano de importação: 1 a receber, 1
pendente, 47 descartado, 191 recebido): `executadas` entre 1 e 3, `puladas`
em torno de 700 (as 6 Automações avaliando ~191-234 Tarefas elegíveis
vezes múltiplas condições), `falhadas` entre 0 e 1 (R4 —
`mentionClientOwner` — pode falhar se um cliente não tiver Vínculo). Alarme
= `executadas` muito maior que isso; nesse caso NÃO liberar — é sinal de
`MARCO_ZERO` não ter pegado ou de uma condição errada. Comparar com uma
contagem fresca de `contas-a-receber:conferir` na hora.

## Verificação executada nesta sessão

- Typecheck dos três workspaces: verde.
- Lint: verde.
- `npm run test --workspace=@n1/dominio` — 512/512.
- `npm run test --workspace=@n1/web` — 167/167.
- `npm run test --workspace=@n1/dominio -- contas-a-receber-evolver` — 9/9.
- `npm run test --workspace=@n1/api -- bootstrap/contas-a-receber` — 11/11, rodado duas vezes seguidas (estável).
- `npm run test --workspace=@n1/api -- scheduler-worker` — 23/23, rodado duas vezes seguidas (~70s cada, estável).
- Suíte completa de `apps/api` **deliberadamente não executada** — histórico de estourar o watchdog do agente contra Postgres real (554s+, ver MEMORY do usuário).
- Dry-run contra ws_n1:
  ```
  npm run contas-a-receber:configurar -w @n1/api -- --workspace=ws_n1
  → modo dry-run (nada gravado)
  criados: 0, conferidos: 23, divergentes: 0
  (1 Lista + 6 Status + 8 Campos + 6 Automações + 0 Concessões + 2 Visões)
  ```
  Bate exatamente com o resultado da conferência de 05-09 (zero
  divergências). **Não executado:** `--apply`, `--prazo-r4/--prazo-r5
  --apply`, `--saque-recorrente --apply`.

## Task Commits

Tasks 1, 2 e 3 concluídas por inteiro. A parte de código da Task 4
(caso novo em `scheduler-worker.test.ts`) também concluída. Os passos
operacionais da Task 4 (`MARCO_ZERO`, Ensaio, liberação) permanecem
pendentes — nenhum commit de "conclusão de plano" foi feito para eles.

1. **Evolver de Contas a receber** — `5c41395` (feat) —
   `feat(05-10): evolver de Contas a receber — criar-ou-conferir, D5-13/D5-14/D5-17`
2. **Prazos de R4/R5 ajustáveis** — `d3d5838` (feat) —
   `feat(05-10): prazo de R4/R5 vira parâmetro ajustável, com a procedência anotada`
3. **R7 — Saque de plataforma** — `1fdc578` (feat) —
   `feat(05-10): R7 — o Saque de plataforma volta a nascer sozinho, com Valor > 0`
4. **Prova de descoberta dinâmica de `CR.listId`** — `1d8e99d` (test) —
   `test(05-10): prova que CR.listId é descoberto pelo scheduler sem código novo no motor`

## Files Created/Modified

- `packages/dominio/src/contas-a-receber-evolver.ts` — o evolver criar-ou-conferir
- `packages/dominio/src/contas-a-receber-evolver.test.ts` — idempotência, adulteração, divergência
- `packages/dominio/src/seed-contas-a-receber.ts` — procedência de 30/60 (Kennedy), lacuna do Campo "Contrato"
- `apps/api/src/bootstrap/contas-a-receber.ts` — `configurarContasAReceber`, `ajustarPrazosDeCobranca`, `garantirSaqueRecorrente`
- `apps/api/src/bootstrap/contas-a-receber.cli.ts` — CLI com dry-run padrão, `--prazo-r4`/`--prazo-r5`, `--saque-recorrente --valor`
- `apps/api/src/bootstrap/contas-a-receber.test.ts` — testes de API para as três funções
- `apps/api/package.json` — script `contas-a-receber:configurar`
- `apps/api/src/automacoes/scheduler-worker.test.ts` — caso de descoberta dinâmica de `CR.listId`

## Decisions Made

- **Escopo PARCIAL**, decidido pelo usuário em resposta direta à pergunta do
  orquestrador ("Como seguimos com o relógio de Contas a receber (05-10 Task
  4) e a importação (05-11)?"): **"Relógio depois do 05-11 (Recomendado)"**.
  As Tasks 1-3 (todo o código) ficam concluídas e commitadas; a Task 4 fica
  aberta, com o runbook exato registrado acima para quando 05-11 terminar.
- **Nada foi aplicado em ws_n1.** O `--apply` do evolver, do ajuste de prazo
  e do Saque recorrente não rodaram — só o dry-run, que confirmou zero
  divergências e não grava nada. Decisão de quando aplicar é do dono do
  produto/executor da Task 4, junto com o runbook.
- **`MARCO_ZERO` não foi gravado.** Só faz sentido depois de 05-11 importar
  as 240 Tarefas, pelo motivo técnico já registrado (liberação é
  definitiva por Lista; medir uma Lista vazia não prova nada).

## Deviations from Plan

Nenhum desvio de regra 1-4. O plano original previa quatro tasks completas
nesta execução; a execução real cobre as Tasks 1, 2 e 3 inteiras (evolver,
prazos ajustáveis, R7 com testes de recorrência) mais a parte de código da
Task 4 (o caso de teste de descoberta dinâmica). Os passos operacionais da
Task 4 ficam integralmente pendentes, por decisão explícita do usuário
documentada acima, não por correção automática do executor.

## Known Stubs

Nenhum. Todo o código criado é funcional e testado (evolver, CLI, ajuste de
prazo, Saque recorrente) — não há dado mockado nem caminho renderizando
placeholder. O Campo "Contrato" ausente é lacuna registrada por decisão
(D5-17/D-25), não stub.

## Threat Flags

Nenhum. Esta sessão não introduz superfície nova além da já mapeada no
`threat_model` do plano (T-5-31 a T-5-34, T-5-SC) — as mitigações
(`MARCO_ZERO` + Ensaio, criar-ou-conferir sem sobrescrever, `recordActivity`
no ajuste de prazo, dry-run padrão) estão implementadas em código e
testadas; a mitigação de T-5-31 (as duas barreiras contra disparo sobre o
passado) só se torna operacionalmente ativa quando a Task 4 rodar.

## Self-Check: PASSED

- `packages/dominio/src/contas-a-receber-evolver.ts` — FOUND
- `packages/dominio/src/contas-a-receber-evolver.test.ts` — FOUND
- `apps/api/src/bootstrap/contas-a-receber.ts` — FOUND
- `apps/api/src/bootstrap/contas-a-receber.cli.ts` — FOUND
- `apps/api/src/bootstrap/contas-a-receber.test.ts` — FOUND
- `apps/api/src/automacoes/scheduler-worker.test.ts` — FOUND
- Commit `5c41395` — FOUND em `git log --oneline`
- Commit `d3d5838` — FOUND em `git log --oneline`
- Commit `1fdc578` — FOUND em `git log --oneline`
- Commit `1d8e99d` — FOUND em `git log --oneline`
- `grep -c "contas-a-receber:configurar" apps/api/package.json` → `1`
- `grep -c "Kennedy" packages/dominio/src/seed-contas-a-receber.ts` → `5`
- `grep -n "Contrato" packages/dominio/src/seed-contas-a-receber.ts` → lacuna registrada presente (linhas 101, 109)
