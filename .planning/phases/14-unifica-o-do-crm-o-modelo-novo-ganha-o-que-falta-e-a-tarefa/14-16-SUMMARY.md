---
phase: 14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa
plan: 16
subsystem: web
tags: [rest, tarefa-conversacional, rehidratar, d-07, d-06, sucessao, corte-da-fase-15]

requires:
  - phase: 14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa
    provides: "14-13/14-14 POST /tarefas-conversacionais e as rotas de canal, negocio e negocio/novo; 14-10 GET /membros/:id/sucessao-no-crm; 14-15 resumo da Tarefa e o que a ficha ainda lia do modelo antigo"
provides:
  - "dados/crm/tarefas-conversacionais.ts: criarTarefaConversacional, trocarCanalDaTarefa, vincularNegocioATarefa, criarNegocioDaTarefa, conversaAbertaDoPar e useConversaAbertaDoPar sobre a api"
  - "dados/crm/sucessao.ts: useSucessaoNoCrm e invalidarCrmDaSucessao"
  - "o diálogo de nova Tarefa conversacional, o botão Criar Tarefa do fio e os três gestos da ficha chamando as rotas REST, com rehidratar() depois (A5)"
  - "guarda de D-06 da web (src/sem-listas-espelho.test.ts) e a prova de que nenhum chamador web das quatro operações antigas resta"
affects: [14-17, 14-18, fase-15-telas-no-modelo-novo]

actuals:
  tokens: 31000
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Escrita do CRM na web: função REST + rehidratar() na tela (A5); a recusa da api sobe como ErroDeApi e fica dentro do diálogo"
    - "Campo condicional por leitura da api: useConversaAbertaDoPar governa 'Primeira Mensagem' (undefined = verificando, null = sem Conversa aberta)"
    - "Canal escolhido derivado no render (escolha explícita, ou o único possível), sem efeito"

key-files:
  created:
    - apps/web/src/dados/crm/sucessao.ts
    - apps/web/src/dados/crm/sucessao.test.ts
    - apps/web/src/sem-listas-espelho.test.ts
    - apps/web/src/features/estrutura/nova-tarefa-conversacional-dialog.test.tsx
    - apps/web/src/features/estrutura/tarefa-completa-gestos.test.tsx
    - apps/web/src/features/shell/membros-sucessao-no-crm.test.tsx
  modified:
    - apps/web/src/dados/crm/tarefas-conversacionais.ts
    - apps/web/src/dados/crm/tarefas-conversacionais.test.ts
    - apps/web/src/features/estrutura/nova-tarefa-conversacional-dialog.tsx
    - apps/web/src/features/crm/conversation-thread.tsx
    - apps/web/src/features/crm/conversation-thread.test.tsx
    - apps/web/src/features/estrutura/tarefa-completa.tsx
    - apps/web/src/features/estrutura/tarefa-completa-resumo.test.tsx
    - "apps/web/src/app/(shell)/configuracoes/membros/page.tsx"
    - apps/web/CONTEXT.md

key-decisions:
  - "Trocar o Canal da ficha confirma num diálogo (sempre), porque pode pedir a primeira Mensagem (D-07); o seletor só escolhe. Um clique a mais, mas a regra fica igual à do diálogo de nova Tarefa"
  - "conversaAbertaDoPar faz duas perguntas em paralelo (situacao=aberta e situacao=pendente, limite=1), porque GET /conversas aceita uma situação por vez; 'aberta' é a regra da api (aberta ou pendente, estado ativo)"
  - "Se a conferência da Conversa falhar, o campo 'Primeira Mensagem' aparece (obrigatório): com Conversa aberta a api o ignora, sem ela o exige"
  - "rehidratar() que falha depois de um sucesso da api não desfaz o aviso de sucesso: a Tarefa já existe e a revisão do Espaço alcança o store depois"
  - "O fio e o layout de três colunas da ficha continuam lendo contatoDaTarefa e canalDaTarefa (o fio inteiro troca de base na 3.4.2); só negocioDaTarefa e canaisDaListaQueAlcancam saíram de tarefa-completa.tsx"

requirements-completed: [UNI-12, UNI-15, UNI-16, UNI-11]

duration: 20min
completed: 2026-11-04
status: complete
plan_head_before: 716dada20427b65cd7f017d2cae5ed460465432f
plan_head_after: 70ee049fa3be8d23391d07307651f2da2cd35504
commits: 5

