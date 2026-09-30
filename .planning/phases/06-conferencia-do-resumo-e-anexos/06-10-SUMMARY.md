---
phase: 06-conferencia-do-resumo-e-anexos
plan: 10
subsystem: financeiro-tria/automation (coorte plataforma: S5 depois da aprovação)
tags: [gap-closure, s5, porta, sanitizacao, centro-de-custo, mencao, categoria, wr-03, wr-04, wr-05, in-04, in-05]
requires:
  - phase: 06-09
    provides: "publicarResumoDaDecisao/executarResumoDaPlataforma, classificarFalhaDoResumo, comCenarioDoResumo (BASE 9e45d84)"
provides:
  - "TEXTO_PUBLICO_DA_FALHA_DO_RESUMO (sete códigos, texto fixo) e ErroDoResumo (CENTRO_DE_CUSTO_NAO_ROTEADO)"
  - "detalheSanitizadoDaFalha / valoresSensiveisDaSolicitacao / textoSemSegredo: o detalhe só vai para technicalMessage e log, sanitizado"
  - "executarResumoDaPlataforma relê a Solicitação pela porta (lerTarefa → mapper.mapear → parsePaymentComment) e recusa Centro de Custo sem rota antes do Omie"
  - "publicarResumoDepoisDaAprovacao com origem plataforma e sem parsed lança"
  - "postPaymentSummary: console.warn sem o par de Contas a Pagar, simpleMessage por coorte, observação da IA fixa, MARCA_DE_CODIGO_NAO_CONFERIDO"
  - "resolveCategoryCode/resolveCategoryCodeAgainstOmie com similaridadeMedida; categoryResult.conferidoNoOmie"
affects: [06-15]
tech-stack:
  added: []
  patterns:
    - "Aviso público por tabela de textos fixos indexada pelo código da falha; detalhe só em log, sanitizado por padrões + valores da Solicitação"
    - "S5 da plataforma sobre a Tarefa relida pela porta, nunca sobre o texto gravado na linha"
key-files:
  created: []
  modified:
    - ../financeiro-tria/automation/src/tenants/tria/payment-automation-service.ts
    - ../financeiro-tria/automation/src/tenants/tria/payment-automation-service.plataforma.test.ts
    - ../financeiro-tria/automation/README.md
key-decisions:
  - "IN-05: marcar o código não conferido no RESUMO, não reusar resolverDeParaDeLancamento (RESUMO informativo pelo D6-07; o de-para inteiro e as deps reais moram na camada HTTP; a marca não custa nada). Justificativa no JSDoc de postPaymentSummary"
  - "Chave de API (sk-…) redigida por um padrão local (PADRAO_DE_CHAVE_DE_API) em cima de sanitizarErro, que não a conhece; platform-adapter-queue.ts não foi tocado"
  - "Na plataforma, o payload do evento de sucesso do summary leva o objeto publicado (já sem a nota da OpenAI); na fonte ClickUp é o mesmo objeto de sempre"
  - "iaComRawDaSolicitacao (06-09) deixou de ser necessário, mas ficou: o plano não autoriza editar os testes do 06-09"
requirements-completed: [RES-05]
metrics:
  duration: "~40 min"
  completed: 2026-09-30
  tasks: 2
  files: 3
---

# Phase 6 Plan 10: S5 relê a Solicitação pela porta, recusa Centro de Custo sem rota, textos públicos fixos — Summary

**O S5 da coorte plataforma agora relê a Tarefa pela porta antes de conta, fornecedor e categoria, e nunca mais lê o `comentario` gravado na linha. Um Centro de Custo que não roteia recusa o S5 antes de qualquer chamada ao Omie. O aviso público é uma frase fixa por classe de erro, e o detalhe vai só para o log, sanitizado. O RESUMO avisa no log quando falta a Menção de Contas a Pagar e marca o código de categoria que ninguém conferiu no Omie.**

## Commits (financeiro-tria, branch main, BASE `9e45d84`)

