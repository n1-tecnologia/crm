---
phase: 05-contas-a-receber-e-os-outros-tenants
plan: 07
subsystem: api
tags: [outbox, automations, whatsapp, postgres, zod]

# Dependency graph
requires:
  - phase: 05-contas-a-receber-e-os-outros-tenants (Plan 06)
    provides: "PedidoDeNotificacaoPorCanal + pedidosDeNotificacaoPorCanal (packages/dominio/src/operations/automations.ts) — o pedido pobre e determinístico que este plano lê para gravar no outbox"
provides:
  - "EVENTOS['automacao.notificar-canal.v1'] — quarto tipo de evento do outbox, .strict(), payload pobre (ids, destinoTipo, campoDestinoId OU rotulos, mensagemId — nunca número/texto)"
  - "CAMINHO_POR_EVENTO['automacao.notificar-canal.v1'] = /webhooks/plataforma/notificar-canal — o caminho de entrega no outbox-worker"
  - "eventosDeNotificacaoPorCanal + execucoesNovas (apps/api/src/persistencia/eventos-de-canal.ts) — a ponte pura entre o pedido do domínio e o EventoDeSaida do outbox"
  - "A costura opcoes.eventos em POST /operacoes/:nome e em scheduler-worker.ts::processarUm — as duas portas que rodam Automação agora gravam o evento de Canal na mesma transação que gravou a Execução"
