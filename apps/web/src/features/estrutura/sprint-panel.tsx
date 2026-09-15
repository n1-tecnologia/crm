"use client";

/**
 * Fase 3 — Sprints numa Pasta. A Pasta ganha o papel; cada Lista abaixo é
 * uma sprint datada em sequência. Fechar move o que ficou aberto para a
 * próxima e arquiva a Lista, com Registro.
 *
 * É um painel de COLUNA LATERAL: cabeçalho próprio e tudo empilhado numa
 * coluna só, para o formulário de habilitar caber em 22rem sem apertar o
 * rótulo nem esticar o botão pela tela inteira.
 */

import Link from "next/link";
import { useState } from "react";
import { useData, useRun, useSession } from "@/dados/store";
import { closeSprint, createNextSprint, disableSprints, enableSprints, sprintsOf } from "@n1/dominio/operations";
import { containerAdminRefusal, isTerminalCategory, memberReachesContainer, statusCategory } from "@n1/dominio/derive";
import { useFormat } from "@/features/shell/use-format";
import {
  Button,
  CabecalhoDePainel,
  ConfirmDialog,
  EmptyState,
  Field,
  Painel,
  TextInput,
  Toast,
} from "@/features/shell/ui";
import type { Folder } from "@n1/dominio/types";

export function SprintPanel({ folder }: { readonly folder: Folder }) {
  const run = useRun();
  const fmt = useFormat();
  const { memberId } = useSession();
  const state = useData((data) => data);
  const [cadencia, setCadencia] = useState("14");
  const [fechando, setFechando] = useState<string | null>(null);
  const [desligando, setDesligando] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bloqueio =
    containerAdminRefusal(state, memberId, "folder", folder.id) ??
    (folder.lifecycle !== "ativo" ? "Uma Pasta arquivada ou na lixeira não organiza sprints." : undefined);
  const report = (result: { ok: boolean; error?: string }, message: string) => {
    if (result.ok) {
      setError(null);
      setNotice(message);
    } else {
      setNotice(null);
      setError(result.error ?? "Não foi possível concluir a operação.");
    }
  };

  // B38a — a sprint privada que este Membro não alcança não aparece.
  const sprints = sprintsOf(state, folder.id).filter((l) => memberReachesContainer(state, memberId, "list", l.id));
  const abertasEm = (listId: string) =>
    state.tasks.filter(
      (t) => t.listId === listId && !t.parentTaskId && t.lifecycle === "ativo" && !isTerminalCategory(statusCategory(state, t)),
    ).length;
  const aFechar = sprints.find((l) => l.id === fechando);
  const cadenciaNumero = Number(cadencia);
  const cadenciaValida = Number.isInteger(cadenciaNumero) && cadenciaNumero >= 1 && cadenciaNumero <= 90;
  const periodoDe = (list: (typeof sprints)[number]) =>
    list.plannedPeriod?.start
      ? `${fmt.civilDate(list.plannedPeriod.start)}${list.plannedPeriod.end ? ` a ${fmt.civilDate(list.plannedPeriod.end)}` : ""}`
      : "sem período";

  return (
    <Painel>
      <CabecalhoDePainel titulo="Sprints" contagem={folder.sprint ? `${folder.sprint.cadenceDays} dias` : undefined} />
      <div className="grid gap-3 p-3">
        {notice ? (
          <Toast tone="success" onDismiss={() => setNotice(null)}>
            {notice}
          </Toast>
        ) : null}
        {error ? (
          <Toast tone="error" onDismiss={() => setError(null)}>
            {error}
          </Toast>
        ) : null}
        <ConfirmDialog
          open={fechando !== null}
          title={`Fechar a sprint “${aFechar?.name ?? ""}”?`}
          description={`${aFechar ? abertasEm(aFechar.id) : 0} Tarefa(s) aberta(s) vão para a próxima sprint (criada se ainda não existir) e esta Lista fica arquivada. Cada Tarefa movida ganha um Registro.`}
          confirmLabel="Fechar sprint"
          destructive
          onConfirm={() => {
            if (fechando) {
              const result = run((data, me) => closeSprint(data, me, fechando));
              report(
                result,
                result.ok
                  ? `Sprint fechada: ${result.value.moved} Tarefa(s) movida(s) para ${state.lists.find((l) => l.id === result.value.nextListId)?.name ?? "a próxima"}.`
                  : "",
              );
            }
            setFechando(null);
          }}
          onCancel={() => setFechando(null)}
        />
        <ConfirmDialog
          open={desligando}
          title="Desabilitar sprints nesta Pasta?"
          description="As Listas continuam como estão, com os períodos que já têm; a Pasta só deixa de criar e fechar sprints."
          confirmLabel="Desabilitar"
          destructive
          onConfirm={() => {
            report(
              run((data, me) => disableSprints(data, me, folder.id)),
              "Sprints desabilitadas.",
            );
            setDesligando(false);
          }}
          onCancel={() => setDesligando(false)}
        />

        {!folder.sprint ? (
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              report(
                run((data, me) => enableSprints(data, me, folder.id, cadenciaNumero)),
                "Sprints habilitadas: cada sprint dura o período escolhido.",
              );
            }}
          >
            <p className="app-base" style={{ color: "var(--texto-3)" }}>
              Com sprints, as Listas desta Pasta viram períodos em sequência: fechar uma leva o que ficou aberto para a
              próxima.
            </p>
            <Field label="Duração de cada sprint (dias)" hint="De 1 a 90 dias.">
              {(id) => (
                <TextInput id={id} value={cadencia} onChange={setCadencia} type="number" disabled={bloqueio !== undefined} />
              )}
            </Field>
            <Button
              type="submit"
              variant="primary"
              full
              disabled={!cadenciaValida || bloqueio !== undefined}
              disabledReason={bloqueio ?? "De 1 a 90 dias."}
            >
              Habilitar sprints
            </Button>
          </form>
        ) : (
          <>
            <p className="app-base" style={{ color: "var(--texto-3)" }}>
              A próxima sprint começa no dia seguinte ao fim da última.
            </p>
            {sprints.length === 0 ? (
              <EmptyState compact title="Nenhuma sprint ainda." />
            ) : (
              <ul className="pilha-solta">
                {sprints.map((list) => {
                  const abertas = abertasEm(list.id);
                  const fechada = list.lifecycle !== "ativo";
                  return (
                    // A peça não clica por inteiro: o nome é o link, o botão fecha. A sprint fechada recua.
                    <li
                      key={list.id}
                      className="item-solto"
                      data-bloco="true"
                      data-estatico="true"
                      data-atenuado={fechada ? "true" : undefined}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <Link
                          href={`/estrutura/listas/${list.id}`}
                          className="app-md min-w-0 flex-1 truncate hover:underline"
                          style={{ color: "var(--texto)" }}
                        >
                          {list.name}
                        </Link>
                        {!fechada ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setFechando(list.id)}
                            disabled={bloqueio !== undefined}
                            disabledReason={bloqueio ?? ""}
                          >
                            Fechar
                          </Button>
                        ) : null}
                      </span>
                      <span className="app-meta app-numero mt-0.5 block">
                        {periodoDe(list)}
                        {" · "}
                        {fechada ? "fechada" : `${abertas} aberta(s)`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <span className="grid gap-2">
              <Button
                variant="primary"
                full
                onClick={() => {
                  const result = run((data, me) => createNextSprint(data, me, folder.id));
                  report(
                    result,
                    result.ok
                      ? `${result.value.name} criada: ${fmt.civilDate(result.value.plannedPeriod?.start ?? "")} a ${fmt.civilDate(result.value.plannedPeriod?.end ?? "")}.`
                      : "",
                  );
                }}
                disabled={bloqueio !== undefined}
                disabledReason={bloqueio ?? ""}
              >
                Nova sprint
              </Button>
              <Button
                variant="ghost"
                full
                onClick={() => setDesligando(true)}
                disabled={bloqueio !== undefined}
                disabledReason={bloqueio ?? ""}
              >
                Desabilitar sprints
              </Button>
            </span>
          </>
        )}
      </div>
    </Painel>
  );
}
