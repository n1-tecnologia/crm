"use client";

/**
 * Os editores da Tarefa (Fase 0 da Gestão de Projetos). Cada um chama UMA
 * operação e devolve o resultado ao chamador, que mostra sucesso ou erro —
 * a tela decide onde avisar; o editor só edita.
 */

import { Check, MessageSquareReply, RotateCcw, Send } from "lucide-react";
import { useId, useState } from "react";
import { useData, useRun, useSession } from "@/data/store";
import {
  addTaskComment,
  resolveTaskComment,
  setTaskFieldValue,
  setTaskTags,
  updateTask,
  watchTask,
} from "@/data/operations";
import { useFormat } from "@/features/shell/use-format";
import { Button, EmptyState, Field, Icone, MultiSelect, Select, TextArea, TextInput } from "@/features/shell/ui";
import type { OperationResult } from "@/data/state";
import type { ActorRef, FieldDefinition, FieldValue, Task, TaskDate } from "@/data/types";

type Report = (result: OperationResult<unknown>, message: string) => void;

/** A linha rótulo→valor da ficha, no molde da `RecordRow` — sem o `truncate`, que cortaria o menu do editor. */
const LINHA = "flex items-baseline justify-between gap-3 py-1";
const ROTULO = "app-meta shrink-0";

const civil = (date: TaskDate | undefined): string =>
  date ? (date.form === "civilDay" ? date.value : date.value.slice(0, 10)) : "";

/** Título e descrição, editados no lugar. Salva ao confirmar, nunca a cada tecla. */
export function TaskTitleDescriptionEditor({
  task,
  report,
  onClose,
}: {
  readonly task: Task;
  readonly report: Report;
  readonly onClose: () => void;
}) {
  const run = useRun();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [erro, setErro] = useState<string | null>(null);
  const mudou = title.trim() !== task.title || description !== task.description;

  const salvar = () => {
    const result = run((data, memberId) => updateTask(data, memberId, task.id, { title, description }));
    if (result.ok) {
      report(result, "Tarefa atualizada.");
      onClose();
    } else {
      // O painel cobre a página: o erro precisa estar AQUI, não atrás dele.
      setErro(result.error);
    }
  };

  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (mudou && title.trim()) salvar();
      }}
    >
      <Field label="Título" {...(erro ? { error: erro } : {})}>
        {(id) => <TextInput id={id} value={title} onChange={setTitle} invalid={title.trim() === ""} />}
      </Field>
      <Field label="Descrição" hint="O que precisa ser feito, e o que conta como feito.">
        {(id) => <TextArea id={id} value={description} onChange={setDescription} rows={5} autoGrow />}
      </Field>
      <span className="flex justify-end gap-2">
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          type="submit"
          variant="primary"
          disabled={!mudou || title.trim() === ""}
          disabledReason={title.trim() === "" ? "O título não pode ficar vazio." : "Nada mudou."}
        >
          Salvar
        </Button>
      </span>
    </form>
  );
}

