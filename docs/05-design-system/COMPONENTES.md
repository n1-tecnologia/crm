# Componentes base

**Vigente desde 2026-09-14**, com o sistema do CRM-COMPLETO (ver `DIRECAO-VISUAL.md`). As primitivas moram em `app/src/design/` e as telas importam **só** de `@/features/shell/ui` — se uma tela precisa alcançar `design/` direto, ou o barril está incompleto ou a tela está errada.

**A regra que vale para todos:** nenhum componente escreve cor, tamanho de fonte, raio ou sombra. Tudo é token ou classe do sistema. A sentinela (`npm run verificar:tokens`) e `tokens.test.ts` reprovam o que escapar.

---

## Como os tokens se organizam

`app/src/estilos/tokens.css` é o arquivo canônico, na estrutura do CRM com os valores da N1. Tema único escuro.

```css
--page: var(--cinza-900);                 /* #0f0f10 — a página          */
--superficie-1: rgb(255 255 255 / 0.03);  /* a lavagem de uma peça       */
--linha: rgb(255 255 255 / 0.08);         /* o hairline                  */
--acento: var(--roxo-300);                /* #c084fc                     */
--degrade-acento: linear-gradient(135deg, #7a00a3, #9601c5);
```

Blocos, na ordem do arquivo: base neutra → superfícies em alfa → hairlines → rampa roxa → acento e degradê → rampa de texto → semânticas com `-lavado` → vocabulário do N1 (`--cor-cat-*`, `--cor-neg-*`, `--cor-cxe-*`, `--cor-exe-*`, `--cor-selo-*`, `--cor-dom-*`, `--cor-ator-*`) → ilha do Construtor de Agentes (`--ab-*`) → escalas tipográficas → **métrica** (alturas, gaps, raios, ícones, avatares, modal, lift) → sombras → duração e easing → z-index → fontes → **COMPAT** → três `@media` de degrau → base global.

**COMPAT** é o bloco que faz os nomes antigos (`--cor-tinta`, `--cor-superficie-2`, `--raio-controle`, `--altura-controle`, `--texto-base`…) apontarem para os novos. Existe para o TSX ainda não migrado continuar resolvendo; numa linha reescrita, usa-se o nome novo. Não acrescente nada nele.

Dentro dos `@media` de degrau (1440 / 1760 / 2200 px) só entram **medidas** — `tokens.test.ts` varre o arquivo sem noção de bloco e a última ocorrência de um token ganha.

---

## As classes do sistema

Vivem em `app/src/estilos/` e valem em todo lugar; a classe é o escopo.

| Família | Classes | Onde |
| --- | --- | --- |
| Tipografia | `.ed-display .ed-titulo .ed-subtitulo .ed-secao .ed-eyebrow .ed-corpo` · `.app-xs .app-sm .app-base .app-md .app-coluna .app-meta .app-numero` · `.identificador` · `.rico` | `tipografia.css` |
| Superfície | `.painel` `.painel-solido` `.trilho` `.casca-destaque` `.barra-vidro` | `componentes.css` |
| Peça | `.pilha-solta` `.grade-solta` `.item-solto[data-destacado\|bloco\|alinhamento\|estatico\|atenuado]` `.flutua` `.lanterna` `.grade-pontos` | `componentes.css` |
| Controle | `.btn .btn-sm .btn-contorno .btn-solido .btn-fantasma .btn-sutil .btn-perigo .btn-icone .btn-icone-nu .btn-magnetico` · `.campo` `.rotulo` `.ajuda` · `.caixa` `.radio` `.chave` · `.pilula` `.pilula-ponto` `.selo` | `controles.css` |
| Flutuante | `.veu` `.flutuante` `.surgir` `.surgir-rapido` `.item-menu` · `.aviso` `.regua-tempo` | `controles.css` |
| Movimento | `.chegada[data-entrando]` · `.cascata[data-chegada="foco"]` · `.aparecer` `.surgir` `.surgir-rapido` `.revelar` `sumir` · `[data-recente]` · `.girando` `.pulso` `.rotacao` `.digitando` · `.esqueleto[data-redondo]` `.atmosfera` · `.preenchimento` `.barra-h` `.barra-v` `.rosca-fatia` · `.barra-progresso[data-estado]` `.trilho-luz` | `componentes.css` · `controles.css` — ver **Movimento** |
| Tabela | `.tabela` `tr[data-faixa]` `tr[data-selecionada]` `th[data-ordenavel]` `[data-densidade="compacta"]` | `controles.css` |
| Tela | `.corpo-de-tela` `.sem-respiro` | `controles.css` |
| Quadro | `.card-negocio` (peça arrastável: sem lift, porque arraste e `translateY` brigam) `.palco-quadro` | `globals.css` |

---

## As primitivas de tela (`design/tela.tsx`, `design/basicos.tsx`)

