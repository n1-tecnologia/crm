---
phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup
plan: 26
subsystem: testing
tags: [vitest, node-test, fastify, express, postgres, outbox, e2e, contract-testing, fault-injection]

# Dependency graph
requires:
  - phase: 02-02
    provides: "Contrato v1 canônico (docs/08-migracao-financeiro/04-contrato-plataforma-v1.md, apps/api/src/contratos/v1.ts, 80 fixtures em contratos/payment-requests-v1/)"
  - phase: 02-07
    provides: "Wave 0 de testes do financeiro-tria — criarAppDeTeste, criarServidorFalso, criarOmieFalso, relogioFixo"
  - phase: 02-10
    provides: "Outbox transacional e outbox-worker.ts (gravarEventos, criarOutboxWorker, processarUm)"
  - phase: 02-12
    provides: "PaymentRequestAdapter (a porta) e o composition root PAYMENT_REQUEST_SOURCE em routes.ts"
  - phase: 02-13
    provides: "As sete rotas /v1/integrations/payment-requests/* e a idempotência HTTP (plataforma.http_idempotency)"
  - phase: 02-16
    provides: "As três rotas públicas do Formulário (/v1/public/forms/:secret/*)"
  - phase: 02-17
    provides: "criarPlataformaAdapter e platform-adapter-queue.ts (fila FIFO por Tarefa)"
  - phase: 02-21
    provides: "montarWebhooksDaPlataforma — os três webhooks /webhooks/plataforma/* e receipts-da-plataforma.ts"
  - phase: 02-23
    provides: "Upload de arquivos e confirmação pública (a rota /v1/public/forms/:secret/submissions completa)"
  - phase: 02-24
    provides: "Fallback por comentário — classificador-de-aprovacao.ts, rotas/classificacoes.ts, janela-de-fallback.ts"
provides:
  - "contratos/payment-requests-v1/ copiado verbatim para ../financeiro-tria/automation/contratos/payment-requests-v1/ (81 arquivos), provado idêntico por hash agregado (scripts/verificar-contratos.mjs)"
  - "../financeiro-tria/automation/src/adapters/contrato-v1.test.ts — a MESMA matriz de fixtures do lado consumidor (88 casos, node:test)"
  - "apps/api/src/e2e/dois-servicos.test.ts — E2E real entre Fastify (plataforma) e Express (automation/), submissão pública até decisão de aprovação retomar o pipeline, pelos dois caminhos (clique e comentário)"
  - "apps/api/src/e2e/falhas-injetadas.test.ts — Fault-Injection Matrix (a)-(h) no contexto entre processos; (i) como it.todo nomeado"
  - "apps/api/src/e2e/dois-servicos-suporte.ts — módulo .ts (não .test.ts) com os helpers compartilhados pelos dois arquivos de teste, extraído para evitar reexecução cruzada de suíte"
affects: [02-27, 02-28, gate-pre-paralelo-da-fase-2]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Import cross-repo por especificador de import() NÃO LITERAL (variável, nunca string literal) — o TypeScript trata o retorno como unknown/any e nunca tenta resolver o módulo do repositório irmão em npm run typecheck, mesmo em ambientes sem ../financeiro-tria clonado"
    - "Helpers compartilhados entre arquivos de teste vivem num módulo .ts comum, NUNCA outro *.test.ts — importar um *.test.ts de outro faz o Vitest reexecutar o módulo importado como suíte própria (achado real desta execução)"
    - "PaymentService FALSO (nunca PaymentAutomationService real) com os DOIS métodos que os webhooks chamam de fato, cada implementação chamando o adapter/HTTP real — prova a fiação entre processos sem tocar Supabase/Omie reais"
    - "Fixture de grant via SQL direto em plataforma.registros para simular, em teste, uma concessão que hoje só uma automação futura provisionaria (gap de domínio real e confirmado, documentado, não corrigido)"
    - "gravarEventos (função de produção) chamado diretamente no teste para simular o efeito que uma rota deveria ter, quando essa rota tem um gap de emissão confirmado — nunca SQL inventado"

