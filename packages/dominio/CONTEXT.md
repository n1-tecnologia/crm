# Domínio — o contrato

Ler primeiro: [`../../CONTEXT.md`](../../CONTEXT.md)

## O que entra

Nada. Esta camada não importa de ninguém — nem React, nem Next, nem driver de
banco, nem `fetch`. A única dependência é `zod`, para descrever formatos.

Se um `import` daqui precisar apontar para fora do pacote, a regra em questão
provavelmente não é de domínio, ou o que ela precisa deveria ter descido para cá.

## O que sai

Pela porta da frente, `@n1/dominio`:

| Subcaminho | O que entrega |
|---|---|
| `@n1/dominio` | Barril: tipos, estado, rótulos, `diferenca`, mais `operations` e `derive` como espaços de nome |
| `@n1/dominio/types` | As entidades da ontologia |
| `@n1/dominio/state` | `DataState`, `OperationResult`, `Session` |
| `@n1/dominio/operations` | O que **grava**: uma função por caso de uso |
| `@n1/dominio/operations/registro` | `OPERACOES` (a allowlist que `POST /operacoes/:nome` despacha) e o gravador de chamadas (`gravarChamadas`/`instrumentar`) que o `run()` do web usa para saber o que mandar ao servidor |
| `@n1/dominio/diferenca` | A forma do diff que a persistência devolve (`RegistroGravado`/`RegistroRemovido`) e `aplicarDiferenca`, que o cliente usa para aplicá-lo respeitando a `ordem` fracionária |
| `@n1/dominio/derive` | O que **recompõe**: leituras que nunca são armazenadas |
| `@n1/dominio/seed*` | Os dados fictícios do protótipo |
| `@n1/dominio/bootstrap-gestao` | `buildGestaoBootstrap()` — o estado inicial de produção do Espaço "Gestão": a configuração do Financeiro, sem fixtures |

`operations` e `derive` são separados de propósito. `derive` recalcula a partir
do estado gravado toda vez, porque a ontologia exige (B36, B45, B100, RN-CRM-16):
nada derivado é persistido. Misturar os dois faria um valor derivado virar um
valor guardado sem ninguém perceber.

`operations/index.ts` reexporta cada operação **instrumentada** (embrulhada por
`instrumentar`, não a versão crua do módulo): é o que faz `gravarChamadas`
observar nome e argumentos de uma chamada sem que `apps/web` precise mudar
como chama — o closure continua o mesmo, só a exportação por baixo mudou.

## O que não mora aqui

- **Estado reativo.** O store zustand é adaptador de interface e vive em `apps/web/src/dados/`.
- **Persistência.** Hoje não existe; quando existir, é de `apps/api/`.
- **Texto de tela.** Com uma exceção: `rotulos.ts`, que `derive` precisa para
  nomear o Ator de um Registro. A interface reexporta de lá, para haver uma
  fonte só.

`seed-financeiro.ts`/`seed-contas-a-receber.ts` aceitam `{ fixtures: false }`
(padrão `true`): monta só a configuração do processo, sem os Membros e as
Tarefas fictícias que reproduzem o histórico do ClickUp — é o que
`bootstrap-gestao.ts` usa.

## Quando mexer

Campo novo, regra nova, status novo, caso de uso novo. Toda mudança aqui é
sentida pelos dois consumidores — é o preço de ser o contrato, e a razão de os
testes (`npm run test -w @n1/dominio`) serem a rede de segurança mais importante
do repositório.

## Quem pode (1.2.4)

Uma linha por chave de `OPERACOES` (`operations/registro.ts`): a operação, o módulo onde ela mora, a recusa que ela chama antes de gravar e, quando vale dizer, o porquê. `src/quem-pode.test.ts` lê esta tabela e deixa o `npm run check` vermelho se faltar uma operação, sobrar uma, repetir uma, ficar uma "Conferência" vazia ou pendente, ou se uma linha disser "sem conferência" sem justificar. **Operação nova precisa de linha aqui.**

Duas coisas valem para a tabela inteira. O 403 de Membro `suspenso` (`recusaDeSuspenso`, na rota `POST /operacoes/:nome`, 1.2.1) vale para toda operação antes de qualquer recusa abaixo: o domínio só repete a barreira onde a linha diz. E as variantes `…SemConferencia` (09-03, como `sendMessageSemConferencia`) não são operações registradas: ficam fora do registro e, por isso, fora da tabela.

O que cada nome de recusa quer dizer, em uma linha:

- `taskWriteRefusal` (`derive.ts`): Membro ativo, não Convidado, que vê a Tarefa e, se só chega a ela por concessão, tem `editar`, `excluir` ou `administrar`. `mayWriteTask`, `mayWriteTaskStatus` e `mayWriteFieldOrComment` a embrulham; as duas últimas abrem a exceção do Agente do pipeline (só Status, §9) e da Pessoa da conta (só os Campos liberados da Lista).
- `taskCommentRefusal` / `commentEditRefusal`: a anterior, mais `comentar`; a segunda ainda exige ser o autor do Comentário ou administrar a Lista.
- `listWriteRefusal` (`tasks.ts`): Membro ativo, não Convidado, que alcança a Lista (criar Tarefa).
- `containerAdminRefusal` (`derive.ts`): Administrador ou Proprietário que alcança o contêiner, ou concessão `administrar` nele ou acima. `mayConfigure` e `sprintFolder` a embrulham. `containerTrashRefusal` (`structure.ts`) aceita também a concessão `excluir`.
- `mayBuild` (`structure.ts`): criar contêiner. Membro ativo, não Convidado, que alcança o pai.
- `templateAdminRefusal` / `recusaDeGerirTags` / `recusaDeGerirCanais`: Administrador ou Proprietário ativo (catálogo de Templates), ou quem administra o Espaço (Tags, Canais).
- `mayEditView`: o dono da Visão pessoal, ou `containerAdminRefusal` na compartilhada.
- `recusaDeEscritaNoCrmAntigo` (`crm-antigo.ts`, 09-03): Membro ativo de Papel base diferente de Convidado. `mayCreateCrmRecord` (`contacts.ts`) é a mesma regra com a frase "cria registro", nas seis operações de Contato e Empresa que já conferiam.
- `recusaDeMembroAtivo`: em `ferramentas/` (`ferramentas/permissoes.ts`) exige Membro ativo e não Convidado; em `ia/` (`ia/permissoes-ia.ts`) exige só Membro ativo, e o Convidado é barrado por outra recusa da mesma linha quando existe. `recusaDeAdministracao` (Ferramentas): Proprietário ou Administrador.
- `recusaDeConvidado`, `recusaDeGovernarAgente`, `recusaDeGovernarHabilidade`, `recusaDeAdministrarAutomacao`, `recusaDeAdministrarIntegracao`, `recusaNaColecao`, `recusaNoDocumento` (`ia/permissoes-ia.ts`): a IA por objeto. Convidado nunca cria nem edita; editar é do dono ou criador do objeto ou de quem administra o Espaço.
- `mayDecideApproval` (`ai.ts`): o aprovador designado, o dono do Agente (só na Aprovação de Agente) ou um Administrador ou Proprietário ativo.
- `dono do registro` e `recusa embutida (…)`: não há função de recusa nomeada; a conferência está no corpo da operação e a coluna Observação diz qual é.
- `sem conferência`: a operação não confere quem chama, e a Observação diz por quê. Quando a justificativa honesta não existe, a Observação começa por **LACUNA**: a operação é um achado para a suíte adversarial (09-12 e 09-15) e para a passada exploratória (09-21), e não uma decisão aceita.

