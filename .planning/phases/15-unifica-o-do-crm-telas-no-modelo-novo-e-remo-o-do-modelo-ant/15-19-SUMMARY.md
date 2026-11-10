---
phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
plan: 19
subsystem: api
tags: [contas-a-receber, cliente, gesto-misto, importacao, nomes, useContatos, tdd, ucr-08]

requires:
  - phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
    provides: "15-01: gesto-no-crm/financeiro.ts vazio, LidoDoCrm/LeituraDoCrm; 15-10: POST /crm/nomes e useNomesDoCrm; 15-38: GET /contatos com filtros; 15-08: ler(..., membro) e a checagem podeNoCrm ler"
provides:
  - "clienteDe(state, task) devolve so { tipo, id } do Vinculo cliente; createReceivableSeries(state, m, input, clientes?) confere o cliente pelo que o servidor leu"
  - "LER_DO_CRM_FINANCEIRO.createReceivableSeries le o Contato citado em plataforma.contatos (id, nome, estado, Proprietario), descarta o clientes do navegador e confere podeNoCrm ler"
  - "importarContaAReceberHistorica(state, m, entrada, clientesConhecidos?) e construirCatalogoDeClientes leem plataforma.contatos e plataforma.empresas ativos"
  - "useNomesDosClientes(state, tasks) e counterpart(state, task, nomes): nome do cliente por POST /crm/nomes na lista, no cartao e na busca"
  - "serie-dialog escolhe o cliente por useContatos com busca"
affects: [15-21, 15-33, 15-43, 3.5.4 remocao do modelo antigo, automacoes de Contas a receber]

plan_head_before: 81a9d9114c82edd93f74f6bfa470c88965662326
plan_head_after: 58644f6496c57b09560d03f5182456bbb2709f3b

actuals:
  tokens: 15800
  tasks: 3
  commits: 7

tech-stack:
  added: []
  patterns:
    - "Leitura do gesto misto com checagem de permissao do Membro antes de ler (o nome vai para o titulo das contas)"
    - "Catalogo recebido por argumento no dominio (Set por tipo), lido das tabelas pela orquestracao; sem catalogo nenhum cliente vale"
    - "Mapa de nomes lido uma vez pela pagina da Lista e passado a tabela e aos cartoes, para filtrar nao refazer a chamada"

key-files:
  created:
    - apps/api/src/rotas/operacoes-financeiro.test.ts
    - apps/web/src/features/estrutura/financeiro/use-nomes-dos-clientes.ts
    - apps/web/src/features/estrutura/financeiro/use-nomes-dos-clientes.test.ts
    - apps/web/src/features/estrutura/financeiro/serie-dialog.test.tsx
  modified:
    - packages/dominio/src/operations/financeiro.ts
    - packages/dominio/src/operations/automations.ts
    - packages/dominio/src/operations/importacao-contas-a-receber.ts
    - packages/dominio/src/sem-crm-antigo.test.ts
    - apps/api/src/rotas/gesto-no-crm/financeiro.ts
    - apps/api/src/rotas/gesto-no-crm/tipos.ts
    - apps/api/src/rotas/esquemas/financeiro.ts
    - apps/api/src/repositorios/crm/contatos.ts
    - apps/api/src/repositorios/crm/empresas.ts
    - apps/api/src/importacao/clickup/importar-contas-a-receber.ts
    - apps/api/src/importacao/clickup/contas-a-receber.ts
    - apps/web/src/features/estrutura/financeiro/lens.ts
    - apps/web/src/features/estrutura/financeiro/contas-view.tsx
    - apps/web/src/features/estrutura/financeiro/serie-dialog.tsx
    - apps/web/src/features/estrutura/cartao-de-tarefa.tsx
    - apps/web/src/app/(shell)/estrutura/listas/[lista]/page.tsx

key-decisions:
  - "O cliente lido pelo servidor leva tambem nome e Proprietario (ClienteLido), alem de id e estado: o titulo das contas usa o nome e a concessao de comentar vai ao dono do cliente; o plano so previa { id, estado }"
  - "clientes e clientesConhecidos sao parametros opcionais com padrao vazio: esquecer o argumento recusa (Cliente nao encontrado.), nunca deixa passar. O esquema Zod exige o parametro opcional para o tipo da operacao conferir"
  - "A pagina da Lista chama useNomesDosClientes uma vez para todas as contas da Lista (nao para o recorte filtrado) e passa o mapa a FinanceTable e FinanceCards; o plano dizia que contas-view usaria o hook. O cartao financeiro segue com uma chamada por cartao, como o plano aceitou"
  - "O catalogo da importacao le a tabela inteira de ativos de um Espaco (uma consulta por tipo, sem pagina): importacao roda uma vez por carga e o volume de Contas a receber e de centenas de clientes"
  - "A leitura do gesto confere podeNoCrm ler Contato antes de ler (T-15-49): sem permissao a serie recusa com a mesma frase de nao existe"

