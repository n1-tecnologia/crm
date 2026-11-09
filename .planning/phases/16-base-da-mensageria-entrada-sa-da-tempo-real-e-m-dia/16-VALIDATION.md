---
phase: "16"
slug: base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-09"
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 5.0.1 (api, domínio, web) + Testing Library na web |
| **Config file** | `apps/api/vitest.config.mts` (um arquivo por vez, timeout 180 s); `apps/web` e `packages/dominio` com `vitest run` |
| **Quick run command** | `cd apps/api && DATABASE_URL=postgres://postgres:x@localhost:557NN/postgres DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:557NN/postgres npx vitest run src/mensageria` |
| **Full suite command** | `DATABASE_URL=… DATABASE_URL_MIGRACAO=… npm run check` (raiz, Postgres local de Docker; rodar `npm run migrar -w @n1/api` antes no contêiner novo) |
| **Estimated runtime** | ~30 s por arquivo (quick); 13–17 min (full, em Docker) |

---

## Sampling Rate

- **After every task commit:** o arquivo de teste do módulo tocado (`npx vitest run <arquivo>`), < 30 s com o Postgres local
- **After every plan wave:** `npx vitest run` de `src/mensageria src/servicos/crm src/rotas src/persistencia/outbox*` em `apps/api` + `npm run test -w @n1/dominio`
- **Before `/gsd-verify-work`:** `npm run check` completo em Docker; falhas só do conjunto de baseline (`outbox-worker` h–k, `colunas-geradas`) se repetem isoladas em banco novo antes de serem tratadas como regressão
- **Max feedback latency:** 30 segundos (por tarefa)

---

## Per-Task Verification Map

