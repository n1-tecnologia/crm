"use client";

/**
 * A FICHA DO AGENTE (17) no formato das fichas de IA: o Construtor grava
 * Versões; a ficha governa o estado (D1). Cabeçalho com o selo, a Versão
 * corrente e a Disponibilidade com os motivos (11.4); o botão primário muda
 * com o estado — [Ativar] para rascunho e pausado, [Ensaiar] para ativo — e
 * o menu carrega o resto da governança (pausar, transferir, arquivar,
 * lixeira), sempre com a recusa que a operação daria (§11).
 *
 * Os painéis são as três origens do que o Agente pode fazer, separadas de
 * propósito: Habilidades concedidas (a única origem de executar, RN-HAB-12),
 * Ferramentas permitidas (o que ele PODE tentar, sem permissão sobre registro
 * algum, DO-HAB-14) e Conhecimento acessível (visão derivada das Concessões
 * gravadas na Coleção, DO-CNH-12). Conceder, revogar, permitir e retirar
 * criam Versão (RN-AGE-06, D8); dar Coleção não.
 *
 * `?ensaiar=1` na URL abre o ensaio direto — é o atalho do catálogo.
 */

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Bot } from "lucide-react";
import { useData, useRun, useSession } from "@/data/store";
import {
  apagarItemDeMemoria,
  arquivarAgente,
  ativarAgente,
  cancelarExecucao,
  enviarAgenteALixeira,
  fixarVersaoDaConcessao,
  motivoParaNaoAtivar,
  pausarAgente,
  recusaDeGovernarAgente,
  recusaDeRestaurarAgente,
  recusaNaColecao,
  restoreAgent,
  retirarFerramenta,
  revogarColecao,
  revogarHabilidade,
} from "@/data/operations";
import { conhecimentoAcessivel, disponibilidadeDaConcessao, disponibilidadeDoAgente, versaoCorrenteDaHabilidade, versaoCorrenteDoAgente } from "@/data/derive-ia";
import type { AgentExecution, CollectionGrant, SkillGrant } from "@/data/types";
import { useAvisos, useNomeDoAtor } from "@/features/shell/ficha";
import { AUTONOMY_LABEL, EFFECT_CLASS_LABEL, EXECUTION_ORIGIN_LABEL, EXECUTION_STATE_LABEL, LIFECYCLE_LABEL } from "@/features/shell/format";
import { marcarSeMuda, useNavegar } from "@/features/shell/navegacao";
import { useRecente } from "@/features/shell/recente";
import {
  ActionMenu,
  Button,
  CabecalhoDePainel,
  ConditionMarker,
  ConfirmDialog,
  CorpoDeTela,
  EmptyState,
  Field,
  Icone,
  PageHeader,
  Painel,
  Pilula,
  RecordPanel,
  RecordRow,
  Select,
  StateSeal,
} from "@/features/shell/ui";
import { useFormat } from "@/features/shell/use-format";
import { ConcederColecaoDialog } from "../conhecimento/conceder-colecao-dialog";
import { GRANT_ACTION_LABEL } from "../conhecimento/rotulos";
import { ConcederHabilidadeDialog } from "../habilidades/conceder-habilidade-dialog";
import { CLASSE_DE_EFEITO_TOM, DISPONIBILIDADE_TOM } from "../rotulos";
import { EnsaiarDialog } from "./ensaiar-dialog";
import { PermitirFerramentaDialog } from "./permitir-ferramenta-dialog";
import { TransferirAgenteDialog } from "./transferir-agente-dialog";

type Dialogo =
  | { readonly tipo: "ensaiar" }
  | { readonly tipo: "transferir" }
  | { readonly tipo: "arquivar" }
  | { readonly tipo: "lixeira" }
  | { readonly tipo: "concederHabilidade" }
  | { readonly tipo: "permitirFerramenta" }
  | { readonly tipo: "darColecao"; readonly colecaoId?: string }
  | { readonly tipo: "fixar"; readonly grantId: string }
  | { readonly tipo: "revogar"; readonly grantId: string }
  | { readonly tipo: "apagarMemoria"; readonly itemId: string };

const ESTADOS_TERMINAIS: ReadonlySet<AgentExecution["state"]> = new Set(["concluida", "falhou", "cancelada"]);

const FORMATO: Record<string, string> = { texto: "Texto livre", markdown: "Markdown", json: "JSON", estruturado: "Formato estruturado" };
const ACESSO: Record<string, string> = { chat: "Chat da plataforma", whatsapp: "WhatsApp", api: "API", webhook: "Webhook" };

