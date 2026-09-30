---
phase: 06-conferencia-do-resumo-e-anexos
plan: 09
subsystem: financeiro-tria/automation (coorte plataforma: decisão, S5, webhook /aprovacao-decidida, worker)
tags: [gap-closure, s5, webhook, receipt, varredura, idempotencia, retry, cnpj, porta]
requires:
  - phase: 06-05
    provides: "S5/S6 em handlePlatformApprovalDecision e publicarResumoDepoisDaAprovacao"
  - phase: 06-08
    provides: "financeiro-tria em 5ceca48 (BASE deste plano)"
provides:
  - "handlePlatformApprovalDecision(taskId, decision, member, { eventId }) só com a decisão; devolve resumoPendente"
  - "PaymentAutomationService#publicarResumoDaDecisao: S5 por evento, deduplicado por resumo:<taskId>"
  - "classificarFalhaDoResumo, ErroTransitorioDoResumo, CodigoDaFalhaDoResumo, ResultadoDoResumo"
  - "chaves por evento: status:<eventId>:<status>, approval-comment:<eventId>:rejected-comment, summary:<eventId>:comment, summary:<eventId>:falha"
  - "409 IDEMPOTENCY_KEY_REUSED no RESUMO da plataforma = já publicado"
  - "montarHandlerDeAprovacao: 202 antes do S5, receipt aberto; publicarResumoDaDecisaoReivindicado; reprocessarAprovacoesPresas; filtrarCandidatosDaVarredura"
  - "worker: varreduraDeAprovacoes (terceiro passo); iniciarWorkerDaPlataforma(servicos?); server.ts passa servicosDosTenants()"
  - "retryRun(runId, 'summary') da plataforma = repetirResumoDaPlataforma (só o S5, ciclo retry-<uuid>)"
  - "dadosDoCnpjComPrazo/PRAZO_DA_CONSULTA_DE_CNPJ_MS em adapters/public-apis, usados pelo /lancar e pelo S5 da plataforma"
affects: [06-10, 06-15]
tech-stack:
  added: []
  patterns:
    - "Decisão no turno HTTP, efeito lento depois do 202 com o receipt do próprio evento aberto; varredura por CAS retoma"
    - "Chave de idempotência pelo ciclo (eventId), nunca pela Tarefa"
    - "Transitório lança um ErroTransitorioDaPlataforma com só o código (last_error_summary sem mensagem crua)"
key-files:
  created: []
  modified:
    - ../financeiro-tria/automation/src/tenants/tria/payment-automation-service.ts
    - ../financeiro-tria/automation/src/tenants/tria/payment-automation-service.plataforma.test.ts
    - ../financeiro-tria/automation/src/http/routes.ts
    - ../financeiro-tria/automation/src/http/webhooks-plataforma.ts
    - ../financeiro-tria/automation/src/http/webhooks-plataforma.test.ts
    - ../financeiro-tria/automation/src/http/worker-da-plataforma.ts
    - ../financeiro-tria/automation/src/http/worker-da-plataforma.test.ts
    - ../financeiro-tria/automation/src/server.ts
    - ../financeiro-tria/automation/src/adapters/public-apis.ts
    - ../financeiro-tria/automation/src/http/contas-a-pagar-routes.ts
    - ../financeiro-tria/automation/README.md
key-decisions:
  - "Nenhuma variável de ambiente nova. No processo local, o S5 assíncrono fica DESLIGADO por duas chaves que já existem: PAYMENT_REQUEST_SOURCE=clickup (o worker não liga, logo a varredura de aprovações não roda) e PLATAFORMA_WEBHOOK_TOKEN ausente ou vazio (toda entrega a /webhooks/plataforma/* é 401 antes de ler o corpo, logo nenhuma decisão e nenhum S5 depois do 202)"
  - "publicarResumoDaDecisao usa createOrResumeRun para o runId, como a decisão; a varredura roda a decisão de novo antes do S5 porque não sabe se o processo morreu antes ou depois de gravá-la, e toda escrita da decisão é idempotente pelo evento"
  - "A tentativa da varredura que atinge maxTentativas (padrão 10) é a última: o S5 avisa na Solicitação e fecha o receipt"
  - "registrarFalhaTransitoriaDoResumo usa recommendedAction 'nenhuma' (quem repete é a varredura); a permanente mantém 'tentar_novamente'"
  - "repetirResumoDaPlataforma nunca avisa na Solicitação (avisarFalhaNaSolicitacao: false): quem repete pelo painel recebe o resultado"
  - "contas-a-pagar-routes.ts importa só dadosDoCnpjComPrazo (a constante deixou de ser usada ali)"
