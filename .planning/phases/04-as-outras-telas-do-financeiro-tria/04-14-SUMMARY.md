---
phase: 04-as-outras-telas-do-financeiro-tria
plan: 14
subsystem: infra
tags: [supabase, rls, migrations, runbook, vercel, cut-over]

# Dependency graph
requires:
  - phase: 04-as-outras-telas-do-financeiro-tria
    provides: "As oito leituras do Financeiro dentro do CRM N1 (04-06, 04-08, 04-11, 04-12, 04-13) — o pré-requisito de D4-16 etapa 1"
provides:
  - "O runbook do corte (docs/08-migracao-financeiro/06-runbook-corte-painel-financeiro.md), com o inventário de policies, as duas queries de verificação de RLS prontas, e os grep de prova para cada rota legada"
  - "A migração 20261001120000_remove_anon_read_painel.sql, escrita e commitada no repositório financeiro-tria — mas NÃO aplicada a nenhum banco"
affects: [futuro-plano-de-corte, financeiro-tria-cutover]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Migração SQL idempotente no molde do laço `do $$ ... to_regclass ...` já usado por 20260525190000", "Banner NOT YET APPLIED em comentário SQL para distinguir arquivo escrito de mudança aplicada"]

key-files:
  created:
    - docs/08-migracao-financeiro/06-runbook-corte-painel-financeiro.md
    - ../financeiro-tria/supabase/migrations/20261001120000_remove_anon_read_painel.sql
  modified: []

key-decisions:
  - "Execução PREPARE-ONLY por decisão explícita do usuário num checkpoint: preparar os dois artefatos documentais/SQL, não tocar em Vercel, rotas legadas, AuthContext ou banco de dados."
  - "A policy de conciliador_contas tem nome com espaços ('anon read conciliador_contas'); a migração de remoção trata esse caso à parte, com aspas duplas, para não deixá-la sobrevivendo a um drop policy genérico."
  - "transacoes e produtos_cadastrados_emissao_notas ficam com a alteração de RLS COMENTADA na migração até o resultado real da consulta ao Postgres ser colado no runbook — não se assume relrowsecurity nem se inventa resultado."

patterns-established:
  - "Grep de prova registrado ANTES de qualquer remoção de rota, com a saída literal colada no runbook — nunca 'confiamos que ninguém chama'."

requirements-completed: []

# Metrics
duration: ~50min
completed: 2026-09-23
---

# Phase 4 Plan 14: Runbook e migração do corte — PREPARE-ONLY Summary

**Runbook do corte escrito e migração `anon_read` autorada e commitada no `financeiro-tria` — nenhum dos dois aplicado; Vercel, rotas legadas e `AuthContext` intocados por decisão do usuário.**

## Escopo desta execução — LEIA ANTES DE ASSUMIR QUE O PLANO ESTÁ FEITO

O plano 04-14 (`autonomous: false`) tem quatro tasks, todas checkpoints
humanos ou dependentes de acesso que o executor não tem (Vercel, Supabase
Studio, `supabase db push`). O usuário foi apresentado ao que o plano faz
inteiro e escolheu explicitamente, num checkpoint prévio ao início desta
sessão: **"Prepare only, stop before irreversible."**

Como resultado, **apenas dois dos sete `files_modified` do plano foram
tocados** — os dois que são seguros de criar sem tocar produção. Os outros
cinco (`routes.ts`, `plano-contas-routes.ts`, `workflow-routes.ts`,
`server.ts`, `AuthContext.tsx`) ficaram **byte-idênticos** ao estado anterior
a esta sessão — verificado com `git diff --stat`, abaixo.

**Nenhuma das quatro tasks do plano foi marcada como concluída.** Este
SUMMARY documenta o que foi preparado, não o fechamento do plano.

## O que foi feito

