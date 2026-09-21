---
phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup
plan: 19
subsystem: ui
tags: [react, nextjs, fastify, timeline, storage, signed-url]

# Dependency graph
requires:
  - phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup
    provides: "Plan 02-14 — PainelAprovacao/DialogoFluxoManual na página cheia da Tarefa, e a mesma página que este plano estende"
  - phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup
    provides: "Plan 02-11 — urlDeDownload (apps/api/src/servicos/storage-uploads.ts), o serviço de assinatura consumido pela nova rota"
  - phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup
    provides: "Plan 02-05 — formActor / Ator sistema/Formulário com id formulario:<id>"
provides:
  - "Painel Timeline (apps/web/src/features/tarefa/timeline.tsx): fusão de Comentários e Registros de Atividade num único ol cronológico, montado só para Tarefas da Lista de Solicitações de pagamento"
  - "Painel de anexos com download por URL assinada nova, por linha (apps/web/src/features/tarefa/anexos.tsx)"
  - "GET /anexos/:fileId/url em apps/api/src/rotas/estado.ts — primeiro caminho autenticado do navegador para pedir uma URL assinada de um WorkspaceFile"
affects: [02-solicita-o-de-pagamento-o-front-substitui-o-clickup]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Renderer `rico` local (negrito/itálico via regex, sem HTML arbitrário) em vez de uma dependência de markdown nova"
    - "Controlador de composição que só limpa o rascunho quando o Comentário aceito aparece de verdade em `data` (mesmo padrão de `useDecisaoDeAprovacao`), notificando por callback (`onEnviado`) em vez de `setState` direto dentro do efeito"
    - "Nova rota GET autenticada acrescentada ao módulo `rotasDeEstado` existente (não a um arquivo/registro novo em app.ts) para não colidir com outros planos da mesma onda que também tocam apps/api"

key-files:
  created:
    - apps/web/src/features/tarefa/timeline.tsx
    - apps/web/src/features/tarefa/timeline.test.tsx
    - apps/web/src/features/tarefa/anexos.tsx
  modified:
    - "apps/web/src/app/(shell)/estrutura/tarefas/[tarefa]/page.tsx"
    - apps/api/src/rotas/estado.ts
    - apps/api/src/rotas/estado.test.ts

key-decisions:
  - "Timeline e PainelDeAnexos só substituem os painéis atuais para task.listId === CP.listId (\"Contas a pagar\", a Lista de Solicitações de pagamento) — outras Listas continuam com TaskComments + o painel Atividade + TaskAttachments, sem redesenho geral da página"
  - "GET /anexos/:fileId/url foi acrescentado dentro de apps/api/src/rotas/estado.ts (não em app.ts nem em arquivo novo), fora dos files_modified originais do plano, para herdar a autenticação já registrada e não colidir com o Plan 02-13 (mesma onda, também edita app.ts)"
  - "Autorização da nova rota é por Espaço de Trabalho (o Membro da sessão), não por Tarefa: equivalente ao que GET /estado já expõe hoje (o DataState inteiro, WorkspaceFile.objectKey incluído) — não é uma superfície nova de informação, só evita reter a URL assinada na tela"

patterns-established:
  - "Timeline única por Solicitação: quando um plano futuro trouxer Server-Sent/streaming para o painel, TimelineEsqueleto já está pronto (mesmo padrão de PainelAprovacaoEsqueleto)"

requirements-completed: []  # SOL-04 fica pendente: Task 4 (checkpoint:human-verify) não foi executada nesta sessão — ver "Next Phase Readiness"

duration: ~6min (commits) / sessão de execução mais longa por leitura de contexto
completed: 2026-09-21
---

# Phase 02 Plan 19: Timeline única + download de anexo assinado Summary

**Painel `Timeline` funde Comentários e Registros de Atividade num `ol` cronológico único na Tarefa de Solicitação de pagamento, com autoria `sistema/Formulário` estrutural e sanitização de eventos de integração; anexos passam a baixar por URL assinada nova a cada clique via uma rota `GET /anexos/:fileId/url` nova em `apps/api`.**

## Performance

- **Duration:** ~6 min entre o primeiro e o último commit (leitura de contexto e investigação de `apps/api` levaram mais tempo que isso)
- **Tasks:** 3 de 4 concluídas (Task 4 é `checkpoint:human-verify`, bloqueante — ver abaixo)
- **Files modified:** 6 (3 criados, 3 modificados)