/** Prioridade, datas e estimativa: cada controle grava ao mudar. */
/** Um `datetime-local` lê e escreve no fuso do navegador; o Instante guardado é ISO. */
const localDateTime = (iso: string): string => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function TaskAttributeEditors({
  task,
  report,
  features,
}: {
  readonly task: Task;
  readonly report: Report;
  readonly features: { readonly prioridade: boolean; readonly estimativa: boolean };
}) {
  const run = useRun();
  const ids = useId();
  const [estimativa, setEstimativa] = useState(task.estimate !== undefined ? String(task.estimate) : "");

  const gravar = (patch: Parameters<typeof updateTask>[3], mensagem: string) => {
    const result = run((data, memberId) => updateTask(data, memberId, task.id, patch));
    report(result, mensagem);
    return result.ok;
  };

  /*
    A data preserva a FORMA que já tinha (6.2): uma Reunião com hora continua
    com hora — reescrevê-la como dia civil apagaria a hora e a tiraria da
    agenda. Data nova, sem forma anterior, nasce como dia civil.
  */
  const controleDeData = (
    id: string,
    atual: TaskDate | undefined,
    salvar: (date: TaskDate | null) => void,
  ) =>
    atual?.form === "instant" ? (
      <input
        id={id}
        type="datetime-local"
        value={localDateTime(atual.value)}
        onChange={(event) =>
          salvar(event.target.value ? { form: "instant", value: new Date(event.target.value).toISOString() } : null)
        }
        className="campo"
      />
    ) : (
      <input
        id={id}
        type="date"
        value={civil(atual)}
        onChange={(event) => salvar(event.target.value ? { form: "civilDay", value: event.target.value } : null)}
        className="campo"
      />
    );

  return (
    <>
      {features.prioridade ? (
      <div className={LINHA}>
        <dt className={ROTULO}>
          <label htmlFor={`${ids}-prioridade`}>Prioridade</label>
        </dt>
        <dd className="w-44">
          <Select
            id={`${ids}-prioridade`}
            value={task.priority}
            onChange={(value) => gravar({ priority: value as Task["priority"] }, "Prioridade alterada.")}
            options={[
              { value: "urgente", label: "Urgente" },
              { value: "alta", label: "Alta" },
              { value: "normal", label: "Normal" },
              { value: "baixa", label: "Baixa" },
              { value: "semPrioridade", label: "Sem prioridade" },
            ]}
          />
        </dd>
      </div>
      ) : null}
      <div className={LINHA}>
        <dt className={ROTULO}>
          <label htmlFor={`${ids}-inicio`}>Data de início</label>
        </dt>
        <dd className="w-52">
          {controleDeData(`${ids}-inicio`, task.startDate, (date) => gravar({ startDate: date }, "Início alterado."))}
        </dd>
      </div>
      <div className={LINHA}>
        <dt className={ROTULO}>
          <label htmlFor={`${ids}-vencimento`}>Data de vencimento</label>
        </dt>
        <dd className="w-52">
          {controleDeData(`${ids}-vencimento`, task.dueDate, (date) => gravar({ dueDate: date }, "Vencimento alterado."))}
        </dd>
      </div>
      {features.estimativa ? (
      <div className={LINHA}>
        <dt className={ROTULO}>
          <label htmlFor={`${ids}-estimativa`}>Estimativa (min)</label>
        </dt>
        <dd className="w-44">
          <input
            id={`${ids}-estimativa`}
            type="number"
            min={0}
            step={15}
            value={estimativa}
            onChange={(event) => setEstimativa(event.target.value)}
            onBlur={() => {
              const atual = task.estimate !== undefined ? String(task.estimate) : "";
              const novo = estimativa === "" ? null : Number(estimativa);
              if (novo === (task.estimate ?? null)) {
                setEstimativa(atual);
                return;
              }
              const ok = gravar({ estimate: novo }, "Estimativa alterada.");
              // Recusado: o campo volta ao que está gravado, não fica com o valor negado.
              if (!ok) setEstimativa(atual);
            }}
            placeholder="—"
            className="campo app-numero"
          />
        </dd>
      </div>
      ) : null}
    </>
  );
}

