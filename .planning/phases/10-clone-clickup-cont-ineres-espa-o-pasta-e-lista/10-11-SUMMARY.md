---
phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista
plan: 11
subsystem: ui
tags: [est-10, d-15, d-16, bloqueio, toggle, setContainerBlock, sobrescritasAbaixo, privacidade-b38a, configuracoes]

requires:
  - phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista
    provides: "10-02: setContainerBlock, sobrescritasAbaixo(…, memberId), bloqueioAcima, ASPECTOS_QUE_SUBSTITUEM; 10-08: CabecalhoDoAspecto e ReadOnlyNote exportado; 10-10: aba Visualizações"
provides:
  - "InterruptorDeBloqueio (exportado) dentro do CabecalhoDoAspecto: «Bloquear para os níveis abaixo» nas abas de aspecto do Espaço e da Pasta/Subpasta; a Lista nunca o mostra"
  - "Lista «Já definido em:» com um link por contêiner para …/configuracoes?aba={mesma aba}, quando um aspecto que substitui tem sobrescrita abaixo"
  - "Aspectos que acumulam (Campos, Tipos de Tarefa) nunca impedidos por descendentes; ligados, a dica «Os já criados continuam valendo.»"
affects: [10-18]

plan_head_before: b1c9ed7c0022b69adf1fcdba608927b57707c1a2
plan_head_after: c9933f38b9a305862527e6780a0d3908fe1e1baf

actuals:
  tokens: 7800
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Interruptor com gravação confirmada: useRunConfirmado devolve o resultado local (recusa imediata) e a promessa do servidor; o Toggle fica desligado até a promessa resolver e o Toast vem depois"
    - "A tela não decide a regra de bloqueio: chama setContainerBlock e mostra a frase do domínio; o que ela evita (impedido por descendentes) vem da mesma leitura da operação, sobrescritasAbaixo(…, memberId)"

key-files:
  created:
    - apps/web/src/features/estrutura/cabecalho-do-aspecto.test.tsx
  modified:
    - apps/web/src/features/estrutura/cabecalho-do-aspecto.tsx

key-decisions:
  - "O interruptor é interno ao CabecalhoDoAspecto e devolve um fragmento (linha do Toggle com ml-auto, mais linhas basis-full), então container-settings.tsx não mudou: o cabeçalho já recebia o tipo."
  - "Usa useRunConfirmado em vez de run: dá o estado «gravando» real e permite ao Toast de sucesso vir só depois da resposta; a recusa local (domínio) vira Toast de erro na hora e nada vai à rede."
  - "Ligado, o interruptor nunca fica impedido por descendentes (desligar é sempre permitido); o impedimento só vale para quem ainda vai ligar."
  - "O link usa as palavras Pasta/Subpasta/Lista como a recusa do domínio (Subpasta = Pasta cuja origem é outra Pasta)."

patterns-established:
  - "Mapa aspecto -> chave de ?aba= local ao cabeçalho (ABA_DO_ASPECTO): o link «Já definido em:» abre o contêiner na mesma aba"

requirements-completed: [EST-10]