requirements-completed: [RES-05]
metrics:
  duration: "~95 min"
  completed: 2026-09-30
  tasks: 3
  files: 11
---

# Phase 6 Plan 09: S5 fora do turno do webhook, idempotente por evento, repetição só do Resumo — Summary

**A aprovação pela plataforma responde 202 logo depois de gravar a decisão. O S5 (Omie, RAG, IA, RESUMO) roda depois, com o receipt do próprio evento aberto até terminar, e o worker retoma o que ficar preso. As chaves são do evento: o mesmo evento não publica outro RESUMO, um ciclo novo publica. A falha transitória volta pela varredura em vez de virar aviso, e `retryRun("summary")` repete só o Resumo.**

## O que desliga o S5 assíncrono num `automation/` local (para o 06-15)

Este plano **não criou variável nova**. O trabalho assíncrono do S5 tem só dois gatilhos, e as duas chaves que os desligam já existem:

| Gatilho | O que o desliga no processo local | Como conferir |
|---|---|---|
| Varredura `reprocessarAprovacoesPresas` (terceiro passo do worker da plataforma, a cada `PLATAFORMA_FILA_INTERVALO_MS`) | `PAYMENT_REQUEST_SOURCE=clickup`. O worker inteiro só liga com `PAYMENT_REQUEST_SOURCE=plataforma` **e** `PLATAFORMA_BASE_URL`, `PLATAFORMA_SERVICE_TOKEN`, `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` presentes. Desligado, não roda fila, nem varredura de comentários, nem varredura de aprovações. | log de boot `[worker-plataforma] desligado (PAYMENT_REQUEST_SOURCE=clickup)` |
| S5 depois do 202 de `POST /webhooks/plataforma/aprovacao-decidida` | `PLATAFORMA_WEBHOOK_TOKEN` **ausente ou vazio**. Token vazio nunca autentica: os três webhooks da plataforma respondem 401 antes de ler o corpo, sem decisão e sem S5. | um POST ao webhook devolve 401 `CREDENCIAL_AUSENTE`/`CREDENCIAL_INVALIDA` |

O comando local do 06-15 (`PAYMENT_REQUEST_SOURCE=clickup`, sem `PLATAFORMA_WEBHOOK_TOKEN`) já cumpre as duas. Esperado no boot: `[worker-plataforma] desligado (PAYMENT_REQUEST_SOURCE=clickup)`. A linha `[worker-plataforma] varredura de aprovações desligada: sem os serviços dos tenants` só aparece com o worker LIGADO e sem serviços, o que não acontece pelo `server.ts`. Com a fonte ClickUp, o worker não liga e não imprime nada sobre aprovações.

## Commits (financeiro-tria, branch main, BASE `5ceca48`)

| Task | Hash | Mensagem |
|---|---|---|
| 1 | `afd2188` | feat(plataforma): decisão e S5 separados, chaves por evento e falha transitória que volta (06-09) |
| 2 | `1fc1ec0` | feat(plataforma): /aprovacao-decidida responde 202 antes do S5, com receipt aberto e varredura (06-09) |
| 3 | `9e45d84` | feat(plataforma): retryRun("summary") repete só o Resumo, CNPJ do S5 com prazo, caminho provado pelo webhook (06-09) |

Cada commit tem só os caminhos da sua task (conferido com `git diff --cached --stat` e `git show --stat`). A contagem de CR ficou igual à de HEAD em todos os arquivos tocados (0 em todos). Depois de cada commit, `git status --short | wc -l` = 89. No fim, `git diff --ignore-cr-at-eol --stat` saiu vazio e `git diff --stat 5ceca48..HEAD -- automation/src/tenants/tria/payment-automation-service.legado.test.ts` também. Nenhum `git push`.

## Testes

| | Antes (BASE) | Depois |
|---|---|---|
| `npm test` (suíte inteira, isolada) | 671/671 | **695/695**, 0 fail (671 + 24 novos) |
| `npx tsc --noEmit -p .` | verde | verde (a cada task) |

