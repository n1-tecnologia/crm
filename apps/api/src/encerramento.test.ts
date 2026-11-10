/**
 * O encerramento da api (Fase 16, 16-18, T-16-28 / WR-03).
 *
 * Os três primeiros casos sobem um processo de verdade (`testes/processo-que-encerra.ts`) com o MESMO executor da
 * produção (`vite-node`, o `ExecStart` da unidade), seguram um fluxo longo aberto e mandam SIGTERM. O que se mede é o
 * que o systemd mede: o processo sai, com que código e em quanto tempo. O ambiente do filho leva só `PATH`, `HOME` e as
 * variáveis do modo — nada do arquivo de ambiente da api, nenhuma conexão com banco.
 *
 * Os casos de baixo são puros: um processo falso (um `EventEmitter` com `exit` espião) e um agendador injetado, sem
 * `spawn`, para as bordas do tratador (SIGINT, segundo sinal, etapa que falha, teto, recarga).
 */

import { spawn, type ChildProcess } from "node:child_process";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { criarEncerramento, TETO_DO_ENCERRAMENTO_MS, type OpcoesDoEncerramento, type Temporizador } from "./encerramento";

const RAIZ_DA_API = fileURLToPath(new URL("..", import.meta.url));
const VITE_NODE = fileURLToPath(new URL("../../../node_modules/vite-node/dist/cli.mjs", import.meta.url));

interface Filho {
  readonly processo: ChildProcess;
  readonly porta: number;
  /** As linhas que o filho escreveu na saída padrão, em ordem. */
  readonly linhas: string[];
  /** Resolve com o código de saída quando o filho sai. */
  readonly saiu: Promise<number | null>;
}

/** Sobe o processo de prova e espera a linha `PRONTO <porta>`. */
async function subirFilho(modo: Record<string, string>): Promise<Filho> {
  const processo = spawn(process.execPath, [VITE_NODE, "src/testes/processo-que-encerra.ts"], {
    cwd: RAIZ_DA_API,
    env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", NODE_ENV: "test", ...modo },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const linhas: string[] = [];
  let erroPadrao = "";
  processo.stderr?.on("data", (pedaco: Buffer) => {
    erroPadrao += pedaco.toString();
  });
  const saiu = new Promise<number | null>((resolver) => processo.once("exit", (codigo) => resolver(codigo)));
  const porta = await new Promise<number>((resolver, rejeitar) => {
    const limite = setTimeout(() => rejeitar(new Error(`o processo de prova não ficou pronto em 30 s\n${erroPadrao}`)), 30_000);
    let resto = "";
    processo.stdout?.on("data", (pedaco: Buffer) => {
      resto += pedaco.toString();
      const partes = resto.split("\n");
      resto = partes.pop() ?? "";
      for (const linha of partes) {
        linhas.push(linha);
        const pronto = /^PRONTO (\d+)$/.exec(linha);
        if (pronto) {
          clearTimeout(limite);
          resolver(Number(pronto[1]));
        }
      }
    });
    void saiu.then((codigo) => {
      clearTimeout(limite);
      rejeitar(new Error(`o processo de prova saiu antes de ficar pronto (código ${codigo})\n${erroPadrao}`));
    });
  });
  return { processo, porta, linhas, saiu };
}

/** Abre `GET /fluxo` e devolve o cliente depois de ler o primeiro pedaço (`: aberto`). `terminou` resolve quando o fluxo acaba. */
async function abrirFluxo(porta: number): Promise<{ terminou: Promise<void>; destruir: () => void }> {
  return new Promise((resolver, rejeitar) => {
    const requisicao = http.get({ host: "127.0.0.1", port: porta, path: "/fluxo" }, (resposta) => {
      let terminou!: () => void;
      const acabou = new Promise<void>((fim) => {
        terminou = fim;
      });
      resposta.once("end", terminou);
      resposta.once("close", terminou);
      resposta.once("error", terminou);
      resposta.once("data", (pedaco: Buffer) => {
        if (!pedaco.toString().includes(": aberto")) rejeitar(new Error("o primeiro pedaço do fluxo não foi `: aberto`"));
        resolver({ terminou: acabou, destruir: () => requisicao.destroy() });
      });
    });
    requisicao.once("error", rejeitar);
  });
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, ms));
}

function etapasDe(linhas: string[]): string[] {
  const etapas: string[] = [];
  for (const linha of linhas) {
    if (!linha.startsWith("{")) continue;
    const mensagem = (JSON.parse(linha) as { mensagem?: string }).mensagem ?? "";
    const etapa = /^encerramento: (fluxos|paradas|servidor|pool)$/.exec(mensagem);
    if (etapa?.[1]) etapas.push(etapa[1]);
  }
  return etapas;
}

