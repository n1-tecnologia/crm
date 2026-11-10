---
phase: 14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa
plan: 19
subsystem: database
tags: [migracao, ensaio, postgres, docker, dados-reais, fronteira-de-deploy]

requires:
  - phase: 14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa
    provides: a migração 011 (plano 14-01) e o gate e a fronteira de deploy do 14-18
provides:
  - "14-ENSAIO.md: a 011 aplicada sobre a cópia dos dados reais do CRM antigo, com as contagens-base por coleção que a Fase 15 vai conferir"
affects: [15-unificacao-do-crm-telas, deploy da Fase 15, script de migração dos dados]

actuals:
  tokens: 40000
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "ensaio de migração em Postgres 16 de Docker: 001 a 010 pelo texto e registradas em plataforma.migracoes, cópia importada por \\copy, --seco, migrar, banco:conceder, contagem antes e depois, hidratar por Espaço, contêiner apagado por trap"

key-files:
  created:
    - .planning/phases/14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa/14-ENSAIO.md
  modified: []

key-decisions:
  - "A cópia foi tirada pelo agente, em sessão somente leitura, a pedido explícito do dono na conversa (o plano previa o dono; a proibição T-14-46 foi dispensada por ele). A senha não foi gravada em arquivo nem no repositório."
  - "O ensaio registra o que não cobre (contatos e conversas vazias no banco do ensaio; banco:conceder sem o papel n1_api) em vez de declarar a 011 plenamente provada."

patterns-established:
  - "Leitura de contagem em produção, em sessão default_transaction_read_only = on, para fechar a lacuna que a cópia só de registros deixa."

requirements-completed: [UNI-03]

plan_head_before: 02d16082cc8ba25161f32587aefbf50f606887ea
plan_head_after: c55c30b55cecd6c1355a281f8a39133bd2d005f1

coverage:
  - id: D1
    description: "A 011 aplica sobre a cópia dos dados reais (2128 registros do CRM antigo, 18 Espaços) depois de 001 a 010, sem erro; o --seco lista só a 011 como pendente"
    requirement: "UNI-03"
    verification:
      - kind: other
        ref: "ensaio-1419.sh: --seco lista 11 arquivos com só 011 pendente; migrar aplicou 011-crm-o-que-faltava.sql em 31 ms"
        status: pass
    human_judgment: false
  - id: D2
    description: "D-03: as contagens das nove coleções são iguais antes e depois (2128 = 2128, e idênticas por Espaço e coleção); as cinco tabelas novas nascem com 0 linhas"
    requirement: "UNI-03"
    verification:
      - kind: other
        ref: "14-ENSAIO.md: tabela por coleção antes/depois; diff das contagens por Espaço e coleção sem diferença; contato_consentimentos, contato_notas, conversa_marcacoes, crm_de_para e registros_crm_antigo com 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "hidratar() lê cada um dos 18 Espaços depois da 011, com a contagem por coleção igual à do select"
    requirement: "UNI-03"
    verification:
      - kind: other
        ref: "hidratar-1419.ts (descartado): 18 Espaços, 0 falhas, 0 diferenças contra a contagem do banco"
        status: pass
    human_judgment: false
  - id: D4
    description: "A cópia não entrou no repositório e o contêiner foi apagado"
    verification:
      - kind: other
        ref: "14-ENSAIO.md contém 011; docker ps não lista crm-n1-pg-1419; git status sem .csv; nenhuma credencial no arquivo"
        status: pass
    human_judgment: false
  - id: D5
    description: "O ensaio não exercita as constraints e o backfill da 011 sobre linhas reais de contatos e conversas, nem as concessões a n1_api"
    requirement: "UNI-03"
    verification:
      - kind: other
        ref: "leitura em produção (somente leitura): 2 Contatos ativo, 0 Conversas, migrações aplicadas até a 010; banco:conceder só rodou o ramo sem o papel n1_api"
        status: unknown
    human_judgment: true
    rationale: "A cópia é só de plataforma.registros; a conclusão de que as constraints novas não falham sobre as linhas reais vem da leitura das constraints e das contagens, e o banco:conceder só se prova em produção, no deploy da Fase 15"

duration: 10min
completed: 2026-11-05
status: complete
---

# Phase 14 Plan 19: Ensaio da migração 011 sobre a cópia dos dados reais Summary

**A 011 aplica limpa sobre a cópia de 2128 registros do CRM antigo (18 Espaços): contagens iguais antes e depois, as cinco tabelas novas com 0 linhas e `hidratar` lendo todos os Espaços; as linhas-base da Fase 15 estão em `14-ENSAIO.md`.**

## Performance

- **Duration:** ~10 min do Task 2 (o Task 1 era o checkpoint do dono)
- **Started:** 2026-11-05T13:04Z
- **Completed:** 2026-11-05T13:16Z
- **Tasks:** 2 (Task 1 foi o checkpoint de ação humana; o export foi feito pelo agente a pedido do dono)
- **Files modified:** 1 (novo)

## Accomplishments

