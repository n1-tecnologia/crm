---
phase: 05-contas-a-receber-e-os-outros-tenants
plan: 03
subsystem: api
tags: [contrato-v1, zod, enum, cross-repo, fixtures]

# Dependency graph
requires:
  - phase: 05-contas-a-receber-e-os-outros-tenants
    plan: "05-01"
    provides: "SOL.status.emRevisao (sts_sp_em_revisao) — o 5º Status já existe no domínio"
provides:
  - "StatusSolicitacaoV1 com cinco valores em apps/api/src/contratos/v1.ts"
  - "STATUS_POR_ID/ID_DO_STATUS cobrindo sts_sp_em_revisao em apps/api/src/servicos/dto-solicitacao.ts"
  - "PaymentRequestDtoSchema.status com os mesmos cinco valores em ../financeiro-tria/automation/src/adapters/plataforma.ts"
  - "fixture getTask.sucesso-em-revisao.json e documento do contrato atualizados"
affects: ["05-05 (corte de MP/FO — a primeira Tarefa do Family Office em em revisão já atravessa o contrato)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Alargamento literal de enum zod .strict() nos dois lados do contrato v1, sem normalização (mesmo mecanismo dos 4 Status originais)"
    - "Categoria de fixture extra por método (CATEGORIAS_EXTRAS_POR_METODO) — quando um método precisa de uma fixture a mais que os outros seis, sem quebrar a contagem exata que o teste já afirmava"

key-files:
  created:
    - contratos/payment-requests-v1/getTask.sucesso-em-revisao.json
  modified:
    - apps/api/src/contratos/v1.ts
    - apps/api/src/contratos/v1.test.ts
    - apps/api/src/servicos/dto-solicitacao.ts
    - contratos/payment-requests-v1/README.md
    - docs/08-migracao-financeiro/04-contrato-plataforma-v1.md
    - ../financeiro-tria/automation/src/adapters/plataforma.ts
    - ../financeiro-tria/automation/src/adapters/plataforma.test.ts

key-decisions:
  - "PaymentRequestDtoV1.status em ../financeiro-tria/automation/src/adapters/payment-request-adapter.ts (uma TERCEIRA cópia manual do mesmo tipo, fora do escopo declarado de 2 arquivos) ainda diz 4 valores — em vez de tocá-lo, os dois pontos de retorno de plataforma.ts (getTask, listPaymentRequestTasks) recebem um cast documentado (`as PaymentRequestDtoV1`). Runtime intacto (o zod já valida 5 valores); só o tipo estático fica com um descompasso documentado, dentro do limite de 2 arquivos que CON-05 exige."
  - "contratos/payment-requests-v1/README.md entrou na lista de arquivos tocados mesmo fora do files_modified do frontmatter do plano — a própria ação da Task 1 manda: 'Registre a fixture ... se o README mantiver um índice' — e o README mantém uma tabela de contagem por método que ficaria desatualizada sem isso."
  - "v1.test.ts ganhou CATEGORIAS_EXTRAS_POR_METODO em vez de simplesmente acrescentar 'sucesso-em-revisao' a CATEGORIAS_COMUNS — CATEGORIAS_COMUNS é compartilhada pelos 7 métodos; adicionar lá exigiria a mesma fixture extra nos outros 6 métodos, que o plano não pediu."

requirements-completed: [TEN-01]

# Metrics
duration: ~40min
completed: 2026-09-24
---

# Phase 05 Plan 03: O 5º Status atravessa o contrato v1 (TEN-01) Summary

**`em revisão` — o 5º Status criado em 05-01 — agora atravessa o contrato HTTP v1 nos dois sentidos: `StatusSolicitacaoV1` (apps/api) e `PaymentRequestDtoSchema.status` (automation/) têm os mesmos cinco valores, na mesma ordem, com fixture e documento do contrato andando no mesmo commit.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-09-24
- **Tasks:** 2/2
- **Files modified:** 9 (1 criado, 8 modificados — 6 em `crm-n1`, 2 em `../financeiro-tria`)

## Accomplishments

- `StatusSolicitacaoV1` (`apps/api/src/contratos/v1.ts`) alargado de 4 para 5 valores: `["para fazer", "em aprovação", "não aprovado", "aprovado", "em revisão"]` — o novo valor por último, com comentário citando D5-06. `FormaDePagamentoV1` e os três eventos de outbox não foram tocados (o alargamento é só de leitura, não do contrato de escrita/eventos, como o `must_haves` exigia).
- `STATUS_POR_ID`/`ID_DO_STATUS` (`apps/api/src/servicos/dto-solicitacao.ts`) crescem com `sts_sp_em_revisao` ↔ `"em revisão"` nos dois sentidos. `npm run typecheck -w @n1/api` confirma que nenhum `switch` sobre status neste arquivo precisou de tratamento explícito adicional (não há `switch`, só os dois `Record` — o portão de exaustividade do plano era preventivo, não se materializou).
- Fixture nova `contratos/payment-requests-v1/getTask.sucesso-em-revisao.json`, copiando a estrutura de `getTask.sucesso-completo.json` com `status: "em revisão"`, uma Empresa do Family Office (`EXO Loteamento`) e ids/timestamps próprios para não colidir com a fixture original.
- `apps/api/src/contratos/v1.test.ts` ganha: (a) um `describe` novo afirmando que `StatusSolicitacaoV1.options` tem exatamente os cinco valores nesta ordem, que `"em revisao"` (sem acento) é rejeitado e que `"em revisão"` (com acento) é aceito; (b) `CATEGORIAS_EXTRAS_POR_METODO`, um mecanismo novo para que `getTask` ganhe uma 10ª fixture sem quebrar a contagem exata que o teste já afirmava para os outros seis métodos — ver "Deviations" abaixo.
- `docs/08-migracao-financeiro/04-contrato-plataforma-v1.md` §4: a linha do union de `status` ganhou o 5º valor, e o parágrafo logo acima ganhou a frase de procedência (D5-06, os quatro anteriores travados por D-01).
- `contratos/payment-requests-v1/README.md`: a tabela "Categoria" e a tabela "Métodos e contagem esperada" atualizadas para refletir a 10ª fixture de `getTask` — o README mantém um índice, então a Task 1 mandava registrar ali.
- Do lado do `financeiro-tria`: `PaymentRequestDtoSchema.status` (`../financeiro-tria/automation/src/adapters/plataforma.ts`) alargado para os mesmos cinco valores, na mesma ordem, com comentário apontando `apps/api/src/contratos/v1.ts` como fonte canônica. `plataforma.test.ts` ganha dois casos: `(g)` prova que `"em revisão"` é aceito e que `tarefa.status` chega intacto; `(h)` prova que `"revisao"` (sem acento) continua rejeitado — nenhuma normalização silenciosa.
- Verificado por leitura direta, byte a byte: os cinco valores de `StatusSolicitacaoV1` (`crm-n1`) e de `PaymentRequestDtoSchema.status` (`automation/`) são idênticos e na mesma ordem.

## Task Commits

Each task was committed atomically, um em cada repositório:

1. **Task 1: O enum canônico e o de-para de ida e volta, do lado da plataforma** (`crm-n1`) — `9e520b9` (feat)
2. **Task 2: O mesmo enum do outro lado do fio** (`../financeiro-tria`) — `6db51b8` (feat)

_Nenhuma tarefa TDD — sem gate RED/GREEN formal._

## Files Created/Modified

**`crm-n1`:**
- `apps/api/src/contratos/v1.ts` — `StatusSolicitacaoV1` de 4 para 5 valores
- `apps/api/src/contratos/v1.test.ts` — teste do 5º Status + `CATEGORIAS_EXTRAS_POR_METODO` + teste da fixture extra
- `apps/api/src/servicos/dto-solicitacao.ts` — `STATUS_POR_ID`/`ID_DO_STATUS` crescem com `emRevisao`
- `contratos/payment-requests-v1/getTask.sucesso-em-revisao.json` — fixture nova
- `contratos/payment-requests-v1/README.md` — tabelas de categoria e de contagem por método atualizadas
- `docs/08-migracao-financeiro/04-contrato-plataforma-v1.md` — §4, union de `status` + frase de procedência

**`../financeiro-tria`:**
- `automation/src/adapters/plataforma.ts` — `PaymentRequestDtoSchema.status` de 4 para 5 valores + dois casts documentados (ver Decisions)
- `automation/src/adapters/plataforma.test.ts` — casos `(g)`/`(h)`

## Decisions Made

- **`payment-request-adapter.ts` não foi tocado, mesmo sendo uma terceira cópia do mesmo tipo que ficou desatualizada.** Esse arquivo (fora do `files_modified` do plano — CON-05 autoriza só `plataforma.ts`/`plataforma.test.ts`) declara `PaymentRequestDtoV1.status` como união de 4 valores e é importado por `plataforma.ts`. Alargar só o schema zod de `plataforma.ts` sem tocar essa interface fazia `npm run build` (tsc --noEmit) falhar em dois pontos — `getTask` e `listPaymentRequestTasks`, os dois métodos que efetivamente retornam o DTO tipado (os quatro métodos de escrita só validam a forma e descartam o resultado, sem esse problema). Resolvido com um cast documentado (`as PaymentRequestDtoV1` / `as { items: PaymentRequestDtoV1[]; nextCursor?: string }`) nesses dois pontos, dentro do arquivo já autorizado — nenhum terceiro arquivo do repositório vizinho foi tocado. O runtime está correto (o zod valida os cinco valores antes do cast rodar); só o tipo estático de `payment-request-adapter.ts` segue, deliberadamente, atrás — herdado para quem tocar essa interface numa fase futura que precise que código consumidor (`payment-automation-service.ts` etc.) trate o 5º Status.
- **`README.md` de `contratos/payment-requests-v1/` foi atualizado apesar de não constar em `files_modified`.** A própria ação da Task 1 condiciona isso a "se o README mantiver um índice" — mantém (tabela de categoria + tabela de contagem por método) — então documentá-lo era o comportamento correto, não scope creep.
- **`CATEGORIAS_EXTRAS_POR_METODO` em vez de acrescentar `sucesso-em-revisao` a `CATEGORIAS_COMUNS`.** `CATEGORIAS_COMUNS` é compartilhada pelos sete métodos; a fixture nova é só de `getTask`. Um mapa por método, aplicado só onde a categoria extra existe, mantém a contagem exata dos outros seis métodos intacta.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug/blocker] A fixture nova de `getTask` quebraria o teste "contagem de arquivos bate com a matriz esperada"**
- **Found during:** Task 1, ao criar `getTask.sucesso-em-revisao.json`
- **Issue:** `v1.test.ts` já tinha um teste que lê todo arquivo `getTask.*.json` do diretório de fixtures e afirma que a contagem bate exatamente com `categoriasEsperadas("getTask").length` (9). Criar a 10ª fixture sem mudar esse teste faria essa asserção falhar sempre — o teste que o próprio README descreve como "de propósito" (pegar um método que ganhou fixture sem estar na matriz) pegaria a MINHA fixture, que é legítima.
- **Fix:** `CATEGORIAS_EXTRAS_POR_METODO` — um `Record` opcional por método que `categoriasEsperadas()` agora soma à matriz base, hoje só com `getTask: ["sucesso-em-revisao"]`. Um teste novo por categoria extra confirma que a fixture parseia com sucesso contra o schema de resposta.
- **Files modified:** `apps/api/src/contratos/v1.test.ts`
- **Verification:** `npm run test -w @n1/api -- src/contratos/v1.test.ts --testTimeout=20000` — 90/90 verde
- **Committed in:** `9e520b9` (Task 1 commit)

