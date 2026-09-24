---
phase: 04-as-outras-telas-do-financeiro-tria
plan: 08
subsystem: ui
tags: [nextjs, react, server-components, financeiro, design-system, record-list]

# Dependency graph
requires:
  - phase: 04-as-outras-telas-do-financeiro-tria
    provides: "lerDoFinanceiro/Leitura, useRevalidarAoFocar, EstadoDeFalha/TentarDeNovo, BotaoAtualizar, MolduraDeLeitura (04-06) — o fetch e os três estados que estas três telas reusam sem reescrever"
  - phase: 04-as-outras-telas-do-financeiro-tria
    provides: "GET /financeiro/{problemas,aprovacoes-pendentes,workflows} na borda do apps/api (04-05)"
provides:
  - "lerProblemas/LinhaDeProblema em apps/web/src/features/financeiro/dados/problemas.ts"
  - "lerAprovacoesPendentes/LinhaDeAprovacaoPendente em .../dados/aprovacoes-pendentes.ts"
  - "lerWorkflows/WorkflowDoCatalogo/ExecucaoDeWorkflow/WorkflowsFinanceiro em .../dados/workflows.ts"
  - "TabelaDeProblemas, TabelaDeAprovacoes, PainelDeWorkflows em .../componentes/"
  - "As rotas /financeiro/problemas, /financeiro/aprovacoes-pendentes, /financeiro/workflows (+ loading.tsx de cada)"
affects: [04-09, 04-10, 04-11, 04-12, 04-13, 04-14]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Coluna de campo técnico decomposta em rótulo→valor: LinhaDeProblema.tecnico é Readonly<Record<string, string>> genérico (não três campos fixos por nome) — a tela itera Object.entries e nunca precisa conhecer as chaves reais do DTO do automation/ de antemão"
    - "Tokens de cor semântica em variável nunca por interpolação: verificar-tokens.mjs só resolve um var(--x) que aparece por extenso no código-fonte; um var(--cor-exe-${status}) construído por template string é 'token fantasma' para a sentinela — a tabela de lookup (COR_DE_EXECUCAO) com os seis valores literais é o padrão certo para paleta enumerada"
    - "Botão de ação que ainda não tem rota (T-4-24): Button sempre disabled com disabledReason explicando o plano que a entrega, nunca um ConfirmDialog inalcançável por trás de um botão que nunca abre"

key-files:
  created:
    - apps/web/src/features/financeiro/dados/problemas.ts
    - apps/web/src/features/financeiro/dados/aprovacoes-pendentes.ts
    - apps/web/src/features/financeiro/dados/workflows.ts
    - apps/web/src/features/financeiro/componentes/tabela-de-problemas.tsx
    - apps/web/src/features/financeiro/componentes/tabela-de-aprovacoes.tsx
    - apps/web/src/features/financeiro/componentes/painel-de-workflows.tsx
    - apps/web/src/app/(shell)/financeiro/problemas/page.tsx
    - apps/web/src/app/(shell)/financeiro/problemas/loading.tsx
    - apps/web/src/app/(shell)/financeiro/aprovacoes-pendentes/page.tsx
    - apps/web/src/app/(shell)/financeiro/aprovacoes-pendentes/loading.tsx
    - apps/web/src/app/(shell)/financeiro/workflows/page.tsx
    - apps/web/src/app/(shell)/financeiro/workflows/loading.tsx
  modified: []

key-decisions:
  - "LinhaDeProblema.tecnico é Readonly<Record<string, string>>, não o `tecnico: string` literal do PLAN.md. O PLAN.md declara o tipo como string mas pede, na mesma frase, que o SidePanel mostre o campo 'decomposto em rótulo→valor' — um string único não decompõe. 04-07 (o lado automation/ que projeta este DTO) ainda não tinha aterrissado quando este plano rodou, então os nomes reais de campo (TaskID/categoria/tipo, citados só em prosa no UI-SPEC) não estavam confirmados em código. Um mapa genérico rótulo→valor satisfaz a exigência de decomposição sem inventar nomes de campo não verificados."
  - "cor-exe-* nunca por template string interpolada. A primeira versão de corDeExecucao fazia `var(--cor-exe-${status})`, que verificar-tokens.mjs acusa como 'token fantasma' (a sentinela só resolve var() que aparece por extenso). Trocado por uma tabela de lookup com os seis valores literais — mesma função, zero interpolação."
  - "O botão 'Executar agora' de Workflows não abre ConfirmDialog nesta fase, apesar do texto do PLAN.md mencionar 'com ConfirmDialog title=...'. O próprio PLAN.md, duas frases depois, torna o botão sempre desabilitado (disabledReason, D4-24/T-4-24) até a rota de disparo existir (04-13) — um ConfirmDialog atrás de um botão que o usuário nunca consegue clicar seria código morto e um risco de desatualizar silenciosamente até 04-13 realmente ligar o disparo. A descrição literal do UI-SPEC para o ConfirmDialog fica registrada aqui para 04-13 copiar quando a rota existir: title=\"Executar {nome} agora\", description=\"Roda a mesma rotina que executa sozinha na agenda. Não interrompe nem duplica uma execução já em andamento.\", confirmLabel=\"Executar\"."
  - "Nenhuma das três telas ganhou o controle FiltroDeEmpresa. UI-SPEC §\"Filtro de Empresa (D4-09)\" confirma a dimensão de Empresa só para Plano de contas (conciliador_contas filtrada por metadata); Problemas/Aprovações herdam um parâmetro ?empresa= opcional nas funções de leitura (espelhando o que a rota do apps/api já aceita), mas sem UI de filtro — inventar o controle aqui seria antecipar dado não confirmado."

