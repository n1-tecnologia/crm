---
phase: 05-contas-a-receber-e-os-outros-tenants
plan: 01
subsystem: api
tags: [dominio, evolver, integration, omie, multi-tenant, cli]

# Dependency graph
requires:
  - phase: 02-a-lista-de-solicitacoes-de-pagamento
    provides: "solicitacao-de-pagamento-evolver.ts como molde de evolver idempotente (criar-ou-conferir, nunca sobrescrever)"
  - phase: 01-fundacao
    provides: "bootstrapGestao() e o Espaço 'Gestão' › Pasta 'Financeiro' já em ws_n1"
provides:
  - "Integration com espaço para identidade de conta Omie por Empresa (empresa/omie/avisosPorCanal/statusDeclarados) — nunca app_key/app_secret"
  - "CATALOGO_CONFIGURACAO_POR_EMPRESA com as 6 Empresas (Tria, Konq/FINQ, Marcos Paulo, EXO Loteamento, EXO Participações, Oliveira Participações)"
  - "evoluirConfiguracaoPorEmpresa — evolver idempotente que acrescenta a opção 'Marcos Paulo' e as 6 Integrações a ws_n1"
  - "5º Status 'em revisão' (sts_sp_em_revisao, order 4) na Lista de Solicitações de pagamento"
  - "npm run empresas:configurar -w @n1/api — CLI dry-run por padrão"
