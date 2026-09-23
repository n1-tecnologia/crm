---
phase: 03-contas-a-pagar
plan: 04
subsystem: domain
tags: [contas-a-pagar, agente-de-lancamento, de-para, omie, rehearsal, zod, caracterizacao]

# Dependency graph
requires:
  - phase: 01-plataforma
    provides: "esquemas/ por módulo com `ArgumentosDe<N>` inferido da assinatura real e o portão `Confere<[Igual<…>]>` (IN-10)"
  - phase: 03-contas-a-pagar
    provides: "03-02 fechou o vocabulário do motor de Automações (`runAction`, `invocarAgente`) que chama `runLancamentoAgent` com 5 argumentos"
provides:
  - "`DeParaDeLancamento` — a forma do de-para resolvido que 03-07 devolve e 03-11 injeta"
  - "`ResolucaoDeCategoria` — união discriminada por `veredito` (`resolvida` | `revisar`), com `similaridade`/`motivo` obrigatórios no ramo fraco"
  - "`OrigemDoDePara` (`prototipo` | `omie`), obrigatório e gravado na `AgentExecution`"
  - "`DE_PARA_DO_PROTOTIPO` — padrão do parâmetro, o que mantém o comportamento de hoje idêntico"
  - "`ResumoDePagamento` — o retorno antes anônimo, agora nomeado e com `veredito`/`origem`"
  - "`OpcoesDeLancamento` — 6º parâmetro opcional de `runLancamentoAgent`, por onde 03-11 liga o Ensaio"
  - "`buildResumoDePagamento(state, task, dePara?)` e `runLancamentoAgent(..., opcoes?)` parametrizados de forma aditiva"
  - "Dois literais golden imutáveis do RESUMO de CON-CP-08, em `agente-de-lancamento.test.ts`"
  - "`OPCOES_DE_LANCAMENTO`/`DE_PARA_DE_LANCAMENTO`/`RESOLUCAO_DE_CATEGORIA`/`ORIGEM_DO_DE_PARA` + `_EnumsCompletos` no transporte do `apps/api`"
affects: [03-06, 03-07, 03-11, 03-14]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Parametrização aditiva: parâmetro opcional no fim com constante-padrão, para não mudar a aridade de nenhum chamador existente"
    - "Teste de caracterização com literal golden antes do refactor, commitado verde contra o código antigo"
    - "Quem formata tolera, quem executa recusa: o fallback de renderização fica no formatador; a recusa por confiança fica no executor"

key-files:
  created:
    - packages/dominio/src/operations/agente-de-lancamento.test.ts
  modified:
    - packages/dominio/src/operations/financeiro.ts
    - apps/api/src/rotas/esquemas/financeiro.ts
    - packages/dominio/CONTEXT.md

key-decisions:
  - "O golden do RESUMO fixa o vencimento à mão (2026-03-10): o seed usa data relativa a hoje e um golden relativo expiraria amanhã"
  - "O NBSP que o `Intl.NumberFormat` pt-BR emite depois de `R$` está escapado como `\\u00A0` no literal golden — um NBSP literal é invisível na revisão e some no primeiro formatador"
  - "A recusa por confiança também não escreve na Tarefa quando em Ensaio: vira passo de raciocínio (fecha o buraco de T-3-08 no caminho de falha)"
  - "`CNPJ_POR_EMPRESA` fica fora deste plano por conflito de arquivo dentro da onda 1 (quem a lê é `automations.ts`, de 03-02)"

patterns-established:
  - "De-para injetado: o domínio recebe a decisão pronta e nunca a busca — `packages/dominio` continua sem `fetch`, sem cliente de banco e sem env"
  - "Ensaio (`rehearsal: true`) grava só a tripla conta/categoria/código, nunca o texto que carrega dado de pagamento"

requirements-completed: [PAG-03, PAG-04]

# Metrics
duration: 30min
completed: 2026-09-23
---

# Phase 03 Plan 04: O de-para do lançamento chega por parâmetro, e o Ensaio não encosta na Tarefa

