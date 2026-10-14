"use client";

/**
 * Editores da configuração de um contêiner (Fase 1): Conjunto de Status,
 * Definições de Campo e Tipos de Tarefa. Cada controle chama uma operação e
 * devolve o resultado ao chamador, que avisa. O que a operação recusaria, a
 * tela desliga com o motivo — o clique nunca é o primeiro a saber.
 */

import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { useId, useState } from "react";
import { useData, useRun, useSession } from "@/dados/store";
import {
  addStatus,
  archiveFieldDefinition,
  createFieldDefinition,
  createTaskType,
  inheritStatusSet,
  overrideStatusSet,
  removeStatus,
  removeTaskType,
  reorderStatuses,
  setContainerFeature,
  updateFieldDefinition,
  updateStatus,
  updateTaskType,
  usarCampoHerdado,
} from "@n1/dominio/operations";
import { blockedAbove } from "@n1/dominio/operations/configuration";
import { containerAdminRefusal, containerPath, effectiveContainerConfig, effectiveListConfig } from "@n1/dominio/derive";
import { FIELD_TYPE_LABEL, STATUS_CATEGORY_LABEL } from "@/features/shell/format";
import { RequisitosDoStatusDialog } from "@/features/estrutura/requisitos-do-status-dialog";
import { ActionMenu, Button, ConfirmDialog, EmptyState, Field, Icone, MultiSelect, Segmentos, Select, TextInput, Toggle } from "@/features/shell/ui";
import type { OperationResult } from "@n1/dominio/state";
import type { EnabledFeatures, FieldDefinition, FieldRequirement, FieldType, StatusCategory, StatusSet } from "@n1/dominio/types";

type Report = (result: OperationResult<unknown>, message: string) => void;
type ContainerType = "space" | "folder" | "list";

const CATEGORIAS: readonly StatusCategory[] = ["naoIniciado", "emAndamento", "concluido", "fechado"];
// POSC-08 — `file` entra na lista: antes só os Campos do Financeiro (do seed)
// eram de arquivo, e ninguém criava um pela tela.
const TIPOS: readonly FieldType[] = [
  "text", "longText", "number", "currency", "percent", "date", "dateTime",
  "singleSelect", "multiSelect", "checkbox", "person", "phone", "email", "url", "file",
];

/** Quem pode configurar ESTE contêiner: a tela desliga o que a operação recusaria. */
export function useMayConfigure(containerType: ContainerType, containerId: string): string | undefined {
  const { memberId } = useSession();
  const state = useData((data) => data);
  return containerAdminRefusal(state, memberId, containerType, containerId);
}

/** B25 — um ancestral pode bloquear o aspecto: a tela desliga o controle com a mesma frase da operação. */
function useBlockedAbove(containerType: ContainerType, containerId: string, aspect: Parameters<typeof blockedAbove>[3]): string | undefined {
  const state = useData((data) => data);
  return blockedAbove(state, containerType, containerId, aspect);
}

function ReadOnlyNote({ reason }: { readonly reason: string | undefined }) {
  if (!reason) return null;
  return (
    <p
      className="app-sm rounded-[var(--r-controle)] px-3 py-2"
      style={{ background: "var(--superficie-2)", border: "1px solid var(--linha)", color: "var(--texto-3)" }}
    >
      Somente leitura: {reason}
    </p>
  );
}

/** A área de texto é o `.campo` do sistema: `textarea.campo` solta a altura. */
const TEXTAREA = "campo";

/* ───────────────────────────── Status ────────────────────────────── */

