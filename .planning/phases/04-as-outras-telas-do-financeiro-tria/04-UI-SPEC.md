---
phase: 4
slug: as-outras-telas-do-financeiro-tria
status: draft
shadcn_initialized: false
preset: none
created: 2026-09-23
---

# Phase 4 — UI Design Contract

> Contrato visual e de interação para as oito leituras do financeiro-tria portadas
> ao CRM N1. Gerado por gsd-ui-researcher, verificado por gsd-ui-checker.
>
> **Isto é um PORT, não um redesign (D4-01..D4-16, DEC-16/D-22).** O Financeiro
> precisa reconhecer as telas: mesmos nomes, mesma ordem de colunas, mesmas
> contagens. O que muda é o sistema visual e o caminho dos dados — nunca a
> regra, nunca o que se lê. Este documento não propõe nenhum token, componente
> ou biblioteca novos: compõe o que já existe em `apps/web/src/design/` e
> `apps/web/src/features/shell/`.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none — não há shadcn/radix neste projeto; sistema de design próprio e já fixo |
| Preset | not applicable |
| Component library | nenhuma externa — primitivas próprias em `apps/web/src/design/` (`components.tsx`, `basicos.tsx`, `tela.tsx`, `esqueletos.tsx`, `icone.tsx`), consumidas pelas telas só pelo barril `apps/web/src/features/shell/ui.tsx` |
| Icon library | `lucide-react`, sempre embrulhado por `<Icone de={LucideIcon} tamanho="xs\|sm\|md\|lg" />` (`design/icone.tsx`) — nunca `<LucideIcon />` direto (perde o `stroke-width: 1.5` e o token de tamanho) |
| Font | SF Pro Display (sistema Apple) com Inter via `next/font` como reserva (`--fonte-corpo`, `estilos/tokens.css`) |

**Regra de importação.** Toda tela nova importa primitivas só de
`@/features/shell/ui` (o barril), nunca direto de `@/design/*`. Se um
componente de tela precisar de algo que o barril não exporta, ou ele entra no
barril, ou a tela não deveria usá-lo — não há exceção silenciosa para esta
fase.

**Portão que não se negocia.** `npm run verificar:tokens -w @n1/web`
(`apps/web/scripts/verificar-tokens.mjs`) reprova três coisas, e as três
travam o build da fase:

1. **Todo `var(--x)` usado precisa existir definido** em algum `.css` varrido
   (`tokens.css` e demais folhas de `estilos/`) — um nome de token inventado
   (`--acento-fort` em vez de `--acento-forte`) não quebra o CSS, só resolve
   para string vazia e a sentinela é a única coisa que acusa.
2. **Nenhuma cor crua fora de `estilos/tokens.css`**: nenhum hex
   (`#0f0f10`), nenhuma função `rgb()/rgba()/hsl()/hsla()/oklch()/oklab()`,
   nenhum `bg-white`/`text-black`/`border-white` do Tailwind em nenhum `.tsx`
   novo das oito telas. Toda cor que este documento cita abaixo (inclusive as
   de severidade e de execução) já é um token existente — nenhuma precisa
   nascer.
3. **Nenhum tamanho de fonte literal em `.tsx`**: nem `text-[13px]`, nem
   `fontSize: "13px"`. Título, rótulo e corpo usam sempre uma classe `.ed-*`
   (editorial) ou `.app-*` (aplicação) — nunca um valor solto. É assim que o
   degrau de tela (ver Spacing) redimensiona a tela inteira sem tocar
   componente nenhum.

Os dois arquivos dispensados da varredura (`data/`, `agent-builder/`,
`brand.tsx`, `app/layout.tsx`, os dois editores de cor-como-dado) não incluem
nada do Financeiro — as oito telas entram na varredura cheia, sem exceção.

---

## Spacing Scale

O sistema já declara a escala; esta fase não cria nenhuma. Os valores abaixo
são o **piso** (`< 1440px`, o `:root` de `tokens.css`) — em telas maiores os
mesmos nomes de token crescem sozinhos pelos três "degraus" de
`estilos/tokens.css` (`@media (min-width: 1440px|1760px|2200px)`). Nenhum
`.tsx` desta fase escreve um valor de espaçamento fora destes tokens.

| Token | Valor (piso) | Uso nas oito telas |
|-------|-------|-------|
| `--e-1` | 4px | vão entre ícone e texto inline |
| `--e-2` | 8px | `--gap-solto` (vão entre peças independentes: linhas de Dashboard, chips de filtro) |
| `--e-3` | 12px | `--celula-x` (padding horizontal de célula de tabela) |
| `--e-4` | 16px | respiro padrão de `CorpoDeTela`, gap do grid de métricas do Dashboard |
| `--e-5` | 20px | — |
| `--e-6` | 24px | padding de `Painel`/`ConfirmDialog` |
| `--e-8` | 32px | vão entre seções longas |
| `--e-10` | 40px | — |
| `--e-12` | 48px | — |
| `--e-16` | 64px | — |

Métricas fixas reaproveitadas (não são "espaçamento" genérico, são a medida de
um componente específico e não mudam entre telas):

| Token | Valor (piso) | Uso |
|-------|-------|-------|
| `--cabecalho-tela-h` | 44px | altura de `CabecalhoDeTela`/`PageHeader` — igual nas oito telas |
| `--barra-filtros-h` | 40px | altura de `BarraDeFiltros` — Notas fiscais, Plano de contas |
| `--controle-h` | 36px | altura de botão/campo padrão |
| `--controle-h-sm` | 32px | altura de controle compacto (dentro de `BarraDeFiltros`, célula de edição inline em Produtos) |
| `--controle-h-lg` | 44px | alvo de toque mínimo — não usado nestas telas (são de mesa, não mobile-first), mas nenhum controle interativo fica abaixo de 32px |
| `--linha-altura` | 36px | altura de linha de `.tabela` (Notas fiscais, Produtos, Plano de contas, Workflows, Problemas, Aprovações pendentes) |

**Exceções desta fase:** nenhuma. As oito telas não introduzem alvo de toque,
raio ou métrica fora do que já existe.

---

## Typography

