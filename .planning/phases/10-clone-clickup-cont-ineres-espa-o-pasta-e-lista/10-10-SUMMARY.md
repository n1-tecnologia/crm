---
phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista
plan: 10
subsystem: ui
tags: [visualizacoes-padrao, configuracoes-em-abas, lista, view-bar, react, vitest]

requires:
  - phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista
    provides: "10-01: setContainerDefaultViews e views/viewsDefinedAt na configuracao efetiva"
  - phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista
    provides: "10-07: Carga fora do tipo de Visualizacao e das abas da Lista"
  - phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista
    provides: "10-08: Configuracoes em abas (?aba=) e CabecalhoDoAspecto"
provides:
  - "abasDaLista / abaInicialDaLista (funcoes puras) e ORDEM_DAS_ABAS"
  - "EditorDeVisualizacoesPadrao e a aba Visualizacoes das Configuracoes de Espaco, Pasta e Lista"
  - "A pagina da Lista monta as abas da configuracao efetiva e abre na inicial herdada"
  - "ViewBar esconde (sem apagar) as salvas de tipo indisponivel"
affects: [10-11, 10-20]

actuals:
  tokens: 12000
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Aba derivada na renderizacao (abas.includes(escolhida) ? escolhida : inicial) em vez de efeito que chama setState"
    - "Conta feita na copia do run(): o lambda aplica a operacao e le o estado resultante antes de devolver"
    - "Teste de pagina com um botao de harness que roda a operacao pelo run() do store, simulando outro Membro"

key-files:
  created:
    - apps/web/src/features/estrutura/editor-de-visualizacoes-padrao.tsx
    - apps/web/src/features/estrutura/editor-de-visualizacoes-padrao.test.tsx
    - apps/web/src/features/estrutura/pagina-da-lista-visualizacoes.test.tsx
    - apps/web/src/features/estrutura/view-bar.test.tsx
  modified:
    - apps/web/src/features/estrutura/tipo-de-visualizacao.ts
    - apps/web/src/features/estrutura/tipo-de-visualizacao.test.ts
    - apps/web/src/features/estrutura/container-settings.tsx
    - apps/web/src/features/estrutura/container-settings.test.tsx
    - apps/web/src/features/estrutura/view-bar.tsx
    - "apps/web/src/app/(shell)/estrutura/listas/[lista]/page.tsx"

key-decisions:
  - "A aba mostrada na Lista e derivada (abas.includes(escolhida) ? escolhida : inicial), nao um useEffect que chama setState: o lint do projeto proibe setState em efeito, e a derivacao nao pisca uma aba que nao existe."
  - "Uma padrao salva de tipo escondido nao e usada nem para os filtros iniciais: a Lista abre sem Visualizacao aplicada, na inicial do Espaco (D-06), em vez de abrir filtrada por uma salva que a barra nao mostra."
  - "A frase de salvas guardadas conta so as Visualizacoes de Listas abaixo do contêiner cuja configuracao efetiva, ja com a mudanca, deixou de oferecer o tipo; uma Lista que define as proprias Visualizacoes e continua oferecendo o tipo nao entra na conta."
  - "A contagem e feita dentro do lambda de run(), na copia ja alterada, para nao usar o estado antigo do closure."
  - "O editor calcula sozinho a recusa de permissao e de contêiner inativo (mesmas frases de identidade-e-ciclo-de-vida); desligadoPor existe como sobreposicao do chamador, mas container-settings nao precisa passa-lo."

patterns-established:
  - "Aspecto de configuracao que substitui: editor parte do valor EFETIVO e grava a definicao propria do nivel; Voltar a herdar grava null"

requirements-completed: [EST-08]

