---
phase: 09-seguran-a-dos-dados-e-base-de-produ-o
plan: 07
subsystem: api
tags: [privacidade, recorte, post-operacoes, suspenso, vazamento, outbox, postgres-local, seg-01, seg-03]

requires:
  - phase: 09-seguran-a-dos-dados-e-base-de-produ-o
    provides: "09-01: fábrica espaco-de-vazamento.ts e o padrão de teste que procura o texto único no corpo da resposta"
  - phase: 09-seguran-a-dos-dados-e-base-de-produ-o
    provides: "09-02: recortarDiferenca, recortarValor, recortarRegistro e a regra do Arquivo órfão no domínio"
  - phase: 09-seguran-a-dos-dados-e-base-de-produ-o
    provides: "09-03: recusaDeEscritaNoCrmAntigo (a segunda barreira do suspenso nas operações do CRM antigo)"
provides:
  - "POST /operacoes/:nome responde com recortarDiferenca e value: recortarValor sobre o estado DEPOIS da operação, com um único visibilidadePara"
  - "inviteMember (caminho SERVICOS) volta pelo mesmo recorte: convidarMembro aceita deps.aoTerminar(state) e a resposta traz sequencia"
  - "FRASE_DE_SUSPENSO e recusaDeSuspenso em plugins/autenticacao.ts; 403 do suspenso logo depois de ehNomeDeOperacao, antes do banco"
  - "fábrica espaco-de-vazamento.ts completa: Memória e Visão de A e B, convite pendente, segredos de link e de Formulário, Campo gravável por B, Arquivo órfão, Membro suspenso"
  - "teste de vazamento de ponta a ponta de GET /estado (1.1.6) e prova do Arquivo órfão por HTTP (R3/F8)"
affects: [09-08, 09-12, 09-15]

actuals:
  tokens: 9600
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "O recorte da resposta roda depois de executar(), nunca dentro do callback: o outbox do Canal continua derivado do estado inteiro (R6)"
    - "Os dois ramos de POST /operacoes (executar e SERVICOS) preenchem a mesma variável `depois` e saem pelo mesmo envio final"
    - "A recusa por estado do Membro (suspenso) mora numa função exportada do plugin de autenticação, reusável pelas rotas REST"

key-files:
  created:
    - apps/api/src/rotas/operacoes-suspenso.test.ts
  modified:
    - apps/api/src/rotas/operacoes.ts
    - apps/api/src/servicos/convidar-membro.ts
    - apps/api/src/plugins/autenticacao.ts
    - apps/api/src/testes/espaco-de-vazamento.ts
    - apps/api/src/rotas/estado.test.ts
    - apps/api/src/rotas/operacoes.test.ts
    - apps/api/src/rotas/CONTEXT.md

key-decisions:
  - "O teste do caminho SERVICOS afirma o que é observável: sequencia numérica, diferenca presente e o e-mail do convite voltando a quem convida (que administra o Espaço). O recorte em si, que tira o dado alheio, é provado no ramo executar() e no domínio (09-02)."
  - "Um conflito de revisão (409) não ganhou teste novo: o ramo responde antes do envio recortado e não foi tocado; provocar um conflito real exigiria concorrência artificial."
  - "A tabela de tokens da fábrica ganhou `suspenso`; o Membro suspenso é um quarto Membro ativo do seed marcado `suspenso` só no estado da fábrica (A, B e Proprietário ficam como estavam)."

patterns-established:
  - "Teste de vazamento por HTTP: cada dado privado ou segredo é procurado no corpo inteiro da resposta (string), nunca só em campos escolhidos"
  - "Teste sem banco com DATABASE_URL vazia prova que uma recusa vem antes de qualquer acesso ao banco"

requirements-completed: [SEG-01, SEG-03]

duration: 8min
completed: 2026-10-23
status: complete
plan_head_before: c80fc244aeb9b855cff37669189d922bc3de0da2
plan_head_after: d8375d7c8da889ad599da49e2661598f46930edf

