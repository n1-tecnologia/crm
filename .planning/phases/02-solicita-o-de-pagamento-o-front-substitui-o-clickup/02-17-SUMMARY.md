---
phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup
plan: 17
subsystem: automation
tags: [http-contract, idempotency, queue, fifo, backoff, supabase, zod, payment-requests]

# Dependency graph
requires:
  - phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup
    provides: "Plan 02-12 (porta PaymentRequestAdapter + seletor PAYMENT_REQUEST_SOURCE), Plan 02-13 (as 7 rotas /v1/integrations/payment-requests/* + idempotência HTTP do apps/api), Plan 02-07 (harness servidor-falso/relogio), Plan 02-10 (backoff/sanitizarErro de referência), Plan 02-18 (origem='plataforma' em upsertSolicitacaoPagamento)"
provides:
  - "../financeiro-tria/automation/src/adapters/plataforma.ts: criarPlataformaAdapter — PaymentRequestAdapter sobre HTTP v1"
  - "../financeiro-tria/automation/src/adapters/platform-adapter-queue.ts: criarFilaDeComandos — fila persistente FIFO por Tarefa com lease, backoff e replay manual"
  - "../financeiro-tria/supabase/migrations/20260922120000_create_platform_adapter_commands.sql: tabela platform_adapter_commands (NÃO APLICADA)"
  - "PAYMENT_REQUEST_SOURCE=plataforma deixa de lançar em routes.ts"
