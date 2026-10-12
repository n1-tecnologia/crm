---
phase: 08-canais-de-comunica-o-conex-o-e-omnichannel-preparado
plan: 02
subsystem: inbox-channels
tags: [dominio, capacidades, janela-de-resposta, whatsapp, vitest, nextjs]

requires:
  - phase: 08-canais-de-comunica-o-conex-o-e-omnichannel-preparado
    provides: "ProvedorDeCanal, provedorDoCanal, Channel.provider/relational (plan 08-01)"
provides:
  - "capacidadesDoCanal(canal): Capacidades por Canal, com o provedor sobrepondo so o que difere (D-02)"
  - "responseWindowOpenUntil com callback por Canal"
  - "configurarCanal recusa Canal relacional (D-11)"
  - "os sete leitores de janela/modelo da web e os tres do dominio passam pela mesma funcao"
affects: [08-03, 08-07, 08-08, 08-09, 08-10, 08-11]

actuals:
  tokens: 14000
  tasks: 2
  commits: 3
plan_head_before: 28fee5f362796fbb2ddfa47e10c0c19cf354047e
plan_head_after: fcba9c59454ae361a00f5dd0477d4684dcd09ae3

tech-stack:
  added: []
  patterns:
    - "Capacidades continuam do Tipo (RN-CXE-05); funcao por Canal sobrepoe so o que o provedor muda"
    - "derive.ts recebe o leitor de Capacidades por callback para nao importar operations/ (sem ciclo)"

key-files:
  created:
    - packages/dominio/src/operations/capacidades-do-canal.test.ts
  modified:
    - packages/dominio/src/operations/conversations.ts
    - packages/dominio/src/derive.ts
    - packages/dominio/src/operations/canais.ts
    - packages/dominio/src/operations/canais.test.ts
    - "apps/web/src/app/(shell)/crm/caixa-de-entrada/configuracoes/page.tsx"
    - "apps/web/src/app/(shell)/crm/caixa-de-entrada/configuracoes/canais/[canal]/page.tsx"
    - "apps/web/src/app/(shell)/crm/caixa-de-entrada/[conversa]/page.tsx"
    - apps/web/src/features/crm/inbox-columns.tsx
    - apps/web/src/features/crm/contact-card.tsx
    - apps/web/src/features/crm/conversation-thread.tsx
    - apps/web/src/features/ferramentas/flow-popup.tsx

key-decisions:
  - "capacidadesDoCanal devolve a propria linha da tabela do tipo (mesma referencia) quando o provedor nao muda nada; so o whatsapp-nao-oficial gera um objeto novo, sem responseWindowHours e com requiresTemplateOutsideWindow false."
  - "conversation-thread: as abas seguem por tipo; a Capacidade vem do Canal da Conversa da aba, senao do primeiro Canal ativo do tipo, senao undefined."
  - "receiveMessage, derive-conversacional, flows.ts (sendableMediaTypes) e tarefa-completa nao foram tocados: nao dependem de provedor."

patterns-established:
  - "Ler Capacidade de Canal sempre por capacidadesDoCanal(canal); CHANNEL_CAPABILITIES[tipo] fica so para o que nao varia por provedor"

requirements-completed: []

coverage:
  - id: D1
    description: "capacidadesDoCanal: nao oficial sem janela e sem modelo; oficial, Instagram, E-mail, LinkedIn, Chat do site e Canal sem provider iguais a tabela do tipo"
    requirement: CXE-D2
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/capacidades-do-canal.test.ts#capacidadesDoCanal (D-02)"
        status: pass
    human_judgment: false
  - id: D2
    description: "sendMessage e responseWindowOpenUntil por Canal: nao oficial com recebida ha 30 h envia sem modelo; oficial e Canal sem provider recusam com campo modelo"
    requirement: CXE-D2
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/capacidades-do-canal.test.ts#sendMessage fora da janela; #responseWindowOpenUntil por Canal"
        status: pass
    human_judgment: false
  - id: D3
    description: "configurarCanal recusa Canal com relational: true e nao altera o Canal"
    requirement: CXE-D1
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/canais.test.ts#configurarCanal e o Canal relacional (D-11)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Os sete leitores da web passam por capacidadesDoCanal sem sobrar leitor de janela/modelo por tipo (git grep vazio, typecheck e lint verdes, suites web e dominio verdes)"
    requirement: CXE-D2
    verification:
      - kind: other
        ref: "npm run typecheck; eslint dos sete arquivos; git grep dos leitores por tipo (exit 1); vitest apps/web (514) e packages/dominio (1713)"
        status: pass
    human_judgment: true
    rationale: "A troca e mecanica e coberta por tipo e testes, mas o efeito na tela (barra de modelo some, ponto verde de janela aberta, marcador fora da janela) para um Canal nao oficial so se confere com olho humano na UAT de fim de fase."

duration: 8min
completed: 2026-10-12
status: complete
---

# Phase 8 Plan 02: Capacidades por Canal Summary

**`capacidadesDoCanal` faz o WhatsApp nao oficial enviar livre a qualquer hora (sem janela de 24 h e sem modelo) no dominio e em sete telas, enquanto o oficial e todo Canal sem provedor seguem exatamente a tabela do tipo.**

## Performance

