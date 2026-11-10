---
phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
plan: 32
subsystem: dominio-api-web
tags: [operacoes-antigas, crm-antigo, capacidades-de-canal, grupo-e-flow, tdd, ucr-12, tres-camadas]
status: complete

requires:
  - phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant
    provides: "15-31: o seed sem o CRM antigo e semearCrmAntigo para testes de codigo que sai; 15-40: contact-card.tsx sem chamador e as guardas da web em zero; 15-24: a Conversa de grupo na Caixa isolada em conversa-de-grupo-na-caixa.tsx"
provides:
  - "POST /operacoes/<nome antigo> responde 404 para 40 nomes (deals 12, Conversa 6, Contato e Empresa 19, iniciarConversa 1, criarCanal e configurarCanal 2), duas vezes seguidas, sem chamar pool()"
  - "OPERACOES passa de 285 para 245 operacoes; esquemas-de-argumentos.test.ts confere Object.keys(OPERACOES).length"
  - "packages/dominio/src/crm/capacidades.ts: ChannelType, ProvedorDeCanal, ChannelCapabilities, CHANNEL_CAPABILITIES e capacidadesDoCanal; types/crm.ts os reexporta"
  - "operations/ferramentas/conversa-de-grupo.ts: o minimo de operations/conversations.ts que Grupo, Flow, Automacao e a Conversa de grupo na Caixa ainda chamam"
  - "operations/{contacts,deals,iniciar-conversa,crm-antigo}.ts, esquemas de Contato, Negocio, Canal e Iniciar conversa e web/contact-card.tsx apagados"
affects: [15-33, 15-41, 15-42, 15-43]

plan_head_before: 67d71a02e06945ad3f372abb0aab91fe4ebb45be
plan_head_after: 5869fb801be923931abb5364b2f0c98aa7cce728
commits: 3

actuals:
  tokens: 60000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "o que as Ferramentas ainda chamam de um modulo apagado vai para um arquivo do proprio Grupo (ferramentas/conversa-de-grupo.ts), fora do barril de operacoes, com so as operacoes que uma tela ainda dispara registradas"
    - "teste de seguranca que precisa de uma operacao representativa usa uma operacao que continua existindo e que aplica a mesma regra (toggleConversationStar sobre a Conversa de grupo do seed), em vez de montar Contato antigo"
    - "contagem de operacoes nao e numero escrito a mao: Object.keys(OPERACOES).length"

key-files:
  created:
    - packages/dominio/src/crm/capacidades.ts
    - packages/dominio/src/operations/ferramentas/conversa-de-grupo.test.ts
    - packages/dominio/src/operations/operacoes-antigas-fora.test.ts
    - packages/dominio/src/operations/sobre-o-crm-antigo.test.ts
    - apps/api/src/rotas/operacoes-antigas-404.test.ts
  modified:
    - packages/dominio/src/operations/ferramentas/conversa-de-grupo.ts
    - packages/dominio/src/operations/{registro,index,canais}.ts
    - packages/dominio/src/operations/ferramentas/{automacoes,flows,grupos,participacoes,permissoes}.ts
    - packages/dominio/src/{provedores-de-canal,derive-conversacional}.ts
    - packages/dominio/src/crm/canais.ts
    - packages/dominio/src/types/crm.ts
    - packages/dominio/src/sem-crm-antigo.test.ts
    - packages/dominio/src/sem-listas-espelho.test.ts
    - packages/dominio/CONTEXT.md
    - apps/api/src/rotas/esquemas-de-argumentos.ts
    - apps/api/src/rotas/esquemas/conversas.ts
    - apps/api/src/servicos/crm/mensagens.ts
    - apps/api/src/sem-listas-espelho.test.ts
    - apps/web/src/sem-crm-antigo.test.ts
    - apps/web/CONTEXT.md
    - .planning/WINDOWS.md
  deleted:
    - packages/dominio/src/operations/{contacts,deals,iniciar-conversa,crm-antigo}.ts
    - packages/dominio/src/operations/{contacts,deals,conversations}.test.ts
    - apps/api/src/rotas/esquemas/{contatos,negocios,canais,iniciar-conversa}.ts (e os .test.ts)
    - apps/web/src/features/crm/contact-card.tsx

