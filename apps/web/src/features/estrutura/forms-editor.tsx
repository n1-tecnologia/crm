"use client";

/**
 * Fase 4 — Formulários de uma Lista: perguntas mapeadas em título, descrição
 * e Campos da Lista; um link público por Formulário. Cada envio vira uma
 * Tarefa em nome do dono, com Proveniência.
 */

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useData, useRun } from "@/dados/store";
import { archiveForm, createForm, formOutdatedReason, rotateFormSecret, updateForm } from "@n1/dominio/operations";
import { effectiveListConfig } from "@n1/dominio/derive";
import { FIELD_TYPE_LABEL } from "@/features/shell/format";
import { ActionMenu, Button, ConfirmDialog, EmptyState, Field, Icone, Select, TextInput, Toggle } from "@/features/shell/ui";
import type { Form, FormQuestion } from "@n1/dominio/types";

type Report = (result: { ok: boolean; error?: string }, message: string) => void;
type Rascunho = { readonly id?: string; label: string; required: boolean; target: string };

const alvoDe = (target: string): FormQuestion["target"] =>
  target === "title" ? { kind: "title" } : target === "description" ? { kind: "description" } : { kind: "field", definitionId: target.replace("field:", "") };
const chaveDe = (target: FormQuestion["target"]): string => (target.kind === "field" ? `field:${target.definitionId}` : target.kind);

