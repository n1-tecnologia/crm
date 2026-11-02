---
phase: 12-clone-clickup-grava-o-mais-r-pida
plan: 09
subsystem: web
tags: [navegacao, guarda, d-15, beforeunload, store, acessibilidade, link]

requires:
  - phase: 12-clone-clickup-grava-o-mais-r-pida
    provides: idsNaoConfirmados/useIdsNaoConfirmados, o "salvando" na árvore e na Tarefa, pendentes na fila serial, a lista de operações que esperam o servidor (12-06 a 12-08)
provides:
  - guarda de navegação (apps/web/src/dados/guarda-de-navegacao.ts) instalada por StoreProvider; nenhuma âncora, em tela nenhuma, leva a um id que o servidor ainda não confirmou
  - deveAvisarAoSair e o ouvinte de beforeunload em AcompanhanteDaRevisao (fechar a aba com gravação pendente pede confirmação)
  - Editar conta (página completa) e a Reunião do Quadro do Funil sem router.push para id pendente
  - apps/web/CONTEXT.md com o pendente, o salvando, a guarda, o aviso ao fechar a aba e a lista de exceções
affects: [12-10]

actuals:
  tokens: 7779
  tasks: 2
  commits: 6
plan_head_before: faae96fd864dfda2ae913b53dca2e76bfae004a7
plan_head_after: 37c1cab2e6f35b337c5d26318aae5432db5d620c

tech-stack:
  added: []
  patterns:
    - "Guarda no document em fase de captura: o Link navega dentro do onClick do React (contêiner raiz, abaixo do document), então parar a propagação na captura impede o Link de rodar"
    - "A guarda recebe uma FonteDosPendentes (idsPendentes + assinar) e não importa o store: sem ciclo de import"
    - "Pendente derivado, sem estado novo: a cada clique a guarda pergunta idsPendentes()"

key-files:
  created:
    - apps/web/src/dados/guarda-de-navegacao.ts
    - apps/web/src/dados/guarda-de-navegacao.test.tsx
    - apps/web/src/features/estrutura/financeiro/conta-salvando.test.tsx
  modified:
    - apps/web/src/dados/store.ts
    - apps/web/src/dados/store.test.ts
    - apps/web/src/features/estrutura/financeiro/contas-view.tsx
    - apps/web/src/app/(shell)/estrutura/listas/[lista]/page.tsx
    - apps/web/CONTEXT.md

key-decisions:
  - "A guarda cancela também o cmd/ctrl+clique e o clique de teclado (Enter numa âncora gera click com detail 0): o primeiro abriria uma aba nova numa página que não existe, o segundo é o mesmo caminho do clique. O Link já ignora clique com modificador (deixa o navegador agir), então só a guarda o impede."
  - "O clique com o botão direito não é interceptado: gera contextmenu, e o menu 'Abrir link em nova aba' é do navegador. O auxclick que o Chrome dispara também no botão direito é cancelado (marca aria-busy, sem efeito visível), mas o menu continua aberto. É uma borda aceita e registrada."
  - "A guarda segura uma assinatura só, criada ao marcar a primeira âncora e desfeita quando não sobra nenhuma marcada; uma âncora que sai do DOM também é solta."
  - "Uma Conta pendente na lente financeira desliga 'Editar conta (página completa)' com 'Salvando…' em vez de depender da guarda, porque o router.push direto não passa por ela. A Reunião do Quadro do Funil ignora o id pendente, como o openTask."

patterns-established:
  - "Um gesto que navega por router.push para um id local lê useIdsNaoConfirmados() e se desliga com o motivo 'Salvando…', ou usa o id de runConfirmado"

requirements-completed: [GRV-05]

