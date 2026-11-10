---
phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
plan: 08
subsystem: api
tags: [ia, chat, agentes, ancora, gesto-misto, conversas, vitest, postgres]

requires:
  - phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
    provides: "15-01: gesto-no-crm/ (LeituraDoCrm, LidoDoCrm.nomes, argumento(lido)) e o módulo ia.ts vazio; 15-02: base do CRM novo"
provides:
  - "NomesDasAncoras (types/ai.ts) e nomeLidoDoCrm (ia/nomes-das-ancoras.ts); createChatSession, configureChatSession e ensaiarAgente leem o nome da Âncora de nomes (último parâmetro, opcional)"
  - "LER_DO_CRM_IA com createChatSession, configureChatSession e ensaiarAgente: nome lido de negocios, contatos, empresas e conversas, só se podeNoCrm(ler)"
  - "AO_CONFIRMAR_IA + liberarDoAgente: arquivar e enviar o Agente à lixeira soltam as Conversas dele em plataforma.conversas no mesmo commit"
  - "NOMES_DO_NAVEGADOR (esquemas/fragmentos.ts); LeituraDoCrm.ler recebe o Membro da sessão"
affects: [15-21, 3.5.4 desligamento do modelo antigo de Negócio, Contato, Empresa e Conversa]

actuals:
  tokens: 21500
  tasks: 2
  commits: 5

plan_head_before: 3a5450be96841be9de7efe89709d62978f533876
plan_head_after: 3a01a6c241a2a2222f6c1572f55f15eede35f182
commits: 5

tech-stack:
  added: []
  patterns:
    - "nomes?: NomesDasAncoras como ÚLTIMO parâmetro opcional; o servidor sobrescreve a posição, o navegador é descartado"
    - "leituraDasAncoras(posicao, ancoraNosArgs): uma fábrica de leitura para as três operações com Âncora"
    - "LeituraDoCrm.ler recebe o Membro da sessão para conferir podeNoCrm antes de revelar dado do CRM"

key-files:
  created:
    - packages/dominio/src/operations/ia/nomes-das-ancoras.ts
    - packages/dominio/src/operations/ancora-do-chat.test.ts
    - apps/api/src/repositorios/crm/liberacao-do-agente.ts
    - apps/api/src/rotas/operacoes-ia.test.ts
  modified:
    - packages/dominio/src/operations/ai.ts
    - packages/dominio/src/operations/ia/agentes.ts
    - packages/dominio/src/operations/ia/agentes.test.ts
    - packages/dominio/src/types/ai.ts
    - apps/api/src/rotas/gesto-no-crm/ia.ts
    - apps/api/src/rotas/gesto-no-crm/tipos.ts
    - apps/api/src/rotas/operacoes.ts
    - apps/api/src/rotas/esquemas/fragmentos.ts
    - apps/api/src/rotas/esquemas/ia.ts
    - apps/api/src/rotas/esquemas/ia-agentes.ts

key-decisions:
  - "NOMES_DO_NAVEGADOR mora em esquemas/fragmentos.ts (usado por ia.ts e ia-agentes.ts, regra 5 da pasta), como o CRM_DO_NAVEGADOR do 15-07"
  - "LeituraDoCrm.ler ganhou o 5º parâmetro membro (MembroDaSessao): sem ele a leitura não sabe quem pede, e o plano exige podeNoCrm(ler) antes de ler o nome"
  - "A frase de recusa da Âncora ficou a que o domínio já tinha (\"O registro da Âncora não foi encontrado.\"), não a do texto do plano (\"O registro da âncora não existe.\")"
  - "O ensaio com Âncora sem nome em nomes nomeia pelo id (comportamento que nomeDaAncora já tinha para registro desconhecido), não recusa; só o Chat recusa"

requirements-completed: [UCR-08]

