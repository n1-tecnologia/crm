/**
 * Todos os `export *` seguem valendo: helpers (`nextId`, `recordActivity`…),
 * constantes (`CP`, `CR`), tipos e a versão CRUA de cada operação continuam
 * saindo daqui — é o que os testes de domínio (`operations.test.ts` e os
 * demais) importam, de propósito: eles verificam a regra de negócio, não o
 * gravador de chamadas.
 *
 * Por baixo de cada `export *`, uma linha `export const <nome> = instrumentar`
 * de `<nome>` por operação SOMBREIA a exportação crua do módulo
 * de origem — ESM e o TypeScript resolvem a favor da declaração local, sem
 * erro de exportação duplicada. É por isso que `import * as operations from
 * "."` (o que `apps/web` e `apps/api` usam) devolve a
 * versão instrumentada, e `import { createTask } from
 * "./tasks"` (o que os testes usam) devolve a crua.
 */

import { instrumentar } from "./registro";

export * from "./activity";
export * from "./tasks";
export * from "./deals";
export * from "./conversations";
export * from "./contacts";
export * from "./ai";
export * from "./chat-folders";
export * from "./agent-builder";
export * from "./configuration";
export * from "./collaboration";
export * from "./planning";
export * from "./scale";
export * from "./iniciar-conversa";
export * from "./ferramentas";
export * from "./tarefas-conversacionais";
export * from "./canais";
export * from "./ia";
export * from "./automations";
export * from "./financeiro";
export * from "./conversao-de-solicitacao";
export * from "./lote";
export * from "./members";
export * from "./structure";
export * from "./importacao";
export * from "./importacao-contas-a-pagar";
export * from "./importacao-contas-a-receber";

export { OPERACOES, ehNomeDeOperacao, gravarChamadas, instrumentar, serializarArgumentos, reviverArgumentos } from "./registro";
export type { NomeDeOperacao, ChamadaDeOperacao } from "./registro";

// `recusaDeMembroAtivo` existe nas duas vozes (Ferramentas do Canal e IA): o
// barril mantém a do Canal, que a tela de Ferramentas já importa, e expõe a da
// IA com sufixo. Dentro de `operations/ia/`, os módulos importam a própria.
export { recusaDeMembroAtivo } from "./ferramentas";
export { recusaDeMembroAtivo as recusaDeMembroAtivoNaIa } from "./ia/permissoes-ia";

// tasks.ts
export const createTask = instrumentar("createTask");
export const changeTaskStatus = instrumentar("changeTaskStatus");
export const assignTask = instrumentar("assignTask");
export const unassignTask = instrumentar("unassignTask");
export const moveTask = instrumentar("moveTask");
export const convertChecklistItem = instrumentar("convertChecklistItem");
export const trashTask = instrumentar("trashTask");
export const restoreTask = instrumentar("restoreTask");
export const restoreList = instrumentar("restoreList");
export const addChecklist = instrumentar("addChecklist");
export const addChecklistItem = instrumentar("addChecklistItem");
export const setChecklistItemDone = instrumentar("setChecklistItemDone");
export const startMeeting = instrumentar("startMeeting");
export const endMeeting = instrumentar("endMeeting");
export const updateTask = instrumentar("updateTask");
export const setTaskFieldValue = instrumentar("setTaskFieldValue");
export const addTaskComment = instrumentar("addTaskComment");
export const resolveTaskComment = instrumentar("resolveTaskComment");
export const setTaskTags = instrumentar("setTaskTags");
export const watchTask = instrumentar("watchTask");

// deals.ts
export const moveDealToStage = instrumentar("moveDealToStage");
export const winDeal = instrumentar("winDeal");
export const loseDeal = instrumentar("loseDeal");
export const reopenDeal = instrumentar("reopenDeal");
export const linkContactToDeal = instrumentar("linkContactToDeal");
export const removeStage = instrumentar("removeStage");
export const migrateDealsToFunnel = instrumentar("migrateDealsToFunnel");
export const restoreDeal = instrumentar("restoreDeal");
export const moveDealToFunnel = instrumentar("moveDealToFunnel");
export const createDeal = instrumentar("createDeal");
export const unlinkContactFromDeal = instrumentar("unlinkContactFromDeal");
export const setDealFieldValue = instrumentar("setDealFieldValue");