affects: ["rota do canal em automation/ (consome /webhooks/plataforma/notificar-canal, resolve o segredo pelo rótulo da Empresa)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "aggregateId = executionId (nunca taskId): o índice único parcial da migração 003 vira 'uma Execução gera no máximo um evento de Canal', mesmo que a mesma Tarefa dispare a Automação várias vezes"
    - "Captura por fechamento reatribuída a CADA tentativa de executar() (idsAntes + execucoesNovas dentro do callback, nunca fora) — a mesma técnica que scheduler-worker.ts já usava para ensaioContagem/foiForcadoAoEnsaio, agora também em rotas/operacoes.ts"
    - "O Ensaio não precisa de guarda contra o evento de Canal: unidade-de-trabalho.ts já retorna ANTES de gravarEventos quando o resultado é ok:false, e o ramo de Ensaio força ok:false de propósito (D3-03) — a ausência de evento é automática, provada por teste, não por código novo"
    - "Espalhamento condicional para chave opcional ausente (`...(x !== undefined ? { chave: x } : {})`) em vez de atribuir undefined explícito, porque .strict() rejeita a chave presente com valor undefined em alguns caminhos"

key-files:
  created:
    - apps/api/src/persistencia/eventos-de-canal.ts
    - apps/api/src/persistencia/eventos-de-canal.test.ts
  modified:
    - apps/api/src/persistencia/outbox.ts
    - apps/api/src/persistencia/outbox-worker.ts
    - apps/api/src/persistencia/outbox.test.ts
    - apps/api/src/rotas/operacoes.ts
    - apps/api/src/rotas/operacoes.test.ts
    - apps/api/src/automacoes/scheduler-worker.ts
    - apps/api/src/automacoes/scheduler-worker.test.ts

key-decisions:
  - "Task 2 precisou de um caminho de teste diferente do que o texto do plano sugeria: `createTask` via a rota genérica NUNCA consegue pré-preencher um Campo antes do gatilho `tarefaCriada` disparar (CreateTaskInput não aceita fieldValues), então uma Automação de Canal por evento SEMPRE recusaria nesse ponto. O teste usa `createTask` (nasce em 'em lançamento omie', sem gatilho) → `setTaskFieldValue` (preenche o WhatsApp, sem gatilho) → `changeTaskStatus` para 'para pagar' (dispara tarefaEntrouEmStatus) — a Automação do teste reage a ENTRAR em 'para pagar', não a `tarefaCriada`. O código de produção (a costura em operacoes.ts) é agnóstico ao gatilho e cobre os dois casos igualmente."
  - "As contagens de outbox nos testes de rota/agenda usam `payload->>'taskId' = $taskId` em vez de um count global por workspace: `operacoes.test.ts` reusa o workspace fixo `ws_rotas_teste` entre execuções (nunca limpa `integration_outbox`, só `registros`/`workspaces`), então um count global vazaria entre rodadas de teste. Contar por taskId isola cada asserção independente de execuções anteriores da suíte."
  - "O grep de dígito de telefone do critério de aceite da Task 1 (`55[0-9]{9,}`) é literal contra o arquivo inteiro, inclusive o `.test.ts` — os valores de Campo usados para EXERCITAR o modo 'campo' (que nos testes de domínio, 05-06, usam números reais) foram trocados por strings sem dígitos (`whatsapp-teste-...`) neste arquivo: o tipo do Campo é 'phone' mas aceita qualquer texto não vazio (caminho `default` de `setTaskFieldValue`), então isso não muda o que é exercitado."

requirements-completed: [AUTO-02]

# Metrics
duration: ~45min
completed: 2026-09-24
---

# Phase 05 Plan 07: O evento de Canal no outbox (AUTO-02) Summary

**Quarto tipo de evento no outbox (`automacao.notificar-canal.v1`, `.strict()`, payload pobre), com caminho de webhook próprio, e as duas portas que rodam Automação (`POST /operacoes/:nome` e `scheduler-worker.ts`) gravando-o na mesma transação que gravou a Execução — provado contra Postgres real, inclusive que o Ensaio não grava nada.**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-09-24
- **Tasks:** 3/3
- **Files modified:** 9 (2 criados, 7 modificados)

## Accomplishments

- `EVENTOS["automacao.notificar-canal.v1"]` — quarto tipo, `.strict()`, com `taskId`/`automationId`/`executionId`/`canal`/`destinoTipo`/`campoDestinoId?`/`rotulos?`/`mensagemId`; os três tipos existentes (`solicitacao.*`) seguem byte a byte iguais.
- `CAMINHO_POR_EVENTO["automacao.notificar-canal.v1"] = "/webhooks/plataforma/notificar-canal"` — `Record<NomeDeEvento, string>` com quatro entradas, compila.
- `apps/api/src/persistencia/eventos-de-canal.ts` — `execucoesNovas` (isola o que nasceu na transação) e `eventosDeNotificacaoPorCanal` (traduz `pedidosDeNotificacaoPorCanal` do domínio no `EventoDeSaida`); `aggregateId = executionId`.
- `POST /operacoes/:nome` (`rotas/operacoes.ts`): o ramo `executar(...)` captura `idsAntes` dentro do callback, roda `REGISTRO[nome]`, deriva `execucoesDaOperacao` do resultado e passa `opcoes.eventos`. O ramo `SERVICOS` (`inviteMember`) não muda.
- `scheduler-worker.ts::processarUm`: a mesma costura, dentro do callback que já existia (`rodarAgenda` + o ramo de Ensaio). Nenhuma linha de `RodarAgenda` mudou.
- 5 arquivos de teste, todos verdes contra Postgres real onde aplicável: `eventos-de-canal.test.ts` (7 casos, sem banco), `outbox.test.ts` (+1 caso, com banco), `operacoes.test.ts` (+2 casos, com banco), `scheduler-worker.test.ts` (+3 casos, com banco, `runScheduledAutomations` de verdade).

## Task Commits

Each task was committed atomically:

1. **Task 1: O evento novo, o caminho do webhook e o mapeador puro** - `66bbf72` (feat)
2. **Task 2: A rota genérica de operações passa a derivar o evento** - `1e9b34d` (feat)
3. **Task 3: O scheduler-worker faz o mesmo na transação da agenda** - `4710e8f` (feat)

## Files Created/Modified

- `apps/api/src/persistencia/outbox.ts` — quarto tipo em `EVENTOS`, `.strict()`, comentário de doutrina sobre payload pobre.
- `apps/api/src/persistencia/outbox-worker.ts` — `CAMINHO_POR_EVENTO` ganha a entrada nova; `sanitizarErro`/`backoff`/lease servem ao tipo novo sem reescrita.
- `apps/api/src/persistencia/eventos-de-canal.ts` (novo) — `execucoesNovas`, `eventosDeNotificacaoPorCanal`.
- `apps/api/src/persistencia/eventos-de-canal.test.ts` (novo) — 7 testes unitários (dois modos de destino, recusa sem pedido, `execucoesNovas` isolado, schema fechado/pobre).
- `apps/api/src/persistencia/outbox.test.ts` — caso (g), no molde do (a), gravando o tipo novo.
- `apps/api/src/rotas/operacoes.ts` — a costura `opcoes.eventos` no ramo `executar(...)`.
- `apps/api/src/rotas/operacoes.test.ts` — casos (w)/(x): uma Automação de Canal por evento grava 1 linha por rodada (duas rodadas não colidem), e uma operação comum não grava nada.
- `apps/api/src/automacoes/scheduler-worker.ts` — a mesma costura dentro de `processarUm`; comentário citando D3-03 sobre por que o Ensaio não precisa de guarda extra.
- `apps/api/src/automacoes/scheduler-worker.test.ts` — casos (a)/(b)/(c): rodada normal grava 1 linha, a mesma rodada em Ensaio grava 0, a Ação recusada grava 0.

## Decisions Made

- **Trigger do teste de Task 2 é `tarefaEntrouEmStatus`, não `tarefaCriada`, apesar do texto do plano citar "createTask... com a Automação publicada".** `CreateTaskInput` (domínio) não aceita `fieldValues` — uma Automação de Canal com gatilho `tarefaCriada` SEMPRE recusaria no instante da criação via a rota HTTP, porque o Campo de destino (ou a Empresa) está necessariamente vazio nesse ponto. O teste usa a sequência `createTask` (nasce em "em lançamento omie", sem gatilho casando) → `setTaskFieldValue` (preenche o WhatsApp, operação sem Automação anexada) → `changeTaskStatus` para "para pagar" (dispara `tarefaEntrouEmStatus`, a Automação do teste reage a isso). A COSTURA testada (`opcoes.eventos` em `executar()`) é agnóstica ao tipo de gatilho — o mesmo código cobre `tarefaCriada` e `tarefaEntrouEmStatus` igualmente; só a fixture do teste precisou do caminho que realmente produz um destino resolvido.
- **Contagem de outbox por `payload->>'taskId'`, não por `aggregate_id` fixo nem por count global.** `operacoes.test.ts` reusa o workspace fixo `ws_rotas_teste` entre execuções da suíte (o `beforeAll` limpa `registros`/`workspaces`, nunca `integration_outbox`) — um count global por `event_type` vazaria linhas de execuções anteriores. Contar por `taskId` (uma Tarefa nova a cada teste) isola a asserção.
- **`eventos-de-canal.test.ts` usa valores de Campo sem dígito de telefone** (`whatsapp-teste-...` em vez de números reais como o teste de domínio 05-06 usa) para satisfazer o critério de aceite `grep -rn "55[0-9]\{9,\}" apps/api/src/persistencia/eventos-de-canal*.ts` (literal contra o arquivo inteiro, inclusive o `.test.ts`). O Campo "WhatsApp" é tipo `phone` mas aceita qualquer texto não vazio no caminho `default` de `setTaskFieldValue` — não muda o que a fixture exercita.

## Deviations from Plan

None — as três Tasks foram executadas como escritas; a única diferença é a fixture do teste de Task 2 (ver "Decisions Made" acima), que é uma escolha de COMO exercitar a costura, não uma mudança na costura em si ou no seu critério de aceite (a asserção final — "grava exatamente uma linha no outbox com `event_type = automacao.notificar-canal.v1`" — é idêntica ao que o plano pedia).

## Issues Encountered

- **`eventos-de-canal.ts` inicial não compilava**: `rotulos?: readonly string[]` (domínio) não é atribuível a `rotulos?: string[]` (o que `z.array(z.string())` infere). Corrigido com `[...pedido.rotulos]` no espalhamento condicional — `npm run typecheck -w @n1/api` confirmou verde.
- **`eventos-de-canal.test.ts` inicial contava 2 Execuções onde esperava 1**: `CP.listId` já tem A9 (`tarefaCriada` → Observadores) publicada no seed, então `runListAutomations({ kind: "tarefaCriada" })` sempre dispara A9 JUNTO com a Automação de Canal do teste. Corrigido filtrando `novas` por `automationId` nos testes que comparam contagem/id — `eventosDeNotificacaoPorCanal` em si já ignora corretamente a Execução de A9 (não é Ação de Canal), então nenhuma mudança de produção foi necessária.

## User Setup Required

None — nenhuma configuração de serviço externo. A entrega por HTTP ao `automation/` (a rota `/webhooks/plataforma/notificar-canal` em si) já existe como capacidade genérica do `outbox-worker.ts`; criar essa rota do lado do `automation/` está fora de `files_modified` deste plano.

## Verificação executada nesta sessão (regras operacionais do projeto)

- `npm run typecheck -w @n1/api` — verde (rodado após cada task).
- `npm run typecheck -w @n1/dominio` — verde.
- `npm run lint` — verde.
- `npm run test -w @n1/api -- src/persistencia/eventos-de-canal.test.ts --testTimeout=60000` — 7/7 verde (sem banco).
- `npm run test -w @n1/api -- src/persistencia/outbox.test.ts --testTimeout=60000` — 7/7 verde (com Postgres real).
- `npm run test -w @n1/api -- src/rotas/operacoes.test.ts --testTimeout=60000` — 24/24 verde (com Postgres real).
- `npm run test -w @n1/api -- src/automacoes/scheduler-worker.test.ts --testTimeout=60000` — 22/22 verde (com Postgres real; ~66s, consistente com a medição de ~54s já registrada para este arquivo).
- `grep -c "automacao.notificar-canal.v1" apps/api/src/persistencia/outbox.ts` ≥ 1; `Object.keys(EVENTOS).length === 4` provado por teste.
- `grep -rn "55[0-9]\{9,\}" apps/api/src/persistencia/eventos-de-canal*.ts` — nenhuma ocorrência.
- `grep -c "eventosDeNotificacaoPorCanal" apps/api/src/rotas/operacoes.ts` = 2; `apps/api/src/automacoes/scheduler-worker.ts` = 2.
- `grep -n "fetch(" apps/api/src/rotas/operacoes.ts` — nenhuma ocorrência.
- `git diff f990205 HEAD -- apps/api/src/persistencia/outbox.ts` — só adição; nenhuma linha dos três payloads `solicitacao.*` mudou.
- `git diff` de `apps/api/src/automacoes/scheduler-worker.ts` — as linhas do tipo `RodarAgenda` não mudaram.
- `git -C ../financeiro-tria status --short` — inalterado por esta sessão (o conjunto sujo é pré-existente, já documentado em STATE.md como regeneração shadcn/Lovable de sessões anteriores; nenhum arquivo deste plano está nesse repositório).
- **NÃO executado, por regra operacional do projeto:** `npm run check` completo (a suíte inteira de `apps/api` fala com Postgres real e estoura o watchdog de 600s do agente). Fica para o orquestrador/verificador da fase.
- Nenhuma escrita em `ws_n1`; nenhum `--apply`; nenhuma migração rodada (as três tabelas de transporte, `002`/`003`/`005`, já estavam aplicadas — este plano só grava um novo `event_type` na tabela `integration_outbox` já existente).

## Next Phase Readiness

- O outbox agora entrega `automacao.notificar-canal.v1` a `/webhooks/plataforma/notificar-canal` — falta só a rota correspondente do lado do `automation/` (fora deste repositório, fora de `files_modified` deste plano) resolver o segredo Evolution pelo rótulo da Empresa e chamar `EvolutionAdapter`.
- Nenhuma Automação real (A1–A9, R1–R7) foi publicada usando o Canal ainda — decisão de operação/produto, fora deste plano.
- Nenhum bloqueio para a próxima onda da fase.

## Self-Check: PASSED

Arquivos criados encontrados em disco: `apps/api/src/persistencia/eventos-de-canal.ts`, `apps/api/src/persistencia/eventos-de-canal.test.ts`. Os três commits de Task (`66bbf72`, `1e9b34d`, `4710e8f`) encontrados em `git log --oneline --all`.

---
*Phase: 05-contas-a-receber-e-os-outros-tenants*
*Completed: 2026-09-24*
