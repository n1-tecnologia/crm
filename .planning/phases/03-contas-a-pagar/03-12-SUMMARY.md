---
phase: 03-contas-a-pagar
plan: 12
subsystem: domain
tags: [contas-a-pagar, lote, batch-status-change, pag-05, dec-06, a1-recorrencia]

# Dependency graph
requires:
  - phase: 03-contas-a-pagar
    provides: "03-03 travou as regras de vencimento de A1 (D3-05/D3-06/D3-07); 03-06 deixou o molde de operação nova em módulo próprio e os blocos de `registro.ts`/`index.ts` que este plano estende como irmão"
provides:
  - "`alterarStatusEmLote(state, actingMemberId, taskIds, statusId)` — registrada em `OPERACOES`, alcançável por `POST /operacoes/alterarStatusEmLote`"
  - "`LIMITE_DO_LOTE = 200`, `ResultadoDoItem`, `ItemDeLote`, `RelatorioDeLote` — `packages/dominio/src/operations/lote.ts`"
  - "convenção de valor: Registro `\"Status alterado em lote\"` com `objectType: \"list\"`, contagens no `detail`, nunca título de Tarefa nem valor"
  - "o contrato exato que 03-13 renderiza: quatro resultados por item (`alterada`/`jaEstava`/`recusada`/`parcial`), a aritmética que fecha, `LIMITE_DO_LOTE` exportado para a tela desabilitar o botão"
affects: [03-13]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Falha parcial como valor, não exceção: um relatório com quatro contagens e um item por Tarefa, nunca `ok: false` por causa de um item isolado"
    - "Curto-circuito ANTES de delegar: uma Tarefa já no Status alvo nunca chama `changeTaskStatus` — evita o redisparo de Automações de entrada em Status que a chamada normal produziria com `before.id === target.id`"
    - "Delegação total de permissão/regra a uma função já existente (`changeTaskStatus`), com UMA exceção documentada (a leitura de `memberSeesTask` para o curto-circuito) — o padrão que fecha o furo clássico de \"checagem de permissão do lote\""
    - "Registro consolidado por Lista, agregando contagens por `Map<listId, contagens>`, escrito só quando algo mudou de verdade"

key-files:
  created:
    - packages/dominio/src/operations/lote.ts
    - packages/dominio/src/operations/lote.test.ts
    - apps/api/src/rotas/esquemas/lote.ts
    - apps/api/src/e2e/lote-contas-a-pagar.test.ts
  modified:
    - packages/dominio/src/operations/registro.ts
    - packages/dominio/src/operations/index.ts
    - packages/dominio/CONTEXT.md
    - apps/api/src/rotas/esquemas-de-argumentos.ts
    - apps/api/src/rotas/esquemas-de-argumentos.test.ts
    - apps/api/src/rotas/esquemas/CONTEXT.md
    - apps/api/src/e2e/CONTEXT.md

key-decisions:
  - "Uma transação para o lote inteiro, nunca N: 61 < 250 (a constante que 03-10 justificou) não é uma segunda decisão, é a mesma regra aplicada a um N menor — `LIMITE_DO_LOTE = 200` é o que mantém isso uma decisão e não um acidente"
  - "O lote NÃO tem checagem de permissão própria: delega inteiramente a `changeTaskStatus` item a item (permissão, RN-CP-02, RN-CP-04, A1); a única exceção é o curto-circuito `jaEstava`, que consulta `memberSeesTask` diretamente"
  - "Falha parcial não derruba o lote: os 61 fatos são independentes (ao contrário da Tarefa + linha de ledger de 03-10, que são duas metades do MESMO fato)"
  - "T-3-45: `titulo`/`readableId` só são omitidos quando a Tarefa não existe ou o Membro não a enxerga — outras recusas (RN-CP-02/04, status fora da Lista) mantêm os dois, porque o ator já sabia que a Tarefa existia"
  - "Achado pinado, não corrigido: `RN-CP-05` diz que `aprovado`/`negado` não disparam recorrência, mas `isTerminalCategory` inclui `concluido` — um lote para `negado` sobre contas recorrentes CRIA ocorrências hoje (caso k). Corrigir mexeria em `derive.ts`/`tasks.ts`, fora deste plano."
  - "DEC-06 medido, não estimado: contra `ws_lote_teste` (Espaço isolado), `tLote` (1 lote de 61) ficou entre 1,3–1,6s e `tN` (61 chamadas individuais) entre 73–79s — 45×–49× mais lento. `t1` (a escrita mais barata possível) já custou ~1,1–1,2s: o gargalo é a hidratação/latência do pooler, que TODA escrita paga, não o tamanho do lote."
  - "A medida definitiva contra `ws_n1` com o volume real (~2.900 Tarefas de 03-10) fica ABERTA: a importação real de 03-10 (Task 4) ainda não rodou (`importacao_ledger` para `clickup:901107637383` = 0), então o número de referência de DEC-06 não está fechado — ver Observações para o usuário"

