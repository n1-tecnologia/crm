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
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { useState } from "react";
import { useData, useRun, useSession } from "@/dados/store";
import { FORMULARIOS_ANTES_DO_MODELO, LISTA_SEM_CANAIS, alterarModeloDaLista, definirCanaisDaLista, temFormularioAtivo } from "@n1/dominio/operations";
import type { TipoDeAtendimento } from "@n1/dominio/operations/canais";
import { AdicionarCanalDialog } from "@/features/crm/adicionar-canal-dialog";
import { CabecalhoDoAspecto } from "@/features/estrutura/cabecalho-do-aspecto";
import { CanaisDeAtendimento } from "@/features/estrutura/canais-de-atendimento";
import { useRecente } from "@/features/shell/recente";
import { FeaturesEditor, FieldDefinitionsEditor, StatusSetEditor, TaskTypesEditor, useMayConfigure } from "@/features/estrutura/configuration-editors";
import { EditorDeVisualizacoesPadrao } from "@/features/estrutura/editor-de-visualizacoes-padrao";
import { FormsEditor } from "@/features/estrutura/forms-editor";
import { CicloDeVidaDoConteiner, IdentidadeDoConteiner } from "@/features/estrutura/identidade-e-ciclo-de-vida";
import { CaixaDeConfiguracoes } from "@/features/ferramentas/caixa-de-configuracoes";
import { effectiveContainerConfig, memberReachesContainer } from "@n1/dominio/derive";
import { FIELD_TYPE_LABEL } from "@/features/shell/format";
import { Abas, CorpoDeTela, EmptyState, PageHeader, StateSeal, Toast, idDaAba, idDoPainel, type Aba } from "@/features/shell/ui";

/**
 * 2.1.8, D-17 — as Configurações em abas, com a aba na URL (`?aba=`). A tabela
 * didática de "aspectos" saiu: cada aba é UM assunto e diz de onde vem o valor.
 */
type ChaveDaAba = "geral" | "status" | "funcionalidades" | "campos" | "tipos-de-tarefa" | "visualizacoes" | "formularios" | "modelo-e-canais";

const ABAS: ReadonlyArray<{ readonly chave: ChaveDaAba; readonly rotulo: string; readonly soLista?: true }> = [
  { chave: "geral", rotulo: "Geral" },
  { chave: "status", rotulo: "Status" },
  { chave: "funcionalidades", rotulo: "Funcionalidades" },
  { chave: "campos", rotulo: "Campos" },
  { chave: "tipos-de-tarefa", rotulo: "Tipos de Tarefa" },
  { chave: "visualizacoes", rotulo: "Visualizações" },
  { chave: "formularios", rotulo: "Formulários", soLista: true },
  { chave: "modelo-e-canais", rotulo: "Modelo e canais", soLista: true },
];

/** O par `id` da aba / `id` do painel que `Abas` e o painel desta tela combinam (A13). */
const ID_BASE = "configuracoes";

const abasDoNivel = (tipo: "space" | "folder" | "list") => ABAS.filter((aba) => aba.soLista !== true || tipo === "list");

/**
 * T-10-21 — o `?aba=` é entrada de quem abre o link: só as chaves da lista
 * fechada DO NÍVEL valem, o resto cai em `geral`, e o valor nunca é desenhado.
 */
