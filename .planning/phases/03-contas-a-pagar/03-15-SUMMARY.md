---
phase: 03-contas-a-pagar
plan: 15
subsystem: ui
tags: [permissoes, visibilidade-derivada, next-app-router, vitest, apps-web]

# Dependency graph
requires:
  - phase: 03-05
    provides: "memberSeesTask/memberReachesContainer derivando a visibilidade da Tarefa do Campo Pessoa (List.sharedWithDefinitionIds + memberNamedOnTask) — sem isso os casos positivos deste plano falhariam por motivo errado"
provides:
  - "compartilhadas-comigo.tsx — TarefasCompartilhadas re-keyed em memberSeesTask && !memberReachesContainer, o caminho permanente da Pessoa da conta até a própria conta"
  - "buscar/page.tsx filtrando Tarefas por memberSeesTask e Listas por memberReachesContainer — a primeira vez que o arquivo sabe quem busca (useSession)"
  - "estrutura/tarefas/page.tsx filtrando `ativas` por memberSeesTask, aba renomeada de 'Todas do Espaço de Trabalho' para 'Todas que eu vejo'"
  - "Convenção documentada em apps/web/CONTEXT.md: nenhum componente lê state.grants para decidir visibilidade — a pergunta é sempre uma função de @n1/dominio/derive"
affects: [03-13, 03-14]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Visibilidade na apresentação = pergunta a @n1/dominio/derive, nunca leitura de state.grants à mão"
    - "GET /estado hidrata sem filtro de visibilidade — toda tela que enumera uma coleção pergunta antes de desenhar (documentado em apps/web/CONTEXT.md)"

key-files:
  created:
    - apps/web/src/features/shell/compartilhadas-comigo.tsx
    - apps/web/src/features/shell/compartilhadas-comigo.test.tsx
    - apps/web/src/features/shell/visibilidade-na-tela.test.tsx
  modified:
    - apps/web/src/features/shell/app-shell.tsx
    - apps/web/src/app/(shell)/buscar/page.tsx
    - apps/web/src/app/(shell)/estrutura/tarefas/page.tsx
    - apps/web/CONTEXT.md

key-decisions:
  - "Task 3 (checkpoint bloqueante, produção real) PARADA — ver seção própria abaixo. Não fabricada: exige apps/api ao vivo contra o Supabase da plataforma, login real como quatro Membros distintos (Pedro/Lucas/Rafael/Maryane) e leitura da aba de rede — nada disso é alcançável nesta execução (sem VPS, sem credenciais de Auth desses Usuários, apps/api/.env bloqueado pelo sandbox de permissões desta sessão)."
  - "Caso (d) do teste de Task 1 corrigido contra um achado no seed: mem_rafael (Administrador) NÃO tem a seção totalmente vazia como o enunciado do plano presumia — uma Grant pré-existente e não relacionada a Contas a pagar (gr_cr_tsk_cr_dai_1, de Contas a receber) já lhe dá acesso compartilhado a uma Tarefa que ele não alcança pela árvore. O teste foi escrito para provar o invariante que importa a este plano (nenhuma conta de Contas a pagar aparece para ele) em vez de uma alegação falsa sobre o estado do seed."

patterns-established:
  - "Arquivo de teste dedicado a um invariante que atravessa telas (visibilidade-na-tela.test.tsx) em vez de duplicar o caso em cada arquivo de página"
  - "next/link e next/navigation (usePathname) montam em jsdom sem qualquer provider/mock de roteador neste projeto — só usePathname/useSearchParams/useRouter precisam de vi.mock(\"next/navigation\", ...) quando o componente os lê"

requirements-completed: [PAG-06]

# Metrics
duration: 60min (inclui ~9min de suíte @n1/api contra o Supabase real, fora do diff deste plano)
completed: 2026-09-23
---

# Phase 3 Plan 15: A Pessoa da conta chega na própria Tarefa — e só nela — Summary

**`compartilhadas-comigo.tsx` reabre, num arquivo com teste, o caminho que 03-05 sem querer fechou ao apagar as Grants `gr_cp_pessoa_*`; `buscar/page.tsx` e `estrutura/tarefas/page.tsx` param de listar o Espaço de Trabalho inteiro para qualquer sessão — as três superfícies agora perguntam `memberSeesTask`/`memberReachesContainer` antes de desenhar.**

