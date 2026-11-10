/**
 * O ouvinte `LISTEN` do tempo real (16-07, 3.8.3, D-16-01): UMA conexão por processo, FORA do pool, que escuta
 * `crm_eventos` e entrega cada notificação lida ao hub (`aoEvento`). Fora do pool porque uma conexão em `LISTEN` fica
 * presa para sempre e o pool de 10 não pode perder uma; o orçamento de conexões é o pool mais esta.
 *
 * O mesmo TLS do pool (`construirSsl`), `keepAlive`, SEM `query_timeout` (a conexão fica parada esperando o aviso).
 * Quando ela cai (o Supabase derruba conexão ociosa, o pooler reinicia), o `pg.Client` emite `error` e `end`: o
 * ouvinte chama `aoCair` (o hub fica indisponível e encerra os fluxos: a rota responde 503 e a tela relê a cada
 * 5 s) e reconecta com espera crescente de 1 s a 30 s; refeito o `LISTEN`, `aoConectar`. As notificações do intervalo
 * se perdem, e quem cobre isso é a tela, que relê tudo ao reconectar (16-08, Pitfall 6).
 *
 * O handler de notificação nunca bloqueia nem faz I/O (a fila de NOTIFY cheia derruba o commit de quem avisa, T-16-26)
 * e descarta o que não passa em `lerEventoDoCrm`. Nada aqui loga o payload: só o fato de ter conectado ou caído.
 */

import { Client } from "pg";
import { lerEventoDoCrm, type EventoDoCrm } from "@n1/dominio/crm/eventos";
import { carregarEnv, construirSsl, type OpcoesSsl } from "../persistencia/conexao";
import { CANAL_DO_NOTIFY } from "./avisar";

export interface OpcoesDoOuvinteDoCrm {
  /** Padrão: `DATABASE_URL`. */
  readonly url?: string;
  aoEvento(evento: EventoDoCrm): void;
  /** O `LISTEN` está de pé (de novo). */
  aoConectar(): void;
  /** A conexão de escuta caiu (ou foi parada) depois de ter conectado. */
  aoCair(): void;
  readonly registrar?: (nivel: "info" | "warn" | "error", mensagem: string, dados?: Record<string, unknown>) => void;
  /** Padrão 1 s: a primeira espera entre reconexões (dobra até 30 s). Só o teste muda. */
  readonly esperaInicialMs?: number;
}

export interface OuvinteDoCrm {
  /** Começa a escutar (e a reconectar). Chamar duas vezes é no-op. */
  iniciar(): void;
  /** Para de escutar e fecha a conexão. */
  parar(): Promise<void>;
  /** Verdadeiro só entre o `LISTEN` feito e a queda. */
  readonly ouvindo: boolean;
}

const ESPERA_MAXIMA_MS = 30_000;
const TEMPO_PARA_CONECTAR_MS = 10_000;
const TEMPO_PARA_FECHAR_MS = 2_000;

export function criarOuvinteDoCrm(opcoes: OpcoesDoOuvinteDoCrm): OuvinteDoCrm {
  const registrar = opcoes.registrar ?? (() => undefined);
  const esperaInicialMs = opcoes.esperaInicialMs ?? 1_000;

  let parado = true;
  let ouvindo = false;
  let laco: Promise<void> | undefined;
  let atual: Client | undefined;
  let acordarEspera: (() => void) | undefined;

  /** Dorme `ms`, ou menos se `parar()` chamar. */
  function esperar(ms: number): Promise<void> {
    return new Promise<void>((resolver) => {
      const temporizador = setTimeout(terminar, ms);
      function terminar() {
        clearTimeout(temporizador);
        acordarEspera = undefined;
        resolver();
      }
      acordarEspera = terminar;
    });
  }

  /** Fecha o cliente sem nunca pendurar nem lançar: uma conexão morta pode não responder ao `end`. */
  async function fechar(cliente: Client): Promise<void> {
    await Promise.race([cliente.end().catch(() => undefined), new Promise<void>((resolver) => setTimeout(resolver, TEMPO_PARA_FECHAR_MS).unref())]);
  }

  function tratar(payload: string): void {
    let evento: EventoDoCrm | undefined;
    try {
      evento = lerEventoDoCrm(JSON.parse(payload));
    } catch {
      return;
    }
    if (!evento) return;
    try {
      opcoes.aoEvento(evento);
    } catch {
      // o hub nunca deve lançar; se lançar, a próxima notificação ainda tem de ser lida
    }
  }

  async function rodar(url: string): Promise<void> {
    let espera = esperaInicialMs;
    let ssl: OpcoesSsl;
    let sslPronto = false;
    while (!parado) {
      const cliente = (() => {
        if (!sslPronto) {
          ssl = construirSsl({ connectionString: url });
          sslPronto = true;
        }
        return new Client({ connectionString: url, keepAlive: true, connectionTimeoutMillis: TEMPO_PARA_CONECTAR_MS, ...(ssl ? { ssl } : {}) });
      })();
      let cair!: () => void;
      const queda = new Promise<void>((resolver) => {
        cair = resolver;
      });
      // Antes do `connect()`: um `error` sem ouvinte derrubaria o processo.
      cliente.on("error", () => cair());
      cliente.on("end", () => cair());
      cliente.on("notification", (mensagem) => {
        if (mensagem.channel === CANAL_DO_NOTIFY && mensagem.payload) tratar(mensagem.payload);
      });
      atual = cliente;
      try {
        await cliente.connect();
        await cliente.query(`LISTEN ${CANAL_DO_NOTIFY}`);
        if (!parado) {
          ouvindo = true;
          espera = esperaInicialMs;
          registrar("info", "ouvinte do tempo real conectado");
          try {
            opcoes.aoConectar();
          } catch {
            // idem
          }
          await queda;
        }
      } catch (erro) {
        registrar("warn", "ouvinte do tempo real não conectou", { erro: erro instanceof Error ? erro.name : "erro" });
      }
      const estavaOuvindo = ouvindo;
      ouvindo = false;
      atual = undefined;
      await fechar(cliente);
      if (estavaOuvindo) {
        registrar("warn", parado ? "ouvinte do tempo real parado" : "ouvinte do tempo real caiu; vai reconectar");
        try {
          opcoes.aoCair();
        } catch {
          // idem
        }
      }
      if (parado) break;
      await esperar(espera);
      espera = Math.min(espera * 2, ESPERA_MAXIMA_MS);
    }
  }

  return {
    iniciar() {
      if (laco) return;
      let url = opcoes.url;
      if (url === undefined) {
        carregarEnv();
        url = process.env.DATABASE_URL;
      }
      if (!url) {
        registrar("warn", "ouvinte do tempo real não iniciou: DATABASE_URL não definida");
        return;
      }
      parado = false;
      laco = rodar(url)
        .catch((erro: unknown) => {
          registrar("error", "o laço do ouvinte do tempo real terminou", { erro: erro instanceof Error ? erro.name : "erro" });
        })
        .finally(() => {
          laco = undefined;
        });
    },

    async parar() {
      parado = true;
      acordarEspera?.();
      if (atual) await fechar(atual);
      await laco;
    },

    get ouvindo() {
      return ouvindo;
    },
  };
}
