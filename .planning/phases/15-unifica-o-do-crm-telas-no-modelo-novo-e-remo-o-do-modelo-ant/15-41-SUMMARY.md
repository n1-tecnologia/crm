---
phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
plan: 41
subsystem: dominio-web
tags: [estrutura-fixa, pasta-meus-negocios, a9, arvore-da-estrutura, tdd, ucr-12, d-15-14]
status: complete

requires:
  - phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
    provides: "15-33: resposta 'seguir' da checkpoint; 15-26: o painel do CRM sem a arvore de Meus negocios; 15-31: o seed sem a Pasta (os testes a montam); 15-40: o espelho de Negocios fora da Lista"
provides:
  - "ehEstruturaFixa nao reconhece mais a Pasta Meus negocios: so as Listas Contas a pagar, Contas a receber e Solicitacoes de pagamento seguem fixas, com as mesmas recusas"
  - "moveContainer/recusaDeMover nao recusam mais mover a Pasta nem receber Pastas e Listas nela"
  - "A arvore da Estrutura (menu Subir/Descer/Mover para..., gesto de arrastar), a pagina da Pasta e a da Lista tratam Meus negocios como qualquer Pasta"
  - "PASTA_MEUS_NEGOCIOS_ID continua exportada (nenhuma regra a le); sai no 15-43"
affects: [15-42, 15-43]

plan_head_before: 6bc57570b0e948e93be9634c1ca873200f4a64a8
plan_head_after: 73cdcfe23025698c3af8198484fdc976fe36b099
commits: 5

actuals:
  tokens: 14000
  tasks: 2
  commits: 5

tech-stack:
  added: []
  patterns:
    - "proteger uma estrutura por id so enquanto algo a enderecar por id: sem o espelho, a protecao A9 saiu das duas camadas no mesmo plano"

key-files:
  created: []
  modified:
    - packages/dominio/src/estruturas-fixas.ts
    - packages/dominio/src/operations/structure.ts
    - packages/dominio/src/operations/mover-conteiner.test.ts
    - packages/dominio/src/estruturas-fixas.test.ts
    - packages/dominio/src/seed-comercial.ts
    - packages/dominio/CONTEXT.md
    - apps/web/src/features/shell/arrastar-na-arvore.ts
    - apps/web/src/features/shell/app-shell.tsx
    - apps/web/src/features/shell/linha-da-arvore.tsx
    - apps/web/src/features/shell/arvore-arrastavel.test.tsx
    - apps/web/src/features/shell/arvore-menu.test.tsx
    - apps/web/src/features/estrutura/mover-conteiner-dialog.test.tsx
    - "apps/web/src/app/(shell)/estrutura/pastas/[pasta]/page.tsx"
    - "apps/web/src/app/(shell)/estrutura/listas/[lista]/page.tsx"
    - apps/web/CONTEXT.md
    - .planning/WINDOWS.md

key-decisions:
  - "A constante PASTA_MEUS_NEGOCIOS_ID ficou exportada, como o plano decidiu; so o conjunto de Pastas fixas foi esvaziado (ehEstruturaFixa devolve false para toda Pasta). MEUS_NEGOCIOS_ID de seed-comercial.ts tambem fica: a tela da Lista, o script de migracao e os testes ainda o citam; sai no 15-43."
  - "A pagina da Lista (listas/[lista]/page.tsx) tambem escondia 'Mover para...' da Lista de Meus negocios (A9). O plano nao a listava em files_modified, mas o teste dele em mover-conteiner-dialog.test.tsx a cobre e o 'Nenhuma tela trata a Pasta como especial' a exige: tirei a protecao ali tambem."

requirements-completed: []