| Operação | Arquivo | Conferência | Observação |
|---|---|---|---|
| `createTask` | `operations/tasks.ts` | `listWriteRefusal` | `vinculoRefusal` confere o alcance dos vínculos da Tarefa nova |
| `changeTaskStatus` | `operations/tasks.ts` | `taskWriteRefusal` | via `mayWriteTaskStatus` (exceção do Agente do pipeline, §9); `entryRefusal` confere quem entra no Status (RN-CP-04) |
| `assignTask` | `operations/tasks.ts` | `taskWriteRefusal` | via `mayWriteTask`; quem recebe a responsabilidade também precisa ver a Tarefa (RN-TAR-06) |
| `unassignTask` | `operations/tasks.ts` | `taskWriteRefusal` | via `mayWriteTask` |
| `moveTask` | `operations/tasks.ts` | `taskWriteRefusal`, `listWriteRefusal` | via `mayWriteTask` na Tarefa; `listWriteRefusal` confere a Lista de destino |
| `convertChecklistItem` | `operations/tasks.ts` | `taskWriteRefusal`, `listWriteRefusal` | via `mayWriteTask`; a Tarefa nova nasce por `createTask` |
| `trashTask` | `operations/tasks.ts` | `taskWriteRefusal` | via `mayWriteTask` |
| `restoreTask` | `operations/tasks.ts` | `taskWriteRefusal` | via `mayWriteTask` |
| `purgeTask` | `operations/tasks.ts` | `taskWriteRefusal` | via `mayWriteTask` |
| `purgeExpiredTasks` | `operations/tasks.ts` | `containerAdminRefusal` | administrar a Lista; Membro ativo |
| `restoreList` | `operations/tasks.ts` | `containerTrashRefusal` | alcance (`memberReachesContainer`) e excluir ou administrar a Lista, como `restoreContainer` (09-03) |
| `addChecklist` | `operations/tasks.ts` | `taskWriteRefusal` | via `mayWriteTask` |
| `addChecklistItem` | `operations/tasks.ts` | `taskWriteRefusal` | via `mayWriteTask` |
| `setChecklistItemDone` | `operations/tasks.ts` | `taskWriteRefusal` | via `mayWriteTask` |
| `removeChecklist` | `operations/tasks.ts` | `taskWriteRefusal` | via `mayWriteTask` |
| `removeChecklistItem` | `operations/tasks.ts` | `taskWriteRefusal` | via `mayWriteTask` |
| `startMeeting` | `operations/tasks.ts` | `taskWriteRefusal` | via `mayWriteTask` |
| `endMeeting` | `operations/tasks.ts` | `taskWriteRefusal` | via `mayWriteTask` |
| `updateTask` | `operations/tasks.ts` | `taskWriteRefusal` |  |
| `setTaskFieldValue` | `operations/tasks.ts` | `taskWriteRefusal` | via `escritaDeCampo` e `mayWriteFieldOrComment`; a Pessoa da conta (Convidado) só preenche os Campos que a Lista liberou |
| `addTaskComment` | `operations/tasks.ts` | `taskCommentRefusal` | `comentar` basta; a Pessoa da conta (Convidado, `guestFieldWriter`) também comenta |
| `editTaskComment` | `operations/tasks.ts` | `commentEditRefusal` | `taskCommentRefusal` e ser o autor do Comentário ou administrar a Lista |
| `deleteTaskComment` | `operations/tasks.ts` | `commentEditRefusal` | `taskCommentRefusal` e ser o autor do Comentário ou administrar a Lista |
| `resolveTaskComment` | `operations/tasks.ts` | `taskWriteRefusal` | via `mayWriteTask`; resolver o fio de outra pessoa exige ser Administrador ou Proprietário (`isWorkspaceAdmin`) ou, no fio do Resumo, o aprovador ou revisor da Conferência vigente |
| `setTaskTags` | `operations/tasks.ts` | `taskWriteRefusal` | via `mayWriteTask` |
| `watchTask` | `operations/tasks.ts` | `memberSeesTask`, `taskWriteRefusal` | observar a si mesmo exige ver a Tarefa; pôr outro Membro como Observador exige `mayWriteTask` |
| `moveDealToStage` | `operations/deals.ts` | `recusaDeEscritaNoCrmAntigo` |  |
| `winDeal` | `operations/deals.ts` | `recusaDeEscritaNoCrmAntigo` |  |
| `loseDeal` | `operations/deals.ts` | `recusaDeEscritaNoCrmAntigo` |  |
| `reopenDeal` | `operations/deals.ts` | `recusaDeEscritaNoCrmAntigo` |  |
| `linkContactToDeal` | `operations/deals.ts` | `recusaDeEscritaNoCrmAntigo` |  |
| `removeStage` | `operations/deals.ts` | `recusaDeEscritaNoCrmAntigo` |  |
| `migrateDealsToFunnel` | `operations/deals.ts` | `recusaDeEscritaNoCrmAntigo` |  |
| `restoreDeal` | `operations/deals.ts` | `recusaDeEscritaNoCrmAntigo` |  |
| `moveDealToFunnel` | `operations/deals.ts` | `recusaDeEscritaNoCrmAntigo` |  |
| `createDeal` | `operations/deals.ts` | `recusaDeEscritaNoCrmAntigo` |  |
| `unlinkContactFromDeal` | `operations/deals.ts` | `recusaDeEscritaNoCrmAntigo` |  |
| `setDealFieldValue` | `operations/deals.ts` | `recusaDeEscritaNoCrmAntigo` |  |
| `sendMessage` | `operations/conversations.ts` | `recusaDeEscritaNoCrmAntigo` |  |
| `resolveConversation` | `operations/conversations.ts` | `recusaDeEscritaNoCrmAntigo` |  |
| `reopenConversation` | `operations/conversations.ts` | `recusaDeEscritaNoCrmAntigo` |  |
| `assignConversation` | `operations/conversations.ts` | `recusaDeEscritaNoCrmAntigo` |  |
| `trashConversation` | `operations/conversations.ts` | `recusaDeEscritaNoCrmAntigo` |  |
| `moveConversationToContact` | `operations/conversations.ts` | `recusaDeEscritaNoCrmAntigo` |  |
| `discardDraft` | `operations/conversations.ts` | `recusaDeEscritaNoCrmAntigo` |  |
| `restoreConversation` | `operations/conversations.ts` | `recusaDeEscritaNoCrmAntigo` |  |
| `startConversation` | `operations/conversations.ts` | recusa embutida (Membro ativo, não Convidado) | a mesma regra de `recusaDeEscritaNoCrmAntigo`, escrita dentro da operação desde antes da Fase 9 (09-03 não criou variante) |
| `toggleConversationStar` | `operations/conversations.ts` | `recusaDeEscritaNoCrmAntigo` |  |
| `markConversationRead` | `operations/conversations.ts` | `recusaDeEscritaNoCrmAntigo` |  |
| `addContactIdentifier` | `operations/contacts.ts` | `recusaDeEscritaNoCrmAntigo` |  |
| `transferContactIdentifier` | `operations/contacts.ts` | `recusaDeEscritaNoCrmAntigo` |  |
| `mergeContacts` | `operations/contacts.ts` | `recusaDeEscritaNoCrmAntigo` |  |
| `endContactCompanyLink` | `operations/contacts.ts` | `recusaDeEscritaNoCrmAntigo` |  |
| `trashContact` | `operations/contacts.ts` | `recusaDeEscritaNoCrmAntigo` |  |
| `trashCompany` | `operations/contacts.ts` | `recusaDeEscritaNoCrmAntigo` |  |
| `restoreMergedCopy` | `operations/contacts.ts` | `recusaDeEscritaNoCrmAntigo` |  |
| `importContacts` | `operations/contacts.ts` | `recusaDeEscritaNoCrmAntigo` |  |
| `restoreContact` | `operations/contacts.ts` | `recusaDeEscritaNoCrmAntigo` |  |
| `restoreCompany` | `operations/contacts.ts` | `recusaDeEscritaNoCrmAntigo` |  |
| `markContactsAsDistinct` | `operations/contacts.ts` | `recusaDeEscritaNoCrmAntigo` |  |
| `addContactNote` | `operations/contacts.ts` | `recusaDeEscritaNoCrmAntigo` |  |
| `createContact` | `operations/contacts.ts` | `mayCreateCrmRecord` |  |
| `createCompany` | `operations/contacts.ts` | `mayCreateCrmRecord` |  |
| `linkContactToCompany` | `operations/contacts.ts` | `mayCreateCrmRecord` |  |
| `addCompanyIdentifier` | `operations/contacts.ts` | `mayCreateCrmRecord` |  |
| `setContactCatalogValue` | `operations/contacts.ts` | `mayCreateCrmRecord` |  |
| `updateCompany` | `operations/contacts.ts` | `mayCreateCrmRecord` |  |
| `addCompanyNote` | `operations/contacts.ts` | `recusaDeEscritaNoCrmAntigo` |  |
| `decideApproval` | `operations/ai.ts` | `mayDecideApproval` | o aprovador designado, o dono do Agente ou um Administrador ou Proprietário ativo |
| `decideProcessApproval` | `operations/ai.ts` | `mayDecideApproval` | o aprovador designado ou um Administrador ou Proprietário ativo; o alcance da Tarefa vem da resposta no fio (`addTaskComment`) |
| `solicitarAprovacao` | `operations/ai.ts` | `taskWriteRefusal` | o ator é conferido ao mover a Tarefa para 'em aprovação' (`changeTaskStatus`, via `mayWriteTaskStatus`), antes de qualquer gravação |
| `publishAutomation` | `operations/ai.ts` | `recusaDeAdministrarAutomacao` |  |
| `restoreAgent` | `operations/ai.ts` | `recusaDeRestaurarAgente` |  |
| `restoreAutomation` | `operations/ai.ts` | `recusaDeRestaurarAutomacao` |  |
| `createChatSession` | `operations/ai.ts` | recusa embutida (Membro ativo) | a Sessão nasce do próprio Membro (dono); `recusaDeTrocarModelo` confere o Modelo, não o ator |
| `configureChatSession` | `operations/ai.ts` | dono do registro | só o dono da Sessão a ajusta (`session.ownerMemberId`); nem Administrador nem Proprietário alteram a Sessão de outro |
| `sendChatMessage` | `operations/ai.ts` | dono do registro | só o dono da Sessão escreve nela (`session.ownerMemberId`); o compartilhamento dá leitura |
| `createChatFolder` | `operations/chat-folders.ts` | recusa embutida (Membro ativo) | a pasta nasce do próprio Membro (dono) |
| `renameChatFolder` | `operations/chat-folders.ts` | dono do registro | só o dono da pasta (`folder.ownerMemberId`) |
| `deleteChatFolder` | `operations/chat-folders.ts` | dono do registro | só o dono da pasta (`folder.ownerMemberId`) |
| `moveChatSessionToFolder` | `operations/chat-folders.ts` | dono do registro | só o dono da Sessão, e a pasta de destino também tem de ser dele |
| `createAgent` | `operations/agent-builder.ts` | recusa embutida (Membro ativo, não Convidado) | `validate`: Membro ativo e Papel base diferente de Convidado; o Agente nasce com o Membro como dono |
| `publishAgentVersion` | `operations/agent-builder.ts` | recusa embutida (dono do Agente ou quem administra o Espaço) | `validate` (Membro ativo, não Convidado) e depois dono do Agente, Administrador ou Proprietário |
| `createFieldDefinition` | `operations/configuration.ts` | `containerAdminRefusal` | via `mayConfigure` |
| `updateFieldDefinition` | `operations/configuration.ts` | `containerAdminRefusal` | via `mayConfigure` |
| `archiveFieldDefinition` | `operations/configuration.ts` | `containerAdminRefusal` | via `mayConfigure` |
| `restoreFieldDefinition` | `operations/configuration.ts` | `containerAdminRefusal` | via `mayConfigure` |
| `createTag` | `operations/configuration.ts` | `recusaDeGerirTags` |  |
| `updateTag` | `operations/configuration.ts` | `recusaDeGerirTags` |  |
| `archiveTag` | `operations/configuration.ts` | `recusaDeGerirTags` |  |
| `restoreTag` | `operations/configuration.ts` | `recusaDeGerirTags` |  |
| `addStatus` | `operations/configuration.ts` | `containerAdminRefusal` | via `mayConfigure` |
| `updateStatus` | `operations/configuration.ts` | `containerAdminRefusal` | via `mayConfigure` |
| `reorderStatuses` | `operations/configuration.ts` | `containerAdminRefusal` | via `mayConfigure` |
| `removeStatus` | `operations/configuration.ts` | `containerAdminRefusal` | via `mayConfigure` |
| `overrideStatusSet` | `operations/configuration.ts` | `containerAdminRefusal` | via `mayConfigure` |
| `inheritStatusSet` | `operations/configuration.ts` | `containerAdminRefusal` | via `mayConfigure` |
| `createTaskType` | `operations/configuration.ts` | `containerAdminRefusal` | via `mayConfigure` |
| `updateTaskType` | `operations/configuration.ts` | `containerAdminRefusal` | via `mayConfigure` |
| `removeTaskType` | `operations/configuration.ts` | `containerAdminRefusal` | via `mayConfigure` |
| `setContainerFeature` | `operations/configuration.ts` | `containerAdminRefusal` | via `mayConfigure` |
| `usarCampoHerdado` | `operations/configuration.ts` | `containerAdminRefusal` | via `mayConfigure` |
| `addDependency` | `operations/collaboration.ts` | `taskWriteRefusal` | via `activeTask`, nas duas Tarefas da Dependência |
| `removeDependency` | `operations/collaboration.ts` | `taskWriteRefusal` |  |
| `addTimeEntry` | `operations/collaboration.ts` | `taskWriteRefusal` | via `activeTask` |
| `startTimer` | `operations/collaboration.ts` | `taskWriteRefusal` | via `activeTask` |
| `stopTimer` | `operations/collaboration.ts` | dono do registro | só fecha o cronômetro aberto do próprio Membro (`entry.memberId === actingMemberId`); não confere Papel nem estado do Membro |
| `attachFile` | `operations/collaboration.ts` | `taskWriteRefusal` | via `activeTask` |
| `removeAttachment` | `operations/collaboration.ts` | `taskWriteRefusal` | via `activeTask` |
| `setRecurrence` | `operations/collaboration.ts` | `taskWriteRefusal` | via `activeTask` |
| `spawnNextOccurrence` | `operations/collaboration.ts` | sem conferência | LACUNA — ver 09-09-SUMMARY: não olha quem chama nem o alcance da Tarefa; `POST /operacoes/spawnNextOccurrence` cria a próxima ocorrência de qualquer Tarefa recorrente já concluída, para qualquer Membro, Convidado incluído (a tela chega aqui por `changeTaskStatus`, que confere) |
| `spawnCalendarOccurrence` | `operations/collaboration.ts` | `taskWriteRefusal` | via `activeTask` |
| `runCalendarRecurrences` | `operations/collaboration.ts` | `containerAdminRefusal` |  |
| `setMemberCapacity` | `operations/planning.ts` | recusa embutida (o próprio Membro ou Administrador) | Membro ativo; definir a capacidade de outro Membro exige Papel Administrador ou Proprietário |
| `enableSprints` | `operations/planning.ts` | `containerAdminRefusal` | via `sprintFolder` |
| `disableSprints` | `operations/planning.ts` | `containerAdminRefusal` | via `sprintFolder` |
| `createNextSprint` | `operations/planning.ts` | `containerAdminRefusal`, `mayBuild` | via `sprintFolder` (administrar a Pasta); a Lista da sprint nasce por `createList` |
| `closeSprint` | `operations/planning.ts` | `containerAdminRefusal`, `memberReachesContainer` | via `sprintFolder` (administrar a Pasta); as Tarefas abertas passam à próxima sprint por `moveTask` |
| `saveListAsTemplate` | `operations/planning.ts` | `containerAdminRefusal` |  |
| `saveTaskAsTemplate` | `operations/planning.ts` | `containerAdminRefusal` |  |
| `instantiateTaskTemplate` | `operations/planning.ts` | `listWriteRefusal` | via `createTask`, que confere antes de criar |
| `instantiateListTemplate` | `operations/planning.ts` | `mayBuild`, `containerAdminRefusal` | sempre exige alcançar o contêiner (`memberReachesContainer`) e criar por `createList`; `containerAdminRefusal` entra quando o modelo define Status, Campos ou Tipos |
| `renameTemplate` | `operations/planning.ts` | `templateAdminRefusal` |  |
| `setTemplateArchived` | `operations/planning.ts` | `templateAdminRefusal` |  |
| `saveView` | `operations/scale.ts` | recusa embutida (Membro ativo), `containerAdminRefusal` | a Visão pessoal exige Membro ativo que alcance a Lista; compartilhar com a Lista exige `containerAdminRefusal` |
| `deleteView` | `operations/scale.ts` | `mayEditView` | o dono da Visão pessoal, ou administrar a Lista na compartilhada |
| `setDefaultView` | `operations/scale.ts` | `mayEditView` | só Visão compartilhada; administrar a Lista |
| `createForm` | `operations/scale.ts` | `containerAdminRefusal` |  |
| `updateForm` | `operations/scale.ts` | `containerAdminRefusal` |  |
| `archiveForm` | `operations/scale.ts` | `containerAdminRefusal` |  |
| `unarchiveForm` | `operations/scale.ts` | `containerAdminRefusal` |  |
| `rotateFormSecret` | `operations/scale.ts` | `containerAdminRefusal` |  |
| `shareTaskPublicly` | `operations/scale.ts` | `containerAdminRefusal`, `memberSeesTask` | ver a Tarefa e administrar a Lista (RN-TAR-21) |
| `revokePublicShare` | `operations/scale.ts` | `containerAdminRefusal`, `memberSeesTask` | ver a Tarefa e administrar a Lista |
| `runScheduledAutomations` | `operations/automations.ts` | `containerAdminRefusal` | Membro ativo que administra a Lista; só percorre as Tarefas que ele vê (`memberSeesTask`) |
| `runLancamentoAgent` | `operations/financeiro.ts` | `memberSeesTask` | conferência fraca, ver 09-09-SUMMARY: exige só alcançar a Tarefa e a concessão do Agente (`agentSeesTask`); não recusa Convidado nem Membro não ativo; o pedido ao Financeiro passa por `addTaskComment` (`taskCommentRefusal`) |
| `createReceivableSeries` | `operations/financeiro.ts` | `listWriteRefusal` |  |
| `converterSolicitacaoEmContaAPagar` | `operations/conversao-de-solicitacao.ts` | `memberSeesTask`, `listWriteRefusal` | a Solicitação precisa ser vista por quem converte (T-3-12) e a Conta nasce por `createTask`; as Tags passam por `setTaskTags` |
| `alterarStatusEmLote` | `operations/lote.ts` | `taskWriteRefusal` | por item, via `changeTaskStatus` (`mayWriteTaskStatus`) depois de `memberSeesTask`; a recusa de um item vira `recusada` no relatório, sem derrubar o lote |
| `alterarEmailDoConvite` | `operations/members.ts` | recusa embutida (Administrador ou Proprietário) | confere o Papel base de quem chama, não o estado do Membro: um suspenso só é barrado pelo 403 da rota |
| `alterarPapelDoMembro` | `operations/members.ts` | recusa embutida (Administrador ou Proprietário) | confere o Papel base de quem chama, não o estado do Membro: um suspenso só é barrado pelo 403 da rota |
| `removeMember` | `operations/members.ts` | sem conferência | LACUNA — ver 09-09-SUMMARY: não olha quem chama; qualquer Membro, Convidado incluído, remove outro Membro (só o Proprietário é protegido) e passa os registros dele ao Sucessor; a rota só valida o formato dos argumentos |
| `transferWorkspaceOwnership` | `operations/members.ts` | recusa embutida (Proprietário do Espaço) | só quem é `workspace.ownerMemberId`; o destinatário precisa ser Membro ativo |
| `inviteMember` | `operations/members.ts` | recusa embutida (Administrador ou Proprietário) | confere o Papel base de quem chama, não o estado do Membro: um suspenso só é barrado pelo 403 da rota |
| `deleteRole` | `operations/members.ts` | recusa embutida (Administrador ou Proprietário) | confere o Papel base de quem chama, não o estado do Membro: um suspenso só é barrado pelo 403 da rota |
| `grantGovernanceAccess` | `operations/members.ts` | recusa embutida (Administrador ou Proprietário) | ato de governança com motivo obrigatório; confere o Papel base, não o estado do Membro: um suspenso só é barrado pelo 403 da rota |
| `createSpace` | `operations/structure.ts` | `mayBuild` |  |
| `createFolder` | `operations/structure.ts` | `mayBuild` |  |
| `createList` | `operations/structure.ts` | `mayBuild` |  |
| `updateContainer` | `operations/structure.ts` | `containerAdminRefusal` |  |
| `archiveContainer` | `operations/structure.ts` | `containerAdminRefusal` |  |
| `unarchiveContainer` | `operations/structure.ts` | `containerAdminRefusal` |  |
| `trashContainer` | `operations/structure.ts` | `containerTrashRefusal` |  |
| `restoreContainer` | `operations/structure.ts` | `containerTrashRefusal` |  |
| `iniciarConversa` | `operations/iniciar-conversa.ts` | `recusaDeEscritaNoCrmAntigo`, `listWriteRefusal` | composição: `createDeal`, `createTask` e `setContactCatalogValue` conferem (esta última por `mayCreateCrmRecord`); as validações anteriores só leem, e a operação desfaz o que criou se um ato recusar |
| `adicionarNotaNoAtivo` | `operations/ferramentas/notas.ts` | `recusaDeMembroAtivo` |  |
| `criarLinkDeCaptacao` | `operations/ferramentas/captacao.ts` | `recusaDeMembroAtivo` |  |
| `editarLinkDeCaptacao` | `operations/ferramentas/captacao.ts` | `recusaDeMembroAtivo` |  |
| `enviarLinkALixeira` | `operations/ferramentas/captacao.ts` | `recusaDeMembroAtivo` |  |
| `restaurarLinkDaLixeira` | `operations/ferramentas/captacao.ts` | `recusaDeMembroAtivo` |  |
| `criarGrupo` | `operations/ferramentas/grupos.ts` | `recusaDeMembroAtivo` | `recusaDoCanal` olha o Canal (ativo, conectado, Capacidade); `recusaExternaNaComunidade` olha o Papel do Canal na Comunidade, não o do Membro |
| `importarGruposDoCanal` | `operations/ferramentas/grupos.ts` | `recusaDeMembroAtivo` | `recusaDoCanal` olha o Canal (ativo, conectado, Capacidade) |
| `sincronizarGrupo` | `operations/ferramentas/grupos.ts` | `recusaDeMembroAtivo` |  |
| `editarGrupo` | `operations/ferramentas/grupos.ts` | `recusaDeMembroAtivo` | `recusaExternaNoGrupo` olha o Papel do Canal no Grupo, não o do Membro |
| `definirCanalDoGrupo` | `operations/ferramentas/grupos.ts` | `recusaDeAdministracao` |  |
| `editarCaptacaoDoGrupo` | `operations/ferramentas/grupos.ts` | `recusaDeMembroAtivo` |  |
| `ativarCaptacao` | `operations/ferramentas/grupos.ts` | `recusaDeMembroAtivo` | via `editarCaptacaoDoGrupo` |
| `inativarCaptacao` | `operations/ferramentas/grupos.ts` | `recusaDeMembroAtivo` | via `editarCaptacaoDoGrupo` |
| `zerarCliques` | `operations/ferramentas/grupos.ts` | `recusaDeMembroAtivo` |  |
| `regenerarLinkDeConvite` | `operations/ferramentas/grupos.ts` | `recusaDeMembroAtivo` | `recusaExternaNoGrupo` olha o Papel do Canal no Grupo, não o do Membro |
| `enviarLinkDeConvite` | `operations/ferramentas/grupos.ts` | `recusaDeMembroAtivo` | `recusaDoCanal` olha o Canal (ativo, conectado, Capacidade) |
| `adicionarParticipantes` | `operations/ferramentas/grupos.ts` | `recusaDeMembroAtivo` | `recusaExternaNoGrupo` olha o Papel do Canal no Grupo, não o do Membro |
| `removerParticipante` | `operations/ferramentas/grupos.ts` | `recusaDeMembroAtivo` | `recusaExternaNoGrupo` olha o Papel do Canal no Grupo, não o do Membro |
| `promoverParticipante` | `operations/ferramentas/grupos.ts` | `recusaDeMembroAtivo` | via `mudarPapel` |
| `rebaixarParticipante` | `operations/ferramentas/grupos.ts` | `recusaDeMembroAtivo` | via `mudarPapel` |
| `sairDoGrupo` | `operations/ferramentas/grupos.ts` | `recusaDeAdministracao` | `recusaExternaNoGrupo` olha o Papel do Canal no Grupo, não o do Membro |
| `arquivarGrupo` | `operations/ferramentas/grupos.ts` | `recusaDeMembroAtivo` |  |
| `restaurarGrupo` | `operations/ferramentas/grupos.ts` | `recusaDeMembroAtivo` |  |
| `enviarGrupoALixeira` | `operations/ferramentas/grupos.ts` | `recusaDeMembroAtivo` |  |
| `restaurarGrupoDaLixeira` | `operations/ferramentas/grupos.ts` | `recusaDeMembroAtivo` |  |
| `aprovarPedidoDeEntrada` | `operations/ferramentas/grupos.ts` | `recusaDeMembroAtivo` | `recusaExternaNoGrupo` olha o Papel do Canal no Grupo, não o do Membro |
| `recusarPedidoDeEntrada` | `operations/ferramentas/grupos.ts` | `recusaDeMembroAtivo` | `recusaExternaNoGrupo` olha o Papel do Canal no Grupo, não o do Membro |
| `enviarMensagemAoGrupo` | `operations/ferramentas/grupos.ts` | `recusaDeMembroAtivo` | `recusaDeEnvioAoGrupo` olha o estado do Grupo e do Canal |
| `criarFlow` | `operations/ferramentas/flows.ts` | `recusaDeMembroAtivo` |  |
| `editarFlow` | `operations/ferramentas/flows.ts` | `recusaDeMembroAtivo`, `recusaDeAdministracao` | `recusaDeAdministracao` só entra quando a edição troca o Canal de um Flow com Versão publicada |
| `definirPontoDeTrocaDeDados` | `operations/ferramentas/flows.ts` | `recusaDeMembroAtivo` | via `rascunhoEditavel` |
| `regenerarChavesDoPonto` | `operations/ferramentas/flows.ts` | `recusaDeAdministracao` |  |
| `removerPontoDeTrocaDeDados` | `operations/ferramentas/flows.ts` | `recusaDeMembroAtivo` | via `rascunhoEditavel` |
| `adicionarTela` | `operations/ferramentas/flows.ts` | `recusaDeMembroAtivo` | via `rascunhoEditavel` |
| `editarTela` | `operations/ferramentas/flows.ts` | `recusaDeMembroAtivo` | via `rascunhoEditavel` |
| `reordenarTela` | `operations/ferramentas/flows.ts` | `recusaDeMembroAtivo` | via `rascunhoEditavel` |
| `duplicarTela` | `operations/ferramentas/flows.ts` | `recusaDeMembroAtivo` | via `rascunhoEditavel` |
| `removerTela` | `operations/ferramentas/flows.ts` | `recusaDeMembroAtivo` | via `rascunhoEditavel` |
| `adicionarComponente` | `operations/ferramentas/flows.ts` | `recusaDeMembroAtivo` | via `rascunhoEditavel` |
| `editarComponente` | `operations/ferramentas/flows.ts` | `recusaDeMembroAtivo` | via `rascunhoEditavel` |
| `moverComponente` | `operations/ferramentas/flows.ts` | `recusaDeMembroAtivo` | via `rascunhoEditavel` |
| `duplicarComponente` | `operations/ferramentas/flows.ts` | `recusaDeMembroAtivo` | via `rascunhoEditavel` |
| `removerComponente` | `operations/ferramentas/flows.ts` | `recusaDeMembroAtivo` | via `rascunhoEditavel` |
| `publicarVersao` | `operations/ferramentas/flows.ts` | `recusaDeAdministracao` | `recusaDePublicacao` olha o estado do Flow e do Canal |
| `despublicarFlow` | `operations/ferramentas/flows.ts` | `recusaDeAdministracao` |  |
| `descartarRascunho` | `operations/ferramentas/flows.ts` | `recusaDeMembroAtivo` |  |
| `criarRascunhoAPartirDe` | `operations/ferramentas/flows.ts` | `recusaDeMembroAtivo` |  |
| `copiarFlow` | `operations/ferramentas/flows.ts` | `recusaDeMembroAtivo` |  |
| `arquivarFlow` | `operations/ferramentas/flows.ts` | `recusaDeMembroAtivo` |  |
| `restaurarFlow` | `operations/ferramentas/flows.ts` | `recusaDeMembroAtivo` |  |
| `enviarFlowALixeira` | `operations/ferramentas/flows.ts` | `recusaDeMembroAtivo` |  |
| `restaurarFlowDaLixeira` | `operations/ferramentas/flows.ts` | `recusaDeMembroAtivo` |  |
| `sincronizarFlow` | `operations/ferramentas/flows.ts` | `recusaDeMembroAtivo` | `recusaDoCanal` olha o Canal (ativo, conectado, Capacidade) |
| `enviarFlow` | `operations/ferramentas/flows.ts` | `recusaDeMembroAtivo` | `recusaDeEnvioDeFlow` olha o estado do Flow e do Canal |
| `criarComunidade` | `operations/ferramentas/comunidades.ts` | `recusaDeMembroAtivo` | `recusaDoCanal` olha o Canal (ativo, conectado, Capacidade) |
| `sincronizarComunidade` | `operations/ferramentas/comunidades.ts` | `recusaDeMembroAtivo` |  |
| `editarComunidade` | `operations/ferramentas/comunidades.ts` | `recusaDeMembroAtivo` | `recusaExternaNaComunidade` olha o Papel do Canal na Comunidade, não o do Membro |
| `alterarConfiguracoesDaComunidade` | `operations/ferramentas/comunidades.ts` | `recusaDeMembroAtivo` | `recusaExternaNaComunidade` olha o Papel do Canal na Comunidade, não o do Membro |
| `vincularGrupoAComunidade` | `operations/ferramentas/comunidades.ts` | `recusaDeAdministracao` | `recusaExternaNaComunidade` olha o Papel do Canal na Comunidade, não o do Membro; `recusaExternaNoGrupo` olha o Papel do Canal no Grupo, não o do Membro; `recusaDeVinculo` olha o par Grupo-Comunidade |
| `desvincularGrupoDaComunidade` | `operations/ferramentas/comunidades.ts` | `recusaDeAdministracao` | `recusaExternaNaComunidade` olha o Papel do Canal na Comunidade, não o do Membro |
| `enviarMensagemAComunidade` | `operations/ferramentas/comunidades.ts` | `recusaDeMembroAtivo` |  |
| `sairDaComunidade` | `operations/ferramentas/comunidades.ts` | `recusaDeAdministracao` | `recusaExternaNaComunidade` olha o Papel do Canal na Comunidade, não o do Membro |
| `arquivarComunidade` | `operations/ferramentas/comunidades.ts` | `recusaDeMembroAtivo` |  |
| `restaurarComunidade` | `operations/ferramentas/comunidades.ts` | `recusaDeMembroAtivo` |  |
| `enviarComunidadeALixeira` | `operations/ferramentas/comunidades.ts` | `recusaDeMembroAtivo` |  |
| `restaurarComunidadeDaLixeira` | `operations/ferramentas/comunidades.ts` | `recusaDeMembroAtivo` |  |
| `criarCanal` | `operations/canais.ts` | `recusaDeGerirCanais` |  |
| `configurarCanal` | `operations/canais.ts` | `recusaDeGerirCanais` |  |
| `alterarModeloDaLista` | `operations/tarefas-conversacionais.ts` | `containerAdminRefusal` |  |
| `definirCanaisDaLista` | `operations/tarefas-conversacionais.ts` | `containerAdminRefusal` |  |
| `criarTarefaConversacional` | `operations/tarefas-conversacionais.ts` | `listWriteRefusal` |  |
| `trocarCanalDaTarefa` | `operations/tarefas-conversacionais.ts` | `taskWriteRefusal` | via `tarefaConversacional` |
| `vincularNegocioATarefa` | `operations/tarefas-conversacionais.ts` | `taskWriteRefusal` | via `tarefaConversacional` |
| `criarNegocioDaTarefa` | `operations/tarefas-conversacionais.ts` | `taskWriteRefusal`, `recusaDeEscritaNoCrmAntigo` | via `tarefaConversacional` e `createDeal` |
| `ativarAgente` | `operations/ia/agentes.ts` | `recusaDeGovernarAgente` |  |
| `pausarAgente` | `operations/ia/agentes.ts` | `recusaDeGovernarAgente` |  |
| `arquivarAgente` | `operations/ia/agentes.ts` | `recusaDeGovernarAgente` |  |
| `enviarAgenteALixeira` | `operations/ia/agentes.ts` | `recusaDeGovernarAgente` |  |
| `transferirAgente` | `operations/ia/agentes.ts` | `recusaDeGovernarAgente` |  |
| `ensaiarAgente` | `operations/ia/agentes.ts` | `recusaDeGovernarAgente` |  |
| `cancelarExecucao` | `operations/ia/agentes.ts` | `recusaDeGovernarAgente`, `recusaDeMembroAtivo` | administrar o Agente ou ser o delegante da Execução (RN-AGE-21); `recusaDeMembroAtivo` aqui é a da IA (só Membro ativo) |
| `apagarItemDeMemoria` | `operations/ia/agentes.ts` | `recusaDeGovernarAgente` | via `recusaDeEditarConfiguracao` (`editar` o Agente; Agente arquivado ou na lixeira não se edita) |
| `criarAutomacao` | `operations/ia/automacoes-editor.ts` | `recusaDeConvidado` | Membro ativo e Papel base diferente de Convidado |
| `editarAutomacao` | `operations/ia/automacoes-editor.ts` | `recusaDeMembroAtivo`, `recusaDeAdministrarAutomacao` | via `automacaoEditavel`: editar exige administrar a Automação (dono, criador, Administrador ou Proprietário) |
| `duplicarAutomacao` | `operations/ia/automacoes-editor.ts` | `recusaDeConvidado` | Membro ativo e Papel base diferente de Convidado |
| `criarRascunhoDaAutomacao` | `operations/ia/automacoes-editor.ts` | `recusaDeMembroAtivo`, `recusaDeAdministrarAutomacao` | via `automacaoEditavel`: editar exige administrar a Automação (dono, criador, Administrador ou Proprietário) |
| `descartarRascunhoDaAutomacao` | `operations/ia/automacoes-editor.ts` | `recusaDeMembroAtivo`, `recusaDeAdministrarAutomacao` | via `rascunhoEditavel` e `automacaoEditavel`: editar o rascunho exige administrar a Automação (dono, criador, Administrador ou Proprietário) |
| `definirGatilho` | `operations/ia/automacoes-editor.ts` | `recusaDeMembroAtivo`, `recusaDeAdministrarAutomacao` | via `rascunhoEditavel` e `automacaoEditavel`: editar o rascunho exige administrar a Automação (dono, criador, Administrador ou Proprietário) |
| `adicionarCondicao` | `operations/ia/automacoes-editor.ts` | `recusaDeMembroAtivo`, `recusaDeAdministrarAutomacao` | via `rascunhoEditavel` e `automacaoEditavel`: editar o rascunho exige administrar a Automação (dono, criador, Administrador ou Proprietário) |
| `editarCondicao` | `operations/ia/automacoes-editor.ts` | `recusaDeMembroAtivo`, `recusaDeAdministrarAutomacao` | via `rascunhoEditavel` e `automacaoEditavel`: editar o rascunho exige administrar a Automação (dono, criador, Administrador ou Proprietário) |
| `removerCondicao` | `operations/ia/automacoes-editor.ts` | `recusaDeMembroAtivo`, `recusaDeAdministrarAutomacao` | via `rascunhoEditavel` e `automacaoEditavel`: editar o rascunho exige administrar a Automação (dono, criador, Administrador ou Proprietário) |
| `adicionarAcao` | `operations/ia/automacoes-editor.ts` | `recusaDeMembroAtivo`, `recusaDeAdministrarAutomacao` | via `rascunhoEditavel` e `automacaoEditavel`: editar o rascunho exige administrar a Automação (dono, criador, Administrador ou Proprietário) |
| `editarAcao` | `operations/ia/automacoes-editor.ts` | `recusaDeMembroAtivo`, `recusaDeAdministrarAutomacao` | via `rascunhoEditavel` e `automacaoEditavel`: editar o rascunho exige administrar a Automação (dono, criador, Administrador ou Proprietário) |
| `moverAcao` | `operations/ia/automacoes-editor.ts` | `recusaDeMembroAtivo`, `recusaDeAdministrarAutomacao` | via `rascunhoEditavel` e `automacaoEditavel`: editar o rascunho exige administrar a Automação (dono, criador, Administrador ou Proprietário) |
| `removerAcao` | `operations/ia/automacoes-editor.ts` | `recusaDeMembroAtivo`, `recusaDeAdministrarAutomacao` | via `rascunhoEditavel` e `automacaoEditavel`: editar o rascunho exige administrar a Automação (dono, criador, Administrador ou Proprietário) |
| `definirPoliticaDeErro` | `operations/ia/automacoes-editor.ts` | `recusaDeMembroAtivo`, `recusaDeAdministrarAutomacao` | via `rascunhoEditavel` e `automacaoEditavel`: editar o rascunho exige administrar a Automação (dono, criador, Administrador ou Proprietário) |
| `pausarAutomacao` | `operations/ia/automacoes-editor.ts` | `recusaDeAdministrarAutomacao` |  |
| `retomarAutomacao` | `operations/ia/automacoes-editor.ts` | `recusaDeAdministrarAutomacao` |  |
| `arquivarAutomacao` | `operations/ia/automacoes-editor.ts` | `recusaDeAdministrarAutomacao` |  |
| `enviarAutomacaoALixeira` | `operations/ia/automacoes-editor.ts` | `recusaDeAdministrarAutomacao` |  |
| `criarColecao` | `operations/ia/conhecimento.ts` | `recusaDeConvidado` |  |
| `editarColecao` | `operations/ia/conhecimento.ts` | `recusaNaColecao` |  |
| `adicionarFonte` | `operations/ia/conhecimento.ts` | `recusaNaColecao` |  |
| `arquivarColecao` | `operations/ia/conhecimento.ts` | `recusaNaColecao` |  |
| `restaurarColecao` | `operations/ia/conhecimento.ts` | `recusaNaColecao` |  |
| `adicionarDocumento` | `operations/ia/conhecimento.ts` | `recusaNaColecao` |  |
| `novaVersaoDoDocumento` | `operations/ia/conhecimento.ts` | `recusaNoDocumento` |  |
| `restaurarVersaoDoDocumento` | `operations/ia/conhecimento.ts` | `recusaNoDocumento` |  |
| `editarDocumento` | `operations/ia/conhecimento.ts` | `recusaNoDocumento` |  |
| `moverDocumento` | `operations/ia/conhecimento.ts` | `recusaNoDocumento`, `recusaNaColecao` |  |
| `comentarDocumento` | `operations/ia/conhecimento.ts` | `recusaNoDocumento` |  |
| `arquivarDocumento` | `operations/ia/conhecimento.ts` | `recusaNoDocumento` |  |
| `enviarDocumentoALixeira` | `operations/ia/conhecimento.ts` | `recusaNoDocumento` |  |
| `restaurarDocumento` | `operations/ia/conhecimento.ts` | `recusaNoDocumento` |  |
| `concederColecao` | `operations/ia/conhecimento.ts` | `recusaNaColecao` |  |
| `revogarColecao` | `operations/ia/conhecimento.ts` | `recusaNaColecao` |  |
| `criarHabilidade` | `operations/ia/habilidades.ts` | `recusaDeConvidado` |  |
| `copiarHabilidadeDaPlataforma` | `operations/ia/habilidades.ts` | `recusaDeConvidado` |  |
| `editarHabilidade` | `operations/ia/habilidades.ts` | `recusaDeGovernarHabilidade` |  |
| `criarRascunhoDaHabilidade` | `operations/ia/habilidades.ts` | `recusaDeGovernarHabilidade` |  |
| `editarRascunhoDaHabilidade` | `operations/ia/habilidades.ts` | `recusaDeGovernarHabilidade` |  |
| `descartarRascunhoDaHabilidade` | `operations/ia/habilidades.ts` | `recusaDeGovernarHabilidade` |  |
| `publicarVersaoDaHabilidade` | `operations/ia/habilidades.ts` | `recusaDeGovernarHabilidade` |  |
| `obsoletarVersaoDaHabilidade` | `operations/ia/habilidades.ts` | `recusaDeGovernarHabilidade` |  |
| `arquivarHabilidade` | `operations/ia/habilidades.ts` | `recusaDeGovernarHabilidade` |  |
| `restaurarHabilidade` | `operations/ia/habilidades.ts` | `recusaDeGovernarHabilidade` |  |
| `concederHabilidade` | `operations/ia/habilidades.ts` | `recusaDeGovernarAgente`, `recusaDeMembroAtivo` | `editar` o Agente que recebe a Concessão; `recusaDeMembroAtivo` aqui é a da IA (só Membro ativo) |
| `fixarVersaoDaConcessao` | `operations/ia/habilidades.ts` | `recusaDeGovernarAgente`, `recusaDeMembroAtivo` | `editar` o Agente da Concessão; `recusaDeMembroAtivo` aqui é a da IA (só Membro ativo) |
| `revogarHabilidade` | `operations/ia/habilidades.ts` | `recusaDeGovernarAgente`, `recusaDeMembroAtivo` | `editar` o Agente da Concessão; `recusaDeMembroAtivo` aqui é a da IA (só Membro ativo) |
| `conectarIntegracao` | `operations/ia/integracoes.ts` | `recusaDeAdministrarIntegracao` |  |
| `desconectarIntegracao` | `operations/ia/integracoes.ts` | `recusaDeAdministrarIntegracao` |  |