- **Duration:** 8 min
- **Tasks:** 2 (1 TDD, 1 auto)
- **Files modified:** 12 (1 criado, 11 alterados)
- **Commits:** 3

## Accomplishments

- Dominio: `capacidadesDoCanal` ao lado de `CHANNEL_CAPABILITIES`; `windowOpenUntil`, `sendMessage` e `startConversation` leem por Canal. `responseWindowOpenUntil` passou a receber o Canal no callback (`derive.ts` continua sem importar `operations/`).
- `configurarCanal` recusa Canal `relational` com a frase da ficha (D-11); o cabecalho de `canais.ts` registra `criarCanal` como caminho legado.
- Web: `configuracoes/page.tsx`, ficha do Canal, `[conversa]/page.tsx`, `isOutsideWindow`, ponto verde do `contact-card`, `conversation-thread` e `flow-popup` leem a Capacidade do Canal. O rodape da ficha agora diz que o provedor ajusta so onde difere.
- Primeiro teste de `responseWindowOpenUntil` (antes sem nenhum), com relogio fixo por `vi.useFakeTimers`.

## Task Commits

1. **Task 1 RED:** `8ac67da` (test) - testes de D-02 no dominio e da recusa de `configurarCanal` relacional
2. **Task 1 GREEN:** `e8466f4` (feat) - `capacidadesDoCanal`, leitores do dominio, `responseWindowOpenUntil` por Canal, recusa relacional
3. **Task 2:** `fcba9c5` (feat) - os sete leitores da web

**Plan metadata:** commit `docs(08-02)` seguinte a este arquivo.

## Files Created/Modified

- `packages/dominio/src/operations/capacidades-do-canal.test.ts` - prova D-02 (10 casos)
- `packages/dominio/src/operations/conversations.ts` - `capacidadesDoCanal` e leitores por Canal
- `packages/dominio/src/derive.ts` - `responseWindowOpenUntil` com callback por Canal
- `packages/dominio/src/operations/canais.ts` / `canais.test.ts` - recusa de Canal relacional
- Sete arquivos de `apps/web/src` (listados no frontmatter) - troca do leitor

## Decisions Made

Ver `key-decisions` no frontmatter. Em especial: as abas do `conversation-thread` seguem por tipo (D-14 e do plano 08-10), e so a origem da Capacidade mudou.

## Deviations from Plan

### TDD Gate Compliance (Task 1)

- **RED:** `8ac67da`. Em `capacidades-do-canal.test.ts` e `canais.test.ts`, 8 testes falharam: `capacidadesDoCanal` ainda nao existia (import `undefined`, "is not a function"), `sendMessage` do Canal nao oficial com recebida de 30 h voltava `ok: false` (a tabela por tipo exigia modelo) e `configurarCanal` aceitava Canal relacional. Avaliacao semantica: cada teste-alvo executou e falhou no assert planejado, nao por sintaxe, fixture ou descoberta zero. Os testes que ja descrevem o comportamento preservado (oficial recusa, sem provider recusa, oficial dentro da janela envia) passaram antes da implementacao porque o comportamento de hoje ja os cumpre; eles guardam a regressao do Canal sem provider (T-08-10). O plano e `type: execute` (tarefa `tdd="true"`), entao o classificador `gsd_run check tdd-red-evidence` nao foi invocado; a evidencia e a saida real do vitest acima.
- **GREEN:** `e8466f4`, todos os testes do passo verdes (278 nos quatro arquivos do verify; 1713 na suite inteira do dominio).
- **REFACTOR:** nenhum.

### Registro de ambiente

**Commits em `main`:** o orquestrador mandou ficar em `main` (isolamento `none`, `branching_strategy: none`); a assertiva de HEAD protegido do protocolo de commit foi tratada como nao aplicavel neste modo sequencial, como em 08-01. Nenhum `git update-ref`, stash, clean ou troca de branch.

**Janela entre commits:** entre `e8466f4` e `fcba9c5` o typecheck da web ficaria quebrado (os dois chamadores de `responseWindowOpenUntil` ainda passavam o callback por tipo), por causa da divisao em duas tarefas do proprio plano. `fcba9c5` fecha; nenhum commit ficou publicado assim.

**Total deviations:** 0 correcoes automaticas. **Impact on plan:** nenhum.

## Issues Encountered

- Um `sed -i` de BSD falhou ao inserir o import de `Channel` em `derive.ts`; refeito com Python. Sem efeito no resultado.

## Known Stubs

Nenhum.

## Threat Flags

Nenhum alem do `<threat_model>`. Mitigacoes: T-08-09 (um leitor so; `git grep` de leitores por tipo vazio), T-08-10 (testes do Canal sem `provider` iguais a tabela e recusando fora da janela), T-08-11 (recusa no dominio, teste em `canais.test.ts`).

## User Setup Required

None - no external service configuration required. Banco nao foi usado neste plano.

## Next Phase Readiness

- Os proximos planos que tocam estes arquivos web (08-08, 08-09, 08-10, 08-11) partem do leitor ja trocado.
- `CXE-D2` e `CXE-D1` sao compartilhados com planos irmaos; a marcacao como concluido depende de `requirements.ready-ids`.

---
*Phase: 08-canais-de-comunica-o-conex-o-e-omnichannel-preparado*
*Completed: 2026-10-12*

## Self-Check: PASSED