export function abaDasConfiguracoes(valor: string | null, tipo: "space" | "folder" | "list"): ChaveDaAba {
  return abasDoNivel(tipo).find((aba) => aba.chave === valor)?.chave ?? "geral";
}

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
  const router = useRouter();
  const pathname = usePathname();
  const query = useSearchParams();
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

  // 2.1.8 — a aba ativa vive em `?aba=` (A14): trocar substitui a entrada, não empilha histórico.
  const aba = abaDasConfiguracoes(query.get("aba"), kind);
  const abasVisiveis: ReadonlyArray<Aba> = abasDoNivel(kind).map(({ chave, rotulo }) => ({ chave, rotulo }));
  const trocarDeAba = (chave: string): void => {
    const proxima = new URLSearchParams(query.toString());
    proxima.set("aba", chave);
    router.replace(`${pathname}?${proxima}`, { scroll: false });
  };
  const criador = state.members.find((m) => m.id === container.createdBy.id)?.displayName ?? "Sistema";
  const fieldDefinitionIds = config?.fieldDefinitionIds ?? [];
  const taskTypeIds = config?.taskTypeIds ?? [];

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

      <Abas abas={abasVisiveis} ativa={aba} aoTrocar={trocarDeAba} rotulo="Configurações" idBase={ID_BASE} />

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

        <div className="max-w-3xl" role="tabpanel" id={idDoPainel(ID_BASE, aba)} aria-labelledby={idDaAba(ID_BASE, aba)}>
          {aba === "geral" ? (
            <div className="grid gap-3">
              {/* POSC-09 — nome, descrição, cor, privacidade; e o estado próprio. A chave
                  reinicia o formulário quando outra gravação (ou outro Membro) muda o registro. */}
              <IdentidadeDoConteiner key={`${container.id}:${container.name}:${container.description ?? ""}:${container.color ?? ""}:${String(container.isPrivate)}`} kind={kind} container={container} report={report} />
              {/* 2.1.9 — quem criou: o Membro, ou "Sistema" quando o registro veio do próprio sistema. */}
              <p className="app-meta">Criado por {criador}</p>
              <CicloDeVidaDoConteiner kind={kind} container={container} report={report} />
            </div>
          ) : null}

          {aba === "status" ? (
            config === null ? (
              <EmptyState
                compact
                title="Este contêiner não resolve um Conjunto de Status."
                hint="O Espaço acima dele precisa definir um: sem isso nenhuma Lista abaixo recebe Tarefas."
              />
            ) : (
              <>
                <CabecalhoDoAspecto tipo={kind} id={id} aspecto="statusSet" />
                <StatusSetEditor
                  containerType={kind}
                  containerId={id}
                  own={container.statusSet !== undefined}
                  set={config.statusSet}
                  definedAtName={config.statusSetDefinedAt.name}
                  report={report}
                />
              </>
            )
          ) : null}

          {aba === "funcionalidades" ? (
            config === null ? (
              <EmptyState compact title="Este contêiner não resolve as Funcionalidades." hint="Falta um Conjunto de Status no Espaço acima." />
            ) : (
              <>
                <CabecalhoDoAspecto tipo={kind} id={id} aspecto="features" />
                <FeaturesEditor containerType={kind} containerId={id} features={config.features} own={container.features ?? {}} report={report} />
              </>
            )
          ) : null}

          {aba === "campos" ? (
            <div className="grid gap-3">
              <CabecalhoDoAspecto tipo={kind} id={id} aspecto="fieldDefinitions" />
              {fieldDefinitionIds.length === 0 ? (
                <EmptyState compact title="Nenhuma Definição de Campo alcança este caminho." />
              ) : (
                <ul className="pilha-solta">
                  {fieldDefinitionIds.map((definitionId) => {
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
              <div className="pt-3" style={{ borderTop: "1px solid var(--linha)" }}>
                <FieldDefinitionsEditor containerType={kind} containerId={id} report={report} />
              </div>
            </div>
          ) : null}

          {aba === "tipos-de-tarefa" ? (
            <div className="grid gap-3">
              <CabecalhoDoAspecto tipo={kind} id={id} aspecto="taskTypes" />
              {taskTypeIds.length === 0 ? (
                <EmptyState compact title="Nenhum Tipo de Tarefa alcança este caminho." />
              ) : (
                <ul className="pilha-solta">
                  {taskTypeIds.map((taskTypeId) => {
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
              <div className="pt-3" style={{ borderTop: "1px solid var(--linha)" }}>
                <TaskTypesEditor containerType={kind} containerId={id} report={report} />
              </div>
            </div>
          ) : null}

          {aba === "visualizacoes" ? (
            config === null ? (
              <EmptyState compact title="Este contêiner não resolve as Visualizações padrão." hint="Falta um Conjunto de Status no Espaço acima." />
            ) : (
              <>
                <CabecalhoDoAspecto tipo={kind} id={id} aspecto="defaultViews" />
                <EditorDeVisualizacoesPadrao tipo={kind} id={id} conversacional={lista?.modeloDeTarefa === "conversacional"} />
              </>
            )
          ) : null}

          {aba === "formularios" && kind === "list" ? <FormsEditor listId={id} bloqueio={useMayConfigureReason} report={report} /> : null}

          {aba === "modelo-e-canais" && lista ? (
            <div className="grid gap-3">
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
              />

              {lista.modeloDeTarefa === "conversacional" ? (
                <div className="grid gap-2">
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
            </div>
          ) : null}
        </div>
      </CorpoDeTela>
    </div>
  );
}
