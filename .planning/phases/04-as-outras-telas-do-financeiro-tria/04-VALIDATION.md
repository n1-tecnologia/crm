---
phase: 4
slug: as-outras-telas-do-financeiro-tria
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-23
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derivada de `04-RESEARCH.md` §Validation Architecture. Esta fase toca **dois
> repositórios**, com dois runners diferentes — a amostragem cobre os dois.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (`crm-n1`)** | Vitest (`vitest.config.mts` por workspace: `apps/api`, `apps/web`, `packages/dominio`) |
| **Framework (`financeiro-tria/automation`)** | `node:test` via `tsx --test --test-concurrency=1 "src/**/*.test.ts"` |
| **Config file** | `apps/api/vitest.config.mts`, `apps/web/vitest.config.mts`; `automation/` sem config — script no `package.json` |
| **Quick run command** | `npm run test -w @n1/api -- <arquivo>` · `cd ../financeiro-tria/automation && npx tsx --test src/http/<arquivo>.test.ts` |
| **Full suite command** | `npm run check` (raiz — typecheck + lint + tokens + testes nos 3 workspaces) **e** `cd ../financeiro-tria/automation && npm test` |
| **Estimated runtime** | ~90 s (`npm run check`) + ~30 s (`automation/`) |

---

## Sampling Rate

- **After every task commit:** rodar o teste do arquivo tocado, no repositório
  em que ele está.
- **After every plan wave:** `npm run check` na raiz do `crm-n1` **e** `npm test`
  no `automation/`. Os dois, sempre — CON-05 exige que o `automation/` fique com
  o `git log` limpo fora do que o plano tocou deliberadamente, e a única forma de
  provar isso é rodar a suíte dele.
- **Before `/gsd-verify-work`:** as duas suítes verdes.
- **Max feedback latency:** 120 s.

**Portão extra desta fase (D4-16):** até a etapa 3 do corte, `financeiro-tria.vercel.app`
tem de continuar respondendo. Qualquer onda que o derrube antes disso falhou,
mesmo com as suítes verdes.

---

## Per-Task Verification Map

