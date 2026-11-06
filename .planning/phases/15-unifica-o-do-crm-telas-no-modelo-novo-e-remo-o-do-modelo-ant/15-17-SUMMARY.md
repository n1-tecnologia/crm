---
phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
plan: 17
subsystem: api
tags: [ferramentas, grupos, contatos, participantes, gesto-misto, ids-pre-gerados, vitest, postgres]

requires:
  - phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
    provides: "15-07: CrmDasFerramentas, ContatoACriar, crm? como último parâmetro, LER_DO_CRM_FERRAMENTAS e AO_CONFIRMAR_FERRAMENTAS vazia; 15-01: LidoDoCrm.contatosACriar e AoConfirmarNoCrm"
provides:
  - "resolverOuCriarContato(state, numero, detalhe, crm) lê o Contato de crm.contatos ou o ContatoACriar do servidor e nunca inventa id nem escreve em state.contacts"
  - "numerosAResolver (fonte única dos números da operação e da leitura), gruposNovosDoProvedor, padroesDoContatoCriado (cadeia DO-CXE-05) e numeroExibido"
  - "repositorios/crm/contatos-de-participantes.ts: resolverContatosPorWhatsapp (mesclado resolve ao sobrevivente) e inserirContatosDeParticipantes (lote)"
  - "gesto-no-crm/ferramentas.ts: leitura e AO_CONFIRMAR de importarGruposDoCanal; lerContatosDosParticipantes e confirmarContatosDosParticipantes exportadas para os eventos do provedor"
affects: [15-22, 3.5.4 desligamento do Contato antigo, Fase 16 eventos reais do provedor]

actuals:
  tokens: 17000
  tasks: 3
  commits: 6

plan_head_before: e880c9cef32909a70a734e011eacfd1c376fe0da
plan_head_after: 39f58974c52cfc61c3b4bbbd075257df7f26f023
commits: 6

tech-stack:
  added: []
  patterns:
    - "ids de Contato pré-gerados pela leitura (randomUUID) e inseridos só se usados, no aoConfirmar do mesmo commit"
    - "lerContatosDosParticipantes / confirmarContatosDosParticipantes como par reutilizável pelos eventos do provedor"

key-files:
  created:
    - apps/api/src/repositorios/crm/contatos-de-participantes.ts
  modified:
    - packages/dominio/src/operations/ferramentas/participacoes.ts
    - packages/dominio/src/operations/ferramentas/grupos.ts
    - packages/dominio/src/operations/ferramentas/provedor-simulado.ts
    - packages/dominio/src/operations/ferramentas.test.ts
    - apps/api/src/rotas/gesto-no-crm/ferramentas.ts
    - apps/api/src/rotas/operacoes-ferramentas.test.ts
    - apps/api/src/rotas/CONTEXT.md
    - packages/dominio/CONTEXT.md

key-decisions:
  - "O Proprietário e a Origem do Contato criado são decididos no aoConfirmar (padroesDoContatoCriado, com o estado de depois), não na operação pura: ContatoACriar continua {id, nome, whatsapp}"
  - "contatos.origem recebe o NOME da Origem padrão do Canal (a coluna é texto livre); criado_por é o Membro que importou; nome fica nulo (o de exibição é o número)"
  - "Casa por dígitos nos dois lados e grava o Identificador como +<dígitos>; a busca no banco aceita +<dígitos> e <dígitos>"
  - "Para um mesclado, o item devolvido tem id do sobrevivente e whatsapp igual ao Identificador pelo qual foi achado, para a operação casar por número"

requirements-completed: [UCR-08]

