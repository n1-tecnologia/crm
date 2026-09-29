---
phase: 06-conferencia-do-resumo-e-anexos
plan: 01
subsystem: dominio
tags: [conferencia-do-resumo, contas-a-pagar, aprovacao-de-processo, omie, vitest, dominio-puro]

# Dependency graph
requires:
  - phase: 02-04
    provides: "ApprovalRequest com origem discriminada (processTask) e decideProcessApproval com resposta canônica no tópico (D-06/D-09)"
  - phase: 03-04
    provides: "DeParaDeLancamento, buildResumoDePagamento (CON-CP-08), descreverPassoDeDePara, runLancamentoAgent (forma da AgentExecution)"
provides:
  - "ApprovalOrigin com o ramo processTask/resumo (resumoCommentId, impressao, lancamento = tripla como DADO, D6-10)"
  - "impressaoDeLancamento, revisoresDoResumo, conferenciaDoResumo, respostasDeConferenciaPendentes, classificarRespostaDeConferencia"
  - "publicarResumoParaConferencia, registrarLancamentoNoOmie, registrarFalhaDoLancamento (financeiro.ts)"
  - "solicitarConferenciaDoResumo e o ramo resumo de decideProcessApproval (ai.ts)"
  - "TEXTOS_DA_CONFERENCIA (operations/financeiro-textos.ts, reexportado por financeiro.ts)"
  - "resolveTaskComment aceita o aprovador da Conferência do Resumo"
