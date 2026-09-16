"use client";

import { useEffect, useRef } from "react";
import { cn } from "./cn";

/**
 * GLOBO DE PONTOS — o "Jarvis" da capa.
 *
 * Uma esfera de pontos que gira devagar, inclina em direção ao cursor e acende
 * os pontos perto dele; dois anéis de órbita giram em sentidos opostos. É
 * decoração com uma função: quem clica fala com o Assistente.
 *
 * Desenhado em `<canvas>` 2D — 1.100 pontos a 60 quadros é barato, e não
 * arrasta uma biblioteca 3D para dentro do bundle por um enfeite. As cores
 * saem dos tokens do sistema em tempo de execução (`getComputedStyle`), nunca
 * escritas aqui: a sentinela reprova cor crua em TSX, e a regra vale para
 * canvas também. O alfa é `globalAlpha`, por isso o hex do token serve inteiro.
 *
 * Movimento reduzido: desenha um quadro parado e não anima. Aba escondida:
 * `requestAnimationFrame` já para sozinho.
 */

type Ponto = { readonly x: number; readonly y: number; readonly z: number };

/** Pontos distribuídos uniformemente na esfera — espiral de Fibonacci. */
function esfera(quantidade: number): Ponto[] {
  const pontos: Ponto[] = [];
  const dourado = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < quantidade; i++) {
    const y = 1 - (i / (quantidade - 1)) * 2;
    const raio = Math.sqrt(1 - y * y);
    const angulo = dourado * i;
    pontos.push({ x: Math.cos(angulo) * raio, y, z: Math.sin(angulo) * raio });
  }
  return pontos;
}

const PONTOS = 1100;
/** Quão perto do cursor um ponto acende, em fração do raio. */
const ALCANCE = 0.55;

