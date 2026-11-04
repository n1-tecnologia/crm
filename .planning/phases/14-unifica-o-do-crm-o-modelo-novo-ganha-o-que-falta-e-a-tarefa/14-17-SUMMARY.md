---
phase: 14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa
plan: 17
subsystem: dominio
tags: [tarefa-conversacional, registro-de-operacoes, quem-pode, derive-conversacional, moveTask, corte-da-fase-15]

requires:
  - phase: 14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa
    provides: "14-02 operacoes NasTabelas; 14-12 Canais da Lista conferidos na tabela; 14-13/14-14 rotas /tarefas-conversacionais; 14-16 nenhum chamador web das quatro operacoes antigas"
provides:
  - "OPERACOES sem criarTarefaConversacional, trocarCanalDaTarefa, vincularNegocioATarefa e criarNegocioDaTarefa: POST /operacoes/<qualquer uma> responde 404"
  - "operations/tarefas-conversacionais.ts so com alterarModeloDaLista, definirCanaisDaLista, temFormularioAtivo e FORMULARIOS_ANTES_DO_MODELO"
  - "derive-conversacional.test.ts lendo so por ids, com o estado sem contacts, conversations, channels e deals; derive-conversacional-antigo.test.ts guarda o que ainda tem chamador (sai na 3.5.4)"
  - "moveTask confere a Lista conversacional so por vinculosDoCrmDaTarefa"
affects: [14-18, fase-15-telas-no-modelo-novo, fase-15-remocao-do-modelo-antigo]

actuals:
  tokens: 23700
  tasks: 2
  commits: 5

tech-stack:
  added: []
  patterns:
    - "A Tarefa conversacional nasce e muda so pelas rotas /tarefas-conversacionais (operacoes NasTabelas, fora do registro); o registro guarda so o modelo da Lista"
    - "Teste de leitura por id com o CRM antigo esvaziado do estado; o teste do que resta do modelo antigo fica em arquivo proprio marcado para sair"

key-files:
  created:
    - packages/dominio/src/derive-conversacional-antigo.test.ts
  modified:
    - packages/dominio/src/operations/registro.ts
    - packages/dominio/src/operations/tarefas-conversacionais.ts
    - packages/dominio/src/operations/index.ts
    - packages/dominio/src/operations/tasks.ts
    - packages/dominio/src/operations/operations.test.ts
    - packages/dominio/src/operations/canais.test.ts
    - packages/dominio/src/operations/tarefa-conversacional-nas-tabelas.test.ts
    - packages/dominio/src/derive-conversacional.ts
    - packages/dominio/src/derive-conversacional.test.ts
    - packages/dominio/src/crm/resumo-da-tarefa.ts
    - packages/dominio/CONTEXT.md
    - apps/api/src/rotas/esquemas/tarefas-conversacionais.ts
    - apps/api/src/rotas/esquemas/tarefas-conversacionais.test.ts
    - apps/api/src/rotas/esquemas-de-argumentos.test.ts
    - apps/api/src/rotas/operacoes.test.ts
    - apps/api/src/rotas/CONTEXT.md
    - apps/api/src/servicos/crm/tarefas-conversacionais.ts

key-decisions:
  - "contatoDaTarefa e canalDaTarefa FICAM (o fio da Conversa e o layout da ficha ainda as chamam, 14-16); por isso conversaDaTarefa tambem fica (canalDaTarefa a usa) e contatoAlcancado deixou de ser funcao do modulo: virou detalhe interno de contatoDaTarefa"
  - "Unica leitura apagada por falta de chamador de producao: ultimaMensagemDaTarefa (o resumo da api a substituiu)"
  - "O fluxo (z3) de operacoes.test.ts passa a semear Canal e Contato nas tabelas e criar a Tarefa por POST /tarefas-conversacionais; o Espaco ws_rotas_teste agora e limpo por limparEspaco (a rota deixa linhas nas tabelas do CRM)"

requirements-completed: [UNI-13, UNI-12]