/** Um Valor de Campo, com o controle certo para o tipo da Definição. */
export function TaskFieldValueEditor({
  task,
  definition,
  report,
}: {
  readonly task: Task;
  readonly definition: FieldDefinition;
  readonly report: Report;
}) {
  const run = useRun();
  const state = useData((data) => data);
  const id = useId();
  const atual = task.fieldValues.find((v) => v.definitionId === definition.id && v.state === "ativo")?.value;
  const [texto, setTexto] = useState(atual === undefined || atual === null ? "" : Array.isArray(atual) ? "" : String(atual));

  const gravar = (value: FieldValue["value"]): boolean => {
    const result = run((data, memberId) => setTaskFieldValue(data, memberId, task.id, definition.id, value));
    report(result, `${definition.name} gravado.`);
    return result.ok;
  };
  const gravarTextoSeMudou = () => {
    const antes = atual === undefined || atual === null ? "" : String(atual);
    if (texto === antes) return;
    const ok =
      definition.type === "number" || definition.type === "currency" || definition.type === "percent"
        ? gravar(texto === "" ? null : Number(texto))
        : gravar(texto === "" ? null : texto);
    // Recusado: o campo volta ao valor gravado.
    if (!ok) setTexto(antes);
  };

  const rotulo = (
    <label htmlFor={id}>
      {definition.name}
      {definition.required ? <span aria-hidden="true"> *</span> : null}
    </label>
  );

  let controle: React.ReactNode;
  switch (definition.type) {
    case "singleSelect":
      controle = (
        <Select
          id={id}
          value={typeof atual === "string" ? atual : ""}
          onChange={(value) => gravar(value || null)}
          placeholder="—"
          options={(definition.options ?? []).map((o) => ({ value: o, label: o }))}
        />
      );
      break;
    case "multiSelect":
      controle = (
        <MultiSelect
          id={id}
          values={Array.isArray(atual) ? atual.map(String) : []}
          onChange={(values) => gravar([...values])}
          placeholder="—"
          options={(definition.options ?? []).map((o) => ({ value: o, label: o }))}
        />
      );
      break;
    case "checkbox":
      controle = (
        <input
          id={id}
          type="checkbox"
          checked={atual === true}
          onChange={(event) => gravar(event.target.checked)}
          className="size-4 accent-[var(--acento)]"
        />
      );
      break;
    case "person":
      controle = (
        <Select
          id={id}
          value={typeof atual === "string" ? atual : ""}
          onChange={(value) => gravar(value || null)}
          searchable
          placeholder="—"
          options={state.members.filter((m) => m.state === "ativo").map((m) => ({ value: m.id, label: m.displayName }))}
        />
      );
      break;
    case "file":
      // Protótipo: o Campo guarda o nome do arquivo escolhido; o conteúdo não sai do navegador.
      controle = (
        <span className="grid gap-1">
          <input
            id={id}
            type="file"
            aria-required={definition.required}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file && gravar(file.name)) setTexto(file.name);
              event.target.value = "";
            }}
            className="app-sm w-full min-w-0 file:mr-2 file:rounded-[var(--r-controle)] file:border file:border-[var(--linha-forte)] file:bg-[var(--superficie-2)] file:px-2 file:py-1 file:text-[var(--texto)]"
            style={{ color: "var(--texto)" }}
          />
          {texto ? (
            <span className="app-meta flex items-center gap-2">
              {texto}
              <button
                type="button"
                onClick={() => {
                  if (gravar(null)) setTexto("");
                }}
                className="underline"
              >
                remover
              </button>
            </span>
          ) : (
            <span className="app-meta">nenhum arquivo</span>
          )}
        </span>
      );
      break;
    case "date":
    case "dateTime":
      controle = (
        <input
          id={id}
          type={definition.type === "date" ? "date" : "datetime-local"}
          value={
            typeof atual === "string"
              ? definition.type === "date"
                ? atual.slice(0, 10)
                : localDateTime(atual)
              : ""
          }
          onChange={(event) =>
            gravar(
              event.target.value
                ? definition.type === "date"
                  ? event.target.value
                  : new Date(event.target.value).toISOString()
                : null,
            )
          }
          className="campo"
        />
      );
      break;
    case "longText":
      controle = (
        <textarea
          id={id}
          value={texto}
          onChange={(event) => setTexto(event.target.value)}
          onBlur={gravarTextoSeMudou}
          rows={3}
          className="campo"
        />
      );
      break;
    default:
      controle = (
        <input
          id={id}
          type={
            definition.type === "number" || definition.type === "currency" || definition.type === "percent"
              ? "number"
              : definition.type === "email"
                ? "email"
                : definition.type === "url"
                  ? "url"
                  : definition.type === "phone"
                    ? "tel"
                    : "text"
          }
          value={texto}
          onChange={(event) => setTexto(event.target.value)}
          onBlur={gravarTextoSeMudou}
          onKeyDown={(event) => {
            if (event.key === "Enter") (event.target as HTMLInputElement).blur();
          }}
          placeholder="—"
          aria-required={definition.required}
          className="campo"
        />
      );
  }

  return (
    <div className={LINHA}>
      {/* O nome do Campo é livre e pode ser longo: aqui o rótulo quebra linha em vez de empurrar o controle para fora do painel. */}
      <dt className="app-meta min-w-0">{rotulo}</dt>
      <dd className={definition.type === "checkbox" ? "shrink-0 pt-1.5" : "w-56 max-w-[60%] shrink-0"}>{controle}</dd>
    </div>
  );
}

/** Tags do Catálogo. */
export function TaskTagsEditor({ task, report, id }: { readonly task: Task; readonly report: Report; readonly id?: string }) {
  const run = useRun();
  const tags = useData((data) => data.tags);
  return (
    <MultiSelect
      {...(id ? { id } : {})}
      values={task.tagIds}
      onChange={(values) => report(run((data, memberId) => setTaskTags(data, memberId, task.id, values)), "Tags atualizadas.")}
      placeholder="sem Tag"
      options={tags.filter((t) => t.lifecycle === "ativo").map((t) => ({ value: t.id, label: t.name }))}
    />
  );
}

