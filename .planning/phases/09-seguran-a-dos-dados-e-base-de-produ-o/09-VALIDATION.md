---
phase: "09"
slug: "seguran-a-dos-dados-e-base-de-produ-o"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-22"
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Fonte: `09-RESEARCH.md` § Validation Architecture. Os IDs de tarefa serão preenchidos quando os PLAN.md existirem; até lá a coluna "Task ID" traz o requisito.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `vitest ^5.0.0` nos três workspaces (`packages/dominio`, `apps/api`, `apps/web`) |
| **Config file** | `apps/api/vitest.config.mts` (`fileParallelism: false`, `testTimeout: 180_000`), `packages/dominio/vitest.config.mts`, `apps/web/vitest.config.mts` (jsdom) |
| **Quick run command** | domínio: `cd packages/dominio && npx vitest run src/derive-visibilidade.test.ts` · api sem banco: `cd apps/api && npx vitest run src/observabilidade src/rotas/operacoes-suspenso.test.ts` |
| **Full suite command** | `npm run check` (tipos, lint, tokens e testes) + suíte com Postgres local: `cd apps/api && DATABASE_URL=postgres://postgres:x@localhost:556NN/postgres npx vitest run src/seguranca src/servicos/cofre.test.ts src/rotas/estado.test.ts` |
| **Prova de nginx** | `bash apps/api/deploy/provar-nginx.sh` (Docker `nginx:stable-alpine`) |
| **Estimated runtime** | ~60 s (sem banco) · ~180 s (com Postgres local) |

---

## Sampling Rate

