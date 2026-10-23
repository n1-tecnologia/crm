---
phase: "9"
slug: seguran-a-dos-dados-e-base-de-produ-o
status: approved
shadcn_initialized: false
preset: none
created: "2026-10-22"
---

# Phase 9 — UI Design Contract

> Contrato visual e de interação para a Phase 9 (Segurança dos dados e base de produção). Gerado por `gsd-ui-researcher` sem perguntas ao usuário (a execução não tinha canal para perguntar), a partir de 09-CONTEXT.md, 09-RESEARCH.md, dos planos 09-01, 09-08 e 09-16 lidos na íntegra, do 07-UI-SPEC.md (baseline) e do código de `apps/web` como está hoje.
>
> Convenção de procedência: `(D-NN)` = decisão travada de 09-CONTEXT.md; `(09-NN)` = string ou comportamento fixado por esse plano; `[auto]` = inferido pelo pesquisador, sem decisão do dono por trás — toda inferência que não vem de um plano está repetida em «Premissas e itens em aberto».

---

## Nota de escopo — leia antes do resto

Esta é uma fase de **segurança e base de produção**. Quase tudo é `apps/api`, `packages/dominio`, nginx, backup e Sentry. **Nenhuma tela nova, nenhum componente novo de `design/`, nenhuma mudança de token.** A superfície visual é pequena e consiste em manter as telas existentes coerentes com dados que o servidor deixou de mandar.

Planos que tocam `apps/web` (conferido por `grep -n "apps/web" 09-*-PLAN.md`; os outros 19 só citam arquivos web como leitura):

| Plano | Estado | Arquivos web | O que muda na interface |
|---|---|---|---|
| 09-01 | **executado** (`4540660`, `a8a683c`) | `ia/chat/[sessao]/page.tsx`, `configuracoes/membros/page.tsx` | A tela de Chat decide o acesso por `membroVeSessaoDeChat`; o diálogo de remover Membro diz «As Sessões de Chat deste Membro deixam de ser acessíveis.» sem número |
| 09-08 | a executar (wave 3) | 14 (link público, trilho, `ia/layout.tsx`, nome do Agente) | Superfícies S1 a S4 abaixo |
| 09-16 | a executar (wave 6) | 8 (`global-error.tsx`, instrumentação, `next.config.ts`) | Superfície S5 abaixo; o resto é código sem UI |

Efeitos visíveis que nascem **no domínio** (09-02, 09-03), sem tocar `apps/web`: `actorLabel` passa a devolver «Agente» / «Automação» quando o registro não está no estado (S4), um Membro `pendente` chega com `displayName` «Convite pendente» para quem não administra (S6) e as recusas novas de escrita do CRM antigo chegam como `ok: false` com frase do domínio (S7).

**Superfícies deste contrato**

| ID | Superfície | Origem |
|---|---|---|
| S1 | Link público (Tarefa `/p/`, Formulário `/f/`) para quem não administra a Lista | 09-08 Task 1 |
| S2 | Assunto «IA» no trilho: some para o Convidado | 09-08 Task 2, D-03 |
| S3 | `/ia/*` mostra «sem acesso» para o Convidado | 09-08 Task 2, D-03 |
| S4 | Nome do Agente / Automação quando a coleção não chega | 09-08 Task 3, 09-02, D-03 |
| S5 | Fronteira de erro global (`global-error.tsx`) | 09-16 Task 2, D-13 |
| S6 | Convite pendente na lista de Membros; diálogo de remover Membro | 09-02, 09-01 (já feito) |
| S7 | Recusas novas (escrita recusada a Convidado, Membro `suspenso`) | 09-03, 09-07 |

**Fora do escopo visual (não especificar, não inventar):** nginx, `limit_req`, cofre, backup, Evolution API, Sentry do lado do `apps/api`, migração `009`, homologação, `09-PENTEST.md`, suíte adversarial. O painel da Evolution e os painéis de Sentry/Supabase/bucket são de terceiros e não têm contrato aqui. Ideias adiadas de 09-CONTEXT.md (RLS, regra por registro de Documentos e Agentes, `Agent.memory`, as quatro coleções de IA restantes do Convidado) não geram UI.

---

## Design System

`[auto] derivado de 07-UI-SPEC.md` (herdado verbatim; nada em 09-CONTEXT.md o sobrepõe) e do código: `apps/web/components.json` não existe, então o gate shadcn **não se aplica** (o projeto tem sistema próprio, fixo neste monorepo; resposta herdada: não usar shadcn).

