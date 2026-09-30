---
phase: 06-conferencia-do-resumo-e-anexos
plan: 15
subsystem: docs + provas (fechamento)
tags: [conferencia-do-resumo, provas, jornada, responder-no-fio, omie-real, listar-anexo, gap-closure]
gap_closure: true

requires:
  - phase: 06-07
    provides: "anexos seguros e honestos no /lancar (v1.2)"
  - phase: 06-08
    provides: "/resolver e /lancar só aceitam o que é certo"
  - phase: 06-09
    provides: "S5 fora do turno do webhook"
  - phase: 06-10
    provides: "S5 relê pela porta, textos fixos"
  - phase: 06-11
    provides: "Conferência mais estrita no domínio"
  - phase: 06-12
    provides: "a ponte não lança de snapshot velho; 422 v1.2"
  - phase: 06-13
    provides: "timeouts do ciclo, G3 fechado, paradas persistentes, evento por processStep"
  - phase: 06-14
    provides: "Responder no fio; jornada respondendo no fio"
provides:
  - "specs, contrato, roteiro e READMEs dizendo o que o código do fechamento faz (9a79479, 0ad567e)"
  - "06-PROVAS.md: a rodada de fechamento — testes, jornada respondendo NO FIO (0 /lancar, 0 falhas de ciclo) e Omie real com anexo (ListarAnexo provado)"
affects: []

key-files:
  modified:
    - .planning/phases/06-conferencia-do-resumo-e-anexos/06-PROVAS.md
    - docs/07-processos/contas-a-pagar.md
    - docs/07-processos/solicitacao-de-pagamento.md
    - docs/08-migracao-financeiro/05-contrato-lancamento-contas-a-pagar-v1.md
    - docs/08-migracao-financeiro/07-plano-de-correcoes-pos-auditoria.md
    - docs/08-migracao-financeiro/08-roteiro-de-producao-pos-correcoes.md
    - apps/api/README.md
    - ../financeiro-tria/automation/README.md

key-decisions:
  - "O lançador da prova confere a linha de partida da ponte no formato do log (aspas escapadas pelo pino) e derruba os filhos com SIGINT — a API ignora SIGTERM; SIGKILL só de reserva e só para os processos da prova"
  - "O Omie real falhou uma vez com erro do próprio servidor (OMIE_INDISPONIVEL transitório no ListarCategorias) ANTES de qualquer gravação; a mesma operação autorizada foi repetida uma vez e passou"

requirements-completed: [RES-02, RES-06]

duration: ~1h30 (docs e testes por agente; provas pelo orquestrador depois da autorização)
completed: 2026-09-30
---

# Phase 6 Plan 15: docs e as provas de novo — Summary

**A lacuna da verificação está fechada no mundo real: o Financeiro responde "ok"
no fio do Resumo e a ponte confere (12 s), um pedido de ajuste respondido no fio
vira `🔁 Ajuste pedido` (8 s) e Resumo revisado (14 s), e a conta conferida em
"em lançamento omie" não é lançada em modo conferência — 3 `/resolver`, 0
`/lancar`, 0 falhas de ciclo (eram 4). O Omie real aceitou o anexo e, na
repetição, o `ListarAnexo` o reconheceu pelo nome, sem baixar de novo.**

## Tasks

| # | Task | Commits |
|---|---|---|
| 1 | Specs, contrato, roteiro e READMEs; esqueleto da rodada em `06-PROVAS.md` | `9a79479` (crm), `0ad567e` (financeiro-tria) |
| 2 | [BLOCKING] Testes (`d6af195`) e, com a autorização do dono, a jornada respondendo no fio e o Omie real com anexo | `d6af195` + este commit |

## Provas (detalhe em `06-PROVAS.md`, "Rodada de fechamento")

- **Testes:** `DATABASE_URL= npm run check` EXIT 0 (70 s); domínio 957/957; web 267/267; api inteira sem banco 786 passados / 205 pulados / 0 falhas; contrato `contas-a-pagar-v1` idêntico nos dois lados (27 arquivos, hash `0e5eff9a…ee57`); financeiro-tria 708/708.
- **Jornada:** `RESULTADO: OK — contas: tsk_tark4m, tsk_tark5h` — `cp-conferida` pelo "ok" no fio (`cmt_tark52`, card "por comentário"), `cp-ajuste` pelo pedido no fio (`cmt_tark5x`); contador: 3 `/resolver`, **0 `/lancar`**; **0 falhas de ciclo**.
- **Omie real com anexo:** título `5872967002`, anexo 1 de 1, repetição `reaproveitado: true` com o anexo reconhecido no título (`ListarAnexo` real), exclusão confirmada pelo id.

## Desvios

1. **Lançador corrigido duas vezes antes da prova:** a checagem da linha de partida não casava com as aspas escapadas do log (parou por segurança) e o encerramento por SIGTERM deixava a API filha viva (ela só sai com SIGINT). Os dois scripts da pasta temporária foram ajustados; a API órfã ficou ~1 min de pé sem gravar nada (log: "Conferência — lançaria" para a N1-500 de 29/09, com o `automation/` já fora).
2. **Omie real repetido uma vez:** a 1ª execução parou no `/resolver` com `OMIE_INDISPONIVEL` transitório do Omie, antes de qualquer gravação.
3. **`cp-conferida-pelo-card` não rodado** (opcional; o clique foi provado em 2026-09-29 e segue nos testes de componente).

## O que a revisão de código desta rodada achou (para a próxima rodada)

- `06-REVIEW-2.md` (crm-n1): 1 crítico — a dispensa do modo `sem-conferencia` sobrevive a desmarcar "Integração manual" e leva a um `/lancar` sem conferência humana (só nesse modo alternativo; o padrão `nao-encosta` não é afetado) — e 5 avisos (janela em voo do `/lancar`, ordem de implantação v1.2, conjunto de quem confere pelo fio ≠ pelo clique, G3 no meio do ciclo, orçamento de gravações do ciclo).
- `06-REVIEW-FINANCEIRO-TRIA-2.md`: 1 crítico — a varredura do S5 assíncrono pode regravar uma decisão velha e publicar o RESUMO numa Solicitação já reprovada — e 6 avisos (orçamento dos anexos, allowlist por prefixo do Storage, logs com erro cru, dedup/fecharReceipt, varredura em série, receipt preso).

Nenhum dos dois críticos afeta as provas desta rodada (a jornada roda em `nao-encosta`, e o S5 assíncrono fica desligado no processo local), mas os dois precisam de correção antes de produção.

## Self-Check: PASSED

- `06-PROVAS.md`: zero `_(a preencher na Task 2)_`; `RESULTADO: OK` e `/lancar` = 0 colados; autorização do dono registrada.
- Processos da prova encerrados; portas 3002/4100/4101 livres; a API normal (sem ponte) de volta na 3002.