describe("o SIGTERM num processo de verdade (vite-node, como na unidade systemd)", () => {
  it("modo antigo: um ouvinte de SIGTERM que só para o worker deixa o processo vivo 3 s depois do sinal", async () => {
    const filho = await subirFilho({ MODO: "antigo" });
    try {
      const fluxo = await abrirFluxo(filho.porta);
      filho.processo.kill("SIGTERM");
      await esperar(3_000);
      // É isto que o `restart` de 2026-11-10 viu: nada sai sozinho, o systemd espera os 20 s e manda SIGKILL.
      expect(filho.processo.exitCode).toBeNull();
      expect(filho.processo.signalCode).toBeNull();
      fluxo.destruir();
    } finally {
      if (filho.processo.exitCode === null && filho.processo.signalCode === null) filho.processo.kill("SIGKILL");
      await filho.saiu;
    }
  });

  it("tratador único: SIGTERM com um fluxo aberto fecha o fluxo e o servidor e sai com 0 em menos de 5 s", async () => {
    const filho = await subirFilho({});
    try {
      const fluxo = await abrirFluxo(filho.porta);
      const inicio = Date.now();
      filho.processo.kill("SIGTERM");
      const codigo = await Promise.race([filho.saiu, esperar(10_000).then(() => "estourou" as const)]);
      const gasto = Date.now() - inicio;
      expect(codigo).toBe(0);
      expect(gasto).toBeLessThan(5_000);
      await fluxo.terminou;
      expect(etapasDe(filho.linhas)).toEqual(["fluxos", "paradas", "servidor", "pool"]);
    } finally {
      if (filho.processo.exitCode === null && filho.processo.signalCode === null) filho.processo.kill("SIGKILL");
      await filho.saiu;
    }
  });

  it("parada travada: o teto corta, registra e sai com 1 em menos de 3 s", async () => {
    const filho = await subirFilho({ TRAVAR_PARADA: "1", TETO_MS: "800" });
    try {
      await abrirFluxo(filho.porta);
      const inicio = Date.now();
      filho.processo.kill("SIGTERM");
      const codigo = await Promise.race([filho.saiu, esperar(10_000).then(() => "estourou" as const)]);
      const gasto = Date.now() - inicio;
      expect(codigo).toBe(1);
      expect(gasto).toBeLessThan(3_000);
      expect(filho.linhas.some((linha) => linha.includes("encerramento: teto estourado"))).toBe(true);
    } finally {
      if (filho.processo.exitCode === null && filho.processo.signalCode === null) filho.processo.kill("SIGKILL");
      await filho.saiu;
    }
  });
});

/** Um processo falso: emite sinais como o `process` e guarda a chamada de `exit` num espião. */
function processoFalso() {
  const emissor = new EventEmitter();
  const exit = vi.fn();
  return { emissor, exit, processo: Object.assign(emissor, { exit }) };
}

/** Um agendador que não espera: guarda a ação e o prazo, e o teste decide quando disparar. */
function agendadorManual() {
  const agendados: Array<{ acao: () => void; ms: number; cancelado: boolean }> = [];
  const agendar = (acao: () => void, ms: number): Temporizador => {
    const item = { acao, ms, cancelado: false };
    agendados.push(item);
    return { cancelar: () => (item.cancelado = true) };
  };
  return { agendados, agendar };
}

interface Registro {
  readonly nivel: string;
  readonly mensagem: string;
  readonly dados?: Record<string, unknown> | undefined;
}

/** Monta o encerramento com todas as etapas anotando a ordem em `chamadas`. */
function montar(sobrescritas: Partial<OpcoesDoEncerramento> = {}) {
  const chamadas: string[] = [];
  const registros: Registro[] = [];
  const falso = processoFalso();
  const agendador = agendadorManual();
  const encerramento = criarEncerramento({
    fecharFluxos: () => {
      chamadas.push("fluxos");
    },
    fecharServidor: async () => {
      chamadas.push("servidor");
    },
    encerrarPool: async () => {
      chamadas.push("pool");
    },
    registrar: (nivel, mensagem, dados) => {
      registros.push({ nivel, mensagem, dados });
    },
    agendar: agendador.agendar,
    ...sobrescritas,
  });
  falso.exit.mockImplementation((codigo: number) => {
    chamadas.push(`exit:${codigo}`);
  });
  return { chamadas, registros, falso, agendador, encerramento };
}

