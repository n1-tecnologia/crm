---
phase: 14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa
plan: 10
subsystem: api
tags: [crm, membros, sucessao, remove-member, ao-confirmar, rn-et-09, vitest, postgres]

requires:
  - phase: 14-03
    provides: aoConfirmar com 4 argumentos em executar() e a convenção de gesto que mexe nas duas bases
  - phase: 14-09
    provides: serviço e rota de gesto no padrão de rotas/crm (OpcoesDeCrm com serviço injetável)
provides:
  - repositorios/crm/sucessao.ts (SucessaoNoCrm, contarDoMembro, passarAoSucessor)
  - AO_CONFIRMAR em rotas/operacoes.ts, com a entrada removeMember
  - servicos/crm/sucessao.ts (ServicoDeSucessao, criarServicoDeSucessao)
  - GET /membros/:id/sucessao-no-crm e OpcoesDeCrm.sucessao
affects: [14-16, 14-17]

tech-stack:
  added: []
  patterns:
    - "mapa AO_CONFIRMAR ao lado de SERVICOS: operação do registro que também grava nas tabelas do CRM no mesmo commit, sem serviço próprio"
    - "aoConfirmar que repete a conferência que o domínio só faz na primeira vez (Sucessor ativo), porque a repetição da remoção devolve ok sem olhá-lo"

key-files:
  created:
    - apps/api/src/repositorios/crm/sucessao.ts
    - apps/api/src/servicos/crm/sucessao.ts
    - apps/api/src/servicos/crm/sucessao.test.ts
    - apps/api/src/rotas/crm/sucessao.ts
    - apps/api/src/rotas/crm/sucessao.test.ts
  modified:
    - apps/api/src/rotas/operacoes.ts
    - apps/api/src/rotas/operacoes.test.ts
    - apps/api/src/rotas/crm/index.ts
    - apps/api/src/rotas/CONTEXT.md

key-decisions:
  - "As Conversas do Membro removido são LIBERADAS (atribuido_tipo e atribuido_id nulos), não passam ao Sucessor: suposição OQ2/A8 do plano, a confirmar com o dono."
  - "O aoConfirmar de removeMember só passa o que for do Membro se o Sucessor é Membro ATIVO do Espaço no estado depois da operação; sem isso, repetir a remoção de quem já saiu com um id qualquer não faria nada de errado, mas também não deve tocar tabelas."
  - "Todos os estados dos registros entram na passagem (ativo, arquivado, na lixeira): o dono de algo na lixeira também não pode ficar com quem saiu."
  - "previa confere o Papel de quem pede ANTES de olhar o Membro pedido, então 403 não vaza quem é Membro; o 404 só aparece para Administrador/Proprietário ativo."

patterns-established:
  - "Teste de rota com banco em que o Espaço de vazamento serve de elenco e o CRM é semeado por SQL, com outro Espaço de mesmo proprietario_id provando o escopo por workspace_id."

requirements-completed: [UNI-11]

coverage:
  - id: D1
    description: "POST /operacoes/removeMember passa proprietario_id de Contatos, Empresas e Negócios ao Sucessor e libera as Conversas do Membro, no mesmo commit"
    requirement: UNI-11
    verification:
      - kind: integration
        ref: "apps/api/src/rotas/operacoes.test.ts#removeMember — a sucessão chega às tabelas do CRM no mesmo commit"
        status: pass
    human_judgment: false
  - id: D2
    description: "Recusa do domínio (quem pede não é Administrador/Proprietário ativo, Sucessor Convidado) deixa as tabelas do CRM iguais; registro de outro Membro e de outro Espaço não muda; Sucessor que não é Membro ativo não recebe nada"
    requirement: UNI-11
    verification:
      - kind: integration
        ref: "apps/api/src/rotas/operacoes.test.ts#removeMember (3 casos de recusa e escopo)"
        status: pass
    human_judgment: false
  - id: D3
    description: "GET /membros/:id/sucessao-no-crm devolve { contatos, empresas, negocios, conversasLiberadas } só para Administrador ou Proprietário ativo; 403 para os demais; 404 para Membro de outro Espaço ou inexistente"
    requirement: UNI-11
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/sucessao.test.ts; apps/api/src/rotas/crm/sucessao.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "O diálogo de remoção de Membro das Configurações continua com os números do modelo antigo até o corte (14-16)"
    requirement: UNI-11
    human_judgment: true
    rationale: "A troca de tela é do plano de corte; aqui só existe a rota que dá os números novos."

actuals:
  tokens: 28000
  tasks: 2
  commits: 4
plan_head_before: 73eec0f2f8094f478b31a8efc1d90eaca7449176
plan_head_after: 42d0a0285ff8bd392db728f302765b8ec5e0d7fc
commits: 4

duration: 9min
completed: 2026-11-04
status: complete
---

# Phase 14 Plan 10: Sucessão do Membro removido nas tabelas do CRM Summary

**`POST /operacoes/removeMember` passa, no mesmo commit (`aoConfirmar` de `executar()`), o `proprietario_id` de Contatos, Empresas e Negócios do Membro removido ao Sucessor e libera as Conversas atribuídas a ele; `GET /membros/:id/sucessao-no-crm` dá as quatro contagens antes, só para Administrador ou Proprietário ativo.**

## Performance

- **Duration:** 9 min
- **Tasks:** 2 (ambas TDD: RED e GREEN em commits separados)
- **Files:** 9 (5 criados, 4 alterados)

## Accomplishments

