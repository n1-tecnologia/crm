---
phase: "10"
slug: clone-clickup-cont-ineres-espa-o-pasta-e-lista
status: approved
shadcn_initialized: false
preset: none
created: "2026-10-28"
reviewed_at: "2026-10-28"
---

# Phase 10 — UI Design Contract

> Contrato visual e de interação da Phase 10 (Clone ClickUp: Contêineres — Espaço, Pasta e Lista). Gerado por `gsd-ui-researcher` sem perguntas ao usuário (a execução não tinha canal para perguntar), a partir de 10-CONTEXT.md (D-01..D-22, travadas), 10-DISCUSSION-LOG.md, `docs/09-planejamento/TAREFAS-POR-SESSAO.md` (Sessão 2, linhas 405–779), dos baselines 07-UI-SPEC.md e 09-UI-SPEC.md e do código de `apps/web` como está em 2026-10-28.
>
> Convenção de procedência (herdada da Fase 9): `(D-NN)` = decisão travada de 10-CONTEXT.md; `(2.x.y)` = subtarefa de `TAREFAS-POR-SESSAO.md`; `[auto]` = inferido pelo pesquisador, sem decisão do dono por trás. Toda inferência `[auto]` está repetida em «Premissas e itens em aberto». Nenhuma D-NN foi contradita.

---

## Nota de escopo — leia antes do resto

Esta fase **não cria sistema de design, token nem componente de `design/`**. Ela troca peças de protótipo por telas que mostram só o que a pessoa usa (o parecer do dono: sem botão de depuração, sem frase que explique a regra, sem código interno entre parênteses, sem tabela didática) e acrescenta quatro gestos novos sobre contêineres: **mover, reordenar, Visualizações padrão e bloquear aspecto**. Tudo é composição de `@/features/shell/ui`, de `design/basicos.tsx` (`Abas`, `Pilula`, `ReguaDeSecao`) e de peças que já existem em `features/estrutura/`.

**Regra de dependência (CONTEXT.md raiz):** o domínio nasce antes da tela. Este contrato **depende de cinco leituras puras do domínio** (próxima seção). A tela nunca reescreve uma regra: ela lê a recusa e a mostra literal (doutrina de 05/07/09: a frase é do domínio, a tela não a reescreve).

**Superfícies deste contrato**

| ID | Superfície | Origem |
|---|---|---|
| S1 | Árvore de navegação: arrastar para reordenar e mover; menu de linha; árvore inerte para Convidado | 2.3.3, D-08, D-09, D-10, D-12 |
| S2 | Diálogo «Mover para…» (`mover-conteiner-dialog.tsx`) e diálogo de consequência | 2.3.3, D-10, D-11 |
| S3 | Menus de Pasta e de Lista: item «Mover para…» (e «Subir»/«Descer») | 2.3.3, D-10 |
| S4 | Configurações do contêiner em abas (`?aba=`), linha «Herdado de / Definido aqui / Bloqueado por» | 2.1.8, D-16, D-17 |
| S5 | Aba «Visualizações» e o consumo dela na página da Lista | 2.6.1, 2.6.2, D-06, D-07 |
| S6 | Interruptor «Bloquear para os níveis abaixo» | 2.6.5, D-15, D-16 |
| S7 | Página da Lista: limpeza, barra única de seleção, abas sem Carga, contagem | 2.1.1, 2.1.4–2.1.6, 2.5.4, D-03, D-05, D-17 |
| S8 | Página do Espaço no formato da Pasta | 2.1.9, D-17 |
| S9 | Configurações de Membros sem «Capacidade/sem» | 2.5.5, D-13 |
| S10 | Textos: os 13 códigos de regra fora do texto visível; textos de ajuda do botão que sai | 2.1.10, D-03, D-17 |

**Fora do escopo visual (não especificar, não inventar):** o agendador, a `010`, as quatro operações no domínio, a suíte adversarial e a tabela «Quem pode» (D-20); o checkpoint do dono sobre `AUTOMACOES_WORKER_ATIVO` (D-04); Tabela virar planilha, Pastas e Listas misturadas, confirmação em todo arrastar (Deferred); qualquer item da Fase 11 (`tarefa-completa.tsx` só perde três códigos, S10); Fase 12.

### Dependências de domínio exigidas por este contrato