affects: [06-03, 06-04, 06-05, 06-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Conferência = ApprovalRequest de processo sem mudança de Status; a condição do lançamento é conferenciaDoResumo(...).estado === 'conferida' para a impressão ATUAL"
    - "Textos canônicos num módulo sem dependências, importado pelos dois lados de um ciclo (ai ↔ financeiro)"
    - "Tudo ou nada por fotografia de comprimentos (comments/approvals/agentExecutions/activity) + restauração do fio resolvido"

key-files:
  created:
    - packages/dominio/src/operations/financeiro-textos.ts
    - packages/dominio/src/operations/conferencia-do-resumo.test.ts
    - packages/dominio/src/operations/decisao-da-conferencia.test.ts
    - packages/dominio/src/operations/lancamento-registrado.test.ts
  modified:
    - packages/dominio/src/types/ai.ts
    - packages/dominio/src/operations/financeiro.ts
    - packages/dominio/src/operations/ai.ts
    - packages/dominio/src/operations/tasks.ts
    - packages/dominio/CONTEXT.md

key-decisions:
  - "Textos canônicos da Conferência em operations/financeiro-textos.ts (não em financeiro.ts): financeiro.ts importa solicitarConferenciaDoResumo de ai.ts e ai.ts precisa de conferido/ajuste — o módulo sem dependências evita o ciclo direto; financeiro.ts reexporta TEXTOS_DA_CONFERENCIA."
  - "publicarResumoParaConferencia é idempotente também com a Conferência 'conferida' para a mesma impressão (o plano citava só 'pendente'): sem isso, uma nova chamada sem mudança nos dados abriria uma Conferência pendente por cima de uma aprovação válida."
  - "Opção aditiva pedidoPor em publicarResumoParaConferencia: o texto 'Revisado a pedido de {nome}' precisa de um nome; sem pedidoPor, vale quem rejeitou a Conferência anterior, e por fim quem age."
  - "Com a Conferência em 'ajuste-pedido' e sem pedidoDeRevisao, o motivo da rejeição (decisionReason) vira o pedido do Resumo revisado."
  - "respostasDeConferenciaPendentes só devolve respostas enquanto a Conferência vigente está sem decisão; 'depois do Resumo vigente' é pela posição no fio (ordem de gravação), não por createdAt — dois Comentários no mesmo milissegundo não se perdem."
  - "registrarFalhaDoLancamento muda o Status ANTES de comentar, para o aviso não afirmar o que não aconteceu: se a conta não estava em 'em lançamento omie' ou o Status recusou, o texto é falhaSemVolta (sem 'A conta voltou para \"para pagar\"') e o Registro diz 'Status não voltou: …'."

patterns-established:
  - "A tripla conta · categoria · código viaja em ApprovalRequest.origin.lancamento — nenhuma função lê a tripla do texto de um Comentário (D6-10)"
  - "decideProcessApproval ramifica por origin.processStep: 'pagamento' intacto, 'resumo' sem Status"

# RES-01..03 ficam Pending em REQUIREMENTS.md: esta é a metade de domínio;
# a ponte (06-03) e a tela (06-04) fecham os critérios de aceite.
requirements-completed: []
requirements-advanced: [RES-01, RES-02, RES-03]

# Metrics
duration: 25min
completed: 2026-09-29
---

# Phase 6 Plan 01: A Conferência do Resumo no domínio — Summary

**O Agente publica o RESUMO aberto ao Financeiro e abre uma Conferência que guarda a tripla e a impressão de lançamento como dado; clique e "ok" no fio convergem em `decideProcessApproval` sem mexer no Status; o lançamento só se registra sobre uma Conferência aprovada para os dados atuais, e a falha volta a conta para "para pagar".**

## Performance

- **Duração:** ~25 min
- **Início:** 2026-09-29T19:36Z (aprox.)
- **Fim:** 2026-09-29T20:00Z
- **Tasks:** 3/3
- **Arquivos:** 4 criados, 5 modificados

## Realizações

- `ApprovalOrigin` ganhou o terceiro ramo (`processTask`/`resumo`) com `resumoCommentId`, `impressao` e `lancamento: { conta, categoria, codigo, veredito }`. Os leitores existentes em `apps/web`/`apps/api` continuam compilando (só leem `taskId`/`threadCommentId`).
- `publicarResumoParaConferencia`: RESUMO byte a byte (`buildResumoDePagamento`) seguido da chamada canônica; raiz na primeira vez, resposta no mesmo fio nas seguintes (reabrindo o fio se estava resolvido); Menção ao Financeiro; `AgentExecution` (`rehearsal: false`, passos 0 de-para e 1 `criar_comentario`); idempotente; tudo ou nada.
- `solicitarConferenciaDoResumo` (ai.ts): cancela a pendente anterior ("Conferência superada") e abre a nova com `object.toolId: "omie_lancar_conta_a_pagar"`, sem mudar Status. Fora de `OPERACOES`.
- `decideProcessApproval`, ramo `resumo`: `✅ Resumo conferido por …` / `🔁 Ajuste pedido por …: …` como resposta no fio, decisão/fonte/motivo, fio resolvido na aprovação, nenhuma mudança de Status. Ramo `pagamento` intacto.
- `registrarLancamentoNoOmie` / `registrarFalhaDoLancamento` (Fluxo 7, D6-03).
- `classificarRespostaDeConferencia`: heurística do legado portada, sem IA; "nada casou" ⇒ `ajuste` (diferença deliberada, documentada).
- `packages/dominio/CONTEXT.md`: seção "Conferência do Resumo (Fase 6)".

## Commits

1. **Task 1: a Conferência nasce** — `59013d5` feat(06-01): a Conferência do Resumo nasce no domínio
2. **Task 2: a decisão** — `fded5ff` feat(06-01): a decisão da Conferência — clique e resposta no fio convergem
3. **Task 3: o lançamento registrado** — `af6bf6a` feat(06-01): o lançamento registrado só sobre um Resumo conferido

Os testes foram escritos junto com cada implementação e commitados no mesmo commit da Task (o plano é `type: execute` com tasks `tdd="true"`, sem exigência de commit RED separado); a prova de que cada teste morde está nas mutações abaixo.

## Testes

| Arquivo (novo) | Casos |
|---|---|
| `conferencia-do-resumo.test.ts` | 42 (a–k; (k) em tabela) |
| `decisao-da-conferencia.test.ts` | 8 (a–g) |
| `lancamento-registrado.test.ts` | 14 (a, a2 tudo-ou-nada, b–f) |

- `packages/dominio`: **822/822** (758 antes + 64 novos); `tsc --noEmit` verde.
- `DATABASE_URL= npm run check` na raiz: **EXIT=0** — typecheck dos três workspaces, lint (0 erros, 4 avisos pré-existentes em `apps/web`, fora deste plano), tokens (0 falhas), contratos (hash idêntico), testes: api 581 passados / 205 pulados (sem banco, DEC-09) / 1 todo; web 216/216; dominio 822/822.
- `cd apps/api && DATABASE_URL= npx vitest run src/rotas/esquemas`: 91/91.
- Nenhum teste existente editado: `git diff 00040c5 HEAD --name-only` lista só arquivos de teste NOVOS.
- `packages/dominio/package.json` `dependencies` continua `["zod"]`; nenhum `fetch(`/`process.env`/`require(`/`node:` em `financeiro.ts`/`financeiro-textos.ts`.

## Mutações (desligar a regra faz o teste falhar)

| # | Mutação | Resultado |
|---|---|---|
| M1 | `solicitarConferenciaDoResumo` sem cancelar a pendente anterior | 2 falhas em (e) |
| M2 | Resumo republicado sempre como raiz (sem `parentCommentId`) | 2 falhas em (e) |
| M3 | Data de Emissão fora da impressão | 1 falha em (a) |
| M4 | Resposta canônica da decisão sem `parentCommentId` | 3 falhas em (a), (b), (c) da decisão |
| M5 | Ramo `resumo` mudando o Status para "aprovado" | 2 falhas em (a), (b) da decisão |
| M6 | `resolveTaskComment` sem a exceção do aprovador | 1 falha em (g) |
| M7 | `registrarLancamentoNoOmie` sem a guarda `conferida` | 2 falhas em (c) (pendente, desatualizada) |
| M8 | `registrarFalhaDoLancamento` sem `changeTaskStatus(paraPagar)` | 2 falhas em (e) |
| M9 | Recusa do Status em `registrarLancamentoNoOmie` sem desfazer | 1 falha em (a2) |

Todas restauradas; suíte verde depois de cada restauração.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Bloqueio] Textos canônicos em `operations/financeiro-textos.ts`**
- **Found during:** Task 1
- **Issue:** `financeiro.ts` importa `solicitarConferenciaDoResumo` de `./ai`, e `ai.ts` precisa de `TEXTOS_DA_CONFERENCIA` para a decisão — ciclo direto `ai` ↔ `financeiro`.
- **Fix:** módulo novo sem dependências, importado pelos dois; `financeiro.ts` reexporta `TEXTOS_DA_CONFERENCIA`, `PREFIXOS_DO_PROCESSO`, `AnexoDoLancamento`, `DadosDoLancado`. Consequência nos critérios por grep: o literal da chamada e da falha também aparecem nos JSDoc de `financeiro.ts` (os greps de `financeiro.ts` passam: 1 e 1); `'Resumo conferido por'` aparece em `ai.ts` (JSDoc do ramo) — total ≥ 1. `git diff --name-only` lista 9 arquivos (os 8 do plano + `financeiro-textos.ts`).
- **Commit:** `59013d5`