## Aprovação: duas origens, uma decisão por origem (D-06/D-09/D-11)

`ApprovalRequest.origin` (`types/ai.ts`) é uma união discriminada por `kind`,
o mesmo padrão de `ExecutionStep.kind`: `agentExecution` (o passo de uma
`AgentExecution`, com `deadline`) ou `processTask` (uma decisão de processo
ligada a uma Tarefa, sem `AgentExecution`). Cada origem tem a sua operação de
decisão — `decideApproval` só aceita `agentExecution`, `decideProcessApproval`
só aceita `processTask` — porque as regras não se misturam: uma expira, a
outra **não expira**; uma mexe numa `AgentExecution`, a outra publica
Comentário e muda o Status de uma Tarefa.

A aprovação de processo não tem `deadline` porque o campo não existe no ramo
`processTask` de `ApprovalOrigin` — não é uma checagem em tempo de execução,
é o tipo impedindo o estado inválido. O timeout de Execução de Agente nunca
alcança uma aprovação financeira.

## O de-para do lançamento: o domínio recebe, nunca busca (D3-02/D3-03)

O banco de categorias do Omie não precisa ser construído: ele já existe e está
em produção (`conciliador_contas_pagar_tria`, D3-02). Vive em outro projeto
Supabase (DEC-08/OQ-SYN-03), então é alcançado por HTTP e nunca por JOIN —
gerar um segundo de-para aqui criaria uma cópia que diverge no dia em que
alguém mexer no plano de contas do Omie.

