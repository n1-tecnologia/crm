# Deferred Items — Phase 02

Items found during execution that are out of scope for the plan that found them
(SCOPE BOUNDARY rule) — not fixed, tracked here for whoever owns the file next.

| Plan found in | File | Item | Why deferred |
|---|---|---|---|
| 02-07 | `../financeiro-tria/automation/src/tenants/tria/payment-rules.test.ts` (test) / `payment-rules.ts` (`resolveResponsible`) | The pre-existing test `resolve responsavel por centro de custo com fallback` fails at baseline — before Plan 02-07 touched anything (`npm test` on a clean `npm install`, prior to any edit, already showed 6 pass / 1 fail with this exact assertion). `resolveResponsible("centro desconhecido").nome` returns `"Elifas"`, not matching `/FINQ/i`. Root cause looks environment-dependent: the fallback default reads `CLICKUP_RESPONSAVEL_TRIA_NOME` via `optionalEnv`, and this machine's `automation/.env` sets it to `"Elifas"` instead of a `FINQ`-matching value the test expects. | Not caused by Plan 02-07's changes (Wave 0 test infra: `criarRouter`, `criar-app.ts`, `servidor-falso.ts`, `omie-falso.ts`, `relogio.ts`, test glob fix). Test file and `payment-rules.ts` are not in this plan's `files_modified`. Confirmed identical failure with a totally clean `node_modules` install, before any plan-07 edit landed. |
| 02-09 (resolvido em 02-13) | `contratos/payment-requests-v1/*.erro-401.json` (raiz do monorepo) | ~~As fixtures `*.erro-401.json` existentes ainda usavam `CREDENCIAL_INVALIDA` para o caso de ausência.~~ Resolvido pelo Plan 02-13: as 7 rotas `/v1/integrations/payment-requests/*` agora existem e consomem estas fixtures — as 7 `erro-401.json` foram reconciliadas para `code: "CREDENCIAL_AUSENTE"` / `message: "Credencial de serviço ausente."`, batendo com o hook de `plugins/autenticacao-servico.ts` (Plan 02-09) para ausência real de `Authorization`. | — |
| 02-09 | `apps/api/.env.example` | `apps/api/src/autenticacao/criar-usuarios-do-seed.ts` lê `process.env.SEED_SENHA` (com fallback hardcoded), e a variável nunca foi documentada em `.env.example` — dívida da Fase 1 (Plan 01-02), não da Fase 2. | Escopo de 02-09 é explicitamente "todas as variáveis que a Fase 2 introduz" (ação da Task 3) — `SEED_SENHA` é anterior a essa fronteira. Fica para quem tocar `.env.example` por outro motivo reconciliar. |

## Plan text observation (not a deviation, not fixed)

Plan 02-07 Task 1's acceptance criteria list
`git -C ../financeiro-tria status --short src/ | wc -l` continuing at "89" — but 89 was
always the *whole-repo* baseline count (confirmed before any edit), not the `src/`-scoped
count (which was 74 non-`automation/` files under `src/` at baseline, unaffected by this
plan). Task 3's acceptance criteria states the correct, verified formula: total repo
`git status --short | wc -l` = 89 + files declared in `files_modified` — this held exactly
(90 mid-plan, back to 89 once all 8 declared files were committed). No file outside the
declared list was touched; the substantive invariant holds. Left as-is since fixing plan
prose isn't this executor's job and doesn't affect correctness.
