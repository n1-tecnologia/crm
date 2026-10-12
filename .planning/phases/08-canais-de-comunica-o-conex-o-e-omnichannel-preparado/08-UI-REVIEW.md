# Phase 08 — UI Review

**Audited:** 2026-10-12
**Baseline:** abstract 6-pillar standards (no UI-SPEC.md) plus the design tokens in `apps/web/CONTEXT.md`
**Screenshots:** not captured. This was a static code review. The pages need a real Supabase JWT and the platform database, and the session constraints ruled out starting the dev server.
**Interaction captures:** off (`workflow.ui_interaction_capture` is false). Every interaction finding comes from reading the code.

Items the owner already accepted in `08-PROVAS.md` "Limitações aceitas" are not re-reported. They are referenced where relevant: no "Todas" tab (item 6), "Simular conexão" visible in production (item 8), seed channels marked "demo" (item 3), D-11 chat model (item 1).

Token gate: `npm run verificar:tokens -w @n1/web` passes (445 tokens, 356 files, 0 failures). A grep of the audited files found no hardcoded hex or rgb colors and no arbitrary `text-[..]` sizes.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Clear pt-BR and good guidance, but internal jargon reaches users ("cadastrado", "demo", "(008)"). The "Canal(is)" and "modelo(s)" plurals are clumsy. |
| 2. Visuals | 3/4 | Consistent badges and a clear card hierarchy. The channel tabs have long labels with `nowrap` and an `opacity-40` disabled state, and several badges crowd the card header. |
| 3. Color | 3/4 | Tokens only, with semantic tones. The amber on amber-wash warning banners and the 40% opacity on disabled tabs are contrast risks. |
| 4. Typography | 3/4 | Only token classes (`app-md/base/meta/sm`), one hierarchy, no ad-hoc sizes. The `app-meta` size carries a lot of important text. |
| 5. Spacing | 3/4 | `grade-solta`, `item-solto`, `p-4` and `gap-*` all come from the scale. One fixed `w-44` Select truncates its labels. |
| 6. Experience Design | 2/4 | The permission and error paths are good. But the `role="tab"` bar has no keyboard or tabpanel semantics, "Desconectar" has no confirmation, there are no loading states on hydration, and the disabled reasons live only in tooltips. |

**Overall: 17/24**

---

## Top 3 Priority Fixes

1. **The channel bar claims `role="tablist"` and implements none of it** (`features/crm/conversation-thread.tsx:493-655`). Users who rely on a keyboard or a screen reader lose the model they were promised.
   - It has no `tabpanel` or `aria-controls`, no arrow-key and roving `tabindex` handling, and every tab is in the Tab order.
   - Unreachable channels are focusable `aria-disabled` buttons, and the disabled Meet tab is a bare `<span>` with no role.
   - Fix: implement the arrow-key and Home/End pattern with `tabindex=-1` on inactive tabs and a labelled panel. Or drop `role="tab"` and use a button group with `aria-pressed` or `aria-current`.
2. **Fine print and dimmed text carry important information.** "Conexão simulada" and the "unreachable channel" reason depend on contrast that is not guaranteed.
   - Disabled tabs use `opacity-40` over `--texto-3`. The reason sits in `title` and `sr-only`, so sighted touch users never see why the tab is off (`conversation-thread.tsx:~535`).
   - The warning banners are `--aviso` text on `--aviso-lavado` (`canais/[canal]/page.tsx`, two banners). Pills use `app-meta`.
   - Fix: show the reason as visible text next to the disabled tab, or as a hint under the bar. Raise the disabled state above 40% and use a stronger warning-text token. Verify AA contrast in both themes.
3. **Destructive and state-changing actions are unguarded, and the loading states are thin** (`canais/[canal]/page.tsx`, `conectar-provedor.tsx`).
   - "Desconectar" runs immediately, unlike "Arquivar", which has a `ConfirmDialog`. It leaves the Canal unable to deliver.
   - The connect form says "Conectando…" only inside `disabledReason` (a tooltip). The button text never changes. Use the `carregando` prop that the ficha page already uses.
   - The Canal page shows "Canal não encontrado" for any id that is not in `state.channels`. This flashes during rehydration and is also wrong for a deep link.

Further fixes (4 to 8):
4. Replace the internal wording in user-facing pills and tooltips: "cadastrado" and "demo", and "tabela própria (008)" in `selo-do-provedor.tsx`.
5. The archived Canal still shows "uma Mensagem enviada fica registrada como pendente" (`canais/[canal]/page.tsx`). That is false for an archived channel, which "não se configura".
6. Widen or restructure the `w-44` Selects in the ficha. The option "Nenhum — a Conversa nasce sem Fila" truncates.
7. When the Membro lacks permission, the ficha hides "Simular conexão", "Desconectar" and "Arquivar" without saying why. Show disabled buttons with the reason, as the Configurações page already does for "Conectar Canal".
8. On `configuracoes/page.tsx`, the empty state renders a second "Conectar Canal" next to the Section action (duplicate CTA).

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

