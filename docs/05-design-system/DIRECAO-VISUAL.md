# Direção visual

**Vigente desde 2026-09-14.** O produto foi refeito do zero sobre o **design system do CRM-COMPLETO** (`CUR/CRM-COMPLETO`): a mesma estrutura de tela, as mesmas peças, os mesmos efeitos e a mesma diagramação — com a **cor e a tipografia do Manual de Marca da N1 Digital** no lugar das do CRM. Este documento descreve o que está no ar. As direções anteriores ("Auton", índigo, tema claro; depois a camada escopada `.fin`) foram substituídas e não valem mais para nada — a última tentativa está guardada num `git stash` para consulta, não para uso.

---

## 1. A regra de origem

Duas fontes, cada uma dona de uma coisa:

| O que | Vem de | Onde está |
| --- | --- | --- |
| Estrutura, peças, efeitos, escalas, casca, densidade | CRM-COMPLETO | `app/src/estilos/*.css`, `app/src/design/*` |
| Cores e tipografia | `MANUAL DE MARCA - N1 DIGITAL.pdf` | valores em `app/src/estilos/tokens.css` |

Quando as duas fontes discordam, a **estrutura** vence: o valor da marca entra no lugar do valor do CRM, nunca uma peça nova no lugar de uma peça do CRM. A única divergência estrutural declarada é o botão sólido, que no CRM é chapado e aqui é o gradiente da marca (§3).

---

## 2. A marca, traduzida

O manual pede a paleta em proporção — **preto 45 % · branco 25 % · `#2A2A2A` 20 % · gradiente `#2C0263 → #9601C5` 10 %** — e a fonte **SF Pro Display**. A tradução para uma ferramenta de trabalho de tela densa:

- **Preto é a página, mas não é `#000`.** `--page: #0f0f10`. Preto puro sob luz de escritório vira um buraco onde a sombra das peças some; o cinza-quase-preto mantém a leitura de "escuro" e deixa a elevação existir.
- **`#2A2A2A` é o destaque**, não a superfície. As superfícies são **lavagens brancas em alfa** sobre a página (3 %, 4 %, 5 %, 6 %, 8 %), como no CRM — é isso que faz uma peça parecer solta e não pintada. `--cinza-600: #2a2a2a` fica para o realce forte (ativo, selecionado).
- **O branco é o texto**, em rampa: `--texto #fff` → `--texto-1 #e6e6e8` → `--texto-2 #c8c8cc` → `--texto-3 #98989f` → `--texto-4 #7c7c84`. Os quatro primeiros passam AA (4.5:1) sobre a página, o cartão e o `#2a2a2a`; o quarto passa 3:1 e é só para meta, régua e ícone apagado.
- **O roxo é o acento, e é raro.** `--acento: var(--roxo-300) #c084fc` — o tom do manual (`#9601C5`) fica abaixo de AA sobre o escuro, então o tom claro assume o papel de texto/ícone/foco. O gradiente do manual aparece **num lugar só**: o botão sólido (`--degrade-acento: #7a00a3 → #9601c5`, texto `--sobre-degrade: #fff`) e a marca no trilho. Os 10 % do manual são isto.
- **SF Pro Display** é a fonte de tudo (`--fonte-corpo`), com Inter como reserva carregada por `next/font`; JetBrains Mono para identificadores (`.identificador`). Uma família, hierarquia por peso, tamanho e tracking.

As cores **semânticas** não vêm da marca e não a imitam: `--sucesso #4ade80`, `--info #7dd3fc`, `--aviso #fbbf24`, `--erro #fca5a5`, `--neutro`, cada uma com o seu `-lavado` (12 % de alfa) para fundo. O vocabulário antigo do N1 (categoria de Status, situação de Negócio, estado de Conversa e de Execução, selos, domínios, tipos de Ator) continua definido, agora derivado desses tokens.

---

## 3. A linguagem de peça

O CRM-COMPLETO não tem "cartão com sombra" nem "linha com hairline": tem **peça solta**. Cada linha de lista, cada número de resumo, cada cartão de quadro é uma peça com contorno de 1 px (`--linha`), raio de 14 px (`--r-painel`), elevação de repouso (`--sombra-repouso`) e um vão de 8 px (`--gap-solto`) até a próxima. No hover a peça **sobe** (`--lift`, −2 px), a sombra cresce e o contorno acende; no clique, volta.

As famílias, todas em `app/src/estilos/componentes.css` e `controles.css`:

- **Superfície:** `.painel` (lavagem 3 %), `.painel-solido` (`--card`), `.trilho` (superfície rebaixada — coluna de quadro, painel de navegação), `.casca-destaque`.
- **Peça:** `.item-solto` dentro de `.pilha-solta` (coluna) ou `.grade-solta` (grade). Estados por atributo, não por classe nova: `data-destacado` (não lido, selecionado, ativo), `data-bloco` (empilha várias linhas), `data-alinhamento="topo"`, `data-estatico` (não clica — não sobe), `data-atenuado` (concluído, pago — recua sem sumir).
- **Tabela:** `.tabela` — `border-spacing` abre o vão, cada `tr` é uma peça, o `thead` gruda no corpo da tela, `tr[data-faixa]` é rótulo de grupo (sem raio, sem lift), `tr[data-selecionada]` acende, `[data-densidade="compacta"]` é a grade colada (planilha, prévia de importação).
- **Controles:** `.btn` (+ `-contorno`, `-solido`, `-fantasma`, `-sutil`, `-perigo`, `-icone`, `-sm`) em caixa-alta com tracking, `.campo`, `.caixa`, `.radio`, `.chave`, `.pilula` (+ `-ponto`), `.selo`.
- **Flutuantes:** `.veu`, `.flutuante` (+ `.surgir`), `.item-menu`.
- **Efeitos:** `.flutua` (lift), `.lanterna` (aro cônico roxo que segue o cursor — um listener por contêiner, `design/lanterna.tsx`), `.grade-pontos` (a textura do fundo), `.sublinhado` (a aba).

