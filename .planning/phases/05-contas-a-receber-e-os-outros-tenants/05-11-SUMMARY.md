---
phase: 05-contas-a-receber-e-os-outros-tenants
plan: 11
subsystem: api+dominio
tags: [importacao, contas-a-receber, clickup, ledger, marco-zero, automacoes]

# Dependency graph
requires:
  - phase: 05-contas-a-receber-e-os-outros-tenants
    provides: "05-10 — o evolver de Contas a receber, as seis Automações aut_cr_* publicadas em ws_n1, e o runbook do relógio (Task 4 pendente, condicionada a este plano)"
provides:
  - "As 240 Tarefas históricas de Contas a receber (901107648977) importadas em ws_n1, com histórico preservado por `recordActivity` e ZERO Automações disparadas"
  - "MARCO_ZERO gravado para (ws_n1, lst_contas_a_receber) em 2026-09-24 — primeira das duas barreiras contra o agendador alcançar o passado"
  - "Prova de idempotência em produção: reexecutar `--apply` pula as 240 e não grava uma segunda marca"
affects: [rec-01, futuro-relogio-de-contas-a-receber]

# Tech tracking
tech-stack:
  added: []
  patterns: ["ClassificacaoDeContaAReceber (valida/rejeitada), no molde de classificarTarefaLegada, para expressar status-legado-desconhecido sem forçar EntradaDeContaAReceberHistorica a admitir um resultado inválido"]

key-files:
  created: []
  modified:
    - apps/api/exportacoes/importacao-contas-a-receber/e8a16d5a-2c36-4786-b63e-f40f73fae7f3/RELATORIO.md
    - apps/api/exportacoes/importacao-contas-a-receber/e8a16d5a-2c36-4786-b63e-f40f73fae7f3/RELATORIO.json
    - apps/api/exportacoes/importacao-contas-a-receber/118f8764-6557-43f5-a04d-83c2900406c4/RELATORIO.md
    - apps/api/exportacoes/importacao-contas-a-receber/118f8764-6557-43f5-a04d-83c2900406c4/RELATORIO.json

key-decisions:
  - "Decisão do dono do produto, verbatim, em 2026-09-24, respondendo 'O que fazemos com a importação das 240 contas a receber em ws_n1?': **'Aplicar agora, sem clientes'**. Escopo da autorização: o `--apply` da importação (que grava MARCO_ZERO ao final) e a sua verificação. NÃO autoriza ligar o relógio — `automacoes:liberar`, o worker do scheduler e qualquer migração continuam fora de escopo."
  - "As 240 Tarefas entraram SEM Vínculo de cliente para 205 delas (lacuna cliente-nao-encontrado) porque ws_n1 tem 0 Contatos/Empresas ativos no CRM hoje — não é um defeito da importação, é o estado real do Espaço. Item aberto, dono: o dono do produto."
  - "Achado de documentação: a spec §12 (2026-09-14) descreve Saque de plataforma com Valor 0 em TODAS as ocorrências; o export de 2026-09-17 é mais novo e mostra 5 de 9 Saques com Valor real — só 4 de 9 (saque-sem-valor=4) entraram com a lacuna de D5-14. A spec está desatualizada em relação ao export, não a importação errada."
  - "O relógio de Contas a receber (05-10 Task 4: Ensaio → ler o relato → `automacoes:liberar`) é o PRÓXIMO passo do operador — não foi executado nesta sessão. A autorização do dono do produto cobriu só o `--apply` e sua verificação."
requirements-completed: []

patterns-established: []

# Metrics
duration: ~35min
completed: 2026-09-24
---

# Phase 5 Plan 11: A importação das 240 Contas a receber históricas em ws_n1 — Summary

**As 240 Tarefas de `901107648977` estão em `ws_n1` com o histórico original e ZERO Automações disparadas; MARCO_ZERO gravado em 2026-09-24; o relógio (liberação) continua desligado por decisão de escopo.**

## Escopo desta execução — LEIA ANTES DE ASSUMIR QUE O PLANO ESTÁ FEITO

Este plano tem quatro tasks. As Tasks 1-3 (`type="auto"`) já estavam concluídas e
commitadas de uma sessão anterior — esta execução começou na Task 4
(`checkpoint:human-verify`, `gate="blocking-human"`), cujo passo 1 (dry-run lido)
também já estava feito. O dono do produto AUTORIZOU explicitamente a importação em
produção (ver Decisões, verbatim). Esta sessão executa os passos 3-5 da Task 4 —
o `--apply`, a conferência de antes/depois, e a segunda execução provando
idempotência — e escreve este SUMMARY.

