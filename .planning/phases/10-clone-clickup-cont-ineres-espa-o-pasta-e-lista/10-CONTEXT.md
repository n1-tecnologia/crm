# Phase 10: Clone ClickUp: Contêineres (Espaço, Pasta e Lista) - Context

**Gathered:** 2026-10-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Fechar a Estrutura de Trabalho **no nível dos contêineres** (Espaço, Pasta, Lista e as Configurações deles). São 23 subtarefas da Sessão 2 (parte A) de `docs/09-planejamento/TAREFAS-POR-SESSAO.md` (linhas 405–779): **2.1.1–2.1.10** limpar a UI · **2.3.1–2.3.3** mover e reordenar · **2.5.1–2.5.5** tirar a Carga · **2.6.1–2.6.5** Visualizações padrão do Espaço, tirar o bloqueio da Lista, operação de bloquear aspecto.

Três camadas, começando pelo domínio (regra da raiz: o domínio nasce antes da tela):

1. **Domínio (`@n1/dominio`)** — `moveContainer`, `reorderContainers`, `setContainerDefaultViews`, `setContainerBlock`; `defaultViews` no Espaço/Pasta e `views` em `EffectiveListConfig`; `blocks` só em Espaço e Pasta; `bloqueado` sai de `InheritanceMode`; `carga`, `workload` e a capacidade semanal saem.
2. **Backend (`apps/api`)** — esquemas das operações novas (sem esquema o `satisfies EsquemasCompletos` não compila); o agendador passa a visitar mais Listas; a migração **`010`**, só de dados.
3. **Interface (`apps/web`)** — páginas da Lista, do Espaço, da Pasta e Configurações em abas; árvore com arrastar; diálogo "Mover para…"; editor de Visualizações padrão e interruptor de bloqueio.

**Fora do escopo (outras fases):** converter item do checklist, menção na descrição, texto anterior no histórico e tempo registrado (Fase 11); medir e acelerar a gravação, inclusive tabelas próprias de Espaço/Pasta/Lista (Fase 12); a Tabela virar planilha (adiada, ver Deferred); qualquer item novo de teste que **não** mexa em contêiner.

**Ordem interna (do ROADMAP):** domínio e migração antes da tela; a `010` junta 2.5.3 e 2.6.3; na página da Lista, **2.1.6 → 2.5.4 → 2.6.2** em sequência; **2.1.8 (Configurações em abas) antes de 2.6.2 e 2.6.5**; a **2.1.10** toca `tarefa-completa.tsx`, a única ponta compartilhada com a Fase 11.

</domain>

<decisions>
## Implementation Decisions

### Recorrência sem o botão "Rodar agenda" (2.1.1, 2.1.2, 2.1.3)

- **D-01 (2.1.2, escolha A):** **O servidor cuida.** O agendador (`apps/api/src/automacoes/scheduler-worker.ts`) passa a visitar também as Listas que têm **Tarefa recorrente por calendário** (`recurrence.triggerMode = porCalendario`) e as que têm **Tarefa vencida na lixeira**, além das que já visita (Automação ativa com gatilho `condicaoTemporal` publicado). Traz para esta fase a subtarefa da 19.1 e **tira** esse meio dia da Sessão 19; ao fechar a fase, anotar na 19.1 que a parte do agendador foi feita aqui. A consulta que monta os pares (Espaço de Trabalho, Lista) é `catalogoDeListasComAgenda` (hoje só lê `automations`).
- **D-02:** **Listas que só têm recorrência por calendário nascem direto: sem o ensaio da primeira volta e sem o comando `automacoes:liberar`.** Motivo dito pelo dono: a volta só cria a próxima Tarefa recorrente, não fala com Omie, Comentário ou Agente. **As Listas com Automação por vencimento (Financeiro, Contas a receber) mantêm o ensaio como hoje** (`ENSAIO_PRIMEIRA_VOLTA`, `MARCO_ZERO`). Uma Lista com as duas coisas fica no regime mais cauteloso (ensaio). O planejador decide **como** o par é classificado sem duplicar regra de negócio fora do domínio (o comentário do catálogo já avisa disso). — **Reversibility:** reversible — é decisão do agendador; voltar atrás é fazer essas Listas passarem pelo ensaio.
- **D-03 (2.1.1):** Apagar `RunScheduledButton` (`apps/web/src/features/estrutura/bulk-status-bar.tsx`), as duas chamadas em `listas/[lista]/page.tsx` e o item "Rodar automações por vencimento (hoje)" do menu "Automatizar" em `financeiro/contas-view.tsx` (se o menu ficar vazio, apagar o menu). **Também** reescrever o texto de ajuda de `collaboration-editors.tsx` (hoje manda "o relógio do servidor ou o botão 'Rodar agenda da Lista'") — achado do scout, não está no documento de tarefas. O teste de pronto é `grep -rn 'Rodar agenda' apps/web/src` e `grep -rn 'Rodar automações por vencimento' apps/web/src` sem achados.
- **D-04 (2.1.3, ação do dono):** O dono **não sabe** se `AUTOMACOES_WORKER_ATIVO=true` em produção (o `.env.example` traz `false`). Vira **checkpoint `[BLOCKING]` do dono, com comando pronto**: olhar o log de produção por "scheduler de Automações ativo" (`apps/api/src/index.ts`) e, no dia seguinte, uma linha nova em `plataforma.automacao_agenda` para cada Lista com agenda; se estiver desligado, ligar. **Ordem obrigatória:** a mudança do agendador (D-01/D-02) é publicada e a variável confirmada **antes** de o botão sair do ar. Se o dono nunca confirmar, o botão não sai.

