---
phase: 08
review: 08-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: open
    title: "RN-CXE-19 is never enforced on a Conversa's first outbound Mensagem (server accepts cold free text on WhatsApp oficial / Instagram)"
  - id: WR-02
    severity: warning
    disposition: open
    title: "Reabrir a Conversa keeps `resolvida_em`, unlike the legacy operation it mirrors"
  - id: WR-03
    severity: warning
    disposition: open
    title: "Resolver/reabrir ignore the Canal's state: a Conversa can be reopened in an archived Canal"
  - id: WR-04
    severity: warning
    disposition: open
    title: "\"Responder por\" performs a persisted write on mere selection and leaves empty Conversas behind"
  - id: WR-05
    severity: warning
    disposition: open
    title: "`rehidratar()` swallows failures, so the Canal screens report success or navigate against a stale store"
  - id: WR-06
    severity: warning
    disposition: open
    title: "Quick actions \"WhatsApp\"/\"E-mail\" regress for Contatos whose only Canal is not `conectada`, and the stated reason is wrong"
  - id: IN-01
    severity: info
    disposition: open
    title: "Legacy-created Canais are labelled \"demo\" (\"Canal de demonstração do seed\")"
  - id: IN-02
    severity: info
    disposition: open
    title: "Dead exports in `dados/crm/canais.ts`"
  - id: IN-03
    severity: info
    disposition: open
    title: "`plataforma.mensagens.seq` is a database-global identity exposed to every tenant"
  - id: IN-04
    severity: info
    disposition: open
    title: "Conversas list is ordered by `atualizado_em`, which a new Mensagem never touches"
open: 10
total: 10
recorded: 2026-10-12T22:44:19.264Z
---

# Phase 08: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| WR-03 | warning | open | - |
| WR-04 | warning | open | - |
| WR-05 | warning | open | - |
| WR-06 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
