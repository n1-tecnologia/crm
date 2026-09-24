---
phase: 05-contas-a-receber-e-os-outros-tenants
plan: 19
subsystem: api
tags: [outbox, testing-hygiene, postgres, canal, whatsapp, cr-07, scheduler-worker, cli]

# Dependency graph
requires:
  - phase: 05-contas-a-receber-e-os-outros-tenants (Plan 13)
    provides: "destinoDeCanal/CANAL_LISTA_ID/CANAL_CAMPO_EMPRESA_ID/CANAL_CAMPO_WHATSAPP_ID alinhados à Solicitação de pagamento (D5-19) — o alvo que a migração do cenário 'Canal por agenda' deste plano passa a usar"
  - phase: 05-contas-a-receber-e-os-outros-tenants (Plan 17)
    provides: "o molde de cenário de Canal sobre a Solicitação (evoluirConfiguracaoDeSolicitacoes + evoluirConfiguracaoPorEmpresa antes de semear) que este plano reusa em scheduler-worker.test.ts"
provides:
  - "scheduler-worker.test.ts não deixa mais rastro em plataforma.integration_outbox/automacao_agenda — limparWorkspace() apaga os dois, no beforeAll (defensivo) E no afterAll, em todo describe que cria Espaço"
  - "os casos 'Canal por agenda' do scheduler migrados de Contas a pagar para a Solicitação de pagamento (D5-19/05-13) — CANAL_LISTA_ID, CANAL_CAMPO_EMPRESA_ID, CANAL_CAMPO_WHATSAPP_ID"
  - "drenarAgenda() — o worker de teste drena TODAS as Listas com agenda descobertas (CP/CR reais do seed + a Lista de Canal), não assume que processarUm() pega a linha certa na primeira chamada"
  - "PREFIXOS_DE_ESPACO_DE_TESTE/ehEspacoDeTeste/levantarOrfaos/removerOrfaos (apps/api/src/persistencia/limpar-outbox-de-teste.ts) — limpeza escopada e auditável do outbox real, ws_n1 recusado por construção"
  - "npm run outbox:limpar-testes -w @n1/api — CLI dry-run por padrão, --apply explícito, saída só com contagens agregadas por prefixo"
  - "as 9 linhas órfãs de integration_outbox que a suíte tinha deixado em produção foram removidas, com autorização do dono do produto registrada"