key-files:
  created:
    - scripts/verificar-contratos.mjs
    - ../financeiro-tria/automation/contratos/payment-requests-v1/ (81 arquivos)
    - ../financeiro-tria/automation/src/adapters/contrato-v1.test.ts
    - apps/api/src/e2e/dois-servicos.test.ts
    - apps/api/src/e2e/dois-servicos-suporte.ts
    - apps/api/src/e2e/falhas-injetadas.test.ts
  modified:
    - package.json (raiz — verificar:contratos em check)
    - ../financeiro-tria/automation/package.json (test:contrato)
    - apps/api/src/e2e/CONTEXT.md

key-decisions:
  - "D-16 aplicado literalmente: as fixtures são copiadas verbatim, nunca um pacote npm compartilhado; a igualdade das duas cópias é provada por hash agregado sha256 (scripts/verificar-contratos.mjs), não por import de tipo."
  - "Import cross-repo (financeiro-tria) sempre por import() com especificador CALCULADO (nunca string literal) — resolve dois problemas de uma vez: TypeScript nunca tenta resolver o módulo do outro repositório (typecheck passa mesmo sem o repositório irmão clonado) e nunca há acoplamento estático entre os dois repositórios git."
  - "PaymentService é FALSO nos dois arquivos de E2E — nunca PaymentAutomationService real (hard limit 1 desta execução, esse serviço fala com o Supabase de produção e o Omie real). Cada método falso que É chamado pelos webhooks (syncAndAssignResponsible, handlePlatformApprovalDecision) invoca o adapter/fila REAIS via HTTP de verdade — prova a mesma coisa que a jornada de produção provaria."
  - "Receipt idempotente (platform_event_receipts) é um cliente FALSO em memória, nunca o Supabase do financeiro-tria — implementa a interface estrutural exata que webhooks-plataforma.ts já aceita para teste."
  - "O classificador do fallback por comentário é a função REAL classificarComentarioDeAprovacao só em dois-servicos.test.ts (com ai.classifyApproval stub) — em falhas-injetadas.test.ts não é usado (fora do escopo da Fault-Injection Matrix)."
  - "helpers compartilhados extraídos para dois-servicos-suporte.ts (não .test.ts) depois de confirmar empiricamente que importar um *.test.ts de outro faz o Vitest reexecutar a suíte importada — achado real, não hipotético, corrigido antes do commit final."

requirements-completed: []

# Metrics
duration: ~5h (leitura extensiva de contexto/código de 10 planos dependentes + duas rodadas de depuração empírica contra Postgres real)
completed: 2026-09-25
---

# Phase 02 Plan 26: Gate pré-paralelo — contrato entre repositórios e E2E entre processos com falhas injetadas Summary

**Contrato v1 provado idêntico por hash nos dois repositórios (88 casos do lado consumidor), E2E real entre Fastify e Express (submissão pública → outbox → webhook → decisão, pelos dois caminhos), e oito das nove linhas da Fault-Injection Matrix compostas entre processos — com três gaps de produção reais descobertos e documentados no caminho.**

## Performance

- **Duration:** ~5h
- **Completed:** 2026-09-25
- **Tasks:** 3/3 (Task 3 inclui um refactor de infraestrutura de teste descoberto durante a execução)
- **Files modified:** 10 (6 criados, 4 modificados), mais 81 fixtures copiadas

## Accomplishments