requirements-completed: [PAG-05]

# Metrics
duration: 75min
completed: 2026-09-23
---

# Phase 03 Plan 12: O fechamento em lote das contas (PAG-05, critério 5)

**`alterarStatusEmLote` fecha N Tarefas num só gesto por `POST /operacoes/alterarStatusEmLote` — uma transação, uma hidratação, delegação total de permissão/A1 a `changeTaskStatus`, falha parcial como valor no relatório — verificado com 61 fechamentos reais contra o Supabase da plataforma.**

## Performance

- **Duration:** ~75 min
- **Started:** 2026-09-23T15:15Z (aprox.)
- **Completed:** 2026-09-23T16:30Z (aprox.)
- **Tasks:** 4 (3 completas, Task 4 auto-aprovada em modo autônomo com achado registrado — ver Observações)
- **Files modified:** 11 (4 criados, 7 modificados)

## Accomplishments

- **PAG-05 fechado no domínio e alcançável por HTTP.** `alterarStatusEmLote` está em `OPERACOES` e responde em `POST /operacoes/alterarStatusEmLote`, sem rota nova e sem tocar `app.ts` — a rota genérica de `apps/api/src/rotas/operacoes.ts` (CON-02) resolve tudo.
- **A decisão de tamanho de transação está tomada com números, não adiada.** Uma transação para o lote inteiro (não 61, não picotado): 61 < 250 é a mesma aritmética de 03-10 aplicada a um N menor; `LIMITE_DO_LOTE = 200` transforma "selecionei as 2.861" numa recusa de domínio antes de qualquer escrita.
- **O lote não tem permissão própria — e há teste que prova isso.** Cada fechamento é uma chamada de `changeTaskStatus`, item a item: RN-CP-02, RN-CP-04, `memberSeesTask` e A1 vêm todos de lá. Os casos `(f)`/`(g)`/`(g.2)` do domínio provam que ator errado e Membro sem visibilidade não furam nada, item a item.
- **Falha parcial é contrato, não acidente.** Quatro resultados por item (`alterada`/`jaEstava`/`recusada`/`parcial`), aritmética `solicitadas === alteradas + jaEstavam + recusadas + parciais` verificável em todo caso de sucesso, e uma conta incompleta não derruba as outras 60 — provado no domínio (caso `d`) e de ponta a ponta contra o Postgres real (caso `e` do e2e).
- **Reexecução é inócua, e a razão está documentada.** `jaEstava` curto-circuita ANTES de `changeTaskStatus` — sem isso, a reexecução redispararia as Automações de entrada em Status (T-3-46). Provado no domínio (`state.activity`/`state.automationExecutions` idênticos) e contra o banco real (`revisao` avança exatamente 1, mesmo no no-op — a diferença declarada em relação a 03-10, cuja barreira de idempotência é consultável ANTES de hidratar).
- **DEC-06 medido de verdade, não assumido.** O e2e roda contra o Supabase da plataforma (projeto `epomplsskqpluxuujpxl`) e imprime `[lote] t1=…ms · tLote=…ms · tN=…ms · tN/tLote=…` — `tLote` ficou 45×–49× mais rápido que `tN` (61 transações individuais), confirmando a tese central do plano mesmo antes da medida final contra `ws_n1`.
- **Um achado real foi pinado, não escondido.** `RN-CP-05` diz que `aprovado`/`negado` não disparam recorrência; o código trata os dois como `concluido` (terminal), então hoje um lote para `negado` sobre contas recorrentes cria ocorrências. O caso `(k)` prova o comportamento real; corrigir é fora de escopo (mexeria em `derive.ts`/`tasks.ts`) e a decisão fica com o dono.

