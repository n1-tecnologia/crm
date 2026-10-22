---
phase: 09-seguran-a-dos-dados-e-base-de-produ-o
plan: 01
subsystem: api
tags: [privacidade, chat, visibilidade, get-estado, vitest, postgres-local, seg-01]

requires:
  - phase: 08-canais-conversas-e-mensagens
    provides: "projeção de Canais relacionais em GET /estado (roda antes de visibilidadePara; channels não é recortado)"
provides:
  - "membroVeSessaoDeChat em @n1/dominio/derive: regra única de leitura da Sessão de Chat (dono, Membro, Equipe), válida para todo Papel"
  - "visibilidadePara recorta chatSessions, chatFolders e agentExecutions de Sessão oculta a partir do estado inteiro, sem retorno antecipado"
  - "fábrica apps/api/src/testes/espaco-de-vazamento.ts (dois Membros reais, frases únicas) e teste HTTP de vazamento em estado.test.ts"
  - "commit da ponte usuarios:criar do dono (Tarefa 0 da fase)"
affects: [09-02, 09-07, 09-12, 09-15, 09-17, 09-20]

actuals:
  tokens: 8500
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Recorte de leitura nasce no domínio (visibilidadePara) a partir do estado INTEIRO; a rota GET /estado não muda"
    - "Teste de vazamento procura o TEXTO único no corpo da resposta, não só ids"
    - "Testes que semeiam dado usam describeComBanco (Postgres local, nunca o Supabase do .env)"

key-files:
  created:
    - apps/api/src/testes/espaco-de-vazamento.ts
    - apps/api/src/autenticacao/criar-usuario.cli.ts
  modified:
    - packages/dominio/src/derive.ts
    - packages/dominio/src/derive-visibilidade.ts
    - packages/dominio/src/derive-visibilidade.test.ts
    - apps/api/src/rotas/estado.test.ts
    - apps/api/package.json
    - apps/web/src/app/(shell)/ia/chat/[sessao]/page.tsx
    - apps/web/src/app/(shell)/configuracoes/membros/page.tsx

key-decisions:
  - "limparEspacoDeVazamento delega a limparEspaco de banco-crm.ts (superconjunto transacional do que o plano pedia): 09-07 e 09-12 acrescentam registros em outras tabelas sem reescrever a limpeza"
  - "O teste de domínio 'sem nada oculto, o estado volta como veio' foi reescrito: o atalho saiu (Pitfall 1), então a afirmação passou a ser sobre a Estrutura inteira do Proprietário"

patterns-established:
  - "IA pessoal (Sessão, pasta, Execução de Sessão) fora de ocultos = fora de GET /estado, de filtrarOrdens e de filtrarDiferenca"
  - "Sessão compartilhada chega sem folderId quando a pasta é de outro Membro"

requirements-completed: [SEG-01]

duration: 12min
completed: 2026-10-22
status: complete
plan_head_before: 78fe1bea1eaa0cf8e509b98fc95ff1642299812f
plan_head_after: a8a683c825f76c1bd32f887f2f428087b47d2b59

coverage:
  - id: D1
    description: "Tarefa 0: criar-usuario.cli.ts e o script usuarios:criar do dono entram sozinhos num commit, antes de qualquer código da Fase 9"
    requirement: SEG-01
    verification:
      - kind: other
        ref: "git show --name-only f75f7b7 lista exatamente apps/api/package.json e apps/api/src/autenticacao/criar-usuario.cli.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "membroVeSessaoDeChat devolve verdadeiro só para dono, Membro compartilhado e Equipe compartilhada, para todo Papel"
    requirement: SEG-01
    verification:
      - kind: unit
        ref: "packages/dominio/src/derive-visibilidade.test.ts#visibilidadePara — Sessão de Chat, pasta e execução (D-01, D-22)"
        status: pass
    human_judgment: false
  - id: D3
    description: "GET /estado de B (e do Proprietário) não contém Sessão, pasta nem texto de mensagem/entrada/saída de A, contra Postgres local com dois Membros reais"
    requirement: SEG-01
    verification:
      - kind: integration
        ref: "apps/api/src/rotas/estado.test.ts#GET /estado — vazamento entre Membros: Sessão de Chat (D-01, D-22)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A página ia/chat/[sessao] decide o acesso pela mesma membroVeSessaoDeChat; o diálogo de remover Membro não mostra mais a contagem de Sessões do outro"
    requirement: SEG-01
    verification:
      - kind: other
        ref: "npm run typecheck; npx eslint das duas páginas; grep de membroVeSessaoDeChat e 'deixam de ser acessíveis'"
        status: pass
    human_judgment: true
    rationale: "Não há teste de interface para a página de Chat nem para o diálogo; a conferência visual (Sessão alheia mostra NoAccessState, diálogo mostra o texto sem número) fica para a verificação da fase."
  - id: D5
    description: "estado.test.ts usa o guarda local-only describeComBanco; nenhum teste do arquivo semeia dado contra o Supabase do .env"
    requirement: SEG-01
    verification:
      - kind: other
        ref: "grep: Boolean(process.env.DATABASE_URL) = 0, describeComBanco = 4; vitest em localhost:55601 sem 'skipped'"
        status: pass
    human_judgment: false
