---
phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista
plan: 03
subsystem: dominio
tags: [est-05, est-11, d-11, d-20, moveContainer, recusaDeMover, b37, quem-pode, privacidade-b38a]

requires:
  - phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista
    provides: "10-02: a cadeia de registro de uma operação de Estrutura como molde (registro, index, esquema, Quem pode, contagem 288) e definesAspect"
provides:
  - "moveContainer(folder|list): muda a Pasta ou Lista de pai, com a Atividade 'Lista movida'/'Pasta movida' e os caminhos de origem e destino"
  - "recusaDeMover: fonte única das recusas básicas (administrar o movido, alcançar e criar no destino, destino ativo, já está aqui, dentro de si, nome repetido)"
  - "aplicarConfiguracaoEfetiva, statusSemMapeamento e frasePedindoMapeamento extraídos de moveTask e usados também por moveContainer"
  - "Folder.parentType/parentId e List.parentType/parentId mutáveis"
  - "cadeia de registro fechada: registro, index, esquema DESTINO_DE_MOVER, Quem pode, contagem 289"
affects: [10-12, 10-16, 10-18]

actuals:
  tokens: 9200
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "A regra por Tarefa de quem muda de configuração efetiva mora numa função só (aplicarConfiguracaoEfetiva); moveTask e moveContainer a chamam, nunca duplicam o laço"
    - "Cálculo de 'antes e depois' sem deixar o estado mudado: troca o pai, lê a configuração, restaura em finally (mudancasDeConfiguracao); 10-18 reusa em consequenciasDeMover"
    - "Destino que o ator não alcança passa por requireContainer e devolve 'não encontrado' antes de qualquer outra frase"

key-files:
  created:
    - packages/dominio/src/operations/mover-conteiner.test.ts
  modified:
    - packages/dominio/src/operations/structure.ts
    - packages/dominio/src/operations/tasks.ts
    - packages/dominio/src/operations/registro.ts
    - packages/dominio/src/operations/index.ts
    - packages/dominio/src/types/structure.ts
    - packages/dominio/CONTEXT.md
    - apps/api/src/rotas/esquemas/estrutura.ts
    - apps/api/src/rotas/esquemas/estrutura.test.ts
    - apps/api/src/rotas/esquemas-de-argumentos.test.ts

key-decisions:
  - "O mover grava no movido a ordem 'fim do grupo de destino' (max(order)+1, ou 0) e renumera o grupo de origem de 0 a n-1 pela ordem atual; o grupo é por tipo (Pastas com Pastas, Listas com Listas) e por pai."
  - "A Atividade usa o caminho do PRÓPRIO movido, como moveTask (Comercial › Origem A › Propostas), não o do pai."
  - "Uma Pasta ou Lista na lixeira não se move ('restaure antes de mover'); arquivada, sim (RN-PAS-11)."
  - "Containers não têm updatedAt (só Tarefa tem): o mover registra a mudança na Atividade; nas Tarefas, updatedAt só muda para as que a regra realmente tocou."

patterns-established:
  - "recusaDeMover devolve só a frase (L1); a operação usa internamente a versão com o campo ('nome') para a tela marcar o campo"

requirements-completed: [EST-05, EST-11]

coverage:
  - id: D1
    description: "A Lista vai para outra Pasta com o mesmo Conjunto: Tarefas intactas, Atividade 'Lista movida' com caminho antigo e novo, entra no fim do grupo de destino e a origem é renumerada"
    requirement: EST-05
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/mover-conteiner.test.ts#moveContainer — a Lista vai para outra Pasta com o mesmo Conjunto (EST-05)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Recusas básicas: sem administrar o movido, destino arquivado, nome repetido, destino igual ao pai atual, Pasta dentro de si ou de descendente; destino privado que o ator não alcança devolve 'não encontrado' sem citar o nome (T-10-07, T-10-08)"
    requirement: EST-05
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/mover-conteiner.test.ts#moveContainer — a Lista vai para outra Pasta com o mesmo Conjunto (EST-05)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Conjunto de Status que muda exige mapeamento de cada Status em uso (todos os ciclos de vida, Subtarefas), recusa sem mudar nada com a frase 'Mapeie …', e só as Listas cujo Conjunto muda entram"
    requirement: EST-05
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/mover-conteiner.test.ts#moveContainer — Conjunto de Status, B37, Tipo de Tarefa e link público (EST-05)"
        status: pass
    human_judgment: false
  - id: D4
    description: "B37: Valores de Campo que deixam de valer ficam arquivados e voltam a ativo na volta, sem apagar; Tipo sem efeito cai no primeiro do destino; link público revogado sem a Funcionalidade (T-10-10)"
    requirement: EST-05
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/mover-conteiner.test.ts#moveContainer — Conjunto de Status, B37, Tipo de Tarefa e link público (EST-05)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Cadeia de registro: POST /operacoes/moveContainer aceita só folder|list e destino estrito, linha em Quem pode, contagem 289; moveTask segue passando sem edição dos testes"
    requirement: EST-11
    verification:
      - kind: unit
        ref: "apps/api/src/rotas/esquemas/estrutura.test.ts; apps/api/src/rotas/esquemas-de-argumentos.test.ts#(j); packages/dominio/src/quem-pode.test.ts; packages/dominio/src/operations/operations.test.ts"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-10-29
