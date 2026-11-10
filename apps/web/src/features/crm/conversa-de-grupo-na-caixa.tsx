"use client";

/**
 * A Conversa de GRUPO aberta na Caixa de Entrada (F14-D-05). Grupo e Flow ficam no
 * modelo antigo de Conversa até as Sessões 6 e 7: a Conversa de grupo mora em
 * `state.conversations` e não tem linha em `plataforma.conversas`, então a página
 * `[conversa]` cai aqui quando a api responde 404 para um id que o store conhece
 * como Conversa de grupo.
 *
 * É o ramo do Grupo da página antiga, sem Contato: quem fala é o Grupo
 * (`ConversaDoGrupo`). Resolver, reabrir, atribuir e a lixeira seguem pelas
 * operações do store — o único lugar da Caixa que ainda as usa — e saem junto com
 * a Conversa de grupo antiga. O Canal vem do CRM novo (`GET /canais`), nunca do
 * modelo antigo.
 */

import Link from "next/link";
import { MessageSquare, PanelRight, Radio, Tag, UserRound, Users } from "lucide-react";
import { useState } from "react";
import { useData, useRun } from "@/dados/store";
import { InboxColumns } from "@/features/crm/inbox-columns";
import { ConversaDoGrupo } from "@/features/ferramentas/conversa-do-grupo";
import { useCanaisDasFerramentas } from "@/features/ferramentas/crm-das-ferramentas";
import { CONVERSATION_STATE_LABEL } from "@/features/shell/format";
import {
  ActionMenu,
  Button,
  ConditionMarker,
  ConfirmDialog,
  CorpoDeTela,
  EmptyState,
  Icone,
  PageHeader,
  Pilula,
  RecordPanel,
  RecordRow,
  Select,
  StateSeal,
  Toast,
} from "@/features/shell/ui";
import { actorLabel } from "@n1/dominio/derive";
import { membrosDoGrupo } from "@n1/dominio/derive-ferramentas";
import { assignConversation, reopenConversation, resolveConversation, trashConversation } from "@n1/dominio/operations";
import { capacidadesDoCanal } from "@n1/dominio/crm/capacidades";
import type { ActorRef } from "@n1/dominio/types";

