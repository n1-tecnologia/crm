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

A casca é a do CRM, em duas etapas (`features/shell/app-shell.tsx`): um **trilho** de 56 px com os assuntos (Trabalho, CRM, IA, Ferramentas, Painéis, Configurações) e um **painel** de 232 px com as telas do assunto ativo e a árvore de Espaços, as Pastas de Negócios ou as Sessões de Chat. Sobre a coluna da tela, uma **barra global** de 40 px (`features/shell/barra-global.tsx`) com o que é da pessoa: a busca ao centro (atalho `/`), e à direita Minhas Tarefas (com as vencidas), Notificações (o sino, com o mesmo total de T51) e a conta.

A barra de topo tinha saído em 2026-09-14: carregava marca, busca e conta e gastava uma faixa inteira com um vão no meio. Voltou em 2026-09-17 mais baixa e com outro conteúdo — a marca continua no trilho e o Espaço de Trabalho no painel; a barra leva só "o que espera por mim", à vista em qualquer assunto. O painel do Trabalho manteve as telas da pessoa — Início, Notificações, Visão geral e Minhas Tarefas — acima dos Espaços (foram tiradas em 2026-09-17 e devolvidas em 2026-09-21, a pedido: quem trabalha no menu quer achá-las ali); a barra repete as duas pendências para quem está noutro assunto, com o mesmo número. É casca: nunca anima na troca de rota; só o número que mudou surge (`surgir-rapido`). Desde 2026-09-24 o Início volta a resumir "o que espera por mim" — ABAIXO do palco, rolando — com as MESMAS derivações da barra e das telas.

Toda tela dentro da casca tem o mesmo esqueleto:

```
<div className="flex h-full flex-col">
  <PageHeader … />          44 px — título, contagem, selo, ações; fixo
  <BarraDeFiltros>…</>      40 px — busca, chips, seletores, abas de recorte; opcional
  <CorpoDeTela>…</>         o ÚNICO bloco que rola
</div>
```

**Todo quadro é o mesmo quadro** (fim de 2026-09-23: "tudo que for quadro, a visualização deve ser igual à da segunda imagem"): a coluna com a contagem num selo, o nome em pílula e o subtítulo; e o cartão com a anatomia do card de Negócio — rosto, título e subtítulo; pílulas; um destaque com ícone num ladrilho; e um rodapé em duas colunas rotuladas —, seja Negócio, Tarefa conversacional, Tarefa ou Conta (`features/shell/quadro.tsx`).

**O canto inferior direito é do robô** (2026-09-24). Fora do Início, o robô vira um círculo pequeno ali — o palco do Início em miniatura, preto, com o rosto dele —, e tocá-lo volta ao Início. Nenhum controle pode ficar por baixo dele: a barra de escrever que chega ao canto acaba antes dele (ou, numa coluna estreita, o robô sobe acima dela), e o que rola sob ele ganha no fim o espaço para o último item subir. Uma tela nova com uma barra no pé declara a doca (`.doca-do-robo`, COMPONENTES › `RoboFlutuante`); nunca se cola um botão no canto inferior direito da janela.