affects: ["05-18 (automation/ realinha notificar-canal-routes.ts ao mesmo alvo de Canal)", "05-20 (roda em paralelo nesta onda — não toca os arquivos deste plano)", "qualquer plano futuro que precise auditar/limpar Espaços de teste do outbox real usa a mesma CLI em vez de reinventar o grep"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Limpeza defensiva no beforeAll (não só no afterAll): uma execução anterior morta pelo watchdog de 600s não chega ao próprio afterAll — o padrão já usado em outbox.test.ts/formularios-publicos.test.ts foi estendido a scheduler-worker.test.ts"
    - "Drenar a fila de agenda em vez de assumir ordem: quando várias Listas com condicaoTemporal coexistem no mesmo Espaço de teste (CP/CR reais do seed + a Lista sob teste), um único processarUm() pode reivindicar a linha errada — o teste precisa esvaziar a fila, como o worker de produção faz em regime"
    - "CLI de limpeza escopada por allowlist POSITIVA de prefixo (nunca denylist): ws_n1 é estruturalmente inalcançável porque nenhum prefixo confirmado o contém, não porque o código 'lembrou' de excluí-lo"

key-files:
  created:
    - apps/api/src/persistencia/limpar-outbox-de-teste.ts
    - apps/api/src/persistencia/limpar-outbox-de-teste.cli.ts
    - apps/api/src/persistencia/limpar-outbox-de-teste.test.ts
  modified:
    - apps/api/src/automacoes/scheduler-worker.test.ts
    - apps/api/package.json

key-decisions:
  - "PREFIXOS_DE_ESPACO_DE_TESTE agrupa por prefixo comum em vez de listar cada arquivo: ws_outbox_ cobre outbox.test.ts E outbox-worker.test.ts (RUN começa igual nos dois); ws_teste_ cobre cinco arquivos (classificacoes, integracao-solicitacoes, integracao, importar-contas-a-receber, importar-contas-a-pagar) — sete prefixos bastam para os onze arquivos auditados, mais o de configuracao-por-empresa.test.ts (WR-15, não escreve outbox mas foi pedido explicitamente no plano)."
  - "levantarOrfaos/removerOrfaos recebem um PoolClient já conectado (não abrem conexão própria) — o mesmo padrão de bootstrapGestao/importarContaAReceberHistorica: quem chama controla o ciclo de vida da conexão, a função só executa SQL."
  - "removerOrfaos lança ANTES de abrir a transação quando apply !== true — testável sem banco: um cliente espião (vi.fn que lança se chamado) prova que query() nunca é invocado no caminho de recusa."
  - "drenarAgenda() (só no teste, não em produção) foi a correção necessária depois da migração: buildGestaoBootstrap já publica automações reais de condicaoTemporal em CP.listId e CR.listId, então semear() cria 3 linhas de agenda (não 1) no mesmo Espaço, e processarUm() picking a linha errada por ordem de criado_em fazia (a) e (b) falharem mesmo com a migração de domínio correta."

requirements-completed: [AUTO-02]

# Metrics
duration: ~35min de trabalho ativo (Tasks 1-2) + duas paradas de checkpoint (autorização do dono do produto e permissão de ferramenta do agente para --apply)
completed: 2026-09-24
---

# Phase 05 Plan 19: `scheduler-worker.test.ts` para de vazar para o outbox real, e o que já tinha vazado foi removido (CR-07) Summary

**`limparWorkspace()` apaga `integration_outbox`/`automacao_agenda` no `beforeAll` E no `afterAll` de todo describe que cria Espaço; os casos "Canal por agenda" migraram de Contas a pagar para a Solicitação (D5-19); uma CLI nova (`outbox:limpar-testes`) audita e remove, com dry-run por padrão, o que os onze arquivos de teste deixam no outbox real — as 9 linhas órfãs de 2026-09-24 já foram removidas, com autorização do dono registrada abaixo.**

## Performance

- **Duration:** ~35 min de trabalho ativo nas Tasks 1-2 (typecheck + a suíte rodando 4x seguidas + o módulo/CLI/teste novo). A Task 3 (checkpoint bloqueante) somou duas paradas: a autorização do dono do produto para o `--apply`, e — depois disso — uma recusa do classificador de permissão do próprio agente para executar o `--apply` (`[Modify Shared Resources]`), resolvida pelo dono rodando o comando manualmente.
- **Completed:** 2026-09-24
- **Tasks:** 3/3 (Task 3 é `checkpoint:human-verify`, sem arquivo versionado — a operação foi em produção)
- **Files modified:** 5 (3 criados, 2 modificados) — bate exatamente com `files_modified` do frontmatter do plano.

## Accomplishments

- **CR-07, a origem do vazamento (Task 1).** `scheduler-worker.test.ts::limparWorkspace()` passou a apagar `plataforma.integration_outbox` (além de `automacao_agenda`/`registros`/`workspaces`, que já apagava), com o incidente comentado no código (9 linhas órfãs, `attempts = 0`, em 2026-09-24). TODO describe que cria Espaço (`WORKSPACE`/`WORKSPACE_M`, `WORKSPACE_ENSAIO`, `WORKSPACE_CANAL_A/B/C`) ganhou limpeza defensiva no `beforeAll`, além do `afterAll` que já existia — o mesmo padrão documentado em `outbox.test.ts`.
- **Migração do cenário "Canal por agenda" para a Solicitação (colateral de D5-19/05-13, Task 1).** `prepararCenarioCanalPorAgenda` deixou de montar a Automação/Tarefa em `CP.listId` (Contas a pagar) e passou a montar em `CANAL_LISTA_ID` (Solicitações de pagamento): `buildGestaoBootstrap` + `evoluirConfiguracaoDeSolicitacoes` + `evoluirConfiguracaoPorEmpresa` (mesmo molde de `operacoes.test.ts` (w)/(x), 05-17), Automação publicada com `canalCampoDestinoId: CANAL_CAMPO_WHATSAPP_ID`, Tarefa com `CANAL_CAMPO_EMPRESA_ID = "Marcos Paulo"` e WhatsApp sem dígito de telefone (`whatsapp-teste-agenda-canal`, seguindo a disciplina já registrada em 05-07/05-13 contra `grep "55[0-9]{9,}"`).
- **`drenarAgenda()` — achado durante a execução, não previsto no plano (Task 1).** `buildGestaoBootstrap` publica automações reais de `condicaoTemporal` em `CP.listId` E `CR.listId` (A2, R2/R4/R5 do seed de produção) — então `semear()` cria TRÊS linhas de agenda no mesmo Espaço de teste (não uma), e `processarUm()` reivindica pela ordem `dia_civil, criado_em`: como a Automação de Canal só é empurrada ao estado DEPOIS do seed de produção, a linha da Solicitação nem sempre é a primeira. Os casos (a)/(b) falhavam mesmo com a migração de domínio certa. `drenarAgenda()` esvazia a fila inteira (como o worker de produção faz em regime) em vez de assumir que uma única chamada pega a linha certa — as outras duas Listas não têm Tarefa nenhuma nesse Espaço isolado, então processá-las é inofensivo.
- **CLI de limpeza escopada e auditável (Task 2).** `apps/api/src/persistencia/limpar-outbox-de-teste.ts` exporta `PREFIXOS_DE_ESPACO_DE_TESTE` (7 prefixos, cada um comentado com o(s) arquivo(s) que o cria), `ehEspacoDeTeste` (recusa `ws_n1` por construção), `levantarOrfaos` (só leitura, agregada por prefixo, nunca `payload`) e `removerOrfaos` (exige `apply: true`, lança antes de abrir transação, remove numa única transação). `npm run outbox:limpar-testes -w @n1/api` é o CLI fino por cima — dry-run por padrão.
- **As 9 linhas órfãs foram removidas em produção (Task 3), com autorização registrada** — ver a seção de checkpoint abaixo.

## Task Commits

Each task was committed atomically:

1. **Task 1: `scheduler-worker.test.ts` limpa o que grava e migra Canal por agenda para a Solicitação (CR-07)** - `916ea59` (fix)
2. **Task 2: Auditoria dos irmãos e a ferramenta de limpeza escopada (dry-run por padrão)** - `e147d65` (feat)
3. **Task 3: [BLOCKING] Remover as órfãs do outbox real** — operação em produção, sem arquivo versionado (ver checkpoint abaixo); o `--apply` em si não gera commit neste repositório.

**Plan metadata:** commit deste SUMMARY (a seguir).

## Files Created/Modified

- `apps/api/src/automacoes/scheduler-worker.test.ts` — `limparWorkspace()` apaga `integration_outbox`; limpeza defensiva no `beforeAll` de todo describe que cria Espaço; `prepararCenarioCanalPorAgenda` migrada para a Solicitação; `drenarAgenda()` novo; docstrings dos blocos afetados atualizadas.
- `apps/api/src/persistencia/limpar-outbox-de-teste.ts` (novo) — módulo puro de leitura/remoção escopada.
- `apps/api/src/persistencia/limpar-outbox-de-teste.cli.ts` (novo) — CLI fino (`npm run outbox:limpar-testes`).
- `apps/api/src/persistencia/limpar-outbox-de-teste.test.ts` (novo) — 8 testes puros (sem banco): `ehEspacoDeTeste`, os prefixos, o SQL lido do fonte (`<> 'ws_n1'`, `status = 'pending'`, `like any`, nenhuma lista de colunas com `payload`), e a recusa de `removerOrfaos` sem `apply: true` sem tocar o cliente.
- `apps/api/package.json` — script `outbox:limpar-testes` acrescentado ao lado dos outros CLIs de `apps/api`.

## Auditoria dos 11 arquivos de teste que gravam em `integration_outbox`

(`grep -rln "integration_outbox\|eventos:" apps/api/src --include="*.test.ts"`, conferida arquivo a arquivo nesta Task.)

| Arquivo | Prefixo de Espaço | `integration_outbox` limpo no `beforeAll` E `afterAll`/`afterEach` | `automacao_agenda` limpo quando grava nela | Espaço aleatório por execução |
|---|---|---|---|---|
| `automacoes/scheduler-worker.test.ts` | `ws_agendaworker_` (+ `_m`/`_ensaio`/`_canal_a/b/c`) | **Não, antes desta Task** (CR-07) → **Sim, depois** (`beforeAll` defensivo + `afterAll` em todo bloco) | Sim (já limpava antes; mantido) | Sim |
| `bootstrap/contas-a-receber.test.ts` | `ws_cr_configurar_` (+ `_prazo`/`_saque`) | Sim, nos dois, no bloco `WS`. Blocos `WS2`/`WS3` não escrevem outbox/agenda (chamadas puras de domínio, sem `executar()` com evento de Canal) — não aplicável | Sim, no bloco `WS` | Sim |
| `rotas/formularios-publicos.test.ts` | `ws_formularios_publicos_` (+ `_canal`) | Sim, nos dois blocos (`WS` e `WS_CANAL`), `beforeAll` comentado como defensivo | Não aplicável (arquivo não usa `automacao_agenda`) | Sim |
| `rotas/operacoes.test.ts` | `ws_rotas_teste` | Sim, `beforeAll`+`afterAll` | Não aplicável | **Não — literal fixo** (achado, ver abaixo) |
| `rotas/classificacoes.test.ts` | `ws_teste_classificacoes_` | Sim, via `limparTudo()` em `beforeAll`+`afterAll` | Não aplicável | Sim |
| `rotas/integracao-solicitacoes.test.ts` | `ws_teste_integracao_solicitacoes_` | Sim, via `limparTudo()` em `beforeAll`+`afterAll` | Não aplicável | Sim |
| `importacao/clickup/importar-contas-a-receber.test.ts` | `ws_teste_importar_cr_` | `afterEach` cobre todo teste (inclusive o último); `afterAll` limpa `registros`/`workspaces`/ledger/`automacao_agenda` mas não repete `integration_outbox` (redundante, não uma lacuna funcional); **sem limpeza defensiva no `beforeAll`** (achado, ver abaixo) | Sim, no `afterAll` | Sim |
| `importacao/clickup/importar-contas-a-pagar.test.ts` | `ws_teste_importar_cp_` | `afterEach` cobre todo teste; `afterAll` não repete `integration_outbox` (mesma observação); **sem limpeza defensiva no `beforeAll`** | Não aplicável (arquivo não escreve `automacao_agenda`) | Sim |
| `persistencia/outbox-worker.test.ts` | `ws_outbox_worker_` | Sim — `afterEach` (por caso) + `afterAll`; sem `beforeAll` defensivo (achado, risco baixo dado o prefixo aleatório) | Não aplicável | Sim |
| `persistencia/outbox.test.ts` | `ws_outbox_` | Sim — o molde documentado (`beforeAll` defensivo + `afterAll`, comentário explícito no arquivo) | Não aplicável | Sim |
| `persistencia/integracao.test.ts` | `ws_teste_integracao_` | Sim, via `limparTudo()` em `beforeAll`+`afterAll` | Não aplicável | Sim |

**Achados registrados, NÃO editados neste plano** (fora de escopo por instrução explícita — "Corrija aqui só `scheduler-worker.test.ts`"):

1. **`rotas/operacoes.test.ts` usa `WS = "ws_rotas_teste"` fixo, não aleatório.** A limpeza em si está correta (`beforeAll`+`afterAll`), mas duas execuções concorrentes (dois worktrees, CI em paralelo) colidem — mesma classe de risco que WR-15 já registrou para `bootstrap/configuracao-por-empresa.test.ts` (por isso esse arquivo também entrou em `PREFIXOS_DE_ESPACO_DE_TESTE`, mesmo sem gravar outbox: para a CLI alcançar órfãos dele também, se algum dia passar a gravar).
2. **As duas importações históricas (`importar-contas-a-receber.test.ts`/`importar-contas-a-pagar.test.ts`) não fazem limpeza defensiva no `beforeAll`.** Funcionalmente coberto pelo `afterEach` (roda depois de cada teste, inclusive o último) e pelo prefixo aleatório (uma corrida concorrente não colide), mas se a PRÓPRIA execução abortar entre a criação do Espaço e o primeiro `afterEach`, a órfã fica sem limpeza automática — coberta pela CLI geral (`ws_teste_`), não por autolimpeza do arquivo.

Nenhum dos dois achados é CR-07 (não há vazamento incondicional/permanente como o do scheduler) — são gaps de defesa em profundidade, registrados para uma fase futura decidir se vale endurecer.

## Decisions Made

Ver `key-decisions` no frontmatter. Resumo: prefixos agrupados por padrão comum (7 prefixos cobrem 11+1 arquivos); `levantarOrfaos`/`removerOrfaos` recebem `PoolClient` já conectado; `removerOrfaos` lança antes de qualquer I/O quando `apply !== true`; `drenarAgenda()` (só no teste) nasceu da descoberta de que `buildGestaoBootstrap` publica automações reais de agenda em duas outras Listas.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `processarUm()` pegava a linha de agenda errada depois da migração para a Solicitação**
- **Found during:** Task 1, ao rodar `scheduler-worker.test.ts` pela primeira vez depois de migrar `prepararCenarioCanalPorAgenda`
- **Issue:** `buildGestaoBootstrap` já publica Automações reais de `condicaoTemporal` em `CP.listId` e `CR.listId` (A2, R2/R4/R5). `catalogoDeListasComAgenda` as descobre junto de `CANAL_LISTA_ID`, então `semear()` criava 3 linhas de agenda (não 1) para o mesmo dia civil, e `processarUm()` (que reivindica UMA linha por chamada, ordenado por `criado_em`) processava `CP.listId` ou `CR.listId` primeiro — a Automação de Canal nunca rodava na chamada única que os casos (a)/(b) faziam. Resultado: (a) esperava 1 linha no outbox e recebia 0; (b) esperava `estado = 'concluido'` e recebia `'pendente'`.
- **Fix:** `drenarAgenda(worker)` — chama `processarUm()` em laço até devolver `false`, drenando as 3 Listas. As outras duas não têm Tarefa nesse Espaço de teste isolado, então processá-las é inofensivo (zero Tarefas elegíveis).
- **Files modified:** `apps/api/src/automacoes/scheduler-worker.test.ts`
- **Verification:** `npx vitest run src/automacoes/scheduler-worker.test.ts --testTimeout=20000` — 23/23 verde, rodado 4x seguidas.
- **Committed in:** `916ea59` (Task 1 commit — descoberto e corrigido dentro da mesma Task)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug de teste descoberto pela própria migração que a Task 1 pedia, não uma mudança de escopo)
**Impact on plan:** Necessário para o arquivo passar 2x seguidas como o plano exige. Nenhum código de produção alterado — só o teste.