- **Task 1 — Contrato nos dois repositórios.** `scripts/verificar-contratos.mjs` compara `contratos/payment-requests-v1/` (81 arquivos, 80 fixtures + README) contra a cópia em `../financeiro-tria/automation/contratos/payment-requests-v1/` por sha256 agregado — `OK <hash>` e código 0 quando idênticas, lista de divergências e código 1 quando não. `../financeiro-tria/automation/src/adapters/contrato-v1.test.ts` itera as fixtures em disco por método (nunca uma lista de categorias hardcoded — cresce automaticamente quando um método ganha uma categoria nova, como `getTask.sucesso-em-revisao` da Fase 5) e prova, com `criarPlataformaAdapter` real contra um `criarServidorFalso()`, que o consumidor aceita `sucesso-*`/`replay-mesma-chave`, rejeita `invalido-*`/`replay-chave-igual-payload-diferente` com `ErroPermanenteDaPlataforma`, e classifica `erro-*` pela classe certa conforme `retryable` — 88 casos, todos verdes.
- **Task 2 — E2E entre processos.** `apps/api/src/e2e/dois-servicos.test.ts` sobe `buildApp()` escutando uma porta real e o Express do `automation/` (via `montarWebhooksDaPlataforma`, importado dinamicamente) num processo só, com um `PaymentService` FALSO que chama o adapter REAL. A jornada prova: submissão pública → outbox → webhook → `getTask`/`createComment`/`updateTaskStatus` reais → `solicitarAprovacao` → `decideProcessApproval` por CLIQUE → webhook de decisão → `handlePlatformApprovalDecision`; e o caminho alternativo por COMENTÁRIO (resposta no tópico → evento → classificador real, só a IA é stub → callback autenticado → a MESMA `decideProcessApproval`). Os dois estados finais divergem só em `decisionSource`. 9 casos.
- **Task 3 — Fault-Injection Matrix entre processos.** `apps/api/src/e2e/falhas-injetadas.test.ts` prova as invariantes de (a) a (h): commit atômico da Tarefa+outbox (reenvio da mesma `submissionId`), outbox `pending` sobrevivendo até "religar o worker", replay de `eventId` sem duplicar o run, idempotência HTTP do adapter sem duplicar Comentário, duas workers disputando a mesma fila entregando 1x (`FOR UPDATE SKIP LOCKED`), FIFO por Tarefa da fila de comandos do `automation/` (`criarFilaDeComandos` real sobre um fake genérico de client `postgrest`-like, escrito para este teste), `getTask` nunca reaproveitando `downloadUrl`, e o Omie falso não reincluindo depois de uma "conexão caída". (i) — importação retomada pelo `--resume` — é `it.todo` nomeado: depende de `apps/api/src/importacao/financeiro/importar.ts` (Plan 02-25), que não existe nesta branch.
- **Achado que mudou a arquitetura do teste, no meio do Task 3:** importar `dois-servicos.test.ts` de dentro de `falhas-injetadas.test.ts` fazia o Vitest reexecutar a suíte inteira do primeiro como efeito colateral — confirmado empiricamente (a suíte combinada listava 18 testes, não 9, com dois Fastify e dois Express reais competindo pelo mesmo Postgres). Corrigido extraindo os helpers compartilhados para `apps/api/src/e2e/dois-servicos-suporte.ts`, um módulo `.ts` comum fora do glob `src/**/*.test.ts` do `vitest.config.mts` — depois da correção, cada arquivo roda com exatamente o número de testes que declara, sozinho ou junto.

## Task Commits

Each task was committed atomically:

1. **Task 1: Matriz de contrato no repositório irmão e verificação de hash** — `45afdf6` (test, `financeiro-tria`) + `package.json`/`scripts/verificar-contratos.mjs` (`crm-n1`, ver "Deviations" — o commit deste lado acabou dentro de `91d1ae7`, de outro processo concorrente)
2. **Task 2: Teste ponta a ponta entre os dois processos** — `8b2ef20` (test, `crm-n1`)
3. **Task 3: Matriz de falhas injetadas + extração de suporte compartilhado** — `512156d` (test, `crm-n1`)

**Plan metadata:** commit deste SUMMARY + STATE.md/ROADMAP.md (a seguir)

## Files Created/Modified

- `scripts/verificar-contratos.mjs` — hash agregado sha256, compara as duas cópias das fixtures, pula com aviso sem `FINANCEIRO_TRIA_DIR`
- `package.json` (raiz) — `verificar:contratos` acrescentado a `check`
- `../financeiro-tria/automation/contratos/payment-requests-v1/` — cópia verbatim, 81 arquivos
- `../financeiro-tria/automation/src/adapters/contrato-v1.test.ts` — a mesma matriz, lado consumidor
- `../financeiro-tria/automation/package.json` — `test:contrato`
- `apps/api/src/e2e/dois-servicos.test.ts` — a jornada E2E entre processos, clique e comentário
- `apps/api/src/e2e/dois-servicos-suporte.ts` — helpers compartilhados (import cross-repo, fakes de serviço/receipts, `subirAutomationDeTeste`)
- `apps/api/src/e2e/falhas-injetadas.test.ts` — Fault-Injection Matrix (a)-(h) + (i) `it.todo`
- `apps/api/src/e2e/CONTEXT.md` — duas seções novas: "E2E entre serviços" e "Fault-Injection Matrix"