### Abas da Lista e Visualizações padrão do Espaço (2.1.7, 2.6.1, 2.6.2)

- **D-05 (2.1.7, escolha A):** **Manter as abas Lista e Tabela separadas, como estão.** Nada muda nelas. A Tabela virar planilha (uma coluna por Campo, editável na célula, ~1,5 dia) fica adiada para depois, se o dono sentir falta dos Campos durante os testes. Com a Carga fora, a Lista passa a ter **5 abas** (Lista, Quadro, Calendário, Tabela, Linha do tempo) e a conversacional **4**.
- **D-06:** **Visualização salva de um tipo que o Espaço tirou "some da barra e volta junto".** Fica guardada intacta; não aparece na barra de Visualizações (`view-bar.tsx`) enquanto o tipo não estiver em `config.views.disponiveis`; reaparece se o Espaço devolver o tipo. **Nada é apagado nem migrado.** Se era a padrão da Lista (`isDefault`), a Lista abre na aba inicial do Espaço (`config.views.inicial`). Soma-se à regra do documento: `saveView` recusa **salvar** Visualização de tipo que a Lista não tem disponível (2.6.1 item 5). Descartadas: o Espaço não deixar tirar um tipo com salvas abaixo; a salva continuar aparecendo fora da lista do Espaço. — **Reversibility:** reversible — é filtro de leitura na barra, sem dado novo.
- **D-07 (2.6.1/2.6.2, do documento, travado):** `VisualizacoesPadrao { disponiveis, inicial }` em `defaultViews?` de `StructuralContainerBase` e `views` em `EffectiveListConfig`; `VISUALIZACOES_DA_PLATAFORMA` (as cinco abas, inicial `lista`) vale para o Espaço que ainda não definiu — **sem migração de dados**; resolução pelo ponto de definição mais próximo (`effectiveContainerConfig`, como `features`); `setContainerDefaultViews(state, actingMemberId, tipo, id, valor | null)` exige administrar, contêiner ativo e `blockedAbove(…, "defaultViews")` vazio, recusa `disponiveis` vazio e `inicial` fora de `disponiveis`, `null` volta a herdar, grava `modes.defaultViews` e a Atividade "Visualizações padrão alteradas" com antes e depois. As abas da página vêm de `config.views.disponiveis`, **ainda filtradas pela lente** (financeira, conversacional); a aba inicial é a salva `isDefault` da Lista (se o tipo estiver disponível), senão `config.views.inicial`. Editor: aba "Visualizações" nas Configurações (uma caixa por tipo, escolha da inicial, "Voltar a herdar").

### Mover e ordenar pela árvore (2.3.1, 2.3.2, 2.3.3)

