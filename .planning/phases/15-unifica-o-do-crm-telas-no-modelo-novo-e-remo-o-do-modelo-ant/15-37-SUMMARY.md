---
phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
plan: 37
subsystem: api
tags: [atividade, leitura, get-atividades, papel, espaco, swr, tdd, ucr-03]

requires:
  - phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
    provides: "15-04: plataforma.crm_atividades (012), repositorios/crm/atividades.ts (registrarAtividade e listar), @n1/dominio/crm/atividades (filtro, limites, vocabulario)"
provides:
  - "GET /atividades?objetoTipo=&objetoId=&limite=&ate= (rotas/crm/atividades.ts, rotasDeAtividades), registrada em rotas/crm/index.ts com o servico injetavel"
  - "servicos/crm/atividades.ts: criarServicoDeAtividades, so le; o Papel decide por tipo de objeto com podeNoCrm"
  - "apps/web/src/dados/crm/atividades.ts: chaveDeAtividades, useAtividadesDoCrm (so a rota) e useAtividades (state.activity do objeto + rota, a mais recente primeiro, sem repetir id)"
affects: [15-09, 15-15, 15-25]

plan_head_before: b8abce965088eebdfce087b44e927d415afe8bce
plan_head_after: 5fe8f58f9353bdf06ca676536a8ed46b3ba97be4

actuals:
  tokens: 8600
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Leitura de historico sem objeto filtrada POR TIPO pelo Papel (podeNoCrm por recurso), com 403 quando nenhum tipo e legivel"
    - "Teste de que a leitura filtra por tipo mesmo com a matriz de hoje uniforme: vi.mock parcial de podeNoCrm tira `ler` em Negocio so do Convidado, no arquivo de teste"
    - "Cursor de tempo `ate` exclusivo; a resposta de lista por cursor e { ok, itens } sem total"

key-files:
  created:
    - apps/api/src/servicos/crm/atividades.ts
    - apps/api/src/servicos/crm/atividades.test.ts
    - apps/api/src/rotas/crm/atividades.ts
    - apps/api/src/rotas/crm/atividades.test.ts
    - apps/web/src/dados/crm/atividades.ts
    - apps/web/src/dados/crm/atividades.test.ts
  modified:
    - apps/api/src/rotas/crm/index.ts
    - apps/api/src/rotas/CONTEXT.md
    - apps/web/CONTEXT.md

key-decisions:
  - "D-15-09 (leitura): GET /atividades responde { ok: true, itens } sem total, porque a paginacao e por tempo; `ate` e exclusivo e vem do `at` da ultima linha"
  - "A rota valida o objeto inteiro-ou-nenhum com validarFiltroDeAtividades ANTES do servico (400 sem chegar a ele); o servico repete a validacao por defesa, ja que outros chamadores podem usa-lo"
  - "useAtividades filtra o state.activity por objectType E objectId (a pesquisa dizia so objectId): um id de Negocio e um de Contato nunca se misturam na linha do tempo"
  - "useAtividades devolve { atividades, carregando, erro } e useAtividadesDoCrm devolve a resposta do SWR (data.itens); a antiga aparece enquanto a rota nao responde"

patterns-established:
  - "Servico de leitura: papelDe uma vez, podeNoCrm por tipo, comTransacao so para ler"
  - "Rota de leitura com querystring .strict(): ator, acao e workspaceId nao existem no pedido"

requirements-completed: []

coverage:
  - id: D1
    description: "GET /atividades devolve ActivityRecord do Espaco da sessao; a Atividade da Nota do Contato sai por listar sem o conteudo"
    requirement: UCR-03
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/atividades.test.ts (a)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Nenhuma leitura cruza Espaco (com e sem objeto, nos dois sentidos)"
    requirement: UCR-03
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/atividades.test.ts (b)"
        status: pass
    human_judgment: false
  - id: D3
    description: "O Papel decide por tipo: sem objeto so saem os tipos legiveis, com objeto sem `ler` e 403, Membro removido ou desconhecido e 403"
    requirement: UCR-03
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/atividades.test.ts (c), (d)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Cursor `ate` e limite; o pedido torto e 400 e a leitura nao grava"
    requirement: UCR-03
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/atividades.test.ts (e), (f)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Rota so de leitura: 401 sem Authorization, 400 (teto, objeto pela metade, ator/acao/workspaceId, parametro desconhecido) sem chegar ao servico, 403 repassado, sem POST/PATCH/PUT/DELETE"
    requirement: UCR-03
    verification:
      - kind: unit
        ref: "apps/api/src/rotas/crm/atividades.test.ts"
        status: pass
    human_judgment: false
  - id: D6
    description: "A web junta as duas fontes: state.activity do objeto + GET /atividades, a nova primeiro, sem repetir id, sem misturar objeto nem tipo"
    requirement: UCR-03
    verification:
      - kind: unit
        ref: "apps/web/src/dados/crm/atividades.test.ts (a)-(e)"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-11-06
