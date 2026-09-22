/**
 * As coleções de `DataState`, declaradas pelo próprio domínio.
 *
 * Quem persiste o estado precisa saber quais chaves existem — uma coleção
 * vazia não deixa rastro no banco, e hidratar sem esta lista devolveria
 * `undefined` no lugar de `[]`, que é a diferença entre uma tela vazia e um
 * erro em tempo de execução.
 *
 * O tipo `Record<ChaveDeColecao, true>` é o que mantém a lista honesta:
 * acrescentar uma coleção a `DataState` sem acrescentá-la aqui não compila.
 */

import type { DataState } from "./state";

export type ChaveDeColecao = {
  [K in keyof DataState]-?: DataState[K] extends readonly unknown[] ? K : never;
}[keyof DataState];

/** As entidades únicas do Espaço de Trabalho: uma por Espaço, não uma coleção. */
export const SINGULARES = ["workspace", "inbox"] as const;
export type ChaveSingular = (typeof SINGULARES)[number];

const TODAS: Record<ChaveDeColecao, true> = {
  models: true,
  tools: true,
  members: true,
  teams: true,
  roles: true,
  integrations: true,
  grants: true,
  templates: true,
  catalog: true,
  tags: true,
  files: true,
  fieldDefinitions: true,
  taskTypes: true,
  views: true,
  goals: true,
  forms: true,
  spaces: true,
  folders: true,
  lists: true,
  tasks: true,
  contacts: true,
  companies: true,
  deals: true,
  funnels: true,
  contactCompanyLinks: true,
  companyCompanyLinks: true,
  distinctFromLinks: true,
  channels: true,
  queues: true,
  conversations: true,
  chatFolders: true,
  chatSessions: true,
  agents: true,
  agentExecutions: true,
  skills: true,
  skillGrants: true,
  automations: true,
  automationExecutions: true,
  approvals: true,
  collections: true,
  collectionGrants: true,
  documents: true,
  panels: true,
  links: true,
  activity: true,
  // Ativos de Canal (docs 23–25), vindos do `main` na reconciliação.
  grupos: true,
  comunidades: true,
  linksDeCaptacao: true,
  flows: true,
};

export const COLECOES = Object.keys(TODAS) as ChaveDeColecao[];
