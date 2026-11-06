---
phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
plan: 04
subsystem: api
tags: [atividade, migracao-012, postgres, crm, so-insercao, tdd, ucr-03]

requires:
  - phase: 14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa
    provides: "contato_notas e POST /contatos/:id/notas (011); comTransacao; molde de repositorio/servico"
  - phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
    provides: "15-01 a 15-03: gesto-no-crm por modulo, divida da Fase 14, sucessao de Conversas"
provides:
  - "012-atividade-do-crm.sql: plataforma.crm_atividades (espelho de ActivityRecord), sem FK para o objeto, checks de ator/delegante/resultado/acao, indices por objeto e por tempo, RLS desligada, sem grant"
  - "@n1/dominio/crm/atividades: ACOES_DO_CRM, TIPOS_DE_OBJETO_DO_CRM, LIMITES_DE_ATIVIDADE, FiltroDeAtividades, validarFiltroDeAtividades"
  - "repositorios/crm/atividades.ts: registrarAtividade (no cliente do gesto) e listar (por tipos permitidos); sem update nem delete"
  - "servicoDeNotas.adicionar grava a Atividade 'Nota registrada no Contato' no mesmo commit da nota, sem o conteudo"
affects: [15-09, 15-15, 15-37]

plan_head_before: 5a9ec815f8ced5a61700478abbef1c177de15ed4
plan_head_after: ee7f1dd775256bf41e61c8f40ee9bb94d43b3c99

actuals:
  tokens: 8500
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Atividade gravada no MESMO PoolClient do comTransacao: o rollback do gesto leva a linha junto"
    - "Tabela de historico so-insercao por contrato do repositorio (sem trigger), sem FK para o objeto"
    - "Falha no meio da migracao provada com event trigger em CREATE INDEX (a 012 nao insere nada para um trigger de linha recusar)"

key-files:
  created:
    - apps/api/migracoes/012-atividade-do-crm.sql
    - apps/api/src/persistencia/migracao-012.test.ts
    - packages/dominio/src/crm/atividades.ts
    - packages/dominio/src/crm/atividades.test.ts
    - apps/api/src/repositorios/crm/atividades.ts
  modified:
    - apps/api/src/servicos/crm/notas.ts
    - apps/api/src/servicos/crm/notas.test.ts
    - apps/api/src/testes/banco-crm.ts
    - apps/api/src/persistencia/CONTEXT.md
    - apps/api/src/persistencia/migracao-011.test.ts

key-decisions:
  - "D-15-09: crm_atividades espelha ActivityRecord 1:1 (candidata 1 da pesquisa); objeto_tipo usa as cadeias do modelo antigo (contact, company, deal, conversation, funnel, channel) sem check de lista no banco: o vocabulario vive no dominio e cresce sem migracao"
  - "Sem FK para o objeto: a Atividade sobrevive a eliminacao (INV-ET-12); guarda objeto_nome"
  - "So insercao e contrato do repositorio, como contato_notas; sem trigger no banco"
  - "O momento (em) e do banco (now()); a entrada de registrarAtividade nao aceita data"
  - "detalhe nunca leva o conteudo da Nota (T-15-14); o ator e o Membro da sessao (T-15-13)"

patterns-established:
  - "registrarAtividade(cliente, workspaceId, entrada) chamado de dentro do comTransacao do gesto"
  - "listar(cliente, workspaceId, filtro, tiposPermitidos): a leitura filtra pelos tipos que o Papel pode ver"

requirements-completed: [UCR-03]

