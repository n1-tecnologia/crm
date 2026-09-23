---
phase: 03-contas-a-pagar
plan: 07
subsystem: payments
tags: [omie, express, http, idempotency, financeiro-tria]

# Dependency graph
requires:
  - phase: 03-contas-a-pagar (Plan 03-04)
    provides: "DeParaDeLancamento/ResolucaoDeCategoria/OrigemDoDePara em packages/dominio/src/operations/financeiro.ts, e buildResumoDePagamento/runLancamentoAgent recebendo o de-para por parâmetro"
provides:
  - "resolverDeParaDeLancamento — resolve o de-para de UMA Conta a pagar contra o plano de contas real do Omie e o RAG de categorias, sem porta de escrita (D3-03)"
  - "lancarContaAPagar — consulta antes de incluir (T-3-11), código determinístico (tria:contas-a-pagar:<taskId>), zero escrita de status"
  - "POST /v1/integrations/contas-a-pagar/resolver e /lancar em ../financeiro-tria/automation, montadas antes do express.json() global"
  - "omieAdapter.consultarContaPagarPorCodigoDeIntegracao — método público novo em adapters/omie.ts"
  - "docs/08-migracao-financeiro/05-contrato-lancamento-contas-a-pagar-v1.md — o contrato que 03-11 consome"
