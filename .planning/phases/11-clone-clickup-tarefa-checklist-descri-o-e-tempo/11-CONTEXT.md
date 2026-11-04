# Phase 11: Clone ClickUp: Tarefa (checklist, descrição e tempo) - Context

**Gathered:** 2026-10-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Fechar as lacunas **da Tarefa** (o agregado, não os contêineres). São 9 subtarefas da Sessão 2 (parte B) de `docs/09-planejamento/TAREFAS-POR-SESSAO.md`: **2.4.1–2.4.5** converter item do checklist em Subtarefa sem susto · **2.6.6–2.6.9** menção na descrição, texto anterior no histórico, tempo registrado calculado no domínio.

Três camadas, começando pelo domínio (regra da raiz: o domínio nasce antes da tela):

1. **Domínio (`@n1/dominio`)** — `conversaoDeItemRecusada` e `tempoRegistrado` em `derive.ts`; `convertChecklistItem` e `updateTask` mudam (`tasks.ts`); `Task.descriptionMentions`; `pendingMentions` passa a ler também a descrição; subitem de checklist sai do modelo.
2. **Backend (`apps/api`)** — esquema de `updateTask` aceita `descriptionMentions` (`rotas/esquemas/tarefas.ts`). **Sem migração SQL prevista:** a Tarefa mora em `plataforma.registros` como jsonb e o campo novo é opcional. Se o planejador achar que precisa de uma, a próxima é a `011` (a `010` é da Fase 10).
3. **Interface (`apps/web`)** — `tarefa-completa.tsx` (botão e confirmação de converter, descrição com nome destacado, linha de tempo), `task-editors.tsx` (hook `useMencoes`), `collaboration-editors.tsx` (`TaskTime`), `features/tarefa/timeline.tsx` ("Ver alteração"), `app/(shell)/notificacoes/page.tsx`.

**Fora do escopo (outras fases):** contêineres, mover e bloquear (Fase 10); medir e acelerar a gravação (Fase 12); qualquer item novo de teste que **não** mexa na Tarefa (o dono não trouxe itens da 2.7 para a Tarefa nesta discussão).

**Independência da Fase 10:** `tasks.ts` e `tarefa-completa.tsx` contra `structure.ts`, `configuration.ts` e as páginas de contêiner. A única ponta compartilhada era a 2.1.10 (códigos de regra fora dos textos), que já limpou `tarefa-completa.tsx` — a Fase 11 parte do arquivo limpo. Esta branch (`fase-11`) saiu de `n1/main`, que já tem o PR #1 da Fase 10 (`fase-10/fechamento`); o commit `ad80f5a` (10-16, o botão "Rodar agenda" sai) **ainda não está lá**, mas não toca nos arquivos da Tarefa. Procurar de novo os números de linha citados no documento de tarefas: eles deslocaram (ex.: `convertChecklistItem` está em `tasks.ts:624`, não `:590`; `taskLevel` em `derive.ts:509`).

</domain>

<decisions>
## Implementation Decisions

### Converter item do checklist (2.4.1–2.4.5)

