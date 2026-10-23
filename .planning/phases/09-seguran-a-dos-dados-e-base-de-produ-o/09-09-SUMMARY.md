---
phase: 09-seguran-a-dos-dados-e-base-de-produ-o
plan: 09
subsystem: dominio
tags: [quem-pode, regressao, documentacao-executavel, operacoes, vitest, seg-03]

requires:
  - phase: 09-seguran-a-dos-dados-e-base-de-produ-o
    provides: "09-03: recusaDeEscritaNoCrmAntigo, restoreList e createReceivableSeries com conferência, sendMessageSemConferencia fora de OPERACOES"
provides:
  - "Seção '## Quem pode (1.2.4)' em packages/dominio/CONTEXT.md: 286 linhas, uma por chave de OPERACOES, com módulo, recusa chamada e observação"
  - "quem-pode.test.ts: a tabela é lida pelo teste e deixa o npm run check vermelho se faltar, sobrar ou repetir operação, ou se a Conferência estiver vazia, pendente ou 'sem conferência' sem justificativa"
  - "Dois achados de operação sem conferência (removeMember, spawnNextOccurrence) e uma conferência fraca (runLancamentoAgent) para a suíte adversarial e a passada exploratória"
affects: [09-12, 09-15, 09-21]

actuals:
  tokens: 11300
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Documentação executável: o CONTEXT.md é lido por um teste que cobra todas as chaves do registro"
    - "Achado honesto em vez de justificativa inventada: 'sem conferência' + 'LACUNA' na Observação"

key-files:
  created:
    - packages/dominio/src/quem-pode.test.ts
  modified:
    - packages/dominio/CONTEXT.md

key-decisions:
  - "A coluna Conferência nomeia só quem pode (Papel, estado, alcance, dono). As recusas de estado do ativo (recusaExternaNoGrupo, recusaDoCanal, recusaDeEnvioDeFlow…) ficam na Observação, porque olham o Canal ou o Flow, não o Membro."
  - "As duas recusaDeMembroAtivo (ferramentas/permissoes.ts barra Convidado; ia/permissoes-ia.ts não) ficam sob o mesmo nome na tabela, e a legenda e as linhas de ia/ dizem qual é qual."
  - "Operação cuja conferência está no corpo (chat, pastas de chat, cronômetro, members.ts) usa 'dono do registro' ou 'recusa embutida (…)', e a Observação diz qual é."
  - "Lacuna real não vira justificativa: removeMember e spawnNextOccurrence ficam 'sem conferência' com 'LACUNA — ver 09-09-SUMMARY'. Este plano não as corrige."

patterns-established:
  - "Seção de CONTEXT.md com formato fixo que um teste de domínio lê"

requirements-completed: [SEG-03]

duration: 11min
completed: 2026-10-22
status: complete
plan_head_before: 030682f3f5c5631b4e3dae5e5898c7d1ee78cced
plan_head_after: 84befb28b7f9bca0739bd2944a7068965623ded1
commits: 2

