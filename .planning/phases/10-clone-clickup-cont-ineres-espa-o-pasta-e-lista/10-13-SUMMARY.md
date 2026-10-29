---
phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista
plan: 13
subsystem: web
tags: [est-06, d-08, d-09, d-10, d-12, drag-and-drop, html5, zonaDaSoltura, moveContainer, reorderContainers, arvore, ui-spec-s1]

requires:
  - phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista
    provides: "10-12: MoverConteinerDialog, openMover(id, destinoId) e o Toast de erro (noticeErro) da barra lateral; 10-19: OrdemDaArvoreContext, irmaos (a fatia visivel) e a arvore por irmaosOrdenados; 10-18: consequenciasDeMover; 10-04: reorderContainers"
provides:
  - "zonaDaSoltura/Zona: funcao pura das zonas antes/dentro/depois da arvore (A1, A2, A10), com numeros injetaveis"
  - "useArrastarNaArvore: o gesto em HTML5 nativo (estado do item em transito, recusa de L1 no Toast, dialogo de 10-12 quando L2 acusa consequencia, reordenar so com a fatia visivel, abrir ao pairar 600 ms)"
  - "TreeRow em linha-da-arvore.tsx, com draggable na div, draggable={false} no Link, origem a 60% e o realce da zona"
  - "frasePronta e Movel exportados de mover-conteiner-dialog.tsx: o gesto e o dialogo avisam com a mesma frase"
affects: [10-16, 10-17]

actuals:
  tokens: 18400
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Gesto de arrastar como hook fora da casca: o app-shell so entrega as props por contexto (OrdemDaArvoreContext.arrastar) e o TreeRow as aplica"
    - "A logica do gesto le espelhos sincronos (refs), nao o estado do React: um dragover pode chegar antes do commit do dragstart"
    - "Gravar da arvore num so lugar (gravar em StructureTree): reordenar, mover na hora e o aria-busy passam pelo mesmo runConfirmado"
    - "Linha receptora de soltura distinta da linha arrastavel: toda linha da Estrutura recebe (a recusa do dominio e o que a pessoa ve, A2); so quem administra o item arrasta"

key-files:
  created:
    - apps/web/src/features/shell/zona-de-soltura.ts
    - apps/web/src/features/shell/zona-de-soltura.test.ts
    - apps/web/src/features/shell/arrastar-na-arvore.ts
    - apps/web/src/features/shell/linha-da-arvore.tsx
    - apps/web/src/features/shell/arvore-arrastavel.test.tsx
  modified:
    - apps/web/src/features/shell/app-shell.tsx
    - apps/web/src/features/estrutura/mover-conteiner-dialog.tsx

key-decisions:
  - "TreeRow saiu do app-shell.tsx para linha-da-arvore.tsx. O arquivo ja estava em 1.322 linhas (10-12 e 10-19 o engordaram) contra o teto de 1.250 do plano; sem tirar a linha o gesto nao cabia. Resultado: 1.241 linhas."
  - "Toda linha da Estrutura (fora de Meus negocios) recebe a soltura; so arrasta quem administra o item (containerAdminRefusal; Espacos: recusaDeReordenar). Assim o Membro que arrasta para uma Pasta que nao administra ve a frase do dominio no Toast (A2) em vez de um cursor proibido."
  - "Meus negocios e o que mora nele ficam fora do gesto por inteiro (nem arrastam, nem recebem), como ja ficam fora do menu (A9)."
  - "O que a pessoa viu aceso e o que acontece: o drop usa a zona do ultimo dragover e so recalcula pelo clientY quando nao ha zona gravada para a linha."
  - "Pasta fechada so abre ao pairar se tem filhos visiveis e uma vez por gesto; o temporizador morre ao trocar de alvo, ao sair da arvore, no dragend e ao desmontar."
  - "Sair da arvore apaga o realce por dragleave da <ul> (relatedTarget fora dela), nao por dragleave de cada linha (Pitfall 8)."

