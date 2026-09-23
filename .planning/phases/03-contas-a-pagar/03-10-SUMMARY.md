---
phase: 03-contas-a-pagar
plan: 10
subsystem: import-etl
tags: [contas-a-pagar, importacao, clickup, cli, ledger, marco-zero, d3-04, t-3-02, t-3-27]

# Dependency graph
requires:
  - phase: 03-contas-a-pagar (Plan 03-09)
    provides: "importarContaAPagarHistorica, EntradaDeContaAPagarHistorica, TransicaoHistoricaDeStatus, ORIGEM_CONTAS_A_PAGAR, contaAPagarJaImportada"
  - phase: 03-contas-a-pagar (Plan 03-08)
    provides: "CODIGOS_DA_AGENDA, scheduler-worker.ts (a dependência de onda desta plano), plataforma.automacao_agenda"
  - phase: 03-contas-a-pagar (Plan 03-01)
    provides: "plataforma.importacao_ledger (migração 003), convenção origem = 'clickup:901107637383'"
provides:
  - "classificarTarefaLegada — o classificador puro do export bruto para EntradaDeContaAPagarHistorica, provado contra as 2.861 Tarefas reais"
  - "importarLote/importarTudo/reconciliar — a orquestração transacional por lotes, ledger na mesma transação, retomada"
  - "marcarMarcoZero/diaCivilDeHoje — a marca que impede o agendador de alcançar o passado importado"
  - "npm run contas-a-pagar:importar — o CLI que a Task 4 (checkpoint bloqueante) usa para a importação real"
affects: [03-11-invocacao-do-agente]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Classificador puro (sem I/O) + orquestração por lotes com ledger na mesma transação — o mesmo molde de financeiro/solicitacoes.ts, adaptado a uma Lista com Automações reais"
    - "Idempotência de marca em dois graus: mesmo dia civil (on conflict) e entre dias civis diferentes (pré-checagem por last_error_code) — nunca uma segunda linha por reexecução tardia"
    - "Testing seam explícito e documentado (forcarFalhaDeLedgerParaTesteDeAtomicidade) para provar atomicidade sem inventar um caminho de falha artificial no código de produção"

key-files:
  created:
    - apps/api/src/importacao/clickup/contas-a-pagar.ts
    - apps/api/src/importacao/clickup/contas-a-pagar.test.ts
    - apps/api/src/importacao/clickup/fixtures/contas-a-pagar-sanitizadas.json
    - apps/api/src/importacao/clickup/importar-contas-a-pagar.ts
    - apps/api/src/importacao/clickup/importar-contas-a-pagar.test.ts
    - apps/api/src/importacao/clickup/marco-zero.ts
    - apps/api/src/importacao/clickup/marco-zero.test.ts
    - apps/api/src/importacao/clickup/importar-contas-a-pagar.cli.ts
  modified:
    - apps/api/package.json
    - apps/api/src/importacao/clickup/CONTEXT.md

key-decisions:
  - "Vencimento nativo sobre L-Data Vencimento (D3-04, obrigação 3), com a evidência medida: das 117 contas ainda em 'para pagar', 83 têm os dois campos e 82 divergem (L em média 26,3 dias mais cedo); todo L é subconjunto do nativo (1.007 vs 2.830) — usar L não acrescentaria Tarefa nenhuma e poria 82 contas vivas com vencimento no passado, o gatilho de A5/A6/A7."
  - "Lote de 250 (não uma executar() por conta, nem uma só para tudo): 12 hidratações para 2.861 Tarefas, lock por lote em segundos, falha que desfaz no máximo 250 contas — as anteriores já estão no ledger e a retomada parte dali."
  - "MARCO_ZERO idempotente por (workspaceId, listId), não por (workspaceId, listId, diaCivil): uma pré-checagem por last_error_code impede uma segunda linha nascer se o CLI rodar de novo num dia civil diferente — sem essa checagem, um segundo --apply em outro dia quebraria a invariante 'exatamente uma linha'."
  - "reconciliar() decopla a origem do ledger (parametrizável, só o teste substitui) da proveniência da Tarefa (sempre ORIGEM_CONTAS_A_PAGAR, fixa): são dois filtros independentes, e só o workspaceId isola o teste da produção."
  - "Dry-run nunca chama executar(): a contagem de dry-run é otimista (classificação apenas), a validação de domínio só acontece de verdade no --apply — os números do dry-run e do apply podem, em teoria, divergir na contagem de rejeitadas se o domínio recusar algo que a classificação não previu; no export real essa divergência é zero (medido)."

