---
phase: 12-clone-clickup-grava-o-mais-r-pida
plan: 08
subsystem: web
tags: [store, otimista, salvando, arvore, tarefa, subtarefa, d-15, acessibilidade]

requires:
  - phase: 12-clone-clickup-grava-o-mais-r-pida
    provides: store com confirmado/data (D-13), fila serial, pendentes e a lista de operações que esperam o servidor (12-06, 12-07)
provides:
  - idsNaoConfirmados(data, confirmado) e useIdsNaoConfirmados() em apps/web/src/dados/store.ts (o contrato que o 12-09 consome na guarda de navegação)
  - TreeRow com a prop salvando; Espaço, Pasta e Lista novos aparecem na árvore sem link, com aria-busy, até o servidor confirmar
  - openTask (task-panel.tsx) que ignora id pendente; título da Tarefa, "Abrir detalhes" e "Abrir em página cheia" desligados enquanto salva; Subtarefa pendente sem Link
  - arvore-salvando.test.tsx e tarefa-salvando.test.tsx
affects: [12-09, 12-10]

actuals:
  tokens: 11569
  tasks: 2
  commits: 5
plan_head_before: f47e6b5d041758022f0356bd001563bb8d1bdd08
plan_head_after: 6c8f939b96210d20b0065ff08d60e37fb3136330

tech-stack:
  added: []
  patterns:
    - "Pendente é derivado (data menos confirmado), nunca guardado; o hook memoriza por revisão num WeakMap por data, para as linhas da árvore dividirem um só cálculo"
    - "Linha 'salvando': texto sem href, aria-busy, title e texto só para leitor de tela, tinta var(--texto-4)"

key-files:
  created:
    - apps/web/src/features/shell/arvore-salvando.test.tsx
    - apps/web/src/features/estrutura/tarefa-salvando.test.tsx
  modified:
    - apps/web/src/dados/store.ts
    - apps/web/src/features/shell/linha-da-arvore.tsx
    - apps/web/src/features/shell/app-shell.tsx
    - apps/web/src/features/estrutura/task-panel.tsx
    - apps/web/src/features/estrutura/tabela-de-tarefas.tsx
    - apps/web/src/features/estrutura/tarefa-completa.tsx

key-decisions:
  - "Todo id novo de qualquer coleção conta como pendente, não só o do registro criado: createList também grava uma Atividade, e ela entra no conjunto até o servidor confirmar. É o que 'derivado de toda coleção-array' diz e o que o 12-09 precisa."
  - "O 'salvando' fala ao leitor de tela por três vias (aria-busy, title e um span sr-only 'Salvando…'), não só pela cor, e usa a tinta var(--texto-4) que o sistema já tem."
  - "Ações de Status (concluir, mover) da linha pendente ficam ligadas: o servidor as recebe depois da criação, na fila serial de D-16. Só o que abre ou leva ao registro foi desligado."

patterns-established:
  - "Uma tela que leva a um registro lê useIdsNaoConfirmados() e tira o link ou desliga o gesto, em vez de mexer no store"

requirements-completed: []

coverage:
  - id: D1
    description: "idsNaoConfirmados é vazio sem varrer quando data é o confirmado e devolve os ids novos (inclusive o da Lista) quando há gravação a caminho"
    requirement: GRV-05
    verification:
      - kind: unit
        ref: "apps/web/src/features/shell/arvore-salvando.test.tsx#idsNaoConfirmados — pendente é derivado, sem estado novo (D-15)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A Lista, a Pasta e o Espaço novos aparecem na árvore sem link, com aria-busy e Salvando…, sem + nem ⋯ nem arrastar; ganham o link quando o servidor confirma; a recusa tira a linha"
    requirement: GRV-05
    verification:
      - kind: unit
        ref: "apps/web/src/features/shell/arvore-salvando.test.tsx#a árvore — a Lista nova aparece 'salvando', sem link, e ganha o link quando o servidor confirma (4 casos)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A Tarefa nova na Lista aparece com o título não clicável, o painel não abre por clique, Abrir em página cheia e Abrir detalhes ficam desligados com Salvando…; depois da confirmação abre como sempre"
    requirement: GRV-05
    verification:
      - kind: unit
        ref: "apps/web/src/features/estrutura/tarefa-salvando.test.tsx#a Tarefa nova na Lista — aparece salvando e só abre depois de confirmada (3 casos)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A Subtarefa criada na Tarefa aberta aparece sem link até o servidor confirmar e ganha o link depois"
    requirement: GRV-05
    verification:
      - kind: unit
        ref: "apps/web/src/features/estrutura/tarefa-salvando.test.tsx#a Subtarefa nova na Tarefa aberta — aparece sem link até confirmar"
        status: pass
    human_judgment: false
  - id: D5
    description: "O visual do 'salvando' (tinta apagada, linha sem hover) lê como em andamento e não como quebrado, na árvore e na tabela"
    requirement: GRV-05
    verification: []
    human_judgment: true
    rationale: "Os testes provam a estrutura (sem link, aria-busy, texto); se o aspecto de 'salvando' é claro e discreto é juízo visual do dono, no navegador."
  - id: D6
    description: "Suíte web inteira, tsc, lint e o passo de tokens verdes"
    requirement: GRV-05
    verification:
      - kind: unit
        ref: "cd apps/web && npx vitest run (95 arquivos, 897 testes); npx tsc --noEmit; npm run lint -w @n1/web; npm run verificar:tokens -w @n1/web"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-11-02
