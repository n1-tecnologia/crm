"use client";

/**
 * O campo flutuante da pré-visualização. Enter envia, Shift+Enter quebra a
 * linha. Anexo e microfone existem como controles, mas o protótipo não
 * anexa nem grava: o `title` de cada um diz isso em vez de fingir.
 */

import { Mic, Paperclip, Send } from "lucide-react";
import { useState } from "react";

export function ChatComposer({
  onSend,
  disabled = false,
  placeholder = "Envie uma mensagem para testar o agente",
}: {
  readonly onSend: (text: string) => void;
  readonly disabled?: boolean;
  readonly placeholder?: string;
}) {
  const [texto, setTexto] = useState("");
  const podeEnviar = texto.trim() !== "" && !disabled;

  const enviar = () => {
    if (!podeEnviar) return;
    onSend(texto.trim());
    setTexto("");
  };

  return (
    <div className="flex h-[70px] w-[90%] items-center gap-2 rounded-[14px] border border-[var(--ab-borda-campo)] bg-[var(--ab-campo)] px-3">
      <button
        type="button"
        aria-label="Anexar arquivo"
        aria-disabled="true"
        title="Anexar — o protótipo ainda não envia arquivos."
        className="grid size-9 shrink-0 cursor-not-allowed place-items-center rounded-full text-[var(--ab-texto-3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ab-roxo)]"
      >
        <span className="sr-only">Anexar — o protótipo ainda não envia arquivos.</span>
        <Paperclip className="size-4" aria-hidden="true" />
      </button>
      <label className="sr-only" htmlFor="preview-mensagem">
        Mensagem para testar o agente
      </label>
      <textarea
        id="preview-mensagem"
        value={texto}
        onChange={(event) => setTexto(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            enviar();
          }
        }}
        rows={1}
        disabled={disabled}
        placeholder={placeholder}
        className="max-h-[52px] min-w-0 flex-1 resize-none bg-transparent px-1 py-2 text-[14px] text-[var(--ab-texto)] outline-none [field-sizing:content] placeholder:text-[var(--ab-texto-3)] focus-visible:outline-none disabled:opacity-60"
      />
      <button
        type="button"
        aria-label="Gravar áudio"
        aria-disabled="true"
        title="Gravar áudio — o protótipo ainda não grava."
        className="grid size-9 shrink-0 cursor-not-allowed place-items-center rounded-full text-[var(--ab-texto-3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ab-roxo)]"
      >
        <span className="sr-only">Gravar áudio — o protótipo ainda não grava.</span>
        <Mic className="size-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={enviar}
        aria-disabled={!podeEnviar}
        aria-label="Enviar"
        title={podeEnviar ? "Enviar" : disabled ? "Aguarde a resposta." : "Escreva a mensagem antes de enviar."}
        className={`grid size-10 shrink-0 place-items-center rounded-full bg-[var(--ab-roxo-forte)] text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ab-roxo)] ${
          podeEnviar ? "hover:bg-[#6d31d6]" : "cursor-not-allowed opacity-50"
        }`}
      >
        <Send className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
