"use client";

/**
 * Fase 4 — Tarefa por link público, fora do shell e só leitura. Abre enquanto
 * o segredo estiver ativo; revogar o link fecha esta página na hora.
 *
 * Fora da casca: o cabeçalho da Tarefa num cartão sólido sobre a grade de
 * pontos, e cada parte do agregado (7.7) num painel próprio abaixo.
 */

import { use } from "react";
import { Link2Off } from "lucide-react";
import { useData } from "@/dados/store";
import { useHidratado } from "@/features/shell/app-shell";
import { taskByPublicSecret } from "@n1/dominio/operations";
import { statusDefinition } from "@n1/dominio/derive";
import { PRIORITY_LABEL } from "@/features/shell/format";
import { useFormat } from "@/features/shell/use-format";
import { CabecalhoDePainel, EmptyState, Icone, Painel, Pilula, RecordPanel, RecordRow, ReguaDeSecao } from "@/features/shell/ui";

export default function TarefaPublicaPage({ params }: { params: Promise<{ segredo: string }> }) {
  const { segredo } = use(params);
  const state = useData((data) => data);
  const fmt = useFormat();
  const pronto = useHidratado();
  if (!pronto) return null;

  const task = taskByPublicSecret(state, segredo);
  if (!task || !task.publicShare) {
    return (
      <main className="grade-pontos flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <Painel solido className="p-6">
            <EmptyState
              icon={<Icone de={Link2Off} tamanho="lg" />}
              title="Link indisponível"
              hint="Este link foi revogado ou não existe. Peça um novo a quem o enviou."
            />
          </Painel>
        </div>
      </main>
    );
  }
  const definition = statusDefinition(state, task.listId, task.statusId);
  const nomeDe = (id: string) => state.members.find((m) => m.id === id)?.displayName ?? state.agents.find((a) => a.id === id)?.name ?? id;
  const comentarios = task.publicShare.showsComments ? task.comments.filter((c) => !c.deletedAt) : [];
  // 7.7 — o compartilhamento expõe o agregado da Tarefa: Subtarefas e Valores de Campo inclusive.
  const subtarefas = state.tasks.filter((t) => t.parentTaskId === task.id && t.lifecycle === "ativo").sort((a, b) => a.siblingOrder - b.siblingOrder);
  const valores = task.fieldValues
    .filter((v) => v.state === "ativo")
    .map((v) => ({ nome: state.fieldDefinitions.find((d) => d.id === v.definitionId)?.name ?? v.definitionId, valor: Array.isArray(v.value) ? v.value.join(", ") : String(v.value ?? "—") }));
  const anexos = task.publicShare.showsAttachments ? task.attachments : [];

  return (
    <main className="grade-pontos flex min-h-screen justify-center p-6">
      <div className="grid w-full max-w-2xl content-start gap-3">
        {/* O cabeçalho do registro: sobre-título, título e a linha de atributos. */}
        <Painel solido className="p-6">
          <p className="ed-eyebrow">Visualização pública · só leitura</p>
          <h1 className="ed-titulo mt-2">{task.title}</h1>
          <div className="app-base mt-3 flex flex-wrap items-center gap-x-3 gap-y-1" style={{ color: "var(--texto-3)" }}>
            {definition ? (
              <Pilula cor={definition.color} comPonto>
                {definition.name}
              </Pilula>
            ) : null}
            <span>Prioridade: {PRIORITY_LABEL[task.priority] ?? task.priority}</span>
            {task.dueDate ? <span>Vencimento: {fmt.taskDate(task.dueDate)}</span> : null}
            {task.assignees.length > 0 ? <span>Responsáveis: {task.assignees.map((a) => nomeDe(a.id)).join(", ")}</span> : null}
          </div>
        </Painel>

        <Painel>
          <CabecalhoDePainel titulo="Descrição" />
          <p className="app-base whitespace-pre-wrap p-4" style={{ color: "var(--texto)" }}>
            {task.description || "—"}
          </p>
        </Painel>

        {valores.length > 0 ? (
          <RecordPanel title="Campos" count={valores.length}>
            <dl>
              {valores.map((v) => (
                <RecordRow key={v.nome} label={v.nome}>
                  {v.valor}
                </RecordRow>
              ))}
            </dl>
          </RecordPanel>
        ) : null}

        {subtarefas.length > 0 ? (
          <Painel>
            <CabecalhoDePainel titulo="Subtarefas" contagem={subtarefas.length} />
            <ul className="pilha-solta p-3">
              {subtarefas.map((t) => {
                const d = statusDefinition(state, t.listId, t.statusId);
                return (
                  <li key={t.id} className="item-solto" data-estatico="true" style={{ paddingBlock: "var(--e-2)" }}>
                    <span className="app-base min-w-0 flex-1" style={{ color: "var(--texto)" }}>
                      {t.title}
                    </span>
                    {d ? (
                      <Pilula cor={d.color} comPonto className="shrink-0">
                        {d.name}
                      </Pilula>
                    ) : (
                      <span className="app-meta shrink-0">—</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </Painel>
        ) : null}

        {task.checklists.length > 0 ? (
          <Painel>
            <CabecalhoDePainel titulo="Checklists" contagem={task.checklists.length} />
            <div className="grid gap-4 p-3">
              {task.checklists.map((c) => {
                const itens = c.items.filter((i) => !i.converted);
                return (
                  <section key={c.id}>
                    <ReguaDeSecao rotulo={c.name} contagem={itens.length} />
                    <ul className="pilha-solta">
                      {itens.map((i) => (
                        <li
                          key={i.id}
                          className="item-solto"
                          data-estatico="true"
                          data-atenuado={i.done ? "true" : undefined}
                          style={{ paddingBlock: "var(--e-2)" }}
                        >
                          <span className="shrink-0" style={{ color: i.done ? "var(--sucesso)" : "var(--texto-4)" }}>
                            {i.done ? "☑" : "☐"}
                          </span>
                          <span
                            className="app-base min-w-0 flex-1"
                            style={{ color: i.done ? "var(--texto-3)" : "var(--texto)", textDecoration: i.done ? "line-through" : undefined }}
                          >
                            {i.text}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          </Painel>
        ) : null}

        {task.publicShare.showsAttachments ? (
          <Painel>
            <CabecalhoDePainel titulo="Anexos" contagem={anexos.length} />
            {anexos.length === 0 ? (
              <EmptyState compact title="Nenhum anexo." />
            ) : (
              <ul className="pilha-solta p-3">
                {anexos.map((a) => (
                  <li key={a.fileId} className="item-solto" data-estatico="true" style={{ paddingBlock: "var(--e-2)" }}>
                    <span className="app-base min-w-0 flex-1" style={{ color: "var(--texto)" }}>
                      {a.displayName ?? a.fileId}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Painel>
        ) : null}

        {task.publicShare.showsComments ? (
          <Painel>
            <CabecalhoDePainel titulo="Comentários" contagem={comentarios.length} />
            {comentarios.length === 0 ? (
              <EmptyState compact title="Nenhum comentário." />
            ) : (
              <ul className="pilha-solta p-3">
                {comentarios.map((c) => (
                  <li key={c.id} className="item-solto" data-bloco="true" data-estatico="true">
                    <p className="app-meta">
                      {nomeDe(c.author.id)} · {fmt.relative(c.createdAt)}
                    </p>
                    <p className="app-base mt-1 whitespace-pre-wrap" style={{ color: "var(--texto)" }}>
                      {c.content}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Painel>
        ) : null}
      </div>
    </main>
  );
}
