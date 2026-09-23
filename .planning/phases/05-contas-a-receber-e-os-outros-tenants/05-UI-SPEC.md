---
phase: 5
slug: contas-a-receber-e-os-outros-tenants
status: draft
shadcn_initialized: false
preset: none
created: 2026-09-23
---

# Phase 5 — UI Design Contract

> Contrato visual e de interação para a Phase 5. Gerado por `gsd-ui-researcher`, verificado por `gsd-ui-checker`.

---

## Nota de escopo — leia antes do resto

A superfície de tela desta fase é **pequena**, de propósito. TEN-01 e AUTO-02 são
costura de configuração e backend; REC-01 já tem Lista, Status, Campos e
Automações R2–R6 em produção desde a Fase 1 (`bootstrap-gestao.ts:191`,
`applyContasAReceber(..., { fixtures: false })`) — **a Lista já é a tela**, o
mesmo componente genérico de Lista/Tarefa que renderiza Contas a pagar hoje.
Nada aqui propõe uma tela nova de zero: as cinco entradas abaixo são as únicas
afordâncias que o genérico não dá, e duas delas (§2 Integrações, §3 filtro por
Empresa) já têm código no repositório que só precisa crescer, não nascer.

Este documento **não** cobre: as oito telas do financeiro-tria (Phase 4), nem
o ramo espelho de D7 (Omie como leitura) — D7 é checkpoint bloqueante aberto e
o default declarado (D5-02) é o ramo processo, que é o único que este
documento especifica. Se D7 vier a escolher o espelho, a leitura autenticada
segue o molde de D4-01/03 (fora desta fase) e nenhuma das cinco superfícies
abaixo muda.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none — sistema de design próprio, fixo neste monorepo (não shadcn) |
| Preset | não aplicável |
| Component library | `apps/web/src/design/` (`components.tsx`, `basicos.tsx`, `tela.tsx`, `esqueletos.tsx`, `icone.tsx`), consumido pelo barril `@/features/shell/ui` |
| Icon library | `lucide-react`, envolvido por `Icone` (traço fixo 1.5, quatro tamanhos `xs/sm/md/lg`) |
| Font | SF Pro Display (marca N1); Inter via `next/font` como reserva fora de aparelhos Apple |

Nenhum componente novo nasce nesta fase. As cinco superfícies abaixo compõem
exclusivamente o que já existe — ver `Component Inventory` e o detalhe de
cada superfície.

---

## Spacing Scale

Herdada de `apps/web/src/estilos/tokens.css` (`--e-*`) e das classes utilitárias
do Tailwind já em uso no projeto (mesma base de 4px — `px-6` = 24px, `gap-3` =
12px). Nada abaixo é literal fora de token.

| Token | Value | Usage nesta fase |
|-------|-------|-------------------|
| xs | 4px (`--e-1`) | Vão entre ícone e texto (selo de situação da Integração, ícone do `SettingRow`) |
| sm | 8px (`--e-2`, `gap-2`) | Espaço entre controles compactos — chip "Empresa: X" removível, botões da barra de filtros |
| md | 12–16px (`--e-3`/`--e-4`, `gap-3`, `px-4`) | Campo a campo no formulário de série (`grid gap-3`); padding interno de `SettingRow`/`RecordPanel`/card de Integração |
| lg | 20–24px (`--e-5`/`--e-6`, `px-6 py-5`) | Cabeçalho e rodapé do `ConfirmDialog` (série) e do `SidePanel`; padding de `CorpoDeTela` na tela de Integrações |
| xl | 32px (`--e-8`) | Respiro entre blocos independentes — entre o aviso "Integrações fora do ar" e a grade de cartões |
| 2xl | 48px (`--e-12`) | Não usado nesta fase |
| 3xl | 64px (`--e-16`) | Não usado nesta fase |

Alvo de toque mínimo: `--controle-h-lg` (44px), já padrão do sistema — nenhuma
exceção nesta fase.

Exceptions: nenhuma.

---

## Typography

Duas escalas do sistema (`apps/web/src/estilos/tipografia.css`): EDITORIAL
(`.ed-*`, para o que se lê) e APLICAÇÃO (`.app-*`, para o que se varre).
Nenhum tamanho literal — `npm run verificar:tokens` reprova `text-[Npx]` e
`fontSize: "N"` em TSX; todo tamanho é uma destas classes.

