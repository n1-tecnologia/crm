---
phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
plan: 42
subsystem: dominio-api-web
tags: [derivacoes-antigas, crm-antigo, grupo-e-flow, automacoes, tdd, ucr-12, tres-camadas]
status: complete

requires:
  - phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
    provides: "15-33: resposta 'seguir' da checkpoint e crm (canais) nas composicoes de Grupo/Flow; 15-32: conversa-de-grupo.ts; 15-31: semearCrmAntigo; 15-36: a sucessao de Conversas de Grupo; 15-41: Pasta Meus negocios sem protecao"
provides:
  - "Nenhum arquivo de producao do dominio le as oito colecoes do CRM antigo (so seed-crm-antigo.ts, que sai no 15-43); state.conversations so em Grupo, Flow, members.ts (sucessao de Grupo), ia/agentes.ts e derive-ferramentas.ts"
  - "derive.ts, derive-conversacional.ts e derive-ferramentas.ts sem as leituras de Negocio, Contato, Conversa, Funil e Canal antigos; responseWindowOpenUntil(conversa, canal, capacidades) recebe o Canal"
  - "startConversation, sendMessage e receiveMessage (conversa-de-grupo.ts) tomam o Canal de crm.canais e o Contato de crm.contatos (WINDOWS #37)"
  - "OpcoesDaAgenda.clientes: nome e dono do cliente das Automacoes R4/R5 vem de plataforma.contatos, lidos pelo scheduler-worker na transacao da volta (WINDOWS #35)"
  - "createTask so aceita Vinculo de nascimento conferido nas tabelas (VINCULO_NAO_CONFERIDO); o Canal da Lista so vale em canais"
  - "Nenhum teste das tres camadas le, monta ou confere as oito colecoes pelo tipo DataState; so seed-sem-crm-antigo.test.ts usa semearCrmAntigo"
affects: [15-43]

plan_head_before: d3648ffdf134db3b6830b01343536ec7d9ff028a
plan_head_after: 2a5b4730f32dab14cd1e0e6d1c11de50c75c3580
commits: 6

actuals:
  tokens: 72000
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "o que uma composicao antiga precisa do CRM novo chega pelo argumento crm (canais e contatos que o servidor leu), nunca pelo estado"
    - "prova de ausencia do CRM antigo le a colecao pela chave do objeto (colecaoPelaChave), valida antes e depois de o DataState perder as colecoes"
    - "massa de teste das Ferramentas montada a mao (testes/crm-de-teste.ts, testes/crm-das-ferramentas.ts) em vez de semear o CRM antigo"

key-files:
  created:
    - packages/dominio/src/leituras-do-crm-antigo-fora.test.ts
    - packages/dominio/src/testes/crm-de-teste.ts
    - packages/dominio/src/testes/crm-das-ferramentas.ts
    - apps/api/src/automacoes/clientes-da-lista.ts
    - apps/api/src/automacoes/clientes-da-lista.test.ts
  modified:
    - packages/dominio/src/derive.ts
    - packages/dominio/src/derive-conversacional.ts
    - packages/dominio/src/derive-ferramentas.ts
    - packages/dominio/src/operations/{members,tasks,structure,canais,planning,automations,tarefa-conversacional-nas-tabelas}.ts
    - packages/dominio/src/operations/ferramentas/conversa-de-grupo.ts
    - packages/dominio/src/sem-crm-antigo.test.ts
    - packages/dominio/CONTEXT.md
    - apps/api/src/automacoes/{scheduler-worker,invocar-agente}.ts
    - apps/api/src/automacoes/CONTEXT.md
    - apps/web/src/features/ferramentas/flow-popup.tsx
    - .planning/WINDOWS.md
  deleted:
    - packages/dominio/src/derive-conversacional-antigo.test.ts
    - apps/api/src/testes/canal-antigo.ts
  renamed:
    - "packages/dominio/src/operations/sobre-o-crm-antigo.test.ts -> painel-barra-e-modelo-da-lista.test.ts"

