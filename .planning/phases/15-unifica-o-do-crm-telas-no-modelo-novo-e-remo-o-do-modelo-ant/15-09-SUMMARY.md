---
phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
plan: 09
subsystem: api
tags: [atividade, auditoria, sucessao, conversa, cursor, postgres, tdd, ucr-03, ucr-02]

requires:
  - phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
    provides: "15-03: passarAoSucessor passa a Conversa ao Sucessor; 15-04: crm_atividades e registrarAtividade; 15-37: GET /atividades e useAtividadesDoCrm"
provides:
  - "Mover, atribuir (e tirar o Atribuido), lixeira, restaurar, estrela, leitura, transferir Identificador e consentimento gravam em crm_atividades no mesmo commit do gesto"
  - "Estrela e leitura so gravam quando mudam; duas estrelas iguais ao mesmo tempo gravam uma linha (trava consultiva por Espaco, Conversa e Membro)"
  - "passarAoSucessor(cliente, ws, membro, sucessor, ator) grava uma Atividade por Contato, Empresa, Negocio e Conversa passados (insert ... select por tabela)"
  - "Cursor composto (ate + ateId) em GET /atividades; registrarAtividade grava em em milissegundos"
  - "A Auditoria soma state.activity e as paginas do CRM novo, com os mesmos filtros"
affects: [15-15, 15-21, 15-36]

plan_head_before: abf8757dd2422f8208a0e15bea66655771ab8623
plan_head_after: c1ac53ac65f0dd4671f5c4a8e60a5dd4c129cc6d

actuals:
  tokens: 13300
  tasks: 3
  commits: 9

tech-stack:
  added: []
  patterns:
    - "Atividade do gesto no mesmo PoolClient do comTransacao, depois da escrita e so no caminho de sucesso"
    - "Valor anterior lido sob pg_advisory_xact_lock para gravar Atividade so quando algo mudou"
    - "Cursor composto (em, id) com em truncado a milissegundos na escrita, igual ao at do ActivityRecord"
    - "Estado derivado durante a renderizacao (sem efeito) para acumular paginas da fonte nova na Auditoria"

key-files:
  created:
    - apps/web/src/features/configuracoes/auditoria-do-crm.test.tsx
  modified:
    - apps/api/src/servicos/crm/conversas.ts
    - apps/api/src/servicos/crm/contatos.ts
    - apps/api/src/servicos/crm/consentimentos.ts
    - apps/api/src/repositorios/crm/sucessao.ts
    - apps/api/src/repositorios/crm/marcacoes.ts
    - apps/api/src/repositorios/crm/referencias.ts
    - apps/api/src/repositorios/crm/atividades.ts
    - apps/api/src/rotas/crm/atividades.ts
    - apps/api/src/rotas/gesto-no-crm/membros.ts
    - packages/dominio/src/crm/atividades.ts
    - apps/web/src/app/(shell)/configuracoes/auditoria/page.tsx
    - apps/web/src/dados/crm/atividades.ts

key-decisions:
  - "D-15-09: o escopo e exatamente o da lista (mais a sucessao); Negocio, Contato e Empresa do CRM novo nao gravam Atividade nesta fase (pergunta ao dono em WINDOWS.md #26)"
  - "WINDOWS #15 resolvido com evidencia: a sucessao grava varias linhas no mesmo instante e o cursor so de tempo as perde na fronteira da pagina (teste (g): 0 de 5 depois da 1a pagina); trocado por cursor composto (em, id), ate sozinho continua valendo"
  - "em passa a ser gravado em milissegundos (MOMENTO_DO_GESTO): o at do ActivityRecord tem milissegundos e o cursor composto so e exato se em nao guardar microssegundos"
  - "marcar roda em transacao com trava consultiva por (Espaco, Conversa, Membro): sem ela, duas estrelas iguais em paralelo gravariam duas linhas (provado por mutacao)"
  - "O detalhe da transferencia e so o TIPO do Identificador; o do consentimento e finalidade, tipo de Canal e decisao; nunca valor de Identificador, texto de Mensagem nem evidencia"

patterns-established:
  - "registrarAtividadeDaConversa(cliente, membro, conversa, acao, {antes, depois}): um ponto so para a Atividade dos gestos de Conversa"
  - "insert ... select antes do update para registrar o que muda de mao em lote, no mesmo statement-level de quem executa"

requirements-completed: [UCR-03, UCR-02]