patterns-established:
  - "Quando um arquivo de dominio perde a leitura do modelo antigo em um ponto, a guarda sem-crm-antigo le o texto inteiro (comentario inclusive): reescrever o comentario"

requirements-completed: []

coverage:
  - id: D1
    description: "createReceivableSeries cria a serie para um Contato que so existe em plataforma.contatos: Vinculo cliente com o id novo, titulos com o nome lido, dono do cliente ve as contas; lixeira, arquivado, ausente e Contato do modelo antigo recusam com Cliente nao encontrado.; serie repetida segue a regra RN-CR-07"
    requirement: UCR-08
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/contas-a-receber.test.ts#Cliente da conta vindo das tabelas do CRM"
        status: pass
      - kind: integration
        ref: "apps/api/src/rotas/operacoes-financeiro.test.ts (a)-(f), Postgres local 55719"
        status: pass
    human_judgment: false
  - id: D2
    description: "O clientes forjado no corpo de POST /operacoes/createReceivableSeries e descartado (inexistente, lixeira, outro Espaco)"
    requirement: UCR-08
    verification:
      - kind: integration
        ref: "apps/api/src/rotas/operacoes-financeiro.test.ts#(b), (c), (d)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A importacao do ClickUp monta o catalogo de clientes de plataforma.contatos e plataforma.empresas ativos e a operacao so aceita o clienteRef que esta nele"
    requirement: UCR-08
    verification:
      - kind: unit
        ref: "packages/dominio/src/operations/importacao-contas-a-receber.test.ts#(d), (d2), (d3)"
        status: pass
      - kind: integration
        ref: "apps/api/src/importacao/clickup/importar-contas-a-receber.test.ts#(j), (k) e apps/api/src/persistencia/regime-dos-chamadores.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Lista, cartao e busca de Contas a receber mostram o nome do cliente por POST /crm/nomes (Cliente sem nome, Plataforma no saque); o seletor da serie usa useContatos e manda o id escolhido"
    requirement: UCR-08
    verification:
      - kind: unit
        ref: "apps/web/src/features/estrutura/financeiro/lens.test.ts#RECEBER_PROFILE.counterpart"
        status: pass
      - kind: unit
        ref: "apps/web/src/features/estrutura/financeiro/serie-dialog.test.tsx e use-nomes-dos-clientes.test.ts"
        status: pass
    human_judgment: true
    rationale: "Nenhum teste olha a tela de Contas a receber no navegador real (nome na tabela, no cartao do quadro e o seletor com busca); a verificacao visual fica para o fim da fase (human_verify_mode = end-of-phase)"

duration: 14min
completed: 2026-11-06
status: complete
commits: 7
---

# Phase 15 Plan 19: Contas a receber com o cliente do CRM novo Summary

**O cliente de Contas a receber passa a ser um Contato de `plataforma.contatos`, conferido pelo servidor ao criar a serie (`LER_DO_CRM_FINANCEIRO`) e ao importar (catalogo das tabelas), e o nome aparece na lista, no cartao e na busca por `POST /crm/nomes`.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-11-06T13:28:07Z
- **Completed:** 2026-11-06T13:42:25Z
- **Tasks:** 3 (1 tracer + 2 auto, todas `tdd="true"`)
- **Files:** 28 tocados (4 criados, 24 alterados), +946 -101

## Accomplishments

- `clienteDe` devolve so `{ tipo, id }` do Vinculo "cliente" (so papel `cliente`, Contato ou Empresa). `createReceivableSeries` recebe `clientes` (o que o servidor leu: id, nome, estado, Proprietario) e recusa "Cliente nao encontrado." para o que esta na lixeira, arquivado, ausente ou so no modelo antigo.
- A rota le so o Contato de `input.contactId` em `plataforma.contatos` do Espaco da sessao, se o Membro pode `ler` Contato; o `clientes` do navegador e descartado (T-15-48), o Contato de outro Espaco nao aparece (T-15-49).
- A importacao do ClickUp monta o catalogo de `plataforma.contatos` e `plataforma.empresas` ativos pelos repositorios (`ativosParaCatalogo`, `ativasParaCatalogo`); a operacao de importacao confere o `clienteRef` pelo catalogo recebido, sem `state.contacts` nem `state.companies`. O regime das importacoes longas nao mudou (`regime-dos-chamadores.test.ts` verde).
- Web: `counterpart(state, task, nomes)` e a busca da lente usam o mapa de nomes (sem nome mostra "Cliente", nunca o id); `useNomesDosClientes` junta os clientes em uma chamada a `POST /crm/nomes`; o dialogo da serie escolhe o cliente por `useContatos` com busca.

