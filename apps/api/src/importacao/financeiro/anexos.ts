/**
 * D-26 — anexo histórico de uma Solicitação de pagamento: nasce na
 * exportação do ClickUp (Plan 00-04/00-05, `apps/api/exportacoes/clickup/`,
 * fora do git — LGPD) e só sobe ao bucket privado quando o vínculo com o
 * `TaskID` legado é INEQUÍVOCO (exatamente um candidato no manifesto, com o
 * arquivo presente em disco e o hash batendo). Qualquer ambiguidade vira
 * aviso reconciliável — nunca aborta o lote: `importarLote` (`./importar.ts`)
 * chama esta função por linha e segue adiante mesmo com `ligado: false`.
 *
 * Achado do Plan 00-05, repetido aqui porque muda a expectativa de quem lê
 * os números: `apps/api/exportacoes/MANIFESTO.json` mostra 1 (um) anexo só
 * para a Lista de Solicitações (901109104938) — a cobertura documental das
 * ~1.110 linhas do Supabase legado nunca foi prometida (`CONTEXT.md` desta
 * pasta); a maioria das linhas vai gerar `anexo_ausente`, e isso é esperado.
 *
 * ## O caminho real em disco não é o caminho do manifesto
 *
 * `apps/api/src/importacao/clickup/manifesto.ts` TRUNCA o nome do anexo em
 * `MANIFESTO.json` — grava `<listId>/attachments/<taskId>/<attId>`, sem o
 * `-<nome original>` que o arquivo de verdade carrega em disco (o nome
 * nunca entra no manifesto, D-02/T-0-01). `localizarArquivoReal` lista a
 * pasta e casa pelo prefixo `<attId>-`, em vez de montar o caminho direto.
 *
 * ## Por que `taskId` não entra no caminho do objeto
 *
 * Esta função roda ANTES de `executar()` — a Tarefa da plataforma ainda não
 * existe (`importarLote` resolve anexos como passo assíncrono antes de abrir
 * a transação síncrona do domínio, no mesmo lugar em que resolve autoria).
 * O caminho do objeto usa só `legacyTaskId`, já conhecido nesse ponto; o
 * `taskId` da Tarefa recém-criada entra depois, só para atribuição do
 * `WorkspaceFile`/`Attachment` construídos em `./importar.ts` dentro da
 * mesma transação que cria a Tarefa — nunca para o caminho do objeto
 * (T-02-14).
 *
 * ## Dry-run nunca grava
 *
 * Com `dryRun: true`, a função faz TODA a verificação (localizar, ler,
 * conferir hash) só com I/O local, sem tocar o Storage, e devolve
 * `ligado: true` com um `objectKey` de pré-visualização quando o vínculo
 * seria inequívoco — mas nunca chama `.upload()`. Reaplicação (`--apply`
 * duas vezes) nunca duplica o objeto porque a linha inteira já está no
 * ledger na segunda vez: `importarLote` filtra pelo ledger ANTES de chegar
 * aqui, então esta função nunca roda de novo para a mesma linha já
 * importada.
 */

