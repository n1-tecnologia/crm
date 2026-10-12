---
phase: 08-canais-de-comunica-o-conex-o-e-omnichannel-preparado
plan: 14
subsystem: database
tags: [postgres, migracao, checkpoint, canais, caixa-de-entrada, provas]

requires:
  - phase: 08-04
    provides: 17 invariantes da 008 provadas no Postgres local, mais idempotencia
  - phase: 08-13
    provides: cenario e2e "dois WhatsApps lado a lado" por HTTP
provides:
  - 008-canais-conversas-mensagens.sql aplicada no banco da plataforma, com o contrato confirmado pelo dono
  - 08-PROVAS.md com decisao, conferencia seca, aplicacao e confirmacao (verbatim, sem segredo)
affects: [08-15, verificacao da fase 08, qualquer ajuste de schema da Caixa de Entrada (agora 009)]

tech-stack:
  added: []
  patterns:
    - "Ritual de migracao one-way: decisao do dono, --seco, aplicacao uma vez, --seco de novo (07-13 repetido para a 008)"

key-files:
  created:
    - .planning/phases/08-canais-de-comunica-o-conex-o-e-omnichannel-preparado/08-PROVAS.md
  modified: []

key-decisions:
  - "Dono confirmou o contrato da 008 como esta (A1 slugs, A2 canais_conta_uq por tipo+identificador, A6 colunas extras, A9 carga_bruta fora de toda resposta HTTP): aplicar agora, sem ajuste"
  - "A 008 esta aplicada e e imutavel (DEC-10): qualquer ajuste de schema da Caixa de Entrada a partir daqui e a 009"
  - "Aplicacao feita pelo agente orquestrador sob autorizacao explicita e unica do dono na sessao, e nao pelo terminal do dono como o plano roteirizava"

patterns-established:
  - "Quando o dono autoriza o agente a aplicar uma migracao, a autorizacao e registrada nas provas como desvio do roteiro, com o que mudou e o que nao mudou"

requirements-completed: [CXE-A1, CXE-V1]

actuals:
  tokens: 4000
  tasks: 3
  commits: 1
plan_head_before: b3940f1274e31902451e35b5c8bb601095fdadfa
plan_head_after: edf3d02

coverage:
  - id: D1
    description: "08-PROVAS.md registra a decisao do dono, a conferencia seca com a 008 pendente, a aplicacao e a confirmacao com 0 pendente(s), sem segredo"
    requirement: "CXE-A1"
    verification:
      - kind: other
        ref: "grep -c 'pendente  008-canais-conversas-mensagens.sql' 08-PROVAS.md (2) e grep -c 'aplicada  008-canais-conversas-mensagens.sql' 08-PROVAS.md (6)"
        status: pass
      - kind: other
        ref: "npm run migrar -w @n1/api -- --seco no checkout principal: 001..008 aplicada, 0 pendente(s)"
        status: pass
    human_judgment: false
  - id: D2
    description: "O dono confirmou o contrato imutavel da 008 (slugs, unicidade de conta, colunas extras, carga_bruta) antes da aplicacao"
    requirement: "CXE-V1"
    verification: []
    human_judgment: true
    rationale: "Aceitar um contrato one-way e decisao do dono; nenhum teste a substitui. Resposta 'aplicar' registrada em 08-PROVAS.md"

duration: 10min
completed: 2026-10-12
status: complete
---

# Phase 8 Plan 14: A 008 no banco da plataforma Summary

**A 008 (Canais, Conversas, Mensagens) foi aplicada no banco da plataforma depois de o dono confirmar o contrato imutavel, com conferencia seca antes e depois registradas verbatim em 08-PROVAS.md (1 pendente, aplicada em 905 ms, 0 pendentes).**

## Performance

- **Duration:** ~10 min do executor (a Task 3); as Tasks 1 e 2 foram checkpoints resolvidos com o dono pelo orquestrador
- **Completed:** 2026-10-12T22:05Z
- **Tasks:** 3 (2 checkpoints resolvidos, 1 auto)
- **Files modified:** 1 (criado)

## Accomplishments

- Task 1 (`checkpoint:decision`, `blocking-human`) resolvida: o dono respondeu **"aplicar"** com o contrato atual (A1, A2, A6, A9), sem pedir ajuste.
- Task 2 (`checkpoint:human-action`, `blocking-human`) resolvida: conferencia seca mostrou `001`..`007` aplicadas e `pendente  008-canais-conversas-mensagens.sql`; a aplicacao imprimiu `aplicada  008-canais-conversas-mensagens.sql  (905 ms)` em 2026-10-12T22:02:08Z; a conferencia seca logo depois mostrou `0 pendente(s)`.
- Task 3: o executor rodou o proprio `npm run migrar -w @n1/api -- --seco` (somente leitura) no checkout principal em 2026-10-12T22:03:31Z — `001`..`008` `aplicada`, `0 pendente(s)` — e escreveu `08-PROVAS.md` com as secoes "Decisao do dono sobre o contrato", "Conferencia", "Aplicacao", "Confirmacao" e "Fica com o dono" (decisoes 1, 2, 7 e 4, mais T-02-TLS e a regra da `009`).
- O banco da plataforma passa a ter a 008: o portao `npm run check` e a UAT de 08-15 rodam a projecao (D-11) contra ela, e `POST /canais` funciona la.