// conversations.ts
export const sendMessage = instrumentar("sendMessage");
export const resolveConversation = instrumentar("resolveConversation");
export const reopenConversation = instrumentar("reopenConversation");
export const assignConversation = instrumentar("assignConversation");
export const trashConversation = instrumentar("trashConversation");
export const moveConversationToContact = instrumentar("moveConversationToContact");
export const discardDraft = instrumentar("discardDraft");
export const restoreConversation = instrumentar("restoreConversation");
export const startConversation = instrumentar("startConversation");
export const toggleConversationStar = instrumentar("toggleConversationStar");
export const markConversationRead = instrumentar("markConversationRead");

// contacts.ts
export const addContactIdentifier = instrumentar("addContactIdentifier");
export const transferContactIdentifier = instrumentar("transferContactIdentifier");
export const mergeContacts = instrumentar("mergeContacts");
export const endContactCompanyLink = instrumentar("endContactCompanyLink");
export const trashContact = instrumentar("trashContact");
export const trashCompany = instrumentar("trashCompany");
export const restoreMergedCopy = instrumentar("restoreMergedCopy");
export const importContacts = instrumentar("importContacts");
export const restoreContact = instrumentar("restoreContact");
export const restoreCompany = instrumentar("restoreCompany");
export const markContactsAsDistinct = instrumentar("markContactsAsDistinct");
export const addContactNote = instrumentar("addContactNote");
export const createContact = instrumentar("createContact");
export const createCompany = instrumentar("createCompany");
export const linkContactToCompany = instrumentar("linkContactToCompany");
export const addCompanyIdentifier = instrumentar("addCompanyIdentifier");
export const setContactCatalogValue = instrumentar("setContactCatalogValue");
export const updateCompany = instrumentar("updateCompany");
export const addCompanyNote = instrumentar("addCompanyNote");

// ai.ts
export const decideApproval = instrumentar("decideApproval");
export const decideProcessApproval = instrumentar("decideProcessApproval");
export const solicitarAprovacao = instrumentar("solicitarAprovacao");
export const publishAutomation = instrumentar("publishAutomation");
export const restoreAgent = instrumentar("restoreAgent");
export const restoreAutomation = instrumentar("restoreAutomation");
export const createChatSession = instrumentar("createChatSession");
export const configureChatSession = instrumentar("configureChatSession");
export const sendChatMessage = instrumentar("sendChatMessage");

// chat-folders.ts
export const createChatFolder = instrumentar("createChatFolder");
export const renameChatFolder = instrumentar("renameChatFolder");
export const deleteChatFolder = instrumentar("deleteChatFolder");
export const moveChatSessionToFolder = instrumentar("moveChatSessionToFolder");

// agent-builder.ts
export const createAgent = instrumentar("createAgent");
export const publishAgentVersion = instrumentar("publishAgentVersion");

// configuration.ts
export const createFieldDefinition = instrumentar("createFieldDefinition");
export const updateFieldDefinition = instrumentar("updateFieldDefinition");
export const archiveFieldDefinition = instrumentar("archiveFieldDefinition");
export const restoreFieldDefinition = instrumentar("restoreFieldDefinition");
export const addStatus = instrumentar("addStatus");
export const updateStatus = instrumentar("updateStatus");
export const reorderStatuses = instrumentar("reorderStatuses");
export const removeStatus = instrumentar("removeStatus");
export const overrideStatusSet = instrumentar("overrideStatusSet");
export const inheritStatusSet = instrumentar("inheritStatusSet");
export const createTaskType = instrumentar("createTaskType");
export const updateTaskType = instrumentar("updateTaskType");
export const removeTaskType = instrumentar("removeTaskType");
export const setContainerFeature = instrumentar("setContainerFeature");
export const usarCampoHerdado = instrumentar("usarCampoHerdado");

// collaboration.ts
export const addDependency = instrumentar("addDependency");
export const removeDependency = instrumentar("removeDependency");
export const addTimeEntry = instrumentar("addTimeEntry");
export const startTimer = instrumentar("startTimer");
export const stopTimer = instrumentar("stopTimer");
export const attachFile = instrumentar("attachFile");
export const removeAttachment = instrumentar("removeAttachment");
export const setRecurrence = instrumentar("setRecurrence");
export const spawnNextOccurrence = instrumentar("spawnNextOccurrence");

