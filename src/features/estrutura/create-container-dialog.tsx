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
import { useData, useRun } from "@/data/store";
import { useRecente } from "@/features/shell/recente";
import { createFolder, createList, createSpace, instantiateListTemplate } from "@/data/operations";
import { Check, CircleDot, Lock, MessageSquare, SquareCheck, type LucideIcon } from "lucide-react";
import {
  ConfirmDialog,
  Field,
  Icone,
  Select,
  TextArea,
  TextInput,
  Toggle,
} from "@/features/shell/ui";
import { Selo } from "@/features/estrutura/icone-de-tipo";
import { CanaisDeAtendimento } from "@/features/estrutura/canais-de-atendimento";
import { AdicionarCanalDialog } from "@/features/crm/adicionar-canal-dialog";
import type { TipoDeAtendimento } from "@/data/operations/canais";
import type { DataState, OperationResult } from "@/data/state";
import type { Folder, List, ModeloDeTarefa, Space } from "@/data/types";

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
  lista: "Onde as Tarefas moram. Herda a configuração do contêiner acima; o modelo de Tarefa é dela e se decide agora.",
};

/**
 * C35 — o que a Tarefa É ao nascer na Lista. Não é aspecto herdável (B25):
 * um Espaço mistura Listas dos dois modelos, e o modelo não muda depois que
 * a Lista tem Tarefas — por isso se decide aqui, na criação.
 */
const MODELOS: ReadonlyArray<{
  readonly valor: ModeloDeTarefa;
  readonly titulo: string;
  readonly descricao: string;
  readonly icone: LucideIcon;
}> = [
  {
    valor: "operacional",
    titulo: "Operacional",
    descricao: "A Tarefa de gestão: título, Status, Responsável e datas — sem Contato nem conversa.",
    icone: SquareCheck,
  },
  {
    valor: "conversacional",
    titulo: "Conversacional",
    descricao: "Cada Tarefa nasce de um Contato e traz a conversa dele; a Lista tem acesso ao CRM.",
    icone: MessageSquare,
  },
];

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

  const recente = useRecente();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#9601c5");
  const [isPrivate, setIsPrivate] = useState(false);
  const [modeloDeTarefa, setModeloDeTarefa] = useState<ModeloDeTarefa>("operacional");
  /* C36 — os canais de atendimento da Lista conversacional, escolhidos antes
     de ela nascer; e o tipo cujo popup de "adicionar" está no ar. Enquanto o
     popup está aberto, este diálogo se apaga (os diálogos não empilham) e
     volta quando ele fecha, com a conta nova já marcada. */
  const [canais, setCanais] = useState<readonly string[]>([]);
  const [adicionando, setAdicionando] = useState<TipoDeAtendimento | null>(null);
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
  // "este Espaço", "esta Pasta", "esta Lista": o artigo acompanha o nome.
  const este = kind === "espaco" ? "este" : "esta";

  const locations = locationOptions(state, kind);
  const templates = state.templates.filter(
    (template) => template.kind === kind && template.lifecycle === "ativo",
  );

  const conversacional = kind === "lista" && modeloDeTarefa === "conversacional";
  const blockedReason =
    name.trim() === ""
      ? `Dê um nome à ${label}.`
      : kind !== "espaco" && !parent
        ? "Escolha onde ela vai ficar."
        : conversacional && canais.length === 0
          ? "Ative ao menos um canal de atendimento."
          : undefined;

  // Voltar a operacional apaga a escolha: a operacional não tem canais.
  const escolherModelo = (modelo: ModeloDeTarefa) => {
    setModeloDeTarefa(modelo);
    if (modelo === "operacional") setCanais([]);
  };

  const reset = () => {
    setName("");
    setDescription("");
    setIsPrivate(false);
    setModeloDeTarefa("operacional");
    setCanais([]);
    setAdicionando(null);
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
        // Só a Lista tem modelo de Tarefa (C35): a Pasta não conhece o campo.
        // E só a conversacional tem canais de atendimento (C36).
        const listInput = { ...input, modeloDeTarefa, ...(conversacional ? { canaisDeAtendimento: canais } : {}) };
        // Um Template de Lista com configuração (Status, Campos, Tipos) instancia a estrutura junto.
        return templateId && data.templates.find((t) => t.id === templateId)?.creates?.listConfig
          ? instantiateListTemplate(data, memberId, templateId, listInput)
          : createList(data, memberId, listInput);
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
    <>
    <ConfirmDialog
      open={adicionando === null}
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
      <div className="grid gap-5">
        <Field label="Nome" required>
          {(id) => (
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
          )}
        </Field>

        {kind === "espaco" ? (
          <Field label="Cor" hint="A cor marca o Espaço na árvore e nos cartões.">
            {(id) => (
              <div id={id} role="radiogroup" aria-label="Cor do Espaço" className="flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-2">
                  {SPACE_COLORS.map((option) => {
                    const escolhida = color === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={escolhida}
                        aria-label={option.label}
                        title={option.label}
                        onClick={() => setColor(option.value)}
                        className="rotacao grid size-7 place-items-center rounded-full hover:scale-110"
                        style={{
                          backgroundColor: option.value,
                          boxShadow: escolhida ? "0 0 0 2px var(--card), 0 0 0 4px var(--acento)" : "inset 0 0 0 1px var(--linha-forte)",
                        }}
                      >
                        {escolhida ? <Icone de={Check} tamanho="xs" style={{ color: "var(--sobre-acento)" }} /> : null}
                      </button>
                    );
                  })}
                </span>
                <span className="app-sm" style={{ color: "var(--texto-3)" }}>
                  {SPACE_COLORS.find((option) => option.value === color)?.label}
                </span>
              </div>
            )}
          </Field>
        ) : null}

        <Field label="Descrição" hint="Opcional.">
          {(id) => (
            <TextArea
              id={id}
              value={description}
              onChange={setDescription}
              rows={2}
              placeholder={`Conte para que serve ${este} ${label}.`}
            />
          )}
        </Field>

        {kind === "lista" ? (
          <SeletorDeModelo value={modeloDeTarefa} onChange={escolherModelo} />
        ) : null}

        {conversacional ? (
          <CanaisDeAtendimento valor={canais} onChange={setCanais} onAdicionar={setAdicionando} recente={recente} />
        ) : null}

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

        {/*
          As configurações numa caixa só, uma linha por assunto. O contêiner
          nasce no padrão e o ajuste vem depois, nas configurações dele:
          decidir herança na criação obriga a escolher antes de existir o que
          comparar. A linha diz de onde o padrão vem.
        */}
        <div className="grid gap-1.5">
          <span className="rotulo">Configurações</span>
          <div className="painel">
            <div className="flex items-center gap-3 px-3 py-2.5">
              <Selo icone={CircleDot} cor="var(--acento)" lavado="var(--acento-lavado)" />
              <span className="min-w-0 flex-1">
                <span className="app-base block" style={{ color: "var(--texto)" }}>
                  Status
                </span>
                <span className="app-sm block" style={{ color: "var(--texto-3)" }}>
                  {statusOrigin(state, kind, parentType, parentId)}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-3 px-3 py-2.5" style={{ borderTop: "1px solid var(--linha)" }}>
              <Selo icone={Lock} cor="var(--texto-2)" lavado="var(--superficie-2)" />
              <span className="min-w-0 flex-1">
                <span id={privacyLabelId} className="app-base block" style={{ color: "var(--texto)" }}>
                  Tornar privado
                </span>
                <span id={privacyHintId} className="app-sm block" style={{ color: "var(--texto-3)" }}>
                  Some da árvore para quem não tem concessão — inclusive para o Proprietário do Espaço
                  de Trabalho. Quem fica de fora só entra por um ato de governança registrado (B38).
                </span>
              </span>
              <Toggle
                checked={isPrivate}
                onChange={setIsPrivate}
                labelledBy={privacyLabelId}
                describedBy={privacyHintId}
              />
            </div>
          </div>
          <p className="ajuda">
            {kind === "espaco"
              ? "Um Espaço sempre define o próprio Conjunto de Status, porque é dele que todo o resto herda (RN-ESP-03). Ele se ajusta depois, nas configurações do Espaço."
              : `A herança é por aspecto (B25) e se ajusta depois, nas configurações da ${label}.`}
          </p>
        </div>

        {error ? (
          <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
            {error}
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
    {/* C36 — o popup de conectar uma conta nova. Irmão, não filho: um diálogo
        de cada vez. Ao criar, a conta entra marcada e este diálogo volta. */}
    <AdicionarCanalDialog
      {...(adicionando ? { tipo: adicionando } : {})}
      open={adicionando !== null}
      onClose={() => setAdicionando(null)}
      onDone={(canal) => {
        setCanais((atuais) => (atuais.includes(canal.id) ? atuais : [...atuais, canal.id]));
        setAdicionando(null);
      }}
    />
    </>
  );
}

