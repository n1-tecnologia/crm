---
phase: 06-conferencia-do-resumo-e-anexos
verified: 2026-09-30T00:34:23Z
status: gaps_found
score: 4/5 critérios de sucesso verificados (1 parcial)
overrides_applied: 0
gaps:
  - truth: "Critério 2 / RES-02 — \"ok\" no fio produz `✅ Resumo conferido por …`; qualquer outra resposta de um revisor gera `🔁 Ajuste pedido por …` e um Resumo revisado"
    status: partial
    reason: "Domínio e ponte implementam a decisão pelo fio, mas nenhuma pessoa consegue responder no fio pela tela. Numa conta a pagar, `tarefa-completa.tsx:321/2145` renderiza `Timeline` (e não `TaskComments`). O compositor do `Timeline` (`timeline.tsx:284`) só grava Comentário raiz, sem `parentCommentId`, e não tem o gesto \"Responder\". A ponte só lê RESPOSTAS ao raiz do fio (`respostasDeConferenciaPendentes`, `financeiro.ts:186`). Quem escreve \"ok\" no compositor da conta, como fazia no ClickUp, cria um Comentário raiz: nada acontece e ninguém é avisado. A captura `cp-conferida-conferencia.png` mostra só o compositor raiz. A jornada conferiu pelo card por esse motivo (`jornada-financeiro.mjs:47,422`)."
    artifacts:
      - path: "apps/web/src/features/tarefa/timeline.tsx"
        issue: "o compositor não tem modo resposta (sem `parentCommentId`) e a lista de Comentários não tem o botão \"Responder\""
      - path: "apps/web/src/features/estrutura/tarefa-completa.tsx"
        issue: "`ehSolicitacaoDePagamento = task.listId === CP.listId` troca `TaskComments` (que tem \"Responder\", `task-editors.tsx:841-857`) por `Timeline` justamente nas contas a pagar"
    missing:
      - "Gesto \"Responder\" no Comentário do Resumo dentro do `Timeline`, gravando `addTaskComment` com `parentCommentId` = raiz do fio. O molde existe em `TaskComments`/`CommentComposer`."
      - "Ou, como alternativa de domínio: `respostasDeConferenciaPendentes` aceitar também Comentários RAIZ de revisores publicados depois do Resumo vigente. Isso exige teste novo e mutação."
      - "Teste de componente provando que a resposta no fio do Resumo sai com `parentCommentId`, e um passo \"ok no fio\" na jornada `cp-conferida` (hoje ela usa o card)."
human_verification:
  - test: "Passo 2B do roteiro (`docs/08-migracao-financeiro/08-roteiro-de-producao-pos-correcoes.md`), parte \"Depois, em `lancar`\": subir a API com `AGENTE_CONTAS_A_PAGAR_MODO=lancar` contra o `automation/` com o contrato v1.1. Numa conta de teste com anexo, conferir o Resumo e mover para \"em lançamento omie\"."
    expected: "Um `/lancar` com `codigoCategoriaConfirmado` e `anexos [{url,nome}]`. No fio, `✅ Lançado no Omie — título … · anexos 1 de 1`, e a conta em \"lançado omie\". Um título recusado pelo Omie volta a \"para pagar\" com o motivo."
    why_human: "É escrita real no Omie pela ponte; o agente não sobe a API em `lancar`. Hoje o caminho está provado com `servidorFalso` e com o contrato de ponta a ponta. O `teste:omie-real --lancar --anexo` passou, mas chama a rota direto e sem `codigoCategoriaConfirmado`."
  - test: "S5/S6 ao vivo, depois do deploy do `automation/` (`financeiro-tria` `d462f6e..2cd13cd`) e de `PLATAFORMA_MEMBRO_POR_CLICKUP_ID` com o par de Contas a Pagar. Aprovar e reprovar por clique uma Solicitação de teste da coorte plataforma."
    expected: "Na aprovação, o `📋 RESUMO DE PAGAMENTO` publicado na Solicitação, com Menção ao Membro de Contas a Pagar. Na reprovação, `Sua solicitação foi reprovada, verifique o comentário do Especialista.`"
    why_human: "Só está provado com portas falsas (PostgREST falso, Omie falso em loopback); depende de deploy e de variável de ambiente de produção."