- **D-01 (2.4.3, escolha B):** **Converter confirma com um clique, com aviso.** A confirmação diz que não há volta e o botão "Converter" fica na cor normal. **Some a digitação do nome do item** (`typedItem`, `confirmDisabledReason`, o `Field` com `TextInput`) e o `destructive` do `ConfirmDialog`. Descartadas: manter a digitação (assusta e o ClickUp não faz); converter direto sem confirmação (um clique errado deixa uma Subtarefa a mais). O comentário de `tarefa-completa.tsx` (~207–211, "exige digitar o nome do Item") precisa ser reescrito junto.
- **D-02 (2.4.4, escolha B):** **Subitens de checklist ficam fora do modelo.** O checklist tem **um nível só**. Sai `ChecklistItem.parentItemId` de `types/structure.ts` e saem todos os usos: o ramo de subitens de `convertChecklistItem` (`tasks.ts:640` e `:660–672`), o filtro de subitens em `removeChecklistItem` (`tasks.ts:~1090`), `derive.ts` (`:502`, `:687`), `tarefa-publica.ts:70`, `operations/planning.ts:262`, `operations/collaboration.ts:424` e os usos da tela (`tarefa-completa.tsx:~1662`, `:~1693`, `:~2325`). O planejador confere por `grep -rn parentItemId` que nada sobra e que `hidratar` e os esquemas não rejeitam a chave caso algum registro antigo a traga (o scout não achou subitem em seed nenhum nem operação que o crie). A mensagem "Os N subitens migram…" da confirmação sai. Descartada: criar subitens de verdade (cerca de 1 dia). Se um dia quiser subitens, voltam como trabalho novo.
- **D-03 (2.4.5, escolha B):** **Converter só com a Tarefa aberta** (página, popup ou gaveta, todos por `tarefa-completa.tsx`). O cartão do Quadro (`cartao-de-tarefa.tsx`) **não ganha menu**: continua só com "Checklist N de M". Nada a construir; o teste de pronto é que o cartão não tenha o gesto.
- **D-04 (2.4.1, do documento, travado):** `conversaoDeItemRecusada(state, actingMemberId, taskId)` em `derive.ts` devolve o motivo ou `undefined`: sem escrita na Tarefa, `features.subtarefas` desligada na Lista, ou `taskLevel(state, task) + 1 > state.workspace.maxSubtaskDepth`. `convertChecklistItem` chama essa função primeiro. A mensagem de nível passa a ser **"Esta Tarefa já está no nível N, o último permitido. O item não pode virar Subtarefa aqui."** (a de hoje pede uma escolha que a tela não oferece). O planejador decide se mantém o 6º parâmetro opcional `parentTaskId` de `convertChecklistItem` (e o `opcional(ID)` no esquema `convertChecklistItem` de `esquemas/tarefas.ts`): se ficar, a função de recusa e a operação precisam concordar sobre qual Tarefa pai vale.
- **D-05 (2.4.2, do documento, travado):** o botão "Converter em Subtarefa" **só aparece** quando `conversaoDeItemRecusada` devolve `undefined` (some em Lista sem Subtarefas e em Tarefa no último nível), na cor normal (sai `style={{ color: "var(--erro)" }}`). Converter usa `runConfirmado` (não `run`) e o aviso traz o link **"Abrir"** para a Subtarefa, com o id que o servidor devolveu.

### Menção na descrição (2.6.6, 2.6.7)

- **D-06 (2.6.6, do documento, travado):** `Task.descriptionMentions?: { type: "member"; id: Id }[]` em `types/structure.ts`. `UpdateTaskInput` (`tasks.ts:1473`) ganha `descriptionMentions`; `updateTask` grava junto com a descrição e **recusa Membro inexistente**, como `addTaskComment` faz. Esquema de `updateTask` em `apps/api/src/rotas/esquemas/tarefas.ts` atualizado. A lógica do "@" do `CommentComposer` (`task-editors.tsx:~491–540`, `useMencoes`) vira o hook `useMencoes` em `features/estrutura/mencoes.ts` e o editor da descrição o usa. Na Tarefa completa o nome mencionado aparece **destacado** na descrição. **Só Membro** nesta fase (a ontologia, RN-TAR-14, prevê também Equipe, Agente, Tarefa, Contato e outros: ver Deferred). A lista é **derivada do texto**: só conta o Membro cujo `@Nome` ainda está na descrição no momento de gravar (mesmo padrão do Comentário: `mencoes.filter((m) => texto.includes('@' + m.nome))`).
- **D-07 (2.6.7, escolha B):** **A menção na descrição avisa a pessoa.** Ela aparece em Notificações › "Menções a você" **enquanto o nome estiver na descrição e a Tarefa estiver aberta** (fora de categoria terminal), sujeita a `ver` (RN-TAR-14: `memberSeesTask`, como `pendingMentions` já faz). `pendingMentions` (`derive.ts:1293`) passa a ler também `descriptionMentions`; a tela de Notificações mostra o **trecho da descrição**. A descrição não tem autor próprio (ontologia, `tarefa.md`:68), então o aviso diz "na descrição de X", sem "por quem". A regra sai do dado: **nada de estado novo guardado.**
- **D-08:** **O aviso da descrição sai só por conta própria**: some quando a Tarefa fecha, sai da lista, ou alguém tira o nome da descrição. **Sem botão "Dispensar"** e sem registro de "já vi" por pessoa. Descartado: dispensar por Membro (exigiria dado novo e decidir se o aviso volta quando o texto muda). Consequência aceita: a pessoa mencionada fica com o aviso até uma dessas três coisas acontecer.
- **D-09 (consequência no código, não pergunta ao dono):** `pendingMentions` hoje devolve `{ task, comment }` e três lugares dependem dessa forma: `derive.ts:~1378` (`resumo`, que monta `observadas` com `m.comment.id`), a página de Notificações e o Início. O retorno passa a ser uma união (menção de Comentário | menção de descrição) e esses consumidores acompanham. Garantir a invariante: **uma menção sem o "@Nome" no texto nunca avisa**, mesmo que a descrição tenha sido mudada por um caminho que não é `updateTask` (modelo/Template, duplicação, Formulário, Automação, link público). O planejador mapeia os escritores de `Task.description` e escolhe entre recalcular a lista em cada escrita ou filtrá-la na leitura.