key-decisions:
  - "Resposta da checkpoint: remover. Os 40 nomes saem de OPERACOES; os cinco da Conversa de grupo (resolve, reopen, assign, trash, toggleConversationStar) ficam, no modulo do Grupo, porque conversa-de-grupo-na-caixa.tsx e a estrela de inbox-columns.tsx ainda os chamam pelo store (F14-D-05, WINDOWS 41)"
  - "operations/conversations.ts nao foi apagado: virou ferramentas/conversa-de-grupo.ts sem moveConversationToContact, discardDraft, restoreConversation e markConversationRead; startConversation, sendMessage, sendMessageSemConferencia e receiveMessage ficam como composicao interna, sem rota e fora do barril"
  - "recusaDeEscritaNoCrmAntigo (de crm-antigo.ts) e canonicalIdentifier (de contacts.ts) foram para os unicos chamadores que sobraram (conversa-de-grupo.ts e ferramentas/permissoes.ts)"
  - "Os blocos de operations.test.ts que testavam leitura ou mensagens que ficam (Suspeita de Duplicidade, Widget, Barra global, Mensageria, Modelo de Tarefa da Lista) foram movidos inteiros para sobre-o-crm-antigo.test.ts, que ainda usa semearCrmAntigo, em vez de apagados"

requirements-completed: []

coverage:
  - id: D1
    description: "POST /operacoes/<cada um dos 40 nomes antigos> responde 404 com a frase 'Operacao ... nao existe.', duas vezes seguidas, e nenhuma chamada a pool()"
    requirement: UCR-12
    verification:
      - { kind: integration, ref: "apps/api/src/rotas/operacoes-antigas-404.test.ts#POST /operacoes/<nome antigo> — o CRM antigo saiu do registro (15-32, UCR-12)", status: pass }
    human_judgment: false
  - id: D2
    description: "ehNomeDeOperacao e falso para os 40 nomes, nenhum esta no barril instrumentado, as cinco da Conversa de grupo e as de Grupo, Flow e Automacao seguem, e OPERACOES tem 245 chaves"
    requirement: UCR-12
    verification:
      - { kind: unit, ref: "packages/dominio/src/operations/operacoes-antigas-fora.test.ts", status: pass }
    human_judgment: false
  - id: D3
    description: "capacidadesDoCanal e CHANNEL_CAPABILITIES moram em crm/capacidades.ts e dao o mesmo resultado de antes (WhatsApp nao oficial sem janela de 24 h, janela e modelo do oficial); a api e a web importam de la"
    requirement: UCR-12
    verification:
      - { kind: unit, ref: "packages/dominio/src/crm/capacidades.test.ts", status: pass }
      - { kind: other, ref: "tsc --noEmit nas tres camadas dentro de npm run check", status: pass }
    human_judgment: false
  - id: D4
    description: "esquemas-de-argumentos.test.ts compara ESQUEMAS com Object.keys(OPERACOES) e a contagem e a do registro; as guardas D-06 das tres camadas ficam com lista congelada vazia e um arquivo-sentinela que existe"
    requirement: UCR-12
    verification:
      - { kind: unit, ref: "apps/api/src/rotas/esquemas-de-argumentos.test.ts#(j)", status: pass }
      - { kind: unit, ref: "packages/dominio/src/sem-listas-espelho.test.ts + apps/api/src/sem-listas-espelho.test.ts + apps/web/src/sem-listas-espelho.test.ts", status: pass }
    human_judgment: false
  - id: D5
    description: "Grupo, Flow e Automacao seguem compilando e com testes verdes; a Conversa de grupo ainda resolve, reabre, atribui, estrela e vai a lixeira pelo store, e o Convidado e o suspenso seguem recusados"
    requirement: UCR-12
    verification:
      - { kind: unit, ref: "packages/dominio/src/operations/ferramentas/conversa-de-grupo.test.ts", status: pass }
      - { kind: integration, ref: "apps/api/src/seguranca/matriz-de-papeis.test.ts (operacoes x 4 papeis, sobre toggleConversationStar)", status: pass }
    human_judgment: false
  - id: D6
    description: "A tela da Conversa de grupo na Caixa e a estrela do grupo na lista da Caixa continuam funcionando em navegador real depois que as 40 operacoes sairam do registro"
    verification: []
    human_judgment: true
    rationale: "So teste de componente e de rota; nenhuma tela foi aberta com npm run dev nesta sessao."

duration: 45min
completed: 2026-11-06
---

# Phase 15 Plan 32: as operacoes do CRM antigo saem do registro Summary

