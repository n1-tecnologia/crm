"use client";

/**
 * Fase 3 — Templates de Lista e de Tarefa: salvar o que existe como modelo e
 * criar uma Tarefa a partir de um. Instanciar copia estrutura, nunca ids (A8).
 */

import { useState } from "react";
import { useData, useRun } from "@/dados/store";
import { instantiateTaskTemplate, saveListAsTemplate, saveTaskAsTemplate } from "@n1/dominio/operations";
import { ConfirmDialog, Field, Select, TextInput } from "@/features/shell/ui";

type Report = (result: { ok: boolean; error?: string }, message: string) => void;

export function SaveTemplateDialog({
  kind,
  sourceId,
  open,
  onClose,
  report,
}: {
  readonly kind: "lista" | "tarefa";
  readonly sourceId: string;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly report: Report;
}) {
  const run = useRun();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const fechar = () => {
    setName("");
    setDescription("");
    setErro(null);
    onClose();
  };
  return (
    <ConfirmDialog
      open={open}
      title={kind === "lista" ? "Salvar esta Lista como modelo" : "Salvar esta Tarefa como modelo"}
      description={
        kind === "lista"
          ? "O modelo guarda o Conjunto de Status, os Campos e os Tipos que esta Lista enxerga. Instanciar cria uma Lista nova com essa estrutura e ids novos."
          : "O modelo guarda título, descrição, prioridade, Checklists (por fazer) e os títulos das Subtarefas. Instanciar cria uma Tarefa nova."
      }
      confirmLabel="Salvar modelo"
      {...(name.trim() === "" ? { confirmDisabledReason: "Dê um nome ao modelo." } : {})}
      onConfirm={() => {
        const result = run((data, me) =>
          kind === "lista" ? saveListAsTemplate(data, me, sourceId, { name, description }) : saveTaskAsTemplate(data, me, sourceId, { name, description }),
        );
        // Recusado, o motivo fica DENTRO do diálogo: um Toast atrás da cortina ninguém vê.
        if (result.ok) {
          report(result, `Modelo “${name.trim()}” salvo. Ele aparece em Configurações › Templates.`);
          fechar();
        } else {
          setErro(result.error);
        }
      }}
      onCancel={fechar}
    >
      <div className="grid gap-2">
        {erro ? <p role="alert" className="app-base rounded-[var(--r-controle)] px-3 py-2" style={{ background: "var(--erro-lavado)", color: "var(--erro)" }}>{erro}</p> : null}
        <Field label="Nome do modelo">{(id) => <TextInput id={id} value={name} onChange={setName} placeholder="Ex.: Onboarding padrão" />}</Field>
        <Field label="Descrição">{(id) => <TextInput id={id} value={description} onChange={setDescription} placeholder="Opcional" />}</Field>
      </div>
    </ConfirmDialog>
  );
}

export function NewTaskFromTemplateDialog({
  listId,
  open,
  onClose,
  onCreated,
  report,
}: {
  readonly listId: string;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onCreated: (taskId: string, title: string) => void;
  readonly report: Report;
}) {
  const run = useRun();
  const templates = useData((data) => data.templates.filter((t) => t.kind === "tarefa" && t.lifecycle === "ativo" && t.creates?.task !== undefined));
  const [templateId, setTemplateId] = useState("");
  const [title, setTitle] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const escolhido = templates.find((t) => t.id === templateId);
  const fechar = () => {
    setTemplateId("");
    setTitle("");
    setErro(null);
    onClose();
  };
  return (
    <ConfirmDialog
      open={open}
      title="Nova Tarefa a partir de um modelo"
      description={templates.length === 0 ? "Ainda não há modelo de Tarefa. Abra uma Tarefa e use “Salvar como modelo”." : "A Tarefa nasce nesta Lista com os Checklists e Subtarefas do modelo."}
      confirmLabel="Criar Tarefa"
      {...(templateId === "" ? { confirmDisabledReason: templates.length === 0 ? "Não há modelo para escolher." : "Escolha o modelo." } : {})}
      onConfirm={() => {
        const result = run((data, me) => instantiateTaskTemplate(data, me, templateId, listId, title));
        if (result.ok) {
          report(result, `Tarefa criada: ${result.value.title}.`);
          onCreated(result.value.id, result.value.title);
          fechar();
        } else {
          setErro(result.error);
        }
      }}
      onCancel={fechar}
    >
      <div className="grid gap-2">
        {erro ? <p role="alert" className="app-base rounded-[var(--r-controle)] px-3 py-2" style={{ background: "var(--erro-lavado)", color: "var(--erro)" }}>{erro}</p> : null}
        <Field label="Modelo">
          {(id) => (
            <Select
              id={id}
              value={templateId}
              onChange={setTemplateId}
              placeholder="Escolher"
              options={templates.map((t) => ({ value: t.id, label: t.name, detail: t.body }))}
              disabled={templates.length === 0}
              disabledReason="Não há modelo de Tarefa."
            />
          )}
        </Field>
        <Field label="Título" hint={escolhido ? `Vazio usa “${escolhido.creates?.task?.title ?? escolhido.name}”.` : undefined}>
          {(id) => <TextInput id={id} value={title} onChange={setTitle} placeholder="Opcional" />}
        </Field>
      </div>
    </ConfirmDialog>
  );
}