| Role | Size (classe) | Weight | Line Height |
|------|------|--------|-------------|
| Body | `.app-base` — 13px piso (14/15/16 nos três degraus de tela) | 400 regular | `var(--app-base-lh)`, ≈1.54× |
| Label | `.rotulo` (usa `--app-sm`, 12px piso) | 500 (fixo na classe) | 1rem piso, ≈1.33× |
| Heading | `.ed-subtitulo` — 18px piso (20/22/24 nos degraus) | 600 semibold | `var(--ed-subtitulo-lh)`, ≈1.56× — título do `ConfirmDialog` "Nova série de parcelas" e de qualquer `SidePanel` |
| Display | `.ed-titulo` — 24px piso — **não introduzido nesta fase** (nenhuma tela nova de nível de página; citado só como teto do sistema) | 600 semibold | `var(--ed-titulo-lh)` |

Tamanhos auxiliares já em uso e reaproveitados sem mudança: `.app-meta` (11px,
`--texto-4`) para metadados — data da última rotação, timestamp da Execução;
`.app-numero` (`font-variant-numeric: tabular-nums`) para toda coluna de
valor monetário — o total da série e cada parcela do preview (§1).

**Pesos:** o sistema já declara três (400/500/600) via classe, não por estilo
inline novo. Esta fase não introduz um quarto peso nem usa `fontWeight`
arbitrário fora do precedente já existente em `serie-dialog.tsx` (o total da
série em `fontWeight: 600`, reaproveitado para cada linha do preview em §1).

---

## Color

Estrutura herdada de `estilos/tokens.css`: preto quase puro segurando a
página (a base "45%" do manual de marca), lavagens de branco em alfa como
superfície, roxo como acento escasso. Nenhum hex novo — todo valor abaixo é
`var(--token)`.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `--page` `#0f0f10` / `--card` `#161617` | Fundo de tela; corpo opaco do `ConfirmDialog`/`SidePanel` |
| Secondary (30%) | `--superficie-1/2/3` (branco 3–5% alfa) + `--cinza-600` `#2a2a2a` | Cartão de Integração (`item-solto`), `SettingRow`, campos de formulário, linha de tabela |
| Accent (10%) | `--acento` (roxo `#c084fc`) | Reservado, e só para: botão primário "Criar série" no diálogo R1; o ícone de opção marcada dentro de `Select`/`StatusPicker` |
| Destructive | `--erro` (`#fca5a5`) / família `--cor-perigo-*` | Caixa de erro do formulário de série (data inválida, série duplicada); marca de recusa da Execução de notificar-por-Canal (§5) |

**Accent reserved for:** o botão "Criar série" do diálogo R1, e o ícone de
seleção corrente dentro de um `Select`/`StatusPicker`. Nada além disso nesta
fase — em particular: o Status `em revisão` usa a cor do próprio Status (ou
`CATEGORY_COLOR.emAndamento`, já âmbar), a situação da Integração usa
`Pilula tom="sucesso"/"erro"` ou `ConditionMarker tone="warning"/"danger"`
(nunca o roxo), e todo valor monetário usa `--texto` + peso 600 (nunca cor de
destaque).

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | "Criar série" — rótulo dinâmico já implementado em `serie-dialog.tsx`: `Criar {entrada + }N parcela(s)`, ex. "Criar entrada + 12 parcelas" |
| Empty state heading | Empresa sem Integração mapeada (§2): "Nenhuma Integração configurada" |
| Empty state body | "Aponte “{Empresa}” para uma conta Omie antes de lançar ou receber por ela. Sem Integração, toda Automação que tentar operar por esta Empresa recusa." |
| Error state — série (R1) | Data inválida: "Vencimento inválido: a 1ª parcela precisa vencer numa data real." — Série duplicada: a mensagem vem **literal** de `createReceivableSeries` (RN-CR-07), nunca reescrita pela tela |
| Error state — Canal (AUTO-02) | "“notificar” por WhatsApp recusado: Campo “Z WhatsApp” vazio — nada foi enviado." (mesmo padrão de `automations.ts` — aspas curvas, verbo no particípio, motivo explícito) |
| Destructive confirmation | Não aplicável nesta fase — nenhuma ação destrutiva nova nas cinco superfícies (o arquivamento das Listas de MP/FO, D5-07, é operação de backend/CLI, fora de tela) |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | nenhum — projeto não usa shadcn (`Tool: none`) | não aplicável |
| terceiros | nenhum | não aplicável |