duration: 18min
completed: 2026-11-04
status: complete
plan_head_before: a3928308de82b09488e1d180b0cf44321a3a590e
plan_head_after: e24f4e41fcac49410c0b8028cdd4796ddf0b115d
commits: 5

coverage:
  - id: D1
    description: "As quatro operacoes antigas da Tarefa conversacional saem de OPERACOES, dos esquemas e da tabela Quem pode; POST /operacoes/<cada uma> responde 404"
    requirement: "UNI-12"
    verification:
      - kind: unit
        ref: "apps/api/src/rotas/operacoes.test.ts#(a2) a operacao antiga %s nao esta mais no registro"
        status: pass
      - kind: unit
        ref: "packages/dominio/src/operations/tarefa-conversacional-nas-tabelas.test.ts#fora do registro"
        status: pass
      - kind: unit
        ref: "packages/dominio/src/quem-pode.test.ts"
        status: pass
      - kind: unit
        ref: "apps/api/src/rotas/esquemas/tarefas-conversacionais.test.ts#(a) cobertura"
        status: pass
      - kind: unit
        ref: "apps/api/src/rotas/esquemas-de-argumentos.test.ts#(j) ESQUEMAS cobre exatamente OPERACOES"
        status: pass
    human_judgment: false
  - id: D2
    description: "A Tarefa conversacional nasce pela rota nova num Espaco com Canal e Contato so nas tabelas (fluxo z3, contra Postgres 16 local migrado ate a 011)"
    requirement: "UNI-12"
    verification:
      - kind: integration
        ref: "apps/api/src/rotas/operacoes.test.ts#(z3) FUND-18"
        status: pass
    human_judgment: false
  - id: D3
    description: "UNI-13 (3.3.2): derive-conversacional.test.ts passa com o estado sem contacts, conversations, channels e deals; ultimaMensagemDaTarefa e contatoAlcancado saem do modulo; as leituras com chamador ficam testadas em derive-conversacional-antigo.test.ts"
    requirement: "UNI-13"
    verification:
      - kind: unit
        ref: "packages/dominio/src/derive-conversacional.test.ts#leituras por id (3.3.2)"
        status: pass
      - kind: unit
        ref: "packages/dominio/src/derive-conversacional-antigo.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "moveTask para Lista conversacional olha so o Vinculo de Contato (qualquer id); o Contato principal do Negocio no estado antigo deixou de bastar"
    requirement: "UNI-13"
    verification:
      - kind: unit
        ref: "packages/dominio/src/derive-conversacional.test.ts#moveTask so olha o Vinculo de Contato"
        status: pass
      - kind: unit
        ref: "packages/dominio/src/operations/operations.test.ts#moveTask: entrar numa Lista conversacional exige Contato"
        status: pass
    human_judgment: false
---

# Phase 14 Plan 17: Corte das quatro operações antigas da Tarefa conversacional e das leituras sem chamador Summary

**`criarTarefaConversacional`, `trocarCanalDaTarefa`, `vincularNegocioATarefa` e `criarNegocioDaTarefa` saem de `OPERACOES` (a rota responde 404), os esquemas, a tabela "Quem pode" e os testes acompanham; `ultimaMensagemDaTarefa` e o ramo antigo de `moveTask` saem; `derive-conversacional.test.ts` passa a ler a Tarefa só por ids, com o CRM antigo esvaziado do estado.**

## Só no deploy da Fase 15

Este plano é CORTE (D-01), como o 14-15 e o 14-16. Os cinco commits abaixo ficam no ramo `fase-13-gravacao-em-menos-idas-e-voltas` e **não podem subir antes do script de migração da Fase 15**. A fronteira de deploy aditiva continua sendo o commit `b9c3d86` (fim do 14-14); tudo depois dele, do 14-15 ao 14-17, é corte.

| Commit | O que é |
|---|---|
| `5f36edb` | RED: 404 das quatro, esquemas só com duas chaves, as quatro fora de `OPERACOES`, fluxo (z3) pela rota nova |
| `2bd63c2` | GREEN da Task 1: registro, esquemas, tabela "Quem pode", testes das antigas |
| `39d8643` | RED da Task 2: `derive-conversacional.test.ts` por ids + `derive-conversacional-antigo.test.ts` |
| `aa22ff7` | GREEN da Task 2: leituras sem chamador e `moveTask` |
| `e24f4e4` | imports sem uso nos testes |

