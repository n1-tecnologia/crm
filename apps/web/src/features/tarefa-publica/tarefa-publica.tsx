"use client";

/**
 * PARA-05 — a Tarefa por link público, fora do shell e só leitura. Recebe a
 * projeção que o `apps/api` devolveu (`GET /v1/public/tasks/:secret`, a
 * mesma `projecaoPublicaDaTarefa` do domínio) e só a desenha: nenhuma
 * entidade completa, id ou segredo chega aqui.
 *
 * Fora da casca: o cabeçalho num cartão sólido sobre a grade de pontos, e
 * cada parte do agregado (7.7) num painel próprio abaixo.
 */

import type { TarefaPublica } from "@n1/dominio/tarefa-publica";
import { PRIORITY_LABEL } from "@/features/shell/format";
import { useFormat } from "@/features/shell/use-format";
import { CabecalhoDePainel, EmptyState, Painel, Pilula, RecordPanel, RecordRow, ReguaDeSecao } from "@/features/shell/ui";

export function TarefaPublicaView({ tarefa }: { readonly tarefa: TarefaPublica }) {
  const fmt = useFormat();
  return (
    <main className="grade-pontos flex min-h-screen justify-center p-6">
      <div className="grid w-full max-w-2xl content-start gap-3">
        <Painel solido className="p-6">
          <p className="ed-eyebrow">Visualização pública · só leitura</p>
          <h1 className="ed-titulo mt-2">{tarefa.title}</h1>
          <div className="app-base mt-3 flex flex-wrap items-center gap-x-3 gap-y-1" style={{ color: "var(--texto-3)" }}>
            {tarefa.status ? <Pilula cor={tarefa.status.color}>{tarefa.status.name}</Pilula> : null}
            <span>Prioridade: {PRIORITY_LABEL[tarefa.priority] ?? tarefa.priority}</span>
            {tarefa.dueDate ? <span>Vencimento: {fmt.taskDate(tarefa.dueDate)}</span> : null}
            {tarefa.assignees.length > 0 ? <span>Responsáveis: {tarefa.assignees.join(", ")}</span> : null}
          </div>
        </Painel>

        <Painel>
          <CabecalhoDePainel titulo="Descrição" />
          <p className="app-base whitespace-pre-wrap p-4" style={{ color: "var(--texto)" }}>
            {tarefa.description || "—"}
          </p>
        </Painel>

        {tarefa.fields.length > 0 ? (
          <RecordPanel title="Campos" count={tarefa.fields.length}>
            <dl>
              {tarefa.fields.map((v, i) => (
                <RecordRow key={`${v.nome}-${i}`} label={v.nome}>
                  {v.valor}
                </RecordRow>
              ))}
            </dl>
          </RecordPanel>
        ) : null}

        {tarefa.subtasks.length > 0 ? (
          <Painel>
            <CabecalhoDePainel titulo="Subtarefas" contagem={tarefa.subtasks.length} />
            <ul className="pilha-solta p-3">
              {tarefa.subtasks.map((t, i) => (
                <li key={`${t.title}-${i}`} className="item-solto" data-estatico="true" style={{ paddingBlock: "var(--e-2)" }}>
                  <span className="app-base min-w-0 flex-1" style={{ color: "var(--texto)" }}>
                    {t.title}
                  </span>
                  {t.status ? (
                    <Pilula cor={t.status.color} className="shrink-0">
                      {t.status.name}
                    </Pilula>
                  ) : (
                    <span className="app-meta shrink-0">—</span>
                  )}
                </li>
              ))}
            </ul>
          </Painel>
        ) : null}

        {tarefa.checklists.length > 0 ? (
          <Painel>
            <CabecalhoDePainel titulo="Checklists" contagem={tarefa.checklists.length} />
            <div className="grid gap-4 p-3">
              {tarefa.checklists.map((c, ci) => (
                <section key={`${c.name}-${ci}`}>
                  <ReguaDeSecao rotulo={c.name} contagem={c.items.length} />
                  <ul className="pilha-solta">
                    {c.items.map((i, ii) => (
                      <li key={`${i.text}-${ii}`} className="item-solto" data-estatico="true" data-atenuado={i.done ? "true" : undefined} style={{ paddingBlock: "var(--e-2)" }}>
                        <span className="shrink-0" style={{ color: i.done ? "var(--sucesso)" : "var(--texto-4)" }}>
                          {i.done ? "☑" : "☐"}
                        </span>
                        <span className="app-base min-w-0 flex-1" style={{ color: i.done ? "var(--texto-3)" : "var(--texto)", textDecoration: i.done ? "line-through" : undefined }}>
                          {i.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </Painel>
        ) : null}

        {tarefa.attachments ? (
          <Painel>
            <CabecalhoDePainel titulo="Anexos" contagem={tarefa.attachments.length} />
            {tarefa.attachments.length === 0 ? (
              <EmptyState compact title="Nenhum anexo." />
            ) : (
              <ul className="pilha-solta p-3">
                {tarefa.attachments.map((a, i) => (
                  <li key={`${a.displayName}-${i}`} className="item-solto" data-estatico="true" style={{ paddingBlock: "var(--e-2)" }}>
                    <span className="app-base min-w-0 flex-1" style={{ color: "var(--texto)" }}>
                      {a.displayName}
                    </span>
                    <span className="app-meta shrink-0">{a.mediaType}</span>
                  </li>
                ))}
              </ul>
            )}
          </Painel>
        ) : null}

        {tarefa.comments ? (
          <Painel>
            <CabecalhoDePainel titulo="Comentários" contagem={tarefa.comments.length} />
            {tarefa.comments.length === 0 ? (
              <EmptyState compact title="Nenhum comentário." />
            ) : (
              <ul className="pilha-solta p-3">
                {tarefa.comments.map((c, i) => (
                  <li key={`${c.createdAt}-${i}`} className="item-solto" data-bloco="true" data-estatico="true">
                    <p className="app-meta">
                      {c.author} · {fmt.relative(c.createdAt)}
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