status: complete
plan_head_before: ff05366b4a655e46a905834c3660d022dc67afa6
plan_head_after: a714a27ef525b2a4b49f3280ea612632e1620b9e
commits: 4
---

# Phase 10 Plan 03: moveContainer Summary

**`moveContainer` muda Lista ou Pasta de lugar pela operação registrada, com `recusaDeMover` como fonte única das recusas e o laço por Tarefa de `moveTask` extraído para `aplicarConfiguracaoEfetiva`, usado pelas duas operações.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-10-29T08:50:00Z
- **Completed:** 2026-10-29T08:58:00Z
- **Tasks:** 2
- **Files modified:** 10 (1 criado)

## Accomplishments

- `moveContainer(state, ator, "folder"|"list", id, destino, mapeamento?)` e `recusaDeMover` (L1) em `operations/structure.ts`. Ordem das guardas: o movido existe e o ator o alcança, administrar o movido, movido fora da lixeira, destino alcançável (senão "Pasta/Espaço não encontrad…", RN-ESP-15) e efetivamente ativo, `mayBuild` no destino, "Já está aqui.", "Um contêiner não vai para dentro de si mesmo.", nome repetido entre os irmãos do destino (campo `nome`).
- Pitfall 3 (parte deste plano): o movido entra no fim do grupo do destino (`max(order)+1`, ou 0) e o grupo de origem é renumerado 0..n-1.
- Task 1 (traçador): Atividade "Lista movida"/"Pasta movida" com o caminho do movido antes e depois (`Comercial › Origem A › Propostas`).
- Task 2: `mudancasDeConfiguracao` lê `from`/`to` por Lista da subárvore sem deixar o estado mudado; Listas cujo Conjunto muda formam o conjunto que exige mapeamento (Tarefas de qualquer ciclo de vida, Subtarefas incluídas); faltando, recusa com a frase "Mapeie …" de `moveTask` e nada muda (nem `parentId`).
- `tasks.ts`: `statusSemMapeamento`, `frasePedindoMapeamento` e `aplicarConfiguracaoEfetiva` extraídos de `moveTask`; os 236 testes de `operations.test.ts` seguem passando sem edição.
- Cadeia de registro: `registro.ts`, `index.ts` (instrumentada), esquema `moveContainer` com `FOLDER_OU_LIST` e `DESTINO_DE_MOVER` estrito (o Espaço não se move), `opcional(z.array(STATUS_MAPPING))`, linha em "Quem pode", contagem (j) 288 -> 289.
- `Folder` e `List`: `parentType`/`parentId` sem `readonly`; `tsc` limpo no domínio, na api e na web.

## Task Commits

1. **Task 1 (tracer): a Lista vai para outra Pasta com o mesmo Conjunto, por `POST /operacoes/moveContainer`** - `af0e681` (test, RED: 10 casos falhando) -> `bc71e89` (feat, GREEN)
2. **Task 2: Conjunto que muda, B37, Tipo e link público pelo laço extraído** - `ae25f81` (test, RED: 8 casos falhando) -> `a714a27` (feat, GREEN)

**Plan metadata:** commit docs(10-03) logo após este arquivo.

RED (semantic assessment): em Task 1 os 10 casos falharam porque `moveContainer` não existia; em Task 2 oito casos falharam porque a operação ainda não pedia mapeamento nem aplicava a regra por Tarefa (a Lista movia sem remapear, sem arquivar Campo, sem trocar Tipo e sem revogar link). Plano `type: execute`; o classificador `tdd-red-evidence` não foi exigido.

Tracer gate: modo `end-of-phase`, verify só automatizado, reexecutado verde (domínio e api) antes da Task 2.

## Files Created/Modified

