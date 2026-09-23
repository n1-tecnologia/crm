---
phase: 03-contas-a-pagar
plan: 05
subsystem: auth
tags: [permissoes, visibilidade-derivada, campo-person, seed, vitest, dominio]

# Dependency graph
requires:
  - phase: 03-02
    provides: "o motor de Automações com vocabulário fechado — lido para descartar a Opção B (não há evento de Campo alterado), não modificado aqui"
  - phase: 01
    provides: "guestFieldWriter/taskWriteRefusal já aplicando PAG-06 no enforcement; faltava a concessão"
provides:
  - "List.sharedWithDefinitionIds — a Lista declara, como dado, quais Campos `person` nomeiam quem enxerga a Tarefa"
  - "memberNamedOnTask(state, memberId, task) exportada de derive.ts, com guarda obrigatória de type === \"person\""
  - "ramo novo em memberSeesTask, entre a Grant da Tarefa-raiz e memberReachesContainer"
  - "seed sem as Grants gr_cp_pessoa_1..3 e gr_cp_pessoa_joao — a visibilidade da Pessoa da conta é calculada, nunca guardada"
  - "tsk_cp_konq com valor no Campo Pessoa (mem_joao_konq), fechando a divergência entre as duas fontes de verdade"
  - "pessoa-da-conta.test.ts — 12 casos, o item Wave 0 de PAG-06"
affects: [03-15, 03-11, 03-07, 03-14]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Visibilidade derivada de Valor de Campo: a regra é dado na Lista, o mecanismo é código em derive.ts — nenhum `if` do Financeiro dentro da camada genérica"
    - "Guarda de tipo como fronteira de confiança: só Campo `person` abre Tarefa; texto coincidente não eleva privilégio"

key-files:
  created:
    - packages/dominio/src/operations/pessoa-da-conta.test.ts
  modified:
    - packages/dominio/src/types/structure.ts
    - packages/dominio/src/derive.ts
    - packages/dominio/src/seed-financeiro.ts

key-decisions:
  - "Task 1 (checkpoint bloqueante) resolvida como option-a — derivar memberSeesTask do valor do Campo Pessoa — por auto-seleção da opção recomendada sob modo autônomo, em 2026-09-23"
  - "A regra nasce ligada e provada na mesma task que a cria: sharedWithDefinitionIds nunca existiu como metadado morto"
  - "03-VALIDATION.md mapeava PAG-06 a `npm run test --workspace=@n1/dominio -- tasks`; o comando real é `-- pessoa-da-conta`"

patterns-established:
  - "Declaração na Lista ao lado de guestEditableDefinitionIds: uma chave diz QUEM é o Convidado, a outra diz O QUE ele edita"
  - "O caso negativo como critério de aceite de primeira classe: provado nos dois sentidos, com duas Pessoas reais"

requirements-completed: [PAG-06]

# Metrics
duration: 38min
completed: 2026-09-23
---

# Phase 3 Plan 05: A Pessoa da conta enxerga por ser a Pessoa da conta — Summary

**`List.sharedWithDefinitionIds` + `memberNamedOnTask` derivam a visibilidade da Tarefa do valor do Campo Pessoa, com guarda de tipo `person`, e as quatro Grants `gr_cp_pessoa_*` do seed foram apagadas — não há mais concessão a criar nem revogação a esquecer.**

## Performance

- **Duration:** 38 min
- **Started:** 2026-09-23T12:56:00Z
- **Completed:** 2026-09-23T13:34:00Z
- **Tasks:** 3 (Task 1 = checkpoint de decisão, auto-resolvido; Tasks 2 e 3 executadas)
- **Files modified:** 4 (1 criado, 3 alterados)

## Accomplishments

