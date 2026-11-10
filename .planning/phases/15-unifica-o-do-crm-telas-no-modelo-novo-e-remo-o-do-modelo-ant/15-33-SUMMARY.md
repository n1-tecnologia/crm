---
phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
plan: 33
subsystem: api-dominio-web
tags: [ponte-dos-canais, crm-antigo, guardas, executar, grupo-e-flow, tdd, ucr-12, tres-camadas]
status: complete

requires:
  - phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
    provides: "15-32: as operacoes do CRM antigo fora de OPERACOES, as capacidades de Canal em crm/capacidades.ts e o minimo de Conversa de Grupo em ferramentas/conversa-de-grupo.ts; 15-11 a 15-40: todas as telas leem o Canal por useCanais"
provides:
  - "GET /estado nao traz mais Canal em state.channels: o Canal so existe em plataforma.canais e se le por GET /canais"
  - "executar() nao le Canal (nem no lote de entrada, nem na guarda to_regclass): uma gravacao comum, inclusive a primeira do processo, faz 2 idas ao banco; MedicaoDaExecucao perdeu canaisMs"
  - "persistencia/canais-projetados.ts (+ teste), canalAntigoEmConflito e a conferencia de nome e conta contra channels de registros apagados"
  - "Grupo, Flow e Automacao seguem enviando: sendMessage, startConversation e receiveMessage acham o Canal em state.channels e, na falta dele, em crm.canais"
  - "sem-crm-antigo.test.ts da api e da web no formato final: CONGELADOS vazio, checagem sumidos ligada, state.conversations so em lista nominal de Grupo e Flow"
affects: [15-34, 15-35, 15-41, 15-42, 15-43]

plan_head_before: c06c7b1564e5ec9f6a76b4ab3d9932fd9e6cd841
plan_head_after: a988c0dd8e8c8d45ed33c0583204add8cdd33fff
commits: 6

actuals:
  tokens: 18000
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "o Canal de Grupo, Flow e Automacao chega por crm.canais (o que o servidor le da tabela dentro da transacao), nunca por projecao no estado"
    - "guarda de codigo que so encolhe: lista congelada vazia mais lista nominal do que resta (Grupo e Flow), com a checagem sumidos falhando se uma entrada deixar de ler"

key-files:
  created: []
  modified:
    - packages/dominio/src/operations/ferramentas/conversa-de-grupo.ts
    - packages/dominio/src/operations/ferramentas/{grupos,flows,automacoes}.ts
    - packages/dominio/src/operations/ferramentas.test.ts
    - apps/api/src/persistencia/unidade-de-trabalho.ts
    - apps/api/src/persistencia/unidade-de-trabalho{,-trava,-em-lote}.test.ts
    - apps/api/src/persistencia/CONTEXT.md
    - apps/api/src/rotas/estado.ts
    - apps/api/src/rotas/CONTEXT.md
    - apps/api/src/rotas/operacoes-canais-da-lista.test.ts
    - apps/api/src/rotas/operacoes-ferramentas.test.ts
    - apps/api/src/rotas/gesto-no-crm/estrutura.ts
    - apps/api/src/repositorios/crm/referencias.ts
    - apps/api/src/servicos/crm/canais.ts
    - apps/api/src/servicos/crm/canais.test.ts
    - apps/api/src/observabilidade/medicao-da-gravacao.ts
    - apps/api/src/observabilidade/medicao-da-gravacao.test.ts
    - apps/api/src/e2e/canais-fluxo.test.ts
    - apps/api/src/sem-crm-antigo.test.ts
    - apps/web/src/sem-crm-antigo.test.ts
    - apps/web/src/features/crm/conectar-provedor.tsx
    - apps/web/src/features/estrutura/nova-tarefa-conversacional-dialog.tsx
    - CONTEXT.md
    - .planning/WINDOWS.md
  deleted:
    - apps/api/src/persistencia/canais-projetados.ts
    - apps/api/src/persistencia/canais-projetados.test.ts

