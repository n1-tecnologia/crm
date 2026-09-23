---
phase: 03-contas-a-pagar
plan: 14
subsystem: payments
tags: [d3-03, ensaio, conferencia, relatorio, caneta, omie, clickup-cutover]

# Dependency graph
requires:
  - phase: 03-contas-a-pagar (Plan 03-04)
    provides: "runLancamentoAgent com rehearsal:true gravando AgentExecution de sombra; a tripla conta/categoria/código no passo de raciocínio"
  - phase: 03-contas-a-pagar (Plan 03-08)
    provides: "plataforma.automacao_agenda, CODIGOS_DA_AGENDA, criarSchedulerWorker() — a agenda por dia civil que a cobertura lê"
  - phase: 03-contas-a-pagar (Plan 03-11)
    provides: "a ponte HTTP do Agente (invocar-agente.ts) que faria o Ensaio real acontecer em produção — ainda parada no checkpoint de produção"
  - phase: 03-contas-a-pagar (Plan 03-13)
    provides: "o gatilho de D3-08 (conversão Solicitação → Conta) que o passo 7 do runbook confere ter sido usado"
provides:
  - "compararEnsaio/PREFIXO_LANCAMENTO_HUMANO/textoDoLancamentoHumano/lancamentoHumanoDe/LIMIAR_DA_CANETA em packages/dominio/src/operations/financeiro.ts (Task 1, já commitada antes desta execução — afbba99)"
  - "DialogoLancamentoNoOmie — o gesto que o Financeiro usa para registrar o que lançou no Omie, sem ver a resposta do Agente"
  - "npm run ensaio:relatorio -w @n1/api — coberturaDaJanela/agregar/renderizar/detalharPorConta, os sete portões G1-G7 computados a partir de dado real"
  - "docs/08-migracao-financeiro/06-runbook-de-corte.md — os onze passos do corte, escrito mas não executado"
affects: [03-VERIFICATION, ROADMAP-criterio-1]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Três camadas por arquivo (I/O único / agregação pura / renderização pura) para que o teste cubra as duas últimas sem DATABASE_URL — mesmo molde de importar-contas-a-pagar.ts (03-10)"
    - "Relatório versionado (agregado, sanitizado) + detalhe individual fora do git (LGPD) — precedente de relatorioSanitizado (03-10) reaplicado a um domínio novo"
    - "Ordem de decisão: dia_sem_medicao e viés de seleção (sem_lancamento_humano) são verificados ANTES de qualquer portão — um relatório que não pode ser produzido honestamente não produz número"

key-files:
  created:
    - apps/web/src/features/tarefa/lancamento-no-omie-dialog.tsx
    - apps/web/src/features/tarefa/lancamento-no-omie-dialog.test.tsx
    - apps/api/src/relatorios/ensaio-do-agente.ts
    - apps/api/src/relatorios/ensaio-do-agente.test.ts
    - apps/api/src/relatorios/ensaio-do-agente.cli.ts
    - apps/api/src/relatorios/CONTEXT.md
    - docs/08-migracao-financeiro/06-runbook-de-corte.md
  modified:
    - apps/web/src/features/estrutura/tarefa-completa.tsx
    - apps/api/package.json
    - .gitignore

key-decisions:
  - "Task 4 (o runbook) foi ESCRITO mas NÃO executado — o objetivo do plano é medir o Ensaio contra uma semana real de operação e decidir um corte irreversível (arquivar a Lista 901107637383); nenhuma das duas coisas é simulável ou aproximável neste ambiente sem inventar dado ou tomar uma decisão de negócio em nome do dono do produto/Financeiro."
  - "O comando ensaio:relatorio foi rodado de verdade contra ws_n1 de produção (só leitura) para provar que ele mede honestamente mesmo sem dado real: saiu INCONCLUSIVO (exit 2) porque plataforma.automacao_agenda não tem nenhuma linha ainda — a agenda real nunca rodou (03-10 Task 4 e 03-11 Task 3 seguem parados). O artefato dessa corrida foi descartado antes do commit, mesmo precedente de 03-10."
  - "O inventário de Grants gr_cp_pessoa_* (passo 3 do runbook) NÃO foi executado nesta sessão, mesmo sendo tecnicamente uma consulta somente-leitura: o passo só faz sentido depois do passo 2 (importação histórica real), que não rodou — inventariar Grants contra um Espaço sem Tarefas importadas não responderia a pergunta que o passo 3 faz, e executar um passo isolado de um runbook de 11 passos sequenciais criaria um estado parcial e confuso em vez de um checkpoint limpo."

