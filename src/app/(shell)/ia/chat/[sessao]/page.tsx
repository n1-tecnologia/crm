"use client";

/**
 * T24 — Sessão de Chat.
 *
 * B84 — a Mensagem de Chat é imutável: corrigir cria uma nova, nunca edita a
 * anterior. Por isso não há edição aqui, e uma Mensagem substituída continua
 * visível, marcada.
 *
 * A resposta do Agente nasce de uma Execução, e este protótipo não executa
 * Modelo nenhum. A tela diz isso uma vez, fora da conversa, e deixa o link para
 * a Execução onde ela existir — em vez de inventar uma resposta que ninguém
 * gerou.
 */

import Link from "next/link";
import { use, useState } from "react";
import { Anchor, Bot, Plus } from "lucide-react";
import { useData, useRun, useSession } from "@/data/store";
import { useRecente } from "@/features/shell/recente";
import { configureChatSession, sendChatMessage } from "@/data/operations";
import { ChatSetupBar, MicButton, SendCircle } from "@/features/ia/chat-setup";
import { ACTOR_KIND_LABEL } from "@/features/shell/format";
import { useFormat } from "@/features/shell/use-format";
import {
  CorpoDeTela,
  EmptyState,
  Icone,
  NoAccessState,
  PageHeader,
  Painel,
  Pilula,
  StateSeal,
  Toast,
} from "@/features/shell/ui";
import type { ChatMessageRole } from "@/data/types";

const ROLE_LABEL: Record<ChatMessageRole, string> = {
  usuario: "Você",
  assistente: "Agente",
  sistema: "Sistema",
  ferramenta: "Ferramenta",
};

const TOOL_RESULT_LABEL: Record<string, string> = {
  concluida: "concluída",
  negada: "negada",
  falhou: "falhou",
  aguardandoAprovacao: "aguardando aprovação",
};

