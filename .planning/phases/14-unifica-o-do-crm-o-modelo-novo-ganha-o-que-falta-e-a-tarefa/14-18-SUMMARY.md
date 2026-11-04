---
phase: 14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa
plan: 18
subsystem: testing
tags: [gate, docker, postgres, vitest, fronteira-de-deploy, documentacao]

requires:
  - phase: 14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa
    provides: planos 14-01 a 14-17 (a 011, o gesto misto, as rotas novas, a Tarefa conversacional nas tabelas, o corte)
provides:
  - "14-PROVAS.md: gate da fase colado sem edição, fronteira de deploy, perguntas para o dono, itens abertos e linhas sugeridas para andamento.mjs"
  - "CONTEXT.md da raiz com o parágrafo da Fase 14 e a Fase 15 nomeada"
  - "14-VALIDATION.md validada (nyquist_compliant e wave_0_complete verdadeiros)"
affects: [15-unificacao-do-crm-telas, 14-19 ensaio D-02, deploy da Fase 15]

actuals:
  tokens: 21000
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "gate de fase só em Postgres 16 de Docker migrado, com as duas URLs escritas no comando"

key-files:
  created:
    - .planning/phases/14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa/14-PROVAS.md
  modified:
    - CONTEXT.md
    - .planning/phases/14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa/14-VALIDATION.md

key-decisions:
  - "O gate foi registrado como verde exceto o flake de baseline de outbox-worker (h a k), com o arquivo isolado passando 15/15 em banco novo, e não como verde absoluto."
  - "Nada em docs/09-planejamento foi tocado: as linhas de andamento.mjs ficam em 14-PROVAS.md para o dono colar."

patterns-established:
  - "Fronteira de deploy escrita por commit: 14-01 a 14-14 aditivos (b9c3d86), 14-15 a 14-17 só com a Fase 15."

requirements-completed: [UNI-01, UNI-02, UNI-04, UNI-05, UNI-06, UNI-07, UNI-08, UNI-09, UNI-10, UNI-11, UNI-12, UNI-13, UNI-14, UNI-15, UNI-16, UNI-17]

plan_head_before: 4e099286a10bd1524be1080095d8393b6ad9e073
plan_head_after: d3b2ec5025e8ca2321f8d1ab219a8beeb23ce87e

coverage:
  - id: D1
    description: "O gate npm run check em Postgres 16 de Docker migrado até a 011 foi rodado duas vezes e registrado sem edição em 14-PROVAS.md; web e domínio passam inteiros e a api só falha no flake de baseline do outbox-worker, que isolado passa 15/15"
    requirement: "UNI-01"
    verification:
      - kind: other
        ref: "npm run check (Docker crm-n1-pg-1418, porta 55618): web 1032/1032, dominio 2322/2322, api 2073/2074 (1ª) e 2070/2074 (2ª), só outbox-worker h-k"
        status: unknown
      - kind: unit
        ref: "apps/api/src/persistencia/outbox-worker.test.ts isolado em banco novo: 15/15"
        status: pass
      - kind: unit
        ref: "apps/api/src/persistencia/colunas-geradas.test.ts isolado em banco novo: 8/8"
        status: pass
    human_judgment: true
    rationale: "O gate não fechou verde por inteiro: a decisão de aceitar o flake de baseline (com a evidência isolada) é do dono, não da automação"
  - id: D2
    description: "A fronteira de deploy (14-01 a 14-14 aditivos; 14-15 a 14-17 só com a Fase 15), D-03 e as suposições e perguntas em aberto estão escritas em 14-PROVAS.md"
    requirement: "UNI-02"
    verification:
      - kind: other
        ref: "grep -c 'Fronteira de deploy' 14-PROVAS.md >= 1; grep -c '\"3.[123].[0-9]\"' 14-PROVAS.md = 20"
        status: pass
    human_judgment: true
    rationale: "As suposições e perguntas só valem depois que o dono as lê e responde"
  - id: D3
    description: "CONTEXT.md da raiz tem o parágrafo A partir da Fase 14 e a Fase 15 nomeada; 14-VALIDATION.md com nyquist_compliant e wave_0_complete verdadeiros"
    verification:
      - kind: other
        ref: "grep -c 'A partir da Fase 14' CONTEXT.md = 1; grep -c 'nyquist_compliant: true' 14-VALIDATION.md >= 1; grep -c 'wave_0_complete: true' 14-VALIDATION.md = 1"
        status: pass
    human_judgment: false

duration: 14min
completed: 2026-11-04
status: complete
---

# Phase 14 Plan 18: Gate da fase, fronteira de deploy e CONTEXT da raiz Summary