patterns-established:
  - "CLI de relatório executado contra produção como parte da própria verificação de Task, não só de teste — a saída honesta (INCONCLUSIVO) é evidência de correção, não de falha"

requirements-completed: [PAG-03]

# Metrics
duration: ~120min (Tasks 1-3 completas e verificadas; Task 4 escrita, não executada)
completed: 2026-09-23
---

# Phase 3 Plan 14: A conferência do Ensaio, o relatório e o runbook do corte — Summary

**`compararEnsaio` (domínio) julga a tripla que o Agente ensaiou contra o que o Financeiro registrou ter lançado no Omie; `DialogoLancamentoNoOmie` captura esse registro sem nunca mostrar a resposta do Agente; `npm run ensaio:relatorio` computa os sete portões da caneta a partir de dado real — rodado contra `ws_n1` de produção, saiu `INCONCLUSIVO` porque a agenda real do Ensaio ainda não processou um único dia. O runbook de corte está escrito; a semana de operação real, a pergunta ao Financeiro e o arquivamento da Lista `901107637383` — o objetivo do plano — permanecem no checkpoint bloqueante.**

## Status: TASKS 1-3 COMPLETAS, VERIFICADAS E COMMITADAS. TASK 4 — documento escrito; execução PARADA no checkpoint bloqueante.

Como em 03-07/03-08/03-10/03-11/03-13/03-15, esta execução separa o que é
alcançável por automação (completo) do que exige uma semana real de
operação do Financeiro e uma decisão de negócio irreversível (parado,
documentado, reportado como checkpoint). A diferença deste plano para os
anteriores: aqui o próprio OBJETIVO da fase — a decisão de dar a caneta ao
Agente e arquivar a Lista `901107637383` — é o que está bloqueado, não uma
tarefa acessória. Não há forma honesta de simular isso sem inventar uma
medição que não existe.

## Performance

- **Tasks:** 3 de 4 completas por padrão de plano (Tasks 1-3); Task 4 tem o
  documento escrito, a execução dos onze passos PARADA.
- **Files created:** 7 · **Files modified:** 3
- **Testes novos:** 15 (domínio, Task 1, já commitados antes desta sessão —
  `ensaio-do-agente.test.ts` de `packages/dominio`) + 4 (`apps/web`,
  Task 2) + 10 (`apps/api`, Task 3, 9 puros + 1 contra Postgres real)

## Accomplishments

- **Task 1 (contrato do domínio) já estava commitada quando esta execução
  começou** (`afbba99`, sessão anterior): `compararEnsaio`,
  `PREFIXO_LANCAMENTO_HUMANO`/`textoDoLancamentoHumano`/`lancamentoHumanoDe`,
  `descreverPassoDeDePara`/`lerPassoDeDePara`, `ensaioDaConta`,
  `LIMIAR_DA_CANETA`. `contaSemResumo` (INV-CP-01) aceita o registro humano
  como terceira evidência. 480 testes no domínio, `operations.test.ts` e
  `agente-de-lancamento.test.ts` sem diff.
