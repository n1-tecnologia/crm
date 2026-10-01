"use client";

/**
 * Fase 4 — Formulários de uma Lista: perguntas mapeadas em título, descrição
 * e Campos da Lista; um link público por Formulário. Cada envio vira uma
 * Tarefa em nome do dono, com Proveniência.
 *
 * Checklist 1.2/1.3 — tudo o que a página pública mostra se edita aqui: a
 * ordem das perguntas (subir/descer), a seção, a ajuda e a condição
 * ("mostrar quando <pergunta anterior de escolha> for <valores>"). Uma
 * pergunta nova ganha um id provisório, para outra poder depender dela antes
 * de salvar; o domínio dá o id definitivo e leva a condição junto.
 */

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useData, useRun } from "@/dados/store";
import { FORMULARIO_EM_LISTA_CONVERSACIONAL, archiveForm, createForm, formOutdatedReason, rotateFormSecret, updateForm } from "@n1/dominio/operations";
import { effectiveListConfig } from "@n1/dominio/derive";
import { listaConversacional } from "@n1/dominio/derive-conversacional";
import { FIELD_TYPE_LABEL } from "@/features/shell/format";
import { ActionMenu, Button, ConfirmDialog, EmptyState, Field, Icone, MultiSelect, Select, TextInput, Toggle } from "@/features/shell/ui";
import type { Form, FormQuestion } from "@n1/dominio/types";

type Report = (result: { ok: boolean; error?: string }, message: string) => void;
type Rascunho = {
  /** O id da pergunta salva, ou um provisório (`novo_…`) para a pergunta nova. */
  readonly id: string;
  label: string;
  required: boolean;
  target: string;
  section: string;
  help: string;
  /** O id da pergunta-gatilho; vazio = "sempre". */
  gatilho: string;
  valores: readonly string[];
};

const SEMPRE = "";

const alvoDe = (target: string): FormQuestion["target"] =>
  target === "title" ? { kind: "title" } : target === "description" ? { kind: "description" } : { kind: "field", definitionId: target.replace("field:", "") };
const chaveDe = (target: FormQuestion["target"]): string => (target.kind === "field" ? `field:${target.definitionId}` : target.kind);