export function StatusSetEditor({
  containerType,
  containerId,
  own,
  set,
  definedAtName,
  report,
}: {
  readonly containerType: ContainerType;
  readonly containerId: string;
  /** Este contêiner define o Conjunto (pode editar) ou só o herda. */
  readonly own: boolean;
  readonly set: StatusSet;
  readonly definedAtName: string;
  readonly report: Report;
}) {
  const run = useRun();
  const state = useData((data) => data);
  const bloqueio = useMayConfigure(containerType, containerId);
  const bloqueadoAcima = useBlockedAbove(containerType, containerId, "statusSet");
  const ids = useId();
  const [novo, setNovo] = useState({ name: "", color: "#7c3aed", category: "emAndamento" as StatusCategory });
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [destino, setDestino] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [nomeEditado, setNomeEditado] = useState("");
  const [confirmando, setConfirmando] = useState<"sobrescrever" | "herdar" | null>(null);
  // "Quem pode mover para cá" (`entryAllowedMemberIds`): o Status em edição, e o rascunho.
  const [regraDe, setRegraDe] = useState<string | null>(null);
  const [quemMove, setQuemMove] = useState<"qualquer" | "escolhidos">("qualquer");
  const [escolhidos, setEscolhidos] = useState<readonly string[]>([]);
  // RELO-04 — "Requisitos de entrada e saída": o Status em edição.
  const [requisitosDe, setRequisitosDe] = useState<string | null>(null);

  const definicoes = [...set.definitions].sort((a, b) => a.order - b.order);
  const membros = state.members.filter((m) => m.state !== "removido");
  const abrirRegra = (statusId: string) => {
    const atuais = definicoes.find((d) => d.id === statusId)?.entryAllowedMemberIds ?? [];
    setQuemMove(atuais.length > 0 ? "escolhidos" : "qualquer");
    // Quem não é Membro não volta ao rascunho: salvar tira da regra.
    setEscolhidos(atuais.filter((id) => membros.some((m) => m.id === id)));
    setRegraDe(statusId);
  };
  // Só as Tarefas das Listas que consomem ESTE Conjunto: uma cópia sobrescrita
  // abaixo preserva os ids, e contá-la aqui inflaria o número.
  const listasDoConjunto = new Set(state.lists.filter((l) => effectiveListConfig(state, l.id)?.statusSet.id === set.id).map((l) => l.id));
  const tarefasEm = state.tasks
    .filter((t) => listasDoConjunto.has(t.listId))
    .reduce<Record<string, number>>((acc, t) => {
      acc[t.statusId] = (acc[t.statusId] ?? 0) + 1;
      return acc;
    }, {});

  const mover = (statusId: string, delta: -1 | 1) => {
    const ordem = definicoes.map((d) => d.id);
    const i = ordem.indexOf(statusId);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= ordem.length) return;
    [ordem[i], ordem[j]] = [ordem[j] as string, ordem[i] as string];
    report(run((data, me) => reorderStatuses(data, me, containerType, containerId, ordem)), "Ordem dos Status alterada.");
  };

  /** RN-ESP-05 — remover o último "não iniciado" ou "fechado" é recusado; a tela avisa antes. */
  const motivoParaNaoRemover = (category: StatusCategory): string | undefined => {
    if (category !== "naoIniciado" && category !== "fechado") return undefined;
    const restam = definicoes.filter((d) => d.category === category).length;
    return restam <= 1 ? `O Conjunto precisa de ao menos um Status “${STATUS_CATEGORY_LABEL[category] ?? category}”.` : undefined;
  };

  const dialogoDeModo =
    confirmando === "sobrescrever" ? (
      <ConfirmDialog
        open
        title="Sobrescrever o Conjunto de Status aqui?"
        description={`Este contêiner passa a definir o próprio Conjunto, começando como cópia do de ${definedAtName}. As Tarefas não mudam de Status. Mudanças feitas em ${definedAtName} deixam de chegar aqui; dá para voltar a herdar enquanto toda Tarefa couber no Conjunto herdado.`}
        confirmLabel="Sobrescrever"
        onConfirm={() => {
          if (containerType !== "space") {
            report(run((data, me) => overrideStatusSet(data, me, containerType, containerId)), "Conjunto de Status sobrescrito aqui.");
          }
          setConfirmando(null);
        }}
        onCancel={() => setConfirmando(null)}
      />
    ) : confirmando === "herdar" ? (
      <ConfirmDialog
        open
        title="Voltar a herdar o Conjunto de Status?"
        description="Os Status definidos aqui deixam de existir e o contêiner passa a seguir o de cima. Só é possível enquanto toda Tarefa abaixo estiver em um Status que também existe no Conjunto herdado."
        confirmLabel="Voltar a herdar"
        destructive
        onConfirm={() => {
          if (containerType !== "space") {
            report(run((data, me) => inheritStatusSet(data, me, containerType, containerId)), "O contêiner voltou a herdar o Conjunto de Status.");
          }
          setConfirmando(null);
        }}
        onCancel={() => setConfirmando(null)}
      />
    ) : null;

  if (!own) {
    return (
      <div className="grid gap-2">
        {dialogoDeModo}
        <p className="app-base" style={{ color: "var(--texto-3)" }}>
          Este contêiner herda o Conjunto de {definedAtName}. Para ter Status próprios, sobrescreva: começa
          como cópia do herdado e as Tarefas não mudam de Status.
        </p>
        {containerType !== "space" ? (
          <span>
            <Button onClick={() => setConfirmando("sobrescrever")} disabled={(bloqueio ?? bloqueadoAcima) !== undefined} disabledReason={bloqueio ?? bloqueadoAcima ?? ""}>
              Sobrescrever aqui
            </Button>
          </span>
        ) : null}
      </div>
    );
  }

  const aRemover = definicoes.find((d) => d.id === removendo);
  const emUso = aRemover ? (tarefasEm[aRemover.id] ?? 0) : 0;
  const emRegra = definicoes.find((d) => d.id === regraDe);
  const foraDoEspaco = (emRegra?.entryAllowedMemberIds ?? []).filter((id) => !membros.some((m) => m.id === id));

  return (
    <div className="grid gap-3">
      {dialogoDeModo}
      <ReadOnlyNote reason={bloqueio} />
      <ConfirmDialog
        open={removendo !== null}
        title={`Remover o Status “${aRemover?.name ?? ""}”?`}
        description={
          emUso > 0
            ? `${emUso} Tarefa(s) estão nele e precisam de um destino. Cada uma ganha um Registro de Atividade.`
            : "Nenhuma Tarefa está neste Status."
        }
        confirmLabel="Remover"
        destructive
        {...(emUso > 0 && destino === "" ? { confirmDisabledReason: "Escolha o Status de destino." } : {})}
        onConfirm={() => {
          if (aRemover) {
            report(
              run((data, me) => removeStatus(data, me, containerType, containerId, aRemover.id, destino || undefined)),
              "Status removido.",
            );
          }
          setRemovendo(null);
          setDestino("");
        }}
        onCancel={() => {
          setRemovendo(null);
          setDestino("");
        }}
      >
        {emUso > 0 ? (
          <Field label="Mover as Tarefas para">
            {(id) => (
              <Select
                id={id}
                value={destino}
                onChange={setDestino}
                placeholder="Escolher"
                options={definicoes.filter((d) => d.id !== removendo).map((d) => ({ value: d.id, label: d.name }))}
              />
            )}
          </Field>
        ) : null}
      </ConfirmDialog>
      <RequisitosDoStatusDialog
        containerType={containerType}
        containerId={containerId}
        definition={definicoes.find((d) => d.id === requisitosDe)}
        definicoes={definicoes}
        open={requisitosDe !== null}
        onClose={() => setRequisitosDe(null)}
        report={report}
      />
      <ConfirmDialog
        open={regraDe !== null}
        title={`Quem pode mover para “${emRegra?.name ?? ""}”?`}
        description="Qualquer pessoa que edita as Tarefas, ou só as pessoas escolhidas. Para quem não pode, a opção aparece desligada, com o motivo."
        confirmLabel="Salvar"
        {...(quemMove === "escolhidos" && escolhidos.length === 0
          ? { confirmDisabledReason: "Escolha ao menos uma pessoa, ou deixe qualquer pessoa mover." }
          : {})}
        onConfirm={() => {
          if (emRegra) {
            report(
              run((data, me) =>
                updateStatus(data, me, containerType, containerId, emRegra.id, {
                  entryAllowedMemberIds: quemMove === "qualquer" ? [] : escolhidos,
                }),
              ),
              "Regra do Status alterada.",
            );
          }
          setRegraDe(null);
        }}
        onCancel={() => setRegraDe(null)}
      >
        <div className="grid gap-3">
          <Segmentos
            rotulo="Quem pode mover"
            opcoes={[
              { valor: "qualquer", rotulo: "Qualquer pessoa" },
              { valor: "escolhidos", rotulo: "Só estas pessoas" },
            ]}
            valor={quemMove}
            aoTrocar={setQuemMove}
          />
          {quemMove === "escolhidos" ? (
            <Field label="Pessoas">
              {(id) => (
                <MultiSelect
                  id={id}
                  values={escolhidos}
                  onChange={setEscolhidos}
                  options={membros.map((m) => ({ value: m.id, label: m.displayName }))}
                />
              )}
            </Field>
          ) : null}
          {foraDoEspaco.length > 0 ? (
            <p className="app-sm" style={{ color: "var(--texto-3)" }}>
              {foraDoEspaco.join(", ")} {foraDoEspaco.length === 1 ? "não é Membro" : "não são Membros"} deste Espaço de Trabalho
              e sai da regra ao salvar.
            </p>
          ) : null}
        </div>
      </ConfirmDialog>

      <ul className="pilha-solta">
        {definicoes.map((definition, indice) => {
          const naoRemove = motivoParaNaoRemover(definition.category);
          return (
            <li key={definition.id} className="item-solto flex-wrap" data-estatico="true" style={{ paddingBlock: "var(--e-2)" }}>
              <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: definition.color }} />
              {editando === definition.id ? (
                <form
                  className="flex min-w-0 flex-1 items-center gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const result = run((data, me) => updateStatus(data, me, containerType, containerId, definition.id, { name: nomeEditado }));
                    report(result, "Status renomeado.");
                    // Recusado, o nome fica no campo para corrigir; só a gravação fecha.
                    if (result.ok) setEditando(null);
                  }}
                >
                  <span className="min-w-0 flex-1">
                    <TextInput value={nomeEditado} onChange={setNomeEditado} placeholder="Nome do Status" />
                  </span>
                  <Button type="submit" variant="primary" disabled={nomeEditado.trim() === ""} disabledReason="Dê um nome ao Status.">
                    Salvar
                  </Button>
                  <Button onClick={() => setEditando(null)}>Cancelar</Button>
                </form>
              ) : (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="app-base block truncate" style={{ color: "var(--texto)" }}>
                      {definition.name}
                    </span>
                    {(() => {
                      const requisito = (r: FieldRequirement) =>
                        (r.label ?? (r.attribute ? (r.attribute === "dueDate" ? "Data de vencimento" : r.attribute) : state.fieldDefinitions.find((d) => d.id === r.definitionId)?.name ?? r.definitionId)) +
                        (r.positive ? " > 0" : "") +
                        (r.whenDefinitionId ? ` (se ${state.fieldDefinitions.find((d) => d.id === r.whenDefinitionId)?.name ?? ""} = ${r.whenValue ?? ""})` : "");
                      const regras = [
                        definition.exitRequirements?.length ? `Sair exige: ${definition.exitRequirements.map(requisito).join(", ")}` : "",
                        definition.entryRequirements?.length ? `Entrar exige: ${definition.entryRequirements.map(requisito).join(", ")}` : "",
                        definition.entryFromStatusIds?.length ? `Só vindo de: ${definition.entryFromStatusIds.map((id) => definicoes.find((d) => d.id === id)?.name ?? id).join(", ")}` : "",
                        definition.entryAllowedMemberIds?.length ? `Só entra por: ${definition.entryAllowedMemberIds.map((id) => state.members.find((m) => m.id === id)?.displayName ?? id).join(", ")}` : "",
                      ].filter(Boolean);
                      return regras.length > 0 ? <span className="app-meta block">{regras.join(" · ")}</span> : null;
                    })()}
                  </span>
                  <span className="app-sm app-numero shrink-0" style={{ color: "var(--texto-3)" }}>
                    {STATUS_CATEGORY_LABEL[definition.category] ?? definition.category}
                    {tarefasEm[definition.id] ? ` · ${tarefasEm[definition.id]} Tarefa(s)` : ""}
                  </span>
                  <label className="sr-only" htmlFor={`${ids}-cor-${definition.id}`}>
                    Cor de {definition.name}
                  </label>
                  <input
                    id={`${ids}-cor-${definition.id}`}
                    type="color"
                    value={definition.color}
                    disabled={bloqueio !== undefined}
                    title={bloqueio ?? `Cor de ${definition.name}`}
                    onChange={(event) =>
                      report(
                        run((data, me) => updateStatus(data, me, containerType, containerId, definition.id, { color: event.target.value })),
                        "Cor do Status alterada.",
                      )
                    }
                    className="size-7 cursor-pointer rounded-[var(--r-caixa)] border-0 bg-transparent p-0 disabled:cursor-not-allowed disabled:opacity-45"
                  />
                  <button
                    type="button"
                    onClick={() => mover(definition.id, -1)}
                    aria-label={`Subir ${definition.name}`}
                    title={bloqueio ?? (indice === 0 ? "Já é o primeiro." : `Subir ${definition.name}`)}
                    disabled={indice === 0 || bloqueio !== undefined}
                    className="btn-icone btn-icone-nu"
                  >
                    <Icone de={ArrowUp} tamanho="xs" />
                  </button>
                  <button
                    type="button"
                    onClick={() => mover(definition.id, 1)}
                    aria-label={`Descer ${definition.name}`}
                    title={bloqueio ?? (indice === definicoes.length - 1 ? "Já é o último." : `Descer ${definition.name}`)}
                    disabled={indice === definicoes.length - 1 || bloqueio !== undefined}
                    className="btn-icone btn-icone-nu"
                  >
                    <Icone de={ArrowDown} tamanho="xs" />
                  </button>
                  <ActionMenu
                    label={`Ações de ${definition.name}`}
                    items={[
                      {
                        label: "Renomear",
                        onSelect: () => {
                          setNomeEditado(definition.name);
                          setEditando(definition.id);
                        },
                        ...(bloqueio ? { disabledReason: bloqueio } : {}),
                      },
                      {
                        label: "Quem pode mover para cá",
                        onSelect: () => abrirRegra(definition.id),
                        ...(bloqueio ? { disabledReason: bloqueio } : {}),
                      },
                      {
                        label: "Requisitos de entrada e saída",
                        onSelect: () => setRequisitosDe(definition.id),
                        ...(bloqueio ? { disabledReason: bloqueio } : {}),
                      },
                      {
                        label: "Remover",
                        destructive: true,
                        onSelect: () => setRemovendo(definition.id),
                        ...(bloqueio ?? naoRemove ? { disabledReason: bloqueio ?? naoRemove ?? "" } : {}),
                      },
                    ]}
                  />
                </>
              )}
            </li>
          );
        })}
      </ul>

      <form
        className="grid gap-2 rounded-[var(--r-controle)] border border-dashed border-[var(--linha-forte)] p-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          const result = run((data, me) => addStatus(data, me, containerType, containerId, novo));
          report(result, "Status criado.");
          if (result.ok) setNovo({ ...novo, name: "" });
        }}
      >
        <Field label="Novo Status">
          {(id) => <TextInput id={id} value={novo.name} onChange={(name) => setNovo({ ...novo, name })} placeholder="Ex.: Em revisão" disabled={bloqueio !== undefined} />}
        </Field>
        <Field label="Categoria">
          {(id) => (
            <Select
              id={id}
              value={novo.category}
              onChange={(category) => setNovo({ ...novo, category: category as StatusCategory })}
              options={CATEGORIAS.map((c) => ({ value: c, label: STATUS_CATEGORY_LABEL[c] ?? c }))}
              disabled={bloqueio !== undefined}
            />
          )}
        </Field>
        <Field label="Cor">
          {(id) => (
            <input
              id={id}
              type="color"
              value={novo.color}
              disabled={bloqueio !== undefined}
              title={bloqueio ?? "Cor do novo Status"}
              onChange={(event) => setNovo({ ...novo, color: event.target.value })}
              className="h-[var(--controle-h)] w-12 cursor-pointer rounded-[var(--r-controle)] border border-[var(--linha-forte)] bg-transparent p-0.5 disabled:cursor-not-allowed disabled:opacity-45"
            />
          )}
        </Field>
        <Button
          type="submit"
          variant="primary"
          icon={<Icone de={Plus} tamanho="sm" />}
          disabled={novo.name.trim() === "" || bloqueio !== undefined}
          disabledReason={bloqueio ?? "Dê um nome ao Status."}
        >
          Adicionar
        </Button>
      </form>

      {containerType !== "space" ? (
        <span>
          <Button onClick={() => setConfirmando("herdar")} disabled={bloqueio !== undefined} disabledReason={bloqueio ?? ""}>
            Voltar a herdar
          </Button>
        </span>
      ) : null}
    </div>
  );
}