coverage:
  - id: D1
    description: "O diálogo de nova Tarefa conversacional chama POST /tarefas-conversacionais com ids das tabelas (Contato pelo SeletorDeRegistro, Canais por useCanais, Negócio por useNegocios), re-hidrata e fecha; a recusa da api fica no diálogo"
    requirement: "UNI-15"
    verification:
      - kind: unit
        ref: "apps/web/src/features/estrutura/nova-tarefa-conversacional-dialog.test.tsx#criar a Tarefa pela rota"
        status: pass
      - kind: unit
        ref: "apps/web/src/dados/crm/tarefas-conversacionais.test.ts#as mutações da Tarefa conversacional"
        status: pass
    human_judgment: false
  - id: D2
    description: "D-07: o campo 'Primeira Mensagem' aparece só sem Conversa aberta do Contato no Canal, no diálogo e ao trocar o Canal na ficha"
    requirement: "UNI-12"
    verification:
      - kind: unit
        ref: "apps/web/src/features/estrutura/nova-tarefa-conversacional-dialog.test.tsx#a Primeira Mensagem (D-07)"
        status: pass
      - kind: unit
        ref: "apps/web/src/features/estrutura/tarefa-completa-gestos.test.tsx#(b) sem Conversa aberta no Canal novo"
        status: pass
      - kind: unit
        ref: "apps/web/src/dados/crm/tarefas-conversacionais.test.ts#conversaAbertaDoPar"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-06: o diálogo não cita mais a regra de formato de id das Listas espelho; a guarda da web congela os dois arquivos que ainda citam"
    requirement: "UNI-16"
    verification:
      - kind: unit
        ref: "apps/web/src/sem-listas-espelho.test.ts#D-06"
        status: pass
    human_judgment: false
  - id: D4
    description: "O botão Criar Tarefa do fio e os três gestos da ficha (trocar Canal, ligar Negócio, criar Negócio) chamam as rotas REST e re-hidratam; nenhum chamador web das quatro operações antigas resta"
    requirement: "UNI-12"
    verification:
      - kind: unit
        ref: "apps/web/src/features/estrutura/tarefa-completa-gestos.test.tsx"
        status: pass
      - kind: unit
        ref: "apps/web/src/features/crm/conversation-thread.test.tsx#Criar Tarefa numa Lista conversacional (14-16)"
        status: pass
      - kind: unit
        ref: "apps/web/src/sem-listas-espelho.test.ts#nenhum chamador web das operações antigas"
        status: pass
    human_judgment: false
  - id: D5
    description: "UNI-11 (lado web): o diálogo de remover Membro mostra Contatos, Empresas, Negócios e Conversas liberadas das tabelas; Agentes e o resto seguem de previewSuccession"
    requirement: "UNI-11"
    verification:
      - kind: unit
        ref: "apps/web/src/features/shell/membros-sucessao-no-crm.test.tsx"
        status: pass
      - kind: unit
        ref: "apps/web/src/dados/crm/sucessao.test.ts"
        status: pass
    human_judgment: false
  - id: D6
    description: "O fluxo de ponta a ponta (criar pela Lista com e sem Conversa aberta, trocar Canal, criar Negócio pela ficha, contagens da remoção) contra a api real num Postgres local migrado"
    requirement: "UNI-12"
    verification: []
    human_judgment: true
    rationale: "O <human-check> da Task 3 não foi rodado: tudo foi provado com api, hooks e estado falsos. Só faz sentido depois do script de migração da Fase 15, quando Tarefas e Conversas apontam para ids novos."
---

# Phase 14 Plan 16: Chamadores web da Tarefa conversacional e a prévia da sucessão nas tabelas Summary

**O diálogo de nova Tarefa, o botão "Criar Tarefa" do fio e os três gestos da ficha (trocar Canal, ligar e criar Negócio) chamam `POST /tarefas-conversacionais…` com ids das tabelas novas e re-hidratam o store depois (A5); a "Primeira Mensagem" (D-07) só aparece sem Conversa aberta; o diálogo de remover Membro lê as contagens de `GET /membros/:id/sucessao-no-crm`.**

## Só no deploy da Fase 15

Este plano é CORTE (D-01), como o 14-15. Os cinco commits abaixo ficam no ramo `fase-13-gravacao-em-menos-idas-e-voltas` e **não podem subir antes do script de migração da Fase 15**. A fronteira de deploy aditiva continua sendo o commit `b9c3d86` (fim do 14-14); tudo depois dele, do 14-15 em diante, é corte.