---

## Component Inventory — o que esta fase compõe, sem criar nada novo

| Componente | Arquivo | Papel nesta fase |
|---|---|---|
| `ConfirmDialog` | `design/components.tsx:726` | Casca do diálogo "Nova série de parcelas" (§1) — já usado em `serie-dialog.tsx` |
| `Field`, `Select`, `TextInput` | `design/components.tsx` | Campos do formulário de série (§1) — já usados |
| `RecordRow`-like preview | novo uso, componente existente | Lista Entrada + N parcelas ANTES de confirmar (§1) — ver detalhe abaixo |
| `Pilula`, `ConditionMarker` | `design/components.tsx` / `basicos.tsx` | Situação da Integração por Empresa (§2) — já usados em `configuracoes/integracoes/page.tsx` |
| `Section`, `PageHeader`, `CorpoDeTela`, `EmptyState` | `features/shell/ui` | Casca da tela de Integrações (§2) — já existe |
| `Select` (filtro) | `design/components.tsx:314` | Filtro por Empresa nas Listas (§3) — já implementado em `contas-view.tsx` |
| `StatusPicker` | `design/components.tsx:1221`, prop `optionBlockReason` | 5º Status `em revisão` desabilitado com motivo por Empresa (§4) |
| `ActivityTimeline` | `design/components.tsx:1162` | Execução de notificar-por-Canal visível na Tarefa (§5) |

---

## Surfaces

### 1. O gesto de criar a série (R1) — `serie-dialog.tsx`

**O que já existe.** `SerieDeParcelasDialog` (`apps/web/src/features/estrutura/financeiro/serie-dialog.tsx`)
já é o formulário "criar série de parcelas" na própria Lista, exatamente como
o comentário de `seed-contas-a-receber.ts:145` prevê para quando não há
Gestão contratual. Campos, ordem, validação client-side e a mensagem de erro
do domínio (RN-CR-07, alcance) já estão implementados. **O que falta é
exatamente o que o objetivo desta pesquisa pede: o preview do que vai nascer,
antes de confirmar.**

**Ordem dos campos (mantida, já correta):**
1. Cliente (Contato do CRM) — `Select` buscável, só contatos `ativo`
2. Centro de Custo (obrigatório, RN-CR-01) · Empresa · Produto · Forma de
   recebimento — grade 2 colunas
3. Valor da entrada + Vencimento da entrada (par opcional — os dois ou
   nenhum) · Valor de cada parcela + Número de parcelas + Vencimento da 1ª
   parcela — grade 2 colunas

**Validação (já implementada, mantida):** o botão de confirmar nunca desliga
sem dizer por quê (`confirmDisabledReason`, §11 do sistema) — "Escolha o
cliente.", "Escolha o Centro de Custo (RN-CR-01).", "Informe o valor da
parcela.", "Informe quantas parcelas.", "Informe o vencimento da 1ª
parcela.", "O valor da entrada precisa ser maior que zero, ou fique em
branco.", "Informe o vencimento da entrada." — nesta ordem de prioridade.

**O que esta fase acrescenta — o preview.** Entre o bloco de valores e a
frase de total (linha 160-166 do arquivo atual), inserir uma lista compacta
do que a série vai criar, sempre visível assim que os campos mínimos
(parcela, parcelas, 1º vencimento) estão preenchidos — nunca escondida atrás
de um botão "ver preview":

