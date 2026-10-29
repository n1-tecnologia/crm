# Phase 11: Clone ClickUp: Tarefa (checklist, descrição e tempo) - Research

**Researched:** 2026-10-29
**Domain:** agregado Tarefa (`@n1/dominio`), esquemas de `apps/api`, tela da Tarefa em `apps/web` (React 19 / Next 16, mas esta fase não mexe em rota nem em convenção de página)
**Confidence:** HIGH — todo fato de código foi lido nesta sessão, com `arquivo:linha`. As únicas peças sem prova são marcadas `[ASSUMED]` e estão no Assumptions Log.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 (2.4.3, escolha B):** **Converter confirma com um clique, com aviso.** A confirmação diz que não há volta e o botão "Converter" fica na cor normal. **Some a digitação do nome do item** (`typedItem`, `confirmDisabledReason`, o `Field` com `TextInput`) e o `destructive` do `ConfirmDialog`. Descartadas: manter a digitação (assusta e o ClickUp não faz); converter direto sem confirmação (um clique errado deixa uma Subtarefa a mais). O comentário de `tarefa-completa.tsx` (~207–211, "exige digitar o nome do Item") precisa ser reescrito junto.
- **D-02 (2.4.4, escolha B):** **Subitens de checklist ficam fora do modelo.** O checklist tem **um nível só**. Sai `ChecklistItem.parentItemId` de `types/structure.ts` e saem todos os usos: o ramo de subitens de `convertChecklistItem` (`tasks.ts:640` e `:660–672`), o filtro de subitens em `removeChecklistItem` (`tasks.ts:~1090`), `derive.ts` (`:502`, `:687`), `tarefa-publica.ts:70`, `operations/planning.ts:262`, `operations/collaboration.ts:424` e os usos da tela (`tarefa-completa.tsx:~1662`, `:~1693`, `:~2325`). O planejador confere por `grep -rn parentItemId` que nada sobra e que `hidratar` e os esquemas não rejeitam a chave caso algum registro antigo a traga (o scout não achou subitem em seed nenhum nem operação que o crie). A mensagem "Os N subitens migram…" da confirmação sai. Descartada: criar subitens de verdade (cerca de 1 dia). Se um dia quiser subitens, voltam como trabalho novo.
- **D-03 (2.4.5, escolha B):** **Converter só com a Tarefa aberta** (página, popup ou gaveta, todos por `tarefa-completa.tsx`). O cartão do Quadro (`cartao-de-tarefa.tsx`) **não ganha menu**: continua só com "Checklist N de M". Nada a construir; o teste de pronto é que o cartão não tenha o gesto.
- **D-04 (2.4.1, do documento, travado):** `conversaoDeItemRecusada(state, actingMemberId, taskId)` em `derive.ts` devolve o motivo ou `undefined`: sem escrita na Tarefa, `features.subtarefas` desligada na Lista, ou `taskLevel(state, task) + 1 > state.workspace.maxSubtaskDepth`. `convertChecklistItem` chama essa função primeiro. A mensagem de nível passa a ser **"Esta Tarefa já está no nível N, o último permitido. O item não pode virar Subtarefa aqui."** (a de hoje pede uma escolha que a tela não oferece). O planejador decide se mantém o 6º parâmetro opcional `parentTaskId` de `convertChecklistItem` (e o `opcional(ID)` no esquema `convertChecklistItem` de `esquemas/tarefas.ts`): se ficar, a função de recusa e a operação precisam concordar sobre qual Tarefa pai vale.
- **D-05 (2.4.2, do documento, travado):** o botão "Converter em Subtarefa" **só aparece** quando `conversaoDeItemRecusada` devolve `undefined` (some em Lista sem Subtarefas e em Tarefa no último nível), na cor normal (sai `style={{ color: "var(--erro)" }}`). Converter usa `runConfirmado` (não `run`) e o aviso traz o link **"Abrir"** para a Subtarefa, com o id que o servidor devolveu.
- **D-06 (2.6.6, do documento, travado):** `Task.descriptionMentions?: { type: "member"; id: Id }[]` em `types/structure.ts`. `UpdateTaskInput` (`tasks.ts:1473`) ganha `descriptionMentions`; `updateTask` grava junto com a descrição e **recusa Membro inexistente**, como `addTaskComment` faz. Esquema de `updateTask` em `apps/api/src/rotas/esquemas/tarefas.ts` atualizado. A lógica do "@" do `CommentComposer` (`task-editors.tsx:~491–540`, `useMencoes`) vira o hook `useMencoes` em `features/estrutura/mencoes.ts` e o editor da descrição o usa. Na Tarefa completa o nome mencionado aparece **destacado** na descrição. **Só Membro** nesta fase (a ontologia, RN-TAR-14, prevê também Equipe, Agente, Tarefa, Contato e outros: ver Deferred). A lista é **derivada do texto**: só conta o Membro cujo `@Nome` ainda está na descrição no momento de gravar (mesmo padrão do Comentário: `mencoes.filter((m) => texto.includes('@' + m.nome))`).
- **D-07 (2.6.7, escolha B):** **A menção na descrição avisa a pessoa.** Ela aparece em Notificações › "Menções a você" **enquanto o nome estiver na descrição e a Tarefa estiver aberta** (fora de categoria terminal), sujeita a `ver` (RN-TAR-14: `memberSeesTask`, como `pendingMentions` já faz). `pendingMentions` (`derive.ts:1293`) passa a ler também `descriptionMentions`; a tela de Notificações mostra o **trecho da descrição**. A descrição não tem autor próprio (ontologia, `tarefa.md`:68), então o aviso diz "na descrição de X", sem "por quem". A regra sai do dado: **nada de estado novo guardado.**
- **D-08:** **O aviso da descrição sai só por conta própria**: some quando a Tarefa fecha, sai da lista, ou alguém tira o nome da descrição. **Sem botão "Dispensar"** e sem registro de "já vi" por pessoa. Descartado: dispensar por Membro (exigiria dado novo e decidir se o aviso volta quando o texto muda). Consequência aceita: a pessoa mencionada fica com o aviso até uma dessas três coisas acontecer.
- **D-09 (consequência no código, não pergunta ao dono):** `pendingMentions` hoje devolve `{ task, comment }` e três lugares dependem dessa forma: `derive.ts:~1378` (`resumo`, que monta `observadas` com `m.comment.id`), a página de Notificações e o Início. O retorno passa a ser uma união (menção de Comentário | menção de descrição) e esses consumidores acompanham. Garantir a invariante: **uma menção sem o "@Nome" no texto nunca avisa**, mesmo que a descrição tenha sido mudada por um caminho que não é `updateTask` (modelo/Template, duplicação, Formulário, Automação, link público). O planejador mapeia os escritores de `Task.description` e escolhe entre recalcular a lista em cada escrita ou filtrá-la na leitura.
- **D-10 (2.6.8, do documento, travado):** em `tasks.ts:~1511`, "Descrição alterada" passa a gravar `before` e `after` com a descrição antiga e a nova, **cortadas em 2.000 caracteres com "…" no fim**. Em `features/tarefa/timeline.tsx` a ação "Descrição alterada" mostra só "Descrição alterada" e um botão **"Ver alteração"**; não entra mais o `(antes → depois)` no meio da frase para essa ação.
- **D-11:** **"Ver alteração" abre ali mesmo, embaixo da linha** (a linha se expande e mostra o texto anterior e o novo, um embaixo do outro; clicar de novo recolhe). Descartada: abrir numa janela (interrompe a leitura do histórico).
- **D-12:** **Edições antigas ficam como hoje, sem botão.** O botão "Ver alteração" só aparece em registro que tem `before`/`after`. Nada é inventado nem migrado.
- **D-13:** **Quem vê a Tarefa vê o texto anterior e o novo**, a mesma regra de todo o histórico (como já vale para o título). Sem regra de visibilidade só para este campo. **Consequência aceita pelo dono:** se alguém apagar da descrição um dado sensível (valor, CPF), ele continua no histórico. — **Reversibility:** costly — parar de guardar o texto é barato daqui para a frente, mas o que já foi gravado em registros de Atividade continua lá, e apagá-lo exigiria varrer esses registros.
- **D-14 (consequência no código, não pergunta ao dono):** o Ator de integração **nunca** mostra `before`/`after`/`detail` na linha do tempo (`timeline.tsx:~282`, T-02-10: podem carregar payload, CPF/CNPJ ou URL assinada). O botão "Ver alteração" respeita a mesma regra e **não aparece para Ator de integração**. O planejador confere, no recorte de `GET /estado` da Fase 9 (SEG-01), que o registro de Atividade com texto de descrição não chega a quem não enxerga a Tarefa.
- **D-15 (escolha "o da Tarefa, e o total ao lado"):** `tempoRegistrado(state, taskId)` em `derive.ts` devolve `{ minutos, lancamentos, emAndamento, minutosComSubtarefas }`. A linha "Rastrear tempo" (`tarefa-completa.tsx:~1199`) e o editor `TaskTime` (`collaboration-editors.tsx:~199`) **mostram o número da Tarefa** (`minutos`) e, **só quando alguma Subtarefa tem tempo**, um segundo número discreto "N min com Subtarefas" (`minutosComSubtarefas`). Casa com a ontologia (`tarefa.md`:114–115): "Tempo registrado" é sem Subtarefas e "Tempo registrado agregado" inclui as Subtarefas, dois derivados distintos. Descartadas: mostrar só o da Tarefa (a mãe não mostra o esforço total) e mostrar sempre o total (quem lançou 75 min não reconhece o número na própria Tarefa). A linha e o editor mostram **o mesmo número**, formatado do mesmo jeito.
- **D-16 (cronômetro aberto):** **O número soma só os lançamentos fechados e ganha a etiqueta "em andamento"** quando há cronômetro aberto (`emAndamento: true`). O tempo corrido só entra quando a pessoa para. A função **não depende do relógio** (só de `state`), então Painéis e IA leem sempre o mesmo número. Descartado: somar o tempo corrido ao vivo (o número mudaria sozinho e o domínio passaria a depender de `now`). O `TaskTime` já tem o cronômetro ao vivo do próprio lançamento aberto (`useAgora`); isso continua como está, à parte do total.

### Claude's Discretion

- Nomes de módulos, esquemas e testes (`mencoes.ts`, `tempo-registrado.test.ts`, os testes de recusa); onde mora o componente que mostra a descrição com o nome destacado. `tarefa-completa.tsx` tem **2.371 linhas**: preferir um componente próprio a engordar o arquivo.
- Texto exato da confirmação de converter, do aviso com "Abrir", do trecho da descrição em Notificações, das etiquetas "em andamento" e "N min com Subtarefas".
- Formato do número de tempo ("135 min" ou "2 h 15 min"): usar **o mesmo formatador** (`minutos()` de `collaboration-editors.tsx`) na linha e no editor, para os dois mostrarem a mesma coisa.
- Como o "Ver alteração" rotula os dois blocos expandidos (por exemplo "Antes" e "Depois") e o destaque visual do nome mencionado.
- Forma exata da união que `pendingMentions` devolve; se a lista de `descriptionMentions` é recalculada na escrita ou filtrada na leitura (D-09).
- Se `convertChecklistItem` mantém o parâmetro `parentTaskId` (D-04).
- Quantos planos e em que ondas, respeitando domínio antes de API antes de tela. Observação de sequência: **2.6.6 e 2.6.8 mexem no mesmo bloco da descrição em `updateTask`** (e 2.4.1/2.6.7/2.6.9 em `derive.ts`; 2.4.2/2.6.6/2.6.9 em `tarefa-completa.tsx`): ou vão no mesmo plano ou em ondas sequenciais, nunca em paralelo no mesmo arquivo.

