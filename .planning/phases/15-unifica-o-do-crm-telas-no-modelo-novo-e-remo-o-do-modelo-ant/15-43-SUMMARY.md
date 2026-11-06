---
phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
plan: 43
subsystem: dominio-api-web
tags: [datastate, crm-antigo, grupo-e-flow, hidratar, guarda-final, tdd, ucr-12, tres-camadas]
status: complete

requires:
  - phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
    provides: "15-42: nenhum arquivo de producao nem teste le as oito colecoes; 15-33: resposta 'seguir' e guardas das tres camadas; 15-32: conversa-de-grupo.ts; 15-31: seed sem CRM antigo; 15-27: apagarDoRegistros"
provides:
  - "DataState e TODAS sem contacts, companies, deals, funnels, contactCompanyLinks, companyCompanyLinks, distinctFromLinks e channels; conversations fica, tipada ConversaDeGrupo[] (types/conversa-de-grupo.ts)"
  - "types/crm.ts sem Contact, Company, Deal, Funnel, Stage, Channel, MessageTemplate e os Vinculos; ficam ContactIdentifierType, Queue, BusinessHours, Inbox e o reexport de ChannelType/ProvedorDeCanal/ChannelCapabilities"
  - "seed-crm-antigo.ts (semearCrmAntigo) e seed-comercial.ts (MEUS_NEGOCIOS_ID) apagados; PASTA_MEUS_NEGOCIOS_ID fora de estruturas-fixas.ts"
  - "A Lista da Pasta Meus negocios deixa de esconder Tarefas com proveniencia 'deal' (WINDOWS #69 fechada)"
  - "Guarda sem-crm-antigo.test.ts do dominio no formato final: CONGELADOS vazio, 'a lista so encolhe' valida, state.conversations so em Grupo e Flow (lista nominal)"
  - "hidratar-crm-antigo.test.ts (Docker): com uma linha antiga em registros hidratar() nao lanca e carrega a colecao desconhecida; depois de apagarDoRegistros a chave some"
affects: [15-44]

plan_head_before: dff8891d0154c216315bdc4ca8e750f4a26b3e83
plan_head_after: 11e5863bb81fd64cf05b95e26b72c0e838c5ae8b
commits: 4

actuals:
  tokens: 50000
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "o que a composicao antiga precisa de um Canal chega como recorte local ({ channelType, provider }, CanalDaComposicao), nao como o tipo Channel do modelo antigo"
    - "prova de hidratar() contra linha antiga em Docker le a colecao pela chave (Record<string, unknown>), valida com o tipo sem as oito"

key-files:
  created:
    - packages/dominio/src/types/conversa-de-grupo.ts
    - apps/api/src/persistencia/hidratar-crm-antigo.test.ts
  modified:
    - packages/dominio/src/{state,colecoes,types,seed,seed-ferramentas,derive,derive-conversacional,derive-ferramentas,derive-resumo,estruturas-fixas}.ts
    - packages/dominio/src/types/crm.ts
    - packages/dominio/src/operations/ferramentas/{conversa-de-grupo,flows,grupos,comunidades}.ts
    - packages/dominio/src/sem-crm-antigo.test.ts
    - packages/dominio/src/seed-sem-crm-antigo.test.ts
    - packages/dominio/CONTEXT.md
    - apps/web/src/app/(shell)/estrutura/listas/[lista]/page.tsx
    - apps/web/src/features/{crm/inbox-columns,ferramentas/conversa-do-grupo}.tsx
    - apps/web/CONTEXT.md
    - .planning/WINDOWS.md
  deleted:
    - packages/dominio/src/seed-crm-antigo.ts
    - packages/dominio/src/seed-comercial.ts

key-decisions:
  - "Precondicao conferida: 15-33-SUMMARY.md linha 109 'Resposta da checkpoint: seguir' (grep -n '^Resposta da checkpoint: seguir'), dada pelo orquestrador a partir do 'pode fazer o que precisar para fechar a fase' do dono em 2026-11-06"
  - "conversa-de-grupo.ts (operacoes) fica, com WINDOWS #65: Grupo, Flow e Automacao ainda chamam startConversation, sendMessage e receiveMessage"
  - "Channel nao ficou como tipo: conversa-de-grupo.ts usa a interface local CanalDaComposicao; derive.ts e derive-conversacional.ts usam o recorte { channelType, provider } (+ name)"
  - "ConversaDeGrupo/MensagemDeGrupo guardam o que Grupo, Flow e a Caixa de Grupo leem; Snooze e DeletionMark ficaram porque inbox-columns.tsx (producao) os le"
  - "seed-comercial.ts foi apagado inteiro (so tinha MEUS_NEGOCIOS_ID e o proprio comentario dizia que saia no 15-43); os quatro testes que usavam o id como Pasta comum ganharam uma constante local"

