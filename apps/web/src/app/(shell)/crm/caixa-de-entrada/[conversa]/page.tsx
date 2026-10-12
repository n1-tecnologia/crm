"use client";

/**
 * T26 — Conversa.
 *
 * RN-CXE-19 governs the composer: outside the response window only an approved
 * template may be sent, so the free-text field is replaced by the template
 * picker instead of letting the send fail on click (PADROES §10).
 *
 * B67 — an internal note is a message with `direction: "interna"`; it never
 * reaches the Contact, and the UI has to make that impossible to confuse.
 */

import Link from "next/link";
import { Briefcase, Flame, Link2, MessageSquare, PanelRight, Radio, Tag, User as UserIcon, UserRound, Users, Wallet } from "lucide-react";
import { use, useState } from "react";
import { useData, useRun } from "@/dados/store";
import { InboxColumns } from "@/features/crm/inbox-columns";
import {
  ContactAvatar,
  ContactDataPanel,
  ContactIdentity,
  ContactQuickActions,
  ContactSummary,
} from "@/features/crm/contact-card";
import { ConversationThread } from "@/features/crm/conversation-thread";
import { TarefasDoContato } from "@/features/crm/tarefas-do-contato";
import { NovaTarefaConversacionalDialog } from "@/features/estrutura/nova-tarefa-conversacional-dialog";
import { ConversaDoGrupo } from "@/features/ferramentas/conversa-do-grupo";
import { membrosDoGrupo } from "@n1/dominio/derive-ferramentas";
import {
  MoveConversationDialog,
  useMoveConversationDialog,
} from "@/features/crm/move-conversation-dialog";
import {
  actorLabel,
  contactDisplayName,
  principalCompanyId,
} from "@n1/dominio/derive";
import {
  assignConversation,
  capacidadesDoCanal,
  reopenConversation,
  resolveConversation,
  trashConversation,
} from "@n1/dominio/operations";
import { CONVERSATION_STATE_LABEL } from "@/features/shell/format";
import { useFormat } from "@/features/shell/use-format";
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
import type { DataState } from "@n1/dominio/state";
import type { ActorRef, ChannelType } from "@n1/dominio/types";