affects: ["05-03 (roteamento por Empresa)", "05-05 (destinatário por Empresa)", "05-06 (canal WhatsApp)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Evolver idempotente por Empresa, mesmo molde de solicitacao-de-pagamento-evolver.ts (Plan 02-08)"
    - "Substituição de objeto inteiro (spread + override) para 'mutar' uma propriedade readonly de FieldDefinition.options, em vez de atribuição direta"
    - "Portão de segurança por nome de campo (regex sobre todas as chaves de um objeto, recursivo) para provar ausência estrutural de segredo"

key-files:
  created:
    - packages/dominio/src/configuracao-por-empresa.ts
    - packages/dominio/src/configuracao-por-empresa-evolver.ts
    - packages/dominio/src/configuracao-por-empresa-evolver.test.ts
    - apps/api/src/bootstrap/configuracao-por-empresa.ts
    - apps/api/src/bootstrap/configuracao-por-empresa.cli.ts
    - apps/api/src/bootstrap/configuracao-por-empresa.test.ts
  modified:
    - packages/dominio/src/types/workspace.ts
    - packages/dominio/src/solicitacao-de-pagamento.ts
    - packages/dominio/src/solicitacao-de-pagamento-evolver.test.ts
    - packages/dominio/src/seed-financeiro.ts
    - packages/dominio/src/solicitacao-de-pagamento.test.ts
    - packages/dominio/src/operations/conversao-de-solicitacao.test.ts
    - apps/api/package.json

key-decisions:
  - "Config por Empresa modelada na Integration (campo estruturado novo), não em Campos da Lista/Espaço — molde A8, decisão dentro do 'Claude's Discretion' do 05-CONTEXT.md"
  - "Passo (d) do evolver (recusar Integração apontando para Empresa inexistente) colocado logo após acrescentar a opção nova, antes de criar Integrações — mais seguro que a ordem literal do plano sem mudar nenhum resultado observável"
  - "fieldDefinitions[idx] = {...campo, options: [...]} em vez de atribuição direta — FieldDefinition.options é readonly na interface"

requirements-completed: [TEN-01]

# Metrics
duration: ~45min
completed: 2026-09-24
---

# Phase 05 Plan 01: Configuração por Empresa (TEN-01) Summary

**`Integration` ganha identidade de conta Omie por Empresa (rótulo, banco de categorias, avisos, Status declarados) e um evolver idempotente materializa as 6 Empresas contra `ws_n1`, sem nunca guardar `app_key`/`app_secret`.**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-09-24
- **Tasks:** 3/3
- **Files modified:** 13 (6 criados, 7 modificados)

## Accomplishments

- `Integration` (`packages/dominio/src/types/workspace.ts`) cresce com quatro campos opcionais e `readonly` — `empresa`, `omie` (`contaRotulo`/`bancoDeCategorias`/`ultimaRotacaoEm`), `avisosPorCanal.whatsapp` e `statusDeclarados` — nenhum campo para `app_key`/`app_secret` (D5-03).
- `CATALOGO_CONFIGURACAO_POR_EMPRESA` (`configuracao-por-empresa.ts`) com as 6 linhas literais: Tria Company, Konq Intermediações (FINQ, D5-08), Marcos Paulo (com `avisosPorCanal.whatsapp: ["mari","marcos","grupo-financeiro"]`, D5-10), EXO Loteamento/EXO Participações/Oliveira Participações (as três com `statusDeclarados: ["em revisão"]`, D5-06).
- `evoluirConfiguracaoPorEmpresa` (`configuracao-por-empresa-evolver.ts`): acrescenta a opção "Marcos Paulo" a `fd_cp_empresa` só se ausente; cria-ou-confere as 6 Integrações; recusa (sem gravar nada) se divergência ou se uma Empresa do catálogo não é opção válida; `int_omie` (a Integração genérica já em produção) nunca é tocada nem contada como sobra; `ultimaRotacaoEm` nunca é escrita por este evolver (D-13).
- 5º Status `em revisão` (`sts_sp_em_revisao`, `order: 4`) em `STATUS_SET_SOLICITACAO_DE_PAGAMENTO` — os 4 Status travados por D-01 continuam com o mesmo `order`, então o evolver de 02-08 não reporta divergência sobre o que já está em produção.
- Portão de segurança (T-5-01): um teste percorre recursivamente todas as chaves de todas as `Integration` do estado depois de evoluir e falha se alguma casar com `/app_?key|app_?secret|secret|senha|password|token/i`. Verificado empiricamente: acrescentei um `appKey` temporário ao evolver, rodei a suíte (falhou, capturando as 6 ocorrências), revertei e confirmei verde de novo.
- CLI `npm run empresas:configurar -w @n1/api` (dry-run por padrão): rodado de verdade contra `ws_n1` (produção) — `criados: 7, conferidos: 0, divergentes: 0`, nada gravado (rollback). Saída só com contagens e modo, nunca rótulo/nome/valor de Campo (T-5-07).

## Task Commits

Each task was committed atomically:

1. **Task 1: O tipo Integration cresce para identidade de conta — e só** - `3b1d045` (feat)
2. **Task 2: O evolver idempotente — a opção que falta, as 6 Integrações e o 5º Status** - `a3901b5` (feat)
3. **Task 3: O CLI que aplica contra ws_n1 — dry-run por padrão** - `0d80bcd` (feat)

_Nenhuma tarefa TDD — sem gate RED/GREEN formal, mas Task 1 escreveu o teste de segurança antes do evolver (Task 2) existir, no mesmo espírito._

## Files Created/Modified

- `packages/dominio/src/types/workspace.ts` — `Integration` ganha `empresa?`, `omie?`, `avisosPorCanal?`, `statusDeclarados?`
- `packages/dominio/src/configuracao-por-empresa.ts` — catálogo das 6 Empresas/Integrações (novo)
- `packages/dominio/src/configuracao-por-empresa-evolver.ts` — evolver idempotente (novo)
- `packages/dominio/src/configuracao-por-empresa-evolver.test.ts` — 8 casos, incluindo o portão de segurança (novo)
- `packages/dominio/src/solicitacao-de-pagamento.ts` — `SOL.status.emRevisao` + 5ª definição de Status
- `packages/dominio/src/solicitacao-de-pagamento-evolver.test.ts` — `definitions.length` de 4 para 5
- `packages/dominio/src/seed-financeiro.ts` — "Marcos Paulo" acrescentado às opções de `fd_cp_empresa`
- `apps/api/src/bootstrap/configuracao-por-empresa.ts` — `configurarEmpresas()` (novo)
- `apps/api/src/bootstrap/configuracao-por-empresa.cli.ts` — CLI (novo)
- `apps/api/src/bootstrap/configuracao-por-empresa.test.ts` — testes contra Postgres real (novo)
- `apps/api/package.json` — script `empresas:configurar`
- `packages/dominio/src/solicitacao-de-pagamento.test.ts` — deviation, ver abaixo
- `packages/dominio/src/operations/conversao-de-solicitacao.test.ts` — deviation, ver abaixo

## Decisions Made

- Config por Empresa modelada na `Integration` (não em Campos da Lista/Espaço) — é o mecanismo semanticamente mais próximo de A8 ("configured connection with an external system") e o que a UI-SPEC de `05-CONTEXT.md` já assume; ficava dentro do "Claude's Discretion" explícito do plano.
- No evolver, o passo "recusar se alguma Empresa do catálogo não é opção válida" foi colocado logo após acrescentar a opção nova (antes de criar as Integrações), em vez de estritamente depois de todo o laço de criação como o texto do plano sugere ao listar "(d) depois de (c)". Resultado observável idêntico para o catálogo atual (todas as 6 Empresas já são opções válidas depois do passo (b)); a ordem escolhida é mais defensiva para catálogos futuros.
- `fieldDefinitions[idx] = { ...campo, options: [...] }` em vez de `campo.options = [...]` — `FieldDefinition.options` é `readonly` na interface (`primitives.ts`); mutação de propriedade não compila, substituição de objeto sim.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `solicitacao-de-pagamento.test.ts` (a) proibia "em revisão" — quebrava com o 5º Status desta fase**
- **Found during:** Task 2 (adicionar `SOL.status.emRevisao`)
- **Issue:** O teste (herdado da Fase 2, D-01/D-14) afirmava "exatamente 4 Status" e listava "em revisão" entre os nomes proibidos — direto em conflito com D5-06 desta fase, que libera especificamente esse Status.
- **Fix:** Teste ajustado para 5 Status, com "em revisão" na lista esperada e removido da lista de proibidos (`convertida`/`recebida`/`em validação` continuam proibidos).
- **Files modified:** `packages/dominio/src/solicitacao-de-pagamento.test.ts`
- **Verification:** `npm run test -w @n1/dominio` — 488/488 verde
- **Committed in:** `a3901b5` (Task 2 commit)

**2. [Rule 1 - Bug] `conversao-de-solicitacao.test.ts` (a) tinha a mesma asserção travada em 4 Status**
- **Found during:** Task 2
- **Issue:** Mesmo padrão do item 1, checando também o lado do estado materializado (`lista.statusSet.definitions`), não só o catálogo.
- **Fix:** Ajustado para 5 Status/`toHaveLength(5)` nos dois lados; "em revisão" removido da lista de proibidos.
- **Files modified:** `packages/dominio/src/operations/conversao-de-solicitacao.test.ts`
- **Verification:** `npm run test -w @n1/dominio` — 488/488 verde
- **Committed in:** `a3901b5` (Task 2 commit)

**3. [Não é bug — sequenciamento de commit] Teste de segurança da Task 1 referencia o evolver da Task 2**
- **Found during:** Task 1
- **Issue:** O plano pede que `configuracao-por-empresa-evolver.test.ts` já nasça na Task 1 chamando `evoluirConfiguracaoPorEmpresa`, que só é criado na Task 2 — a compilação da Task 1 isolada dependeria de código que ainda não existe.
- **Resolução:** Escrevi e verifiquei o par (evolver + teste completo) antes de criar qualquer commit, depois dividi os arquivos entre os dois commits exatamente como `files_modified` de cada Task declara — o histórico reflete o limite de tarefa do plano, mas a verificação (`npm run typecheck`/`test`) só rodou depois que as duas Tasks estavam presentes no working tree. Não houve, em nenhum momento, um commit com código que não compila.
- **Files modified:** nenhum além do já listado
- **Committed in:** `3b1d045` (Task 1) e `a3901b5` (Task 2)

---

**Total deviations:** 3 (2 auto-fixed por Rule 1, 1 nota de sequenciamento sem impacto de escopo)
**Impact on plan:** Nenhum scope creep — as duas correções eram regressões diretas causadas pela mudança de catálogo desta própria Task; sem elas `npm run test -w @n1/dominio` ficaria vermelho.

## Issues Encountered

None além do documentado em Deviations.

## User Setup Required

None - nenhuma configuração de serviço externo. O único passo manual pendente é do OPERADOR, não de setup: rodar `npm run empresas:configurar -w @n1/api -- --apply` contra `ws_n1` quando decidir aplicar de verdade (o dry-run já confirmou `criados: 7, conferidos: 0, divergentes: 0`).

## Verificação executada nesta sessão (regras operacionais do projeto)

- `npm run typecheck -w @n1/dominio` — verde
- `npm run typecheck -w @n1/api` — verde
- `npm run typecheck -w @n1/web` — verde (o tipo `Integration` cresceu; a interface segue compilando)
- `npm run test -w @n1/dominio` — 488/488 verde (suíte inteira, rápida, autorizada pelas regras operacionais)
- `npm run lint` — verde
- `npm run test -w @n1/api -- src/bootstrap/configuracao-por-empresa.test.ts --testTimeout=20000` — 3/3 verde, contra Postgres real (`DATABASE_URL` presente neste checkout)
- `npm run empresas:configurar -w @n1/api` (dry-run, sem flag) rodado contra `ws_n1` real — `modo dry-run (nada gravado)`, `criados 7`, `conferidos 0`, `divergentes 0`
- **NÃO executado, por regra operacional do projeto:** `npm run check` completo, a suíte inteira de `@n1/api` sem filtro de arquivo, e `--apply` contra `ws_n1` (ou qualquer workspace real) — fica para o orquestrador/operador.
- `git -C ../financeiro-tria status --short` continua com o mesmo conjunto de arquivos modificados que já existia antes desta sessão (regeneração shadcn/Lovable pré-existente, documentada em STATE.md) — nada deste plano tocou o segundo repositório (CON-05).
- `grep -rn "appKey\|appSecret\|app_key\|app_secret" packages/dominio/src apps/api/src` não devolve nenhuma linha de código NOVA — as únicas ocorrências são de um módulo de importação pré-existente (Fase 0-3, fixtures fictícias e testes que PROVAM a ausência do segredo).

## Next Phase Readiness

- TEN-01 (esta entrega) está pronta para o roteamento por Empresa (05-03) e o destinatário por Empresa (05-05) lerem `Integration.empresa`/`Integration.omie`/`Integration.avisosPorCanal`.
- `ws_n1` ainda não tem a configuração aplicada de verdade — só o dry-run rodou. O operador decide quando rodar `--apply` (comando documentado acima).
- Nenhum bloqueio para as próximas plans desta fase.

## Self-Check: PASSED

All 6 created source files and the SUMMARY.md itself found on disk; all 3 task commits (`3b1d045`, `a3901b5`, `0d80bcd`) found in `git log --oneline --all`.

---
*Phase: 05-contas-a-receber-e-os-outros-tenants*
*Completed: 2026-09-24*
