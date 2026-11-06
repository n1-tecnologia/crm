---
phase: "15"
slug: unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-05"
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Fonte: `15-RESEARCH.md` § Validation Architecture. Os ids `UCR-01..12` são os da pesquisa (os `UNI-04..08` do CONTEXT colidem com a Fase 14); a tabela de equivalência está na pesquisa.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^5.0.0 nas três camadas (`packages/dominio`, `apps/api`, `apps/web`) |
| **Config file** | `apps/api/vitest.config.mts`, `apps/web/vitest.config.mts`, `packages/dominio/vitest.config.mts` |
| **Quick run command** | `cd packages/dominio && npx vitest run <arquivo>` · `cd apps/web && npx vitest run <arquivo>` · `cd apps/api && DATABASE_URL=postgres://postgres:x@localhost:557NN/postgres DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:557NN/postgres npx vitest run <arquivo>` |
| **Full suite command** | Postgres 16 em Docker (`docker run -d --rm --name crm-n1-pg-15NN -e POSTGRES_PASSWORD=x -p 557NN:5432 postgres:16`), `npm run migrar` nele, depois `DATABASE_URL=… DATABASE_URL_MIGRACAO=… npm run check`. **Nunca `npm test` sozinho**: ele lê o `.env` de produção e passa de 600 s. |
| **Estimated runtime** | api ~157 s, web ~17 s, domínio ~4 s — `check` completo ≈ 4 min em Docker |

Flakes de baseline aceitos só com o arquivo rodado isolado como evidência: `outbox-worker.test.ts` h–k, `colunas-geradas.test.ts`, `lote-contas-a-pagar (d)`. Todo teste novo de persistência usa `describeComBanco` (nunca `carregarEnv()` + `describe`, que abre o banco do `.env` quando falta `DATABASE_URL`).

---

## Sampling Rate

- **After every task commit:** o `vitest run` do arquivo tocado + `tsc --noEmit` do workspace tocado (segundos).
- **After every plan wave:** `npm run check` em Docker (≈ 4 min).
- **Before `/gsd-verify-work`:** `npm run check` verde duas vezes + `--verificar` sobre o ensaio com a cópia real.
- **Max feedback latency:** 240 segundos (o `check` completo); por tarefa, abaixo de 30 s.

---

## Per-Task Verification Map

Os ids de tarefa saem dos PLAN.md; esta tabela é o mapa por requisito, e cada linha do mapa por tarefa herda o comando da sua linha.

