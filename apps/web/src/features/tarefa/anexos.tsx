"use client";

/**
 * Painel de anexos com download por URL assinada nova (02-UI-SPEC.md
 * "Anexos na Tarefa"): reaproveita a lista/o estilo de
 * `apps/web/src/features/estrutura/collaboration-editors.tsx::TaskAttachments`
 * (fora dos `files_modified` deste plano — este componente vive à parte, não
 * a substitui em geral), mas muda o comportamento de baixar: cada clique
 * pede uma URL nova ao `apps/api`, com estado de carregamento POR LINHA.
 *
 * D-04 — a referência opaca ao objeto no Storage privado nunca sai do
 * servidor: este arquivo só consome `{ url }` da resposta de
 * `GET /anexos/:fileId/url` (`apps/api/src/rotas/estado.ts`) — nunca o
 * caminho do objeto, o nome do repositório, o hash do conteúdo ou a
 * validade da URL — e mostra nome, tipo, tamanho e data, que já vêm do
 * Arquivo do Espaço de Trabalho hidratado no `DataState` local (T-02-14).
 */

import { Paperclip, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { attachFile, removeAttachment } from "@n1/dominio/operations";
import { useData, useRun } from "@/dados/store";
import { clienteDoNavegador } from "@/autenticacao/cliente-navegador";
import { useFormat } from "@/features/shell/use-format";
import { Button, ConfirmDialog, EmptyState, Icone } from "@/features/shell/ui";
import type { OperationResult } from "@n1/dominio/state";
import type { Attachment, Task } from "@n1/dominio/types";

type Report = (result: OperationResult<unknown>, message: string) => void;

const MEDIA_LABEL: Record<Attachment["mediaType"], string> = {
  image: "imagem",
  audio: "áudio",
  video: "vídeo",
  document: "documento",
  spreadsheet: "planilha",
  location: "localização",
  sticker: "figurinha",
  flow: "fluxo",
  other: "outro",
};

function mediaTypeDe(file: File): Attachment["mediaType"] {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("video/")) return "video";
  if (/spreadsheet|excel|csv/.test(file.type)) return "spreadsheet";
  if (/pdf|document|text\/|presentation/.test(file.type)) return "document";
  return "other";
}

function tamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const COPY_ERRO_DOWNLOAD = "Não foi possível abrir o arquivo. Tente novamente.";

/**
 * Pede a URL assinada ao `apps/api`, sempre uma nova. Nunca lê nem devolve
 * outra coisa do corpo da resposta além da própria URL — mesmo que o
 * servidor mande junto uma validade, este cliente não a nomeia.
 */
async function pedirUrlDeDownload(fileId: string): Promise<string | undefined> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return undefined;
  const token = (await clienteDoNavegador().auth.getSession()).data.session?.access_token;
  if (!token) return undefined;
  try {
    const resposta = await fetch(`${apiUrl}/anexos/${fileId}/url`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!resposta.ok) return undefined;
    const corpo = (await resposta.json()) as { readonly url?: string };
    return corpo.url;
  } catch {
    return undefined;
  }
}