export function FormsEditor({ listId, bloqueio, report }: { readonly listId: string; readonly bloqueio: string | undefined; readonly report: Report }) {
  const run = useRun();
  const state = useData((data) => data);
  const [editando, setEditando] = useState<Form | "novo" | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [perguntas, setPerguntas] = useState<Rascunho[]>([]);
  const [renovando, setRenovando] = useState<string | null>(null);
  const [arquivando, setArquivando] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const forms = state.forms.filter((f) => f.listId === listId && f.lifecycle === "ativo");
  const config = effectiveListConfig(state, listId);
  const campos = (config?.fieldDefinitionIds ?? [])
    .map((id) => state.fieldDefinitions.find((d) => d.id === id))
    .filter((d): d is NonNullable<typeof d> => d !== undefined && d.type !== "formula");
  const alvos = [
    { value: "title", label: "Título da Tarefa" },
    { value: "description", label: "Descrição da Tarefa" },
    ...campos.map((d) => ({ value: `field:${d.id}`, label: `Campo: ${d.name}`, detail: `${FIELD_TYPE_LABEL[d.type] ?? d.type}${d.required ? " · obrigatório na Lista" : ""}` })),
  ];
  const abrir = (form: Form | "novo") => {
    setEditando(form);
    setNome(form === "novo" ? "" : form.name);
    setDescricao(form === "novo" ? "" : (form.description ?? ""));
    setPerguntas(
      form === "novo"
        ? [{ label: "Assunto", required: true, target: "title" }, { label: "Detalhes", required: false, target: "description" }]
        : form.questions.map((q) => ({ id: q.id, label: q.label, required: q.required, target: chaveDe(q.target) })),
    );
  };
  const linkDe = (form: Form) => `${typeof window === "undefined" ? "" : window.location.origin}/f/${form.secret}`;
  const copiar = async (form: Form) => {
    try {
      await navigator.clipboard.writeText(linkDe(form));
      setCopiado(form.id);
      window.setTimeout(() => setCopiado(null), 2000);
    } catch {
      report({ ok: false, error: "Não foi possível copiar: selecione o link e copie manualmente." }, "");
    }
  };
  const semTitulo = perguntas.filter((q) => q.target === "title").length !== 1;
  const invalido = nome.trim() === "" ? "Dê um nome ao Formulário." : perguntas.length === 0 ? "Acrescente ao menos uma pergunta." : semTitulo ? "Exatamente uma pergunta vira o título." : perguntas.some((q) => !q.label.trim()) ? "Toda pergunta precisa de rótulo." : undefined;

  return (
    <div className="grid gap-3">
      <ConfirmDialog
        open={editando !== null}
        title={editando === "novo" ? "Novo Formulário" : `Editar “${editando?.name ?? ""}”`}
        description="Quem responde não precisa entrar: o envio cria a Tarefa em seu nome, com origem no Formulário. Um Campo obrigatório da Lista precisa de uma pergunta obrigatória."
        confirmLabel={editando === "novo" ? "Criar Formulário" : "Salvar"}
        wide
        {...(invalido ? { confirmDisabledReason: invalido } : {})}
        onConfirm={() => {
          const input = { name: nome, description: descricao, questions: perguntas.map((q) => ({ ...(q.id ? { id: q.id } : {}), label: q.label, required: q.required, target: alvoDe(q.target) })) };
          const result = run((data, me) => (editando === "novo" ? createForm(data, me, listId, input) : updateForm(data, me, (editando as Form).id, input)));
          if (result.ok) {
            report(result, editando === "novo" ? `Formulário “${nome.trim()}” criado. Copie o link para divulgar.` : "Formulário salvo.");
            setEditando(null);
            setErro(null);
          } else {
            setErro(result.error);
          }
        }}
        onCancel={() => {
          setEditando(null);
          setErro(null);
        }}
      >
        <div className="grid gap-3">
          {erro ? <p role="alert" className="app-base rounded-[var(--r-controle)] px-3 py-2" style={{ background: "var(--erro-lavado)", color: "var(--erro)" }}>{erro}</p> : null}
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Nome">{(id) => <TextInput id={id} value={nome} onChange={setNome} placeholder="Ex.: Pedido de suporte" />}</Field>
            <Field label="Descrição" hint="Aparece no topo do Formulário público.">{(id) => <TextInput id={id} value={descricao} onChange={setDescricao} />}</Field>
          </div>
          <fieldset className="grid gap-2">
            <legend className="rotulo">Perguntas</legend>
            {perguntas.map((q, i) => (
              <div key={q.id ?? i} className="painel grid gap-2 p-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
                <Field label={`Pergunta ${i + 1}`}>{(id) => <TextInput id={id} value={q.label} onChange={(label) => setPerguntas(perguntas.map((p, j) => (j === i ? { ...p, label } : p)))} />}</Field>
                <Field label="Preenche">
                  {(id) => (
                    <Select
                      id={id}
                      value={q.target}
                      // O título é sempre obrigatório: mudar o destino para ele liga a obrigatoriedade junto.
                      onChange={(target) => setPerguntas(perguntas.map((p, j) => (j === i ? { ...p, target, required: target === "title" ? true : p.required } : p)))}
                      options={alvos}
                    />
                  )}
                </Field>
                <span className="app-sm flex items-center gap-2 pb-2" style={{ color: "var(--texto)" }}>
                  <Toggle checked={q.required} onChange={(required) => setPerguntas(perguntas.map((p, j) => (j === i ? { ...p, required } : p)))} labelledBy={`pergunta-obrig-${i}`} disabled={q.target === "title"} />
                  <span id={`pergunta-obrig-${i}`}>Obrigatória</span>
                </span>
                <button type="button" onClick={() => setPerguntas(perguntas.filter((_, j) => j !== i))} aria-label={`Remover pergunta ${i + 1}`} className="btn-icone btn-icone-nu" style={{ color: "var(--erro)" }}>
                  <Icone de={Trash2} tamanho="sm" />
                </button>
              </div>
            ))}
            <span>
              <Button onClick={() => setPerguntas([...perguntas, { label: "", required: false, target: campos[0] ? `field:${campos[0].id}` : "description" }])} icon={<Icone de={Plus} tamanho="sm" />}>
                Pergunta
              </Button>
            </span>
          </fieldset>
        </div>
      </ConfirmDialog>
      <ConfirmDialog
        open={renovando !== null}
        title="Renovar o link deste Formulário?"
        description="O link atual para de abrir na hora; quem o tiver precisa do novo. As Tarefas já criadas não mudam."
        confirmLabel="Renovar link"
        destructive
        onConfirm={() => {
          if (renovando) report(run((data, me) => rotateFormSecret(data, me, renovando)), "Link renovado. Copie o novo para divulgar.");
          setRenovando(null);
        }}
        onCancel={() => setRenovando(null)}
      />

      <ConfirmDialog
        open={arquivando !== null}
        title="Arquivar este Formulário?"
        description="O link para de abrir e o Formulário sai desta lista. As Tarefas já criadas por ele continuam."
        confirmLabel="Arquivar"
        destructive
        onConfirm={() => {
          if (arquivando) report(run((data, me) => archiveForm(data, me, arquivando)), "Formulário arquivado.");
          setArquivando(null);
        }}
        onCancel={() => setArquivando(null)}
      />
      {forms.length === 0 ? (
        <EmptyState compact title="Nenhum Formulário." hint="Um Formulário deixa quem não é Membro criar Tarefas aqui por um link." />
      ) : (
        <ul className="pilha-solta">
          {forms.map((form) => (
            // Peça de bloco: nome e contadores, o aviso de desatualizado e o link empilhados. Não clica por inteiro.
            <li key={form.id} className="item-solto app-base grid gap-1" data-bloco="true" data-estatico="true">
              <div className="flex flex-wrap items-center gap-2">
                <span className="app-md min-w-0 flex-1 truncate" style={{ color: "var(--texto)" }}>{form.name}</span>
                <span className="app-meta app-numero">
                  {form.questions.length} pergunta(s) · {form.submissions} envio(s) · {form.enabled ? "ativo" : "pausado"}
                </span>
                <span title={bloqueio ?? (form.enabled ? "Pausar" : "Ativar")} className="inline-flex items-center gap-1">
                  <Toggle checked={form.enabled} onChange={(enabled) => report(run((data, me) => updateForm(data, me, form.id, { enabled })), enabled ? "Formulário ativado." : "Formulário pausado.")} labelledBy={`form-ativo-${form.id}`} disabled={bloqueio !== undefined} />
                  <span id={`form-ativo-${form.id}`} className="app-meta">ativo</span>
                </span>
                <ActionMenu
                  label={`Ações de ${form.name}`}
                  items={[
                    { label: "Editar", onSelect: () => abrir(form), ...(bloqueio ? { disabledReason: bloqueio } : {}) },
                    { label: "Renovar link", destructive: true, onSelect: () => setRenovando(form.id), ...(bloqueio ? { disabledReason: bloqueio } : {}) },
                    { label: "Arquivar", destructive: true, onSelect: () => setArquivando(form.id), ...(bloqueio ? { disabledReason: bloqueio } : {}) },
                  ]}
                />
              </div>
              {formOutdatedReason(state, form) ? (
                <p role="alert" className="app-sm rounded-[var(--r-controle)] px-2 py-1" style={{ background: "var(--aviso-lavado)", color: "var(--aviso)" }}>
                  Desatualizado — o link recusa envios: {formOutdatedReason(state, form)} Edite o Formulário e acrescente a pergunta.
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <a href={`/f/${form.secret}`} target="_blank" rel="noreferrer" className="identificador min-w-0 truncate underline" style={{ color: "var(--acento)" }}>
                  {linkDe(form)}
                </a>
                <Button onClick={() => copiar(form)}>{copiado === form.id ? "Copiado" : "Copiar link"}</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <span>
        <Button onClick={() => abrir("novo")} icon={<Icone de={Plus} tamanho="sm" />} disabled={bloqueio !== undefined} disabledReason={bloqueio ?? ""}>
          Novo Formulário
        </Button>
      </span>
      <p className="app-meta">
        Protótipo: os dados vivem na memória desta aba, então um link criado agora abre só nela. O Formulário de demonstração <a href="/f/demo-formulario" target="_blank" rel="noreferrer" className="underline">/f/demo-formulario</a> abre em qualquer aba.
      </p>
    </div>
  );
}