status: complete
---

# Phase 15 Plan 37: Leitura da Atividade do CRM novo Summary

**`GET /atividades` por Espaço e Papel (serviço só de leitura, querystring `.strict()`) e `useAtividades`/`useAtividadesDoCrm` na web, que juntam `state.activity` com a linha do tempo nova, a mais recente primeiro.**

## Performance

- **Duration:** 8 min (após o contexto lido)
- **Tasks:** 2 (1 traçador + 1 auto, ambas TDD)
- **Files:** 6 criados, 3 modificados
- **Commits de produção:** 3 (RED, GREEN, prova)

## Accomplishments

- Serviço `criarServicoDeAtividades`: valida o filtro, lê o Papel do Membro uma vez e aplica `podeNoCrm(…, "ler", recurso)` por tipo de objeto (contact → contato, company → empresa, deal → negocio, conversation → conversa, funnel → funil, channel → canal). Com objeto, sem `ler` é 403; sem objeto, só saem os tipos legíveis e, sem nenhum, 403. A consulta roda em `comTransacao` e só chama `listar` do repositório (15-04), que põe `workspace_id` da sessão em todo `where`.
- Rota `GET /atividades`: `objetoTipo` em `z.enum(TIPOS_DE_OBJETO_DO_CRM)`, `objetoId`, `limite` 1..`LIMITES_DE_ATIVIDADE.paginaMaxima` (padrão 50), `ate` ISO; `.strict()`; objeto pela metade recusado por `validarFiltroDeAtividades` antes do serviço. Registrada em `rotasDeCrm` com `readonly atividades?: ServicoDeAtividades` para injeção em teste.
- Web: `chaveDeAtividades` (prefixo `/atividades`), `useAtividadesDoCrm(filtro)` (SWR, repete só em rede/5xx) e `useAtividades({ tipo, id })`, que une o `state.activity` do objeto à resposta da rota, sem repetir id, ordenado por `at` decrescente.
- CONTEXT.md de `apps/api/src/rotas` e `apps/web` registram a leitura.

## Task Commits

1. **Task 1 RED:** `fee8832` test(15-37): Atividade da Nota sai por listar e useAtividades junta as duas fontes
2. **Task 1 GREEN:** `008b6c1` feat(15-37): GET /atividades por Espaço e Papel e useAtividades junta as duas fontes
3. **Task 2:** `5fe8f58` test(15-37): GET /atividades protegida por Papel e Espaço, com prova

## TDD Gate Compliance

- **RED (Task 1):** esqueletos que só lançavam "nao implementado" (o import estático do teste precisava dos módulos; sem eles seria falha de carga, não RED), como no 15-04. Serviço: 1 caso falhou; web: 5 casos falharam, cada um pelo comportamento planejado (a leitura/fusão não existia). `workflow.tdd_mode` é `false` e o plano é `type: execute`; o classificador `tdd-red-evidence` não foi exigido.
- **GREEN (Task 1):** serviço, rota, registro e hooks; serviço 1/1, web 5/5, `tsc` limpo.
- **Task 2:** os casos de serviço passaram de imediato (o código nasceu na Task 1). Verde inesperado investigado por mutação, restaurada em seguida: (1) o serviço sem o filtro por tipo derruba (c) e (d); (2) a rota sem `validarFiltroDeAtividades` derruba os dois casos de objeto pela metade; (3) a rota sem `.strict()` derruba ator, acao, workspaceId e parâmetro desconhecido. A validação do objeto inteiro na rota foi escrita antes do teste, ainda na Task 2, e o teste a prova pela mutação 2. Sem commit REFACTOR.

## Verification

Postgres 16 descartável `crm-n1-pg-1537` (porta 55737), recriado do zero, com `DATABASE_URL` e `DATABASE_URL_MIGRACAO` explícitas; nunca o `.env`. O contêiner foi parado ao final.