describe("criarEncerramento: as bordas do tratador", () => {
  it.each(["SIGTERM", "SIGINT"])("%s: fluxos, paradas, fluxos de novo, servidor, pool e exit(0), nessa ordem", async (sinal) => {
    const { chamadas, falso, encerramento } = montar();
    encerramento.aoEncerrar(async () => {
      chamadas.push("parada-a");
    });
    encerramento.aoEncerrar(async () => {
      chamadas.push("parada-b");
    });
    encerramento.instalar(falso.processo);

    falso.emissor.emit(sinal);
    await vi.waitFor(() => expect(falso.exit).toHaveBeenCalled());

    expect(chamadas).toEqual(["fluxos", "parada-a", "parada-b", "fluxos", "servidor", "pool", "exit:0"]);
  });

  it("dois SIGTERM seguidos: o servidor fecha uma vez e o processo sai uma vez", async () => {
    const { chamadas, registros, falso, encerramento } = montar();
    encerramento.instalar(falso.processo);

    falso.emissor.emit("SIGTERM");
    falso.emissor.emit("SIGTERM");
    await vi.waitFor(() => expect(falso.exit).toHaveBeenCalled());
    await Promise.resolve();

    expect(chamadas.filter((chamada) => chamada === "servidor")).toHaveLength(1);
    expect(falso.exit).toHaveBeenCalledTimes(1);
    expect(registros.some((registro) => registro.mensagem.includes("ignorado"))).toBe(true);
  });

  it("uma parada que rejeita: as outras paradas, o servidor e o pool rodam do mesmo jeito, a etapa fica no registro e a saída é 1", async () => {
    const { chamadas, registros, falso, encerramento } = montar();
    encerramento.aoEncerrar(async () => {
      throw new Error("senha-de-conexao-que-nao-pode-ir-ao-registro");
    });
    encerramento.aoEncerrar(async () => {
      chamadas.push("parada-boa");
    });
    encerramento.instalar(falso.processo);

    falso.emissor.emit("SIGTERM");
    await vi.waitFor(() => expect(falso.exit).toHaveBeenCalled());

    expect(chamadas).toEqual(["fluxos", "parada-boa", "fluxos", "servidor", "pool", "exit:1"]);
    const falha = registros.find((registro) => registro.mensagem === "encerramento: paradas falhou");
    expect(falha?.nivel).toBe("error");
    // Só o nome do erro vai para o registro: a mensagem pode carregar um segredo.
    expect(JSON.stringify(registros)).not.toContain("senha-de-conexao");
  });

  it("uma parada que nunca resolve: o teto corta em tetoMs, registra e sai com 1", async () => {
    const { registros, falso, agendador, encerramento } = montar({ tetoMs: 1_000 });
    encerramento.aoEncerrar(() => new Promise<void>(() => {}));
    encerramento.instalar(falso.processo);

    falso.emissor.emit("SIGTERM");
    await Promise.resolve();
    expect(agendador.agendados).toHaveLength(1);
    expect(agendador.agendados[0]?.ms).toBe(1_000);
    expect(falso.exit).not.toHaveBeenCalled();

    agendador.agendados[0]?.acao();

    expect(falso.exit).toHaveBeenCalledTimes(1);
    expect(falso.exit).toHaveBeenCalledWith(1);
    const teto = registros.find((registro) => registro.mensagem === "encerramento: teto estourado");
    expect(teto?.dados).toEqual({ tetoMs: 1_000 });
  });

  it("sem tetoMs o teto é de 15 s, abaixo dos 20 s da unidade, e o encerramento limpo o cancela", async () => {
    const { falso, agendador, encerramento } = montar();
    encerramento.instalar(falso.processo);

    falso.emissor.emit("SIGTERM");
    await vi.waitFor(() => expect(falso.exit).toHaveBeenCalledWith(0));

    expect(TETO_DO_ENCERRAMENTO_MS).toBe(15_000);
    expect(agendador.agendados[0]?.ms).toBe(15_000);
    expect(agendador.agendados[0]?.cancelado).toBe(true);
  });

  it("desmontar() sozinho (o caminho da recarga) nunca sai do processo, e duas chamadas devolvem a mesma promessa", async () => {
    const { chamadas, falso, encerramento } = montar();
    encerramento.instalar(falso.processo);

    const primeira = encerramento.desmontar();
    const segunda = encerramento.desmontar();
    expect(segunda).toBe(primeira);
    expect(await primeira).toEqual({ ok: true });

    expect(falso.exit).not.toHaveBeenCalled();
    expect(chamadas.filter((chamada) => chamada === "servidor")).toHaveLength(1);
  });

  it("desinstalar() deixa a instância sem ouvinte de SIGTERM nem de SIGINT", () => {
    const { falso, encerramento } = montar();
    encerramento.instalar(falso.processo);
    expect(falso.emissor.listenerCount("SIGTERM")).toBe(1);
    expect(falso.emissor.listenerCount("SIGINT")).toBe(1);

    encerramento.desinstalar();

    expect(falso.emissor.listenerCount("SIGTERM")).toBe(0);
    expect(falso.emissor.listenerCount("SIGINT")).toBe(0);
  });

  it("aoEncerrar() não pendura ouvinte de sinal nenhum", () => {
    const { falso, encerramento } = montar();
    encerramento.aoEncerrar(async () => {});
    expect(falso.emissor.listenerCount("SIGTERM")).toBe(0);
  });
});
