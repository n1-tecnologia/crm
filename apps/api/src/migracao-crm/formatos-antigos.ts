/**
 * Os formatos do CRM antigo que o script lê, SÓ os campos que ele usa.
 *
 * Interfaces estruturais locais, de propósito: `@n1/dominio` vai apagar `Contact`, `Deal`, `Funnel`
 * e o resto na 3.5.4, e o script (com o `--verificar`) tem de continuar compilando depois disso.
 * Nada aqui importa do domínio. Tudo é leitura: o que o script grava são linhas de `registros`
 * copiadas como estão (`dados jsonb`), não objetos reconstruídos.
 */

/** A linha de `plataforma.registros` / `registros_crm_antigo` / da fixture. */
export interface RegistroAntigo {
  readonly colecao: string;
  readonly id: string;
  readonly dados: unknown;
  readonly ordem: number;
}

/** Etapa de um Funil antigo (`Stage`). O id só é único dentro do Funil. */
export interface EtapaAntiga {
  readonly id: string;
  readonly name: string;
  readonly order: number;
  readonly defaultProbability?: number;
  readonly color?: string;
  readonly description?: string;
}

/** Funil antigo (`Funnel`). O ciclo de vida é `ativo`, `arquivado` ou `naLixeira`. */
export interface FunilAntigo {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly color?: string;
  readonly order?: number;
  readonly isPrivate?: boolean;
  readonly lifecycle?: string;
  readonly createdAt?: string;
  readonly createdBy?: { readonly id?: string };
  readonly closingRules?: { readonly requireLossReason?: boolean; readonly requireValueOnWin?: boolean };
  readonly stages?: readonly EtapaAntiga[];
}

/** Pasta (`Folder`), só o que a Pasta "Meus negócios" precisa para ser achada. */
export interface PastaAntiga {
  readonly id: string;
  readonly name: string;
}

/** Lista (`List`): o pai diz se mora numa Pasta. O Conjunto de Status vive DENTRO da Lista. */
export interface ListaAntiga {
  readonly id: string;
  readonly name: string;
  readonly parentType?: string;
  readonly parentId?: string;
}

/** Visualização (`View`) de uma Lista. */
export interface VisualizacaoAntiga {
  readonly id: string;
  readonly listId: string;
}

/** Tarefa (`Task`): só a Lista a que pertence, qualquer que seja o estado dela. */
export interface TarefaAntiga {
  readonly id: string;
  readonly listId: string;
}

/**
 * O pedaço do `DataState` que a Pasta "Meus negócios" usa. Estrutural: `DataState` o satisfaz sem
 * que este arquivo importe o domínio. As quatro coleções NÃO são do CRM antigo (Pasta, Listas,
 * Visualizações e Tarefas ficam no modelo novo), então a `operacao` pode mexer nelas.
 */
export interface EstadoComPasta {
  readonly folders: PastaAntiga[];
  readonly lists: ListaAntiga[];
  readonly views: VisualizacaoAntiga[];
  readonly tasks: readonly TarefaAntiga[];
}

// --- O mapeador de entidades (15-28) ---
//
// Só os campos que o mapeador LÊ de cada linha do CRM antigo. Tudo é opcional ou `unknown` onde o JSON
// de `registros` pode trazer coisa fora do tipo: o mapeador desconfia do dado e manda para o relatório
// o que o banco recusaria, em vez de derrubar a transação do Espaço.

/** Quem fez: `{ kind, id }` (`ActorRef`). */
export interface AtorAntigo {
  readonly kind?: string;
  readonly id?: string;
}

/** Identificador de Contato (`ContactIdentifier`). */
export interface IdentificadorAntigo {
  readonly id: string;
  readonly type?: string;
  readonly value?: string;
  readonly displayValue?: string;
  readonly channelLabel?: string;
  readonly verified?: boolean;
  readonly principal?: boolean;
  readonly createdAt?: string;
}

/** Consentimento (`ConsentRecord`): histórico só de inserção. */
export interface ConsentimentoAntigo {
  readonly purposeId?: string;
  readonly channelType?: string;
  readonly decision?: string;
  readonly at?: string;
  readonly origin?: string;
  readonly evidenceMessageId?: string;
  readonly recordedBy?: AtorAntigo;
  readonly recordedAt?: string;
}

