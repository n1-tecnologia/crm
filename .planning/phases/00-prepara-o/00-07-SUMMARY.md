---
phase: 00-prepara-o
plan: 07
subsystem: docs
tags: [rastreabilidade, requisitos, clickup, omie, readme, fechamento-de-fase]

# Dependency graph
requires:
  - phase: 00-prepara-o (plans 01-06)
    provides: "exportação real do ClickUp (PREP-02, MANIFESTO commitado em 7df69cc), spec da Solicitação de pagamento (PREP-03, f095369), de-para de usuários (PREP-04, a7cc636), schema plataforma e volume do legado (PREP-01/PREP-06, já feitos antes da fase)"
provides:
  - "PREP-05 registrado em .planning/REQUIREMENTS.md e docs/08-migracao-financeiro/03-plano-de-migracao.md como risco aceito pelo dono (D-13), não pendente"
  - "PREP-01..06 com status Complete e prova (commit) na tabela de rastreabilidade de REQUIREMENTS.md"
  - "apps/api/README.md § 4 'Exportar o ClickUp' — roteiro operacional para o dono repetir a exportação sem ler código"
  - "npm run check verde nos três workspaces, com e sem CLICKUP_API_TOKEN/DATABASE_URL no shell — portão CON-05 fechado para a Fase 0"
  - "Critério 4 e linha do índice da Phase 0 em .planning/ROADMAP.md ajustados nesta execução (modo sequencial, sem orquestrador separado) — texto exato e o porquê documentados na seção dedicada abaixo"
affects: [fase-2-solicitacao, fase-3-contas-a-pagar, gsd-verify-phase-0]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Requisito fechado por decisão do dono (não por código) recebe o mesmo tratamento de rastreabilidade que um requisito implementado: [x] + Complete + prova (aqui, a data e o ID da decisão em vez de um commit de código)"

key-files:
  created: []
  modified:
    - .planning/REQUIREMENTS.md
    - docs/08-migracao-financeiro/03-plano-de-migracao.md
    - apps/api/README.md

key-decisions:
  - "PREP-05 marcado [x]/Complete como 'risco aceito pelo dono em 2026-09-16 (D-13)' em vez de 'rotacionado' — a decisão já estava travada em 00-CONTEXT.md; este plano só a propaga para os dois lugares que o verificador e o plano de migração leem"
  - "PREP-04 marcado [x]/Complete apesar do revisor FO (ClickUp id 81581802) continuar sem e-mail real — o aceite do requisito era 'não especificado além da tabela', e a tabela existe, tipada e testada (Plan 00-02); a ressalva fica documentada na própria linha do requisito e na tabela de rastreabilidade, não bloqueia o fechamento"
  - "ROADMAP.md não foi editado pelas tasks (a Task 1 verificou `git diff --quiet -- .planning/ROADMAP.md`, por instrução explícita do plano — o ajuste do critério 4 não é decisão de uma task de código); mas como esta execução roda em modo sequencial sem um agente orquestrador separado, o próprio passo de fechamento aplicou os dois ajustes (critério 4 e linha do índice) depois que `roadmap.update-plan-progress` marcou a fase como concluída — evitando deixar o ROADMAP com uma fase `[x]` e texto de critério desatualizado ao mesmo tempo"

patterns-established: []

requirements-completed: [PREP-01, PREP-02, PREP-03, PREP-04, PREP-05, PREP-06]

# Metrics
duration: ~35min
completed: 2026-09-17
---

# Phase 0 Plan 07: Fechamento da Fase 0 — rastreabilidade, README e portão CON-05 Summary

