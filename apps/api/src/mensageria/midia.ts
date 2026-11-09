/**
 * A mídia que CHEGA (16-10, 3.9.4, MSG-04, D-16-08): o link de mídia do provedor expira, então o arquivo é baixado e
 * guardado no bucket ANTES da transação do recebimento. A Mensagem grava o anexo com a chave do objeto e `baixado: true`.
 *
 * Cada anexo com `referenciaNoProvedor` passa por quatro conferências, e qualquer uma que falhe deixa o anexo
 * `baixado: false` (com o nome e a referência do provedor), nunca derruba a Mensagem:
 *   1. o tipo (normalizado) está na lista da Mensagem (`TIPOS_ACEITOS_NA_MENSAGEM`);
 *   2. o provedor entrega a mídia dentro do teto do tipo (`baixarMidia`, que lê em fluxo e aborta no teto);
 *   3. o tipo que o provedor devolveu também está na lista;
 *   4. a assinatura do CONTEÚDO inteiro bate com o tipo (um texto declarado `audio/ogg` é recusado). O conteúdo inteiro
 *      porque o zip e o Office guardam o diretório central no fim do arquivo.
 *
 * A chave do objeto é `workspace/<ws>/entrada/<canalId>/<uuid>`: a baixada antes da transação não tem Conversa ainda
 * (com Contato novo ela nem existe). O download é autorizado pela linha da Mensagem, nunca pelo prefixo.
 *
 * A mídia vem só de `provedor.baixarMidia` (host fixo do provedor): este módulo nunca faz requisição por URL do corpo (SSRF).
 * Nada aqui loga bytes, nome do arquivo nem referência do provedor.
 */

import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import type { AnexoDaMensagem } from "@n1/dominio/crm/mensagens";
import type { AnexoRecebidoDoProvedor } from "@n1/dominio/crm/recebimento";
import { TIPOS_ACEITOS_NA_MENSAGEM, normalizarTipoDeMidia, tetoDaMidia } from "@n1/dominio/crm/midia";
import { armazenamentoDeAnexosPadrao, type ArmazenamentoDeAnexos } from "../servicos/armazenamento-de-anexos";
import { assinaturaConfereComTipo } from "../servicos/storage-uploads";
import { ErroDeProvedor, type CanalParaProvedor, type ProvedorDeMensageria } from "./provedor";

export interface DependenciasDoGuardaDeMidia {
  /** O bucket. Padrão: o do Supabase (só é tocado quando um anexo chega); os testes injetam `criarArmazenamentoFalso()`. */
  readonly armazenamento?: ArmazenamentoDeAnexos;
  /** Sobrepõe os tetos do armazenamento (16 MiB áudio e vídeo, 25 MiB o resto). */
  readonly tetos?: { readonly midia: number; readonly demais: number };
}

export interface ResultadoDosAnexosRecebidos {
  /** Um item por anexo do evento, na mesma ordem. */
  readonly anexos: readonly AnexoDaMensagem[];
  /** Algum anexo falhou por causa que pode passar sozinha (rede, provedor fora, bucket fora): vale tentar de novo. */
  readonly algumTransitorio: boolean;
  /** Quanto durou baixar do provedor e subir ao bucket, em ms (a medição da prova ao vivo). */
  readonly baixarMs: number;
  readonly subirMs: number;
}

export interface GuardaDeMidia {
  guardarAnexosRecebidos(args: {
    readonly workspaceId: string;
    readonly canal: CanalParaProvedor;
    readonly provedor: ProvedorDeMensageria;
    readonly anexos: readonly AnexoRecebidoDoProvedor[];
  }): Promise<ResultadoDosAnexosRecebidos>;
}

const ACEITOS: ReadonlySet<string> = new Set(TIPOS_ACEITOS_NA_MENSAGEM);

/**
 * O que pode passar sozinho: o provedor fora do ar, rede, tempo esgotado, 5xx e o bucket fora do ar. A mídia que o provedor
 * já não tem (`MIDIA_INDISPONIVEL`), a que passa do teto (`MIDIA_GRANDE_DEMAIS`) e a credencial ausente não mudam com o tempo.
 */
function ehTransitorio(erro: unknown): boolean {
  if (erro instanceof ErroDeProvedor) return erro.codigo === "PROVEDOR_INDISPONIVEL";
  return true;
}

export function criarGuardaDeMidia(deps: DependenciasDoGuardaDeMidia = {}): GuardaDeMidia {
  // Criar o padrão não abre conexão nem lê variável: só tocar nele o faz.
  const armazenamento = deps.armazenamento ?? armazenamentoDeAnexosPadrao();
  const tetoDoTipo = (tipo: string): number => (deps.tetos ? tetoDaMidia(tipo, deps.tetos) : armazenamento.tetoDoTipo(tipo));

  return {
    async guardarAnexosRecebidos({ workspaceId, canal, provedor, anexos }) {
      const guardados: AnexoDaMensagem[] = [];
      let algumTransitorio = false;
      let baixarMs = 0;
      let subirMs = 0;

      for (const anexo of anexos) {
        const declarado = normalizarTipoDeMidia(anexo.tipoDeMidia);
        // O que a Mensagem mostra quando o arquivo não pôde ser guardado: o atendente vê que o cliente mandou um arquivo.
        const indisponivel: AnexoDaMensagem = { tipoDeMidia: declarado, nome: anexo.nome, referenciaExterna: anexo.referenciaNoProvedor, baixado: false };
        if (!ACEITOS.has(declarado)) {
          guardados.push(indisponivel);
          continue;
        }

        let etapa: "baixar" | "subir" = "baixar";
        let inicio = performance.now();
        try {
          const teto = tetoDoTipo(declarado);
          const midia = await provedor.baixarMidia(canal, anexo.referenciaNoProvedor, { tetoBytes: teto });
          baixarMs += performance.now() - inicio;

          // O provedor devolve o que quiser: o tipo e o conteúdo são conferidos de novo, e o teto também.
          const tipo = normalizarTipoDeMidia(midia.tipoDeMidia);
          if (!ACEITOS.has(tipo) || midia.bytes.byteLength > tetoDoTipo(tipo) || !assinaturaConfereComTipo(midia.bytes, tipo)) {
            guardados.push(indisponivel);
            continue;
          }

          etapa = "subir";
          inicio = performance.now();
          const objectKey = `workspace/${workspaceId}/entrada/${canal.canal.id}/${randomUUID()}`;
          await armazenamento.subir(objectKey, midia.bytes, tipo);
          subirMs += performance.now() - inicio;

          guardados.push({ tipoDeMidia: tipo, nome: anexo.nome, objectKey, tamanhoBytes: midia.bytes.byteLength, baixado: true });
        } catch (erro) {
          if (etapa === "baixar") baixarMs += performance.now() - inicio;
          else subirMs += performance.now() - inicio;
          // Falha do bucket no upload é sempre transitória; no download, depende do que o provedor disse.
          if (etapa === "subir" || ehTransitorio(erro)) algumTransitorio = true;
          guardados.push(indisponivel);
        }
      }

      return { anexos: guardados, algumTransitorio, baixarMs, subirMs };
    },
  };
}