Por quê: hoje o navegador ainda chama as quatro operações em produção (14-16 só trocou os chamadores no ramo). Publicar este plano antes da migração faria `POST /operacoes/criarTarefaConversacional` responder 404 para as telas que estão no ar. Nenhum arquivo de `apps/web` nem de migração mudou neste plano.

## Performance

- **Duration:** ~18 min (início estimado: a hora não foi gravada)
- **Tasks:** 2 (ambas `tdd`, RED e GREEN)
- **Files modified:** 18 (1 novo, 17 alterados)

## Accomplishments

- **Registro.** `registro.ts`, `operations/index.ts` e `operations/tarefas-conversacionais.ts` ficam só com `alterarModeloDaLista` e `definirCanaisDaLista` (mais `temFormularioAtivo` e `FORMULARIOS_ANTES_DO_MODELO`, que a web importa). Saíram as quatro funções, `CriarTarefaConversacionalInput`, `tarefaConversacional`, `negocioDoContato`, `removerVinculos` e a constante `NEGOCIO_DE_OUTRO_CONTATO`. `esquemas/tarefas-conversacionais.ts` tem só as duas chaves.
- **Tabela "Quem pode".** As quatro linhas saíram; o parágrafo de introdução diz que a Tarefa conversacional só é criada e alterada pelas rotas `/tarefas-conversacionais`. `quem-pode.test.ts` passa. `esquemas-de-argumentos.test.ts` (j) passou de 289 para 285 operações.
- **T-14-42 (mitigada).** `operacoes.test.ts` prova, por `it.each`, o 404 `Operação "<nome>" não existe.` das quatro. O fluxo (z3) agora semeia Canal e Contato nas tabelas (`semearCanal`, repositório de Contatos), cria a Lista conversacional pelo registro (os Canais vêm de `plataforma.canais`, 14-12) e cria a Tarefa por `POST /tarefas-conversacionais`: 201, `conversa.aberta = true`, Vínculos de Contato e Conversa com os ids das tabelas, Conversa em `plataforma.conversas`.
- **Leituras.** `ultimaMensagemDaTarefa` saiu (o resumo da api a substituiu). `contatoAlcancado` deixou de ser função do módulo: virou detalhe interno de `contatoDaTarefa`, que fica.
- **`moveTask`.** A condição para entrar numa Lista conversacional é só `vinculosDoCrmDaTarefa(state, task).contatoId !== undefined`. Teste novo prova que um Negócio com Contato principal no estado antigo não basta mais.
- **Testes.** `derive-conversacional.test.ts` ficou com `marcadoresDeCanal` (puro) e as "leituras por id (3.3.2)" com `contacts`, `conversations`, `channels` e `deals` vazios. `derive-conversacional-antigo.test.ts` (novo) guarda o que lê o CRM antigo: o chat por Canal (D-13/14/15), `canaisQueAlcancam`, e, acrescentados, testes diretos de `contatoDaTarefa`, `conversaDaTarefa`, `canalDaTarefa`, `negocioDaTarefa`, `tarefasConversacionaisDoContato`, `canaisDaLista`, `canaisDaListaQueAlcancam` e `listaSemCanais`. Sai na 3.5.4.

## O que ficou na leitura antiga (com chamador de produção)

Nenhuma delas pode ser apagada aqui: as telas só trocam na Fase 15.