key-decisions:
  - "Resposta da checkpoint: seguir (dada pelo orquestrador, ver as duas primeiras linhas do corpo). Vale para este plano e para os 15-41, 15-42 e 15-43."
  - "A ponte nao foi trocada por outra projecao: o Canal nao entra em state.channels nem e gravado. O que Grupo, Flow e Automacao liam dela passou a vir do crm.canais que as operacoes deles ja recebiam do servidor (canalPeloId em conversa-de-grupo.ts)."
  - "canaisMs saiu da medicao de executar(): sem leitura de Canal, o campo seria um zero fixo."

requirements-completed: []

coverage:
  - id: D1
    description: "GET /estado de um Espaco com Canais em plataforma.canais nao os traz em state.channels (so o Canal antigo de registros continua), e os Canais seguem por GET /canais"
    requirement: UCR-12
    verification:
      - { kind: integration, ref: "apps/api/src/e2e/canais-fluxo.test.ts#(e) o Canal vem so por GET /canais", status: pass }
    human_judgment: false
  - id: D2
    description: "executar() nao le Canal: duas idas ao banco sem plataforma.canais nem to_regclass, em Postgres real e no pool falso; criar ou renomear Canal nao confere mais contra channels de registros"
    requirement: UCR-12
    verification:
      - { kind: unit, ref: "apps/api/src/persistencia/unidade-de-trabalho.test.ts#a gravacao nao le Canal em momento nenhum", status: pass }
      - { kind: integration, ref: "apps/api/src/persistencia/unidade-de-trabalho-em-lote.test.ts#o Canal da tabela propria nao entra no estado da operacao", status: pass }
      - { kind: integration, ref: "apps/api/src/servicos/crm/canais.test.ts#unicidade so dentro de plataforma.canais", status: pass }
    human_judgment: false
  - id: D3
    description: "Grupo, Flow e Automacao enviam, abrem atendimento e recebem Resposta de Flow com o Canal so em crm.canais (state.channels vazio); sem Canal em nenhum dos dois, segue recusado"
    requirement: UCR-12
    verification:
      - { kind: unit, ref: "packages/dominio/src/operations/ferramentas.test.ts#Ferramentas — o Canal vem de crm.canais quando state.channels nao o tem (15-33)", status: pass }
    human_judgment: false
  - id: D4
    description: "As guardas da api e da web nao deixam nenhum arquivo de producao ler as oito colecoes do CRM antigo (nem a ponte), e state.conversations so aparece em lista nominal de Grupo e Flow"
    requirement: UCR-12
    verification:
      - { kind: unit, ref: "apps/api/src/sem-crm-antigo.test.ts + apps/web/src/sem-crm-antigo.test.ts", status: pass }
      - { kind: other, ref: "grep das oito colecoes em apps/api/src e apps/web/src sem testes = 0 arquivos", status: pass }
    human_judgment: false
  - id: D5
    description: "Enviar mensagem ao Grupo, enviar Flow e abrir o link de convite funcionam em navegador real sem o Canal em state.channels"
    verification: []
    human_judgment: true
    rationale: "So teste de dominio, de rota e de componente; nenhuma tela foi aberta com npm run dev nesta sessao."

duration: 70min
completed: 2026-11-06
---

Resposta da checkpoint: seguir
Dada pelo orquestrador a partir de "pode fazer o que precisar para fechar a fase" do dono em 2026-11-06, após conferir o SUMMARY do 15-32 e o gate da onda 11.

# Phase 15 Plan 33: a ponte dos Canais sai da api e as guardas ficam no formato final Summary

**`GET /estado` e `executar()` deixam de levar o Canal de `plataforma.canais` ao modelo antigo (a ponte `canais-projetados.ts` e `canalAntigoEmConflito` foram apagados), Grupo, Flow e Automação passam a achar o Canal em `crm.canais`, e as guardas `sem-crm-antigo` da api e da web ficam vazias de CRM antigo, com `state.conversations` só em lista nominal de Grupo e Flow.**

