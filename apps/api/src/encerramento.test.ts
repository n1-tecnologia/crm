/**
 * O encerramento da api (Fase 16, 16-18, T-16-28 / WR-03).
 *
 * Os três primeiros casos sobem um processo de verdade (`testes/processo-que-encerra.ts`) com o MESMO executor da
 * produção (`vite-node`, o `ExecStart` da unidade), seguram um fluxo longo aberto e mandam SIGTERM. O que se mede é o
 * que o systemd mede: o processo sai, com que código e em quanto tempo. O ambiente do filho leva só `PATH`, `HOME` e as
 * variáveis do modo — nada do arquivo de ambiente da api, nenhuma conexão com banco.
 */

import { spawn, type ChildProcess } from "node:child_process";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

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
