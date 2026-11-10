---
phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
plan: 13
subsystem: crm
tags: [fichas, contato, empresa, negocio, sem-recuo, legado, tdd, ucr-06]
status: complete

requires:
  - phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
    provides: "15-05 (resumo/ficha com Empresa, qualificacao e Atribuido) e 15-06 (hooks dados/crm/* e guarda sem-crm-antigo com a lista CONGELADOS)"
provides:
  - "/crm/contatos/<id>, /crm/empresas/<id> e /crm/negocios/<id> so no modelo novo: 404 da api e 'Contato/Empresa/Negocio nao encontrado(a).'"
  - "features/crm/legado/ e seis arquivos de dialogo/popup legados apagados (~2,4 mil linhas)"
  - "paginas-de-contato.test.tsx: pagina de Contato sem recuo, mesclado e borda UCR-06"
affects: [15-14, 15-33, 15-40, 15-43]

plan_head_before: 4e479ab32a94e0c0f3607e98f3b6c2e3ecacbb5a
plan_head_after: 8d183e04cf6d9595f36a99dc1ff2501ed820bcd5

actuals:
  tokens: 2575
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "pagina que depende so de useX da api: 404 e 'nao encontrado', sem consultar o DataState"
    - "CONGELADOS da guarda sem-crm-antigo encolhe por plano de tela: arquivo que saiu do regex sai da lista (prova por grep e pelo proprio teste)"

key-files:
  created:
    - apps/web/src/features/crm/paginas-de-contato.test.tsx
  modified:
    - apps/web/src/app/(shell)/crm/contatos/[contato]/page.tsx
    - apps/web/src/app/(shell)/crm/empresas/[empresa]/page.tsx
    - apps/web/src/app/(shell)/crm/negocios/[negocio]/page.tsx
    - apps/web/src/features/crm/paginas-de-empresa.test.tsx
    - apps/web/src/features/crm/ficha-de-negocio.test.tsx
    - apps/web/src/features/crm/ficha-de-contato.test.tsx
    - apps/web/src/features/crm/mesclar-contato-dialog.tsx
    - apps/web/src/features/crm/transferir-identificador-dialog.tsx
    - apps/web/src/sem-crm-antigo.test.ts
    - apps/web/CONTEXT.md
  deleted:
    - apps/web/src/features/crm/legado/ficha-de-contato-legado.tsx
    - apps/web/src/features/crm/legado/ficha-de-empresa-legado.tsx
    - apps/web/src/features/crm/restore-copy-dialog.tsx
    - apps/web/src/features/crm/import-contacts-dialog.tsx
    - apps/web/src/features/crm/merge-contacts-dialog.tsx
    - apps/web/src/features/crm/transfer-identifier-dialog.tsx
    - apps/web/src/features/crm/empresa-popup.tsx

key-decisions:
  - "Id antigo em favorito mostra 'nao encontrado' (sem ponte por crm_de_para); como o script de migracao preserva ids, depois do corte o mesmo endereco abre a ficha nova"
  - "deal-screen.tsx fica: a Lista conversacional (dialogos-da-lista.tsx) ainda a embute; sai no 15-40 com o ultimo chamador"
  - "Os dez arquivos que deixaram de ler o CRM antigo (sete apagados e as tres paginas) sairam da lista CONGELADOS da web neste plano"

requirements-completed: [UCR-06]

coverage:
  - deliverable: "Ficha de Contato so no modelo novo (404 com id antigo no seed mostra 'Contato nao encontrado.')"
    verification:
      - { kind: test, ref: "apps/web/src/features/crm/paginas-de-contato.test.tsx#404 da api para um id que existe no modelo antigo tambem mostra Contato nao encontrado (sem recuo)", status: pass }
      - { kind: test, ref: "apps/web/src/features/crm/paginas-de-contato.test.tsx#borda UCR-06: abrir o mesmo id antigo de novo mostra o mesmo nao encontrado", status: pass }
    human_judgment: false
  - deliverable: "Contato mesclado continua levando ao sobrevivente; 200 desenha a ficha nova"
    verification:
      - { kind: test, ref: "apps/web/src/features/crm/paginas-de-contato.test.tsx#Contato mesclado (011) / 200 da api desenha a ficha nova", status: pass }
    human_judgment: false
  - deliverable: "Fichas de Empresa e Negocio so no modelo novo"
    verification:
      - { kind: test, ref: "apps/web/src/features/crm/paginas-de-empresa.test.tsx#(g) 404 ... Empresa nao encontrada (sem recuo, UCR-06)", status: pass }
      - { kind: test, ref: "apps/web/src/features/crm/ficha-de-negocio.test.tsx#404 da api para um id que existe no modelo antigo tambem mostra Negocio nao encontrado (sem recuo)", status: pass }
    human_judgment: false
  - deliverable: "Legado de ficha apagado (sete arquivos) sem outro chamador"
    verification:
      - { kind: command, ref: "test ! -e (cada arquivo) e npx tsc --noEmit sem erro", status: pass }
      - { kind: test, ref: "apps/web/src/sem-crm-antigo.test.ts", status: pass }
    human_judgment: false
  - deliverable: "Bookmark antigo cai em 'nao encontrado' e depois da migracao abre a ficha nova (efeito da preservacao de ids)"
    verification: []
    human_judgment: true
    rationale: "A metade 'depois da migracao' depende do script 15-27/15-28, que ainda nao rodou; so se confere com o banco migrado."