- **D-08:** **Pastas e Listas continuam em dois grupos** na árvore e nas páginas do Espaço e da Pasta: Pastas em cima, Listas embaixo, cada grupo com a própria ordem (hoje `Folder.order` e `List.order` contam a partir de zero cada um, em `structure.ts:121,227,264,352`). Arrastar reordena **só dentro do grupo**. Sem migração de ordem. **Ajuste ao documento:** a 2.3.2 dizia que `reorderContainers` recebe "a permutação completa dos irmãos (Pastas e Listas do mesmo pai)"; com dois grupos a operação recebe o **grupo** (`tipo`: Espaço, Pasta ou Lista) e o pai, e a permutação completa **daquele grupo**. O resto da 2.3.2 vale (recusa se faltar ou sobrar id, ou faltar `editar` no pai, ou pai inativo; Atividade "Ordem alterada" no pai). Descartada: misturar Pastas e Listas numa só sequência como no ClickUp (exigiria unificar a ordem na migração e redesenhar as duas páginas). — **Reversibility:** costly — passar a misturar depois muda o significado de `order`, a migração de dados e as três telas.
- **D-09:** **Espaços também se arrastam para reordenar**, pela mesma regra (a operação já nasce aceitando `pai.type = "workspace"`). Espaço não "entra" em nada, só reordena. Para quem não pode arrastar (Convidado), a árvore continua inerte e só de leitura.
- **D-10:** **Soltar em cima de um Espaço ou Pasta move o item para dentro; soltar entre dois irmãos do mesmo tipo reordena.** Move **na hora**, com um aviso ("Lista Propostas movida para Clientes"), quando a mudança **não tem consequência** (mesmo Conjunto de Status e nenhum Campo deixa de valer). **Só abre diálogo quando há consequência:** o Conjunto de Status herdado muda (tabela de mapeamento de cada Status em uso, no formato de `move-task-dialog.tsx`) ou Campos deixam de valer (avisa que os Valores ficam `arquivado`, B37). Recusas do domínio aparecem no diálogo ou num `Toast`, sem mover nada. Existe o item **"Mover para…"** no menu de Pasta e de Lista (`mover-conteiner-dialog.tsx`) para quem prefere escolher o destino. Descartado: confirmar todo arrastar.
- **D-11 (2.3.1, do documento, travado):** `moveContainer(state, actingMemberId, tipo: "folder" | "list", id, destino: { parentType, parentId }, mapeamento?)` reusa `StatusMapping` de `tasks.ts`. `parentType`/`parentId` perdem `readonly` em `Folder` e `List`. Recusa quando: falta `administrar` no movido ou `criar` no destino; destino não efetivamente ativo; nome já existe entre os irmãos do destino (`nameTaken`); Pasta com Subpastas para dentro de Pasta (RN-SUB-11) ou qualquer Pasta para dentro de Subpasta (RN-SUB-02); destino bloqueia um aspecto que o movido ou descendente sobrescreve (RN-ESP-09, via `blockedAbove`); destino no mesmo lugar ou abaixo do próprio movido. Pasta que vai para o Espaço vira Pasta de nível 1 ("Subpasta promovida a Pasta"); Pasta sem Subpastas que vai para outra Pasta vira Subpasta ("Pasta rebaixada a Subpasta"); os demais casos gravam "Lista movida" ou "Pasta movida" com origem e destino em `before`/`after`. Valores de Campo cujas Definições deixam de valer passam a `state: "arquivado"` (B37).
- **D-12 (arrastar na árvore):** **Sem biblioteca nova.** O repositório já arrasta com o HTML5 nativo (`features/shell/quadro.tsx`, `estrutura/cartao-de-tarefa.tsx`, `estrutura/calendario-mensal.tsx`, `crm/quadro-do-funil.tsx`, e a árvore de Chat em `app-shell.tsx` com `moveChatSessionToFolder`) e `apps/web/package.json` não tem `dnd-kit` nem similar. Se a pesquisa concluir que o HTML5 não basta (zonas de soltura entre irmãos, teclado), passa pelo **portão de legitimidade de pacote** das Fases 1 e 2 (checkpoint humano antes do `npm install`) — não se instala por iniciativa do planejador.

### Carga e capacidade do Membro (2.5.1–2.5.5)