Strengths:
- The orientation copy per provider is specific and actionable (`conectar-canal.ts`: "Aparelhos conectados", "Conectar um aparelho", "senha de aplicativo").
- Disabled reasons are specific and ordered: "Dê um nome ao Canal." Then "Informe {rótulo}." Then the format hint (`conectar-provedor.tsx:~85`).
- The conflict message "Esta conta já está conectada…" comes with a link.
- Empty states carry a hint: "Sem Canal não há Conversa…".
- The simulated-connection warning is plain: "nenhuma Mensagem sai da plataforma".

Defects:
- **WARNING** `configuracoes/page.tsx:78,~110,~140`: `${n} Canal(is) · ${n} Fila(s)`, "modelo(s) aprovado(s)" and "Conversa(s)" use the programmer-style optional plural. Pluralize properly ("1 Canal" / "2 Canais").
- **WARNING** `selo-do-provedor.tsx`: the pills "cadastrado" and "demo" are implementation vocabulary (table origin) shown to every user. The titles "tabela própria (008)" and "sai na unificação" leak migration numbering. The owner accepted "demo" as a mark (limitação 3), but the wording is still engineer-facing.
- **WARNING** `conectar-provedor.tsx`: the link "ver o Canal" appears on its own line after the error with no context. Compose it into the error: "Esta conta já está em uso no Canal X. Ver o Canal."
- Minor: the Select shows the placeholder "Nenhum" and the option "Nenhum — a Conversa nasce sem Fila" together. "Origem do cadastro" (the cadastrado/demo pill) sits beside "Origem padrão" (the Contact origin) on the same panel. Two meanings of "Origem" side by side is confusing.
- Minor: the button reads "Conectar" on a form that creates a disconnected Canal ("O Canal nasce desconectado"). "Criar Canal" would be more honest. The UAT step 2 notes this flow.

### Pillar 2: Visuals (3/4)

- Focal point is clear on all pages: a title, a `PageHeader` seal cluster, and cards with a consistent `item-solto` pattern.
- Icon plus label is used everywhere. Icon-only controls found carry `aria-label` ("Anexar", "Gravar áudio"). Icons in tabs are `aria-hidden`.
- **WARNING** `configuracoes/page.tsx` card header: up to four pills (provider, origem, conexão simulada, lifecycle) sit on a row beside the name with `shrink-0`. On narrow columns the name gets squeezed, and the pills do not wrap. Let the pill group wrap below the name below the `sm` breakpoint.
- **WARNING** `conversation-thread.tsx` tabs: the label is "Nome · Provedor" with `whitespace-nowrap` plus a count. With two WhatsApps and several other channels the bar wraps into rows (`flex-wrap`), and Meet, Nota and Tarefa drift to a second row. The UAT already asks for a human look at this (passos 6-7).
- The placeholder dashed box in `conectar-provedor.tsx` is a good mockup. It is marked "disponível quando a integração chegar", so it does not read as a bug.
- Minor: on the ficha, "Simular conexão" is a `primary` button next to `danger` "Arquivar" with no spacing separation. The destructive action sits directly beside the primary.

### Pillar 3: Color (3/4)

- Only tokens: `--texto`, `--texto-2/3`, `--aviso`, `--aviso-lavado`, `--erro`, `--sucesso`, `--acento`, `--linha`, `--superficie-2`. The token gate has 0 failures, and there are no hardcoded colors in the audited files.
- Semantic use is mostly right: official is `info`, non-official is `aviso`, cadastrado is `acento`, demo is `neutro`.
- **WARNING** `--aviso` is used for both the "não oficial" provider pill and the "conexão simulada" and "desconectada" states. The word "não oficial" is a neutral fact about the provider, not a warning, and it dilutes the amber signal used for real problems. Amber in one card header can mean three different things.
- **WARNING** Text-on-wash combinations: `--aviso` on `--aviso-lavado` banners (`canais/[canal]/page.tsx`) and `--aviso` for the "desconectada" label in the card meta line. Neither contrast ratio is verified. `opacity-40` on disabled tabs almost certainly falls below AA.
- Accent (`--acento`) is used for the "ver o Canal" link and the "cadastrado" pill: restrained.

### Pillar 4: Typography (3/4)

