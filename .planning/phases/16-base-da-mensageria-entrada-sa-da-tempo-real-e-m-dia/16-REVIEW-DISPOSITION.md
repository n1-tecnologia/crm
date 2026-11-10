---
phase: 16
review: 16-REVIEW.md
titles: json
findings:
  - id: CR-01
    severity: critical
    disposition: open
    title: "\"Simular conexão\" num Canal real troca o provedor por o de teste: Mensagem dada como enviada sem sair e entrada descartada"
  - id: WR-01
    severity: warning
    disposition: open
    title: "Trava vencida do worker de saída reenvia ao cliente uma Mensagem que pode já ter saído"
  - id: WR-02
    severity: warning
    disposition: open
    title: "`ENVIADO_SEM_REGISTRO` deixa a Mensagem `pendente` com a linha `failed`, e a reconexão do Canal a reenvia"
  - id: WR-03
    severity: warning
    disposition: open
    title: "O SIGTERM não fecha o servidor nem encerra o processo; o item (c) provavelmente não é causado pelas conexões SSE"
  - id: WR-04
    severity: warning
    disposition: open
    title: "A resposta sai para o Identificador principal do Contato, não para o que escreveu"
  - id: WR-05
    severity: warning
    disposition: open
    title: "O provedor de teste acumula em memória, sem limite, tudo que enviou em produção (texto, telefone, URLs assinadas)"
  - id: WR-06
    severity: warning
    disposition: open
    title: "A confirmação do anexo (download do bucket de até 25 MiB) roda dentro da transação do envio e usa uma segunda conexão do pool"
  - id: WR-07
    severity: warning
    disposition: open
    title: "A chave de deduplicação da fila de entrada é o `idExterno` do PRIMEIRO evento, então a segunda chamada do mesmo id é descartada em silêncio"
  - id: WR-08
    severity: warning
    disposition: open
    title: "O cliente SSE da tela não detecta fluxo parado em silêncio"
  - id: IN-01
    severity: info
    disposition: open
    title: "A \"sombra\" do webhook não esconde a existência do Canal pelo tempo"
  - id: IN-02
    severity: info
    disposition: open
    title: "A referência da mídia que não baixou guarda a mensagem inteira da Evolution e volta para a tela"
  - id: IN-03
    severity: info
    disposition: open
    title: "A coleta de órfãos para na primeira pasta de Canal que falha"
  - id: IN-04
    severity: info
    disposition: open
    title: "O mapa do limite de taxa nunca remove chaves"
  - id: IN-05
    severity: info
    disposition: open
    title: "A abertura do SSE só liga o ouvinte de \"fechou\" depois de uma ida ao banco"
open: 14
total: 14
recorded: 2026-11-10T16:53:02.289Z
---

# Phase 16: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| CR-01 | critical | open | - |
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| WR-03 | warning | open | - |
| WR-04 | warning | open | - |
| WR-05 | warning | open | - |
| WR-06 | warning | open | - |
| WR-07 | warning | open | - |
| WR-08 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| IN-05 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
