"use client";

/**
 * T24 — Sessão de Chat.
 *
 * B84 — a Mensagem de Chat é imutável: corrigir cria uma nova, nunca edita a
 * anterior. Por isso não há edição aqui, e uma Mensagem substituída continua
 * visível, marcada.
 *
 * A resposta do Agente nasce de uma Execução, e este protótipo não executa
 * Modelo nenhum. A tela diz isso uma vez, embaixo da caixa, e deixa o link
 * para a Execução onde ela existir — em vez de inventar uma resposta que
 * ninguém gerou.
 *
 * 2026-09-25 — refatoração visual: o compositor é o mesmo da home
 * (`CompositorDoChat`, o PromptBar do sistema), e os ajustes continuam na
 * caixa DEPOIS da primeira Mensagem (antes sumiam: Agente, Modelo, Habilidade
 * e pasta ficavam inalcançáveis). Trocar o Agente ou o Modelo com a Sessão em
 * curso deixa uma Mensagem 'sistema' no fio (DO-CHT-12). O fio assenta
 * embaixo, junto da caixa, e desce até a Mensagem nova; enviar não abre mais
 * um aviso de "registrada" — a Mensagem aparecendo é a confirmação. A caixa
 * no pé é uma doca (`.doca-do-robo`): o robô flutuante fica AO LADO do enviar.
 */