1. **`docs/08-migracao-financeiro/06-runbook-corte-painel-financeiro.md`**
   (crm-n1, 278 linhas) — o roteiro do corte, com:
   - As cinco etapas de D4-16 (condição de entrada, ação, rollback), com a
     etapa 4 marcada como o ponto de não retorno.
   - O inventário completo das 11 policies a remover, lido diretamente das
     migrations do `financeiro-tria` — incluindo a de `conciliador_contas`,
     cujo nome real tem espaços (`anon read conciliador_contas`), que um
     `drop policy anon_read` literal não alcançaria.
   - As duas consultas `pg_class`/`pg_policies` prontas para copiar e colar
     no Supabase Studio, com um bloco claramente marcado como AGUARDANDO
     EXECUÇÃO — nenhum resultado foi inventado ou assumido.
   - Os `grep` de prova, com saída real colada, para cada rota candidata a
     remoção (`/automation/runs*`, `/financeiro/solicitacoes*`,
     `plano-contas-routes.ts` inteiro, `workflow-routes.ts` inteiro),
     incluindo a confirmação extra que o Passo 2 da Task 3 exige: o cron de
     `server.ts` chama `markSeteDias()`/`emitirNotas()` direto, nunca através
     de `workflow-routes.ts`.
   - O risco residual registrado (`POST /webhook/receber-whatsapp-doc/:origem`
     continua público, é o path do n8n).
   - Um checklist de saída e uma tabela "quem faz o quê", ambos com tudo
     marcado como pendente exceto a etapa 1 (já feita pelas Ondas 1-5).

2. **`../financeiro-tria/supabase/migrations/20261001120000_remove_anon_read_painel.sql`**
   (financeiro-tria, commit `3860ed4`, 101 linhas) — a migração de remoção,
   idempotente no molde de `20260525190000`:
   - Quatro `drop policy if exists anon_read` diretas.
   - Um laço `do $$` com `to_regclass` para as seis
     `conciliador_contas_pagar_*`, pulando as que não existirem.
   - Um `drop policy if exists "anon read conciliador_contas"` — com aspas e
     espaços, o nome real.
   - Duas linhas `alter table ... enable row level security` para
     `transacoes`/`produtos_cadastrados_emissao_notas`, **comentadas**, para
     usar somente se a verificação do runbook confirmar `relrowsecurity =
     false`.
   - Um banner `NOT YET APPLIED` no cabeçalho, listando os cinco
     pré-requisitos de D4-16 e seu estado real (feito/não feito).
   - **Este arquivo não foi aplicado a nenhum banco.** `supabase db push` não
     foi executado; nenhuma consulta rodou contra o Postgres do
     `financeiro-tria`.

## O que NÃO foi feito, e quem faz cada parte

| Pendência | D4-16 etapa | Dono |
|---|---|---|
| Uma semana de uso real das oito leituras + confirmação nominal do Financeiro | 2 | Financeiro / dono do produto |
| Pausar `financeiro-tria.vercel.app` (nunca deletar), confirmar `curl -I` antes/depois, registrar a data | 3 | Dono do produto (acesso à Vercel) |
| Rodar as duas consultas de RLS no Supabase Studio e colar o resultado real no runbook | pré-requisito da 4 | Dono do produto (acesso ao Supabase do `financeiro-tria`) |
| Remover `GET /automation/runs*`, `/financeiro/solicitacoes*`, `plano-contas-routes.ts`, `workflow-routes.ts`, os mounts órfãos em `server.ts`, e `AuthContext.tsx` | 4 | Executor, só depois das etapas 2-3 confirmadas — os `grep` de prova já estão registrados no runbook |
| Aplicar `20261001120000` com `supabase db push` e colar a prova no banco (policies ausentes em `pg_policies`, leitura com chave `anon` recusada) | 4 | Dono do produto ou executor com credencial |
| `npm run check` verde nos três workspaces, re-verificado no dia | 5 | Executor |

## Verificação de que o escopo foi respeitado

```
$ cd ../financeiro-tria && git diff --stat automation/src/http/routes.ts automation/src/http/plano-contas-routes.ts automation/src/http/workflow-routes.ts automation/src/server.ts src/contexts/AuthContext.tsx
 src/contexts/AuthContext.tsx | 96 ++++++++++++++++++++++----------------------
 1 file changed, 48 insertions(+), 48 deletions(-)
```

`routes.ts`, `plano-contas-routes.ts`, `workflow-routes.ts` e `server.ts`
mostram **zero diff** — intocados por esta sessão. `AuthContext.tsx` mostra
diff, mas é uma modificação **pré-existente** (um dos 89 arquivos sujos do
worktree, confirmado por `git status --porcelain` ANTES do início desta
sessão) — não uma mudança feita aqui.