**O relógio (Ensaio → ler → `automacoes:liberar`) NÃO foi executado.** A
autorização do dono do produto cobriu só a importação e sua verificação, não
"ligar o relógio". `REC-01` continua aberta.

## Performance

- **Duração desta sessão:** ~35 min
- **Tasks concluídas:** 3 de 4 código (1-3, sessão anterior) + Task 4 passos 3-5
  (esta sessão); Task 4 passos 1-2 já feitos antes desta sessão
- **Arquivos versionados nesta sessão:** 4 (dois pares RELATORIO.md/.json)

## Task Commits (sessão anterior — verificados, não refeitos)

1. **Task 1: `importarContaAReceberHistorica`** — `1e8a034` (feat) —
   `feat(05-11): importarContaAReceberHistorica — a Tarefa nasce fechada e nada acorda`
   — `packages/dominio/src/operations/importacao-contas-a-receber.ts`,
   `importacao-contas-a-receber.test.ts`, `packages/dominio/src/operations/index.ts`.
2. **Task 2: o mapeador do export** — `fe4f1a2` (feat) —
   `feat(05-11): mapeador do export de Contas a receber — lacunas em vez de dado inventado`
   — `apps/api/src/importacao/clickup/contas-a-receber.ts`, `contas-a-receber.test.ts`,
   fixtures.
3. **Task 3: orquestração, ledger e CLI** — `70aa972` (feat) —
   `feat(05-11): orquestração por lotes, ledger idempotente e CLI de Contas a receber`
   — `apps/api/src/importacao/clickup/importar-contas-a-receber.ts`,
   `importar-contas-a-receber.cli.ts`, `importar-contas-a-receber.test.ts`,
   `apps/api/package.json`.

Confirmados em `git log --oneline` antes de iniciar esta sessão (não refeitos).

## Deviations from Plan (Tasks 1-3, herdada da sessão anterior — registrada aqui por completude)

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] `mapearContaAReceber` devolve `ClassificacaoDeContaAReceber`, não `EntradaDeContaAReceberHistorica` direto**
- **Encontrado durante:** Task 2 (o mapeador do export)
- **Motivo:** o texto do plano descrevia `mapearContaAReceber(...)  : EntradaDeContaAReceberHistorica`, mas a regra de Status final ("um nome sem equivalente vira lacuna `status-legado-desconhecido` e a Tarefa NÃO é importada") não tem como ser expressa por um tipo que sempre devolve uma entrada válida — a função precisa de um caminho de recusa que não force um `statusFinalId` inventado.
- **Fix:** assinatura real devolve `ClassificacaoDeContaAReceber` com `resultado: "valida" | "rejeitada"`, no mesmo molde de `classificarTarefaLegada` (o precedente de Contas a pagar já resolve o mesmo problema do mesmo jeito). `resultado === "rejeitada"` carrega `motivo` (a categoria, nunca o valor); `resultado === "valida"` carrega `entrada`.
- **Arquivos:** `apps/api/src/importacao/clickup/contas-a-receber.ts` (comentário no topo do arquivo, linhas ~29-31, e a interface `ClassificacaoDeContaAReceber`).
- **Verificação:** `importarTudo` (Task 3) trata os dois ramos — `rejeitada` incrementa `rejeitadas`/`rejeicoesPorCategoria` sem tentar montar uma entrada; `valida` segue para o lote. O dry-run e o apply desta sessão confirmam `rejeitadas: 0` nas 240 linhas reais.
- **Commit:** `fe4f1a2` (parte do commit de Task 2).

---

**Total de desvios:** 1 auto-corrigido (Rule 2). Nenhum desvio novo nesta sessão (Task 4 é operação, não código).
**Impacto no plano:** o desvio é necessário para que a regra "Status desconhecido não importa" seja verificável em tipo, não só em runtime — sem escopo extra.

## Decisão do dono do produto (verbatim)

