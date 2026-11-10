---
phase: 14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa
plan: 13
subsystem: api
tags: [fastify, gesto-misto, tarefa-conversacional, conversas, postgres, zod, unnest]

requires:
  - phase: 14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa
    provides: "14-02 criarTarefaConversacionalNasTabelas; 14-03 executarGestoMisto e recortarResposta; 14-07 Conversa com na_lixeira_em e estado; 14-12 Canais da Lista conferidos na tabela"
provides:
  - "abrirConversaNoCliente (+ canalArquivado, identificadorDoCanal, FRASES_DE_CONVERSAS) em servicos/crm/conversas.ts e LinhaNovaDeConversa.id opcional"
  - "POST /tarefas-conversacionais: a Tarefa em registros e a Conversa em plataforma.conversas no mesmo commit (D-07)"
  - "POST /tarefas-conversacionais/resumo: Contato, Canal, última Mensagem e Negócio de até 200 Tarefas numa consulta só"
  - "lerParaConversa (servico): a conferência de Contato, Canal, Identificador e Conversa aberta que 14-14 reusa"
  - "VinculoParaResumo, ResumoDaTarefaConversacional e RESUMO_MAXIMO no domínio"
affects: [14-14, 14-15, 14-16, 14-17, fase-15-telas-no-modelo-novo]

actuals:
  tokens: 21700
  tasks: 3
  commits: 7

tech-stack:
  added: []
  patterns:
    - "Gesto misto com anotação de closure: lerDoCrm grava num objeto `anotado` o que a resposta precisa e o desfecho do gesto não carrega (conversa { id, aberta })"
    - "Resumo em lote por unnest ... with ordinality + left join lateral, todo join com workspace_id; id de outro Espaço devolve null, nunca 404"

key-files:
  created:
    - apps/api/src/servicos/crm/tarefas-conversacionais.ts
    - apps/api/src/servicos/crm/tarefas-conversacionais.test.ts
    - apps/api/src/rotas/crm/tarefas-conversacionais.ts
    - apps/api/src/rotas/crm/tarefas-conversacionais.test.ts
    - apps/api/src/repositorios/crm/tarefas-conversacionais.ts
    - packages/dominio/src/crm/resumo-da-tarefa.ts
  modified:
    - apps/api/src/repositorios/crm/conversas.ts
    - apps/api/src/servicos/crm/conversas.ts
    - apps/api/src/servicos/crm/conversas.test.ts
    - apps/api/src/rotas/crm/index.ts
    - apps/api/src/rotas/CONTEXT.md

key-decisions:
  - "A resposta de POST /tarefas-conversacionais é o corpo de POST /operacoes recortado (ok, value: { task }, diferenca, revisao, revisaoAnterior, sequencia) mais conversa: { id, aberta }; a Tarefa fica em value.task, não em task solto, para a web aplicar a diferença com o mesmo código das operações"
  - "O resumo devolve { ok, itens, total } (envelope de lista do CRM), um item por Vínculo na ordem pedida"
  - "O Negócio na lixeira não aparece no resumo (RN-TAR-15), o arquivado aparece; Mensagem com marcacao_exclusao não é candidata a última Mensagem"
  - "O Negócio de outro Contato, de outro Espaço ou fora de ativo recusam com a mesma frase 'Este Negócio não é deste Contato.' (código NEGOCIO_DE_OUTRO_CONTATO, campo negocioId); a frase é copiada do domínio, onde a constante não é exportada"
  - "O serviço aplica recortarResposta (importa de rotas/resposta-recortada), como o plano pede, em vez de devolver o desfecho cru à rota"
  - "Mensagem do corpo é ignorada quando já há Conversa aberta no par (não grava Mensagem nova)"

patterns-established:
  - "lerParaConversa(cliente, ws, { contatoId, canalId, mensagem? }): trava o Contato, confere Canal e Identificador do tipo, acha a Conversa aberta ou gera o id da nova, aplica D-07. Reuso direto na troca de Canal (14-14)"

requirements-completed: [UNI-12, UNI-14]