coverage:
  - id: D1
    description: "A seção Quem pode (1.2.4) tem uma linha para cada uma das 286 chaves de OPERACOES, com a recusa que a operação chama ou a justificativa"
    requirement: SEG-03
    verification:
      - kind: unit
        ref: "packages/dominio/src/quem-pode.test.ts#nenhuma operação do registro fica sem linha na tabela, e toda linha é legível"
        status: pass
      - kind: unit
        ref: "packages/dominio/src/quem-pode.test.ts#nenhuma linha fala de operação que não existe em OPERACOES"
        status: pass
      - kind: unit
        ref: "packages/dominio/src/quem-pode.test.ts#nenhuma operação aparece em duas linhas"
        status: pass
    human_judgment: false
  - id: D2
    description: "Nenhuma linha fica com Conferência vazia ou 'a conferir', e nenhuma diz 'sem conferência' sem justificativa; operação nova sem linha deixa o npm run check vermelho"
    requirement: SEG-03
    verification:
      - kind: unit
        ref: "packages/dominio/src/quem-pode.test.ts#a coluna Conferência nunca está vazia nem diz 'a conferir'"
        status: pass
      - kind: unit
        ref: "packages/dominio/src/quem-pode.test.ts#'sem conferência' nunca vem sem justificativa na Observação"
        status: pass
    human_judgment: false
  - id: D3
    description: "A coluna Arquivo de cada linha é o módulo de onde registro.ts importa a operação (linha velha não passa)"
    requirement: SEG-03
    verification:
      - kind: unit
        ref: "packages/dominio/src/quem-pode.test.ts#o Arquivo de cada linha é o módulo de onde registro.ts importa a operação"
        status: pass
    human_judgment: false
  - id: D4
    description: "O que cada recusa nomeada significa, e que o 403 de suspenso da rota vale antes de toda a tabela e as variantes …SemConferencia não são operações registradas, estão escritos na legenda"
    requirement: SEG-03
    verification: []
    human_judgment: true
    rationale: "Texto de legenda: nenhum teste afirma que a explicação está correta e legível; quem lê a seção precisa conferir."
  - id: D5
    description: "Cada conferência da tabela é a que o corpo da operação realmente chama (não a que um nome sugere)"
    requirement: SEG-03
    verification: []
    human_judgment: true
    rationale: "O teste cobra a presença e o formato das linhas, não a veracidade do nome da recusa; a veracidade foi conferida lendo o código de cada operação e fica para a suíte adversarial (09-12, 09-15) provar por comportamento."
---

# Phase 9 Plan 09: Quem pode (1.2.4) Summary

**Tabela de 286 linhas em `packages/dominio/CONTEXT.md` com a recusa que cada operação do registro chama, lida por `quem-pode.test.ts` para que operação nova sem linha deixe o `npm run check` vermelho; a varredura achou duas operações que gravam sem olhar quem chama (`removeMember`, `spawnNextOccurrence`) e as registrou como LACUNA, sem corrigi-las.**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-10-22T22:29Z (hora local, logo depois do `docs(09-08)`)
- **Completed:** 2026-10-22T22:40Z
- **Tasks:** 2
- **Files modified:** 2 (`quem-pode.test.ts` novo, `CONTEXT.md` do domínio)

## Accomplishments

- **A tabela cobre o registro inteiro.** 286 linhas, na ordem de `OPERACOES`, com a coluna Arquivo igual ao módulo de onde `registro.ts` importa. O número bate com `Object.keys(OPERACOES).length` porque o teste o cobra.
- **O teste tem dentes.** Foi mutado à mão sobre o `CONTEXT.md`: linha removida, operação inventada, linha repetida, "a conferir", Conferência vazia, "sem conferência" sem justificativa e Arquivo errado. Cada mutação derrubou exatamente o teste certo, e o arquivo foi restaurado depois.
- **As conferências foram lidas, não adivinhadas.** Um script descartável (na pasta de rascunho da sessão, fora do repositório) achou as chamadas de recusa por função e por um nível de ajudante; 20 operações sem recusa achada foram lidas uma a uma, e as demais tiveram o corpo conferido nos pontos onde o nome sozinho enganaria (guarda condicional, ajudante com mesmo nome em outro módulo, composição).
- **Legenda.** Diz o que cada nome de recusa significa em uma linha, que o 403 de suspenso da rota (`recusaDeSuspenso`, 1.2.1) vale antes de toda a tabela, e que as variantes `…SemConferencia` do 09-03 não são operações registradas.

## Task Commits

1. **Task 1: o teste que lê a tabela e o rascunho dela (RED)** - `c9a8700` (test). Seção com as 286 linhas; 20 ficaram "a conferir". Só o teste da coluna Conferência falha, listando as 20; "sem linha" passa e `tsc` passa.
2. **Task 2: cada linha "a conferir" resolvida (GREEN)** - `84befb2` (feat). Zero pendências; as 6 provas passam e a suíte inteira do domínio fica verde (101 arquivos, 1975 testes).

**Plan metadata:** commit `docs(09-09)` seguinte a este arquivo.