coverage:
  - id: D1
    description: "idNaoConfirmadoNoEndereco acha o id no segmento ou no valor de parâmetro por igualdade inteira (lst_1 não casa com lst_10) e nunca toca endereço de outra origem"
    requirement: GRV-05
    verification:
      - kind: unit
        ref: "apps/web/src/dados/guarda-de-navegacao.test.tsx#idNaoConfirmadoNoEndereco — igualdade inteira, só desta origem (D-15) (5 casos)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Com o StoreProvider de verdade, o clique, o auxclick, o cmd/ctrl+clique e o clique de teclado numa âncora para a Lista recém-criada são cancelados, não propagam e a âncora fica aria-busy até o servidor confirmar; depois, o clique passa"
    requirement: GRV-05
    verification:
      - kind: integration
        ref: "apps/web/src/dados/guarda-de-navegacao.test.tsx#a guarda de navegação com o StoreProvider de verdade (D-15, GRV-05)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Com o Link do Next, o onClick e o onNavigate do Link não rodam enquanto o id está pendente e rodam depois da confirmação"
    requirement: GRV-05
    verification:
      - kind: integration
        ref: "apps/web/src/dados/guarda-de-navegacao.test.tsx#com o Link de verdade: o onClick e o onNavigate do Link não rodam enquanto pendente, e rodam depois da confirmação"
        status: pass
    human_judgment: false
  - id: D4
    description: "A guarda nunca toca endereço sem id pendente, âncora de outro registro, âncora de outra origem, nem depois de desmontar o StoreProvider"
    requirement: GRV-05
    verification:
      - kind: integration
        ref: "apps/web/src/dados/guarda-de-navegacao.test.tsx#(4 casos de não interferência)"
        status: pass
    human_judgment: false
  - id: D5
    description: "deveAvisarAoSair(0) é falso e com 1 ou mais é verdadeiro; o beforeunload de window pede confirmação com gravação a caminho, deixa de pedir ao confirmar e sai ao desmontar o StoreProvider"
    requirement: GRV-05
    verification:
      - kind: unit
        ref: "apps/web/src/dados/store.test.ts#deveAvisarAoSair; apps/web/src/dados/guarda-de-navegacao.test.tsx#o aviso ao fechar a aba com gravação pendente"
        status: pass
    human_judgment: false
  - id: D6
    description: "Editar conta (página completa) de uma Conta pendente na lente financeira fica desligado com 'Salvando…'; a Conta de antes navega como sempre"
    requirement: GRV-05
    verification:
      - kind: integration
        ref: "apps/web/src/features/estrutura/financeiro/conta-salvando.test.tsx"
        status: pass
    human_judgment: false
  - id: D7
    description: "Suíte web inteira, tsc, lint, tokens e next build verdes"
    requirement: GRV-05
    verification:
      - kind: other
        ref: "cd apps/web && npx vitest run (97 arquivos, 918 testes); npx tsc --noEmit; npm run lint -w @n1/web; npm run verificar:tokens -w @n1/web; npm run build"
        status: pass
    human_judgment: false
  - id: D8
    description: "O aviso nativo do navegador ao fechar a aba (texto e momento) e o cancelamento do clique no navegador de verdade"
    requirement: GRV-05
    verification: []
    human_judgment: true
    rationale: "Os testes provam o evento (beforeunload cancelado) e a propagação no jsdom; o diálogo que o navegador mostra e o comportamento real do clique/Enter/cmd+clique em Chrome e Safari só se veem num navegador de verdade."

duration: 25min
completed: 2026-11-02
status: complete
---

# Phase 12 Plan 09: Nenhuma âncora leva a um id que o servidor não confirmou, e a aba avisa ao fechar Summary

**Uma guarda no `document`, em fase de captura, cancela o clique, o clique do meio, o cmd/ctrl+clique e o Enter numa âncora cujo endereço carrega um id ainda não confirmado (igualdade inteira de segmento ou de parâmetro, só da mesma origem), marca `aria-busy` e a solta quando o servidor confirma; `beforeunload` pede confirmação ao fechar a aba com gravação pendente; e dois `router.push` diretos que a guarda não alcança (a Conta financeira e a Reunião do Quadro do Funil) passaram a esperar o id.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-11-02
- **Tasks:** 2 de 2 (a Task 1 é o traçador; o plano é `autonomous: true`, sem checkpoint)
- **Files modified:** 8 (3 novos), 760 linhas acrescentadas e 3 removidas

## Accomplishments