coverage:
  - id: D1
    description: "Sessão de Chat ancorada em Negócio, Contato, Empresa ou Conversa guarda o nome lido das tabelas; id inexistente, de outro Espaço ou com nomes forjado é recusado; o nome forjado de um id real não vale"
    requirement: UCR-08
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/ancora-do-chat.test.ts"
        status: pass
      - kind: integration
        ref: "apps/api/src/rotas/operacoes-ia.test.ts#createChatSession (o traçador) e configureChatSession"
        status: pass
    human_judgment: false
  - id: D2
    description: "A leitura do nome confere podeNoCrm(ler): Membro desconhecido ou pendente recebe {}; Âncora de Tarefa não consulta o CRM"
    requirement: UCR-08
    verification:
      - kind: integration
        ref: "apps/api/src/rotas/operacoes-ia.test.ts#a leitura confere `ler` antes de revelar o nome (T-15-23)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Enviar à lixeira ou arquivar o Agente solta as Conversas dele em plataforma.conversas no mesmo commit; Conversa de Membro, de outro Espaço e de outro Agente ficam; repetir, recusa do domínio e Convidado não soltam nada; liberarDoAgente repetida solta zero"
    requirement: UCR-08
    verification:
      - kind: integration
        ref: "apps/api/src/rotas/operacoes-ia.test.ts#Agente na lixeira ou arquivado libera as Conversas dele nas tabelas (RN-AGE-20)"
        status: pass
    human_judgment: false
  - id: D4
    description: "ensaiarAgente nomeia a Âncora de Negócio, Contato e Conversa por nomes (sem ler state.deals nem state.contacts)"
    requirement: UCR-08
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/ia/agentes.test.ts#27a2 e 27a3"
        status: pass
      - kind: integration
        ref: "apps/api/src/rotas/operacoes-ia.test.ts#ensaiarAgente nomeia a Âncora pelas tabelas"
        status: pass
    human_judgment: false
  - id: D5
    description: "Telas da IA no navegador (Âncora do Chat e do ensaio num registro do CRM recusam ou nomeiam pelo id até o 15-21 mandar nomes)"
    verification: []
    human_judgment: true
    rationale: "Comportamento intermediário registrado pelo plano (D-15-03): nada é publicado antes do corte; o 15-21 passa a mandar nomes"

duration: 11min
completed: 2026-11-06
status: complete
---

# Phase 15 Plan 08: Chat e Agentes pelo CRM novo Summary

**A Âncora do Chat e do ensaio de Agente é nomeada por `nomes`, que o servidor lê de `plataforma.negocios/contatos/empresas/conversas` (com `podeNoCrm(ler)` e descartando o do navegador), e arquivar ou enviar o Agente à lixeira solta as Conversas dele nas tabelas no mesmo commit (`liberarDoAgente`).**

## Performance

- **Duration:** 11 min
- **Started:** 2026-11-06T09:56:00Z (aprox.)
- **Completed:** 2026-11-06T10:07:00Z (aprox.)
- **Tasks:** 2
- **Files modified:** 14 (4 criados, 10 alterados; mais 2 CONTEXT.md e o WINDOWS.md)

## Accomplishments

- `createChatSession` e `configureChatSession` ancoram num Negócio, Contato, Empresa ou Conversa que só existe nas tabelas e guardam o nome de lá; `anchorName` não lê mais `state.deals`, `state.contacts` nem `state.companies` (grep = 0). Id inexistente, de outro Espaço, ou `nomes` forjado para um id sem registro é recusado, também repetido; `nomes` forjado para um id real não troca o nome.
- `LER_DO_CRM_IA` (`createChatSession` posição 1, `configureChatSession` e `ensaiarAgente` posição 2) lê o nome pelos repositórios do CRM, só se `podeNoCrm(ler)` deixa o Membro da sessão (T-15-23); sem permissão devolve `{}` e a operação recusa sem citar o nome. `LeituraDoCrm.ler` passou a receber o Membro.
- `ensaiarAgente` nomeia a Âncora de Negócio, Contato e Conversa por `nomes`; `agentes.ts` não lê mais `state.deals` nem `state.contacts` (grep = 0).
- `AO_CONFIRMAR_IA` (`arquivarAgente`, `enviarAgenteALixeira`) chama `liberarDoAgente`, que solta (`atribuido_tipo` e `atribuido_id` nulos) só as Conversas do Espaço atribuídas ao Agente; Conversa de Membro, de outro Espaço e de outro Agente ficam. O domínio continua soltando Tarefas e Conversas de Grupo (`liberarResponsabilidades` só ganhou comentário).
- Esquemas: `NOMES_DO_NAVEGADOR` (até 200 ids, 300 caracteres por nome) como último elemento opcional de `createChatSession`, `configureChatSession` e `ensaiarAgente`.

## TDD

