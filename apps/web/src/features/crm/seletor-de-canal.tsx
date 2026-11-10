"use client";

/**
 * "Responder por" (Fase 8, D-15): o seletor do Canal pelo qual a próxima
 * Mensagem sai. As opções são só os Canais `conectada` que alcançam o Contato
 * (`canaisDeRespostaNasTabelas`, no domínio, sobre os Canais de `GET /canais` e
 * os Identificadores de `GET /contatos/:id`); escolher um NÃO muda o Canal de
 * nenhuma Conversa — quem usa o seletor só troca a aba do fio (INV-CXE-04).
 */

import type { Canal } from "@n1/dominio/crm/canais";
import { canaisDeRespostaNasTabelas, rotuloDoCanalNasTabelas } from "@n1/dominio/crm/canais-de-resposta";
import type { IdentificadorDeContato } from "@n1/dominio/crm/contatos";
import { Field, Select } from "@/features/shell/ui";

export const SEM_CANAL_DE_RESPOSTA = "Nenhum Canal conectado alcança este Contato.";

export function SeletorDeCanalDeResposta({
  canais,
  identificadores,
  canalId,
  onTrocar,
}: {
  /** Os Canais do Espaço (`useCanais`); a regra filtra os ativos e conectados. */
  readonly canais: readonly Canal[];
  /** Os Identificadores do Contato (`useContato`): é por eles que um Canal o alcança. */
  readonly identificadores: readonly Pick<IdentificadorDeContato, "tipo">[];
  readonly canalId: string | null;
  readonly onTrocar: (canalId: string) => void;
}) {
  const opcoes = canaisDeRespostaNasTabelas(canais, identificadores).map((canal) => ({
    value: canal.id,
    label: rotuloDoCanalNasTabelas(canal),
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