## Task Commits

1. **Task 1 (RED): casos (a)…(k) antes da operação existir** — `bee84a5` (test)
2. **Task 1 (GREEN): `lote.ts` — `alterarStatusEmLote`, `LIMITE_DO_LOTE`, `RelatorioDeLote`** — `14325a2` (feat)
3. **Task 2: `OPERACOES`, o barril, o schema de transporte e a decisão em `CONTEXT.md`** — `b6783b5` (feat)
4. **Task 3: o e2e contra o Postgres real — revisão +1, DEC-06 medido** — `e93309d` (test)
5. **Task 4: checkpoint de medição contra `ws_n1`** — sem commit de código (execução e leitura); achado registrado abaixo

**Plan metadata:** o commit `docs(03-12): …` (SUMMARY + STATE + ROADMAP + REQUIREMENTS), logo depois deste.

## Files Created/Modified

- `packages/dominio/src/operations/lote.ts` *(criado, 243 linhas)* — cabeçalho de intenção (CON-CP-11, delegação total, A1 como Regra da Tarefa, a forma da transação, idempotência), `LIMITE_DO_LOTE`, `ResultadoDoItem`, `ItemDeLote`, `RelatorioDeLote`, `alterarStatusEmLote` em 4 passos (guardas → laço item a item → Registro consolidado por Lista → `ok`)
- `packages/dominio/src/operations/lote.test.ts` *(criado, 11 casos)* — `(a)` 61→61 ocorrências com o vencimento exato de D3-06/D3-07; `(b)` reexecução inócua; `(d)` falha parcial; `(e)` aritmética; `(f)` ator errado; `(g)`/`(g.2)` visibilidade item a item; `(h)` guardas do gesto; `(i)` status fora da Lista; `(j)` Registro consolidado; `(k)` o achado pinado
- `apps/api/src/rotas/esquemas/lote.ts` *(criado)* — `LOTE = { alterarStatusEmLote: z.tuple([z.array(ID), ID]) } satisfies Esquemas`, sem `.max()` (limite é regra de negócio) e sem `z.enum`
- `apps/api/src/e2e/lote-contas-a-pagar.test.ts` *(criado, 6 casos)* — `ws_lote_teste` isolado, duas identidades (`maryane`→Financeiro, `aprovador`→`CP.aprovadorId`), `garantirAprovador()` supre o que `buildGestaoBootstrap` (fixtures:false) não grava, `semear()` cria contas numa transação só
- `packages/dominio/src/operations/registro.ts` — bloco `// ── lote.ts ──` (import) + entrada em `OPERACOES`, depois do bloco de 03-06
- `packages/dominio/src/operations/index.ts` — `export * from "./lote"` + `instrumentar("alterarStatusEmLote")`
- `packages/dominio/CONTEXT.md` — seção `## Mudança de Status em lote: uma transação por gesto, recusa por item (PAG-05)`, ao fim do arquivo
- `apps/api/src/rotas/esquemas-de-argumentos.ts` — import + spread de `LOTE`; contagem de operações/arquivos corrigida de 200/21 para 202/22 (conferida, não presumida)
- `apps/api/src/rotas/esquemas-de-argumentos.test.ts` — contador de operações registradas, `201 → 202` (ver Desvios)
- `apps/api/src/rotas/esquemas/CONTEXT.md` — linha nova na tabela (`lote.ts` → `lote.ts`), contagens atualizadas
- `apps/api/src/e2e/CONTEXT.md` — parágrafo do segundo cenário, citando DEC-06

## Decisions Made

Ver `key-decisions` no frontmatter — resumo: uma transação para o lote inteiro (não N, não picotado); `LIMITE_DO_LOTE = 200`; zero permissão própria (delegação total a `changeTaskStatus`, exceto o curto-circuito `jaEstava`); falha parcial é contrato; RN-CP-05×`isTerminalCategory` pinado como achado, não corrigido; DEC-06 medido contra `ws_lote_teste` com resultado direcional forte, mas a medida definitiva contra `ws_n1` fica pendente (ver Observações para o usuário).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Contador de operações registradas de `apps/api` fixo em literal**

