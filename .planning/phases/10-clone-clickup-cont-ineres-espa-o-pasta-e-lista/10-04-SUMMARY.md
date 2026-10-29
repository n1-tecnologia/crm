---
phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista
plan: 04
subsystem: dominio
tags: [est-05, est-06, est-11, d-08, d-09, d-20, reorderContainers, recusaDeReordenar, irmaosOrdenados, quem-pode, seguranca]

requires:
  - phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista
    provides: "10-03: moveContainer, a renumeracao do grupo de origem e o molde da cadeia de registro (contagem 289)"
provides:
  - "reorderContainers(tipo, pai, ids): reordena Espacos, Pastas ou Listas por grupo e por fatia, regrava order 0..n-1 e grava 'Ordem alterada' no pai"
  - "recusaDeReordenar (L3): a frase unica que desliga Subir/Descer e o arrastar entre irmaos"
  - "irmaosOrdenados (F2): ordenacao estavel por order, desempate pela posicao no array, para a operacao, a arvore e as paginas"
  - "PaiDeConteiner (tipo) e esquema PAI_DE_CONTEINER; cadeia de registro fechada (contagem 290)"
  - "prova pela API real (Postgres local) de que mover e reordenar sobrevivem a hidratar de novo"
  - "conteineres-quem-pode.test.ts: as quatro operacoes novas sob Convidado, Membro sem administrar e suspenso"
affects: [10-09, 10-12, 10-17]

actuals:
  tokens: 12900
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Operacao de ordem por fatia: recebe os ids que o Membro ve, reocupa as vagas deles e deixa os escondidos no lugar; a mesma operacao vale na copia filtrada e no Espaco inteiro"
    - "irmaosOrdenados como unica ordenacao de irmaos (sort estavel; nao muda o array do estado)"
    - "Teste de seguranca com controle: cada recusa vem com a mesma chamada feita pelo Proprietario funcionando, para provar que o ok:false e do Papel"

key-files:
  created:
    - apps/api/src/rotas/mover-conteiner.test.ts
    - apps/api/src/seguranca/conteineres-quem-pode.test.ts
  modified:
    - packages/dominio/src/operations/structure.ts
    - packages/dominio/src/derive.ts
    - packages/dominio/src/types/structure.ts
    - packages/dominio/src/operations/registro.ts
    - packages/dominio/src/operations/index.ts
    - packages/dominio/src/operations/mover-conteiner.test.ts
    - packages/dominio/CONTEXT.md
    - apps/api/src/rotas/esquemas/estrutura.ts
    - apps/api/src/rotas/esquemas/estrutura.test.ts
    - apps/api/src/rotas/esquemas-de-argumentos.test.ts

key-decisions:
  - "D-08 com desvio A3 (owner-confirmation: pending): a operacao nao exige a permutacao completa do grupo; reocupa as vagas dos ids recebidos na sequencia recebida e deixa os irmaos nao citados onde estavam."
  - "A4 (owner-confirmation: pending): 'editar no pai' e mayBuild(pai); Espacos exigem Papel Administrador ou Proprietario. Consequencia registrada em teste: um Membro comum que alcanca a Pasta reordena as Listas dela."
  - "Um id que o ator nao alcanca (inclusive um Espaco privado que aparece na arvore dele so porque o caminho de uma Tarefa visivel passa por ele) recusa a operacao inteira com 'nao encontrado'; a tela (10-12) deve enviar so os ids que o Membro alcanca."
  - "PaiDeConteiner mora em types/structure.ts (derive.ts nao pode importar de operations) e e reexportado por operations/structure.ts."
  - "A Atividade 'Ordem alterada' so e gravada se a sequencia mudou; o detail traz o grupo (Espacos, Pastas ou Listas)."

patterns-established:
  - "recusaDeReordenar devolve so a frase (L3) e reorderContainers a chama primeiro"

requirements-completed: [EST-05, EST-06, EST-11]

