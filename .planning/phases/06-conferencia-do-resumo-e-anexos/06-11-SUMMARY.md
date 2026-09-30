---
phase: 06-conferencia-do-resumo-e-anexos
plan: 11
subsystem: packages/dominio (Conferência do Resumo)
tags: [conferencia-do-resumo, gap-closure, dominio, classificador, tudo-ou-nada, anexos]

requires:
  - phase: 06-01
    provides: "Conferência do Resumo no domínio (publicar, decidir, registrar, falha)"
  - phase: 06-03
    provides: "avisarId e a ponte que consome o domínio"
provides:
  - "financeiro-base.ts: módulo-folha (só import type) com a impressão, a Conferência vigente, os revisores, FORMA_DO_CODIGO_DE_CATEGORIA e lancamentoSemCodigo"
  - "decideProcessApproval (resumo) recusa sem efeito a Conferência desatualizada e a aprovação sem código de Categoria"
  - "classificador estrito, respostasDeConferenciaPendentes por autoria + forma canônica, decisaoDasRespostasPendentes"
  - "publicarResumoParaConferencia com impressaoEsperada e conferenciaRejeitadaId"
  - "registrarFalhaDoLancamento tudo ou nada; lancado pelo status real; tituloDivergente e contaDivergente"
affects: [06-12, 06-13, 06-14]

tech-stack:
  added: []
  patterns:
    - "módulo-folha só com import type para quebrar o ciclo ai/tasks <-> financeiro"
    - "aviso antes da mudança de Status, com desfazer-e-republicar pela fotografia de comprimentos"

key-files:
  created:
    - packages/dominio/src/operations/financeiro-base.ts
    - packages/dominio/src/operations/conferencia-desatualizada-recusada.test.ts
    - packages/dominio/src/operations/conferencia-sem-codigo.test.ts
    - packages/dominio/src/operations/resolver-fio-do-resumo.test.ts
    - packages/dominio/src/operations/classificador-estrito.test.ts
    - packages/dominio/src/operations/respostas-em-lote.test.ts
    - packages/dominio/src/operations/publicar-resumo-estrito.test.ts
    - packages/dominio/src/operations/falha-do-lancamento-tudo-ou-nada.test.ts
    - packages/dominio/src/operations/textos-do-lancamento.test.ts
  modified:
    - packages/dominio/src/operations/financeiro.ts
    - packages/dominio/src/operations/financeiro-textos.ts
    - packages/dominio/src/operations/ai.ts
    - packages/dominio/src/operations/tasks.ts
    - packages/dominio/src/operations/conferencia-do-resumo.test.ts
    - apps/api/src/automacoes/invocar-agente.test.ts
    - packages/dominio/CONTEXT.md

key-decisions:
  - "O passo 3 do classificador ficou estrito (toda palavra no conjunto, teto 6, sem dígito/símbolo/emoji além de 👍/✅, com sinal de aprovação). 'segue' conta como sinal em qualquer posição, não só sozinho na cláusula como antes."
  - "decisaoDasRespostasPendentes ganhou o tipo exportado DecisaoDasRespostasPendentes (aditivo), para 06-12 tipar o consumidor"
  - "falha-do-lancamento (c): o Convidado que só move Status exige a Lista SEM guestEditableDefinitionIds, porque addTaskComment libera comentar para quem edita Campo liberado (guestFieldWriter); o teste limpa a lista e confere a pré-condição"
  - "No desfazer-e-republicar de registrarFalhaDoLancamento, se o segundo aviso também for recusado a função devolve fail: nada ficou (o Status não mudou e o primeiro aviso saiu)"

requirements-completed: [RES-02, RES-03]

duration: ~16 min
completed: 2026-09-30
---

# Phase 6 Plan 11: Conferência mais estrita no domínio Summary