A tela precisa **ler** estas respostas antes de agir, para desligar com o motivo o que a operação recusaria (padrão `containerAdminRefusal` / `blockedAbove` já usado pelos editores). Os nomes são livres (Claude's Discretion); o que importa é existirem como funções puras de `@n1/dominio` e serem usadas **pela operação e pela tela**, para as duas nunca divergirem.

| # | Leitura | Quem usa | Devolve |
|---|---|---|---|
| L1 | recusa de mover (`tipo`, `id`, `destino`) — tudo que `moveContainer` recusa exceto «falta o mapeamento» | S1 (ao soltar), S2 (opção desligada, botão Mover) | frase do domínio ou `undefined` |
| L2 | consequências de mover — o Conjunto de Status efetivo muda? Quais Status estão em uso nas Tarefas abaixo (e quantas Tarefas por Status)? Quais Campos deixam de valer e quantos Valores `ativo` há neles? | S1 (decide mover na hora × abrir diálogo), S2 (tabela e aviso) | `{ conjuntoMuda, statusEmUso[], camposQueSaem[], valoresAfetados }` |
| L3 | recusa de reordenar (`pai`, `tipo`) — falta `editar` no pai, pai inativo, primeiro/último | S1 e S3 («Subir»/«Descer» desligados com motivo) | frase ou `undefined` |
| L4 | `sobrescritasAbaixo(state, tipo, id, aspecto)` (já previsto em D-16) | S6 | lista de contêineres `{ tipo, id, nome }` |
| L5 | quem bloqueia um aspecto acima (hoje `blockedAbove` devolve só a frase) | S4 (linha «Bloqueado por Pasta X») | o contêiner `{ tipo, id, nome }` além da frase |

---

## Design System

`[auto] derivado de 07-UI-SPEC.md e 09-UI-SPEC.md` (herdado verbatim; nada em 10-CONTEXT.md o sobrepõe). `apps/web/components.json` não existe → o gate shadcn **não se aplica** (resposta herdada: sistema próprio, não shadcn). Conferido de novo em 2026-10-28.

| Property | Value |
|----------|-------|
| Tool | none — sistema de design próprio (não shadcn) |
| Preset | não aplicável |
| Component library | `apps/web/src/design/` (`components.tsx`, `basicos.tsx`, `tela.tsx`, `esqueletos.tsx`, `icone.tsx`, `segmentos.tsx`), consumido pelo barril `@/features/shell/ui`; `PageHeader`/`Section`/`Card` do próprio barril |
| Icon library | `lucide-react`, sempre pelo envoltório `Icone` (traço 1.5; tamanhos `xs/sm/md/lg`). Exceção herdada: a árvore usa os ícones lucide direto (`app-shell.tsx`) |
| Font | SF Pro Display (marca N1); Inter via `next/font` como reserva (`--font-sans`) |

Regra de importação herdada: telas importam **só** de `@/features/shell/ui`. **Sem biblioteca nova** (D-12): arrastar usa o HTML5 nativo; `apps/web/package.json` não ganha `dnd-kit` nem similar. Se a implementação concluir que o HTML5 não basta, passa pelo portão de legitimidade de pacote (checkpoint humano antes do `npm install`); este contrato foi escrito para **não precisar** dele.

---

## Component Inventory

Enumerated by `bash -c "grep -hE '^export (function|const) [A-Z]' apps/web/src/design/{components,basicos,tela,esqueletos,icone,segmentos}.tsx | wc -l"` — 43 exports de valor em `design/` — @n1/web@0.1.0 — 2026-10-28.
Enumerated by `bash -c "grep -hE '^export (function|const) [A-Z]' apps/web/src/features/shell/{ui,quadro,record-list}.tsx | wc -l"` — 10 exports de valor em `features/shell/` — @n1/web@0.1.0 — 2026-10-28.

A versão vem de `node -p "require('./package.json').name+'@'+require('./package.json').version"` em `apps/web` (pacote interno do monorepo, sem versão publicada). A tabela é uma lista **não exaustiva** de componentes conhecidos; o executor pode usar qualquer export do barril. Props e comportamentos abaixo foram **lidos nos arquivos hoje**, não recordados.

| Componente | Import | Papel nesta fase |
|---|---|---|
| `Abas` (`abas`, `ativa`, `aoTrocar`, `acao`, `rotulo`) | `@/features/shell/ui` | Abas das Configurações (S4) e das Visualizações da Lista (S7). `role="tablist"`/`tab`, `aria-selected`; **não** liga aba a painel nem tem setas (A13) |
| `Pilula` (`tom`: neutro/acento/sucesso/info/aviso/erro) | `@/features/shell/ui` | «Privado» (S8), «Definido aqui» / «Herdado de…» / «Bloqueado por…» (S4) |
| `ReguaDeSecao` (`rotulo`, `contagem`) | `@/features/shell/ui` | Seções Listas / Pastas / Painéis (S8), molde de `pastas/[pasta]/page.tsx` |
| `ActionMenu` (`items: ItemDeMenu` com `disabledReason`, `icone`, `detalhe`; `desligadoPor`; `trigger`) | `@/features/shell/ui` | Menu de linha da árvore, «Criar», «Mais ações», «Mover para…» (S1, S3, S8) |
| `ConfirmDialog` (`confirmDisabledReason`, `wide`, `footerStart`) | `@/features/shell/ui` | Diálogo «Mover para…» (S2) |
| `Select` (`searchable`; `Option` com `detail`, `disabledReason`) | `@/features/shell/ui` | Destino e mapeamento de Status (S2) |
| `Field` (`label`, `hint`, `error`) | `@/features/shell/ui` | Campos do diálogo (S2) |
| `Toggle` (`labelledBy`, `describedBy`, `disabled`) | `@/features/shell/ui` | «Bloquear para os níveis abaixo» (S6) |
| `Toast` (`tone`; erro não expira, `role="alert"`; sucesso expira, `role="status"`) | `@/features/shell/ui` | Avisos de mover/bloquear/Visualizações; recusas (S1–S6) |
| `EmptyState`, `Button` (`disabledReason`), `StateSeal`, `Icone`, `RecordPanel`, `Painel`, `CabecalhoDePainel` | `@/features/shell/ui` | Estados vazios, ações, selos |
| `PageHeader` (`seal`, `meta`, `actions`, `path`), `CorpoDeTela`, `BarraDeFiltros` | `@/features/shell/ui` | Esqueleto de toda tela |
| `useRecente` | `@/features/shell/recente` | Acende a linha recém-movida na árvore (`--acento-lavado`, `--dur-realce`) |
| `STATUS_CATEGORY_LABEL`, `FIELD_TYPE_LABEL` | `@/features/shell/format` | Categoria de Status por extenso no diálogo (S2) |
| `ReadOnlyNote` (hoje privado em `configuration-editors.tsx`) | exportar de lá | «Somente leitura: {motivo}» nas abas desligadas (S4, S6) |

**Peças novas desta fase** (composições em `features/estrutura/` e `features/shell/`; nenhuma entra em `design/`): `MoverConteinerDialog` + `useMoverConteinerDialog` (S2), `CabecalhoDoAspecto` (linha de origem + interruptor, S4/S6), `EditorDeVisualizacoesPadrao` (S5), `SelecaoEmLote` e `BarraDeCriacao` (S7, já nomeados em 2.1.4/2.1.6), e o comportamento de arrastar dentro de `StructureTree`/`TreeRow` (S1).

Reutilizados **sem edição**: `StatusSetEditor`, `FieldDefinitionsEditor`, `TaskTypesEditor`, `FeaturesEditor`, `FormsEditor`, `CanaisDeAtendimento`, `IdentidadeDoConteiner`, `CicloDeVidaDoConteiner` (só mudam de lugar, S4).

---

## Spacing Scale

Declared values (múltiplos de 4; tokens `--e-*` de `apps/web/src/estilos/tokens.css`; nada literal fora de token — `npm run verificar:tokens` reprova cor crua, fonte literal e duração literal):

| Token | Value | Usage nesta fase |
|-------|-------|-------------------|
| xs | 4px (`--e-1`) | Vão entre ícone e rótulo; entre `Pilula` «Privado» e o título |
| sm | 8px (`--e-2`, `gap-2`) | Entre controles da barra de criação; entre o interruptor e a linha de origem (S4) |
| md | 16px (`--e-4`, `gap-4`, `px-4`) | Padding horizontal das `Abas` (já no componente); entre campo e campo no diálogo (`gap-3` = 12px, `--e-3`) |
| lg | 24px (`--e-6`, `gap-6`) | Entre seções da página do Espaço (igual à da Pasta) |
| xl | 32px (`--e-8`) | Não usado |
| 2xl | 48px (`--e-12`) | Não usado |
| 3xl | 64px (`--e-16`) | Não usado |

Recuo da árvore: `depth × 12px` (já em `TreeRow`; 12 é múltiplo de 4). A linha de inserção do arrastar começa no recuo do rótulo (`depth × 12px + 24px`, a largura do botão de expandir).

Alvo de toque: a linha da árvore, o «+» e o «⋯» mantêm 24px de largura de alvo (herdado; o sistema não os subiu a 44px na barra lateral). Botões e itens de menu fora da árvore seguem `--controle-h-lg` (44px) em tela de toque, como o `Button` já faz.

Exceptions:
- A linha de inserção do arrastar tem **2px** de espessura (é traço, como as bordas de 1px; não é espaçamento).
- `max-w-3xl` (48rem, = `--modal-lg`) como largura do conteúdo de aba de Configurações: classe do sistema, nenhuma largura literal nova. Larguras de diálogo vêm de `--modal-*` via `wide`.
- Atraso de 600ms para abrir um contêiner fechado durante o arrastar (A8) é tempo de interação, não movimento; fica em constante nomeada, não em CSS.

---

## Typography

`[auto] derivado de 09-UI-SPEC.md` (escalas do sistema em `estilos/tipografia.css`; todo tamanho é uma classe; `npm run verificar:tokens` reprova `text-[Npx]` e `fontSize` literal). Quatro tamanhos, dois pesos.

| Role | Size (classe) | Weight | Line Height |
|------|------|--------|-------------|
| Body | `.app-base` — 13px piso (14/15/16 nos degraus de tela) | 400 regular | `var(--app-base-lh)`, ≈1.54× |
| Label | `.app-sm` — 12px piso — dicas, motivos de desligado, cabeçalho de coluna do editor de Visualizações | 400 regular | `var(--app-sm-lh)`, ≈1.33× |
| Meta | `.app-meta` — 11px piso, cor `--texto-4` — linha de origem, «Criado por», contagens | 400 regular | `var(--app-xs-lh)`, 1rem no piso |
| Heading | `.app-md` — 14px piso (15/16/17 nos degraus) — nome de item em lista de página | 500 (peso da própria classe) | `var(--app-md-lh)`, 1.25rem no piso |
| Display | não usado — nenhuma tela nova de nível de página | — | — |

**Dois pesos: 400 (todo texto novo) e 500 (herdado de `.app-md`, de `.btn` e da aba ativa de `Abas`).** O 600 não é usado por texto novo. Título de `ConfirmDialog` (`.ed-subtitulo`) e de `PageHeader` são dos componentes e não são redeclarados. Valores numéricos (contagens, «12 abertas») levam `.app-numero`. Nenhum `fontWeight` nem `text-[Npx]` arbitrário novo.

---

## Color

`[auto] derivado de 07/09-UI-SPEC.md`. Estrutura de `estilos/tokens.css`: preto quase puro segurando a página, lavagens de branco em alfa como superfície, roxo escasso como acento. **Nenhum hex novo, nenhum token novo** — todo valor é `var(--token)`.

| Role | Value | Usage nesta fase |
|------|-------|-------|
| Dominant (60%) | `--page` `#0f0f10` / `--card` `#161617` | Fundo de tela; corpo opaco do `ConfirmDialog` |
| Secondary (30%) | `--superficie-1/2/3` (branco 3–5% alfa), `--superficie-hover` | Barra lateral, `Painel`, `item-solto`, linha da árvore em hover, painel de «Somente leitura» |
| Accent (10%) | `--acento` (roxo `#c084fc`), `--acento-lavado`, `--linha-acento` | Reservado — lista fechada abaixo |
| Destructive | `--erro` (`#fca5a5`) / `--erro-lavado` | **Nenhuma ação destrutiva nova.** Só texto de recusa (`p role="alert"`) e `Toast tone="error"` |

Cores semânticas já existentes e reaproveitadas: `--aviso` / `--aviso-lavado` para o painel «Campos que deixam de valer» (S2) e para `Pilula tom="aviso"` «Bloqueado por…» (S4); `--info-lavado` para `Pilula tom="info"` «Definido aqui».

**Accent reserved for** (lista fechada desta fase):
1. O botão primário `btn-solido`, **um por tela ou diálogo**: «Criar» (menu da página do Espaço e da Pasta), «Nova Lista» (vazio), «Mover» (rodapé do diálogo S2), «Criar» da barra de criação da Lista (como hoje).
2. O sublinhado da aba ativa em `Abas`.
3. O realce de alvo do arrastar na árvore (S1): fundo `--acento-lavado` com contorno interno `--linha-acento` («soltar dentro») e a linha de inserção de 2px `--acento` («soltar antes/depois»). É a única cor nova de estado e vale só durante o gesto.
4. O fundo marcado de caixa, rádio e `Toggle` ligados (S5, S6) e o realce de `useRecente` na linha recém-movida.
5. O anel de foco do sistema.

Nada além disso. Em particular: o painel de consequência (S2) é âmbar (`--aviso`), **não** roxo; «Bloqueado por…» é âmbar; recusa é `--erro`. Cor nunca carrega sozinha o significado: todo estado de bloqueio, herança e alvo de soltura traz texto («Bloqueado por Pasta Clientes», «Herdado de…»); o alvo de soltura é anunciado depois pelo Toast.

---

## Copywriting Contract

Idioma: português do Brasil, «você» implícito, sem gíria; substantivos de domínio com inicial maiúscula (Espaço, Pasta, Subpasta, Lista, Tarefa, Visualização, Campo, Conjunto de Status, Membro). **As frases desta seção são literais**: o executor não reescreve; o teste procura o texto exato. `{…}` é variável. Plural real sempre («1 Tarefa», «3 Tarefas»; nunca «Tarefa(s)» em texto novo).

**Regra do dono (CONTEXT `<specifics>`):** nenhuma tela desta fase ganha frase que explique a regra, botão de depuração ou código `(RN-…)`/`(B…)`. Onde uma regra precisa aparecer, aparece como **motivo curto de um controle desligado** ou como **recusa do domínio**, nunca como parágrafo.

### Primary CTA, vazios, erros e destrutivo

| Element | Copy |
|---------|------|
| Primary CTA | **Mover** (rodapé do diálogo S2). Na página do Espaço: **Criar** (menu) e, no vazio, **Nova Lista**. A fase não cria botão de salvar: as abas gravam na hora |
| Empty state heading (Espaço vazio) | `Este Espaço está vazio.` |
| Empty state body | `Crie uma Lista ou uma Pasta pelo botão Criar.` + ação `Nova Lista` |
| Empty state (seção sem itens, o outro grupo tem) | `Nenhuma Lista.` / `Nenhuma Pasta.` (uma linha `.app-meta`, sem caixa) |
| Empty state (aba Campos / Tipos de Tarefa) | `Nenhum Campo ainda.` / `Nenhum Tipo de Tarefa ainda.` + hint `Use o formulário abaixo para criar o primeiro.` |
| Error state (recusa do domínio) | A **frase do domínio, literal**: `Toast tone="error"` na árvore (S1/S3); `p role="alert"` dentro do diálogo (S2); `Toast tone="error"` nas Configurações (S4–S6). Nada se move, nada se grava |
| Error state (sem frase: falha de rede/transporte) | `Não foi possível mover {a Lista|a Pasta|a Subpasta} {nome}. Tente de novo.` / `Não foi possível reordenar. Tente de novo.` / `Não foi possível salvar. Tente de novo.` |
| Destructive confirmation | **Nenhuma ação destrutiva nova.** Mover não apaga: os Valores de Campo ficam arquivados e voltam (B37, dito sem o código). Bloquear/desbloquear e mudar Visualizações não pedem confirmação (reversíveis). Nada de `window.alert`/`confirm` |

### Avisos de sucesso (`Toast tone="success"`, expiram)

| Evento | Copy |
|---|---|
| Lista movida | `Lista {nome} movida para {destino}.` — ex.: «Lista Propostas movida para Clientes.» (D-10) |
| Pasta movida (Espaço → Espaço; ou Pasta de nível 1 que continua Pasta) | `Pasta {nome} movida para {destino}.` |
| Subpasta movida (Pasta → outra Pasta) | `Subpasta {nome} movida para {destino}.` |
| Subpasta promovida (vai para um Espaço) | `Subpasta {nome} agora é Pasta em {destino}.` |
| Pasta rebaixada (Pasta sem Subpastas vai para outra Pasta) | `Pasta {nome} agora é Subpasta de {destino}.` |
| Reordenar (arrastar ou «Subir»/«Descer») | **sem Toast** — a linha mudar de lugar é o aviso (precedente 07-UI-SPEC: mover Negócio no quadro). Só a falha fala |
| Visualizações padrão alteradas | `Visualizações padrão alteradas.` + (se houver) ` {n} {Visualização salva|Visualizações salvas} de {Tipo} {fica guardada|ficam guardadas} e {volta|voltam} se o tipo voltar.` |
| Visualizações voltaram a herdar | `Visualizações padrão voltaram a ser herdadas.` |
| Aspecto bloqueado / liberado | ver tabela de gênero abaixo |

Aspecto × frase (concordância fixada; o `detail` da Atividade usa só o nome do aspecto):

| Aspecto (`ConfigurableAspect`) | Nome | Bloquear | Liberar |
|---|---|---|---|
| `statusSet` | Conjunto de Status | `Conjunto de Status bloqueado para os níveis abaixo.` | `Conjunto de Status liberado para os níveis abaixo.` |
| `features` | Funcionalidades | `Funcionalidades bloqueadas para os níveis abaixo.` | `Funcionalidades liberadas para os níveis abaixo.` |
| `defaultViews` | Visualizações padrão | `Visualizações padrão bloqueadas para os níveis abaixo.` | `Visualizações padrão liberadas para os níveis abaixo.` |
| `fieldDefinitions` | Campos | `Campos bloqueados para os níveis abaixo.` | `Campos liberados para os níveis abaixo.` |
| `taskTypes` | Tipos de Tarefa | `Tipos de Tarefa bloqueados para os níveis abaixo.` | `Tipos de Tarefa liberados para os níveis abaixo.` |

### Diálogo «Mover para…» (S2)

| Elemento | Copy |
|---|---|
| Título | `Mover “{nome}”` (aspas curvas, como `move-task-dialog.tsx`) |
| `description` (Lista, 0 Tarefas) | `A Lista muda de lugar.` |
| `description` (Lista, 1 Tarefa) | `A Lista e a sua Tarefa mudam de lugar juntas.` |
| `description` (Lista, n > 1) | `A Lista e as suas {n} Tarefas mudam de lugar juntas.` |
| `description` (Pasta/Subpasta) | `A Pasta, as Listas e as Tarefas dela mudam de lugar juntas.` (Subpasta: `A Subpasta, as Listas…`) |
| Campo | `Destino` · placeholder `Escolher destino` · busca interna do `Select` (`searchable`) |
| Opção do destino | rótulo = nome; `detail` = caminho acima (`Comercial › Clientes`), como `move-task-dialog.tsx` |
| Botão de confirmação | `Mover` · cancelar `Cancelar` |
| Confirmar desligado | `Escolha o destino.` · `{n} Status de origem ainda sem destino.` · `Movendo…` (durante a gravação, `carregando`) |
| Introdução da tabela de Status | `O destino usa outro Conjunto de Status. Escolha onde cada Status em uso passa a ficar.` |
| Linha da tabela | rótulo `{Status de origem} · {n} {Tarefa|Tarefas}` · placeholder `Escolher Status` · `Select` com os Status do destino (`detail` = categoria por extenso, `color` do Status) |
| Dica da linha (categoria não muda) | `Categoria de origem: {Categoria}` |
| Dica da linha (categoria muda) | `{n} {Tarefa passa|Tarefas passam} de {Categoria} para {Categoria}` + ` e {gera|geram} o evento de conclusão` quando o destino é «Concluído» |
| Painel âmbar (Campos que saem) | linha 1: `Campos que deixam de valer: {Campo A}, {Campo B}.` · linha 2: `{n} {Valor|Valores} {fica|ficam} arquivado{s} nas Tarefas. Nada é apagado.` |
| Recusa dentro do diálogo | a frase do domínio, literal, `p role="alert"` em `--erro`; o diálogo **fica aberto** |
| Opção desligada (destino que o domínio recusaria) | o `disabledReason` da opção é a frase de L1, ex.: «Uma Pasta com Subpastas não vai para dentro de outra Pasta.» (texto do domínio) |

### Menus e rótulos

| Onde | Copy |
|---|---|
| Item de menu de Pasta, Subpasta e Lista | `Mover para…` |
| Itens de ordem (Espaço, Pasta, Subpasta, Lista) | `Subir` · `Descer` · desligados com `Já está no topo.` / `Já está no fim.` ou a frase de L3 |
| Item «Mover para…» sem permissão | desligado com `disabledReason` = frase de `containerAdminRefusal` (mesma de todo editor) |
| Menu da Pasta (página) | gatilho `Mais ações` (ícone «⋯», `label="Mais ações"`); item `Mover para…` |
| Menu «Criar» (página do Espaço) | gatilho `Criar` (`label="Criar neste Espaço"`); itens `Lista`, `Pasta` (nessa ordem, como a árvore e a página da Pasta) |
| Selo do título (Espaço) | `Privado` (`Pilula` neutra com cadeado `xs`) |
| Linha «Criado por» | `Criado por {nome}` (`Sistema` se o Membro não existe, como a página de hoje) |

### Configurações em abas (S4–S6)

| Elemento | Copy |
|---|---|
| Rótulo da lista de abas (`rotulo`) | `Configurações` |
| Abas, nesta ordem | `Geral` · `Status` · `Funcionalidades` · `Campos` · `Tipos de Tarefa` · `Visualizações` · (só Lista) `Formulários` · `Modelo e canais` |
| Linha de origem — definido neste nível | `Definido aqui` (`Pilula tom="info"`) |
| Linha de origem — vindo de cima | `Herdado de {Espaço|Pasta|Subpasta} {nome}` (`Pilula tom="neutro"`), ex.: «Herdado de Espaço Comercial» |
| Linha de origem — sem definição acima | `Padrão da plataforma` (`Pilula tom="neutro"`) |
| Linha de origem — bloqueado por ancestral | `Bloqueado por {Espaço|Pasta|Subpasta} {nome}` (`Pilula tom="aviso"` + cadeado `xs`), seguida de `ReadOnlyNote` («Somente leitura: {frase do domínio}») |
| Aspecto que acumula (Campos, Tipos de Tarefa) | no lugar de «Herdado/Definido»: `{n} definidos aqui · {m} herdados` (`Campos`) / `{n} definidos aqui · {m} herdados` (`Tipos de Tarefa`), com singular real («1 definido aqui · 0 herdados») |
| Interruptor | rótulo `Bloquear para os níveis abaixo` (`Toggle`, `labelledBy`) |
| Dica do interruptor (só Campos e Tipos de Tarefa, quando ligado) | `Os já criados continuam valendo.` |
| Interruptor desligado por sobrescritas abaixo | linha 1 `Já definido em:` · lista de links `{Pasta|Subpasta|Lista} {nome}` (cada um para as Configurações dela, **na mesma aba**) · linha 2 `Volte a herdar neles para poder bloquear.` |
| Interruptor desligado por permissão/estado | `ReadOnlyNote` com a frase de `containerAdminRefusal` ou `Espaço arquivado: desarquive antes de editar.` (frases já existentes em `identidade-e-ciclo-de-vida.tsx`) |
| Editor de Visualizações — cabeçalhos | `Disponível` · `Inicial` |
| Editor de Visualizações — tipos (de `ROTULO_DA_ABA`) | `Lista` · `Quadro` · `Calendário` · `Tabela` · `Linha do tempo` |
| Motivo (tipo inicial não desmarca) | `É a Visualização inicial. Escolha outra antes de desmarcar.` |
| Motivo (Lista conversacional) | `Não existe em Listas conversacionais.` (linha «Linha do tempo», só nas Configurações de uma Lista conversacional) |
| Botão | `Voltar a herdar` (já é o texto de `FeaturesEditor`; só aparece com definição própria) |
| Geral | `Criado por {nome}` entre Identidade e Ciclo de vida |

### Página da Lista (S7)

| Elemento | Copy |
|---|---|
| Contagem filtrada | `Mostrando {X} de {Y} Tarefas.` (`Tarefa` se Y = 1; na lente financeira o substantivo é `contas`/`conta`, como o `meta` do cabeçalho — A20). Aparece **só** quando há filtro ativo; nada depois do ponto |
| Seleção (botão) | `Selecionar várias` ↔ `Sair da seleção` (os de hoje, uma só vez) |
| Seleção indisponível (a aba Lista não é oferecida) | botão desligado, `disabledReason` = `A seleção em lote só existe na Visualização Lista.` |
| Conversacional (barra) | só `Nova Tarefa` e `Selecionar várias` |
| Meus negócios (barra) | só `Iniciar conversa` |

### Texto de ajuda que sai com o botão (S7/S10, D-03)

`collaboration-editors.tsx:344` hoje: «A próxima nasce no dia do vencimento, pela agenda da Lista (o relógio do servidor ou o botão “Rodar agenda da Lista”)…». Depois: `A próxima nasce no dia do vencimento{; se esta ainda estiver aberta, espera a conclusão | ; se esta ainda estiver aberta, as duas coexistem}.` — a mesma cauda de hoje, sem a menção ao relógio nem ao botão.

### Atividade (o texto que chega às telas, D-11/D-16/D-07)

Os nomes são os dos decisões; a tela renderiza `before`/`after` como vierem do domínio. Formato pedido ao domínio para o que é legível por gente: mover grava o **caminho** (`Comercial › Clientes`); Visualizações padrão grava `{tipos separados por vírgula} · inicial {Tipo}` ou `herdadas`; bloqueio grava o **nome do aspecto** em `detail`.

| Ação | `detail` / `before` → `after` |
|---|---|
| `Lista movida` · `Pasta movida` | caminho de origem → caminho de destino |
| `Subpasta promovida a Pasta` · `Pasta rebaixada a Subpasta` | idem |
| `Ordem alterada` (no pai) | — |
| `Visualizações padrão alteradas` | `Lista, Quadro · inicial Lista` → `Lista, Quadro, Calendário · inicial Quadro` |
| `Aspecto bloqueado` · `Aspecto desbloqueado` | `detail` = `Conjunto de Status` etc. |

---

## Layout and Interaction Contract

### Estados transversais (herdados de 07-UI-SPEC §9 e 09-UI-SPEC, sem mudança)

Carregando: esqueleto na forma do conteúdo. Erro de carga: `EmptyState` com a mensagem. Texto longo: `truncate` com `title` em listas e árvore; em página, quebra de linha. `Toast` de erro não expira e é dispensado pela pessoa. Nunca `window.alert`/`confirm`. Movimento reduzido: respeitado pelos componentes; **nenhuma animação nova** nesta fase (o realce de soltura é cor, sem transição de posição). Privacidade (B38a): contêiner privado sem concessão não existe para quem não o alcança, nem na árvore, nem nos destinos do diálogo, nem na lista de «Já definido em:».

---

### S1 — Árvore de navegação: arrastar, soltar e menu de linha (`StructureTree` → `TreeSpace`/`TreeFolder`/`TreeList`/`TreeRow`)

Escopo: **só** a árvore da Estrutura. `MeusNegociosNoPainel` reusa `TreeFolder`/`TreeList` com `enderecos` próprio e **não** ganha arraste nem menu (A9); o prop que liga o comportamento é passado só por `StructureTree`. A árvore de Chat (`ChatTree`) **não arrasta hoje** (move por menu «Mover para {pasta}»); ela é o precedente do **menu**, não do arraste. O precedente de arraste HTML5 é `quadro.tsx` (`draggable`, `onDragStart`, `onDragOver` com `preventDefault`, `onDrop`) e `calendario-mensal.tsx` (realce `--acento-lavado` na célula sob o ponteiro, `onDragLeave` limpa).

**Quem arrasta.** Cada linha de Espaço, Pasta, Subpasta e Lista vira arrastável (`draggable` na `div` da linha, **não** no `Link`; o `Link`/âncora recebe `draggable={false}` para o navegador não arrastar a URL em vez da linha — A10-bis). Não arrasta: atalho da Caixa de entrada (`TreeShortcut`), a Pasta `MEUS_NEGOCIOS_ID` e as Listas dela, linhas de Chat, linhas de Convidado, linhas sem `administrar` no item (a recusa de L1/L3 desliga). Cursor `grab` / `grabbing` só nas arrastáveis. O dado em trânsito vive em estado do `StructureTree` (`{ tipo, id, paiTipo, paiId }`), como o quadro faz com `setDragging`; `dataTransfer` leva só `effectAllowed = "move"` e um tipo MIME próprio (`application/x-n1-conteiner`) para não soltar fora do app.

**Onde se solta (zonas).** A posição vertical do ponteiro dentro da linha decide a zona (lida em `onDragOver`, atualizada só quando a zona muda — A1):

| Quem se arrasta | Linha sob o ponteiro | Zonas | Efeito ao soltar |
|---|---|---|---|
| Lista ou Pasta | Espaço, Pasta ou Subpasta (exceto ele mesmo, descendentes dele e o pai atual) | linha inteira = **dentro** | `moveContainer`. Pasta com Subpastas sobre Pasta e Pasta sobre Subpasta **também** são alvos: a recusa do domínio sai no Toast (D-10 pede que essa recusa seja vista) |
| Lista | outra Lista **do mesmo pai** | metade de cima = **antes**, metade de baixo = **depois** | `reorderContainers` (grupo Listas) |
| Pasta ou Subpasta | Pasta ou Subpasta **do mesmo pai** | 25% de cima = **antes**, 50% do meio = **dentro**, 25% de baixo = **depois**. Em contêiner **aberto** com filhos visíveis o quarto de baixo vale **dentro** (inserir «depois» de um pai aberto cairia visualmente dentro dele) | **antes/depois** → `reorderContainers` (grupo Pastas); **dentro** → `moveContainer` |
| Espaço | outro Espaço | metade de cima = **antes**, metade de baixo = **depois**; **nunca** «dentro» (D-09: Espaço só reordena) | `reorderContainers` (Espaços do Espaço de Trabalho) |
| qualquer | Lista de outro pai, linha de atalho, Chat, cabeçalhos, espaço vazio | **não é alvo** (`dropEffect = "none"`, sem realce) | nada |

Um item solto **em cima do próprio pai** não é alvo e não faz nada, sem Toast (A10): é um gesto ambíguo, não um erro. Mover **acrescenta no fim** do grupo de destino (A3); reposicionar é um segundo gesto.

**Realce durante o arrastar (A1).** Linha de origem a **60% de opacidade**. Alvo «dentro»: fundo `--acento-lavado` e contorno interno de 1px `--linha-acento` com raio `--r-controle`. Alvo «antes/depois»: uma linha de **2px `--acento`**, absoluta, do recuo do rótulo até a borda direita, no topo ou no pé da linha (`pointer-events: none`, `aria-hidden`). Só uma zona acesa por vez; sair da árvore ou `dragend` apaga tudo. Contêiner **fechado** sob o ponteiro por 600ms abre sozinho uma vez (A8) para alcançar Pastas dentro dele; não fecha de volta. A barra lateral rola sozinha perto da borda (comportamento nativo; conferir na UAT).

**O que acontece ao soltar «dentro».**

```
soltar ─► L1 recusa? ──sim──► Toast tone="error" (frase do domínio) · nada muda
            │ não
            ▼
          L2 tem consequência? ── não ──► move na hora (runConfirmado) ──► Toast sucesso · linha acende (useRecente)
            │ sim (Conjunto de Status muda OU algum Campo deixa de valer)
            ▼
          abre o diálogo S2 já com o destino escolhido
```

Durante a gravação a árvore fica `aria-busy="true"` e nenhuma linha começa novo arraste (A4): a tela só muda quando o servidor responde (2.2.5 adiada), então o sucesso é mostrado **depois** de `runConfirmado`, nunca antes. Foco depois de mover: vai para o link da linha movida no novo lugar (id estável `arvore-no-{id}`); se ela não estiver visível, para a linha de destino.

**Reordenar** grava a **permutação do grupo inteiro** (D-08): a tela monta a nova ordem inserindo o item na posição pedida entre os irmãos **que ela conhece**, e manda todos. Itens que a árvore esconde (arquivados com «Mostrar arquivados» desligado, na lixeira, privados que o Membro não alcança) **não podem ser perdidos da permutação** — ver item em aberto I1, que o domínio precisa fechar. Sem Toast no sucesso.

**Menu de linha (`⋯`), novo para as linhas da Estrutura.** Hoje só `ChatTree` usa a prop `menu` de `TreeRow`. Passam a ter `menu`:

| Linha | Itens |
|---|---|
| Espaço | `Subir`, `Descer` (o «+» de criar continua à parte) |
| Pasta e Subpasta | `Mover para…`, `Subir`, `Descer` |
| Lista | `Mover para…`, `Subir`, `Descer` |

«Subir»/«Descer» chamam `reorderContainers` trocando o item com o vizinho **visível** do mesmo grupo e são o **caminho por teclado e leitor de tela** da reordenação (WCAG 2.5.7: movimento de arrastar precisa de alternativa de ponteiro único; A6). `Mover para…` abre S2 (parâmetro de URL, A11). Itens desligados mostram o motivo embaixo do rótulo (`ActionMenu` já faz). Para o Convidado a árvore segue **inerte** (D-09): sem `href`, sem «+», sem «⋯», sem arrastar, sem alvo de soltura — exatamente o `inert` de hoje.

**Toque e tela estreita.** O «+» e o «⋯» hoje só aparecem com hover (`opacity-0 group-hover/linha`); em aparelho sem hover (`(hover: none)`) ficam **sempre visíveis** (A7), senão «Mover para…» é inalcançável. Arrastar por toque depende do navegador (Android/iPadOS suportam arrastar longo; não é prometido): o menu é o caminho garantido no telefone. Os alvos de 24px da árvore não mudam.

**Foco e leitura.** A árvore continua `ul/li` com links (não vira ARIA tree). Os avisos de sucesso (`role="status"`) e de recusa (`role="alert"`) saem no mesmo espaço de `Toast` do rodapé da barra lateral (`app-shell.tsx`, hoje só sucesso): ganha um segundo estado de **erro** (não expira, dispensável). Link da linha mantém `aria-current` quando ativo.

**Estados**

| Estado | Contrato |
|---|---|
| Padrão | como hoje; linhas arrastáveis ganham só o cursor |
| Arrastando | origem a 60%; alvo realçado conforme a tabela de zonas; nada mais muda |
| Alvo inválido / sem zona | sem realce, ponteiro «proibido»; soltar não faz nada |
| Gravando | `aria-busy` na árvore; sem novo arraste; o Toast só depois da resposta |
| Recusa do domínio | `Toast tone="error"` com a frase literal; a árvore fica como estava |
| Sucesso de mover | `Toast tone="success"` (copy acima); linha acesa por `--dur-realce`; destino expandido |
| Somente leitura | Convidado: inerte. Membro sem `administrar` no item: não arrasta; «Mover para…»/«Subir»/«Descer» desligados com o motivo |
| Vazio | `Nenhum Espaço visível para você.` (existente, inalterado) |

---

### S2 — Diálogo «Mover para…» e diálogo de consequência (`mover-conteiner-dialog.tsx`)

**Um só componente, dois caminhos de entrada.** (a) o item `Mover para…` do menu abre o diálogo vazio; (b) o arrastar-e-soltar **com consequência** (D-10) abre o mesmo diálogo com o destino já escolhido, ainda editável. O estado vive na URL (`?mover={id}` e, vindo do arrastar, `&destino={id}`), no molde de `MOVE_TASK_PARAM` / `useCreateContainerDialog`: o diálogo é montado **na casca** (`app-shell.tsx`, ao lado de `CreateContainerDialog`) e qualquer tela pede com `openMover(tipo, id, destinoId?)`; voltar do navegador fecha (A11).

**Quando abre × quando move na hora.** O menu **sempre** abre o diálogo (a pessoa escolhe o destino; confirmar é o ato). O arrastar abre o diálogo **só quando L2 diz que há consequência**: o Conjunto de Status efetivo muda **ou** algum Campo deixa de valer. Sem consequência, move na hora com Toast. Recusa de L1 no arrastar vai ao `Toast`, não ao diálogo.

**Estrutura** (`ConfirmDialog`, largura padrão; `wide` não necessário):

```
Mover “Propostas”
A Lista e as suas 12 Tarefas mudam de lugar juntas.

Destino                       [ Escolher destino        ▾ ]   ← Select searchable
                                                              opções desligadas dizem por quê

(só se o Conjunto de Status muda)
O destino usa outro Conjunto de Status. Escolha onde cada Status em uso passa a ficar.
  Em andamento · 5 Tarefas     [ Escolher Status ▾ ]
  Categoria de origem: Em andamento
  Aprovado · 7 Tarefas         [ Escolher Status ▾ ]
  7 Tarefas passam de Em andamento para Concluído e geram o evento de conclusão

(só se Campos saem)  ┌ âmbar ────────────────────────────────────────────┐
                     │ Campos que deixam de valer: Origem do lead.        │
                     │ 12 Valores ficam arquivados nas Tarefas. Nada é apagado. │
                     └────────────────────────────────────────────────────┘
(recusa)             Uma Pasta com Subpastas não vai para dentro de outra Pasta.   ← role="alert", --erro

                                                 [ Cancelar ]  [ Mover ]
```

- **Destinos oferecidos:** Espaços, Pastas e Subpastas ativos que o Membro alcança, exceto o próprio item, os descendentes dele e o pai atual. Lista só vai para Espaço, Pasta ou Subpasta; Pasta só para Espaço ou Pasta (Subpasta ainda aparece, **desligada** com a frase de L1). Cada opção que o domínio recusaria fica `disabledReason` (§11: a opção diz por quê em vez de sumir). `detail` = caminho acima.
- **Tabela de Status** (só quando L2 diz `conjuntoMuda`): uma linha por **Status em uso** abaixo do item, no formato de `move-task-dialog.tsx`; `Select` com os Status do destino, ordenados por `order`. Mapeamento é por Status de origem, não por Tarefa. Categoria por extenso (`STATUS_CATEGORY_LABEL`), **nunca** a chave crua (`emAndamento`) que `move-task-dialog.tsx` mostra hoje (A12). A categoria nunca muda sem a dica dizendo.
- **Confirmar** desligado até haver destino e todos os Status mapeados; o motivo é um dos três da tabela de copy. Enquanto grava: `carregando` + `Movendo…`; fecha só depois da resposta (`runConfirmado`).
- **Recusa no servidor** (corrida): o `p role="alert"` mostra a frase e o diálogo continua aberto com os campos preservados (padrão de 07). Cancelar/Esc/voltar fecham e limpam `?mover=`.
- **Depois de mover:** fecha, Toast de sucesso na casca, foco no link da linha movida (ver S1).
- **Acessibilidade:** `role="dialog"` do `ConfirmDialog`, foco no `Select` de destino ao abrir (primeiro campo), foco volta ao `⋯`/botão que abriu (ou à linha movida). A tabela é uma pilha de `Field` rotulados, não uma `table`, como no diálogo de Tarefa. O painel âmbar é texto (não só cor).
- **Tela estreita:** o diálogo já é `max-width` do sistema; os `Select` ocupam a largura toda; a lista de opções rola.
- **Estados:** vazio (nenhum destino válido): o `Select` abre com `Nenhum destino disponível.` (texto do `Select` quando sem opções; nenhuma copy nova); carregando: `Movendo…`; erro: acima; somente leitura: o item de menu já vem desligado, o diálogo nem abre.

---

### S3 — Menus de Pasta e de Lista

| Onde | Mudança |
|---|---|
| Árvore (S1) | `⋯` novo nas linhas de Pasta, Subpasta e Lista com `Mover para…`, `Subir`, `Descer` |
| Página da Lista (`ActionMenu` do cabeçalho, ícone «⋯») | acrescentar `Mover para…` **por último**, depois de «Salvar como modelo». Não aparece na Lista de **Meus negócios** (`espelhoComercial`, A9). Desligado com a frase de `containerAdminRefusal` quando a Lista não está ativa ou o Membro não administra, no padrão `disabledReason` que «Salvar como modelo» já usa |
| Página da Pasta e da Subpasta | hoje **sem menu**; ganha um `ActionMenu` «Mais ações» (⋯, `btn-icone`) depois de «Configurações» e do menu «Criar», com o item `Mover para…`. Um menu de um item é aceito (é a casa das próximas ações; A8-bis) |
| Página do Espaço | **sem** `Mover para…` (Espaço não entra em nada, D-09); `Subir`/`Descer` só na árvore |

Itens com ícone `Icone` (lucide `FolderInput` ou equivalente) são opcionais; se usados, só pelo envoltório. Ordem em todos: ações próprias do item primeiro, `Mover para…` depois, destrutivas por último (não há destrutiva nova).

---

### S4 — Configurações do contêiner em abas (`container-settings.tsx`)

**Esqueleto.** `PageHeader` (caminho › nome, título «Configurações de {nome}», `StateSeal`) → `Abas` (`rotulo="Configurações"`) → `CorpoDeTela` com o conteúdo da aba, uma coluna, `max-w-3xl`. Os `Toast` de sucesso/erro continuam no topo do `CorpoDeTela`, um por vez.

**Abas.** Chaves de URL: `geral`, `status`, `funcionalidades`, `campos`, `tipos-de-tarefa`, `visualizacoes`, `formularios`, `modelo-e-canais`. A aba ativa vive em `?aba=` (A14): `aoTrocar` faz `router.replace` com o parâmetro (como `useMoveTaskDialog`, `scroll: false`), sem empilhar histórico. `?aba=` ausente, desconhecido ou de aba que o nível não tem (`formularios` num Espaço) cai em `geral`. `/estrutura/listas/<id>/configuracoes?aba=campos` abre direto em Campos (2.1.8). Em tela estreita a lista de abas rola na horizontal (o `Abas` já tem `overflow-x-auto`); a aba ativa precisa ficar visível ao carregar com `?aba=` (rolar até ela).

| Aba | Conteúdo | Espaço | Pasta | Lista |
|---|---|:-:|:-:|:-:|
| Geral | `IdentidadeDoConteiner` · `Criado por {nome}` · `CicloDeVidaDoConteiner` | sim | sim | sim |
| Status | linha de origem · (interruptor) · `StatusSetEditor` | sim | sim | sim |
| Funcionalidades | linha de origem · (interruptor) · `FeaturesEditor` | sim | sim | sim |
| Campos | cabeçalho de contagem · (interruptor) · lista dos Campos que alcançam o nível · `FieldDefinitionsEditor` | sim | sim | sim |
| Tipos de Tarefa | cabeçalho de contagem · (interruptor) · lista · `TaskTypesEditor` | sim | sim | sim |
| Visualizações | linha de origem · (interruptor) · `EditorDeVisualizacoesPadrao` (S5) | sim | sim | sim |
| Formulários | `FormsEditor` | — | — | sim |
| Modelo e canais | `CaixaDeConfiguracoes` «Modelo de Tarefa»; se a Lista é conversacional, `CanaisDeAtendimento` + `AdicionarCanalDialog` | — | — | sim |

(«(interruptor)» = S6, só Espaço e Pasta.) Remove-se: a tabela «Aspectos configuráveis», `ASPECTS`, `REGRA_DOS_MODOS`, `MODE_LABEL`, o `title` explicativo da coluna, os painéis «Conjunto de Status efetivo» / «Funcionalidades efetivas» / «Definições de Campo acumuladas» / «Tipos de Tarefa acumulados» como **cabeçalhos** (o nome da aba já diz), a linha «Definido em X: é o que uma Lista criada aqui consome» (a linha de origem a substitui) e a frase `ajuda` de «Modelo de Tarefa» («O modelo é da Lista e não herda…»; A24). O texto «Aspectos configuráveis» não aparece em nenhuma tela (2.1.8).

**Linha de origem** (topo de Status, Funcionalidades, Visualizações; `CabecalhoDoAspecto`): uma `Pilula` + o interruptor à direita, quebrando linha em tela estreita.

| Situação | O que mostra |
|---|---|
| O nível define o aspecto | `Definido aqui` (info) |
| Um ancestral define | `Herdado de {Tipo} {nome}` (neutro) |
| Ninguém acima define | `Padrão da plataforma` (neutro) |
| Um ancestral bloqueia | `Bloqueado por {Tipo} {nome}` (aviso, cadeado) **no lugar** da origem + `ReadOnlyNote`; todos os editores da aba desligados com a frase do domínio (L5/`blockedAbove`). Se o nível também define (dado antigo), as duas `Pilula` aparecem |

Em **Campos** e **Tipos de Tarefa** (acumulam) a linha de origem não se aplica: o topo mostra `{n} definidos aqui · {m} herdados` (A15) e, se bloqueado acima, o mesmo «Bloqueado por…». Cada item herdado da lista mantém a origem na própria linha (`· de {nome}`, como hoje). Em **Geral**, **Formulários** e **Modelo e canais** não há linha (não são aspectos herdáveis).

**Aba «Status» sem Conjunto resolvido.** Se `effectiveContainerConfig` devolve `null` (hoje o `EmptyState` «Este contêiner não resolve um Conjunto de Status»), esse vazio vive **dentro da aba Status**; as outras abas continuam abertas. Texto inalterado.

**Foco e leitura (A13).** O conteúdo da aba é `role="tabpanel"` com `aria-labelledby` na aba ativa; `Abas` ganha, sem mudar o visual, `id` por aba, `aria-controls` e navegação por setas/Home/End (roving `tabIndex`). Se o planejador preferir não tocar o componente compartilhado, o painel fica sem `aria-labelledby` e isso vira dívida registrada (I7). Trocar de aba não move o foco para o conteúdo; o foco fica na aba.

**Estados**

| Estado | Contrato |
|---|---|
| Padrão | aba por `?aba=`, editores como hoje |
| Contêiner não encontrado / sem alcance | `EmptyState` «Contêiner não encontrado.» (existente) |
| Somente leitura (sem `administrar`, arquivado, na lixeira) | `ReadOnlyNote` no topo da aba; todo editor desligado com o mesmo motivo; leitura continua completa |
| Bloqueado por ancestral | linha «Bloqueado por…» + editores desligados |
| Gravando | cada editor mantém o seu estado (botão `carregando`) |
| Erro | `Toast tone="error"` com a frase do domínio, literal |

---

### S5 — Aba «Visualizações» e o consumo dela na Lista (`EditorDeVisualizacoesPadrao`; `listas/[lista]/page.tsx`; `view-bar.tsx`)

**Editor (aba «Visualizações»).** Linha de origem + (interruptor, Espaço/Pasta), depois uma lista de cinco linhas — uma por tipo, na ordem da barra (`Lista`, `Quadro`, `Calendário`, `Tabela`, `Linha do tempo`):

```
                              Disponível   Inicial
Lista                            [x]         (•)
Quadro                           [x]         ( )
Calendário                       [x]         ( )
Tabela                           [ ]         ( )   ← rádio desligado (tipo não disponível)
Linha do tempo                   [x]         ( )
                                                       [ Voltar a herdar ]   ← só com definição própria
```

- **Controles:** caixa (`input type="checkbox"`) e rádio (`input type="radio"`) nativos no padrão de `bulk-status-bar.tsx` (`size-4 accent-[var(--acento)]`); o rádio de um tipo não marcado fica desabilitado. O grupo de rádios é `role="radiogroup"` `aria-label="Visualização inicial"`; cada rádio tem `aria-label="Inicial: {Tipo}"`. A linha é um `label` do tipo.
- **Grava na hora** a cada mudança (`setContainerDefaultViews`), como `FeaturesEditor`; os estados intermediários são sempre válidos porque a tela **não deixa** formar um inválido: o tipo que é o **inicial** não se desmarca (a caixa fica desligada e a linha mostra, visível, `É a Visualização inicial. Escolha outra antes de desmarcar.`, ligada por `aria-describedby`); o último tipo marcado é sempre o inicial, então `disponiveis` vazio nunca se forma (A17).
- **Editar um nível que herda** cria a definição própria desse nível com o valor efetivo atual alterado pela mudança; `Voltar a herdar` (só com definição própria; nunca com bloqueio acima) chama `setContainerDefaultViews(..., null)`, sem confirmação (nada é apagado), e o editor passa a mostrar o valor herdado.
- **Lente na Lista:** nas Configurações de uma **Lista conversacional** a linha «Linha do tempo» fica desligada com `Não existe em Listas conversacionais.`; a financeira não tem restrição de tipo. No Espaço e na Pasta o editor não conhece lente.
- **Aviso de salvas escondidas:** ao desmarcar um tipo para o qual existem Visualizações **salvas** abaixo, o Toast de sucesso acrescenta a frase de guardadas (copy acima). A contagem vem do estado (Visualizações cujo `kind` é o do tipo e cuja Lista está abaixo do contêiner).
- **Estados:** padrão; herdado (caixas refletem o valor efetivo, «Voltar a herdar» ausente); definido aqui (botão presente); bloqueado/sem permissão/inativo (tudo desligado + `ReadOnlyNote`); erro de gravação (`Toast` literal).

**Consumo na página da Lista (2.6.2, D-06, D-07).**

- **Abas.** `abas = config.views.disponiveis` **filtradas pela lente** (financeira: nenhuma restrição; conversacional: sem `linha`). O rótulo vem de `ROTULO_DA_ABA` (sem `carga`). Lista comum: até 5 abas; conversacional: até 4.
- **Aba inicial.** A Visualização salva `isDefault` da Lista **se o tipo dela está nas abas mostradas**; senão `config.views.inicial` **se está nas mostradas**; senão a primeira mostrada. Se a aba atual deixa de existir com a Lista aberta (outro Membro mudou o Espaço), a tela volta à inicial.
- **Interseção vazia** (o Espaço só liberou tipos que a lente proíbe): mostra só a aba `Lista` (A18). **Uma única aba** mostrada: a barra de `Abas` **não é renderizada** (nada a escolher; A18), e o resto da página segue.
- **Barra de Visualizações salvas** (`view-bar.tsx`): lista só as salvas cujo tipo está entre as abas mostradas (D-06; usar as abas mostradas, não só `config.views.disponiveis`, é um refinamento que não contradiz o D-06 — A18). Uma salva escondida **não é apagada nem migrada**; reaparece quando o tipo volta. Se a escondida era a padrão (`isDefault`), a Lista abre na inicial do Espaço. Se a salva **ativa** some, a seleção limpa (filtros voltam ao vazio) sem Toast. «Salvar Visualização» continua; só salva o tipo da aba aberta, que por construção está disponível (a recusa de `saveView` fica como rede).
- **Selecionar várias** só vive na aba `Lista`: sem ela, o botão fica desligado com o motivo da tabela de copy (A19).

---

### S6 — Interruptor «Bloquear para os níveis abaixo» (`CabecalhoDoAspecto`)

Aparece **só** nas abas de aspecto de **Espaço e Pasta/Subpasta** (D-16): Status, Funcionalidades, Campos, Tipos de Tarefa e Visualizações. A **Lista nunca** mostra o interruptor (D-15: a Lista não bloqueia); ela mostra só a linha «Bloqueado por…» quando um ancestral bloqueia. **Automações** não tem aba nesta fase, então não tem interruptor (I3).

Posição: à direita da linha de origem, na mesma faixa (`flex-wrap`, `gap-2`). Controle: `Toggle` com `labelledBy` apontando para o rótulo visível `Bloquear para os níveis abaixo`; `describedBy` aponta para a dica ou para o motivo.

| Estado | Contrato |
|---|---|
| Desligado, permitido | `Toggle` habilitado; ligar chama `setContainerBlock(…, true)`; Toast de sucesso (tabela de aspecto) |
| Ligado | `Toggle` ligado; desligar **sempre** é permitido (se há permissão) e chama `setContainerBlock(…, false)` |
| Ligado, aspecto que acumula (Campos, Tipos de Tarefa) | acrescenta a dica `Os já criados continuam valendo.` (consequência, não regra; A15) |
| Desligado e **impedido** — aspecto que substitui (Status, Funcionalidades, Visualizações) com sobrescrita abaixo (L4) | `Toggle` **desabilitado** e desligado; abaixo dele a lista `Já definido em:` com um link por contêiner (`Pasta Clientes`, `Lista Propostas`…) apontando para `…/configuracoes?aba={mesma aba}` do contêiner; fecha com `Volte a herdar neles para poder bloquear.` A lista rola dentro de uma altura máxima quando longa (`max-h-48 overflow-y-auto`); cada link tem `aria-label="Abrir as Configurações de {Tipo} {nome}"`. Contêiner privado que o Membro não alcança **não** entra na lista (B38a), mas a recusa do domínio (se forçada) o nomeia como o domínio decidir |
| Aspecto que acumula | **nunca** impedido por descendentes (bloquear vale só para o que for criado depois) |
| Sem permissão / contêiner arquivado ou na lixeira | `Toggle` desabilitado + `ReadOnlyNote` com a frase de `containerAdminRefusal` |
| Bloqueado por ancestral | o interruptor **do próprio nível** continua visível mas desligado por `ReadOnlyNote` («Bloqueado por…»), pois todo editor da aba está desligado |
| Gravando | `Toggle` desabilitado até a resposta; Toast depois |
| Recusa do domínio (corrida) | `Toast tone="error"` com a frase, que **nomeia** a Pasta que sobrescreve (RN-ESP-09, sem o código); o `Toggle` volta ao estado anterior |

Anúncio: a mudança do `Toggle` é anunciada pelo próprio `role="switch"`; o resultado, pelo `Toast`. A lista de sobrescritas é um `ul` de links normais (focáveis em ordem de leitura).

---

### S7 — Página da Lista (`listas/[lista]/page.tsx`: 1.407 → abaixo de 1.000 linhas)

O contrato é de **o que sai e o que fica**; o comportamento de Quadro, Tabela, Calendário e Linha do tempo não muda. A ordem interna do ROADMAP vale: **2.1.6 → 2.5.4 → 2.6.2** (extrair, depois tirar a Carga, depois ligar as Visualizações padrão).

**Do topo para baixo, depois da limpeza**

```
PageHeader   (título · selo · contagem · Abrir formulário · Configurações · [Nova série] · [Nova conta] · ⋯)
  ⋯ = Copiar link do formulário · Guia do Financeiro · Salvar como modelo · Mover para…   (S3)
[aviso âmbar "Arquivada/Na lixeira porque …"]                                  (como hoje)
[FinanceIndicators]                                                            (só financeira)
Abas  (Lista · Quadro · Calendário · Tabela · Linha do tempo)                  (S5; some se só há uma)
Barra principal da lente + [Selecionar várias] no fim                          (BarraDeCriacao + SelecaoEmLote)
[painel do lote (BulkStatusBar) em linha própria, só selecionando]             (SelecaoEmLote)
CorpoDeTela:
  [relatório do lote] · ViewBar (filtros e Visualizações salvas) · «Mostrando X de Y Tarefas.» (só filtrando)
  [Toast de sucesso/erro] · conteúdo da aba
```

**Sai (e o que fica no lugar)**

| Sai | Fica |
|---|---|
| `RunScheduledButton` e «Rodar agenda da Lista (hoje)», nas duas barras | nada; a barra conversacional termina em «Selecionar várias»; a comum, em «Selecionar várias» |
| Item «Rodar automações por vencimento (hoje)» do menu «Automatizar» (`contas-view.tsx`) | o menu **continua** com o único item `Ver Automações desta Lista` (não ficou vazio; A23). `agendadas`/`admin` deixam de ser usados ali |
| Texto de `collaboration-editors.tsx` que cita o relógio e o botão | a cauda da frase (copy acima) |
| Nota sob o Quadro «Arrastar altera o Status. As validações da Lista continuam valendo…» | nenhum texto abaixo das colunas |
| «— o filtro vale em todas as Visualizações» e «Tarefa(s)» na contagem | `Mostrando {X} de {Y} Tarefas.` |
| Frase ao lado de «Iniciar conversa» (Meus negócios) e de «Nova Tarefa» (conversacional) | só o botão |
| Botão «De modelo» **da barra conversacional** (nascia desligado) | nada. **Na Lista comum «De modelo» fica** |
| Aba «Carga» e `CargaDeTrabalho` | 5 abas (conversacional: 4); a financeira deixa de filtrar a Carga; a conversacional filtra só `linha` |
| Terceiro «Sair da seleção» no `FinanceToolbar` e o par de botões «Selecionar várias» duplicados | um só botão que alterna `Selecionar várias` ↔ `Sair da seleção` |

**Barra principal por lente (`BarraDeCriacao`)**

| Lente | Conteúdo (esq. → dir.) |
|---|---|
| Comum | seletor de Tipo · campo «Nova Tarefa» · `Criar` · `De modelo` · ⟶ `Selecionar várias` |
| Conversacional (pura) | `Nova Tarefa` (primário, ícone de balão) · ⟶ `Selecionar várias` |
| Meus negócios (espelho comercial) | `Iniciar conversa` (primário). **Sem** seleção em lote (nunca teve; A9) |
| Financeira | `FinanceToolbar` sempre visível; o campo de criação de conta continua só sob demanda (`Nova conta`/URL) com `Cancelar`; `Selecionar várias` no fim da `FinanceToolbar` |

**Seleção em lote (`SelecaoEmLote`, 2.1.4).** Uma só peça, montada uma vez, igual nas três lentes: o botão alterna a seleção e, **com a seleção ligada**, o painel do lote (`BulkStatusBar`, inalterado, `bulk-status-bar.test.tsx` continua passando) abre em linha própria, largura total, logo abaixo da barra principal e antes da `ViewBar`. Selecionar força a aba `Lista` (como hoje) quando ela existe. O relatório do lote continua guardado fora da seleção. Sair da seleção limpa as marcadas.

**Contagem.** `Mostrando X de Y Tarefas.` aparece no mesmo lugar da frase de hoje (logo abaixo da `ViewBar`), só com filtro ativo, `.app-meta`. Nenhum «Limpe o filtro» na linha. O vazio filtrado (`EmptyState`) fica como hoje.

**Tela estreita.** `BarraDeFiltros` quebra em linhas; o campo de título mantém `min-w-48 flex-1`; `Selecionar várias` cai para a linha de baixo sem perder o alvo; as abas rolam na horizontal. Nada novo.

**Estados.** Lista ativa × arquivada/na lixeira: barras de criação **não** aparecem (como hoje); Convidado/sem criar: `Criar` e `Nova Tarefa` desligados com `criacaoRecusada` (como hoje); Lista vazia: `EmptyState` «Nenhuma Tarefa nesta Lista ainda.» (inalterado).

**Teste de pronto (grep):** `grep -rn 'Rodar agenda' apps/web/src` e `grep -rn 'Rodar automações por vencimento' apps/web/src` sem achados (D-03); `grep -rn "'carga'\|\"carga\"" apps/web/src` sem achados de UI; `wc -l` da página < 1.000.

---

### S8 — Página do Espaço no formato da Pasta (`espacos/[espaco]/page.tsx`; molde: `pastas/[pasta]/page.tsx`)

```
PageHeader   título · [StateSeal] · [Privado]            «N Listas · M Pastas»     Configurações · [Criar ▾]
CorpoDeTela
  Listas  (n)   ← ReguaDeSecao; Listas diretas + atalhos
    ▸ Lista   [Conversacional]                                   12 abertas
    ▸ ↗ Atalho                                       Caixa de Entrada do CRM
  Pastas  (m)
    ▸ Pasta                                                       3 Listas
  Painéis (k)   ← só existe se k > 0
    ▸ Painel
```

- **Cabeçalho:** `seal` leva `StateSeal` + `Pilula` neutra «Privado» com cadeado (só se `isPrivate`). `meta` = `{n} {Lista|Listas} · {m} {Pasta|Pastas}` (plural real). Ações: `Configurações` (`btn btn-fantasma btn-sm`, como a Pasta) e o menu **Criar** (`btn btn-solido btn-sm`, ícone `+`, itens `Lista`, `Pasta`) pelo `openCreate("lista"|"pasta", "space", id)` de `useCreateContainerDialog`; só com o Espaço ativo (como a Pasta). «Criar › Lista» abre o diálogo com o Espaço já escolhido (2.1.9). Sem gate novo de permissão: a recusa do domínio aparece no diálogo, como na Pasta.
- **Listas:** mesmo item da Pasta (`item-solto`, ícone `List`, nome `.app-md` truncado, `Pilula` «Conversacional», `StateSeal` se não ativa, `{n} aberta(s)` com `.app-numero`; período planejado em `.app-meta` quando houver). Atalhos (`ExternalLink`, nome, `.app-meta` «Caixa de Entrada do CRM» / «…, só as suas Conversas») seguem **depois** das Listas, na mesma seção, contando na contagem.
- **Pastas:** como as Subpastas da Pasta (`Folder`, nome, `StateSeal`, `{n} Listas`).
- **Ordem:** cada grupo ordenado por `order` (D-08), para o arrastar da árvore aparecer aqui; a página lista **Listas e depois Pastas** (formato da Pasta, 2.1.9), enquanto a árvore lista Pastas e depois Listas (I4).
- **Painéis:** a seção só existe quando há Painel ancorado no Espaço; sem Painel, nem a régua nem a dica «Um Painel é criado em Painéis…» aparecem.
- **Some:** o painel lateral «Atributos» (Criado por, Privado) e a coluna de 22rem — o conteúdo passa a uma coluna só. «Criado por» vive na aba Geral (S4).
- **Vazios:** Espaço sem Lista nem Pasta → um só `EmptyState compact` («Este Espaço está vazio.» + «Nova Lista») no lugar das duas seções; só um dos grupos vazio → a linha `Nenhuma Lista.`/`Nenhuma Pasta.` (A22).
- **Estados:** Espaço não encontrado/sem alcance: `EmptyState` «Espaço não encontrado.» (inalterado); Espaço arquivado/na lixeira: `StateSeal` e sem «Criar»; Convidado que chega por URL vê o que alcança, sem «Criar».
- **Tela estreita:** uma coluna, como já é abaixo de `xl`; as ações do cabeçalho quebram no `CabecalhoDeTela`.

---

### S9 — Configurações de Membros (`configuracoes/membros/page.tsx`)

Sai a coluna `Capacidade/sem` (cabeçalho e célula), o `CapacityEditor` e o Toast «Capacidade semanal alterada.». A tabela «Participações» fica com **Membro · Papel · Estado · Disponibilidade · Entrou · (ações)**; nenhuma coluna ganha o lugar (a de ações continua à direita). Nenhuma copy nova, nenhum vazio novo. O valor já gravado no Membro é ignorado (D-13).

---

### S10 — Textos: os 13 códigos de regra e o checklist para o executor

Alvo de redação: **apagar o código e o espaço antes dele, e nada mais** (2.1.10: «sem mudar o resto da frase»). Se o código fechava uma oração com dois-pontos, o dois-pontos fica colado na palavra anterior. Nenhuma frase é reescrita para ser «melhor».

| # | Arquivo:linha (hoje) | Antes (trecho) | Depois |
|---|---|---|---|
| 1 | `create-container-dialog.tsx:383` | `…e uma Subpasta não contém outra (A3.4).` | `…e uma Subpasta não contém outra.` |
| 2 | `create-container-dialog.tsx:428` | `…ato de governança registrado (B38).` | `…ato de governança registrado.` |
| 3 | `create-container-dialog.tsx:441` | `…todo o resto herda (RN-ESP-03). Ele se ajusta…` | `…todo o resto herda. Ele se ajusta…` |
| 4 | `create-container-dialog.tsx:442` | ``A herança é por aspecto (B25) e se ajusta…`` | ``A herança é por aspecto e se ajusta…`` |
| 5 | `tarefa-completa.tsx:1496` | `…sem Integração manual (INV-CP-01): peça ao Agente…` | `…sem Integração manual: peça ao Agente…` |
| 6 | `tarefa-completa.tsx:1524` | `…sem cliente vinculado (RN-CR-02): a soma por…` | `…sem cliente vinculado: a soma por…` |
| 7 | `tarefa-completa.tsx:1537` | `Parcela duplicada (RN-CR-07): já existe…` | `Parcela duplicada: já existe…` |
| 8 | `financeiro/serie-dialog.tsx:117` | `Escolha o Centro de Custo (RN-CR-01).` | `Escolha o Centro de Custo.` |
| 9 | `financeiro/serie-dialog.tsx:150` | `…é recusada (RN-CR-07).` | `…é recusada.` |
| 10 | `operations/structure.ts:430` (domínio) | `…dentro de um Espaço (B47).` | `…dentro de um Espaço.` |
| 11 | `operations/financeiro.ts:1815` (domínio) | `Centro de Custo é obrigatório (RN-CR-01).` | `Centro de Custo é obrigatório.` |
| 12 | `operations/financeiro.ts:1829` (domínio) | `…nesta Lista (RN-CR-07).` | `…nesta Lista.` |
| 13 | `operations/financeiro.ts:1832` (domínio) | `…Parcela nesta Lista (RN-CR-07). Descarte…` | `…Parcela nesta Lista. Descarte…` |

(Os números de linha deslocaram desde o documento de tarefas: a busca deve ser por **texto**, não por linha.) O comentário de `pastas/[pasta]/page.tsx` com `(A3.4)` não aparece e fica.

**Grep que o executor roda** (os quatro padrões de 2.1.10), excluindo comentários e testes:

```
grep -rnE "\((RN|INV|DO)-[A-Z]+-[0-9]+\)|\(B[0-9]+[a-z]?\)|\(A[0-9]+\.[0-9]+\)" \
  apps/web/src/features/estrutura "apps/web/src/app/(shell)/estrutura"
```

`sem-codigo-de-regra.test.ts` faz a mesma busca nos `.tsx` das duas pastas, descartando comentários. Ele **não vê** os itens 10–13 (estão no domínio): cada um ganha uma asserção no teste de domínio correspondente (ou um caso no mesmo teste lendo as cadeias), senão voltam sem alarme. `tarefa-completa.tsx` é a **única** ponta compartilhada com a Fase 11: editar só as três cadeias dos itens 5–7 e nada mais (a Fase 11 parte do arquivo já limpo).

Também entram na limpeza por causa dos botões que saem (S7): as cadeias «Rodar agenda da Lista (hoje)» (`bulk-status-bar.tsx`), «Rodar automações por vencimento (hoje)» e a motivo `Esta Lista não tem Automação por vencimento.` (`contas-view.tsx`), e o trecho do relógio/botão em `collaboration-editors.tsx`.

---

## UI Considerations

> Preenchida pela sonda de estados de UI (passo 9.5 do ui-phase) e levantada pelo plan-phase pela mesma regra de `## Edge Coverage`. Cobertura de **estados** enraizados na forma do elemento (vazio, carregando, erro, preenchido, parcial, estouro, zero/um/muitos, texto longo). A copy dos vazios e dos erros mora em `## Copywriting Contract`; aqui só se referencia, sem repetir. Os tipos de elemento de cada superfície foram fixados à mão (a palavra «Lista», nome de entidade, gerava falsos positivos de «lista de itens»).

Applicable state considerations resolved: 47 covered, 18 backstop, 0 unresolved

| Superfície | Categoria | Elemento(s) | Status | Resolution / Reason |
|---|---|---|---|---|
| S1 | empty | list-collection, nav | ✅ covered | Sem Espaço visível, a árvore mostra «Nenhum Espaço visível para você.» (texto existente, inalterado) (S1 Estados, Vazio). |
| S1 | loading | list-collection, nav | ✅ covered | Durante a gravação de mover ou reordenar a árvore fica aria-busy="true", nenhuma linha começa novo arraste e o Toast de sucesso só aparece depois que o servidor responde (S1, A4). |
| S1 | error | list-collection, nav | ✅ covered | Recusa do domínio ao soltar vira Toast tone="error" com a frase literal do domínio; a árvore fica como estava e nada se move (S1 Estados, Recusa do domínio). |
| S1 | populated | list-collection, nav | 🧪 backstop | Teste visual: árvore com Espaços, Pastas, Subpastas e Listas em volume típico mostra, durante o arraste, o alvo «dentro» com fundo --acento-lavado e contorno --linha-acento e o alvo «antes/depois» com linha de 2px --acento, uma zona por vez (S1 Realce, A1). |
| S1 | partial | list-collection, nav | ✅ covered | Reordenar com irmãos que a árvore esconde (arquivados, na lixeira, privados fora do alcance) não perde nem desloca os escondidos da permutação; depende do item I1, que o domínio precisa fechar antes da tarefa de arrastar-reordenar (S1 Reordenar, I1). |
| S1 | overflow | list-collection, nav | 🧪 backstop | Teste visual em aparelho/janela baixa: com muitas linhas a árvore rola dentro da barra lateral e o arraste perto da borda rola sozinho (comportamento nativo; I8, conferir na UAT). |
| S1 | zero-one-many | list-collection, nav | ✅ covered | «Subir» e «Descer» ficam desligados com o motivo (L3) quando o item é o primeiro ou o último do grupo, e os dois desligados quando é o único irmão (S1 Menu de linha, L3). |
| S1 | long-text | list-collection, nav | ✅ covered | Nome longo de Espaço, Pasta ou Lista é truncado com title na árvore, sem quebrar a linha nem empurrar «+» e «⋯» (Estados transversais). |
| S2 | empty | form, list-collection, interactive-control | ✅ covered | Sem destino válido o Select abre com «Nenhum destino disponível.» (texto do Select sem opções; nenhuma copy nova) (S2 Estados, vazio). |
| S2 | loading | form, list-collection, interactive-control | ✅ covered | Enquanto grava, o botão fica carregando com «Movendo…» e o diálogo só fecha depois da resposta (runConfirmado) (S2 Confirmar). |
| S2 | error | form, list-collection, interactive-control | ✅ covered | Recusa do servidor (corrida) aparece em p role="alert" com a frase do domínio, o diálogo continua aberto e os campos são preservados; Cancelar, Esc e voltar fecham e limpam ?mover= (S2 Recusa no servidor). |
| S2 | populated | form, list-collection, interactive-control | ✅ covered | A tabela de Status (só quando L2 diz conjuntoMuda) tem uma linha por Status em uso com a contagem de Tarefas e um Select com os Status do destino ordenados por order; a categoria aparece por extenso (STATUS_CATEGORY_LABEL), nunca a chave crua (S2 Tabela de Status, A12). |
| S2 | partial | form, list-collection, interactive-control | ✅ covered | «Mover» fica desligado até haver destino e todos os Status mapeados, e o motivo é um dos três da tabela de copy; o painel âmbar de Campos que saem só existe quando há Campos afetados (S2 Confirmar). |
| S2 | overflow | form, list-collection, interactive-control | ✅ covered | A lista de opções do Select rola, os Select ocupam a largura toda e o diálogo respeita o max-width do sistema em tela estreita (S2 Tela estreita). |
| S2 | zero-one-many | form, list-collection, interactive-control | ✅ covered | Contagens usam plural real («1 Tarefa», «12 Tarefas», «1 Valor», «12 Valores»), nunca «Tarefa(s)»; sem tabela de Status quando o Conjunto não muda (S2, Copywriting Contract). |
| S2 | long-text | form, list-collection, interactive-control | 🧪 backstop | Teste visual: Lista, destino ou Status com nome muito longo no título «Mover “…”», nas opções do Select (com o caminho em detail) e na tabela de Status não estoura o diálogo (truncate com title ou quebra de linha). |
| S3 | loading | nav, interactive-control | 🧪 backstop | Teste visual: enquanto uma gravação de mover ou reordenar está em andamento, os itens «Mover para…», «Subir» e «Descer» do menu não permitem um segundo comando (a árvore está aria-busy). |
| S3 | error | nav, interactive-control | ✅ covered | Item que o domínio recusaria fica desligado e mostra o motivo embaixo do rótulo (disabledReason do ActionMenu, frase de containerAdminRefusal ou de L3); recusa que chegar ao servidor vai ao Toast de erro (S3, S1 Menu de linha). |
| S3 | overflow | nav, interactive-control | 🧪 backstop | Teste visual: o menu «⋯» das linhas da árvore e o «Mais ações» da Pasta não vazam da barra lateral nem da tela estreita; em (hover: none) o «⋯» fica sempre visível (A7). |
| S3 | long-text | nav, interactive-control | 🧪 backstop | Teste visual: o motivo de um item desligado, quando longo, quebra linha dentro do menu sem cortar o rótulo «Mover para…». |
| S4 | empty | form, nav, static-content | ✅ covered | Sem Conjunto de Status resolvido, o EmptyState «Este contêiner não resolve um Conjunto de Status» vive dentro da aba Status e as outras abas continuam abertas (S4 Aba «Status» sem Conjunto resolvido). |
| S4 | loading | form, nav, static-content | ✅ covered | Carregando, a aba mostra esqueleto na forma do conteúdo (Estados transversais). |
| S4 | error | form, nav, static-content | ✅ covered | Erro de gravação vira Toast tone="error" com a frase do domínio, literal; contêiner inexistente ou fora do alcance mostra o EmptyState «Contêiner não encontrado.» (S4 Estados). |
| S4 | partial | form, nav, static-content | ✅ covered | ?aba= ausente, desconhecido ou de aba que o nível não tem (por exemplo formularios num Espaço) cai em geral, e trocar de aba usa router.replace sem empilhar histórico (S4 Abas, A14). |
| S4 | overflow | form, nav, static-content | ✅ covered | Em tela estreita a lista de abas rola na horizontal e a aba ativa fica visível ao carregar com ?aba= (S4 Abas). |
| S4 | long-text | form, nav, static-content | 🧪 backstop | Teste visual: nome longo de contêiner no título «Configurações de {nome}», no caminho e na Pilula «Herdado de {Tipo} {nome}» / «Bloqueado por {Tipo} {nome}» quebra linha ou trunca sem empurrar o interruptor para fora da faixa. |
| S5 | empty | form, nav | ✅ covered | Se o Espaço só liberou tipos que a lente proíbe, a Lista mostra apenas a aba «Lista»; com uma única aba mostrada a barra de Abas não é renderizada (S5 Consumo na página da Lista, A18). |
| S5 | loading | form, nav | 🧪 backstop | Teste visual: ao abrir a Lista enquanto a configuração efetiva ainda carrega, não pisca a barra de abas errada (cinco abas e depois menos). |
| S5 | error | form, nav | ✅ covered | Erro de gravação do editor vira Toast tone="error" literal; os estados intermediários são sempre válidos porque o tipo inicial não se desmarca e «É a Visualização inicial. Escolha outra antes de desmarcar.» fica visível, ligado por aria-describedby (S5 Editor, A17). |
| S5 | partial | form, nav | ✅ covered | Visualização salva de um tipo indisponível some da barra e volta junto com o tipo, sem ser apagada nem migrada; «Voltar a herdar» só existe com definição própria e nunca com bloqueio acima (S5 Barra de Visualizações salvas, D-06). |
| S5 | overflow | form, nav | 🧪 backstop | Teste visual: com muitas Visualizações salvas, a barra de Visualizações (view-bar.tsx) quebra ou rola sem esconder o botão «Salvar Visualização». |
| S5 | long-text | form, nav | 🧪 backstop | Teste visual: nome longo de Visualização salva na barra e rótulo de tipo no editor não estouram a linha de cinco tipos. |
| S6 | empty | interactive-control, list-collection | ✅ covered | Sem sobrescritas abaixo, o interruptor fica habilitado e a lista «Já definido em:» não aparece; aspecto que acumula (Campos, Tipos de Tarefa) nunca é impedido por descendentes (S6 tabela de estados). |
| S6 | loading | interactive-control, list-collection | ✅ covered | Gravando, o Toggle fica desabilitado até a resposta e o Toast vem depois (S6 Gravando). |
| S6 | error | interactive-control, list-collection | ✅ covered | Recusa do domínio (corrida) vira Toast tone="error" com a frase que nomeia a Pasta que sobrescreve, e o Toggle volta ao estado anterior (S6 Recusa do domínio, I9). |
| S6 | populated | interactive-control, list-collection | ✅ covered | Aspecto que substitui (Status, Funcionalidades, Visualizações) com sobrescrita abaixo: Toggle desabilitado e desligado, lista «Já definido em:» com um link por contêiner para …/configuracoes?aba={mesma aba} e a frase «Volte a herdar neles para poder bloquear.» (S6, L4). |
| S6 | partial | interactive-control, list-collection | ✅ covered | Contêiner privado que o Membro não alcança não entra na lista «Já definido em:» (B38a); a Lista nunca mostra o interruptor, só a linha «Bloqueado por…» quando um ancestral bloqueia (S6, D-15). |
| S6 | overflow | interactive-control, list-collection | ✅ covered | A lista «Já definido em:» rola dentro de max-h-48 overflow-y-auto quando longa e cada link tem aria-label="Abrir as Configurações de {Tipo} {nome}" (S6). |
| S6 | zero-one-many | interactive-control, list-collection | 🧪 backstop | Teste visual: a lista «Já definido em:» com um e com vários contêineres lê bem (um link sozinho e uma pilha deles); a frase de fecho vale para os dois casos. |
| S6 | long-text | interactive-control, list-collection | 🧪 backstop | Teste visual: nome longo de Pasta ou Lista como link em «Já definido em:» quebra linha ou trunca com title sem esconder o link. |
| S7 | empty | list-collection, nav, interactive-control, static-content | ✅ covered | Lista sem Tarefa mostra o EmptyState «Nenhuma Tarefa nesta Lista ainda.» (inalterado) e o vazio filtrado fica como hoje (S7 Estados). |
| S7 | loading | list-collection, nav, interactive-control, static-content | ✅ covered | Carregando, a página mostra esqueleto na forma do conteúdo (Estados transversais). |
| S7 | error | list-collection, nav, interactive-control, static-content | ✅ covered | Convidado ou Membro sem criar vê «Criar» e «Nova Tarefa» desligados com criacaoRecusada, como hoje; erros de gravação vão ao Toast de erro (S7 Estados). |
| S7 | populated | list-collection, nav, interactive-control, static-content | ✅ covered | A página, de cima para baixo, tem PageHeader, abas (até cinco; quatro na conversacional, sem Carga), barra principal com «Selecionar várias» e um só SelecaoEmLote nas três lentes, ViewBar e conteúdo; `grep -rn 'Rodar agenda'` e `grep -rn 'Rodar automações por vencimento'` em apps/web/src sem achados; a página fica abaixo de 1.000 linhas (S7, D-03, D-05). |
| S7 | partial | list-collection, nav, interactive-control, static-content | ✅ covered | Lista arquivada ou na lixeira mostra o aviso âmbar e não mostra as barras de criação; a contagem «Mostrando X de Y Tarefas.» só aparece com filtro ativo (S7 Estados, Contagem). |
| S7 | overflow | list-collection, nav, interactive-control, static-content | ✅ covered | Em tela estreita a BarraDeFiltros quebra em linhas, o campo de título mantém min-w-48 flex-1, «Selecionar várias» cai para a linha de baixo sem perder o alvo e as abas rolam na horizontal (S7 Tela estreita). |
| S7 | zero-one-many | list-collection, nav, interactive-control, static-content | 🧪 backstop | Teste visual: a linha «Mostrando X de Y Tarefas.» com Y igual a 1 lê com concordância correta («1 de 1 Tarefa»?); o contrato só fixa o plural e a variante «contas» da lente financeira (A20), então a forma singular é decisão aberta do plano. |
| S7 | long-text | list-collection, nav, interactive-control, static-content | 🧪 backstop | Teste visual: título de Tarefa, nome da Lista e rótulos das abas muito longos no PageHeader e na barra principal não empurram «Selecionar várias» nem as ações para fora da tela. |
| S8 | empty | list-collection, nav, static-content, interactive-control | ✅ covered | Espaço sem Lista nem Pasta mostra um só EmptyState compact «Este Espaço está vazio.» com «Nova Lista»; com só um dos grupos vazio, mostra a linha «Nenhuma Lista.» ou «Nenhuma Pasta.» (S8 Vazios, A22). |
| S8 | loading | list-collection, nav, static-content, interactive-control | ✅ covered | Carregando, a página mostra esqueleto na forma do conteúdo (Estados transversais). |
| S8 | error | list-collection, nav, static-content, interactive-control | ✅ covered | Espaço inexistente ou fora do alcance mostra o EmptyState «Espaço não encontrado.» (inalterado); Espaço arquivado ou na lixeira mostra StateSeal e não mostra «Criar» (S8 Estados). |
| S8 | populated | list-collection, nav, static-content, interactive-control | ✅ covered | A página lista Listas e depois Pastas, cada grupo ordenado por order, com a seção Painéis só quando há Painel e sem o painel lateral «Atributos» (uma coluna só) (S8 Ordem, Painéis, Some). |
| S8 | partial | list-collection, nav, static-content, interactive-control | ✅ covered | Atalhos (Caixa de Entrada do CRM) seguem depois das Listas na mesma seção e contam na contagem; sem Painel, nem a régua nem a dica «Um Painel é criado em Painéis…» aparecem (S8 Listas, Painéis). |
| S8 | overflow | list-collection, nav, static-content, interactive-control | ✅ covered | Em tela estreita a página fica em uma coluna (como abaixo de xl) e as ações do cabeçalho quebram no CabecalhoDeTela (S8 Tela estreita). |
| S8 | zero-one-many | list-collection, nav, static-content, interactive-control | ✅ covered | A meta do cabeçalho usa plural real: «{n} {Lista\|Listas} · {m} {Pasta\|Pastas}» (S8 Cabeçalho). |
| S8 | long-text | list-collection, nav, static-content, interactive-control | 🧪 backstop | Teste visual: nome longo de Espaço, Lista ou Pasta na lista e no título trunca (.app-md truncado) sem empurrar a Pilula «Conversacional» nem a contagem de abertas. |
| S9 | empty | list-collection | ✅ covered | Não há vazio novo: a tabela «Participações» mantém o estado vazio que já existe, sem copy nova (S9). |
| S9 | loading | list-collection | ✅ covered | Carregando, a página mantém o esqueleto de hoje, sem estado novo (S9, Estados transversais). |
| S9 | error | list-collection | ✅ covered | Sai o Toast «Capacidade semanal alterada.» junto com o CapacityEditor; nenhum erro novo nasce (S9). |
| S9 | populated | list-collection | ✅ covered | A tabela «Participações» fica com Membro · Papel · Estado · Disponibilidade · Entrou · (ações), sem a coluna «Capacidade/sem», e `grep -rn weeklyCapacityMinutes apps/web/src` sem achados (S9, D-13). |
| S9 | partial | list-collection | ✅ covered | O valor de capacidade já gravado em um Membro é ignorado: não aparece em lugar nenhum e não quebra a tela nem a hidratação (S9, D-13). |
| S9 | overflow | list-collection | 🧪 backstop | Teste visual: a tabela com seis colunas em tela estreita rola na horizontal sem a coluna de ações sair do alcance. |
| S9 | zero-one-many | list-collection | 🧪 backstop | Teste visual: a tabela com um único Membro e com muitos Membros mantém o alinhamento das seis colunas e as ações à direita. |
| S10 | overflow | static-content | 🧪 backstop | Teste visual: as frases de ajuda de create-container-dialog.tsx, serie-dialog.tsx e tarefa-completa.tsx depois de perder o código seguem quebrando linha normalmente, sem espaço duplo nem pontuação órfã. |
| S10 | long-text | static-content | ✅ covered | Em cada uma das 13 cadeias apaga-se o código e o espaço antes dele, e nada mais; `sem-codigo-de-regra.test.ts` passa nos .tsx de features/estrutura e app/(shell)/estrutura, e as cadeias 10–13 (domínio) ganham asserção própria no teste de domínio (S10). |

<!-- Status vocabulary (locked by probe-core projectTruths):
     ✅ covered   → a plain truth string lifted into must_haves.truths
     🧪 backstop  → a flat scalar { statement, verification: backstop }; at verify time, no explicit
                    evidence → insufficient_spec → human_needed (never a silent pass, #1154)
     ⚠ unresolved → an explicit planner assumption (surfaced, never silently dropped)
     Rows are REPLACED (not appended) on a probe re-run — idempotent. -->

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | nenhum — projeto não usa shadcn (`Tool: none`) | não aplicável |
| terceiros | nenhum | não aplicável |

Nenhum pacote visual novo (D-12). Nenhum acréscimo de dependência em `apps/web` nesta fase.

---

## Premissas e itens em aberto

Decisões tomadas sem poder perguntar ao dono. Em cada uma foi escolhida a opção **conservadora**, a que repete um padrão existente. O verificador e o dono podem revertê-las sem custo (são marcação e texto). Nenhuma contradiz uma D-NN.

**Premissas (`[auto]`, o executor segue como escrito)**

| ID | Premissa | Por quê | Reverter |
|---|---|---|---|
| A1 | Zonas de soltura da árvore: Pasta/Subpasta 25/50/25 (antes/dentro/depois), Lista e Espaço 50/50; contêiner aberto com filhos: quarto de baixo vale «dentro»; Espaço nunca «dentro». Realce: `--acento-lavado` + `--linha-acento` (dentro), linha de 2px `--acento` (entre) | D-10 deixa o desenho ao arbítrio; é a leitura mais comum (ClickUp) usando só tokens e o precedente do calendário | Trocar as proporções; só marcação |
| A2 | Todo Espaço/Pasta/Subpasta (exceto o próprio item, descendentes e pai atual) é alvo «dentro», **inclusive** os que o domínio recusa; a recusa sai no Toast | O dono pediu que arrastar Pasta com Subpastas para dentro de Pasta «mostre a recusa» | Realçar só alvos sem recusa (L1 antes do realce) |
| A3 | Mover acrescenta no **fim** do grupo de destino; reposicionar é outro gesto | `moveContainer` não recebe posição (D-11) | Estender a operação com posição |
| A4 | Mover/reordenar na árvore e o diálogo usam `runConfirmado`; o Toast de sucesso só depois da resposta; a árvore fica `aria-busy` | `rodarNaCopia` só muda `data` quando a diferença volta (`store.ts:121`, 2.2.5 adiada): Toast antes mentiria | Usar `run` e aceitar o atraso visual |
| A5 | Reordenar não dá Toast de sucesso; mover dá (D-10). Pasta rebaixada a Subpasta e Subpasta promovida movem **na hora** (sem diálogo) com Toast que nomeia a mudança | D-10: diálogo só com consequência de Status/Campos; mover Negócio no quadro (07) é o precedente do «sem Toast» | I2 |
| A6 | `Subir`/`Descer` no menu de linha (Espaço, Pasta, Subpasta, Lista) como caminho por teclado/leitor de tela da reordenação, além de `Mover para…` | WCAG 2.5.7; 07-UI-SPEC fez o mesmo («Mover para {Etapa}»); D-10 deixa o teclado ao arbítrio | Remover os dois itens |
| A7 | Em aparelho sem hover (`(hover: none)`) o «+» e o «⋯» da árvore ficam sempre visíveis | Sem isso «Mover para…» é inalcançável no telefone (o «+» já sofre disso hoje) | Manter só hover |
| A8 | Contêiner fechado sob o ponteiro por 600ms abre uma vez durante o arrastar | Sem isso Pastas dentro de um Espaço recolhido não são alcançáveis pelo gesto | Remover o temporizador; o menu cobre |
| A8-bis | Pasta/Subpasta ganha um `ActionMenu` «Mais ações» com um só item | A página da Pasta não tem menu; o item de D-10 precisa de casa | Trocar por botão `ghost` «Mover para…» |
| A9 | A Pasta `MEUS_NEGOCIOS_ID` e as Listas dela, a árvore `MeusNegociosNoPainel` e a Lista de Meus negócios (espelho comercial) **não** arrastam nem mostram «Mover para…»/«Subir»/«Descer» | São o espelho do Funil; o CRM tem árvore própria; nenhuma decisão manda mexer neles | Liberar se o domínio permitir |
| A10 | Soltar em cima do pai atual não é alvo e não dá Toast. A10-bis: a âncora da linha recebe `draggable={false}` e o arrasto sai da `div` | Evita ruído de erro num gesto ambíguo; evita o navegador arrastar a URL | Mostrar a recusa «no mesmo lugar» |
| A11 | O diálogo S2 vive na casca e abre por `?mover={id}[&destino={id}]` | Mesmo mecanismo de `MOVE_TASK_PARAM` e `useCreateContainerDialog` | Estado em memória na casca |
| A12 | No diálogo S2 a categoria aparece por extenso (`STATUS_CATEGORY_LABEL`) e a introdução da tabela é curta; `move-task-dialog.tsx` **não** é editado | O dono não quer frase que explique a regra nem chave crua na tela | Reusar o texto do diálogo de Tarefa |
| A13 | `Abas` ganha `id` por aba, `aria-controls` e setas/Home/End (sem mudar o visual); o conteúdo é `role="tabpanel"` | Hoje o `tablist` não liga aba a painel nem navega por setas; as Configurações viram aba-por-URL | Não tocar `Abas` e registrar dívida (I7) |
| A14 | `?aba=` inválido ou de aba que o nível não tem cai em `geral`; trocar de aba usa `replace` | Evita 404 de aba e histórico poluído | `push` |
| A15 | Campos/Tipos de Tarefa (acumulam) mostram `{n} definidos aqui · {m} herdados` no lugar de «Herdado de X»; o interruptor ligado traz `Os já criados continuam valendo.` | «Herdado de X» não descreve o que acumula; sem a frase a pessoa espera que o bloqueio apague o que existe | Tirar a frase |
| A16 | Não há aba nem interruptor para **Automações** nesta fase | D-17 lista as abas e não inclui Automações; o domínio recusa `criarAutomacao` sob bloqueio, mas ninguém liga o bloqueio pela tela | I3 |
| A17 | O editor de Visualizações grava a cada mudança; o tipo inicial não se desmarca (motivo visível); aviso de Visualizações salvas guardadas no Toast | Mantém todo estado intermediário válido (o domínio recusa `disponiveis` vazio e `inicial` fora); D-06 «some e volta» pede que a pessoa saiba | Botão «Salvar» único |
| A18 | Abas = `config.views.disponiveis` ∩ lente; interseção vazia → só `Lista`; uma só aba → a barra some; salvas filtradas pelas abas mostradas | Complementa D-06/D-07 nos cantos que eles não cobrem | Mostrar sempre a barra |
| A19 | «Selecionar várias» desligado com motivo quando a aba `Lista` não está disponível | A seleção em lote só funciona na Lista; forçar a aba a esconderia | — |
| A20 | A contagem usa «contas» na lente financeira e «Tarefas» nas demais | O `meta` do cabeçalho financeiro já fala «contas» | Sempre «Tarefas» (a letra do documento) |
| A21 | As páginas ordenam cada grupo por `order`; Listas vêm antes de Pastas nas páginas (formato da Pasta, 2.1.9) | D-08 manda o arrastar da árvore valer nas páginas; 2.1.9 manda copiar a Pasta | I4 |
| A22 | Espaço vazio: um só `EmptyState`; um grupo vazio: linha `.app-meta` | A Pasta mostra «vazia» mesmo com Subpastas; aqui não repetimos o defeito | Copiar a Pasta literal |
| A23 | O menu «Automatizar» do Financeiro fica com o item `Ver Automações desta Lista` | D-03 manda apagar o menu só se ficar vazio | Trocar por botão |
| A24 | A frase `ajuda` de «Modelo de Tarefa» («O modelo é da Lista e não herda…») sai; a `dica` do interruptor fica | Frase que explica a regra; é a mesma família que o dono mandou tirar | Manter a frase |
| A25 | Tipografia declarada com 4 tamanhos (`app-base`, `app-sm`, `app-meta`, `app-md`) e 2 pesos (400, 500) | O sistema já usa as quatro classes nos componentes reaproveitados | — |

**Itens em aberto (o planejador/dono decide; nenhum bloqueia a execução)**

| ID | Item | Estado |
|---|---|---|
| I1 | **Permutação completa × o que o Membro vê.** `reorderContainers` recebe a permutação completa do grupo (D-08), mas o estado de um Membro não contém os irmãos privados que ele não alcança, e a árvore esconde arquivados e na lixeira. A tela só consegue mandar o que conhece. O domínio precisa fechar isto (aceitar a permutação do **subconjunto alcançável** e manter os demais no lugar, ou receber posição relativa). Sem isso, reordenar falha com «falta id» para quem não vê todos os irmãos | **aberto, domínio** |
| I2 | **Pasta rebaixada / Subpasta promovida sem confirmação** (A5). Muda o nível de uma Pasta sem diálogo. Se o dono achar pesado, tratar como «consequência» em L2 e abrir o diálogo | aberto |
| I3 | **Bloqueio de Automações sem tela.** `setContainerBlock` aceita `automations` e `criarAutomacao` passa a recusar, mas não há aba onde ligar o bloqueio. Se o dono quiser, uma aba «Automações» (lista somente leitura + interruptor) | aberto |
| I4 | **Ordem dos grupos.** A árvore lista Pastas e depois Listas (D-08); as páginas do Espaço e da Pasta listam Listas e depois Pastas. D-08 diz «Pastas em cima, Listas embaixo» também para as páginas; 2.1.9 manda copiar a Pasta (Listas primeiro). Manter assim até o dono ver na UAT | aberto |
| I5 | **Códigos em outras áreas.** A limpeza de 2.1.10 é só da Estrutura. As telas de IA (`features/ia/*`) mostram dezenas de `(RN-HAB-…)`, `(B71)`, `(INV-AGE-…)`; a postura do dono se aplicaria a elas, mas é outra fase | aberto (fora da fase) |
| I6 | `move-task-dialog.tsx` mostra a categoria como chave crua (`emAndamento`) e usa «Tarefa(s)». Este contrato corrige no diálogo novo e **não** edita o antigo | aberto |
| I7 | Se `Abas` não puder ser tocado (A13), o `tabpanel` fica sem `aria-labelledby` e o tablist sem setas: dívida de acessibilidade em todas as telas que usam `Abas` | aberto |
| I8 | **Arrastar por toque** (Android/iPadOS) não foi verificado; o menu é o caminho garantido. Conferir na UAT em aparelho real, junto com o auto-scroll da barra lateral e o `draggable={false}` da âncora no Safari | aberto (UAT) |
| I9 | A recusa do domínio que **nomeia** a Pasta que sobrescreve (D-16) aparece no `Toast` de erro como o domínio a escrever; a tela evita chegar nela (S6), mas o texto exato é do domínio | informativo |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: FLAG (não bloqueante)
- [x] Dimension 2 Visuals: FLAG (não bloqueante)
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: FLAG (não bloqueante)
- [x] Dimension 5 Spacing: FLAG (não bloqueante)
- [x] Dimension 6 Registry Safety: PASS
- [x] Dimension 7 Inventory Provenance: PASS

**Approval:** approved 2026-10-28 (0 BLOCK, 4 FLAG)

**Recomendações do verificador (não bloqueantes, para o planejador):**
- Copywriting: o botão do diálogo é só «Mover» e o do menu «Criar»; considerar «Mover Lista» / «Mover Pasta» no diálogo. «Cancelar» fica por ser o secundário padrão do ConfirmDialog.
- Visuals: declarar um ponto focal por superfície (barra de abas da Lista; seção «Listas» do Espaço; linhas de mapeamento de Status no diálogo «Mover»).
- Typography: tamanhos 11, 12, 13 e 14px herdados das classes .app-*; acrescentar uma linha que justifique serem valores de piso do sistema.
- Spacing: 12px (--e-3, usado no gap-3 do diálogo e no recuo da árvore depth × 12px) não está na escala declarada; mover para a lista de Exceções com a justificativa «token herdado e recuo da árvore».
- Itens em aberto que o planejador precisa fechar: **I1** (permutação do subconjunto alcançável em reorderContainers, bloqueia a tarefa de arrastar-reordenar) e **I4** (ordem dos grupos na árvore × páginas, conferir na UAT).
