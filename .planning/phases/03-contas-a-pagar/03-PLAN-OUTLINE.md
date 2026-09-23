---
phase: 03-contas-a-pagar
tipo: outline
criado: 2026-09-22
planos: 15
waves: 5
---

# Fase 3 — Contas a pagar · Manifesto de planos

> Este arquivo é o manifesto da fase, não os planos. Cada linha vira um
> `03-NN-PLAN.md` escrito em contexto próprio, a partir do objetivo abaixo mais
> os artefatos compartilhados (`03-CONTEXT.md`, `03-RESEARCH.md`,
> `03-PATTERNS.md`, `03-VALIDATION.md`).

| Plan ID | Objetivo | Wave | Depende de | Requisitos | Decisões |
|---|---|---|---|---|---|
| 03-01 *(já escrito)* | Criar e aplicar a migração `005-agenda-de-automacoes.sql` — `plataforma.automacao_agenda` com PK `(workspace_id, list_id, dia_civil)` para exclusão mútua entre instâncias e auditoria de "o dia foi processado", mais o teste de integração contra o Postgres real e o apply `[BLOCKING]`. | 1 | — | AUTO-01 | — |
| 03-02 | Domínio: fechar o vocabulário do executor — `runAction` (`operations/automations.ts:135-141`) passa a tratar `aguardar`, `notificar` (in-app, no molde de `tarefa.comentar` com Menção — por Canal é Phase 5), `solicitarAprovacao` e `encerrar` dentro do mesmo `if (action.kind === "controle")` (o tipo `AutomationAction.controlKind` já os contém, `types/ai.ts` — nenhuma mudança de tipo), com autoria de Registro reatribuída à Automação, e cobrir A2/A3/A4/A9 (evento, dentro da mesma transação) e A5/A6/A7 (agenda, com `today` injetado e a prova de que rodar duas vezes no mesmo dia não duplica) em arquivo de teste dedicado. | 1 | — | PAG-02, AUTO-01 | — |
| 03-03 | Domínio: travar a regra de A1 por teste — `addMonths` (`operations/collaboration.ts:325-331`) satura no último dia do mês (31/01 → 28/02, nunca 03/03) sem nenhum código novo; `businessDays: "anterior"` trata só fim de semana e trata feriado como dia útil comum (caso real do export: 2025-02-17, segunda de Carnaval, sem deslocamento); e a ocorrência nasce uma vez por fechamento mesmo reabrindo (RN-CP-06), em arquivo de teste novo para não disputar `operations.test.ts`. | 1 | — | PAG-02 | D3-05, D3-06, D3-07 |
| 03-04 | Domínio: separar cálculo de execução no Agente — `buildResumoDePagamento` (`operations/financeiro.ts:146-182`) deixa de ler `CATEGORIA_OMIE`/`CONTA_POR_TAG` (**`CNPJ_POR_EMPRESA` nunca foi lido por ela — corrigido em 2026-09-22; ver 03-11**) e passa a receber o de-para resolvido por parâmetro (o texto do RESUMO de CON-CP-08 permanece byte a byte), e `runLancamentoAgent` passa a honrar o campo `rehearsal` que já existe (`financeiro.ts:224`, hoje `false` fixo): com `rehearsal: true` calcula e registra o que lançaria, sem nenhuma escrita no Omie. | 1 | — | PAG-03, PAG-04 | D3-02, D3-03 |
| 03-05 | Domínio: a Pessoa da conta enxerga a própria Tarefa sem Grant escrita à mão no seed — decidir entre derivar `memberSeesTask` do valor do Campo Pessoa ou conceder a Grant por ação de Automação (`seed-financeiro.ts:645` `gr_cp_pessoa_*` é hoje estática; nenhum código no repo cria Grant a partir de valor de Campo), implementar a escolhida e provar o caso NEGATIVO (Pessoa A **não** vê a Tarefa da Pessoa B) além de confirmar que `guestFieldWriter` limita a edição a Anexo e Data de Emissão. | 2 | 03-02 | PAG-06 | — |
| 03-06 | Domínio: D3-08 — `convertida` deixa de ser erro (D-14) e nasce a operação que cria a Conta a pagar a partir da Solicitação aprovada (Tarefa nova na Lista de Contas a pagar via `createTask`+`setTaskFieldValue`, campos equivalentes copiados no molde de `spawnNextOccurrence`), registrada em `operations/registro.ts::OPERACOES` — sem a qual o critério 1 quebra na primeira Solicitação aprovada após o arquivamento da Lista. | 2 | 03-04 | PAG-01 | D3-08 |
| 03-07 | `financeiro-tria/automation`: rota dedicada de lançamento de Conta a pagar que **só calcula e lança** — resolve categoria/conta contra o plano real do Omie (`ListarCategorias`/`ListarDepartamentos`/`resolveCategoryCodeAgainstOmie`, `REVISAR` abaixo de `CATEGORY_MIN_SIMILARITY`), consulta antes de incluir com `codigo_lancamento_integracao` determinístico (`tria:contas-a-pagar:<taskId>`), exige credencial de serviço (D-15) e `Idempotency-Key`, valida o corpo com `zod` e **nunca escreve status em Lista nenhuma**; decidir e justificar no plano se é o 8º método do contrato v1 ou rota nova; teste reusando `src/testing/omie-falso.ts`. | 2 | 03-04 | PAG-03, PAG-04 | D3-01, D3-02, D3-03 |
| 03-08 | `apps/api/src/automacoes/scheduler-worker.ts` — o relógio que falta ao motor: poller in-process no molde de `persistencia/outbox-worker.ts` (`setInterval` com trava de concorrência, `Relogio` injetável de `src/testes/relogio.ts`, `for update skip locked` sobre `plataforma.automacao_agenda`, `sanitizarErro()` importado e não duplicado, `pool()` existente e nunca um `Pool` novo) que garante ao menos uma chamada de `runScheduledAutomations` por (Espaço, Lista, dia civil) dentro da Unidade de Trabalho com Ator de sistema, ligado por env em `index.ts` como o outbox. | 2 | 03-01, 03-02 | AUTO-01, PAG-02 | — |
| 03-09 | Domínio: `operations/importacao-contas-a-pagar.ts` — importa a Tarefa já no status final (resolvido por `effectiveListConfig`/`statusDefinition`), com `createdAt`/`completedAt` originais por substituição de objeto e um `recordActivity` por transição do `status_history` com o `at` daquela transição, **sem nunca chamar `changeTaskStatus`** (as 9 Automações da Lista não podem disparar no replay), com `jaImportada()` e o par `antes`/`desfazer` de `importacao.ts`; o teste prova que nenhuma `AutomationExecution` nasce e que "tempo em `para pagar`" continua mensurável. | 1 | — | PAG-01 | D3-04 |
| 03-10 | `apps/api`: CLI de importação da Lista `901107637383` — lê o export em disco (`apps/api/exportacoes/clickup/901107637383/`, 2.861 Tarefas), classifica linha a linha no molde de `importacao/financeiro/solicitacoes.ts` (de-para de usuários PREP-04, campo `L` → Data de vencimento nativa, nunca duplicada), chama a operação de domínio sob transação gravando em `plataforma.importacao_ledger` com `origem = 'clickup:901107637383'`, e roda de verdade contra o banco `[BLOCKING]` provando que a segunda execução é no-op. | 2 | 03-09 | PAG-01 | D3-04 |
| 03-11 | `apps/api/src/automacoes/invocar-agente.ts` — a ponte HTTP que liga A7/A8 de verdade: chama a rota nova do `automation/` no molde de `outbox-worker.ts::entregar` (timeout por `AbortSignal`, classificação transitório/permanente, `Idempotency-Key`), injeta o de-para resolvido em `buildResumoDePagamento`, publica o RESUMO atribuído ao Financeiro e deixa A8 mover para `lançado omie` como ação local do domínio; o Ensaio (`rehearsal: true`) fica ligado por env na primeira semana e nenhuma chamada de rede entra em `packages/dominio`; **e a metade órfã de PAG-04**: `CNPJ_POR_EMPRESA` (lido só por `automations.ts:118` em `fillTemplate`, token `{{cnpjEmpresa}}` de A5/A6) passa a vir do de-para resolvido em vez da tabela fictícia. | 3 | 03-04, 03-07, 03-08 | PAG-03, PAG-04 | D3-01, D3-03 |
| 03-12 | `apps/api` + domínio: fechamento em lote das 61 contas — decidir o tamanho da transação contra DEC-06 (uma transação, N transações ou operação de lote registrada em `OPERACOES`), expor a rota, e provar por teste de integração contra o Postgres real que cada fechamento dispara A1 exatamente uma vez, medindo o tempo de lock por Espaço e definindo o que a resposta reporta em falha parcial. | 3 | 03-03, 03-06 | PAG-05 | — |
| 03-13 | `apps/web`: ligar o gesto de lote que **já existe** em `features/estrutura/financeiro/contas-view.tsx` (`selecionando`, `onToggleMany`, checkbox por linha e por grupo) à rota de lote, exibindo o relato de falha parcial que 03-12 definir — wiring, não construção de UI — com checkpoint humano de verificação visual do lote de 61. | 4 | 03-12 | PAG-05 | — |
| 03-14 | Corte e Ensaio: relatório que compara o que o Agente teria lançado (`AgentExecution` com `rehearsal: true`) com o que o humano lançou de fato na primeira semana, mais o checkpoint bloqueante da semana sem ClickUp e do arquivamento da Lista `901107637383` (critério 1) — é aqui que se decide se o Agente ganha a caneta. | 5 | 03-10, 03-11, 03-13 | PAG-03 | D3-03 |
| 03-15 *(acrescentado em 2026-09-22)* | `apps/web`: a metade de interface de PAG-06 — o 03-13 achou que, depois do 03-05, a Pessoa enxerga a Tarefa no domínio mas não tem por onde chegar nela na tela. O 03-15 verificou e corrigiu o diagnóstico: a porta existe (`SharedTasks` em `app-shell.tsx`), mas é chaveada nas Grants `gr_cp_pessoa_*` que o 03-05 apaga — a seção some sem nenhum teste falhar. Re-chaveia em `memberSeesTask && !memberReachesContainer` e fecha duas telas que hoje listam Tarefas sem filtro de visibilidade nenhum (`buscar/page.tsx`, `estrutura/tarefas/page.tsx`). | 4 | 03-05 | PAG-06 | — |