/** Acompanhar: quem observa recebe o que acontece sem ser Responsável. */
export function TaskWatchers({ task, report }: { readonly task: Task; readonly report: Report }) {
  const run = useRun();
  const { memberId } = useSession();
  const members = useData((data) => data.members);
  const euObservo = task.observerMemberIds.includes(memberId);
  return (
    <div className="grid gap-2">
      <span>
        <Button
          onClick={() =>
            report(
              run((data, id) => watchTask(data, id, task.id, id, !euObservo)),
              euObservo ? "Você deixou de acompanhar." : "Você passou a acompanhar.",
            )
          }
        >
          {euObservo ? "Deixar de acompanhar" : "Acompanhar"}
        </Button>
      </span>
      <label htmlFor="observadores-da-tarefa" className="sr-only">
        Outros observadores
      </label>
      <MultiSelect
        id="observadores-da-tarefa"
        values={task.observerMemberIds}
        onChange={(values) => {
          const atual = new Set(task.observerMemberIds);
          const novo = new Set(values);
          for (const id of values) if (!atual.has(id)) report(run((data, me) => watchTask(data, me, task.id, id, true)), "Observador adicionado.");
          for (const id of task.observerMemberIds) if (!novo.has(id)) report(run((data, me) => watchTask(data, me, task.id, id, false)), "Observador removido.");
        }}
        placeholder="ninguém observa"
        options={members.filter((m) => m.state === "ativo").map((m) => ({ value: m.id, label: m.displayName }))}
      />
    </div>
  );
}

/** O compositor de Comentário: texto, menções e, quando responde, o fio. */
function CommentComposer({
  task,
  report,
  parentCommentId,
  onDone,
  autoFocus,
}: {
  readonly task: Task;
  readonly report: Report;
  readonly parentCommentId?: string;
  readonly onDone?: () => void;
  readonly autoFocus?: boolean;
}) {
  const run = useRun();
  const members = useData((data) => data.members);
  const [texto, setTexto] = useState("");
  const [mencoes, setMencoes] = useState<readonly string[]>([]);
  const id = useId();

  const enviar = () => {
    const result = run((data, memberId) =>
      addTaskComment(data, memberId, task.id, {
        content: texto,
        ...(parentCommentId ? { parentCommentId } : {}),
        mentions: mencoes.map((m) => ({ type: "member", id: m })),
      }),
    );
    report(result, parentCommentId ? "Resposta enviada." : "Comentário enviado.");
    if (result.ok) {
      setTexto("");
      setMencoes([]);
      onDone?.();
    }
  };

  return (
    <form
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (texto.trim()) enviar();
      }}
    >
      <label htmlFor={id} className="sr-only">
        {parentCommentId ? "Responder" : "Novo comentário"}
      </label>
      <textarea
        id={id}
        value={texto}
        onChange={(event) => setTexto(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && texto.trim()) {
            event.preventDefault();
            enviar();
          }
        }}
        rows={parentCommentId ? 2 : 3}
        autoFocus={autoFocus}
        placeholder={parentCommentId ? "Responder…" : "Escreva um comentário. Ctrl+Enter envia."}
        className="campo"
      />
      <div className="flex flex-wrap items-end gap-2">
        <span className="min-w-56 flex-1">
          <label htmlFor={`${id}-mencoes`} className="sr-only">
            Mencionar alguém
          </label>
          <MultiSelect
            id={`${id}-mencoes`}
            values={mencoes}
            onChange={setMencoes}
            placeholder="Mencionar alguém"
            options={members.filter((m) => m.state === "ativo").map((m) => ({ value: m.id, label: m.displayName }))}
          />
        </span>
        {onDone ? <Button onClick={onDone}>Cancelar</Button> : null}
        <Button
          type="submit"
          variant="primary"
          disabled={texto.trim() === ""}
          disabledReason="Escreva o comentário antes de enviar."
          icon={<Icone de={Send} tamanho="xs" />}
        >
          {parentCommentId ? "Responder" : "Comentar"}
        </Button>
      </div>
    </form>
  );
}