---

# Fase 6: Conferência do Resumo e anexos — Relatório de verificação

**Objetivo da fase:** a plataforma reproduz os Fluxos 5, 6 e 7 do módulo TRIA
do mesmo jeito que o `financeiro-tria/automation` faz no ClickUp. O Agente
publica o Resumo ANTES do lançamento, mencionando o Financeiro, e abre uma
Conferência. O Financeiro confere (clique ou "ok" no fio) ou pede ajuste
(qualquer outra resposta), e o Agente republica o Resumo revisado. A ponte só
chama `/lancar` com Conferência aprovada para os dados atuais, mandando a
categoria confirmada e os anexos. Na falha permanente, a conta volta a "para
pagar". A Solicitação ganha S5/S6 na coorte plataforma.
**Verificado em:** 2026-09-30T00:34:23Z, sobre `crm-n1-integracao@d183e69` e `financeiro-tria@2cd13cd`
**Status:** gaps_found
**Reverificação:** não; é a verificação inicial.

## O objetivo foi alcançado?

### Critérios de sucesso (ROADMAP, Fase 6)

| # | Critério | Status | Evidência |
|---|---|---|---|
| 1 | Conta completa em "para pagar" recebe no fio o Resumo do Agente, aberto e com Menção ao Financeiro. A Conferência pendente aparece no card e na fila. Nenhum Resumo nasce resolvido pelo Agente. | ✓ VERIFICADO | `publicarResumoParaConferencia` (`financeiro.ts:352-452`): texto `buildResumoDePagamento` + `TEXTOS_DA_CONFERENCIA.chamada`, Menção por `avisadoDaConferencia`, sem `resolved`, e `solicitarConferenciaDoResumo` com `processStep: "resumo"`. A ponte não chama mais `runLancamentoAgent(` (grep fora de comentário = 0). Card: `PainelDeDecisaoDaTarefa` (`tarefa-completa.tsx:1520`); fila: `ia/aprovacoes/page.tsx:351`. Testes do domínio 90/90 (6 arquivos) e do card 22/22. Jornada real: Resumo no fio em 14 s e card "Pendente". |
| 2 | Clique ou "ok" no fio geram `✅ Resumo conferido por …` e resolvem o fio sem mudar o Status. Qualquer outra resposta de revisor gera `🔁 Ajuste pedido por …` e um Resumo revisado no mesmo fio. | ⚠ PARCIAL (gap) | Pelo clique: VERIFICADO. `decideProcessApproval` tem o ramo `resumo` sem Status (`ai.ts:401-450`); o card e a fila usam `useDecisaoDeAprovacao` com `source:"click"`. Na jornada real saíram `✅ Resumo conferido` e `Revisado a pedido de` pelo card. **Pelo fio: só em teste.** A ponte lê `respostasDeConferenciaPendentes` → `classificarRespostaDeConferencia` → `decideProcessApproval(source:"comment")` (`invocar-agente.ts:862-884`), coberta por (f)(g)(h). Mas a tela da conta não deixa responder no fio: ver Gaps. |
| 3 | Em `lancar`, conta em "em lançamento omie" com Conferência aprovada para os dados atuais: lançada com `codigoCategoriaConfirmado` e `anexos`, confirmação no fio, e a conta vai a "lançado omie". Sem Conferência, ZERO `/lancar`. Falha permanente devolve a conta a "para pagar". | ✓ VERIFICADO (código e teste) · ? a prova real fica com o dono | O `/lancar` só existe no ramo `conferida` + `emLancamento` + `entrouPorMovimento` + `modo==="lancar"` (`invocar-agente.ts:824-852`). O corpo leva `codigoCategoriaConfirmado` = `origin.lancamento.codigo` e os `anexos` de `anexosDaConta` (`:971`). `registrarLancamentoNoOmie` confere de novo `conferida` para a impressão atual dentro da transação (`financeiro.ts:485`). `registrarFalhaDoLancamento` → `paraPagar` (`:588-592`). Testes: `invocar-agente.test.ts` (j)(k)(l)(m)(n) e `contrato-contas-a-pagar-ponte.test.ts`; `src/automacoes/` deu 185 passados, 17 pulados, 0 falhas. Falta o ponta a ponta real em `lancar` (item humano 1). |
| 4 | Em `ensaio` e `conferencia`, zero `/lancar` em qualquer ciclo (servidor falso). Contrato v1.1 aditivo e igual nos dois repositórios. `teste:omie-real --lancar --anexo` sobe um anexo de verdade e exclui o título. | ✓ VERIFICADO | `ensaio` retorna antes do Momento 2 (`:838-842`). `conferencia` comenta `modoConferencia` e retorna (`:843-849`). Mutação M1 de 06-03 derruba (i) e G3. `diff -r contratos/contas-a-pagar-v1 …/financeiro-tria/automation/contratos/contas-a-pagar-v1` vazio (20 arquivos). Schemas `.strict()` sem `/v2`. `financeiro-tria` `npm test` 571/571. Omie real: registrado em `06-PROVAS.md` (título 5872791251, anexo 1 de 1, exclusão confirmada pelo id), rodado pelo orquestrador com autorização do dono. O verificador não o repetiu porque é escrita em produção. Jornada real: contador independente com 3 `/resolver` e 0 `/lancar`. |
| 5 | `handlePlatformApprovalDecision` publica o Resumo depois de `aprovada` e avisa o Solicitante em `rejeitada`, pela porta e nunca por `legacyClickUpRaw()`. | ✓ VERIFICADO | `payment-automation-service.ts`: S6 `createComment(TEXTO_DA_REPROVACAO, mentionMemberIds: [])`; S5 `publicarResumoDepoisDaAprovacao` → `selectAccount`/`ensureSupplierAndCategory`/`postPaymentSummary` (`this.adapter.createComment`). A falha do S5 é capturada e não desfaz a aprovação. `grep legacyClickUpRaw` no handler e nos três passos = 0. Os testes da plataforma trocam o raw por um falso que lança, e o 571/571 passa. |

