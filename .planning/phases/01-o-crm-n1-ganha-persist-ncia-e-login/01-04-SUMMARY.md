---
phase: 01-o-crm-n1-ganha-persist-ncia-e-login
plan: 04
subsystem: api
tags: [fastify, http-routing, dispatch-registry, diff, optimistic-concurrency, id-sequence]

# Dependency graph
requires:
  - phase: 01-o-crm-n1-ganha-persist-ncia-e-login (Plan 01-02)
    provides: "buildApp()/registrarAutenticacao — hook onRequest, request.membro, config: { publica: true }"
  - phase: 01-o-crm-n1-ganha-persist-ncia-e-login (Plan 01-03)
    provides: "OPERACOES/ehNomeDeOperacao/reviverArgumentos (allowlist de despacho), Diferenca/RegistroGravado/Ordens/DIFERENCA_VAZIA, syncIdSequence"
provides:
  - "POST /operacoes/:nome — rota genérica sobre executar(), despacho por OPERACOES; 200 (ok:true ou ok:false), 404 (nome fora do registro), 409 (conflito de revisão), 400 (schema), 401/403 (hook)"
  - "GET /estado — hidratar() + ordensComoObjeto() + sessao.memberId (D-04)"
  - "gravar() devolve Diferenca com os registros tocados (colecao, id, dados, ordem), não só contagens; ordensComoObjeto() converte o Map de ordem para o objeto que viaja em JSON"
  - "executar()/ResultadoTransacao<T> ganham revisao/revisaoAnterior (D-06); syncIdSequence(antes.state) roda antes de toda operação"
  - "Fix de domínio: PADRAO_ID (syncIdSequence) casa só ids de exatamente 6 caracteres — evita perda de precisão em ponto flutuante e ids duplicados"
