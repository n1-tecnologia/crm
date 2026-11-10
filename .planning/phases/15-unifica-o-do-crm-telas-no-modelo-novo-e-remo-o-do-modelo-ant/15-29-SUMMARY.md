---
phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
plan: 29
subsystem: api
tags: [bootstrap, crm-demo, desenvolvimento, host-local, docker, tdd, ucr-11]
status: complete

requires:
  - phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
    provides: "mapeador planejarMigracao e a fixture congelada do seed (15-28), tabelas 007/008/011/012"
provides:
  - "crm-demo.json: Funis, Etapas, Canais, Contatos, Empresas, vinculos, Negocios, Conversas e Mensagens do seed antigo ja nas colunas das tabelas novas, com os ids antigos"
  - "carregarCrmDemo(cliente, { workspaceId }): carga numa transacao so, colunas constantes por tabela, valores por $n, na ordem das FKs"
  - "recusas: host que nao e localhost/127.0.0.1 (antes de qualquer consulta), Espaco fora de ^ws_[a-z0-9_]+$, inexistente, ou que ja tem Contato"
  - "npm run bootstrap:crm-demo -w @n1/api -- --espaco <id> (CLI que confere o host antes de abrir o pool)"
affects: [15-31, 15-34]

plan_head_before: 930e6a6e6f1c71f634c7bcf008a3b3be2dcf6c1f
plan_head_after: 1582f4b2ed98b3ae1fb203b9658912698f94e301
commits: 6

actuals:
  tokens: 56000
  tasks: 2
  commits: 6

tech-stack:
  added: []
  patterns:
    - "fixture JSON gerada uma vez por script descartavel + carregador com lista de colunas constante e jsonb_to_recordset (o dump SQL nao serve: PK e FKs compostas levam workspace_id)"
    - "recusa de banco remoto como funcao pura, chamada na CLI antes do pool e de novo dentro do carregador antes da primeira consulta; o teste prova com um cliente que explode se for usado"
    - "conferencia de 'Espaco sem Contato' dentro da transacao, com a linha do Espaco travada (for update): duas cargas simultaneas nao passam juntas"

key-files:
  created:
    - apps/api/src/bootstrap/crm-demo.json
    - apps/api/src/bootstrap/crm-demo.ts
    - apps/api/src/bootstrap/crm-demo.cli.ts
    - apps/api/src/bootstrap/crm-demo.test.ts
  modified:
    - apps/api/package.json
    - apps/api/src/bootstrap/CONTEXT.md
    - apps/api/CONTEXT.md
    - .planning/WINDOWS.md

key-decisions:
  - "Todas as recusas do demo (host, Espaco invalido, inexistente, com Contatos) lancam RecusaDoDemo e a CLI sai com 2; nao ha o molde 'criado: false' do gestao.ts, porque 'recusou' tem de ser distinguivel de 'carregou' sem olhar texto"
  - "O carregador confere o host por conta propria (DATABASE_URL, ou urlDoBanco no teste), alem da CLI: quem importar carregarCrmDemo de outro lugar tambem nao grava em banco remoto"
  - "As Etapas tem ids fixos no JSON (gerados uma vez); crm_de_para fica vazio porque o demo nao e uma migracao"
  - "Funil padrao do demo so entra padrao se o Espaco ainda nao tem um (funis_padrao_uq); a ordem dos Funis continua depois dos que o Espaco ja tenha"
  - "ws_n1 nao e recusado pelo nome: num banco local ele pode ser o Espaco de dev; a barreira contra producao e o host"

requirements-completed: []

