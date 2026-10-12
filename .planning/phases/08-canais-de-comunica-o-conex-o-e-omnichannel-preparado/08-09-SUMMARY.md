---
phase: 08-canais-de-comunica-o-conex-o-e-omnichannel-preparado
plan: 09
subsystem: inbox-channels
tags: [nextjs, react, vitest, canais, rest, conexao-simulada, swr]

requires:
  - phase: 08-canais-de-comunica-o-conex-o-e-omnichannel-preparado
    provides: "08-01 cliente HTTP e selos; 08-02 capacidadesDoCanal e a recusa de configurarCanal para relacional; 08-03 GET/PATCH /canais/:id e as ações sem corpo; 08-08 jornada que pousa nesta ficha"
provides:
  - "chaveDoCanal, editarCanal, simularConexaoDoCanal, desconectarCanal, arquivarCanal em apps/web/src/dados/crm/canais.ts"
  - "ficha do Canal relacional religada por REST: provedor, origem, conexão simulada marcada, desconectar, arquivar com confirmação"
  - "Setor e Origem do Canal relacional por PATCH /canais/:id; o Canal do seed segue por configurarCanal"
affects: [08-10, 08-12, 08-13, 08-14]

actuals:
  tokens: 28000
  tasks: 2
  commits: 4
plan_head_before: 97df1df14cd94456565e47e0e98313030a15a20f
plan_head_after: e3c8f10b77187154275658cce2e02afd2dd3cb90

tech-stack:
  added: []
  patterns:
    - "gravar interno de canais.ts no molde de funis.ts: corpo só quando definido, invalida /canais só no sucesso"
    - "uma página, dois caminhos de escrita decididos por channel.relational (REST para a tabela própria, operação para o seed)"
    - "permissão da tela por usePodeNoCrm(<ação>, 'canal') só esconde; o servidor barra com 403"

key-files:
  created:
    - apps/web/src/features/crm/ficha-do-canal.test.tsx
  modified:
    - apps/web/src/dados/crm/canais.ts
    - apps/web/src/dados/crm/canais.test.ts
    - "apps/web/src/app/(shell)/crm/caixa-de-entrada/configuracoes/canais/[canal]/page.tsx"

key-decisions:
  - "criarCanal passou a usar o mesmo gravar interno das outras escritas de Canal; o comportamento (POST /canais com JSON e invalidação só no sucesso) não mudou e o teste de 08-01 continua verde."
  - "O Canal relacional arquivado desabilita Setor e Origem na ficha com a frase 'Um Canal arquivado não se configura.', em vez de deixar o PATCH voltar CANAL_ARQUIVADO."
  - "O bloco Conexão não aparece para o Canal do seed: configurarCanal recusa relacional e a api não conhece o do seed, então os dois caminhos não se cruzam (T-08-38)."
  - "Assunção do dono (Open Question 7): Simular conexão existe no Espaço de produção para quem administra, sempre marcada. Desligá-la por Espaço ou por provedor quando o primeiro provedor real chegar fica para ele decidir."

patterns-established:
  - "Hooks de permissão (usePodeNoCrm) antes do retorno antecipado de 'não encontrado', para a ordem dos hooks não depender do Canal."

requirements-completed: [CXE-W1]