export function GloboDePontos({ className, ...resto }: React.HTMLAttributes<HTMLDivElement>) {
  const caixa = useRef<HTMLDivElement>(null);
  const tela = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = tela.current;
    const raiz = caixa.current;
    if (!canvas || !raiz) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const estilo = getComputedStyle(raiz);
    const cor = estilo.getPropertyValue("--acento").trim();
    const corClara = estilo.getPropertyValue("--texto").trim();
    const corAnel = estilo.getPropertyValue("--roxo-500").trim();
    const parado = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const pontos = esfera(PONTOS);
    let largura = 0;
    let altura = 0;
    let dpr = 1;

    // O cursor, em coordenadas do canvas; longe = nenhum efeito.
    let mouseX = Number.NaN;
    let mouseY = Number.NaN;
    // A inclinação alvo (segue o mouse) e a atual (com inércia).
    let alvoX = 0;
    let alvoY = 0;
    let inclX = 0;
    let inclY = 0;
    let giro = 0;
    let quadro = 0;

    const medir = () => {
      const r = raiz.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      largura = r.width;
      altura = r.height;
      canvas.width = Math.round(largura * dpr);
      canvas.height = Math.round(altura * dpr);
      canvas.style.width = `${largura}px`;
      canvas.style.height = `${altura}px`;
    };

    const desenhar = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, largura, altura);
      const cx = largura / 2;
      const cy = altura / 2;
      const raio = Math.min(largura, altura) * 0.4;

      // A inclinação segue o cursor com inércia; sem cursor, volta ao centro.
      inclX += (alvoX - inclX) * 0.06;
      inclY += (alvoY - inclY) * 0.06;
      const rotY = giro + inclY;
      const rotX = inclX;
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);

      // O halo atrás da esfera: desfocado, senão vira um disco chapado.
      const halo = ctx.createRadialGradient(cx, cy, raio * 0.1, cx, cy, raio * 1.1);
      halo.addColorStop(0, cor);
      halo.addColorStop(1, corAnel);
      ctx.save();
      ctx.filter = "blur(22px)";
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, raio * 1.05, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Os anéis de órbita, em sentidos opostos.
      ctx.lineWidth = 1;
      ctx.strokeStyle = cor;
      for (const [inclinacao, sentido, escala] of [
        [0.35, 1, 1.22],
        [-0.55, -1, 1.38],
      ] as const) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(inclinacao + sentido * giro * 0.35);
        ctx.globalAlpha = 0.5;
        ctx.setLineDash([2, 6]);
        ctx.beginPath();
        ctx.ellipse(0, 0, raio * escala, raio * escala * 0.32, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.setLineDash([]);

      // Os pontos: os da frente maiores e mais claros; os perto do cursor acendem.
      const temMouse = !Number.isNaN(mouseX);
      const alcance = raio * ALCANCE;
      for (const p of pontos) {
        // Gira em Y, depois inclina em X.
        const x1 = p.x * cosY - p.z * sinY;
        const z1 = p.x * sinY + p.z * cosY;
        const y1 = p.y * cosX - z1 * sinX;
        const z2 = p.y * sinX + z1 * cosX;
        // Perspectiva leve: o que está na frente (z2 > 0) cresce um pouco.
        const perspectiva = 1 + z2 * 0.18;
        const sx = cx + x1 * raio * perspectiva;
        const sy = cy + y1 * raio * perspectiva;
        const profundidade = (z2 + 1) / 2; // 0 atrás, 1 na frente

        let tamanho = 0.7 + profundidade * 1.5;
        let alfa = 0.08 + profundidade * profundidade * 0.85;
        let tinta = cor;

        if (temMouse && z2 > -0.15) {
          const dx = sx - mouseX;
          const dy = sy - mouseY;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < alcance) {
            const forca = 1 - d / alcance;
            tamanho += forca * 2.2;
            alfa = Math.min(1, alfa + forca * 0.9);
            if (forca > 0.45) tinta = corClara;
          }
        }

        ctx.globalAlpha = alfa;
        ctx.fillStyle = tinta;
        ctx.beginPath();
        ctx.arc(sx, sy, tamanho, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const laco = () => {
      giro += 0.0028;
      desenhar();
      quadro = requestAnimationFrame(laco);
    };

    const aoMover = (e: PointerEvent) => {
      const r = raiz.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const cx = r.width / 2;
      const cy = r.height / 2;
      const raio = Math.min(r.width, r.height) * 0.4;
      const dist = Math.hypot(x - cx, y - cy);
      // Até 2,2 raios de distância o globo ainda "olha" para o cursor; além, dorme.
      if (dist < raio * 2.2) {
        mouseX = x;
        mouseY = y;
        alvoY = ((x - cx) / raio) * 0.45;
        alvoX = ((y - cy) / raio) * 0.35;
      } else {
        mouseX = Number.NaN;
        mouseY = Number.NaN;
        alvoX = 0;
        alvoY = 0;
      }
    };
    const aoSair = () => {
      mouseX = Number.NaN;
      mouseY = Number.NaN;
      alvoX = 0;
      alvoY = 0;
    };

    medir();
    const observador = new ResizeObserver(() => {
      medir();
      if (parado) desenhar();
    });
    observador.observe(raiz);

    if (parado) {
      desenhar();
    } else {
      window.addEventListener("pointermove", aoMover, { passive: true });
      window.addEventListener("pointerleave", aoSair);
      document.addEventListener("pointerleave", aoSair);
      quadro = requestAnimationFrame(laco);
    }

    return () => {
      cancelAnimationFrame(quadro);
      observador.disconnect();
      window.removeEventListener("pointermove", aoMover);
      window.removeEventListener("pointerleave", aoSair);
      document.removeEventListener("pointerleave", aoSair);
    };
  }, []);

  return (
    // O canvas preenche a caixa por tamanho, não por posição: assim quem chama
    // decide como a caixa se posiciona (absoluta na capa, em fluxo em outro lugar)
    // sem que `relative` daqui brigue com o `absolute` de lá.
    <div ref={caixa} className={cn(className)} {...resto}>
      <canvas ref={tela} className="block h-full w-full" aria-hidden="true" />
    </div>
  );
}