- **A guarda (D-15).** `guarda-de-navegacao.ts` (126 linhas): `idNaoConfirmadoNoEndereco` resolve o endereço contra a origem da página e compara cada segmento do caminho e cada valor de parâmetro com o conjunto de ids pendentes; `instalarGuardaDeNavegacao(fonte, documento)` põe ouvintes de `click` e `auxclick` na captura do `document`, acha a âncora com `closest("a[href]")`, pergunta `fonte.idsPendentes()` e, com id pendente, faz `preventDefault()` + `stopPropagation()` e põe `aria-busy="true"`. Uma assinatura só (criada na primeira âncora marcada, desfeita quando não sobra nenhuma) tira o `aria-busy` quando o id deixa de estar pendente ou a âncora sai do DOM. Devolve a função que remove tudo. O módulo não importa `store.ts`; `AcompanhanteDaRevisao` a instala com `idsPendentes = idsNaoConfirmados(data, confirmado)` e `assinar = store.subscribe`, e a remove no cleanup.
- **O aviso ao fechar a aba.** `deveAvisarAoSair(pendentes)` (pura) e o ouvinte de `beforeunload` em `window`, no mesmo `useEffect`: com `pendentes > 0`, `preventDefault()` e `returnValue = ""`. Sai no cleanup.
- **Dois furos achados e fechados** (ver Deviations): "Editar conta (página completa)" da lente financeira e a Reunião do Quadro do Funil faziam `router.push` direto para o id local.
- **`apps/web/CONTEXT.md`:** parágrafos novos sobre o pendente derivado, o "salvando", a guarda e o aviso ao fechar a aba; a lista de operações que esperam o servidor (`dados/operacoes-que-esperam.ts`, 12-07) já estava no parágrafo anterior e é citada de novo.

## Task Commits

1. **Task 1 (traçador), RED** — `728db86` (test): 8 de 14 casos falharam por asserção; `guarda-de-navegacao.ts` entrou como casca vazia para a falha não ser de importação.
2. **Task 1 (traçador), GREEN** — `a8edf06` (feat): a guarda e a instalação em `AcompanhanteDaRevisao`.
3. **Task 2, RED** — `074aa01` (test): `deveAvisarAoSair` e o `beforeunload` com o `StoreProvider` de verdade (3 casos falharam por asserção).
4. **Task 2, RED do furo achado** — `02a6e6b` (test): `conta-salvando.test.tsx`.
5. **Task 2, correção do furo** — `35dd868` (fix): `contas-view.tsx` e `page.tsx`.
6. **Task 2, GREEN** — `37c1cab` (feat): `deveAvisarAoSair` real, o ouvinte de `beforeunload` e o `CONTEXT.md`.

**Plan metadata:** commit `docs(12-09)` que carrega este SUMMARY, STATE, ROADMAP e REQUIREMENTS.

Tracer feedback gate (Task 1): `gate` não era `blocking-human` e o `<verify>` era só automatizado; foi rodado de ponta a ponta (`tsc` e `src/dados`: 12 arquivos, 152 testes) antes da Task 2, sem checkpoint. Log: tracer verificado, expansão liberada.

## TDD Gate Compliance

**Task 1:** `test(12-09)` (`728db86`) antes de `feat(12-09)` (`a8edf06`). RED legítimo: 8 dos 14 casos falharam por asserção (`expected undefined to be 'lst_000900'`, `expected [ MouseEvent ] to have a length of +0 but got 1`, `expected "vi.fn()" to not be called at all`), nenhum por importação ou fixture. Os 6 que já passavam descrevem comportamento que a casca vazia também tem (prefixo não casa, outra origem, sem id pendente, âncora de outro registro, depois de desmontar) e ficam como guardas. Dois ajustes de teste foram feitos ainda no RED, antes de commitar: o clique no botão do teste também passava pela borbulha do `document` e sujava o registro (agora `criar()` zera `recebidos`), e `fireEvent` devolve `false` mesmo sem a guarda porque o ouvinte de borbulha do teste cancela — por isso a prova de "passou" é o ouvinte ter recebido o clique e `chegouCancelado` ser `false`, não o retorno de `fireEvent`. Depois do GREEN, o teste do `Link` mudou de roteador (ver abaixo) e foi provado com dentes por mutação temporária: trocar a captura (`true`) por borbulha (`false`) no `click` quebrou 4 casos, entre eles o do `Link`; restaurado e `git diff` do arquivo igual à cópia guardada.