Em **2026-09-24**, o dono do produto foi apresentado ao dry-run e aos dois achados
(ws_n1 tem 0 Contatos/Empresas de CRM, então ~todas as 240 entrariam sem Vínculo de
cliente, cada uma com a lacuna registrada; `saque-sem-valor` = 4 de 9 Saques, não
"todos", porque o export de 2026-09-17 é mais novo que a spec §12 de 2026-09-14) e
perguntado: *"O que fazemos com a importação das 240 contas a receber em ws_n1?"*.

Resposta verbatim: **"Aplicar agora, sem clientes"**.

Escopo da autorização: o `--apply` da importação (que grava `MARCO_ZERO` ao final) e
a sua verificação. **NÃO** autoriza ligar o relógio — `automacoes:liberar`, o
scheduler/worker e qualquer migração continuam fora de escopo desta autorização.

## Passo 0 — Contagens ANTES (leitura, nada gravado)

Script `node`/`vite-node` avulso usando `pool()` do próprio projeto, executado e
apagado ao final (não commitado):

| Contagem | Valor |
|---|---|
| Tasks em `CR.listId` (`lst_contas_a_receber`) | 0 |
| `automationExecutions` (ws_n1) | 0 |
| `plataforma.integration_outbox` (ws_n1) | 0 |
| `plataforma.automacao_agenda` (ws_n1, lst_contas_a_receber) | `[]` (nenhuma linha — `MARCO_ZERO` ainda não gravado) |

## Passo 1 — Dry-run desta sessão, confirmado contra a baseline

Baseline registrada no plano (sessão anterior, run `e3a6428e-14ba-4dc9-b521-e9d846ab543f`):

```
lidas 240 · importadas 2 · avisadas 238 · rejeitadas 0 · puladas 0
lacunas: {"data-de-pagamento-por-date-closed":16,"cliente-nao-encontrado":205,"total-de-parcelas-ausente":192,"parcela-duplicada":4,"subtarefa-desamarrada":1,"tipo-inferido":2,"saque-sem-valor":4}
```

Dry-run rerodado nesta sessão (run `229dee76-f899-4130-92f7-baabcc15a1a1`):

```
run 229dee76-f899-4130-92f7-baabcc15a1a1 · modo dry-run · pasta apps/api/exportacoes/clickup/901107648977/ · lote 250
catálogo de clientes: 0 Contatos/Empresas ativos em "ws_n1"
lote 1 · importadas 2 · puladas 0 · avisadas 238 · rejeitadas 0
lidas 240 · importadas 2 · avisadas 238 · rejeitadas 0 · puladas 0
lacunas por categoria: {"data-de-pagamento-por-date-closed":16,"cliente-nao-encontrado":205,"total-de-parcelas-ausente":192,"parcela-duplicada":4,"subtarefa-desamarrada":1,"tipo-inferido":2,"saque-sem-valor":4}
rejeições por categoria: {}
```

**Idêntico à baseline em todos os números — inclusive `rejeitadas: 0`.** Prossegue
para o `--apply` conforme autorizado.

## Passo 2 — `--apply` (produção, ws_n1)

```
run e8a16d5a-2c36-4786-b63e-f40f73fae7f3 · modo apply · pasta apps/api/exportacoes/clickup/901107648977/ · lote 250
catálogo de clientes: 0 Contatos/Empresas ativos em "ws_n1"
lote 1 · importadas 2 · puladas 0 · avisadas 238 · rejeitadas 0
lidas 240 · importadas 2 · avisadas 238 · rejeitadas 0 · puladas 0
lacunas por categoria: {"data-de-pagamento-por-date-closed":16,"cliente-nao-encontrado":205,"total-de-parcelas-ausente":192,"parcela-duplicada":4,"subtarefa-desamarrada":1,"tipo-inferido":2,"saque-sem-valor":4}
rejeições por categoria: {}
relatório agregado (versionado): apps/api/exportacoes/importacao-contas-a-receber/e8a16d5a-2c36-4786-b63e-f40f73fae7f3
relatório detalhado por linha (fora do git): apps/api/exportacoes/clickup/901107648977/importacao/e8a16d5a-2c36-4786-b63e-f40f73fae7f3/rejeicoes.log
MARCO_ZERO gravado em 2026-09-24.
Próximo passo, quando o relato estiver aceitável: npm run automacoes:liberar -w @n1/api -- ws_n1 lst_contas_a_receber
```

Total de Tarefas nascidas nesta chamada: `importadas (2) + avisadas (238) = 240` —
"avisada" significa que a Tarefa nasceu normalmente e carrega ao menos uma lacuna
registrada por Registro de Atividade; não é uma rejeição.

