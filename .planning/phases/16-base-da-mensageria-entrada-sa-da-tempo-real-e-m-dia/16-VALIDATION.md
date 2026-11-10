---
phase: "16"
slug: base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia
status: validated
nyquist_compliant: false
wave_0_complete: true
created: "2026-11-09"
audited: "2026-11-10"
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

> **Auditoria de 2026-11-10 (`/gsd-validate-phase 16`): validada com lacunas (PARTIAL), `nyquist_compliant: false`.**
> Os seis requisitos (MSG-01 a MSG-06) têm teste automatizado (unit, integração ou e2e) com resultado registrado como
> verde. O `false` é de propósito: ficam sete lacunas abertas (G-01 a G-07, abaixo), todas de prova que só existe em
> produção, no navegador do dono ou fora do código (CI). Nenhuma delas é um requisito sem teste. Ver "Gap Analysis" e "Validation Audit" no fim do arquivo.

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

> Uma linha por tarefa, do planejamento. Em 2026-11-10 a auditoria conferiu cada linha contra os `coverage:` dos 16 `SUMMARY.md`
> (107 referências a teste, todas apontam para arquivo e caso que existem) e atualizou "File Exists" e "Status". "✅ green"
> quer dizer: o teste existe e o `SUMMARY.md` registra que passou. Os testes de banco passaram num Postgres 16 de Docker
> (a suíte inteira no gate do 16-14, 2026-11-09), **não** no CI do GitHub (ver G-06).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 16-01 | 1 | MSG-01 | T-16-01, T-16-03 | número desconhecido vira Contato/Conversa/Mensagem; repetida não grava; Espaço vem do Canal | unit (domínio) + serviço (banco) | `npx vitest run src/crm/recebimento.test.ts` (domínio) · `npx vitest run src/servicos/crm/recebimento.test.ts` (PG 55716) | ✅ | ✅ green |
| 16-01-02 | 16-01 | 1 | MSG-01 | T-16-03 | reabre na janela, reativa Contato arquivado/lixeira, corrida do número novo sem duplicar | serviço (banco) | `npx vitest run src/servicos/crm/recebimento.test.ts` (PG 55716) | ✅ | ✅ green |
| 16-01-03 | 16-01 | 1 | MSG-01 | T-16-02 | `registrarRecebida` fora da interface; `webhook-meta.ts` intocado | serviço + rota + e2e (banco) | `npx vitest run src/servicos/crm/mensagens.test.ts src/rotas/crm/mensagens.test.ts src/e2e/canais-fluxo.test.ts` (PG 55716) | ✅ | ✅ green |
| 16-02-01 | 16-02 | 2 | MSG-05 | T-16-04, T-16-06 | provedor de teste só para `conexao_simulada = true`; segredo do cofre comparado em tempo constante | serviço (banco) | `npx vitest run src/mensageria/registro.test.ts` (PG 55717) | ✅ | ✅ green |
| 16-02-02 | 16-02 | 2 | MSG-05 | T-16-05 | contrato do provedor; nenhum resultado carrega segredo | contrato | `npx vitest run src/mensageria/provedor.test.ts` | ✅ | ✅ green |
| 16-02-03 | 16-02 | 2 | MSG-05 | T-16-05 | `canal:segredo-de-teste` recusa Canal real e mostra o segredo uma vez | CLI (banco) | `npx vitest run src/bootstrap/canal-segredo-de-teste.test.ts` (PG 55717) | ✅ | ✅ green |
| 16-03-01 | 16-03 | 3 | MSG-01 | T-16-07 | 013 aplicada; webhook verificado grava `pendente`; processador cria Contato/Conversa/Mensagem | e2e (banco) | `npm run migrar` + `npx vitest run src/e2e/mensageria-entrada.test.ts` (PG 55718) | ✅ | ✅ green |
| 16-03-02 | 16-03 | 3 | MSG-01 | T-16-11 | trava vencida volta e processa uma vez; backoff; falhou com motivo; acordar | worker (banco) | `npx vitest run src/mensageria/processador-de-entrada.test.ts` (PG 55718) | ✅ | ✅ green |
| 16-03-03 | 16-03 | 3 | MSG-01, MSG-05 | T-16-08, T-16-09, T-16-10, T-16-12 | mesma 401 para seis causas; 429 por IP; 413; `apikey` fora do corpo; 013 provada; rota pública no inventário | rota + migração (banco) | `npx vitest run src/rotas/webhooks-de-mensageria.test.ts src/persistencia/migracao-013.test.ts` (PG 55718) · `src/seguranca/inventario-de-rotas.test.ts` (sem banco) | ✅ | ✅ green |
| 16-04-01 | 16-04 | 4 | MSG-02 | T-16-14, T-16-15 | Mensagem `pendente` + `mensagem.enviar.v1` só com ids no mesmo commit; rollback | unit + serviço (banco) | `npx vitest run src/crm/mensagens.test.ts` (domínio) · `npx vitest run src/servicos/crm/mensagens.test.ts` (PG 55719) | ✅ | ✅ green |
| 16-04-02 | 16-04 | 4 | MSG-02 | T-16-15 | primeira Mensagem da Conversa e da Tarefa enfileiram; Canal fora do ar não | serviço + e2e (banco) | `npx vitest run src/servicos/crm/conversas.test.ts src/servicos/crm/tarefas-conversacionais.test.ts src/e2e/canais-fluxo.test.ts` (PG 55719) | ✅ | ✅ green |
| 16-04-03 | 16-04 | 4 | MSG-02 | T-16-13 | worker antigo nunca pega `mensagem.%` | worker (banco) | `npx vitest run src/persistencia/outbox-worker.test.ts` (PG 55719; h–k baseline) | ✅ | ✅ green |
| 16-05-01 | 16-05 | 5 | MSG-02 | T-16-19 | entrega pelo provedor de teste grava `id_externo` e `enviada` | e2e (banco) | `npx vitest run src/e2e/mensageria.test.ts` (PG 55720) | ✅ | ✅ green |
| 16-05-02 | 16-05 | 5 | MSG-02 | T-16-16, T-16-17, T-16-18 | transitório 2× e entrega; permanente/ambíguo → `falhou` sem reenvio; `apikey` saneada; trava vencida | worker (banco) | `npx vitest run src/mensageria/entregar-mensagem.test.ts src/e2e/mensageria.test.ts src/persistencia/outbox-worker.test.ts` (PG 55720) | ✅ | ✅ green |
| 16-05-03 | 16-05 | 5 | MSG-02 | T-16-18 | worker de saída por `MENSAGERIA_WORKER_ATIVO`; `acordar()` | worker (banco) | `npx vitest run src/persistencia/outbox-worker.test.ts` (PG 55720) | ✅ | ✅ (G-05: `index.ts` sem teste) |
| 16-06-01 | 16-06 | 6 | MSG-02 | T-16-20, T-16-21 | `reenviar` só de `falhou`, sem `23505`, com `exigir` | e2e + rota (banco) | `npx vitest run src/e2e/mensageria.test.ts` (PG 55721) | ✅ | ✅ green |
| 16-06-02 | 16-06 | 6 | MSG-02 | T-16-22 | status só avança (`lida` não volta a `entregue`) | unit + worker (banco) | `npx vitest run src/crm/mensagens.test.ts` (domínio) · `src/mensageria/processador-de-entrada.test.ts` (PG 55721) | ✅ | ✅ green |
| 16-06-03 | 16-06 | 6 | MSG-02 | T-16-23 | Canal que volta a `conectada` reenfileira; `conexao` em Canal simulado ignorado | serviço + worker (banco) | `npx vitest run src/servicos/crm/canais.test.ts src/mensageria/processador-de-entrada.test.ts` (PG 55721) | ✅ | ✅ green |
| 16-07-01 | 16-07 | 7 | MSG-03 | T-16-27 | `avisarCrm` confirmado chega à aba em `GET /eventos`; payload só ids; 401 sem token | e2e (banco) | `npx vitest run src/e2e/mensageria-tempo-real.test.ts` (PG 55722) | ✅ | ✅ green |
| 16-07-02 | 16-07 | 7 | MSG-03 | T-16-24, T-16-25, T-16-26, T-16-28 | outro Espaço não recebe; removido 403/fecha; 5 por Membro; 503 sem ouvinte; desligamento não pendura | unit (hub/rota) | `npx vitest run src/mensageria/hub-de-eventos.test.ts src/rotas/eventos.test.ts` (sem banco) | ✅ | ✅ (G-05: encerramento em produção) |
| 16-07-03 | 16-07 | 7 | MSG-03 | T-16-24 | todos os gestos avisam; webhook → duas abas < 1 s; outro Espaço nada | banco + e2e | `npx vitest run src/mensageria/avisar.test.ts src/e2e/mensageria-tempo-real.test.ts` (PG 55722) | ✅ | ✅ green |
| 16-08-01 | 16-08 | 8 | MSG-03 | T-16-29 | evento revalida fio, lista e chave array do resumo; token só no cabeçalho | web | `cd apps/web && npx vitest run src/dados/tempo-real.test.ts src/dados/crm/cliente-crm.test.ts` | ✅ | ✅ green |
| 16-08-02 | 16-08 | 8 | MSG-03 | T-16-30 | reconexão crescente; releitura de 5 s; rajada agrupada; sem toast/som/título (D-16-02) | web | `cd apps/web && npx vitest run src/dados/tempo-real.test.ts` | ✅ | ✅ green |
| 16-09-01 | 16-09 | 8 | MSG-04 | T-16-33 | imagem: ticket → bucket → Mensagem com anexo → URL assinada | rota (banco + armazenamento falso) | `npx vitest run src/rotas/crm/mensagens.test.ts` (PG 55724) · domínio `src/crm/midia.test.ts` | ✅ | ✅ (G-04: Storage real) |
| 16-09-02 | 16-09 | 8 | MSG-04 | T-16-31, T-16-32, T-16-36 | assinaturas OGG/MP3/MP4/AAC/ZIP/Office/texto; texto como `.ogg` recusado; teto 16/25 MiB; Formulário recusa áudio | unit + rota | `npx vitest run src/servicos/storage-uploads.test.ts src/rotas/formularios-publicos.test.ts` | ✅ | ✅ green |
| 16-09-03 | 16-09 | 8 | MSG-04 | T-16-33, T-16-34, T-16-35 | anexo de outra Conversa recusado; download de outro Espaço 404, removido 403; documento com `download` | rota (banco) | `npx vitest run src/rotas/crm/mensagens.test.ts src/seguranca/anexos.test.ts` (PG 55724) | ✅ | ✅ green |
| 16-10-01 | 16-10 | 9 | MSG-04 | T-16-38 | áudio recebido guardado toca depois de o provedor esquecê-lo | e2e (banco + falso) | `npx vitest run src/e2e/mensageria-midia.test.ts` (PG 55725) | ✅ | ✅ green |
| 16-10-02 | 16-10 | 9 | MSG-04 | T-16-37, T-16-40 | acima do teto/assinatura falsa/download falho → `baixado: false`; nova tentativa completa; `mensageria.etapas` sem dado pessoal | unit + worker (banco) | `npx vitest run src/mensageria/midia.test.ts src/mensageria/processador-de-entrada.test.ts` (PG 55725) | ✅ | ✅ green |
| 16-10-03 | 16-10 | 9 | MSG-04 | T-16-39 | imagem chega ao provedor com URL assinada; coleta só apaga órfão velho e não citado; uma instância | e2e + coleta (banco) | `npx vitest run src/e2e/mensageria-midia.test.ts src/mensageria/coleta-de-orfaos.test.ts` (PG 55725) | ✅ | ✅ green |
| 16-11-01 | 16-11 | 9 | MSG-02 | — | estado da entrega em português; "Tentar de novo" chama `reenviar` | web | `cd apps/web && npx vitest run src/features/crm/estado-da-entrega.test.tsx src/dados/crm/mensagens.test.ts` | ✅ | ✅ green |
| 16-11-02 | 16-11 | 9 | MSG-04 | T-16-41 | `<audio>/<video>/<img>`/link; nome hostil vira texto; indisponível avisado | web | `cd apps/web && npx vitest run src/features/crm/anexo-da-mensagem.test.tsx` | ✅ | ✅ green |
| 16-11-03 | 16-11 | 9 | MSG-04 | T-16-42 | compositor anexa arquivo real só dos tipos do Canal; sem microfone (D-16-10) | web | `cd apps/web && npx vitest run src/features/crm/conversation-thread.test.tsx` | ✅ | ✅ green |
| 16-12-01 | 16-12 | 10 | MSG-06 | T-16-43 | `MESSAGES_UPSERT` de texto entra; resposta sai por `sendText`; instância diferente → 401 | e2e (banco + servidor falso) | `npx vitest run src/e2e/mensageria-evolution.test.ts` (PG 55727) | ✅ | ✅ green |
| 16-12-02 | 16-12 | 10 | MSG-06 | T-16-44, T-16-46 | cada rota do cliente com tempo limite; 401/400/timeout/resposta perdida classificados; base64 cortado no teto | unit (servidor falso) | `npx vitest run src/mensageria/provedores/evolution/cliente.test.ts` | ✅ | ✅ green |
| 16-12-03 | 16-12 | 10 | MSG-06 | T-16-45, T-16-47 | tradutor: tipos, `fromMe`, grupo, status, `@lid`; contrato do provedor contra a Evolution | unit + contrato | `npx vitest run src/mensageria/provedores/evolution/traduzir.test.ts src/mensageria/provedores/evolution/provedor.test.ts` | ✅ | ✅ green |
| 16-13-01 | 16-13 | 11 | MSG-06 | T-16-49, T-16-51 | comando liga o Canal: número conferido, token (não a global) no cofre, webhook com cabeçalho, `conectada` real | unit + CLI (banco + servidor falso) | `npx vitest run src/crm/canais.test.ts` (domínio) · `npx vitest run src/bootstrap/canal-ligar-evolution.test.ts` (PG 55728) | ✅ | ✅ green |
| 16-13-02 | 16-13 | 11 | MSG-06 | T-16-48, T-16-50, T-16-52 | recusa `numeropvmarcos` sem I/O; `--seco` não escreve; nenhuma saída com segredo; falha no webhook não grava | CLI (banco + servidor falso) | `npx vitest run src/bootstrap/canal-ligar-evolution.test.ts` (PG 55728) | ✅ | ✅ green |
| 16-14-01 | 16-14 | 12 | MSG-01..06 | T-16-53 | andamento e cronograma regenerados sem dado pessoal | script | `node docs/09-planejamento/gerar.mjs` | ✅ | ✅ green |
| 16-14-02 | 16-14 | 12 | MSG-01..06 | T-16-53 | `CONTEXT.md` da raiz e das camadas | grep | `grep -c "A partir da Fase 16" CONTEXT.md` | ✅ | ✅ green |
| 16-14-03 | 16-14 | 12 | MSG-01..06 | T-16-54 | variáveis documentadas; unidade com workers `false`; gate da fase | gate | `npm run check` (PG 55729) | ✅ | ✅ green |
| 16-15-01 | 16-15 | 13 | MSG-03 | T-16-55 | `tempo-real:provar` sem imprimir URL | CLI (banco) | `npx vitest run src/mensageria/provar-tempo-real.test.ts` + `npm run tempo-real:provar` (PG 55730) | ✅ | ✅ green |
| 16-15-02 | 16-15 | 13 | MSG-03, MSG-06 | T-16-57 | SSE atravessa o nginx sem buffer; roteiro sem segredo | script (Docker) | `bash apps/api/deploy/provar-nginx.sh` | ✅ | ⚠️ ensaio ✅, produção não conferida (G-01) |
| 16-15-03 | 16-15 | 13 | MSG-03, MSG-06 | T-16-55, T-16-56 | pré-voo do dono (pooler, versão, número, SEG-11) | manual (checkpoint) | — (checkpoint:human-action) | manual | ✅ manual cumprido (16-PROVAS.md, Pré-voo) |
| 16-16-01 | 16-16 | 14 | MSG-03, MSG-04, MSG-06 | T-16-58, T-16-59, T-16-61 | publicação e prova ao vivo pelo dono, com backup antes da 013 | manual (checkpoint) | — (checkpoint:human-action) | manual | ⚠️ manual parcial (G-01, G-02, G-03) |
| 16-16-02 | 16-16 | 14 | MSG-04 | — | decisão do dono sobre o áudio acima de 2 s | manual (checkpoint) | — (checkpoint:decision) | manual | ✅ manual cumprido (decisão do dono, 2026-11-10) |
| 16-16-03 | 16-16 | 14 | MSG-06 | T-16-60 | registro em `16-PROVAS.md` sem dado pessoal | grep | `grep -c "Prova ao vivo" 16-PROVAS.md` | ✅ | ✅ |

