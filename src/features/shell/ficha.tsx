"use client";

/**
 * AS PEÇAS DA FICHA NO FORMATO DA TAREFA que Empresa, Grupo, Comunidade e
 * Flow compartilham: os editores de uma linha (texto que grava ao sair,
 * identificador que acrescenta com Enter), as notas do registro como
 * conversa, o Registro de Atividade recolhido, o aside inteiro à direita e
 * os dois avisos (sucesso e erro) com o `report` que os alimenta.
 *
 * Nasceram no popup da Empresa e subiram para cá quando a terceira ficha
 * precisou das mesmas peças: três cópias derivariam em três comportamentos.
 */

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { History, Send } from "lucide-react";
import type { DataState, OperationResult } from "@/data/state";
import { useData, useRun, useSession } from "@/data/store";
import { consumirChegada, lerChegada, useRecente } from "@/features/shell/recente";
import { actorLabel, newestFirst } from "@/data/derive";
import type { ActivityRecord, ActorRef, Comment, Id } from "@/data/types";
import { useFormat } from "@/features/shell/use-format";
import { CabecalhoDePainel, EmptyState, Icone, TextInput, Toast } from "@/features/shell/ui";

export type Report = (result: { ok: boolean; error?: string }, message: string) => void;

/**
 * Os dois avisos da ficha e o `report` que decide qual acende. A tela que
 * abre no endereço de uma chegada marcada ("Criar e abrir", `recente.ts`)
 * nasce com o Toast de sucesso dessa mensagem: a leitura é pura, no estado
 * inicial; o consumo é efeito.
 */
export function useAvisos(): { readonly avisos: ReactNode; readonly report: Report } {
  const pathname = usePathname();
  const [notice, setNotice] = useState<string | null>(() => lerChegada(pathname));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    consumirChegada(pathname);
  }, [pathname]);
  // Cada `report` é um aviso novo, mesmo com o texto igual: a chave remonta o Toast (entra e conta de novo).
  const [serie, setSerie] = useState(0);
  const report: Report = (result, message) => {
    setSerie((n) => n + 1);
    if (result.ok) {
      setError(null);
      setNotice(message);
    } else {
      setNotice(null);
      setError(result.error ?? "Não foi possível concluir a operação.");
    }
  };
  const avisos = (
    <>
      {notice ? (
        <Toast key={`ok-${serie}`} tone="success" onDismiss={() => setNotice(null)}>
          {notice}
        </Toast>
      ) : null}
      {error ? (
        <Toast key={`erro-${serie}`} tone="error" onDismiss={() => setError(null)}>
          {error}
        </Toast>
      ) : null}
    </>
  );
  return { avisos, report };
}

/** Um campo de texto que grava ao sair (Enter ou blur) — o editor de uma linha da ficha. */
export function EditorDeTexto({ valor, onSave, placeholder }: { readonly valor: string; readonly onSave: (valor: string) => void; readonly placeholder?: string }) {
  const [texto, setTexto] = useState(valor);
  const gravarSeMudou = () => {
    if (texto.trim() !== valor.trim()) onSave(texto);
  };
  return (
    <span
      className="block w-full max-w-md"
      onBlur={gravarSeMudou}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          gravarSeMudou();
        }
      }}
    >
      <TextInput value={texto} onChange={setTexto} {...(placeholder ? { placeholder } : {})} size="sm" />
    </span>
  );
}

/** Um número que grava ao sair; vazio grava `undefined`. */
export function EditorDeNumero({ valor, onSave, placeholder }: { readonly valor: number | undefined; readonly onSave: (valor: number | undefined) => void; readonly placeholder?: string }) {
  const [texto, setTexto] = useState(valor === undefined ? "" : String(valor));
  const gravarSeMudou = () => {
    const n = texto.trim() === "" ? undefined : Number(texto);
    if (n !== undefined && !Number.isFinite(n)) return;
    if (n !== valor) onSave(n);
  };
  return (
    <span
      className="block w-40"
      onBlur={gravarSeMudou}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          gravarSeMudou();
        }
      }}
    >
      <TextInput value={texto} onChange={setTexto} {...(placeholder ? { placeholder } : {})} size="sm" type="number" />
    </span>
  );
}

