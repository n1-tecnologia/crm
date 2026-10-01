/**
 * O envio dos bytes ao bucket privado pela URL assinada do ticket — o mesmo
 * para o Formulário público e para o anexo da Tarefa (D-04). Nenhuma chave de
 * Storage passa por aqui, só o `uploadUrl` que o servidor emitiu.
 *
 * `fetch` sem `duplex` não expõe progresso de upload; `XMLHttpRequest.upload.onprogress`
 * expõe. O corpo replica o de `uploadToSignedUrl` do `@supabase/storage-js`
 * (um `FormData` com `cacheControl` e o arquivo sob a chave vazia).
 */

/** Cortesia do navegador — a autoridade é `apps/api/src/servicos/storage-uploads.ts`. */
export const TIPOS_DE_ARQUIVO_ACEITOS = ["application/pdf", "application/xml", "text/xml", "image/jpeg", "image/png", "image/webp"] as const;
export const TETO_DE_BYTES_DO_ARQUIVO = 25 * 1024 * 1024;
export const COPY_FORMATOS_ACEITOS = "PDF, XML, JPG, PNG ou WebP, até 25 MB.";

/** O `accept` do `<input type="file">`: extensões e tipos, para o seletor do sistema já filtrar. */
export const ACEITAR_NO_SELETOR = ".pdf,.xml,.jpg,.jpeg,.png,.webp," + TIPOS_DE_ARQUIVO_ACEITOS.join(",");

export function recusaDoArquivoNoNavegador(arquivo: { readonly type: string; readonly size: number }): string | undefined {
  if (!(TIPOS_DE_ARQUIVO_ACEITOS as readonly string[]).includes(arquivo.type)) return `Este tipo de arquivo não é aceito: ${COPY_FORMATOS_ACEITOS}`;
  if (arquivo.size <= 0 || arquivo.size > TETO_DE_BYTES_DO_ARQUIVO) return "Este arquivo é maior que 25 MB.";
  return undefined;
}

export function enviarBytesAoBucket(
  uploadUrl: string,
  file: File,
  aoProgredir: (percentual: number) => void,
  aoAbrirXhr: (xhr: XMLHttpRequest) => void = () => {},
): Promise<boolean> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    aoAbrirXhr(xhr);
    xhr.open("PUT", uploadUrl, true);
    xhr.upload.onprogress = (evento) => {
      if (evento.lengthComputable) aoProgredir(Math.round((evento.loaded / evento.total) * 100));
    };
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = () => resolve(false);
    xhr.onabort = () => resolve(false);
    const corpo = new FormData();
    corpo.append("cacheControl", "3600");
    corpo.append("", file);
    xhr.send(corpo);
  });
}