export function PainelDeAnexos({
  task,
  report,
  readOnly,
}: {
  readonly task: Task;
  readonly report: Report;
  readonly readOnly: boolean;
}) {
  const run = useRun();
  const fmt = useFormat();
  const files = useData((data) => data.files);
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [baixando, setBaixando] = useState<string | null>(null);
  const [erroPorLinha, setErroPorLinha] = useState<Record<string, string>>({});
  const inputId = useId();
  const aRemover = task.attachments.find((a) => a.fileId === removendo);

  // Repete a obtenção automaticamente uma vez (URL expirada/instável); só
  // depois disso mostra a copy de erro — a linha nunca fica travada em
  // "Abrindo…" para sempre.
  const baixar = async (fileId: string): Promise<void> => {
    setBaixando(fileId);
    setErroPorLinha((atual) => {
      const proximo = { ...atual };
      delete proximo[fileId];
      return proximo;
    });
    let url = await pedirUrlDeDownload(fileId);
    if (!url) url = await pedirUrlDeDownload(fileId);
    setBaixando(null);
    if (!url) {
      setErroPorLinha((atual) => ({ ...atual, [fileId]: COPY_ERRO_DOWNLOAD }));
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="grid gap-3">
      <ConfirmDialog
        open={removendo !== null}
        title={`Remover o anexo “${aRemover?.displayName ?? ""}”?`}
        description="O anexo sai desta Tarefa. O Arquivo continua no Espaço de Trabalho, com quem mais o usa."
        confirmLabel="Remover"
        destructive
        onConfirm={() => {
          if (removendo) report(run((data, me) => removeAttachment(data, me, task.id, removendo)), "Anexo removido.");
          setRemovendo(null);
        }}
        onCancel={() => setRemovendo(null)}
      />
      {task.attachments.length === 0 ? (
        <EmptyState compact title="Nenhum anexo." />
      ) : (
        <ul className="pilha-solta">
          {[...task.attachments]
            .sort((a, b) => a.order - b.order)
            .map((attachment) => {
              const file = files.find((f) => f.id === attachment.fileId);
              const estaBaixando = baixando === attachment.fileId;
              const erroDaLinha = erroPorLinha[attachment.fileId];
              return (
                <li key={attachment.fileId} className="item-solto app-base flex-wrap" data-estatico="true">
                  <Icone de={Paperclip} tamanho="xs" style={{ color: "var(--texto-3)" }} />
                  <span className="min-w-0 flex-1 truncate" style={{ color: "var(--texto)" }}>
                    {attachment.displayName || file?.name || attachment.fileId}
                  </span>
                  <span className="app-meta">
                    {MEDIA_LABEL[attachment.mediaType]}
                    {file ? ` · ${tamanho(file.sizeBytes)} · ${fmt.relative(file.createdAt)}` : ""}
                  </span>
                  {erroDaLinha ? (
                    <span role="alert" className="app-sm" style={{ color: "var(--erro)" }}>
                      {erroDaLinha}
                    </span>
                  ) : null}
                  <Button
                    onClick={() => void baixar(attachment.fileId)}
                    disabled={estaBaixando}
                    disabledReason="Abrindo…"
                  >
                    {estaBaixando ? "Abrindo…" : "Baixar"}
                  </Button>
                  {readOnly ? null : (
                    <button
                      type="button"
                      onClick={() => setRemovendo(attachment.fileId)}
                      aria-label={`Remover anexo ${attachment.displayName ?? ""}`}
                      className="btn-icone btn-icone-nu"
                      style={{ color: "var(--erro)" }}
                    >
                      <Icone de={Trash2} tamanho="xs" />
                    </button>
                  )}
                </li>
              );
            })}
        </ul>
      )}
      {readOnly ? null : (
        <div>
          <input
            id={inputId}
            type="file"
            multiple
            tabIndex={-1}
            aria-hidden="true"
            className="sr-only"
            onChange={(event) => {
              const escolhidos = Array.from(event.target.files ?? []);
              event.target.value = "";
              if (escolhidos.length === 0) return;
              setEnviando(true);
              // Protótipo (mesmo comportamento de `TaskAttachments`): o conteúdo não sai
              // do navegador por esta rota; o Arquivo guarda nome, tipo e tamanho.
              for (const file of escolhidos) {
                report(
                  run((data, me) => attachFile(data, me, task.id, { name: file.name, mediaType: mediaTypeDe(file), sizeBytes: file.size })),
                  `Anexado: ${file.name}.`,
                );
              }
              setEnviando(false);
            }}
          />
          <Button onClick={() => document.getElementById(inputId)?.click()} icon={<Icone de={Paperclip} tamanho="xs" />} disabled={enviando} disabledReason="Enviando…">
            Anexar arquivo
          </Button>
          <span className="app-meta ml-2">Até 25 MB por arquivo.</span>
        </div>
      )}
    </div>
  );
}