coverage:
  - id: D1
    description: "reorderContainers reordena tres Listas de uma Pasta (0, 1, 2 na ordem pedida), grava 'Ordem alterada' na Pasta e mantem um irmao arquivado nao citado na mesma vaga"
    requirement: EST-05
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/mover-conteiner.test.ts#reorderContainers — o tracador (EST-05)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A ordem pedida e o lugar novo continuam depois de recarregar: POST /operacoes/reorderContainers e /moveContainer gravam e um hidratar novo devolve a ordem e o pai novo, com as Tarefas na mesma Lista"
    requirement: EST-06
    verification:
      - kind: integration
        ref: "apps/api/src/rotas/mover-conteiner.test.ts (Postgres local, 2 testes passados, nao pulados)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Bordas da ordem (EST-11): order igual sai estavel e o grupo fica 0..n-1; ids vazio, repetido, de Pasta num grupo de Listas e de outra Pasta sao recusados; um so id no lugar nao grava Atividade"
    requirement: EST-11
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/mover-conteiner.test.ts#reorderContainers — as bordas da ordem (EST-11)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Espacos reordenam pelo Administrador (Atividade no Espaco de Trabalho); Membro comum e Convidado sao recusados; recusaDeReordenar recusa pai arquivado e pai que o Convidado nao alcanca"
    requirement: EST-05
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/mover-conteiner.test.ts#reorderContainers — Espacos (D-09) e quem pode (A4, L3)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Paridade de recorte: a operacao na copia filtrada do Membro e no estado inteiro da a mesma ordem para os ids visiveis e os escondidos ficam na vaga (Listas e Espacos)"
    requirement: EST-05
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/mover-conteiner.test.ts#reorderContainers — paridade entre o recorte do Membro e o Espaco inteiro (A3, Pitfall 6)"
        status: pass
    human_judgment: false
  - id: D6
    description: "D-20: Convidado e Membro sem administrar recebem ok:false e o registro gravado nao muda; Membro suspenso recebe 403, nas quatro operacoes novas (moveContainer, reorderContainers, setContainerDefaultViews, setContainerBlock)"
    requirement: EST-11
    verification:
      - kind: integration
        ref: "apps/api/src/seguranca/conteineres-quem-pode.test.ts (Postgres local, 15 testes passados, nao pulados)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Cadeia de registro: esquema PAI_DE_CONTEINER, linha em Quem pode, contagem de operacoes 289 para 290"
    requirement: EST-11
    verification:
      - kind: unit
        ref: "apps/api/src/rotas/esquemas/estrutura.test.ts; apps/api/src/rotas/esquemas-de-argumentos.test.ts#(j); packages/dominio/src/quem-pode.test.ts; packages/dominio/src/operations/registro.test.ts"
        status: pass
    human_judgment: false
  - id: D8
    description: "A3 (reordenar por fatia) e A4 (quem pode reordenar) exigem confirmacao do dono: o comportamento esta implementado e provado, mas a regra de produto e uma suposicao"
    verification: []
    human_judgment: true
    rationale: "owner-confirmation: pending - o dono precisa confirmar se aceita o desvio do D-08 (permutacao completa) e se 'editar no pai' basta como mayBuild; nenhum teste decide isso"

duration: 8min
completed: 2026-10-29
status: complete
plan_head_before: e29234f1559aa66bd6028e4b0df297e6772c5314
plan_head_after: 77e0ef8f117c34e65e434cb39097b517e3403f49
commits: 3
---

# Phase 10 Plan 04: reorderContainers Summary

**`reorderContainers` reordena Espacos, Pastas ou Listas por grupo e por fatia (reocupa as vagas dos ids que o Membro ve e deixa os escondidos no lugar), com `irmaosOrdenados` como ordenacao estavel unica e a prova, pela API real contra Postgres local, de que mover e reordenar sobrevivem a hidratar de novo.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-10-29T09:00:32Z
- **Completed:** 2026-10-29T09:08:30Z
- **Tasks:** 2
- **Files modified:** 12 (2 criados)

## Accomplishments

