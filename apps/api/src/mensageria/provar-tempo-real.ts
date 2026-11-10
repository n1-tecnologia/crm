/**
 * `npm run tempo-real:provar -w @n1/api` (16-15, D-16-01, A9): uma volta de `LISTEN`/`NOTIFY` pela `DATABASE_URL` do
 * ambiente. É o comando que o dono roda com a URL de produção (o pooler, papel `n1_api`) para saber, ANTES de publicar,
 * se o banco entrega o aviso que o tempo real usa. Sem ele, o ouvinte conectaria e nada chegaria.
 *
 * Não grava nada: só `LISTEN` num canal de prova e um `pg_notify` com id aleatório, sem tabela. Não imprime a URL, o
 * host nem a senha: só o papel (`current_user`, que o dono precisa ver para confirmar `n1_api`), a porta e os
 * milissegundos, ou uma frase fixa de erro. Os dois clientes saem do pool, como o ouvinte (`ouvinte-pg.ts`).
 *
 * Saída: 0 chegou; 1 não chegou (ou o banco não respondeu); 2 faltou a `DATABASE_URL` ou o TLS não está definido.
 */

import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { carregarEnv, construirSsl, type OpcoesSsl } from "../persistencia/conexao";

/** Um canal só desta prova: não é o `crm_eventos` do tempo real, então a prova nunca acorda uma tela. */
const CANAL_DA_PROVA = "crm_eventos_prova";
const ESPERA_PADRAO_MS = 10_000;
const TEMPO_PARA_CONECTAR_MS = 10_000;
const TEMPO_PARA_FECHAR_MS = 2_000;

export interface OpcoesDaProva {
  readonly url: string;
  /** Padrão 10 s. */
  readonly esperaMs?: number;
  /** Só o teste desliga: sem o `pg_notify` a notificação nunca chega e a espera estoura. */
  readonly notificar?: boolean;
}

export interface ResultadoDaProva {
  readonly papel: string;
  readonly porta: number;
  /** Do `commit` do aviso até a notificação chegar ao ouvinte. */
  readonly recebidoEmMs: number;
}

/** Falha esperada da prova, com uma frase que o dono pode ler sem ver segredo. */
export class ErroDaProva extends Error {
  constructor(
    mensagem: string,
    readonly codigoDeSaida: 1 | 2,
  ) {
    super(mensagem);
    this.name = "ErroDaProva";
  }
}

function emSegundos(ms: number): string {
  return String(ms / 1000).replace(".", ",");
}

/** O código curto do erro de rede ou do Postgres (`ECONNREFUSED`, `28P01`), que não traz host nem senha. */
function codigoDoErro(erro: unknown): string | undefined {
  const codigo = typeof erro === "object" && erro !== null ? (erro as { code?: unknown }).code : undefined;
  return typeof codigo === "string" && /^[A-Z0-9_]{3,20}$/.test(codigo) ? codigo : undefined;
}

async function fechar(cliente: Client): Promise<void> {
  await Promise.race([cliente.end().catch(() => undefined), new Promise<void>((resolver) => setTimeout(resolver, TEMPO_PARA_FECHAR_MS).unref())]);
}