coverage:
  - id: D1
    description: "Mover uma Conversa grava a Atividade com os nomes de origem e destino e ela aparece na Auditoria misturada a state.activity"
    requirement: UCR-03
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/conversas.test.ts#mover grava 'Conversa movida para outro Contato'"
        status: pass
      - kind: unit
        ref: "apps/web/src/features/configuracoes/auditoria-do-crm.test.tsx#(a), (b), (c)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Atribuir, tirar o Atribuido, lixeira, restaurar, transferir Identificador e consentimento gravam uma linha cada; o gesto recusado nao grava"
    requirement: UCR-03
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/conversas.test.ts#Atividade dos gestos (15-09); contatos.test.ts#(a2),(a3); consentimentos.test.ts#(a2),(a3)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Estrela e leitura so gravam quando mudam; duas estrelas iguais ao mesmo tempo gravam uma linha"
    requirement: UCR-03
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/conversas.test.ts#estrela so grava quando o valor muda; duas estrelas iguais ao mesmo tempo; leitura so grava quando o lidaAte avanca"
        status: pass
    human_judgment: false
  - id: D4
    description: "A sucessao grava uma Atividade por Contato, Empresa, Negocio e Conversa passados, com o ator de quem removeu; repetir e rollback nao deixam linha"
    requirement: UCR-02
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/sucessao.test.ts#passarAoSucessor — Atividade por registro passado; apps/api/src/rotas/operacoes.test.ts#o Administrador remove o Membro"
        status: pass
    human_judgment: false
  - id: D5
    description: "O cursor composto (ate + ateId) atravessa a fronteira da pagina sem pular nem repetir linhas do mesmo instante; ateId sem ate e 400"
    requirement: UCR-03
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/atividades.test.ts#(g); apps/api/src/rotas/crm/atividades.test.ts; packages/dominio/src/crm/atividades.test.ts"
        status: pass
    human_judgment: false
  - id: D6
    description: "A Auditoria no navegador mostra as duas fontes, o Mostrar mais traz a pagina seguinte e a falha da fonte nova avisa sem esconder a antiga"
    requirement: UCR-03
    verification:
      - kind: unit
        ref: "apps/web/src/features/configuracoes/auditoria-do-crm.test.tsx#(d), (e)"
        status: pass
    human_judgment: true
    rationale: "Componente testado com hook falso; a leitura e o aspecto da tela com dados reais (ordem, rotulos, 'Mostrar mais' com muitas paginas) nao foram vistos em navegador"

duration: 41min
completed: 2026-11-06
status: complete
---

# Phase 15 Plan 09: Os gestos do CRM novo aparecem na linha do tempo Summary

**Mover, atribuir, lixeira, restaurar, estrela, leitura, transferir Identificador, consentimento e a sucessao gravam em `crm_atividades` no mesmo commit do gesto (estrela e leitura so quando mudam), e a Auditoria passa a mostrar `state.activity` e o CRM novo juntos, paginando por cursor composto `(em, id)`.**

## Performance

- **Duration:** 41 min
- **Tasks:** 3 (Task 1 tracador, Tasks 2 e 3 auto; todas TDD) mais um desvio de cursor
- **Commits:** 9 (4 RED, 4 GREEN, 1 docs)
- **Files:** 1 criado, 23 alterados (testes e CONTEXT incluidos)

## Accomplishments

- **Tracador (Task 1):** `mover` grava "Conversa movida para outro Contato" com o titulo da Conversa e os nomes dos Contatos de origem e destino em `antes`/`depois`; a Auditoria soma `useAtividadesDoCrm` a `state.activity`, mistura por `at`, e aplica ator, tipo de objeto, resultado e busca as duas fontes. "Mostrar mais" avanca o cursor composto da ultima linha da pagina so quando a fatia seguinte nao cabe no que ja veio.
- **Task 2:** atribuir (com `antes`/`depois` pelos nomes de exibicao do Membro ou Agente), tirar o Atribuido, lixeira, restaurar, transferir Identificador (na origem; `depois` = nome do destino, `detalhe` = so o tipo do Identificador) e consentimento (`detalhe` = finalidade, tipo de Canal e decisao, sem evidencia). `marcar` passou a rodar em `comTransacao`: a estrela so grava quando troca; a leitura so quando o `lidaAte` avanca por cima de Mensagem recebida (`temRecebidaEntre`). O valor anterior e lido sob `pg_advisory_xact_lock` por (Espaco, Conversa, Membro).
- **Task 3:** `passarAoSucessor` ganhou o `ator` (quem removeu, vindo da sessao em `AO_CONFIRMAR_DOS_MEMBROS`) e faz um `insert ... select` por tabela antes de cada `update`. Repetir nao acha mais nada; o rollback leva as linhas.
- **Cursor composto (desvio, ver abaixo):** `GET /atividades?ate=&ateId=` e `FiltroDeAtividades.ateId`.