| Leitura | Quem ainda a chama | Troca na Fase 15 |
|---|---|---|
| `contatoDaTarefa` | `apps/web/src/features/estrutura/tarefa-completa.tsx:380` (fio e layout de três colunas) | 3.4.2 (o fio troca de base) |
| `canalDaTarefa` | `tarefa-completa.tsx:381` | 3.4.2 |
| `conversaDaTarefa` | só `canalDaTarefa` (indireto) | 3.4.2, junto |
| `negocioDaTarefa` | `quadro-negocios.tsx:20,33` (`dealOfTask`) e o cartão do Negócio; `contatoDaTarefa` a usa | 3.4.5 (Meus negócios) |
| `tarefasConversacionaisDoContato` | `features/crm/tarefas-do-contato.tsx:36` (ficha antiga do Contato) | 3.4.x (ficha nova do Contato) |
| `canaisDaLista` | `conversation-thread.tsx:832,920` e `detalhes-da-lista.tsx:35,38` | 3.4.2 / Detalhes da Lista |
| `canaisDaListaQueAlcancam`, `listaSemCanais`, `canaisQueAlcancam` | `iniciar-conversa-dialog.tsx:16,51,52`, `conversation-thread.tsx:837,918`, `estrutura/listas/[lista]/page.tsx:218` | 3.4.2 |
| `canaisDoFio`, `canaisDeResposta`, `canalPadraoDeResposta`, `canalDaAbaInicial`, `canalPadraoDoTipo`, `rotuloDoCanal`, `textoDoSeparadorDeCanal` (fora da lista do plano, mas no mesmo arquivo) | o fio da Conversa | 3.4.2 |

`contatoDaTarefa` e `canalDaTarefa` ficam por ordem do 14-16 (o fio da ficha ainda as lê); o plano previa apagá-las, o que quebraria o fio hoje.

## Task Commits

1. **Task 1: as quatro operações saem do registro** — `5f36edb` (test, RED), `2bd63c2` (feat, GREEN)
2. **Task 2: leituras sem chamador e `moveTask`** — `39d8643` (test, RED), `aa22ff7` (feat, GREEN), `e24f4e4` (test, limpeza de imports)

**Plan metadata:** commits `docs(14-17)` seguintes (SUMMARY, STATE e ROADMAP).

## TDD Gate Compliance

- **Task 1 (RED, `5f36edb`):** 6 casos falharam pelo motivo certo: os quatro 404 (a operação existia e respondia 400 para `args: []`), o teste de cobertura dos esquemas (as quatro chaves ainda lá) e a assertiva de `OPERACOES` sem as quatro. O commit traz só testes. GREEN passa.
- **Task 2 (RED, `39d8643`):** 2 casos falharam pelo motivo certo: `"ultimaMensagemDaTarefa" in derivacoes` era `true`, e `moveTask` aceitava a Tarefa cujo único elo era um Negócio com Contato principal no estado antigo. Os outros 40 casos (movidos para o arquivo `-antigo` ou já existentes) passavam. GREEN passa (273 casos nos quatro arquivos de domínio, depois a suíte inteira).

## Deviations from Plan

**1. [Interpretação] `contatoAlcancado` virou função interna, não foi apagada por inteiro**
- O plano manda apagar `contatoAlcancado`, mas ele só era chamado por `contatoDaTarefa`, que o 14-16 mandou manter (o fio da ficha a chama). Para cumprir o critério (`grep -c "function contatoAlcancado" == 0`) sem mudar comportamento, a lógica foi para dentro de `contatoDaTarefa`. Sai de vez com ela, na 3.5.4.

**2. [Interpretação] `contatoDaTarefa`, `canalDaTarefa` e `conversaDaTarefa` ficam**
- O plano previa apagar `contatoDaTarefa`/`conversaDaTarefa`/`canalDaTarefa` se sem chamador. `tarefa-completa.tsx` ainda lê as duas primeiras e `canalDaTarefa` precisa de `conversaDaTarefa`. Só `ultimaMensagemDaTarefa` foi apagada. Lista acima.

