---
phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
plan: 07
subsystem: api
tags: [ferramentas, grupos, comunidades, flows, canais, contatos, gesto-misto, vitest, postgres]

requires:
  - phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
    provides: "15-01: gesto-no-crm/ (LeituraDoCrm, LidoDoCrm, argumento(lido)) e o módulo ferramentas.ts vazio; 15-02: base do CRM novo"
provides:
  - "CrmDasFerramentas, ContatoDaFerramenta e CRM_DAS_FERRAMENTAS_VAZIO (types/ferramentas.ts) e ContatoACriar (crm/contatos.ts)"
  - "Operações e recusas de Grupo, Comunidade, Flow e Automação de Ferramentas leem Canal e Contato de crm (último parâmetro, opcional)"
  - "LER_DO_CRM_FERRAMENTAS com as 28 operações; resumidosPorIds no repositório de Contatos; CRM_DO_NAVEGADOR nos esquemas"
affects: [15-17, 15-22, 15-38, 3.5.4 desligamento da projeção dos Canais e do Contato antigo]

actuals:
  tokens: 19800
  tasks: 3
  commits: 7

plan_head_before: 5c81a30703a88729187c96dea5e086c667151d47
plan_head_after: 10d9dd1b0978234204e007325f5e3fdd4b5afdf8
commits: 7

tech-stack:
  added: []
  patterns:
    - "crm?: CrmDasFerramentas como ÚLTIMO parâmetro opcional; o servidor sobrescreve a posição, o navegador é descartado"
    - "helpers canalNoCrm, contatoNoCrm, canalPeloNumeroNoCrm e nomeDoParticipanteNoCrm em permissoes.ts"

key-files:
  created:
    - apps/api/src/rotas/operacoes-ferramentas.test.ts
  modified:
    - packages/dominio/src/types/ferramentas.ts
    - packages/dominio/src/crm/contatos.ts
    - packages/dominio/src/operations/ferramentas/permissoes.ts
    - packages/dominio/src/operations/ferramentas/grupos.ts
    - packages/dominio/src/operations/ferramentas/comunidades.ts
    - packages/dominio/src/operations/ferramentas/flows.ts
    - packages/dominio/src/operations/ferramentas/automacoes.ts
    - packages/dominio/src/operations/ferramentas/captacao.ts
    - packages/dominio/src/operations/ferramentas/participacoes.ts
    - packages/dominio/src/operations/ferramentas.test.ts
    - apps/api/src/rotas/gesto-no-crm/ferramentas.ts
    - apps/api/src/rotas/esquemas/fragmentos.ts
    - apps/api/src/rotas/esquemas/grupos.ts
    - apps/api/src/rotas/esquemas/comunidades.ts
    - apps/api/src/rotas/esquemas/flows.ts
    - apps/api/src/repositorios/crm/contatos.ts

key-decisions:
  - "CRM_DO_NAVEGADOR mora em esquemas/fragmentos.ts (regra 5 da pasta: fragmento de três módulos) e grupos.ts o reexporta, como o plano nomeia"
  - "A leitura de Ferramentas manteve o nome LER_DO_CRM_FERRAMENTAS que o 15-01 criou (o plano a chama LER_DO_CRM_DAS_FERRAMENTAS)"
  - "Contatos lidos só pelos ids dos args e da Participação ou Pedido alvo (nunca todas as Participações do Grupo, que passam de 500)"
  - "As Ações de Automação contato.adicionarTag e contato.definirCampo falham dizendo que o Contato do CRM novo não guarda Tag nem Campo, em vez de gravar no Contato antigo"

requirements-completed: [UCR-08]

