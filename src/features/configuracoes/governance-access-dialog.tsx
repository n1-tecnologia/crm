"use client";

/**
 * D06 — Ato de governança sobre Recurso privado, aberto por
 * `?acesso-governanca=<recurso>`.
 *
 * Por que ele vive na Auditoria: B38a esconde o contêiner privado inclusive do
 * Proprietário do Espaço de Trabalho, então não existe — e não pode existir —
 * uma listagem navegável de recursos privados. O que existe é o rastro: os
 * Registros de Atividade do recurso aparecem para quem tem o Papel, com nome do
 * objeto e ator, nunca com conteúdo. É de lá que se chega aqui.
 *
 * B38b — é a única via de entrada sem concessão prévia, e o preço é o motivo
 * obrigatório: o ato gera Registro visível a quem tem acesso ao Recurso,
 * inclusive a quem foi alcançado por ele.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useData, useRun } from "@/data/store";
import { grantGovernanceAccess } from "@/data/operations";
import { ConfirmDialog, Field, MultiSelect, Painel, Select, TextArea } from "@/features/shell/ui";
import type { DataState } from "@/data/state";
import type { PermissionAction } from "@/data/types";

export const GOVERNANCE_ACCESS_PARAM = "acesso-governanca";

const ACTIONS: ReadonlyArray<{ readonly value: PermissionAction; readonly label: string }> = [
  { value: "ver", label: "ver" },
  { value: "comentar", label: "comentar" },
  { value: "criar", label: "criar" },
  { value: "editar", label: "editar" },
  { value: "excluir", label: "excluir" },
  { value: "administrar", label: "administrar" },
];

export function useGovernanceAccessDialog(): {
  readonly governedResourceId: string | null;
  readonly openGovernance: (resourceId: string) => void;
  readonly closeGovernance: () => void;
} {
  const router = useRouter();
  const query = useSearchParams();
  const pathname = typeof window === "undefined" ? "" : window.location.pathname;

  return {
    governedResourceId: query.get(GOVERNANCE_ACCESS_PARAM),
    openGovernance: (resourceId) => {
      const next = new URLSearchParams(query.toString());
      next.set(GOVERNANCE_ACCESS_PARAM, resourceId);
      router.replace(`${pathname}?${next}`, { scroll: false });
    },
    closeGovernance: () => {
      const next = new URLSearchParams(query.toString());
      next.delete(GOVERNANCE_ACCESS_PARAM);
      router.replace(next.size > 0 ? `${pathname}?${next}` : pathname, { scroll: false });
    },
  };
}

export function GovernanceAccessDialog({
  resourceId,
  onClose,
  onDone,
}: {
  readonly resourceId: string | null;
  readonly onClose: () => void;
  readonly onDone: (message: string) => void;
}) {
  const state = useData((data) => data);
  const run = useRun();
  const [subjectId, setSubjectId] = useState("");
  const [actions, setActions] = useState<readonly string[]>(["ver"]);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (resourceId === null) return null;

  const resource = resolveResource(state, resourceId);

  const subjects = [
    ...state.members
      .filter((member) => member.state === "ativo")
      .map((member) => ({ value: `member:${member.id}`, label: member.displayName, detail: "Membro" })),
    ...state.teams.map((team) => ({ value: `team:${team.id}`, label: team.name, detail: "Equipe" })),
  ];

  const blockedReason =
    resource === null
      ? "Este identificador não corresponde a nenhum Recurso."
      : subjectId === ""
        ? "Escolha quem recebe o acesso."
        : actions.length === 0
          ? "Escolha ao menos uma Ação."
          : reason.trim() === ""
            ? "O motivo é obrigatório: um ato de governança nunca é silencioso."
            : undefined;

  const reset = () => {
    setSubjectId("");
    setActions(["ver"]);
    setReason("");
    setError(null);
  };

  const confirm = () => {
    if (!resource) return;
    const [kind, id] = subjectId.split(":");
    if (kind !== "member" && kind !== "team") return;
    if (!id) return;
    const result = run((data, actingId) =>
      grantGovernanceAccess(data, actingId, {
        subjectKind: kind,
        subjectId: id,
        resourceType: resource.type,
        resourceId: resource.id,
        actions: actions as readonly PermissionAction[],
        reason,
      }),
    );
    if (result.ok) {
      onDone(
        `Acesso concedido a ${resource.name}: ${result.value} Concessão(ões). O ato ficou registrado com o motivo.`,
      );
      reset();
      onClose();
    } else {
      setError(result.error);
    }
  };

  return (
    <ConfirmDialog
      open
      title="Ato de governança"
      description="Única via de entrada num Recurso privado sem concessão prévia. Nunca é silencioso: o ato gera Registro de Atividade com o motivo, visível a quem tem acesso ao Recurso."
      confirmLabel="Conceder acesso"
      destructive
      {...(blockedReason ? { confirmDisabledReason: blockedReason } : {})}
      onConfirm={confirm}
      onCancel={() => {
        reset();
        onClose();
      }}
    >
      <div className="grid gap-3">
        <Painel className="px-3 py-2">
          <p className="app-coluna">Recurso</p>
          <p className="app-base mt-0.5" style={{ color: "var(--texto)" }}>
            {resource ? `${resource.label}: ${resource.name}` : "Recurso não encontrado."}
          </p>
          <p className="identificador mt-0.5" style={{ color: "var(--texto-3)" }}>{resourceId}</p>
        </Painel>

        <Field label="Quem recebe o acesso" hint="Membro ativo ou Equipe — inclusive você.">
          {(id) => (
            <Select
              id={id}
              value={subjectId}
              onChange={setSubjectId}
              searchable
              placeholder="Escolher Sujeito"
              options={subjects}
            />
          )}
        </Field>

        <Field label="Ações a conceder">
          {(id) => (
            <MultiSelect
              id={id}
              values={actions}
              onChange={setActions}
              options={ACTIONS.map((action) => ({ value: action.value, label: action.label }))}
              placeholder="Nenhuma"
            />
          )}
        </Field>

        <Field
          label="Motivo"
          hint="Fica no Registro de Atividade e é lido por quem tem acesso ao Recurso."
          {...(reason !== "" && reason.trim() === "" ? { error: "Escreva um motivo real." } : {})}
        >
          {(id) => (
            <TextArea
              id={id}
              value={reason}
              onChange={setReason}
              rows={2}
              placeholder="Ex.: o único administrador deste Espaço saiu da organização"
            />
          )}
        </Field>

        {error ? (
          <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
            {error}
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}

interface ResolvedResource {
  readonly type: string;
  readonly id: string;
  readonly name: string;
  readonly label: string;
}

/** The Resource types B38b reaches — Chat Sessions are deliberately absent. */
function resolveResource(state: DataState, resourceId: string): ResolvedResource | null {
  const space = state.spaces.find((s) => s.id === resourceId);
  if (space) return { type: "space", id: space.id, name: space.name, label: "Espaço" };
  const folder = state.folders.find((f) => f.id === resourceId);
  if (folder) return { type: "folder", id: folder.id, name: folder.name, label: "Pasta" };
  const list = state.lists.find((l) => l.id === resourceId);
  if (list) return { type: "list", id: list.id, name: list.name, label: "Lista" };
  const funnel = state.funnels.find((f) => f.id === resourceId);
  if (funnel) return { type: "funnel", id: funnel.id, name: funnel.name, label: "Funil" };
  const collection = state.collections.find((c) => c.id === resourceId);
  if (collection) return { type: "collection", id: collection.id, name: collection.name, label: "Coleção" };
  return null;
}