- **D-13 (2.5.5, escolha A):** **A capacidade semanal do Membro sai junto com a Carga.** Tira `weeklyCapacityMinutes` (`types/workspace.ts`), `memberCapacityMinutes`, `setMemberCapacity` (de `operations/planning.ts`, `registro.ts`, `index.ts` e `apps/api/src/rotas/esquemas/planejamento.ts`), o `CapacityEditor`, a coluna "Capacidade/sem" de `configuracoes/membros/page.tsx` e o trecho de capacidade do teste de `operations.test.ts`. **O valor já gravado em cada Membro é ignorado, não migrado** — o planejador confere que `hidratar`/os esquemas não rejeitam a chave que sobrar nos registros e que `seed-financeiro.ts` e `conversao-de-solicitacao.test.ts` (que a mencionam) são ajustados.
- **D-14 (2.5.1–2.5.4, do documento, travado):** `carga` sai de `View.kind` e de `VIEW_KIND` (`rotas/esquemas/escala.ts`; o teste prova `saveView` com `kind: carga` → 400); `workload` e `WorkloadCell` saem de `derive.ts` (`weekStartOf` fica: a Linha do tempo usa); `carga` sai de `TipoDeAba` e `ROTULO_DA_ABA`; `CargaDeTrabalho` sai de `planning-views.tsx`; os dois filtros de lente da página se simplificam (a financeira deixa de filtrar; a conversacional filtra só `linha`). **As Visualizações já salvas com `kind: carga` viram `lista` pela `010`** (D-18).

### Bloqueio de aspecto e Lista sem bloqueio (2.6.3, 2.6.4, 2.6.5) — fechado no documento de tarefas, sem discussão com o dono

- **D-15:** `blocks` passa de `StructuralContainerBase` para `Space` e `Folder` (Lista nunca é bloqueada); tira `blocks: {}` de `createList` e de `solicitacao-de-pagamento-evolver.ts`; `blockedAbove` e `instantiateListTemplate` leem `blocks` só de Espaço e Pasta. `bloqueado` sai de `InheritanceMode` e `MODE_LABEL.bloqueado` sai de `container-settings.tsx`; o bloqueio mora só em `blocks` (um contêiner pode sobrescrever e bloquear ao mesmo tempo).
- **D-16:** `setContainerBlock(state, actingMemberId, tipo: "space" | "folder", id, aspecto, bloqueado)` exige administrar e contêiner ativo. Para os aspectos que **substituem** (`statusSet`, `features`, `defaultViews`), **recusa enquanto algum descendente sobrescrever o aspecto, e nomeia quais na mensagem** (RN-ESP-09); para os que **acumulam** (`fieldDefinitions`, `taskTypes`, `automations`), bloquear vale só para o que for criado depois (os existentes ficam). Função auxiliar `sobrescritasAbaixo(state, tipo, id, aspecto)` em `derive.ts`, usada pela operação e pela tela. `criarAutomacao` passa a conferir `blockedAbove(…, "automations")` quando o escopo for Pasta ou Lista. Atividade "Aspecto bloqueado"/"Aspecto desbloqueado" com o aspecto em `detail`. Na tela: interruptor "Bloquear para os níveis abaixo" nas abas de aspecto das Configurações de Espaço e Pasta; com sobrescritas abaixo ele fica desligado e lista as Pastas/Listas, cada uma com link para as Configurações dela. No topo de cada aba de aspecto: "Herdado de X", "Definido aqui" ou "Bloqueado por Pasta X" (com editores desligados e o motivo).

### Limpeza das telas (2.1.4–2.1.10) — fechado no documento de tarefas

- **D-17:** Seguem o documento como escrito: **2.1.4** `SelecaoEmLote` única em `features/estrutura/selecao-em-lote.tsx`, montada uma vez nas três lentes; **2.1.5** apagar a nota do Quadro, as duas frases de ajuda, trocar a contagem por "Mostrando X de Y Tarefas." e apagar o botão "De modelo" da conversacional; **2.1.6** `Quadro` → `quadro-de-tarefas.tsx`, `Tabela` → `tabela-plana.tsx`, as três barras de criação → `barra-de-criacao.tsx` (`BarraDeCriacao`, por lente), página **abaixo de 1.000 linhas** (hoje 1.407); **2.1.8** Configurações em `Abas` (`design/basicos.tsx`) com `?aba=` na URL (Geral, Status, Funcionalidades, Campos, Tipos de Tarefa, Visualizações e, só na Lista, Formulários e "Modelo e canais"), apagando a tabela "Aspectos configuráveis", `ASPECTS` e `REGRA_DOS_MODOS`; **2.1.9** página do Espaço no formato da Pasta (seções Listas e Pastas, menu "Criar", sem o painel "Atributos"; Privado vira selo ao lado do título, "Criado por" vai para a aba Geral; Painéis só quando houver); **2.1.10** os 13 códigos de regra saem dos textos (`(RN-…)`, `(INV-…)`, `(B<n>)`, `(A<n>.<n>)`) e nasce `sem-codigo-de-regra.test.ts`. **Aprovação:** o dono abre a Lista, o Espaço, a Pasta e as Configurações e aprova cada uma na UAT de fim de fase (`human_verify_mode: end-of-phase`).

