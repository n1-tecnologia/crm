"use client";

/**
 * ADICIONAR DOCUMENTO (20, 12.2 caminho 1): o envio manual. A Coleção vem
 * fixa quando o diálogo abre da ficha dela; solta, quando abre do catálogo.
 * Três entradas — texto colado, endereço web, arquivo — e uma só saída: o
 * Documento `ativo` com a Versão 1, a Proveniência (RN-CNH-09) e os
 * Fragmentos simulados (D9). Do arquivo só saem nome, tamanho e tipo.
 */

import { useState } from "react";
import { useData, useRun, useSession } from "@/dados/store";
import { adicionarDocumento, recusaNaColecao, type EntradaDeConteudo } from "@n1/dominio/operations";
import type { Attachment } from "@n1/dominio/types";
import { Abas, ConfirmDialog, Field, Select, TextArea, TextInput } from "@/features/shell/ui";
import { MEDIA_TYPE_LABEL, mediaTypeDoArquivo, tamanhoDoArquivo } from "./rotulos";

type Entrada = "texto" | "url" | "arquivo";

interface ArquivoEscolhido {
  readonly fileName: string;
  readonly sizeBytes: number;
  readonly mediaType: Attachment["mediaType"];
}

const ENTRADAS: ReadonlyArray<{ readonly chave: Entrada; readonly rotulo: string }> = [
  { chave: "texto", rotulo: "Colar texto" },
  { chave: "url", rotulo: "Endereço web" },
  { chave: "arquivo", rotulo: "Arquivo" },
];

export function AdicionarDocumentoDialog({
  colecaoId: colecaoFixa,
  open,
  onClose,
  onDone,
}: {
  readonly colecaoId?: string;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onDone: (message: string, documentId: string) => void;
}) {
  const state = useData((data) => data);
  const run = useRun();
  const { memberId } = useSession();
  const [colecaoId, setColecaoId] = useState(colecaoFixa ?? "");
  const [titulo, setTitulo] = useState("");
  const [rotulos, setRotulos] = useState("");
  const [entrada, setEntrada] = useState<Entrada>("texto");
  const [texto, setTexto] = useState("");
  const [url, setUrl] = useState("");
  const [arquivo, setArquivo] = useState<ArquivoEscolhido | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const colecoes = state.collections.filter((c) => c.lifecycle !== "naLixeira");
  const colecao = state.collections.find((c) => c.id === colecaoId);

  // A recusa por Coleção vale por opção (cada uma diz por que não) e pelo botão.
  const recusaDaColecao = (c: (typeof colecoes)[number]): string | undefined =>
    recusaNaColecao(state, memberId, c, "criar") ?? (c.lifecycle !== "ativo" ? "Restaure a Coleção antes." : undefined);

  const conteudo = (): EntradaDeConteudo | undefined => {
    if (entrada === "texto") return texto.trim() ? { kind: "texto", text: texto } : undefined;
    if (entrada === "url") return url.trim() ? { kind: "url", url } : undefined;
    return arquivo ? { kind: "arquivo", ...arquivo } : undefined;
  };

  const motivo = !colecao
    ? "Escolha a Coleção."
    : (recusaDaColecao(colecao) ??
      (!titulo.trim()
        ? "Dê um título ao Documento."
        : conteudo() === undefined
          ? entrada === "texto"
            ? "Cole ou escreva o texto do Documento."
            : entrada === "url"
              ? "Informe o endereço da página."
              : "Escolha o arquivo."
          : undefined));

  const reset = () => {
    setColecaoId(colecaoFixa ?? "");
    setTitulo("");
    setRotulos("");
    setEntrada("texto");
    setTexto("");
    setUrl("");
    setArquivo(null);
    setErro(null);
  };

  const confirmar = () => {
    const c = conteudo();
    if (!c) return;
    const labels = rotulos.split(",").map((r) => r.trim()).filter((r) => r.length > 0);
    const result = run((data, me) => adicionarDocumento(data, me, colecaoId, { title: titulo, labels, ...c }));
    if (!result.ok) {
      setErro(result.error);
      return;
    }
    const fragmentos = result.value.versions[0]?.fragments.length ?? 0;
    reset();
    onDone(`Documento “${result.value.title}” adicionado com ${fragmentos} Fragmento(s).`, result.value.id);
  };

  return (
    <ConfirmDialog
      open={open}
      wide
      title="Adicionar Documento"
      description="Entra pela Fonte Envio manual da Coleção, com Proveniência preenchida no ato (RN-CNH-09) e a Versão 1 criada no mesmo ato (RN-CNH-10)."
      confirmLabel="Adicionar"
      {...(motivo ? { confirmDisabledReason: motivo } : {})}
      onConfirm={confirmar}
      onCancel={() => {
        reset();
        onClose();
      }}
    >
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Coleção" required>
            {(id) => (
              <Select
                id={id}
                value={colecaoId}
                onChange={setColecaoId}
                searchable
                placeholder="Escolher a Coleção"
                disabled={colecaoFixa !== undefined}
                disabledReason="A Coleção é a desta ficha."
                options={colecoes.map((c) => {
                  const recusa = recusaDaColecao(c);
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
          <Field label="Título" required>
            {(id) => <TextInput id={id} value={titulo} onChange={setTitulo} placeholder="Por exemplo: Tabela de preços 2026" />}
          </Field>
        </div>
        <Field label="Rótulos" hint="Separados por vírgula. Rótulos são Metadado: mudam sem criar Versão (RN-CNH-12).">
          {(id) => <TextInput id={id} value={rotulos} onChange={setRotulos} placeholder="comercial, preços" />}
        </Field>

        <div className="painel">
          <Abas rotulo="Origem do conteúdo" abas={ENTRADAS} ativa={entrada} aoTrocar={(chave) => setEntrada(chave as Entrada)} />
          <div key={entrada} className="aparecer p-4">
            {entrada === "texto" ? (
              <Field label="Texto" required hint="Cada parágrafo vira um Fragmento.">
                {(id) => <TextArea id={id} value={texto} onChange={setTexto} rows={10} placeholder="Cole ou escreva o conteúdo do Documento" />}
              </Field>
            ) : entrada === "url" ? (
              <Field label="Endereço" required hint="A captura é simulada neste protótipo: rende um Fragmento com a página inteira.">
                {(id) => <TextInput id={id} value={url} onChange={setUrl} placeholder="https://…" />}
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
