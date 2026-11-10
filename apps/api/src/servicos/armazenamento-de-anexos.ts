/**
 * A porta dos anexos da Mensagem (16-09): o que o serviço de Mensagens e a entrada de mídia precisam do bucket,
 * sem conhecer o Supabase. Existe para os testes de rota e de mídia rodarem sem a rede: eles injetam
 * `criarArmazenamentoFalso()` (`testes/armazenamento-falso.ts`), que implementa a MESMA porta em memória.
 *
 * A implementação padrão só delega às funções de `storage-uploads.ts` (o bucket de hoje, `SUPABASE_STORAGE_BUCKET`,
 * com o prefixo `workspace/<ws>/conversas/`) — é lá que moram a service role e a conferência do conteúdo. Esta porta
 * não escolhe tipo nem teto: quem a chama diz a lista e o teto de cada pedido.
 *
 * Quem mexe com o cofre de credenciais NÃO passa por aqui: `rotas/` nunca importa `servicos/cofre`.
 */

import type { PoolClient } from "pg";
import { consumirSessao, obterSessao } from "../persistencia/sessoes-de-upload";
import {
  abrirSessaoDeUpload,
  confirmarObjeto,
  emitirTicket,
  listarObjetos,
  removerObjetos,
  subirObjeto,
  tetoDoTipo,
  urlDeDownload,
  type ResultadoDeConfirmacao,
  type SessaoDeUploadAberta,
  type TicketDeUpload,
  type UrlDeDownload,
} from "./storage-uploads";

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

/** O bucket do Supabase. Não abre conexão nem lê variável ao ser criado: tudo acontece quando um método é chamado. */
export function armazenamentoDeAnexosPadrao(): ArmazenamentoDeAnexos {
  return {
    abrirSessao: (args) => abrirSessaoDeUpload(args),
    emitirTicket: ({ submissionId, displayName, mediaType, tipos, prefixoDaChave, tetoBytes, tamanhoBytes }) =>
      emitirTicket(
        { submissionId, displayName, mediaType },
        { tipos, prefixoDaChave, tetoBytes, ...(tamanhoBytes !== undefined ? { tamanhoBytes } : {}) },
      ),
    confirmarObjeto: ({ submissionId, objectId, tipos, tetoBytes }) => confirmarObjeto({ submissionId, objectId }, { tipos, tetoBytes }),
    consumirSessao: (cliente, submissionId) => consumirSessao(cliente, submissionId),
    async sessao(submissionId) {
      const sessao = await obterSessao(submissionId);
      return sessao ? { workspaceId: sessao.workspaceId, formId: sessao.formId } : undefined;
    },
    urlAssinada: (objectKey, opcoes) => urlDeDownload(objectKey, opcoes),
    subir: (objectKey, bytes, tipo) => subirObjeto(objectKey, bytes, tipo),
    remover: (objectKeys) => removerObjetos(objectKeys),
    listar: (prefixo, opcoes) => listarObjetos(prefixo, opcoes),
    tetoDoTipo,
  };
}