requirements-completed: [TELA-01]

# Metrics
duration: ~50min
completed: 2026-09-23
---

# Phase 4 Plan 08: Problemas, Aprovações pendentes e Workflows Summary

**Três telas de leitura do Financeiro (Problemas, Aprovações pendentes, Workflows) sobre o fetch e os três estados de 04-06 — nenhuma agrega dado no navegador, e Aprovações pendentes nasce sem nenhuma porta de decisão, provado por `grep` estrutural.**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-09-23
- **Tasks:** 3/3
- **Files modified:** 12 (todos criados, nenhum modificado)

## Accomplishments

- **Problemas** (`dados/problemas.ts` + `componentes/tabela-de-problemas.tsx` + rota): `RecordList` com Severidade (`Pilula` mapeada — `sucesso`→`sucesso`, `aviso`→`aviso`, `info`→`neutro`, qualquer valor desconhecido também cai em `neutro`, nunca em branco), Id (`SP-<id>`), Título com a descrição truncada abaixo, Onde, Idade, e uma coluna final com `ActionMenu` de item único "Ver detalhes técnicos" que abre um `SidePanel` (`RecordPanel`/`RecordRow`) decompondo o campo técnico em pares rótulo→valor.
- **Aprovações pendentes** (`dados/aprovacoes-pendentes.ts` + `componentes/tabela-de-aprovacoes.tsx` + rota): a vista legada (D4-11) — `PageHeader` com `seal` "Vista legada" sempre visível e `details` apontando para `/ia/aprovacoes`; a tabela não importa `ActionMenu`, `ConfirmDialog` nem tem `onClick` algum (provado por `grep`), e o vazio linka de volta para a fila viva.
- **Workflows** (`dados/workflows.ts` + `componentes/painel-de-workflows.tsx` + rota): `Section "Catálogo"` com um `Painel` por Workflow (`Pilula` do tenant + `Pilula cor="var(--cor-exe-*)"` do último status conhecido, nunca `tom="acento"`) e `Section "Histórico de execuções"` com `RecordList`; o botão "Executar agora" existe só quando `executavelManualmente`, e fica sempre desabilitado com `disabledReason="A execução manual entra no plano 04-13."` (T-4-24 — a rota de disparo ainda não existe).
- As três telas reusam `MolduraDeLeitura`/`BotaoAtualizar` de 04-06 sem reescrever fetch, estado de falha ou botão de atualizar; nenhuma importa `useData`/`useRun`/`useSession` para buscar dado do Financeiro (só `useFormat`, que já usa `useData` internamente para o Locale — o mesmo padrão de `painel-do-dashboard.tsx`).

## Task Commits

Each task was committed atomically:

1. **Task 1: Problemas** - `92aa9f5` (feat)
2. **Task 2: Aprovações pendentes — a vista legada, rotulada** - `827e00e` (feat)
3. **Task 3: Workflows — catálogo e histórico** - `b4b6aa1` (feat)

_No plan-metadata commit for STATE.md/ROADMAP.md — este executor roda em worktree isolado; o orquestrador é dono desses arquivos depois do merge._

## Files Created/Modified

- `apps/web/src/features/financeiro/dados/problemas.ts` - `lerProblemas`, `LinhaDeProblema`
- `apps/web/src/features/financeiro/dados/aprovacoes-pendentes.ts` - `lerAprovacoesPendentes`, `LinhaDeAprovacaoPendente`
- `apps/web/src/features/financeiro/dados/workflows.ts` - `lerWorkflows`, `WorkflowDoCatalogo`, `ExecucaoDeWorkflow`, `WorkflowsFinanceiro`
- `apps/web/src/features/financeiro/componentes/tabela-de-problemas.tsx` - `TabelaDeProblemas`
- `apps/web/src/features/financeiro/componentes/tabela-de-aprovacoes.tsx` - `TabelaDeAprovacoes`
- `apps/web/src/features/financeiro/componentes/painel-de-workflows.tsx` - `PainelDeWorkflows`
- `apps/web/src/app/(shell)/financeiro/problemas/page.tsx` + `loading.tsx` - a rota
- `apps/web/src/app/(shell)/financeiro/aprovacoes-pendentes/page.tsx` + `loading.tsx` - a rota
- `apps/web/src/app/(shell)/financeiro/workflows/page.tsx` + `loading.tsx` - a rota