## Task Commits

1. **Task 1: contrato da 008 antes de ficar imutavel** - checkpoint resolvido, sem commit proprio (registrado em `edf3d02`)
2. **Task 2: conferencia seca e aplicacao da 008** - checkpoint resolvido, sem commit proprio (registrado em `edf3d02`)
3. **Task 3: confirmacao somente-leitura e registro em 08-PROVAS.md** - `edf3d02` (docs)

**Plan metadata:** commit `docs(08-14): complete ...` a seguir (SUMMARY, STATE, ROADMAP, REQUIREMENTS).

## Files Created/Modified

- `.planning/phases/08-canais-de-comunica-o-conex-o-e-omnichannel-preparado/08-PROVAS.md` - decisao do dono, as tres saidas do `migrar`, a confirmacao e "Fica com o dono"

## Decisions Made

- O contrato da 008 fica como entregue: quatro slugs de provedor, `canais_conta_uq` por (tipo, identificador) sem o provedor, colunas alem de D-10 e `carga_bruta` fora de toda resposta HTTP.
- A 008 esta aplicada e e imutavel (DEC-10); ajuste de schema da Caixa de Entrada e `009`.

## Deviations from Plan

### Aplicacao feita pelo agente, nao pelo dono

O plano roteirizava a Task 2 como executada pelo dono, no terminal dele ("O agente nunca roda `migrar` sem `--seco` contra o banco da plataforma"). O dono primeiro respondeu "aprovado" sem colar saidas; a conferencia seca do orquestrador mostrou a 008 ainda `pendente`; perguntado explicitamente quem deveria aplicar, o dono escolheu **"Eu mesmo aplico (voce roda o migrar)"** — autorizacao explicita, dada uma vez na sessao, para o agente orquestrador rodar `npm run migrar -w @n1/api` sem `--seco`. O orquestrador rodou uma unica vez, seguido de conferencia seca. O executor de 08-14 nao rodou `migrar` sem `--seco` em nenhum momento. Nada mais do ritual mudou. Registrado em `08-PROVAS.md` ("Desvio registrado em relacao ao roteiro do plano").

**Total deviations:** 1 (de processo, autorizada pelo dono). **Impact:** nenhum no resultado; a aplicacao e a confirmacao sao as mesmas.

## Issues Encountered

Nenhum. A Task 3 rodou o `--seco` do proprio executor sem a conexao ser recusada.

## Verification

- `grep -c "pendente  008-canais-conversas-mensagens.sql"` em `08-PROVAS.md`: 2 (criterio >= 1).
- `grep -c "aplicada  008-canais-conversas-mensagens.sql"`: 6 (criterio >= 2).
- Secoes "Decisao do dono sobre o contrato" e "Fica com o dono" presentes; "Confirmacao" mostra `0 pendente(s)`.
- Varredura por `postgres://`, `password` e `senha=` em `08-PROVAS.md`: 0 ocorrencias (T-08-54).
- `npm run migrar -w @n1/api -- --seco`: `001`..`008` `aplicada`, `0 pendente(s); nada foi aplicado (--seco).`
- Gate de ID compartilhado (`requirements.ready-ids`): CXE-A1 pronto; CXE-V1 bloqueado (08-15 ainda o declara e nao tem SUMMARY), portanto so CXE-A1 foi marcado como concluido em REQUIREMENTS.md. CXE-V1 sera marcado quando 08-15 terminar.

## Known Stubs

Nenhum.

## Threat Flags

Nenhuma superficie nova: o plano so aplica um arquivo ja commitado e escreve um documento. T-08-52 mitigado (decisao do dono antes, conferencia seca, confirmacao somente-leitura); T-08-54 mitigado (so linhas do `migrar`, sem `DATABASE_URL`, host ou senha).

## Next Phase Readiness

Pronto para 08-15 (portao `npm run check` e UAT de fim de fase): a 008 esta no banco da plataforma. O `08-PROVAS.md` e o arquivo onde 08-15 acrescenta o "Roteiro da UAT" e as "Limitacoes aceitas".

## Self-Check: PASSED

- FOUND: `.planning/phases/08-canais-de-comunica-o-conex-o-e-omnichannel-preparado/08-PROVAS.md`
- FOUND: commit `edf3d02` (ancestral de HEAD)
