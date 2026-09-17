#!/usr/bin/env node
/**
 * CAPTURA DE MOVIMENTO
 *
 * Fotografa a interface em instantes fixos depois de um gatilho, por CDP puro:
 * sobe um Chrome headless, fala com ele por um WebSocket próprio (RFC 6455,
 * cliente mínimo — zero dependências) e grava PNGs. É o harness da
 * DIRECAO-VISUAL §5 e do CHECKLIST-MOVIMENTO (docs/05-design-system).
 *
 * Uso:
 *   node scripts/capturar-movimento.mjs <urlOrigem> <gatilhoJs> <prefixo> [tempos] [W] [H] [sondaJs]
 *   npm run capturar:movimento -- <urlOrigem> <gatilhoJs> <prefixo> [tempos] [W] [H] [sondaJs]
 *
 *   urlOrigem  a página aberta ANTES do gatilho (ex.: http://localhost:3000/).
 *              Rotas do Next redirecionam para a barra final: use `/crm/contatos/`.
 *   gatilhoJs  JS avaliado na página já hidratada; pode devolver uma Promise.
 *              Ex.: `document.querySelector('a[href="/crm/contatos"]').click(); 'ok'`
 *              `'x'` = nenhum gatilho (fotografa a origem parada).
 *   prefixo    das PNGs: grava `<prefixo>-<t>ms.png`. Absoluto vale como está;
 *              relativo resolve dentro de SAIDA.
 *   tempos     "0,30,75,150,300,450,600,1200" — ms do RELÓGIO DA INTERFACE.
 *   W H        viewport (padrão 1440 × 900).
 *   sondaJs    JS avaliado antes de cada foto e impresso ao lado dela
 *              (ex.: `document.querySelectorAll('.cascata > *').length`).
 *
 * Os dois relógios:
 *   · O relógio da INTERFACE é o dos tokens (`--dur-*`). ESCALA=10 injeta, por
 *     uma folha do inspetor (fora do DOM: o React não a vê na hidratação), os
 *     tokens de tempo multiplicados por 10 com !important. CSS e JS leem o
 *     MESMO token (`design/movimento.ts` → `lerDuracao`), então a interface
 *     inteira fica 10× mais lenta — cascata, janela de chegada, presença do
 *     popup, count-up, barra de rota — e não só as animações declaradas, como
 *     faria `Animation.setPlaybackRate` (que não toca rAF nem timers). Os
 *     `tempos` são lidos nesse relógio.
 *   · O relógio REAL é t × ESCALA: a foto de "300ms" com ESCALA=10 sai 3000 ms
 *     reais depois do gatilho. Cada linha da saída imprime os dois.
 *   A folha é reinjetada em 30/150/400/900 ms depois de cada navegação, antes
 *   de o JS guardar o primeiro valor lido de cada token (cache de `lerDuracao`).
 *   Não escalam: `--dur-aviso`/`--dur-aviso-longo` (prazo de leitura, não
 *   movimento) e as derivas da atmosfera.
 *
 * Env:
 *   CDP_PORT=9457        porta do devtools — cada agente/sessão usa a SUA.
 *   ESCALA=10            ver acima; ESCALA=1 é tempo real.
 *   SAIDA=<dir>          base de um prefixo relativo (padrão: <tmp>/movimento).
 *   PREWARM=/a,/b        rotas visitadas antes (compilam no dev server).
 *   ESPERA=3500          ms reais de espera depois de carregar a origem.
 *   LENTO=1              rede lenta a partir do gatilho (latência 1500 ms,
 *                        50 kB/s): chunk frio, barra de rota. Com ESCALA=1.
 *   REDUZIR_MOVIMENTO=1  emula `prefers-reduced-motion: reduce`. Com ESCALA=1.
 *   SEM_SCRIPT=1         desliga o JS antes de navegar: fotografa o HTML do
 *                        servidor (o esqueleto da casca). Sem gatilho nem sonda.
 *   REPOUSO=1            ao final, conta os elementos sob `.chegada` com
 *                        transform/filter/will-change residual (fora da
 *                        allowlist) e diz se a janela `[data-entrando]` fechou.
 *   CONSOLE=1            imprime os últimos erros/avisos do console da página.
 *   CHROME=<exe>         caminho do Chrome (padrão: Program Files).
 *
 * Saída, uma linha por foto:
 *   t=300ms (real 3004ms → 300ms) gravado <prefixo>-300ms.png · <sonda>
 */

