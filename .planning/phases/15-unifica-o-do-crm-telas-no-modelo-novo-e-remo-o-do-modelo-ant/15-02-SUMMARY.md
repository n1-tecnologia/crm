---
phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
plan: 02
subsystem: api
tags: [postgres, concorrencia, for-update, deadlock, mesclagem, canais, vitest]

requires:
  - phase: 14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa
    provides: "Contato mesclado (RN-CON-14), gesto misto com a trava do Espaço primeiro, resumo em lote da Tarefa conversacional"
  - phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
    provides: "15-01: gesto-no-crm por módulo (não tocado aqui)"
provides:
  - "comTransacao traduz 40P01 em 409 CONFLITO_TRANSITORIO (frase fixa, sem constraint)"
  - "abrirConversaNoCliente, conferirContato (Negócio) e carregarContato (Empresa) leem o Contato com for update e recusam CONTATO_MESCLADO"
  - "REST de Canal (escrita) trava plataforma.workspaces antes de plataforma.canais"
  - "resumoDasTarefas oculta Contato na lixeira e Conversa na lixeira (Canal e última Mensagem nulos)"
  - "excluirPermanentemente do sobrevivente de uma mesclagem: 409 CONTATO_COM_MESCLADOS; contatos_mesclado_em_fk traduzida"
  - "apps/api/src/testes/duas-conexoes.ts: molde de dois clientes (abrirTransacaoDeA, mesclarSemConfirmar, comMesclagemNoMeio, aindaPendenteApos)"
affects: [15-11, 15-12, 15-13]

actuals:
  tokens: 8400
  tasks: 3
  commits: 7

tech-stack:
  added: []
  patterns:
    - "Prova de ordem de trava com dois clientes: A segura a trava, B (o serviço) é medido ainda pendente, e um terceiro cliente confere com for update nowait"
    - "40P01 é traduzido em um ponto só (comTransacao), não reordenando travas caso a caso"

key-files:
  created:
    - apps/api/src/testes/duas-conexoes.ts
  modified:
    - apps/api/src/servicos/crm/transacao.ts
    - apps/api/src/servicos/crm/transacao.test.ts
    - apps/api/src/servicos/crm/conversas.ts
    - apps/api/src/servicos/crm/conversas.test.ts
    - apps/api/src/servicos/crm/negocios.ts
    - apps/api/src/servicos/crm/negocios.test.ts
    - apps/api/src/servicos/crm/empresas.ts
    - apps/api/src/servicos/crm/empresas.test.ts
    - apps/api/src/servicos/crm/canais.ts
    - apps/api/src/servicos/crm/canais.test.ts
    - apps/api/src/servicos/crm/contatos.ts
    - apps/api/src/servicos/crm/contatos.test.ts
    - apps/api/src/repositorios/crm/tarefas-conversacionais.ts
    - apps/api/src/servicos/crm/tarefas-conversacionais.test.ts
    - apps/api/src/servicos/CONTEXT.md

key-decisions:
  - "40P01 vira 409 transitório em comTransacao e a ordem inversa de Negócio.editar (Negócio, depois Contato) não é reordenada; o teste aceita CONTATO_MESCLADO ou CONFLITO_TRANSITORIO"
  - "WR-05 mantém o primeiro Vínculo de cada tipo como o usado no resumo; mudar para lista de candidatos muda VinculoParaResumo e fica aberto"
  - "conferirContato e carregarContato ganham { travar = true } como 4º parâmetro; todas as chamadas atuais usam o padrão"

requirements-completed: [UCR-01]

coverage:
  - id: D1
    description: "40P01 traduzido em 409 CONFLITO_TRANSITORIO por comTransacao, sem nome de constraint"
    requirement: UCR-01
    verification:
      - kind: unit
        ref: "apps/api/src/servicos/crm/transacao.test.ts#40P01 (deadlock) vira 409 transitório"
        status: pass
    human_judgment: false
  - id: D2
    description: "WR-01: abrir Conversa, criar/editar Negócio e vincular Contato a Empresa travam o Contato e recusam um mesclado no meio, sem deixar linha"
    requirement: UCR-01
    verification:
      - kind: integration
        ref: "conversas.test.ts#WR-01; negocios.test.ts#(j); empresas.test.ts#(k)"
        status: pass
    human_judgment: false
  - id: D3
    description: "WR-02: o REST de Canal espera o Espaço antes de travar o Canal (for update nowait de um terceiro cliente passa enquanto ele espera)"
    requirement: UCR-01
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/canais.test.ts#ordem de travas com o gesto misto (WR-02)"
        status: pass
    human_judgment: false
  - id: D4
    description: "WR-05: resumo sem Contato na lixeira e sem Canal/última Mensagem de Conversa na lixeira; Contato arquivado continua aparecendo"
    requirement: UCR-01
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/tarefas-conversacionais.test.ts#WR-05"
        status: pass
    human_judgment: false
  - id: D5
    description: "WR-06 e idempotência: excluir de vez o sobrevivente é 409 CONTATO_COM_MESCLADOS nas duas tentativas e a linha não muda"
    requirement: UCR-01
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/contatos.test.ts#(k) WR-06"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-11-06
status: complete
plan_head_before: db72421e0baef8fbc72b2776f3b0369befccbb5f
plan_head_after: 62b0dd7921c89e65601ad93f6704dac3993de0ba
commits: 7
---