- **Task 2 estava com os três arquivos já escritos e testados, mas não
  commitados** — esta execução verificou (4/4 testes do componente, 144/144
  em `@n1/web`, `verificar:tokens` 0 falhas, os quatro `grep`s de T-3-66/67
  em 0) e commitou (`6bec6c4`). `DialogoLancamentoNoOmie` é texto livre nos
  três campos, de propósito (T-3-67 — nenhuma lista de categoria, para não
  contaminar a medição por viés de assentimento); o aviso de INV-CP-01 em
  `tarefa-completa.tsx` ganha a terceira saída e o botão que abre o diálogo.
- **Task 3 (o relatório executável) foi construída do zero nesta execução.**
  `apps/api/src/relatorios/ensaio-do-agente.ts` — `coberturaDaJanela`
  (a única leitura de banco: cruza `plataforma.automacao_agenda` com os
  Ensaios e as candidatas a A7 de cada dia civil), `agregar` (pura: sete
  portões, taxas sempre com denominador, `INCONCLUSIVO` calculado ANTES de
  qualquer portão quando a janela não mediu ou o viés de seleção passa do
  teto) e `renderizar` (pura, T-3-65 — nenhum `taskId`/título/valor/CNPJ/Pix
  entra no markdown/json). `npm run ensaio:relatorio -w @n1/api` compõe tudo,
  grava o agregado versionado e o detalhe fora do git.
- **O comando foi rodado de verdade contra `ws_n1` de produção** (janela
  `2026-09-01`/`2026-09-23`, só leitura): saiu `INCONCLUSIVO` — `exit 2` —
  com os 23 dias classificados `sem_agenda`, porque
  `plataforma.automacao_agenda` não tem nenhuma linha para
  `lst_contas_a_pagar` ainda. **Isto é a prova de que o relatório não
  inventa taxa sobre dado que não existe**, exatamente o que T-3-67 exige.
  O artefato dessa corrida de verificação foi apagado antes do commit
  (mesmo precedente de 03-10).
- **Task 4: o runbook foi escrito** (`docs/08-migracao-financeiro/06-runbook-de-corte.md`),
  com os onze passos, dono e condição verificável por passo, os dois
  resíduos herdados (Grants `gr_cp_pessoa_*` de 03-05, credenciais Omie de
  03-07) e as três continuações registradas (Tags `conta *` sem
  equivalente, ausência de recusa por conta não resolvida, ausência de
  operação de revogação de Grant). **A execução dos onze passos NÃO
  aconteceu** — ver "Por que a Task 4 não avançou", abaixo.

## Task Commits

1. **Task 1: O contrato da conferência no domínio** — `afbba99` (feat) — já commitada antes desta sessão de execução; verificada, não refeita.
2. **Task 2: O gesto que captura a resposta humana** — `6bec6c4` (feat) — arquivos já escritos por uma sessão anterior, verificados e commitados nesta execução.
3. **Task 3: O relatório executável** — `d6b0946` (feat)
4. **Task 4 (parcial — só o documento): o runbook do corte** — `1167a83` (docs) — escrito, NÃO executado; ver checkpoint abaixo.

## Files Created/Modified

- `apps/web/src/features/tarefa/lancamento-no-omie-dialog.tsx` *(criado)* — `DialogoLancamentoNoOmie`, `lancamentoNoOmieRecusado`
- `apps/web/src/features/tarefa/lancamento-no-omie-dialog.test.tsx` *(criado, 4 casos)*
- `apps/web/src/features/estrutura/tarefa-completa.tsx` *(modificado)* — terceira saída do aviso de INV-CP-01 + botão do diálogo
- `apps/api/src/relatorios/ensaio-do-agente.ts` *(criado, 527 linhas)* — `coberturaDaJanela`, `agregar`, `renderizar`, `detalharPorConta`
- `apps/api/src/relatorios/ensaio-do-agente.test.ts` *(criado, 10 casos — 9 puros + 1 contra Postgres real)*
- `apps/api/src/relatorios/ensaio-do-agente.cli.ts` *(criado)* — CLI fino, `npm run ensaio:relatorio`
- `apps/api/src/relatorios/CONTEXT.md` *(criado)*
- `apps/api/package.json` *(modificado)* — script `ensaio:relatorio`
- `.gitignore` *(modificado)* — `conferencia-detalhada.csv` fora do git
- `docs/08-migracao-financeiro/06-runbook-de-corte.md` *(criado)* — os onze passos, escrito, não executado