status: complete
---

# Phase 12 Plan 08: O item criado aparece, mas só abre depois de confirmado Summary

**`idsNaoConfirmados` deriva "pendente" de `data` menos `confirmado` (vazio sem varrer quando são o mesmo objeto) e `useIdsNaoConfirmados` o memoriza por revisão; com ele, a árvore desenha Espaço, Pasta e Lista novos como linha "salvando" (sem link, `aria-busy`, "Salvando…", sem "+", "⋯" nem arrastar), `openTask` ignora id pendente, a linha da Tarefa e a Subtarefa novas não abrem, e tudo vira o de sempre quando o servidor devolve o id verdadeiro.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-11-02
- **Tasks:** 2 de 2 (a Task 1 é o traçador; o plano é `autonomous: true`, sem checkpoint)
- **Files modified:** 8 (2 novos), 682 linhas acrescentadas e 57 removidas

## Accomplishments

- **O contrato do 12-09 (D-15).** `idsNaoConfirmados(data, confirmado): ReadonlySet<Id>` varre toda coleção-array de `data` e devolve os ids ausentes da mesma coleção de `confirmado`; com `data === confirmado` (o caso comum) devolve o conjunto vazio sem tocar em coleção nenhuma (o teste prova com um `Proxy` que lança se alguém enumerar as chaves). `useIdsNaoConfirmados()` assina `revision`, `data` e `confirmado` e guarda o último conjunto num `WeakMap` por `data`, invalidado pela revisão (`aplicarDiferenca` muta `confirmado` em lugar, então só as referências não bastariam). As linhas da árvore dividem um só cálculo.
- **A árvore.** `TreeRow` ganhou `salvando`: um `span` sem `href` com `aria-busy="true"`, `title="Salvando…"`, tinta `var(--texto-4)` e um `span` `sr-only` com o mesmo texto; não desenha "+" nem "⋯" e não aplica os eventos de arrastar. `TreeSpace`, `TreeFolder` e `TreeList` leem o hook; com o id no conjunto, passam `salvando`, tiram `href`, `creatable` e `menu` e tratam o nó como inerte em `useMenuDeOrdem`, `useMenuDeMover` e `useArrastoDaLinha`. Em `TreeList` o `href` passou a depender de não estar salvando (antes só o `inert` o tirava).
- **A Tarefa.** `useTaskPanel().openTask` retorna sem fazer nada para id pendente (é o ponto único das lentes Lista, Tabela, Quadro, Calendário e Financeiro). Na tabela padrão a linha pendente mostra o título como texto (`aria-busy`, `title`, `sr-only`), e "Abrir detalhes" (ação rápida e item de menu) e "Abrir em página cheia" ficam desligados com o motivo "Salvando…", pelo mesmo `disabledReason` do `ActionMenu`.
- **A Subtarefa.** Na lista de Subtarefas da Tarefa aberta, o filho pendente é um `span` `aria-busy` com o mesmo conteúdo; confirmado, volta a ser `Link`.
- **O diálogo de criação não mudou:** `create-container-dialog.tsx` continua esperando o id do servidor (`runConfirmado`) para navegar.

## Task Commits

1. **Task 1 (traçador), RED** — `44fb80f` (test): cinco casos falharam. `idsNaoConfirmados` e `useIdsNaoConfirmados` entraram como casca vazia só para a falha ser de asserção e não de importação.
2. **Task 1 (traçador), GREEN** — `d8eb5e6` (feat): as duas funções, `TreeRow.salvando` e os três nós da árvore.
3. **Task 2, RED** — `1f7169a` (test): `tarefa-salvando.test.tsx`.
4. **Task 2, correção de lint da Task 1** — `c0a6c92` (fix): a variável de módulo do cache virou um `WeakMap` (ver Deviations).
5. **Task 2, GREEN** — `6c8f939` (feat): `openTask`, a linha da Tarefa e a Subtarefa; o teste da Subtarefa passou a partir de uma Tarefa-mãe ativa.

