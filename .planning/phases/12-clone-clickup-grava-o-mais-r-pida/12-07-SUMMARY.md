---
phase: 12-clone-clickup-grava-o-mais-r-pida
plan: 07
subsystem: web
tags: [store, otimista, lista-de-excecoes, segredo, jid, d-13]

requires:
  - phase: 12-clone-clickup-grava-o-mais-r-pida
    provides: store com confirmado/data, otimistaPara(chamadas) como ponto de extensão, fila serial e refazerPendentes (12-06)
provides:
  - OPERACOES_QUE_ESPERAM (nome da operação -> motivo) e esperaOServidor(chamadas) em apps/web/src/dados/operacoes-que-esperam.ts
  - otimistaPara consultando a lista (um gesto com qualquer operação dela não vira data na hora)
  - operacoes-que-esperam.test.ts com o conjunto fechado e as sete candidatas lidas que ficam otimistas
  - 12-PROVAS.md, seção "Operações que esperam o servidor (D-13)", com o veredito de cada candidata
affects: [12-08, 12-09, 12-10]

actuals:
  tokens: 6625
  tasks: 2
  commits: 4
plan_head_before: 331d3be53ce1976b7639a3fa11539dcaa36a7b2a
plan_head_after: 743acb4755d45377312e469ceed99c39f6af526f

tech-stack:
  added: []
  patterns:
    - "Lista de exceções como Map<NomeDeOperacao, motivo> na web, fechada por um teste que compara as chaves a uma constante em ordem alfabética"
    - "Regra conservadora: qualquer chamada da lista faz o gesto inteiro esperar"

key-files:
  created:
    - apps/web/src/dados/operacoes-que-esperam.ts
    - apps/web/src/dados/operacoes-que-esperam.test.ts
  modified:
    - apps/web/src/dados/store.ts
    - apps/web/src/dados/store.test.ts
    - apps/web/CONTEXT.md
    - .planning/phases/12-clone-clickup-grava-o-mais-r-pida/12-PROVAS.md

key-decisions:
  - "A lista fica com as catorze operações verificadas na RESEARCH: o levantamento mecânico não achou nenhuma a mais e as sete candidatas [ASSUMED] foram lidas e ficam otimistas."
  - "A lista mora na web (regra de tela), não no domínio; o servidor nunca a lê."
  - "decideProcessApproval e a conferência do resumo NÃO entram na lista: o resultado local é o do servidor, então não cumprem o critério. É uma decisão de produto do dono (ver Open items)."

patterns-established:
  - "Candidata lida e deixada otimista tem veredito com arquivo:linha em 12-PROVAS.md e um caso no teste que afirma que ela fica fora da lista"

requirements-completed: []

coverage:
  - id: D1
    description: "run(createForm) com transporte lento não põe o Formulário em data antes da resposta; depois da diferença, data tem o Formulário com o segredo que o servidor gerou, não o da cópia"
    requirement: GRV-05
    verification:
      - kind: unit
        ref: "apps/web/src/dados/store.test.ts#`createForm` não põe o Formulário em `data` antes da resposta; depois dela, `data` tem o segredo que o SERVIDOR gerou (T-12-17)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Um gesto que mistura createList e createForm espera inteiro: a Lista também não aparece antes da resposta; a recusa do servidor a uma operação da lista não deixa nada em data e traz a mensagem em lastResult"
    requirement: GRV-05
    verification:
      - kind: unit
        ref: "apps/web/src/dados/store.test.ts#um gesto que mistura `createList` e `createForm` espera inteiro"
        status: pass
      - kind: unit
        ref: "apps/web/src/dados/store.test.ts#a recusa do servidor a uma operação da lista não deixa nada em `data`"
        status: pass
    human_judgment: false
  - id: D3
    description: "A lista de exceções está no código com o motivo de cada uma (catorze entradas), toda chave é uma operação do registro e o conjunto é fechado por um teste"
    requirement: GRV-05
    verification:
      - kind: unit
        ref: "apps/web/src/dados/operacoes-que-esperam.test.ts (chaves válidas, motivos de pelo menos 20 caracteres, conjunto exato, esperaOServidor)"
        status: pass
    human_judgment: false
  - id: D4
    description: "O levantamento das candidatas [ASSUMED] e dos geradores aleatórios ou de contador do domínio está registrado em 12-PROVAS.md com arquivo:linha e veredito"
    requirement: GRV-05
    verification:
      - kind: other
        ref: "grep -c 'Operações que esperam o servidor (D-13)' 12-PROVAS.md = 1; uma linha para cada uma das sete candidatas"
        status: pass
    human_judgment: true
    rationale: "O veredito de cada candidata (por que ficou otimista) é leitura de código, conferida por teste só no efeito (fica fora da lista); a completude da varredura é juízo de quem revisa a tabela."
  - id: D5
    description: "Suíte web inteira, tsc e lint verdes depois de D-13 mudar o que os gestos da lista mostram"
    requirement: GRV-05
    verification:
      - kind: unit
        ref: "cd apps/web && npx vitest run (93 arquivos, 886 testes); npx tsc --noEmit; npm run lint -w @n1/web"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-11-02
