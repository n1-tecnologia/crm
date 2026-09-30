---
phase: 06-conferencia-do-resumo-e-anexos
plan: 20
subsystem: docs (specs, roteiro, plano) + .planning (provas, requisitos)
tags: [conferencia-do-resumo, gap-closure, provas, segunda-rodada, crm2-cr-01, fin2-cr-01, docs]

requires:
  - phase: 06-16
    provides: "S5 assíncrono sem decisão velha (decisaoGravada, CAS por attempts), worker em duas trilhas, redação sem acento"
  - phase: 06-17
    provides: "/lancar com prazo desde a entrada, anexos só do Storage, reaproveitado honesto (dePara), contrato v1.2"
  - phase: 06-18
    provides: "dispensa D6-04 só enquanto Manual, podeDecidirAConferencia, conferenciaDoReaproveitado"
  - phase: 06-19
    provides: "marca \"Lançamento no Omie em curso\", G3 estrito no meio do ciclo, orçamento justo, cenário cp-dispensa-manual"
provides:
  - "docs/07-processos/contas-a-pagar.md e solicitacao-de-pagamento.md dizendo o que 06-16..06-19 fizeram (RN-CP-11, RN-CP-12)"
  - "docs/08-migracao-financeiro/08-roteiro-…: Ordem de implantação, Execução B, checagem da linha de partida (SIGINT/aspas escapadas)"
  - "docs/08-migracao-financeiro/07-plano-…: linha da segunda rodada (06-16..06-20)"
  - "06-PROVAS.md: \"Segunda rodada de fechamento (06-16..06-19)\" completa — testes, jornada no fio, crm2:CR-01 no real, 3b registrado como pendente"
  - "REQUIREMENTS.md coerente: RES-02/05/06 com a evidência desta rodada; RES-03 continua Pending, explicado"
affects: []

tech-stack:
  added: []
  patterns:
    - "docs como o código: cada afirmação nova cita o SUMMARY e o crm2:/fin2: que a originou"
    - "checkpoint dividido entre execução automatizada (agente) e execução que grava em produção (autorizada pelo dono, rodada pelo orquestrador) — o relato registra quem rodou o quê, sem perder a rastreabilidade"

key-files:
  created:
    - .planning/phases/06-conferencia-do-resumo-e-anexos/06-20-SUMMARY.md
  modified:
    - docs/07-processos/contas-a-pagar.md
    - docs/07-processos/solicitacao-de-pagamento.md
    - docs/08-migracao-financeiro/07-plano-de-correcoes-pos-auditoria.md
    - docs/08-migracao-financeiro/08-roteiro-de-producao-pos-correcoes.md
    - .planning/phases/06-conferencia-do-resumo-e-anexos/06-PROVAS.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Task 2 [BLOCKING] foi dividida em duas passagens: o executor rodou só os testes automatizados (sem servidor, sem jornada, sem Omie) e parou no checkpoint; o dono autorizou a jornada (execução A) e o crm2:CR-01 no real (execução B) nesta conversa, e o ORQUESTRADOR as rodou (o executor já havia parado), repassando o relato verbatim para registro"
  - "3b (Omie real com dois anexos, fin2:IN-07) não rodou: o script de 06-17 (`scripts/teste-omie-real.ts`) aceita um `--anexo` só; ajustá-lo fica com o dono, sem autorização pedida nesta rodada"
  - "RES-03 continua Pending: código e testes completos (zero /lancar sem conferência nos testes de 06-12/06-18/06-19 e nas execuções A/B desta rodada), mas falta a verificação humana 1 (passo 2B em lancar) — ato reservado ao dono, não a um agente"
  - "apps/api/README.md e financeiro-tria/automation/README.md não foram tocados: já estavam coerentes com 06-17/06-18/06-19 (só corrigir se incoerente, e não estavam)"

requirements-completed: [RES-06]

duration: "~35 min de execução do agente (Task 1 + testes da Task 2), mais a pausa no checkpoint para autorização do dono e a execução das provas A/B pelo orquestrador"
completed: 2026-09-30
---