/** Acrescenta um identificador: Enter grava. */
export function EditorDeIdentificador({ placeholder, onAdd }: { readonly placeholder: string; readonly onAdd: (valor: string) => void }) {
  const [texto, setTexto] = useState("");
  return (
    <span
      className="block w-full max-w-md"
      onKeyDown={(event) => {
        if (event.key === "Enter" && texto.trim()) {
          event.preventDefault();
          onAdd(texto);
          setTexto("");
        }
      }}
    >
      <TextInput value={texto} onChange={setTexto} placeholder={`${placeholder} — Enter acrescenta`} size="sm" />
    </span>
  );
}

/** O nome de quem agiu: Membro, Agente, Automação, Integração ou o Sistema — o `actorLabel` do domínio, ligado ao store. */
export function useNomeDoAtor(): (actor: ActorRef) => string {
  const state = useData((data) => data);
  return (actor) => actorLabel(state, actor);
}

/** O Registro de Atividade recolhido, em cima das notas. */
export function RegistroRecolhido({ activity, authorLabel, vazio }: { readonly activity: readonly ActivityRecord[]; readonly authorLabel: (actor: ActorRef) => string; readonly vazio: string }) {
  const fmt = useFormat();
  return (
    <details className="mb-3 rounded-[var(--r-painel)] px-3 py-2" style={{ background: "var(--superficie-1)", border: "1px solid var(--linha)" }}>
      <summary className="app-meta flex cursor-pointer items-center gap-2">
        <Icone de={History} tamanho="xs" />
        Registro de Atividade
        <span className="app-numero">{activity.length}</span>
      </summary>
      <div className="mt-2">
        {activity.length === 0 ? (
          <EmptyState compact title={vazio} />
        ) : (
          <ol className="grid gap-2">
            {newestFirst(activity).map((record) => (
              <li key={record.id} className="app-sm" style={{ color: "var(--texto-2)" }}>
                <span style={{ color: record.result === "failed" || record.result === "denied" ? "var(--erro)" : "var(--texto)" }}>{record.action}</span>
                {record.before !== undefined || record.after !== undefined ? (
                  <span className="app-meta"> · {record.before ?? "—"} → {record.after ?? "—"}</span>
                ) : null}
                {record.detail ? <span className="app-meta block">{record.detail}</span> : null}
                <span className="app-meta block">
                  {authorLabel(record.actor)} · {fmt.relative(record.at)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </details>
  );
}

/** As notas de um registro como conversa: balões e o compositor preso à base. */
export function NotasDoRegistro({
  comments,
  onAdd,
  editavel,
  authorLabel,
  report,
  antes,
  vazioDica,
}: {
  readonly comments: readonly Comment[];
  /** A operação que grava a nota; `undefined` = este registro não aceita notas. */
  readonly onAdd: (texto: string) => OperationResult<unknown>;
  readonly editavel: boolean;
  readonly authorLabel: (actor: ActorRef) => string;
  readonly report: Report;
  readonly antes?: ReactNode;
  readonly vazioDica?: string;
}) {
  const { memberId } = useSession();
  const fmt = useFormat();
  const [texto, setTexto] = useState("");
  // A nota recém-gravada surge; as outras já estão.
  const recente = useRecente();
  const rolagem = useRef<HTMLDivElement>(null);
  const notas = [...comments].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  // Nota nova: a conversa desce ao fim.
  const contagemAnterior = useRef(notas.length);
  useEffect(() => {
    const el = rolagem.current;
    if (el && notas.length > contagemAnterior.current) el.scrollTop = el.scrollHeight;
    contagemAnterior.current = notas.length;
  }, [notas.length]);

  const enviar = () => {
    if (!texto.trim()) return;
    const r = onAdd(texto);
    report(r, "Nota registrada.");
    if (r.ok) setTexto("");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={rolagem} className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3">
        {antes}
        {notas.length === 0 ? (
          <EmptyState compact title="Nenhuma nota ainda." hint={editavel ? (vazioDica ?? "O que você escrever aqui fica no registro, com autor e hora — não sai da plataforma.") : undefined} />
        ) : (
          <ol className="grid gap-3">
            {notas.map((nota) => {
              const minha = nota.author.kind === "member" && nota.author.id === memberId;
              return (
                <li key={nota.id} className={`flex ${minha ? "justify-end" : "justify-start"}${nota.id === recente ? " surgir" : ""}`}>
                  <div
                    className={`min-w-0 max-w-[88%] rounded-[var(--r-painel)] px-3 py-2 ${minha ? "rounded-br-md" : "rounded-bl-md"}`}
                    style={{ background: minha ? "var(--acento-lavado)" : "var(--superficie-2)", border: `1px solid ${minha ? "var(--linha-acento)" : "var(--linha)"}` }}
                  >
                    <p className="app-base whitespace-pre-wrap break-words" style={{ color: "var(--texto)" }}>
                      {nota.content}
                    </p>
                    <p className="app-meta mt-1">
                      {minha ? "Você" : authorLabel(nota.author)} · {fmt.relative(nota.createdAt)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
      {editavel ? (
        <form
          className="shrink-0 p-3"
          style={{ borderTop: "1px solid var(--linha)" }}
          onSubmit={(event) => {
            event.preventDefault();
            enviar();
          }}
        >
          <div className="relative">
            <textarea
              value={texto}
              onChange={(event) => setTexto(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault();
                  enviar();
                }
              }}
              rows={2}
              placeholder="Escreva uma nota interna. Ctrl+Enter envia."
              aria-label="Nova nota"
              className="campo block"
              style={{ height: "auto", paddingBlock: "var(--e-2)", paddingRight: "var(--controle-h)", resize: "none" }}
            />
            <button
              type="submit"
              aria-label="Enviar"
              title={texto.trim() === "" ? "Escreva a nota antes de enviar." : "Enviar (Ctrl+Enter)"}
              disabled={texto.trim() === ""}
              className="btn-icone btn-icone-enviar absolute"
              style={{ right: "var(--e-1)", bottom: "var(--e-1)" }}
            >
              <Icone de={Send} tamanho="xs" />
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

/**
 * O ASIDE À DIREITA da ficha: o cabeçalho "Atividade" com a contagem, o
 * Registro recolhido e as notas como conversa. Empilha abaixo do corpo
 * quando o contêiner é estreito (`@4xl`).
 */
export function AsideDeAtividade({
  comments,
  activity,
  onAddNote,
  editavel,
  authorLabel,
  report,
  vazioDoRegistro,
  vazioDica,
}: {
  readonly comments: readonly Comment[];
  readonly activity: readonly ActivityRecord[];
  readonly onAddNote: (texto: string) => OperationResult<unknown>;
  readonly editavel: boolean;
  readonly authorLabel: (actor: ActorRef) => string;
  readonly report: Report;
  readonly vazioDoRegistro: string;
  readonly vazioDica?: string;
}) {
  return (
    <aside
      className="flex min-h-0 w-full shrink-0 flex-col max-h-[var(--conversa-empilhada-h)] @4xl:w-[26rem] @4xl:max-h-none"
      style={{ borderLeft: "1px solid var(--linha)", background: "var(--superficie-rebaixada)" }}
    >
      <CabecalhoDePainel titulo="Atividade" contagem={comments.length + activity.length} className="shrink-0" />
      <NotasDoRegistro
        comments={comments}
        onAdd={onAddNote}
        editavel={editavel}
        authorLabel={authorLabel}
        report={report}
        {...(vazioDica ? { vazioDica } : {})}
        antes={<RegistroRecolhido activity={activity} authorLabel={authorLabel} vazio={vazioDoRegistro} />}
      />
    </aside>
  );
}

/** Um `useRun` já ligado ao `report`: `agir((data, me) => op(...), "mensagem")`. */
export function useAgir(report: Report): <T>(operation: (data: DataState, me: Id) => OperationResult<T>, mensagem: string) => OperationResult<T> {
  const run = useRun();
  return (operation, mensagem) => {
    const r = run(operation);
    report(r, mensagem);
    return r;
  };
}