Por isso `buildResumoDePagamento` e `runLancamentoAgent`
(`src/operations/financeiro.ts`) **recebem** um `DeParaDeLancamento` e jamais o
buscam: esta camada continua sem `fetch`, sem cliente de banco e sem variável
de ambiente. Essa é exatamente a forma que a rota nova do `automation/` (03-07)
devolve e que a ponte do `apps/api` (03-11) injeta. Um dicionário de uma
entrada é um dicionário válido — o caso normal é resolver só a Categoria da
Tarefa em questão, em vez de despejar o plano de contas inteiro a cada
lançamento.

`origem` é obrigatório porque `DE_PARA_DO_PROTOTIPO` existe e é o padrão de
quem não passa nada. As tabelas fictícias do protótipo continuam ali para o
seed funcionar; o que não pode acontecer é um lançamento real feito com elas
passar despercebido. Por isso a origem é gravada no passo de raciocínio da
`AgentExecution`: fica legível, não silenciosa.

`veredito: "revisar"` é como o de-para diz "não tenho confiança suficiente"
(abaixo de `CATEGORY_MIN_SIMILARITY`, no `automation/`). Quem formata tolera e
renderiza o melhor palpite — o RESUMO é documento para o humano ler; quem
executa recusa: `runLancamentoAgent` devolve `fail`, o laço de ações da
Automação para e a conta vai para revisão humana em vez de entrar no Omie com
a categoria errada. Uma chave que o de-para nem trouxe (`"ausente"`) recusa
pelo mesmo caminho: não é licença para lançar "A classificar".

