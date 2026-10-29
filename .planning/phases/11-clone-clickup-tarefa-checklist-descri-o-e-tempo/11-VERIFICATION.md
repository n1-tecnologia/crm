---
phase: 11-clone-clickup-tarefa-checklist-descri-o-e-tempo
verified: 2026-10-29T23:40:00Z
status: passed
score: 7/7 must-haves verified
covered_files:
  - .planning/phases/11-clone-clickup-tarefa-checklist-descri-o-e-tempo/11-01-PLAN.md
  - .planning/phases/11-clone-clickup-tarefa-checklist-descri-o-e-tempo/11-01-SUMMARY.md
  - .planning/phases/11-clone-clickup-tarefa-checklist-descri-o-e-tempo/11-02-PLAN.md
  - .planning/phases/11-clone-clickup-tarefa-checklist-descri-o-e-tempo/11-02-SUMMARY.md
  - .planning/phases/11-clone-clickup-tarefa-checklist-descri-o-e-tempo/11-03-PLAN.md
  - .planning/phases/11-clone-clickup-tarefa-checklist-descri-o-e-tempo/11-03-SUMMARY.md
  - .planning/phases/11-clone-clickup-tarefa-checklist-descri-o-e-tempo/11-04-PLAN.md
  - .planning/phases/11-clone-clickup-tarefa-checklist-descri-o-e-tempo/11-04-SUMMARY.md
  - .planning/phases/11-clone-clickup-tarefa-checklist-descri-o-e-tempo/11-05-PLAN.md
  - .planning/phases/11-clone-clickup-tarefa-checklist-descri-o-e-tempo/11-05-SUMMARY.md
  - .planning/phases/11-clone-clickup-tarefa-checklist-descri-o-e-tempo/11-06-PLAN.md
  - .planning/phases/11-clone-clickup-tarefa-checklist-descri-o-e-tempo/11-06-SUMMARY.md
  - .planning/phases/11-clone-clickup-tarefa-checklist-descri-o-e-tempo/11-07-PLAN.md
  - .planning/phases/11-clone-clickup-tarefa-checklist-descri-o-e-tempo/11-07-SUMMARY.md
  - .planning/phases/11-clone-clickup-tarefa-checklist-descri-o-e-tempo/11-08-PLAN.md
  - .planning/phases/11-clone-clickup-tarefa-checklist-descri-o-e-tempo/11-08-SUMMARY.md
  - apps/api/src/rotas/esquemas-de-argumentos.test.ts
  - apps/api/src/rotas/esquemas/tarefas.ts
  - apps/api/src/rotas/operacoes.test.ts
  - "apps/web/src/app/(shell)/configuracoes/auditoria/page.tsx"
  - "apps/web/src/app/(shell)/crm/reunioes/[reuniao]/page.tsx"
  - "apps/web/src/app/(shell)/notificacoes/notificacoes.test.tsx"
  - "apps/web/src/app/(shell)/notificacoes/page.tsx"
  - apps/web/src/design/components.tsx
  - apps/web/src/features/estrutura/collaboration-editors.tsx
  - apps/web/src/features/estrutura/conversao-de-item.test.tsx
  - apps/web/src/features/estrutura/conversao-de-item.tsx
  - apps/web/src/features/estrutura/descricao-da-tarefa.test.tsx
  - apps/web/src/features/estrutura/descricao-da-tarefa.tsx
  - apps/web/src/features/estrutura/mencoes.test.tsx
  - apps/web/src/features/estrutura/mencoes.ts
  - apps/web/src/features/estrutura/tarefa-completa.tsx
  - apps/web/src/features/estrutura/task-editors.tsx
  - apps/web/src/features/estrutura/tempo-da-tarefa.test.tsx
  - apps/web/src/features/estrutura/tempo.test.ts
  - apps/web/src/features/estrutura/tempo.ts
  - apps/web/src/features/tarefa/alteracao-de-descricao.test.tsx
  - apps/web/src/features/tarefa/alteracao-de-descricao.tsx
  - apps/web/src/features/tarefa/feed-de-atividade.test.tsx
  - apps/web/src/features/tarefa/feed-de-atividade.tsx
  - apps/web/src/features/tarefa/timeline.test.tsx
  - apps/web/src/features/tarefa/timeline.tsx
  - ontologia/DECISOES-E-PENDENCIAS.md
  - packages/dominio/CONTEXT.md
  - packages/dominio/src/derive-visibilidade.test.ts
  - packages/dominio/src/derive.ts
  - packages/dominio/src/descricao-da-tarefa.ts
  - packages/dominio/src/operations/automations-motor.test.ts
  - packages/dominio/src/operations/collaboration.ts
  - packages/dominio/src/operations/conversao-de-item.test.ts
  - packages/dominio/src/operations/descricao-da-tarefa.test.ts
  - packages/dominio/src/operations/mencao-na-descricao.test.ts
  - packages/dominio/src/operations/operations.test.ts
  - packages/dominio/src/operations/pessoa-da-conta.test.ts
  - packages/dominio/src/operations/planning.ts
  - packages/dominio/src/operations/remover-checklist-e-item.test.ts
  - packages/dominio/src/operations/tasks.ts
  - packages/dominio/src/tarefa-publica.ts
  - packages/dominio/src/tempo-registrado.test.ts
  - packages/dominio/src/types/structure.ts