> Comandos de banco: o executor roda cada um dentro do molde do plano (Postgres 16 em Docker na porta indicada, `npm run --silent migrar` antes, contêiner removido no fim); "PG 557NN" é a porta do plano. Teste de banco que aparece como skipped conta como falha.

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ parcial ou flaky (a nota diz qual lacuna). "manual" em File Exists: checkpoint humano, sem teste por desenho.*

---

## Wave 0 Requirements

- [x] `apps/api/migracoes/013-mensageria.sql` + `apps/api/src/persistencia/migracao-013.test.ts` — modelo: `migracao-012.test.ts` (6 testes; a 013 aplicada em produção pelo `publicar.sh`, "Nada a aplicar" na segunda publicação)
- [x] `apps/api/src/mensageria/provedor.test.ts` e fixtures de `provedores/teste.ts` — conjunto de contrato reutilizável (`contrato-do-provedor.ts`, também rodado contra a Evolution)
- [x] Fixtures da Evolution em `apps/api/src/mensageria/provedores/evolution/exemplos/` — existem (7 arquivos), mas seguem sintéticas, derivadas de `prepareMessage@2.3.7`: **não** foram trocadas por capturas reais na prova ao vivo (G-07)
- [x] `apps/web/src/dados/tempo-real.test.ts` — leitor SSE com `ReadableStream` falso
- [x] Spike do pooler: `LISTEN/NOTIFY` pela `DATABASE_URL` real com o papel `n1_api` — **provado em 2026-11-10**: `tempo-real:provar` em produção, porta 5432, `recebido_em_ms` = 52, 53, 52 (`16-PROVAS.md`, Pré-voo)
- [x] Framework: nada a instalar (vitest já presente)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions | Resultado em 2026-11-10 |
|----------|-------------|------------|-------------------|-------------------------|
| Texto e áudio mandados de um celular aparecem na Caixa de outra aba em < 2 s, o áudio toca, e a resposta escrita na Caixa chega ao celular | MSG-06 / MSG-03 / MSG-04 | Depende de WhatsApp real e da instância da Evolution do dono | Checkpoint humano no plano final (D-16-04/05): `canal:ligar-evolution`, número escolhido pelo dono (nunca `numeropvmarcos`), medir a latência por etapa | **Parcial.** Texto, áudio e imagem entraram sozinhos e a resposta chegou ao celular (relato do dono, 5 webhooks `processado`). O áudio tocou (Chrome). **Não cronometrado na tela**; no servidor, 1,04 a 1,09 s (texto) e 2,28 s (áudio). Lacuna G-02 |
| `LISTEN/NOTIFY` pelo pooler Supabase em modo sessão (5432) com `n1_api` | MSG-03 | Só o banco de produção tem o pooler real | Spike manual antes de ligar o SSE em produção | **Provado** (52, 53, 52 ms) |
| SSE atrás do nginx da VM (`X-Accel-Buffering: no`, batida de 25 s) | MSG-03 | O nginx da VM só o dono edita | `apps/api/deploy/provar-nginx.sh` | **Só o ensaio em Docker** (quatro linhas `ok`; a prova 4 mostra o caminho, não que o cabeçalho é o que faz funcionar). Produção **não conferida** (exige o token do dono). Lacuna G-01 |
| O áudio de voz (`audio/ogg` Opus) toca no navegador do atendente, inclusive Safari (A5) | MSG-04 | jsdom não toca mídia | Abrir a Caixa no Safari e tocar um áudio recebido | **Chrome sim (relato); Safari não testado.** Lacuna G-03 |
| Storage real do Supabase: download de documento com `Content-Disposition: attachment` e `list` com `created_at` (coleta de órfãos) | MSG-04 | Os testes usam o armazenamento falso; o real só roda com `SUPABASE_*` | Baixar um documento recebido e conferir o cabeçalho; esperar a primeira coleta (24 h depois do boot) e ver a linha do log | **Não provado.** Imagem enviada pela Caixa (ticket, bucket, URL assinada) e áudio recebido tocando funcionaram (relato). Lacuna G-04 |

