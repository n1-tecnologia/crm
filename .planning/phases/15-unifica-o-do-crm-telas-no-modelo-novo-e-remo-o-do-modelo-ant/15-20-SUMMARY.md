---
phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
plan: 20
subsystem: crm
tags: [fio-da-conversa, mensagens, canais, abas, abrir-conversa, tdd, ucr-05]
status: complete

requires:
  - phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
    provides: "15-06 (useConversa, useMensagens, enviarMensagem, abrirConversa, AvatarDoContato, guarda sem-crm-antigo), 15-11 (a Caixa e o padrao de recusa/estrela) e 15-13 (fichas sem recuo)"
provides:
  - "packages/dominio/src/crm/canais-de-resposta.ts: abas por Canal e Canal de resposta como funcoes puras sobre Canal, IdentificadorDeContato e ConversaNaLista"
  - "ConversationThread por ids (conversaId?, contatoId, canalPreferidoId?, tarefaId?, onConversaAberta?) lendo Contato, Canais, Conversas e Mensagens pela api"
  - "responder = POST /mensagens uma vez; sem Conversa no Canal da aba o campo vira Primeira Mensagem e Enviar = POST /conversas"
  - "seletor-de-canal, separador-de-canal e selo-do-provedor tipados com Canal de @n1/dominio/crm/canais"
affects: [15-24, 15-25, 15-40, 15-42]

plan_head_before: f22bc1af421347699fb97c9b4e836df8dd6df176
plan_head_after: 40ab1d37e470642d2e7236dde53ebbd28bd6241d

actuals:
  tokens: 17470
  tasks: 3
  commits: 7

tech-stack:
  added: []
  patterns:
    - "regra de aba/Canal como funcao pura que recebe os Canais e os Identificadores como argumento (molde de canaisDaListaNasTabelas)"
    - "envio com ref + botao desligado em voo: o ref fecha o intervalo entre o clique e a renderizacao"
    - "pagina de mensagens por deslocamento ajustado na renderizacao (total - 200) e filtro por conversaId contra o keepPreviousData do SWR"
    - "teste do fio com fetch roteado por URL e SWRConfig de cache isolado (molde do 15-11)"

key-files:
  created:
    - packages/dominio/src/crm/canais-de-resposta.ts
    - packages/dominio/src/crm/canais-de-resposta.test.ts
  modified:
    - apps/web/src/features/crm/conversation-thread.tsx
    - apps/web/src/features/crm/conversation-thread.test.tsx
    - apps/web/src/features/crm/seletor-de-canal.tsx
    - apps/web/src/features/crm/separador-de-canal.tsx
    - apps/web/src/features/crm/selo-do-provedor.tsx
    - apps/web/src/app/(shell)/crm/caixa-de-entrada/[conversa]/page.tsx
    - apps/web/src/features/estrutura/tarefa-completa.tsx
    - apps/web/src/features/crm/deal-screen.tsx
    - apps/web/src/app/(shell)/crm/caixa-de-entrada/configuracoes/page.tsx
    - apps/web/src/app/(shell)/crm/caixa-de-entrada/configuracoes/canais/[canal]/page.tsx
    - apps/web/src/app/(shell)/crm/caixa-de-entrada/configuracoes/canais/conectar/page.tsx
    - apps/web/src/features/estrutura/cartao-conversacional.tsx
    - apps/web/src/sem-crm-antigo.test.ts
    - apps/web/CONTEXT.md
    - packages/dominio/CONTEXT.md

key-decisions:
  - "O Canal da aba vem, em ordem, de canalSelecionado, do clique, da Conversa pedida, de canalPreferidoId, do Canal da ultima recebida e da Conversa mais recente; um Canal que a tela mande e que nao esteja na fileira e ignorado"
  - "'A Conversa mais recente' (D-14) e a de maior entre ultimaRecebidaEm e atualizadoEm, porque a lista de Conversas nao traz a ultima Mensagem de qualquer direcao; a regra antiga olhava as Mensagens"
  - "Sem Conversa no Canal da aba nao ha botao 'Abrir atendimento': o campo vira 'Primeira Mensagem' e Enviar abre a Conversa COM a Mensagem (INV-CXE-05, F14-D-07)"
  - "Conversa so com resolvidas: o fio mostra a mais recente e responde nela por POST /mensagens, como o fio antigo (nao abre outra)"
  - "O fio mostra as 200 ultimas Mensagens (deslocamento = total - 200 depois da primeira pagina), nao as 200 primeiras"

