---
phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
plan: 44
subsystem: api
tags: [migracao-crm, corte, revisao, host-local, mapeador, h-01, h-02, m-01, m-04, ucr-09, ucr-10]
status: complete

requires:
  - phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
    provides: "migrar:crm-antigo completo (15-27, 15-28), ensaio e roteiro do corte (15-30, 15-34) e a revisao independente 15-REVIEW.md"
provides:
  - "H-01: o mapeador aceita como destino o Canal e o Contato que ja estao em plataforma.canais/contatos (a Conversa migra com as Mensagens, o existente nao e inserido nem alterado)"
  - "H-02: um unico criterio de Conversa do CRM antigo (TypeScript e SQL) no --guardar, --migrar, --seco e --verificar; a 1:1 de Flow, Automacao e convite de Grupo fica em registros"
  - "M-01: persistencia/host-local.ts, a trava de banco local que olha o host que o pg usa (recusa qualquer query), usada pelo demo, pelos testes de banco e pela banner da CLI do corte"
  - "M-04: Mensagem sem id vai para mensagem-sem-id e Identificador sem id ou repetido ganha chave de de-para que nao colide"
  - "15-CORTE.md e CONTEXT.md do migracao-crm com os textos de M-02, M-03, M-05, H-02, L-01 e L-08; Ensaio pos-revisao em 15-ENSAIO.md; Disposicao em 15-REVIEW.md"
affects: [15-35]

plan_head_before: d8fe89d43b46c5643cd4cc13a546dfe5f64f9634
plan_head_after: bf6f1820a4c03069cec41c226e69ace770c160cb
commits: 8

actuals:
  tokens: 34000
  tasks: 4
  commits: 8

tech-stack:
  added: []
  patterns:
    - "um predicado de classificacao com duas implementacoes (TypeScript e SQL) e uma tabela de casos que roda nas duas e compara"
    - "trava de host que confere o host efetivo pela API publica do pg (new Client(url).host) em vez de reanalisar a URL por conta propria"
    - "chave de de-para aninhada com sufixo de posicao quando o item nao tem id ou o id se repete"

key-files:
  created:
    - apps/api/src/persistencia/host-local.ts
    - apps/api/src/persistencia/host-local.test.ts
    - apps/api/src/migracao-crm/colecoes.test.ts
  modified:
    - apps/api/src/migracao-crm/colecoes.ts
    - apps/api/src/migracao-crm/crm-novo.ts
    - apps/api/src/migracao-crm/mapeador.ts
    - apps/api/src/migracao-crm/guardar.ts
    - apps/api/src/migracao-crm/migrar-crm-antigo.ts
    - apps/api/src/migracao-crm/relatorio.ts
    - apps/api/src/migracao-crm/nao-migrados.ts
    - apps/api/src/migracao-crm/migrar.cli.ts
    - apps/api/src/bootstrap/crm-demo.ts
    - apps/api/src/bootstrap/crm-demo.cli.ts
    - apps/api/src/testes/banco-crm.ts
    - apps/api/src/migracao-crm/CONTEXT.md
    - apps/api/src/bootstrap/CONTEXT.md
    - apps/api/src/persistencia/CONTEXT.md
    - .planning/phases/15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant/15-CORTE.md
    - .planning/phases/15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant/15-ENSAIO.md
    - .planning/phases/15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant/15-PROVAS.md
    - .planning/phases/15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant/15-REVIEW.md
    - .planning/WINDOWS.md