export async function provarTempoReal(opcoes: OpcoesDaProva): Promise<ResultadoDaProva> {
  const esperaMs = opcoes.esperaMs ?? ESPERA_PADRAO_MS;
  let ssl: OpcoesSsl;
  try {
    ssl = construirSsl({ connectionString: opcoes.url });
  } catch {
    throw new ErroDaProva("A conexão remota precisa de DATABASE_CA_PATH ou DATABASE_CA_CERT (a CA do Supabase).", 2);
  }
  const novo = () =>
    new Client({ connectionString: opcoes.url, keepAlive: true, connectionTimeoutMillis: TEMPO_PARA_CONECTAR_MS, ...(ssl ? { ssl } : {}) });
  const ouvinte = novo();
  const avisador = novo();
  // Antes do `connect()`: um `error` sem ouvinte derrubaria o processo.
  ouvinte.on("error", () => undefined);
  avisador.on("error", () => undefined);

  const id = randomUUID();
  let inicio = 0;
  let recebidaEm: number | undefined;
  let avisarChegou!: () => void;
  const chegou = new Promise<void>((resolver) => {
    avisarChegou = resolver;
  });
  ouvinte.on("notification", (mensagem) => {
    if (mensagem.channel === CANAL_DA_PROVA && mensagem.payload === id && recebidaEm === undefined) {
      recebidaEm = performance.now();
      avisarChegou();
    }
  });

  try {
    try {
      await ouvinte.connect();
      await avisador.connect();
      await ouvinte.query(`LISTEN ${CANAL_DA_PROVA}`);
    } catch (erro) {
      const codigo = codigoDoErro(erro);
      throw new ErroDaProva(`Não foi possível conectar ao banco${codigo ? ` (${codigo})` : ""}.`, 1);
    }
    const quem = await ouvinte.query<{ papel: string; porta: number | null }>("select current_user::text as papel, inet_server_port() as porta");

    let temporizador: NodeJS.Timeout | undefined;
    const estourou = new Promise<"estourou">((resolver) => {
      temporizador = setTimeout(() => resolver("estourou"), esperaMs);
    });
    try {
      if (opcoes.notificar !== false) {
        await avisador.query("begin");
        await avisador.query("select pg_notify($1, $2)", [CANAL_DA_PROVA, id]);
        inicio = performance.now();
        await avisador.query("commit");
      }
      const desfecho = await Promise.race([chegou.then(() => "chegou" as const), estourou]);
      if (desfecho === "estourou" || recebidaEm === undefined) {
        throw new ErroDaProva(`A notificação não chegou em ${emSegundos(esperaMs)} s.`, 1);
      }
    } catch (erro) {
      if (erro instanceof ErroDaProva) throw erro;
      const codigo = codigoDoErro(erro);
      throw new ErroDaProva(`A prova falhou ao avisar pelo banco${codigo ? ` (${codigo})` : ""}.`, 1);
    } finally {
      if (temporizador) clearTimeout(temporizador);
    }

    const linha = quem.rows[0];
    return { papel: linha?.papel ?? "desconhecido", porta: Number(linha?.porta ?? 0), recebidoEmMs: Math.max(0, Math.round(recebidaEm - inicio)) };
  } finally {
    await Promise.all([fechar(ouvinte), fechar(avisador)]);
  }
}

export interface SaidaDaProva {
  out(texto: string): void;
  err(texto: string): void;
}

export interface OpcoesDoPrincipal {
  /** Padrão: `DATABASE_URL` do ambiente (e do `apps/api/.env`, por `carregarEnv`). Vazia vale como ausente. */
  readonly url?: string;
  readonly esperaMs?: number;
  readonly notificar?: boolean;
  readonly saida?: SaidaDaProva;
}

export async function principal(_argv: readonly string[], opcoes: OpcoesDoPrincipal = {}): Promise<number> {
  const saida = opcoes.saida ?? { out: (texto) => console.log(texto), err: (texto) => console.error(texto) };
  let url = opcoes.url;
  if (url === undefined) {
    carregarEnv();
    url = process.env.DATABASE_URL;
  }
  if (!url) {
    saida.err("DATABASE_URL não está definida: ponha-a no ambiente ou em apps/api/.env.");
    return 2;
  }
  try {
    const resultado = await provarTempoReal({
      url,
      ...(opcoes.esperaMs !== undefined ? { esperaMs: opcoes.esperaMs } : {}),
      ...(opcoes.notificar !== undefined ? { notificar: opcoes.notificar } : {}),
    });
    saida.out(`papel=${resultado.papel} porta=${resultado.porta} recebido_em_ms=${resultado.recebidoEmMs}`);
    return 0;
  } catch (erro) {
    if (erro instanceof ErroDaProva) {
      saida.err(erro.message);
      return erro.codigoDeSaida;
    }
    saida.err("A prova falhou por um erro inesperado.");
    return 1;
  }
}
