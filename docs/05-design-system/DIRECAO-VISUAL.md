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

**A única exceção é o Início**, que mantém a concepção original do produto: os quatro números (ícone na cor do que medem) e, em vez da barra de 44 px, uma **capa** — a atmosfera do sistema (três orbes desfocados, a grade de pontos e estrelas, tudo CSS), a saudação em `ed-display`, a pergunta ao Assistente, os quatro atalhos, o **globo de pontos** (`design/globo.tsx`: canvas, gira, inclina para o cursor, acende perto dele, abre o Chat) e as **Ações rápidas** na barra opaca da base. Abaixo, uma lista única do dia por urgência (Agora, Hoje, Esta semana, Depois) com Conversas e Negócios ao lado. As classes `.capa`, `.capa-orbe`, `.capa-estrela` vivem em `componentes.css`. Já foi um laço de vídeo com riscos de neon; saiu porque os riscos chegavam a branco puro e exigiam uma cortina pesada para o texto ler.

O cabeçalho **não tem parágrafo explicativo**: a contagem ("15 contas", "3 de 49 ativas") fica ao lado do título e a tela se explica pelo conteúdo. Prosa que explicava um vazio virou `hint` do `EmptyState`; prosa que explicava uma regra virou `title` do controle ou sumiu.

Telas de registro (Contato, Empresa, Negócio, Membro, Execução) usam o corpo em duas colunas — `grid xl:grid-cols-[minmax(0,1fr)_22rem]` — com painéis de título (`Painel` + `CabecalhoDePainel`) à esquerda e os atributos (`RecordPanel`/`RecordRow`) à direita.

**A Tarefa é a exceção, no molde do ClickUp.** A ficha no centro (`max-w-4xl`): o Tipo em caixa colorida com o identificador, o título grande (`ed-display`) e a descrição — clicar em qualquer um abre o editor —, as propriedades em duas colunas de `LinhaDeProp` (ícone · rótulo · valor; o editor só existe ao clicar na linha), os Campos numa lista da mesma família com a etiqueta *obrigatório*, e abaixo as seções em régua (Checklists, Subtarefas, Dependências, Recorrência, Vínculos, Anexos, Observadores). À direita, numa coluna de 26 rem, a **Atividade**: os Comentários como conversa (balões, fios, compositor preso à base) e o Registro de Atividade recolhido num `details`. Abaixo de `xl` a Atividade empilha embaixo com `--conversa-empilhada-h`.

O popup de uma Tarefa (aberto da Lista por `?tarefa=`) **é a mesma Tarefa completa**, com o chat à direita — não uma leitura resumida com botão de editar. Na barra de 44px todo botão é pequeno (`.acoes-de-tela`). Recolher o menu esconde só o painel do assunto; o trilho fica.

Listas mistas (Notificações, Início) abrem cada linha com o **Selo** do que ela é: a Tarefa leva o ícone e a cor do seu Tipo (Conta = recibo verde, Reunião = pessoas azul, Incidente = alerta vermelho), e Aprovação, Conversa, Menção, Negócio e Execução têm os seus. Um estado de alerta (vencida, bloqueada) recolore o selo sem trocar o desenho.

Grupos e colunas por Status que **não têm nada não aparecem** na Lista agrupada, a não ser que o filtro tenha escolhido aquele Status; no Quadro as colunas vazias ficam, porque são o alvo do arraste. Quadros rolam de lado com a barra **acima** dos cards (`RolagemNoTopo`).

---

### O construtor de Flow, a única tela de três colunas

`/ferramentas/flows/[flow]` é a exceção ao esqueleto de uma coluna: `grid xl:grid-cols-[16rem_minmax(0,1fr)_22rem]`, cada coluna um `Painel` (Telas · Tela selecionada e Componentes · Validação, Publicar, Versões, prévia). Sem arrastar-e-soltar — subir/descer e "mover para dentro de" no menu —, e a seleção mora na URL (`?tela=`), como toda aba e todo popup. Abaixo de `xl` as colunas empilham na ordem de leitura.