**A decisão ("qual conta, qual categoria, qual código") saiu de três tabelas fictícias do módulo e virou um `DeParaDeLancamento` recebido por parâmetro, com `origem` obrigatória e um `veredito` que faz `runLancamentoAgent` recusar em vez de lançar — e `rehearsal: true` passou a ser Ensaio de verdade: uma `AgentExecution` de sombra e zero escrita na Tarefa.**

## Performance

- **Duration:** ~30 min de execução (+ ~11 min de suíte do `apps/api` contra o Supabase real)
- **Started:** 2026-09-23T09:15Z
- **Completed:** 2026-09-23T09:47Z
- **Tasks:** 3
- **Files modified:** 4 (1 criado, 3 modificados)

## Accomplishments

- **A fronteira de D3-03 tem nome, tipo e portão de compilação.** `DeParaDeLancamento`, `ResolucaoDeCategoria`, `OrigemDoDePara`, `ResumoDePagamento` e `OpcoesDeLancamento` são exportados de `@n1/dominio/operations` — 03-07 sabe o que devolver, 03-11 sabe o que injetar, 03-14 sabe o que medir.
- **O texto de CON-CP-08 está provadamente intocado.** Dois literais golden capturados ANTES do refactor e commitados verdes contra o código antigo (`be88ef9`); o mesmo teste continua verde depois da parametrização. Nenhum teste preexistente foi editado — `operations.test.ts` segue assertando `Conta pagamento: TRIA` e `Código:         2.06.01` sem uma linha de diff.
- **O Ensaio é estrito.** Com `rehearsal: true`: `task.comments.length`, `task.statusId` e `state.activity.length` inalterados; `state.agentExecutions.length` +1, com `rehearsal: true`, `state: "concluida"` e a tripla no `output`. Chamar duas vezes deixa UM registro de sombra; e a guarda de sombra não bloqueia o lançamento real depois.
- **Classificação fraca para a conta.** `veredito: "revisar"` (abaixo do corte de confiança) ou `"ausente"` devolve `fail`, publica Comentário ABERTO com Menção ao Financeiro citando similaridade e motivo, e marca a Execução como `falhou` — o que faz `execute` interromper o laço e A8 não mover para "lançado omie". Mecânica existente, nada novo construído.
- **Transporte endurecido.** A tupla de `runLancamentoAgent` ganhou `opcional(OPCOES_DE_LANCAMENTO)` (`.strict()` em cada objeto) e o arquivo fecha com `Confere<[Igual<…>]>`: um membro a mais ou a menos na união do domínio deixa de compilar no `apps/api`.

## Task Commits

1. **Task 1 (PASSO A): caracterização do RESUMO** — `be88ef9` (test) — verde contra o código AINDA sem parâmetro
2. **Task 1 (PASSOS B/C): contrato + `buildResumoDePagamento` parametrizada** — `f744344` (feat)
3. **Task 2: `rehearsal` honrado, recusa por confiança e o portão de transporte** — `ea631a0` (feat)
4. **Task 3: o contrato escrito em `packages/dominio/CONTEXT.md`** — `b8b2930` (docs)

**Plan metadata:** o commit `docs(03-04): fecha o plano…` (SUMMARY + STATE + ROADMAP + REQUIREMENTS), logo depois destes quatro.

## Files Created/Modified

- `packages/dominio/src/operations/agente-de-lancamento.test.ts` *(criado, 16 casos)* — dois goldens imutáveis de CON-CP-08, o de-para injetado, as três recusas e as invariantes do Ensaio (T-3-07/08/09/10)
- `packages/dominio/src/operations/financeiro.ts` — os seis símbolos novos, `DE_PARA_DO_PROTOTIPO`, as duas assinaturas parametrizadas, a guarda de sombra, o helper `recusar()` e o passo de raciocínio com a origem
- `apps/api/src/rotas/esquemas/financeiro.ts` — `ORIGEM_DO_DE_PARA`/`RESOLUCAO_DE_CATEGORIA`/`DE_PARA_DE_LANCAMENTO`/`OPCOES_DE_LANCAMENTO`, a tupla de 4 posições e `_EnumsCompletos`
- `packages/dominio/CONTEXT.md` — seção `## O de-para do lançamento: o domínio recebe, nunca busca (D3-02/D3-03)`, inserida entre a de Aprovação e a de Recorrência (que 03-03 acabara de escrever, e que ficou intacta)