coverage:
  - id: D1
    description: "Um Espaco semeado com buildSeed() e carregado pelo demo tem, em todas as tabelas, as contagens do crm-demo.json (4 Funis, 23 Etapas, 3 Canais, 39 Contatos, 12 Empresas, 19 Negocios, 16 Conversas, 62 Mensagens...) e a Caixa tem Conversas"
    requirement: UCR-11
    verification:
      - kind: integration
        ref: "apps/api/src/bootstrap/crm-demo.test.ts#o Espaço semeado com buildSeed() ganha as linhas do demo em todas as tabelas, e a Caixa tem Conversas"
        status: pass
    human_judgment: false
  - id: D2
    description: "Todo Vinculo do seed para Contato, Empresa, Negocio ou Conversa que o demo carrega acha o registro nas tabelas; o que nao acha esta em naoMigrados"
    requirement: UCR-11
    verification:
      - kind: integration
        ref: "apps/api/src/bootstrap/crm-demo.test.ts#todo Vínculo do seed para Contato, Empresa, Negócio ou Conversa que o demo carrega acha o registro nas tabelas"
        status: pass
    human_judgment: false
  - id: D3
    description: "Borda UCR-11 (idempotencia): a segunda carga no mesmo Espaco recusa ('o Espaço já tem Contatos') e nao muda nenhuma contagem; a CLI sai com 2 na segunda execucao"
    requirement: UCR-11
    verification:
      - kind: integration
        ref: "apps/api/src/bootstrap/crm-demo.test.ts#a segunda carga no mesmo Espaço recusa; #principal carrega o demo num Espaço semeado e a segunda execução sai com 2 sem duplicar"
        status: pass
    human_judgment: false
  - id: D4
    description: "Banco remoto e recusado antes de qualquer consulta (cliente que explode se usado; URL remota falsa nunca conectada), na funcao pura, no carregador e na CLI (saida 2, sem usuario nem senha no log); Espaco invalido e inexistente tambem"
    requirement: UCR-11
    verification:
      - kind: unit
        ref: "apps/api/src/bootstrap/crm-demo.test.ts#o host do banco: só local; #principal: a CLI devolve o código de saída (rodam sem banco)"
        status: pass
      - kind: integration
        ref: "apps/api/src/bootstrap/crm-demo.test.ts#Espaço que não existe no banco local; #principal --espaço de um Espaço inexistente no banco local sai com 2"
        status: pass
    human_judgment: false
  - id: D5
    description: "A Caixa de Entrada de desenvolvimento com o demo carregado e aceitavel como substituta da do seed antigo (mais magra: sem temperatura, Tags, Canal do LinkedIn e do chat do site)"
    verification: []
    human_judgment: true
    rationale: "Os testes provam as linhas e os Vinculos, nao se a Caixa que sobra e boa para quem desenvolve; nenhuma tela foi aberta sobre o Espaco carregado (WINDOWS, unrun-verify)."

duration: 6min
completed: 2026-11-06
---

# Phase 15 Plan 29: Demo do CRM em desenvolvimento Summary

**`npm run bootstrap:crm-demo -w @n1/api -- --espaco <id>` carrega num Espaço local o CRM de mentira do seed antigo (39 Contatos, 12 Empresas, 4 Funis com 23 Etapas, 19 Negócios, 3 Canais, 16 Conversas, 62 Mensagens) nas tabelas do CRM novo com os ids antigos, recusa banco que não seja localhost/127.0.0.1 antes de consultar, Espaço inválido, inexistente ou que já tenha Contato, e não duplica na segunda execução.**

## Performance

- **Duration:** ~6 min (19:54 a 20:00 UTC)
- **Tasks:** 2 (TDD: 2 RED + 2 GREEN, mais dois commits de CONTEXT.md)
- **Files:** 4 criados e 4 alterados (mais este SUMMARY)

## Accomplishments

- **`crm-demo.json`.** Gerado UMA vez por um script descartável fora do repositório que lê `fixtures/crm-antigo-do-seed.json` (15-28), roda `planejarFunis` e `planejarMigracao` e grava `{ origem, tabelas, naoMigrados }`: as linhas já nas colunas novas, sem `workspace_id`, Negócios com o id novo (fixo) da Etapa, e os 160 itens não migrados só como coleção, id e categoria. As contagens batem com as do teste de integração do 15-28. Nada de `~/n1-ensaio` nem de produção.
- **`carregarCrmDemo`.** `COLUNAS_POR_TABELA` constante (14 tabelas), um `insert ... select` por tabela e por pedaço de 500 linhas com `jsonb_to_recordset`, na ordem das FKs, numa transação com a linha do Espaço travada; o `workspace_id` é o argumento. Contatos sobreviventes antes dos mesclados. Não importa nada de `migracao-crm/` (`grep -c` = 0) nem do modelo antigo.
- **Recusas.** `exigirBancoLocal` (pura) é chamada primeiro dentro do carregador; `validarEspacoDoDemo` barra o formato; "Espaço não encontrado" e "o Espaço já tem Contatos" saem dentro da transação, com rollback.
- **CLI.** `crm-demo.cli.ts` no molde de `migrar.cli.ts` (`lerArgumentos` pura, `principal` devolve o código de saída: 0 ok, 2 recusa, 1 inesperado). A checagem de host acontece antes de `pool()`. Imprime só host:porta e Espaço, nunca usuário nem senha. Script `bootstrap:crm-demo` no `package.json`.
- **Execução real em Docker.** `npm run bootstrap:crm-demo -- --espaco ws_dev_manual` num Espaço criado à mão carregou (exit 0); a segunda recusou (exit 2); `DATABASE_URL=postgres://u:p@db.exemplo.com/x` recusou sem conectar (exit 2); `--espaco ws_n1` num banco sem ele disse "Espaço não encontrado" (exit 2).
- **Documentação.** `apps/api/src/bootstrap/CONTEXT.md` ganhou a seção do demo (comando, as três recusas, que é só de desenvolvimento, de onde vêm as linhas, como grava, Canais `desconectada`); `apps/api/CONTEXT.md` cita o comando.