### Histórico da descrição, texto anterior (2.6.8)

- **D-10 (2.6.8, do documento, travado):** em `tasks.ts:~1511`, "Descrição alterada" passa a gravar `before` e `after` com a descrição antiga e a nova, **cortadas em 2.000 caracteres com "…" no fim**. Em `features/tarefa/timeline.tsx` a ação "Descrição alterada" mostra só "Descrição alterada" e um botão **"Ver alteração"**; não entra mais o `(antes → depois)` no meio da frase para essa ação.
- **D-11:** **"Ver alteração" abre ali mesmo, embaixo da linha** (a linha se expande e mostra o texto anterior e o novo, um embaixo do outro; clicar de novo recolhe). Descartada: abrir numa janela (interrompe a leitura do histórico).
- **D-12:** **Edições antigas ficam como hoje, sem botão.** O botão "Ver alteração" só aparece em registro que tem `before`/`after`. Nada é inventado nem migrado.
- **D-13:** **Quem vê a Tarefa vê o texto anterior e o novo**, a mesma regra de todo o histórico (como já vale para o título). Sem regra de visibilidade só para este campo. **Consequência aceita pelo dono:** se alguém apagar da descrição um dado sensível (valor, CPF), ele continua no histórico. — **Reversibility:** costly — parar de guardar o texto é barato daqui para a frente, mas o que já foi gravado em registros de Atividade continua lá, e apagá-lo exigiria varrer esses registros.
- **D-14 (consequência no código, não pergunta ao dono):** o Ator de integração **nunca** mostra `before`/`after`/`detail` na linha do tempo (`timeline.tsx:~282`, T-02-10: podem carregar payload, CPF/CNPJ ou URL assinada). O botão "Ver alteração" respeita a mesma regra e **não aparece para Ator de integração**. O planejador confere, no recorte de `GET /estado` da Fase 9 (SEG-01), que o registro de Atividade com texto de descrição não chega a quem não enxerga a Tarefa.

### Tempo registrado (2.6.9)

- **D-15 (escolha "o da Tarefa, e o total ao lado"):** `tempoRegistrado(state, taskId)` em `derive.ts` devolve `{ minutos, lancamentos, emAndamento, minutosComSubtarefas }`. A linha "Rastrear tempo" (`tarefa-completa.tsx:~1199`) e o editor `TaskTime` (`collaboration-editors.tsx:~199`) **mostram o número da Tarefa** (`minutos`) e, **só quando alguma Subtarefa tem tempo**, um segundo número discreto "N min com Subtarefas" (`minutosComSubtarefas`). Casa com a ontologia (`tarefa.md`:114–115): "Tempo registrado" é sem Subtarefas e "Tempo registrado agregado" inclui as Subtarefas, dois derivados distintos. Descartadas: mostrar só o da Tarefa (a mãe não mostra o esforço total) e mostrar sempre o total (quem lançou 75 min não reconhece o número na própria Tarefa). A linha e o editor mostram **o mesmo número**, formatado do mesmo jeito.
- **D-16 (cronômetro aberto):** **O número soma só os lançamentos fechados e ganha a etiqueta "em andamento"** quando há cronômetro aberto (`emAndamento: true`). O tempo corrido só entra quando a pessoa para. A função **não depende do relógio** (só de `state`), então Painéis e IA leem sempre o mesmo número. Descartado: somar o tempo corrido ao vivo (o número mudaria sozinho e o domínio passaria a depender de `now`). O `TaskTime` já tem o cronômetro ao vivo do próprio lançamento aberto (`useAgora`); isso continua como está, à parte do total.

### Requisitos derivados (proposta; registrar em `REQUIREMENTS.md` ao planejar)

O ROADMAP deixou "Requirements: TBD (definidos no discuss)". Derivação por tarefa (prefixo `TAR`, sem uso anterior em `REQUIREMENTS.md`):