**40 operacoes do CRM antigo (deals, Contato, Empresa, Conversa 1:1, iniciar conversa, criar e configurar Canal) saem de `OPERACOES` e passam a responder 404 por `POST /operacoes/:nome`; as capacidades de Canal vao para `crm/capacidades.ts`; o que Grupo, Flow e a Conversa de grupo ainda chamam fica num arquivo proprio do Grupo; e as tres camadas passam no `npm run check` completo em Docker.**

Resposta da checkpoint: remover — dada pelo orquestrador a partir de "pode fazer o que precisar para fechar a fase" do dono em 2026-11-06, após conferir a evidência acima

## Performance

- **Duracao:** ~45 min de relogio (a rodada completa do `npm run check` leva ~6 min neste Postgres novo).
- **Tarefas:** 3 (a 1 e a checkpoint, respondida "remover" antes de eu comecar; as 2 e 3 sao TDD: 1 RED + 2 GREEN).
- **Arquivos:** 66 alterados contra a base do plano (`git diff --stat`: +1744 / -7465).

## Accomplishments

- **Registro.** `OPERACOES` perde as 40 operacoes e passa de 285 para 245; o barril `operations/index.ts` perde os `export *` e as linhas `instrumentar` delas. `esquemas-de-argumentos.ts` perde os esquemas de Contato, Negocio, Canal e Iniciar conversa (arquivos e testes apagados) e `conversas.ts` fica com cinco entradas. A contagem no teste e `Object.keys(OPERACOES).length`.
- **Capacidades de Canal.** `ChannelType`, `ProvedorDeCanal`, `ChannelCapabilities`, `CHANNEL_CAPABILITIES` e `capacidadesDoCanal` moram em `crm/capacidades.ts`; `types/crm.ts` reexporta os tres tipos (ate o 15-43), `provedores-de-canal.ts` e `crm/canais.ts` importam de la, e a api (`servicos/crm/mensagens.ts`) e sete arquivos da web trocaram o import do barril de operacoes.
- **Grupo, Flow e Automacao.** `operations/conversations.ts` virou `operations/ferramentas/conversa-de-grupo.ts` (git mv), sem as quatro operacoes que ninguem chama (`moveConversationToContact`, `discardDraft`, `restoreConversation`, `markConversationRead`). `grupos.ts`, `automacoes.ts` e `flows.ts` importam dele; `canonicalIdentifier` passou a `ferramentas/permissoes.ts`.
- **404 provado.** `operacoes-antigas-404.test.ts`: `it.each` sobre os 40 nomes, duas chamadas por nome, `pool()` trocado por um que conta e lanca (zero idas ao banco).
- **Guardas.** `sem-listas-espelho.test.ts` das tres camadas com `CONGELADOS` vazio e um sentinela que existe (`operations/registro.ts`, `rotas/esquemas-de-argumentos.ts`); no dominio `sem-crm-antigo.test.ts` perdeu `contacts`, `conversations`, `deals` e `iniciar-conversa` e ganhou `ferramentas/conversa-de-grupo.ts`; na web `contact-card.tsx` saiu de `CONGELADOS`.
- **Web.** `contact-card.tsx` apagado (sem chamador); nenhum outro componente ficou orfao segundo o `tsc`.

## Task Commits

1. **Task 1 (checkpoint:decision):** respondida "remover" pelo orquestrador (linha literal acima, tambem na mensagem do commit RED).
2. **Task 2 (dominio):** RED `38f6023` (test: 81 casos de dominio e 41 da api falham) -> GREEN `b0f4e6a` (feat: dominio).
3. **Task 3 (api e web):** `5869fb8` (feat: api e web, 404 provado, `contact-card.tsx` apagado). O `<automated>` da Task 3 e o `npm run check` descrito em Verificacao.

**Metadados do plano:** commit `docs(15-32)` seguinte (SUMMARY e WINDOWS.md), depois o de STATE/ROADMAP.

## TDD Gate Compliance

`test(15-32)` (`38f6023`) precede os dois `feat(15-32)`. `workflow.tdd_mode` e `false`: `gsd_run check tdd-red-evidence` nao foi usado e a saida do vitest foi lida a mao.