**Score:** 4 de 5 critérios verificados; o critério 2 está parcial.

### Decisões D6-01..D6-13: foram honradas?

| Decisão | Situação |
|---|---|
| D6-01 Resumo a partir de "para pagar" | ✓ `statusOlhados` por `AGENTE_CONTAS_A_PAGAR_RESUMO_A_PARTIR_DE`. Desvio conservador G1: conta **importada** e parada não é varrida (ver abaixo). |
| D6-02 "ok" no fio vale | ✓ no domínio e na ponte; ✗ na tela (é o gap). A leitura de `false` ("só o clique aprova, o fio só pede ajuste") segue o CONTEXT. |
| D6-03 falha volta a "para pagar" | ✓ (`falhaSemVolta` quando o Status recusa: o aviso não afirma o que não aconteceu). |
| D6-04 Manual = não encosta | ✓ padrão; `sem-conferencia` implementado com o Membro de serviço como aprovador. |
| D6-05 contrato aditivo v1.1 | ✓ (única mudança v1: `anexos[""]` passou a dar 400, documentado em §7). |
| D6-06 S5/S6 pela porta | ✓ |
| D6-07 conversão continua pelo botão | ✓ nenhuma mudança. |
| D6-08 errata dos 2 dias úteis | ✓ `solicitacao-de-pagamento.md` (errata = 1). |
| D6-09 revisores | ✓ `revisoresDoResumo`. A tela também exige `memberSeesTask`. |
| D6-10 tripla como dado | ✓ `origin.lancamento`, e nenhuma releitura de texto. |
| D6-11 três modos por literal exato | ✓ `resolverModo`. |
| D6-12 cutucão | ✓ `tarefasAfetadasPelaOperacao` → `cutucarPonte` depois do commit, fora da transação. |
| D6-13 sem nº de NF | ✓ `corpoLancarDe` não manda `numeroDocumentoFiscal`. |