status: complete
---

# Phase 12 Plan 07: A lista de operações que esperam o servidor Summary

**`operacoes-que-esperam.ts` lista, com o motivo de cada uma, as catorze operações cujo resultado local não é o do servidor (segredo de link, JID, link de convite, chave pública, resolução do `inviteMember`, agendador) e `otimistaPara` a consulta: um gesto com qualquer uma delas não vira `data` na hora e só aparece quando a diferença volta, com o segredo que o servidor gerou; o resto continua aparecendo na hora.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-11-02
- **Tasks:** 2 de 2 (a Task 1 é o traçador; o plano é `autonomous: true`, sem checkpoint)
- **Files modified:** 6 (2 novos), 348 linhas acrescentadas e 5 removidas

## Accomplishments

- **A lista (D-13).** `OPERACOES_QUE_ESPERAM: ReadonlyMap<NomeDeOperacao, string>` com as catorze entradas: `createForm`, `rotateFormSecret`, `shareTaskPublicly` (segredo aleatório), `criarGrupo`, `sincronizarGrupo`, `regenerarLinkDeConvite`, `criarComunidade`, `definirPontoDeTrocaDeDados`, `regenerarChavesDoPonto`, `publicarVersao`, `copiarFlow` (JID, link, chave e identificador do contador de módulo do provedor simulado), `inviteMember` (resolução só do servidor) e `runScheduledAutomations`, `runCalendarRecurrences` (agendador do servidor). O cabeçalho do arquivo traz o critério, o que fica otimista e a regra conservadora. `esperaOServidor(chamadas)` é `true` se alguma chamada está na lista.
- **O store a consulta.** `otimistaPara(chamadas)` = `chamadas.length > 0 && !esperaOServidor(chamadas)`. Uma pendente não otimista não vira `data`, vai ao servidor, e `refazerPendentes` já a ignorava; nenhuma outra linha do store mudou.
- **O traçador (T-12-17).** Com transporte que não responde, `run(createForm)` deixa `data.forms` sem o Formulário, `data === confirmado` e `pendentes` em 1; ao soltar a diferença do servidor, `data.forms` tem o Formulário com o segredo do servidor, diferente do que a cópia gerou. Um gesto com `createList` + `createForm` na mesma closure espera inteiro (a Lista também não aparece). A recusa do servidor não deixa nada em `data` e `lastResult.error` traz a mensagem.
- **O levantamento fechado.** Varredura mecânica de `secret(`, `gerarJid(`, `gerarEnderecoDeConvite(`, `gerarChavePublica(`, `gerarIdentificadorDeFlow(`, `gerarIdentificadorDeResposta(`, `crypto.`, `Math.random(`, `randomUUID(` e de todo `let` de módulo no domínio, função enclausurante e chamadores de cada ocorrência, e leitura do corpo das sete candidatas `[ASSUMED]`. Resultado e arquivo:linha em `12-PROVAS.md`. Nada novo entrou na lista; as sete ficam otimistas.
- **`apps/web/CONTEXT.md`** ganhou o parágrafo "O que espera o servidor (D-13)".

## Veredito das sete candidatas `[ASSUMED]`

Todas ficam otimistas (detalhe e linhas em `12-PROVAS.md`):

| Candidata | Por que fica otimista |
|---|---|
| `importarGruposDoCanal` | JID e link vêm de uma tabela fixa (`GRUPOS_NO_PROVEDOR`, `provedor-simulado.ts:31`), não de gerador; só o id é sequencial |
| `criarRascunhoAPartirDe` | copia telas; `nextId("vfl")` e número `max + 1` derivados do estado |
| `enviarFlow` | delega a `sendMessage` (`nextId("msg")`); o `gerarIdentificadorDeResposta` (`flows.ts:935`) é de `receberRespostaDeFlow`, que não está em `OPERACOES` |
| `ensaiarAgente` | Execução `rehearsal` de passos fixos, sem chamar modelo; a API só a conhece no esquema de argumentos |
| `sendChatMessage` | só grava a mensagem do usuário; não há resposta do assistente na operação |
| `runLancamentoAgent` | de-para constante, lançamento "simulado"; sem chamador na web |
| `converterSolicitacaoEmContaAPagar` | id legível sai do contador do estado (`taskReadableId.next`), que viaja com `data`; ids sequenciais, D-15 cobre |