O domínio agora só aceita uma conferência inequívoca, sobre os dados atuais e com código de Categoria. Também lê todas as respostas do fio, e o primeiro ajuste vence. O Resumo não sai em dobro nem sobre dados velhos. A falha do lançamento acontece inteira ou não acontece, e a confirmação conta os anexos como eles estão. Tudo isso sem ciclo de import e sem I/O.

## Execução

- Início 2026-09-30T12:45Z, fim ~13:01Z. Três tarefas, cada uma em RED (commit `test`) e depois GREEN (commit `feat`).
- `readlink node_modules/@n1/dominio` = `../../packages/dominio`: o `apps/*` enxergou o domínio deste checkout.

## Commits

| Tarefa | Commit | Mensagem |
|---|---|---|
| 1 RED | `bed114c` | test(06-11): Conferência velha, sem código e fio resolvido só pela vigente (RED) |
| 1 GREEN | `58bb3db` | feat(06-11): Conferência velha e sem código recusadas; fio do Resumo resolvido só pela vigente |
| 2 RED | `f7759d8` | test(06-11): classificador estrito e respostas do fio em lote (RED) |
| 2 GREEN | `f8b40fe` | feat(06-11): aprovação só quando a mensagem inteira aprova; todas as respostas contam e o ajuste vence |
| 3 RED | `4c8f466` | test(06-11): Resumo sem dobra, falha tudo ou nada e anexos pelo status real (RED) |
| 3 GREEN | `fea5e6d` | feat(06-11): Resumo sem dobra, falha do lançamento tudo ou nada e anexos pelo status real |

## O que mudou

- **Task 1.** Foi criado o módulo-folha `financeiro-base.ts`. `CP`, `fieldValue`, `ConferenciaDoResumo`, `ehConferenciaDoResumo`, `conferenciaVigente`, `jsonCanonico`, `tagDeContaDe`, `impressaoDeLancamento` e `revisoresDoResumo` saíram de `financeiro.ts` sem mudar a lógica. Entraram `FORMA_DO_CODIGO_DE_CATEGORIA` (`/^\d(\.\d{2}){2,3}$/`) e `lancamentoSemCodigo`. `financeiro.ts` reexporta o que era público.
  - No ramo `resumo` de `decideProcessApproval` entraram duas guardas, as duas sem efeito: `recusaDesatualizada` (crm:WR-08) e `recusaSemCodigo`, só na aprovação (crm:WR-03).
  - `resolveTaskComment` passou a aceitar a exceção só para resolver, e só pela Conferência vigente: o aprovador dela ou um revisor do Resumo (crm:IN-02).
- **Task 2.** Entrou `FORMAS_CANONICAS_DO_FIO`. `PREFIXOS_DO_PROCESSO` continua exportado, mas deixou de ser o filtro.
  - `respostasDeConferenciaPendentes` exclui pela autoria e pela forma exata.
  - O classificador ficou estrito (crm:CR-03).
  - Entrou `decisaoDasRespostasPendentes`: o primeiro ajuste vence, e a aprovação só vale com `aprovacaoPorComentario` (crm:WR-04).
- **Task 3.** `OpcoesDaConferencia` ganhou `impressaoEsperada` e `conferenciaRejeitadaId`, que recusam antes da idempotência (crm:WR-12).
  - `registrarFalhaDoLancamento` passou a usar `guardasDoAgente` e publica o aviso antes do Status. Se a volta for recusada, o aviso é desfeito e republicado dizendo que a conta não voltou (crm:WR-10).
  - `lancado` conta os anexos pelo status real, com `anexosPedidos` e `jaExistia` (crm:IN-03).
  - Entraram `tituloDivergente`, `contaDivergente`, `CampoDivergente` e `ResultadoDoLancamento.anexosPedidos`.
  - A seção 06-11 foi acrescentada ao `packages/dominio/CONTEXT.md`.

## Testes

| | Arquivos | Testes |
|---|---|---|
| Domínio antes | 53 | 831 |
| Domínio depois | 61 | 952 (+121, todos verdes) |

