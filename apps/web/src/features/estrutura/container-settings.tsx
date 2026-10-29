"use client";

/**
 * T15/T17/T19 — configuration of a structural container (Space, Folder, List).
 * One component, three routes: the aspects are the same at every level, and
 * writing three near-identical screens would only let them drift apart.
 *
 * B25 is the whole screen. An aspect is `herdado`, `sobrescrito` or `bloqueado`,
 * and the three do NOT compose the same way:
 *   - statusSet, features and defaultViews SUBSTITUTE — the nearest level that
 *     defines the aspect wins, and nothing from above survives;
 *   - fieldDefinitions, taskTypes and automations ACCUMULATE along the path.
 * So the screen never shows a bare "herdado": it shows FROM WHERE, and what the
 * effective value ends up being.
 *
 * O esqueleto de tela mora aqui, e não nas três page.tsx que o hospedam: elas
 * só passam `kind` e `id`.
 */

import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { useState } from "react";
import { useData, useRun, useSession } from "@/dados/store";
import { FORMULARIOS_ANTES_DO_MODELO, LISTA_SEM_CANAIS, alterarModeloDaLista, definirCanaisDaLista, temFormularioAtivo } from "@n1/dominio/operations";
import type { TipoDeAtendimento } from "@n1/dominio/operations/canais";
import { AdicionarCanalDialog } from "@/features/crm/adicionar-canal-dialog";
import { CanaisDeAtendimento } from "@/features/estrutura/canais-de-atendimento";
import { useRecente } from "@/features/shell/recente";
import { FeaturesEditor, FieldDefinitionsEditor, StatusSetEditor, TaskTypesEditor, useMayConfigure } from "@/features/estrutura/configuration-editors";
import { FormsEditor } from "@/features/estrutura/forms-editor";
import { CicloDeVidaDoConteiner, IdentidadeDoConteiner } from "@/features/estrutura/identidade-e-ciclo-de-vida";
import { CaixaDeConfiguracoes } from "@/features/ferramentas/caixa-de-configuracoes";
import { effectiveContainerConfig, memberReachesContainer } from "@n1/dominio/derive";
import { FIELD_TYPE_LABEL } from "@/features/shell/format";
import { CabecalhoDePainel, CorpoDeTela, EmptyState, PageHeader, Painel, Pilula, Section, StateSeal, Toast } from "@/features/shell/ui";
import type { ConfigurableAspect, InheritanceMode } from "@n1/dominio/types";

const ASPECTS: ReadonlyArray<{
  readonly aspect: ConfigurableAspect;
  readonly label: string;
  readonly composition: "substitui" | "acumula";
  readonly explanation: string;
}> = [
  {
    aspect: "statusSet",
    label: "Conjunto de Status",
    composition: "substitui",
    explanation: "O nível mais próximo que define vence por inteiro; nada do nível acima sobrevive.",
  },
  {
    aspect: "features",
    label: "Funcionalidades",
    composition: "substitui",
    explanation: "Cada funcionalidade é decidida pelo nível mais próximo que a define.",
  },
  {
    aspect: "defaultViews",
    label: "Visualizações padrão",
    composition: "substitui",
    explanation: "As Visualizações do nível mais próximo substituem as de cima.",
  },
  {
    aspect: "fieldDefinitions",
    label: "Definições de Campo",
    composition: "acumula",
    explanation: "Somam-se ao longo do caminho: o que vem de cima continua valendo aqui.",
  },
  {
    aspect: "taskTypes",
    label: "Tipos de Tarefa",
    composition: "acumula",
    explanation: "Somam-se ao longo do caminho.",
  },
  {
    aspect: "automations",
    label: "Automações",
    composition: "acumula",
    explanation: "Somam-se ao longo do caminho.",
  },
];

const MODE_LABEL: Record<InheritanceMode, string> = {
  herdado: "herdado",
  sobrescrito: "sobrescrito",
};

/** A regra que antes era prosa sob o título; agora é o title da coluna que a aplica. */
const REGRA_DOS_MODOS = "Cada aspecto é herdado, sobrescrito ou bloqueado. Bloquear impede que qualquer nível abaixo sobrescreva.";

