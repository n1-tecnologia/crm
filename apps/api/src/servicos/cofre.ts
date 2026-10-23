/**
 * Cofre de credenciais (Fase 9, D-17, SEG-05): o segredo de um provedor (token
 * da Evolution, da Meta, senha de e-mail) só existe cifrado em
 * `plataforma.credenciais`.
 *
 * Cifra: AES-256-GCM do `node:crypto`, IV de 12 bytes novo a cada gravação e
 * etiqueta de 16 bytes. A chave NÃO está no banco (não é o Supabase Vault): mora
 * no `api.env` de cada ambiente (`COFRE_CHAVE`, 32 bytes em base64) e cada
 * ambiente tem a sua. Quem levar uma cópia do banco ou do backup leva só texto
 * cifrado. O outro lado da moeda: perder a `COFRE_CHAVE` perde as credenciais,
 * por isso ela precisa de uma cópia fora da VPS, com o dono.
 *
 * AAD: cada texto cifrado fica amarrado à sua linha - JSON de
 * `[workspaceId, donoTipo, donoId, tipo, versaoDaChave]`. Uma linha copiada para
 * outro dono, outro Espaço ou outro tipo não decifra. Mudar essa composição
 * depois que existirem credenciais obriga a re-cifrar todas.
 *
 * Quem chama `lerCredencial`: só os serviços de provedor (Sessões 4, 7, 8 e 9).
 * Nenhuma rota importa este módulo, e nenhuma rota devolve o segredo.
 *
 * Rotação: a leitura é por versão. `COFRE_CHAVE_ANTERIOR` e
 * `COFRE_CHAVE_ANTERIOR_VERSAO` (opcionais) leem as linhas da versão anterior;
 * re-cifrar com a chave nova não é desta fase (procedimento em `CONTEXT.md`).
 *
 * Nada aqui imprime, loga ou lança com o conteúdo de uma chave ou de um segredo.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { PoolClient } from "pg";

export interface ChavesDoCofre {
  readonly atual: { readonly versao: number; readonly chave: Buffer };
  readonly anterior?: { readonly versao: number; readonly chave: Buffer };
}

export interface DonoDaCredencial {
  readonly workspaceId: string;
  readonly donoTipo: "canal" | "integracao";
  readonly donoId: string;
  readonly tipo: string;
}

export interface CredencialCifrada {
  readonly segredoCifrado: Buffer;
  readonly iv: Buffer;
  readonly etiqueta: Buffer;
  readonly versaoDaChave: number;
}

const TAMANHO_DA_CHAVE = 32;
const TAMANHO_DO_IV = 12;
const TAMANHO_DA_ETIQUETA = 16;
const MENSAGEM_TAMANHO = "COFRE_CHAVE precisa ter 32 bytes (base64).";

function lerVersao(nome: string, valor: string | undefined): number {
  const texto = valor?.trim() ?? "";
  if (!/^\d+$/.test(texto) || Number(texto) < 1 || !Number.isSafeInteger(Number(texto))) {
    throw new Error(`${nome} precisa ser um inteiro maior ou igual a 1.`);
  }
  return Number(texto);
}

function lerChave(nome: string, valor: string | undefined): Buffer {
  const texto = valor?.trim() ?? "";
  if (texto === "") throw new Error(`${nome} não está configurada.`);
  const chave = Buffer.from(texto, "base64");
  if (chave.length !== TAMANHO_DA_CHAVE) {
    throw new Error(nome === "COFRE_CHAVE" ? MENSAGEM_TAMANHO : `${nome} precisa ter 32 bytes (base64).`);
  }
  return chave;
}

/** Lê `COFRE_CHAVE`/`COFRE_CHAVE_VERSAO` (e, na troca de chave, as `_ANTERIOR`). Lança com mensagem clara. */
export function lerChavesDoCofre(env: NodeJS.ProcessEnv = process.env): ChavesDoCofre {
  const atual = {
    versao: lerVersao("COFRE_CHAVE_VERSAO", env.COFRE_CHAVE_VERSAO),
    chave: lerChave("COFRE_CHAVE", env.COFRE_CHAVE),
  };
  const anteriorTexto = env.COFRE_CHAVE_ANTERIOR?.trim() ?? "";
  if (anteriorTexto === "") return { atual };
  const anterior = {
    versao: lerVersao("COFRE_CHAVE_ANTERIOR_VERSAO", env.COFRE_CHAVE_ANTERIOR_VERSAO),
    chave: lerChave("COFRE_CHAVE_ANTERIOR", anteriorTexto),
  };
  return { atual, anterior };
}

function contexto(dono: DonoDaCredencial, versao: number): Buffer {
  return Buffer.from(JSON.stringify([dono.workspaceId, dono.donoTipo, dono.donoId, dono.tipo, versao]), "utf8");
}