### Migração e fechamento

- **D-18:** **A `010` é só de dados** (nenhum DDL): (a) `update plataforma.registros set dados = jsonb_set(dados, '{kind}', '"lista"') where colecao = 'views' and dados->>'kind' = 'carga'` (2.5.3); (b) `update plataforma.registros set dados = dados - 'blocks' where colecao = 'lists'` (2.6.3). Contar **antes** (`select count(*) …` das duas) e depois (deve dar 0). Migração aplicada é imutável (D-DEC-10); roda por `DATABASE_URL_MIGRACAO`. — **Reversibility:** one-way — migração aplicada é imutável e a Visualização de Carga já virou Lista; correção seria a `011`.
- **D-19:** **A `010` é aplicada em produção dentro da fase**, no padrão de 07-13 e da 008: `npm run migrar -w @n1/api -- --seco` lista o que faria, o dono confere as contagens e só então aplica (checkpoint `[BLOCKING]`). Produção tem dado real e `n1_api` desde a 09-20; a `010` não precisa de privilégio novo.
- **D-20 (herdado da Fase 9, vale para todas as operações novas):** `moveContainer`, `reorderContainers`, `setContainerDefaultViews` e `setContainerBlock` entram na tabela **"Quem pode"** de `packages/dominio/CONTEXT.md` (§ "Quem pode (1.2.4)") e passam em `packages/dominio/src/quem-pode.test.ts`; `setMemberCapacity` sai dela. Entram também no inventário/matriz de Papéis da suíte adversarial (`apps/api`, job `seguranca`), e Membro `suspenso` recebe 403 como em qualquer `POST /operacoes`.
- **D-21 (relação com a Fase 12):** A Fase 10 roda **antes** da 12. Se a 12 escolher o caminho A (tabelas próprias de Espaço/Pasta/Lista), ela copia as linhas de Lista **depois** da `010`, então a `010` não colide. Registrar isso no fechamento da 10.
- **D-22 (2.7, itens dos testes):** O dono **não trouxe itens novos** da 2.7 nesta discussão. Se aparecerem antes de planejar, entram um por subtarefa; os que não mexerem em Espaço, Pasta, Lista ou Configurações vão para a Fase 11.

### Requisitos derivados (proposta; registrar em `REQUIREMENTS.md` ao planejar)

O ROADMAP deixou "Requirements: TBD (definidos no discuss)". Derivação por tarefa:

| ID | Cobre | Critério |
|---|---|---|
| EST-01 | 2.1.1–2.1.3, D-01..D-04 | Nenhuma tela tem "Rodar agenda da Lista" nem "Rodar automações por vencimento"; Lista com Tarefa recorrente por calendário e sem Automação por vencimento gera a próxima ocorrência pelo agendador, sem ensaio; o dono confirmou o agendador ligado em produção antes de o botão sair |
| EST-02 | 2.1.4–2.1.6, D-17 | Uma só `SelecaoEmLote` nas três lentes; sem frases de explicação nem "De modelo"; contagem "Mostrando X de Y Tarefas."; `listas/[lista]/page.tsx` abaixo de 1.000 linhas; `npm run check` passa |
| EST-03 | 2.1.8, 2.1.9, D-17 | Configurações em abas com `?aba=`; "Aspectos configuráveis" não aparece em tela nenhuma; página do Espaço no formato da Pasta, com Painéis só quando houver |
| EST-04 | 2.1.10, D-17 | `sem-codigo-de-regra.test.ts` passa; os 13 textos sem código entre parênteses |
| EST-05 | 2.3.1, 2.3.2, D-08, D-11 | `moveContainer` e `reorderContainers` no domínio com `mover-conteiner.test.ts` cobrindo mesmo Conjunto, Conjunto diferente com e sem mapeamento, Campo arquivado, Pasta com Subpastas recusada, promoção/rebaixamento, destino que bloqueia; reordenar por grupo (Espaços, Pastas, Listas) |
| EST-06 | 2.3.3, D-09, D-10, D-12 | Arrastar Lista/Pasta na árvore move (na hora se sem consequência; diálogo se houver) ou reordena dentro do grupo; Espaços reordenam; "Mover para…" no menu; recusa do domínio no diálogo ou `Toast`; ordem nova continua depois de recarregar |
| EST-07 | 2.5.1–2.5.5, D-13, D-14 | Nenhuma Lista oferece a Carga (5 abas; conversacional 4); a API recusa `saveView` com `kind: carga` (400); `grep -rn workload` e `weeklyCapacityMinutes` sem achados; coluna "Capacidade/sem" fora |
| EST-08 | 2.6.1, 2.6.2, D-06, D-07 | Mudar as Visualizações padrão no Espaço muda as abas das Listas abaixo; `visualizacoes-padrao.test.ts` passa; Visualização salva de tipo indisponível some da barra e volta junto |
| EST-09 | 2.6.3, 2.6.4, D-15 | O tipo não deixa escrever `blocks` numa Lista; `bloqueado` fora de `InheritanceMode` |
| EST-10 | 2.6.5, D-16 | `setContainerBlock` e o interruptor "Bloquear para os níveis abaixo"; `bloqueio-de-aspecto.test.ts` passa, inclusive a recusa que nomeia a Pasta que sobrescreve e `criarAutomacao` recusada sob bloqueio |
| EST-11 | 2.5.3, 2.6.3, D-18, D-19, D-20 | `010` aplicada em produção após `--seco`; `count(*)` de `views` com `kind = 'carga'` e de `lists` com `blocks` dá 0; as quatro operações novas na tabela "Quem pode" |

### Claude's Discretion

- Nomes de módulos, esquemas e testes; forma interna de `reorderContainers` e `sobrescritasAbaixo`; onde mora `VISUALIZACOES_DA_PLATAFORMA`.
- Como classificar, no agendador, as Listas "só recorrência" (sem ensaio) das "com Automação por vencimento" (com ensaio), sem duplicar regra do domínio (D-02).
- Desenho das zonas de soltura da árvore (em cima × entre irmãos), do destaque durante o arrastar e do caminho por teclado/leitor de tela (o "Mover para…" cobre o essencial).
- Texto exato dos avisos, das recusas novas e das linhas "Herdado de…/Definido aqui/Bloqueado por…".
- Quantos planos e em que ondas, respeitando a **ordem interna** do domínio e a sequência 2.1.6 → 2.5.4 → 2.6.2 na página da Lista.

### Ações do dono (não são código; entram como checkpoints do plano)