// planning.ts
export const setMemberCapacity = instrumentar("setMemberCapacity");
export const enableSprints = instrumentar("enableSprints");
export const disableSprints = instrumentar("disableSprints");
export const createNextSprint = instrumentar("createNextSprint");
export const closeSprint = instrumentar("closeSprint");
export const saveListAsTemplate = instrumentar("saveListAsTemplate");
export const saveTaskAsTemplate = instrumentar("saveTaskAsTemplate");
export const instantiateTaskTemplate = instrumentar("instantiateTaskTemplate");
export const instantiateListTemplate = instrumentar("instantiateListTemplate");
export const renameTemplate = instrumentar("renameTemplate");
export const setTemplateArchived = instrumentar("setTemplateArchived");

// scale.ts
export const saveView = instrumentar("saveView");
export const deleteView = instrumentar("deleteView");
export const setDefaultView = instrumentar("setDefaultView");
export const createForm = instrumentar("createForm");
export const updateForm = instrumentar("updateForm");
export const archiveForm = instrumentar("archiveForm");
export const rotateFormSecret = instrumentar("rotateFormSecret");
export const shareTaskPublicly = instrumentar("shareTaskPublicly");
export const revokePublicShare = instrumentar("revokePublicShare");

// automations.ts
export const runScheduledAutomations = instrumentar("runScheduledAutomations");

// financeiro.ts
export const runLancamentoAgent = instrumentar("runLancamentoAgent");
export const createReceivableSeries = instrumentar("createReceivableSeries");

// conversao-de-solicitacao.ts
// Ao contrário de `importacao-contas-a-pagar`, que sai cru porque não está em
// `OPERACOES`: quem converte é um Membro na interface. Sem esta linha,
// `apps/web` chamaria a versão crua, `gravarChamadas` não observaria a chamada
// e a operação rodaria no cliente sem nunca chegar ao servidor.
export const converterSolicitacaoEmContaAPagar = instrumentar("converterSolicitacaoEmContaAPagar");

// lote.ts
// Sem esta linha, `apps/web` chamaria a versão crua de `alterarStatusEmLote`,
// `gravarChamadas` não observaria a chamada e o lote de 03-13 rodaria só no
// navegador — 61 contas fechadas na tela e nenhuma no banco.
export const alterarStatusEmLote = instrumentar("alterarStatusEmLote");

// members.ts
export const alterarEmailDoConvite = instrumentar("alterarEmailDoConvite");
export const alterarPapelDoMembro = instrumentar("alterarPapelDoMembro");
export const removeMember = instrumentar("removeMember");
export const transferWorkspaceOwnership = instrumentar("transferWorkspaceOwnership");
export const inviteMember = instrumentar("inviteMember");
export const deleteRole = instrumentar("deleteRole");
export const grantGovernanceAccess = instrumentar("grantGovernanceAccess");

// structure.ts
export const createSpace = instrumentar("createSpace");
export const createFolder = instrumentar("createFolder");
export const createList = instrumentar("createList");

// iniciar-conversa.ts
export const iniciarConversa = instrumentar("iniciarConversa");

// ferramentas/notas.ts
export const adicionarNotaNoAtivo = instrumentar("adicionarNotaNoAtivo");

// ferramentas/captacao.ts
export const criarLinkDeCaptacao = instrumentar("criarLinkDeCaptacao");
export const editarLinkDeCaptacao = instrumentar("editarLinkDeCaptacao");
export const enviarLinkALixeira = instrumentar("enviarLinkALixeira");
export const restaurarLinkDaLixeira = instrumentar("restaurarLinkDaLixeira");

// ferramentas/grupos.ts
export const criarGrupo = instrumentar("criarGrupo");
export const importarGruposDoCanal = instrumentar("importarGruposDoCanal");
export const sincronizarGrupo = instrumentar("sincronizarGrupo");
export const editarGrupo = instrumentar("editarGrupo");
export const definirCanalDoGrupo = instrumentar("definirCanalDoGrupo");
export const editarCaptacaoDoGrupo = instrumentar("editarCaptacaoDoGrupo");
export const ativarCaptacao = instrumentar("ativarCaptacao");
export const inativarCaptacao = instrumentar("inativarCaptacao");
export const zerarCliques = instrumentar("zerarCliques");
export const regenerarLinkDeConvite = instrumentar("regenerarLinkDeConvite");
export const adicionarParticipantes = instrumentar("adicionarParticipantes");
export const removerParticipante = instrumentar("removerParticipante");
export const promoverParticipante = instrumentar("promoverParticipante");
export const rebaixarParticipante = instrumentar("rebaixarParticipante");
export const sairDoGrupo = instrumentar("sairDoGrupo");
export const arquivarGrupo = instrumentar("arquivarGrupo");
export const restaurarGrupo = instrumentar("restaurarGrupo");
export const enviarGrupoALixeira = instrumentar("enviarGrupoALixeira");
export const restaurarGrupoDaLixeira = instrumentar("restaurarGrupoDaLixeira");
export const aprovarPedidoDeEntrada = instrumentar("aprovarPedidoDeEntrada");
export const recusarPedidoDeEntrada = instrumentar("recusarPedidoDeEntrada");
export const enviarMensagemAoGrupo = instrumentar("enviarMensagemAoGrupo");