export function ContainerSettings({
  kind,
  id,
}: {
  readonly kind: "space" | "folder" | "list";
  readonly id: string;
}) {
  const state = useData((data) => data);
  const { memberId } = useSession();
  const run = useRun();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // C36 — o tipo cujo popup de "adicionar conta" está no ar.
  const [adicionando, setAdicionando] = useState<TipoDeAtendimento | null>(null);
  const recente = useRecente();
  const report = (result: { ok: boolean; error?: string }, message: string) => {
    if (result.ok) {
      setError(null);
      setNotice(message);
    } else {
      setNotice(null);
      setError(result.error ?? "Não foi possível concluir a operação.");
    }
  };

  const useMayConfigureReason = useMayConfigure(kind, id);
  const container =
    kind === "space"
      ? state.spaces.find((s) => s.id === id)
      : kind === "folder"
        ? state.folders.find((f) => f.id === id)
        : state.lists.find((l) => l.id === id);

  // B38 — privado sem concessão: não existe para quem não alcança, nem as configurações.
  if (!container || !memberReachesContainer(state, memberId, kind, id)) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Contêiner não encontrado" />
        <CorpoDeTela>
          <EmptyState
            title="Contêiner não encontrado."
            hint="Ele pode ter sido eliminado, ou você não tem permissão para vê-lo."
          />
        </CorpoDeTela>
      </div>
    );
  }

  // What a List created right here would consume — resolved from this node,
  // never borrowed from some List below (a List that overrides would lie).
  const config = effectiveContainerConfig(state, kind, id);
  const path = config?.path ?? [];
  const ancestors = path.slice(0, -1);

  const hrefOf = (node: { readonly type: string; readonly id: string }): string =>
    node.type === "space"
      ? `/estrutura/espacos/${node.id}`
      : node.type === "folder"
        ? `/estrutura/pastas/${node.id}`
        : `/estrutura/listas/${node.id}`;

  const backHref = hrefOf({ type: kind, id });

  // C35 — o modelo de Tarefa é atributo nativo da Lista (irmão de `isPrivate`),
  // não aspecto herdável: muda só enquanto ela está vazia, contando a lixeira.
  const lista = kind === "list" && "modeloDeTarefa" in container ? container : undefined;
  const temTarefas = lista ? state.tasks.some((t) => t.listId === lista.id) : false;
  // Virar conversacional com Formulário ativo é recusado pelo domínio: a
  // mesma frase desliga o Toggle antes do clique.
  const formularioSegura = lista !== undefined && lista.modeloDeTarefa !== "conversacional" && temFormularioAtivo(state, lista.id);
  const motivoDoModelo = temTarefas
    ? "O modelo de Tarefa não muda numa Lista que já tem Tarefas."
    : (useMayConfigureReason ?? (formularioSegura ? FORMULARIOS_ANTES_DO_MODELO : undefined));

  const definedHere = (aspect: ConfigurableAspect): boolean =>
    (container.modes[aspect] ?? "herdado") !== "herdado";

  const sourceOf = (aspect: ConfigurableAspect): string => {
    if (definedHere(aspect)) return "definido aqui";
    for (let i = ancestors.length - 1; i >= 0; i -= 1) {
      const node = ancestors[i];
      if (!node) continue;
      const ancestor =
        node.type === "space"
          ? state.spaces.find((s) => s.id === node.id)
          : node.type === "folder"
            ? state.folders.find((f) => f.id === node.id)
            : state.lists.find((l) => l.id === node.id);
      if (ancestor && (ancestor.modes[aspect] ?? "herdado") !== "herdado") {
        return `vem de ${node.name}`;
      }
    }
    return "padrão da plataforma";
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        path={
          <>
            {ancestors.map((node) => (
              <span key={node.id}>
                <Link href={hrefOf(node)} className="hover:underline">
                  {node.name}
                </Link>
                {" › "}
              </span>
            ))}
            <Link href={backHref} className="hover:underline">
              {container.name}
            </Link>
          </>
        }
        title={`Configurações de ${container.name}`}
        seal={<StateSeal state={container.lifecycle} />}
      />

      <CorpoDeTela>
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

        <Section title="Aspectos configuráveis">
          <table className="tabela">
            <thead>
              <tr>
                <th className="app-coluna">Aspecto</th>
                <th className="app-coluna" title={REGRA_DOS_MODOS}>
                  Neste nível
                </th>
                <th className="app-coluna">Origem do valor</th>
                <th className="app-coluna">Como compõe</th>
              </tr>
            </thead>
            <tbody>
              {ASPECTS.map((item) => {
                const mode = container.modes[item.aspect] ?? "herdado";
                // D-15: só Espaço e Pasta bloqueiam; a Lista é tratada como sem bloqueio.
                const blocked = "blocks" in container && container.blocks[item.aspect] === true;
                return (
                  <tr key={item.aspect}>
                    {/* Célula de duas linhas: pede o respiro vertical que a linha de uma só não pede. */}
                    <td className="py-2">
                      <span className="app-base block" style={{ color: "var(--texto)" }}>
                        {item.label}
                      </span>
                      <span className="app-meta block">{item.explanation}</span>
                    </td>
                    <td className="py-2">
                      <Pilula tom={mode === "sobrescrito" ? "info" : "neutro"}>{MODE_LABEL[mode]}</Pilula>
                      {blocked ? (
                        <span className="app-meta mt-1 block" style={{ color: "var(--aviso)" }}>
                          Nenhum nível abaixo pode sobrescrever.
                        </span>
                      ) : null}
                    </td>
                    <td>{sourceOf(item.aspect)}</td>
                    <td>{item.composition === "substitui" ? "substitui" : "acumula"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>

        {config === null ? (
          <Painel className="mb-3">
            <CabecalhoDePainel titulo="Valor efetivo" />
            <div className="p-3">
              <EmptyState
                compact
                title="Este contêiner não resolve um Conjunto de Status."
                hint="O Espaço acima dele precisa definir um: sem isso nenhuma Lista abaixo recebe Tarefas."
              />
            </div>
          </Painel>
        ) : (
          <div className="mb-3 grid gap-3 lg:grid-cols-2 lg:items-start">
            <Painel>
              <CabecalhoDePainel titulo="Conjunto de Status efetivo" />
              <div className="p-3">
                <p className="app-meta mb-2">
                  Definido em {config.statusSetDefinedAt.name}
                  {kind === "list" ? "" : ": é o que uma Lista criada aqui consome"}.
                </p>
                <StatusSetEditor
                  containerType={kind}
                  containerId={id}
                  own={container.statusSet !== undefined}
                  set={config.statusSet}
                  definedAtName={config.statusSetDefinedAt.name}
                  report={report}
                />
              </div>
            </Painel>

            <Painel>
              <CabecalhoDePainel titulo="Funcionalidades efetivas" />
              <div className="p-3">
                <FeaturesEditor containerType={kind} containerId={id} features={config.features} own={container.features ?? {}} report={report} />
              </div>
            </Painel>

            <Painel>
              <CabecalhoDePainel titulo="Definições de Campo acumuladas" contagem={config.fieldDefinitionIds.length} />
              <div className="p-3">
                {config.fieldDefinitionIds.length === 0 ? (
                  <EmptyState compact title="Nenhuma Definição de Campo alcança este caminho." />
                ) : (
                  <ul className="pilha-solta">
                    {config.fieldDefinitionIds.map((definitionId) => {
                      const definition = state.fieldDefinitions.find((d) => d.id === definitionId);
                      return (
                        <li key={definitionId} className="item-solto flex-wrap justify-between" data-estatico="true">
                          <span className="app-base min-w-0 truncate" style={{ color: "var(--texto)" }}>
                            {definition?.name ?? definitionId}
                          </span>
                          <span className="app-meta shrink-0">
                            {definition ? (FIELD_TYPE_LABEL[definition.type] ?? definition.type) : "—"}
                            {definition?.required ? " · obrigatório" : ""}
                            {definition?.definedAtId && definition.definedAtId !== id
                              ? ` · de ${path.find((n) => n.id === definition.definedAtId)?.name ?? "acima"}`
                              : ""}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--linha)" }}>
                  <FieldDefinitionsEditor containerType={kind} containerId={id} report={report} />
                </div>
              </div>
            </Painel>

            {kind === "list" ? (
              <Painel>
                <CabecalhoDePainel titulo="Formulários" />
                <div className="p-3">
                  <FormsEditor listId={id} bloqueio={useMayConfigureReason} report={report} />
                </div>
              </Painel>
            ) : null}

            <Painel>
              <CabecalhoDePainel titulo="Tipos de Tarefa acumulados" contagem={config.taskTypeIds.length} />
              <div className="p-3">
                {config.taskTypeIds.length === 0 ? (
                  <EmptyState compact title="Nenhum Tipo de Tarefa alcança este caminho." />
                ) : (
                  <ul className="pilha-solta">
                    {config.taskTypeIds.map((taskTypeId) => {
                      const taskType = state.taskTypes.find((t) => t.id === taskTypeId);
                      return (
                        <li key={taskTypeId} className="item-solto" data-estatico="true">
                          <span className="app-base min-w-0 flex-1 truncate" style={{ color: "var(--texto)" }}>
                            {taskType?.name ?? taskTypeId}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--linha)" }}>
                  <TaskTypesEditor containerType={kind} containerId={id} report={report} />
                </div>
              </div>
            </Painel>
          </div>
        )}

        {lista ? (
          <div className="mb-3">
            <CaixaDeConfiguracoes
              rotulo="Modelo de Tarefa"
              linhas={[
                {
                  chave: "conversacional",
                  titulo: "Tarefas conversacionais",
                  dica: "Cada Tarefa nasce de um Contato e traz a conversa dele; a Lista tem acesso ao CRM. Desligado: Tarefa operacional, a padrão.",
                  icone: MessageSquare,
                  ligado: lista.modeloDeTarefa === "conversacional",
                  onChange: (ligado) =>
                    report(
                      run((data, me) => alterarModeloDaLista(data, me, lista.id, ligado ? "conversacional" : "operacional")),
                      ligado ? "Agora cada Tarefa desta Lista nasce de um Contato." : "As Tarefas desta Lista voltam ao modelo operacional.",
                    ),
                  ...(motivoDoModelo ? { motivo: motivoDoModelo } : {}),
                },
              ]}
              ajuda="O modelo é da Lista e não herda: uma Pasta pode ter Listas dos dois modelos."
            />
          </div>
        ) : null}

        {lista && lista.modeloDeTarefa === "conversacional" ? (
          <div className="mb-3 grid gap-2">
            {/* C36 — por onde a Lista atende, gravado na hora; a última conta não sai. */}
            {(lista.canaisDeAtendimento ?? []).length === 0 ? (
              <p role="status" className="app-sm rounded-[var(--r-controle)] px-3 py-2" style={{ background: "var(--aviso-lavado)", color: "var(--aviso)" }}>
                {LISTA_SEM_CANAIS} Até lá, nenhuma Tarefa nasce nela.
              </p>
            ) : null}
            <CanaisDeAtendimento
              valor={lista.canaisDeAtendimento ?? []}
              onChange={(ids) =>
                report(
                  run((data, me) => definirCanaisDaLista(data, me, lista.id, ids)),
                  "Canais de atendimento atualizados.",
                )
              }
              onAdicionar={setAdicionando}
              {...(useMayConfigureReason ? { motivo: useMayConfigureReason } : {})}
              podeFicarVazio={(lista.canaisDeAtendimento ?? []).length === 0}
              recente={recente}
            />
            <AdicionarCanalDialog
              {...(adicionando ? { tipo: adicionando } : {})}
              open={adicionando !== null}
              onClose={() => setAdicionando(null)}
              onDone={(canal) => {
                setAdicionando(null);
                report(
                  run((data, me) => definirCanaisDaLista(data, me, lista.id, [...(lista.canaisDeAtendimento ?? []), canal.id])),
                  `${canal.name} conectado e marcado nesta Lista.`,
                );
              }}
            />
          </div>
        ) : null}

        {/* POSC-09 — nome, descrição, cor, privacidade; e o estado próprio. A chave
            reinicia o formulário quando outra gravação (ou outro Membro) muda o registro. */}
        <IdentidadeDoConteiner key={`${container.id}:${container.name}:${container.description ?? ""}:${container.color ?? ""}:${String(container.isPrivate)}`} kind={kind} container={container} report={report} />
        <CicloDeVidaDoConteiner kind={kind} container={container} report={report} />
      </CorpoDeTela>
    </div>
  );
}