## Decisions Made

Ver `key-decisions` no frontmatter. Resumo: a Task 4 fica intencionalmente
parada num estado "documento escrito, execução não iniciada" — nem um passo
dos onze foi tocado, nem mesmo o inventário somente-leitura de Grants do
passo 3, porque ele só responde a uma pergunta real depois do passo 2
(importação histórica), que também não rodou. Executar um passo isolado de
um runbook sequencial produziria um estado parcial sem sentido — o
checkpoint limpo é não começar a sequência, não parar no meio dela.

## Deviations from Plan

Nenhuma no sentido de bug ou lacuna crítica corrigida. Duas notas de
execução, não desvios de regra:

**1. Tasks 1 e 2 chegaram parcialmente feitas de uma sessão anterior.**
Ao iniciar esta execução, `packages/dominio/src/operations/financeiro.ts`
já tinha o contrato da Task 1 commitado (`afbba99`), e os três arquivos da
Task 2 já existiam no working tree, staged, mas sem commit. Esta execução
leu, verificou (testes, `grep`s de aceite, `verificar:tokens`) e commitou o
que já estava correto — não reescreveu nada. Nenhuma linha de código da
Task 1/2 foi alterada por esta sessão além do commit em si.

**2. `min_lines: 180` do `must_haves.artifacts` para `ensaio-do-agente.ts`
foi superado com folga (527 linhas)** — não é um desvio, é o resultado
natural de três camadas bem documentadas (I/O, agregação, renderização)
mais os comentários que explicam a ordem de decisão e o porquê de cada
portão, no mesmo padrão de densidade de comentário que o resto da fase usa.

---

**Total deviations:** 0 auto-fixes (Rules 1-3); 0 decisões arquiteturais (Rule 4).
**Impact on plan:** Nenhum scope creep. O trabalho de código do plano (Tasks 1-3) está completo, testado (dominio 480, web 144, o arquivo novo de `apps/api` 10/10 contra Postgres real) e verificado contra produção real (leitura).

## Issues Encountered

- **`npm run test -w @n1/api` (suíte inteira, 57 arquivos, 498 casos) contra
  o Supabase real levou 943,81s (~15min43s)** — decompor por arquivo (como
  as Tasks fizeram durante o desenvolvimento) e rodar a suíte inteira em
  background, monitorando por PID em vez de reler a saída repetidamente, é
  o que funciona de forma confiável nesta máquina (mesmo achado de 03-10/03-11).
  Resultado da rodada completa: **484 passed · 2 failed · 12 skipped (498)**.
- **As duas únicas falhas são um teste PRÉ-EXISTENTE e NÃO RELACIONADO**
  (`src/e2e/lote-contas-a-pagar.test.ts`, casos (d)/(e), Plan 03-12) — ambas
  **estouraram o timeout de 180000ms durante a rodada completa**, o mesmo
  padrão de flake ambiental que 03-10 já documentou para
  `classificacoes.test.ts` (contenção de recursos sob carga de rede real
  quando 57 arquivos disputam o mesmo Supabase em paralelo, não uma quebra
  de código). Fora do escopo de 03-14 por completo: nenhum arquivo tocado
  por este plano tem relação com o lote de Contas a pagar. **Confirmado como
  flake, não regressão**: `npm run test -w @n1/api -- src/e2e/lote-contas-a-pagar.test.ts`
  rodado isoladamente logo em seguida passou **6/6 em 99,32s**, bem dentro do
  timeout de 180s quando não compete por conexão/CPU com o resto da suíte.
  Não corrigido aqui (SCOPE BOUNDARY) — nenhuma linha do arquivo tem diff.