coverage:
  - id: D1
    description: "criarGrupo confere o Canal em plataforma.canais pela rota, sem a projeção, e um crm forjado (repetido) é descartado"
    requirement: UCR-08
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/ferramentas.test.ts#criarGrupo — o Canal vem do CRM novo"
        status: pass
      - kind: integration
        ref: "apps/api/src/rotas/operacoes-ferramentas.test.ts#criarGrupo (o traçador)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Grupo, Comunidade, Flow e Automação leem Canal e Contato de crm; nenhum state.channels nem state.contacts sobra fora de participacoes.ts; Conversa de Grupo e envio de Flow seguem em state.conversations"
    requirement: UCR-08
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/ferramentas.test.ts#Grupo, Comunidade e Flow conferem Canal e Contato no CRM novo"
        status: pass
    human_judgment: false
  - id: D3
    description: "As 28 operações têm leitura do servidor; Contato de outro Espaço, sem WhatsApp ou forjado é recusado; resumidosPorIds traz só o Espaço, com WhatsApp principal e teto de 500"
    requirement: UCR-08
    verification:
      - kind: integration
        ref: "apps/api/src/rotas/operacoes-ferramentas.test.ts (Comunidade e Flow, Contatos, resumidosPorIds)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Telas das Ferramentas no navegador (recusas e aplicação otimista sem crm dizem 'Canal não encontrado' até o 15-22)"
    verification: []
    human_judgment: true
    rationale: "Comportamento intermediário registrado pelo plano (D-15-03): nada é publicado antes do corte; o 15-22 passa a mandar crm"

duration: 32min
completed: 2026-11-06
status: complete
---

# Phase 15 Plan 07: Ferramentas conferem Canal e Contato no CRM novo Summary

**Grupo, Comunidade, Flow e Automação de Ferramentas leem Canal e Contato de `crm: CrmDasFerramentas` (último parâmetro opcional), que o servidor monta de `plataforma.canais` e `plataforma.contatos` em 28 operações e que descarta o `crm` do navegador.**

## Performance

- **Duration:** 32 min
- **Started:** 2026-11-06T09:18:00Z (aprox.)
- **Completed:** 2026-11-06T09:51:00Z (aprox.)
- **Tasks:** 3
- **Files modified:** 17 (1 criado, 16 alterados; mais 2 CONTEXT.md e o WINDOWS.md)

## Accomplishments

- `criarGrupo` cria o Grupo com um Canal que só existe em `plataforma.canais` (projeção desligada no teste), o Grupo guarda o id do Canal da tabela, e um `crm` forjado com Canal inexistente é recusado, também na repetição.
- As recusas de `permissoes.ts` (`recusaDoCanal`, `recusaExternaNoGrupo`, `recusaExternaNaComunidade`, `recusaDeEnvioAoGrupo`, `recusaDePublicacao`, `recusaDeEnvioDeFlow`) mantêm `state` na primeira posição e ganham `crm?` no fim; nenhuma leitura de Canal ou Contato do modelo antigo sobra em `grupos.ts`, `comunidades.ts`, `flows.ts`, `permissoes.ts` e `automacoes.ts` (grep = 0).
- `LER_DO_CRM_FERRAMENTAS` cobre as 28 operações (15 de Grupo, 8 de Comunidade, 5 de Flow). Lê todos os Canais do Espaço e só os Contatos citados nos `args` ou na Participação ou Pedido alvo.
- `resumidosPorIds(ws, ids)`: só Contatos do Espaço, nome de exibição, estado e WhatsApp principal (senão o mais antigo), id repetido conta uma vez, mais de 500 ids lança.
- Esquemas: `CRM_DO_NAVEGADOR` (até 200 itens por lista) como último elemento opcional de cada tupla alterada.

## TDD