`rehearsal` não é invenção desta fase — é campo antigo de `AgentExecution`
(B82), até aqui escrito como `false` fixo. Com ele ligado, nenhuma escrita
acontece na Tarefa: nenhum Comentário, nenhum Status, nenhum Registro de
Atividade, só a Execução de sombra. E o que ela guarda é a tripla
conta/categoria/código — nunca o texto do RESUMO, que carrega chave Pix e
código de barras, e é a tripla que o relatório compara com o que o humano
lançou.

Daí a linha que 03-11 precisa obedecer: **o Ensaio não deve encadear A8**. Uma
Tarefa em Ensaio não muda de Status, e INV-CP-01 não é violado porque nenhum
RESUMO foi publicado.

## A conferência do Ensaio: o humano responde antes de ver a resposta do Agente (D3-03)

O que conta como acerto é regra de negócio, e por isso mora aqui
(`compararEnsaio`, `src/operations/financeiro.ts`) e não em `apps/api`: os
dois lados da comparação — o Ensaio do Agente e o lançamento do Financeiro —
passam pela MESMA função, nunca por duas que possam divergir na primeira
mudança.

1. **Onde o lado humano mora, e por que não em outro lugar.** O Agente, em
   Ensaio, deixa rastro estruturado (a `AgentExecution` de sombra, acima). O
   humano lança à mão dentro do Omie e não deixa rastro nenhum — a menos que
   diga. Dois lugares óbvios foram recusados: os Campos da própria Tarefa são
   circulares (são a ENTRADA do Agente, não o resultado do de-para real); e
   ler o Omie de volta exigiria junção por (fornecedor, vencimento, valor),
   porque um lançamento manual não carrega `codigo_lancamento_integracao` — e
   um relatório que decide sobre dinheiro não se apoia numa junção
   aproximada. O que sobra, e o que foi escolhido, é o próprio Financeiro
   registrando no instante em que lança: um Comentário de prefixo fixo
   (`PREFIXO_LANCAMENTO_HUMANO`), no molde exato de
   `PREFIXO_MOTIVO_FLUXO_MANUAL` (`fluxo-manual-dialog.tsx`), lido de volta
   por `lancamentoHumanoDe` e escrito por `textoDoLancamentoHumano` — um
   escritor, um leitor, nenhuma string duplicada entre `apps/web` (escreve) e
   `apps/api` (lê). A junção com a Tarefa é sempre pelo id dela.