---

# Phase 15 Plan 13: Fichas de Contato, Empresa e Negocio so no modelo novo Summary

**As tres paginas de ficha perderam o recuo para o modelo antigo: 404 da api e "nao encontrado" mesmo quando o seed antigo conhece o id, e os sete arquivos que so serviam ao recuo (~2,4 mil linhas) foram apagados.**

## Performance

- **Duracao:** cerca de 8 min (08:30 a 08:38, horario local)
- **Tasks:** 2 (1 traçador, 1 auto), as duas `tdd="true"`
- **Arquivos:** 1 criado, 10 modificados, 7 apagados
- **Commits:** 4 (2 RED + 2 GREEN), medidos de `plan_head_before`

## Accomplishments

- **Traçador (Contato):** `contatos/[contato]/page.tsx` perdeu `useData(... contacts.some ...)` e o ramo de `FichaDeContatoLegado`. O 404 da api e sempre "Contato nao encontrado."; 200 desenha `FichaDeContato`; `mesclado` segue levando ao sobrevivente (Fase 14). Apagados `legado/ficha-de-contato-legado.tsx`, `restore-copy-dialog.tsx`, `merge-contacts-dialog.tsx`, `transfer-identifier-dialog.tsx` e `import-contacts-dialog.tsx`; os comentarios de `mesclar-contato-dialog.tsx` e `transferir-identificador-dialog.tsx` que citavam os arquivos apagados foram reescritos (sem mudar comportamento).
- **Empresa e Negocio:** mesmas duas paginas sem `useData`/`noModeloAntigo`; `DealScreen` saiu da pagina de Negocio. Apagados `legado/ficha-de-empresa-legado.tsx` (a pasta `legado/` deixou de existir) e `empresa-popup.tsx`. `deal-screen.tsx` continua (a Lista conversacional ainda a embute, ver `dialogos-da-lista.tsx`); sai no 15-40.
- **Guarda `sem-crm-antigo`:** dos 57 arquivos congelados da web, dez saem da lista (os sete apagados e as tres paginas, que deixaram de casar o regex). O teste continua verde, o que prova por execucao que nenhum deles le mais `state.contacts|companies|deals`.
- **Testes:** `paginas-de-contato.test.tsx` (novo) cobre 404 sem registro, 404 com id antigo no seed, a borda UCR-06 (abrir o mesmo id antigo duas vezes), 200 e mesclado. Os casos de pagina que viviam em `ficha-de-contato.test.tsx` (i, j, k) foram movidos para la; os casos de Empresa e Negocio que esperavam a ficha antiga agora esperam "nao encontrada".
- **CONTEXT da web:** o paragrafo "Limitacao aceita (D-15)" descreve as fichas sem recuo.

## TDD

| Task | RED | GREEN |
|------|-----|-------|
| 1 (tracer, Contato) | `cab2437` | `32d474e` |
| 2 (Empresa e Negocio) | `a781c77` | `8d183e0` |

Avaliacao semantica do RED: na Tarefa 1 dois dos cinco casos falharam pela asserção planejada (o texto recebido era a ficha antiga inteira, "Ana Ribeiro ... Consentimentos 2 ...", em vez de "Contato nao encontrado."); os outros tres (sem registro, 200, mesclado) ja passavam e sao regressao protegida. Na Tarefa 2 os dois casos reescritos falharam pela mesma razao (a ficha/`DealScreen` antiga aparecia). Plano `type: execute`, entao nao rodei `check tdd-red-evidence`. Sem REFACTOR separado.

