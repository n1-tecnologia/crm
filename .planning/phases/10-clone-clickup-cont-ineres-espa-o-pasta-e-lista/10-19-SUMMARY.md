---
phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista
plan: 19
subsystem: web
tags: [est-06, d-08, d-09, d-10, reorderContainers, irmaosOrdenados, recusaDeReordenar, runConfirmado, arvore, ui-spec-s1, ui-spec-s3]

requires:
  - phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista
    provides: "10-04: reorderContainers, recusaDeReordenar e irmaosOrdenados; 10-12: useMoverConteinerDialog, o diálogo Mover para… montado na casca e o menu de linha com disabledReason"
provides:
  - "Subir e Descer no ⋯ das linhas de Espaço, Pasta, Subpasta e Lista da árvore da Estrutura (runConfirmado(reorderContainers), só com os irmãos visíveis que o Membro alcança)"
  - "A árvore (Espaços, Pastas, Listas) e a página da Pasta na ordem gravada, por irmaosOrdenados"
  - "ActionMenu «Mais ações» na página da Pasta e da Subpasta, com Mover para…"
  - "OrdemDaArvoreContext: ocupado, irmãos e reordenar da StructureTree; aria-busy na árvore durante a gravação"
  - "+ e ⋯ da linha sempre visíveis sob (hover: none)"
affects: [10-13, 10-17]

actuals:
  tokens: 8900
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Contexto da árvore (OrdemDaArvoreContext) fornecido só pela StructureTree: a árvore de Meus negócios, sem provedor, não ganha item de ordem (A9) sem nenhum if por chamador"
    - "Os irmãos do pedido de ordem são os que a árvore mostra E que o Membro alcança; os escondidos o domínio deixa na vaga (10-04)"
    - "Item desligado por recusa do domínio, pelo topo/fim ou pela gravação em curso, nessa ordem de precedência"

key-files:
  created:
    - apps/web/src/features/shell/arvore-menu.test.tsx
  modified:
    - apps/web/src/features/shell/app-shell.tsx
    - apps/web/src/app/(shell)/estrutura/pastas/[pasta]/page.tsx
    - apps/web/src/features/estrutura/mover-conteiner-dialog.test.tsx

key-decisions:
  - "O pedido de reordenar sai de StructureTree.irmaos(tipo, pai): a lista que a árvore mostra (com o filtro de arquivados) menos o que o Membro não alcança por memberReachesContainer. Um Espaço privado que só aparece pelo caminho de uma Tarefa visível não entra, porque o domínio recusaria o lote inteiro."
  - "Precedência do motivo de um item desligado: frase de recusaDeReordenar, depois Já está no topo./Já está no fim., depois a gravação em curso. A frase de permissão é a que a pessoa pode resolver; o limite é um fato da lista; a gravação passa sozinha."
  - "Enquanto uma reordenação grava, também o «Mover para…» da árvore fica desligado (UI-SPEC S3/carregando), com o mesmo motivo."
  - "«Mais ações» da Pasta some na Pasta Meus negócios e no que mora nela (containerPath), como o ⋯ da árvore (A9)."
  - "A visibilidade sob (hover: none) é a variante arbitrária do Tailwind 4 [@media(hover:none)]:opacity-100 na própria linha, sem regra nova em estilos/."

patterns-established:
  - "Reordenar não dá Toast no sucesso; a falha vai ao Toast tone=error da barra lateral e a anterior é limpa a cada novo comando"

requirements-completed: [EST-06]

