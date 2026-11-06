---
phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
plan: 03
subsystem: api
tags: [sucessao, ontologia, postgres, conversas, rn-et-09, rn-cxe-24, tdd]

requires:
  - phase: 14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa
    provides: "passarAoSucessor no gesto misto de removeMember; GET /membros/:id/sucessao-no-crm"
  - phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
    provides: "15-01: gesto-no-crm por módulo (membros.ts); 15-02: dívida da Fase 14"
provides:
  - "B28-a em DECISOES-E-PENDENCIAS.md: as Conversas do Membro removido passam ao Sucessor como Atribuído (emenda B28, RN-ET-09 e RN-CXE-24)"
  - "SucessaoNoCrm no domínio (@n1/dominio/crm/sucessao) com conversasPassadas"
  - "passarAoSucessor grava atribuido_id = Sucessor mantendo atribuido_tipo = membro; Conversa de Agente não muda; replay não duplica"
  - "GET /membros/:id/sucessao-no-crm devolve conversasPassadas (sem conversasLiberadas)"
affects: [15-04, 15-09, 15-36]

actuals:
  tokens: 19500
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Regra-chave do contrato emendada e commitada ANTES do código (commit docs separado, depois RED, depois GREEN)"
    - "Tipo da resposta da rota no domínio (@n1/dominio/crm/sucessao); o repositório o reexporta para quem já importava dele"

key-files:
  created:
    - packages/dominio/src/crm/sucessao.ts
  modified:
    - ontologia/01-espaco-de-trabalho/espaco-de-trabalho.md
    - ontologia/03-crm/caixa-de-entrada-e-mensageria.md
    - ontologia/03-crm/crm-visao-geral.md
    - ontologia/04-ia/chat.md
    - ontologia/GLOSSARIO.md
    - ontologia/MATRIZ-DE-RELACOES.md
    - ontologia/DECISOES-E-PENDENCIAS.md
    - apps/api/src/repositorios/crm/sucessao.ts
    - apps/api/src/servicos/crm/sucessao.ts
    - apps/api/src/servicos/crm/sucessao.test.ts
    - apps/api/src/rotas/crm/sucessao.test.ts
    - apps/api/src/rotas/operacoes.test.ts
    - apps/api/src/rotas/CONTEXT.md
    - apps/api/src/rotas/gesto-no-crm/membros.ts

key-decisions:
  - "D-15-08: na remoção de um Membro, toda Conversa de que ele é Atribuído (como Membro) passa ao Sucessor como Atribuído; é troca de Atribuído, não de propriedade (DO-CXE-02 vale); Conversa de Agente não muda"
  - "A liberação de Atribuído segue só para Agente excluído ou sem ver (B23); a saída de Equipe ou dos elegíveis continua sem liberar (RN-CXE-24, texto original preservado)"
  - "O Registro de Atividade por Conversa passada fica para o 15-09 (depende de crm_atividades, 15-04); o CONTEXT de rotas/ diz isso"

requirements-completed: [UCR-02]

coverage:
  - id: D1
    description: "RN-ET-09, RN-CXE-24 e B28-a emendadas; nenhum .md da ontologia diz que a Conversa do Membro removido fica sem Atribuído"
    requirement: UCR-02
    verification:
      - kind: command
        ref: "grep -rn 'Não há Sucessor de Conversas' ontologia (0 ocorrências); git diff --stat -- ontologia/ontologia.html vazio"
        status: pass
    human_judgment: true
    rationale: "Coerência de redação do contrato (RN-ET-09, RN-CXE-24, B28-a e as ocorrências secundárias) é leitura de texto; o grep só prova que a frase antiga sumiu"
  - id: D2
    description: "passarAoSucessor passa a Conversa do Membro ao Sucessor (tipo membro), não mexe na de Agente e o replay não muda nada"
    requirement: UCR-02
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/sucessao.test.ts#passarAoSucessor — Conversas do Membro removido (D-15-08)"
        status: pass
    human_judgment: false
  - id: D3
    description: "removeMember via POST /operacoes leva a Conversa ao Sucessor no mesmo commit"
    requirement: UCR-02
    verification:
      - kind: integration
        ref: "apps/api/src/rotas/operacoes.test.ts#o Administrador remove o Membro"
        status: pass
    human_judgment: false
  - id: D4
    description: "GET /membros/:id/sucessao-no-crm devolve conversasPassadas e não a chave antiga; 401 sem Authorization"
    requirement: UCR-02
    verification:
      - kind: unit
        ref: "apps/api/src/rotas/crm/sucessao.test.ts#devolve { ok, dados } com as quatro contagens"
        status: pass
      - kind: integration
        ref: "apps/api/src/servicos/crm/sucessao.test.ts#o Administrador ativo recebe as contagens do Membro neste Espaço"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-11-06
status: complete
plan_head_before: 08f3ab8a79f0c76ec5db0d39e0991940bb690632
plan_head_after: ad8d8ac6743c287e2760ff364acb0d0ba52baf4f
commits: 4
---

# Phase 15 Plan 03: Conversas do Membro removido passam ao Sucessor Summary

**D-15-08 vale no contrato, no domínio e na api: ao remover um Membro, as Conversas de que ele é Atribuído passam ao Sucessor (`atribuido_id` = Sucessor, tipo `membro`), a de Agente não muda, e `GET /membros/:id/sucessao-no-crm` devolve `conversasPassadas`.**

## Performance

- **Duration:** 10 min
- **Tasks:** 2 (Task 1 tracer/TDD, Task 2 auto)
- **Files:** 15 (1 criado, 14 alterados)

## Accomplishments

