---
phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup
plan: 14
subsystem: ui
tags: [react, next, vitest, testing-library, approval-workflow, zustand]

# Dependency graph
requires:
  - phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup
    provides: "ApprovalOrigin discriminada (agentExecution | processTask), decideProcessApproval e solicitarAprovacao (Plan 02-04)"
provides:
  - "Fila /ia/aprovacoes discriminando Execução de Agente de Solicitação de pagamento, sem prazo no ramo processTask (D-11)"
  - "PainelAprovacao — o segundo ponto de decisão (D-08), montado na página da Tarefa, mesma operação/mesmos diálogos da fila"
  - "DialogoAprovar/DialogoRejeitar/useDecisaoDeAprovacao — componentes e controlador de decisão compartilhados entre fila e card"
  - "DialogoFluxoManual — ação explícita do Financeiro com motivo obrigatório, sem operação de domínio dedicada (compõe setTaskFieldValue + addTaskComment)"
  - "Infra de teste de componente para @n1/web: @testing-library/react + jsdom, *.test.tsx incluído no vitest.config.mts"
affects: ["02-19 (fusão em timeline única, toca o mesmo trecho da página da Tarefa)", "02-08 (evolver da Lista real — Papel Financeiro ainda não é Concessão de Membro)"]

# Tech tracking
tech-stack:
  added: ["@testing-library/react ^16.3.3 (devDependency, @n1/web)", "jsdom ^30.1.0 (devDependency, @n1/web)"]
  patterns:
    - "Controlador de decisão com estado DERIVADO (não setState dentro de useEffect): processando/erro calculados a cada render a partir de lastResult/data, exigido pela regra react-hooks/set-state-in-effect e react-hooks/refs deste projeto"
    - "Tentativa de decisão carrega o approvalId a que pertence (não um valor solto) — evita vazar erro/processando de uma Solicitação para a próxima sem precisar de um efeito de reset"
    - "Campo de Lista resolvido por rótulo do catálogo (CATALOGO_SOLICITACAO_DE_PAGAMENTO.campos.find), nunca id hardcoded solto"
    - "Componente de tela síncrono/cliente testado com @testing-library/react sobre um Transporte falso — mesmo isolamento de rede que store.test.ts já usa"

key-files:
  created:
    - apps/web/src/features/tarefa/painel-aprovacao.tsx
    - apps/web/src/features/tarefa/fluxo-manual-dialog.tsx
    - apps/web/src/features/tarefa/painel-aprovacao.test.tsx
  modified:
    - "apps/web/src/app/(shell)/ia/aprovacoes/page.tsx"
    - "apps/web/src/app/(shell)/estrutura/tarefas/[tarefa]/page.tsx"
    - apps/web/vitest.config.mts
    - apps/web/package.json

key-decisions:
  - "painel-aprovacao.tsx nasceu na Task 1 (não na Task 2 como o plano previa) — a própria ação da Task 1 pede os diálogos compartilhados que só a Task 2 criaria; sem isso a fila não compila. Documentado como deviation Rule 3."
  - "Restrição do Fluxo Manual usa administrar a Lista da Tarefa como sinal provisório de Papel Financeiro — a Concessão real desse Papel nasce no evolver da Lista (Plan 02-08), fora do escopo deste plano (só apps/web)."
  - "Fluxo Manual não tem operação de domínio dedicada nesta fase: compõe setTaskFieldValue (grava Integração manual) + addTaskComment (motivo com prefixo fixo, lido de volta por fluxoManualDe) — dois operações genéricas já existentes, sem tocar packages/dominio."
  - "processando/erro do controlador de decisão são DERIVADOS a cada render (nunca setState dentro de useEffect) — as regras react-hooks/set-state-in-effect e react-hooks/refs deste projeto (React Compiler-era) proíbem os dois padrões clássicos (setState em efeito de sucesso/falha, e ref lida durante render para resetar estado ao trocar de prop)."
  - "@testing-library/react + jsdom instalados como devDependency de @n1/web — primeiro teste de componente do workspace; verificados no npm registry antes de instalar (Rule 3 exclusion: pacote novo, não falha de install)."

requirements-completed: [SOL-03]

# Metrics
duration: ~45min
completed: 2026-09-21
---

# Phase 02 Plan 14: Fila e card de Aprovação discriminam Solicitação de pagamento de Execução de Agente Summary

