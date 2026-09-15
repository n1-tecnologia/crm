"use client";

/**
 * O POPUP DA CONTA: detalhes e histórico sem sair da Lista. Lê a mesma Tarefa
 * e chama as mesmas operações da página completa; "Editar conta" leva a ela.
 * Fecha por ícone, Esc e clique fora (o `SidePanel` já faz os três) — nada
 * aqui é digitado, então fechar nunca perde dado.
 *
 * Abre no centro, em 80% da tela, e usa a largura: à esquerda o que a conta É
 * (título, valor, Status, dados); à direita o que aconteceu com ela
 * (Comentários e Atividade). As abas "Detalhes | Histórico" existiam para
 * caber numa gaveta estreita — com duas colunas, os dois blocos ficam à vista.
 */

import Link from "next/link";
import { useState } from "react";
import { useData, useRun, useSession } from "@/dados/store";
import { changeTaskStatus, CP, statusOptionRefusal } from "@n1/dominio/operations";
import {
  effectiveListConfig,
  memberSeesTask,
  newestFirst,
  taskWriteRefusal,
} from "@n1/dominio/derive";
import { PRIORITY_LABEL } from "@/features/shell/format";
import { useFormat } from "@/features/shell/use-format";
import {
  ActorAvatar,
  Button,
  ConfirmDialog,
  EmptyState,
  ReguaDeSecao,
  SidePanel,
  StatusPicker,
} from "@/features/shell/ui";
import { StatusBadge } from "./contas-view";
import { financeProfileOf, PAGAR_PROFILE, textoDoCampo, valorDaConta } from "./lens";

type Report = (
  result: { ok: boolean; error?: string },
  message: string,
) => void;