patterns-established:
  - "Mover na hora so quando consequenciasDeMover nao acusa Conjunto, Campo, Tipo de Tarefa nem link publico; senao openMover(id, destinoId) e o dialogo decide"
  - "Reordenar por arrasto monta a ordem so com os irmaos que a arvore mostra e o Membro alcanca (10-04); o escondido o dominio deixa na vaga; soltar onde ja estava nao grava"

requirements-completed: [EST-06]

coverage:
  - id: D1
    description: "Arrastar a Lista \"Propostas\" para a Pasta \"Clientes\" move pelo dominio (moveContainer por runConfirmado), a arvore fica aria-busy ate a resposta, o aviso \"Lista Propostas movida para Clientes.\" so aparece depois dela, a Lista aparece dentro de \"Clientes\" e o foco vai para a linha movida"
    requirement: EST-06
    verification:
      - kind: automated_ui
        ref: "apps/web/src/features/shell/arvore-arrastavel.test.tsx#o traçador: soltar «dentro» da Pasta move pelo domínio, avisa só depois da resposta do servidor"
        status: pass
    human_judgment: false
  - id: D2
    description: "A div da linha e arrastavel e o Link nao (A10-bis); o dragstart leva so effectAllowed move e o tipo application/x-n1-conteiner; dragend apaga origem e realce; arrasto de fora da arvore nao acende zona nem aceita soltura (T-10-33)"
    requirement: EST-06
    verification:
      - kind: automated_ui
        ref: "arvore-arrastavel.test.tsx#a div da linha é arrastável, o Link não; #dragend apaga a origem e o realce; #um arrasto que não saiu da árvore"
        status: pass
    human_judgment: false
  - id: D3
    description: "zonaDaSoltura: Pasta 25/50/25, Lista e Espaco 50/50, quarto de baixo de Pasta aberta com filhos vale dentro, Espaco nunca dentro, Pasta sobre Subpasta e Pasta com Subpastas tambem sao alvo dentro, o proprio item, descendentes, o pai atual e Lista de outro pai nao sao alvo"
    requirement: EST-06
    verification:
      - kind: unit
        ref: "apps/web/src/features/shell/zona-de-soltura.test.ts (17 testes)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Soltar entre irmaos e Espacos reordena por reorderContainers so com os irmaos visiveis (o escondido fica na vaga), sem Toast, e soltar onde ja estava nao grava"
    requirement: EST-06
    verification:
      - kind: automated_ui
        ref: "arvore-arrastavel.test.tsx#soltar a Lista Gama em «antes» de Alfa; #depois de Beta; #onde a Lista já está; #o que a árvore esconde; #soltar um Espaço em «depois» de outro"
        status: pass
    human_judgment: false
  - id: D5
    description: "Pasta com Subpastas solta dentro de outra Pasta mostra a frase de recusaDeMover no Toast de erro e nada muda; Lista solta num Espaco de outro Conjunto abre o dialogo com ?mover=&destino= sem gravar; soltar no proprio pai nao faz nada e nao avisa"
    requirement: EST-06
    verification:
      - kind: automated_ui
        ref: "arvore-arrastavel.test.tsx#soltar uma Pasta com Subpastas «dentro» de outra Pasta; #soltar uma Lista «dentro» de um Espaço com outro Conjunto; #soltar em cima do próprio pai"
        status: pass
    human_judgment: false
  - id: D6
    description: "Durante a gravacao a arvore fica aria-busy, nenhum dragstart novo comeca e nenhuma zona e aceita; Convidado, Membro que nao administra e Meus negocios nao arrastam; Pasta fechada abre uma vez apos 600 ms e a abertura cancela ao sair"
    requirement: EST-06
    verification:
      - kind: automated_ui
        ref: "arvore-arrastavel.test.tsx#durante a gravação; #o Convidado vê a árvore inerte; #o Membro que não administra; #a Pasta «Meus negócios»; #Pasta fechada sob o ponteiro por 600 ms; #sair da Pasta fechada antes dos 600 ms"
        status: pass
    human_judgment: false
  - id: D7
    description: "Realce visual do alvo (fundo --acento-lavado + contorno --linha-acento para dentro; linha de 2px --acento para antes/depois), rolagem automatica da barra lateral perto da borda, arrasto por toque (iPadOS/Android) e draggable={false} no Safari"
    verification: []
    human_judgment: true
    rationale: "UI-SPEC S1 populated/overflow sao backstop visual e A9/I8 prometem so o menu no toque: o jsdom nao pinta, nao rola e nao arrasta por toque. Os testes afirmam o atributo data-soltura, nao a cor. Vai para a UAT de 10-17 (Chrome, Safari e toque)."