## TDD

Sem `workflow.tdd_mode` e sem o classificador `tdd-red-evidence` (o plano e `type: execute`); a avaliacao do RED foi semantica, sobre a saida do vitest.

- **RED cursor (`726cde5`):** (g) cinco Atividades no mesmo instante: o cursor so de tempo devolveu 0 linhas depois da 1a pagina (a limitacao) e o laco com `ate + ateId` devolveu 2 de 5 (o `ateId` era ignorado); mais o caso do dominio ("ateId vem junto de ate"). Falha pela asserção do comportamento planejado.
- **RED Task 1 (`d87c0f6`):** `mover` deixou 0 linhas onde se esperava 1; na web, 5 casos falharam (so a antiga na tela; o tipo "Conversa" nao existe no filtro; "Mostrar mais" nao chamava o hook com cursor; sem aviso de falha). Primeira tentativa foi invalida (fixture sem `next/navigation`: "app router to be mounted"); corrigida antes de commitar, ate os 5 falharem por asserção.
- **RED Task 2 (`5f9289d`):** 7 casos falharam por linha ausente em `crm_atividades`; os de recusa passaram de imediato e ficam como guarda do caminho de sucesso.
- **RED Task 3 (`2ccca88`):** a sucessao devolveu `[]` onde se esperavam 5 linhas; "repetir" e "rollback" passaram de imediato (guardas). Houve uma falha de fixture no meio (dois `describeComBanco` no mesmo arquivo: o `afterAll` do primeiro encerra o pool; o novo bloco foi aninhado) e outra de dado (indice unico de Conversa aberta por par; outro Contato para a Conversa do Agente).
- **GREEN:** `2b55f50` (cursor), `7c7cac8` (Task 1), `6cf9700` (Task 2), `a2563df` (Task 3).
- **Mutacao:** sem `pg_advisory_xact_lock`, o caso "duas estrelas iguais ao mesmo tempo" falha (`expected [ {…} ] to deeply equal []`): a trava e o que faz a segunda ler o valor da primeira. Restaurada em seguida. (Um primeiro teste com `Promise.all` passava mesmo sem a trava, entao foi trocado por dois clientes com a transacao de A aberta, no molde de `duas-conexoes`.)
- **REFACTOR:** sem commit; so o renome `atividadeDaConversa` para `registrarAtividadeDaConversa` (junto do GREEN da Task 2).

## Verification

Postgres 16 descartavel `crm-n1-pg-1509` (porta 55709), nunca o `.env`, com `DATABASE_URL` e `DATABASE_URL_MIGRACAO` explicitas, migracoes 001 a 012:

- `servicos/crm/conversas.test.ts`, `contatos.test.ts`, `consentimentos.test.ts`, `sucessao.test.ts`, `atividades.test.ts`, `rotas/operacoes.test.ts`: passam.
- `src/servicos src/rotas src/repositorios src/persistencia` da api: 1252 passam, 2 falham (`outbox-worker.test.ts`, casos (i)/(j) e, num container novo isolado, (h)/(k): o flake de baseline conhecido; este plano nao toca o outbox).
- `apps/web` inteiro (1155) e `packages/dominio` inteiro (2383) passam; `tsc --noEmit` dos tres workspaces sai com 0; `eslint` nos arquivos da web alterados sai limpo (um `setState` em `useEffect` foi trocado por estado derivado na renderizacao por causa do `react-hooks/set-state-in-effect`).
- Criterios de aceite: `ACOES_DO_CRM.conversaMovida` em `conversas.ts` (1), `useAtividadesDoCrm` na pagina da Auditoria (2), `registrarAtividade` em `conversas.ts` (9), `contatos.ts` (2), `consentimentos.ts` (2), `crm_atividades` em `sucessao.ts`.
- Container parado ao fim. O `e2e` de `GET /estado` nao foi tocado (nenhuma mudanca em `/estado`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Cursor so de tempo perde linhas na fronteira da pagina (WINDOWS #15)**
- **Found during:** leitura do 15-37 e do desenho da Task 3
- **Issue:** a sucessao grava varias Atividades no mesmo commit (mesmo `now()`); a Auditoria que pagina paginas cheias com `em < ate` pula as que dividem o instante da ultima linha. Evidencia: teste (g), 0 de 5 depois da 1a pagina.
- **Fix:** `ateId` opcional ao lado de `ate` (domínio, rota, repositorio, web); `(em, id) < (ate, ateId)`; `registrarAtividade` e a sucessao gravam `em` em milissegundos (`MOMENTO_DO_GESTO`) para o cursor ser exato. `ate` sozinho continua exclusivo. `ateId` sem `ate` e 400.
- **Files modified:** `packages/dominio/src/crm/atividades.ts`, `apps/api/src/repositorios/crm/atividades.ts`, `apps/api/src/rotas/crm/atividades.ts`, `apps/web/src/dados/crm/atividades.ts` (e testes)
- **Verification:** `atividades.test.ts` (g), `rotas/crm/atividades.test.ts`, dominio
- **Commits:** `726cde5`, `2b55f50`

**2. [Rule 2 - Missing] `marcar` sem transacao nem trava deixaria Atividade duplicada**
- **Found during:** Task 2
- **Issue:** `marcar` lia e gravava pelo pool, sem transacao; duas estrelas iguais em paralelo leriam o mesmo valor anterior e gravariam duas linhas (T-15-26).
- **Fix:** `comTransacao` + `gravarComAnterior` (trava consultiva por Espaco, Conversa e Membro) e `temRecebidaEntre` no repositorio de marcacoes.
- **Commit:** `6cf9700`

**3. [Rule 3 - Blocking] O ator de `passarAoSucessor` e `ActorRef` (`{ kind, id }`), nao `{ tipo, id }`**
- **Issue:** o plano escreveu `{ tipo: "member", id }`, mas `registrarAtividade` e a tabela usam `ActorRef` (`kind`); manter o tipo do dominio evita uma traducao.
- **Fix:** `passarAoSucessor(..., ator: ActorRef)`, `AO_CONFIRMAR_DOS_MEMBROS` passa `{ kind: "member", id: membro.id }`.
- **Commit:** `a2563df`

**4. [Rule 2 - Missing] Teste de ponta a ponta da remocao em `operacoes.test.ts`**
- **Issue:** o arquivo nao esta em `files_modified`, mas o `removeMember` via `POST /operacoes` e o unico caminho real que passa o ator; sem o caso, a ligacao do ator ficaria sem prova.
- **Fix:** o caso "o Administrador remove o Membro" confere as cinco Atividades e o ator.
- **Commit:** `2ccca88`

### Registrado para o dono (WINDOWS.md, abertas)

- **#26:** Negocio (criar, editar, ganhar, perder, reabrir), Contato e Empresa (criar, lixeira) do CRM novo NAO gravam Atividade nesta fase, como o plano manda. As telas antigas gravavam; ao tirar o modelo antigo esses gestos deixam de aparecer na Auditoria. Pergunta: quer a linha do tempo deles antes de remover o antigo?
- **#27:** o contador "N Registro(s) de Atividade" e o "de N" da Auditoria agora contam `state.activity` inteiro mais so as paginas ja lidas do CRM novo (`GET /atividades` nao devolve total): o numero cresce a cada "Mostrar mais".
- **#15 (do 15-37):** marcada `fixed` por este plano (cursor composto).

**Total deviations:** 4 auto-fixed (1 Rule 1, 2 Rule 2, 1 Rule 3) e 2 linhas novas abertas no ledger. **Impact:** nenhum no escopo; o cursor composto e aditivo e compativel (`ate` sozinho nao muda).

## Issues Encountered

- `apps/api` nao tem configuracao de `eslint`; so `tsc` e os testes valem para a api neste plano.
- `finalidadeDeConsentimentoAtiva` (referencias.ts) ficou sem chamador depois que o consentimento passou a usar `nomeDaFinalidadeAtiva`; mantida exportada, sem remover codigo que outros planos da fase possam usar.
- A Atividade de leitura nao tem `antes`/`depois`: so a frase. O recuo do `lidaAte` continua permitido pelo repositorio (`coalesce`), como antes; recuar nao grava linha.

## Known Stubs

None.

## Threat Flags

None. Nenhuma superficie nova: a unica mudanca de rota e o parametro `ateId` de `GET /atividades`, com `.strict()`, tamanho limitado e sem efeito fora do Espaco e do Papel da sessao.

## Self-Check: PASSED

- Criado: `apps/web/src/features/configuracoes/auditoria-do-crm.test.tsx` existe.
- Commits no HEAD: `726cde5`, `2b55f50`, `d87c0f6`, `7c7cac8`, `5f9289d`, `6cf9700`, `2ccca88`, `a2563df`, `c1ac53a`.

## Next

Ready for 15-10.
