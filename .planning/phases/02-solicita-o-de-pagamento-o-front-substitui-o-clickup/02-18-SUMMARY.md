---
phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup
plan: 18
subsystem: payments
tags: [typescript, node-test, supabase, payment-requests, mapper]

# Dependency graph
requires:
  - phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup
    provides: "PaymentRequestDtoV1 (Plan 02-02), a porta PaymentRequestAdapter e o escape hatch legacyClickUpRaw() (Plan 02-12)"
provides:
  - "payment-request-mapper.ts: porta PaymentRequestMapper<TEntrada> + tipo SolicitacaoInterna"
  - "plataforma-payment-mapper.ts: mapearSolicitacaoDaPlataforma — leitura tipada curta do DTO v1, 97 linhas"
  - "clickup-payment-mapper.ts: paymentRequestMapperClickUp, empacotamento puro sobre a implementação existente"
  - "migração 20260922130000_solicitacoes_origem_unique.sql (escrita, NÃO aplicada)"
  - "adapters/supabase.ts: origem opcional (default clickup) em upsertSolicitacaoPagamento e getSolicitacaoPagamentoByTaskId"
affects: ["02-21 (seleção do mapper)", "02-26 (contract tests, cópia oficial das fixtures)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Porta de mapper genérica na entrada (PaymentRequestMapper<TEntrada>) para acomodar uma implementação que lê DTO tipado e outra que lê forma bruta do sistema de origem, convergindo na mesma saída"
    - "Erro de campo obrigatório ausente nomeia só a chave, nunca o valor (mensagem sanitizada)"

key-files:
  created:
    - ../financeiro-tria/automation/src/tenants/tria/payment-request-mapper.ts
    - ../financeiro-tria/automation/src/tenants/tria/plataforma-payment-mapper.ts
    - ../financeiro-tria/automation/src/tenants/tria/plataforma-payment-mapper.test.ts
    - ../financeiro-tria/supabase/migrations/20260922130000_solicitacoes_origem_unique.sql
    - ../financeiro-tria/automation/contratos/payment-requests-v1/getTask.sucesso-completo.json (cópia mínima, ver Deviations)
    - ../financeiro-tria/automation/contratos/payment-requests-v1/getTask.sucesso-minimo.json (cópia mínima, ver Deviations)
  modified:
    - ../financeiro-tria/automation/src/tenants/tria/clickup-payment-mapper.ts
    - ../financeiro-tria/automation/src/adapters/supabase.ts

key-decisions:
  - "SolicitacaoInterna é o mesmo formato de linha que mapClickUpTaskToSolicitacaoPagamento já retornava (o que payment-rules.ts e o serviço consomem via solicitacaoInput()/parsePaymentComment(comentario)) — nenhum campo renomeado, origem é o único campo novo"
  - "PaymentRequestMapper é genérico na entrada (PaymentRequestMapper<TEntrada = PaymentRequestDtoV1>) porque o mapper ClickUp lê a forma BRUTA do ClickUp (legacyClickUpRaw()), não o DTO tipado — as duas implementações convergem só na saída (SolicitacaoInterna)"
  - "app_key/app_secret nunca são escritos por plataforma-payment-mapper.ts (nem sequer como null explícito) — CON-10/D-25 exige que linhas novas nasçam sem credencial por linha; o parâmetro config fica na assinatura para a porta evoluir, mas não alimenta nenhum campo"
  - "adapters/supabase.ts ganhou origem como parâmetro OPCIONAL (default 'clickup') em vez de obrigatório — evita reescrever os ~10 pontos de payment-automation-service.ts que chamam essas funções hoje (todos ClickUp), o que é fora do escopo deste plano e explicitamente responsabilidade do Plan 02-21 ('seleção do mapper')"
  - "Este plano NÃO rewires payment-automation-service.ts: os 6 call sites que usam legacyClickUpRaw()/mapClickUpTaskToSolicitacaoPagamento continuam como estão. O ROADMAP atribui 'seleção do mapper' explicitamente ao Plan 02-21, e o Plan 02-18 não lista payment-automation-service.ts em files_modified nem em nenhum acceptance_criteria"

requirements-completed: []  # SOL-06 não fecha nesta execução — Task 3 está bloqueada em checkpoint humano (migração não aplicada). Ver Blockers.

# Metrics
duration: ~55min
completed: 2026-09-21
---

# Phase 02 Plan 18: Mapper tipado da plataforma para Solicitação de pagamento (SOL-06) — PARCIAL, bloqueado em checkpoint

**`plataforma-payment-mapper.ts` faz leitura tipada curta do `PaymentRequestDtoV1` (97 linhas, zero fallback de nome de campo, zero credencial por linha); a migração de unicidade `(origem, TaskID)` está escrita mas NÃO aplicada — aguarda decisão do dono contra o Supabase de produção.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-09-21T18:05:00Z (aprox.)
- **Completed (Tasks 1-2, parcial Task 3):** 2026-09-21T18:27:35Z
- **Tasks:** 2/3 completas; Task 3 parcialmente executada, bloqueada em checkpoint humano
- **Files modified:** 8 (7 em `financeiro-tria`, 1 SUMMARY em `crm-n1`)

## Accomplishments

- `plataforma-payment-mapper.ts` substitui a necessidade das ~400 linhas defensivas de `clickup-payment-mapper.ts` para a coorte plataforma: leitura tipada curta (97 linhas), sem `custom_fields`/`notify_all`/`date_created`/`app_key`/`app_secret`, provado por grep e por teste estático de conteúdo do arquivo
- `payment-rules.ts` permanece com diff vazio — nenhuma regra de negócio migrou ou duplicou
- `clickup-payment-mapper.ts` ganha a porta `PaymentRequestMapper<ClickUpTask>` por empacotamento puro (`paymentRequestMapperClickUp`), sem tocar uma linha de parsing existente — caminho de rollback de D-21 intacto
- 7 casos de teste (a)-(g) provam valor sem erro de ponto flutuante, opcionais ausentes nunca viram `""`/`0`, `Cartão` → `link_pagamento` via `parsePaymentMethod` real, erro sanitizado que nomeia só a chave ausente, ausência total de credencial Omie (mesmo com DTO hostil e config real), ausência de qualquer menção a ClickUp no arquivo, e CPF/CNPJ presente na linha mas nunca em mensagem de erro
- Migração `20260922130000_solicitacoes_origem_unique.sql` escrita (coluna `origem`, backfill `'clickup'`, `unique index (origem, "TaskID")`) — pronta para revisão, **não aplicada**
- `adapters/supabase.ts` ganha filtro por `origem` (opcional, default `'clickup'`) nas duas funções que hoje buscam só por `TaskID`, sem quebrar nenhum chamador existente (`npm run build && npm test` confirmam)

## Task Commits

Todos em `../financeiro-tria` (branch `main`, checkout direto — não é worktree):

1. **Task 1: Porta do mapper e o mapper da plataforma** - `c913f6d` (feat)
2. **Task 2: Suíte do mapper — valores, ausências e proibições** - `d3e9b66` (test)
   - **Correção pós-commit da Task 1** (duas menções a "ClickUp" em comentário, pegas pelo teste estático (f) da Task 2) - `f5f0cfd` (fix)
3. **Task 3 [BLOQUEADA — checkpoint humano]: migração + filtro por origem** - `7cf37ef` (feat) — migração escrita e código de filtro commitados; migração **não aplicada**, duplicados **não verificados contra o banco real**

**Plan metadata (este arquivo):** commit pendente em `crm-n1` (próximo passo, fora deste commit de código).

_Nenhuma task usou TDD (`tdd="true"` não está no frontmatter deste plano)._

## Files Created/Modified

- `../financeiro-tria/automation/src/tenants/tria/payment-request-mapper.ts` - porta `PaymentRequestMapper<TEntrada>` e tipo `SolicitacaoInterna`
- `../financeiro-tria/automation/src/tenants/tria/plataforma-payment-mapper.ts` - `mapearSolicitacaoDaPlataforma`, leitura tipada curta do DTO v1
- `../financeiro-tria/automation/src/tenants/tria/plataforma-payment-mapper.test.ts` - 7 casos (a)-(g)
- `../financeiro-tria/automation/src/tenants/tria/clickup-payment-mapper.ts` - `+16` linhas (import + export `paymentRequestMapperClickUp`), zero linha de parsing tocada
- `../financeiro-tria/automation/contratos/payment-requests-v1/getTask.sucesso-completo.json` e `getTask.sucesso-minimo.json` - cópia mínima das fixtures do Plan 02-02 (ver Deviations)
- `../financeiro-tria/supabase/migrations/20260922130000_solicitacoes_origem_unique.sql` - migração escrita, não aplicada
- `../financeiro-tria/automation/src/adapters/supabase.ts` - `origem` opcional (default `'clickup'`) no filtro de `upsertSolicitacaoPagamento` e `getSolicitacaoPagamentoByTaskId`

## Decisions Made

1. **`SolicitacaoInterna` = a forma de linha que `mapClickUpTaskToSolicitacaoPagamento` já retorna** (a mesma que `solicitacaoInput()` em `payment-automation-service.ts` espelha e que `parsePaymentComment(comentario)` reidrata downstream). Não redesenhei essa forma — só a declarei como tipo explícito, com `origem` como único campo novo. Isso significa que `comentario` continua sendo o único carregador estruturado que o resto do pipeline lê; `mapearSolicitacaoDaPlataforma` monta o mesmo formato rotulado (`"Centro de custo: X"`, `"Valor: Y"`, `"Forma de pagamento: Z"`) a partir de campos já tipados — formatação curta, não extração de texto livre.

2. **`PaymentRequestMapper<TEntrada = PaymentRequestDtoV1>` é genérico na entrada.** O texto do plano pedia uma porta com `mapear(dto: PaymentRequestDtoV1): SolicitacaoInterna`, mas `mapClickUpTaskToSolicitacaoPagamento` lê a forma BRUTA do ClickUp (via `legacyClickUpRaw()`), nunca o DTO tipado — reescrevê-lo para consumir o DTO está fora do escopo deste plano (documentado como débito conhecido em `adapters/CONTEXT.md`, seção "O escape hatch temporário"). Uma porta genérica deixa as duas implementações tipadas corretamente sem forçar `mapClickUpTaskToSolicitacaoPagamento` a aceitar uma entrada que ele não sabe ler.

3. **`app_key`/`app_secret` nunca são escritos por `plataforma-payment-mapper.ts`** — nem como `null` explícito, nem a partir de `config`. CON-10/D-25 (`must_haves.truths` deste plano) exige que linhas novas de `public.solicitacoes_pagamentos` nasçam SEM credencial por linha; o acceptance criterion da Task 1 reforça isso proibindo até a string `"app_key"`/`"app_secret"` no arquivo. O parâmetro `config: TriaConfig` fica na assinatura (`mapearSolicitacaoDaPlataforma(dto, _config)`) para a porta poder evoluir sem quebrar o chamador, mas não alimenta nenhum campo — está documentado no cabeçalho do arquivo.

4. **`adapters/supabase.ts` ganhou `origem` como parâmetro OPCIONAL, default `'clickup'`**, em vez de obrigatório. Tornar `origem` obrigatório quebraria a build em ~10 pontos de `payment-automation-service.ts` que hoje chamam essas duas funções sem esse parâmetro (todos ClickUp, já que a coorte plataforma ainda não existe em nenhuma linha real). Reescrever esses call sites para injetar `origem` explicitamente é o trabalho do Plan 02-21 ("seleção do mapper", conforme o próprio ROADMAP.md). O default preserva 100% do comportamento atual (`npm run build && npm test` confirmam) e já fecha o acceptance criterion literal da Task 3 ("toda consulta por task_id inclui origem").

5. **Este plano NÃO reescreve os 6 call sites de `payment-automation-service.ts` que hoje usam `legacyClickUpRaw()`/`mapClickUpTaskToSolicitacaoPagamento`.** O prompt de execução (upstream context) sugeria isso como parte do trabalho deste plano, mas: (a) `payment-automation-service.ts` não está em `files_modified` do `02-18-PLAN.md`; (b) nenhum `acceptance_criteria` da Task 1 verifica esse arquivo; (c) o `ROADMAP.md` atribui explicitamente "seleção do mapper" ao **Plan 02-21** (`02-21-PLAN.md — os 3 webhooks /webhooks/plataforma/* com receipt idempotente + seleção do mapper (SOL-07)`). Rewirar esse arquivo de ~2000 linhas fora do escopo declarado, sem o contexto completo de "seleção do mapper" (que também decide COMO alternar entre os dois mappers por origem), seria uma mudança arquitetural não autorizada (Regra 4). Os artefatos que este plano entrega (a porta, os dois mappers, a migração) são exatamente o que o Plan 02-21 precisa para fazer essa troca.

## Deviations from Plan

### Auto-fixed Issues

**1. [Regra 3 - Blocking] Cópia mínima de 2 fixtures do Plan 02-02 para `financeiro-tria`**
- **Found during:** Task 2 (leitura de `read_first`, que referencia `contratos/payment-requests-v1/getTask.sucesso-completo.json` e `getTask.sucesso-minimo.json`)
- **Issue:** As fixtures canônicas só existem em `crm-n1/contratos/payment-requests-v1/` (79 fixtures + README). `docs/08-migracao-financeiro/04-contrato-plataforma-v1.md` §9 e `adapters/CONTEXT.md` são explícitos: "Plan 02-26 copia o diretório inteiro para `../financeiro-tria/automation/contratos/payment-requests-v1/`" com hash agregado do diretório como prova de não-deriva. Plan 02-26 ainda não rodou (não há `02-26-SUMMARY.md`), então o diretório não existe em `financeiro-tria`. Task 2 deste plano, porém, precisa das fixtures AGORA (`acceptance_criteria`: "usa as fixtures canônicas por caminho de arquivo, não objetos inline") e depende só de `02-02`/`02-12`, não de `02-26`.
- **Fix:** Copiei manualmente os 2 arquivos que a Task 2 referencia (`getTask.sucesso-completo.json`, `getTask.sucesso-minimo.json`) para `financeiro-tria/automation/contratos/payment-requests-v1/`, byte a byte, sem alterar conteúdo.
- **Impacto explícito:** Esta cópia é um desbloqueio MÍNIMO, não substitui o trabalho do Plan 02-26. O Plan 02-26 ainda precisa copiar o diretório INTEIRO (79 fixtures + README) e calcular/verificar o hash agregado que prova que as duas cópias não divergiram — ele deve tratar estes 2 arquivos como já presentes (idealmente sobrescrevendo-os com a cópia oficial, para garantir que vieram do mesmo commit-fonte) e não pular a verificação de hash por já encontrá-los no lugar.
- **Files modified:** `../financeiro-tria/automation/contratos/payment-requests-v1/getTask.sucesso-completo.json`, `getTask.sucesso-minimo.json`
- **Verification:** `diff` byte a byte contra o original em `crm-n1` (cópia direta via `cp`, sem edição)
- **Committed in:** `d3e9b66` (Task 2 commit)

**2. [Regra 1 - Bug] Duas menções a "ClickUp" em comentário do mapper da plataforma, pegas pelo teste estático (f)**
- **Found during:** Task 2, ao rodar `npm test` pela primeira vez — o teste (f) (verificação estática de que o arquivo não referencia ClickUp) falhou porque dois comentários explicativos em `plataforma-payment-mapper.ts` (escritos na Task 1) citavam "mapper ClickUp" e "`clickup-payment-mapper.ts`" para explicar contexto — texto de comentário, não código, mas ainda assim violava o próprio critério que a Task 2 deveria provar.
- **Fix:** Reescrevi os dois comentários sem a palavra "ClickUp" — a explicação técnica permanece (referência a "regras do tenant" e "esse parser"), só o texto mudou.
- **Files modified:** `../financeiro-tria/automation/src/tenants/tria/plataforma-payment-mapper.ts`
- **Verification:** `grep -ni clickup plataforma-payment-mapper.ts` sem resultado; `npm test` com os 7 casos passando
- **Committed in:** `f5f0cfd` (commit separado, pós Task 2 — a Task 1 já estava commitada quando o teste revelou o problema)

**3. [Regra 2 - Missing Critical] `origem` adicionado a `adapters/supabase.ts` — não estava em `files_modified`, mas a própria Task 3 do plano autoriza e exige isso**
- **Found during:** Task 3, ao ler `adapters/supabase.ts` para entender os pontos que consultam por `TaskID`
- **Issue:** A ação da Task 3 instrui explicitamente: "Ajustar `adapters/supabase.ts` e os pontos do serviço que consultam por `TaskID` para incluir `origem`... Declarar esses dois arquivos como tocados no SUMMARY se o ajuste for necessário." O `acceptance_criteria` cobra literalmente `grep -rn "task_id" .../adapters/supabase.ts` revisado item a item.
- **Fix:** `origem` como parâmetro opcional (default `'clickup'`) em `upsertSolicitacaoPagamento` e `getSolicitacaoPagamentoByTaskId`, com `.eq("origem", origem)` adicionado às duas queries. `payment-automation-service.ts` (o outro arquivo mencionado pela Task 3) **não foi tocado** — nenhum call site lá passa `origem` hoje, e o default preserva o comportamento idêntico. Ver Decisão 4/5 acima para o raciocínio completo de por que não reescrevi os call sites do serviço.
- **Files modified:** `../financeiro-tria/automation/src/adapters/supabase.ts`
- **Verification:** `npm run build && npm test` — build limpo, 24/25 testes passam (a falha restante é a pré-existente documentada em `deferred-items.md`)
- **Committed in:** `7cf37ef` (Task 3, parcial)

---

**Total deviations:** 3 auto-fixed (1 bloqueante/Regra 3, 1 bug/Regra 1, 1 funcionalidade crítica ausente/Regra 2)
**Impact on plan:** Todos os três eram necessários para completar as Tasks 1-3 dentro do escopo declarado, sem expandir para `payment-automation-service.ts` (fora de `files_modified`, explicitamente do Plan 02-21). Nenhum scope creep arquitetural.

## Issues Encountered

- O `read_first` da Task 2 assume que as fixtures do Plan 02-02 já existem em `financeiro-tria` — só existem em `crm-n1`. Resolvido via cópia mínima (Deviation 1). Isso é uma dependência implícita não declarada no frontmatter (`depends_on: ["02-02", "02-12"]` está correto para o CONTEÚDO das fixtures, mas a fixture PRECISA estar fisicamente copiada, o que é trabalho do Plan 02-26). Recomendo ao verificador da fase notar essa ordem de dependência de arquivo (não só de conteúdo) para planos futuros que leiam fixtures do lado `financeiro-tria`.
- Nenhum outro problema de execução.

## User Setup Required

**Sim — Task 3 está bloqueada em checkpoint humano.** Ver seção "CHECKPOINT REACHED" no retorno deste executor. Resumo:

1. Rodar contra o Supabase de produção do `financeiro-tria` (fora deste ambiente, decisão do dono):
   ```sql
   select "TaskID", count(*) from public.solicitacoes_pagamentos group by "TaskID" having count(*) > 1;
   ```
2. Se **zero linhas**: aplicar a migração escrita em `../financeiro-tria/supabase/migrations/20260922130000_solicitacoes_origem_unique.sql` (via Supabase CLI/dashboard — não incluído neste commit, decisão do dono contra dado de produção real).
3. Se **alguma linha**: decidir com o dono o que fazer com os duplicados ANTES de aplicar — a migração não apaga nada, só falha na criação do índice único.
4. Confirmar de volta ao orquestrador digitando `"aplicada"` (ou colando o relatório de duplicados, conforme `resume-signal` da Task 3).

## Next Phase Readiness

- **Pronto:** os artefatos que o Plan 02-21 ("seleção do mapper") precisa — a porta `PaymentRequestMapper<TEntrada>`, `mapearSolicitacaoDaPlataforma` (plataforma) e `paymentRequestMapperClickUp` (ClickUp, empacotado) — já existem e passam build+test.
- **Bloqueador para fechar SOL-06 por completo:** a migração `(origem, TaskID)` precisa ser aplicada contra o Supabase real do `financeiro-tria` antes do ensaio de duas semanas (Plan 02-27) começar a gravar a coorte `plataforma` na mesma tabela — sem ela, uma colisão de `TaskID` entre coortes sobrescreve silenciosamente.
- **Para o Plan 02-26:** as 2 fixtures copiadas manualmente (Deviation 1) precisam ser tratadas como já presentes — o plano deve confirmar que a cópia OFICIAL (diretório inteiro + hash agregado) bate byte a byte com o que já está aqui, não pular a verificação por já encontrá-las no lugar.
- **Para o Plan 02-21:** ao decidir COMO selecionar o mapper por origem no composition root, os ~10 call sites de `payment-automation-service.ts` que chamam `getSolicitacaoPagamentoByTaskId`/`upsertSolicitacaoPagamento` sem `origem` explícito vão precisar passar a origem correta explicitamente (hoje usam o default `'clickup'` deste plano, que deixa de ser seguro assumir assim que a coorte `plataforma` existir de verdade).

---
*Phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup*
*Completed: 2026-09-21 (parcial — Task 3 bloqueada em checkpoint humano)*
