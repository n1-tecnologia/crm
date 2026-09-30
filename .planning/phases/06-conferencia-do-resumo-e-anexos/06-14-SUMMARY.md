---
phase: 06-conferencia-do-resumo-e-anexos
plan: 14
subsystem: apps/web (tópico da conta, card da Conferência, fila, jornada)
tags: [conferencia-do-resumo, gap-closure, timeline, responder, jornada]

requires:
  - phase: 06-11
    provides: "lancamentoSemCodigo, respostasDeConferenciaPendentes por autoria, classificador estrito"
provides:
  - "\"Responder\" no Timeline: a resposta sai com parentCommentId = raiz do fio"
  - "pílula \"Conferência do Resumo\" no raiz do fio do Resumo; aviso no compositor raiz com a Conferência pendente"
  - "faltaCodigoDaCategoria (card e fila): nada de \"Conferido\"/\"Conferir\" para Resumo sem código"
  - "jornada: responderNoFio; cp-conferida e cp-ajuste pelo fio; cp-conferida-pelo-card"
affects: [06-15]

tech-stack:
  added: []
  patterns:
    - "o mesmo Compositor em dois modos (raiz e resposta), com o padrão D-05/D-06 de confirmação"
    - "teste de componente que lê, na cópia gravada, o que a ponte leria"

key-files:
  created:
    - apps/web/src/features/tarefa/timeline-responder.test.tsx
    - apps/web/src/features/tarefa/painel-conferencia-no-fio.test.tsx
  modified:
    - apps/web/src/features/tarefa/timeline.tsx
    - apps/web/src/features/tarefa/painel-conferencia-do-resumo.tsx
    - apps/web/src/app/(shell)/ia/aprovacoes/page.tsx
    - apps/web/scripts/jornada-financeiro.mjs

key-decisions:
  - "faltaCodigoDaCategoria chama lancamentoSemCodigo do domínio (06-11), em vez de comparar veredito === \"ausente\": é a mesma regra com que decideProcessApproval recusa a aprovação (inclui código fora da forma do contrato)"
  - "A fila também não abre o diálogo de conferir pelo link ?aprovar=<id>:aprovada para Resumo sem código"
  - "Jornada: a contagem de Resumos revisados do cp-ajuste é feita ANTES da resposta, não depois de esperar o 🔁 Ajuste"

requirements-completed: [RES-02, RES-06]

duration: ~10 min
completed: 2026-09-30
---

# Phase 6 Plan 14: "Responder" no fio da conta Summary

O tópico da conta a pagar agora tem o gesto "Responder", como no ClickUp. A resposta sai com o `parentCommentId` da raiz do fio do Resumo, que é exatamente o que a ponte lê: o "ok" confere e qualquer outra resposta pede ajuste. Um "ok" digitado como Comentário raiz passa a ser avisado na doca, e não mais engolido. O card e a fila deixam de oferecer "Conferido"/"Conferir" para um Resumo sem código. A jornada confere e pede ajuste respondendo no fio.

## Execução

- Início ~10:01, fim ~10:11 (2026-09-30), no checkout `crm-n1-integracao` (branch `integra-frontend-main`), e não num worktree.
- `readlink apps/web/node_modules/@n1/dominio` = `../../packages/dominio`: o teste enxergou o domínio do 06-11.
- Li o guia de `"use client"` (`node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`). Os arquivos já eram componentes de cliente, e nenhuma API do Next mudou.

## Commits

| Tarefa | Commit | Mensagem |
|---|---|---|
| 1 RED | `696f970` | test(06-14): "Responder" no fio do Resumo, pílula e aviso do compositor raiz (RED) |
| 1 GREEN | `59ee3bd` | feat(06-14): "Responder" no tópico da conta, pílula do Resumo e aviso no compositor raiz |
| 2 RED | `cc39d62` | test(06-14): card e fila — o "ok" no fio e nada de "Conferido" sem código (RED) |
| 2 GREEN | `1054ee0` | feat(06-14): card e fila sem ambiguidade — "ok" no fio e nada de "Conferido" sem código |
| 3 | `7626c94` | feat(06-14): a jornada confere e pede ajuste respondendo no fio do Resumo |

## O que mudou