# Phase 6 Plan 20: segunda rodada de fechamento (06-16..06-19) — provada e escrita — Summary

**As specs, o roteiro e o plano passam a dizer o que 06-16..06-19 fizeram (a marca "Lançamento no Omie em curso", a dispensa só enquanto Manual, o reaproveitado conferido, o S5 sem decisão velha). As provas rodaram de novo: `npm run check` EXIT 0 nos dois repositórios, o contrato v1.2 igual nos dois lados, e — com a autorização explícita do dono — a jornada respondendo "ok" e pedindo ajuste no fio (zero `/lancar`) e a prova de crm2:CR-01 NO REAL: desmarcar "Integração manual" invalida a dispensa vigente, devolve um Resumo novo à mesma thread para uma pessoa decidir, e a ponte não toma nenhuma ação autônoma enquanto ele está pendente. O Omie real com dois anexos (fin2:IN-07) ficou registrado como pendente — o script de 06-17 só aceita um anexo.**

## Ponto de partida

- `crm-n1-integracao`: `HEAD 996d337` (branch `integra-frontend-main`) no início; o código é o de `2214a96` (06-16..06-19), e `4547cfd`/`996d337` só acrescentam o SUMMARY e o ROADMAP/STATE do 06-19. `git status --short` limpo.
- `financeiro-tria`: `HEAD 6767be1` (`main`, local); código de 06-16 em `0ad567e..c535dee`, de 06-17 em `c535dee..6767be1`; os 89 arquivos sujos só de fim de linha, intocados durante todo o plano.
- `06-16-SUMMARY.md`..`06-19-SUMMARY.md` lidos por inteiro (frontmatter, desvios, achados) antes de qualquer edição, como o plano exige.

## Commits

| Task | Commit | Mensagem |
|---|---|---|
| 1 | `1a5adcc` | docs(06-20): specs, roteiro e plano dizem o que 06-16..06-19 fizeram; esqueleto da segunda rodada em 06-PROVAS |
| 2 | `d73cc18` | docs(06-20): segunda rodada de fechamento provada — testes, jornada no fio e crm2:CR-01 no real |

Todos por pathspec, sem push. Nenhum commit no `financeiro-tria` (Task 1 não encontrou nada incoerente no `automation/README.md`, que já estava certo desde 06-17).

## O que mudou

### Task 1 — specs, roteiro, plano, esqueleto de 06-PROVAS

**`docs/07-processos/contas-a-pagar.md`:**
- §6.3 passo 2: "quem confere pelo fio é quem confere pelo clique" (`podeDecidirAConferencia`, 06-18, crm2:WR-03), a resposta ao "ok" de quem não confere, e o parágrafo da conferência só pelo botão (`CONFERENCIA_POR_COMENTARIO=false`, `okPeloFioDesligado`).
- §6.3 passo 3: a marca "Lançamento no Omie em curso" (06-19, crm2:WR-01) e o reaproveitado que só vira lançamento da Conferência se o `dePara` bate (06-18, crm2:WR-02, `REAPROVEITADO_SEM_DE_PARA`).
- O parágrafo da Integração manual: a dispensa só vale enquanto a conta é "Manual" (06-18, crm2:CR-01).
- §8: a coluna da alternativa de `CONFERENCIA_POR_COMENTARIO` e de `INTEGRACAO_MANUAL`, ambas terminando com a referência curta "(06-18)".
- §11: **RN-CP-11** (dispensa só enquanto Manual) e **RN-CP-12** (a marca de lançamento em curso).

**`docs/07-processos/solicitacao-de-pagamento.md`:** parágrafo novo sobre fin2:CR-01 (06-16) — a varredura não regrava decisão velha, o S5 relê o Status duas vezes, e o fechamento do receipt é por CAS.