| Task | Hash | Mensagem |
|---|---|---|
| 1 | `c889556` | feat(plataforma): aviso do Resumo em texto fixo por classe, detalhe só sanitizado e Centro de Custo sem rota recusado antes do Omie (06-10) |
| 2 | `42ca9b5` | feat(plataforma): S5 relê a Solicitação pela porta, avisa da Menção de Contas a Pagar ausente e marca o código não conferido (06-10) |

Cada commit tem só os caminhos da sua task (conferido com `git diff --cached --stat` e `git show --stat`):
- Task 1: o serviço e o teste da plataforma.
- Task 2: os dois arquivos da Task 1 e o `automation/README.md`.

A contagem de CR ficou igual à de HEAD nos três arquivos (0). Depois de cada commit, `git status --short | wc -l` = 89. No fim:
- `git diff --ignore-cr-at-eol --stat` saiu vazio;
- `git diff --stat 9e45d84..HEAD -- automation/src/tenants/tria/payment-automation-service.legado.test.ts` saiu vazio.

Nenhum `git push`.

## Testes

| | Antes (BASE) | Depois |
|---|---|---|
| `npm test` (suíte inteira, isolada) | 695/695 | **708/708**, 0 fail (695 + 13 novos) |
| `npx tsc --noEmit -p .` | verde | verde (a cada task e no fim) |

Novos, no fim de `payment-automation-service.plataforma.test.ts`:
- bloco `── 06-10 ──` da Task 1, F1–F7: Omie recusou (CNPJ e razão social fora do aviso, do `technicalMessage` e do `console.error`); erro qualquer (CPF e valor fora); plataforma 422; última tentativa com Omie e rede fora, mais a tabela dos sete códigos sem `{`, `$` ou dígito; fallback da IA; Centro de Custo sem rota pelo evento e pelo `retryRun("summary")`;
- bloco `── 06-10 ──` da Task 2, L1–L6: dado corrigido antes da aprovação; segundo ciclo; releitura que falha (503 transitório, 404 permanente); a guarda sem `parsed`; Menção ausente e `simpleMessage`; código não conferido (plano indisponível, candidato sem similaridade, conferido).

Em F1–F7 e L1–L6, raw com 0 chamadas.

RED visto antes de cada GREEN:
- Task 1: o arquivo não carregava, porque faltava a exportação `TEXTO_PUBLICO_DA_FALHA_DO_RESUMO`.
- Task 2: L1–L6 falhavam (6 fail de 43).

### Edições em testes existentes (só a lista fechada do plano)

Todas em `payment-automation-service.plataforma.test.ts`, na Task 1:
- S5 (d): as duas asserções de texto viraram `erro inesperado no Agente` (o `motivo`, com a mensagem da asserção atualizada para "texto fixo por classe") e `Não consegui montar o Resumo: erro inesperado no Agente.` (o aviso). Mais nada no teste mudou.
- `comCenarioDoResumo`: só ACRÉSCIMO do campo `store` na interface `CenarioDoResumo` e no objeto passado ao corpo. Nenhuma linha do helper mudou.
- Uma linha de `import` nova no topo (`TEXTO_PUBLICO_DA_FALHA_DO_RESUMO`), só acrescentada.

Na Task 2, nenhuma linha existente mudou: `git diff -U0 … | grep -c '^-[^-]'` deu 0 antes do commit. A opção `candidatos` que o plano permitia no helper não foi preciso criar. Os candidatos entram por `mock.method(cenario.store, "matchCategory", …)` no próprio teste, e a Tarefa trocada entra pelo embrulho `plataforma` que o helper já aceitava (`plataformaComTarefa`).

`payment-automation-service.legado.test.ts` ficou sem diff.

### O embrulho `iaComRawDaSolicitacao` do 06-09

**Deixou de ser necessário.** Conferido sem commit: com D3 usando `{}` e E1 usando `presa.embrulhar(padrao)`, os 43 testes do arquivo passaram. Depois o arquivo foi restaurado com `git checkout --` e conferido com `git diff --quiet`.

