"use client";

/**
 * NOVA VERSÃO (20, 12.3): o Conteúdo de uma Versão é imutável — editar é
 * criar a Versão N+1, que se torna corrente no mesmo ato (RN-CNH-12). Vem
 * de texto próprio ou de Arquivo; a captura de URL é da Fonte, não da
 * edição. A anterior recebe "Superada em" e guarda os Fragmentos para as
 * Referências históricas (RN-CNH-13).
 */

import { useState } from "react";
import { useData, useRun, useSession } from "@/data/store";
import { novaVersaoDoDocumento, recusaNoDocumento, type EntradaDeVersao } from "@/data/operations";
import type { Attachment } from "@/data/types";
import { Abas, ConfirmDialog, Field, TextArea } from "@/features/shell/ui";
import { MEDIA_TYPE_LABEL, mediaTypeDoArquivo, tamanhoDoArquivo } from "./rotulos";

type Entrada = "texto" | "arquivo";

interface ArquivoEscolhido {
  readonly fileName: string;
  readonly sizeBytes: number;
  readonly mediaType: Attachment["mediaType"];
}

const ENTRADAS: ReadonlyArray<{ readonly chave: Entrada; readonly rotulo: string }> = [
  { chave: "texto", rotulo: "Colar texto" },
  { chave: "arquivo", rotulo: "Arquivo" },
];

export function NovaVersaoDialog({
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
  const [entrada, setEntrada] = useState<Entrada>("texto");
  const [texto, setTexto] = useState("");
  const [arquivo, setArquivo] = useState<ArquivoEscolhido | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const documento = state.documents.find((d) => d.id === documentId);
  const colecao = documento ? state.collections.find((c) => c.id === documento.collectionId) : undefined;
  const corrente = documento?.versions.find((v) => v.number === documento.currentVersion);

  const conteudo = (): EntradaDeVersao | undefined => {
    if (entrada === "texto") return texto.trim() ? { kind: "texto", text: texto } : undefined;
    return arquivo ? { kind: "arquivo", ...arquivo } : undefined;
  };

  const motivo = !documento
    ? "Documento não encontrado."
    : (recusaNoDocumento(state, memberId, documento, "editar") ??
      (documento.lifecycle !== "ativo" || colecao?.lifecycle !== "ativo"
        ? "Um Documento arquivado não recebe Versão nova."
        : conteudo() === undefined
          ? entrada === "texto"
            ? "Cole ou escreva o texto do Documento."
            : "Escolha o arquivo."
          : undefined));

  const reset = () => {
    setEntrada("texto");
    setTexto("");
    setArquivo(null);
    setErro(null);
  };

  const confirmar = () => {
    const c = conteudo();
    if (!c) return;
    const result = run((data, me) => novaVersaoDoDocumento(data, me, documentId, c));
    if (!result.ok) {
      setErro(result.error);
      return;
    }
    reset();
    onDone(`Versão ${result.value.number} criada e tornada corrente, com ${result.value.fragments.length} Fragmento(s).`, documentId);
  };

  return (
    <ConfirmDialog
      open={open}
      wide
      title={corrente ? `Nova Versão (v${corrente.number + 1})` : "Nova Versão"}
      description="O Conteúdo de uma Versão é imutável: editar é criar a próxima, que se torna corrente no mesmo ato (RN-CNH-12). A anterior fica guardada para as Referências que a citam."
      confirmLabel="Criar Versão"
      {...(motivo ? { confirmDisabledReason: motivo } : {})}
      onConfirm={confirmar}
      onCancel={() => {
        reset();
        onClose();
      }}
    >
      <div className="grid gap-4">
        <div className="painel">
          <Abas rotulo="Origem do conteúdo" abas={ENTRADAS} ativa={entrada} aoTrocar={(chave) => setEntrada(chave as Entrada)} />
          <div key={entrada} className="aparecer p-4">
            {entrada === "texto" ? (
              <Field label="Texto" required hint="Cada parágrafo vira um Fragmento.">
                {(id) => <TextArea id={id} value={texto} onChange={setTexto} rows={10} placeholder={corrente?.content.text ?? "Cole ou escreva o conteúdo da nova Versão"} />}
              </Field>
            ) : (
              <Field label="Arquivo" required hint="Só nome, tamanho e tipo saem do navegador; até 25 MB (RN-CNH-28). Áudio e vídeo ficam pendentes de transcrição.">
                {(id) => (
                  <span className="grid gap-1">
                    <input
                      id={id}
                      type="file"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        setArquivo(file ? { fileName: file.name, sizeBytes: file.size, mediaType: mediaTypeDoArquivo(file) } : null);
                        event.target.value = "";
                      }}
                      className="app-sm w-full min-w-0 file:mr-2 file:rounded-[var(--r-controle)] file:border file:border-[var(--linha-forte)] file:bg-[var(--superficie-2)] file:px-2 file:py-1 file:text-[var(--texto)]"
                      style={{ color: "var(--texto)" }}
                    />
                    <span className="app-meta">
                      {arquivo ? `${arquivo.fileName} · ${tamanhoDoArquivo(arquivo.sizeBytes)} · ${MEDIA_TYPE_LABEL[arquivo.mediaType]}` : "nenhum arquivo"}
                    </span>
                  </span>
                )}
              </Field>
            )}
          </div>
        </div>
        {erro ? (
          <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
            {erro}
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
