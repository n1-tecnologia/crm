---
phase: 05-contas-a-receber-e-os-outros-tenants
plan: 22
subsystem: api+dominio
tags: [importacao, contas-a-receber, clickup, civildate, cr-06, auditoria, cli]

# Dependency graph
requires:
  - phase: 05-contas-a-receber-e-os-outros-tenants
    provides: "05-16 — instanteDaDataDePagamento + comoDiaCivil (America/Sao_Paulo), a precedência e o fuso que esta correção reusa sem reimplementar"
  - phase: 05-contas-a-receber-e-os-outros-tenants
    provides: "05-17 — semEventosDeSaida na Unidade de Trabalho, a trava que impede qualquer correção de dado de acordar Automação ou gravar outbox"
  - phase: 05-contas-a-receber-e-os-outros-tenants
    provides: "05-11 — as 240 Contas a receber históricas já importadas em ws_n1, o dado que esta correção audita"
provides:
  - "corrigirDataDePagamentoImportada (@n1/dominio/operations/importacao-contas-a-receber) — operação auditada, Criar-ou-conferir aplicado a dado: só corrige a Data de pagamento quando o valor ativo é EXATAMENTE o dia UTC errado conhecido; disponível para qualquer caso futuro de dado torto, não só para as 240 de hoje"
  - "levantarCorrecoes / aplicarCorrecoes (apps/api/.../corrigir-data-de-pagamento-cr.ts) — relatório somente-leitura e correção com dry-run por padrão contra ws_n1, usando a MESMA precedência e o MESMO fuso da importação (05-16)"
  - "CR-06, a metade 'dados', FECHADA: as 240 Contas a receber já importadas em ws_n1 não têm NENHUMA Data de pagamento no dia UTC errado — confirmado pelo CLI E por uma conferência independente direta contra o export"