- `reorderContainers(state, ator, tipo, pai, ids)` e `recusaDeReordenar` em `operations/structure.ts`. Ordem das guardas: `recusaDeReordenar` (pai existe e o ator o alcanca, pai efetivamente ativo, `mayBuild(pai)`; Espacos: Administrador ou Proprietario ativo e `pai: null`), depois `ids` vazio ("Nada a reordenar."), repetido ("Um conteiner aparece duas vezes na ordem."), id que o ator nao alcanca ("Lista nao encontrada.") e id fora do grupo ("{nome} nao pertence a este grupo."). As posicoes ocupadas pelos ids recebidos sao reocupadas na sequencia recebida; o grupo inteiro e regravado de 0 a n-1.
- `irmaosOrdenados(state, tipo, pai)` em `derive.ts`: grupo ordenado por `order`, desempate estavel pela posicao no array, todos os ciclos de vida, sem mexer no array do estado. Dado antigo com `order` repetido sai sempre na mesma sequencia e e compactado na primeira reordenacao.
- Atividade "Ordem alterada" no pai (Espacos: `objectType: "workspace"`, `objectId: state.workspace.id`), so quando a sequencia mudou; um unico id no lugar e aceito sem Atividade.
- Cadeia de registro: `registro.ts`, `index.ts` (instrumentada), esquema `reorderContainers` com `PAI_DE_CONTEINER` estrito e `.nullable()` e sem `.min()`/`.max()`, linha em "Quem pode" do `CONTEXT.md` do dominio, contagem (j) 289 -> 290.
- `apps/api/src/rotas/mover-conteiner.test.ts`: contra Postgres local, `POST /operacoes/reorderContainers` e `/moveContainer` gravam; um `hidratar` novo devolve a ordem 0, 1, 2 pedida, o `parentId` novo e as Tarefas na mesma Lista.
- `apps/api/src/seguranca/conteineres-quem-pode.test.ts` (15 testes): Convidado e B sem administrar recebem `ok: false` com o registro gravado igual antes e depois; suspenso recebe 403; um controle do Proprietario faz as quatro chamadas e elas funcionam.

## Task Commits

1. **Task 1 (tracer): reordenar tres Listas grava 0, 1, 2 e continua depois de hidratar** - `064c801` (test, RED: 2 casos falhando por `reorderContainers is not a function`) -> `0656328` (feat, GREEN)
2. **Task 2: bordas da ordem, Espacos, L3, paridade de recorte e suite de seguranca** - `77e0ef8` (test)

**Plan metadata:** commit docs(10-04) logo apos este arquivo.

RED (semantic assessment): em Task 1 os dois casos novos falharam porque a operacao nao existia (e `irmaosOrdenados` tambem). Em Task 2 a implementacao da Task 1 ja cobria as bordas, entao os casos novos nasceram verdes, exceto dois que falharam por erro do proprio teste (ver Deviations) e nao por defeito da operacao. Plano `type: execute`; o classificador `tdd-red-evidence` nao foi exigido.

Tracer gate: modo `end-of-phase`, verify so automatizado, reexecutado verde (dominio e api, banco local sem pular) antes da Task 2.

## Files Created/Modified

- `packages/dominio/src/operations/structure.ts` - `reorderContainers`, `recusaDeReordenar`, reexport de `PaiDeConteiner`
- `packages/dominio/src/derive.ts` - `irmaosOrdenados`
- `packages/dominio/src/types/structure.ts` - `PaiDeConteiner`
- `packages/dominio/src/operations/registro.ts`, `index.ts` - registro e instrumentacao
- `packages/dominio/CONTEXT.md` - linha `reorderContainers` em "Quem pode"
- `packages/dominio/src/operations/mover-conteiner.test.ts` - 19 testes novos (de 18 para 37)
- `apps/api/src/rotas/esquemas/estrutura.ts`, `estrutura.test.ts`, `esquemas-de-argumentos.test.ts` - esquema, formas e recusas, contagem 290
- `apps/api/src/rotas/mover-conteiner.test.ts` - mover e reordenar pela API com banco (novo)
- `apps/api/src/seguranca/conteineres-quem-pode.test.ts` - D-20 para as quatro operacoes (novo)

## Decisions Made

Ver `key-decisions` no frontmatter.

## Deviations from Plan

**1. [Plano × realidade] Teste de Espacos escrito com ids que o Administrador nao alcanca**
- **Found during:** Task 2
- **Issue:** o primeiro rascunho mandava todos os Espacos na ordem invertida como Administrador. O seed tem Espacos privados (Marketing, Gestao) que ele nao alcanca, e a operacao devolve "Espaco nao encontrado." para o lote inteiro, na copia filtrada e no estado inteiro, de forma consistente. Nao e defeito da operacao: e a regra T-10-11 do plano.
- **Fix:** os testes mandam so os Espacos que o Administrador alcanca (`memberReachesContainer`), verificam que os privados ficam na vaga, e ha um caso proprio para o "nao encontrado". Nenhuma mudanca na operacao.
- **Files modified:** `packages/dominio/src/operations/mover-conteiner.test.ts`
- **Commit:** `77e0ef8`