## Issues Encountered

- **Permissão de ferramenta bloqueou o `--apply` do agente, depois de o dono do produto já ter autorizado.** Ao tentar `npm run outbox:limpar-testes -w @n1/api -- --apply` (e, para descartar problema do wrapper `npm`, `npx vite-node src/persistencia/limpar-outbox-de-teste.cli.ts -- --apply` direto), o Bash foi recusado duas vezes pelo classificador de modo automático do Claude Code, motivo `[Modify Shared Resources]`, ANTES de qualquer SQL tocar o banco. Isto é um portão de permissão da ferramenta, separado do checkpoint humano do plano (que já estava satisfeito). Por instrução do próprio system prompt do executor, nenhuma tentativa de contornar essa recusa por outro caminho foi feita (ex.: escrever um script alternativo que chamasse `removerOrfaos()` para escapar do classificador) — isso violaria a intenção da recusa. O dono do produto rodou o comando manualmente no checkout principal e colou a saída verbatim:
  ```
  > @n1/api@0.1.0 outbox:limpar-testes
  > vite-node src/persistencia/limpar-outbox-de-teste.cli.ts --apply

  modo               apply
  integration_outbox removidas      9
  automacao_agenda removidas         0
  ```
  Depois disso, o executor (eu) só rodou leitura (dry-run de confirmação e a comparação `ws_n1` antes/depois) — nunca outro `--apply`.