- `tsc --noEmit` verde em `packages/dominio`, `apps/api` e `apps/web`.
- `npm run lint` terminou com 0 erros. Os 4 avisos já existiam, em arquivos de `apps/web` que este plano não toca.
- `verificar:tokens` e `verificar:contratos` OK.
- `apps/api` sem banco (`DATABASE_URL=`), um arquivo por vez:
  - `invocar-agente.test.ts`: 106/106
  - `contrato-contas-a-pagar-ponte.test.ts`: 11/11
  - `contrato-contas-a-pagar.test.ts`: 25/25
  - `ponte-ativa.test.ts`: 13/13
  - Por cautela, rodei também `rotas/esquemas-de-argumentos`, `classificacoes`, `operacoes-eventos` e `esquemas/ia`: 21 passaram e 5 pularam, porque dependem do banco.
- `apps/web`: `painel-conferencia-do-resumo.test.tsx` 22/22 e `painel-aprovacao.test.tsx` 16/16.

## Mutações (cada uma aplicada, rodada e restaurada por script, com restauração conferida byte a byte)

| # | Mutação | Arquivo | Testes que falharam |
|---|---|---|---|
| M1 | sem a guarda de impressão | ai.ts | 5 (conferencia-desatualizada-recusada (a), (b)×3, (c)) |
| M2 | sem a guarda de código | ai.ts | 3 (conferencia-sem-codigo (a)×2, (c) 2.6.1) |
| M3 | forma `/^\d\.\d{2}\.\d{2}$/` | financeiro-base.ts | 2 (2.02.98.01 em (c) e (d)) |
| M4 | exceção de volta a `state.approvals.some(...)` | tasks.ts | 2 (resolver-fio (b), (d)) |
| M5 | sem `resolved === true` | tasks.ts | 1 (resolver-fio (d)) |
| M6 | sem o ramo `revisoresDoResumo` | tasks.ts | 1 (resolver-fio (c)) |
| M7 | passo 3 de volta a "qualquer cláusula" | financeiro.ts | 23 (os 6 contraexemplos e os casos com dígito, símbolo e teto) |
| M8 | sem a condição (iii) | financeiro.ts | 4 ("ok 👎", "certo ❌", "ok ⚠️", "ok :)") |
| M9 | sem o teto | financeiro.ts | 1 ("ok ok ok ok ok ok ok") |
| M10 | sem a condição (iv) | financeiro.ts | 2 ("valeu", "obrigado") |
| M11 | filtro de volta ao prefixo | financeiro.ts | 2 (respostas-em-lote (a), (b)) |
| M12 | só a última resposta | financeiro.ts | 3 (respostas-em-lote (d), (e), (f)) |
| M13 | aprovação avaliada antes do ajuste | financeiro.ts | 1 (respostas-em-lote (e) "ok antes do ajuste") |
| M14 | sem a guarda de `impressaoEsperada` | financeiro.ts | 1 (publicar-resumo-estrito (b)) |
| M15 | sem a guarda de `conferenciaRejeitadaId` | financeiro.ts | 2 (publicar-resumo-estrito (c), (d)) |
| M16 | Status antes do Comentário | financeiro.ts | 1 (falha-tudo-ou-nada (c)) |
| M17 | guardas manuais em vez de `guardasDoAgente` | financeiro.ts | 1 (falha-tudo-ou-nada (b)) |
| M18 | sem desfazer-e-republicar | financeiro.ts | 1 (falha-tudo-ou-nada (d)) |
| M19 | `m` só por `d.anexos.length` | financeiro-textos.ts | 4 (textos-do-lancamento: primeiro envio, sem resposta ×2, (e)) |

## Exceções a CON-05 (as duas nomeadas no plano, e só elas)

