---
phase: 06-conferencia-do-resumo-e-anexos
plan: 03
subsystem: apps/api (automacoes, rotas) + packages/dominio (opção aditiva)
tags: [ponte-do-agente, conferencia-do-resumo, contas-a-pagar, anexos, omie, cutucao, servidorFalso, vitest]

# Dependency graph
requires:
  - phase: 06-01
    provides: "publicarResumoParaConferencia, conferenciaDoResumo, respostasDeConferenciaPendentes, classificarRespostaDeConferencia, registrarLancamentoNoOmie, registrarFalhaDoLancamento, impressaoDeLancamento, decideProcessApproval (ramo resumo)"
  - phase: 06-02
    provides: "contrato contas-a-pagar v1.1 — pedidoDeRevisao, codigoCategoriaConfirmado, anexos { url, nome }"
provides:
  - "A ponte em dois momentos: Resumo para conferência (Fluxo 5), leitura do fio (Fluxo 6), lançamento só com Conferência aprovada (Fluxo 7)"
  - "Três modos por literal exato (ensaio | conferencia | lancar) — zero /lancar em ensaio e conferencia"
  - "anexosDaConta (URLs assinadas de 5 min com o nome original)"
  - "cutucar() coalescido em 2 s + ponte-ativa.ts + cutucão em rotas/operacoes.ts (D6-12)"
  - "lerOpcoesDeDecisao (D6-01/02/04) e lerOpcoesDeEscopo (G2/G3)"
  - "G1 (legado importado nunca varrido), G2 (escopo por título), G3 (quem a ponte avisa) — com avisadoDaConferencia/avisarId no domínio"