/**
 * O modelo de Tarefa da Lista, em duas peças de rádio: a escolhida acende
 * como item destacado. É `role="radio"` e não `<input>`: a peça inteira
 * (selo, título, frase) é o alvo, como o catálogo de componentes do Flow.
 */
function SeletorDeModelo({
  value,
  onChange,
}: {
  readonly value: ModeloDeTarefa;
  readonly onChange: (modelo: ModeloDeTarefa) => void;
}) {
  return (
    <Field label="Modelo de Tarefa" required hint="Depois que a Lista tiver Tarefas, o modelo não muda.">
      {(id) => (
        <div id={id} role="radiogroup" aria-label="Modelo de Tarefa" className="grid gap-1.5 sm:grid-cols-2">
          {MODELOS.map((modelo) => {
            const escolhido = value === modelo.valor;
            return (
              <button
                key={modelo.valor}
                type="button"
                role="radio"
                aria-checked={escolhido}
                onClick={() => onChange(modelo.valor)}
                className="item-solto w-full text-left"
                data-alinhamento="topo"
                data-destacado={escolhido ? "true" : undefined}
              >
                <Selo
                  icone={modelo.icone}
                  cor={escolhido ? "var(--acento)" : "var(--texto-2)"}
                  lavado={escolhido ? "var(--acento-lavado)" : "var(--superficie-2)"}
                />
                <span className="min-w-0 flex-1">
                  <span className="app-base block" style={{ color: "var(--texto)" }}>
                    {modelo.titulo}
                  </span>
                  <span className="app-sm block" style={{ color: "var(--texto-3)" }}>
                    {modelo.descricao}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </Field>
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
