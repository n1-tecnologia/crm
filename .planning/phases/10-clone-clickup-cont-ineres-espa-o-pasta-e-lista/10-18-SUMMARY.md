---
phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista
plan: 18
subsystem: dominio
tags: [est-05, d-11, d-16, rn-esp-09, rn-sub-11, rn-pas-14, moveContainer, recusaDeMover, consequenciasDeMover, estruturas-fixas, privacidade-b38a]

requires:
  - phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista
    provides: "10-03: moveContainer, recusaDeMover basica e mudancasDeConfiguracao; 10-04: reorderContainers e a ordenacao; 10-02: definesAspect e blockedAbove"
provides:
  - "recusaDeMover completa (L1): estrutura fixa, profundidade, bloqueio do destino, colisao de nome de Campo e Tipo, Formulario que o envio quebraria"
  - "consequenciasDeMover (L2) e ConsequenciasDeMover: conjuntoMuda, statusEmUso, camposQueSaem, valoresAfetados, tiposQueMudam, linksPublicosRevogados, sem mutar o estado"
  - "Atividade do mover por caso: Subpasta promovida a Pasta, Pasta rebaixada a Subpasta, Pasta movida, Lista movida"
  - "estruturas-fixas.ts: o conjunto fechado (Meus negocios, Contas a pagar, Contas a receber, Solicitacoes de pagamento) e ehEstruturaFixa"
  - "order por max + 1 nas criacoes de Espaco, Pasta e Lista (e nas copias por modelo), via proximaOrdem"
  - "fieldNameCollision, taskTypeNameCollision, blockedAtOrAbove e ASPECTOS_QUE_SUBSTITUEM exportados de configuration.ts"
affects: [10-12, 10-13, 10-16, 10-17]

actuals:
  tokens: 12100
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "Leitura 'como ficaria no caminho novo' por troca temporaria do pai do movido com try/finally (comPaiNoDestino), usada por mudancasDeConfiguracao e pela colisao de nome"
    - "Uma frase generica, sem nome, quando o que impede e de uma Lista que o ator nao administra (B38a)"
    - "proximaOrdem: toda entrada em grupo de irmaos usa max + 1, nunca length"

key-files:
  created:
    - packages/dominio/src/estruturas-fixas.ts
    - packages/dominio/src/estruturas-fixas.test.ts
  modified:
    - packages/dominio/src/operations/structure.ts
    - packages/dominio/src/operations/configuration.ts
    - packages/dominio/src/operations/mover-conteiner.test.ts

key-decisions:
  - "A colisao de nome (Q5) usa fieldNameCollision/taskTypeNameCollision com o movido ja no caminho novo (pai trocado em try/finally) e perguntada a partir de cada no da subarvore que define o Campo ou Tipo; assim so o caminho novo e a subarvore contam, e uma Lista irma do destino com Campo de mesmo nome nao recusa."
  - "As estruturas fixas ficam em estruturas-fixas.ts com dois ids escritos a mao (CR.listId e LISTA_ID), porque financeiro e solicitacao-de-pagamento-evolver chegam a tasks.ts, que importa structure.ts (ciclo de carga); CP e MEUS_NEGOCIOS_ID vem de modulos-folha. O teste confere os quatro contra a origem."
  - "A recusa da estrutura fixa vem depois de 'Ja esta aqui' e 'dentro de si' e antes da profundidade; 'destino dentro de Meus negocios' usa o caminho do destino, entao vale para Subpasta dele tambem."
  - "Formulario: so o campo que sai (em from e fora de to) conta; o nome do Formulario e do Campo so aparecem quando o ator administra a Lista; senao a frase e generica."
  - "Bloqueio: o movido sempre conta como no que pode definir, os descendentes na lixeira efetiva nao (mesmo criterio de sobrescritasAbaixo)."

patterns-established:
  - "blockedAtOrAbove: quem pergunta 'posso entrar aqui dentro' inclui o blocks do proprio destino; blockedAbove continua pulando o no"

requirements-completed: [EST-05]