## Accomplishments

- `Timeline` (`apps/web/src/features/tarefa/timeline.tsx`): `ol` cronológico do mais antigo ao mais recente, cada entrada com `<time dateTime>`; intercala Comentários e Registros de Atividade por instante, inclusive a Atividade da decisão de aprovação (que é gravada com `objectType: "approvalRequest"`, não `"task"` — `entradasDaTarefa` busca pelos dois caminhos).
- Autoria resolvida por `ActorRef`, nunca pelo dono do recurso: `kind: "system"` com id `formulario:<id>` vira sempre `sistema/Formulário`, estruturalmente (a função nunca consulta quem preencheu o Formulário).
- Pill `Pedido de aprovação` no comentário apontado por `approval.origin.threadCommentId`; a resposta canônica (`✅ Aprovado por <nome>` / `❌ Reprovado por <nome>`) aparece como reply, com âncora `#comentario-<id>` navegável — a mesma âncora que `PainelAprovacao` (Plan 02-14) já usa em "Ver tópico de aprovação".
- Sanitização de eventos de integração: uma entrada cujo Ator é `kind: "integration"` nunca renderiza `detail`/antes/depois — só o rótulo da ação — então nenhum CNPJ, payload ou URL assinada num `detail` chega ao DOM.
- Compositor com `Ctrl/Cmd+Enter` para enviar, `Enter` para nova linha, rascunho preservado até a confirmação do servidor (nunca otimista) e erro exibido junto ao campo sem apagar o texto.
- Renderer `rico` local (negrito/itálico, sem HTML arbitrário, sem dependência nova) para o conteúdo Markdown do Comentário.
- Paginação por "Carregar atividades anteriores", mostrando as 20 entradas mais recentes por padrão.
- `PainelDeAnexos` (`apps/web/src/features/tarefa/anexos.tsx`): reaproveita a lista de anexos existente, mas o clique de baixar pede uma URL assinada nova por linha, com spinner só naquela linha, retry automático de uma tentativa e a copy `Não foi possível abrir o arquivo. Tente novamente.` no fim; nunca nomeia caminho do objeto, repositório, hash ou validade da URL.
- `GET /anexos/:fileId/url` novo em `apps/api/src/rotas/estado.ts`: autoriza pelo Membro da sessão, busca o `WorkspaceFile` direto no banco (sem hidratar o Espaço inteiro) e devolve `{ url, expiresAt }` reaproveitando `urlDeDownload` (Plan 02-11) — nenhum caminho de assinatura novo.
- `Timeline`/`Atividade`/`Comentários`/`Anexos` na página cheia da Tarefa (`page.tsx`) só trocam de componente quando `task.listId === CP.listId` (a Lista "Contas a pagar" / Solicitações de pagamento); outras Listas continuam exatamente como estavam.
- 10 casos de seletor (a)-(j) provados em `timeline.test.tsx`, cobrindo V02-04A.

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Painel `Timeline` — intercalação, autoria e compositor** - `0a0c1cc` (feat)
2. **Task 2: Painel de anexos com download assinado** - `26d8ffc` (feat)
3. **Task 3: Testes de seletor da timeline** - `198c81f` (test)

**Task 4: Verificação humana da timeline** — `checkpoint:human-verify`, gate `blocking`. NÃO executada nesta sessão (ver "Next Phase Readiness").

_Nota: o commit da Task 3 também inclui um pequeno refactor do compositor (mover `texto`/`mencoes` de `useCompositorDeTimeline` para `Compositor`) para corrigir um erro real de `react-hooks/set-state-in-effect` que `npm run lint` acusou — documentado em "Deviations from Plan"._

## Files Created/Modified

- `apps/web/src/features/tarefa/timeline.tsx` — Painel `Timeline`: montagem, resolução de Ator, renderer `rico`, entradas de comentário/atividade, compositor, paginação, `TimelineEsqueleto`.
- `apps/web/src/features/tarefa/timeline.test.tsx` — 10 casos de seletor (a)-(j), V02-04A.
- `apps/web/src/features/tarefa/anexos.tsx` — `PainelDeAnexos`: lista de anexos + download por URL assinada nova, por linha.
- `apps/web/src/app/(shell)/estrutura/tarefas/[tarefa]/page.tsx` — monta `Timeline`/`PainelDeAnexos` no lugar de `TaskComments`+`Atividade`/`TaskAttachments`, só para `task.listId === CP.listId`.
- `apps/api/src/rotas/estado.ts` — nova rota `GET /anexos/:fileId/url` (fora dos `files_modified` originais do plano — ver "Deviations from Plan").
- `apps/api/src/rotas/estado.test.ts` — dois casos novos: 401 sem token, 404 para Arquivo inexistente no Espaço.