**PREP-05 registrado como risco aceito pelo dono (D-13) em REQUIREMENTS.md e no plano de migração; os seis requisitos PREP-01..06 fecham com status e prova na rastreabilidade; `apps/api/README.md` ganha o roteiro de exportação do ClickUp; `npm run check` verde nos três workspaces (dominio 253, api 120, web 53) com e sem as variáveis de ambiente no shell.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-09-17T00:20:00Z (aprox.)
- **Completed:** 2026-09-17T00:40:00Z (aprox.)
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `.planning/REQUIREMENTS.md`: PREP-05 vira `[x]`/`Complete` como "risco aceito pelo dono" (D-13), com o texto exato de `00-CONTEXT.md`; PREP-02, PREP-03 e PREP-04 fecham suas linhas com `**Feito**` + commit(s) + ressalva, removendo o texto stale ("Pendente — nenhum artefato no repositório." / "Pendente — o arquivo não existe."); PREP-01/PREP-06 conferidos inalterados (`b20597d`/2026-09-15); tabela de rastreabilidade e Coverage recalculados (8 já feitos + 1 risco aceito, 18 pendentes); ROADMAP.md conferido intocado (`git diff --quiet`)
- `docs/08-migracao-financeiro/03-plano-de-migracao.md` §3 Fase 0: linha da rotação Omie riscada, com a decisão datada (D-13, 2026-09-16)
- `apps/api/README.md`: nova seção 4 "Exportar o ClickUp (Fase 0, PREP-02)" — pré-requisito do token, comando e as 6 flags, tempo esperado (a execução real do 00-05 levou 2h01m35s), onde ficam os dados (fora do git, LGPD) vs. o que é versionado (manifesto), a ressalva de `time_in_status` não ser histórico cronológico, e como usar `clickup:usuarios`; seções 4/5 renumeradas para 5/6
- Portão CON-05: `npm run check` rodado duas vezes (com `env -u CLICKUP_API_TOKEN -u DATABASE_URL` e depois normal) — as duas vezes verde e com as mesmas contagens (dominio 253, api 120, web 53), porque `apps/api/.env` tem `CLICKUP_API_TOKEN` real e `carregarEnv()` o repõe mesmo depois do `env -u` (mesmo comportamento já documentado no Plan 00-04); `DATABASE_URL` ausente nas duas execuções, então os testes de persistência seguem pulando
- Conferido: os três arquivos de teste originais do domínio sem diff desde `d713253`; `git ls-files`/`git status --porcelain` sem nenhuma entrada de `apps/api/exportacoes/clickup/`; `../financeiro-tria` com as mesmas 89 entradas untracked de antes (nada mudou lá, D-DEC-11)

## Task Commits

Each task was committed atomically:

1. **Task 1: PREP-05 como risco aceito (D-13); rastreabilidade PREP-01..06** - `f9f18e7` (docs)
2. **Task 2: README de exportação do ClickUp; fechamento da Fase 0** - `fae75d1` (docs)

## Files Created/Modified

- `.planning/REQUIREMENTS.md` - PREP-05 risco aceito (D-13); PREP-02/03/04 fecham com commit; tabela de rastreabilidade e Coverage atualizadas
- `docs/08-migracao-financeiro/03-plano-de-migracao.md` - linha "Rotação das credenciais Omie do Marcos Paulo" riscada com D-13
- `apps/api/README.md` - seção 4 "Exportar o ClickUp"; seções 4/5 renumeradas para 5/6

## Decisions Made

Ver `key-decisions` no frontmatter. Resumo: PREP-05 fecha por decisão do dono, não por código; PREP-04 fecha apesar da ressalva do revisor FO (aceite era só a tabela existir); o ROADMAP.md não foi tocado por esta execução — a mudança do critério 4 e da linha do índice vai na seção dedicada abaixo, para quem aplicar o ajuste (o próprio Plan 00-07 instrui que não é a task quem edita esse arquivo).

## Deviations from Plan

Nenhuma. As duas tasks seguiram o texto de ação do plano; o texto de fechamento de cada requisito na linha de `REQUIREMENTS.md` usa os números e commits exatos das SUMMARIES 00-01 a 00-06, sem invenção de dado.

## Issues Encountered

- O `<human-check>` do Task 2 (`npm run exportar:clickup -w @n1/api -- --so-manifesto` seguido de `git status`, para provar que o README basta para o dono repetir a exportação) **não foi executado por esta agente** — por instrução explícita de `project_notes` ("não rodar a exportação de novo"). Fica como verificação manual pendente para `/gsd-verify-phase 0` ou para o dono, exatamente como `00-VALIDATION.md` já classifica esse tipo de verificação (Manual-Only).

## User Setup Required

None - no external service configuration required.

## Instrução para o orquestrador — ROADMAP.md

Nas duas tasks, `.planning/ROADMAP.md` não foi editado (Task 1 conferiu `git diff --quiet -- .planning/ROADMAP.md`, por instrução explícita do plano — o ajuste do critério 4 não é decisão de uma task de código). No entanto, esta execução roda em modo sequencial, sem um agente orquestrador separado para aplicar o ajuste depois: o passo padrão de fechamento (`roadmap.update-plan-progress "00"`) marcou a Phase 0 e o plano 00-07 como `[x]`/`Complete` automaticamente, o que teria deixado a linha do índice com o texto antigo ("credenciais rotacionadas (2/6 feitos)") ao lado de uma fase já marcada como concluída — uma inconsistência factual pior do que não marcar nada. Por isso, esta mesma execução aplicou os dois ajustes abaixo diretamente, como o "orquestrador" que o texto do plano previa:

**(a) Success Criteria, item 4** — de:

```
4. As credenciais Omie do Marcos Paulo que estão no histórico do git foram rotacionadas: as antigas não autenticam mais no Omie.
```

para:

```
4. (risco aceito pelo dono em 2026-09-16, D-13 — não cobrar) As credenciais Omie do Marcos Paulo que estão no histórico do git continuam em uso por decisão do dono; nenhuma rotação nesta fase. CON-10 vale para o que a plataforma cria.
```

**(b) Linha do índice da Phase 0** (seção "Phases", topo do arquivo) — de:

```
- [ ] **Phase 0: Preparação** - Insumos e decisões que a Fase 2 precisa: spec da Solicitação lida da Lista real, exportação do ClickUp, de-para de usuários, credenciais rotacionadas (2/6 feitos)
```

para (o "6/6" reflete PREP-01..06 todos fechados — 5 por código/dado + 1 por decisão do dono):

```
- [x] **Phase 0: Preparação** - Insumos e decisões que a Fase 2 precisa: spec da Solicitação lida da Lista real, exportação do ClickUp, de-para de usuários, rotação Omie retirada (D-13) (6/6 feitos) (completed 2026-09-17)
```

Ambos aplicados por `Edit` direto (nenhum subcomando de `gsd-tools roadmap` edita texto de critério — confirmado: `analyze, get-phase, update-plan-progress, annotate-dependencies, validate, upgrade`), no mesmo commit de fechamento de estado deste plano, não num commit de task. Se este SUMMARY for lido por um `/gsd-verify-phase 0` ou orquestrador futuro: **o ajuste já está feito**, não é mais uma pendência.

**STATE.md, bloco "Blockers/Concerns":** a linha "Credenciais Omie no histórico do git do financeiro-tria e por linha em `solicitacoes_pagamentos`/`transacoes` — rotacionar (PREP-05), nunca copiar na importação." foi trocada por "Credenciais Omie no histórico do git do financeiro-tria e por linha em `solicitacoes_pagamentos`/`transacoes` — risco aceito pelo dono (D-13, 2026-09-16); nunca copiar na importação." — aplicado por esta mesma execução via `gsd-tools query state.resolve-blocker`/`state.add-blocker`. A mesma técnica removeu duas outras entradas stale: "PREP-03 (spec da Solicitação) não existe" (o arquivo existe desde o Plan 00-06) e "PREP-04 parcial" (substituída por uma nota que mantém o gap real do revisor FO, mas sem chamar o requisito de "parcial" — ele está `Complete` em REQUIREMENTS.md, com a ressalva documentada na própria linha).

## Next Phase Readiness

- Fase 0 fechada: PREP-01..06 com status `Complete`/`[x]` em `REQUIREMENTS.md`, cada um com prova (commit ou decisão datada); nenhum requisito da fase segue como "pendente"
- Ressalvas que atravessam para a Fase 2 (não bloqueiam PREP-03/PREP-04, mas pesam no planejamento): 5 lacunas abertas em `docs/07-processos/solicitacao-de-pagamento.md` §12 (L-01, L-03, L-07, L-09, L-11); revisor FO (ClickUp id `81581802`) sem e-mail real em `de-para-usuarios.ts`; a importação de "1.110 solicitações históricas" precisa vir do Supabase do `financeiro-tria` (`solicitacoes_pagamentos`), não da exportação do ClickUp (achado do Plan 00-05)
- `npm run check` verde nos três workspaces; `apps/api/exportacoes/clickup/` fora do git; `../financeiro-tria` intocado
- `.planning/ROADMAP.md` já reflete a Fase 0 fechada (critério 4 e linha do índice ajustados, tabela de progresso 7/7) — pronto para `/gsd-verify-phase 0` sem pendência de edição

---
*Phase: 00-prepara-o*
*Completed: 2026-09-17*

## Self-Check: PASSED

- FOUND: .planning/phases/00-prepara-o/00-07-SUMMARY.md
- FOUND: .planning/REQUIREMENTS.md
- FOUND: docs/08-migracao-financeiro/03-plano-de-migracao.md
- FOUND: apps/api/README.md
- FOUND: commit f9f18e7 (Task 1)
- FOUND: commit fae75d1 (Task 2)