coverage:
  - id: D1
    description: "Profundidade: Pasta com Subpastas para dentro de Pasta e Pasta para dentro de Subpasta sao recusadas com as frases da ontologia e nada muda; Subpasta promovida a Pasta, Pasta rebaixada a Subpasta e Pasta movida gravam a Atividade com os caminhos"
    requirement: EST-05
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/mover-conteiner.test.ts#moveContainer — profundidade, promoção e rebaixamento de Pasta"
        status: pass
    human_judgment: false
  - id: D2
    description: "Bloqueio (T-10-48): o movido ou um descendente que define statusSet, features ou defaultViews e recusado se o destino, o proprio destino ou um ancestral o bloqueia; Campos e Tipos (que acumulam) nao recusam (A5)"
    requirement: EST-05
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/mover-conteiner.test.ts#moveContainer — bloqueio, colisão de nome, Formulário e estrutura fixa > bloqueio do destino"
        status: pass
    human_judgment: false
  - id: D3
    description: "Colisao de nome de Campo e de Tipo de Tarefa no caminho novo recusa o mover (Q5, RN-PAS-14), sem recusar por Campo de Lista irma do destino"
    requirement: EST-05
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/mover-conteiner.test.ts#colisão de nome de Campo e de Tipo no caminho novo"
        status: pass
    human_judgment: false
  - id: D4
    description: "Formulario ativo que pergunta Campo que deixaria de valer recusa com 'o envio quebraria'; a frase nao cita Formulario nem Lista privada que o ator nao alcanca (B38a)"
    requirement: EST-05
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/mover-conteiner.test.ts#Formulário que o envio deixaria de aceitar"
        status: pass
    human_judgment: false
  - id: D5
    description: "Estruturas fixas (T-10-09): Contas a pagar, Contas a receber, Solicitacoes de pagamento e Meus negocios nao se movem, e nada entra em Meus negocios; os ids conferem com as constantes de origem"
    requirement: EST-05
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/mover-conteiner.test.ts#estruturas fixas (Q2/A7, T-10-09); packages/dominio/src/estruturas-fixas.test.ts"
        status: pass
    human_judgment: false
  - id: D6
    description: "consequenciasDeMover (L2) devolve o que muda sem mutar o estado, e recusaDeMover tem paridade com moveContainer (mapeamento completo) em todos os Espacos e Pastas do seed para Lista, Pasta, estruturas fixas e Membro sem administrar, e sobre o recorte de visibilidadePara"
    requirement: EST-05
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/mover-conteiner.test.ts#consequenciasDeMover — L2; #recusaDeMover × moveContainer — paridade (L1, Pitfall 6)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Pitfall 3: Espaco, Pasta e Lista criados entram depois do maior order do grupo, nunca no length; mover e criar em seguida nao repete order"
    requirement: EST-05
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/mover-conteiner.test.ts#contador `order` sem duplicata ao criar (Pitfall 3)"
        status: pass
    human_judgment: false
  - id: D8
    description: "Q2/A7, Q4, Q5 e A5 sao decisoes do pesquisador adotadas aqui (conjunto de estruturas fixas, forma de L2, colisao de nome, aspectos que acumulam nao recusam): implementadas e provadas, mas a regra de produto precisa da confirmacao do dono"
    verification: []
    human_judgment: true
    rationale: "owner-confirmation: pending - nenhum teste decide se o dono aceita o conjunto fechado de estruturas fixas, a leitura de A5 ou a forma de L2; vai para a lista da UAT de 10-17"

duration: 12min
completed: 2026-10-29
status: complete
plan_head_before: 5e116a5cefc9754129d328e1bf50210b4993f6ae
plan_head_after: 6a67e134116d9afa54e2f88868a2aa28026d75fc
commits: 6
---

# Phase 10 Plan 18: moveContainer completo Summary

**`moveContainer` agora recusa tudo que o D-11 e a pesquisa listam (profundidade, bloqueio, colisão de nome, Formulário, estruturas fixas) pela mesma `recusaDeMover` que a tela lê, promove e rebaixa Pasta com a Atividade certa, ganha a leitura `consequenciasDeMover` e criar passa a usar `max(order) + 1`.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-10-29T09:10:00Z
- **Completed:** 2026-10-29T09:22:17Z
- **Tasks:** 3
- **Files modified:** 5 (2 criados)

## Accomplishments