**A única exceção é o Início.** **Desde 2026-09-23 o palco é PRETO** (`--palco-inicio`, #000000 — a única superfície que dispensa o #0f0f10 da base), com a **saudação** no alto à esquerda ("Boa tarde, Thiago", o nome no acento), um **pontilhado** discreto por cima do preto (pontos de 2 px a cada 22 px, branco a 8 %), atrás da luz e do robô, e o **cursor** vira um ponto pequeno com um anel fino (lilás sobre o que se toca) e nele só há o **robô 3D** do Spline (a cena do componente `splite` do 21st.dev), centralizado e de perto — da cabeça ao meio da barriga —, virando a cabeça para o cursor em qualquer ponto da tela, com uma entrada curta de câmera (do rosto até essa pose, em 2,5 s) e **reflexos roxos** — o contraluz da cena no roxo da marca (`--reflexo-robo`) nas bordas de ombros, braços e pescoço, e o cromo do rosto retingido do preto ao roxo e ao lilás (`--reflexo-robo-brilho`); o corpo guarda os próprios reflexos; e **a logo da N1 no peito**, em Sobrepor sobre o carbono, presa ao tronco, que **acende no hover** (a própria logo, parada) — só decoração desde 2026-09-24 —, e a **caixa do assistente** FIXA no pé do palco (antes a logo pressionada a abria) — um campo pequeno em transparência sobre o robô, hairline só, sem sombra e sem borda roxa ao abrir, com o botão do microfone ao lado (o microfone só abre por ele) e, em cima, Silenciar e Legenda — aí as respostas aparecem em texto num **balão de chat ao lado da cabeça**, na mesma transparência, com um bico apontando para ela, letra a letra no ritmo da fala — e o robô ganha uma **boca de pontos no padrão dos olhos**, que só mexe quando ele responde (com o som, ou com o texto, silenciado). No centro à esquerda, no vazio do palco, o **botão de voz**: um microfone grande e redondo, na mesma transparência, que ligado acende no acento e ganha três **ondas** em volta do ícone crescendo com o som captado — é a única outra peça do palco, e reage ao som, não ao cursor. É o único roxo do palco. Saíram a marca 3D, o campo vivo, os orbes e as estrelas ("quero tudo preto sem a logo N1 e o efeito animado… crie o robô na tela de início") e, no mesmo dia, a saudação, o campo da pergunta e o holofote por cima do palco. **No fim do dia o holofote voltou, ATRÁS do robô** ("a luz deve passar sempre atrás do robô"): uma luz branca e suave que segue o mouse no preto e some atrás do corpo — contorna a silhueta, nunca cobre o robô nem a interface. É a única luz que segue o mouse no app. O resto deste parágrafo é o histórico do palco de 2026-09-17 a 2026-09-22.

**Rolando, o palco sai e o resumo entra (2026-09-24).** A pedido ("nesta tela de início, quando o user rolar para baixo ele deve conseguir fazer o scroll normal e o robô deve ir desaparecendo conforme o scroll, fazendo o efeito reverso de entrada; conforme for rolando, a tela muda e vira uma tela de informações e acesso rápido: minhas tarefas, tasks atuais se tiver, quantas estão em atraso e afins, leads a serem atendidos, se há novas mensagens e um menu de estatística daquele user na semana, mês e afins"), o Início ROLA. O palco fica preso no topo, da altura da tela, e a rolagem toca a entrada do robô ao contrário — os controles somem primeiro, a câmera volta ao rosto pela curva da entrada invertida, o robô esmaece e desfoca (o `revelar` ao contrário) e a luz apaga —, enquanto o **resumo** sobe por cima como uma folha no fundo do sistema (`--page`, sem pontilhado — o preto e os pontos são só do palco; 2026-09-25: "quando o user rolar para baixo, essa segunda visão não deve ter bg de pontilhados, e a cor não deve ser preta: deve voltar a respeitar o sistema e manter a cor de bg que está em outras telas"): o título e a hora de referência, cinco atalhos verticais (o número grande, o que ele conta e uma linha de contexto; o zero recolhido), Suas Tarefas por urgência, Leads a atender, Mensagens novas (destacadas, como o não lido em todo lugar) e as Estatísticas — período em `Segmentos`, quatro métricas em botões e um gráfico em colunas. Tudo peça solta em pilha e grade (§3), sem caixa dentro de caixa, sem lanterna (a luz do cursor é só a do palco, atrás do robô) e sem count-up (é de Painéis). É POSIÇÃO de rolagem, não animação (§5). Com o robô fora da vista, a cena para, a conversa por voz acaba e o robô flutuante aparece no canto — e volta ao palco.

O Início foi refeito em 2026-09-17 como a **apresentação** do produto e **refeito do zero outra vez em 2026-09-21**, quando o usuário mandou recomeçar — "ignorando tudo que foi pedido antes, apenas mantenha a id visual", com "algo em movimento e com efeito do mouse", e sem o Explorar. Horas depois, o palco deixou de ser um card: sem cantos arredondados, sem borda, sem sombra e sem o respiro do corpo, ele toma a tela do Início inteira — o que a casca deixa entre o trilho, o painel e a barra global. Em vez da barra de 44 px, um **palco** que ocupa a altura toda (`.inicio-capa`; sem rolar até 2026-09-24 — desde então ele fica preso no topo e a tela rola até o resumo). O fundo inteiro é o **campo vivo** (`.inicio-tecido` + `design/campo-vivo.tsx`): desde 2026-09-22, **ondas de traços** — um tecido de linhas finas no roxo da marca que ondula inteiro como seda, com trechos de luz correndo por cada linha —, a pedido do usuário ("quero algo animado em movimento no fundo estilo waves de traços"); até então era a grade de pontos do sistema, maior e respirando numa onda diagonal. Só o fundo. Sobre ele, no alto, a **marca em 3D** (`design/marca-3d.tsx`): o monograma do manual como um **objeto flutuante com espessura**, que balança devagar e **vira para o cursor** onde quer que ele esteja na capa, com um brilho correndo pela face e a sombra fugindo no chão — a identidade fica, mas como peça no espaço, não como logo colada por cima. (O primeiro desenho do dia fazia o monograma emergir dos próprios pontos do campo; o usuário pediu outro efeito — "a logo da N1 não deve ser nesse efeito pontilhado, quero outro efeito e que ela se comporte como um 3d flutuante reagente ao mouse" — e o campo perdeu a marca.) O **cursor é um campo de força**: as linhas por perto abrem-se para longe dele e acendem no claro da marca, com inércia, como se o tecido fosse líquido — é o "efeito do mouse" pedido. E é só isso: o disco de luz que acompanhava a mão saiu no fim de 2026-09-22 ("quero o efeito do hover porém sem essa luz roxa no cursor") — quem responde é o tecido, não uma luz por cima dele. É decoração de ponta a ponta (`aria-hidden`, sem foco e sem clique), porque quem fala com o Assistente é o campo de texto. Abaixo da marca, no terço de baixo, só duas peças: a **saudação** em tipo grande (`.inicio-saudacao`, `ed-display`, o primeiro nome no acento) e, logo abaixo, o **campo da pergunta** (`.inicio-campo`) — pílula alta e larga, aro no acento e halo (`--brilho-campo`), envio redondo à direita, e o aro da **lanterna** seguindo o cursor: o efeito-assinatura do sistema na única peça operável da tela. Quem garante o contraste não é um véu por cima do canvas e sim a **zona calma** dentro do próprio campo: o `CampoVivo` recebe a `ref` da saudação e esmaece os traços ali (piso 0,18, queda de 64 px), apagando com força dobrada o que o cursor acrescenta. Medido em 2026-09-22, já sem o halo: 5,4:1 no nome em acento em repouso e 5,3:1 com o cursor parado em cima da saudação. Por trás de tudo, a atmosfera do sistema (três orbes desfocados e seis estrelas, tudo CSS). **O que saiu em 2026-09-21:** no refazer, a esfera de pontos da direita (`design/globo.tsx`, apagado), o anel de varredura, os trilhos de luz e o **Explorar** do rodapé — a tela não tem mais link nenhum, e quem navega usa o menu lateral. Antes dele, no mesmo dia: o HUD do topo e o fio de luz sob ele ("remova isso do topo"); a marca de apresentação do centro (a marca já vive no trilho e no painel); e as quatro **portas** — Caixa de Entrada, Minhas Tarefas, Negócios, Painéis —, porque o menu lateral voltou a listar as telas da pessoa e é por ele que se chega; das quatro contagens, ficam à vista as duas da barra global (o sino e as Tarefas vencidas). Nada de listas NO PALCO: viveram aqui até 2026-09-17, moram nas telas para onde o menu leva — e, desde 2026-09-24, voltam ABAIXO do palco, no resumo, com as mesmas derivações dessas telas. Já foi um laço de vídeo com riscos de neon; saiu porque os riscos chegavam a branco puro e exigiam uma cortina pesada para o texto ler.

O cabeçalho **não tem parágrafo explicativo**: a contagem ("15 contas", "3 de 49 ativas") fica ao lado do título e a tela se explica pelo conteúdo. Prosa que explicava um vazio virou `hint` do `EmptyState`; prosa que explicava uma regra virou `title` do controle ou sumiu.

Telas de registro (Contato, Empresa, Negócio, Membro, Execução) usam o corpo em duas colunas — `grid xl:grid-cols-[minmax(0,1fr)_22rem]` — com painéis de título (`Painel` + `CabecalhoDePainel`) à esquerda e os atributos (`RecordPanel`/`RecordRow`) à direita.

**A Tarefa é a exceção, no molde do ClickUp.** A ficha no centro (`max-w-4xl`): o Tipo em caixa colorida com o identificador, o título grande (`ed-display`) e a descrição — clicar em qualquer um abre o editor —, as propriedades em duas colunas de `LinhaDeProp` (ícone · rótulo · valor; o editor só existe ao clicar na linha), os Campos numa lista da mesma família com a etiqueta *obrigatório*, e abaixo as seções em régua (Checklists, Subtarefas, Dependências, Recorrência, Vínculos, Anexos, Observadores). À direita, numa coluna de 26 rem, a **Atividade**: os Comentários como conversa (balões, fios, compositor preso à base) e o Registro de Atividade recolhido num `details`. Abaixo de `xl` a Atividade empilha embaixo com `--conversa-empilhada-h`. Na Tarefa conversacional (C35) a conversa do Contato entra como terceira região; empilhada (abaixo de `@4xl` do contêiner `ficha`), o fio de Mensagens tem altura definida por `--conversa-empilhada-min` e o Rascunho da IA recolhe a uma linha — só o fio e a ficha rolam.

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

**Posição não é animação (2026-09-24).** A saída do robô do Início pela rolagem escreve a opacidade, o desfoque e a câmera POR POSIÇÃO de rolagem, num quadro de animação por evento de rolagem — nada anima sozinho, e parar no meio é ficar no meio, como a própria rolagem. No topo nada fica inline; o repouso (a lei 3 e o item 5 do CHECKLIST) mede-se no topo, e uma página deixada a meio caminho está numa POSIÇÃO, não em repouso.

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
| Laços infinitos | só no esqueleto (visível < 1 s), no spinner, no carregador de ícones (aro e ciclo), no Início (o robô é uma cena WebGL do Spline com o laço dele; a entrada da câmera é um `requestAnimationFrame` que termina em ~3 s), na atmosfera do Entrar e na marca do Login (flutua e respira). |
| Blur | só em `revelar` e no véu (2 px) — e no robô do Início saindo pela rolagem (`--chegada-desfoque` × a fração rolada: o `revelar` ao contrário, por posição, não animação; some com movimento reduzido). Halo só no fio (`--brilho-fio`). |
| Camadas | sem `will-change` em lugar nenhum; nenhuma camada de composição permanente depois de 1 s. `transition: width/height` só nas folhas de gráfico (poucas e pequenas). |
| Por tela | count-up ≤ 8 nós · lanterna ≤ 12 por grade · esqueleto ≤ 24 linhas com `--i`. |

**Desde 2026-09-23 a peça cara do Início é o robô**: o runtime do Spline e a cena (1,3 MB) descem só nele e só no navegador (`import()` dentro do efeito); o desenho é WebGL — o motor clássico, fixo, também onde há WebGPU. Se ele pesar, os cortes são: parar a cena fora da vista (`app.stop()` quando a aba some ou a pessoa sai — e, desde 2026-09-24, quando o resumo cobre o palco: `ControleDaCena.pausar()`, com `retomar()` ao rolar de volta), depois `renderMode` (já é `"auto"`: só desenha quando algo muda), depois trocar por uma imagem parada abaixo de um orçamento de hardware. O parágrafo seguinte é o do palco anterior. Se o Início — a tela mais cara: orbes com blur, o **campo vivo** em canvas, que cobre a capa inteira e desenha ~45 linhas de ~200 pontos por quadro, e a **marca 3D**, um segundo laço de `requestAnimationFrame` que só escreve nas folhas — o `transform` da peça, o da sombra e as duas coordenadas do ponto de luz no brilho; nada no palco, cujas `--incl-*`/`--sombra-d*` são só o repouso do CSS, e a flutuação é um `@keyframes` sem JS — cair abaixo de 50 fps com CPU 4×, os cortes são, nesta ordem: **primeiro os orbes** — medido em 2026-09-22 num Chrome sem GPU, são eles que seguram o Início em ~30 quadros por segundo a 1440×900 (escondendo os três, 60; escondendo o campo E a marca, os 30 continuam), porque o `blur` pesado cai todo no raster por software; numa máquina com GPU o desfoque é composto e sai barato, mas é por eles que se começa. Depois: afastar as linhas (subir `ESPACO` em `campo-vivo.tsx`) ou os pontos delas (`PASSO_X` — o desenho do tecido custa 0,55 ms de script por quadro, medido); depois encolher o campo de força (`ALCANCE`); depois a marca: menos camadas (`CAMADAS` 9 em `marca-3d.tsx`) e o `blur(6px)` da sombra; o campo já só liga depois da capa, e em movimento reduzido desenha um quadro só. Medido a 1920×1080 em 2026-09-21: 57 fps com o campo e a marca reagindo ao cursor. Remedido em 2026-09-22, já com as ondas: 60 fps de tela em repouso e com o cursor varrendo, e o bitmap do canvas tem **orçamento de pixels** (`ORCAMENTO_PX`, ~2,8 MP) — numa tela dpr 2 o raster custava mais que o desenho inteiro. Nunca subir. A coreografia é curta desde 2026-09-21 e ficou mais curta ainda no refazer do mesmo dia: a capa faz `revelar` e, dentro dela, a cascata é **capa → saudação → marca 3D e campo da pergunta** — a saudação parte no mesmo quadro da capa; a marca (`.inicio-marca-area`, só `aparecer`) e o campo, um passo depois; tudo assentado em 600 ms. O campo vivo **só esmaece** (`aparecer`, sem deslocamento): o canvas mede o próprio retângulo e um `translate` o faria medir errado.

### Movimento reduzido: o que desliga e o que fica

`prefers-reduced-motion: reduce` e o freio da pessoa (abaixo) zeram, com `!important`, a duração, o delay e a iteração de toda animação e transição (`tokens.css`, bloco "Movimento reduzido"). Em JS, `reduzido()` é verdadeiro e `lerDuracao` devolve 0.

No Início rolando (2026-09-24), o movimento reduzido tira a câmera e o desfoque da saída do robô — só a opacidade acompanha a rolagem —, e as rolagens programáticas (o atalho "Seu resumo", a volta pelo robô flutuante, o atalho dos Leads) são instantâneas (`behavior: "auto"`).

- **Desliga:** cascata e chegada (tudo no primeiro quadro), `surgir`/`revelar`/`aparecer`/`sumir` (o popup desmonta na hora), a régua do Toast, pulso e giro (uma iteração → parados), a luz do trilho (salta), orbes e estrelas, a lanterna (não registra o listener), o robô do Início (sem a entrada da câmera; a cena monta e para — `app.stop()` passados `--dur-cena-assenta` de quadros desenhados), o count-up (valor final no primeiro quadro), o realce, as transições de gráfico.
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
- **`prefers-reduced-motion`** desliga tudo sem perder nenhum estado — cascata, popups, régua do Toast, laços, lanterna, o robô do Início, count-up (§5). O que informa fica: a barra de rota salta, o esqueleto para legível, `role=status`, `aria-busy` e o foco de volta ao abridor. `<html data-movimento="minimo">` é o mesmo freio nas mãos da pessoa.
- **Alvo de toque**: 32/36 px no desktop; abaixo de 768 px todo controle com `.alvo-toque` cresce para 44 px.