coverage:
  - id: D1
    description: "A 012 cria plataforma.crm_atividades com PK (workspace_id, id), as quatro restricoes com nome, dois indices, sem FK, sem grant, RLS desligada; idempotente e transacional"
    requirement: UCR-03
    verification:
      - kind: integration
        ref: "apps/api/src/persistencia/migracao-012.test.ts (a)-(g)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Vocabulario da Atividade e validarFiltroDeAtividades no dominio"
    requirement: UCR-03
    verification:
      - kind: unit
        ref: "packages/dominio/src/crm/atividades.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Repositorio so com registrarAtividade e listar (sem update nem delete); listar devolve ActivityRecord com data em ISO, filtrado por Espaco e por tipos permitidos"
    requirement: UCR-03
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/notas.test.ts (i)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Tracador: a Nota do Contato grava a Atividade no mesmo commit, sem o conteudo; se o gesto falha depois da Atividade, nenhuma das duas linhas fica"
    requirement: UCR-03
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/notas.test.ts (h), (j), (k)"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-11-06
status: complete
---

# Phase 15 Plan 04: A Atividade do CRM novo (012) Summary

**`plataforma.crm_atividades` (012) como Registro de Atividade so-insercao do CRM novo, com a Nota do Contato gravando a sua Atividade no mesmo commit e o rollback provado.**

## Performance

- **Duration:** 12 min (apos o contexto lido)
- **Tasks:** 2 (1 tracador + 1 auto, ambas TDD)
- **Files:** 5 criados, 5 modificados
- **Commits de producao:** 4 (RED, GREEN, prova da 012, ajuste de teste da 011)

## Accomplishments

- Migracao `012-atividade-do-crm.sql`: tabela espelhando `ActivityRecord` (ator, delegante, acao, tipo/id/nome do objeto, momento, resultado, antes, depois, detalhe), PK `(workspace_id, id)`, `crm_atividades_ator_ck`, `_delegante_ck`, `_resultado_ck`, `_acao_ck`, indices `crm_atividades_objeto_idx` e `crm_atividades_em_idx`, bloco que desliga RLS, sem `grant`, sem FK.
- Dominio `crm/atividades.ts` com as quinze frases de `ACOES_DO_CRM`, os seis `TIPOS_DE_OBJETO_DO_CRM`, `LIMITES_DE_ATIVIDADE` (50 e 200) e `validarFiltroDeAtividades` (objeto inteiro ou nenhum, limite 1..200, data valida).
- Repositorio `repositorios/crm/atividades.ts`: so `registrarAtividade` e `listar`; nenhum caminho de `update` ou `delete`.
- `servicoDeNotas.adicionar` grava "Nota registrada no Contato" com o nome de exibicao do Contato, o ator da sessao e SEM o conteudo da nota.
- `limparEspaco` limpa `crm_atividades` (sem FK, entrou na lista fixa).
- `persistencia/CONTEXT.md` ganhou o paragrafo da 012.

## Task Commits

1. **Task 1 RED:** `686904e` test(15-04): add failing test for Nota gravando Atividade no mesmo commit
2. **Task 1 GREEN:** `b8c6d81` feat(15-04): Nota do Contato grava a Atividade no mesmo commit (012 + repositorio)
3. **Task 2:** `bd01c0a` test(15-04): prova a 012 por inteiro e o vocabulario da Atividade no dominio
4. **Ajuste (Rule 1):** `ee7f1dd` test(15-04): migracao-011 (f) nao presume ser a ultima migracao pendente

## TDD Gate Compliance

- **RED (Task 1):** `notas.test.ts` casos (h), (i), (j), (k) contra um esqueleto de `repositorios/crm/atividades.ts` que so tinha as assinaturas e lancava "nao implementado" (o import estatico do teste precisava do modulo; sem o esqueleto seria falha de carga, nao RED). Os quatro falharam, os sete casos antigos passaram: `Tests 4 failed | 7 passed (11)`. Avaliacao semantica: (h) falhou porque a tabela/Atividade nao existia, (i) e (j) porque o repositorio lancava, (k) porque o servico nao gravava nada que pudesse falhar e a promise resolveu. Cada um falha pelo comportamento planejado (nada registrado), nao por erro de sintaxe ou de fixture. `workflow.tdd_mode` esta `false` e o plano e `type: execute`, entao o classificador `tdd-red-evidence` nao foi exigido nem rodado.
- **GREEN (Task 1):** 012 + dominio + repositorio + servico; `notas.test.ts` 11/11.
- **Task 2:** os testes de `migracao-012` e do dominio passaram de imediato, porque a 012 e o `validarFiltroDeAtividades` nasceram na Task 1 (o tracador e a fatia ponta a ponta). Verde inesperado investigado: nao e teste errado; a Task 2 e a prova por inteiro de codigo ja entregue, e o caso (c) so passa se a interrupcao de fato ocorrer (a tabela some e o registro nao existe).
- Sem commit REFACTOR (nada a limpar).