### Artefatos obrigatórios

| Artefato | Existe | Substantivo | Ligado | Status |
|---|---|---|---|---|
| `packages/dominio/src/operations/financeiro.ts` (+ `financeiro-textos.ts`) | ✓ | ✓ (publicar, conferência, respostas, heurística, registrar lançamento e falha) | ✓ importado pela ponte e pela tela | ✓ VERIFICADO |
| `packages/dominio/src/types/ai.ts` (ramo `resumo`) | ✓ | ✓ | ✓ | ✓ VERIFICADO |
| `packages/dominio/src/operations/ai.ts` (`solicitarConferenciaDoResumo`, ramo `resumo`) | ✓ | ✓ | ✓ | ✓ VERIFICADO |
| `apps/api/src/automacoes/invocar-agente.ts` | ✓ (1104 l.) | ✓ | ✓ `index.ts:139-166` | ✓ VERIFICADO |
| `apps/api/src/automacoes/anexos-da-conta.ts` | ✓ | ✓ (`urlDeDownload`, dedupe, avisos sem URL) | ✓ `invocar-agente.ts:969` | ✓ VERIFICADO |
| `apps/api/src/automacoes/ponte-ativa.ts` | ✓ | ✓ | ✓ `rotas/operacoes.ts:323`, `index.ts:156` | ✓ VERIFICADO |
| `apps/web/src/features/tarefa/painel-conferencia-do-resumo.tsx` | ✓ (421 l.) | ✓ (`state.approvals` = 0; `useDecisaoDeAprovacao`) | ✓ `tarefa-completa.tsx:992,1520`; `contas-view.tsx:908,1098` | ✓ VERIFICADO |
| `apps/web/scripts/jornada-financeiro.mjs` (`cp-conferida`/`cp-ajuste`) | ✓ | ✓ (11 ocorrências; `node --check` OK) | executada de verdade (`RESULTADO: OK`) | ✓ VERIFICADO |
| `financeiro-tria` `contas-a-pagar-routes.ts` / `-resolucao.ts` / `-lancamento.ts` / `omie.ts` | ✓ | ✓ (`codigoCategoriaConfirmado` troca o RAG; `fileName` → zip e `cNomeArquivo`) | ✓ | ✓ VERIFICADO |
| `financeiro-tria` `payment-automation-service.ts` (S5/S6) | ✓ | ✓ | ✓ webhook → handler | ✓ VERIFICADO |
| `06-PROVAS.md` | ✓ | ✓ (as quatro seções; capturas existem em `/var/folders/…/jornada-financeiro/`) | — | ✓ VERIFICADO |

### Ligações-chave

| De | Para | Via | Status |
|---|---|---|---|
| `publicarResumoParaConferencia` | `solicitarConferenciaDoResumo` | chamada direta (`financeiro.ts:417`) | ✓ LIGADO |
| `decideProcessApproval` (ramo `resumo`) | `addTaskComment` com `parentCommentId = threadCommentId` | `ai.ts:414` | ✓ LIGADO |
| `rotas/operacoes.ts` | `cutucarPonte` | depois do commit, só em `ok` | ✓ LIGADO |
| `invocar-agente.ts` | `registrarLancamentoNoOmie` / `registrarFalhaDoLancamento` | `executarOperacao` (uma transação) | ✓ LIGADO |
| `contrato-contas-a-pagar.test.ts` (crm-n1) | `financeiro-tria/.../contas-a-pagar-v1/` | hash e `diff -r` | ✓ LIGADO |
| card e fila | `useDecisaoDeAprovacao` → `decideProcessApproval(source:"click")` | import | ✓ LIGADO |
| **Tela da conta (`Timeline`)** | **resposta no fio do Resumo** | **`addTaskComment` com `parentCommentId`** | **✗ NÃO LIGADO** (é o gap) |

