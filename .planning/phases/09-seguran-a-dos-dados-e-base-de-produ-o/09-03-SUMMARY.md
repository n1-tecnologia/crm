---
phase: 09-seguran-a-dos-dados-e-base-de-produ-o
plan: 03
subsystem: dominio
tags: [crm-antigo, convidado, recusa-no-dominio, variante-interna, vitest, seg-03]

requires:
  - phase: 09-seguran-a-dos-dados-e-base-de-produ-o
    provides: "09-01: base de testes e recortes do domínio que as recusas deste plano reaproveitam"
provides:
  - "recusaDeEscritaNoCrmAntigo(state, actingMemberId): Membro ativo e Papel base diferente de convidado, a regra de escrita de podeNoCrm"
  - "Negócios (12 operações), Contatos/Empresas (13) e Conversas (9) recusam Convidado e Membro não ativo na primeira linha, com o estado intacto"
  - "sendMessageSemConferencia: variante interna da Automação, fora de OPERACOES"
  - "restoreList confere alcance e containerTrashRefusal como restoreContainer; createReceivableSeries chama listWriteRefusal(CR.listId) antes de validar"
affects: [09-07, 09-09]

actuals:
  tokens: 14000
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "Recusa de escrita do CRM antigo numa função só, chamada na primeira linha de cada operação registrada"
    - "Variante …SemConferencia exportada do módulo da operação, nunca acrescentada a OPERACOES, para composições internas"

key-files:
  created:
    - packages/dominio/src/operations/crm-antigo.ts
    - packages/dominio/src/operations/deals.test.ts
    - packages/dominio/src/operations/contacts.test.ts
    - packages/dominio/src/operations/conversations.test.ts
    - packages/dominio/src/operations/restaurar-lista-e-parcelas.test.ts
  modified:
    - packages/dominio/src/operations/deals.ts
    - packages/dominio/src/operations/contacts.ts
    - packages/dominio/src/operations/conversations.ts
    - packages/dominio/src/operations/tasks.ts
    - packages/dominio/src/operations/financeiro.ts
    - packages/dominio/src/operations/ferramentas/automacoes.ts
    - packages/dominio/src/operations/ferramentas/flows.ts
    - packages/dominio/src/operations/ferramentas/grupos.ts
    - packages/dominio/src/operations/iniciar-conversa.ts
    - packages/dominio/src/operations/tarefas-conversacionais.ts

key-decisions:
  - "startConversation não ganhou variante SemConferencia: ela já recusava Membro não ativo e Convidado antes da fase, então nenhuma composição perde nada por continuar chamando a exportada."
  - "Só a Automação (automacoes.ts) passa a enviar por sendMessageSemConferencia; flows, grupos, iniciar-conversa e tarefas-conversacionais mantêm as exportadas porque o ator já passou por recusaDeMembroAtivo, createDeal ou listWriteRefusal antes."
  - "restoreList reaproveita memberReachesContainer + containerTrashRefusal (as duas conferências que restoreContainer usa) em vez de delegar a restoreContainer, que também aplica colisão de nome (RN-ESP-23) e mudaria o comportamento de restoreList."
  - "As 6 operações de Contato/Empresa que já recusavam por mayCreateCrmRecord mantêm a conferência e a frase que tinham."

patterns-established:
  - "Teste de recusa por tabela (it.each): Convidado e suspenso contra todas as operações do módulo, frase conferida e estado toStrictEqual ao structuredClone"

requirements-completed: [SEG-03]

duration: 7min
completed: 2026-10-23
status: complete
plan_head_before: 2b5ba5ccf51ee9130bd6f3125d9ea7c4ec1a2849
plan_head_after: a6844f7b48ae61913552f6231410d8e6f9bdbb25

coverage:
  - id: D1
    description: "recusaDeEscritaNoCrmAntigo existe uma vez em crm-antigo.ts, recusa Membro ausente ou não ativo e Convidado, aceita Membro ativo de base membro"
    requirement: SEG-03
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/deals.test.ts#recusaDeEscritaNoCrmAntigo aceita Membro ativo de base membro, recusa Convidado, suspenso e ausente"
        status: pass
    human_judgment: false
  - id: D2
    description: "As 12 operações de Negócio recusam o Convidado e o Membro suspenso com a frase do CRM antigo e estado idêntico; winDeal ganha com Membro ativo de base membro"
    requirement: SEG-03
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/deals.test.ts#Negócios — 1.2.2"
        status: pass
    human_judgment: false
  - id: D3
    description: "As 13 operações de Contato e Empresa sem conferência recusam o Convidado e o suspenso com estado idêntico; as 6 que já recusavam seguem recusando; trashContact e addContactNote seguem com ok: true para Membro"
    requirement: SEG-03
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/contacts.test.ts#Contatos — 1.2.2"
        status: pass
    human_judgment: false
  - id: D4
    description: "As 10 operações de Conversa e Mensagem recusam o Convidado e o suspenso com estado idêntico; Membro ativo envia Mensagem e resolve Conversa; sendMessageSemConferencia nunca entra em OPERACOES"
    requirement: SEG-03
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/conversations.test.ts#Conversas — 1.2.2"
        status: pass
      - kind: unit
        ref: "packages/dominio/src/operations/conversations.test.ts#sendMessageSemConferencia — a variante das composições internas"
        status: pass
    human_judgment: false
  - id: D5
    description: "restoreList recusa como restoreContainer (Convidado e Membro sem excluir ok: false, Lista segue na lixeira); createReceivableSeries confere quem chama antes de validar a entrada"
    requirement: SEG-03
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/restaurar-lista-e-parcelas.test.ts"
        status: pass
    human_judgment: false
  - id: D6
    description: "As composições internas (Automações, Flows, Grupos, iniciar-conversa, Tarefas conversacionais) seguem funcionando: suíte inteira do domínio verde"
    requirement: SEG-03
    verification:
      - kind: unit
        ref: "cd packages/dominio && npx vitest run (99 arquivos, 1961 testes)"
        status: pass
    human_judgment: false