requirements-completed: []

# Metrics
duration: ~3h (Tasks 1-3; Task 4 aguarda checkpoint humano)
completed: 2026-09-23
---

# Phase 03 Plan 10: O classificador, a orquestração por lotes e MARCO_ZERO para a importação real de Contas a pagar

**O CLI `contas-a-pagar:importar` está completo, testado contra Postgres real e provado contra as 2.861 Tarefas de verdade do export — falta só o ato humano de rodá-lo contra `ws_n1` (Task 4, checkpoint bloqueante).**

## Performance

- **Duration:** ~3h (Tasks 1-3 completas e commitadas; Task 4 é o portão humano)
- **Tasks:** 3 de 4 (Task 4 é `checkpoint:human-action`, `gate="blocking"` — aguardando o operador)
- **Files created:** 8
- **Files modified:** 2

## Accomplishments

- **O classificador foi provado contra os dados reais, não só contra fixture.** `classificarTarefaLegada` roda sobre as 2.861 Tarefas do export de verdade (`apps/api/exportacoes/clickup/901107637383/`, presente neste ambiente) e reproduz, byte a byte, todos os números que o plano exigia como critério: `2861` válidas, `0` rejeitadas, soma de transições `12490`, vencimento presente em `2830`, `0` ocorrências de `status_final_sem_equivalente`/`opcao_fora_do_dominio`, `630` Tarefas com sinal de reentrada de Status, `82` das `83` contas abertas com os dois vencimentos divergindo. Esses números foram medidos duas vezes de forma independente — uma vez em Python fora do código de produção, e outra vez pelo próprio teste TypeScript contra o mesmo export — antes de qualquer linha de `contas-a-pagar.ts` ser considerada correta.
- **A CLI rodou de verdade em `--dry-run` contra o export real nesta execução** (não contra produção — nenhuma escrita no Postgres): `lidas 2861 · importadas 38 · avisadas 2823 · rejeitadas 0 · puladas 0`, com o mapa completo de lacunas por categoria impresso. O artefato gerado por essa corrida de verificação foi apagado antes de qualquer commit — o relatório real, commitável, nasce só na Task 4.
- **A atomicidade Tarefa+ledger foi provada por injeção de falha, não por leitura de código.** Um testing seam documentado (`forcarFalhaDeLedgerParaTesteDeAtomicidade`) corrompe o `resultado` da primeira linha do lote para fora do `check` da migração `003`, força `aoConfirmar` a lançar dentro da transação, e o teste confirma que `state.tasks` e o ledger ficam exatamente como estavam antes — nenhuma Tarefa órfã, nenhuma linha de ledger sem Tarefa.
- **`MARCO_ZERO` fechou uma lacuna que o texto do plano não cobria explicitamente: idempotência ENTRE dias civis, não só dentro do mesmo dia.** A migração `005` permite, tecnicamente, uma segunda linha de `automacao_agenda` para um `dia_civil` diferente do mesmo par `(workspace_id, list_id)` — o `on conflict` da PK só protege contra o MESMO dia. Um segundo `--apply` num dia civil diferente do primeiro criaria uma segunda marca, quebrando "exatamente uma linha". `marcarMarcoZero` ganhou uma pré-checagem por `last_error_code = MARCO_ZERO` antes de inserir, tornando a marca idempotente por `(workspaceId, listId)` de verdade — provado pelo caso (b2) do teste.

## Task Commits

1. **Task 1: O classificador — do export em disco para `EntradaDeContaAPagarHistorica`** — `c60dba5` (feat)
2. **Task 2: A orquestração — lotes sob `executar()`, ledger na mesma transação, retomada** — `9ff6c13` (feat)
3. **Task 3: `MARCO_ZERO`, o CLI e o registro em `CONTEXT.md`** — `7e1c100` (feat)

**Task 4 (checkpoint bloqueante):** não executada nesta rodada — ver "What's Next".

## Files Created/Modified