requirements-completed: []

coverage:
  - deliverable: "regras de abas e Canal de resposta como funcoes puras das tabelas"
    verification:
      - { kind: test, ref: "packages/dominio/src/crm/canais-de-resposta.test.ts (25 casos)", status: pass }
    human_judgment: false
  - deliverable: "o fio le Contato, Canais, Conversas e Mensagens pela api e nao toca o estado antigo de CRM"
    verification:
      - { kind: test, ref: "apps/web/src/features/crm/conversation-thread.test.tsx#(1), (6) a (14)", status: pass }
      - { kind: test, ref: "apps/web/src/sem-crm-antigo.test.ts (conversation-thread.tsx fora de CONGELADOS)", status: pass }
    human_judgment: false
  - deliverable: "responder grava UMA linha por POST /mensagens, com duplo clique e recusa da api (UCR-05)"
    verification:
      - { kind: test, ref: "apps/web/src/features/crm/conversation-thread.test.tsx#(1), (2), (3), (12)", status: pass }
    human_judgment: false
  - deliverable: "abrir a Conversa pelo fio com a primeira Mensagem (POST /conversas), reaproveitando a que ja existe no par"
    verification:
      - { kind: test, ref: "apps/web/src/features/crm/conversation-thread.test.tsx#(17), (18), (19), (20)", status: pass }
    human_judgment: false
  - deliverable: "texto de Mensagem recebida como texto (T-15-50) e sem Rascunho (D-15-11)"
    verification:
      - { kind: test, ref: "apps/web/src/features/crm/conversation-thread.test.tsx#(4), (5)", status: pass }
    human_judgment: false
  - deliverable: "o fio e o compositor continuam com o mesmo desenho (abas, barra do Canal, selos, compositor de uma linha)"
    verification: []
    human_judgment: true
    rationale: "Os testes provam conteudo e comportamento; que o desenho fique igual na tela e juizo visual (fim da fase, human_verify_mode = end-of-phase)."
---

# Phase 15 Plan 20: O fio da Conversa lê, abre e responde pelo CRM novo Summary

**`ConversationThread` recebe ids e lê Contato, Canais, Conversas e Mensagens pela api; responder é um `POST /mensagens`, abrir Conversa é `POST /conversas` com a primeira Mensagem, e as abas por Canal e o Canal de resposta saem de funções puras do domínio sobre as tabelas.**

## Performance

- **Tasks:** 3 (1 tracer, 2 auto), todas `tdd="true"`
- **Files:** 2 criados, 15 modificados
- **Commits:** 7 (3 RED/GREEN em pares + 1 docs), medidos de `plan_head_before`
- **Duração:** cerca de 15 min (12:51 a 13:06 UTC)

## Accomplishments