coverage:
  - id: D1
    description: "Cliente HTTP de Canais completo: PATCH com JSON, as três ações por POST sem corpo e sem content-type, 409 TRANSICAO_INVALIDA como ErroDeApi, invalidação de /canais só no sucesso"
    requirement: CXE-W1
    verification:
      - kind: unit
        ref: "apps/web/src/dados/crm/canais.test.ts#editarCanal; #simularConexaoDoCanal; #desconectarCanal; #arquivarCanal; #chaveDoCanal"
        status: pass
    human_judgment: false
  - id: D2
    description: "Administrador simula a conexão na ficha do Canal relacional: POST sem corpo, re-hidratação e Toast; Membro não vê o botão"
    requirement: CXE-W1
    verification:
      - kind: unit
        ref: "apps/web/src/features/crm/ficha-do-canal.test.tsx#(1) e (2)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A conexão simulada nunca aparece sem a marca 'conexão simulada' e o aviso de que nenhuma Mensagem sai da plataforma; Desconectar apaga o estado por POST"
    requirement: CXE-W1
    verification:
      - kind: unit
        ref: "apps/web/src/features/crm/ficha-do-canal.test.tsx#(3)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Arquivar com confirmação ('Arquivar o Canal?') e só então POST …/arquivar"
    requirement: CXE-W1
    verification:
      - kind: unit
        ref: "apps/web/src/features/crm/ficha-do-canal.test.tsx#(4)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Setor do Canal relacional por PATCH /canais/:id (sem a operação antiga) e o do seed por configurarCanal (sem fetch)"
    requirement: CXE-W1
    verification:
      - kind: unit
        ref: "apps/web/src/features/crm/ficha-do-canal.test.tsx#(5) e (6)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Aparência real da ficha: cabeçalho com três selos, faixa de aviso da simulação, bloco Conexão dentro do painel Configuração"
    requirement: CXE-W1
    verification: []
    human_judgment: true
    rationale: "Layout, hierarquia visual e legibilidade da faixa de aviso e dos botões só se conferem com olho humano; os testes provam comportamento e texto, não o visual. Fica para a UAT de fim de fase."

duration: 14min
completed: 2026-10-12
status: complete
---

# Phase 8 Plan 09: A ficha do Canal religada por REST Summary

**A ficha do Canal passa a conectar (simulado e visivelmente marcado), desconectar, arquivar e configurar Setor e Origem do Canal relacional por REST, enquanto o Canal do seed segue pela operação antiga.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-10-12T17:47:00Z
- **Completed:** 2026-10-12T18:01:00Z
- **Tasks:** 2 (ambas `tdd="true"`)
- **Files modified:** 4 (1 criado, 3 alterados)

## Accomplishments

- `apps/web/src/dados/crm/canais.ts` ganhou `chaveDoCanal`, `editarCanal`, `simularConexaoDoCanal`, `desconectarCanal` e `arquivarCanal`, todos sobre um `gravar` interno que só manda `content-type` quando há corpo e só invalida `/canais` no sucesso.
- A ficha `[canal]/page.tsx` mostra o selo do provedor, o selo de origem e a marca "conexão simulada" no cabeçalho, mais a faixa com o aviso exato de D-08, e linhas "Provedor" e "Origem do cadastro" no painel Configuração.
- O bloco "Conexão" (só para o Canal relacional) oferece "Simular conexão", "Desconectar" e "Arquivar" (com `ConfirmDialog`), cada um só quando a ação faz sentido e `usePodeNoCrm(<ação>, "canal")` permite. Cada sucesso re-hidrata e mostra o Toast; `ErroDeApi` mostra a frase da api.
- `configurar` decide por `channel.relational`: relacional vai por `editarCanal` + `rehidratar()`; o do seed continua em `run(configurarCanal)` com `recusaDeGerirCanais`.

## Task Commits

1. **Task 1: cliente HTTP de Canais completo** (TDD)
   - RED: `70cd06a` test(08-09)
   - GREEN: `9160004` feat(08-09)
2. **Task 2: ficha do Canal religada** (TDD)
   - RED: `6579cc1` test(08-09)
   - GREEN: `e3c8f10` feat(08-09)

**Plan metadata:** commit docs(08-09) que leva este SUMMARY, STATE.md e ROADMAP.md.

## Files Created/Modified

- `apps/web/src/dados/crm/canais.ts` - escritas de Canal (editar, simular conexão, desconectar, arquivar) e `chaveDoCanal`
- `apps/web/src/dados/crm/canais.test.ts` - 8 casos novos: PATCH com JSON, POST sem corpo e sem content-type (três ações), 409 sem invalidação, chave
- `apps/web/src/app/(shell)/crm/caixa-de-entrada/configuracoes/canais/[canal]/page.tsx` - ficha religada (selos, faixa, bloco Conexão, dois caminhos de configuração)
- `apps/web/src/features/crm/ficha-do-canal.test.tsx` - 6 testes de componente da ficha

## Decisions Made