2. **A captura é no ato, por causa do viés de assentimento.** Se a pergunta
   viesse depois, mostrando o que o Agente teria lançado, a resposta do
   Financeiro viria contaminada — e o erro entraria na direção otimista,
   exatamente a direção em que esta medição não pode errar. É por isso que o
   diálogo que captura o registro (`apps/web`) não tem lista de categorias
   nem sugestão nenhuma: mostrar a resposta do Agente antes da do humano
   destruiria a independência da medição.
3. **`REVISAR` é recusa correta, nunca erro.** Um Ensaio que terminou
   `falhou` (o de-para abaixo do corte de confiança) vira
   `veredito: "recusa_correta"` em `compararEnsaio` — mesmo havendo registro
   humano, e antes de qualquer comparação. Sai do denominador das taxas de
   acerto e tem taxa própria: dobrá-la em "erros" subestimaria o Agente
   exatamente onde ele acertou ao se calar.
4. **`semTagDeConta` marca o palpite sem evidência.** Quando `buildResumoDePagamento`
   não encontra Tag `conta *`, ele resolve a conta de pagamento por palpite
   (o Centro de Custo, ou `"A DEFINIR"`) e segue adiante — é o modo de falha
   mais caro do processo, porque conta errada é dinheiro saindo do banco
   errado. `compararEnsaio` marca esses casos (`semTagDeConta: true`) em vez
   de escondê-los ou de inventar um veredito próprio: o palpite acertado é
   `confere`, o errado é `diverge_conta`, e o relatório de `apps/api` tem um
   portão duro só para eles.
5. **`LIMIAR_DA_CANETA` é anterior aos dados por desenho.** A constante — com
   os cinco números e o motivo de cada um comentado ao lado da declaração —
   existe para que o limiar da decisão seja declarado ANTES de a semana de
   Ensaio existir. Medir primeiro e decidir depois o que conta como bom é
   racionalizar; o `git blame` desta constante é o que torna um afrouxamento
   posterior visível.

## Importação histórica de Contas a pagar (Fase 3)

`importarContaAPagarHistorica` (`src/operations/importacao-contas-a-pagar.ts`)
**não está em `OPERACOES`** e sai crua do barril, como
`importarSolicitacaoHistorica`: quem importa não é um Membro usando a
interface, é o CLI do `apps/api` (Plan 03-10), que a chama direto.

Importação histórica de uma Lista **com** Automações nunca pode passar por
`changeTaskStatus`. A Lista de Contas a pagar tem sete Automações ativas e a
própria Tarefa carrega a Regra de Recorrência A1: replayar o histórico por
mudança de Status faria A1 parir uma ocorrência fantasma por conta paga,
A5/A6 cobrarem nota fiscal em conta fechada há um ano e A2/A3/A4
reescreverem Responsável — em silêncio. Por isso a Tarefa nasce **já no
Status final**, dado a `createTask` com `runAutomations: false`. O precedente
de Solicitações pode usar `changeTaskStatus` porque aquela Lista não tem
Automação nenhuma; a autorização está escrita lá e não se estende a esta.

A costura que preserva a data original (D3-04) é `recordActivity`, que aceita
`at` (`src/operations/activity.ts`). Cada transição do `status_history` vira
um Registro "Status alterado" com o instante daquela transição — é dessa
trilha, e só dela, que "tempo em 'para pagar'" é calculável depois.
`changeTaskStatus` não aceita `at` nem `runAutomations`, então não serviria
nem com as Automações desligadas.

`ORIGEM_CONTAS_A_PAGAR` (`clickup:901107637383`) é o mesmo valor gravado em
`plataforma.importacao_ledger.origem` pelo Plan 03-10 — não há ledger novo, e
não há campo `origem` na entrada, para que os dois lados não possam divergir.

## Recorrência de Contas a pagar: o que está travado (D3-05/D3-06/D3-07)

A regra é **por Tarefa** (`RecurrenceRule`, em `types/structure.ts`), não por
Lista: o Aluguel e uma assinatura podem divergir de frequência, de dia útil e
de Responsável padrão sem que ninguém precise abrir exceção no código.

O vencimento **satura no último dia do mês de destino** (D3-07): 31/01 + 1 mês
é 28/02, nunca 03/03. A consequência aceita, que vale saber antes de estranhar,
é que a série não volta ao dia original — ela é calculada a partir do vencimento
anterior, então 31 → 28 → 28. Com o dia útil anterior, que é a regra real do
Financeiro, o recuo acumula e uma conta "todo dia 31" chega ao dia 26 em cinco
meses. Reverter isso exigiria guardar o dia âncora da série; é mudança de
comportamento, não conserto de bug.

**Feriado é dia útil comum** (D3-06). A Recorrência desloca por sábado e
domingo e por mais nada. Nenhuma tabela de feriados e nenhuma dependência de
datas entra nesta camada — `dependencies` é `zod` e só.

A ocorrência nasce **uma vez por fechamento** (D3-05/RN-CP-06) porque a regra é
transferida à Tarefa nova e apagada da concluída: reabrir e fechar de novo não
tem o que gerar, e a série continua a partir da ocorrência, não da origem.

As quatro afirmações são provadas por
`src/operations/recorrencia-contas-a-pagar.test.ts`, em pares de data exatos —
quem mudar qualquer uma delas quebra aquele arquivo, e é ali que a decisão está
escrita por extenso.

## Solicitação aprovada → Conta a pagar: conversão, não quinto Status (D3-08)

Hoje quem cria a Conta quando uma Solicitação é aprovada é o `automation/`,
escrevendo uma Tarefa nova na Lista ClickUp `901107637383`. O critério 1 da
Fase 3 arquiva aquela Lista. Sem um caminho próprio, a primeira Solicitação
aprovada depois do corte não viraria conta nenhuma, e o Financeiro reabriria o
ClickUp na mesma semana em que deveria ter parado. `importarContaAPagarHistorica`
resolve o **histórico** (PAG-01, as 2.861 Tarefas que já existiam);
`converterSolicitacaoEmContaAPagar` (`src/operations/conversao-de-solicitacao.ts`)
resolve o **fluxo dali para frente**. São as duas metades do mesmo critério.

**`convertida` nunca esteve no catálogo.** D-01 sobrepôs a enumeração
preliminar de CON-04 depois que PREP-03 leu a Lista real `901109104938`: os
quatro Status de `solicitacao-de-pagamento.ts` são os únicos que o processo
tem, e `convertida` aparece ali só em comentário. O que D-14 prometeu à Fase 3
foi, literalmente, *a Conta a pagar **e o Vínculo estruturado*** — e é
exatamente isso que nasce aqui: um `Link` `task→task` com
`role: "conta a pagar gerada"` mais `provenance.kind = "task"` na Conta. A
pergunta do Financeiro — "qual conta veio desta solicitação?" — é respondida
pelo Vínculo nos dois sentidos, e a inversa pela procedência. Um Status não
responderia nem uma nem outra.

O preço de um quinto Status, conferido e não estimado, para quem um dia quiser
revisitar a decisão: `solicitacao-de-pagamento.test.ts` asserta os quatro nomes
**e** varre a lista de proibidos, `convertida` incluído;
`solicitacao-de-pagamento-evolver.test.ts` asserta `definitions.length === 4` e
soma o total do catálogo; e `apps/api/src/servicos/dto-solicitacao.ts` é
exaustivo sobre a união `PaymentRequestDtoV1["status"]` — um Status novo é
mudança de **contrato versionado**, do outro lado da fronteira.

**A conversão é o espelho invertido da importação histórica.**
`importarContaAPagarHistorica` não pode acordar Automação nenhuma; esta
**precisa** acordar A9. Por isso a Conta nasce com `runAutomations: false` e o
evento `tarefaCriada` é disparado à mão no fim, depois dos Campos e das Tags:
A9 só alcança a Pessoa da conta por `fromFieldDefinitionId`, e disparar antes a
deixaria de fora dos Observadores da própria conta.

**O que a Lista destino não representa vira lacuna, não rollback.** Os 25
Campos da Solicitação são 21 pares + 3 sem equivalente + 1 vencimento nativo, e
a soma é travada por teste — um Campo novo na origem quebra o teste em vez de
sumir na conversão. Quando o valor não cabe no catálogo de destino (a Forma de
pagamento tem quatro opções na origem e três no destino), a Conta nasce com o
Campo vazio e um Registro `Lacuna de conversão` nomeando o **Campo**, nunca o
valor (D-25); RN-CP-02 então segura a conta em `para pagar` até alguém decidir.
Qualquer outra recusa — Campo arquivado, Campo fora da Lista — é rollback: não
fica meia Conta no estado.

A operação está registrada em `OPERACOES` e alcançável por
`POST /operacoes/converterSolicitacaoEmContaAPagar`, mas **nada a dispara
sozinha**. Ligar o gatilho ao `aprovado` mora em `operations/tasks.ts` ou num
tipo de ação novo de Automação, e é trabalho de quem for dono daqueles
arquivos.

## Mudança de Status em lote: uma transação por gesto, recusa por item (PAG-05)

`alterarStatusEmLote` (`src/operations/lote.ts`) existe porque CON-CP-11 é um
fato datado — em 2026-09-08 11:58:06, 61 Tarefas com vencimento 2026-09-04
foram fechadas no mesmo segundo — e não uma conveniência de tela. A origem
real desse "lote de 61" é uma recorrência mensal fechando junto, não uma
varredura arbitrária; por isso a operação recebe **ids**, nunca um filtro, e
o recorte (dia de vencimento, Tag, Status) é trabalho da tela, que já sabe
fazê-lo.

**Não reimplementa permissão nem regra de Status.** A operação chama
`changeTaskStatus` item a item, e é de lá que vêm RN-CP-02 (requisitos de
saída), RN-CP-04 (`entryAllowedMemberIds`), a visibilidade (`memberSeesTask`)
e A1 (`spawnNextOccurrence`, a Regra de Recorrência da própria Tarefa — não
um dos nove `Automation` da Lista). Quem "otimizar" isso para uma checagem
única por conjunto abre exatamente o furo de permissão que um endpoint de
lote costuma abrir (T-3-45): uma checagem feita uma vez para o conjunto deixa
passar o que uma checagem por item pega.

**A forma da transação, em duas linhas.** Uma hidratação (~19 mil linhas no
Espaço depois da importação de 03-10) atende 61 fechamentos em memória, contra
61 hidratações se cada fechamento abrisse sua própria transação — 61 < 250, a
constante que 03-10 justificou para a importação histórica, não é uma segunda
decisão, é a mesma regra aplicada a um N menor. `LIMITE_DO_LOTE = 200` é o que
mantém "uma transação" uma decisão e não um acidente: acima dele, o argumento
de 03-10 (picotar) volta a valer, e quem pica é quem chama, não esta função.