coverage:
  - id: D1
    description: "ehEstruturaFixa('folder', 'fld_meus_negocios') e false e as tres Listas fixas continuam true"
    requirement: UCR-12
    verification:
      - kind: test
        ref: "packages/dominio/src/estruturas-fixas.test.ts#reconhece as tres Listas fixas"
        status: pass
    human_judgment: false
  - id: D2
    description: "moveContainer aceita mover a Pasta e receber Listas e Pastas nela; mover para dentro de outra Pasta e voltar deixa a arvore como estava; as Listas fixas seguem recusadas"
    requirement: UCR-12
    verification:
      - kind: test
        ref: "packages/dominio/src/operations/mover-conteiner.test.ts#estruturas fixas (Q2/A7, T-10-09)"
        status: pass
      - kind: test
        ref: "packages/dominio/src/operations/mover-conteiner.test.ts#recusaDeMover x moveContainer - paridade"
        status: pass
    human_judgment: false
  - id: D3
    description: "a arvore da Estrutura da web oferece a Meus negocios o gesto de arrastar, o menu Subir/Descer/Mover para... e a pagina da Pasta e da Lista com Mais acoes e Mover para..."
    requirement: UCR-12
    verification:
      - kind: test
        ref: "apps/web/src/features/shell/arvore-arrastavel.test.tsx#a Pasta Meus negocios e uma Pasta comum"
        status: pass
      - kind: test
        ref: "apps/web/src/features/shell/arvore-menu.test.tsx#Meus negocios ... ganham"
        status: pass
      - kind: test
        ref: "apps/web/src/features/estrutura/mover-conteiner-dialog.test.tsx#Meus negocios"
        status: pass
    human_judgment: false
---

# Phase 15 Plan 41: A Pasta "Meus negocios" deixa de ser estrutura fixa Summary

**A Pasta "Meus negocios" virou uma Pasta comum no dominio e na arvore da Estrutura: `ehEstruturaFixa` nao a reconhece, `structure.ts` nao recusa mais mover nem receber nela, e a web tirou a protecao A9 do menu, do gesto de arrastar e das paginas da Pasta e da Lista; as tres Listas fixas do Financeiro continuam recusadas.**

## Precondicao

Satisfeita. `grep -n "^Resposta da checkpoint: seguir" .planning/phases/15-.../15-33-SUMMARY.md` devolveu a linha 109 (a resposta "seguir" dada pelo orquestrador, com a proveniencia logo abaixo), antes de qualquer edicao.

## O que foi feito

- **Task 1 (tracador, TDD)**: RED `9469015` (dominio: mover a Pasta, receber Lista e Pasta nela, ida e volta sem mudar a arvore, paridade `recusaDeMover` x `moveContainer`; web: a linha da Pasta arrasta e recebe soltura), GREEN `faa2833` (`estruturas-fixas.ts`, `structure.ts` sem a recusa de receber e sem o import da constante, `arrastar-na-arvore.ts` sem o ramo A9). Gate do tracador: o `<verify>` automatico foi rodado de ponta a ponta apos a implementacao (dominio e web, testes e `tsc`), passou; modo end-of-phase, `<verify>` so automatico, entao nenhuma checkpoint.
- **Task 2 (TDD)**: RED `0e9157a` (menu da arvore, pagina da Pasta e dialogo de mover), GREEN `18023d1` (`app-shell.tsx` sem `containerPath`/`MEUS_NEGOCIOS_ID` e sem os dois `return []` de `useMenuDeOrdem` e `useMenuDeMover`; `linha-da-arvore.tsx`; pagina da Pasta sem `moravelAqui`; pagina da Lista sempre com "Mover para..."). Docs `73cdcfe`: CONTEXT.md do dominio e da web e o comentario de `seed-comercial.ts`, que ainda prometia a saida do arquivo no 15-41.
- A leitura de `params` na pagina dinamica `pastas/[pasta]` nao foi tocada (continua `use(params)` sobre a Promise), como o plano mandou apos ler `dynamic-routes.md` e `page.md`.

## Verificacao

