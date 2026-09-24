---
phase: 04-as-outras-telas-do-financeiro-tria
plan: 09
subsystem: api
tags: [express, supabase, service-role, allowlist, node-test, financeiro, financeiro-tria]

# Dependency graph
requires:
  - phase: 04-as-outras-telas-do-financeiro-tria
    provides: "exigirCredencial, responderErro, requestIdDe, lerCorpoBruto, tokenDeLeitura, MENSAGENS_FIXAS — em financeiro-tria/automation/src/http/leituras-plataforma-comum.ts (Plan 04-07)"
  - phase: 04-as-outras-telas-do-financeiro-tria
    provides: "dtoDeNotaFiscal, dtoDeProduto — projeções de saída positivas de transacoes/produtos_cadastrados_emissao_notas, em financeiro-tria/automation/src/http/leituras-plataforma-dtos.ts (Plan 04-01)"
provides:
  - "listarTransacoes, listarProdutos, atualizarAliquotasDoProduto, COLUNAS_DE_TRANSACAO, COLUNAS_DE_PRODUTO — em financeiro-tria/automation/src/tenants/tria/leituras-notas-fiscais.ts: a primeira consulta HTTP a transacoes/produtos_cadastrados_emissao_notas"
  - "montarRotasDeNotasFiscais, notasFiscaisRouter, DepsDasRotasDeNotasFiscais — GET /v1/leituras/notas-fiscais, GET /v1/leituras/produtos, POST /v1/leituras/produtos/:id/aliquotas, em financeiro-tria/automation/src/http/leituras-notas-fiscais-routes.ts"
  - "/v1/leituras/notas-fiscais e /v1/leituras/produtos montados em server.ts, autenticados desde o nascimento, ANTES do express.json() global — sob o mesmo prefixo do mount de 04-07"
