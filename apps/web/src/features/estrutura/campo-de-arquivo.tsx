"use client";

/**
 * O Campo de arquivo da Tarefa — Anexo, Boleto, QR Code (checklist 7.3).
 * Mostra os arquivos do Campo pelo nome, baixa por URL assinada nova, remove
 * (a lista sem ele, por `setTaskFieldValue`) e envia um arquivo novo de
 * verdade (`enviarArquivoDaTarefa` com `campoId`: ticket, bucket privado,
 * confirmação no servidor). O nome solto que o editor antigo gravava aparece
 * como tal: não há arquivo por trás dele, e ele não vai ao Omie.
 */

import { useState } from "react";
import type { FieldDefinition, FieldValue, Task } from "@n1/dominio/types";
import { useData, useRehidratar } from "@/dados/store";
import { enviarArquivoDaTarefa, pedirUrlDeDownload } from "@/dados/anexos-da-tarefa";
import { ACEITAR_NO_SELETOR, COPY_FORMATOS_ACEITOS } from "@/dados/envio-ao-bucket";

type ItemDoCampo = { readonly tipo: "arquivo"; readonly id: string; readonly nome: string } | { readonly tipo: "nome"; readonly nome: string };

/** O que o valor do Campo guarda: arquivos (por id) e, de antes, nomes soltos. */
export function itensDoCampoDeArquivo(
  valor: FieldValue["value"] | undefined,
  files: readonly { readonly id: string; readonly name: string }[],
): ItemDoCampo[] {
  const brutos = typeof valor === "string" ? [valor] : Array.isArray(valor) ? valor.filter((v): v is string => typeof v === "string") : [];
  return brutos
    .filter((v) => v.trim() !== "")
    .map((v): ItemDoCampo => {
      const arquivo = files.find((f) => f.id === v);
      return arquivo ? { tipo: "arquivo", id: arquivo.id, nome: arquivo.name } : { tipo: "nome", nome: v };
    });
}

interface EnvioDoCampo {
  readonly nome: string;
  readonly progresso: number;
  readonly erro?: string;
}

export function CampoDeArquivo({
  id,
  task,
  definition,
  atual,
  gravar,
  aoEnviar,
}: {
  readonly id: string;
  readonly task: Task;
  readonly definition: FieldDefinition;
  readonly atual: FieldValue["value"] | undefined;
  readonly gravar: (value: FieldValue["value"]) => boolean;
  readonly aoEnviar?: (nome: string) => void;
}) {
  const files = useData((data) => data.files);
  const rehidratar = useRehidratar();
  const [envio, setEnvio] = useState<EnvioDoCampo | null>(null);
  const [erroDeDownload, setErroDeDownload] = useState<string | null>(null);
  const itens = itensDoCampoDeArquivo(atual, files);
  const idsDeArquivo = itens.flatMap((item) => (item.tipo === "arquivo" ? [item.id] : []));
  const enviandoAgora = envio !== null && !envio.erro;

  const enviar = async (file: File): Promise<void> => {
    setEnvio({ nome: file.name, progresso: 0 });
    const resultado = await enviarArquivoDaTarefa(task.id, file, {
      campoId: definition.id,
      aoProgredir: (progresso) => setEnvio((atualDoEnvio) => (atualDoEnvio ? { ...atualDoEnvio, progresso } : atualDoEnvio)),
    });
    if (!resultado.ok) {
      setEnvio({ nome: file.name, progresso: 0, erro: resultado.erro });
      return;
    }
    setEnvio(null);
    await rehidratar();
    aoEnviar?.(file.name);
  };

  // Repete uma vez (URL expirada ou rede instável) antes de mostrar o erro.
  const baixar = async (fileId: string): Promise<void> => {
    setErroDeDownload(null);
    const url = (await pedirUrlDeDownload(fileId)) ?? (await pedirUrlDeDownload(fileId));
    if (!url) {
      setErroDeDownload("Não foi possível abrir o arquivo. Tente novamente.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // Remover é gravar a lista sem ele; o nome solto de antes simplesmente sai.
  const remover = (item: ItemDoCampo): void => {
    const restantes = item.tipo === "arquivo" ? idsDeArquivo.filter((fileId) => fileId !== item.id) : idsDeArquivo;
    gravar(restantes.length > 0 ? restantes : null);
  };

  return (
    <span className="grid gap-1">
      {itens.length === 0 ? (
        <span className="app-meta">nenhum arquivo</span>
      ) : (
        <ul className="grid gap-1">
          {itens.map((item, indice) => (
            <li key={item.tipo === "arquivo" ? item.id : `nome-${indice}`} className="app-meta flex flex-wrap items-center gap-2">
              <span style={{ color: "var(--texto)" }}>{item.nome}</span>
              {item.tipo === "arquivo" ? (
                <button type="button" className="underline" onClick={() => void baixar(item.id)}>
                  baixar
                </button>
              ) : (
                <span>(só o nome: o arquivo não foi enviado)</span>
              )}
              <button type="button" className="underline" onClick={() => remover(item)}>
                remover
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        id={id}
        type="file"
        accept={ACEITAR_NO_SELETOR}
        aria-required={definition.required}
        disabled={enviandoAgora}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void enviar(file);
        }}
        className="app-sm w-full min-w-0 file:mr-2 file:rounded-[var(--r-controle)] file:border file:border-[var(--linha-forte)] file:bg-[var(--superficie-2)] file:px-2 file:py-1 file:text-[var(--texto)]"
        style={{ color: "var(--texto)" }}
      />
      {envio?.erro ? (
        <span role="alert" className="app-sm" style={{ color: "var(--erro)" }}>
          {envio.nome}: {envio.erro}
        </span>
      ) : envio ? (
        <span className="app-meta" aria-live="polite">
          Enviando {envio.nome}… {envio.progresso}%
        </span>
      ) : (
        <span className="app-meta">{COPY_FORMATOS_ACEITOS}</span>
      )}
      {erroDeDownload ? (
        <span role="alert" className="app-sm" style={{ color: "var(--erro)" }}>
          {erroDeDownload}
        </span>
      ) : null}
    </span>
  );
}
