---
phase: 07-crm-contatos-empresas-funis-e-negocios
plan: 13
subsystem: database, docs, uat
tags: [migracoes, 007-crm, seco, dry-run, d-12, banco-da-plataforma, provas, uat, end-of-phase, windows]

requires:
  - phase: 07-crm-contatos-empresas-funis-e-negocios
    provides: "07-05: a 007 corrigida (trigger admin x lixeira) commitada; 07-12: migracoesPendentes() e npm run migrar -- --seco provados como leitura pura, o e2e crm-fluxo.test.ts e o portao da fase com a ressalva das duas falhas pre-existentes (deferred-items.md, WINDOWS #5)"
provides:
  - ".planning/phases/07-.../07-PROVAS.md: a conferencia seca de D-12 (1 pendente: 007-crm.sql), a aplicacao da 007 no banco da plataforma (984 ms) e a confirmacao seca depois (0 pendentes), as tres saidas verbatim do mesmo dia (2026-10-11)"
  - "07-PROVAS.md 'Roteiro da UAT': 8 passos (Funil padrao D-13, Contato, Empresa com admin D-08, Negocio no quadro com a Regra do Funil D-05 e reabrir D-14, recusa de Contato admin D-09, Funil com Negocios -> migrar -> Lixeira -> restaurar D-07, Membro so leitura D-14, Busca global com os registros antigos D-15) com Resultado em branco, mapeados as janelas #1-#4 do WINDOWS.md"
  - "07-PROVAS.md 'Limitacoes aceitas': D-15 (Busca, Lixeira antiga, Notificacoes, Meus-negocios, Caixa de Entrada), Registro de Atividade ausente (A9), escopo proprios/Funil privado (D-10), Importar Contatos fora da lista nova, portao com ressalva (#5), T-02-TLS no notebook"
  - "A 007 esta em plataforma.migracoes do banco da plataforma: qualquer ajuste de schema do CRM daqui em diante e 008"
affects: [unificacao-do-crm, verify-phase-07, gsd-ship, financeiro]

actuals:
  tokens: 3686
  tasks: 2
  commits: 1
plan_head_before: ebf51084605fc477b7d1d162c00adf1d5ad957cb
plan_head_after: 9b25ac68d58cfe69a0d9429b3f8e2d62f214806c

tech-stack:
  added: []
  patterns:
    - "Migracao em producao em tres saidas coladas: --seco antes (o que seria aplicado), migrar pelo dono (gate blocking-human), --seco depois pelo agente (0 pendentes) — nenhuma delas com segredo, a linha [conexao] mantida verbatim"
    - "Arquivo de provas da fase (0N-PROVAS.md) no molde de 06-PROVAS.md: estado do relato com data, ponto de partida do codigo, uma secao por prova com tabela Criterio | Resultado, roteiro humano com Resultado em branco e 'Fica com o dono'"

key-files:
  created:
    - .planning/phases/07-crm-contatos-empresas-funis-e-negocios/07-PROVAS.md
  modified: []

key-decisions:
  - "A Task 1 (checkpoint:human-action, gate blocking-human) foi respondida pelo dono em 2026-10-11 (UTC) com as duas saidas verbatim, recebidas pelo orquestrador; o agente nao rodou npm run migrar sem --seco em momento nenhum — a aplicacao em producao e passo do dono (T-07-38)"
  - "A confirmacao seca da Task 2 rodou de verdade contra o banco da plataforma (o classificador nao recusou o --seco, somente leitura por contrato de 07-12): 001-007 aplicadas, 0 pendente(s) — nao foi preciso recorrer so as saidas do dono como evidencia"
  - "O roteiro da UAT nomeia qual janela do WINDOWS.md cada passo fecha (#1 Contatos, #2 Empresas, #3 quadro, #4 ficha de Negocio) para que o fechamento das janelas apos a UAT seja mecanico; a janela #5 (portao com duas falhas pre-existentes) fica como decisao aberta do dono, nao como item do roteiro"
  - "'Limitacoes aceitas' inclui tambem a linha [conexao] DATABASE_SSL_INSECURE=true (T-02-TLS, Fase 2) porque ela aparece nas tres saidas e alguem lendo as provas precisa saber que nao e desta fase"
  - "Commits em main por decisao do orquestrador (branching_strategy: none), como em 07-01..07-12"