- **Encontrado durante:** Task 2, na primeira rodada da suíte de `apps/api`
- **Problema:** `apps/api/src/rotas/esquemas-de-argumentos.test.ts` asserta `expect(chaves.length).toBe(201)` (título do caso `h` e asserção do caso `j`). `alterarStatusEmLote` é a 202ª operação em `OPERACOES`; a suíte caiu (`1 failed | 10 passed`). Mesmo padrão exato que 03-06 encontrou ao registrar `converterSolicitacaoEmContaAPagar` (200→201).
- **Correção:** `201 → 202` nas duas ocorrências, com o comentário do caso `(j)` estendido citando `alterarStatusEmLote (Plan 03-12, PAG-05)`. A asserção que importa de verdade (`chaves.sort()` igual a `Object.keys(OPERACOES).sort()`) não foi tocada.
- **Por que é correção e não escopo novo:** o contador existe para flagrar operação nova sem schema; ele fez o trabalho dele.
- **Arquivo:** `apps/api/src/rotas/esquemas-de-argumentos.test.ts`
- **Commit:** `b6783b5`

**2. [Rule 3 — Blocking] `gr_cp_aprovador` (a concessão do Aprovador) é fixture-only, e o e2e precisa dela**

- **Encontrado durante:** Task 3, ao desenhar `garantirAprovador()`
- **Problema:** `buildGestaoBootstrap` (usado por `bootstrapGestao()`) chama `applyContasAPagar(state, clock, { fixtures: false })` — grava só a Maryane. A concessão `gr_cp_aprovador` (`editar` em `lst_contas_a_pagar` para `CP.aprovadorId`) só existe com `fixtures: true` (D-08: o Aprovador entra por convite em produção). Sem ela, `memberReachesContainer` bloqueia o Aprovador na Lista (Espaço privado, sem concessão) e o e2e não conseguiria fechar nenhuma conta em "pago".
- **Correção:** `garantirAprovador()` grava o Membro e a concessão diretamente, no mesmo molde que `conversao-de-solicitacao.test.ts` já usa para o mesmo motivo (fixture de Membro + Grant sobre `buildGestaoBootstrap`).
- **Arquivo:** `apps/api/src/e2e/lote-contas-a-pagar.test.ts`
- **Commit:** `e93309d`

---

**Total deviations:** 2 auto-fixed (2 Rule 3 — Blocking)
**Impact on plan:** As duas são correções mecânicas — nenhuma mudou o desenho do lote nem o contrato de `RelatorioDeLote`. Sem elas, `npm run check` cairia (desvio 1) ou o e2e nunca chegaria a medir nada (desvio 2).

## Issues Encountered

- **Verificação por mutação no curto-circuito `jaEstava`.** Removido temporariamente o bloco `if (task.statusId === statusId) { … jaEstava …; continue; }` de `lote.ts`: os casos `(b)` e `(j)` do domínio caíram como esperado (`(b)`: `alteradas` virou 61 em vez de 0 na reexecução; `(j)`: dois Registros consolidados em vez de um). Restaurado byte a byte (`git diff --quiet` antes do commit).
- **`npm run check` monolítico estoura o teto de 600s da ferramenta** (mesmo padrão de 03-03/03-04/03-06/03-09): decomposto por workspace, com a suíte de `apps/api` (com `DATABASE_URL`) rodada em segundo plano.

## Verificação do portão (CON-05)

| Etapa | Resultado |
|---|---|
| `typecheck` (dominio, api, web) | 0 nos três workspaces |
| `lint` (eslint, `@n1/web`) | 0 |
| `verificar:tokens` | ✓ 392 definidos · 211 arquivos · 0 falhas |
| `test` `@n1/dominio` | **465 passed** (454 antes + 11 novos) |
| `test` `@n1/web` | 107 passed |
| `test` `@n1/api` sem `DATABASE_URL` | 470 passed, 12 skipped |
| `test` `@n1/api` com `DATABASE_URL` (real, projeto `epomplsskqpluxuujpxl`) | **56 arquivos, 476 passed, 12 skipped, 0 falhas** (974s — latência do pooler acima do normal nesta rodada, consistente com o `t1` medido na Observação 1) |
| `test -w @n1/api -- lote-contas-a-pagar` (isolado, com `DATABASE_URL`) | **6/6 passed** — medido duas vezes, resultados consistentes |
| `test -w @n1/api -- lote-contas-a-pagar` (isolado, `DATABASE_URL=""`) | suíte inteira pulada (0 rodados) |
| `test -w @n1/api -- esquemas-de-argumentos` | 11/11 passed (após o desvio 1) |

