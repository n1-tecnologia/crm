---
phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista
plan: 08
subsystem: ui
tags: [est-03, d-16, d-17, abas, search-params, a13, nextjs, configuracoes]

requires:
  - phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista
    provides: "10-02: origemDoAspecto, bloqueioAcima, contagemAcumulada e NOME_DO_ASPECTO em derive.ts; 10-20: container-settings.tsx compilando"
provides:
  - "Configurações de Espaço, Pasta e Lista em Abas com a aba em ?aba= (abaDasConfiguracoes, fallback para geral)"
  - "CabecalhoDoAspecto: linha de origem (Definido aqui / Herdado de / Padrão da plataforma / Bloqueado por) e contagem de Campos e Tipos, com slot direita para o interruptor de 10-11"
  - "Criado por {nome} na aba Geral (a página do Espaço de 10-09 pode apagar o painel Atributos)"
  - "Abas acessível (A13): idBase, id/aria-controls, setas/Home/End com tabIndex móvel, aba ativa rolada para a vista; idDaAba/idDoPainel no barril ui"
  - "ReadOnlyNote exportado de configuration-editors.tsx"
affects: [10-09, 10-10, 10-11]

plan_head_before: 1c0b791eefffc75562c7d81f615045a209b74299
plan_head_after: 9413e19e573026418904970c8f574f548d2676a6

actuals:
  tokens: 13200
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Aba na URL: useSearchParams + router.replace(`${pathname}?${params}`, { scroll: false }), mantendo os outros parâmetros"
    - "Chave de ?aba= validada contra a lista fechada do nível (abaDasConfiguracoes); o valor nunca é desenhado"
    - "A tela lê a frase de bloqueio do domínio (blockedAbove) e não a reescreve"

key-files:
  created:
    - apps/web/src/features/estrutura/cabecalho-do-aspecto.tsx
    - apps/web/src/features/estrutura/container-settings.test.tsx
    - apps/web/src/design/abas.test.tsx
  modified:
    - apps/web/src/features/estrutura/container-settings.tsx
    - apps/web/src/features/estrutura/configuration-editors.tsx
    - apps/web/src/design/basicos.tsx
    - apps/web/src/features/shell/ui.tsx

key-decisions:
  - "A aba Visualizações não nasce aqui: ?aba=visualizacoes cai em geral até 10-10 trazer o editor."
  - "FeaturesEditor passa a mostrar só a nota de permissão; a frase de bloqueio por ancestral fica na linha de origem, para não aparecer duas vezes na mesma aba (o desligamento do interruptor continua pelas duas causas)."
  - "idDaAba/idDoPainel são exportados de basicos.tsx e do barril ui.tsx, para a tela e Abas combinarem o par de ids sem repetir o formato em string."
  - "Estado carregando: a casca (app-shell) já mostra EsqueletoDeTela até o armazém hidratar, e o ContainerSettings só monta depois; nenhum esqueleto próprio foi acrescentado."

patterns-established:
  - "Abas com idBase: o painel usa role=tabpanel, id=idDoPainel(base, chave) e aria-labelledby=idDaAba(base, chave)"

requirements-completed: [EST-03]