**Gate `npm run check` em Postgres 16 de Docker migrado até a 011 (web 1032 e domínio 2322 verdes; api só com o flake de baseline do `outbox-worker`, 15/15 isolado), mais `14-PROVAS.md` com a fronteira de deploy e as perguntas para o dono, o parágrafo da Fase 14 no `CONTEXT.md` e `14-VALIDATION.md` validada.**

## Performance

- **Duration:** ~14 min (o gate leva cerca de 3 min por rodada; duas rodadas mais três execuções isoladas)
- **Started:** 2026-11-04T20:41Z
- **Completed:** 2026-11-04T20:55Z
- **Tasks:** 2
- **Files modified:** 3 (1 novo, 2 alterados)

## Resultado do gate (resumo)

| Workspace | 1ª rodada | 2ª rodada (repetição) |
|---|---|---|
| `packages/dominio` | 120 arquivos, 2322 testes passam | idem |
| `apps/web` | 107 arquivos, 1032 testes passam; `eslint` 0 erros e 2 avisos antigos; `verificar:tokens` 0 falhas | idem |
| `apps/api` | 174 passam, 1 falha: `outbox-worker.test.ts` (j); 2073 testes passam | 174 passam, 1 falha: `outbox-worker.test.ts` (h, i, j, k); 2070 testes passam |

Nenhum outro teste de `apps/api` falhou. As três guardas D-06 (domínio, api e web) estão dentro desses números e passaram. O `outbox-worker.test.ts` isolado num banco novo e migrado passa 15/15 e o `colunas-geradas.test.ts` isolado passa 8/8 (um terceiro passe da suíte inteira da api, só para listar os pulados, falhou 2 casos de `colunas-geradas`, os mesmos do baseline, e `outbox-worker` passou). Os 21 testes pulados da api dependem do repositório irmão `financeiro-tria`, da pasta de export real do ClickUp ou de um `it.skip` deliberado; nenhum é teste de banco. Tudo foi rodado só em Docker local, com `DATABASE_URL` e `DATABASE_URL_MIGRACAO` locais escritas no comando; o `.env` não foi lido nem usado. A saída completa está em `14-PROVAS.md`.

## Accomplishments

- **Gate.** Rodado duas vezes (a repetição que o plano manda quando só o `outbox-worker` oscila) e colado sem edição. Como a falha persistiu nas duas rodadas, os dois arquivos do baseline foram rodados isolados em banco novo e migrado: passam. Registrado como baseline com essa evidência, conforme a regra do orquestrador.
- **`14-PROVAS.md`.** Comando literal, SHA, quando, saída por workspace, fronteira de deploy (com os hashes dos commits de corte), D-03 (nada apagado de `registros`; `registros_crm_antigo` e `crm_de_para` nascem vazias), suposições e perguntas para o dono, o que o corte tira da tela, provas manuais pendentes, itens abertos, o que ficou para a Fase 15 e as Sessões 6 e 7, flakes de baseline, o incidente de teste sem `DATABASE_URL` do 14-17 e as 20 linhas sugeridas para `andamento.mjs` (3.1.1 a 3.3.7; `decidido` em 3.1.1 a 3.1.4 e 3.3.1; 3.1.5 `parcial` até o ensaio do 14-19; 3.2.5 e 3.2.7 `parcial` porque as telas antigas só trocam na Fase 15).
- **`CONTEXT.md` da raiz.** Parágrafo "A partir da Fase 14" depois do da Fase 8; a frase "até a fase de unificação" da Fase 8 (e a equivalente da Fase 7) nomeia a Fase 15; a frase "daqui em diante é a `009`" passou a "uma migração nova, depois da última aplicada", porque já existem a 009, a 010 e a 011.
- **`14-VALIDATION.md`.** `status: validated`, `nyquist_compliant: true`, `wave_0_complete: true`, os 28 arquivos de Wave 0 conferidos no disco, tarefas 14-01 a 14-18 em verde, 14-19 segue pendente (é do dono) e assinatura de validação com a ressalva do flake e das provas manuais.

## Task Commits

1. **Task 1: gate e `14-PROVAS.md`** - `cf99af9` (docs)
2. **Task 2: `CONTEXT.md` da raiz e `14-VALIDATION.md`** - `d3b2ec5` (docs)

**Plan metadata:** commit `docs(14-18)` seguinte (SUMMARY, STATE e ROADMAP).

## Files Created/Modified

- `.planning/phases/14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa/14-PROVAS.md` - o gate, a fronteira de deploy, as perguntas para o dono e as linhas de `andamento.mjs`
- `CONTEXT.md` - "Estado atual" com a Fase 14
- `.planning/phases/14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa/14-VALIDATION.md` - status validado

## Decisions Made

