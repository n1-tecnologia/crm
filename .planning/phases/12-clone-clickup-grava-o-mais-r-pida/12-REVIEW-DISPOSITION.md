---
phase: 12
review: 12-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: open
    title: "`enviar()` engole qualquer exceção e deixa `confirmado` possivelmente meio aplicado, sem re-hidratar"
  - id: WR-02
    severity: warning
    disposition: open
    title: "Revisão defasada com `hidratarAgora()` que falha ou é ignorada apaga da tela uma gravação confirmada"
  - id: WR-03
    severity: warning
    disposition: open
    title: "A fila serial não tem prazo: um pedido pendurado trava todas as gravações, a re-hidratação e o poll"
  - id: WR-04
    severity: warning
    disposition: open
    title: "Exceção em `terminar()`/`refazerPendentes()` deixa a promessa sem resolver e a fila parada"
  - id: WR-05
    severity: warning
    disposition: open
    title: "Pendentes enfileiradas carregam ids locais \"assados\"; nada reconcilia quando o id do servidor diverge, e as ações de status continuam ligadas na linha \"Salvando…\""
  - id: WR-06
    severity: warning
    disposition: open
    title: "As importações em regime `otimista` seguram a linha do Espaço do `update` até o `commit`, e a tela passa a perder gravações com 409"
  - id: WR-07
    severity: warning
    disposition: open
    title: "`transporteHttp.gravar` continua enviando as chamadas seguintes depois de o servidor recusar uma, e o store mascara a recusa"
  - id: IN-01
    severity: info
    disposition: open
    title: "Comentário de `aoTerminar` ficou desatualizado"
  - id: IN-02
    severity: info
    disposition: open
    title: "`enviarEspacoALixeira` pode deixar um Espaço de teste ativo no Espaço real"
  - id: IN-03
    severity: info
    disposition: open
    title: "`somaDasEtapas` não tem o `?? 0` que `resumirGesto` usa para o mesmo campo"
  - id: IN-04
    severity: info
    disposition: open
    title: "O CLI aceita `--repeticoes`, `--workspace` e `--membro` sem `=` e ignora o valor"
open: 11
total: 11
recorded: 2026-11-02T19:36:52.381Z
---

# Phase 12: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| WR-03 | warning | open | - |
| WR-04 | warning | open | - |
| WR-05 | warning | open | - |
| WR-06 | warning | open | - |
| WR-07 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