### Fluxo de dados (nível 4)

| Artefato | Dado | Fonte | Dado real? | Status |
|---|---|---|---|---|
| Card / pílula | `conferenciaDoResumo(state, task)` | `state.approvals` hidratado de `/estado` | ✓ (captura real: "Conferido por … por clique", tripla TRIA · Contas de Consumo · 2.04.03) | ✓ FLUINDO |
| Ponte, Momento 1 | `dePara` | `/resolver` do `automation/` | ✓ (3 `/resolver` 200 na prova) | ✓ FLUINDO |
| Ponte, Momento 2 | `anexos` | `task.fieldValues` + `task.attachments` → `urlDeDownload` | ✓ em teste; o real em `lancar` fica com o dono | ✓ (teste) |

### Verificações por comando (rodadas por este verificador)

| Comportamento | Comando | Resultado | Status |
|---|---|---|---|
| Domínio da Conferência | `npx vitest run` com conferencia-do-resumo, decisao-da-conferencia, lancamento-registrado, conferencia-avisar, conta-importada-e-resumo e agente-de-lancamento | 6 arquivos, 90/90 | ✓ |
| Ponte e contrato, sem banco | `DATABASE_URL= npx vitest run src/automacoes/` | 185 passados, 17 pulados, 0 falhas | ✓ |
| Card, fila e pílula | `npx vitest run painel-conferencia-do-resumo.test.tsx` + `painel-conferencia-importada.test.ts` | 22/22 e 2/2 | ✓ |
| Produtor v1.1 e S5/S6 | `financeiro-tria/automation npm test` | 571/571 (17,8 s) | ✓ |
| Contrato igual | `diff -r` das duas cópias | vazio (20 arquivos) | ✓ |
| Jornada | `node --check scripts/jornada-financeiro.mjs` | OK | ✓ |
| A ponte não publica Resumo resolvido | grep `runLancamentoAgent(` em `apps/api/src` e `apps/web/src` (fora de teste e de comentário) | 0 | ✓ |

### Execução de provas (probes)

Não há `scripts/*/tests/probe-*.sh` declarado pela fase. As provas do mundo
real (jornada em `conferencia` contra `ws_n1` e `teste:omie-real --lancar
--anexo`) gravam em produção e foram rodadas pelo orquestrador com autorização
do dono. O verificador conferiu que as capturas existem e que o código e os
testes sustentam o relato, mas não as repetiu.

### Cobertura dos requisitos

| Requisito | Planos | Descrição | Status | Evidência |
|---|---|---|---|---|
| RES-01 | 06-01, 06-03 | Resumo antes do lançamento, aberto, com Menção; Conferência com a tripla | ✓ SATISFEITO | Critério 1 |
| RES-02 | 06-01, 06-03, 06-04 | Clique ou "ok" no fio; ajuste → Resumo revisado | ⚠ PARCIAL | Clique OK; "ok"/ajuste pelo fio sem gesto na tela |
| RES-03 | 06-01, 06-02, 06-03 | `/lancar` só com Conferência; código confirmado; falha volta a "para pagar" | ✓ SATISFEITO (teste) | Critério 3; a prova real em `lancar` é item humano |
| RES-04 | 06-02, 06-03 | Anexos com URL assinada e nome; `teste:omie-real --anexo` | ✓ SATISFEITO | Critério 4 + `06-PROVAS.md` |
| RES-05 | 06-05 | S5/S6 pela porta | ✓ SATISFEITO | Critério 5 |
| RES-06 | 06-03, 06-04, 06-06 | Modo `conferencia`, jornada, specs, provas | ✓ SATISFEITO | Jornada `RESULTADO: OK`, 0 `/lancar`; RN-CP-08/09 = 3; errata = 1 |

Nenhum requisito órfão: RES-01..06 aparecem nos planos. Há uma inconsistência
de rastreio: `REQUIREMENTS.md` ainda marca RES-01..04 como `[ ] … Pendente`,
enquanto o ROADMAP marca a fase "Complete". Depois de fechar o gap, atualizar
RES-01, RES-03 e RES-04 (já satisfeitos) e RES-02.