Ficou no arquivo porque o plano não autoriza editar os testes do 06-09. O comentário dele (que cita o WR-03 "corrigido pelo 06-10") continua verdadeiro. Removê-lo é uma limpeza opcional para um plano futuro.

## Mutações

Todas foram aplicadas por script sobre o arquivo commitado e restauradas com `git checkout -- <arquivo>`, conferidas com `git diff --quiet`.

| # | Mutação | Resultado |
|---|---|---|
| M1 | o aviso volta a usar a mensagem do erro (`detalhe` = primeira linha crua, comentário `…: ${detalhe}`) | **F1 e F2 falham**. Também F3, F4, F6 e S5 (d), todos pelo texto do aviso |
| M2 | `detalheSanitizadoDaFalha` sem `sanitizarMotivo` | **F1 falha**: `technicalMessage vaza Fornecedor Fictício LTDA: OMIE_RECUSOU: IncluirCliente: O CNPJ [removido] de Fornecedor Fictício LTDA já está cadastrado`. F2 também, com o `1234.56` |
| M3 | sem a guarda do Centro de Custo | **F6 falha**: o log mostra "Fornecedor criado no Omie." com a credencial TRIA e o RESUMO publicado. F7 também |
| M4 | sem a troca da observação da IA | **F5 falha** |
| M5 | `executarResumoDaPlataforma` volta a `parsePaymentComment(linha.comentario)`, sem releitura e com a guarda de `publicarResumoDepoisDaAprovacao` desligada | **L1 e L2 falham**. L3 também (sem releitura não há falha de leitura) e L4 (sem guarda) |
| M6 | `publicarResumoDepoisDaAprovacao` relê por `this.adapter.getTask` nas duas coortes | **legado `fluxo manual (ClickUp): fornecedor novo é criado no Omie com a credencial da configuração…` falha**: o legado sem edição guarda a releitura |
| M7 | sem o `console.warn` da Menção | **L5 falha** |
| M8a | marcar sempre | **L6 (c) falha** (linha 1852, `doesNotMatch`) |
| M8b | nunca marcar | **L6 (a) falha** (linha 1836). A (b) não chega a rodar, porque é o mesmo teste |
| M8c | extra, para provar a (b) sozinha: `conferidoNoOmie = omieValidado`, sem a similaridade | **L6 (b) falha** (linha 1844), com a (a) passando |

## Acceptance greps

- `Não consegui montar o Resumo` fora de comentário: **1** linha de código, que interpola `TEXTO_PUBLICO_DA_FALHA_DO_RESUMO[`.
- `motivoCurto|\.message` dentro de `registrarFalhaDoResumo`: **0**. `motivoCurto` foi removido do arquivo.
- `CENTRO_DE_CUSTO_NAO_ROTEADO`: **7** (≥ 3: tipo, tabela, classe, guarda e comentários).
- Recorte de `executarResumoDaPlataforma`: `this.lerTarefa(taskId)` = **1** e `linha.comentario` = **0**.
- `parsePaymentComment(String(solicitacao.comentario`: **3**. O plano dizia "segue 1", mas já eram 3 no BASE `9e45d84`: linhas 923 (`reviseSummary`), 1999 (`publicarResumoDepoisDaAprovacao`) e 2321 (`analyzeApprovalComment`). Nenhuma das três mudou, e a intenção do critério (a leitura padrão do legado intocada) se cumpre.
- `MARCA_DE_CODIGO_NAO_CONFERIDO`: **4** (≥ 2). `RESUMO publicado na Solicitação.`: **1**.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `sanitizarErro` não remove chave de API da OpenAI**
- **Found during:** Task 1 (F5)
- **Issue:** o plano manda `sanitizarErro(observacao).summary` no `technicalMessage` e exige que `sk-proj-abc123` não apareça. `PADROES_SENSIVEIS` não tem padrão para `sk-…`, então a chave passaria.
- **Fix:** `PADRAO_DE_CHAVE_DE_API` (`/\bsk-[A-Za-z0-9_*-]{3,}/g`) e `textoSemSegredo()`, que é `sanitizarErro` mais esse padrão. `textoSemSegredo` é usado onde o plano dizia `sanitizarErro`: nota da IA, `console.error` das falhas de registro e a base de `detalheSanitizadoDaFalha`. `platform-adapter-queue.ts` não foi tocado, porque não está no plano e mudaria a fila.
- **Commit:** c889556