- `packages/dominio/src/operations/structure.ts` - `moveContainer`, `recusaDeMover`, `DestinoDeMover` e os auxiliares internos
- `packages/dominio/src/operations/tasks.ts` - `aplicarConfiguracaoEfetiva`, `statusSemMapeamento`, `frasePedindoMapeamento`; `moveTask` passa a chamá-las
- `packages/dominio/src/types/structure.ts` - pai mutável em `Folder` e `List`
- `packages/dominio/src/operations/registro.ts`, `index.ts` - registro e instrumentação
- `packages/dominio/CONTEXT.md` - linha `moveContainer` em "Quem pode"
- `packages/dominio/src/operations/mover-conteiner.test.ts` - 18 testes (EST-05)
- `apps/api/src/rotas/esquemas/estrutura.ts`, `estrutura.test.ts`, `esquemas-de-argumentos.test.ts` - esquema, formas, recusas de transporte, contagem 289

## Decisions Made

Ver `key-decisions` no frontmatter.

## Deviations from Plan

**1. [Rule 2 - Missing critical] Movido na lixeira recusado**
- **Found during:** Task 1
- **Issue:** o plano lista o movido arquivado como permitido (RN-PAS-11) mas não diz nada do movido na lixeira; mover algo na lixeira o deixaria numa árvore ativa sem restaurar.
- **Fix:** `recusarMover` recusa com "Pasta/Lista na lixeira: restaure antes de mover." (mesmo texto de `archiveContainer`).
- **Files modified:** `packages/dominio/src/operations/structure.ts`
- **Commit:** `bc71e89`

**2. [Plano × tipo] Sem `updatedAt` no contêiner**
- O plano manda gravar `updatedAt` ao mudar o pai, mas `Folder` e `List` não têm esse campo (só Tarefa). Não criei o campo; a Atividade registra a mudança. As Tarefas tocadas pela regra ganham `updatedAt`.

**3. [Adição pequena] `frasePedindoMapeamento` exportada**
- Não está em `<interfaces>`, mas a frase "Mapeie …" precisa ser a mesma nas duas operações; um helper exportado evita copiar o texto.

**Total deviations:** 3 (1 auto-added, 2 ajustes de forma). **Impact:** nenhum no escopo nem na interface pública do plano.

## Issues Encountered

None. Observação de estrutura: `structure.ts` agora importa valores de `tasks.ts`, que já importava `containerTrashRefusal` de `structure.ts`. É ciclo de módulos, mas só de declarações de função usadas na chamada, não na carga; suítes do domínio (2040), api e web verdes.

## Verification

- `packages/dominio`: `vitest run` completo, 2040 testes verdes (inclui `mover-conteiner.test.ts` 18, `quem-pode.test.ts`, `registro.test.ts`, `operations.test.ts` 236); `tsc --noEmit` limpo.
- `apps/api`: `DATABASE_URL= vitest run src/rotas/esquemas src/rotas/esquemas-de-argumentos.test.ts`, 26 arquivos / 93 testes verdes (asserção (j) = 289); `tsc --noEmit` limpo.
- `apps/web`: `tsc --noEmit` limpo (o `readonly` que sai não quebrou nenhum leitor).
- Suíte completa do monorepo e e2e não rodados, conforme orientação do orquestrador. Lint só existe para `@n1/web` (`npm run lint`), que este plano não toca.

## Known Stubs

None.

## Threat Flags

None - T-10-07 (`containerAdminRefusal` no movido e `mayBuild` no destino dentro de `recusaDeMover`, testes de Membro sem administrar), T-10-08 (destino inalcançável devolve "não encontrado" sem nome, teste com Pasta privada) e T-10-10 (B37 arquiva e devolve, teste de ida e volta) mitigados.

## Lacunas registradas (premissas do plano)

- **A8** (`owner-confirmation: pending`, UAT em 10-17): `moveContainer` não libera Responsáveis/Observadores que perdem `ver` ao entrar num Espaço privado, em paridade com `updateContainer`.
- **RESEARCH §5(f):** referências a Status por id fora das Tarefas (`RecurrenceRule.triggerStatusId`, `View.filters.statusId`, condições de Automação) não são remapeadas; `moveTask` também não.
- **Pitfall 6:** a cópia local pode não ver todas as Tarefas; o servidor (estado inteiro) pode recusar com "Mapeie…"; a tela mostra a recusa no diálogo (10-12).
- Entre 10-03 e 10-18 a operação ainda não recusa profundidade, bloqueio, colisão entre níveis, Formulário e estrutura fixa; nada é publicado entre os dois planos (o merge A é em 10-16).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Pronto para 10-18, que completa `recusaDeMover` (profundidade RN-SUB-11/RN-SUB-02, bloqueio RN-ESP-09, colisão Q5, Formulário, estruturas fixas Q2), cria `consequenciasDeMover` reusando `mudancasDeConfiguracao` e corrige `order` nas criações (`max + 1`). Nenhum bloqueio.

## Self-Check: PASSED

- `mover-conteiner.test.ts` presente; commits `af0e681`, `bc71e89`, `ae25f81` e `a714a27` presentes na branch.

---
*Phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista*
*Completed: 2026-10-29*