```
$ git -C ../financeiro-tria status --porcelain | wc -l
89
```

Contagem de arquivos sujos do `financeiro-tria` de volta a **89** depois do
commit da migração (era 89 antes, foi a 90 com o arquivo novo untracked, e
voltou a 89 assim que o `git add` + `git commit` absorveu exatamente esse
arquivo — nenhum dos outros 89 mudou de estado).

Nenhum comando de banco, Vercel ou `supabase` foi executado nesta sessão.

## Task Commits

Nenhuma das quatro tasks do plano foi concluída por inteiro (todas são
`checkpoint:human-verify`/`checkpoint:human-action`/dependentes de Vercel e
Supabase). Os dois commits abaixo são os artefatos preparatórios, não o
fechamento de nenhuma task:

1. **Migração `20261001120000`** (repositório `financeiro-tria`) - `3860ed4`
   (feat) - `feat(04-14): author (not apply) the anon_read removal migration`
2. **Runbook do corte** (repositório `crm-n1`) - `8b1d414` (docs) -
   `docs(04-14): write the cut runbook for financeiro-tria.vercel.app (prepare-only)`

Nenhum commit de "conclusão de plano" foi feito — o plano continua aberto,
com as quatro tasks originais pendentes na ordem que D4-16 exige.

## Files Created/Modified

- `docs/08-migracao-financeiro/06-runbook-corte-painel-financeiro.md` (crm-n1) — o runbook completo do corte
- `../financeiro-tria/supabase/migrations/20261001120000_remove_anon_read_painel.sql` (financeiro-tria) — a migração de remoção, não aplicada

## Decisions Made

- **Escopo PREPARE-ONLY**, decidido pelo usuário num checkpoint anterior a
  esta sessão: preparar os dois artefatos seguros e reversíveis, sem tocar
  Vercel, rotas legadas, `AuthContext` ou qualquer banco de dados.
- **A verificação de RLS de `transacoes`/`produtos_cadastrados_emissao_notas`
  fica em aberto**, com as duas queries prontas e um bloco claramente
  marcado para colar o resultado — nenhum resultado foi assumido.
- **A migração trata a policy de `conciliador_contas` separadamente**, por
  nome exato entre aspas, porque seu nome real tem espaços e um
  `drop policy anon_read` genérico não a alcançaria.

## Deviations from Plan

None (dentro do escopo decidido). O plano original previa quatro tasks
completas nesta execução; a execução real cobre uma fração da Task 1 (o
runbook, sem o checkpoint humano de colar o resultado de RLS) e uma fração
da Task 3 (a migração escrita, sem as remoções de código nem a aplicação).
Isso não é um desvio de regra 1-4 — é o escopo explicitamente reduzido pelo
usuário, documentado na íntegra acima, não uma correção automática.

## Known Stubs

Nenhum. Os dois arquivos criados são documentação e SQL, sem UI nem dado
renderizado.

## Threat Flags

Nenhum. Esta sessão não introduziu superfície nova — só preparou a remoção de
superfície já mapeada no `threat_model` do plano (T-4-03, T-4-37, T-4-38,
T-4-39, T-4-33, T-4-12).

## Self-Check: PASSED

- `docs/08-migracao-financeiro/06-runbook-corte-painel-financeiro.md` — FOUND (278 linhas, ≥80 exigidas)
- `../financeiro-tria/supabase/migrations/20261001120000_remove_anon_read_painel.sql` — FOUND (101 linhas, contém `drop policy` 8x, `anon read conciliador_contas` 1x, `NOT YET APPLIED` 1x)
- Commit `3860ed4` (financeiro-tria) — FOUND em `git log --oneline`
- Commit `8b1d414` (crm-n1) — FOUND em `git log --oneline`
- `../financeiro-tria/automation/src/http/routes.ts`, `plano-contas-routes.ts`, `workflow-routes.ts`, `server.ts` — CONFIRMADOS intocados (`git diff --stat` vazio)
- `git -C ../financeiro-tria status --porcelain | wc -l` — CONFIRMADO 89