requirements-completed: []

coverage:
  - id: D1
    description: "As oito colecoes e os tipos antigos saem do DataState, de TODAS e de types/crm.ts; conversations fica como ConversaDeGrupo[] e o tsc das tres camadas e a rede"
    requirement: UCR-12
    verification:
      - { kind: unit, ref: "packages/dominio/src/seed-sem-crm-antigo.test.ts#15-43: as oito colecoes ja nao sao colecoes do DataState", status: pass }
      - { kind: other, ref: "npx tsc --noEmit nas tres camadas ao fim de cada tarefa: 0 erros", status: pass }
      - { kind: other, ref: "npm run build (Next compila as paginas com o DataState novo): RC=0", status: pass }
    human_judgment: false
  - id: D2
    description: "Borda UCR-12 (D-15-02): hidratar() com linha antiga em registros nao lanca, nao estraga as colecoes tipadas e carrega a colecao desconhecida; depois de apagarDoRegistros a chave some e a Conversa de Grupo continua"
    requirement: UCR-12
    verification:
      - { kind: integration, ref: "apps/api/src/persistencia/hidratar-crm-antigo.test.ts (Postgres 16 em Docker, 2 casos)", status: pass }
    human_judgment: false
  - id: D3
    description: "Guarda final do dominio: CONGELADOS vazio, 'a lista so encolhe' valida e state.conversations so em Grupo e Flow"
    requirement: UCR-12
    verification:
      - { kind: unit, ref: "packages/dominio/src/sem-crm-antigo.test.ts", status: pass }
      - { kind: unit, ref: "packages/dominio/src/leituras-do-crm-antigo-fora.test.ts", status: pass }
    human_judgment: false
  - id: D4
    description: "A Lista da Pasta Meus negocios mostra as Tarefas com proveniencia de Negocio como qualquer Lista (WINDOWS #69); a constante da Pasta sai com todos os importadores"
    requirement: UCR-12
    verification:
      - { kind: unit, ref: "apps/web/src/features/estrutura/pagina-da-lista-visualizacoes.test.tsx#a Pasta Meus negocios e uma Pasta comum (15-43, WINDOWS #69)", status: pass }
      - { kind: unit, ref: "packages/dominio/src/estruturas-fixas.test.ts#a constante da Pasta Meus negocios saiu do modulo", status: pass }
    human_judgment: true
    rationale: "A Lista de uma Pasta com Tarefas nascidas de Negocio so foi montada em teste de componente; nenhuma tela foi aberta em navegador real"
  - id: D5
    description: "O script migrar:crm-antigo continua compilando e passando sem os tipos antigos"
    requirement: UCR-12
    verification:
      - { kind: integration, ref: "apps/api/src/migracao-crm/ (9 arquivos de teste com colunas-geradas e hidratar-crm-antigo em Postgres novo: 139 passam)", status: pass }
      - { kind: other, ref: "npm run check completo em Postgres 16 novo (crm-n1-pg-1543, porta 55743, migracoes 001-012), depois do ultimo commit de codigo: so os flakes de baseline (outbox-worker h/i/k, colunas-geradas); isolados em contêiner novo 3/3 passam", status: pass }
    human_judgment: false

duration: 70min
completed: 2026-11-06
---

# Phase 15 Plan 43: o DataState perde o CRM antigo Summary

**`contacts`, `companies`, `deals`, `funnels`, os tres tipos de Vinculo e `channels` sairam do `DataState`, de `TODAS` e de `types/crm.ts`; `conversations` ficou, restrita a `ConversaDeGrupo[]` para Grupo e Flow; `seed-crm-antigo.ts` e a constante da Pasta "Meus negocios" foram apagados; a Lista dessa Pasta deixou de esconder as Tarefas de Negocio; a guarda do dominio ficou no formato final e `hidratar()` com uma linha antiga em `registros` tem prova em Docker.**

## Precondicao

`grep -n "^Resposta da checkpoint: seguir"` em `15-33-SUMMARY.md` devolveu a linha 109 antes de qualquer edicao (resposta dada pelo orquestrador a partir do "pode fazer o que precisar para fechar a fase" do dono, 2026-11-06). Verificado, nao inferido.

## Performance

