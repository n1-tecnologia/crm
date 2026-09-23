# Deferred Items — Phase 04

Items found out of scope during execution, logged per the SCOPE BOUNDARY rule
(not fixed, not touched).

## 04-03 — `apps/api/src/automacoes/scheduler-worker.test.ts` falha pré-existente

**Encontrado durante:** Task 3, ao rodar `npm run check` completo.

**O que falha:** `liberar.cli.ts — validação de argumentos (sem banco) > (s) sem
argumentos, termina com código diferente de zero e uma mensagem que diz o que
falta` — `expect(saida).toContain("uso:")` recebe `''` (saída vazia) em vez do
texto de uso esperado.

**Por que é fora de escopo:** o plano 04-03 só toca
`apps/web/src/features/financeiro/*` e `apps/web/src/features/shell/*`.
`scheduler-worker.test.ts` foi tocado pela última vez no Plan 03-08 (commits
`21cb3aa`/`981a067`), fase anterior. Reproduzido isolado
(`npm run test -w @n1/api -- scheduler-worker`) com o mesmo resultado —
não é flake de execução concorrente. Provavelmente um efeito de ambiente deste
worktree/sandbox na captura de stdout de um processo filho (`rodarCli([])`
spawna o CLI de verdade), não uma regressão de código.

**Ação:** nenhuma — não corrigido, não commitado. `npm run check` nos três
workspaces roda com **1 teste falhando de 498** no total (`@n1/api`: 359
passed / 138 skipped / 1 failed); `@n1/web` (149/149) e `@n1/dominio`
(480/480) verdes. Registrado aqui para quem verificar a fase depois.
