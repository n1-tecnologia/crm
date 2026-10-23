---
phase: 09-seguran-a-dos-dados-e-base-de-produ-o
plan: 02
subsystem: dominio
tags: [privacidade, visibilidade, recorte, convidado, segredo-de-link, vitest, seg-01, seg-02]

requires:
  - phase: 09-seguran-a-dos-dados-e-base-de-produ-o
    provides: "09-01: visibilidadePara sem retorno antecipado, parte sempre do estado inteiro, membroVeSessaoDeChat"
provides:
  - "recortarRegistro(colecao, dados, state, memberId): cópia sem Memória de outro Membro, sem e-mail de convite, sem segredo de link; coleção sem regra volta intacta"
  - "recortarDiferenca e recortarValor: o diff e o value de uma gravação passam pelo mesmo recorte do estado (F1)"
  - "visibilidadePara com members/views/tasks/forms/files recortados e as cinco coleções de IA vazias para base convidado"
  - "membroVeArquivo e files: Arquivo órfão com conteúdo real só para quem criou e para quem administra o Espaço"
  - "actorLabel sem sufixo duplicado para Agente/Automação ausentes"
affects: [09-07, 09-08, 09-15]

actuals:
  tokens: 9500
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "Segredo some trocando o valor por \"\", nunca apagando a chave (os tipos dizem readonly secret: string)"
    - "Recorte de registro por coleção num switch; default devolve os dados intactos"
    - "A decisão de recorte olha o estado INTEIRO (Papéis, concessões); o estado recortado já não os traz inteiros"

key-files:
  created: []
  modified:
    - packages/dominio/src/derive-visibilidade.ts
    - packages/dominio/src/derive-visibilidade.test.ts
    - packages/dominio/src/derive.ts

key-decisions:
  - "recortarValor também caminha em objeto de id desconhecido (não só em objeto sem id): um objeto com id que não é Membro, Tarefa nem Formulário pode carregar uma Tarefa dentro, e devolvê-lo 'como veio' abriria o segredo. Devolve o mesmo objeto quando nada mudou."
  - "arquivoSemConteudo é importado de operations/anexos-enviados: não há ciclo (só a API e o teste importam derive-visibilidade), então não foi preciso o helper local que o plano admitia."
  - "A fronteira do Convidado é baseDoPapel === 'convidado' (de permissoes-ia): vale para Papel personalizado de base convidado, como a sonda de adjacência pedia."

patterns-established:
  - "semIA(registros): esvazia a coleção e põe os ids em ocultos num só passo, de modo que atividade e aprovações sobre eles também saem"

requirements-completed: [SEG-01, SEG-02]

duration: 8min
completed: 2026-10-23
status: complete
plan_head_before: 9a6df175e76170067d390c44a41b20d570458d3c
plan_head_after: b8fd727a5ee858c9e95ce432f920e2cbf7f589d0