duration: 8min
completed: 2026-10-29
status: complete
plan_head_before: 61c6f1227b8bd4dc147f031276202db3c71664fb
plan_head_after: 549dac1dae8a4f15499e6747e2d2edffe57d0fab
commits: 2
---

# Phase 10 Plan 13: Arrastar na árvore Summary

**O dono arrasta uma Lista ou Pasta da árvore para cima de um Espaço ou Pasta e ela se move na hora (ou pelo diálogo de 10-12 quando algo muda), arrasta entre irmãos e Espaços para reordenar, vê a frase do domínio no Toast quando o domínio recusa, tudo em HTML5 nativo, sem biblioteca, e o Convidado continua com a árvore inerte.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-10-29T11:00:37Z
- **Completed:** 2026-10-29T11:08:04Z
- **Tasks:** 2
- **Files modified:** 7 (5 criados)

## Accomplishments

- `zona-de-soltura.ts`: `zonaDaSoltura(y, topo, altura, arrastado, alvo)` pura, com a tabela do UI-SPEC S1 (A1, A2, A10). 17 testes.
- `arrastar-na-arvore.ts`: `useArrastarNaArvore` com o item em trânsito em estado e espelho síncrono, `dataTransfer` só com `effectAllowed = "move"` e `application/x-n1-conteiner`, nada lido do `dataTransfer` em `dragover`, `preventDefault` só com zona válida. Soltar «dentro» pergunta `recusaDeMover` (Toast de erro com a frase literal), depois `consequenciasDeMover` (Conjunto, Campo, Tipo de Tarefa ou link público abrem `openMover(id, destinoId)`; senão `moveContainer` por `runConfirmado` e o aviso só depois da resposta). Soltar «antes/depois» monta a ordem com os irmãos visíveis que o Membro alcança e chama `reorderContainers` (Espaços com `pai: null`).
- `ABRIR_AO_PAIRAR_MS = 600`: contêiner fechado com filhos abre uma vez sob o ponteiro; o temporizador morre ao trocar de alvo, sair da árvore, `dragend` e desmontar.
- `StructureTree`: um só `gravar` (reordenar, mover na hora e `aria-busy` passam por ele), `onAviso` para o Toast de sucesso, props de arrastar por contexto (`OrdemDaArvoreContext.arrastar`); sem props para Convidado, para `MeusNegociosNoPainel` e para Meus negócios.
- `linha-da-arvore.tsx`: `TreeRow` com `draggable` na `div` (só quem administra), `draggable={false}` no `Link`, cursor `grab`/`grabbing`, origem a 60%, fundo + contorno para «dentro» e linha de 2px para «antes/depois» (`pointer-events: none`, `aria-hidden`).
- `arvore-arrastavel.test.tsx`: 18 testes sobre a casca de verdade com `fireEvent.dragStart/dragOver/drop/dragEnd`. Uma mutação (desligar o mover «dentro») os faz falhar: não são verdes por vazio.

## Task Commits