- **RED 1** (`0fd9da3`): 10 casos de domínio (7 falhando: o 4º argumento era ignorado e o domínio lia `state.deals`) e 10 de rota (9 falhando: "O registro da Âncora não foi encontrado." com o Negócio só na tabela, HTTP 400 por `nomes` fora da tupla, `LER_DO_CRM.createChatSession` indefinido). Avaliação semântica: os alvos rodaram e falharam pela asserção planejada, sem erro de importação nem de fixture (duas falhas de fixture iniciais, Empresa sem Contato admin e Negócio sem dono, foram corrigidas no teste antes do RED valer). `workflow.tdd_mode` é `false`; o classificador `check tdd-red-evidence` não foi exigido. Os casos de guarda (constructor, Lista sem nomes, Contato de outro Espaço) já passavam e ficam como regressão.
- **GREEN 1** (`30ebc97`): 10/10 no domínio; 13/13 na rota e no esquema; os três `tsc` com 0 e 2359 no domínio.
- **RED 2** (`8226a9e`): 4 casos de domínio falhando (o ensaio devolvia o título do modelo antigo, ou o id) e 5 de rota (as Conversas continuavam atribuídas ao Agente na lixeira e arquivado; `nomes` rejeitado pelo esquema; módulo `liberacao-do-agente` inexistente só no caso que o importa de forma dinâmica). Os casos de repetição, recusa do domínio e Convidado já passavam e guardam contra regressão.
- **GREEN 2** (`ae73719`): 18/18 no domínio, 25/25 na rota e esquemas; suíte completa verde (ver abaixo).
- **REFACTOR:** nenhum.

## Task Commits

1. **Task 1 (traçador): Âncora do Chat nomeada pela tabela** — `0fd9da3` (test) e `30ebc97` (feat)
2. **Task 2: Agentes — ensaio e Conversas liberadas nas tabelas** — `8226a9e` (test) e `ae73719` (feat)
3. **CONTEXT.md das rotas e do domínio** — `3a01a6c` (docs)

**Plan metadata:** commit `docs(15-08)` seguinte (SUMMARY, STATE, ROADMAP, WINDOWS).

Gate do traçador: modo `end-of-phase`, `<verify>` só automatizado, então foi reexecutado ponta a ponta (rota 13/13, domínio 2359/2359, três `tsc` com 0) e passou — expansão liberada.

## Files Created/Modified

- `packages/dominio/src/types/ai.ts` - `NomesDasAncoras`
- `packages/dominio/src/operations/ia/nomes-das-ancoras.ts` - `nomeLidoDoCrm` (com `Object.hasOwn`, sem herdar do protótipo); fora de `ai.ts` porque `ai.ts` importa `agentes.ts`
- `packages/dominio/src/operations/ai.ts` - `nomes` em `createChatSession` e `configureChatSession`; `anchorName` por `nomes`
- `packages/dominio/src/operations/ia/agentes.ts` - `nomes` em `ensaiarAgente`; `nomeDaAncora` por `nomes`
- `apps/api/src/rotas/gesto-no-crm/ia.ts` - `LER_DO_CRM_IA` e `AO_CONFIRMAR_IA`
- `apps/api/src/rotas/gesto-no-crm/tipos.ts`, `apps/api/src/rotas/operacoes.ts` - o Membro da sessão como 5º parâmetro de `ler`
- `apps/api/src/repositorios/crm/liberacao-do-agente.ts` - `liberarDoAgente`
- `apps/api/src/rotas/esquemas/{fragmentos,ia,ia-agentes}.ts` - `NOMES_DO_NAVEGADOR` nas três tuplas
- Testes: `ancora-do-chat.test.ts`, `ia/agentes.test.ts`, `operacoes-ia.test.ts` (19 casos com banco local), `esquemas/ia.test.ts`, `esquemas/ia-agentes.test.ts`

## Decisions Made