- `migrar` aplicou 001..012 num banco novo.
- `servicos/crm/atividades.test.ts` 6/6 e `rotas/crm/atividades.test.ts` 16/16, nenhum pulado.
- Web `dados/crm/atividades.test.ts` 5/5; `apps/web/src/dados` 234/234.
- `tsc --noEmit` em `apps/api`, `apps/web` e `packages/dominio`: 0.
- Varredura `src/seguranca src/rotas/crm src/servicos/crm/notas.test.ts`: 25 arquivos, 464 passam, 2 `expected fail` (já eram). O inventário de rotas (`seguranca/inventario-de-rotas.test.ts`) cobre sozinho a rota nova, que exige JWT.
- Critérios de aceite: `rotasDeAtividades` em `index.ts` = 2; `useAtividades` = 5 e `useAtividadesDoCrm` = 3 em `dados/crm/atividades.ts`; `strict()` na rota = 2; `401` e `400` no teste da rota = 2 e 2.
- `npm run check` e a suíte inteira de `apps/api` não foram rodados (lentos; o plano pede a verificação escopada acima).

## Deviations from Plan

### Auto-fixed Issues

Nenhum.

### Ajustes de método e de contrato

**1. [Prova] "Papel sem `ler` em `deal`" não existe na matriz de hoje**
- `podeNoCrm` só distingue `ler` por estado do Membro, nunca por recurso; nenhum Papel real lê Contato e não lê Negócio. Para provar que a leitura sem objeto filtra por tipo, o teste de serviço usa um `vi.mock` parcial de `@n1/dominio/crm/permissoes` que tira `ler` em `negocio` só do Convidado, neste arquivo. O resto da matriz é a de verdade. Os casos de Membro `removido` e desconhecido (403) provam o caminho "nenhum tipo legível" sem mock.

**2. [Contrato] Sem `total` na resposta**
- O plano não fixava o envelope. Adotado `{ ok: true, itens }`: como a página é por tempo, um `total` seria mentira ou custo extra. O molde `responderLista` exige `Pagina` e por isso não foi usado; a rota envia a resposta de sucesso por conta própria e usa `responder` só para recusas.

**3. [Contrato] `useAtividades` filtra por tipo e por id**
- O RESEARCH/PATTERNS diziam `a.objectId === id`. Foi acrescentado `objectType === tipo`: um id de Negócio coincidindo com o de um Contato não mistura as linhas do tempo. Efeito: um chamador que passe o `tipo` errado não vê a Atividade antiga (as cadeias são as mesmas do modelo antigo: `contact`, `company`, `deal`, `conversation`, `funnel`, `channel`).

**4. [Duplicação consciente] O objeto inteiro é validado na rota e no serviço**
- A rota valida (o plano pede 400 "sem chegar ao serviço"); o serviço repete porque `ServicoDeAtividades` é uma interface que outros chamadores podem usar.

### Limitação aberta (registrada em `.planning/WINDOWS.md`, linha `deviation`)

**5. Paginação por `ate` pode pular linhas do mesmo instante na fronteira da página**
- `crm_atividades.em` é `now()` da transação, então um gesto que grava várias Atividades (uma sucessão de Membro, por exemplo) dá a todas o mesmo `em`; além disso `at` sai em ISO de milissegundos e o `em` tem microssegundos. Um cursor só de tempo (o desenho do plano e da D-15-09) pode, portanto, pular as linhas empatadas que não coube na página anterior. Para a ficha de UM objeto (limite 50) o efeito é desprezível; a Auditoria (15-09), que pagina o Espaço inteiro, deve decidir se troca por cursor composto `(em, id)`. Não mudei o repositório do 15-04 nem o contrato do plano.

**Total deviations:** 0 auto-fixed, 4 ajustes de método/contrato, 1 limitação aberta. **Impact:** nenhum no escopo; o 15-09 precisa ler o item 5 antes de paginar.

## Known Stubs

Nenhum. Nenhuma tela nova: `useAtividades` e `useAtividadesDoCrm` são consumidos pelos planos 15-09 (Auditoria), 15-15 (Reunião) e 15-25 (fio), ainda não executados; sem consumidor hoje, por desenho.

## Threat Flags

Nenhum. T-15-12 (Espaço da sessão em todo `where`, `podeNoCrm` por tipo, casos (b), (c), (d)) e T-15-89 (`limite` com teto no esquema, caso de 400 acima do teto) mitigados como planejado. A rota não aceita ator, ação nem Espaço no pedido.

## Issues Encountered

None.

## Next Phase Readiness

Pronto para 15-38. O 15-09 pode ler `useAtividadesDoCrm({ limite, ate })` (resposta `data.itens`), mas deve tratar a limitação do item 5 se paginar. O 15-15 e o 15-25 leem `useAtividades({ tipo, id })` e recebem `{ atividades, carregando, erro }`. O requisito UCR-03 continua aberto: outros planos que o declaram não têm SUMMARY (`requirements.ready-ids` respondeu 0/1).

## Self-Check: PASSED