export function AgenteCompleto({ agentId }: { readonly agentId: string }) {
  const state = useData((data) => data);
  const run = useRun();
  const fmt = useFormat();
  const { memberId } = useSession();
  const { avisos, report } = useAvisos();
  const authorLabel = useNomeDoAtor();
  const recente = useRecente();
  const [navegar] = useNavegar();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // `?ensaiar=1` é o atalho do catálogo: abre o diálogo já na chegada. O pedido é lido UMA vez, na montagem, e vira
  // estado; a URL é limpa no ato. Se o diálogo dependesse da URL, o Voltar da Execução — que cai na entrada de
  // histórico com `?ensaiar=1`, porque o `replace` de fechar não assenta antes do `push` da Execução — o reabriria.
  const [dialogo, setDialogo] = useState<Dialogo | null>(() => (searchParams.get("ensaiar") === "1" ? { tipo: "ensaiar" } : null));
  useEffect(() => {
    if (searchParams.get("ensaiar") === "1") router.replace(pathname, { scroll: false });
  }, [searchParams, pathname, router]);
  // Ferramentas não têm id de Concessão: a ficha lembra qual foi tocada para acender a linha certa.
  const [ferramentaTocada, setFerramentaTocada] = useState<{ readonly id: string; readonly acao: "permitir" | "retirar" } | null>(null);

  const record = state.agents.find((a) => a.id === agentId);
  if (!record) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Registro não encontrado" />
        <CorpoDeTela>
          <EmptyState title="Agente não encontrado." hint="Ele pode ter sido eliminado, ou você não tem permissão para vê-lo." />
        </CorpoDeTela>
      </div>
    );
  }

  const corrente = versaoCorrenteDoAgente(record);
  const padrao = state.workspace.defaultAgentId === record.id;
  const disponibilidade = disponibilidadeDoAgente(state, record);
  const recusaEditar = recusaDeGovernarAgente(state, memberId, record, "editar");
  const recusaAdministrar = recusaDeGovernarAgente(state, memberId, record, "administrar");
  const foraDeEdicao = record.lifecycle === "arquivado" || record.lifecycle === "naLixeira" ? "Restaure o Agente antes de editar." : undefined;
  // A recusa comum a tudo que muda a configuração — as mesmas frases de `agentes.ts`.
  const recusaConfig = recusaEditar ?? foraDeEdicao;

  const motivoAtivar =
    recusaAdministrar ??
    (record.lifecycle === "naLixeira"
      ? "Restaure o Agente da lixeira antes."
      : record.lifecycle === "arquivado"
        ? "Desarquive o Agente antes: ele volta a pausado (B94)."
        : record.lifecycle === "ativo"
          ? "O Agente já está ativo."
          : motivoParaNaoAtivar(state, corrente));
  const motivoPausar = recusaAdministrar ?? (padrao ? "O Assistente padrão nunca é pausado (INV-AGE-11)." : record.lifecycle !== "ativo" ? "Só um Agente ativo é pausado." : undefined);
  const motivoEnsaiar =
    recusaEditar ??
    (record.lifecycle !== "rascunho" && record.lifecycle !== "ativo"
      ? "Só um Agente em rascunho ou ativo ensaia (DO-AGE-13)."
      : !corrente?.instructions.trim()
        ? "Escreva as instruções antes de ensaiar: sem elas o Agente não sabe o que fazer."
        : undefined);
  const motivoTransferir = recusaAdministrar ?? (padrao ? "O Assistente padrão acompanha o Proprietário do Espaço de Trabalho (B33)." : undefined);
  const motivoArquivar = recusaAdministrar ?? (padrao ? "O Assistente padrão não é arquivado (INV-AGE-11)." : record.lifecycle === "naLixeira" ? "Restaure o Agente da lixeira antes." : undefined);
  const motivoLixeira = recusaAdministrar ?? (padrao ? "O Assistente padrão não vai à lixeira (INV-AGE-11)." : undefined);
  // Desarquivar/Restaurar: `administrar` e o nome livre (RN-AGE-02) — a frase que `restoreAgent` diria.
  const motivoRestaurar = recusaDeRestaurarAgente(state, memberId, record);
  const recusaConceder = recusaEditar ?? (foraDeEdicao ? "Um Agente arquivado ou na lixeira não recebe Concessões." : undefined);
  const recusaDarColecao = record.lifecycle === "naLixeira" ? "Um Agente na lixeira não recebe acesso." : undefined;

  const concessoes = state.skillGrants.filter((g) => g.agentId === record.id);
  const ferramentas = corrente?.allowedToolIds ?? [];
  const acessos = state.collectionGrants.filter((g) => g.agentId === record.id);
  const acessiveis = conhecimentoAcessivel(state, record.id);
  // O que o Construtor declarou como "base" e ainda não virou Concessão: declaração, não acesso.
  const declaradasSemConcessao = (corrente?.knowledgeSources ?? []).filter(
    (k) => k.kind === "base" && !acessos.some((g) => state.collections.find((c) => c.id === g.collectionId)?.name === k.label),
  );
  const execucoes = state.agentExecutions.filter((e) => e.agentId === record.id).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const versoes = [...record.versions].sort((a, b) => b.number - a.number);
  const activity = state.activity.filter((a) => a.objectId === record.id);
  const tarefasAtribuidas = state.tasks.filter((t) => t.assignees.some((a) => a.kind === "agent" && a.id === record.id)).length;
  const conversasAtribuidas = state.conversations.filter((c) => c.assignee?.kind === "agent" && c.assignee.id === record.id).length;
  const liberacao = `${tarefasAtribuidas} Tarefa(s) e ${conversasAtribuidas} Conversa(s) ficam sem este Responsável no ato (RN-AGE-20)`;

  const fechar = () => setDialogo(null);
  const ativar = () => report(run((data, me) => ativarAgente(data, me, record.id)), `${record.name} ativado.`);
  const pausar = () => report(run((data, me) => pausarAgente(data, me, record.id)), `${record.name} pausado: responsabilidades preservadas, Execuções em curso terminam (RN-AGE-19).`);
  const restaurar = () =>
    report(
      run((data, me) => restoreAgent(data, me, record.id)),
      record.lifecycle === "arquivado" ? `${record.name} desarquivado: volta a pausado (B94).` : `${record.name} restaurado da lixeira.`,
    );
  const retirar = (toolId: string, nome: string) => {
    setFerramentaTocada({ id: toolId, acao: "retirar" });
    report(run((data, me) => retirarFerramenta(data, me, record.id, toolId)), `Ferramenta “${nome}” retirada · Versão ${(corrente?.number ?? 0) + 1}.`);
  };

  const menu = [
    { label: "Editar no Construtor", onSelect: () => navegar(`/ia/agentes?editar=${record.id}`), ...(recusaConfig ? { disabledReason: recusaConfig } : {}) },
    { label: "Ensaiar", onSelect: () => setDialogo({ tipo: "ensaiar" }), ...(motivoEnsaiar ? { disabledReason: motivoEnsaiar } : {}) },
    record.lifecycle === "ativo"
      ? { label: "Pausar", onSelect: pausar, ...(motivoPausar ? { disabledReason: motivoPausar } : {}) }
      : { label: "Ativar", onSelect: ativar, ...(motivoAtivar ? { disabledReason: motivoAtivar } : {}) },
    { label: "Transferir propriedade…", onSelect: () => setDialogo({ tipo: "transferir" }), ...(motivoTransferir ? { disabledReason: motivoTransferir } : {}) },
    record.lifecycle === "arquivado"
      ? { label: "Desarquivar", onSelect: restaurar, ...(motivoRestaurar ? { disabledReason: motivoRestaurar } : {}) }
      : { label: "Arquivar", destructive: true, onSelect: () => setDialogo({ tipo: "arquivar" }), ...(motivoArquivar ? { disabledReason: motivoArquivar } : {}) },
    record.lifecycle === "naLixeira"
      ? { label: "Restaurar", onSelect: restaurar, ...(motivoRestaurar ? { disabledReason: motivoRestaurar } : {}) }
      : { label: "Enviar à lixeira", destructive: true, onSelect: () => setDialogo({ tipo: "lixeira" }), ...(motivoLixeira ? { disabledReason: motivoLixeira } : {}) },
  ];

  const primario =
    record.lifecycle === "ativo" ? (
      <Button variant="primary" size="sm" onClick={() => setDialogo({ tipo: "ensaiar" })} disabled={motivoEnsaiar !== undefined} {...(motivoEnsaiar ? { disabledReason: motivoEnsaiar } : {})}>
        Ensaiar
      </Button>
    ) : record.lifecycle === "rascunho" || record.lifecycle === "pausado" ? (
      <Button variant="primary" size="sm" onClick={ativar} disabled={motivoAtivar !== undefined} {...(motivoAtivar ? { disabledReason: motivoAtivar } : {})}>
        Ativar
      </Button>
    ) : (
      <Button variant="primary" size="sm" onClick={restaurar} disabled={motivoRestaurar !== undefined} {...(motivoRestaurar ? { disabledReason: motivoRestaurar } : {})}>
        {record.lifecycle === "arquivado" ? "Desarquivar" : "Restaurar"}
      </Button>
    );

  const concessaoEmDialogo = dialogo?.tipo === "fixar" || dialogo?.tipo === "revogar" ? concessoes.find((g) => g.id === dialogo.grantId) : undefined;
  const memoriaEmDialogo = dialogo?.tipo === "apagarMemoria" ? record.memory.find((m) => m.id === dialogo.itemId) : undefined;
  const colecaoParaDar = dialogo?.tipo === "darColecao" ? dialogo.colecaoId : undefined;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={<Icone de={Bot} tamanho="sm" />}
        title={record.name}
        seal={
          <>
            <StateSeal state={record.lifecycle} />
            {corrente ? <Pilula tom="info">v{corrente.number}</Pilula> : null}
            {padrao ? <Pilula tom="acento">Assistente padrão</Pilula> : null}
            {disponibilidade.disponivel ? (
              <Pilula tom={DISPONIBILIDADE_TOM.disponivel}>disponível</Pilula>
            ) : (
              <ConditionMarker tone="warning" title="Recalculada a cada leitura (11.4)">
                indisponível: {disponibilidade.motivos.join(" · ")}
              </ConditionMarker>
            )}
          </>
        }
        actions={
          <>
            {primario}
            <ActionMenu items={menu} />
          </>
        }
      />

      {/* O motivo de a ficha ser só leitura, antes de qualquer controle desligado. */}
      {recusaConfig ? (
        <p className="app-base shrink-0 px-4 py-2" style={{ background: "var(--aviso-lavado)", color: "var(--aviso)", borderBottom: "1px solid var(--linha)" }}>
          {recusaConfig}
        </p>
      ) : null}

      <CorpoDeTela>
        {avisos}
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
          {/* ------------------------------------------------ coluna principal */}
          <div className="grid min-w-0 content-start gap-3">
            <Painel className="min-w-0">
              <CabecalhoDePainel
                titulo="Habilidades concedidas"
                contagem={concessoes.length}
                acao={
                  <Button size="sm" onClick={() => setDialogo({ tipo: "concederHabilidade" })} disabled={recusaConceder !== undefined} {...(recusaConceder ? { disabledReason: recusaConceder } : {})}>
                    Conceder Habilidade
                  </Button>
                }
              />
              <div className="p-3">
                {concessoes.length === 0 ? (
                  <EmptyState
                    compact
                    title="Nenhuma Habilidade concedida."
                    hint="O Agente age apenas com as instruções, as Ferramentas permitidas e o Conhecimento a que tem acesso. A Concessão é a única origem de executar (RN-HAB-12)."
                  />
                ) : (
                  <ul className="pilha-solta cascata">
                    {concessoes.map((grant) => (
                      <LinhaDeHabilidade
                        key={grant.id}
                        grant={grant}
                        recente={grant.id === recente}
                        recusa={recusaConfig}
                        onFixar={() => setDialogo({ tipo: "fixar", grantId: grant.id })}
                        onSeguir={() => report(run((data, me) => fixarVersaoDaConcessao(data, me, grant.id, null)), "A Concessão passa a seguir a corrente.")}
                        onRevogar={() => setDialogo({ tipo: "revogar", grantId: grant.id })}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </Painel>

            <Painel className="min-w-0">
              <CabecalhoDePainel
                titulo="Ferramentas permitidas"
                contagem={ferramentas.length}
                acao={
                  <Button size="sm" onClick={() => setDialogo({ tipo: "permitirFerramenta" })} disabled={recusaConfig !== undefined} {...(recusaConfig ? { disabledReason: recusaConfig } : {})}>
                    Permitir Ferramenta
                  </Button>
                }
              />
              <div className="grid gap-3 p-3">
                <p className="app-meta">Permitir uma Ferramenta não concede permissão sobre nenhum registro (DO-HAB-14): é só o que o Agente pode tentar. Permitir e retirar criam Versão (RN-AGE-06).</p>
                {ferramentas.length === 0 ? (
                  <EmptyState compact title="Nenhuma Ferramenta permitida." hint="O Agente é puramente conversacional: responde, mas não lê nem altera registro algum." />
                ) : (
                  <ul className="pilha-solta cascata">
                    {ferramentas.map((toolId) => {
                      const tool = state.tools.find((t) => t.id === toolId);
                      const integracao = tool?.integrationId ? state.integrations.find((i) => i.id === tool.integrationId) : undefined;
                      const desconectada = tool?.origin === "integracao" && (!integracao || integracao.state !== "conectada");
                      const tocada = recente === record.id && ferramentaTocada?.id === toolId;
                      return (
                        <li
                          key={toolId}
                          className={`item-solto${tocada && ferramentaTocada?.acao === "permitir" ? " surgir" : ""}`}
                          data-estatico="true"
                          data-recente={tocada || undefined}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="app-base block truncate" style={{ color: "var(--texto)" }}>
                              {tool?.name ?? toolId}
                            </span>
                            {tool?.description && tool.description !== tool.name ? <span className="app-meta block truncate">{tool.description}</span> : null}
                          </span>
                          <span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                            {tool ? (
                              <Pilula tom={CLASSE_DE_EFEITO_TOM[tool.effectClass]}>{EFFECT_CLASS_LABEL[tool.effectClass] ?? tool.effectClass}</Pilula>
                            ) : (
                              <ConditionMarker tone="danger">não está no Catálogo</ConditionMarker>
                            )}
                            {desconectada ? (
                              <ConditionMarker tone="warning" title="Cessa quando a Integração reconectar (7.7)">
                                inoperante: Integração {integracao?.name ?? "desconhecida"} desconectada
                              </ConditionMarker>
                            ) : null}
                          </span>
                          <ActionMenu
                            label={`Ações da Ferramenta ${tool?.name ?? toolId}`}
                            items={[{ label: "Retirar", destructive: true, onSelect: () => retirar(toolId, tool?.name ?? toolId), ...(recusaConfig ? { disabledReason: recusaConfig } : {}) }]}
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </Painel>

            <Painel className="min-w-0">
              <CabecalhoDePainel
                titulo="Conhecimento acessível"
                contagem={acessiveis.length}
                acao={
                  <Button size="sm" onClick={() => setDialogo({ tipo: "darColecao" })} disabled={recusaDarColecao !== undefined} {...(recusaDarColecao ? { disabledReason: recusaDarColecao } : {})}>
                    Dar Coleção
                  </Button>
                }
              />
              <div className="grid gap-3 p-3">
                <p className="app-meta">Visão derivada das Concessões gravadas em cada Coleção (DO-CNH-12); na consulta vale a interseção com quem delega (A9.3). Não cria Versão.</p>
                {acessos.length === 0 && declaradasSemConcessao.length === 0 ? (
                  <EmptyState compact title="Nenhuma Coleção acessível." hint="Sem Concessão, o Agente não consulta Documento algum." />
                ) : (
                  <ul className="pilha-solta cascata">
                    {acessos.map((grant) => (
                      <LinhaDeColecao
                        key={grant.id}
                        grant={grant}
                        recente={grant.id === recente}
                        onRevogar={(mensagem) => report(run((data, me) => revogarColecao(data, me, grant.id)), mensagem)}
                      />
                    ))}
                    {declaradasSemConcessao.map((k) => {
                      const colecao = state.collections.find((c) => c.name === k.label && c.lifecycle === "ativo");
                      return (
                        <li key={`declarada-${k.label}`} className="item-solto" data-estatico="true">
                          <span className="min-w-0 flex-1">
                            <span className="app-base block truncate" style={{ color: "var(--texto)" }}>
                              {k.label}
                            </span>
                            {!colecao ? <span className="app-meta block">Nenhuma Coleção ativa com este nome.</span> : null}
                          </span>
                          <ConditionMarker tone="warning" title="A declaração do Construtor não dá acesso: só a Concessão na Coleção (RN-HAB-10)">
                            declarada no Construtor, sem concessão
                          </ConditionMarker>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDialogo({ tipo: "darColecao", ...(colecao ? { colecaoId: colecao.id } : {}) })}
                            disabled={recusaDarColecao !== undefined}
                            {...(recusaDarColecao ? { disabledReason: recusaDarColecao } : {})}
                          >
                            Conceder
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </Painel>

            <Painel className="min-w-0">
              <CabecalhoDePainel titulo="Execuções" contagem={execucoes.length} />
              <div className="p-3">
                {execucoes.length === 0 ? (
                  <EmptyState compact title="Nenhuma Execução ainda." hint="Um ensaio é a primeira: escritas simuladas, sem efeito (B82)." />
                ) : (
                  <ul className="pilha-solta cascata">
                    {execucoes.map((execution) => {
                      const href = `/ia/execucoes/${execution.id}`;
                      const terminal = ESTADOS_TERMINAIS.has(execution.state);
                      const delegante = execution.delegate?.kind === "member" && execution.delegate.id === memberId;
                      const motivoCancelar = !delegante && recusaAdministrar ? "Cancelar exige administrar o Agente ou ser o delegante da Execução (RN-AGE-21)." : undefined;
                      return (
                        <li key={execution.id} className="item-solto" data-recente={execution.id === recente || undefined}>
                          <Link href={href} onNavigate={() => marcarSeMuda(href)} className="min-w-0 flex-1">
                            <span className="app-base block truncate underline-offset-2 hover:underline" style={{ color: "var(--texto)" }}>
                              {execution.input || "(sem pedido)"}
                            </span>
                            <span className="app-meta block truncate">
                              {EXECUTION_STATE_LABEL[execution.state] ?? execution.state} · origem: {EXECUTION_ORIGIN_LABEL[execution.origin] ?? execution.origin} · v{execution.agentVersion} · {fmt.relative(execution.startedAt)}
                            </span>
                          </Link>
                          <span className="flex shrink-0 items-center gap-1.5">
                            {execution.rehearsal ? <Pilula tom="info">ensaio</Pilula> : null}
                            <span className="app-meta app-numero">{execution.steps.length} passo(s)</span>
                          </span>
                          {!terminal ? (
                            <ActionMenu
                              label={`Ações da Execução ${execution.id}`}
                              items={[
                                {
                                  label: "Cancelar",
                                  destructive: true,
                                  onSelect: () => report(run((data, me) => cancelarExecucao(data, me, execution.id)), "Execução cancelada: o que já saiu, saiu; as Solicitações pendentes morrem com ela."),
                                  ...(motivoCancelar ? { disabledReason: motivoCancelar } : {}),
                                },
                              ]}
                            />
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </Painel>

            <Painel className="min-w-0">
              <CabecalhoDePainel titulo="Memória do Agente" contagem={record.memory.length} />
              <div className="p-3">
                {record.memory.length === 0 ? (
                  <EmptyState compact title="Nenhum fato memorizado." hint="Um ensaio nunca grava Memória (B82)." />
                ) : (
                  <ul className="pilha-solta cascata">
                    {record.memory.map((item) => (
                      <li key={item.id} className="item-solto" data-alinhamento="topo" data-estatico="true">
                        <span className="min-w-0 flex-1">
                          <span className="app-base block" style={{ color: "var(--texto)" }}>
                            {item.content}
                          </span>
                          <span className="app-meta block">
                            origem: {item.origin === "membro" ? "Membro" : "Agente"} · {fmt.relative(item.createdAt)}
                            {item.lastUsedAt ? ` · usada ${fmt.relative(item.lastUsedAt)}` : ""}
                          </span>
                        </span>
                        <ActionMenu
                          label="Ações do item de Memória"
                          items={[{ label: "Apagar", destructive: true, onSelect: () => setDialogo({ tipo: "apagarMemoria", itemId: item.id }), ...(recusaConfig ? { disabledReason: recusaConfig } : {}) }]}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Painel>
          </div>

          {/* ------------------------------------------------ coluna lateral */}
          <div className="grid min-w-0 content-start gap-3">
            <RecordPanel title="Configuração">
              <dl>
                <RecordRow label="Proprietário">{state.members.find((m) => m.id === record.ownerMemberId)?.displayName ?? "—"}</RecordRow>
                <RecordRow label="Papel">{state.roles.find((r) => r.id === record.roleId)?.name ?? "—"}</RecordRow>
                <RecordRow label="Estado">{LIFECYCLE_LABEL[record.lifecycle] ?? record.lifecycle}</RecordRow>
                <RecordRow label="Versão corrente">{corrente?.number ?? 1}</RecordRow>
                <RecordRow label="Nível de autonomia">{corrente ? (AUTONOMY_LABEL[corrente.autonomy] ?? corrente.autonomy) : "—"}</RecordRow>
                <RecordRow label="Modelo">
                  {(() => {
                    const modelId = corrente?.modelId;
                    if (!modelId) return "não definido";
                    if (modelId === "padraoDaPlataforma") return "o padrão da plataforma";
                    return state.models.find((model) => model.id === modelId)?.name ?? modelId;
                  })()}
                </RecordRow>
                <RecordRow label="Política de aprovação">{corrente?.approvalPolicy.timeoutHours} h</RecordRow>
                {record.activatedAt ? <RecordRow label="Ativado">{fmt.relative(record.activatedAt)}</RecordRow> : null}
                {record.pausedAt && record.lifecycle === "pausado" ? <RecordRow label="Pausado">{fmt.relative(record.pausedAt)}</RecordRow> : null}
                {/* O objetivo é frase inteira: numa linha rótulo→valor ele seria cortado. */}
                <div className="pt-2">
                  <dt className="app-meta">Objetivo</dt>
                  <dd className="app-base" style={{ color: "var(--texto)" }}>
                    {corrente?.objective}
                  </dd>
                </div>
              </dl>
            </RecordPanel>

            <RecordPanel title="Versões" count={versoes.length} defaultOpen={false}>
              <ol className="grid gap-2">
                {versoes.map((v) => (
                  <li key={v.number} className="app-sm" style={{ color: "var(--texto-2)" }}>
                    <span className="flex items-center gap-2">
                      <span className="app-md" style={{ color: "var(--texto)" }}>
                        v{v.number}
                      </span>
                      {v.number === corrente?.number ? <Pilula tom="info">corrente</Pilula> : null}
                    </span>
                    <span className="app-meta block">{v.reason ?? "Publicada no Construtor"}</span>
                    <span className="app-meta block">
                      {authorLabel(v.by)} · {fmt.relative(v.at)}
                    </span>
                  </li>
                ))}
              </ol>
              <p className="app-meta mt-2">Toda mudança de comportamento cria uma Versão imutável, válida a partir da próxima Execução (RN-AGE-06).</p>
            </RecordPanel>

            {corrente && (corrente.icebreakers?.length || corrente.knowledgeSources?.length || corrente.responseFormat || corrente.accessPoints?.length) ? (
              <RecordPanel title="Configuração do Construtor">
                <dl className="grid gap-2">
                  {corrente.icebreakers?.length ? (
                    <div>
                      <dt className="app-meta">Quebra-gelos</dt>
                      <dd className="app-base" style={{ color: "var(--texto)" }}>
                        {corrente.icebreakers.join(" · ")}
                      </dd>
                    </div>
                  ) : null}
                  {corrente.knowledgeSources?.length ? (
                    <div>
                      <dt className="app-meta">Conhecimento</dt>
                      <dd className="app-base" style={{ color: "var(--texto)" }}>
                        {corrente.knowledgeSources.map((k) => k.label).join(" · ")}
                      </dd>
                    </div>
                  ) : null}
                  {corrente.responseFormat ? (
                    <div>
                      <dt className="app-meta">Formato de resposta</dt>
                      <dd className="app-base" style={{ color: "var(--texto)" }}>
                        {FORMATO[corrente.responseFormat] ?? corrente.responseFormat}
                      </dd>
                    </div>
                  ) : null}
                  {corrente.accessPoints?.length ? (
                    <div>
                      <dt className="app-meta">Pontos de acesso</dt>
                      <dd className="app-base" style={{ color: "var(--texto)" }}>
                        {corrente.accessPoints.map((a) => ACESSO[a] ?? a).join(", ")}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </RecordPanel>
            ) : null}

            <RecordPanel title="Registro de Atividade" count={activity.length} defaultOpen={false}>
              {activity.length === 0 ? (
                <EmptyState compact title="Nada registrado ainda." />
              ) : (
                <ol className="grid gap-2">
                  {[...activity]
                    .sort((a, b) => b.at.localeCompare(a.at))
                    .slice(0, 12)
                    .map((entry) => (
                      <li key={entry.id} className="app-sm" style={{ color: "var(--texto-2)" }}>
                        <span style={{ color: entry.result === "failed" || entry.result === "denied" ? "var(--erro)" : "var(--texto)" }}>{entry.action}</span>
                        {entry.detail ? <span className="app-meta block">{entry.detail}</span> : null}
                        <span className="app-meta block">
                          {authorLabel(entry.actor)} · {fmt.relative(entry.at)}
                        </span>
                      </li>
                    ))}
                </ol>
              )}
            </RecordPanel>
          </div>
        </div>
      </CorpoDeTela>

      {/* ------------------------------------------------------- diálogos */}
      <EnsaiarDialog agentId={record.id} open={dialogo?.tipo === "ensaiar"} onClose={fechar} />
      <TransferirAgenteDialog
        agentId={record.id}
        open={dialogo?.tipo === "transferir"}
        onClose={fechar}
        onDone={(mensagem) => {
          fechar();
          report({ ok: true }, mensagem);
        }}
      />
      <ConcederHabilidadeDialog
        agentId={record.id}
        open={dialogo?.tipo === "concederHabilidade"}
        onClose={fechar}
        onDone={(mensagem) => {
          fechar();
          report({ ok: true }, mensagem);
        }}
      />
      <PermitirFerramentaDialog
        agentId={record.id}
        open={dialogo?.tipo === "permitirFerramenta"}
        onClose={fechar}
        onDone={(mensagem) => {
          fechar();
          // A Versão nova já está gravada: a última Ferramenta da corrente é a permitida.
          const agora = state.agents.find((a) => a.id === record.id);
          const ultima = versaoCorrenteDoAgente(agora ?? record)?.allowedToolIds.at(-1);
          if (ultima) setFerramentaTocada({ id: ultima, acao: "permitir" });
          report({ ok: true }, mensagem);
        }}
      />
      {/* A Coleção fixa muda por linha: remonta o diálogo para o Select nascer com ela. */}
      <ConcederColecaoDialog
        key={colecaoParaDar ?? "livre"}
        agentId={record.id}
        {...(colecaoParaDar ? { colecaoId: colecaoParaDar } : {})}
        open={dialogo?.tipo === "darColecao"}
        onClose={fechar}
        onDone={(mensagem) => {
          fechar();
          report({ ok: true }, mensagem);
        }}
      />
      <ConfirmDialog
        open={dialogo?.tipo === "arquivar"}
        title={`Arquivar “${record.name}”?`}
        description={`${liberacao}; a restauração não as devolve. Concessões, Memória e Execuções ficam. Desarquivar devolve pausado (B94).`}
        confirmLabel="Arquivar"
        destructive
        onConfirm={() => {
          fechar();
          report(run((data, me) => arquivarAgente(data, me, record.id)), `${record.name} arquivado.`);
        }}
        onCancel={fechar}
      />
      <ConfirmDialog
        open={dialogo?.tipo === "lixeira"}
        title={`Enviar “${record.name}” à lixeira?`}
        description={`${liberacao}; a restauração não as devolve. Restaurar devolve pausado no lugar de ativo (B94).`}
        confirmLabel="Enviar à lixeira"
        destructive
        onConfirm={() => {
          fechar();
          report(run((data, me) => enviarAgenteALixeira(data, me, record.id)), `${record.name} enviado à lixeira.`);
        }}
        onCancel={fechar}
      />
      {concessaoEmDialogo ? (
        <FixarVersaoDialog
          key={concessaoEmDialogo.id}
          grant={concessaoEmDialogo}
          open={dialogo?.tipo === "fixar"}
          onClose={fechar}
          onDone={(r, mensagem) => {
            fechar();
            report(r, mensagem);
          }}
        />
      ) : null}
      <ConfirmDialog
        open={dialogo?.tipo === "revogar"}
        title={concessaoEmDialogo ? `Revogar “${state.skills.find((s) => s.id === concessaoEmDialogo.skillId)?.name ?? "Habilidade"}”?` : "Revogar a Concessão?"}
        description="O Agente deixa de exercer esta Habilidade a partir da próxima Execução; exercícios em curso terminam com a Versão carregada (RN-HAB-14). Isto cria a Versão seguinte do Agente (RN-AGE-06)."
        confirmLabel="Revogar"
        destructive
        onConfirm={() => {
          if (dialogo?.tipo !== "revogar") return;
          const grantId = dialogo.grantId;
          fechar();
          report(run((data, me) => revogarHabilidade(data, me, grantId)), "Concessão revogada.");
        }}
        onCancel={fechar}
      />
      <ConfirmDialog
        open={dialogo?.tipo === "apagarMemoria"}
        title="Apagar este fato da Memória?"
        description={`${memoriaEmDialogo ? `“${memoriaEmDialogo.content}” ` : ""}A Memória é do Agente, não do Membro que a originou (7.5); apagar não é desfeito e não cria Versão.`}
        confirmLabel="Apagar"
        destructive
        onConfirm={() => {
          if (dialogo?.tipo !== "apagarMemoria") return;
          const itemId = dialogo.itemId;
          fechar();
          report(run((data, me) => apagarItemDeMemoria(data, me, record.id, itemId)), "Item de Memória apagado.");
        }}
        onCancel={fechar}
      />
    </div>
  );
}

/** Uma Concessão de Habilidade: a Habilidade, a Versão que exerce, a Disponibilidade com os motivos e o menu (fixar, seguir, revogar). */
function LinhaDeHabilidade({
  grant,
  recente,
  recusa,
  onFixar,
  onSeguir,
  onRevogar,
}: {
  readonly grant: SkillGrant;
  readonly recente: boolean;
  readonly recusa: string | undefined;
  readonly onFixar: () => void;
  readonly onSeguir: () => void;
  readonly onRevogar: () => void;
}) {
  const state = useData((data) => data);
  const fmt = useFormat();
  const skill = state.skills.find((s) => s.id === grant.skillId);
  const disponibilidade = disponibilidadeDaConcessao(state, grant);
  const publicadas = skill ? skill.versions.filter((v) => v.state === "publicada") : [];
  const href = `/ia/habilidades/${grant.skillId}`;
  return (
    <li className={`item-solto${recente ? " surgir" : ""}`} data-bloco="true" data-estatico="true" data-recente={recente || undefined}>
      <div className="flex items-start gap-2">
        <span className="min-w-0 flex-1">
          <Link href={href} onNavigate={() => marcarSeMuda(href)} className="app-md block truncate underline-offset-2 hover:underline" style={{ color: "var(--texto)" }}>
            {skill?.name ?? "Habilidade eliminada"}
          </Link>
          <span className="app-meta block">
            concedida {fmt.relative(grant.grantedAt)}
            {skill?.ownership === "plataforma" ? " · da plataforma" : ""}
          </span>
        </span>
        <ActionMenu
          label={`Ações da Concessão de ${skill?.name ?? "Habilidade"}`}
          items={[
            { label: "Fixar versão…", onSelect: onFixar, ...(recusa ? { disabledReason: recusa } : publicadas.length === 0 ? { disabledReason: "Não há Versão publicada para fixar (RN-HAB-03)." } : {}) },
            { label: "Seguir a corrente", onSelect: onSeguir, ...(recusa ? { disabledReason: recusa } : grant.pinnedVersion === undefined ? { disabledReason: "Já segue a corrente." } : {}) },
            { label: "Revogar", destructive: true, onSelect: onRevogar, ...(recusa ? { disabledReason: recusa } : {}) },
          ]}
        />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <Pilula tom={grant.pinnedVersion !== undefined ? "info" : "neutro"}>{grant.pinnedVersion !== undefined ? `versão fixada ${grant.pinnedVersion}` : "segue a corrente"}</Pilula>
        <Pilula tom={DISPONIBILIDADE_TOM[disponibilidade.disponivel ? "disponivel" : "indisponivel"]}>{disponibilidade.disponivel ? "disponível" : "indisponível"}</Pilula>
      </div>
      {!disponibilidade.disponivel ? (
        <ul className="mt-1 grid gap-0.5">
          {disponibilidade.motivos.map((motivo) => (
            <li key={motivo} className="app-meta">
              · {motivo}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/** Uma Concessão de Coleção: a Coleção, as ações e quem concedeu; revogar é ato de quem administra a Coleção. */
function LinhaDeColecao({ grant, recente, onRevogar }: { readonly grant: CollectionGrant; readonly recente: boolean; readonly onRevogar: (mensagem: string) => void }) {
  const state = useData((data) => data);
  const fmt = useFormat();
  const { memberId } = useSession();
  const colecao = state.collections.find((c) => c.id === grant.collectionId);
  const concedente = state.members.find((m) => m.id === grant.grantedBy);
  const recusa = colecao ? recusaNaColecao(state, memberId, colecao, "administrar") : "A Coleção desta Concessão não existe mais.";
  const href = `/ia/conhecimento/${grant.collectionId}`;
  return (
    <li className={`item-solto${recente ? " surgir" : ""}`} data-estatico="true" data-recente={recente || undefined}>
      <span className="min-w-0 flex-1">
        <Link href={href} onNavigate={() => marcarSeMuda(href)} className="app-base block truncate underline-offset-2 hover:underline" style={{ color: "var(--texto)" }}>
          {colecao?.name ?? grant.collectionId}
        </Link>
        <span className="app-meta block truncate">
          concedida por {concedente?.displayName ?? grant.grantedBy} · {fmt.relative(grant.grantedAt)}
        </span>
      </span>
      <span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
        {grant.actions.map((acao) => (
          <Pilula key={acao} tom={acao === "ver" ? "info" : "neutro"}>
            {GRANT_ACTION_LABEL[acao]}
          </Pilula>
        ))}
        {colecao && colecao.lifecycle !== "ativo" ? (
          <ConditionMarker tone="warning">Coleção {LIFECYCLE_LABEL[colecao.lifecycle] ?? colecao.lifecycle}: não consultável</ConditionMarker>
        ) : null}
      </span>
      <ActionMenu
        label={`Ações do acesso a ${colecao?.name ?? grant.collectionId}`}
        items={[{ label: "Revogar", destructive: true, onSelect: () => onRevogar(`Acesso a “${colecao?.name ?? grant.collectionId}” revogado.`), ...(recusa ? { disabledReason: recusa } : {}) }]}
      />
    </li>
  );
}

/** Fixar a Concessão numa Versão publicada da Habilidade (RN-HAB-03). */
function FixarVersaoDialog({
  grant,
  open,
  onClose,
  onDone,
}: {
  readonly grant: SkillGrant;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onDone: (r: { ok: boolean; error?: string }, mensagem: string) => void;
}) {
  const state = useData((data) => data);
  const run = useRun();
  const [numero, setNumero] = useState(grant.pinnedVersion !== undefined ? String(grant.pinnedVersion) : "");
  const skill = state.skills.find((s) => s.id === grant.skillId);
  const corrente = skill ? versaoCorrenteDaHabilidade(skill) : undefined;
  const publicadas = skill ? skill.versions.filter((v) => v.state === "publicada").sort((a, b) => b.number - a.number) : [];
  const escolhida = numero ? Number(numero) : undefined;
  const motivo = escolhida === undefined ? "Escolha a Versão a fixar." : escolhida === grant.pinnedVersion ? "A Concessão já está fixada nesta Versão." : undefined;
  return (
    <ConfirmDialog
      open={open}
      title={`Fixar a Versão de ${skill?.name ?? "Habilidade"}`}
      description={`Fixada, a Concessão não acompanha publicações futuras: só uma Versão publicada é exercível (RN-HAB-03). Hoje ${grant.pinnedVersion !== undefined ? `está fixada na v${grant.pinnedVersion}` : `segue a corrente${corrente ? ` (v${corrente.number})` : ""}`}.`}
      confirmLabel="Fixar"
      {...(motivo ? { confirmDisabledReason: motivo } : {})}
      onConfirm={() => {
        if (escolhida === undefined) return;
        const r = run((data, me) => fixarVersaoDaConcessao(data, me, grant.id, escolhida));
        onDone(r, `Concessão fixada na v${escolhida}.`);
      }}
      onCancel={onClose}
    >
      <Field label="Versão" required>
        {(id) => <Select id={id} value={numero} onChange={setNumero} placeholder="Escolher a Versão" options={publicadas.map((v) => ({ value: String(v.number), label: `Versão ${v.number}`, detail: v.number === corrente?.number ? "corrente" : "publicada" }))} />}
      </Field>
    </ConfirmDialog>
  );
}