## TDD

Plano `type: execute` e `workflow.tdd_mode` falso: o classificador `check tdd-red-evidence` nao foi exigido. Cada tarefa teve commit RED antes do GREEN, com falha na asserção planejada.

- **Task 1 (tracer):** RED `1866951` — 5 casos de dominio e 6 de rota falham na asserção prevista (`ok` esperado `true` com Contato so da tabela; frase "Cliente nao encontrado." recebendo "Escolha um Contato ativo do CRM como cliente." ou "Entrada invalida"). Avaliacao semantica: os alvos executaram, sem erro de import/fixture; o acesso `proprietario` foi corrigido no teste antes do RED (o `administrador` do seed nao alcanca a Lista). GREEN `95480a0`.
- **Task 2:** RED `beca8d3` — `(d)`, `(d2)`, `(d3)` de dominio e `(j)`, `(k)` de rota falham por "Cliente ... nao encontrado no CRM." e catalogo lendo o modelo antigo. GREEN `04f6fd9`.
- **Task 3:** RED `8d081e7` — 3 de 15 falham (`counterpart` devolvia "undefined undefined" e a busca nao casava). GREEN `7e39c6a`.
- **Fix:** `58644f6` — comentario que citava o campo antigo (a guarda da api le comentario tambem).
- **REFACTOR:** nenhum.

Gate do traçador: modo `end-of-phase` e `<verify>` so automatizado, entao foi reexecutado ponta a ponta (dominio 12/12 + tsc; rota 6/6 em Docker novo) e passou: expansao liberada.

## Task Commits

1. **Task 1 (tracer): serie de contas para Contato da tabela** — `1866951` (test, RED), `95480a0` (feat, GREEN)
2. **Task 2: importacao do ClickUp com o catalogo das tabelas** — `beca8d3` (test, RED), `04f6fd9` (feat, GREEN)
3. **Task 3: nome do cliente na lista, no cartao e na busca; seletor da serie** — `8d081e7` (test, RED), `7e39c6a` (feat, GREEN)
4. **Ajuste da guarda sem-crm-antigo (api)** — `58644f6` (fix)

## Decisions Made

Ver `key-decisions` no frontmatter. Em resumo: o cliente lido leva nome e Proprietario; `clientes` e `clientesConhecidos` sao opcionais com padrao vazio (recusa); a pagina chama o hook uma vez para a Lista inteira; o catalogo le a tabela de ativos sem pagina; a leitura confere `podeNoCrm ler` antes de ler.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `clienteDe` e usado pelo motor de Automacoes (`automations.ts`)**
- **Found during:** Task 1
- **Issue:** `fillTemplate` (`{{cliente}}`, `{{donoDoCliente}}`) e `tarefa.comentar` com `mentionClientOwner` usavam o Contato que `clienteDe` devolvia. O plano nao citava `automations.ts`. Com `clienteDe` devolvendo so a referencia, o motor perderia nome e dono (e o teste `contas-a-receber.test.ts` "Helena Vasconcelos entrou em cobranca" quebra).
- **Fix:** `contatoDoCliente(state, task)` em `automations.ts` resolve nome e dono em `state.contacts` pelo id da referencia (comportamento de hoje para as contas do modelo antigo). A guarda `sem-crm-antigo` do dominio recusou o arquivo novo, entao `operations/automations.ts` entrou na lista `CONGELADOS` com comentario (a leitura mudou de arquivo, nao e nova).
- **Efeito visivel (aberto no ledger):** uma serie criada agora para um Contato de `plataforma.contatos` faz o comentario de cobranca dizer "o cliente" e nao mencionar o dono dele; as contas do modelo antigo seguem iguais. Fechar injetando nome e dono por `OpcoesDaAgenda` (como `cnpjPorEmpresa`) lidos das tabelas, antes do 3.5.4.
- **Files modified:** `packages/dominio/src/operations/automations.ts`, `packages/dominio/src/sem-crm-antigo.test.ts`
- **Commit:** `95480a0`

