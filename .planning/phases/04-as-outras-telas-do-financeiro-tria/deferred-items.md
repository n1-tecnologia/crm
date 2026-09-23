# Deferred Items — Phase 04 (as-outras-telas-do-financeiro-tria)

Achados fora de escopo registrados durante a execução, pela regra de SCOPE BOUNDARY
do executor. Nenhum foi corrigido pelo plano que o descobriu.

Os três itens abaixo vieram de agentes diferentes na Onda 1 e foram **reconciliados
pelo orquestrador**, que verificou cada um no checkout principal antes de aceitá-lo.
O veredito do orquestrador está marcado em cada item — dois dos três achados originais
não sobreviveram à verificação na forma em que foram relatados.

---

## 1. `payment-rules.test.ts` no `financeiro-tria` — CONFIRMADO, real

**Descoberto por:** Plano 04-01, rodando a suíte de `../financeiro-tria/automation`.

**O que falha:** `src/tenants/tria/payment-rules.test.ts:37` — caso "resolve responsavel
por centro de custo com fallback":

```
AssertionError [ERR_ASSERTION]: The input did not match the regular expression /FINQ/i.
Input: 'Elifas'
```

**Verificação do orquestrador:** reproduzido de forma independente com o runner do próprio
repositório (`npx tsx --test --test-concurrency=1 src/tenants/tria/payment-rules.test.ts`,
e não com vitest, que aquele pacote não usa): **7 testes, 6 passam, 1 falha**. Confirmado
pré-existente — `payment-rules.ts` e `payment-rules.test.ts` foram tocados por último em
`fc57b2d` e `9dc9680`, ambos anteriores à Fase 4, e os três commits do 04-01 só
acrescentam `fixture-financeiro.ts`, `leituras-plataforma-dtos.ts` e o teste de allowlist.

**Por que não foi corrigido:** `resolveResponsible` pertence ao subsistema de Solicitação
de pagamento (Fases 0/2), não à superfície de DTO/allowlist deste plano.

**Dono sugerido:** quem for mexer em `resolveResponsible` / `payment-rules.ts`.

---

## 2. `scheduler-worker.test.ts` no `apps/api` — REFUTADO, não é defeito

**Relatado por:** Plano 04-03, rodando `npm run check` de dentro do seu worktree.

**Relato original:** `liberar.cli.ts — validação de argumentos (sem banco)` falhando com
`expect(saida).toContain("uso:")` recebendo `''`, atribuído a uma regressão pré-existente
do Plano 03-08.

**Verificação do orquestrador: não existe defeito.** No checkout principal o mesmo arquivo
passa **19/19 em 54s**. A falha é artefato do worktree: `.gitignore:35` casa `.env*`, então
`apps/api/.env` não é rastreado e `git worktree add` nunca o leva. Sem `DATABASE_URL` o
processo filho que `rodarCli([])` spawna não sobe, e a captura de stdout vem vazia. É a
mesma causa dos `138 skipped` que o próprio relato registra.

O relato do 04-03 chegou perto da causa correta ("provavelmente um efeito de ambiente deste
worktree/sandbox") mas arquivou o achado como defeito pré-existente de um plano antigo.
**Não há nada a corrigir e nada a investigar no código do Plano 03-08.**

**Lição operacional:** nenhuma falha de teste relatada por agente em worktree deve ser
aceita sem reprodução no checkout principal. Custa um comando.

---

## 3. Dois timeouts em testes de banco do `apps/api` — INCONCLUSIVO, medição inválida

**Relatado por:** Plano 04-01, como diligência (não exigido pelos critérios de aceite das
suas três tasks): `e2e/lote-contas-a-pagar.test.ts` e `rotas/classificacoes.test.ts`
estourando o `testTimeout` de 180s.

**Por que é inconclusivo, e a culpa é do orquestrador:** aquele `npm run check` foi
**abortado por mim** no meio, para liberar o agente de um portão que não provava nada sobre
este plano (todos os arquivos do 04-01 vivem no repositório irmão; ele não tocou nenhum
arquivo do `crm-n1`). O comando rodava como `npm run check 2>&1 | tail -120`; ao matar a
cadeia do `npm`, o `tail` fechou e devolveu **exit 0**, então o agente leu um verde falso e
tirou conclusões de uma execução truncada.

Os dois timeouts podem ser reais — o `vitest.config.mts` do `apps/api` fala com o Postgres
da plataforma de verdade, e uma sondagem separada do orquestrador viu um arquivo de 4 testes
levar 55s. Mas nada aqui foi medido até o fim. **Trate como não medido, não como achado.**

**Para medir de verdade:** rodar `npm run test -w @n1/api` no checkout principal, sem pipe
que engula o código de saída, fora de qualquer watchdog de agente — a suíte inteira leva
40–50 min nesta base (`fileParallelism: false`, `testTimeout: 180_000`, por decisão
documentada no próprio config).