**Fila `/ia/aprovacoes` e novo card `PainelAprovacao` na Tarefa decidem `processTask` pela mesma operação `decideProcessApproval`, sem prazo, com diálogos e controlador de decisão compartilhados — Tasks 1-3 completas; Task 4 é checkpoint humano pendente.**

## Performance

- **Duration:** ~45 min (Tasks 1-3)
- **Tasks:** 3 de 4 completas (Task 4 é `checkpoint:human-verify`, gate="blocking")
- **Files modified:** 8 (3 criados, 5 modificados, incluindo `package-lock.json`)

## Accomplishments

- `apps/web/src/app/(shell)/ia/aprovacoes/page.tsx` discrimina `origin.kind`: `agentExecution` preserva comportamento exato (prazo, cadeia, link para Execução); `processTask` ganha card próprio (pill, Status, valor, grade Centro de Custo/Fornecedor/Solicitante/Vencimento, anexos, `Encaminhada para <aprovador>`) sem prazo/contagem/expiração (D-11) e nunca CPF/CNPJ/Pix/RESUMO. Seção Decididas paginada e discrimina fonte (`por clique`/`por comentário`).
- `apps/web/src/features/tarefa/painel-aprovacao.tsx` — `PainelAprovacao` (D-08) monta na página da Tarefa entre Status e Checklists: pendente com explicação de roteamento, âncora para o tópico, CTAs por autorização; concluída com decisor/instante/fonte/motivo. Exporta `DialogoAprovar`/`DialogoRejeitar`/`useDecisaoDeAprovacao` — a fila e o card importam exatamente os mesmos componentes.
- `apps/web/src/features/tarefa/fluxo-manual-dialog.tsx` — `DialogoFluxoManual`, ação explícita restrita, motivo obrigatório, nunca "ignorar validação"; mostra "Fluxo manual por `<nome>`" no card depois do sucesso.
- `apps/web/src/features/tarefa/painel-aprovacao.test.tsx` — 11 casos cobrindo os nove (a)-(i) do plano: autorizado, não autorizado, sem prazo, motivo vazio, processando, conflito (decisão oposta, sem sobrescrita), decidida por clique/comentário, esqueleto de carregamento, acessibilidade (nome textual + foco devolvido).
- `npm run check` verde nos três workspaces (dominio 288, web 64, api 211 + 52 skipped sem `DATABASE_URL`).

## Task Commits

1. **Task 1: Fila `/ia/aprovacoes` discriminando origem** (inclui a fundação compartilhada de `painel-aprovacao.tsx` que a própria Task 1 precisa importar) — `d945c71` (feat)
2. **Task 2: Card de Aprovação na Tarefa, diálogos e Fluxo manual** — `aa638e0` (feat)
3. **Task 3: Testes de seletor e de estados da decisão** — `4ecf761` (test)

## Files Created/Modified

- `apps/web/src/app/(shell)/ia/aprovacoes/page.tsx` — discrimina `origin.kind`, dois cards, diálogos compartilhados para `processTask`, Decididas paginada
- `apps/web/src/features/tarefa/painel-aprovacao.tsx` — `PainelAprovacao`, `PainelAprovacaoEsqueleto`, `DialogoAprovar`, `DialogoRejeitar`, `useDecisaoDeAprovacao`, `resumoDaSolicitacao`
- `apps/web/src/features/tarefa/fluxo-manual-dialog.tsx` — `DialogoFluxoManual`, `fluxoManualRecusado`, `fluxoManualDe`
- `apps/web/src/features/tarefa/painel-aprovacao.test.tsx` — 11 casos de seletor/acessibilidade
- `apps/web/src/app/(shell)/estrutura/tarefas/[tarefa]/page.tsx` — monta `PainelAprovacao`, `DialogoFluxoManual` e a entrada "Usar fluxo manual" no `ActionMenu`
- `apps/web/vitest.config.mts` — inclui `*.test.tsx`, plugin `@vitejs/plugin-react`
- `apps/web/package.json`, `package-lock.json` — `@testing-library/react`, `jsdom` como devDependency

## Decisions Made