coverage:
  - id: D1
    description: "?aba=campos abre as Configurações da Lista direto em Campos; ?aba= ausente, desconhecido ou de aba que o nível não tem (formularios num Espaço) cai em Geral; trocar de aba faz router.replace com scroll: false"
    requirement: EST-03
    verification:
      - kind: unit
        ref: "apps/web/src/features/estrutura/container-settings.test.tsx#ContainerSettings — a aba vem da URL"
        status: pass
    human_judgment: false
  - id: D2
    description: "A tabela de aspectos, ASPECTS, REGRA_DOS_MODOS e MODE_LABEL saíram; o texto da tabela antiga não aparece em nenhuma aba"
    requirement: EST-03
    verification:
      - kind: unit
        ref: "apps/web/src/features/estrutura/container-settings.test.tsx#o texto da tabela antiga não aparece em nenhuma das abas"
        status: pass
      - kind: other
        ref: "grep -c 'ASPECTS|REGRA_DOS_MODOS|MODE_LABEL' container-settings.tsx == 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "A linha de origem de Status e Funcionalidades (Definido aqui, Herdado de {Espaço|Pasta|Subpasta} {nome}, Bloqueado por com a frase do domínio) e a contagem de Campos e Tipos (1 definido aqui · 2 herdados)"
    requirement: EST-03
    verification:
      - kind: unit
        ref: "apps/web/src/features/estrutura/container-settings.test.tsx#ContainerSettings — a linha de origem de cada aba (D-16)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Criado por {nome} na aba Geral e o conteúdo da aba como tabpanel ligado à aba ativa"
    requirement: EST-03
    verification:
      - kind: unit
        ref: "apps/web/src/features/estrutura/container-settings.test.tsx#ContainerSettings — Geral e o painel da aba"
        status: pass
    human_judgment: false
  - id: D5
    description: "Abas liga aba e painel (id, aria-controls) e navega por ArrowLeft/ArrowRight/Home/End com tabIndex móvel; os outros usos de Abas continuam passando"
    verification:
      - kind: unit
        ref: "apps/web/src/design/abas.test.tsx"
        status: pass
      - kind: unit
        ref: "cd apps/web && npx vitest run src/features src/design (62 arquivos, 529 testes)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Aparência das abas e da linha de origem em tela estreita: lista de abas rolando na horizontal com a aba ativa à vista; nome longo de contêiner no título, no caminho e na Pilula sem empurrar o interruptor para fora da faixa"
    verification: []
    human_judgment: true
    rationale: "Backstop visual do UI-SPEC (S4 estouro e texto longo): jsdom não mede layout; precisa de olho humano no navegador com um contêiner de nome longo."

duration: 11min
completed: 2026-10-29
status: complete
---

# Phase 10 Plan 08: Configurações em abas Summary

**Configurações de Espaço, Pasta e Lista em abas com `?aba=` na URL, linha de origem por aspecto lida das leituras do domínio (Definido aqui, Herdado de, Bloqueado por), Criado por na aba Geral e `Abas` com ligação aba-painel e teclado.**

## Performance

- **Duration:** 11 min
- **Completed:** 2026-10-29
- **Tasks:** 2
- **Files modified:** 7 (3 novos, 4 alterados)

## Accomplishments

- `container-settings.tsx` trocou a rolagem única e a tabela didática por `PageHeader` → `Abas` → painel em coluna única (`max-w-3xl`). Abas: Geral, Status, Funcionalidades, Campos, Tipos de Tarefa e, só na Lista, Formulários e Modelo e canais. `/estrutura/listas/<id>/configuracoes?aba=campos` abre direto em Campos; chave ausente, desconhecida ou de aba que o nível não tem cai em `geral`; trocar de aba usa `router.replace(..., { scroll: false })` e preserva os outros parâmetros.
- `CabecalhoDoAspecto` (novo) lê `origemDoAspecto`, `contagemAcumulada` e `bloqueioAcima` (10-02). Status e Funcionalidades mostram a origem; Campos e Tipos de Tarefa mostram `{n} definido(s) aqui · {m} herdado(s)`; com bloqueio acima aparecem a `Pilula` de aviso com cadeado e a `ReadOnlyNote` com a frase de `blockedAbove`, literal. "Subpasta" quando a Pasta está dentro de outra Pasta.
- "Criado por {nome}" ("Sistema" sem Membro) vive na Geral, entre Identidade e Ciclo de vida.
- `Abas` (A13): `idBase` liga `id`/`aria-controls`; `tabIndex` móvel; setas (circulares), Home e End trocam a aba e levam o foco; a aba ativa rola para a vista ao carregar. Visual intocado; os onze usos continuam passando.

## Task Commits

1. **Task 1 (tracer): `?aba=campos` abre as Configurações da Lista direto em Campos** - `be49dc8` (feat)
2. **Task 2: linha de origem por aba, Criado por na Geral e Abas acessível** - `9413e19` (feat)

**Plan metadata:** commit `docs(10-08)` seguinte a este arquivo.