---

# Phase 9 Plan 01: Traçador — a Sessão de Chat de A não chega a B Summary

**`membroVeSessaoDeChat` no domínio, aplicada em `visibilidadePara` sem retorno antecipado: Sessão de Chat, pasta e texto de execução de agente de um Membro deixam de sair por `GET /estado` para qualquer outro — Proprietário incluído — provado por HTTP com dois Membros reais no Postgres local.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-10-22T20:21Z (aprox.; o ledger de HEAD foi gravado às 20:27 depois da leitura)
- **Completed:** 2026-10-22T20:34Z
- **Tasks:** 3 (Tarefa 0, Task 1 traçador, Task 2)
- **Files modified:** 9

## Accomplishments

- Tarefa 0: a ponte `usuarios:criar` do dono está commitada sozinha (`f75f7b7`), antes de qualquer código da fase. `git diff` confirmou que `package.json` diferia por uma única linha.
- Domínio: `membroVeSessaoDeChat` é a regra única de leitura da Sessão (DO-CHT-09); `visibilidadePara` recorta `chatSessions`, `chatFolders` e `agentExecutions` a partir do estado inteiro, põe os ids em `ocultos` (então `filtrarOrdens` e `filtrarDiferenca` também os tiram) e entrega a Sessão compartilhada sem `folderId` quando a pasta é de outro. O retorno antecipado `ocultos.size === 0` saiu.
- API: fábrica `espaco-de-vazamento.ts` e bloco de teste HTTP em `estado.test.ts` que procura as frases únicas no corpo inteiro (como B e como Proprietário) e confirma que todas as chaves de `COLECOES`/`SINGULARES` continuam presentes. A rota `estado.ts` não mudou.
- Web: a página de Chat usa a mesma função (segunda barreira); o diálogo de remover Membro não mostra mais a contagem de Sessões (o servidor não a manda).
- F9: `estado.test.ts` deixou de usar `Boolean(process.env.DATABASE_URL)`; usa `describeComBanco` e `prepararBancoCrm()`.

## Task Commits

1. **Tarefa 0: ponte usuarios:criar do dono** — `f75f7b7` (chore)
2. **Task 1: traçador (domínio → GET /estado → tela)** — `4540660` (feat)
3. **Task 2: recorte de Chat a fundo + diálogo de remover Membro** — `a8a683c` (test)

**Plan metadata:** commit `docs(09-01)` seguinte a este arquivo.

## TDD / Evidência

Task 1 é `tracer` e Task 2 é `tdd="true"`, mas a regra de Task 2 foi implementada em Task 1 (a ordem do plano), então os testes de Task 2 nasceram verdes: o gate "unexpected green" foi investigado e não indica teste errado.

- **RED do traçador (real):** com `derive-visibilidade.ts` voltado ao `HEAD` anterior, `estado.test.ts` falhou em (a), (b) e (c) pelo motivo planejado (a frase de A aparecia no corpo, e `ordens` carregava o id da Sessão de A). Com o código novo: 12/12, nenhum teste pulado. Não houve commit RED separado — a prova foi feita por reversão temporária do arquivo.
- **Task 2 (testes nascidos verdes):** validados por seis mutações, todas reprovadas pelos testes novos: sem remover `folderId`; pasta alheia passando; Execução não filtrada; Equipe ignorada; Proprietário lendo tudo; ids fora de `ocultos`.
- Não há `## TDD Gate Compliance` formal (o plano é `type: execute`, `workflow.tdd_mode` é `false`).

## Files Created/Modified