---

## Gap Analysis (auditoria de 2026-11-10)

### Cobertura por requisito

Base: o front matter `coverage:` dos 16 `SUMMARY.md` (85 entregáveis). "Automatizado" = ao menos um teste unit, integração ou e2e com `status: pass`.

| Requisito | Entregáveis com teste automatizado | Sem teste automatizado | Veredito |
|-----------|-----------------------------------|------------------------|----------|
| MSG-01 porta de entrada | 12 | 0 | COVERED |
| MSG-02 porta de saída | 17 | 0 (16-05 D7 é automatizado, com ligação do `index.ts` só por `grep`, G-05) | COVERED |
| MSG-03 tempo real | 9 | 2 (16-07 D6, 16-08 D5) | COVERED no que é automatizável; G-01, G-02, G-05 |
| MSG-04 mídia | 13 | 3 (16-09 D6, 16-10 D7, 16-11 D4) | COVERED no que é automatizável; G-02, G-03, G-04 |
| MSG-05 provedor de teste só para Canal simulado | 4 | 0 | COVERED |
| MSG-06 Evolution do dono | 11 | 2 (16-12 D6, 16-13 D7), **fechados pela prova ao vivo** | COVERED; G-07 residual |
| Planos 16-14, 16-15, 16-16 (sem requisito por entregável) | 0 | 12, verificados por script, `grep` ou registro de prova (`16-PROVAS.md`); 2 com resultado `unknown` (16-15 D4, 16-16 D2) | ver G-01 e G-02 |