coverage:
  - id: D1
    description: "Interruptor «Bloquear para os níveis abaixo» no Espaço e na Pasta: ligar roda setContainerBlock(true) com o Toast do aspecto, desligar roda (false) com o Toast de liberado; a Lista abaixo diz «Bloqueado por Espaço {nome}» e nunca mostra o interruptor"
    requirement: EST-10
    verification:
      - kind: unit
        ref: "apps/web/src/features/estrutura/cabecalho-do-aspecto.test.tsx#InterruptorDeBloqueio — o traçador (EST-10)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Aspecto que substitui com sobrescrita abaixo: interruptor desligado e impedido, «Já definido em:» com um link por contêiner (Pasta, Subpasta, Lista) para a mesma aba, aria-label e max-h-48 overflow-y-auto, e a frase «Volte a herdar neles para poder bloquear.» ligada por aria-describedby"
    requirement: EST-10
    verification:
      - kind: unit
        ref: "apps/web/src/features/estrutura/cabecalho-do-aspecto.test.tsx#InterruptorDeBloqueio — aspecto que substitui com sobrescrita abaixo (D-16)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Aspectos que acumulam (Campos, Tipos de Tarefa) nunca são impedidos por descendentes; ligados, mostram «Os já criados continuam valendo.» (A15)"
    requirement: EST-10
    verification:
      - kind: unit
        ref: "apps/web/src/features/estrutura/cabecalho-do-aspecto.test.tsx#InterruptorDeBloqueio — aspecto que acumula (A15)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Pasta privada que o Membro não alcança não entra na lista nem tem o nome na tela (B38a, T-10-28); o dono que a alcança a vê; forçar o bloqueio vira Toast de erro com a frase do domínio sem o nome privado"
    requirement: EST-10
    verification:
      - kind: unit
        ref: "apps/web/src/features/estrutura/cabecalho-do-aspecto.test.tsx#InterruptorDeBloqueio — privacidade da lista (B38a, T-10-28)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Sem permissão ou contêiner arquivado o interruptor fica desligado com a ReadOnlyNote (T-10-29); gravando fica desligado até a resposta e o Toast vem depois; recusa do servidor vira Toast de erro e o interruptor volta ao estado anterior"
    requirement: EST-10
    verification:
      - kind: unit
        ref: "apps/web/src/features/estrutura/cabecalho-do-aspecto.test.tsx#InterruptorDeBloqueio — quem pode, estado e erro (T-10-29)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Aparência da lista «Já definido em:» com um e com vários contêineres e com nome longo de Pasta ou Lista (link quebra linha ou trunca com title) e do interruptor na faixa em tela estreita"
    verification: []
    human_judgment: true
    rationale: "Backstop visual do UI-SPEC (S6 zero-um-muitos e texto longo): jsdom não mede layout; precisa de olho humano no navegador com contêineres de nome longo."

duration: 5min
completed: 2026-10-29
status: complete
commits: 4
---

# Phase 10 Plan 11: Interruptor de bloqueio por aspecto Summary

**Interruptor «Bloquear para os níveis abaixo» no `CabecalhoDoAspecto` do Espaço e da Pasta, chamando `setContainerBlock`, com a lista «Já definido em:» (links na mesma aba, sem contêiner privado) quando o bloqueio é impossível e a dica «Os já criados continuam valendo.» nos aspectos que acumulam.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-10-29T10:27:47Z
- **Completed:** 2026-10-29T10:32:30Z
- **Tasks:** 2
- **Files modified:** 2 (1 novo, 1 alterado)

## Accomplishments

- `InterruptorDeBloqueio` (exportado): rótulo visível ligado ao `Toggle` por `labelledBy`, só para `space` e `folder` (a Lista nunca, D-15). Ligar/desligar roda `setContainerBlock(…, !ligado)` por `useRunConfirmado`; gravando, o `Toggle` fica desligado até o servidor responder, e o Toast de sucesso (tabela «Aspecto × frase») vem depois. Recusa local ou do servidor vira `Toast tone="error"` com a frase do domínio, e o interruptor fica onde estava.
- Sem permissão ou contêiner arquivado/na lixeira: `Toggle` desligado e `ReadOnlyNote` com a frase de `containerAdminRefusal` ou a frase de inativo de `identidade-e-ciclo-de-vida.tsx`. Bloqueado por ancestral: o interruptor do próprio nível fica visível e desligado; a frase já vem da linha de origem.
- Aspectos que substituem (Status, Funcionalidades, Visualizações padrão) com sobrescrita abaixo: `Toggle` impedido e desligado, «Já definido em:» com um link por contêiner (`Pasta`/`Subpasta`/`Lista {nome}`) para `…/configuracoes?aba={mesma aba}`, `aria-label` do Copywriting, lista em `max-h-48 overflow-y-auto`, fecho «Volte a herdar neles para poder bloquear.», tudo ligado por `aria-describedby`. A lista vem de `sobrescritasAbaixo(…, memberId)`: a mesma leitura da operação, então contêiner privado inalcançável nunca é nomeado (B38a).
- Aspectos que acumulam (Campos, Tipos de Tarefa) não consultam descendentes; ligados, mostram «Os já criados continuam valendo.».
- `cabecalho-do-aspecto.test.tsx`: 21 testes.