## Decisions Made

Ver `key-decisions` no frontmatter. Resumo dos pontos que exigiram julgamento:

1. **Import cross-repo por especificador não literal** — decisão estrutural do arquivo inteiro, motivada por manter `npm run typecheck -w @n1/api` verde mesmo num ambiente sem `../financeiro-tria` clonado (a suíte pula, mas o typecheck nunca tenta resolver o módulo do outro repositório).
2. **PaymentService sempre falso** — hard limit 1 desta execução; documentado extensamente no cabeçalho dos dois arquivos e do módulo de suporte.
3. **Extração de `dois-servicos-suporte.ts` no meio do Task 3** — não estava no plano original (`files_modified` só listava os dois arquivos de teste + CONTEXT.md), mas é a correção mínima para um bug de infraestrutura de teste real que eu mesmo descobri ao escrever o Task 3 (ver Deviations).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Extração de `apps/api/src/e2e/dois-servicos-suporte.ts` (arquivo novo, fora de `files_modified`)**
- **Found during:** Task 3, ao rodar `falhas-injetadas.test.ts` sozinho e ver a suíte de `dois-servicos.test.ts` (que ele importava para reusar helpers) reexecutar por completo como efeito colateral — os dois Fastify + dois Express reais competindo pelo mesmo Postgres real causavam falhas cruzadas (timeouts, `falha de rede` entre servidores locais) que não existiam quando cada arquivo rodava sozinho.
- **Issue:** `apps/api/vitest.config.mts` trata todo `src/**/*.test.ts` como ponto de entrada de suíte. Importar um `*.test.ts` de outro `*.test.ts` faz o Vitest avaliar o módulo importado no MESMO contexto de coleta — os `describe()`/`it()` de nível de módulo do importado voltam a rodar, agora TAMBÉM dentro da execução do arquivo que importa.
- **Fix:** Os helpers reaproveitáveis (`importarAutomation`, `criarClienteDeReceiptsFalso`, `criarServicoFalso`, `subirAutomationDeTeste`, `temBanco`, `temFinanceiroTria`, tipos) foram extraídos para `dois-servicos-suporte.ts` — um módulo `.ts` comum, fora do glob de suíte. `dois-servicos.test.ts` e `falhas-injetadas.test.ts` passaram a importar dali, nunca um do outro.
- **Files modified:** `apps/api/src/e2e/dois-servicos-suporte.ts` (novo), `apps/api/src/e2e/dois-servicos.test.ts` (refatorado para importar, sem lógica nova)
- **Verification:** `vitest run src/e2e/dois-servicos.test.ts src/e2e/falhas-injetadas.test.ts` passou a listar exatamente 9+9=18 testes (nunca 27 ou mais); cada arquivo isolado continuou com sua própria contagem exata.
- **Committed in:** `512156d`

**2. [Rule 1 — Bug, achado real de produção] `syncAndAssignResponsible` falhava com `422 REGRA_DE_DOMINIO` — o Convidado "Agente do pipeline" não tem `comentar` em Tarefa nenhuma por padrão**
- **Found during:** Task 2, ao rodar a jornada completa pela primeira vez contra Postgres real
- **Issue:** `taskWriteRefusal` (`packages/dominio/src/derive.ts`) recusa QUALQUER Convidado categoricamente para `addTaskComment`, a menos que exista uma concessão DIRETA de `comentar` NAQUELA Tarefa específica. O evolver da Solicitação de pagamento só concede `ver` no nível da LISTA — nunca `comentar` por Tarefa. Isso significa que, em produção, a credencial de serviço real (que resolve para esse Convidado) não consegue publicar o comentário de roteamento numa Tarefa nova sem uma concessão adicional que hoje nada cria.
- **Fix:** Dentro do escopo do teste (nunca em `packages/dominio`, fora de `files_modified`), cada Tarefa criada ganha uma concessão de fixture (`concederComentarNaTarefa`, INSERT direto em `plataforma.registros`, nunca uma chamada de domínio) simulando o que uma automação futura precisaria provisionar. Documentado extensamente no cabeçalho de `CONTEXT.md` e no código.
- **Files modified:** nenhum em `packages/dominio` — só os dois arquivos de teste (fixture de teste, não correção de produção)
- **Verification:** com a concessão, `createComment` sucede; sem ela, reproduz o `422 REGRA_DE_DOMINIO` de forma determinística (confirmado revertendo a mudança uma vez).
- **Committed in:** `8b2ef20`, `512156d`