### Anti-padrões e achados

| Arquivo | Linha | Achado | Severidade | Impacto |
|---|---|---|---|---|
| `apps/web/src/features/tarefa/timeline.tsx` | 284 | O compositor só grava raiz; "ok" digitado ali é ignorado pela ponte, sem nenhum aviso | 🛑 Bloqueador (do critério 2) | O Financeiro que responde como no ClickUp acha que conferiu e não conferiu. A conta fica pendente em silêncio. |
| `apps/api/src/automacoes/invocar-agente.ts` | 580-590, 1060-1075 | Cada ciclo (relógio e cada cutucada) hidrata o Espaço inteiro. Na jornada houve 3 × `Query read timeout` (30 s) e 1 × timeout de conexão durante as gravações da tela. A ponte se recuperou no ciclo seguinte. | ⚠️ Aviso | Nada errado foi gravado; o custo foi latência (Resumo em 61 s em vez de ~15 s). É confiabilidade antes da produção, não falta de função da fase: acompanhar como item próprio. |
| `apps/web/src/features/tarefa/timeline.tsx` | 190 | O Comentário do Resumo leva a pílula "Pedido de aprovação" (herdada do roteamento da Solicitação) | ℹ️ Info | Rótulo impreciso para uma Conferência. |
| `invocar-agente.ts` | 976-1024 | Se um Campo muda durante o `/lancar` (janela de até 60 s), o título já existe no Omie com os dados conferidos, mas `registrarLancamentoNoOmie` recusa (`desatualizada`). A ponte comenta "Confira e mova à mão". | ℹ️ Info | Tratado com aviso; o Omie fica com os dados que foram conferidos. |
| Marcadores TBD/FIXME/XXX | — | nenhum nos arquivos da fase (o único acerto é "TODOS", em português) | — | — |

### Os quatro pontos em aberto pedidos pelo orquestrador

**(a) Não há gesto "Responder" na tela: é GAP, não desvio aceitável.** O
objetivo e o critério 2 pedem literalmente "clique **ou 'ok' no fio**" e
"qualquer outra resposta → ajuste". O código de domínio e de ponte existe e
está testado, mas o caminho não é alcançável por uma pessoa. O
componente que já tem "Responder" (`TaskComments`) é trocado por `Timeline`
justamente em `CP.listId` (`tarefa-completa.tsx:321,2145`). Pior que a
ausência é o efeito silencioso: um "ok" digitado vira Comentário raiz, a ponte
o ignora (`parentCommentId === threadCommentId`) e ninguém avisa. A correção é
estreita: responder no `Timeline`, ou a ponte aceitar raiz de revisor depois
do Resumo vigente.

Se o dono decidir que, nesta fase, só o clique basta (D6-02 já chamava o
clique de "caminho oficial"), basta acrescentar ao frontmatter:

```yaml
overrides:
  - must_have: "Critério 2 / RES-02 — \"ok\" no fio produz `✅ Resumo conferido por …`; qualquer outra resposta de um revisor gera `🔁 Ajuste pedido por …` e um Resumo revisado"
    reason: "Clique (card e fila) cobre conferir e pedir ajuste; a decisão pelo fio está pronta no domínio e na ponte e entra quando a tela ganhar o gesto Responder"
    accepted_by: "<dono>"
    accepted_at: "<ISO>"
```

Mesmo assim, o efeito silencioso do "ok" na raiz merece um aviso na tela.

**(b) `lancar` de ponta a ponta com o Omie real pela ponte: é HUMAN_NEEDED,
não gap.** O comportamento está provado no código e no teste: ramos (j)–(n),
contrato de ponta a ponta com os exemplos canônicos, e a revalidação de
`conferida` dentro da transação. A escrita real pela ponte é o passo 2B do
roteiro, reservado ao dono. Ressalva: o `teste:omie-real --lancar --anexo`
passou pela rota `/lancar` real, mas **sem** `codigoCategoriaConfirmado`
(`teste-omie-real.ts:366`). O código confirmado contra o Omie real só aparece no
passo 2B.