## Task Commits

1. **Task 1 (tracer):** RED `26167e1` (test: JSON + esqueleto + 3 casos) -> GREEN `c04c289` (feat: `carregarCrmDemo`)
2. **Task 2:** RED `46dcf34` (test: recusas e CLI + esqueleto da CLI) -> GREEN `4bb3f68` (feat: CLI e script do `package.json`)
3. Extras: `32ec477` docs (CONTEXT do bootstrap), `1582f4b` docs (CONTEXT da api)

**Plan metadata:** commit `docs(15-29)` seguinte (SUMMARY e WINDOWS.md), depois o de STATE/ROADMAP.

## TDD Gate Compliance

`test(15-29)` precede `feat(15-29)` nas duas tarefas; nenhum REFACTOR separado (o ajuste de um comentário que citava a pasta proibida entrou no GREEN da Task 2). `workflow.tdd_mode` é `false`: o classificador `gsd_run check tdd-red-evidence` não foi usado e a saída do vitest foi lida à mão.

- **RED 1** (`26167e1`): os 3 casos de Docker falharam pela asserção contra um `carregarCrmDemo` que não grava (contagens `{}` no lugar das do JSON, nenhum Vínculo achado, a segunda carga resolveu em vez de rejeitar). Avaliação semântica: o alvo executou e falhou no comportamento planejado; o JSON já estava no commit porque o teste o lê.
- **RED 2** (`46dcf34`): 6 de 16 falharam pela asserção contra a CLI esqueleto (`lerArgumentos` neutro, `principal` sempre 0); os 10 restantes (host, formato do Espaço, "Espaço não encontrado" no carregador) **já passavam**, porque `exigirBancoLocal`, `validarEspacoDoDemo` e as recusas dentro do carregador foram escritos no GREEN da Task 1 (o plano as põe entre as truths do carregador). Essa parte do RED 2 é de proteção, não de descoberta; está registrado aqui, não escondido.

## Verificação

Num contêiner Postgres 16 NOVO (`crm-n1-pg-1529`, porta 55729, migrações 001-012, parado e removido no fim), com as duas URLs explícitas:

- `vitest run src/bootstrap/crm-demo.test.ts`: **16 de 16**, 0 pulados (modo `verbose` conferido).
- `vitest run src/bootstrap/ src/persistencia/regime-dos-chamadores.test.ts src/sem-crm-antigo.test.ts src/sem-listas-espelho.test.ts`: **11 arquivos, 57 testes, 0 falhas** (as guardas que varrem o código não reclamaram dos arquivos novos).
- `DATABASE_URL= DATABASE_URL_MIGRACAO= vitest run src/bootstrap/crm-demo.test.ts` (o `<automated>` da Task 2): 10 passam, 6 de Docker pulam por desenho; `cd apps/api && npx tsc --noEmit`: 0.
- Aceite por grep: `test -s crm-demo.json` ok; `grep -c migracao-crm crm-demo.ts` = 0; `grep -c '"bootstrap:crm-demo"' package.json` = 1.
- A porta e o host nunca aparecem escritos no teste: tudo vem de `DATABASE_URL` (a lição do 15-27); o único host fixo é o remoto falso `db.exemplo.com`, que nunca é conectado.
- Nenhum `.env` lido por este agente, nenhum `npm run build`, nenhum comando contra banco real, nenhum contêiner `supabase_*` tocado, `~/n1-ensaio` intocado.

### Como o `crm-demo.json` foi gerado (T-15-71)

