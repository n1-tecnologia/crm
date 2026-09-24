---
phase: 04-as-outras-telas-do-financeiro-tria
plan: 11
subsystem: ui
tags: [nextjs, react, server-actions, financeiro, design-system, d4-04]

# Dependency graph
requires:
  - phase: 04-as-outras-telas-do-financeiro-tria
    provides: "lerDoFinanceiro/Leitura, useRevalidarAoFocar, EstadoDeFalha/BotaoAtualizar/MolduraDeLeitura em apps/web/src/features/financeiro/ (Plan 04-06)"
  - phase: 04-as-outras-telas-do-financeiro-tria
    provides: "GET /financeiro/notas-fiscais, GET /financeiro/produtos na borda do apps/api (Plan 04-05)"
  - phase: 04-as-outras-telas-do-financeiro-tria
    provides: "NotaFiscalDto/ProdutoDto (projeção positiva allowlist) em financeiro-tria/automation/src/http/leituras-plataforma-dtos.ts (Plan 04-01)"
provides:
  - "lerNotasFiscais/NotaFiscal em apps/web/src/features/financeiro/dados/notas-fiscais.ts"
  - "lerProdutos/Produto em apps/web/src/features/financeiro/dados/produtos.ts"
  - "salvarAliquotas/executarWorkflow/importarPlanoDeContas/removerLinhaDoPlanoDeContas em apps/web/src/features/financeiro/dados/acoes.ts — as Server Actions do Financeiro, prontas para 04-13 reusar sem duplicar transporte"
  - "TabelaDeNotasFiscais e TabelaDeProdutos em apps/web/src/features/financeiro/componentes/ — telas completas (PageHeader+corpo), não só a tabela"
  - "Rotas /financeiro/notas-fiscais e /financeiro/produtos (page.tsx + loading.tsx) renderizadas de ponta a ponta"
