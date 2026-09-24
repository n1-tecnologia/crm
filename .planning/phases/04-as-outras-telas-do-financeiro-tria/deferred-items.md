# Deferred Items — Phase 04 (as-outras-telas-do-financeiro-tria)

Achados fora de escopo registrados durante a execução, pela regra de SCOPE BOUNDARY
do executor. Nenhum foi corrigido pelo plano que o descobriu.

Os itens abaixo vieram de agentes diferentes ao longo das Ondas 1 a 3 e foram
**reconciliados pelo orquestrador**, que reproduziu cada um no checkout principal antes de
aceitá-lo. O veredito está marcado em cada item, e vale ler os rótulos: de seis achados
relatados, apenas **dois** são defeitos reais e pendentes (1 e 4); um foi **refutado** (2),
um é **inconclusivo por erro meu** (3), um foi **resolvido como artefato de carga** (6), e um
não é defeito nenhum mas uma **decisão humana** de exposição de dado (5).

Isso é deliberado: relatório de agente não é achado até ser reproduzido fora do worktree.
Dois dos relatos originais acusavam planos antigos de bugs que não existem.

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

---

## 4. `timingSafeEqual` está no código mas NÃO está protegido por teste — lacuna real de cobertura

**Descoberto por:** Plano 04-07, fazendo mutação de verdade (não descrevendo mutação).

**O que ele mediu:** trocar `timingSafeEqual` por `===` ingênuo em `exigirCredencial`
(`automation/src/http/leituras-plataforma-comum.ts`) deixou **todos os 11 casos verdes**.
Remover a chamada de `exigirCredencial` do handler de `/dashboard`, por outro lado, reprovou
exatamente os casos (a)-(d) — então a suíte prova que a credencial é exigida, mas não prova
que a comparação é de tempo constante.

**Verificação do orquestrador:** `timingSafeEqual` está de fato importado de `node:crypto` e
usado na linha 91 do arquivo. O código está correto HOJE. O problema é que nada impede um
refactor futuro de voltar para `===` sem nenhum teste ficar vermelho.

**Por que não foi corrigido aqui:** provar tempo constante em teste é notoriamente instável
(mede-se relógio, e CI com carga alta dá falso vermelho — esta própria fase viu 14 falsos
timeouts por carga). A alternativa honesta é um teste ESTRUTURAL: garantir por AST/grep que
`exigirCredencial` não contém `===`/`!==` entre segredos. Decisão de quem for endurecer a
superfície, não deste plano.

---

## 5. O filtro "Plataforma" que o UI-SPEC pede em Notas fiscais NÃO pode ser construído — exige decidir D4-05

**Descoberto por:** Plano 04-11, verificando o plano contra o DTO real em vez de obedecer a prosa.

**O impasse:** UI-SPEC e PLAN pedem um `Select` de Plataforma na tela de Notas fiscais. O
`NotaFiscalDto` de 04-01 (`automation/src/http/leituras-plataforma-dtos.ts`, já merjado) **não
projeta** campo `plataforma`, embora a coluna exista na tabela de origem `transacoes`. As duas
saídas eram inventar um enum falso — proibido pelo próprio UI-SPEC — ou editar a allowlist no
repositório irmão, fora do `files_modified` do plano.

**O que 04-11 fez (correto):** entregou só os dois filtros com dado real por trás (Status do
pedido, Forma de pagamento) mais a busca, e registrou a divergência.

**Por que é DECISÃO HUMANA e não bug:** fechar isso significa ACRESCENTAR `plataforma` à
allowlist POSITIVA de saída (D4-05). Essa allowlist existe precisamente para que nenhum campo
atravesse a fronteira por acidente — acrescentar um é escolha deliberada de exposição de dado,
com o mesmo peso das outras decisões de D4-05, não um detalhe de implementação. Quem decidir
precisa confirmar que `plataforma` não é sensível e que a tela realmente precisa dela.

---

## 6. RESOLVIDO — as 14 falhas de teste que 04-08 relatou eram artefato de carga, não defeito

**Relatado por:** Plano 04-08: `npm run test -w @n1/web` com 143 passed / **14 failed**, todas
`Test timed out in 5000ms`, todas em arquivos que o plano não tocou.

**Verificação do orquestrador: artefato confirmado, nada a corrigir.** Duas provas independentes:
- 04-11 rodou a MESMA suíte do MESMO commit base e obteve **157/157**.
- Depois do merge da Onda 3, com carga baixa e nenhum agente ativo, a suíte deu **157/157 em
  10,6s** — com os arquivos de 04-08 presentes.

**Causa:** quatro agentes em paralelo levaram o load average da máquina a **141-244** em um host
de 8 núcleos. Nesse regime o vitest não consegue nem responder (`[vitest-pool-runner]: Timeout
waiting for worker to respond` em duas tentativas de 04-08). O timeout padrão de 5s de `@n1/web`
não tem folga para isso.

**Lição operacional (culpa do orquestrador, não do executor):** quatro executores concorrentes
é demais para esta máquina — a verificação deixa de ser sinal. Ondas seguintes desta fase têm
no máximo dois planos, então o problema não reaparece aqui; em fases futuras, limitar a dois
executores paralelos ou subir o `testTimeout` de `@n1/web`.

---

## 7. `servidor-falso.test.ts` no `financeiro-tria/automation` — flake de porta em `npm test` completo, não reproduz isolado

**Descoberto por:** Plano 04-09, rodando `npm test` completo do `automation/` como parte da
verificação da Task 3.

**O que falhou:** `src/testing/servidor-falso.test.ts` — caso "kind ok devolve o programado" —
com `[TypeError: fetch failed]` cuja causa era um `HTTPParserError` porque a resposta recebida
começava com `SSH-2.0-OpenSSH_9.6p1 Ubuntu-3ubuntu13.16` em vez de um cabeçalho HTTP: o teste
conectou por acidente a um serviço SSH na máquina, não ao servidor HTTP falso que o próprio
teste sobe (`servidor.listen(0, ...)`, porta efêmera do SO).

**Verificação:** `npx tsx --test --test-concurrency=1 src/testing/servidor-falso.test.ts`
isolado — **6/6 verde**, sem nenhuma falha. `git diff --stat` confirma que nem
`servidor-falso.test.ts` nem qualquer arquivo do subsistema que ele testa foram tocados por
este plano (04-09 só criou/modificou `leituras-notas-fiscais.ts`,
`leituras-notas-fiscais-routes.ts`, seu teste, e duas linhas em `server.ts`).

**Por que não foi investigado a fundo:** o padrão já é conhecido nesta fase (ver item 6 acima —
artefato de carga/contenção da máquina compartilhada por múltiplos agentes). Uma porta efêmera
de SO ocasionalmente colidir com outro processo de rede da máquina (aqui, aparentemente um
servidor SSH) durante execução sob carga é consistente com esse padrão, não com um defeito de
código deste plano.

**Dono sugerido:** quem for endurecer `servidor-falso.test.ts` — considerar amarrar a um host/
porta mais isolados, ou não pertence a esta fase.