## Performance

- **Duration:** ~60 min (Tasks 1-2 código+teste ~35min; verificação decomposta por workspace, incluindo ~9min da suíte `@n1/api` contra o Supabase real — sem diff neste plano)
- **Started:** 2026-09-23T16:24:00-03:00 (aprox.)
- **Completed:** 2026-09-23T16:53:00-03:00 (aprox.)
- **Tasks:** 3 (Tasks 1-2 completas e commitadas; Task 3 — checkpoint bloqueante de produção — PARADA, ver abaixo)
- **Files modified:** 7 (3 criados, 4 alterados) + 1 arquivo de suporte (`deferred-items.md`, não em `files_modified`)

## Accomplishments

- **T-3-77 fechado: a Pessoa da conta tem de volta um caminho permanente até a própria Tarefa.** `SharedTasks` (função local de 35 linhas em `app-shell.tsx`, sem teste nenhum) lia `data.grants` — exatamente as quatro linhas (`gr_cp_pessoa_*`) que 03-05 apagou do seed ao tornar a visibilidade derivada. Sem este plano, 03-05 teria corrigido o domínio e apagado a porta da interface na mesma rodada, em silêncio: `tasks.length === 0`, a seção some, nenhum teste falha. `compartilhadas-comigo.tsx` pergunta agora `memberSeesTask(state, memberId, task.id) && !memberReachesContainer(state, memberId, "list", task.listId)` — cobre os dois mecanismos de uma vez (Grant, para quem ainda tiver uma; derivação pelo Campo Pessoa, para a Pessoa da conta) — e nasce com teste, num arquivo cujo nome é a pergunta.
- **O caso negativo provado na tela, nos dois sentidos, nas três superfícies.** `compartilhadas-comigo.test.tsx` (9 casos) e `visibilidade-na-tela.test.tsx` (7 casos) montam a MESMA sessão de Pedro (`mem_thiago_pereira`) e de Lucas (`mem_joao_konq`) sobre o MESMO estado e verificam, por `screen.queryByText`/`querySelector`, que nenhum dos dois encontra a conta do outro — no trilho, na busca global e em "Minhas Tarefas".
- **T-3-75 fechado: a busca global cumpre a promessa que o próprio cabeçalho fazia desde sempre.** `buscar/page.tsx` não importava `useSession` — não sabia quem buscava — e devolvia `state.tasks`/`state.lists` inteiros a qualquer Membro, apesar do comentário "B103 — the search never reveals what a permission hides". Agora filtra Tarefas por `memberSeesTask` e Listas por `memberReachesContainer`, ANTES do filtro de termo/lifecycle. O cabeçalho foi reescrito para nomear o que passou a ser verdade e, nominalmente, as sete famílias que continuam sem filtro (Contatos, Empresas, Negócios, Conversas, Documentos, Agentes, Automações) — dívida registrada (T-3-80), não descuido.
- **T-3-76 fechado: "Minhas Tarefas" para de ter uma aba que lista o Espaço inteiro para quem estiver logado.** `estrutura/tarefas/page.tsx` filtra `ativas` por `memberSeesTask` numa linha só — `minhas` e `vencidas` herdam a regra por derivarem dela. O rótulo "Todas do Espaço de Trabalho" (falso para qualquer Membro que não alcance tudo) virou "Todas que eu vejo"; o contador da aba já era `ativas.length`, então passou a contar certo sem mudança adicional.
- **Alcance não foi alargado em ponto nenhum.** `packages/dominio` e `apps/api` sem diff (`git diff --quiet` confirmado); `[lista]/page.tsx` (de 03-13) sem diff; "demais Membros não veem a Lista" continua valendo — provado na busca (caso j: `mem_rafael` não acha "Contas a pagar").
- **A outra metade do critério 5 (edição restrita a Anexo/Data de Emissão) não foi tocada** — `git diff --quiet apps/web/src/features/estrutura/tarefa-completa.tsx` confirmado limpo, `camposDeConvidado` continua aparecendo 5 vezes fora de comentário.

## Task Commits