affects: [04-13]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Componente client dono do PageHeader inteiro (não só o corpo): quando os botões do actions precisam compartilhar estado (diálogo aberto, Toast do resultado) com o corpo, o componente que MolduraDeLeitura invoca via children monta PageHeader+CorpoDeTela+diálogos juntos — PageHeader já é Client Component (declarado dentro de features/shell/ui.tsx, que abre com \"use client\"), então isso não quebra a fronteira servidor/cliente"
    - "Grava no blur sem tocar design/components.tsx: TextInput não expõe onBlur; o padrão já existente em features/shell/ficha.tsx (EditorDeTexto/EditorDeNumero) embrulha o campo num <span onBlur={...}> — o blur do <input> borbulha até o span ancestral"
    - "Icone não repassa `title` (a assinatura de LucideIcon usada por design/icone.tsx não o expõe) — quando um ícone precisa de tooltip nativo, embrulha-se num <span title={...}> em vez de passar a prop direto"
    - "Server Action nunca lança: toda função de dados/acoes.ts devolve { ok: true } | { ok: false, erro }, mesmo padrão de leitura.ts para o desfecho de erro"

key-files:
  created:
    - apps/web/src/features/financeiro/dados/acoes.ts
    - apps/web/src/features/financeiro/dados/notas-fiscais.ts
    - apps/web/src/features/financeiro/dados/produtos.ts
    - apps/web/src/features/financeiro/componentes/tabela-de-notas-fiscais.tsx
    - apps/web/src/features/financeiro/componentes/tabela-de-produtos.tsx
    - apps/web/src/app/(shell)/financeiro/notas-fiscais/page.tsx
    - apps/web/src/app/(shell)/financeiro/notas-fiscais/loading.tsx
    - apps/web/src/app/(shell)/financeiro/produtos/page.tsx
    - apps/web/src/app/(shell)/financeiro/produtos/loading.tsx
  modified: []

key-decisions:
  - "Sem o Select de Plataforma em Notas fiscais. UI-SPEC/PLAN pedem um quarto filtro sobre esse campo, mas `NotaFiscalDto` (04-01, já mesclado em financeiro-tria/automation) não o projeta — só as 13 propriedades de `NotaFiscal` atravessam a fronteira do apps/api, e a coluna `plataforma` de `transacoes` (confirmada no inventário) fica de fora dessa allowlist. A regra do próprio UI-SPEC (\"as opções são derivadas dos valores DISTINTOS presentes no array — nunca um enum inventado\") torna isso literalmente impossível de implementar sem tocar o DTO em financeiro-tria/automation, fora do files_modified e do escopo deste plano (external_repo_note). Ficaram os dois filtros que têm dado real: Status do pedido e Forma de pagamento, mais a busca por pedido/cliente."
  - "meta do PageHeader usa contagens dinâmicas (`${filtradas.length} de ${notas.length}`), não os números fixos \"1.987\"/\"42\" que o UI-SPEC cita. Esses números são o corte do inventário no momento da pesquisa, não um teto real (ao contrário de `ContatosPage`, onde o segundo número é `state.workspace.limits.contacts`, um limite de configuração de verdade). Hardcodar 1.987/42 no código ficaria stale na primeira venda nova ou produto cadastrado — o oposto do que a fase inteira defende (nunca mostrar um número que mentiria)."
  - "TabelaDeNotasFiscais e TabelaDeProdutos são a tela inteira (PageHeader+BarraDeFiltros+CorpoDeTela+diálogos), não só a peça de tabela que o nome sugere — mesmo nome de arquivo do PLAN.md, escopo maior. Necessário porque os dois botões de lote (Notas fiscais) e o Toast de resultado da alíquota (Produtos) precisam do `actions` do PageHeader E de estado compartilhado com o corpo; page.tsx (Server Component) só sabe passar `(dados, lidoEm) => ReactNode` para `MolduraDeLeitura`, então quem monta cabeçalho+corpo juntos tem que ser esse componente client único."

requirements-completed: [TELA-01]

# Metrics
duration: ~120min (dominado por espera de CI compartilhado — ver Issues Encountered)
completed: 2026-09-23
---

# Phase 4 Plan 11: As duas telas que hoje leem Supabase direto com a chave anon Summary

**Notas fiscais (~1.987 linhas, nove colunas, dois gatilhos de lote assíncronos) e Produtos (edição de alíquota no blur com reversão em falha) migrados de leitura direta do Supabase para `apps/api`, fechando D4-04 para as duas tabelas mais sensíveis da migração.**

## Performance

- **Duration:** ~120 min (execução de código foi rápida; a maior parte do tempo foi esperando `typecheck`/`lint` competirem por CPU com ~6 agentes irmãos rodando em paralelo na mesma máquina — load average 130-190 num host de 8 núcleos)
- **Completed:** 2026-09-23
- **Tasks:** 3/3
- **Files modified:** 9 (todos criados, nenhum modificado)

## Accomplishments

- `dados/acoes.ts`: as Server Actions do Financeiro — `salvarAliquotas`, `executarWorkflow`, `importarPlanoDeContas`, `removerLinhaDoPlanoDeContas` — todas `"use server"`, todas devolvendo `{ ok } | { ok: false, erro }` (nunca lançam), com `escreverNoFinanceiro` repetindo o caminho de obtenção de token de `leitura.ts`. `executarWorkflow` deliberadamente NÃO chama `revalidatePath` (D4-12: a corrida é assíncrona, revalidar mostraria a tabela de antes da corrida terminar como se fosse o resultado). `importarPlanoDeContas`/`removerLinhaDoPlanoDeContas` ficam prontas para 04-13 usar sem duplicar o transporte.
- `dados/notas-fiscais.ts` + `dados/produtos.ts`: os dois tipos (`NotaFiscal`, `Produto`) espelhando `NotaFiscalDto`/`ProdutoDto` de `financeiro-tria/automation/src/http/leituras-plataforma-dtos.ts` (04-01) campo a campo, e as duas funções de leitura sobre `lerDoFinanceiro` (04-06).
- `componentes/tabela-de-notas-fiscais.tsx`: a tela completa — `PageHeader` com os dois botões de lote ("Marcar 7 dias"/"Emitir notas pendentes", cada um com seu `ConfirmDialog` e a copy literal do UI-SPEC) mais `BotaoAtualizar`; `BarraDeFiltros` com busca (pedido/cliente) e dois `Select` (Status do pedido, Forma de pagamento) com opções derivadas dos valores distintos do array; `RecordList` com as nove colunas (Pedido, Cliente, Produto(s) truncado, Valor via `fmt.money`, Pagamento, Status em `Pilula` com o mapeamento de tom, Emissão com três ícones `CheckCircle2`, 7 dias, Aprovado em via `fmt.instant`) — nenhuma ação por linha. Ao confirmar um gatilho, chama `executarWorkflow`, fecha o diálogo e mostra `Toast tone="neutral"` com a ação "Atualizar agora" (`router.refresh()` via `BotaoAtualizar`/`useRevalidarAoFocar`).
- `componentes/tabela-de-produtos.tsx`: `RecordList` de três colunas (Produto com `idProduto`/`nomeProduto`, % Serviço, % Produto); as duas últimas editáveis via `CampoDeAliquota`, um componente local que grava no blur (embrulhando `TextInput` num `<span onBlur>`, já que o `TextInput` do barril não expõe `onBlur`), mostra `disabled`+`disabledReason="Salvando…"` durante a chamada, `Toast tone="success"` ("Alíquota atualizada.") no sucesso e reverte ao último valor confirmado + `Toast tone="error"` na falha (T-4-32) — sem `ConfirmDialog`.
- Quatro arquivos de rota (`notas-fiscais/page.tsx`+`loading.tsx`, `produtos/page.tsx`+`loading.tsx`), Server Components finos que só chamam a leitura e delegam a `MolduraDeLeitura`, com `EsqueletoDeTela forma="tabela"` no `loading.tsx` de cada uma.

## Task Commits

Each task was committed atomically:

1. **Task 1: As ações do Financeiro como Server Actions** - `cd88d2c` (feat)
2. **Task 2: Notas fiscais — nove colunas, quatro filtros e os dois gatilhos** - `3508d7f` (feat)
3. **Task 3: Produtos — edição inline das duas alíquotas** - `38a2de7` (feat)

_No plan-metadata commit for STATE.md/ROADMAP.md — this executor runs in worktree mode; the orchestrator owns those files after merge._

## Files Created/Modified

- `apps/web/src/features/financeiro/dados/acoes.ts` - `salvarAliquotas`, `executarWorkflow`, `importarPlanoDeContas`, `removerLinhaDoPlanoDeContas`, `escreverNoFinanceiro`
- `apps/web/src/features/financeiro/dados/notas-fiscais.ts` - `lerNotasFiscais`, `NotaFiscal`
- `apps/web/src/features/financeiro/dados/produtos.ts` - `lerProdutos`, `Produto`
- `apps/web/src/features/financeiro/componentes/tabela-de-notas-fiscais.tsx` - `TabelaDeNotasFiscais`
- `apps/web/src/features/financeiro/componentes/tabela-de-produtos.tsx` - `TabelaDeProdutos`, `CampoDeAliquota`
- `apps/web/src/app/(shell)/financeiro/notas-fiscais/page.tsx` - a rota, Server Component
- `apps/web/src/app/(shell)/financeiro/notas-fiscais/loading.tsx` - `EsqueletoDeTela forma="tabela"`
- `apps/web/src/app/(shell)/financeiro/produtos/page.tsx` - a rota, Server Component
- `apps/web/src/app/(shell)/financeiro/produtos/loading.tsx` - `EsqueletoDeTela forma="tabela"`

## Decisions Made

- **Sem o `Select` de Plataforma em Notas fiscais.** Ver `key-decisions` no frontmatter — `NotaFiscalDto` (04-01, já mesclado) não projeta esse campo; implementá-lo exigiria tocar `financeiro-tria/automation`, fora do `files_modified` e do escopo isolado deste plano (`external_repo_note`). Ficaram busca + Status do pedido + Forma de pagamento, os três filtros que têm dado real por trás.
- **`meta` do `PageHeader` com contagens dinâmicas, não os números fixos do UI-SPEC.** `"${filtradas.length} de ${notas.length}"` (Notas fiscais) e `"${produtos.length} de ${produtos.length}"` (Produtos, sem filtro) em vez de `"N de 1.987"`/`"N de 42"` — esses números são o corte do inventário na data da pesquisa, não um teto de configuração real (diferente de `ContatosPage`, onde o segundo número é `state.workspace.limits.contacts`). Hardcodar ficaria stale na primeira venda nova ou produto cadastrado.
- **`TabelaDeNotasFiscais`/`TabelaDeProdutos` são a tela inteira, não só a tabela.** Cada uma monta `PageHeader`+`BarraDeFiltros`(quando há)+`CorpoDeTela`+diálogos num componente client único, porque os botões do `actions` (os dois gatilhos de lote; o resultado da alíquota) precisam de estado compartilhado com o corpo (diálogo aberto, `Toast`) que um `page.tsx` Server Component não pode segurar sozinho — `MolduraDeLeitura` só passa `(dados, lidoEm) => ReactNode`. Isso funciona sem quebrar a fronteira porque `PageHeader`/`CorpoDeTela` já são Client Components (`features/shell/ui.tsx` abre com `"use client"`), então um Server Component pode renderizá-los como filhos normalmente, e a composição client pode incluí-los também.
- **`onBlur` via `<span>` ancestral, não uma prop nova em `TextInput`.** O componente do barril não expõe `onBlur`; em vez de estender `design/components.tsx` (fora do `files_modified` deste plano), reusei o padrão já existente em `features/shell/ficha.tsx` (`EditorDeTexto`/`EditorDeNumero`): o evento de blur do `<input>` borbulha até um `<span onBlur={...}>` ancestral. Não reusei `EditorDeNumero` diretamente porque ele converte o valor para `Number` (perderia a vírgula decimal pt-BR, ex. "10,5") e não tem os estados "salvando"/"reverter ao valor confirmado" que T-4-32 exige.
- **`title` do `Icone` via `<span>` ancestral.** `Icone` (barril `shell/ui`) não repassa `title` — a assinatura de `LucideIcon` usada em `design/icone.tsx` não o expõe (`tsc` reprovou o uso direto). Embrulhei em `<span title={titulo}>`, mesma técnica do item acima.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `Icone` não aceita `title` — TypeScript reprovou o uso direto**
- **Found during:** Task 2, primeiro `npm run typecheck -w @n1/web` depois de escrever `EmissaoIcone`.
- **Issue:** `<Icone de={CheckCircle2} tamanho="xs" title={titulo} .../>` falhou com `TS2322: Property 'title' does not exist` — a assinatura de `Icone` (`{ de, tamanho, className } & Omit<React.ComponentProps<LucideIcon>, "size" | "strokeWidth">`) não inclui `title` na versão de `lucide-react` deste projeto.
- **Fix:** Embrulhado em `<span title={titulo}><Icone .../></span>` — o navegador mostra o tooltip a partir do `span`, sem tocar `design/icone.tsx` (fora do `files_modified`).
- **Files modified:** `apps/web/src/features/financeiro/componentes/tabela-de-notas-fiscais.tsx`
- **Verification:** `npm run typecheck -w @n1/web` → exit 0 (verde) depois do ajuste.
- **Committed in:** `3508d7f` (Task 2 commit — o arquivo nunca existiu numa versão sem o ajuste em nenhum commit)

**2. [Rule 1 - Bug] Comentário reformulado para não conter o literal que o próprio grep de aceitação busca**
- **Found during:** Task 3, ao explicar por que a tela não usa `ConfirmDialog`.
- **Issue:** O comentário de cabeçalho do arquivo citava literalmente `` `ConfirmDialog` `` para dizer que a tela NÃO o usa — o próprio `grep -c "ConfirmDialog"` do acceptance criteria (que deve devolver `0`) não distingue prosa de código, e contava 1.
- **Fix:** Reescrito para "Sem diálogo de confirmação" — mesma explicação, sem o identificador literal.
- **Files modified:** `apps/web/src/features/financeiro/componentes/tabela-de-produtos.tsx`
- **Verification:** `grep -c "ConfirmDialog" apps/web/src/features/financeiro/componentes/tabela-de-produtos.tsx` → `0`.
- **Committed in:** `38a2de7` (Task 3 commit)

### Scope Divergences (not bugs — documented per contract_correction_read_first)

**3. Sem o `Select` de Plataforma em Notas fiscais (UI-SPEC/PLAN.md pedem um quarto filtro que não tem dado por trás)**
- **Found during:** Task 2, ao ler `NotaFiscalDto` em `financeiro-tria/automation/src/http/leituras-plataforma-dtos.ts` para confirmar os nomes de campo antes de escrever o tipo `NotaFiscal`.
- **What the plan/UI-SPEC say:** UI-SPEC §"2 · Notas fiscais" e o `<action>` do Task 2 pedem `Select` Status do pedido, `Select` Plataforma, `Select` Forma de pagamento.
- **What the real code has:** `NotaFiscalDto` (04-01, já mesclado, `leituras-plataforma-dtos.ts`) projeta 13 campos — `id`, `idPedido`, `cliente`, `produtos`, `valorTotal`, `formaPagamento`, `statusPedido`, `controleEmissao`, `emissaoNotaProduto`, `emissaoNotaServico`, `notaCancelamento`, `seteDias`, `aprovadoEm`. `plataforma` NÃO está entre eles, embora exista na tabela de origem `transacoes` (confirmado em `docs/08-migracao-financeiro/01-inventario-financeiro-tria.md` §5.5: "`transacoes` (34 colunas: pedido, cliente, endereço, `plataforma`, ...)").
- **Why this doesn't get "fixed":** A própria UI-SPEC exige que as opções de `Select` sejam derivadas dos valores DISTINTOS presentes no array recebido, nunca um enum inventado. Sem o campo chegando ao componente, não há array de onde derivar — e adicionar `plataforma` ao DTO é uma mudança em `financeiro-tria/automation` (repositório irmão), fora do `files_modified` deste plano e explicitamente fora de escopo pelo `external_repo_note` do prompt de execução ("Plan 04-07 is running in parallel and owns the automation/ side ... stop and report a deviation").
- **Resolution:** Implementados os dois filtros que têm dado real (Status do pedido, Forma de pagamento) mais a busca por pedido/cliente. Nenhum enum inventado.
- **Files affected:** `apps/web/src/features/financeiro/componentes/tabela-de-notas-fiscais.tsx` (documentado também em comentário de cabeçalho no próprio arquivo).
- **Follow-up needed:** Se o filtro de Plataforma for de fato necessário, um plano futuro precisa (a) adicionar `plataforma` a `NotaFiscalDto` em `financeiro-tria/automation`, e (b) atualizar `apps/web/src/features/financeiro/dados/notas-fiscais.ts`/`tabela-de-notas-fiscais.tsx` para consumi-lo. Não é um TODO deste plano — é uma lacuna real entre o UI-SPEC e o contrato de dado já travado por 04-01.

---

**Total deviations:** 2 auto-fixed (Rule 1, ambos sem mudança de comportamento) + 1 divergência de escopo documentada (filtro sem dado por trás, não implementado).
**Impact on plan:** Nenhuma mudança de comportamento além do ajustado. A ausência do filtro de Plataforma é uma lacuna pré-existente entre UI-SPEC e o DTO de 04-01, não algo introduzido por este plano — e implementá-la exigiria tocar um repositório fora do escopo isolado desta execução.

## Issues Encountered

- **`typecheck`/`lint` extremamente lentos por contenção de CPU compartilhada, não por defeito no código.** A máquina rodava ~6 agentes de fase em paralelo (este plano mais 04-08/04-10, cada um disparando `tsc --noEmit`/`eslint` próprios), com load average medido em 130–191 num host de 8 núcleos. `npm run typecheck -w @n1/web` (rodado 3× ao longo da execução) levou de ~1 a ~4 minutos por chamada; `npm run lint -w @n1/web` levou ~21 minutos numa das chamadas. Nenhum comando foi interrompido ou usado com `--no-verify`/pipe-para-tail; todos os quatro comandos escopados (`typecheck`, `lint`, `verificar:tokens`, `test`) rodaram até o fim com `EXIT:0` capturado diretamente (sem pipe para `tail`).
- **`npm run build -w @n1/web` e `npm run check` (três workspaces) não foram executados**, seguindo o `hard_constraint` explícito do prompt de execução (que restringe aos quatro comandos escopados) e o precedente já registrado em `04-06-SUMMARY.md` — este worktree não tem `apps/web/.env.local` (gitignored, nunca trazido por `git worktree add`), então `build` falharia por falta de credencial, não por defeito de código. `typecheck`/`lint`/`verificar:tokens`/`test` (157/157) cobrem o mesmo código que `build` exercitaria.
- **Conferência manual do `apps/api` fora do ar (as duas telas mostram "Não consegui falar com o backend financeiro.") feita por rastreamento de código, não por servidor real no ar** — mesma limitação e mesmo raciocínio documentados em `04-06-SUMMARY.md`: sem `apps/api` rodando neste worktree, a trilha foi conferida lendo `MolduraDeLeitura`/`lerDoFinanceiro`, que já é o caminho comprovado em 04-06 e reusado sem alteração aqui.
- **Conferência manual do Task 1 ("`executarWorkflow` não chama `revalidatePath`") feita por leitura.** `grep -c "executarWorkflow" dados/acoes.ts` → `1`; lendo o corpo da função, ela só chama `escreverNoFinanceiro` e retorna o resultado — nenhuma chamada a `revalidatePath` nesse caminho.
- **Conferência manual do Task 3 ("com o `apps/api` devolvendo 500 na ação, o campo volta ao valor anterior e aparece o `Toast` de erro") feita por leitura, sem servidor real** — mesma limitação de ambiente acima. Rastreamento: `salvarAliquotas` → `escreverNoFinanceiro` → resposta não-ok (500) → `{ ok: false, erro: <corpo ou "O servidor respondeu 500."> }` → em `CampoDeAliquota.gravarSeMudou`, `!resultado.ok` dispara `setValor(confirmado)` (reversão) e `aoResultado({ ok: false, mensagem: resultado.erro })`, que em `TabelaDeProdutos` vira `Toast tone="error"`.
- **Conferência manual do Task 2 ("nenhuma ação por linha")** — as nove colunas de `RecordList` só renderizam texto/`Pilula`/ícones (nenhum `Button`/`ActionMenu` em coluna); os dois únicos `Button` do arquivo estão no `actions` do `PageHeader`, fora da tabela.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `dados/acoes.ts` já expõe `importarPlanoDeContas`/`removerLinhaDoPlanoDeContas`, prontas para 04-13 (Plano de contas) consumir sem duplicar o transporte HTTP para `apps/api`.
- `enviarExtrato` deliberadamente NÃO está em `acoes.ts` (comentário no arquivo explica por quê: upload precisa de progresso via `XMLHttpRequest.upload.onprogress`, que uma Server Action não expõe) — 04-13 deve criar um route handler dedicado para isso, não procurar essa função aqui.
- **Lacuna aberta para quem tocar Notas fiscais depois:** o filtro de Plataforma do UI-SPEC não tem campo correspondente em `NotaFiscalDto` (04-01). Se for pedido, o trabalho nasce em `financeiro-tria/automation/src/http/leituras-plataforma-dtos.ts`, não em `apps/web`.
- Nenhum bloqueio novo para 04-13: os padrões de leitura (`lerDoFinanceiro`), ação (`escreverNoFinanceiro`) e edição-no-blur (`<span onBlur>` em torno de `TextInput`) já estão provados nas duas telas deste plano.

---
*Phase: 04-as-outras-telas-do-financeiro-tria*
*Completed: 2026-09-23*

## Self-Check: PASSED

- Todos os 9 arquivos de código listados em Files Created/Modified existem no disco.
- Os 3 hashes de commit (`cd88d2c`, `3508d7f`, `38a2de7`) existem em `git log`.