## Passo 3 — Contagens DEPOIS

| Contagem | Antes | Depois | Critério de aceite |
|---|---|---|---|
| Tasks em `CR.listId` | 0 | **240** | aumentou exatamente pelo importado (2+238=240) — OK |
| `automationExecutions` (ws_n1) | 0 | **0** | inalterado — OK |
| `plataforma.integration_outbox` (ws_n1) | 0 | **0** | inalterado — OK |
| `plataforma.automacao_agenda` (ws_n1, lst_contas_a_receber) | `[]` | 1 linha `MARCO_ZERO`, `dia_civil` 2026-09-24, `estado: concluido` | linha esperada presente — OK |

Linha completa de `automacao_agenda` depois do `--apply`:

```json
{
  "dia_civil": "2026-09-24T03:00:00.000Z",
  "estado": "concluido",
  "last_error_code": "MARCO_ZERO",
  "executadas": null,
  "falhadas": null,
  "puladas": null,
  "concluido_em": "2026-09-24T15:27:44.562Z"
}
```

**Todos os quatro critérios de aceite do checkpoint batem.**

## Passo 4 — Segunda execução `--apply` (prova de idempotência em produção)

```
run 118f8764-6557-43f5-a04d-83c2900406c4 · modo apply · pasta apps/api/exportacoes/clickup/901107648977/ · lote 250
catálogo de clientes: 0 Contatos/Empresas ativos em "ws_n1"
lote 1 · importadas 0 · puladas 240 · avisadas 0 · rejeitadas 0
lidas 240 · importadas 0 · avisadas 0 · rejeitadas 0 · puladas 240
lacunas por categoria: {"data-de-pagamento-por-date-closed":16,"cliente-nao-encontrado":205,"total-de-parcelas-ausente":192,"parcela-duplicada":4,"subtarefa-desamarrada":1,"tipo-inferido":2,"saque-sem-valor":4}
rejeições por categoria: {}
relatório agregado (versionado): apps/api/exportacoes/importacao-contas-a-receber/118f8764-6557-43f5-a04d-83c2900406c4
relatório detalhado por linha (fora do git): apps/api/exportacoes/clickup/901107648977/importacao/118f8764-6557-43f5-a04d-83c2900406c4/rejeicoes.log
MARCO_ZERO já existia — nada a fazer (idempotente por workspaceId+listId; pode ter vindo do Plan 05-10).
```

**240 puladas, 0 importadas** — exatamente o esperado. Contagens depois desta
segunda chamada, repetidas: Tasks em `CR.listId` continua **240** (nenhuma Tarefa
nova nasceu), `automationExecutions` continua **0**, `integration_outbox` continua
**0**, e a linha de `automacao_agenda` é a MESMA (`concluido_em` idêntico ao passo
3 — nenhuma segunda marca foi criada). Prova de idempotência completa em
produção.

## Achados registrados (não são defeitos — são o estado real dos dados)

- **Discrepância de documentação (spec §12 vs. export).** A spec §12
  (`docs/07-processos/contas-a-receber.md`, datada 2026-09-14) descreve Saque de
  plataforma com Valor 0 em TODAS as ocorrências da Lista. O export real usado
  nesta importação é de 2026-09-17 (mais novo que a spec) e mostra que **5 de 9**
  Saques já tinham Valor real registrado no ClickUp antes da exportação — só **4
  de 9** entraram com a lacuna `saque-sem-valor` (D5-14). A importação está
  correta; é a spec que ficou desatualizada em relação ao export mais recente.
- **Gap de Vínculo ao cliente — item ABERTO, dono: o dono do produto.** `ws_n1`
  tinha (e continua tendo, no CRM) 0 Contatos/Empresas ativos antes desta
  importação. Como decidido verbatim ("Aplicar agora, sem clientes"), as 240
  Tarefas entraram sem tentar inventar ou casar clientes que não existem —
  `cliente-nao-encontrado` está registrada em 205 delas via Registro de
  Atividade, sem Vínculo criado. Isso significa que a soma "por cliente" desta
  Lista não fecha ainda; fechar depende de o CRM ganhar os Contatos/Empresas
  correspondentes, e então uma correção futura (fora deste plano) precisaria
  religar o Vínculo por `legacyTaskId`. Nenhum código deste plano tenta resolver
  isso — é decisão consciente do dono do produto, registrada aqui para
  rastreabilidade.