| Property | Value |
|----------|-------|
| Tool | none — sistema de design próprio (não shadcn) |
| Preset | não aplicável |
| Component library | `apps/web/src/design/` (`components.tsx`, `basicos.tsx`, `tela.tsx`, `esqueletos.tsx`, `icone.tsx`, `segmentos.tsx`), consumido pelo barril `@/features/shell/ui`; `PageHeader`/`Section`/`Card` do próprio barril |
| Icon library | `lucide-react`, sempre pelo envoltório `Icone` (traço 1.5; tamanhos `xs/sm/md/lg`) |
| Font | SF Pro Display (marca N1); Inter via `next/font` como reserva (`--font-sans`, declarada em `app/layout.tsx`) |

Regra de importação herdada: telas importam **só** de `@/features/shell/ui`. **Exceção desta fase (S5):** `global-error.tsx` **não** importa o barril nem `@/dados/store` — ver S5 e premissa A4.

---

## Component Inventory

Enumerated by `bash -c "grep -hE '^export (function|const) [A-Z]' apps/web/src/design/{components,basicos,tela,esqueletos,icone,segmentos}.tsx | wc -l"` — 43 exports de valor em `design/` — @n1/web@0.1.0 — 2026-10-22.
Enumerated by `bash -c "grep -hE '^export (function|const) [A-Z]' apps/web/src/features/shell/{ui,quadro,record-list}.tsx | wc -l"` — 10 exports de valor em `features/shell/` (`PageHeader`, `Section`, `Card`, `CategoryDot`, `SetaDeOrdem`, `ColunaDeQuadro`, `VazioDaColuna`, `RostoDeIcone`, `CartaoDeQuadro`, `RecordList`) — @n1/web@0.1.0 — 2026-10-22.

A versão vem de `node -p "require('./package.json').name+'@'+require('./package.json').version"` em `apps/web` (pacote interno do monorepo, sem versão publicada). A tabela é uma lista **não exaustiva** de componentes conhecidos; o executor pode usar qualquer export do barril. Os exports abaixo foram conferidos em `ui.tsx` e `components.tsx` hoje, não recordados.

| Componente | Import | Papel nesta fase |
|---|---|---|
| `NoAccessState` (`what`) | `@/features/shell/ui` | Renderiza «{what} · sem acesso» num `painel` com cadeado. Já usado em `ia/chat/[sessao]/page.tsx`, `moldura-de-leitura.tsx` (Financeiro) e `paineis/[painel]/page.tsx`. S3 |
| `PageHeader`, `CorpoDeTela` | `@/features/shell/ui` | Esqueleto de tela (`flex h-full flex-col`); S3 o reusa em volta do `NoAccessState` (premissa A1) |
| `Button` (`disabledReason`) | `@/features/shell/ui` | Botões das telas existentes; `disabledReason` obrigatório quando desabilitado (§11 de 07-UI-SPEC) |
| `ActionMenu` (item com `disabledReason`) | `@/features/shell/ui` | Item «Copiar link» do Formulário na página da Lista (S1) |
| `Painel`, `EmptyState`, `Icone` | `@/features/shell/ui` | **Só como referência de forma** para S5: `global-error.tsx` reproduz a mesma marcação com as classes, sem importá-los (A4). É o molde de `app/(publico)/p/[segredo]/page.tsx` |
| `ConfirmDialog` | `@/features/shell/ui` | Diálogo de remover Membro (S6); não editado além da linha já feita em 09-01 |
| `Toast` | `@/features/shell/ui` | Recusas do domínio (S7), pelo caminho que já existe; nenhuma copy nova |

---

## Spacing Scale

Declared values (múltiplos de 4; tokens `--e-*` de `apps/web/src/estilos/tokens.css`; nada literal fora de token — `npm run verificar:tokens` reprova cor crua, fonte literal e duração literal):

| Token | Value | Usage nesta fase |
|-------|-------|-------------------|
| xs | 4px (`--e-1`) | Não usado por código novo |
| sm | 8px (`--e-2`, `gap-2`) | Vão entre o parágrafo de S1 e o controle vizinho (revogar, abrir) |
| md | 16px (`--e-4`, `gap-4`, `p-4`) | Espaço entre o parágrafo de S1 e o campo seguinte no diálogo da Tarefa; entre ícone/título/dica do estado de erro de S5 |
| lg | 24px (`--e-6`, `p-6`) | Padding do painel de S5 (`p-6`, igual a `/p/` e `/f/`) |
| xl | 32px (`--e-8`) | Não usado |
| 2xl | 48px (`--e-12`) | Não usado |
| 3xl | 64px (`--e-16`) | Não usado |

Alvo de toque: botão de S5 usa `alvo-toque` (`--controle-h-lg`, 44px), como o botão «Tentar novamente» de `/p/`.

Exceptions: nenhuma declarada por esta fase. Valores internos de componentes existentes (`NoAccessState` usa `gap-3 px-4 py-3`; `EmptyState` usa `py-10`) são deles e **não** são redeclarados nem sobrescritos. S5 usa `max-w-lg` (herdado de `/p/`), nenhuma largura literal nova.

---

## Typography