// ferramentas/flows.ts
export const criarFlow = instrumentar("criarFlow");
export const editarFlow = instrumentar("editarFlow");
export const definirPontoDeTrocaDeDados = instrumentar("definirPontoDeTrocaDeDados");
export const regenerarChavesDoPonto = instrumentar("regenerarChavesDoPonto");
export const removerPontoDeTrocaDeDados = instrumentar("removerPontoDeTrocaDeDados");
export const adicionarTela = instrumentar("adicionarTela");
export const editarTela = instrumentar("editarTela");
export const reordenarTela = instrumentar("reordenarTela");
export const duplicarTela = instrumentar("duplicarTela");
export const removerTela = instrumentar("removerTela");
export const adicionarComponente = instrumentar("adicionarComponente");
export const editarComponente = instrumentar("editarComponente");
export const moverComponente = instrumentar("moverComponente");
export const duplicarComponente = instrumentar("duplicarComponente");
export const removerComponente = instrumentar("removerComponente");
export const publicarVersao = instrumentar("publicarVersao");
export const despublicarFlow = instrumentar("despublicarFlow");
export const descartarRascunho = instrumentar("descartarRascunho");
export const criarRascunhoAPartirDe = instrumentar("criarRascunhoAPartirDe");
export const copiarFlow = instrumentar("copiarFlow");
export const arquivarFlow = instrumentar("arquivarFlow");
export const restaurarFlow = instrumentar("restaurarFlow");
export const enviarFlowALixeira = instrumentar("enviarFlowALixeira");
export const restaurarFlowDaLixeira = instrumentar("restaurarFlowDaLixeira");
export const sincronizarFlow = instrumentar("sincronizarFlow");
export const enviarFlow = instrumentar("enviarFlow");

// ferramentas/comunidades.ts
export const criarComunidade = instrumentar("criarComunidade");
export const sincronizarComunidade = instrumentar("sincronizarComunidade");
export const editarComunidade = instrumentar("editarComunidade");
export const alterarConfiguracoesDaComunidade = instrumentar("alterarConfiguracoesDaComunidade");
export const vincularGrupoAComunidade = instrumentar("vincularGrupoAComunidade");
export const desvincularGrupoDaComunidade = instrumentar("desvincularGrupoDaComunidade");
export const enviarMensagemAComunidade = instrumentar("enviarMensagemAComunidade");
export const sairDaComunidade = instrumentar("sairDaComunidade");
export const arquivarComunidade = instrumentar("arquivarComunidade");
export const restaurarComunidade = instrumentar("restaurarComunidade");
export const enviarComunidadeALixeira = instrumentar("enviarComunidadeALixeira");
export const restaurarComunidadeDaLixeira = instrumentar("restaurarComunidadeDaLixeira");

// ── Frontend do main (2026-09-25) ──────────────────────────────────────
// As 67 operações que o drop do frontend trouxe. Sem estas linhas, `apps/web`
// chamaria as versões cruas, `gravarChamadas` não observaria nada e o clique
// rodaria só no navegador — nunca chegaria a `POST /operacoes/:nome`.

// canais.ts
export const criarCanal = instrumentar("criarCanal");
export const configurarCanal = instrumentar("configurarCanal");

// tarefas-conversacionais.ts
export const alterarModeloDaLista = instrumentar("alterarModeloDaLista");
export const definirCanaisDaLista = instrumentar("definirCanaisDaLista");
export const criarTarefaConversacional = instrumentar("criarTarefaConversacional");
export const trocarCanalDaTarefa = instrumentar("trocarCanalDaTarefa");
export const vincularNegocioATarefa = instrumentar("vincularNegocioATarefa");
export const criarNegocioDaTarefa = instrumentar("criarNegocioDaTarefa");