key-decisions:
  - "Precondicao conferida: 15-33-SUMMARY.md linha 109 'Resposta da checkpoint: seguir' (grep -n '^Resposta da checkpoint: seguir'), dada pelo orquestrador a partir do 'pode fazer o que precisar para fechar a fase' do dono em 2026-11-06"
  - "responseWindowOpenUntil nao foi apagada: o flow-popup.tsx (producao, Flow) a chama. Passou a receber o Canal (o de plataforma.canais, que o popup ja lia por useCanaisDasFerramentas); o popup mudou so a chamada. Antes, com state.channels vazio desde o 15-33, ela devolvia sempre null (a janela de resposta nunca desabilitava uma Conversa)"
  - "createTask recusa o Vinculo de nascimento sem alvoConferido em vez de recuar ao estado: o unico produtor em producao (tarefa-conversacional-nas-tabelas.ts) ja o marca"
  - "conversa-de-grupo.ts fica (item 4): ficaram startConversation, sendMessage, sendMessageSemConferencia, receiveMessage e as cinco operacoes de Conversa de grupo registradas; saiu o recuo a state.channels/state.contacts, a conferencia do consentimento de marketing do Contato antigo e a restauracao de Contato arquivado por Mensagem recebida"
  - "O Processo do Closer (testes do seed do CRM antigo) foi apagado com o seed que ele provava; Mensageria e Rascunho foram reescritos em conversa-de-grupo.test.ts; o Painel passou a ler uma massa explicita de Funis, Etapas e Negocios"

requirements-completed: []

coverage:
  - id: D1
    description: "As derivacoes antigas (derive.ts, derive-conversacional.ts, derive-ferramentas.ts) saem do dominio e nenhum arquivo de producao do dominio le as oito colecoes"
    requirement: UCR-12
    verification:
      - { kind: unit, ref: "packages/dominio/src/leituras-do-crm-antigo-fora.test.ts", status: pass }
      - { kind: unit, ref: "packages/dominio/src/sem-crm-antigo.test.ts", status: pass }
    human_judgment: false
  - id: D2
    description: "Link de convite do Novo Grupo, abrir atendimento e receber Mensagem funcionam com o Contato so em crm.contatos (WINDOWS #37)"
    requirement: UCR-12
    verification:
      - { kind: unit, ref: "packages/dominio/src/operations/ferramentas/conversa-de-grupo.test.ts#o Contato só existe no CRM novo (crm.contatos)", status: pass }
    human_judgment: true
    rationale: "Nenhuma tela foi aberta em navegador real: o Novo Grupo e o link de convite so tem teste de dominio"
  - id: D3
    description: "Nome e dono do cliente das Automacoes R4/R5 vem de plataforma.contatos pela agenda (WINDOWS #35)"
    requirement: UCR-12
    verification:
      - { kind: unit, ref: "packages/dominio/src/operations/contas-a-receber.test.ts#R2/R4/R6", status: pass }
      - { kind: unit, ref: "apps/api/src/automacoes/clientes-da-lista.test.ts", status: pass }
      - { kind: integration, ref: "apps/api/src/automacoes/scheduler-worker.test.ts (Postgres real, 19 casos)", status: pass }
    human_judgment: true
    rationale: "A volta real do scheduler com Contato em plataforma.contatos e Automacao R4/R5 comentando com o nome nao foi exercitada ponta a ponta; o scheduler-worker.test.ts nao tem Tarefa de Contas a receber"
  - id: D4
    description: "Os ramos antigos de members, tasks, structure e canais saem; a sucessao de Conversas de Grupo (D-15-08) continua"
    requirement: UCR-12
    verification:
      - { kind: unit, ref: "packages/dominio/src/operations/members-remocao.test.ts", status: pass }
      - { kind: unit, ref: "packages/dominio/src/operations/canais.test.ts", status: pass }
    human_judgment: false
  - id: D5
    description: "Nenhum teste das tres camadas le, monta ou confere as oito colecoes pelo tipo; so seed-sem-crm-antigo.test.ts usa semearCrmAntigo"
    requirement: UCR-12
    verification:
      - { kind: other, ref: "grep de aceite da Task 3 = 0 arquivos; grep amplo '.contacts|.deals|...' em *.test.ts(x) fora das duas guardas = 0", status: pass }
      - { kind: other, ref: "npm run check em Postgres 16 novo (crm-n1-pg-1542, porta 55742, migracoes 001-012): RC=0", status: pass }
    human_judgment: false

duration: 65min
completed: 2026-11-06
---

# Phase 15 Plan 42: as leituras do CRM antigo saem do dominio Summary