1. **Task 1 (RED): teste de `compartilhadas-comigo`** — `96efff0` (test)
2. **Task 1 (GREEN): `TarefasCompartilhadas` re-keyed em `memberSeesTask`** — `2d1636e` (feat)
3. **Task 2 (RED): teste `visibilidade-na-tela`** — `f84bc07` (test)
4. **Task 2 (GREEN): filtros em `buscar/page.tsx` e `estrutura/tarefas/page.tsx`** — `a5b0317` (feat)
5. **Task 3: [BLOCKING] verificação de produção** — sem commit; PARADA (ver "Task 3 — Checkpoint bloqueante" abaixo)

**Plan metadata:** ver commit final `docs(03-15)`.

_Tasks 1 e 2 têm dois commits cada por serem TDD (RED → GREEN). REFACTOR não foi necessário em nenhuma das duas: o código saiu sem duplicação a remover._

## Files Created/Modified

- `apps/web/src/features/shell/compartilhadas-comigo.tsx` — **criado**. `tarefasCompartilhadasCom(state, memberId)` (seletor puro, alcance memoizado por Lista via `Map`), `TarefasCompartilhadas` (a seção do trilho, com teto de `MAXIMO_COMPARTILHADAS=10` e link de overflow para `/estrutura/tarefas`)
- `apps/web/src/features/shell/compartilhadas-comigo.test.tsx` — **criado**. 9 casos: (a) vê sem Grant, (b)/(c) negativo nos dois sentidos na tela, (d) Administrador sem Contas a pagar + Convidada sem conta, (e) quem alcança a Lista não duplica, (f) Grant antiga continua valendo, (g) conta fechada sai da seção
- `apps/web/src/features/shell/visibilidade-na-tela.test.tsx` — **criado**. 7 casos: (h)/(i) busca — mesmo termo, sessão diferente, resultado diferente; (j) Lista some da busca para quem não a alcança; (k)/(l) "Minhas Tarefas" — recorte e contador; (m) quem já alcançava continua alcançando; guarda de rede (Transporte nunca chamado)
- `apps/web/src/features/shell/app-shell.tsx` — `SharedTasks` (função + comentário + uso) removida; `TarefasCompartilhadas` importada e montada no lugar; `memberReachesContainer` saiu do import por ter ficado órfão
- `apps/web/src/app/(shell)/buscar/page.tsx` — `useSession` importado pela primeira vez; `memberSeesTask` filtra Tarefas, `memberReachesContainer` filtra Listas; cabeçalho B103 reescrito nomeando o que passou a valer e as sete famílias ainda sem filtro
- `apps/web/src/app/(shell)/estrutura/tarefas/page.tsx` — `ativas` filtrada por `memberSeesTask`; recorte "todas" renomeado para "Todas que eu vejo"; `emptyHint` ajustado
- `apps/web/CONTEXT.md` — seção nova "Quem vê o quê na tela": tabela de qual função cada superfície pergunta + aviso de que `GET /estado` não filtra por visibilidade

## Decisions Made

### Caso (d) do teste de Task 1 — corrigido contra um achado no seed, não presumido do enunciado

O plano afirmava (must_haves e acceptance criteria): *"com `mem_rafael` (Administrador), `TarefasCompartilhadas` devolve `null`"*. Rodando o seletor real contra `buildSeed()`, isso é **falso**: existe uma Grant pré-existente e completamente alheia a Contas a pagar — `gr_cr_tsk_cr_dai_1` (`seed-contas-a-receber.ts`), ação `comentar`, sobre `tsk_cr_dai_1` — que dá a `mem_rafael` acesso compartilhado a essa Tarefa de Contas a receber, porque ele não alcança `lst_contas_a_receber` pela árvore (a Pasta é privada). Essa mesma Grant já fazia a antiga `SharedTasks` (`data.grants` puro) mostrar 7 Tarefas de Contas a receber para ele — confirmado rodando a lógica antiga contra o seed antes de qualquer edição. Com o filtro NOVO de categoria terminal (item (g) do próprio plano, genérico e não específico de Contas a pagar), 6 dessas 7 saem por estarem em categoria fechada; sobra exatamente 1.