**Task 2:** `test(12-09)` (`074aa01`) e `test(12-09)` (`02a6e6b`) antes de `fix(12-09)` (`35dd868`) e `feat(12-09)` (`37c1cab`). RED legítimo: `deveAvisarAoSair(1)` devolvendo `false` da casca e o `beforeunload` sem ouvinte (3 falhas por asserção); `conta-salvando.test.tsx` falhou em `expected null to be 'true'` (o item não estava desligado). O caso "Conta de antes" passou no RED (guarda). Nenhum `refactor`.

## Verification

- `cd apps/web && npx tsc --noEmit`: exit 0.
- `cd apps/web && npx vitest run src/dados`: 12 arquivos, 157 testes, todos passaram.
- `cd apps/web && npx vitest run` (suíte web inteira, no fim): **97 arquivos, 918 testes**, todos passaram. Nenhum teste de tela de outra fase quebrou por causa da guarda; **nenhum foi reescrito**.
- `npm run lint -w @n1/web`: exit 0, 0 erros e 2 avisos de variável não usada (`KnowledgeDocument` e `Target`) que já existiam e estão fora de escopo.
- `npm run verificar:tokens -w @n1/web`: "445 definidos · 392 arquivos varridos · 0 falhas".
- `npm run build` (Next, a partir da raiz): compilou e gerou todas as rotas; `apps/web/.next/BUILD_ID` novo.
- Critérios de aceitação: `export function idNaoConfirmadoNoEndereco` (1) e `export function instalarGuardaDeNavegacao` (1) em `guarda-de-navegacao.ts`; `instalarGuardaDeNavegacao(` em `store.ts` (1); imports de `./store` ou `@/dados/store` em `guarda-de-navegacao.ts`, linhas de comentário filtradas: 0; `StoreProvider` e `auxclick` no teste da guarda; `export function deveAvisarAoSair` (1) e `beforeunload` (3) em `store.ts`; `guarda` em `CONTEXT.md` (4) e `operacoes-que-esperam` (2).
- `git status --porcelain -- apps/api packages`: vazio. Nenhum commit do plano toca `apps/api` nem `packages/dominio`.
- `npm test` da raiz não foi rodado (inclui `apps/api`, que fala com o banco do `.env`). Nada foi publicado nem acessado em produção.

## Páginas do guia do Next lidas e o que o clique do `Link` faz

Li `node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md` (props, `onNavigate`, a nota de que `onClick` roda em todo clique e `onNavigate` só na navegação do lado do cliente, e a seção de bloquear navegação por `onNavigate`), `01-app/03-api-reference/04-functions/use-router.md` (nada novo) e `01-app/01-getting-started/04-linking-and-navigating.md` (menciona `useLinkStatus`, que não se aplica: ele mostra pendência de uma navegação em curso, não impede uma). Procurei por "deprecat" e "breaking" em `link.md`, `use-router.md` e `04-linking-and-navigating.md`: nada aplicável. Li o código do `Link` do App Router, `node_modules/next/dist/client/app-dir/link.js`:

- O `onClick` do `Link` chama o `onClick` do usuário e, em seguida, `if (e.defaultPrevented) return;` e `linkClicked(...)`. O `linkClicked` ignora clique com `metaKey`/`ctrlKey`/`shiftKey`/`altKey` ou `target` diferente de `_self` (deixa o navegador agir), e, para endereço local, chama `e.preventDefault()`, o `onNavigate` e `dispatchNavigateAction` — ou seja, **a navegação acontece dentro do manipulador de clique do React**, não por um ouvinte nativo.
- O React escuta no contêiner raiz, abaixo do `document`. Um ouvinte de captura no `document` que cancele e pare a propagação, portanto, faz o `onClick` do `Link` nunca rodar. A prova é o teste com o `Link`: `onClick` e `onNavigate` ficam sem chamada enquanto pendente e rodam uma vez cada depois da confirmação; e a mutação (captura → borbulha) o quebra.
- **Limite do teste:** no vitest, `next/link` resolve para `dist/client/link.js` (o do Pages Router; o Next troca para `app-dir/link.js` só no build), e `app-dir/link.js` não carrega sob o vitest (`react-server-dom-webpack`). Os dois têm o mesmo desenho de clique (`defaultPrevented` e navegação dentro do `onClick`), e o teste dá ao `Link` do Pages um `RouterContext` falso cujo `onNavigate` cancela. A prova com o `Link` exato do build é a leitura do código acima, não um teste.