### Deferred Ideas (OUT OF SCOPE)

- **Menção a Equipe, Agente, Tarefa, Contato, Empresa, Negócio, Conversa ou Documento de Conhecimento na descrição** (a ontologia, RN-TAR-14, prevê): a fase entrega só Membro, como o Comentário. Menção a outro registro "só cria referência navegável" e merece fase própria.
- **Subitens de checklist** (D-02 os tirou): voltariam como trabalho novo, cerca de 1 dia (domínio, esquema da API e tela), incluindo subitem que vira Subtarefa.
- **Converter pelo cartão do Quadro** (D-03 descartou): menu no cartão com os itens do checklist, cerca de meio dia de tela.
- **Botão "Dispensar" na menção da descrição** (D-08 descartou): exige guardar quem dispensou o quê.
- **Restringir "Ver alteração" a quem edita** (D-13 descartou): regra de visibilidade só para este campo do histórico.
- **Itens da 2.7 sobre a Tarefa**: nenhum trazido pelo dono; se aparecerem antes de planejar, entram um por subtarefa.
</user_constraints>

<phase_requirements>
## Phase Requirements

O ROADMAP deixou "Requirements: TBD". Os IDs abaixo são os propostos pelo `11-CONTEXT.md` ("Requisitos derivados") e valem como IDs da fase. `REQUIREMENTS.md` ainda não tem o prefixo `TAR` (confirmado: nenhuma seção "Fase 11"): o planejador abre a seção `### Fase 11 — Tarefa (TAR)` e troca o "TBD" do ROADMAP.

| ID | Descrição | Research Support |
|----|-----------|------------------|
| TAR-01 | `conversaoDeItemRecusada` devolve motivo para Lista sem Subtarefas, Tarefa no nível máximo e quem não escreve; `undefined` numa Tarefa de 1º nível com Subtarefas; mensagem nova na recusa de `convertChecklistItem` | §Q2: `taskWriteRefusal`, `effectiveListConfig`, `taskLevel` já existem em `derive.ts`; ninguém passa o 6º parâmetro |
| TAR-02 | Botão só onde dá, cor normal, confirmação de um clique, aviso com "Abrir", cartão sem gesto | §Q7: bloco de conversão e `runConfirmado` mapeados; o aviso de `tarefa-completa.tsx` já tem o padrão do link "Abrir" |
| TAR-03 | `grep -rn parentItemId packages apps` sem achados; sem ramo de subitens | §Q1: lista completa: 17 linhas de código em 8 arquivos (a tabela da Q1 agrupa em 12 itens) |
| TAR-04 | `updateTask` grava `descriptionMentions` e recusa Membro inexistente; "@Jú" abre o menu; nome destacado | §Q3, §Q7: editor da descrição é `<textarea>` de texto puro |
| TAR-05 | Notificações mostra a menção da descrição enquanto o nome está lá e a Tarefa está aberta; segue `ver` | §Q3, §Q4: filtro na leitura num helper único; consumidores da união mapeados |
| TAR-06 | `before`/`after` cortados em 2.000 + "…"; "Ver alteração" expande; sem botão em registro antigo e em Ator de integração | §Q5: **quatro** telas imprimem `antes → depois` (não só `timeline.tsx`) |
| TAR-07 | `tempoRegistrado` fechado + `emAndamento` + `minutosComSubtarefas`; linha e editor mostram o mesmo número | §Q6: as duas somas de hoje divergem (formato e contagem); só elas somam tempo |
</phase_requirements>

## Summary

A fase é quase toda **subtração e costura**: `ChecklistItem.parentItemId` sai (17 linhas de código em 8 arquivos, nenhuma em seed ou operação que o crie), a recusa de conversão sobe de dentro de `createTask` para um derive que a tela também chama, e três derivados novos nascem em `derive.ts` (`conversaoDeItemRecusada`, `tempoRegistrado`, a leitura das menções da descrição). Nenhuma operação nova entra no `REGISTRO`, então a tabela "Quem pode" (`packages/dominio/CONTEXT.md`) e `quem-pode.test.ts` não mudam. **Nenhuma migração SQL é necessária** (Q10): `hidratar` empurra o jsonb cru para o estado sem validar nada, e os esquemas de `apps/api` só validam `args`, nunca o que está guardado.

Dois achados mudam o plano em relação ao `11-CONTEXT.md`. **(1)** O `(antes → depois)` da descrição não é impresso só por `timeline.tsx`: a `Timeline` só vale para a Lista de Solicitação de pagamento (`ehSolicitacaoDePagamento = task.listId === CP.listId`, `tarefa-completa.tsx:324`); **toda outra Lista usa `FeedDeAtividade`** (`feed-de-atividade.tsx:197`), e a página de Auditoria (`auditoria/page.tsx:280–282`) e a página de Reunião (`ActivityTimeline`, `design/components.tsx:1338–1341`) também imprimem `before → after` inline. Sem tratar os quatro, a primeira edição de descrição derrama até 4.000 caracteres no meio da frase em quase toda Tarefa. **(2)** O invariante "menção sem `@Nome` no texto nunca avisa" **não se garante por recalcular na escrita**: há escritores que não passam por `updateTask` (rollback em `financeiro.ts:1262`, clone de recorrência em `collaboration.ts:610`), então o filtro na leitura, num helper único em `derive.ts`, é o que fecha o invariante; `updateTask` refiltra por higiene.

**Primary recommendation:** domínio primeiro e em duas ondas sequenciais (Onda 1: checklist/conversão; Onda 2: descrição, histórico, menções, tempo), depois `apps/api` (uma linha de esquema por onda), depois a tela com **um único plano dono de `tarefa-completa.tsx`**; cada plano com os comandos rápidos da seção Validation Architecture (segundos, nunca `npm test`).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Recusa de conversão (`conversaoDeItemRecusada`) | `@n1/dominio` (derive) | Web (esconde o botão), API (a operação recusa) | A tela e o endpoint precisam da mesma frase (regra da raiz: "as mesmas regras valem nos dois lados") |
| Remoção de `parentItemId` | `@n1/dominio` (tipo, derives, operações) | Web (3 usos), API (nada) | O tipo é do domínio; a API não valida `ChecklistItem` |
| Gravar `descriptionMentions` | `@n1/dominio` (`updateTask`) | API (esquema de transporte) | Validação de existência do Membro é regra; o esquema só dá a forma |
| Menção da descrição avisa | `@n1/dominio` (derive) | Web (Notificações, sino, Início) | Nada de estado novo: sai do dado, filtrado por `memberSeesTask` |
| Texto anterior no histórico | `@n1/dominio` (`updateTask` grava `before`/`after`) | Web (4 renderizadores) | O corte de 2.000 é do dado; "Ver alteração" é só apresentação |
| `tempoRegistrado` | `@n1/dominio` (derive) | Web (linha + `TaskTime`) | "O mesmo número em toda tela" exige uma função só |
| Hook `useMencoes`, destaque do nome | Web | — | Comportamento de campo de texto |
| Visibilidade do histórico (D-13/D-14) | API (`visibilidadePara` já corta) | Web (Ator de integração) | Corte por `objectId` já existe; ver Q5 |

## Standard Stack

Nenhum pacote novo. A fase usa só o que o repositório já tem.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | 5.0.1 (saída de `npx vitest run` desta sessão) | testes dos três workspaces | já é o runner; `packages/dominio/vitest.config.mts` e `apps/api/vitest.config.mts` incluem `src/**/*.test.ts` |
| zod | `^4.6.1` (`packages/dominio/package.json`) | forma dos `args` em `apps/api/src/rotas/esquemas/` | convenção da pasta: `.strict()`, `satisfies Esquemas` |
| @testing-library/react + jsdom | já instalados (usados em `timeline.test.tsx`) | testes de componente | pragma `// @vitest-environment jsdom` na 1ª linha do arquivo |