## Verificacao

Tudo em `apps/web` (jsdom, sem banco; nenhum Postgres foi necessario e nenhum contêiner foi criado).

- `npx vitest run` da web inteira: 117 arquivos, 1118 testes, todos verdes (15,7 s).
- Os `<automated>` das duas tarefas: `paginas-de-contato`, `ficha-de-contato`, `paginas-de-empresa`, `ficha-de-negocio` e `sem-crm-antigo` verdes; `npx tsc --noEmit` limpo; `npx eslint` nas tres pastas `crm/{contatos,empresas,negocios}` e em `features/crm` sem achados (os dois avisos que o `eslint src` mostra sao de outros arquivos, nao tocados).
- `verificar-tokens.mjs`: 0 falhas.
- Criterios de aceitacao: os cinco `test ! -e` da Tarefa 1 e `test ! -e legado && test ! -e empresa-popup.tsx` da Tarefa 2 saem com 0; `grep -c "Contato nao encontrado"` na pagina de Contato = 1; `grep -c DealScreen` na pagina de Negocio = 0; nenhum nome apagado resta em `apps/` ou `packages/` fora de dois comentarios historicos de `apps/api/src/rotas/esquemas/contatos*.ts` (ver abaixo).
- Nao rodei `npm test` nem `npm run check` inteiros (regra do projeto).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `ficha-de-contato.test.tsx` precisou ser editado (fora de `files_modified`)**
- **Found during:** Task 1
- **Issue:** o bloco "recuo para o modelo antigo (D-15)" desse arquivo (casos i, j, k) testava a ficha antiga e quebraria ao apagar o legado.
- **Fix:** o bloco foi removido de la (e os imports `Suspense`, `act` e `ContatoPage`, que ficaram sem uso) e os casos i e k foram para `paginas-de-contato.test.tsx`; o j virou o caso "id antigo tambem e nao encontrado".
- **Files modified:** `apps/web/src/features/crm/ficha-de-contato.test.tsx`
- **Commit:** `32d474e`

**2. [Rule 2 - Missing] `apps/web/CONTEXT.md` e `sem-crm-antigo.test.ts` atualizados (fora de `files_modified`)**
- O CONTEXT dizia que as fichas "abrem a tela antiga"; a regra mudou, entao foi reescrito (instrucao do projeto: atualizar o CONTEXT da camada tocada). A lista `CONGELADOS` encolheu em dez arquivos, como o 15-06 pediu a cada plano de tela.
- **Commits:** `32d474e`, `8d183e0`

**Total deviations:** 2 (1 Rule 3, 1 Rule 2), 0 arquiteturais. **Impact:** so testes e documentacao fora da lista; nenhum codigo de producao fora do plano.

## Known Stubs

Nenhum.

## Issues Encountered

- **Efeito visivel aberto (registrado em `.planning/WINDOWS.md`, linha `deviation` da fase 15):** Busca, Lixeira antiga, Notificacoes, `/crm/meus-negocios` e a Caixa de Entrada ainda produzem links para ids do modelo antigo (D-15). Com o recuo fora, esses links abrem "nao encontrado" ate cada superficie migrar para o CRM novo. E a decisao do plano (sem ponte de id), mas muda o que o usuario ve hoje na ponta de uma lista antiga, entao fica aberta para os planos de tela seguintes e para o verificador.
- Dois comentarios de `apps/api/src/rotas/esquemas/contatos.ts` e `contatos.test.ts` ainda citam `empresa-popup.tsx` como origem historica de uma forma de esquema. Sao texto de documentacao da api (a api nao importa nada da web) e nao pertencem a este plano; nao toquei.

## Threat Flags

Nenhum. T-15-35 (recuo abrindo registro antigo sem passar pela regra de acesso da api) mitigado: o recuo saiu e so a api decide (404 para id inexistente ou de outro Espaco), coberto pelos testes de 404 das tres paginas.

## Next Phase Readiness

Pronto para o proximo plano. `deal-screen.tsx` e a ficha de Grupo/Flow seguem no modelo antigo ate 15-40 e as Sessoes 6 e 7. A temperatura do Contato (D-15-06) sumiu com a ficha antiga e nao volta na nova, como a truth do plano exige.

## Self-Check: PASSED

Arquivo criado presente em disco; os sete apagados ausentes; os quatro commits (`cab2437`, `32d474e`, `a781c77`, `8d183e0`) sao ancestrais de `HEAD`.
