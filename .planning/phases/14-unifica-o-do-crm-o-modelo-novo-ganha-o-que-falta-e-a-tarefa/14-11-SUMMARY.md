---
phase: 14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa
plan: 11
subsystem: ui
tags: [react, swr, nextjs, crm, contatos, notas, consentimento, mesclagem]

requires:
  - phase: 14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa
    provides: "14-01 página do Contato mesclado leva ao sobrevivente; 14-06 notas e transferência de Identificador; 14-08 consentimentos só de inserção; 14-09 mesclagem"
provides:
  - "dados/crm/notas.ts, consentimentos.ts e as funções mesclarContatos/transferirIdentificador em contatos.ts"
  - "A ficha nova de Contato com Notas, Consentimentos, Mesclar com… e Transferir por Identificador, tudo pela api"
affects: [14-15, 14-16, 14-17, fase-15-telas-no-modelo-novo]

actuals:
  tokens: 21600
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "Cliente por recurso em dados/crm com chave SWR /contatos/<id>/<sub-recurso> revalidada só para aquele Contato"
    - "Diálogo de gesto da api com a recusa 409 dentro dele (diálogo continua aberto) e aviso de sucesso entregue à ficha"
    - "Teste de ficha com api falsa com estado (o POST grava, a leitura seguinte devolve) e invalidarCrm espiado que revalida no cache do SWRConfig do teste"

key-files:
  created:
    - apps/web/src/dados/crm/notas.ts
    - apps/web/src/dados/crm/notas.test.ts
    - apps/web/src/dados/crm/consentimentos.ts
    - apps/web/src/dados/crm/consentimentos.test.ts
    - apps/web/src/features/crm/notas-do-contato.tsx
    - apps/web/src/features/crm/consentimentos-do-contato.tsx
    - apps/web/src/features/crm/mesclar-contato-dialog.tsx
    - apps/web/src/features/crm/transferir-identificador-dialog.tsx
  modified:
    - apps/web/src/dados/crm/contatos.ts
    - apps/web/src/dados/crm/contatos.test.ts
    - apps/web/src/features/crm/ficha-de-contato.tsx
    - apps/web/src/features/crm/ficha-de-contato.test.tsx
    - apps/web/CONTEXT.md

key-decisions:
  - "Notas e Consentimentos revalidam só a chave do próprio Contato (/contatos/<id>/notas, /consentimentos): escrever uma nota não muda a ficha nem a lista"
  - "O vigente do consentimento é calculado na tela por consentimentoVigente sobre o histórico da api, num quadro finalidade x tipo de Canal (WhatsApp, Instagram, E-mail); 'todos' vale para qualquer coluna"
  - "Mesclar com… fica desligado na lixeira com a frase de validarMesclagem (a mesma função que a api aplica); Transferir segue o somenteLeitura da ficha (só Contato ativo)"
  - "Os diálogos novos não pedem digitar o nome do absorvido (o antigo pedia): o aviso 'Não dá para desfazer' e o seletor da api bastam, como o plano descreve; reversível de adotar depois"
  - "O Catálogo de finalidades segue lido do store (useData), única leitura do store nas seções novas (OQ7)"

patterns-established:
  - "Seção de ficha pré-valida com a MESMA função do domínio que a api aplica (validarNovaNota, validarNovoConsentimento) e marca o campo quando a api devolve 400 com campo"

requirements-completed: [UNI-05, UNI-06, UNI-07, UNI-10]

coverage:
  - id: D1
    description: "Cliente da api para notas e consentimentos (rota, corpo, revalidação só do Contato, recusa como ErroDeApi)"
    requirement: "UNI-06"
    verification:
      - kind: unit
        ref: "apps/web/src/dados/crm/notas.test.ts; apps/web/src/dados/crm/consentimentos.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "mesclarContatos(sobrevivente, absorvido) e transferirIdentificador chamam as rotas certas e invalidam /contatos"
    requirement: "UNI-05"
    verification:
      - kind: unit
        ref: "apps/web/src/dados/crm/contatos.test.ts#mutações de Contato — mesclar e transferir Identificador"
        status: pass
    human_judgment: false
  - id: D3
    description: "Seção Notas da ficha: lista a mais recente primeiro, grava, marca o campo no 400, mostra 409 por MensagemDeRecusa, desliga por Papel e lixeira"
    requirement: "UNI-06"
    verification:
      - kind: automated_ui
        ref: "apps/web/src/features/crm/ficha-de-contato.test.tsx#FichaDeContato — Notas (14-06, 3.2.7)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Seção Consentimentos da ficha: histórico, vigente por finalidade e tipo de Canal, formulário de registro, recusa e Papel"
    requirement: "UNI-07"
    verification:
      - kind: automated_ui
        ref: "apps/web/src/features/crm/ficha-de-contato.test.tsx#FichaDeContato — Consentimentos (14-08, 3.2.4)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Mesclar com… e Transferir na ficha nova: seletor sem o próprio Contato, POST com o absorvido/destino, 409 no diálogo, ações desligadas por Papel e lixeira"
    requirement: "UNI-10"
    verification:
      - kind: automated_ui
        ref: "apps/web/src/features/crm/ficha-de-contato.test.tsx#FichaDeContato — Mesclar com… e Transferir Identificador"
        status: pass
    human_judgment: false
  - id: D6
    description: "Fluxo completo contra a api real num Postgres local migrado (nota, consentimento, transferir para B, mesclar C em A, abrir /crm/contatos/<C> e cair em A)"
    verification: []
    human_judgment: true
    rationale: "O human-check da Task 3 pede `npm run dev` apontando para um Postgres local migrado; este plano só provou o contrato com api falsa (fetch roteado). Nada foi rodado contra o banco."