covered_digest: "v3:sha256:b705144a8b04f8a3b950aa5d96de8cec4435ae62435432a5d6f00979031f6436"
behavior_unverified: 0
overrides_applied: 0
coincidental_reliance_items:
  - truth: "TAR-05 / P8: a lista 'Menções a você' ordena a menção da descrição pelo instante da última edição da descrição"
    reason: incidental-ordering
    harden: "Escolher o Registro 'Descrição alterada' mais recente por valor (newestFirst(...)[0]), não pela posição em state.activity (WR-01)"
---

# Fase 11: Clone ClickUp: Tarefa (checklist, descrição e tempo) — Relatório de Verificação

**Objetivo da fase:** Converter item do checklist em Subtarefa sem susto e fechar as lacunas da Tarefa: menção na descrição, histórico com o texto anterior e tempo registrado calculado no domínio (Sessão 2, parte B; tarefas 2.4 e 2.6.6–2.6.9).
**Verificado em:** 2026-10-29
**Status:** passed
**Re-verificação:** Não, verificação inicial.

## Como foi verificado

O SUMMARY.md não foi tratado como evidência. Cada verdade foi conferida no código (`derive.ts`, `tasks.ts`, `descricao-da-tarefa.ts`, `collaboration.ts`, os componentes do `apps/web` e o esquema do `apps/api`) e nos testes. Comandos próprios desta verificação, todos sem banco:

| Comando | Resultado |
|---|---|
| `cd packages/dominio && npx vitest run` (7 arquivos da fase: `tempo-registrado`, `conversao-de-item`, `descricao-da-tarefa`, `mencao-na-descricao`, `remover-checklist-e-item`, `derive-visibilidade`, `quem-pode`) | 7 arquivos, 115 testes passaram |
| `cd packages/dominio && npx tsc --noEmit` | exit 0 |
| `cd apps/web && npx vitest run` (conversão, descrição, menções, tempo, `features/tarefa`, notificações) | 18 arquivos, 144 testes passaram |
| `cd apps/api && DATABASE_URL= npx vitest run src/rotas/esquemas src/rotas/esquemas-de-argumentos.test.ts` | 26 arquivos, 96 testes passaram |
| `grep -rIn parentItemId packages apps` (sem `node_modules`/`.next`/`dist`) | nenhum achado |

Não foi rodado nada contra banco nem aberto `apps/api/.env`. A suíte cheia (`npm run check`, exit 0 na segunda rodada, banco Docker local) e o e2e vêm de `11-PROVAS.md`; a falha intermitente da rodada 1 (`outbox-worker.test.ts`, caso (k)) está em código que a fase não toca (`git diff 2d1ee38..HEAD -- apps/api/src/persistencia` vazio, conforme o registro).