**(c) G1–G3 não enfraquecem a produção com as variáveis vazias.**

- `lerOpcoesDeEscopo` devolve `{}` para ausente ou em branco (`trim()`).
- `dentroDoEscopo(task, undefined)` é `true`.
- `avisarDoCiclo` devolve `undefined`, e toda Menção cai em `avisadoDoLancamento` (o Financeiro).
- `avisadoDaConferencia` só troca por um Membro ativo.
- A linha de partida denuncia `escopo=`/`avisar=`. README e roteiro dizem "Produção: vazio".

G1 fica sempre ligado, mas é **mais restritivo**. A conta importada do ClickUp
e parada não recebe Resumo até alguém movê-la na plataforma. Depois de um
movimento, ela entra no fluxo normal (Resumo → Conferência → `/lancar`). É um
desvio conservador de D6-01 para o legado, e a tela o acompanha
(`conferenciaVisivel` usa `movidaDepoisDaImportacao`, `a39d6d2`). Ele não abre
caminho para `/lancar` sem Conferência. Classificação: desvio aceitável; vale
avisar o dono.

**(d) Timeouts transitórios no ciclo: AVISO, fica como item próprio, não gap
desta fase.** A recuperação funcionou e nada foi gravado errado nem em
duplicidade (a chave de idempotência é fixa por Tarefa). A causa provável
está no desenho: hidratação completa do Espaço a cada ciclo e a cada cutucada,
sob gravação concorrente. Nenhuma fase posterior do ROADMAP cobre isso, então
não é "deferred". Deve ser investigado antes de ligar a ponte em produção,
como `06-PROVAS.md` já registra.

### Verificação humana necessária

1. **Passo 2B em `lancar`.** Subir a API em `lancar` contra o `automation/`
   v1.1, conferir o Resumo de uma conta de teste com anexo e movê-la para "em
   lançamento omie". Esperado: `/lancar` com `codigoCategoriaConfirmado` e
   anexos, `✅ Lançado no Omie — título … · anexos 1 de 1` no fio e a conta em
   "lançado omie". Numa recusa, a conta volta a "para pagar". *Por que humano:*
   é escrita real no Omie pela ponte, reservada ao dono.
2. **S5/S6 ao vivo.** Depois do deploy do `automation/` e de
   `PLATAFORMA_MEMBRO_POR_CLICKUP_ID`, aprovar e reprovar uma Solicitação de
   teste da coorte plataforma. Esperado: o RESUMO com Menção na aprovação e o
   aviso de S6 na reprovação. *Por que humano:* hoje só há prova com portas
   falsas, e depende de deploy.

### Resumo dos gaps

Um gap só, e estreito. O caminho "ok no fio" e "qualquer resposta = ajuste"
existe no domínio e na ponte, testado com mutação, mas a tela da conta a pagar
não permite responder no fio. O `Timeline` usado em `CP.listId` só grava
Comentário raiz, e a ponte só lê respostas. O Financeiro consegue fazer o
Fluxo 6 inteiro pelo clique (card e fila), e isso passou na jornada real. Já a
metade "como no ClickUp" (responder "ok" ao RESUMO) não é alcançável, e
falha em silêncio. Todo o resto do objetivo está no código e ligado:

- o Resumo antes do lançamento, com Menção e Conferência;
- a revisão no mesmo fio;
- zero `/lancar` sem Conferência e nos modos sem caneta;
- o código conferido e os anexos com nome;
- a falha que volta a "para pagar";
- o contrato v1.1 igual nos dois lados;
- S5/S6 pela porta.

Os pontos (b) e (d) não bloqueiam a fase: (b) é verificação humana e (d) é
aviso para antes da produção.

---

_Verificado em: 2026-09-30T00:34:23Z_
_Verificador: Claude (gsd-verifier)_
