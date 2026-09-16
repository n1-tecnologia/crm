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
| Flutuante | `.veu` `.flutuante` `.surgir` `.item-menu` | `controles.css` |
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
- **`Icone`** (`de`, `tamanho` xs/sm/md/lg) — Lucide com traço 1.5 e medida por token, para crescer nos degraus.
- **`Esqueleto`**, **`EsqueletoDeLinhas`**, **`Trilha`**, **`Divisor`**, **`RotuloDeSecao`**, **`CampoDeLanterna`**, `cn`.

---

## Os componentes de sempre (`design/components.tsx`)

Mesmas APIs de antes, reescritos por dentro sobre as classes do sistema.

**`Button`** — `primary` (`.btn-solido`, o gradiente da marca, texto `--sobre-degrade`), `secondary` (`.btn-fantasma`), `ghost` (`.btn-sutil`), `danger` (`.btn-perigo`); `size` `sm`/`md`; `icon`; `full`. Caixa-alta com tracking, como no CRM. **Contrato mantido:** `disabled` sempre com `disabledReason`, e o motivo chega a quem não usa mouse (`aria-disabled` + `aria-describedby`; o clique é engolido, inclusive em `type="submit"`).

**`Field`**, **`TextInput`**, **`TextArea`** — `.rotulo`/`.ajuda`/`.campo`. Rótulo sempre visível; erro substitui a dica com `role="alert"`.

**`Select`**, **`MultiSelect`** — gatilho `.campo`, lista `.flutuante .surgir`, opções `.item-menu`; busca opcional; opção indisponível fica na lista **com o motivo**. Teclado como caixa de combinação.

**`Chip`**, **`StateSeal`** (`.selo`), **`ConditionMarker`** — três coisas diferentes: o que o usuário escolheu e remove; o que o registro **é**; o que o registro **está** agora. Formas distintas de propósito.

**`SidePanel`** (`.veu` + `aside` em `--card`), **`ConfirmDialog`** (`.flutuante .surgir`, `--modal-sm/lg`), **`ActionMenu`** (`.btn-icone .btn-icone-nu` + `.item-menu`, `data-destrutivo`), **`Toast`** (`.flutuante` com ícone por tom). São `fixed` **sem portal** — por isso `transform` só existe em `:hover`/`:active` no sistema inteiro. `ConfirmDialog` continua o único mecanismo de confirmação.

**`EmptyState`** (`title`, `hint`, `action`, `icon`, `compact`) e **`NoAccessState`** — distintos e com aparência distinta: vazio é centro; sem acesso é painel com cadeado.

**`ActorAvatar`** (tamanho por `--avatar-sm/md`; Membro é círculo, não humanos são quadrado arredondado), **`RichText`**, **`ActivityTimeline`** (pilha de `item-solto` estáticos), **`StatusPicker`** (`.btn .btn-sm`, agrupado por categoria), **`Toggle`** (`.chave`), **`SettingRow`** (`.painel`), **`RecordPanel`**/**`RecordRow`**.

**Removidos por falta de uso:** `DataTable`, `Column`, `Board`, `BoardColumn`. A tabela do sistema é `.tabela` — genérica em `features/shell/record-list.tsx` (`RecordList`, 10 telas-índice) e à mão nas telas que agrupam ou editam em linha (financeiro, Membros, Auditoria, Campos…). O quadro é `.trilho` por coluna com `.card-negocio` por cartão.

---

## Acessibilidade

**Contraste AA testado.** `app/src/design/tokens.test.ts` resolve `var()` até hex no próprio `tokens.css` e reprova: a rampa `--texto`…`--texto-3` abaixo de 4.5:1 sobre `--page`, `--card` e `--cinza-600`; `--texto-4` abaixo de 3:1 (ele é não-textual: meta, régua, ícone apagado); `--sobre-acento` sobre `--acento`; `--sobre-degrade` sobre `--roxo-700` e `--roxo-500`; as semânticas sobre a página; perigo, ator, selo e aviso. O mesmo teste varre `components.tsx` e reprova hex, funções de cor, `bg-white`/`text-white`, `rounded-[<número>]` e `shadow-[` que não seja `var(--sombra-`.

**Foco visível sempre**, anel de 2 px em `--acento` com deslocamento, `:focus-visible` global.

**Teclado.** `Select`/`MultiSelect`: `↓`/`↑`, `Home`/`End`, `Enter`/`Espaço`, `Escape`, `aria-activedescendant`. `SidePanel` e `ConfirmDialog` prendem e devolvem o foco. Linha de tabela clicável é `<button>` ou `<Link>` — nunca `<div>` clicável.

**Cor nunca é o único sinal.** `prefers-reduced-motion` desliga lift, lanterna e animações. Alvo de toque `.alvo-toque` cresce para 44 px abaixo de 768 px.

---

## O que estes componentes proíbem

- cor, tamanho de fonte, raio ou sombra literais em TSX
- `transform` em estado de repouso
- `overflow: hidden` em volta de peça; wrapper `overflow-x: auto` em volta de `.tabela`
- gradiente fora do botão sólido e da marca
- emoji como ícone; ícone fora de `<Icone>`
- placeholder no lugar de rótulo
- `window.confirm` / `window.alert`
- prosa explicativa sob o título da tela