**2. [Rule 2 - Segurança] Payload do evento de sucesso do summary**
- **Issue:** `payload.parsed` do `logEvent` de sucesso levaria a nota crua da OpenAI, com o trecho da chave.
- **Fix:** o payload leva o objeto publicado. Na fonte ClickUp é o próprio `summary.parsed` (o mesmo objeto), então nada muda ali. F5 confere que nenhum evento leva `sk-proj-abc123`.
- **Commit:** c889556

**3. [Rule 1 - Teste] L2 pelo documento entregue a `ensureSupplier`**
- **Issue:** o `OmieAdapter` real guarda o fornecedor em cache pelo documento. No segundo ciclo, `ensureSupplier` não chega ao Omie falso, e a asserção "o Omie recebe o documento" por `ListarClientesResumido` não tinha o que ver.
- **Fix:** L2 espiona `ensureSupplier` no adapter do cenário (embrulho `omie`, sem mudar o helper). Confere que os dois ciclos entregam `00.000.000/0001-91` e que o `codigoIntegracao` do segundo Resumo é `00000000000191`. Com a leitura antiga, o segundo ciclo entregaria documento vazio e `ensureSupplier` lançaria (M5 prova). O L1 continua conferindo o Omie falso, porque lá o documento é novo e não há cache.
- **Commit:** 42ca9b5

**4. Menor.** O critério `parsePaymentComment(String(solicitacao.comentario` "segue 1" foi mal contado no plano. Eram 3 no BASE e continuam 3 (ver Acceptance greps).

## Deferred Issues (fora do escopo, só registrados)

- `step()` grava `error.message` cru em `upsertStep(...).errorMessage` (tabela de passos), nas duas coortes. É interno, não é público nem vai para o log do processo. Mudar isso toca todos os passos do legado, que o plano manda manter byte a byte.
- `listOmieCategoriasComRetry` faz `console.warn` com a mensagem crua do erro de `ListarCategorias`, também nas duas coortes. Uma falha ali não vira aviso público, porque é absorvida.
- A linha continua guardando `comentario: summary.raw`, e na plataforma isso inclui a nota de fallback da IA. É interno e, depois deste plano, nunca é publicado nem relido.

## Verificação bloqueada

Nenhuma.

## Known Stubs

Nenhum.

## Threat Flags

Nenhuma superfície nova além do threat model:
- T-6-10-01, 02, 03, 04 e 05: mitigadas e provadas por F1/F2, F5, F6/F7, L1/L2 e L6, cada uma com a sua mutação.
- T-6-10-06: o `console.warn` cita só o id do ClickUp de Contas a Pagar e o nome da variável.

## Next Phase Readiness

- 06-15: o deploy precisa subir `c889556..42ca9b5`, sem variável de ambiente nova. Para o RESUMO mencionar Contas a Pagar em produção, `PLATAFORMA_MEMBRO_POR_CLICKUP_ID` precisa do par `81581816=<Membro de Contas a Pagar>`. Sem ele, cada RESUMO sai sem Menção e o log avisa com `[summary] sem Membro da plataforma para Contas a Pagar`.
- Na plataforma, o S5 agora faz um `GET` da Tarefa pela porta a cada ciclo, então a plataforma precisa responder `getTask`. Se ela estiver fora, o erro é transitório e a varredura repete; um 404 vira o aviso "a plataforma recusou o pedido do Agente".

## Self-Check: PASSED

- FOUND: `c889556` e `42ca9b5` em `git log --oneline 9e45d84..HEAD` (financeiro-tria).
- FOUND: os três arquivos de `files_modified` nos commits.
- FOUND: `npm test` 708/708 e `tsc` verde depois do último commit. Legado sem diff; `git diff --ignore-cr-at-eol --stat` vazio; `git status --short | wc -l` = 89.