- **Profundidade (RN-SUB-11, RN-SUB-02):** Pasta com Subpastas para dentro de Pasta e qualquer Pasta para dentro de Subpasta são recusadas, nessa ordem, e o `parentId` não muda. A Atividade é escolhida pelo caso: "Subpasta promovida a Pasta", "Pasta rebaixada a Subpasta", "Pasta movida" (também Subpasta para outra Pasta) e "Lista movida", com o caminho em `before`/`after`.
- **Bloqueio (RN-ESP-09, T-10-48):** para cada aspecto que substitui (`statusSet`, `features`, `defaultViews`) que `definesAspect` diz que o movido ou um descendente define, recusa se o destino, o próprio `blocks` dele ou um ancestral bloqueia. `blockedAtOrAbove` (novo em `configuration.ts`) inclui o `blocks` do destino, que `blockedAbove` pula. Campos, Tipos e Automações (que acumulam) não recusam (A5).
- **Colisão de nome (Q5, RN-PAS-14):** Campo ou Tipo definido no movido ou abaixo com nome já efetivo no caminho novo recusa; reusa `fieldNameCollision`/`taskTypeNameCollision` (agora exportadas) com o movido já no caminho novo.
- **Formulário:** Formulário ativo de uma Lista da subárvore que pergunta um Campo que sai do caminho recusa com "o envio quebraria"; a frase só nomeia Formulário e Campo se o ator administra a Lista.
- **Estruturas fixas (Q2/A7, T-10-09):** `estruturas-fixas.ts` com Meus negócios, Contas a pagar, Contas a receber e Solicitações de pagamento; qualquer destino dentro de Meus negócios também é recusado, com frase própria.
- **L2 `consequenciasDeMover`:** `conjuntoMuda`, `statusEmUso` (uma vez cada, na ordem do Conjunto de origem), `camposQueSaem`, `valoresAfetados` (só Valores `ativo`), `tiposQueMudam`, `linksPublicosRevogados`, sem mutar o estado (teste compara o JSON antes e depois).
- **Paridade provada:** `moveContainer(…, mapeamento completo).ok === (recusaDeMover(…) === undefined)` para todos os Espaços e Pastas do seed (Lista com Tarefas pelo Proprietário e pelo Administrador, Pasta com Listas, Pasta com Subpastas, estruturas fixas, Membro que não administra) e, sobre `visibilidadePara`, a recusa e as consequências batem para destinos que o Membro vê.
- **Pitfall 3:** `proximaOrdem` (`max + 1`, 0 sem irmãos) em `createSpace`, `createFolder`, `createList` e nas Pastas/Listas criadas por modelo; `moveContainer` usa a mesma função.

## Task Commits

1. **Task 1 (tracer): profundidade, promoção e rebaixamento** - `e1da5c3` (test, RED: 6 casos) -> `bbcfef2` (feat)
2. **Task 2: bloqueio, colisão de nome, Formulário e estrutura fixa** - `d37e58e` (test, RED: 12 casos) -> `33fd6e5` (feat)
3. **Task 3: L2, paridade e `order` sem duplicata** - `6c0711e` (test, RED: 11 casos) -> `6a67e13` (feat)

**Plan metadata:** commit docs(10-18) logo após este arquivo.

RED (semantic assessment): em cada tarefa os casos novos falharam pelo motivo certo (a operação aceitava o que devia recusar, a Atividade saía "Pasta movida", `consequenciasDeMover is not a function`, `order` igual ao `length`). Na Task 3 os três testes de paridade já nasceram verdes, porque a Task 2 fechou as recusas; eles ficam como prova. Plano `type: execute`; o classificador `tdd-red-evidence` não foi exigido.

Tracer gate: modo `end-of-phase`, `<verify>` só automatizado, reexecutado verde (vitest do arquivo, 46 testes, e `tsc --noEmit`) antes da Task 2. Tracer verified end-to-end — expanding.

## Files Created/Modified

- `packages/dominio/src/operations/structure.ts` - recusas completas, `consequenciasDeMover`, `ConsequenciasDeMover`, `acaoDeMover`, `comPaiNoDestino`, `nosDaSubarvore`, `proximaOrdem`
- `packages/dominio/src/operations/configuration.ts` - `fieldNameCollision`, `taskTypeNameCollision`, `ASPECTOS_QUE_SUBSTITUEM` exportados; `blockedAtOrAbove` novo
- `packages/dominio/src/estruturas-fixas.ts` - o conjunto fechado e `ehEstruturaFixa`
- `packages/dominio/src/estruturas-fixas.test.ts` - confere os ids contra as constantes de origem
- `packages/dominio/src/operations/mover-conteiner.test.ts` - de 37 para 78 testes

## Decisions Made

Ver `key-decisions` no frontmatter.

## Deviations from Plan

**1. [Plano × ciclo] `estruturas-fixas.ts` criado**
- **Found during:** Task 2
- **Issue:** o plano manda importar as quatro constantes e só criar o arquivo se o import formar ciclo. `CR` (em `financeiro`) e `LISTA_ID` (em `solicitacao-de-pagamento-evolver`) chegam a `tasks.ts`, que importa `structure.ts`: o ciclo é certo, não só possível.
- **Fix:** o arquivo nasce já na Task 2, com `CP` e `MEUS_NEGOCIOS_ID` importados de módulos-folha e os outros dois ids escritos, mais o teste que confere os quatro.
- **Files modified:** `estruturas-fixas.ts`, `estruturas-fixas.test.ts`
- **Commit:** `33fd6e5`