affects: [REC-01, "05-25 (relógio de Contas a receber — a Data de pagamento das 240 já está correta antes de qualquer leitura temporal sobre ela)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Correção de dado auditada reusa a MESMA função pura de precedência da importação (instanteDaDataDePagamento) em vez de reinterpretar o export — uma correção nunca pode divergir da regra que gravou o dado errado"
    - "O levantamento (puro, sem I/O) é recalculado DENTRO da própria transação de --apply, nunca confiando num levantamento pré-transação que pode estar velho — tudo ou nada: uma recusa inesperada de qualquer correção individual desfaz a transação inteira"
    - "Criar-ou-conferir aplicado a DADO (não só a configuração): só sobrescreve quando o valor ativo é exatamente o valor errado conhecido; qualquer outro valor é 'divergente' e nunca é tocado"

key-files:
  created:
    - apps/api/src/importacao/clickup/corrigir-data-de-pagamento-cr.ts
    - apps/api/src/importacao/clickup/corrigir-data-de-pagamento-cr.cli.ts
    - apps/api/src/importacao/clickup/corrigir-data-de-pagamento-cr.test.ts
  modified:
    - packages/dominio/src/operations/importacao-contas-a-receber.ts
    - packages/dominio/src/operations/importacao-contas-a-receber.test.ts
    - apps/api/package.json

key-decisions:
  - "afetadas = 0 (nas duas origens, Campo e date_closed) fecha o ramo declarado pelo próprio plano ('Se afetadas = 0: registre \"CR-06 não atingiu nenhuma das 240\" e PULE para o passo 7 — nada a aplicar') — nenhum --apply foi executado, nem era necessário. Nenhuma Data de pagamento das 240 Contas a receber já importadas está no dia UTC errado."
  - "Conferência independente pelo orquestrador, direta contra o export em disco (apps/api/exportacoes/clickup/901107648977, tasks + tasks-arquivadas = 240): 175 Tarefas com o Campo \"Data de pagamento\" preenchido e 16 só com date_closed — 191 no total, batendo exatamente com o \"com Data de pagamento 191\" que a CLI relatou. Dos instantes resolvidos (Campo ou date_closed), ZERO caem na janela de hora UTC < 3h (a janela onde o dia UTC diverge do dia de São Paulo) — 0 pelo Campo, 0 por date_closed. Duas fontes independentes (a CLI e a leitura direta do export) concordam: o defeito de CR-06 nunca se materializou nas 240 linhas reais, mesmo as 16 que usaram o fallback date_closed."
  - "A operação `corrigirDataDePagamentoImportada` e a CLI ficam disponíveis mesmo sem uso imediato: se uma reimportação futura, uma correção manual malfeita ou um novo lote de dados históricos algum dia gravar um dia UTC errado numa Conta a receber importada, o caminho auditado já existe — não precisa ser escrito de novo."

requirements-completed: []  # REC-01 segue aberta: este plano fecha só a metade "dados" de CR-06 (um achado de 05-REVIEW.md), não o requisito inteiro — ver "Next Phase Readiness".

# Metrics
duration: ~50min
completed: 2026-09-24
---

# Phase 5 Plan 22: CR-06 fechado — as 240 Contas a receber já importadas em ws_n1 não têm nenhuma Data de pagamento no dia UTC errado Summary

**`corrigirDataDePagamentoImportada` (operação auditada) e o CLI `contas-a-receber:corrigir-data-pagamento` (dry-run por padrão) existem e provam, contra `ws_n1`, que nenhuma das 240 Contas a receber já importadas precisa de correção — confirmado por duas fontes independentes.**

## Performance

- **Duration:** ~50 min
- **Tasks:** 2 de 2 (Task 1 código, commitada; Task 2 checkpoint bloqueante, resolvido sem `--apply`)
- **Files modified:** 3 modificados + 3 criados

## Accomplishments

- `corrigirDataDePagamentoImportada` (`packages/dominio/src/operations/importacao-contas-a-receber.ts`) — a operação de domínio auditada: recusa Tarefa ausente, recusa Tarefa sem proveniência de importação de Contas a receber, recusa `esperadoAtual === corrigido`, e recusa (sem gravar) quando o valor ativo do Campo "Data de pagamento" não é EXATAMENTE `esperadoAtual` — só nesse caso final grava, via `setTaskFieldValue`, com um Registro de Atividade explícito (`before`/`after`/`detail: "CR-06"`), zero Automação disparada.
- `levantarCorrecoes` (`apps/api/src/importacao/clickup/corrigir-data-de-pagamento-cr.ts`) — puro, sem I/O: relê cada Tarefa do export com `instanteDaDataDePagamento` (a MESMA precedência de D5-16), compara o dia UTC (o que a importação antiga cortou) com o dia civil de São Paulo (`comoDiaCivil`, a correção de 05-16), e quando divergem localiza a Tarefa em `ws_n1` e classifica `corrigir`/`divergente`/`nao-encontrada` pelo valor ATIVO do Campo agora.
- `aplicarCorrecoes` — dry-run hidrata num `begin`/`rollback` e só levanta; `--apply` roda UMA `executar(..., { semEventosDeSaida: true })` que recalcula o levantamento sobre o estado da própria transação e aplica cada `corrigir` — tudo ou nada.
- CLI `npm run contas-a-receber:corrigir-data-pagamento -w @n1/api` — dry-run por padrão, `--apply` explícito, saída só com contagens/categorias/datas (nunca nome de cliente, título de Tarefa ou valor monetário); detalhe por linha (com `legacyTaskId`) fora do git, sob a pasta do export.
- **Resultado contra produção:** o dry-run rodado no checkpoint (Task 2) devolveu `afetadas = 0` nas duas origens (Campo e `date_closed`) — nenhuma das 240 Contas a receber já importadas em `ws_n1` tem a Data de pagamento no dia UTC errado. `--apply` não foi executado (não havia o que aplicar). Uma conferência independente do orquestrador, direta contra o export em disco, confirma o mesmo resultado por um caminho totalmente separado (ver "Checkpoint e verificação" abaixo).

## Task Commits

1. **Task 1: A operação auditada e o levantamento somente-leitura** — `e850eab` (feat) — `feat(05-22): corrigirDataDePagamentoImportada + levantamento somente-leitura de ws_n1 (CR-06)` — `packages/dominio/src/operations/importacao-contas-a-receber.ts`, `importacao-contas-a-receber.test.ts`, `apps/api/src/importacao/clickup/corrigir-data-de-pagamento-cr.ts`, `corrigir-data-de-pagamento-cr.cli.ts`, `corrigir-data-de-pagamento-cr.test.ts`, `apps/api/package.json`.
2. **Task 2: [BLOCKING] Corrigir as Datas de pagamento em `ws_n1`** — sem commit de código (operação/relatório, não implementação). Resolvida com `afetadas = 0`: nenhum `--apply` executado, per o próprio ramo que o plano declara para este caso ("Se `afetadas = 0`: registre... e PULE para o passo 7 — nada a aplicar").

**Plan metadata:** commit deste SUMMARY (a seguir).

## Files Created/Modified

- `packages/dominio/src/operations/importacao-contas-a-receber.ts` — `corrigirDataDePagamentoImportada` (nova), com o cabeçalho explicando por que reusa `setTaskFieldValue` em vez de escrever `fieldValues` direto.
- `packages/dominio/src/operations/importacao-contas-a-receber.test.ts` — 4 novos casos: correção bem-sucedida (Campo, Registro `before`/`after`/`CR-06`, zero Execuções novas), divergência (Campo já mudado à mão → recusa, Campo inalterado), Tarefa sem proveniência de importação de Contas a receber → recusa, `esperadoAtual === corrigido` → recusa.
- `apps/api/src/importacao/clickup/corrigir-data-de-pagamento-cr.ts` (novo) — `levantarCorrecoes`, `aplicarCorrecoes`, `CorrecaoDeDataDePagamento`, `SituacaoDaCorrecao`.
- `apps/api/src/importacao/clickup/corrigir-data-de-pagamento-cr.cli.ts` (novo) — CLI dry-run/`--apply`, molde fino de `importar-contas-a-receber.cli.ts`.
- `apps/api/src/importacao/clickup/corrigir-data-de-pagamento-cr.test.ts` (novo) — `levantarCorrecoes` puro, com tarefas sintéticas cobrindo as quatro situações e as duas fronteiras de fuso (02:59:59Z/03:00:00Z).
- `apps/api/package.json` — script `contas-a-receber:corrigir-data-pagamento`, acrescentado sem tocar `outbox:limpar-testes` (de 05-19).

## Decisions Made

Ver `key-decisions` no frontmatter. Resumo: `afetadas = 0` fecha o ramo "nada a aplicar" que o próprio plano previu; a conferência independente do orquestrador (ver abaixo) confirma o resultado por um caminho separado da CLI; a operação e a CLI ficam disponíveis para qualquer caso futuro de dado torto, sem uso imediato necessário hoje.

## Checkpoint e verificação (Task 2)

### Dry-run da CLI (checkpoint, main checkout, sem `--apply`)

```
run · modo dry-run · workspace ws_n1 · pasta /Users/TRIA2026/Projetos/Projetos Cursor/crm-n1/apps/api/exportacoes/clickup/901107648977/
run 73f968e5-ce29-4fd4-a3c2-85af5e82290c
lidas 240 · com Data de pagamento 191
afetadas por origem: {"campo":0,"date_closed":0}
corrigir 0 · divergente 0 · nao-encontrada 0
detalhe por linha (fora do git): /Users/TRIA2026/Projetos/Projetos Cursor/crm-n1/apps/api/exportacoes/clickup/901107648977/correcao-data-de-pagamento/73f968e5-ce29-4fd4-a3c2-85af5e82290c/correcoes.log
Nada a corrigir — dry-run idempotente (ou nenhuma das 240 foi afetada).
===EXIT=0===
```

`lidas 240` bate com as 240 Tarefas reais da importação (05-11). `afetadas = 0` nas duas origens — nenhuma correção a fazer.

### Conferência independente do orquestrador (direta contra o export, fora da CLI)

Leitura direta de `apps/api/exportacoes/clickup/901107648977` (`tasks` + `tasks-arquivadas` = 240):

| Métrica | Valor |
|---|---|
| Tarefas com o Campo "Data de pagamento" preenchido | 175 |
| Tarefas só com `date_closed` (fallback) | 16 |
| Total com Data de pagamento resolvível | **191** — bate exatamente com o "com Data de pagamento 191" da CLI |
| Instantes (Campo OU `date_closed`) com hora UTC < 3h (a janela em que o dia UTC diverge do dia de São Paulo) | **0 pelo Campo · 0 por `date_closed`** |

Duas fontes independentes — a CLI (que reusa `instanteDaDataDePagamento`/`comoDiaCivil` de 05-16) e a leitura direta do orquestrador contra o export — concordam: o defeito de CR-06 (dia UTC cortado em vez do dia civil de São Paulo) nunca se materializou nas 240 linhas reais, nem mesmo nas 16 que caíram no fallback `date_closed`. **Situação: "CR-06 não atingiu nenhuma das 240".**

### `--apply`

**Não executado.** Não havia o que aplicar (`corrigir = 0`). O `--apply` que `aplicarCorrecoes` roda (`executar(workspaceId, ..., { semEventosDeSaida: true })`) continua disponível — recalcularia o levantamento dentro da própria transação e aplicaria cada `corrigir`, tudo ou nada — para o caso de um dado futuro precisar da mesma correção.

## Issues Encountered

Nenhum. A única correção de forma foi ao longo da própria Task 1: os comentários do arquivo `corrigir-data-de-pagamento-cr.ts` inicialmente repetiam o literal `semEventosDeSaida: true` em dois lugares além do código real, o que inflaria o grep de aceitação (`grep -c "semEventosDeSaida: true"` = 1 esperado); reescritos para descrever a trava sem repetir o literal — mesma disciplina que 05-17 já registrou para o mesmo tipo de grep.

## User Setup Required

None — nenhuma configuração externa necessária. Nenhuma Data de pagamento foi alterada em `ws_n1` (não havia o que alterar).

## Next Phase Readiness

- **CR-06 (a metade "dados", achado de `05-REVIEW.md`) está fechado**: as 240 Contas a receber já importadas em `ws_n1` não têm nenhuma Data de pagamento no dia UTC errado, confirmado por dois caminhos independentes.
- **REC-01 continua aberta** — este plano fechou só um achado pontual (CR-06/dados) dentro do fechamento de lacunas D5-21, não o requisito inteiro de Contas a receber. `requirements-completed` fica vazio de propósito, mesma disciplina que `05-11-SUMMARY.md` já registrou ("este plano não marca a requirement como concluída porque ela realmente não está").
- `corrigirDataDePagamentoImportada` e o CLI ficam prontos, testados e sem uso pendente: se uma futura reimportação ou correção manual algum dia gravar um dia UTC errado numa Conta a receber importada, o caminho auditado já existe.
- 05-25 (relógio de Contas a receber, ainda não iniciado) pode assumir que a Data de pagamento das 240 Tarefas históricas já é a correta — nenhuma leitura temporal futura herda o defeito de CR-06.

---
*Phase: 05-contas-a-receber-e-os-outros-tenants*
*Completed: 2026-09-24*

## Self-Check: PASSED

Todos os arquivos citados (criados/modificados) confirmados em disco com `[ -f ... ]`: `packages/dominio/src/operations/importacao-contas-a-receber.ts`, `apps/api/src/importacao/clickup/corrigir-data-de-pagamento-cr.ts`, `.cli.ts`, `.test.ts`, e este próprio `05-22-SUMMARY.md`. O commit de Task 1 (`e850eab`) confirmado em `git log --oneline --all`. Nenhum item faltando.
