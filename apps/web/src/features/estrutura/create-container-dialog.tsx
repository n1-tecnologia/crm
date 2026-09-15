"use client";

/**
 * Criação de contêiner, aberta por `?criar=<tipo>:<paiTipo>:<paiId>` — o "+" da
 * árvore chega com o pai preenchido, e o campo de localização permite mudá-lo
 * sem fechar e recomeçar.
 *
 * O que cada contêiner aceita dentro dele é regra da ontologia (A3), não do
 * formulário: a operação recusa uma Pasta dentro de Subpasta mesmo que alguém
 * chegue aqui pelo endereço. O formulário só evita oferecer o que seria
 * recusado.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import { useData, useRun } from "@/dados/store";
import { createFolder, createList, createSpace, instantiateListTemplate } from "@n1/dominio/operations";
import { Circle } from "lucide-react";
import {
  ConfirmDialog,
  Field,
  Icone,
  ReguaDeSecao,
  Select,
  SettingRow,
  TextArea,
  TextInput,
  Toggle,
} from "@/features/shell/ui";
import type { DataState, OperationResult } from "@n1/dominio/state";
import type { Folder, List, Space } from "@n1/dominio/types";

export const CREATE_CONTAINER_PARAM = "criar";

export type ContainerKind = "espaco" | "pasta" | "lista";
type ParentType = "space" | "folder";

interface CreateTarget {
  readonly kind: ContainerKind;
  readonly parentType?: ParentType;
  readonly parentId?: string;
}

export function useCreateContainerDialog(): {
  readonly creating: CreateTarget | null;
  readonly openCreate: (kind: ContainerKind, parentType?: ParentType, parentId?: string) => void;
  readonly closeCreate: () => void;
} {
  const router = useRouter();
  const query = useSearchParams();
  const pathname = typeof window === "undefined" ? "" : window.location.pathname;

  const raw = query.get(CREATE_CONTAINER_PARAM);
  const creating = ((): CreateTarget | null => {
    if (!raw) return null;
    const [kind, parentType, parentId] = raw.split(":");
    if (kind !== "espaco" && kind !== "pasta" && kind !== "lista") return null;
    if (kind === "espaco") return { kind };
    if ((parentType !== "space" && parentType !== "folder") || !parentId) return null;
    return { kind, parentType, parentId };
  })();

  return {
    creating,
    openCreate: (kind, parentType, parentId) => {
      const next = new URLSearchParams(query.toString());
      next.set(
        CREATE_CONTAINER_PARAM,
        kind === "espaco" ? "espaco" : `${kind}:${parentType}:${parentId}`,
      );
      router.replace(`${pathname}?${next}`, { scroll: false });
    },
    closeCreate: () => {
      const next = new URLSearchParams(query.toString());
      next.delete(CREATE_CONTAINER_PARAM);
      router.replace(next.size > 0 ? `${pathname}?${next}` : pathname, { scroll: false });
    },
  };
}

const KIND_LABEL: Record<ContainerKind, string> = {
  espaco: "Espaço",
  pasta: "Pasta",
  lista: "Lista",
};

const KIND_HINT: Record<ContainerKind, string> = {
  espaco: "O ponto mais alto da Estrutura. Define o Conjunto de Status que tudo abaixo dele herda.",
  pasta: "Agrupa Listas e Subpastas. Herda a configuração do Espaço, e pode sobrescrevê-la depois.",
  lista: "Onde as Tarefas moram. Herda a configuração do contêiner acima dela.",
};

/** Cores para marcar um Espaço na árvore, tiradas da paleta do produto. */
const SPACE_COLORS = [
  { value: "#9601c5", label: "Roxo" },
  { value: "#0369a1", label: "Azul" },
  { value: "#0f766e", label: "Verde" },
  { value: "#b45309", label: "Âmbar" },
  { value: "#be123c", label: "Carmim" },
  { value: "#57534e", label: "Grafite" },
];