Duas escalas tipográficas (`tipografia.css`): **editorial** `.ed-display/.ed-titulo/.ed-subtitulo/.ed-secao/.ed-eyebrow/.ed-corpo`, com tracking negativo nos títulos e positivo nas etiquetas; e **de aplicação** `.app-xs/.app-sm/.app-base (13 px)/.app-md/.app-coluna/.app-meta/.app-numero`, para a tela densa.

Três degraus responsivos (1440 / 1760 / 2200 px) crescem **só medidas** — altura de linha, controle, ícone, espaçamento, lift. Nenhuma cor muda por degrau.

---

## 4. A casca e o esqueleto de tela

A casca é a do CRM, em duas etapas (`features/shell/app-shell.tsx`): um **trilho** de 56 px com os assuntos (Trabalho, CRM, IA, Painéis, Configurações, a conta) e um **painel** de 232 px com as telas do assunto ativo, a busca e a árvore de Espaços ou de Sessões de Chat. Não há barra de topo.

Toda tela dentro da casca tem o mesmo esqueleto:

```
<div className="flex h-full flex-col">
  <PageHeader … />          44 px — título, contagem, selo, ações; fixo
  <BarraDeFiltros>…</>      40 px — busca, chips, seletores, abas de recorte; opcional
  <CorpoDeTela>…</>         o ÚNICO bloco que rola
</div>
```

**A única exceção é o Início**, que mantém a concepção original do produto: em vez da barra de 44 px ele abre com uma **capa** — o laço de vídeo do manual (riscos de neon roxo) sob uma cortina, a saudação em `ed-display`, a pergunta ao Assistente, os quatro atalhos, a **orbe** do Assistente e a régua dos quatro pilares do manifesto na base. As classes `.capa`, `.capa-video`, `.capa-cortina` e `.orbe-*` vivem em `componentes.css`. A cortina não é gosto, é medida: amostrando o vídeo, os terços da esquerda e da direita chegam a branco puro (texto branco precisa de ≥ 82 % de `--card` por cima) e o meio é quase preto — por isso o texto vive na coluna fechada e na régua opaca da base, e o vídeo só aparece numa janela em volta da orbe. No sistema novo as `--superficie-*` são lavagens em alfa: uma cortina feita delas deixaria o vídeo passar por baixo do título.

O cabeçalho **não tem parágrafo explicativo**: a contagem ("15 contas", "3 de 49 ativas") fica ao lado do título e a tela se explica pelo conteúdo. Prosa que explicava um vazio virou `hint` do `EmptyState`; prosa que explicava uma regra virou `title` do controle ou sumiu.

Telas de registro (Contato, Empresa, Negócio, Tarefa, Membro, Execução) usam o corpo em duas colunas — `grid xl:grid-cols-[minmax(0,1fr)_22rem]` — com painéis de título (`Painel` + `CabecalhoDePainel`) à esquerda e os atributos (`RecordPanel`/`RecordRow`) à direita.

---

## 5. O que esta direção proíbe

- **Cor crua em TSX.** Nenhum `#hex`, `rgb()`, `hsl()`, `text-white`, `bg-black` fora de `estilos/tokens.css`. A sentinela `npm run verificar:tokens` reprova o build. A exceção é a cor que é **dado** (a paleta que o Espaço grava, a cor de um Status) — ela entra na lista `DISPENSADOS` da sentinela com o motivo escrito.
- **Tamanho de fonte literal em TSX** (`text-[13px]`, `text-[1.75rem]`). Tamanho é classe `.ed-*` ou `.app-*`.
- **Raio e sombra literais em `components.tsx`** (`rounded-[14px]`, `shadow-[…]`). `tokens.test.ts` reprova.
- **`transform` em estado de repouso.** O painel lateral e o diálogo são `fixed` sem portal; um `transform` permanente num ancestral os prende. Lift só em `:hover`/`:active`.
- **`overflow: hidden` em volta de peça solta** — corta a sombra e o lift. E wrapper `overflow-x: auto` em volta de `.tabela` — vira contêiner de rolagem nos dois eixos e o `thead` deixa de grudar. Quem rola é o corpo da tela; colunas menos úteis somem por **largura do contêiner** (`@container` + `@3xl:table-cell`…), não por largura da janela, porque a casca come 320 px.
- **Gradiente fora do botão sólido e da marca.** Os 10 % do manual são exatamente isso.
- **Emoji como ícone; ícone fora de `<Icone>`** (Lucide, traço 1.5, quatro tamanhos por token).
- **Cor como único sinal.** Toda categoria colorida carrega rótulo.

---

## 6. Acessibilidade como restrição de origem

- **Contraste AA verificado por teste** (`app/src/design/tokens.test.ts`): o teste resolve as cadeias `var()` do próprio `tokens.css` até o hex e reprova a rampa de texto que não atinge 4.5:1 sobre `--page`, `--card` e `--cinza-600`, o `--sobre-acento` sobre o acento, o `--sobre-degrade` sobre os dois extremos do gradiente, e as famílias semânticas sobre a página.
- **Foco visível sempre**: anel de 2 px em `--acento`, deslocado, em `:focus-visible` global.
- **Teclado** nos seletores, no menu e nos diálogos como antes; `SidePanel` e `ConfirmDialog` prendem e devolvem o foco.
- **`prefers-reduced-motion`** desliga lift, lanterna e animações de entrada.
- **Alvo de toque**: 32/36 px no desktop; abaixo de 768 px todo controle com `.alvo-toque` cresce para 44 px.