## Achados para a suíte adversarial (09-12, 09-15) e a passada exploratória (09-21)

Linhas marcadas "LACUNA — ver 09-09-SUMMARY" na tabela. Este plano não corrige nenhuma; o domínio não foi tocado.

1. **`removeMember` (`operations/members.ts`) — grave.** Não olha quem chama. Em `POST /operacoes/removeMember`, qualquer Membro, Convidado incluído, remove outro Membro (só o Proprietário do Espaço é protegido por `ownerMemberId`) e passa ao Sucessor que ele escolher os Contatos, Empresas, Negócios, Agentes, Painéis, Coleções, Automações e Formulários do removido. A rota só valida o formato dos argumentos (`z.tuple([ID, ID])` em `apps/api/src/rotas/esquemas/membros.ts`). As outras operações de `members.ts` conferem o Papel base de quem chama; esta não. Teste sugerido: Convidado e Membro de base `membro` chamam `removeMember` e o estado não muda.
2. **`spawnNextOccurrence` (`operations/collaboration.ts`) — médio.** Não olha quem chama nem o alcance da Tarefa. Em `POST /operacoes/spawnNextOccurrence`, qualquer Membro (Convidado incluído) cria a próxima ocorrência de qualquer Tarefa recorrente já concluída, copiando título, descrição e o que a Regra manda copiar para a mesma Lista. A tela chega aqui por `changeTaskStatus`, que confere; o registro expõe a função crua. Teste sugerido: Convidado e Membro que não vê a Tarefa chamam a operação e a Lista não ganha Tarefa.

Conferência **fraca** (existe, mas não recusa tudo), não marcada como LACUNA:

3. **`runLancamentoAgent` (`operations/financeiro.ts`).** Exige só `memberSeesTask` e a concessão do Agente (`agentSeesTask`); não recusa Convidado nem Membro não ativo. O pedido ao Financeiro passa por `addTaskComment` (`taskCommentRefusal`), mas a Execução de sombra é gravada antes. O 403 de suspenso da rota cobre o segundo caso; o Convidado com `ver` na Tarefa fica para a suíte provar.
4. **Operações de `members.ts` (`alterarEmailDoConvite`, `alterarPapelDoMembro`, `inviteMember`, `deleteRole`, `grantGovernanceAccess`) e `stopTimer`** conferem o Papel base (ou o dono do cronômetro) sem olhar o estado do Membro. Um suspenso só é barrado pelo 403 da rota (1.2.1); está dito na Observação de cada linha.

## Files Created/Modified

- `packages/dominio/src/quem-pode.test.ts` — 6 provas que leem a seção do `CONTEXT.md` e o `registro.ts`
- `packages/dominio/CONTEXT.md` — seção "Quem pode (1.2.4)": legenda e tabela de 286 linhas, depois de "Quando mexer"

## Decisions Made

- A coluna **Conferência** nomeia só quem pode (Papel, estado, alcance, dono). As recusas de estado do ativo (`recusaExternaNoGrupo`, `recusaDoCanal`, `recusaDeEnvioAoGrupo`, `recusaDeEnvioDeFlow`, `recusaDePublicacao`) olham o Canal, o Grupo ou o Flow, não o Membro; ficam na Observação para não parecerem conferência de ator.
- `recusaDeMembroAtivo` existe duas vezes: a de `ferramentas/permissoes.ts` barra o Convidado, a de `ia/permissoes-ia.ts` não. Mantive o mesmo nome na tabela (é o nome do código), expliquei na legenda e escrevi "aqui é a da IA (só Membro ativo)" nas linhas de `ia/` em que ela aparece junto de outra recusa.
- Operação cuja conferência está no corpo (chat, pastas de chat, cronômetro, `members.ts`, `setMemberCapacity`, `createAgent`) usa `dono do registro` ou `recusa embutida (…)`. Os dois nomes estão na lista de valores aceitos do plano.
- Os achados não foram corrigidos aqui: o plano é de tabela e regressão, e corrigir `removeMember` ou `spawnNextOccurrence` é trabalho de quem escreve a suíte adversarial (09-12 e 09-15), que já tem o teste que prova a correção.

