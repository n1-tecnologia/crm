"use client";

/**
 * Fase 4 — Metas. Alvo por Tarefas concluídas (ligadas à Meta) ou por métrica
 * (a mesma leitura de um Widget). O progresso é derivado a cada leitura,
 * nunca gravado — e é lido pelas permissões de quem olha.
 */

import Link from "next/link";
import { useState } from "react";
import { useData, useRun, useSession } from "@/data/store";
import { archiveGoal, createGoal, linkTaskToGoal, setGoalArchived, updateGoal } from "@/data/operations";
import { goalProgress, memberReachesContainer, memberSeesTask } from "@/data/derive";
import { useFormat } from "@/features/shell/use-format";
import { ActionMenu, Button, ConfirmDialog, CorpoDeTela, EmptyState, Field, PageHeader, Section, Select, TextInput, Toast } from "@/features/shell/ui";
import type { Goal } from "@/data/types";

export default function MetasPage() {
  const state = useData((data) => data);
  const run = useRun();
  const fmt = useFormat();
  const { memberId } = useSession();
  const [now] = useState(() => new Date());
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [arquivando, setArquivando] = useState<string | null>(null);
  const [ligando, setLigando] = useState<string | null>(null);
  const [editando, setEditando] = useState<Goal | null>(null);
  const [edicao, setEdicao] = useState({ name: "", target: "", unit: "", dueDate: "" });
  const [desligando, setDesligando] = useState<{ goalId: string; taskId: string } | null>(null);
  const [tarefaEscolhida, setTarefaEscolhida] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [novo, setNovo] = useState({ name: "", anchor: "", kind: "tarefasConcluidas" as Goal["kind"], target: "", unit: "", scope: "", aggregation: "contagem" as "contagem" | "soma", dueDate: "" });

  const report = (result: { ok: boolean; error?: string }, message: string) => {
    if (result.ok) {
      setError(null);
      setNotice(message);
    } else {
      setNotice(null);
      setError(result.error ?? "Não foi possível concluir a operação.");
    }
  };

  const base = state.roles.find((r) => r.id === state.members.find((m) => m.id === memberId)?.roleId)?.base;
  const admin = base === "proprietario" || base === "administrador";
  const convidado = base === "convidado";
  const alcancadas = state.goals.filter((g) => memberReachesContainer(state, memberId, g.anchor.type, g.anchor.id));
  const metas = alcancadas.filter((g) => g.lifecycle === "ativo");
  const arquivadas = alcancadas.filter((g) => g.lifecycle === "arquivado");
  const contêineres = [
    ...state.spaces.filter((c) => c.lifecycle === "ativo").map((c) => ({ value: `space:${c.id}`, label: c.name, detail: "Espaço" })),
    ...state.folders.filter((c) => c.lifecycle === "ativo").map((c) => ({ value: `folder:${c.id}`, label: c.name, detail: "Pasta" })),
    ...state.lists.filter((c) => c.lifecycle === "ativo").map((c) => ({ value: `list:${c.id}`, label: c.name, detail: "Lista" })),
  ].filter((o) => {
    const [type, id] = o.value.split(":") as ["space" | "folder" | "list", string];
    return memberReachesContainer(state, memberId, type, id);
  });
  const nomeDe = (anchor: Goal["anchor"]) =>
    (anchor.type === "space" ? state.spaces : anchor.type === "folder" ? state.folders : state.lists).find((c) => c.id === anchor.id)?.name ?? anchor.id;
  const hrefDe = (anchor: Goal["anchor"]) => `/estrutura/${anchor.type === "space" ? "espacos" : anchor.type === "folder" ? "pastas" : "listas"}/${anchor.id}`;
  const aArquivar = metas.find((g) => g.id === arquivando);
  const aLigar = metas.find((g) => g.id === ligando);
  const alvoNumero = Number(novo.target);
  const valido = novo.name.trim() !== "" && novo.anchor !== "" && Number.isFinite(alvoNumero) && alvoNumero > 0 && (novo.kind === "tarefasConcluidas" || novo.scope !== "");
  const motivo = !novo.name.trim() ? "Dê um nome à Meta." : novo.anchor === "" ? "Escolha onde a Meta vive." : !(alvoNumero > 0) ? "O alvo é um número maior que zero." : novo.scope === "" ? "Escolha o recorte da métrica." : "";

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Metas"
        meta={`${metas.length} ${metas.length === 1 ? "Meta ativa" : "Metas ativas"}`}
        actions={
          <Button variant="primary" onClick={() => setCriando(true)} disabled={convidado} disabledReason="Um Convidado não cria Meta.">
            Nova Meta
          </Button>
        }
      />
      <CorpoDeTela>
        {notice ? <Toast tone="success" onDismiss={() => setNotice(null)}>{notice}</Toast> : null}
        {error ? <Toast tone="error" onDismiss={() => setError(null)}>{error}</Toast> : null}

        <ConfirmDialog
          open={criando}
          title="Nova Meta"
          description="Por Tarefas concluídas, você liga as Tarefas depois; por métrica, a Meta conta ou soma registros do recorte escolhido."
          confirmLabel="Criar Meta"
          wide
          {...(valido ? {} : { confirmDisabledReason: motivo })}
          onConfirm={() => {
            const [type, id] = novo.anchor.split(":") as ["space" | "folder" | "list", string];
            const [scopeType, scopeId] = novo.scope.split(":") as ["space" | "folder" | "list", string];
            const result = run((data, me) =>
              createGoal(data, me, {
                name: novo.name,
                anchor: { type, id },
                kind: novo.kind,
                target: alvoNumero,
                unit: novo.unit,
                ...(novo.kind === "metrica" ? { measure: { target: "task", scopeType, scopeIds: [scopeId], aggregation: novo.aggregation, attribute: novo.aggregation === "soma" ? "estimate" : "id" } } : {}),
                ...(novo.dueDate ? { dueDate: novo.dueDate } : {}),
              }),
            );
            if (result.ok) {
              report(result, `Meta “${novo.name.trim()}” criada.`);
              setCriando(false);
              setErro(null);
              setNovo({ name: "", anchor: "", kind: "tarefasConcluidas", target: "", unit: "", scope: "", aggregation: "contagem", dueDate: "" });
            } else {
              setErro(result.error);
            }
          }}
          onCancel={() => {
            setCriando(false);
            setErro(null);
          }}
        >
          {erro ? <p role="alert" className="app-base rounded-[var(--r-controle)] px-3 py-2" style={{ background: "var(--erro-lavado)", color: "var(--erro)" }}>{erro}</p> : null}
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Nome">{(id) => <TextInput id={id} value={novo.name} onChange={(name) => setNovo({ ...novo, name })} placeholder="Ex.: Entregar 10 propostas" />}</Field>
            <Field label="Onde vive" hint="O Painel deste contêiner mostra a Meta.">
              {(id) => <Select id={id} value={novo.anchor} onChange={(anchor) => setNovo({ ...novo, anchor })} searchable placeholder="Escolher" options={contêineres} />}
            </Field>
            <Field label="Tipo">
              {(id) => (
                <Select
                  id={id}
                  value={novo.kind}
                  onChange={(kind) => setNovo({ ...novo, kind: kind as Goal["kind"] })}
                  options={[
                    { value: "tarefasConcluidas", label: "Tarefas concluídas (ligadas à Meta)" },
                    { value: "metrica", label: "Métrica (contagem ou soma de Tarefas)" },
                  ]}
                />
              )}
            </Field>
            <Field label="Alvo">{(id) => <TextInput id={id} value={novo.target} onChange={(target) => setNovo({ ...novo, target })} type="number" placeholder="Ex.: 10" />}</Field>
            {novo.kind === "metrica" ? (
              <>
                <Field label="O que ler">
                  {(id) => (
                    <Select
                      id={id}
                      value={novo.aggregation}
                      onChange={(aggregation) => setNovo({ ...novo, aggregation: aggregation as "contagem" | "soma" })}
                      options={[
                        { value: "contagem", label: "Contagem de Tarefas ativas" },
                        { value: "soma", label: "Soma das estimativas (min)" },
                      ]}
                    />
                  )}
                </Field>
                <Field label="Recorte">{(id) => <Select id={id} value={novo.scope} onChange={(scope) => setNovo({ ...novo, scope })} searchable placeholder="Escolher" options={contêineres} />}</Field>
              </>
            ) : null}
            <Field label="Unidade">{(id) => <TextInput id={id} value={novo.unit} onChange={(unit) => setNovo({ ...novo, unit })} placeholder="Opcional, ex.: propostas" />}</Field>
            <Field label="Data-limite">
              {(id) => (
                <input
                  id={id}
                  type="date"
                  value={novo.dueDate}
                  onChange={(event) => setNovo({ ...novo, dueDate: event.target.value })}
                  className="campo"
                />
              )}
            </Field>
          </div>
        </ConfirmDialog>

        <ConfirmDialog
          open={editando !== null}
          title={`Editar “${editando?.name ?? ""}”`}
          description="Nome, alvo, unidade e data-limite. O tipo e o recorte não mudam: crie outra Meta para isso."
          confirmLabel="Salvar"
          {...(edicao.name.trim() === "" ? { confirmDisabledReason: "Dê um nome à Meta." } : !(Number(edicao.target) > 0) ? { confirmDisabledReason: "O alvo é um número maior que zero." } : {})}
          onConfirm={() => {
            if (!editando) return;
            const result = run((data, me) => updateGoal(data, me, editando.id, { name: edicao.name, target: Number(edicao.target), unit: edicao.unit, dueDate: edicao.dueDate }));
            if (result.ok) {
              report(result, "Meta alterada.");
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
          {erro ? <p role="alert" className="app-base rounded-[var(--r-controle)] px-3 py-2" style={{ background: "var(--erro-lavado)", color: "var(--erro)" }}>{erro}</p> : null}
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Nome">{(id) => <TextInput id={id} value={edicao.name} onChange={(name) => setEdicao({ ...edicao, name })} />}</Field>
            <Field label="Alvo">{(id) => <TextInput id={id} value={edicao.target} onChange={(target) => setEdicao({ ...edicao, target })} type="number" />}</Field>
            <Field label="Unidade">{(id) => <TextInput id={id} value={edicao.unit} onChange={(unit) => setEdicao({ ...edicao, unit })} placeholder="Opcional" />}</Field>
            <Field label="Data-limite">
              {(id) => (
                <input
                  id={id}
                  type="date"
                  value={edicao.dueDate}
                  onChange={(event) => setEdicao({ ...edicao, dueDate: event.target.value })}
                  className="campo"
                />
              )}
            </Field>
          </div>
        </ConfirmDialog>

        <ConfirmDialog
          open={desligando !== null}
          title="Desligar a Tarefa da Meta?"
          description="Ela deixa de contar para o progresso. Dá para ligar de novo depois."
          confirmLabel="Desligar"
          destructive
          onConfirm={() => {
            if (desligando) report(run((data, me) => linkTaskToGoal(data, me, desligando.goalId, desligando.taskId, false)), "Tarefa desligada da Meta.");
            setDesligando(null);
          }}
          onCancel={() => setDesligando(null)}
        />

        <ConfirmDialog
          open={arquivando !== null}
          title={`Arquivar a Meta “${aArquivar?.name ?? ""}”?`}
          description="Ela sai das Metas ativas e do Painel; fica em “Arquivadas”, de onde dá para restaurar. As Tarefas ligadas não mudam."
          confirmLabel="Arquivar"
          destructive
          onConfirm={() => {
            if (arquivando) report(run((data, me) => archiveGoal(data, me, arquivando)), "Meta arquivada.");
            setArquivando(null);
          }}
          onCancel={() => setArquivando(null)}
        />

        <ConfirmDialog
          open={ligando !== null}
          title={`Ligar Tarefa à Meta “${aLigar?.name ?? ""}”`}
          description="Só Tarefas ativas que você vê. Concluí-las conta para a Meta."
          confirmLabel="Ligar"
          {...(tarefaEscolhida === "" ? { confirmDisabledReason: "Escolha a Tarefa." } : {})}
          onConfirm={() => {
            if (!ligando) return;
            const result = run((data, me) => linkTaskToGoal(data, me, ligando, tarefaEscolhida, true));
            if (result.ok) {
              report(result, "Tarefa ligada à Meta.");
              setLigando(null);
              setTarefaEscolhida("");
              setErro(null);
            } else {
              setErro(result.error);
            }
          }}
          onCancel={() => {
            setLigando(null);
            setTarefaEscolhida("");
            setErro(null);
          }}
        >
          {erro ? <p role="alert" className="app-base rounded-[var(--r-controle)] px-3 py-2" style={{ background: "var(--erro-lavado)", color: "var(--erro)" }}>{erro}</p> : null}
          <Field label="Tarefa">
            {(id) => (
              <Select
                id={id}
                value={tarefaEscolhida}
                onChange={setTarefaEscolhida}
                searchable
                placeholder="Escolher"
                options={state.tasks
                  .filter((t) => t.lifecycle === "ativo" && !aLigar?.taskIds.includes(t.id) && memberSeesTask(state, memberId, t.id))
                  .map((t) => ({ value: t.id, label: t.title, detail: state.lists.find((l) => l.id === t.listId)?.name }))}
              />
            )}
          </Field>
        </ConfirmDialog>

        {metas.length === 0 ? (
          <EmptyState title="Nenhuma Meta ativa." hint="Crie uma Meta e ligue Tarefas a ela, ou aponte-a para um recorte de Tarefas." />
        ) : (
          <Section title="Metas ativas" count={metas.length}>
            <ul className="pilha-solta">
              {metas.map((goal) => {
                const progresso = goalProgress(state, goal, memberId, now);
                const dona = goal.ownerMemberId === memberId || admin;
                const percentual = "kind" in progresso ? 0 : Math.round(progresso.ratio * 100);
                return (
                  <li key={goal.id} className="item-solto" data-bloco="true" data-estatico="true">
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <h2 className="ed-subtitulo truncate">{goal.name}</h2>
                        <p className="app-sm" style={{ color: "var(--texto-3)" }}>
                          <Link href={hrefDe(goal.anchor)} className="hover:underline">{nomeDe(goal.anchor)}</Link>
                          {" · "}
                          {goal.kind === "tarefasConcluidas" ? "por Tarefas concluídas" : "por métrica"}
                          {goal.dueDate ? ` · até ${fmt.civilDate(goal.dueDate)}` : ""}
                          {" · "}dona: {state.members.find((m) => m.id === goal.ownerMemberId)?.displayName ?? "—"}
                        </p>
                      </div>
                      <ActionMenu
                        label={`Ações de ${goal.name}`}
                        items={[
                          {
                            label: "Editar",
                            onSelect: () => {
                              setEditando(goal);
                              setEdicao({ name: goal.name, target: String(goal.target), unit: goal.unit ?? "", dueDate: goal.dueDate ?? "" });
                              setErro(null);
                            },
                            ...(dona ? {} : { disabledReason: "Só o dono da Meta ou um Administrador." }),
                          },
                          ...(goal.kind === "tarefasConcluidas" ? [{ label: "Ligar Tarefa", onSelect: () => setLigando(goal.id), ...(dona ? {} : { disabledReason: "Só o dono da Meta ou um Administrador." }) }] : []),
                          { label: "Arquivar", destructive: true, onSelect: () => setArquivando(goal.id), ...(dona ? {} : { disabledReason: "Só o dono da Meta ou um Administrador." }) },
                        ]}
                      />
                    </div>
                    {"kind" in progresso ? (
                      <p className="app-sm mt-2" style={{ color: "var(--texto-3)" }}>Sem acesso ao recorte desta Meta.</p>
                    ) : (
                      <div className="mt-3 grid gap-1">
                        <div
                          className="overflow-hidden"
                          style={{ height: "var(--barra-viz-h)", borderRadius: "var(--r-pilula)", background: "var(--superficie-3)" }}
                          role="progressbar"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={percentual}
                          aria-label={`Progresso de ${goal.name}`}
                        >
                          <div className="h-full" style={{ width: `${percentual}%`, borderRadius: "var(--r-pilula)", background: "var(--acento)" }} />
                        </div>
                        <p className="app-sm app-numero" style={{ color: "var(--texto)" }}>
                          {progresso.label} · {percentual}%
                        </p>
                      </div>
                    )}
                    {goal.kind === "tarefasConcluidas" && goal.taskIds.length > 0 ? (
                      <ul className="mt-2 flex flex-wrap gap-1">
                        {goal.taskIds.map((id) => {
                          const t = state.tasks.find((x) => x.id === id);
                          if (!t || !memberSeesTask(state, memberId, id)) return null;
                          return (
                            <li key={id} className="pilula" style={{ borderColor: "var(--linha)", color: "var(--texto-1)" }}>
                              <Link href={`/estrutura/tarefas/${id}`} className="hover:underline" style={{ color: "var(--texto)" }}>{t.title}</Link>
                              {dona ? (
                                <button
                                  type="button"
                                  onClick={() => setDesligando({ goalId: goal.id, taskId: id })}
                                  aria-label={`Desligar ${t.title} da Meta`}
                                  className="grid size-5 place-items-center rounded-full transition-colors hover:bg-[var(--erro-lavado)] hover:text-[var(--erro)]"
                                  style={{ color: "var(--texto-3)" }}
                                >
                                  ×
                                </button>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Section>
        )}
        {arquivadas.length > 0 ? (
          <Section title="Arquivadas" count={arquivadas.length}>
            <ul className="pilha-solta">
              {arquivadas.map((goal) => {
                const dona = goal.ownerMemberId === memberId || admin;
                return (
                  <li key={goal.id} className="item-solto flex-wrap" data-estatico="true" data-atenuado="true" style={{ paddingBlock: "var(--e-1)" }}>
                    <span className="app-base min-w-0 flex-1 truncate" style={{ color: "var(--texto)" }}>{goal.name}</span>
                    <span className="app-meta">{nomeDe(goal.anchor)}</span>
                    <Button size="sm" onClick={() => report(run((data, me) => setGoalArchived(data, me, goal.id, false)), "Meta restaurada.")} disabled={!dona} disabledReason="Só o dono da Meta ou um Administrador.">
                      Restaurar
                    </Button>
                  </li>
                );
              })}
            </ul>
          </Section>
        ) : null}
      </CorpoDeTela>
    </div>
  );
}
