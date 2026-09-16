---
phase: 00-prepara-o
plan: 02
subsystem: api
tags: [clickup, de-para, identidade, inviteMember, importacao]

# Dependency graph
requires:
  - phase: 00-prepara-o (plan 01)
    provides: "criarClienteClickUp / ClienteClickUp em apps/api/src/importacao/clickup/cliente.ts"
provides:
  - "DE_PARA_USUARIOS (6 entradas) e entradaPorClickupId em apps/api/src/importacao/clickup/de-para-usuarios.ts"
  - "CATALOGO_CLICKUP (62 variáveis CLICKUP_*/MP_CLICKUP_*/FO_CLICKUP_*) no mesmo arquivo"
  - "usuarios.cli.ts — npm run clickup:usuarios -w @n1/api, resolve ClickUp id → username + e-mail pela API real"
affects: ["00-03", "00-04", "Phase 2 (importação da Lista de Solicitação)", "Phase 3"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tabela tipada exaustiva (molde de colecoes.ts): união literal de roleIdEsperado cruzada em teste contra o bootstrap real, não uma lista fixa copiada"
    - "Estado 'não resolvido' explícito (fonteDoEmail: 'nao-resolvido' + email vazio) em vez de placeholder inventado — inviteMember recusa e-mail vazio sozinho, o que impede a entrada de virar Membro por acidente antes de o dono confirmar o e-mail real"

key-files:
  created:
    - apps/api/src/importacao/clickup/de-para-usuarios.ts
    - apps/api/src/importacao/clickup/de-para-usuarios.test.ts
  modified: []

key-decisions:
  - "5 dos 6 e-mails resolvidos via GET /team da API real do ClickUp (Elifas, Fabíola, Thiago, Iallas, Financeiro/Maryane); o 6º (revisor FO, 81581802) não foi encontrado em GET /team, nas 3 GET /list/{id}/member do Financeiro Tria nem na 1ª página de Tarefas da Solicitação — hipótese mais provável é pertencer ao Team Family Office/Marcos Paulo (9011658148), fora do alcance do token usado (só confirmado para o Team Tria 9011731314) e das 3 Listas do Financeiro Tria cobertas por usuarios.cli.ts"
  - "Para o item não resolvido, em vez de inventar um e-mail plausível (proibido pela orientação de continuação), a entrada usa fonteDoEmail: 'nao-resolvido' e email: '' — uma extensão do union type original (clickup-api | dono) para um terceiro estado honesto, documentada como Rule 2 (funcionalidade de correção: impede silenciosamente que uma identidade não verificada vire Membro)"
  - "Rule 1 (bug): CLICKUP_CONTAS_A_PAGAR_ID e as variantes MP_/FO_ foram reclassificadas de 'id-de-lista' (heurística de nome do plano) para 'id-de-usuario' — o código real (tenants/*/config.ts, campo contasAPagarUserId, valor padrão 81581816) mostra que é o ClickUp user id do Financeiro, não uma Lista"
  - "PREP-04 fica PARCIAL: a tabela e o catálogo estão implementados, testados e tipados, mas 1 dos 6 e-mails de identidade (revisor FO, 81581802) continua sem valor real — ver 'Item em aberto' abaixo. Requisito NÃO marcado como completo em REQUIREMENTS.md."

patterns-established:
  - "Quando uma fonte externa (API/repositório de terceiros) não resolve 100% de um conjunto conhecido de ids, a entrada correspondente fica explícita (estado 'nao-resolvido' + valor vazio que a validação de domínio recusa) em vez de um placeholder que passaria despercebido nos greps de higiene"

requirements-completed: []

# Metrics
duration: ~24min (Task 1 commit 3daa954 → Task 2 commit a7cc636; inclui a pausa do checkpoint humano entre as duas)
completed: 2026-09-16
---

# Phase 00 Plan 02: De-para de usuários do ClickUp Summary

**De-para tipado de 6 ClickUp user ids → e-mail + Papel esperado (5 resolvidos pela API real, 1 em aberto e explicitamente marcado, não inventado) mais o catálogo de 62 variáveis `CLICKUP_*`/`MP_CLICKUP_*`/`FO_CLICKUP_*` do `automation/` do financeiro-tria, cruzado com o bootstrap de produção real via 10 testes.**

## Performance

- **Duration:** ~24 min entre os dois commits de task (a sessão foi retomada após um checkpoint humano — ver Auth Gates abaixo)
- **Started:** 2026-09-16T20:22:58-03:00 (Task 1, sessão anterior)
- **Completed:** 2026-09-16T20:46:53-03:00 (Task 2, esta sessão)
- **Tasks:** 2 (Task 1 completada em sessão anterior; Task 2 completada nesta continuação)
- **Files modified:** 3 (2 criados nesta task; `usuarios.cli.ts` criado na Task 1)

## Accomplishments
- `DE_PARA_USUARIOS`: 6 entradas — 5 com e-mail real resolvido pela API do ClickUp (`GET /team`), 1 explicitamente em aberto (revisor FO)
- Colisão de identidade do Financeiro (`81581816` = `mem_maryane`) tratada por `memberIdConhecido`, provada contra o `buildGestaoBootstrap()` real
- `CATALOGO_CLICKUP`: 62 variáveis (38 sem prefixo do tenant Tria + 11 `MP_` + 13 `FO_`), cada uma com tipo, uso (arquivo:contexto do `automation/`) e, quando aplicável, o ClickUp id/lista/status/tag conhecido — sem nenhum segredo
- Correção de uma classificação errada do próprio plano (`CLICKUP_CONTAS_A_PAGAR_ID` é id de usuário, não de lista) descoberta ao ler o código real em vez de confiar só no padrão de nome da variável
- 10 casos de teste, todos passando sem `CLICKUP_API_TOKEN`/`DATABASE_URL`; `npm run check` verde nos três workspaces (dominio 253, api 97, web 53)

## Task Commits

Each task was committed atomically:

1. **Task 1: `usuarios.cli.ts` — resolver ClickUp id → username + e-mail pela API** - `3daa954` (feat) — sessão anterior
2. **Task 2: `de-para-usuarios.ts` — 6 entradas tipadas + catálogo `CLICKUP_*` + teste** - `a7cc636` (feat) — esta continuação

_Nenhuma task usou TDD formal separado em commits (test → feat); o teste nasceu junto com o código na Task 2, num commit único, como o restante do repositório já faz._

## Files Created/Modified
- `apps/api/src/importacao/clickup/de-para-usuarios.ts` - `EntradaDeParaUsuario`, `DE_PARA_USUARIOS` (6), `entradaPorClickupId`, `VariavelClickUp`, `CATALOGO_CLICKUP` (62)
- `apps/api/src/importacao/clickup/de-para-usuarios.test.ts` - 10 casos (a-j): forma exaustiva, e-mails únicos/não-teste, roleId real do bootstrap, colisão Maryane, catálogo 38+24, entraNoDePara cruzado, sem segredo, compat de tipo com `inviteMember`, e-mail vazio recusado pelo domínio
- `apps/api/src/importacao/clickup/usuarios.cli.ts` - já criado na Task 1 (sessão anterior); rodado nesta continuação para obter os 5 e-mails resolvidos

## Decisions Made
Ver `key-decisions` no frontmatter. Resumo: 5/6 e-mails vieram da API real do ClickUp; o 6º (revisor FO) ficou como item em aberto, explícito no código (`fonteDoEmail: "nao-resolvido"`, `email: ""`) em vez de um valor inventado — decisão direta da continuação desta execução, que instruiu não inventar dado e registrar como pendência do dono.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `CLICKUP_CONTAS_A_PAGAR_ID` (e variantes `MP_`/`FO_`) reclassificadas de `id-de-lista` para `id-de-usuario`**
- **Found during:** Task 2, ao ler `tenants/*/config.ts` do `financeiro-tria` para preencher `uso`/`tipo` do catálogo
- **Issue:** A regra de tipo do plano (`*_CONTAS_A_PAGAR_ID → id-de-lista`) foi escrita por heurística de nome; o código real usa essa variável como `contasAPagarUserId`, com valor padrão `"81581816"` — o ClickUp user id do Financeiro, não o id de uma Lista (que é `CLICKUP_LIST_CONTAS_PAGAR_ID`, uma variável diferente)
- **Fix:** As 3 entradas do catálogo (`CLICKUP_CONTAS_A_PAGAR_ID`, `MP_CLICKUP_CONTAS_A_PAGAR_ID`, `FO_CLICKUP_CONTAS_A_PAGAR_ID`) usam `tipo: "id-de-usuario"`, `clickupUserId: "81581816"`, `entraNoDePara: true`
- **Files modified:** apps/api/src/importacao/clickup/de-para-usuarios.ts
- **Verification:** teste (g) cruza `entraNoDePara` com `entradaPorClickupId` para toda variável `id-de-usuario`/`ids-de-usuario`; `npm run typecheck -w @n1/api` verde
- **Committed in:** a7cc636 (Task 2 commit)

**2. [Rule 2 - Missing Critical] Estado explícito "não resolvido" para o e-mail do revisor FO, em vez do union original de 2 valores**
- **Found during:** Task 2, ao rodar `npm run clickup:usuarios -w @n1/api` (resultado desta continuação: 5/6 resolvidos)
- **Issue:** O `<interfaces>` do plano previa só `fonteDoEmail: "clickup-api" | "dono"`, assumindo que todo id seria resolvido por uma das duas fontes. `81581802` não foi resolvido por nenhuma; inventar um e-mail plausível violaria a instrução explícita de continuação ("do not invent a value") e poderia, no futuro, virar um Membro fantasma com identidade errada
- **Fix:** `fonteDoEmail` ganhou um terceiro valor, `"nao-resolvido"`; a entrada de `81581802` usa `email: ""` — string vazia que a validação de `inviteMember` (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) recusa por si só, tornando esta entrada segura contra uso acidental antes de o dono informar o e-mail real
- **Files modified:** apps/api/src/importacao/clickup/de-para-usuarios.ts, apps/api/src/importacao/clickup/de-para-usuarios.test.ts (caso j prova a recusa)
- **Verification:** teste (j) chama `inviteMember` com a entrada aberta e confirma `resultado.ok === false`; `grep -c "@n1.teste"`/`grep -ciE 'senha|password|secret'` = 0
- **Committed in:** a7cc636 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug de classificação, 1 funcionalidade de correção para o item em aberto)
**Impact on plan:** Nenhum desvio de escopo de código; o segundo ajuste é a única razão pela qual PREP-04 fica parcial (ver abaixo), não uma decisão de implementação isolada.