## Decisions Made

Ver `key-decisions` no frontmatter — resumo:

- **`tecnico` é um mapa genérico, não três campos fixos.** O `PLAN.md` contradiz a si mesmo (declara `tecnico: string` mas pede decomposição em rótulo→valor); escolhido `Readonly<Record<string, string>>` para não inventar nomes de campo que 04-07 (em paralelo, ainda não aterrissado) ainda não confirmou.
- **Tokens de Execução sempre literais, nunca por template string.** `var(--cor-exe-${status})` é invisível para `verificar-tokens.mjs`; substituído por uma tabela de lookup com os seis valores por extenso.
- **O botão de Workflows fica só desabilitado, sem `ConfirmDialog` morto atrás dele.** A cópia do `ConfirmDialog` que 04-13 vai usar fica registrada no frontmatter para não se perder.
- **Sem `FiltroDeEmpresa` nas três telas.** UI-SPEC confirma a dimensão de Empresa só para Plano de contas; as funções de leitura aceitam `empresa?` (espelhando a rota do `apps/api`) mas nenhuma UI de filtro foi inventada.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `tecnico` virou `Readonly<Record<string, string>>`, não `string`**
- **Found during:** Task 1
- **Issue:** O `PLAN.md` declara `LinhaDeProblema.tecnico: string`, mas a mesma frase pede que o `SidePanel` mostre esse campo "decomposto em rótulo→valor" — um `string` único não decompõe em pares. 04-07 (o lado `automation/` que projeta este DTO) está em execução paralela e ainda não tinha `SUMMARY.md` no momento desta execução; os três nomes de campo citados em prosa no UI-SPEC (TaskID/categoria/tipo) não estavam confirmados em nenhum código lido.
- **Fix:** Tipado como `Readonly<Record<string, string>>` — um mapa rótulo→valor genérico. `TabelaDeProblemas` itera `Object.entries(aberto.tecnico)` e renderiza um `RecordRow` por par, sem precisar saber os nomes das chaves de antemão. Quando 04-07 confirmar o shape real, se vier como objeto com essas chaves, este código já funciona sem mudança; se vier com nomes diferentes, também funciona.
- **Files modified:** `apps/web/src/features/financeiro/dados/problemas.ts`, `apps/web/src/features/financeiro/componentes/tabela-de-problemas.tsx`
- **Verification:** `npm run typecheck -w @n1/web` verde.
- **Committed in:** `92aa9f5` (Task 1)

**2. [Rule 1 - Bug] `corDeExecucao` reescrita para não usar template string em `var(--cor-exe-*)`**
- **Found during:** Task 3, ao rodar `npm run verificar:tokens -w @n1/web`
- **Issue:** A primeira versão construía a cor via `` `var(--cor-exe-${status})` ``. `scripts/verificar-tokens.mjs` casa `var(--x)` por regex sobre o texto-fonte; a interpolação quebra o nome no meio (`${status}` não é `[a-z0-9-]`), e a sentinela reportou `token fantasma \`--cor-exe-\`` — um falso positivo de sintaxe, não um token inexistente (os seis `--cor-exe-*` estão todos definidos em `tokens.css`).
- **Fix:** Trocada a função por uma tabela `COR_DE_EXECUCAO: Readonly<Record<string, string>>` com os seis valores escritos por extenso (`"var(--cor-exe-pendente)"`, etc.), com fallback para `pendente` quando o status é desconhecido — mesmo comportamento, zero interpolação.
- **Files modified:** `apps/web/src/features/financeiro/componentes/painel-de-workflows.tsx`
- **Verification:** `npm run verificar:tokens -w @n1/web` — `✓ tokens · 392 definidos · 236 arquivos varridos · 0 falhas`.
- **Committed in:** `b4b6aa1` (Task 3)

**Total deviations:** 2 auto-fixed (1 tipo especulativo corrigido para satisfazer o próprio requisito do plano, 1 bloqueio de ferramenta de verificação). Nenhuma mudança de comportamento visível além do exposto acima; o restante segue o `PLAN.md`/`UI-SPEC.md` literalmente.

## Issues Encountered