- **RED 1** (`c359741`): 4 casos de domínio e 4 de rota (Docker) para `criarGrupo`. Relatório vitest com falha em todos os alvos, sempre na asserção planejada: `ok` esperado verdadeiro e `Canal não encontrado.`, `/arquivado/` e `/desconectado/` recebendo "Canal não encontrado." e HTTP 400 no `crm` forjado (a tupla ainda não aceitava o 2º elemento). Avaliação semântica: os alvos rodaram e falharam pelo motivo previsto (o 4º argumento era ignorado), sem erro de importação nem de fixture. `workflow.tdd_mode` é `false`; o classificador `check tdd-red-evidence` não foi exigido.
- **GREEN 1** (`a8c9ae6`): `CrmDasFerramentas`, `permissoes.ts` e `criarGrupo` leem `crm`; leitura e esquema da rota. Com um ramo transitório em `permissoes.ts` (sem `crm`, olhar o modelo antigo) para a suíte de Ferramentas seguir verde enquanto os demais chamadores não migravam; o ramo saiu no GREEN 2.
- **RED 2** (`0ade0e7`): 9 casos de domínio, todos falhando na asserção planejada (o `crm` vazio não recusava, o Contato da tabela não entrava, etc.).
- **GREEN 2** (`7598452`): plumbing de `crm` em Grupo, Comunidade, Flow, Automação e Captação; 55/55 no arquivo e 2349/2349 no domínio.
- **RED 3** (`380585d`): 9 casos de rota/repositório falhando (`criarComunidade`, `criarFlow`, Contatos, `resumidosPorIds is not a function`). O caso de `sincronizarFlow` já passava antes e fica como guarda.
- **GREEN 3** (`7d4fd53`): repositório, leituras e esquemas; 39/39 nos cinco arquivos pedidos pelo plano.
- **REFACTOR:** nenhum.

## Task Commits

1. **Task 1 (traçador): `criarGrupo` confere o Canal em `plataforma.canais`** — `c359741` (test) e `a8c9ae6` (feat)
2. **Task 2: demais operações de Grupo, Comunidade, Flow e Automação** — `0ade0e7` (test) e `7598452` (feat)
3. **Task 3: leituras do servidor e `resumidosPorIds`** — `380585d` (test) e `7d4fd53` (feat)
4. **CONTEXT.md das rotas e do domínio** — `10d9dd1` (docs)

**Plan metadata:** commit `docs(15-07)` seguinte (SUMMARY, STATE, ROADMAP, REQUIREMENTS, WINDOWS).

## Files Created/Modified

- `packages/dominio/src/types/ferramentas.ts` - `CrmDasFerramentas`, `ContatoDaFerramenta`, `CRM_DAS_FERRAMENTAS_VAZIO`
- `packages/dominio/src/operations/ferramentas/permissoes.ts` - recusas com `crm?` e os helpers `canalNoCrm`, `contatoNoCrm`, `canalPeloNumeroNoCrm`, `nomeDoParticipanteNoCrm`
- `packages/dominio/src/operations/ferramentas/{grupos,comunidades,flows,automacoes,captacao}.ts` - `crm?` no fim de cada operação que confere Canal ou Contato
- `apps/api/src/rotas/gesto-no-crm/ferramentas.ts` - `LER_DO_CRM_FERRAMENTAS` preenchida
- `apps/api/src/repositorios/crm/contatos.ts` - `resumidosPorIds`
- `apps/api/src/rotas/esquemas/{fragmentos,grupos,comunidades,flows}.ts` - `CRM_DO_NAVEGADOR` nas tuplas
- `apps/api/src/rotas/operacoes-ferramentas.test.ts` - 15 casos com banco local

## Decisions Made

- `CRM_DO_NAVEGADOR` vive em `esquemas/fragmentos.ts`, porque a regra 5 de `esquemas/CONTEXT.md` manda fragmento de dois módulos ou mais para lá; `grupos.ts` o reexporta, que é o caminho que o plano cita.
- A capacidade do Canal nas recusas segue `CAPACIDADES_DE_ATIVOS[canal.tipo]` (as Capacidades de Ativos de Canal, por Tipo), não `capacidadesDoCanal`, que é a de conversa (janela de 24 h, modelo) e não tem `gruposAdministraveis`.
- `nomeDoParticipanteNoCrm` (Canal ou Contato de `crm`, senão o número) substitui `nomeDoParticipante` nos Registros de Grupo e Automação, assim o nome gravado vem do CRM novo.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] `simularEntradaPorClique` e eventos do provedor também recebem `crm?`**
- **Found during:** Task 2
- **Issue:** `receberPedidoDeEntrada`, `registrarEntradaNoGrupo`, `registrarSaidaDoGrupo`, `conversaDoGrupoOuCriar` e `receberRespostaDeFlow` (não registradas em `OPERACOES`) liam o Canal ou o Contato do modelo antigo; sem `crm` elas recusariam sempre. `captacao.ts`, que a chama, não estava na lista de arquivos.
- **Fix:** `crm?` no fim de cada uma; `simularEntradaPorClique(state, cliqueId, numero, crm?)` repassa.
- **Files modified:** `grupos.ts`, `flows.ts`, `captacao.ts`
- **Verification:** `ferramentas.test.ts` 55/55
- **Committed in:** `7598452`