coverage:
  - id: D1
    description: "Memória de Usuário de outro Membro chega como { enabled, items: [] }; a própria chega com os itens; o Proprietário também não lê a de outro"
    requirement: SEG-01
    verification:
      - kind: unit
        ref: "packages/dominio/src/derive-visibilidade.test.ts#a Memória de Usuário de outro Membro chega vazia (com o enabled dele); a própria chega com os itens"
        status: pass
    human_judgment: false
  - id: D2
    description: "E-mail de convite pendente só chega a Administrador e Proprietário; os demais veem 'Convite pendente' e nenhum invitedIdentity"
    requirement: SEG-01
    verification:
      - kind: unit
        ref: "packages/dominio/src/derive-visibilidade.test.ts#o e-mail de um convite pendente só chega a Administrador e Proprietário; os demais veem 'Convite pendente'"
        status: pass
    human_judgment: false
  - id: D3
    description: "Visão pessoal de outro Membro sai do estado e entra em ocultos; a própria e a de contêiner ficam"
    requirement: SEG-01
    verification:
      - kind: unit
        ref: "packages/dominio/src/derive-visibilidade.test.ts#a Visão pessoal de outro Membro não chega (id em ocultos); a própria e a de contêiner chegam"
        status: pass
    human_judgment: false
  - id: D4
    description: "publicShare.secret e Form.secret chegam como \"\" a quem não administra a Lista (chave preservada); quem administra recebe o segredo; Formulário de Lista oculta sai"
    requirement: SEG-01
    verification:
      - kind: unit
        ref: "packages/dominio/src/derive-visibilidade.test.ts#o segredo do link público de uma Tarefa some para quem não administra a Lista; a chave fica e o resto também"
        status: pass
      - kind: unit
        ref: "packages/dominio/src/derive-visibilidade.test.ts#o segredo do Formulário chega a quem administra a Lista, vem vazio a quem só a alcança, e o de Lista oculta não chega"
        status: pass
    human_judgment: false
  - id: D5
    description: "Convidado (e Papel personalizado de base convidado) recebe agents, automations, documents, collections e skills como []; membro/administrador/proprietário recebem as cinco inteiras; toda chave de COLECOES segue presente"
    requirement: SEG-02
    verification:
      - kind: unit
        ref: "packages/dominio/src/derive-visibilidade.test.ts#Convidado, rótulo do ator e Arquivo órfão (D-02, D-03, R3)"
        status: pass
    human_judgment: false
  - id: D6
    description: "actorLabel de Agente/Automação ausente devolve 'Agente'/'Automação'; com o registro, '<nome> (Agente)'; setTaskFieldValue da Pessoa da conta dá o mesmo ok com o estado inteiro e sem as cinco coleções (R5)"
    requirement: SEG-02
    verification:
      - kind: unit
        ref: "packages/dominio/src/derive-visibilidade.test.ts#actorLabel de Agente ou Automação ausente do estado devolve só o rótulo; com o registro, '<nome> (Agente)'"
        status: pass
      - kind: unit
        ref: "packages/dominio/src/derive-visibilidade.test.ts#R5 — setTaskFieldValue da Pessoa da conta dá o mesmo resultado com o estado inteiro e sem as cinco coleções de IA"
        status: pass
    human_judgment: false
  - id: D7
    description: "Arquivo órfão com conteúdo real só para quem criou e para quem administra o Espaço (membroVeArquivo e files); legado/* segue aberto"
    requirement: SEG-02
    verification:
      - kind: unit
        ref: "packages/dominio/src/derive-visibilidade.test.ts#Arquivo órfão"
        status: pass
    human_judgment: false
  - id: D8
    description: "recortarDiferenca e recortarValor aplicam o recorte ao diff e ao value de uma gravação (segredo, Memória, ocultos fora/null, ordem preservada, ocultos pronto = calculado)"
    requirement: SEG-01
    verification:
      - kind: unit
        ref: "packages/dominio/src/derive-visibilidade.test.ts#recortarDiferenca e recortarValor (F1, 1.1.5)"
        status: pass
    human_judgment: false
---

# Phase 9 Plan 02: Recorte completo no domínio Summary

**`recortarRegistro`, `recortarDiferenca` e `recortarValor` no domínio, mais `visibilidadePara` entregando um estado sem Memória, e-mail de convite nem Visão pessoal de outro Membro, sem segredo de link para quem não administra a Lista, sem as cinco coleções de IA para o Convidado e sem Arquivo órfão alheio.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-10-23T00:08:28Z
- **Completed:** 2026-10-23T00:16Z
- **Tasks:** 3
- **Files modified:** 3 (todos em `packages/dominio/src`)

## Accomplishments