**Plan metadata:** commit `docs(12-08)` que carrega este SUMMARY, STATE e ROADMAP.

Tracer feedback gate (Task 1): `gate` não era `blocking-human` e o `<verify>` era só automatizado; foi rodado de ponta a ponta (`tsc`, `src/features/shell` e `src/dados`: 21 arquivos, 229 testes) antes da Task 2, sem checkpoint. Log: tracer verificado, expansão liberada.

## TDD Gate Compliance

**Task 1:** `test(12-08)` (`44fb80f`) antes de `feat(12-08)` (`d8eb5e6`). RED legítimo: dos sete casos, cinco falharam. O de `idsNaoConfirmados` falhou na asserção (`expected [] to deeply equal [ 'lst_0000dw' ]`) e os quatro da árvore falharam porque a linha "salvando" não existia (a linha era o link de sempre). Os dois casos de `idsNaoConfirmados` que já passavam no RED (vazio por referência igual e por cópia igual) descrevem comportamento que a casca vazia também tem; ficam como guardas. Nenhum `refactor`.

**Task 2:** `test(12-08)` (`1f7169a`) antes de `feat(12-08)` (`6c8f939`). RED parcialmente inválido, corrigido: 3 dos 4 casos falharam e o de uma Tarefa já confirmada passou (guarda). Mas o caso da **Subtarefa** falhou por fixture, não pela asserção planejada: a primeira Tarefa-mãe achada era `arquivado`, e uma Tarefa não ativa não aceita Subtarefa, então nada foi criado. Descoberto no GREEN, o teste foi corrigido para uma Tarefa-mãe `lifecycle === "ativo"` (vai no commit GREEN) e provado com dentes por mutação temporária, restaurada com `diff` vazio contra a cópia guardada:

- `const pendente = false && naoConfirmados.has(child.id)` em `tarefa-completa.tsx`: falha "a Subtarefa pendente ainda não está na lista como 'salvando'" (1 falha, 3 passam);
- `if (false && naoConfirmados.has(taskId)) return;` em `task-panel.tsx`: falha o caso do título "salvando" (o painel abriria no clique) (1 falha, 3 passam).

## Verification

- `cd apps/web && npx tsc --noEmit`: exit 0.
- `cd apps/web && npx vitest run src/features/shell src/dados` (Task 1): 21 arquivos, 229 testes, todos passaram.
- `cd apps/web && npx vitest run src/features/estrutura/tarefa-salvando.test.tsx src/features/estrutura/pagina-da-lista-visualizacoes.test.tsx` (Task 2): 2 arquivos, 15 testes, todos passaram.
- `cd apps/web && npx vitest run` (suíte web inteira, no fim): 95 arquivos, 897 testes, todos passaram. Nenhum teste de tela de outra fase quebrou por causa do "salvando"; nenhum foi reescrito.
- `npm run lint -w @n1/web`: exit 0, 0 erros e 2 avisos de variável não usada (`KnowledgeDocument` e `Target`) que já existiam e estão fora de escopo.
- `npm run verificar:tokens -w @n1/web` (o passo de tokens do `check`, sem banco): "445 definidos · 391 arquivos varridos · 0 falhas".
- Critérios de aceitação: `export function idsNaoConfirmados` em `store.ts` (1); `useIdsNaoConfirmados` em `app-shell.tsx` (4), `task-panel.tsx` (2) e `tarefa-completa.tsx` (2); `Salvando…` em `linha-da-arvore.tsx` (3) e em `tabela-de-tarefas.tsx` (3 ocorrências, 1 linha de constante e as de uso); `tarefa-completa.tsx` com 2.310 linhas (limite 2.400); `arvore-salvando.test.tsx` afirma a ausência do link antes da confirmação e a presença depois.
- `git status --porcelain -- apps/api packages`: vazio. Nenhum commit do plano toca `apps/api` nem `packages/dominio`.
- `npm test` da raiz não foi rodado (inclui `apps/api`, que fala com o banco do `.env`); `npm run build` da web é do orquestrador. Nada foi publicado nem acessado em produção.

## Páginas do guia do Next lidas

`node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md` (props de `Link`, `onNavigate`, sem aviso de depreciação nas props que o código usa) e `01-app/03-api-reference/04-functions/use-router.md` (`router.push`/`replace`; a recomendação de preferir `Link` e o aviso sobre URLs não confiáveis; nada novo para este plano). Procurei por "deprecat" e "breaking" em `link.md`, `use-router.md` e `use-pathname.md`: nada aplicável. O plano não cria página nem rota.