coverage:
  - id: D1
    description: "Importar Grupo do Canal cria o Contato do Participante desconhecido em plataforma.contatos (modo automatico_automacao, Identificador whatsapp principal, Proprietário da cadeia do Canal) e a Participação aponta para o id; o conhecido mantém o id"
    requirement: UCR-08
    verification:
      - kind: integration
        ref: "apps/api/src/rotas/operacoes-ferramentas.test.ts#importarGruposDoCanal cria o Contato do Participante desconhecido em plataforma.contatos"
        status: pass
    human_judgment: false
  - id: D2
    description: "A operação pura não inventa id nem escreve em state.contacts; sem o Contato do servidor recusa antes de mexer no estado e sem o número na frase; contatosACriar forjado pelo navegador é descartado"
    requirement: UCR-08
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/ferramentas.test.ts#RN-GRP-10 — sem o Contato do servidor a importação recusa antes de mexer no estado"
        status: pass
      - kind: integration
        ref: "apps/api/src/rotas/operacoes-ferramentas.test.ts#um contatosACriar forjado no corpo não cria Contato (T-15-42)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Os eventos do provedor (Pedido de Entrada, entrada no Grupo, clique de Captação) resolvem o Contato pelo mesmo crm; mesclado resolve ao sobrevivente; só os Contatos usados são inseridos; colisão de Identificador derruba a transação inteira"
    requirement: UCR-08
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/ferramentas.test.ts#numerosAResolver — os eventos do provedor pedem o número do Participante"
        status: pass
      - kind: integration
        ref: "apps/api/src/rotas/operacoes-ferramentas.test.ts#o Contato do Participante nos eventos do provedor (15-17, 3.4.8)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Duas importações simultâneas do mesmo Grupo deixam 1 Contato e 1 Participação por número; repetir a importação não cria nada"
    requirement: UCR-08
    verification:
      - kind: integration
        ref: "apps/api/src/rotas/operacoes-ferramentas.test.ts#importações simultâneas do mesmo Grupo (15-17, UCR-08, concorrência)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Simulação local dos eventos do provedor e da importação no navegador, sem crm, até o 15-22 mandar o crm"
    verification: []
    human_judgment: true
    rationale: "Comportamento intermediário já registrado (D-15-03): nada é publicado antes do corte; WINDOWS.md #17"

duration: 33min
completed: 2026-11-06
status: complete
---

# Phase 15 Plan 17: Contato do Participante de Grupo nasce em plataforma.contatos Summary

**`importarGruposDoCanal` acha o Contato de cada número de WhatsApp por Identificador em `plataforma.contato_identificadores` (mesclado resolve ao sobrevivente), o servidor gera o id dos que faltam e o `aoConfirmar` insere, no mesmo commit, só os Contatos que a operação usou, sem duplicar sob concorrência.**

## Performance

- **Duration:** 33 min
- **Tasks:** 3
- **Files modified:** 9 (1 criado, 8 alterados)

## Accomplishments

- `resolverOuCriarContato` deixou de tocar `state.contacts` (grep = 0 em `participacoes.ts`): usa o Contato de `crm.contatos` ou o `ContatoACriar` do mesmo número em `crm.contatosACriar`; sem nenhum dos dois devolve "Contato do participante não resolvido." e a operação recusa, sem o número na frase.
- `importarGruposDoCanal` confere, antes de mexer no estado, que todo Participante tem Contato resolvido, então uma recusa nunca deixa Grupo pela metade.
- `numerosAResolver` é a fonte única dos números (a operação e a leitura do servidor usam a mesma lista, via `gruposNovosDoProvedor`); cobre também os três eventos do provedor.
- A leitura do servidor procura os Contatos em lote, gera `randomUUID()` para os que faltam; o `aoConfirmar` insere em `plataforma.contatos` e `contato_identificadores` só os que Participação ou Pedido de Entrada usam, com `modo_criacao = 'automatico_automacao'`, Proprietário pela cadeia Canal, Fila, Caixa, Espaço (DO-CXE-05) e a Origem padrão do Canal pelo nome.
- Provado em Postgres local: 8 desconhecidos viram 8 Contatos e 8 Identificadores, o conhecido mantém o id, repetir não duplica, `crm` e `contatosACriar` forjados são descartados, e duas chamadas simultâneas com `Promise.all` deixam 1 Contato e 1 Participação por número e 2 Grupos.

## TDD

- **RED 1** (`1a42be1`): 4 casos de rota em Docker; o primeiro falhou na asserção planejada (`expected 4 to be 12`: nenhum Contato novo na tabela). Os outros três (repetir, recusa, `contatosACriar` forjado) já passavam e ficam como guardas. `workflow.tdd_mode` é `false`; `check tdd-red-evidence` não foi exigido.
- **GREEN 1** (`2b42c72`): domínio, repositório, leitura e `aoConfirmar`; 19/19 no arquivo e domínio 2373/2373.
- **RED 2** (`4510cb3`): `numerosAResolver` dos eventos devolvia vazio (falha na asserção planejada); os outros 3 casos novos de domínio já passavam e ficam como guardas.
- **GREEN 2** (`c99acb3`): casos dos eventos, saída de `nomeDoParticipante` e `canalPeloNumero`, testes da cadeia do Proprietário e do repositório; 61/61 e 24/24.
- **Task 3** (`7dbc30a`): os dois casos de concorrência e repetição passaram de primeira, sem RED. O comportamento já vinha da Task 1 mais a trava do Espaço em `executar()`; sem a trava as duas importações gerariam ids distintos e o segundo INSERT cairia em `contato_identificadores_unico`. Rodado 3 vezes seguidas, 26/26 nas três.
- **REFACTOR:** nenhum.

