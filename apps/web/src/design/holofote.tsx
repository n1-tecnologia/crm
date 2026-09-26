"use client";

/**
 * HOLOFOTE — uma luz branca e suave que segue o cursor no contêiner pai: o
 * `Spotlight` do ibelick que veio com o componente do robô, refeito no sistema
 * de movimento do app.
 *
 * Histórico: entrou em 2026-09-23 POR CIMA do palco e saiu no mesmo dia ("por
 * que o efeito de hover do brilho voltou?"); voltou no fim do dia, a pedido e
 * ATRÁS do robô ("quero que o efeito de luz esteja vinculado ao mouse na tela
 * de início, assim como no padrão do prompt do robô; a luz deve passar sempre
 * atrás do robô"). Quem o usa o põe PRIMEIRO no contêiner, antes da cena: o
 * canvas do Spline é transparente fora do robô, então a luz aparece no preto
 * e some atrás do corpo dele — contorna a silhueta, nunca a cobre.
 *
 * O original usa `framer-motion` (uma mola por eixo) e classes de cor e de
 * duração cruas (`from-zinc-50`, `duration-200`), que a sentinela reprova.
 * Aqui a MOLA é a inércia que o resto do app já usa (a fração por quadro,
 * corrigida pelo passo real de tempo — igual a 60, 120 ou 144 Hz), a cor e o
 * tamanho vêm de token, o acender é `opacity` por `--dur-2` e a posição é
 * `transform` escrito na própria peça, fora do render do React. Sem
 * dependência nova.
 *
 * O laço só roda enquanto a luz está a caminho: parou, parou o
 * `requestAnimationFrame`.
 *
 * Movimento reduzido: não acende. Sem ponteiro fino (toque): também não — no
 * toque não há `pointerleave` confiável, e a luz ficaria estacionada.
 * Decoração: `aria-hidden`, sem clique.
 */

import { useEffect, useRef } from "react";
import { cn } from "./cn";
import { reduzido } from "./movimento";

/** Fração do caminho vencida por quadro a 60 Hz (a "mola" sem salto do original). */
const INERCIA = 0.18;
/** O quadro de referência da inércia, em ms. */
const QUADRO_BASE = 16.7;
/** Teto do passo de tempo, em ms: a aba volta sem um salto. */
const PASSO_MAXIMO = 50;
/** Abaixo disto (px) a luz chegou: o laço para. */
const CHEGOU = 0.4;

export function Holofote({ className }: { readonly className?: string }) {
  const luz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const peca = luz.current;
    const pai = peca?.parentElement;
    if (!peca || !pai) return;
    if (reduzido()) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    let alvoX = 0;
    let alvoY = 0;
    let x = 0;
    let y = 0;
    let quadro = 0;
    let anterior = 0;
    let nasceu = false;

    const escrever = () => {
      // O centro da luz no ponteiro: metade do tamanho medido, não um número repetido.
      peca.style.transform = `translate(${(x - peca.offsetWidth / 2).toFixed(1)}px, ${(y - peca.offsetHeight / 2).toFixed(1)}px)`;
    };

    const laco = (agora: number) => {
      const dt = anterior ? Math.min(agora - anterior, PASSO_MAXIMO) : QUADRO_BASE;
      anterior = agora;
      const k = 1 - (1 - INERCIA) ** (dt / QUADRO_BASE);
      x += (alvoX - x) * k;
      y += (alvoY - y) * k;
      escrever();
      if (Math.abs(alvoX - x) < CHEGOU && Math.abs(alvoY - y) < CHEGOU) {
        quadro = 0;
        anterior = 0;
        return;
      }
      quadro = requestAnimationFrame(laco);
    };

    const aoMover = (e: PointerEvent) => {
      const r = pai.getBoundingClientRect();
      alvoX = e.clientX - r.left;
      alvoY = e.clientY - r.top;
      // A primeira posição não desliza desde o canto: a luz nasce no ponteiro.
      if (!nasceu) {
        x = alvoX;
        y = alvoY;
        nasceu = true;
        escrever();
      }
      peca.dataset.aceso = "true";
      if (!quadro) quadro = requestAnimationFrame(laco);
    };
    const aoEntrar = () => {
      peca.dataset.aceso = "true";
    };
    const aoSair = () => {
      delete peca.dataset.aceso;
      nasceu = false;
    };

    pai.addEventListener("pointermove", aoMover, { passive: true });
    pai.addEventListener("pointerenter", aoEntrar);
    pai.addEventListener("pointerleave", aoSair);
    return () => {
      cancelAnimationFrame(quadro);
      pai.removeEventListener("pointermove", aoMover);
      pai.removeEventListener("pointerenter", aoEntrar);
      pai.removeEventListener("pointerleave", aoSair);
    };
  }, []);

  return <div ref={luz} className={cn("holofote", className)} aria-hidden="true" />;
}