- **Este ambiente TEM acesso a `DATABASE_URL` real** (via `apps/api/.env`,
  lido por `carregarEnv()`) — diferente da suposição do `<wave_context>` de
  que "nenhum acesso a produção" se aplicaria a este plano inteiro. Isso
  permitiu completar e verificar a Task 3 (incluindo o caso (i) contra
  Postgres real) e rodar o CLI de verdade contra `ws_n1`. O que continua
  genuinamente inacessível é a VPS do `automation/`, as credenciais Omie
  reais, o `browser`/produção do ClickUp, e — mais fundamentalmente — o
  TEMPO de calendário de uma semana real de operação, que nenhum acesso a
  banco resolve.

## User Setup Required

**Sim — é o runbook inteiro (Task 4), que exige, em sequência:** a
importação histórica real (03-10 Task 4, `--apply` contra `ws_n1`); a
ponte HTTP do Agente ligada em produção (03-11 Task 3, que depende do
`PLATAFORMA_LANCAMENTO_TOKEN` provisionado — mesmo resíduo de 03-07 Task 4);
`apps/api` no ar contra a VPS de produção com
`AGENTE_CONTAS_A_PAGAR_ATIVO=true` e `AGENTE_CONTAS_A_PAGAR_MODO` ausente;
uma semana de calendário inteira de operação real do Financeiro, registrando
cada lançamento pela caixa da Task 2; a verificação das credenciais Omie
TRIA (`OMIE_TRIA_APP_KEY`/`OMIE_TRIA_APP_SECRET`) no `.env` de produção do
`automation/`; e, ao final, a decisão do dono do produto com o Financeiro
sobre os sete portões do relatório, seguida — só se `CONCEDER` e só depois
de confirmado que a conversão D3-08 foi usada de verdade — do arquivamento
da Lista `901107637383`.

Nenhuma dessas ações é alcançável por este executor. Ver
`docs/08-migracao-financeiro/06-runbook-de-corte.md` para os passos exatos
e `## CHECKPOINT REACHED` desta execução.

## Por que a Task 4 não avançou

As Tasks 1-3 entregaram tudo que o plano pede em código: o contrato de
comparação, o gesto de captura humana, e um comando que lê dado real e
imprime um veredito medido. O que falta não é código — é a semana de
operação real que o próprio D3-03 exige antes de decidir qualquer coisa
sobre a caneta, e o passo irreversível que fecha o processo (arquivar a
Lista `901107637383`). Nenhuma das duas coisas é aproximável sem violar a
integridade que o plano inteiro protege: medir DEPOIS de ela acontecer, não
antes.

