---
phase: 14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa
plan: 12
subsystem: api
tags: [dominio, fastify, canais, lista-conversacional, lerDoCrm, zod]

requires:
  - phase: 14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa
    provides: "14-02 canalForaDaListaNasTabelas e as operações da Tarefa conversacional nas tabelas; 14-03 a opção lerDoCrm de executar(); 14-10 o mapa AO_CONFIRMAR em rotas/operacoes.ts"
provides:
  - "validarCanaisDeAtendimento, nomesDosCanais, definirCanaisDaLista e createList com canais?: readonly Canal[] como último argumento"
  - "Mapa LER_DO_CRM em rotas/operacoes.ts: o servidor lê plataforma.canais na transação e troca o canais do navegador"
  - "CANAIS_DO_NAVEGADOR (até 100 itens) nos schemas das duas operações"
affects: [14-15, 14-16, 14-17, fase-15-telas-no-modelo-novo, 3.5.4-remocao-da-projecao-de-canais]

actuals:
  tokens: 10800
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Leitura do CRM por operação genérica: mapa LER_DO_CRM (posição do argumento + leitor) entrega ao domínio o que o servidor leu da tabela e sobrescreve o que veio do navegador"
    - "Schema com tipo de saída do domínio sobre um valor que o servidor sempre troca (cast documentado)"

key-files:
  created:
    - apps/api/src/rotas/operacoes-canais-da-lista.test.ts
  modified:
    - packages/dominio/src/operations/canais.ts
    - packages/dominio/src/operations/canais.test.ts
    - packages/dominio/src/operations/structure.ts
    - packages/dominio/src/operations/tarefas-conversacionais.ts
    - packages/dominio/CONTEXT.md
    - apps/api/src/rotas/operacoes.ts
    - apps/api/src/rotas/esquemas/tarefas-conversacionais.ts
    - apps/api/src/rotas/esquemas/tarefas-conversacionais.test.ts
    - apps/api/src/rotas/esquemas/estrutura.ts
    - apps/api/src/rotas/esquemas/estrutura.test.ts
    - apps/api/src/rotas/CONTEXT.md
    - apps/web/src/features/estrutura/container-settings.tsx
    - apps/web/src/features/estrutura/create-container-dialog.tsx

key-decisions:
  - "Um id que está em canais vale pelo Canal da tabela (estado ativo, tipo de atendimento) e o nome da Atividade vem dele; um id fora de canais cai no ramo antigo de state.channels, o mesmo id, sem tradução (D-01). Esse ramo sai na 3.5.4"
  - "O servidor sobrescreve a posição do canais em args pelo que lerDoCrm leu de plataforma.canais deste Espaço, em qualquer estado; o domínio decide ativo e tipo (T-14-29)"
  - "O schema usa opcional() (aceita null do JSON de um undefined final) em vez de .optional(), e declara a saída como readonly Canal[] por cast, porque o valor nunca chega ao domínio"
  - "As telas passam só os Canais das tabelas que a Lista vai marcar (filtrados por id), não todos os ativos: a execução local só precisa desses, e fica longe do teto de 100 itens do schema"

patterns-established:
  - "LER_DO_CRM: operação do registro que precisa de leitura transacional do CRM declara aqui a posição do argumento e o leitor; rotas/operacoes.ts não ganha ramo novo"

requirements-completed: [UNI-17]