**2. [Rule 3 - Blocking] `applyFinanceFilters` e as telas que o chamam nao estavam na lista de arquivos**
- **Found during:** Task 3
- **Issue:** `counterpart` ganhou o mapa de nomes; `app/(shell)/estrutura/listas/[lista]/page.tsx` chama `applyFinanceFilters`, `FinanceTable` e `FinanceCards`. Chamar o hook em cada filtro refaria `POST /crm/nomes` a cada tecla da busca.
- **Fix:** a pagina chama `useNomesDosClientes` uma vez (antes do `return` de "Lista nao encontrada", por ser hook) com as contas da Lista inteira e passa `nomes` a `FinanceTable`, `FinanceCards` e `applyFinanceFilters`. `contas-view.tsx` recebe a prop em vez de chamar o hook.
- **Files modified:** `apps/web/src/app/(shell)/estrutura/listas/[lista]/page.tsx`, `contas-view.tsx`
- **Commit:** `7e39c6a`

**3. [Rule 2 - Missing critical] Cliente lido precisa de nome e Proprietario**
- **Found during:** Task 1
- **Issue:** o plano previa `clientes` com `{ id; estado }`, mas a serie usa o nome nos titulos ("Entrada – Ana Lima") e `contact.ownerMemberId` na concessao de comentar ao dono do cliente (secao 10).
- **Fix:** `ClienteLido { id, nome, estado, proprietarioId }`, lido por `clientesPorIds` (repositorio de Contatos).
- **Commit:** `95480a0`

**4. [Rule 3 - Blocking] Parametro `clientes` opcional**
- **Issue:** o conferidor de esquemas (`satisfies EsquemasCompletos`) exige que o parametro opcional no Zod seja opcional na operacao.
- **Fix:** `clientes: ClientesLidos = SEM_CLIENTES_LIDOS`; vazio recusa, entao esquecer o argumento nunca deixa passar.
- **Commit:** `95480a0`

**Total deviations:** 4 auto-fixed (3 Rule 3, 1 Rule 2). **Impact:** o item 1 deixa uma deviation visivel aberta (WINDOWS #35); os demais nao mudam comportamento.

## Issues Encountered

- A serie so aceita Contato como cliente (`input.contactId`); `empresas` segue vazio. A truth do plano cita Empresa ativa; a operacao nao tem como receber uma Empresa hoje.
- Dois pontos para o dono, registrados em `.planning/WINDOWS.md` (#35 e #36): Automacoes de Contas a receber para clientes novos; "Cliente" no lugar do nome quando `POST /crm/nomes` nao responde (Membro suspenso, WR-03 / #28; Papel sem ler Contato). O cartao financeiro faz uma chamada por cartao visivel, como o plano aceitou.
- AGENTS.md pede ler o guia do Next antes de escrever codigo da web; este plano so usou hooks de React e SWR e uma chamada de hook na pagina ja existente (nenhuma API, rota ou convencao do Next nova), entao o guia nao foi consultado.
- `requirements.ready-ids` respondeu 0/1 para UCR-08 (outros planos da fase ainda o declaram): `requirements-completed` ficou vazio e `mark-complete` nao rodou.

## Authentication Gates

None.

## Known Stubs

None. Nenhum valor vazio vira tela sem fonte de dados; o `"Cliente"` sem nome e fallback de texto, nao stub.

## Threat Flags

None. Nenhuma superficie nova alem das mitigadas (T-15-48: `clientes` forjado descartado e provado por teste de rota; T-15-49: leitura so do Espaco da sessao e atras de `podeNoCrm ler`).

## Next Phase Readiness

Contas a receber nao depende mais do Contato do modelo antigo para criar, importar e mostrar o cliente; falta o motor de Automacoes (ledger #35) antes do 3.5.4. Pronto para o proximo plano da onda 5.

## Self-Check: PASSED

- Arquivos criados existem: `operacoes-financeiro.test.ts`, `use-nomes-dos-clientes.ts`, `use-nomes-dos-clientes.test.ts`, `serie-dialog.test.tsx`.
- Commits na branch: `1866951`, `95480a0`, `beca8d3`, `04f6fd9`, `8d081e7`, `7e39c6a`, `58644f6`.
- Verificacao final: dominio 2430/2430 e `tsc`; web 1206/1206, `tsc`, `eslint` e tokens; api `tsc`, `operacoes-financeiro`, `importar-contas-a-receber`, `regime-dos-chamadores`, `rotas/operacoes*`, `importacao`, `bootstrap`, `repositorios/crm` (338 passam, 2 puladas) em Docker novo `crm-n1-pg-1519` (porta 55719), parado ao fim; as tres guardas `sem-crm-antigo` passam. Criterios: `grep` de `state.contacts` em `clienteDe`, no importador e na operacao de importacao = 0; `serie-dialog.tsx` sem `data.contacts` = 0.