coverage:
  - id: D1
    description: "POST /tarefas-conversacionais cria a Tarefa em registros e abre a Conversa em plataforma.conversas (com a primeira Mensagem em plataforma.mensagens) no mesmo commit, sem Conversa nova em registros"
    requirement: "UNI-12"
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/tarefas-conversacionais.test.ts#sem Conversa aberta: +1 Conversa e +1 Mensagem nas tabelas, 0 Conversas em registros"
        status: pass
    human_judgment: false
  - id: D2
    description: "D-07: sem Conversa aberta a primeira Mensagem é obrigatória (400 campo mensagem); com uma aberta ela é reaproveitada sem Mensagem nova"
    requirement: "UNI-12"
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/tarefas-conversacionais.test.ts#com Conversa aberta no par: reaproveita"
        status: pass
      - kind: integration
        ref: "apps/api/src/servicos/crm/tarefas-conversacionais.test.ts#sem Conversa aberta e sem Mensagem"
        status: pass
    human_judgment: false
  - id: D3
    description: "Recusas (Lista operacional, Canal fora da Lista ou desconectado, Contato mesclado, Canal arquivado, Negócio alheio) não deixam Tarefa, Conversa nem Mensagem"
    requirement: "UNI-12"
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/tarefas-conversacionais.test.ts#409 RECUSA_DO_DOMINIO com o campo, sem Tarefa, Conversa nem Mensagem"
        status: pass
    human_judgment: false
  - id: D4
    description: "POST /tarefas-conversacionais/resumo devolve Contato (seguindo mesclado_em_id), Canal, última Mensagem não interna e Negócio de até 200 Tarefas numa consulta só; id de outro Espaço volta vazio"
    requirement: "UNI-14"
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/tarefas-conversacionais.test.ts#50 Vínculos numa consulta só"
        status: pass
      - kind: integration
        ref: "apps/api/src/servicos/crm/tarefas-conversacionais.test.ts#ids de outro Espaço voltam vazios"
        status: pass
    human_judgment: false
  - id: D5
    description: "abrirConversaNoCliente é o mesmo código de POST /conversas (extraído): os 81 testes de conversas passam sem edição dos casos existentes"
    requirement: "UNI-12"
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/conversas.test.ts + apps/api/src/rotas/crm/conversas.test.ts"
        status: pass
    human_judgment: false

duration: 22min
completed: 2026-11-04
status: complete
plan_head_before: 2e2620f175a40752debe0d747337f27342df21db
plan_head_after: 95f7715a8363ded1473cf263687057e8a655cbc8
commits: 7
---

# Phase 14 Plan 13: Tarefa conversacional nas tabelas Summary

**POST /tarefas-conversacionais cria a Tarefa em `registros` e abre (ou reaproveita) a Conversa em `plataforma.conversas` no mesmo commit pelo gesto misto, e POST /tarefas-conversacionais/resumo devolve o cartão de até 200 Tarefas numa consulta só (`unnest` + `left join lateral`).**

## Performance

- **Duration:** 22 min
- **Started:** 2026-11-04T19:19:00Z
- **Completed:** 2026-11-04T19:41:00Z
- **Tasks:** 3 (TDD: RED e GREEN por tarefa)
- **Files modified:** 11 (6 novos, 5 alterados)

## Accomplishments

- `abrirConversaNoCliente(cliente, membro, entrada, { id? })` extraído do `criar` de Conversas e usável dentro de qualquer transação; `LinhaNovaDeConversa.id` opcional (sem ele o default do banco gera). `POST /conversas` segue igual.
- `POST /tarefas-conversacionais`: `lerParaConversa` trava o Contato e lê Canal, Identificador do tipo do Canal, Conversa aberta do par e Negócio na transação; a operação do 14-02 grava Tarefa e Vínculos com os ids lidos; `gravarNoCrm` abre a Conversa com o id gerado antes. Recusa do domínio desfaz tudo (a Conversa nem chega a ser aberta).
- D-07: Conversa nova sem Mensagem → 400 `VALOR_INVALIDO` campo `mensagem`; com Conversa aberta ela é reaproveitada, sem Mensagem nova.
- `POST /tarefas-conversacionais/resumo`: uma consulta (provada por contador de queries no teste) para 50 Vínculos; Contato segue `mesclado_em_id`; última Mensagem ignora `interna`, Conversa na lixeira e outro Canal; trecho de 140 caracteres no SQL; id de outro Espaço volta com os quatro campos `null`.
- Corpo `.strict()` nas duas rotas: `alvoConferido`, `referencias`, `workspaceId` e nome de Contato dão 400 (T-14-31); `.max(200)` no schema e `RESUMO_MAXIMO` no serviço (T-14-34); resposta pelo recorte por Membro (T-14-33).