**`docs/08-migracao-financeiro/08-roteiro-de-producao-pos-correcoes.md`:**
- A checagem da linha de partida pela forma escapada do log e o encerramento por SIGINT (06-15), citados explicitamente no §2B.
- **"Ordem de implantação (crm2:WR-02)"** como frase literal, ligando ao `apps/api/README.md` §5b.
- A **Execução B opcional** (`cp-dispensa-manual`, `JORNADA_ESPERA_CICLOS_MS`), com o comando e o esperado.
- O aviso de "Lançamento no Omie em curso" durante o `/lancar`, na seção "Depois, em `lancar`".
- Passo 4: as três linhas da tabela de variáveis da API do CRM N1 atualizadas com o que 06-18/06-19 mudaram (conferência só pelo botão, dispensa só enquanto Manual, a porta do `AVISAR_ID` fechando também no meio do ciclo).

**`docs/08-migracao-financeiro/07-plano-de-correcoes-pos-auditoria.md`:** nova linha "Fase 6 — segunda rodada (06-16..06-20; achados de `06-REVIEW-2.md` e `06-REVIEW-FINANCEIRO-TRIA-2.md`)" na tabela de execução, com as faixas de commit dos dois repositórios.

**`apps/api/README.md` e `financeiro-tria/automation/README.md`:** lidos e conferidos — já estavam coerentes com 06-17/06-18/06-19 (o `apps/api/README.md` §5b já tinha "Ordem de implantação", `DISPENSA_SEM_MANUAL` e `okPeloFioDesligado`; o `automation/README.md` já tinha o caminho `/storage/v1/object/`). Não tocados.

**`06-PROVAS.md`:** o topo ("Estado deste relato") passou a apontar para a nova rodada; a seção `## Segunda rodada de fechamento (06-16..06-19) — 2026-09-30` foi criada com as cinco subseções (Testes, Jornada, crm2:CR-01, Omie real, Fica com o dono), comandos exatos e tabelas `_(a preencher na Task 2)_`.

### Task 2 [BLOCKING] — as provas de novo

**Passagem 1 (o executor, sem autorização de escrita em produção):** rodou só os testes automatizados, sem nenhum servidor de pé:

| # | Onde | Resultado |
|---|---|---|
| `npm run check` (raiz) | EXIT 0 — typecheck ×3, lint, tokens, `verificar:contratos` e as três suítes inteiras |
| `packages/dominio` | 995/995 (66 arquivos) |
| `apps/web` | 275/275 (29 arquivos); `src/features/tarefa/` 90/90 (9 arquivos) |
| `apps/api` (suíte inteira sem banco) | 820 passados · 205 pulados · 1 todo · 0 falhas (1028; 102 arquivos) |
| `apps/api` por pasta | `automacoes/` 331·17 pulados · `rotas/` 164·50 pulados · `observabilidade/` 10/10 · `persistencia/` 46·36 pulados — 0 falhas |
| contrato `contas-a-pagar-v1` | `diff -r` vazio; 27 arquivos; hash `0adf7a7bd246e2051e73ff02bbe5e6d4ea2966d2ef659a6cfcb0f7964d595f71` igual nos dois repositórios |
| `contrato-contas-a-pagar(.ponte).test.ts` | 54/54 |
| `financeiro-tria/automation` `tsc --noEmit` | EXIT 0 |
| `financeiro-tria/automation` `npm test` | 769/769, 0 falhas (eram 751 antes de 06-17) |

Zero falhas em qualquer suíte. O executor parou no checkpoint depois disso, sem subir nenhum servidor nem tocar `ws_n1`/Omie, e devolveu o relato (CHECKPOINT REACHED) com os resultados e os comandos exatos das execuções que faltavam.

**Passagem 2 (o dono autorizou; o orquestrador rodou, porque o executor já havia parado):**