`[auto] derivado de 07-UI-SPEC.md` (escalas do sistema em `estilos/tipografia.css`: classes `.app-*` e `.ed-*`; todo tamanho é uma classe). Tamanhos conferidos em `tokens.css` (piso de 13/14/15/16px conforme o degrau de tela).

| Role | Size (classe) | Weight | Line Height |
|------|------|--------|-------------|
| Body | `.app-base` — 13px piso (14/15/16 nos degraus) | 400 regular | `var(--app-base-lh)`, 1.25rem no piso (≈1.54×) |
| Label / Meta | `.app-meta` — 11px piso (12/13/14 nos degraus), cor `--texto-4` | 400 regular | `var(--app-xs-lh)`, 1rem no piso |
| Heading | `.app-md` — 14px piso (15/16/17 nos degraus); é o `title` do `EmptyState` | 500 (peso da própria classe) | `var(--app-md-lh)`, 1.25rem no piso |
| Display | não usado — nenhuma tela nova de nível de página | — | — |

**Três tamanhos, dois pesos: 400 (todo texto novo) e 500 (herdado das classes `.app-md` e `.btn`, sem texto novo escrito em outro peso).** O 600 do 07-UI-SPEC não é usado nesta fase porque nenhum título de cartão ou valor monetário entra. Nenhum `fontWeight` nem `text-[Npx]` arbitrário.

Uso por superfície: a frase de S1 e o parágrafo de apoio de S3 são `.app-base` em `--texto-3` (mesma cor de `NoAccessState` e do parágrafo de `ia/chat/[sessao]`); o rótulo «Agente» herda a classe da célula onde aparece; o `title` de S5 é `.app-md` e a dica `.app-meta`, ambos do `EmptyState`.

---

## Color

`[auto] derivado de 07-UI-SPEC.md`. Estrutura de `estilos/tokens.css`: preto quase puro segurando a página, lavagens de branco em alfa como superfície, roxo escasso como acento. **Nenhum hex novo, nenhum token novo** — todo valor é `var(--token)`.

| Role | Value | Usage nesta fase |
|------|-------|-------|
| Dominant (60%) | `--page` `#0f0f10` | Fundo de S5 (`grade-pontos` sobre `--page`); fundo das telas existentes |
| Secondary (30%) | `--superficie-1/2/3` (branco 3–5% alfa) e `--card` `#161617` | `painel` do `NoAccessState` (S3); `painel-solido` de S5 |
| Accent (10%) | `--acento` (roxo `#c084fc`) | **Nenhum uso novo.** Só o anel de foco do sistema |
| Destructive | `--erro` (`#fca5a5`) / `--cor-perigo-*` | **Nenhuma ação destrutiva nova.** O botão `danger` já existente do diálogo de remover Membro não muda |

Texto: `--texto-1` para o título do estado de erro, `--texto-3` para a frase de S1 e o parágrafo de S3, `--texto-4` para meta e o ícone de S5. Todos já são AA sobre `--page` no sistema.

**Accent reserved for:** (lista fechada nesta fase) o anel de foco do sistema. O botão de S5 é o `btn` neutro (contorno), igual ao «Tentar novamente» de `/p/`, e **não** o `btn-solido`; nenhuma frase de segurança usa roxo, vermelho nem amarelo — uma ausência de segredo é informação, não alerta nem erro (`[auto]`, premissa A3).

Cor nunca carrega sozinha o significado: S1, S3 e S5 são texto.

---

## Copywriting Contract

Idioma: português do Brasil, «você» implícito, sem gíria; substantivos de domínio com inicial maiúscula (Lista, Membro, Sessão de Chat, Agente, Papel). **Todas as frases abaixo são literais**: o executor não reescreve nem traduz; o teste de cada plano procura o texto exato.

### Strings fixadas