Achadas fora do registro e por isso sem veredito de lista: `receberRespostaDeFlow` (`flows.ts:910`) e `garantirFormularioDaSolicitacao` (`formulario-da-solicitacao.ts:106`, só o bootstrap da API).

## Task Commits

1. **Task 1 (traçador), RED** — `0f23ad7` (test): cinco casos falharam nas asserções planejadas (a lista vazia; `esperaOServidor` falso para `createForm`; `data.forms` e `data.lists` já tinham o registro antes da resposta). O arquivo da lista nasceu como casca vazia só para o teste falhar na asserção e não na importação.
2. **Task 1 (traçador), GREEN** — `3595d73` (feat): a lista com as catorze entradas e `otimistaPara` consultando-a.
3. **Task 2** — `4f7e401` (test): o caso do conjunto fechado, as sete candidatas que ficam fora da lista e o levantamento em `12-PROVAS.md`.
4. **Documentação** — `743acb4` (docs): o parágrafo novo em `apps/web/CONTEXT.md`.

**Plan metadata:** commit `docs(12-07)` que carrega este SUMMARY, STATE e ROADMAP.

Tracer feedback gate (Task 1): `gate` não era `blocking-human`, e o `<verify>` era só automatizado; foi rodado de ponta a ponta (`tsc`, `src/dados` e a suíte web inteira: 93 arquivos, 877 testes) antes da Task 2, sem checkpoint.

## TDD Gate Compliance

Task 1: `test(12-07)` (`0f23ad7`) antes de `feat(12-07)` (`3595d73`), RED legítimo: os testes novos falharam na asserção planejada (`expected 0 to be greater than 0`; `expected false to be true`; `expected [ { id: 'frm_waltes', … } ] to have a length of +0 but got 1`; idem para a Lista), não em erro de importação, sintaxe ou fixture. O terceiro caso de store (a recusa do servidor a `createForm`) e os casos de `esperaOServidor` falso/vazio já passavam no RED por descreverem comportamento que a casca vazia também tem; ficam como guardas. Nenhum `refactor`.

Task 2: **nasceu verde, sem RED.** A lista de catorze já estava completa depois da Task 1 e o levantamento não achou nenhuma entrada a acrescentar, então o teste do conjunto fechado e o das sete candidatas passaram assim que foram escritos (16 testes no arquivo). Não foi forçado um RED. O teste foi provado por mutação temporária em `operacoes-que-esperam.ts`, restaurada com `git checkout -- <arquivo>` (`git diff` vazio depois):

- tirar `inviteMember` do `Map`: falha "as chaves do Map são exatamente as do levantamento" (1 falha, 15 passam);
- pôr `importarGruposDoCanal` no `Map`: falham "as chaves do Map são exatamente as do levantamento" e "importarGruposDoCanal foi lida, não gera valor que o servidor decida, e fica otimista" (2 falhas, 14 passam).

O commit da Task 2 é `test(12-07)` e leva também o `12-PROVAS.md`, porque o levantamento é o produto da tarefa; não há `feat` para ela.

## Verification

- `cd apps/web && npx tsc --noEmit`: exit 0.
- `cd apps/web && npx vitest run src/dados/operacoes-que-esperam.test.ts src/dados/store.test.ts` (Task 1): 2 arquivos, 47 testes, todos passaram.
- `cd apps/web && npx vitest run src/dados` (Task 2): 11 arquivos, 138 testes, todos passaram.
- `grep -c "Operações que esperam o servidor (D-13)" 12-PROVAS.md`: 1.
- `cd apps/web && npx vitest run` (suíte web inteira, no fim): 93 arquivos, 886 testes, todos passaram. Nenhum teste de tela de outra fase quebrou por causa da lista; nenhum foi reescrito.
- `npm run lint -w @n1/web`: exit 0, 0 erros e 2 avisos de variável não usada (`features/ia/conhecimento/rotulos.ts`, `features/shell/app-shell.tsx`) que já existiam e estão fora de escopo.
- Critérios de aceitação: `export const OPERACOES_QUE_ESPERAM` (1); `esperaOServidor` em `store.ts` (2); `ehNomeDeOperacao` no teste (2); `grep -rn "operacoes-que-esperam" packages/dominio/src` sem linhas (0); a constante `ESPERADAS_PELO_LEVANTAMENTO` e a igualdade com as chaves do `Map` no teste; uma linha de `12-PROVAS.md` para cada uma das sete candidatas.
- `git status --porcelain -- apps/api packages`: vazio. Nenhum commit do plano toca `apps/api` nem `packages/dominio`.
- `npm test` da raiz não foi rodado (inclui `apps/api`, que fala com o banco do `.env`); `npm run build` da web é do orquestrador. Nada foi publicado nem acessado em produção.