/** Os Comentários em fios: raiz, respostas, resolver. Resolvido recolhe. */
export function TaskComments({
  task,
  report,
  authorLabel,
  readOnly,
}: {
  readonly task: Task;
  readonly report: Report;
  readonly authorLabel: (actor: ActorRef) => string;
  readonly readOnly: boolean;
}) {
  const run = useRun();
  const fmt = useFormat();
  const members = useData((data) => data.members);
  const agentes = useData((data) => data.agents);
  const [respondendo, setRespondendo] = useState<string | null>(null);

  const vivos = task.comments.filter((c) => !c.deletedAt);
  const raizes = vivos.filter((c) => !c.parentCommentId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const respostasDe = (id: string) => vivos.filter((c) => c.parentCommentId === id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const nomeDaMencao = (m: { readonly type: string; readonly id: string }) =>
    m.type === "member" ? (members.find((x) => x.id === m.id)?.displayName ?? m.id) : m.id;

  const resolver = (id: string, resolved: boolean) =>
    report(
      run((data, memberId) => resolveTaskComment(data, memberId, task.id, id, resolved)),
      resolved ? "Fio resolvido." : "Fio reaberto.",
    );

  // Cada Comentário é uma peça de bloco que não clica; a resposta recua à direita.
  const Bolha = ({ comment, resposta }: { readonly comment: (typeof vivos)[number]; readonly resposta?: boolean }) => (
    <div
      id={`comentario-${comment.id}`}
      className={`item-solto scroll-mt-4 ${resposta ? "ml-6" : ""}`}
      data-bloco="true"
      data-estatico="true"
    >
      <p className="app-meta">
        {authorLabel(comment.author)}
        {comment.authorDelegate ? ` · em nome de ${authorLabel(comment.authorDelegate)}` : ""} · {fmt.relative(comment.createdAt)}
        {comment.mentions.length > 0 ? ` · mencionou ${comment.mentions.map(nomeDaMencao).join(", ")}` : ""}
      </p>
      <p className="app-base mt-1 whitespace-pre-wrap" style={{ color: "var(--texto)" }}>
        {comment.content}
      </p>
    </div>
  );

  return (
    <div className="grid gap-4">
      {raizes.length === 0 ? (
        <EmptyState compact title="Nenhum Comentário ainda." />
      ) : (
        <ul className="pilha-solta">
          {raizes.map((raiz) => {
            const respostas = respostasDe(raiz.id);
            const resolvido = raiz.resolved !== undefined;
            return (
              <li key={raiz.id} className="grid gap-2">
                {resolvido ? (
                  <details className="painel px-3 py-2">
                    <summary className="app-meta flex cursor-pointer flex-wrap items-center gap-2">
                      <Icone de={Check} tamanho="xs" style={{ color: "var(--sucesso)" }} />
                      Fio resolvido por {members.find((m) => m.id === raiz.resolved?.by)?.displayName ?? agentes.find((a) => a.id === raiz.resolved?.by)?.name ?? "—"} · {raiz.content.slice(0, 60)}
                      {raiz.content.length > 60 ? "…" : ""}
                      {respostas.length > 0 ? ` · ${respostas.length} resposta(s)` : ""}
                    </summary>
                    <div className="mt-2 grid gap-2">
                      <Bolha comment={raiz} />
                      {respostas.map((r) => <Bolha key={r.id} comment={r} resposta />)}
                      {readOnly ? null : (
                        <span>
                          <Button onClick={() => resolver(raiz.id, false)} icon={<Icone de={RotateCcw} tamanho="xs" />}>
                            Reabrir fio
                          </Button>
                        </span>
                      )}
                    </div>
                  </details>
                ) : (
                  <>
                    <Bolha comment={raiz} />
                    {respostas.map((r) => <Bolha key={r.id} comment={r} resposta />)}
                    {readOnly ? null : respondendo === raiz.id ? (
                      <div className="ml-6">
                        <CommentComposer
                          task={task}
                          report={report}
                          parentCommentId={raiz.id}
                          onDone={() => {
                            setRespondendo(null);
                            // O foco volta ao botão que abriu o compositor, não para o body.
                            window.setTimeout(() => document.getElementById(`responder-${raiz.id}`)?.querySelector("button")?.focus(), 0);
                          }}
                          autoFocus
                        />
                      </div>
                    ) : (
                      <span className="ml-6 flex gap-2">
                        <span id={`responder-${raiz.id}`} className="contents">
                          <Button onClick={() => setRespondendo(raiz.id)} icon={<Icone de={MessageSquareReply} tamanho="xs" />}>
                            Responder
                          </Button>
                        </span>
                        <Button onClick={() => resolver(raiz.id, true)} icon={<Icone de={Check} tamanho="xs" />}>
                          Resolver
                        </Button>
                      </span>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {readOnly ? null : <CommentComposer task={task} report={report} />}
    </div>
  );
}
