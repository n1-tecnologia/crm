---
phase: 03-contas-a-pagar
plan: 01
subsystem: database
tags: [postgres, supabase, migracao, lease, for-update-skip-locked, automacoes, vitest]

# Dependency graph
requires:
  - phase: 01-fundacao
    provides: "runner de migrações numeradas e imutáveis (migrar.ts), pool() do pg, padrão de teste de integração que pula sem DATABASE_URL (D-DEC-09)"
  - phase: 02-solicitacao-de-pagamento
    provides: "plataforma.importacao_ledger e o padrão de lease de outbox-worker.ts::reivindicar() (003-integracao-e-importacao.sql)"
provides:
  - "tabela plataforma.automacao_agenda (PK composta (workspace_id, list_id, dia_civil)) aplicada no Supabase da plataforma"
  - "índice parcial automacao_agenda_pendente para reivindicação por for update skip locked"
  - "prova contra Postgres real das três garantias que o Plan 03-08 assume: um dia por Lista, reivindicação exclusiva, dia retomável"
  - "convenção de valor origem = 'clickup:901107637383' em plataforma.importacao_ledger (sem ledger novo)"
affects: [03-08 motor de Automações, 03-09 importação histórica, 03-10 importação histórica]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "lease por for update skip locked sobre chave composta (row-wise comparison com subquery)"
    - "estado terminal + varredura de lease vencida como prova de que o dia não some"

key-files:
  created:
    - apps/api/migracoes/005-agenda-de-automacoes.sql
    - apps/api/src/persistencia/agenda-de-automacoes.test.ts
  modified:
    - apps/api/src/persistencia/CONTEXT.md

key-decisions:
  - "A agenda não é fonte de idempotência: a idempotência de Automação agendada continua em AutomationExecution/jaRodou (runScheduledAutomations), e a tabela só responde 'alguém já está processando este dia'"
  - "Nenhum ledger novo para Contas a pagar: a importação histórica reusa plataforma.importacao_ledger (003) com origem = 'clickup:901107637383'"
  - "A varredura de lease vencida (processando + locked_at antigo → falhou) é a forma verificável do critério 3 do ROADMAP; o SQL dela vive no teste até o worker do Plan 03-08 existir"

patterns-established:
  - "Reivindicação de chave composta: update ... where (a,b,c) = (select a,b,c ... for update skip locked) — mesmo desenho de outbox-worker.ts, adaptado à PK de três colunas"
  - "Teste de integração com workspace_id de prefixo próprio por execução (ws_teste_agenda_*) e limpeza das próprias linhas — o Supabase é compartilhado"

requirements-completed: [AUTO-01]

# Metrics
duration: 52min
completed: 2026-09-22
---

# Phase 03 Plan 01: Agenda do motor de Automações Summary

**`plataforma.automacao_agenda` aplicada no Supabase da plataforma — PK `(workspace_id, list_id, dia_civil)` como invariante do banco, lease por `for update skip locked`, e as três garantias do Plan 03-08 provadas contra o Postgres real sem inventar uma segunda fonte de verdade para a idempotência.**

## Performance

- **Duration:** 52 min (Task 1 → Task 3; o checkpoint humano da Task 2 não está contado)
- **Started:** 2026-09-23T01:41:42Z (commit da Task 1)
- **Completed:** 2026-09-23T02:33:07Z (commit da Task 3)
- **Tasks:** 3 (uma delas checkpoint humano bloqueante)
- **Files modified:** 3

## Accomplishments

- Migração `005-agenda-de-automacoes.sql` escrita no estilo de `003`: uma tabela, comentário de bloco explicando o invariante antes do `create table`, `if not exists` em tabela e índice, nenhum `drop`.
- Migração **aplicada de verdade** no projeto Supabase da plataforma (`epomplsskqpluxuujpxl`, DEC-08) e registrada em `plataforma.migracoes`; segunda execução confirmada no-op.
- Quatro casos de integração contra o Postgres real provam o que o Plan 03-08 vai assumir sem checar: chave composta recusa o segundo registro do mesmo dia, duas conexões simultâneas produzem exatamente uma reivindicação, `estado` fora do `check` é recusado, e o dia preso em `processando` volta a `falhou` e é retomado.
- `apps/api/src/persistencia/CONTEXT.md` ganhou a seção que impede a confusão mais cara possível aqui — alguém tratar a tabela como registro de "isto já rodou" e criar uma segunda fonte de verdade ao lado de `AutomationExecution`.

## Task Commits