patterns-established:
  - "Depois de 'aplicada  007-crm.sql' em plataforma.migracoes, o arquivo e imutavel: ajuste de schema do CRM = 008-*.sql"

requirements-completed: [CRM-V1, CRM-W1, CRM-W2]

duration: 2 min (continuacao apos o checkpoint da Task 1, respondido pelo dono)
completed: 2026-10-11
status: complete

coverage:
  - id: D1
    description: "Conferencia de D-12 antes do primeiro migrar com a 007 (1 pendente: 007-crm.sql, 001-006 aplicadas) e aplicacao da 007 no banco da plataforma pelo dono (aplicada  007-crm.sql  (984 ms)), as duas saidas registradas em 07-PROVAS.md"
    requirement: CRM-V1
    verification:
      - kind: manual_procedural
        ref: "saida do dono, passo 1: 'pendente  007-crm.sql' presente e 'aplicada  007-crm.sql' ausente; passo 2: 'aplicada  007-crm.sql  (984 ms)' (Task 1 acceptance_criteria)"
        status: pass
      - kind: other
        ref: "grep -c 'pendente  007-crm.sql' 07-PROVAS.md -> 2; grep -c 'aplicada  007-crm.sql' 07-PROVAS.md -> 5"
        status: pass
    human_judgment: false
  - id: D2
    description: "Confirmacao somente-leitura depois da aplicacao: npm run migrar -w @n1/api -- --seco contra o banco da plataforma lista 001-007 como aplicada e '0 pendente(s); nada foi aplicado (--seco).'"
    requirement: CRM-V1
    verification:
      - kind: other
        ref: "npm run migrar -w @n1/api -- --seco (2026-10-11T16:52:32Z, main@ebf5108) -> 7 linhas 'aplicada', nenhuma 'pendente', '0 pendente(s); nada foi aplicado (--seco).'"
        status: pass
    human_judgment: false
  - id: D3
    description: "07-PROVAS.md existe com as cinco secoes (Conferencia de D-12, Aplicacao, Confirmacao, Roteiro da UAT, Limitacoes aceitas) e registra a aplicacao da 007"
    requirement: CRM-V1
    verification:
      - kind: other
        ref: "test -f 07-PROVAS.md && grep -c 'aplicada  007-crm.sql' 07-PROVAS.md -> 5 (Task 2 <automated>); grep '^## <secao>' x5 -> PASS (acceptance_criteria)"
        status: pass
    human_judgment: false
  - id: D4
    description: "UAT do CRM no app real (web 3001 + api 3002 contra o banco da plataforma com a 007): os 8 passos do roteiro — Funil padrao, Contato, Empresa com admin, Negocio no quadro com a Regra do Funil e reabrir, recusa de Contato admin com links, Funil com Negocios -> migrar -> Lixeira -> restaurar, Membro so leitura, Busca global com os registros antigos"
    requirement: CRM-W1
    verification: []
    human_judgment: true
    rationale: "Depende de JWT real do Supabase, do navegador e do banco da plataforma — nenhum teste automatizado desta base tem as tres coisas juntas (07-VALIDATION.md, Manual-Only Verifications). O mesmo fluxo esta provado por app.inject contra Postgres local (crm-fluxo.test.ts, 07-12) e as telas por teste de componente com fetch falso; o que falta e o navegador real, no lote de fim de fase (human_verify_mode = end-of-phase). E o que fecha as janelas #1-#4 do WINDOWS.md"
  - id: D5
    description: "Quadro de Negocios no app real: arrastar = mover (passo 4), Ganhar sem valor recusado e com valor aceito, Reabrir — e o Reabrir desabilitado para o Membro (passo 7)"
    requirement: CRM-W2
    verification: []
    human_judgment: true
    rationale: "Mesmo motivo de D4: o arrasto no navegador real e a sessao real de Membro so se provam no lote de UAT; por app.inject o mover/ganhar/reabrir ja esta em crm-fluxo.test.ts (07-12)"
