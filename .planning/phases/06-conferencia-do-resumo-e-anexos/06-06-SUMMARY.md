---
phase: 06-conferencia-do-resumo-e-anexos
plan: 06
subsystem: docs + provas
tags: [conferencia-do-resumo, provas, jornada, omie-real, anexo, roteiro, specs]

requires:
  - phase: 06-03
    provides: "a ponte em dois momentos, três modos, G1–G3"
  - phase: 06-04
    provides: "card, fila, pílula e os cenários cp-conferida/cp-ajuste"
  - phase: 06-05
    provides: "S5/S6 na coorte plataforma"
provides:
  - "specs e planos (docs/07, docs/08) dizendo o que o código faz: Resumo antes, Conferência, anexos, falha que volta a para pagar (RN-CP-08/09), errata da doc v2"
  - "06-PROVAS.md: testes, jornada real em modo conferencia (0 /lancar) e Omie real com anexo — as duas com autorização do dono"
affects: []

key-files:
  created:
    - .planning/phases/06-conferencia-do-resumo-e-anexos/06-PROVAS.md
  modified:
    - docs/07-processos/contas-a-pagar.md
    - docs/07-processos/solicitacao-de-pagamento.md
    - docs/08-migracao-financeiro/07-plano-de-correcoes-pos-auditoria.md
    - docs/08-migracao-financeiro/08-roteiro-de-producao-pos-correcoes.md
    - docs/08-migracao-financeiro/09-plano-conferencia-do-resumo-e-anexos.md

key-decisions:
  - "A contagem de /resolver e /lancar da prova vem de um contador independente (proxy local 127.0.0.1:4101 → 4100, só método/caminho/status), não do log do automation/: as rotas de contas a pagar só registram falhas, e o grep planejado daria zero em qualquer caso"
  - "automation/ local da prova sem watch e com PAYMENT_REQUEST_SOURCE=clickup: o worker da plataforma fica desligado e não disputa a fila de produção; crons de NF desligados; HOST=127.0.0.1"
  - "AGENTE_CONTAS_A_PAGAR_AVISAR_ID=mem_tarjrn — o único Administrador com login no ws_n1, lido só de leitura com autorização do dono"

requirements-completed: [RES-06]
requirements-advanced: [RES-01, RES-02, RES-03, RES-04]

duration: ~2h (docs e testes por agente; provas pelo orquestrador depois da autorização)
completed: 2026-09-29
---

# Phase 6 Plan 06: specs, planos e as provas — Summary

**As specs dizem o que o código faz, e as duas provas com o mundo real passaram: a
jornada em modo `conferencia` contra o `ws_n1` (Resumo no fio em 14 s, conferência
por clique, aviso do modo, ajuste com Resumo revisado em 13 s — 3 `/resolver`, 0
`/lancar`) e o `teste:omie-real --lancar --anexo` (título 5872791251 com o anexo por
`IncluirAnexo`, conferido, reaproveitado e excluído).**

## Tasks

| # | Task | Commit |
|---|---|---|
| 1 | Specs e planos (`contas-a-pagar.md` §6.3/§8/§9/§11 com RN-CP-08/09; errata da doc v2 em `solicitacao-de-pagamento.md`; `07-plano…`, `08-roteiro…` 2B e Passo 4, `09-plano…` com a nota de execução) | `d1b31ab` |
| 2 | [BLOCKING] As provas — testes (`01e310d`); jornada e Omie real com anexo, depois da autorização do dono (`e7cd790`) | `01e310d`, `e7cd790` |

## Provas (detalhe em `06-PROVAS.md`)

- **Testes:** domínio 831/831 · web 240/240 · api `automacoes/` 185 + `rotas/` 152 (0 falhas, testes de banco pulados sem `DATABASE_URL`) · contrato/ponte 142/142 · `tsc` nos três workspaces · lint 0 erros · tokens 0 falhas · contrato v1.1 igual nos dois lados (hash) · `financeiro-tria` 571/571.
- **Jornada (`conferencia`, `ws_n1`):** `RESULTADO: OK — contas: tsk_tark2y, tsk_tark3r` (N1-500, N1-501, "TESTE AUTOMATIZADO"). Linha de partida da ponte com `escopo=titulos-com:"TESTE AUTOMATIZADO" avisar=membro-indicado`. Contador: **3 `/resolver`, 0 `/lancar`**.
- **Omie real com anexo:** `RESULTADO: OK`; título `5872791251`; anexo `TESTE-AUTOMATIZADO-anexo.pdf` 1 de 1; exclusão confirmada pelo id ("não cadastrado").

## Desvios

1. **Contador independente no lugar do grep no log do `automation/`** — as rotas `/v1/integrations/contas-a-pagar/*` só logam falhas; o roteiro foi corrigido (`e7cd790`).
2. **Processos da prova sem `watch`** (`tsx src/server.ts`, `vite-node src/index.ts`) e **`PAYMENT_REQUEST_SOURCE=clickup`** no `automation/` local — nenhum worker de fundo disputando a produção.
3. **O relato de provas foi completado pelo orquestrador**, não pelo executor: os passos 2–5 exigiam autorização do dono e processos de longa duração.

## Achados (para o dono)

- **Falhas transitórias no ciclo da ponte** durante a jornada: 3 × `Query read timeout` (30 s) e 1 × timeout de conexão; a ponte se recuperou sozinha; o `/estado` da tela respondeu em ~1,6 s o tempo todo. Custo: o Resumo da segunda conta levou 61 s. Investigar antes de produção.
- **A revisão manteve a categoria** (Contas de Consumo 2.04.03) com o pedido "é prestação comercial, não ADM"; para forçar outra, citar o código no pedido (vira `codigoCategoriaConfirmado`).
- **O "ok" no fio não tem gesto na tela:** o tópico não tem "Responder" num Comentário, e a ponte só lê respostas ao Resumo. A conferência por comentário está provada por teste (domínio e ponte), não pela tela.
- **"Marcar como paga"** continua habilitado em "para pagar" e "em lançamento omie" (item aberto anterior à fase).
- **Modo `lancar` pela ponte, de ponta a ponta com o Omie real,** não rodou: é o passo 2B do roteiro, com o dono.

## Self-Check: PASSED

- `06-PROVAS.md` tem "Testes", "Jornada (modo conferência)", "Omie real com anexo", "Fica com o dono"; `RESULTADO: OK` da jornada e a contagem `/lancar` = 0 colados.
- Aceites da Task 1: `Conferência` 20× em `contas-a-pagar.md`; `RN-CP-08|RN-CP-09` 3; `conferencia` 13× no roteiro; `errata` 1.