Duas escalas já existem — **editorial** (`.ed-*`, título/rótulo de seção) e
**aplicação** (`.app-*`, corpo denso, tabela, número). As oito telas do
Financeiro são todas telas de dado denso: usam quase só a escala de
aplicação, com a editorial reservada a título de tela e número grande do
Dashboard. Toda tela escreve a **classe**, nunca o tamanho — é o que o portão
de tokens reprova ao contrário.

| Papel | Classe | Tamanho (piso) | Peso | Altura de linha |
|------|------|------|--------|-------------|
| Corpo (célula de tabela, texto de card) | `.app-base` | 13px | 400 (regular) | 1.25rem (`--app-base-lh`) |
| Rótulo (cabeçalho de coluna `.app-coluna`, rótulo de campo `.rotulo`) | `.app-sm` | 12px | 400 (regular) | 1rem (`--app-sm-lh`) |
| Nome de registro / título de card | `.app-md` | 14px | 600 (semibold) | 1.25rem (`--app-md-lh`) |
| Meta / número secundário (idade, contagem, id técnico) | `.app-meta` + `.app-numero` onde for número | 11px | 400 (regular) | 1rem (`--app-xs-lh`) |
| Título de tela (`PageHeader`/`CabecalhoDeTela`) | `.app-md` (inline, `fontWeight: 600`) | 14px | 600 (semibold) | 1.25rem |
| Título de painel/card de destaque (raro nesta fase: `RecordPanel`) | `.ed-subtitulo` | 18px | 600 (semibold) | 1.75rem |
| Número grande do Dashboard (as 4 métricas) | `.ed-titulo` + `.app-numero` | 24px | 600 (semibold) | 1.875rem |
| Rótulo de seção/eyebrow (`RotuloDeSecao`, `ReguaDeSecao`) | `.ed-secao` | 12px, caixa-alta, tracking `--tr-secao` | 400 (regular) | — |

**Duas famílias de peso, e só duas, nas telas novas desta fase:** `400`
(regular — corpo, meta, rótulo) e `600` (semibold — título de tela, nome de
registro, número grande, rótulo do botão). O sistema também define `500`
(`--peso-medio`) para o sublinhado de aba ativa (`Abas`) — nenhuma das oito
telas usa abas, então esta fase não introduz nenhum uso de `500`.

**Números sempre com `.app-numero`.** Valor (`R$`), contagem, id de pedido,
percentual — a classe fixa a largura tabular do dígito para que uma coluna de
números não "dance" entre linhas. Já é convenção do sistema (`RecordList`,
`ReguaDeSecao`), não uma peça nova.

**Formatação de moeda e data.** Toda quantia em `R$` passa por
`useFormat().money({ amount, currency: "BRL" })` (`features/shell/use-format.ts`)
— **nunca** `Intl.NumberFormat` escrito à mão na tela, porque `fmt.money` já é
o formatador único, ligado ao `Locale` do Espaço, que o resto do produto usa.
Como as tabelas `transacoes`/`solicitacoes_pagamentos` guardam o valor como
número puro (não como o `Money` da ontologia, DEC-16 proíbe modelar isso), a
tela embrulha o número no formato `{ amount: valor, currency: "BRL" }` antes
de passar a `fmt.money` — é a única forma de reusar o formatador sem inventar
um segundo. Data/hora usa `fmt.instant`/`fmt.relative` do mesmo hook.

---

## Color

O sistema é escuro, um preto quase neutro segurando tudo, com o roxo da marca
como o único acento. As oito telas do Financeiro não introduzem nenhuma cor —
usam exatamente a paleta abaixo, toda já declarada em `estilos/tokens.css`.

| Papel | Token / valor | Uso |
|------|-------|-------|
| Dominante (60%) | `--page` `#0f0f10` | fundo da página, `CorpoDeTela` |
| Secundária (30%) | `--card` `#161617` + `--superficie-1/2/3` (lavagens de branco em alfa 3–5%) | `Painel`, linha de tabela, campo de formulário, cartão de card do Dashboard |
| Acento (10%) | `--acento` `#c084fc` (roxo-300) | ver lista fechada abaixo — nunca decoração |
| Destrutivo | `--erro` `#fca5a5` | botão "Remover" (Plano de contas), texto de falha de leitura |

**Acento reservado para (lista fechada, nada fora dela nas oito telas):**

- Botão primário (`Button variant="primary"`): "Importar CSV" (Plano de
  contas), "Fazer upload" (Extratos), "Executar agora" (Workflows), "Marcar 7
  dias" / "Emitir notas pendentes" (Notas fiscais).
- Opção selecionada dentro de `Select`/`MultiSelect` (o ícone de check) — já é
  comportamento herdado do componente, não uma decisão desta fase.
- Anel de foco (`:focus-visible`, `--linha-acento-forte`) — global, herdado.
- Barra de progresso do upload de Extratos (`width: X%`, `background:
  var(--acento)`) — o único lugar em que o acento pinta uma área maior que um
  controle, porque é literalmente "andamento", o papel que o manual reserva a
  ele.

**Nunca acento:** nenhuma `Pilula` de severidade, status de pedido, status de
execução de Workflow ou seal de vista legada usa `tom="acento"` nestas oito
telas. Severidade e estado são vocabulário semântico (abaixo), não decoração
— confundir os dois é o erro que o `§2` dos padrões do sistema já nomeia
("selo de ciclo de vida" ≠ "marcador de condição").

**Vocabulário semântico já existente, reusado sem alteração:**

| Domínio | Tokens | Onde nesta fase |
|---------|--------|------------------|
| Severidade genérica (`Pilula tom=…`) | `sucesso` `#4ade80` · `info` `#7dd3fc` · `aviso` `#fbbf24` · `erro` `#fca5a5` · `neutro` `#7c7c84` | Problemas (severidade alta→`erro`, média→`aviso`, baixa→`neutro`); Notas fiscais (`status_pedido`, ver tabela por tela) |
| Estado de Execução (`--cor-exe-*`) | `pendente` `#78716c` · `executando` `#7dd3fc` · `aguardando` `#a5b4fc` · `concluida` `#4ade80` · `falhou` `#fca5a5` · `cancelada` `#a8a29e` | Workflows — o histórico de runs é literalmente uma Execução no sentido que estes tokens já nomeiam; usar `<Pilula cor="var(--cor-exe-falhou)">`, nunca reinventar a paleta com `tom` genérico |
| Selo de ciclo de vida (`StateSeal`) | os `--cor-selo-*` | não usado nestas telas — nenhuma das oito tem arquivado/lixeira/mesclado |