Total: **66 de 85** entregáveis com teste automatizado verde; 12 verificados por script, `grep` ou registro de prova; 7 só por julgamento humano (4 deles provados ao vivo em parte).

Reexecutado nesta auditoria, sem banco e com `DATABASE_URL` removida do ambiente, arquivos puros da fase: `apps/api` (`hub-de-eventos`, `provedor`, `midia`, `evolution/traduzir`, `evolution/cliente`) 95 testes verdes; `packages/dominio` (`recebimento`, `mensagens`, `midia`, `canais`, `eventos`) 116 verdes; `apps/web` (`tempo-real`, `cliente-crm`, `dados/crm/mensagens`, `estado-da-entrega`, `anexo-da-mensagem`, `conversation-thread`) 110 verdes. `tsc --noEmit` em `apps/api` limpo.

### Lacuna preenchida

| Lacuna | Requisito | O que entrou |
|--------|-----------|--------------|
| A configuração de produção da mensageria (T-16-54, 16-14 D3) só era provada por `grep` | MSG-02 / MSG-03 | `apps/api/src/mensageria/configuracao-de-producao.test.ts` (5 testes, sem banco e sem rede): a unidade `deploy/n1-crm-api.service` fixa `MENSAGERIA_WORKER_ATIVO` e `COLETA_DE_ORFAOS_ATIVA` em `false` e não fixa `TEMPO_REAL_ATIVO`; `.env.example` traz os workers desligados, o tempo real ligado e `EVOLUTION_URL`/`API_URL_PUBLICA` vazias; toda variável da mensageria que o código lê está documentada. Comando: `cd apps/api && npx vitest run src/mensageria/configuracao-de-producao.test.ts` |