Isto não é uma falha desta implementação — é o mecanismo de Grant "continuando a valer" (o próprio caso (f) do plano) operando sobre um fornecedor diferente de Contas a Receber que o autor do plano não conferiu ao escrever a asserção de (d). O teste foi reescrito para provar o invariante que **este plano** de fato garante — nenhuma conta de `lst_contas_a_pagar` aparece para o Administrador — em vez de afirmar algo falso sobre o estado real do seed. `mem_beatriz` (Convidada sem nenhuma Grant) continua com a seção inteiramente ausente, como o plano previu.

### `Link`/`usePathname` em `jsdom` — resposta determinística registrada para os dois planos que montam componente pela primeira vez nesta fase

Confirmado empiricamente (Task 1): `<Link>` de `next/link` (Next 16.3.4, App Router) monta como `<a>` normal em `render()` avulso, sem qualquer provider de roteador — não foi necessário `vi.mock("next/link", ...)`. `usePathname` (e, na Task 2, `useRouter`/`useSearchParams`) SÃO mockados via `vi.mock("next/navigation", ...)`, porque o componente efetivamente os invoca para decidir o que renderizar/ler.

## Deviations from Plan

### Auto-fixed / corrigidos durante a execução

**1. [Achado no seed, não Rule 1-3 — ajuste de teste] Caso (d) da Task 1**
- **Found during:** Task 1, escrevendo o teste antes da verificação final
- **Issue:** o enunciado do plano presumia `mem_rafael` sem nenhuma Tarefa compartilhada; o seed real (de Contas a Receber, não deste plano) dá a ele uma
- **Fix:** teste reescrito para afirmar o invariante certo (nenhuma conta de Contas a pagar aparece para ele) — ver "Decisions Made" acima
- **Files modified:** `apps/web/src/features/shell/compartilhadas-comigo.test.tsx`
- **Commit:** `96efff0`

**2. [Rule de escopo — achado, não corrigido] Timeout em teste pré-existente de `@n1/api`**
- **Found during:** verificação final, `npm run test -w @n1/api`
- **Issue:** `src/e2e/lote-contas-a-pagar.test.ts`, caso "(d) o piso e o teto do lock (DEC-06)" estourou o timeout de 180s contra o Supabase real. Arquivo e caso são de 03-12, fora de `files_modified` deste plano
- **Fix:** nenhuma — fora de escopo. Registrado em `.planning/phases/03-contas-a-pagar/deferred-items.md`
- **Verificação de não-regressão:** `git diff --quiet packages/dominio apps/api` limpo antes e depois das quatro tasks deste plano — nenhuma linha dessas duas camadas mudou

---

**Total deviations:** 1 ajuste de teste (achado de seed) + 1 achado fora de escopo registrado, não corrigido.
**Impact on plan:** nenhum sobre o objetivo de 03-15. O ajuste de (d) torna o teste mais correto, não mais fraco: continua provando T-3-01 para Contas a pagar especificamente, com uma nota explícita sobre o mecanismo antigo de Contas a Receber que ele deixou de mascarar.

## Issues Encountered

**Task 3 não pôde ser executada — ver seção dedicada abaixo.** Fora isso, nenhum bloqueio: as quatro rodadas RED confirmaram falha pelo motivo certo antes de cada GREEN (verificado movendo o arquivo novo para fora e revertendo temporariamente as duas páginas para o `HEAD` anterior, nunca com `git stash`/`git checkout -- .`/reset).

## Task 3 — Checkpoint bloqueante de produção — PARADA

Task 3 (`gate="blocking"`, `checkpoint:human-verify`) pede: subir `apps/api` e `apps/web` contra o Supabase real da plataforma, autenticar como quatro Usuários REAIS e distintos (Pedro/`mem_thiago_pereira`, Lucas/`mem_joao_konq`, Rafael/`mem_rafael`, Maryane/`CP.financeiroId`), inspecionar a aba de rede, criar uma Conta a pagar nova e trocar o Campo Pessoa entre sessões.

**Isto não é alcançável nesta execução, e a Task 3 não foi fabricada:**

