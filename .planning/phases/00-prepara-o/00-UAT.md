---
status: complete
phase: 00-prepara-o
source: [00-VERIFICATION.md]
started: 2026-09-17T12:22:31Z
updated: 2026-09-17T12:40:38Z
---

## Current Test

[testing complete]

## Tests

### 1. Manifesto commitado bate com as contagens reais das 3 Listas no ClickUp
expected: Abrir no ClickUp as Listas 901109104938, 901107637383 e 901107648977 com filtro "incluir fechadas/arquivadas" e comparar o total com `tarefas + tarefasArquivadas` do `apps/api/exportacoes/MANIFESTO.md` (2.859+2 / 240 / 19); abrir 3 Tarefas por amostragem e conferir Comentários/anexos contra `apps/api/exportacoes/clickup/<lista>/`; confirmar em Settings › ClickApps que "Total time in Status" está ligado. Observação: a contagem de 19 da Lista 901109104938 já foi confirmada pelo conector ClickUp durante a execução.
result: pass

### 2. README de exportação é suficiente para repetir a operação sozinho
expected: Seguindo só `apps/api/README.md` § "4. Exportar o ClickUp", rodar `npm run exportar:clickup -w @n1/api -- --so-manifesto` e depois `git status`. O comando regenera MANIFESTO.md/.json a partir do disco sem exigir nada além do README; `git status` mostra no máximo os dois arquivos de manifesto (data/commit atualizados) e nada de `apps/api/exportacoes/clickup/`. Se quiser manter o manifesto commitado, descartar com `git checkout -- apps/api/exportacoes/MANIFESTO.*`.
result: pass

### 3. Conteúdo da spec valida contra o conhecimento do Financeiro
expected: Ler `docs/07-processos/solicitacao-de-pagamento.md` §3 (Status) e §4 (Campos) contra a Lista real e confirmar que não inventa Status/Campo; validar que as 5 lacunas de §12 (L-01, L-03, L-07, L-09, L-11) são as que genuinamente exigem conhecimento humano fora do sistema.
result: pass

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
