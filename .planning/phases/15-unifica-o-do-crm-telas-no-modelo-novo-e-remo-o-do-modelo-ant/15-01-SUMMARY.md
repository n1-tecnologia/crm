---
phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
plan: 01
subsystem: api
tags: [fastify, postgres, gesto-misto, canais, templates, vitest]

requires:
  - phase: 14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa
    provides: "LER_DO_CRM/AO_CONFIRMAR em rotas/operacoes.ts, lerDoCrm/aoConfirmar em executar(), plataforma.canais"
provides:
  - "instantiateListTemplate(state, membro, templateId, input, canais?) confere os Canais de atendimento pelos Canais lidos de plataforma.canais"
  - "apps/api/src/rotas/gesto-no-crm/: LidoDoCrm, LeituraDoCrm, AoConfirmarNoCrm e as tabelas LER_DO_CRM/AO_CONFIRMAR compostas por módulo"
  - "aoConfirmar recebe o lido como 5º argumento"
  - "operacoes.test.ts só abre banco local (describeComBanco)"
affects: [15-02, 15-03, 15-07, 15-08, 15-17, 15-19, 3.5.4 desligamento da projeção dos Canais]

actuals:
  tokens: 28000
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Tabela de gesto misto por módulo (um arquivo por plano), composta em index.ts, que lança na carga se um nome de operação se repete"
    - "LeituraDoCrm = { posicao, ler(cliente, workspaceId, args, state), argumento(lido) }: o servidor sobrescreve sempre a posição dos args"

key-files:
  created:
    - packages/dominio/src/operations/instanciar-template-com-canais.test.ts
    - apps/api/src/rotas/gesto-no-crm/tipos.ts
    - apps/api/src/rotas/gesto-no-crm/index.ts
    - apps/api/src/rotas/gesto-no-crm/estrutura.ts
    - apps/api/src/rotas/gesto-no-crm/membros.ts
    - apps/api/src/rotas/gesto-no-crm/ferramentas.ts
    - apps/api/src/rotas/gesto-no-crm/ia.ts
    - apps/api/src/rotas/gesto-no-crm/financeiro.ts
  modified:
    - packages/dominio/src/operations/planning.ts
    - apps/api/src/rotas/esquemas/planejamento.ts
    - apps/api/src/rotas/esquemas/planejamento.test.ts
    - apps/api/src/rotas/operacoes.ts
    - apps/api/src/rotas/operacoes-canais-da-lista.test.ts
    - apps/api/src/rotas/operacoes.test.ts

key-decisions:
  - "LeituraDoCrm ganha o campo argumento(lido) porque createList e definirCanaisDaLista esperam Canal[] na posição e as Ferramentas vão esperar o objeto inteiro"
  - "Tabelas de Ferramentas, IA e Financeiro nascem vazias, cada uma no arquivo do próprio plano, para os planos paralelos não disputarem arquivo"
  - "AO_CONFIRMAR só migrou para gesto-no-crm no Task 2 (removeMember em membros.ts), para o commit do traçador compilar e não mexer no comportamento da sucessão"

requirements-completed: [UCR-01]

coverage:
  - id: D1
    description: "instantiateListTemplate confere os Canais de atendimento por plataforma.canais (Canal só na tabela instancia a Lista; canais forjado é descartado; id inexistente é recusado)"
    requirement: UCR-01
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/instanciar-template-com-canais.test.ts"
        status: pass
      - kind: integration
        ref: "apps/api/src/rotas/operacoes-canais-da-lista.test.ts#instantiateListTemplate (Fase 15, D-15-07)"
        status: pass
    human_judgment: false
  - id: D2
    description: "LER_DO_CRM e AO_CONFIRMAR compostos por módulo em rotas/gesto-no-crm, com nome repetido lançando na carga"
    requirement: UCR-01
    verification:
      - kind: integration
        ref: "apps/api/src/rotas/operacoes.test.ts (removeMember, gesto misto da sucessão) e src/rotas + src/seguranca (67 arquivos)"
        status: pass
    human_judgment: false
  - id: D3
    description: "operacoes.test.ts não abre banco nenhum quando DATABASE_URL não é local"
    requirement: UCR-01
    verification:
      - kind: other
        ref: "env -u DATABASE_URL -u DATABASE_URL_MIGRACAO npx vitest run src/rotas/operacoes.test.ts -> 17 passed, 26 skipped"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-11-06
status: complete
plan_head_before: b0a240e39ef268cd16de013a67618ac4f4c86fd2
plan_head_after: 5cf503028270b2e1614dc56f5add291ab4f1e035
commits: 4
---

