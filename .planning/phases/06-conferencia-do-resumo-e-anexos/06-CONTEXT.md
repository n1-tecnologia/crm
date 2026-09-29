# Phase 6: Conferência do Resumo e anexos — Context

**Gathered:** 2026-09-29
**Status:** Ready for execution (planos 06-01..06-06 escritos à mão a partir de
`docs/08-migracao-financeiro/09-plano-conferencia-do-resumo-e-anexos.md` e
`10-levantamento-fluxo-atual-x-documentacao-x-backend.md`)

<domain>
## Phase Boundary

A plataforma passa a reproduzir os Fluxos 5, 6 e 7 do módulo TRIA da
documentação v2 (`Documentação - Projeto Financeiro Pagamentos.v2.docx`) do
mesmo jeito que o `financeiro-tria/automation` faz hoje no ClickUp:

1. **Fluxo 5** — o Agente publica o `📋 RESUMO DE PAGAMENTO` no tópico da
   conta ANTES do lançamento, aberto ao Financeiro, e abre uma Conferência.
2. **Fluxo 6** — o Financeiro confere (clique ou "ok" no tópico) ou pede
   ajuste (qualquer outra resposta no tópico); o Agente republica o Resumo
   revisado no mesmo tópico e abre outra Conferência.
3. **Fluxo 7** — ao entrar em "em lançamento omie", a ponte só chama
   `/lancar` com Conferência aprovada para os dados atuais, com a categoria
   confirmada e os **anexos**; confirma no tópico e move para "lançado
   omie"; na falha permanente a conta volta para "para pagar" com o motivo.

E fecha a lacuna S5/S6 da Solicitação (coorte plataforma): depois da
aprovação por clique, o pipeline publica o Resumo na Solicitação e avisa o
Solicitante na reprovação.

Não inclui: Cartão/Link de pagamento no `/lancar`, Departamento Omie no
Resumo, número da NF por Gemini, Papel "Revisor do Resumo", lembrete de
conferência parada, mover o `automation/` para o monorepo.
</domain>

<decisions>
## Decisões travadas (com o padrão e o que muda se o dono escolher o outro lado)