# Phase 15 Plan 02: Dívida da Fase 14 (WR-01, WR-02, WR-05, WR-06 e 40P01) Summary

**`comTransacao` traduz deadlock (`40P01`) em 409 transitório, as três portas de escrita que referenciam Contato o leem com `for update`, o REST de Canal trava o Espaço antes do Canal, o resumo da Tarefa respeita a lixeira e excluir de vez o sobrevivente de uma mesclagem deixa de ser 500.**

## Performance

- **Duration:** 9 min (08:31Z a 08:40Z)
- **Tasks:** 3
- **Files:** 16 (1 criado, 15 alterados)

## Accomplishments

- `40P01` nunca mais chega ao `setErrorHandler` como 500 nos serviços do CRM: 409 `CONFLITO_TRANSITORIO` com a frase "Outra gravação mexeu nos mesmos registros ao mesmo tempo. Tente de novo.".
- WR-01 fechado nas três portas: `abrirConversaNoCliente`, `conferirContato` (criar e editar Negócio) e `carregarContato` (as quatro chamadas de `empresas.ts`). Com uma mesclagem em curso, o gesto espera, enxerga `mesclado` e volta 409 `CONTATO_MESCLADO` sem deixar Conversa, Mensagem, Negócio ou `contato_empresa`.
- WR-02 fechado: toda escrita de Canal por REST faz `select 1 from plataforma.workspaces ... for update` antes de carregar o Canal. A prova usa três clientes: A segura o Espaço, B (`simularConexao`) fica pendente, e D consegue `for update nowait` no Canal enquanto B espera.
- WR-05: `resumoDasTarefas` ganha `ef.estado <> 'na_lixeira'` e `cv.estado = 'ativo'`.
- WR-06: `excluirPermanentemente` pré-checa quem tem `mesclado_em_id` igual ao alvo e recusa 409 `CONTATO_COM_MESCLADOS`; `contatos_mesclado_em_fk` está em `FRASES_DE_CONTATOS` como rede.

## TDD

- **RED** (3 commits `test(15-02)`: `5493403`, `db6677d`, `c6fef32`). Em cada rodada o alvo executou e falhou na asserção planejada, sem erro de importação nem de fixture: `40P01` devolvia `undefined`; abrir Conversa, criar Negócio e vincular Contato devolviam sucesso em vez de 409 (`esperava recusa, veio sucesso`); o `for update nowait` do Canal falhava com `could not obtain lock on row in relation "canais"` (B segurava o Canal enquanto esperava o Espaço); o `delete` do sobrevivente estourava `contatos_mesclado_em_fk` (o 500); o resumo devolvia `canal` preenchido para Conversa na lixeira. `workflow.tdd_mode` está desligado e o plano é `type: execute`, então `check tdd-red-evidence` não foi exigido; a avaliação semântica é a descrita aqui.
- **GREEN** (3 commits `feat(15-02)`: `953cfcc`, `d2a1845`, `9b35402`). Tudo passa; REFACTOR: nenhum.
- Um commit `docs(15-02)` (`62b0dd7`) atualiza `servicos/CONTEXT.md`.

Gate do traçador (Task 1): modo `end-of-phase`, `<verify>` só automatizado; reexecutado ponta a ponta (`transacao.test.ts`, `conversas.test.ts`, `src/rotas/crm`, 353 passam) antes de expandir.

## Task Commits

1. **Task 1 (traçador):** `5493403` (test), `953cfcc` (feat)
2. **Task 2:** `db6677d` (test), `d2a1845` (feat)
3. **Task 3:** `c6fef32` (test), `9b35402` (feat)
4. **Docs:** `62b0dd7`

## Decisions Made