// ia/agentes.ts
export const ativarAgente = instrumentar("ativarAgente");
export const pausarAgente = instrumentar("pausarAgente");
export const arquivarAgente = instrumentar("arquivarAgente");
export const enviarAgenteALixeira = instrumentar("enviarAgenteALixeira");
export const transferirAgente = instrumentar("transferirAgente");
export const ensaiarAgente = instrumentar("ensaiarAgente");
export const cancelarExecucao = instrumentar("cancelarExecucao");
export const apagarItemDeMemoria = instrumentar("apagarItemDeMemoria");

// ia/automacoes-editor.ts
export const criarAutomacao = instrumentar("criarAutomacao");
export const editarAutomacao = instrumentar("editarAutomacao");
export const duplicarAutomacao = instrumentar("duplicarAutomacao");
export const criarRascunhoDaAutomacao = instrumentar("criarRascunhoDaAutomacao");
export const descartarRascunhoDaAutomacao = instrumentar("descartarRascunhoDaAutomacao");
export const definirGatilho = instrumentar("definirGatilho");
export const adicionarCondicao = instrumentar("adicionarCondicao");
export const editarCondicao = instrumentar("editarCondicao");
export const removerCondicao = instrumentar("removerCondicao");
export const adicionarAcao = instrumentar("adicionarAcao");
export const editarAcao = instrumentar("editarAcao");
export const moverAcao = instrumentar("moverAcao");
export const removerAcao = instrumentar("removerAcao");
export const definirPoliticaDeErro = instrumentar("definirPoliticaDeErro");
export const pausarAutomacao = instrumentar("pausarAutomacao");
export const retomarAutomacao = instrumentar("retomarAutomacao");
export const arquivarAutomacao = instrumentar("arquivarAutomacao");
export const enviarAutomacaoALixeira = instrumentar("enviarAutomacaoALixeira");

// ia/conhecimento.ts
export const criarColecao = instrumentar("criarColecao");
export const editarColecao = instrumentar("editarColecao");
export const adicionarFonte = instrumentar("adicionarFonte");
export const arquivarColecao = instrumentar("arquivarColecao");
export const restaurarColecao = instrumentar("restaurarColecao");
export const adicionarDocumento = instrumentar("adicionarDocumento");
export const novaVersaoDoDocumento = instrumentar("novaVersaoDoDocumento");
export const restaurarVersaoDoDocumento = instrumentar("restaurarVersaoDoDocumento");
export const editarDocumento = instrumentar("editarDocumento");
export const moverDocumento = instrumentar("moverDocumento");
export const comentarDocumento = instrumentar("comentarDocumento");
export const arquivarDocumento = instrumentar("arquivarDocumento");
export const enviarDocumentoALixeira = instrumentar("enviarDocumentoALixeira");
export const restaurarDocumento = instrumentar("restaurarDocumento");
export const concederColecao = instrumentar("concederColecao");
export const revogarColecao = instrumentar("revogarColecao");

// ia/habilidades.ts
export const criarHabilidade = instrumentar("criarHabilidade");
export const copiarHabilidadeDaPlataforma = instrumentar("copiarHabilidadeDaPlataforma");
export const editarHabilidade = instrumentar("editarHabilidade");
export const criarRascunhoDaHabilidade = instrumentar("criarRascunhoDaHabilidade");
export const editarRascunhoDaHabilidade = instrumentar("editarRascunhoDaHabilidade");
export const descartarRascunhoDaHabilidade = instrumentar("descartarRascunhoDaHabilidade");
export const publicarVersaoDaHabilidade = instrumentar("publicarVersaoDaHabilidade");
export const obsoletarVersaoDaHabilidade = instrumentar("obsoletarVersaoDaHabilidade");
export const arquivarHabilidade = instrumentar("arquivarHabilidade");
export const restaurarHabilidade = instrumentar("restaurarHabilidade");
export const concederHabilidade = instrumentar("concederHabilidade");
export const fixarVersaoDaConcessao = instrumentar("fixarVersaoDaConcessao");
export const revogarHabilidade = instrumentar("revogarHabilidade");

// ia/integracoes.ts
export const conectarIntegracao = instrumentar("conectarIntegracao");
export const desconectarIntegracao = instrumentar("desconectarIntegracao");
