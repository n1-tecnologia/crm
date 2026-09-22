"use client";

import { Plus, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button, Icone } from "@/features/shell/ui";

/**
 * CRIAR DENTRO DO GRUPO. Cada grupo de uma Lista (um Status, uma coluna do
 * Quadro, um grupo do Financeiro) tem o seu "+" na régua; ele abre um
 * compositor de uma linha ali mesmo, e a Tarefa nasce já naquele grupo — sem
 * ir ao campo do topo e depois arrastar.
 *
 * O estado de "qual grupo está compondo" é de quem lista os grupos; estas duas
 * peças só desenham o botão e a linha.
 */

/** O "+" da régua do grupo. Quando não pode criar, continua visível e diz por quê (§11). */
export function BotaoDeMais({
  rotulo,
  onClick,
  motivo,
  onBloqueado,
  aberto = false,
}: {
  readonly rotulo: string;
  readonly onClick: () => void;
  /** Por que não cria aqui — vira o `title` e desabilita. */
  readonly motivo?: string;
  /**
   * O clique no "+" bloqueado. O `title` só fala com o mouse parado; quem
   * clica quer criar, e merece a resposta na tela (o motivo, e o caminho).
   */
  readonly onBloqueado?: (motivo: string) => void;
  readonly aberto?: boolean;
}) {
  const bloqueado = motivo !== undefined;
  return (
    <button
      type="button"
      onClick={bloqueado ? () => onBloqueado?.(motivo) : onClick}
      aria-disabled={bloqueado}
      aria-expanded={aberto}
      aria-label={`Nova em ${rotulo}`}
      title={motivo ?? `Nova em ${rotulo}`}
      className={`btn-icone btn-icone-nu shrink-0 ${bloqueado ? "opacity-40" : ""}`}
    >
      <Icone de={Plus} tamanho="xs" />
    </button>
  );
}

/** A linha de composição: título, Criar, e Esc/✕ para desistir. */
export function CompositorNoGrupo({
  placeholder,
  onCreate,
  onCancel,
  className,
}: {
  readonly placeholder: string;
  /** Devolve `true` quando criou — a linha se limpa e fecha. */
  readonly onCreate: (title: string) => boolean;
  readonly onCancel: () => void;
  readonly className?: string;
}) {
  const [titulo, setTitulo] = useState("");
  const enviar = (event?: FormEvent) => {
    event?.preventDefault();
    const texto = titulo.trim();
    if (!texto) return;
    if (onCreate(texto)) {
      setTitulo("");
      onCancel();
    }
  };
  return (
    <form onSubmit={enviar} className={`flex items-center gap-2 ${className ?? ""}`}>
      <input
        value={titulo}
        onChange={(event) => setTitulo(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel();
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        autoFocus
        className="campo min-w-0 flex-1"
        style={{ height: "var(--controle-h-sm)" }}
      />
      <Button type="submit" size="sm" variant="primary" disabled={!titulo.trim()} disabledReason="Escreva o título.">
        Criar
      </Button>
      <button type="button" onClick={onCancel} aria-label="Cancelar" title="Cancelar (Esc)" className="btn-icone btn-icone-nu shrink-0">
        <Icone de={X} tamanho="xs" />
      </button>
    </form>
  );
}
