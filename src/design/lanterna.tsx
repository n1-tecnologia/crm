"use client";

import { useEffect, useRef } from "react";
import { cn } from "./cn";

/**
 * LANTERNA — o efeito-assinatura do design system.
 *
 * Um aro cônico roxo na borda do cartão, cujo ângulo segue o cursor e cuja
 * opacidade cai conforme ele se afasta. O CSS mora em `estilos/componentes.css`;
 * aqui só alimentamos as duas variáveis que ele lê.
 *
 * POR QUE UM CONTÊINER, E NÃO UM COMPONENTE POR CARTÃO
 * Numa tela com 60 cartões seriam 60 listeners disparando a cada pixel do
 * mouse. Aqui existe UM listener no contêiner, que percorre os filhos marcados e
 * escreve as variáveis via `style.setProperty` — fora do ciclo de render do
 * React, para não repintar nada.
 *
 * Só em superfícies de destaque — cartão de indicador, de módulo, de Painel.
 * Nunca em linha de tabela nem em lista densa.
 */

/** Distância, em px, em que o brilho já sumiu por completo. */
const QUEDA = 220;

export function CampoDeLanterna({
  children,
  className,
  ...resto
}: React.HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const raiz = ref.current;
    if (!raiz) return;

    // Sem ponteiro fino (celular, tablet) o efeito nunca dispara, então nem
    // vale registrar o listener.
    const finoEPreciso = window.matchMedia("(hover: hover) and (pointer: fine)");
    const semMovimento = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!finoEPreciso.matches || semMovimento.matches) return;

    let pendente = false;
    let ultimoX = 0;
    let ultimoY = 0;

    function aplicar() {
      pendente = false;
      const raizAtual = ref.current;
      if (!raizAtual) return;

      const alvos = raizAtual.querySelectorAll<HTMLElement>(".lanterna");
      for (const alvo of alvos) {
        const r = alvo.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = ultimoX - cx;
        const dy = ultimoY - cy;

        // O `+ 90` alinha o zero do `conic-gradient` (no topo) com o zero do
        // `atan2` (à direita).
        const angulo = (Math.atan2(dy, dx) * 180) / Math.PI + 90;

        // A proximidade é medida contra a BORDA, não contra o centro: o brilho
        // acende quando o cursor encosta na quina, não quando chega ao meio.
        const distancia = Math.hypot(dx, dy);
        const borda = Math.hypot(r.width / 2, r.height / 2);
        const proximidade = Math.max(0, 1 - Math.abs(distancia - borda) / QUEDA);

        alvo.style.setProperty("--angulo", `${angulo}deg`);
        alvo.style.setProperty("--proximidade", proximidade.toFixed(3));
      }
    }

    function aoMover(e: PointerEvent) {
      ultimoX = e.clientX;
      ultimoY = e.clientY;
      if (pendente) return;
      pendente = true;
      requestAnimationFrame(aplicar);
    }

    function aoSair() {
      const raizAtual = ref.current;
      if (!raizAtual) return;
      for (const alvo of raizAtual.querySelectorAll<HTMLElement>(".lanterna")) {
        alvo.style.setProperty("--proximidade", "0");
      }
    }

    window.addEventListener("pointermove", aoMover, { passive: true });
    raiz.addEventListener("pointerleave", aoSair);

    return () => {
      window.removeEventListener("pointermove", aoMover);
      raiz.removeEventListener("pointerleave", aoSair);
    };
  }, []);

  return (
    <div ref={ref} className={cn(className)} {...resto}>
      {children}
    </div>
  );
}
