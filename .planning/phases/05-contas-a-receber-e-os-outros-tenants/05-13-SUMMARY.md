---
phase: 05-contas-a-receber-e-os-outros-tenants
plan: 13
subsystem: dominio
tags: [automations, whatsapp, outbox, contas-a-receber, provenance, cr-02, wr-04, wr-11]

# Dependency graph
requires:
  - phase: 05-contas-a-receber-e-os-outros-tenants (Plan 01)
    provides: "CATALOGO_CONFIGURACAO_POR_EMPRESA / evoluirConfiguracaoPorEmpresa — a Integração do Marcos Paulo com avisosPorCanal.whatsapp"
  - phase: 05-contas-a-receber-e-os-outros-tenants (Plan 06/07)
    provides: "o vocabulário de Canal em automations.ts (destinoDeCanal, PedidoDeNotificacaoPorCanal) e a ponte eventos-de-canal.ts que este plano realinha"
  - phase: 05-contas-a-receber-e-os-outros-tenants (Plan 11)
    provides: "importarContaAReceberHistorica e as 240 Tarefas com provenance.kind === 'import' que a barreira de WR-11 protege"
provides:
  - "destinoDeCanal alinhado à Solicitação de pagamento (fld_sp_c_empresa/fld_sp_z_whatsapp), não mais a Contas a pagar — fecha o lado do domínio de CR-02/D5-19"
  - "CANAL_LISTA_ID/CANAL_CAMPO_EMPRESA_ID/CANAL_CAMPO_WHATSAPP_ID — constantes exportadas, derivadas do catálogo real da Solicitação"
  - "PedidoDeNotificacaoPorCanal.indicePasso — a posição do passo na Execução (WR-04)"
  - "aggregateId = `<executionId>:<indicePasso>` no evento de outbox de Canal — fecha o lado da ponte de WR-04"
  - "barreira estrutural em runScheduledAutomations: Tarefa com provenance.kind === 'import' nunca dispara gatilho temporal anterior ao dia civil da importação (WR-11)"
  - "\"Marcos Paulo\" como 12ª opção de fld_sp_c_empresa (D5-19/TEN-01)"