## Waves

A ordem das ondas é ditada pela regra de dependência do `./CONTEXT.md`: o que muda
**o que a coisa é** nasce em `packages/dominio`; `apps/api` e `automation/` só
podem ser construídos em cima. Uma onda que construísse o scheduler antes da
função que ele chama seria uma onda refeita.

**Wave 1 — o domínio, tudo em paralelo (03-01 a 03-04, 03-09).** Cinco planos sem
dependência entre si e sem sobreposição de arquivos: `automations.ts` (03-02),
um arquivo de teste novo de recorrência (03-03, deliberadamente fora de
`operations.test.ts` para não disputar arquivo), `financeiro.ts` (03-04),
`importacao-contas-a-pagar.ts` (03-09, arquivo novo) e a migração + teste de
persistência de 03-01, que vive em `apps/api` e não toca o domínio. 03-01 já está
escrito e aplicado; os outros quatro podem rodar juntos.

**Wave 2 — o que depende de uma peça de domínio ou de um arquivo já tomado
(03-05 a 03-08, 03-10).** 03-06 depende de 03-04 só por posse de arquivo
(`financeiro.ts`); 03-05 depende de 03-02 porque, se a concessão dinâmica for
resolvida como ação de Automação, o arquivo é o mesmo `automations.ts`; 03-07
depende de 03-04 porque o corpo da resposta da rota nova é exatamente o de-para
que `buildResumoDePagamento` passou a receber; 03-08 depende de 03-01 (a tabela
de agenda) e de 03-02 (as ações que o executor vai rodar); 03-10 depende de
03-09 (a operação que o CLI chama). Sem sobreposição de arquivos dentro da onda:
domínio (`derive.ts`/`tasks.ts`, `financeiro.ts`), `../financeiro-tria/automation`,
`apps/api/src/automacoes/` + `index.ts`, `apps/api/src/importacao/clickup/`.