## Decisions Made

- **Golden com vencimento fixo.** `tsk_cp_das` nasce com `d(12)` — data relativa a hoje. O teste fixa `dueDate` em `2026-03-10` antes de cada captura; sem isso o literal expiraria em 24 h e o "contrato byte a byte" viraria um teste intermitente.
- **` ` escapado no golden.** O `Intl.NumberFormat("pt-BR")` emite espaço inquebrável entre `R$` e o número. Escapar em vez de colar o caractere mantém o literal legível na revisão e imune a "formatar documento".
- **O de-para de conta também passou a vir do parâmetro.** `CONTA_POR_TAG[tag]` virou `dePara.contaPorTag[tag]`, mas os dois fallbacks (`centro.toUpperCase()`/`"A DEFINIR"` e `"A classificar"`/`9.99.99`) ficaram onde estavam: são regra de renderização, não de-para.
- **`OpcoesDeLancamento.dePara` é obrigatório.** Não se liga o Ensaio sem dizer contra qual de-para se ensaiou — meia especificação é a porta do default silencioso (T-3-07).
- **A tripla, nunca o texto.** A `AgentExecution` de sombra grava `conta · categoria · codigo` e jamais `resumo.texto`. A escolha está registrada em comentário no próprio código, para não ser "corrigida" depois (T-3-09); há um teste que varre `output`/`steps`/`input` atrás do código de barras e do valor.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] A recusa também não pode escrever na Tarefa durante o Ensaio**

- **Found during:** Task 2 (`runLancamentoAgent`)
- **Issue:** O plano bifurca o Ensaio DEPOIS de `buildResumoDePagamento`, mas os dois caminhos de recusa (dado faltando via `erpMissingFields`, e classificação fraca) vêm antes e publicam Comentário. Em Ensaio, uma conta incompleta faria o Agente comentar na Tarefa — furo direto na invariante "com `rehearsal: true` nenhuma escrita acontece na Tarefa" (T-3-08), justamente no caminho de falha, que é o mais provável na primeira semana de sombra.
- **Fix:** Um helper `recusar(index, rotulo, texto)` centraliza as duas recusas: em Ensaio, o pedido ao Financeiro vira passo de raciocínio (`Ensaio — pediria ao Financeiro: …`) em vez de Comentário; fora do Ensaio, o comportamento é byte a byte o de hoje (mesmo texto, mesma Menção, mesmo `toolId: "criar_comentario"`, mesmo `input: "faltantes"`).
- **Files modified:** `packages/dominio/src/operations/financeiro.ts`
- **Verification:** caso `"no Ensaio, nem a recusa escreve na Tarefa"` em `agente-de-lancamento.test.ts`; `operations.test.ts` continua provando `["concluida","concluida","falhou"]` e o Comentário de "Não consegui lançar" sem edição
- **Committed in:** `ea631a0` (commit da Task 2)

---

**Total deviations:** 1 auto-fix (Rule 2 — funcionalidade crítica ausente)
**Impact on plan:** Fecha uma invariante que o próprio plano declara como `must_have` (T-3-08). Sem escopo novo: o comportamento fora do Ensaio é idêntico ao anterior.

### Nota de escopo herdada (não é desvio)

`CNPJ_POR_EMPRESA` continua exportada e intacta, como o plano determina. Quem a lê é `packages/dominio/src/operations/automations.ts:118` (`fillTemplate`, placeholder `{{cnpjEmpresa}}` de A5/A6) — arquivo de 03-02, na mesma onda. **A metade CNPJ de PAG-04 segue aberta e precisa de realocação pelo orquestrador**; os candidatos naturais são 03-02 (dono do arquivo) ou 03-11 (que já injeta o de-para resolvido).

## Issues Encountered

