/**
 * Esqueleto do RED (16-09, Task 1): só a porta. A implementação padrão (o bucket
 * do Supabase, por `storage-uploads.ts`) vem no GREEN.
 */

import type { PoolClient } from "pg";
import type { ResultadoDeConfirmacao, SessaoDeUploadAberta, TicketDeUpload, UrlDeDownload } from "./storage-uploads";

export interface ObjetoListado {
  readonly objectKey: string;
  readonly criadoEm: Date;
}

export interface ArmazenamentoDeAnexos {
  abrirSessao(args: { readonly workspaceId: string; readonly formId: string }): Promise<SessaoDeUploadAberta>;
  emitirTicket(args: {
    readonly submissionId: string;
    readonly displayName: string;
    readonly mediaType: string;
    readonly tipos: readonly string[];
    readonly prefixoDaChave: string;
    readonly tetoBytes: number;
    readonly tamanhoBytes?: number;
  }): Promise<TicketDeUpload>;
  confirmarObjeto(args: {
    readonly submissionId: string;
    readonly objectId: string;
    readonly tipos: readonly string[];
    readonly tetoBytes: (mediaType: string) => number;
  }): Promise<ResultadoDeConfirmacao>;
  consumirSessao(cliente: PoolClient, submissionId: string): Promise<void>;
  sessao(submissionId: string): Promise<{ readonly workspaceId: string; readonly formId: string } | undefined>;
  urlAssinada(objectKey: string, opcoes?: { readonly download?: string }): Promise<UrlDeDownload>;
  subir(objectKey: string, bytes: Uint8Array, tipo: string): Promise<void>;
  remover(objectKeys: readonly string[]): Promise<void>;
  listar(prefixo: string, opcoes: { readonly limite: number }): Promise<readonly ObjetoListado[]>;
  /** O teto de tamanho de um tipo (D-16-08): 16 MiB para áudio e vídeo, 25 MiB para o resto, por variável de ambiente. */
  tetoDoTipo(mediaType: string): number;
}

export function armazenamentoDeAnexosPadrao(): ArmazenamentoDeAnexos {
  throw new Error("nao_implementado");
}
