/**
 * Every action generates an Activity Record with actor and, when there is one,
 * delegate actor (A6.2). Nothing in this store mutates without passing here.
 */

import type { DataState } from "../state";
import type { ActivityRecord, ActorRef, Id } from "../types";

let sequence = 0;

/** Deterministic ids keep the seed reproducible across reloads. */
export function nextId(prefix: string): Id {
  sequence += 1;
  return `${prefix}_${sequence.toString(36).padStart(6, "0")}`;
}

/** Restarts the counter — used by the tests so ids do not leak between cases. */
export function resetIdSequence(at = 0): void {
  sequence = at;
}

export interface RecordActivityInput {
  readonly actor: ActorRef;
  readonly delegate?: ActorRef;
  readonly action: string;
  readonly objectType: string;
  readonly objectId: Id;
  readonly objectName: string;
  readonly result?: ActivityRecord["result"];
  readonly before?: string;
  readonly after?: string;
  readonly detail?: string;
  readonly at?: string;
}

export function recordActivity(state: DataState, input: RecordActivityInput): ActivityRecord {
  const record: ActivityRecord = {
    id: nextId("act"),
    workspaceId: state.workspace.id,
    actor: input.actor,
    ...(input.delegate ? { delegate: input.delegate } : {}),
    action: input.action,
    objectType: input.objectType,
    objectId: input.objectId,
    objectName: input.objectName,
    at: input.at ?? new Date().toISOString(),
    result: input.result ?? "ok",
    ...(input.before !== undefined ? { before: input.before } : {}),
    ...(input.after !== undefined ? { after: input.after } : {}),
    ...(input.detail !== undefined ? { detail: input.detail } : {}),
  };
  state.activity.unshift(record);
  return record;
}

/** The acting Member as an ActorRef. */
export const memberActor = (memberId: Id): ActorRef => ({ kind: "member", id: memberId });

export const systemActor: ActorRef = { kind: "system", id: "sistema" };
