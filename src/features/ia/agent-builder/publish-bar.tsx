"use client";

/**
 * A barra fixa do rodapé. Vive DENTRO da área que rola, presa embaixo com
 * `sticky`, para o conteúdo passar por trás dela; o painel dá o recuo final
 * que impede o último card de ficar escondido.
 *
 * Tudo que o botão precisa dizer fica AQUI, ao lado dele: o motivo de estar
 * desligado, o erro da publicação e o caminho para o Agente publicado. Um
 * erro no fim da lista rolável é um erro que ninguém vê.
 */

import { Check, ExternalLink, Info, Loader2 } from "lucide-react";
import Link from "next/link";
import { useId } from "react";

export function PublishBar({
  dirty,
  publishing,
  published,
  publishedAgentId,
  onPublish,
  disabledReason,
  error,
}: {
  readonly dirty: boolean;
  readonly publishing: boolean;
  /** Nome do que acabou de ser publicado, para a confirmação. */
  readonly published: string | null;
  readonly publishedAgentId: string | null;
  readonly onPublish: () => void;
  readonly disabledReason?: string;
  readonly error: string | null;
}) {
  const disabled = publishing || disabledReason !== undefined;
  const motivoId = useId();
  return (
    <div className="sticky bottom-0 z-10 -mx-5 mt-2 grid gap-2 border-t border-[var(--ab-borda)] bg-[var(--ab-painel)] px-5 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex min-w-0 flex-1 items-center gap-2 text-[13px]">
          {dirty ? (
            <>
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-[var(--ab-alteracao)]" />
              <span className="text-[var(--ab-texto-2)]">Alterações não publicadas</span>
              <span
                tabIndex={0}
                role="note"
                title="O que você mudou só vale para o agente depois de publicar."
                aria-label="O que você mudou só vale para o agente depois de publicar."
                className="grid size-5 place-items-center rounded-full text-[var(--ab-texto-3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ab-roxo)]"
              >
                <Info className="size-4" aria-hidden="true" />
              </span>
            </>
          ) : published ? (
            <>
              <Check className="size-4 shrink-0 text-[var(--ab-roxo)]" aria-hidden="true" />
              <span className="min-w-0 truncate text-[var(--ab-texto-2)]">Publicado: {published}</span>
              {publishedAgentId ? (
                <Link
                  href={`/ia/agentes/${publishedAgentId}`}
                  className="inline-flex shrink-0 items-center gap-1 text-[var(--ab-roxo)] hover:underline"
                >
                  Abrir a ficha
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                </Link>
              ) : null}
            </>
          ) : (
            <span className="text-[var(--ab-texto-3)]">Nada alterado desde a última publicação</span>
          )}
        </span>
        <button
          type="button"
          onClick={(event) => {
            if (disabled) {
              event.preventDefault();
              return;
            }
            onPublish();
          }}
          aria-disabled={disabled}
          aria-describedby={disabledReason || error ? motivoId : undefined}
          title={disabledReason}
          className={`inline-flex h-[48px] items-center justify-center gap-2 rounded-[9px] bg-[var(--ab-roxo-forte)] px-5 text-[14px] font-medium text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ab-roxo)] ${
            disabled ? "cursor-not-allowed opacity-60" : "hover:bg-[#6d31d6]"
          }`}
        >
          {publishing ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {publishing ? "Publicando…" : "Publicar agente"}
        </button>
      </div>
      {/* O motivo e o erro, visíveis para quem usa mouse, teclado ou leitor de tela. */}
      {error ? (
        <p id={motivoId} role="alert" className="text-[13px] text-[var(--cor-perigo)]">
          {error}
        </p>
      ) : disabledReason && !publishing ? (
        <p id={motivoId} className="text-right text-[12px] text-[var(--ab-texto-3)]">
          {disabledReason}
        </p>
      ) : null}
    </div>
  );
}