affects: ["05-18 (automation/ realinha notificar-canal-routes.ts ao mesmo alvo)", "05-21 (migração 006, índice único parcial que o aggregateId por passo prepara)", "05-24 (contrato ponta a ponta do Canal)", "05-25 (o relógio de Contas a receber, agora com a barreira de WR-11 já em código)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Constantes derivadas do catálogo real em vez de literais soltos, com verificação de rótulo em tempo de import (campoDoCatalogo lança se o catálogo divergir) — nenhum ciclo de import entre automations.ts e solicitacao-de-pagamento(-evolver).ts"
    - "Barreira por proveniência (Task.provenance.kind/at), não por parâmetro extra: pura, não muda assinatura, vale para os três chamadores de runScheduledAutomations (agenda, rota manual, tela) sem que nenhum precise conhecer MARCO_ZERO"
    - "aggregateId composto (`<executionId>:<indicePasso>`) para identidade de evento por PASSO, não por Execução — o payload em si não ganha campo novo"

key-files:
  created:
    - packages/dominio/src/operations/automations-historico.test.ts
  modified:
    - packages/dominio/src/operations/automations.ts
    - packages/dominio/src/operations/automations-canal.test.ts
    - packages/dominio/src/solicitacao-de-pagamento.ts
    - packages/dominio/src/solicitacao-de-pagamento.test.ts
    - apps/api/src/persistencia/eventos-de-canal.ts
    - apps/api/src/persistencia/eventos-de-canal.test.ts

key-decisions:
  - "CANAL_LISTA_ID/CANAL_CAMPO_EMPRESA_ID/CANAL_CAMPO_WHATSAPP_ID são DERIVADAS do catálogo real (LISTA_ID de solicitacao-de-pagamento-evolver.ts, ids de CATALOGO_SOLICITACAO_DE_PAGAMENTO), não literais soltos — confirmado sem ciclo de import (financeiro.ts não importa solicitacao-de-pagamento(-evolver).ts, e nenhum dos dois importa automations.ts). campoDoCatalogo() lança em tempo de import se o catálogo não tiver o Campo esperado no rótulo esperado — a deriva quebra no import, não em produção."
  - "indicePasso reusa step.index (já gravado por execute() como a posição em execucao.steps) em vez de manter um contador próprio em pedidosDeNotificacaoPorCanal — uma única fonte de verdade para a posição do passo."
  - "eventos-de-canal.test.ts e automations-canal.test.ts foram INTEIRAMENTE reescritos sobre a Solicitação (buildSeed + evoluirConfiguracaoDeSolicitacoes + evoluirConfiguracaoPorEmpresa), não só ajustados: o alvo do Canal mudou de Lista, então os testes antigos sobre Contas a pagar passariam a testar exatamente o comportamento RECUSADO."
  - "automations-historico.test.ts usa buildGestaoBootstrap (Automações R2/R4/R5 reais do catálogo, sem fixtures) e importarContaAReceberHistorica de verdade — nunca uma Automação de brinquedo. Como a operação grava provenance.at com new Date() real (não injetável), cada teste importa a conta e substitui a Tarefa em state.tasks com um provenance.at fixo, para o resultado não depender do dia em que a suíte roda."
  - "O caso de controle (WR-11 Task 3, item c) usa um vencimento a 5 dias de 'hoje', não o mesmo vencimento distante dos outros casos: descobri, rodando o teste, que R2 muda o Status da Tarefa via mutação direta (`task.statusId = ...` em changeTaskStatus, não substituição imutável) — então, na MESMA rodada de runScheduledAutomations, R4/R5 também passam a ver Status 'pendente' e cascateiam se seus próprios disparos já tiverem vencido. Isolei o caso de controle para provar só R2, sem depender desse efeito preexistente (não introduzido por este plano)."

requirements-completed: [AUTO-02, REC-01]

# Metrics
duration: ~20min
completed: 2026-09-24
---

# Phase 05 Plan 13: Fechamento de lacunas — o lado do domínio de CR-02, WR-04 e WR-11 Summary

**`destinoDeCanal` passa a falar de Solicitação de pagamento (não mais Contas a pagar), o pedido de Canal carrega o índice do passo para o `aggregateId` por passo do outbox, e nenhum gatilho temporal de `runScheduledAutomations` alcança mais o passado de uma Tarefa importada.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-09-24
- **Tasks:** 3/3
- **Files modified:** 7 (1 criado, 6 modificados — um a mais que o `files_modified` do plano: ver Deviations)

## Accomplishments

- **CR-02/D5-19 (Task 1).** `destinoDeCanal` só resolve destino de Canal em Tarefas da Lista "Solicitações de pagamento" (`CANAL_LISTA_ID`), lendo a Empresa em `fld_sp_c_empresa` (`CANAL_CAMPO_EMPRESA_ID`) e, no modo campo, exigindo `fld_sp_z_whatsapp` (`CANAL_CAMPO_WHATSAPP_ID`) — nunca mais `CP.fields.empresa` ou qualquer Campo de Contas a pagar. Empresa sem `avisosPorCanal.whatsapp` declarado é recusa nos DOIS modos (o par, no domínio, de `EMPRESA_SEM_CANAL` do `automation/`, WR-02).
- **D5-19/TEN-01 (Task 1).** "Marcos Paulo" entra como 12ª opção de `fld_sp_c_empresa`, ao final, sem reordenar as 11 anteriores.
- **WR-04, lado do domínio (Task 1).** `PedidoDeNotificacaoPorCanal` ganha `indicePasso` (a posição do passo em `execucao.steps`) — o payload de `automacao.notificar-canal.v1` continua sem esse campo.
- **WR-04, lado da ponte (Task 2).** `apps/api/src/persistencia/eventos-de-canal.ts`: `aggregateId = \`${executionId}:${indicePasso}\``, nunca só `executionId` — uma Execução com dois passos de Canal agora produz dois eventos distintos. O comentário que atribuía a barreira de duplicidade à migração 003 foi corrigido: hoje nenhum índice cobre esse tipo de evento (o parcial da 004 é só para `solicitacao.criada.v1`); a barreira de banco nasce na migração 006 (plano 05-21).
- **WR-11 (Task 3).** `runScheduledAutomations` ganha a barreira: Tarefa com `provenance.kind === "import"` nunca dispara R2/R4/R5 se o disparo (vencimento + offset) for anterior ao início do dia civil de `provenance.at`. Pura, dado da própria Tarefa — vale para os três chamadores (agenda, `POST /operacoes/runScheduledAutomations`, botão da tela) sem que nenhum precise conhecer `MARCO_ZERO`. Assinatura da função intacta (confirmado por `git diff`).
- Três suítes de teste reescritas/criadas: `automations-canal.test.ts` (15 testes, agora sobre a Solicitação), `eventos-de-canal.test.ts` (10 testes, idem), `automations-historico.test.ts` (5 testes novos, novos, com as Automações reais R2/R4/R5).

## Task Commits

Each task was committed atomically:

1. **Task 1: `destinoDeCanal` fala de Solicitação (D5-19) e o pedido carrega o índice do passo (WR-04)** - `b5a5dfd` (feat)
2. **Task 2: O evento de outbox é por passo — `aggregateId = <executionId>:<indicePasso>` (WR-04, lado da ponte)** - `a744a13` (feat)
3. **Task 3: A barreira do histórico importado — WR-11, antes do relógio** - `8119aaa` (feat)

## Files Created/Modified

- `packages/dominio/src/operations/automations.ts` — `destinoDeCanal` realinhado à Solicitação; `CANAL_LISTA_ID`/`CANAL_CAMPO_EMPRESA_ID`/`CANAL_CAMPO_WHATSAPP_ID` derivadas do catálogo; `PedidoDeNotificacaoPorCanal.indicePasso`; barreira de WR-11 em `runScheduledAutomations`.
- `packages/dominio/src/operations/automations-canal.test.ts` — reescrito inteiro sobre a Solicitação (buildSeed + evoluirConfiguracaoDeSolicitacoes + evoluirConfiguracaoPorEmpresa); 15 testes cobrindo os 9 casos de `<behavior>`, o teste de deriva das constantes e o teste do catálogo (12 opções).
- `packages/dominio/src/solicitacao-de-pagamento.ts` — "Marcos Paulo" acrescentada a `OPCOES_EMPRESA`.
- `packages/dominio/src/solicitacao-de-pagamento.test.ts` — contagem de opções de "Empresa" corrigida de 11 para 12 (deviation, ver abaixo).
- `packages/dominio/src/operations/automations-historico.test.ts` (novo) — 5 testes de WR-11 com R2/R4/R5 reais sobre Tarefas importadas.
- `apps/api/src/persistencia/eventos-de-canal.ts` — `aggregateId` por passo; comentário da migração 003 corrigido.
- `apps/api/src/persistencia/eventos-de-canal.test.ts` — reescrito sobre a Solicitação; casos novos de dois passos e de recusa por Empresa sem canal.

## Decisions Made

Ver `key-decisions` no frontmatter. Resumo:
- Constantes `CANAL_*` derivadas do catálogo real (sem ciclo de import), com verificação de rótulo em tempo de import.
- `indicePasso` reusa `step.index` já gravado por `execute()`.
- Os dois arquivos de teste de Canal (domínio e `apps/api`) foram reescritos, não ajustados, porque o alvo mudou de Lista.
- `automations-historico.test.ts` fixa `provenance.at` manualmente (a operação usa o relógio real, não injetável).
- O caso de controle de WR-11 usa um vencimento próximo de "hoje" para isolar o efeito provado, evitando um cascateamento pré-existente (R2 muda Status por mutação direta) que não é desta Task.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `solicitacao-de-pagamento.test.ts` afirmava 11 opções de "Empresa" — quebrou depois de D5-19 acrescentar "Marcos Paulo"**
- **Found during:** Task 3, ao rodar a suíte inteira do domínio como o plano pede ("Depois, rode a suíte inteira do domínio... para provar que nenhuma Automação temporal de Contas a pagar dependia de agir sobre Tarefa importada")
- **Issue:** O teste `(e) as contagens de opções batem com a spec` de `solicitacao-de-pagamento.test.ts` (pré-existente, de uma fase anterior) afirmava `contagem("Empresa")` = 11 — a contagem ANTES da mudança de catálogo que a Task 1 deste plano fez.
- **Fix:** Contagem corrigida para 12, com comentário explicando a exceção deliberada à spec original (D5-19/TEN-01), no mesmo padrão do comentário já existente sobre D5-06/`em revisão`.
- **Files modified:** `packages/dominio/src/solicitacao-de-pagamento.test.ts`
- **Verification:** `npm run test -w @n1/dominio` — 531/531 verde (antes: 530/531, 1 falha).
- **Committed in:** `8119aaa` (Task 3 commit — descoberto e corrigido dentro da mesma Task que exigia rodar a suíte inteira)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug em teste pré-existente, consequência direta e esperada da mudança de catálogo da Task 1)
**Impact on plan:** Necessário para a suíte inteira do domínio ficar verde, como a Task 3 exige. Nenhum scope creep — o teste corrigido só passou a refletir o catálogo real, sem tocar em comportamento.