## Task Commits

1. **Task 1: abrirConversaNoCliente e inserir com id opcional** - `746c93b` (test, RED), `edee4f7` (feat, GREEN), `9b96aa6` (refactor: `canalArquivado` e `identificadorDoCanal` exportados)
2. **Task 2: POST /tarefas-conversacionais** - `eff331f` (test, RED), `eb7d3a8` (feat, GREEN)
3. **Task 3: POST /tarefas-conversacionais/resumo** - `e8fd22e` (test, RED), `95f7715` (feat, GREEN)

**Plan metadata:** commit `docs(14-13)` seguinte (SUMMARY, STATE e ROADMAP).

## Files Created/Modified

- `apps/api/src/servicos/crm/tarefas-conversacionais.ts` - `criar` (gesto misto), `resumo`, e `lerParaConversa` reutilizável
- `apps/api/src/rotas/crm/tarefas-conversacionais.ts` - as duas rotas e os schemas `NOVA_TAREFA_CONVERSACIONAL` e `RESUMO_DE_TAREFAS`
- `apps/api/src/repositorios/crm/tarefas-conversacionais.ts` - `resumoDasTarefas`
- `packages/dominio/src/crm/resumo-da-tarefa.ts` - tipos do resumo e `RESUMO_MAXIMO`
- `apps/api/src/servicos/crm/conversas.ts` e `repositorios/crm/conversas.ts` - extração e id opcional
- `apps/api/src/rotas/crm/index.ts` - `OpcoesDeCrm.tarefasConversacionais?` e o registro
- `apps/api/src/rotas/CONTEXT.md` - seção "Tarefa conversacional nas tabelas (Fase 14, 14-13)"
- Testes: serviço (Postgres local, 19 casos), rota (serviço falso, 31 casos) e 2 casos novos em `conversas.test.ts`

## Decisions Made

Ver `key-decisions` no frontmatter. Em resumo: a resposta de criar reaproveita o corpo de `POST /operacoes` (Tarefa em `value.task`) mais `conversa`; o resumo usa o envelope de lista; Negócio na lixeira não aparece; a frase de `NEGOCIO_DE_OUTRO_CONTATO` é copiada do domínio (a constante não é exportada e `operations/tarefas-conversacionais.ts` não está nos `files_modified`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Bloqueio] `canalArquivado` e `identificadorDoCanal` exportados de `conversas.ts`**
- **Found during:** Task 2
- **Issue:** `lerDoCrm` do gesto precisa das mesmas frases de Canal arquivado e de Contato sem Identificador do tipo do Canal que `abrirConversaNoCliente` já tinha em linha; duplicar as frases as deixaria divergir.
- **Fix:** as duas frases viraram funções exportadas e `abrirConversaNoCliente` passou a usá-las. Comportamento de `POST /conversas` inalterado (81 testes de conversas passam sem edição dos casos existentes).
- **Files modified:** `apps/api/src/servicos/crm/conversas.ts`
- **Committed in:** `9b96aa6`

**2. [Interpretação] Forma da resposta de criar**
- O plano descreve `{ task, conversa, diferenca, revisao, sequencia, ... }`; a resposta segue o corpo de `POST /operacoes` (Tarefa em `value.task`) mais `conversa`, para a web aplicar a diferença com o mesmo código. Se o 14-16 preferir `task` solto, é um ajuste de uma linha no serviço.