- **Regras no domínio (`crm/canais-de-resposta.ts`):** `canaisDoFioNasTabelas`, `canaisDeRespostaNasTabelas`, `canalPadraoDeRespostaNasTabelas`, `canalDaAbaInicialNasTabelas`, `canalPadraoDoTipoNasTabelas` e `canaisQueAlcancamNasTabelas`, mais `rotuloDoCanalNasTabelas` e `textoDoSeparadorNasTabelas`. Recebem `Canal[]`, os Identificadores do Contato e as Conversas da lista (`canalId`, `estado`, `ultimaRecebidaEm`, `atualizadoEm`); nenhuma toca `DataState`. 25 casos portados dos testes de `derive-conversacional`.
- **O fio por ids (traçador):** props `conversaId?`, `contatoId`, `canalPreferidoId?`, `tarefaId?`, `canalSelecionado`/`onCanalChange`, `onConversaAberta?`. Lê `useContato`, `useCanais`, `useConversas({ contatoId })`, `useConversa` e `useMensagens`; carregando mostra "Carregando a conversa…", 404 do Contato "Contato não encontrado." e Contato sem Canal alcançável a frase de sempre. O estado guarda só Listas, Tarefas, Membros e Agentes (Nota, "Criar Tarefa" e a aba Meet).
- **Responder:** `enviarMensagem` com `ref` + `confirmCarregando`: duas ou três vezes "Enviar" mandam uma Mensagem. Recusa da api (409 de janela, 403) aparece no `role="alert"` do fio com a frase dela e o texto continua no campo. Nada vai para `/operacoes/`.
- **Abrir Conversa:** sem Conversa no Canal da aba o campo vira "Primeira Mensagem" e Enviar chama `abrirConversa`; o fio passa a seguir a Conversa devolvida e avisa `onConversaAberta(id)`. Com Conversa no par, reaproveita por `POST /mensagens` (nenhum `POST /conversas`).
- **Sem Rascunho (D-15-11) e sem Mensagem de modelo:** o bloco do Rascunho, o descarte e o seletor de modelo saíram. Fora da janela de 24 h do WhatsApp oficial o envio se desliga dizendo por quê.
- **Peças visuais:** `SeletorDeCanalDeResposta` recebe `canais` e `identificadores`; `SeparadorDeCanal`, `SeloDoProvedor`, `SeloDeOrigem` e `MarcaDeConexaoSimulada` tipam com `Canal` (`tipo`, `provedor`, `conexaoSimulada`), e os cinco chamadores deles passam o `Canal` direto em vez de montar o objeto antigo.
- **Chamadores:** `[conversa]/page.tsx` passa `conversaId`, `contatoId` e `canalPreferidoId`; `tarefa-completa.tsx` passa `conversaId` (dos Vínculos), `contatoId` e `tarefaId`; `deal-screen.tsx` passa `contatoId`. `CHANNEL_ICON` continua exportado com o mesmo nome e a mesma forma.
- **Guarda:** `features/crm/conversation-thread.tsx` saiu de `CONGELADOS` em `apps/web/src/sem-crm-antigo.test.ts`; o regex da guarda dá 0 achados no arquivo e o teste segue verde.

## TDD

| Task | RED | GREEN |
|------|-----|-------|
| 2 (regras do domínio, feita primeiro) | `613b260` | `ed3d7fc` |
| 1 (traçador, fio por ids e envio) | `0012351` | `9873d91` |
| 3 (abrir Conversa) | `b2a2ec2` | `817a93e` (+ docs `40ab1d3`) |

Avaliação semântica do RED (plano `type: execute`, então não rodei `gsd check tdd-red-evidence`; a avaliação é manual):

- **Domínio:** o RED leva um esqueleto com as assinaturas e retornos vazios; 19 dos 25 casos falharam na asserção planejada (ex.: `expected [] to deeply equal ['k_wpp', 'k_comercial', …]`, `expected undefined to be 'k_suporte'`). Os 6 que passaram são os que esperam `undefined`/vazio.
- **Traçador (fio):** os 16 casos falharam com `TypeError: Cannot read properties of undefined (reading 'id')`, porque o componente antigo ainda exige `contact` (Contato do estado antigo) e o teste só passa ids. É falha de contrato de props, não de asserção sobre o valor — o limite honesto de um RED de componente sem esqueleto; a diferença fica registrada. O GREEN passou 16/16 de uma vez (14 de primeira e 2 ajustes do próprio teste: o texto do diálogo ainda no DOM durante a animação de saída, e `canalSelecionado` controlado sem pai, que não deixa a aba clicada vencer).
- **Task 3:** 3 dos 4 casos novos falharam nas asserções planejadas (`Unable to find an accessible element with the role "textbox" and name "Primeira Mensagem"`, e o diálogo de confirmação nunca abriu porque o botão estava desligado); o (18) já passava e protege a regressão de reaproveitar a Conversa. Sem REFACTOR separado.