- Uma linha por item, no padrão `RecordRow` (rótulo à esquerda, valor à
  direita, `.app-numero` tabular): `Entrada · {data} · {valor}` (só se houver
  entrada) seguida de `1ª parcela · {data} · {valor}`, `2ª parcela · {data} ·
  {valor}` … até a última. Data calculada client-side com a MESMA regra que
  `createReceivableSeries` já aplica (mesmo dia dos meses seguintes) — texto
  auxiliar já existente ("As parcelas seguintes vencem no mesmo dia dos meses
  seguintes") continua abaixo da lista, não a substitui.
- Acima de 6 linhas, a lista rola dentro de um contêiner de altura máxima
  (`max-h-48 overflow-y-auto`, mesmo padrão de lista rolável do `Select`) —
  nunca colapsa nem trunca em "...".
- O total (já existente, `fontWeight: 600`, `.app-numero`) fica ABAIXO da
  lista, não acima: a pessoa lê o que nasce, depois a soma.

**Erro de data inválida (novo, client-side, antes do domínio ser chamado):**
se o vencimento calculado de qualquer parcela cair numa data que
`Date.parse` não reconhece (campo de data vazio já é pego pela validação
existente) ou se `primeiroVencimento` for anterior à data de hoje, o botão
desliga com `confirmDisabledReason`: **"Vencimento inválido: a 1ª parcela
precisa vencer numa data real."** — mesmo mecanismo das demais mensagens,
mesma cor (`--erro`), sem caixa de alerta adicional.

**Erro de série duplicada:** já tratado — `result.error` de
`createReceivableSeries` aparece verbatim na caixa vermelha que já existe
(linhas 117-124 do arquivo), com `role="alert"`. Nenhuma mudança: a tela não
reescreve o texto do domínio, só o exibe.

---

### 2. A configuração por Empresa (TEN-01 / D5-03) — `configuracoes/integracoes/page.tsx`

**O que já existe.** A tela `/configuracoes/integracoes` já lista toda
`Integration` do Espaço num cartão (`item-solto`): nome, `systemType`,
situação (`Pilula tom="sucesso"` se `conectada`, `ConditionMarker
tone="danger"/"warning"` para `comErro`/`desconectada`), Ferramentas
expostas, e o rodapé "configurada por {Membro} em {data} · sem Proprietário:
configurar é rastreabilidade, não governança". **Nunca mostra segredo — a
`Integration` de hoje nem tem campo para isso.** Este é o padrão a estender,
não substituir.

**O que esta fase acrescenta ao cartão** (entre o cabeçalho nome/situação e o
bloco de Ferramentas expostas), só quando a Integração tem Empresa associada:

- `Empresa: {nome da Empresa}` — `.app-meta`, mesma hierarquia visual das
  demais linhas de metadado do cartão.
- `Conta Omie: {rótulo estável}` — o rótulo da conta (D5-03), nunca
  `app_key`/`app_secret`. Se o rótulo não existir ainda: `Conta Omie: não
  informada` em `--texto-4`, sem alarme (é estado transitório de
  configuração, não erro).
- `Banco de categorias: {rótulo}`, mesma régua, omitido por inteiro se vazio
  (nunca "—" solto).
- `Última rotação: {data, fmt.instant} ` ou, se nunca rotacionada,
  `Última rotação: nunca registrada` — `.app-meta`, cor `--texto-4` (neutro,
  não aviso: D-13 já aceitou o risco da credencial do Marcos Paulo).

**O que a tela NUNCA renderiza:** qualquer string que pareça
`app_key`/`app_secret`/token — nem mascarada (tipo `••••1234`), porque a
plataforma não guarda o segredo (D5-03/CON-10): não há dado para mascarar, só
para omitir por inteiro se alguém tentar passá-lo por engano (isso é regra de
domínio, não de tela, mas a tela nunca deve ganhar um campo `<TextInput
type="password">` para isto).

**Empresa sem Integração mapeada (o caso que falta na tela hoje).** A tela
hoje itera só `state.integrations` — uma Empresa sem Integração
correspondente simplesmente não aparece, e "não aparecer" não é a mesma coisa
que "está ok". Esta fase pede que a grade itere as opções do Campo `Empresa`
(`CP.fields.empresa`, hoje 11 opções, seis relevantes às Integrações desta
fase: Tria, FINQ/Konq, Marcos Paulo, EXO Loteamento, EXO Participações,
Oliveira Participações) e, para cada uma sem `Integration` correspondente,
renderize um cartão no mesmo grid, mesma forma (`item-solto`), com:

- Título: nome da Empresa (mesma posição/estilo do nome da Integração).
- `ConditionMarker tone="warning"` no lugar da `Pilula` de situação: **"sem
  Integração"**.
- Corpo: `EmptyState compact` com `title="Nenhuma Integração configurada."` e
  `hint="Aponte “{Empresa}” para uma conta Omie antes de lançar ou receber
  por ela."` — mesmo texto do Copywriting Contract acima.
- Sem rodapé "configurada por" (não há configuração ainda).

Isso é visualmente distinto de uma Integração `comErro` (que já existe, já
está conectada mas falhando) — a Empresa sem Integração nunca teve conexão
nenhuma, e a forma (cartão com `EmptyState` embutido, ícone de aviso) precisa
dizer isso antes que a pessoa leia o texto.

**Onde a configuração por Empresa mora (decisão de tela, não de dado):** esta
tela consome o dado — o rótulo da conta, a situação, a data de rotação —
qualquer que seja o mecanismo que o planner escolher para guardá-lo
(`Integration` estendida, catálogo do Espaço, ou Campo de configuração da
Lista, discretion aberta em `05-CONTEXT.md`). A tela não muda com essa
escolha: ela sempre lê "Empresa → rótulo, situação, data", nunca "Empresa →
segredo".

---

### 3. O filtro por Empresa nas Listas existentes (D5-04) — `contas-view.tsx` / genérico

**O que já existe e não muda.** `FinanceToolbar` (`contas-view.tsx:219-335`)
já lê as opções do Campo `Empresa` **dinamicamente**
(`state.fieldDefinitions.find((d) => d.id === CP.fields.empresa)?.options`) e
monta: um `Select` de filtro (`filtro-empresa`, `size="sm"`, placeholder
"Todas as empresas"), um chip removível "Empresa: {valor}" na régua de
filtros aplicados, e uma coluna "Empresa" na tabela (`hidden @6xl:table-cell`
— some em telas estreitas, reaparece em wide). **Nada disto precisa de
código novo**: quando o Campo `Empresa` ganhar "Marcos Paulo" e o rótulo do
FINQ/Konq (D5-05, D5-08), o filtro, o chip e a coluna crescem sozinhos porque
leem a lista de opções, não uma constante.

**A mesma tela cobre "Solicitações de pagamento" e "Contas a pagar"
(D5-04).** A Lista de Solicitações usa o filtro genérico de `ViewBar`
(`estrutura/view-bar.tsx`), que já filtra por qualquer Campo da Lista,
incluindo `Empresa` — não precisa do `FinanceToolbar` bespoke de Contas a
pagar/receber. Nenhuma tela nova: confirmar que o filtro genérico continua
alcançando `Empresa` depois que a Lista ganhar as seis opções é verificação,
não desenho.

**Como uma Tarefa mostra a própria Empresa fora da tabela** (no popup de
registro / drawer): o valor do Campo `Empresa` já aparece como qualquer outro
Campo de seleção única na ficha genérica da Tarefa (o mesmo mecanismo que já
mostra Centro de Custo, Produto etc.) — nenhuma linha nova a desenhar. Se o
Campo tiver cor associada (como as opções de `Select` com `option.color`
mostram um `pilula-ponto`), o mesmo ponto colorido aparece no valor — sem
inventar um badge de Empresa dedicado.

**Contas a receber reusa o mesmo padrão de Contas a pagar (discretion —
decisão desta pesquisa):** `contas-view.tsx` e `conta-drawer.tsx` são o
molde; a Lista "Contas a receber" ganha a MESMA `FinanceToolbar` (busca,
filtro de Empresa, filtro de período, ações em lote) em vez de uma tela
paralela — é a leitura de "Layout das telas de Contas a receber, reusando o
que a Lista já entrega" (discretion do `05-CONTEXT.md`).

---

### 4. O 5º Status `em revisão` (D5-06) — `StatusPicker`

**O problema.** O Conjunto de Status é da Lista, não da Empresa — as cinco
opções (`recebida`, `em validação`, `aguardando aprovação`, `aprovada` / `não
aprovada` / `em revisão`, `convertida`) valem para as seis Empresas, mas só a
Automação do Family Office move uma Tarefa para `em revisão`. Um Membro da
Tria abrindo o `StatusPicker` numa Tarefa da Tria veria "em revisão" como uma
opção clicável igual às outras — convite a um clique sem sentido.

**A solução já é uma prop existente, não um componente novo.**
`StatusPicker` (`design/components.tsx:1221`) já aceita
`optionBlockReason(optionId): string | undefined` — por opção, "por que ESTA
não pode ser escolhida agora", renderizada com a opção continuando visível na
lista (nunca escondida), `aria-disabled`, `opacity-50` e `title` com o
motivo (§11 do sistema: um controle desligado sempre diz por quê).

**Contrato desta fase:** quando o `StatusPicker` é montado para uma Tarefa da
Lista de Solicitações, quem chama calcula, por Tarefa (lendo o valor do
Campo `Empresa` da própria Tarefa), se existe alguma versão publicada de
Automação com `scopeId` = a Lista, condição `valorDeCampo` batendo a Empresa
da Tarefa, e ação `tarefa.alterarStatus` para `em revisão` (o padrão R6/Pattern
2 do `05-RESEARCH.md`). Se não existir, `optionBlockReason("em revisão")`
devolve: **"Este Status pertence ao fluxo do Family Office — a Automação
desta Empresa não usa “em revisão”."** Se existir (a Tarefa É do Family
Office, ou de qualquer Empresa futura que declare a mesma Automação), a opção
fica disponível normalmente, sem `reason`.