key-decisions:
  - "O criterio de H-02 e o do orquestrador, sem mudanca: a Conversa e do CRM antigo se nao e de Grupo e o contactId e um id da colecao contacts do mesmo Espaco; o resto fica em registros (copiado, nunca apagado nem migrado), contactId ausente inclusive. Alternativa rejeitada: decidir pelo Canal existir so em plataforma.canais, porque desde a Fase 8 a Conversa da Caixa antiga tambem cita um Canal da tabela nova, com o mesmo id; o Canal nao separa a de Flow da antiga"
  - "Efeito colateral aceito de H-02: no mapeador, a Conversa cujo contactId nao e de contacts deixa de ir para conversa-sem-contato (ela fica em registros); a categoria so aparece agora quando o Contato existe em contacts e nao e destino. Dois testes do mapeador foram ajustados e um passou a provar isso"
  - "M-01 recusa qualquer URL com query em vez de listar os parametros que trocam o destino; localhost, 127.0.0.1 e [::1] exatos. Mudanca de comportamento: [::1] passou a ser aceito (o plano pediu), e uma URL local com ?sslmode=... passa a ser recusada pelo demo e pelos testes de banco"
  - "M-03 so no texto: nao foi criada a trava --esperar-linhas que a revisao sugeriu como alternativa (seria outro comando do script, fora do plano)"
  - "HOST_LOCAL sem ancora de conexao.ts (TLS) e L-03 a L-06 ficaram abertos como linhas deviation do WINDOWS, com o motivo"

patterns-established:
  - "Predicado SQL compartilhado entre o apagar, o contar e o verificar, com o equivalente em TypeScript para o mapeador, e teste de concordancia"
  - "Ensaio descartavel fora do repositorio com tabela esperada embutida e comparacao automatica contra o ensaio anterior; o diretorio inteiro e apagado no fim"

requirements-completed: []

coverage:
  - id: D1
    description: "H-01: a Conversa cujo Canal e Contato ja estao nas tabelas novas migra com as Mensagens, sem reinserir nem alterar o Canal e o Contato"
    requirement: "UCR-09"
    verification:
      - kind: unit
        ref: "apps/api/src/migracao-crm/mapeador.test.ts#destino que ja esta nas tabelas novas (15-44 Task 1, H-01)"
        status: pass
      - kind: integration
        ref: "apps/api/src/migracao-crm/migrar-entidades.test.ts#Conversa cujo Canal e Contato ja estao nas tabelas novas (15-44 H-01)"
        status: pass
    human_judgment: false
  - id: D2
    description: "H-02: o mesmo criterio de Conversa do CRM antigo em --guardar, --migrar, --seco e --verificar; a 1:1 de Flow fica e sobrevive a repetir"
    requirement: "UCR-09"
    verification:
      - kind: unit
        ref: "apps/api/src/migracao-crm/colecoes.test.ts#ehConversaDoCrmAntigo e o criterio em SQL concorda"
        status: pass
      - kind: integration
        ref: "apps/api/src/migracao-crm/migrar-crm-antigo.test.ts#a Conversa 1:1 do modelo que fica (Flow, Automacao, convite de Grupo) (15-44, H-02)"
        status: pass
    human_judgment: false
  - id: D3
    description: "M-01 e M-04: trava de banco local que olha o host real e dado sujo que nao derruba o Espaco"
    requirement: "UCR-10"
    verification:
      - kind: unit
        ref: "apps/api/src/persistencia/host-local.test.ts"
        status: pass
      - kind: integration
        ref: "apps/api/src/migracao-crm/migrar-entidades.test.ts#dado sujo nao derruba o Espaco (15-44, M-04)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Ensaio sobre a copia de 2026-11-05 com o codigo corrigido, com os mesmos numeros do 15-30 e do 15-34"
    requirement: "UCR-10"
    verification:
      - kind: other
        ref: "15-ENSAIO.md#Ensaio pos-revisao (script descartavel, comparacao automatica por Espaco: igual nos 19)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Roteiro do corte e CONTEXT corrigidos no texto (M-02, M-03, M-05, H-02, L-01, L-08) e Disposicao da revisao"
    requirement: "UCR-09"
    verification: []
    human_judgment: true
    rationale: "Texto de roteiro para o dono executar em producao: so ele (e quem revisar) diz se e claro; nenhum teste afirma isso. Os comandos novos foram rodados sobre as saidas do ensaio (comparacao do passo 7) mas o roteiro inteiro nao foi executado."

