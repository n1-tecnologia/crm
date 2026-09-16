---
phase: 0
slug: prepara-o
status: planned
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
| 00-01-T1 | 00-01 | 1 | PREP-02 | T-0-01 | Token só via `carregarEnv()`, nunca logado nem em mensagem de erro; header `Authorization: <token>` sem "Bearer"; `hostPermitido` (allowlist de host para download, T-0-07) | unit | `npm run test -w @n1/api -- src/importacao/clickup/cliente.test.ts` | ❌ W0 (00-01-T1 cria) | ⬜ pending |
| 00-01-T1 | 00-01 | 1 | PREP-02 | T-0-02 | Backoff em 429 respeita `X-RateLimit-Reset`; pacing por `X-RateLimit-Remaining`; `TETO_DE_TENTATIVAS` | unit | `npm run test -w @n1/api -- src/importacao/clickup/cliente.test.ts` | ❌ W0 (00-01-T1 cria) | ⬜ pending |
| 00-01-T2 | 00-01 | 1 | PREP-02 | T-0-02 | Paginação `page`/`last_page` (tasks) e `start`/`start_id` (comments) contra fixtures da documentação, sem rede; `TETO_DE_PAGINAS`; dedupe por id | unit | `npm run test -w @n1/api -- src/importacao/clickup/paginacao.test.ts` | ❌ W0 (00-01-T2 cria) | ⬜ pending |
| 00-01-T3 | 00-01 | 1 | PREP-02 | T-0-03 | `apps/api/exportacoes/clickup/` ignorada pelo git; manifesto um nível acima, rastreável; `CLICKUP_API_TOKEN` no `.env.example` sem valor | source assertion | `git check-ignore -q apps/api/exportacoes/clickup/.probe && ! git check-ignore -q apps/api/exportacoes/CONTEXT.md && git diff -- apps/api/.env.example \| grep -c '^+CLICKUP_API_TOKEN=$'` | n/a | ⬜ pending |
| 00-02-T1 | 00-02 | 2 | PREP-04 | T-0-01 | `usuarios.cli.ts` resolve id → e-mail pela API sem imprimir token nem corpo; exit 1 sem token | source assertion | `grep -v '^\s*[/*]' apps/api/src/importacao/clickup/usuarios.cli.ts \| grep -c 'console.log(.*token'` = 0 | n/a | ⬜ pending |
| 00-02-T2 | 00-02 | 2 | PREP-04 | T-0-09, T-0-10, T-0-15 | 6 entradas com e-mail único e `roleIdEsperado` existente em `buildGestaoBootstrap()`; `81581816` → `memberIdConhecido: "mem_maryane"`; catálogo com 38 `CLICKUP_*`; nenhum token/senha | unit | `npm run test -w @n1/api -- src/importacao/clickup/de-para-usuarios.test.ts` | ❌ W0 (00-02-T2 cria) | ⬜ pending |
| 00-02-T2 | 00-02 | 2 | PREP-04 | — | `EntradaDeParaUsuario` compatível com `Parameters<typeof inviteMember>[2]` | unit (typecheck) | `npm run typecheck -w @n1/api` | ✅ | ⬜ pending |
| 00-03-T1 | 00-03 | 2 | PREP-02 | T-0-06, T-0-07, T-0-08 | `sanitizarNomeDeArquivo`/`caminhoDoAnexo` sem path traversal; gravação atômica; `lerSeValido`; coleta de anexos/usuários | unit | `npm run test -w @n1/api -- src/importacao/clickup/exportar.test.ts` | ❌ W0 (00-03-T1 cria) | ⬜ pending |
| 00-03-T2 | 00-03 | 2 | PREP-02 | T-0-02, T-0-03 | Retomada sem rede (`requisicoes === 0`); smoke test de `time_in_status` (4xx ⇒ indisponível, 1 chamada); anexos pulados por host/tamanho/política; `log`/avisos sem token; JSON da API gravado cru | unit | `npm run test -w @n1/api -- src/importacao/clickup/exportar.test.ts` | ❌ W0 (00-03-T2 amplia) | ⬜ pending |
| 00-04-T1 | 00-04 | 3 | PREP-02 | T-0-04, T-0-05 | sha256 por arquivo + `hashAgregado` determinístico; contagens recontadas do disco; markdown/JSON sem e-mail/CPF/CNPJ/nome de anexo; `.gitignore` preso ao teste | unit | `npm run test -w @n1/api -- src/importacao/clickup/manifesto.test.ts` | ❌ W0 (00-04-T1 cria) | ⬜ pending |
| 00-04-T2 | 00-04 | 3 | PREP-02 | T-0-01 | CLI sem `CLICKUP_API_TOKEN` sai com exit 1 apontando `.env.example`; nunca imprime token | CLI | `cd apps/api && env -u CLICKUP_API_TOKEN npx vite-node src/importacao/clickup/exportar.cli.ts --pasta=$(mktemp -d)/clickup` → "CLICKUP_API_TOKEN ausente" | n/a | ⬜ pending |
| 00-04-T3 | 00-04 | 3 | PREP-02 | — | Exportação real contra a API (campos reais, smoke `time_in_status` em `868k8tn50`, amostra de 3 Tarefas + retomada) — pula sem `CLICKUP_API_TOKEN` | integration | `npm run test -w @n1/api -- src/importacao/clickup/exportar.integration.test.ts` | ❌ W0 (00-04-T3 cria) | ⬜ pending |
| 00-05-T1 | 00-05 | 4 | PREP-02 | T-0-03 | Exportação completa das 3 Listas em disco; `execucao.json` com `amostra: false` e `detalhes === tarefas + tarefasArquivadas`; nada da pasta no `git status` | source assertion | `node -e` sobre `apps/api/exportacoes/clickup/execucao.json` (ver 00-05-PLAN Task 1) `&& ! git status --porcelain \| grep -q apps/api/exportacoes/clickup/` | n/a | ⬜ pending |
| 00-05-T2 | 00-05 | 4 | PREP-02 | T-0-05, T-0-12 | `MANIFESTO.md/.json` rastreados, sem e-mail/CPF/CNPJ, `usuariosVistos` sem nome, anexos sem nome original; commit só com os dois arquivos | source assertion + manual (manifesto × ClickUp) | `git ls-files --error-unmatch apps/api/exportacoes/MANIFESTO.md apps/api/exportacoes/MANIFESTO.json && grep -cE '[A-Za-z0-9._%+-]+@' apps/api/exportacoes/MANIFESTO.json` = 0 | n/a | ⬜ pending |
| 00-06-T1 | 00-06 | 5 | PREP-03 | T-0-13 | Spec com 12 seções `## N.`, "Lista própria", "Vínculo", "90 dias", `time_in_status`, ≥ 1 `⚠ A confirmar`, `RN-SP-` ≥ 5; sem CPF/e-mail | source assertion | `grep -cE '^## [0-9]+\. ' docs/07-processos/solicitacao-de-pagamento.md` = 12 | n/a | ⬜ pending |
| 00-06-T2 | 00-06 | 5 | PREP-03 | — | Dono/Financeiro respondeu as lacunas L-NN (checkpoint human-action) | manual | — (checkpoint) | n/a | ⬜ pending |
| 00-06-T3 | 00-06 | 5 | PREP-03 | T-0-13 | Marcadores inline = 0; §12 só com o que ficou aberto; commit `PREP-03` | source assertion | `grep -c '⚠ A confirmar' docs/07-processos/solicitacao-de-pagamento.md` = 0 | n/a | ⬜ pending |
| 00-07-T1 | 00-07 | 6 | PREP-05 | T-0-18 | REQUIREMENTS.md e plano de migração marcam PREP-05 como risco aceito (D-13); ROADMAP intocado por tarefa (instrução no SUMMARY) | source assertion | `grep -c 'risco aceito pelo dono' .planning/REQUIREMENTS.md` ≥ 2 `&& git diff --quiet -- .planning/ROADMAP.md` | n/a | ⬜ pending |
| 00-07-T2 | 00-07 | 6 | PREP-01, PREP-06 (+ regressão de PREP-02/03/04) | T-0-03, T-0-14 | `npm run check` verde nos três workspaces; nada de `apps/api/exportacoes/clickup/` no git; domínio e `financeiro-tria` intocados | full suite | `npm run check && test "$(git ls-files \| grep -c apps/api/exportacoes/clickup/)" = 0` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Cada teste nasce no mesmo plano/task que cria o código que ele prova (TDD opportunistic, `tdd="true"` nas tasks de código):