import { spawn } from "node:child_process";
import crypto from "node:crypto";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const CHROME = process.env.CHROME || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = Number(process.env.CDP_PORT || 9457);
const ESCALA = Number(process.env.ESCALA || 10);
const ESPERA = Number(process.env.ESPERA || 3500);
const BASE_SAIDA = process.env.SAIDA || path.join(os.tmpdir(), "movimento");

const [url, gatilho, prefixo, temposArg, wArg, hArg, sonda] = process.argv.slice(2);
if (!url || !gatilho || !prefixo) {
  console.error("uso: node scripts/capturar-movimento.mjs <urlOrigem> <gatilhoJs> <prefixo> [tempos] [W] [H] [sondaJs]");
  process.exit(2);
}
const W = Number(wArg || 1440);
const H = Number(hArg || 900);
const TEMPOS = (temposArg || "0,30,75,150,300,450,600,1200").split(",").map(Number);
const PREFIXO = path.isAbsolute(prefixo) ? prefixo : path.resolve(BASE_SAIDA, prefixo);

/* Os tokens de tempo que a escala multiplica (valores de tokens.css, em ms).
   Só os de MOVIMENTO: os prazos de aviso ficam de fora de propósito. */
const TOKENS_DE_TEMPO = {
  "--dur-1": 150,
  "--dur-2": 300,
  "--dur-3": 500,
  "--dur-4": 700,
  "--dur-passo": 30,
  "--dur-cascata": 1000,
  "--dur-progresso": 1800,
  "--dur-realce": 1500,
  "--dur-pulso": 1500,
  "--dur-giro": 1000,
};

/* A allowlist do repouso: folhas em que transform em repouso é permitido
   (CHECKLIST-MOVIMENTO, item 5). */
const REPOUSO_PERMITIDO = [".seta-recolhe", ".chave-polegar", ".capa-orbe", ".girando", ".trilho-luz", ".barra-progresso", ".regua-tempo"];