| Elemento | Copy exata | Onde | Fonte |
|---|---|---|---|
| Link público sem segredo (frase) | `Só quem administra a Lista vê o link.` | S1: diálogo de compartilhar Tarefa, `forms-editor`, e como `disabledReason` do item «Copiar link» da página da Lista; constante `SEM_LINK_PARA_QUEM_NAO_ADMINISTRA` | 09-08 T1, 09-CONTEXT (texto das telas) |
| Rótulo do item de menu desabilitado | `Copiar link` (rótulo atual, inalterado) com `disabledReason` = a frase acima | S1, página da Lista | 09-08 T1 |
| Área de IA bloqueada | `<NoAccessState what="a área de IA" />` → renderiza **«a área de IA · sem acesso»** | S3, `ia/layout.tsx`, para o Convidado, em toda rota `/ia/*` | 09-08 T2, D-03 |
| Sessão de Chat de outro Membro | «Sessão de Chat de outro Membro · sem acesso» (existente, não muda) | `ia/chat/[sessao]/page.tsx` | 09-01 (já no código) |
| Diálogo de remover Membro | `As Sessões de Chat deste Membro deixam de ser acessíveis.` (item de lista, sem número) | S6, `configuracoes/membros/page.tsx` linha 315 | 09-01 (já no código) |
| Membro pendente (quem não administra) | `Convite pendente` no lugar do e-mail em `displayName` | S6, qualquer lugar que mostre o nome do Membro | 09-02 T1 |
| Agente ausente do estado | `Agente` | S4: fio resolvido da Tarefa, coluna de responsáveis da Lista, `actorLabel` | 09-08 T3, 09-02 T2 |
| Automação ausente do estado | `Automação` | S4, `actorLabel` | 09-02 T2 |
| Com o registro presente | `<nome> (Agente)` / `<nome> (Automação)` (como hoje; nunca «Agente (Agente)») | S4 | 09-02 T2 |
| Erro global (título) | `Algo deu errado.` | S5, `title` do estado de erro | 09-16 T2 |
| Erro global (dica) | `O erro foi registrado.` | S5, `hint` | 09-16 T2 |
| Erro global (CTA) | `Tentar de novo` | S5, único botão | 09-16 T2 |

As duas frases de S5 do plano («Algo deu errado. O erro foi registrado.») ficam em dois elementos, cada frase intacta (premissa A5).

### Primary CTA, vazios, erros e destrutivo (template)

| Element | Copy |
|---------|------|
| Primary CTA | **Tentar de novo** (S5). É o único CTA da fase; a fase não cria botão de criar/salvar |
| Empty state heading | Nenhum estado vazio novo. A coluna de responsáveis e o fio da Tarefa não ficam vazios: usam «Agente» (S4). O «—» fica só quando não há resolvedor algum |
| Empty state body | não aplicável |
| Error state | S5: «Algo deu errado.» + «O erro foi registrado.» + «Tentar de novo». **Nunca** mostrar `error.message`, `error.digest`, nome de arquivo, stack nem URL (podem carregar segredo de `/f/` e `/p/`, T-09-82) |
| Destructive confirmation | Nenhuma ação destrutiva nova. O diálogo «remover Membro» continua como é (variante `danger` existente), com a única mudança da linha já aplicada em 09-01 |

### Recusas novas (S7) — sem copy nova

As recusas de 09-03 (Convidado em `trashContact`, `sendMessage`, `winDeal`, `restoreList`, `createReceivableSeries`, e o Membro `suspenso` pelo domínio) chegam como `OperationResult` `ok: false` com a frase escrita pelo domínio. **Regra herdada de 05/07: a tela mostra a frase literal pelo caminho de recusa que já existe (`Toast tone="error"`, não expira), nunca reescrita.** Esta fase não escreve frase de recusa na interface.

O 403 de Membro `suspenso` em `POST /operacoes` (09-07) é falha de transporte para o store (`transporte.ts`: «Rede, 401/403/404/500 — falha de transporte, não recusa de domínio»). Nenhum plano toca `apps/web` para ele, então **o comportamento visual é o que o store faz hoje com um 403** — item em aberto I1.

---

## Layout and Interaction Contract

### S1 — Link público para quem não administra a Lista (09-08 Task 1)

Contexto: depois de 09-02, o servidor manda `publicShare.secret === ""` e `Form.secret === ""` a quem não administra a Lista (a chave fica, o valor some). A interface nunca monta `/f/` ou `/p/` sem segredo.

Regra pura: `linkVisivel(segredo)` é verdadeiro só para string não vazia. Onde é falso, **o parágrafo substitui o link e o botão de copiar** (não os acompanha):

| Tela | Com segredo (como hoje) | Sem segredo (`""`) |
|---|---|---|
| `share-task-dialog.tsx` (link ativo) | Campo do link `/p/<segredo>` + botão de copiar | `<p class="app-base">` em `--texto-3` com «Só quem administra a Lista vê o link.»; **sem** campo, **sem** botão de copiar; nenhum texto do DOM contém `/p/`. A revogação segue `revogarRecusado` (não muda) |
| `forms-editor.tsx` | `<a href="/f/<segredo>">` + «Copiar link» | O mesmo parágrafo no lugar de ambos; nenhum `a` com `href` iniciado por `/f/`; **«Copiar link» não é renderizado** (o parágrafo já diz o motivo; botão desabilitado repetiria a frase, premissa A2) |
| `estrutura/listas/[lista]/page.tsx`, botão que abre o Formulário | Botão que abre `/f/<segredo>` | **Não é renderizado** (`linkVisivel(...)` falso) |
| `estrutura/listas/[lista]/page.tsx`, item de menu «Copiar link» | Item ativo | Item **desabilitado** com `disabledReason: SEM_LINK_PARA_QUEM_NAO_ADMINISTRA`, no padrão `disabledReason` já usado na página |