coverage:
  - id: D1
    description: "GET /estado de B não contém frase privada de A (mensagem, entrada, saída, Memória), id privado de A (Sessão, pasta, Execução, Visão), e-mail do convite, segredo do link, segredo do Formulário nem o Arquivo órfão de A; contém a Memória, a Sessão, a pasta e a Visão do próprio B; a Tarefa do link chega com publicShare.secret vazio"
    requirement: SEG-01
    verification:
      - kind: integration
        ref: "apps/api/src/rotas/estado.test.ts#GET /estado — vazamento entre Membros (1.1.6, D-01, D-22) (a)"
        status: pass
    human_judgment: false
  - id: D2
    description: "O Proprietário recebe o e-mail do convite e os segredos da Lista que administra, mas nenhuma frase privada nem Visão pessoal de A ou de B"
    requirement: SEG-01
    verification:
      - kind: integration
        ref: "apps/api/src/rotas/estado.test.ts#GET /estado — vazamento entre Membros (1.1.6, D-01, D-22) (b)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Arquivo órfão de A dá 404 em GET /anexos/:fileId/url para B e não dá 404 para A"
    requirement: SEG-01
    verification:
      - kind: integration
        ref: "apps/api/src/rotas/estado.test.ts#GET /estado — vazamento entre Membros (1.1.6, D-01, D-22) (d)"
        status: pass
    human_judgment: false
  - id: D4
    description: "B grava um Campo numa Tarefa com link público e o corpo inteiro da resposta (value e diferenca) não contém o segredo; o Proprietário convida por SERVICOS e a resposta traz sequencia e diferenca; ok:false segue em 200 sem value"
    requirement: SEG-01
    verification:
      - kind: integration
        ref: "apps/api/src/rotas/operacoes.test.ts#POST /operacoes — resposta recortada pelo que o Membro enxerga (1.1.5, F1) e Membro suspenso (1.2.1)"
        status: pass
    human_judgment: false
  - id: D5
    description: "O Membro suspenso recebe 403 com a frase do acesso suspenso em POST /operacoes antes de validar argumento e antes de tocar o banco; nome inexistente segue 404; Membro ativo com argumento inválido segue 400; com banco o Contato continua ativo"
    requirement: SEG-03
    verification:
      - kind: unit
        ref: "apps/api/src/rotas/operacoes-suspenso.test.ts (DATABASE_URL vazia)"
        status: pass
      - kind: integration
        ref: "apps/api/src/rotas/operacoes.test.ts#1.2.1 — o Membro suspenso chama trashContact e recebe 403"
        status: pass
    human_judgment: false
  - id: D6
    description: "O recorte roda depois de executar() e o evento de outbox automacao.notificar-canal.v1 continua derivado do estado inteiro"
    requirement: SEG-01
    verification:
      - kind: integration
        ref: "apps/api/src/rotas/operacoes.test.ts casos (w)/(x) (outbox de Canal), na suíte rotas inteira contra o Postgres local"
        status: pass
    human_judgment: false
---

# Phase 9 Plan 07: Recorte na resposta de POST /operacoes e o suspenso barrado Summary

**`POST /operacoes/:nome` responde com `diferenca` e `value` recortados pelo que o Membro enxerga nos dois ramos (`executar()` e `SERVICOS`), o Membro suspenso recebe 403 antes de qualquer validação ou acesso ao banco, e o teste de vazamento de ponta a ponta de `GET /estado` cobre Memória, Visão, convite, segredos e Arquivo órfão.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-10-23T01:14:27Z
- **Completed:** 2026-10-23T01:22Z
- **Tasks:** 3
- **Files modified:** 8 (7 alterados, 1 criado)

## Accomplishments

- A fábrica `espaco-de-vazamento.ts` semeia, além do Chat de 09-01: um item de Memória de Usuário e uma Visão pessoal para A e B; um convite pendente; numa Lista que B alcança sem administrar (escolhida com as próprias funções do domínio, num clone do estado), uma Tarefa com link público, um Formulário e um Campo numérico que B grava; um Arquivo órfão de A com conteúdo real; e um quarto Membro marcado `suspenso`. Se o seed não oferecer a Lista ou o Campo, o erro diz o quê.
- `estado.test.ts` (1.1.6): como B, o corpo inteiro não tem nenhuma frase privada de A, nenhum id privado de A, o e-mail do convite, os dois segredos nem o Arquivo órfão, e tem o que é de B; como Proprietário, tem o e-mail do convite e os segredos, mas nenhuma frase privada nem Visão pessoal de ninguém. O 404 do Arquivo órfão por `GET /anexos/:fileId/url` está provado por HTTP (B: 404; A: não 404).
- `operacoes.ts`: o envio final usa um único `visibilidadePara(depois, …)` e devolve `recortarDiferenca`, `value: recortarValor` (só quando `ok`) e `sequencia`. O ramo `SERVICOS` passa um `aoTerminar` que preenche `depois`, e `convidarMembro` o chama dentro do callback de `executar()`: `inviteMember` agora sai pelo mesmo envio, com `sequencia`.
- 1.2.1: `FRASE_DE_SUSPENSO` e `recusaDeSuspenso` em `plugins/autenticacao.ts`; a rota responde 403 logo depois de `ehNomeDeOperacao`, antes de validar o argumento. Provado sem `DATABASE_URL` e, com banco, o Contato de `trashContact` continua `ativo`.