1. **`conferencia-do-resumo.test.ts`, bloco (j), teste "só respostas de revisores ao fio, depois do Resumo vigente, sem as do Agente nem as canônicas, por createdAt".** O diff tem uma linha a menos e uma a mais:
   ```diff
   -    responder(admin, "⚠️ aviso", raiz);
   +    addTaskComment(state, CP.financeiroId, t.id, { content: "⚠️ aviso", parentCommentId: raiz, actor: { kind: "agent", id: CP.agentId } });
   ```
   A expectativa `[daMaryane.id, doAdmin.id]` não mudou. A tabela (k) passa sem edição.
2. **`apps/api/src/automacoes/invocar-agente.test.ts`, teste "Resumo conferido com a Categoria ausente do de-para (código de preenchimento 9.99.99): nenhuma requisição, um aviso".** A linha 1064 virou três:
   ```diff
   -      expect(decideProcessApproval(estado, MARYANE, p.value.conferencia.id, "aprovada", { source: "click" }).ok).toBe(true);
   +      expect(decideProcessApproval(estado, MARYANE, p.value.conferencia.id, "aprovada", { source: "click" }).ok).toBe(false);
   +      // uma linha aprovada ANTES de 06-11, já gravada no banco: a guarda da ponte continua sendo a defesa em profundidade
   +      Object.assign(p.value.conferencia, { decision: "aprovada", decidedByMemberId: MARYANE, decidedAt: new Date().toISOString(), decisionSource: "click" });
   ```

`git diff --name-only 8635e01..HEAD -- packages apps` lista só arquivos de `files_modified`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pré-condição que faltava no caso (c) de `falha-do-lancamento-tudo-ou-nada.test.ts`.**
- **Found during:** Task 3 (RED)
- **Issue:** O plano pedia um Convidado com Papel "Agente do pipeline" sem `comentar` e com `ver` na Lista. Esse Convidado ainda comenta em Contas a pagar, porque a Lista libera Anexo e Data de Emissão a Convidados (`guestEditableDefinitionIds`). Com isso, `addTaskComment` o deixa passar por `guestFieldWriter` antes de consultar `taskCommentRefusal`. Resultado: o teste não reproduzia o defeito do review.
- **Fix:** O teste limpa `guestEditableDefinitionIds` da Lista e confere uma pré-condição a mais: `guestFieldWriter(...) === undefined`. Isso vem junto das duas pré-condições do plano (`guestStatusWriter === true` e `taskCommentRefusal !== undefined`). Com isso, o contraexemplo de hoje apareceu: a conta ia para "para pagar" e a função devolvia `fail`. Nenhum código de produção mudou por causa disso.
- **Files modified:** `packages/dominio/src/operations/falha-do-lancamento-tudo-ou-nada.test.ts`
- **Commit:** `4c8f466`

**2. [Aditivo] O tipo exportado `DecisaoDasRespostasPendentes`**, que é o retorno de `decisaoDasRespostasPendentes`. É a mesma forma que o plano fixou, agora com nome, para 06-12 tipar `lerRespostas`.

### Notas de escopo

- A Task 3 (d) de `falha-do-lancamento-tudo-ou-nada` também confere que a Atividade cresceu exatamente 2: o Registro do aviso republicado e o da falha. Assim, o Registro do Comentário desfeito comprovadamente sai.
- `npm run check` inteiro na raiz não foi rodado: a regra 5 do ambiente limita `apps/api` aos arquivos nomeados. Rodei cada etapa separada: typecheck dos três workspaces, lint, tokens, contratos, a suíte inteira do domínio e os arquivos nomeados de `apps/api` e `apps/web`. `apps/api/src/e2e/dois-servicos.test.ts`, que também importa `decideProcessApproval`, não foi rodado: ele sobe processos e não está entre os arquivos nomeados.

## Known Stubs

Nenhum.

## Threat Flags

Nenhum: nenhuma superfície nova fora do `<threat_model>`, e todas as mitigações T-06-11-01..08 estão cobertas pelas mutações acima.

## Self-Check: PASSED

- Os 9 arquivos criados existem, e os 6 commits (`bed114c`, `58bb3db`, `f7759d8`, `f8b40fe`, `4c8f466`, `fea5e6d`) estão em `git log`.