affects: [01-05, 01-07, 01-08, 01-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Rota genérica POST /operacoes/:nome despachando por um Record (cast de OPERACOES) em vez de 130 arquivos de rota — mesma disciplina de allowlist de colecoes.ts"
    - "OperationResult (mesmo ok:false) sempre 200; 4xx/5xx reservados a falhas de transporte (401/403 hook, 404 nome fora do registro, 409 conflito de revisão, 500 setErrorHandler)"
    - "app.register() sem await em buildApp() síncrono — Fastify resolve a fila de plugins no primeiro ready()/listen()/inject()"

key-files:
  created:
    - apps/api/src/rotas/operacoes.ts
    - apps/api/src/rotas/operacoes.test.ts
    - apps/api/src/rotas/estado.ts
    - apps/api/src/rotas/estado.test.ts
  modified:
    - apps/api/src/persistencia/repositorio.ts
    - apps/api/src/persistencia/unidade-de-trabalho.ts
    - apps/api/src/persistencia/persistencia.test.ts
    - apps/api/src/app.ts
    - packages/dominio/src/operations/activity.ts
    - packages/dominio/src/operations/id-sequence.test.ts

key-decisions:
  - "OPERACOES (as const satisfies Record<...>) indexado por um NomeDeOperacao genérico devolve a união de todas as ~132 assinaturas, que TypeScript não deixa chamar diretamente sem um genérico por chamada — operacoes.ts faz um cast único para Record<string, (state, actingMemberId, ...args: unknown[]) => OperationResult<unknown>> na borda da rota, documentado como seguro pela regra de inclusão do próprio registro"
  - "body.revisao é aceito pelo schema zod e ignorado pelo servidor nesta fase — quem decide entre aplicar o diff e re-hidratar é o cliente, por revisaoAnterior (D-06); mantido no contrato para não precisar mudar o schema quando for útil logar defasagem"
  - "GET /estado sem schema de resposta zod — o DataState chega a ~475 KB; validar contra um schema custaria mais do que protege (mesma decisão já usada para o corpo de POST /operacoes/:nome)"
  - "gravar() guarda o objeto do registro (não uma nova serialização) numa Map auxiliar chaveada por colecao+id, para popular RegistroGravado.dados com o mesmo objeto que a operação produziu"

requirements-completed: [PERS-04]

# Metrics
duration: ~55min
completed: 2026-09-16
---

# Phase 1 Plan 04: `POST /operacoes/:nome` e `GET /estado` — a casca HTTP sobre a Unidade de Trabalho Summary

**`apps/api` serve as ~132 operações do domínio por `POST /operacoes/:nome` (despacho pela allowlist `OPERACOES`, recusa do domínio sempre em 200, conflito de revisão em 409) e a carga inicial por `GET /estado` (D-04) — fechando D-03/D-06 com `gravar()` devolvendo os registros tocados e `executar()` sincronizando `nextId` antes de cada operação.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-09-16T13:20:00Z (aprox., após 01-07)
- **Completed:** 2026-09-16T14:15:00Z (aprox.)
- **Tasks:** 2/2
- **Files modified:** 10 (4 criados, 6 modificados)

## Accomplishments

- `gravar()` (`repositorio.ts`) devolve `Diferenca` de `@n1/dominio` — os registros tocados (`colecao`, `id`, `dados`, `ordem`), não mais contagens; `ordensComoObjeto()` novo converte o `Map` de `hidratar()` para o objeto que `GET /estado` expõe.
- `executar()` (`unidade-de-trabalho.ts`) chama `syncIdSequence(antes.state)` imediatamente antes de cada operação (fecha a colisão de ids entre processos) e `ResultadoTransacao<T>` ganha `revisao`/`revisaoAnterior` — a nova revisão vem do `UPDATE ... RETURNING`, não de aritmética paralela.
- `POST /operacoes/:nome` (`rotas/operacoes.ts`) é a casca genérica sobre `executar()`: `ehNomeDeOperacao` decide 404 antes de qualquer execução, `reviverArgumentos` traz `Date` de volta, o Membro atuante é sempre `request.membro.id` (T-1-02 — nunca o corpo), recusa do domínio (`ok:false`) responde 200, conflito de revisão responde 409.
- `GET /estado` (`rotas/estado.ts`) reaproveita `hidratar()` sem reimplementar nada: devolve `data`, `revisao`, `ordens` e `sessao.memberId` — exatamente a forma que `apps/web/src/dados/transporte.ts` (Plan 01-07) já espera.
- **Bug de domínio corrigido (fora dos `files_modified` do plano, ver Deviations):** `syncIdSequence` interpretava qualquer id de 6+ caracteres como sequência base36; um id real do seed (`agt_classificador`, 13 caracteres) estourava `Number.MAX_SAFE_INTEGER` e fazia `nextId()` devolver o mesmo id repetidamente — descoberto porque esta é a primeira vez que `syncIdSequence` roda contra o seed real dentro de `executar()`.
- `npm run check` verde nos três workspaces: 233 domínio (+1 teste de regressão) + 36 api (+12 desta plan) + 53 web = 322 testes. Smoke test manual: `apps/api` na porta 3002, `curl -X POST /operacoes/createTask` sem header devolve `401 {"ok":false,"error":"Sem sessão."}`.

## Task Commits

Each task was committed atomically:

1. **Task 1: `gravar()` devolve os registros; `executar()` sincroniza ids e devolve `revisao`/`revisaoAnterior`** - `252359f` (feat)
2. **Task 2: `POST /operacoes/:nome` e `GET /estado` — a casca HTTP sobre a Unidade de Trabalho (inclui o fix de `syncIdSequence`)** - `e87e6b8` (feat)

**Plan metadata:** pending (this commit)

## Files Created/Modified

- `apps/api/src/persistencia/repositorio.ts` - `gravar()` devolve `Diferenca` (`@n1/dominio`) com os registros tocados; `semear()` usa `gravados.length`; `ordensComoObjeto()` novo
- `apps/api/src/persistencia/unidade-de-trabalho.ts` - `syncIdSequence(antes.state)` antes da operação; `ResultadoTransacao<T>` com `revisao`/`revisaoAnterior`
- `apps/api/src/persistencia/persistencia.test.ts` - duas asserções de contagem viram `.length`; três novas provam os registros certos no diff e `revisao === revisaoAnterior + 1`
- `apps/api/src/rotas/operacoes.ts` - `rotasDeOperacoes`; `POST /operacoes/:nome`, despacho por `OPERACOES`, 404/409/200
- `apps/api/src/rotas/operacoes.test.ts` - 10 casos: 404 (nome inexistente, `nextId`, `__proto__`), 401 sem token, 400 (corpo inválido) sem banco; sucesso com diff, recusa RN-CP-04 em 200, `runScheduledAutomations` com marcador de `Date`, Membro removido em 403 com banco
- `apps/api/src/rotas/estado.ts` - `rotasDeEstado`; `GET /estado`
- `apps/api/src/rotas/estado.test.ts` - 401 sem token (sem banco); forma completa da resposta com banco
- `apps/api/src/app.ts` - registra `rotasDeOperacoes`/`rotasDeEstado` depois de `registrarAutenticacao`
- `packages/dominio/src/operations/activity.ts` - `PADRAO_ID` casa só ids de exatamente 6 caracteres (era `{6,}`)
- `packages/dominio/src/operations/id-sequence.test.ts` - teste de regressão com `agt_classificador` do seed real

## Decisions Made

- `OPERACOES` (tipo `as const satisfies Record<...>`) indexado por um `NomeDeOperacao` genérico (não um literal específico via generic) devolve a união de todas as assinaturas — TypeScript não deixa chamar essa união diretamente com argumentos variádicos. `operacoes.ts` faz um único cast, na borda da rota, para o tipo comum que o próprio `registro.ts` já declara como `satisfies` (`Record<string, (state, actingMemberId, ...args: unknown[]) => OperationResult<unknown>>`) — documentado no comentário como seguro pela regra de inclusão do registro, não um `any` genérico.
- `body.revisao` é validado pelo schema (`z.number().int().nonnegative().optional()`) e aceito, mas ignorado nesta fase pelo servidor — D-06 deixa a decisão de aplicar diff vs. re-hidratar com o cliente, por `revisaoAnterior`; o campo fica no contrato para não precisar mudar o schema se um dia for útil logar defasagem.
- `GET /estado` não tem schema de resposta zod: o `DataState` chega a ~475 KB e validar contra um schema custaria mais do que protege — mesma decisão que Plan 01-02 já tomou para o corpo geral.
- `gravar()` guarda o objeto do registro (não uma nova serialização) numa `Map` auxiliar chaveada por `colecao id`, para que `RegistroGravado.dados` seja o mesmo objeto que a operação produziu — o Fastify serializa e omite `undefined` da mesma forma que `canonico()` já fazia para a comparação.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `syncIdSequence` perdia precisão em ponto flutuante com ids hand-authored longos, gerando ids duplicados**

- **Found during:** Task 2, ao rodar o caso de teste (i) (`runScheduledAutomations`) contra o banco real — `500` em vez do `200` esperado.
- **Issue:** `PADRAO_ID` (`packages/dominio/src/operations/activity.ts`) casava qualquer id no formato `prefix_XXXXXX` com 6 OU MAIS caracteres alfanuméricos depois do prefixo. O seed real tem `agt_classificador` (13 caracteres) — um id hand-authored, nunca gerado por `nextId()` — que bate nesse padrão e é interpretado como um número base36 de ~6×10¹⁹, muito além de `Number.MAX_SAFE_INTEGER` (~9×10¹⁵). `resetIdSequence` grava esse valor no contador de módulo; o próximo `sequence += 1` de `nextId()` não muda o valor em ponto flutuante (perda de precisão), então toda chamada seguinte devolve o MESMO id. `runScheduledAutomations` chama `nextId()` mais de uma vez na mesma execução (`AgentExecution`, `AutomationExecution`, `ActivityRecord`) e todas colidiram no mesmo id gerado, estourando a constraint `(workspace_id, colecao, id)` em `gravar()` com `ON CONFLICT DO UPDATE command cannot affect row a second time`. Só apareceu agora porque esta plan é a primeira a chamar `syncIdSequence` contra o seed real dentro de `executar()` (a chamada já existia desde Plan 01-03, mas nunca tinha rodado fora de testes isolados de domínio).
- **Fix:** `PADRAO_ID` mudou de `{6,}` para `{6}` — casa só ids de EXATAMENTE 6 caracteres, a largura exata que `nextId()` produz (`padStart(6, "0")`). Um id de 6 caracteres cabe em no máximo 36⁶-1 ≈ 2,17 bilhões, dentro da faixa segura de `number` — continua "só empurrando o contador para cima", sem risco de perda de precisão. Comentário do arquivo atualizado para explicar o porquê (com o exemplo real do bug).
- **Files modified:** `packages/dominio/src/operations/activity.ts`, `packages/dominio/src/operations/id-sequence.test.ts` (teste de regressão novo, usando `agt_classificador` do seed real)
- **Verification:** `npm run test -w @n1/dominio` (233/233, incluindo o novo teste de regressão); `npm run test -w @n1/api -- src/rotas/operacoes.test.ts` (caso `i` passa, 200); `npm run check` verde nos três workspaces.
- **Committed in:** `e87e6b8` (Task 2 commit — o bug só apareceu ao escrever o teste da Task 2, corrigido antes de qualquer commit intermediário)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug de correção de dados, fora dos `files_modified` declarados no plano, mas bloqueando diretamente o critério de aceitação da Task 2).
**Impact on plan:** Necessário para o próprio critério de sucesso da Task 2 ("nunca 400/500"). Sem o fix, qualquer operação que chame `nextId()` mais de uma vez na mesma execução — não só `runScheduledAutomations` — arriscava colidir sempre que o maior id "hand-authored" do Espaço tivesse mais de 6 caracteres, o que é comum na convenção de nomes deste domínio (`mem_maryane`, `agt_classificador`, `agt_lancamento`...). Também protege `apps/web`'s `run()` (Plan 01-07), que já chama `syncIdSequence` no cliente para todo `run()` bem-sucedido.