**3. [Interpretação] Resumo devolve `{ ok, itens, total }`**
- O plano não fixa o envelope; usei o de lista do CRM (`responderLista`).

---

**Total deviations:** 1 auto-fixed (Rule 3), 2 interpretações do plano documentadas
**Impact on plan:** nenhum escopo a mais; nada fora de `files_modified`, além de SUMMARY, STATE e ROADMAP.

## Issues Encountered

- `src/persistencia/outbox-worker.test.ts` falha de forma intermitente (casos g a k; 2 a 5 falhas de 15, variando de uma execução para a outra, inclusive rodando o arquivo sozinho num banco recém-migrado). O plano não toca `persistencia/` nem o worker. É o baseline já registrado (tempo do worker sob carga). Sem esse arquivo, `src/persistencia` passa 19/19 arquivos (166 testes) num banco novo. Numa execução anterior, em banco que já tinha rodado outros lotes, `colunas-geradas.test.ts` falhou uma vez ("planejador escolhe o índice": estatística do planner depois de muitas linhas); num banco novo passa.
- Lote `src/servicos/crm src/rotas/crm src/repositorios`: 29 arquivos, 509 testes passam. `src/rotas/operacoes.test.ts` e `src/rotas/estado.test.ts`: 52 testes passam.

## Known Stubs

Nenhum.

## Threat Flags

Nenhuma superfície nova além das do `<threat_model>` (T-14-31 a T-14-34 mitigadas e testadas).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Para os próximos planos:

- **14-14** (trocar Canal e Negócio): reaproveite `lerParaConversa` (exportada de `servicos/crm/tarefas-conversacionais.ts`: trava o Contato, confere Canal e Identificador, devolve `conversaId` e `nova`, aplica D-07) e `abrirConversaNoCliente(..., { id })` em `gravarNoCrm`. O serviço falso de `ServicoDeTarefasConversacionais` em testes de rota precisa implementar `criar` e `resumo` (e `trocarCanal` etc. quando o 14-14 os acrescentar). Anote o que a resposta precisa (`conversa`) num objeto de closure, como `criar` faz: o desfecho do gesto não devolve o que `lerDoCrm` leu.
- **14-15** (web, resumo): `POST /tarefas-conversacionais/resumo` com `{ vinculos: [{ taskId, contatoId?, conversaId?, negocioId? }] }`, até 200; resposta `{ ok, itens, total }`, `itens[i].taskId` na ordem pedida; `contato`, `canal`, `ultimaMensagem` e `negocio` podem ser `null`.
- **14-16** (web, criar): corpo de `POST /tarefas-conversacionais` com `{ listId, contatoId, canalId, mensagem?, negocioId?, title?, ... }`; sem Conversa aberta a `mensagem` é obrigatória (400 campo `mensagem`); a resposta traz `dados.value.task`, `dados.conversa: { id, aberta }`, `diferenca`, `revisao`, `sequencia`.
- A Tarefa criada pela api NÃO cutuca a ponte do Agente (decisão do planejador, reversível). A Mensagem da Tarefa vai para `plataforma.mensagens`, nunca para `registros`.
- Contato `arquivado` recusa como `CONTATO_INATIVO` (mesma regra de `POST /conversas`); só `ativo` abre Tarefa conversacional.
- OQ6 (a última Mensagem é a mais recente entre as Conversas ativas do Contato no Canal da Tarefa) segue como suposição a confirmar.

## Self-Check: PASSED

- Arquivos criados existem: `tarefas-conversacionais.ts` (serviço, rota, repositório, 2 testes) e `resumo-da-tarefa.ts`.
- Commits `746c93b`, `edee4f7`, `9b96aa6`, `eff331f`, `eb7d3a8`, `e8fd22e`, `95f7715` são ancestrais de HEAD.
- Critérios de aceitação das 3 tarefas conferidos por `grep` (todos >= 1).
- `tsc --noEmit` limpo em `packages/dominio` e `apps/api`; domínio inteiro: 119 arquivos, 2321 testes; guardas D-06 (domínio e api) passam.

---
*Phase: 14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa*
*Completed: 2026-11-04*