| Commit | O que é |
|---|---|
| `bb56bce` | RED do cliente REST, do diálogo e da guarda de D-06 (só teste) |
| `84b0b66` | cliente REST em `tarefas-conversacionais.ts` + o diálogo de nova Tarefa |
| `aa93b2a` | botão do fio + os três gestos da ficha |
| `9260095` | diálogo de remover Membro + `apps/web/CONTEXT.md` |
| `70ee049` | guarda: nenhum chamador web das quatro operações antigas |

Por quê: hoje as Tarefas, Conversas, Contatos e Canais que a tela mostra têm ids do modelo antigo. Estas telas mandam esses ids às rotas novas, que respondem 404 para eles (T-14-40). O diálogo de nova Tarefa aberto pela Caixa antiga (`caixa-de-entrada/[conversa]/page.tsx`) e pela ficha antiga do Contato (`legado/ficha-de-contato-legado.tsx`) passa `contactId`/`channelId` antigos: só passam a valer com a migração. Nenhum arquivo de `apps/api`, do domínio ou de migração mudou neste plano.

## Performance

- **Duration:** ~20 min (20:08 a 20:27 UTC, estimado: a hora de início não foi gravada)
- **Tasks:** 3 (Task 1 em RED/GREEN; Tasks 2 e 3 `auto`)
- **Files modified:** 15 (6 novos, 9 alterados)

## Accomplishments

- **Cliente REST.** `criarTarefaConversacional` devolve `{ task, conversa }`; `trocarCanalDaTarefa`, `{ task, mudou, conversa }`; `vincularNegocioATarefa`, a Tarefa; `criarNegocioDaTarefa`, `{ task, negocio }`. Só ids e `mensagem` vão no corpo. O cache do SWR é invalidado só no sucesso (`/conversas`; no Negócio novo, também `/negocios`, `/funis`, `/contatos`, `/empresas`).
- **`conversaAbertaDoPar` / `useConversaAbertaDoPar`.** Duas perguntas paralelas a `GET /conversas` (`aberta` e `pendente`, `estado=ativo`, `limite=1`). O hook devolve `undefined` enquanto verifica, `null` sem Conversa aberta e `{ id }` com uma; a chave leva o par, então trocar o Canal volta a "verificando".
- **Diálogo de nova Tarefa.** Contato por `SeletorDeRegistro` (ou o nome vindo de `useContato` quando o Contato é dado), Canais por `useCanais` + `canaisDaListaQueAlcancamNasTabelas` com os Identificadores do Contato, Negócios abertos por `useNegocios({ contatoId })`. O Canal efetivo é derivado no render. Botão "Criar" espera a resposta (`confirmCarregando`), re-hidrata e avisa quem abriu. Saiu a regra de formato de id das Listas espelho e o filtro de "cópias do Funil".
- **Botão do fio.** A Tarefa conversacional chama a rota com o Contato e o Canal da aba (sem `mensagem`: a Conversa do fio está aberta); a operacional segue por `run(createTask)`.
- **Ficha da Tarefa.** O seletor de Canal abre um diálogo "Trocar o Canal da Tarefa" que pede a primeira Mensagem quando precisa; o seletor de Negócio usa `useNegocios` do Contato do resumo (o sobrevivente se foi mesclado) e liga/desliga pela rota; "Criar Negócio" usa os Funis de `useFunis` e manda `funilId`, `titulo` e `valor` em texto. Os `disabledReason` do menu decidem pelo resumo. Recusas da api aparecem no lugar das mensagens antigas.
- **Remover Membro.** `useSucessaoNoCrm` alimenta Contatos, Empresas, Negócios e Conversas liberadas; Agentes, Automações, Painéis, Coleções, Formulários, Tarefas e Itens de Checklist continuam de `previewSuccession` (os tipos do CRM saem dele). Sem a resposta a tela diz "Contando o que está no CRM…"; com recusa da api mostra a frase dela. Depois da remoção invalida `/contatos`, `/empresas`, `/negocios` e `/conversas`.
- **Guardas.** `apps/web/src/sem-listas-espelho.test.ts` congela `features/crm/iniciar-conversa-dialog.tsx` e `features/estrutura/dialogos-da-lista.tsx` e proíbe um terceiro; um segundo `describe` garante que ninguém na web importa as quatro operações antigas de `@n1/dominio/operations`.
- **`apps/web/CONTEXT.md`** registra `dados/crm/tarefas-conversacionais.ts` (a pendência que o 14-15 deixou), os chamadores REST, o `rehidratar()` (A5), `sucessao.ts` e o corte da Fase 15.