- **Execução A — jornada respondendo no fio** (`cp-conferida`, `cp-ajuste`): `RESULTADO: OK — contas: tsk_tark6e, tsk_tark79`. `cp-conferida` respondeu "ok" no fio (`cmt_tark6u`) e a ponte publicou `✅ Resumo conferido` a partir da resposta; `cp-ajuste` pediu ajuste pelo fio e recebeu o Resumo revisado no mesmo fio. Contador independente: `/resolver`=3, **`/lancar`=0**, 0 falhas de ciclo.
- **Execução B — crm2:CR-01 no real** (`cp-dispensa-manual`, `AGENTE_CONTAS_A_PAGAR_INTEGRACAO_MANUAL=sem-conferencia`): a conta `tsk_tark86` recebeu a dispensa automática ("Resumo publicado com a Conferência dispensada"); ao desmarcar "Manual" pela jornada, um Resumo NOVO saiu na MESMA thread ("Resumo publicado para conferência.", sem mais "dispensada") e o card voltou a exigir uma pessoa; dois ciclos da ponte passaram sem nenhum aviso de "lançaria" enquanto a Conferência ficou pendente; só depois do "ok" humano a API registrou o aviso normal do modo `conferencia` ("Conferência — lançaria: …"). **`/lancar`=0**. **crm2:CR-01 ficou provado no REAL**, não só pelo teste `ponte-dispensa-e-fio.test.ts` de 06-18.
- **3b — Omie real com dois anexos (fin2:IN-07):** não rodou. `financeiro-tria/automation/scripts/teste-omie-real.ts` (estado de 06-17, `6767be1`) aceita um `--anexo` só; ajustar o script e rodar com autorização fica com o dono. Registrado como tal em `06-PROVAS.md` e no roteiro (item 11 de "Decisões pendentes" continua aberto).

O executor preencheu as cinco subseções de `06-PROVAS.md` com esse relato verbatim (repassado pelo orquestrador), completou as linhas 7-8 de "Fica com o dono", atualizou `REQUIREMENTS.md` e fez o commit final `d73cc18` — nada foi re-executado por ele.

## Divergências entre os SUMMARYs 06-16..06-19 e os respectivos planos

Nenhuma nova encontrada por este plano — as seções "Deviations from Plan" de 06-16, 06-17, 06-18 e 06-19 já registram as próprias (a URL do exemplo canônico fora do Storage em 06-17; a terceira exceção a CON-05 em 06-18; a ordem de conferir a impressão antes de `motivoParaNaoLancar` e a hidratação que cede ao relógio em 06-19; etc.). Este plano só leu e refletiu essas divergências nos documentos — onde o SUMMARY já tinha escrito a divergência (por exemplo, `apps/api/README.md` §5b por 06-18, o doc 05 e o roteiro por 06-17), Task 1 não duplicou.

## Estado final de RES-01..RES-06

| Requisito | Estado | Evidência |
|---|---|---|
| RES-01 | `[x]` Complete | sem mudança nesta rodada |
| RES-02 | `[x]` Complete | evidência nova: execução A (`/resolver`=3, `/lancar`=0) e crm2:CR-01 provado no real (execução B) |
| RES-03 | `[ ]` **Pending** | código e testes completos (zero `/lancar` sem conferência: 06-12/06-18/06-19 + execuções A/B desta rodada); falta a verificação humana 1 (passo 2B em `lancar`, `06-VERIFICATION.md`) — ato do dono, não coberto por este plano |
| RES-04 | `[x]` Complete | sem mudança de estado; fin2:IN-07 (dois anexos) registrado como pendente, sem prova real |
| RES-05 | `[x]` Complete | reforçado por 06-16 (fin2:CR-01), 769/769 testes |
| RES-06 | `[x]` Complete | evidência nova: a segunda rodada de fechamento inteira (testes + execuções A/B) |

## Known Stubs

Nenhum. Este plano só editou documentação e o relato de provas.

## Threat Flags

Nenhuma superfície nova fora do `<threat_model>` do plano. As mitigações T-06-20-01 (autorização explícita do dono, colada com data no relato), T-06-20-02 (modo `conferencia`, contador independente, `/lancar`=0 confirmado nas duas execuções) e T-06-20-07 (autorização registrada) foram aplicadas; T-06-20-03 (token nunca impresso/gravado) e T-06-20-06 (SIGINT, portas livres) foram seguidas na execução repassada pelo orquestrador. T-06-20-08 (Omie real) não se aplica: o passo 3b não rodou.