duration: 35min
completed: 2026-11-06
---

# Phase 15 Plan 44: fechamento das lacunas da revisao pre-corte Summary

**O `migrar:crm-antigo` deixa de apagar Conversa viva de Flow/Automacao, passa a migrar a Conversa cujo Canal/Contato ja esta nas tabelas novas, a trava "so banco local" olha o host que o `pg` usa (`?host=` recusado) e o roteiro do corte perde as armadilhas da revisao; o ensaio sobre a copia real deu os mesmos numeros do 15-30 e do 15-34.**

## Performance

- **Duration:** ~35 min (a hora de inicio nao foi registrada; estimada pelos relogios dos commits e do gate)
- **Tasks:** 4 (3 TDD com RED commitado antes do GREEN, 1 de roteiro, ensaio e gate)
- **Files modified:** 22 em `apps/` e 5 em `.planning/` (mais 3 arquivos novos)
- **Commits:** 8 (3 RED, 3 GREEN, 2 de documento); medidos com `git rev-list --count d8fe89d..HEAD`, base em `plan_head_before`

## Accomplishments

### Cada achado foi reconfirmado antes de mudar codigo

- **H-01 reproduziu.** Teste em Docker: Conversa cujo Canal so existe em `plataforma.canais` saia de `registros` sem migrar (RED `ee3fa91`: os dois casos de banco e quatro do mapeador falharam; o caso do Canal inexistente ja passava, como deve).
- **H-02 reproduziu.** `startConversation` e `receiveMessage` criam Conversa 1:1 sem `groupIdentifier` com Contato de `plataforma.contatos`; `colecoes.ts` so protegia Grupo (RED `8a20aee`: 20 testes falhando).
- **M-01 reproduziu.** `hostEhLocal` antigo devolvia `true` para `postgres://u:p@localhost:5432/postgres?host=db.exemplo.com` (RED `3f21567`).
- **M-04 reproduziu.** Chaves de de-para colidiam com Identificador sem id e a Mensagem sem id passava ao `insert` (RED `3f21567`).

### Task 1 (H-01, traçador) — `ee3fa91` RED, `714cffa` GREEN

`crm-novo.ts` le os Canais (com o tipo) e os Contatos que as Conversas e os Negocios antigos citam; `planejarMigracao` os aceita como destino valido sem inserir nem alterar; `id-ja-existe` segue no relatorio sem tirar o id do destino. O tipo do Canal existente e lido da tabela e fica no mapa, mas o mapeamento das Mensagens hoje nao ramifica por tipo (so usa `canal_id`): o campo existe para quando precisar.

### Task 2 (H-02) — `8a20aee` RED, `61f5b88` GREEN

`ehConversaDoCrmAntigo` (TS) e `SQL_E_CONVERSA_DO_CRM_ANTIGO` (SQL, `exists` sobre `contacts` do mesmo `workspace_id`) sao o unico criterio de `guardar.ts` (copiar, conferir, contar, apagar), do mapeador, do `--seco` e do `--verificar` (b). `colecoes.test.ts` roda a mesma tabela de 13 casos nas duas implementacoes. O resultado e o `--seco` contam quantas ficaram e por que (Grupo / 1:1 de Flow, Automacao ou convite). Provado em Docker: `--guardar`, `--migrar`, repetir e a Conversa que nasce depois do corte nao apagam a Conversa de Flow, e o `--verificar` passa.

### Task 3 (M-01 e M-04) — `3f21567` RED, `9e8d05e` GREEN

`persistencia/host-local.ts` (puro, sem conectar, sem dependencia nova). Tambem `Object.hasOwn` na CLI (L-07). Mapeador: `mensagem-sem-id` e chave aninhada `<pai>/sem-id#<posicao>`.