## Issues Encountered

**Item em aberto (bloqueio de dado, não de código): ClickUp user id `81581802` (revisor secundário do Family Office) não foi resolvido a um e-mail real.**

- `usuarios.cli.ts` (Task 1) tentou, nesta ordem, `GET /team` (Team Tria `9011731314`), `GET /list/{id}/member` das 3 Listas do Financeiro Tria (`901109104938`, `901107637383`, `901107648977`) e a 1ª página de Tarefas da Solicitação — nenhuma encontrou este id
- Resultado exato de `npm run clickup:usuarios -w @n1/api` nesta continuação: `5/6 resolvidos: 5 por team, 0 por list-member, 0 por task`
- Hipótese mais provável (não confirmada): este usuário pertence ao Team Family Office/Marcos Paulo (`9011658148`, distinto do Team Tria `9011731314`) ou a uma Lista do FO fora das 3 cobertas pelo CLI (`901109642259`, `901109642267`, `901111928443`) — o token usado não tem alcance confirmado nesses Teams/Listas
- **Não foi tratado como checkpoint bloqueante nesta execução** — por instrução explícita da continuação (evitar reabrir um checkpoint sobre o mesmo plano, registrar como item em aberto e prosseguir). A entrada existe no código (`clickupUserId: "81581802"`), tipada e testada, mas com `fonteDoEmail: "nao-resolvido"` e `email: ""`
- **Resolução necessária antes da Fase 2/3 usar esta entrada para convidar Membro:** o dono precisa informar o e-mail corporativo real deste revisor (ou confirmar acesso ao Team/Listas do Family Office para uma nova tentativa via `usuarios.cli.ts -- 81581802`)

