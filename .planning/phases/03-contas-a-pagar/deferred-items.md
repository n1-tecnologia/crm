# Deferred Items — Phase 03 (contas-a-pagar)

Achados fora do escopo da task/plano em execução no momento em que foram
encontrados. Não corrigidos por instrução da política de escopo do executor
("Only auto-fix issues DIRECTLY caused by the current task's changes").

## 2026-09-23 — 03-15, `npm run test -w @n1/api` — timeout em teste de 03-12

**Onde:** `apps/api/src/e2e/lote-contas-a-pagar.test.ts`, caso `(d) o piso e o
teto do lock (DEC-06) — tLote custa uma hidratação, tN custa 61`.

**O que aconteceu:** rodando a suíte completa de `@n1/api` (`DATABASE_URL`
carregado do `.env` do workspace, contra o Supabase real da plataforma), o
caso (d) — que mede o tempo de `alterarStatusEmLote` (61 contas, uma
transação) contra o tempo de 61 transações individuais (DEC-06) — estourou o
timeout de 180s do próprio `it()`. Os outros 55 arquivos e os outros 5 casos
do mesmo arquivo passaram; 475 testes verdes, 12 pulados (sem
`DATABASE_URL` de outra rodada), 1 falhou por timeout.

**Por que é fora de escopo de 03-15:** o plano 03-15 é `apps/web` inteiro —
`git diff --quiet packages/dominio apps/api` confirmado limpo antes e depois
das quatro tasks deste plano. O arquivo e o caso pertencem a 03-12
(fechamento em lote, PAG-05/DEC-06), que já registrou no próprio SUMMARY que
a medida definitiva contra `ws_n1` fica pendente até a importação real de
03-10 rodar (Task 4 de 03-10, ainda não executada — `importacao_ledger` para
`clickup:901107637383` = 0). A rodada isolada contra `ws_lote_teste` que
03-12 mediu deu `tLote` 45x–49x mais rápido que `tN`, com folga larga — o
timeout observado aqui é mais provável de ser latência de rede contra o
Supabase remoto neste ambiente/momento do que uma regressão de desempenho:
nenhuma linha de `packages/dominio` ou `apps/api` mudou entre a medida de
03-12 e esta execução.

**Ação tomada:** nenhuma correção — não é da posse deste plano. Registrado
aqui para quem retomar 03-12/03-10 Task 4; não bloqueia o fechamento de
03-15, cujo escopo é inteiramente `apps/web`.