Uma verificação parcial foi deliberadamente evitada: o passo 3 do runbook
(inventário de Grants `gr_cp_pessoa_*`) é tecnicamente uma consulta
somente-leitura, alcançável neste ambiente. Não foi executada porque o
passo só responde a uma pergunta significativa DEPOIS do passo 2
(importação histórica real, ainda parada) — rodá-lo isoladamente contra um
`ws_n1` sem nenhuma Tarefa importada produziria uma resposta tecnicamente
correta ("nenhuma Grant aponta para Tarefa importada, porque não existe
Tarefa importada nenhuma") mas vazia de sentido, e um SUMMARY que misturasse
esse fragmento com os passos 4-11 genuinamente bloqueados criaria a
aparência de progresso onde não há decisão nenhuma tomada.

## Next Phase Readiness

- **O código da fase inteira, para o critério 1 do ROADMAP, está pronto.**
  O que falta é execução real: 03-10 Task 4 (importação), 03-11 Task 3
  (ponte em produção), e agora 03-14 Task 4 (a semana + a decisão + o
  arquivamento) — as três convergem no mesmo acesso a VPS/credenciais que
  03-07/03-08/03-13/03-15 já nomearam.
- **`npm run ensaio:relatorio` está pronto para o passo 8 do runbook no dia
  em que a semana de Ensaio real acontecer** — testado, e já provado
  honesto contra produção real (saída `INCONCLUSIVO` correta quando não há
  dado).
- **Nenhuma migração nova** (`005` de 03-01 continua sendo a única da
  fase) — a conferência mora em Comentário e em `AgentExecution`, que já
  persistem pelo diff da Unidade de Trabalho.
- **Fase 3 (contas-a-pagar): 15/15 plans com SUMMARY nesta árvore agora**
  (03-14 era o único faltando). Todas as pendências de produção da fase
  (03-07/03-08/03-10/03-11/03-13/03-14/03-15) convergem no mesmo acesso a
  VPS e a credenciais reais — um runbook humano único provavelmente fecha
  várias de uma vez, com este documento (`06-runbook-de-corte.md`) como o
  roteiro para a mais importante delas.
- **`roadmap update-plan-progress` marcou "Phase 3: Contas a pagar" como
  `[x]` Complete (15/15, 2026-09-23) em `ROADMAP.md`** — isso é contagem de
  EXISTÊNCIA de SUMMARY.md, não fechamento verificado. Sete dos quinze
  planos (03-07/03-08/03-10/03-11/03-13/03-14/03-15) documentam, dentro do
  próprio SUMMARY, um checkpoint bloqueante de produção ainda aberto, e o
  critério 1 da própria fase é exatamente o que esta Task 4 não executou.
  Registrado como ressalva em `STATE.md` § Blockers/Concerns para que uma
  rodada de `/gsd-verify-phase 3` não confunda "tabela diz Complete" com
  "pronta para a Phase 4".

## Known Stubs

Nenhum. Todos os símbolos novos são exercitados por teste real (unitário,
ou contra Postgres real) ou por execução real (o CLI, contra `ws_n1`).

## Threat Flags

Nenhuma superfície nova fora do `<threat_model>` do próprio plano — T-3-65
a T-3-71 têm disposição `mitigate` implementada e provada:
- T-3-65 (vazamento no relatório versionado): caso (h) do teste, `not.toContain`
  para título/CNPJ/Pix/valor da fixture, `not.toMatch(/tsk_/)`.
- T-3-66 (registro humano virar um segundo RESUMO): grep de aceite em 0
  para `Pix|codigoBarras|valor|fornecedor` no diálogo.
- T-3-67 (relatório errado para o lado otimista): caso (c) — todo `%` com
  `(n/d)`; casos (d)/(e) — `INCONCLUSIVO` sem taxa; caso (b) — `recusa_correta`
  fora do denominador. Reforçado pela corrida real contra `ws_n1`.
- T-3-68 (caneta concedida sem condição): `LIMIAR_DA_CANETA` é constante do
  domínio (Task 1); G7 nunca `OK` por padrão.
- T-3-69/70/71: sem mudança nesta Task além do que a Task 1/2 já fecharam;
  T-3-71 (ordem do arquivamento) é a estrutura do próprio runbook (passo 10
  depois do 9, condicionado ao 7).

## Self-Check: PASSED

- FOUND: apps/web/src/features/tarefa/lancamento-no-omie-dialog.tsx
- FOUND: apps/web/src/features/tarefa/lancamento-no-omie-dialog.test.tsx
- FOUND: apps/api/src/relatorios/ensaio-do-agente.ts
- FOUND: apps/api/src/relatorios/ensaio-do-agente.test.ts
- FOUND: apps/api/src/relatorios/ensaio-do-agente.cli.ts
- FOUND: apps/api/src/relatorios/CONTEXT.md
- FOUND: docs/08-migracao-financeiro/06-runbook-de-corte.md
- FOUND commit: afbba99 (Task 1, sessão anterior)
- FOUND commit: 6bec6c4 (Task 2)
- FOUND commit: d6b0946 (Task 3)
- FOUND commit: 1167a83 (Task 4 — documento)

---
*Phase: 03-contas-a-pagar*
*Completed: 2026-09-23 (Tasks 1-3; Task 4 parada no checkpoint bloqueante)*