## Verification

Postgres 16 descartavel `crm-n1-pg-1504` (porta 55704), nunca o `.env`:

- `npm run migrar` aplicou a `012-atividade-do-crm.sql` (12 arquivos aplicados num banco novo).
- `notas.test.ts` 11/11; `migracao-012.test.ts` 6/6 mais o caso do arquivo; `migrar-seco.test.ts`, `migracao-010` e `migracao-011` verdes; dominio `atividades.test.ts` 7/7.
- `tsc --noEmit` em `packages/dominio`, `apps/api` e `apps/web`: 0.
- Varredura `src/rotas src/repositorios src/persistencia`: 843 passam; as 2 falhas sao `outbox-worker.test.ts` (i) e (k), baseline conhecido (casos h-k), fora do escopo.
- Criterios de aceite: `disable row level security` = 1; `foreign key` sem comentarios = 0; `registrarAtividade` em `notas.ts` = 2; `crm_atividades` em `banco-crm.ts` = 1; `update|delete` no repositorio = 0; nenhuma migracao 001-011 editada.
- O container foi parado ao final. A 012 nao foi aplicada em nenhum banco remoto.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `migracao-011.test.ts` (f) quebrava com a 012 presente**
- **Found during:** verificacao final da Task 2 (banco novo)
- **Issue:** o caso presumia que a 011 era a unica migracao pendente (`aplicadas == [011]`); com a 012, `migrar()` aplica as duas.
- **Fix:** confere que a 011 vem primeiro (`[0]`), igual ao que `migracao-010.test.ts` ja fazia.
- **Files modified:** `apps/api/src/persistencia/migracao-011.test.ts`
- **Commit:** `ee7f1dd`

**2. [Estilo de prova] Falha no meio da 012 por event trigger, nao por "copia da 012 com erro no fim"**
- `migrar()` le uma pasta fixa, sem hook para copia. A 012 nao insere linhas, entao um trigger de linha (como na 011) nao tem o que recusar. Um event trigger em `CREATE INDEX` interrompe a 012 depois de criada a tabela, o que prova o mesmo (nem o registro nem a tabela ficam).

**3. [Esqueleto no RED]** O RED incluiu um esqueleto do repositorio (assinaturas que lancam) para o import do teste nao ser falha de carga; ver "TDD Gate Compliance".

**Total deviations:** 1 auto-fixed (Rule 1), 2 ajustes de metodo. **Impact:** nenhum no escopo ou na API entregue.

## Known Stubs

Nenhum. `registrarAtividade` e `listar` sao reais; so a Nota grava Atividade neste plano de proposito (os demais gestos sao do 15-09; a rota `GET /atividades` e o hook da web, do 15-37).

## Threat Flags

Nenhum. T-15-11 (so insercao, sem FK, teste (f)), T-15-13 (ator = `membro` da sessao) e T-15-14 (conteudo fora do `detalhe`, teste (h)) mitigados como planejado.

## Issues Encountered

None.

## Next Phase Readiness

Pronto para 15-05. O 15-09 passa a gravar Atividade nos demais gestos com `registrarAtividade`; o 15-37 le por `listar` e expoe `GET /atividades`. A 012 so vai a producao no corte (D-15-03), pelo dono, seguida de `npm run banco:conceder`.

## Self-Check: PASSED