## 5. Movimento — as quatro leis

**Vigente desde 2026-09-17.** A tese cabe numa frase: **a casca nunca sai do lugar; a tela chega porque as suas peças chegam.** Cabeçalho primeiro, depois a barra de filtros, depois as peças descendo em cascata de 30 ms, tudo assentado em menos de 600 ms — e só na chegada, nunca em filtro, aba, "Mostrar mais" ou tecla. O que está carregando já tem a forma exata do que vem (esqueleto por família de rota; nunca ampulheta, nunca atraso fabricado). O que demora tem um fio de luz de 2 px no topo da tela, um ícone pulsando no trilho e, passada a carência, o carregador de ícones no centro — os objetos do produto se revezando dentro de um aro que gira, sem escurecer a tela velha. O que acabou de mudar se acende e apaga. Uma curva, durações por token, e `prefers-reduced-motion` desliga tudo sem perder nenhum estado.

Onde mora: os tokens no bloco **Movimento** de `tokens.css` (`--dur-1` 150 ms · `--dur-2` 300 · `--dur-3` 500 · `--dur-4` 700 · `--easing` · `--easing-saida` · `--dur-passo` 30 ms · `--dur-cascata` 1 s · `--dur-realce` 1,5 s · `--dur-aviso` 6 s · `--dur-aviso-longo` 8 s · `--dur-progresso` · `--dur-pulso` · `--dur-giro` · `--dur-icone` 600 ms · `--dur-navegacao-max` 30 s · `--fio` 2 px · `--esqueleto` · os laços da atmosfera); o vocabulário (`surgir`, `revelar`, `aparecer`, `sumir`, `destacar`, `cascata`, `chegada`, `esqueleto`, `barra-progresso`, `regua-tempo`…) em `componentes.css` e `controles.css`; a ponte para o pouco que roda em JS em `design/movimento.ts`. `COMPONENTES.md` ("Movimento") descreve cada classe e cada hook.

### As leis

1. **Uma curva, durações por token, um passo.** Toda interação usa `var(--easing)`; toda duração é um `--dur-*`; toda cascata avança de `--dur-passo`. Nenhum `ms`/`s` literal fora de `tokens.css`; nenhum `animate-*`, `duration-*`, `ease-*` ou `transition-transform` do Tailwind — a sentinela reprova (§6). O porquê: um valor mudado num lugar muda o sistema inteiro, e uma curva só é o que faz duas peças parecerem do mesmo produto.
2. **Contêiner só esmaece; peça e folha é que se movem.** O invólucro de rota (`.chegada`), o corpo da tela, o painel de navegação, o `<aside>` e qualquer ancestral de `SidePanel`/`ConfirmDialog` só recebem `opacity`. Nunca `transform`, `filter`, `will-change`, `contain`, `container-type` nem `overflow` neles: os popups são `fixed` sem portal, e um `transform` num ancestral os prende dentro dele (há popups que renderizam um `ConfirmDialog` dentro do próprio `aside`). Sem `scale` em popup.
3. **Toda entrada termina em `transform: none` / `filter: none`.** `animation-fill-mode: backwards` só para cobrir o `animation-delay`; `forwards` só em `sumir` (a saída que desmonta) e nas folhas sem descendentes (`.barra-progresso`, `.regua-tempo`). O porquê: um `forwards` com transform deixa um bloco de contenção e uma camada de composição para sempre.
4. **Movimento nunca é o único sinal.** `role=status`, `aria-busy`, `disabledReason`, texto e forma dizem o estado antes de a animação dizer. Nada anima em re-render por `revision`: só na montagem, dentro da janela de chegada, ou por ação da pessoa. Nunca um `setTimeout` para "mostrar" esqueleto ou spinner — o armazém é síncrono; o que aparece é o que existe.

### A exceção nomeada: laços e medidores

