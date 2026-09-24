---
phase: 05-contas-a-receber-e-os-outros-tenants
plan: 21
subsystem: api
tags: [outbox, postgres, canal, whatsapp, wr-04, migration, unique-index]

# Dependency graph
requires:
  - phase: 05-contas-a-receber-e-os-outros-tenants (Plan 13)
    provides: "aggregateId = `<executionId>:<indicePasso>` no evento de outbox de Canal (WR-04, lado da ponte) — a chave que o índice único deste plano usa"
  - phase: 05-contas-a-receber-e-os-outros-tenants (Plan 17)
    provides: "a derivação obrigatória de `automacao.notificar-canal.v1` em `unidade-de-trabalho.ts::executar()` — sem ela, a rota poderia gravar o evento duas vezes e o índice derrubaria operações legítimas"
  - phase: 05-contas-a-receber-e-os-outros-tenants (Plan 19)
    provides: "as órfãs de teste removidas do outbox real, para o dry-run de duplicidade deste plano olhar só dado real"
provides:
  - "índice único parcial `plataforma.integration_outbox_notificar_canal_uniq` (workspace_id, aggregate_type, aggregate_id, event_type) where event_type = 'automacao.notificar-canal.v1' — aplicado em produção"
  - "prova com banco (integracao.test.ts, caso (a2)): mesmo passo colide, passo diferente ou Espaço diferente é aceito"
  - "comentário de outbox.ts corrigido — 004 para solicitacao.criada.v1, 006 para Canal, nunca mais 'migração 003'"
