---
phase: 00-prepara-o
plan: 05
subsystem: api
tags: [clickup, exportacao, manifesto, lgpd, importacao]

# Dependency graph
requires:
  - phase: 00-prepara-o (plan 04)
    provides: "exportar.cli.ts (npm run exportar:clickup -w @n1/api), gerarManifesto/escreverManifesto, exportar.integration.test.ts provado contra a API real"
provides:
  - "Exportação real e completa das três Listas do ClickUp em apps/api/exportacoes/clickup/ (fora do git): 3.118 Tarefas (2.859+2 arquivadas em Contas a pagar, 240 em Contas a receber, 19 em Solicitação de pagamento), 4.412 Comentários, 3.120 time_in_status, 1.595 anexos — 11.001 arquivos, 504.399.405 bytes"
  - "apps/api/exportacoes/MANIFESTO.md e MANIFESTO.json commitados — prova de paridade (CON-09), sem PII"
  - "Achado documentado: a Lista de Solicitação de pagamento (901109104938) não retém histórico de Tarefas processadas — só 19 Tarefas em disco, não as ~1.110 do inventário legado (essas ~1.110 são linhas de solicitacoes_pagamentos no Supabase do financeiro-tria, não Tarefas do ClickUp)"
affects: ["00-06 (spec da Solicitação de pagamento lê esta exportação, D-05 — a Lista real tem só 19 Tarefas, não 1.110)", "00-07 (fechamento da fase)", "Fase 2/3 (a importação de '1.110 solicitações históricas' precisa vir do Supabase do financeiro-tria, não desta exportação do ClickUp, para a Lista de Solicitação)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Exportação real de ~2h rodada em background com run_in_background do executor, acompanhada só por notificação de término (nunca polling em primeiro plano) — o próprio disco (arquivo por página/recurso) é o checkpoint de retomada, não exercitado nesta execução porque não houve interrupção"
    - "--so-manifesto regenera o manifesto a partir do disco sem tocar a rede — usado como passo de confirmação final antes do commit, mesmo sem ter havido retomada"

key-files:
  created:
    - apps/api/exportacoes/MANIFESTO.md
    - apps/api/exportacoes/MANIFESTO.json
  modified: []

key-decisions:
  - "Achado tratado como fato de produção a registrar, não como bug a corrigir (RESEARCH.md Pitfall + ação do Plan 00-05 Task 1 item 3 antecipam exatamente este caso: 'menor se automation/ gravou linhas por Tarefas apagadas'); verificado independentemente por list.json.task_count=18 (metadado da própria API do ClickUp, sem PII) e por 0 avisos/paginação completa (last_page após 1 página) — não é exportação incompleta"
  - "Acceptance criteria do Task 1 (tarefas+tarefasArquivadas >= 500 para 901109104938) NÃO foi satisfeito literalmente — decisão de prosseguir documentando a divergência em vez de bloquear, porque (a) é dado real e verificado, não defeito de código, (b) o texto do plano autoriza explicitamente 'registrar a diferença, não corrigir' para este cenário, e (c) as truths do frontmatter do plano (as 3 Listas em disco, paginadas e brutas) foram cumpridas integralmente"

patterns-established: []

requirements-completed: [PREP-02]

# Metrics
duration: ~2h10min (dominado pelas ~2h02m da exportação real em segundo plano)
completed: 2026-09-17
---

# Phase 00 Plan 05: Exportação real do ClickUp + manifesto commitado Summary

**Exportação completa e sem interrupções das três Listas do ClickUp (3.118 Tarefas, 4.412 Comentários, 3.120 `time_in_status`, 1.595 anexos, 11.001 arquivos/504 MB em disco fora do git) com `MANIFESTO.md`/`MANIFESTO.json` commitados como prova de paridade — e o achado de que a Lista de Solicitação de pagamento não retém histórico (19 Tarefas, não 1.110).**

## Performance

- **Duration:** ~2h10min
- **Started:** 2026-09-17T00:33:00Z (aprox.)
- **Completed:** 2026-09-17T02:41:33Z
- **Tasks:** 2
- **Files modified:** 2 (criados)

## Accomplishments

- Pré-condição confirmada sem auth gate: `CLICKUP_API_TOKEN` presente e funcional em `apps/api/.env` (amostra de 1 Tarefa da Lista `901107648977` respondeu normalmente); artefatos untracked da amostra (`MANIFESTO.*` gerados pelo smoke check) removidos antes da exportação real, sem impacto no git.
- `npm run exportar:clickup -w @n1/api` (default: as 3 Listas, anexos `todas`, `time_in_status` `auto`) rodado em segundo plano de 2026-09-17T00:35:56.644Z a 02:37:31.958Z (2h01m35s), **sem nenhuma interrupção nem retomada necessária** — 11.000 requisições, 0 avisos, `exportacao.log` com 3.156 linhas e 0 ocorrências de `pk_[0-9]+` (token nunca vazou).
- `time_in_status` confirmado **disponível** para as 3 Listas (3.120 registros gravados, 0 indisponíveis) — o ClickApp "Total time in Status" está ligado no Workspace, confirmando o Plan 00-04.
- Contagens finais por Lista (recontadas do disco por `contarRecursos`, nunca confiadas em `execucao.json`):
  | Lista | Tarefas | Arquivadas | Detalhes | Comentários | Anexos baixados/referenciados | time_in_status |
  |---|---|---|---|---|---|---|
  | `901107637383` (Contas a pagar) | 2.859 | 2 | 2.861 | 4.266 | 1.505/1.505 | 2.861 |
  | `901107648977` (Contas a receber) | 240 | 0 | 240 | 100 | 89/89 | 240 |
  | `901109104938` (Solicitação de pagamento) | 19 | 0 | 19 | 46 | 1/1 | 19 |
- Tamanho total em disco (`du -sh apps/api/exportacoes/clickup`): **508M** (508 MB no bloco do filesystem; manifesto registra 504.399.405 bytes exatos de conteúdo).
- `MANIFESTO.md`/`MANIFESTO.json` regenerados do disco via `--so-manifesto` (confirma que refletem o estado final, mesmo sem retomada) e commitados: `versao: 1`, `amostra: false`, `hashAgregado: adf52d27493c28f42d03592664b88d4f9b6d9bb77d61e493187af29b6f5b6d68`, 11.001 arquivos.
- Varredura de PII (e-mail, CPF, CNPJ, nome de anexo original) nos dois arquivos commitados: **0 ocorrências** em todos os quatro padrões; `usuariosVistos` (163 ids distintos) sem campo `nome`.
- `git status --porcelain`/`git ls-files` confirmam: nada de `apps/api/exportacoes/clickup/` rastreado pelo git; o commit inclui exatamente os dois arquivos do manifesto (`git show --stat`).
- `npm run typecheck -w @n1/api` verde após o commit (nenhum código foi alterado nesta plan — só dados exportados e o manifesto).

## Task Commits

Each task was committed atomically:

1. **Task 1: Rodar a exportação completa das três Listas** — sem commit próprio (nada versionado por esta task; os dados ficam fora do git em `apps/api/exportacoes/clickup/`, conforme D-02). Execução registrada acima e em `execucao.json` (não commitado).
2. **Task 2: Conferir e commitar a prova de paridade** - `7df69cc` (docs)

**Plan metadata:** ver commit final de STATE/ROADMAP abaixo.

## Files Created/Modified

- `apps/api/exportacoes/MANIFESTO.md` - resumo legível por Lista/recurso, `time_in_status`, usuários vistos (id + ocorrências, sem nome), avisos, totais e `hashAgregado`
- `apps/api/exportacoes/MANIFESTO.json` - manifesto completo: `versao`, `exportador.commit`, `amostra`, `timeInStatusDisponivel`, `listas[]`, `usuariosVistos[]`, `avisos[]`, `arquivos[]` (caminho+bytes+sha256), `hashAgregado`
- (fora do git, não commitado) `apps/api/exportacoes/clickup/**` — as 3 Listas em bruto: `list.json`, `fields.json`, `members.json`, `tasks/`, `tasks-arquivadas/`, `task/`, `comments/`, `time-in-status/`, `attachments/`, `usuarios-vistos.json`, `execucao.json`, `exportacao.log`

## Decisions Made

Ver `key-decisions` no frontmatter. Resumo: o achado da Lista de Solicitação (19 Tarefas, não 1.110) foi tratado como fato de produção a documentar, não como defeito a corrigir — a exportação em si é completa e correta (paginação terminou em `last_page`, 0 avisos, e o próprio metadado `list.json.task_count` da API, sem PII, confirma o número baixo de Tarefas ativas nessa Lista).

## Deviations from Plan

### Achado sem correção de código (não é Regra 1/2/3 — é fato de dado, não bug)

**Lista `901109104938` (Solicitação de pagamento) tem só 19 Tarefas, não ~1.110**

- **Found during:** Task 1, ao ler `execucao.json`/o resumo do CLI ao final da exportação real.
- **O que se esperava:** `docs/08-migracao-financeiro/01-inventario-financeiro-tria.md §5.7` registra 1.110 linhas na tabela `solicitacoes_pagamentos` do Supabase do `financeiro-tria`; D-05/D-06 de `00-CONTEXT.md` citam esse número como ordem de grandeza esperada para a exportação desta Lista, e o `<verify><automated>` da Task 1 codifica isso como `tarefas + tarefasArquivadas >= 500`.
- **O que a exportação real mostrou:** a Lista `901109104938` tem 19 Tarefas no total (18 abertas em "não aprovado" + 1 "aprovado" segundo a distribuição de status; conteúdo de Tarefa não foi aberto por este executor — D-02/leitura defensiva), 0 arquivadas, 1 página só, `last_page` atingido na primeira chamada — paginação completa, não truncada. `apps/api/exportacoes/clickup/901109104938/list.json` (metadado da Lista, sem PII) confirma `task_count: 18` de forma independente do exportador.
- **Por que não é bug:** a paginação seguiu exatamente o padrão que `RESEARCH.md` Pattern 1 descreve (`page`/`last_page`), sem erro, sem aviso, sem 4xx/429. O código de `exportar.ts` (Plans 00-01/00-03) não foi tocado nesta plan. Não há nada a "corrigir" no exportador — ele reportou fielmente o que a API do ClickUp devolveu.
- **Hipótese de trabalho (não verificada em profundidade, para não abrir conteúdo de Tarefa):** as ~1.110 Solicitações históricas existem como linhas na tabela `solicitacoes_pagamentos` do Supabase do `financeiro-tria` (fora deste monorepo), não como Tarefas retidas nesta Lista do ClickUp — o pipeline aparentemente move/recria o processado na Lista "Contas a pagar" (`901107637383`, que tem 2.861 Tarefas, bem acima do "> 200" estimado em `01-inventario`) e não mantém a Tarefa original de Solicitação como histórico permanente.
- **Impacto downstream (registrar para não virar bloqueio invisível):**
  - **Plan 00-06 (PREP-03, spec da Solicitação):** a "Lista real" citada em D-05 tem só 19 Tarefas para ler — é uma amostra pequena, não 1.110; a spec deve declarar isso explicitamente (não prometer cobertura de 1.110 casos) e usar o que existe (19 Tarefas + `payment-rules.ts`/`clickup-payment-mapper.ts` do `automation/`) como fonte.
  - **Fase 2/3 (importação de "1.110 solicitações históricas", `PROJECT.md` Active):** essa importação **não pode vir desta exportação do ClickUp** para o histórico completo — a fonte das ~1.110 linhas é a tabela `solicitacoes_pagamentos` do Supabase do `financeiro-tria` (fora do escopo desta exportação e deste monorepo). Isto muda o desenho de origem de dados da Fase 2/3 e deve ser levado para o planejamento daquela fase.
- **Verification:** `apps/api/exportacoes/clickup/901109104938/list.json` (`task_count: 18`), `execucao.json` (`paginasDeTarefas: 1`, `tarefas: 19`, `tarefasArquivadas: 0`, `avisos: []`), `exportacao.log` linha única de página (`lista 901109104938 · tarefas página 0 · 19 itens` seguida de `tarefas arquivadas página 0 · 0 itens`, sem retry/429 no trecho).
- **Committed in:** não aplicável (achado de dado, nada de código a commitar; registrado só neste SUMMARY e nas contagens do `MANIFESTO.md` já commitado em `7df69cc`).

---

**Total deviations:** 0 auto-fixed (nenhum bug/funcionalidade faltante/bloqueio de código encontrado); 1 achado de dado de produção documentado sem alteração de código, com impacto explícito nas Plans 00-06 e Fase 2/3.
**Impact on plan:** O `<verify><automated>` da Task 1 (limiar `>= 500` para `901109104938`) **não passa literalmente** contra os dados reais — decisão de prosseguir (não bloquear) porque a divergência é um fato de produção verificado independentemente (metadado da própria API), não um defeito da exportação, e o texto de ação do Plan 00-05 (Task 1, item 3) autoriza explicitamente "registrar a diferença, não corrigir" para o cenário de Tarefas historicamente removidas do ClickUp. As truths do frontmatter do plano (as 3 Listas em disco, paginadas e brutas, dá para contar e comparar) foram cumpridas integralmente; só o número absoluto esperado para uma Lista específica não se confirmou.

## Issues Encountered

- Smoke check da pré-condição (Task 1, passo 1) gravou `MANIFESTO.md`/`MANIFESTO.json` de uma amostra na pasta versionada real (mesmo comportamento já documentado como pitfall conhecido no Plan 00-04: a pasta de saída do manifesto é fixa, não segue `--pasta`). Arquivos untracked removidos (`rm`) antes de iniciar a exportação real; confirmado por `git status --short` antes e depois que nada de amostra ficou no repositório em nenhum commit.
- Nenhuma interrupção, erro de rede, 5xx ou 429 persistente durante as ~2h02m de execução — o mecanismo de retomada por disco (Pitfall 4 do RESEARCH.md) não precisou ser exercitado nesta execução.

## User Setup Required

None - `CLICKUP_API_TOKEN` já estava configurado em `apps/api/.env` neste ambiente (herdado de sessão anterior do dono, confirmado no Plan 00-04).

## Next Phase Readiness

- **PREP-02 fecha nesta plan**: as 3 Listas exportadas por completo, `MANIFESTO.md`/`MANIFESTO.json` commitados como prova de paridade, sem PII, `git status` limpo quanto à pasta ignorada.
- **Plan 00-06 (PREP-03)** pode começar: a Lista real de Solicitação de pagamento está em disco (19 Tarefas) — a spec deve declarar explicitamente que a Lista tem volume pequeno hoje (não 1.110) e citar a hipótese de que o histórico vive no Supabase do `financeiro-tria`, fora do alcance desta exportação.
- **Alerta para o planejamento da Fase 2/3**: a importação de "1.110 solicitações históricas" (`PROJECT.md`, requisito Active da Fase 2) precisa de uma fonte de dado diferente desta exportação do ClickUp para o histórico completo da Solicitação — provavelmente o Supabase `financeiro-tria` (`solicitacoes_pagamentos`), não coberto por PREP-02. Não é um blocker desta fase, mas deve ser levantado explicitamente ao planejar a Fase 2.
- **Item em aberto herdado do Plan 00-02** (não resolvido nem agravado por esta plan): revisor FO ClickUp `81581802` aparece em `usuariosVistos` com 559 ocorrências — segunda conta ativa nas 3 Listas (além do Financeiro `81581816` com 5.537 ocorrências, a maior contagem do manifesto). O e-mail real desta pessoa continua desconhecido (`de-para-usuarios.ts`, Plan 00-02, já registra isso como item em aberto); esta exportação não adiciona nem resolve esse dado — só confirma que o id aparece com frequência real nas Listas.
- **Verificação manual pendente para `/gsd-verify-work` (Task 2 `<human-check>`, Manual-Only por `00-VALIDATION.md`)**: comparar no ClickUp de produção o total de Tarefas de cada Lista (incluindo fechadas/arquivadas) com as contagens deste manifesto; abrir 3 Tarefas por amostragem (uma por Lista) e conferir Comentários/anexos batendo com o disco; confirmar em Settings › ClickApps que "Total time in Status" está ligado, batendo com `timeInStatusDisponivel: true`. Não reproduzível em CI (exige o token e a UI do ClickUp) — não bloqueou esta execução, listado aqui para o verificador.

---
*Phase: 00-prepara-o*
*Completed: 2026-09-17*

## Self-Check: PASSED