## Decisions Made

Ver `key-decisions`.

## Deviations from Plan

None - plan executed exactly as written.

Registrado sem mudança de comportamento: o arquivo da lista foi criado como casca vazia no commit RED (em vez de só os testes), para a RED falhar na asserção planejada e não na importação de um módulo que ainda não existia.

**Total deviations:** 0.
**Impact on plan:** nenhum.

## Issues Encountered

Nenhum. As linhas que a RESEARCH citava para `flows.ts` (`651`, `735`) são as das chamadas aos geradores, não as das funções (`publicarVersao` começa na 624, `copiarFlow` na 708); as duas conferem e a diferença está anotada em `12-PROVAS.md`. A linha 89 de `comunidades.ts` está dentro de `criarComunidade` (fecha a premissa A5 da RESEARCH).

## Open items

- **Candidata de UX, fora do critério — decisão do dono.** `decideProcessApproval` (o painel de aprovação) e a conferência do resumo (`painel-conferencia-do-resumo.tsx`), que usa o mesmo molde, mostram hoje "Aprovação concluída", fecham o diálogo e dão o aviso de sucesso ANTES da resposta do servidor. Se o servidor recusa, o cartão volta a "Aprovação pendente" com o erro (D-14), mas o diálogo já fechou. Se entrassem em `OPERACOES_QUE_ESPERAM`, o botão ficaria em "Aprovando…" até a resposta, como era antes da fase, e nesse gesto a tela perderia o ganho de velocidade percebida que D-13 dá aos demais. Não entra na lista por critério (o resultado local é o do servidor): é escolha de produto, e a lista, fechada por teste, ficou como o plano manda. Texto completo em `12-PROVAS.md`, última subseção da seção D-13.
- **GRV-05** não foi marcado como concluído: o ID é compartilhado com 12-08 (o "salvando" sem link) e 12-09 (a guarda de navegação), e só fecha com o último deles.
- **Operação nova** que gere segredo, JID, link ou chave tem que entrar na lista junto com o teste; nada impede isso mecanicamente além do teste do conjunto fechado e do parágrafo em `apps/web/CONTEXT.md`.
- A premissa A8 (custo do `structuredClone` no navegador) continua não medida, como no 12-06.

## Known Stubs

None.

## Threat Flags

None. T-12-17 (segredo de link ou convite mostrado antes de existir): mitigado, as operações que geram segredo, JID, link ou chave estão na lista e esperam a resposta; caso de store com `createForm` prova que `data` tem o segredo do servidor e não o da cópia. T-12-18 (`inviteMember` otimista mostrando um Membro que o servidor resolve diferente): mitigado, `inviteMember` está na lista (resolução só do servidor, `SERVICOS`).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 12-08 pode ler `confirmado` (já exposto) para o "salvando" sem link; os gestos da lista nunca entram em `data` antes do servidor, então o "salvando" só vale para o que é otimista.
- 12-09 pode ler `pendentes` para o aviso ao fechar a aba.
- Nada foi publicado: o código novo da web só chega ao dono por um deploy mandado por ele.

## Self-Check: PASSED

Comandos rodados antes de escrever esta linha:

- `[ -f ]` em `apps/web/src/dados/operacoes-que-esperam.ts`, `operacoes-que-esperam.test.ts`, `store.ts`, `store.test.ts` e `12-PROVAS.md`: FOUND.
- `git merge-base --is-ancestor` para `0f23ad7`, `3595d73`, `4f7e401` e `743acb4`: FOUND.
- `git rev-list --count 331d3be..HEAD` = 4 (medido imediatamente antes de escrever o SUMMARY, a partir do ponto de partida registrado em disco).