- `repositorios/crm/sucessao.ts`: `contarDoMembro` (uma consulta, quatro `count`) e `passarAoSucessor` (três `update` de `proprietario_id` e o `update` que zera `atribuido_tipo`/`atribuido_id`), todos com `workspace_id = $1`.
- `rotas/operacoes.ts`: mapa `AO_CONFIRMAR`, passado a `executar()` quando a operação tem entrada. O `aoConfirmar` só roda depois do `ok` do domínio; recusa do domínio faz rollback antes dele.
- Prévia: `servicos/crm/sucessao.ts` e a rota `GET /membros/:id/sucessao-no-crm`, registrada em `rotasDeCrm` (`OpcoesDeCrm.sucessao`).
- `rotas/CONTEXT.md` descreve o `aoConfirmar` (o que passa, o que é liberado, RN-ET-09b, a saída do caminho de duas idas) e a rota nova.

## Task Commits

1. **Task 1:** `23310cd` (test, RED: a Conversa e os donos ficam com quem saiu) e `89d4ae6` (feat, GREEN)
2. **Task 2:** `429b8d6` (test, RED: serviço lança, rota dá 404) e `42d0a02` (feat, GREEN)

## TDD Gate Compliance

- **RED** (`23310cd`): o caso principal falha na asserção planejada (`expected 'mem_maryane' to be 'mem_julia'`: o dono não mudou); os outros 3 casos já passam por construção (recusas e Sucessor inválido não mudam nada) e funcionam como guarda contra regressão. `429b8d6`: 7 casos do serviço falham com o esqueleto que lança "não implementado" e 3 da rota com 404 de rota ausente. O classificador `check tdd-red-evidence` não foi rodado (o vitest não persiste TAP/JUnit aqui).
- **GREEN:** `operacoes.test.ts` + `estado.test.ts` 52/52; serviço e rota 11/11.
- **REFACTOR:** nenhum commit.

## Decisions Made

Ver `key-decisions`. O que os próximos planos precisam saber:

- A tela de remoção (14-16) pode chamar `GET /membros/:id/sucessao-no-crm` para somar os números novos aos antigos; a rota não lê `registros`.
- `removeMember` com `aoConfirmar` paga mais idas ao banco que as gravações em duas idas da Fase 13: aceito, é gesto raro, e está documentado em `rotas/CONTEXT.md`.
- Nada é gravado no Registro de Atividade do CRM novo nem se avança a revisão por fora de `executar()`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Sucessor conferido no `aoConfirmar` quando a remoção é repetida**
- **Found during:** Task 1
- **Issue:** `removeMember` devolve `ok(member)` se o Membro já está `removido`, sem validar o Sucessor. O `aoConfirmar` do plano (`passarAoSucessor(cliente, ws, args[0], args[1])`) rodaria com um id qualquer vindo do corpo e moveria registros para alguém que não é Membro ativo do Espaço.
- **Fix:** a entrada `removeMember` de `AO_CONFIRMAR` recebe também o `state` e só chama `passarAoSucessor` se `args[1]` é Membro `ativo` em `state.members`. A assinatura ganhou o 4º parâmetro `state` em relação ao desenhado em `<interfaces>`.
- **Files modified:** `apps/api/src/rotas/operacoes.ts`, `apps/api/src/rotas/operacoes.test.ts` (caso "repetir a remoção")
- **Commit:** `89d4ae6`

**Total deviations:** 1 auto-fixed (1 missing critical). **Impact:** a assinatura de `AO_CONFIRMAR` tem um parâmetro a mais que o plano; o contrato externo não muda.

## Issues Encountered

None. `outbox-worker.test.ts` passou nos dois lotes (baseline intermitente do 14-07 não apareceu).

## Verification

Postgres 16 descartável (`crm-n1-pg-1410`, porta 55610, migrado até 011, removido ao fim):

- `src/persistencia`: 20 arquivos, 181 testes; `rotas/operacoes.test.ts` + `rotas/estado.test.ts`: 52/52 (lote separado).
- `servicos/crm/sucessao.test.ts`, `rotas/crm/sucessao.test.ts`, `src/seguranca` e a guarda D-06 da api: 14 arquivos, 142 passam e 2 falham de propósito (`expected fail`, já existentes).
- Sem banco (`DATABASE_URL=`), plano inteiro: `apps/api` 1318 passam (650 pulados, 1 todo); `operacoes-medicao.test.ts` 6/6; `tsc --noEmit` limpo em `apps/api`.
- Guarda D-06 do domínio: 2/2. `packages/dominio` e `apps/web` não foram tocados, então suas suítes completas não foram rodadas.
- Critérios de aceite: `passarAoSucessor` em `operacoes.ts` 2, `atribuido_id = null` no repositório 1, `AO_CONFIRMAR` 2; `/membros/:id/sucessao-no-crm` na rota 2, `sucessao-no-crm` em `rotas/CONTEXT.md` 1, `ehAdministracao` no serviço 2.

## Known Stubs

None.

## Threat Flags

None. T-14-25: o `aoConfirmar` só roda depois do `ok` de `removeMember` (que exige Administrador ou Proprietário ativo); o caso "Membro comum → tabelas iguais" prova. T-14-26: `previa` confere o Papel antes do Membro pedido; 403 e 404 testados no serviço.

## Next Phase Readiness

Para 14-16 (corte) e 14-17:

- O diálogo de remoção troca os números antigos pelos de `GET /membros/:id/sucessao-no-crm` quando o CRM antigo sair.
- Em aberto, para o dono: (OQ2/A8) a Conversa do Membro removido é liberada, não passa ao Sucessor como o texto da 3.2.8 diz.

## Self-Check: PASSED

Arquivos criados presentes em disco; commits `23310cd`, `89d4ae6`, `429b8d6`, `42d0a02` são ancestrais de `HEAD`.