## `router.push(` com `estrutura/` — o que sobrou e por que é seguro

Saída de `grep -rn "router.push(" apps/web/src | grep "estrutura/"`:

```
apps/web/src/app/(shell)/estrutura/listas/[lista]/page.tsx:290:    ... router.push(`/crm/reunioes/${t.id}`);
apps/web/src/features/estrutura/tabela-de-tarefas.tsx:457:    onSelect: () => router.push(`/estrutura/tarefas/${task.id}`),
apps/web/src/features/estrutura/financeiro/contas-view.tsx:405:    onSelect: () => router.push("/ia/personalizar/automacao"),
apps/web/src/features/estrutura/financeiro/contas-view.tsx:954:    router.push(`/estrutura/tarefas/${task.id}`),
```

- `page.tsx:290` (casou só pelo caminho do arquivo; o destino é `/crm/reunioes/<id>` de uma Tarefa do tipo Reunião): **não era seguro** — navegava para o id local de uma Tarefa possivelmente pendente. Corrigido: `abrirNoQuadro` retorna sem fazer nada para id pendente (`35dd868`).
- `tabela-de-tarefas.tsx:457` ("Abrir em página cheia"): seguro, 12-08 o desliga com "Salvando…" quando o id é pendente (`tarefa-salvando.test.tsx`).
- `contas-view.tsx:405`: rota fixa, sem id.
- `contas-view.tsx:954` ("Editar conta (página completa)"): **não era seguro**, mesmo caso. Corrigido: o item fica desligado com "Salvando…" para id pendente (`35dd868`, `conta-salvando.test.tsx`).

Um grep mais largo (todo `router.push(` com `${`) mostrou também: as rotas do CRM (`/crm/contatos|empresas|funis/<id>`) navegam pelo id que a API REST devolveu (confirmado); `ia/chat/page.tsx:120` usa `confirmado.then(...)`; `conectar-provedor.tsx:91` navega depois de `criarCanal` (REST) e `rehidratar`. **Um ficou sem tratamento:** `features/crm/iniciar-conversa-dialog.tsx:113` faz `router.push(`/crm/caixa-de-entrada/${result.value.conversation.id}`)` com o id do resultado local do `run` (ver Open items).

## Decisions Made

Ver `key-decisions` (ctrl/cmd+clique, botão direito, teclado, a assinatura única e os dois `router.push`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] `router.push` direto para o id local em dois lugares fora da guarda**
- **Found during:** Task 2 (o `grep` de `router.push(` que o plano manda registrar)
- **Issue:** "Editar conta (página completa)" da lente financeira (`contas-view.tsx`) e `abrirNoQuadro` da Reunião no Quadro do Funil (`page.tsx`) empurravam a rota de uma Tarefa possivelmente pendente. O plano parte da premissa de que o `router.push` que sobra vem de registro já confirmado, o que não vale para esses dois. A guarda de âncoras não os alcança (não são âncoras), e D-15 diz "nunca leva a uma página de id que não existe".
- **Fix:** `contas-view.tsx`: `useIdsNaoConfirmados()` e `disabledReason: "Salvando…"` no item para id pendente. `page.tsx`: `abrirNoQuadro` retorna antes do `router.push` para id pendente.
- **Files modified:** `apps/web/src/features/estrutura/financeiro/contas-view.tsx`, `apps/web/src/app/(shell)/estrutura/listas/[lista]/page.tsx`; teste novo `conta-salvando.test.tsx`.
- **Verification:** `conta-salvando.test.tsx` falhou antes (RED, `02a6e6b`) e passa depois. **A correção da Reunião no Quadro do Funil não tem teste próprio** (o Quadro do Funil precisa de fixtures pesadas); ela é a mesma linha do `openTask`, coberta só por leitura de código e pelo `tsc`/lint.
- **Committed in:** `35dd868`