/* ───────────────────────────── Campos ────────────────────────────── */

const CAMPO_VAZIO = { name: "", type: "text" as FieldType, options: "", required: false, description: "" };

export function FieldDefinitionsEditor({
  containerType,
  containerId,
  report,
}: {
  readonly containerType: ContainerType;
  readonly containerId: string;
  readonly report: Report;
}) {
  const run = useRun();
  const state = useData((data) => data);
  const bloqueio = useMayConfigure(containerType, containerId);
  const bloqueadoAcima = useBlockedAbove(containerType, containerId, "fieldDefinitions");
  const [aberto, setAberto] = useState(false);
  const [novo, setNovo] = useState(CAMPO_VAZIO);
  const [arquivando, setArquivando] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [edicao, setEdicao] = useState({ name: "", description: "", options: "" });
  const ids = useId();

  const proprias = state.fieldDefinitions.filter(
    (d) => d.target === "task" && d.lifecycle === "ativo" && d.definedAtType === containerType && d.definedAtId === containerId,
  );
  const selecao = novo.type === "singleSelect" || novo.type === "multiSelect";
  const aArquivar = state.fieldDefinitions.find((d) => d.id === arquivando);
  const valoresDe = (definitionId: string) => state.tasks.filter((t) => t.fieldValues.some((v) => v.definitionId === definitionId)).length;
  const separar = (texto: string) => texto.split(/[\n,]/).map((o) => o.trim()).filter(Boolean);

  const abrirEdicao = (definition: FieldDefinition) => {
    setEdicao({ name: definition.name, description: definition.description ?? "", options: (definition.options ?? []).join("\n") });
    setEditando(definition.id);
  };

  return (
    <div className="grid gap-3">
      <ConfirmDialog
        open={arquivando !== null}
        title={`Arquivar o Campo “${aArquivar?.name ?? ""}”?`}
        description={`Ele some das Listas deste caminho; ${valoresDe(arquivando ?? "")} Tarefa(s) preservam o valor gravado, só leitura. Dá para restaurá-lo depois em Configurações › Campos.`}
        confirmLabel="Arquivar"
        destructive
        onConfirm={() => {
          if (arquivando) report(run((data, me) => archiveFieldDefinition(data, me, arquivando)), "Campo arquivado.");
          setArquivando(null);
        }}
        onCancel={() => setArquivando(null)}
      />

      <ReadOnlyNote reason={bloqueio} />

      {proprias.length === 0 ? (
        <EmptyState compact title="Nenhum Campo definido neste nível." hint="Os herdados aparecem na lista acumulada." />
      ) : (
        <ul className="pilha-solta">
          {proprias.map((definition) => {
            const deSelecao = definition.type === "singleSelect" || definition.type === "multiSelect";
            return (
              <li key={definition.id} className="item-solto" data-bloco="true" data-estatico="true">
                {editando === definition.id ? (
                  <form
                    className="grid gap-2 py-1"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const result = run((data, me) =>
                        updateFieldDefinition(data, me, definition.id, {
                          name: edicao.name,
                          description: edicao.description,
                          ...(deSelecao ? { options: separar(edicao.options) } : {}),
                        }),
                      );
                      report(result, "Campo atualizado.");
                      if (result.ok) setEditando(null);
                    }}
                  >
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Field label="Nome">
                        {(id) => <TextInput id={id} value={edicao.name} onChange={(name) => setEdicao({ ...edicao, name })} />}
                      </Field>
                      <Field label="Descrição">
                        {(id) => <TextInput id={id} value={edicao.description} onChange={(description) => setEdicao({ ...edicao, description })} />}
                      </Field>
                    </div>
                    {deSelecao ? (
                      <Field label="Opções" hint="Uma por linha ou separadas por vírgula. Uma opção em uso em alguma Tarefa não pode sair.">
                        {(id) => (
                          <textarea id={id} value={edicao.options} onChange={(event) => setEdicao({ ...edicao, options: event.target.value })} rows={3} className={TEXTAREA} />
                        )}
                      </Field>
                    ) : null}
                    <span className="flex justify-end gap-2">
                      <Button onClick={() => setEditando(null)}>Cancelar</Button>
                      <Button
                        type="submit"
                        variant="primary"
                        disabled={edicao.name.trim() === "" || (deSelecao && separar(edicao.options).length === 0)}
                        disabledReason={edicao.name.trim() === "" ? "Dê um nome ao Campo." : "Informe ao menos uma opção."}
                      >
                        Salvar
                      </Button>
                    </span>
                  </form>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 flex-1">
                      <span className="app-base block truncate" style={{ color: "var(--texto)" }}>
                        {definition.name}
                      </span>
                      <span className="app-meta block">
                        {FIELD_TYPE_LABEL[definition.type] ?? definition.type}
                        {definition.options?.length ? ` · ${definition.options.join(", ")}` : ""}
                        {definition.required ? " · obrigatório" : ""}
                      </span>
                    </span>
                    <span id={`${ids}-obrig-${definition.id}`} className="app-sm" style={{ color: "var(--texto-3)" }}>
                      Obrigatório
                    </span>
                    <span title={bloqueio ?? "Obrigatório"} className="inline-flex">
                      <Toggle
                        checked={definition.required}
                        onChange={(required) =>
                          report(run((data, me) => updateFieldDefinition(data, me, definition.id, { required })), "Campo atualizado.")
                        }
                        labelledBy={`${ids}-obrig-${definition.id}`}
                        {...(bloqueio ? { describedBy: `${ids}-bloqueio` } : {})}
                        disabled={bloqueio !== undefined}
                      />
                    </span>
                    <ActionMenu
                      label={`Ações de ${definition.name}`}
                      items={[
                        { label: "Editar", onSelect: () => abrirEdicao(definition), ...(bloqueio ? { disabledReason: bloqueio } : {}) },
                        { label: "Arquivar", destructive: true, onSelect: () => setArquivando(definition.id), ...(bloqueio ? { disabledReason: bloqueio } : {}) },
                      ]}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {bloqueio ? (
        <span id={`${ids}-bloqueio`} hidden>
          {bloqueio}
        </span>
      ) : null}

      {aberto ? (
        <form
          className="grid gap-2 rounded-[var(--r-controle)] border border-dashed border-[var(--linha-forte)] p-3"
          onSubmit={(event) => {
            event.preventDefault();
            const result = run((data, me) =>
              createFieldDefinition(data, me, {
                name: novo.name,
                type: novo.type,
                ...(selecao ? { options: separar(novo.options) } : {}),
                required: novo.required,
                description: novo.description,
                definedAtType: containerType,
                definedAtId: containerId,
              }),
            );
            report(result, "Campo criado.");
            if (result.ok) {
              setNovo(CAMPO_VAZIO);
              setAberto(false);
            }
          }}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Nome">
              {(id) => <TextInput id={id} value={novo.name} onChange={(name) => setNovo({ ...novo, name })} placeholder="Ex.: Sprint" />}
            </Field>
            <Field label="Tipo">
              {(id) => (
                <Select
                  id={id}
                  value={novo.type}
                  onChange={(type) => setNovo({ ...novo, type: type as FieldType })}
                  options={TIPOS.map((t) => ({ value: t, label: FIELD_TYPE_LABEL[t] ?? t }))}
                />
              )}
            </Field>
          </div>
          {selecao ? (
            <Field label="Opções" hint="Uma por linha ou separadas por vírgula.">
              {(id) => <textarea id={id} value={novo.options} onChange={(event) => setNovo({ ...novo, options: event.target.value })} rows={3} className={TEXTAREA} />}
            </Field>
          ) : null}
          <Field label="Descrição" hint="A pergunta que o Campo responde — aparece abaixo do rótulo na Tarefa.">
            {(id) => <TextInput id={id} value={novo.description} onChange={(description) => setNovo({ ...novo, description })} />}
          </Field>
          <label className="app-base flex items-center gap-2" style={{ color: "var(--texto)" }}>
            <input type="checkbox" checked={novo.required} onChange={(event) => setNovo({ ...novo, required: event.target.checked })} className="size-4 accent-[var(--acento)]" />
            Obrigatório
          </label>
          <span className="flex justify-end gap-2">
            <Button onClick={() => setAberto(false)}>Cancelar</Button>
            <Button
              type="submit"
              variant="primary"
              disabled={novo.name.trim() === "" || (selecao && separar(novo.options).length === 0)}
              disabledReason={novo.name.trim() === "" ? "Dê um nome ao Campo." : "Informe as opções."}
            >
              Criar Campo
            </Button>
          </span>
        </form>
      ) : (
        <span>
          <Button onClick={() => setAberto(true)} icon={<Icone de={Plus} tamanho="sm" />} disabled={(bloqueio ?? bloqueadoAcima) !== undefined} disabledReason={bloqueio ?? bloqueadoAcima ?? ""}>
            Novo Campo neste nível
          </Button>
        </span>
      )}

      <CamposHerdados containerType={containerType} containerId={containerId} report={report} />
    </div>
  );
}

/**
 * Checklist 1.1 — os Campos que chegam de cima (Espaço, Pasta) e se este
 * contêiner os usa. Desligar um tira o Campo daqui e de baixo (a Lista de
 * Solicitações não precisa dos de Contas a pagar com o mesmo nome); quem o
 * define continua com ele. Um Campo deixado de fora mais acima só volta lá.
 */
function CamposHerdados({ containerType, containerId, report }: { readonly containerType: ContainerType; readonly containerId: string; readonly report: Report }) {
  const run = useRun();
  const state = useData((data) => data);
  const { memberId } = useSession();
  const bloqueio = useMayConfigure(containerType, containerId);
  const caminho = containerPath(state, containerType, containerId);
  const acima = caminho.slice(0, -1);
  const usados = new Set(effectiveContainerConfig(state, containerType, containerId)?.fieldDefinitionIds ?? []);
  const container =
    containerType === "list"
      ? state.lists.find((l) => l.id === containerId)
      : containerType === "folder"
        ? state.folders.find((f) => f.id === containerId)
        : state.spaces.find((s) => s.id === containerId);
  const foraAqui = new Set(container?.camposHerdadosFora ?? []);
  const herdados = state.fieldDefinitions.filter(
    (d) => d.target === "task" && d.lifecycle === "ativo" && d.definedAtId !== undefined && acima.some((n) => n.id === d.definedAtId),
  );
  if (herdados.length === 0) return null;
  const nomeDoNivel = (id: string | undefined) =>
    state.spaces.find((s) => s.id === id)?.name ?? state.folders.find((f) => f.id === id)?.name ?? state.lists.find((l) => l.id === id)?.name ?? id ?? "";

  return (
    <section aria-labelledby={`herdados-${containerId}`} className="grid gap-2">
      <h3 id={`herdados-${containerId}`} className="rotulo">
        Campos herdados
      </h3>
      <ul className="pilha-solta">
        {herdados.map((definition) => {
          const usado = usados.has(definition.id);
          const foraAcima = !usado && !foraAqui.has(definition.id);
          // Só quem configura onde o Campo nasce o deixa de fora (a mesma regra do domínio).
          const naOrigem = definition.definedAtType ? containerAdminRefusal(state, memberId, definition.definedAtType, definition.definedAtId!) : undefined;
          const rotulo = `herdado-${definition.id}`;
          return (
            <li key={definition.id} className="item-solto app-base flex flex-wrap items-center gap-2" data-estatico="true">
              <span className="min-w-0 flex-1">
                <span style={{ color: "var(--texto)" }}>{definition.name}</span>
                <span className="app-meta block">
                  {FIELD_TYPE_LABEL[definition.type] ?? definition.type} · de {nomeDoNivel(definition.definedAtId)}
                  {definition.required ? " · obrigatório" : ""}
                  {foraAcima ? " · deixado de fora mais acima" : ""}
                </span>
              </span>
              <span className="inline-flex items-center gap-2">
                <Toggle
                  checked={usado}
                  onChange={(usar) =>
                    report(
                      run((data, me) => usarCampoHerdado(data, me, containerType, containerId, definition.id, usar)),
                      usar ? `“${definition.name}” volta a ser usado aqui.` : `“${definition.name}” deixa de ser usado aqui.`,
                    )
                  }
                  labelledBy={rotulo}
                  disabled={bloqueio !== undefined || naOrigem !== undefined || foraAcima}
                />
                <span id={rotulo} className="app-meta">
                  usar aqui
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ───────────────────────────── Tipos de Tarefa ────────────────────────────── */

export function TaskTypesEditor({
  containerType,
  containerId,
  report,
}: {
  readonly containerType: ContainerType;
  readonly containerId: string;
  readonly report: Report;
}) {
  const run = useRun();
  const state = useData((data) => data);
  const bloqueio = useMayConfigure(containerType, containerId);
  const bloqueadoAcima = useBlockedAbove(containerType, containerId, "taskTypes");
  const [nome, setNome] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [nomeEditado, setNomeEditado] = useState("");
  const [removendo, setRemovendo] = useState<string | null>(null);

  const proprios = state.taskTypes.filter((t) => t.definedAtType === containerType && t.definedAtId === containerId);
  const emUso = (taskTypeId: string) => state.tasks.filter((t) => t.taskTypeId === taskTypeId).length;
  const aRemover = proprios.find((t) => t.id === removendo);

  return (
    <div className="grid gap-3">
      <ConfirmDialog
        open={removendo !== null}
        title={`Remover o Tipo “${aRemover?.name ?? ""}”?`}
        description="Ele deixa de existir para as Listas deste caminho. Nenhuma Tarefa é deste Tipo, então nada muda nelas."
        confirmLabel="Remover"
        destructive
        onConfirm={() => {
          if (removendo) report(run((data, me) => removeTaskType(data, me, removendo)), "Tipo de Tarefa removido.");
          setRemovendo(null);
        }}
        onCancel={() => setRemovendo(null)}
      />
      <ReadOnlyNote reason={bloqueio} />

      {proprios.length === 0 ? (
        <EmptyState compact title="Nenhum Tipo definido neste nível." hint="Os herdados aparecem na lista acumulada." />
      ) : (
        <ul className="pilha-solta">
          {proprios.map((taskType) => {
            const usos = emUso(taskType.id);
            const naoRemove = taskType.isPlatformDefault
              ? "O Tipo padrão da plataforma não pode ser removido."
              : usos > 0
                ? `${usos} Tarefa(s) são deste Tipo. Troque o Tipo delas antes.`
                : undefined;
            return (
              <li key={taskType.id} className="item-solto flex-wrap" data-estatico="true" style={{ paddingBlock: "var(--e-2)" }}>
                {editando === taskType.id ? (
                  <form
                    className="flex min-w-0 flex-1 items-center gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const result = run((data, me) => updateTaskType(data, me, taskType.id, { name: nomeEditado }));
                      report(result, "Tipo de Tarefa renomeado.");
                      if (result.ok) setEditando(null);
                    }}
                  >
                    <span className="min-w-0 flex-1">
                      <TextInput value={nomeEditado} onChange={setNomeEditado} placeholder="Nome do Tipo" />
                    </span>
                    <Button type="submit" variant="primary" disabled={nomeEditado.trim() === ""} disabledReason="Dê um nome ao Tipo.">
                      Salvar
                    </Button>
                    <Button onClick={() => setEditando(null)}>Cancelar</Button>
                  </form>
                ) : (
                  <>
                    <span className="app-base min-w-0 flex-1 truncate" style={{ color: "var(--texto)" }}>
                      {taskType.name}
                    </span>
                    <span className="app-sm app-numero shrink-0" style={{ color: "var(--texto-3)" }}>
                      {taskType.isPlatformDefault ? "padrão da plataforma" : `${usos} Tarefa(s)`}
                    </span>
                    <ActionMenu
                      label={`Ações de ${taskType.name}`}
                      items={[
                        {
                          label: "Renomear",
                          onSelect: () => {
                            setNomeEditado(taskType.name);
                            setEditando(taskType.id);
                          },
                          ...(bloqueio ? { disabledReason: bloqueio } : {}),
                        },
                        {
                          label: "Remover",
                          destructive: true,
                          onSelect: () => setRemovendo(taskType.id),
                          ...(bloqueio ?? naoRemove ? { disabledReason: bloqueio ?? naoRemove ?? "" } : {}),
                        },
                      ]}
                    />
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const result = run((data, me) => createTaskType(data, me, { name: nome, icon: "circle", definedAtType: containerType, definedAtId: containerId }));
          report(result, "Tipo de Tarefa criado.");
          if (result.ok) setNome("");
        }}
      >
        <span className="min-w-56 flex-1">
          <Field label="Novo Tipo de Tarefa neste nível">
            {(id) => <TextInput id={id} value={nome} onChange={setNome} placeholder="Ex.: Bug, Épico, Chamado" disabled={(bloqueio ?? bloqueadoAcima) !== undefined} />}
          </Field>
        </span>
        <Button
          type="submit"
          variant="primary"
          icon={<Icone de={Plus} tamanho="sm" />}
          disabled={nome.trim() === "" || (bloqueio ?? bloqueadoAcima) !== undefined}
          disabledReason={bloqueio ?? bloqueadoAcima ?? "Dê um nome ao Tipo."}
        >
          Criar
        </Button>
      </form>
    </div>
  );
}

/* ───────────────────────────── Funcionalidades ────────────────────────────── */

const FEATURE_LABEL: Record<keyof EnabledFeatures, string> = {
  prioridade: "Prioridade",
  registroDeTempo: "Registro de Tempo",
  estimativa: "Estimativa",
  dependencias: "Dependências",
  recorrencia: "Recorrência",
  subtarefas: "Subtarefas",
  checklists: "Checklists",
  exigirSubtarefasConcluidas: "Exigir Subtarefas concluídas para concluir a Tarefa",
  exigirChecklistsConcluidos: "Exigir Checklists concluídos para concluir a Tarefa",
  datasDeSubtarefasContidas: "Datas de Subtarefas contidas na Tarefa mãe",
  impedirConclusaoDeTarefaBloqueada: "Impedir concluir Tarefa bloqueada por Dependência",
  compartilhamentoPublico: "Compartilhamento público",
};

export function FeaturesEditor({
  containerType,
  containerId,
  features,
  own,
  report,
}: {
  readonly containerType: ContainerType;
  readonly containerId: string;
  /** O valor efetivo neste nó. */
  readonly features: EnabledFeatures;
  /** O que este nó define por conta própria. */
  readonly own: Partial<EnabledFeatures>;
  readonly report: Report;
}) {
  const run = useRun();
  const bloqueio = useMayConfigure(containerType, containerId);
  const bloqueadoAcima = useBlockedAbove(containerType, containerId, "features");
  const desligado = bloqueio ?? bloqueadoAcima;
  const ids = useId();
  return (
    <div className="grid gap-2">
      <ReadOnlyNote reason={desligado} />
      <ul className="pilha-solta">
        {(Object.keys(FEATURE_LABEL) as Array<keyof EnabledFeatures>).map((feature) => {
          const definidaAqui = own[feature] !== undefined;
          return (
            <li key={feature} className="item-solto flex-wrap justify-between" data-estatico="true" style={{ paddingBlock: "var(--e-2)" }}>
              <span id={`${ids}-${feature}`} className="app-base min-w-0 flex-1" style={{ color: "var(--texto)" }}>
                {FEATURE_LABEL[feature]}
                <span className="app-meta block">{definidaAqui ? "definida aqui" : "herdada"}</span>
              </span>
              {definidaAqui && !desligado ? (
                <Button size="sm" onClick={() => report(run((data, me) => setContainerFeature(data, me, containerType, containerId, feature, null)), "Funcionalidade volta a ser herdada.")}>
                  Voltar a herdar
                </Button>
              ) : null}
              <span title={desligado ?? FEATURE_LABEL[feature]} className="inline-flex">
                <Toggle
                  checked={features[feature]}
                  onChange={(v) => report(run((data, me) => setContainerFeature(data, me, containerType, containerId, feature, v)), v ? "Funcionalidade ativada." : "Funcionalidade desativada.")}
                  labelledBy={`${ids}-${feature}`}
                  disabled={desligado !== undefined}
                />
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