**Wave 3 — o encanamento que precisa dos dois lados prontos (03-11, 03-12).**
03-11 é a única peça que precisa simultaneamente do domínio parametrizado
(03-04), da rota do `automation/` (03-07) e do worker que a chama (03-08) — e
toca `index.ts`, que 03-08 acabou de tomar, o que por si só já o joga para a onda
seguinte. 03-12 toca `app.ts`/`rotas/` e `registro.ts`, este último tomado por
03-06 na onda 2. Os dois não disputam arquivo entre si.

**Wave 4 — a interface (03-13).** Depende da rota de lote existir e do formato de
falha parcial estar decidido. É wiring sobre UI que já existe.

**Wave 5 — o corte (03-14).** Depende de tudo que o critério 1 exige estar de pé:
histórico importado (03-10), Agente ligado em Ensaio (03-11) e lote operável pela
tela (03-13).

## Coverage

### Requisitos

- [x] **PAG-01** — importação histórica: 03-09 (operação de domínio), 03-10 (CLI + ledger + execução real). 03-06 carrega o mesmo ID por ser o fluxo dali para frente (ver nota sobre D3-08 abaixo).
- [x] **PAG-02** — A1–A9 no motor: 03-02 (A2–A9, evento e agenda), 03-03 (A1/recorrência travada), 03-08 (o relógio que dispara as de agenda).
- [x] **PAG-03** — Agente lança de verdade: 03-04 (cálculo separável + Ensaio), 03-07 (rota que lança no Omie), 03-11 (ponte + RESUMO + A8), 03-14 (medição do Ensaio).
- [x] **PAG-04** — de-para real do Omie: 03-04 (parametrização de `CATEGORIA_OMIE`/`CONTA_POR_TAG`), 03-07 (resolução contra `ListarCategorias`/RAG com `REVISAR`), 03-11 (injeção do de-para resolvido **e `CNPJ_POR_EMPRESA`, a metade que o esboço original deixou sem dono — corrigido em 2026-09-22**).
- [x] **PAG-05** — lote de 61: 03-12 (backend + medição contra DEC-06), 03-13 (gesto na tela).
- [x] **PAG-06** — permissão da Pessoa da conta: 03-05 (visibilidade derivada do Campo Pessoa + caso negativo no domínio) e **03-15 (a metade de tela — acrescentado em 2026-09-22, ver nota 4)**.
- [x] **AUTO-01** — motor de Automações: 03-01 (agenda no banco), 03-02 (vocabulário do executor), 03-08 (poller in-process).

