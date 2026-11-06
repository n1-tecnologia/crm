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