affects: [06-04, 06-05, 06-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Parada por chave = impressaoDeLancamento + Status + último Registro de Status + Conferência vigente e decisão"
    - "Cutucada em processo coalescida (timer único + flag repetir), cancelada por parar()"
    - "Porta de ambiente de teste por variável opcional, vazia em produção, com a linha de partida do log dizendo o escopo"

key-files:
  created:
    - apps/api/src/automacoes/anexos-da-conta.ts
    - apps/api/src/automacoes/anexos-da-conta.test.ts
    - apps/api/src/automacoes/ponte-ativa.ts
    - apps/api/src/automacoes/ponte-ativa.test.ts
    - apps/api/src/automacoes/contrato-contas-a-pagar-ponte.test.ts
    - packages/dominio/src/operations/conferencia-avisar.test.ts
  modified:
    - apps/api/src/automacoes/invocar-agente.ts
    - apps/api/src/automacoes/invocar-agente.test.ts
    - apps/api/src/rotas/operacoes.ts
    - apps/api/src/index.ts
    - apps/api/.env.example
    - apps/api/README.md
    - apps/api/src/automacoes/CONTEXT.md
    - packages/dominio/src/operations/financeiro.ts
    - packages/dominio/CONTEXT.md

key-decisions:
  - "CONFERENCIA_POR_COMENTARIO=false: só o clique APROVA; uma resposta de ajuste no fio continua virando rejeição (06-CONTEXT D6-02: 'o tópico só pede ajuste') — o passo 4 do plano era mais seco; (h) continua valendo"
  - "Na dispensa de D6-04 (sem-conferencia), o Resumo é publicado com o próprio Membro de serviço como aprovador (avisarId: ator) — assim ele pode decidir sem ser Administrador (mayDecideApproval), e ninguém é chamado a conferir o que foi dispensado"
  - "Resumo conferido com Categoria 'ausente' no de-para (código de preenchimento 9.99.99) não vai ao /lancar: comentário pedindo o código no fio"
  - "A parada por impressão virou parada por CHAVE, que inclui a Conferência vigente e a sua decisão — um clique ou resposta no fio destrava a conta sem esperar Campo mudar"
  - "Momento 1 recusado no /resolver usa texto próprio ('Não consegui preparar o Resumo desta conta: …'), não o de lançamento"
  - "pedidoDeRevisao cortado no teto de 500 do contrato; nome de anexo cortado em 200; erro de anexo sem URL ('[url]') antes de ir ao Comentário"
  - "O cutucão da rota passa o par (Espaço, Lista) da Tarefa; quem compara com a Lista da ponte é cutucarPonte (a Lista vem do ambiente, não de CP.listId)"

patterns-established:
  - "processarContas: um laço, sete passos, cada passo uma função da conta; o /lancar só existe no ramo conferida + em lançamento omie + entrou por movimento + modo lancar"

# RES-01..06 ficam Pending: as provas reais são 06-06.
requirements-completed: []
requirements-advanced: [RES-01, RES-02, RES-03, RES-04, RES-06]

# Metrics
duration: ~30min
completed: 2026-09-29
---

# Phase 6 Plan 03: A ponte em dois momentos — Summary

**A ponte publica o Resumo para conferência assim que a conta fica completa, ouve o fio ("ok" confere, qualquer ajuste republica revisado com o pedido e o código citado), e só chama `/lancar` — com o código conferido, a Data de Emissão e os anexos assinados — quando a Conferência está aprovada para os dados atuais e a conta entrou em "em lançamento omie" por movimento; nos modos `ensaio` e `conferencia` o `/lancar` é inalcançável, o legado importado nunca é varrido, e duas portas de teste restringem o escopo e trocam quem é mencionado.**

## Performance

- **Duração:** ~30 min
- **Início:** 2026-09-29T20:18Z (aprox.)
- **Fim:** 2026-09-29T20:46Z
- **Tasks:** 3/3 (+ G1–G3)
- **Arquivos:** 6 criados, 9 modificados

## Realizações

- **Task 1 — `anexosDaConta`.** Campos Anexo/Boleto/QR Code (Valores ativos) e `task.attachments`, em ordem e sem duplicata, como `{ url, nome }`; id sem `WorkspaceFile` e assinatura que falha viram aviso à parte (sem a mensagem da exceção); `assinar` injetável, padrão `urlDeDownload`.
- **Task 2 — `invocar-agente.ts` reescrito.** `processarContas` (alias `lancarContasEmLancamento`) com os sete passos do plano; `resolverModo` com `conferencia`; `lerOpcoesDeDecisao`, `lerOpcoesDeEscopo`, `codigoNoPedido`, `movidaDepoisDaImportacao`; `cutucar()`; `impressaoDaConta` morreu (a chave usa `impressaoDeLancamento`) e `runLancamentoAgent` saiu da ponte.
- **Task 3 — ligar.** `ponte-ativa.ts`; `tarefasAfetadasPelaOperacao` + `cutucarPonte` depois do commit em `rotas/operacoes.ts`; `index.ts` lê as variáveis e registra a ponte; `.env.example` (só acréscimo), README (tabela nova §5b) e `automacoes/CONTEXT.md` (seção "Os dois momentos da ponte (Fase 6)").

## Commits

1. **Task 1** — `618c7c3` feat(06-03): anexos da conta como URLs assinadas com o nome original
2. **Task 2 (+ G1–G3 e a opção de domínio)** — `9bf7918` feat(06-03): a ponte em dois momentos — Resumo para conferência, fio, lançamento só com conferência
3. **Task 3 (+ docs G1–G3)** — `ed79fdd` feat(06-03): ligar a ponte — cutucão na rota, variáveis de decisão e portas de teste

Testes escritos junto com cada implementação, no mesmo commit da Task (como 06-01/06-02); a prova de que mordem está nas mutações.

## Testes

| Arquivo | Casos |
|---|---|
| `apps/api/src/automacoes/invocar-agente.test.ts` (reescrito) | **106/106** |
| `apps/api/src/automacoes/anexos-da-conta.test.ts` (novo) | 5/5 |
| `apps/api/src/automacoes/ponte-ativa.test.ts` (novo) | 13/13 |
| `apps/api/src/automacoes/contrato-contas-a-pagar-ponte.test.ts` (novo) | 11/11 |
| `packages/dominio/src/operations/conferencia-avisar.test.ts` (novo) | 6/6 |
| `packages/dominio` inteiro | **828/828** (822 + 6) |
| `apps/web` inteiro | 216/216 |
| `cd apps/api && DATABASE_URL= npx vitest run src/automacoes/ src/rotas/` | 332 passados · 67 pulados (sem banco) · **5 falhos — ver "Decisão pendente"** |

- `npm run typecheck` (três workspaces): verde. `npm run lint`: 0 erros (4 avisos pré-existentes em `apps/web`). `verificar:tokens`: 0 falhas. `verificar:contratos`: OK.
- **`/lancar` = 0 asserido** em `ensaio` (d: conta em "para pagar"; e conta conferida em "em lançamento omie" com a variável apagada) e em `conferencia` (e, i — inclusive depois de sair e voltar —, G3, e "sem credencial"); e em `lancar` sem Conferência aprovada (k: `sem-resumo`, `pendente`, `desatualizada`).
- Critérios por grep de Task 2: `runLancamentoAgent(` fora de comentário = 0; `impressaoDeLancamento` = 2; `function impressaoDaConta` = 0; o grep de T-3-04 = 0; `"conferencia"` = 7. Task 3: `cutucarPonte` em `operacoes.ts`+`index.ts` = 3; `AGENTE_CONTAS_A_PAGAR_RESUMO_A_PARTIR_DE` em `.env.example`+README+`index.ts` = 3.

## Mutações (desligar a regra faz o teste falhar)

| # | Mutação | Resultado |
|---|---|---|
| A1 | `anexosDaConta` sem deduplicar | 1 falha (a) |
| A2 | `anexosDaConta` lendo Valor arquivado | 1 falha (a) |
| M1 | modo `conferencia` chega ao `/lancar` | 2 falhas (i, G3) |
| M2 | Conferência `pendente` cai no Momento 2 | 7 falhas |
| M3 | G1 desligado | 4 falhas (G1 × 3 modos, nasceu) |
| M4 | G2 desligado | 2 falhas |
| M5 | G3 fora do `comentar()` da ponte | 1 falha |
| M6 | G3 fora do Resumo | 1 falha |
| M7 | G3 fora de `registrarFalhaDoLancamento` | 1 falha |
| M8 | cutucada sem coalescer | 1 falha (q) |
| M9 | cutucada durante ciclo em voo perdida | 1 falha (q) |
| M10 | ensaio grava | 4 falhas |
| M11 | `CONFERENCIA_POR_COMENTARIO` ignorada | 1 falha (h) |
| M12 | `/lancar` sem `codigoCategoriaConfirmado` | 1 falha (j) |
| M13 | sem a guarda do `9.99.99` | 1 falha |
| M14 | sem parada no ensaio do Momento 1 | 1 falha (d) |
| M15 | falha permanente sem `registrarFalhaDoLancamento` | 3 falhas (l, G3) |
| M16 | `pedidoDeRevisao` fora do `/resolver` | 3 falhas (g, r) |
| M17 | anexos fora do `/lancar` | 2 falhas (j, r) |
| D1 | domínio: `publicarResumoParaConferencia` ignora `avisarId` | 3 falhas |
| D2 | domínio: `registrarFalhaDoLancamento` ignora `avisarId` | 1 falha |
| D3 | domínio: `avisarId` aceito sem ser Membro ativo | 2 falhas |
| P1 | `cutucarPonte` sem o filtro do par | 1 falha |
| P2 | `decideProcessApproval` fora das operações que cutucam | 1 falha |

Todas restauradas (M1–M17 por script que regrava o original no `finally`); suítes verdes depois.

## Desvios dirigidos pelo orquestrador (Regra 2 — segurança)

A prova de 06-06 roda a ponte em `conferencia` contra `ws_n1`, onde estão as contas reais importadas do ClickUp e a Maryane real.

**G1 — o legado importado nunca é varrido.** `movidaDepoisDaImportacao(state, task)`: conta com `provenance.kind === "import"` só entra na ponte se o último "Status alterado" for posterior a `provenance.at` (a régua de `entrouPorMovimento`). Senão: zero `/resolver`, zero Comentários, e o ciclo registra só a contagem (`{ contas: n }`, sem dado da conta), quando ela muda. Única exceção, a de sempre: em `lancar`, a importada em "em lançamento omie" recebe uma vez `TEXTO_NASCEU_EM_LANCAMENTO`. **Evidência:** `it.each(["ensaio","conferencia","lancar"])` "G1 (%s) — importada e completa em para pagar: ZERO /resolver, ZERO Comentários, só a contagem no log; movida aqui depois da importação, entra" (3 verdes; M3 derruba os três) e `movidaDepoisDaImportacao` puro (2).

**G2 — `AGENTE_CONTAS_A_PAGAR_SO_TITULOS_COM`.** Substring EXATA (maiúsculas contam), aparada nas pontas; vazia = todas. Filtra os dois momentos e a leitura do fio. Linha de partida: `escopo=todas` ou `escopo=titulos-com:"…"`. **Evidência:** "duas contas completas em para pagar: só a que tem TESTE AUTOMATIZADO no título recebe /resolver e Resumo" e "o Momento 2 também" (M4 derruba os dois).

**G3 — `AGENTE_CONTAS_A_PAGAR_AVISAR_ID`.** Membro ATIVO no ciclo ⇒ toda Menção da ponte vai a ele: o Resumo (Menção, chamada pelo nome e `approverMemberId`), `registrarFalhaDoLancamento` e o `comentar()` da ponte (aviso do modo conferência, pedido de dado, transitórias, recusas). Definida mas não Membro ativo ⇒ um aviso no log, uma vez por processo (sem o id), e a regra de sempre. Domínio: `avisadoDaConferencia(state, ator, avisarId?)`, `OpcoesDaConferencia.avisarId?` e o 5º parâmetro opcional `{ avisarId? }` de `registrarFalhaDoLancamento` — padrões inalterados, nenhum teste existente tocado; `revisoresDoResumo` intacto. **Evidência:** domínio `conferencia-avisar.test.ts` (6: Menção, chamada e aprovador do Membro indicado; revisores inalterados; revisado; não-membro cai na regra; falha); ponte "em conferencia, nenhum Comentário da ponte menciona o Financeiro…" (≥ 3 Comentários da ponte, todos mencionando só `mem_marcos_paulo`, nenhum `mem_maryane`), "em lancar, o aviso de falha também vai ao Membro indicado", "avisarId que não é Membro ativo: aviso uma vez".

Consequência de G3 que o 06-06 precisa saber: com o aprovador trocado, **decide por comentário quem é revisor E pode decidir** (`mayDecideApproval`: o aprovador indicado ou um Administrador/Proprietário). Em `ws_n1` a Maryane é Proprietária, então o "ok" dela no fio decide; o usuário de teste indicado decide por CLIQUE (é o aprovador), mas a resposta dele no fio só conta se ele for Administrador/Proprietário (não é revisor de outro jeito).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Resumo conferido com Categoria `ausente` iria ao Omie com o código `9.99.99`**
- **Found during:** Task 2
- **Issue:** `buildResumoDePagamento` preenche `codigo: "9.99.99"` quando a Categoria não casa no de-para; esse código passa no regex do contrato e iria como `codigoCategoriaConfirmado`.
- **Fix:** `veredito === "ausente"` ou código fora da forma ⇒ nenhuma requisição e `TEXTO_SEM_CODIGO_CONFERIDO` (uma vez). Teste + M13.
- **Commit:** `9bf7918`

**2. [Rule 2 - Correção] Limites do contrato e vazamento de URL**
- `pedidoDeRevisao` cortado em 500 (senão o `/resolver` devolve 400 e vira recusa permanente); nome de anexo cortado em 200; o `erro` de anexo da resposta tem URLs trocadas por `[url]` antes de ir ao Comentário (a URL assinada não pode aparecer na conta). Asserido em (j) e no contrato novo (`not.toContain("assinatura=")`).
- **Commit:** `618c7c3`, `9bf7918`

**3. [Rule 2 - Correção] Dispensa de D6-04 que falharia em `ws_n1`**
- **Issue:** o plano pedia `decideProcessApproval(aprovada, click)` em nome do Membro de serviço; com o Financeiro como aprovador, `mayDecideApproval` recusa quem não é aprovador nem Administrador — o Membro "Agente do pipeline" não é.
- **Fix:** na dispensa, o Resumo sai com `avisarId: ator` (o próprio Membro de serviço é o aprovador e o mencionado); publicação e dispensa numa operação só (tudo ou nada no `executar()` real). A Atividade "Aprovação decidida" leva `por clique — Conferência dispensada (Integração manual)` (o motivo da decisão); não há Registro com a ação literal "Conferência dispensada…" — a ponte não escreve Atividade à mão.
- **Commit:** `9bf7918`

**4. [Interpretação] `CONFERENCIA_POR_COMENTARIO=false`**
- O passo 4 do plano só lê o fio quando a variável é `true`; `06-CONTEXT` D6-02 diz "false (só o clique decide; o tópico só pede ajuste)". Segui o CONTEXT: com `false`, aprovação no fio é ignorada e ajuste continua virando rejeição. (h) do plano ("ok" ⇒ nada) continua verde; caso a mais provando o ajuste.

**5. [Detalhe] Parada por CHAVE em vez de só impressão**
- A chave inclui a Conferência vigente e a sua decisão: sem isso, um clique "Conferido" numa conta parada (ex.: aviso do modo conferência) não seria visto até um Campo mudar.

**6. [Detalhe] (g) "a Conferência anterior foi cancelada"**
- A anterior fica `rejeitada` (a decisão não é sobrescrita); `solicitarConferenciaDoResumo` só cancela PENDENTES. O teste assere o comportamento real: a anterior `rejeitada`, uma nova `pendente` vigente, mesma impressão.

**7. [Detalhe] Arquivos fora de `files_modified`**
- Novos: `ponte-ativa.test.ts`, `contrato-contas-a-pagar-ponte.test.ts`, `packages/dominio/src/operations/conferencia-avisar.test.ts`. Modificados: `packages/dominio/src/operations/financeiro.ts` e `packages/dominio/CONTEXT.md` (G3, dirigido pelo orquestrador).

**8. [Detalhe] O cutucão da rota não tem teste de ponta a ponta sem banco**
- `rotas/operacoes.ts` só roda com `executar()` real. Provado: o helper `tarefasAfetadasPelaOperacao` (puro, 9 casos + P2), `cutucarPonte` (4 + P1) e o typecheck. A cutucada real (≤ 2 s depois de uma gravação) é item de 06-06.

### `invocar-agente.test.ts` — casos reescritos (exceção a CON-05 do plano)

Mantidos byte a byte: `resolverModo` (it.each original), `chaveDeIdempotencia`, `classificar`, `motivoDoEnvelope`, prazos padrão, `lerCnpjPorEmpresa`, `entrouPorMovimento` (5) e `rodarAgenda` (3). Helpers de fixture ajustados: `prepararEmLancamento` isola também "para pagar" (senão o Momento 1 publicaria em toda conta completa do seed) e `dePara200` ganhou `as const` (só tipo). O ator dos testes passou de `mem_maryane` para `mem_thiago` (Proprietário), para a regra "menciona o Financeiro, não quem assina" ser provada de verdade.

| Caso antigo | Destino | Por quê |
|---|---|---|
| ensaio: só /resolver, "lançaria", sem repetir | (d) "Ensaio — publicaria", conta em "para pagar" | ensaio agora ensaia o Momento 1 |
| ensaio: MODO apagada ⇒ zero /lancar | mesma asserção, com a conta CONFERIDA em "em lançamento omie" | é o único estado em que /lancar poderia sair |
| ensaio: falta dado só registra | mantido (fixture `isolar`) | o seed tem outras contas completas em "para pagar" |
| "para pagar" não gera requisição (sem aquecer) | invertido por desenho: (e) e (p) | D6-01 — o Resumo aparece em "para pagar"; `em-lancamento-omie` devolve o silêncio |
| resolvida: /resolver + /lancar, Resumo e "lançado omie" | (j) | /lancar só depois da Conferência; corpo com código, emissão e anexos |
| categoria em revisão: só /resolver, comenta, não pergunta de novo | "(e) categoria em revisão também publica" | o domínio publica `revisar`; quem decide é o Financeiro no fio |
| sai de "em lançamento omie" durante o /lancar | mantido, texto `TEXTO_SAIU_ANTES_DO_REGISTRO` | registro no lugar de Resumo |
| categoria em revisão sem nada escrito (Resumo antigo) | **removido** | dependia de `runLancamentoAgent`, que saiu da ponte |
| payableId mock | (n) | + zero "Lançado no Omie" |
| falta Nome do fornecedor / D3-01 sem Centro | mantidos | + caso novo: em "para pagar", silêncio |
| Integração manual | (o) `nao-encosta` nos dois Status + `sem-conferencia` | D6-04 |
| 422 com details.motivo, até um Campo mudar | (l) | D6-03: volta a "para pagar"; mover de novo reprocessa |
| recusa permanente já no /resolver; sair e voltar reprocessa | "Momento 1 — recusa permanente…" (os dois juntos) | recusa do Resumo, texto próprio |
| sem details.motivo / sem nada | (l) segundo caso | texto canônico `TEXTOS_DA_CONFERENCIA.falha` |
| publicação recusada depois do lançamento | "o registro recusado depois do lançamento confirmado" | `registrarLancamentoNoOmie` no lugar de `runLancamentoAgent` |
| 3ª transitória; duas falhas e sucesso | Momento 1 (/resolver 503 ×3) e (m) (/lancar timeout ×3; duas e sucesso) | os dois momentos |
| /lancar lento dentro/além do prazo | "prazos: …" (um caso, dois cenários) | /lancar só com Conferência |
| /resolver que não responde | mantido, no Momento 1 | — |
| nasceu: importada em "em lançamento omie" | mantido; depois do vaivém, Resumo (não lançamento) | o lançamento exige Conferência |
| posta no Status sem Registro | exige a conta conferida | o pedido de vaivém é do Momento 2 |
| T-3-04 | (r), estendido (Resumo, URL assinada, pedido) | — |
| lancar sem credencial | + `conferencia` | os dois modos gravam |
| `parar()` espera o ciclo | mantido, log "Ensaio — publicaria" | — |

## Decisão pendente (bloqueia `npm run check` verde)

**5 casos de `apps/api/src/automacoes/contrato-contas-a-pagar.test.ts` (arquivo de 06-02 e pós-auditoria 1.6) provam o fluxo de ANTES da Fase 6** — §"contrato — a ponte de ponta a ponta com as respostas canônicas": `resolver.sucesso-resolvida + lancar.sucesso` e `+ lancar.sucesso-reaproveitado` (lançar e ir a "lançado omie" sem Conferência) e os três `lancar.erro-422-*` ("a conta fica" em "em lançamento omie"). Com a regra deste plano ("sem Conferência aprovada, ZERO `/lancar`"; D6-03 volta a conta), eles falham por desenho. O plano só abriu a exceção a CON-05 para `invocar-agente.test.ts` e a regra da rodada proíbe editar outro teste existente — **não editei**. O mesmo papel está coberto, no fluxo novo, pelo arquivo novo `contrato-contas-a-pagar-ponte.test.ts` (11 verdes, com os mesmos exemplos canônicos e mais `lancar.erro-422-regra-de-dominio`, `resolver.sucesso-pedido-de-revisao` e `lancar.sucesso-anexos-nomeados`). O `erro-500` do arquivo antigo continua verde (por acaso: a resposta vai para outra conta do seed).

**Pedido ao orquestrador/dono:** estender a exceção a CON-05 a esse `describe` — remover os 5 casos (cobertos pelo arquivo novo) ou reescrevê-los como no arquivo novo. Até lá, `npm run check` fica vermelho nesses 5.

## Verificação bloqueada

Nenhum comando recusado pelo classificador. Não rodados de propósito: `npm run check` inteiro (inclui a suíte inteira de `apps/api`, que estoura o watchdog) — no lugar, typecheck dos três workspaces, lint, tokens, contratos, `packages/dominio` e `apps/web` inteiros e `apps/api` por pasta (`src/automacoes/`, `src/rotas/`) sem `DATABASE_URL`. Nenhum servidor da API subiu.

## Requisitos

RES-01, RES-02, RES-03, RES-04 e RES-06 **avançados, não completos**: as provas reais (a ponte em `conferencia` contra `ws_n1` com G2/G3, o anexo no Omie real) são o checkpoint 06-06.

## Known Stubs

Nenhum.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: signed-url-in-request | apps/api/src/automacoes/anexos-da-conta.ts | URLs assinadas (5 min) de arquivos privados saem no corpo do `/lancar` para o `automation/`; nunca vão a log nem a Comentário (T-3-04, asserido em (r) e no contrato novo). |
| threat_flag: test-env-override | apps/api/src/index.ts | `AGENTE_CONTAS_A_PAGAR_AVISAR_ID`/`SO_TITULOS_COM` mudam quem é mencionado/aprovador e o escopo — só para teste; a linha de partida do log denuncia quando estão ligadas. |

## Next Phase Readiness

- **06-04 (tela):** a ponte reage à decisão por clique em ≤ 2 s (cutucão em `decideProcessApproval`); o aviso do modo conferência é resposta no fio do Resumo.
- **06-06 (prova):** subir a ponte com `AGENTE_CONTAS_A_PAGAR_MODO=conferencia`, `AGENTE_CONTAS_A_PAGAR_SO_TITULOS_COM="TESTE AUTOMATIZADO"` e `AGENTE_CONTAS_A_PAGAR_AVISAR_ID=<usuário de teste>`; conferir na linha de partida `modo=conferencia … escopo=titulos-com:"TESTE AUTOMATIZADO" avisar=membro-indicado`. O "ok" no fio decide se vier da Maryane (Proprietária) ou de outro Administrador; o usuário de teste decide por clique.