**Task 1: `timeline.tsx`**
- `useCompositorDeTimeline` ganhou o 5º parâmetro opcional `parentCommentId`. `Compositor` ganhou `resposta?: { paraId, aoFechar }`, com:
  - o rótulo "Resposta no fio" e o placeholder "Responder…";
  - o envio "Enviar resposta"/"Enviando…";
  - `autoFocus` e o botão "Cancelar".
- Sem `resposta`, os textos continuam os de antes: "Novo comentário", "Comentar" e o placeholder de sempre.
- `Timeline` guarda `respondendo`, então só um compositor de resposta fica aberto por vez. `LinhaDeComentario` mostra o botão "Responder" (dentro de `span#responder-<id>`) ou o compositor, com `paraId = comment.parentCommentId ?? comment.id`. Ao fechar, o foco volta ao botão com `setTimeout(…, 0)`.
- `comentariosDeRoteamento` agora devolve `Map<Id, "pagamento" | "resumo">`: o raiz do Resumo leva "Conferência do Resumo" e o de pagamento continua com "Pedido de aprovação" (crm:IN-01).
- Com `conferenciaVisivel(state, task)?.estado === "pendente"`, a doca mostra o aviso exato. Importar do card não cria ciclo, porque o card não importa o `Timeline`.

**Task 2: card e fila**
- `faltaCodigoDaCategoria(conferencia)` é exportada de `painel-conferencia-do-resumo.tsx` e chama `lancamentoSemCodigo(conferencia.origin.lancamento)`, o predicado que o 06-11 exporta. Ela cobre `veredito: "ausente"` e também o código fora da forma do contrato: a mesma regra que o domínio recusa.
- Card, com a condição: só "Pedir ajuste" e o texto `Peça ajuste com o código da Categoria — pelo botão ou respondendo no fio do Resumo com o código (ex.: "use 2.04.03").`. O `DialogoConferir` não é renderizado.
- Card, sem a condição: os dois botões e, abaixo, `Confira pelo botão ou responda "ok" no fio do Resumo; qualquer outra resposta no fio pede ajuste.` (crm:WR-05).
- Fila (`page.tsx`): sem "Conferir" e com `Peça ajuste com o código da Categoria.`, mantendo "Pedir ajuste". O diálogo de conferir também não abre pelo link `?aprovar=<id>:aprovada` (desvio 1).

**Task 3: a jornada**
- `gravando` devolve a `Response`.
- `responderNoFio(padrao, texto)`: "Responder" no último `li` que casa, digitação letra a letra em "Resposta no fio" e Ctrl+Enter. Depois, confere `value.parentCommentId` contra o id do primeiro `li` (a raiz) e devolve `respondido no fio (<raiz>)`.
- `cp-conferida` responde `"ok"`, espera `✅ Resumo conferido` e confere o card "Conferido … · por comentário". Tem as capturas `cp-conferida-resumo`, `cp-conferida-ok-no-fio` e `cp-conferida-${MODO}`.
- `cp-ajuste` responde no fio "é prestação comercial, não ADM" e espera `AJUSTE`, depois `REVISADO` e depois o card "Pendente".
- `cp-conferida-pelo-card` é o cenário de antes, pelo clique.
- O cabeçalho descreve os três cenários, a regra de quem decide (revisor que alcança a conta) e `AGENTE_CONTAS_A_PAGAR_CONFERENCIA_POR_COMENTARIO` vazio/`true` (`conferenciaPorComentario=true`). A linha "ponte em ${MODO}" também dispara para `cp-conferida-pelo-card`.

## Testes

| | Arquivos | Testes |
|---|---|---|
| `apps/web` antes | 25 | 240 |
| `apps/web` depois | 27 | 267 (+27, todos verdes) |

- `timeline-responder.test.tsx`: 16 casos, de (a) a (j). `painel-conferencia-no-fio.test.tsx`: 11 casos, de (a) a (f) mais (g), o link da fila.
- `timeline.test.tsx`, `painel-conferencia-do-resumo.test.tsx` e `painel-conferencia-importada.test.ts` estão verdes e sem diff (CON-05).
- `npx tsc --noEmit` passou verde.
- `npm run lint -w @n1/web` deu 0 erros. Os 4 avisos já existiam, em `app-shell.tsx`; o `pedirAjustePeloCard` sem uso tem `eslint-disable` com o motivo.
- `verificar:tokens` terminou com 0 falhas.
- Jornada: `node --check` e `eslint` passaram verdes. Ela **não foi executada**: a execução real é o 06-15.
- `git diff --name-only bd4d9fc..HEAD -- packages apps` lista só os seis arquivos de `files_modified`. `packages/dominio` e `apps/api` não foram tocados.