## Alcance do Objetivo

### Verdades observáveis

| # | Verdade (requisito) | Status | Evidência |
|---|---|---|---|
| 1 | TAR-01: `conversaoDeItemRecusada` devolve o motivo (sem escrita, ciclo de vida, Lista sem Subtarefas, nível máximo) e `undefined` quando pode; `convertChecklistItem` a chama antes de qualquer efeito; a frase de nível é a nova | ✓ VERIFIED | `derive.ts:581-595` (ordem fixa, não lê relógio); `tasks.ts:640-641` chama a função e devolve `fail(recusa)`. Frase "Esta Tarefa já está no nível N, o último permitido. O item não pode virar Subtarefa aqui." em `derive.ts:592` e afirmada em `conversao-de-item.test.ts:88` (nível 3 recusa, nível 2 converte). O 6º parâmetro `parentTaskId` saiu da assinatura (`tasks.ts:631-637`) e do esquema (`tarefas.ts:61`, tupla de 3 IDs). |
| 2 | TAR-02: botão só onde dá, cor normal; confirmação de um clique sem digitar; aviso com "Abrir" usando o id do servidor; cartão do Quadro não converte | ✓ VERIFIED | `conversao-de-item.tsx`: `BotaoDeConversao` devolve `null` quando `conversaoDeItemRecusada(...) !== undefined`, classe `btn-sutil` sem `color: var(--erro)`; `DialogoDeConversao` usa `ConfirmDialog` sem `destructive`, sem `Field`/`typedItem`/`confirmDisabledReason`, via `useRunConfirmado`; `onConvertida` recebe `resposta.value.id` do servidor e `tarefa-completa.tsx:773-777,856-860` monta o link `/estrutura/tarefas/${linkDoAviso}`. `cartao-de-tarefa.tsx` sem nenhuma ocorrência de "convert"/"Converter" (D-03). UAT U2, U3, U4, T1, T2 aprovados pelo dono. |
| 3 | TAR-03: checklist de um nível só; `parentItemId` fora do repositório; sem ramo de subitens | ✓ VERIFIED | `grep -rIn parentItemId packages apps` vazio. `convertChecklistItem` (`tasks.ts:631-672`) sem ramo de subitens; `checklistProgress` (`derive.ts:554-558`) conta só Itens não convertidos. A1 (produção): 0 registros com a chave, número colado pelo dono em 29/10/2026 (`11-PROVAS.md`). Divergência B48 registrada em `ontologia/DECISOES-E-PENDENCIAS.md:297,625`. |
| 4 | TAR-04: `updateTask` grava `descriptionMentions`, recusa Membro inexistente; esquema aceita a chave; `useMencoes` abre o menu com "@"; nome destacado | ✓ VERIFIED | `types/structure.ts:416`; `tasks.ts:1453-1456,1482-1485,1502-1516` (recusa antes de qualquer campo; lista regravada como derivada do texto, sem repetição, só Membro existente com `@Nome` presente). Esquema `tarefas.ts:29` (`.strict()`, só `type: "member"`). `mencoes.ts:46` (`useMencoes`), usado pela descrição (`task-editors.tsx:66-114`) e pelo Comentário (`:576-646`). Destaque: `DescricaoDaTarefa` com `segmentosComMencoes` (nós de texto, sem HTML). e2e (r2, r2b) em `11-PROVAS.md`. UAT U1 aprovado pelo dono. |
| 5 | TAR-05: Notificações mostra a menção da descrição com trecho enquanto o nome estiver nela e a Tarefa estiver aberta; some ao fechar/tirar o nome; só para quem enxerga; menção sem `@Nome` nunca avisa; aviso de Comentário igual | ✓ VERIFIED | `derive.ts:1393-1423`: `memberSeesTask` e `effectiveLifecycleOfTask === "ativo"` antes de tudo; ramo da descrição exige `!isTerminalCategory(...)` e `membrosMencionadosNaDescricao(state, task).includes(memberId)` (leitura única da lista, filtra pelo texto: vale para qualquer escritor da descrição, incluindo a cópia da recorrência `collaboration.ts:611`). `MencaoPendente` é união `comentario | descricao`; `resumo` (`derive.ts:1490`) acompanha (`m.tipo === "comentario"`); `notificacoes/page.tsx` renderiza "Menção a você na descrição de “…”" com `mencao.trecho`. Sem estado novo guardado (D-08). Testes `mencao-na-descricao.test.ts`, `derive-visibilidade.test.ts` e `notificacoes.test.tsx` passam. UAT U5, T3, P1, P8 aprovados. |
| 6 | TAR-06: "Descrição alterada" grava `before`/`after` cortados em 2.000 + "…"; "Ver alteração" expande ali mesmo; edição antiga e Ator de integração sem botão | ✓ VERIFIED | `tasks.ts:1497-1501` grava `cortarParaHistorico(...)` dos dois lados e não corta a descrição em si; `descricao-da-tarefa.ts:30-34` corta por ponto de código (nunca no meio de um par substituto). Teste: 3.000 caracteres viram 2.001 com "…" e a descrição segue com 3.000 (`descricao-da-tarefa.test.ts:112-117`). `alteracao-de-descricao.tsx`: botão com `aria-expanded`, expande "Antes"/"Depois" embaixo da linha, texto puro; `temAlteracaoParaVer` exclui `actor.kind === "integration"` e registro sem `before`/`after`. Usado em `feed-de-atividade.tsx:221` e `timeline.tsx:300`, e o `(antes → depois)` some só para esta ação (`:200`, `:297`). Recorte por visibilidade coberto em `derive-visibilidade.test.ts` e pelo e2e. UAT T4, T6 aprovados. |
| 7 | TAR-07: `tempoRegistrado` calculado no domínio (só fechados, `emAndamento`, total com Subtarefas); linha e editor mostram o mesmo número | ✓ VERIFIED | `derive.ts:528-551`: depende só de `state`; soma lançamentos com `end`; desce por Subtarefas `ativo` em qualquer nível, com guarda de ciclo. `tempo-registrado.test.ts:56-73`: 30 + 45 + cronômetro aberto = 75 min, `emAndamento: true`; com Subtarefa de 20 min, `minutosComSubtarefas` 95. Linha ("Rastrear tempo", `tarefa-completa.tsx:1149`) usa `valorDaLinhaDeTempo(tempoRegistrado(...))` e o editor (`collaboration-editors.tsx:193-205`) usa `textoDoTempo(...)`, ambos de `tempo.ts`, com o mesmo `minutos()`. UAT T5, P3, P4 aprovados. |