### Task 4 — `5b2990b` (roteiro, CONTEXTs, ensaio), `bf6f182` (Disposicao, PROVAS)

- **Ensaio pos-revisao** (`9e8d05e`, mesma copia de 2026-11-05, script descartavel reescrito fora do repositorio, contêiner `crm-n1-pg-1544` na porta 55744, `trap`): 2128 = 2128 em cada um dos 19 Espacos; `registros` 23952 → 21838; 14 Conversas de Grupo ficam; Pasta em 16 Espacos com 18 Tarefas em 4 Listas; `ws_n1` pelos dois caminhos do Funil (3 Funis, 7 Etapas e 2 linhas de `crm_de_para` com `--funil=migrar`; nada novo com `guardar`); Nao migrados 160/16, 141/15 e nenhum; as 60 e tantas chamadas do script saíram com 0; 0 e-mails e 0 telefones nas saidas. A tabela por Espaco (revisao, registros, nove colecoes, Conversas que ficam) comparou **igual** nos 19 (a unica diferenca bruta foi a ordem de `ws_spike` e `ws_spike_10x` na saida do `psql`, resolvida ordenando os dois lados). Nada mudou, entao nao parei.
- **15-REVIEW.md** ganhou a "Disposicao" de cada achado; **15-PROVAS.md** cita a revisao.
- **Gate:** `npm run check` com as duas URLs de um Postgres 16 de Docker migrado ate a 012 (contêiner novo, `crm-n1-pg-1544`): typecheck, lint, tokens, contratos e testes **verdes, `CHECK_EXIT=0`**, sem nenhum flake de baseline nesta rodada (api 195 arquivos / 2495 testes passados, 2 arquivos e 21 testes pulados como no baseline; web 132 / 1298; dominio 129 / 2384). O contêiner foi apagado por `trap`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] O teste de mapeador "Conversa sem Contato..." passou a descrever o comportamento certo**
- **Found during:** Task 2
- **Issue:** com o criterio de H-02, a Conversa sem `contactId` ou com `contactId` fora de `contacts` fica em `registros` e nao entra no mapeador; o teste antigo esperava `conversa-sem-contato` para ela.
- **Fix:** o teste foi reescrito (so `conversa-sem-canal-migrado` e `canal-sem-destino` sao relatados) e um teste novo prova que a 1:1 de Flow nao migra mesmo com Canal e Contato existentes. O teste de `--verificar` "Conversa sem Grupo em registros" passou a recolocar o Contato antigo junto com a Conversa.
- **Files modified:** `apps/api/src/migracao-crm/mapeador.test.ts`, `migrar-crm-antigo.test.ts`
- **Commit:** `61f5b88`

**2. [Rule 3 - Blocking] `relatorio.test.ts` precisou do campo novo `conversasDeFlow`**
- **Found during:** Task 2
- **Issue:** `EntradaDoRelatorio` e `EntradaDoResumo` ganharam `conversasDeFlow` (obrigatorio de proposito, para nao omitir a contagem em silencio).
- **Fix:** as duas entradas de teste passaram a trazer o campo.
- **Files modified:** `apps/api/src/migracao-crm/relatorio.test.ts`
- **Commit:** `61f5b88`

**3. [Rule 3 - Blocking] O teste de texto que barra regra de host propria nao pode proibir `new URL(`**
- **Found during:** Task 3
- **Issue:** `crm-demo.ts` usa `new URL(...)` para ler o JSON do demo.
- **Fix:** o teste procura `.hostname` em vez de `new URL(`.
- **Files modified:** `apps/api/src/persistencia/host-local.test.ts`
- **Commit:** `9e8d05e`