---

## Navegação e Permissão (D4-14)

**Onde `/financeiro` entra.** `apps/web/src/features/shell/app-shell.tsx`
ganha um sexto item em `ASSUNTOS` (hoje: trabalho, crm, ia, ferramentas,
paineis), na mesma forma dos demais:

```ts
{
  chave: "financeiro",
  rotulo: "Financeiro",
  icone: Wallet,
  telas: [
    { href: "/financeiro", rotulo: "Dashboard", icone: LayoutDashboard },
    { href: "/financeiro/notas-fiscais", rotulo: "Notas fiscais", icone: Receipt, prefixo: true },
    { href: "/financeiro/produtos", rotulo: "Produtos", icone: Package, prefixo: true },
    { href: "/financeiro/plano-contas", rotulo: "Plano de contas", icone: ListTree, prefixo: true },
    { href: "/financeiro/extratos", rotulo: "Extratos do Marcos", icone: Upload, prefixo: true },
    { href: "/financeiro/workflows", rotulo: "Workflows", icone: Workflow, prefixo: true },
    { href: "/financeiro/problemas", rotulo: "Problemas", icone: AlertTriangle, prefixo: true },
    { href: "/financeiro/aprovacoes-pendentes", rotulo: "Aprovações pendentes", icone: ClipboardCheck, prefixo: true },
  ],
},
```

`assuntoDe()` ganha `if (pathname.startsWith("/financeiro")) return
ASSUNTOS[N]!;` no mesmo padrão das outras quatro linhas. O item "Dashboard"
usa `href: "/financeiro"` **sem** `prefixo`, porque com `prefixo` ele casaria
todas as sub-rotas — o mesmo cuidado que o próprio arquivo já registra para
`/ia/personalizar`.

**O item some, nunca aparece desativado.** D4-14 é explícito: a autorização é
do `apps/api` (`memberReachesContainer`, 403), a navegação só reflete o que o
servidor já decidiu — o item escondido é **consequência** do 403, nunca o
controle em si. Como a `ASSUNTOS` de hoje já é uma constante estática sem
filtro nenhum (nenhum dos cinco assuntos atuais é condicional), esta fase
introduz o primeiro filtro condicional do trilho, e só para esta entrada:

```ts
// dentro de AppShell, onde ASSUNTOS é mapeado (linha ~389 e ~513 de app-shell.tsx)
const data = useData((d) => d);
const { memberId } = useSession();
const vePastaFinanceiro = memberReachesContainer(data, memberId, "folder", CP.folderId); // CP.folderId = "fld_financeiro"

const assuntosVisiveis = ASSUNTOS.filter((a) => a.chave !== "financeiro" || vePastaFinanceiro);
```

`CP` vem de `@n1/dominio/operations/financeiro` (já existe, `folderId:
"fld_financeiro"`) — nenhum identificador novo.

**Se alguém navega direto pela URL sem alcance.** O Server Component de cada
`page.tsx` de `/financeiro/*` chama `GET /financeiro/<leitura>` no
`apps/api`; um 403 real do servidor (não a ausência do link) é quem decide —
a página renderiza `NoAccessState` (já existe, `design/components.tsx`, o
cadeado — nunca o texto de "vazio"). Copy: `NoAccessState what="Financeiro"`
→ "Financeiro · sem acesso" (o componente já compõe esse texto sozinho a
partir de `what`).

---

## Componentes reutilizados

Nenhum componente novo de `design/` nasce nesta fase. A tabela lista o que já
existe e onde cada um entra; a única composição nova é um punhado de arquivos
pequenos em `apps/web/src/features/financeiro/componentes/`, todos montados
só a partir da lista abaixo.

| Componente (barril `shell/ui`) | Uso nas oito telas |
|---|---|
| `PageHeader` | Cabeçalho de cada uma das oito — `title`, `meta` (contagem), `actions` (botão Atualizar + CTA primário), `seal` (só em Aprovações pendentes — "Vista legada"), `details` (Aprovações pendentes e Plano de contas) |
| `Section` + `ReguaDeSecao` | Agrupamentos do Dashboard ("Precisa da sua atenção", "Problemas abertos") |
| `RecordList` (`features/shell/record-list.tsx`) | A tabela-padrão de Notas fiscais, Produtos, Plano de contas, Workflows (histórico), Problemas, Aprovações pendentes — ver "Paginação" abaixo |
| `EmptyState` | "sem linhas" nas seis telas de leitura tabular + Dashboard |
| `NoAccessState` | 403 de qualquer rota `/financeiro/*` |
| `BarraDeFiltros` + `TextInput`/`Select`/`MultiSelect` | Filtros client-side de Notas fiscais e Plano de contas |
| `ConfirmDialog` | Import do Plano de contas, remoção por id, os dois gatilhos de emissão de NF, execução manual de Workflow |
| `Toast` | Resultado de ação (sucesso/erro) — nunca para o estado de falha de carregamento da tela inteira (ver "Os três estados") |
| `Pilula` | Severidade (Problemas), status de pedido (Notas fiscais), estado de Execução de run (Workflows), selo "Vista legada" (Aprovações pendentes) |
| `Button` | Todas as ações; `disabledReason` sempre presente quando `disabled` |
| `Toggle` | O "Entendi" do import de Plano de contas (ver seção própria) |
| `EsqueletoDeTela` | `loading.tsx` de cada rota (ver "Os três estados") |
| `Icone` | Todo ícone, sempre via `de={LucideIcone}` |

**Composições novas (arquivos pequenos, sem token/estilo próprio):**

- `features/financeiro/componentes/estado-de-falha.tsx` — o terceiro estado
  (abaixo).
  `features/financeiro/componentes/botao-atualizar.tsx` — botão "Atualizar" +
  "Atualizado há…" (abaixo).
- `features/financeiro/componentes/filtro-de-empresa.tsx` — o `Select` de
  Empresa (abaixo).
