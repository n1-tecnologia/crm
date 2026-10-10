---
schema_version: 1
open_count: 3
waived_count: 0
fixed_count: 0
total_count: 3
last_updated: 2026-10-10T22:48:54.281Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 07 | unrun-verify | apps/web/src/app/(shell)/crm/contatos/page.tsx |  | 07-06: lista, formulario e ficha de Contato nao foram exercitados em navegador real (so teste de componente com fetch falso); verificacao visual fica para o fim da fase (human_verify_mode = end-of-phase) | open |  | 2026-10-10T03:08:27.555Z |  |
| 2 | 07 | unrun-verify | apps/web/src/app/(shell)/crm/empresas/page.tsx |  | 07-09: lista, popup, formulario Nova Empresa e ficha de Empresa (vinculos, Trocar admin, restauracao pedindo admin) nao foram exercitados em navegador real (so teste de componente com fetch falso e build); verificacao visual fica para o fim da fase (human_verify_mode = end-of-phase) | open |  | 2026-10-10T04:16:05.984Z |  |
| 3 | 07 | unrun-verify | apps/web/src/app/(shell)/crm/negocios/page.tsx |  | 07-10: quadro de Negocios (colunas por Etapa, arrastar = mover com reversao em 409, Ganhar/Perder/Reabrir pelo DialogoDeEncerramento) e o DialogoNovoNegocio nao foram exercitados em navegador real (so teste de componente com fetch falso e build); verificacao visual fica para o fim da fase (human_verify_mode = end-of-phase) | open |  | 2026-10-10T22:48:54.281Z |  |

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
  },
  {
    "id": 2,
    "kind": "unrun-verify",
    "phase": "07",
    "file": "apps/web/src/app/(shell)/crm/empresas/page.tsx",
    "line": null,
    "description": "07-09: lista, popup, formulario Nova Empresa e ficha de Empresa (vinculos, Trocar admin, restauracao pedindo admin) nao foram exercitados em navegador real (so teste de componente com fetch falso e build); verificacao visual fica para o fim da fase (human_verify_mode = end-of-phase)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-10T04:16:05.984Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 3,
    "kind": "unrun-verify",
    "phase": "07",
    "file": "apps/web/src/app/(shell)/crm/negocios/page.tsx",
    "line": null,
    "description": "07-10: quadro de Negocios (colunas por Etapa, arrastar = mover com reversao em 409, Ganhar/Perder/Reabrir pelo DialogoDeEncerramento) e o DialogoNovoNegocio nao foram exercitados em navegador real (so teste de componente com fetch falso e build); verificacao visual fica para o fim da fase (human_verify_mode = end-of-phase)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-10T22:48:54.281Z",
    "resolved_at": null,
    "milestone": "v1.0"
  }
]
````