## Task Commits

1. **Task 1 (traçador): importar Grupo cria o Contato em `plataforma.contatos`** — `1a42be1` (test) e `2b42c72` (feat)
2. **Task 2: eventos do provedor** — `4510cb3` (test) e `c99acb3` (feat)
3. **Task 3: concorrência e repetição** — `7dbc30a` (test)
4. **CONTEXT.md das rotas e do domínio** — `39f5897` (docs)

**Plan metadata:** commit `docs(15-17)` seguinte (SUMMARY, STATE, ROADMAP, WINDOWS).

## Files Created/Modified

- `apps/api/src/repositorios/crm/contatos-de-participantes.ts` (novo) - `resolverContatosPorWhatsapp`, `inserirContatosDeParticipantes`, `whatsappCanonico`
- `packages/dominio/src/operations/ferramentas/participacoes.ts` - `resolverOuCriarContato` novo, `contatoJaResolvido`, `numerosAResolver`, `padroesDoContatoCriado`, `numeroExibido`; saem `nomeDoParticipante` e `canalPeloNumero`
- `packages/dominio/src/operations/ferramentas/grupos.ts` - os três chamadores usam o Contato de `crm` e recusam com `{ erro }`; `padroesDoCanal` removido
- `packages/dominio/src/operations/ferramentas/provedor-simulado.ts` - `gruposNovosDoProvedor`
- `apps/api/src/rotas/gesto-no-crm/ferramentas.ts` - `leituraDaImportacaoDeGrupos`, `lerContatosDosParticipantes`, `confirmarContatosDosParticipantes`, `AO_CONFIRMAR_FERRAMENTAS.importarGruposDoCanal`
- Testes: `ferramentas.test.ts` (domínio) e `operacoes-ferramentas.test.ts` (api); `CONTEXT.md` de `rotas` e de `dominio`

## Decisions Made

- O Proprietário e a Origem do Contato novo são decididos no `aoConfirmar` com o estado de depois (`padroesDoContatoCriado`); `ContatoACriar` não ganha campos. A operação pura não conhece o Proprietário.
- `contatos.origem` (texto livre) recebe o nome da Origem do catálogo; `criado_por` passa a ser o Membro que importou (antes era o ator Sistema no modelo antigo); `nome` fica nulo e o de exibição é o número formatado, como antes.
- O Identificador novo é gravado como `+<dígitos>` (forma de `normalizarWhatsapp`); casa-se por dígitos no domínio e a busca no banco aceita `+<dígitos>` e `<dígitos>`.
- Para um Contato mesclado, o item lido tem o id do sobrevivente e o `whatsapp` é o Identificador pelo qual foi achado, não o principal do sobrevivente, para a operação casar por número.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Eventos do provedor não são operações de `POST /operacoes`**
- **Found during:** Task 2
- **Issue:** a Task 2 pede "entrada de leitura e de confirmação em `gesto-no-crm/ferramentas.ts`" para `receberPedidoDeEntrada`, `registrarEntradaNoGrupo` e `simularEntradaPorClique`, mas `TabelaDeLeituras`/`TabelaDeConfirmacoes` são indexadas por `NomeDeOperacao` e esses três não estão em `OPERACOES` (Eventos do provedor, sem rota). `comunidades.ts` não cria Contato e não precisou mudar.
- **Fix:** `numerosAResolver` cobre os três nomes e `lerContatosDosParticipantes` / `confirmarContatosDosParticipantes` ficam exportadas, testadas contra o banco, para a rota dos eventos reais (Fase 16) usar sem reescrever. Só `importarGruposDoCanal` tem entrada nas tabelas.
- **Files modified:** `participacoes.ts`, `gesto-no-crm/ferramentas.ts`
- **Committed in:** `c99acb3`