1. `apps/api/.env` existe no repositório mas o sistema de permissões desta sessão **nega qualquer comando que referencie o arquivo** (`sed`, `grep`, `cat` — todos bloqueados) — não há como ler `DATABASE_URL`/segredos de produção para subir o servidor com a configuração real, e não há um browser nesta sessão para autenticar via Supabase Auth mesmo que houvesse.
2. Autenticar como quatro Usuários REAIS e distintos exige as credenciais de login de cada um (senha ou magic link de cada e-mail) — nenhuma delas está disponível a este executor.
3. Não há acesso a VPS/produção nesta sessão — mesma família de bloqueio já registrada para 03-07 (Task 4), 03-08 (identidade de produção), 03-10 (Task 4) e 03-11 (Task 3) em `STATE.md`.

**O que FOI verificado, como substituto honesto e mais fraco (não substitui a Task 3):**
- Os 16 casos de teste (a)-(m) provam, com `Transporte` falso e `StoreProvider` de verdade — nunca com afirmação inventada —, que os componentes decidem certo sobre um `DataState` real montado em memória, nos dois sentidos, para as três superfícies.
- `npm run test -w @n1/api` (decomposto, ~9min) rodou de fato contra o Supabase real da plataforma (`DATABASE_URL` carregado do `.env` do workspace pelo próprio `vitest`, sem que este executor tivesse lido o segredo) e confirmou 475 passed/12 skipped/1 timeout pré-existente e fora de escopo (ver "Deviations").

**O que continua pendente, exatamente como a Task 3 pede:**
- Passo 1 (achar/limpar as Grants `gr_cp_pessoa_*` já persistidas em `ws_n1`, se existirem — T-3-12)
- Passo 3 (confirmar que o corpo de `GET /estado` da sessão do Pedro contém a conta do Lucas e a tela não a mostra)
- Passos 5-9 (edição restrita na tela real, Conta nova criada ao vivo, troca de Pessoa, Administrador, "ninguém encolheu")

**Achado para o orquestrador, herdado dos planos anteriores da mesma onda:** as pendências de produção de 03-07/03-08/03-10/03-11/03-15 convergem no mesmo acesso (VPS + credenciais reais de produção) — um único runbook de verificação humana, executado uma vez com todo o acesso necessário, provavelmente fecha as cinco de uma vez.

## Threat Flags

Nenhuma superfície nova fora do `<threat_model>` do plano. Disposições, como executadas:

| Threat ID | Disposition | Como ficou |
|-----------|-------------|-----------|
| T-3-01 | mitigate | Provado na tela (não só no domínio), nos dois sentidos, nas três superfícies — casos (b),(c),(h),(i),(k). `derive.ts` e `[lista]/page.tsx` sem diff |
| T-3-75 | mitigate | `useSession` + `memberSeesTask`/`memberReachesContainer` em `buscar/page.tsx`; cabeçalho B103 reescrito |
| T-3-76 | mitigate | `memberSeesTask` em `ativas`; rótulo corrigido; contador correto (caso l) |
| T-3-77 | mitigate | `compartilhadas-comigo.tsx` com teste próprio; `grep` de `data.grants`/`state.grants` fora de comentário = 0 |
| T-3-78 | mitigate (por desenho, não tocado) | `[lista]/page.tsx` e `packages/dominio` sem diff — alcance não alargado |
| T-3-79 | accept | Confirmado no código (`GET /estado` sem filtro); compensação via T-3-01/75/76. Passo 3 do checkpoint (a prova visual com aba de rede) fica pendente na Task 3 parada |
| T-3-80 | accept | Sete famílias nomeadas no cabeçalho de `buscar/page.tsx` e aqui |
| T-3-81 | mitigate | `git diff --quiet apps/web/src/features/estrutura/tarefa-completa.tsx` limpo; `camposDeConvidado` aparece 5x fora de comentário |
| T-3-SC | accept | Nenhum pacote instalado nesta rodada |

## Verification