Foco e leitura: o parágrafo é texto estático (`<p>`, sem `role="alert"` nem `aria-live`: não é erro nem aviso). O item de menu desabilitado fica focável (comportamento do `ActionMenu`: `aria-disabled` e motivo anunciado). O parágrafo quebra linha e **nunca** é truncado (a frase tem que ser lida inteira).

### S2 — Assunto «IA» no trilho (09-08 Task 2, D-03)

- Para o Convidado (Papel base `convidado`, mesma leitura de `isGuest`), o item «IA» **não é renderizado**: não aparece desabilitado, esmaecido nem com cadeado — o mesmo mecanismo do Financeiro (`assuntosVisiveis` + função pura, no molde de `vePastaFinanceiro`).
- Regra: `veAssuntoIa(estado, memberId)` é falsa **só** para o Convidado. `memberId` nulo (antes de a sessão resolver) → verdadeira: nada some à toa, a barreira real é o servidor (D-02).
- O trilho com um item a menos não reordena nem renomeia os demais. Nenhum espaço reservado onde o item estava.
- Para os outros Papéis o trilho é idêntico ao de hoje.

### S3 — `/ia/*` mostra «sem acesso» para o Convidado (09-08 Task 2, D-03)

- `app/(shell)/ia/layout.tsx` (Client Component): para o Convidado, **em qualquer rota `/ia/*`** (lista, Agente, Automação, Chat, Aprovações…), renderiza `NoAccessState what="a área de IA"` no lugar das páginas filhas, que **não são montadas**. Para os demais Papéis renderiza `children` sem envoltório extra.
- **Moldura da tela bloqueada** (`[auto]`, premissa A1): o mesmo esqueleto de `ia/chat/[sessao]/page.tsx` quando bloqueia — `<div className="flex h-full flex-col">` com `<PageHeader title="IA" />` e `<CorpoDeTela>` contendo o `NoAccessState`. Sem isso, o painel ficaria solto no topo da área de conteúdo, sem título e sem a barra de 44px que toda tela tem.
- Sem botão, sem link, sem «Falar com um administrador»: não há destino de ação para o Convidado (D-03: a Sessão 12 pode reabrir).
- É cosmético: a barreira real é o servidor não mandar `agents`, `automations`, `documents`, `collections`, `skills` (D-02).
- A página de Chat aberta pela URL por um Convidado vê **só** o layout (S3), não a tela «Sessão de Chat de outro Membro» (que continua valendo para um Membro não-Convidado diante de Sessão alheia, 09-01).

### S4 — Nome do Agente / Automação sem a coleção (09-08 Task 3, 09-02, D-03)

O Convidado (a Pessoa da conta) vê Tarefas em que um Agente ou Automação agiu; `agents` e `automations` chegam `[]`.

| Onde | Antes | Contrato |
|---|---|---|
| `task-editors.tsx`, os dois «Fio resolvido por …» | `?? "—"` | `nomeDoAgente(estado, id)` quando o resolvedor não é Membro: o nome, ou «Agente» se o registro não está no estado. O «—» fica **só** quando não há resolvedor |
| `estrutura/listas/[lista]/page.tsx`, coluna de responsáveis | o Agente some (`.filter(Boolean)`) | `nomeDoAgente(state, assignee.id)`; o Agente **nunca** some do texto |
| `actorLabel` (timeline, ficha, auditoria) | «Agente (Agente)» / «Automação (Automação)» | «Agente» / «Automação» sem o registro; `<nome> (Agente)` com o registro |

- Tipografia, cor, avatar e truncamento são os da célula ou linha onde o nome aparece; **nenhum estilo novo** para o rótulo genérico (não é cinza, não é itálico, não ganha cadeado).
- Nenhuma tela pede a coleção de volta ao servidor (T-09-43).

### S5 — Fronteira de erro global (09-16 Task 2, D-13)

`apps/web/src/app/global-error.tsx` (Client Component). Hoje não existe `error.tsx` nem `global-error.tsx`: um erro de render some. Ele substitui o root layout enquanto ativo, então **traz o próprio documento**.

Estrutura (molde: estado de falha de `app/(publico)/p/[segredo]/page.tsx`, reproduzido sem importar o barril — A4):

```
<html lang="pt-BR">
  <body className="min-h-full">
    <title>Algo deu errado · N1 Digital</title>
    <main className="grade-pontos flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="painel-solido p-6">
          <div className="estado-vazio flex flex-col items-center justify-center gap-2 py-10 text-center">
            ícone de alerta (lucide, via marcação do Icone), aria-hidden
            <p className="app-md">Algo deu errado.</p>
            <p className="app-meta">O erro foi registrado.</p>
            <div className="mt-2"><button type="button" className="btn alvo-toque">Tentar de novo</button></div>
          </div>
        </div>
      </div>
    </main>
  </body>
</html>
```