Os novos testes:
- `payment-automation-service.plataforma.test.ts`, bloco `── 06-09 ──`, com o helper novo `comCenarioDoResumo` (Omie, IA e plataforma injetáveis como embrulhos do padrão):
  - D1–D8: a decisão só grava; o S5 por evento; a reentrega sem RESUMO novo e o ciclo novo que publica; o 409 como "já publicado"; transitório (plataforma, Omie `infraestrutura`) que rejeita e, na última tentativa, avisa; permanente que avisa uma vez; reprovação posterior que cancela o S5; a tabela de `classificarFalhaDoResumo`;
  - R1–R5, C1 e E1 (Task 3).
- `webhooks-plataforma.test.ts`: A1–A7.
- `worker-da-plataforma.test.ts`: K1 e K2.

RED visto antes de cada GREEN:
- Task 1: o arquivo da plataforma não carregava (faltavam as exportações).
- Task 2: os dois arquivos de teste não carregavam, e o tsc acusava `varreduraDeAprovacoes`.
- Task 3: R1–R4 e C1 falhavam. R5 e E1 já passavam: R5 é guarda do caminho ClickUp e E1 prova o caminho da Task 2.

### Edições em testes existentes (só a lista fechada do plano)

Todas em `payment-automation-service.plataforma.test.ts`:
- `EVENTO_DA_DECISAO` declarado abaixo de `TASK_ID`;
- o 4º argumento `{ eventId: EVENTO_DA_DECISAO }` em (f), S5 (a), S5 (b), S6 (c), S5 (d) e (e);
- S5 (a): a chamada a `publicarResumoDaDecisao`, `resumoPublicado` passa a ser conferido em `resumo`, `resultado.resumoPendente === true`, e a chave vira `summary:${EVENTO_DA_DECISAO}:comment`;
- S6 (c): a chave vira `approval-comment:${EVENTO_DA_DECISAO}:rejected-comment`;
- S5 (d): a chamada a `publicarResumoDaDecisao`, com `resumoPublicado`/`motivo` sobre ela.

Também entraram três linhas de `import` novas no topo do arquivo, só acrescentadas.

Em `webhooks-plataforma.test.ts` e `worker-da-plataforma.test.ts` nada existente mudou: `git diff -U0 … | grep -c '^-[^-]'` deu 0 nos dois. Só entraram imports novos no topo e os casos no fim. `payment-automation-service.legado.test.ts` ficou sem diff.

## Mutações (cada uma restaurada e conferida com `cmp` contra a cópia)

| # | Mutação | Resultado |
|---|---|---|
| M1 | `summary:${runId}:comment` de volta na coorte plataforma | **D3 falha** (o evento novo não publica); também D2 e S5 (a), pela chave |
| M2 | sem o tratamento do 409 `IDEMPOTENCY_KEY_REUSED` | **D4 falha** (vira aviso de falha) |
| M3 | transitória tratada como permanente | **D5 falha** |
| M4 | `publicarResumoDepoisDaAprovacao` só publica com `ciclo` | **legado `fluxo manual (ClickUp): fornecedor novo é criado no Omie…` falha**: o legado sem edição guarda o método extraído |
| M5 | o handler aguarda `publicarResumoDaDecisao` antes do 202 | **A1 falha** (o `AbortSignal.timeout(2_000)` estoura); A3 também, em 2 s |
| M6 | a varredura de aprovações ignora `falhou_retentavel` | **A5 falha** (e A6) |
| M7 | `ultimaTentativa` sempre `false` na varredura | **A6 falha** |
| M8 | `retryRun("summary")` cai em `runInitialValidation` também na plataforma | **R1 falha** (e R2–R4) |
| M9 | o ramo novo de `retryRun` sem a checagem de coorte | **R5 falha** |
| M10 | S5 da plataforma sem prazo no CNPJ | **C1 falha**, pelo prazo de 3 s do próprio teste (abaixo dos 5 s do runner) |
| M11 | o handler de aprovação fecha o receipt antes do S5 | **E1 falha** (receipt `concluido` com 0 RESUMO) |

## Acceptance greps