## Task Commits

1. **Task 1 (tracer): ligar o interruptor de Status no Espaço bloqueia e a Lista abaixo diz «Bloqueado por»** - `f53617d` (test, RED: 5 de 6 casos falhando) -> `20608de` (feat, GREEN)
2. **Task 2: «Já definido em:», aspectos que acumulam e privacidade da lista** - `320e5ba` (test, RED: 6 casos falhando) -> `c9933f3` (feat, GREEN)

**Plan metadata:** commit `docs(10-11)` seguinte a este arquivo.

RED (semantic assessment): em Task 1 os cinco casos falharam por falta do `role="switch"` «Bloquear para os níveis abaixo» (o sexto, «a Lista nunca mostra o interruptor», já passava por ser uma negativa). Em Task 2 seis casos falharam por falta da lista, dos links e da dica; os de privacidade que já passavam travam que o nome privado nunca aparece. Plano `type: execute`; o classificador `tdd-red-evidence` não foi exigido.

Tracer gate: modo `end-of-phase`, verify só automatizado, reexecutado verde antes da Task 2 (`⚡ Tracer verified end-to-end — expanding`).

## Files Created/Modified

- `apps/web/src/features/estrutura/cabecalho-do-aspecto.tsx` - `InterruptorDeBloqueio`, `ABA_DO_ASPECTO`, `FRASE_DO_BLOQUEIO`; usado no `CabecalhoDoAspecto`
- `apps/web/src/features/estrutura/cabecalho-do-aspecto.test.tsx` - 21 testes (novo)

## Decisions Made

Ver `key-decisions`. `container-settings.tsx` ficou intacto (o plano o listava em `files_modified`, mas o encaixe é interno ao cabeçalho).

## Deviations from Plan

None - plan executed exactly as written. Duas escolhas de implementação dentro do que o plano deixa livre: `useRunConfirmado` em vez de `run` (necessário para o estado «gravando» real) e a nota de permissão sem repetir a frase de «Bloqueado por», que já vem da linha de origem.

## Issues Encountered

- O primeiro teste de gravação voltou sem chamadas: o `setContainerBlock` importado de `@n1/dominio/operations/configuration` não é a versão instrumentada. As telas importam as operações do barril `@n1/dominio/operations` (a que grava as chamadas para o servidor); corrigido antes do commit da Task 1.
- `npm run lint -w @n1/web` mostra 3 avisos `no-unused-vars` em `rotulos.ts` e `app-shell.tsx`, pré-existentes e fora do escopo.

## Verification

- `cd apps/web && npx vitest run src/features/estrutura src/design`: 213 testes verdes (inclui os 21 novos e os 18 de `container-settings.test.tsx`).
- `npx tsc --noEmit` (web), `eslint` nos arquivos tocados e `npm run verificar:tokens` sem erro. Suíte completa e e2e não rodados, por orientação do orquestrador.

## Known Stubs

None.

## Threat Flags

None - T-10-28 (lista via `sobrescritasAbaixo(…, memberId)`, testes da Pasta privada) e T-10-29 (`Toggle` desligado com a frase de `containerAdminRefusal`, operação recusa) mitigados.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- O bloqueio de aspecto está de ponta a ponta (domínio 10-02, tela 10-11). Pendente de olho humano: o backstop visual da lista «Já definido em:» com um e com vários contêineres e com nome longo (D6).

## Self-Check: PASSED

- `cabecalho-do-aspecto.test.tsx` presente; commits `f53617d`, `20608de`, `320e5ba` e `c9933f3` no histórico da branch.
- Aceitação: `Bloquear para os níveis abaixo`, `Volte a herdar neles para poder bloquear.` e `Os já criados continuam valendo.` presentes em `cabecalho-do-aspecto.tsx`; o teste da Pasta privada assere que o nome dela não está na tela.

---
*Phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista*
*Completed: 2026-10-29*