# Phase 15 Plan 01: Gesto misto por módulo e Template de Lista com Canais da tabela Summary

**`instantiateListTemplate` confere os Canais de atendimento em `plataforma.canais` (5º parâmetro `canais`, `LER_DO_CRM` posição 2) e `LER_DO_CRM`/`AO_CONFIRMAR` passam a viver em `apps/api/src/rotas/gesto-no-crm/`, um arquivo por módulo.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-11-06T08:21:00Z (aprox.)
- **Completed:** 2026-11-06T08:30:00Z (aprox.)
- **Tasks:** 3
- **Files modified:** 14 (8 criados, 6 alterados)

## Accomplishments

- Um Template de Lista com `listConfig` instancia a Lista conversacional com um Canal que só existe em `plataforma.canais` (`state.channels` vazio); o `canais` do navegador é descartado e um id inexistente, arquivado ou de outro Espaço é recusado. Pronto para a 3.5.4 desligar a projeção dos Canais.
- `LER_DO_CRM` e `AO_CONFIRMAR` saíram de `rotas/operacoes.ts` para `gesto-no-crm/` (`tipos`, `index`, `estrutura`, `membros`, `ferramentas`, `ia`, `financeiro`); `index.ts` compõe as tabelas e lança na carga do módulo se um nome de operação repete. Os planos 15-07, 15-08, 15-17 e 15-19 só mexem no arquivo do próprio módulo.
- A leitura devolve `LidoDoCrm` e cada entrada diz, por `argumento(lido)`, o que ocupa a posição dos `args`; `aoConfirmar` recebe o `lido` como 5º argumento.
- `operacoes.test.ts` perdeu `carregarEnv()`, `temBanco` e o alias `d`: o bloco com banco é `describeComBanco`. Sem `DATABASE_URL` local o arquivo roda 17 e pula 26.

## TDD

- **RED** (`d79b2e3`): `instanciar-template-com-canais.test.ts`, 4 casos. Relatório TAP (`tap-flat`) com `exit 1`: os casos 1 (instancia com Canal só em `canais`) e 4 (duas instanciações) falham exatamente na asserção planejada (`Canal não encontrado ou arquivado.`, esperado `ok: true`); os casos 2 e 3 (recusas) já passavam e ficam como guarda contra regressão. Avaliação semântica: o alvo executou, falhou pelo motivo previsto (o parâmetro `canais` não chegava a `createList`), sem erro de importação nem de fixture. `workflow.tdd_mode` está `false` e o plano é `type: execute`, então o classificador `check tdd-red-evidence` não foi exigido.
- **GREEN** (`d0ab7f8`): `instantiateListTemplate` repassa `canais` a `createList`; 4/4 passam. Os casos de rota (Docker) foram vistos falhando antes do esquema/ligação (3 de 5) e passam depois.
- **REFACTOR:** nenhum.

## Task Commits

1. **Task 1 (traçador): Template instanciado com Canal só em `plataforma.canais`** — `d79b2e3` (test, RED) e `d0ab7f8` (feat, GREEN)
2. **Task 2: Módulos vazios das Ferramentas, da IA e do Financeiro; `removeMember` em `membros.ts`** — `c2a4e41` (feat)
3. **Task 3: `operacoes.test.ts` só abre banco local** — `5cf5030` (test)

**Plan metadata:** commit `docs(15-01)` seguinte (SUMMARY, STATE, ROADMAP).

Gate do traçador: modo `end-of-phase`, `<verify>` só automatizado, então foi reexecutado ponta a ponta (domínio 4/4; rota 12/12 em `operacoes-canais-da-lista.test.ts`, 3/3 em `planejamento.test.ts`) e passou — expansão liberada.

## Files Created/Modified