- **Duracao:** ~70 min de relogio; cada `npm run check` completo leva ~13 min.
- **Tarefas:** 2 (a 1 e tracador; as duas sao TDD).
- **Arquivos:** 42 em `git diff dff8891..HEAD` (+532 / -2504, a maior parte e `seed-crm-antigo.ts`, 1708 linhas, e `types/crm.ts`).

## Accomplishments

- **Construtor antigo fora.** `seed-crm-antigo.ts` apagado e, em `seed-sem-crm-antigo.test.ts`, o caso temporario de `semearCrmAntigo(buildSeed())`. O grep `semearCrmAntigo` nas tres camadas e 0.
- **`DataState` sem o CRM antigo.** As oito colecoes saem de `state.ts` e `colecoes.ts`; `seed.ts` e `id-sequence.test.ts` deixam de inicializa-las. `types/crm.ts` caiu de 512 para ~70 linhas.
- **`types/conversa-de-grupo.ts`** (`ConversaDeGrupo`, `MensagemDeGrupo`, `Draft`, `Participant`, `Snooze`, `DeletionMark`, `ConversationState`, `MessageDirection`, `MessageDeliveryStatus`). Prunou o que Grupo/Flow nunca leem (`unresolvedIdentifier`, `viaIdentifierId`, `subject`, `additionalAddresses`, `inReplyToMessageId`, `anonymized`); `snooze` e `deletionMark` voltaram porque `inbox-columns.tsx` (producao) os le. As trocas `Conversation`/`Message` por `ConversaDeGrupo`/`MensagemDeGrupo` foram mecanicas em 13 arquivos do dominio e 5 da web.
- **`Channel` nao sobrevive.** `conversa-de-grupo.ts` usa a interface local `CanalDaComposicao` (id, nome, estado, tipo, provedor, conexao, fila padrao, modelos vazios); `responseWindowOpenUntil` (`derive.ts`) e `rotuloDoCanal`/`textoDoSeparadorDeCanal` (`derive-conversacional.ts`) recebem o recorte `{ channelType, provider }` (+ `name`). O `Canal` de `plataforma.canais` serve a todos, o que `flow-popup.tsx` ja passava.
- **Sem chamador:** `contactDisplayName` (`derive.ts`) e `identidadeDeWhatsApp` (`derive-ferramentas.ts`, importada e nao usada em `grupos.ts`) apagadas.
- **Pasta "Meus negocios".** `PASTA_MEUS_NEGOCIOS_ID` e `seed-comercial.ts` (`MEUS_NEGOCIOS_ID`) apagados; o filtro `pastaDeNegocios` da pagina da Lista tambem, com teste (WINDOWS #69).
- **Guarda final do dominio.** `CONGELADOS = []`, `sumidos` valido, e a lista nominal `DE_GRUPO_E_FLOW` de `state.conversations`: `derive-ferramentas.ts`, `operations/ferramentas/{conversa-de-grupo,flows,grupos,provedor-simulado}.ts`, `operations/ia/agentes.ts`, `operations/members.ts`, `seed-ferramentas.ts`, `testes/crm-das-ferramentas.ts` e `types/conversa-de-grupo.ts` (conferida com grep; a mesma lista passa nos dois sentidos).
- **`hidratar-crm-antigo.test.ts`** (Docker, `describeComBanco`, conexao so por `process.env.DATABASE_URL`): semeia um Espaco com `buildSeed()`, insere a linha `contacts` na mao, e prova as duas metades.

## Task Commits

1. **Task 1 (tracador):** RED `5d977c5` (COLECOES nao lista as oito + `hidratar-crm-antigo.test.ts`) -> GREEN `fce5b4c`.
2. **Task 2:** RED `88814aa` (guarda final, constante da Pasta, Lista sem filtro de deal) -> GREEN `11e5863`.

**Metadados do plano:** commit `docs(15-43)` seguinte (SUMMARY, WINDOWS.md), depois STATE/ROADMAP.

## TDD Gate Compliance

`workflow.tdd_mode` e `false`; a saida do vitest foi lida a mao.

- **RED da Task 1** (`5d977c5`): `seed-sem-crm-antigo.test.ts` falhava ("contacts ... to not include") e, no Docker, "depois de apagarDoRegistros a chave some" falhava porque a coleção tipada devolvia `contacts: []`. O primeiro caso de `hidratar-crm-antigo.test.ts` (a linha antiga volta pela chave) passa antes e depois: e uma prova de caracterizacao do comportamento que D-15-02 manda conhecer, nao de comportamento novo.
- **RED da Task 2** (`88814aa`): `estruturas-fixas.test.ts` (a constante ainda exportada) e a Lista da Pasta (a Tarefa de Negocio nao aparecia; um controle com `provenance.kind = "contact"` mostrou que o RED era do filtro e nao da montagem do teste). A guarda final do dominio ja passava no RED (o `seed-crm-antigo.ts` saiu na Task 1): ela e uma guarda, nao um comportamento novo.

## Verificacao

- **Typecheck das tres camadas:** 0 erros ao fim de cada tarefa. Na Task 1 o `tsc` apontou so o que o plano previa (importadores de `Conversation`/`Message`/`Channel`/`Contact`/`Deal` e dois literais de teste); nenhum outro arquivo de producao do dominio, da api ou da web leia as oito.
- **`npm run check` completo** em Postgres 16 novo (`crm-n1-pg-1543`, porta 55743, as duas URLs explicitas, migracoes 001-012): Task 1 -> so `colunas-geradas.test.ts` falhou (2 casos); Task 2 (depois do ultimo commit de codigo) -> `outbox-worker.test.ts` (h, i, k) e `colunas-geradas.test.ts`. Dominio 2384, web 1298, api 2444 + 5 flakes. Os dois arquivos isolados em contêiner NOVO: 3 tentativas, 3/3 passam (23 testes); `git diff dff8891..HEAD` nos arquivos do outbox e das colunas esta vazio.
- **`npm run build`:** RC=0 (as paginas compilam com o `DataState` novo). O `apps/web/.next` ja existia e e ignorado pelo git; nao o apaguei.
- **Aceite por grep:** T1 -> 0 chaves antigas em `state.ts`, `ConversaDeGrupo` x2, `apagarDoRegistros` x4, `seed-crm-antigo.ts` ausente, `semearCrmAntigo` = 0 arquivos. T2 -> `PASTA_MEUS_NEGOCIOS_ID` = 0, `sumidos` x7, leitura de `state|data|estado|s.(contacts|...)` fora de teste = 0.
- AGENTS.md (Next.js com mudancas incompativeis): o unico codigo de pagina tocado foi remover um import e um filtro de `estrutura/listas/[lista]/page.tsx` (sem API do Next); o guia de `node_modules/next/dist/docs/` nao foi lido.
- Nenhum `.env` lido, nada contra banco remoto, `~/n1-ensaio` intocado, nenhum contêiner `supabase_*` tocado. O contêiner `crm-n1-pg-1543` e parado ao fim.

## Decisions Made

Ver `key-decisions`. A que mais pesa: **o `Channel` antigo nao ficou nem como residuo de Grupo**, porque o que as composicoes liam dele cabe num recorte; assim `types/crm.ts` nao guarda mais nenhuma forma do Canal em ingles.

## Deviations from Plan

**1. [Escopo] `Channel` e `MessageTemplate` tambem saem, e o Canal vira recorte local.** O plano lista `Channel` entre os tipos que saem, mas `conversa-de-grupo.ts` (que fica) o usava via `canalComoChannel`. Substitui por `CanalDaComposicao` (privado) e, em `derive.ts`/`derive-conversacional.ts`, pelo recorte estrutural. Sem mudanca de comportamento. **Commit:** `fce5b4c`.

**2. [Rule 1 - tipo cortado demais] `Snooze` e `DeletionMark` ficaram em `ConversaDeGrupo`/`MensagemDeGrupo`.** Meu primeiro corte tirou `snooze` e `deletionMark`; o `tsc` da web apontou `inbox-columns.tsx` (producao) e os devolvi; as duas linhas `delete conversation.snooze` de `resolveConversation` e `receiveMessage`, que eu havia tirado, voltaram. **Commit:** `fce5b4c`.

**3. [Rule 3] Funcoes sem chamador apagadas.** `contactDisplayName` e `identidadeDeWhatsApp` tinham o tipo `Contact` na assinatura. **Commit:** `fce5b4c`.

**4. [Escopo ampliado, pedido pelo orquestrador] `seed-comercial.ts` e `MEUS_NEGOCIOS_ID` tambem saem.** O plano so cita `PASTA_MEUS_NEGOCIOS_ID`; o arquivo `seed-comercial.ts` (so aquela constante e um comentario que dizia "sai no 15-43, junto com este arquivo") foi apagado e os quatro testes que usavam o id como Pasta comum (`mover-conteiner.test.ts`, `arvore-arrastavel.test.tsx`, `arvore-menu.test.tsx`, `mover-conteiner-dialog.test.tsx`) ganharam uma constante local. **Commit:** `11e5863`.

**5. [Escopo] Arquivos fora da lista do plano**, por seguirem o `tsc`: `derive.ts`, `derive-conversacional.ts`, `derive-ferramentas.ts`, `derive-resumo.ts`, `seed.ts`, `seed-ferramentas.ts`, `operations/ferramentas/{flows,grupos,comunidades}.ts`, `testes/crm-de-teste.ts`, `testes/crm-das-ferramentas.ts`, `crm/capacidades.test.ts`, `leituras-do-crm-antigo-fora.test.ts` (dominio); `inbox-columns(.test).tsx`, `pagina-da-conversa.test.tsx`, `conversa-do-grupo.tsx`, `testes/crm-antigo-de-teste.ts`, `pagina-da-lista-visualizacoes.test.tsx` (web). `leituras-do-crm-antigo-fora.test.ts` (15-42) tinha duas expectativas sobre o construtor que acabou de sair.

**Total deviations:** 1 correcao propria (tipo cortado demais), 1 bloqueio, 2 ajustes de escopo, 1 ampliacao pedida. **Impact:** nenhum comportamento visivel novo alem do #69 (Tarefas de Negocio aparecem na Lista da Pasta).

## Known Stubs

Nenhum. (`messageTemplates: []` em `CanalDaComposicao` repete o que a ponte ja fazia, WINDOWS #20/#67.)

## Threat Flags

Nenhum. T-15-80 mitigado e provado: `hidratar-crm-antigo.test.ts` mostra que a linha antiga volta enquanto existir e some depois de `apagarDoRegistros`; o `tsc` e as tres guardas impedem leitura nova. T-15-81 mitigado: `ConversaDeGrupo` mantem o que Grupo, Flow e a Caixa de Grupo leem (o `tsc` da web e da api passa) e o teste de `hidratar` confere as duas Conversas de Grupo.

## Issues Encountered

- `colunas-geradas.test.ts` e `outbox-worker.test.ts` (h, i, k): flakes de baseline, descritos em Verificacao.
- Quem publica o corte ainda precisa rodar `migrar:crm-antigo` ANTES de subir esta versao: uma linha antiga que sobre em `registros` volta como chave desconhecida em `GET /estado` ate ser apagada (e o que o `hidratar-crm-antigo.test.ts` documenta). Nao e novidade deste plano, mas agora e o unico lugar onde o CRM antigo ainda pode aparecer.

## Windows (WINDOWS.md)

**Resolvida (1, com prova de teste):** #69 (a Lista da Pasta "Meus negocios" mostra as Tarefas de Negocio; `pagina-da-lista-visualizacoes.test.tsx`).

**Seguem abertas, por decisao do dono ou de outro plano:** #41, #61 (seed Automacoes apontando para Listas espelho; decisao do dono, nao tocada), #62, #65 (`conversa-de-grupo.ts` nao saiu, como o plano manda), #67, #70, #71, #72. Nenhuma linha nova: nada do que este plano fez muda comportamento visivel alem do #69.

## Next Phase Readiness

- `requirements-completed: []`: `requirements.ready-ids` decide depois deste SUMMARY (UCR-12 e declarado tambem por outros planos da fase).
- Limite honesto: nenhuma tela foi aberta em navegador real; a Lista da Pasta com Tarefas de Negocio e a Caixa de Grupo com o tipo novo so tem teste de componente e `build`.

---
*Phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant*
*Completed: 2026-11-06*

## Self-Check: PASSED

- Arquivos criados conferidos (`[ -f ]`): `packages/dominio/src/types/conversa-de-grupo.ts`, `apps/api/src/persistencia/hidratar-crm-antigo.test.ts`; apagados (`test ! -e`): `packages/dominio/src/seed-crm-antigo.ts`, `packages/dominio/src/seed-comercial.ts`; `operations/ferramentas/conversa-de-grupo.ts` continua existindo.
- Commits `5d977c5`, `fce5b4c`, `88814aa` e `11e5863` sao ancestrais do HEAD; `git rev-list --count dff8891..HEAD` = 4 antes deste commit de metadados; `test(15-43)` precede o `feat(15-43)` de cada tarefa.
- O `<verification>` do plano (`npm run check` completo em Docker) rodou depois de todas as edicoes de codigo (a unica edicao posterior foi um comentario em `estruturas-fixas.test.ts`, com o arquivo re-executado); RC dos flakes isolados 3/3.