**Falha parcial é valor, não exceção.** Cada item volta um de quatro
resultados (`alterada`, `jaEstava`, `recusada`, `parcial`), com a aritmética
`solicitadas === alteradas + jaEstavam + recusadas + parciais` sempre
verificável — porque os 61 fatos são independentes (ao contrário da Tarefa e
da sua linha de ledger em 03-10, onde a atomicidade é entre duas metades do
MESMO fato). Uma conta que se recusa a fechar não derruba as outras 60.

**`jaEstava` é curto-circuitado ANTES de `changeTaskStatus` (T-3-46).** Uma
Tarefa já no Status alvo não é reprocessada: com `before.id === target.id`,
`changeTaskStatus` pula as guardas de saída/entrada mas ainda regrava
`statusId`, escreve um Registro com `before === after` e **redispara**
`runListAutomations` — sem o curto-circuito, reexecutar o mesmo lote
(duplo clique, F5, retry de rede) rodaria as Automações de entrada em Status
de novo a cada tentativa.

A operação está registrada em `OPERACOES` e alcançável por
`POST /operacoes/alterarStatusEmLote`, devolvendo `RelatorioDeLote` dentro do
envelope de sempre — **nenhuma rota nova foi criada e `app.ts` não foi
tocado**.

## Conferência do Resumo (Fase 6): o Resumo antes do lançamento, conferido por dado

Os Fluxos 5, 6 e 7 do módulo TRIA, como o `financeiro-tria/automation` faz no
ClickUp (`.planning/phases/06-conferencia-do-resumo-e-anexos/06-CONTEXT.md`).
Tudo em `operations/financeiro.ts` (e a decisão em `operations/ai.ts`), puro.
O plano 06-11 fechou no domínio os achados do review (`06-REVIEW.md`:
crm:CR-03, WR-03, WR-04, WR-08, WR-10, WR-12, IN-02, IN-03):

| Símbolo | O que faz |
|---|---|
| `operations/financeiro-base.ts` (06-11) | O módulo-folha: `CP`, `fieldValue`, `ConferenciaDoResumo`, `conferenciaVigente`, `impressaoDeLancamento`, `revisoresDoResumo`, `FORMA_DO_CODIGO_DE_CATEGORIA` e `lancamentoSemCodigo`. Só `import type`, e por isso `./ai` (a decisão) e `./tasks` (resolver o fio) o importam sem o ciclo com `./financeiro`, que reexporta o que já era público lá (crm:WR-08). |
| `publicarResumoParaConferencia(state, ator, taskId, { dePara, pedidoDeRevisao?, pedidoPor?, motivo?, impressaoEsperada?, conferenciaRejeitadaId? })` | O Agente publica o `📋 RESUMO DE PAGAMENTO` (byte a byte, CON-CP-08) seguido da chamada ao Financeiro — raiz na primeira vez, resposta no MESMO fio nas seguintes —, SEM resolver o fio, e abre a Conferência (`solicitarConferenciaDoResumo`, que cancela a pendente anterior: "Conferência superada"). Idempotente para a mesma impressão; tudo ou nada. 06-11 (crm:WR-12): `impressaoEsperada` diferente da atual e `conferenciaRejeitadaId` que não é a vigente `rejeitada` recusam SEM efeito — o Resumo não sai sobre dados que mudaram, nem em dobro. |
| `decideProcessApproval` (ramo `processStep: "resumo"`) | Clique e resposta no fio convergem: resposta canônica no fio, decisão/fonte/motivo gravados, fio resolvido na aprovação; `rejeitada` exige motivo. **Nunca muda o Status.** 06-11: duas recusas SEM efeito — a impressão atual não é a da Conferência (`recusaDesatualizada`, as duas decisões, crm:WR-08) e APROVAR um Resumo sem código de Categoria (`lancamentoSemCodigo`: `ausente` ou fora de `d.dd.dd`/`d.dd.dd.dd` ⇒ `recusaSemCodigo`, crm:WR-03). Pedir ajuste continua aberto. |
| `registrarLancamentoNoOmie(state, ator, taskId, { payableId, reaproveitado, anexos, anexosPedidos? })` | Só com a conta em "em lançamento omie" e Conferência `conferida` para a impressão ATUAL: confirma no fio, resolve o fio, grava a `AgentExecution` com o título real e move para "lançado omie" — tudo ou nada. `anexosPedidos` (06-11) vai ao texto da confirmação. |
| `registrarFalhaDoLancamento(state, ator, taskId, { motivo, code }, { avisarId?, superarConferencia? })` | Comenta o motivo no fio com Menção ao Financeiro e volta a conta para "para pagar" (a partir de "em lançamento omie"). O Registro guarda só o `code`. 06-11 (crm:WR-10): tudo ou nada, com `guardasDoAgente` — o aviso sai ANTES do Status; se a volta for recusada, o aviso é trocado pelo que diz que a conta NÃO voltou; uma recusa não deixa Comentário, Status nem Registro. 06-12 (crm:WR-09): `superarConferencia: true` cancela a Conferência vigente `aprovada` ("Conferência superada", `before: "aprovada"`, `after: "cancelada"`, com o `code`) antes do Registro da falha — a saída depois do 422 `CONTA_DIVERGENTE`: a Conferência afirmou uma conta corrente que o Omie não usaria mais, e só um Resumo novo pode ser conferido. O 422 `TITULO_EXISTENTE_DIVERGENTE` NÃO supera: a Conferência continua certa; o título no Omie é que se corrige ou se exclui. |
| `conferenciaDoResumo(state, task)` | `sem-resumo` \| `pendente` \| `conferida` \| `ajuste-pedido` \| `desatualizada`, mais a Conferência vigente e a impressão atual. `desatualizada` vence qualquer decisão. A vigente (`conferenciaVigente`, 06-12) é a Conferência MAIS RECENTE da Tarefa; se ela está `cancelada` ou `expirada`, nenhuma (`sem-resumo`) — uma Conferência antiga, rejeitada ou aprovada, nunca volta a valer. Antes de 06-12 era "a mais recente não cancelada"; como o único cancelamento de antes era o das pendentes mais antigas, todo fluxo anterior dá o mesmo resultado. |
| `respostasDeConferenciaPendentes` / `classificarRespostaDeConferencia` | As respostas de revisores ainda não decididas — excluídas as do processo pela autoria (Agente) e pela forma exata (`FORMAS_CANONICAS_DO_FIO`), nunca pelo emoji inicial (06-11, crm:WR-04) — e o que cada uma quer dizer (`aprovacao` \| `ajuste` \| `ignorar`), sem IA. Classificador **estrito: só a mensagem inteira aprova** (06-11, crm:CR-03): toda palavra no conjunto de aprovação, no máximo 6, sem dígito/símbolo/emoji além de 👍/✅, com um sinal de aprovação; "nada casou" é `ajuste` (Fluxo 6). |
| `decisaoDasRespostasPendentes(state, task, { aprovacaoPorComentario })` | 06-11 (crm:WR-04): percorre TODAS as respostas pendentes em ordem; o primeiro `ajuste` vence qualquer `aprovacao` do lote; sem ajuste, a primeira `aprovacao` só com `aprovacaoPorComentario` (D6-02). Devolve a resposta que decide e `ultimaLida`. Não decide nada: quem chama `decideProcessApproval` é a ponte. |
| `impressaoDeLancamento(state, task)` | JSON canônico (chaves ordenadas) de tudo o que vai ao Omie: Centro, Empresa, Categoria, fornecedor (tipo, documento, nome), forma, dado de pagamento, Valor, vencimento, Data de Emissão, Tag `conta *`, título e descrição. Anexo, Boleto, QR Code e Comentários NÃO entram. |
| `revisoresDoResumo(state)` | O Financeiro (quando Membro ativo) e os Membros ativos Administrador/Proprietário (D6-09). |
| `movidaDepoisDaImportacao(state, task)` | G1: a conta entra na ponte do Agente — nasceu na plataforma, ou foi importada do ClickUp e o último movimento de Status é posterior a `provenance.at`. A ponte (`apps/api`) não varre a importada parada, e a tela não mostra "Aguardando Resumo" para ela: a mesma régua nos dois lados. |
| `avisadoDaConferencia(state, ator, avisarId?)` | Quem os atos da Conferência mencionam: `avisarId` quando é Membro ativo, senão `avisadoDoLancamento`. É a opção aditiva `avisarId` de `publicarResumoParaConferencia` (Menção, chamada e aprovador) e de `registrarFalhaDoLancamento` (5º parâmetro) — a porta G3 da ponte para ambiente de teste (06-03). Não muda `revisoresDoResumo`. |
| `TEXTOS_DA_CONFERENCIA` | Os textos canônicos, em `operations/financeiro-textos.ts` (fora de `financeiro.ts` para não criar o ciclo `ai` ↔ `financeiro`) e reexportados por `financeiro.ts`: domínio, ponte e tela usam as mesmas strings. 06-11: `lancado` descreve os anexos pelo status real (`anexos n de m`, `k já estavam no título`, `anexos do primeiro envio`; nunca `sem anexos` com anexos pedidos, crm:IN-03); `recusaDesatualizada` e `recusaSemCodigo`; `tituloDivergente(payableId, campos)` e `contaDivergente(conferida, resolvida)`, o `motivo` de `registrarFalhaDoLancamento` para os 422 da v1.2 — só id do título, nomes de campo e rótulos de conta, nenhum valor. |

As três regras com dono (`06-CONTEXT.md`):

- **D6-10 — a tripla é DADO.** Conta · categoria · código e a impressão ficam
  em `ApprovalRequest.origin` (ramo `resumo`: `resumoCommentId`, `impressao`,
  `lancamento`). Nenhuma função lê a tripla do TEXTO de um Comentário — o
  texto do RESUMO é saída, e reparseá-lo é a fragilidade do legado. O
  `/lancar` recebe o código confirmado da Conferência.
- **D6-02 — "ok" no fio vale como conferência**, em nome de quem respondeu;
  qualquer outra resposta de revisor é pedido de ajuste; pergunta,
  "aguardando" e "vou verificar" são ignoradas. Quem transforma a resposta em
  decisão é a ponte (06-03), com `classificarRespostaDeConferencia` e
  `decideProcessApproval(..., { source: "comment" })`.
- **D6-03 — falha permanente volta para "para pagar"**, com o motivo no fio.
  A alternativa (ficar em "em lançamento omie") é tirar uma chamada a
  `changeTaskStatus` em `registrarFalhaDoLancamento`.

`runLancamentoAgent` não muda: continua sendo o caminho do Ensaio (D3-03) e da
A7 legada. O fio do Resumo pode ser resolvido à mão por quem o confere:
`resolveTaskComment` aceita, além do autor e do Administrador, o aprovador da
Conferência VIGENTE daquele fio ou um Membro de `revisoresDoResumo` — só para
RESOLVER (06-11, crm:IN-02). O aprovador de uma Conferência cancelada não
resolve, e ninguém reabre pela exceção: reabrir o fio não reabre a
Conferência, cuja decisão fica.