export function ContaDrawer({
  taskId,
  onClose,
  report,
}: {
  readonly taskId: string | null;
  readonly onClose: () => void;
  readonly report: Report;
}) {
  const state = useData((data) => data);
  const run = useRun();
  const fmt = useFormat();
  const { memberId } = useSession();
  const [confirmando, setConfirmando] = useState<{
    statusId: string;
    label: string;
  } | null>(null);

  const task = taskId
    ? state.tasks.find(
        (t) => t.id === taskId && memberSeesTask(state, memberId, t.id),
      )
    : undefined;
  const config = task ? effectiveListConfig(state, task.listId) : null;
  if (!task || !config) {
    return (
      <SidePanel title="Conta" open={taskId !== null} onClose={onClose}>
        <EmptyState compact title="Conta não encontrada, ou você não tem permissão para vê-la." />
      </SidePanel>
    );
  }
  const profile = financeProfileOf(task.listId) ?? PAGAR_PROFILE;
  const grupo = profile.groupOf(state, task, new Date());
  const definition = config.statusSet.definitions.find(
    (d) => d.id === task.statusId,
  );
  const escritaRecusada = taskWriteRefusal(state, memberId, task.id);
  const responsavel = task.assignees.find((a) => a.kind === "member");
  const membro = responsavel
    ? state.members.find((m) => m.id === responsavel.id)
    : undefined;
  const nomeDe = (id: string) =>
    state.members.find((m) => m.id === id)?.displayName ??
    state.agents.find((a) => a.id === id)?.name ??
    state.automations.find((a) => a.id === id)?.name ??
    id;
  const campo = (id: string) => textoDoCampo(task, id) || "—";
  // A ação principal do rodapé: a primeira ação rápida que se aplica a esta
  // conta (Autorizar / Iniciar cobrança); senão, a de fechamento.
  const [acao1, acao2] = profile.quickActions;
  const escolhida = acao1.notApplicable(task) === undefined ? acao1 : acao2;
  const acaoPrincipal = {
    label: escolhida.label,
    statusId: escolhida.statusId,
    motivo:
      escritaRecusada ??
      escolhida.notApplicable(task) ??
      statusOptionRefusal(state, memberId, task, escolhida.statusId),
  };
  const historico = newestFirst(
    state.activity.filter((a) => a.objectId === task.id),
  );
  // O dossiê da cobrança vive nos Comentários (seção 7.3): a coluna mostra o texto, não só "Comentário na Tarefa".
  const comentarios = [...task.comments].filter((c) => !c.deletedAt).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const anexos = profile.attachmentFieldIds
    .map((id) => ({
      nome: state.fieldDefinitions.find((d) => d.id === id)?.name ?? id,
      arquivo: textoDoCampo(task, id),
    }))
    .filter((a) => a.arquivo);

  return (
    <SidePanel
      title="Conta"
      open
      onClose={onClose}
      footer={
        <span className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <Link href={`/estrutura/tarefas/${task.id}`} className="btn btn-fantasma">
            Editar conta
          </Link>
          <Button
            variant="primary"
            onClick={() =>
              setConfirmando({
                statusId: acaoPrincipal.statusId,
                label: acaoPrincipal.label,
              })
            }
            disabled={acaoPrincipal.motivo !== undefined}
            disabledReason={acaoPrincipal.motivo ?? ""}
          >
            {acaoPrincipal.label}
          </Button>
        </span>
      }
    >
      <ConfirmDialog
        open={confirmando !== null}
        title={`${confirmando?.label ?? ""}: “${task.title}”?`}
        description={`${fmt.money({ amount: valorDaConta(task), currency: "BRL" })} · vence ${task.dueDate ? fmt.taskDate(task.dueDate) : "—"}. Passa pelas regras da Lista e fica na Atividade.`}
        confirmLabel={confirmando?.label ?? "Confirmar"}
        onConfirm={() => {
          if (confirmando)
            report(
              run((data, me) =>
                changeTaskStatus(data, me, task.id, confirmando.statusId),
              ),
              `“${task.title}”: ${confirmando.label.toLocaleLowerCase("pt-BR")}.`,
            );
          setConfirmando(null);
        }}
        onCancel={() => setConfirmando(null)}
      />

      {/* O cabeçalho da conta atravessa as duas colunas: título, identificador com o Status, o valor grande. */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <h3 className="ed-titulo truncate">{task.title}</h3>
          <p className="mt-1 flex flex-wrap items-center gap-2">
            <span className="identificador">{task.readableId ?? task.id}</span>
            <StatusBadge definition={definition} grupo={grupo} />
          </p>
        </div>
        <p className="flex flex-wrap items-baseline gap-3">
          <span className="ed-display app-numero">
            {fmt.money({ amount: valorDaConta(task), currency: "BRL" })}
          </span>
          <span
            className="app-sm app-numero"
            style={{ color: grupo === "vencidas" ? "var(--erro)" : "var(--texto-3)" }}
          >
            vence {task.dueDate ? fmt.taskDate(task.dueDate) : "—"}
          </span>
        </p>
      </div>

      <div className="mt-6 grid gap-x-10 gap-y-6 lg:grid-cols-2">
        {/* ------------------------------------------------ o que a conta é */}
        <div className="grid content-start gap-6">
          <section>
            <ReguaDeSecao rotulo="Status" className="pt-0" />
            <StatusPicker
              options={[...config.statusSet.definitions]
                .sort((a, b) => a.order - b.order)
                .map((d) => ({
                  id: d.id,
                  name: d.name,
                  category: d.category,
                  color: d.color,
                }))}
              value={task.statusId}
              onChange={(statusId) => {
                // Mesma confirmação das ações do rodapé: uma conta que muda
                // de Status dispara Automações (Responsável, comentário).
                const alvo = config?.statusSet.definitions.find(
                  (d) => d.id === statusId,
                );
                setConfirmando({
                  statusId,
                  label: `Mover para “${alvo?.name ?? statusId}”`,
                });
              }}
              optionBlockReason={(optionId) =>
                statusOptionRefusal(state, memberId, task, optionId)
              }
              readOnly={escritaRecusada !== undefined}
              readOnlyReason={escritaRecusada ?? ""}
            />
          </section>
          <section>
            <ReguaDeSecao rotulo="Dados da conta" className="pt-0" />
            <dl>
              <Linha rotulo={profile.labels.contraparte}>
                {profile.counterpart(state, task)}
              </Linha>
              <Linha rotulo="Empresa">{campo(CP.fields.empresa)}</Linha>
              <Linha rotulo="Centro de custo">
                {campo(CP.fields.centroDeCusto)}
              </Linha>
              {profile.drawerRows(state, task).map((linha) => (
                <Linha key={linha.rotulo} rotulo={linha.rotulo}>
                  {linha.data ? fmt.taskDate({ form: "civilDay", value: linha.data }) : linha.valor}
                </Linha>
              ))}
              <Linha rotulo="Responsável">
                {membro ? (
                  <span className="inline-flex items-center gap-1.5">
                    <ActorAvatar
                      kind="member"
                      name={membro.displayName}
                      {...(membro.photoFileId
                        ? { photoFileId: membro.photoFileId }
                        : {})}
                    />
                    {membro.displayName}
                  </span>
                ) : (
                  "—"
                )}
              </Linha>
              <Linha rotulo="Prioridade">{PRIORITY_LABEL[task.priority]}</Linha>
              {task.tagIds.length > 0 ? (
                <Linha rotulo="Conta bancária">
                  {task.tagIds
                    .map((id) => state.tags.find((t) => t.id === id)?.name)
                    .filter(Boolean)
                    .join(", ")}
                </Linha>
              ) : null}
              <Linha rotulo="Descrição">{task.description || "—"}</Linha>
              <Linha rotulo="Anexos">
                {anexos.length === 0 ? (
                  <span style={{ color: "var(--texto-4)" }}>nenhum</span>
                ) : (
                  <ul className="grid gap-0.5">
                    {anexos.map((a) => (
                      <li key={a.nome}>
                        <span style={{ color: "var(--texto-3)" }}>{a.nome}: </span>
                        {a.arquivo}
                      </li>
                    ))}
                  </ul>
                )}
              </Linha>
            </dl>
          </section>
        </div>

        {/* ------------------------------------- o que aconteceu com ela */}
        <div className="grid content-start gap-6">
          <section aria-label="Comentários">
            <ReguaDeSecao rotulo="Comentários" contagem={comentarios.length} className="pt-0" />
            {comentarios.length === 0 ? (
              <EmptyState compact title="Nenhum Comentário nesta conta." />
            ) : (
              <ol className="pilha-solta">
                {comentarios.map((c) => (
                  <li key={c.id} className="item-solto" data-bloco="true" data-estatico="true">
                    <span className="app-base block whitespace-pre-wrap" style={{ color: "var(--texto)" }}>
                      {c.content}
                    </span>
                    <span className="app-meta mt-1 block">
                      {nomeDe(c.author.id)}
                      {c.authorDelegate ? ` em nome de ${nomeDe(c.authorDelegate.id)}` : ""} · {fmt.relative(c.createdAt)}
                      {c.resolved ? " · resolvido" : ""}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
          <section aria-label="Atividade">
            <ReguaDeSecao rotulo="Atividade" contagem={historico.length} className="pt-0" />
            {historico.length === 0 ? (
              <EmptyState compact title="Nenhum Registro de Atividade nesta conta." />
            ) : (
              <ol className="pilha-solta">
                {historico.map((r) => (
                  <li key={r.id} className="item-solto" data-bloco="true" data-estatico="true">
                    <span className="app-base block" style={{ color: "var(--texto)" }}>
                      {r.action}
                      {r.before || r.after ? (
                        <span style={{ color: "var(--texto-3)" }}>
                          {" "}
                          {r.before ? `${r.before} → ` : ""}
                          {r.after ?? ""}
                        </span>
                      ) : null}
                    </span>
                    <span className="app-meta mt-1 block">
                      {nomeDe(r.actor.id)}
                      {r.delegate
                        ? ` em nome de ${nomeDe(r.delegate.id)}`
                        : ""} · {fmt.relative(r.at)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </SidePanel>
  );
}

/** Uma linha "rótulo: valor" do dossiê. Hairline entre elas; o valor não trunca. */
function Linha({
  rotulo,
  children,
}: {
  readonly rotulo: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div
      className="grid grid-cols-[10rem_minmax(0,1fr)] gap-2 py-2"
      style={{ borderBottom: "1px solid var(--linha-sutil)" }}
    >
      <dt className="app-meta">{rotulo}</dt>
      <dd className="app-base min-w-0" style={{ color: "var(--texto)" }}>
        {children}
      </dd>
    </div>
  );
}