coverage:
  - id: D1
    description: "Desmarcar Calendario nas Configuracoes do Espaco faz a aba sumir de toda Lista dele; escolher Quadro como inicial faz as Listas sem padrao propria abrirem no Quadro"
    requirement: EST-08
    verification:
      - kind: unit
        ref: "apps/web/src/features/estrutura/pagina-da-lista-visualizacoes.test.tsx#o Espaço tira o Calendário e escolhe o Quadro como inicial"
        status: pass
      - kind: unit
        ref: "apps/web/src/features/estrutura/editor-de-visualizacoes-padrao.test.tsx#desmarcar Calendário grava `disponiveis` sem `calendario`"
        status: pass
    human_judgment: false
  - id: D2
    description: "A aba Visualizacoes das Configuracoes (Espaco, Pasta, Lista): uma caixa por tipo, a escolha da inicial, Voltar a herdar so com definicao propria, gravando na hora"
    requirement: EST-08
    verification:
      - kind: unit
        ref: "apps/web/src/features/estrutura/editor-de-visualizacoes-padrao.test.tsx"
        status: pass
      - kind: unit
        ref: "apps/web/src/features/estrutura/container-settings.test.tsx#o Espaço também tem a aba Visualizações"
        status: pass
    human_judgment: false
  - id: D3
    description: "O tipo inicial nao se desmarca (caixa desligada com o motivo por aria-describedby); Linha do tempo desligada em Lista conversacional; editor desligado com ReadOnlyNote para quem nao administra, contêiner inativo ou bloqueio acima"
    requirement: EST-08
    verification:
      - kind: unit
        ref: "apps/web/src/features/estrutura/editor-de-visualizacoes-padrao.test.tsx#o tipo inicial não se desmarca"
        status: pass
    human_judgment: false
  - id: D4
    description: "D-06: a salva de tipo indisponivel some da barra e volta junto com o tipo, sem ser apagada; a ativa que some limpa a selecao sem Toast; a padrao escondida segue isDefault"
    requirement: EST-08
    verification:
      - kind: unit
        ref: "apps/web/src/features/estrutura/view-bar.test.tsx#some e volta"
        status: pass
      - kind: unit
        ref: "apps/web/src/features/estrutura/view-bar.test.tsx#a salva ativa cujo tipo sumiu limpa a seleção"
        status: pass
    human_judgment: false
  - id: D5
    description: "Uma aba so nao desenha a barra de Abas; sem a aba Lista, Selecionar varias fica desligado com o motivo; a aba aberta que deixa de existir volta a inicial"
    requirement: EST-08
    verification:
      - kind: unit
        ref: "apps/web/src/features/estrutura/pagina-da-lista-visualizacoes.test.tsx#Página da Lista — uma só aba, sem a aba Lista e a aba que some"
        status: pass
    human_judgment: false
  - id: D6
    description: "O Toast de sucesso do editor acrescenta quantas salvas do tipo desmarcado ficam guardadas (singular e plural)"
    requirement: EST-08
    verification:
      - kind: unit
        ref: "apps/web/src/features/estrutura/editor-de-visualizacoes-padrao.test.tsx#O aviso das salvas guardadas"
        status: pass
    human_judgment: false
  - id: D7
    description: "Aparencia da aba Visualizacoes (alinhamento das colunas Disponivel/Inicial, quebra do rotulo e do motivo em tela estreita) e da barra de Visualizacoes com muitas salvas, e ausencia de piscada de cinco para menos abas ao abrir a Lista"
    verification: []
    human_judgment: true
    rationale: "Os estados de carregando, estouro e texto longo da UI-SPEC S5 sao backstops visuais que jsdom nao mede; precisam do olhar de quem usa a tela."

duration: 14min
completed: 2026-10-29
status: complete
plan_head_before: 86750ca06a5ac44c97419785e3d0f62a123ea9c7
plan_head_after: 2f7b4f861861b952847dd5af5db891ecad7aacf6
commits: 2
---

# Phase 10 Plan 10: Visualizações padrão nas telas Summary