1. **Task 1: Escrever a migração 005 (agenda do motor de Automações)** — `4d0dd52` (feat)
2. **Task 2: [BLOCKING] Aplicar a migração 005 no Supabase da plataforma** — sem commit (execução de comando, nenhum arquivo editado)
3. **Task 3: Teste de integração da agenda contra o Postgres real** — `c392a4e` (test)

_A Task 3 é `tdd="true"`, mas o ciclo RED/GREEN não se aplica aqui: o "código sob teste" é a própria migração, escrita na Task 1 e aplicada na Task 2 — um RED artificial exigiria desaplicar a migração do banco compartilhado. O commit é `test(...)` e não há `feat(...)` posterior por isso. Ver "TDD Gate Compliance" abaixo._

## Files Created/Modified

- `apps/api/migracoes/005-agenda-de-automacoes.sql` (novo) — `plataforma.automacao_agenda` + índice parcial `automacao_agenda_pendente`; comentários declaram o que a tabela NÃO é (idempotência), por que existe (exclusão mútua entre instâncias, auditoria do dia processado) e a proibição de dado sensível (T-3-04), mais a nota de rodapé de que a importação reusa `importacao_ledger`.
- `apps/api/src/persistencia/agenda-de-automacoes.test.ts` (novo) — os quatro casos; pula sem `DATABASE_URL`; usa duas conexões do mesmo `pool()` (nunca um `Pool` novo) e limpa as próprias linhas.
- `apps/api/src/persistencia/CONTEXT.md` (modificado) — seção `Agenda do motor de Automações (Fase 3)` e a nova entrada na tabela de arquivos.

## Checkpoint humano (Task 2)

A Task 2 era `checkpoint:human-action` bloqueante por um motivo concreto: os tipos deste projeto são escritos à mão, não gerados do banco, então `npm run typecheck`/`npm run build` passam mesmo com a migração não aplicada — verde falso. **O usuário executou `npm run migrar --workspace=@n1/api` no ambiente real.** Saída literal da primeira execução:

```
aplicada  005-agenda-de-automacoes.sql  (1388 ms)
```

E da segunda, confirmando idempotência do runner:

```
Nada a aplicar: o banco já está em dia.
```

Nenhum agente reexecutou o comando (o harness bloqueia migração/deploy para agentes neste projeto). A confirmação independente de que a tabela existe de fato no banco é o resultado da Task 3: os quatro casos passam contra o Postgres real — se a `005` não estivesse aplicada, todos falhariam com `relation "plataforma.automacao_agenda" does not exist`.

## Decisions Made

- **A tabela nunca responde "isto já rodou".** `runScheduledAutomations` já decide isso de forma pura por `jaRodou`/`AutomationExecution`. A agenda responde só "alguém já está processando este dia". Duplicar o controle criaria duas fontes de verdade a manter sincronizadas — e a que fica no banco seria a que ninguém testa.
- **O SQL da reivindicação (e o da varredura de lease vencida) mora no teste, não em `src/`.** O scheduler-worker é o Plan 03-08; criar o módulo agora seria código sem chamador. O teste prova a garantia do banco, que é o que o 03-08 vai herdar.
- **`tentativas` incrementa na reivindicação**, como `attempts` em `outbox-worker.ts::reivindicar()` — o caso (b) usa isso para provar que a instância perdedora não tocou a linha (`tentativas = 1` depois de duas tentativas simultâneas).

## Deviations from Plan

Nenhuma. O plano foi executado como escrito: nenhum bug para corrigir (Rule 1), nenhuma funcionalidade crítica ausente (Rule 2), nenhum bloqueio (Rule 3), nenhuma mudança arquitetural (Rule 4). Nenhum pacote instalado — T-3-SC preservado.

Único ajuste de redação, sem efeito de comportamento: o cabeçalho do teste dizia "Nenhuma linha de `plataforma.registros` é tocada", o que fazia o critério de aceitação literal (`grep -c 'plataforma.registros'` = 0) falhar por causa da própria frase que afirmava o contrário do risco. Reescrito para "Nenhum caso aqui toca a tabela canônica de registros" — mesma garantia, mesma redação de `integracao.test.ts`.

## Verification