## Mutações

Cada mutação foi aplicada por script, rodada e restaurada da cópia, com `cmp` conferindo a restauração.

| # | Mutação | Testes que falharam |
|---|---|---|
| M1 | resposta sem `parentCommentId` | 6: (b)×2, (c), (d), (e), (i) sucesso |
| M2 | `paraId: comment.id` (sem subir à raiz) | 1: (e) |
| M3 | "Responder" também em `readOnly` | 1: (h) |
| M4 | `comentariosDeRoteamento` sem distinguir `processStep` | 1: (j) Resumo |
| M5 | aviso sem a condição `pendente` | 2: (g) conferida e (g) sem Conferência |
| M6 | card sem a condição `ausente` | 1: (d) |
| M7 | fila sem a condição | 1: (e) sem código |
| M8 | o parágrafo do fio também no ramo de quem não confere | 1: (b) |
| M9 (extra) | o diálogo da fila abre pelo link mesmo sem código | 1: (g) |

Uma primeira versão de M8 trocou o ramo inteiro de quem não confere. Ela derrubou 3 testes, dois deles de `painel-conferencia-do-resumo.test.tsx` (b). A tabela registra a versão precisa, que só acrescenta o parágrafo.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] A fila abria o diálogo de conferir pelo link, mesmo sem código**
- **Found during:** Task 2
- **Issue:** Com `?aprovar=<id>:aprovada`, a fila abria o `DialogoConferir` para um Resumo sem código. O domínio recusaria, mas a tela oferecia "Conferido, pode lançar", exatamente o que o crm:WR-03 tira.
- **Fix:** `open={decidingKind === "aprovada" && !faltaCodigoDaCategoria(decidingConferencia)}`, mais o caso (g) no teste novo, provado pela mutação M9.
- **Files modified:** `apps/web/src/app/(shell)/ia/aprovacoes/page.tsx` e `painel-conferencia-no-fio.test.tsx`
- **Commit:** `1054ee0`. O caso (g) entrou no commit GREEN, e não no RED.

**2. [Rule 1 - Bug] A contagem de revisados do cp-ajuste podia travar a jornada**
- **Found during:** Task 3
- **Issue:** Com o passo novo "Esperar 🔁 Ajuste pedido por", o `aPartirDe: await contarNoFio(REVISADO)` passaria a contar DEPOIS do ajuste. A ponte decide e republica na mesma passada, então o revisado já estaria contado, e a espera pediria um segundo revisado até estourar o tempo.
- **Fix:** `revisadosAntesDoAjuste` passa a ser contado no passo da resposta, antes de responder.
- **Commit:** `7626c94`

**3. [Rule 1 - Bug] "por comentário" casaria dois elementos no popup**
- **Found during:** Task 3
- **Issue:** O plano pedia `painel().getByText(/por comentário/)`. Mas a Atividade da decisão no tópico também diz `por comentário — ok` (`detail` de `decideProcessApproval`), e dois achados violam o modo estrito do Playwright.
- **Fix:** `painel().getByText(/^Conferido por .+ · por comentário$/)`, que é a linha do card.
- **Commit:** `7626c94`

**4. [Escolha registrada] `faltaCodigoDaCategoria` usa `lancamentoSemCodigo`**
- O plano mandava usar o predicado do domínio, se o 06-11 exportasse um, e ele exporta. Para `veredito: "ausente"` o comportamento é o mesmo que o plano descreve; a diferença é que ele também cobre o código malformado.

## Known Stubs

Nenhum.

## Threat Flags

Nenhum. A superfície nova é a resposta no fio, que já está no `<threat_model>` (T-06-14-01..05). O conteúdo passa pelo `Rico`, e `grep -c 'dangerouslySetInnerHTML={' timeline.tsx` = 0.

## Verificação bloqueada

Nenhuma.

## Self-Check: PASSED

- Os 2 arquivos criados existem, e os 5 commits (`696f970`, `59ee3bd`, `cc39d62`, `1054ee0`, `7626c94`) estão em `git log`.