## Decisions Made

- **Gate por Lista, não redesenho geral:** `Timeline` e `PainelDeAnexos` só entram para `task.listId === CP.listId`. O UI-SPEC proíbe redesenho geral da página da Tarefa; outras Listas mantêm `TaskComments` + painel `Atividade` + `TaskAttachments` inalterados.
- **Rota de download dentro de `estado.ts`, não em `app.ts`:** o plano previa a possibilidade de precisar de uma rota nova (`GET /anexos/:fileId/url`) e autorizava declará-la no SUMMARY se criada. Como não havia caminho autenticado para o navegador pedir uma URL assinada, acrescentei a rota, mas dentro do módulo `rotasDeEstado` já registrado (`apps/api/src/rotas/estado.ts`) — que já herda `registrarAutenticacao` — em vez de um arquivo novo registrado em `app.ts`. O Plan 02-13 (mesma onda, `apps/api`) também edita `app.ts`; não tocá-lo evita colisão de merge entre os dois planos.
- **Autorização por Espaço de Trabalho, não por Tarefa:** a rota nova autoriza pelo Membro da sessão dentro do Espaço, não verifica se o Membro especificamente vê a Tarefa dona do anexo. Isso não abre uma superfície de informação nova: `GET /estado` já devolve o `DataState` inteiro, `WorkspaceFile.objectKey` incluído, para qualquer Membro com sessão — a rota nova só evita que a tela precise reter a URL assinada. Uma autorização fina por Tarefa fica para quando o Papel do Financeiro virar Concessão real de Membro (mesmo adiamento já registrado em `fluxo-manual-dialog.tsx`).
- **Sem dependência de markdown nova:** o "renderer `rico`" do UI-SPEC foi implementado como uma função local que reconhece `**negrito**`/`_itálico_` por regex e nunca usa `dangerouslySetInnerHTML` — cumpre "conteúdo Markdown... sem HTML arbitrário" sem instalar um pacote novo (RULE 3 exclui instalação de pacote de auto-fix; como não havia bloqueio real — o requisito é satisfeito sem dependência — não havia motivo para pedir aprovação de pacote).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `react-hooks/set-state-in-effect` no compositor da Timeline**
- **Found during:** Task 3 (ao rodar `npm run check` depois de escrever os testes)
- **Issue:** `useCompositorDeTimeline` chamava `setTexto`/`setMencoes`/`setTentativa` direto dentro do corpo de um `useEffect`, o que `eslint-plugin-react-hooks` (regra `set-state-in-effect`) recusa — bloqueava `npm run check`.
- **Fix:** `texto`/`mencoes` passaram a morar em `Compositor` (quem os exibe); `useCompositorDeTimeline` passou a notificar a confirmação por um callback (`onEnviado`) chamado dentro do efeito, em vez de `setState` direto — mesmo padrão que `useDecisaoDeAprovacao` já usa em `painel-aprovacao.tsx` (Plan 02-14) com `onSucesso`.
- **Files modified:** `apps/web/src/features/tarefa/timeline.tsx`
- **Verification:** `npm run check` (typecheck + lint + verificar:tokens + test) sai verde nos três workspaces; os 10 casos de `timeline.test.tsx` continuam passando sem alteração de comportamento observável.
- **Committed in:** `198c81f` (Task 3 commit)