import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { Anchor, Bot, Info } from "lucide-react";
import { useData, useRun, useSession } from "@/data/store";
import { useRecente } from "@/features/shell/recente";
import { configureChatSession, sendChatMessage } from "@/data/operations";
import { reduzido } from "@/design/movimento";
import { useDialogoDeAncora } from "@/features/ia/ancora-do-chat";
import { useChatFolderDialogs } from "@/features/ia/chat-folder-dialogs";
import { CompositorDoChat, type AjustesDoChat } from "@/features/ia/compositor-do-chat";
import { useLarguraDoChat } from "@/features/ia/largura-do-chat";
import { ACTOR_KIND_LABEL } from "@/features/shell/format";
import { useFormat } from "@/features/shell/use-format";
import {
  CorpoDeTela,
  EmptyState,
  Icone,
  NoAccessState,
  PageHeader,
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

const CAMPO = "chat-composer";

export default function SessaoPage({ params }: { params: Promise<{ sessao: string }> }) {
  const { sessao } = use(params);
  const state = useData((data) => data);
  const { memberId } = useSession();
  const run = useRun();
  // A mensagem recém-registrada surge; o fio não tem cascata.
  const recente = useRecente();
  const fmt = useFormat();
  const [largura, setLargura] = useLarguraDoChat();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fimDoFio = useRef<HTMLDivElement>(null);
  const jaRolou = useRef(false);

  const record = state.chatSessions.find((s) => s.id === sessao);
  const quantas = record?.messages.length ?? 0;

  // A caixa troca de lugar (do meio para o pé) na primeira Mensagem, e monta
  // ao chegar da home: o foco vai para o campo — senão fica no <body> e a
  // pessoa tem de clicar de novo para continuar escrevendo.
  const vazia = quantas === 0;
  useEffect(() => {
    const campo = document.getElementById(CAMPO);
    if (campo instanceof HTMLTextAreaElement && !campo.disabled) campo.focus({ preventScroll: true });
  }, [vazia]);

  // O fio desce até a Mensagem mais nova: na chegada de uma vez, depois de
  // cada Mensagem com a rolagem suave (instantânea em movimento reduzido).
  useEffect(() => {
    if (quantas === 0) return;
    fimDoFio.current?.scrollIntoView({ block: "end", behavior: jaRolou.current && !reduzido() ? "smooth" : "auto" });
    jaRolou.current = true;
  }, [quantas]);

  const ajustarSessao = (input: Parameters<typeof configureChatSession>[3]) => {
    if (!record) return;
    const result = run((data, actingMemberId) => configureChatSession(data, actingMemberId, record.id, input));
    setError(result.ok ? null : result.error);
  };
  // "Nova pasta…" pelo compositor: a pasta nasce e já guarda esta Sessão.
  const { dialogs: dialogosDaPasta, openCreate } = useChatFolderDialogs((_mensagem, criadaId) => {
    if (criadaId) ajustarSessao({ folderId: criadaId });
  });
  const { dialogo: dialogoDaAncora, abrir: abrirAncora } = useDialogoDeAncora((escolha) => ajustarSessao({ anchor: escolha }));

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

  const podeEscrever = isOwner && record.lifecycle === "ativo";
  const somenteLeitura = !isOwner
    ? "Você tem leitura desta Sessão; escrever é do Proprietário."
    : record.lifecycle !== "ativo"
      ? "Esta Sessão não está ativa."
      : undefined;
  const bloqueio = somenteLeitura ?? (draft.trim() === "" ? "Escreva antes de enviar." : undefined);

  const send = () => {
    const result = run((data, actingMemberId) => sendChatMessage(data, actingMemberId, record.id, draft));
    if (result.ok) {
      setDraft("");
      setError(null);
    } else {
      setError(result.error);
    }
  };

  const mensagens = [...record.messages].sort((a, b) => a.order - b.order);
  const nomeDoAutor = (message: (typeof mensagens)[number]): string =>
    message.author.kind === "agent"
      ? (state.agents.find((a) => a.id === message.author.id)?.name ??
        ACTOR_KIND_LABEL[message.author.kind] ??
        message.author.kind)
      : (state.members.find((m) => m.id === message.author.id)?.displayName ??
        ACTOR_KIND_LABEL[message.author.kind] ??
        message.author.kind);

  const ajustes: AjustesDoChat = {
    folderId: record.folderId ?? "",
    skillId: record.skillId ?? "",
    modelId: record.chosenModelId ?? "",
    agentId: record.mainAgentId ?? "",
  };
  // Cada troca grava na hora: não há botão de salvar porque não há formulário.
  const aoAjustar = (patch: Partial<AjustesDoChat>) =>
    ajustarSessao({
      ...(patch.agentId !== undefined ? { mainAgentId: patch.agentId || null } : {}),
      ...(patch.folderId !== undefined ? { folderId: patch.folderId || null } : {}),
      ...(patch.skillId !== undefined ? { skillId: patch.skillId || null } : {}),
      ...(patch.modelId !== undefined ? { chosenModelId: patch.modelId || null } : {}),
    });

  const compositor = (tamanho: "palco" | "rodape") => (
    <CompositorDoChat
      id={CAMPO}
      rotulo="Escrever na Sessão"
      tamanho={tamanho}
      valor={draft}
      aoMudar={setDraft}
      placeholder={tamanho === "palco" ? "O que você quer criar ou resolver?" : "Escreva a próxima mensagem"}
      aoEnviar={send}
      rotuloDoEnvio="Enviar"
      {...(bloqueio ? { bloqueio } : {})}
      {...(somenteLeitura ? { somenteLeitura } : {})}
      ajustes={ajustes}
      aoAjustar={aoAjustar}
      {...(record.anchor ? { ancora: record.anchor.nameAtTheTime } : {})}
      {...(record.messages.length > 0 ? { ancoraTravada: "A Âncora é fixada na criação: com Mensagens, ela não muda." } : {})}
      aoAncorar={() => abrirAncora(record.anchor ? { type: record.anchor.type, id: record.anchor.id } : undefined)}
      aoTirarAncora={() => ajustarSessao({ anchor: null })}
      aoNovaPasta={openCreate}
      largura={largura}
      aoLargura={setLargura}
    />
  );

  const nota = "A resposta nasce de uma Execução; este protótipo registra a mensagem e não executa Modelo.";

  return (
    <div className="chat-tela" data-largura={largura}>
      {dialogosDaPasta}
      {dialogoDaAncora}
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
              <span className="max-w-48 truncate">{agent?.name ?? "Assistente padrão"}</span>
            </span>
            {record.anchor ? (
              <Pilula
                tom="neutro"
                className="min-w-0"
                title="A Âncora guarda o nome que o registro tinha quando a Sessão foi aberta."
              >
                <Icone de={Anchor} tamanho="xs" />
                <span className="max-w-64 truncate">{record.anchor.nameAtTheTime}</span>
              </Pilula>
            ) : null}
            {!isOwner ? <span className="app-meta">você tem leitura</span> : null}
          </>
        }
      />

      {error ? (
        <div className="px-4 pt-3">
          <Toast tone="error" onDismiss={() => setError(null)}>
            {error}
          </Toast>
        </div>
      ) : null}

      {mensagens.length === 0 ? (
        <CorpoDeTela className="chat-home">
          <div className="chat-coluna chat-home-miolo">
            <h2 className="ed-titulo chat-home-titulo">
              {isOwner ? "No que vamos trabalhar?" : "O Proprietário ainda não escreveu nada aqui."}
            </h2>
            {compositor("palco")}
            <p className="app-sm chat-nota">{nota}</p>
          </div>
        </CorpoDeTela>
      ) : (
        <>
          <CorpoDeTela>
            <div className="chat-fio">
              <ol className="chat-coluna chat-fio-lista" aria-label="Mensagens da Sessão">
                {mensagens.map((message) => {
                  const surgir = message.id === recente ? " surgir" : "";
                  // A Mensagem 'sistema' (trocou o Agente, o Modelo): uma nota
                  // no meio do fio, entre hairlines — ninguém a disse.
                  if (message.role === "sistema") {
                    return (
                      <li key={message.id} className={`chat-aviso app-xs${surgir}`}>
                        <span className="flex items-center gap-1.5">
                          <Icone de={Info} tamanho="xs" />
                          {message.content} · {fmt.instant(message.at)}
                        </span>
                      </li>
                    );
                  }
                  const minha = message.role === "usuario";
                  return (
                    <li
                      key={message.id}
                      className={`flex flex-col ${minha ? "items-end" : "items-start"} ${message.replaced ? "opacity-60" : ""}${surgir}`}
                    >
                      {/*
                        Como o ChatGPT: o que eu disse é um balão à direita, com
                        o canto de baixo à direita recortado, e a hora embaixo;
                        a resposta é texto corrido à esquerda, sem moldura.
                        Ferramenta é texto miúdo, para não parecer resposta.
                      */}
                      {!minha ? (
                        <p className="app-meta mb-1 px-1">
                          {ROLE_LABEL[message.role]} · {nomeDoAutor(message)} · {fmt.instant(message.at)}
                          {message.replaced ? " · substituída" : ""}
                        </p>
                      ) : null}
                      <div className={minha ? "chat-balao" : `max-w-[85%] px-1 ${message.role === "assistente" ? "" : "app-sm"}`}>
                        <p className="app-base whitespace-pre-wrap" style={{ color: "var(--texto)" }}>
                          {message.content}
                        </p>

                        {message.toolId ? (
                          <p className="app-sm mt-1" style={{ color: "var(--texto-3)" }}>
                            Ferramenta {state.tools.find((t) => t.id === message.toolId)?.name ?? message.toolId}
                            {message.toolResult ? ` · ${TOOL_RESULT_LABEL[message.toolResult] ?? message.toolResult}` : ""}
                          </p>
                        ) : null}

                        {message.knowledgeReferences.length > 0 ? (
                          <ul className="app-sm mt-1 space-y-0.5" style={{ color: "var(--texto-3)" }}>
                            {message.knowledgeReferences.map((reference, index) => (
                              <li key={`${reference.documentId}-${index}`}>
                                Conhecimento consultado:{" "}
                                <Link href={`/ia/conhecimento/documentos/${reference.documentId}`} className="hover:underline">
                                  {state.documents.find((d) => d.id === reference.documentId)?.title ?? reference.documentId}
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
                      {minha ? (
                        <p className="app-xs chat-hora">
                          {fmt.instant(message.at)}
                          {message.replaced ? " · substituída" : ""}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
              <div ref={fimDoFio} />
            </div>
          </CorpoDeTela>
          {/* A DOCA é a própria coluna (sem padding): o robô só recua a caixa
              quando a coluna chega nele — numa tela larga, a caixa continua
              alinhada ao fio. */}
          <div className="chat-rodape">
            <div className="chat-coluna doca-do-robo">
              {compositor("rodape")}
              {podeEscrever ? <p className="app-xs chat-rodape-nota">{nota}</p> : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