- **Estilo:** `import "./globals.css"` dentro do próprio arquivo — os guias do Next 16 dizem que o `global-error` não herda estilos globais nem fontes (`error.md`: «must define its own `<html>` and `<body>` tags, global styles, fonts»). Sem a importação, `var(--page)` e as classes não existem. Conferir com `npm run build -w @n1/web`.
- **Fonte:** não reproduz `next/font` (as variáveis `--font-sans`/`--font-mono` são de `app/layout.tsx`); cai na pilha de sistema de `tokens.css` (SF Pro nos aparelhos Apple). Aceito (A4).
- **Ícone:** `lucide-react` `TriangleAlert`, `tamanho` equivalente a `lg`, cor `--texto-4` (como o `EmptyState`), `aria-hidden`.
- **Comportamento:** `useEffect(() => { Sentry.captureException(error) }, [error])`, uma vez. O botão chama a função de nova tentativa que o guia da versão instalada define (`retry`; `reset` só se o guia da 16.3.4 não trouxer `retry` — A9). Sem estado de carregando (o clique descarta a fronteira e re-renderiza).
- **Proibido renderizar:** `error.message`, `error.digest`, stack, URL, nome de rota. A frase é fixa.
- **Acessibilidade:** `lang="pt-BR"`, um `main`, o título como `p` (a tela é uma fronteira, não uma página navegável); o botão recebe o foco visível do sistema; alvo ≥ 44px.
- Sem acento roxo, sem `btn-solido` (premissa A3).

### S6 — Convite pendente e diálogo de remover Membro

- **`displayName` «Convite pendente»** para quem não é Administrador nem Proprietário: aparece onde o Membro `pendente` aparece hoje (lista de Membros, seletores de responsável/Proprietário). O texto é o mesmo estilo de qualquer nome; o `StateSeal`/`Pilula` «pendente» já existente continua. O e-mail do convite só aparece para Administrador e Proprietário (como hoje).
- **Diálogo de remover Membro (já aplicado):** a lista de efeitos mostra «As Sessões de Chat deste Membro deixam de ser acessíveis.» sem número. As demais linhas do diálogo (contagens de Tarefas etc., que vêm de `previewSuccession` e continuam corretas) **não mudam**.

### S7 — Recusas novas

Ver «Recusas novas (S7) — sem copy nova». Nenhum componente, nenhuma tela. O botão que dispara a operação continua visível/habilitado como hoje; a frase do domínio chega no `Toast` de erro pelo caminho existente.

### Estados transversais (herdados de 07-UI-SPEC §9, sem mudança)

Carregando: esqueleto na forma do conteúdo. Erro de carga: `EmptyState` com a mensagem. Texto longo: `truncate` com `title` em listas e cartões; em ficha, quebra de linha. `Toast` de erro não expira. Nunca `window.alert`/`confirm`. Movimento reduzido: respeitado pelos componentes. Nesta fase, nenhuma animação nova.

---

## UI Considerations

Probe `ui-consideration-probe` aplicado em modo `--auto` sobre as sete superfícies acima. A copy de vazio e erro mora em «Copywriting Contract» e é referenciada, não repetida.

