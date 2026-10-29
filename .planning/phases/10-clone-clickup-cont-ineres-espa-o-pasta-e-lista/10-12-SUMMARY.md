---
phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista
plan: 12
subsystem: web
tags: [est-06, d-10, d-11, mover-conteiner, recusaDeMover, consequenciasDeMover, runConfirmado, arvore, ui-spec-s2, ui-spec-s3]

requires:
  - phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista
    provides: "10-03/10-18: moveContainer, recusaDeMover (L1) e consequenciasDeMover (L2) completos; 10-04: reorderContainers e a regra de enviar so os irmaos que o Membro alcanca; 10-09/10-10: a pagina do Espaco e a pagina da Lista reescritas"
provides:
  - "MoverConteinerDialog, useMoverConteinerDialog, MOVER_PARAM e DESTINO_PARAM: o dialogo \"Mover para…\" por ?mover=<id>&destino=<id>, montado na casca"
  - "Item \"Mover para…\" no ⋯ das linhas de Pasta, Subpasta e Lista da arvore da Estrutura e no cabecalho da pagina da Lista"
  - "TreeRow.menu[].disabledReason, id estavel arvore-no-{id} no link de cada linha e Toast de erro na barra lateral"
  - "Select.semOpcoes e ConfirmDialog.confirmCarregando (design/components.tsx)"
affects: [10-13, 10-16, 10-17, 10-19]

actuals:
  tokens: 16600
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Dialogo de URL em duas pecas: o wrapper resolve ?mover= (id desconhecido ou inalcancavel nao abre, T-10-31) e o interno, com key pelo id, guarda destino e mapeamento sem vazar de um item para outro"
    - "Leitura do destino congelada ao gravar: a resposta do servidor muda o estado antes de o dialogo fechar, e uma leitura nova diria \"Ja esta aqui.\""
    - "Teste de tela sobre a casca de verdade (AppShell) com next/navigation reativo e transporte falso que devolve a copia como estado"

key-files:
  created:
    - apps/web/src/features/estrutura/mover-conteiner-dialog.tsx
    - apps/web/src/features/estrutura/mover-conteiner-dialog.test.tsx
  modified:
    - apps/web/src/features/shell/app-shell.tsx
    - apps/web/src/app/(shell)/estrutura/listas/[lista]/page.tsx
    - apps/web/src/design/components.tsx

key-decisions:
  - "O dialogo e montado FORA do <aside> da casca (irmao do trilho), nao ao lado do CreateContainerDialog: com o painel recolhido o <aside> some e o \"Mover para…\" da pagina da Lista abriria nada."
  - "MoverConteinerDialog aceita um onDone opcional (mensagem, id); a assinatura sem props do plano continua valida. A casca usa para o Toast de sucesso; 10-13 pode reusar."
  - "A dica de categoria que muda NAO promete o evento de conclusao: aplicarConfiguracaoEfetiva so troca o statusId e grava a Atividade \"Status alterado por remapeamento\"; nao grava conclusao."
  - "A pagina da Lista esconde \"Mover para…\" sempre que a Lista mora em Meus negocios (pastaDeNegocios), nao so no espelho comercial (/crm/): a regra A9 vale nos dois lados."
  - "Destino que veio por &destino= e o domínio recusa aparece no p role=alert e desliga Mover; nada espera o clique para dizer."

patterns-established:
  - "Nenhuma frase de recusa e escrita na tela: opcao desligada, p role=alert e motivo do botao leem recusaDeMover"

requirements-completed: [EST-06]