- **`CabecalhoDeTela`** — a barra de 44 px: `antes` (ícone, trilha curta), `titulo`, `contagem`, `selo`, `abas`, `acoes`. Em `ui.tsx`, **`PageHeader`** embrulha isto em `sticky top-0` com o fundo da página e aceita `path`, `meta` (string vira contagem; ReactNode vira faixa abaixo) e `details`.
- **`BarraDeFiltros`** — 40 px, `flex-wrap`, hairline sutil: busca, chips, seletores, abas de recorte.
- **`CorpoDeTela`** — `flex-1 min-h-0 overflow:auto` com respiro; `semRespiro` quando o corpo é só uma `.tabela` ou uma pilha.
- **`Painel`** (`solido`) e **`CabecalhoDePainel`** (`titulo`, `contagem`, `acao`).
- **`ReguaDeSecao`** (`rotulo`, `contagem`, `cor`, `acao`) — seção é régua, não caixa. `Section` em `ui.tsx` é isto mais os filhos.
- **`Pilula`** (`tom` neutro/acento/sucesso/info/aviso/erro · `cor` de dado · `contorno` · `comPonto` só para um indicador vivo). É uma **caixa colorida** (raio `--r-pilula`, 6 px), não um ponto: a cor de dado vira fundo por `color-mix` a 14 % e o texto fica na cor. Tag, Status, `CategoryDot` e `ConditionMarker` (Vencida/Bloqueada) são todos esta caixa.
- **`RolagemNoTopo`** (`design/tela.tsx`) — um bloco que rola de lado com a barra visível **acima** do conteúdo (uma faixa sincronizada nos dois sentidos; o corpo rola sem barra própria). É o que o Quadro usa: a barra nativa no pé de colunas altas ficava abaixo da dobra.
- **`LinhaDeProp`** (`features/estrutura/linha-de-propriedade.tsx`) — a linha de propriedade da ficha no molde do ClickUp: `icone` · `rotulo` · `valor` numa linha de 36 px, sem cartão nem caixa de edição à vista. O `editor` só aparece ao clicar (`editavel`), e fecha com ✓ Pronto, Esc ou clique fora; `motivo` vira `title` quando não edita; `obrigatorio` põe a etiqueta. Os editores da Tarefa (`TaskAttributeEditors apenas=…`, `TaskFieldValueEditor soControle`) entregam só o controle para caber nela.
- **`StatusPicker`** é um MENU: a caixa colorida do Status atual + chevron; o menu lista as opções na ordem do Conjunto com a categoria, e as bloqueadas ficam na lista dizendo por quê. `LinhaDeProp controle=` hospeda um controle assim no lugar do valor, sem o passo de abrir a linha.
- **`BotaoDeMais` / `CompositorNoGrupo`** (`features/estrutura/novo-no-grupo.tsx`) — o "+" na régua de um grupo (Status, coluna do Quadro, grupo do Financeiro) abre uma linha de composição no próprio grupo; a Tarefa nasce ali. Quando não pode criar, o "+" fica visível e explica no `title`.
- **`TarefaCompleta`** (`features/estrutura/tarefa-completa.tsx`) — a Tarefa inteira; `modo="pagina"` (barra de 44px) ou `"popup"` (dentro de um `SidePanel semRespiro`, com o selo e o menu no alto da ficha). `TaskPanel` e `ContaDrawer` são cascas dela: não existe "modo leitura".
- **`Selo` / `SeloDaTarefa`** (`features/estrutura/icone-de-tipo.tsx`) — o ícone num ladrilho lavado à esquerda de uma linha de lista mista. `iconeDeTipo` traduz o nome de ícone do Tipo de Tarefa (`receipt`, `users`, `flag`, `triangle-alert`, `circle-check`) para o Lucide, `corDeTipo`/`corLavadaDeTipo` dão a cor, e `ICONE_DE_OBJETO` cobre Aprovação, Conversa, Negócio, Menção e Execução. Notificações e Início usam o mesmo desenho para a mesma coisa.
- **`Abas`** (`abas: {chave, rotulo, icone?, contador?}`, `ativa`, `aoTrocar`, `acao`) — sublinhado de 1 px que cresce da esquerda; o estado mora em quem chama.
- **`ficha.tsx`** (`features/shell/ficha.tsx`) — as peças da ficha no formato da Tarefa que Empresa, Grupo, Comunidade e Flow compartilham: `EditorDeTexto` (grava ao sair), `EditorDeNumero`, `EditorDeIdentificador` (Enter acrescenta), `NotasDoRegistro` (as notas como conversa + compositor preso à base), `RegistroRecolhido` (o `<details>` do Registro de Atividade), `AsideDeAtividade` (o aside inteiro à direita, `@4xl:w-[26rem]`), `useAvisos()` (os dois `Toast` + `report`) e `useNomeDoAtor()`.
- **`CaixaDeConfiguracoes`** (`features/ferramentas/caixa-de-configuracoes.tsx`) — o painel de linhas Selo · título · dica · `Toggle` do diálogo de criação de contêiner, generalizado: uma linha desligada diz o motivo no lugar da dica.
- **`ConversaDoGrupo`** (`features/ferramentas/conversa-do-grupo.tsx`) — os balões da Caixa de Entrada sem Contato (quem fala é o Canal ou um participante) e o compositor que cria a Conversa de grupo na primeira Mensagem (RN-GRP-13); desligado com a frase de `recusaDeEnvioAoGrupo`.
- **`FormularioDeComponente`** (`features/ferramentas/flow-componente-form.tsx`) — UM formulário montado da spec do Tipo (`flow-spec.ts`: chave, rótulo, controle, limite); contadores "37 / 80" em `--erro` quando estouram. É o único lugar da tela que conhece o catálogo por dentro; os limites vêm de `CATALOGO_DE_COMPONENTES`.
- **`PreviaDoFlow`** (`features/ferramentas/flow-previa.tsx`) — a Tela numa moldura de telefone só com texto e tokens; entradas desligadas, Rodapé que navega na prévia, Componente com problema em contorno `--erro`.
- **`TelaDeFerramentas`** (`features/ferramentas/tela-de-ferramentas.tsx`) — a casca única das três telas do assunto Ferramentas (`aba` = grupos | comunidades | flows): cabeçalho, ações e avisos mudam com a tela; o corpo é a aba. As rotas `/ferramentas/<aba>/page.tsx` só a instanciam.
- Estados de Versão de Flow (`rascunho` / `publicada` / `obsoleta`) são `Pilula` (aviso / sucesso / neutro), não `StateSeal`: o selo é do registro; a Versão é entidade interna.
- **`Icone`** (`de`, `tamanho` xs/sm/md/lg) — Lucide com traço 1.5 e medida por token, para crescer nos degraus.
- **`Esqueleto`** (`largura`, `altura`, `redondo`, `indice` ≤ 24) e **`EsqueletoDeLinhas`** (`quantidade`, `altura`) vestem a `.esqueleto` do sistema — ver **Movimento**. **`Trilha`**, **`Divisor`**, **`RotuloDeSecao`**, **`CampoDeLanterna`**, `cn`.

