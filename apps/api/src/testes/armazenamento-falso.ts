/**
 * O armazenamento de anexos em memória (16-09): a mesma porta (`ArmazenamentoDeAnexos`) que o bucket do Supabase,
 * para os testes de rota e de mídia rodarem sem a rede e sem a service role. NUNCA chama o Storage real.
 *
 * Confere o que o real confere: o objeto pertence à sessão, existe, respeita o teto do tipo e a ASSINATURA do conteúdo
 * bate com o tipo reservado (`assinaturaConfereComTipo`, a mesma função pura de `storage-uploads.ts`). A única diferença
 * de propósito: a sessão consumida vive em memória, então não volta atrás num `rollback` da transação de quem chama.
 *
 * Os métodos depois de `listar` são só do teste: `colocarBytes` faz o papel do navegador subindo o arquivo pelo ticket.
 */

import { randomUUID } from "node:crypto";
import { normalizarTipoDeMidia, TETO_PADRAO_DE_DOCUMENTO_BYTES, TETO_PADRAO_DE_MIDIA_BYTES, tetoDaMidia } from "@n1/dominio/crm/midia";
import type { ArmazenamentoDeAnexos, ObjetoListado } from "../servicos/armazenamento-de-anexos";
import { assinaturaConfereComTipo } from "../servicos/storage-uploads";

interface SessaoEmMemoria {
  readonly id: string;
  readonly workspaceId: string;
  readonly formId: string;
  readonly expiresAt: Date;
  consumida: boolean;
}

interface ObjetoEmMemoria {
  readonly id: string;
  readonly submissionId: string;
  readonly objectKey: string;
  readonly displayName: string;
  readonly mediaType: string;
}

export interface ArmazenamentoFalso extends ArmazenamentoDeAnexos {
  /** O navegador subindo os bytes pelo ticket. */
  colocarBytes(objectId: string, bytes: Uint8Array): void;
  /** Põe um objeto direto pela chave (o que a entrada de mídia sobe sem passar por ticket). */
  colocarPorChave(objectKey: string, bytes: Uint8Array, tipo: string, criadoEm?: Date): void;
  chaveDoObjeto(objectId: string): string;
  sessaoConsumida(submissionId: string): boolean;
  /** Cada URL assinada emitida, na ordem: o `download` é o nome que forçou `Content-Disposition: attachment`. */
  readonly urlsEmitidas: { readonly objectKey: string; readonly download?: string }[];
  readonly removidos: string[];
  chavesGuardadas(): readonly string[];
  /** Quantas sessões de envio foram abertas: um pedido recusado não deixa nenhuma. */
  quantidadeDeSessoes(): number;
  /** Faz a próxima chamada ao bucket falhar com este erro (uma vez). */
  falharNaProxima(erro: Error): void;
}