- Registrar o gate como "verde exceto o flake de baseline, com evidência" e não como verde absoluto; o plano (`fails_when: non-zero exit`) previa uma repetição, e a repetição também falhou pelo mesmo flake. A regra do orquestrador (isolar os dois arquivos em banco novo) foi seguida e provou o baseline.
- `3.2.5` e `3.2.7` ficam `parcial` nas linhas sugeridas: a rota e a ficha nova estão prontas, mas o diálogo da Caixa antiga e o fio e a Reunião só trocam na Fase 15 (3.4).

## Deviations from Plan

### Auto-fixed Issues

**1. [Interpretação] O gate não terminou com código 0**
- **Found during:** Task 1
- **Issue:** `fails_when: non-zero exit (depois de uma repetição se a única falha for outbox-worker)`: a repetição também saiu com 1, só por `outbox-worker.test.ts` (h a k).
- **Fix:** seguiu a regra do orquestrador: rodou os dois arquivos do baseline isolados num Postgres de Docker novo e migrado (15/15 e 8/8), registrou a saída das duas rodadas sem edição e rotulou as falhas como baseline com a evidência. Nenhum teste foi alterado.
- **Files modified:** nenhum de código
- **Verification:** `outbox-worker.test.ts` 15/15 e `colunas-geradas.test.ts` 8/8 isolados.
- **Committed in:** `cf99af9`

**2. [Rule 1 - Referência morta] "daqui em diante é a `009`" no parágrafo da Fase 8 do `CONTEXT.md`**
- **Found during:** Task 2
- **Issue:** a frase estava desatualizada (009, 010 e 011 já existem) e contradiria o parágrafo novo, que diz que a 011 é imutável.
- **Fix:** passou a "uma migração nova, depois da última aplicada". Só texto.
- **Files modified:** `CONTEXT.md`
- **Committed in:** `d3b2ec5`

**3. [Interpretação] A frase "até a fase de unificação" também aparece no parágrafo da Fase 7**
- O plano só manda ajustar a da Fase 8; a da Fase 7 foi ajustada pelo mesmo motivo (nomear a Fase 15). Só texto.

---

**Total deviations:** 3 (1 gate sem exit 0 por baseline, 1 referência morta, 1 interpretação). **Impact:** nenhum código tocado; só documentação.

## Issues Encountered

- O gate (`npm run check`) falhou duas vezes só por `outbox-worker.test.ts` (flake de baseline; ver acima). Nenhum outro teste falhou.
- O `verificar:contratos` pulou com aviso: o repositório irmão `financeiro-tria` não existe nesta máquina (igual em fases anteriores).

## Itens abertos (levados ao `14-PROVAS.md`)

- `instantiateListTemplate` chama `createList` sem `canais` (`packages/dominio/src/operations/planning.ts:364`); precisa de entrada em `LER_DO_CRM` antes da 3.5.4.
- `FRASES_DE_CONTATOS` sem `contatos_mesclado_em_fk` e sem as `contato_consentimentos_*`.
- Incidente de teste sem `DATABASE_URL` no 14-17: o grupo de banco de `rotas/operacoes.test.ts` pode ter tocado o Espaço `ws_rotas_teste` no banco do `.env`; o dono confere com `select count(*) from plataforma.registros where workspace_id = 'ws_rotas_teste'`. Este plano não consultou nem tocou produção.

## Known Stubs

Nenhum (só documentação).

## Threat Flags

Nenhuma superfície nova. T-14-43 mitigada: as duas URLs apontam para o Docker local no próprio comando, e o comando literal está em `14-PROVAS.md`.

## User Setup Required

None - no external service configuration required. O dono cola as linhas de `14-PROVAS.md` em `docs/09-planejamento/dados/andamento.mjs` quando quiser.

## Next Phase Readiness

- A Fase 14 está fechada em código e documentação. O plano 14-19 (ensaio D-02) espera a cópia dos dados reais do dono.
- A Fase 15 começa pelo que está em "O que ficou para a Fase 15" de `14-PROVAS.md`: telas antigas, script de migração, remoção do modelo antigo (menos Grupo e Flow) e as provas manuais pendentes.
- Os commits dos planos 14-15 a 14-17 não podem subir antes do script de migração.

---
*Phase: 14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa*
*Completed: 2026-11-04*

## Self-Check: PASSED

- `14-PROVAS.md`, `14-VALIDATION.md` e `CONTEXT.md` existem e estão alterados.
- Commits `cf99af9` e `d3b2ec5` são ancestrais de `HEAD`.
- Critérios de aceite: `grep -c "npm run check"` = 3 (>= 1), `grep -c "Fronteira de deploy"` = 1 (>= 1), `grep -c '"3.[123].[0-9]"'` = 20 (>= 20), `grep -c "A partir da Fase 14" CONTEXT.md` = 1, `grep -c "Fase 15" CONTEXT.md` = 6, `grep -c "wave_0_complete: true"` = 1.
- Ressalva: o gate não saiu com código 0 (baseline do `outbox-worker`; ver Deviations).
