---
phase: 0
slug: prepara-o
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-16
---

# Phase 0 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 5.0.0 (já configurado em `apps/api/vitest.config.mts`, `testTimeout: 60s`) |
| **Config file** | `apps/api/vitest.config.mts` |
| **Quick run command** | `npm run test -w @n1/api -- importacao/clickup` (só os testes da pasta nova) |
| **Full suite command** | `npm run check` (raiz — typecheck + lint + tokens + testes dos três workspaces) |
| **Estimated runtime** | ~15 s sem `CLICKUP_API_TOKEN`/`DATABASE_URL` (integração pula); o teste de integração da exportação, quando roda, é limitado pelo rate limit do ClickUp (100 req/min) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -w @n1/api -- importacao/clickup` + `npm run typecheck -w @n1/api`
- **After every plan wave:** Run `npm run check`
- **Before `/gsd-verify-work`:** Full suite must be green; o manifesto commitado é conferido por checkpoint humano contra as contagens reais das 3 Listas (não reproduzível em CI sem o token)
- **Max feedback latency:** 45 segundos

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (preenchido pelo planejador) | — | — | PREP-02 | T-0-01 | Token só via `carregarEnv()`, nunca logado nem gravado no manifesto; header `Authorization: <token>` sem "Bearer" | unit | `npm run test -w @n1/api -- cliente` | ❌ W0 | ⬜ pending |
| (preenchido pelo planejador) | — | — | PREP-02 | — | Paginação `page`/`last_page` (tasks, members) e `start`/`start_id` (comments) contra fixtures gravadas, sem rede | unit | `npm run test -w @n1/api -- paginacao` | ❌ W0 | ⬜ pending |
| (preenchido pelo planejador) | — | — | PREP-02 | T-0-02 | Backoff em 429 respeita `X-RateLimit-Reset`; exportação retomável a partir dos arquivos já em disco | unit | `npm run test -w @n1/api -- cliente` | ❌ W0 | ⬜ pending |
| (preenchido pelo planejador) | — | — | PREP-02 | T-0-03 | Manifesto: sha256 por arquivo + contagens por recurso; nenhum dado pessoal no manifesto (só contagens/hashes) | unit | `npm run test -w @n1/api -- manifesto` | ❌ W0 | ⬜ pending |
| (preenchido pelo planejador) | — | — | PREP-02 | — | Exportação real contra a API (integração) — pula sem `CLICKUP_API_TOKEN` | integration | `npm run test -w @n1/api -- exportar.integration` | ❌ W0 | ⬜ pending |
| (preenchido pelo planejador) | — | — | PREP-04 | T-0-04 | Toda entrada tem `roleIdEsperado` existente no bootstrap (`role_prop`/`role_adm`/`role_mem`/`role_conv`); 6 e-mails presentes e únicos; nenhuma credencial | unit | `npm run test -w @n1/api -- de-para-usuarios` | ❌ W0 | ⬜ pending |
| (preenchido pelo planejador) | — | — | PREP-04 | — | `EntradaDeParaUsuario` compatível com a assinatura de `inviteMember` | unit (typecheck) | `npm run typecheck -w @n1/api` | ✅ | ⬜ pending |
| (preenchido pelo planejador) | — | — | PREP-03 | — | `docs/07-processos/solicitacao-de-pagamento.md` existe com as 12 seções do molde (`grep -c "^## " → 12`) e responde D6/D8 | source assertion | `grep -cE "^## [0-9]+\." docs/07-processos/solicitacao-de-pagamento.md` | n/a | ⬜ pending |
| (preenchido pelo planejador) | — | — | PREP-05 | — | REQUIREMENTS.md e ROADMAP marcam PREP-05 / critério 4 como "risco aceito (D-13)" | source assertion | `grep -c "risco aceito" .planning/REQUIREMENTS.md` | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/importacao/clickup/paginacao.test.ts` — PREP-02 (dois padrões de paginação)
- [ ] `apps/api/src/importacao/clickup/cliente.test.ts` — PREP-02 (backoff 429, header de auth sem "Bearer", token nunca logado)
- [ ] `apps/api/src/importacao/clickup/manifesto.test.ts` — PREP-02 (hash, contagens)
- [ ] `apps/api/src/importacao/clickup/de-para-usuarios.test.ts` — PREP-04 (forma, unicidade, `roleId` válido)
- [ ] Fixtures de resposta do ClickUp (JSON montado a partir dos exemplos da documentação oficial, **nunca** de dados reais de produção) para os testes unitários rodarem sem rede
- [ ] Framework: nenhuma instalação nova — Vitest já configurado

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Manifesto commitado bate com as contagens reais das 3 Listas | PREP-02 | Exige comparar contra o ClickUp de produção com o token; não reproduzível em CI sem repetir a exportação | Abrir cada Lista no ClickUp (ou `GET /list/{id}/task?page=N` até `last_page`) e conferir o total de Tarefas com o manifesto; conferir 3 Tarefas por amostragem (comentários, anexos) |
| Spec da Solicitação responde D6/D8 e reflete a Lista real | PREP-03 | Documento markdown — verificação de conteúdo por leitura humana (dono/Financeiro valida as lacunas marcadas) | Ler `solicitacao-de-pagamento.md` §3 (Status) e §4 (Campos) contra a exportação; confirmar §12 lista o que ficou aberto |
| `time_in_status` ClickApp habilitado no Workspace `9011731314` | PREP-02 | Só se descobre chamando a API real (smoke test no início da exportação) | Primeira chamada `GET /task/{id}/time_in_status` numa Tarefa conhecida; se 4xx, o plano segue sem histórico aproximado e a spec registra |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