- **40P01 em um ponto só.** `Negócio.editar` trava o Negócio e depois o Contato (ordem inversa da mesclagem). Em vez de reordenar, `comTransacao` devolve 409 transitório. O teste de edição aceita `CONTATO_MESCLADO` ou `CONFLITO_TRANSITORIO` e confere que a linha do Negócio não mudou. Rating: reversible.
- **WR-05, primeiro Vínculo.** O resumo continua usando o primeiro Vínculo de cada tipo (Contato, Conversa, Negócio). Trocar por "lista de candidatos, o primeiro que não está na lixeira" muda `VinculoParaResumo` e ficou aberto.
- **Conversa só tem dois estados.** `conversas_estado_ck` aceita `ativo` e `na_lixeira` (e `na_lixeira` exige `resolvida`), então "Conversa que não esteja `ativo`" é "Conversa na lixeira". Contato `arquivado` e Conversa `resolvida` e ativa continuam aparecendo, como a regra RN-TAR-15 pede.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `abrirConversaNoCliente` devolvia `CONTATO_INATIVO` para Contato mesclado**
- **Found during:** Task 1 (leitura do código antes do RED)
- **Issue:** o plano diz que o estado `mesclado` "dá a recusa `CONTATO_MESCLADO` que o serviço usa hoje", mas o serviço só tinha o `CONTATO_INATIVO` genérico para todo estado diferente de `ativo`. A truth do plano exige `CONTATO_MESCLADO`.
- **Fix:** ramo próprio para `mesclado` antes do genérico, com a frase de `contatos.ts` ("Este Contato foi mesclado e agora é somente leitura. Abra o Contato que ficou.") e `campo: "contatoId"`. `arquivado` e `na_lixeira` seguem em `CONTATO_INATIVO`.
- **Files modified:** `apps/api/src/servicos/crm/conversas.ts`
- **Commit:** `953cfcc`

**2. [Escopo menor] Auxiliar de teste novo**
- O molde de dois clientes foi para `apps/api/src/testes/duas-conexoes.ts` (novo, fora de `files_modified`) para os cinco testes de concorrência não repetirem o código. Só abre `poolDoDono()`, que já recusa host remoto.
- **Commits:** `5493403`, `db6677d`

**3. [Escopo menor] Contexto da camada**
- `apps/api/src/servicos/CONTEXT.md` ganhou três parágrafos curtos (`40P01`, `for update` do Contato, ordem de travas do Canal), porque as regras da camada moram ali.
- **Commit:** `62b0dd7`

---

**Total deviations:** 1 auto-fixed (1 Rule 1), 2 ajustes de escopo mínimo
**Impact on plan:** nenhum desvio de arquitetura; a assinatura final de `conferirContato`/`carregarContato` é `{ travar = true }` como 4º parâmetro (o plano escrevia `membro` no lugar de `workspaceId`; o código real já usa `workspaceId`).

## Issues Encountered

- Nenhum flake apareceu: os cinco arquivos de concorrência (82 testes) rodaram três vezes seguidas verdes. Os flakes conhecidos de baseline (`outbox-worker`, `colunas-geradas`, `lote-contas-a-pagar (d)`) não foram exercitados: a rodada ampla foi `src/servicos src/repositorios src/rotas src/persistencia`.

## Verificação

Postgres 16 local em `localhost:55702` (`crm-n1-pg-1502`), 001–011 aplicadas, as duas URLs explícitas em todo comando. Nenhum comando abriu o `.env`, e o container `crm-n1-pg-13` não foi tocado.

- `transacao.test.ts` + `conversas.test.ts` + `src/rotas/crm`: 14 arquivos, 353 passam.
- `negocios.test.ts` + `empresas.test.ts` + `canais.test.ts`: 44 passam (3 RED antes).
- `tarefas-conversacionais.test.ts` + `contatos.test.ts` + `rotas/crm/contatos.test.ts`: 122 passam.
- `src/servicos src/repositorios src/rotas src/persistencia`: 98 arquivos, 1133 passam, 1 skipped já existente.
- `cd apps/api && npx tsc --noEmit`: 0.
- Critérios de aceite: `40P01` e `CONFLITO_TRANSITORIO` em `transacao.ts`; `travar: true` em `conversas.ts`; `travar` 3x em `negocios.ts` e `empresas.ts`; `plataforma.workspaces` em `canais.ts`; `na_lixeira` 2x no repositório do resumo; `CONTATO_COM_MESCLADOS` 2x em `contatos.ts`.
- Container `crm-n1-pg-1502` parado.

## Known Stubs

None.

## Threat Flags

Nenhuma superfície nova além do `threat_model` do plano. T-15-04 (`for update` nas três portas), T-15-05 (Espaço antes do Canal e `40P01` → 409), T-15-06 (frase fixa, sem nome de constraint) e T-15-07 (filtros no resumo) estão mitigados e provados em teste.

## Itens que seguem abertos (D-15-07)

WR-03, WR-04, WR-07, WR-08, WR-09 e IN-01 a IN-05 da revisão da Fase 14.

## Next Phase Readiness

Pronto para os planos seguintes da onda. As telas de 15-11 a 15-13 encontram as portas de escrita do CRM sem o 500 raro de concorrência.

## Self-Check: PASSED