## Checkpoint (Task 3) — dry-run, autorização, `--apply`, confirmação

**1. Dry-run ANTES (checkout principal, `npm run outbox:limpar-testes -w @n1/api`, sem `--apply`):**
```
modo               dry-run (nada removido — rode com -- --apply para remover)

integration_outbox (status = pending) por prefixo:
  ws_agendaworker_                 5
  ws_outbox_                       1
  ws_teste_                        3
  total                             9

automacao_agenda por prefixo:
  (nenhuma linha)
  total                             0

ws_n1 (pending, NUNCA tocado)    0
===EXIT=0===
```
Conferência linha a linha (consulta read-only adicional, SEM filtro de prefixo — prova que o total 9 escopado e o total 9 sem filtro batem, ou seja, nenhuma linha órfã escapava da allowlist): as 9 linhas eram `ws_agendaworker_*_canal_a` (5, uma por Espaço, `automacao.notificar-canal.v1`, `attempts=0`), `ws_outbox_1790206152726_hx6qku` (1, `solicitacao.criada.v1`, `attempts=0`) e `ws_teste_integracao_solicitacoes_1790129575792_jyorfo` (3, `solicitacao.comentario-criado.v1`, `attempts=0`). Todo prefixo reconhecido, nenhum `attempts > 0`, nada a interromper.