coverage:
  - id: D1
    description: "O domínio confere os Canais da Lista num Canal[] recebido (tabela primeiro, state.channels depois); Canal arquivado, id inexistente e nome na Atividade"
    requirement: "UNI-17"
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/canais.test.ts#Canais da Lista conferidos num Canal[] recebido (3.3.7)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Os schemas aceitam o Canal[] opcional, limitado a 100 itens, e recusam quarto elemento e item sem id"
    requirement: "UNI-17"
    verification:
      - kind: unit
        ref: "apps/api/src/rotas/esquemas/tarefas-conversacionais.test.ts#(d); apps/api/src/rotas/esquemas/estrutura.test.ts#(d)"
        status: pass
    human_judgment: false
  - id: D3
    description: "POST /operacoes lê plataforma.canais na transação: Canal da tabela marcado com a projeção desligada, id inexistente recusado, canais forjado descartado, Canal arquivado e de outro Espaço recusados, 400 acima de 100 itens"
    requirement: "UNI-17"
    verification:
      - kind: integration
        ref: "apps/api/src/rotas/operacoes-canais-da-lista.test.ts (7 casos, Postgres 16 migrado até a 011)"
        status: pass
    human_judgment: false
  - id: D4
    description: "As duas telas da Lista passam os Canais das tabelas na execução local"
    requirement: "UNI-17"
    verification:
      - kind: command
        ref: "cd apps/web && npx tsc --noEmit && npx vitest run (99 arquivos, 968 testes)"
        status: pass
    human_judgment: true
    rationale: "Nenhum teste de tela exercita o seletor de Canais com a api real; a execução local só importa para a otimista e o servidor decide de qualquer jeito."

duration: 7min
completed: 2026-11-04
status: complete
plan_head_before: fc78341aa6333f7439053b7c42575c6220707118
plan_head_after: 7ac3627bbc3551024ddca35c77484f14d6a8e8cd
commits: 5
---

# Phase 14 Plan 12: Canais da Lista conversacional conferidos na tabela Summary

**`definirCanaisDaLista` e `createList` conferem os Canais de atendimento em `plataforma.canais` dentro da transação (mapa `LER_DO_CRM` sobre `lerDoCrm`), sem depender da projeção e sem confiar no `canais` que o navegador manda.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-11-04T19:11:00Z (aprox.)
- **Completed:** 2026-11-04T19:18:00Z
- **Tasks:** 3 (as duas primeiras TDD: RED e GREEN; a terceira só de tela)
- **Files modified:** 14 (1 criado, 13 alterados)

## Accomplishments

- Domínio: as quatro funções aceitam `canais?: readonly Canal[]`. Um Canal da tabela vale sem `state.channels`; o do seed antigo segue valendo pelo mesmo id (a 3.5.4 remove esse ramo). O nome da Atividade vem da tabela primeiro.
- Api: `LER_DO_CRM` em `rotas/operacoes.ts` entrega ao domínio o que `criarRepositorioDeCanaisPg(cliente).todos(workspaceId)` leu na transação e SOBRESCREVE a posição do `canais` (índice 2 de `definirCanaisDaLista`, índice 1 de `createList`). Um `canais` forjado, um Canal arquivado e o de outro Espaço são recusados; mais de 100 itens é 400.
- Prova com a projeção desligada: `operacoes-canais-da-lista.test.ts` mocka `carregarCanaisProjetados` para `[]` e roda contra um Postgres 16 migrado até a 011 (7 casos, nenhum pulado).
- Web: `container-settings.tsx` (duas chamadas) e `create-container-dialog.tsx` passam como último argumento os Canais ativos de `useCanais` que a Lista vai marcar.

## Task Commits

1. **Task 1: o domínio confere os Canais num Canal[] recebido** - `ba3dbbc` (test, RED: 3 casos falham, 17 já passam) → `77f5b29` (feat, GREEN)
2. **Task 2: POST /operacoes lê plataforma.canais na transação** - `42960df` (test, RED: 5 de 7 falham, os 2 verdes são o 400 de 101 itens e o caso do seed antigo; mais 2 casos de schema) → `d930387` (feat, GREEN)
3. **Task 3: as telas passam os Canais de useCanais** - `7ac3627` (feat)

Nenhum commit de refactor (nada a limpar).

## TDD Gate Compliance

