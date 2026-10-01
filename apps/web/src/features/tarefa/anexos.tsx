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
 *
 * Checklist 7.3 — "Anexar arquivo" sobe o arquivo de verdade (ticket →
 * bucket privado → confirmação no servidor, `@/dados/anexos-da-tarefa`): é o
 * que leva o anexo ao `/lancar` do Omie.
 */

import { Paperclip, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { removeAttachment } from "@n1/dominio/operations";
import { useData, useRehidratar, useRun } from "@/dados/store";
import { enviarArquivoDaTarefa, pedirUrlDeDownload } from "@/dados/anexos-da-tarefa";
import { ACEITAR_NO_SELETOR, COPY_FORMATOS_ACEITOS } from "@/dados/envio-ao-bucket";
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

function tamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface EnvioEmCurso {
  readonly chave: string;
  readonly nome: string;
  readonly progresso: number;
  readonly erro?: string;
}

const COPY_ERRO_DOWNLOAD = "Não foi possível abrir o arquivo. Tente novamente.";

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
  const rehidratar = useRehidratar();
  const [envios, setEnvios] = useState<readonly EnvioEmCurso[]>([]);
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

  const emCurso = envios.some((e) => !e.erro);

  // Um arquivo por vez: cada um pede ticket, sobe ao bucket e é confirmado
  // pelo servidor; só então vira anexo — e a tela re-hidrata para mostrá-lo.
  const enviarTodos = async (arquivos: readonly File[]): Promise<void> => {
    for (const [indice, file] of arquivos.entries()) {
      const chave = `${Date.now()}-${indice}-${file.name}`;
      setEnvios((atual) => [...atual, { chave, nome: file.name, progresso: 0 }]);
      const resultado = await enviarArquivoDaTarefa(task.id, file, {
        aoProgredir: (progresso) => setEnvios((atual) => atual.map((e) => (e.chave === chave ? { ...e, progresso } : e))),
      });
      if (resultado.ok) {
        setEnvios((atual) => atual.filter((e) => e.chave !== chave));
        await rehidratar();
        report({ ok: true, value: resultado.fileId }, `Anexado: ${file.name}.`);
      } else {
        setEnvios((atual) => atual.map((e) => (e.chave === chave ? { ...e, erro: resultado.erro } : e)));
      }
    }
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
            accept={ACEITAR_NO_SELETOR}
            onChange={(event) => {
              const escolhidos = Array.from(event.target.files ?? []);
              event.target.value = "";
              if (escolhidos.length > 0) void enviarTodos(escolhidos);
            }}
          />
          <Button onClick={() => document.getElementById(inputId)?.click()} icon={<Icone de={Paperclip} tamanho="xs" />} disabled={emCurso} disabledReason="Enviando…">
            Anexar arquivo
          </Button>
          <span className="app-meta ml-2">{COPY_FORMATOS_ACEITOS}</span>
          {envios.length > 0 ? (
            <ul className="pilha-solta mt-2" aria-live="polite">
              {envios.map((envio) => (
                <li key={envio.chave} className="item-solto app-base flex-wrap" data-estatico="true">
                  <Icone de={Paperclip} tamanho="xs" style={{ color: "var(--texto-3)" }} />
                  <span className="min-w-0 flex-1 truncate" style={{ color: "var(--texto)" }}>
                    {envio.nome}
                  </span>
                  {envio.erro ? (
                    <>
                      <span role="alert" className="app-sm" style={{ color: "var(--erro)" }}>
                        {envio.erro}
                      </span>
                      <button type="button" className="app-sm underline" onClick={() => setEnvios((atual) => atual.filter((e) => e.chave !== envio.chave))}>
                        Dispensar
                      </button>
                    </>
                  ) : (
                    <span className="app-meta">Enviando… {envio.progresso}%</span>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </div>
  );
}
