# Importação das Solicitações históricas (Plan 02-25) — 2026-09-25

Três manifestos, uma importação. Leia nesta ordem:

| Run | Modo | O que é |
|---|---|---|
| `de90b88f-…` | dry-run | Retrato completo da origem: 1.114 linhas lidas, 245 importáveis. |
| `957a5fdf-…` | apply | A importação. A 1ª execução gravou as páginas 1–12 (28 Tarefas) e parou na 13 por falta do bucket de anexos, sem manifesto. Este manifesto é o da retomada (`--resume`): 217 importadas + 451 linhas que a 1ª execução já tinha gravado ("duplicadas"). Total: **245**. |
| `1d3f0828-…` | apply | Reaplicação completa, prova de idempotência: 0 importadas, 843 duplicadas. |

Conferido no banco depois da importação: 245 Tarefas com `provenance.kind = "import"` na Lista, 843 linhas no ledger (`origem = 'clickup'`), `reconciliar` com `bateComOLedger: true` e `plataforma.integration_outbox` com 0 linhas antes e depois.