**2. [Rule 2 - Missing Critical] `GET /anexos/:fileId/url` em `apps/api`**
- **Found during:** Task 2 (o plano previa exatamente este cenário e instruía a criar a rota se não houvesse caminho autenticado)
- **Issue:** Não existia nenhum caminho HTTP para o navegador autenticado pedir uma URL assinada de um `WorkspaceFile` — só `urlDeDownload` (serviço interno, Plan 02-11) e o contrato `GET /v1/integrations/*` de `automation/` (Plan 02-13), que autentica por credencial de serviço, não por sessão de Membro.
- **Fix:** Rota nova em `apps/api/src/rotas/estado.ts`, autorizando pelo Membro da sessão e devolvendo `{ url, expiresAt }` sem `objectKey`, reaproveitando `urlDeDownload`.
- **Files modified:** `apps/api/src/rotas/estado.ts`, `apps/api/src/rotas/estado.test.ts` (fora dos `files_modified` originais do plano — declarado aqui, como o próprio plano instruiu).
- **Verification:** `npm run typecheck -w @n1/api` e `npm run test -w @n1/api` (237 passaram, 75 pulados sem `DATABASE_URL`/`SUPABASE_STORAGE_BUCKET`, incluindo os 2 casos novos: 401 sem token e 404 para Arquivo inexistente).
- **Committed in:** `26d8ffc` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking — lint, 1 missing critical — endpoint que o próprio plano previu e autorizou).
**Impact on plan:** Ambos necessários para `npm run check` passar e para o painel de anexos funcionar de verdade; nenhum dos dois é scope creep — o segundo já estava contingenciado no texto do plano.

## Issues Encountered

- Os arquivos de leitura `apps/api/src/rotas/formularios-publicos.ts` e `integracao-solicitacoes.ts`, citados no `read_first` da Task 2, ainda não existem neste worktree (nascem em planos paralelos da mesma onda — 02-13 — que não estão mesclados na base deste worktree). Segui direto para `storage-uploads.ts` e `estado.ts`, que já existiam e bastavam.
- Isolamento de worktree: este plano só declara arquivos de `apps/web` nos `files_modified` originais, mas a Task 2 do próprio plano previa a necessidade de tocar `apps/api`. Resolvido mantendo a mudança no menor raio possível (um módulo já registrado, sem tocar `app.ts`) — ver "Decisions Made".

## User Setup Required

None - nenhuma configuração de serviço externo nova. A rota nova reaproveita as mesmas variáveis de ambiente que `storage-uploads.ts` já documenta (`SUPABASE_STORAGE_BUCKET`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, todas do Plan 02-11).

## Next Phase Readiness

**Task 4 (checkpoint:human-verify, gate `blocking`) não foi executada nesta sessão.** Este agente é um executor paralelo em worktree isolado, sem `apps/web/.env.local` real (gotcha documentado no prompt: `proxy.ts` lança sem `NEXT_PUBLIC_SUPABASE_URL`) — não há como rodar `npm run dev` contra o Supabase real e percorrer os oito passos de verificação visual descritos na Task 4 a partir deste worktree.

O que falta para fechar o plano:
1. Rodar `npm run dev` num ambiente com `.env.local` real (Supabase configurado) e abrir uma Solicitação criada pelo Formulário público.
2. Percorrer os 8 passos de `02-19-PLAN.md` Task 4: ordem cronológica com `sistema/Formulário` na criação; pill `Pedido de aprovação` e link `Ver tópico de aprovação`; comentar com menção via `Ctrl/Cmd+Enter`; aprovar e ver a resposta canônica + `por clique`; baixar um anexo com spinner só na linha; `Carregar atividades anteriores` preservando a posição; repetir em 375px.
3. Se aprovado: marcar V02-04A/SOL-04 como `requirements-completed` (este SUMMARY deixa `requirements-completed: []` de propósito) e permitir que o orquestrador feche o plano.
4. Se houver divergências: registrá-las como a resposta ao `resume-signal` (`"aprovado"` ou a lista de problemas) para um agente de continuação retomar exatamente na Task 4.

**Pronto para a próxima fase, condicional à Task 4:** o código de Tasks 1-3 está completo, testado (`npm run check` verde nos três workspaces) e commitado; só falta a leitura humana de clareza visual que a Task 4 exige.

---
*Phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup*
*Completed: 2026-09-21 (Tasks 1-3; Task 4 pendente)*

## Self-Check: PASSED

- FOUND: apps/web/src/features/tarefa/timeline.tsx
- FOUND: apps/web/src/features/tarefa/timeline.test.tsx
- FOUND: apps/web/src/features/tarefa/anexos.tsx
- FOUND: apps/api/src/rotas/estado.ts
- FOUND: apps/api/src/rotas/estado.test.ts
- FOUND commit 0a0c1cc (Task 1)
- FOUND commit 26d8ffc (Task 2)
- FOUND commit 198c81f (Task 3)