- `features/financeiro/dados/usar-revalidar-ao-focar.ts` — o hook de
  `visibilitychange`/`focus` (abaixo).

---

## Os três estados (D4-15) — o contrato mais importante desta fase

O painel de hoje, quando o Supabase recusa, mostra lista vazia — isso já
custou confiança e a fase inteira existe, entre outras coisas, para que isso
pare de acontecer. As oito telas do Financeiro distinguem **sempre** três
estados visualmente diferentes, nunca dois:

### 1 · Carregando

Um `loading.tsx` por segmento de rota (convenção nativa do App Router — não
precisa de `useState`/spinner manual), renderizando a forma exata do que vem,
igual ao resto do produto:

| Rota | `Forma` (`design/esqueletos.tsx`) |
|---|---|
| `/financeiro` | `"painel"` (grid de tiles + dois painéis — é literalmente a forma do Dashboard) |
| `/financeiro/notas-fiscais` | `"tabela"` |
| `/financeiro/produtos` | `"tabela"` |
| `/financeiro/plano-contas` | `"tabela"` |
| `/financeiro/extratos` | `"formulario"` |
| `/financeiro/workflows` | `"tabela"` |
| `/financeiro/problemas` | `"tabela"` |
| `/financeiro/aprovacoes-pendentes` | `"tabela"` |

```tsx
// app/(shell)/financeiro/notas-fiscais/loading.tsx
import { EsqueletoDeTela } from "@/design/esqueletos";
export default function Carregando() {
  return <EsqueletoDeTela forma="tabela" />;
}
```

Não é preciso tocar `features/shell/rotas.ts`/`formaDe()` — aquele mecanismo
cobre só o flash de pré-hidratação do estado de domínio (`GET /estado`), que é
um caminho de dado totalmente separado do Financeiro (D4-06: a leitura do
Financeiro nunca entra no `DataState`). Como melhoria opcional, sem
consequência se não for feita: duas linhas em `formaDe()`
(`/financeiro` → `"painel"`, `/financeiro/extratos` → `"formulario"`) deixam
esse flash de meio-segundo consistente também — hoje ele cairia no padrão
`"tabela"`, o que já é aceitável para as outras seis rotas.

### 2 · Vazio (a leitura respondeu, não há linha)

`EmptyState` — nunca a mesma coisa que "falha". Copy por tela na tabela de
Copywriting, abaixo. Regra geral: título diz o que é, `hint` diz o próximo
passo ou por que está vazio (nunca uma frase em branco).

### 3 · Falha (a leitura NÃO respondeu — rede, timeout, 5xx do `automation/`)

Este é o estado que não existe hoje e que esta fase precisa que exista sempre.
Componente novo por composição, `features/financeiro/componentes/estado-de-falha.tsx`,
usado no lugar do corpo da tela (nunca junto de uma tabela vazia — ou é isto,
ou é `EmptyState`, nunca os dois ao mesmo tempo):

```tsx
"use client";
import { AlertTriangle } from "lucide-react";
import { Button, Icone, Painel } from "@/features/shell/ui";

export function EstadoDeFalha({ aoTentarDeNovo }: { readonly aoTentarDeNovo: () => void }) {
  return (
    <Painel solido className="flex flex-col items-center gap-3 p-8 text-center">
      <Icone de={AlertTriangle} tamanho="lg" style={{ color: "var(--erro)" }} />
      <p className="app-md" style={{ color: "var(--texto)" }}>
        Não consegui falar com o backend financeiro.
      </p>
      <p className="app-meta" style={{ maxWidth: "28rem" }}>
        A leitura não respondeu — pode ser instabilidade de rede ou o serviço
        fora do ar. Tente atualizar; se continuar falhando, avise o time
        técnico.
      </p>
      <Button variant="secondary" onClick={aoTentarDeNovo}>Atualizar</Button>
    </Painel>
  );
}
```

Difere de `NoAccessState` (cadeado, "sem acesso", 403 — o Membro não tem
permissão) e de `EmptyState` (ícone neutro `--texto-4`, "não há dados" — a
leitura funcionou e a tabela é mesmo pequena). `EstadoDeFalha` usa o ícone de
alerta na cor `--erro`, porque é a única das três situações em que algo deu
errado de verdade. O texto ecoa deliberadamente o card "Servidor
indisponível" que `app/(shell)/layout.tsx` já usa para a falha do domínio
inteiro (`carregarEstadoInicial`) — mesma voz, escopo menor (uma leitura, não
o app inteiro).

**Como a página decide qual dos três estados mostrar** (Server Component,
Padrão 3 da pesquisa): a função de fetch devolve uma união
`{ tipo: "ok"; linhas: T[] } | { tipo: "vazio" } | { tipo: "falha"; erro: string }`
— nunca um `try/catch` que engole o erro e cai serenamente para `[]`. Isso é
o bug que esta fase fecha: um `catch` que devolve array vazio é
indistinguível de "não há notas fiscais hoje", e é exatamente o que o painel
antigo fazia.

---

## Atualização manual e "atualizado há" (D4-15)

Sem Realtime, sem cache — recarregar é sempre um gesto explícito ou um
retorno de foco à aba, nunca automático em intervalo. Dois elementos, sempre
juntos, no `actions` do `PageHeader` de cada uma das oito telas:

```tsx
<span className="flex items-center gap-2">
  {/* ação primária da tela, se houver, primeiro */}
  <span className="app-meta app-numero" style={{ color: "var(--texto-4)" }}>
    Atualizado {fmt.relative(atualizadoEm)}
  </span>
  <Button variant="ghost" size="sm" icon={<Icone de={RefreshCw} tamanho="xs" />} onClick={atualizar}>
    Atualizar
  </Button>
</span>
```

- `atualizadoEm` é o instante em que o Server Component rodou (calculado no
  próprio fetch, que já é `cache: "no-store"` seguindo `estado-inicial.ts`) —
  não precisa de estado de cliente para existir, só de ser passado como prop.
- `atualizar` chama `router.refresh()` (App Router) — reexecuta o Server
  Component, refaz o fetch, não perde posição de scroll nem estado de filtro
  local (os filtros ficam em estado de cliente, não na URL, nesta fase).
