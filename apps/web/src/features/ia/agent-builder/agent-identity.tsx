"use client";

/**
 * Avatar, nome e descrição. O avatar é um `<input type="file">` escondido:
 * o círculo e o "+" são o rótulo dele, então o clique abre o seletor do
 * sistema e a imagem escolhida vira a prévia — sem upload, porque o protótipo
 * não tem servidor.
 */

import { Image as ImageIcon, Plus } from "lucide-react";
import { useId, useRef } from "react";
import { BuilderInput } from "./fields";

export function AgentIdentity({
  name,
  description,
  avatarUrl,
  onChange,
}: {
  readonly name: string;
  readonly description: string;
  readonly avatarUrl: string | null;
  readonly onChange: (patch: { name?: string; description?: string; avatarUrl?: string | null }) => void;
}) {
  const fileId = useId();
  const objectUrl = useRef<string | null>(null);

  const escolher = (file: File | undefined) => {
    if (!file) return;
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = URL.createObjectURL(file);
    onChange({ avatarUrl: objectUrl.current });
  };

  return (
    // Avatar em cima, campos embaixo na largura toda: lado a lado, o painel
    // de 38% deixava Nome e Descrição espremidos ao lado do círculo.
    <div className="grid gap-4">
      <div className="relative mx-auto w-fit">
        <input
          id={fileId}
          type="file"
          accept="image/*"
          className="peer sr-only"
          onChange={(event) => escolher(event.target.files?.[0])}
        />
        <label
          htmlFor={fileId}
          title="Escolher a imagem do agente (prévia local; não é publicada)"
          className="grid size-[104px] cursor-pointer place-items-center overflow-hidden rounded-full border border-dashed border-[var(--ab-borda-campo)] bg-[var(--ab-fundo)] text-[var(--ab-texto-3)] transition-colors hover:border-[var(--ab-roxo)] hover:text-[var(--ab-texto-2)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--ab-roxo)]"
        >
          {avatarUrl ? (
            // Prévia local de um arquivo escolhido agora: não há URL remota nem otimização a fazer.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="Imagem do agente" className="size-full object-cover" />
          ) : (
            <ImageIcon className="size-8" aria-hidden="true" />
          )}
          <span className="sr-only">Escolher a imagem do agente</span>
        </label>
        <label
          htmlFor={fileId}
          aria-hidden="true"
          className="absolute bottom-1 right-1 grid size-7 cursor-pointer place-items-center rounded-full bg-[var(--ab-roxo-forte)] text-white ring-2 ring-[var(--ab-painel)] transition-colors hover:bg-[var(--ab-roxo)]"
        >
          <Plus className="size-4" />
        </label>
      </div>

      <div className="grid gap-3">
        <BuilderInput
          id="agente-nome"
          label="Nome"
          value={name}
          onChange={(value) => onChange({ name: value })}
          placeholder="Ex.: Assistente de Vendas"
        />
        <BuilderInput
          id="agente-descricao"
          label="Descrição"
          value={description}
          onChange={(value) => onChange({ description: value })}
          placeholder="Uma breve descrição do seu agente"
        />
      </div>
    </div>
  );
}