## Decisions Made

Ver `key-decisions`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Cache do hook como variável de módulo reprovado pelo lint do React**
- **Found during:** Task 2 (rodando `npm run lint -w @n1/web`, o portão do plano)
- **Issue:** a primeira versão de `useIdsNaoConfirmados` (commit `d8eb5e6`) guardava o último cálculo numa `let` de módulo reatribuída durante o render; o lint de pureza do React a reprova ("Cannot reassign variables declared outside of the component/hook").
- **Fix:** o cache virou um `WeakMap<DataState, {confirmado, revision, conjunto}>` (sem reatribuição; mantém um só cálculo compartilhado entre as linhas da árvore, que um `useMemo` por linha repetiria). Mesma assinatura exportada.
- **Files modified:** `apps/web/src/dados/store.ts`
- **Verification:** lint com 0 erros; `src/dados` e `src/features/shell` verdes.
- **Commit:** `c0a6c92`

**2. [Rule 1 - Bug] Fixture do teste da Subtarefa usava uma Tarefa-mãe arquivada**
- **Found during:** Task 2, GREEN (o teste continuava vermelho com o código certo)
- **Issue:** ver "TDD Gate Compliance"; uma Tarefa arquivada não aceita Subtarefa e o RED daquele caso era inválido.
- **Fix:** escolher uma Tarefa-mãe com `lifecycle === "ativo"`; teste provado por mutação.
- **Files modified:** `apps/web/src/features/estrutura/tarefa-salvando.test.tsx`
- **Commit:** `6c8f939`

**Total deviations:** 2 auto-fixed (2 Rule 1). **Impact on plan:** nenhum no comportamento entregue.

## Issues Encountered

Nenhum além dos dois desvios. O `createList` grava também uma Atividade, então o conjunto de pendentes de uma criação de Lista tem mais de um id; o teste de `idsNaoConfirmados` afirma isso (a Lista presente, um id do seed ausente, tamanho entre 1 e 3) em vez de fingir que é um id só.

## Open items

- **GRV-05** não foi marcado como concluído: o ID é compartilhado com 12-09 (a guarda de navegação para as âncoras das outras telas, o aviso ao fechar a aba e o `apps/web/CONTEXT.md` da guarda) e só fecha com o último deles. `requirements.ready-ids` o bloqueia por isso.
- **Visual do "salvando"** (D5 do `coverage`): decisão visual do dono, no navegador; a estrutura está provada, o aspecto não.
- **Fora do que o plano cobre, por desenho:** as âncoras de outras telas (cartões, links de Tarefa em avisos, etc.) para um id pendente são T-12-24, do 12-09. As lentes Quadro, Calendário e Financeiro não ganham visual "salvando", só o `openTask` que ignora (Premissas sinalizadas do plano).
- A premissa A8 (custo do `structuredClone` no navegador) continua não medida, como no 12-06 e no 12-07.
- Nada foi publicado: o código novo da web só chega ao dono por um deploy mandado por ele.

## Known Stubs

None.

## Threat Flags

None. T-12-19 (navegação ou painel aberto para um id que o servidor não confirmou, pela árvore, pelas lentes da Lista ou pela lista de Subtarefas): mitigado. Árvore e linha da Tarefa sem link enquanto salvando, `openTask` ignora pendente, Subtarefa pendente sem `Link`; provado em `arvore-salvando.test.tsx` e `tarefa-salvando.test.tsx`. As âncoras das outras telas continuam em T-12-24 (12-09).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 12-09 pode usar `idsNaoConfirmados(get().data, get().confirmado)` como `idsPendentes` da guarda de navegação (assinatura mantida) e `useIdsNaoConfirmados()` nas telas.
- A suíte web (95 arquivos, 897 testes), `tsc`, lint e tokens estão verdes; o `next build` roda no fim de 12-09, depois da última mudança de tela de D-15.

## Self-Check: PASSED

Comandos rodados antes de escrever esta linha:

- `[ -f ]` em `apps/web/src/features/shell/arvore-salvando.test.tsx`, `apps/web/src/features/estrutura/tarefa-salvando.test.tsx`, `apps/web/src/dados/store.ts`, `apps/web/src/features/shell/linha-da-arvore.tsx`: FOUND.
- `git merge-base --is-ancestor` para `44fb80f`, `d8eb5e6`, `1f7169a`, `c0a6c92` e `6c8f939`: FOUND.
- `git rev-list --count f47e6b5..HEAD` = 5 (medido imediatamente antes de escrever o SUMMARY, a partir do ponto de partida registrado em disco).