affects: ["qualquer plano futuro que toque automacao.notificar-canal.v1 ou o outbox de Canal pode contar com a barreira do banco, não só do código"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Barreira de duplicidade de evento de saída como índice único parcial do banco (mesmo padrão de 004 para solicitacao.criada.v1), não só checagem em código — uma corrida ou um bug de derivação em dobro vira erro de transação (rollback), nunca mensagem duplicada"

key-files:
  created:
    - apps/api/migracoes/006-outbox-indice-unico-canal.sql
  modified:
    - apps/api/src/persistencia/integracao.test.ts
    - apps/api/src/persistencia/outbox.ts

key-decisions:
  - "O comentário da migração 006 explica as três coisas que WR-04 encontrou: a promessa da migração 003 nunca existiu no banco para Canal, por que aggregate_id é `<executionId>:<indicePasso>` (dois passos de Canal na mesma Execução são dois eventos legítimos), e por que a chave inclui workspace_id (mesma razão de 004 — resetIdSequence/syncIdSequence reposicionam por Espaço hidratado)."
  - "O caso de teste (a2) usa um segundo Espaço de Trabalho (WORKSPACE_OUTRO) só para provar que workspace_id está na chave — o mesmo aggregate_id em dois Espaços não colide. limparTudo() foi estendido para apagar os dois Espaços."
  - "O teste (a2) foi commitado na Task 1 mas deliberadamente NÃO executado nela — só roda (e só pode passar) depois da migração aplicada, exatamente como o plano instrui; a primeira execução real dele foi no checkpoint, depois do --apply do dono do produto."

requirements-completed: [AUTO-02]

# Metrics
duration: ~40min (Task 1: leitura + migração + teste + comentário + commit; Task 2: dry-run somente-leitura, autorização e --apply do dono, confirmação por leitura, suíte de teste 2x + regressão)
completed: 2026-09-24
---

# Phase 05 Plan 21: Migração 006 — índice único do evento de Canal no outbox (WR-04) Summary

**`plataforma.integration_outbox_notificar_canal_uniq` existe em produção: um segundo evento `automacao.notificar-canal.v1` para o mesmo `(workspace_id, aggregate_id)` agora viola a constraint e desfaz a transação, em vez de mandar o aviso de WhatsApp duas vezes — a garantia que o comentário do código já prometia, agora real no banco.**

## Performance

- **Duration:** ~40 min (Task 1 ativa: leitura dos moldes de 003/004, criação da migração, do caso de teste e da correção do comentário, typecheck+lint, commit. Task 2: dry-run somente-leitura, parada para autorização e `--apply` do dono do produto — bloqueado para o agente pelo classificador de permissão, mesma classe de bloqueio de 05-19/05-20 — confirmação por leitura, suíte de teste 2x + regressão)
- **Completed:** 2026-09-24
- **Tasks:** 2/2 (Task 2 é `checkpoint:human-verify`, `gate="blocking-human"` — a escrita em produção foi do dono do produto, não do agente)
- **Files modified:** 3 (1 criado, 2 modificados) — bate com `files_modified` do frontmatter do plano

## Accomplishments

- **WR-04, a barreira de banco (Task 1).** `apps/api/migracoes/006-outbox-indice-unico-canal.sql` cria `integration_outbox_notificar_canal_uniq` — índice único parcial sobre `(workspace_id, aggregate_type, aggregate_id, event_type) where event_type = 'automacao.notificar-canal.v1'`, no mesmo molde de comentário longo da migração 004. Nenhuma linha alterada; nenhum outro índice tocado.
- **Prova com banco (Task 1, executada no checkpoint da Task 2).** `integracao.test.ts` ganhou o caso `(a2)`: dois inserts do mesmo `(workspace, aggregate_type='automationExecution', aggregate_id='exe_x:0', event_type='automacao.notificar-canal.v1')` — o segundo lança violação de unicidade; `aggregate_id='exe_x:1'` (outro passo, mesma Execução) é aceito; o mesmo `aggregate_id` num segundo Espaço de Trabalho é aceito (prova que `workspace_id` está na chave). O caso foi commitado na Task 1 mas só rodou de fato depois da migração aplicada, como o plano exige.
- **Comentário honesto (Task 1).** `outbox.ts` deixou de atribuir a barreira de "um evento por agregado" só à "migração 003" — agora diz explicitamente que `solicitacao.criada.v1` é coberto pela 004 e `automacao.notificar-canal.v1` pela 006.
- **A migração foi aplicada em produção (Task 2), sob autorização do dono do produto** — ver o registro completo do checkpoint abaixo.

## Task Commits

Each task was committed atomically:

1. **Task 1: A migração 006, o teste do índice e o comentário honesto** - `4708ee5` (feat)
2. **Task 2: [BLOCKING] Aplicar a migração 006 no Postgres de produção** — operação em produção, sem arquivo versionado além do que a Task 1 já commitou (o `--apply` em si não gera commit neste repositório).

**Plan metadata:** commit deste SUMMARY (a seguir).

## Files Created/Modified

- `apps/api/migracoes/006-outbox-indice-unico-canal.sql` (novo) — índice único parcial `integration_outbox_notificar_canal_uniq`, comentário explicando o que WR-04 encontrou, por que `aggregate_id` é `<executionId>:<indicePasso>`, por que a chave inclui `workspace_id`, e o efeito (segundo insert do mesmo evento derruba a transação).
- `apps/api/src/persistencia/integracao.test.ts` — `WORKSPACE_OUTRO` acrescentado; `limparTudo()` limpa os dois Espaços; caso `(a2)` novo provando unicidade por passo e por Espaço.
- `apps/api/src/persistencia/outbox.ts` — doc de `aggregateType`/`aggregateId` corrigido: 004 para `solicitacao.criada.v1`, 006 para Canal.

## Checkpoint (Task 2) — dry-run, autorização, `--apply`, confirmação

**1. Dry-run somente-leitura (checkout principal, script descartável `apps/api/src/persistencia/_dry-run-006-temp.ts` — só `select`s via `pool()`/`carregarEnv()` de `./conexao`, apagado ao final, molde de 05-11/05-19):**

```
=== (a) plataforma.migracoes aplicadas ===
001-plataforma.sql
002-registros-colunas-geradas.sql
003-integracao-e-importacao.sql
004-outbox-indice-unico-por-workspace.sql
005-agenda-de-automacoes.sql

=== arquivos em apps/api/migracoes/ ===
001-plataforma.sql
002-registros-colunas-geradas.sql
003-integracao-e-importacao.sql
004-outbox-indice-unico-por-workspace.sql
005-agenda-de-automacoes.sql
006-outbox-indice-unico-canal.sql

=== PENDENTES (arquivos - aplicadas) ===
006-outbox-indice-unico-canal.sql
total pendentes: 1

=== (b) duplicidade de Canal (precisa ser ZERO linhas) ===
linhas com duplicidade: 0

=== (c) contagem de eventos de Canal ===
total (todo o banco): 0
total (ws_n1): 0

=== bônus: índice já existe? (deve ser 0 antes da migração) ===
linhas: 0
===EXIT=0===
```

(a) confirma 001–005 já aplicadas e **006 como a única pendente**. (b) devolveu **zero linhas** — nenhuma linha existente violaria o índice. (c) mostrou 0 eventos de Canal em todo o banco (0 em `ws_n1`), contexto consistente com 05-19 (órfãs de teste já removidas, `ws_n1` sem pendências).

**2. Autorização e `--apply` — executados pelo DONO DO PRODUTO manualmente** (o classificador de permissão do agente bloqueia escrita de produção, mesma classe de bloqueio já registrada em 05-19/05-20). O dono leu o dry-run acima (006 única pendente, 0 duplicidades) e rodou o comando ele mesmo no checkout principal, em **2026-09-24**. Saída colada verbatim pelo orquestrador:

```
> @n1/api@0.1.0 migrar
> vite-node src/persistencia/migrar.cli.ts

aplicada  006-outbox-indice-unico-canal.sql  (757 ms)
```

O executor (eu) não rodou `npm run migrar` nenhuma vez, nem tentou nenhuma escrita de produção por caminho alternativo.

**3. Confirmação por leitura (executor, script descartável `_confirm-006-temp.ts`, apagado ao final — sem rodar `npm run migrar` de novo):**

```
=== (1) pg_indexes: integration_outbox_notificar_canal_uniq ===
linhas: 1
{
  indexname: 'integration_outbox_notificar_canal_uniq',
  indexdef: "CREATE UNIQUE INDEX integration_outbox_notificar_canal_uniq ON plataforma.integration_outbox USING btree (workspace_id, aggregate_type, aggregate_id, event_type) WHERE (event_type = 'automacao.notificar-canal.v1'::text)"
}

=== (2) plataforma.migracoes — 006 registrada? ===
001-plataforma.sql 2026-09-15T17:42:04.608Z
002-registros-colunas-geradas.sql 2026-09-16T14:20:46.713Z
003-integracao-e-importacao.sql 2026-09-21T14:26:01.334Z
004-outbox-indice-unico-por-workspace.sql 2026-09-21T17:17:57.306Z
005-agenda-de-automacoes.sql 2026-09-23T02:03:12.884Z
006-outbox-indice-unico-canal.sql 2026-09-24T20:22:18.104Z
006 registrada: true
===EXIT=0===
```

O índice existe com o `where` de Canal exato; `plataforma.migracoes` registra `006-outbox-indice-unico-canal.sql` — equivalente ao "Nada a aplicar" de uma segunda chamada de `npm run migrar`, sem rodar essa escrita de novo.

**4. Suíte de teste — `integracao.test.ts` DUAS vezes seguidas, `--testTimeout=60000`:**

```
Run 1: Test Files 1 passed (1) | Tests 7 passed (7) | Duration 9.22s  ===EXIT=0===
Run 2: Test Files 1 passed (1) | Tests 7 passed (7) | Duration 9.48s  ===EXIT=0===
```

7/7 nas duas — 6 casos pré-existentes + o caso `(a2)` novo desta plano, todos verdes, sem nenhum `skip`. O caso `(a2)` é a primeira prova real, contra Postgres de produção, de que o índice recusa o segundo evento do mesmo passo e aceita passo/Espaço diferente.

**5. Regressão — `outbox.test.ts` e `eventos-de-canal.test.ts`, uma vez cada:**

```
outbox.test.ts:          Test Files 1 passed (1) | Tests 7 passed (7)  | Duration 18.22s  ===EXIT=0===
eventos-de-canal.test.ts: Test Files 1 passed (1) | Tests 10 passed (10) | Duration 472ms  ===EXIT=0===
```

Nenhuma regressão nas duas suítes que também tocam `integration_outbox`/eventos de Canal.

**Nenhum script descartável ficou no repositório** — `_dry-run-006-temp.ts` e `_confirm-006-temp.ts` foram apagados logo depois de cada leitura; `git status --short` em `apps/api/src/persistencia/` e `apps/api/migracoes/` confirma limpo (só os três arquivos versionados da Task 1).

## Decisions Made

Ver `key-decisions` no frontmatter. Resumo: o comentário da migração cobre as três perguntas que WR-04 levantou; o caso `(a2)` usa um segundo Espaço só para provar `workspace_id` na chave; o caso foi commitado antes de rodar de propósito, e sua primeira execução real aconteceu só depois do `--apply`.

## Deviations from Plan

None — plano executado exatamente como escrito. Task 1 committed and verified per its own `<verify>`/`<acceptance_criteria>`; Task 2's checkpoint ran read-only dry-run → owner authorization → owner-executed `--apply` → read-only confirmation → test suite, exactly the sequence the plan's `<how-to-verify>` specifies. No auto-fixes were needed.

## Issues Encountered

- **Mesma classe de bloqueio de permissão já registrada em 05-19/05-20:** o classificador de modo automático do agente recusa qualquer tentativa de escrita de produção (`npm run migrar -w @n1/api` incluso), independentemente de autorização do dono já registrada. Isso é esperado e por design — o objetivo desta execução foi explícito em nunca tentar essa escrita por nenhum caminho. O dono do produto rodou o comando manualmente no checkout principal e colou a saída verbatim (repassada pelo orquestrador), documentada acima.

## User Setup Required

None — nenhuma configuração de serviço externo, nenhuma variável de ambiente nova. A única operação de produção deste plano (aplicar a migração 006) já está concluída e confirmada acima.

## Next Phase Readiness

- A barreira de duplicidade de aviso de WhatsApp por Canal é agora garantia do banco, não só do código — qualquer bug futuro de derivação em dobro vira erro de transação visível, nunca mensagem repetida silenciosa.
- Nenhum bloqueio para outros planos desta fase; WR-04 está fechado.

## Self-Check: PASSED

- `apps/api/migracoes/006-outbox-indice-unico-canal.sql` encontrado em disco.
- Commit `4708ee5` (Task 1) encontrado em `git log --oneline --all`.
- Índice `integration_outbox_notificar_canal_uniq` confirmado em `pg_indexes` (produção) com o `where` de Canal correto.
- `plataforma.migracoes` confirma `006-outbox-indice-unico-canal.sql` registrada (aplicada em 2026-09-24T20:22:18.104Z).
- `integracao.test.ts` 7/7 verde em duas execuções seguidas contra o Postgres de produção pós-migração; `outbox.test.ts` (7/7) e `eventos-de-canal.test.ts` (10/10) sem regressão.
- Nenhum script descartável remanescente em `apps/api/src/persistencia/` (verificado por `git status --short`).

---
*Phase: 05-contas-a-receber-e-os-outros-tenants*
*Completed: 2026-09-24*