affects: ["02-21 (seleção do mapper / aprovação por clique)", "02-26 (cópia das fixtures para financeiro-tria/automation/contratos/)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Classificação de erro por error.retryable do próprio envelope do contrato v1 (com fallback por status HTTP), em vez de uma lista fixa de códigos permanente/transitório"
    - "Interface estrutural mínima (ClienteSupabaseDeComandos/ClienteDeTabela) em vez de importar o SupabaseClient inteiro — permite um cliente falso em memória no teste, com `as unknown as` na composição real (routes.ts)"
    - "Persist-before-send: toda escrita da fila é uma linha no banco ANTES da primeira tentativa HTTP; nunca perde o comando, mesmo com a API fora do ar"
    - "CAS (update ... where status='pending') para lease sob concorrência, mesmo princípio de apps/api/src/persistencia/outbox-worker.ts (Plan 02-10)"

key-files:
  created:
    - ../financeiro-tria/automation/src/adapters/plataforma.ts
    - ../financeiro-tria/automation/src/adapters/plataforma.test.ts
    - ../financeiro-tria/automation/src/adapters/platform-adapter-queue.ts
    - ../financeiro-tria/automation/src/adapters/platform-adapter-queue.test.ts
    - ../financeiro-tria/supabase/migrations/20260922120000_create_platform_adapter_commands.sql
  modified:
    - ../financeiro-tria/automation/src/http/routes.ts
    - ../financeiro-tria/automation/src/adapters/CONTEXT.md

key-decisions:
  - "Migração escrita e commitada, mas NÃO aplicada — instrução explícita do orquestrador (o Supabase do financeiro-tria tem dado de produção; aplicar é decisão do dono). Ver 'User Setup Required' para o comando exato e a ordem em relação à migração 20260922130000 (Plan 02-18, também pendente)."
  - "Acrescentei replayed_by/replayed_at/replay_reason à tabela nova (além das colunas sugeridas em 02-RESEARCH.md) para reenfileirar() ter onde gravar quem/quando/motivo (D-20) sem reaproveitar last_error_summary, que precisa continuar guardando o erro ORIGINAL."
  - "comandosEmIntervencao/reenfileirar existem como funções exportadas de nível de módulo (não só como métodos do objeto que criarFilaDeComandos devolve) — a letra do acceptance criteria do plano pede os três nomes exportados do arquivo; os métodos do objeto delegam para elas."
  - "response da fila guarda só o mínimo para retomar o passo (ex.: commentId) — nunca o DTO inteiro; addTaskTag/updateTaskDueDate/updateTaskStatus devolvem void no adapter, então o response gravado é só o eco do próprio pedido (taskId + o campo que mudou)."
  - "Erro não classificado (nem ErroPermanenteDaPlataforma nem ErroTransitorioDaPlataforma) é tratado como permanente na fila, por segurança — nunca retry infinito de algo que a fila não sabe interpretar."
  - "O modo 'fila' de criarPlataformaAdapter (usado quando deps.fila está presente) não é exercitado por nenhum teste obrigatório do plano — as tasks 2/3 testam o adapter cru e a fila separadamente. Implementado e documentado, mas sem um teste de integração ponta a ponta destes dois nesta plan."

patterns-established:
  - "Todo adapter novo da porta PaymentRequestAdapter classifica erro por retryable do envelope, nunca por uma tabela fixa de status — reduz deriva entre o contrato e o código quando §3 mudar"
  - "Toda tabela de fila nova segue o padrão de outbox-worker.ts: backoff com jitter ±20%, sanitizarErro com os mesmos padrões sensíveis, lease por CAS"

requirements-completed: [SOL-05]

# Metrics
duration: ~2h
completed: 2026-09-21
---

# Phase 02 Plan 17: Adapter da plataforma e fila persistente FIFO Summary

**`plataforma.ts` fala o contrato HTTP v1 com classificação de erro por `retryable` do envelope; `platform-adapter-queue.ts` persiste toda mutação em `platform_adapter_commands` ANTES da primeira tentativa, com FIFO por Tarefa via CAS e a mesma escada de backoff do outbox — migração escrita e commitada, mas deliberadamente NÃO aplicada.**

## Performance

- **Duration:** ~2h
- **Completed:** 2026-09-21
- **Tasks:** 3/3 executados (Task 1 com a etapa de apply pendente — ver "Checkpoint" abaixo)
- **Files modified:** 7 (5 novos, 2 modificados) — todos em `../financeiro-tria`; só este SUMMARY.md em `crm-n1`

## Accomplishments

- `criarPlataformaAdapter` implementa os sete métodos da porta `PaymentRequestAdapter` contra `apps/api`: `Idempotency-Key` sempre recebida de fora (nunca `randomUUID()`/`Date.now()` na montagem — só `X-Request-Id`, correlação, é gerado aqui), resposta validada por `zod().strict()` (contrato v1 §9), erro de configuração explícito sem `PLATAFORMA_SERVICE_TOKEN` (diferente do mock silencioso de `clickup.ts`).
- `criarFilaDeComandos` sobre `platform_adapter_commands`: `enfileirar()` persiste antes de qualquer tentativa HTTP (D-19); `reivindicarCabeca()` só libera a cabeça de uma Tarefa sem bloqueio à frente, via CAS (`update ... where status='pending'`) — duas instâncias disputando a mesma cabeça, uma só ganha; `executar()` classifica erro e aplica a escada de backoff com jitter de `outbox-worker.ts` (Plan 02-10); `aguardarResultado()` nunca finge sucesso; `comandosEmIntervencao()`/`reenfileirar()` são a superfície de replay manual (D-20).
- `routes.ts`: o ramo `PAYMENT_REQUEST_SOURCE=plataforma` deixou de lançar — monta `criarPlataformaAdapter({ baseUrl, token, fila })` (sem `legacyClickUp`; os seis pontos restantes de `legacyClickUpRaw()` são escopo do Plan 02-21, D-21).
- Migração `20260922120000_create_platform_adapter_commands.sql` escrita com `unique (task_id, sequence)`, `unique (idempotency_key)`, índice parcial na cabeça reivindicável e RLS habilitada sem policy de select (nunca legível por `anon`) — **commitada, não aplicada**.
- 15 casos automatizados da Fault-Injection Matrix do plano: (a)-(f) em `plataforma.test.ts` (forma da requisição, idempotencyKey obrigatória, classificação 401/422/429/503, rejeição de campo desconhecido, fallback sem credencial, não-cache de `downloadUrl`); (g)-(o) em `platform-adapter-queue.test.ts` (API fora do ar sem perda, FIFO, bloqueio por comando `failed`, paralelismo entre Tarefas, resposta perdida com replay de mesma chave, escada de backoff vs falha permanente, lease sob concorrência, timeout de `aguardarResultado`, sanitização de erro).

## Task Commits

Commits no repositório `../financeiro-tria` (sibling), não em `crm-n1`:

1. **Task 1: Migração da fila de comandos (escrita, NÃO aplicada)** - `79ce876` (feat)
2. **Task 2: `plataforma.ts` — os sete métodos sobre HTTP v1** - `bffdc09` (feat)
3. **Task 3: Fila persistente FIFO por Tarefa e o ramo `plataforma` do seletor** - `77faaf8` (feat)

**Plan metadata:** este SUMMARY.md commitado em `crm-n1` (docs)

## Files Created/Modified

Todos em `../financeiro-tria` (repositório sibling):

- `supabase/migrations/20260922120000_create_platform_adapter_commands.sql` - tabela `platform_adapter_commands`, escrita e commitada, **NÃO aplicada**
- `automation/src/adapters/plataforma.ts` - `criarPlataformaAdapter`, `ErroPermanenteDaPlataforma`, `ErroTransitorioDaPlataforma`
- `automation/src/adapters/plataforma.test.ts` - casos (a)-(f)
- `automation/src/adapters/platform-adapter-queue.ts` - `criarFilaDeComandos`, `backoff`, `sanitizarErro`, `comandosEmIntervencao`, `reenfileirar`
- `automation/src/adapters/platform-adapter-queue.test.ts` - casos (g)-(o)
- `automation/src/http/routes.ts` - ramo `plataforma` do seletor `PAYMENT_REQUEST_SOURCE` preenchido
- `automation/src/adapters/CONTEXT.md` - seções "`plataforma.ts`" e "`platform-adapter-queue.ts`" documentando contrato, diferenças de `clickup.ts` e a lacuna de domínio conhecida

Em `crm-n1`: só este `02-17-SUMMARY.md`.

## Decisions Made

- Migração escrita e commitada, mas **não aplicada** — instrução explícita e inegociável do escopo desta execução (o Supabase do `financeiro-tria` tem dado de produção). Ver "User Setup Required".
- `replayed_by`/`replayed_at`/`replay_reason` acrescentados à tabela (além das colunas sugeridas em `02-RESEARCH.md`) para `reenfileirar()` ter onde gravar quem/quando/motivo sem sobrescrever o erro original em `last_error_summary`.
- `comandosEmIntervencao`/`reenfileirar` exportados como funções de nível de módulo (não só como métodos do objeto de `criarFilaDeComandos`) para casar com a letra do acceptance criteria ("exporta `criarFilaDeComandos`, `comandosEmIntervencao` e `reenfileirar`"); os métodos do objeto delegam para elas.
- `response` gravado na fila é sempre o mínimo para retomar o passo (ids, nunca o DTO inteiro) — `createComment` guarda `{commentId, createdAt, parentCommentId, author}`; as três escritas que devolvem `void` no adapter guardam só o eco do próprio pedido.
- Erro não classificado (nem `ErroPermanenteDaPlataforma` nem `ErroTransitorioDaPlataforma`) é tratado como permanente pela fila — decisão de segurança para nunca retry infinito de algo que a fila não sabe interpretar.
- `ClienteSupabaseDeComandos`/`ClienteDeTabela`: interface estrutural mínima em vez do `SupabaseClient` inteiro de `@supabase/supabase-js`, para o teste poder passar um cliente falso em memória sem depender de rede nem de credenciais reais (mesmo espírito de `servidor-falso.ts`). A composição real em `routes.ts` usa `createClient(...)` com `as unknown as ClienteSupabaseDeComandos` — documentado no próprio arquivo por quê o cast é seguro (o client real tem a forma inteira, só mais genérica por linha).
- O modo "fila" de `criarPlataformaAdapter` (as quatro escritas quando `deps.fila` está presente: `enfileirar` → tenta a cabeça imediatamente se for dela → `aguardarResultado`) não é exercitado por nenhum teste obrigatório do plano — as Tasks 2/3 testam o adapter cru e a fila isoladamente, por design do próprio plano. Está implementado e documentado em `CONTEXT.md`, mas fica registrado aqui que não há teste de integração ponta a ponta dos dois juntos nesta plan; um candidato natural para o Plan 02-21 (quando o mapper novo for selecionado de verdade em produção) ou para uma validação de fase.

## Deviations from Plan

### Auto-fixed Issues

Nenhum desvio das Regras 1-3 (bug/funcionalidade crítica/bloqueio) foi necessário — o texto do plano já cobria os sete métodos, a fila e o schema da migração com detalhe suficiente para implementar sem preencher lacuna de comportamento.

**1. [Instrução do orquestrador, não Regra 1-4] Migração escrita mas não aplicada**

Este não é um desvio das regras 1-4 do executor — é uma restrição explícita e inegociável do escopo desta execução (ver `<sequential_execution>` do prompt): "DO NOT APPLY THE MIGRATION... Applying it is the owner's decision." Documentado aqui por transparência, não como um auto-fix.

- **Efeito:** Task 1 do `02-17-PLAN.md` originalmente pedia aplicar a migração e confirmar RLS/`anon` via `select`. Nenhuma das duas foi feita — a tabela não existe no Supabase real do `financeiro-tria` ainda.
- **Mitigação:** `npm run build`/`npm test` não dependem da tabela existir de verdade (a fila usa uma interface estrutural mínima, testada com um cliente falso em memória) — build e testes passam mesmo sem a tabela aplicada. Em produção, o ramo `plataforma` do seletor SÓ funciona depois do apply.

---

**Total deviations:** 0 das regras 1-4 (auto-fix). 1 decisão de escopo do orquestrador (migração não aplicada), documentada acima e em "User Setup Required".
**Impact on plan:** Nenhum. Código completo e testado; só a aplicação da migração em produção fica pendente, por decisão deliberada de quem chamou este executor.

## Issues Encountered

- Nenhum bloqueio técnico. O design de `criarEscritaComFila` (o modo "fila" do adapter) exigiu uma decisão de arquitetura não detalhada literalmente pelo plano (como o "attempt imediato" e o "aguardar resultado" se compõem sem criar um laço de reenfileiramento infinito) — resolvido enfileirando, tentando a cabeça imediatamente SÓ se o comando reivindicado for o mesmo que acabou de ser criado, e nunca chamando `executar()` de dentro de `aguardarResultado()` (que é puramente observacional). Documentado em comentário no próprio `plataforma.ts` e em "Decisions Made" acima.
- Confirmado empiricamente (não é novidade desta plan): o Membro que a credencial de serviço resolve é um Convidado, e `taskWriteRefusal` recusa todo Convidado categoricamente — as rotas de status/tag/due-date do Plan 02-13 devolvem 422/409 reais para este adapter em produção até essa lacuna do domínio ser corrigida (`deferred-items.md` da Fase 2, entrada bloqueante do Plan 02-13, referenciada no blocker do prompt desta execução). Este adapter/fila **não tenta contornar isso**: uma recusa de domínio chega como `retryable: false` no envelope, vira `ErroPermanenteDaPlataforma`, e a fila marca o comando `failed` — visível para intervenção via `comandosEmIntervencao()`, nunca retentado para sempre. Nenhum teste deste plano assume que essas três rotas terão sucesso contra a credencial de serviço real.
- `payment-rules.test.ts`, caso `resolve responsavel por centro de custo com fallback`, continua falhando na baseline por motivo de `.env` local (`CLICKUP_RESPONSAVEL_TRIA_NOME="Elifas"` em vez de algo que bata com `/FINQ/i`) — pré-existente, não tocado por este plano, já documentado em `deferred-items.md` da Fase 2 (entrada do Plan 02-07). `npm test` do `automation/`: 39/40 passam; o único fail é este, confirmado idêntico antes e depois das mudanças deste plano.

## User Setup Required

**A migração precisa ser aplicada manualmente pelo dono do projeto antes que `PAYMENT_REQUEST_SOURCE=plataforma` funcione em produção.**

1. Verificar que nenhuma migração pendente será aplicada junto (`supabase migration list` ou equivalente no projeto `financeiro-tria`).
2. Aplicar **NESTA ORDEM** (o timestamp desta é mais antigo que o do Plan 02-18, e nenhuma depende da outra estruturalmente, mas a ordem cronológica dos arquivos é a ordem correta de aplicação por convenção do repositório):
   1. `../financeiro-tria/supabase/migrations/20260922120000_create_platform_adapter_commands.sql` (este plano, Plan 02-17)
   2. `../financeiro-tria/supabase/migrations/20260922130000_solicitacoes_origem_unique.sql` (Plan 02-18 — **também ainda não aplicada**; antes de aplicá-la, rodar a query de checagem de duplicados que o próprio arquivo descreve no cabeçalho)
3. Comando (Supabase CLI, caminho que o repositório já usa): `cd "../financeiro-tria" && supabase db push` (ou o caminho equivalente de console que o time já usa para as migrações anteriores — ver `supabase/config.toml`).
4. Confirmar RLS: `select * from platform_adapter_commands limit 1;` funciona com a credencial de serviço (`SUPABASE_SERVICE_ROLE_KEY`) e falha com a chave `anon`.
5. Definir as variáveis de ambiente novas em `automation/.env` (não documentadas em `.env.example` por este plano — fora de `files_modified`): `PLATAFORMA_BASE_URL`, `PLATAFORMA_SERVICE_TOKEN`.
6. Só depois do apply + das variáveis definidas, `PAYMENT_REQUEST_SOURCE=plataforma` pode ser ligado em produção — antes disso, toda escrita falha em runtime com erro de tabela inexistente (mesmo "falso verde" que a migração 003 tinha do lado `apps/api`, citado no próprio `02-17-PLAN.md`).

## Next Phase Readiness

- `adapters/plataforma.ts` e `adapters/platform-adapter-queue.ts` estão prontos para o Plan 02-21 (seleção do mapper / aprovação por clique) ligar `PAYMENT_REQUEST_SOURCE=plataforma` de verdade, assim que a migração estiver aplicada e as variáveis de ambiente definidas.
- A lacuna de domínio (`taskWriteRefusal` recusando todo Convidado) continua bloqueando sucesso real das três rotas de status/tag/due-date contra a credencial de serviço em produção — não é deste plano corrigir (fora de `files_modified`), mas é o próximo bloqueio a resolver antes do `PAYMENT_REQUEST_SOURCE=plataforma` poder rodar em produção sem todo comando de status/tag/due-date acabar em intervenção manual.
- Plan 02-26 (cópia das fixtures de `contratos/payment-requests-v1/` para `../financeiro-tria/automation/contratos/payment-requests-v1/`) segue pendente — os testes deste plano leram as fixtures pelo caminho relativo entre os dois repositórios irmãos, não da cópia local (que hoje só tem `getTask.*`, do Plan 02-18).

---
*Phase: 02-solicita-o-de-pagamento-o-front-substitui-o-clickup*
*Completed: 2026-09-21*