duration: 13min
completed: 2026-11-04
status: complete
plan_head_before: 28690e63a3c1eb4d9c90e7d833beb5c041a57b74
plan_head_after: 11c766fc0475bc72c33c366cfe1246a662d55283
commits: 6
---

# Phase 14 Plan 11: Ficha nova de Contato com notas, consentimentos, mesclar e transferir Summary

**A ficha nova de Contato lê e grava Notas e Consentimentos, mescla outro Contato nela e transfere um Identificador, tudo por rotas REST da api, sem o modelo antigo.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-11-04T18:57:00Z (aprox.; o marcador de commits é 19:00:54Z)
- **Completed:** 2026-11-04T19:10:00Z
- **Tasks:** 3 (todas TDD: RED e GREEN por tarefa)
- **Files modified:** 13 (8 criados, 5 alterados)

## Accomplishments

- Clientes `dados/crm/notas.ts` e `consentimentos.ts` (SWR por Contato, revalidação só do Contato) e `mesclarContatos`/`transferirIdentificador` em `contatos.ts`.
- Seção Notas (a mais recente primeiro, autor pelo nome do Membro, pré-validação por `validarNovaNota`) e seção Consentimentos (quadro do vigente por `consentimentoVigente`, histórico só de inserção, formulário de registro com as finalidades do Catálogo).
- Diálogos "Mesclar com…" (o Contato da ficha é o sobrevivente) e "Transferir" por linha de Identificador, com a recusa 409 dentro do diálogo; ações desligadas por Papel (`usePodeNoCrm`) e, a mesclagem, pela lixeira.
- O cabeçalho da ficha e o `apps/web/CONTEXT.md` deixam de listar Consentimentos, Comentários e mesclagem entre o que a 007 não guarda; Tags, Anexos, Conversas e temperatura seguem fora (D-04).

## Task Commits

1. **Task 1: clientes da api** - `be4de83` (test, RED) → `bf1ab35` (feat, GREEN)
2. **Task 2: Notas e Consentimentos na ficha** - `bdc84ed` (test, RED) → `2748f6b` (feat, GREEN)
3. **Task 3: Mesclar com… e Transferir** - `07df91c` (test, RED) → `11c766f` (feat, GREEN)

Nenhum commit de refactor (nada a limpar).

## TDD Gate Compliance

RED de cada tarefa falhou pelo motivo planejado, e GREEN passou: Task 1 com `notas.test.ts`/`consentimentos.test.ts` sem módulo e `mesclarContatos is not a function` (4 falhas, 10 já passando); Task 2 com 11 casos novos da ficha falhando por seção ausente (11 já passando); Task 3 com 7 casos novos falhando por botão ausente (22 já passando). Não rodei `gsd_run check tdd-red-evidence`: o plano não é `type: tdd` e `workflow.tdd_mode` não foi sinalizado; a avaliação semântica foi manual (cada falha era a asserção ou o import do alvo planejado, não erro de sintaxe).

## Files Created/Modified

- `apps/web/src/dados/crm/notas.ts`, `consentimentos.ts` - clientes da api por Contato (chave, hook SWR, mutação).
- `apps/web/src/dados/crm/contatos.ts` - `transferirIdentificador` e `mesclarContatos`.
- `apps/web/src/features/crm/notas-do-contato.tsx`, `consentimentos-do-contato.tsx` - as duas seções.
- `apps/web/src/features/crm/mesclar-contato-dialog.tsx`, `transferir-identificador-dialog.tsx` - os dois diálogos sobre a api.
- `apps/web/src/features/crm/ficha-de-contato.tsx` - monta as seções, o botão "Mesclar com…" e o "Transferir" por linha; cabeçalho reescrito.
- `apps/web/src/features/crm/ficha-de-contato.test.tsx` e os três `*.test.ts` de `dados/crm` - os casos do plano.
- `apps/web/CONTEXT.md` - parágrafo sobre a ficha nova de Contato.