**Pontuação:** 7/7 verdades verificadas, 0 presentes mas sem comprovação de comportamento. As verdades de transição de estado (converter marca o Item e cria a Subtarefa, a menção some ao fechar a Tarefa, o total cai com a Subtarefa na lixeira) têm teste de domínio que as exercita e passa; nenhuma ficou só por presença de símbolo.

### Decisões do dono (D-01..D-16)

| Decisão | Honrada? | Evidência |
|---|---|---|
| D-01 um clique, aviso, botão cor normal, sem digitação | Sim | `conversao-de-item.tsx` (sem `typedItem`, sem `destructive`); `tarefa-completa.tsx:762` é o `destructive` da lixeira, não da conversão |
| D-02 subitens fora do modelo | Sim | `parentItemId` ausente em todo o repositório; mensagem "Os N subitens migram…" fora |
| D-03 só com a Tarefa aberta | Sim | `cartao-de-tarefa.tsx` sem gesto de converter |
| D-04 `conversaoDeItemRecusada` primeiro, frase nova, `parentTaskId` removido de função e esquema | Sim | `derive.ts:581-595`, `tasks.ts:631-641`, `tarefas.ts:61` |
| D-05 botão só quando a derivada libera; `runConfirmado`; "Abrir" com id do servidor | Sim | `conversao-de-item.tsx`; `tarefa-completa.tsx:773-777` |
| D-06 `descriptionMentions` só Membro, derivada do texto, recusa Membro inexistente | Sim | `tasks.ts:1482-1516`; `tarefas.ts:29` |
| D-07 / D-08 aviso enquanto o nome estiver e a Tarefa aberta, sem "Dispensar", sem estado novo | Sim | `derive.ts:1393-1423`; nenhum campo de "visto" no tipo |
| D-09 união de retorno e invariante "sem `@Nome` nunca avisa" | Sim | `MencaoPendente`; filtro de leitura em `membrosMencionadosNaDescricao` |
| D-10 `before`/`after` cortados em 2.000 + "…" | Sim | `tasks.ts:1499`; `descricao-da-tarefa.ts` |
| D-11 expande embaixo da linha | Sim | `alteracao-de-descricao.tsx` |
| D-12 edição antiga sem botão | Sim | `temAlteracaoParaVer` |
| D-13 quem vê a Tarefa vê o texto | Sim | sem regra especial; recorte de `GET /estado` coberto por `derive-visibilidade.test.ts` e `dados-de-outro-membro.test.ts` (e2e) |
| D-14 integração nunca vê `before`/`after`/botão | Sim | `temAlteracaoParaVer`; `feed-de-atividade.tsx:247-248`; `timeline.tsx:286` |
| D-15 número da Tarefa + total com Subtarefas só quando existe | Sim | `textoDoTempo` (`comSubtarefas` só se `minutosComSubtarefas > minutos`) |
| D-16 só fechados + "em andamento", sem relógio | Sim | `tempoRegistrado` só lê `state` |