- `packages/dominio/src/operations/planning.ts` - `instantiateListTemplate(..., canais?)` repassa `canais` a `createList`
- `packages/dominio/src/operations/instanciar-template-com-canais.test.ts` - prova de domínio com `state.channels` vazio
- `apps/api/src/rotas/esquemas/planejamento.ts` - `instantiateListTemplate` ganha o 3º elemento `opcional(CANAIS_DO_NAVEGADOR)`
- `apps/api/src/rotas/esquemas/planejamento.test.ts` - forma literal com `canais` passa
- `apps/api/src/rotas/gesto-no-crm/tipos.ts` - `LidoDoCrm`, `ContatoResumido`, `EmpresaResumida`, `ContatoACriar`, `LeituraDoCrm`, `AoConfirmarNoCrm`, `TabelaDeLeituras`, `TabelaDeConfirmacoes`
- `apps/api/src/rotas/gesto-no-crm/index.ts` - `compor` + `LER_DO_CRM` + `AO_CONFIRMAR`
- `apps/api/src/rotas/gesto-no-crm/estrutura.ts` - `definirCanaisDaLista` (2), `createList` (1), `instantiateListTemplate` (2)
- `apps/api/src/rotas/gesto-no-crm/membros.ts` - `removeMember` movido sem mudar comportamento
- `apps/api/src/rotas/gesto-no-crm/{ferramentas,ia,financeiro}.ts` - tabelas vazias, uma por plano futuro
- `apps/api/src/rotas/operacoes.ts` - importa de `./gesto-no-crm`; `lerDoCrm(cliente, state)` com `args`; posição trocada por `argumento(lido)`; `lido` como 5º argumento de `aoConfirmar`
- `apps/api/src/rotas/operacoes-canais-da-lista.test.ts` - 5 casos de `instantiateListTemplate` (Canal só na tabela, id inexistente, forjado/arquivado/de outro Espaço, duas instanciações, 101 itens = 400)
- `apps/api/src/rotas/operacoes.test.ts` - `describeComBanco`, sem `.env`

## Decisions Made

- `argumento(lido)` em `LeituraDoCrm`, como no plano (reversível, interno da api).
- `AO_CONFIRMAR` migrou no Task 2 e não no 1, para que cada commit compile e a sucessão de `removeMember` nunca fique sem tabela.
- Os demais avisos da revisão da Fase 14 (WR-03, WR-04, WR-07, WR-08, WR-09, IN-01 a IN-05) seguem abertos, como D-15-07 manda.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `TEMPLATES` do seed é um array de módulo compartilhado entre `buildSeed()`s**
- **Found during:** Task 1 (RED)
- **Issue:** salvar um Template em um teste vazava para o seguinte (`Já existe um Template de Lista ...`), derrubando os casos por motivo alheio ao alvo.
- **Fix:** o teste copia `state.templates = [...state.templates]` depois de `buildSeed()`. O seed não foi tocado (fora de escopo).
- **Files modified:** `packages/dominio/src/operations/instanciar-template-com-canais.test.ts`
- **Committed in:** `d79b2e3`

**2. [Escopo menor] Caso extra em `esquemas/planejamento.test.ts`**
- Acrescentei a forma literal com o 3º elemento (`canais`) à rede de regressão do esquema; o arquivo não estava em `files_modified`, mas é o teste natural da mudança de esquema.
- **Committed in:** `d0ab7f8`

---

**Total deviations:** 1 auto-fixed (1 Rule 3), 1 ajuste de escopo mínimo
**Impact on plan:** nenhum desvio de comportamento nem de arquitetura.

## Issues Encountered

- `timeout` do GNU não existe no macOS; duas rodadas amplas voltaram vazias até serem refeitas sem ele. Sem efeito no código.
- `apps/api` e `packages/dominio` não têm ESLint (o `lint` do monorepo só roda no web); a checagem foi `tsc --noEmit` nos três workspaces, todos com saída 0.

## Verificação

- `packages/dominio`: `vitest run` completo, 121 arquivos / 2326 testes passando; `tsc --noEmit` 0.
- `apps/api` (Postgres 16 local em `localhost:55701`, as duas URLs explícitas, 001–011 aplicadas): `src/rotas` + `src/seguranca` = 67 arquivos / 757 passando (2 expected fail e 1 skipped já existentes); `tsc --noEmit` 0. `operacoes.test.ts` 43/43 com banco local; sem `DATABASE_URL`, 17 passam e 26 são puladas, sem `ECONNREFUSED`.
- `apps/web`: `tsc --noEmit` 0.
- Container `crm-n1-pg-1501` parado. Nenhum comando tocou o banco do `.env`, a produção, a VM nem a `main` do `n1-tecnologia/crm`.

## Known Stubs

`gesto-no-crm/{ferramentas,ia,financeiro}.ts` exportam tabelas vazias de propósito (`{}`): são o ponto de entrada dos planos 15-07/15-17 (Ferramentas), 15-08 (IA) e 15-19 (Contas a receber). Não impedem o objetivo deste plano.

## Threat Flags

Nenhuma superfície nova além do `threat_model` do plano (T-15-01 mitigado: a posição é sempre sobrescrita pelo lido do servidor, com teste de `canais` forjado recusado; T-15-02: `describeComBanco`; T-15-03: nome repetido lança na carga).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Pronto para o 15-02. Os planos de Ferramentas, IA e Contas a receber encontram `LeituraDoCrm`/`AoConfirmarNoCrm` e os arquivos de módulo prontos.

## Self-Check: PASSED