## Decisions Made

Ver `key-decisions` no frontmatter. Em especial: o diálogo de mesclar NÃO exige digitar o nome do absorvido (o antigo exigia). O plano manda "avisar que é irreversível", o que foi feito; se o dono quiser o atrito extra do diálogo antigo, é acrescentar um campo ao `MesclarContatoDialog`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Teste (a) e (e) da ficha precisaram mudar, como o próprio plano antecipa**
- **Found during:** Task 2
- **Issue:** (e) proibia "Consentimentos" e "Mesclar" na ficha; (a) contava "E-mail" na tela e o quadro do vigente tem a coluna "E-mail".
- **Fix:** (e) deixa de proibir esses dois textos (continua proibindo Tags, Comentários, Anexos, Conversas e Temperatura); (a) conta só os "E-mail" dentro de `li` (linhas de Identificador).
- **Files modified:** `apps/web/src/features/crm/ficha-de-contato.test.tsx`
- **Committed in:** `bdc84ed`, `07df91c`

**2. [Rule 3 - Blocking] `invalidarCrm` espiado no teste da ficha passou a revalidar no cache do teste**
- **Found during:** Task 2
- **Issue:** o espião antigo não fazia nada, então "a nota aparece depois de salvar" nunca podia ser provado (o `mutate` global não alcança o cache isolado do `SWRConfig`).
- **Fix:** `RegistrarRevalidacao` guarda o `mutate` do `SWRConfig` do teste e o espião repassa o prefixo a ele; as asserções antigas (`toHaveBeenCalledWith("/contatos")`) seguem valendo.
- **Files modified:** `apps/web/src/features/crm/ficha-de-contato.test.tsx`
- **Committed in:** `bdc84ed`

**3. Critério de aceite com `grep` literalmente inalcançável (registro, sem correção)**
- `grep -rc "from \"@n1/api\|apps/api" apps/web/src/dados/crm/` soma 0 não é possível: os arquivos que já existiam (`contatos.ts`, `cliente-crm.ts` etc.) citam "apps/api" em comentário, e os novos seguem o mesmo molde. A intenção (a web não importa a api) foi conferida por import: `grep -rn "from \"@n1/api\|from \"[./]*/*apps/api" apps/web/src/dados/crm/` devolve 0 linhas.

---

**Total deviations:** 3 (2 ajustes de teste forçados pela mudança, 1 critério de aceite lido pela intenção)
**Impact on plan:** nenhum desvio de escopo; nada fora de `files_modified`.

## Issues Encountered

Nenhum. O `npm run lint` do web tem 2 avisos (`KnowledgeDocument` e `Target` sem uso) em arquivos que este plano não tocou.

## Known Stubs

Nenhum.

## Threat Flags

Nenhum (nenhuma superfície nova além das rotas já cobertas pelo T-14-27 e T-14-28; os dois arquivos de seção não contêm a API de HTML cru, conferido por `grep`).

## Verification

- `npx tsc --noEmit` (web): limpo.
- `npx vitest run` (web inteiro): 99 arquivos, 968 testes, todos passando.
- `npx eslint .` (web): 0 erros, 2 avisos pré-existentes em arquivos não tocados.
- `npm run verificar:tokens` (web): 0 falhas.
- Guardas D-06 de `packages/dominio` e `apps/api` (`sem-listas-espelho.test.ts`): 2/2 em cada.
- Nenhum Docker foi usado (plano só de web) e nada tocou `.env` nem banco.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Pronto para o próximo plano da fase. Quem usa a ficha nova já corrige duplicados, move um número e registra consentimento sem o modelo antigo.
- Em aberto: o `<human-check>` da Task 3 (fluxo completo contra a api real num Postgres local migrado) não foi rodado; fica para a conferência humana da fase.
- Os diálogos antigos (`merge-contacts-dialog.tsx`, `transfer-identifier-dialog.tsx`) seguem vivos para a ficha antiga e saem no corte (3.4.4).

## Self-Check: PASSED

Arquivos criados e commits conferidos antes de escrever esta linha (ver verificação no fim da execução).

---
*Phase: 14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa*
*Completed: 2026-11-04*