- Aceitacao: `grep -c "A9" arrastar-na-arvore.ts` = 0; `grep -c PASTA_MEUS_NEGOCIOS_ID structure.ts` = 0; soma de "A9" em `app-shell.tsx` + pagina da Pasta = 0.
- `packages/dominio` `vitest run`: 2406 passaram; `apps/web` `vitest run`: 1299 passaram (132 arquivos); `tsc --noEmit` nos dois.
- Guardas `CONGELADOS`/`sumidos`: as quatro listas de `sem-listas-espelho` e `sem-crm-antigo` (web e api) estao vazias e `sem-listas-espelho` do dominio tambem; so `packages/dominio/src/sem-crm-antigo.test.ts` tem lista, e `operations/structure.ts` continua nela por motivo que este plano nao tocou (linha 431 le `state.channels`). Nenhum arquivo que mudei saiu de leitura do CRM antigo, entao nao ha entrada velha. Os testes passaram.
- `npm run check` completo no Postgres local `crm-n1-pg-1541` (porta 55741, as duas URLs explicitas): typecheck, lint (0 erros; 2 avisos antigos de import nao usado, um em `rotulos.ts` e `Target` em `app-shell.tsx`, ambos anteriores ao plano), tokens, contratos, web 1299/1299 e dominio 2406/2406 verdes. `apps/api`: 2441 passaram, 3 falharam, todos baseline conhecido: `colunas-geradas.test.ts` (2 casos) e `outbox-worker.test.ts` caso (j). Isolados em contêiner NOVO: `colunas-geradas` 8/8 passou; `outbox-worker` falhou um caso diferente por tentativa em tres contêineres novos ((k), (k), (j)) e passou os outros 14, o padrao h-k do baseline; este plano nao toca `apps/api`.
- Contêiner `crm-n1-pg-1541` parado no fim.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] A pagina da Lista tambem escondia "Mover para..." da Lista de Meus negocios**
- **Found during:** Task 2
- **Issue:** `apps/web/src/app/(shell)/estrutura/listas/[lista]/page.tsx` (fora de `files_modified`) tinha a mesma protecao A9; o teste do plano (`mover-conteiner-dialog.test.tsx`) cobre a Lista de Meus negocios e a verdade do plano diz que a tela nao esconde mais o gesto.
- **Fix:** o item "Mover para..." passou a aparecer sempre; o comentario do arquivo agora diz que a Pasta deixou de ser fixa.
- **Files modified:** `apps/web/src/app/(shell)/estrutura/listas/[lista]/page.tsx`
- **Commit:** `18023d1`

**Total deviations:** 1 auto-fixed (Rule 2). **Impact:** uma tela a mais tocada, sem mudar contrato.

## Linhas do WINDOWS.md

- **Nova, aberta (#69)**: a Lista da Pasta Meus negocios ainda filtra as Tarefas com proveniencia `deal` (`pastaDeNegocios`), unico tratamento especial que restou na tela da Lista; sai com a Pasta (script, D-15-14) e a constante (15-43).
- **#51** (Pasta com Tarefa nao sai): a descricao continua valendo, nao mudou; segue aberta. Depois deste plano a Pasta e comum nos Espacos que a mantem, entao o dono pode reorganiza-la a mao.
- **#61** (Automacoes do seed que apontam para Listas espelho; a linha pede decisao "antes do 15-41"): fora do escopo deste plano, segue aberta e precisa de decisao do dono antes do corte.

## Known Stubs

Nenhum.

## Threat Flags

Nenhum. T-15-96 (aceito): a permissao de mover continua a da Estrutura (Papel e Espaco), nada e apagado.

## Self-Check: PASSED

- Arquivos modificados existem (`estruturas-fixas.ts`, `structure.ts`, `arrastar-na-arvore.ts`, `app-shell.tsx`, as duas paginas) e os 5 commits (`9469015`, `faa2833`, `0e9157a`, `18023d1`, `73cdcfe`) sao ancestrais de HEAD.