function getJSON(rota) {
  return new Promise((resolve, reject) => {
    http
      .get({ host: "127.0.0.1", port: PORT, path: rota }, (res) => {
        let dados = "";
        res.on("data", (c) => (dados += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(dados));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function esperaDevtools(tentativas = 60) {
  for (let i = 0; i < tentativas; i++) {
    try {
      return await getJSON("/json/version");
    } catch {
      await dormir(300);
    }
  }
  throw new Error("devtools não subiu na porta " + PORT);
}

/** WebSocket mínimo (cliente RFC 6455, sem extensões) para não depender de pacote externo. */
function conectar(urlWs) {
  const u = new URL(urlWs);
  return new Promise((resolve, reject) => {
    const sock = net.connect(Number(u.port), u.hostname, () => {
      const chave = crypto.randomBytes(16).toString("base64");
      sock.write(
        "GET " + u.pathname + " HTTP/1.1\r\nHost: " + u.host + "\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n" +
          "Sec-WebSocket-Key: " + chave + "\r\nSec-WebSocket-Version: 13\r\n\r\n",
      );
    });
    let buf = Buffer.alloc(0);
    let aberto = false;
    const em = new EventEmitter();
    em.send = (txt) => {
      const carga = Buffer.from(txt);
      const cab = [0x81];
      const mask = crypto.randomBytes(4);
      if (carga.length < 126) cab.push(0x80 | carga.length);
      else if (carga.length < 65536) cab.push(0x80 | 126, carga.length >> 8, carga.length & 255);
      else cab.push(0x80 | 127, 0, 0, 0, 0, (carga.length >>> 24) & 255, (carga.length >>> 16) & 255, (carga.length >>> 8) & 255, carga.length & 255);
      const m = Buffer.from(carga);
      for (let i = 0; i < m.length; i++) m[i] ^= mask[i % 4];
      sock.write(Buffer.concat([Buffer.from(cab), mask, m]));
    };
    em.close = () => sock.destroy();
    sock.on("data", (d) => {
      buf = Buffer.concat([buf, d]);
      if (!aberto) {
        const fim = buf.indexOf("\r\n\r\n");
        if (fim < 0) return;
        aberto = true;
        buf = buf.subarray(fim + 4);
        resolve(em);
      }
      while (buf.length >= 2) {
        const len0 = buf[1] & 127;
        let off = 2;
        let len = len0;
        if (len0 === 126) {
          if (buf.length < 4) return;
          len = buf.readUInt16BE(2);
          off = 4;
        } else if (len0 === 127) {
          if (buf.length < 10) return;
          len = Number(buf.readBigUInt64BE(2));
          off = 10;
        }
        if (buf.length < off + len) return;
        const carga = buf.subarray(off, off + len);
        buf = buf.subarray(off + len);
        em.emit("message", carga);
      }
    });
    sock.on("error", reject);
  });
}

async function principal() {
  fs.mkdirSync(path.dirname(PREFIXO), { recursive: true });
  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), "cdp-"));
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      "--remote-debugging-port=" + PORT,
      "--user-data-dir=" + perfil,
      "about:blank",
    ],
    { stdio: "ignore", detached: false },
  );
  try {
    await esperaDevtools();
    const lista = await getJSON("/json/list");
    const alvo = lista.find((t) => t.type === "page");
    if (!alvo) throw new Error("nenhum alvo de página");
    const ws = await conectar(alvo.webSocketDebuggerUrl);
    let id = 0;
    const pendentes = new Map();
    const consola = [];
    ws.on("message", (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.id && pendentes.has(m.id)) {
        pendentes.get(m.id)(m);
        pendentes.delete(m.id);
      }
      if (m.method === "Runtime.consoleAPICalled" && (m.params.type === "error" || m.params.type === "warning")) {
        consola.push(m.params.type + ": " + m.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 600));
      }
      if (m.method === "Runtime.exceptionThrown") {
        consola.push("exception: " + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 600));
      }
    });
    const send = (method, params) =>
      new Promise((res) => {
        const i = ++id;
        pendentes.set(i, res);
        ws.send(JSON.stringify({ id: i, method, params: params || {} }));
      });
    const avaliar = async (expression) => {
      const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (r.result.exceptionDetails) {
        throw new Error("avaliar falhou: " + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text));
      }
      return r.result.result.value;
    };

    await send("Page.enable");
    await send("Runtime.enable");
    await send("Emulation.setFocusEmulationEnabled", { enabled: true });
    await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
    if (process.env.SEM_SCRIPT) await send("Emulation.setScriptExecutionDisabled", { value: true });
    if (process.env.REDUZIR_MOVIMENTO) {
      await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    }

    // A escala entra por uma folha do INSPETOR (fora do DOM: o React não a vê
    // na hidratação), com !important sobre os tokens, repetida logo depois de
    // cada navegação — antes de o JS guardar o primeiro valor lido de cada token.
    await send("DOM.enable");
    await send("CSS.enable");
    const cssEscala = ":root{" + Object.entries(TOKENS_DE_TEMPO).map(([k, v]) => k + ":" + v * ESCALA + "ms !important;").join("") + "}";
    const escalar = async () => {
      if (ESCALA === 1) return;
      for (const espera of [30, 150, 400, 900]) {
        await dormir(espera);
        try {
          const arvore = await send("Page.getFrameTree");
          const frameId = arvore.result.frameTree.frame.id;
          const folha = await send("CSS.createStyleSheet", { frameId });
          if (folha.result && folha.result.styleSheetId) {
            await send("CSS.setStyleSheetText", { styleSheetId: folha.result.styleSheetId, text: cssEscala });
          }
        } catch {
          // a navegação pode ter trocado o frame no meio: a próxima rodada cobre
        }
      }
    };

    const base = new URL(url).origin;
    for (const rota of (process.env.PREWARM || "").split(",").filter(Boolean)) {
      await send("Page.navigate", { url: base + rota });
      await escalar();
      await dormir(4000);
    }
    await send("Page.navigate", { url });
    await escalar();
    await dormir(ESPERA);
    const hidratado = process.env.SEM_SCRIPT ? false : await avaliar("!!document.querySelector('.chegada, [data-entrando]')");
    console.log("origem hidratada: " + hidratado);
    // deixa a chegada da origem assentar por completo antes do gatilho
    await dormir(Math.min(1200 * ESCALA, 15000));

    if (process.env.LENTO) {
      await send("Network.enable");
      await send("Network.emulateNetworkConditions", { offline: false, latency: 1500, downloadThroughput: 50000, uploadThroughput: 50000 });
    }
    const resultadoGatilho = process.env.SEM_SCRIPT ? null : await avaliar(gatilho);
    const t0 = Date.now();
    const dur2 = process.env.SEM_SCRIPT ? "(sem script)" : await avaliar("getComputedStyle(document.documentElement).getPropertyValue('--dur-2')");
    console.log("gatilho: " + JSON.stringify(resultadoGatilho) + " · --dur-2 efetivo: " + dur2);

    for (const t of TEMPOS) {
      const alvoReal = t0 + t * ESCALA;
      const falta = alvoReal - Date.now();
      if (falta > 0) await dormir(falta);
      const real = Date.now() - t0;
      let leitura = "";
      if (sonda && !process.env.SEM_SCRIPT) {
        try {
          leitura = " · " + JSON.stringify(await avaliar(sonda));
        } catch (e) {
          leitura = " · sonda falhou: " + e.message;
        }
      }
      const foto = await send("Page.captureScreenshot", { format: "png" });
      const arquivo = `${PREFIXO}-${t}ms.png`;
      fs.writeFileSync(arquivo, Buffer.from(foto.result.data, "base64"));
      console.log(`t=${t}ms (real ${real}ms → ${(real / ESCALA).toFixed(0)}ms) gravado ${arquivo}` + leitura);
    }

    if (process.env.REPOUSO && !process.env.SEM_SCRIPT) {
      const r = await avaliar(`(() => {
        const ignorar = ${JSON.stringify(REPOUSO_PERMITIDO)};
        const raiz = document.querySelector('.chegada') || document.body;
        const sobras = [];
        for (const el of raiz.querySelectorAll('*')) {
          if (ignorar.some((s) => el.matches(s))) continue;
          const cs = getComputedStyle(el);
          if (cs.transform !== 'none' || cs.filter !== 'none' || cs.willChange !== 'auto') {
            sobras.push(el.tagName.toLowerCase() + '.' + [...el.classList].slice(0, 3).join('.') + ' t=' + cs.transform + ' f=' + cs.filter);
          }
        }
        return { sobras: sobras.slice(0, 20), total: sobras.length, entrando: !!document.querySelector('.chegada[data-entrando]'), pathname: location.pathname };
      })()`);
      console.log("repouso: " + JSON.stringify(r));
    }
    if (process.env.CONSOLE) {
      console.log("console (" + consola.length + "):");
      for (const c of consola.slice(-12)) console.log("  " + c);
    }
    ws.close();
  } finally {
    await new Promise((r) => {
      chrome.once("exit", r);
      chrome.kill();
      setTimeout(r, 2000);
    });
    try {
      fs.rmSync(perfil, { recursive: true, force: true });
    } catch {
      // o Chrome ainda pode segurar o perfil por um instante; o SO limpa o tmp
    }
  }
}

principal().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