export function ConversaDeGrupoNaCaixa({ conversaId }: { readonly conversaId: string }) {
  const state = useData((data) => data);
  const run = useRun();
  const canais = useCanaisDasFerramentas();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmingTrash, setConfirmingTrash] = useState(false);
  const [showingPanel, setShowingPanel] = useState(false);

  const conversation = state.conversations.find((c) => c.id === conversaId);
  const grupo = conversation?.groupIdentifier
    ? state.grupos.find((g) => g.canalId === conversation.channelId && g.identificadorExterno === conversation.groupIdentifier?.externalId)
    : undefined;

  if (!conversation) {
    return (
      <InboxColumns>
        <PageHeader title="Conversa não encontrada" />
        <CorpoDeTela>
          <EmptyState title="Conversa não encontrada." hint="Ela pode ter sido eliminada, ou você não tem permissão para vê-la." />
        </CorpoDeTela>
      </InboxColumns>
    );
  }

  const canal = canais.canalPorId(conversation.channelId);
  const queue = state.queues.find((q) => q.id === conversation.queueId);
  const inTrash = conversation.lifecycle === "naLixeira";
  const canalQuebrado = canal !== undefined && canal.conexao !== "conectada";

  const report = (result: { ok: boolean; error?: string }, message: string) => {
    if (result.ok) {
      setError(null);
      setNotice(message);
    } else {
      setNotice(null);
      setError(result.error ?? "Não foi possível concluir a operação.");
    }
  };

  const assignTo = (value: string) => {
    const assignee: ActorRef | undefined =
      value === "" ? undefined : value.startsWith("agt_") ? { kind: "agent", id: value } : { kind: "member", id: value };
    report(
      run((data, memberId) => assignConversation(data, memberId, conversation.id, assignee)),
      assignee ? "Conversa atribuída." : "Atribuição removida.",
    );
  };

  const atribuidoESituacao = (
    <div className="grid grid-cols-2 items-end gap-2">
      <span className="grid min-w-0 gap-1.5">
        <label className="app-sm" style={{ color: "var(--texto-3)" }} htmlFor="atribuido-da-conversa">
          Atribuído
        </label>
        <Select
          id="atribuido-da-conversa"
          value={conversation.assignee?.id ?? ""}
          onChange={assignTo}
          disabled={inTrash}
          disabledReason="Esta Conversa está na lixeira."
          options={[
            { value: "", label: "Sem Atribuído" },
            ...state.members.filter((member) => member.state === "ativo").map((member) => ({ value: member.id, label: member.displayName, detail: "Membro" })),
            ...state.agents.filter((agent) => agent.lifecycle === "ativo").map((agent) => ({ value: agent.id, label: agent.name, detail: "Agente" })),
          ]}
        />
      </span>
      <span className="grid min-w-0 gap-1.5">
        <span className="app-sm" style={{ color: "var(--texto-3)" }}>
          Situação
        </span>
        <span className="campo flex items-center" style={{ color: "var(--texto)" }}>
          {CONVERSATION_STATE_LABEL[conversation.state]}
        </span>
      </span>
    </div>
  );

  const capabilities = canal ? capacidadesDoCanal({ channelType: canal.tipo, provider: canal.provedor }) : undefined;

  return (
    <InboxColumns>
      <PageHeader
        title={conversation.title}
        seal={<StateSeal state={conversation.lifecycle} />}
        {...(canalQuebrado
          ? {
              meta: (
                <ConditionMarker tone={canal.conexao === "com_erro" ? "danger" : "warning"}>
                  Canal {canal.conexao === "com_erro" ? "com erro" : "desconectado"}
                </ConditionMarker>
              ),
            }
          : {})}
        details={
          grupo ? (
            <p className="app-meta">
              Conversa de grupo ·{" "}
              <Link href={`/ferramentas/grupos?grupo=${grupo.id}`} className="underline" style={{ color: "var(--acento)" }}>
                {grupo.nome}
              </Link>{" "}
              · {membrosDoGrupo(grupo).length} membro(s){grupo.papelNaComunidade === "avisos" ? " · Grupo de avisos" : ""}
            </p>
          ) : (
            <p className="app-meta">Conversa de grupo · {conversation.groupIdentifier?.name} · o Grupo não está mais na plataforma.</p>
          )
        }
        actions={
          <>
            <Button onClick={() => setShowingPanel((aberto) => !aberto)} icon={<Icone de={PanelRight} tamanho="sm" />}>
              {showingPanel ? "Ocultar dados do Grupo" : "Dados do Grupo"}
            </Button>
            <ActionMenu
            label="Ações da Conversa"
            items={[
              conversation.state === "resolvida"
                ? {
                    label: "Reabrir",
                    onSelect: () => report(run((data, memberId) => reopenConversation(data, memberId, conversation.id)), "Conversa reaberta."),
                    ...(inTrash ? { disabledReason: "Esta Conversa está na lixeira." } : {}),
                  }
                : {
                    label: "Resolver",
                    onSelect: () => report(run((data, memberId) => resolveConversation(data, memberId, conversation.id)), "Conversa resolvida."),
                  },
              {
                label: "Enviar à lixeira",
                onSelect: () => setConfirmingTrash(true),
                destructive: true,
                ...(conversation.state !== "resolvida" || inTrash
                  ? { disabledReason: inTrash ? "Já está na lixeira." : "Só uma Conversa resolvida pode ir para a lixeira." }
                  : {}),
              },
            ]}
          />
          </>
        }
      />

      <ConfirmDialog
        open={confirmingTrash}
        title="Enviar esta Conversa à lixeira?"
        description="As Mensagens continuam existindo e a Conversa pode ser restaurada enquanto estiver lá."
        confirmLabel="Enviar à lixeira"
        destructive
        onConfirm={() => {
          report(run((data, memberId) => trashConversation(data, memberId, conversation.id)), "Conversa enviada à lixeira.");
          setConfirmingTrash(false);
        }}
        onCancel={() => setConfirmingTrash(false)}
      />

      <div className="flex min-h-0 flex-1">
        <div key={conversaId} className="aparecer flex min-h-0 min-w-0 flex-1 flex-col">
          {notice ? (
            <div className="shrink-0 px-4 pt-3">
              <Toast tone="success" onDismiss={() => setNotice(null)}>
                {notice}
              </Toast>
            </div>
          ) : null}
          {error ? (
            <div className="shrink-0 px-4 pt-3">
              <Toast tone="error" onDismiss={() => setError(null)}>
                {error}
              </Toast>
            </div>
          ) : null}
          {grupo ? (
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <ConversaDoGrupo grupoId={grupo.id} report={report} dentroDaCaixa />
            </div>
          ) : (
            <EmptyState
              title="Conversa de grupo sem Grupo."
              hint={`O grupo ${conversation.groupIdentifier?.name ?? ""} não está mais na plataforma; as Mensagens ficam na história.`}
            />
          )}
        </div>

        <aside hidden={!showingPanel} className="relative w-[22rem] shrink-0 overflow-y-auto p-3" style={{ borderLeft: "1px solid var(--linha)" }}>
          <div className="grid content-start gap-3">
            <RecordPanel title="Grupo" icon={<Icone de={Users} tamanho="sm" />}>
              {grupo ? (
                <p className="app-base" style={{ color: "var(--texto)" }}>
                  <Link href={`/ferramentas/grupos?grupo=${grupo.id}`} className="hover:underline">
                    {grupo.nome}
                  </Link>
                  <span className="app-meta block">{membrosDoGrupo(grupo).length} membro(s) · a Participação é a fonte, não esta Conversa (RN-GRP-12)</span>
                </p>
              ) : (
                <EmptyState compact title="O Grupo não está mais na plataforma." />
              )}
            </RecordPanel>
            <RecordPanel title="Atribuído" icon={<Icone de={UserRound} tamanho="sm" />}>
              {atribuidoESituacao}
            </RecordPanel>

            <RecordPanel title="Conversa" icon={<Icone de={MessageSquare} tamanho="sm" />}>
              <dl>
                {[
                  { rotulo: "Canal", valor: canal?.nome ?? canais.nomeDoCanal(conversation.channelId) ?? "Canal" },
                  { rotulo: "Fila", valor: queue?.name ?? "sem Fila" },
                  ...(conversation.reopenCount > 0 ? [{ rotulo: "Reaberturas", valor: `${conversation.reopenCount}×` }] : []),
                ].map(({ rotulo, valor }) => (
                  <RecordRow key={rotulo} label={rotulo}>
                    {valor}
                  </RecordRow>
                ))}
              </dl>
              <p className="ajuda">Ser Atribuído não concede permissão de ver: o acesso vem do Papel e da Fila.</p>
            </RecordPanel>

            <RecordPanel title="Participantes" count={conversation.participants.length} icon={<Icone de={Users} tamanho="sm" />}>
              {conversation.participants.length === 0 ? (
                <EmptyState compact title="Nenhum Participante registrado." />
              ) : (
                <ul className="app-base grid gap-1" style={{ color: "var(--texto)" }}>
                  {conversation.participants.map((participant) => (
                    <li key={participant.id}>
                      {participant.subject.kind === "contact" ? "Contato" : actorLabel(state, participant.subject)}
                      {participant.principal ? " · principal" : ""}
                      {participant.leftAt ? " · saiu" : ""}
                    </li>
                  ))}
                </ul>
              )}
            </RecordPanel>

            <RecordPanel title="Tags" count={conversation.tagIds.length} icon={<Icone de={Tag} tamanho="sm" />}>
              {conversation.tagIds.length === 0 ? (
                <EmptyState compact title="Nenhuma Tag." />
              ) : (
                <ul className="flex flex-wrap gap-1">
                  {conversation.tagIds.map((tagId) => {
                    const tag = state.tags.find((t) => t.id === tagId);
                    return (
                      <li key={tagId}>
                        <Pilula {...(tag?.color ? { cor: tag.color } : { tom: "neutro" })}>{tag?.name ?? tagId}</Pilula>
                      </li>
                    );
                  })}
                </ul>
              )}
            </RecordPanel>

            {capabilities ? (
              <RecordPanel title="Capacidades do Canal" icon={<Icone de={Radio} tamanho="sm" />}>
                <dl>
                  <RecordRow label="Janela de resposta">
                    {capabilities.responseWindowHours === undefined ? "sem janela" : `${capabilities.responseWindowHours}h`}
                  </RecordRow>
                  <RecordRow label="Reações">{capabilities.reactions ? "sim" : "não"}</RecordRow>
                  <RecordRow label="Grupos">{capabilities.groups ? "sim" : "não"}</RecordRow>
                  <RecordRow label="Assunto e cópias">{capabilities.hasSubjectAndCopies ? "sim" : "não"}</RecordRow>
                  <RecordRow label="Identidade anônima">{capabilities.anonymousIdentity ? "sim" : "não"}</RecordRow>
                </dl>
                <p className="ajuda">As capacidades são do tipo de Canal, não deste Canal nem desta Conversa.</p>
              </RecordPanel>
            ) : null}
          </div>
        </aside>
      </div>
    </InboxColumns>
  );
}