## Issues Encountered

- **Teste de controle de WR-11 (Task 3, item c) inicialmente falhou com `executed: 2` em vez de `executed: 1`.** Investigação por script de depuração (não commitado) mostrou que `changeTaskStatus` (em `tasks.ts`) muta `task.statusId` diretamente no objeto — não substitui a entrada em `state.tasks` por um objeto novo. Como `runScheduledAutomations` mantém a mesma referência de `task` ao iterar as Automações condicionais da Lista para aquela Tarefa, quando R2 (offset +1) muda o Status para "pendente" DENTRO da rodada, R4/R5 (offset +30/+60) passam a ver esse Status novo na MESMA chamada — e, se o disparo deles já tiver vencido, cascateiam. Isso é um comportamento PREEXISTENTE do motor (não introduzido por este plano); o teste de controle foi ajustado para usar um vencimento a 5 dias de "hoje" (só R2 vencido, R4/R5 ainda não), isolando exatamente o que a Task 3 precisa provar — que a Tarefa NÃO importada dispara R2 normalmente — sem depender desse efeito lateral. Nenhum código de produção foi alterado por esta investigação.

## User Setup Required

None — nenhuma configuração de serviço externo. Este plano só toca `packages/dominio` e a ponte pura `apps/api/src/persistencia/eventos-de-canal.ts`; não há rota nova, migração nova nem variável de ambiente.

