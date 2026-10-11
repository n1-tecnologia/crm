---
phase: 07
review: 07-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: open
    title: "Data bem formada mas inexistente vira 500 em `::date` (dataNascimento, inicio e fim do vínculo)"
  - id: WR-02
    severity: warning
    disposition: open
    title: "Duas corridas entre agregados sem rede no banco: último admin da Empresa e ciclo de matriz"
  - id: WR-03
    severity: warning
    disposition: open
    title: "Ordem de travamento invertida em `definirPadrao` e em `migrarNegocios` pode terminar em deadlock (40P01) e 500"
  - id: WR-04
    severity: warning
    disposition: open
    title: "As fichas de Contato e Empresa enviam `proprietarioId` em toda edição, e uma edição qualquer falha com 409 se o Proprietário deixou de ser Membro ativo"
  - id: IN-01
    severity: info
    disposition: open
    title: "`inserir` de Contato e de Empresa grava `\"\"` onde `atualizar` grava `null`"
  - id: IN-02
    severity: info
    disposition: open
    title: "Três derivações diferentes do \"Identificador principal\" do Contato"
  - id: IN-03
    severity: info
    disposition: open
    title: "`pais` do Identificador de Empresa é validado de forma diferente no domínio e na borda"
  - id: IN-04
    severity: info
    disposition: open
    title: "Comentários de `comum.ts` apontam para linhas erradas da 007"
  - id: IN-05
    severity: info
    disposition: open
    title: "`window.location.pathname` lido durante o render em três hooks de URL"
  - id: IN-06
    severity: info
    disposition: open
    title: "Duplicação entre os três `page.tsx` de lista e entre as fichas"
  - id: IN-07
    severity: info
    disposition: open
    title: "Totais do quadro somam valores de moedas diferentes como BRL"
  - id: IN-08
    severity: info
    disposition: open
    title: "`chamarCrm` concatena `NEXT_PUBLIC_API_URL` sem conferir que existe"
open: 12
total: 12
recorded: 2026-10-11T17:28:00.275Z
---

# Phase 07: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| WR-03 | warning | open | - |
| WR-04 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| IN-05 | info | open | - |
| IN-06 | info | open | - |
| IN-07 | info | open | - |
| IN-08 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