- `recortarRegistro<T>(colecao, dados, state, memberId)`: `members` perde os itens da Memória de outro Membro (o `enabled` fica) e, para quem não administra o Espaço, o `invitedIdentity` do `pendente` (e `displayName` vira "Convite pendente"); `tasks` e `forms` trocam `secret` por `""` quando `containerAdminRefusal(state, memberId, "list", listId)` recusa. Coleção sem regra volta intacta.
- `visibilidadePara` usa o recorte em `members`, `tasks` e `forms`, tira de `views` as pessoais alheias, tira de `forms` os de Lista oculta (ids em `ocultos`), esvazia as cinco coleções de IA para base `convidado` e aplica a regra do Arquivo órfão a `files`.
- `membroVeArquivo`: Arquivo que nenhuma Tarefa carrega e com conteúdo real é de quem o criou e de quem administra o Espaço; `legado/*` segue aberto.
- `actorLabel`: Agente e Automação ausentes do estado viram "Agente" / "Automação".
- `recortarDiferenca` e `recortarValor` prontas para 09-07 aplicar em `POST /operacoes`: o diff e o `value` passam pela mesma regra do estado.

## Task Commits

Cada tarefa tem um commit RED (`test`) e um GREEN (`feat`):

1. **Task 1: recortarRegistro** — RED `38acbcc`, GREEN `273c6ca`
2. **Task 2: Convidado, actorLabel, Arquivo órfão** — RED `5b189db`, GREEN `1ce38b3`
3. **Task 3: recortarDiferenca e recortarValor** — RED `584de42`, GREEN `b8fd727`

**Plan metadata:** commit `docs(09-02)` seguinte a este arquivo.

## TDD / Evidência

O plano é `type: execute` (com `tdd="true"` por tarefa) e `workflow.tdd_mode` é `false`; não há `## TDD Gate Compliance` formal e o classificador `tdd-red-evidence` não foi usado (o Vitest do repositório não emite o formato que ele lê aqui). A evidência RED é a saída real do Vitest antes do código:

- **Task 1 RED:** 6 dos 7 testes novos falharam em asserções do comportamento planejado (Memória com itens, `invitedIdentity` presente, Visão alheia presente, `secret` "demo-tarefa"/"demo-formulario" em vez de `""`); o sétimo falhou com `recortarRegistro is not a function` (a função ainda não existia). Os 14 testes anteriores seguiam verdes.
- **Task 2 RED:** 5 falhas: Convidado com `agents` cheio, Papel personalizado idem, `actorLabel` = "Agente (Agente)", Arquivo órfão visível a quem não criou, e o teste POSC-08 antigo (ver desvio 2). O teste R5 já passava (a propriedade existe hoje; o teste a trava e inclui o contraste aceita/recusa para não ser vazio).
- **Task 3 RED:** 3 falhas, `recortarDiferenca`/`recortarValor` "is not a function".
- Os commits RED deixam `tsc` vermelho (importam função ainda inexistente); cada GREEN deixa `tsc` e a suíte verdes.

## Files Created/Modified

- `packages/dominio/src/derive-visibilidade.ts` — `recortarRegistro`, `recortarDiferenca`, `recortarValor`, recorte novo em `visibilidadePara`, regra do Arquivo órfão, cabeçalho atualizado
- `packages/dominio/src/derive-visibilidade.test.ts` — três `describe` novos (21 casos) e dois testes antigos ajustados
- `packages/dominio/src/derive.ts` — `actorLabel` sem sufixo duplicado

## Decisions Made