**2. [Rule 3 - Blocking] `resolverOuCriarContato` aceita só os padrões do Canal**
- **Found during:** Task 2
- **Issue:** a função de `participacoes.ts` (do 15-17) pede um `Channel` antigo, e `importarGruposDoCanal` agora só tem o `Canal` novo.
- **Fix:** o parâmetro virou `Pick<Channel, "id" | "defaultContactOwnerMemberId" | "defaultQueueId" | "defaultOriginId">`, e `grupos.ts` monta os padrões do Canal novo (`padroesDoCanal`). Mudança só de tipo; o Contato continua nascendo no estado até o 15-17.
- **Files modified:** `participacoes.ts`, `grupos.ts`
- **Committed in:** `7598452`

**3. [Rule 1 - Bug] Ações de Automação de Tag e Campo do Contato**
- **Found during:** Task 2
- **Issue:** `contato.adicionarTag` e `contato.definirCampo` gravavam em `tagIds` e `fieldValues` do Contato antigo, que não é mais lido, e o evento agora resolve o Contato em `crm.contatos` (que não guarda Tag nem Campo).
- **Fix:** as duas Ações falham com a frase "Esta Ação ainda não grava no Contato do CRM novo (Tag e Campo do Contato não migraram).", em vez de fingir que gravaram. O teste de `INV-GRP-07` agora afirma a execução `falhou` com esse motivo. Registrado no `WINDOWS.md` (deviation, aberto).
- **Files modified:** `automacoes.ts`, `ferramentas.test.ts`
- **Committed in:** `7598452`

---

**Total deviations:** 3 auto-fixed (1 Rule 1, 1 Rule 2, 1 Rule 3)
**Impact on plan:** a 3 é uma regressão consciente e visível do demo (a Automação de boas-vindas deixa de gravar Tag); precisa de decisão no 15-17 ou 15-22. As outras duas são o mínimo para a suíte e a rota fecharem.

## Issues Encountered

- Baseline conhecido, fora deste plano: `outbox-worker.test.ts` (h a k) e `colunas-geradas.test.ts` (ordenação e planejador) falham na suíte completa da api e também isolados, em arquivos que este plano não toca. A suíte completa da api no Docker local: 2125 passaram, 4 falharam (só esses). Domínio: 2349/2349. Web: 1068/1068.

## Known Stubs

Nenhum stub de dado. Comportamento intermediário registrado pelo plano: no navegador, as recusas e a aplicação otimista de Grupo, Comunidade e Flow não mandam `crm` e dizem "Canal não encontrado" até o 15-22 (D-15-03, nada é publicado antes do corte). `ContatoACriar` fica no tipo para o 15-17.

## Threat Flags

Nenhum além do `<threat_model>`: T-15-20 (teste de rota com `crm` forjado, também repetido), T-15-21 (`where workspace_id = $1`, caso com Contato de outro Espaço) e T-15-22 (teto de 500) têm teste.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 15-17 pode trocar `resolverOuCriarContato` para o Contato novo (`contatosACriar` já está no tipo) e preencher `AO_CONFIRMAR_FERRAMENTAS`.
- 15-22 manda `crm` nas telas das Ferramentas; o 15-38 traz o filtro `comIdentificador`.
- Decidir o destino das Ações de Tag e Campo de Automação de Ferramentas (item aberto no `WINDOWS.md`).
- O container `crm-n1-pg-1507` foi parado; nenhum banco remoto foi tocado.

---
*Phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant*
*Completed: 2026-11-06*

## Self-Check: PASSED