## Performance

- **Duração:** ~70 min de relógio (a rodada completa do `npm run check` leva ~7 min).
- **Tarefas:** 3 (a 1 é a checkpoint, respondida "seguir" antes de eu começar; as 2 e 3 são TDD: 2 RED + 2 GREEN + 1 de guardas e documentação).
- **Arquivos:** 28 de código e documentação do repositório (`git diff --stat`: +322 / -898), fora de `.planning`.

## Accomplishments

- **A ponte saiu.** `persistencia/canais-projetados.ts` e o teste dele estão apagados; `rotas/estado.ts` e `persistencia/unidade-de-trabalho.ts` não chamam mais nada dela. `executar()` não faz mais a guarda `to_regclass`, nem a leitura de Canais no lote de entrada, nem a ida própria no regime otimista: a entrada é `begin` + trava + leitura do Espaço, e `antes.state` vai direto para `gravar()`. A medição perdeu `canaisMs` (`MedicaoDaExecucao`, `medicao-da-gravacao.ts` e a linha "gravacao medida" documentada em `rotas/CONTEXT.md`).
- **Canal só em `plataforma.canais`.** `canalAntigoEmConflito` (e `ConflitoComCanalAntigo`) saíram de `referencias.ts`, e `servicos/crm/canais.ts` confere nome e conta só dentro da tabela. Antes o `channels` de `plataforma.registros` bloqueava a criação com `bloqueios.canais`.
- **Grupo, Flow e Automação continuam enviando.** Eram eles que liam o Canal projetado (`enviarMensagemAoGrupo`, `enviarFlow`, `enviarLinkDeConvite`, `receberRespostaDeFlow` e a ação `mensagem.enviarAoContato` chamam `sendMessage`/`startConversation`/`receiveMessage`, que procuravam o Canal em `state.channels`). `conversa-de-grupo.ts` ganhou `canalPeloId` (primeiro `state.channels`, depois `crm.canais`) e um adaptador `canalComoChannel`; `SendMessageInput` ganhou `crm` opcional e os quatro chamadores o repassam. Não é projeção: o Canal não entra no estado nem é gravado.
- **Guardas no formato final.** `apps/api/src/sem-crm-antigo.test.ts` e `apps/web/src/sem-crm-antigo.test.ts`: `CONGELADOS` vazio, `sumidos` ligado, sentinelas que continuam existindo, e uma segunda checagem de `state.conversations` com lista nominal (`DE_GRUPO_E_FLOW`). Mensagem de falha: "Fase 15: o CRM antigo saiu do código; o que resta de `conversations` é só Grupo e Flow (F14-D-05)." A ponte e `canalAntigoEmConflito` também estão no regex da api.
- **Documentação.** `persistencia/CONTEXT.md` troca "A ponte dos Canais (Fase 8)" por "A ponte dos Canais saiu (Fase 15, 3.5.4)" e corrige as passagens sobre o lote de entrada, a medição e `lerDoCrm`; o `CONTEXT.md` da raiz acompanha. Três comentários que citavam o estado antigo de Canal foram reescritos (`conectar-provedor.tsx`, `nova-tarefa-conversacional-dialog.tsx`, `gesto-no-crm/estrutura.ts`), porque o texto inteiro conta para a guarda.

## Task Commits

1. **Task 1 (checkpoint:decision):** respondida "seguir" pelo orquestrador; linha literal no topo do corpo deste arquivo, commitada antes de qualquer outra tarefa em `f734663`.
2. **Task 2 (api sem a ponte):** RED do domínio `a202f6f` -> GREEN do domínio `ac00baa`; RED da api `eacb8bd` -> GREEN da api `62d4226`.
3. **Task 3 (guardas, CONTEXT, e2e):** `a988c0d` (guardas, CONTEXT, comentários). O teste de ponta a ponta `canais-fluxo` foi ajustado no RED `eacb8bd`.

**Metadados do plano:** commit `docs(15-33)` seguinte (SUMMARY e WINDOWS.md), depois o de STATE/ROADMAP.