---

## Os componentes de sempre (`design/components.tsx`)

Mesmas APIs de antes, reescritos por dentro sobre as classes do sistema.

**`Button`** — `primary` (`.btn-solido`, o gradiente da marca, texto `--sobre-degrade`), `secondary` (`.btn-fantasma`), `ghost` (`.btn-sutil`), `danger` (`.btn-perigo`); `size` `sm`/`md`; `icon`; `full`. Caixa-alta com tracking, como no CRM. **Contrato mantido:** `disabled` sempre com `disabledReason`, e o motivo chega a quem não usa mouse (`aria-disabled` + `aria-describedby`; o clique é engolido, inclusive em `type="submit"`). **`carregando`** é a pendência real (uma navegação a caminho, uma publicação): o ícone vira o `Loader2` em `.girando`, `aria-busy="true"`, o clique é engolido e o rótulo fica — a largura não muda; exige `disabledReason` ("Enviando…", "Abrindo…"). Só com o `pendente` de `useNavegar` ou uma pendência de verdade, nunca por `setTimeout`.

**`Field`**, **`TextInput`**, **`TextArea`** — `.rotulo`/`.ajuda`/`.campo`. Rótulo sempre visível; erro substitui a dica com `role="alert"`.

**`Select`**, **`MultiSelect`** — gatilho `.campo`, lista `.flutuante .surgir`, opções `.item-menu`; busca opcional; opção indisponível fica na lista **com o motivo**. Teclado como caixa de combinação.

**`Chip`**, **`StateSeal`** (`.selo`), **`ConditionMarker`** — três coisas diferentes: o que o usuário escolheu e remove; o que o registro **é**; o que o registro **está** agora. Formas distintas de propósito.

**`SidePanel`** (`.veu` + `aside` em `--card`), **`ConfirmDialog`** (`.flutuante .surgir`, `--modal-sm/lg`), **`ActionMenu`** (`.btn-icone .btn-icone-nu` + `.item-menu`, `data-destrutivo`), **`Toast`** (`.flutuante` com ícone por tom). São `fixed` **sem portal** — por isso `transform` só existe em `:hover`/`:active` no sistema inteiro. `ConfirmDialog` continua o único mecanismo de confirmação. `SidePanel` e `ConfirmDialog` têm presença (`usePresenca`): entram em 300 ms e saem em 150 ms, só opacidade; `ActionMenu` e os seletores entram em `surgir-rapido` (150 ms) e fecham no quadro da escolha; `Toast` tem régua de tempo e expira — os três estão descritos em **Movimento**.

**`EmptyState`** (`title`, `hint`, `action`, `icon`, `compact`) e **`NoAccessState`** — distintos e com aparência distinta: vazio é centro; sem acesso é painel com cadeado.