- **O golden tinha um caractere invisível.** A primeira captura mostrou `R$ 66.267,50`, mas o byte entre `R$` e o número é U+00A0. Descoberto inspecionando os code points antes de escrever o literal — se tivesse passado batido, o teste falharia por um espaço que ninguém enxergaria no diff.
- **`npm run check` monolítico estoura o teto de 600 s da ferramenta** (a suíte do `apps/api` roda ~11 min contra o Supabase remoto). O portão foi decomposto por workspace, como a execução de 03-03 já havia feito.

## Verificação do portão (CON-05)

`npm run check` decomposto, tudo verde:

| Etapa | Resultado |
|---|---|
| `typecheck` @n1/dominio | 0 |
| `typecheck` @n1/api | 0 — é o portão que prova que `opcional(OPCOES_DE_LANCAMENTO)` casa com `ArgumentosDe<"runLancamentoAgent">` |
| `typecheck` @n1/web | 0 |
| `lint` (eslint) | 0 |
| `verificar:tokens` | ✓ 392 definidos · 211 arquivos · 0 falhas |
| `test` @n1/dominio | 18 arquivos · **409 testes** (eram 393; +16 do arquivo novo) |
| `test` @n1/web | 10 arquivos · 107 testes |
| `test` @n1/api | 50 arquivos · 380 passados, 12 pulados |

Invariantes de não-regressão conferidas:

- `git diff --name-only 228b660..HEAD` lista **exatamente** os quatro arquivos de `files_modified`
- `packages/dominio/src/operations/operations.test.ts` e `automations.ts`: sem diff
- `apps/web`: sem diff
- nenhum `*.test.ts` preexistente aparece no diff do plano
- `git diff be88ef9..HEAD -- agente-de-lancamento.test.ts` remove **uma** linha (o `import`); os dois literais golden não foram tocados
- domínio sem I/O: `grep -c 'fetch(\|process\.env\|require('` fora de comentários → `0`
- `grep -c 'rehearsal: false'` → `0`; `grep -c 'rehearsal: ensaio'` → `1`; `grep -c 'CNPJ_POR_EMPRESA'` → `1`

## Known Stubs

Nenhum. Os símbolos novos são todos ligados e exercitados por teste. `DE_PARA_DO_PROTOTIPO` **não** é stub: é o padrão declarado do parâmetro e se identifica como fictício via `origem: "prototipo"`, que vai gravada na `AgentExecution`.

## Threat Flags

Nenhuma superfície nova fora do `<threat_model>` do plano. Este plano não abre rota, não toca auth, não lê arquivo e não muda esquema de persistência — só a forma de um parâmetro e a do corpo que o transporta, endurecida por `.strict()` e pelo portão de união bidirecional.

## User Setup Required

Nenhum — nada de serviço externo, nenhuma variável de ambiente, nenhum pacote instalado (T-3-SC continua sem ação).

## Next Phase Readiness

- **03-07** tem o contrato do corpo da resposta: `DeParaDeLancamento` com `contaPorTag`, `categoriaPorCampo` e `origem: "omie"`. `resolveCategoryCodeAgainstOmie` + `CATEGORY_MIN_SIMILARITY` produzem o ramo `"revisar"` — com `similaridade` e `motivo`, que o esquema exige.
- **03-11** tem por onde injetar: `runLancamentoAgent(..., { dePara, rehearsal })`. A linha a obedecer está escrita no `CONTEXT.md` do domínio: **o Ensaio não deve encadear A8**.
- **03-14** tem o que medir: `AgentExecution` com `rehearsal: true`, uma por conta, com a tripla no `output` e a procedência do de-para no passo de raciocínio.
- **Pendência a realocar:** a metade CNPJ de PAG-04 (`CNPJ_POR_EMPRESA`), por conflito de arquivo dentro da onda 1.

---
*Phase: 03-contas-a-pagar*
*Completed: 2026-09-23*

## Self-Check: PASSED

- `packages/dominio/src/operations/agente-de-lancamento.test.ts` — FOUND
- `packages/dominio/src/operations/financeiro.ts` — FOUND
- `apps/api/src/rotas/esquemas/financeiro.ts` — FOUND
- `packages/dominio/CONTEXT.md` — FOUND
- commits `be88ef9`, `f744344`, `ea631a0`, `b8b2930` — FOUND em `git log`