> O planejador preenche uma linha por tarefa. A tabela de Requisito → Teste abaixo, da pesquisa (`16-RESEARCH.md`, "Validation Architecture"), é o ponto de partida.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 16-01 | 1 | MSG-01 | T-16-01, T-16-03 | número desconhecido vira Contato/Conversa/Mensagem; repetida não grava; Espaço vem do Canal | unit (domínio) + serviço (banco) | `npx vitest run src/crm/recebimento.test.ts` (domínio) · `npx vitest run src/servicos/crm/recebimento.test.ts` (PG 55716) | ❌ W0 | ⬜ pending |
| 16-01-02 | 16-01 | 1 | MSG-01 | T-16-03 | reabre na janela, reativa Contato arquivado/lixeira, corrida do número novo sem duplicar | serviço (banco) | `npx vitest run src/servicos/crm/recebimento.test.ts` (PG 55716) | ❌ W0 | ⬜ pending |
| 16-01-03 | 16-01 | 1 | MSG-01 | T-16-02 | `registrarRecebida` fora da interface; `webhook-meta.ts` intocado | serviço + rota + e2e (banco) | `npx vitest run src/servicos/crm/mensagens.test.ts src/rotas/crm/mensagens.test.ts src/e2e/canais-fluxo.test.ts` (PG 55716) | ✅ (estender) | ⬜ pending |
| 16-02-01 | 16-02 | 2 | MSG-05 | T-16-04, T-16-06 | provedor de teste só para `conexao_simulada = true`; segredo do cofre comparado em tempo constante | serviço (banco) | `npx vitest run src/mensageria/registro.test.ts` (PG 55717) | ❌ W0 | ⬜ pending |
| 16-02-02 | 16-02 | 2 | MSG-05 | T-16-05 | contrato do provedor; nenhum resultado carrega segredo | contrato | `npx vitest run src/mensageria/provedor.test.ts` | ❌ W0 | ⬜ pending |
| 16-02-03 | 16-02 | 2 | MSG-05 | T-16-05 | `canal:segredo-de-teste` recusa Canal real e mostra o segredo uma vez | CLI (banco) | `npx vitest run src/bootstrap/canal-segredo-de-teste.test.ts` (PG 55717) | ❌ W0 | ⬜ pending |
| 16-03-01 | 16-03 | 3 | MSG-01 | T-16-07 | 013 aplicada; webhook verificado grava `pendente`; processador cria Contato/Conversa/Mensagem | e2e (banco) | `npm run migrar` + `npx vitest run src/e2e/mensageria-entrada.test.ts` (PG 55718) | ❌ W0 | ⬜ pending |
| 16-03-02 | 16-03 | 3 | MSG-01 | T-16-11 | trava vencida volta e processa uma vez; backoff; falhou com motivo; acordar | worker (banco) | `npx vitest run src/mensageria/processador-de-entrada.test.ts` (PG 55718) | ❌ W0 | ⬜ pending |
| 16-03-03 | 16-03 | 3 | MSG-01, MSG-05 | T-16-08, T-16-09, T-16-10, T-16-12 | mesma 401 para seis causas; 429 por IP; 413; `apikey` fora do corpo; 013 provada; rota pública no inventário | rota + migração (banco) | `npx vitest run src/rotas/webhooks-de-mensageria.test.ts src/persistencia/migracao-013.test.ts` (PG 55718) · `src/seguranca/inventario-de-rotas.test.ts` (sem banco) | ❌ W0 | ⬜ pending |
| 16-04-01 | 16-04 | 4 | MSG-02 | T-16-14, T-16-15 | Mensagem `pendente` + `mensagem.enviar.v1` só com ids no mesmo commit; rollback | unit + serviço (banco) | `npx vitest run src/crm/mensagens.test.ts` (domínio) · `npx vitest run src/servicos/crm/mensagens.test.ts` (PG 55719) | ✅ (estender) | ⬜ pending |
| 16-04-02 | 16-04 | 4 | MSG-02 | T-16-15 | primeira Mensagem da Conversa e da Tarefa enfileiram; Canal fora do ar não | serviço + e2e (banco) | `npx vitest run src/servicos/crm/conversas.test.ts src/servicos/crm/tarefas-conversacionais.test.ts src/e2e/canais-fluxo.test.ts` (PG 55719) | ✅ (estender) | ⬜ pending |
| 16-04-03 | 16-04 | 4 | MSG-02 | T-16-13 | worker antigo nunca pega `mensagem.%` | worker (banco) | `npx vitest run src/persistencia/outbox-worker.test.ts` (PG 55719; h–k baseline) | ✅ (estender) | ⬜ pending |
| 16-05-01 | 16-05 | 5 | MSG-02 | T-16-19 | entrega pelo provedor de teste grava `id_externo` e `enviada` | e2e (banco) | `npx vitest run src/e2e/mensageria.test.ts` (PG 55720) | ❌ W0 | ⬜ pending |
| 16-05-02 | 16-05 | 5 | MSG-02 | T-16-16, T-16-17, T-16-18 | transitório 2× e entrega; permanente/ambíguo → `falhou` sem reenvio; `apikey` saneada; trava vencida | worker (banco) | `npx vitest run src/mensageria/entregar-mensagem.test.ts src/e2e/mensageria.test.ts src/persistencia/outbox-worker.test.ts` (PG 55720) | ❌ W0 | ⬜ pending |
| 16-05-03 | 16-05 | 5 | MSG-02 | T-16-18 | worker de saída por `MENSAGERIA_WORKER_ATIVO`; `acordar()` | worker (banco) | `npx vitest run src/persistencia/outbox-worker.test.ts` (PG 55720) | ✅ (estender) | ⬜ pending |
| 16-06-01 | 16-06 | 6 | MSG-02 | T-16-20, T-16-21 | `reenviar` só de `falhou`, sem `23505`, com `exigir` | e2e + rota (banco) | `npx vitest run src/e2e/mensageria.test.ts` (PG 55721) | ✅ (estender) | ⬜ pending |
| 16-06-02 | 16-06 | 6 | MSG-02 | T-16-22 | status só avança (`lida` não volta a `entregue`) | unit + worker (banco) | `npx vitest run src/crm/mensagens.test.ts` (domínio) · `src/mensageria/processador-de-entrada.test.ts` (PG 55721) | ✅ (estender) | ⬜ pending |
| 16-06-03 | 16-06 | 6 | MSG-02 | T-16-23 | Canal que volta a `conectada` reenfileira; `conexao` em Canal simulado ignorado | serviço + worker (banco) | `npx vitest run src/servicos/crm/canais.test.ts src/mensageria/processador-de-entrada.test.ts` (PG 55721) | ✅ (estender) | ⬜ pending |
| 16-07-01 | 16-07 | 7 | MSG-03 | T-16-27 | `avisarCrm` confirmado chega à aba em `GET /eventos`; payload só ids; 401 sem token | e2e (banco) | `npx vitest run src/e2e/mensageria-tempo-real.test.ts` (PG 55722) | ❌ W0 | ⬜ pending |
| 16-07-02 | 16-07 | 7 | MSG-03 | T-16-24, T-16-25, T-16-26, T-16-28 | outro Espaço não recebe; removido 403/fecha; 5 por Membro; 503 sem ouvinte; desligamento não pendura | unit (hub/rota) | `npx vitest run src/mensageria/hub-de-eventos.test.ts src/rotas/eventos.test.ts` (sem banco) | ❌ W0 | ⬜ pending |
| 16-07-03 | 16-07 | 7 | MSG-03 | T-16-24 | todos os gestos avisam; webhook → duas abas < 1 s; outro Espaço nada | banco + e2e | `npx vitest run src/mensageria/avisar.test.ts src/e2e/mensageria-tempo-real.test.ts` (PG 55722) | ❌ W0 | ⬜ pending |
| 16-08-01 | 16-08 | 8 | MSG-03 | T-16-29 | evento revalida fio, lista e chave array do resumo; token só no cabeçalho | web | `cd apps/web && npx vitest run src/dados/tempo-real.test.ts src/dados/crm/cliente-crm.test.ts` | ❌ W0 | ⬜ pending |
| 16-08-02 | 16-08 | 8 | MSG-03 | T-16-30 | reconexão crescente; releitura de 5 s; rajada agrupada; sem toast/som/título (D-16-02) | web | `cd apps/web && npx vitest run src/dados/tempo-real.test.ts` | ❌ W0 | ⬜ pending |
| 16-09-01 | 16-09 | 8 | MSG-04 | T-16-33 | imagem: ticket → bucket → Mensagem com anexo → URL assinada | rota (banco + armazenamento falso) | `npx vitest run src/rotas/crm/mensagens.test.ts` (PG 55724) · domínio `src/crm/midia.test.ts` | ✅ (estender) | ⬜ pending |
| 16-09-02 | 16-09 | 8 | MSG-04 | T-16-31, T-16-32, T-16-36 | assinaturas OGG/MP3/MP4/AAC/ZIP/Office/texto; texto como `.ogg` recusado; teto 16/25 MiB; Formulário recusa áudio | unit + rota | `npx vitest run src/servicos/storage-uploads.test.ts src/rotas/formularios-publicos.test.ts` | ✅ (estender) | ⬜ pending |
| 16-09-03 | 16-09 | 8 | MSG-04 | T-16-33, T-16-34, T-16-35 | anexo de outra Conversa recusado; download de outro Espaço 404, removido 403; documento com `download` | rota (banco) | `npx vitest run src/rotas/crm/mensagens.test.ts src/seguranca/anexos.test.ts` (PG 55724) | ✅ (estender) | ⬜ pending |
| 16-10-01 | 16-10 | 9 | MSG-04 | T-16-38 | áudio recebido guardado toca depois de o provedor esquecê-lo | e2e (banco + falso) | `npx vitest run src/e2e/mensageria-midia.test.ts` (PG 55725) | ❌ W0 | ⬜ pending |
| 16-10-02 | 16-10 | 9 | MSG-04 | T-16-37, T-16-40 | acima do teto/assinatura falsa/download falho → `baixado: false`; nova tentativa completa; `mensageria.etapas` sem dado pessoal | unit + worker (banco) | `npx vitest run src/mensageria/midia.test.ts src/mensageria/processador-de-entrada.test.ts` (PG 55725) | ❌ W0 | ⬜ pending |
| 16-10-03 | 16-10 | 9 | MSG-04 | T-16-39 | imagem chega ao provedor com URL assinada; coleta só apaga órfão velho e não citado; uma instância | e2e + coleta (banco) | `npx vitest run src/e2e/mensageria-midia.test.ts src/mensageria/coleta-de-orfaos.test.ts` (PG 55725) | ❌ W0 | ⬜ pending |
| 16-11-01 | 16-11 | 9 | MSG-02 | — | estado da entrega em português; "Tentar de novo" chama `reenviar` | web | `cd apps/web && npx vitest run src/features/crm/estado-da-entrega.test.tsx src/dados/crm/mensagens.test.ts` | ❌ W0 | ⬜ pending |
| 16-11-02 | 16-11 | 9 | MSG-04 | T-16-41 | `<audio>/<video>/<img>`/link; nome hostil vira texto; indisponível avisado | web | `cd apps/web && npx vitest run src/features/crm/anexo-da-mensagem.test.tsx` | ❌ W0 | ⬜ pending |
| 16-11-03 | 16-11 | 9 | MSG-04 | T-16-42 | compositor anexa arquivo real só dos tipos do Canal; sem microfone (D-16-10) | web | `cd apps/web && npx vitest run src/features/crm/conversation-thread.test.tsx` | ✅ (estender) | ⬜ pending |
| 16-12-01 | 16-12 | 10 | MSG-06 | T-16-43 | `MESSAGES_UPSERT` de texto entra; resposta sai por `sendText`; instância diferente → 401 | e2e (banco + servidor falso) | `npx vitest run src/e2e/mensageria-evolution.test.ts` (PG 55727) | ❌ W0 | ⬜ pending |
| 16-12-02 | 16-12 | 10 | MSG-06 | T-16-44, T-16-46 | cada rota do cliente com tempo limite; 401/400/timeout/resposta perdida classificados; base64 cortado no teto | unit (servidor falso) | `npx vitest run src/mensageria/provedores/evolution/cliente.test.ts` | ❌ W0 | ⬜ pending |
| 16-12-03 | 16-12 | 10 | MSG-06 | T-16-45, T-16-47 | tradutor: tipos, `fromMe`, grupo, status, `@lid`; contrato do provedor contra a Evolution | unit + contrato | `npx vitest run src/mensageria/provedores/evolution/traduzir.test.ts src/mensageria/provedores/evolution/provedor.test.ts` | ❌ W0 | ⬜ pending |
| 16-13-01 | 16-13 | 11 | MSG-06 | T-16-49, T-16-51 | comando liga o Canal: número conferido, token (não a global) no cofre, webhook com cabeçalho, `conectada` real | unit + CLI (banco + servidor falso) | `npx vitest run src/crm/canais.test.ts` (domínio) · `npx vitest run src/bootstrap/canal-ligar-evolution.test.ts` (PG 55728) | ✅/❌ W0 | ⬜ pending |
| 16-13-02 | 16-13 | 11 | MSG-06 | T-16-48, T-16-50, T-16-52 | recusa `numeropvmarcos` sem I/O; `--seco` não escreve; nenhuma saída com segredo; falha no webhook não grava | CLI (banco + servidor falso) | `npx vitest run src/bootstrap/canal-ligar-evolution.test.ts` (PG 55728) | ❌ W0 | ⬜ pending |
| 16-14-01 | 16-14 | 12 | MSG-01..06 | T-16-53 | andamento e cronograma regenerados sem dado pessoal | script | `node docs/09-planejamento/gerar.mjs` | ✅ | ⬜ pending |
| 16-14-02 | 16-14 | 12 | MSG-01..06 | T-16-53 | `CONTEXT.md` da raiz e das camadas | grep | `grep -c "A partir da Fase 16" CONTEXT.md` | ✅ | ⬜ pending |
| 16-14-03 | 16-14 | 12 | MSG-01..06 | T-16-54 | variáveis documentadas; unidade com workers `false`; gate da fase | gate | `npm run check` (PG 55729) | ✅ | ⬜ pending |
| 16-15-01 | 16-15 | 13 | MSG-03 | T-16-55 | `tempo-real:provar` sem imprimir URL | CLI (banco) | `npx vitest run src/mensageria/provar-tempo-real.test.ts` + `npm run tempo-real:provar` (PG 55730) | ❌ W0 | ⬜ pending |
| 16-15-02 | 16-15 | 13 | MSG-03, MSG-06 | T-16-57 | SSE atravessa o nginx sem buffer; roteiro sem segredo | script (Docker) | `bash apps/api/deploy/provar-nginx.sh` | ✅ (estender) | ⬜ pending |
| 16-15-03 | 16-15 | 13 | MSG-03, MSG-06 | T-16-55, T-16-56 | pré-voo do dono (pooler, versão, número, SEG-11) | manual (checkpoint) | — (checkpoint:human-action) | manual | ⬜ pending |
| 16-16-01 | 16-16 | 14 | MSG-03, MSG-04, MSG-06 | T-16-58, T-16-59, T-16-61 | publicação e prova ao vivo pelo dono, com backup antes da 013 | manual (checkpoint) | — (checkpoint:human-action) | manual | ⬜ pending |
| 16-16-02 | 16-16 | 14 | MSG-04 | — | decisão do dono sobre o áudio acima de 2 s | manual (checkpoint) | — (checkpoint:decision) | manual | ⬜ pending |
| 16-16-03 | 16-16 | 14 | MSG-06 | T-16-60 | registro em `16-PROVAS.md` sem dado pessoal | grep | `grep -c "Prova ao vivo" 16-PROVAS.md` | ❌ (criado aqui) | ⬜ pending |