**2. [Rule 1 - Bug] `solicitarAprovacao` confundia uma Conferência do Resumo pendente com a aprovação de pagamento**
- **Found during:** Task 1
- **Issue:** a idempotência de `solicitarAprovacao` procurava qualquer `processTask` pendente da Tarefa; com o ramo novo, uma Conferência do Resumo pendente seria devolvida como se fosse a aprovação de pagamento.
- **Fix:** o filtro ignora `processStep === "resumo"`.
- **Files modified:** `packages/dominio/src/operations/ai.ts`
- **Commit:** `59013d5`

**3. [Rule 2 - Correção] Idempotência também com `conferida`; `pedidoPor` aditivo; pedido herdado da rejeição**
- **Found during:** Task 1
- **Issue:** (i) o plano só tornava idempotente o caso `pendente` — uma nova chamada sobre uma Conferência já aprovada (sem mudança nos dados) abriria uma pendente por cima de uma aprovação válida; (ii) o texto "Revisado a pedido de {nome}" precisava de um nome que a assinatura não trazia.
- **Fix:** idempotente em `pendente` e `conferida` sem pedido; opção `pedidoPor?: Id` (padrão: quem rejeitou a anterior, depois quem age); em `ajuste-pedido` sem pedido explícito, o `decisionReason` vira o pedido.
- **Commit:** `59013d5`

