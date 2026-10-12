---
phase: 08-canais-de-comunica-o-conex-o-e-omnichannel-preparado
plan: 04
subsystem: database
tags: [postgres, migracao-008, vitest, contatos, fk, canais, conversas, mensagens]

requires:
  - phase: 08-canais-de-comunica-o-conex-o-e-omnichannel-preparado
    provides: "008-canais-conversas-mensagens.sql, semearCanal, limparEspaco, BloqueiosCrm.conversas (plan 08-01)"
provides:
  - "canais-008.test.ts: as 17 provas das invariantes da 008 contra Postgres local, com SQLSTATE e nome do constraint"
  - "RepositorioDeContatos.conversasDoContato"
  - "409 CONTATO_COM_CONVERSAS (pre-checagem e frase da corrida) na exclusao permanente de Contato"
  - "FRASES_DE_CONTATOS exportada (antigo FRASES)"
affects: [08-14, 08-05, 08-06]

actuals:
  tokens: 4000
  tasks: 2
  commits: 3
plan_head_before: 57f5dab8e79d3a2ede924c5af15ab66cd863af86
plan_head_after: bd85aa5fa5b6e3db50c74ddf2ec074597d3ac39c

tech-stack:
  added: []
  patterns:
    - "Prova de constraint por barrado(promessa, code, constraint): confere SQLSTATE e nome, nunca so que lancou"
    - "Pre-checagem rica (409 com bloqueios) + frase por constraint como rede contra corrida"

key-files:
  created:
    - apps/api/src/repositorios/crm/canais-008.test.ts
  modified:
    - apps/api/src/repositorios/crm/contatos.ts
    - apps/api/src/servicos/crm/contatos.ts
    - apps/api/src/servicos/crm/contatos.test.ts

key-decisions:
  - "A pre-checagem de Conversas fica depois da de Negocios e antes da de Empresas, como o plano pediu; a lixeira (enviarParaLixeira) nao ganha checagem porque nao apaga nada."
  - "conversasDoContato conta todas as Conversas do Contato (qualquer situacao/estado), pois a FK segura qualquer uma."

patterns-established:
  - "Teste de invariante de migracao: uma linha de fixture por prova, constraints conferidos pelo nome"

requirements-completed: []

coverage:
  - id: D1
    description: "A 008 segura no banco as invariantes de Canal, Conversa e Mensagem (17 provas) e roda duas vezes sem erro"
    requirement: CXE-A1
    verification:
      - kind: integration
        ref: "apps/api/src/repositorios/crm/canais-008.test.ts (17 casos)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Excluir permanentemente um Contato com Conversa responde 409 CONTATO_COM_CONVERSAS com bloqueios.conversas, e o 23503 da corrida traduz para a mesma frase sem nome de constraint"
    requirement: CXE-A2
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/contatos.test.ts#(g) Contato com Conversa; #(g) a corrida"
        status: pass
    human_judgment: false

duration: 3min
completed: 2026-10-12
status: complete
---

# Phase 8 Plan 04: Provas da 008 e 409 de Contato com Conversa Summary

**As 17 invariantes da 008 (Canal, Conversa, Mensagem) provadas no Postgres 16 local por SQLSTATE e nome de constraint, mais a idempotencia, e a exclusao permanente de Contato com Conversa convertida de 500 em 409 `CONTATO_COM_CONVERSAS` com pre-checagem e rede contra corrida.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-10-12T16:52:52Z
- **Completed:** 2026-10-12T16:56Z
- **Tasks:** 2 (1 auto, 1 TDD)
- **Files modified:** 4 (1 criado, 3 alterados)

## Accomplishments

- `canais-008.test.ts`: 17 provas contra o container `crm-n1-pg-0804` (porta 55584), cada "barrado" conferindo `code` e `constraint` (14 nomes distintos de constraint/indice asserted). Cobre INV-CXE-01/03/07/08/09/10, RN-CXE-31, 11.1, 20.6, FKs compostas entre Espacos e entre Conversa e Canal (T-08-19), cascata de Mensagens, trigger de `atualizado_em` e a segunda execucao do proprio arquivo da 008.
- `conversasDoContato` no repositorio e, em `excluirPermanentemente`, a pre-checagem que devolve 409 `CONTATO_COM_CONVERSAS` com `bloqueios.conversas` (singular/plural na frase); o Contato segue na lixeira.
- Rede contra corrida: `conversas_workspace_id_contato_id_fkey` em `FRASES_DE_CONTATOS` (exportada so para o teste); o nome do constraint nao vaza na resposta (T-08-20).

## Task Commits

1. **Task 1: provas da 008** - `a4639d2` (test)
2. **Task 2 RED:** `5a63da8` (test) - Contato com Conversa e a frase da corrida
3. **Task 2 GREEN:** `bd85aa5` (feat) - repositorio, pre-checagem e frase