### Supporting / Alternatives
Nenhuma. Não há `markdown-it`, editor rico nem biblioteca de menção: a descrição é `string` e o destaque é uma divisão de texto em `<span>` (ver Don't Hand-Roll).

**Installation:** nenhuma.

## Package Legitimacy Audit

Esta fase **não instala pacote externo**. Nada a auditar. Packages removed due to [SLOP]: none. Packages flagged [SUS]: none.

## Architecture Patterns

### System Architecture Diagram

```
EDITAR A DESCRIÇÃO (2.6.6 / 2.6.8)
 textarea "@" ──useMencoes──> { texto, descriptionMentions(escolhidos ∩ texto) }
      │ salvar
      ▼
 run(updateTask(taskId, {title, description, descriptionMentions}))   [web: cópia local]
      │  POST /operacoes/updateTask  (esquema zod .strict(): aceita a chave nova)
      ▼
 updateTask [domínio] ── taskWriteRefusal ── valida Membros ── refiltra lista pelo texto
      │                                      │
      │ grava Task.description + Task.descriptionMentions (jsonb em plataforma.registros)
      ▼
 recordActivity("Descrição alterada", before=corta(antiga,2000), after=corta(nova,2000))
      │
      ├──> GET /estado → visibilidadePara: activity.filter(!ocultos.has(objectId))
      │         └─> web: Timeline | FeedDeAtividade | Auditoria | Reunião
      │                 "Descrição alterada" + [Ver alteração] (sem botão p/ Ator de integração)
      └──> derive: membrosMencionadosNaDescricao(state, task)  ← filtro na LEITURA
                  └─> pendingMentions(state, memberId)  [memberSeesTask + Tarefa aberta]
                        └─> notificacoesDoMembro → sino(total) · Notificações · Início(count)

CONVERTER ITEM (2.4.x)
 tarefa-completa ── conversaoDeItemRecusada(state, me, task.id) === undefined ? mostra botão
      │ clique → ConfirmDialog (1 clique, sem destructive)
      ▼
 runConfirmado(convertChecklistItem(task, checklist, item)) ── local.ok? fecha diálogo
      └─ confirmado.then(r ⇒ aviso "…Abrir" → /estrutura/tarefas/<r.value.id>)   [id do SERVIDOR]

TEMPO (2.6.9)
 tempoRegistrado(state, taskId) ─> { minutos, lancamentos, emAndamento, minutosComSubtarefas }
      ├─> linha "Rastrear tempo" (tarefa-completa)   └─> TaskTime "Total registrado"  [mesmo minutos()]
```

### Recommended Project Structure
```
packages/dominio/src/
├── derive.ts                    # + conversaoDeItemRecusada, tempoRegistrado,
│                                #   membrosMencionadosNaDescricao, pendingMentions (união)
├── tempo-registrado.test.ts     # novo (TAR-07)
└── operations/
    ├── tasks.ts                 # convertChecklistItem, removeChecklistItem, updateTask
    ├── conversao-de-item.test.ts      # novo (TAR-01/03)
    └── descricao-da-tarefa.test.ts    # novo (TAR-04/05/06)
apps/web/src/features/
├── estrutura/mencoes.ts         # useMencoes (+ funções puras arrobaEmCurso/normalizar)
├── estrutura/descricao-da-tarefa.tsx   # leitura com @Nome destacado (componente próprio)
├── estrutura/conversao-de-item.tsx     # diálogo de conversão extraído de tarefa-completa
├── estrutura/tempo.ts           # minutos() exportado, uma só cópia
└── tarefa/alteracao-de-descricao.tsx   # "Ver alteração" compartilhado por Timeline e Feed
```

### Pattern 1: derive novo recebe `state` e nunca lê o relógio
**What:** todo derivado desta fase é função pura de `state` (D-16 trava isso para `tempoRegistrado`). **Example (esqueleto; valores conferidos nas citações de Q2/Q4/Q6):**
```typescript
// derive.ts — logo abaixo de taskLevel (:509)
export function conversaoDeItemRecusada(state: DataState, actingMemberId: Id, taskId: Id): string | undefined {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) return "Tarefa não encontrada.";
  const escrita = taskWriteRefusal(state, actingMemberId, taskId);
  if (escrita) return escrita;
  if (!effectiveListConfig(state, task.listId)?.features.subtarefas) return "Esta Lista não usa Subtarefas.";
  const nivel = taskLevel(state, task);
  if (nivel + 1 > state.workspace.maxSubtaskDepth) {
    return `Esta Tarefa já está no nível ${nivel}, o último permitido. O item não pode virar Subtarefa aqui.`;
  }
  return undefined;
}
```

### Anti-Patterns to Avoid
- **Duplicar a regra do "@" em terceiro lugar.** Já existem duas cópias (`CommentComposer`, `task-editors.tsx:~475–540`; `Compositor`, `timeline.tsx:~350–420` com `arrobaEmCurso` e `normalizarBusca`). O hook novo é a terceira consumidora; extraia as **funções puras** (`arrobaEmCurso`, `normalizar`) para `mencoes.ts` e deixe a refatoração do `Compositor` da timeline para depois (tem 10 testes de seletor em `timeline.test.tsx`).
- **Guardar o resultado do filtro de menção no `pendingMentions` como estado.** D-07 proíbe estado novo.
- **Testar `tarefa-completa.tsx` inteira.** Nenhum teste a renderiza hoje (grep em `*.test.ts(x)`: zero); extraia o diálogo de conversão e o componente da descrição e teste esses.

## Findings por pergunta do planejador

### Q1 — D-02 / TAR-03: remover `ChecklistItem.parentItemId`

**Lista completa** (`grep -rn parentItemId packages apps docs ontologia .planning/phases`, rodado nesta sessão; `[VERIFIED: grep + leitura]`):

| # | Arquivo:linha | Hoje (verbatim) | O que fazer |
|---|---|---|---|
| 1 | `packages/dominio/src/types/structure.ts:318` | `  readonly parentItemId?: Id;` | apagar a linha |
| 2 | `packages/dominio/src/operations/tasks.ts:640` | `if (item.parentItemId) return fail("Só um Item de primeiro nível vira Subtarefa.");` | apagar |
| 3 | `tasks.ts:660–672` | bloco "B48 — the subitems migrate…": `checklist.items.filter((i) => i.parentItemId === item.id)`, `parentItemId: undefined`, `checklist.items.filter((i) => i.parentItemId !== item.id)` | apagar o bloco inteiro; `nextId("chk")` deixa de ser usado ali |
| 4 | `tasks.ts:1090–1091, 1102–1104` | `const subitens = checklist.items.filter((i) => i.parentItemId === itemId);` e o `detail` com `Subitem(ns) removido(s) com ele` | `removeChecklistItem` remove só o item; `detail: checklist.name`; atualizar o docstring `:1069` ("Remover um Item remove os seus Subitens") |
| 5 | `derive.ts:502` | `c.items.filter((i) => i.parentItemId === undefined && i.converted === undefined),` | `i.converted === undefined` |
| 6 | `derive.ts:687` | `(item) => item.parentItemId === undefined && item.converted === undefined && !item.done,` | `item.converted === undefined && !item.done` |
| 7 | `tarefa-publica.ts:70` | `… c.items.filter((i) => !i.converted && !i.parentItemId)…` | `!i.converted` |
| 8 | `operations/planning.ts:262` | `… c.items.filter((i) => !i.converted && !i.parentItemId).sort(…)` | `!i.converted` |
| 9 | `operations/collaboration.ts:424` | `...(i.parentItemId && ids.has(i.parentItemId) ? { parentItemId: ids.get(i.parentItemId)! } : {}),` | apagar; o `Map` `ids` (`:412`) vira `nextId("cki")` direto |
| 10 | `operations/remover-checklist-e-item.test.ts:43–44` (+ teste `:41–53`, comentário `:5`) | itens `cki_sub_a`/`cki_sub_b` com `parentItemId: "cki_3"` | apagar o teste "leva os Subitens junto e diz quantos foram" |
| 11 | `apps/web/.../tarefa-completa.tsx:1662, 1693` | `item.parentItemId === undefined &&` / `.filter((item) => item.parentItemId === undefined)` | tirar o filtro |
| 12 | `tarefa-completa.tsx:2325, 2328` | helper `subitemsOf(items, itemId)` | apagar o helper; ele tem **dois** chamadores: `:435–437` (diálogo de conversão) e `:832, :842` (diálogo de **remoção**, "O subitem vai junto") — o `11-CONTEXT.md` só cita a conversão |

Fora do código: `docs/09-planejamento/TAREFAS-POR-SESSAO.md:652–655` e `docs/09-planejamento/dados/parte-b.mjs:427–430` descrevem a decisão (não mexer; são o enunciado). `ontologia/` não usa o identificador `parentItemId` (grep: 0), mas usa o **conceito**: `ontologia/02-estrutura-de-trabalho/checklist.md` (22 linhas com "Subitem": §6.2, §7.2, INV-CHK-03, DO-CHK-04/06), `GLOSSARIO.md` (3), `tarefa.md` (1), `MATRIZ-DE-RELACOES.md` (1), `DECISOES-E-PENDENCIAS.md` B48. **A divergência ontologia × implementação precisa ser registrada ao fechar a fase** (D-02 já pede).

**Seed / operação que cria subitem:** nenhuma. `addChecklistItem` (`tasks.ts:950`) recebe `(state, actingMemberId, taskId, checklistId, text)` e empurra `{ id, text, order, done }`; o esquema (`esquemas/tarefas.ts:67`) é `z.tuple([ID, ID, z.string()])`; `instantiateTaskTemplate` (`planning.ts`) cria itens `{ id, text, order, done: false }`; `copyChecklist` só copia `parentItemId` se a origem já o tiver. O único lugar que escreve a chave é o teste do item 10. `[VERIFIED: leitura dos três escritores + grep]`.

**`hidratar` e esquemas rejeitam ou guardam a chave?** Nenhum dos dois rejeita. `hidratar` (`apps/api/src/persistencia/repositorio.ts:63–101`) faz `lista.push(linha.dados)` do jsonb cru, sem `parse`; `gravar` compara `canonico(...)` registro a registro, então um registro que ninguém regrava **mantém a chave para sempre**. Os esquemas de `apps/api/src/rotas/esquemas/` validam só os `args` de `POST /operacoes/:nome`, e `ChecklistItem` nunca aparece num esquema (`addChecklistItem` recebe só ids e string); não há esquema de resposta (`rotas/estado.ts` comenta: "Sem schema de resposta zod"). **Efeito de um registro velho com a chave:** depois da remoção, o item deixa de ser filtrado como subitem e passa a contar como item de 1º nível no progresso (`checklistProgress`) e a aparecer na lista. Em produção isso é `[ASSUMED]` zero linhas (ver A1): a conferência é uma consulta só de leitura, `select count(*) from plataforma.registros where colecao = 'tasks' and dados::text like '%parentItemId%'`, que o executor roda num Postgres local ou o dono roda no Supabase antes de aplicar.

### Q2 — D-04 / TAR-01: `conversaoDeItemRecusada` e o 6º parâmetro

**`convertChecklistItem` hoje** (`tasks.ts:624–690`, lido): assinatura `(state, actingMemberId, taskId, checklistId, itemId, parentTaskId?)`; ordem das recusas: Tarefa não encontrada → `mayWriteTask` → Item não encontrado → `Este Item já foi convertido.` → `parentItemId` (sai) → `parent = parentTaskId ?? task.id` → `Tarefa pai não encontrada.` → nível; só então `createTask`, que repete duas recusas (`tasks.ts:138` `if (!config.features.subtarefas) return fail("Esta Lista não usa Subtarefas.");` e o limite de profundidade, `:140–145`).

**Mensagem de nível de hoje** (`tasks.ts:~650`): ``Converter aqui criaria o nível ${level}. Escolha outra Tarefa pai ou converta a partir de um nível acima.`` onde `level = taskLevel(state, parentTask) + 1`. O teste que a prova **vai quebrar**: `operations.test.ts:~270–280` faz `expect(result.error).toContain("nível 4");` para `tsk_seed_8`. Com a mensagem nova (`nível ${taskLevel}` = 3, porque `maxSubtaskDepth: 3` em `seed.ts:2099` e a cadeia `tsk_seed_3 → 6 → 7 → 8` dá nível 3) a asserção passa a ser `toContain("nível 3")` e `toContain("o último permitido")`. O `N` da frase é o nível **da própria Tarefa** (a tela já escreve `Subtarefa · nível {level}` em `tarefa-completa.tsx:993`, com `level = taskLevel(state, task)`).

**Peças que o derive reutiliza** (todas já exportadas de `derive.ts`): `taskWriteRefusal` (`:1137`; é o que `mayWriteTask` embrulha, `tasks.ts:1259–1261`), `effectiveListConfig` (`:183`), `taskLevel` (`:509`). `features.subtarefas` é `subtarefas: boolean;` em `types/structure.ts:102`. O limite é `maxSubtaskDepth: number;` em `types/workspace.ts:223`.

**Quem chama o 6º parâmetro `parentTaskId`:** ninguém. Chamadas de `convertChecklistItem`: web `tarefa-completa.tsx:411` (`convertChecklistItem(data, memberId, task.id, checklistId, itemId)`, 5 argumentos), testes `operations.test.ts:268, 284` e `remover-checklist-e-item.test.ts:56` (todos 5 argumentos); não existe Ferramenta de IA, contrato (`contratos/`) nem rota REST que a chame (grep em `packages apps docs`). Só o esquema aceita o 4º elemento: `convertChecklistItem: z.tuple([ID, ID, ID, opcional(ID)]),` (`esquemas/tarefas.ts:59`).

**Recomendação:** **remover o parâmetro** da função e do esquema (`z.tuple([ID, ID, ID])`). Se ficasse, `conversaoDeItemRecusada(state, me, taskId)` só avalia a Tarefa que contém o item, e a operação avaliaria outro pai: duas verdades. Sem chamador, não há compatibilidade a preservar; o `registro.test.ts` só confere `length >= 2` e a instrumentação. Se o planejador preferir manter, o contrato é: o derive ganha um 4º parâmetro opcional `parentTaskId` e ambos usam `parentTaskId ?? taskId`. **Reforço opcional (não travado):** acrescentar um 4º motivo ao derive, `effectiveLifecycleOfTask(state, taskId) !== "ativo"` → `"Esta Tarefa não está ativa. Restaure-a para editá-la."` (mesma frase de `requireActiveTask`, `tasks.ts:~1441`), porque hoje `convertChecklistItem` é a única escrita de checklist sem essa checagem (`addChecklistItem` e `removeChecklistItem` a têm); a tela já esconde via `editavel`.

**"Quem pode":** `convertChecklistItem` já tem linha (`packages/dominio/CONTEXT.md`: `| convertChecklistItem | operations/tasks.ts | taskWriteRefusal, listWriteRefusal | via mayWriteTask; a Tarefa nova nasce por createTask |`). `quem-pode.test.ts` só confere que **cada chave de `OPERACOES` tem uma linha** e que o Arquivo bate com o `import` de `registro.ts`; um derive novo não é operação, então **nenhuma linha da tabela muda**. `[VERIFIED: leitura de CONTEXT.md:60–66 e do teste, rodado verde nesta sessão]`.

### Q3 — D-09: escritores de `Task.description`

Mapa completo (grep de `description` em `packages/dominio/src`, `apps/api/src`, `apps/web/src`, lido caso a caso):

| # | Escritor | Arquivo:linha | Carrega / clona / zera `descriptionMentions`? | O que ficaria velho |
|---|---|---|---|---|
| 1 | `updateTask` (editor da Tarefa) | `tasks.ts:1511–1513` | o único que **vai** escrever a lista (D-06) | — (é a fonte) |
| 2 | `updateTask` pelo Agente do pipeline | `revisao-do-pedido.ts:171–172`: `updateTask(state, atores.quemPediuId, task.id, { description: nova })` | não passa a lista | a lista guardada pode ter nomes que a descrição nova não tem → **precisa refiltrar na escrita**, e o filtro na leitura cobre o resto |
| 3 | **Rollback** da conferência do pedido | `financeiro.ts:1250` (`description: task.description` no snapshot) e `:1262` (`task.description = antes.description;`) | restaura a **descrição** e **não** a lista | se o `updateTask` do passo 2 mudou a lista e o rollback devolve o texto antigo, a lista fica descasada do texto → só o **filtro na leitura** protege |
| 4 | Template de Tarefa (instanciar) | `planning.ts:307` `task.description = spec.description;` | Tarefa nova de `createTask`: lista ausente | nada (nasce sem lista; o texto pode ter "@Nome" digitado, mas sem lista não avisa) |
| 5 | Template de Tarefa (salvar a partir de uma Tarefa) | `planning.ts:270` `creates: { task: { title, description: task.description, … } }` | só texto | nada |
| 6 | **Recorrência** (próxima ocorrência) | `collaboration.ts:610` `description: task.description,` dentro do literal de `criarOcorrencia` | o literal não copia `descriptionMentions` | a ocorrência nasce com o mesmo texto e **sem** lista: sem destaque e sem aviso (Open Question 2) |
| 7 | Formulário (envio público) | `scale.ts:541` `task.description = answers[descricao.id]?.trim() ?? "";` | Tarefa nova | nada |
| 8 | Negócio → Tarefa espelho | `iniciar-conversa.ts:140` `task.description = deal.object ?? "";` | Tarefa nova | nada |
| 9 | Conversão de Solicitação de pagamento | `conversao-de-solicitacao.ts:271` `conta.description = solicitacao.description;` | `conta` vem de `createTask` | nada |
| 10 | Importadores | `importacao.ts:198`, `importacao-contas-a-receber.ts:293`, `importacao-contas-a-pagar.ts:257` (`...(entrada.descricao !== undefined ? { description: entrada.descricao } : {})` num `{...task}` recém-criado) | Tarefa nova | nada |
| 11 | Automação | nenhuma ação escreve descrição (as ações são `escrita` por Ferramenta ou `controle`; `grep description` em `automations.ts` não acha escrita de Tarefa) | — | — |
| 12 | Link público | `tarefa-publica.ts:63` só **lê** (`description: task.description`); `tarefas-publicas.ts` não tem rota de escrita | — | — |
| 13 | "Duplicação" de Tarefa | **não existe** operação de duplicar Tarefa (`grep -i duplic` em `packages/dominio` só acha Contato/Lote) | — | — |

Também: `apps/api` só **lê** a descrição (`dto-solicitacao.ts:204`, `automacoes/invocar-agente.ts:760`); a tela tem **um** editor (`TaskTitleDescriptionEditor`, `task-editors.tsx:58`).

**Comparação:**

| Critério | (A) recalcular a lista em cada escrita | (B) filtrar na leitura (`pendingMentions` e destaque) |
|---|---|---|
| Cobre #2 (agente) | sim, se `updateTask` refiltra | sim |
| Cobre #3 (rollback restaura só o texto) | **não**: o rollback é código fora de `updateTask`; teria de snapshotar a lista também | **sim**, sem tocar no rollback |
| Cobre #6 (recorrência) e futuros escritores | só se cada um lembrar | sim, por construção |
| Custo | espalhar a regra em N pontos | uma função `membrosMencionadosNaDescricao(state, task)` chamada por `pendingMentions` e pelo destaque |
| Custo de execução | zero na leitura | `pendingMentions` já percorre todas as Tarefas e chama `memberSeesTask`; um `descriptionMentions?.length` como guarda deixa o custo desprezível |

**Recomendação (prescritiva): B é o invariante; A entra só como higiene dentro de `updateTask`.** Concretamente: (1) `derive.ts` ganha `membrosMencionadosNaDescricao(state, task): Id[]` = ids de `task.descriptionMentions` (tipo `"member"`) cujo Membro existe e cujo `displayName` aparece como `` `@${displayName}` `` em `task.description`; (2) `pendingMentions` e o componente de destaque usam **só** essa função; (3) `updateTask` valida a existência, e ao gravar refiltra pelo texto novo e **omite a chave quando a lista fica vazia** (mesmo padrão de `delete task.startDate`), para o jsonb não carregar `[]`. Invariante testável: "uma menção sem o `@Nome` no texto nunca avisa", provado por um teste que muda `task.description` por atribuição direta (como o rollback faz) sem tocar na lista.

### Q4 — D-07 / D-09: consumidores de `pendingMentions`

**Todos** (`grep -rn "pendingMentions|comentariosObservados|notificacoesDoMembro|\.mencoes\b"` em `packages apps ferramentas docs`):

| Consumidor | Arquivo:linha | Acesso exato | Quebra com a união? |
|---|---|---|---|
| `notificacoesDoMembro` | `derive.ts:1378–1379` | ``const mencoes = pendingMentions(state, memberId);`` e ``const observadas = comentariosObservados(state, memberId, new Set(mencoes.map((m) => m.comment.id)));`` | **sim** (`m.comment` não existe na variante da descrição): filtrar `tipo === "comentario"` |
| Página Notificações | `app/(shell)/notificacoes/page.tsx` seção "Menções a você" | ``mentions.map(({ task, comment }) => { … comment.author.kind … comment.id … comment.createdAt … comment.content``, `key={comment.id}`, link ``/estrutura/tarefas/${task.id}#comentario-${comment.id}`` | **sim** |
| Sino da barra global | `features/shell/barra-global.tsx:56,114–115` | só `notificacoes.total` | não |
| `app-shell.tsx:368` | `notificacoesDoMembro(...).total` | só `.total` | não |
| Início / robô (contagem) | `features/inicio/panorama-do-robo.ts:43` `mencoes: notificacoes?.mencoes.length ?? 0` e `respostas-do-robo.ts:120,124` | só `.length` / `total` | não (a contagem já passa a incluir as da descrição, que é o desejado) |
| Teste | `operations/pessoa-da-conta.test.ts:223,225` | ``pendingMentions(state, PEDRO).some((p) => p.comment.id === cobranca?.id)`` | **sim** (typecheck) |
| Teste | `operations/automations-motor.test.ts:268,269` | ``pendingMentions(state, CP.aprovadorId).some((p) => p.comment.id === aviso?.id)`` | **sim** (typecheck) |
| Teste | `operations/tags-e-observadores.test.ts:7,71–84`, `operations.test.ts:3880–3895` | `notificacoesDoMembro(...).observadas`/`.mencoes.length`/`.total` | não |

Não há leitor em `apps/api`, em Ferramentas de IA nem em `ferramentas/`. O sino e o Início contam por `.total`/`.length`, então "o mesmo número em toda tela" **sai de graça** desde que a união seja uma única lista.

**Forma da união (recomendação):**
```typescript
export type MencaoPendente =
  | { readonly tipo: "comentario"; readonly task: Task; readonly comment: Comment }
  | { readonly tipo: "descricao"; readonly task: Task };
```
Com `tipo` o compilador obriga cada consumidor a tratar as duas; as 3 linhas que dependem de `m.comment` (derive:1379, page, 4 linhas de teste em 2 arquivos) deixam de compilar até serem ajustadas. Alternativa rejeitada: manter `pendingMentions` só de Comentário e acrescentar `mencoesDaDescricao` separado — o sino e o Início continuariam compilando e **esqueceriam** de contar a nova lista.

**Como visibilidade e "Tarefa aberta" são aplicadas hoje:** `pendingMentions` pula a Tarefa se `effectiveLifecycleOfTask(state, task.id) !== "ativo"` e se `!memberSeesTask(state, memberId, task.id)` (`derive.ts:~1297–1298`, antes do laço de Comentários `:1302`). **Não filtra categoria terminal** (um Comentário em Tarefa concluída segue avisando até a conversa ser resolvida). A menção da descrição precisa do filtro a mais pedido por D-07: `!isTerminalCategory(statusCategory(state, task))` (`derive.ts:463` e `:457`). Para cada Tarefa, a variante `descricao` entra se `membrosMencionadosNaDescricao(state, task).includes(memberId)`. Não há autor para excluir "o próprio Membro falando de si" (o Comentário exclui, `:1305`), então quem se menciona na descrição vê o aviso (Open Question 1).

**Ordenação:** o retorno hoje ordena por `comment.createdAt` desc (`:1311`). A descrição não tem instante próprio; usar o `at` do último `Registro de Atividade` "Descrição alterada" da Tarefa (`state.activity`, com `task.createdAt` de reserva) e fundir as duas variantes na mesma ordenação por instante; ou, mais simples, anexar as de descrição depois das de Comentário, em `task.updatedAt` desc. Decisão do planejador; o teste fixa a escolha.

### Q5 — D-10 / D-13 / D-14: histórico da descrição

**Bloco atual** (`tasks.ts:1511–1514`, verbatim):
```
  if (input.description !== undefined && input.description !== task.description) {
    mudancas.push({ action: "Descrição alterada" });
    task.description = input.description;
  }
```
`mudancas` é `Array<{ action; before?; after? }>` (`:1500`) e o laço final (`:1587–1600`) copia `before`/`after` para `recordActivity` quando definidos; o Título já grava os dois (`mudancas.push({ action: "Título alterado", before: task.title, after: title })`). Logo, 2.6.8 é uma linha: `mudancas.push({ action: "Descrição alterada", before: cortar(task.description), after: cortar(input.description) })`.

**`ActivityRecord`** (`types/primitives.ts`, lido): `readonly before?: string; readonly after?: string;` e `detail?: string`. `recordActivity` (`operations/activity.ts:102–120`) só inclui `before`/`after` se `!== undefined` e faz `state.activity.unshift(record)`; ou seja, `before: ""` (descrição que estava vazia) **é gravado**. Na tela, use `before !== undefined || after !== undefined` para decidir o botão — os renderizadores de hoje testam truthiness (`record.before || record.after`) e tratariam "" como ausente.

**Quem imprime `antes → depois` hoje (achado central; `[VERIFIED: leitura]`):**

| Renderizador | Arquivo:linha | Quando aparece | Guarda do Ator de integração |
|---|---|---|---|
| `LinhaDeAtividade` (Timeline) | `features/tarefa/timeline.tsx:284,295` | só Lista de Solicitação (`tarefa-completa.tsx:324,2212–2213`) | `const ehIntegracao = record.actor.kind === "integration";` + `!ehIntegracao && (record.before || record.after)` |
| **`FeedDeAtividade`** | `features/tarefa/feed-de-atividade.tsx:196–198, 219` | **toda outra Lista** (`tarefa-completa.tsx:2245–2254`) | `record.actor.kind === "integration" ? { ...record, before: undefined, after: undefined } : record` |
| Auditoria | `app/(shell)/configuracoes/auditoria/page.tsx:280–282` | todo registro, numa célula de tabela | nenhuma (lista todos os Atores) |
| Reunião | `app/(shell)/crm/reunioes/[reuniao]/page.tsx:155–161,782–784` → `ActivityTimeline` (`design/components.tsx:1338–1341`) | filtra `registro.objectId === task.id` | nenhuma |

Sem tratar os quatro, 2.6.8 faz a **maioria das Tarefas** mostrar o texto inteiro entre parênteses. Recomendação: um componente `AlteracaoDeDescricao` em `features/tarefa/` (recebe `record`, `ehIntegracao`) usado por `LinhaDeAtividade` e `FeedDeAtividade`, e, em Auditoria e Reunião, **omitir `before`/`after` quando `objectType === "task" && action === "Descrição alterada"`** (a Auditoria mostra "—"; não vale um botão ali). A chave do caso especial é o par `objectType === "task"` + `action === "Descrição alterada"`: a ação com esse texto exato só é gravada em `tasks.ts:1512` (grep; `revisao-do-pedido.ts:173` é só um rótulo de resultado, e as demais telas de "Descrição alterada." levam ponto final e são mensagens, não Atividade).

**Visibilidade (SEG-01 / D-13):** o corte de `GET /estado` está em `derive-visibilidade.ts:202`: `  const activity = state.activity.filter((a) => !ocultos.has(a.objectId));`. "Descrição alterada" é gravada com `objectId: task.id` (`tasks.ts:~1592`), e toda Tarefa que o Membro não vê entra em `ocultos` (`:134`, `for (const t of state.tasks) if (!visiveis.has(t.id)) ocultos.add(t.id);`). Logo **o registro com texto de descrição não chega a quem não vê a Tarefa**; já existe asserção genérica em `derive-visibilidade.test.ts:49–50` (`expect(estado.activity.some((a) => ocultos.has(a.objectId))).toBe(false);`) — falta só um caso específico com `before`/`after` de descrição. Na resposta de `POST /operacoes`, `recortarDiferenca` (`derive-visibilidade.ts:283–291`) filtra `gravados` por `g.id`, e o id de um Registro de Atividade **não** entra em `ocultos`; isso não vaza aqui porque `updateTask` exige `taskWriteRefusal` (que exige `memberSeesTask`), então quem dispara a gravação já vê a Tarefa. O texto continua indo a **todo** Membro que a vê (D-13, aceito).

**Peso:** `plataforma.registros.dados` é jsonb sem limite prático; o custo é o `GET /estado` inteiro (`~475 KB` para ~900 registros, comentário de `repositorio.ts:9–13`) e o `canonico(...)` de todos os registros a cada operação. Cada edição de descrição acrescenta até 2 × 2.000 caracteres (~4 KB em ASCII; pt-BR com acento pode chegar perto de 6 KB em UTF-8) por linha de Atividade, que nunca é podada. Aceitável e já limitado pelo corte; a Fase 12 mede `hidratar` — registrar o número de edições de descrição por mês como entrada dela, sem ação aqui.

**Ator de integração (T-02-10):** `updateTask` grava sempre `actor: memberActor(actingMemberId)` (`tasks.ts:~1593`), então um registro "Descrição alterada" **não nasce** com Ator `integration` por este caminho; mesmo assim a regra deve valer nos renderizadores (registros importados ou futuros) e o botão não aparece para `actor.kind === "integration"`, igual ao `(antes → depois)` hoje. O teste (f) de `timeline.test.tsx:243` (Ator `integration` com CNPJ no `detail`) é o molde.

### Q6 — D-15 / D-16 / TAR-07: `tempoRegistrado`

**`TimeEntry`** (`types/structure.ts:334–342`, verbatim): `readonly memberId: Id; readonly start: Instant; end?: Instant; durationMinutes?: Minutes; description?: string;`. **Lançamento aberto = `end === undefined`** (sem `durationMinutes`): `startTimer` cria `{ id, memberId, start: now(), createdBy }` (`collaboration.ts:~205`), `startMeeting` empurra `{ …, start, description: "Reunião", createdBy }` (`tasks.ts:1154–1160`). Fechado = tem `end` e `durationMinutes` (`addTimeEntry` `collaboration.ts:171–175`, `stopTimer` `:223`, `endMeeting` `tasks.ts:1201–1204`, e os fechamentos de B36 em `trashTask` `tasks.ts:704–711` e `structure.ts:566–571`, todos com `Math.max(1, …)`). Cronômetro aberto de **qualquer Membro** conta em `emAndamento` (hoje o `TaskTime` só destaca o do Membro logado, `abertoAqui`, mas a lista de lançamentos mostra "em andamento" para qualquer um, `collaboration-editors.tsx:277`).

**As duas somas de hoje divergem:**
- `tarefa-completa.tsx:1197–1199`: ``task.timeEntries.reduce((s, e) => s + (e.durationMinutes ?? 0), 0)} min · ${task.timeEntries.length} registro${…}`` — formato `"135 min"`, conta o aberto como registro com 0.
- `collaboration-editors.tsx:198–199`: ``const fechados = task.timeEntries.filter((e) => e.end !== undefined); const total = fechados.reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0);`` e `minutos(total)` → `"2 h 15 min"`.
Minutos iguais, **texto diferente**. `minutos()` (`collaboration-editors.tsx:~145`) é função privada do módulo (`function minutos(total: number): string`): precisa ser exportada ou movida para `features/estrutura/tempo.ts` para a linha usar a mesma.

**Outros lugares que somam tempo:** nenhum. `grep durationMinutes|timeEntries` em `packages apps` (fora de testes): produtores (`collaboration.ts`, `tasks.ts`, `structure.ts`), seeds (`timeEntries: []` e três lançamentos de exemplo em `seed.ts:2762, 2773, 2815`), esquema de `addTimeEntry` (`esquemas/colaboracao.ts:53`), a página de Reunião (`crm/reunioes/[reuniao]/page.tsx:223`, só **acha o aberto**, não soma) e as duas somas acima. Painéis, `resumo` e Ferramentas de IA **não** leem tempo: não há consumidor a trocar além dos dois.

**Subtarefas:** não há helper recursivo exportado em `derive.ts`. Existem `subtasksOf(state, taskId)` (`derive.ts:636`, um nível, **sem** filtro de ciclo de vida) e `subtaskProgress` (`:490`, filtra `effectiveLifecycleOfTask(...) === "ativo"`, só filhas diretas). A recursiva `descendants` de `tasks.ts:608` é privada ao módulo e anda por `parentTaskId` sem proteção contra ciclo (`taskLevel` já protege com `seen`). Recomendação: `tempoRegistrado` anda a subárvore **recursivamente** por `parentTaskId` com um `Set` de visitados, e conta só Subtarefas com `effectiveLifecycleOfTask(state, id) === "ativo"` (a mesma régua do progresso, DO-STA-06); o teste cobre o caso "Subtarefa na lixeira não soma" (A3). `lancamentos` = **número de lançamentos da própria Tarefa, abertos incluídos** (é o que a lista do editor mostra: 3 linhas para 30 + 45 + aberto; A2).

**Esqueleto** (campos verbatim de D-15):
```typescript
export function tempoRegistrado(state: DataState, taskId: Id): {
  readonly minutos: number; readonly lancamentos: number;
  readonly emAndamento: boolean; readonly minutosComSubtarefas: number;
} { /* soma e.end !== undefined ? e.durationMinutes ?? 0 : 0; emAndamento = some(e => e.end === undefined) */ }
```

### Q7 — Web

- **`useMencoes`:** `CommentComposer` (`task-editors.tsx:~471–660`) concentra o estado (`texto`, `mencoes`, `caret`, `sugestaoAtiva`, `sugestoesFechadas`), o regex do "@" em curso (`/(^|\s)@([^\s@]*(?:\s[^\s@]*){0,2})$/`, `:~496`), a lista de até 6 sugestões filtrada por `normalizar` (função local, `:958`) sobre Membros `state === "ativo"`, `mencionar()` e o filtro de envio ``mencoes.filter((m) => texto.includes(`@${m.nome}`))``. A **mesma lógica está duplicada** em `Compositor` de `timeline.tsx` (`arrobaEmCurso`, `:~367`). O hook devolve `{ sugestoes, sugestaoAtiva, mencionar, escolhidosEfetivos, aoMudar, aoSelecionar, aoTeclar, limpar }`.
- **Editor da descrição:** `TaskTitleDescriptionEditor` (`task-editors.tsx:41–87`) guarda `description` como `useState(task.description)` (**string pura**, sem formato rico), edita num `TextArea` do design system e chama `updateTask(data, memberId, task.id, { title, description })` **sempre com os dois campos** (`:58`). O `TextArea` (`design/components.tsx:229–285`) **não expõe** `ref`, `onKeyDown` nem `onSelect`/caret, então não dá para abrir o menu do "@" por ele. Duas saídas: (a) acrescentar props opcionais (`campoRef`, `onKeyDown`, `onSelect`) ao `TextArea` — compatível, vários usuários; (b) usar `<textarea className="campo block">` direto, como o `CommentComposer`. Recomendo (a), mantendo `autoGrow`.
- **Destaque:** a descrição é mostrada como texto puro em `<button …>{task.description}</button>` ou `<p …>{task.description}</p>` (`tarefa-completa.tsx:963–976`, `whitespace-pre-wrap`). O componente `DescricaoDaTarefa` divide o texto nos `@Nome` dos Membros de `membrosMencionadosNaDescricao(...)` e renderiza `<span>` (nunca `dangerouslySetInnerHTML`); funciona dentro do `<button>`.
- **`runConfirmado`:** é hook de `dados/store.ts` (`useRunConfirmado`, `:378`; tipo em `:77–80`), devolve `{ local, confirmado }`, onde `confirmado` resolve com o resultado **do servidor**. Padrão de uso com link "Abrir": `app/(shell)/estrutura/listas/[lista]/page.tsx:385–400` (`void confirmado.then(aoConfirmarCriacao)`; o aviso renderiza `Link … Abrir`, `:778–793`). `tarefa-completa.tsx` **já tem** o par aviso+link: `notice: string | null` e `proximaOcorrencia` (`:201, 894–912`, ``href={`/estrutura/tarefas/${proximaOcorrencia}`}``) — reutilizar o estado do link (renomeando para algo como `avisoComLink`) em vez de criar outro.
- **`ConfirmDialog`** (`design/components.tsx:733–770`): props `open, title, description` (string **obrigatória**), `confirmLabel`, `cancelLabel`, `destructive`, `confirmDisabledReason`, `confirmCarregando`, `onConfirm`, `onCancel`, `footerStart`, `wide`, `extraLargo`, `children`. D-01 = remover `destructive`, `confirmDisabledReason` e os `children` (o `Field`/`TextInput`); `Field` e `TextInput` continuam importados e usados em outros pontos do arquivo (`:749, 767–771`), então nenhum import fica órfão; `typedItem`/`setTypedItem` (`:218, 263, 269, 803–820`) saem.
- **Cartão do Quadro:** `cartao-de-tarefa.tsx` só importa `checklistProgress` (`:17`) e mostra `rotulo: "Checklist", valor: `${checklist.done} de ${checklist.total}`` (`:73`); `grep -n "hecklist|convert"` acha só isso. Sem gesto de converter. Prova de D-03: asserção de fonte (molde de `sem-codigo-de-regra.test.ts`, que lê `.tsx`) ou checagem manual na verificação.
- **Botão** (`tarefa-completa.tsx:1783–1792`): `className="btn btn-sutil btn-sm ml-auto shrink-0"` e `style={{ color: "var(--erro)" }}`, dentro de `{editavel ? (` — passa a `{editavel && semRecusa ? (` com `semRecusa = conversaoDeItemRecusada(state, memberId, task.id) === undefined` calculado **uma vez por render**, fora do `.map`.
- **Textos novos precisam passar em dois testes:** `sem-codigo-de-regra.test.ts` (varre `features/estrutura` e `app/(shell)/estrutura`; **não** varre `features/tarefa` nem `app/(shell)/notificacoes`, mas a regra vale igual) e `packages/dominio/src/operations/recusas-sem-codigo.test.ts` (frases do domínio sem `(RN-…)`, `(B..)`, `(A..)`).

### Q8 — Testes e comandos rápidos

Medido nesta sessão (laptop do dono, sem Postgres): domínio `vitest run` de 4 arquivos = 0,56 s; `tsc --noEmit` do domínio = 2,2 s; `apps/api` com `DATABASE_URL=` = 0,6 s; web 2 arquivos = 1,65 s. A suíte inteira continua 13–17 min (MEMORY): **não usar `npm test` por plano**.

| Mudança | Arquivos de teste a **estender** | Arquivos **novos** | Comando rápido |
|---|---|---|---|
| 2.4.1 | `operations/operations.test.ts` (`:255–280`, trocar `"nível 4"`) | `operations/conversao-de-item.test.ts` (TAR-01) | `cd packages/dominio && npx vitest run src/operations/conversao-de-item.test.ts src/operations/operations.test.ts -t "onvers" && npx tsc --noEmit` |
| 2.4.4 | `operations/remover-checklist-e-item.test.ts` (apagar o teste de Subitens), `tarefa-publica.test.ts` | — | `cd packages/dominio && npx vitest run src/operations/remover-checklist-e-item.test.ts src/tarefa-publica.test.ts src/quem-pode.test.ts src/operations/registro.test.ts && npx tsc --noEmit` |
| 2.4.1 (esquema) | `apps/api/src/rotas/esquemas-de-argumentos.test.ts` (acrescentar caso de `convertChecklistItem` 3 argumentos) | — | `cd apps/api && DATABASE_URL= npx vitest run src/rotas/esquemas-de-argumentos.test.ts && npx tsc --noEmit` |
| 2.6.6 | `esquemas-de-argumentos.test.ts` (casos `(a)(b)(c)` de `updateTask`, `:15–33`) | `operations/descricao-da-tarefa.test.ts` | `cd packages/dominio && npx vitest run src/operations/descricao-da-tarefa.test.ts && npx tsc --noEmit` |
| 2.6.7 | `pessoa-da-conta.test.ts`, `automations-motor.test.ts` (narrowing `p.tipo === "comentario"`), `tags-e-observadores.test.ts` | casos em `descricao-da-tarefa.test.ts`; `derive-visibilidade.test.ts` (D-14) | `cd packages/dominio && npx vitest run src/operations/descricao-da-tarefa.test.ts src/operations/pessoa-da-conta.test.ts src/operations/automations-motor.test.ts src/operations/tags-e-observadores.test.ts src/derive-visibilidade.test.ts && npx tsc --noEmit` |
| 2.6.8 | `apps/web/src/features/tarefa/timeline.test.tsx` (molde `(f)` `:243`) | `features/tarefa/feed-de-atividade.test.tsx`, `alteracao-de-descricao.test.tsx` | `cd apps/web && npx vitest run src/features/tarefa/timeline.test.tsx src/features/tarefa/feed-de-atividade.test.tsx && npx tsc --noEmit` |
| 2.6.9 | — | `packages/dominio/src/tempo-registrado.test.ts` (TAR-07) | `cd packages/dominio && npx vitest run src/tempo-registrado.test.ts && npx tsc --noEmit` |
| Web geral | `sem-codigo-de-regra.test.ts` | `features/estrutura/mencoes.test.tsx`, `conversao-de-item.test.tsx`, `descricao-da-tarefa.test.tsx` | `cd apps/web && npx vitest run src/features/estrutura && npx tsc --noEmit && npx eslint src/features/estrutura src/features/tarefa "src/app/(shell)/notificacoes"` |

**Mexe em `GET /estado`?** Nenhum plano muda `rotas/estado.ts` nem `derive-visibilidade.ts`. Mas o campo novo da Tarefa e o `before`/`after` maior **trafegam** por ele, e a MEMORY registra que um recorte passou nos testes unitários e derrubou `GET /estado` com 500. Por isso: **um** passo de e2e local no gate da fase (não por plano): Postgres de Docker na porta 556NN (`docker run -d --rm --name crm-n1-pg-1101 -e POSTGRES_PASSWORD=x -p 55611:5432 postgres:16`, depois `npm run migrar -w @n1/api` com `DATABASE_URL`/`DATABASE_URL_MIGRACAO` apontando para ele) e `cd apps/api && DATABASE_URL=… DATABASE_URL_MIGRACAO=… npx vitest run src/rotas/estado.test.ts src/rotas/operacoes.test.ts src/seguranca/dados-de-outro-membro.test.ts`. Docker 29.3.1 está disponível; nenhum contêiner `crm-n1-pg-*` está de pé agora.

### Q9 — Mapa de colisão de arquivos (para as ondas)

| Arquivo | Subtarefas que tocam | Regra |
|---|---|---|
| `packages/dominio/src/types/structure.ts` | 2.4.4 (apaga `:318`), 2.6.6 (acrescenta `descriptionMentions`) | mesmo plano ou ondas sequenciais |
| `packages/dominio/src/operations/tasks.ts` | 2.4.1, 2.4.4 (`convertChecklistItem` `:624`, `removeChecklistItem` `:1073`), 2.6.6 + 2.6.8 (`updateTask` `:1489`, `UpdateTaskInput` `:1473`) | regiões separadas, mas **arquivo de 2.046 linhas**: não em paralelo |
| `packages/dominio/src/derive.ts` | 2.4.1 (`conversaoDeItemRecusada`), 2.4.4 (`:502`, `:687`), 2.6.6 (helper de menção), 2.6.7 (`pendingMentions`, `notificacoesDoMembro`), 2.6.9 (`tempoRegistrado`) | **um só dono por onda** |
| `operations/planning.ts`, `operations/collaboration.ts`, `tarefa-publica.ts` | 2.4.4 (e 2.6.6 em `collaboration.ts:610`, se a recorrência copiar a lista) | um plano |
| `apps/api/.../esquemas/tarefas.ts` | 2.4.1 (`:59`), 2.6.6 (`UPDATE_TASK_INPUT` `:24–34`) | mesma regra do `tasks.ts` do domínio |
| `operations/operations.test.ts` (4.250 linhas) | 2.4.1 (uma asserção) | **evitar** crescer: testes novos em arquivos novos |
| `apps/web/.../tarefa-completa.tsx` (2.371 linhas) | 2.4.2, 2.4.3, 2.4.4 (`:1662, 1693, 2325`, diálogos de conversão e remoção), 2.6.6 (montar `DescricaoDaTarefa`), 2.6.9 (linha de tempo `:1197`) | **um único plano dono**; os outros planos web só tocam arquivos novos |
| `features/estrutura/task-editors.tsx` | 2.6.6 (editor da descrição, `CommentComposer` → hook) | um plano |
| `features/estrutura/collaboration-editors.tsx` | 2.6.9 (`TaskTime`, exportar `minutos`) | um plano |
| `features/tarefa/timeline.tsx`, `feed-de-atividade.tsx`, `auditoria/page.tsx`, `reunioes/[reuniao]/page.tsx` | 2.6.8 | um plano |
| `app/(shell)/notificacoes/page.tsx` | 2.6.7 | um plano |
| `cartao-de-tarefa.tsx` | 2.4.5 (nenhuma edição) | só teste/verificação |

**Sequência recomendada:** **Onda 1** domínio-A (2.4.4 + 2.4.1: `structure.ts`, `tasks.ts`/convert+remove, `derive.ts`, `planning.ts`, `collaboration.ts`, `tarefa-publica.ts`, `esquemas/tarefas.ts` linha `:59`, testes) → **Onda 2** domínio-B (2.6.6 + 2.6.8 + 2.6.7 + 2.6.9: `structure.ts`, `tasks.ts`/updateTask, `derive.ts`, `esquemas/tarefas.ts` `UPDATE_TASK_INPUT`, testes novos) → **Onda 3** web, em paralelo entre planos de arquivos disjuntos: (W3a) `tarefa-completa.tsx` + `conversao-de-item.tsx` + `descricao-da-tarefa.tsx` (2.4.2/3/4, 2.6.6 leitura, 2.6.9 linha) · (W3b) `mencoes.ts` + `task-editors.tsx` + `design/components.tsx` `TextArea` (2.6.6 editor) · (W3c) `timeline.tsx` + `feed-de-atividade.tsx` + auditoria + reunião (2.6.8) · (W3d) `notificacoes/page.tsx` (2.6.7) · (W3e) `collaboration-editors.tsx` + `tempo.ts` (2.6.9). W3a depende de W3e (`minutos` exportado) e de W3b só pelo hook (não importa dele: o editor mora em `task-editors.tsx`).

### Q10 — Migração

**Nenhuma SQL necessária**, `[VERIFIED: leitura]`: a Tarefa vive em `plataforma.registros(dados jsonb)` (`apps/api/migracoes/001-plataforma.sql:11–28`, "`dados` é o registro exatamente como o domínio o conhece"); `hidratar` não valida; o campo novo é opcional; uma Tarefa sem `descriptionMentions` é lida como "sem menções"; uma Tarefa com `parentItemId` hidrata sem erro (Q1). Não há coluna gerada sobre esses campos (`002` gera `status_id`, `list_id`, `due_date`). Se o planejador pedir SQL, a próxima é a `011` (a `010` é da Fase 10) e vale o padrão da Fase 10 (`--seco`). Nenhum índice novo: `pendingMentions` já varre as Tarefas em memória.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Destaque do `@Nome` | parser HTML / `dangerouslySetInnerHTML` / editor rico | divisão do texto em `<span>` a partir de `membrosMencionadosNaDescricao` | a descrição é `string` pura; qualquer HTML aberto é XSS; o `Rico` de `timeline.tsx` já mostra o padrão "só negrito/itálico, nunca HTML" |
| Lista efetiva de menções | uma segunda cópia da regra "texto inclui `@Nome`" na tela | o helper único de `derive.ts` | o invariante D-09 morre no primeiro ponto que reimplementar |
| Corte de 2.000 caracteres | `slice(0, 2000)` solto | uma função `cortarParaHistorico(texto)` no domínio, testada | `slice` em UTF-16 pode partir um emoji ao meio (par substituto); decidir o limite uma vez |
| Menu de sugestões do "@" | terceiro menu | `useMencoes` + as funções puras extraídas | já existem duas cópias |
| Formatação de minutos | outro `toLocaleString` | `minutos()` exportado de um módulo | D-15 exige o mesmo formatador |
| Confirmação | `window.confirm` | `ConfirmDialog` | "um mecanismo de confirmação no produto inteiro" (docstring `components.tsx:~725`) |

**Key insight:** esta fase é pequena em lógica e grande em **pontos de contato**; cada ponto esquecido vira número diferente em duas telas.

## Common Pitfalls

### Pitfall 1: o histórico da descrição aparece em quatro telas, não em uma
**What goes wrong:** só `timeline.tsx` é ajustado; `FeedDeAtividade` (todas as Listas menos a de Solicitação), Auditoria e Reunião imprimem 4.000 caracteres entre parênteses.
**Why:** o `11-CONTEXT.md` cita só `timeline.tsx`; `ehSolicitacaoDePagamento` (`tarefa-completa.tsx:324`) decide qual componente entra.
**How to avoid:** tratar os quatro (Q5); um componente compartilhado.
**Warning signs:** `grep -rn "record.before\|\.before ??" apps/web/src` ainda acha uso sem a guarda de "Descrição alterada".

### Pitfall 2: `updateTask` perde as menções quando só elas mudam
**What goes wrong:** `if (mudancas.length === 0) return ok(task);` (`tasks.ts:1587`) sai antes de qualquer registro; se a gravação de `descriptionMentions` não contar como mudança, a lista fica como estava ou, pior, é mutada sem `updatedAt`.
**How to avoid:** validar `descriptionMentions` **antes** de mutar qualquer campo (o bloco de título já muta antes de validar datas; não repetir), e decidir: lista mudou sem texto mudar → atualiza `updatedAt`, sem Atividade. O editor sempre envia `title` e `description` juntos (`task-editors.tsx:58`): `description` igual não gera "Descrição alterada".
**Warning signs:** teste "salvar só o título não zera as menções".

### Pitfall 3: o rollback da conferência do pedido descasa texto e lista
**What goes wrong:** `financeiro.ts:1262` restaura `task.description` e não a lista (Q3 #3).
**How to avoid:** filtro na leitura; opcionalmente guardar `descriptionMentions` no snapshot `antes`.

### Pitfall 4: união de `pendingMentions` deixa o sino e a página com números diferentes
**What goes wrong:** quem adicionar uma lista paralela (`mencoesDaDescricao`) esquece o `.length` do Início.
**How to avoid:** a união `MencaoPendente` única (Q4); `key` das variantes de descrição como `` `descricao-${task.id}` `` (não há `comment.id`).

### Pitfall 5: teste antigo quebra por mensagem e por subitem
**What goes wrong:** `operations.test.ts` espera `"nível 4"` e `remover-checklist-e-item.test.ts` testa Subitens com `parentItemId` (não compila após a remoção do tipo).
**How to avoid:** o plano da Onda 1 lista esses dois arquivos explicitamente.

### Pitfall 6: `TextArea` do design system não dá acesso ao caret
**What goes wrong:** o hook precisa de `selectionStart`, `onKeyDown` e foco/`setSelectionRange` (`mencionar` restaura o cursor via `requestAnimationFrame`).
**How to avoid:** estender o `TextArea` com props opcionais (Q7) e testar o menu com `fireEvent` no jsdom.

### Pitfall 7: nomes com prefixo comum
**What goes wrong:** `texto.includes('@João')` é verdadeiro para "@João Silva". A lista só contém quem foi **escolhido** no menu, o que limita o dano, mas o destaque pode marcar o trecho errado.
**How to avoid:** no destaque, testar do nome **mais longo** para o mais curto; no helper, comparar com fronteira (fim do texto, espaço ou pontuação) em vez de `includes` puro — e usar a mesma função nos três pontos.

### Pitfall 8: o limite "2.000 + …"
**What goes wrong:** ambiguidade "2.000 contando o `…`" vs "2.000 e mais o `…`" (TAR-06 diz "grava 2.000 e '…'"); fatiar em UTF-16 quebra emoji.
**How to avoid:** definir `LIMITE_DO_HISTORICO = 2000` caracteres de conteúdo mais `…` (comprimento 2.001), cortar por pontos de código (`Array.from`), e fixar no teste (A4).

### Pitfall 9: `tempoRegistrado` agregado vaza minutos de Subtarefa que o Membro não vê
**What goes wrong:** no navegador o `state` já vem recortado, mas um leitor no servidor (IA, Painel) chamando com o estado inteiro soma Subtarefas ocultas.
**How to avoid:** documentar no docstring que o agregado vale para o estado que quem chama já enxerga; Painéis e IA passam pelo recorte do Membro.

### Pitfall 10: registros antigos com `parentItemId`
Ver Q1/A1: sem a chave no tipo, o item vira contável. Conferir a contagem antes de aplicar em produção.

## Code Examples

### Aviso com "Abrir" usando o servidor (padrão do repositório)
```typescript
// padrão de apps/web/src/app/(shell)/estrutura/listas/[lista]/page.tsx:385-400 (Fonte: leitura nesta sessão)
const { local, confirmado } = runConfirmado((data, memberId) =>
  convertChecklistItem(data, memberId, task.id, checklistId, itemId),
);
if (!local.ok) { setNotice(null); setError(local.error); return; }
closeConversion();
void confirmado.then((r) => {
  if (!r.ok) { setNotice(null); setError(r.error); return; }
  setError(null);
  setNotice(`Item convertido em Subtarefa: ${r.value.title}.`);
  setProximaOcorrencia(r.value.id); // o link "Abrir" de :903-910 passa a servir aos dois avisos
});
```

### Esquema de `updateTask` com a chave nova
```typescript
// apps/api/src/rotas/esquemas/tarefas.ts — dentro de UPDATE_TASK_INPUT (:24-34); regra da pasta: objetos .strict()
descriptionMentions: z.array(z.object({ type: z.literal("member"), id: ID }).strict()).optional(),
// e convertChecklistItem (:59): z.tuple([ID, ID, ID]),  — se o 6º parâmetro for removido
```

### Bloco da descrição em `updateTask`
```typescript
// tasks.ts:1511-1514 hoje: mudancas.push({ action: "Descrição alterada" });
if (input.description !== undefined && input.description !== task.description) {
  mudancas.push({ action: "Descrição alterada", before: cortarParaHistorico(task.description), after: cortarParaHistorico(input.description) });
  task.description = input.description;
}
```

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Subitem de checklist previsto no tipo e na ontologia, inexistente na prática | um nível só (D-02) | ontologia diverge; registrar ao fechar |
| Recusa de conversão só depois do clique | derive consultado antes (D-04/D-05) | tela e endpoint dão a mesma frase |
| Menção só em Comentário | também na descrição, derivada do texto | sem estado novo |
| Duas somas de tempo | uma função de domínio | mesmo número em toda tela |

**Deprecated/outdated:** o parâmetro `parentTaskId` de `convertChecklistItem` (sem chamador); a frase "Escolha outra Tarefa pai…" (a tela não oferece a escolha).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Nenhum registro de Tarefa em produção carrega `parentItemId` (só seeds e código foram lidos; o banco remoto não é acessível ao pesquisador) | Q1, Pitfall 10 | itens que eram subitens passariam a contar como itens de 1º nível; conferir com a consulta de leitura antes de aplicar |
| A2 | `lancamentos` = nº de lançamentos da Tarefa **incluindo** o aberto (é o que a lista do editor mostra) | Q6 | o texto "N registros" pode destoar do que o dono espera se ele pensava só em fechados |
| A3 | Subtarefa na lixeira/arquivada **não** soma em `minutosComSubtarefas` (mesma régua do progresso) | Q6 | o total da mãe cai quando alguém move uma filha para a lixeira |
| A4 | "2.000 caracteres com …" = 2.000 de conteúdo + `…` (2.001), cortando por ponto de código | Pitfall 8 | um teste que espere 2.000 exatos falha por um caractere |
| A5 | O teste do menu do "@" cabe em jsdom com `fireEvent` (o `Compositor` da timeline já é testado assim em `timeline.test.tsx` `(g)`) | Q7 | se o `TextArea` estendido não for testável, a prova do "@Jú" vira UAT manual |
| A6 | O volume de edições de descrição é baixo o bastante para o acréscimo de ~4 KB por edição no `GET /estado` ser irrelevante agora | Q5 | a Fase 12 (medição de `hidratar`) pode querer podar `before`/`after` antigos |

## Open Questions

(Só o que é decisão de produto do dono; o resto, o planejador decide. Cada uma tem padrão recomendado para não bloquear.)

1. **A pessoa que escreve o próprio nome na descrição vê o aviso em "Menções a você"?**
   - O que sabemos: o Comentário exclui o autor (`derive.ts:1305`); a descrição não tem autor (D-07), então o derive não consegue excluir.
   - O que falta: se o dono acha estranho ver o aviso do que ele mesmo escreveu.
   - Recomendação: deixar avisar (a regra sai do dado, sem estado novo); mencionar na UAT.
2. **Na recorrência, a próxima ocorrência herda a menção da descrição (e avisa a pessoa de novo)?**
   - O que sabemos: a ocorrência copia o texto (`collaboration.ts:610`) mas não a lista; sem lista, o `@Nome` fica sem destaque e sem aviso.
   - Recomendação: copiar `descriptionMentions` (o filtro na leitura protege se o texto mudar); se o dono preferir "aviso só na Tarefa original", não copiar.
3. **Conferência em produção antes da fase fechar:** o dono (ou o executor num Postgres local) roda a consulta de `parentItemId` do Q1. Recomendação: checkpoint `human-verify` no último plano; sem ação de migração se vier zero.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | tudo | ✓ | v24.14.0 | — |
| npm | workspaces | ✓ | 11.9.0 | — |
| vitest | testes | ✓ | 5.0.1 | — |
| Docker | e2e local de `GET /estado` / `POST /operacoes` | ✓ | 29.3.1 | pular o e2e e declarar o risco |
| psql | consulta de conferência de `parentItemId` | ✓ | `/opt/homebrew/bin/psql` | — |
| Postgres do `.env` (remoto) | **não usar** em teste (MEMORY) | n/a | — | Docker local |

**Missing dependencies with no fallback:** nenhuma.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 5.0.1 (3 workspaces) + `@testing-library/react` + jsdom no web |
| Config file | `packages/dominio/vitest.config.mts`, `apps/api/vitest.config.mts` (`fileParallelism: false`, timeout 180 s), `apps/web/vitest.config.mts` (jsdom por pragma de arquivo) |
| Quick run command | ver tabela da Q8 (segundos) |
| Full suite command | `npm run check` (3 min com Postgres local; 13–17 min com o remoto) — **só no gate da fase**, em segundo plano |

### Phase Requirements → Test Map
| Req ID | Comportamento observável | Test Type | Automated Command | File Exists? |
|--------|--------------------------|-----------|-------------------|-------------|
| TAR-01 | motivo para Lista sem Subtarefas, nível máximo (`tsk_seed_8`), sem escrita; `undefined` em Tarefa de 1º nível com Subtarefas; mensagem "…já está no nível 3, o último permitido…" na recusa de `convertChecklistItem`; recusa antes de qualquer efeito | unit (domínio) | `cd packages/dominio && npx vitest run src/operations/conversao-de-item.test.ts src/operations/operations.test.ts -t "onvers"` | ❌ Wave 0 (`conversao-de-item.test.ts`); `operations.test.ts` ✅ (muda a asserção `:~278`) |
| TAR-02 | botão some em Lista sem Subtarefas/nível máximo, cor normal; confirmação de 1 clique sem `Field`; `runConfirmado` + "Abrir" com o id do servidor; cartão sem gesto | componente (jsdom) + UAT | `cd apps/web && npx vitest run src/features/estrutura/conversao-de-item.test.tsx` | ❌ Wave 0. **Só UAT:** o link "Abrir" abrindo a Subtarefa real com o id do servidor e a cor do botão |
| TAR-03 | `grep -rn parentItemId packages apps` sem achados; sem ramo de subitens; `removeChecklistItem` remove só o item | grep + unit | `grep -rn parentItemId packages apps --exclude-dir=node_modules --exclude-dir=.next` (vazio) · `cd packages/dominio && npx vitest run src/operations/remover-checklist-e-item.test.ts src/tarefa-publica.test.ts && npx tsc --noEmit` | ✅ (editar) |
| TAR-04 | `updateTask` com "@Júlia revisar" + menção grava `descriptionMentions`; Membro inexistente recusado ("A menção aponta para um Membro que não existe."); lista refiltrada ao mudar o texto; esquema aceita a chave; "@Jú" abre o menu | unit + esquema + componente | `cd packages/dominio && npx vitest run src/operations/descricao-da-tarefa.test.ts` · `cd apps/api && DATABASE_URL= npx vitest run src/rotas/esquemas-de-argumentos.test.ts` · `cd apps/web && npx vitest run src/features/estrutura/mencoes.test.tsx` | ❌ Wave 0 (3 arquivos novos); esquema ✅ (estender `(a)(b)(c)`) |
| TAR-05 | variante `descricao` em `pendingMentions` só com nome no texto, Tarefa fora de categoria terminal, `memberSeesTask`; some ao fechar/tirar o nome; texto mudado por atribuição direta não avisa; Comentário segue igual; Notificações mostra o trecho | unit + componente | `cd packages/dominio && npx vitest run src/operations/descricao-da-tarefa.test.ts src/operations/pessoa-da-conta.test.ts src/operations/automations-motor.test.ts src/operations/tags-e-observadores.test.ts` | ❌ Wave 0; os 3 existentes ✅ (narrowing) |
| TAR-06 | A→B grava `before:"A"`/`after:"B"`; 3.000 caracteres grava 2.000+`…`; sem botão em registro sem `before`/`after` e em Ator de integração; Feed e Timeline iguais; Auditoria/Reunião sem texto inline; Atividade de Tarefa oculta não chega | unit + componente | `cd packages/dominio && npx vitest run src/operations/descricao-da-tarefa.test.ts src/derive-visibilidade.test.ts` · `cd apps/web && npx vitest run src/features/tarefa/timeline.test.tsx src/features/tarefa/feed-de-atividade.test.tsx` | ❌ Wave 0 (Feed); `timeline.test.tsx` ✅ |
| TAR-07 | 30 + 45 min + cronômetro aberto → `minutos: 75`, `emAndamento: true`; Subtarefa de 20 min → `minutosComSubtarefas: 95`; só Subtarefa → `emAndamento` da Tarefa não muda; Subtarefa na lixeira não soma; linha e editor dão o mesmo texto | unit + componente | `cd packages/dominio && npx vitest run src/tempo-registrado.test.ts` · `cd apps/web && npx vitest run src/features/estrutura/tempo.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** o comando da linha do requisito (≤ 5 s) + `npx tsc --noEmit` do workspace tocado.
- **Per wave merge:** `cd packages/dominio && npx vitest run` e `cd apps/web && npx vitest run src/features/estrutura src/features/tarefa` (poucos segundos).
- **Phase gate:** `npm run check` com Postgres local + o e2e de `GET /estado` da Q8, antes de `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `packages/dominio/src/operations/conversao-de-item.test.ts` — TAR-01/03
- [ ] `packages/dominio/src/operations/descricao-da-tarefa.test.ts` — TAR-04/05/06 (usar `buildSeed()`, `tsk_seed_1`, `mem_thiago`)
- [ ] `packages/dominio/src/tempo-registrado.test.ts` — TAR-07
- [ ] `apps/web/src/features/tarefa/feed-de-atividade.test.tsx`, `alteracao-de-descricao.test.tsx` — TAR-06
- [ ] `apps/web/src/features/estrutura/mencoes.test.tsx`, `conversao-de-item.test.tsx`, `tempo.test.ts` — TAR-02/04/07
- [ ] Framework install: nenhum.

**Só provável por UAT manual:** destaque visual do nome (cor/contraste), "Abrir" levando à Subtarefa real após a confirmação do servidor, a sensação de "um clique", o botão ausente numa Lista real sem Subtarefas, e o aviso aparecendo no sino/Início para a pessoa mencionada (login como outro Membro).

## Security Domain

`security_enforcement` está ligado, ASVS nível 1 (`.planning/config.json`).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | não | — (nenhuma mudança) |
| V3 Session Management | não | — |
| V4 Access Control | **sim** | `taskWriteRefusal` em `updateTask`/`convertChecklistItem`; `memberSeesTask` em `pendingMentions`; `visibilidadePara` corta Atividade por `objectId` |
| V5 Input Validation | **sim** | zod `.strict()` em `esquemas/tarefas.ts` (a chave nova entra no esquema, senão `POST /operacoes` recusa); existência do Membro no domínio |
| V6 Cryptography | não | — |
| V8 Data Protection | **sim** | D-13 aceita que texto sensível apagado permaneça no histórico; corte de 2.000 limita o volume; Ator de integração nunca mostra `before`/`after` (T-02-10) |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS pelo destaque do `@Nome` ou pelo texto anterior | Tampering | dividir em `<span>`/texto React, nunca `dangerouslySetInnerHTML`; "Ver alteração" renderiza texto puro com `whitespace-pre-wrap` (não passar pelo `Rico`) |
| Menção forjada (id de Membro que não está no texto) para disparar aviso | Spoofing | filtro na leitura exige `@Nome` no texto; `updateTask` valida existência |
| Vazamento de texto de descrição a quem não vê a Tarefa | Information Disclosure | `derive-visibilidade.ts:202` + teste específico novo em `derive-visibilidade.test.ts` |
| Menção avisando quem não vê a Tarefa | Information Disclosure | `memberSeesTask` dentro do laço (RN-TAR-14) |
| Conversão por quem não escreve | Elevation | `taskWriteRefusal` dentro de `conversaoDeItemRecusada` e da operação |

## Project Constraints (from CLAUDE.md)

- Camadas: o domínio nasce antes (`CONTEXT.md` raiz): mudou "o que a coisa é" → `packages/dominio/`; `web` e `api` **nunca** dependem um do outro. `conversaoDeItemRecusada` e `tempoRegistrado` ficam no domínio.
- `apps/web/AGENTS.md`: "This is NOT the Next.js you know" — ler `node_modules/next/dist/docs/` antes de codar **páginas/rotas**. Esta fase não cria nem altera rota ou convenção de página (usa `useRouter().replace`, `useSearchParams` e `Link` já existentes em `tarefa-completa.tsx`); o executor lê o guia só se um plano tocar roteamento.
- Operação de domínio devolve `OperationResult` como valor; `recordActivity` em toda mutação; nada derivado é armazenado.
- Operação/assinatura nova = tipo → operação → `registro.ts` + `index.ts` → esquema em `esquemas/` → teste → tabela "Quem pode". **Aqui nenhuma operação é nova**, mas a assinatura de `updateTask` e de `convertChecklistItem` muda: esquema nos dois casos.
- Esquemas: `.strict()`, `satisfies Esquemas`; validação de transporte, nunca regra de negócio.
- Migrações imutáveis; qualquer ajuste de schema é a `011`.
- Texto do produto em pt-BR; sem código de regra (`(RN-…)`, `(B..)`) em tela nem em recusa do domínio.
- Testes: `npm test` completo demora 13–17 min; usar comandos por arquivo; teste de `apps/api` com banco só em Postgres de Docker local, nunca no `.env`.
- Não há `.claude/skills` nem `.agents/skills` no projeto.

## Sources

### Primary (HIGH confidence — leitura direta nesta sessão)
- `packages/dominio/src/operations/tasks.ts` (convert `:624–690`, remove `:1073–1110`, `UpdateTaskInput` `:1473`, `updateTask` `:1489–1600`, `addTaskComment` `:1779–1850`)
- `packages/dominio/src/derive.ts` (`:183, 457–463, 490–517, 679–700, 1137, 1231, 1293–1395`), `derive-visibilidade.ts` (`:110–217, 283–291`)
- `packages/dominio/src/types/structure.ts`, `types/primitives.ts`, `types/workspace.ts:223`, `seed.ts:2099, 2762–2830`
- `packages/dominio/src/operations/collaboration.ts` (tempo `:150–235`, recorrência `:409–435, 587–630`), `planning.ts:255–310`, `financeiro.ts:1235–1270`, `revisao-do-pedido.ts:160–180`, `scale.ts:505–545`, `conversao-de-solicitacao.ts:255–275`
- `apps/api/src/rotas/esquemas/tarefas.ts`, `esquemas/CONTEXT.md`, `rotas/estado.ts`, `persistencia/repositorio.ts`, `migracoes/001-plataforma.sql`
- `apps/web/src/features/estrutura/{tarefa-completa,task-editors,collaboration-editors}.tsx`, `features/tarefa/{timeline,feed-de-atividade}.tsx`, `app/(shell)/notificacoes/page.tsx`, `design/components.tsx` (`TextArea`, `ConfirmDialog`), `dados/store.ts`
- `ontologia/02-estrutura-de-trabalho/tarefa.md` (linhas 68, 103, 114–115, 384), `checklist.md`
- `docs/09-planejamento/TAREFAS-POR-SESSAO.md` linhas 622–664 e 757–784
- Execuções reais: `npx vitest run` (domínio e api) e `tsc --noEmit` do domínio, verdes

### Secondary / Tertiary
- Nenhuma fonte externa: a fase não depende de documentação de terceiros.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — nenhum pacote novo.
- Architecture: HIGH — mapa de escritores, consumidores e renderizadores feito por leitura dos arquivos.
- Pitfalls: HIGH para os de código lido; MEDIUM para A2–A6 (decisões de detalhe que o planejador fixa no teste).
- Produção (A1): LOW — banco remoto não acessível.

**Research date:** 2026-10-29
**Valid until:** 2026-11-12 (código em movimento: Fase 10 ainda fecha 10-16/10-17 e a Fase 12 mexe em `hidratar`; reconferir `arquivo:linha` se `tasks.ts`, `derive.ts` ou `tarefa-completa.tsx` mudarem na `main`)