coverage:
  - id: D1
    description: "\"Mover para…\" no ⋯ da Lista \"Propostas\" da arvore abre o dialogo, escolher \"Clientes\" e confirmar move por runConfirmado(moveContainer), o aviso so aparece depois da resposta do servidor, a arvore mostra a Lista na Pasta nova e o foco vai para a linha movida; cancelar fecha e limpa ?mover="
    requirement: EST-06
    verification:
      - kind: automated_ui
        ref: "apps/web/src/features/estrutura/mover-conteiner-dialog.test.tsx#Mover para… — o traçador: a Lista \"Propostas\" vai para a Pasta \"Clientes\" (EST-06)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Mapeamento de Status quando o Conjunto muda (uma linha por Status em uso, Status do destino por order, categoria por extenso, dicas, Mover desligado com a contagem que falta), painel âmbar de Campos, Tipo e link público com singular e plural, sem tabela quando o Conjunto nao muda"
    requirement: EST-06
    verification:
      - kind: automated_ui
        ref: "apps/web/src/features/estrutura/mover-conteiner-dialog.test.tsx#Mover para… — o diálogo inteiro (D-11, L1, L2)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Recusas do domínio: opcao do destino desligada com a frase de recusaDeMover (Pasta com Subpastas para dentro de Pasta), recusa do servidor em p role=alert com o dialogo aberto e os campos preservados, Movendo… carregando sem fechar, Nenhum destino disponível."
    requirement: EST-06
    verification:
      - kind: automated_ui
        ref: "apps/web/src/features/estrutura/mover-conteiner-dialog.test.tsx#Mover para… — o diálogo inteiro (D-11, L1, L2); #Mover para… — sem destino disponível"
        status: pass
    human_judgment: false
  - id: D4
    description: "Seguranca (T-10-30, T-10-31, T-10-32, D-09/A9): destinos sem contêiner privado que o Membro nao alcanca, ?mover= desconhecido ou inalcancavel nao abre, Convidado sem ⋯, Meus negócios e suas Listas sem ⋯, Membro que nao administra com o item desligado pela frase de containerAdminRefusal"
    requirement: EST-06
    verification:
      - kind: automated_ui
        ref: "apps/web/src/features/estrutura/mover-conteiner-dialog.test.tsx#Mover para… — as linhas de Pasta, Subpasta e Lista da árvore (D-09, A9); #(T-10-30); #(T-10-31)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Cabeçalho da página da Lista: \"Mover para…\" é o último item do ⋯, abre o diálogo, some na Lista de Meus negócios e fica desligado sem permissão"
    requirement: EST-06
    verification:
      - kind: automated_ui
        ref: "apps/web/src/features/estrutura/mover-conteiner-dialog.test.tsx#Mover para… — o cabeçalho da página da Lista"
        status: pass
    human_judgment: false
  - id: D6
    description: "Q4 (owner-confirmation: pending): as linhas novas do painel âmbar (Tipo de Tarefa e link público revogado) nao existem no UI-SPEC aprovado; a copy foi inventada aqui e precisa da confirmacao do dono. Também texto longo (título, opções e Status) e a legibilidade do motivo longo dentro do menu: backstop visual, sem teste"
    verification: []
    human_judgment: true
    rationale: "owner-confirmation: pending - nenhum teste decide se a copy do Q4 serve ao dono; texto longo em título, Select e menu é conferência visual (UI-SPEC S2/S3 backstop); vai para a lista da UAT de 10-17"

duration: 16min
completed: 2026-10-29
status: complete
plan_head_before: a50cf18cf40a1b6a10dac8f48af2217c11dff428
plan_head_after: ad3179464794aa1a43c1ac493b8f4c3a3bcbe744
commits: 3
---

# Phase 10 Plan 12: Mover para… Summary

**O dono move Pasta, Subpasta e Lista pelo menu "⋯" da árvore ou da página da Lista, num diálogo que desliga os destinos que o domínio recusaria, pede o mapeamento de Status quando o Conjunto muda, avisa o que fica arquivado e só confirma depois da resposta do servidor.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-10-29T10:30:00Z (aprox.)
- **Completed:** 2026-10-29T10:46:18Z
- **Tasks:** 3
- **Files modified:** 5 (2 criados)

## Accomplishments

- `mover-conteiner-dialog.tsx`: o estado vive na URL (`?mover=` e `&destino=`), como `useMoveTaskDialog`. O destino é um `Select searchable` com Espaços, Pastas e Subpastas ativos que o Membro alcança (menos o próprio, o que mora dentro e o pai atual), cada opção que o domínio recusaria já desligada com a frase de `recusaDeMover` (§11). A tabela de Status vem de `consequenciasDeMover(...).statusEmUso` como pilha de `Field` (não `table`), com os Status do destino por `order` e a categoria por extenso (`STATUS_CATEGORY_LABEL`, A12). Gravar é `runConfirmado(moveContainer)`.
- Painel âmbar com "Campos que deixam de valer: …" e "{n} Valor fica/Valores ficam arquivado(s) nas Tarefas. Nada é apagado.", mais as duas linhas de Q4 (Tarefas que caem no primeiro Tipo e links públicos revogados).
- Recusas: opção desligada com o motivo, `p role="alert"` para a recusa do servidor (diálogo aberto, destino e mapeamento preservados) e `Movendo…` carregando sem fechar.
- Árvore da Estrutura: `useMenuDeMover` dá o "⋯" com "Mover para…" às linhas de Pasta, Subpasta e Lista; vazio para o Convidado (árvore inerte), para a Pasta Meus negócios e para tudo dentro dela (por `containerPath`, então vale também para Subpasta dela), e desligado com a frase de `containerAdminRefusal` para quem não administra. `MeusNegociosNoPainel` não passa `openMover`.
- `TreeRow`: link com `id="arvore-no-{id}"` (o foco vai para a linha movida, ou para a do destino, depois do fechamento) e `menu[].disabledReason`. A barra lateral ganhou o Toast de erro (não expira, dispensável, `role="alert"`).
- Página da Lista: "Mover para…" por último no "⋯", oculto na Lista de Meus negócios, desligado pela frase de `containerAdminRefusal`.