- `recortarValor` também caminha dentro de objeto de `id` desconhecido (o plano só pedia isso para objeto sem `id`): um objeto com `id` que não é Membro, Tarefa nem Formulário poderia carregar uma Tarefa dentro, e devolvê-lo intacto abriria o segredo. Devolve o mesmo objeto quando nada mudou.
- `arquivoSemConteudo` é importado de `operations/anexos-enviados` direto: só a API e o teste importam `derive-visibilidade`, então não há ciclo e o helper local que o plano admitia não foi necessário.
- A fronteira do Convidado é `baseDoPapel(...) === "convidado"`: um Papel personalizado de base `convidado` (`role_agente_crm`) também recebe as cinco vazias.
- As ocultações das cinco coleções entram em `ocultos` antes do filtro de `activity`/`approvals`, então Registros de Atividade sobre um Agente ou Documento também somem para o Convidado.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Teste que exigia `estado.members` idêntico ao do estado inteiro**
- **Found during:** Task 1
- **Issue:** `visibilidadePara > quem não alcança Gestão…` afirmava `expect(estado.members).toBe(state.members)`. Com a Memória de outro Membro recortada, os Membros viram cópias por definição.
- **Fix:** a asserção passou a comparar os ids na ordem do estado (todos os Membros chegam, na mesma ordem).
- **Files modified:** `packages/dominio/src/derive-visibilidade.test.ts`
- **Verification:** suíte de domínio verde
- **Committed in:** `273c6ca`

**2. [Rule 1 - Bug] Teste POSC-08 que afirmava o Arquivo órfão aberto a quem tem sessão**
- **Found during:** Task 2
- **Issue:** o trecho "Sem Tarefa nenhuma, fica aberto a quem tem sessão no Espaço" é exatamente o comportamento que R3/F8 manda remover.
- **Fix:** trocado por: o Membro sem Gestão não vê o órfão (nem em `membroVeArquivo`, nem em `files`), e o criador (Financeiro) vê. O comentário cita a Fase 9, R3.
- **Files modified:** `packages/dominio/src/derive-visibilidade.test.ts`
- **Verification:** suíte de domínio verde
- **Committed in:** `5b189db` (RED, para a falha ser a esperada) e `1ce38b3`

---

**Total deviations:** 2 auto-fixed (2 testes obsoletos pelo comportamento que o plano manda mudar)
**Impact on plan:** nenhum desvio de escopo.

## Issues Encountered

- Um `cat > /tmp/x` esquecido num comando bloqueou à espera de stdin e foi movido para segundo plano; não escreveu nada no repositório.
- `packages/dominio` não é coberto por ESLint (o ESLint do `apps/web` ignora arquivos fora da base); a verificação de qualidade foi `tsc --noEmit` e a suíte.

## Known Stubs

Nenhum.

## Threat Flags

Nenhum: o plano só reduz superfície. T-09-06 a T-09-11 ficam mitigadas no domínio; T-09-11 só se fecha por HTTP em 09-07, quando a rota chamar `recortarDiferenca` e `recortarValor`. T-09-12 é aceita (D-22). T-09-SC: nenhum pacote instalado.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **09-07** aplica `recortarDiferenca` e `recortarValor` em `POST /operacoes` (passando o estado inteiro DEPOIS da gravação e `ocultos` já calculado) e prova por HTTP.
- **09-08** ajusta as telas: quem lia `publicShare.secret` / `Form.secret` agora recebe `""` sem administrar a Lista; o Convidado chega sem Agentes, Automações, Documentos, Coleções e Habilidades. Há uma cópia local de `actorLabel` em `apps/web/src/features/estrutura/tarefa-completa.tsx:2362` ("Agente eliminado (Agente)") que este plano não tocou.
- Verificação: `npx vitest run` em `packages/dominio` = 95 arquivos, 1862 testes verdes; `npx tsc --noEmit` verde; `npm run typecheck` da raiz sem erro; `apps/web` 559 testes verdes. Os testes de `apps/api` que dependem de Postgres não foram executados (nenhum arquivo de `apps/api` mudou).

## Self-Check: PASSED

Os três arquivos modificados existem; os seis commits (`38acbcc`, `273c6ca`, `5b189db`, `1ce38b3`, `584de42`, `b8fd727`) estão no histórico; `grep -c` de `export function recortarRegistro|recortarDiferenca|recortarValor` = 1 cada, `"convidado"` ≥ 1, `administraOEspaco` = 3, `Convite pendente` = 2.

---
*Phase: 09-seguran-a-dos-dados-e-base-de-produ-o*
*Completed: 2026-10-23*