---

# Phase 9 Plan 03: Escritas sem conferência no domínio Summary

**`recusaDeEscritaNoCrmAntigo` na primeira linha de 34 operações registradas de Negócio, Contato/Empresa e Conversa, `restoreList` com a recusa de `restoreContainer`, `createReceivableSeries` com `listWriteRefusal`, e a Automação enviando por `sendMessageSemConferencia` (fora de `OPERACOES`).**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-10-23T00:16:30Z
- **Completed:** 2026-10-23T00:23:30Z
- **Tasks:** 3
- **Files modified:** 15 (todos em `packages/dominio/src/operations`, quatro testes novos e `crm-antigo.ts` novo)

## Accomplishments

- `crm-antigo.ts` guarda a regra de escrita do CRM antigo num lugar só: Membro `ativo` e Papel base diferente de `convidado`, a mesma de `podeNoCrm`. `mayWriteDeal` saiu de `deals.ts`.
- Negócios (12 operações), Contatos e Empresas (13 que não conferiam; as 6 que conferiam por `mayCreateCrmRecord` ficaram) e Conversas (9 mais `sendMessage`) recusam Convidado e Membro suspenso antes de qualquer outra conferência, e o estado fica `toStrictEqual` ao `structuredClone` de antes.
- `restoreList` aplica alcance + `containerTrashRefusal`, como `restoreContainer` já fazia; `createReceivableSeries` confere quem chama antes de validar a entrada, de modo que um Convidado com entrada inválida recebe a recusa, não a mensagem de validação.
- `sendMessage` virou "conferir e chamar `sendMessageSemConferencia`"; a Automação de `mensagem.enviarAoContato` usa a variante, que não está em `OPERACOES` (um teste trava isso).

## Task Commits

Cada tarefa tem um commit RED (`test`) e um GREEN (`feat`):

1. **Task 1: crm-antigo, Negócios, restoreList, createReceivableSeries** — RED `8b24960`, GREEN `8a2e80f`
2. **Task 2: Contatos e Empresas** — RED `24e83eb`, GREEN `30b7fb4`
3. **Task 3: Conversas e composições internas** — RED `19fc9f1`, GREEN `a6844f7`

**Plan metadata:** commit `docs(09-03)` seguinte a este arquivo.

## TDD / Evidência

O plano é `type: execute` (com `tdd="true"` por tarefa) e `workflow.tdd_mode` é `false`; não há `## TDD Gate Compliance` formal e o classificador `tdd-red-evidence` não foi usado. A evidência RED é a saída real do Vitest antes do código:

- **Task 1 RED:** 30 falhas em asserções do comportamento planejado (Convidado e suspenso com `ok: true`, ou com a frase antiga "altera Negócio" no lugar da frase do CRM; `restoreList` do Convidado com `ok: true`; entrada inválida de `createReceivableSeries` devolvendo a mensagem de validação). `crm-antigo.ts` entrou no commit RED como esqueleto que nunca recusa, para os testes falharem na asserção e não no import.
- **Task 2 RED:** 29 falhas em asserções (13 operações x Convidado e suspenso, mais três casos soltos); as 6 que já recusavam e os dois positivos de Membro passavam, como esperado.
- **Task 3 RED:** 23 falhas: 20 das tabelas, 2 soltas e `sendMessageSemConferencia is not a function`. O commit RED deixa `tsc` vermelho (importa a variante ainda inexistente), como o 09-02; o GREEN deixa `tsc` e a suíte verdes.

## Files Created/Modified