## Task Commits

1. **Task 1 (tracer): Mover para… na linha da Lista leva "Propostas" para "Clientes"** - `88144d7` (feat; código e os 3 testes do traçador)
2. **Task 2: o diálogo inteiro (mapeamento, painel âmbar, recusas)** - `3aac7ef` (test; 12 testes novos, o código já estava no commit 1)
3. **Task 3: ⋯ de Pasta e Subpasta e cabeçalho da página da Lista** - `ad31794` (feat; a página e 8 testes novos)

**Plan metadata:** commit docs(10-12) logo após este arquivo.

Tracer gate: modo `end-of-phase`, `<verify>` só automatizado, reexecutado verde (vitest do arquivo, `tsc --noEmit`, eslint) antes de seguir. Tracer verified end-to-end — expanding.

## Files Created/Modified

- `apps/web/src/features/estrutura/mover-conteiner-dialog.tsx` - hook, diálogo, destinos, tabela de Status, painel âmbar, frases do Toast
- `apps/web/src/features/estrutura/mover-conteiner-dialog.test.tsx` - 23 testes sobre a casca de verdade
- `apps/web/src/features/shell/app-shell.tsx` - menu de mover, `id` das linhas, Toast de erro, diálogo montado
- `apps/web/src/app/(shell)/estrutura/listas/[lista]/page.tsx` - item no cabeçalho (962 linhas)
- `apps/web/src/design/components.tsx` - `Select.semOpcoes`, `ConfirmDialog.confirmCarregando`, `break-words` no título

## Decisions Made

Ver `key-decisions` no frontmatter.

## Deviations from Plan

**1. [Rule 3 - Blocking] Dois ganchos novos em `design/components.tsx`, fora de `files_modified`**
- **Found during:** Task 1
- **Issue:** o plano afirma que o `Select` sem opções mostra "Nenhum destino disponível." e que o botão do `ConfirmDialog` fica "carregando"; nenhuma das duas coisas existia (o `Select` dizia `Nenhuma opção corresponde a “”.` e o `ConfirmDialog` não repassava `carregando` ao `Button`).
- **Fix:** `Select` ganha `semOpcoes` (só vale quando não há opção alguma; com busca sem resultado continua a frase da busca) e `ConfirmDialog` ganha `confirmCarregando`. De quebra, `break-words` no título do `ConfirmDialog`, para o nome longo em "Mover “…”" não estourar (UI S2/texto longo).
- **Files modified:** `apps/web/src/design/components.tsx`
- **Verification:** os testes do diálogo, `vitest run` do web inteiro (81 arquivos, 742 testes), `verificar:tokens`.
- **Committed in:** `88144d7`

**2. [Plano × ordem] Diálogo e menus da árvore saíram inteiros no commit da Task 1**
- O desenho do diálogo, o menu de Pasta/Subpasta e o `useMenuDeMover` nasceram juntos com o traçador (mesmo componente, mesmo arquivo). As Tasks 2 e 3 viraram, no histórico, o commit dos testes dessas partes (`3aac7ef`) e o da página + testes (`ad31794`). O código veio antes dos testes: não houve commit RED separado nem execução vista falhando. Os testes foram escritos contra o comportamento do plano e afirmam o texto e o estado, não a implementação; o plano é `type: execute`, então o classificador `tdd-red-evidence` não foi exigido.

**3. [Plano × arquitetura] Diálogo montado fora do `<aside>`**
- O plano manda montar "ao lado de `CreateContainerDialog`", que está dentro do `<aside>` e some com o painel recolhido. Como a página da Lista também abre o diálogo, ele foi montado como irmão do trilho. Consequência: com o painel recolhido, o Toast de sucesso (que vive no `<aside>`) não aparece; o mover acontece e a árvore está fechada de qualquer forma.

**4. [Adição pequena] `onDone` opcional no `MoverConteinerDialog`**
- `<interfaces>` dá a assinatura sem props. O Toast de sucesso precisa chegar à casca; `onDone?(mensagem, id)` é opcional e não quebra quem chamar sem props.

**5. [Plano × domínio] Sem "e geram o evento de conclusão"**
- Lido em `aplicarConfiguracaoEfetiva`: o remapeamento só troca `statusId` e grava "Status alterado por remapeamento"; não grava conclusão. A cauda ficou de fora, como o plano mandava nesse caso.