## Task Commits

1. **Task 1: teste de vazamento de ponta a ponta + Arquivo órfão por HTTP** — `82803f9` (test)
2. **Task 2: resposta recortada nos dois ramos** — RED `89dbcef` (test), GREEN `ae10e8a` (feat)
3. **Task 3: suspenso barrado em POST /operacoes** — RED `76d7ced` (test), GREEN `d8375d7` (feat)

**Plan metadata:** commit `docs(09-07)` seguinte a este arquivo.

## TDD / Evidência

O plano é `type: execute` (`tdd="true"` por tarefa) e `workflow.tdd_mode` é `false`; o classificador `tdd-red-evidence` não foi usado (o Vitest do repositório não emite o formato que ele lê aqui). A evidência é a saída real do Vitest:

- **Task 1 (testes nascidos verdes):** o recorte do domínio já existia (09-01/09-02), então os testes novos de `GET /estado` passaram de início ("unexpected green" investigado: o comportamento já existe, não é teste errado). Foram validados por três mutações no `derive-visibilidade.ts`, todas reprovadas e revertidas: `recortarRegistro` devolvendo os dados (reprova (a) e (b)); Arquivo órfão aberto a todos (reprova (a) e (d)); Visão pessoal alheia passando (reprova (a), (b) e (c)).
- **Task 2 RED:** 2 de 3 falharam pelo motivo planejado: `segredo do link público: expected '{"ok":true,"value":{"id":"tsk_seed_3"…' not to contain 'SEGREDO-LINK-…'` e `expected 'undefined' to be 'number'` (`sequencia` ausente em `inviteMember`). O terceiro (ok:false) já descrevia o comportamento atual.
- **Task 3 RED:** sem banco, `expected 400 to be 403` (a validação do argumento vinha antes); com banco, `trashContact` do suspenso voltava 200 com `"Só um Membro ativo altera o CRM."` (a barreira de 09-03 recusa no domínio, mas a rota ainda não responde 403).
- Os commits RED deixam `tsc` vermelho no de Task 3 (importa `FRASE_DE_SUSPENSO` ainda inexistente); cada GREEN deixa `tsc` e as suítes verdes.

## Verificação (contra o Postgres local `crm-n1-pg-0907`, porta 55607)

- `estado.test.ts`: 13/13, nenhum teste pulado.
- `operacoes.test.ts -t "1.1.5"`: 4 passaram (os 3 comportamentos da Task 2 e o do suspenso com banco).
- `operacoes-suspenso.test.ts` com `DATABASE_URL=` vazia: 3/3.
- `npm run typecheck` (três workspaces) verde; `npm run lint`: 0 erros, 3 avisos pré-existentes em `app-shell.tsx`.
- Regressão contra `GET /estado` e `POST /operacoes` com dado hidratado do Postgres (a lição de 4aec7b7): `src/rotas` inteiro, `src/e2e/canais-fluxo`, `criar-conta`, `dois-servicos`, `falhas-injetadas`, `crm-fluxo`, `src/servicos/convidar-membro`, `src/plugins`: 54 arquivos passaram, 2 pulados, 490 testes passaram, 18 pulados, 1 todo, 0 falhas. Não rodado, por ordem do orquestrador: `lote-contas-a-pagar` (caso (d) estoura o timeout neste ambiente com ou sem a Fase 9) e `latencia`.

## Files Created/Modified