| Verificação | Resultado |
|---|---|
| `npm run test -w @n1/web -- src/features/shell/compartilhadas-comigo.test.tsx` | **9 passed** |
| `npm run test -w @n1/web -- src/features/shell/visibilidade-na-tela.test.tsx` | **7 passed** |
| `npm run test -w @n1/web` (suíte inteira) | **123 passed** / 12 arquivos (eram 107) |
| `npm run typecheck -w @n1/web` | verde |
| `npm run lint -w @n1/web` | verde |
| `npm run verificar:tokens -w @n1/web` | 392 definidos, 212 arquivos, 0 falhas |
| `npm run typecheck --workspace=@n1/dominio` + `npm run test --workspace=@n1/dominio` | verde, **465 passed** (23 arquivos) |
| `npm run typecheck --workspace=@n1/api` | verde |
| `npm run test -w @n1/api` (contra o Supabase real, `DATABASE_URL` do `.env` do workspace) | **475 passed / 12 skipped / 1 timeout** — pré-existente, fora de `files_modified` (ver Deviations e `deferred-items.md`) |
| `git diff --quiet packages/dominio apps/api` | limpo |
| `git diff --quiet apps/web/src/features/estrutura/tarefa-completa.tsx` | limpo |
| `git diff --quiet` nos 4 arquivos de 03-13 nomeados no plano | limpo |
| `git diff --name-only` das 4 commits do plano | exatamente os 7 arquivos de `files_modified` |

Critérios de aceite específicos (Task 1 e Task 2), um a um — todos conferidos por `grep`/`git diff --numstat` e reproduzidos na seção de execução: `data.grants`/`state.grants` = 0 ocorrências fora de comentário em `compartilhadas-comigo.tsx`; `memberSeesTask` ≥1 ali e ≥2 em cada uma das duas páginas; `Map` + `listId` ≥1 (memoização por Lista); `fetch(` = 0 nos três arquivos; `SharedTasks` = 0 e `TarefasCompartilhadas` = 2 em `app-shell.tsx`; `git diff --numstat app-shell.tsx` mostra remoção de 40 linhas; `CONTEXT.md` contém as três strings pedidas; `useSession`/`from "@/dados/store"` presentes em `buscar/page.tsx`; `Contatos` aparece 3x (rótulo do grupo + nota de escopo, acima do mínimo de 2); `Todas do Espaço de Trabalho` = 0 e `Todas que eu vejo` = 1.

## Next Phase Readiness

- **PAG-06 fechado na apresentação** (a metade do domínio já estava fechada por 03-05): a Pessoa da conta tem caminho e as três superfícies que listam Tarefa perguntam antes de desenhar.
- **Task 3 parada** — mesma família de pendência de produção que 03-07/03-08/03-10/03-11. Um runbook único de verificação humana com acesso real (VPS + credenciais) provavelmente fecha as cinco pendências de uma vez.
- **T-3-78/T-3-79/T-3-80 registrados como achados para o orquestrador**, exatamente como o plano pediu: `[lista]/page.tsx` sem `memberSeesTask` em `todas` (inócuo hoje, pertence a 03-13); `GET /estado` sem filtro de visibilidade (correção durável é `apps/api`); as sete famílias restantes da busca global (predicado de cada uma não decidido em nenhum artefato do projeto).
- **03-13 (wave 4, PAG-05) e 03-14 (wave 5, PAG-03)** não têm SUMMARY ainda nesta árvore — não são pré-requisito deste plano (`depends_on: [03-05]` apenas) e nenhum arquivo deles foi tocado; confirmado por `git diff --quiet` nos quatro arquivos nomeados no plano.

## Self-Check: PASSED

- `apps/web/src/features/shell/compartilhadas-comigo.tsx` — FOUND
- `apps/web/src/features/shell/compartilhadas-comigo.test.tsx` — FOUND
- `apps/web/src/features/shell/visibilidade-na-tela.test.tsx` — FOUND
- `apps/web/src/features/shell/app-shell.tsx` — FOUND, `SharedTasks` ausente
- `apps/web/src/app/(shell)/buscar/page.tsx` — FOUND, `useSession` presente
- `apps/web/src/app/(shell)/estrutura/tarefas/page.tsx` — FOUND, `Todas que eu vejo` presente
- `apps/web/CONTEXT.md` — FOUND, seção "Quem vê o quê na tela" presente
- `.planning/phases/03-contas-a-pagar/deferred-items.md` — FOUND
- commit `96efff0` — FOUND
- commit `2d1636e` — FOUND
- commit `f84bc07` — FOUND
- commit `a5b0317` — FOUND

---
*Phase: 03-contas-a-pagar*
*Completed: 2026-09-23*