`--easing` é a curva de **interação**. Um laço (o pulso do esqueleto e do ícone pendente, o giro do spinner, a deriva das orbes, o cintilar das estrelas) usa `ease-in-out`; um medidor (a régua de tempo do Toast, a barra de rota rumo a 80 %) usa `linear` ou `--easing-saida`. Um laço não é interação — não começa nem termina numa ação da pessoa — e um medidor que acelera mente. São as únicas curvas além de `--easing`, e estão nomeadas aqui para que a lista não cresça.

### O orçamento por tela

| O quê | Quanto |
| --- | --- |
| A tela | 1 fade de 150 ms no invólucro + cabeçalho (0 ms) + barra, painéis e réguas (1 passo) + estado vazio (2 passos) + 1 onda de ≤ 10 degraus (a última peça começa em 270 ms e assenta em 570 ms). Tudo assentado em < 600 ms (Início < 900 ms, por causa da capa); a janela fecha em 1 s. |
| Peça densa (linha, conversa, cartão, resultado) | `surgir`: 300 ms, 4 px, sem blur. Da 11ª peça em diante, `aparecer`, todas juntas no último degrau. Quadro: só opacidade. |
| Superfície de pausa | `revelar`: 500 ms, 12 px + blur de 6 px — **só** em Notificações, Painéis e Entrar (mais a capa do Início e o estado vazio). |
| Popup (`SidePanel`, `ConfirmDialog`) | entra em 300 ms, sai em 150 ms; sem escala, sem altura animada. |
| Menu, seletor, subárvore | entra em 150 ms, sai em 0 — fecha no quadro da escolha. |
| Toast | entra em 300 ms, sai em 150 ms; vive 6 s (8 s com ação); erro não expira. |
| Laços infinitos | só no esqueleto (visível < 1 s), no spinner, no carregador de ícones (aro e ciclo), na capa do Início, na atmosfera do Entrar e na marca do Login (flutua e respira). |
| Blur | só em `revelar` e no véu (2 px). Halo só no fio (`--brilho-fio`). |
| Camadas | sem `will-change` em lugar nenhum; nenhuma camada de composição permanente depois de 1 s. `transition: width/height` só nas folhas de gráfico (poucas e pequenas). |
| Por tela | count-up ≤ 8 nós · lanterna ≤ 12 por grade · esqueleto ≤ 24 linhas com `--i`. |

Se o Início — a tela mais cara: orbes com blur, o globo em canvas, ~34 peças — cair abaixo de 50 fps com CPU 4×, os cortes são, nesta ordem: o globo já só liga depois da capa; tirar o `revelar` do estado vazio; `--dur-passo` de 30 para 20 ms. Nunca subir.

### Movimento reduzido: o que desliga e o que fica

`prefers-reduced-motion: reduce` e o freio da pessoa (abaixo) zeram, com `!important`, a duração, o delay e a iteração de toda animação e transição (`tokens.css`, bloco "Movimento reduzido"). Em JS, `reduzido()` é verdadeiro e `lerDuracao` devolve 0.

- **Desliga:** cascata e chegada (tudo no primeiro quadro), `surgir`/`revelar`/`aparecer`/`sumir` (o popup desmonta na hora), a régua do Toast, pulso e giro (uma iteração → parados), a luz do trilho (salta), orbes e estrelas, a lanterna (não registra o listener), o globo (um quadro; nascimento = 1), o count-up (valor final no primeiro quadro), o realce, as transições de gráfico.
- **Fica:** a barra de rota salta a 80 % depois da carência de 150 ms e some ao concluir — `transition-delay` não é zerado, porque a carência é informação; o esqueleto parado em `--esqueleto` (7 %), legível como forma; `role=status`, `aria-busy`, `disabledReason` e o `sr-only` com o valor final; o foco de volta ao abridor no instante do fechar; os prazos do aviso, por timer — `lerDuracao(token, { medidor: true })` devolve o valor cheio, porque tempo de leitura não é movimento.

### O freio da pessoa

