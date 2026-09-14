/**
 * Panels: analytical reading that stores no data.
 * Ontology: documento 21, B20, B100–B109.
 */

import type { Id, RecordBase } from "./primitives";

/** B101 — closed catalogue of target entities. */
export type DataSourceTarget =
  | "task"
  | "deal"
  | "contact"
  | "company"
  | "conversation"
  | "message"
  | "agentExecution"
  | "automationExecution"
  | "approvalRequest"
  | "activityRecord"
  | "knowledgeDocument";

/** Documento 21, 7.9 — the platform enumeration of chart forms. */
export type DataViewType =
  | "numero"
  | "barras"
  | "linhas"
  | "pizza"
  | "funil"
  | "tabela"
  | "listaDeRegistros"
  | "calendario"
  | "texto";

/**
 * B101 — configuration value object: WHICH entity in WHICH scope. Never a copy
 * and never a stored set; resolved per query against the viewer's permissions.
 */
export interface DataSource {
  readonly target: DataSourceTarget;
  readonly scopeType:
    | "workspace"
    | "space"
    | "folder"
    | "list"
    | "funnel"
    | "queue"
    | "channel"
    | "inbox"
    | "agent"
    | "automation"
    | "collection"
    | "companyGroup";
  readonly scopeIds: readonly Id[];
  /** B106 — defaults: false, except `includeArchived` for Deal. */
  readonly includeSubtasks: boolean;
  readonly includeArchived: boolean;
  readonly includeRehearsals: boolean;
}

export type Aggregation =
  | "contagem"
  | "soma"
  | "media"
  | "minimo"
  | "maximo"
  | "taxa"
  | "duracao"
  | "percentual";

/** RN-PAI-08 — aggregates only native or derived attributes of the target entity. */
export interface Metric {
  readonly aggregation: Aggregation;
  readonly attribute: string;
  readonly label: string;
  readonly qualifier?: string;
}

/** Documento 21, 7.4 — 0..2 per widget; every value appears. */
export interface Dimension {
  readonly attribute: string;
  readonly label: string;
  readonly timeGranularity?: "dia" | "semana" | "mes" | "trimestre" | "ano";
}

/** Documento 21, 7.5 — the fixed filter is stored; the interactive one is not. */
export interface FixedFilter {
  readonly attribute: string;
  readonly operator: string;
  readonly value: string;
  readonly label: string;
}

/** Documento 21, 7.6 — always over a temporal reference attribute of the target. */
export interface Period {
  readonly kind: "absoluto" | "relativo";
  readonly referenceAttribute: string;
  readonly start?: string;
  readonly end?: string;
  readonly relative?: "ultimos7Dias" | "ultimos30Dias" | "esteMes" | "mesAnterior" | "esteTrimestre" | "esteAno";
}

/** INV-PAI-03 — component with a local identifier, no external identity. */
export interface Widget {
  readonly id: Id;
  title: string;
  viewType: DataViewType;
  /** Exactly one, except on `texto`. */
  dataSource?: DataSource;
  metrics: Metric[];
  dimensions: Dimension[];
  fixedFilters: FixedFilter[];
  period?: Period;
  displayedAttributes?: readonly string[];
  sort?: { readonly by: string; readonly direction: "asc" | "desc" };
  limit?: number;
  /** Only on `texto`: authored text, not data of another entity. */
  content?: string;
}

/** Documento 21, 7.7 — position and size per widget; single per panel. */
export interface LayoutCell {
  readonly widgetId: Id;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** B102 — context reference; survives the elimination of the anchor as a value. */
export interface PanelAnchor {
  readonly type: "space" | "folder" | "list" | "funnel" | "queue";
  readonly id: Id;
  readonly nameAtTheTime: string;
}

/** B100 — stores only configuration; every value is computed per query. */
export interface Panel extends RecordBase {
  name: string;
  description: string;
  /** A7 — always a human Member (B7); an Agent gets at most `ver` (B107). */
  ownerMemberId: Id;
  anchor?: PanelAnchor;
  widgets: Widget[];
  layout: LayoutCell[];
}

/** RN-PAI-20 — derived per query, with the cause; never removed by the system. */
export type WidgetValidity =
  | { readonly valid: true }
  | { readonly valid: false; readonly cause: string };

/** 11.2 — derived per viewer; "fonte sem acesso" never reveals the name. */
export type SourceAvailability = "disponivel" | "arquivada" | "indisponivel" | "eliminada";

/** B100 — declared on every query; never stored. */
export interface DataReferenceMoment {
  readonly at: string;
}
