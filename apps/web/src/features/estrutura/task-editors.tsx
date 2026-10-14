"use client";

/**
 * Os editores da Tarefa (Fase 0 da Gestão de Projetos). Cada um chama UMA
 * operação e devolve o resultado ao chamador, que mostra sucesso ou erro —
 * a tela decide onde avisar; o editor só edita.
 */

import { Check, MessageSquareReply, Pencil, RotateCcw, Send, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useData, useRun, useSession } from "@/dados/store";
import { CampoDeArquivo } from "./campo-de-arquivo";
import { useRecente } from "@/features/shell/recente";
import { containerAdminRefusal } from "@n1/dominio/derive";
import { administraOEspaco } from "@n1/dominio/operations/ia/permissoes-ia";
import {
  addTaskComment,
  deleteTaskComment,
  editTaskComment,
  resolveTaskComment,
  setTaskFieldValue,
  setTaskTags,
  updateTask,
  watchTask,
} from "@n1/dominio/operations";
import { useFormat } from "@/features/shell/use-format";
import { ActorAvatar, Button, ConfirmDialog, EmptyState, Field, Icone, MultiSelect, Select, TextArea, TextInput, Toast } from "@/features/shell/ui";
import type { OperationResult } from "@n1/dominio/state";
import type { ActorRef, FieldDefinition, FieldValue, Task, TaskDate } from "@n1/dominio/types";

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

export type AtributoEditavel = "prioridade" | "inicio" | "vencimento" | "estimativa";