export function criarArmazenamentoFalso(opcoes: { readonly tetos?: { readonly midia: number; readonly demais: number } } = {}): ArmazenamentoFalso {
  const tetos = opcoes.tetos ?? { midia: TETO_PADRAO_DE_MIDIA_BYTES, demais: TETO_PADRAO_DE_DOCUMENTO_BYTES };
  const sessoes = new Map<string, SessaoEmMemoria>();
  const objetos = new Map<string, ObjetoEmMemoria>();
  const guardados = new Map<string, { bytes: Uint8Array; tipo: string; criadoEm: Date }>();
  const urlsEmitidas: { objectKey: string; download?: string }[] = [];
  const removidos: string[] = [];
  let falhaPendente: Error | undefined;

  const verificarFalha = () => {
    if (falhaPendente) {
      const erro = falhaPendente;
      falhaPendente = undefined;
      throw erro;
    }
  };

  const objetoDe = (objectId: string): ObjetoEmMemoria => {
    const objeto = objetos.get(objectId);
    if (!objeto) throw new Error(`objeto_inexistente: ${objectId}`);
    return objeto;
  };

  return {
    async abrirSessao({ workspaceId, formId }) {
      verificarFalha();
      const sessao: SessaoEmMemoria = { id: randomUUID(), workspaceId, formId, expiresAt: new Date(Date.now() + 2 * 3_600_000), consumida: false };
      sessoes.set(sessao.id, sessao);
      return { submissionId: sessao.id, expiresAt: sessao.expiresAt };
    },

    async emitirTicket({ submissionId, displayName, mediaType, tipos, prefixoDaChave, tetoBytes, tamanhoBytes }) {
      verificarFalha();
      const tipo = normalizarTipoDeMidia(mediaType);
      if (!tipos.includes(tipo)) throw new Error(`tipo_nao_aceito: ${tipo}`);
      const sessao = sessoes.get(submissionId);
      if (!sessao) throw new Error(`sessao_inexistente: ${submissionId}`);
      if (sessao.consumida) throw new Error(`sessao_consumida: ${submissionId}`);
      if (tamanhoBytes !== undefined && (tamanhoBytes <= 0 || tamanhoBytes > tetoBytes)) throw new Error(`tamanho_excedido: ${submissionId}`);
      const objeto: ObjetoEmMemoria = { id: randomUUID(), submissionId, objectKey: `${prefixoDaChave}/${randomUUID()}`, displayName, mediaType: tipo };
      objetos.set(objeto.id, objeto);
      return {
        objectId: objeto.id,
        objectKey: objeto.objectKey,
        uploadUrl: `https://armazenamento-falso.test/upload/${objeto.id}`,
        token: `token-${objeto.id}`,
        expiresAt: sessao.expiresAt,
      };
    },

    async confirmarObjeto({ submissionId, objectId, tipos, tetoBytes }) {
      verificarFalha();
      const objeto = objetos.get(objectId);
      if (!objeto || objeto.submissionId !== submissionId) return { ok: false, motivo: "objeto_nao_pertence_a_sessao" };
      const guardado = guardados.get(objeto.objectKey);
      if (!guardado) return { ok: false, motivo: "objeto_ausente" };
      const reservado = normalizarTipoDeMidia(objeto.mediaType);
      if (!tipos.includes(reservado)) return { ok: false, motivo: "tipo_nao_confere" };
      const tamanho = guardado.bytes.byteLength;
      if (tamanho <= 0 || tamanho > tetoBytes(reservado)) return { ok: false, motivo: "tamanho_excedido" };
      if (!assinaturaConfereComTipo(guardado.bytes, reservado)) return { ok: false, motivo: "assinatura_nao_confere" };
      return { ok: true, objectId: objeto.id, sizeBytes: tamanho, objectKey: objeto.objectKey, mediaType: reservado, displayName: objeto.displayName };
    },

    async consumirSessao(_cliente, submissionId) {
      const sessao = sessoes.get(submissionId);
      if (!sessao) throw new Error(`sessao_inexistente: ${submissionId}`);
      if (sessao.consumida) throw new Error(`sessao_ja_consumida: ${submissionId}`);
      if (sessao.expiresAt.getTime() < Date.now()) throw new Error(`sessao_expirada: ${submissionId}`);
      sessao.consumida = true;
    },

    async sessao(submissionId) {
      const sessao = sessoes.get(submissionId);
      return sessao ? { workspaceId: sessao.workspaceId, formId: sessao.formId } : undefined;
    },

    async urlAssinada(objectKey, opcoesDaUrl) {
      verificarFalha();
      const download = opcoesDaUrl?.download;
      urlsEmitidas.push({ objectKey, ...(download !== undefined ? { download } : {}) });
      const consulta = download !== undefined ? `?download=${encodeURIComponent(download)}` : "";
      return { downloadUrl: `https://armazenamento-falso.test/objeto/${encodeURIComponent(objectKey)}${consulta}`, expiresAt: new Date(Date.now() + 5 * 60_000) };
    },

    async subir(objectKey, bytes, tipo) {
      verificarFalha();
      guardados.set(objectKey, { bytes, tipo, criadoEm: new Date() });
    },

    async remover(objectKeys) {
      verificarFalha();
      for (const chave of objectKeys) {
        guardados.delete(chave);
        removidos.push(chave);
      }
    },

    async listar(prefixo, { limite }): Promise<readonly ObjetoListado[]> {
      return [...guardados.entries()]
        .filter(([chave]) => chave.startsWith(`${prefixo}/`))
        .slice(0, limite)
        .map(([objectKey, { criadoEm }]) => ({ objectKey, criadoEm }));
    },

    tetoDoTipo: (mediaType) => tetoDaMidia(mediaType, tetos),

    colocarBytes(objectId, bytes) {
      const objeto = objetoDe(objectId);
      guardados.set(objeto.objectKey, { bytes, tipo: objeto.mediaType, criadoEm: new Date() });
    },
    colocarPorChave(objectKey, bytes, tipo, criadoEm = new Date()) {
      guardados.set(objectKey, { bytes, tipo, criadoEm });
    },
    chaveDoObjeto: (objectId) => objetoDe(objectId).objectKey,
    sessaoConsumida: (submissionId) => sessoes.get(submissionId)?.consumida === true,
    urlsEmitidas,
    removidos,
    chavesGuardadas: () => [...guardados.keys()],
    quantidadeDeSessoes: () => sessoes.size,
    falharNaProxima(erro) {
      falhaPendente = erro;
    },
  };
}