coverage:
  - id: D1
    description: "Descer na primeira Lista de uma Pasta grava reorderContainers (list, pai folder, ids visíveis com a vizinha trocada), a árvore mostra a ordem nova depois da resposta e não há Toast"
    requirement: EST-06
    verification:
      - kind: automated_ui
        ref: "apps/web/src/features/shell/arvore-menu.test.tsx#Subir e Descer — o traçador: «Descer» na primeira Lista da Pasta reordena (EST-06)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A árvore (Espaços, Pastas, Listas) e a página da Pasta mostram cada grupo na ordem de `order`; inverter `order` no estado inverte a tela; o Descer troca a ordem na árvore e na página no mesmo estado"
    requirement: EST-06
    verification:
      - kind: automated_ui
        ref: "arvore-menu.test.tsx#a árvore mostra as Listas, as Pastas e os Espaços na ordem de `order`; #A página da Pasta e da Subpasta — mostra as Listas e as Subpastas na ordem gravada; #EST-06: «Descer» na primeira Lista troca a ordem na árvore e na página da Pasta"
        status: pass
    human_judgment: false
  - id: D3
    description: "Subir/Descer desligados com Já está no topo./Já está no fim., os dois no único irmão, e com a frase de recusaDeReordenar (Pasta arquivada, Membro que não administra os Espaços); menu do Espaço só com Subir/Descer e o de Pasta, Subpasta e Lista com Mover para…, Subir, Descer"
    requirement: EST-06
    verification:
      - kind: automated_ui
        ref: "arvore-menu.test.tsx#Subir e Descer — o traçador (3 testes de menu e limites); #Subir e Descer — a fatia visível, a falha e a gravação (Pasta arquivada, Membro sem administrar Espaços)"
        status: pass
    human_judgment: false
  - id: D4
    description: "O que a árvore esconde (Lista na lixeira entre duas visíveis) não entra no pedido e continua na vaga; a recusa do servidor vai ao Toast de erro e a árvore fica como estava; durante a gravação a árvore fica aria-busy e Mover para…, Subir e Descer ficam desligados"
    requirement: EST-06
    verification:
      - kind: automated_ui
        ref: "arvore-menu.test.tsx#o que a árvore esconde fica no lugar; #a recusa do servidor vai ao Toast de erro; #durante a gravação a árvore fica aria-busy"
        status: pass
    human_judgment: false
  - id: D5
    description: "A página da Pasta e da Subpasta ganham «Mais ações» depois de Configurações e Criar, com Mover para… que abre o diálogo de 10-12; desligado pela frase de containerAdminRefusal; ausente na Pasta Meus negócios"
    requirement: EST-06
    verification:
      - kind: automated_ui
        ref: "arvore-menu.test.tsx#A página da Pasta e da Subpasta (D-10, A8-bis, F2)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Convidado com a árvore inerte (nenhuma linha com ⋯); a Pasta Meus negócios e as Listas dela sem ⋯ de ordem; + e ⋯ sempre visíveis sob (hover: none)"
    requirement: EST-06
    verification:
      - kind: automated_ui
        ref: "arvore-menu.test.tsx#o Convidado vê a árvore inerte; #a Pasta Meus negócios e as Listas dela não ganham «⋯»; #A árvore em telas sem hover (A7)"
        status: pass
    human_judgment: false
  - id: D7
    description: "A regra (hover: none) do Tailwind vira CSS de verdade e o ⋯ não vaza da barra lateral nem da tela estreita; texto longo no motivo de um item desligado dentro do menu"
    verification: []
    human_judgment: true
    rationale: "UI-SPEC S3/estouro e S3/carregando são backstop visual: o jsdom não avalia media query nem layout; o teste só afirma a classe. A conferência vai para a lista da UAT de 10-17."

duration: 9min
completed: 2026-10-29
status: complete
plan_head_before: bd9ce0ec062dc03444185063afaf2fcabc869f01
plan_head_after: 48cb05edf11b187563ebcbd640d9375efd03b4ca
commits: 2
---

# Phase 10 Plan 19: Subir/Descer e a ordem na árvore e na Pasta Summary

**O dono reordena Espaços, Pastas e Listas pelo teclado com «Subir»/«Descer» no ⋯ da árvore (reorderContainers por runConfirmado, só com os irmãos visíveis que o Membro alcança), a árvore e a página da Pasta passam a mostrar a ordem gravada por irmaosOrdenados, e a Pasta ganha o «Mais ações» com «Mover para…».**