---

# Phase 7 Plan 13: Aplicação da 007 no banco da plataforma com a conferência de D-12 e o roteiro da UAT Summary

**A 007 está no banco da plataforma do jeito que D-12 decidiu — `--seco` antes (1 pendente: `007-crm.sql`), `migrar` pelo dono (984 ms), `--seco` depois pelo agente (0 pendentes) — com as três saídas em `07-PROVAS.md`, mais o roteiro de 8 passos da UAT de fim de fase mapeado às janelas #1–#4 do `WINDOWS.md` e as seis limitações aceitas da fase.**

## Performance

- **Duration:** 2 min de execução do agente nesta continuação (a Task 1 ficou com o dono, fora do relógio do agente)
- **Started:** 2026-10-11T16:52:29Z (continuação, Task 2)
- **Completed:** 2026-10-11T16:54:54Z
- **Tasks:** 2 (1 checkpoint humano respondido + 1 auto)
- **Files modified:** 1 (criado: `07-PROVAS.md`, 212 linhas); nenhum código mudou, como o plano previa

## Accomplishments

- **D-12 cumprida e provada.** O dono rodou `npm run migrar -w @n1/api -- --seco` no checkout principal antes do primeiro `migrar` com a 007: `001`…`006` `aplicada`, `pendente  007-crm.sql`, `1 pendente(s); nada foi aplicado (--seco).` — a 007 nunca tinha sido aplicada, então a correção do trigger (07-05) seguiu como `007` e não precisou virar `008`. Em seguida `npm run migrar -w @n1/api` imprimiu `aplicada  007-crm.sql  (984 ms)`. As duas saídas estão verbatim em `07-PROVAS.md` ("Conferência de D-12", "Aplicação"), com a linha `[conexao] DATABASE_SSL_INSECURE=true` mantida porque faz parte da saída real.
- **Confirmação somente-leitura feita de verdade.** O agente rodou o `--seco` contra o banco da plataforma depois da aplicação (2026-10-11T16:52:32Z): as sete migrações `aplicada`, `0 pendente(s); nada foi aplicado (--seco).`. O ambiente não recusou nem a conexão nem o comando, então as saídas do dono não precisaram servir de única evidência. O `migrar` sem `--seco` não foi rodado pelo agente em momento algum.
- **O roteiro da UAT está pronto para o lote de fim de fase.** Oito passos com colunas Passo | Esperado | Resultado (em branco), com pré-condições (dois logins reais no mesmo Espaço, `npm run dev`, recarregar depois de cada gravação) e o mapeamento explícito para as janelas `unrun-verify` #1 (Contatos), #2 (Empresas), #3 (quadro) e #4 (ficha de Negócio) do `WINDOWS.md` — o resultado da UAT é o que as fecha.
- **As limitações da fase estão escritas num lugar só.** D-15 (as cinco superfícies no modelo antigo), Registro de Atividade ausente (A9), escopo `próprios`/Funil privado (D-10), "Importar Contatos" fora da lista nova (grava no `Contact` do store em memória), o portão `npm run check` com as duas falhas pré-existentes (janela #5, decisão aberta do dono) e o `DATABASE_SSL_INSECURE=true` do notebook (T-02-TLS, Fase 2).

## Task Commits

1. **Task 1: Conferir `plataforma.migracoes` e aplicar a 007 no banco da plataforma (D-12)** — `checkpoint:human-action`, gate `blocking-human`, respondido pelo dono em 2026-10-11 (UTC) com as duas saídas; nenhum commit (não há código nem arquivo do agente nesta task — a evidência é o texto colado, registrado na Task 2).
2. **Task 2: Confirmação somente-leitura, registro das provas e o roteiro da UAT** — `9b25ac6` (docs)

**Plan metadata:** ver o commit `docs(07-13): complete ...` (SUMMARY, STATE, ROADMAP, REQUIREMENTS).

## Files Created/Modified

- `.planning/phases/07-crm-contatos-empresas-funis-e-negocios/07-PROVAS.md` — as cinco seções do plano: "Conferência de D-12" (saída do passo 1 do dono + tabela de critérios), "Aplicação" (saída do passo 2), "Confirmação" (a saída seca do agente, 0 pendentes), "Roteiro da UAT" (8 passos, mapeamento às janelas #1–#4) e "Limitações aceitas" (seis itens + "Fica com o dono"). Abre com o que o `--seco` faz de verdade, lido de `migrar.cli.ts`/`migrar.ts`.

## Decisions Made

Ver `key-decisions` no frontmatter. A que pesa daqui em diante: a 007 está em `plataforma.migracoes` e é imutável — qualquer ajuste de schema do CRM é `008`.

## Deviations from Plan

None - plan executed exactly as written. A alternativa prevista no plano para a Task 2 (o ambiente recusar a conexão e as saídas do dono virarem a única evidência) não foi necessária: o `--seco` rodou e confirmou.

**Total deviations:** 0.
**Impact on plan:** nenhum.

## Issues Encountered

- Nenhum. O `--seco` levou ~3 s contra o banco da plataforma; o commit passou pelos hooks sem ajuste.

## Known Stubs

Nenhum: este plano não cria código. A coluna "Resultado" do roteiro da UAT está em branco por desenho (é preenchida na UAT), não é placeholder de implementação.

## Threat Flags

Nenhuma superfície nova. T-07-38 (aplicação da 007 em produção) foi mitigada como o registro pede: `--seco` antes, parada prevista se a 007 constasse como aplicada (não aconteceu), aplicação pelo dono atrás do gate `blocking-human`, confirmação somente-leitura depois. T-07-39 (tabelas novas no schema `plataforma`) segue aceita no mesmo regime de `registros`. Nenhum segredo nas saídas coladas (sem `DATABASE_URL`, host ou senha); a linha `[conexao]` só diz que `DATABASE_SSL_INSECURE=true` está ligado neste notebook.

## User Setup Required

None - no external service configuration required. O passo humano desta fase (a aplicação da 007) já foi feito pelo dono na Task 1.

## Next Phase Readiness

- **A fase está pronta para a verificação de fim de fase** (verificador, revisão de código, regressão) e, depois dela, para a UAT pelo roteiro de `07-PROVAS.md` no app real — o lote `end-of-phase` que fecha as janelas #1–#4 do `WINDOWS.md`.
- **Decisão aberta do dono:** a ressalva do portão `npm run check` (duas falhas pré-existentes fora do CRM — `deferred-items.md`, janela #5). Aceitar para a fase ou corrigir antes de fechar.
- **Para a fase de unificação:** D-15 (Busca, Lixeira antiga, Notificações, Meus-negócios, Caixa de Entrada), Registro de Atividade das ações de CRM, escopo `próprios`/Funil privado, "Importar Contatos" no modelo novo, e a aposentadoria do modelo em inglês. Qualquer schema novo é `008`.
- `CRM-V1`, `CRM-W1` e `CRM-W2` declarados por este plano (o último da fase): todos os planos irmãos têm SUMMARY, então `requirements.ready-ids` pode liberá-los.

---
*Phase: 07-crm-contatos-empresas-funis-e-negocios*
*Completed: 2026-10-11*

## Self-Check: PASSED

`07-PROVAS.md` e `07-13-SUMMARY.md` presentes em disco; commit `9b25ac6` ancestral de HEAD; `commits: 1` medido de `plan_head_before` (`ebf5108`) até `plan_head_after` (`9b25ac6`).