## TDD Gate Compliance

`workflow.tdd_mode` é `false`; `gsd_run check tdd-red-evidence` não foi usado e a saída do vitest foi lida à mão.

- **RED do domínio** (`a202f6f`): 4 de 5 casos de `ferramentas.test.ts` ("o Canal vem de crm.canais quando state.channels não o tem") falhavam por "Canal não encontrado."; o quinto (sem Canal em lugar nenhum continua recusado) passa dos dois lados por desenho. GREEN `ac00baa`: 5 de 5.
- **RED da api** (`eacb8bd`): 5 casos de `unidade-de-trabalho.test.ts` (3 idas em vez de 2, `to_regclass` e `plataforma.canais` presentes, `canaisMs` na lista de chaves), o caso (e) de `canais-fluxo.test.ts` (`state.channels` ainda trazia 3 Canais) e 2 casos de `servicos/crm/canais.test.ts` (409 `CANAL_NOME_EM_USO` contra `chn_antigo`). GREEN `62d4226`.
- **Fora do RED:** as remoções de `vi.mock("./canais-projetados")` em `operacoes-canais-da-lista.test.ts` e `operacoes-ferramentas.test.ts`, o ajuste de `unidade-de-trabalho-em-lote.test.ts` e de `medicao-da-gravacao.test.ts` e as duas guardas (que passam dos dois lados, como as de planos anteriores) foram feitos junto da implementação que os tornava necessários.

## Verificação

Postgres 16 novo (`crm-n1-pg-1533`, porta 55733, migrações 001-012), as duas URLs explícitas, `npm run check` da raiz:

- typecheck das três camadas, lint (0 erros, 2 avisos antigos), `verificar:tokens` e `verificar:contratos` ok.
- **Domínio:** 129 arquivos, 2404 de 2404 (antes do plano: 2399; +5 casos de Canal em `crm.canais`).
- **Web:** 132 arquivos, 1299 de 1299 (antes 1298; +1 da checagem nova da guarda).
- **Api:** 189 arquivos passaram, 2438 testes; **6 falhas, todas de baseline**: `outbox-worker.test.ts` (h), (i), (j), (k) e `colunas-geradas.test.ts` (2 casos). O `RC` do `npm run check` foi 1 por causa delas.
- **Prova dos flakes isolados em contêiner novo (um por tentativa, migrações 001-012):** `outbox-worker` + `colunas-geradas` juntos: tentativa 1 passou 23/23; tentativas 2 e 3 falharam 2 casos cada. Separados: `colunas-geradas` passou 8/8 nas duas tentativas; `outbox-worker` falhou só o caso (j) nas duas e passou 14/15. Os arquivos `outbox-worker.ts`/`outbox-worker.test.ts`/`outbox.ts` não mudaram neste plano (`git diff c06c7b1..HEAD` vazio) e só importam `conexao`, `outbox`, `testes/relogio` e `testes/servidor-falso`, nenhum tocado. É o flake de baseline conhecido (memória do projeto e regras do orquestrador); não é regressão. O gate da onda 11 do orquestrador (RC=0, sem flake) e este rodaram o mesmo código de `outbox-worker`.
- **Aceite por grep:** `test ! -e canais-projetados.ts` sai 0; `git diff -- apps/api/src/testes/fixtures-da-ponte.ts` vazio; `sumidos` aparece 7 vezes em cada guarda; "Fase 15" em `persistencia/CONTEXT.md` = 6; os arquivos de produção de `apps/api/src` e `apps/web/src` que citam `state|data|estado|s.(contacts|companies|deals|funnels|channels)` = 0; `canais-projetados`, `acrescentarCanaisProjetados` e `canalAntigoEmConflito` em produção = 0 (só aparecem no regex da guarda).
- Nenhum `.env` lido, nenhum `npm run build`, nada contra banco remoto, `~/n1-ensaio` intocado, nenhum contêiner `supabase_*` tocado; o contêiner `crm-n1-pg-1533` foi parado ao fim.
- AGENTS.md (Next.js com mudanças incompatíveis): o único código de `apps/web` tocado foi o texto de dois comentários; nenhuma API do Next foi usada, então não li o guia de `node_modules/next/dist/docs/`.