## Performance

- **Duration:** 9 min
- **Started:** 2026-10-29T10:47:00Z (aprox.)
- **Completed:** 2026-10-29T10:56:00Z
- **Tasks:** 2
- **Files modified:** 4 (1 criado)

## Accomplishments

- `StructureTree` ordena por `irmaosOrdenados` (Espaços, Pastas e Listas, com os mesmos filtros de ciclo de vida e privacidade de antes) e fornece o `OrdemDaArvoreContext`: `irmaos(tipo, pai)` (o que a árvore mostra e o Membro alcança), `reordenar(tipo, pai, id, passo)` e `ocupado`.
- `useMenuDeOrdem`: «Subir» e «Descer» trocam o item com o vizinho visível e gravam `runConfirmado(reorderContainers(...))`; sem Toast no sucesso, `Toast tone="error"` na falha, desligados pelo topo/fim, por `recusaDeReordenar` e durante a gravação. Vazio para o Convidado, para a árvore de Meus negócios (sem provedor) e para a Pasta Meus negócios e o que mora nela.
- Durante a gravação a `<ul>` da árvore fica `aria-busy="true"` e «Mover para…», «Subir» e «Descer» não permitem um segundo comando.
- Página da Pasta e da Subpasta: Listas e Subpastas por `irmaosOrdenados` (só as que o Membro alcança) e `ActionMenu` «Mais ações» (`btn-icone`, ⋯) depois de «Configurações» e «Criar», com «Mover para…» (desligado pela frase de `containerAdminRefusal`, ausente em Meus negócios).
- O «+» e o «⋯» da `TreeRow` ficam sempre visíveis sob `(hover: none)`.
- `arvore-menu.test.tsx`: 20 testes sobre a casca de verdade e a página da Pasta, incluindo a prova de que o escondido (Lista na lixeira) fica na vaga.

## Task Commits

1. **Task 1 (tracer): Subir/Descer no menu da árvore e a árvore por order** - `593a612` (feat; código, 13 testes e o ajuste do teste de 10-12)
2. **Task 2: a página da Pasta por order e com Mais ações, e a árvore sem hover** - `48cb05e` (feat; a página e 7 testes novos)

**Plan metadata:** commit docs(10-19) logo após este arquivo.

Tracer gate: modo `end-of-phase`, `<verify>` só automatizado, reexecutado verde (vitest dos arquivos, `tsc --noEmit`, eslint) antes da Task 2. Tracer verified end-to-end — expanding.

## Files Created/Modified

- `apps/web/src/features/shell/app-shell.tsx` - ordenação por `irmaosOrdenados`, contexto e `useMenuDeOrdem`, `aria-busy`, `onErro`, visibilidade sob `(hover: none)`
- `apps/web/src/app/(shell)/estrutura/pastas/[pasta]/page.tsx` - ordem gravada e «Mais ações»
- `apps/web/src/features/shell/arvore-menu.test.tsx` - 20 testes (novo)
- `apps/web/src/features/estrutura/mover-conteiner-dialog.test.tsx` - o teste do Membro sem administrar confere só o primeiro item

## Decisions Made

Ver `key-decisions` no frontmatter.

## Deviations from Plan

**1. [Rule 1 - Bug de teste] Teste de 10-12 afirmava o menu inteiro da Lista**
- **Found during:** Task 1
- **Issue:** `mover-conteiner-dialog.test.tsx` esperava que o ⋯ do Membro sem administrar tivesse só «Mover para…» (`toEqual([...])`); com «Subir» e «Descer» o menu tem três itens.
- **Fix:** o teste passa a conferir que o primeiro item é «Mover para…», desligado com a frase do domínio, como antes. Fora de `files_modified`.
- **Files modified:** `apps/web/src/features/estrutura/mover-conteiner-dialog.test.tsx`
- **Committed in:** `593a612`

