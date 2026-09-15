"use client";

/**
 * O painel da direita: o controle segmentado, a conversa de teste e o campo
 * flutuante. A "resposta" do agente é o que o protótipo tem para dizer — ele
 * registra a mensagem e não executa Modelo — dita como resposta do agente
 * para o fluxo (enviar → carregando → resposta → rolagem) existir de verdade.
 */

import { Hammer, Play, Settings, Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";
import { ChatComposer } from "./chat-composer";

export interface PreviewMessage {
  readonly id: string;
  readonly role: "usuario" | "agente";
  readonly text: string;
}

export type PreviewTab = "configurar" | "construir" | "previsualizar";

export function SegmentedControl({
  value,
  onChange,
}: {
  readonly value: PreviewTab;
  readonly onChange: (tab: PreviewTab) => void;
}) {
  const opcoes: ReadonlyArray<{ readonly id: PreviewTab; readonly label: string; readonly Icone: typeof Settings }> = [
    { id: "configurar", label: "Configurar", Icone: Settings },
    { id: "construir", label: "Construir", Icone: Hammer },
    { id: "previsualizar", label: "Pré-visualizar", Icone: Play },
  ];
  return (
    <div role="tablist" aria-label="Modo" className="inline-flex gap-1 rounded-[10px] border border-[var(--ab-borda)] bg-[var(--ab-painel)] p-1">
      {opcoes.map(({ id, label, Icone }) => {
        const ativo = value === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={ativo}
            onClick={() => onChange(id)}
            className={`inline-flex h-8 items-center gap-1.5 rounded-[7px] border px-3 text-[13px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ab-roxo)] ${
              ativo
                ? "border-[var(--ab-roxo)] bg-[var(--ab-roxo-translucido)] text-[var(--ab-roxo)]"
                : "border-transparent text-[var(--ab-texto-2)] hover:bg-[var(--ab-elevado)] hover:text-[var(--ab-texto)]"
            }`}
          >
            <Icone className="size-4" aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function AgentPreview({
  agentName,
  messages,
  loading,
  onSend,
  tab,
  onTab,
  showControl,
  mode = "previsualizar",
}: {
  readonly agentName: string;
  readonly messages: readonly PreviewMessage[];
  readonly loading: boolean;
  readonly onSend: (text: string) => void;
  readonly tab: PreviewTab;
  readonly onTab: (tab: PreviewTab) => void;
  /** Em telas largas o controle mora aqui; em telas estreitas, acima dos dois painéis. */
  readonly showControl: boolean;
  /** "construir" é a conversa com o assistente que ajuda a montar o agente. */
  readonly mode?: "previsualizar" | "construir";
}) {
  const construindo = mode === "construir";
  const fim = useRef<HTMLLIElement>(null);
  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages.length, loading]);

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[14px] border border-[var(--ab-borda)] bg-[#050506]">
      {showControl ? (
        <div className="absolute left-4 top-4 z-10 max-[899px]:hidden">
          <SegmentedControl value={tab} onChange={onTab} />
        </div>
      ) : null}

      {messages.length === 0 && !loading ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
          <span className="grid size-[120px] place-items-center rounded-full border border-[rgba(169,112,255,0.35)] bg-[var(--ab-roxo-translucido)] text-[var(--ab-roxo)]">
            {construindo ? <Hammer className="size-10" aria-hidden="true" /> : <Sparkles className="size-10" aria-hidden="true" />}
          </span>
          <h2 className="mt-5 text-[20px] font-semibold text-[var(--ab-texto)]">
            {construindo ? "Construa com ajuda" : "Teste seu agente"}
          </h2>
          <p className="mt-1.5 max-w-[34rem] text-[14px] text-[var(--ab-texto-2)]">
            {construindo
              ? "Conte o que o seu agente precisa fazer. O assistente pergunta o que falta e preenche a configuração à esquerda com as suas respostas."
              : "Envie uma mensagem para conversar com o seu agente e ver como ele se comporta."}
          </p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-[130px] pt-16">
          <ol className="mx-auto grid w-full max-w-[46rem] gap-4">
            {messages.map((message) => (
              <li key={message.id} className={`flex ${message.role === "usuario" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-[14px] px-4 py-2.5 text-[14px] leading-relaxed ${
                    message.role === "usuario"
                      ? "bg-[var(--ab-roxo-forte)] text-white"
                      : "border border-[var(--ab-borda)] bg-[var(--ab-campo)] text-[var(--ab-texto)]"
                  }`}
                >
                  {message.role === "agente" ? (
                    <p className="mb-1 text-[11px] text-[var(--ab-texto-3)]">
                      {construindo ? "Assistente de construção" : agentName || "Agente"}
                    </p>
                  ) : null}
                  <p className="whitespace-pre-wrap">{message.text}</p>
                </div>
              </li>
            ))}
            {loading ? (
              <li className="flex justify-start" aria-live="polite" aria-label="O agente está respondendo">
                <div className="flex items-center gap-1.5 rounded-[14px] border border-[var(--ab-borda)] bg-[var(--ab-campo)] px-4 py-3">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      aria-hidden="true"
                      className="size-2 animate-bounce rounded-full bg-[var(--ab-texto-2)]"
                      style={{ animationDelay: `${i * 120}ms` }}
                    />
                  ))}
                </div>
              </li>
            ) : null}
            <li ref={fim} aria-hidden="true" />
          </ol>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-[38px] flex justify-center">
        <ChatComposer
          onSend={onSend}
          disabled={loading}
          placeholder={construindo ? "Diga o que o seu agente deve fazer" : undefined}
        />
      </div>
    </div>
  );
}