- **Revalidação ao focar a aba**: `features/financeiro/dados/usar-revalidar-ao-focar.ts`,
  um hook de ~10 linhas que assina `visibilitychange`/`window.onfocus` e chama
  `router.refresh()` — cada `page.tsx` client wrapper chama esse hook uma vez.
  Não é Realtime (nada empurra dado): é o mesmo gesto do botão, só que
  automático quando a pessoa volta para a aba.

---

## Filtro de Empresa (D4-09)

**Confirmado pela pesquisa em uma das oito telas: Plano de contas.**
`conciliador_contas` é filtrada por `metadata @> {empresa, tipo}`, com
allowlist fixa de 6 Empresas × `pagar`/`receber`. É o único lugar em que este
documento pode garantir a dimensão de dado — as demais tabelas
(`transacoes`, `solicitacoes_pagamentos`) não têm coluna de Empresa
confirmada no inventário lido nesta pesquisa. Onde o dado existir de fato
(confirmação é trabalho de implementação, não deste documento), a mesma peça
reusa-se sem variação visual.

```tsx
// features/financeiro/componentes/filtro-de-empresa.tsx
const EMPRESAS = [
  { value: "", label: "Todas as Empresas" },
  { value: "tria-1", label: "…" }, // as 6 — nomes exatos vêm do de-para real, não inventados aqui
  // …
] as const;

<Select value={empresa} onChange={setEmpresa} options={EMPRESAS} placeholder="Empresa" size="sm" />
```

- Vive dentro de `BarraDeFiltros`, ao lado dos demais filtros — nunca no
  cabeçalho, nunca fora da faixa de filtros.
- É **parâmetro de consulta** (`?empresa=`), lido/escrito com
  `useSearchParams`/`router.replace` (mesmo padrão de `?aprovar=` em
  `/ia/aprovacoes`) — compartilhável por link, sobrevive a um F5. Nunca marca
  navegação (`marcarSeMuda`) — é filtro, não troca de tela.
- **Não é o `EmpresaSwitcher` de hoje.** Não muda tema, não muda sessão, não
  aparece na casca (trilho/painel) — só dentro do corpo da tela de Plano de
  contas. D4-09 é explícito: modelar Empresa como contexto global de tenant é
  TEN-01 (Phase 5); antecipar isso aqui seria mudar de modelo, não portar
  leitura.
- Placeholder/label: **"Empresa"**, opção default **"Todas as Empresas"** (o
  filtro começa aberto, nunca escondendo dado por padrão).

---

## Especificação por tela

Convenção comum às oito, não repetida em cada bloco: `PageHeader` com
`title` exato da lista abaixo, `actions` sempre traz o par
Atualizar/Atualizado-há (seção própria) mais a CTA primária da tela quando
houver; `CorpoDeTela` é o único bloco que rola; os três estados (carregando/
vazio/falha) descritos acima valem em todas.

### 1 · Dashboard (`/financeiro`)

**Título:** "Financeiro" · **Ícone do cabeçalho:** nenhum (`icon` do
`PageHeader` vazio — é a raiz do assunto, o trilho já mostra `Wallet`).

Layout, de cima para baixo dentro de `CorpoDeTela`:

1. Grid de 4 tiles de métrica — `grid grid-cols-2 gap-4 xl:grid-cols-4`, cada
   tile é um `Painel` (`p-4`) com: rótulo (`.ed-secao`, `--texto-3`), número
   grande (`.ed-titulo` + `.app-numero`, `--texto`), sem gráfico, sem cor de
   severidade nas 4 (são neutras — total, aguardando aprovação, contas a
   pagar, aprovadas não competem entre si por atenção).
2. `Section title="Precisa da sua atenção" count={N}` (até 3 itens, per
   research) — lista de `li.item-solto[data-estatico]` (mesmo padrão de
   `renderProcessCard` em `/ia/aprovacoes`): título, `Pilula` de severidade,
   meta de idade (`fmt.relative`). **Não clica** — não há tela de detalhe
   para essas linhas (dado não modelado na ontologia, DEC-16).
3. `Section title="Problemas abertos" count={N}` (até 2 itens) — mesma forma
   do item 2, com o texto do "problema" em vez do título da solicitação.

Nenhuma das duas seções tem link "ver todos" nesta versão — Problemas já é
tela própria (`/financeiro/problemas`), acessível pelo trilho; duplicar o link
aqui é decoração sem função nova.

### 2 · Notas fiscais (`/financeiro/notas-fiscais`)

**Título:** "Notas fiscais" · **CTA primária no `actions`:** os dois botões de
lote (ver "Ações em lote" abaixo) · **`meta`:** `"{N} de 1.987"` no formato de
`ContatosPage`.

**Filtros (`BarraDeFiltros`):** `TextInput` busca (nome/id do pedido, sem
label visível — `placeholder="Buscar por pedido ou cliente"`, com `aria-label`
próprio já que não usa `Field`), `Select` Status do pedido, `Select`
Plataforma, `Select` Forma de pagamento. Todos client-side sobre o array já
carregado inteiro — ver "Paginação" abaixo.

**Colunas (`RecordList`):**

| Coluna | Origem | Render |
|---|---|---|
| Pedido | `id_pedido` | `.app-numero` |
| Cliente | `nome_completo` | texto simples |
| Produto(s) | `produtos` | truncado |
| Valor | `valor_total` | `fmt.money`, alinhado à direita, `.app-numero` |
| Pagamento | `forma_pagamento` | texto |
| Status | `status_pedido` | `Pilula` — ver mapeamento de tom abaixo |
| Emissão | `controle_emissao` / `emissao_nota_produto` / `emissao_nota_servico` | três `Icone de={CheckCircle2}` compactos lado a lado, cinza quando falso e `--sucesso` quando verdadeiro, com `title` dizendo qual é qual (Produto/Serviço/Controle) |
| 7 dias | `"7 dias"` | `Pilula tom="aviso"` só quando verdadeiro, célula vazia quando falso |
| Aprovado em | `data_aprovacao_pagamento` | `fmt.instant` |

