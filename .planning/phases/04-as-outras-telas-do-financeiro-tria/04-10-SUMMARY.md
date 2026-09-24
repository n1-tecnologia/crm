---
phase: 04-as-outras-telas-do-financeiro-tria
plan: 10
subsystem: api
tags: [fastify, financeiro, auth, escrita, upload, zod, error-handler]

# Dependency graph
requires:
  - phase: 04-as-outras-telas-do-financeiro-tria
    provides: "rotasDeFinanceiro/comAlcance/responder/EMPRESAS_PERMITIDAS (04-05) — o módulo e o molde que este plano estende com escritas"
  - phase: 04-as-outras-telas-do-financeiro-tria
    provides: "ClienteDeLeituras.enviar/enviarArquivo (04-02) — os dois métodos de escrita que 04-05 deixou implementados mas não usados até agora"
provides:
  - "As seis rotas POST /financeiro/* que D4-07 autoriza: alíquota de Produto, import/remover do Plano de contas, gatilho de workflow em lote (D4-12), retry-step/cancelar de execução"
  - "POST /financeiro/extratos/:origem — o proxy de upload com validação de origem/extensão/MIME/tamanho antes da VPS (D4-13)"
  - "Fix no setErrorHandler de app.ts: erros do próprio Fastify com statusCode 4xx definido (413/415) deixam de virar 500 genérico"