- [ ] `apps/api/src/importacao/clickup/cliente.test.ts` — PREP-02 (backoff 429, pacing, header de auth sem "Bearer", token nunca logado, allowlist de host) — Plan 00-01 Task 1
- [ ] `apps/api/src/importacao/clickup/paginacao.test.ts` — PREP-02 (dois padrões de paginação, teto, dedupe) — Plan 00-01 Task 2
- [ ] `apps/api/src/importacao/clickup/de-para-usuarios.test.ts` — PREP-04 (forma, unicidade, `roleId` do bootstrap real, `memberIdConhecido`, catálogo 38, sem segredo, compat `inviteMember`) — Plan 00-02 Task 2
- [ ] `apps/api/src/importacao/clickup/exportar.test.ts` — PREP-02 (sanitização/path traversal, gravação atômica, retomada sem rede, smoke `time_in_status`, anexos pulados, amostra, arquivadas) — Plan 00-03 Tasks 1-2
- [ ] `apps/api/src/importacao/clickup/manifesto.test.ts` — PREP-02 (sha256, contagens do disco, sem PII, determinismo, `.gitignore`) — Plan 00-04 Task 1
- [ ] `apps/api/src/importacao/clickup/exportar.integration.test.ts` — PREP-02 (API real; pula sem `CLICKUP_API_TOKEN`) — Plan 00-04 Task 3
- [ ] Fixtures de resposta do ClickUp (JSON montado a partir dos exemplos da documentação oficial, **nunca** de dados reais de produção) para os testes unitários rodarem sem rede — inline em cada `*.test.ts`
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
