"use client";

/**
 * A CONVERSA DE GRUPO dentro da ficha do Grupo (e da Comunidade, pelo Grupo
 * de avisos): os balões no desenho da Caixa de Entrada, mas sem Contato —
 * quem fala é o Canal (à direita) ou um participante (à esquerda, pelo
 * Identificador que a Mensagem trouxe). O compositor manda por
 * `enviarMensagemAoGrupo` (RN-GRP-13): a primeira Mensagem cria a Conversa,
 * e o botão desligado diz por quê na mesma frase da operação.
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { useData, useRun } from "@/data/store";
import { useRecente } from "@/features/shell/recente";
import { enviarMensagemAoGrupo, recusaDeEnvioAoGrupo } from "@/data/operations";
import { contactDisplayName } from "@/data/derive";
import { conversaDoGrupo } from "@/data/derive-ferramentas";
import type { OperationResult } from "@/data/state";
import type { Message } from "@/data/types";
import type { Report } from "@/features/shell/ficha";
import { useFormat } from "@/features/shell/use-format";
import { EmptyState, Icone, cn } from "@/features/shell/ui";

export function ConversaDoGrupo({
  grupoId,
  report,
  nota,
  dentroDaCaixa = false,
  enviar: enviarPorFora,
  recusaPorFora,
}: {
  readonly grupoId: string;
  readonly report: Report;
  readonly nota?: string;
  /** Já está na Caixa de Entrada: o link para ela não faz sentido. */
  readonly dentroDaCaixa?: boolean;
  /** Quem envia, quando não é o Grupo direto — a Comunidade fala pelo Grupo de avisos (RN-COM-05). */
  readonly enviar?: (content: string) => OperationResult<unknown>;
  /** Uma recusa de quem envia por fora (a Comunidade na lixeira), antes da recusa do Grupo. */
  readonly recusaPorFora?: string;
}) {
  const state = useData((data) => data);
  const run = useRun();
  // A Mensagem recém-enviada surge; as outras já estão.
  const recente = useRecente();
  const fmt = useFormat();
  const [texto, setTexto] = useState("");
  const rolagem = useRef<HTMLDivElement>(null);

  const grupo = state.grupos.find((g) => g.id === grupoId);
  const conversa = grupo ? conversaDoGrupo(state, grupo) : undefined;
  const mensagens = conversa ? [...conversa.messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt)) : [];
  const recusa = recusaPorFora ?? (grupo ? recusaDeEnvioAoGrupo(state, grupo) : "Grupo não encontrado.");

  const contagemAnterior = useRef(mensagens.length);
  useEffect(() => {
    const el = rolagem.current;
    if (el && mensagens.length > contagemAnterior.current) el.scrollTop = el.scrollHeight;
    contagemAnterior.current = mensagens.length;
  }, [mensagens.length]);

  if (!grupo) return null;

  const quemFalou = (m: Message): string => {
    if (m.direction === "enviada") {
      if (m.actor.kind === "member") return state.members.find((x) => x.id === m.actor.id)?.displayName ?? "Membro";
      if (m.actor.kind === "automation") return state.automations.find((x) => x.id === m.actor.id)?.name ?? "Automação";
      return state.channels.find((c) => c.id === grupo.canalId)?.name ?? "Canal";
    }
    const contato = state.contacts.find((c) => c.identifiers.some((i) => i.id === m.viaIdentifierId));
    return contato ? contactDisplayName(contato) : "Participante";
  };

  const enviar = () => {
    if (!texto.trim() || recusa) return;
    const r = enviarPorFora ? enviarPorFora(texto) : run((data, me) => enviarMensagemAoGrupo(data, me, grupo.id, { content: texto }));
    report(r, conversa ? "Mensagem enviada ao Grupo." : "Conversa de grupo criada e Mensagem enviada.");
    if (r.ok) setTexto("");
  };

  return (
    <div className="painel flex min-h-0 flex-col" style={{ maxHeight: "var(--conversa-empilhada-h)" }}>
      {nota ? (
        <p className="app-sm px-3 py-2" style={{ color: "var(--texto-3)", borderBottom: "1px solid var(--linha)" }}>
          {nota}
        </p>
      ) : null}
      <div ref={rolagem} className="min-h-0 flex-1 overflow-y-auto p-3" style={{ minHeight: "12rem" }}>
        {mensagens.length === 0 ? (
          <EmptyState compact title={conversa ? "Nenhuma Mensagem ainda." : "Este Grupo ainda não tem Conversa de grupo."} hint={conversa ? undefined : "A primeira Mensagem enviada a cria (RN-GRP-13)."} />
        ) : (
          <ol className="grid gap-2">
            {mensagens.map((m) => {
              const saiu = m.direction !== "recebida";
              return (
                <li key={m.id} className={`flex ${saiu ? "justify-end" : "justify-start"}${m.id === recente ? " surgir" : ""}`}>
                  <div
                    className={cn("app-base max-w-[80%] rounded-[var(--r-painel)] px-3 py-2", saiu ? "rounded-br-md" : "rounded-bl-md")}
                    style={saiu ? { background: "var(--acento)", color: "var(--sobre-acento)" } : { background: "var(--superficie-2)", color: "var(--texto)" }}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    <p className={cn("app-sm mt-1", saiu ? "opacity-80" : "")} style={saiu ? undefined : { color: "var(--texto-3)" }}>
                      {quemFalou(m)} · {fmt.relative(m.createdAt)}
                      {m.deliveryStatus ? ` · ${m.deliveryStatus}` : ""}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
      <form
        className="shrink-0 p-3"
        style={{ borderTop: "1px solid var(--linha)" }}
        onSubmit={(event) => {
          event.preventDefault();
          enviar();
        }}
      >
        <div className="relative" title={recusa}>
          <textarea
            value={texto}
            onChange={(event) => setTexto(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                enviar();
              }
            }}
            rows={2}
            placeholder={recusa ?? "Escreva a Mensagem ao Grupo. Ctrl+Enter envia."}
            aria-label="Mensagem ao Grupo"
            readOnly={recusa !== undefined}
            aria-disabled={recusa !== undefined}
            className="campo block"
            style={{ height: "auto", paddingBlock: "var(--e-2)", paddingRight: "var(--controle-h)", resize: "none" }}
          />
          <button
            type="submit"
            aria-label="Enviar"
            title={recusa ?? (texto.trim() === "" ? "Escreva a Mensagem antes de enviar." : "Enviar (Ctrl+Enter)")}
            disabled={recusa !== undefined || texto.trim() === ""}
            className="btn-icone btn-icone-enviar absolute"
            style={{ right: "var(--e-1)", bottom: "var(--e-1)" }}
          >
            <Icone de={Send} tamanho="xs" />
          </button>
        </div>
        {conversa && !dentroDaCaixa ? (
          <p className="app-meta mt-1.5">
            <Link href={`/crm/caixa-de-entrada/${conversa.id}`} className="hover:underline">
              Abrir na Caixa de Entrada
            </Link>
            {" · "}
            {conversa.state}
          </p>
        ) : null}
      </form>
    </div>
  );
}