## Known Stubs

| Item | Arquivo | Razão |
|------|---------|-------|
| Entrada `81581802` (revisor FO) em `DE_PARA_USUARIOS` | `apps/api/src/importacao/clickup/de-para-usuarios.ts` | `email: ""`, `fonteDoEmail: "nao-resolvido"` — e-mail real não obtido pela API nem informado pelo dono nesta execução; ver "Issues Encountered". A importação (Fases 2/3) NÃO deve chamar `inviteMember` com esta entrada até o e-mail ser preenchido — o próprio domínio já recusa (`email` vazio), mas a intenção fica documentada aqui para quem for consumir a tabela. |

## User Setup Required

**Uma decisão/dado do dono é necessário antes da Fase 2/3 poder convidar o revisor FO:**
- Informar o e-mail corporativo real do ClickUp user id `81581802` (revisor secundário do Family Office), OU
- Confirmar que o `CLICKUP_API_TOKEN` atual (ou um novo) tem acesso ao Team Family Office/Marcos Paulo (`9011658148`) e às Listas `901109642259`/`901109642267`/`901111928443`, para rodar `npm run clickup:usuarios -w @n1/api -- 81581802` novamente

Sem isso, a linha correspondente em `DE_PARA_USUARIOS` continua com `fonteDoEmail: "nao-resolvido"` — não bloqueia `npm run check` nem o restante da Fase 0, mas bloqueia o uso completo desta entrada específica na importação.

## Next Phase Readiness
- `DE_PARA_USUARIOS`/`entradaPorClickupId`/`CATALOGO_CLICKUP` prontos para a importação (Fases 2/3) usar 5 dos 6 ids sem nenhum trabalho adicional
- PREP-04 **não** marcado como completo em `.planning/REQUIREMENTS.md` — falta o e-mail real de `81581802` para fechar o requisito por completo (ver "Issues Encountered"/"User Setup Required")
- Nenhum bloqueio para 00-03 (exportador) ou 00-04 (manifesto) — nenhum dos dois depende do de-para

---
*Phase: 00-prepara-o*
*Completed: 2026-09-16*

## Self-Check: PASSED

Both created files found on disk (`apps/api/src/importacao/clickup/de-para-usuarios.ts`, `apps/api/src/importacao/clickup/de-para-usuarios.test.ts`); both commits (`3daa954`, `a7cc636`) found in `git log`.