## Task Commits

1. **Task 1: diálogo de nova Tarefa conversacional** — `bb56bce` (test, RED), `84b0b66` (feat, GREEN)
2. **Task 2: botão do fio e três gestos da ficha** — `aa93b2a` (feat; testes junto)
3. **Task 3: remover Membro** — `9260095` (feat; testes junto)
4. **Prova da proibição** — `70ee049` (test)

**Plan metadata:** commits `docs(14-16)` seguintes (SUMMARY, STATE e ROADMAP).

## TDD Gate Compliance

- **Task 1 (RED):** 16 dos 29 casos falharam pelos motivos certos antes do GREEN: `criarTarefaConversacional is not a function` (e as outras quatro funções), a guarda de D-06 apontando `nova-tarefa-conversacional-dialog.tsx` como arquivo novo que cita as Listas espelho, e o diálogo sem o campo "Primeira Mensagem". O commit RED traz só testes. Avaliação semântica: as falhas são as do plano (comportamento ausente), não de sintaxe nem de fixture.
- GREEN passa (29/29). As Tasks 2 e 3 não são `tdd`; foram entregues com os testes juntos.

## Deviations from Plan

**1. [Interpretação] Trocar o Canal sempre confirma num diálogo**
- O plano diz "o campo de primeira Mensagem por `conversaAbertaDoPar`, como no diálogo". O seletor da linha só escolhe o Canal e abre "Trocar o Canal da Tarefa", onde o campo aparece ou não. Custa um clique a mais quando há Conversa aberta; a alternativa (perguntar antes e trocar direto) esconderia a Mensagem obrigatória atrás de uma chamada assíncrona no `onChange`.

**2. [Interpretação] `useConversaAbertaDoPar` além da função `conversaAbertaDoPar`**
- A interface do plano só tinha a função (Promise). O hook (SWR) é o que governa o campo no diálogo e na ficha, para o campo reagir a trocar de Canal sem efeito. `grep -c conversaAbertaDoPar` no diálogo é 1 (o nome aparece num comentário; o código usa o hook, que a chama).

**3. [Rule 3 - Bloqueio] Fixture do 14-15 atualizada**
- `tarefa-completa-resumo.test.tsx` mockava `tarefas-conversacionais` só com `useResumoDaTarefa`; a ficha agora importa mais quatro nomes do módulo e chama `useContato`, `useCanais`, `useNegocios` e `useFunis`. Acrescentei os mocks. Arquivo fora de `files_modified`, ajuste forçado pela mudança.

**4. [Escopo] Arquivos de teste novos fora de `files_modified`**
- `nova-tarefa-conversacional-dialog.test.tsx`, `tarefa-completa-gestos.test.tsx`, `membros-sucessao-no-crm.test.tsx`, `sucessao.test.ts` e o acréscimo a `conversation-thread.test.tsx`: o plano pede os comportamentos, não nomeia os arquivos de teste.

**5. [Rule 2 - Correção] Invalidação do CRM em cache depois de remover o Membro**
- O plano manda só trocar as contagens. Sem invalidar, as listas de Contatos, Empresas e Negócios em cache mostrariam o dono antigo depois que o servidor passa os registros ao Sucessor. `invalidarCrmDaSucessao()` roda depois do `removeMember` bem-sucedido.

**6. [Interpretação] `assignees` não vai no botão do fio**
- Antes a operação recebia o Membro da sessão; a rota usa o Membro da sessão como padrão (o domínio faz `assignees ?? [membro]`), então o corpo não o repete.

**Total deviations:** 6 (3 interpretações, 1 bloqueio de fixture, 1 correção, 1 de escopo de testes). **Impact:** nenhum arquivo de produção fora de `files_modified` (exceto os de teste); `apps/api`, domínio e migrações intactos.

## O que ficou na leitura antiga

