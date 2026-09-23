---
phase: 03-contas-a-pagar
plan: 06
subsystem: domain
tags: [contas-a-pagar, solicitacao-de-pagamento, conversao, vinculo, provenance, automacoes, d3-08]

# Dependency graph
requires:
  - phase: 02-solicitacoes
    provides: "`CATALOGO_SOLICITACAO_DE_PAGAMENTO` (os 4 Status e os 25 Campos) e `evoluirConfiguracaoDeSolicitacoes`, que materializa a Lista de origem"
  - phase: 03-contas-a-pagar
    provides: "03-09 fixou o molde de operação nova em módulo próprio (`antes`/`desfazer`, `runAutomations: false`, barreira sobre `provenance`); 03-05 tornou DERIVADA a visibilidade da Pessoa da conta, que é o que faz A9 alcançá-la aqui"
provides:
  - "`converterSolicitacaoEmContaAPagar(state, actingMemberId, solicitacaoId)` — registrada em `OPERACOES`, alcançável por `POST /operacoes/converterSolicitacaoEmContaAPagar`"
  - "`contaAPagarDeSolicitacao(state, solicitacaoId)` — a barreira de T-3-11 e a leitura “qual conta veio daqui”"
  - "`DE_PARA_DE_CAMPOS` — os 21 pares, travados contra os 25 Campos da origem por teste"
  - "`CAMPOS_SEM_EQUIVALENTE`, `CAMPO_DE_VENCIMENTO_DA_SOLICITACAO`, `CAMPOS_DE_ARQUIVO`, `PAPEL_DO_VINCULO`"
  - "`CategoriaDeLacunaDeConversao` — `opcao_sem_equivalente` | `campo_sem_equivalente` | `vencimento_ausente` | `tag_conta_ausente`"
  - "convenções de valor: `provenance.kind = \"task\"` para Conta gerada por conversão; `Link` `task→task` com `role: \"conta a pagar gerada\"`; Registros `Conta a pagar criada por conversão` / `Convertida em Conta a pagar` / `Lacuna de conversão`"
  - "`LISTA_ID` exportada de `solicitacao-de-pagamento-evolver.ts` (uma palavra)"