- Regras-chave emendadas primeiro, em commit próprio: RN-ET-09 (a), RN-CXE-24 e a decisão nova B28-a em `DECISOES-E-PENDENCIAS.md`, com linha no registro de alterações.
- Domínio: `SucessaoNoCrm` em `packages/dominio/src/crm/sucessao.ts`; repositório, serviço e teste da rota importam o tipo de lá (o repositório o reexporta).
- Api: `passarAoSucessor` faz `update plataforma.conversas set atribuido_id = $3 where atribuido_tipo = 'membro' and atribuido_id = <removido>`; `contarDoMembro` devolve `conversasPassadas`. `rotas/CONTEXT.md` e o comentário de `removeMember` descrevem a regra nova.
- Ocorrências secundárias emendadas: tabela de estados, evento "Membro removido" e DO-ET-04 (`espaco-de-trabalho.md`); Atribuído × Proprietário, campo Atribuído, Propriedade, Liberação, eventos, dependências e o cenário das 40 Conversas (`caixa-de-entrada-e-mensageria.md`); quatro linhas mais o Exemplo 2 e a linha de "Consumidos" de `crm-visao-geral.md`; GLOSSÁRIO; MATRIZ (duas linhas); `chat.md`.

## TDD

- **RED** (`f6eb8b9`): 4 casos falharam por asserção do comportamento planejado: `conversasPassadas` ausente (veio `conversasLiberadas`) em duas contagens, `toMatchObject({ conversasPassadas: 1 })` em `contarDoMembro`, e a atribuição da Conversa depois de `passarAoSucessor`; mais o caso de `removeMember` em `operacoes.test.ts` (veio `{ null, null }`, esperado `{ membro, Sucessor }`). Avaliação semântica: o alvo executou e falhou na asserção do comportamento novo, não por import, sintaxe ou fixture; o banco local estava migrado (001–011). O teste da rota usa serviço falso e passa antes e depois (só tipa o contrato). Não rodei `gsd_run check tdd-red-evidence` (`workflow.tdd_mode` está `false`; a inspeção foi manual sobre a saída do vitest).
- **GREEN** (`4cf40b6`): 595 testes de `operacoes.test.ts`, `servicos/crm` e `rotas/crm` passam (27 arquivos).
- **REFACTOR:** não houve.

## Verification

- `servicos/crm/sucessao.test.ts` e `rotas/crm/sucessao.test.ts` com Postgres 16 local (porta 55703, migrações 001–011): passam. Rota sem banco (`DATABASE_URL=` vazio): 4 passam.
- `tsc --noEmit` em `packages/dominio`, `apps/api` e `apps/web`: 0.
- `grep -rl conversasLiberadas apps/api/src packages/dominio/src`: 0. `grep 'Não há Sucessor de Conversas'` na ontologia: 0. `git diff -- ontologia/ontologia.html`: vazio.
- Container `crm-n1-pg-1503` parado ao fim.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `operacoes.test.ts` afirmava o comportamento antigo**
- **Found during:** Task 1 (RED)
- **Issue:** o caso "o Administrador remove o Membro" esperava `{ null, null }` na Conversa do removido; com a regra emendada ele passaria a falhar sem que o plano o listasse em `files_modified`.
- **Fix:** o caso passou a esperar `{ membro, Sucessor }` e entrou no RED.
- **Files modified:** `apps/api/src/rotas/operacoes.test.ts`
- **Commit:** `f6eb8b9`

**2. [Rule 1 - Bug] Texto de Liberação que eu mesmo introduzi contradizia RN-CXE-24**
- **Found during:** Task 2
- **Issue:** uma primeira redação da "Liberação" dizia que sair de Equipe ou dos elegíveis libera; RN-CXE-24 diz que não libera.
- **Fix:** a cláusula foi removida antes do commit; o plano afirmava o contrário ("Liberação continua para saída de Equipe/elegíveis"), mas o texto original do contrato prevalece. Liberação fica só para Agente excluído ou sem `ver` (B23).
- **Files modified:** `ontologia/03-crm/caixa-de-entrada-e-mensageria.md`
- **Commit:** `ad8d8ac`

**3. [Rule 2 - Missing] Ocorrências fora da lista do plano**
- **Found during:** Task 2
- **Issue:** `ontologia/04-ia/chat.md` (linha do "Destino na remoção do Membro"), o Exemplo 2 e a linha "Consumidos de outros domínios" de `crm-visao-geral.md` também diziam "liberado"/"liberar Atribuídos" para Membro removido.
- **Fix:** emendadas para B28-a. `ia-visao-geral.md` e `agentes.md` ficam como estão (falam de Agente).
- **Commit:** `ad8d8ac`

**Total deviations:** 3 auto-fixed (2 Rule 1, 1 Rule 2). **Impact:** nenhum no escopo; os três fecham o critério "nenhum lugar do contrato diz que a Conversa do Membro removido fica sem Atribuído".

## Issues Encountered

- Entre este plano e o 15-36, a web ainda declara a forma antiga de `SucessaoNoCrm` (`apps/web/src/dados/crm/sucessao.ts`) e o diálogo de remover Membro não mostra a contagem de Conversas (a chave nova chega e é ignorada). A web compila e seus testes não foram tocados; nada é publicado antes do corte (D-15-03).
- `ontologia/ontologia.html` ficou desatualizado de propósito (retrato antigo, sem gerador no repositório).
- IN-01 (Sucessor Convidado no replay) segue aberto por D-15-07.

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED

- Criado: `packages/dominio/src/crm/sucessao.ts` existe.
- Commits presentes no HEAD: `a2038af`, `f6eb8b9`, `4cf40b6`, `ad8d8ac`.

## Next

Ready for 15-04.