## Decisions Made

Ver `key-decisions`. A que mais pesa: **o plano mandava só apagar a ponte, mas Grupo, Flow e Automação liam o Canal dela** e quebrariam com "Canal não encontrado." (a lógica de `sendMessage` procura o Canal da Conversa em `state.channels`, e o Grupo cria a Conversa com o `channelId` UUID da tabela). Em vez de recolocar uma projeção, o leitor foi consertado para usar o `crm.canais` que o servidor já lê da tabela para essas operações (e que a web já manda para a execução local).

## Deviations from Plan

**1. [Regra do orquestrador / Rule 1 - Bug evitado] Grupo, Flow e Automação ganharam um leitor de Canal próprio.**
- **Found during:** Task 2 (leitura de quem lia `state.channels` antes de apagar a ponte).
- **Issue:** `sendMessage`, `startConversation` e `receiveMessage` (`ferramentas/conversa-de-grupo.ts`) procuravam o Canal só em `state.channels`; sem a ponte, enviar ao Grupo, enviar Flow, mandar o link de convite, receber a Resposta de Flow e a ação `mensagem.enviarAoContato` falhariam com "Canal não encontrado.".
- **Fix:** `canalPeloId` (state.channels, depois `crm.canais`) e `canalComoChannel`; `crm` opcional em `SendMessageInput`, `startConversation` e `receiveMessage`; `grupos.ts`, `flows.ts` e `automacoes.ts` o repassam. Quatro testes novos em `ferramentas.test.ts`.
- **Registrado em:** WINDOWS.md (linha aberta `deviation`, 15-33). As linhas 35, 37 e 41 continuam abertas: o Contato antigo ainda é lido de `state.contacts` por essas mesmas composições.
- **Commits:** `a202f6f`, `ac00baa`.

**2. [Rule 3 - Bloqueio] Arquivos fora da lista do plano.** `unidade-de-trabalho-em-lote.test.ts` (Postgres real, conferia que os Canais chegavam à operação e que a primeira gravação do processo fazia até 4 idas), `servicos/crm/canais.test.ts` (o bloco "unicidade entre o acervo novo e o do seed (A5)" testava o 409 contra `chn_antigo`), `observabilidade/medicao-da-gravacao.{ts,test.ts}` e `rotas/CONTEXT.md` (lista de etapas com `canaisMs`), `rotas/gesto-no-crm/estrutura.ts` (comentário), `conectar-provedor.tsx` e `nova-tarefa-conversacional-dialog.tsx` (comentários que a guarda lê) e o `CONTEXT.md` da raiz. O grep do plano para os testes que citavam a ponte não pegou os que dependiam dela sem citar o nome. Commits `eacb8bd`, `62d4226`, `a988c0d`.

**3. [Decisão] `canaisMs` removido da medição.** Sem leitura de Canal o campo seria um zero fixo; mudou a forma da linha "gravacao medida". Nenhum outro consumidor no repositório (grep). Registrado no WINDOWS.md junto com o item 4.

**4. [Comportamento visível, aberto] Nome e conta de Canal deixam de ser conferidos contra os `chn_*` antigos.** Antes do corte, um Canal novo pode repetir nome ou número de um Canal antigo de `registros`; o `--seco`/`--migrar` do 15-28 relatam `canal-repetido` e o antigo repetido fica de fora (só em `registros_crm_antigo`). Linha aberta no WINDOWS.md.