- `tarefa-completa.tsx` ainda importa `contatoDaTarefa` e `canalDaTarefa` (e `vinculosDoCrmDaTarefa`) só para o fio de Mensagens (`ConversationThread contact={contato}`) e para o layout de três colunas (`fichaConversacional`). Saíram `negocioDaTarefa` e `canaisDaListaQueAlcancam`. Com ids novos essas duas leituras voltam `undefined`: a ficha mostra a seção CRM e os gestos, mas não o fio. Quem entrega o fio no modelo novo é a Fase 15 (3.4.2).
- O 14-17 só pode apagar `contatoDaTarefa` e `canalDaTarefa` quando o fio da ficha trocar de base; hoje ainda têm chamador de produção (`tarefa-completa.tsx`) e `ConversationThread` (o plano 14-17 já prevê "se acha chamador, mantém e anota").
- `conversation-thread.tsx` ainda confere `canaisDaLista(state, lista)` e `listaSemCanais` do modelo antigo antes de chamar a rota do botão (mensagem amigável); a api repete a conferência.

## Issues Encountered

- Nenhuma falha. Suíte inteira do `apps/web`: 107 arquivos, 1030 testes passam. `tsc --noEmit` limpo. `eslint .`: 0 erros, 2 avisos antigos (`rotulos.ts`, `app-shell.tsx`), nenhum de arquivo meu. `verificar:tokens`: 0 falhas. As duas guardas D-06 (domínio e api) passam.
- O `<human-check>` da Task 3 (api real num Postgres local migrado) não foi rodado: foi provado com api, hooks e estado falsos. Faz sentido refazer depois do script de migração da Fase 15.

## Known Stubs

Nenhum. Os estados "Carregando os Canais…", "Contando o que está no CRM…" e "Conferindo a conversa…" são de carregamento, não dado falso.

## Threat Flags

Nenhuma superfície nova. T-14-40 (publicar os chamadores antes do script da Fase 15): ver a seção "Só no deploy da Fase 15"; o 14-18 registra a fronteira em `14-PROVAS.md`. T-14-41 (a tela mandar referências "conferidas"): as funções só mandam ids e `mensagem` (os testes conferem as chaves exatas do corpo), e os corpos `.strict()` da api recusam o resto.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **14-17** (corte): nenhum chamador web das quatro operações antigas resta (guarda em `src/sem-listas-espelho.test.ts`), então o corte pode tirá-las de `OPERACOES`. `contatoDaTarefa` e `canalDaTarefa` seguem com chamador de produção (fio da ficha, `ConversationThread`); `negocioDaTarefa` segue em `quadro-negocios.tsx` e no cartão do Negócio (14-15). `canaisDaListaQueAlcancam` ainda é usada pelo diálogo antigo? Não neste arquivo; o 14-17 confere com `grep`.
- **14-18** (fechamento): registrar a fronteira de deploy da Fase 15 (aditivo = `b9c3d86`; corte = 14-15, 14-16, 14-17) em `14-PROVAS.md`. O `<human-check>` deste plano e o do 14-15 viram prova manual depois da migração.
- **Fase 15:** os diálogos abertos pela Caixa antiga e pela ficha antiga do Contato passam ids antigos de Contato e Canal ao diálogo novo; a Caixa nova (3.4.2) e a migração resolvem. O fio e o layout de três colunas da ficha da Tarefa dependem da Caixa nova.

## Self-Check: PASSED

- Arquivos criados existem: `sucessao.ts`, `sucessao.test.ts`, `sem-listas-espelho.test.ts`, `nova-tarefa-conversacional-dialog.test.tsx`, `tarefa-completa-gestos.test.tsx`, `membros-sucessao-no-crm.test.tsx`.
- Commits `bb56bce`, `84b0b66`, `aa93b2a`, `9260095`, `70ee049` são ancestrais de HEAD; `commits: 5` medido de `plan_head_before` a `plan_head_after`.
- Critérios de aceitação: Task 1 (`rehidratar` no diálogo = 2, `conversaAbertaDoPar` no diálogo = 1, `sem-listas-espelho.test.ts` existe e passa); Task 2 (`criarNegocioDaTarefa|trocarCanalDaTarefa|vincularNegocioATarefa` em `tarefa-completa.tsx` = 6, todas de `@/dados/crm/tarefas-conversacionais`; `@/dados/crm/tarefas-conversacionais` no fio = 1); Task 3 (`useSucessaoNoCrm` na página = 3, `sucessao-no-crm` em `sucessao.ts` = 2).
- `<verification>` do plano: `tsc --noEmit` e `vitest run src/dados src/features/crm src/features/estrutura src/sem-listas-espelho.test.ts` verdes; suíte inteira, lint e tokens como acima.