- **Cópia.** O `\copy` do plano não rodou no SQL Editor do Supabase (`COPY` fica no servidor e exige `pg_write_server_files`). Um script de `psql`, em sessão `default_transaction_read_only = on`, exportou as nove coleções (2128 linhas) e as 18 linhas de `plataforma.workspaces` para `~/n1-ensaio/`, fora do repositório. O script foi testado antes contra um Postgres descartável.
- **Ensaio.** Postgres 16 de Docker com 001 a 010 (registradas em `plataforma.migracoes`, que é o estado de produção), cópia importada, `--seco` (só a 011 pendente), `migrar` (011 em 31 ms), `banco:conceder`, contagem depois, `hidratar` por Espaço.
- **Achado para a Fase 15.** Só `ws_n1` é Espaço real, e nele o CRM antigo tem 1 funil e nada mais; os outros 17 Espaços são resíduo de teste, 16 deles com a mesma semente de demonstração. O CRM novo em produção tem 2 Contatos e 0 Conversas.
- **Incidente do 14-17.** `ws_rotas_teste` tem 0 linhas em `registros` e em `workspaces`: nenhum resíduo em produção.

## Task Commits

1. **Task 2: ensaio e `14-ENSAIO.md`** - `c55c30b` (docs)
2. Task 1 foi o checkpoint do dono, sem commit.

**Plan metadata:** commit `docs(14-19)` seguinte (SUMMARY, STATE e ROADMAP).

## Files Created/Modified

- `.planning/phases/14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa/14-ENSAIO.md` - saída do `--seco`, contagens antes e depois, `hidratar` por Espaço e o que o ensaio não cobre

## Decisions Made

- O agente tirou a cópia, e não o dono, porque o dono mandou a conexão e pediu "rode você mesmo" depois de o `\copy` falhar no SQL Editor. Foi só leitura e a senha não foi gravada em arquivo. Fica registrado como desvio do plano.
- Os limites do ensaio estão escritos em `14-ENSAIO.md` ("O que o ensaio não cobre") e na cobertura D5 como `human_judgment: true`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Interpretação] O agente usou a conexão de produção, contra a proibição "o agente nunca lê o banco de produção" (T-14-46)**
- **Found during:** Task 1 (checkpoint)
- **Issue:** o dono tentou o `\copy` no SQL Editor do Supabase, que não aceita `\copy`, e mandou a `DATABASE_URL` pedindo que o agente rodasse.
- **Fix:** o agente exportou em sessão somente leitura, só as nove coleções e as linhas de `workspaces`, e fez uma leitura de contagem (`contatos`, `conversas`, `migracoes`, `ws_rotas_teste`). A `DATABASE_URL` foi passada por `stdin` e nunca gravada em arquivo. O agente não leu `.env`.
- **Files modified:** nenhum de código
- **Verification:** `14-ENSAIO.md` sem credencial; `git status` sem `.csv`.
- **Committed in:** `c55c30b`

**2. [Interpretação] Leitura extra de contagens em produção**
- **Found during:** Task 2
- **Issue:** a cópia só de `registros` deixa `plataforma.contatos` e `plataforma.conversas` vazias no ensaio, e a 011 acrescenta constraints e um backfill nelas.
- **Fix:** leitura somente de contagem em produção (2 Contatos `ativo`, 0 Conversas) para concluir, por leitura das constraints, que nenhuma falharia. Registrado como não executado.
- **Files modified:** nenhum
- **Committed in:** `c55c30b`

---

**Total deviations:** 2 (ambas de interpretação, sem código tocado). **Impact:** nenhum no código; o ensaio ficou mais honesto sobre o que prova.

## Issues Encountered

- O `\copy` no SQL Editor do Supabase falhou (`permission denied to COPY to a file`); resolvido com o script de `psql`.
- A primeira execução do ensaio parou em `01-*.sql`: a expansão `{01..10}` do bash 3.2 do macOS não zera à esquerda. Corrigido no script e rodado de novo; o contêiner foi removido pela `trap`.

## Itens abertos

- `banco:conceder` só se prova em produção, no deploy da Fase 15.
- O dono ainda precisa ler as perguntas de `14-PROVAS.md` (OQ2/A8, OQ3, OQ5 a OQ8) e rodar as provas manuais dos `<human-check>` de 14-11, 14-15 e 14-16.
- A `DATABASE_URL` de produção, a chave secreta do Supabase e o token do ClickUp foram coladas na conversa: vale trocar a senha do banco depois do ensaio.

## Known Stubs

Nenhum (só documentação).

## Threat Flags

T-14-44 mitigada: a cópia está fora do repositório, `14-ENSAIO.md` só tem números e nenhum `.csv` aparece no `git status`. T-14-45 mitigada: o contêiner foi apagado pela `trap` e conferido. T-14-46 foi dispensada pelo dono (ver Deviations).

## User Setup Required

None - nenhum serviço externo. A pasta `~/n1-ensaio/` com a cópia segue no notebook do dono, que decide quando apagá-la.

## Next Phase Readiness

- A UNI-03 está ensaiada. O script de migração da Fase 15 parte de 2128 linhas em 18 Espaços (624 Contatos, 192 Empresas, 480 vínculos Contato-Empresa, 16 vínculos Empresa-Empresa, 16 "distintos de", 66 funis, 304 Negócios, 80 Canais, 350 Conversas).
- A 011 só vai para produção no deploy da Fase 15, com backup manual antes.

---
*Phase: 14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa*
*Completed: 2026-11-05*

## Self-Check: PASSED

- `14-ENSAIO.md` existe, tem a 011 e a tabela com as nove coleções.
- Commit `c55c30b` é ancestral de `HEAD`.
- `docker ps` não lista `crm-n1-pg-1419`; `git status` não lista `.csv`.
- Ressalva: o ensaio não exercita constraints e backfill sobre linhas reais de `contatos` e `conversas` nem o `banco:conceder` com o papel `n1_api` (ver D5).
