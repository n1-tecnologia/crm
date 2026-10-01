"use client";

/**
 * O controle composto de upload do Formulário público (Plan 02-23,
 * `02-UI-SPEC.md` § "Upload e anexos") — um por pergunta de arquivo (`Anexo`,
 * `Boleto`, `QR Code`). Envio em duas fases (D-04, `02-RESEARCH.md` §"Storage
 * e envio em duas fases"):
 *
 *   1. `transportePublico.pedirTicket` — pede um ticket assinado de escopo
 *      mínimo (Plan 02-11/02-16, `apps/api/src/servicos/storage-uploads.ts`).
 *   2. O NAVEGADOR sobe os bytes DIRETO ao bucket privado pelo `uploadUrl`
 *      assinado — nenhuma service role, nenhuma chave de Storage passa por
 *      aqui, só o que o ticket devolveu (T-02-14).
 *
 * `fetch` sem a opção `duplex` não expõe progresso de upload (o corpo é lido
 * de uma vez); `XMLHttpRequest.upload.onprogress` expõe. Por isso o envio de
 * bytes usa `XMLHttpRequest`, não `fetch` — a escolha que o plano pede para
 * registrar em comentário.
 *
 * `submissionId` é uma sessão do SERVIDOR (`abrirSessaoDeUpload`), não algo
 * que o cliente inventa: a primeira chamada de `pedirTicket` desta submissão
 * inteira omite `submissionId` e recebe um de volta; toda chamada seguinte —
 * de QUALQUER pergunta de arquivo do mesmo Formulário — reusa esse mesmo
 * valor. Como até duas perguntas de arquivo podem estar visíveis ao mesmo
 * tempo (`Anexo` + `Boleto` ou `Anexo` + `QR Code`), a coordenação de QUEM
 * tem a sessão e QUANDO ela nasce mora em `formulario.tsx`
 * (`executarPedidoDeTicket`, uma fila que serializa os pedidos de ticket e
 * atualiza a sessão compartilhada) — este módulo só CHAMA
 * `transportePublico.pedirTicket` dentro dela.
 */

import { useId, useRef } from "react";
import { CheckCircle2, Paperclip, Upload } from "lucide-react";
import { transportePublico } from "@/dados/transporte-publico";
import { enviarBytesAoBucket } from "@/dados/envio-ao-bucket";
import type { ResultadoDeTicket } from "@/dados/transporte-publico";
import { Button, Icone } from "@/features/shell/ui";

export type StatusDeArquivo = "aguardando" | "enviando" | "enviado" | "falhou";

export interface ArquivoDeUpload {
  readonly clientId: string;
  readonly file: File;
  readonly displayName: string;
  readonly sizeBytes: number;
  readonly mediaType: string;
  readonly status: StatusDeArquivo;
  /** 0–100, só tem sentido enquanto `status === "enviando"`. */
  readonly progresso: number;
  /** Presente assim que o ticket é emitido — é o que `enviarSubmissao` referencia como anexo. */
  readonly objectId?: string;
  readonly erro?: string;
}

/** Cortesia do cliente — a autoridade é `apps/api/src/servicos/storage-uploads.ts` (Plan 02-11). */
const ACEITOS_PADRAO = ["application/pdf", "application/xml", "text/xml", "image/jpeg", "image/png", "image/webp"] as const;
const MAX_BYTES_POR_ARQUIVO = 25 * 1024 * 1024;
export const MAX_ARQUIVOS_POR_ENVIO = 10;

const COPY_ADICIONAR = "Adicionar arquivos";
const COPY_AJUDA_FORMATO = "PDF, XML, JPG, PNG ou WebP. Até 25 MB por arquivo e 10 arquivos por envio.";
const COPY_AGUARDANDO = "Aguardando envio";
const COPY_ENVIADO = "Arquivo enviado";
const COPY_REMOVER = "Remover arquivo";
const COPY_CANCELAR = "Cancelar envio do arquivo";
const COPY_TENTAR_NOVAMENTE = "Tentar novamente";
const COPY_FALHA_SERVIDOR = "Não foi possível enviar este arquivo.";
const COPY_TIPO_RECUSADO = "Este tipo de arquivo não é aceito.";
const COPY_TAMANHO_RECUSADO = "Este arquivo é maior que 25 MB.";
const COPY_LIMITE_ATINGIDO = "Limite de 10 arquivos por envio atingido.";
/** Copy do UI-SPEC para o motivo do CTA principal — definida aqui (não em `formulario.tsx`) para não duplicar a string. */
export const COPY_AGUARDE_UPLOAD = "Aguarde o envio dos arquivos ou remova os que falharam.";

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validarArquivo(file: File, aceitos: readonly string[]): string | undefined {
  if (!aceitos.includes(file.type)) return COPY_TIPO_RECUSADO;
  if (file.size <= 0 || file.size > MAX_BYTES_POR_ARQUIVO) return COPY_TAMANHO_RECUSADO;
  return undefined;
}