- Only the project's semantic classes are used (`app-md`, `app-base`, `app-sm`, `app-meta`, `app-coluna`, `app-numero`). There are no `text-xs`-style Tailwind sizes and no arbitrary sizes in the audited files.
- The hierarchy is consistent: title (PageHeader), `app-md` card name, `app-meta` supporting lines.
- **WARNING** `app-meta` is used for the provider hint (`quandoUsar`) on the choice cards, which is the main text a user reads to choose. The card's job is to make the provider choice, so that sentence should be `app-base`.
- Minor: `font-medium` is mixed in tabs and in `truncate font-medium` on the channel bar, alongside `app-md`. This is a small mix of weight sources, but it is acceptable.

### Pillar 5: Spacing (3/4)

- Layout uses the shared primitives (`CorpoDeTela`, `Section`, `Painel p-4`, `grade-solta sm:grid-cols-2`, `gap-2/3/4`). There are no arbitrary pixel spacings.
- The one arbitrary size is `max-w-[12rem]` on the channel name in `inbox-columns.tsx` (D-16). It fits the item meta line and the UAT already schedules a check (passo 8).
- **WARNING** `canais/[canal]/page.tsx`: the fixed `w-44` (11rem) Select width truncates "Nenhum — a Conversa nasce sem Fila". The `xl:grid-cols-[minmax(0,1fr)_22rem]` right column is narrow for a RecordRow with a Select and a link.
- Minor: the choice-card page uses `mb-4` while the form page uses `grid gap-4`; the two page headers differ by a margin.

### Pillar 6: Experience Design (2/4)

Covered well:
- Permission-aware controls: `usePodeNoCrm` disables "Conectar Canal" with a reason (`disabledReason`). The server still enforces (T-08-36).
- Form validation gives a specific disabled reason before the click, and field-level errors for `nome`, `identificador`, `filaPadraoId` and `origemPadraoId`.
- 409 is handled with a link to the conflicting channel.
- Archive uses `ConfirmDialog` with `destructive`.
- The `[provedor]` route validates the slug and calls `notFound()`.
- Hooks are ordered before the "Canal não encontrado" return.
- The empty state exists for channels, queues and templates.

Gaps:
- **BLOCKER (a11y)** The `role="tablist"` bar has no keyboard or tabpanel semantics. See priority fix 1. The disabled Meet tab is a bare span, so the bar is inconsistent.
- **WARNING** "Desconectar" has no confirmation (`canais/[canal]/page.tsx`). It is reversible with "Simular conexão", but that is a test control, not a recovery path once a real provider exists.
- **WARNING** Loading: `useData` hydrates in memory with no loading state. The Canal page flashes "Canal não encontrado" and the filas/origens Selects are empty until `rehidratar()` resolves. The connect submit shows no visible busy label (`disabledReason: "Conectando…"` is tooltip-only).
- **WARNING** Hidden actions: for a Membro the ficha omits "Simular conexão", "Desconectar" and "Arquivar" with no explanation. The UAT passo 9 expects this, but a disabled button with the reason is the pattern used on the Configurações page.
- **WARNING** The archived-Canal banner says messages are saved as pending "até a conexão voltar". For an archived Canal the connection will not return.
- **WARNING** The success Toast is rendered inside the RecordPanel, below the buttons. After "Arquivar" the user may not see it, since the focus and the viewport are on the confirm dialog's trigger. Confirm that the Toast is announced (`role=status`) and is visible.
- The confirm dialog for "Enviar a X por Y?" exists in `conversation-thread.tsx:457` (not a defect).
- Registry audit: `components.json` was not checked. No third-party registry is listed because there is no UI-SPEC.

Accepted by the owner (not scored): the lack of an "Todas" tab, "Simular conexão" in production, and the seed "demo" channels.

---

## Files Audited

- `apps/web/src/app/(shell)/crm/caixa-de-entrada/configuracoes/page.tsx`
- `apps/web/src/app/(shell)/crm/caixa-de-entrada/configuracoes/canais/conectar/page.tsx`
- `apps/web/src/app/(shell)/crm/caixa-de-entrada/configuracoes/canais/conectar/[provedor]/page.tsx`
- `apps/web/src/app/(shell)/crm/caixa-de-entrada/configuracoes/canais/[canal]/page.tsx`
- `apps/web/src/features/crm/conectar-canal.ts`, `conectar-provedor.tsx`, `selo-do-provedor.tsx`, `seletor-de-canal.tsx`, `separador-de-canal.tsx`
- `apps/web/src/features/crm/conversation-thread.tsx` (tab bar, rule strip, "Responder por", lines ~380-660)
- `apps/web/src/features/crm/inbox-columns.tsx` (channel name in the meta line, Canal filter)
- Not read in detail (small `capacidadesDoCanal` edits, low priority): `contact-card.tsx`, `deal-screen.tsx`, `legado/*`, `tarefa-completa.tsx`, `flow-popup.tsx`, `[conversa]/page.tsx`.
- Run: `npm run verificar:tokens -w @n1/web` (pass).