Ver `key-decisions` no frontmatter. Em resumo: `criarCanal` reaproveita o `gravar`; Canal arquivado trava Setor e Origem na própria tela; o bloco Conexão não existe para o Canal do seed; e a assunção do dono sobre "Simular conexão" em produção segue sinalizada.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Setor e Origem de Canal relacional arquivado ficam desabilitados com motivo**
- **Found during:** Task 2
- **Issue:** o plano manda a permissão de editar vir só de `usePodeNoCrm("editar", "canal")`. Com o Canal arquivado, o PATCH voltaria `CANAL_ARQUIVADO` e o Administrador veria um Select habilitado que sempre falha.
- **Fix:** `recusaDeConfigurar` acrescenta "Um Canal arquivado não se configura." para relacional arquivado (o controle desabilitado diz por quê, regra §11 do design).
- **Files modified:** `apps/web/src/app/(shell)/crm/caixa-de-entrada/configuracoes/canais/[canal]/page.tsx`
- **Verification:** typecheck e a suíte do web verdes; o servidor continua sendo quem barra.
- **Committed in:** e3c8f10

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** só estreita a tela; nenhum contrato de api ou de domínio mudou.

## TDD Gate Compliance

- Task 1: RED `70cd06a` (8 de 12 testes falhando por `is not a function`, o alvo era o comportamento planejado e não erro de sintaxe) e GREEN `9160004` (12 de 12). Não houve refactor.
- Task 2: RED `6579cc1` (5 de 6 falhando; os testes de comportamento falhavam por elementos ausentes na ficha antiga). O teste (2) "Membro não vê o botão" passou já no RED porque a ficha antiga não tinha botão nenhum, então um RED honesto para ele não existe. Provei que não é vácuo com uma mutação temporária: forcei `recusaDeSimular === undefined` (e as outras duas) para `true` na página e o teste (2) passou a falhar; a página foi restaurada do backup antes de qualquer commit. GREEN `e3c8f10` (6 de 6). Não houve refactor.
- Os relatórios de RED saíram do reporter padrão do Vitest, não do formato TAP, então `gsd_run check tdd-red-evidence` não foi rodado; a avaliação semântica acima (o alvo executou e falhou na asserção planejada) é a evidência registrada.

## Issues Encountered

- O nome acessível do `<h1>` da ficha inclui os selos, então os testes procuram o título por expressão regular (`/Suporte do Zap/`) em vez de nome exato. Não afeta a tela.
- `08-PROVAS.md`, onde o plano manda registrar a assunção do dono, ainda não existe em `.planning/phases/08-…/`. A decisão fica registrada em `key-decisions` aqui e deve ser copiada para `08-PROVAS.md` quando ele for criado.

## Verification

- `npm run typecheck` (dominio, api, web) sem erros.
- `npx vitest run` em `@n1/web`: 58 arquivos, 536 testes passando (inclui `canais.test.ts` 12/12 e `ficha-do-canal.test.tsx` 6/6).
- `eslint` nos quatro arquivos tocados, sem avisos.
- `npm run verificar:tokens -w @n1/web`: 0 falhas.
- `grep -c "Conexão simulada: o Canal aparece conectado para testar o chat"` na página: 1.

## Known Stubs

None.

## Threat Flags

None. T-08-36 (marca e faixa de aviso), T-08-37 (botão ausente por `usePodeNoCrm`, servidor responde 403) e T-08-38 (`configurar` decide por `channel.relational`, testes 5 e 6) estão mitigados e cobertos por teste.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- O Canal novo agora vai de `desconectada` a `conectada` (simulada e marcada) pela ficha, que é o que 08-10 precisa para oferecê-lo em "Responder por".
- Pendente para o dono: decidir se "Simular conexão" some do Espaço de produção quando o primeiro provedor real chegar, e registrar em `08-PROVAS.md`.

## Self-Check: PASSED

- `apps/web/src/features/crm/ficha-do-canal.test.tsx` existe; `canais.ts`, `canais.test.ts` e `[canal]/page.tsx` alterados.
- Commits `70cd06a`, `9160004`, `6579cc1`, `e3c8f10` presentes em `main`.

---
*Phase: 08-canais-de-comunica-o-conex-o-e-omnichannel-preparado*
*Completed: 2026-10-12*