**2. [Rule 2 - Missing critical] Colisão de nome medida no caminho novo, não no escopo do destino**
- **Found during:** Task 2
- **Issue:** chamar `fieldNameCollision(destino)` direto também enxerga o que está abaixo do destino (Listas irmãs), recusando mover uma Lista para uma Pasta cuja outra Lista tem Campo de mesmo nome, o que a RN-PAS-14 não manda recusar.
- **Fix:** o movido é colocado no caminho novo (try/finally) e a colisão é perguntada a partir de cada nó que define o Campo ou Tipo, então só o caminho novo e a subárvore do movido contam. Há teste do caso da Lista irmã.
- **Files modified:** `structure.ts`
- **Commit:** `33fd6e5`

**3. [Adição pequena] `blockedAtOrAbove` e `ASPECTOS_QUE_SUBSTITUEM` exportados**
- Não estão no plano; a frase de bloqueio do próprio destino precisa ser a mesma de `blockedAbove` (rótulos privados), e a lista dos aspectos que substituem já existia em `configuration.ts` e não devia ser copiada.

**Total deviations:** 3 (1 Rule 2, 1 ajuste de estrutura, 1 adição pequena). **Impact:** nenhum no escopo nem na interface pública do plano.

## Issues Encountered

- O teste do Formulário privado primeiro usou um Campo definido na própria Pasta movida; ele viaja com ela e nada quebra. Corrigido o teste (Campo definido no Espaço de origem), sem mudar a operação.
- O teste de Tipo contava a Tarefa "comum" como "Tarefa" do Espaço, mas a Tarefa nasce com o Tipo mais próximo da Lista ("Visita"); o teste passou a fixar o Tipo do Espaço de propósito.

## Verification

- `packages/dominio`: `vitest run` completo, 107 arquivos / 2102 testes verdes (`mover-conteiner.test.ts` 78, `operations.test.ts`, `estruturas-fixas.test.ts`, `registro.test.ts`, `quem-pode.test.ts`); `tsc --noEmit` limpo.
- `apps/api` e `apps/web`: `tsc --noEmit` limpos (não importam nada que mudou de forma).
- Suíte completa do monorepo e e2e não rodados, conforme orientação do orquestrador. Este plano não cria operação nova: registro, esquema, "Quem pode" e contagem (j) ficam como estavam.

## Known Stubs

None.

## Threat Flags

None - T-10-09 (conjunto fechado das estruturas fixas recusado no domínio, testes e paridade) e T-10-48 (recusa por `definesAspect` sobre o movido e descendentes contra o `blocks` do destino e dos ancestrais, testes) mitigados. A proibição B38a tem teste (frase sem o nome do Formulário nem da Lista privada).

## Lacunas registradas (premissas do plano)

- **A5, Q2/A7, Q4, Q5** (`owner-confirmation: pending`, UAT em 10-17): aspectos que acumulam não recusam o mover; conjunto fechado de estruturas fixas; forma de `consequenciasDeMover`; colisão de nome de Campo e Tipo recusa.
- **A8** (herdada de 10-03): Responsáveis que perdem `ver` não são liberados.
- **RESEARCH §5(f)** (herdada): referências a Status fora das Tarefas não são remapeadas.
- Mover uma Pasta que contém uma Lista fixa (por exemplo a Pasta Financeiro, com Contas a pagar e a receber) não é recusado: o conjunto fechado do plano são os quatro ids, e os ids não mudam; muda só o caminho. Ponto para a UAT.
- Os destinos e atores que o teste de paridade percorre são os do seed; o servidor decide pelo estado inteiro (Pitfall 6).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Pronto para 10-12 (diálogo "Mover para…") e 10-13 (arrastar), que usam `recusaDeMover` e `consequenciasDeMover` completos, e para 10-16 (merge A). Nenhum bloqueio.

## Self-Check: PASSED

- `estruturas-fixas.ts`, `estruturas-fixas.test.ts`, `structure.ts` (`consequenciasDeMover`), `configuration.ts` (`export function fieldNameCollision`) presentes; commits `e1da5c3`, `bbcfef2`, `d37e58e`, `33fd6e5`, `6c0711e` e `6a67e13` presentes na branch.

---
*Phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista*
*Completed: 2026-10-29*
