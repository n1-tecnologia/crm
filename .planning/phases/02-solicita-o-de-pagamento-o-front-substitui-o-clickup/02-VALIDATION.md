---
phase: 2
slug: solicita-o-de-pagamento-o-front-substitui-o-clickup
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-18
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5 nos três workspaces; `app.inject` no Fastify; Playwright a acrescentar para as jornadas públicas/aprovação; runner existente do `financeiro-tria/automation` a confirmar no primeiro plano |
| **Config file** | `apps/api/vitest.config.mts`, `apps/web/vitest.config.mts`, `packages/dominio/vitest.config.mts`; Playwright e harness do `automation/` são Wave 0 |
| **Quick run command** | `npm run test -w <workspace> -- <arquivo>` + `npm run typecheck -w <workspace>`; no repositório irmão, o script de teste confirmado no Plan 02-01 |
| **Full suite command** | `npm run check` no `crm-n1` + build/test do `financeiro-tria/automation` + contract fixtures v1 nos dois repositórios |
| **Estimated runtime** | até 45 s para feedback local direcionado; integração entre serviços e smoke pré-cutover rodam em gate próprio |

---

## Sampling Rate

- **After every task commit:** testes direcionados do workspace tocado + typecheck correspondente.
- **After every plan wave:** `npm run check`; se a onda tocar o contrato, executar também as fixtures v1 nos dois repositórios.
- **After every migration or queue change:** integration test contra Postgres/Supabase de teste, nunca apenas mock.
- **Before `/gsd-verify-work`:** suites completas verdes, E2E entre os dois processos, fault injection principal, dry-run/reapply da importação e relatório de reconciliação.
- **During the two-week rehearsal:** reconciliação diária automática de outbox, comandos, runs e códigos Omie.
- **Max feedback latency:** 45 segundos para o ciclo local; os gates externos ficam explicitamente separados.

---

## Per-Requirement Verification Map