**Mapeamento de tom de `status_pedido`** (a confirmar contra os valores reais
da integração — o inventário lido nesta pesquisa não enumerou o enum exato):
aprovado/pago → `sucesso`; aguardando/pendente → `aviso`;
cancelado/reembolsado/estornado → `erro`; qualquer outro valor → `neutro`
(nunca "quebra": um status desconhecido sempre cai em neutro, nunca em
branco).

**Nenhuma célula é link** — como não há tela de detalhe de pedido nas oito
telas de TELA-01, `RecordList` é usado sem `hrefOf`.

**Ações em lote (D4-12):** dois botões no `actions` do `PageHeader`, cada um
seu próprio `ConfirmDialog`:

- **"Marcar 7 dias"** → `ConfirmDialog` `title="Marcar pedidos com 7 dias"`
  `description="Marca todos os pedidos elegíveis para o prazo de 7 dias de
  emissão. A lista atualiza sozinha quando terminar; não há como desfazer
  marca por marca."` `confirmLabel="Marcar"` `destructive={false}`.
- **"Emitir notas pendentes"** → `ConfirmDialog`
  `title="Emitir as notas fiscais pendentes"`
  `description="Dispara a emissão de nota de produto e de serviço para todos
  os pedidos pendentes agora. É a mesma rotina que roda sozinha todo dia —
  disparar de novo não duplica nota já emitida, mas processa em lote e pode
  levar alguns minutos."` `confirmLabel="Emitir agora"` `destructive={false}`.

**Depois de confirmar:** a chamada é assíncrona no `automation/`
(`202 Accepted`, execução em segundo plano — `workflow-routes.ts`, D4-12). A
tela nunca finge saber o resultado na hora: fecha o diálogo e mostra
`Toast tone="neutral"` com `children="Execução iniciada. Isto pode levar
alguns instantes."` e `acao={<Button variant="ghost" size="sm"
onClick={atualizar}>Atualizar agora</Button>}` — o "resultado renderizado"
que D4-12 pede é a própria tabela mudando (`controle_emissao`,
`emissao_nota_produto`, `emissao_nota_servico`, `"7 dias"`) quando a pessoa
atualiza, não um relatório separado.

### 3 · Produtos (`/financeiro/produtos`)

**Título:** "Produtos" · **`meta`:** `"{N} de 42"`. Sem filtro (42 linhas não
precisam).

**Colunas:**

| Coluna | Origem | Render |
|---|---|---|
| Produto | `id_produto` + `nome_produto` | `id_produto` em `.app-meta`, `nome_produto` em `.app-base` abaixo |
| % Serviço | `porcentagem_servico` | `TextInput` inline editável — ver abaixo |
| % Produto | `porcentagem_produto` | `TextInput` inline editável — ver abaixo |

**Edição inline das duas alíquotas** — a única escrita simples desta tela
(D4-07):

```tsx
<TextInput
  size="sm"
  type="number"
  value={valorLocal}
  onChange={setValorLocal}
  disabled={salvando}
  disabledReason="Salvando…"
/>
```

- Grava **no blur**, nunca a cada tecla — evita uma chamada por dígito.
- Enquanto salva: campo com `disabled` + `disabledReason="Salvando…"` (regra
  §11 do sistema: controle desligado sempre diz por quê — já embutida em
  `TextInput`/`Button`).
- Sucesso: `Toast tone="success"` breve ("Alíquota atualizada."), campo volta
  a editável.
- Falha: `Toast tone="error"` com o motivo devolvido pela API, campo **volta
  ao último valor confirmado** (nunca fica com o valor que falhou parado na
  tela — isso pareceria salvo).
- Nenhuma confirmação para esta edição: é uma alíquota, reversível, de baixo
  risco — `ConfirmDialog` aqui seria fricção sem função (compare com Plano de
  contas, onde a confirmação existe porque a consequência é outra: o Agente).

### 4 · Plano de contas (`/financeiro/plano-contas`)

**Título:** "Plano de contas" · **`meta`:** `"{N} de 276"` · **CTA primária:**
"Importar CSV".

**Filtros (`BarraDeFiltros`):** `FiltroDeEmpresa` (seção própria acima) +
`Select` Tipo (`pagar` / `receber`, placeholder "Todos os tipos").

**Colunas:** `id` (`.app-meta`), `Conteúdo` (o `content` já formatado —
código, categoria, categoria do ClickUp, descrição, cada pedaço num
`<span className="app-meta">` empilhado dentro da célula, não um bloco de
texto corrido), e uma coluna de ação (`ActionMenu` com um único item
"Remover").

**Remover por id:** `ActionMenu` → item `destructive` → `ConfirmDialog`
`title="Remover esta linha do Plano de contas"`
`description="A linha some do que o Agente consulta para classificar a
próxima conta a pagar. Não é um Status arquivado — é remoção de verdade."`
`confirmLabel="Remover"` `destructive={true}`.

**Import — a confirmação que precisa dizer a verdade (D4-10).** Esta tabela é
a que `matchCategory` do Agente lê de verdade (`conciliador_contas`, não a
`planos_de_contas` vazia). Um import muda o que o Agente classifica no
próximo lançamento — a confirmação **afirma isso**, não nega:

```tsx
const [entendi, setEntendi] = useState(false);
const labelId = useId();

<ConfirmDialog
  open={importando}
  wide
  title={`Importar ${linhas.length} linha(s) para o Plano de contas`}
  description="Esta tabela é a mesma que o Agente consulta para classificar a próxima conta a pagar. Depois de importar, a classificação automática do próximo lançamento pode mudar."
  confirmLabel="Importar e mudar a classificação"
  cancelLabel="Cancelar"
  confirmDisabledReason={!entendi ? "Confirme que leu o aviso acima para importar." : undefined}
  onConfirm={importar}
  onCancel={fecharImportacao}
>
  {/* pré-visualização das N linhas aqui */}
  <div className="mt-4 flex items-center gap-2">
    <Toggle checked={entendi} onChange={setEntendi} labelledBy={labelId} />
    <span id={labelId} className="app-base">
      Entendi que isto muda a classificação que o Agente usa no próximo lançamento.
    </span>
  </div>
</ConfirmDialog>
```