export function TaskAttributeEditors({
  task,
  report,
  features,
  apenas,
}: {
  readonly task: Task;
  readonly report: Report;
  readonly features: { readonly prioridade: boolean; readonly estimativa: boolean };
  /** Um controle só, sem rótulo — para a linha compacta da ficha, que já tem o seu. */
  readonly apenas?: AtributoEditavel;
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

  const controlePrioridade = (
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
  );
  const controleInicio = controleDeData(`${ids}-inicio`, task.startDate, (date) => gravar({ startDate: date }, "Início alterado."));
  const controleVencimento = controleDeData(`${ids}-vencimento`, task.dueDate, (date) => gravar({ dueDate: date }, "Vencimento alterado."));
  const controleEstimativa = (
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
  );

  if (apenas === "prioridade") return controlePrioridade;
  if (apenas === "inicio") return controleInicio;
  if (apenas === "vencimento") return controleVencimento;
  if (apenas === "estimativa") return controleEstimativa;

  return (
    <>
      {features.prioridade ? (
        <div className={LINHA}>
          <dt className={ROTULO}>
            <label htmlFor={`${ids}-prioridade`}>Prioridade</label>
          </dt>
          <dd className="w-44">{controlePrioridade}</dd>
        </div>
      ) : null}
      <div className={LINHA}>
        <dt className={ROTULO}>
          <label htmlFor={`${ids}-inicio`}>Data de início</label>
        </dt>
        <dd className="w-52">{controleInicio}</dd>
      </div>
      <div className={LINHA}>
        <dt className={ROTULO}>
          <label htmlFor={`${ids}-vencimento`}>Data de vencimento</label>
        </dt>
        <dd className="w-52">{controleVencimento}</dd>
      </div>
      {features.estimativa ? (
        <div className={LINHA}>
          <dt className={ROTULO}>
            <label htmlFor={`${ids}-estimativa`}>Estimativa (min)</label>
          </dt>
          <dd className="w-44">{controleEstimativa}</dd>
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
  soControle = false,
}: {
  readonly task: Task;
  readonly definition: FieldDefinition;
  readonly report: Report;
  /** Só o controle, sem rótulo — para a linha compacta da ficha. */
  readonly soControle?: boolean;
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
      // Checklist 7.3 — o arquivo sobe de verdade ao Storage; o Campo guarda os ids.
      controle = (
        <CampoDeArquivo
          id={id}
          task={task}
          definition={definition}
          atual={atual}
          gravar={gravar}
          aoEnviar={(nome) => report({ ok: true, value: nome }, `${definition.name}: ${nome} enviado.`)}
        />
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

  if (soControle) return <>{controle}</>;

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
  presoNaBase,
}: {
  readonly task: Task;
  readonly report: Report;
  readonly parentCommentId?: string;
  readonly onDone?: () => void;
  readonly autoFocus?: boolean;
  /** Preso à base da coluna: o menu de menções abre para cima. */
  readonly presoNaBase?: boolean;
}) {
  const run = useRun();
  const members = useData((data) => data.members);
  const [texto, setTexto] = useState("");
  /** Quem foi escolhido pelo "@" — só conta na hora de enviar se o "@Nome" ainda estiver no texto. */
  const [mencoes, setMencoes] = useState<ReadonlyArray<{ readonly id: string; readonly nome: string }>>([]);
  const [caret, setCaret] = useState(0);
  const [sugestaoAtiva, setSugestaoAtiva] = useState(0);
  const [sugestoesFechadas, setSugestoesFechadas] = useState(false);
  const campo = useRef<HTMLTextAreaElement>(null);
  const id = useId();

  // O "@" em curso: o que vem depois do último "@" antes do cursor (até dois
  // espaços — nomes têm sobrenome). Sem "@" em curso, não há menu.
  const arroba = (() => {
    const antes = texto.slice(0, caret);
    const m = /(^|\s)@([^\s@]*(?:\s[^\s@]*){0,2})$/.exec(antes);
    const consulta = m?.[2];
    return consulta !== undefined ? { inicio: antes.length - consulta.length - 1, consulta } : null;
  })();
  const sugestoes = arroba && !sugestoesFechadas
    ? members
        .filter((m) => m.state === "ativo")
        .filter((m) => normalizar(m.displayName).includes(normalizar(arroba.consulta)))
        .slice(0, 6)
    : [];

  const mencionar = (membro: { readonly id: string; readonly displayName: string }) => {
    if (!arroba) return;
    const antes = texto.slice(0, arroba.inicio);
    const depois = texto.slice(caret);
    const novo = `${antes}@${membro.displayName} ${depois}`;
    const novoCaret = antes.length + membro.displayName.length + 2;
    setTexto(novo);
    setMencoes((atual) => (atual.some((m) => m.id === membro.id) ? atual : [...atual, { id: membro.id, nome: membro.displayName }]));
    setCaret(novoCaret);
    setSugestaoAtiva(0);
    // O cursor volta para depois do nome, e o foco continua no campo.
    requestAnimationFrame(() => {
      const el = campo.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      el.setSelectionRange(novoCaret, novoCaret);
    });
  };

  const enviar = () => {
    const result = run((data, memberId) =>
      addTaskComment(data, memberId, task.id, {
        content: texto,
        ...(parentCommentId ? { parentCommentId } : {}),
        mentions: mencoes.filter((m) => texto.includes(`@${m.nome}`)).map((m) => ({ type: "member", id: m.id })),
      }),
    );
    report(result, parentCommentId ? "Resposta enviada." : "Comentário enviado.");
    if (result.ok) {
      setTexto("");
      setMencoes([]);
      setCaret(0);
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
      <div className="relative">
        <textarea
          ref={campo}
          id={id}
          value={texto}
          onChange={(event) => {
            setTexto(event.target.value);
            setCaret(event.target.selectionStart ?? event.target.value.length);
            setSugestaoAtiva(0);
            setSugestoesFechadas(false);
          }}
          onSelect={(event) => setCaret((event.target as HTMLTextAreaElement).selectionStart ?? 0)}
          onKeyDown={(event) => {
            // Com o menu de "@" aberto, as setas e o Enter escolhem; Esc fecha só o menu.
            if (sugestoes.length > 0) {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setSugestaoAtiva((i) => (i + 1) % sugestoes.length);
                return;
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setSugestaoAtiva((i) => (i - 1 + sugestoes.length) % sugestoes.length);
                return;
              }
              if ((event.key === "Enter" && !event.ctrlKey && !event.metaKey) || event.key === "Tab") {
                event.preventDefault();
                const escolhido = sugestoes[sugestaoAtiva];
                if (escolhido) mencionar(escolhido);
                return;
              }
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                setSugestoesFechadas(true);
                return;
              }
            }
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && texto.trim()) {
              event.preventDefault();
              enviar();
            }
          }}
          rows={2}
          autoFocus={autoFocus}
          aria-autocomplete="list"
          aria-controls={sugestoes.length > 0 ? `${id}-sugestoes` : undefined}
          placeholder={parentCommentId ? "Responder…" : "Escreva um comentário. @ menciona alguém. Ctrl+Enter envia."}
          // `block`: como inline, a textarea deixa um vão de linha embaixo e o
          // botão ancorado no pé do invólucro escorrega para fora dela.
          className="campo block"
          // O canto inferior direito é do botão de enviar: o texto não passa por baixo dele.
          style={{ height: "auto", paddingBlock: "var(--e-2)", paddingRight: "var(--controle-h)", resize: "none" }}
        />
        <button
          type="submit"
          aria-label={parentCommentId ? "Responder" : "Enviar"}
          title={texto.trim() === "" ? "Escreva o comentário antes de enviar." : `${parentCommentId ? "Responder" : "Enviar"} (Ctrl+Enter)`}
          disabled={texto.trim() === ""}
          className="btn-icone btn-icone-enviar absolute"
          style={{ right: "var(--e-1)", bottom: "var(--e-1)" }}
        >
          <Icone de={Send} tamanho="xs" />
        </button>
        {sugestoes.length > 0 ? (
          <ul
            id={`${id}-sugestoes`}
            role="listbox"
            aria-label="Pessoas para mencionar"
            className={`flutuante surgir-rapido absolute left-0 z-20 w-full max-w-xs overflow-hidden p-1 ${presoNaBase ? "bottom-full mb-1" : "top-full mt-1"}`}
          >
            {sugestoes.map((membro, index) => (
              <li key={membro.id} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={index === sugestaoAtiva}
                  data-highlighted={index === sugestaoAtiva ? "" : undefined}
                  onMouseEnter={() => setSugestaoAtiva(index)}
                  // pointerdown, não click: o click tiraria o foco do campo antes de escolher.
                  onPointerDown={(event) => {
                    event.preventDefault();
                    mencionar(membro);
                  }}
                  className="item-menu w-full"
                >
                  <ActorAvatar kind="member" name={membro.displayName} />
                  <span className="min-w-0 flex-1 truncate">{membro.displayName}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {onDone ? (
        <div className="flex justify-end">
          <Button size="sm" variant="ghost" onClick={onDone}>
            Cancelar
          </Button>
        </div>
      ) : null}
    </form>
  );
}

/**
 * Os Comentários como CONVERSA: uma coluna de altura fixa em que as mensagens
 * rolam e o compositor fica preso na base — o mesmo desenho da Caixa de
 * Entrada. O que é seu vem à direita no lavado do acento; o dos outros vem à
 * esquerda. Os fios continuam: a resposta recua sob a raiz, "Responder" e
 * "Resolver" ficam sob o último balão do fio, e o fio resolvido recolhe numa
 * linha só.
 */
export function TaskComments({
  task,
  report,
  authorLabel,
  readOnly,
  antes,
  busca = "",
  ocultarComentarios = false,
}: {
  readonly task: Task;
  readonly report: Report;
  readonly authorLabel: (actor: ActorRef) => string;
  readonly readOnly: boolean;
  /** O que vem antes das mensagens na mesma rolagem — a Atividade recolhida. */
  readonly antes?: React.ReactNode;
  /** A busca do cabeçalho da Atividade: só os fios com o termo ficam à mostra. */
  readonly busca?: string;
  /** O filtro "Só atividade" do cabeçalho esconde os Comentários. */
  readonly ocultarComentarios?: boolean;
}) {
  const run = useRun();
  // O Comentário recém-enviado surge; os outros já estão.
  const recente = useRecente();
  const fmt = useFormat();
  const { memberId } = useSession();
  const members = useData((data) => data.members);
  const agentes = useData((data) => data.agents);
  const state = useData((data) => data);
  const [respondendo, setRespondendo] = useState<string | null>(null);
  // FUND-10 — editar em linha e excluir com confirmação (RN-TAR-13).
  const [editando, setEditando] = useState<string | null>(null);
  const [textoEditado, setTextoEditado] = useState("");
  const [excluindo, setExcluindo] = useState<string | null>(null);
  const administra = administraOEspaco(state, memberId) || containerAdminRefusal(state, memberId, "list", task.listId) === undefined;
  const rolagem = useRef<HTMLDivElement>(null);
  // O feedback das ações da conversa fica NA conversa, acima do compositor —
  // um Toast lá no centro da tela ficaria longe de onde a pessoa está.
  const [aviso, setAviso] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const reportar: Report = (result, message) => {
    setAviso(result.ok ? { tone: "success", text: message } : { tone: "error", text: result.error ?? "Não foi possível concluir a operação." });
  };
  void report;

  const vivos = task.comments.filter((c) => !c.deletedAt);
  const termo = normalizar(busca.trim());
  const casa = (c: (typeof vivos)[number]) => termo === "" || normalizar(c.content).includes(termo);
  // Um Comentário raiz excluído que ainda tem respostas vivas fica como marcador, para o fio não perder o encadeamento.
  const raizes = ocultarComentarios
    ? []
    : task.comments
        .filter((c) => !c.parentCommentId)
        .filter((c) => !c.deletedAt || vivos.some((r) => r.parentCommentId === c.id))
        .filter((c) => casa(c) || vivos.some((r) => r.parentCommentId === c.id && casa(r)))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const respostasDe = (id: string) => vivos.filter((c) => c.parentCommentId === id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const nomeDaMencao = (m: { readonly type: string; readonly id: string }) =>
    m.type === "member" ? (members.find((x) => x.id === m.id)?.displayName ?? m.id) : m.id;
  const minha = (c: (typeof vivos)[number]) => c.author.kind === "member" && c.author.id === memberId;

  // A rolagem tem três casos, e a ordem importa:
  //  · na MONTAGEM com #comentario-<id> na URL (link de Notificações), rola até
  //    o comentário — o Next faz isso no layout, e um scrollTop=scrollHeight
  //    passivo depois desfaria;
  //  · chegou comentário RAIZ novo: desce ao fim, como um chat;
  //  · chegou RESPOSTA: rola até ela, sem pular para o fim de um fio alheio.
  //  Remoções não mexem na rolagem.
  const contagemAnterior = useRef<number | null>(null);
  useEffect(() => {
    const el = rolagem.current;
    if (!el) return;
    const anterior = contagemAnterior.current;
    contagemAnterior.current = vivos.length;
    if (anterior === null) {
      const alvo = window.location.hash.startsWith("#comentario-") ? document.getElementById(window.location.hash.slice(1)) : null;
      if (alvo && el.contains(alvo)) alvo.scrollIntoView({ block: "center" });
      else el.scrollTop = el.scrollHeight;
      return;
    }
    if (vivos.length <= anterior) return;
    const novo = [...vivos].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (novo && novo.parentCommentId) document.getElementById(`comentario-${novo.id}`)?.scrollIntoView({ block: "nearest" });
    else el.scrollTop = el.scrollHeight;
  }, [vivos]);

  const resolver = (id: string, resolved: boolean) =>
    reportar(
      run((data, actor) => resolveTaskComment(data, actor, task.id, id, resolved)),
      resolved ? "Fio resolvido." : "Fio reaberto.",
    );
  const salvarEdicao = (id: string) => {
    const result = run((data, actor) => editTaskComment(data, actor, task.id, id, textoEditado));
    reportar(result, "Comentário editado.");
    if (result.ok) setEditando(null);
  };
  const excluir = (id: string) => {
    const comment = task.comments.find((c) => c.id === id);
    reportar(run((data, actor) => deleteTaskComment(data, actor, task.id, id)), comment?.parentCommentId ? "Resposta excluída." : "Comentário excluído.");
    setExcluindo(null);
  };

  // O balão: o seu à direita no acento, o dos outros à esquerda na superfície.
  const Balao = ({ comment, resposta }: { readonly comment: (typeof vivos)[number]; readonly resposta?: boolean }) => {
    const meu = minha(comment);
    const podeMexer = !readOnly && !comment.deletedAt && (meu || administra);
    const emEdicao = editando === comment.id;
    return (
      <div id={`comentario-${comment.id}`} className={`group flex scroll-mt-4 ${meu ? "justify-end" : "justify-start"} ${resposta ? (meu ? "mr-5" : "ml-5") : ""}${comment.id === recente ? " surgir" : ""}`}>
        <div
          className={`min-w-0 max-w-[88%] rounded-[var(--r-painel)] px-3 py-2 ${meu ? "rounded-br-md" : "rounded-bl-md"}`}
          style={{
            background: comment.deletedAt ? "transparent" : meu ? "var(--acento-lavado)" : "var(--superficie-2)",
            border: `1px ${comment.deletedAt ? "dashed" : "solid"} ${meu && !comment.deletedAt ? "var(--linha-acento)" : "var(--linha)"}`,
          }}
        >
          {comment.deletedAt ? (
            <p className="app-base italic" style={{ color: "var(--texto-4)" }}>
              Comentário excluído
            </p>
          ) : emEdicao ? (
            <form
              className="grid gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (textoEditado.trim()) salvarEdicao(comment.id);
              }}
            >
              <label htmlFor={`editar-${comment.id}`} className="sr-only">
                Editar comentário
              </label>
              <TextArea id={`editar-${comment.id}`} value={textoEditado} onChange={setTextoEditado} rows={3} />
              <span className="flex justify-end gap-1">
                <Button size="sm" variant="ghost" onClick={() => setEditando(null)}>
                  Cancelar
                </Button>
                <Button size="sm" variant="primary" type="submit" disabled={textoEditado.trim() === ""} disabledReason="Escreva o comentário antes de salvar.">
                  Salvar
                </Button>
              </span>
            </form>
          ) : (
            <p className="app-base whitespace-pre-wrap break-words" style={{ color: "var(--texto)" }}>
              {comment.content}
            </p>
          )}
          <p className="app-meta mt-1 flex flex-wrap items-center gap-x-1">
            <span>
              {meu ? "Você" : authorLabel(comment.author)}
              {comment.authorDelegate ? ` · em nome de ${authorLabel(comment.authorDelegate)}` : ""} · {fmt.relative(comment.createdAt)}
              {comment.editedAt && !comment.deletedAt ? " · editado" : ""}
              {comment.mentions.length > 0 && !comment.deletedAt ? ` · mencionou ${comment.mentions.map(nomeDaMencao).join(", ")}` : ""}
            </span>
            {podeMexer && !emEdicao ? (
              <span className="ml-auto flex gap-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setTextoEditado(comment.content);
                    setEditando(comment.id);
                  }}
                  aria-label="Editar comentário"
                  title="Editar"
                  className="btn-icone btn-icone-nu"
                >
                  <Icone de={Pencil} tamanho="xs" />
                </button>
                <button type="button" onClick={() => setExcluindo(comment.id)} aria-label="Excluir comentário" title="Excluir" className="btn-icone btn-icone-nu">
                  <Icone de={Trash2} tamanho="xs" />
                </button>
              </span>
            ) : null}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ConfirmDialog
        open={excluindo !== null}
        title="Excluir este comentário?"
        description="Fica o marcador “Comentário excluído” no lugar, para as respostas não perderem o fio. O fato vai ao Registro de Atividade."
        confirmLabel="Excluir"
        destructive
        onConfirm={() => {
          if (excluindo) excluir(excluindo);
        }}
        onCancel={() => setExcluindo(null)}
      />
      <div ref={rolagem} className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3">
        {/* Encostado embaixo, como um chat: o espaço vazio fica em cima. */}
        <div className="flex min-h-full flex-col justify-end gap-4">
        {antes}
        {raizes.length === 0 ? (
          antes ? null : <EmptyState compact title="Nenhum Comentário ainda." hint={readOnly ? undefined : "O que você escrever aqui fica na Tarefa, com autor e hora."} />
        ) : (
          <ol className="grid gap-4">
            {raizes.map((raiz) => {
              const respostas = respostasDe(raiz.id);
              const resolvido = raiz.resolved !== undefined;
              return (
                <li key={raiz.id} className="grid gap-2">
                  {resolvido ? (
                    <details className="painel px-3 py-2">
                      <summary className="app-meta flex cursor-pointer flex-wrap items-center gap-2">
                        <Icone de={Check} tamanho="xs" style={{ color: "var(--sucesso)" }} />
                        Fio resolvido por {members.find((m) => m.id === raiz.resolved?.by)?.displayName ?? agentes.find((a) => a.id === raiz.resolved?.by)?.name ?? "—"} · {raiz.content.slice(0, 48)}
                        {raiz.content.length > 48 ? "…" : ""}
                        {respostas.length > 0 ? ` · ${respostas.length} resposta(s)` : ""}
                      </summary>
                      <div className="mt-2 grid gap-2">
                        <Balao comment={raiz} />
                        {respostas.map((r) => <Balao key={r.id} comment={r} resposta />)}
                        {readOnly ? null : (
                          <span>
                            <Button size="sm" variant="ghost" onClick={() => resolver(raiz.id, false)} icon={<Icone de={RotateCcw} tamanho="xs" />}>
                              Reabrir fio
                            </Button>
                          </span>
                        )}
                      </div>
                    </details>
                  ) : (
                    <>
                      <Balao comment={raiz} />
                      {respostas.map((r) => <Balao key={r.id} comment={r} resposta />)}
                      {readOnly ? null : respondendo === raiz.id ? (
                        <div className="ml-5">
                          <CommentComposer
                            task={task}
                            report={reportar}
                            parentCommentId={raiz.id}
                            onDone={() => {
                              setRespondendo(null);
                              // O foco volta ao botão que abriu o compositor, não para o body.
                              window.setTimeout(() => document.getElementById(`responder-${raiz.id}`)?.querySelector("button")?.focus({ preventScroll: true }), 0);
                            }}
                            autoFocus
                          />
                        </div>
                      ) : (
                        <span className={`flex gap-1 ${minha(respostas.at(-1) ?? raiz) ? "justify-end" : "ml-5"}`}>
                          <span id={`responder-${raiz.id}`} className="contents">
                            <Button size="sm" variant="ghost" onClick={() => setRespondendo(raiz.id)} icon={<Icone de={MessageSquareReply} tamanho="xs" />}>
                              Responder
                            </Button>
                          </span>
                          <Button size="sm" variant="ghost" onClick={() => resolver(raiz.id, true)} icon={<Icone de={Check} tamanho="xs" />}>
                            Resolver
                          </Button>
                        </span>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        </div>
      </div>
      {readOnly ? (
        <p className="app-meta shrink-0 px-3 py-2" style={{ borderTop: "1px solid var(--linha)" }}>
          Você não comenta nesta Tarefa.
        </p>
      ) : (
        // A doca do robô flutuante, no modo "acima": a coluna é estreita (~300 px)
        // e o recuo do robô a espremeria; ele sobe acima da barra, e a lista de
        // comentários, que passa a ficar sob ele, ganha a reserva no fim.
        <div className="doca-do-robo shrink-0 p-3" data-robo="acima" style={{ borderTop: "1px solid var(--linha)" }}>
          {aviso ? (
            <div className="mb-2">
              <Toast tone={aviso.tone} onDismiss={() => setAviso(null)}>
                {aviso.text}
              </Toast>
            </div>
          ) : null}
          <CommentComposer task={task} report={reportar} presoNaBase />
        </div>
      )}
    </div>
  );
}

/** Sem acento e em minúsculas, para o "@" achar "Galvão" por "galvao". */
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR");
}