- **RED** (`38f6023`): `operacoes-antigas-fora.test.ts` (dominio) com 81 de 87 falhando por asseracao (`ehNomeDeOperacao(nome)` verdadeiro onde devia ser falso, `Object.hasOwn(barril, nome)` verdadeiro, `Object.keys(OPERACOES).length` 285 e nao 245) e `operacoes-antigas-404.test.ts` (api) com 41 de 41 falhando (a rota respondia 400, nao 404). Os 6 que passaram sao as guardas dos que ficam (as cinco da Conversa de grupo e as de Grupo/Flow/Automacao). Avaliacao semantica: o alvo rodou e falhou na asseracao planejada, nao em import ou sintaxe.
- **Fora do RED:** o teste de `capacidadesDoCanal` em `crm/capacidades.ts` e uma mudanca de lugar de um teste existente (`capacidades-do-canal.test.ts`), que so tem sentido depois que o modulo existe; ele nao passou por um RED separado.
- **GREEN** (`b0f4e6a`, `5869fb8`): 87 de 87 e 41 de 41 verdes. Nenhum REFACTOR separado.
- **Observacao honesta:** em `b0f4e6a` a api nao compila (os esquemas ainda apontam para operacoes que saíram); `5869fb8` a conserta. O escopo do plano previa isso ("dividir deixaria o tsc quebrado entre eles"): separei so para o historico ficar por camada.

## O que foi apagado ou movido nos testes

**Apagados com as operacoes que testavam:** `contacts.test.ts`, `deals.test.ts`, `conversations.test.ts` (movido, ver abaixo), 18 blocos de `operations.test.ts` (Requisito de Etapa, Regras de encerramento do Funil, Reabertura de Negocio, Remocao de Etapa, Descarte de Rascunho, Identificador de Contato, Mesclagem, Funil SDR -> Closer, Restauracao de copia mesclada, Mover Conversa, Importacao de Contatos, Migracao de Negocios, Criacao de registro de CRM, Limites e valor, Abrir atendimento, Qualificacao e Temperatura, Valor de Campo do Negocio, Roteiro de qualificacao), tres casos de blocos que ficam (Volumes do seed, Realce, Modelo de Tarefa da Lista), a parte de `criarCanal`/`configurarCanal`/`iniciarConversa` de `canais.test.ts`, e os testes de esquema de Contato, Negocio, Canal e Iniciar conversa na api.

**Movidos (nao apagados):** `capacidades-do-canal.test.ts` -> `crm/capacidades.test.ts`; `conversations.test.ts` -> `operations/ferramentas/conversa-de-grupo.test.ts` (reescrito para as cinco operacoes que ficam, sobre as Conversas de grupo do seed, e para as composicoes internas); oito blocos de `operations.test.ts` que testam leitura ou o que ficou (Mensageria, Adocao de Rascunho, Suspeita de Duplicidade, os dois de Leitura de Widget, Processo do Closer, Barra global, Modelo de Tarefa da Lista) -> `operations/sobre-o-crm-antigo.test.ts`, que ainda usa `semearCrmAntigo`. `operations.test.ts` terminou com 0 ocorrencias de `semearCrmAntigo`.

**Api (seguranca):** os testes que usavam `trashContact` como operacao representativa (matriz de Papeis, dados de outro Membro, inventario de rotas, entrada hostil, Membro suspenso) passaram a usar `toggleConversationStar` sobre a Conversa de grupo do seed, que aplica a mesma regra (`recusaDeEscritaNoCrmAntigo`, 200 com `ok: false` para o Convidado e 403 para o suspenso). `contatosDoVazamento` saiu de `testes/espaco-de-vazamento.ts`.

## Verificacao

Postgres 16 novo (`crm-n1-pg-1532`, porta 55732, migracoes 001-012), as duas URLs explicitas, `npm run check` da raiz, `RC=0` na primeira rodada:

- typecheck das tres camadas e lint (0 erros; 2 avisos antigos de `ia/conhecimento/rotulos.ts` e `shell/app-shell.tsx`); `verificar:tokens` ok (0 falhas); `verificar:contratos` pulou (repositorio irmao ausente).
- **Api:** 192 arquivos passaram, 2 pulados; 2458 testes (antes do plano: 2430), 2 esperados-falha, 21 pulados, 1 todo.
- **Web:** 132 arquivos, 1298 de 1298.
- **Dominio:** 129 arquivos, 2399 de 2399 (antes: 2464; saldo -65: os testes das operacoes apagadas saíram e os 87 casos de `operacoes-antigas-fora` e os de `conversa-de-grupo` entraram).
- Nenhuma falha de baseline (`outbox-worker`, `colunas-geradas`, `invocar-agente`) apareceu nesta rodada, entao nao houve o que provar isolado.
- Aceite por grep: `test ! -e` nos cinco modulos do dominio, em `rotas/esquemas/iniciar-conversa.ts` e em `contact-card.tsx` sai 0; `export function capacidadesDoCanal` em `crm/capacidades.ts` = 1; `semearCrmAntigo` em `operations.test.ts` = 0; `it.each` em `operacoes-antigas-404.test.ts` = 1.
- Guarda `sem-crm-antigo`: os arquivos tirados de `CONGELADOS` (`contacts.ts`, `conversations.ts`, `deals.ts`, `iniciar-conversa.ts` no dominio; `contact-card.tsx` na web) foram apagados, entao nao ha entrada velha para um arquivo apagado. `ferramentas/conversa-de-grupo.ts` entrou porque o regex o acha (le `state.contacts` e `state.channels`).
- Nenhum `.env` lido, nenhum `npm run build`, nada contra banco remoto, `~/n1-ensaio` intocado, nenhum contêiner `supabase_*` tocado; o contêiner `crm-n1-pg-1532` foi parado ao fim.
- AGENTS.md (Next.js com mudancas incompativeis): o unico codigo de `apps/web` tocado foi troca de import e a remocao de um componente; nenhuma API do Next foi usada, entao nao li o guia de `node_modules/next/dist/docs/`.

## Decisions Made

Ver `key-decisions`. A que mais pesa: **40 nomes, nao 45**. As cinco operacoes de Conversa que a Conversa de grupo na Caixa chama pelo store ficam em `OPERACOES`, porque tira-las quebraria em producao o menu de resolver/reabrir/atribuir/lixeira e a estrela dos Grupos, e o Grupo so passa ao modelo novo nas Sessoes 6 e 7.

## Deviations from Plan

**1. [Rule 3 - Bloqueio / regra do orquestrador] `operations/conversations.ts` nao foi apagado, e 5 dos 45 nomes ficam em `OPERACOES`.**
- **Found during:** Task 2 (leitura dos chamadores antes de apagar).
- **Issue:** `grupos.ts` e `automacoes.ts` importam `startConversation`/`sendMessage`/`sendMessageSemConferencia`, `flows.ts` importa `receiveMessage`/`sendMessage`, e `conversa-de-grupo-na-caixa.tsx` e `inbox-columns.tsx` ainda chamam `resolveConversation`, `reopenConversation`, `assignConversation`, `trashConversation` e `toggleConversationStar` pelo store (WINDOWS 41). Apagar o arquivo e os 11 nomes quebraria Grupo, Flow e Automacao na compilacao e a tela do Grupo na execucao, contra a regra F14-D-05 e a instrucao do orquestrador.
- **Fix:** `git mv` para `operations/ferramentas/conversa-de-grupo.ts`; saem dele as quatro operacoes sem chamador e `CHANNEL_CAPABILITIES`/`capacidadesDoCanal`; `recusaDeEscritaNoCrmAntigo` veio de `crm-antigo.ts` (que foi apagado como o plano manda); so as cinco continuam em `OPERACOES`, no barril e em `esquemas/conversas.ts`; o resto e composicao interna, fora do barril. A acceptance `test ! -e operations/conversations.ts` continua valendo.
- **Registrado em:** WINDOWS.md (linha aberta `deviation`, 15-32).
- **Commit:** `b0f4e6a`.

**2. [Rule 3 - Bloqueio] `canonicalIdentifier` mudou de modulo.** `ferramentas/participacoes.ts` e `permissoes.ts` o importavam de `contacts.ts`. Foi para `permissoes.ts` (o unico que o define), sem mudar a regra. **Commit:** `b0f4e6a`.

**3. [Cobertura mantida] Blocos de leitura e de mensageria movidos, nao apagados.** O plano manda apagar os blocos "que so testavam operacoes antigas"; Suspeita de Duplicidade, Leitura de Widget, Barra global, Mensageria e Modelo de Tarefa da Lista testam leituras do dominio ou funcoes que ficam. Foram para `sobre-o-crm-antigo.test.ts` (que ainda usa `semearCrmAntigo`), com os casos que chamavam operacao apagada retirados. Linha aberta em WINDOWS.md.