**Categoria e cor:** `em revisão` usa a categoria `emAndamento`
(`CATEGORY_COLOR.emAndamento`, âmbar `#fbbf24`, já definida) — não é
terminal, é um estado de espera humana. Nenhuma cor nova: o Status herda a
paleta que `CATEGORY_COLOR` já define para a categoria, como todo Status do
sistema.

---

### 5. A Execução de uma notificação por Canal (AUTO-02 / D5-10) — `ActivityTimeline`

**O problema.** Quando o Campo de destino (`Z WhatsApp`) está vazio, a Ação
recusa — e essa recusa precisa ser visível, nunca um Comentário fantasma nem
um silêncio. Não existe hoje uma tela dedicada de "Execuções de Automação";
o canal de visibilidade que já existe e já é genérico é o `ActivityTimeline`
da própria Tarefa (o painel Timeline único de SOL-04/Plan 02-19 — Comentários
+ Registros de Atividade).

**Contrato: recusa vira Registro de Atividade, nunca Comentário.** O ramo
`notificar` hoje (in-app) publica um `Comentário` com Menção
(`addTaskComment`) quando funciona — mas uma tentativa de Canal que FALHA não
deve simular um Comentário que ninguém mandou. Segue o precedente já travado
na Fase 3 (o helper `recusar()` que transforma uma recusa de Agente em passo
de raciocínio, nunca em escrita da Tarefa): a recusa gera um
`ActivityEntry` via `recordActivity`, renderizado pelo `ActivityTimeline` já
existente, sem componente novo:

```
actorKind: "automation"
actorName: "<nome da Automação>"
action:    "tentou notificar por WhatsApp e recusou"
detail:    "Campo “Z WhatsApp” vazio — nada foi enviado."
```

Isso aparece na Timeline com o ponto colorido de `--cor-ator-automacao`
(teal `#5eead4`, já definido, já usado para todo Ator do tipo Automação —
nenhuma cor nova para "isto falhou": a cor não é do resultado, é do Ator;
quem diz que falhou é o texto de `action`, no particípio, sem eufemismo).

**Contrato: sucesso também não escreve o número por inteiro.** Quando a
notificação sai de fato (Campo preenchido), o `ActivityEntry` correspondente
mostra:

```
action: "notificou por WhatsApp"
detail: "Campo “Z WhatsApp”: •••• {últimos 4 dígitos}"
```

— mesma doutrina de "payload pobre" que já governa o outbox (`outbox.ts`):
o número completo não precisa viver num feed compartilhado da Tarefa; os
últimos 4 dígitos bastam para o Financeiro confirmar que foi o contato certo,
sem expor o número inteiro a qualquer Membro que enxergue a Tarefa.

**O que esta fase NÃO cria:** uma tela ou painel dedicado de "Execuções de
Automação" listando todas as Execuções de todas as Automações. O escopo
observado (D5-11: só o que o Marcos Paulo já faz) não pede isso, e o
`ActivityTimeline` por Tarefa já responde à pergunta "esta notificação
específica funcionou?" — que é a única pergunta que D5-10 exige tornar
visível.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