- **A visibilidade passou de dado gravado a leitura derivada.** `memberSeesTask` ganhou um ramo — `memberNamedOnTask` — entre a checagem de Grant da Tarefa-raiz e `memberReachesContainer`. A ordem importa e foi respeitada: quem já respondia por Grant continua respondendo por Grant; a derivação só transforma em `true` o caso que hoje caía no contêiner e devolvia `false`. Nenhuma resposta já verdadeira mudou.
- **A regra é dado, não um `if` do Financeiro.** `List.sharedWithDefinitionIds?: readonly Id[]` nasceu vizinha de `guestEditableDefinitionIds`. `derive.ts` não menciona Financeiro, Conta a pagar nem `F.pessoa`; qualquer Lista adere declarando um Campo. E `derive.ts` continua sem importar nada de `operations/` — o estilo de leitura do Campo `person` de `fieldValueOf` foi copiado, não importado.
- **A guarda de tipo é código, não comentário (T-3-11).** `memberNamedOnTask` exige `fieldDefinition.type === "person"` antes de comparar qualquer valor. O teste monta a tentativa de elevação à mão: declara `F.nomeFornecedor` (tipo `text`) em `sharedWithDefinitionIds`, escreve `"mem_thiago_pereira"` dentro dele, e a Tarefa continua fechada.
- **As duas fontes de verdade deixaram de coexistir.** As quatro Grants `gr_cp_pessoa_*` saíram do seed (`grep -c 'gr_cp_pessoa'` devolve `0`) e `tsk_cp_konq` ganhou `val(F.pessoa, "mem_joao_konq")` — o que o Comentário `cmt_cp_5` já cobrava em prosa virou dado. Nenhum teste anterior mudou de resultado por causa disso, então a regra determinística de reversão da Task 2 não precisou ser acionada.
- **Os três momentos que a Grant estática nunca cobriu passaram a ser provados:** Campo preenchido depois da criação, a ocorrência que A1 faz nascer ao pagar, e a troca de fornecedor. O caso (b) é o mais instrutivo: antes deste plano a Pessoa era **Observadora de uma Tarefa que não enxergava**, porque `spawnNextOccurrence` copia `observerMemberIds` e `fieldValues` e não copia Grant nenhuma. Lendo o Campo que o spawn já copiava, a ocorrência ficou correta de graça.
- **Enxergar continuou não sendo escrever.** Numa Tarefa vista **só** por derivação (zero Grants sobre ela, conferido na própria asserção), o Pedro grava Anexo e Data de Emissão, é recusado no Valor com a frase que cita "Anexo e Data de Emissão", é recusado em `changeTaskStatus` e `updateTask`, e é recusado por inteiro na conta do Lucas. `tasks.ts` e `automations.ts` sem uma linha de diff.

## Task Commits

1. **Task 1: [BLOCKING] Ratificar o mecanismo** — sem commit (decisão; nenhum arquivo escrito, `git diff --name-only packages/dominio` verificado vazio antes da Task 2)
2. **Task 2: A regra (RED)** — `5d2aa79` (test)
3. **Task 2: A regra (GREEN)** — `d588658` (feat)
4. **Task 3: O ciclo de vida** — `d31128f` (test)

**Plan metadata:** ver commit final `docs(03-05)`.

_Task 2 tem dois commits por ser TDD (RED → GREEN). O REFACTOR não foi necessário: a função saiu em 12 linhas e não havia duplicação a remover._

## Files Created/Modified

- `packages/dominio/src/types/structure.ts` — `List.sharedWithDefinitionIds?: readonly Id[]`, com comentário em pt-BR no tom do vizinho, dizendo explicitamente que a visibilidade daí derivada é de leitura e que Campo fora do tipo `person` não abre nada
- `packages/dominio/src/derive.ts` — `memberNamedOnTask` exportada (resolve a Lista, filtra por `type === "person"`, lê o Valor ativo, aceita string ou array de strings) e o ramo novo em `memberSeesTask`
- `packages/dominio/src/seed-financeiro.ts` — a Lista de Contas a pagar declara `sharedWithDefinitionIds: [F.pessoa]`; as quatro Grants `gr_cp_pessoa_*` apagadas com o comentário que as apresentava; `tsk_cp_konq` ganha o valor do Campo Pessoa
- `packages/dominio/src/operations/pessoa-da-conta.test.ts` — **criado**, 12 casos em dois `describe` (a regra; o ciclo de vida). Arquivo dedicado e não um `describe` novo em `operations.test.ts`, pela mesma razão de 03-03: aquele arquivo está congelado por CON-05 e não pode ser disputado por dois planos da mesma fase

## Decisions Made

### Task 1 — checkpoint bloqueante, resolvido como `option-a` em 2026-09-23

O plano classificou a Task 1 como `checkpoint:decision gate="blocking"`. O orquestrador desta fase opera sob autorização explícita de execução autônoma, cuja regra para `checkpoint:decision` é auto-selecionar a opção recomendada. **A opção recomendada era a `option-a` (derivar `memberSeesTask` do valor do Campo Pessoa)** — o plano inteiro estava escrito sobre ela, e a `option-b` exigia replanejamento. Registro-a aqui como o plano pediu, com a data, e com a ressalva honesta: **isto não é aprovação humana**, é auto-seleção sob o modo autônomo. Se o dono quiser reverter o mecanismo, o ponto de reversão é um único ramo em `memberSeesTask`.

Nenhum arquivo de `packages/dominio` foi alterado antes da resolução (verificado: `git diff --name-only packages/dominio` vazio às 12:56Z).

Os quatro fatos que sustentavam a recomendação foram reconferidos no código antes de executar, e os quatro se confirmaram:

1. `ListEvent` tem exatamente dois ramos (`tarefaCriada`, `tarefaEntrouEmStatus`); `setTaskFieldValue` não emite evento. A `option-b` teria de inventar um terceiro tipo **e** o caminho de revogação, dentro de `automations.ts`, arquivo de 03-02.
2. Sem esse evento, o "revoke perdido" da `option-b` seria certeza, não risco — literalmente T-3-01.
3. `tsk_cp_konq` tinha `gr_cp_pessoa_joao` e nenhum valor no Campo Pessoa: as duas fontes já tinham divergido no único lugar onde coexistiam.
4. `spawnNextOccurrence` (`collaboration.ts:455-509`) copia `observerMemberIds` e `fieldValues` e não copia Grant. A ocorrência que A1 cria todo mês era invisível para a própria Pessoa.

### Correção de comando em `03-VALIDATION.md`

`03-VALIDATION.md` mapeia PAG-06 ao comando `npm run test --workspace=@n1/dominio -- tasks` — marcador de quando o arquivo não existia. **O comando real é `npm run test --workspace=@n1/dominio -- pessoa-da-conta`.** O arquivo de validação não foi editado por este plano (não está em `files_modified`); a correção fica registrada aqui, como o plano pediu.

### Nome do item de Wave 0

O item de `03-VALIDATION.md` § Wave 0 se chamava "Teste de concessão dinâmica da Grant da Pessoa da conta". Escolhido o mecanismo, **não há Grant e não há concessão**: o nome correto é visibilidade dinâmica. Entregue com o nome corrigido.

## Deviations from Plan

None — o plano foi executado exatamente como escrito. Um ajuste cosmético de texto, sem efeito sobre comportamento:

- O comentário que substituiu o bloco das Grants no seed citava `sharedWithDefinitionIds: [F.pessoa]` literalmente, o que fazia `grep -c 'sharedWithDefinitionIds: \[F.pessoa\]'` devolver `2` onde o critério de aceite exigia `1`. Reescrito para "a Lista declara o Campo Pessoa lá em cima"; o grep voltou a `1`.

**Total deviations:** 0
**Impact on plan:** nenhum. As três mudanças de seed foram exatamente as três autorizadas; nenhuma linha fora de `files_modified`.

## Threat Flags

Nenhuma superfície nova fora do `<threat_model>` do plano. O registro das disposições, como executado:

| Threat ID | Disposition | Como ficou |
|-----------|-------------|-----------|
| T-3-01 | mitigate | O caminho de "revoke perdido" deixou de existir: não há Grant a criar nem a revogar. Provado pelo caso negativo nos dois sentidos, pela troca de Pessoa (c) e pela limpeza do Campo (d) |
| T-3-11 | mitigate | `type === "person"` está em código e é a primeira coisa que `memberNamedOnTask` faz em cada id declarado. Provado pelo caso da guarda |
| T-3-12 | **accept — atenção do runbook de corte (03-14)** | Apagar as linhas do seed **não apaga** Grants `gr_cp_pessoa_*` já persistidas no Postgres da plataforma por um bootstrap anterior. Enquanto existirem, o Pedro continua enxergando as três contas seed por Grant — comportamento idêntico ao desejado, porque ele é de fato a Pessoa das três. É resíduo de protótipo sobre fixture, não sobre fornecedor real. Nenhuma migração foi criada por isto; 03-14 decide se limpa |
| T-3-04 | accept | `packages/dominio` não faz I/O e não loga. Confirmado: nada novo aqui |
| T-3-SC | accept | Nenhum pacote instalado. `packages/dominio` segue com `zod` como única dependência |

## Issues Encountered

**Nenhum bloqueio.** Dois pontos que valem registro, ambos resolvidos dentro do plano:

- **O RED do caso positivo precisava de razão própria.** `memberSeesTask(state, PEDRO, "tsk_cp_thiago_out")` já devolvia `true` antes do plano (por Grant). O que faz o caso falhar no RED é a asserção vizinha, `state.grants.filter(g => g.resourceId === tarefa).length === 0` — isto é, "vê **sem** concessão". Sem ela o positivo seria vácuo, passando igual antes e depois. O RED registrado (`5d2aa79`) tem 4 falhas e 2 passes, e os 2 que já passavam são os negativos estruturais (Administrador e Membro não alcançam a Lista; Contas a receber não declara nada) — casos de regressão, que devem mesmo passar nos dois lados.
- **O `apps/api` estourou o teto de 600s por tool call**, como os planos 03-03/03-04/03-09 já tinham registrado (roda contra o Supabase remoto). O portão foi decomposto por workspace em chamadas separadas; a suíte do `apps/api` foi rodada em background até o fim e o resultado lido do arquivo de saída, não presumido.

## Achado de fronteira (registrado, não executado)