**2. [Rule 1 - Bug] Nome do `AO_CONFIRMAR` e assinatura de `resolverOuCriarContato`**
- **Found during:** Task 1
- **Issue:** o plano chama a tabela de `AO_CONFIRMAR_DAS_FERRAMENTAS` (existe `AO_CONFIRMAR_FERRAMENTAS`, do 15-01) e dá a `resolverOuCriarContato` o parâmetro `canal`, que o 15-07 já reduzira a padrões; sem Proprietário na operação pura o parâmetro ficou sem uso.
- **Fix:** manteve-se `AO_CONFIRMAR_FERRAMENTAS`; a função perdeu o `canal` e o Proprietário e a Origem vão por `padroesDoContatoCriado` no `aoConfirmar`. A truth 2 do plano (cadeia DO-CXE-05) é cumprida e testada.
- **Files modified:** `participacoes.ts`, `grupos.ts`, `gesto-no-crm/ferramentas.ts`
- **Committed in:** `2b42c72`

**3. [Rule 2 - Missing Critical] Conferir todos os Contatos antes de mexer no estado**
- **Found during:** Task 1
- **Issue:** sem a conferência prévia, uma recusa no meio do laço de Participantes deixaria Grupos e Atividades já gravados no estado em memória.
- **Fix:** `importarGruposDoCanal` roda `contatoJaResolvido` para todos os números de `numerosAResolver` antes de criar o primeiro Grupo.
- **Committed in:** `2b42c72`

**4. [Rule 3 - Blocking] Código morto que lia o modelo antigo**
- **Found during:** Task 2
- **Issue:** a acceptance exige zero `state.contacts` em `participacoes.ts`; `nomeDoParticipante` (sem chamadores) lia `state.contacts` e `canalPeloNumero` lia `state.channels`.
- **Fix:** os dois exports sem uso foram removidos (a versão do CRM novo, `nomeDoParticipanteNoCrm`, vem do 15-07).
- **Committed in:** `2b42c72` e `c99acb3`

---

**Total deviations:** 4 auto-fixed (1 Rule 1, 1 Rule 2, 2 Rule 3)
**Impact on plan:** o escopo do plano foi cumprido; o único efeito visível é a regressão intermediária do item 1 de Known Stubs, já prevista pelo D-15-03.

## Issues Encountered

- Em `operacoes-ferramentas.test.ts` o Espaço de teste vem do seed, que já tem Grupos de origem `importado`; o primeiro filtro dos casos novos (`origemDeCriacao = 'importado'`) contava e apagava os Grupos do seed. Trocado por um filtro pelos dois JIDs do provedor simulado.
- Baseline conhecido, não tocado: `outbox-worker.test.ts` h a k, `colunas-geradas.test.ts` e `lote-contas-a-pagar (d)`. A suíte completa da api não foi rodada (13–17 min, regra do projeto); rodados `src/rotas` inteira (59 arquivos, 702 passaram, 1 skip), `src/repositorios/crm`, `src/sem-crm-antigo.test.ts`, domínio (2373/2373) e web (1081/1081), mais `tsc --noEmit` nos três workspaces.

## Known Stubs

1. No navegador, a simulação local de Pedido de Entrada, de clique de Captação e a importação de Grupos não mandam `crm`: recusam ("Contato do participante não resolvido." ou "Canal não encontrado.") até o 15-22 mandar `crm` e `contatosACriar`. O servidor grava certo pelas tabelas. Registrado em `WINDOWS.md` #17 (aberto).
2. Os eventos do provedor ainda não têm rota; `lerContatosDosParticipantes` e `confirmarContatosDosParticipantes` esperam por ela (Fase 16).

## Open item (WINDOWS.md #12, não resolvido aqui)

As Ações de Automação `contato.adicionarTag` e `contato.definirCampo` continuam falhando com a frase do 15-07: o plano 15-17 não trata Tag nem Campo do Contato, então o destino segue aberto para o 15-22 ou para decisão do dono. A linha #12 fica `open`.

## Threat Flags

Nenhum além do `<threat_model>`: T-15-42 (ids só do `ler` do servidor, teste de `contatosACriar` forjado), T-15-43 (trava do Espaço, `contato_identificadores_unico` provado com colisão e `Promise.all`) e T-15-44 (nenhuma mensagem de erro nem log traz o número; o teste afirma a frase) têm teste. A nova superfície de escrita (INSERT em `contatos` e `contato_identificadores` pelo `aoConfirmar`) é a que o plano descreve.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 15-22 manda `crm` (Canais, Contatos e `contatosACriar`) nas telas das Ferramentas e decide o destino das Ações de Tag e Campo.
- A rota dos eventos do provedor (Fase 16) usa `lerContatosDosParticipantes` e `confirmarContatosDosParticipantes` e passa o Canal do Grupo.
- O contêiner `crm-n1-pg-1517` foi parado; nenhum banco remoto foi tocado.

---
*Phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant*
*Completed: 2026-11-06*

## Self-Check: PASSED