export default function ConversaPage({ params }: { params: Promise<{ conversa: string }> }) {
  const { conversa } = use(params);
  const state = useData((data) => data);
  const fmt = useFormat();
  const run = useRun();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmingTrash, setConfirmingTrash] = useState(false);
  const [showingContact, setShowingContact] = useState(false);
  // C35 — a Tarefa nasce desta Conversa: Contato e Canal já dados, só a Lista é escolha.
  const [criandoTarefa, setCriandoTarefa] = useState(false);
  /*
    A aba de Canal começa na Conversa aberta e depois é livre: passar o Canal
    como prop controlada SEM o `onCanalChange` deixava a aba presa — o clique
    mudava o estado interno do thread e a prop o desfazia. Ao trocar de
    Conversa pela lista, a aba volta para o Canal da nova.
  */
  const [canal, setCanal] = useState<ChannelType | null>(null);
  const [conversaVista, setConversaVista] = useState(conversa);
  if (conversaVista !== conversa) {
    setConversaVista(conversa);
    setCanal(null);
  }
  const { moving, openMoveConversation, closeMoveConversation } = useMoveConversationDialog();

  const conversation = state.conversations.find((c) => c.id === conversa);
  const channel = state.channels.find((c) => c.id === conversation?.channelId);

  if (!conversation || !channel) {
    return (
      <InboxColumns>
        <PageHeader title="Conversa não encontrada" />
        <CorpoDeTela>
          <EmptyState
            title="Conversa não encontrada."
            hint="Ela pode ter sido eliminada, ou você não tem permissão para vê-la."
          />
        </CorpoDeTela>
      </InboxColumns>
    );
  }

  const contact = conversation.contactId
    ? state.contacts.find((c) => c.id === conversation.contactId)
    : undefined;
  const queue = state.queues.find((q) => q.id === conversation.queueId);
  const capabilities = capacidadesDoCanal(channel);
  const inTrash = conversation.lifecycle === "naLixeira";

  /*
    O que o cabeçalho precisa dizer é o NEGÓCIO, não a ficha inteira do Contato:
    quem abre a Conversa quer saber com quem fala, sobre o quê e quanto vale,
    e o resto entra sob demanda pelo botão de dados do Contato.
  */
  const negociosAbertos = state.deals
    .filter((d) => d.lifecycle === "ativo" && d.situation === "aberto")
    .filter((d) => d.contactLinks.some((l) => l.contactId === contact?.id))
    // O mais novo primeiro: a Conversa não aponta para um Negócio, e o que a
    // pessoa está tratando agora é, quase sempre, o último que abriu.
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const dealDoContato = negociosAbertos[0];
  const outrosNegocios = negociosAbertos.length - 1;
  const companyId =
    dealDoContato?.companyId ??
    (contact ? principalCompanyId(state, contact.id) : undefined);
  const companyName = state.companies.find((c) => c.id === companyId)?.tradeName;
  const temperatura = state.catalog.find((c) => c.id === contact?.temperatureId);
  const owner = state.members.find((m) => m.id === dealDoContato?.ownerMemberId);
  const origem = state.catalog.find((c) => c.id === dealDoContato?.originId)?.name;
  const canalQuebrado = channel.connection !== "conectada";
  // Uma Conversa de grupo (INV-GRP-05) não tem Contato: quem fala é o Grupo.
  const grupo = conversation.groupIdentifier
    ? state.grupos.find((g) => g.canalId === conversation.channelId && g.identificadorExterno === conversation.groupIdentifier?.externalId)
    : undefined;

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

  // Sob a identidade do Contato, como "Etapa · Qualificação" na ficha do
  // Negócio: quem atende e em que situação a Conversa está.
  const atribuidoESituacao = (
    <div className="grid grid-cols-2 items-end gap-2">
      <span className="grid min-w-0 gap-1.5">
        <label className="app-sm" style={{ color: "var(--texto-3)" }} htmlFor="atribuido-da-conversa">
          Atribuído
        </label>
        {/* Membros e Agentes na mesma lista: o detalhe de cada opção diz qual é qual. */}
        <Select
          id="atribuido-da-conversa"
          value={conversation.assignee?.id ?? ""}
          onChange={assignTo}
          disabled={inTrash}
          disabledReason="Esta Conversa está na lixeira."
          options={[
            { value: "", label: "Sem Atribuído" },
            ...state.members
              .filter((member) => member.state === "ativo")
              .map((member) => ({ value: member.id, label: member.displayName, detail: "Membro" })),
            ...state.agents
              .filter((agent) => agent.lifecycle === "ativo")
              .map((agent) => ({ value: agent.id, label: agent.name, detail: "Agente" })),
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

  return (
    <InboxColumns>
      <PageHeader
        {...(contact ? { icon: <ContactAvatar contact={contact} size="grande" /> } : {})}
        title={contact ? contactDisplayName(contact) : conversation.title}
        seal={<StateSeal state={conversation.lifecycle} />}
        {...(companyName || canalQuebrado
          ? {
              meta: (
                /*
                  Só a Empresa. Situação, Canal, Fila e contagem de reaberturas são
                  roteamento, não o assunto da conversa — elas continuam na coluna de
                  dados do Contato. O aviso de Canal quebrado fica: esconder uma falha
                  faria a pessoa escrever para um Canal que não entrega.
                */
                <span className="flex flex-wrap items-center gap-3">
                  {companyName ? (
                    <span className="app-sm" style={{ color: "var(--texto-1)" }}>
                      {companyName}
                    </span>
                  ) : null}
                  {canalQuebrado ? (
                    <ConditionMarker tone={channel.connection === "comErro" ? "danger" : "warning"}>
                      Canal {channel.connection === "comErro" ? "com erro" : "desconectado"}
                    </ConditionMarker>
                  ) : null}
                </span>
              ),
            }
          : {})}
        details={
          dealDoContato ? (
            /*
              Uma linha só: estes seis são a leitura de relance do lead, e quebrar
              em duas fileiras faz o olho procurar onde a anterior terminou. Se a
              janela for estreita, a faixa rola na horizontal em vez de quebrar.
            */
            <dl className="flex items-start gap-x-6 overflow-x-auto whitespace-nowrap pb-1">
              {[
                { rotulo: "Produto", valor: dealDoContato.object || "—", icone: Briefcase },
                {
                  rotulo: "Temperatura",
                  valor: temperatura?.name ?? "—",
                  icone: Flame,
                  cor: temperatura?.color,
                },
                {
                  rotulo: "Valor do negócio",
                  valor: dealDoContato.value
                    ? fmt.money(dealDoContato.value)
                    : "sem valor declarado",
                  icone: Wallet,
                },
                { rotulo: "Proprietário", valor: owner?.displayName ?? "—", icone: UserIcon },
                { rotulo: "Origem", valor: origem ?? "—", icone: Link2 },
                {
                  rotulo: outrosNegocios > 0 ? `Negócio (+${outrosNegocios} aberto${outrosNegocios > 1 ? "s" : ""})` : "Negócio",
                  valor: dealDoContato.title,
                  icone: Briefcase,
                  href: `/crm/negocios/${dealDoContato.id}`,
                },
              ].map(({ rotulo, valor, icone, cor, href }) => (
                <div key={rotulo} className="shrink-0">
                  <dt className="app-meta flex items-center gap-1.5">
                    <Icone de={icone} tamanho="xs" style={cor ? { color: cor } : undefined} />
                    {rotulo}
                  </dt>
                  <dd className="app-md mt-0.5" style={{ color: "var(--texto)" }}>
                    {href ? (
                      <Link href={href} className="hover:underline">
                        {valor}
                      </Link>
                    ) : (
                      valor
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          ) : grupo ? (
            <p className="app-meta">
              Conversa de grupo ·{" "}
              <Link href={`/ferramentas/grupos?grupo=${grupo.id}`} className="underline" style={{ color: "var(--acento)" }}>
                {grupo.nome}
              </Link>{" "}
              · {membrosDoGrupo(grupo).length} membro(s){grupo.papelNaComunidade === "avisos" ? " · Grupo de avisos" : ""}
            </p>
          ) : conversation.groupIdentifier ? (
            <p className="app-meta">Conversa de grupo · {conversation.groupIdentifier.name} · o Grupo não está mais na plataforma.</p>
          ) : (
            <p className="app-meta">
              {contact ? contactDisplayName(contact) : "Este Contato"} não tem Negócio aberto.{" "}
              <Link href="/crm/negocios?criar=negocio" className="underline" style={{ color: "var(--acento)" }}>
                Criar um Negócio
              </Link>
              .
            </p>
          )
        }
        actions={
          <>
            <Button
              onClick={() => setShowingContact((aberto) => !aberto)}
              icon={<Icone de={PanelRight} tamanho="sm" />}
            >
              {showingContact ? "Ocultar dados do Contato" : "Dados do Contato"}
            </Button>
            {/*
              Resolver, mover e descartar saíram da barra: são atos sobre a
              Conversa, não sobre o atendimento em curso, e ocupavam o cabeçalho
              inteiro. Ficam num só menu — sumir com eles tiraria do produto as
              únicas vias de fechar, reatribuir e descartar uma Conversa.
            */}
            <ActionMenu
              label="Ações da Conversa"
              items={[
                conversation.state === "resolvida"
                  ? {
                      label: "Reabrir",
                      onSelect: () =>
                        report(
                          run((data, memberId) =>
                            reopenConversation(data, memberId, conversation.id),
                          ),
                          "Conversa reaberta.",
                        ),
                      ...(inTrash ? { disabledReason: "Esta Conversa está na lixeira." } : {}),
                    }
                  : {
                      label: "Resolver",
                      onSelect: () =>
                        report(
                          run((data, memberId) =>
                            resolveConversation(data, memberId, conversation.id),
                          ),
                          "Conversa resolvida.",
                        ),
                    },
                {
                  label: "Mover para outro Contato",
                  onSelect: openMoveConversation,
                  ...(inTrash ? { disabledReason: "Esta Conversa está na lixeira." } : {}),
                },
                {
                  label: "Enviar à lixeira",
                  onSelect: () => setConfirmingTrash(true),
                  destructive: true,
                  ...(conversation.state !== "resolvida" || inTrash
                    ? {
                        disabledReason: inTrash
                          ? "Já está na lixeira."
                          : "Só uma Conversa resolvida pode ir para a lixeira.",
                      }
                    : {}),
                },
              ]}
            />
          </>
        }
      />

      <MoveConversationDialog
        conversationId={conversation.id}
        open={moving}
        onClose={closeMoveConversation}
        onDone={setNotice}
      />

      {/* Chaveado pela Conversa: o Contato e o Canal iniciais do diálogo são os dela. */}
      {contact ? (
        <NovaTarefaConversacionalDialog
          key={conversation.id}
          open={criandoTarefa}
          contactId={contact.id}
          channelId={conversation.channelId}
          onClose={() => setCriandoTarefa(false)}
          onDone={(mensagem) => {
            setCriandoTarefa(false);
            setError(null);
            setNotice(mensagem);
          }}
        />
      ) : null}

      <ConfirmDialog
        open={confirmingTrash}
        title="Enviar esta Conversa à lixeira?"
        description="As Mensagens continuam existindo e a Conversa pode ser restaurada enquanto estiver lá."
        confirmLabel="Enviar à lixeira"
        destructive
        onConfirm={() => {
          report(
            run((data, memberId) => trashConversation(data, memberId, conversation.id)),
            "Conversa enviada à lixeira.",
          );
          setConfirmingTrash(false);
        }}
        onCancel={() => setConfirmingTrash(false)}
      />

      {/*
        Modelo do WhatsApp: a conversa ocupa o painel inteiro, sem moldura nem
        margem, e o compositor fica colado no rodapé. Os dados do Contato, quando
        pedidos, abrem como coluna à direita — não empurram a conversa para baixo.
      */}
      <div className="flex min-h-0 flex-1">
        {/* Chaveado pela Conversa: trocar de Conversa esmaece só este painel (150ms), nunca a coluna. */}
        <div key={conversa} className="aparecer flex min-h-0 min-w-0 flex-1 flex-col">
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

          {/*
            O mesmo thread da ficha do Contato e do Negócio: abas por Canal,
            anexos, janela de resposta, modelo fora da janela, Rascunho de IA.
            Uma Conversa é UM Canal, então a aba dele já abre selecionada.
          */}
          {contact ? (
            <div className="min-h-0 flex-1">
              <ConversationThread
                contact={contact}
                canalSelecionado={canal ?? channel.channelType}
                onCanalChange={setCanal}
                flush
              />
            </div>
          ) : grupo ? (
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <ConversaDoGrupo grupoId={grupo.id} report={report} dentroDaCaixa />
            </div>
          ) : (
            <EmptyState
              title={conversation.groupIdentifier ? "Conversa de grupo sem Grupo." : "Contato não resolvido."}
              hint={
                conversation.groupIdentifier
                  ? `O grupo ${conversation.groupIdentifier.name} não está mais na plataforma; as Mensagens ficam na história.`
                  : conversation.unresolvedIdentifier
                    ? `Chegou por ${conversation.unresolvedIdentifier.value}. Vincule a um Contato existente ou crie um novo para responder.`
                    : "A Conversa existe sem Contato até que o identificador seja resolvido."
              }
            />
          )}
        </div>

        {/* A lateral é o CARTÃO DO CONTATO — o mesmo da ficha do Contato e do
            Negócio: identidade, ações rápidas, dados, resumo. O que é só da
            Conversa (Atribuído, Situação, Canal, Fila, Participantes, Tags,
            Capacidades) vem depois, na mesma família de painéis. */}
        <aside
          hidden={!showingContact}
          className="relative w-[22rem] shrink-0 overflow-y-auto p-3"
          style={{ borderLeft: "1px solid var(--linha)" }}
        >
          <div className="grid content-start gap-3">
            {contact ? (
              <>
                <ContactIdentity contact={contact} editavel={!inTrash} abaixo={atribuidoESituacao} />
                <ContactQuickActions contact={contact} onCanal={setCanal} />
                <ContactDataPanel contact={contact} />
                <ContactSummary contact={contact} />
                <TarefasDoContato
                  contactId={contact.id}
                  onCriar={() => setCriandoTarefa(true)}
                  rotuloDoBotao="Criar Tarefa a partir da Conversa"
                />
              </>
            ) : (
              <>
                <RecordPanel title={grupo ? "Grupo" : "Contato"} icon={<Icone de={grupo ? Users : UserRound} tamanho="sm" />}>
                  {grupo ? (
                    <p className="app-base" style={{ color: "var(--texto)" }}>
                      <Link href={`/ferramentas/grupos?grupo=${grupo.id}`} className="hover:underline">
                        {grupo.nome}
                      </Link>
                      <span className="app-meta block">{membrosDoGrupo(grupo).length} membro(s) · a Participação é a fonte, não esta Conversa (RN-GRP-12)</span>
                    </p>
                  ) : (
                  <EmptyState
                    compact
                    title="Contato não resolvido."
                    hint={
                      conversation.unresolvedIdentifier
                        ? `Chegou por ${conversation.unresolvedIdentifier.value}. Vincule a um Contato existente ou crie um novo.`
                        : "A Conversa existe sem Contato até que o identificador seja resolvido."
                    }
                  />
                  )}
                </RecordPanel>
                <RecordPanel title="Atribuído" icon={<Icone de={UserRound} tamanho="sm" />}>
                  {atribuidoESituacao}
                </RecordPanel>
              </>
            )}

            <RecordPanel title="Conversa" icon={<Icone de={MessageSquare} tamanho="sm" />}>
              <dl>
                {[
                  { rotulo: "Canal", valor: channel.name },
                  { rotulo: "Fila", valor: queue?.name ?? "sem Fila" },
                  ...(conversation.reopenCount > 0
                    ? [{ rotulo: "Reaberturas", valor: `${conversation.reopenCount}×` }]
                    : []),
                ].map(({ rotulo, valor }) => (
                  <RecordRow key={rotulo} label={rotulo}>
                    {valor}
                  </RecordRow>
                ))}
              </dl>
              <p className="ajuda">
                Ser Atribuído não concede permissão de ver: o acesso vem do Papel e da Fila.
              </p>
            </RecordPanel>

            <RecordPanel title="Participantes" count={conversation.participants.length} icon={<Icone de={Users} tamanho="sm" />}>
              {conversation.participants.length === 0 ? (
                <EmptyState compact title="Nenhum Participante registrado." />
              ) : (
                <ul className="app-base grid gap-1" style={{ color: "var(--texto)" }}>
                  {conversation.participants.map((participant) => (
                    <li key={participant.id}>
                      {participantLabel(state, participant.subject)}
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

            <RecordPanel title="Capacidades do Canal" icon={<Icone de={Radio} tamanho="sm" />}>
              <dl>
                <RecordRow label="Janela de resposta">
                  {capabilities.responseWindowHours === undefined
                    ? "sem janela"
                    : `${capabilities.responseWindowHours}h`}
                </RecordRow>
                <RecordRow label="Reações">{capabilities.reactions ? "sim" : "não"}</RecordRow>
                <RecordRow label="Grupos">{capabilities.groups ? "sim" : "não"}</RecordRow>
                <RecordRow label="Assunto e cópias">{capabilities.hasSubjectAndCopies ? "sim" : "não"}</RecordRow>
                <RecordRow label="Identidade anônima">{capabilities.anonymousIdentity ? "sim" : "não"}</RecordRow>
              </dl>
              <p className="ajuda">
                As capacidades são do tipo de Canal, não deste Canal nem desta Conversa.
              </p>
            </RecordPanel>
          </div>
        </aside>
      </div>
    </InboxColumns>
  );
}

function participantLabel(
  state: DataState,
  subject: ActorRef | { readonly kind: "contact"; readonly id: string },
): string {
  if (subject.kind === "contact") {
    const contact = state.contacts.find((c) => c.id === subject.id);
    return contact ? contactDisplayName(contact) : "Contato";
  }
  return actorLabel(state, subject);
}