**4. [Rule 1 - redacao do plano] O plano pede para atualizar a guarda D-06 da web "se ela citar algo apagado".** Ela ja estava vazia desde o 15-40 e nao cita nada apagado; nao mudou. A de `sem-crm-antigo` da web perdeu `contact-card.tsx`.

**5. Trechos de testes de seguranca da api trocados de operacao** (`trashContact` -> `toggleConversationStar`): fora da lista de arquivos do plano, mas a operacao saiu do registro e o teste passaria a 404 por motivo errado. Mesma regra provada, em cinco arquivos.

**Total deviations:** 2 bloqueios/regra do orquestrador, 1 decisao de cobertura, 2 ajustes. **Impact:** o `POST /operacoes/<nome antigo>` responde 404 para 40 nomes e nao 45; o resto do plano (capacidades, esquemas, guardas, `contact-card.tsx`) esta como escrito.

## Known Stubs

Nenhum. (`sobre-o-crm-antigo.test.ts` usa o construtor de teste `semearCrmAntigo` por desenho, e esta registrado como divida.)

## Threat Flags

Nenhum. T-15-78 (operacao antiga gravando CRM antigo em `registros` depois do corte): mitigado, os 40 nomes respondem 404 sem ir ao banco e o `--verificar` do corte pega qualquer linha que reapareca. As cinco que ficam continuam recusando Convidado e Membro suspenso pelo dominio (`conversa-de-grupo.test.ts`) e pela rota (matriz de Papeis). T-15-79 (remocao quebrando uma tela nao migrada): mitigado pelo `tsc` das tres camadas e pelo gate completo; a unica tela que ainda dependia das operacoes (a Conversa de grupo) foi preservada.

## Issues Encountered

- Um script meu de edicao de `types/crm.ts` duplicou meio arquivo na primeira tentativa (o indice de busca achou a ocorrencia errada de um comentario); desfeito com `git checkout` do arquivo antes de qualquer commit e refeito com a busca a partir do ponto certo.
- O `git rm` de arquivos da api e da web, feito antes da divisao em dois commits, entrou no primeiro commit; desfeito com `git reset --soft` e `git restore --staged` (commits locais, ainda nao publicados) e recomitado por camada.
- Nada mais: nenhum disco apertado, nenhum contêiner ficou de pe.

## Windows (WINDOWS.md)

**Abertas (2, `deviation`):**
- `operations/ferramentas/conversa-de-grupo.ts`: o minimo de `conversations.ts` que Grupo, Flow, Automacao e a Conversa de grupo ainda usam; 5 nomes seguem em `OPERACOES` (40 respondem 404, nao 45); 15-42 e 15-43 nao podem apagar o arquivo; sai com as Sessoes 6 e 7.
- `operations/sobre-o-crm-antigo.test.ts` e `crm/capacidades.test.ts`: ainda usam `semearCrmAntigo`; o 15-42/15-43 os reescrevem sobre as tabelas ou apagam.

**Resolvidas:** nenhuma. A linha 41 (Conversa de grupo usa as operacoes antigas) continua aberta de proposito; a 37 (`startConversation` le Canal e Contato antigos) tambem.

## Next Phase Readiness

- Pronto para o 15-33 (a ponte dos Canais e as guardas finais da api e da web) e para o 15-42 (leituras antigas do dominio): as operacoes antigas ja nao existem; o `tsc` achara qualquer leitura esquecida.
- `requirements-completed: []`: UCR-12 e declarado tambem por outros planos da fase sem SUMMARY (`requirements.ready-ids`: 0/1 pronto), entao nao foi marcado.
- Limite honesto: nenhuma tela foi aberta em navegador real; a Conversa de grupo na Caixa (resolver, reabrir, atribuir, estrela, lixeira) so tem teste de dominio, de rota e de componente.

---
*Phase: 15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant*
*Completed: 2026-11-06*

## Self-Check: PASSED

- Arquivos criados conferidos no disco (`[ -f ]`): os 5 de `key-files.created`.
- Commits `38f6023`, `b0f4e6a` e `5869fb8` sao ancestrais do HEAD; `git log --grep` encontra 1 `test(15-32)` antes dos 2 `feat(15-32)`; `git rev-list --count 67d71a0..HEAD` = 3.
- O `<verification>` do plano foi o `npm run check` completo da Task 3, `RC=0`, depois de todas as edicoes de codigo.