**2. [Plano × A4] "Membro sem administrar -> ok:false" nao vale para reordenar Listas de uma Pasta que ele alcanca**
- **Found during:** Task 2
- **Issue:** a verdade D-20 diz que Membro sem administrar recebe `ok: false` nas quatro operacoes, mas a verdade A4 (mesmo plano) define "editar no pai" como `mayBuild(pai)`, que um Membro comum alcancando a Pasta satisfaz. As duas nao cabem juntas para `reorderContainers` de Pastas e Listas.
- **Fix:** segui A4 (e o texto da RESEARCH A4). Em `conteineres-quem-pode.test.ts`, `reorderContainers` prova a recusa de B nos Espacos e com id de outra Pasta, e um caso `A4` registra de proposito que B reordena as Listas de uma Pasta que alcanca. Se o dono quiser `administrar` no pai, a troca e `containerAdminRefusal` em `recusaDeReordenar` e inverter esse caso. Segue `owner-confirmation: pending` para a UAT.
- **Files modified:** `apps/api/src/seguranca/conteineres-quem-pode.test.ts`
- **Commit:** `77e0ef8`

**Total deviations:** 2 (ajustes de teste e de interpretacao do plano; nenhuma mudanca de escopo). **Impact:** nenhum na interface publica do plano.

## Issues Encountered

None. Observacao para 10-12 (a arvore): a copia filtrada do Membro pode conter um Espaco privado que ele nao "alcanca" (o caminho de uma Tarefa visivel passa por ele). Como a operacao recusa o lote inteiro se um id nao e alcancado, a tela deve montar o pedido so com os irmaos que o Membro alcanca, nao com todos os que a arvore mostra.

## Verification

- `packages/dominio`: `vitest run` completo, 106 arquivos / 2059 testes verdes (`mover-conteiner.test.ts` 37, `quem-pode.test.ts`, `registro.test.ts`); `tsc --noEmit` limpo.
- `apps/api` contra Postgres local (`crm-n1-pg-1004`, porta 55704, `DATABASE_URL` e `DATABASE_URL_MIGRACAO` locais): `src/rotas/mover-conteiner.test.ts` (2 testes), `src/seguranca/conteineres-quem-pode.test.ts` (15 testes), `src/rotas/esquemas` e `esquemas-de-argumentos.test.ts` ((j) = 290): 110 testes verdes, nenhum pulado; `tsc --noEmit` limpo.
- `apps/web`: `tsc --noEmit` limpo.
- O conteiner `crm-n1-pg-1004` foi removido ao fim. Suite completa do monorepo e e2e nao rodados, conforme orientacao do orquestrador.

## Known Stubs

None.

## Threat Flags

None - T-10-11 (id de outro grupo, pai ou Espaco de Trabalho: recusado pelo dominio, testes de id de Pasta num grupo de Listas, de Lista de outra Pasta e inexistente; o estado e o do Espaco da sessao) e T-10-13 (Convidado, Membro sem administrar e suspenso nas quatro operacoes, provado em `conteineres-quem-pode.test.ts`) mitigados; T-10-12 aceito como no plano.

## Lacunas registradas (premissas do plano)

- **A3** (`owner-confirmation: pending`, UAT em 10-17): reordenar por fatia em lugar da permutacao completa do D-08.
- **A4** (`owner-confirmation: pending`, UAT em 10-17): `mayBuild(pai)` como "editar no pai"; um Membro comum que alcanca a Pasta reordena as Listas dela.
- **EST-11 precision:** nao se aplica, `order` e inteiro compactado 0..n-1. A premissa de que `plataforma.registros.ordem` mantem a posicao no array entre recargas foi conferida: o teste de banco hidrata de novo e a ordem volta igual.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Pronto para os planos que consomem a ordenacao (10-09 e 10-12: arvore e paginas do Espaco e da Pasta) e para a UAT de A3/A4 em 10-17. Nenhum bloqueio.

## Self-Check: PASSED

- `apps/api/src/rotas/mover-conteiner.test.ts` e `apps/api/src/seguranca/conteineres-quem-pode.test.ts` presentes; `irmaosOrdenados`, `reorderContainers` e `recusaDeReordenar` exportados; commits `064c801`, `0656328` e `77e0ef8` presentes na branch; `toBe(290)` em `esquemas-de-argumentos.test.ts`.

---
*Phase: 10-clone-clickup-cont-ineres-espa-o-pasta-e-lista*
*Completed: 2026-10-29*
