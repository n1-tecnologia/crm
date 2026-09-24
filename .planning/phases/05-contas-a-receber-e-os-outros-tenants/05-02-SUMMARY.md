---
phase: 05-contas-a-receber-e-os-outros-tenants
plan: 02
subsystem: web
tags: [dominio, web, status-picker, integracoes, multi-tenant]

# Dependency graph
requires:
  - phase: 05-contas-a-receber-e-os-outros-tenants
    plan: 01
    provides: "Integration.statusDeclarados, Integration.empresa/omie, CATALOGO_CONFIGURACAO_POR_EMPRESA, SOL.status.emRevisao"
provides:
  - "statusOptionRefusal recusa com motivo o 5º Status 'em revisão' para Empresas que não o declaram — vale em toda tela que já chama a função (StatusPicker, drawer, tabela)"
  - "/configuracoes/integracoes mostra Empresa/Conta Omie/Banco de categorias/Última rotação por Integração, e um cartão de aviso por Empresa sem Integração"
affects: ["05-03 (roteamento por Empresa)", "qualquer tela futura que monte um StatusPicker sobre a Lista de Solicitações"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Guarda 'declarável por alguém' antes de qualquer recusa por Empresa — um Status que nenhuma Integração declara nunca é bloqueado, mesmo em Espaços sem Integração nenhuma"
    - "Id de Campo literal (não importado) quando importar criaria ciclo entre módulos de operations/ — mesmo padrão já usado por conversao-de-solicitacao.ts e importacao.ts"

key-files:
  created:
    - packages/dominio/src/operations/status-por-empresa.test.ts
  modified:
    - packages/dominio/src/operations/tasks.ts
    - "apps/web/src/app/(shell)/configuracoes/integracoes/page.tsx"

key-decisions:
  - "statusNaoDeclaradoPelaEmpresa lê o valor de Empresa da Tarefa por DOIS ids literais de Campo (fld_sp_c_empresa da Solicitação, fd_cp_empresa de Contas a pagar), não CP.fields.empresa importado — ver Deviations"

requirements-completed: [TEN-01]

# Metrics
duration: ~25min
completed: 2026-09-24
---

# Phase 05 Plan 02: As duas afordâncias que o genérico não dá (TEN-01) Summary

**O 5º Status "em revisão" aparece desabilitado com motivo em qualquer Tarefa de Solicitações cuja Empresa não o declara, e a tela de Integrações passa a mostrar a identidade da conta Omie por Empresa — inclusive as Empresas que ainda não têm Integração.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-09-24
- **Tasks:** 2/2
- **Files modified:** 3 (1 criado, 2 modificados)

## Accomplishments

- `statusNaoDeclaradoPelaEmpresa` (local a `packages/dominio/src/operations/tasks.ts`), chamada dentro de `statusOptionRefusal` logo depois da checagem de requisitos de saída e antes de `entryAllowedMemberIds`/`entryRefusal`: quando o Status alvo é declarado por alguma Integração (`statusDeclarados`) mas a Empresa da Tarefa não é uma delas, devolve a frase exata da UI-SPEC §4: `Este Status pertence ao fluxo do Family Office — a Automação desta Empresa não usa "em revisão".` — com aspas curvas de verdade (“ ”).
- Guarda "declarável por alguém": um Status que nenhuma Integração declara (os quatro de D-01) nunca é bloqueado por esta regra, mesmo num Espaço sem nenhuma Integração configurada.
- `packages/dominio/src/operations/status-por-empresa.test.ts` — 6 casos: os 5 do plano (Tria Company recusa, EXO Loteamento não recusa, Status alvo diferente não interfere, Tarefa sem Empresa não interfere, estado sem Integração nenhuma não bloqueia nada) mais um caso extra confirmando que os quatro Status de D-01 continuam intactos.
- `/configuracoes/integracoes`: cada cartão de Integração com Empresa ganhou `Empresa:`, `Conta Omie:` (ou "não informada", neutro), `Banco de categorias:` (omitido por inteiro se vazio) e `Última rotação:` (ou "nunca registrada", neutro) — todas `.app-meta`. A grade passa a iterar também as opções de `CP.fields.empresa` sem Integração correspondente, cada uma como um cartão `item-solto` com `ConditionMarker tone="warning"` ("sem Integração") e `EmptyState compact`. `meta` do `PageHeader` e `count` do `Section` somam os dois conjuntos. Nenhum componente novo; nenhum campo de senha/edição/máscara (comentário no topo do arquivo cita D5-03/CON-10).

## Task Commits

Each task was committed atomically:

1. **Task 1: A regra de Status declarado por Empresa, no domínio** - `daeee63` (feat)
2. **Task 2: A tela de Integrações passa a falar por Empresa** - `ff97838` (feat)

## Files Created/Modified

- `packages/dominio/src/operations/tasks.ts` — `statusNaoDeclaradoPelaEmpresa` + ramo novo em `statusOptionRefusal`
- `packages/dominio/src/operations/status-por-empresa.test.ts` — os 6 casos (novo)
- `apps/web/src/app/(shell)/configuracoes/integracoes/page.tsx` — linhas de metadado por Empresa + cartão de Empresa sem Integração

## Decisions Made

- Config por Empresa consumida como já modelada em 05-01 (`Integration.empresa`/`.omie`/`.statusDeclarados`) — nada novo a decidir aqui, só leitura.
- `statusNaoDeclaradoPelaEmpresa` lê o Campo Empresa por dois ids literais (`fld_sp_c_empresa`, `fd_cp_empresa`), não `CP.fields.empresa` importado de `./financeiro` — ver Deviations abaixo para o porquê (é ao mesmo tempo correção de bug e prevenção de ciclo de import).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] O plano mandava ler `CP.fields.empresa` (`fd_cp_empresa`) — campo que uma Tarefa de Solicitações nunca preenche**
- **Found during:** Task 1, ao escrever o teste (a) e notar que a Tarefa criada na Lista "Solicitações de pagamento" nunca teria valor em `fd_cp_empresa`.
- **Issue:** O texto do plano (`<action>` e `<read_first>`) instruía ler `CP.fields.empresa` (`fd_cp_empresa`, o Campo Empresa de **Contas a pagar**) do `task.fieldValues`. Mas a Lista "Solicitações de pagamento" tem o SEU PRÓPRIO Campo Empresa — `fld_sp_c_empresa` (`solicitacao-de-pagamento.ts:234`) — com opções (`OPCOES_EMPRESA`, 11 valores) definidas e mantidas separadamente de `fd_cp_empresa`. A prova definitiva de que os dois Campos são distintos e um NÃO alimenta o outro automaticamente está no de-para de conversão: `conversao-de-solicitacao.ts:78` tem `{ de: "fld_sp_c_empresa", para: CP.fields.empresa }` — a Empresa só migra de um Campo para o outro quando uma Solicitação é convertida em Conta a pagar. Seguir o plano ao pé da letra faria `statusOptionRefusal` ler sempre `undefined` para qualquer Tarefa de Solicitações real (não convertida) — a regra nunca dispararia, e D5-06 ficaria letra morta.
- **Fix:** `statusNaoDeclaradoPelaEmpresa` lê `task.fieldValues` procurando por QUALQUER um de dois ids literais — `fld_sp_c_empresa` (Solicitação) e `fd_cp_empresa` (Contas a pagar) — cobrindo o campo real de cada Lista, generalizando a regra para o dia em que Contas a pagar também ganhar um Status declarado por Empresa. Os ids são literais (não importados de `../solicitacao-de-pagamento.ts` nem de `./financeiro.ts`) pelo mesmo motivo mecânico já documentado em `conversao-de-solicitacao.ts`: `./financeiro.ts` já importa de `./tasks.ts` (`addTaskComment`, `createTask`, `setTaskFieldValue`, `trashTask`, `unmetRequirements`) — importar `CP` de volta em `tasks.ts` criaria o ciclo `tasks ⇄ financeiro`.
- **Files modified:** `packages/dominio/src/operations/tasks.ts`, `packages/dominio/src/operations/status-por-empresa.test.ts`
- **Verification:** os 6 casos do teste novo passam; `npm run test -w @n1/dominio` — 494/494 (488 de 05-01 + 6 novos).
- **Committed in:** `daeee63` (Task 1 commit)