Script descartável em `…/scratchpad/gerar-demo/gerar-crm-demo.ts` (fora do repositório, não commitado): `vite-node <script> -- <caminho absoluto de fixtures/crm-antigo-do-seed.json> <caminho absoluto de apps/api/src/bootstrap/crm-demo.json>`, a partir de `apps/api`. Ele importa `mapeador.ts` e `funil.ts` por caminho absoluto, roda `planejarFunis(funisAntigos, [], "migrar")` e `planejarMigracao(antigas, undefined, { funisMigrados })` e troca a Etapa antiga do Negócio pelo UUID gerado para a Etapa nova. Saída: funis 4, etapas 23, canais 3, contatos 39, contato_identificadores 75, empresas 12, empresa_identificadores 24, contato_empresa 30, negocios 19, conversas 16, mensagens 62, contato_consentimentos 45; 160 não migrados.

## Decisions Made

Ver `key-decisions` no cabeçalho. A que mais pesa: a barreira contra produção é o host, não o nome do Espaço, e ela vale no carregador, não só na CLI.

## Deviations from Plan

Nenhuma regra 1-4 acionada. Decisões nossas fora do texto do plano:

- O plano dizia "recusa" sem tipo; todas as recusas lançam `RecusaDoDemo` (a CLI as traduz em saída 2).
- `carregarCrmDemo` ganhou as opções `urlDoBanco` e `demo` (o plano só citava `workspaceId`): servem a provar a recusa de host sem conectar e a injetar um JSON mínimo.
- O carregador também confere o host por si, além da CLI (o plano pedia a checagem "antes de abrir o pool" na CLI e o teste da função pura).
- `crm_de_para` não é carregado (o demo não é uma migração).

**Total deviations:** 0 auto-fixed. **Impact:** nenhum amplia escopo.

## Known Stubs

Nenhum. (O `crm-demo.json` é dado de demonstração por desenho, não um stub.)

## Linhas em `.planning/WINDOWS.md` (fase 15)

Nenhuma linha existente foi resolvida por este plano (a #53, do 15-28, descreve o que o `--migrar` deixa de fora e segue aberta). **Novas, abertas (3):**

- **deviation** (`crm-demo.test.ts`): o teste dos Vínculos lê `buildSeed().links`; quando o 15-31 tirar o CRM e os Vínculos do seed, `procurados` fica 0 e o caso quebra. O 15-31 precisa trocar a fonte dos Vínculos ou ajustar o caso sem perder a prova de que os ids preservados acham o registro.
- **deviation** (`crm-demo.json`): o demo traz só o que o mapeador migra (sem temperatura e Tags, sem Canal do LinkedIn e do chat do site e as Conversas deles: 3 Canais e 16 Conversas contra 5 e 23 do seed antigo; Canais `desconectada`).
- **unrun-verify** (`crm-demo.cli.ts`): provado só em Docker; nenhuma tela do `apps/web` foi aberta sobre o Espaço carregado.

## Issues Encountered

- O primeiro `sed` para trocar o comentário que citava `migracao-crm/` falhou (a barra dentro do padrão); o commit do GREEN 1 saiu com o comentário antigo e a correção entrou no GREEN 2. O `grep -c migracao-crm` final é 0.
- Nada mais: nenhum disco apertado, nenhum contêiner ficou de pé.

## User Setup Required

None - no external service configuration required. Para usar o demo: `DATABASE_URL=postgres://…@localhost:…/postgres npm run bootstrap:crm-demo -w @n1/api -- --espaco <id>`, com o Espaço já criado e sem Contatos.

## Next Phase Readiness

- Pronto para o 15-31 (tirar o CRM antigo do seed): o demo carrega com os ids que os Vínculos, a `provenance` e os escopos que o seed novo guarda em `registros` esperam. O 15-31 deve tratar a linha de WINDOWS sobre a fonte dos Vínculos no teste.
- `requirements-completed` fica vazio de propósito: UCR-11 também é declarado pelo 15-31 e `requirements.ready-ids` disse 0/1 pronto; o 15-31 o marca ao terminar.

---
*Phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant*
*Completed: 2026-11-06*

## Self-Check: PASSED

- Arquivos criados conferidos no disco (`[ -f ]`): os 4 de `key-files.created`.
- Commits `26167e1`, `c04c289`, `46dcf34`, `4bb3f68` e `32ec477` são ancestrais do HEAD; `git log --grep` encontra 2 `test(15-29)` e 2 `feat(15-29)`; `git rev-list --count 930e6a6..HEAD` = 6.
- Os `<automated>` das duas tarefas e o `<verification>` do plano reexecutados num contêiner novo: todos passam.