### Decisões

- [x] **D3-01** (FINQ fora de escopo — restrição) → 03-07 (é onde `resolveAccountConfig`/credenciais por Centro de Custo são exercitadas: só TRIA, sem remover o caminho FINQ) e 03-11.
- [x] **D3-02** (o de-para já existe — restrição) → 03-07 (lê `conciliador_contas_pagar_tria` por HTTP, DEC-08/OQ-SYN-03, sem gerar um segundo de-para) e 03-04 (o domínio recebe por parâmetro em vez de inventar tabela).
- [x] **D3-03** (Ensaio em sombra) → 03-04 (`rehearsal` deixa de ser `false` fixo), 03-07 (a rota não escreve quando em Ensaio), 03-11 (env liga o Ensaio), 03-14 (o relatório que mede).
- [x] **D3-04** (trilha completa na importação) → 03-09, 03-10.
- [x] **D3-05** (regra de recorrência modelada) → 03-03.
- [x] **D3-06** (feriado: ignorar) → 03-03.
- [x] **D3-07** (dia inexistente: saturar) → 03-03.
- [x] **D3-08** (conversão Solicitação → Conta) → 03-06.

**Nota sobre D3-08 e o campo `requirements`:** a conversão é escopo travado da
fase mas não tem ID nomeado em `REQUIREMENTS.md`. 03-06 declara `requirements:
[PAG-01]` porque os dois servem o mesmo critério 1 — PAG-01 resolve o histórico,
D3-08 resolve o fluxo dali para frente — e o campo não pode ficar vazio. O plano
deve dizer isso em uma linha do `<objective>`, para que a rastreabilidade não
pareça um erro de digitação.