- `apps/api/src/rotas/operacoes.ts` — envio final recortado, `SERVICOS` com `aoTerminar`, 403 do suspenso
- `apps/api/src/servicos/convidar-membro.ts` — `deps.aoTerminar`
- `apps/api/src/plugins/autenticacao.ts` — `FRASE_DE_SUSPENSO`, `recusaDeSuspenso`
- `apps/api/src/testes/espaco-de-vazamento.ts` — fábrica completa (Memória, Visão, convite, segredos, Campo, Arquivo órfão, suspenso)
- `apps/api/src/rotas/estado.test.ts` — bloco "vazamento entre Membros (1.1.6, D-01, D-22)" com (a) a (d)
- `apps/api/src/rotas/operacoes.test.ts` — bloco `describeComBanco` de 1.1.5 e 1.2.1; `vi.mock` de `resolverUsuarioPorEmail`
- `apps/api/src/rotas/operacoes-suspenso.test.ts` — novo, sem banco
- `apps/api/src/rotas/CONTEXT.md` — a resposta recortada e a recusa do suspenso

## Decisions Made

- O teste do caminho `SERVICOS` afirma o observável (sequencia numérica, diferenca presente, e-mail do convite voltando a quem convida e nenhuma frase privada); o recorte que tira dado alheio é provado no ramo `executar()` e no domínio.
- Conflito 409 sem teste novo: o ramo responde antes do envio recortado e não foi tocado.
- O Membro suspenso da fábrica é um quarto Membro ativo do seed marcado `suspenso` só no estado da fábrica.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug de premissa do plano] `ok:false` não responde "sem `diferenca`"**
- **Found during:** Task 2 (teste do terceiro comportamento)
- **Issue:** o plano descreve uma operação `ok:false` respondendo "como antes (sem `diferenca`)". Na realidade `executar()` devolve `diferenca` vazia (`DIFERENCA_VAZIA`) também quando o domínio recusa, e a rota sempre a enviou assim.
- **Fix:** o teste afirma o comportamento real e preservado: 200, `ok:false`, `error` em texto, diferença vazia e nenhum `value`. A rota só soma `value` quando `resultado.ok`.
- **Files modified:** `apps/api/src/rotas/operacoes.test.ts`
- **Committed in:** `89dbcef`

---

**Total deviations:** 1 auto-fixed (premissa do plano sobre o corpo de `ok:false`)
**Impact on plan:** nenhum desvio de escopo; o comportamento preservado é o que o plano queria preservar.

## Issues Encountered

- `timeout` não existe no macOS: uma primeira execução da regressão com `timeout 560` não rodou nada e foi refeita sem ele.
- A lição de 4aec7b7 (Membro hidratado sem `userMemory`) não se repetiu: `recortarMembro` já trata o campo ausente e a regressão contra o Postgres local passou inteira.

## Known Stubs

Nenhum.

## Threat Flags

Nenhum. O plano só reduz superfície: T-09-35 a T-09-38 e T-09-40 mitigadas e provadas; T-09-39 (Arquivo órfão) provada por HTTP para o Membro B (a repetição com Convidado fica para 09-15). T-09-SC: nenhum pacote instalado.

## User Setup Required

None - no external service configuration required. (Teste local: container `crm-n1-pg-0907`, porta 55607, `postgres:16`; parado e removido ao fim.)

## Next Phase Readiness

- 09-08 ajusta as telas para um `publicShare.secret`/`Form.secret` vazio e para o Convidado sem a IA do Espaço.
- 09-12 reusa `recusaDeSuspenso` nas rotas REST que não passam por `podeNoCrm`, e estende a fábrica com Convidado, Administrador e um segundo Espaço (o Membro `suspenso` e o token já existem).
- 09-15 repete o Arquivo órfão com o Convidado na suíte adversarial.

## Self-Check: PASSED

Os arquivos criados e modificados existem; os cinco commits (`82803f9`, `89dbcef`, `ae10e8a`, `76d7ced`, `d8375d7`) estão no histórico; `grep -c "recortarDiferenca("` e `"recortarValor("` em `operacoes.ts` = 1 cada, `aoTerminar` em `convidar-membro.ts` = 2, `export function recusaDeSuspenso` = 1, `recusaDeSuspenso(request.membro)` = 1, `arquivoOrfao` = 2 e `SEGREDO-LINK-` = 1 na fábrica.

---
*Phase: 09-seguran-a-dos-dados-e-base-de-produ-o*
*Completed: 2026-10-23*