- `packages/dominio/src/operations/crm-antigo.ts` — `recusaDeEscritaNoCrmAntigo`
- `packages/dominio/src/operations/deals.ts` — `mayWriteDeal` removida, 12 operações com a conferência
- `packages/dominio/src/operations/contacts.ts` — 13 operações com a conferência
- `packages/dominio/src/operations/conversations.ts` — 9 operações com a conferência, `sendMessage` + `sendMessageSemConferencia`
- `packages/dominio/src/operations/tasks.ts` — `restoreList` confere alcance e `containerTrashRefusal`
- `packages/dominio/src/operations/financeiro.ts` — `createReceivableSeries` chama `listWriteRefusal(CR.listId)` primeiro
- `packages/dominio/src/operations/ferramentas/automacoes.ts` — envio pela variante interna
- `packages/dominio/src/operations/ferramentas/flows.ts`, `ferramentas/grupos.ts`, `iniciar-conversa.ts`, `tarefas-conversacionais.ts` — só comentários que registram por que mantêm as exportadas
- `deals.test.ts`, `contacts.test.ts`, `conversations.test.ts`, `restaurar-lista-e-parcelas.test.ts` — provas de 1.2.2 e 1.2.3

## Decisions Made

- `startConversation` não ganhou variante: ela já recusava Membro não ativo e Convidado (frases "Só um Membro ativo abre atendimento." e "Um Convidado não abre atendimento."), então a regra efetiva não mudou para nenhuma composição e não há o que contornar.
- Só `automacoes.ts` troca para a variante: os demais chamadores já tinham o ator conferido (`recusaDeMembroAtivo` em Flows e Grupos, `createDeal` em `iniciarConversa`, `listWriteRefusal` em `criarTarefaConversacional`) ou chamam `startConversation`, que confere por conta própria.
- `restoreList` reaproveita as conferências de `restoreContainer` em vez de delegar a ela, porque `restoreContainer` também recusa por colisão de nome (RN-ESP-23), o que mudaria o comportamento de `restoreList` além do que 1.2.3 pede.
- As seis operações de Contato/Empresa que conferiam por `mayCreateCrmRecord` ficam como estavam, com a frase "cria registro", como o plano mandou ("manter a que existe").

## Deviations from Plan

### Auto-fixed Issues

Nenhuma correção automática.

Pequenos desvios de forma, sem mudar o resultado:

- O plano cita `startConversationSemConferencia` como exemplo de variante. Não foi criada porque `startConversation` já conferia o ator (ver Decisions Made).
- O commit RED da Task 1 inclui `crm-antigo.ts` como esqueleto (a função existe e devolve `undefined`) para os testes falharem na asserção; o GREEN o substitui pela regra.

**Total deviations:** 0 auto-fixed; 2 ajustes de forma documentados acima.
**Impact on plan:** nenhum desvio de escopo.

## Issues Encountered

- `console.log` dentro do Vitest deste pacote não chega ao terminal; as sondas do seed (ids de Membros, Negócios, Conversas) escreveram em arquivo no scratchpad e foram apagadas do repositório.
- `git grep -E` com `\b` não casa neste ambiente; a varredura de chamadores internos foi refeita sem `\b`, e foi ela que mostrou que só a Automação precisa da variante.

## Known Stubs

Nenhum.

## Threat Flags

Nenhum: o plano só reduz superfície. T-09-13 a T-09-16 mitigadas no domínio; T-09-14 comprovada pela suíte inteira verde a cada tarefa. T-09-SC: nenhum pacote instalado. O 403 de Membro suspenso na rota continua sendo 09-07; esta é a segunda barreira.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **09-07** pode contar com a recusa pelo domínio para Convidado e suspenso nas rotas de `POST /operacoes/:nome` do CRM antigo.
- **09-09** (tabela "Quem pode") lista a recusa nova: "Um Convidado não altera o CRM" e "Só um Membro ativo altera o CRM".
- Efeito colateral a conferir em 09-08: um Convidado que abre uma Conversa agora recebe `ok: false` em `markConversationRead` e `toggleConversationStar`; se a tela chamar essas operações ao abrir o fio para um Convidado, ela precisa tratar a recusa em silêncio.
- Verificação: `cd packages/dominio && npx vitest run` = 99 arquivos, 1961 testes verdes; `npx tsc --noEmit` verde; `npm run typecheck` da raiz exit 0; `apps/web` 63 arquivos, 559 testes verdes. Os testes de `apps/api` que dependem de Postgres não foram executados (nenhum arquivo de `apps/api` mudou).

## Self-Check: PASSED

Os arquivos criados existem (`crm-antigo.ts`, `deals.test.ts`, `contacts.test.ts`, `conversations.test.ts`, `restaurar-lista-e-parcelas.test.ts`); os seis commits (`8b24960`, `8a2e80f`, `24e83eb`, `30b7fb4`, `19fc9f1`, `a6844f7`) estão no histórico; `grep -c` de `export function recusaDeEscritaNoCrmAntigo` = 1, `function mayWriteDeal` em `deals.ts` = 0, `recusaDeEscritaNoCrmAntigo(` em `deals.ts` = 12, `contacts.ts` = 13, `conversations.ts` = 10, `listWriteRefusal(state, actingMemberId, CR.listId)` em `financeiro.ts` = 1; `git grep SemConferencia -- registro.ts` sem resultado.

---
*Phase: 09-seguran-a-dos-dados-e-base-de-produ-o*
*Completed: 2026-10-23*
