/**
 * Os anexos que sobem ao Omie com o lançamento (Fase 6, Fluxo 7) — espelho do
 * legado (`payment-automation-service.ts`, `PAS:1933-1937`), que manda TODOS
 * os anexos da Tarefa no `IncluirAnexo`: aqui, os arquivos dos Campos
 * "Anexo", "Boleto" e "QR Code" da conta (Valores ativos; o Valor de um
 * Campo `file` é a lista de ids de `WorkspaceFile`, como em
 * `conversao-de-solicitacao.ts::CAMPOS_DE_ARQUIVO`) e os anexos da própria
 * Tarefa (`task.attachments[].fileId`), em ordem e sem duplicata.
 *
 * Cada arquivo vira `{ url, nome }` — o formato v1.1 do contrato
 * `contas-a-pagar-v1` (`/lancar`, 06-02): `url` é uma URL assinada de
 * download (`urlDeDownload`, `../servicos/storage-uploads.ts`) e `nome` é o
 * nome original do arquivo (`WorkspaceFile.name`), que o `automation/` põe no
 * `cNomeArquivo` do Omie.
 *
 * As URLs valem 5 min (`TTL_DOWNLOAD`): por isso são geradas logo antes do
 * `/lancar` (prazo de 60 s), nunca guardadas. **A URL assinada NUNCA vai para
 * log** — ela carrega o token de acesso ao arquivo (T-3-04). Quem chama só
 * pode registrar a CONTAGEM de anexos e de avisos.
 *
 * Nenhuma falha aqui derruba o lançamento: um id sem `WorkspaceFile` ou uma
 * assinatura que falha vira um aviso à parte (`avisos`), e os outros
 * arquivos seguem — como no legado, anexo que não sobe não impede o título.
 *
 * Os limites do pedido v1.2 (06-07; 06-12): o schema do `/lancar` recusa
 * com 400 `SCHEMA_INVALIDO` — falha PERMANENTE da conta — uma lista com mais
 * de `LIMITE_DE_ANEXOS` itens ou uma `url` com mais de
 * `TAMANHO_MAXIMO_DA_URL_DO_ANEXO` caracteres. Por isso só os primeiros 20
 * ids (na ordem de sempre) seguem para a assinatura, e os demais viram só a
 * contagem `acimaDoLimite`; um link assinado longo demais vira aviso.
 */

import type { DataState, Id, Task } from "@n1/dominio";
import { CP } from "@n1/dominio/operations/financeiro";
import { urlDeDownload } from "../servicos/storage-uploads";

export interface AnexoParaOLancamento {
  readonly url: string;
  readonly nome: string;
}

export interface AvisoDeAnexo {
  /** O nome do arquivo — ou o id, quando o arquivo não existe. Nunca a URL. */
  readonly nome: string;
  readonly erro: string;
}

export type AssinarDownload = (objectKey: string) => Promise<{ readonly downloadUrl: string }>;

/** O teto do contrato v1.1 para `anexos[].nome` (`z.string().min(1).max(200)`). */
const TAMANHO_MAXIMO_DO_NOME = 200;

/** O teto do schema do `/lancar` v1.2 para a lista `anexos` (`.max(20)`, 06-07). */
export const LIMITE_DE_ANEXOS = 20;

/** O teto do schema do `/lancar` v1.2 para `anexos[].url` (`z.url().max(2048)`, 06-07). */
export const TAMANHO_MAXIMO_DA_URL_DO_ANEXO = 2048;

/** Os Campos de arquivo da conta, na ordem em que sobem. */
const CAMPOS_DE_ARQUIVO_DA_CONTA: readonly Id[] = [CP.fields.anexo, CP.fields.boleto, CP.fields.qrCode];

function idsDoValor(valor: unknown): string[] {
  if (typeof valor === "string") return valor ? [valor] : [];
  if (Array.isArray(valor)) return valor.filter((v): v is string => typeof v === "string" && v.length > 0);
  return [];
}

function nomeDoArquivo(nome: string, id: string): string {
  const limpo = nome.trim() || id;
  return limpo.length > TAMANHO_MAXIMO_DO_NOME ? limpo.slice(0, TAMANHO_MAXIMO_DO_NOME) : limpo;
}

export async function anexosDaConta(
  state: DataState,
  task: Task,
  assinar: AssinarDownload = (objectKey) => urlDeDownload(objectKey),
): Promise<{ readonly anexos: AnexoParaOLancamento[]; readonly avisos: AvisoDeAnexo[]; readonly acimaDoLimite?: number }> {
  const ids: string[] = [];
  for (const definitionId of CAMPOS_DE_ARQUIVO_DA_CONTA) {
    for (const valor of task.fieldValues) {
      if (valor.definitionId !== definitionId || valor.state !== "ativo") continue;
      ids.push(...idsDoValor(valor.value));
    }
  }
  for (const anexo of task.attachments) ids.push(anexo.fileId);

  const unicos = [...new Set(ids)];
  const dentro = unicos.slice(0, LIMITE_DE_ANEXOS);
  const acimaDoLimite = unicos.length - dentro.length;

  const anexos: AnexoParaOLancamento[] = [];
  const avisos: AvisoDeAnexo[] = [];
  for (const id of dentro) {
    const arquivo = state.files.find((f) => f.id === id);
    if (!arquivo) {
      avisos.push({ nome: id, erro: "arquivo não encontrado" });
      continue;
    }
    const nome = nomeDoArquivo(arquivo.name, arquivo.id);
    try {
      const { downloadUrl } = await assinar(arquivo.objectKey);
      // Um único link longo demais derrubaria o `/lancar` inteiro com 400.
      if (downloadUrl.length > TAMANHO_MAXIMO_DA_URL_DO_ANEXO) avisos.push({ nome, erro: "link de download longo demais" });
      else anexos.push({ url: downloadUrl, nome });
    } catch {
      // A mensagem da exceção fica de fora de propósito: ela pode citar o
      // caminho do objeto ou a URL que falhou.
      avisos.push({ nome, erro: "não consegui gerar o link de download" });
    }
  }
  return { anexos, avisos, ...(acimaDoLimite > 0 ? { acimaDoLimite } : {}) };
}
