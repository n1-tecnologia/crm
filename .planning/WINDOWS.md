---
schema_version: 1
open_count: 1
waived_count: 0
fixed_count: 0
total_count: 1
last_updated: 2026-10-10T03:08:27.555Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 07 | unrun-verify | apps/web/src/app/(shell)/crm/contatos/page.tsx |  | 07-06: lista, formulario e ficha de Contato nao foram exercitados em navegador real (so teste de componente com fetch falso); verificacao visual fica para o fim da fase (human_verify_mode = end-of-phase) | open |  | 2026-10-10T03:08:27.555Z |  |

````json
[
  {
    "id": 1,
    "kind": "unrun-verify",
    "phase": "07",
    "file": "apps/web/src/app/(shell)/crm/contatos/page.tsx",
    "line": null,
    "description": "07-06: lista, formulario e ficha de Contato nao foram exercitados em navegador real (so teste de componente com fetch falso); verificacao visual fica para o fim da fase (human_verify_mode = end-of-phase)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-10T03:08:27.555Z",
    "resolved_at": null,
    "milestone": "v1.0"
  }
]
````