import { createHash, randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import type { Attachment } from "@n1/dominio";

import { clienteAdmin } from "../../autenticacao/verificar-token";
import { carregarEnv } from "../../persistencia/conexao";
import type { Manifesto } from "../clickup/manifesto";

carregarEnv();

/** Id literal da Lista "Solicitações de pagamento" no ClickUp exportado (Plan 00-04/00-05). */
const LIST_ID_SOLICITACOES = "901109104938";

function nomeDoBucket(): string {
  const nome = process.env.SUPABASE_STORAGE_BUCKET;
  if (!nome) throw new Error("SUPABASE_STORAGE_BUCKET precisa estar em apps/api/.env.");
  return nome;
}

/** A service role nunca sai desta função — mesmo padrão de `servicos/storage-uploads.ts`. */
function armazenamento() {
  return clienteAdmin().storage.from(nomeDoBucket());
}

export type MotivoDeAvisoDeAnexo = "anexo_ausente" | "anexo_hash_divergente" | "anexo_multiplos_candidatos";

export interface OpcoesDeLigacaoDeAnexo {
  readonly legacyTaskId: string;
  /** Id da Tarefa recém-criada na plataforma — só para atribuição, nunca para o caminho do objeto (ver cabeçalho). */
  readonly taskId?: string;
  readonly workspaceId: string;
  /** Raiz de `apps/api/exportacoes/` — onde `MANIFESTO.json` e a subpasta `clickup/` (fora do git) moram. */
  readonly pastaDeExportacoes: string;
  /** `true`: verifica tudo, nunca chama `.upload()` (dry-run não grava nada). */
  readonly dryRun: boolean;
}

export type ResultadoDaLigacao =
  | {
      readonly ligado: true;
      readonly objectKey: string;
      readonly sha256: string;
      readonly displayName: string;
      readonly sizeBytes: number;
      readonly mediaType: Attachment["mediaType"];
    }
  | { readonly ligado: false; readonly aviso: MotivoDeAvisoDeAnexo };

function mediaTypePorExtensao(nome: string): Attachment["mediaType"] {
  const extensao = path.extname(nome).toLowerCase();
  if (extensao === ".pdf") return "document";
  if (extensao === ".jpg" || extensao === ".jpeg" || extensao === ".png" || extensao === ".webp") return "image";
  return "other";
}

const manifestosCarregados = new Map<string, Manifesto>();

async function lerManifesto(pastaDeExportacoes: string): Promise<Manifesto> {
  const existente = manifestosCarregados.get(pastaDeExportacoes);
  if (existente) return existente;
  const caminho = path.join(pastaDeExportacoes, "MANIFESTO.json");
  const manifesto = JSON.parse(await readFile(caminho, "utf8")) as Manifesto;
  manifestosCarregados.set(pastaDeExportacoes, manifesto);
  return manifesto;
}

/** Só para teste: descarta o cache para reler `MANIFESTO.json` do disco na próxima chamada. */
export function limparCacheDeManifestoDeAnexos(): void {
  manifestosCarregados.clear();
}

/** O nome real em disco carrega `<attId>-<nome original>` — acha por prefixo dentro da pasta do `taskId` legado. */
async function localizarArquivoReal(
  pastaDeExportacoes: string,
  caminhoDoManifesto: string,
): Promise<{ readonly caminhoAbsoluto: string; readonly nomeOriginal: string } | undefined> {
  const partes = caminhoDoManifesto.split("/");
  const [listId, , taskIdDoAnexo, attId] = partes;
  if (!listId || !taskIdDoAnexo || !attId) return undefined;
  const pastaDoAnexo = path.join(pastaDeExportacoes, "clickup", listId, "attachments", taskIdDoAnexo);
  let entradas: readonly string[];
  try {
    entradas = await readdir(pastaDoAnexo);
  } catch {
    return undefined;
  }
  const nomeReal = entradas.find((nome) => nome === attId || nome.startsWith(`${attId}-`));
  if (!nomeReal) return undefined;
  const nomeOriginal = nomeReal === attId ? nomeReal : nomeReal.slice(attId.length + 1);
  return { caminhoAbsoluto: path.join(pastaDoAnexo, nomeReal), nomeOriginal: nomeOriginal || nomeReal };
}

/**
 * Liga (ou avisa a ausência/ambiguidade d)o anexo histórico de UMA linha
 * legada. Nunca lança por ambiguidade ou ausência — sempre
 * `{ ligado: false, aviso }`.
 */
export async function ligarAnexoHistorico(opcoes: OpcoesDeLigacaoDeAnexo): Promise<ResultadoDaLigacao> {
  const manifesto = await lerManifesto(opcoes.pastaDeExportacoes);
  const prefixo = `${LIST_ID_SOLICITACOES}/attachments/${opcoes.legacyTaskId}/`;
  const candidatos = manifesto.arquivos.filter((arquivo) => arquivo.caminho.startsWith(prefixo));

  if (candidatos.length === 0) return { ligado: false, aviso: "anexo_ausente" };
  if (candidatos.length > 1) return { ligado: false, aviso: "anexo_multiplos_candidatos" };

  const candidato = candidatos[0]!;
  const localizado = await localizarArquivoReal(opcoes.pastaDeExportacoes, candidato.caminho);
  if (!localizado) return { ligado: false, aviso: "anexo_ausente" };

  let conteudo: Buffer;
  try {
    conteudo = await readFile(localizado.caminhoAbsoluto);
  } catch {
    return { ligado: false, aviso: "anexo_ausente" };
  }

  const shaReal = createHash("sha256").update(conteudo).digest("hex");
  if (shaReal !== candidato.sha256) return { ligado: false, aviso: "anexo_hash_divergente" };

  const mediaType = mediaTypePorExtensao(localizado.nomeOriginal);

  if (opcoes.dryRun) {
    return {
      ligado: true,
      objectKey: `workspace/${opcoes.workspaceId}/importacao/${opcoes.legacyTaskId}/<dry-run>`,
      sha256: shaReal,
      displayName: localizado.nomeOriginal,
      sizeBytes: conteudo.byteLength,
      mediaType,
    };
  }

  // Caminho aleatório — nunca o nome original, que pode carregar razão social e valor (T-02-14).
  const objectKey = `workspace/${opcoes.workspaceId}/importacao/${opcoes.legacyTaskId}/${randomUUID()}`;
  const { error } = await armazenamento().upload(objectKey, conteudo, { upsert: false });
  if (error) return { ligado: false, aviso: "anexo_ausente" };

  return {
    ligado: true,
    objectKey,
    sha256: shaReal,
    displayName: localizado.nomeOriginal,
    sizeBytes: conteudo.byteLength,
    mediaType,
  };
}