> Comandos de banco: o executor roda cada um dentro do molde do plano (Postgres 16 em Docker na porta indicada, `npm run --silent migrar` antes, contêiner removido no fim); "PG 557NN" é a porta do plano. Teste de banco que aparece como skipped conta como falha.

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/migracoes/013-mensageria.sql` + `apps/api/src/persistencia/migracao-013.test.ts` — modelo: `migracao-012.test.ts`
- [ ] `apps/api/src/mensageria/provedor.test.ts` e fixtures de `provedores/teste.ts` — conjunto de contrato reutilizável
- [ ] Fixtures da Evolution em `apps/api/src/mensageria/provedores/evolution/exemplos/` — sintéticas, derivadas de `prepareMessage@2.3.7`; trocadas por capturas reais (sem dado de cliente) na prova ao vivo
- [ ] `apps/web/src/dados/tempo-real.test.ts` — leitor SSE com `ReadableStream` falso
- [ ] Spike do pooler: `LISTEN/NOTIFY` pela `DATABASE_URL` real com o papel `n1_api` (manual, antes de depender do SSE em produção)
- [ ] Framework: nada a instalar (vitest já presente)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Texto e áudio mandados de um celular aparecem na Caixa de outra aba em < 2 s, o áudio toca, e a resposta escrita na Caixa chega ao celular | MSG-06 / MSG-03 / MSG-04 | Depende de WhatsApp real e da instância da Evolution do dono | Checkpoint humano no plano final (D-16-04/05): `canal:ligar-evolution`, número escolhido pelo dono (nunca `numeropvmarcos`), medir a latência por etapa |
| `LISTEN/NOTIFY` pelo pooler Supabase em modo sessão (5432) com `n1_api` | MSG-03 | Só o banco de produção tem o pooler real | Spike manual antes de ligar o SSE em produção |
| SSE atrás do nginx da VM (`X-Accel-Buffering: no`, batida de 25 s) | MSG-03 | O nginx da VM só o dono edita | `apps/api/deploy/provar-nginx.sh` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