**2. Autorização do dono do produto (verbatim, repassada pelo orquestrador em 2026-09-24):**
> Pergunta feita: "Remover estas 9 linhas pendentes de Espaços de teste do outbox real? `ws_n1` não é tocado."
> Resposta do dono: **"Remover as 9 (--apply)"**

**3. `--apply` — executado pelo DONO DO PRODUTO manualmente** (o agente foi recusado pelo classificador de permissão, ver "Issues Encountered"), saída colada verbatim pelo orquestrador:
```
> @n1/api@0.1.0 outbox:limpar-testes
> vite-node src/persistencia/limpar-outbox-de-teste.cli.ts --apply

modo               apply
integration_outbox removidas      9
automacao_agenda removidas         0
```
9 removidas de `integration_outbox` — exatamente o total do dry-run do passo 1. 0 de `automacao_agenda` — não havia nenhuma órfã lá.

**4. Dry-run de CONFIRMAÇÃO (executor, leitura, depois do `--apply`):**
```
modo               dry-run (nada removido — rode com -- --apply para remover)

integration_outbox (status = pending) por prefixo:
  (nenhuma linha)
  total                             0

automacao_agenda por prefixo:
  (nenhuma linha)
  total                             0

ws_n1 (pending, NUNCA tocado)    0
===EXIT=0===
```
Total 0 — como esperado. Consulta adicional sem filtro de prefixo confirma: 0 linhas `pending` em `workspace_id <> 'ws_n1'` em todo o banco (não só nos prefixos conhecidos).