---

**Total deviations:** 1 (Rule 1 — correção de bug de campo, com prova textual no próprio repositório)
**Impact on plan:** Sem scope creep — a correção é necessária para que a acceptance criteria do próprio plano ("statusOptionRefusal com uma Tarefa de Empresa 'Tria Company' ... devolve exatamente [a frase]") seja sequer alcançável com uma Tarefa real da Lista de Solicitações.

## Issues Encountered

None além do documentado em Deviations.

## User Setup Required

None — nenhuma configuração de serviço externo. `ws_n1` já tinha a configuração de 05-01 aplicada só em dry-run (documentado no Summary anterior); este plano não grava nada em produção, é leitura de código puro (Task 1) e leitura de tela (Task 2).

## Verificação executada nesta sessão (regras operacionais do projeto)

- Symlinks locais `node_modules/@n1/{dominio,api,web}` criados no worktree e confirmados com `node -e 'require.resolve("@n1/dominio")'` resolvendo dentro do worktree (não do checkout principal) — feito ANTES de qualquer typecheck/teste.
- `npm run test --workspace=@n1/dominio -- status-por-empresa` — 6/6 verde
- `npm run typecheck -w @n1/dominio` — verde
- `npm run test -w @n1/dominio` — 494/494 verde (suíte inteira, rápida, autorizada pelas regras operacionais)
- `npm run typecheck --workspace=@n1/web` — verde (duas vezes: antes e depois do ajuste do comentário que colidia com o grep de aceite)
- `npm run verificar:tokens` — `392 definidos · 254 arquivos varridos · 0 falhas`
- `npm run lint` — verde
- `npm run test -w @n1/web` — 167/167 verde (suíte inteira, rápida, autorizada pelas regras operacionais)
- Greps de aceite da Task 2 (todos conferidos manualmente): `type="password"` → `0`; `text-[N` → `0`; as quatro strings literais (`Nenhuma Integração configurada.`, `sem Integração`, `Conta Omie: não informada`, `Última rotação: nunca registrada`) presentes; `CP.fields.empresa` → 1 ocorrência.
- `grep -c "statusDeclarados" packages/dominio/src/operations/tasks.ts` → 3 (≥ 1 exigido).
- **NÃO executado, por regra operacional do projeto:** `npm run check` completo, `npm run test`/`npm test` na raiz, e qualquer teste de `apps/api` — este plano não toca `apps/api`.
- `git -C "/Users/TRIA2026/Projetos/Projetos Cursor/financeiro-tria" status --short` — mesmo conjunto pré-existente de 89 arquivos (regeneração shadcn/Lovable, documentado em STATE.md); nada deste plano tocou o segundo repositório (CON-05). Não estranhar: outro agente (05-03) edita `automation/src/adapters/plataforma*.ts` em paralelo nesta onda.
- **Human-check do plano NÃO executado** (não é checkpoint bloqueante — a Task é `type="auto"` com `<human-check>` supletivo, não `type="checkpoint:*"`): abrir `/configuracoes/integracoes` no navegador e conferir visualmente os 6 cartões de Integração e os cartões de Empresa sem Integração fica para quem revisar a tela depois do merge.

## Next Phase Readiness

- A regra de `statusOptionRefusal` vale automaticamente em qualquer tela que já a chame (StatusPicker, drawer, tabela) — nenhuma mudança adicional em `apps/web` é necessária para D5-06.
- A tela de Integrações está pronta para as 6 Empresas de `CATALOGO_CONFIGURACAO_POR_EMPRESA` assim que `--apply` for rodado contra `ws_n1` (05-01 deixou isso para o operador).
- Nenhum bloqueio para 05-03 (roteamento por Empresa) ou para as próximas plans da fase.

## Self-Check: PASSED

Ambos os arquivos-fonte (`packages/dominio/src/operations/tasks.ts`, `packages/dominio/src/operations/status-por-empresa.test.ts`, `apps/web/src/app/(shell)/configuracoes/integracoes/page.tsx`) encontrados em disco; os 2 commits de task (`daeee63`, `ff97838`) encontrados em `git log --oneline --all`.

---
*Phase: 05-contas-a-receber-e-os-outros-tenants*
*Completed: 2026-09-24*
