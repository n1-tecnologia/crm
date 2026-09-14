"use client";

/**
 * Os quatro dropdowns embaixo da caixa do Chat — projeto (pasta), plugin
 * (Habilidade), base de conhecimento (Documento como Âncora) e Modelo. Um
 * componente só para a home e para a Sessão vazia: as duas telas são o mesmo
 * momento, "antes da primeira mensagem", e não podem divergir.
 */

import { ArrowUp, BookOpen, Bot, Cpu, Folder, Mic, Puzzle } from "lucide-react";
import { useData, useSession } from "@/data/store";
import { ActionMenu, Icone } from "@/features/shell/ui";

export interface ChatSetupValue {
  readonly folderId: string;
  readonly skillId: string;
  readonly documentId: string;
  readonly modelId: string;
  readonly agentId: string;
}

export function ChatSetupBar({
  value,
  onChange,
  documentLocked = false,
}: {
  readonly value: ChatSetupValue;
  readonly onChange: (patch: Partial<ChatSetupValue>) => void;
  /** B83 — com Mensagens, a Âncora não muda: o dropdown fica desligado e diz por quê. */
  readonly documentLocked?: boolean;
}) {
  const { memberId } = useSession();
  const state = useData((data) => data);
  const pastas = state.chatFolders
    .filter((folder) => folder.ownerMemberId === memberId)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const habilidades = state.skills.filter((skill) => skill.lifecycle === "ativo");
  const documentos = state.documents.filter((doc) => doc.lifecycle === "ativo");
  const modelos = state.models.filter((model) => !model.discontinued);
  const agentes = state.agents.filter((agent) => agent.lifecycle === "ativo");
  const agentePadrao = state.agents.find((a) => a.id === state.workspace.defaultAgentId);

  const campos = [
    {
      id: "projeto-do-chat",
      rotulo: "Projeto",
      icone: Folder,
      value: value.folderId,
      onChange: (folderId: string) => onChange({ folderId }),
      options: [{ value: "", label: "Sem pasta" }, ...pastas.map((f) => ({ value: f.id, label: f.name }))],
    },
    {
      id: "plugin-do-chat",
      rotulo: "Plugin",
      icone: Puzzle,
      value: value.skillId,
      onChange: (skillId: string) => onChange({ skillId }),
      options: [{ value: "", label: "Sem plugin" }, ...habilidades.map((k) => ({ value: k.id, label: k.name }))],
    },
    {
      id: "conhecimento-do-chat",
      rotulo: "Conhecimento",
      icone: BookOpen,
      value: value.documentId,
      onChange: (documentId: string) => onChange({ documentId }),
      options: [{ value: "", label: "Sem base" }, ...documentos.map((d) => ({ value: d.id, label: d.title }))],
      ...(documentLocked
        ? { disabled: true, disabledReason: "A Âncora é fixada na criação: com Mensagens, ela não muda." }
        : {}),
    },
    {
      id: "modelo-do-chat",
      rotulo: "Modelo",
      icone: Cpu,
      value: value.modelId,
      onChange: (modelId: string) => onChange({ modelId }),
      options: [{ value: "", label: "Modelo do Agente" }, ...modelos.map((m) => ({ value: m.id, label: m.name }))],
    },
    {
      id: "agente-do-chat",
      rotulo: "Agente",
      icone: Bot,
      value: value.agentId,
      onChange: (agentId: string) => onChange({ agentId }),
      options: [
        { value: "", label: agentePadrao?.name ?? "Assistente padrão" },
        ...agentes
          .filter((agent) => agent.id !== agentePadrao?.id)
          .map((agent) => ({ value: agent.id, label: agent.name })),
      ],
    },
  ];

  return (
    /*
      Como os chips do ChatGPT: lado a lado, colados na caixa, sem moldura —
      ícone, o valor escolhido e a seta. Cada um abre a lista e o escolhido
      vem marcado. Não é o `Select` de formulário porque este ocupa a largura
      toda e vira uma fileira de caixas; aqui é uma linha de escolhas — o
      botão sutil do sistema, que é exatamente "texto com hover e sem aro".
    */
    /*
      A segunda caixa: o trilho do sistema (a única superfície que DESCE em
      vez de subir), um pouco mais estreita, com os cantos de baixo redondos e
      enfiada por trás da principal — as duas lêem como uma peça só. A margem
      negativa e o z-index fazem o encaixe; o recuo de cima é o que fica
      escondido atrás da caixa principal, que é opaca de propósito.
    */
    <div className="relative z-0 mx-auto -mt-4 flex w-[calc(100%-2rem)] flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-b-[var(--r-destaque)] border border-t-0 border-[var(--linha-sutil)] bg-[var(--superficie-rebaixada)] px-3 pb-2 pt-6">
      {campos.map(({ id, rotulo, icone, options, ...campo }) => {
        const atual = options.find((option) => option.value === campo.value) ?? options[0];
        const travado = "disabled" in campo && campo.disabled === true;
        // O nome do seletor fica fixo, como os chips do GPT; a escolha vai no
        // `title` e marcada na lista, e o ponto avisa que há uma.
        const gatilho = (
          <span
            title={travado && "disabledReason" in campo ? campo.disabledReason : campo.value ? atual?.label : undefined}
            className={`btn btn-sutil btn-sm ${
              travado ? "cursor-not-allowed opacity-60 hover:bg-transparent hover:text-[var(--texto-3)]" : ""
            }`}
          >
            <Icone de={icone} tamanho="sm" />
            <span className={campo.value ? "text-[var(--texto)]" : ""}>{rotulo}</span>
            {campo.value ? (
              <span className="sr-only">: {atual?.label}</span>
            ) : null}
            {campo.value ? (
              <span aria-hidden="true" className="pilula-ponto" style={{ background: "var(--acento)" }} />
            ) : null}
          </span>
        );
        return travado ? (
          <span key={id} id={id} aria-disabled="true">
            {gatilho}
          </span>
        ) : (
          <span key={id} id={id}>
            <ActionMenu
              label={rotulo}
              trigger={gatilho}
              items={options.map((option) => ({
                label: option.value === campo.value ? `✓ ${option.label}` : option.label,
                onSelect: () => campo.onChange(option.value),
              }))}
            />
          </span>
        );
      })}
    </div>
  );
}

