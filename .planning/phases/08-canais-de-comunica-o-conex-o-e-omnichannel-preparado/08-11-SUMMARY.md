---
phase: 08-canais-de-comunica-o-conex-o-e-omnichannel-preparado
plan: 11
subsystem: inbox-channels-web
tags: [web, caixa-de-entrada, omnichannel, lista-por-canal, vitest, jsdom]

requires:
  - phase: 08-canais-de-comunica-o-conex-o-e-omnichannel-preparado
    provides: "capacidadesDoCanal em isOutsideWindow (08-02); rotuloDoCanal em derive-conversacional (08-05); CHANNEL_ICON mantido por 08-10"
provides:
  - "Item da lista de Conversas com o ícone e o nome do Canal (D-16)"
  - "Disco do Canal (title e sr-only) e filtro ?canal= com o rótulo do provedor (rotuloDoCanal)"
  - "Primeiro teste de componente de inbox-columns.tsx (dois WhatsApps)"
affects: [08-12, 08-15]

actuals:
  tokens: 6000
  tasks: 2
  commits: 2
plan_head_before: 592ea81cd349c830531eb40da096938355ec7ff3
plan_head_after: afbfbcbdf746765da876755ad7f3c22934bd8d08

tech-stack:
  added: []
  patterns:
    - "A lista só desenha: o rótulo do Canal vem de rotuloDoCanal (domínio), nunca montado na tela"
    - "Teste de componente do InboxColumns: next/navigation mockado com useSearchParams lendo uma variável; itens localizados pelo href da Conversa"

key-files:
  created:
    - apps/web/src/features/crm/inbox-columns.test.tsx
  modified:
    - apps/web/src/features/crm/inbox-columns.tsx

key-decisions:
  - "O disco do Canal mantém o fallback CHANNEL_TYPE_LABEL quando o Canal não é encontrado em state.channels (Conversa órfã), em vez de assumir que channel sempre existe."
  - "O nome do Canal vai na linha app-meta, antes da situação, com ícone size-3 e truncate (max-w-[12rem]); nenhuma cor ou token novo."

requirements-completed: [CXE-W2]

coverage:
  - id: D1
    description: "Cada item da lista de Conversas mostra o ícone e o nome do Canal da Conversa; dois WhatsApps se distinguem sem abrir a Conversa"
    requirement: CXE-W2
    verification:
      - kind: unit
        ref: "apps/web/src/features/crm/inbox-columns.test.tsx#(1) sem filtro, cada Conversa diz o nome do seu Canal"
        status: pass
    human_judgment: false
  - id: D2
    description: "O filtro Canal (?canal=) nomeia cada Canal com o rótulo do provedor e escolher um deixa só as Conversas daquele Canal"
    requirement: CXE-W2
    verification:
      - kind: unit
        ref: "apps/web/src/features/crm/inbox-columns.test.tsx#(2) com ?canal=<Suporte>, só a Conversa de Suporte aparece"
        status: pass
      - kind: unit
        ref: "apps/web/src/features/crm/inbox-columns.test.tsx#(3) o filtro Canal nomeia cada Canal com o rótulo do provedor"
        status: pass
    human_judgment: false
  - id: D3
    description: "O marcador fora do Prazo não aparece numa Conversa de Canal não oficial e aparece numa de Canal oficial (D-02 na lista)"
    requirement: CXE-W2
    verification:
      - kind: unit
        ref: "apps/web/src/features/crm/inbox-columns.test.tsx#(4) fora do Prazo só aparece no Canal oficial"
        status: pass
    human_judgment: false
  - id: D4
    description: "Legibilidade visual do nome do Canal na linha de meta do item (ícone size-3 + nome truncado ao lado da situação) em largura real da coluna"
    verification: []
    human_judgment: true
    rationale: "Nenhum teste assere o encaixe visual (truncamento, quebra de linha da meta); é julgamento de UX para o UAT de fim de fase."

duration: 6min
completed: 2026-10-12
status: complete
---

# Phase 8 Plan 11: Lista da Caixa de Entrada por Canal Summary

**A lista de Conversas da Caixa de Entrada mostra o ícone e o nome do Canal em cada item, o disco e o filtro `?canal=` usam `rotuloDoCanal` ("Suporte · WhatsApp não oficial"), provados com dois WhatsApps num teste de componente novo.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-10-12T18:24:41Z
- **Completed:** 2026-10-12T18:30:00Z
- **Tasks:** 2
- **Files modified:** 2 (1 modificado, 1 criado)