### Ameaças (distribuição)

- **T-3-01** (Pessoa vendo Tarefa de outro fornecedor) → 03-05, com o teste do caso negativo.
- **T-3-02** (replay da importação duplicando) → 03-09 (`jaImportada()`) e 03-10 (`importacao_ledger`).
- **T-3-03** (rota nova sem auth/idempotência) → 03-07 (credencial de serviço + `Idempotency-Key` + `codigo_lancamento_integracao` determinístico) e 03-11 (lado chamador).
- **T-3-04** (dado financeiro em log) → 03-08 e 03-11, ambos por `sanitizarErro()` importado.
- **T-3-05 / T-3-06 / T-3-SC** → já dispostos em 03-01.

## Wave 0 — quem é dono de cada item

A lista de `03-VALIDATION.md` § Wave 0 Requirements, com dono:

| Item Wave 0 | Plano dono |
|---|---|
| `packages/dominio/src/operations/importacao-contas-a-pagar.test.ts` | 03-09 |
| `apps/api/src/automacoes/scheduler-worker.test.ts` (relógio injetável, `processarUm()` sem esperar `intervaloMs`) | 03-08 |
| Teste do novo endpoint de lançamento em `financeiro-tria/automation` (reusar `src/testing/omie-falso.ts`) | 03-07 |
| Teste de concessão dinâmica da Grant da Pessoa da conta | 03-05 |
| `apps/api/src/.../lote-contas-a-pagar.test.ts` (tempo de lock contra DEC-06) | 03-12 |
| Ampliar a cobertura de `automations` para A2–A9 (arquivo dedicado, decidido aqui) | 03-02 (A2–A9) + 03-03 (A1) |

A injeção de tempo exigida por `03-VALIDATION.md` § Sampling Risk é obrigatória
em 03-02 (`today: Date` explícito em `runScheduledAutomations`) e em 03-08
(`Relogio` injetável de `apps/api/src/testes/relogio.ts`) — nenhum dos dois pode
chamar `new Date()`/`Date.now()` direto.

Planos que exigem banco real e portanto nascem `autonomous: false`: 03-08, 03-10,
03-12 (Postgres), 03-05 e 03-07 (checkpoint de decisão), 03-13 e 03-14
(verificação humana). A lição da Fase 2 vale: worktree isolado não enxerga
`DATABASE_URL` nem `.env`.

## Consequência cruzada achada no planejamento de 03-09

As contas importadas que ficarem em `para pagar` com **vencimento no passado**
são alvo legítimo de A5/A6/A7 na primeira volta do agendador — cobrança de nota e
invocação do Agente disparando em lote no dia seguinte à importação. A operação
de domínio (03-09) não dispara nada; **quem decide se a primeira volta do
scheduler as ignora é 03-08 (o relógio) e 03-10 (a corrida real)**. Ambos os
planos devem tratar isso explicitamente — não estava nas suas linhas do esboço
original.

## Convenção de ids de ameaça

Os planos foram escritos em contextos separados e cada um reivindicou ids a
partir de `T-3-07` para ameaças **diferentes**. Em vez de renumerar 15 arquivos
— mexendo em prosa, tabelas e referências cruzadas, com risco alto e ganho
nenhum —, a convenção fica declarada:

- **`T-3-01` a `T-3-06` e `T-3-SC` são da fase inteira** e não colidem: vieram
  de `03-01-PLAN.md` e da distribuição deste manifesto (T-3-01→03-05,
  T-3-02→03-09/03-10, T-3-03→03-07/03-11, T-3-04→03-08/03-11).
- **De `T-3-07` para cima, o id é local ao plano.** Ao citar um desses fora do
  plano que o registrou, escreva `03-06/T-3-11`, não `T-3-11`.