## Verificação executada nesta sessão (regras operacionais do projeto)

- `npm install --prefer-offline --no-audit --no-fund` na raiz do worktree, ANTES do primeiro typecheck — confirmado por `readlink -f node_modules/@n1/dominio` apontando para dentro do worktree; `package-lock.json` sem diff.
- `npm run typecheck -w @n1/dominio` — verde, rodado 5 vezes ao longo da execução (após cada task e após a correção do teste pré-existente).
- `npm run typecheck -w @n1/api` — verde (rodado após Task 2 e na verificação final).
- `npm run test -w @n1/dominio -- automations-canal` — 15/15 verde (Task 1).
- `npm run test -w @n1/dominio -- automations-historico` — 5/5 verde (Task 3).
- `npm run test -w @n1/dominio` (suíte inteira, sem banco, autorizada pelas regras operacionais) — 531/531 verde (30 arquivos).
- `(cd apps/api && npx vitest run src/persistencia/eventos-de-canal.test.ts --testTimeout=20000)` — 10/10 verde (Task 2 e verificação final).
- `npm run lint` (workspace `@n1/web`, único com `eslint`) — verde.
- `grep -n "CP.fields.empresa" packages/dominio/src/operations/automations.ts` — só a linha de `fillTemplate` (`{{cnpjEmpresa}}`), nunca `destinoDeCanal`.
- `grep -c "CANAL_CAMPO_WHATSAPP_ID\|CANAL_CAMPO_EMPRESA_ID\|CANAL_LISTA_ID" packages/dominio/src/operations/automations.ts` — 8 (≥ 6).
- `grep -c "indicePasso" packages/dominio/src/operations/automations.ts` — 4 (≥ 2).
- `grep -c "\"Marcos Paulo\"" packages/dominio/src/solicitacao-de-pagamento.ts` — 4 (≥ 1).
- `grep -n "migração 003" apps/api/src/persistencia/eventos-de-canal.ts` — nenhuma ocorrência.
- `grep -n "aggregateId: pedido.executionId," apps/api/src/persistencia/eventos-de-canal.ts` — nenhuma ocorrência.
- `grep -rn "55[0-9]\{9,\}" apps/api/src/persistencia/eventos-de-canal*.ts` — nenhuma ocorrência.
- `git diff` de `packages/dominio/src/operations/automations.ts` não mostra mudança na linha `export function runScheduledAutomations(` nem nos seus parâmetros (confirmado: a linha não aparece no diff).
- **NÃO executado, por regra operacional do projeto:** `npm run check`, `npm test`, `npm run test -w @n1/api`, `npx vitest run` sem caminho, e (fora da lista explicitamente permitida para este worktree) `npm run typecheck -w @n1/web`/`npm run test -w @n1/web` — o plano pede os dois no `<verification>`, mas ficam para o orquestrador/verificador da fase. Grep dedicado em `apps/web/src` não encontrou nenhuma referência hardcoded à contagem antiga de 11 opções de Empresa da Solicitação (só um Campo de filtro não relacionado, `filtro-de-empresa.tsx`), então o risco de quebra silenciosa é baixo, mas não foi confirmado por execução.
- **Nota de convivência entre ondas (do próprio plano, não violada):** os casos de Canal de `apps/api/src/rotas/operacoes.test.ts` (05-17) e `apps/api/src/automacoes/scheduler-worker.test.ts` (05-19) NÃO foram tocados — continuam vermelhos contra Contas a pagar até essas ondas rodarem, como o plano previu.

## Next Phase Readiness

- O domínio e o `automation/` (depois de 05-18) passam a concordar sobre QUAL Tarefa é notificável: Solicitação de Empresa com canal declarado, destino em `fld_sp_z_whatsapp` ou nos rótulos da Integração — fecha o lado do domínio de CR-02.
- Cada passo de Canal é um evento identificável por `aggregateId` próprio — 05-21 (migração 006) já tem o que precisa para o índice único parcial.
- Nenhuma Automação temporal alcança mais o histórico importado — 05-25 (o relógio de Contas a receber) ganha uma barreira de código, não só a leitura humana do relato do Ensaio.
- Nenhum bloqueio para os planos seguintes da onda 1 nem para a onda 2 (05-17..05-25).

## Self-Check: PASSED

Arquivo criado encontrado em disco: `packages/dominio/src/operations/automations-historico.test.ts`. Os três commits de Task (`b5a5dfd`, `a744a13`, `8119aaa`) encontrados em `git log --oneline --all`.

---
*Phase: 05-contas-a-receber-e-os-outros-tenants*
*Completed: 2026-09-24*