export function UploadDeArquivos({
  id,
  papel,
  accept,
  secret,
  arquivos,
  totalArquivosNoEnvio,
  executarPedidoDeTicket,
  aoAdicionarArquivos,
  aoAtualizarArquivo,
  aoRemoverArquivo,
}: {
  readonly id: string;
  /** `Anexo` | `Boleto` | `QR Code` — o rótulo da própria pergunta. */
  readonly papel: string;
  readonly accept?: readonly string[];
  readonly secret: string;
  readonly arquivos: readonly ArquivoDeUpload[];
  /** Soma de arquivos em TODAS as perguntas de arquivo deste envio — o teto de 10 é do envio, não do campo. */
  readonly totalArquivosNoEnvio: number;
  /**
   * Serializa pedidos de ticket entre perguntas de arquivo diferentes e
   * devolve a MESMA `submissionId` de sessão assim que a primeira chamada a
   * obtém — ver o comentário de topo do módulo.
   */
  readonly executarPedidoDeTicket: (
    tarefa: (submissionIdAtual: string | undefined) => Promise<ResultadoDeTicket>,
  ) => Promise<ResultadoDeTicket>;
  readonly aoAdicionarArquivos: (novos: readonly ArquivoDeUpload[]) => void;
  readonly aoAtualizarArquivo: (clientId: string, parcial: Partial<ArquivoDeUpload>) => void;
  readonly aoRemoverArquivo: (clientId: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const xhrPorArquivo = useRef<Map<string, XMLHttpRequest>>(new Map());
  const idDaAjuda = useId();
  const aceitos = accept && accept.length > 0 ? accept : ACEITOS_PADRAO;
  const limiteAtingido = totalArquivosNoEnvio >= MAX_ARQUIVOS_POR_ENVIO;

  async function iniciarEnvio(item: ArquivoDeUpload): Promise<void> {
    // Cede um microtask antes de sair de "aguardando": o arquivo recém-escolhido (ou reenviado)
    // fica visível nesse estado por pelo menos um instante — não é só cosmético, é o que permite a
    // um lote de várias escolhas renderizar a fila inteira antes de qualquer ticket ser pedido.
    await Promise.resolve();
    aoAtualizarArquivo(item.clientId, { status: "enviando", progresso: 0, erro: undefined });

    const resultado = await executarPedidoDeTicket((submissionIdAtual) =>
      transportePublico.pedirTicket({
        secret,
        ...(submissionIdAtual ? { submissionId: submissionIdAtual } : {}),
        displayName: item.displayName,
        mediaType: item.mediaType,
      }),
    );

    if (resultado.tipo !== "ok") {
      aoAtualizarArquivo(item.clientId, { status: "falhou", erro: COPY_FALHA_SERVIDOR });
      return;
    }

    aoAtualizarArquivo(item.clientId, { objectId: resultado.objectId });

    const sucesso = await enviarBytesAoBucket(
      resultado.uploadUrl,
      item.file,
      (percentual) => aoAtualizarArquivo(item.clientId, { progresso: percentual }),
      (xhr) => xhrPorArquivo.current.set(item.clientId, xhr),
    );
    xhrPorArquivo.current.delete(item.clientId);

    if (!sucesso) {
      aoAtualizarArquivo(item.clientId, { status: "falhou", erro: COPY_FALHA_SERVIDOR });
      return;
    }

    aoAtualizarArquivo(item.clientId, { status: "enviado", progresso: 100 });
  }

  function processarNovosArquivos(lista: FileList | null): void {
    if (!lista || lista.length === 0) return;
    const espacoDisponivel = Math.max(MAX_ARQUIVOS_POR_ENVIO - totalArquivosNoEnvio, 0);
    // O 11º arquivo (e além) do envio é recusado — o teto é da SUBMISSÃO inteira, não desta pergunta.
    const escolhidos = Array.from(lista).slice(0, espacoDisponivel);
    if (escolhidos.length === 0) return;

    const novos: ArquivoDeUpload[] = escolhidos.map((file) => {
      const erro = validarArquivo(file, aceitos);
      return {
        clientId: crypto.randomUUID(),
        file,
        displayName: file.name,
        sizeBytes: file.size,
        mediaType: file.type,
        status: erro ? "falhou" : "aguardando",
        progresso: 0,
        ...(erro ? { erro } : {}),
      };
    });

    aoAdicionarArquivos(novos);
    for (const item of novos) {
      // Recusa de tipo/tamanho é cortesia do cliente: não chama o servidor. Qualquer OUTRO
      // arquivo do mesmo lote continua indo ao servidor — o cliente nunca é a única barreira.
      if (!item.erro) void iniciarEnvio(item);
    }
  }

  function cancelarEnvio(clientId: string): void {
    xhrPorArquivo.current.get(clientId)?.abort();
    aoRemoverArquivo(clientId);
  }

  return (
    <div className="grid gap-2" data-papel={papel}>
      <div
        className="flex flex-wrap items-center gap-3 rounded-[var(--r-controle)] p-3"
        style={{ border: "1px dashed var(--linha)" }}
        onDragOver={(evento) => evento.preventDefault()}
        onDrop={(evento) => {
          evento.preventDefault();
          processarNovosArquivos(evento.dataTransfer.files);
        }}
      >
        <Icone de={Paperclip} tamanho="md" style={{ color: "var(--texto-3)" }} />
        {/* O input REAL fica associado ao <label> de `Field` por este `id` — arrastar e soltar é
            atalho (o `onDrop` acima), nunca a única maneira: o rótulo e o botão abaixo bastam por teclado. */}
        <input
          ref={inputRef}
          id={id}
          type="file"
          multiple
          accept={aceitos.join(",")}
          className="sr-only"
          aria-describedby={idDaAjuda}
          onChange={(evento) => {
            processarNovosArquivos(evento.target.files);
            evento.target.value = "";
          }}
        />
        <Button
          variant="secondary"
          icon={<Icone de={Upload} tamanho="sm" />}
          onClick={() => inputRef.current?.click()}
          disabled={limiteAtingido}
          disabledReason={COPY_LIMITE_ATINGIDO}
        >
          {COPY_ADICIONAR}
        </Button>
        <p id={idDaAjuda} className="app-meta" style={{ color: "var(--texto-3)" }}>
          {COPY_AJUDA_FORMATO}
        </p>
      </div>

      {arquivos.length > 0 ? (
        <ul aria-live="polite" className="grid gap-2">
          {arquivos.map((item) => (
            <li
              key={item.clientId}
              className="grid gap-1 rounded-[var(--r-controle)] p-2"
              style={{ border: "1px solid var(--linha)" }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="app-base min-w-0 truncate" title={item.displayName}>
                  {item.displayName}
                </span>
                <span className="app-meta app-numero shrink-0" style={{ color: "var(--texto-3)" }}>
                  {formatarTamanho(item.sizeBytes)}
                </span>
              </div>

              {item.status === "aguardando" ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="app-meta" style={{ color: "var(--texto-3)" }}>
                    {COPY_AGUARDANDO}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => aoRemoverArquivo(item.clientId)}>
                    {COPY_REMOVER}
                  </Button>
                </div>
              ) : null}

              {item.status === "enviando" ? (
                <div className="grid gap-1">
                  <div
                    role="progressbar"
                    aria-valuenow={item.progresso}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Progresso de envio de ${item.displayName}`}
                    className="h-2 w-full overflow-hidden rounded-full"
                    style={{ background: "var(--superficie-2)" }}
                  >
                    <div style={{ width: `${item.progresso}%`, height: "100%", background: "var(--acento)" }} />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="app-meta app-numero">{`Enviando ${item.progresso}%`}</span>
                    <Button variant="ghost" size="sm" onClick={() => cancelarEnvio(item.clientId)}>
                      {COPY_CANCELAR}
                    </Button>
                  </div>
                </div>
              ) : null}

              {item.status === "enviado" ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="app-meta flex items-center gap-1" style={{ color: "var(--sucesso)" }}>
                    <Icone de={CheckCircle2} tamanho="xs" />
                    {COPY_ENVIADO}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => aoRemoverArquivo(item.clientId)}>
                    {COPY_REMOVER}
                  </Button>
                </div>
              ) : null}

              {item.status === "falhou" ? (
                <div className="grid gap-1">
                  <p role="alert" className="app-meta" style={{ color: "var(--erro)" }}>
                    {item.erro ?? COPY_FALHA_SERVIDOR}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={() => void iniciarEnvio(item)}>
                      {COPY_TENTAR_NOVAMENTE}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => aoRemoverArquivo(item.clientId)}>
                      {COPY_REMOVER}
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