`npm run check` decomposto por workspace (o monolítico estoura o teto de 600s da ferramenta, mesmo padrão de 03-03/03-04/03-06/03-09): verde nos três workspaces, com e sem `DATABASE_URL`.

Critérios de `grep` do plano, todos conferidos:

| Critério | Esperado | Resultado |
|---|---|---|
| `fetch(`/`process.env`/`require(`/`node:` em `lote.ts` | 0 | 0 |
| `runListAutomations`/`runScheduledAutomations`/`spawnNextOccurrence` em `lote.ts` | 0 | 0 |
| `export function alterarStatusEmLote` em `lote.ts` | 1 | 1 |
| `alterarStatusEmLote` em `registro.ts` | 2 | 2 |
| `instrumentar("alterarStatusEmLote")` em `index.ts` | 1 | 1 |
| `alterarStatusEmLote` em `esquemas/lote.ts` | 1 | 1 |
| `.max(` em `esquemas/lote.ts` | 0 | 0 |
| `LOTE` em `esquemas-de-argumentos.ts` | ≥2 | 2 |
| `lote.ts` em `esquemas/CONTEXT.md` | ≥1 | 1 |
| `CONTEXT.md` do domínio contém as três strings exigidas | sim | sim |
| `new Pool` no e2e | 0 | 0 |
| `ws_n1` literal no e2e | 0 | 0 |
| `ws_lote_teste` no e2e | ≥3 | 4 |
| `DEC-06` em `e2e/CONTEXT.md` | ≥1 | 2 |
| `git diff --quiet` em `operations.test.ts`, `recorrencia-contas-a-pagar.test.ts`, `conversao-de-solicitacao.test.ts` | limpo | limpo |
| `git diff --quiet` em `tasks.ts`, `derive.ts`, `collaboration.ts` | limpo | limpo |
| `git diff --quiet` em `app.ts`, `index.ts`, `operacoes.ts`, `package.json` (api) | limpo | limpo |

`apps/web` e `../financeiro-tria/automation` sem diff nesta rodada.

## Threat Flags

Nenhuma superfície nova fora do `<threat_model>` do plano. `POST /operacoes/alterarStatusEmLote` é o entregável declarado, alcançado pela rota genérica (nenhum `app.ts` tocado). T-3-45 (permissão item a item), T-3-46 (curto-circuito `jaEstava`), T-3-47 (uma transação + `LIMITE_DO_LOTE`), T-3-48 (Registro consolidado) e T-3-49 (motivo literal, sem vazamento) estão mitigadas e cada uma tem caso de teste nomeado no domínio; T-3-50 é honrada sem guarda nova (caso `i`). T-3-SC: nada foi instalado.

## Observações para o usuário

1. **A medição de DEC-06 (isolada, `ws_lote_teste`).** `[lote] t1≈1,15–1,18s · tLote≈1,50–1,62s · tN≈73–80s · tN/tLote≈45–49`. `tLote < 3×t1 + 1000ms` e `tN > 3×tLote` — as duas asserções do e2e passaram com folga larga. **`t1` (a escrita mais barata possível) já custa mais de 1 segundo** — bem acima do teto de referência de 600ms que a Task 4 cita: o gargalo é a hidratação do Espaço mais a latência do pooler do Supabase (`aws-0-us-west-2.pooler.supabase.com`), que **toda** escrita paga, não só o lote. Se este número incomodar, o alvo de otimização é a hidratação/latência de rede, não o tamanho do lote — o lote em si já é, comparativamente, 45×–49× mais barato que 61 transações individuais.