**A página da Lista monta as abas a partir das Visualizações padrão herdadas (lente aplicada), a aba "Visualizações" das Configurações edita o valor no Espaço, na Pasta e na Lista gravando na hora, e a barra de salvas esconde sem apagar as de tipo indisponível.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-10-29T10:05:00Z
- **Completed:** 2026-10-29T10:19:39Z
- **Tasks:** 2
- **Files modified:** 10 (4 criados)

## Accomplishments

- `abasDaLista` (conversacional sem Linha do tempo, financeira sem restrição, interseção vazia ⇒ só a aba Lista) e `abaInicialDaLista` (padrão salva → inicial → primeira), puras e testadas.
- `EditorDeVisualizacoesPadrao`: cinco linhas na ordem da barra, caixas e rádios nativos, o tipo inicial não se desmarca (motivo visível ligado por `aria-describedby`), «Voltar a herdar» só com definição própria e sem bloqueio, `ReadOnlyNote` quando desligado, Toasts do Copywriting e a frase de salvas guardadas (singular/plural).
- Aba `visualizacoes` em `container-settings.tsx` (depois de Tipos de Tarefa) com `CabecalhoDoAspecto aspecto="defaultViews"`; `abaDasConfiguracoes` aceita a chave nos três níveis.
- `page.tsx` consome a configuração efetiva: abas, aba inicial, padrão escondida não abre, uma só aba não desenha `Abas`, «Selecionar várias» desligado sem a aba Lista, aba que some volta à inicial. Fica em 950 linhas (< 1.000).
- `view-bar.tsx` recebe `abas`, lista só as salvas de tipo mostrado (filtro só de leitura, T-10-26) e limpa a seleção, sem Toast, se a ativa some.

## Task Commits

1. **Task 1: Traçador — o Espaço desmarca o Calendário no editor e a aba some das Listas dele** - `c8f2b18` (feat)
2. **Task 2: As salvas somem e voltam (D-06), uma aba só, a seleção sem a aba Lista e o aviso de guardadas** - `2f7b4f8` (feat)

**Plan metadata:** commit docs do SUMMARY/STATE/ROADMAP (a seguir)

_Observação sobre TDD: o plano é `type: execute` (tarefas `tdd="true"` sem o gate de plano). Os testes foram escritos junto da implementação de cada tarefa e commitados com ela, sem commit RED separado; todos os casos de `<behavior>` têm teste que passa._

## Files Created/Modified

- `apps/web/src/features/estrutura/tipo-de-visualizacao.ts` - `ORDEM_DAS_ABAS`, `LenteDaLista`, `abasDaLista`, `abaInicialDaLista`
- `apps/web/src/features/estrutura/editor-de-visualizacoes-padrao.tsx` - o editor da aba (novo)
- `apps/web/src/features/estrutura/container-settings.tsx` - a aba `visualizacoes`
- `apps/web/src/features/estrutura/view-bar.tsx` - prop `abas`, filtro de D-06, limpeza da ativa escondida
- `apps/web/src/app/(shell)/estrutura/listas/[lista]/page.tsx` - abas e aba inicial da configuração efetiva, uma aba só, seleção sem a aba Lista
- Testes: `tipo-de-visualizacao.test.ts`, `editor-de-visualizacoes-padrao.test.tsx`, `pagina-da-lista-visualizacoes.test.tsx`, `view-bar.test.tsx` e ajustes em `container-settings.test.tsx` (a lista de abas e a chave nova)

## Decisions Made