affects: ["as 8 telas de apps/web (D4-08) — as telas de Produtos, Plano de contas, Workflows, Execuções e Extratos agora têm ação de escrita para chamar", "qualquer plano futuro que jogue erro do Fastify com statusCode (rate limit, outro bodyLimit) — agora preserva o código em vez de virar 500"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Escrita POST dentro do mesmo comAlcance/responder das leituras — schema zod .strict() validado ANTES de tocar o pool, mesmo molde de 04-05"
    - "Allowlist literal como terceira barreira (workflows executáveis, origens de extrato) — nunca union type sozinho"
    - "addContentTypeParser restrito a uma lista positiva de MIME, registrado dentro do plugin encapsulado (nunca vaza para POST /operacoes/:nome)"
    - "Saneamento de nome de arquivo por basename antes de repassar a qualquer sistema externo"

key-files:
  created: []
  modified:
    - apps/api/src/rotas/financeiro.ts
    - apps/api/src/rotas/financeiro.test.ts
    - apps/api/src/app.ts

key-decisions:
  - "As seis rotas de D4-07 (não cinco, apesar do nome da Task 1 no plano) foram todas implementadas: aliquotas, plano-contas/importar, plano-contas/:id/remover, workflows/:key/executar, execucoes/:id/repetir-passo, execucoes/:id/cancelar. A aritmética do plano ('grep devolve 5 nesta task, 6 depois do upload') contradiz sua própria lista de 6 itens no <action> da Task 1; D4-07 autoriza exatamente essas seis escritas mais o upload (sete no total), e D4-07 é a fonte de verdade quando o plano diverge de si mesmo."
  - "app.ts::setErrorHandler tinha um bug pré-existente (de 04-05): qualquer erro do próprio Fastify com `statusCode` definido (413 de bodyLimit, 415 de content-type sem parser) caía no branch genérico e virava 500, escondendo a recusa que o threat model desta fase (T-4-05) depende para funcionar. Corrigido com um branch que repassa o statusCode 4xx do Fastify quando presente, mantendo o 500 opaco para qualquer erro sem esse campo (T-1-06 intacto). Sem esse fix, os casos (e)/415 do teste e a mitigação de 413 documentada no threat model simplesmente não existiriam em produção."

requirements-completed: [TELA-01]

# Metrics
duration: ~70min
completed: 2026-09-23
---

# Phase 4 Plan 10: As escritas do Financeiro na borda do apps/api Summary

**Seis rotas `POST /financeiro/*` (alíquota, Plano de contas, gatilho de NF em lote, execução) mais o proxy de upload de Extratos com validação de origem/extensão/MIME/tamanho, e um fix no `setErrorHandler` de `app.ts` que mascarava 413/415 do Fastify como 500 genérico.**

## Performance

- **Tasks:** 3/3 completed
- **Files modified:** 3 (2 previstas no plano — `financeiro.ts`, `financeiro.test.ts` — mais `app.ts`, fora do `files_modified` do plano, como deviation documentada abaixo)
- **Verification:** scoped only, seguindo o hard constraint anti-hang desta sessão. `npm run typecheck -w @n1/api` (verde, 4 execuções — uma por edição relevante). `npx vitest run src/rotas/financeiro.test.ts` com o timeout nativo do `vitest.config.mts` (nunca `--testTimeout` curto, depois que uma primeira tentativa com `--testTimeout=20000` produziu um falso-negativo em `operacoes.test.ts` por causa do custo de transform a frio, ~253s neste ambiente sem cache — documentado em Issues Encountered). Resultado final: 14 passed / 11 skipped (25), exit 0. `npx vitest run src/rotas/operacoes.test.ts` roda duas vezes (antes e depois do fix de `app.ts`): 13 passed / 9 skipped em ambas, exit 0 — prova de que o parser novo não vazou (T-4-30) e de que o fix do error handler não regrediu nada. `npm run check`, `npm test`/`npm run test` e `vitest run` sem arquivo nunca foram invocados. Nenhum exit code foi lido atrás de um `| tail` — todo comando redirecionou para um arquivo de log e teve seu `$?` gravado diretamente.

## Accomplishments

- `apps/api/src/rotas/financeiro.ts`: seis rotas `POST /financeiro/{produtos/:id/aliquotas, plano-contas/importar, plano-contas/:id/remover, workflows/:key/executar, execucoes/:id/repetir-passo, execucoes/:id/cancelar}`, todas dentro do mesmo `comAlcance`/`responder` de 04-05, todas com corpo validado por zod `.strict()` antes de qualquer chamada de rede. `workflows/:key/executar` usa uma allowlist literal de duas `key` (`tria-invoice-mark-7days`, `tria-invoice-emit`) como terceira barreira contra emissão por linha (D4-12/T-4-27) e devolve 202 no caminho feliz. `plano-contas/importar` traduz `categoriaClickup` → `categoria_clickup` na borda — a única tradução de nome de campo do módulo.
- `apps/api/src/rotas/financeiro.ts`: `POST /financeiro/extratos/:origem` — o proxy de upload (D4-13). `addContentTypeParser` restrito a oito MIME aceitos (nunca `"*"`) registrado dentro do plugin encapsulado; `bodyLimit: 25MB` na rota; validação em ordem — origem (allowlist literal de sete bancos/cartões), extensão real de `x-file-name` (a lista que `parseRecebimento` despacha: pdf/csv/xlsx/xls/ofx), corpo não-vazio — antes de `cliente.enviarArquivo`. Nome de arquivo saneado ao basename antes de sair (T-4-28).
- Nenhuma rota de aprovar nasceu: `PATCH /financeiro/solicitacoes/:id/aprovado` e `POST /financeiro/execucoes/:id/aprovar` continuam 404, provado por teste (caso i), não por comentário.
- `apps/api/src/rotas/financeiro.test.ts`: 19 casos novos — 10 no bloco "sem banco" (401×2, allowlists de origem/extensão/empresa/linhas/`key` todas em 400 antes de qualquer chamada ao cliente falso, 415 sem parser registrado, e a ausência da rota de aprovar por 404 em dois caminhos) e 9 no bloco `describe.skip`-gated contra Postgres real (403×2 sem chamar o cliente, upload feliz com caminho/Buffer/nome/origem exatos capturados, saneamento de path traversal, corpo vazio, tradução `categoriaClickup`).
- `apps/api/src/app.ts`: fix no `setErrorHandler` — ver Deviations.

## Task Commits

Each task was committed atomically:

1. **Task 1: As cinco ações — alíquota, plano de contas, gatilhos e execuções** (na prática, as seis que D4-07 autoriza) - `a838283` (feat)
2. **Task 2: O proxy de upload de Extratos** - `621b337` (feat)
3. **Task 3: Os casos de teste das escritas e do upload** - `eb5b881` (test, inclui o fix de `app.ts`)

_No plan-metadata commit for STATE.md/ROADMAP.md — this executor runs in worktree mode; the orchestrator owns those files after merge._

## Files Created/Modified

- `apps/api/src/rotas/financeiro.ts` - +255 linhas: as seis escritas (Task 1) e o proxy de upload (Task 2)
- `apps/api/src/rotas/financeiro.test.ts` - +242 linhas: 19 novos casos e o helper `clienteFalsoDeEscrita`
- `apps/api/src/app.ts` - +11 linhas: o fix do `setErrorHandler` (deviation, ver abaixo)

## Decisions Made

Ver `key-decisions` no frontmatter — a aritmética de rotas do plano (5 vs. 6) e o fix do error handler pré-existente.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `app.ts::setErrorHandler` mascarava erros nativos do Fastify com `statusCode` 4xx como 500 genérico**
- **Found during:** Task 3, ao rodar o caso (e) do teste (`content-type: text/html` sem parser registrado deveria responder 415).
- **Issue:** O `setErrorHandler` de `app.ts` (criado em 04-05, antes deste plano) só tratava dois casos: erro de validação zod (400) e "qualquer outro erro" (500 genérico, log interno). Um erro NATIVO do Fastify — como `FST_ERR_CTP_INVALID_MEDIA_TYPE` (415, quando não há `addContentTypeParser` para o `content-type` recebido) ou o erro de `bodyLimit` excedido (413) — não é uma falha de validação zod nem um bug interno: é uma recusa esperada, com mensagem segura (do próprio framework, sem stack) e `statusCode` já correto. O handler existente tratava os dois como "erro inesperado" e respondia 500 — o teste (e) falhou com "expected 500 to be 415", e o mesmo defeito significa que o `bodyLimit: 25MB` desta Task 2 (T-4-05, 413 esperado) também nunca chegaria ao cliente como 413 em produção — a mitigação documentada no threat model do plano simplesmente não se materializava.
- **Fix:** Adicionado um branch entre a checagem de zod e o catch-all: se `erro instanceof Error && "statusCode" in erro` e o valor é um número entre 400 e 499, repassa esse `statusCode` e `erro.message` (mensagem do próprio Fastify, já segura) em vez de cair no 500 genérico. Erros sem essa propriedade (qualquer `throw new Error(...)` de código de aplicação, como o `RangeError` de `reviverArgumentos` em `operacoes.ts` ou o erro de `DATABASE_URL` ausente) continuam indo para o 500 opaco — T-1-06 intacto.
- **Files modified:** `apps/api/src/app.ts`
- **Verification:** Caso (e) de `financeiro.test.ts` passou a verde depois do fix (antes: `expected 500 to be 415`). `npx vitest run src/rotas/operacoes.test.ts` rodado ANTES e DEPOIS do fix — 13 passed / 9 skipped nas duas execuções, sem regressão. `npx vitest run src/rotas/financeiro.test.ts` completo: 14 passed / 11 skipped, exit 0. `integracao-solicitacoes.test.ts` foi inspecionado (não executado, por não ser deste plano nem tocado por ele) — seu único teste de 500 (caso l, "erro interno responde o envelope do contrato") usa um `Error` sem `statusCode` (corrompe um Status direto no banco, forçando `paraDtoV1` a lançar), então não é afetado pelo novo branch.
- **Committed in:** `eb5b881` (Task 3 commit, junto com os testes que o exercitam)

**2. [Clarificação — não é bug, mas diverge do texto do plano] O plano autoriza seis escritas na Task 1, não cinco**
- **Found during:** Task 1, ao contar as rotas para bater com o critério de aceitação `grep -c "app.post(\"/financeiro/"` esperando `5` (antes do upload) / `6` (depois).
- **O que a Task 1 realmente lista:** seis itens numerados no `<action>` — alíquota, plano-contas/importar, plano-contas/:id/remover, workflows/:key/executar, execucoes/:id/repetir-passo, execucoes/:id/cancelar. D4-07 confirma exatamente essas seis escritas mais o upload (sete no total). O nome da Task ("as cinco ações") e a conta do critério de aceitação (5 → 6) contradizem a própria lista de itens da mesma Task.
- **Ação tomada:** Implementadas as seis rotas que D4-07 autoriza (nenhuma a mais, nenhuma a menos) mais o upload da Task 2 — sete `app.post` no total, não seis. `grep -c "app.post(\"/financeiro/"` devolve `6` depois da Task 1 (não `5`) e `7` depois da Task 2 (não `6`). D4-07, sendo a decisão travada, é a fonte de verdade quando o texto do plano diverge de si mesmo — consistente com a instrução do hard constraint desta sessão ("D4-07 authorizes only a FEW writes... treat D4-07 as authoritative").
- **Verification:** Todas as seis rotas + upload existem, testadas (casos a-n do bloco de teste), nenhuma delas duplica ou estende o D4-07.
- **Committed in:** `a838283` (Task 1), `621b337` (Task 2)

**3. [Ajuste de prosa, não de comportamento] Contagem literal de `tria-invoice-mark-7days`/`tria-invoice-emit`**
- **Found during:** Task 1, checando o critério de aceitação `grep -c "tria-invoice-mark-7days"` == `1`.
- **Issue:** O comentário inicial acima da allowlist repetia as duas strings literais por extenso, fazendo o grep contar 2 ocorrências (comentário + array) em vez de 1.
- **Fix:** Reescrito o comentário para descrever o mecanismo sem repetir as strings literais — a allowlist (`WORKFLOWS_EXECUTAVEIS`) continua sendo o único lugar onde as duas `key` existem no arquivo.
- **Files modified:** `apps/api/src/rotas/financeiro.ts`
- **Committed in:** `a838283`

---

**Total deviations:** 3 (1 bug fix fora do `files_modified` do plano, 1 clarificação sobre a superfície de escrita autorizada por D4-07, 1 ajuste cosmético de comentário).
**Impact on plan:** O fix de `app.ts` é necessário para que a mitigação de T-4-05 (413/415) exista de fato em produção — sem ele, o threat model deste próprio plano descreveria uma defesa que não funciona. A superfície de escrita entregue é exatamente a que D4-07 autoriza; nenhuma rota de aprovar, nenhuma emissão por linha, nenhum CRUD além do que a decisão trava. Nenhum escopo novo além do que D4-07/D4-12/D4-13 já decidiram.

## Issues Encountered

- **Falso-negativo por `--testTimeout` curto em ambiente sem cache de transform.** Uma primeira tentativa de rodar `operacoes.test.ts` com `--testTimeout=20000` (seguindo a orientação de aplicar timeout curto quando todos os casos são stub-based) falhou com "Test timed out in 20000ms" num caso puramente sem banco — não por lentidão do teste em si, mas porque o `transform` a frio deste worktree (sem `fsModuleCache`) levou ~253s (60% do tempo total), consumindo o orçamento de 20s de um único `it()` antes mesmo dele rodar de verdade. Reexecutado sem override de timeout (timeout nativo de 180s do `vitest.config.mts`): 13 passed / 9 skipped em 30s (a segunda execução já se beneficiou de cache parcial). Registrado aqui porque o hard constraint desta sessão avisava exatamente sobre esse risco ("If in doubt, run the file with the config's native timeout") e a orientação se confirmou necessária na prática, não só teórica.
- **Mutação do caso (l) não pôde ser executada neste ambiente.** O caso (l) (saneamento de `../../etc/passwd.csv` → `passwd.csv`) vive no bloco `describe.skip`-gated contra Postgres real (DEC-09) — sem `DATABASE_URL` neste worktree, ele nunca roda, então uma mutação no saneamento não produziria um vermelho observável aqui (o teste continuaria "skipped" independente da mutação). A mutação do caso (h) (allowlist de `key` de workflow) FOI executada com sucesso — ver Deviations — porque esse caso vive no bloco sem banco. Recomendo que o orquestrador, ao rodar a suíte completa no checkout principal (onde 04-05 já provou 9/9 verde em 128s), inclua uma verificação manual de que remover o saneamento de nome faz o caso (l) falhar, no mesmo espírito da verificação já feita aqui para o caso (h).

## User Setup Required

None new. As mesmas duas variáveis de ambiente de 04-02 (`FINANCEIRO_LEITURAS_URL`, `PLATAFORMA_LEITURA_TOKEN`) cobrem tanto leitura quanto escrita — este plano não introduz nenhuma credencial nova, porque `cliente.enviar`/`cliente.enviarArquivo` (04-02) já usam o mesmo par.

## Next Phase Readiness

- As telas de Produtos, Plano de contas, Workflows, Execuções e Extratos (D4-08) agora têm rota de escrita para chamar: `POST /financeiro/produtos/:id/aliquotas`, `POST /financeiro/plano-contas/{importar,:id/remover}`, `POST /financeiro/workflows/:key/executar`, `POST /financeiro/execucoes/:id/{repetir-passo,cancelar}`, `POST /financeiro/extratos/:origem`.
- O fix de `app.ts::setErrorHandler` beneficia qualquer plano futuro que dependa de um erro nativo do Fastify carregar seu próprio `statusCode` (rate limiting, outro `bodyLimit`, outro `addContentTypeParser`) — antes deste plano, esse padrão silenciosamente virava 500.
- Pendência para o orquestrador: confirmar em ambiente com `DATABASE_URL` (checkout principal) que os 9 casos do bloco `describe.skip`-gated de `financeiro.test.ts` (agora 14 no total: 5 de 04-05 + 9 deste plano) passam de fato contra Postgres real, e opcionalmente repetir a verificação por mutação do saneamento de nome (caso l) que não pôde ser exercitada neste worktree sem banco.
- Nenhuma rota de aprovar nasceu; a superfície de escrita para de exatamente onde D4-07 manda.

---
*Phase: 04-as-outras-telas-do-financeiro-tria*
*Completed: 2026-09-23*

## Self-Check: PASSED

- FOUND: `apps/api/src/rotas/financeiro.ts`
- FOUND: `apps/api/src/rotas/financeiro.test.ts`
- FOUND: `apps/api/src/app.ts` (modified, `setErrorHandler` fix present)
- FOUND commit `a838283` (Task 1)
- FOUND commit `621b337` (Task 2)
- FOUND commit `eb5b881` (Task 3)