- `apps/api/src/importacao/clickup/contas-a-pagar.ts` *(criado, 559 linhas)* — `DE_PARA_DE_STATUS`/`DE_PARA_DE_CAMPOS`/`DE_PARA_DE_TAGS`, `lerTarefasDoExport`, `verificarIntegridadeDoExport`, `comoInstanteDeEpoch`/`comoDiaCivil`, `classificarTarefaLegada`
- `apps/api/src/importacao/clickup/contas-a-pagar.test.ts` *(criado, 15 casos)* — (a)-(j) sobre fixture fictícia, sempre; (k) sobre o export real, `describe.skipIf`
- `apps/api/src/importacao/clickup/fixtures/contas-a-pagar-sanitizadas.json` *(criado, 10 Tarefas 100% fictícias)*
- `apps/api/src/importacao/clickup/importar-contas-a-pagar.ts` *(criado)* — `importarLote`, `importarTudo`, `reconciliar`, `relatorioSanitizado`, `relatorioDetalhadoPorLinha`, `hashCanonico`
- `apps/api/src/importacao/clickup/importar-contas-a-pagar.test.ts` *(criado, 9 casos contra Postgres real)*
- `apps/api/src/importacao/clickup/marco-zero.ts` *(criado)* — `marcarMarcoZero`, `diaCivilDeHoje`
- `apps/api/src/importacao/clickup/marco-zero.test.ts` *(criado, 7 casos — 5 contra Postgres real, 2 puros)*
- `apps/api/src/importacao/clickup/importar-contas-a-pagar.cli.ts` *(criado)* — CLI fino, dry-run por padrão
- `apps/api/package.json` — script `contas-a-pagar:importar` (acréscimo puro, ao lado de `automacoes:liberar`)
- `apps/api/src/importacao/clickup/CONTEXT.md` — três seções novas + complemento a "Histórico de status"

## Decisions Made

Ver `key-decisions` no frontmatter — resumo: precedência do vencimento nativo (com a evidência de 82/83 divergências), lote de 250 (com o custo nomeado de cada alternativa), `MARCO_ZERO` idempotente por par `(workspaceId, listId)` em vez de por `(workspaceId, listId, diaCivil)`, e `reconciliar()` com dois filtros independentes (origem do ledger vs. proveniência fixa da Tarefa).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `MARCO_ZERO` não seria idempotente entre dias civis diferentes**
- **Found during:** Task 3, ao desenhar `marcarMarcoZero` a partir do texto do plano
- **Issue:** O texto do plano descreve `marcarMarcoZero` como um `insert ... on conflict (workspace_id, list_id, dia_civil) do nothing` — que só impede duplicata no MESMO dia civil. Como o Task 4 exige rodar `--apply` duas vezes (possivelmente em dias diferentes, e certamente o `--so-marco-zero` de recuperação pode rodar num dia distinto do da importação original), esse desenho deixaria nascer uma SEGUNDA linha de `MARCO_ZERO` para um dia civil diferente — quebrando a invariante "exatamente uma linha" que o próprio plano exige como critério de aceite da Task 4.
- **Fix:** `marcarMarcoZero` pré-verifica `select 1 from plataforma.automacao_agenda where workspace_id = $1 and list_id = $2 and last_error_code = 'MARCO_ZERO'` ANTES do insert; se já existe uma marca (em qualquer dia civil), devolve `false` sem gravar. O `on conflict` da PK continua como segunda camada para o caso raro de corrida no mesmo dia.
- **Files modified:** `apps/api/src/importacao/clickup/marco-zero.ts`
- **Verification:** Caso (b2) de `marco-zero.test.ts` — chamar com dias civis diferentes não cria uma segunda linha (contra Postgres real).
- **Committed in:** `7e1c100` (Task 3)

**2. [Rule 2 - Missing Critical] Prova de atomicidade Tarefa+ledger precisava de um testing seam**
- **Found during:** Task 2, ao escrever o caso (b) exigido pelo plano ("forçar a falha de `aoConfirmar`")
- **Issue:** O código de produção nunca gera, organicamente, um `resultado` de ledger fora do `check` da migração `003` (só `importada`/`rejeitada`/`avisada` são possíveis) — não havia caminho honesto de exercitar a falha de `aoConfirmar` sem um gancho de teste.
- **Fix:** Acrescentado `forcarFalhaDeLedgerParaTesteDeAtomicidade?: boolean` em `OpcoesDeLote`, documentado extensivamente como "SÓ para prova de atomicidade em teste", que corrompe o `resultado` da primeira linha só quando explicitamente ligado. Nunca usado fora de `importar-contas-a-pagar.test.ts`.
- **Files modified:** `apps/api/src/importacao/clickup/importar-contas-a-pagar.ts`
- **Verification:** Caso (b) prova que `state.tasks` e o ledger ficam vazios depois da falha forçada.
- **Committed in:** `9ff6c13` (Task 2)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 lacuna crítica de testabilidade).
**Impact on plan:** Ambos essenciais para que os critérios de aceite do próprio plano (idempotência de `MARCO_ZERO`, prova de atomicidade) fossem verdadeiros e verificáveis, não assumidos. Nenhum scope creep — nenhuma funcionalidade além do que o plano descreveu.