> Preenchido por plano durante `/gsd-plan-phase`. As linhas abaixo são o mapa
> mínimo derivado de `04-RESEARCH.md`; o planejador amarra cada uma ao Task ID real.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 1 | TELA-01 | T-4-AUTH | `/v1/leituras/*` recusa sem Bearer e com Bearer errado, em tempo constante (`timingSafeEqual`); Bearer vazio nunca autentica | unit | `cd ../financeiro-tria/automation && npx tsx --test src/http/leituras-plataforma-routes.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | TELA-01 | T-4-DTO | Nenhum DTO contém `app_key`, `app_secret`, `api_key`, `cpf_cnpj`, `telefone` nem campos de endereço — provado por **nome de campo** (allowlist positiva), nunca por snapshot | unit | idem acima | ❌ W0 | ⬜ pending |
| TBD | TBD | 2 | TELA-01 | T-4-ACL | `apps/api` devolve 403 para Membro sem alcance à Pasta "Financeiro" (`memberReachesContainer(state, id, "folder", CP.folderId)`), 200 para quem alcança | unit | `npm run test -w @n1/api -- financeiro` | ❌ W0 | ⬜ pending |
| TBD | TBD | 2 | TELA-01 | T-4-NET | Cliente HTTP: timeout, classificação transitório × permanente, log saneado por `sanitizarErro()` importada de `persistencia/outbox-worker` | unit | `npm run test -w @n1/api -- cliente-leituras-financeiro` | ❌ W0 | ⬜ pending |
| TBD | TBD | 2 | TELA-01 (D4-06) | — | `buildDashboardStats`/`buildProblemRows` re-homed produzem resultado **idêntico** ao das funções originais do front do Vercel, sobre a mesma fixture | unit | `cd ../financeiro-tria/automation && npx tsx --test src/tenants/tria/financeiro-derivacoes.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 3 | TELA-01 (D4-13) | T-4-FILE | Proxy de upload recusa MIME e tamanho fora do esperado **antes** de repassar ao `automation/` | unit | `npm run test -w @n1/api -- extratos` | ❌ W0 | ⬜ pending |
| TBD | TBD | 3 | TELA-01 (D4-10) | T-4-ACL | Import do Plano de contas só aceita `empresa`/`tipo` da allowlist fixa (6 × {pagar,receber}); valor livre é 400 | unit | `cd ../financeiro-tria/automation && npx tsx --test src/http/leituras-plataforma-routes.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 4 | TELA-01 | T-4-ACL | Um Membro com alcance vê as 8 leituras carregadas via `apps/api`; um Membro sem alcance não vê `/financeiro` na navegação | unit + integração (ver nota) | `npm run test -w @n1/web -- vePastaFinanceiro` e `npm run test -w @n1/api -- financeiro` | ❌ W0 | ⬜ pending |

> **Correção de 2026-09-23 (achado do planejador).** A versão anterior desta
> linha mandava `npm run test -w @n1/web -- --grep financeiro` como e2e de
> Playwright. O comando estava errado por duas razões: `test` em `apps/web` é
> `vitest run`, e o Playwright é `test:e2e`; e o harness de e2e
> (`apps/web/e2e/`, dois specs) **não tem fixture de sessão autenticada**, então
> nenhuma jornada logada roda hoje. A cobertura foi redistribuída em testes
> unitários e de integração (alcance nos dois sentidos sobre o seed; 401/403
> contra o Postgres real) mais as conferências manuais abaixo. Um e2e de verdade
> exige criar a fixture de sessão primeiro — é plano próprio, com custo próprio,
> não uma linha desta tabela.

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `../financeiro-tria/automation/src/http/leituras-plataforma-routes.test.ts` — autenticação + allowlist de DTO + allowlist de `empresa`/`tipo`
- [ ] `../financeiro-tria/automation/src/tenants/tria/financeiro-derivacoes.test.ts` — equivalência com `buildDashboardStats`/`buildProblemRows` originais
- [ ] `apps/api/src/rotas/financeiro.test.ts` — alcance (403/200), proxy, upload
- [ ] `apps/api/src/automacoes/cliente-leituras-financeiro.test.ts` — timeout e classificação, no molde dos casos (f)–(m) de `invocar-agente.test.ts`
- [ ] Fixture compartilhada de `solicitacoes_pagamentos` e `transacoes` — **sem dado real e sem credencial real**, com campos proibidos presentes de propósito para que o teste de allowlist tenha o que reprovar
- [ ] Nenhum framework novo a instalar: Vitest e `node:test` já cobrem tudo

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| RLS em `transacoes` e `produtos_cadastrados_emissao_notas` | TELA-01 / D4-16 | Nenhuma migração em `../financeiro-tria/supabase/migrations/` menciona essas duas tabelas — ao contrário de todas as outras, que têm policy `anon_read` explícita. Se a RLS nunca foi ligada, o front atual tem **CRUD irrestrito por chave anon**. `grep` não responde isso; só o Postgres responde. | Antes da etapa 4 do corte, no Supabase Studio do projeto do financeiro-tria: `select relname, relrowsecurity from pg_class where relname in ('transacoes','produtos_cadastrados_emissao_notas');` e listar as policies. Registrar o resultado no runbook. |
| O painel do Vercel continua no ar até a etapa 3 do corte | D4-16 | Estado operacional externo ao repositório | Abrir `financeiro-tria.vercel.app` ao fim de cada onda; qualquer 404/500 antes da etapa 3 é falha da onda |
| Allowlist de origem do upload (`MP_RECEBIMENTO_SOURCE`) | D4-13 | Só falha em produção; ambiente local não reproduz | Subir o proxy contra o `automation/` de staging e provar que o upload é aceito antes do deploy real |
| Uma semana de uso real antes do corte | D4-16 | Julgamento de quem opera | Confirmação explícita do Financeiro, registrada no runbook |

---

## Validation Sign-Off

> **Por que tudo abaixo está desmarcado, e isso é a leitura certa.** Os arquivos
> de teste da Wave 0 **ainda não existem** — eles são trabalho das Tasks 3 dos
> planos da onda 1. `nyquist_compliant` e `wave_0_complete` só passam a `true`
> quando a execução os tiver criado e verdes, não quando o planejamento os
> tiver previsto. Marcá-los agora seria afirmar cobertura que não existe.
> Quem fecha estas caixas é `/gsd-verify-work`, ao fim da fase.
>
> *(Nota acrescentada em 2026-09-23 a pedido do `gsd-plan-checker`, que leu o
> estado desmarcado como possível esquecimento. É decisão, não esquecimento.)*

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120 s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending — liberado por `/gsd-verify-work` ao fim da Phase 4