2. **A medida definitiva contra `ws_n1` (Task 4) NÃO foi possível — precondição de outro plano não satisfeita.** `select count(*) from plataforma.importacao_ledger where origem = 'clickup:901107637383'` devolveu **0**, não 2861: a importação real de 03-10 (a Task 4 daquele plano, `--apply` contra `ws_n1`) ainda não rodou — é um checkpoint bloqueante parado, aguardando o operador, e documentado em `03-10-SUMMARY.md`/`STATE.md` desde antes deste plano. Medir o lote contra um `ws_n1` de ~90 registros (como está agora — `revisao = 3`, sem as ~2.900 Tarefas da importação) não responderia a pergunta que a Task 4 faz: "qual o custo de hidratar o Espaço no tamanho real?". Por isso a Task 4 foi **auto-aprovada em modo autônomo com o achado registrado**, em vez de fabricar uma medida contra um Espaço vazio — a instrução do próprio plano (`03-12-PLAN.md`, Task 4, passo 2) é explícita: "se ainda não rodou, a medida é de um Espaço vazio e não vale — parar e reportar, não improvisar". `ws_n1` foi confirmado INTOCADO por este plano (`revisao` idêntica antes/depois de toda a sessão, `select revisao from plataforma.workspaces where workspace_id = 'ws_n1'` = 3 em ambas as leituras). **Ação pendente, mesma família de 03-10 Task 4:** quando o operador rodar a importação real, repetir `npm run test -w @n1/api -- lote-contas-a-pagar` com `DATABASE_URL` de produção e colar a nova linha `[lote]` — a medida de `ws_lote_teste` acima já dá confiança direcional forte de que `tLote` vai ficar bem abaixo do teto de 2.000ms, mas o número definitivo depende do volume real.

3. **Quem fecha em "pago" é o Aprovador, não o Financeiro.** O critério 5 do ROADMAP diz "o Financeiro fecha 61 contas", mas `CP.status.pago` tem `entryAllowedMemberIds: [CP.aprovadorId, CP.aprovadorKonqId]` e RN-CP-04 é explícita — a mesma nuance que 03-04 e outros planos já registraram. O gesto de lote do Financeiro é a movimentação até "em autorização bancária"; o fechamento em "pago" é do Aprovador. A operação serve os dois sem distinção — o que muda é o token de quem aperta. O e2e usa as duas identidades corretamente (`maryane` até "em autorização bancária" via `semear()`/transições individuais quando necessário; `aprovador` para o lote até "pago").

4. **A diferença declarada em relação a 03-10.** A reexecução do lote AQUI abre transação e avança `revisao` em 1 (medido: caso `c` do e2e), porque a barreira de idempotência (`task.statusId`) só existe no estado hidratado — ao contrário de `importacao_ledger` (03-10), que é consultável ANTES de hidratar. Nenhuma Tarefa é remexida em nenhum dos dois casos; o que difere é só o número de `revisao`.

5. **Achado sobre RN-CP-05 (não corrigido, fora de escopo).** `RN-CP-05` diz que "aprovado" e "negado" não disparam recorrência, mas `isTerminalCategory` (`derive.ts:199-202`) inclui `concluido` (a categoria de ambos): hoje um lote para "negado" sobre contas recorrentes CRIA ocorrências (caso `k` do domínio, pinado por teste). Corrigir exigiria mexer em `derive.ts`/`tasks.ts` e quebraria expectativa existente (CON-05) — decisão do dono.

## Next Phase Readiness

- **03-13 (a tela) pode começar sem esperar Task 4.** O contrato inteiro que 03-13 renderiza está fechado e testado: `RelatorioDeLote`, os quatro resultados por item, `LIMITE_DO_LOTE` exportado, o envelope HTTP de sempre. Nada disso depende do número final de DEC-06.
- **Ação carregada para quando 03-10 Task 4 rodar:** repetir a medição de DEC-06 contra `ws_n1` real (ver Observação 2) — mesma família de pendência, não um blocker novo.
- **PAG-05 marcado como requisito concluído.** A ressalva de DEC-06-contra-volume-real fica em `STATE.md` (Blockers/Concerns), no mesmo padrão que PAG-01/PAG-04/PAG-06 já usam para pendências de produção que não bloqueiam o código.

## Known Stubs

Nenhum. A operação está completa, registrada, testada em memória e contra o Postgres real, e alcançável por HTTP.

## Self-Check: PASSED

Os quatro arquivos criados existem em disco (`lote.ts`, `lote.test.ts`,
`esquemas/lote.ts`, `e2e/lote-contas-a-pagar.test.ts`); os quatro commits de
task (`bee84a5`, `14325a2`, `b6783b5`, `e93309d`) existem no histórico.
