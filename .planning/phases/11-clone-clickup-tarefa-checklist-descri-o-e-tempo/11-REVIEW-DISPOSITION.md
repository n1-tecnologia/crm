---
phase: 11
review: 11-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: open
    title: "`pendingMentions` takes the \"most recent edit\" from array position, which `newestFirst` documents as unreliable"
  - id: WR-02
    severity: warning
    disposition: open
    title: "`linkDoAviso` outlives the notice it belongs to, so a later notice can show \"Abrir\" pointing at the wrong Tarefa"
  - id: WR-03
    severity: warning
    disposition: open
    title: "`DialogoDeConversao` has no double-submit guard; a double click ends in an error banner after a successful conversion"
  - id: WR-04
    severity: warning
    disposition: open
    title: "Item converted elsewhere makes the dialog vanish silently and leaves `?converter-item=` in the URL"
  - id: IN-01
    severity: info
    disposition: open
    title: "Trash button loses its right alignment when \"Converter em Subtarefa\" is hidden"
  - id: IN-02
    severity: info
    disposition: open
    title: "Escape/Enter in the description editor: the discarded `aoTeclar` return is safe, but fragile and inconsistent with `CommentComposer`"
  - id: IN-03
    severity: info
    disposition: open
    title: "Mention matching is looser than the UI that creates it (prefix names, no leading boundary, renamed members)"
  - id: IN-04
    severity: info
    disposition: open
    title: "A stale client sending the old 4-argument `convertChecklistItem` gets a 400"
open: 8
total: 8
recorded: 2026-10-29T23:14:39.066Z
---

# Phase 11: Code Review Disposition

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

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