| Requisito | Comportamento | Test Type | Automated Command | File Exists | Status |
|-----------|---------------|-----------|-------------------|-------------|--------|
| UCR-01 | WR-01 (3 portas), WR-02 (trava do Espaço antes do Canal), WR-05, WR-06, `instantiateListTemplate` com `canais`, `operacoes.test.ts` pula sem Postgres local | integração (Docker) + unit | `cd apps/api && … npx vitest run src/servicos/crm/{conversas,negocios,empresas,canais,contatos,tarefas-conversacionais}.test.ts src/rotas/operacoes-canais-da-lista.test.ts src/rotas/operacoes.test.ts` | ✅ casos novos | ⬜ pending |
| UCR-02 | Sucessão passa as Conversas ao Sucessor; contagens; contrato na ontologia; diálogo de remover Membro | integração + unit web | `cd apps/api && … npx vitest run src/servicos/crm/sucessao.test.ts src/rotas/crm/sucessao.test.ts` · `cd apps/web && npx vitest run src/features/shell/membros-sucessao-no-crm.test.tsx` | ✅ reescrever expectativas | ⬜ pending |
| UCR-03 | `012` aplica, idempotente, tabela só-inserção; gestos gravam Atividade na mesma transação (rollback não deixa linha); `GET /atividades` por Papel e Espaço; fusão na web | integração + unit | `cd apps/api && … npx vitest run src/persistencia/migracao-012.test.ts src/servicos/crm/*.test.ts src/rotas/crm/atividades.test.ts` · `cd apps/web && npx vitest run src/dados/crm/atividades.test.ts` | ❌ W0 | ⬜ pending |
| UCR-04 | Resumo traz Empresa, qualificação, estado, Atribuído; cartão e ficha mostram; "Mesclar" só libera com o nome digitado | integração + componente | `cd apps/api && … npx vitest run src/servicos/crm/tarefas-conversacionais.test.ts` · `cd apps/web && npx vitest run src/features/estrutura/tarefa-completa-resumo.test.tsx src/features/crm/ficha-de-contato.test.tsx` | ✅ casos novos | ⬜ pending |
| UCR-05 | Caixa, fio e configurações leem e gravam por REST; nenhuma linha de `conversations` em `registros`; sem rascunho; popup só liga ao Canal | componente com cliente falso + guarda | `cd apps/web && npx vitest run src/features/crm/{inbox-columns,conversation-thread}.test.tsx src/dados/crm/{conversas,mensagens}.test.ts src/sem-crm-antigo.test.ts` | ❌ W0 | ⬜ pending |
| UCR-06 | Fichas sem recuo (404 = "não encontrado"); Reunião mostra o Negócio de `plataforma.negocios`; `/crm/meus-negocios` não existe | componente + guarda | `cd apps/web && npx vitest run src/features/crm/ficha-de-negocio.test.tsx src/features/crm/paginas-de-empresa.test.tsx src/sem-crm-antigo.test.ts` | ✅/❌ | ⬜ pending |
| UCR-07 | Busca, Lixeira, Notificações, Início, Painel e Configurações sem as coleções antigas no store; Espaço novo sem Funil padrão | unit + componente | `cd packages/dominio && npx vitest run src/derive-resumo.test.ts src/bootstrap-gestao.test.ts` · web idem | ✅ reescrever | ⬜ pending |
| UCR-08 | Ferramentas com ids de `plataforma.canais`/`plataforma.contatos` (inclui criar Contato de Participante); IA e Contas a receber idem | unit + integração | `cd packages/dominio && npx vitest run src/operations/ferramentas src/operations/ia src/operations/contas-a-receber.test.ts` · `cd apps/api && … npx vitest run src/importacao/clickup/importar-contas-a-receber.test.ts` | ✅ reescrever | ⬜ pending |
| UCR-09 | Script: `--seco` read-only; `--guardar` copia e confere a contagem antes de apagar; migrar insere na ordem das FKs; Empresa sem admin vai ao relatório; segunda execução não muda nada; `--verificar` | integração (Docker, `describeComBanco`) | `cd apps/api && … npx vitest run src/migracao-crm/` | ❌ W0 | ⬜ pending |
| UCR-10 | Ensaio sobre a cópia real: contagens-base (2128 linhas, 18 Espaços), `hidratar` por Espaço sem coleção antiga | manual (Docker + cópia em `~/n1-ensaio`) | passos do `14-ENSAIO.md` + `--verificar` | ❌ manual | ⬜ pending |
| UCR-11 | Seed sem CRM antigo; Espaço novo com CRM vazio; `bootstrap:crm-demo` carrega num Postgres migrado e os Vínculos do seed apontam para ids existentes | unit + integração | `cd packages/dominio && npx vitest run src/seed*.test.ts` · `cd apps/api && … npx vitest run src/bootstrap/crm-demo.test.ts` | ❌ W0 | ⬜ pending |
| UCR-12 | `npm run typecheck` verde sem as coleções; `sem-crm-antigo` vazio (salvo Grupo/Flow); 404 para as 45 operações antigas; contagem 285 → 240 (reconferir); `sem-listas-espelho` atualizadas | unit (leitura de código) + tsc | `npm run typecheck` · `cd apps/api && … npx vitest run src/rotas/esquemas-de-argumentos.test.ts src/sem-crm-antigo.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/persistencia/migracao-012.test.ts` — UCR-03
- [ ] `apps/api/src/rotas/crm/atividades.test.ts`, `apps/api/src/servicos/crm/atividades.test.ts`, `apps/web/src/dados/crm/atividades.test.ts` — UCR-03
- [ ] `apps/web/src/dados/crm/{conversas,mensagens}.test.ts` (molde `contatos.test.ts`) — UCR-05
- [ ] `apps/api/src/migracao-crm/*.test.ts` + fixture JSON congelado do CRM antigo — UCR-09
- [ ] `apps/api/src/bootstrap/crm-demo.test.ts` — UCR-11
- [ ] `sem-crm-antigo.test.ts` nas três camadas (molde `sem-listas-espelho.test.ts`) — UCR-12
- [ ] `rotas/esquemas-de-argumentos.test.ts:126` (285 → contagem nova) atualizado junto com a remoção — UCR-12

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dono aprova o relatório `--seco` (Funil do `ws_n1`, não migrados, Pasta "Meus negócios") | UCR-09 | Decisão do dono (D-15-03, D-15-04, D-15-14); nenhuma escrita em produção antes dela | Rodar `npm run migrar:crm-antigo -w @n1/api -- --espaco ws_n1 --seco` e colar o relatório ao dono |
| Ensaio do script com a cópia real dos dados | UCR-10 | Os dados reais ficam em `~/n1-ensaio` no notebook do dono; não há homologação | Seguir `14-ENSAIO.md`: Postgres 16 em Docker, 001 a 012, `\copy`, `--seco`, migrar, `--verificar`, `hidratar` por Espaço |
| Corte em produção na janela combinada | UCR-09, UCR-12 | Procedimento de deploy com backup manual, API na VM e web no push (D-15-03) | Backup `pg_dump -Fc --schema=plataforma` restaurado e conferido em Docker → `--seco` → relatório aprovado → script → `publicar.sh` → push em `main` do n1 |
| Olhar cada tela migrada | UCR-04..08 | `human_verify_mode: end-of-phase` | `npm run dev` apontado para um Postgres local migrado; percorrer 3.4.1 a 3.4.10 |
| Provas manuais pendentes da Fase 14 (14-11, 14-12, 14-15, 14-16) | UCR-04, UCR-05 | Só fazem sentido depois da troca das telas | Lista em `14-PROVAS.md` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 240s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