**3. [Rule 3 - Bloqueio] Fixtures e testes fora de `files_modified`**
- `apps/api/src/rotas/esquemas-de-argumentos.test.ts` (j): a contagem de 289 passou a 285, forçada pela mudança de registro.
- `operacoes.test.ts`: o `beforeAll`/`afterAll` do grupo com banco passou a chamar `limparEspaco(WS)`. O (z3) agora deixa Canal, Contato e Conversa nas tabelas do CRM (a rota nova grava ali), e a limpeza antiga só tirava `registros` e `workspaces`.
- `canais.test.ts` e `operations.test.ts`: casos das quatro antigas apagados (cobertura nova: `tarefa-conversacional-nas-tabelas.test.ts`), um passo de `trocarCanalDaTarefa` tirado do caso de mesclagem, imports sem uso removidos.
- `tarefa-conversacional-nas-tabelas.test.ts`: assertiva de que as quatro antigas não estão em `OPERACOES`.

**4. [Rule 1 - Referência morta] Comentários e CONTEXT.md que apontavam para o código apagado**
- `servicos/crm/tarefas-conversacionais.ts` (comentário sobre `NEGOCIO_DE_OUTRO_CONTATO`), `crm/resumo-da-tarefa.ts` (citava `ultimaMensagemDaTarefa`) e `apps/api/src/rotas/CONTEXT.md` (dizia que o fluxo antigo seguia em uso). Só texto; fora de `files_modified`.

**5. [Escopo] Testes diretos das leituras antigas que ficaram**
- O plano manda só mover os testes. Como `contatoDaTarefa` foi mexida (inline do auxiliar), acrescentei em `derive-conversacional-antigo.test.ts` casos diretos: Subtarefa lê a raiz, Contato mesclado responde pelo sobrevivente, Contato na lixeira, Contato principal do Negócio, Conversa na lixeira, `tarefasConversacionaisDoContato`, Canais da Lista.

**Total deviations:** 5 (3 interpretações/escopo, 1 bloqueio de fixture, 1 referência morta). **Impact:** nenhum arquivo de produção de `apps/web`; a produção de `apps/api` mudou só em esquemas e num comentário; domínio como o plano manda, mais um comentário.

## Itens abertos

**1. `instantiateListTemplate` chama `createList` sem `canais` (pendência do 14-12; para o 14-18 levar ao `14-PROVAS.md`).**
- Onde: `packages/dominio/src/operations/planning.ts:364` (`createList(state, actingMemberId, { ...input, templateId })`); a operação está no registro em `registro.ts` e não tem entrada em `LER_DO_CRM` (`apps/api/src/rotas/operacoes.ts`).
- Efeito do corte: **não afeta e não agrava**. Este plano não tocou `createList`, `state.channels` nem `LER_DO_CRM`; o que saiu foi só a Tarefa. Nenhum teste ou caminho que funcionava deixou de funcionar.
- Risco que permanece: uma Lista conversacional instanciada de um Template com configuração só aceita Canal que ainda esteja em `state.channels`. Hoje funciona porque a projeção dos Canais das tabelas em `state.channels` segue ligada (`GET /estado` e `executar()`). Quando a 3.5.4 desligar a projeção, essa porta passa a recusar todo Canal: precisa de entrada em `LER_DO_CRM` (posição do argumento `canaisDeAtendimento` e leitor dos Canais) antes da 3.5.4.

**2. Teste de banco que carregava o `.env` sem querer.**
- Duas execuções de `vitest` em `apps/api` (a do RED e a de uma correção de teste) rodaram SEM `DATABASE_URL` no ambiente. `operacoes.test.ts` chama `carregarEnv()` no topo e o grupo "contra o banco real" usa `describe` simples (não `describeComBanco`, que só aceita host local), então ele pode ter aberto o banco do `.env`. Eu não li o `.env`. O que esses grupos fazem nesse banco é restrito ao Espaço de teste `ws_rotas_teste`: deletes por `workspace_id` em `integration_outbox` e, na segunda execução, em tabelas do CRM (a transação com `limparEspaco` abortou em `crm_de_para`, que não existe lá, e fez rollback). Na primeira execução os 26 casos do grupo apareceram como pulados e a saída foi cortada com `tail`; não pude confirmar se o `beforeAll` chegou a falhar ou se o grupo foi pulado, então trate como "pode ter tocado o banco do `.env`". Daí em diante todo comando de banco levou `DATABASE_URL` e `DATABASE_URL_MIGRACAO` do Postgres de Docker. O dono pode conferir se `ws_rotas_teste` existe lá e se há algo a limpar.
- Sugestão (fora do escopo, não feita): trocar `d` por `describeComBanco` em `operacoes.test.ts` para que ele nunca abra banco remoto.