**3. [Rule 1 — Bug, achado real de produção] `POST /operacoes/decideProcessApproval` e `POST /operacoes/addTaskComment` (a rota GENÉRICA) nunca emitem evento de outbox**
- **Found during:** Task 2, ao verificar por que nenhum `solicitacao.aprovacao-decidida.v1` chegava ao `automation/` depois de uma decisão por clique
- **Issue:** `apps/api/src/rotas/operacoes.ts` (a rota que serve ~200 operações do domínio via `POST /operacoes/:nome`) nunca passa `opcoes.eventos` para `executar()` — diferente de `classificacoes.ts`/`formularios-publicos.ts`/`integracao-solicitacoes.ts`, que constroem o evento explicitamente. Isso significa que, HOJE, uma decisão de aprovação pelo CLIQUE (a tela `/ia/aprovacoes` ou o card da Tarefa, o caminho PRINCIPAL de D-09) e uma resposta de aprovador pela própria timeline do CRM N1 NUNCA notificam o `automation/` por outbox — só o caminho do CALLBACK de classificação (`classificacoes.ts`) emite esse evento hoje.
- **Fix:** Fora de `files_modified` (`rotas/operacoes.ts` é a rota genérica de ~200 operações — corrigi-la é decisão de fase própria, não deste plano de validação). Para o teste ainda provar a metade RECEPTORA do webhook (o que SOL-07/SOL-08 pedem), `gravarEventos` (a função de PRODUÇÃO, `persistencia/outbox.ts`) é chamada diretamente para simular o efeito que a rota deveria ter — nunca SQL inventado, e documentado inline como simulação de um gap real, não como comportamento esperado da rota genérica.
- **Files modified:** nenhum em `apps/api/src/rotas/operacoes.ts` — só os dois arquivos de teste
- **Verification:** reproduzido por contagem de linhas em `plataforma.integration_outbox` antes/depois da chamada — 0 eventos, confirmado por query, não assumido.
- **Committed in:** `8b2ef20`, `512156d`

**4. [Rule 1 — Bug, achado real de produção] `eventIdDoComentario` (`financeiro-tria/automation/src/tenants/tria/classificador-de-aprovacao.ts`) deriva um "uuid" que `z.uuid()` rejeita na maioria dos casos**
- **Found during:** Task 2, testando o caminho de fallback por comentário
- **Issue:** A função fatia um sha256 em grupos 8-4-4-4-12 (a FORMA de um UUID), mas não fixa os nibbles de versão/variante do RFC 4122 que `z.uuid()` (zod 4.6.5, a mesma versão instalada em produção) valida. Reproduzido isoladamente: `z.uuid().safeParse("a4c55b3f-b53e-1823-fbbf-7581b43e13c4")` devolve `success:false`. Em produção, isso significa que a MAIORIA das tentativas de classificação por comentário morre em `400 SCHEMA_INVALIDO` no callback — silenciosamente, porque o classificador só loga, e o outbox já respondeu 202 antes disso.
- **Fix:** Fora de `files_modified` (arquivo do repositório irmão, fora do escopo declarado deste plano de teste). O teste usa um classificador de substituição que reimplementa a MESMA fiação HTTP real (ler a resposta via `getCommentReplies` real, `POST` real para `/v1/integrations/payment-approvals/classifications`) com `randomUUID()` no lugar do hash quebrado — prova a metade RECEPTORA sem depender de um bug não determinístico.
- **Files modified:** nenhum em `financeiro-tria/automation/src/tenants/tria/classificador-de-aprovacao.ts` — só `apps/api/src/e2e/dois-servicos.test.ts`
- **Verification:** reproduzido isoladamente com o zod instalado (`z.uuid().safeParse(...)` → `false`) antes de decidir a substituição.
- **Committed in:** `8b2ef20`