- `handlePlatformApprovalDecision` sem `publicarResumoDepoisDaAprovacao`/`ensureSupplierAndCategory`: 0.
- `status:${opcoes.eventId}:${statusAlvo}` = 1, `approval-comment:${opcoes.eventId}:rejected-comment` = 1, `summary:${ciclo ?? runId}:comment` = 1.
- A chave legada em `analyzeApprovalComment` continua: 1.
- `legacyClickUpRaw` em `publicarResumoDaDecisao`: 0. Em `repetirResumoDaPlataforma`, com `runInitialValidation|assignResponsible|updateTaskStatus`: 0.
- `montarHandlerDeAprovacao(deps)` = 1; `reprocessarAprovacoesPresas` no worker = 3; `servicosDosTenants` no `server.ts` = 1.
- Os `event_type` do módulo de webhooks continuam só os três de sempre.
- `async function dadosDoCnpjComPrazo` em `contas-a-pagar-routes.ts` = 0; `export async function dadosDoCnpjComPrazo` em `public-apis.ts` = 1.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Bloqueio] D3 e E1 esbarravam no WR-03 (escopo do 06-10)**
- **Found during:** Task 1 (D3) e Task 3 (E1)
- **Issue:** o segundo ciclo de S5 (EVENTO_B) relê `linha.comentario`, que o primeiro RESUMO sobrescreveu com o `raw` da IA. Sem `Documento:` nesse texto, `ensureSupplier` recusava: `ERRO_INESPERADO: Documento do fornecedor (CNPJ/CPF) ausente…`. É exatamente o fin:WR-03, que o 06-10 corrige lendo o dado atual.
- **Fix:** nenhuma mudança de produção. Os dois testes usam um embrulho de IA novo, `iaComRawDaSolicitacao`, cujo `raw` continua se lendo como a Solicitação. Assim o teste isola a chave por ciclo do que o 06-10 corrige. O helper tem comentário dizendo isso.
- **Files modified:** payment-automation-service.plataforma.test.ts
- **Commits:** afd2188, 9e45d84

**2. [Rule 1 - Teste que travava] Prazo próprio em A3 e C1**
- **Issue:** sob M5, o primeiro POST do A3 (via `postar`, sem prazo) ficava preso no S5 retido, e o arquivo de teste não terminava. Sob M10 (e no RED), o C1 deixava o Omie falso do cenário aberto, com o mesmo efeito.
- **Fix:** A3 passou a usar `fetch` com `AbortSignal.timeout(2_000)`. C1 corre contra um temporizador de 3 s e sempre fecha o cenário. Os dois casos são novos deste plano. As execuções travadas (sob mutação e no RED) foram encerradas à mão, e o arquivo mutado foi restaurado e conferido com `cmp`.
- **Commits:** 1fc1ec0, 9e45d84

**3. Menor** — `contas-a-pagar-routes.ts` importa só `dadosDoCnpjComPrazo`. O plano dizia "as duas", mas a constante deixou de ser usada no arquivo. A chamada em `obterDadosDoCnpj` não mudou.

## Verificação bloqueada

Nenhuma. Uma leitura teve "classifier gave no verdict" (transiente) e foi refeita pela ferramenta de leitura.

## Known Stubs

Nenhum.

## Threat Flags

Nenhuma superfície nova além do threat model:
- o `payload` do receipt leva só `{ decision, decidedByMemberId }` (T-6-09-03);
- `last_error_summary` do transitório é `Resumo não montado: <codigo> (transitório; a varredura repete).` (T-6-09-04);
- a varredura refaz `resolverTenantIdDaTarefa` antes de acionar serviço (T-6-09-05);
- `retry-step` continua atrás de `exigirPainel` (T-6-09-06).

## Next Phase Readiness

- 06-10: o motivo do aviso ainda é `motivoCurto(erro)`. Os testes do 06-09 conferem só o prefixo `Não consegui montar o Resumo` e a chave. O WR-03 (reler a Tarefa pela porta antes do S5) continua aberto para o 06-10: ver o desvio 1.
- 06-15: ver "O que desliga o S5 assíncrono" acima. O deploy precisa subir `afd2188..9e45d84`, e nenhuma variável nova vai para produção. O E2E entre processos do crm-n1 (`apps/api/src/e2e/dois-servicos-suporte.ts`) foi conferido e não editado: o falso de lá não devolve `resumoPendente`, então o receipt fecha `concluido` no 202, como o A4 prova.

## Self-Check: PASSED

- FOUND: os 11 arquivos de `files_modified` nos commits `afd2188`, `1fc1ec0` e `9e45d84` (`git log --oneline 5ceca48..HEAD` com os três).
- FOUND: `npm test` 695/695 e `tsc` verde depois do último commit.