**5. [Lista nominal diferente da do plano] `DE_GRUPO_E_FLOW` da web tem 7 arquivos, não 3.** O plano previa `conversa-do-grupo.tsx`, `flow-popup.tsx` e `caixa-de-entrada/[conversa]/page.tsx`; a guarda achou também `configuracoes/campos/page.tsx` (conta o uso de campos de Grupo/Comunidade/Flow), `crm/caixa-de-entrada/page.tsx` (conta as Conversas de grupo aguardando), `features/crm/conversa-de-grupo-na-caixa.tsx` e `features/crm/inbox-columns.tsx` (a estrela do grupo na lista). São os mesmos casos da linha 41 do WINDOWS.md; a checagem `sumidos` fará a lista encolher sozinha. Na api, a lista tem só `rotas/gesto-no-crm/ferramentas.ts` (um comentário).

**Total deviations:** 1 correção de regressão evitada (regra do orquestrador), 1 bloqueio (arquivos fora da lista), 3 ajustes/decisões. **Impact:** o plano cumpre os critérios (ponte apagada, `GET /estado` sem Canal, guardas finais, gate passa exceto o baseline), com Grupo, Flow e Automação preservados.

## Known Stubs

Nenhum. (`messageTemplates: []` em `canalComoChannel` repete o que a ponte já fazia: a tabela não guarda modelos, WINDOWS #20.)

## Threat Flags

Nenhum. T-15-95 (tela que ainda lia Canal pelo `state.channels` projetado): mitigado, o `tsc` das três camadas passa, a guarda final da web está com a lista congelada vazia, e nenhum arquivo de `apps/web/src` lê `state.channels` (o grep do aceite dá 0). Nenhuma rota, esquema ou ponto de confiança novo; a leitura do Canal por `crm.canais` já era descartada e reescrita pelo servidor (T-15-20).

## Issues Encountered

- `outbox-worker.test.ts` (j) falhou 5 de 6 vezes isolado em contêiner novo e `colunas-geradas.test.ts` falhou dentro da rodada completa mas passou 8/8 isolado; ver "Verificação". Código e importações desses arquivos não foram tocados.
- Nada mais: nenhum disco apertado, nenhum contêiner ficou de pé.

## Windows (WINDOWS.md)

**Abertas (2 novas, `deviation`):**
- `packages/dominio/src/operations/ferramentas/conversa-de-grupo.ts`: o leitor de Canal por `crm.canais`; sai com o arquivo (Sessões 6 e 7).
- `apps/api/src/servicos/crm/canais.ts`: a conferência de nome e conta contra `chn_*` antigos saiu, e `canaisMs` também.

**Resolvidas:** nenhuma. #20 e #21 (Mensagens de modelo e popup de Canal) não dependem da ponte e seguem abertas; #35, #37 e #41 (de 15-42/15-43) seguem abertas como pedido.

## Next Phase Readiness

- Pronto para o 15-41 (Pasta fixa), 15-42 (leituras antigas do domínio) e 15-43 (`DataState`, tipos e guarda final do domínio): a resposta "seguir" está no topo do corpo deste arquivo. O `DataState` ainda tem `channels` (15-43 o tira); `conversa-de-grupo.ts` ainda lê `state.channels` primeiro, e o 15-43 não pode apagá-lo (WINDOWS #65).
- `requirements-completed: []`: UCR-12 é declarado também por outros planos da fase sem SUMMARY (`requirements.ready-ids`), então não foi marcado.
- Limite honesto: nenhuma tela foi aberta em navegador real; enviar ao Grupo e enviar Flow só têm teste de domínio, de rota e de componente.

---
*Phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant*
*Completed: 2026-11-06*

## Self-Check: PASSED

- Arquivos apagados conferidos (`test ! -e`): `canais-projetados.ts` e o teste.
- Commits `f734663`, `a202f6f`, `ac00baa`, `eacb8bd`, `62d4226` e `a988c0d` são ancestrais do HEAD; `git rev-list --count c06c7b1..HEAD` = 6 antes deste commit de metadados; `test(15-33)` precede o `feat(15-33)` de cada camada.
- O `<verification>` do plano (`npm run check` completo em Docker) rodou depois de todas as edições de código; as únicas falhas são o baseline provado isolado.