**Nenhum arquivo de producao do dominio le mais as oito colecoes do CRM antigo: as derivacoes antigas e os ramos antigos de members, tasks, structure e canais foram apagados, Grupo/Flow/Automacao tomam Canal e Contato de `crm`, o nome e o dono do cliente das Automacoes de Contas a receber vem de `plataforma.contatos` por `OpcoesDaAgenda.clientes`, e nenhum teste das tres camadas depende das colecoes pelo tipo, com o `DataState` ainda inteiro.**

## Precondicao

`grep -n "^Resposta da checkpoint: seguir"` em `15-33-SUMMARY.md` devolveu a linha 109 antes de qualquer edicao (resposta dada pelo orquestrador a partir do "pode fazer o que precisar para fechar a fase" do dono, 2026-11-06).

## Performance

- **Duracao:** ~65 min de relogio. O `npm run check` completo leva ~13 min.
- **Tarefas:** 3 (a 1 e traçador; as tres sao TDD).
- **Arquivos:** 59 em `packages` e `apps` (`git diff --shortstat d3648ff..HEAD`: +1506 / -2256).

## Accomplishments

- **Derivacoes apagadas.** `derive.ts` sem `contactDisplayRole`, `principalCompanyId`, `effectiveProbability`, `weightedValue`, `lastInteraction`, `marketingConsentMissing` e `duplicateSuspicions`; `derive-conversacional.ts` sem `contatoDaTarefa`, `conversaDaTarefa`, `canalDaTarefa`, `negocioDaTarefa`, `canaisQueAlcancam`, `canaisDaLista`, `canaisDaListaQueAlcancam`, `listaSemCanais`, `canaisDoFio`, `canaisDeResposta`, `canalPadraoDeResposta`, `canalDaAbaInicial`, `canalPadraoDoTipo`, `ORDEM_DOS_TIPOS_DE_CANAL` e `CanalDoFio` (ficam `PAPEL_DO_VINCULO`, `vinculosDoCrmDaTarefa`, `tarefasConversacionaisDoContato`, as `...NasTabelas`, `marcadoresDeCanal`, `rotuloDoCanal`, `textoDoSeparadorDeCanal`); `derive-ferramentas.ts` sem `contatosComWhatsApp`. Nenhuma das apagadas tinha chamador de producao na api nem na web.
- **Ramos antigos das operacoes.** `members.ts` (previa e sucessao de Contato, Empresa e Negocio antigos; nome de Funil), `tasks.ts` (`vinculoRefusal`), `structure.ts` (`nomesDosCanais` sem o recuo) e `canais.ts` (`validarCanaisDeAtendimento` sem o recuo; **o plano nao o listava, mas lia `state.channels`**) saem. A sucessao de Conversas de Grupo continua.
- **WINDOWS #37.** `startConversation` e `receiveMessage` tomam o Contato de `crm.contatos` (o `ContatoDaFerramenta` das Ferramentas) e `sendMessage` o Canal de `crm.canais`. Teste com o Contato so em `crm`: abrir atendimento, recusa de Contato ausente/na lixeira/sem WhatsApp, receber Mensagem e `enviarLinkDeConvite` do Novo Grupo.
- **WINDOWS #35.** `OpcoesDaAgenda.clientes` (`ClientesLidos`) substitui a leitura de `state.contacts` em `automations.ts`; `apps/api/src/automacoes/clientes-da-lista.ts` le os clientes da Lista em `plataforma.contatos` pelo `lerDoCrm` de `executar()` no `scheduler-worker`, e a ponte do Agente os mescla ao CNPJ. `RodarAgenda` ganhou o parametro opcional `opcoes`.
- **Testes sem as colecoes.** `sobre-o-crm-antigo.test.ts` virou `painel-barra-e-modelo-da-lista.test.ts` (massa explicita de Funis, Etapas e Negocios do Painel); Mensageria e Rascunho vao para `ferramentas/conversa-de-grupo.test.ts`; `ferramentas.test.ts` (933 linhas) monta Canal, Contatos e Conversas proprios em `testes/crm-das-ferramentas.ts`; `capacidades.test.ts` e `canais.test.ts` montam o proprio Canal; as provas de ausencia leem a colecao pela chave.

## Task Commits