## Files Created/Modified

- `apps/web/src/features/estrutura/container-settings.tsx` - Configurações em abas, `abaDasConfiguracoes`, `role="tabpanel"`, Criado por
- `apps/web/src/features/estrutura/cabecalho-do-aspecto.tsx` - linha de origem / contagem / bloqueio (novo)
- `apps/web/src/features/estrutura/configuration-editors.tsx` - `ReadOnlyNote` exportado; `FeaturesEditor` sem a frase de bloqueio duplicada
- `apps/web/src/design/basicos.tsx` - `Abas` com `idBase`, teclado, rolagem da aba ativa; `idDaAba`/`idDoPainel`
- `apps/web/src/features/shell/ui.tsx` - barril exporta `idDaAba`/`idDoPainel`
- `apps/web/src/features/estrutura/container-settings.test.tsx` - 14 testes (EST-03 e linha de origem) (novo)
- `apps/web/src/design/abas.test.tsx` - 8 testes de ligação e teclado (novo)

## Decisions Made

Ver `key-decisions`. Em resumo: Visualizações fica para 10-10; a frase de bloqueio mora só na linha de origem; o carregando é da casca.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Frase de bloqueio duplicada na aba Funcionalidades**
- **Found during:** Task 2
- **Issue:** `FeaturesEditor` já desenhava `ReadOnlyNote` com a frase de bloqueio por ancestral; com a linha de origem do plano a mesma frase apareceria duas vezes na aba.
- **Fix:** o editor passa a desenhar só a nota de permissão (`bloqueio`); o interruptor continua desligado pelas duas causas, e a frase de ancestral vem da linha de origem. Coberto por um teste que exige a frase uma única vez.
- **Files modified:** `apps/web/src/features/estrutura/configuration-editors.tsx`
- **Committed in:** `9413e19`

**2. [Rule 3 - Blocking] Barril `ui.tsx` exporta `idDaAba` e `idDoPainel`**
- **Found during:** Task 2
- **Issue:** a regra do projeto é telas importarem só de `@/features/shell/ui`; sem o export a tela teria de montar os ids em string ou importar `design/basicos` direto.
- **Fix:** duas linhas no barril.
- **Files modified:** `apps/web/src/features/shell/ui.tsx`
- **Committed in:** `9413e19`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** ambas pequenas e necessárias; sem mudança de escopo.

## Issues Encountered

- A frase de bloqueio do domínio é "…bloqueia a sobrescrita do Conjunto de Status abaixo dele." (e não "bloqueia Conjunto de Status…", como eu tinha suposto no primeiro rascunho do teste). O teste passou a comparar com `blockedAbove(...)`, literal do domínio, em vez de repetir o texto.
- `npm run lint` mostra 3 avisos `no-unused-vars` em arquivos que esta plan não toca (`app-shell.tsx` e outro); pré-existentes, fora do escopo.

## Known Stubs

Nenhum.

## Threat Flags

Nenhum. `?aba=` é validado contra lista fechada e nunca renderizado (T-10-21); os editores e as recusas do domínio são os mesmos (T-10-22).

## Next Phase Readiness

- 10-10 acrescenta a aba Visualizações (chave `visualizacoes`) à lista `ABAS` e ao `abaDasConfiguracoes`; 10-11 coloca o interruptor no slot `direita` de `CabecalhoDoAspecto`.
- 10-09 pode apagar o painel Atributos da página do Espaço: "Criado por" já mora na aba Geral.
- Pendente de olho humano: o backstop visual de tela estreita e nome longo (D6).

## Self-Check: PASSED

- Arquivos criados presentes: `cabecalho-do-aspecto.tsx`, `container-settings.test.tsx`, `abas.test.tsx`.
- Commits `be49dc8` e `9413e19` no histórico da branch.
- `npx vitest run src/features src/design`: 62 arquivos, 529 testes verdes; `npx tsc --noEmit`, eslint nos arquivos tocados e `npm run verificar:tokens` sem erro.

---
*Phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista*
*Completed: 2026-10-29*