| ID | Cobre | Critério |
|---|---|---|
| TAR-01 | 2.4.1, D-04 | `conversaoDeItemRecusada` devolve o motivo para Lista sem Subtarefas, para Tarefa no nível máximo e para quem não escreve na Tarefa, e `undefined` numa Tarefa de primeiro nível com Subtarefas ligadas; a mensagem nova aparece na recusa de `convertChecklistItem` (teste em `operations.test.ts`) |
| TAR-02 | 2.4.2, 2.4.3, 2.4.5, D-01, D-03, D-05 | Em Lista sem Subtarefas e em Tarefa no último nível o botão não aparece; onde aparece, está na cor normal; a confirmação é de um clique, sem digitar; converter mostra o aviso com "Abrir" e o link abre a Subtarefa nova; o cartão do Quadro não converte |
| TAR-03 | 2.4.4, D-02 | `grep -rn parentItemId packages apps` sem achados; `convertChecklistItem` sem ramo de subitens; `npm run check` passa |
| TAR-04 | 2.6.6, D-06 | `updateTask` com "@Júlia revisar" e a menção grava `descriptionMentions`; Membro inexistente é recusado; digitar "@Jú" na descrição abre o menu de Membros; o nome mencionado aparece destacado |
| TAR-05 | 2.6.7, D-07, D-08, D-09 | Notificações › "Menções a você" mostra a menção da descrição com o trecho enquanto o nome estiver nela e a Tarefa estiver aberta; some ao fechar a Tarefa ou tirar o nome; quem não enxerga a Tarefa não recebe; o aviso de Comentário segue igual |
| TAR-06 | 2.6.8, D-10..D-14 | Editar a descrição de "A" para "B" grava Atividade com `before: "A"` e `after: "B"`; descrição de 3.000 caracteres grava 2.000 e "…"; na tela "Ver alteração" expande os dois textos; edição antiga e Ator de integração não têm o botão |
| TAR-07 | 2.6.9, D-15, D-16 | `tempo-registrado.test.ts`: lançamentos de 30 e 45 min mais um cronômetro aberto devolvem 75 min e `emAndamento: true`; com uma Subtarefa de 20 min, `minutosComSubtarefas` é 95; a linha "Rastrear tempo" e o editor mostram o mesmo número |

### Claude's Discretion

- Nomes de módulos, esquemas e testes (`mencoes.ts`, `tempo-registrado.test.ts`, os testes de recusa); onde mora o componente que mostra a descrição com o nome destacado. `tarefa-completa.tsx` tem **2.371 linhas**: preferir um componente próprio a engordar o arquivo.
- Texto exato da confirmação de converter, do aviso com "Abrir", do trecho da descrição em Notificações, das etiquetas "em andamento" e "N min com Subtarefas".
- Formato do número de tempo ("135 min" ou "2 h 15 min"): usar **o mesmo formatador** (`minutos()` de `collaboration-editors.tsx`) na linha e no editor, para os dois mostrarem a mesma coisa.
- Como o "Ver alteração" rotula os dois blocos expandidos (por exemplo "Antes" e "Depois") e o destaque visual do nome mencionado.
- Forma exata da união que `pendingMentions` devolve; se a lista de `descriptionMentions` é recalculada na escrita ou filtrada na leitura (D-09).
- Se `convertChecklistItem` mantém o parâmetro `parentTaskId` (D-04).
- Quantos planos e em que ondas, respeitando domínio antes de API antes de tela. Observação de sequência: **2.6.6 e 2.6.8 mexem no mesmo bloco da descrição em `updateTask`** (e 2.4.1/2.6.7/2.6.9 em `derive.ts`; 2.4.2/2.6.6/2.6.9 em `tarefa-completa.tsx`): ou vão no mesmo plano ou em ondas sequenciais, nunca em paralelo no mesmo arquivo.

### Ações do dono (não são código)

Nenhuma específica desta fase: não há migração em produção prevista nem agendador a confirmar. Se o planejador concluir que precisa da `011`, vale o padrão da Fase 10 (D-19): `--seco`, conferência das contagens e só então aplicar.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Escopo da fase (fonte principal)
- `docs/09-planejamento/TAREFAS-POR-SESSAO.md` linhas 622–664 (2.4) e 757–784 (2.6.6–2.6.9) — as 9 subtarefas com "Hoje / O que fazer / Pronto quando", e as quatro decisões do dono (2.4.3, 2.4.4, 2.4.5, 2.6.7) com as opções. **Os números de linha de código citados ali deslocaram: procurar de novo antes de planejar.**
- `.planning/ROADMAP.md` § Phase 11 — escopo, independência da Fase 10, decisões do dono
- `.planning/phases/10-clone-clickup-cont-ineres-espa-o-pasta-e-lista/10-CONTEXT.md` — D-17 (2.1.10: `tarefa-completa.tsx` já sem códigos de regra), D-20 ("Quem pode"), padrão de requisitos derivados