**Plan metadata:** commit `docs(08-04)` seguinte a este arquivo.

## Files Created/Modified

- `apps/api/src/repositorios/crm/canais-008.test.ts` - as 17 provas e a idempotencia (novo)
- `apps/api/src/repositorios/crm/contatos.ts` - `ConversasDoContato` e `conversasDoContato`
- `apps/api/src/servicos/crm/contatos.ts` - pre-checagem, frase da corrida, `FRASES_DE_CONTATOS`
- `apps/api/src/servicos/crm/contatos.test.ts` - dois casos novos

## Decisions Made

Ver `key-decisions` no frontmatter. `migrar-seco.test.ts` nao foi editado (`git log 57f5dab..HEAD` sobre o arquivo imprime nada) e passou: 3 testes.

## Deviations from Plan

### TDD Gate Compliance (Task 2)

- **RED:** `5a63da8`. Contra o Postgres local, 2 dos 13 testes de `contatos.test.ts` falharam: o caso 1 com o erro bruto do `pg` (`violates foreign key constraint "conversas_workspace_id_contato_id_fkey"`, o 500 que a tarefa corrige) e o caso da corrida com `TypeError` por `FRASES_DE_CONTATOS` ainda nao exportada (`frases` undefined). Avaliacao semantica: os testes-alvo executaram e falharam pelo comportamento ausente, nao por sintaxe, fixture ou descoberta zero; os 11 anteriores seguiram verdes. O `tsc` do commit RED nao fecha porque o teste importa o simbolo que o GREEN cria.
- **GREEN:** `bd85aa5`, 52/52 em `servicos/crm/contatos.test.ts` + `rotas/crm/contatos.test.ts`, `tsc --noEmit` limpo. Sem REFACTOR. `gsd_run check tdd-red-evidence` nao foi invocado (plano `type: execute` com `tdd="true"` por tarefa; a evidencia e a saida real do vitest), como em 08-03.

### Criterios de aceitacao

**1. [Metrica literal vs intencao] `grep -c "constraint" canais-008.test.ts` >= 10**
- **Found during:** Task 1
- **Issue:** a contagem literal de linhas com a palavra "constraint" e 4 (o helper `barrado` recebe o nome do constraint como argumento, entao a palavra aparece pouco). A intencao do criterio (as provas conferem o nome do constraint, nao so que lancou) esta cumprida: 14 nomes distintos de constraint/indice sao asserted via `barrado(..., code, constraint)` e o helper usa `toMatchObject({ code, constraint })`. Nao inflei o arquivo para satisfazer a contagem literal.

### Registro de ambiente

**Commits em `main`:** o orquestrador mandou ficar em `main` (isolamento `none`, `branching_strategy: none`); a assertiva de HEAD protegido foi tratada como nao aplicavel, como em 08-01..08-03. Nenhum `git update-ref`, stash, clean ou troca de branch. O guard de raiz fixada (#4254) rodou antes de cada commit.

---

**Total deviations:** 0 auto-fixed, 1 divergencia de metrica literal (intencao cumprida), 2 registros de TDD/ambiente.
**Impact on plan:** nenhum escopo a mais.

## Issues Encountered

- Nenhum erro de teste ou de tipo alem do RED proposital; as 17 provas passaram na primeira rodada, com todos os nomes de constraint previstos pelo plano corretos contra a 008 real.
- Regressao fora do verify do plano: `src/repositorios/crm`, `src/servicos/crm`, `src/rotas/crm` e `migrar-seco.test.ts` juntos, 14 arquivos e 219 testes verdes, nenhum pulado. A suite inteira da api nao foi rodada (40-50 min).

## Known Stubs

Nenhum.

## Threat Flags

Nenhum alem do `<threat_model>`. Mitigacoes aplicadas: T-08-19 (provas 8 e 10), T-08-20 (frase em pt-BR para `conversas_workspace_id_contato_id_fkey`, teste afirma que o nome nao vaza), T-08-21 (pre-checagem `conversasDoContato`).

## User Setup Required

None - no external service configuration required. O container `crm-n1-pg-0804` (porta 55584) foi removido ao final.

## Next Phase Readiness

- 08-14 pode citar `canais-008.test.ts` como evidencia no `checkpoint:decision` antes de a 008 ficar imutavel.
- A tela de Contatos (Fase 7) mostra o `error` do 409 como os outros; `bloqueios.conversas` nao ganhou lista propria nesta fase.
- `CXE-A1` e `CXE-A2` sao compartilhados com planos irmaos; a marcacao depende de `requirements.ready-ids`.

---
*Phase: 08-canais-de-comunica-o-conex-o-e-omnichannel-preparado*
*Completed: 2026-10-12*

## Self-Check: PASSED