**2. [Rule 1 - Bug/blocker] `npm run build` do `automation/` quebrava com o schema alargado, por um tipo em arquivo fora do escopo declarado**
- **Found during:** Task 2, depois de alargar `PaymentRequestDtoSchema.status` em `plataforma.ts`
- **Issue:** `payment-request-adapter.ts` (não listado em `files_modified`) declara `PaymentRequestDtoV1.status` como união de 4 valores; `plataforma.ts` importa esse tipo e o usa como tipo de retorno de `getTask`/`listPaymentRequestTasks`. Com o schema zod alargado para 5 valores, o `z.infer` resultante (5 valores) deixou de ser atribuível ao tipo declarado da interface (4 valores) — `tsc --noEmit` falhava em exatamente esses dois pontos.
- **Fix:** cast explícito e comentado (`as PaymentRequestDtoV1` / `as { items: PaymentRequestDtoV1[]; nextCursor?: string }`) nos dois pontos de retorno, dentro de `plataforma.ts` — o único arquivo, junto com `plataforma.test.ts`, que este plano está autorizado a tocar no repositório vizinho (CON-05). `payment-request-adapter.ts` não foi editado.
- **Files modified:** `../financeiro-tria/automation/src/adapters/plataforma.ts` (mesmo arquivo já em `files_modified`, nenhum arquivo a mais tocado)
- **Verification:** `cd ../financeiro-tria/automation && npm run build` — exit 0; `npx tsx --test --test-concurrency=1 src/adapters/plataforma.test.ts` — 8/8 verde
- **Committed in:** `6db51b8` (Task 2 commit)