**2. [Plano × forma] Copy nova: «Gravando a ordem…»**
- O item desligado precisa de um motivo (o `ActionMenu` só desliga com `disabledReason`), e o UI-SPEC pede os itens desligados durante a gravação sem dizer a frase. Usei «Gravando a ordem…», uma frase nova que não está no UI-SPEC; fica para a confirmação do dono junto com Q4.

**3. [Plano × ordem] Sem commit RED separado**
- O teste foi escrito antes e visto falhar (menu sem «Subir»/«Descer», `Unable to find` o botão «Ações de»), mas o RED não foi commitado à parte: o plano é `type: execute`, com um único commit por task. O teste da Task 2 nasceu verde contra a página já alterada no mesmo passo.

**Total deviations:** 3 (1 Rule 1 no teste, 2 ajustes de forma). **Impact:** nenhum no escopo funcional; o item 1 toca um arquivo fora do que o plano listava.

## Issues Encountered

- O `:scope > ul > li > div > a` do `querySelectorAll` basta para ler a ordem da árvore em jsdom; a ordem dos Espaços é lida por `a[id^='arvore-no-spc_']`.
- A Pasta Meus negócios aparece duas vezes em `Navegacao` (`MeusNegociosNoPainel` está duplicado nas linhas 560-572 de `app-shell.tsx`); já era assim antes deste plano e não é do escopo, fica registrado.

## Verification

- `apps/web`: `vitest run` inteiro, 82 arquivos / 762 testes verdes (`arvore-menu.test.tsx` 20, `visibilidade-na-tela.test.tsx` 7, `mover-conteiner-dialog.test.tsx` 23); `tsc --noEmit` limpo; `npm run lint -w @n1/web` sem erro (2 avisos que já existiam: `Target` em `app-shell.tsx` e `KnowledgeDocument` em `rotulos.ts`); `verificar:tokens` 0 falhas.
- Aceite: `irmaosOrdenados(` 3 vezes e `reorderContainers` 3 vezes em `app-shell.tsx`; `irmaosOrdenados(` 2 vezes e `Mais ações` 1 vez na página da Pasta.
- Domínio e `apps/api` não tocados (nada mudou ali); suíte completa do monorepo e e2e não rodados, conforme orientação do orquestrador.

## Known Stubs

None.

## Threat Flags

None - T-10-50 (Convidado sem ⋯, itens desligados pela frase de `recusaDeReordenar`, a recusa final é do domínio) e T-10-51 (`aria-busy` e itens desligados até a resposta de `runConfirmado`) mitigados e provados em `arvore-menu.test.tsx`.

## Lacunas registradas (premissas do plano)

- **UI S3/estouro e S3/carregando** (backstop visual, UAT em 10-17): o ⋯ não vazar da barra lateral nem da tela estreita, e a regra `(hover: none)` virar CSS de verdade.
- **Copy nova** «Gravando a ordem…» (ver Deviations 2).
- **A3/A4** de 10-04 seguem `owner-confirmation: pending`: um Membro comum que alcança a Pasta reordena as Listas dela, e a árvore reflete isso (Subir/Descer ligados para ele).
- **useRecente** (linha acesa depois de mover/reordenar) segue fora, como em 10-12.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Pronto para 10-13 (arrastar), que depende da ordem gravada na árvore e pode reaproveitar `OrdemDaArvoreContext.irmaos` e o estado `ocupado` para o `aria-busy` e a regra de enviar só os irmãos que o Membro alcança. Nenhum bloqueio.

## Self-Check: PASSED

- `arvore-menu.test.tsx`, `app-shell.tsx`, `pastas/[pasta]/page.tsx` e `mover-conteiner-dialog.test.tsx` presentes; commits `593a612` e `48cb05e` presentes na branch; `plan_head_before..HEAD` = 2 commits.

---
*Phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista*
*Completed: 2026-10-29*