affects: [03-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Superfície HTTP nova e irmã do contrato v1 de Solicitação de pagamento, não um 8º método (direção oposta, §9 congelado, escopo de credencial distinto)"
    - "Fronteira calcular/lançar estrutural por injeção de dependência: /resolver recebe só portas de leitura, /lancar recebe portas de leitura + escrita — impossível por construção, não por disciplina"
    - "Tipos do domínio espelhados literalmente no automation/ (sem pacote compartilhado), com o .strict() de apps/api como detector de deriva"

key-files:
  created:
    - ../financeiro-tria/automation/src/tenants/tria/contas-a-pagar-resolucao.ts
    - ../financeiro-tria/automation/src/tenants/tria/contas-a-pagar-resolucao.test.ts
    - ../financeiro-tria/automation/src/tenants/tria/contas-a-pagar-lancamento.ts
    - ../financeiro-tria/automation/src/tenants/tria/contas-a-pagar-lancamento.test.ts
    - ../financeiro-tria/automation/src/http/contas-a-pagar-routes.ts
    - ../financeiro-tria/automation/src/http/contas-a-pagar-routes.test.ts
    - docs/08-migracao-financeiro/05-contrato-lancamento-contas-a-pagar-v1.md
  modified:
    - ../financeiro-tria/automation/src/adapters/omie.ts
    - ../financeiro-tria/automation/src/server.ts

key-decisions:
  - "Superfície nova (não 8º método do contrato v1) — as quatro razões do <objective> do plano, reverificadas em código antes de escrever o documento: direção oposta dos 7 métodos existentes, §9 congela o v1 ao fim da Fase 2, §1 já declara fora de escopo a conversão/movimentação entre Listas, e D-15 pede credencial de escopo mínimo distinta de PLATAFORMA_WEBHOOK_TOKEN/PLATAFORMA_SERVICE_TOKEN"
  - "Checkpoint bloqueante da Task 4 (provisionamento de credencial + verificação em produção) NÃO foi auto-aprovado: envolve gerar e escrever um segredo em dois .env de produção (VPS) e confirmar credenciais Omie reais, nenhum dos quais este executor tem acesso — halt legítimo sob o modo autônomo (regra explícita: credenciais reais que o executor não tem são halt legítimo, não uma decisão de política)"

requirements-completed: []
# PAG-03/PAG-04: código completo e provado contra Omie falso (ver Task Commits);
# a prova contra o Omie REAL e o provisionamento de PLATAFORMA_LANCAMENTO_TOKEN
# (Task 4, steps 4-6) ainda não aconteceram. Não marcado completo em
# REQUIREMENTS.md até a Task 4 fechar — ver "Status" abaixo.

# Metrics
duration: ~95min (Tasks 1-3; Task 4 não cronometrada — parou no checkpoint)
completed: 2026-09-23
---

# Phase 3 Plan 07: Rota de cálculo e lançamento de Conta a pagar no Omie Summary

**`automation/` ganhou `/resolver` (só leitura, nunca escreve) e `/lancar` (consulta-antes-de-incluir, idempotente por `tria:contas-a-pagar:<taskId>`) — o código está completo e testado contra o Omie falso; falta só o provisionamento de credencial em produção (Task 4, checkpoint bloqueante, PARADO aqui).**

## Status: TASKS 1-3 COMPLETAS. TASK 4 (checkpoint bloqueante) PARADA — requer acesso a infraestrutura de produção que este executor não tem.

Este plano tem uma quarta task, `type="checkpoint:human-verify" gate="blocking"`, cujo conteúdo real é ação de infraestrutura (gerar um segredo e escrevê-lo em dois `.env` de produção — VPS do `automation/` e ambiente do `apps/api` —, confirmar se `OMIE_TRIA_APP_KEY`/`OMIE_TRIA_APP_SECRET` existem em produção, e fazer uma chamada real a `/resolver` com o serviço de pé). Nenhuma dessas três ações é alcançável por este executor: não há acesso à VPS de produção, não há como escrever num `.env` que não está neste checkout, e as credenciais Omie reais não foram fornecidas. Isto é um halt legítimo sob o modo autônomo desta execução (a regra é explícita: "credenciais reais que você não tem são um halt legítimo") — não uma escolha de política, e não algo que deveria ser simulado.

O que FOI verificado automaticamente da Task 4 (os três primeiros dos seis passos do `<how-to-verify>` do plano):

1. `git -C ../financeiro-tria status --porcelain -- automation | wc -l` → `8` (exatamente os 8 arquivos declarados em `files_modified`, nem um a mais) ✓
2. `git -C ../financeiro-tria diff -- automation/src/adapters/omie.ts automation/src/server.ts` → confirmado visualmente: um método público novo em `omie.ts` (26 linhas, só inserção) e duas linhas em `server.ts` (import + `app.use`, só inserção) ✓
3. `git -C ../financeiro-tria status --porcelain -- automation/src/tenants/tria/payment-automation-service.ts` → vazio, arquivo intocado (CON-05) ✓

O que NÃO foi feito (passos 4-6, fora do alcance deste executor):

4. Gerar `PLATAFORMA_LANCAMENTO_TOKEN` (`openssl rand -hex 32`) e escrevê-lo no `.env` de produção do `automation/` e no ambiente do `apps/api` — **não feito**. Precisa de acesso à VPS de produção que este executor não tem.
5. Conferir se `OMIE_TRIA_APP_KEY`/`OMIE_TRIA_APP_SECRET` existem no `.env` de PRODUÇÃO — **não confirmado**. Nota, para não confundir: o `.env` DESTE checkout local de `../financeiro-tria/automation/` (que não é necessariamente igual ao de produção) NÃO tem `OMIE_TRIA_APP_KEY`/`OMIE_TRIA_APP_SECRET` nem `PLATAFORMA_*` — mas isso é o dev/sandbox local, não uma confirmação sobre o servidor de produção. Quem retomar esta task precisa checar o `.env` real da VPS, não este.
6. Chamar `/v1/integrations/contas-a-pagar/resolver` com o serviço de pé e conferir `origem: "omie"` numa Tarefa real de "para pagar" — **não feito** (depende dos passos 4-5).

**Resume-signal do plano, sem alteração:** "Digite 'conferido' com o resultado do passo 5 (credenciais Omie presentes ou não), ou cole o que divergiu."

## Performance

- **Duração:** ~95 min (Tasks 1-3)
- **Tasks:** 3 de 4 completas (a 4ª é o checkpoint bloqueante acima)
- **Arquivos:** 8 em `../financeiro-tria` + 1 em `crm-n1` (o contrato escrito)

## Accomplishments

- `contas-a-pagar-resolucao.ts` produz o `DeParaDeLancamento` (espelho de Plan 03-04) a partir do plano de contas REAL do Omie e do RAG de categorias (`conciliador_contas_pagar_*`), sem NENHUMA porta de escrita injetada — D3-03 é uma propriedade estrutural, verificável por `grep`, não uma disciplina de código.
- `contas-a-pagar-lancamento.ts` lança de verdade: `ConsultarContaPagar` roda ANTES de `IncluirContaPagar` (T-3-11), com `codigo_lancamento_integracao = tria:contas-a-pagar:<taskId>` determinístico (nunca `Date.now()`/random). Prova contra o Omie falso inclusive o caso V02-CUT (Omie grava, conexão cai antes da resposta — a segunda chamada reaproveita, não reinclui).
- Nenhum dos três arquivos novos referencia `adapters/clickup`, `legacyClickUpRaw` ou `updateTaskStatus` — o caminho que hoje termina em `payment-automation-service.ts:1908` (escrita de status raw/ClickUp-only) não tem herdeiro aqui. Quem move a Conta a pagar para `lançado omie` continua sendo A8, ação local do domínio.
- `POST /resolver` e `POST /lancar` montadas em `contas-a-pagar-routes.ts`, superfície NOVA (não 8º método do contrato v1 de Solicitação) — autenticação em tempo constante ANTES de ler o corpo, `Idempotency-Key` obrigatória e auto-verificável contra o corpo só em `/lancar`, `.strict()` nos dois schemas. Montada em `server.ts` ANTES do `express.json()` global (2 linhas, só inserção) — a garantia "corpo nunca lido antes da auth" vale em produção, não só no teste isolado.
- `docs/08-migracao-financeiro/05-contrato-lancamento-contas-a-pagar-v1.md` escrito com as quatro razões da decisão de superfície nova (reverificadas em código, não só copiadas do plano), as duas rotas, os dois códigos de erro novos, a idempotência e o Ensaio de D3-03.

## Task Commits

Cada task foi commitada atomicamente — as três primeiras no repositório `../financeiro-tria` (próprio, fora do `crm-n1`):

1. **Task 1: A resolução — de-para real do Omie, sem porta de escrita** - `372a64f` (feat, em `../financeiro-tria`)
2. **Task 2: O lançamento — consulta antes de incluir, chave determinística, nenhum status** - `20f38a0` (feat, em `../financeiro-tria`)
3. **Task 3: A rota, o mount e o contrato escrito** - `a0ae13c` (feat, em `../financeiro-tria`) + `a06803d` (docs, em `crm-n1`, o contrato escrito)
4. **Task 4: [BLOCKING] Provisionar a credencial e conferir a fronteira** - PARADA. Nenhum arquivo alterado (a própria task não altera código); os passos 1-3 do `<how-to-verify>` foram confirmados por comando, os passos 4-6 seguem pendentes.

**Plan metadata:** ainda não commitado — este SUMMARY documenta um plano PARCIALMENTE executado; o commit de fechamento normal (`docs(03-07): complete...`) não é apropriado aqui porque a Task 4 não fechou. Este arquivo e a atualização de `STATE.md` serão commitados juntos, sinalizando claramente o estado "parado no checkpoint", não "completo".

## Files Created/Modified

- `../financeiro-tria/automation/src/tenants/tria/contas-a-pagar-resolucao.ts` - resolve o de-para (categoria + conta corrente + departamento) contra o Omie real, sem porta de escrita
- `../financeiro-tria/automation/src/tenants/tria/contas-a-pagar-resolucao.test.ts` - 8 casos (a)-(h)
- `../financeiro-tria/automation/src/tenants/tria/contas-a-pagar-lancamento.ts` - lança no Omie com consulta-antes-de-incluir
- `../financeiro-tria/automation/src/tenants/tria/contas-a-pagar-lancamento.test.ts` - 7 casos (a)-(g)
- `../financeiro-tria/automation/src/http/contas-a-pagar-routes.ts` - as duas rotas HTTP + wiring de produção
- `../financeiro-tria/automation/src/http/contas-a-pagar-routes.test.ts` - 9 casos de rota
- `../financeiro-tria/automation/src/adapters/omie.ts` - `consultarContaPagarPorCodigoDeIntegracao` (método público novo, só inserção)
- `../financeiro-tria/automation/src/server.ts` - mount do novo router antes do `express.json()` global (2 linhas)
- `docs/08-migracao-financeiro/05-contrato-lancamento-contas-a-pagar-v1.md` - o contrato escrito

## Decisions Made

- Superfície nova confirmada e documentada com as quatro razões do `<objective>` do plano — reverificadas contra o código real (direção dos 7 métodos existentes em `adapters/plataforma.ts`, §9 de `04-contrato-plataforma-v1.md`, §1 não-escopo, D-15) antes de escrever `05-contrato-lancamento-contas-a-pagar-v1.md`.
- Checkpoint bloqueante da Task 4 NÃO auto-aprovado: os passos 4-6 exigem acesso a infraestrutura de produção (VPS, `.env` real, credenciais Omie reais) que este executor não tem — halt legítimo, documentado acima com o que foi e não foi verificado.

## Deviations from Plan

None nos Tasks 1-3 — plano executado exatamente como escrito, incluindo as verificações automatizadas e os greps de aceitação de cada task.

## Verification (Tasks 1-3, tudo automatizado)

- `(cd ../financeiro-tria/automation && npx tsx --test src/tenants/tria/contas-a-pagar-resolucao.test.ts)` — 8/8 ✓
- `(cd ../financeiro-tria/automation && npx tsx --test src/tenants/tria/contas-a-pagar-lancamento.test.ts)` — 7/7 ✓
- `(cd ../financeiro-tria/automation && npx tsx --test src/http/contas-a-pagar-routes.test.ts)` — 9/9 ✓
- `(cd ../financeiro-tria/automation && npm test)` — 84 passed, 1 fail (pré-existente e ambiental, `payment-rules.test.ts`, não tocado) ✓
- `(cd ../financeiro-tria/automation && npm run build)` — `tsc --noEmit` limpo ✓
- Todos os greps de aceitação das três tasks (D3-03 sem porta de escrita, D3-01 partição chamada, chave determinística, `payment-automation-service.ts`/`payment-rules.test.ts`/`omie-falso.ts` intocados, exatamente 8 arquivos em `git status`) ✓
- `npm run check` no `crm-n1` — verde nos três workspaces (dominio 447, web 107, api 380 passed/12 skipped) ✓

## Known Stubs

Nenhum.

## Threat Flags

Nenhum além do que o `<threat_model>` do plano já registrava (T-3-03/T-3-11 a T-3-15, todos com disposição `mitigate` implementada nas Tasks 1-3).

## Self-Check: PASSED

- FOUND: ../financeiro-tria/automation/src/tenants/tria/contas-a-pagar-resolucao.ts
- FOUND: ../financeiro-tria/automation/src/tenants/tria/contas-a-pagar-lancamento.ts
- FOUND: ../financeiro-tria/automation/src/http/contas-a-pagar-routes.ts
- FOUND: docs/08-migracao-financeiro/05-contrato-lancamento-contas-a-pagar-v1.md
- FOUND commit 372a64f (../financeiro-tria)
- FOUND commit 20f38a0 (../financeiro-tria)
- FOUND commit a0ae13c (../financeiro-tria)
- FOUND commit a06803d (crm-n1)