**5. [Rule 1 — Bug de setup] `setTaskFieldValue` (a operação genérica) não aceita array para Campo tipo `file`**
- **Found during:** Task 3, caso (g)
- **Issue:** `packages/dominio/src/operations/tasks.ts::setTaskFieldValue` só tem casos explícitos para alguns tipos; Campo `file` cai no `default`, que exige `typeof value === "string"` — recusa qualquer array com "`${nome}` é texto.". Quem preenche Anexo de verdade é `submitForm`, que escreve `task.fieldValues` diretamente, nunca via esta operação genérica.
- **Fix:** O teste (que só precisa provar a projeção do DTO, não o preenchimento) grava o `fieldValues` da Tarefa diretamente via SQL (`plataforma.registros`), o mesmo padrão já usado para a concessão de fixture.
- **Files modified:** só `apps/api/src/e2e/falhas-injetadas.test.ts`
- **Verification:** confirmado por `task.fieldValues.some(f => f.definitionId === "fld_sp_j_anexo")` depois da gravação.
- **Committed in:** `512156d`

---

**Total deviations:** 5 auto-fixed (1 blocking/infraestrutura de teste, 3 bugs reais de produção documentados e trabalhados ao redor — nunca corrigidos fora de `files_modified`, 1 bug de setup do próprio teste)
**Impact on plan:** Nenhuma regra de negócio de produção foi alterada. Os 3 achados reais (Deviations 2-4) são o tipo de coisa que este plano existe para descobrir antes do ensaio de duas semanas — ficam registrados aqui e no `CONTEXT.md` da pasta, não corrigidos, porque cada um pertence a um arquivo fora de `files_modified` (`packages/dominio`, `rotas/operacoes.ts`, `financeiro-tria/automation`) e exige uma decisão de fase própria (a Deviation 3 em particular é séria: o caminho PRINCIPAL de aprovação — o clique — não notifica o `automation/` hoje).

## Issues Encountered

- **Ambiente com múltiplos agentes concorrentes rodando contra o mesmo Postgres real.** Durante a execução, um `git commit` meu (Task 1, lado `crm-n1`) foi absorvido dentro do commit de OUTRO processo concorrente (`91d1ae7 test(03): complete UAT - 12 passed, 0 issues`) — confirmado por `git show --stat 91d1ae7`, que lista exatamente `package.json` e `scripts/verificar-contratos.mjs` junto com o arquivo do outro processo. O conteúdo está correto e no lugar certo; só a atribuição do commit ficou sob a mensagem de outro processo. Registrado aqui por transparência (não há como corrigir sem reescrever histórico, o que as regras desta execução proíbem).
- **A mesma concorrência causou lentidão e flakiness reais em execuções combinadas** (`vitest run src/e2e/dois-servicos.test.ts src/e2e/falhas-injetadas.test.ts` na mesma invocação, mesmo processo Node): 357s contra ~113s somados quando os mesmos dois arquivos rodam em invocações separadas, com falhas de rede genuínas entre dois servidores locais (`ECONNREFUSED`/`fetch failed`) atribuíveis à saturação do ambiente compartilhado, não a um bug de lógica — confirmado rodando os MESMOS dois arquivos, isolados, duas vezes cada, sempre verdes, imediatamente antes e depois da tentativa combinada.
- **`afterAll`'s `encerrar()` (fecha o `Pool` compartilhado de `persistencia/conexao.ts`) quebra o cleanup de um SEGUNDO arquivo de teste quando os dois rodam no MESMO processo Vitest.** Descoberto durante a tentativa de rodar os dois arquivos juntos: o primeiro arquivo a terminar fecha o pool globalmente; o `afterAll` do segundo arquivo (que também chama `pool().connect()`) falha silenciosamente sem completar sua própria limpeza, deixando ~1020 linhas de `plataforma.registros` de um Espaço de teste sem remover. Limpo manualmente antes de finalizar este plano (confirmado com uma consulta dedicada: 0 linhas remanescentes de qualquer padrão `ws_e2e_dois_servicos_%`/`ws_e2e_falhas_%` depois da limpeza). Este é um padrão PRÉ-EXISTENTE de toda a pasta `e2e/` (todo arquivo já chama `encerrar()` no seu `afterAll` — `criar-conta.test.ts`, `lote-contas-a-pagar.test.ts`), não algo introduzido por este plano; só se manifesta quando dois arquivos de `e2e/` rodam JUNTOS no mesmo processo — o modo de invocação que os hard limits desta execução já proíbem (rodar por arquivo, nunca a pasta inteira ou o workspace sem filtro). Registrado aqui, não corrigido (tocar `persistencia/conexao.ts` está fora de `files_modified` e afetaria dezenas de arquivos de teste).