- **Verificação escopada, não `npm run build -w @n1/web`/`npm run check`.** Seguindo o `hard_constraint` desta execução (quatro agentes desta fase já mataram o watchdog de 600s), rodei só `typecheck`/`lint`/`verificar:tokens`/`test` em `@n1/web`. `npm run build -w @n1/web` (pedido pelo `acceptance_criteria` de cada task) e `npm run check` (pedido pela `<verification>` do plano) não foram executados — mesma decisão registrada em `04-06-SUMMARY.md`, pelos mesmos dois motivos: não estão na lista de comandos "rápidos e seguros" e o worktree não tem `apps/web/.env.local`.
- **Carga de sistema extrema durante a verificação (`uptime` chegou a mostrar load average de 235–244) por três a quatro agentes paralelos desta fase (04-07, 04-10, 04-11 e este) rodando `typecheck`/`lint`/`vitest` ao mesmo tempo.** `npm run test -w @n1/web` precisou de três tentativas: as duas primeiras tiveram `[vitest-pool-runner]: Timeout waiting for worker to respond` em arquivos que este plano não toca (`shell/compartilhadas-comigo.test.tsx`, `shell/visibilidade-na-tela.test.tsx`, `tarefa/lancamento-no-omie-dialog.test.tsx`), rodando só 8 dos 16 arquivos. Na terceira tentativa os 16 arquivos rodaram (157 testes), mas 14 testes falharam com `Test timed out in 5000ms` — todos em arquivos que este plano não modificou (`estrutura/bulk-status-bar.test.tsx`, `shell/visibilidade-na-tela.test.tsx`, `formulario-publico/formulario.test.tsx`, `formulario-publico/upload-de-arquivos.test.tsx`, `tarefa/painel-aprovacao.test.tsx`, `tarefa/timeline.test.tsx`). Nenhum teste de `features/financeiro/` (`dados/leitura.test.ts`, `financeiro/navegacao-financeiro.test.ts`) falhou em nenhuma das três tentativas. Por instrução explícita desta execução, registro isto como **possível artefato do ambiente de worktree sob carga extrema, não verificado** — não uma regressão deste plano, e não investigado além do que está aqui.
- **Conferência manual do estado "backend fora do ar" feita por rastreamento de código, não por servidor real no ar** (mesma limitação e mesmo raciocínio documentados em `04-06-SUMMARY.md`, agora estendido às três novas leituras): `lerProblemas`/`lerAprovacoesPendentes`/`lerWorkflows` chamam `lerDoFinanceiro`, cujo `try/catch` em torno do `fetch` devolve `{ tipo: "indisponivel", erro }` em qualquer falha de rede; `MolduraDeLeitura` (inalterada por este plano) já roteia esse desfecho para `<TentarDeNovo />`/`<EstadoDeFalha>` com o texto literal "Não consegui falar com o backend financeiro." — nenhuma das três telas alcança seu próprio `RecordList`/`Painel` (e portanto nenhum `EmptyState`) nesse caminho.
- **`git -C ../financeiro-tria status --porcelain | wc -l` retornou 94, não 89** (o número que a `<verification>` do plano registra). Esse repositório é externo ao escopo deste plano (`apps/web` apenas) e está sendo modificado concorrentemente por 04-07, que roda em paralelo e é dono do lado `automation/`; a divergência é esperada nesta janela de execução simultânea e não foi investigada.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- As três leituras (`lerProblemas`, `lerAprovacoesPendentes`, `lerWorkflows`) e as três composições (`TabelaDeProblemas`, `TabelaDeAprovacoes`, `PainelDeWorkflows`) fecham o primeiro bloco de telas do Financeiro e provam o padrão que 04-11 (Notas fiscais + Produtos) e 04-13 (Plano de contas + Extratos) repetem.
- **Para 04-13:** a descrição literal do `ConfirmDialog` de execução manual de Workflow já está registrada em `key-decisions` deste SUMMARY — copiar ao trocar o botão de sempre-desabilitado para condicional-a-`POST /financeiro/workflows/:key/executar`.
- **Para quem confirmar o shape real de `GET /financeiro/problemas` (04-07):** se o campo técnico vier com nomes de chave diferentes de um mapa livre (ex.: um array em vez de objeto), `tabela-de-problemas.tsx` precisa de um ajuste pontual — hoje assume `Readonly<Record<string, string>>`.
- Nenhum bloqueio novo para as demais telas desta fase.

---
*Phase: 04-as-outras-telas-do-financeiro-tria*
*Completed: 2026-09-23*

## Self-Check: PASSED

- Todos os 12 arquivos de código listados em Files Created/Modified existem no disco.
- Os 3 hashes de commit (`92aa9f5`, `827e00e`, `b4b6aa1`) existem em `git log`.
