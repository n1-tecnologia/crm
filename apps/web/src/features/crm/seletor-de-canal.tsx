"use client";

/**
 * "Responder por" (Fase 8, D-15): o seletor do Canal pelo qual a próxima
 * Mensagem sai. As opções são só os Canais `conectada` que alcançam o Contato
 * (`canaisDeResposta`, no domínio); escolher um NÃO muda o Canal de nenhuma
 * Conversa — quem usa o seletor chama `startConversation`, que reutiliza ou abre
 * a Conversa do par (Canal, Contato) (INV-CXE-04).
 */

import { rotuloDoCanal, canaisDeResposta } from "@n1/dominio/derive-conversacional";
import type { Contact, Id } from "@n1/dominio/types";
import { useData } from "@/dados/store";
import { Field, Select } from "@/features/shell/ui";

export const SEM_CANAL_DE_RESPOSTA = "Nenhum Canal conectado alcança este Contato.";

export function SeletorDeCanalDeResposta({
  contact,
  canalId,
  onTrocar,
}: {
  readonly contact: Contact;
  readonly canalId: Id | null;
  readonly onTrocar: (channelId: Id) => void;
}) {
  const state = useData((data) => data);
  const opcoes = canaisDeResposta(state, contact).map((canal) => ({
    value: canal.id,
    label: rotuloDoCanal(canal),
  }));
  const semOpcao = opcoes.length === 0;
  const valor = canalId !== null && opcoes.some((opcao) => opcao.value === canalId) ? canalId : "";

  return (
    <Field label="Responder por">
      {(id) => (
        <Select
          id={id}
          size="sm"
          value={valor}
          placeholder="Escolha o Canal"
          options={opcoes}
          disabled={semOpcao}
          {...(semOpcao ? { disabledReason: SEM_CANAL_DE_RESPOSTA } : {})}
          onChange={(escolhido) => {
            if (opcoes.some((opcao) => opcao.value === escolhido)) onTrocar(escolhido);
          }}
        />
      )}
    </Field>
  );
}