affects: [03-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gatilho de Automação ADIADO, não desligado: `createTask(..., { runAutomations: false })` + `runListAutomations({ kind: \"tarefaCriada\" })` à mão no fim — o espelho invertido do replay mudo de 03-09"
    - "Fronteira lacuna × rollback: pré-conferir `options` do Campo destino ANTES de `setTaskFieldValue`; o que a Lista não REPRESENTA é lacuna, qualquer outra recusa é rollback"
    - "Cópia de Campo de arquivo entre Listas: empurrar os ids de `WorkspaceFile` direto em `task.fieldValues` (molde de `submitForm`), nunca reenviar ao Storage"
    - "Verificação por mutação como parte do trabalho, não como zelo: três mutações, três casos derrubados"

key-files:
  created:
    - packages/dominio/src/operations/conversao-de-solicitacao.ts
    - packages/dominio/src/operations/conversao-de-solicitacao.test.ts
  modified:
    - packages/dominio/src/solicitacao-de-pagamento-evolver.ts
    - packages/dominio/src/operations/registro.ts
    - packages/dominio/src/operations/index.ts
    - apps/api/src/rotas/esquemas/financeiro.ts
    - packages/dominio/CONTEXT.md
    - apps/api/src/rotas/esquemas-de-argumentos.test.ts

key-decisions:
  - "`convertida` não vira quinto Status: a premissa da pesquisa estava errada (o catálogo nunca o teve), e o que D-14 prometeu à Fase 3 foi a Conta a pagar E o Vínculo estruturado — que é o que nasceu"
  - "A barreira de dupla conversão NÃO filtra `lifecycle`: a Conta na lixeira continua barrando, porque o risco é pagamento em dobro, não Tarefa faltando"
  - "A guarda de idempotência roda antes de `createTask`, para que uma conversão recusada não queime um identificador legível de conta"
  - "A Forma de pagamento que o destino não enumera vira lacuna e a conta nasce; sem isso o Financeiro voltaria ao ClickUp pelo caso exato que o critério 1 quer eliminar"
  - "O caso (f) afirma UMA Execução de A9, não só a presença da Pessoa: com o gatilho ligado na criação a Pessoa entraria assim mesmo, pela segunda volta — a contagem é o que distingue desenho de acidente"

patterns-established:
  - "Asserção de não-vazamento com recorte temporal: comparar só os Registros que a operação produziu (`activity.slice(0, novos)`), não o `state.activity` inteiro, quando a fixture legitimamente carrega o valor"

requirements-completed: [PAG-01]

# Metrics
duration: 27min
completed: 2026-09-23
---

# Phase 03 Plan 06: A Solicitação aprovada vira Conta a pagar sem sair da plataforma

**`converterSolicitacaoEmContaAPagar` cria a Conta na Lista de Contas a pagar a partir da Solicitação — 21 Campos atravessando dois catálogos, o vencimento só no `dueDate` nativo, o anexo por referência e A9 acordando UMA vez sobre uma Tarefa já completa — sem ClickUp, sem rede e sem inventar um quinto Status.**

## Performance

- **Duration:** ~27 min
- **Started:** 2026-09-23T13:32Z
- **Completed:** 2026-09-23T13:59Z
- **Tasks:** 3 (4 commits — a Task 1 foi TDD, RED e GREEN separados)
- **Files modified:** 8 (2 criados, 6 modificados)

## Accomplishments

- **A metade do critério 1 que faltava.** PAG-01/03-09 resolveu o histórico; esta operação resolve o fluxo dali para frente. Com a Lista ClickUp `901107637383` arquivada, uma Solicitação aprovada agora vira conta dentro do CRM, por um gesto do Financeiro.
- **O de-para dos 25 Campos está travado por aritmética, não por convenção.** `DE_PARA_DE_CAMPOS.length + CAMPOS_SEM_EQUIVALENTE.length + 1 === CATALOGO_SOLICITACAO_DE_PAGAMENTO.campos.length`, mais a conferência de que os 25 ids da origem são exatamente pares ∪ órfãos ∪ vencimento. Um 26º Campo na Solicitação quebra o teste em vez de sumir na conversão.
- **O gatilho é adiado, e há prova disso.** O caso (f) afirma `1` Execução de A9 sobre a Conta. Com `runAutomations: true` na criação a contagem vira `2` e o teste cai — a primeira volta correria antes do Campo Pessoa existir, e a Pessoa entraria como Observadora por acidente da segunda.
- **A fronteira que decide tudo está em código e em comentário.** Valor que a Lista destino não REPRESENTA é lacuna (a conta nasce, RN-CP-02 a segura em `para pagar`); Campo arquivado, Campo fora da Lista e afins são rollback com as quatro contagens de volta ao que eram. Os casos (k) e (m) existem em par para travar os dois lados.
- **Nenhum valor sensível na trilha.** Toda recusa cita `definitionId`; toda lacuna cita o NOME do Campo. O caso (k) afirma que nenhum Registro produzido pela conversão contém o valor irrepresentável; o (l), que nem a URL nem o Produto aparecem.
- **`convertida` foi resolvido sem inventar Status.** A premissa da pesquisa (Open Question #1) estava errada e a Task 1 começou conferindo-a: o catálogo nunca teve o quinto Status. O que marca a conversão é o par que D-14 prometeu — a Conta e o Vínculo `task→task` — mais `provenance.kind = "task"`.

## Task Commits

1. **Task 1 (RED): os casos (a)…(h) antes da operação existir** — `f9cb29c` (test)
2. **Task 1 (GREEN): `conversao-de-solicitacao.ts` + `export` em `LISTA_ID`** — `53969ef` (feat)
3. **Task 2: as bordas (i)…(q) — dupla conversão, lacunas, guardas e rollback** — `229e524` (test)
4. **Task 3: `OPERACOES`, o barril, o schema de transporte e a decisão em `CONTEXT.md`** — `ba4e9b0` (feat)

**Plan metadata:** o commit `docs(03-06): …` (SUMMARY + STATE + ROADMAP + REQUIREMENTS), logo depois destes quatro.

## Files Created/Modified

- `packages/dominio/src/operations/conversao-de-solicitacao.ts` *(criado, 388 linhas)* — cabeçalho de intenção (o que morre com o critério 1, por que não é quinto Status, por que é o espelho invertido da importação, por que está em `OPERACOES`, por que arquivo próprio e não `financeiro.ts`), as cinco constantes do de-para, o vocabulário de lacunas, `contaAPagarDeSolicitacao` e a operação em 12 passos
- `packages/dominio/src/operations/conversao-de-solicitacao.test.ts` *(criado, 17 casos)* — (a) a premissa conferida, (b) o fechamento dos 25, (c) a conversão feliz, (d) o vencimento nativo, (e) o anexo por referência, (f) A9, (g) a Tag por nome, (h) o Vínculo e a trilha, (i) a dupla conversão, (j) a lixeira, (k) a lacuna de opção, (l) as três lacunas de Campo órfão, (m) o rollback, (n) as guardas de origem, (o) a guarda de alcance, (p) o vencimento ausente, (q) o Vínculo nos dois sentidos
- `packages/dominio/src/solicitacao-de-pagamento-evolver.ts` — **uma palavra**: `export` em `LISTA_ID` (`git diff --numstat` = `1 1`)
- `packages/dominio/src/operations/registro.ts` — bloco de import próprio + a entrada em `OPERACOES`; `contaAPagarDeSolicitacao` fica de fora, por ser leitura
- `packages/dominio/src/operations/index.ts` — `export * from "./conversao-de-solicitacao"` + a linha `instrumentar`
- `apps/api/src/rotas/esquemas/financeiro.ts` — `converterSolicitacaoEmContaAPagar: z.tuple([ID])` e o cabeçalho atualizado (2 → 3 operações)
- `packages/dominio/CONTEXT.md` — seção `## Solicitação aprovada → Conta a pagar: conversão, não quinto Status (D3-08)`, no fim do arquivo; as seções de 03-04, 03-09 e 03-03 ficaram intactas
- `apps/api/src/rotas/esquemas-de-argumentos.test.ts` — o contador de operações registradas, `200 → 201` (ver Desvios)

## Decisions Made

- **`convertida` deixa de ser erro como CONVERSÃO, não como quinto Status.** A Task 1 começou conferindo a premissa da pesquisa, como o plano mandou: `CATALOGO_SOLICITACAO_DE_PAGAMENTO.statusSet.definitions` tem quatro Definições e `convertida` só aparece em comentário. O caso (a) afirma isso em código, dos dois lados — o catálogo e a Lista materializada — para que o plano fique provado de não ter acrescentado nada.
- **A barreira de T-3-11 não filtra `lifecycle`.** Mesma escolha de `jaImportada`. O caso (j) manda a Conta para a lixeira e tenta converter de novo: continua recusado. Dinheiro em dobro é pior que uma conta apagada por engano.
- **A guarda de idempotência vem antes de `antes`/`desfazer` e de `createTask`.** O caso (i) confere `taskReadableId.next` inalterado entre a primeira conversão e a segunda recusa: uma operação que falhou não queima um número de conta.
- **Lacuna de opção é pré-conferida, não capturada da recusa.** Ler `options` do Campo destino antes de chamar `setTaskFieldValue` é o que separa "a Lista não representa este valor" de "esta escrita foi recusada de verdade". Capturar a mensagem de erro para decidir seria acoplar a conversão ao texto de outra função.
- **A Tag é resolvida por NOME, com desempate.** Procura em `state.tags` uma Tag ativa de mesmo nome que não seja a da origem (a do catálogo de Contas a pagar); se o Espaço de Trabalho só tiver uma com esse nome, ela serve aos dois lados. Nenhum id literal `tag_cp_*` entra no código.
- **O `at` de todo Registro e do Vínculo é um único `new Date()` por chamada.** A conversão acontece agora — ao contrário da importação histórica, aqui o relógio da operação é o dado correto.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] O contador de operações registradas de `apps/api` fixa o total em literal**

- **Encontrado em:** Task 3, na primeira rodada completa da suíte do `apps/api`
- **Problema:** `apps/api/src/rotas/esquemas-de-argumentos.test.ts:107` asserta `expect(chaves.length).toBe(200)`. A operação nova é a 201ª em `OPERACOES`, e a suíte caiu (`1 failed | 379 passed`). O plano não previu isso: 03-09, o precedente que ele espelha, registrou a operação **fora** de `OPERACOES`, então nunca tocou este contador.
- **Correção:** `200 → 201` nas duas ocorrências (o título do caso (h) e a asserção do caso (j)), com a conta do comentário estendida para citar `converterSolicitacaoEmContaAPagar` (Plan 03-06, D3-08). A asserção que de fato importa — `chaves.sort()` igual a `Object.keys(OPERACOES).sort()` — não foi tocada: continua sendo ela quem prova que `ESQUEMAS` cobre exatamente o registro.
- **Por que é correção e não escopo novo:** esse contador existe para flagrar operação nova sem schema. Ele fez o trabalho dele; deixá-lo em 200 seria deixar o portão vermelho.
- **Arquivo:** `apps/api/src/rotas/esquemas-de-argumentos.test.ts` (8º arquivo, além dos sete de `files_modified`)
- **Commit:** `ba4e9b0`

### Ajustes de precisão, sem mudança de escopo

- **O caso (k) recorta a trilha em vez de varrer `state.activity` inteiro.** O critério do plano pedia `JSON.stringify(state.activity)` sem o valor irrepresentável. Isso não é alcançável e não deveria ser: a própria fixture preenche o Campo na Solicitação por `setTaskFieldValue`, que registra `Forma de pagamento alterado` com o valor — legitimamente, porque é ali que o valor mora. O teste afirma o que o contrato de D-25 realmente diz: **nenhum Registro produzido pela conversão** carrega o valor. O recorte é `s.activity.slice(0, s.activity.length - antesDaConversao)`, e o caso afirma antes que esse recorte não está vazio, para a asserção não passar por omissão.
- **O caso (f) ganhou uma asserção que o plano não pedia, porque sem ela não mordia.** Ver "Issues Encountered".
- **Os casos vão até `(q)`, não até `(p)`.** O smoke test do Vínculo nos dois sentidos, que a Task 2 pediu "no fim do arquivo de teste", virou caso próprio rotulado em vez de apêndice de outro.
- **A guarda de ciclo de vida usa `effectiveLifecycleOfTask`, não `solicitacao.lifecycle`.** Cobre também a Solicitação cuja Lista foi arquivada — é o predicado que o resto do domínio usa.

## Issues Encountered

- **Verde de primeira, três vezes — e uma das provas não mordia.** Os 8 casos da Task 1 e os 9 da Task 2 passaram na primeira execução. Verificação por mutação em cada afirmação central:

  | Mutação | Resultado esperado | O que aconteceu |
  |---|---|---|
  | `runAutomations: false` → `true` | (f) cai | **(f) PASSOU** — prova vazia |
  | pré-conferência de `options` desligada | (k) cai | (k) caiu: `“…” não é uma opção de Forma de pagamento` |
  | barreira filtrando `lifecycle === "ativo"` | (j) cai | (j) caiu |
  | guarda de idempotência movida para depois de `createTask` | (i) cai | (i) caiu (`expected 3 to be 2`) |

  A primeira mutação expôs um buraco real no caso (f): com o gatilho ligado na criação, A9 roda **duas** vezes, e a segunda volta (a manual, no fim) adiciona a Pessoa assim mesmo. A asserção original — "a Pessoa está entre os Observadores" — não distinguia desenho de acidente. Corrigido acrescentando `expect(deA9).toHaveLength(1)`, que filtra as Execuções de `aut_cp_a9` sobre a Conta. Com a asserção nova, a mutação derruba o caso (`expected [...] to have a length of 1 but got 2`). O arquivo de implementação foi restaurado byte a byte antes de cada commit (`git diff --quiet`).

- **O bootstrap de produção tem um Membro só.** `buildGestaoBootstrap` traz a Maryane; o Aprovador e os demais são fixture do seed (`opcoes.fixtures`). O caso (f) precisa dos três Observadores e o caso (o) precisa de alguém que alcance Contas a pagar sem alcançar Solicitações. Os dois entram como fixture do arquivo de teste, com a mesma concessão que o seed daria ao Aprovador (`editar` na Lista, e só nela) — o que também é o que torna o caso (o) honesto: `listWriteRefusal` o deixaria criar a Tarefa de destino, e o que o barra é `memberSeesTask` sobre a origem.

- **`npm run check` monolítico continua estourando o teto de 600 s da ferramenta.** Decomposto por workspace, como 03-03, 03-04 e 03-09 fizeram. A suíte do `apps/api` sozinha levou 480 s e 562 s nas duas rodadas, em segundo plano.

## Verificação do portão (CON-05)

`npm run check` decomposto, tudo verde, sem `DATABASE_URL` no ambiente:

| Etapa | Resultado |
|---|---|
| `typecheck` @n1/dominio | 0 |
| `typecheck` @n1/api | 0 |
| `typecheck` @n1/web | 0 |
| `lint` (eslint) | 0 |
| `verificar:tokens` | ✓ 392 definidos · 211 arquivos · 0 falhas |
| `test` @n1/dominio | **447 passed** (430 antes + os 17 novos) |
| `test` @n1/web | 107 passed |
| `test` @n1/api | **380 passed, 12 skipped** — `env -u DATABASE_URL`, 562 s |

Critérios de `grep` do plano, todos satisfeitos:

| Critério | Esperado | Resultado |
|---|---|---|
| `"convertida"` em `solicitacao-de-pagamento.ts` | 0 | 0 |
| `fetch(` / `process.env` / `require(` / `node:` fora de comentário | 0 | 0 |
| `changeTaskStatus` fora de comentário | 0 | 0 |
| `fd_cp_` literal no arquivo novo | 0 | 0 |
| padrão de CPF/CNPJ no arquivo de teste | 0 | 0 |
| `opcao_sem_equivalente` no arquivo novo | ≥ 1 | 2 |
| literal `Cartão` no código | 0 | 0 |
| `converterSolicitacaoEmContaAPagar` em `registro.ts` | 2 | 2 |
| `instrumentar("converterSolicitacaoEmContaAPagar")` em `index.ts` | 1 | 1 |
| `conversao-de-solicitacao` em `index.ts` | 2 | 2 |
| `converterSolicitacaoEmContaAPagar` em `esquemas/financeiro.ts` | 1 | 1 |
| `git diff --numstat` do evolver | `1 1` | `1 1` |
| `git diff --quiet` dos 4 testes preexistentes do domínio | 0 | 0 |
| `CONTEXT.md` contém as três strings exigidas | sim | sim |

**O portão de schema é real, não decorativo:** removida a entrada `converterSolicitacaoEmContaAPagar: z.tuple([ID])`, `npm run typecheck --workspace=@n1/api` falha em `esquemas-de-argumentos.ts:109` com `TS1360: … does not satisfy the expected type 'EsquemasCompletos'`. Restaurada, compila.

`apps/web` sem uma linha de diff nesta rodada. `../financeiro-tria/automation` está fora deste repositório e não foi tocado.

**Arquivos alterados no plano:** os sete de `files_modified` mais `apps/api/src/rotas/esquemas-de-argumentos.test.ts` (ver Desvios). Nenhum outro `*.test.ts` preexistente foi editado. `.planning/config.json` aparece modificado no working tree desde antes deste plano — é da sessão do orquestrador e foi deliberadamente não tocado e não commitado.

## Threat Flags

Nenhuma superfície nova fora do `<threat_model>` do plano. A operação **abre um endpoint** (`POST /operacoes/converterSolicitacaoEmContaAPagar`), mas isso é o entregável declarado, com a forma de transporte fechada por `z.tuple([ID])` e a autorização inteiramente no domínio: `memberSeesTask` sobre a origem mais `listWriteRefusal` no destino. Nenhuma Grant é criada, nenhum esquema de banco muda, nenhum disco é lido.

`T-3-11` (caso i, j), `T-3-12` (caso o), `T-3-13` (casos h, q) e `T-3-14` (casos b, k, l) estão mitigadas e cada uma tem caso de teste nomeado. `T-3-12b` é afirmada em (k), (l) e (m) — a recusa de rollback cita `fd_cp_cnpj` e o teste afirma que ela **não** contém o valor. `T-3-SC`: nada foi instalado.

## What's Next

- **O gatilho automático continua fora de escopo, e agora é a única peça que falta.** Converter sozinho quando a Solicitação entra em `aprovado` mora em `operations/tasks.ts` (na operação de mudar Status) ou num tipo de ação novo de Automação (`automations.ts` + `types/ai.ts`) — posse de arquivo da onda, não dificuldade. Com a operação registrada, o critério 1 já fecha; automatizar o gesto é continuação, e é o que o orquestrador precisa alocar.
- **O gesto na tela** (`apps/web`, a tela da Solicitação ganhar o botão) é outro território. A operação está instrumentada no barril, então a chamada da interface já viaja para o servidor quando existir.
- **Ponta solta declarada:** a Conta nascida da conversão entra em `para pagar` e é alvo legítimo de A5/A6/A7 na volta seguinte do agendador (03-08), como qualquer conta viva. Isso é o comportamento desejado aqui — ao contrário da importação histórica, onde não era.
- **Decisão adiada, com o preço na mesa:** se o dono do produto quiser mesmo a coluna `convertida` visível na Lista de Solicitações, os três custos estão escritos em `packages/dominio/CONTEXT.md`. É mudança de contrato versionado (`PaymentRequestDtoV1`), território de 03-07.

## Known Stubs

Nenhum. A operação está completa, registrada e alcançável por HTTP. O que não foi feito — o gatilho automático e o botão na tela — está declarado como fora de escopo pelo próprio plano, com o motivo (posse de arquivo dentro da onda), não escondido atrás de um valor vazio.

## Self-Check: PASSED

Os dois arquivos criados existem em disco; os quatro commits (`f9cb29c`, `53969ef`, `229e524`, `ba4e9b0`) existem no histórico.