- `apps/api/src/autenticacao/criar-usuario.cli.ts` — ponte do dono (conteúdo intocado)
- `apps/api/package.json` — script `usuarios:criar` (uma linha)
- `packages/dominio/src/derive.ts` — `membroVeSessaoDeChat`
- `packages/dominio/src/derive-visibilidade.ts` — recorte de IA pessoal, sem retorno antecipado, cabeçalho atualizado
- `packages/dominio/src/derive-visibilidade.test.ts` — seis comportamentos novos, e a asserção "sem cópia" reescrita
- `apps/api/src/testes/espaco-de-vazamento.ts` — fábrica (novo)
- `apps/api/src/rotas/estado.test.ts` — guarda `describeComBanco` e bloco de vazamento
- `apps/web/src/app/(shell)/ia/chat/[sessao]/page.tsx` — acesso por `membroVeSessaoDeChat`
- `apps/web/src/app/(shell)/configuracoes/membros/page.tsx` — texto sem número

## Decisions Made

- `limparEspacoDeVazamento` delega a `limparEspaco` (de `banco-crm.ts`) em vez de apagar só `registros` e `workspaces`: é o mesmo apagamento, em transação, e já cobre as tabelas do CRM/Caixa que 09-07 e 09-12 vão tocar.
- A fábrica escolhe A e B por Papel base `membro`, estado `ativo` e `userId`, e falha com erro claro se o seed não tiver dois.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Teste de domínio que afirmava o comportamento removido**
- **Found during:** Task 1 (remoção do retorno antecipado)
- **Issue:** `derive-visibilidade.test.ts` afirmava "sem nada oculto, o estado volta como veio — sem cópia" (`toBe(state)`) dentro de `if (todos)`. Com o atalho removido (exigência do plano, Pitfall 1), nenhum Membro tem `ocultos` vazio e a asserção passava por vacuidade, sem testar nada.
- **Fix:** trocada por uma afirmação real: o Proprietário recebe todos os Espaços, Listas e Tarefas (a Estrutura inteira), e o comentário explica que o atalho não existe mais.
- **Files modified:** `packages/dominio/src/derive-visibilidade.test.ts`
- **Verification:** `npx vitest run src/derive-visibilidade.test.ts` — 13/13
- **Committed in:** `4540660`

---

**Total deviations:** 1 auto-fixed (1 bug de teste obsoleto)
**Impact on plan:** nenhum desvio de escopo; o plano pedia a remoção do atalho e este teste dependia dele.

## Issues Encountered

- Um `timeout` (comando inexistente no macOS) abortou a primeira tentativa de provar o RED; o arquivo foi restaurado a partir da cópia do scratchpad e a prova foi refeita sem ele. Nada ficou alterado.
- Aviso do `npm run lint` em `app-shell.tsx` (imports não usados, 3 warnings, 0 erros) é pré-existente e fora do escopo.

## Known Stubs

Nenhum.

## Threat Flags

Nenhum: o plano reduz superfície (T-09-01 a T-09-05 mitigados); não adiciona endpoint, caminho de auth nem esquema. T-09-SC: nenhum pacote instalado.

## User Setup Required

None - no external service configuration required. (Teste local: container `crm-n1-pg-0901`, porta 55601, `postgres:16`; o container sobe com `--rm` e foi parado ao fim.)

## Next Phase Readiness

- 09-02 (Convidado e Visão/Memória no domínio), 09-07 (teste completo) e 09-12/09-15 (suíte adversarial) consomem `espaco-de-vazamento.ts` e o padrão de `visibilidadePara`.
- Antes de desligar o cadastro aberto (09-17 em homologação, 09-20 em produção) a ponte `usuarios:criar` já está no histórico.
- Fora do escopo, não tocado: os testes `e2e` de `apps/api` que chamam `GET /estado` (usam o Supabase do `.env` e não foram executados aqui; `canais-projetados.test.ts` roda verde no Postgres local, 14/14).

## Self-Check: PASSED

Arquivos criados e commits (`f75f7b7`, `4540660`, `a8a683c`) conferidos no disco e no histórico; `npm run typecheck` (três workspaces), 1838 testes de domínio, 559 de web, `estado.test.ts` 12/12 sem pulados, lint com 0 erros e tokens verdes.

---
*Phase: 09-seguran-a-dos-dados-e-base-de-produ-o*
*Completed: 2026-10-22*