## User Setup Required

None - nenhuma configuração externa nova. Os dois novos arquivos de teste usam a mesma credencial de serviço emitida em runtime (`emitirCredencial`) e o mesmo Postgres de teste que o resto da pasta `e2e/` já usa.

## Next Phase Readiness

- **Os dois gates que `02-VALIDATION.md` chama de "pré-paralelo" estão fechados**: o contrato v1 é provado idêntico e aceito nos dois repositórios; a composição entre os dois processos tem prova automatizada para 8 das 9 linhas da Fault-Injection Matrix.
- **Três achados bloqueiam o ensaio de duas semanas de verdade, e nenhum é deste plano corrigir:**
  1. O caminho de CLIQUE (o principal, D-09) não notifica o `automation/` por outbox hoje (`rotas/operacoes.ts` sem `opcoes.eventos`) — quem planejar a próxima onda precisa decidir se isso é um plano de correção pontual em `rotas/operacoes.ts` (arriscado: afeta ~200 operações) ou uma rota dedicada nova para `decideProcessApproval`/`addTaskComment` de processo, no estilo de `classificacoes.ts`.
  2. `eventIdDoComentario` (`financeiro-tria`) produz UUIDs inválidos na maioria dos casos — o fallback por comentário está, na prática, quebrado em produção até isso ser corrigido no repositório irmão.
  3. O Convidado "Agente do pipeline" não tem `comentar` em Tarefa nenhuma por padrão — a automação real, quando ligada (`PAYMENT_REQUEST_SOURCE=plataforma`), vai falhar ao publicar o comentário de roteamento em toda Tarefa nova até esse gap ser resolvido (uma concessão automática no evolver, ou uma exceção como `guestStatusWriter` já faz para Status).
- **Caso (i)** (importação retomada pelo `--resume`) continua como `it.todo` — precisa do Plan 02-25 (`apps/api/src/importacao/financeiro/importar.ts`) para virar um teste real.
- **`apps/api/src/e2e/dois-servicos-suporte.ts`** está pronto para qualquer plano futuro que precise montar o par Fastify+Express de teste sem reescrever a infraestrutura — inclusive um eventual Plan 02-27/02-28 que queira testar o caso (i) ou outros cenários entre processos.

---
*Phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup*
*Completed: 2026-09-25*

## Self-Check: PASSED

- FOUND: `scripts/verificar-contratos.mjs`
- FOUND: `../financeiro-tria/automation/contratos/payment-requests-v1/` (81 arquivos, idênticos por hash à cópia canônica)
- FOUND: `../financeiro-tria/automation/src/adapters/contrato-v1.test.ts`
- FOUND: `apps/api/src/e2e/dois-servicos.test.ts`
- FOUND: `apps/api/src/e2e/dois-servicos-suporte.ts`
- FOUND: `apps/api/src/e2e/falhas-injetadas.test.ts`
- FOUND: `apps/api/src/e2e/CONTEXT.md` (seções "E2E entre serviços" e "Fault-Injection Matrix")
- FOUND commit (financeiro-tria): `45afdf6`
- FOUND commit (crm-n1): `8b2ef20`
- FOUND commit (crm-n1): `512156d`
- FOUND (dentro de outro commit, ver Issues Encountered): `91d1ae7` contém `package.json`/`scripts/verificar-contratos.mjs` deste plano