## Issues Encountered

Nenhum além do deviation acima (que já cobre a investigação: reproduzido isoladamente fora do Fastify — `OPERACOES.runScheduledAutomations` direto, depois com `hidratar()`+`syncIdSequence` — para confirmar que a causa era `syncIdSequence`, não a rota nem `gravar()`).

## User Setup Required

None - `SUPABASE_URL`/`SUPABASE_SECRET_KEY`/`DATABASE_URL` já configurados em `apps/api/.env` desde plans anteriores; os testes com banco rodaram (não pularam).

## Next Phase Readiness

- Critério 2 do ROADMAP (lado servidor) fechado: toda operação dos 16 módulos chega por `POST /operacoes/:nome` e roda na Unidade de Trabalho com o Membro da sessão.
- D-03 (diff + revisão), D-04 (`GET /estado`), D-06 (`revisaoAnterior`/409) implementados e testados contra o Postgres real.
- Plan 01-05 (bootstrap do Espaço "Gestão") pode contar com `semear()` já devolvendo a mesma forma de `Diferenca` usada em produção.
- Plan 01-07 (já commitado) consome exatamente este contrato via `transporte.ts` — nenhuma divergência de nome de campo encontrada entre o que a rota devolve (`ok`, `value`/`error`/`field`, `diferenca`, `revisao`, `revisaoAnterior`) e o que `CorpoDeOperacao` em `transporte.ts` espera; nada para Plan 01-09 (e2e) reconciliar neste ponto.
- O fix de `syncIdSequence` é uma correção de domínio que beneficia tanto `apps/api` (esta plan) quanto `apps/web` (Plan 01-07, já em produção) — nenhuma ação adicional necessária nos dois lados, só o fix em si.
- Nenhum bloqueio conhecido para os planos seguintes desta fase. PERS-08 (onde o `apps/api` roda) continua bloqueado por D11, fora do escopo desta plan.

---
*Phase: 01-o-crm-n1-ganha-persist-ncia-e-login*
*Completed: 2026-09-16*

## Self-Check: PASSED

Todos os 11 arquivos citados (10 de código + este SUMMARY.md) encontrados em disco; os dois hashes de task (`252359f`, `e87e6b8`) encontrados em `git log --oneline --all`.