O botão de confirmar só libera depois do `Toggle` — é o "passo de
confirmação" que D4-10 exige, sem inventar um componente novo (reusa
`Toggle`, já exportado pelo barril). **Nunca** escrever no diálogo algo como
"isto não é o que o Agente lê" — seria falso; o texto acima é deliberadamente
a afirmação oposta.

**Formato de arquivo (D4-10b):** só `.csv` nesta fase —
`<input type="file" accept=".csv" />` dentro do mesmo padrão de zona de
arraste de `UploadDeArquivos` (`features/formulario-publico/upload-de-arquivos.tsx`),
simplificado para um arquivo só. Texto de ajuda abaixo do campo:
`"Arquivo .csv apenas — importação de planilha (.xlsx) ainda não está
disponível nesta tela."` `.xlsx` fica de fora por decisão travada da pesquisa
(CVE-2023-30533 sem correção publicada no npm) — não é lacuna de UI, é
escopo.

### 5 · Extratos do Marcos (`/financeiro/extratos`)

**Título:** "Extratos do Marcos". Sem `meta` (não há contagem — é formulário
de envio, não lista).

Layout: um `Field label="Origem"` com `Select` das 7 origens (rótulos em
pt-BR, valores técnicos preservados):

| Valor técnico | Rótulo na tela |
|---|---|
| `nubank` | Nubank |
| `itau_unibanco` | Itaú Unibanco |
| `btg_pactual` | BTG Pactual |
| `btg_cartao` | BTG Cartão |
| `nubank_violeta` | Nubank Violeta |
| `personallite_black` | PersonalLite Black |
| `azul_infinity` | Azul Infinity |

Abaixo, a zona de upload — mesma linguagem visual de
`features/formulario-publico/upload-de-arquivos.tsx` (moldura tracejada,
`Icone de={Paperclip}`, botão "Adicionar arquivo", lista com progresso),
**simplificada**: um arquivo por vez, sem sessão em duas fases (o upload
público sobe direto ao bucket com ticket assinado; aqui o arquivo vai por
`POST /financeiro/extratos` no `apps/api`, que repassa ao `automation/` —
D4-13). O campo de arquivo fica **desabilitado** até uma Origem ser
escolhida, com `disabledReason="Escolha a Origem antes de anexar o
extrato."`.

Estados do upload (mesmo vocabulário de `StatusDeArquivo`, reaproveitado):
aguardando → enviando (barra de progresso via `XMLHttpRequest.upload.onprogress`,
já que o envio agora é só até o `apps/api`, não até um Storage externo) →
enviado (`Icone de={CheckCircle2}`, `--sucesso`, texto "Extrato enviado.") ou
falhou (texto em `--erro` + "Tentar novamente").

**Sem tela de leitura de volta** — o inventário confirma que `financas_mp`
nunca é lida nesta tela; é só formulário. Depois de um envio bem-sucedido o
formulário limpa (Origem volta a vazio, lista de arquivo esvazia) para o
próximo extrato.

### 6 · Workflows (`/financeiro/workflows`)

**Título:** "Workflows" · **`meta`:** contagem do catálogo (fixo, pequeno).

Duas seções:

1. **`Section title="Catálogo"`** — um `Painel` por Workflow (`SYSTEM_WORKFLOWS`,
   lista curta e fixa), cada um com: nome (`.app-md`), descrição
   (`.app-meta`), `Pilula` do tenant, `Pilula cor="var(--cor-exe-*)"` do
   último status conhecido, e — só quando `manualRunKey` existir — botão
   "Executar agora".
   - `ConfirmDialog` de execução manual: `title="Executar {nome} agora"`
     `description="Roda a mesma rotina que executa sozinha na agenda. Não
     interrompe nem duplica uma execução já em andamento."`
     `confirmLabel="Executar"` `destructive={false}`.
   - Mesma UX de resultado assíncrono de Notas fiscais (Toast neutro +
     "Atualizar agora").
2. **`Section title="Histórico de execuções" count={N}`** — `RecordList`
   (236 linhas) com colunas: Workflow (key/nome), Início (`fmt.instant`),
   Fim (`fmt.instant`, "—" se ainda em andamento), Status
   (`Pilula cor="var(--cor-exe-*)"`, o vocabulário de Execução já existente).

### 7 · Problemas (`/financeiro/problemas`)

**Título:** "Problemas" · **`meta`:** contagem de abertos.

`RecordList`, colunas: Severidade (`Pilula`, tom por mapeamento
alta→`erro`/média→`aviso`/baixa→`neutro`), Id (`SP-<id>`, `.app-meta`),
Título/descrição (`.app-base`, a descrição truncada — o texto completo vem
de `comentario_aprovacao`/`comentario` já formatado pelo `automation/`, D4-06),
Onde (categoria + fornecedor), Idade (`fmt.relative` sobre a previsão).

O campo técnico (`TaskID`/categoria/tipo) não vira coluna própria — é
detalhe de depuração, não algo que o Financeiro lê no dia a dia. Fica atrás
de um `ActionMenu` de item único, "Ver detalhes técnicos", que abre um
`SidePanel` pequeno (`RecordPanel`/`RecordRow`, rótulo→valor) com os três
campos técnicos.

### 8 · Aprovações pendentes (`/financeiro/aprovacoes-pendentes`)

**Título:** "Aprovações pendentes" · **`seal`:**
`<Pilula tom="neutro" contorno>Vista legada</Pilula>` — colado ao título,
sempre visível, nunca condicional. **`details`:**

> "Lista somente leitura: reflete o campo `Aprovado` da base antiga. Quem
> decide aprovações hoje é a fila viva —
> [Ir para Aprovações](/ia/aprovacoes)."

O link usa o `Link` do Next, sublinhado, cor `--acento` (é link, não botão —
acento aqui é exceção legítima da lista fechada de Cor, porque é navegação,
não decoração).

`RecordList` sem `hrefOf` (nenhuma linha clica) e **sem coluna de ação
nenhuma** — nenhum `ActionMenu`, nenhum botão "decidir": D4-11 proíbe um
segundo botão de aprovar sobre esta tabela. Colunas: Id (`SP-<id>`),
Fornecedor, Status, Previsão (`fmt.relative`).