- **After every task commit:** o comando rápido da área tocada (domínio sem banco; `log`/`sentry`/`operacoes-suspenso` sem banco; `provar-nginx.sh`)
- **After every plan wave:** `npm run check` + a suíte com Postgres local (`src/seguranca`, `cofre`, `estado`, `banco-n1-api`)
- **Before `/gsd-verify-work`:** tudo acima + job `seguranca` do CI verde com contagem de testes executados > 0 + checkpoints `[BLOCKING]` colados + `09-PENTEST.md`
- **Max feedback latency:** 180 segundos

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| SEG-01 | TBD | TBD | SEG-01 | T-09-xx | Membro A não recebe Sessão de Chat, pasta, Memória, Visão, e-mail de convite, texto das mensagens nem segredos de B — em `GET /estado` e em `POST /operacoes` (incl. `value` e `inviteMember`) | unit + e2e | `cd packages/dominio && npx vitest run src/derive-visibilidade.test.ts` · `cd apps/api && DATABASE_URL=… npx vitest run src/rotas/estado.test.ts src/rotas/operacoes.test.ts src/seguranca/dados-de-outro-membro.test.ts` | domínio ✅ · api ❌ W0 | ⬜ pending |
| SEG-01 (órfão) | TBD | TBD | SEG-01 | T-09-xx | Membro B não baixa nem recebe o arquivo cujo anexo A removeu | e2e | `cd apps/api && DATABASE_URL=… npx vitest run src/seguranca/anexos.test.ts` | ❌ W0 | ⬜ pending |
| SEG-02 | TBD | TBD | SEG-02 | T-09-xx | Convidado recebe `agents`, `automations`, `documents`, `collections`, `skills` = `[]`; demais Papéis recebem tudo; trilho sem IA; `/ia/*` mostra "Sem acesso" | unit (domínio e web) | `cd packages/dominio && npx vitest run src/derive-visibilidade.test.ts` · `cd apps/web && npx vitest run src/features/shell "src/app/(shell)/ia"` | ❌ W0 | ⬜ pending |
| SEG-03 | TBD | TBD | SEG-03 | T-09-xx | Suspenso: 403 antes do banco em `POST /operacoes/trashContact`; Convidado `ok:false` em `trashContact`, `sendMessage`, `winDeal`, `restoreList`, `createReceivableSeries` | unit | `cd apps/api && npx vitest run src/rotas/operacoes-suspenso.test.ts` · `cd packages/dominio && npx vitest run src/crm src/operations/tasks.test.ts` | ❌ W0 | ⬜ pending |
| SEG-03 (tabela) | TBD | TBD | SEG-03 | — | Toda chave de `OPERACOES` (286) aparece na tabela "Quem pode" de `packages/dominio/CONTEXT.md` | unit | `cd packages/dominio && npx vitest run src/quem-pode.test.ts` | ❌ W0 | ⬜ pending |
| SEG-04 | TBD | TBD | SEG-04 | T-09-xx | Banco novo: `anon`/`authenticated` sem `USAGE`; `n1_api` com DML; `drop table plataforma.migracoes` por `n1_api` → `42501`; `009` aplica sem `anon`; papel criado depois + script idempotente → grants; RLS desligada | integração | `cd apps/api && DATABASE_URL=… npx vitest run src/seguranca/banco-n1-api.test.ts` | ❌ W0 | ⬜ pending |
| SEG-05 | TBD | TBD | SEG-05 | T-09-xx | Round trip; segredo cifrado no banco; chave errada lança; linha copiada para outro `dono_id` não decifra (AAD); nenhuma rota devolve o segredo | unit + integração | `cd apps/api && DATABASE_URL=… npx vitest run src/servicos/cofre.test.ts` | ❌ W0 | ⬜ pending |
| SEG-06 | TBD | TBD | SEG-06 | T-09-xx | Nenhum log da api nem do nginx (inclusive `error_log` sob `limit_req`) guarda o segredo da URL | unit + Docker | `cd apps/api && npx vitest run src/observabilidade/log.test.ts` · `bash apps/api/deploy/provar-nginx.sh` | ❌ W0 | ⬜ pending |
| SEG-07 | TBD | TBD | SEG-07 | T-09-xx | 50 `POST` seguidos ao mesmo caminho: ≥ 30 respostas `429`, primeiro `429` entre a 11ª e a 20ª; `GET` com teto próprio mais alto (D-20); nenhum `error_log` com o segredo | Docker | `bash apps/api/deploy/provar-nginx.sh` | ❌ W0 | ⬜ pending |
| SEG-10 | TBD | TBD | SEG-10 | T-09-xx | `limparEvento` apaga corpo, cabeçalhos, cookies, query e o segmento secreto de URL (api e web) | unit | `cd apps/api && npx vitest run src/observabilidade/sentry.test.ts` · `cd apps/web && npx vitest run sentry-scrub` | ❌ W0 | ⬜ pending |
| SEG-12 | TBD | TBD | SEG-12 | T-09-xx | Matriz Papel × rota (inventário por `onRoute`), outro Espaço, enumeração/força bruta de segredo, XFF forjado, anexo inalcançável, corpo grande/tipo errado | integração | `cd apps/api && DATABASE_URL=… npx vitest run src/seguranca` + job `seguranca` do CI | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/seguranca/` — fábrica de Espaço com 2 Membros reais, inventário de rotas, matriz, XFF, anexos, entrada hostil, `banco-n1-api` (SEG-01, 03, 04, 12)
- [ ] `apps/api/src/servicos/cofre.test.ts`, `apps/api/src/observabilidade/{log,sentry}.test.ts`, `apps/api/src/rotas/operacoes-suspenso.test.ts` (SEG-03, 05, 06, 10)
- [ ] Domínio: testes de Convidado `ok:false` (`crm-antigo`, `contacts`, `conversations`, `deals`, `tasks`, `financeiro`) e `quem-pode.test.ts` (SEG-03)
- [ ] Web: `assuntosVisiveis` extraído e testado, `ia/layout`, telas com `secret === ""`, scrub do Sentry (SEG-02, 10)
- [ ] `apps/api/deploy/provar-nginx.sh` + `n1-crm-limites.conf` (SEG-06, 07)
- [ ] `.github/workflows/check.yml`: job `seguranca` com `services: postgres` (hoje o CI pula todo teste com banco)
- [ ] Refatoração: `migrar(pool?)`, `poolDeMigracao()`, `encerrar()` fecha os dois pools
- [ ] Instalação (após o checkpoint de legitimidade): `@sentry/node`, `@sentry/nextjs` em versão exata

---

## Manual-Only Verifications

Cada linha é um checkpoint `[BLOCKING]` no padrão das Fases 2, 5 e 8 (D-11): o Claude escreve o comando, o dono executa e cola a saída.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `009` aplicada em produção; `has_schema_privilege('anon'/'authenticated','plataforma','USAGE')` = `false`; `api.env` com as duas URLs; `/saude` e `GET /estado` respondem; `drop table` por `n1_api` recusado | SEG-04 | Só o dono acessa a VPS e o banco de produção | Queries coladas pelo dono |
| `grep <segredo> /var/log/nginx/n1-crm-api*.log` vazio na VPS | SEG-06 | VPS compartilhada, firewall desligado — Claude não executa por SSH | Saída colada |
| 50 chamadas seguidas a `crm-n1-api.85.155.186.214.nip.io/v1/public/forms/x` recebem `429` | SEG-07 | Prova contra a VPS real | Laço de `curl` colado |
| Push em `homologacao` publica a api; `/entrar` do Preview carrega o Início | SEG-08 | GitHub Actions + Vercel + VPS | Print do Actions e do login |
| Dump cifrado sobe ao bucket; a chave de escrita não lista; restauração num Postgres descartável no Mac (D-21) reproduz `count(*)` de `plataforma.registros` | SEG-09 | Chave privada `age` fica só com o dono | `age -d … \| pg_restore` + `psql -c "select count(*) …"` |
| Erro forçado em homologação chega como e-mail em até 5 min | SEG-10 | Caixa de entrada do dono | E-mail encaminhado |
| Painel da Evolution por HTTPS; chave de API anotada | SEG-11 | VPS nova do dono | URL + print |
| `09-PENTEST.md` com autorização escrita do dono no topo | SEG-12 | D-16: autorização é do dono | Revisão do arquivo |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 180s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