## Verificação

Nenhuma parte deste plano precisa de banco: os testes de domínio e web são jsdom/vitest puros, então nenhum Postgres nem contêiner foi criado.

- `packages/dominio`: suíte inteira 2410/2410 (126 arquivos); `tsc --noEmit` limpo; guarda `sem-crm-antigo` 2/2.
- `apps/api`: `tsc --noEmit` limpo (a api não mudou; confere que o domínio novo não quebra nada).
- `apps/web`: suíte inteira 1188/1188 (123 arquivos); `conversation-thread.test.tsx` 20/20; `tsc --noEmit` limpo; `eslint src/features/crm` sem achados; `verificar-tokens.mjs` 0 falhas.
- Critérios de aceitação: `enviarMensagem` no fio 3, `useMensagens` 3; `discardDraft|sendMessage(` 0; `export function` em `canais-de-resposta.ts` 8 (>= 6); `canaisDoFio(|canaisDeResposta(|canalPadraoDeResposta(` no fio 0; `abrirConversa` 2; `startConversation` 0; `dangerouslySetInnerHTML` 0.
- Não rodei `npm test` nem `npm run check` inteiros (regra do projeto); rodei por workspace e por arquivo.

## Deviations from Plan

### Auto-fixed Issues

**1. [Escolha do executor - ordem] A Task 2 (domínio) foi feita antes da Task 1 (traçador)**
- A Task 1 já precisa das abas e do Canal de resposta, e o fio não compila sem as peças `seletor`, `separador` e `selo` no tipo novo. As regras do domínio viraram folha da dependência: RED `613b260` + GREEN `ed3d7fc`; a parte web da Task 2 (retipar as três peças) entrou no GREEN da Task 1 (`9873d91`). Os critérios de aceitação das duas tarefas passam.

**2. [Rule 3 - Blocking] Arquivos fora de `files_modified` (cinco chamadores do selo e dois CONTEXT)**
- `SeloDoProvedor` passou a tipar com `Canal`; os chamadores que montavam o objeto antigo (`{ channelType, provider, relational, simulatedConnection }`) tiveram de passar o `Canal` (ou `{ tipo, provedor }`): `configuracoes/page.tsx`, `configuracoes/canais/[canal]/page.tsx`, `configuracoes/canais/conectar/page.tsx`, `cartao-conversacional.tsx` e `tarefa-completa.tsx` (uma linha cada; a segunda e a terceira também perderam o objeto `selos`). `SeloDeOrigem` trata `relational` ausente como "cadastrado" (todo `Canal` é da tabela). Mais `apps/web/src/sem-crm-antigo.test.ts` (uma linha a menos em `CONGELADOS`), `apps/web/CONTEXT.md`, `packages/dominio/CONTEXT.md` e `.planning/WINDOWS.md`.

**3. [Rule 1 - plano diverge do contrato] `capacidadesDoCanal(tipo, provedor)` não existe com essa assinatura**
- A função recebe um objeto: `capacidadesDoCanal({ channelType, provider })`. O fio chama assim, como já fazia `foraDaJanela` (15-11). O truth do plano descreve a regra, não a assinatura.

**4. [Visível, aberto em WINDOWS.md] Fora da janela do WhatsApp oficial o envio se desliga; sem Rascunho; sem aviso de consentimento até o 15-25**
- O fio antigo oferecia o seletor de Mensagem de modelo (só o Canal do seed tinha modelos) e o Rascunho de IA; o modelo novo não guarda nenhum dos dois (D-15-11, 15-12). O envio fica desligado com a frase "a janela de resposta expirou e este Canal não tem Mensagem de modelo aprovada". O aviso de consentimento de marketing do fio dependia do modelo escolhido e da Conversa antiga; saiu e volta pela regra do CRM novo no 15-25 (Task 2 dele). Linha `deviation` aberta (id 31).

