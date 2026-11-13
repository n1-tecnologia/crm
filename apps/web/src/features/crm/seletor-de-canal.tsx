"use client";

/**
 * "Responder por" (Fase 8, D-15): o seletor do Canal pelo qual a próxima
 * Mensagem sai. As opções são só os Canais `conectada` que alcançam o Contato
 * (`canaisDeRespostaNasTabelas`, no domínio, sobre os Canais de `GET /canais` e
 * os Identificadores de `GET /contatos/:id`); escolher um NÃO muda o Canal de
 * nenhuma Conversa — quem usa o seletor só troca a aba do fio (INV-CXE-04).
 * Na ficha da Tarefa (5.2.1) `apenas` limita as opções aos Canais da Lista e o fio
 * decide o que escolher outro Canal significa.
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
  apenas,
}: {
  /** Os Canais do Espaço (`useCanais`); a regra filtra os ativos e conectados. */
  readonly canais: readonly Canal[];
  /** Os Identificadores do Contato (`useContato`): é por eles que um Canal o alcança. */
  readonly identificadores: readonly Pick<IdentificadorDeContato, "tipo">[];
  readonly canalId: string | null;
  readonly onTrocar: (canalId: string) => void;
  /** 5.2.1: restringe as opções a estes ids (os Canais da Lista da Tarefa); a regra de alcance e de conexão continua valendo. */
  readonly apenas?: readonly string[];
}) {
  const opcoes = canaisDeRespostaNasTabelas(canais, identificadores)
    .filter((canal) => apenas === undefined || apenas.includes(canal.id))
    .map((canal) => ({
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