Quando a lista esvaziar (o desenho pretendido — D4-11: "esvazia sozinha com
o tempo"), o `EmptyState` não trata isso como uma falha nem como uma
curiosidade: "Nenhuma solicitação pendente nesta vista legada." /
"Ela esvazia com o tempo à medida que o pipeline antigo se encerra. Decisões
acontecem em Aprovações." (com o mesmo link para `/ia/aprovacoes`).

---

## Paginação (Open Question 3 da pesquisa — resolvida)

**Client-side, reusando `RecordList` tal como está.** `RecordList` já
implementa "Mostrar mais" com `PAGE_SIZE = 25` fixo no componente — esta fase
não estende nem parametriza esse número. Cada rota de `/financeiro/*`
devolve o array inteiro já projetado (D4-05: são campos allowlisted, não
dado sensível) numa única resposta; filtro de texto e os `Select` de Notas
fiscais/Plano de contas operam em memória sobre esse array já carregado. Para
as maiores das oito (Notas fiscais, ~1.987; Plano de contas, ~276) o payload
projetado é pequeno o bastante para isso ser aceitável nesta fase — a
pesquisa já registra que paginação por cursor no servidor não existe hoje em
nenhuma rota do `automation/` e criar uma seria escopo novo, não port. Se a
latência medida depois do corte (D4-16) mostrar que isso dói, é o gatilho
para revisar — não uma decisão a antecipar aqui.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA — Plano de contas | "Importar CSV" |
| Primary CTA — Extratos | "Fazer upload" (botão dentro da zona de arraste: "Adicionar arquivo") |
| Primary CTA — Workflows (por item do catálogo) | "Executar agora" |
| Primary CTA — Notas fiscais (lote) | "Marcar 7 dias" · "Emitir notas pendentes" |
| Empty state — Notas fiscais | "Nenhuma nota fiscal encontrada." / "Ajuste os filtros ou tente outro termo de busca." |
| Empty state — Produtos | "Nenhum produto cadastrado." / "Produtos aparecem aqui quando cadastrados na emissão de notas." |
| Empty state — Plano de contas | "Nenhuma linha no Plano de contas." / "Importe um CSV para começar — é o que o Agente consulta para classificar contas a pagar." |
| Empty state — Workflows (histórico) | "Nenhuma execução registrada ainda." / "Execuções aparecem aqui quando a agenda roda ou alguém executa manualmente." |
| Empty state — Problemas | "Nenhum problema em aberto." / "Quando algo precisar de atenção, aparece aqui." |
| Empty state — Aprovações pendentes | "Nenhuma solicitação pendente nesta vista legada." / "Ela esvazia com o tempo à medida que o pipeline antigo se encerra. Decisões acontecem em Aprovações." |
| Empty state — Dashboard (seções) | "Nenhuma solicitação aguarda atenção." · "Nenhum problema em aberto." |
| Error state (falha de leitura, as oito) | "Não consegui falar com o backend financeiro." / "A leitura não respondeu — pode ser instabilidade de rede ou o serviço fora do ar. Tente atualizar; se continuar falhando, avise o time técnico." |
| No access (403) | "Financeiro · sem acesso" (via `NoAccessState what="Financeiro"`) |
| Destructive confirmation — Plano de contas, remover | "Remover esta linha do Plano de contas": "A linha some do que o Agente consulta para classificar a próxima conta a pagar. Não é um Status arquivado — é remoção de verdade." |
| Confirmation (não destrutiva, com fricção) — Plano de contas, importar | "Importar N linha(s) para o Plano de contas": "Esta tabela é a mesma que o Agente consulta para classificar a próxima conta a pagar. Depois de importar, a classificação automática do próximo lançamento pode mudar." + toggle "Entendi que isto muda a classificação que o Agente usa no próximo lançamento." |
| Confirmation — Notas fiscais, marcar 7 dias | "Marcar pedidos com 7 dias": "Marca todos os pedidos elegíveis para o prazo de 7 dias de emissão. A lista atualiza sozinha quando terminar; não há como desfazer marca por marca." |
| Confirmation — Notas fiscais, emitir | "Emitir as notas fiscais pendentes": "Dispara a emissão de nota de produto e de serviço para todos os pedidos pendentes agora. É a mesma rotina que roda sozinha todo dia — disparar de novo não duplica nota já emitida, mas processa em lote e pode levar alguns minutos." |
| Confirmation — Workflows, executar | "Executar {nome} agora": "Roda a mesma rotina que executa sozinha na agenda. Não interrompe nem duplica uma execução já em andamento." |
| Toast — ação em lote/execução disparada | "Execução iniciada. Isto pode levar alguns instantes." (com ação "Atualizar agora") |
| Toast — Produtos, alíquota salva | "Alíquota atualizada." |
| Vista legada (Aprovações pendentes) | Selo: "Vista legada" · Detalhe: "Lista somente leitura: reflete o campo Aprovado da base antiga. Quem decide aprovações hoje é a fila viva — Ir para Aprovações." |
| Filtro de Empresa | Placeholder "Empresa" · opção default "Todas as Empresas" |
| Botão de atualização manual | "Atualizar" · meta "Atualizado {há X}" |
| Extratos — arquivo desabilitado sem origem | "Escolha a Origem antes de anexar o extrato." |
| Extratos — formato aceito | ajuda do campo (padrão herdado de `UploadDeArquivos`, adaptado): "PDF, imagem ou planilha do extrato. Escolha a Origem antes de anexar." |
| Plano de contas — formato de import | "Arquivo .csv apenas — importação de planilha (.xlsx) ainda não está disponível nesta tela." |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | nenhum — projeto não usa shadcn | not applicable |
| third-party | nenhum | not applicable |

Não há registro de componentes nesta fase — o sistema de design é próprio e
fechado (`apps/web/src/design/`), sem instalação de blocos externos. A única
dependência nova candidata identificada pela pesquisa (`xlsx`/SheetJS, para
import `.xlsx` do Plano de contas) **não entra nesta fase** — D4-10b já
resolve isso restringindo o import a `.csv`; se `.xlsx` for pedido depois,
entra como `[BLOCKING] checkpoint:human-verify` próprio, fora deste UI-SPEC.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