- `LeituraDoCrm.ler` ganhou o parâmetro `membro`: o contrato do 15-01 não o passava, e sem ele não há como conferir `podeNoCrm` (o plano pede). Mudança aditiva; as demais leituras o ignoram.
- `NOMES_DO_NAVEGADOR` vive em `esquemas/fragmentos.ts` (dois módulos de esquema o usam), não em `esquemas/ia.ts` como o plano cita.
- Recusa da Âncora no Chat: a frase que o domínio já tinha, "O registro da Âncora não foi encontrado.". O texto do plano ("O registro da âncora não existe.") é paráfrase; manter a existente evita quebrar quem a conhece.
- Ensaio: a Âncora sem nome em `nomes` continua nomeada pelo id, como `nomeDaAncora` já fazia para registro desconhecido, em vez de recusar (a truth do plano fala em recusa só para as Sessões de Chat na prática, e o teste de rota cobre as duas formas).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `LeituraDoCrm.ler` não recebia o Membro da sessão**
- **Found during:** Task 1
- **Issue:** a leitura precisa conferir `podeNoCrm(papel, "ler", recurso)` com o Papel do Membro, mas `ler(cliente, workspaceId, args, state)` não dizia quem pede.
- **Fix:** 5º parâmetro `membro: MembroDaSessao` em `tipos.ts`; `operacoes.ts` passa `request.membro`.
- **Files modified:** `apps/api/src/rotas/gesto-no-crm/tipos.ts`, `apps/api/src/rotas/operacoes.ts`
- **Verification:** `tsc` da api com 0; caso de rota "confere `ler` antes de revelar o nome"
- **Committed in:** `30ebc97`

**2. [Rule 2 - Missing Critical] Teto de tamanho e proteção de protótipo em `nomes`**
- **Found during:** Task 1
- **Issue:** o `nomes` que o navegador manda é descartado, mas o esquema o valida antes; sem teto aceitaria objetos enormes. No domínio, `nomes["constructor"]` herdaria do protótipo.
- **Fix:** `NOMES_DO_NAVEGADOR` com teto de 200 ids e 300 caracteres; `nomeLidoDoCrm` usa `Object.hasOwn`.
- **Files modified:** `esquemas/fragmentos.ts`, `ia/nomes-das-ancoras.ts`
- **Verification:** casos em `ia.test.ts` e `ancora-do-chat.test.ts`
- **Committed in:** `30ebc97`

---

**Total deviations:** 2 auto-fixed (1 Rule 3, 1 Rule 2)
**Impact on plan:** nenhum desvio de arquitetura; os dois ajustes são o mínimo para o plano valer (T-15-23, T-15-24).

## Issues Encountered

- `npx tsx` foi chamado uma vez só para listar os Agentes do seed e baixou o pacote para o cache do npx (fora do projeto; `package.json` e lockfile intactos). Não repetido.
- Suíte completa no Docker local (Postgres 16 em `localhost:55708`, 001–012 aplicadas, as duas URLs explícitas): api 179 arquivos / 2148 testes passando (2 expected fail, 21 skipped, 1 todo já existentes), sem os flakes de base (`outbox-worker`, `colunas-geradas`) desta vez; domínio 124 arquivos / 2363; web 112 arquivos / 1068. Os três `tsc --noEmit` com 0.

## Known Stubs

Nenhum stub de dado. Comportamento intermediário registrado pelo plano (D-15-03, nada é publicado antes do corte): no navegador, a aplicação otimista de ancorar Chat num Negócio, Contato, Empresa ou Conversa recusa ("O registro da Âncora não foi encontrado.") e o ensaio nomeia a Âncora pelo id, porque a web ainda não manda `nomes`; o servidor grava certo. O 15-21 passa a mandar `nomes`. Registrado no `WINDOWS.md` (deviation, aberto).

## Threat Flags

Nenhum além do `<threat_model>`: T-15-23 (leitura confere `podeNoCrm(ler)`; caso de rota com Membro desconhecido e pendente), T-15-24 (posição sobrescrita; casos com `nomes` forjado para id real e inexistente) e T-15-25 (`where workspace_id = $1 and atribuido_tipo = 'agente'`; caso com Conversa de outro Espaço) têm teste. Limite honesto de T-15-23: `podeNoCrm(ler)` só recusa Membro desconhecido ou não ativo/suspenso (a matriz do CRM deixa o Convidado ler); a rota já barra o Membro suspenso de gravar antes da leitura.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 15-21 troca `features/ia/ancora-do-chat.tsx`, `agente-completo.tsx` e `ensaiar-dialog.tsx` e passa a mandar `nomes`.
- 15-39 (escopo Funil das Automações) é o outro pedaço da 3.4.9.
- O container `crm-n1-pg-1508` foi parado; nenhum banco remoto foi tocado.

---
*Phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant*
*Completed: 2026-11-06*

## Self-Check: PASSED