`<html data-movimento="minimo">` liga o mesmo bloco de CSS do `prefers-reduced-motion`, e `reduzido()` o lê também. Este documento registra só o mecanismo: onde a pessoa liga isso (uma preferência em `/minha-conta`) está fora deste pacote — `docs/PENDENCIAS-FRONTEND.md`, P7.

### Como se verifica

Toda PR que toque movimento roda o checklist de `CHECKLIST-MOVIMENTO.md` com o harness `app/scripts/capturar-movimento.mjs` (`npm run capturar:movimento`): fotos em instantes fixos, com a interface 10× mais lenta pelos próprios tokens, movimento reduzido emulado e a contagem de resíduos em repouso.

---

## 6. O que esta direção proíbe

- **Cor crua em TSX.** Nenhum `#hex`, `rgb()`, `hsl()`, `text-white`, `bg-black` fora de `estilos/tokens.css`. A sentinela `npm run verificar:tokens` reprova o build. A exceção é a cor que é **dado** (a paleta que o Espaço grava, a cor de um Status) — ela entra na lista `DISPENSADOS` da sentinela com o motivo escrito.
- **Tamanho de fonte literal em TSX** (`text-[13px]`, `text-[1.75rem]`). Tamanho é classe `.ed-*` ou `.app-*`.
- **Raio e sombra literais em `components.tsx`** (`rounded-[14px]`, `shadow-[…]`). `tokens.test.ts` reprova.
- **`transform` em estado de repouso.** O painel lateral e o diálogo são `fixed` sem portal; um `transform` permanente num ancestral os prende. Lift só em `:hover`/`:active`, e toda entrada termina em `transform: none` (§5, lei 3).
- **Duração literal e utilitário de movimento.** Nenhum `300ms`/`1.5s` fora de `tokens.css`; nenhum `animate-*`, `duration-*`, `ease-*` ou `transition-transform` em `className`; nenhum `will-change`; `forwards` só em `sumir` e na régua do Toast. É a regra 4 da mesma sentinela: a curva e o tempo são do sistema, não da peça.
- **`overflow: hidden` em volta de peça solta** — corta a sombra e o lift. E wrapper `overflow-x: auto` em volta de `.tabela` — vira contêiner de rolagem nos dois eixos e o `thead` deixa de grudar. Quem rola é o corpo da tela; colunas menos úteis somem por **largura do contêiner** (`@container` + `@3xl:table-cell`…), não por largura da janela, porque a casca come 320 px.
- **Gradiente fora do botão sólido e da marca.** Os 10 % do manual são exatamente isso.
- **Emoji como ícone; ícone fora de `<Icone>`** (Lucide, traço 1.5, quatro tamanhos por token).
- **Cor como único sinal.** Toda categoria colorida carrega rótulo.

---

## 7. Acessibilidade como restrição de origem

- **Contraste AA verificado por teste** (`app/src/design/tokens.test.ts`): o teste resolve as cadeias `var()` do próprio `tokens.css` até o hex e reprova a rampa de texto que não atinge 4.5:1 sobre `--page`, `--card` e `--cinza-600`, o `--sobre-acento` sobre o acento, o `--sobre-degrade` sobre os dois extremos do gradiente, e as famílias semânticas sobre a página.
- **Foco visível sempre**: anel de 2 px em `--acento`, deslocado, em `:focus-visible` global.
- **Teclado** nos seletores, no menu e nos diálogos como antes; `SidePanel` e `ConfirmDialog` prendem e devolvem o foco.
- **`prefers-reduced-motion`** desliga tudo sem perder nenhum estado — cascata, popups, régua do Toast, laços, lanterna, globo, count-up (§5). O que informa fica: a barra de rota salta, o esqueleto para legível, `role=status`, `aria-busy` e o foco de volta ao abridor. `<html data-movimento="minimo">` é o mesmo freio nas mãos da pessoa.
- **Alvo de toque**: 32/36 px no desktop; abaixo de 768 px todo controle com `.alvo-toque` cresce para 44 px.