1. **Task 1 (traçador):** RED `9a74cc5` -> GREEN `4ecdce8` (derivacoes; `flow-popup.tsx`).
2. **Task 2:** RED `4efb815` (conversa-de-grupo, contas-a-receber, guarda de producao) e `13ac2a7` (clientes-da-lista) -> GREEN `9de8255`.
3. **Task 3:** `2a5b473` (testes das tres camadas, CONTEXT.md, fixtures).

**Metadados do plano:** commit `docs(15-42)` seguinte (SUMMARY e WINDOWS.md), depois o de STATE/ROADMAP.

## TDD Gate Compliance

`workflow.tdd_mode` e `false`; `gsd_run check tdd-red-evidence` nao foi usado e a saida do vitest foi lida a mao.

- **RED da Task 1** (`9a74cc5`): 5 de 5 casos de `leituras-do-crm-antigo-fora.test.ts` falhavam (exports ainda presentes, regex ainda casando, `responseWindowOpenUntil` com `TypeError`).
- **RED da Task 2** (`4efb815`): 4 casos de `conversa-de-grupo.test.ts` ("Contato nao encontrado"), 2 de `contas-a-receber.test.ts` e 2 da guarda de producao. Um dos dois de `contas-a-receber` tinha uma expectativa de texto errada (`O cliente` em maiuscula no meio da frase) e foi corrigido no GREEN: falhava pelo motivo certo em R4 e pelo errado em R5. `clientes-da-lista.test.ts` (`13ac2a7`) foi commitado antes da implementacao, mas a implementacao ja estava escrita na arvore (passa nos dois lados do commit de teste so porque o modulo existe no disco; no commit do teste o modulo ainda nao existia).
- **Fora do RED:** as reescritas de teste da Task 3 e o ajuste de `canais.test.ts`, `derive-conversacional.test.ts` e `painel-barra-e-modelo-da-lista.test.ts` acompanharam a remocao que os tornava necessarios.

## Verificacao

`npm run check` da raiz em Postgres 16 novo (`crm-n1-pg-1542`, porta 55742, migracoes 001-012, as duas URLs explicitas), depois do ultimo commit de codigo: **RC=0**. Typecheck das tres camadas, lint (0 erros, 2 avisos antigos), tokens e contratos ok. **Dominio** 129 arquivos, 2384 testes; **web** 132 arquivos, 1297; **api** 192 passaram (2 pulados), 2447 testes.

- A primeira rodada completa (antes do ultimo ajuste) teve 2 falhas: `outbox-worker.test.ts` (k), baseline, e a guarda da web, por um comentario meu em `testes/crm-antigo-de-teste.ts` que citava a colecao (corrigido). O flake do outbox, isolado em contêiner novo: tentativa 1, 15/15; tentativa 2, falhou (j) e (k) (como no baseline do 15-33). `git diff d3648ff..HEAD` nos tres arquivos do outbox esta vazio.
- **Aceite por grep:** `grep -rlE "\b(state|s)\.(contacts|...)" packages/dominio/src` fora de teste, `seed-crm-antigo.ts`, `state.ts` e `colecoes.ts` = 0; o grep de aceite da Task 3 = 0 arquivos; um grep mais amplo (`\.(contacts|companies|deals|funnels|channels|...)` em `*.test.ts(x)` das tres camadas, fora das duas guardas) = 0, o que pegou dois usos que o regex do plano nao alcancava (`dados.contacts` e `dados.deals` em `inicio-no-crm-novo.test.tsx`). `grep -rl semearCrmAntigo` lista so `seed-crm-antigo.ts` e `seed-sem-crm-antigo.test.ts`.
- Nenhum `.env` lido, nada contra banco remoto, `~/n1-ensaio` intocado, nenhum contêiner `supabase_*` tocado; `crm-n1-pg-1542` foi parado ao fim. Nenhum `npm run build`.
- AGENTS.md (Next.js com mudancas incompativeis): o unico codigo de `apps/web` de producao tocado foi a chamada a `responseWindowOpenUntil` em `flow-popup.tsx` (sem API do Next); o guia de `node_modules/next/dist/docs/` nao foi lido.

## Decisions Made

Ver `key-decisions`. A que mais pesa: **`responseWindowOpenUntil` nao saiu**, porque o `flow-popup.tsx` (producao) a chama; o plano mandava parar e registrar se houvesse chamador de producao de derivacao apagada (item 5), mas aqui a funcao foi mantida e so mudou de assinatura, e o popup so mudou a chamada (ele ja tinha o Canal da tabela). Nao foi uma troca de tela.