## Deviations from Plan

### Auto-fixed / aceitos

**1. [Detalhe — protocolo de checkpoint] A Task 2 foi executada em duas passagens, por instrução explícita do agente que invocou este executor.**
- **O que mudou:** o executor rodou só o sub-passo 1 (testes automatizados, sem servidor/jornada/Omie) e parou no checkpoint, devolvendo um relato "CHECKPOINT REACHED" com os comandos exatos das execuções A/B/3b. O dono autorizou A e B nesta conversa; como o executor já havia parado, o **orquestrador** rodou as duas execuções e repassou o relato verbatim (linhas de log, contadores, screenshots) para o executor registrar em `06-PROVAS.md`.
- **Por que:** a tarefa explícita recebida por este executor foi "resume Task 2… Do NOT re-run anything — just record" — registrar o relato já coletado, não reexecutar a jornada.
- **Consequência:** `06-PROVAS.md` documenta essa divisão de trabalho na seção "Autorização" de cada execução, para não perder a rastreabilidade de quem rodou o quê.

**2. [Detalhe] 3b não rodou, sem pedir autorização.** O relato repassado já trazia a conferência feita (o script de 06-17 aceita um `--anexo` só); não havia motivo para pedir autorização de uma execução que o código ainda não suporta. Registrado em `06-PROVAS.md` e nas linhas de RES-04/REQUIREMENTS.md, e o item 11 de "Decisões pendentes" do roteiro continua aberto, como o 06-17 já previa.

Fora isso, o plano foi executado como escrito.

## Deferred

- **fin2:IN-07 (Omie real, dois anexos no mesmo título):** continua sem prova real. Ajustar `scripts/teste-omie-real.ts` para aceitar dois `--anexo` e rodar com autorização do dono é o próximo passo, sem urgência de código (o comportamento do `automation/` já está provado por teste e no real com um anexo).
- **O passo 2B em `lancar` (verificação humana 1, RES-03):** ato reservado ao dono (regra 8 de `06-CONTEXT.md`); está escrito com comando e esperado em "Fica com o dono" de `06-PROVAS.md`.
- **O resíduo de fin2:CR-01** (duas decisões da mesma Tarefa em paralelo antes de qualquer uma gravar a marca, sem trava por Tarefa no banco): decisão do dono, fica registrado em "Fica com o dono".
- **A ordem de implantação, S5/S6 ao vivo, a API de produção, push/merge e D6-01..D6-04:** todos atos do dono, escritos com comando e esperado em "Fica com o dono" — não são adiamentos deste plano.

## Self-Check: PASSED

- Arquivos modificados existem: `docs/07-processos/contas-a-pagar.md` (tem `RN-CP-11` e `RN-CP-12`), `docs/07-processos/solicitacao-de-pagamento.md` (tem `decisaoGravada`), `docs/08-migracao-financeiro/08-roteiro-de-producao-pos-correcoes.md` (tem `SIGINT`, `cp-dispensa-manual`, `sem-conferencia`, "Ordem de implantação"), `docs/08-migracao-financeiro/07-plano-de-correcoes-pos-auditoria.md` (tem "segunda rodada"), `.planning/phases/06-conferencia-do-resumo-e-anexos/06-PROVAS.md` (tem "Segunda rodada de fechamento", 0 ocorrências de "a preencher na Task 2"), `.planning/REQUIREMENTS.md` (RES-03 ainda `[ ]`, RES-06 `[x]` com a evidência nova).
- Commits `1a5adcc` e `d73cc18` estão em `git log --oneline` de `crm-n1-integracao`.
- Nenhum segredo em `06-PROVAS.md` (`grep -cE '(TOKEN|SENHA|SECRET)=[A-Za-z0-9_-]{12,}'` = 0).