Faixas reivindicadas: 03-04 `T-3-07..10` · 03-05 `T-3-11..12` · 03-06
`T-3-11..14` · 03-07 `T-3-11..15` · 03-08 `T-3-20..23` · 03-10 `T-3-25..30` ·
03-11 `T-3-35..41` · 03-12 `T-3-45..50` · 03-13 `T-3-55..61` · 03-14
`T-3-65..71` · 03-15 `T-3-75..81`. As três primeiras se sobrepõem; as demais
já nasceram disjuntas porque o orquestrador passou a atribuir a faixa inicial.

## Notas para o orquestrador

1. **As duas referências cruzadas de `03-01-PLAN.md` foram honradas parcialmente.**
   "Plan 03-08" continua sendo o scheduler worker que assume as garantias da
   agenda — confere exatamente. "Plan 03-09" continua sendo a importação
   histórica, mas dividida em dois: 03-09 é a operação de domínio e **03-10 é o
   CLI que grava em `plataforma.importacao_ledger` com `origem =
   'clickup:901107637383'`**. A prosa de 03-01 atribui a 03-09 o reuso do ledger;
   o reuso concreto acontece em 03-10, a continuação direta de 03-09. Se a
   exatidão importar, é um ajuste de uma linha em `03-01-PLAN.md`
   (`must_haves.truths` T-3-02 e o comentário de rodapé da Task 1: "Plan 03-09"
   → "Plans 03-09/03-10"). Nada funcional muda — a convenção de valor e a
   proibição de criar um segundo ledger continuam idênticas.
2. **Duas decisões de projeto ficam abertas dentro de planos, não fora deles.**
   03-05 escolhe entre derivar a visibilidade do Campo Pessoa ou conceder Grant
   por ação de Automação; 03-07 escolhe entre 8º método do contrato v1 e rota
   dedicada; 03-12 escolhe o tamanho da transação do lote contra DEC-06. Nenhuma
   das três está travada por documento algum — cada plano decide **e justifica**,
   como a pesquisa pediu.
3. **14 planos para granularidade `standard` é acima da faixa típica (3–5)**
   porque a fase carrega sete requisitos, um motor greenfield, uma rota nova em
   outro repositório e a importação de 2.861 Tarefas. Nenhum plano foi criado por
   simetria: cada linha existe porque tem arquivo próprio e verificação própria.
   Nada foi cortado nem reduzido a "v1" — o escopo integral de PAG-01..06,
   AUTO-01 e D3-08 está distribuído.

4. **Plano 03-15, acrescentado depois do esboço.** Ao planejar o 03-13, o
   planner leu o código real e viu que PAG-06 ficava pela metade: o 03-05
   resolve o domínio, e nenhuma tela levava a Pessoa até a Tarefa. O 03-15
   verificou o achado antes de construir sobre ele e corrigiu o diagnóstico —
   a porta já existia (`SharedTasks`), e o 03-05 a fecharia sem quebrar teste
   nenhum ao apagar as Grants em que ela se apoia. De quebra, achou duas telas
   (`buscar/page.tsx` e `estrutura/tarefas/page.tsx`) que listam Tarefas **sem
   filtro de visibilidade nenhum** hoje — com `GET /estado` hidratando o Espaço
   inteiro sem recorte, a primeira frase do critério 5 seria falsa na tela por
   mais correto que o domínio estivesse.

5. **Três achados que ficaram sem dono e sobem ao usuário**, registrados pelos
   planners e não absorvidos em silêncio: (a) `GET /estado` não é filtrado por
   visibilidade (`apps/api/src/rotas/estado.ts`) — a correção durável é no
   servidor e muda a forma da hidratação, logo é plano próprio de `apps/api`;
   (b) sete famílias de busca (Contatos, Empresas, Negócios, Conversas,
   Documentos, Agentes, Automações) seguem sem filtro, e o predicado certo de
   cada uma não está decidido em documento algum; (c) a automação do gatilho de
   D3-08 (converter sozinho quando a Solicitação entra em `aprovado`) — o 03-13
   entregou o botão, que já fecha o critério 1, mas o disparo automático exige
   `tasks.ts` ou uma Ação nova de Automação.