## Deviations from Plan

**1. [Rule 3 - Bloqueio] `operations/canais.ts` lia `state.channels` e nao estava na lista do plano.** `validarCanaisDeAtendimento` caia no estado quando o id nao estava em `canais`; sem tirar isso o criterio "nenhum arquivo de producao le as oito colecoes" nao fecha. Saiu o recuo; `createList`/`definirCanaisDaLista` so conferem em `canais`. Reescritos os testes de `canais.test.ts` e `derive-conversacional.test.ts` (passam `canais`). **Commit:** `9de8255`.

**2. [Rule 1 - Bug] `responseWindowOpenUntil` mudou de assinatura e o `flow-popup.tsx` mudou a chamada.** Com `state.channels` vazio desde o 15-33 a funcao devolvia sempre `null`, entao o popup de enviar Flow nunca marcava "fora da janela de resposta". Agora usa o Canal de `plataforma.canais`. Comportamento visivel: Conversas fora da janela de 24 h passam a aparecer desabilitadas no popup (o que a tela ja pretendia). **Commit:** `4ecdce8`.

**3. [Rule 3] `createTask` recusa o Vinculo sem `alvoConferido`** (`VINCULO_NAO_CONFERIDO`) em vez de recuar ao estado. O unico produtor em producao ja o marca; testes que passavam `vinculos` sem a marca ganharam `alvoConferido: true`. **Commit:** `9de8255`.

