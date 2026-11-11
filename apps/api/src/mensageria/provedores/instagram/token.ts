/**
 * A credencial do Instagram de um Canal, no cofre (009, `tipo = "instagram-graph"`): o JSON
 * `{ contaId, token, expiraEm, obtidoEm }`. É o que `canalParaProvedor` decifra e entrega ao
 * provedor em `CanalParaProvedor.credencial`; nunca vai a log, resposta nem erro.
 *
 * O token de longa duração vale cerca de 60 dias e só se renova depois de 24 h de vida. A
 * renovação é preguiçosa: quem vai usar o token (a saída, a leitura do perfil de quem
 * escreveu, a ficha do Canal) renova quando faltam menos de 7 dias e grava a credencial nova
 * no cofre. Falhar a renovação de um token ainda válido não impede o uso. Um Canal parado por
 * mais de 60 dias perde a autorização: o uso seguinte recusa e pede para conectar de novo.
 */

import type { Pool, PoolClient } from "pg";
import { guardarCredencial, type ChavesDoCofre } from "../../../servicos/cofre";
import type { CanalParaProvedor } from "../../provedor";
import type { ClienteDoInstagram, TokenLongo } from "./cliente";
import { TIPO_DA_CREDENCIAL } from "./repositorio";

export interface CredencialDoInstagram {
  /** O id da conta profissional: o `entry[].id` do webhook e o `{conta}` de `POST /{conta}/messages`. */
  readonly contaId: string;
  readonly token: string;
  readonly expiraEm: string;
  readonly obtidoEm: string;
}

const DIA_MS = 24 * 3_600_000;
const RENOVAR_COM_MENOS_DE_MS = 7 * DIA_MS;

export const FRASE_TOKEN_VENCIDO = "A autorização do Instagram venceu ou foi retirada: conecte o Canal de novo pela ficha dele.";
export const FRASE_SEM_CREDENCIAL = "O Canal não tem a autorização do Instagram: conecte-o pela ficha dele.";

/** A credencial decifrada, ou `undefined` para qualquer outra forma (ausente, JSON quebrado, campo faltando). */
export function lerCredencialDoInstagram(texto: string | undefined): CredencialDoInstagram | undefined {
  if (texto === undefined || texto === "") return undefined;
  try {
    const lida: unknown = JSON.parse(texto);
    if (typeof lida !== "object" || lida === null) return undefined;
    const { contaId, token, expiraEm, obtidoEm } = lida as Record<string, unknown>;
    if (typeof contaId !== "string" || contaId === "" || typeof token !== "string" || token === "") return undefined;
    if (typeof expiraEm !== "string" || Number.isNaN(Date.parse(expiraEm))) return undefined;
    return { contaId, token, expiraEm, obtidoEm: typeof obtidoEm === "string" ? obtidoEm : expiraEm };
  } catch {
    return undefined;
  }
}

export async function guardarCredencialDoInstagram(
  cliente: Pick<Pool | PoolClient, "query">,
  chaves: ChavesDoCofre,
  dono: { readonly workspaceId: string; readonly canalId: string },
  entrada: { readonly contaId: string; readonly token: TokenLongo; readonly agora: number },
): Promise<void> {
  const credencial: CredencialDoInstagram = {
    contaId: entrada.contaId,
    token: entrada.token.token,
    expiraEm: entrada.token.expiraEm,
    obtidoEm: new Date(entrada.agora).toISOString(),
  };
  await guardarCredencial(cliente, chaves, {
    workspaceId: dono.workspaceId,
    donoTipo: "canal",
    donoId: dono.canalId,
    tipo: TIPO_DA_CREDENCIAL,
    segredo: JSON.stringify(credencial),
  });
}

export type TokenParaUsar =
  | { readonly ok: true; readonly token: string; readonly contaId: string }
  | { readonly ok: false; readonly codigo: "CREDENCIAL_AUSENTE" | "TOKEN_VENCIDO"; readonly motivo: string };

/** A porta que o provedor usa para ter o token; `criarTokensPg` renova e grava, os testes usam uma que só lê. */
export interface TokensDoInstagram {
  tokenParaUsar(canal: CanalParaProvedor): Promise<TokenParaUsar>;
}

function semRenovar(credencial: CredencialDoInstagram | undefined, agora: number): TokenParaUsar | undefined {
  if (!credencial) return { ok: false, codigo: "CREDENCIAL_AUSENTE", motivo: FRASE_SEM_CREDENCIAL };
  if (Date.parse(credencial.expiraEm) <= agora) return { ok: false, codigo: "TOKEN_VENCIDO", motivo: FRASE_TOKEN_VENCIDO };
  return undefined;
}

/** Só lê a credencial do Canal: o que o contrato do provedor e os testes sem banco usam. */
export function tokensSoDaCredencial(agora: () => number = Date.now): TokensDoInstagram {
  return {
    async tokenParaUsar(canal) {
      const credencial = lerCredencialDoInstagram(canal.credencial);
      return semRenovar(credencial, agora()) ?? { ok: true, token: credencial!.token, contaId: credencial!.contaId };
    },
  };
}

/**
 * Grava a credencial renovada numa transação própria: `guardarCredencial` revoga a ativa e insere a nova em duas
 * instruções, e as duas precisam valer juntas (sem isso, uma falha no meio deixa o Canal sem credencial ativa). Duas
 * renovações ao mesmo tempo: a segunda esbarra em `credenciais_ativa_unica`, desfaz, e quem chama segue com o token atual.
 */
async function gravarRenovada(
  pool: Pick<Pool, "connect">,
  chaves: ChavesDoCofre,
  canal: CanalParaProvedor,
  entrada: { readonly contaId: string; readonly token: TokenLongo; readonly agora: number },
): Promise<void> {
  const cliente = await pool.connect();
  try {
    await cliente.query("begin");
    await guardarCredencialDoInstagram(cliente, chaves, { workspaceId: canal.workspaceId, canalId: canal.canal.id }, entrada);
    await cliente.query("commit");
  } catch (erro) {
    await cliente.query("rollback").catch(() => undefined);
    throw erro;
  } finally {
    cliente.release();
  }
}

/** Lê a credencial do Canal e, perto de vencer, renova na Meta e grava a nova no cofre. */
export function criarTokensPg(deps: {
  readonly pool: () => Pick<Pool, "connect">;
  readonly chaves: () => ChavesDoCofre;
  readonly cliente: ClienteDoInstagram;
  readonly agora?: () => number;
}): TokensDoInstagram {
  const agora = deps.agora ?? Date.now;
  return {
    async tokenParaUsar(canal) {
      const instante = agora();
      const credencial = lerCredencialDoInstagram(canal.credencial);
      const recusa = semRenovar(credencial, instante);
      if (recusa) return recusa;
      const { token, contaId, expiraEm, obtidoEm } = credencial!;
      const expira = Date.parse(expiraEm);
      const obtido = Date.parse(obtidoEm);
      if (expira - instante < RENOVAR_COM_MENOS_DE_MS && (Number.isNaN(obtido) || instante - obtido >= DIA_MS)) {
        try {
          const novo = await deps.cliente.renovarToken(token);
          await gravarRenovada(deps.pool(), deps.chaves(), canal, { contaId, token: novo, agora: instante });
          return { ok: true, token: novo.token, contaId };
        } catch {
          // O token atual ainda vale: renova no próximo uso.
          return { ok: true, token, contaId };
        }
      }
      return { ok: true, token, contaId };
    },
  };
}