### Camadas e regras
- `CONTEXT.md` (raiz) — mapa das camadas; mudou "o que a coisa é" → `packages/dominio/` primeiro
- `AGENTS.md` e `apps/web/AGENTS.md` — Next.js desta versão tem breaking changes: ler `node_modules/next/dist/docs/` antes de codar páginas
- `packages/dominio/CONTEXT.md` § "Quem pode (1.2.4)" e `packages/dominio/src/quem-pode.test.ts` — `updateTask` e `convertChecklistItem` já estão na tabela; operação nova entra nela
- `apps/api/src/rotas/CONTEXT.md` e `apps/api/src/persistencia/CONTEXT.md` — esquemas das operações (`satisfies EsquemasCompletos`), regra das migrações (imutáveis)
- `.planning/phases/09-seguran-a-dos-dados-e-base-de-produ-o/09-CONTEXT.md` — recorte de `GET /estado` e da resposta de `POST /operacoes` (SEG-01): o registro de Atividade com texto de descrição precisa respeitar quem enxerga a Tarefa

### Ontologia da Tarefa
- `ontologia/02-estrutura-de-trabalho/tarefa.md` — linha 68 (a descrição não é Comentário: atributo sem autor próprio, histórico em Registros de Atividade), 103 e 163–165 (descrição e menções derivadas do conteúdo), 114–115 (Tempo registrado × agregado), 384 (RN-TAR-14: menção a Membro notifica, sujeita a `ver`), 570 (menção não cria Vínculo nem permissão)
- `ontologia/02-estrutura-de-trabalho/checklist.md` e `subtarefa.md` — Item de Checklist e Subtarefa
- `ontologia/DECISOES-E-PENDENCIAS.md` — B48 (Item de Checklist: conversão unidirecional com marca terminal, progresso derivado). **A ontologia prevê Subitem (glossário); a D-02 o tira da implementação: registrar a divergência ao fechar a fase.**
- Artefato "Estrutura de Trabalho N1" (https://claude.ai/artifact/17AN5zBWHny2oP9BFLRPCf) — a fonte dos testes do dono

### Código a mudar (confirmado no scout de 2026-10-29)
- `packages/dominio/src/operations/tasks.ts` (`convertChecklistItem` `:624`, `addChecklistItem` `:950`, remoção de item `:~1090`, `UpdateTaskInput` `:1473`, `updateTask` `:1489`, bloco "Descrição alterada" `:~1511`), `derive.ts` (`taskLevel` `:509`, `pendingMentions` `:1293`, `resumo` `:~1378`, checklist `:502` e `:687`), `types/structure.ts` (`Task`, `ChecklistItem.parentItemId` `:318`, `TimeEntry` `:339`), `types/primitives.ts` (`Comment.mentions`, `ActivityRecord` `:280`), `operations/collaboration.ts` (`addTimeEntry`, cópia de checklist `:424`), `operations/planning.ts` (`:262`), `tarefa-publica.ts` (`:70`), `operations/registro.ts`, `operations/index.ts`
- `apps/api/src/rotas/esquemas/tarefas.ts` (`convertChecklistItem` `:59`, `addChecklistItem` `:67`, `updateTask`)
- `apps/web/src/features/estrutura/tarefa-completa.tsx` (conversão `:209–421` e `:792–827`, descrição `:~963–976`, botão `:~1783–1793`, "Rastrear tempo" `:~1199`), `task-editors.tsx` (`TaskTitleDescriptionEditor` `:41`, `CommentComposer` e o "@" `:~471–540`), `collaboration-editors.tsx` (`TaskTime` `:~199`), `features/tarefa/timeline.tsx` (linha de Atividade `:~276–300`), `features/estrutura/cartao-de-tarefa.tsx` (só conferir que não converte), `app/(shell)/notificacoes/page.tsx`

### Banco
- `apps/api/migracoes/001-plataforma.sql` — `plataforma.registros` (a Tarefa vive como jsonb; campo opcional novo não pede SQL)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- A lógica do "@" do `CommentComposer` (`task-editors.tsx:~491–540`): o "@" em curso (regex até dois espaços, nomes têm sobrenome), a normalização sem acento e a regra "só conta se o `@Nome` ainda está no texto". Vira o hook `useMencoes`.
- `pendingMentions`, `comentariosObservados` e a página de Notificações: o trilho que a menção da descrição passa a usar.
- `runConfirmado` (`tarefa-completa.tsx`): o aviso com link "Abrir" (já usado em outras ações que devolvem id).
- `minutos()` e `useAgora` em `collaboration-editors.tsx`: formatação do tempo e cronômetro ao vivo.
- `ConfirmDialog`: a confirmação de um clique é o mesmo componente sem `destructive` e sem o `Field` de digitação.
- `taskLevel` e `state.workspace.maxSubtaskDepth` (`derive.ts`): base de `conversaoDeItemRecusada`.

### Established Patterns
- Operação de domínio devolve `OperationResult` como valor (nunca exceção pela fronteira); `recordActivity` em toda mutação; nada derivado é armazenado (`tempoRegistrado` e a lista efetiva de menções saem do dado).
- Derivados do domínio recebem `state` (e o Membro quando há visibilidade) e **não leem o relógio**.
- Linha do tempo: Ator de integração nunca renderiza `before`/`after`/`detail` (T-02-10).
- Operação nova ou assinatura nova = tipo → operação → `registro.ts` + `index.ts` → esquema em `apps/api/src/rotas/esquemas/` → teste de domínio → tabela "Quem pode".

### Integration Points
- `updateTask` é o ponto onde 2.6.6 (menções) e 2.6.8 (texto anterior) se encontram: o mesmo bloco da descrição.
- `tarefa-completa.tsx` (2.371 linhas) é tocado por 2.4.2, 2.6.6 e 2.6.9; `derive.ts` por 2.4.1, 2.6.7 e 2.6.9; `tasks.ts` por 2.4.1, 2.4.4, 2.6.6 e 2.6.8.
- `pendingMentions` alimenta `resumo` (Início) e Notificações: mudar a forma do retorno quebra os dois se não forem ajustados juntos.
- Outros escritores de `Task.description` (modelo/Template de Lista, duplicação, Formulário, Automação, link público, conversão de Solicitação de pagamento) podem deixar `descriptionMentions` velho: ver D-09.
- Dois caminhos de "Descrição alterada" existem fora da Tarefa (`operations/revisao-do-pedido.ts:173`, Habilidade, Empresa, Flow etc.): **não são desta fase**; só `updateTask` da Tarefa muda.

</code_context>

<specifics>
## Specific Ideas

- O dono quer o botão de converter **na cor normal** e **só onde dá para converter**: "converter é um clique e uma confirmação", sem susto.
- A menção deve funcionar como o ClickUp: "digitar `@Jú` na descrição abre o menu de Membros"; a pessoa mencionada vê o aviso enquanto o nome estiver lá.
- "Ver alteração" é uma expansão discreta na própria linha do histórico, não uma janela.
- O número de tempo da Tarefa tem de ser **o mesmo em toda tela**, e o total com Subtarefas aparece só quando existe.
- O dono rejeita texto genérico ou centrado em código para decisões; as opções foram dadas pelo que se vê na tela (preferência registrada nas Fases 9 e 10).

</specifics>

<deferred>
## Deferred Ideas

- **Menção a Equipe, Agente, Tarefa, Contato, Empresa, Negócio, Conversa ou Documento de Conhecimento na descrição** (a ontologia, RN-TAR-14, prevê): a fase entrega só Membro, como o Comentário. Menção a outro registro "só cria referência navegável" e merece fase própria.
- **Subitens de checklist** (D-02 os tirou): voltariam como trabalho novo, cerca de 1 dia (domínio, esquema da API e tela), incluindo subitem que vira Subtarefa.
- **Converter pelo cartão do Quadro** (D-03 descartou): menu no cartão com os itens do checklist, cerca de meio dia de tela.
- **Botão "Dispensar" na menção da descrição** (D-08 descartou): exige guardar quem dispensou o quê.
- **Restringir "Ver alteração" a quem edita** (D-13 descartou): regra de visibilidade só para este campo do histórico.
- **Itens da 2.7 sobre a Tarefa**: nenhum trazido pelo dono; se aparecerem antes de planejar, entram um por subtarefa.

### Reviewed Todos (not folded)
None — nenhum todo casou com esta fase.

</deferred>

---

*Phase: 11-clone-clickup-tarefa-checklist-descri-o-e-tempo*
*Context gathered: 2026-10-29*