/**
 * O botão redondo de enviar do ChatGPT, na pele do sistema: o círculo de ícone
 * com o gradiente da marca — a única ação sólida do compositor — que apaga
 * quando não há o que enviar. O motivo do bloqueio vai no `title` e para o
 * leitor de tela, como o `Button` do design faz.
 */
export function SendCircle({
  onClick,
  disabledReason,
  label,
}: {
  readonly onClick: () => void;
  readonly disabledReason?: string;
  readonly label: string;
}) {
  const disabled = disabledReason !== undefined;
  return (
    <button
      type="button"
      onClick={(event) => {
        if (disabled) {
          event.preventDefault();
          return;
        }
        onClick();
      }}
      aria-disabled={disabled}
      aria-label={label}
      title={disabled ? disabledReason : label}
      className={`btn-icone ${disabled ? "cursor-not-allowed opacity-60 hover:transform-none hover:shadow-none" : ""}`}
      style={{ background: "var(--degrade-acento)", color: "var(--sobre-degrade)", borderColor: "transparent" }}
    >
      <Icone de={ArrowUp} tamanho="sm" />
    </button>
  );
}

/** Gravar áudio, ao lado do enviar. O protótipo não grava: o botão diz isso no `title`. */
export function MicButton() {
  return (
    <button
      type="button"
      aria-label="Gravar áudio"
      title="Gravar áudio — a gravação ainda não existe neste protótipo."
      className="btn-icone border-transparent"
    >
      <Icone de={Mic} tamanho="sm" />
    </button>
  );
}