## Issues Encountered

- Nenhuma falha do plano. Gate com Postgres 16 de Docker migrado até a 011 (`crm-n1-pg-1417`, porta 55617, removido ao fim; `crm-n1-pg-13` não foi tocado):
  - `src/persistencia` inteiro: 20 arquivos, 179 casos passam e 2 falham em `outbox-worker.test.ts` ((i) e (k)); o arquivo **isolado em banco novo passa 15/15**. É o BASELINE confirmado pelo orquestrador, não do plano.
  - `src/rotas/operacoes.test.ts` + `src/rotas/estado.test.ts` (lote separado): 56/56, nenhum pulado.
  - Suíte inteira de `apps/api` (a mais, em banco novo): 174 arquivos passam, 2 casos falham em `colunas-geradas.test.ts` (due_date e índice); **isolado em banco novo passa 8/8**. Baseline confirmado.
  - Arquivos do plano (`esquemas/tarefas-conversacionais.test.ts`, `esquemas-de-argumentos.test.ts`) passam; `npx tsc --noEmit` limpo em `packages/dominio`, `apps/api` e `apps/web`.
  - `packages/dominio` inteiro: 120 arquivos, 2322 casos passam.
  - `apps/web` inteiro: 107 arquivos, 1032 casos passam; `eslint .`: 0 erros e 2 avisos antigos (`rotulos.ts`, `app-shell.tsx`); `verificar:tokens`: 0 falhas.
  - As três guardas D-06 (domínio, api, web) passam.
- O `<human-check>` não existe neste plano; a prova de ponta a ponta é o (z3) contra o Postgres local.

## Known Stubs

Nenhum.

## Threat Flags

Nenhuma superfície nova. T-14-42 está mitigada e provada (o 404 das quatro). O corte reduz a superfície de `POST /operacoes/:nome`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **14-18** (fechamento): registrar em `14-PROVAS.md` a fronteira de deploy (aditivo = até `b9c3d86`; corte = 14-15, 14-16, 14-17, que sobem só com o script de migração da Fase 15) e o item aberto 1 acima (`instantiateListTemplate`). O gate cumulativo deve rodar a suíte da api em banco novo para o baseline de `outbox-worker` e `colunas-geradas`.
- **Fase 15:** 3.4.2 (fio) apaga `contatoDaTarefa`, `canalDaTarefa`, `conversaDaTarefa` e os Canais do fio; 3.4.5 apaga `negocioDaTarefa`; 3.5.4 apaga `derive-conversacional-antigo.test.ts` junto com o que ele cobre e desliga a projeção de Canais (ver Itens abertos 1).
- Nenhuma operação do registro cria ou altera a Tarefa conversacional: a web só pode chamar as rotas `/tarefas-conversacionais`, que respondem 404 para ids do modelo antigo até a migração.

## Self-Check: PASSED

- Arquivo criado existe: `packages/dominio/src/derive-conversacional-antigo.test.ts`.
- Commits `5f36edb`, `2bd63c2`, `39d8643`, `aa22ff7`, `e24f4e4` são ancestrais de HEAD; `commits: 5` medido de `plan_head_before` a `plan_head_after`.
- Critérios de aceitação: Task 1 (`criarTarefaConversacional` em `registro.ts` = 0; as quatro em `esquemas/tarefas-conversacionais.ts` = 0; linha `| \`criarTarefaConversacional\`` em `packages/dominio/CONTEXT.md` = 0); Task 2 (`function contatoAlcancado` = 0; as quatro coleções vazias no `derive-conversacional.test.ts` = 4 linhas; o arquivo `-antigo` existe).
- `<verification>` do plano: `vitest run` e `tsc --noEmit` do domínio, `tsc --noEmit` da web e da api verdes.