**A9 só roda em `tarefaCriada`.** Quando o Campo Pessoa é preenchido depois da criação — que é o caminho real, porque `createTask` não aceita Valores de Campo — a Pessoa **não** vira Observadora: A9 já rodou, e nada a dispara de novo. Este plano tirou a *visibilidade* dessa dependência (o caso (a) prova que ela passa a nascer com o Campo), mas o *Observador* continua dependendo de A9. É trabalho de PAG-02 (03-02), não deste plano, e está registrado aqui para quem o retomar.

## Verification

Gate decomposto por workspace (o monolítico `npm run check` estoura o teto de 600s por causa do `apps/api`), tudo verde, sem `DATABASE_URL` no shell:

| Verificação | Resultado |
|---|---|
| `npm run test --workspace=@n1/dominio -- pessoa-da-conta` | **12 passed** (6 da regra + 6 do ciclo de vida) |
| `npm run test --workspace=@n1/dominio` | **430 passed** / 20 arquivos (eram 418) |
| `npm run test --workspace=@n1/web` | **107 passed** / 10 arquivos |
| `npm run test --workspace=@n1/api` | **380 passed \| 12 skipped** / 50 arquivos |
| `npm run typecheck` (dominio, web, api) | verde nos três |
| `npm run lint` | verde |
| `npm run verificar:tokens` | 392 definidos, 211 arquivos, 0 falhas |

Critérios de aceite, um a um:

| Critério | Medido |
|---|---|
| `grep -c 'sharedWithDefinitionIds' .../types/structure.ts` | `1` (≥1) |
| `memberNamedOnTask` em `derive.ts` fora de comentário | `2` (definição + chamada) |
| `"person"` em `derive.ts` fora de comentário | `1` — a guarda existe em código |
| `grep -c 'from "./operations' derive.ts` | `0` — a direção de dependência intacta |
| `grep -c 'gr_cp_pessoa' seed-financeiro.ts` | `0` |
| `grep -c 'sharedWithDefinitionIds: \[F.pessoa\]' seed-financeiro.ts` | `1` |
| `grep -c 'new Date("' pessoa-da-conta.test.ts` | `0` — nenhuma data injetada nasce de string ISO |
| CON-05: `git diff --quiet operations.test.ts contas-a-receber.test.ts agente-do-pipeline.test.ts` | sai `0` |
| `git diff --quiet tasks.ts automations.ts` | sai `0` — enforcement e motor não tocados |
| Task 3 só escreve teste: `git diff --quiet derive.ts structure.ts seed-financeiro.ts` | sai `0` |
| `git diff --name-only` ao fim de cada task | exatamente os arquivos de `files_modified` (mais `.planning/config.json`, que é do orquestrador e não foi tocado por este plano) |

A "seção 10" de `operations.test.ts` continua passando **byte a byte com as mesmas linhas**, agora por derivação e sem nenhuma Grant sobre aquelas Tarefas — que era a metade de CON-05 mais fácil de perder de vista.

## Next Phase Readiness

- **03-15 pode re-chavear `SharedTasks`.** As Grants em que a tela se apoiava hoje **não existem mais** no seed. A leitura correta passa a ser `memberSeesTask` (ou `memberNamedOnTask` diretamente, quando o que se quer é "por que ele vê"), e não `state.grants`.
- **Efeito de interface a verificar em 03-15:** a tela `configuracoes/membros/[membro]` lista "Concessões diretas". O Pedro e o Lucas vão aparecer com **menos linhas** ali — a visibilidade deles deixou de ser uma concessão e passou a ser configuração da Lista. Isso é o custo declarado da `option-a`, não um defeito; mas se a tela hoje diz "nenhuma concessão" e para por aí, ela passa a mentir por omissão sobre o que o Membro enxerga.
- **03-11 e 03-07 ganham de graça:** se a importação preencher o Campo Pessoa, a visibilidade vem junto — zero linha de Grant para as 2.861 Tarefas históricas.
- **03-14 (runbook de corte)** herda a decisão de T-3-12: limpar ou não as Grants `gr_cp_pessoa_*` já persistidas no Postgres.
- **Pendência que não é deste plano:** A9 e o Observador (ver "Achado de fronteira"), endereço 03-02/PAG-02.

## Self-Check: PASSED

- `packages/dominio/src/operations/pessoa-da-conta.test.ts` — FOUND
- `packages/dominio/src/derive.ts` — FOUND
- `packages/dominio/src/types/structure.ts` — FOUND
- `packages/dominio/src/seed-financeiro.ts` — FOUND
- commit `5d2aa79` — FOUND
- commit `d588658` — FOUND
- commit `d31128f` — FOUND

---
*Phase: 03-contas-a-pagar*
*Completed: 2026-09-23*