---

**Total deviations:** 2, ambas Rule 1 (bloqueavam a conclusão da tarefa sem elas — uma quebraria a suíte de testes já existente, a outra quebraria o build). Nenhuma tocou arquivo fora do que os dois planos de arquivo (crm-n1 e sibling) autorizavam.
**Impact on plan:** Nenhum scope creep de comportamento — as duas correções são mecanismo de teste/tipo, não regra de negócio nova. `payment-request-adapter.ts` fica com uma dívida de tipo documentada (herdada para quem tocar essa interface depois), não um bug silencioso.

## Issues Encountered

Nenhum além do documentado em Deviations.

## User Setup Required

None — nenhuma configuração de serviço externo.

## Verificação executada nesta sessão (regras operacionais do projeto)

- **`crm-n1` (escopado, por regra operacional — `npm run check`/suíte inteira de `@n1/api` NÃO rodados):**
  - `npm run typecheck -w @n1/api` — verde
  - `npm run typecheck -w @n1/dominio` — verde (confirma ausência de drift; este plano não tocou o domínio)
  - `npm run typecheck -w @n1/web` — verde
  - `npm run lint` — verde (cobre `@n1/web`, único workspace com script de lint agregado na raiz)
  - `npm run test -w @n1/api -- src/contratos/v1.test.ts --testTimeout=20000` — **90/90 verde**
  - `npm run test -w @n1/api -- src/rotas/integracao-solicitacoes.test.ts --testTimeout=20000` — **17 passed, 1 skipped** (arquivo achado por `grep -rl "ID_DO_STATUS" apps/api/src`, importa `ID_DO_STATUS` diretamente — o único outro arquivo de teste que importa os dois mapas alterados)
  - `apps/api/src/rotas/classificacoes.ts` também apareceu no grep, mas só importa `LISTA_SOLICITACOES_DE_PAGAMENTO_ID` (não alterado) — não precisou de re-execução
  - `npm run check` completo, a suíte inteira de `@n1/api` sem filtro de arquivo, e `npm run test`/`vitest` sem path na raiz — **deliberadamente NÃO executados** (regra operacional #2: estourariam o watchdog de 600s)
- **`../financeiro-tria/automation` (autorizado a rodar por completo — regra operacional #3):**
  - `npx tsx --test --test-concurrency=1 src/adapters/plataforma.test.ts` — **8/8 verde** (os 6 casos originais + os 2 novos, `(g)`/`(h)`)
  - `npm run build` (`tsc --noEmit`) — **exit 0**
  - `npm test` — **148 passed, 1 failed** (149 total): a única falha é `src/tenants/tria/payment-rules.test.ts:37`, `"resolve responsavel por centro de custo com fallback"`, `/FINQ/i` vs `'Elifas'` — **o defeito pré-existente já documentado** em `.planning/phases/04-as-outras-telas-do-financeiro-tria/deferred-items.md` item 1 (D5-08 mantém `payment-rules.ts` do FINQ fora de escopo). Nenhuma outra falha.
- **CON-05 (disciplina de repositório vizinho):**
  - Snapshot de `git -C ../financeiro-tria status --short` capturado ANTES de qualquer edição — os dois arquivos-alvo estavam limpos (nenhum dos ~89 arquivos pré-existentes sujos era `plataforma.ts`/`plataforma.test.ts`)
  - Depois do commit, `git -C ../financeiro-tria status --short` é **byte-idêntico** ao snapshot original — nenhum arquivo a mais permaneceu modificado
  - `git -C ../financeiro-tria diff --name-only` (antes do commit) listou exatamente os dois arquivos autorizados entre as mudanças desta sessão
  - Nenhum `git add -A`, `git add .`, `git clean`, `git stash` ou `git reset` usado em nenhum dos dois repositórios

## Next Phase Readiness

- TEN-01 (esta entrega) está fechada para o corte de MP/FO em 05-05: a primeira Tarefa do Family Office em `em revisão` agora atravessa `getTask`/`listPaymentRequestTasks` sem ser rejeitada por enum, dos dois lados.
- Pendência herdada, não deste plano: `payment-request-adapter.ts` (`../financeiro-tria`) segue com `PaymentRequestDtoV1.status` declarado como união de 4 valores — um plano futuro que precise que `payment-automation-service.ts` (ou qualquer consumidor tipado) trate o 5º Status deve alargar esse tipo também, removendo os dois casts documentados nesta sessão.
- Nenhum bloqueio para os planos paralelos desta onda (05-02, 05-06) — nenhum arquivo deste plano se sobrepõe aos `files_modified` deles.

## Self-Check: PASSED

Fixture nova (`contratos/payment-requests-v1/getTask.sucesso-em-revisao.json`) e este SUMMARY.md encontrados em disco; os dois commits de tarefa (`9e520b9` em `crm-n1`, `6db51b8` em `../financeiro-tria`) encontrados em `git log --oneline --all` de cada repositório respectivamente.

---
*Phase: 05-contas-a-receber-e-os-outros-tenants*
*Completed: 2026-09-24*