| Critério | Resultado |
|---|---|
| `npm run test -w @n1/api -- src/persistencia/agenda-de-automacoes.test.ts` com `DATABASE_URL` | 4 passed (1 file) |
| Mesmo comando com `DATABASE_URL=` vazio | 4 skipped, exit 0 |
| `grep -c 'plataforma.registros'` no teste | `0` |
| `grep -c 'new Pool'` no teste | `0` |
| `CONTEXT.md` contém `Agenda do motor de Automações (Fase 3)` e `clickup:901107637383` | 1 e 1 |
| `npm run check` com `DATABASE_URL` | verde — api 380 passed / 12 skipped (50 arquivos), web 107, dominio 355 |
| `npm run check` sem `DATABASE_URL` (CON-05) | verde, exit 0 — api 298 passed / 94 skipped, web 107, dominio 355 |
| `git diff --quiet packages/dominio apps/web` | sem diff nesta rodada |
| Migrações `001`–`004` imutáveis (DEC-10) | `git diff --quiet` sai 0 |

## Threat Model Compliance

| Threat | Disposição | Como ficou |
|---|---|---|
| T-3-04 (vazamento em `last_error_summary`) | mitigate | `comment on column` nas duas colunas de erro declara que só recebem a saída de `sanitizarErro()`; nenhuma coluna da tabela guarda CPF, CNPJ, Pix, código de barras, valor ou fornecedor — a Tarefa é identificada só por `list_id`/`dia_civil` |
| T-3-05 (duas instâncias no mesmo dia) | mitigate | índice parcial + `for update skip locked` + `locked_by`/`locked_at`, provado pelo caso (b): duas conexões simultâneas, uma só reivindicação |
| T-3-06 (dia processado duas vezes) | mitigate | PK `(workspace_id, list_id, dia_civil)`, provada pelo caso (a); idempotência de negócio permanece em `AutomationExecution` |
| T-3-02 (ledger duplicado) | mitigate | nenhuma tabela nova; a convenção `origem = 'clickup:901107637383'` está escrita na migração e no CONTEXT.md |
| T-3-SC (instalação de pacote) | accept | nenhum pacote instalado nesta rodada |

## TDD Gate Compliance

A Task 3 está marcada `tdd="true"` e o histórico tem o commit `test(...)` (`c392a4e`), mas **não** um `feat(...)` posterior fechando o GREEN. Não é lacuna: o artefato sob teste é a migração `005`, escrita na Task 1 (`4d0dd52`) e aplicada no banco na Task 2 antes de o teste existir. Um RED honesto exigiria desaplicar a `005` do Supabase compartilhado — impossível sob DEC-10 (migração aplicada é imutável) e destrutivo para qualquer outra sessão no mesmo banco. O sinal de que o teste testa algo real continua existindo: sem a `005` aplicada, os quatro casos falham em `relation does not exist`, e foi exatamente esse o estado do banco até a Task 2.

## Issues Encountered

- `npm run check` completo leva ~10 min porque a suíte do `apps/api` roda 380 casos contra o Supabase real (578 s só o `apps/api`). Uma segunda execução estourou o limite de 600 s da ferramenta e foi encerrada; a verificação foi refeita em partes (suíte do `apps/api` isolada + `check` completo sem `DATABASE_URL`), com os dois resultados registrados na tabela acima. Não é falha do plano, é o custo de testar contra banco remoto — vale registrar para quem for planejar a verificação da fase.

## Known Stubs

Nenhum. A migração e o teste são completos; o que não existe ainda (o scheduler-worker que consome a agenda) é o escopo declarado do Plan 03-08, não um stub deste plano.

## Next Phase Readiness

- **Plan 03-08 (motor de Automações) desbloqueado:** a tabela existe no banco, o índice de reivindicação existe, e o SQL de lease está escrito e provado em `agenda-de-automacoes.test.ts` — o worker pode copiá-lo em vez de redescobri-lo. A varredura que devolve lease vencida a `falhou` precisa virar código no 03-08; hoje ela só existe dentro do caso (d).
- **Plans 03-09/03-10 (importação histórica):** a convenção `origem = 'clickup:901107637383'` sobre `plataforma.importacao_ledger` está registrada nos dois lugares que alguém lê antes de criar tabela (a migração e o CONTEXT.md da pasta).
- **Sem bloqueio novo.** `rejectUnauthorized: false` em `conexao.ts` segue como preocupação herdada da Fase 1, não introduzida aqui.

## Self-Check: PASSED

- `apps/api/migracoes/005-agenda-de-automacoes.sql` — existe
- `apps/api/src/persistencia/agenda-de-automacoes.test.ts` — existe
- `apps/api/src/persistencia/CONTEXT.md` — existe (modificado)
- `.planning/phases/03-contas-a-pagar/03-01-SUMMARY.md` — existe
- Commits `4d0dd52` e `c392a4e` — presentes no histórico

---
*Phase: 03-contas-a-pagar*
*Completed: 2026-09-22*