### Artefatos e ligações

| Artefato | Esperado | Status | Detalhes |
|---|---|---|---|
| `packages/dominio/src/derive.ts` | `conversaoDeItemRecusada`, `tempoRegistrado`, `pendingMentions` em união | ✓ VERIFIED | Substantivo, exportado, consumido por `tasks.ts`, telas e `resumo` |
| `packages/dominio/src/descricao-da-tarefa.ts` | corte, fronteira do `@Nome`, segmentos, trecho | ✓ VERIFIED | Módulo-folha (só importa tipos); usado por domínio e tela |
| `packages/dominio/src/operations/tasks.ts` | `convertChecklistItem` de 5 parâmetros, `updateTask` com menções e histórico | ✓ VERIFIED | Lido por inteiro nos trechos citados |
| `apps/api/src/rotas/esquemas/tarefas.ts` | esquema aceita `descriptionMentions`; conversão com 3 IDs | ✓ VERIFIED | `.strict()`; testes de esquema passam |
| `apps/web/src/features/estrutura/conversao-de-item.tsx` | botão e diálogo | ✓ VERIFIED | Importado e usado em `tarefa-completa.tsx:80,768,1729` |
| `apps/web/src/features/estrutura/mencoes.ts` | hook `useMencoes` | ✓ VERIFIED | Usado pela descrição e pelo Comentário |
| `apps/web/src/features/estrutura/descricao-da-tarefa.tsx` | descrição com nome destacado | ✓ VERIFIED | Usado em `tarefa-completa.tsx:925,929` |
| `apps/web/src/features/estrutura/tempo.ts` | formatador único | ✓ VERIFIED | Usado por linha e editor |
| `apps/web/src/features/tarefa/alteracao-de-descricao.tsx` | "Ver alteração" | ✓ VERIFIED | Usado em Feed e Timeline |

| De | Para | Via | Status |
|---|---|---|---|
| `convertChecklistItem` | `conversaoDeItemRecusada` | chamada antes de qualquer efeito | ✓ WIRED |
| `BotaoDeConversao` | `conversaoDeItemRecusada` | mesma derivada da operação | ✓ WIRED |
| `TaskTitleDescriptionEditor` | `updateTask` | `description` + `descriptionMentions: mencoes.mencoesEfetivas` | ✓ WIRED |
| `updateTask` | `Task.descriptionMentions` / `ActivityRecord.before,after` | gravação no mesmo bloco | ✓ WIRED |
| `notificacoes/page.tsx` | `pendingMentions` / `trecho` | `mencao.tipo === "descricao"` | ✓ WIRED |
| Linha "Rastrear tempo" e `TaskTime` | `tempoRegistrado` | `valorDaLinhaDeTempo` / `textoDoTempo` | ✓ WIRED |
| Feed e Timeline | `AlteracaoDeDescricao` | componente único | ✓ WIRED |