## Relatórios agregados — o que foi versionado nesta sessão

Seguindo o precedente do `.gitignore` (03-14: relatório agregado — só contagens e
vocabulário — entra no git; o detalhe por linha, fora, por LGPD), os relatórios
`RELATORIO.md`/`RELATORIO.json` do `--apply` (`e8a16d5a-...`) e da segunda
execução (`118f8764-...`) foram inspecionados: contêm só `runId`, `modo`,
contagens agregadas e nomes de categoria — nenhum nome, nenhum `legacyTaskId`,
nenhum valor monetário. **Commitados.**

Os relatórios do dry-run rerodado nesta sessão (`229dee76-...`) e o da baseline
da sessão anterior (`e3a6428e-...`) **não foram commitados** — a instrução desta
sessão autorizou versionar só o par apply/segunda-execução; os dois dry-runs
seguem no disco, fora do git, sem risco (mesmo formato agregado, mas fora do
escopo desta autorização).

## Files Created/Modified

- `apps/api/exportacoes/importacao-contas-a-receber/e8a16d5a-2c36-4786-b63e-f40f73fae7f3/RELATORIO.md` — relatório agregado do `--apply`
- `apps/api/exportacoes/importacao-contas-a-receber/e8a16d5a-2c36-4786-b63e-f40f73fae7f3/RELATORIO.json` — idem, JSON
- `apps/api/exportacoes/importacao-contas-a-receber/118f8764-6557-43f5-a04d-83c2900406c4/RELATORIO.md` — relatório agregado da segunda execução (idempotência)
- `apps/api/exportacoes/importacao-contas-a-receber/118f8764-6557-43f5-a04d-83c2900406c4/RELATORIO.json` — idem, JSON

Nenhum arquivo de código foi criado ou modificado nesta sessão — Task 4 é
operação em produção, não implementação.

## Decisions Made

- Ver "Decisão do dono do produto (verbatim)" acima — a única decisão de escopo
  desta sessão, e ela é explícita e datada.
- Script de contagem (`_contagens-temp.ts`) foi criado dentro de
  `apps/api/src/importacao/clickup/` para reaproveitar `pool()`/`carregarEnv()`
  do projeto via `vite-node`, rodado duas vezes (antes/depois) e **apagado** ao
  final — não commitado, por instrução do plano.

## Issues Encountered

Nenhum. O dry-run desta sessão bateu exatamente com a baseline (incluindo
`rejeitadas: 0`), o `--apply` produziu as 240 Tarefas esperadas, e a segunda
execução confirmou idempotência total — nenhum dos quatro critérios de aceite
falhou, então nenhum checkpoint de bloqueio precisou ser levantado.

## User Setup Required

None - nenhuma configuração externa necessária.

## Next Phase Readiness

**O próximo passo é operacional, não é este plano.** Com `MARCO_ZERO` gravado
para `(ws_n1, lst_contas_a_receber)`, o runbook documentado em
`05-10-SUMMARY.md` fica pronto para rodar, NA ORDEM:

1. Deixar a primeira volta do scheduler correr em **Ensaio**
   (`ensaioNaPrimeiraVolta`, `apps/api` com `AUTOMACOES_WORKER_ATIVO=true`).
2. Ler `plataforma.automacao_agenda` para `(ws_n1, lst_contas_a_receber)` e
   confirmar a linha `ENSAIO_PRIMEIRA_VOLTA`.
3. Só então: `npm run automacoes:liberar -w @n1/api -- ws_n1 lst_contas_a_receber`.
4. Confirmar que a primeira volta real bate com o Ensaio.

**Nada disso foi executado nesta sessão.** A autorização do dono do produto foi
específica para o `--apply` e sua verificação — "ligar o relógio" segue
pendente, aguardando decisão e execução futuras. `REC-01` continua com o
checkbox desmarcado em `REQUIREMENTS.md`; este plano não marca a requirement
como concluída porque ela realmente não está — falta o relógio ligado (a razão
de existir da Lista com seis Automações ativas) e falta o Vínculo de cliente
nas 205 Tarefas sem correspondência no CRM.

---
*Phase: 05-contas-a-receber-e-os-outros-tenants*
*Completed: 2026-09-24*
