---
phase: 04-as-outras-telas-do-financeiro-tria
plan: 04
subsystem: api
tags: [derivacao, dashboard, problemas, aprovacoes-pendentes, node-test, financeiro, financeiro-tria]

# Dependency graph
requires: ["04-01"]
provides:
  - "classificarSolicitacao, severidadeDaSolicitacao, previsaoFormatada, tituloDaSolicitacao, formatarResumo, tentarLerResumoJson, ROTULOS_PERMITIDOS, LinhaDeSolicitacao — em financeiro-tria/automation/src/tenants/tria/financeiro-derivacoes.ts, puras e sem I/O"
  - "montarMetricasDoDashboard, montarAtencaoDoDashboard, montarLinhasDeProblema, montarAprovacoesPendentes — as quatro derivações que as rotas de /v1/leituras/{dashboard,problemas,aprovacoes-pendentes} de 04-07 vão chamar diretamente"
  - "financeiro-derivacoes.test.ts — 8 casos node:test provando equivalência com o original sobre a fixture (D4-06) e sanitização do RESUMO por valor (D4-05)"
affects: [04-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Allowlist positiva também na SAÍDA de texto formatado: formatarResumo monta a lista de linhas percorrendo ROTULOS_PERMITIDOS (o que incluir), nunca Object.entries do JSON de origem filtrando o que excluir — o mesmo princípio de 04-01 aplicado a um formatador, não só a um DTO de linha"
    - "Verificação por mutação sobre o array de rótulos permitidos: reintroduzir um rótulo excluído derruba exatamente os casos de sanitização, nunca os de equivalência — prova que os dois blocos de teste são independentes"

key-files:
  created:
    - "../financeiro-tria/automation/src/tenants/tria/financeiro-derivacoes.ts"
    - "../financeiro-tria/automation/src/tenants/tria/financeiro-derivacoes.test.ts"
  modified: []

key-decisions:
  - "Os textos do header comment e dos comentários de campo evitam os literais 'app_key', 'app_secret', 'realIntegrations', 'lastRun', 'express', 'supabase-js' e 'lucide-react' — as três primeiras revisões do arquivo continham esses tokens em prosa (documentando exatamente as exclusões que o plano pede) e isso derrubava os greps de aceitação de 0-ocorrências das Tasks 1 e 2; reescrito para descrever as mesmas decisões sem citar o nome literal do campo/pacote proibido (Rule 1 — o grep é a especificação executável, a prosa se adapta a ela, não o contrário)"
  - "montarAprovacoesPendentes usa o vocabulário 'aprovada'/'aguardando aprovação'/'em validação' (incluindo o ramo 'aprovada', embora o filtro Aprovado !== true torne esse ramo inalcançável na prática) — mantido porque o plano pede o mapeamento completo de getSolicitacaoStatus, não uma versão já pré-filtrada; o teste do Bloco 1 (d) prova que nenhuma linha com Aprovado === true escapa do filtro, então o ramo morto não é um bug, é o tipo de retorno sendo honesto sobre o domínio da função de mapeamento"
  - "O caso de fallback 'Sem comentario registrado.' (Bloco 1, item b) usa uma linha sintética construída no teste, não uma linha da fixture compartilhada — SOLICITACOES_DE_TESTE não tem nenhuma linha com comentario E comentario_aprovacao ambos nulos/vazios (todas têm ao menos um RESUMO em JSON), então provar esse ramo exigia um objeto ad-hoc; mesmo padrão que 04-01 já usou para a projeção do Plano de contas (fixture inline quando a fixture compartilhada não cobre o caso)"
  - "O JSON de sanitização do Bloco 2 (documento + forma_pagamento.chave_pix + conta_de_pagamento + segredo_qualquer) é construído localmente no arquivo de teste, não reaproveitado de RESUMO_IA_DE_TESTE da fixture — a fixture de 04-01 tem documento e chave_pix mas não tem conta_de_pagamento nem uma chave desconhecida (segredo_qualquer), e o plano pede exatamente essas quatro variáveis provadas juntas"

patterns-established:
  - "Toda rota futura de /v1/leituras/{dashboard,problemas,aprovacoes-pendentes} (04-07) chama estas quatro funções diretamente sobre o array cru de GET /financeiro/solicitacoes — nenhuma rota re-deriva ou reimplementa a lógica"

requirements-completed: []

# Metrics
duration: ~40min (leitura de contexto e código-fonte incluída; entre o primeiro e o último commit de código, ~2min)
completed: 2026-09-23
---

# Phase 04 Plan 04: Dashboard, Problemas e Aprovações pendentes — as derivações puras Summary

**As três leituras derivadas do Financeiro saem do front do Vercel e viram quatro funções puras e testadas no `automation/`, com o RESUMO formatado passando por uma allowlist positiva de rótulos em vez do repasse por lista negra implícita do original.**

## Performance

- **Duration:** ~2 min entre o primeiro e o último commit de código (`29587f1` → `fbe95f9`); leitura de contexto (CONTEXT/RESEARCH/PATTERNS/04-01-SUMMARY/UI-SPEC/código-fonte dos dois repositórios) levou a maior parte do tempo real da sessão
- **Started:** 2026-09-23T20:47:16-03:00 (primeiro commit)
- **Completed:** 2026-09-23T20:49:18-03:00 (último commit de código)
- **Tasks:** 3/3
- **Files created:** 2, ambos em `../financeiro-tria` (mais este SUMMARY em `crm-n1`)

## Accomplishments

- `financeiro-derivacoes.ts` (444 linhas): as sete funções e o tipo de entrada listados no frontmatter do plano, todas puras, sem `express`/`@supabase/supabase-js`/`lucide-react`/`process.env`
- Allowlist positiva de rótulos (`ROTULOS_PERMITIDOS`) para o RESUMO formatado — exclui `documento`, `forma_pagamento`, `conta_de_pagamento`, `codigo_do_cliente` e `codigo_de_integracao` do original, e `formatarResumo` **não** porta o laço final de chaves desconhecidas do `formatResumo.ts` original (a divergência deliberada que D4-05 exige)
- As quatro derivações (`montarMetricasDoDashboard`, `montarLinhasDeProblema`, `montarAprovacoesPendentes`, `montarAtencaoDoDashboard`) reproduzem as mesmas contagens e textos de `buildDashboardStats`/`buildProblemRows` do arquivo original, sem os campos que a tela nova não renderiza (`icon`, `tone` em inglês, `action: "Revisar"`)
- Teste de equivalência (Bloco 1, 4 casos): contagens do Dashboard afirmadas por número literal derivado à mão da fixture (não recomputadas com a mesma função sob teste), filtro `Aprovado !== true` provado por lista de ids, classificação pagar/receber/sem-categoria, e ausência de chave de decisão (`aprovar`/`acao`/`action`) em Aprovações pendentes
- Teste de sanitização (Bloco 2, 4 casos): `formatarResumo` e `montarLinhasDeProblema` provados por valor contra CNPJ falso, chave Pix falsa, o rótulo "Documento" e uma chave JSON inventada — com o contra-caso que prova que o comentário cru realmente contém a chave Pix falsa (a prova não é vazia)
- Verificação por mutação feita à mão conforme `<acceptance_criteria>` da Task 3: reintroduzir `["documento", "Documento"]` em `ROTULOS_PERMITIDOS` derrubou exatamente os dois casos do Bloco 2 (`formatarResumo remove documento...` e `montarLinhasDeProblema nao vaza...`), sem afetar nenhum caso do Bloco 1 — desfeito antes do commit, `npx tsc --noEmit` limpo depois

## Task Commits

Cada task foi commitada atomicamente **no repositório `financeiro-tria`** (não em `crm-n1` — ver `<two_repository_warning>` do plano). O arquivo de código nasceu como um todo (Tasks 1+2 no mesmo arquivo); para manter um commit por task, o conteúdo da Task 2 foi temporariamente removido, a Task 1 foi commitada sozinha, e a Task 2 foi restaurada e commitada em seguida — sem `git add -A`/`git clean`/`git stash` em nenhum momento, sempre `git add <caminho exato>`.

1. **Task 1: Portar o formatador de RESUMO, já sanitizado** - `29587f1` (feat)
2. **Task 2: As três derivações — métricas, problemas e aprovações pendentes** - `ef926ec` (feat)
3. **Task 3: O teste de equivalência e o de sanitização** - `fbe95f9` (test)

**Plan metadata:** (este commit, `docs(04-04): complete...`, feito em `crm-n1` — ver seção de commits abaixo)

## Files Created/Modified

Repositório `financeiro-tria` (branch `main`):
- `automation/src/tenants/tria/financeiro-derivacoes.ts` - as sete funções puras + o tipo `LinhaDeSolicitacao` + `ROTULOS_PERMITIDOS`
- `automation/src/tenants/tria/financeiro-derivacoes.test.ts` - os 8 casos `node:test`

Repositório `crm-n1` (este):
- `.planning/phases/04-as-outras-telas-do-financeiro-tria/04-04-SUMMARY.md` - este arquivo

`git -C ../financeiro-tria status --porcelain | wc -l` retornou `89` depois de cada um dos três commits — confirmado antes e depois de cada task, nenhum dos 89 arquivos pré-existentes foi tocado.

## Decisions Made

Ver `key-decisions` no frontmatter — os quatro pontos mais relevantes:

1. Prosa do cabeçalho reescrita para não citar literalmente `app_key`/`app_secret`/`realIntegrations`/`lastRun`/`express`/`supabase-js`/`lucide-react`, porque os greps de 0-ocorrências das Tasks 1 e 2 são a especificação executável dessas ausências — a primeira redação documentava as mesmas decisões citando os nomes exatos e falhava os greps.
2. `montarAprovacoesPendentes` mantém o ramo `"aprovada"` no tipo de retorno mesmo sendo inalcançável depois do filtro `Aprovado !== true` — é o mapeamento completo que o plano pede, não uma versão pré-filtrada.
3. O caso de fallback "Sem comentario registrado." e o JSON de sanitização do Bloco 2 são construídos localmente no teste, não reaproveitados da fixture compartilhada de 04-01, porque essa fixture não cobre exatamente essas combinações (comentário duplamente vazio; documento + chave_pix + conta_de_pagamento + chave desconhecida juntos na mesma linha).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Comentários do cabeçalho citando literalmente os campos/pacotes proibidos derrubavam os greps de aceitação**
- **Found during:** verificação das `<acceptance_criteria>` das Tasks 1 e 2, logo após a primeira escrita do arquivo
- **Issue:** o cabeçalho e os comentários de campo, ao documentar por que `app_key`/`app_secret` não atravessam e por que `realIntegrations` não foi portado (exigência explícita da Task 1), citavam esses tokens literalmente — o que fazia `grep -cE "app_key|app_secret"` e `grep -cE "realIntegrations|lastRun"` devolverem `1`/`2` em vez do `0` exigido pelas `<acceptance_criteria>`. O mesmo aconteceu com a frase "não importa `express`/`@supabase/supabase-js`/`lucide-react`" do parágrafo final do cabeçalho.
- **Fix:** reescrita da prosa para descrever as mesmas três decisões sem citar o nome literal do campo/pacote excluído (ex.: "as duas colunas de credencial Omie por linha" em vez de `app_key`/`app_secret`; "framework de servidor, cliente de banco ou biblioteca de ícones" em vez dos três nomes de pacote).
- **Files modified:** `../financeiro-tria/automation/src/tenants/tria/financeiro-derivacoes.ts`
- **Verification:** os quatro greps de 0-ocorrências (`realIntegrations|lastRun`, `app_key|app_secret`, `express|supabase-js|lucide-react|process\.env`, e o laço de chaves desconhecidas) voltaram a `0`; `npx tsc --noEmit` limpo depois da edição.
- **Committed in:** `29587f1` (Task 1) e `ef926ec` (Task 2) — a correção foi feita antes do primeiro commit de cada task, então nenhum commit isolado registra o "antes" com o texto proibido.

---

**Total deviations:** 1 auto-fixed (1 bug, encontrado antes do primeiro commit — nenhum commit ficou com o texto que falhava o grep).
**Impact on plan:** nenhuma mudança de comportamento nas funções, só na prosa dos comentários.

## Issues Encountered

- Nenhum bloqueio novo. O split de um arquivo recém-criado em dois commits (Task 1 / Task 2) exigiu um passo manual (escrever o conteúdo completo, truncar para a Task 1, commitar, restaurar o conteúdo completo, commitar de novo) porque `git add -p` não separa hunks de um arquivo inteiramente novo sem `git add -N` prévio, e mesmo assim o diff de um arquivo 100% adicionado chega como um hunk só — documentado aqui para quem revisar o histórico de commits deste plano perceber que o conteúdo final é idêntico ao que teria saído de duas edições sequenciais, não de um split artificial de linhas no meio de uma função.
- `npm test` completo no `automation/`: 103 passam, 1 falha (`payment-rules.test.ts`, "resolve responsavel por centro de custo com fallback", `'Elifas'` vs `/FINQ/i`) — a falha pré-existente já registrada em `deferred-items.md` por 04-01, confirmada aqui como ainda presente e não tocada por este plano (nenhuma edição em `payment-rules.ts`/`payment-rules.test.ts`). Nenhuma entrada nova adicionada a `deferred-items.md` (instrução explícita do prompt de execução).
- Verificação do `crm-n1` (`npm run check`) **dispensada por decisão do orquestrador** — este plano não toca nenhum arquivo de `crm-n1` além deste SUMMARY, e o custo/tempo do `apps/api` (Postgres real, `testTimeout: 180_000`) excede a janela do executor. Waiver registrado aqui conforme instruído.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `financeiro-derivacoes.ts` está pronto para as rotas `/v1/leituras/{dashboard,problemas,aprovacoes-pendentes}` de 04-07 importarem diretamente — nenhuma rota HTTP foi criada por este plano (fora de escopo: este plano é só a derivação pura).
- As quatro funções recebem `readonly LinhaDeSolicitacao[]`, o mesmo formato que `GET /financeiro/solicitacoes` já devolve hoje (ajustado ao tipo de entrada mínimo) — 04-07 não precisa de nenhuma transformação intermediária além de mapear a resposta HTTP para esse tipo.
- Nenhum bloqueio novo para os planos seguintes da Fase 4. A falha pré-existente de `payment-rules.test.ts` permanece documentada em `deferred-items.md` (de 04-01), sem entrada duplicada.

---
*Phase: 04-as-outras-telas-do-financeiro-tria*
*Completed: 2026-09-23*

## Self-Check: PASSED

- FOUND: `../financeiro-tria/automation/src/tenants/tria/financeiro-derivacoes.ts`
- FOUND: `../financeiro-tria/automation/src/tenants/tria/financeiro-derivacoes.test.ts`
- FOUND commit `29587f1` (Task 1) in `../financeiro-tria`
- FOUND commit `ef926ec` (Task 2) in `../financeiro-tria`
- FOUND commit `fbe95f9` (Task 3) in `../financeiro-tria`
