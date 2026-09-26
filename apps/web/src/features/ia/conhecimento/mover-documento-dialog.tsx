"use client";

/**
 * MOVER DOCUMENTO (20, RN-CNH-08): atômica, só para Documentos da Fonte
 * Envio manual — os sincronizados seriam recriados pela Atualização seguinte.
 * Exige `excluir` na origem e `criar` no destino; identidade, Versões,
 * Comentários e Proveniência acompanham; a permissão passa a ser a do destino.
 */

import { useState } from "react";
import { useData, useRun, useSession } from "@/dados/store";
import { moverDocumento, recusaNaColecao, recusaNoDocumento } from "@n1/dominio/operations";
import { ConfirmDialog, Field, Select } from "@/features/shell/ui";

export function MoverDocumentoDialog({
  documentId,
  open,
  onClose,
  onDone,
}: {
  readonly documentId: string;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onDone: (message: string, documentId: string) => void;
}) {
  const state = useData((data) => data);
  const run = useRun();
  const { memberId } = useSession();
  const [destinoId, setDestinoId] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const documento = state.documents.find((d) => d.id === documentId);
  const origem = documento ? state.collections.find((c) => c.id === documento.collectionId) : undefined;
  const fonte = origem?.sources.find((s) => s.id === documento?.sourceId);
  const destino = state.collections.find((c) => c.id === destinoId);
  const destinos = state.collections.filter((c) => c.lifecycle !== "naLixeira" && c.id !== origem?.id);

  // A recusa de cada destino é a do próprio destino: `criar` lá (RN-CNH-08).
  const recusaDoDestino = (c: (typeof destinos)[number]): string | undefined =>
    c.lifecycle !== "ativo" ? "Restaure a Coleção de destino antes." : recusaNaColecao(state, memberId, c, "criar");

  const motivo = !documento
    ? "Documento não encontrado."
    : !origem
      ? "A Coleção deste Documento não existe mais."
      : (recusaNoDocumento(state, memberId, documento, "excluir") ??
        (documento.lifecycle === "naLixeira"
          ? "Restaure o Documento da lixeira antes de mover."
          : fonte?.kind !== "envioManual"
            ? "Só Documentos de envio manual são movidos; os sincronizados seriam recriados pela Fonte (RN-CNH-08)."
            : !destino
              ? "Escolha a Coleção de destino."
              : recusaDoDestino(destino)));

  const reset = () => {
    setDestinoId("");
    setErro(null);
  };

  const confirmar = () => {
    const result = run((data, me) => moverDocumento(data, me, documentId, destinoId));
    if (!result.ok) {
      setErro(result.error);
      return;
    }
    reset();
    onDone(`Documento movido para “${destino?.name ?? destinoId}”.`, result.value.id);
  };

  return (
    <ConfirmDialog
      open={open}
      title="Mover para outra Coleção"
      description="Atômica e só para Documentos de envio manual (RN-CNH-08): identidade, Versões, Comentários e Proveniência acompanham, e a permissão passa a ser a da Coleção de destino no mesmo ato."
      confirmLabel="Mover"
      {...(motivo ? { confirmDisabledReason: motivo } : {})}
      onConfirm={confirmar}
      onCancel={() => {
        reset();
        onClose();
      }}
    >
      <div className="grid gap-4">
        <Field label="Coleção de destino" required {...(origem ? { hint: `Sai de “${origem.name}”.` } : {})}>
          {(id) => (
            <Select
              id={id}
              value={destinoId}
              onChange={setDestinoId}
              searchable
              placeholder="Escolher a Coleção"
              options={destinos.map((c) => {
                const recusa = recusaDoDestino(c);
                return {
                  value: c.id,
                  label: c.name,
                  detail: c.isPrivate ? "privada" : `${state.documents.filter((d) => d.collectionId === c.id && d.lifecycle !== "naLixeira").length} Documento(s)`,
                  ...(recusa ? { disabledReason: recusa } : {}),
                };
              })}
            />
          )}
        </Field>
        {erro ? (
          <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
            {erro}
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
