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
| 16-XX-XX | — | — | MSG-01 | T-16-XX | webhook sem segredo / errado → mesma 401, nada gravado | rota (banco) | `npx vitest run src/rotas/webhooks-de-mensageria.test.ts` | ❌ W0 | ⬜ pending |
| 16-XX-XX | — | — | MSG-01 | — | repetida não grava nada novo; Contato arquivado volta a `ativo` | serviço (banco) + unit (domínio) | `npx vitest run src/servicos/crm/recebimento.test.ts` | ❌ W0 | ⬜ pending |
| 16-XX-XX | — | — | MSG-02 | T-16-XX | Mensagem `pendente` e linha `mensagem.enviar.v1` na mesma transação; falha do evento desfaz a Mensagem | serviço (banco) | `npx vitest run src/servicos/crm/mensagens.test.ts` | ✅ (estender) | ⬜ pending |
| 16-XX-XX | — | — | MSG-02 | — | worker antigo do outbox ignora `mensagem.%`; entregador grava `id_externo` / `enviada` / `falhou` | worker (banco + servidor falso) | `npx vitest run src/mensageria/entregar-mensagem.test.ts src/persistencia/outbox-worker.test.ts` | ❌ W0 / ✅ | ⬜ pending |
| 16-XX-XX | — | — | MSG-03 | T-16-XX | evento só com ids; outro Espaço e Papel sem `ler` não recebem; `app.close()` não pendura | rota + hub | `npx vitest run src/rotas/eventos.test.ts src/mensageria/avisar.test.ts` | ❌ W0 | ⬜ pending |
| 16-XX-XX | — | — | MSG-04 | T-16-XX | tipos novos aceitos; texto renomeado `.ogg` recusado; Formulário público segue recusando áudio | unit + rota | `npx vitest run src/servicos/storage-uploads.test.ts src/rotas/formularios-publicos.test.ts` | ✅ (estender) | ⬜ pending |
| 16-XX-XX | — | — | MSG-05 | T-16-XX | provedor de teste só para Canal com `conexao_simulada = true`; segredo próprio por Canal | serviço + rota | `npx vitest run src/mensageria/registro.test.ts` | ❌ W0 | ⬜ pending |
| 16-XX-XX | — | — | MSG-06 | T-16-XX | `canal:ligar-evolution` recusa `numeropvmarcos`; cliente da Evolution com tempo limite; tradutor ignora `fromMe`, grupo e `@lid` sem número | unit (servidor falso) | `npx vitest run src/mensageria/provedores/evolution src/bootstrap/canal-ligar-evolution.test.ts` | ❌ W0 | ⬜ pending |

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