**2. [Rule 3 - Blocking] O `Link` que o vitest resolve não é o do build**
- **Found during:** Task 1 (o teste com o `Link` de verdade)
- **Issue:** `next/link` no vitest é o `dist/client/link.js` (Pages Router, usa `RouterContext`); o `app-dir/link.js` não carrega (falta `react-server-dom-webpack`). Com `AppRouterContext` o `onNavigate` nunca rodava.
- **Fix:** o teste fornece um `RouterContext` falso ao `Link` do Pages e registra a diferença no cabeçalho do componente `RoteadorFalso`; o desenho do clique do `app-dir/link.js` foi conferido por leitura (seção acima).
- **Files modified:** `apps/web/src/dados/guarda-de-navegacao.test.tsx`
- **Committed in:** `a8edf06`

---

**Total deviations:** 2 auto-fixed (1 Rule 2, 1 Rule 3). **Impact on plan:** o item 1 acrescenta 2 arquivos de produção e 1 de teste fora de `files_modified`, sem mudar nada que o plano entrega; o item 2 só afeta a fidelidade de um teste.

## Issues Encountered

Nenhum além dos desvios.

## Open items

- **`iniciar-conversa-dialog.tsx:113` (fora do escopo do grep do plano):** `router.push` para `/crm/caixa-de-entrada/<conversation.id>` com o id do resultado local de um `run`. Se o servidor der outro id (a ponte do Agente consumiu ids), leva a uma conversa que não existe. Trocar por `runConfirmado` muda o ritmo do diálogo (esperar o servidor antes de navegar) e é decisão de produto; não foi tocado. Cabe ao 12-10 ou a um ajuste à parte.
- **Visual e navegador de verdade (D8 do `coverage`):** o diálogo nativo de `beforeunload` e o comportamento do clique/Enter/cmd+clique em Chrome e Safari não foram vistos num navegador; os testes cobrem o evento e a propagação no jsdom.
- **Botão direito e menu do navegador:** "Abrir link em nova aba" do menu de contexto não é interceptável pela guarda (registrado em `key-decisions`).
- **A premissa A8** (custo do `structuredClone` no navegador) continua não medida; é do 12-10 (publicar e medir o "depois" na VPS, ação do dono).
- Nada foi publicado: o código novo da web só chega ao dono por um deploy mandado por ele.

## Known Stubs

None.

## Threat Flags

None. T-12-24 (âncora de tela sem visual de "salvando" levando a um id não confirmado): mitigado pela guarda, provado com o `StoreProvider` e o `Link`. T-12-20 (fechar a aba com mudança não gravada): mitigado por `beforeunload`, provado em `store.test.ts` e no ouvinte. T-12-21 (guarda bloqueando navegação legítima): mitigado; só age com id pendente, por igualdade inteira, na mesma origem, com os casos "sem id pendente", "outro registro", "outra origem" e "depois de desmontar".

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 12-10 (publicar e medir o "depois" na VPS) é ação do dono. O código de D-13..D-16 está completo no lado da web: store com `confirmado`/`data`, fila serial, exceções, "salvando", guarda e aviso ao fechar a aba.
- Suíte web (97 arquivos, 918 testes), `tsc`, lint, tokens e `next build` verdes.

## Self-Check: PASSED

Comandos rodados antes de escrever esta linha:

- `[ -f ]` em `apps/web/src/dados/guarda-de-navegacao.ts`, `apps/web/src/dados/guarda-de-navegacao.test.tsx`, `apps/web/src/features/estrutura/financeiro/conta-salvando.test.tsx`, `apps/web/CONTEXT.md`: FOUND.
- `git merge-base --is-ancestor` para `728db86`, `a8edf06`, `074aa01`, `02a6e6b`, `35dd868` e `37c1cab`: FOUND.
- `git rev-list --count faae96f..HEAD` = 6 (medido imediatamente antes de escrever o SUMMARY, a partir do ponto de partida registrado em disco).
