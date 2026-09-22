"use client";

/**
 * MOVIMENTO — o que o JS precisa saber do CSS.
 *
 * O sistema de movimento mora em `estilos/tokens.css` (durações, curva) e em
 * `estilos/componentes.css` (keyframes, chegada, cascata). Este módulo é a
 * ponte para o pouco que roda em JS: fechar a janela da chegada, desmontar um
 * popup depois da saída, contar um número, animar o globo. Nenhuma duração
 * vive aqui — tudo é lido do token, para que mudar um valor em um lugar mude
 * o sistema inteiro, e para que `prefers-reduced-motion` desligue tudo de uma
 * vez (`lerDuracao` devolve 0).
 *
 * Só tempo de LEITURA (o prazo de um aviso) não é movimento: `medidor: true`
 * devolve o valor cheio mesmo com movimento reduzido.
 */

import { useEffect, useRef, useState } from "react";

const PADRAO_EASING: readonly [number, number, number, number] = [0.4, 0, 0.2, 1];

/** Movimento reduzido: preferência do sistema ou o freio da pessoa (`<html data-movimento="minimo">`). */
export function reduzido(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  return (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.dataset.movimento === "minimo"
  );
}

/** `"300ms"` → 300, `"1.5s"` → 1500; qualquer outra coisa → 0. */
export function parseDuracao(texto: string): number {
  const m = /^\s*(-?\d*\.?\d+)\s*(ms|s)\s*$/i.exec(texto);
  if (!m) return 0;
  const n = Number(m[1]);
  return m[2]!.toLowerCase() === "s" ? n * 1000 : n;
}

const DURACOES = new Map<string, number>();

/**
 * A duração de um token (`--dur-2` → 300), em ms. Cache por token: os tokens
 * de tempo não mudam por degrau de tela. `0` no servidor e em movimento
 * reduzido — salvo `medidor`, porque prazo de leitura não é movimento.
 */
export function lerDuracao(token: string, { medidor = false }: { readonly medidor?: boolean } = {}): number {
  if (typeof document === "undefined") return 0;
  if (!medidor && reduzido()) return 0;
  let valor = DURACOES.get(token);
  if (valor === undefined) {
    valor = parseDuracao(getComputedStyle(document.documentElement).getPropertyValue(token));
    DURACOES.set(token, valor);
  }
  return valor;
}

/** `"cubic-bezier(0.4, 0, 0.2, 1)"` → `[0.4, 0, 0.2, 1]`; `null` se não for uma. */
export function parseBezier(texto: string): [number, number, number, number] | null {
  const m = /cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/.exec(texto);
  if (!m) return null;
  const p = m.slice(1, 5).map(Number);
  if (p.some((n) => Number.isNaN(n))) return null;
  return [p[0]!, p[1]!, p[2]!, p[3]!];
}

/** A curva `cubic-bezier(x1, y1, x2, y2)` como função de 0..1 → 0..1 (Newton, com bissecção de segurança). */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const a = (p1: number, p2: number) => 1 - 3 * p2 + 3 * p1;
  const b = (p1: number, p2: number) => 3 * p2 - 6 * p1;
  const c = (p1: number) => 3 * p1;
  const ponto = (t: number, p1: number, p2: number) => ((a(p1, p2) * t + b(p1, p2)) * t + c(p1)) * t;
  const inclinacao = (t: number, p1: number, p2: number) => 3 * a(p1, p2) * t * t + 2 * b(p1, p2) * t + c(p1);
  const linear = x1 === y1 && x2 === y2;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    if (linear) return x;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const s = inclinacao(t, x1, x2);
      if (s === 0) break;
      t -= (ponto(t, x1, x2) - x) / s;
    }
    if (!(t >= 0 && t <= 1) || Math.abs(ponto(t, x1, x2) - x) > 1e-4) {
      let baixo = 0;
      let alto = 1;
      t = x;
      while (alto - baixo > 1e-6) {
        t = (baixo + alto) / 2;
        if (ponto(t, x1, x2) < x) baixo = t;
        else alto = t;
      }
    }
    return ponto(t, y1, y2);
  };
}

const CURVAS = new Map<string, (t: number) => number>();

/** A curva de um token (`--easing` por padrão) como função. Uma curva só, também no canvas e no count-up. */
export function bezierDe(token = "--easing"): (t: number) => number {
  const pronta = CURVAS.get(token);
  if (pronta) return pronta;
  const lida = typeof document === "undefined" ? null : parseBezier(getComputedStyle(document.documentElement).getPropertyValue(token));
  const [x1, y1, x2, y2] = lida ?? PADRAO_EASING;
  const curva = cubicBezier(x1, y1, x2, y2);
  if (typeof document !== "undefined") CURVAS.set(token, curva);
  return curva;
}

/**
 * PRESENÇA — um popup que precisa de um quadro para sair.
 *
 * `open` verdadeiro monta na hora. `open` falso com o nó montado o deixa em
 * `saindo` por `--dur-1` (o CSS toca `sumir`) e só então desmonta. Reabrir
 * durante a saída cancela o timer e volta a `aberto` sem reanimar — o nó é o
 * mesmo. Em movimento reduzido `lerDuracao` devolve 0 e o popup desmonta no
 * tique seguinte. O foco volta ao abridor no instante do fechar, porque
 * `useModal` continua recebendo `open`, não `montado`.
 */
export function usePresenca(open: boolean): { readonly montado: boolean; readonly estado: "aberto" | "saindo" } {
  const [montado, setMontado] = useState(open);
  const [saindo, setSaindo] = useState(false);
  if (open && (!montado || saindo)) {
    setMontado(true);
    setSaindo(false);
  }
  if (!open && montado && !saindo) setSaindo(true);
  useEffect(() => {
    if (!saindo) return;
    const timer = setTimeout(() => {
      setSaindo(false);
      setMontado(false);
    }, lerDuracao("--dur-1"));
    return () => clearTimeout(timer);
  }, [saindo]);
  return { montado, estado: saindo ? "saindo" : "aberto" };
}

/**
 * CONTAGEM — um número que sobe até o valor em `--dur-4` pela curva do
 * sistema. Reage à MUDANÇA do valor (não a re-render): o próximo valor conta a
 * partir do que está na tela. Em movimento reduzido, com a aba escondida ou
 * `ativo: false`, o valor final aparece no primeiro quadro. Só em Painéis, e
 * nunca em mais de 8 nós por tela: quem lê o número precisa dele parado.
 */
export function useContagem(valor: number, { ativo = true }: { readonly ativo?: boolean } = {}): number {
  const [mostrado, setMostrado] = useState(ativo ? 0 : valor);
  const atual = useRef(mostrado);
  useEffect(() => {
    const de = atual.current;
    if (de === valor) return;
    const duracao = ativo && !reduzido() && !document.hidden ? lerDuracao("--dur-4") : 0;
    const curva = bezierDe("--easing");
    const inteiro = Number.isInteger(valor) && Number.isInteger(de);
    let inicio = 0;
    let quadro = requestAnimationFrame(function passo(agora) {
      if (!inicio) inicio = agora;
      const fracao = duracao === 0 ? 1 : Math.min(1, (agora - inicio) / duracao);
      const v = fracao === 1 ? valor : de + (valor - de) * curva(fracao);
      atual.current = inteiro ? Math.round(v) : v;
      setMostrado(atual.current);
      if (fracao < 1) quadro = requestAnimationFrame(passo);
    });
    return () => cancelAnimationFrame(quadro);
  }, [valor, ativo]);
  return mostrado;
}