**`ActorAvatar`** (tamanho por `--avatar-sm/md`; Membro é círculo, não humanos são quadrado arredondado), **`RichText`**, **`ActivityTimeline`** (pilha de `item-solto` estáticos), **`StatusPicker`** (`.btn .btn-sm`, agrupado por categoria), **`Toggle`** (`.chave`), **`SettingRow`** (`.painel`), **`RecordPanel`**/**`RecordRow`**.

**Removidos por falta de uso:** `DataTable`, `Column`, `Board`, `BoardColumn`. A tabela do sistema é `.tabela` — genérica em `features/shell/record-list.tsx` (`RecordList`, 10 telas-índice) e à mão nas telas que agrupam ou editam em linha (financeiro, Membros, Auditoria, Campos…). O quadro é `.trilho` por coluna com `.card-negocio` por cartão.

---

## Movimento

As quatro leis, o orçamento por tela e o que o movimento reduzido desliga estão na `DIRECAO-VISUAL.md` §5; o checklist de verificação em `CHECKLIST-MOVIMENTO.md`. Aqui está o que cada classe e cada módulo faz **de fato**, lido do código. Tudo lê o bloco Movimento de `tokens.css` (`--dur-1` 150 ms · `--dur-2` 300 · `--dur-3` 500 · `--dur-4` 700 · `--dur-passo` 30 · `--dur-cascata` 1000 · `--easing`); nenhum `ms` vive fora dele. Nomes em pt-BR sem acento, porque o Tailwind v4 colide com `transform`, `filter`, `blur`, `animate` e `container`.

### A chegada de tela (`componentes.css`, "Chegada de tela")

- **`.chegada` / `[data-entrando]`** — o invólucro por rota, que o `AppShell` remonta com `key={chaveDeChegada(pathname)}`. `height: 100%` (mantém o `h-full` das raízes de página) e `aparecer` de 150 ms. `data-entrando="true"` fica no nó durante a **janela** (`--dur-cascata`, 1 s a partir da montagem) e é a condição de tudo abaixo: fora dela nada anima — filtro, aba, "Mostrar mais", tecla, mudança só de `?search` (que não remonta o invólucro). O invólucro só esmaece: é ancestral de todo `SidePanel`/`ConfirmDialog`.
- **Os marcos que os primitivos carregam** — dentro da janela, na ordem de leitura: `.cabecalho-de-tela` (`CabecalhoDeTela`, `tela.tsx`) sobe em `surgir` a 0 ms; `.barra-de-filtros` (`BarraDeFiltros`) em `surgir` a 1 passo; `.painel` (`Painel`) e `.regua-de-secao` (`ReguaDeSecao`) em `aparecer` a 1 passo; `.estado-vazio` (`EmptyState`) em `revelar` a 2 passos. Nenhuma página escreve isso: a classe vai no primitivo (`PageHeader` embrulha o `CabecalhoDeTela` num `div.sticky`; a classe fica no `header` interno).
- **`.cascata`** — no CONTÊINER, nunca "por construção". Dentro da janela, cada filho direto faz `surgir` (300 ms, `backwards`) com `animation-delay: calc(var(--cascata-inicio) + var(--i, 0) * var(--dur-passo))`; `--i` vem de `:nth-child(2..10)` (1…9) e da 11ª peça em diante é `9` com `animation-name: aparecer` — teto de 10 degraus (0…270 ms; a última assenta em 570 ms). Tudo em `:where()` (especificidade zero): um `--i` inline no filho, um `[data-recente]` ou um `.surgir` direto vencem sem guerra. `--cascata-inicio` (0 ms no `:root`) é o único ajuste por contêiner, inline — `style={{ "--cascata-inicio": "var(--dur-2)" }}` na grade do Início, que espera a capa. **Contrato:** `.surgir` DIRETO na peça = anima sempre que é inserida; `.cascata` no contêiner = as peças animam só na chegada. Onde está: as seis `ul.pilha-solta` do Início, o `tbody` de `RecordList`, `TabelaDeTarefas` e `Tabela` (nunca num wrapper da `.tabela`), a coluna de conversas, cada coluna de quadro, as seções de Notificações, as grades de Painéis, os grupos do Buscar, os membros do Entrar e o `<nav>` do painel. Nunca em contêiner com `overflow: hidden` (corta sombra e lift), em lista dentro de popup, no fio de mensagens do Chat, no calendário, na linha do tempo.
- **`data-chegada="foco"`** — no mesmo contêiner: os 10 primeiros filhos trocam `surgir` por `revelar` (500 ms, 12 px + blur). Só onde a pessoa pausa: Notificações, grades de Painéis, membros do Entrar. Nunca em `tr`, conversa, mensagem, cartão de quadro, Buscar, nem dentro da capa (já desfocada pelo `revelar`).
- **`.rolagem-no-topo-corpo .cascata > *`** — o Quadro: só `aparecer`. O corpo tem `overflow-y: hidden` (cortaria o deslocamento) e o cartão é arrastável (sem transform residual).
- **`CascataDeNavegacao`** — um `.cascata` FORA do invólucro de rota (o painel do assunto) traz a própria janela: `nav.cascata.aparecer[data-entrando]`, remontado por `key={assunto.chave}` — a troca de assunto coincide com a chegada da tela.

### O vocabulário (`componentes.css`, "Animações")

- **`.aparecer`** — só opacidade, 150 ms. O contêiner: invólucro de rota, corpo de aba (`key={aba}`), painel de navegação, o painel direito da Caixa de Entrada (`key={conversationId}`).
- **`.surgir`** — opacidade + `translateY(var(--surgir-y))` (4 px), 300 ms: peça, cabeçalho, popup; a mensagem, o comentário ou a conta que acabou de nascer depois da janela (na peça do `useRecente`, nunca em todas). **`.surgir-rapido`** — o mesmo em 150 ms: `Select`, `MultiSelect`, `ActionMenu`, `StatusPicker`, Ordenar, sugestões de @, a subárvore que monta.
- **`.revelar`** — opacidade + `translateY(var(--chegada-y))` (12 px) + `blur(var(--chegada-desfoque))` (6 px), 500 ms, terminando em `filter: none`. A única `filter` de tela: capa do Início, cartão do Entrar, `foco`, estado vazio.
- **`sumir`** — keyframe sem classe: opacidade → 0, `forwards` (permitido porque o nó desmonta em seguida). Quem o dispara: `[data-estado="saindo"] > :is(.veu, .flutuante)` e `.aviso[data-estado="saindo"]`, os dois em 150 ms com `pointer-events: none`.
- **`destacar` / `[data-recente="true"]`** — `background-color` de `--acento-lavado` até o próprio fundo em `--dur-realce` (1,5 s). Contrato em `.item-solto`, `.tabela tbody tr` e `.card-negocio` (`DealCard`/`TaskOnlyCard` recebem `recente`): a tela passa `data-recente={item.id === recente || undefined}` com `useRecente()`. Uma peça que já vive em `--acento-lavado` (`[data-destacado="true"]`, `[data-selecionada="true"]`) parte de `--acento-lavado-forte` (`destacar-forte`), senão o realce seria invisível. A regra vem DEPOIS das de cascata: a peça criada durante a janela não "chega", já está — acesa. Ação em massa acende no máximo 10.
- **`.girando`** — `rotate(360deg)` em `--dur-giro` (1 s), `linear`, infinito: o `Loader2`. **`.pulso`** — opacidade 0,4 ↔ 0,75 em `--dur-pulso` (1,5 s), `ease-in-out`, infinito: esqueleto e o ícone pendente do trilho (com `animationDelay: var(--dur-1)`, invisível se a navegação acabar antes). **`.rotacao`** — `transition: transform var(--dur-2) var(--easing)` para uma folha que gira por estado (o "+" que vira "×"); `.seta-recolhe[data-aberto="true"]` é o chevron pronto (90°). Laços e medidores são a exceção nomeada de curva.
- **`.digitando`** — três pontos filhos em `pulso` escalonado (0, 4 e 8 passos): o "digitando" da prévia do agente.
- **`.esqueleto` / `[data-redondo]`** — fundo `--esqueleto` (7 %: a 5 %, o pulso a 0,4 sumiria sobre o preto), raio `--r-controle` (pílula com `data-redondo`), `pulso` com delay NEGATIVO `calc(var(--i, 0) * -2 * var(--dur-passo))` — cada linha nasce noutro ponto do laço, sem o salto 1 → 0,4 que um delay positivo daria. `--i` inline até 24. Em movimento reduzido para nos 7 %, legível como forma.
- **`.atmosfera`** — `absolute inset-0`, `overflow: hidden`, `isolation: isolate`, `--z-fundo`, `pointer-events: none`; hospeda as mesmas `.capa-orbe` (deriva em `--dur-deriva-1/2/3`, defasagens `--deriva-defasagem-2/3`) e `.capa-estrela` (`--dur-cintila-1/2`) da capa do Início.
- **Gráficos** — `.preenchimento` é a FOLHA (sem texto dentro; rótulo e valor ficam fora) com `transition: width/height` em `--dur-2` para o valor mudar. Na chegada, `.barra-h > .preenchimento` faz `crescer-x` (de `scaleX(0)`, `transform-origin: left`) e `.barra-v > .preenchimento` faz `crescer-y` (`origin: bottom`) e `.barra-c > .preenchimento` (a barra centrada do Funil) cresce do meio (`origin: center`), 500 ms, delay `--i` × passo; `.rosca-fatia` faz `desenhar` (`stroke-dasharray` de `0 100`) — exige `pathLength="100"` no `<circle>` e `--i` inline por fatia.

### Espera, presença e aviso (`controles.css`)

- **`.barra-progresso[data-estado]`** — o fio de `--fio` (2 px) absoluto no topo da coluna da tela, em `--acento` com `--brilho-fio`, `z-index: var(--z-progresso)` (35: acima do cabeçalho sticky, abaixo da gaveta). `ocioso`: `scaleX(0)`, opacidade 0. `pendente`: vai a `scaleX(0.8)` em `--dur-progresso` (1,8 s, `--easing-saida` — mede rede, não interface) com **carência** de `--dur-1` no `transition-delay`: navegação que termina antes nunca a mostra; e como o delay não é zerado em movimento reduzido, ali a barra salta a 80 %. `concluindo`: `scaleX(1)` em 150 ms e opacidade 0 em 300 ms. Folha sem descendentes: transform em repouso permitido.
- **`.trilho-luz`** — uma folha de 2 px × `--trilho-luz-h` na borda esquerda do trilho, que anima `top` (não transform) em `--dur-2`. O `AppShell` mede o `offsetTop` do assunto ativo — ou do alvo pendente, otimista, desde o clique — num `useLayoutEffect` e escreve em `style.top`; se a navegação não chegar, o `limpar()` de segurança a devolve ao assunto real.
- **`.veu`** — `fixed inset-0`, `--veu-cor`, `backdrop-filter: blur(2px)` (não animado), `aparecer` de 300 ms. **`[data-estado="saindo"] > :is(.veu, .flutuante)`** — véu e superfície somem juntos em `sumir`, 150 ms.
- **`.aviso` / `.regua-tempo`** — a régua é uma folha real (precisa de `animationend`), `--fio` de altura, `--linha-acento`, `scaleX(1 → 0)` em `var(--duracao-aviso)` (`--dur-aviso` no `:root`; o Toast a sobrescreve inline), `linear` (medidor) e `forwards`. `.aviso:is(:hover, :focus-within) > .regua-tempo` pausa. `.aviso[data-estado="saindo"]` → `sumir`.
- **`.btn[aria-busy="true"]`** — `cursor: progress`. É o que `Button carregando` veste (ver `Button`).
- **`.carregador` / `CarregadorDeIcones`** (`design/carregador.tsx`, CSS em `componentes.css` "Carregador de ícones") — a espera no centro da tela: `absolute inset-0`, `pointer-events: none`, sem escurecer o que está por baixo. Um aro (`.carregador-aro`, `--carregador-tam` 5 rem, `--brilho-fio`) cujo `::before` é um arco cônico no acento girando em `2 × --dur-giro` (o mesmo estêncil da lanterna); dentro, oito ícones dos objetos do produto empilhados (`.carregador-icone`, `--i` inline), cada um vivendo 1/8 do ciclo `--carregador-n × --dur-icone` (600 ms): entra por baixo, para, sai por cima (`ciclo-icone`). O rótulo (`role="status"`) diz "Carregando…". Onde: dentro de `EsqueletoDaCasca` e `EsqueletoDeTela` (carregamento duro e hidratação) e, com `tardio`, irmão de `<main>` no `AppShell` enquanto `useNavegando()` — `aparecer` com delay de `--dur-1`: a navegação mais curta que a carência nunca o mostra. Em movimento reduzido o aro para e o primeiro ícone fica (`opacity: 1; animation: none`), porque o laço zerado terminaria em opacidade 0. É módulo de cliente só porque passa componentes de ícone (funções) ao `Icone`.
- **`.login-marca-dagua` / `.login-marca`** (`app/login`) — a metade da marca: o monograma em `currentColor` (acento) a 6 %, 130 % do painel, recortado pelo `overflow` da seção; a logo completa flutua em `marca-flutua` (`--dur-respira`, ease-in-out, alternado, `translateY` de 2 × `--surgir-y`) sobre um halo (`::before`, `--aura-capa`) que respira em `marca-respira`. Laços em folhas sem descendente `fixed`; param em movimento reduzido.
- **`Toast`** (`tone`, `children`, `onDismiss?`, `acao?`) — `div.aviso.flutuante.surgir` sticky, `role="alert"` (erro) ou `"status"`. Quando `onDismiss` existe e `tone !== "error"`, renderiza `<span class="regua-tempo" aria-hidden>` com `--duracao-aviso` = `--dur-aviso-longo` (8 s) se há `acao`, senão `--dur-aviso` (6 s). O `animationend` da régua (só `animationName === "regua-tempo"`) e o X seguem o mesmo caminho: `data-estado="saindo"` → `sumir` 150 ms → `onDismiss()`. Erro não expira (WCAG 2.2.1). Em movimento reduzido o `animationend` é ignorado e o prazo corre por `setTimeout(lerDuracao(token, { medidor: true }))`; fechar desmonta na hora. `useAvisos` (`ficha.tsx`) passa `key={serie}` para a mesma mensagem repetida entrar de novo.
- **`SidePanel` / `ConfirmDialog`** — `const { montado, estado } = usePresenca(open); if (!montado) return null;`. Entrada: `flutuante surgir` (300 ms) + `veu aparecer`. Saída: a raiz `fixed inset-0` recebe `data-estado="saindo"`, `inert` e `aria-hidden`, e perde o `aria-modal` (o moribundo não conta como diálogo do topo para `useModal`); véu e superfície `sumir` em 150 ms, juntos; então desmonta. `useModal(open, …)` continua recebendo `open`, não `montado`: o foco volta ao abridor no instante do fechar. Sem escala, sem altura animada. Um chamador que faz `{x ? <SidePanel open /> : null}` perde a saída (degrada em silêncio): renderize sempre e controle por `open`.

### Os módulos

- **`design/movimento.ts`** — a ponte para o pouco que roda em JS; nenhuma duração vive aqui. `reduzido(): boolean` — `prefers-reduced-motion: reduce` OU `<html data-movimento="minimo">`; `false` no servidor. `parseDuracao("1.5s") → 1500`. `lerDuracao(token, { medidor? }): number` — lê o token de `getComputedStyle(document.documentElement)`, aceita `ms` e `s`, cache por token; **0** no servidor e em movimento reduzido, salvo `medidor: true` (prazo de leitura não é movimento). `parseBezier`, `cubicBezier(x1, y1, x2, y2)` e `bezierDe(token = "--easing"): (t) => y` — a curva do token como função (Newton com bissecção de segurança), cache; a mesma curva no canvas e no count-up. `usePresenca(open): { montado, estado: "aberto" | "saindo" }` — `open` monta na hora; `open` falso deixa o nó `saindo` por `--dur-1` e desmonta; reabrir durante a saída cancela o timer sem reanimar. `useContagem(valor, { ativo = true }): number` — rAF de 0 ao valor em `--dur-4` pela curva; reage à MUDANÇA do valor (não a re-render) e conta a partir do que está na tela; valor final no primeiro quadro em movimento reduzido, aba escondida ou `ativo: false`; cancela no unmount. ≤ 8 por tela, só em Painéis; o valor final vai num `sr-only` desde o primeiro quadro. Testes em `movimento.test.ts`.
- **`design/esqueletos.tsx`** — `type Forma = "inicio" | "caixa" | "lista" | "quadro" | "painel" | "registro" | "formulario" | "tabela"`. `EsqueletoDeTela({ forma = "tabela" })` — a forma exata de uma família de rota, alturas pelos mesmos tokens do conteúdo real (`--cabecalho-tela-h`, `--barra-filtros-h`, `--linha-altura`…), cada peça com `--i` até 24; fica no lugar do miolo até o armazém hidratar, FORA do `.chegada` (desmonta seco; a cascata é a transição, sem crossfade). `EsqueletoDaCasca()` — a casca inteira em silhueta (trilho, painel com 8 linhas, miolo `tabela`), fallback da `<Suspense>` do `(shell)/layout.tsx`; server component, sem hooks, sem store, sem URL. A silhueta é `aria-hidden`; quem diz "está carregando" é o `CarregadorDeIcones` no centro, sobre ela (`role="status"`, "Carregando a tela…").
- **`design/atmosfera.tsx`** — `<Atmosfera />`: `div.atmosfera.grade-pontos[aria-hidden]` com três `.capa-orbe` e seis `.capa-estrela`. Irmã do cartão, nunca wrapper, nunca atrás de lista. Só no Entrar e no Login (a capa do Início tem a sua).
- **`design/carregador.tsx`** — `<CarregadorDeIcones rotulo? tardio? className? />` (ver "Espera, presença e aviso"). Sem hooks, sem store: tudo CSS.
- **`features/shell/rotas.ts`** — duas leituras puras do pathname (rodam no servidor e no teste `rotas.test.ts`). `formaDe(pathname): Forma` por prefixo: `/` inicio · `/crm/caixa-de-entrada` sem `/configuracoes` caixa · `/estrutura/listas/` lista · `/crm/negocios` quadro · `/paineis/[id]` painel · `/crm/(contatos|empresas|negocios)/[id]`, `/estrutura/tarefas/[id]` e `/minha-conta` registro · `/f/`, `/p/` formulario · o resto tabela. `chaveDeChegada(pathname): string` — o pathname, salvo `/crm/caixa-de-entrada/[conversa]`, colapsado no prefixo (a coluna de conversas não refaz a onda a cada clique; `/configuracoes/*` não colapsa).
- **`features/shell/chegada.tsx`** — `useEntrando(): boolean` (verdadeiro por `lerDuracao("--dur-cascata")` a partir da montagem; em movimento reduzido fecha no tique seguinte); `Chegada({ children })` → `div.chegada[data-entrando]` e chama `limpar()` ao montar (a tela montou = a navegação chegou; fora da casca — login, Entrar — é quem encerra a pendência); `CascataDeNavegacao(props de <nav>)` → `nav.cascata.aparecer[data-entrando]` com janela própria (quem chama põe `key`).
- **`features/shell/navegacao.ts`** — store de módulo (`useSyncExternalStore`) do "está navegando". `marcar(href)` — uma navegação começou (liga a barra, o `aria-busy` do `<main>` e o ícone pendente); `marcarSeMuda(href)` — para o `onNavigate` de um `<Link>`: não marca se o link aponta para onde já se está (a barra ficaria presa, porque o pathname não muda); `limpar()` — o endereço mudou (o `AppShell` chama quando `pathname`/`searchParams` mudam e em `popstate`); `useAlvo(): string | null`; `useNavegando(): boolean`; `useNavegar(): [navegar, pendente]` — `navegar(href)` faz o `router.push` **no ato**, dentro de `startTransition` (a tela velha continua respondendo), e marca — salvo mesmo pathname+search, que só faz o push. Segurança: `limpar()` sozinho depois de `--dur-navegacao-max` (30 s, medidor) — navegação cancelada, chunk 404; longo de propósito, porque numa rede lenta de verdade o Início leva mais de 8 s para chegar e o botão precisa continuar girando até lá. `router.replace` de filtro, aba ou popup por URL nunca marca. Nunca `onClickCapture` delegado em `a[href]`.
- **`features/shell/barra-de-rota.tsx`** — `<BarraDeRota />`: `div.barra-progresso[data-estado][aria-hidden]`, sempre montada, irmã de `<main>` (dentro dele rolaria). `ocioso → pendente` (em `marcar`) `→ concluindo` (em `limpar`) `→ ocioso` no `transitionend` de `opacity` — ou por timer de `--dur-2 + --dur-1` (medidor) quando a navegação foi mais curta que a carência e a opacidade nem chegou a mudar.
- **`features/shell/pendencia-do-link.tsx`** — `<PendenciaDoLink className?>{rótulo}</PendenciaDoLink>`, filho de um `<Link>`: lê `useLinkStatus()` e, enquanto o Next busca o chunk, põe `data-pendente="true"` e a cor em `--acento` por `--dur-1`. O atributo fica no DOM: movimento não é o único sinal.
- **`features/shell/recente.ts`** — `useRecente(): Id | null` — lê `useLastResult()` e devolve o `id` do último `OperationResult` ok durante `--dur-realce` (medidor), só se o resultado é posterior à montagem da tela; `null` depois. Requer o ramo `ok(value, id?)` de `data/state.ts` preenchido pelas operações de criar, alterar e mover; sem id não há gatilho — e nada quebra.

### A regra 4 da sentinela (`scripts/verificar-tokens.mjs`)

Além de token fantasma, cor crua e tamanho de fonte literal, `npm run verificar:tokens` reprova, em `.css`, `.ts` e `.tsx` de `src/` (fora de comentários e dos `DISPENSADOS`): **(a)** duração literal `\d+(\.\d+)?m?s` fora de `tokens.css` — vira token; **(b)** utilitário de movimento do Tailwind em `.tsx` — `animate-(spin|bounce|pulse|ping)`, `duration-\d+`, `ease-(in|out|linear|in-out)`, `transition-(all|transform)` — use `.girando`/`.pulso`/`.rotacao`/`.surgir`; **(c)** `will-change` em qualquer arquivo — o sistema não promove camadas; **(d)** `forwards` em `.css` fora das linhas de `sumir` e `regua-tempo` (`DISPENSADOS_MOVIMENTO`) — entrada termina em `transform: none`. Arquivos `.test.ts(x)` não entram na varredura.

---

## Acessibilidade

**Contraste AA testado.** `app/src/design/tokens.test.ts` resolve `var()` até hex no próprio `tokens.css` e reprova: a rampa `--texto`…`--texto-3` abaixo de 4.5:1 sobre `--page`, `--card` e `--cinza-600`; `--texto-4` abaixo de 3:1 (ele é não-textual: meta, régua, ícone apagado); `--sobre-acento` sobre `--acento`; `--sobre-degrade` sobre `--roxo-700` e `--roxo-500`; as semânticas sobre a página; perigo, ator, selo e aviso. O mesmo teste varre `components.tsx` e reprova hex, funções de cor, `bg-white`/`text-white`, `rounded-[<número>]` e `shadow-[` que não seja `var(--sombra-`.

**Foco visível sempre**, anel de 2 px em `--acento` com deslocamento, `:focus-visible` global.

**Teclado.** `Select`/`MultiSelect`: `↓`/`↑`, `Home`/`End`, `Enter`/`Espaço`, `Escape`, `aria-activedescendant`. `SidePanel` e `ConfirmDialog` prendem e devolvem o foco. Linha de tabela clicável é `<button>` ou `<Link>` — nunca `<div>` clicável.

**Cor nunca é o único sinal, e movimento também não.** Todo estado que anima é dito também por `role=status`, `aria-busy`, `disabledReason` ou texto. `prefers-reduced-motion` (e `<html data-movimento="minimo">`) desliga tudo sem perder estado: `lerDuracao` devolve 0 e o CSS zera duração e delay; o que informa fica (`DIRECAO-VISUAL.md` §5). Alvo de toque `.alvo-toque` cresce para 44 px abaixo de 768 px.

---

## O que estes componentes proíbem

- cor, tamanho de fonte, raio ou sombra literais em TSX
- `transform` em estado de repouso; `transform`, `filter`, `will-change`, `contain` ou `overflow` em invólucro de rota, corpo, `<aside>` ou qualquer ancestral de `SidePanel`/`ConfirmDialog`
- duração literal (`300ms`, `1.5s`) fora de `tokens.css`; `animate-*`, `duration-*`, `ease-*`, `transition-transform` em `className`; `forwards` fora de `sumir` e `regua-tempo`
- animação em re-render por `revision`; `setTimeout` para "mostrar" esqueleto ou spinner; `.cascata` fora da chegada; `data-chegada="foco"` em linha de tabela, conversa, mensagem ou cartão de quadro
- `overflow: hidden` em volta de peça; wrapper `overflow-x: auto` em volta de `.tabela`
- gradiente fora do botão sólido e da marca
- emoji como ícone; ícone fora de `<Icone>`
- placeholder no lugar de rótulo
- `window.confirm` / `window.alert`
- prosa explicativa sob o título da tela