export default function SessaoPage({ params }: { params: Promise<{ sessao: string }> }) {
  const { sessao } = use(params);
  const state = useData((data) => data);
  const { memberId } = useSession();
  const run = useRun();
  // A mensagem recém-registrada surge; o fio não tem cascata.
  const recente = useRecente();
  const fmt = useFormat();
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const record = state.chatSessions.find((s) => s.id === sessao);

  if (!record) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Registro não encontrado" />
        <CorpoDeTela>
          <EmptyState
            title="Sessão não encontrada."
            hint="Ela pode ter sido eliminada, ou você não tem permissão para vê-la."
          />
        </CorpoDeTela>
      </div>
    );
  }

  // DO-CHT-09 — nem o Proprietário do Espaço de Trabalho entra numa Sessão
  // alheia; só o compartilhamento explícito dá leitura, e leitura não dá voz.
  const isOwner = record.ownerMemberId === memberId;
  const shared =
    record.sharedWithMemberIds.includes(memberId) ||
    state.teams.some(
      (team) => record.sharedWithTeamIds.includes(team.id) && team.memberIds.includes(memberId),
    );

  if (!isOwner && !shared) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Sessão de Chat" />
        <CorpoDeTela>
          <NoAccessState what="Sessão de Chat de outro Membro" />
          <p className="app-base mt-3" style={{ color: "var(--texto-3)" }}>
            Nenhum Papel dá acesso a Sessão de Chat alheia, nem o de Proprietário do Espaço de
            Trabalho. Só o compartilhamento explícito abre a leitura (DO-CHT-09).
          </p>
        </CorpoDeTela>
      </div>
    );
  }

  const pasta = state.chatFolders.find((f) => f.id === record.folderId);
  const agent = state.agents.find(
    (a) => a.id === (record.mainAgentId ?? state.workspace.defaultAgentId),
  );

  const sendReason = !isOwner
    ? "Você tem leitura desta Sessão; escrever é do Proprietário."
    : record.lifecycle !== "ativo"
      ? "Esta Sessão não está ativa."
      : "Escreva antes de enviar.";

  const send = () => {
    const result = run((data, actingMemberId) =>
      sendChatMessage(data, actingMemberId, record.id, draft),
    );
    if (result.ok) {
      setDraft("");
      setError(null);
      setNotice("Mensagem registrada na Sessão.");
    } else {
      setNotice(null);
      setError(result.error);
    }
  };

  const podeEscrever = isOwner && record.lifecycle === "ativo";
  const bloqueio = !podeEscrever ? sendReason : draft.trim() === "" ? sendReason : undefined;
  const mensagens = [...record.messages].sort((a, b) => a.order - b.order);
  const nomeDoAutor = (message: (typeof mensagens)[number]): string =>
    message.author.kind === "agent"
      ? (state.agents.find((a) => a.id === message.author.id)?.name ??
        ACTOR_KIND_LABEL[message.author.kind] ??
        message.author.kind)
      : (state.members.find((m) => m.id === message.author.id)?.displayName ??
        ACTOR_KIND_LABEL[message.author.kind] ??
        message.author.kind);

  /*
    A mesma pílula da home: "+" à esquerda, campo que cresce, seta à direita.
    Enter envia, Shift+Enter quebra. Numa Sessão vazia ela fica no centro, com
    a pergunta em cima, como a home; com mensagens, desce para o rodapé.
  */
  /*
    Os mesmos quatro dropdowns da home, agora agindo sobre ESTA Sessão. Cada
    troca grava na hora: não há botão de salvar porque não há formulário — é
    a mesma escolha que a home faz antes de criar, só que depois.
  */
  const ajustar = (patch: {
    readonly folderId?: string;
    readonly skillId?: string;
    readonly documentId?: string;
    readonly modelId?: string;
    readonly agentId?: string;
  }) => {
    const result = run((data, actingMemberId) =>
      configureChatSession(data, actingMemberId, record.id, {
        ...(patch.agentId !== undefined ? { mainAgentId: patch.agentId || null } : {}),
        ...(patch.folderId !== undefined ? { folderId: patch.folderId || null } : {}),
        ...(patch.skillId !== undefined ? { skillId: patch.skillId || null } : {}),
        ...(patch.modelId !== undefined ? { chosenModelId: patch.modelId || null } : {}),
        ...(patch.documentId !== undefined
          ? {
              anchor: patch.documentId
                ? { type: "knowledgeDocument" as const, id: patch.documentId }
                : null,
            }
          : {}),
      }),
    );
    if (result.ok) {
      setError(null);
      setNotice("Sessão ajustada.");
    } else {
      setNotice(null);
      setError(result.error);
    }
  };

  const configuracao = isOwner ? (
    <ChatSetupBar
      value={{
        folderId: record.folderId ?? "",
        skillId: record.skillId ?? "",
        documentId: record.anchor?.type === "knowledgeDocument" ? record.anchor.id : "",
        modelId: record.chosenModelId ?? "",
        agentId: record.mainAgentId ?? "",
      }}
      onChange={ajustar}
      documentLocked={record.messages.length > 0}
    />
  ) : null;

  const compositor = (alto: boolean) => (
    <div className="mx-auto w-full max-w-[46rem]">
      {/* A mesma caixa da home: o painel sólido no raio de destaque, opaco para
          esconder o topo da barra de ajustes que se encaixa por trás. */}
      <Painel
        solido
        className={`relative z-10 rounded-[var(--r-destaque)] ${
          alto ? "flex min-h-[7.5rem] flex-col p-3" : "flex items-end gap-2 p-2"
        }`}
      >
        {alto ? null : <MaisInerte className="self-center" />}
        <label className="sr-only" htmlFor="chat-composer">
          Escrever na Sessão
        </label>
        <textarea
          id="chat-composer"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && bloqueio === undefined) {
              event.preventDefault();
              send();
            }
          }}
          rows={1}
          disabled={!podeEscrever}
          placeholder={isOwner ? (alto ? "Trabalhe no que quiser" : "Pergunte alguma coisa") : "Você tem leitura desta Sessão."}
          className={`max-h-64 min-w-0 flex-1 resize-none border-0 bg-transparent text-[var(--texto)] outline-none [field-sizing:content] placeholder:text-[var(--texto-3)] disabled:opacity-50 ${
            alto
              ? "min-h-9 w-full px-1 py-1 text-[length:var(--ed-subtitulo)] leading-snug"
              : "app-base min-h-10 px-2 py-2.5"
          }`}
        />
        {alto ? (
          <div className="mt-auto flex items-center gap-2 pt-2">
            <MaisInerte />
            <span className="ml-auto flex items-center gap-1">
              <MicButton />
              <SendCircle onClick={send} label="Enviar" {...(bloqueio ? { disabledReason: bloqueio } : {})} />
            </span>
          </div>
        ) : (
          <span className="flex items-center gap-1 self-center">
            <MicButton />
            <SendCircle onClick={send} label="Enviar" {...(bloqueio ? { disabledReason: bloqueio } : {})} />
          </span>
        )}
      </Painel>
      {alto ? configuracao : null}
      <p className="app-meta mt-2 text-center">
        A resposta nasce de uma Execução; este protótipo registra a mensagem e não executa Modelo.
      </p>
    </div>
  );

  return (
    <div className="flex h-full flex-col">
      {/* ── a barra de 44px: onde estou (trilha), o título, o selo, com quem falo ── */}
      <PageHeader
        path={
          <>
            <Link href="/ia/chat" className="hover:underline">
              Chat
            </Link>
            {pasta ? (
              <>
                {" "}
                <span aria-hidden="true">/</span> {pasta.name}
              </>
            ) : null}
          </>
        }
        title={record.title}
        seal={<StateSeal state={record.lifecycle} />}
        actions={
          <>
            <span className="app-meta flex min-w-0 items-center gap-1.5">
              <Icone de={Bot} tamanho="xs" />
              <span className="max-w-40 truncate">{agent?.name ?? "Assistente padrão"}</span>
            </span>
            {record.anchor ? (
              <Pilula
                tom="neutro"
                className="min-w-0"
                title="A Âncora guarda o nome que o registro tinha quando a Sessão foi aberta."
              >
                <Icone de={Anchor} tamanho="xs" />
                <span className="max-w-40 truncate">{record.anchor.nameAtTheTime}</span>
              </Pilula>
            ) : null}
            {!isOwner ? <span className="app-meta">você tem leitura</span> : null}
          </>
        }
      />

      {notice || error ? (
        <div className="px-4 pt-3">
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
        </div>
      ) : null}

      {mensagens.length === 0 ? (
        <CorpoDeTela className="flex flex-col items-center">
          {/* `my-auto` centra quando sobra espaço e não corta o topo quando falta. */}
          <div className="my-auto w-full py-8">
            <h2 className="ed-titulo mb-6 text-center">
              {isOwner ? "No que vamos trabalhar?" : "O Proprietário ainda não escreveu nada aqui."}
            </h2>
            {compositor(true)}
          </div>
        </CorpoDeTela>
      ) : (
        <>
          <CorpoDeTela>
            <ol className="mx-auto grid w-full max-w-[46rem] gap-6 py-3">
              {mensagens.map((message) => {
                const minha = message.role === "usuario";
                return (
                  <li
                    key={message.id}
                    className={`flex ${minha ? "justify-end" : "justify-start"} ${message.replaced ? "opacity-60" : ""}${message.id === recente ? " surgir" : ""}`}
                  >
                    {/*
                      Como o ChatGPT: o que eu disse é um balão à direita — o
                      painel do sistema, com o canto de baixo à direita cortado;
                      a resposta é texto corrido à esquerda, sem moldura. Sistema
                      e Ferramenta são texto miúdo, para não parecerem resposta.
                    */}
                    <div
                      className={`max-w-[85%] ${
                        minha
                          ? "painel rounded-br-md px-4 py-2.5"
                          : message.role === "assistente"
                            ? "px-1"
                            : "app-sm px-1"
                      }`}
                    >
                      {!minha ? (
                        <p className="app-meta mb-1">
                          {ROLE_LABEL[message.role]} · {nomeDoAutor(message)} · {fmt.instant(message.at)}
                          {message.replaced ? " · substituída" : ""}
                        </p>
                      ) : null}
                      <p className="app-base whitespace-pre-wrap" style={{ color: "var(--texto)" }}>
                        {message.content}
                      </p>
                      {minha ? (
                        <p className="app-meta mt-1 text-right">
                          {fmt.instant(message.at)}
                          {message.replaced ? " · substituída" : ""}
                        </p>
                      ) : null}

                      {message.toolId ? (
                        <p className="app-sm mt-1" style={{ color: "var(--texto-3)" }}>
                          Ferramenta {state.tools.find((t) => t.id === message.toolId)?.name ?? message.toolId}
                          {message.toolResult
                            ? ` · ${TOOL_RESULT_LABEL[message.toolResult] ?? message.toolResult}`
                            : ""}
                        </p>
                      ) : null}

                      {message.knowledgeReferences.length > 0 ? (
                        <ul className="app-sm mt-1 space-y-0.5" style={{ color: "var(--texto-3)" }}>
                          {message.knowledgeReferences.map((reference, index) => (
                            <li key={`${reference.documentId}-${index}`}>
                              Conhecimento consultado:{" "}
                              <Link
                                href={`/ia/conhecimento/documentos/${reference.documentId}`}
                                className="hover:underline"
                              >
                                {state.documents.find((d) => d.id === reference.documentId)?.title ??
                                  reference.documentId}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : null}

                      {message.executionId ? (
                        <Link
                          href={`/ia/execucoes/${message.executionId}`}
                          className="app-sm mt-1 inline-block hover:underline"
                          style={{ color: "var(--texto-3)" }}
                        >
                          Ver a Execução que produziu esta resposta
                        </Link>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </CorpoDeTela>
          <div className="shrink-0 pb-4 pt-2" style={{ paddingInline: "var(--celula-x)" }}>
            {compositor(false)}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * O "+" da home aqui é só desenho: a Âncora de uma Sessão é fixada na criação
 * (B83), então não há menu para abrir — a caixa só mantém a mesma silhueta.
 * Sem aro e sem hover, para não prometer um clique que não existe.
 */
function MaisInerte({ className }: { readonly className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full ${className ?? ""}`}
      style={{ width: "var(--controle-h)", height: "var(--controle-h)", color: "var(--texto-3)" }}
    >
      <Icone de={Plus} tamanho="md" />
    </span>
  );
}
