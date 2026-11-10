/**
 * O separador "via …" (Fase 8, D-13): a marca discreta de que a sequência de
 * Mensagens trocou de Canal. É a única marca de Canal na sequência — as bolhas
 * não levam selo. Cor só por tokens; componente de apresentação puro.
 */

import type { Canal } from "@n1/dominio/crm/canais";
import { textoDoSeparadorNasTabelas } from "@n1/dominio/crm/canais-de-resposta";
import { CHANNEL_ICON } from "@/features/crm/conversation-thread";

export function SeparadorDeCanal({ canal }: { readonly canal: Pick<Canal, "nome" | "tipo" | "provedor"> }) {
  const IconeDoCanal = CHANNEL_ICON[canal.tipo];
  return (
    <div role="separator" className="app-meta flex items-center gap-2" style={{ color: "var(--texto-3)" }}>
      <span aria-hidden="true" className="h-px flex-1" style={{ background: "var(--linha)" }} />
      <span className="flex items-center gap-1.5">
        <IconeDoCanal className="size-[var(--icone-xs)] shrink-0" aria-hidden="true" />
        {textoDoSeparadorNasTabelas(canal)}
      </span>
      <span aria-hidden="true" className="h-px flex-1" style={{ background: "var(--linha)" }} />
    </div>
  );
}