1. **Task 1 (tracer): arrastar "Propostas" para "Clientes" move na hora e avisa** - `3ba588a` (feat; zona, hook, linha, ligação na casca e os 4 testes do traçador)
2. **Task 2: reordenar, Espaços, diálogo, recusa, árvore inerte e temporizações** - `549dac1` (test; os 14 testes restantes, o código já estava no commit 1)

**Plan metadata:** commit docs(10-13) logo após este arquivo.

Tracer gate: modo `end-of-phase`, `<verify>` só automatizado, reexecutado verde (vitest dos dois arquivos, `tsc --noEmit`, eslint, checagem de dependência contra a `main`) antes da Task 2. Tracer verified end-to-end, expanding.

## Files Created/Modified

- `apps/web/src/features/shell/zona-de-soltura.ts` e `.test.ts` - a função pura das zonas e seus 17 testes
- `apps/web/src/features/shell/arrastar-na-arvore.ts` - o hook do gesto
- `apps/web/src/features/shell/linha-da-arvore.tsx` - `TreeRow` (extraída) com o arrastar
- `apps/web/src/features/shell/arvore-arrastavel.test.tsx` - 18 testes da árvore arrastável
- `apps/web/src/features/shell/app-shell.tsx` - `gravar` único, hook ligado, contexto com `arrastar`, `useArrastoDaLinha`, `onAviso` (1.241 linhas)
- `apps/web/src/features/estrutura/mover-conteiner-dialog.tsx` - `frasePronta` e `Movel` exportados

## Decisions Made

Ver `key-decisions` no frontmatter.

## Deviations from Plan

**1. [Rule 3 - Blocking] `TreeRow` extraída para `linha-da-arvore.tsx`**
- **Found during:** Task 1
- **Issue:** o plano diz que `app-shell.tsx` "já tem 1.150 linhas" e limita a 1.250; ele estava em 1.322 (10-12 e 10-19 o aumentaram). Qualquer prop nova estourava o teto.
- **Fix:** `TreeRow` (113 linhas) foi para arquivo próprio e o import voltou à casca. Arquivo final: 1.241 linhas.
- **Files modified:** `app-shell.tsx`, novo `linha-da-arvore.tsx` (fora de `files_modified`)
- **Committed in:** `3ba588a`

**2. [Rule 3 - Blocking] `frasePronta` e `Movel` exportados de `mover-conteiner-dialog.tsx`**
- O Toast do gesto tem de ser "a mesma frase do diálogo"; ela morava num helper privado. Só ganhou `export` (fora de `files_modified`). **Committed in:** `3ba588a`

**3. [Plano × critério] `grep -c "draggable={false}" app-shell.tsx >= 1` não vale literalmente**
- Com a `TreeRow` extraída, o `Link` com `draggable={false}` está em `linha-da-arvore.tsx` (contagem 1 lá, 0 em `app-shell.tsx`). A intenção do critério (A10-bis) está cumprida e coberta pelo teste "a div da linha é arrastável, o Link não". Os outros dois critérios da Task 1 e os da Task 2 passam (`getData` 0, MIME 1, `ABRIR_AO_PAIRAR_MS` 3, `aria-busy` 3, 1.241 linhas).

**4. [Plano × forma] Receber a soltura não exige administrar**
- O plano diz que as props de arrastar não vão "a quem não administra o item". Segui isso para ARRASTAR (`draggable`), mas as linhas continuam recebendo a soltura: A2 pede que todo Espaço/Pasta/Subpasta seja alvo e que a recusa do domínio apareça no Toast. Meus negócios e o que mora nele não arrastam nem recebem (A9).

**5. [Plano × ordem] Sem commit RED separado**
- Os testes da zona foram escritos antes do código; o RED não foi commitado à parte (plano `type: execute`, um commit por task). O código de reordenar, Espaços e temporizador nasceu junto com o traçador no mesmo hook e o commit da Task 2 trouxe os testes dele (padrão de 10-12). Para provar que os testes não são vazios, desliguei o mover «dentro» temporariamente: 3 testes falharam; revertido.