Applicable state considerations resolved: 17 covered, 4 backstop, 3 unresolved

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| error | S1 link público (static-content, interactive-control) | ✅ covered | Com `secret === ""`, as telas mostram «Só quem administra a Lista vê o link.» e nunca montam `/f/` ou `/p/` sem segredo (Layout S1) |
| loading | S1 link público | ✅ covered | Não há carga própria: o segredo vem no estado já hidratado; o parágrafo aparece junto com a tela, sem estado intermediário |
| long-text | S1 link público | ✅ covered | A frase quebra linha e nunca é truncada (Layout S1) |
| overflow | S1 link público | ✅ covered | O parágrafo ocupa a largura do diálogo/editor e cresce na vertical; nada sai da coluna |
| loading | S2 trilho (nav) | 🧪 backstop | Antes de a sessão resolver (`memberId` nulo) o item «IA» aparece; se o Convidado piscar a IA antes de sumir, é teste de estado visual |
| error | S2 trilho | ✅ covered | Sem falha de carga própria: o item some ou não por função pura sobre o estado já carregado |
| overflow | S2 trilho | ✅ covered | Um item a menos; os demais não reordenam e o rótulo «IA» é curto e fixo |
| long-text | S2 trilho | ✅ covered | Rótulo fixo «IA»; nenhum texto do usuário no item |
| loading | S3 `/ia/*` para o Convidado | 🧪 backstop | Antes da sessão resolver, o layout renderiza `children` por um instante; as páginas filhas mostram seus vazios (coleções `[]`) e depois o layout troca por «sem acesso». Verificar que a troca não pisca conteúdo |
| overflow | S3 `/ia/*` | ✅ covered | O `NoAccessState` ocupa a largura do `CorpoDeTela`; texto de uma linha |
| long-text | S3 `/ia/*` | ✅ covered | Texto fixo «a área de IA · sem acesso»; não aceita conteúdo do usuário |
| empty | S4 nome do Agente (list-collection: coluna de responsáveis) | ✅ covered | Agente ausente do estado mostra «Agente», nunca célula vazia nem «—»; «—» só sem resolvedor (Layout S4) |
| partial | S4 nome do Agente | ✅ covered | Mistura de Membros e Agentes na mesma coluna: Membros pelo nome, Agentes por `nomeDoAgente`; ninguém some |
| zero-one-many | S4 nome do Agente | ⚠ unresolved | Dois Agentes diferentes aparecem os dois como «Agente»; o Convidado não os distingue. O planejador trata como assunção aceita (A6) |
| long-text | S4 nome do Agente | ✅ covered | O rótulo genérico herda `truncate`/quebra da célula; é curto |
| zero-one-many | S6 diálogo de remover Membro | ✅ covered | A frase «As Sessões de Chat deste Membro deixam de ser acessíveis.» não varia com a contagem (sem número, sem plural a corrigir) |
| partial | S6 «Convite pendente» | ✅ covered | Membro `pendente` sem `invitedIdentity` mostra «Convite pendente»; Administrador e Proprietário veem o e-mail |
| zero-one-many | S6 «Convite pendente» (lista de Membros) | ⚠ unresolved | Vários convites pendentes aparecem todos como «Convite pendente»; sem o e-mail, quem não administra não os distingue. Assunção aceita (A7) |
| error | S5 `global-error.tsx` (interactive-control) | ✅ covered | Fronteira com título, dica e «Tentar de novo»; nunca mostra `error.message`, `digest` nem URL (Layout S5) |
| loading | S5 `global-error.tsx` | 🧪 backstop | O botão não tem estado «carregando»; clicar repetido enquanto o retry re-renderiza é inofensivo. Cobrir com teste visual se o retry demorar |
| overflow | S5 `global-error.tsx` | ✅ covered | `max-w-lg` e `min-h-screen`; texto curto e fixo, centrado |
| long-text | S5 `global-error.tsx` | ✅ covered | A frase é fixa; nenhum texto vindo do erro entra na tela |
| error | S7 recusas novas / 403 de `suspenso` | ⚠ unresolved | Frase de domínio sai literal no `Toast` existente; o 403 de Membro `suspenso` em `POST /operacoes` cai no tratamento de falha de transporte do store, sem copy própria. Item I1 |
| long-text | S7 recusas novas | 🧪 backstop | Frase de recusa longa no `Toast`: quebra de linha pelo componente (não truncar); teste visual se alguma frase de 09-03 passar de duas linhas |