RED e GREEN presentes nas Tasks 1 e 2. Os REDs falharam nas asserções planejadas (Canal da tabela não marcado, nome da Atividade, schema recusando o terceiro argumento), não por erro de sintaxe ou de carga. O plano não é `type: tdd` e `workflow.tdd_mode` não foi sinalizado: não rodei `gsd_run check tdd-red-evidence`; a avaliação semântica foi manual.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Schema com `opcional()` e saída tipada como `readonly Canal[]`**
- **Found during:** Task 2
- **Issue:** o plano mandava `CANAIS_DO_NAVEGADOR.optional()` com saída `{ id: string; ... }[]`; o `tsc` recusou porque `ESQUEMAS satisfies EsquemasCompletos` exige que a saída do schema seja a do domínio (`readonly Canal[]`). E o fragmento do projeto para parâmetro posicional final é `opcional()` (aceita o `null` que o `JSON.stringify` faz de um `undefined` final).
- **Fix:** `CANAIS_DO_NAVEGADOR` declarado por cast como `z.ZodType<readonly Canal[]>` (comentado: o valor nunca chega ao domínio, a rota o sobrescreve) e usado dentro de `opcional(...)`.
- **Files modified:** apps/api/src/rotas/esquemas/tarefas-conversacionais.ts, estrutura.ts
- **Commit:** d930387

**2. [Plano, interpretação] As telas passam os Canais que a Lista vai marcar, não todos os ativos**
- **Found during:** Task 3
- **Issue:** o plano diz "os Canais ativos de `useCanais`"; passar todos pode estourar o `.max(100)` do schema (a api devolve até 200 por página) e pesa o corpo da gravação à toa.
- **Fix:** `useCanais({ estado: "ativo", limite: 100 })` (pausado fora de uma Lista conversacional) e filtro pelos ids que a chamada marca. A execução local só precisa desses.
- **Files modified:** apps/web/src/features/estrutura/container-settings.tsx, create-container-dialog.tsx
- **Commit:** 7ac3627

**Total deviations:** 2 (1 Rule 3, 1 de interpretação do plano). **Impact:** nenhum no contrato; o servidor descarta o argumento de qualquer jeito.

## Issues Encountered

Nenhum. Nenhuma falha pré-existente apareceu nas suítes que rodei.

## Verification

- `packages/dominio`: `npx vitest run` inteiro (119 arquivos, 2321 testes, inclui `sem-listas-espelho.test.ts`) e `tsc --noEmit` verdes.
- `apps/api`, com Postgres 16 descartável migrado até a 011 (`crm-n1-pg-1412`, porta 55612; removido ao fim): `src/persistencia` inteiro (20 arquivos, 181 testes) e, em lote separado, `operacoes-canais-da-lista.test.ts` + `operacoes.test.ts` + `estado.test.ts` (59 testes), nenhum pulado. O baseline intermitente do `outbox-worker` não apareceu.
- `apps/api` sem banco (`DATABASE_URL=` vazio): 131 arquivos passam, 44 pulados (os que exigem banco); `tsc --noEmit` verde. Isso inclui a guarda D-06 de `apps/api/src/sem-listas-espelho.test.ts`.
- `apps/web`: `tsc --noEmit`, `vitest run` inteiro (99 arquivos, 968 testes), `eslint` nos dois arquivos tocados e `verificar:tokens` verdes.
- Não rodei `npm run check` inteiro nem o `verificar:contratos` completo (o repositório irmão `financeiro-tria` não existe nesta máquina: o script pula sozinho).

## Known Stubs

Nenhum.

## Threat Flags

Nenhum. T-14-29 (canais forjado) e T-14-30 (canais gigante) mitigados e provados.

## Next Phase Readiness

- Quem tira a projeção de `state.channels` (3.5.4) remove o ramo `state.channels` em `validarCanaisDeAtendimento` e em `nomesDosCanais`, e os `Canal[]` das telas deixam de ser opcionais.
- Em aberto, fora deste plano: `instantiateListTemplate` (Template de Lista com configuração) chama `createList` por dentro sem `canais`, então uma Lista conversacional instanciada de Template só aceita Canal que esteja em `state.channels`. Hoje isso funciona (a projeção segue ligada); precisa de `canais` quando a projeção sair.
- `definirCanaisDaLista` e `createList` pagam uma ida a mais ao banco (a leitura de `plataforma.canais`); gestos raros, aceito.

## Self-Check: PASSED

Arquivos criados e commits conferidos: `apps/api/src/rotas/operacoes-canais-da-lista.test.ts` existe; `ba3dbbc`, `77f5b29`, `42960df`, `d930387` e `7ac3627` são ancestrais de HEAD.