**4. [Comportamento visivel, aberto] `receiveMessage` nao restaura mais Contato arquivado ou na lixeira ao receber Mensagem (RN-CON-13), e `sendMessage` nao confere mais o consentimento de marketing do Contato antigo.** O Contato agora e o `ContatoDaFerramenta` lido da tabela, que esta composicao nao grava; o Canal da tabela nao guarda Mensagens de modelo, entao o consentimento nunca se aplicava. Linha aberta no WINDOWS.md (#70). **Commit:** `4ecdce8`, `9de8255`.

**5. [Decisao] Cobertura que saiu com o codigo que provava.** `derive-conversacional-antigo.test.ts` (menos `rotuloDoCanal`, `textoDoSeparadorDeCanal` e `tarefasConversacionaisDoContato`, movidos para `derive-conversacional.test.ts`); em `operations.test.ts`-herdados: Suspeita de Duplicidade, o Processo do Closer (testava o seed de `seed-crm-antigo.ts`), o caso de Contato mesclado que respondia pelo sobrevivente (derivacao apagada), o caso "restaura o Contato arquivado" de Mensageria, a conferencia do Canal "sem provedor" de `capacidades.test.ts` (o Canal da tabela sempre tem provedor), o caso do Chat do site em `canais.test.ts` (`Canal.tipo` nao tem `chatDoSite`) e, no web, dois casos "nada do CRM vem do store" de `busca-e-lixeira-do-crm.test.tsx` (vazios sem o Contato antigo plantado).

**6. [Escopo] Arquivos fora da lista do plano**, por seguirem o grep: `canais.test.ts`/`painel-barra-e-modelo-da-lista.test.ts`/`contas-a-receber.test.ts`/`ancora-do-chat.test.ts`/`leitura-de-widget-do-crm.test.ts`/`instanciar-template-com-canais.test.ts` etc. no dominio; `rotas/operacoes-canais-da-lista.test.ts` (o caso "Canal antigo de `registros` segue aceito" virou "ja nao vale"), `e2e/canais-fluxo.test.ts` e `unidade-de-trabalho-em-lote.test.ts` na api (`testes/canal-antigo.ts` apagado, sem chamador); `inicio-no-crm-novo.test.tsx` e `testes/crm-antigo-de-teste.ts` (sem `contatoAntigoDeTeste` e `negocioAntigoDeTeste`) na web. Nao mexi em `seguranca/*.test.ts`, `unidade-de-trabalho.test.ts` nem `operacoes.test.ts` da api: o grep ja os dava como limpos.

**Total deviations:** 1 bloqueio, 1 correcao de regressao latente, 2 decisoes, 1 comportamento aberto, 1 ajuste de escopo. **Impact:** o plano cumpre os criterios; o `DataState` esta pronto para o 15-43 encolher sem teste algum quebrar o `tsc`.

## Known Stubs

Nenhum. (`messageTemplates: []` em `canalComoChannel` repete o que a ponte ja fazia, WINDOWS #20.)

## Threat Flags

Nenhum. T-15-97 (chamador de derivacao apagada) mitigado: `tsc` da api e da web passa; unico chamador de producao achado foi `responseWindowOpenUntil` no Flow, que nao foi apagada. T-15-98 (teste que monta o CRM antigo quebrando o `tsc` do 15-43): os dois greps (de aceite e o amplo) dao 0. `clientes-da-lista.ts` le `plataforma.contatos` so do Espaço da volta (`workspace_id = $1`) e so os ids citados por Vinculo `cliente` da Lista; nada novo chega ao navegador.

## Issues Encountered

- `outbox-worker.test.ts` (j)/(k): flake de baseline, descrito em Verificacao.
- O regex de aceite da Task 3 nao pega acesso por variavel fora da lista (`dados`, `estado2`...); o grep amplo pegou. O 15-43 ainda trata o resto pelo `tsc`.

## Windows (WINDOWS.md)

**Resolvidas (4, com prova de teste):** #35 (`contas-a-receber.test.ts`, `clientes-da-lista.test.ts`), #37 (`conversa-de-grupo.test.ts`, Contato so em `crm`), #63 (`ferramentas.test.ts` monta Canal, Contatos e Conversas proprios) e #66 (`sobre-o-crm-antigo.test.ts` reescrito e renomeado).

**Abertas (3 novas, `deviation`):** #70 (`receiveMessage` sem restaurar Contato, sem consentimento de marketing), #71 (a Execucao disparada por evento nao recebe o nome/dono do cliente; so a agenda recebe), #72 (o Registro de Atividade de `grantGovernanceAccess` nomeia Funil pelo id).

**Seguem abertas, por decisao do dono ou de outro plano:** #41 (Conversa de grupo na Caixa), #61 (seed Automacoes apontando para Listas espelho), #62 (metricas do Flow nascem com zero no seed), #65 (`conversa-de-grupo.ts` nao pode ser apagado, 15-43 inclusive) e #67 (o `canalPeloId` que o #67 descreve ja nao olha `state.channels`; fica o resto: Mensagens de modelo vazias, linha 20).

## Next Phase Readiness

- Pronto para o 15-43 (`DataState`, tipos e guarda final do dominio): nenhum arquivo de producao nem teste das tres camadas le as oito colecoes (a guarda do dominio tem `CONGELADOS = ["seed-crm-antigo.ts"]`; o 15-43 apaga o construtor e o caso temporario de `seed-sem-crm-antigo.test.ts` e liga o "a lista so encolhe"). `testes/crm-antigo-de-teste.ts` (web) so exporta `conversaAntigaDeTeste`, e o `15-43` restringe o tipo de `conversations` a Grupo. `conversa-de-grupo.ts` nao pode ser apagado.
- `requirements-completed: []`: `requirements.ready-ids` respondeu 0/1 (UCR-12 e declarado tambem por 15-43, sem SUMMARY).
- Limite honesto: nenhuma tela foi aberta em navegador real; o Novo Grupo, o link de convite e o comentario R4/R5 com o nome do cliente so tem teste de dominio e de unidade da api.

---
*Phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant*
*Completed: 2026-11-06*

## Self-Check: PASSED

- Arquivos criados conferidos (`[ -f ]`): `leituras-do-crm-antigo-fora.test.ts`, `testes/crm-de-teste.ts`, `testes/crm-das-ferramentas.ts`, `clientes-da-lista.ts` e `clientes-da-lista.test.ts`; apagados (`test ! -e`): `derive-conversacional-antigo.test.ts`, `apps/api/src/testes/canal-antigo.ts`.
- Commits `9a74cc5`, `4ecdce8`, `4efb815`, `13ac2a7`, `9de8255` e `2a5b473` sao ancestrais do HEAD; `git rev-list --count d3648ff..HEAD` = 6 antes deste commit de metadados; `test(15-42)` precede o `feat(15-42)` de cada tarefa.
- O `<verification>` do plano (`npm run check` completo em Docker) rodou depois de todas as edicoes de codigo; RC=0.