**06-18 — a dispensa só enquanto "Manual", e quem confere pelo fio = pelo
clique** (`06-REVIEW-2.md`):

- **A dispensa é dado (crm2:CR-01).** A dispensa D6-04 (`sem-conferencia`)
  grava `ApprovalRequest.decisionWaiver = "integracaoManual"` e só vale
  enquanto o Campo "Integração manual" da conta é "Manual":
  `dispensaSemManual(task, c)` (em `financeiro-base.ts`, com
  `dispensaDaConferencia` e `MOTIVO_DA_DISPENSA`, que saiu da ponte) faz
  `conferenciaDoResumo` devolver `desatualizada` — e com isso
  `registrarLancamentoNoOmie` recusa, a ponte publica um Resumo novo para uma
  pessoa e a tela mostra a conta como a conferir. Leitura de compatibilidade,
  fail-closed, para registros de antes de 06-18: aprovada sem o campo, com o
  motivo exato `MOTIVO_DA_DISPENSA` e decisor = aprovador (a forma que só a
  ponte gravava) também é dispensa.
- **`dispensarConferenciaDoResumo(state, ator, conferenciaId, opcoes?)`** — fora
  de `OPERACOES` e da rota (só a ponte chama): decide sobre o estado RECEBIDO
  (dentro da Unidade de Trabalho, o da gravação), recusa sem efeito com
  `recusaDispensaSemManual` se a conta não é mais "Manual", aplica
  `decideProcessApproval` (as guardas de impressão e de código valem) e só
  então marca `decisionWaiver`. `opcoes?.aprovacaoPorComentario` (padrão
  `true`) governa a checagem de resposta pendente no fio — ver 06-22 abaixo.
- **`podeDecidirAConferencia(state, memberId, conferencia)` (em `ai.ts`,
  crm2:WR-03)** é a régua única de quem confere: alcança a conta e é o
  aprovador designado ou Administrador/Proprietário ativo. Filtra as
  respostas do fio (`respostasDeConferenciaPendentes`, que antes usava
  `revisoresDoResumo`) e os botões da tela. `revisoresDoResumo` (D6-09)
  continua valendo para RESOLVER o fio.
- **`respostaSemEfeitoNoFio(state, task, { aprovacaoPorComentario })`** — o
  "ok" que não confere e o texto que o Agente responde:
  `okDeQuemNaoConfere(<aprovador>)` a quem não pode decidir;
  `okPeloFioDesligado` a quem decide, com a decisão por comentário desligada
  e nenhum ajuste no lote. O fio é a memória: uma resposta já respondida pelo
  Agente, com o mesmo texto, depois dela, é descartada.
- **`aprovacaoPorComentario: false`** em `publicarResumoParaConferencia`
  troca o pedido do "ok" pelo do botão (`chamada`, `revisado`,
  `dadosMudaram`, `superada`) e grava `origin.aprovacaoPeloFio = false`, que
  o card e a doca leem (D6-10: dado, não configuração). Sem a opção, o texto
  é o de sempre, byte a byte.
- **O fio único (crm2:IN-01).** O fio do Resumo é o da Conferência MAIS
  RECENTE (`conferenciaMaisRecente`), mesmo cancelada: depois de
  `superarConferencia`, o Resumo novo responde no fio de antes, com o sufixo
  `superada`, e a conta continua com um fio só de Resumo.

**06-19 — o lançamento em curso e a porta G3 estrita** (`06-REVIEW-2.md`):

- **A marca "Lançamento no Omie em curso" (crm2:WR-01).** Antes de cada
  `/lancar`, a ponte grava `marcarLancamentoEmCurso(state, ator, taskId)`
  (fora de `OPERACOES` e da rota; guardas do Agente, conta em "em lançamento
  omie", Conferência `conferida`, nenhuma marca vigente de outro Membro): um
  Registro de Atividade do Agente em nome do Membro de serviço. A marca é
  Atividade, não campo da Tarefa — já é hidratada, é do Agente (não conta como
  mudança humana na ponte), fica no histórico e não entra na chave da ponte.
  `lancamentoEmCursoDe(state, task, agora?)` (em `financeiro-base.ts`, pura)
  olha o mais recente dos quatro Registros do lançamento (`at`, depois a
  sequência do id): a marca vale até "Lançado no Omie"
  (`registrarLancamentoNoOmie`), "Lançamento no Omie falhou"
  (`registrarFalhaDoLancamento`), "Lançamento no Omie interrompido"
  (`encerrarLancamentoEmCurso`, com o código no `detail`) ou
  `PRAZO_DO_LANCAMENTO_EM_CURSO_MS` (5 min — a conta se destrava sozinha se a
  ponte morrer no meio). Os nomes dos Registros são constantes
  (`REGISTRO_*`), e `PREFIXO_LANCAMENTO_HUMANO` mudou para a base
  (`financeiro.ts` reexporta tudo).
- **As duas recusas moram em `tasks.ts`**, para que a tela e o endpoint
  apliquem a mesma regra: `changeTaskStatus` recusa a OUTRO Membro mudar o
  Status da conta em lançamento (`RECUSA_LANCAMENTO_EM_CURSO`; o lote herda
  por item), e `addTaskComment` recusa o registro humano do lançamento (o
  texto com `PREFIXO_LANCAMENTO_HUMANO`, de Membro). Quem marcou passa — é
  ele quem move no registro e na falha. Os Campos NÃO travam: uma edição no
  meio do `/lancar` cai na reconferência de `registrarLancamentoNoOmie`.
- **A porta G3 estrita (crm2:WR-04).** `avisarEstrito: true` em
  `publicarResumoParaConferencia` e em `registrarFalhaDoLancamento`: com um
  `avisarId` que não é Membro ativo, recusa sem efeito com
  `TEXTOS_DA_CONFERENCIA.recusaAvisarInativo` (antes de qualquer escrita e da
  idempotência), em vez de cair em silêncio na Maryane. A ponte passa a opção
  sempre que tem `avisarId`; sem ela, `avisadoDaConferencia` segue a regra de
  sempre.

**06-21 — a dispensa nunca engole uma resposta humana pendente** (`06-REVIEW-3.md`, Crítico, resíduo de crm2:CR-01):

- **`dispensarConferenciaDoResumo`** recusa com
  `TEXTOS_DA_CONFERENCIA.recusaDispensaComRespostaPendente` quando há, no fio
  da Conferência vigente, uma resposta de Membro ainda não processada
  (`decisaoDasRespostasPendentes(state, task, { aprovacaoPorComentario: true
  }).sentido !== "nenhum"` — `true` fixo, a leitura mais permissiva que ainda
  bloqueia todo `ajuste`, calculado logo depois da checagem de "Manual" e
  ANTES de `decideProcessApproval`). O caminho que o review achou: dispensa →
  desmarcar "Manual" → Resumo novo no mesmo fio → um humano responde (ajuste
  OU aprovação) → remarcar "Manual" antes do próximo ciclo — a Conferência com
  a resposta pendente não se dispensa nunca mais; ela é lida, e a decisão vira
  do Membro humano, não do de serviço.

**06-22 — a checagem de resposta pendente respeita a política real de conferência por comentário** (`06-REVIEW-4.md`, Aviso, regressão do próprio 06-21):

- **`dispensarConferenciaDoResumo` ganha um 4º parâmetro opcional**
  `opcoes?: { aprovacaoPorComentario?: boolean }` (padrão `true`, preserva
  06-21 sem edição em nenhum chamador existente). O `true` fixo de 06-21
  travava a dispensa `sem-conferencia` (D6-04) para sempre quando o espaço de
  trabalho desliga `conferenciaPorComentario` (D6-02): um "ok" trivial no fio
  — que o próprio domínio já trata como sem peso
  (`TEXTOS_DA_CONFERENCIA.okPeloFioDesligado`) — passava a bloquear a dispensa
  do mesmo jeito que um ajuste de verdade, só que sem nunca se resolver
  (`decisaoDasRespostasPendentes` não tem noção de "já respondido"). A ponte
  agora passa `{ aprovacaoPorComentario: decisoes.conferenciaPorComentario }`
  (a política real) nos dois pontos que chamam `dispensarConferenciaDoResumo`
  e na pré-checagem `pendenteNoFio`; o ramo `ajuste` continua bloqueando em
  qualquer política (a opção não o afeta).

## CRM relacional (Fase 7): o modelo novo em português, ao lado do antigo

`src/crm/` é o domínio do CRM sobre `apps/api/migracoes/007-crm.sql`,
exposto como `@n1/dominio/crm/<modulo>` — **sem barril**: `comum`,
`contatos`, `empresas`, `funis`, `negocios`, `normalizacao`, `permissoes`.
O `export "./*"` de `package.json` já resolve o subcaminho; nada entrou no
barril `@n1/dominio` nem no `DataState`, porque o CRM novo não é hidratado
por `GET /estado`.

**Tipos em português espelhando a 007 (D-01).** `Contato`, `Empresa`,
`Funil`, `Etapa`, `Negocio`, os Identificadores e o vínculo
Contato-Empresa, com os estados de ciclo de vida da 007
(`ativo`/`arquivado`/`na_lixeira`) e a situação do Negócio
(`aberto`/`ganho`/`perdido`). `date` e `numeric` são texto (`"AAAA-MM-DD"`,
`"1234.50"`), como saem do banco.

**Regras puras, usadas pela api e pela tela.** `validarContato`
(INV-CON-01), `validarEmpresa`, `validarRetiradaDeAdmin` (D-08),
`validarNovoFunil`, `validarMudancaDeEstado`, `deveNascerPadrao` (D-13),
`validarMigracao` (D-07), `validarNovoNegocio`, `validarMovimento`,
`validarGanho`/`validarPerda` (as Regras de encerramento do Funil, D-05),
`validarReabertura`, `probabilidadeEfetiva`, as frases de bloqueio
(`fraseDeContatoBloqueado`, `fraseFunilComNegocios`…) e a normalização de
Identificadores (`normalizacao.ts`: e-mail, telefone, WhatsApp, Instagram,
domínio, documento). `permissoes.ts` é a matriz de D-14 (`podeNoCrm`,
`ehAdministracao`): a api a aplica no serviço, a tela a consulta para
esconder — a regra mora aqui para os dois lados dizerem a mesma coisa.
Mesma forma de `operations`: `OperationResult`, sem exceção pela
fronteira.

**O que não mudou.** `types/crm.ts` (`Contact`, `Company`, `Deal`,
`Pipeline`…), `operations/{contacts,deals}.ts` e o seed de CRM continuam
inteiros: Caixa de Entrada, Conversas, Busca global, Lixeira, Notificações
e `/crm/meus-negocios` ainda leem esse modelo. Os dois convivem até a fase
de unificação (D-01, D-15); nenhum módulo de `src/crm/` importa o antigo
nem vice-versa.