### Lacunas registradas (não corrigidas, com o motivo)

| Id | Requisito | Lacuna | Por que não foi fechada aqui | O que fecha |
|----|-----------|--------|------------------------------|-------------|
| G-01 | MSG-03 | O fluxo `GET /eventos` atrás do nginx de **produção** (`: aberto` na hora, batida de 25 s abaixo do `proxy_read_timeout` de 120 s) não foi conferido. Só há o ensaio `provar-nginx.sh` em Docker e o ouvinte conectado no journal do boot. A releitura de 5 s da tela esconde a diferença: "a Mensagem apareceu" não distingue SSE de releitura | Exige produção e o token de login do dono | DevTools, Rede, filtro `eventos`, aba EventStream (passo 15 de `16-PROVA-AO-VIVO.md`) |
| G-02 | MSG-03 / MSG-04 / MSG-06 | O "Pronto quando (b)" da fase, texto e áudio em outra aba em < 2 s pelo tempo real, **não foi cronometrado na tela**. Servidor: 1,04 a 1,09 s (texto), 2,28 s (áudio); ponta a ponta estimada em ~2 s e ~3 s. O dono decidiu aceitar o áudio até 3 s. A metade automatizável existe (e2e: o webhook chega como `mensagem.nova` às duas abas do mesmo Membro em menos de 1 s, com o provedor de teste) | Exige WhatsApp real, a Evolution do dono e cronômetro | Passos 17 e 18 de `16-PROVA-AO-VIVO.md`, com DevTools aberto na aba EventStream |
| G-03 | MSG-04 | Áudio Opus tocando no Safari (A5): só o Chrome foi usado | jsdom não toca mídia; precisa do navegador real | Tocar um áudio recebido no Safari; se não tocar, reabre `convertToMp4` (OPT-OUT em `COVERAGE.md`) |
| G-04 | MSG-04 | Storage real: `createSignedUrl(..., { download })` (documento sai como anexo) e `list` com `created_at` (a coleta de órfãos) seguem `[ASSUMED]`; a primeira coleta só roda 24 h depois do boot. Imagem e áudio funcionaram ponta a ponta, mas documento não foi exercido. Limites já conhecidos em `deferred-items.md`: a coleta enxerga só os 500 primeiros objetos de cada pasta de Canal | Os testes usam o armazenamento falso; o real exige `SUPABASE_*` de produção | Baixar um documento recebido e ler `Content-Disposition`; ler a linha da primeira coleta no log |
| G-05 | MSG-03 (T-16-28) | **O encerramento do serviço não tem teste que reproduza o que a produção fez.** O teste `rotas/eventos.test.ts` prova `hub.encerrarTodos()` seguido de `app.close()` em menos de 1 s, mas o `restart` na VM estourou o `TimeoutStopSec=20` e levou SIGKILL. `index.ts` não tem teste (abre porta e liga workers por ambiente) e a ligação dos workers e do ouvinte é provada só por `grep`, `tsc` e pelas linhas "ativo" do journal do boot. Pela leitura de `index.ts`, o ouvinte de SIGTERM (`aoEncerrar`) chama apenas as paradas dos workers e do hub; o `app.close()` só roda na desmontagem da recarga. **A causa do SIGKILL não está provada** (o diagnóstico "conexões SSE" de `16-PROVAS.md` é hipótese). Fica ESCALATE: pode ser defeito de implementação, e esta auditoria não altera código de produção | Um teste do caminho real exige subir `index.ts` (porta, banco) ou mexer no código; a prova é na VM | Investigar o SIGTERM em `index.ts` e cobrir com teste depois da correção; conferir com `systemctl restart` na VM |
| G-06 | MSG-01 a MSG-06 | **Os testes de banco da fase não rodam no CI.** O job `check` roda com `DATABASE_URL` vazia e pula todos; o job `seguranca` (Postgres 16) roda só `src/seguranca`, `cofre.test.ts` e `estado.test.ts`. A última rodada completa com banco foi o gate do 16-14 (Docker, 2026-11-09: api 217 arquivos e 2877 testes passaram, 2 arquivos e 21 testes pulados; web 135 arquivos e 1366 testes; domínio 132 arquivos e 2452 testes). Depois dele entraram só o ajuste de `listar` por `seq` numérico (teste RED→GREEN com banco), `tempo-real:provar` (6 testes com Postgres local) e o skip do `74554ab`: o SHA em produção **não** teve nova rodada completa com banco. Há também um teste sensível a tempo (`processador-de-entrada`, "acordar() com o laço em 60 s processa em menos de 500 ms") que falhou sob carga, causa não provada (`deferred-items.md`) | É mudança de workflow do GitHub, não de teste; fora do escopo desta auditoria | Estender o job com banco para `src/mensageria src/servicos/crm src/rotas src/e2e src/persistencia`, ou rodar `npm run check` num Postgres de Docker antes de cada publicação |
| G-07 | MSG-06 | As fixtures da Evolution (`exemplos/`) seguem **sintéticas**, derivadas da `2.3.7`, e a produção roda a `2.4.0`. A prova ao vivo processou texto, áudio, imagem e figurinha (5 de 5, sem `ignorado:sem_numero`), mas as capturas reais não viraram fixtures; vídeo e documento não foram exercidos ao vivo; o `@lid` sem número não apareceu | Precisa de capturas reais da Evolution do dono, sem dado de cliente | Salvar `messages.upsert` reais (telefone e nome trocados) em `exemplos/` e rodar `traduzir.test.ts` contra elas |