- **2.1.3:** confirmar `AUTOMACOES_WORKER_ATIVO=true` em produção e o log "scheduler de Automações ativo" (D-04). **Bloqueia a saída do botão.**
- **010:** conferir a saída de `--seco` e as contagens antes de aplicar em produção (D-19).
- **Pendência herdada (STATE.md/Fase 9):** reconectar o conector do Supabase do claude.ai à organização "N1" — nesta sessão ele ainda listou só os projetos `rede-social`/`dev_igor_rede_social`, então não foi possível contar Listas em produção que dependem do botão nem Visualizações `carga` já salvas. O dono pode pedir essas contagens depois de reconectar, ou rodá-las na 010 (`--seco`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Escopo da fase (fonte principal)
- `docs/09-planejamento/TAREFAS-POR-SESSAO.md` linhas 405–779 (Sessão 2) — as 42 subtarefas com "Hoje / O que fazer / Pronto quando". **Os números de linha de código citados ali deslocaram com a Fase 9: procurar de novo antes de planejar** (ex.: a página da Lista tem 1.407 linhas, não 1.404). A Fase 10 cobre 2.1, 2.3, 2.5 e 2.6.1–2.6.5; **2.2 é da Fase 12 e 2.4 e 2.6.6–2.6.9 são da Fase 11**.
- `docs/09-planejamento/PLANO-DE-IMPLEMENTACAO.md` — visão por sessão e datas
- `.planning/ROADMAP.md` § Phase 10 — escopo, ordem interna, decisões do dono

### Camadas e regras
- `CONTEXT.md` (raiz) — mapa das camadas; mudou "o que a coisa é" → `packages/dominio/` primeiro
- `AGENTS.md` e `apps/web/AGENTS.md` — Next.js desta versão tem breaking changes: ler `node_modules/next/dist/docs/` antes de codar páginas
- `packages/dominio/CONTEXT.md` § "Quem pode (1.2.4)" e `packages/dominio/src/quem-pode.test.ts` — toda operação nova entra na tabela (D-20)
- `apps/api/src/persistencia/CONTEXT.md`, `apps/api/src/rotas/CONTEXT.md` — Unidade de Trabalho, regra das migrações (imutáveis)
- `.planning/phases/09-seguran-a-dos-dados-e-base-de-produ-o/09-CONTEXT.md` — `n1_api`, `DATABASE_URL_MIGRACAO`, "Quem pode", suíte adversarial
- `.planning/phases/07-crm-contatos-empresas-funis-e-negocios/07-CONTEXT.md` D-12 e `.planning/phases/08-*/08-CONTEXT.md` — padrão de aplicar migração só após `--seco` e conferência

### Ontologia da Estrutura de Trabalho
- `ontologia/02-estrutura-de-trabalho/espaco.md` (Visualizações padrão linha ~94, RN-ESP-08/09/19, "Reordenar" ~222, bloqueio ~344), `pasta.md`, `subpasta.md` (RN-SUB-02, RN-SUB-11, RN-SUB-12), `lista.md`, `tarefa.md`
- `ontologia/DECISOES-E-PENDENCIAS.md` — B25, B37, B38, B47 (códigos que saem dos textos visíveis, 2.1.10)
- Artefato "Estrutura de Trabalho N1" (https://claude.ai/artifact/17AN5zBWHny2oP9BFLRPCf) — a fonte dos testes do dono

### Código a mudar (confirmado no scout de 2026-10-28)
- `packages/dominio/src/operations/structure.ts` (828 linhas: `createSpace/Folder/List`, `updateContainer`, `archive/unarchive/trash/restoreContainer`, `nameTaken`), `operations/configuration.ts` (`blockedAbove`, `setContainerFeature`), `operations/planning.ts` (`instantiateListTemplate`, `setMemberCapacity`), `operations/scale.ts` (`saveView`), `operations/tasks.ts` (`StatusMapping`, `moveTask`), `operations/registro.ts`, `operations/index.ts`, `derive.ts` (`effectiveContainerConfig`, `workload`), `types/structure.ts`, `types/workspace.ts`, `solicitacao-de-pagamento-evolver.ts`, `seed.ts`
- `apps/api/src/automacoes/scheduler-worker.ts` (`catalogoDeListasComAgenda`, `ENSAIO_PRIMEIRA_VOLTA`, `MARCO_ZERO`), `apps/api/src/index.ts`, `apps/api/src/rotas/esquemas/{estrutura,configuracao,escala,planejamento}.ts`, `apps/api/migracoes/` (a próxima é `010`)
- `apps/web/src/app/(shell)/estrutura/{listas/[lista],espacos/[espaco],pastas/[pasta]}/page.tsx`, `features/estrutura/{bulk-status-bar,container-settings,view-bar,tipo-de-visualizacao,planning-views,create-container-dialog,move-task-dialog,collaboration-editors,tarefa-completa}.tsx`, `features/estrutura/financeiro/{contas-view,serie-dialog}.tsx`, `features/shell/app-shell.tsx` (`StructureTree`, `TreeSpace`, `TreeFolder`, `TreeList`, `TreeRow`), `design/basicos.tsx` (`Abas`), `app/(shell)/configuracoes/membros/page.tsx`

### Banco
- `apps/api/migracoes/001-plataforma.sql` — `plataforma.registros` (onde Espaço/Pasta/Lista/Visualização vivem como jsonb) e `plataforma.workspaces`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `move-task-dialog.tsx` + `StatusMapping` (`tasks.ts`): o diálogo e o tipo do mapeamento de Status que `moveContainer` e o novo `mover-conteiner-dialog.tsx` reaproveitam.
- `Abas` (`design/basicos.tsx`), `Pilula`, `ReguaDeSecao`, `useCreateContainerDialog` (`openCreate`): peças das Configurações em abas e da página do Espaço no formato da Pasta (`pastas/[pasta]/page.tsx` é o modelo).
- `PUT /funis/:id/etapas/ordem` (CRM): precedente de "recebe a permutação completa" para `reorderContainers`.
- `setContainerFeature` (`configuration.ts`) e `blockedAbove`: o gabarito de `setContainerDefaultViews` e `setContainerBlock`.
- HTML5 drag nativo já usado em `quadro.tsx`, `cartao-de-tarefa.tsx`, `calendario-mensal.tsx`, `quadro-do-funil.tsx` e na árvore de Chat (`moveChatSessionToFolder`).
- `scheduler-worker.ts`: `runScheduledAutomations`, `runCalendarRecurrences`, `purgeExpiredTasks` já são chamados por Lista; a mudança é **quais pares** o catálogo devolve.

### Established Patterns
- Operação nova de domínio = tipo → operação → `registro.ts` + `index.ts` → esquema em `apps/api/src/rotas/esquemas/` (`satisfies EsquemasCompletos` não compila sem ele) → teste de domínio → tabela "Quem pode".
- Atividade em toda mutação (`recordActivity`), `OperationResult` como valor (nunca exceção pela fronteira), `readonly` como invariante, nada derivado é armazenado.
- A árvore respeita privacidade (B38a): contêiner privado só aparece com concessão; Convidado vê a árvore inerte (`inert`).
- Migração SQL numerada e imutável; `--seco` antes de aplicar; dados de teste de persistência pulam sem `DATABASE_URL`.

### Integration Points
- A tela da Lista tem **uma** ponta compartilhada com a Fase 11: `tarefa-completa.tsx` (a 2.1.10 apaga códigos de regra de lá). Coordenar para a Fase 11 partir do arquivo já limpo.
- `Folder.order` e `List.order` são contadores **separados** por pai; a árvore (`app-shell.tsx` ~714–727) e as páginas do Espaço e da Pasta mostram Pastas e depois Listas.
- `view-bar.tsx` lê `abaDaView(view.kind)` e `ROTULO_DA_ABA`: é onde D-06 filtra por tipo disponível.
- `collaboration-editors.tsx` (texto sobre "Rodar agenda da Lista") e `contas-view.tsx` (menu "Automatizar") também referenciam o botão.

</code_context>

<specifics>
## Specific Ideas

- O dono quer que as telas mostrem **só o que a pessoa usa**: sem botão de depuração, sem frase que explique a regra, sem código interno entre parênteses, sem tabela didática nas Configurações.
- Mover: "arrastar a Lista Propostas para a Pasta Clientes na árvore move a Lista e as Tarefas dela; arrastar uma Pasta com Subpastas para dentro de outra Pasta mostra a recusa e nada muda".
- Bloquear: "bloquear os Status num Espaço impede uma Lista de mudá-los"; com sobrescrita abaixo, o bloqueio é recusado e a mensagem nomeia a Pasta.
- Visualizações padrão: "desmarcar Calendário nas Configurações do Espaço Entrega faz a aba sumir de todas as Listas dele"; "escolher Quadro como inicial faz as Listas sem Visualização padrão própria abrirem no Quadro".

</specifics>

<deferred>
## Deferred Ideas

- **Tabela como planilha** (sem grupos, uma coluna por Campo, editável na célula, como no ClickUp; ~1,5 dia): só se o dono sentir falta dos Campos na Tabela durante os testes (2.1.7, escolha C descartada por ora).
- **Pastas e Listas misturadas na mesma ordem**, como no ClickUp (D-08 descartou): exigiria unificar `order` e redesenhar árvore e páginas.
- **Confirmação em todo arrastar** (D-10 descartou): fica o "Mover para…" para quem prefere escolher.
- **Converter pelo cartão do Quadro, subitens de checklist, menção na descrição, texto anterior e tempo registrado**: Fase 11.
- **Medir e acelerar a gravação / tabelas próprias de Espaço, Pasta e Lista**: Fase 12.
- **Recorrência e lixeira em todas as Listas (19.1)**: a parte do agendador vem para cá (D-01); o que sobrar da 19.1 continua na Sessão 19.

### Reviewed Todos (not folded)
None — nenhum todo casou com esta fase.

</deferred>

---

*Phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista*
*Context gathered: 2026-10-28*