<!-- Status vocabulary (locked by probe-core projectTruths):
     ✅ covered   → a plain truth string lifted into must_haves.truths
     🧪 backstop  → a flat scalar { statement, verification: backstop }; at verify time, no explicit
                    evidence → insufficient_spec → human_needed (never a silent pass, #1154)
     ⚠ unresolved → an explicit planner assumption (surfaced, never silently dropped)
     Rows are REPLACED (not appended) on a probe re-run — idempotent. -->

---

## Premissas e itens em aberto

Decisões tomadas sem poder perguntar ao dono. Em cada uma foi escolhida a opção **conservadora**, a que repete uma tela existente. O verificador e o dono podem revertê-las sem custo (são marcação e texto).

**Premissas (`[auto]`, o executor segue como escrito)**

| ID | Premissa | Por quê | Reverter |
|---|---|---|---|
| A1 | `ia/layout.tsx` envolve o `NoAccessState` em `PageHeader title="IA"` + `CorpoDeTela`, não só o painel solto (09-08 só diz `<NoAccessState what="a área de IA" />`) | `ia/chat/[sessao]/page.tsx` e as demais telas bloqueadas usam o esqueleto de tela; um painel sem cabeçalho destoa. A string é a do plano | Remover o envoltório; o texto não muda |
| A2 | Em `forms-editor.tsx` «Copiar link» não aparece sem segredo (o plano admite «não aparece» ou «desabilitado com o mesmo texto como motivo») | O parágrafo já é o motivo; um botão desabilitado repetiria a frase na mesma linha | Trocar por `Button disabled` com `disabledReason` igual ao parágrafo |
| A3 | A frase de S1 e a tela de S5 não usam acento nem cor de aviso/erro; o botão de S5 é o `btn` neutro, não `btn-solido` | Ausência de segredo é permissão, não falha; `/p/` já usa o `btn` neutro para «Tentar novamente»; mantém a lista de acento fechada em zero usos novos | Trocar a classe do botão por `btn-solido` |
| A4 | `global-error.tsx` usa marcação com as classes do sistema e **não** importa o barril nem o store; importa `./globals.css`; sem `next/font` (cai na pilha de sistema) | Uma fronteira de erro global com dependências pesadas pode falhar pelo mesmo motivo que acionou; o Next 16 exige estilos próprios no `global-error`; `verificar:tokens` continua valendo | Importar `EmptyState`/`Painel` do barril se o build e o teste mostrarem que é seguro |
| A5 | O par de frases de S5 do plano («Algo deu errado. O erro foi registrado.») é dividido em `title` e `hint`, cada frase literal | Casa com a forma do `EmptyState`; o plano só testa `captureException` (`grep -c`), não a concatenação | Juntar as duas frases num único `p` |
| A6 | Dois Agentes distintos viram ambos «Agente» para o Convidado | O servidor não manda a coleção (D-02/D-03); devolver o nome seria devolver o dado | Mandar só `id` e nome do Agente numa coleção mínima — fora desta fase, Sessão 12 |
| A7 | Vários convites pendentes ficam indistinguíveis para quem não administra | É o efeito do recorte de e-mail (1.1.2); quem precisa distinguir é Administrador | Nenhuma ação |
| A8 | A tela de Chat de Sessão alheia (09-01) fica como está: o `NoAccessState` «Sessão de Chat de outro Membro» e o parágrafo explicativo | Já executado e conferido pelos testes; o D4 do 09-01-SUMMARY marca a conferência visual como pendente da verificação da fase | — |
| A9 | `global-error` usa `retry` (o guia lido em `node_modules/next/dist/docs/.../error.md` na 16.3.4 define `retry` e mantém `reset`) | O plano diz «as props da versão 16 do Next» sem fixar o nome; o executor lê o guia antes (AGENTS.md) | Usar `reset` |

**Itens em aberto (o planejador/dono decide; nenhum bloqueia a execução)**

| ID | Item | Estado |
|---|---|---|
| I1 | **Membro `suspenso` recebe 403 em `POST /operacoes` (09-07) e nenhum plano toca `apps/web`.** Hoje o store trata 403 como «falha de transporte» e a tela cai no `Toast`/estado genérico, sem frase que diga que o acesso está suspenso. Sugestão, **não incluída** neste contrato: uma frase própria, por exemplo «Seu acesso a este Espaço de Trabalho está suspenso.», num `Toast` de erro. Precisa de um plano web novo (arquivo e teste) ou fica como dívida registrada | aberto |
| I2 | **O suspenso consulta** (`plugins/autenticacao.ts` deixa passar `ativo` e `suspenso` de propósito). Telas de escrita continuam clicáveis para ele e falham no 403. Esconder/desabilitar botões por estado do Membro seria uma fase própria | aberto |
| I3 | **«O erro foi registrado.» só é verdade com DSN configurado.** Em desenvolvimento e em build sem `NEXT_PUBLIC_SENTRY_DSN`/`SENTRY_DSN` o SDK não envia nada, e a frase mente. Aceito porque a tela só importa onde há DSN (homologação e produção, 09-19); alternativa: omitir a dica quando o DSN estiver vazio | aberto |
| I4 | **O botão da página da Lista que abre o Formulário some sem explicação** para quem não administra (o plano manda não renderizar). O motivo fica no item de menu desabilitado e no `forms-editor`. Se o dono preferir, o botão fica desabilitado com `disabledReason` | aberto |
| I5 | **Flash de IA antes da sessão** (S2/S3, `memberId` nulo): `veAssuntoIa` devolve verdadeiro por desenho. Se o `StoreProvider` já só renderiza a tela depois da sessão, não há flash; se não, é teste visual. Conferir na verificação | aberto (backstop) |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | nenhum — projeto não usa shadcn (`Tool: none`) | não aplicável |
| terceiros | nenhum | não aplicável |

Nenhum pacote visual novo. Os únicos acréscimos de dependência da fase em `apps/web` são `@sentry/nextjs` (09-16, na versão exata aprovada no checkpoint de legitimidade de 09-13), sem UI: `replayIntegration` e tracing ficam desligados; `telemetry: false` e `sourcemaps: { disable: true }` no build.

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: FLAG (não bloqueante: I1, 403 de Membro suspenso sem copy; I3, «O erro foi registrado.» sem DSN do Sentry)
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: FLAG (não bloqueante: corpo 13px e título 14px muito próximos)
- [x] Dimension 5 Spacing: FLAG (não bloqueante: `py-10` do S5 fora da escala; declarar a exceção ou usar `py-8`/`py-12`)
- [x] Dimension 6 Registry Safety: PASS
- [x] Dimension 7 Inventory Provenance: PASS

**Approval:** aprovado pelo gsd-ui-checker em 2026-10-22 (3 FLAGs não bloqueantes acima). O probe de UI Considerations rodou em modo `--auto` pelo pesquisador; a confirmação de tipos com o dono não aconteceu.