**4. [Rule 1 - Correção] O aviso de falha não afirma o que não aconteceu**
- **Found during:** Task 3
- **Issue:** o plano pedia comentar e depois mudar o Status; se o Status recusasse (ou a conta não estivesse em "em lançamento omie"), o Comentário diria "A conta voltou para \"para pagar\"" sem ter voltado.
- **Fix:** o Status muda primeiro; o texto é `TEXTOS_DA_CONFERENCIA.falha` quando voltou e `falhaSemVolta` (novo) quando não; o Registro diz "Status não voltou: …". O aviso continua valendo mesmo com a recusa do Status (como o plano pede).
- **Commit:** `af6bf6a`

**5. [Detalhe] Passo 0 da Execução do lançamento registrado**
- `registrarLancamentoNoOmie` grava o passo 0 como `raciocinio` "Conferência do Resumo aprovada" → `Conta <tripla>`, e não `descreverPassoDeDePara`: a Conferência não guarda a `origem` do de-para, e a Execução não é de Ensaio (`compararEnsaio` só lê `rehearsal: true`).

---

**Total:** 5 desvios (1 bloqueio, 2 bugs, 1 correção de regra, 1 detalhe de forma). Nenhum muda o escopo; nenhum toca `runLancamentoAgent`, `buildResumoDePagamento`, `erpMissingFields`, `changeTaskStatus` ou `../financeiro-tria`.

## Achado no seed (não é desvio)

`mem_rafael` (Administrador) é revisor por `revisoresDoResumo`, mas NÃO alcança a Lista de Contas a pagar no seed (Espaço "Gestão" privado): ele pode decidir a Conferência (`mayDecideApproval`) mas a resposta canônica no fio seria recusada por `addTaskComment`. Os testes usam `mem_thiago` (Proprietário, alcança) como publicador. Em `ws_n1` a Maryane é Proprietária e o problema não aparece; a tela (06-04) deve oferecer o botão só a quem alcança a conta.

## Requisitos

RES-01, RES-02 e RES-03 **não** foram marcados como completos em `REQUIREMENTS.md`: os três citam a ponte (`/lancar` só com Conferência, "ok" no fio lido pela ponte) e a tela (card e fila), que são 06-03 e 06-04. Este plano entrega a metade de domínio de cada um.

## Known Stubs

Nenhum.

## Verificação bloqueada

Nenhuma.

## Next Phase Readiness

- 06-03 (ponte): usar `impressaoDeLancamento` no lugar de `impressaoDaConta`, `publicarResumoParaConferencia` no momento 1, `respostasDeConferenciaPendentes` + `classificarRespostaDeConferencia` + `decideProcessApproval(..., { source: "comment" })`, e `conferencia.origin.lancamento.codigo` como `codigoCategoriaConfirmado`; `registrarLancamentoNoOmie`/`registrarFalhaDoLancamento` depois do `/lancar`. As três operações novas NÃO estão em `OPERACOES` (a ponte chama o domínio direto) — se a tela precisar, 06-04 registra.
- 06-04 (tela): `conferenciaDoResumo` dá o estado do card; `TEXTOS_DA_CONFERENCIA` dá as strings.

## Self-Check: PASSED

- FOUND: packages/dominio/src/operations/financeiro-textos.ts, conferencia-do-resumo.test.ts, decisao-da-conferencia.test.ts, lancamento-registrado.test.ts
- FOUND: 59013d5, fded5ff, af6bf6a

---
*Phase: 06-conferencia-do-resumo-e-anexos*
*Completed: 2026-09-29*