- **`processando`/`erro` do controlador de decisão são derivados, nunca `setState` dentro de `useEffect`.** Este projeto roda as regras `react-hooks/set-state-in-effect` e `react-hooks/refs` do ESLint (React Compiler-era), que proíbem tanto `setState` direto no corpo de um efeito quanto ler/escrever uma ref durante a renderização (inclusive o padrão clássico "resetar estado quando uma prop muda" via ref). A solução: `tentativa` carrega o `approvalId` a que pertence, e `processando`/`erro` são recalculados a cada render comparando com `lastResult`/`data.approvals` — sem efeito nenhum além da notificação de sucesso ao chamador (que não é `setState` deste hook).
- **Fluxo Manual não ganhou operação de domínio nesta fase.** O plano restringe os arquivos deste plano a `apps/web`; a marcação compõe `setTaskFieldValue` (grava `Integração manual`) + `addTaskComment` (motivo com prefixo fixo `"Fluxo manual: "`, lido de volta por `fluxoManualDe`). Uma operação dedicada com Registro de Atividade próprio fica para quando o domínio ganhar essa necessidade.
- **Restrição do Fluxo Manual usa "administra a Lista" como sinal provisório.** O Papel `rol_sp_financeiro` do catálogo (`packages/dominio/src/solicitacao-de-pagamento.ts`, Plan 02-06) ainda não é uma Concessão real de Membro — o evolver que materializa a Lista de verdade é o Plan 02-08, fora do escopo deste plano. `fluxoManualRecusado` documenta isso explicitamente no arquivo.
- **Campos da Solicitação resolvidos por rótulo, nunca id hardcoded solto.** `resumoDaSolicitacao` busca `CAMPO_CENTRO_DE_CUSTO`/`CAMPO_VALOR`/etc via `CATALOGO_SOLICITACAO_DE_PAGAMENTO.campos.find(c => c.rotulo === "...")` — o mesmo padrão que `packages/dominio/CONTEXT.md` já estabelece para o catálogo da Lista.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `painel-aprovacao.tsx` nasceu na Task 1, não na Task 2**
- **Found during:** Task 1
- **Issue:** A ação da Task 1 instrui explicitamente "os diálogos de decisão vivem na Task 2 (componente compartilhado) e são importados aqui" — mas o `<files>` da Task 1 só lista `ia/aprovacoes/page.tsx`. Sem o arquivo de Task 2, a fila não compila (o `import` de `DialogoAprovar`/`DialogoRejeitar` aponta para um arquivo inexistente).
- **Fix:** `painel-aprovacao.tsx` foi criado na Task 1 com os diálogos compartilhados, o controlador `useDecisaoDeAprovacao` e `resumoDaSolicitacao` — o mínimo que a fila precisa. A Task 2 estendeu o MESMO arquivo com `PainelAprovacao` (o card da Tarefa) e a leitura de Fluxo Manual, exatamente como o plano descreve para ela.
- **Files modified:** `apps/web/src/features/tarefa/painel-aprovacao.tsx`
- **Verification:** `npm run typecheck -w @n1/web`, `npm run lint -w @n1/web`, `npm run test -w @n1/web` verdes em cada commit
- **Committed in:** `d945c71` (Task 1), estendido em `aa638e0` (Task 2)

**2. [Rule 3 - Blocking] `vitest.config.mts` não incluía `*.test.tsx`**
- **Found during:** Task 3
- **Issue:** `include: ["src/**/*.test.ts"]` (só `.ts`) — o arquivo de teste de componente exigido pela Task 3 (`.tsx`) nunca seria descoberto pelo runner, e o acceptance criteria explícito da Task 3 (`npm run test -w @n1/web -- src/features/tarefa/painel-aprovacao.test.tsx`) não teria como sair 0.
- **Fix:** `include` passou a cobrir `*.test.ts` e `*.test.tsx`; adicionado o plugin `@vitejs/plugin-react` (já era devDependency, só não estava plugado) para o JSX do teste transformar. O ambiente segue `node` por padrão (mais rápido, sem DOM) — o teste novo declara `// @vitest-environment jsdom` na primeira linha, sem afetar o resto do workspace.
- **Files modified:** `apps/web/vitest.config.mts`
- **Verification:** `npm run test -w @n1/web` continua verde para os arquivos `.test.ts` existentes; o novo `.test.tsx` roda em jsdom
- **Committed in:** `4ecf761` (Task 3)