**4. [Rule 2 - Missing critical] CONTEXTs de `bootstrap` e `persistencia` atualizados**
- **Found during:** Task 4
- **Issue:** `bootstrap/CONTEXT.md` dizia que a regra de host era "copiada" de `testes/banco-crm.ts` e `persistencia/CONTEXT.md` nao conhecia `host-local.ts`.
- **Fix:** ambos descrevem a regra nova.
- **Commit:** `5b2990b`

**Total deviations:** 4 (1 bug de teste, 2 bloqueios, 1 contexto). **Impacto:** nenhum muda o escopo; os tres primeiros sao consequencia direta da correcao, o quarto e documentacao exigida pelas regras do projeto.

### Mudancas de comportamento que o dono deve saber

- Uma `DATABASE_URL` local com **qualquer** query (por exemplo `?sslmode=disable`) agora e recusada pelo demo e pelos testes de banco. Os contêineres do projeto nao usam query.
- `[::1]` passou a ser aceito como local (o plano pediu).
- Conversa 1:1 sem `contactId` (inclusive uma antiga com `unresolvedIdentifier`) fica em `registros` e nunca migra. Na copia de 2026-11-05 nao ha nenhuma; no `ws_n1` o `--seco` do dia mostra se ha.
- `ws_n1` hoje pode ter Conversa de Canal criado na Fase 8: com H-01 ela migra em vez de sumir; o roteiro manda rodar o `--seco` de novo imediatamente antes do 6c.

## Known Stubs

Nenhum. (Procurei `TODO`, `FIXME`, `placeholder` e valores vazios que cheguem a UI nos arquivos do plano.)

## Issues Encountered

- O ensaio mostrou, na comparacao automatica, uma diferenca que era so de ordenacao do `psql` (`ws_spike` antes de `ws_spike_10x`); ordenados os dois lados, os 19 Espacos sao iguais.
- O gate rodou em ~3,5 min nesta maquina (o baseline do orquestrador fala em 13 a 17 min); passou inteiro, sem flake e sem pulo alem dos 2 arquivos de baseline. Nao foi preciso provar flake isolado porque nada falhou.

## Open Items (WINDOWS, linhas `deviation` novas)

- limitacao de H-02 (Contato com id nos dois modelos; 1:1 sem `contactId`) e a relacao com o aviso #73;
- `HOST_LOCAL` sem ancora em `conexao.ts` (TLS), resto de M-01;
- L-03 (`syncIdSequence` pode recuar depois do corte), L-04 (ciclo matriz/filial na fronteira de 500), L-05 e L-06 (Etapa sem id e instante cru no Funil).

Nenhuma linha antiga de WINDOWS foi marcada como corrigida: nenhuma delas e resolvida por este plano (as de CRM antigo dependem do corte, 15-35).

## Next Phase Readiness

O corte (15-35) depende deste plano e e so do dono. Antes do `--migrar` do `ws_n1`, ele roda o `--seco` de novo (passo 6c do `15-CORTE.md`): e a verificacao do dado de hoje, que nem a revisao nem o ensaio viram. Os requisitos UCR-09 e UCR-10 nao foram marcados como completos: o 15-35 tambem os declara e ainda nao tem SUMMARY (`requirements.ready-ids`: 0/2 prontos).

## Self-Check: PASSED

Conferido por comando: `apps/api/src/persistencia/host-local.ts`, `host-local.test.ts` e `apps/api/src/migracao-crm/colecoes.test.ts` existem; os commits `ee3fa91`, `714cffa`, `8a20aee`, `61f5b88`, `3f21567`, `9e8d05e`, `5b2990b` e `bf6f182` sao ancestrais do `HEAD`; "Ensaio pós-revisão" e "Disposição" aparecem uma vez e duas vezes nos arquivos certos; o `grep` de e-mail e `+55` devolve 0 em `15-ENSAIO.md`, `15-CORTE.md`, `15-PROVAS.md` e `15-REVIEW.md`; nenhum contêiner `crm-n1-pg-1544` existe; o diretorio descartavel do ensaio (script, ponto de restauracao e saidas) foi apagado.