Cada decisão abaixo tem um PADRÃO, que os planos implementam, e — onde a
outra escolha é barata — uma variável de ambiente que a troca sem código.
O dono ainda não respondeu às quatro perguntas de `10-levantamento…` (§ "O
que fica para o dono confirmar"); os padrões seguem a regra que ele deu na
Fase 0: **"do mesmo jeito que está no ClickUp"**, exceto onde isso seria
inseguro (D6-04).

### D6-01 — Quando o Resumo aparece
**Padrão:** assim que a conta está completa (`erpMissingFields` vazio), em
"para pagar" ou em "em lançamento omie" — igual ao ClickUp, onde o RESUMO
vem ANTES de a pessoa mover para "em lançamento". Alternativa: só ao entrar
em "em lançamento omie". Variável: `AGENTE_CONTAS_A_PAGAR_RESUMO_A_PARTIR_DE`
= `para-pagar` (padrão) | `em-lancamento-omie`.

### D6-02 — "ok" por comentário vale como conferência
**Padrão:** sim. O clique ("Conferido, pode lançar") é o caminho oficial;
uma resposta de aprovação no tópico (heurística portada do classificador do
legado, `adapters/ai.ts:305-343`, SEM IA) tem o mesmo efeito, em nome de
quem respondeu; **qualquer outra resposta de um revisor é pedido de
ajuste** (Fluxo 6: toda resposta ao RESUMO vira revisão); pergunta ("?"),
"aguardando", "vou verificar" são ignoradas. Variável:
`AGENTE_CONTAS_A_PAGAR_CONFERENCIA_POR_COMENTARIO` = `true` (padrão) |
`false` (só o clique decide; o tópico só pede ajuste).

### D6-03 — Falha permanente no lançamento
**Padrão:** como o backend hoje (`PAS:1057-1083`): comentário com o motivo
e a conta **volta para "para pagar"**. A parada por impressão (plano
pós-auditoria 1.4) continua valendo até a impressão mudar. Alternativa (a
da rodada anterior): ficar em "em lançamento omie" — é trocar uma chamada
em `registrarFalhaDoLancamento`.

### D6-04 — "Integração manual = Manual"
**Padrão (seguro):** "o Agente não encosta" — sem Resumo, sem `/lancar`; o
Financeiro registra o lançamento pelo diálogo "Lançado no Omie". Alternativa
(o que o backend faz, `processManualPayment`): Manual = "sem conferência" —
o Agente publica o Resumo já conferido e lança ao entrar em "em lançamento
omie". Variável: `AGENTE_CONTAS_A_PAGAR_INTEGRACAO_MANUAL` = `nao-encosta`
(padrão) | `sem-conferencia`. O padrão é o seguro porque o outro lança sem
nenhum humano ter olhado a categoria.

### D6-05 — Contrato `contas-a-pagar-v1` cresce de forma ADITIVA (v1.1)
Quatro campos opcionais (`pedidoDeRevisao`, `codigoCategoriaConfirmado`,
`anexos[].nome`, `anexos[].nome` na resposta) — nunca `/v2`. Fixtures
copiadas nos dois repositórios; o teste de contrato dos dois lados e a
comparação por hash (`apps/api/src/automacoes/contrato-contas-a-pagar.test.ts`)
continuam sendo a prova de que as cópias são a mesma matriz. §7 de
`05-contrato…` ganha o parágrafo "v1.1 (aditiva)".

### D6-06 — S5/S6 na Solicitação entram nesta fase (Plano 06-05)
`handlePlatformApprovalDecision` passa a rodar conta → fornecedor →
categoria → RESUMO depois de `aprovada` (a mesma sequência de
`processManualPayment`), e a avisar o Solicitante em `rejeitada`. Tudo pela
porta (`this.adapter`), NUNCA por `legacyClickUpRaw()`; um passo que
precisasse do raw é pulado com log, não executado.

### D6-07 — A passagem Solicitação → Conta continua sendo o botão
"Converter em Conta a pagar" (03-13). A Conta gerada nasce completa e, por
D6-01, ganha o PRÓPRIO Resumo no ciclo seguinte; o Resumo da Solicitação
não é copiado (são duas Tarefas, dois tópicos, um Vínculo). Automação "ao
aprovar, converter": adiada.

### D6-08 — Prazo de 2 dias úteis
O código vence a documentação v2 (3): nenhuma mudança de código; errata em
`docs/07-processos/solicitacao-de-pagamento.md`.

### D6-09 — Quem confere
O Financeiro (`CP.financeiroId`, quando Membro ativo) e Membros de Papel
base Administrador/Proprietário — numa função só, `revisoresDoResumo`, para
o Papel "Revisor do Resumo" (L-11, Liliane) entrar depois sem tocar o resto.

### D6-10 — Os códigos da Conferência são DADO, nunca texto reparseado
A tripla conta · categoria · código e a impressão de lançamento ficam na
`ApprovalRequest` (`origin.processStep === "resumo"`). O `/lancar` recebe
`codigoCategoriaConfirmado` de lá e o valida no plano de contas real. O
texto do RESUMO é saída (CON-CP-08), como sempre foi na plataforma.

### D6-11 — Três modos da ponte
`AGENTE_CONTAS_A_PAGAR_MODO` = `ensaio` (padrão: nada gravado) |
`conferencia` (Resumos, conferências e revisões; **zero** requisições a
`/lancar`) | `lancar`. Só os literais exatos; qualquer outro valor cai em
`ensaio` com aviso (regra de 03-11).

### D6-12 — A ponte é cutucada, não só agendada
Depois de uma gravação numa conta da Lista (Campo, Status, Comentário,
decisão de Conferência), `rotas/operacoes.ts` chama `cutucarPonte()`; a
ponte roda um ciclo em até 2 s (coalescido). Sem evento novo de outbox:
ponte e rota vivem no mesmo processo. O ciclo por intervalo continua.

### D6-13 — Sem número de NF por IA
`numeroDocumentoFiscal` fica vazio no `/lancar` (o Omie aceita). Trazer o
Gemini do legado é decisão à parte.
</decisions>

<canonical_refs>
## Referências canônicas (ler antes de cada plano)

- `docs/08-migracao-financeiro/09-plano-conferencia-do-resumo-e-anexos.md`
  — o desenho (§2) e as mudanças por camada (§3); este CONTEXT o supera
  onde divergir.
- `docs/08-migracao-financeiro/10-levantamento-fluxo-atual-x-documentacao-x-backend.md`
  — o fluxo atual, etapa por etapa, com `arquivo:linha`.
- `docs/07-processos/contas-a-pagar.md` §6.3, §8, §9, §11 (CON-CP-07/08,
  INV-CP-01); `docs/07-processos/solicitacao-de-pagamento.md` §6.4, §8
  (S5/S6), §12 (L-11).
- `docs/08-migracao-financeiro/05-contrato-lancamento-contas-a-pagar-v1.md`
  — o contrato que 06-02 estende.
- `docs/08-migracao-financeiro/07-plano-de-correcoes-pos-auditoria.md`
  (1.4: textos e paradas da ponte) e `08-roteiro-de-producao-pos-correcoes.md`.
- `.planning/phases/03-contas-a-pagar/03-CONTEXT.md` (D3-03 Ensaio),
  `03-PATTERNS.md`, `03-11-PLAN.md` (o molde da ponte e dos testes com
  `servidorFalso`), `03-04-SUMMARY.md` (a forma de `DeParaDeLancamento`).
- `.planning/phases/02-…/02-CONTEXT.md` D-06..D-10 (Aprovação de processo,
  resposta canônica, fallback por comentário).
</canonical_refs>

<code_context>
## O que já existe (ponto de partida, `crm-n1-integracao@3d6f735`, `financeiro-tria@c272dad`)

- **Ponte:** `apps/api/src/automacoes/invocar-agente.ts` (754 l.) — um
  momento só: entrou em "em lançamento omie" → `erpMissingFields` →
  `/resolver` → `/lancar` → `runLancamentoAgent` (Resumo resolvido pelo
  Agente) + `changeTaskStatus(lancado)` numa transação. `corpoLancarDe`
  (373-390) não manda `anexos`. Modos `ensaio`/`lancar`. Parada por
  impressão (`impressaoDaConta`, 251-253). Textos em 392-403.
- **Domínio:** `packages/dominio/src/operations/financeiro.ts` —
  `buildResumoDePagamento` (CON-CP-08, byte a byte), `erpMissingFields`,
  `runLancamentoAgent` (publica o Resumo e o resolve, 491-499),
  `contaSemResumo` (INV-CP-01), `avisadoDoLancamento`, `lancamentoHumanoDe`.
  `operations/ai.ts` — `solicitarAprovacao` (processStep "pagamento"),
  `decideProcessApproval` (resposta canônica no tópico + Status),
  `mayDecideApproval`. `operations/tasks.ts` — `addTaskComment`
  (`parentCommentId`, um nível de fio; `actor` Agente), `resolveTaskComment`
  (autor do fio ou Administrador). `types/ai.ts` — `ApprovalOrigin`
  (`processTask` com `threadCommentId`), `ApprovalRequest.decisionSource`.
  `types/primitives.ts` — `Comment` (`parentCommentId`, `resolved`),
  `WorkspaceFile` (`name`, `objectKey`).
- **Web:** `apps/web/src/features/tarefa/painel-aprovacao.tsx` (card +
  diálogos + `useDecisaoDeAprovacao`), `apps/web/src/app/(shell)/ia/aprovacoes/page.tsx`
  (fila; `renderProcessCard` lê Campos da Solicitação),
  `apps/web/src/features/tarefa/timeline.tsx` (fio, pílula "Resolvido"),
  `apps/web/scripts/jornada-financeiro.mjs` (a jornada, com `comentar`,
  `mudarStatus`, `acaoDoRodape`, `JORNADA_SO`, `JORNADA_RETOMAR`).
- **financeiro-tria:** `http/contas-a-pagar-routes.ts` (schemas 84-168),
  `tenants/tria/contas-a-pagar-resolucao.ts`, `contas-a-pagar-lancamento.ts`
  (anexos 340-353), `adapters/omie.ts::uploadAttachmentFromUrl` (1006-1047,
  nome do arquivo vem da URL), `tenants/tria/payment-automation-service.ts`
  (`handlePlatformApprovalDecision` 1189-1217; `selectAccount`,
  `ensureSupplierAndCategory`, `postPaymentSummary` 1603-1674;
  `processManualPayment` 689-771), `contratos/contas-a-pagar-v1/`,
  `scripts/teste-omie-real.ts` + `tenants/tria/teste-omie-real.ts`.
- **Sinal para a ponte:** `apps/api/src/rotas/operacoes.ts::eventosDeSaidaDaOperacao`
  (48-98) — só Solicitações emitem evento; Contas a pagar, nada.

## Regras de execução desta fase (herdadas das rodadas anteriores — valem para todo plano)

1. **Nunca `git push`.** Commits locais, com caminhos explícitos no `git add`.
2. **`../financeiro-tria` é o checkout `main` com 89 arquivos sujos só de
   fim de linha (CRLF).** `git add` SEMPRE com caminhos explícitos, nunca
   `-A`/`.`; antes do commit, `git diff --cached --stat` tem de listar só os
   arquivos do plano. Caminho absoluto: `/Users/TRIA2026/Projetos/Projetos Cursor/financeiro-tria`
   (um worktree do crm-n1 fora da pasta-mãe não enxerga `../financeiro-tria`).
   `npm test` lá é isolado (`scripts/testes/rodar-isolado.mjs`): 538/538 no
   ponto de partida.
3. **Não ler `.env`** (regra do dono); `.env.example` só por acréscimo
   (`cat >> …`). Segredos nunca em log, teste, fixture ou documento.
4. **Worktree isolado não carrega `.env`:** sem `DATABASE_URL` os testes de
   banco pulam (DEC-09) — não interpretar como falha nem como verde. A suíte
   inteira de `apps/api` contra o Postgres real passa de 10 min e estoura o
   watchdog de subagente: rodar por arquivo.
5. **Não editar teste existente** (CON-05) salvo onde o plano manda; arquivo
   novo por regra nova; mutação conferida (desligar a regra faz o teste
   falhar) e registrada no SUMMARY.
6. **O domínio não faz I/O** (`./CONTEXT.md` da raiz): nenhum `fetch`,
   `process.env` ou `crypto` em `packages/dominio`.
7. **Toda mutação registra Atividade**; strings visíveis em pt-BR;
   identificadores em inglês ou no vocabulário já usado.
8. **Produção:** o classificador pode recusar subir a API em modo `lancar`,
   `--apply` e leituras de tabelas de produção. Recusado → parar, entregar o
   comando exato ao dono, nunca contornar. Lançamento real no Omie só com
   autorização explícita do dono (o `teste:omie-real --lancar` exclui o
   título no fim).
9. **Não editar código enquanto a jornada (`jornada:financeiro`) roda**
   contra o `next dev`: o HMR recarrega a tela e o passo falha em falso.
10. `npm run check` verde nos três workspaces ao fim de cada plano (com e
    sem `DATABASE_URL`); `../financeiro-tria/automation` `npm test` verde ao
    fim de 06-02 e 06-05.
</code_context>

<specifics>
## Textos canônicos (contrato entre domínio, ponte e tela — copiar literalmente)

- Chamada depois do bloco do RESUMO (comentário do Agente, primeira vez):
  `\n\n{financeiro}, confira: responda "ok" para eu lançar, ou diga o que ajustar.`
- Resumo revisado (mesmo bloco, depois dele):
  `\n\nRevisado a pedido de {nome}: "{pedido}".\n{financeiro}, confira de novo: responda "ok" para eu lançar, ou diga o que ajustar.`
- Resumo republicado porque os dados mudaram:
  `\n\nOs dados da conta mudaram depois da conferência.\n{financeiro}, confira de novo: responda "ok" para eu lançar, ou diga o que ajustar.`
- Conferência aprovada (resposta canônica no tópico): `✅ Resumo conferido por {nome}`
- Ajuste pedido (resposta canônica): `🔁 Ajuste pedido por {nome}: {motivo}`
- Lançado: `✅ Lançado no Omie — título {payableId} · {conta} · {categoria} ({codigo}) · anexos {ok} de {total}`
  (com `total = 0`: `· sem anexos`; cada anexo que falhou numa linha `• {nome}: não subiu ({erro})`)
- Modo conferência com a conta em "em lançamento omie" e Resumo conferido (uma vez por impressão):
  `Resumo conferido. Neste ambiente o lançamento no Omie está desligado (modo conferência): nada foi lançado, a conta fica aqui.`
- Falha permanente (D6-03): `Não consegui lançar no Omie: {motivo} ({code}). A conta voltou para "para pagar".`
- Conta em "em lançamento omie" sem Conferência aprovada (uma vez por impressão, só quando o Resumo já existe e está pendente há mais de um ciclo): nada — o próprio Resumo é o pedido.

`{financeiro}` = `displayName` de `avisadoDoLancamento(state, ator)` (o Financeiro quando Membro ativo).

## A impressão de lançamento (D6-10)
`impressaoDeLancamento(state, task)` = JSON canônico (chaves ordenadas) de
`{ centro, empresa, categoria, fornecedor: { tipo, documento, nome }, forma, dado, valor, vencimento, dataEmissao, tag, titulo, descricao }`,
lidos dos Campos `CP.fields.*`, do `dueDate.value`, da Tag `conta *` e de
`task.title`/`task.description`. Anexos NÃO entram. É a mesma função que a
ponte e o domínio usam — a `impressaoDaConta` da ponte deixa de existir.

## Contas a pagar em `ws_n1` (produção) — o que o executor não pode esquecer
Maryane (`mem_maryane`) é Proprietária; `mem_marcos_paulo` existe sem
login; o Agente do pipeline de serviço é `mem_tarjw8`; "pago" foi aberto a
todos em 2026-09-29; a A7 está pausada; a saída de "para pagar" exige os
Campos do Omie (2.1). Nada disto é alterado por esta fase.
</specifics>

<deferred>
## Adiado
- Papel "Revisor do Resumo" (L-11) e lembrete quando a conferência fica parada.
- Cartão / Link de pagamento no `/lancar`; Departamento Omie no Resumo (OQ-CMP-03).
- Número da NF por Gemini no `/lancar` (D6-13).
- Automação "ao aprovar a Solicitação, converter em Conta" (D6-07).
- Reenvio de anexos quando o `/lancar` devolve `reaproveitado: true` (o Omie já os tem do primeiro envio; a ponte guarda o resultado da primeira resposta).
</deferred>
