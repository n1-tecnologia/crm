"use client";

/**
 * T25 — Chat: a home.
 *
 * A pergunta e o compositor, como o ChatGPT: a Sessão nasce da primeira
 * mensagem, não de um formulário. O título é a primeira linha do que a pessoa
 * escreveu.
 *
 * 2026-09-25 — refatoração visual ("o componente de chat deve seguir este
 * prompt de exemplo"): o compositor virou o PromptBar do sistema
 * (`CompositorDoChat`), com todos os ajustes DENTRO da caixa — a barra de
 * chips encaixada por trás dela saiu (quase invisível, e a escolha ficava só
 * na dica). O bloco começa numa altura fixa da tela (não centrado: o campo
 * cresce sem a tela respirar). As três sugestões de começo saíram em
 * 2026-09-28 ("remova isso do chat ia"): a tela é a pergunta e a caixa.
 *
 * As Sessões e as pastas moram no menu lateral, não aqui: esta tela é para
 * começar, e a lista já está a um olhar de distância à esquerda.
 *
 * DO-CHT-09 — a Sessão de terceiro não é acessível a Papel nenhum, inclusive
 * ao Proprietário do Espaço de Trabalho.
 */

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useData, useRun, useRunConfirmado, useSession } from "@/dados/store";
import { createChatSession, sendChatMessage } from "@n1/dominio/operations";
import { recusaDeTrocarModelo } from "@n1/dominio/derive-ia";
import { nomeDaEscolha, useDialogoDeAncora, type EscolhaDeAncora } from "@/features/ia/ancora-do-chat";
import { useChatFolderDialogs } from "@/features/ia/chat-folder-dialogs";
import { CompositorDoChat, type AjustesDoChat } from "@/features/ia/compositor-do-chat";
import { useLarguraDoChat } from "@/features/ia/largura-do-chat";
import { CorpoDeTela, Toast } from "@/features/shell/ui";

const CAMPO = "comeco-do-chat";

const tituloDe = (texto: string): string => {
  const primeira = texto.trim().split("\n")[0] ?? "";
  return primeira.length > 72 ? `${primeira.slice(0, 69).trimEnd()}…` : primeira;
};

const SEM_AJUSTES: AjustesDoChat = { folderId: "", skillId: "", modelId: "", agentId: "" };