**Total deviations:** 5 (2 Rule 3, 3 ajustes de forma). **Impact:** nenhum no escopo funcional; 1 e 2 tocam arquivos fora do que o plano listava.

## Issues Encountered

- O jsdom não tem `DragEvent` nem calcula `getBoundingClientRect`: o teste põe o retângulo na linha e define `clientY` no evento com `Object.defineProperty`.
- O `fireEvent` devolve `false` quando o evento foi cancelado; usei isso para provar `preventDefault` só com zona válida (cursor "proibido" nas demais).
- A Pasta Meus negócios aparece duas vezes em `Navegacao` (`MeusNegociosNoPainel` duplicado, já registrado em 10-19). Continua fora do escopo.

## Verification

- `apps/web`: `vitest run` inteiro, 84 arquivos / 797 testes verdes (`arvore-arrastavel.test.tsx` 18, `zona-de-soltura.test.ts` 17, `arvore-menu.test.tsx`, `visibilidade-na-tela.test.tsx`, `mover-conteiner-dialog.test.tsx` intactos); `tsc --noEmit` limpo; `npm run lint -w @n1/web` sem erro (2 avisos que já existiam: `Target` em `app-shell.tsx` e `KnowledgeDocument` em `rotulos.ts`); `verificar:tokens` 0 falhas.
- Dependências: nenhuma nova em `apps/web/package.json` nem no `package.json` da raiz em relação à `main`; busca dos pacotes de arrastar conhecidos vazia.
- Domínio e `apps/api` não tocados; suíte completa do monorepo e e2e não rodados, conforme orientação do orquestrador.

## Known Stubs

None. O Toast de erro da barra lateral (`noticeErro`, que 10-12 deixou sem produtor) agora é aceso pela recusa do arrastar.

## Threat Flags

None - T-10-33 (sem item em trânsito nenhuma zona é aceita; teste de arrasto de fora), T-10-34 (sem `draggable` para Convidado, Membro sem administrar e Meus negócios; o domínio recusa de qualquer forma) e T-10-35 (dependências comparadas com a `main` e busca de pacotes de arrastar, ambas vazias) mitigados e provados.

## Lacunas registradas (premissas do plano)

- **UI S1/preenchido e estouro** (backstop, UAT em 10-17): a cor do realce, a rolagem automática da barra lateral perto da borda e Safari/toque (A9, I8). O teste afirma `data-soltura`, não o pixel.
- **Q4** (`owner-confirmation: pending`): Tipo de Tarefa e link público contam como consequência e abrem o diálogo; a copy delas é a de 10-12.
- **useRecente** (linha acesa por `--dur-realce` depois de mover) segue fora, como em 10-12 e 10-19: `moveContainer` devolve `ok(movido)` sem o id no formato que o hook pede.
- **Realce sobre área sem linha:** passar o ponteiro por cima de um botão da árvore (ex.: «Mostrar arquivados») não apaga o realce da última linha até sair da árvore ou soltar; soltar ali não faz nada.
- **Destino expandido depois de mover** (UI-SPEC, Estados): o destino fechado não é reaberto à força; a linha movida recebe o foco se está à vista, senão a do destino.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Pronto para 10-16/10-17: o gesto, o menu (10-12, 10-19) e o diálogo cobrem o mover e o reordenar; a UAT de 10-17 leva a conferência visual e o toque. Nenhum bloqueio.

## Self-Check: PASSED

- `zona-de-soltura.ts`, `zona-de-soltura.test.ts`, `arrastar-na-arvore.ts`, `linha-da-arvore.tsx`, `arvore-arrastavel.test.tsx`, `app-shell.tsx` e `mover-conteiner-dialog.tsx` presentes; commits `3ba588a` e `549dac1` presentes na branch; `plan_head_before..HEAD` = 2 commits.

---
*Phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista*
*Completed: 2026-10-29*