**5. Comparação `ws_n1` antes/depois:** `0` (antes) → `0` (depois) — **idêntico**, como o critério de aceite exige. `ws_n1` nunca teve linha `pending` nesta janela; a garantia estrutural (`ehEspacoDeTeste` recusa `ws_n1`, SQL com `workspace_id <> 'ws_n1'` em toda consulta e todo `delete`) nunca foi exercitada por necessidade, mas está provada pelo teste puro (`limpar-outbox-de-teste.test.ts`) e pela ausência de qualquer mudança nesse número.

**Nenhuma linha fora dos prefixos de teste foi removida** — confirmado pela igualdade entre o total escopado (9) e o total sem filtro (9) ANTES do `--apply`, e pela igualdade entre os dois (0 e 0) DEPOIS.

## User Setup Required

None — nenhuma configuração de serviço externo. O `--apply` em si foi a única operação de produção deste plano, já concluída e verificada acima.

## Next Phase Readiness

- A suíte de `apps/api` não injeta mais trabalho falso no `integration_outbox` de produção pelo caminho que este plano cobria (`scheduler-worker.test.ts`); o que ela já tinha injetado saiu antes de qualquer worker de outbox subir.
- `npm run outbox:limpar-testes -w @n1/api` fica disponível para qualquer fase futura auditar/limpar Espaços de teste do outbox real, sem reinventar o grep — e sem risco de alcançar `ws_n1` por construção.
- Dois achados de defesa em profundidade ficam registrados (WS fixo em `operacoes.test.ts`; falta de `beforeAll` defensivo nas duas importações históricas) para quem tocar esses arquivos decidir se vale endurecer — nenhum bloqueia esta fase.
- Nenhum bloqueio para 05-18 (realinhamento do `automation/` ao mesmo alvo de Canal) nem para 05-20/05-21, que seguem a mesma onda.

## Self-Check: PASSED

Arquivos criados encontrados em disco: `apps/api/src/persistencia/limpar-outbox-de-teste.ts`, `apps/api/src/persistencia/limpar-outbox-de-teste.cli.ts`, `apps/api/src/persistencia/limpar-outbox-de-teste.test.ts`. Os dois commits de Task (`916ea59`, `e147d65`) encontrados em `git log --oneline --all`. A operação de produção da Task 3 (9 linhas removidas) confirmada por dry-run de leitura depois do `--apply` (total 0) e não deixa artefato de código — verificação é o próprio registro do checkpoint acima.

---
*Phase: 05-contas-a-receber-e-os-outros-tenants*
*Completed: 2026-09-24*
