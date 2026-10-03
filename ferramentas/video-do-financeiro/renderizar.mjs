/**
 * Monta o vídeo com Remotion a partir de `public/gravacao/` (saída de
 * `gravar.mjs`) e grava `saida/financeiro.mp4` (+ o pôster `.jpg`). O Guia
 * do Financeiro toca o que estiver no bucket `guias` do Storage: depois de
 * renderizar, `publicar-no-storage.mjs`.
 *
 *   (nesta pasta) node renderizar.mjs
 */

import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const DESTINO = join(AQUI, "saida");
mkdirSync(DESTINO, { recursive: true });

const roteiro = JSON.parse(readFileSync(join(AQUI, "public", "gravacao", "roteiro.json"), "utf8"));
const inputProps = { roteiro };

console.log("empacotando…");
const serveUrl = await bundle({ entryPoint: join(AQUI, "video", "index.tsx"), publicDir: join(AQUI, "public") });
const composition = await selectComposition({ serveUrl, id: "GuiaDoFinanceiro", inputProps });
console.log(`${(composition.durationInFrames / composition.fps).toFixed(1)} s · ${composition.width}×${composition.height}`);

const mp4 = join(DESTINO, "financeiro.mp4");
let ultimo = -1;
await renderMedia({
  composition,
  serveUrl,
  codec: "h264",
  // 29: ~11 MB para 3 min e meio de tela; a diferença para 24 não se vê na janela do guia.
  crf: 29,
  x264Preset: "slow",
  pixelFormat: "yuv420p",
  outputLocation: mp4,
  inputProps,
  onProgress: ({ progress }) => {
    const pct = Math.floor(progress * 10) * 10;
    if (pct !== ultimo) {
      ultimo = pct;
      console.log(`renderizando ${pct}%`);
    }
  },
});
await renderStill({ composition, serveUrl, output: join(DESTINO, "financeiro.jpg"), frame: 45, inputProps, imageFormat: "jpeg", jpegQuality: 85 });
console.log(`pronto: ${mp4} (${(statSync(mp4).size / 1024 / 1024).toFixed(1)} MB)`);