/** Comentário (`Comment`) do Contato: vira Nota. */
export interface ComentarioAntigo {
  readonly id?: string;
  readonly author?: AtorAntigo;
  readonly content?: string;
  readonly createdAt?: string;
  readonly deletedAt?: string;
}

/** Endereço (`Address`). */
export interface EnderecoAntigo {
  readonly kind?: string;
  readonly street?: string;
  readonly number?: string;
  readonly complement?: string;
  readonly district?: string;
  readonly city?: string;
  readonly region?: string;
  readonly country?: string;
  readonly postalCode?: string;
  readonly principal?: boolean;
}

/** Valor de campo personalizado (`FieldValue`). */
export interface ValorDeCampoAntigo {
  readonly definitionId?: string;
  readonly value?: unknown;
  readonly state?: string;
}

/** Contato (`Contact`). `lifecycle` é `ativo`, `arquivado`, `naLixeira` ou `mesclado`. */
export interface ContatoAntigo {
  readonly id: string;
  readonly createdBy?: AtorAntigo;
  readonly createdAt?: string;
  readonly lifecycle?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly mergedIntoId?: string;
  readonly mergedAt?: string;
  readonly ownerMemberId?: string;
  readonly creationMode?: string;
  readonly originId?: string;
  readonly qualificationId?: string;
  readonly temperatureId?: string;
  readonly birthDate?: string;
  readonly language?: string;
  readonly timezone?: string;
  readonly photoFileId?: string;
  readonly description?: string;
  readonly identifiers?: readonly IdentificadorAntigo[];
  readonly consents?: readonly ConsentimentoAntigo[];
  readonly addresses?: readonly EnderecoAntigo[];
  readonly tagIds?: readonly string[];
  readonly fieldValues?: readonly ValorDeCampoAntigo[];
  readonly comments?: readonly ComentarioAntigo[];
  readonly preMergeState?: unknown;
  readonly provenance?: unknown;
}

/** Identificador de Empresa (`CompanyIdentifier`): `dominio`, `documentoFiscal` ou `telefone`. */
export interface IdentificadorDeEmpresaAntigo {
  readonly id: string;
  readonly type?: string;
  readonly value?: string;
  readonly country?: string;
  readonly verified?: boolean;
  readonly principal?: boolean;
  readonly createdAt?: string;
}

/** Empresa (`Company`). */
export interface EmpresaAntiga {
  readonly id: string;
  readonly createdBy?: AtorAntigo;
  readonly createdAt?: string;
  readonly lifecycle?: string;
  readonly tradeName?: string;
  readonly legalName?: string;
  readonly ownerMemberId?: string;
  readonly description?: string;
  readonly parentCompanyId?: string;
  readonly originId?: string;
  readonly identifiers?: readonly IdentificadorDeEmpresaAntigo[];
  readonly addresses?: readonly EnderecoAntigo[];
  readonly tagIds?: readonly string[];
  readonly fieldValues?: readonly ValorDeCampoAntigo[];
  readonly attachments?: readonly unknown[];
  readonly comments?: readonly ComentarioAntigo[];
  readonly mergedIntoId?: string;
  readonly preMergeState?: unknown;
}

/** Vínculo Contato-Empresa (`ContactCompanyLink`). `end` preenchido = vínculo encerrado. */
export interface VinculoContatoEmpresaAntigo {
  readonly id: string;
  readonly contactId?: string;
  readonly companyId?: string;
  readonly role?: string;
  readonly principalForContact?: boolean;
  readonly principalForCompany?: boolean;
  readonly start?: string;
  readonly end?: string;
  readonly createdBy?: AtorAntigo;
  readonly createdAt?: string;
}

/** Contato de um Negócio (`DealContactLink`). */
export interface ContatoDoNegocioAntigo {
  readonly id?: string;
  readonly contactId?: string;
  readonly principal?: boolean;
}