**6. [Escopo] `useRecente` (linha acesa depois de mover) não foi feito**
- Está no UI-SPEC (S1, "Acende a linha recém-movida") e não está no plano; ficou para quem tocar a árvore em 10-13/10-19. `moveContainer` devolve `ok(movido)` sem `id` no resultado, então `useRecente` precisaria de mais que este plano.

**Total deviations:** 6 (1 Rule 3, 5 ajustes de forma ou escopo). **Impact:** nenhum no escopo funcional nem na interface pública; 1 e 3 tocam arquivos/posições fora do que o plano listava.

## Issues Encountered

- O `AppShell` inteiro não renderiza em jsdom (`ResizeObserver` e `document.elementsFromPoint` no `RoboFlutuante`); o teste mocka o robô e o Guia do Financeiro e esconde o `ResizeObserver`.
- No seed, o Convidado (Beatriz) não tem nenhuma linha na árvore (o Espaço onde ela vê uma Lista é privado); o teste dele concede `ver` no Espaço Comercial e na Lista para ter linhas de verdade. Também descobri que a árvore "inerte" do Convidado inerte só o Espaço e a Pasta (sem link nem «+»): as Listas continuam links com o «+» de Tarefa, como já era. Este plano só garante que nenhuma linha ganha o «⋯».
- A Tarefa nasce com o Tipo mais próximo da Lista: o teste de Q4 cria o Tipo novo depois das Tarefas que não devem contar.

## Verification

- `apps/web`: `vitest run` inteiro, 81 arquivos / 742 testes verdes (`mover-conteiner-dialog.test.tsx` 23, `visibilidade-na-tela.test.tsx` 7); `tsc --noEmit` limpo; `npm run lint -w @n1/web` sem erro (3 avisos que já existiam: `Target` e `memberReachesContainer` em `app-shell.tsx`, `KnowledgeDocument` em `rotulos.ts`); `verificar:tokens` 0 falhas.
- Aceite: `MoverConteinerDialog` e `runConfirmado` presentes, `STATUS_CATEGORY_LABEL`, `consequenciasDeMover(` e `recusaDeMover(` presentes, `move-task-dialog.tsx` sem diff (A12), página da Lista com 962 linhas e "Mover para…" presente.
- Suíte completa do monorepo, e2e e `apps/api` não rodados (nada mudou no domínio nem na api; web não importa de nenhum deles além do que já importava).

## Known Stubs

- `apps/web/src/features/shell/app-shell.tsx`: o Toast de erro da barra lateral (`noticeErro`) é desenhado e dispensável, mas nada o acende ainda: a recusa de "Mover para…" mora no diálogo. O produtor é o arrastar de 10-13 (recusa de L1 vai ao Toast). Não impede o objetivo deste plano.

## Threat Flags

None - T-10-30 (destinos só de contêiner que o Membro alcança, teste com Espaço privado), T-10-31 (`?mover=` desconhecido ou inalcançável não abre, teste) e T-10-32 (Convidado sem «⋯», teste) mitigados; a recusa final continua do domínio e do servidor.

## Lacunas registradas (premissas do plano)

- **Q4** (`owner-confirmation: pending`, UAT em 10-17): a copy das linhas de Tipo de Tarefa e de link público do painel âmbar.
- **A5/I2:** Pasta rebaixada e Subpasta promovida não abrem confirmação extra no menu (o menu sempre abre o diálogo).
- **I6:** `move-task-dialog.tsx` continua com a categoria crua e "Tarefa(s)"; não foi editado.
- **Pitfall 6:** a cópia local pode não ver todas as Tarefas; o servidor pode pedir um mapeamento que o diálogo não mostrou, e a recusa aparece no `p role="alert"`.
- Texto longo em título, opções e Status, e o motivo longo de um item desligado dentro do menu, são backstop visual (UI-SPEC S2/S3), sem teste.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Pronto para 10-13 (arrastar), que reaproveita `openMover(id, destinoId)` e o diálogo quando há consequência, e para 10-19 (Subir/Descer e "Mais ações" da Pasta), que acrescenta itens ao `useMenuDeMover` e à página da Pasta. Nenhum bloqueio.

## Self-Check: PASSED

- `mover-conteiner-dialog.tsx`, `mover-conteiner-dialog.test.tsx`, `app-shell.tsx`, `listas/[lista]/page.tsx` e `components.tsx` presentes; commits `88144d7`, `3aac7ef` e `ad31794` presentes na branch; `plan_head_before..HEAD` = 3 commits.

---
*Phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista*
*Completed: 2026-10-29*