export function CreateContainerDialog({
  target,
  onClose,
  onDone,
}: {
  readonly target: CreateTarget | null;
  readonly onClose: () => void;
  readonly onDone: (message: string, href: string) => void;
}) {
  const state = useData((data) => data);
  const run = useRun();
  const privacyLabelId = useId();
  const privacyHintId = useId();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#9601c5");
  const [isPrivate, setIsPrivate] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [location, setLocation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!target) return null;

  const kind = target.kind;
  // A localização começa onde o "+" foi clicado e pode ser trocada aqui.
  const current = location ?? (target.parentId ? `${target.parentType}:${target.parentId}` : "");
  const [parentType, parentId] = current.split(":") as [ParentType, string];

  const parent =
    parentType === "space"
      ? state.spaces.find((s) => s.id === parentId)
      : parentType === "folder"
        ? state.folders.find((f) => f.id === parentId)
        : undefined;

  // Uma Pasta dentro de uma Pasta é Subpasta, e o nome muda com ela (B3).
  const label = kind === "pasta" && parentType === "folder" ? "Subpasta" : KIND_LABEL[kind];

  const locations = locationOptions(state, kind);
  const templates = state.templates.filter(
    (template) => template.kind === kind && template.lifecycle === "ativo",
  );

  const blockedReason =
    name.trim() === ""
      ? `Dê um nome à ${label}.`
      : kind !== "espaco" && !parent
        ? "Escolha onde ela vai ficar."
        : undefined;

  const reset = () => {
    setName("");
    setDescription("");
    setIsPrivate(false);
    setTemplateId("");
    setLocation(null);
    setError(null);
  };

  const confirm = () => {
    const result = run<Space | Folder | List>(
      (data, memberId): OperationResult<Space | Folder | List> => {
        if (kind === "espaco") {
          return createSpace(data, memberId, {
            name,
            ...(description.trim() ? { description } : {}),
            color,
            isPrivate,
            ...(templateId ? { templateId } : {}),
          });
        }
        if (!parent) return { ok: false, error: "Escolha onde ela vai ficar." };
        const input = {
          name,
          parentType,
          parentId,
          ...(description.trim() ? { description } : {}),
          isPrivate,
          ...(templateId ? { templateId } : {}),
        };
        if (kind === "pasta") return createFolder(data, memberId, input);
        // Um Template de Lista com configuração (Status, Campos, Tipos) instancia a estrutura junto.
        return templateId && data.templates.find((t) => t.id === templateId)?.creates?.listConfig
          ? instantiateListTemplate(data, memberId, templateId, input)
          : createList(data, memberId, input);
      },
    );

    if (result.ok) {
      const created = result.value;
      const href =
        kind === "espaco"
          ? `/estrutura/espacos/${created.id}`
          : kind === "pasta"
            ? `/estrutura/pastas/${created.id}`
            : `/estrutura/listas/${created.id}`;
      reset();
      // §20 — depois de criar, o usuário vai para o que criou. Quem fecha o
      // diálogo é a navegação: chamar `onClose` aqui desfaria o `push`.
      onDone(`${label} criada: ${created.name}.`, href);
    } else {
      setError(result.error);
    }
  };

  return (
    <ConfirmDialog
      open
      title={`Criar ${label}`}
      description={KIND_HINT[kind]}
      confirmLabel="Criar"
      wide
      footerStart={
        templates.length > 0 ? (
          <span className="flex min-w-0 items-center gap-2">
            <span className="app-sm shrink-0" style={{ color: "var(--texto-3)" }}>
              Template
            </span>
            <Select
              value={templateId}
              onChange={setTemplateId}
              placeholder="Começar em branco"
              options={templates.map((template) => ({
                value: template.id,
                label: template.name,
                detail: template.body,
              }))}
            />
          </span>
        ) : null
      }
      {...(blockedReason ? { confirmDisabledReason: blockedReason } : {})}
      onConfirm={confirm}
      onCancel={() => {
        reset();
        onClose();
      }}
    >
      <div className="grid gap-4">
        <Field label="Nome" required>
          {(id) => (
            <div className="flex items-center gap-2">
              <TextInput
                id={id}
                value={name}
                onChange={setName}
                placeholder={
                  kind === "espaco"
                    ? "Por exemplo: Comercial, Operações"
                    : kind === "pasta"
                      ? "Por exemplo: Clientes, Campanhas"
                      : "Por exemplo: Propostas em curso"
                }
              />
              {kind === "espaco" ? (
                <span className="flex shrink-0 items-center gap-1">
                  {SPACE_COLORS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-label={option.label}
                      aria-pressed={color === option.value}
                      onClick={() => setColor(option.value)}
                      className={`size-5 rounded-[var(--r-pilula)] ${
                        color === option.value
                          ? "ring-2 ring-[var(--acento)] ring-offset-2 ring-offset-[var(--card)]"
                          : ""
                      }`}
                      style={{ backgroundColor: option.value }}
                    />
                  ))}
                </span>
              ) : null}
            </div>
          )}
        </Field>

        <Field label="Descrição" hint="Opcional.">
          {(id) => (
            <TextArea
              id={id}
              value={description}
              onChange={setDescription}
              rows={2}
              placeholder={`Conte para que serve esta ${label}.`}
            />
          )}
        </Field>

        {kind === "espaco" ? null : (
          <Field
            label="Localização"
            {...(kind === "pasta"
              ? {
                  hint: "Dentro de uma Pasta, a nova nasce Subpasta — e uma Subpasta não contém outra (A3.4).",
                }
              : {})}
          >
            {(id) => (
              <Select
                id={id}
                value={current}
                onChange={setLocation}
                searchable
                placeholder="Escolher"
                options={locations}
              />
            )}
          </Field>
        )}

        <div className="grid gap-2">
          <ReguaDeSecao rotulo="Configurações" />
          {/*
            O contêiner nasce no padrão e o ajuste vem depois, nas
            configurações dele: decidir herança na criação obriga a escolher
            antes de existir o que comparar. A linha diz de onde o padrão vem,
            para a decisão posterior ser informada.
          */}
          <SettingRow
            icon={<Icone de={Circle} />}
            title="Status"
            value={statusOrigin(state, kind, parentType, parentId)}
          />
          <p className="app-sm" style={{ color: "var(--texto-3)" }}>
            {kind === "espaco"
              ? "Um Espaço sempre define o próprio Conjunto, porque é dele que todo o resto herda (RN-ESP-03). Ele se ajusta depois, nas configurações do Espaço."
              : `A herança é por aspecto (B25) e se ajusta depois, nas configurações da ${label}.`}
          </p>
        </div>

        <div className="painel flex items-start justify-between gap-4 px-3 py-2.5">
          <span>
            <span id={privacyLabelId} className="app-base block" style={{ color: "var(--texto)" }}>
              Tornar privado
            </span>
            <span id={privacyHintId} className="app-sm block" style={{ color: "var(--texto-3)" }}>
              Some da árvore para quem não tem concessão — inclusive para o Proprietário do Espaço de
              Trabalho. Quem fica de fora só entra por um ato de governança registrado (B38).
            </span>
          </span>
          <Toggle
            checked={isPrivate}
            onChange={setIsPrivate}
            labelledBy={privacyLabelId}
            describedBy={privacyHintId}
          />
        </div>

        {error ? (
          <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
            {error}
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}

/** A3 — onde cada contêiner pode nascer. */
function locationOptions(
  state: DataState,
  kind: ContainerKind,
): ReadonlyArray<{ readonly value: string; readonly label: string; readonly detail?: string }> {
  const spaces = state.spaces
    .filter((space) => space.lifecycle === "ativo")
    .map((space) => ({ value: `space:${space.id}`, label: space.name, detail: "Espaço" }));

  if (kind === "pasta") {
    // Uma Pasta cabe num Espaço ou numa Pasta de primeiro nível — e ali vira
    // Subpasta. Dentro de uma Subpasta ela não cabe (A3.4), então não aparece.
    const folders = state.folders
      .filter((folder) => folder.lifecycle === "ativo" && folder.parentType === "space")
      .map((folder) => ({
        value: `folder:${folder.id}`,
        label: folder.name,
        detail: "Pasta — a nova nasce Subpasta",
      }));
    return [...spaces, ...folders];
  }

  const folders = state.folders
    .filter((folder) => folder.lifecycle === "ativo")
    .map((folder) => ({
      value: `folder:${folder.id}`,
      label: folder.name,
      detail: folder.parentType === "folder" ? "Subpasta" : "Pasta",
    }));
  return [...spaces, ...folders];
}

/** B25 — de onde o Conjunto de Status vem, dito por extenso. */
function statusOrigin(
  state: DataState,
  kind: ContainerKind,
  parentType: ParentType | undefined,
  parentId: string | undefined,
): string {
  if (kind === "espaco") return "Conjunto próprio, criado com o Espaço";
  if (!parentType || !parentId) return "depende da localização";

  if (parentType === "folder") {
    const folder = state.folders.find((f) => f.id === parentId);
    if (!folder) return "depende da localização";
    if (folder.modes["statusSet"] === "sobrescrito") {
      return `herdado de ${folder.name}, que sobrescreve o do Espaço`;
    }
    if (folder.blocks["statusSet"] === true) {
      return `herdado de ${folder.name}, que bloqueia a sobrescrita abaixo dela`;
    }
    const rootId =
      folder.parentType === "space"
        ? folder.parentId
        : state.folders.find((f) => f.id === folder.parentId)?.parentId;
    const space = state.spaces.find((s) => s.id === rootId);
    return space ? `herdado do Espaço ${space.name}` : "depende da localização";
  }

  const space = state.spaces.find((s) => s.id === parentId);
  return space ? `herdado do Espaço ${space.name}` : "depende da localização";
}