## Issues Encountered

- **`npm run test -w @n1/api` (suíte inteira) teve uma falha isolada e não relacionada na primeira rodada:** `src/rotas/classificacoes.test.ts` (rota de classificação de comentário de Solicitação de pagamento, Plan 02-24 — fora do escopo desta plano) estourou o timeout de 180s num único caso. Confirmado como flake ambiental: (1) o arquivo não tem diff desde o commit `c693ae7`, de uma plano anterior sem relação; (2) rodado isoladamente logo em seguida, passou em 11,46s (8/8). A causa mais provável é contenção de recursos desta máquina durante a primeira rodada (várias análises Python e processos em paralelo rodando ao mesmo tempo). A segunda rodada completa, sem trabalho concorrente, terminou com os três workspaces 100% verdes.
- **A suíte completa de `@n1/api` contra o Supabase real leva entre 14 e 16 minutos** — decompor por arquivo (como as Tasks 1-3 fizeram durante o desenvolvimento) e rodar a suíte inteira em segundo plano, monitorando o processo pelo PID em vez de reler a saída repetidamente, foi o que funcionou de forma confiável nesta máquina.

## User Setup Required

None para o código desta plano. A Task 4 (abaixo) precisa de um ato humano deliberado — não é configuração de serviço externo, é a decisão de importar dados reais de produção.

## Next Phase Readiness — Task 4 aguarda o operador

**Tudo que a Task 4 (`checkpoint:human-action`, `gate="blocking"`) precisa já está construído, testado e commitado.** O que falta é genuinamente humano: rodar o `--apply` contra `ws_n1` de produção, ler o relatório de lacunas ANTES de gravar (em particular `vencimento_l_diverge_do_nativo`, ~329 no total e 82 entre as 117 contas ainda em `para pagar` — a decisão de usar o vencimento nativo é do Financeiro, não do executor), confirmar a prova de no-op na segunda execução, e só então liberar a agenda com `npm run automacoes:liberar`.

Ver o `## CHECKPOINT REACHED` desta execução para os passos exatos.

- **PAG-01 fica code-complete, sem dado real na plataforma ainda.** A Fase 3 permanece com a importação real pendente até a Task 4 rodar.
- **`plataforma.importacao_ledger`, `plataforma.automacao_agenda` e o schema `plataforma.registros` não mudaram de forma nesta plano** — nenhuma migração nova (DEC-10 preservado).
- **`packages/dominio` e `apps/web` sem uma linha de diff** — confirmado por `git diff --quiet packages/dominio apps/web` (critério de verificação do plano).

## Known Stubs

Nenhum. Task 4 não é um stub — é o portão humano documentado no próprio plano (`autonomous: false`, seção "Por que este plano é `autonomous: false`").

## Threat Flags

Nenhuma superfície nova fora do `<threat_model>` do plano. T-3-25, T-3-26, T-3-27, T-3-28, T-3-29, T-3-30 e T-3-02 estão mitigados conforme desenhado, cada um com caso de teste nomeado (ver os arquivos `.test.ts` criados). T-3-SC (instalação de pacote) não se aplica — nenhuma dependência nova foi instalada.

## Self-Check: PASSED

- FOUND: apps/api/src/importacao/clickup/contas-a-pagar.ts
- FOUND: apps/api/src/importacao/clickup/contas-a-pagar.test.ts
- FOUND: apps/api/src/importacao/clickup/fixtures/contas-a-pagar-sanitizadas.json
- FOUND: apps/api/src/importacao/clickup/importar-contas-a-pagar.ts
- FOUND: apps/api/src/importacao/clickup/importar-contas-a-pagar.test.ts
- FOUND: apps/api/src/importacao/clickup/marco-zero.ts
- FOUND: apps/api/src/importacao/clickup/marco-zero.test.ts
- FOUND: apps/api/src/importacao/clickup/importar-contas-a-pagar.cli.ts
- FOUND commit: c60dba5 (Task 1)
- FOUND commit: 9ff6c13 (Task 2)
- FOUND commit: 7e1c100 (Task 3)
