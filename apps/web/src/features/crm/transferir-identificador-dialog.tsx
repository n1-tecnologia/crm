"use client";

/**
 * "Transferir" na linha de um Identificador da ficha nova de Contato (3.2.3):
 * passa o Identificador para outro Contato. Chama
 * `POST /contatos/:id/identificadores/:identificadorId/transferir` por
 * `transferirIdentificador` (`dados/crm/contatos.ts`); quem tem a regra é a api,
 * que recusa por 409 (`TRANSFERENCIA_RECUSADA`: destino mesclado ou na lixeira,
 * destino com o teto de Identificadores, origem que ficaria sem nome nem
 * Identificador) e a frase dela aparece no próprio diálogo, que continua aberto.
 *
 * Herda da ficha antiga (apagada na 15-13) o aviso central, dito antes do ato: só a
 * resolução FUTURA muda; Conversas e Mensagens já trocadas
 * continuam com o Contato de origem.
 *
 * Todo texto vindo da api é renderizado como texto React (escapado).
 */

import { useState } from "react";
import type { IdentificadorDeContato } from "@n1/dominio/crm/contatos";
import type { ErroDeApi } from "@/dados/crm/cliente-crm";
import { transferirIdentificador } from "@/dados/crm/contatos";
import { comoErroDeApi } from "@/features/crm/formulario-de-contato";
import { SeletorDeRegistro, type RegistroEscolhido } from "@/features/crm/seletor-de-registro";
import { ConfirmDialog, Field } from "@/features/shell/ui";

export function TransferirIdentificadorDialog({
  contatoId,
  nome,
  identificador,
  onFechar,
  onTransferido,
}: {
  /** A origem: o Contato da ficha. */
  readonly contatoId: string;
  readonly nome: string;
  readonly identificador: IdentificadorDeContato;
  readonly onFechar: () => void;
  /** Chamado depois do 200, com o aviso de sucesso para a ficha mostrar. */
  readonly onTransferido: (aviso: string) => void;
}) {
  const [destino, setDestino] = useState<RegistroEscolhido | null>(null);
  const [erro, setErro] = useState<ErroDeApi | null>(null);
  const [transferindo, setTransferindo] = useState(false);

  const valor = identificador.valorExibido ?? identificador.valor;
  const porQueNao = destino === null ? "Escolha o Contato de destino." : transferindo ? "Transferindo…" : undefined;

  const confirmar = async () => {
    if (destino === null) return;
    setErro(null);
    setTransferindo(true);
    try {
      await transferirIdentificador(contatoId, identificador.id, destino.id);
      onTransferido(`Identificador ${valor} transferido para ${destino.nome}.`);
      onFechar();
    } catch (falha) {
      setErro(comoErroDeApi(falha, "Não foi possível transferir o Identificador. Tente de novo."));
      setTransferindo(false);
    }
  };

  return (
    <ConfirmDialog
      open
      title={`Transferir ${valor}`}
      description={`O Identificador sai de ${nome} e passa a resolver para o Contato de destino.`}
      confirmLabel="Transferir"
      {...(porQueNao ? { confirmDisabledReason: porQueNao } : {})}
      confirmCarregando={transferindo}
      onConfirm={() => void confirmar()}
      onCancel={onFechar}
    >
      <div className="grid gap-3">
        <Field label="Contato de destino" hint="Só Contatos ativos aparecem na busca. Um Contato mesclado não recebe Identificadores.">
          {(id) => (
            <SeletorDeRegistro id={id} recurso="contatos" rotulo="Buscar Contato de destino" valor={destino} onChange={setDestino} excluirIds={[contatoId]} />
          )}
        </Field>

        <p className="app-base rounded-[var(--r-controle)] px-3 py-2" style={{ background: "var(--aviso-lavado)", color: "var(--aviso)" }}>
          Só a resolução <strong>futura</strong> muda. As Conversas e as Mensagens já trocadas permanecem com {nome}.
        </p>

        {erro ? (
          <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
            {erro.message}
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