Ver `key-decisions` no frontmatter. Em resumo: aba derivada na renderização (sem `setState` em efeito, que o lint do projeto proíbe); padrão salva escondida não abre nem aplica filtros; a contagem de salvas guardadas é feita na cópia do `run()` e só conta Listas que realmente deixaram de oferecer o tipo.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `useEffect` com `setState` reprovado pelo lint**
- **Found during:** Task 1 (página da Lista)
- **Issue:** o plano pedia "um efeito que volta à aba inicial"; `react-hooks/set-state-in-effect` reprova `setState` dentro de efeito e `npm run lint -w @n1/web` falharia.
- **Fix:** a aba mostrada é derivada na renderização (`abas.includes(escolhida) ? escolhida : abaInicial`); o comportamento é o mesmo e provado por teste ("a aba aberta deixa de existir com a Lista aberta: a página volta à inicial").
- **Files modified:** `apps/web/src/app/(shell)/estrutura/listas/[lista]/page.tsx`
- **Verification:** `pagina-da-lista-visualizacoes.test.tsx`, lint sem erro
- **Committed in:** `c8f2b18`

**2. [Rule 1 - Bug] Padrão salva escondida aplicaria filtros de uma Visualização que a barra não mostra**
- **Found during:** Task 1 (página da Lista)
- **Issue:** `padrao` alimentava `filters`, `sortBy` e `activeViewId` iniciais; com o tipo dela fora das abas, a Lista abriria filtrada por uma salva invisível, contra D-06 ("a Lista abre na inicial").
- **Fix:** `padrao` só vale se o tipo está entre as abas mostradas; senão a Lista abre sem Visualização aplicada.
- **Files modified:** `apps/web/src/app/(shell)/estrutura/listas/[lista]/page.tsx`
- **Verification:** teste "a salva padrão de um tipo que o Espaço tirou fica guardada e não abre"
- **Committed in:** `c8f2b18`

**3. [Rule 2 - Missing Critical] `alternarSelecao` mandava a página para uma aba inexistente**
- **Found during:** Task 2
- **Issue:** `alternarSelecao` fazia `setView("lista")` mesmo sem a aba Lista entre as mostradas.
- **Fix:** só leva à Lista se ela está nas abas.
- **Files modified:** `apps/web/src/app/(shell)/estrutura/listas/[lista]/page.tsx`
- **Committed in:** `2f7b4f8`

---

**Total deviations:** 3 auto-fixed (1 blocking, 1 bug, 1 missing critical)
**Impact on plan:** todas necessárias para lint verde e para cumprir D-06; sem ampliação de escopo.

## Issues Encountered

- O jsdom não traz `ResizeObserver` (usado por `CorpoDeTela`); o teste da página o stuba com `vi.stubGlobal`.
- `npm run lint -w @n1/web` tem 3 avisos anteriores a este plano (`KnowledgeDocument`, `Target`, `memberReachesContainer` não usados em outros arquivos); não são desta tarefa e ficaram como estavam.

## Known Stubs

Nenhum.

## Threat Flags

Nenhum: nenhuma superfície nova de rede, autenticação ou esquema. T-10-26 (esconder ≠ apagar) coberto pelo teste "some e volta"; T-10-27 (editor ligado para quem não administra) coberto pelos testes de «Somente leitura», inativo e bloqueio acima — o domínio recusa de qualquer jeito.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- A aba `visualizacoes` já usa `CabecalhoDoAspecto aspecto="defaultViews"`; 10-11 só precisa passar o interruptor de bloqueio em `direita` quando chegar.
- Pendente de olho humano: alinhamento/quebra da aba nova em tela estreita, barra com muitas salvas e a ausência de piscada ao abrir a Lista (backstops visuais da UI-SPEC S5).

## Self-Check: PASSED

- Arquivos criados existem: `editor-de-visualizacoes-padrao.tsx`, `editor-de-visualizacoes-padrao.test.tsx`, `pagina-da-lista-visualizacoes.test.tsx`, `view-bar.test.tsx`.
- Commits `c8f2b18` e `2f7b4f8` presentes na branch.
- `npx tsc --noEmit` (web) limpo; `npx vitest run src/features/estrutura` verde (145 testes); `npm run lint -w @n1/web` sem erro; `npm run verificar:tokens` sem falha; `page.tsx` com 950 linhas.

---
*Phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista*
*Completed: 2026-10-29*