| Verification ID | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command / Evidence | File Exists | Status |
|-----------------|-------------|------------|-----------------|-----------|------------------------------|-------------|--------|
| V02-01A | SOL-01 | T-02-01 | Evolver cria Lista, 4 Status e 25 Campos sem apagar ou duplicar dado vivo | domínio + DB integration | teste do evolver; reaplicar produz zero criação e diff vazio | ❌ W0 | ⬜ pending |
| V02-01B | SOL-01 | T-02-02 | Limite suporta 1.110+ Tarefas sem bypass por SQL | domínio + performance smoke | criar/importar 1.110 fixtures e medir hidratação/listagem | ❌ W0 | ⬜ pending |
| V02-02A | SOL-02 | T-02-03, T-02-04 | Segredo inválido/inativo não vaza conteúdo; submissão cria Tarefa completa com Ator sistema | API integration (`app.inject`) | `formularios-publicos.test.ts` | ❌ W0 | ⬜ pending |
| V02-02B | SOL-02 | T-02-05 | Tarefa, Campos, anexo, atividade e outbox confirmam juntos ou nada confirma | DB integration + fault injection | falha antes do COMMIT deixa zero Tarefa/outbox; falha externa mantém outbox pending | ❌ W0 | ⬜ pending |
| V02-02C | SOL-02 | T-02-06 | Upload recusa MIME/tamanho/ticket alheio; download requer URL assinada curta | Storage integration | suite condicional no bucket de teste | ❌ W0 | ⬜ pending |
| V02-02D | SOL-02 | T-02-03 | Browser envia formulário, anexa documento e vê somente o ID legível | Playwright | `npx playwright test` contra build de produção local | ❌ W0 | ⬜ pending |
| V02-03A | SOL-03 | T-02-07 | Approval de Agente conserva deadline/cancelamento; approval de processo não exige Execução nem expira | domínio regression | testes de `operations/ai` cobrindo os dois discriminantes | ❌ W0 | ⬜ pending |
| V02-03B | SOL-03 | T-02-08 | Só aprovador/admin decide; replay igual é idempotente; decisão oposta conflita | domínio + API | matriz autorizado/não autorizado/replay/conflito | ❌ W0 | ⬜ pending |
| V02-03C | SOL-03 | T-02-09 | Comentário, atividade, Status e outbox da decisão são atômicos | DB integration + fault injection | teste transacional da decisão | ❌ W0 | ⬜ pending |
| V02-04A | SOL-04 | T-02-10 | Timeline intercala Comentário/Atividade por instante sem trocar autoria | web unit + Playwright | teste do seletor + card da Tarefa | ❌ W0 | ⬜ pending |
| V02-05A | SOL-05 | T-02-11, T-02-12 | Os sete métodos aceitam/emitem exatamente os DTOs v1 e exigem credencial de serviço | contract test em ambos | mesma matriz de fixtures canônicas nos dois repositórios | ❌ W0 | ⬜ pending |
| V02-05B | SOL-05 | T-02-13 | API indisponível preserva mutações em FIFO por Tarefa; Tarefas distintas avançam em paralelo | DB integration + fake HTTP | command queue com timeout/429/503/response-lost | ❌ W0 | ⬜ pending |
| V02-05C | SOL-05 | T-02-14 | Logs e falhas persistidas não contêm token, CPF/CNPJ completo nem conteúdo de anexo | unit + source assertion | fixtures hostis + busca de payload sensível | ❌ W0 | ⬜ pending |
| V02-06A | SOL-06 | T-02-15 | Mapper tipado normaliza centavos/datas/anexos e não referencia shape ClickUp ou credenciais | unit + static | `plataforma-payment-mapper.test.ts` + imports proibidos | ❌ W0 | ⬜ pending |
| V02-07A | SOL-07 | T-02-16 | Commit da Tarefa tem exatamente um evento; rollback tem zero | DB integration | `outbox.test.ts` com constraint única | ❌ W0 | ⬜ pending |
| V02-07B | SOL-07 | T-02-17 | Receiver persiste receipt antes de 202; replay do mesmo eventId não cria segundo run | integration entre serviços | receiver idempotency + resposta perdida | ❌ W0 | ⬜ pending |
| V02-08A | SOL-08 | T-02-18 | Comentário autorizado chama a mesma decisão; autor não autorizado é ignorado | contract + domínio | fluxo `comment.created → classifier → callback` | ❌ W0 | ⬜ pending |
| V02-08B | SOL-08 | T-02-19 | Janela de 90 dias e métrica por origem usam relógio injetado | unit + integration | casos antes/no limite/depois do limite | ❌ W0 | ⬜ pending |
| V02-09A | SOL-09 | T-02-20 | Dry-run não grava; apply/reapply mantém IDs e contagens | DB integration | importador + ledger + resume após lote interrompido | ❌ W0 | ⬜ pending |
| V02-09B | SOL-09 | T-02-21 | Nulo/ambíguo/duplicado vira reject; segredo nunca aparece em saída | fixture/property test | fixture sanitizada com dados hostis | ❌ W0 | ⬜ pending |
| V02-09C | SOL-09 | T-02-22 | Anexo inequívoco sobe uma vez; ausente gera warning sem abortar lote | Storage integration | fixture do manifesto/exportação | ❌ W0 | ⬜ pending |
| V02-CUT | Critério 4 | T-02-23 | Uma obrigação pertence a uma coorte; timeout ambíguo consulta antes de incluir | adapter Omie fake + smoke | paridade por `codigo_lancamento_integracao`, sem double-write | ❌ W0 | ⬜ pending |

*Os PLAN.md devem atribuir cada Verification ID a pelo menos uma task e substituir `❌ W0` pelo arquivo concreto que a cria. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky.*

---

## Contract Fixture Matrix

Cada um dos sete métodos terá, nos dois repositórios:

- sucesso mínimo e completo;
- campo obrigatório ausente e enum/versão desconhecida;
- 401, 403, 404, 409, 422, 429 e 503 quando aplicável;
- replay com mesma chave/payload;
- conflito com mesma chave e payload diferente;
- campo adicional somente quando a política forward-compatible estiver explícita.

---

## Fault-Injection Matrix

| Falha injetada | Invariante esperada |
|----------------|---------------------|
| crash entre INSERT da Tarefa e COMMIT | nem Tarefa nem outbox visíveis |
| crash após COMMIT e antes do HTTP | outbox `pending`, entrega posterior |
| receiver persiste e a resposta se perde | replay do `eventId` não cria segundo run |
| API aplica mutação e a resposta se perde | replay da `Idempotency-Key` devolve o mesmo resultado |
| duas workers tentam a mesma fila | lease/constraint permite um único efeito |
| comando 1 falha e comando 2 da mesma Tarefa está pronto | comando 2 não ultrapassa o primeiro |
| URL assinada expira | retry chama `getTask` e recebe URL nova |
| Omie inclui e a conexão cai | `ConsultarContaPagar` encontra o código; não reinclui |
| importação cai no lote 7 | `--resume` continua pelo ledger; reapply total não duplica |

---

## Wave 0 Requirements

- [ ] Infra mínima de Playwright e jornada `/f/[segredo]`.
- [ ] Fixtures v1 canônicas e harness de contract test nos dois repositórios.
- [ ] Projeto/banco/bucket de integração separados de produção.
- [ ] Factory do router/serviço Express do `financeiro-tria` para testes sem abrir porta.
- [ ] Fake HTTP server controlável para timeout, response-lost, 429 e 503.
- [ ] Relógio injetável para a janela de 90 dias e backoff.
- [ ] Fixture sanitizada de `solicitacoes_pagamentos` com nulos, duplicados e `Aprovado` ambíguo.
- [ ] Teste de capacidade com 1.110+ Tarefas.
- [ ] Adapter Omie fake cobrindo consulta após timeout ambíguo.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Upload/download real permanece privado | SOL-02 | Políticas e URLs reais do Storage precisam de ambiente de integração | Subir arquivo permitido; confirmar que URL direta falha e signed URL curta funciona; tentar ticket de outra submissão |
| Aprovador decide pelo navegador e a timeline explica o ocorrido | SOL-03, SOL-04 | Clareza e foco visual exigem verificação humana | Abrir fila e card; aprovar e rejeitar fixtures; confirmar autoria, comentário canônico, Status e atividade |
| Paridade do Omie durante duas semanas | Critério 4 | Depende de coortes e serviço externo reais | Rodar reconciliação diária; amostrar `ConsultarContaPagar`; confirmar ausência de código duplicado |
| Cutover e rollback operacional | Critério 4 | Exige nginx/env/webhooks/ClickUp reais | Executar runbook de flip, replay e retorno de novas entradas; validar que Tarefas já na plataforma não migram para trás |
| Migração para região brasileira e latência VPS ↔ DB | D-23 | Região exige novo projeto Supabase e medição real | Migrar antes de uploads/importação; executar smoke Auth/DB/Storage e registrar p50/p95/p99 |

---

## Validation Sign-Off

- [x] Todos os requisitos SOL-01..09 têm comportamento observável e verificação prevista.
- [x] Cada fronteira persistente tem teste de perda, duplicação ou reordenação.
- [x] Wave 0 cobre todos os harnesses hoje ausentes.
- [x] Não há comando em watch mode.
- [x] Feedback local máximo previsto abaixo de 45 s.
- [x] `nyquist_compliant: true` definido no frontmatter.
- [ ] PLAN.md atribui todos os Verification IDs a tasks concretas.
- [ ] Wave 0 executada e `wave_0_complete: true`.

**Approval:** pending plan-checker