## Deviations from Plan

### Auto-fixed Issues

Nenhuma correção automática.

### Ajuste de escopo (aditivo)

- **Sexto teste, não pedido.** O plano pede cinco comportamentos; acrescentei um sexto, "o Arquivo de cada linha é o módulo de onde `registro.ts` importa a operação". Sem ele, a coluna Arquivo envelhece em silêncio (a operação muda de módulo e a linha continua dizendo o antigo). A verificação do plano roda `-t "sem linha"` e o arquivo inteiro e passa. Custa uma leitura de `registro.ts` e nenhuma dependência nova.
- **O que "RED" quis dizer aqui.** O plano manda deixar o teste vermelho de propósito no primeiro commit. Antes de gerar a tabela rodei o teste sem a seção (falhou em "sem linha" com as 286 chaves listadas); o commit RED traz a seção com 20 linhas "a conferir" (as operações em que a varredura não achou recusa nenhuma), e só o teste da coluna Conferência falha, nomeando as 20.

**Total deviations:** 0 auto-fixed; 1 teste a mais, documentado acima.
**Impact on plan:** nenhum desvio de escopo.

## Issues Encountered

- A primeira varredura por script marcou ajudantes errados: um `const … => …;` de uma linha engolia o corpo da função seguinte e o `now()` aparecia como se conferisse `taskWriteRefusal`, e as quatro constantes de duas linhas de `grupos.ts` (`promoverParticipante`, `rebaixarParticipante`, `ativarCaptacao`, `inativarCaptacao`) herdavam a recusa de `sairDoGrupo`. O script foi corrigido e cada uma dessas linhas foi lida no código antes de entrar na tabela.
- `packages/dominio` não é coberto por ESLint (nota do 09-02); a verificação de qualidade foi `tsc --noEmit` e a suíte do domínio.

## Known Stubs

Nenhum.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: operacao-sem-conferencia | packages/dominio/src/operations/members.ts | `removeMember` grava sem conferir quem chama (T-09-45 achado, não mitigado aqui) |
| threat_flag: operacao-sem-conferencia | packages/dominio/src/operations/collaboration.ts | `spawnNextOccurrence` cria Tarefa sem conferir quem chama nem o alcance (T-09-45 achado) |

T-09-45 fica mitigada na parte "operação nova sem conferência não passa despercebida" (tabela mais teste no `npm run check`); as duas lacunas acima são o que a tabela encontrou na primeira leitura. T-09-46: nenhuma justificativa foi inventada; as duas linhas sem justificativa honesta dizem LACUNA. T-09-SC: nenhum pacote instalado.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **09-12 e 09-15** (suíte adversarial) recebem a lista acima e sabem onde está cada uma na tabela; a prova esperada é "Convidado chama, `ok: false`, estado intacto".
- **09-21** (passada exploratória) pode usar `runLancamentoAgent` e o caso do suspenso nas operações de `members.ts` como roteiro de casos de borda.
- Quem acrescentar uma operação a `OPERACOES` precisa acrescentar a linha na tabela, no módulo certo, ou o `npm run check` fica vermelho.
- Verificação: `cd packages/dominio && npx vitest run` = 101 arquivos, 1975 testes verdes; `npx tsc --noEmit` verde. Nenhum arquivo fora de `packages/dominio` mudou; os testes de `apps/api` e `apps/web` não foram executados.

## Self-Check: PASSED

`packages/dominio/src/quem-pode.test.ts` e a seção `## Quem pode (1.2.4)` (1 ocorrência) existem; a seção tem 286 linhas de operação, igual a `Object.keys(OPERACOES).length`; os commits `c9a8700` e `84befb2` estão no histórico; nenhuma linha "a conferir"; as duas linhas LACUNA (`removeMember`, `spawnNextOccurrence`) estão listadas neste arquivo; nenhum processo iniciado por este plano segue rodando.

---
*Phase: 09-seguran-a-dos-dados-e-base-de-produ-o*
*Completed: 2026-10-22*