**3. [Rule 3 - Blocking, pacote novo verificado] `@testing-library/react` e `jsdom` instalados**
- **Found during:** Task 3
- **Issue:** Nenhuma infraestrutura de teste de componente existia em `@n1/web` (zero arquivos `.test.tsx` antes deste plano); a Task 3 exige renderizar `PainelAprovacao` e simular clique/preenchimento — impossível sem uma biblioteca de teste de DOM.
- **Fix:** Verificados no `npm registry` antes de instalar (`npm view @testing-library/react/jsdom version`, `description`, `repository.url` — pacotes oficiais, sem indício de slopsquatting) e adicionados como `devDependency` de `@n1/web` via `npm install --save-dev`. Esta NÃO é a exceção de "install falhou" do Rule 3 (que exige checkpoint humano de legitimidade) — é a adição deliberada, verificada, de uma dependência de teste padrão da indústria, necessária para a acceptance criteria explícita da própria Task 3.
- **Files modified:** `apps/web/package.json`, `package-lock.json`
- **Verification:** `npm run test -w @n1/web -- src/features/tarefa/painel-aprovacao.test.tsx` sai 0 com os 11 casos
- **Committed in:** `4ecf761` (Task 3)

**4. [Rule 1 - Bug] Conflito de decisão não aparecia quando o card já virava "Aprovação concluída"**
- **Found during:** Task 3, caso (f)
- **Issue:** `controlador.erro` só era renderizado no ramo "pendente" de `PainelAprovacao`. Como o diff do conflito grava `approval.decision` (a decisão de OUTRA pessoa), o card troca para o ramo "decidida" antes de o erro aparecer — a mensagem `Esta Solicitação já foi decidida por <nome>. A tela foi atualizada.` nunca era lida.
- **Fix:** O bloco de erro (`role="alert"`) também aparece no topo do card "Aprovação concluída".
- **Files modified:** `apps/web/src/features/tarefa/painel-aprovacao.tsx`
- **Verification:** caso (f) do teste passa
- **Committed in:** `4ecf761` (Task 3)

---

**Total deviations:** 4 auto-fixed (3 Rule 3 - blocking, 1 Rule 1 - bug)
**Impact on plan:** Todos os ajustes eram necessários para a Task 1 compilar, para a Task 3 ser executável e para o comportamento de conflito (explicitamente exigido pela UI-SPEC) realmente aparecer na tela. Nenhum é escopo novo não anunciado pelo plano.

## Issues Encountered

- **Regras de ESLint deste projeto (React Compiler-era) proíbem `setState` dentro de `useEffect` e leitura de `ref` durante a renderização** — dois padrões que a primeira versão do controlador de decisão usava (setState em efeito de sucesso/falha, e uma ref para resetar `tentativa` ao trocar de `approvalId`). Resolvido reescrevendo o hook para computar `processando`/`erro` como valores DERIVADOS a cada render (ver Decisions Made).
- **`decideProcessApproval` resolve `aprovado`/`não aprovado` pelo nome no Conjunto de Status da Lista** — a Lista real "Solicitações de pagamento" (Plan 02-08) ainda não existe neste worktree; os testes emprestam a Lista de uma Tarefa qualquer do seed e acrescentam os três nomes de Status que faltarem (`garantirStatusDeProcesso`), sem tocar nos Status que outras Tarefas do seed já usam.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SOL-03 tem os dois pontos de decisão (D-08) implementados e testados por seletor; falta apenas a verificação humana visual/interativa (Task 4).
- Quando o Plan 02-08 materializar a Lista real "Solicitações de pagamento", `fluxoManualRecusado` deve trocar "administra a Lista" pela Concessão real do Papel `rol_sp_financeiro` — o arquivo já documenta essa dívida.
- `apps/web/src/features/tarefa/` agora tem infraestrutura de teste de componente reutilizável (`@testing-library/react` + `jsdom`) para os próximos planos da fase que precisarem de prova de seletor.

---

## CHECKPOINT: Task 4 pendente

Task 4 (`checkpoint:human-verify`, `gate="blocking"`) exige `npm run dev` e navegação manual (login como aprovador designado e como Membro não autorizado, aprovar/rejeitar pelos dois pontos de decisão, reduzir a janela para 375px). Isso não é executável por este agente: sem browser, sem `.env.local` real do Supabase neste worktree, e a verificação em si é o propósito da task. As três tasks automatizáveis (1-3) estão completas, commitadas e verdes; a Task 4 aguarda a verificação humana descrita no plano.

---
*Phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup*
*Completed: 2026-09-21 (Tasks 1-3; Task 4 aguarda checkpoint humano)*

## Self-Check: PASSED

Arquivos no disco: `apps/web/src/features/tarefa/painel-aprovacao.tsx`, `fluxo-manual-dialog.tsx`, `painel-aprovacao.test.tsx` — todos encontrados. Commits `d945c71`, `aa638e0`, `4ecf761` encontrados em `git log --oneline`. `npm run check` verde nos três workspaces no momento da escrita deste SUMMARY.