affects: ["04-11 (já mesclado — as duas telas de apps/web que consomem estas rotas via apps/api)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cliente service_role próprio do módulo de consulta (memoizado em `cached`), copiado da forma de plano-contas-routes.ts, em vez de importar automationStore (store do pipeline, outra responsabilidade)"
    - "Paginação interna por .range() em lotes fixos até a página vir incompleta, com teto de segurança e console.warn — nunca lançar por teto batido, porque é sinal de crescimento de dado, não defeito"
    - "Escrita monta o objeto de update campo a campo (nunca spread do argumento), para que nenhuma chave extra alcance a tabela mesmo se o schema de validação um dia afrouxar"
    - "Checagem de allowlist por Object.keys de cada linha projetada, não por substring no JSON inteiro da resposta — um valor de teste legítimo (status_pedido de exemplo) pode conter por coincidência a substring de um nome de campo proibido (achado desta task, ver Deviations)"

key-files:
  created:
    - "../financeiro-tria/automation/src/tenants/tria/leituras-notas-fiscais.ts"
    - "../financeiro-tria/automation/src/http/leituras-notas-fiscais-routes.ts"
    - "../financeiro-tria/automation/src/http/leituras-notas-fiscais-routes.test.ts"
  modified:
    - "../financeiro-tria/automation/src/server.ts"

key-decisions:
  - "A checagem de não-vazamento 'por nome' do caso (c) foi implementada por Object.keys de cada linha projetada, não por JSON.stringify(corpo).includes(nomeDoCampo) como uma leitura literal do texto do plano sugeria — porque um dos valores da fixture compartilhada (status_pedido: \"estado_desconhecido_de_teste\", criado por 04-01 para testar o caso (d), 'status desconhecido chega com o valor original') contém a substring 'estado' por coincidência, e 'estado' é um dos CAMPOS_PROIBIDOS (coluna de endereço). A checagem por chave é exatamente o padrão que leituras-plataforma-dtos.test.ts (04-01) já usa para o mesmo motivo; os valores literais proibidos (CPF/CNPJ, telefone, CEP, app_secret) continuam checados por substring, porque esses não colidem com nenhum dado de teste legítimo."

requirements-completed: [TELA-01]

# Metrics
duration: ~55min
completed: 2026-09-23
---

# Phase 04 Plan 09: A consulta do zero — Notas fiscais e Produtos atravessam um servidor pela primeira vez Summary

**As duas leituras (`transacoes`, ~1.987 linhas com paginação por lotes de 1000; `produtos_cadastrados_emissao_notas`, 42 linhas) e a única escrita desta tela (as duas alíquotas do Produto) saem da chave `anon` do navegador e passam a atravessar um servidor autenticado pela primeira vez, com colunas nomeadas na consulta e allowlist positiva no DTO como as duas barreiras de D4-05.**

## Performance

- **Duration:** ~55min entre o primeiro e o último commit de código (`cd0ed5a` → `5f90410`)
- **Completed:** 2026-09-23
- **Tasks:** 3/3
- **Files modified:** 3 criados, 1 modificado, todos em `../financeiro-tria` (mais este SUMMARY e uma entrada em `deferred-items.md`, em `crm-n1`)

## Accomplishments

- `leituras-notas-fiscais.ts` (155 linhas): `COLUNAS_DE_TRANSACAO`/`COLUNAS_DE_PRODUTO` nomeiam exatamente as colunas que o UI-SPEC usa — nenhum `select("*")`, nenhuma credencial, documento, telefone ou endereço na lista; `listarTransacoes` pagina por `.range()` em lotes de 1000 até a página vir incompleta (teto de 20 lotes com `console.warn`, nunca lança); `listarProdutos` sem paginação (42 linhas); `atualizarAliquotasDoProduto` monta o `update` campo a campo (nunca spread), lança `"nenhuma alíquota informada"` se nenhuma das duas vier e `"produto não encontrado"` se o `update` não casar nenhuma linha (via `error.code === "PGRST116"` do `.single()`, mesmo padrão de erro do `supabase-js` já usado no repositório)
- `leituras-notas-fiscais-routes.ts` (128 linhas): as três rotas, todas na ordem autenticar → validar → executar; `GET /notas-fiscais`/`GET /produtos` projetam através de `dtoDeNotaFiscal`/`dtoDeProduto` (04-01); `POST /produtos/:id/aliquotas` lê o corpo por `lerCorpoBruto` DEPOIS de `exigirCredencial`, valida com zod `.strict()` de dois campos opcionais casando `/^\d{1,3}([.,]\d{1,4})?$/` (string, sem conversão numérica — a coluna é `text`); erro `"produto não encontrado"` vira 404, qualquer outro vira 500 sanitizado
- `server.ts`: duas linhas (import + `app.use("/v1/leituras", notasFiscaisRouter())`) imediatamente após o mount de 04-07 e ANTES de `express.json({ limit: "10mb" })` — confirmado por número de linha (60 < 61); dois routers no mesmo prefixo, cada um respondendo pelos caminhos que declara
- `leituras-notas-fiscais-routes.test.ts` (11 casos `node:test`): app montado à mão sem `express.json()` global; (a)/(f) autenticação ausente com dep não chamada; (b) contagem de linhas e `total`; (c) a prova central de não-vazamento, por chave e por valor, com contra-caso sobre a fixture crua; (d) `"7 dias": true` → `seteDias: true`, status desconhecido preservado; (e) `porcentagemServico: null` preservado; (g)/(h) corpo inválido → 400 `SCHEMA_INVALIDO`, dep não chamada; (i) string decimal pt-BR repassada sem conversão; (j) `"produto não encontrado"` → 404; (k) erro com segredo → 500 sanitizado
- Verificação por mutação feita de fato: acrescentar `cpf_cnpj` a `COLUNAS_DE_TRANSACAO` (em `leituras-notas-fiscais.ts`) E a `dtoDeNotaFiscal`/`NotaFiscalDto` (em `leituras-plataforma-dtos.ts`, 04-01) fez o caso (c) falhar com `AssertionError: vazou o CPF/CNPJ falso`; as duas mutações revertidas a partir de backup em disco antes do commit, `git diff --stat` confirmou identidade byte a byte

## Task Commits

Cada task foi commitada atomicamente **no repositório `financeiro-tria`** (não em `crm-n1` — ver `<two_repository_warning>` do plano):

1. **Task 1: O módulo de consulta, com as colunas nomeadas** - `cd0ed5a` (feat)
2. **Task 2: As três rotas e o mount** - `02259dd` (feat)
3. **Task 3: O teste — auth, allowlist e a escrita que só alcança duas colunas** - `5f90410` (test)

**Plan metadata:** este commit (`docs(04-09): complete...`), feito em `crm-n1`.

`git -C ../financeiro-tria status --porcelain | wc -l` confirmado em `89` antes do primeiro commit, e de volta a `89` depois de cada um dos três commits — nenhum dos 89 arquivos pré-existentes foi tocado.

## Files Created/Modified

Repositório `financeiro-tria` (branch `main`):
- `automation/src/tenants/tria/leituras-notas-fiscais.ts` - consulta com colunas nomeadas + escrita das duas alíquotas (novo)
- `automation/src/http/leituras-notas-fiscais-routes.ts` - as três rotas + wiring de produção (novo)
- `automation/src/http/leituras-notas-fiscais-routes.test.ts` - 11 casos `node:test` (novo)
- `automation/src/server.ts` - mount de `notasFiscaisRouter()`, duas linhas + comentário

Repositório `crm-n1` (este):
- `.planning/phases/04-as-outras-telas-do-financeiro-tria/04-09-SUMMARY.md` - este arquivo
- `.planning/phases/04-as-outras-telas-do-financeiro-tria/deferred-items.md` - item 7 (flake de porta em teste alheio, ver "Issues Encountered")

## Decisions Made

Ver `key-decisions` no frontmatter — o ponto mais relevante: a checagem de não-vazamento "por nome" do caso (c) foi implementada checando `Object.keys` de cada linha projetada em vez de `JSON.stringify(corpo).includes(nomeDoCampo)`, porque o valor de teste `"estado_desconhecido_de_teste"` (da fixture compartilhada de 04-01, usado para o caso (d) de status desconhecido) contém a substring `"estado"` por coincidência — e `"estado"` é um `CAMPOS_PROIBIDOS` (coluna de endereço). Checar por chave é o padrão que `leituras-plataforma-dtos.test.ts` (04-01) já usa exatamente por este motivo; os valores literais proibidos continuam checados por substring, porque não colidem com dado de teste legítimo algum.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Prosa do cabeçalho de `leituras-notas-fiscais.ts` citando o literal `select("*")` derrubava o próprio grep de aceitação da Task 1**
- **Found during:** verificação das `<acceptance_criteria>` da Task 1, logo após a primeira escrita do arquivo
- **Issue:** `grep -cE 'select\("\*"\)|select\(.\*.\)'` devolveu `1` (esperado `0`) — o comentário de cabeçalho citava literalmente `select("*")` ao explicar por que a consulta não a usa, e o grep de aceitação não distingue prosa de código (mesmo achado já registrado em 04-04/04-07-SUMMARY.md para outros arquivos desta fase).
- **Fix:** reescrita da frase para "Selecionar a tabela inteira sem nomear coluna nenhuma é proibido..." — mesma explicação, sem o literal proibido pelo grep.
- **Files modified:** `../financeiro-tria/automation/src/tenants/tria/leituras-notas-fiscais.ts`
- **Verification:** o grep de aceitação voltou a `0`; `npx tsc --noEmit` limpo.
- **Committed in:** `cd0ed5a` — a correção foi feita antes do commit, então o commit não registra o "antes" com o texto que falhava o grep.

**2. [Rule 1 - Bug] Checagem de não-vazamento "por nome" via `JSON.stringify` produzia falso positivo por colisão de substring**
- **Found during:** Task 3, primeira execução do caso (c)
- **Issue:** `JSON.stringify(corpo).includes("estado")` reprovava mesmo com a projeção correta, porque a resposta legitimamente carrega `statusPedido: "estado_desconhecido_de_teste"` (o valor de teste do caso (d), que existe justamente para provar que um status desconhecido não vira branco) — essa string contém `"estado"` como substring, e `"estado"` é um `CAMPOS_PROIBIDOS`.
- **Fix:** reescrita da checagem para `Object.keys(linha).includes(proibido)` sobre cada linha projetada, em vez de substring no JSON inteiro — mesmo padrão já usado por `leituras-plataforma-dtos.test.ts` (04-01) pelo mesmo motivo. Os valores literais proibidos (CPF/CNPJ, telefone, CEP, `app_secret`) continuam checados por substring, sem colisão.
- **Files modified:** `../financeiro-tria/automation/src/http/leituras-notas-fiscais-routes.test.ts`
- **Verification:** os 11 casos passaram a verde; verificação por mutação (acrescentar `cpf_cnpj` ao DTO) confirmou que o caso (c) continua reprovando o vazamento real depois da correção.
- **Committed in:** `5f90410` — a correção foi feita antes do commit, então o commit não registra o "antes" com a checagem que dava falso positivo.

---

**Total deviations:** 2 auto-fixed (2 bugs, ambos encontrados e corrigidos antes do commit correspondente).
**Impact on plan:** Nenhuma mudança de comportamento de produção — as duas correções foram em prosa de comentário e na forma de uma asserção de teste, não no código que atende requisição real.

## Issues Encountered

- **`npm test` completo no `automation/`: 125/126 verdes.** A única falha estável é a pré-existente já registrada em `deferred-items.md` desde 04-01 (`payment-rules.test.ts`, "resolve responsavel por centro de custo com fallback", `'Elifas'` vs `/FINQ/i`) — confirmada aqui como ainda presente e não tocada por este plano (`git diff --stat` vazio para `payment-rules.ts`/`payment-rules.test.ts`). Os 11 casos novos de `leituras-notas-fiscais-routes.test.ts` passaram dentro da suíte completa, junto com os demais.
- **Flake de porta em `servidor-falso.test.ts` — não reproduziu isolado, registrado como item 7 em `deferred-items.md`.** Uma execução do `npm test` completo mostrou `src/testing/servidor-falso.test.ts` falhando com `[TypeError: fetch failed]` por um `HTTPParserError` (a resposta recebida começava com um banner SSH, não HTTP) — sinal de colisão de porta efêmera com outro processo de rede da máquina sob carga, não defeito de código. Isolado (`npx tsx --test --test-concurrency=1 src/testing/servidor-falso.test.ts`), 6/6 verde. Uma segunda execução do `npm test` completo também não reproduziu o flake (125/126, só o item pré-existente). `git diff --stat` confirma que este plano não tocou `servidor-falso.test.ts` nem nada do subsistema que ele testa. Registrado por transparência, não corrigido (fora de escopo, padrão já conhecido nesta fase — ver item 6 de `deferred-items.md`, artefato de carga de máquina compartilhada).
- **Waiver do `npm run check` do `crm-n1` — aplicado por decisão explícita do orquestrador para este plano** (ver `<do_not_run_the_crm_n1_full_check>` do prompt de execução): este plano não toca nenhum arquivo de código em `crm-n1` (só este SUMMARY e uma entrada em `deferred-items.md`, ambos em `.planning/`), então o `npm run check` do `crm-n1` não provaria nada sobre o trabalho feito aqui — e o custo (`apps/api` contra Postgres real, `fileParallelism: false`, `testTimeout: 180_000`, 40-50min de wall time) excede a janela do executor. Verificação feita em escopo, como instruído: `npx tsc --noEmit` do `automation/` (limpo, múltiplas vezes) e a suíte completa do `automation/` (`npm test`, 125/126 — o N-1 esperado).
- **`financeiro-tria.vercel.app` continua respondendo (D4-16) — não verificado nesta execução.** Este plano não toca nenhuma rota legada nem o front do Vercel (`git diff --stat` vazio para `routes.ts`/`plano-contas-routes.ts`/`workflow-routes.ts`); a verificação exigiria acesso de rede à VPS de produção, fora do escopo desta task. Sem indicação de que este plano poderia afetar o painel legado — as rotas novas vivem sob `/v1/leituras`, prefixo já existente desde 04-07, e nenhuma rota antiga foi tocada.

## User Setup Required

Nenhuma ação nova além da já documentada em `04-02-SUMMARY.md`/`04-07-SUMMARY.md`: `PLATAFORMA_LEITURA_TOKEN` (gerar com `openssl rand -hex 32`) precisa estar nos `.env` de produção de `automation/` E `apps/api` antes do corte (D4-16) — nenhuma rota em produção depende dela ainda até `apps/api` estar de fato chamando `/v1/leituras/notas-fiscais`/`/v1/leituras/produtos`.

## Next Phase Readiness

- `GET /v1/leituras/notas-fiscais`, `GET /v1/leituras/produtos` e `POST /v1/leituras/produtos/:id/aliquotas` existem, autenticadas, montadas antes do parser global — 04-11 (já mesclado) já consome as duas leituras via `apps/api`; nenhum bloqueio novo para esse plano.
- As rotas legadas (`routes.ts`, `plano-contas-routes.ts`, `workflow-routes.ts`, `bank-statement-webhooks.ts`) seguem byte a byte intactas — `git diff --stat` confirmado vazio.
- A lacuna do filtro de Plataforma (item 5 de `deferred-items.md`, descoberta por 04-11) segue aberta: `dtoDeNotaFiscal`/`NotaFiscalDto` continuam sem o campo `plataforma`, por ser decisão humana de exposição de dado (D4-05), não bug. Este plano não a resolveu — não era seu escopo.
- Nenhum bloqueio novo para os planos seguintes da Fase 4. A falha pré-existente de `payment-rules.test.ts` permanece documentada em `deferred-items.md` (de 04-01), sem entrada duplicada; o flake de `servidor-falso.test.ts` ganhou entrada nova (item 7), por transparência.

---
*Phase: 04-as-outras-telas-do-financeiro-tria*
*Completed: 2026-09-23*

## Self-Check: PASSED

- FOUND: `../financeiro-tria/automation/src/tenants/tria/leituras-notas-fiscais.ts`
- FOUND: `../financeiro-tria/automation/src/http/leituras-notas-fiscais-routes.ts`
- FOUND: `../financeiro-tria/automation/src/http/leituras-notas-fiscais-routes.test.ts`
- FOUND commit `cd0ed5a` (Task 1) in `../financeiro-tria`
- FOUND commit `02259dd` (Task 2) in `../financeiro-tria`
- FOUND commit `5f90410` (Task 3) in `../financeiro-tria`