Fora do escopo, não são lacunas: tudo que `COVERAGE.md` marca `OPT-OUT` e a `16-PROVAS.md` entrega à Sessão 4 (QR code, status de entrega, `fromMe`, nono dígito, reações, grupos).

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (as três exceções são checkpoints humanos declarados: 16-15-03, 16-16-01, 16-16-02)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (**falha**: 16-15-03, 16-16-01 e 16-16-02 são três tarefas seguidas só com verificação humana)
- [x] Wave 0 covers all MISSING references (a troca das fixtures por capturas reais segue em G-07)
- [x] No watch-mode flags (todo comando é `vitest run`)
- [x] Feedback latency < 30s (medido só nos arquivos puros: 2 a 3 s; os de banco, ~30 s por arquivo, vêm dos `SUMMARY.md`)
- [ ] `nyquist_compliant: true` set in frontmatter (**não definido**: G-01 a G-07 abertas)

**Approval:** validada com lacunas em 2026-11-10 (`nyquist_compliant: false`). Para virar `true`: fechar G-01, G-02 e G-05 (as que contradizem ou deixam sem medir um critério da fase) e G-06 (a rede de segurança); G-03, G-04 e G-07 podem ficar como manual-only aceito pelo dono.

## Validation Audit 2026-11-10

| Metric | Count |
|---|---|
| Gaps found | 8 |
| Resolved | 1 |
| Escalated | 7 |