**5. [Visível, aberto em WINDOWS.md] A aba Meet fica sem Reuniões até a migração; o fio mostra as 200 últimas Mensagens**
- Os Vínculos da Tarefa para Negócio apontam para ids do modelo antigo; a aba procura as Reuniões nos Negócios de `GET /negocios?contatoId=`. Com os ids preservados pelo script de migração o problema some (mesma regra das fichas do 15-13). Linha `deviation` aberta (id 32).

**6. [Rule 2 - Missing critical] Tamanho do fio e `keepPreviousData`**
- `GET /mensagens` entrega a mais antiga primeiro e para em 200; uma Conversa maior esconderia as mais novas. O fio ajusta o `deslocamento` para `total - 200` depois da primeira página, e só exibe Mensagens da Conversa da aba (o `keepPreviousData` do SWR mostraria a página da Conversa anterior ao trocar de aba).

**7. [Escolha do executor] "Conversa só com resolvidas"**
- O plano não decide. Mantive o comportamento do fio antigo: mostra a mais recente e responde nela por `POST /mensagens`; não abre outra. Se o dono quiser que responder numa resolvida abra uma Conversa nova, é uma regra a decidir no 15-24 (cabeçalho e gestos).

**8. [Escolha do executor] `tarefaId` declarada e ainda não lida**
- A prop existe no tipo (o plano a lista e a ficha da Tarefa já a passa), mas o fio não a usa nesta fase: é o 15-25 que liga a Nota e o "Criar Tarefa" à Tarefa aberta.

**Total deviations:** 1 Rule 1 (assinatura), 1 Rule 2, 1 Rule 3, 2 visíveis abertas em WINDOWS.md, 3 escolhas. **Impact:** o fio funciona todo pelo CRM novo; os dois itens abertos são limites de produto (modelo e Rascunho que o modelo novo não tem; Reuniões até a migração), não perda de dado.

## Known Stubs

Nenhum. O "Carregando a conversa…" é o estado real de espera das leituras, não um valor fixo.

## Threat Flags

Nenhum. T-15-50 (XSS por texto de Mensagem recebida): o texto entra como texto do React, sem `dangerouslySetInnerHTML` (zero no arquivo), e o caso (5) prova que `<script>…<img onerror>` aparece literal e que o fio não ganha elemento `script` nem `img`. T-15-51 (envio duplicado): `ref` + botão desligado, casos (2) e (19). T-15-52 (enviar fora da janela ou sem consentimento): quem decide é a api; casos (3) e (20) provam que a recusa aparece e nada é gravado.

## Observações para os planos seguintes

1. **15-25:** a Task 2 dele (consentimento no fio) começa de um fio SEM verificação de consentimento no cliente — `marketingConsentMissing` já saiu, o grep dele já é 0. A Nota ainda chama `addContactNote` pelo `run` do store (Contato do estado antigo) e o "Criar Tarefa" já usa `canaisDaListaNasTabelas`/`listaSemCanaisNasTabelas` com os Canais da api. `tarefa-completa.tsx` ainda acha o Contato por `contatoDaTarefa`.
2. **15-24:** `[conversa]/page.tsx` continua montando o fio só depois de achar o Contato no estado antigo; passa `conversaId={conversa}` e pode usar `onConversaAberta` para trocar a URL quando abrir a Conversa nova.
3. **15-40:** `deal-screen.tsx` só teve a prop do fio trocada; sai com o último chamador.
4. **15-42:** `canaisDoFio` e vizinhas de `derive-conversacional.ts` não têm mais chamador de produção no fio; `marcadoresDeCanal`, `rotuloDoCanal` e `textoDoSeparadorDeCanal` continuam em uso (o fio ainda chama `marcadoresDeCanal`, que é genérica e não lê o estado).
5. `requirements.ready-ids` respondeu 0/1 para UCR-05 (15-24 e 15-25 declaram o requisito e ainda não têm SUMMARY): não marquei `UCR-05` como concluído.

## Self-Check: PASSED

Arquivos criados presentes em disco (`canais-de-resposta.ts` e o teste); os sete commits da tarefa (`613b260`, `ed3d7fc`, `0012351`, `9873d91`, `b2a2ec2`, `817a93e`, `40ab1d3`) são ancestrais de `HEAD`.