## Accomplishments

- Item da lista: `title` e `sr-only` do disco do Canal passam a `rotuloDoCanal(channel)`; a linha `app-meta` ganha, antes da situação, o ícone `CHANNEL_ICON` (`size-3`) e `channel.name` truncável (`max-w-[12rem] truncate`), com comentário citando D-16.
- Filtro "Canal": o `label` de cada opção é `rotuloDoCanal(c)`; a lógica do filtro (`conversation.channelId`) não mudou.
- `inbox-columns.test.tsx` (novo, 4 testes): nome do Canal por item, filtro `?canal=`, opções do `Select` com rótulo do provedor, e `fora do Prazo` só no Canal oficial.

## Task Commits

1. **Task 1: Nome do Canal no item da lista e rótulo do provedor no filtro** - `beb8a86` (feat)
2. **Task 2: Teste de componente da lista com dois WhatsApps** - `afbfbcb` (test)

**Plan metadata:** commit docs(08-11) a seguir.

## Files Created/Modified

- `apps/web/src/features/crm/inbox-columns.tsx` - nome do Canal no item; `rotuloDoCanal` no disco e no filtro
- `apps/web/src/features/crm/inbox-columns.test.tsx` - lista e filtro por Canal provados com dois WhatsApps

## Decisions Made

- Disco do Canal com fallback para `CHANNEL_TYPE_LABEL` quando o Canal não existe em `state.channels`, porque `channel` é `undefined` no tipo.
- Nenhuma mudança fora do que o plano pediu: a derivação do rótulo mora no domínio e a tela só a chama.

## TDD Gate Compliance

Task 2 é `tdd="true`", mas a ordem do plano põe a implementação (Task 1) antes do teste (Task 2). Por isso o teste novo passou na primeira execução: não há RED honesto a registrar e nenhum foi fabricado. A prova de que os testes não são vácuos foi feita por mutação temporária: com o `inbox-columns.tsx` de `beb8a86~1` (antes da Task 1) restaurado no disco, os testes (1) e (3) falham e (2) e (4) passam; o arquivo foi devolvido ao HEAD antes do commit. Os testes (2) e (4) cobrem comportamento já existente (filtro por `channelId`; `capacidadesDoCanal` de 08-02) e funcionam como regressão: (4) afirma tanto a presença do marcador no Canal oficial quanto a ausência no não oficial.

Gates: `feat(08-11)` `beb8a86` precede `test(08-11)` `afbfbcb`; não há `refactor`. Sequência RED→GREEN não aplicável, pelo motivo acima.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Observação fora de escopo (não alterada): `isOutsideWindow` em `inbox-columns.tsx` usa a última atividade da Conversa como "agora" (`Date.parse(lastActivity(conversation))`), então uma Conversa cuja última Mensagem é a recebida nunca mostra "fora do Prazo" na lista, mesmo que a recebida seja de 30 h atrás em relação ao relógio. Para o teste (4) a recebida precede uma resposta enviada 30 h depois. Pré-existente e fora do que 08-11 muda; vale o dono avaliar se o "agora" deveria ser `Date.now()`.

## Verification

- `npm run typecheck` (três workspaces): limpo.
- `eslint` nos dois arquivos: limpo.
- `npm run verificar:tokens -w @n1/web`: 0 falhas.
- `vitest run src/features/crm/inbox-columns.test.tsx`: 4/4. Suíte `@n1/web` inteira: 546/546.
- Critérios de aceite: `grep -c "rotuloDoCanal("` = 3 (≥ 2); `grep -c "channel.name"` = 1 (≥ 1).

## Threat Flags

None. T-08-43 mitigado: o nome do Canal é renderizado como texto pelo React, sem `dangerouslySetInnerHTML`.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- A Caixa de Entrada já diz o Canal em cada Conversa; restam 08-12 a 08-15.

## Self-Check: PASSED

- FOUND: apps/web/src/features/crm/inbox-columns.test.tsx
- FOUND: commit beb8a86, commit afbfbcb (ambos ancestrais de HEAD)

---
*Phase: 08-canais-de-comunica-o-conex-o-e-omnichannel-preparado*
*Completed: 2026-10-12*