export function FormsEditor({ listId, bloqueio, report }: { readonly listId: string; readonly bloqueio: string | undefined; readonly report: Report }) {
  const run = useRun();
  const provisorios = useRef(0);
  const novoId = () => {
    provisorios.current += 1;
    return `novo_${provisorios.current}`;
  };
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
  // C35 — na Lista conversacional o Formulário não cria Tarefa (o envio não
  // traz Contato): criar e editar ficam desligados com a frase do domínio;
  // arquivar segue aberto, porque é a saída.
  const conversacional = listaConversacional(state, listId);
  const bloqueioDeEdicao = bloqueio ?? (conversacional ? FORMULARIO_EM_LISTA_CONVERSACIONAL : undefined);
  const config = effectiveListConfig(state, listId);
  const campos = (config?.fieldDefinitionIds ?? [])
    .map((id) => state.fieldDefinitions.find((d) => d.id === id))
    .filter((d): d is NonNullable<typeof d> => d !== undefined && d.type !== "formula");
  const alvos = [
    { value: "title", label: "Título da Tarefa" },
    { value: "description", label: "Descrição da Tarefa" },
    ...campos.map((d) => ({ value: `field:${d.id}`, label: `Campo: ${d.name}`, detail: `${FIELD_TYPE_LABEL[d.type] ?? d.type}${d.required ? " · obrigatório na Lista" : ""}` })),
  ];
  const vazia = (extra: Partial<Rascunho>): Rascunho => ({ id: novoId(), label: "", required: false, target: "description", section: "", help: "", gatilho: SEMPRE, valores: [], ...extra });
  const abrir = (form: Form | "novo") => {
    setEditando(form);
    setNome(form === "novo" ? "" : form.name);
    setDescricao(form === "novo" ? "" : (form.description ?? ""));
    setPerguntas(
      form === "novo"
        ? [vazia({ label: "Assunto", required: true, target: "title" }), vazia({ label: "Detalhes", target: "description" })]
        : form.questions.map((q) => ({
            id: q.id,
            label: q.label,
            required: q.required,
            target: chaveDe(q.target),
            section: q.section ?? "",
            help: q.help ?? "",
            gatilho: q.showWhen?.questionId ?? SEMPRE,
            valores: q.showWhen?.values ?? [],
          })),
    );
  };
  /** Os valores possíveis de uma pergunta-gatilho: as opções do Campo de escolha única, ou sim/não. */
  const valoresDe = (target: string): readonly string[] | undefined => {
    if (!target.startsWith("field:")) return undefined;
    const def = state.fieldDefinitions.find((d) => d.id === target.replace("field:", ""));
    return def?.type === "singleSelect" ? (def.options ?? []) : def?.type === "checkbox" ? ["sim", "não"] : undefined;
  };
  const mudar = (i: number, parcial: Partial<Rascunho>) => setPerguntas(perguntas.map((p, j) => (j === i ? { ...p, ...parcial } : p)));
  const mover = (i: number, passo: -1 | 1) => {
    const j = i + passo;
    if (j < 0 || j >= perguntas.length) return;
    const proximas = [...perguntas];
    [proximas[i], proximas[j]] = [proximas[j]!, proximas[i]!];
    setPerguntas(proximas);
  };
  /** Remover uma pergunta tira a condição de quem dependia dela — ninguém fica apontando para o nada. */
  const remover = (i: number) => {
    const sai = perguntas[i]!.id;
    setPerguntas(perguntas.filter((_, j) => j !== i).map((p) => (p.gatilho === sai ? { ...p, gatilho: SEMPRE, valores: [] } : p)));
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
  const condicaoSemValor = perguntas.find((q) => q.gatilho && q.valores.length === 0);
  const invalido =
    nome.trim() === ""
      ? "Dê um nome ao Formulário."
      : perguntas.length === 0
        ? "Acrescente ao menos uma pergunta."
        : semTitulo
          ? "Exatamente uma pergunta vira o título."
          : perguntas.some((q) => !q.label.trim())
            ? "Toda pergunta precisa de rótulo."
            : condicaoSemValor
              ? `Escolha ao menos um valor na condição de “${condicaoSemValor.label}”.`
              : undefined;

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
          const input = {
            name: nome,
            description: descricao,
            questions: perguntas.map((q) => ({
              id: q.id,
              label: q.label,
              required: q.required,
              target: alvoDe(q.target),
              ...(q.section.trim() ? { section: q.section } : {}),
              ...(q.help.trim() ? { help: q.help } : {}),
              ...(q.gatilho ? { showWhen: { questionId: q.gatilho, values: q.valores } } : {}),
            })),
          };
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
            {perguntas.map((q, i) => {
              // Só uma pergunta ANTERIOR, de escolha única ou sim/não, decide se esta aparece.
              const gatilhos = perguntas.slice(0, i).filter((g) => valoresDe(g.target) !== undefined);
              const gatilho = perguntas.find((g) => g.id === q.gatilho);
              const valoresDoGatilho = gatilho ? (valoresDe(gatilho.target) ?? []) : [];
              return (
                <div key={q.id} className="painel grid gap-2 p-3">
                  <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
                    <Field label={`Pergunta ${i + 1}`}>{(id) => <TextInput id={id} value={q.label} onChange={(label) => mudar(i, { label })} />}</Field>
                    <Field label="Preenche">
                      {(id) => (
                        <Select
                          id={id}
                          value={q.target}
                          // O título é sempre obrigatório e aparece sempre: mudar o destino para ele liga a obrigatoriedade e tira a condição.
                          onChange={(target) => mudar(i, target === "title" ? { target, required: true, gatilho: SEMPRE, valores: [] } : { target })}
                          options={alvos}
                        />
                      )}
                    </Field>
                    <span className="app-sm flex items-center gap-2 pb-2" style={{ color: "var(--texto)" }}>
                      <Toggle checked={q.required} onChange={(required) => mudar(i, { required })} labelledBy={`pergunta-obrig-${i}`} disabled={q.target === "title"} />
                      <span id={`pergunta-obrig-${i}`}>Obrigatória</span>
                    </span>
                    <span className="flex items-center gap-1 pb-1">
                      <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} aria-label={`Subir pergunta ${i + 1}`} className="btn-icone btn-icone-nu">
                        <Icone de={ArrowUp} tamanho="sm" />
                      </button>
                      <button type="button" onClick={() => mover(i, 1)} disabled={i === perguntas.length - 1} aria-label={`Descer pergunta ${i + 1}`} className="btn-icone btn-icone-nu">
                        <Icone de={ArrowDown} tamanho="sm" />
                      </button>
                      <button type="button" onClick={() => remover(i)} aria-label={`Remover pergunta ${i + 1}`} className="btn-icone btn-icone-nu" style={{ color: "var(--erro)" }}>
                        <Icone de={Trash2} tamanho="sm" />
                      </button>
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Field label="Seção" hint="Perguntas seguidas com a mesma seção formam um bloco na página.">
                      {(id) => <TextInput id={id} value={q.section} onChange={(section) => mudar(i, { section })} placeholder="Ex.: Pagamento" />}
                    </Field>
                    <Field label="Ajuda" hint="Aparece embaixo da pergunta; sem ela, a descrição do Campo.">
                      {(id) => <TextInput id={id} value={q.help} onChange={(help) => mudar(i, { help })} />}
                    </Field>
                  </div>
                  {q.target === "title" ? null : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Field label="Mostrar">
                        {(id) => (
                          <Select
                            id={id}
                            value={q.gatilho}
                            onChange={(novo) => mudar(i, { gatilho: novo, valores: [] })}
                            options={[{ value: SEMPRE, label: "Sempre" }, ...gatilhos.map((g) => ({ value: g.id, label: `Quando “${g.label || "sem rótulo"}” for…` }))]}
                          />
                        )}
                      </Field>
                      {gatilho ? (
                        <Field label="Valores" hint="A pergunta aparece quando a resposta é um destes.">
                          {(id) => (
                            <MultiSelect
                              id={id}
                              values={q.valores}
                              options={valoresDoGatilho.map((v) => ({ value: v, label: v }))}
                              onChange={(valores) => mudar(i, { valores })}
                            />
                          )}
                        </Field>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
            <span>
              <Button onClick={() => setPerguntas([...perguntas, vazia({ target: campos[0] ? `field:${campos[0].id}` : "description" })])} icon={<Icone de={Plus} tamanho="sm" />}>
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
        <EmptyState compact title="Nenhum Formulário." hint={conversacional ? FORMULARIO_EM_LISTA_CONVERSACIONAL : "Um Formulário deixa quem não é Membro criar Tarefas aqui por um link."} />
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
                <span title={bloqueioDeEdicao ?? (form.enabled ? "Pausar" : "Ativar")} className="inline-flex items-center gap-1">
                  {bloqueioDeEdicao ? (
                    <span className="sr-only" id={`form-motivo-${form.id}`}>
                      {bloqueioDeEdicao}
                    </span>
                  ) : null}
                  <Toggle
                    checked={form.enabled}
                    onChange={(enabled) => report(run((data, me) => updateForm(data, me, form.id, { enabled })), enabled ? "Formulário ativado." : "Formulário pausado.")}
                    labelledBy={`form-ativo-${form.id}`}
                    disabled={bloqueioDeEdicao !== undefined}
                    {...(bloqueioDeEdicao ? { describedBy: `form-motivo-${form.id}` } : {})}
                  />
                  <span id={`form-ativo-${form.id}`} className="app-meta">ativo</span>
                </span>
                <ActionMenu
                  label={`Ações de ${form.name}`}
                  items={[
                    { label: "Editar", onSelect: () => abrir(form), ...(bloqueioDeEdicao ? { disabledReason: bloqueioDeEdicao } : {}) },
                    { label: "Renovar link", destructive: true, onSelect: () => setRenovando(form.id), ...(bloqueio ? { disabledReason: bloqueio } : {}) },
                    { label: "Arquivar", destructive: true, onSelect: () => setArquivando(form.id), ...(bloqueio ? { disabledReason: bloqueio } : {}) },
                  ]}
                />
              </div>
              {formOutdatedReason(state, form) ? (
                <p role="alert" className="app-sm rounded-[var(--r-controle)] px-2 py-1" style={{ background: "var(--aviso-lavado)", color: "var(--aviso)" }}>
                  Desatualizado — o link recusa envios: {formOutdatedReason(state, form)} {conversacional ? "Arquive o Formulário." : "Edite o Formulário e acrescente a pergunta."}
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
        <Button onClick={() => abrir("novo")} icon={<Icone de={Plus} tamanho="sm" />} disabled={bloqueioDeEdicao !== undefined} disabledReason={bloqueioDeEdicao ?? ""}>
          Novo Formulário
        </Button>
      </span>
    </div>
  );
}
