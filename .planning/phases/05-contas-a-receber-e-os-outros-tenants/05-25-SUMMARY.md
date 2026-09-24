---
phase: 05-contas-a-receber-e-os-outros-tenants
plan: 25
subsystem: operacao
tags: [contas-a-receber, relogio, scheduler, r7, wr-11, checkpoint, pre-voo]

# Dependency graph
requires:
  - phase: 05-contas-a-receber-e-os-outros-tenants
    provides: "05-10 — evolver de CR, prazos de R4/R5, R7 com Valor > 0 (garantirSaqueRecorrente); a Task 4 de 05-10 é o que este plano executaria"
  - phase: 05-contas-a-receber-e-os-outros-tenants
    provides: "05-11 — 240 Contas a receber importadas em ws_n1, MARCO_ZERO 2026-09-24"
  - phase: 05-contas-a-receber-e-os-outros-tenants
    provides: "05-13 — barreira WR-11: Tarefa importada nunca dispara gatilho temporal anterior ao dia da importação"
  - phase: 05-contas-a-receber-e-os-outros-tenants
    provides: "05-17 — evento de Canal derivado dentro de executar(); 05-22 — nenhuma Data de pagamento a corrigir"
provides:
  - "Pré-voo somente-leitura do relógio de Contas a receber contra ws_n1, com a simulação da primeira volta: executadas 0 / falhadas 0 / puladas 717 — os 717 pares (Tarefa importada × Automação temporal) já vencidos são TODOS barrados por WR-11"
  - "Decisões do dono registradas: R7 adiado; relógio adiado (Critério 3 preparado e barrado por PERS-08/D-15)"
affects: [REC-01, "Critério 3 da Phase 05 (relógio de Contas a receber) — segue aberto por decisão"]

key-files:
  created: []
  modified: []

key-decisions:
  - "R7 adiado pelo dono (2026-09-24, resposta verbatim: \"Adiar R7\"). Nenhuma Tarefa de Saque recorrente criada; nenhum comando contra ws_n1."
  - "Relógio adiado pelo dono (2026-09-24, resposta verbatim: \"Adiar o relógio (Recomendado)\"). Motivo: nenhum processo do apps/api roda o scheduler em produção (PERS-08) e nenhum Membro ocupa o Papel Agente do pipeline em ws_n1 (D-15, pendência de 03-08). Nenhum automacoes:liberar, nenhum worker ligado."

requirements-completed: []

duration: ~40min (inclui um executor que travou no watchdog de 600s)
completed: 2026-09-24
---

# Phase 05 Plan 25: Relógio de Contas a receber — pré-voo feito, relógio e R7 adiados pelo dono

**A primeira volta do relógio não tocaria em nada do histórico importado — 717 de 717 pares barrados por WR-11 —, mas o relógio não liga: não há processo de scheduler em produção nem Agente do pipeline em ws_n1, e o dono adiou.**

## Execução

O executor de 05-25 travou no watchdog de 600s sem saída, depois de escrever o script
descartável de pré-voo e antes de rodá-lo; não houve commit nem escrita. O orquestrador leu o
script inteiro (somente `select`s e uma hidratação dentro de `begin`/`rollback`), rodou-o no
checkout principal em 16s (`===EXIT=0===`) e apagou-o, como a Task 1 manda. O travamento foi
do agente, não da consulta.

## Task 1 — pré-voo somente-leitura (resultado verbatim, resumido)

| Item | Resultado |
|---|---|
| Agenda de `ws_n1` | 1 linha: `lst_contas_a_receber · concluido · MARCO_ZERO`. Nenhuma linha `ENSAIO_PRIMEIRA_VOLTA`; nenhuma em `lst_contas_a_pagar`. |
| Ator (`resolverMembroAgenteDoPipeline("ws_n1")`) | **NÃO resolve** — nenhum Membro ocupa `rol_sp_agente_pipeline` em ws_n1. |
| R7 | 9 Tarefas tipo Saque em `lst_contas_a_receber`, 0 com `recurrence`. |
| Tarefas top-level em `lst_contas_a_receber` | 240 |
| Simulação de `runScheduledAutomations` (Ator: `mem_maryane`, administradora da Lista, usada **só** para medir) | executed=0 · failed=0 · skipped=717 · failures=0 |
| Barreira WR-11 em `lst_contas_a_receber` | pares elegíveis (já vencidos)=717 · pulados pela barreira=717 |
| Barreira WR-11 em `lst_contas_a_pagar` | 0 Tarefas, 0 pares |

## Achado fora do escopo (não corrigido)

`catalogoDeListasComAgenda` (a mesma consulta do scheduler-worker) lista, além de `ws_n1`,
**14 Espaços de teste com Automações temporais ativas no Postgres de produção**:
`ws_outbox_*` (9), `ws_spike`, `ws_spike_10x`, `ws_debug_automations`,
`ws_teste_classificacoes_*`, `ws_teste_integracao_solicitacoes_*` — cada um com
`lst_contas_a_pagar` e `lst_contas_a_receber`. Nenhum tem linha na agenda hoje. Um worker ligado
contra este banco criaria agenda e rodaria Automação nesses Espaços também. A limpeza de
05-19 cobriu `integration_outbox`/`automacao_agenda`, não `plataforma.registros`/`workspaces`
dos Espaços de teste antigos. Antes de ligar qualquer worker em produção: remover esses
Espaços (operação escopada com dry-run, no molde de `outbox:limpar-testes`) ou filtrar o
catálogo do worker por Espaço.

## Task 2 — R7

Adiado pelo dono ("Adiar R7"). Nada aplicado.

## Task 3 — ligar o relógio

Pré-condições do passo 1 ausentes (sem processo de scheduler em produção, sem Ator). O dono
escolheu adiar ("Adiar o relógio (Recomendado)"). Critério 3 fica **preparado e barrado por
PERS-08/D-15**: o motor, a barreira do histórico e o MARCO_ZERO estão prontos e provados pela
simulação; falta o processo em produção, o Agente do pipeline e — pelo achado acima — a limpeza
dos Espaços de teste. Nenhum `automacoes:liberar` foi executado.

## Deviations

- Execução do pré-voo pelo orquestrador depois do travamento do executor (o script foi lido por
  inteiro antes; somente leitura).

## Self-Check: PASSED

- Script descartável removido (`git status` sem `_preflight-relogio-cr-05-25.ts`).
- Nenhuma escrita em ws_n1; nenhum commit de código (o plano não versiona arquivo).