### Fluxo de dados (nível 4)

| Artefato | Variável | Fonte | Dado real? | Status |
|---|---|---|---|---|
| Linha/editor de tempo | `tempoRegistrado(state, task.id)` | `task.timeEntries` do estado hidratado | Sim | ✓ FLOWING |
| Notificações | `mencoes` de `pendingMentions` | `state.tasks`, `descriptionMentions`, `state.members` | Sim | ✓ FLOWING |
| "Ver alteração" | `record.before/after` | `state.activity` gravado por `updateTask`, recortado por `visibilidadePara` | Sim | ✓ FLOWING |
| Aviso "Abrir" | `resposta.value.id` | resposta do servidor (`runConfirmado`) | Sim | ✓ FLOWING |

### Cobertura de requisitos

| Requisito | Plano de origem | Descrição | Status | Evidência |
|---|---|---|---|---|
| TAR-01 | 11-01 | Recusa de conversão no domínio | ✓ SATISFIED | Verdade 1 |
| TAR-02 | 11-07 | Converter em um clique, só onde dá | ✓ SATISFIED | Verdade 2 |
| TAR-03 | 11-01, 11-08 | Checklist de um nível | ✓ SATISFIED | Verdade 3 |
| TAR-04 | 11-02, 11-05, 11-07, 11-08 | Menção na descrição | ✓ SATISFIED | Verdade 4 |
| TAR-05 | 11-04 | Aviso em Notificações | ✓ SATISFIED | Verdade 5 |
| TAR-06 | 11-02, 11-06, 11-08 | Texto anterior no histórico | ✓ SATISFIED | Verdade 6 |
| TAR-07 | 11-03, 11-07 | Tempo registrado no domínio | ✓ SATISFIED | Verdade 7 |

Os sete IDs declarados nos `requirements:` dos oito planos (11-01: TAR-01, TAR-03 · 11-02: TAR-04, TAR-06 · 11-03: TAR-07 · 11-04: TAR-05 · 11-05: TAR-04 · 11-06: TAR-06 · 11-07: TAR-02, TAR-04, TAR-07 · 11-08: TAR-03, TAR-04, TAR-06) estão todos em `REQUIREMENTS.md` (linhas 173-179, marcados `[x]`; linhas 267-273, "Complete"). Nenhum requisito órfão: `REQUIREMENTS.md` mapeia à Fase 11 exatamente TAR-01..TAR-07, e nenhum ficou sem plano. Observação de higiene (não bloqueia): os textos dos sete requisitos ainda terminam em "Pendente." na linha 173-179, apesar do `[x]`.

### Verificações de comportamento

| Comportamento | Comando | Resultado | Status |
|---|---|---|---|
| Tempo 75/95 min | `npx vitest run src/tempo-registrado.test.ts` | passa | ✓ PASS |
| Recusa de conversão e frase de nível | `npx vitest run src/operations/conversao-de-item.test.ts` | passa | ✓ PASS |
| Corte de 2.000 + "…" | `npx vitest run src/operations/descricao-da-tarefa.test.ts` | passa | ✓ PASS |
| Aviso some sozinho e não vaza | `npx vitest run src/operations/mencao-na-descricao.test.ts src/derive-visibilidade.test.ts` | passa | ✓ PASS |
| Telas: conversão, destaque, "Ver alteração", Notificações, tempo | `cd apps/web && npx vitest run ...` | 144 testes passam | ✓ PASS |
| Esquema da API aceita/rejeita as chaves | `DATABASE_URL= npx vitest run src/rotas/esquemas ...` | 96 testes passam | ✓ PASS |

### Probes