export function cifrar(texto: string, chave: Buffer, versao: number, dono: DonoDaCredencial): CredencialCifrada {
  if (chave.length !== TAMANHO_DA_CHAVE) throw new Error(MENSAGEM_TAMANHO);
  const iv = randomBytes(TAMANHO_DO_IV);
  const cifra = createCipheriv("aes-256-gcm", chave, iv, { authTagLength: TAMANHO_DA_ETIQUETA });
  cifra.setAAD(contexto(dono, versao));
  const segredoCifrado = Buffer.concat([cifra.update(texto, "utf8"), cifra.final()]);
  return { segredoCifrado, iv, etiqueta: cifra.getAuthTag(), versaoDaChave: versao };
}

function chaveDaVersao(chaves: ChavesDoCofre, versao: number): Buffer {
  if (chaves.atual.versao === versao) return chaves.atual.chave;
  if (chaves.anterior && chaves.anterior.versao === versao) return chaves.anterior.chave;
  throw new Error(`A chave da versão ${versao} não está configurada.`);
}

export function decifrar(linha: CredencialCifrada, chaves: ChavesDoCofre, dono: DonoDaCredencial): string {
  const chave = chaveDaVersao(chaves, linha.versaoDaChave);
  // `authTagLength` fixo: sem ele o GCM aceitaria etiquetas curtas (4 a 16 bytes).
  const decifra = createDecipheriv("aes-256-gcm", chave, linha.iv, { authTagLength: TAMANHO_DA_ETIQUETA });
  decifra.setAAD(contexto(dono, linha.versaoDaChave));
  decifra.setAuthTag(linha.etiqueta);
  // `final()` lança se a etiqueta, a chave ou o AAD não bateram.
  return Buffer.concat([decifra.update(linha.segredoCifrado), decifra.final()]).toString("utf8");
}

/**
 * Revoga a credencial ativa do mesmo (Espaço, dono, tipo) e insere a nova, no
 * `cliente` recebido: a transação é de quem chama. A ordem importa - o índice
 * parcial `credenciais_ativa_unica` só admite uma linha com `revogado_em is null`.
 * Devolve só o `id`; o segredo nunca volta.
 */
export async function guardarCredencial(
  cliente: Pick<PoolClient, "query">,
  chaves: ChavesDoCofre,
  entrada: DonoDaCredencial & { readonly segredo: string },
): Promise<{ readonly id: string }> {
  const { segredoCifrado, iv, etiqueta, versaoDaChave } = cifrar(
    entrada.segredo,
    chaves.atual.chave,
    chaves.atual.versao,
    entrada,
  );
  await cliente.query(
    `update plataforma.credenciais
        set revogado_em = now()
      where workspace_id = $1 and dono_tipo = $2 and dono_id = $3 and tipo = $4
        and revogado_em is null`,
    [entrada.workspaceId, entrada.donoTipo, entrada.donoId, entrada.tipo],
  );
  const resultado = await cliente.query<{ id: string }>(
    `insert into plataforma.credenciais
       (workspace_id, dono_tipo, dono_id, tipo, segredo_cifrado, iv, etiqueta, versao_da_chave)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning id`,
    [entrada.workspaceId, entrada.donoTipo, entrada.donoId, entrada.tipo, segredoCifrado, iv, etiqueta, versaoDaChave],
  );
  const linha = resultado.rows[0];
  if (!linha) throw new Error("guardarCredencial: o INSERT não devolveu o id.");
  return { id: linha.id };
}

/**
 * Texto da credencial ativa do dono, ou `undefined` se não há. Só serviços de
 * provedor chamam isto; nenhuma rota. Lança com a chave errada, a etiqueta
 * adulterada ou a linha copiada para outro dono (AAD).
 */
export async function lerCredencial(
  cliente: Pick<PoolClient, "query">,
  chaves: ChavesDoCofre,
  dono: DonoDaCredencial,
): Promise<string | undefined> {
  const resultado = await cliente.query<{
    segredo_cifrado: Buffer;
    iv: Buffer;
    etiqueta: Buffer;
    versao_da_chave: number;
  }>(
    `select segredo_cifrado, iv, etiqueta, versao_da_chave
       from plataforma.credenciais
      where workspace_id = $1 and dono_tipo = $2 and dono_id = $3 and tipo = $4
        and revogado_em is null`,
    [dono.workspaceId, dono.donoTipo, dono.donoId, dono.tipo],
  );
  const linha = resultado.rows[0];
  if (!linha) return undefined;
  return decifrar(
    {
      segredoCifrado: linha.segredo_cifrado,
      iv: linha.iv,
      etiqueta: linha.etiqueta,
      versaoDaChave: linha.versao_da_chave,
    },
    chaves,
    dono,
  );
}