export default function ChatPage() {
  const { memberId } = useSession();
  const state = useData((data) => data);
  const run = useRun();
  const runConfirmado = useRunConfirmado();
  const router = useRouter();
  const [largura, setLargura] = useLarguraDoChat();
  const [texto, setTexto] = useState("");
  const [ajustes, setAjustes] = useState<AjustesDoChat>(SEM_AJUSTES);
  const [ancora, setAncora] = useState<EscolhaDeAncora | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // "Nova pasta…" pelo compositor: a pasta nasce e já fica escolhida.
  const { dialogs, openCreate } = useChatFolderDialogs((mensagem, criadaId) => {
    setNotice(mensagem);
    if (criadaId) setAjustes((atual) => ({ ...atual, folderId: criadaId }));
  });
  const { dialogo: dialogoDaAncora, abrir: abrirAncora } = useDialogoDeAncora(setAncora);

  const eu = state.members.find((m) => m.id === memberId);
  // Uma pasta escolhida e depois excluída (no menu lateral) deixa de valer:
  // a caixa mostra "Sem pasta" e Começar não tropeça num id apagado.
  const pastaValida = state.chatFolders.some((f) => f.id === ajustes.folderId && f.ownerMemberId === memberId);
  const ajustesEfetivos: AjustesDoChat = ajustes.folderId && !pastaValida ? { ...ajustes, folderId: "" } : ajustes;
  // Enter repetido ou clique duplo: a navegação é assíncrona e a segunda
  // chamada criaria outra Sessão igual. A trava cai se algo for recusado.
  const comecando = useRef(false);

  const ajustar = (patch: Partial<AjustesDoChat>) =>
    setAjustes((atual) => {
      const novo = { ...atual, ...patch };
      // B75 — um Agente que não admite sobrescrita volta ao Modelo dele (a
      // criação recusaria o par); a pílula mostra a troca.
      if (patch.agentId !== undefined && novo.modelId && recusaDeTrocarModelo(state, novo.agentId || undefined)) {
        return { ...novo, modelId: "" };
      }
      return novo;
    });

  /*
    Uma ação só: cria a Sessão e envia a primeira Mensagem. Se a Mensagem for
    recusada, a pessoa continua aqui com o texto e o erro — nada some. A
    Mensagem vai para o id que o SERVIDOR deu à Sessão (checklist E1): o da
    cópia local é de outro registro quando alguém gravou no mesmo instante.
  */
  const comecar = () => {
    if (comecando.current) return;
    comecando.current = true;
    const { local: criada, confirmado } = runConfirmado((data, id) =>
      createChatSession(data, id, {
        title: tituloDe(texto),
        ...(ajustesEfetivos.agentId ? { mainAgentId: ajustesEfetivos.agentId } : {}),
        ...(ajustesEfetivos.modelId ? { chosenModelId: ajustesEfetivos.modelId } : {}),
        ...(ajustesEfetivos.folderId ? { folderId: ajustesEfetivos.folderId } : {}),
        ...(ajustesEfetivos.skillId ? { skillId: ajustesEfetivos.skillId } : {}),
        ...(ancora ? { anchor: ancora } : {}),
      }),
    );
    if (!criada.ok) {
      comecando.current = false;
      setError(criada.error);
      return;
    }
    void confirmado.then((sessao) => {
      if (!sessao.ok) {
        comecando.current = false;
        setError(sessao.error);
        return;
      }
      const enviada = run((data, id) => sendChatMessage(data, id, sessao.value.id, texto));
      if (!enviada.ok) {
        comecando.current = false;
        setError(enviada.error);
        return;
      }
      router.push(`/ia/chat/${sessao.value.id}`);
    });
  };

  const bloqueio = texto.trim() === "" ? "Escreva o que você quer trabalhar." : undefined;

  return (
    <>
      {dialogs}
      {dialogoDaAncora}

      <div className="chat-tela" data-largura={largura}>
        {notice ? (
          <div className="px-4 pt-3">
            <Toast tone="success" onDismiss={() => setNotice(null)}>
              {notice}
            </Toast>
          </div>
        ) : null}

        <CorpoDeTela className="chat-home">
          <div className="chat-coluna chat-home-miolo">
            <h1 className="ed-titulo chat-home-titulo">
              {eu ? `No que vamos trabalhar, ${eu.displayName.split(" ")[0]}?` : "No que vamos trabalhar?"}
            </h1>

            <CompositorDoChat
              id={CAMPO}
              rotulo="O que você quer trabalhar"
              tamanho="palco"
              valor={texto}
              aoMudar={(valor) => {
                setTexto(valor);
                if (error) setError(null);
              }}
              placeholder="O que você quer criar ou resolver?"
              aoEnviar={comecar}
              rotuloDoEnvio="Começar"
              {...(bloqueio ? { bloqueio } : {})}
              ajustes={ajustesEfetivos}
              aoAjustar={ajustar}
              {...(ancora ? { ancora: nomeDaEscolha(state, memberId, ancora) ?? "Registro" } : {})}
              aoAncorar={() => abrirAncora(ancora ?? undefined)}
              aoTirarAncora={() => setAncora(null)}
              aoNovaPasta={openCreate}
              largura={largura}
              aoLargura={setLargura}
            />

            {error ? (
              <p role="alert" className="app-base mt-3 text-center" style={{ color: "var(--erro)" }}>
                {error}
              </p>
            ) : null}

            <p className="app-sm chat-nota">Suas Sessões e pastas ficam no menu, em Chat. Nenhum Papel dá acesso a Sessão alheia.</p>
          </div>
        </CorpoDeTela>
      </div>
    </>
  );
}