Nenhuma sonda declarada nos planos nem em `scripts/*/tests/probe-*.sh` para esta fase. Passo sem aplicação.

### Anti-padrões

Varredura nos arquivos de implementação da fase (`derive.ts`, `tasks.ts`, `descricao-da-tarefa.ts`, `conversao-de-item.tsx`, `alteracao-de-descricao.tsx`, `tempo.ts`, `mencoes.ts`): sem `TBD`/`FIXME`/`XXX` sem referência, sem retorno vazio que alimente a tela, sem `console.log` como implementação. Nenhum bloqueador.

### Itens que exigiriam humano

Contraste do destaque, "sensação de um clique", "Abrir" levando à Subtarefa certa, aviso para a pessoa mencionada, textos novos e as premissas P1..P8 foram aprovados pelo dono na UAT de 29/10/2026 (`11-PROVAS.md`: U1..U6, P1..P8, T1..T6, sem ajuste pedido). O código não contradiz nenhum deles. Registrados como verificados pelo dono, não como pendentes.

## Revisão de código (WR-01..04): nenhuma derruba requisito ou decisão

Todas as oito constatações de `11-REVIEW.md` estão `open` em `11-REVIEW-DISPOSITION.md` (0 críticas). Julgamento:

| Achado | Derruba requisito ou decisão? | Observação |
|---|---|---|
| WR-01 `pendingMentions` pega o "mais recente" por posição em `state.activity` (`derive.ts:1415`) | Não | Só afeta a ordem da lista em TAR-05/P8; que a menção apareça, o trecho, o filtro de visibilidade e o desaparecimento não dependem disso. Em sessão ao vivo (`unshift`) está correto; um estado semeado com `push` ou importado pode ordenar pelo registro mais velho. Registrado acima como `coincidental_reliance_items` (ordenação incidental), consultivo. Correção barata: `newestFirst(...)[0]`. |
| WR-02 `linkDoAviso` sobrevive ao aviso | Não | O fluxo de TAR-02/D-05 (converter, ver o aviso, clicar "Abrir", abrir a Subtarefa nova) funciona e foi aprovado em U2. O defeito é um "Abrir" velho aparecendo num aviso posterior, depois de um erro de conversão. Robustez de interface. |
| WR-03 sem guarda de duplo envio no diálogo | Não | O servidor impede Subtarefa duplicada (`item.converted`); o pior caso é uma mensagem de erro enganosa depois de uma conversão que deu certo. D-01 (um clique) segue valendo. |
| WR-04 diálogo some em silêncio se o Item já foi convertido; `?converter-item=` fica na URL | Não | O caso comum de dois navegadores (cópia local velha) é tratado e chega ao `onErro`. Só o caso de reidratação com o diálogo aberto some sem aviso. |
| IN-01..IN-04 | Não | Alinhamento do ícone de lixeira, retorno ignorado de `aoTeclar` (seguro hoje), fronteira da menção (`@Ana` dentro de `@Ana Lima`, por desenho de D-09), cliente antigo com 4 argumentos recebe 400. |

Recomendação: levar WR-01..04 para uma passada de acabamento (ou `/gsd-code-review-fix`) antes do PR, sem bloquear o fechamento da fase.

## Resumo de lacunas

Nenhuma lacuna. Os sete requisitos (TAR-01..TAR-07) e as dezesseis decisões (D-01..D-16) estão no código, ligados de ponta a ponta e cobertos por testes que passaram nesta verificação sem banco. A suíte cheia e o e2e contra Postgres local, a conferência A1 = 0 em produção e a UAT do dono estão registrados em `11-PROVAS.md`. Segurança (`11-SECURITY.md`, 21/21 ameaças fechadas), Nyquist (`11-VALIDATION.md`, conforme) e a auditoria de UI (`11-UI-REVIEW.md`, 17/24, consultiva) não trazem bloqueador. A ordem de dependência (domínio, depois API, depois tela) foi respeitada, e nenhuma migração foi necessária.

---

_Verificado: 2026-10-29_
_Verificador: Claude (gsd-verifier)_