/** Negócio (`Deal`). `lifecycle` é `ativo`, `arquivado` ou `naLixeira`; `situation` é `aberto`, `ganho` ou `perdido`. */
export interface NegocioAntigo {
  readonly id: string;
  readonly createdBy?: AtorAntigo;
  readonly createdAt?: string;
  readonly lifecycle?: string;
  readonly readableId?: string;
  readonly title?: string;
  readonly object?: string;
  readonly description?: string;
  readonly companyId?: string;
  readonly ownerMemberId?: string;
  readonly funnelId?: string;
  readonly stageId?: string;
  readonly value?: { readonly amount?: number; readonly currency?: string };
  readonly overriddenProbability?: number;
  readonly situation?: string;
  readonly lossReasonId?: string;
  readonly winReasonId?: string;
  readonly closingNote?: string;
  readonly originId?: string;
  readonly expectedCloseDate?: string;
  readonly closedAt?: string;
  readonly contactLinks?: readonly ContatoDoNegocioAntigo[];
  readonly tagIds?: readonly string[];
  readonly fieldValues?: readonly ValorDeCampoAntigo[];
  readonly attachments?: readonly unknown[];
  readonly comments?: readonly unknown[];
  readonly stageHistory?: readonly unknown[];
}

/** Canal (`Channel`). `connection` não é lido: todo Canal migrado entra desconectado. */
export interface CanalAntigo {
  readonly id: string;
  readonly createdBy?: AtorAntigo;
  readonly createdAt?: string;
  readonly lifecycle?: string;
  readonly archivedAt?: string;
  readonly name?: string;
  readonly channelType?: string;
  readonly provider?: string;
  readonly externalId?: string;
  readonly configuredByMemberId?: string;
  readonly defaultQueueId?: string;
  readonly defaultContactOwnerMemberId?: string;
  readonly defaultOriginId?: string;
  readonly messageTemplates?: readonly unknown[];
  readonly groupsEnabled?: boolean;
}

/** Participante da Conversa (`Participant`). */
export interface ParticipanteAntigo {
  readonly id?: string;
  readonly subject?: AtorAntigo;
  readonly role?: string;
  readonly principal?: boolean;
  readonly enteredAt?: string;
  readonly leftAt?: string;
}

/** Mensagem (`Message`), aninhada na Conversa. */
export interface MensagemAntiga {
  readonly id: string;
  readonly direction?: string;
  readonly actor?: AtorAntigo;
  readonly delegate?: AtorAntigo;
  readonly senderParticipantId?: string;
  readonly viaIdentifierId?: string;
  readonly content?: string;
  readonly attachments?: ReadonlyArray<{ readonly fileId?: string; readonly mediaType?: string; readonly displayName?: string }>;
  readonly subject?: string;
  readonly additionalAddresses?: ReadonlyArray<{ readonly kind?: string; readonly address?: string; readonly displayName?: string }>;
  readonly inReplyToMessageId?: string;
  readonly usedTemplateProviderId?: string;
  readonly externalId?: string;
  readonly deliveryStatus?: string;
  readonly deliveryFailureReason?: string;
  readonly internalReads?: readonly unknown[];
  readonly reactions?: readonly unknown[];
  readonly deletionMark?: unknown;
  readonly externalEdits?: readonly unknown[];
  readonly createdAt?: string;
  readonly anonymized?: boolean;
  readonly flow?: unknown;
  readonly respostaDeFlow?: unknown;
}

/** Conversa (`Conversation`); a de Grupo (`groupIdentifier`) não passa pelo mapeador. */
export interface ConversaAntiga {
  readonly id: string;
  readonly createdBy?: AtorAntigo;
  readonly createdAt?: string;
  readonly lifecycle?: string;
  readonly channelId?: string;
  readonly contactId?: string;
  readonly state?: string;
  readonly queueId?: string;
  readonly assignee?: AtorAntigo;
  readonly title?: string;
  readonly titleEdited?: boolean;
  readonly snooze?: { readonly until?: string; readonly reason?: string };
  readonly drafts?: readonly unknown[];
  readonly starredBy?: readonly string[];
  readonly tagIds?: readonly string[];
  readonly fieldValues?: readonly ValorDeCampoAntigo[];
  readonly participants?: readonly ParticipanteAntigo[];
  readonly messages?: readonly MensagemAntiga[];
  readonly trashedAt?: string;
  readonly resolvedAt?: string;
  readonly reopenedAt?: string;
  readonly reopenCount?: number;
}

/** Vínculo Empresa-Empresa e "distinto de": só o id e as pontas, para o relatório. */
export interface VinculoSoComIdAntigo {
  readonly id: string;
}
