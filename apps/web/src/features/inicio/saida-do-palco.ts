"use client";

/**
 * A SAÍDA DO PALCO pela rolagem (2026-09-24: "quando o user rolar para baixo
 * ele deve conseguir fazer o scroll normal e o robô deve ir desaparecendo
 * conforme o scroll, fazendo o efeito reverso de entrada; conforme for
 * rolando, a tela muda e vira uma tela de informações e acesso rápido").
 *
 * O palco é `sticky` no topo do corpo que rola e tem a altura dele (ou a
 * mínima, `--capa-h`, num corpo mais baixo que isso); o resumo vem depois e
 * sobe por cima. A PROGRESSÃO `p` = quanto o corpo rolou ÷ a altura DO PALCO
 * — 0 no topo, 1 quando o resumo cobre o palco inteiro — toca a entrada AO
 * CONTRÁRIO:
 *  - os CONTROLES do palco (a saudação, o botão de voz, a caixa, o balão e o
 *    atalho do resumo) esmaecem primeiro, até `FIM_DOS_CONTROLES`, e deixam
 *    de receber o ponteiro na metade disso;
 *  - a CÂMERA volta ao rosto pela curva da entrada invertida
 *    (`ControleDaCena.definirSaida`) — a entrada recuava do rosto;
 *  - o ROBÔ esmaece e desfoca entre `INICIO_DO_ROBO` e `FIM_DO_ROBO` — o
 *    `revelar` do palco ao contrário, até o desfoque `--chegada-desfoque`;
 *  - o HOLOFOTE apaga assim que a rolagem começa: a luz é do palco, nunca de
 *    conteúdo;
 *  - em p = 1: a cena para de desenhar, a conversa por voz acaba (o robô
 *    sumiu) e o robô flutuante aparece no canto — tocá-lo volta ao topo.
 * Tudo escrito fora do render do React, num quadro de animação por rolagem.
 * Em p = 0 nada fica inline: o palco em repouso é o de sempre.
 *
 * Movimento reduzido: só a opacidade — a câmera não anda e nada desfoca.
 *
 * Foco: um foco que ENTRA no palco vindo de FORA dele, com o corpo fora do
 * topo, rola de volta — o teclado nunca para num controle invisível
 * (Shift+Tab, do resumo, volta ao palco inteiro; o robô flutuante foca o
 * título). Só de fora: um `focusin` sem origem (`relatedTarget` nulo — a caixa
 * do assistente refocando o campo por código, ou o Chrome reanunciando o foco
 * quando a janela volta) não rola nada. Um foco que ficou num CAMPO de texto
 * que sumiu sai dele (digitar às cegas não pode) — só campo: o título do
 * palco, focado na volta, fica com o foco durante a rolagem de volta. Antes
 * de encerrar a conversa em p = 1, o que estiver focado no palco perde o foco
 * (o fim da conversa desmonta controles da caixa; um foco que morre sem
 * `blur` — o Firefox faz isso — deixaria a caixa refocar o campo). E quando o
 * robô flutuante some (p < 0,8) com o foco nele, o foco vai ao título do
 * resumo, não ao `<body>`.
 */

import { useEffect, type RefObject } from "react";
import type { ControleDaCena } from "@/design/cena-spline";
import { reduzido } from "@/design/movimento";
import { marcarRoboForaDoPalco, registrarVoltaAoPalco } from "@/features/shell/palco-do-inicio";
import { ID_DO_TITULO_DO_RESUMO } from "./resumo-do-inicio";

/** Até aqui (fração da altura do palco) os controles do palco somem. */
const FIM_DOS_CONTROLES = 0.25;
/** O robô começa a esmaecer aqui… */
const INICIO_DO_ROBO = 0.15;
/** …e some aqui (a câmera já chegou quase ao rosto em ~0,45). */
const FIM_DO_ROBO = 0.7;
/** Daqui em diante o resumo cobre mais da metade do palco: o corpo passa ao fundo do sistema. */
const CORPO_DO_RESUMO = 0.5;
/** O robô flutuante aparece a partir daqui e some abaixo de `SAI_DO_CANTO`: a folga evita piscar na fronteira. */
const VAI_AO_CANTO = 0.9;
const SAI_DO_CANTO = 0.8;

const faixa = (p: number) => Math.min(1, Math.max(0, p));

/** A rampa suave (0 → 1) entre `de` e `ate`. */
function rampa(de: number, ate: number, p: number): number {
  const t = faixa((p - de) / (ate - de));
  return t * t * (3 - 2 * t);
}

/** As propriedades que a saída escreve no palco (e apaga no topo). */
const PROPRIEDADES = ["--inicio-saida-controles", "--inicio-saida-robo", "--inicio-saida-desfoque"] as const;

export function useSaidaDoPalco({
  palco,
  cena,
  titulo,
  aoSumir,
}: {
  /** O palco (`section.inicio-capa`), filho direto do corpo que rola. */
  readonly palco: RefObject<HTMLElement | null>;
  readonly cena: RefObject<ControleDaCena | null>;
  /** O título do palco (foco ao voltar pelo robô flutuante). */
  readonly titulo: RefObject<HTMLElement | null>;
  /** O que fazer quando o robô some de vez (a conversa por voz acaba). */
  readonly aoSumir: RefObject<(() => void) | null>;
}): void {
  useEffect(() => {
    const capa = palco.current;
    const corpo = capa?.parentElement;
    if (!capa || !corpo) return undefined;
    let quadro = 0;
    let ultimo = -1;
    let pausada = false;
    let sumiu = false;
    let noCanto = false;

    const aplicar = () => {
      quadro = 0;
      // A altura DO PALCO: a do corpo, ou a mínima dele quando o corpo é mais baixo.
      const altura = capa.offsetHeight;
      const p = altura > 0 ? faixa(corpo.scrollTop / altura) : 0;
      if (p === ultimo) return;
      ultimo = p;
      const quieta = reduzido();
      if (p <= 0) {
        capa.removeAttribute("data-saindo");
        for (const propriedade of PROPRIEDADES) capa.style.removeProperty(propriedade);
      } else {
        const robo = rampa(INICIO_DO_ROBO, FIM_DO_ROBO, p);
        capa.setAttribute("data-saindo", "");
        capa.style.setProperty("--inicio-saida-controles", String(1 - faixa(p / FIM_DOS_CONTROLES)));
        capa.style.setProperty("--inicio-saida-robo", String(1 - robo));
        capa.style.setProperty("--inicio-saida-desfoque", String(quieta ? 0 : robo));
      }
      const controlesFora = p >= FIM_DOS_CONTROLES / 2;
      capa.toggleAttribute("data-controles-fora", controlesFora);
      capa.toggleAttribute("data-saiu", p >= 1);
      // O fundo do corpo (a faixa da barra de rolagem, a reserva do robô
      // flutuante no fim) acompanha o que está à vista: o preto do palco, ou
      // o fundo do sistema quando o resumo cobre mais da metade.
      corpo.toggleAttribute("data-no-resumo", p >= CORPO_DO_RESUMO);
      // Um foco que ficou num CAMPO que sumiu sai dele (o da caixa do chat):
      // digitar num campo invisível não pode.
      const focado = document.activeElement;
      if (p >= FIM_DOS_CONTROLES && focado instanceof HTMLElement && capa.contains(focado) && focado.matches("input, textarea, [contenteditable='true']")) {
        focado.blur();
      }
      // A câmera: a entrada ao contrário (movimento reduzido: parada).
      cena.current?.definirSaida(quieta ? 0 : p);
      // A cena fora da vista para de desenhar; voltando, desenha de novo.
      if (p >= 1 && !pausada) {
        pausada = true;
        cena.current?.pausar();
      } else if (p < 1 && pausada) {
        pausada = false;
        cena.current?.retomar();
      }
      // O robô sumiu: a conversa por voz acaba (uma vez por saída). Antes, o
      // que estiver focado no palco solta o foco: o fim da conversa desmonta
      // controles da caixa, e um foco que morre sem `blur` faria a caixa
      // refocar o campo.
      if (p >= 1 && !sumiu) {
        sumiu = true;
        const noPalco = document.activeElement;
        if (noPalco instanceof HTMLElement && capa.contains(noPalco)) noPalco.blur();
        aoSumir.current?.();
      } else if (p < 1) {
        sumiu = false;
      }
      // O robô flutuante no canto, com folga na fronteira. Sumindo com o foco
      // nele, o foco vai ao título do resumo (o robô desmonta no render seguinte).
      if (!noCanto && p >= VAI_AO_CANTO) {
        noCanto = true;
        marcarRoboForaDoPalco(true);
      } else if (noCanto && p < SAI_DO_CANTO) {
        noCanto = false;
        if (document.activeElement?.closest(".robo-flutuante")) {
          document.getElementById(ID_DO_TITULO_DO_RESUMO)?.focus({ preventScroll: true });
        }
        marcarRoboForaDoPalco(false);
      }
    };
    const agendar = () => {
      if (!quadro) quadro = requestAnimationFrame(aplicar);
    };
    const voltarAoTopo = () => corpo.scrollTo({ top: 0, behavior: reduzido() ? "auto" : "smooth" });

    corpo.addEventListener("scroll", agendar, { passive: true });
    // A altura do palco segue a do corpo: mudou (a janela, o menu recolhido),
    // a progressão muda junto.
    const tamanho = new ResizeObserver(() => {
      ultimo = -1;
      agendar();
    });
    tamanho.observe(corpo);
    tamanho.observe(capa);
    // Um foco que ENTRA no palco vindo de fora, com o corpo fora do topo:
    // volta ao palco inteiro. Sem origem (`relatedTarget` nulo), não é uma
    // entrada: é a caixa refocando o campo por código, ou a janela voltando.
    const aoFocar = (evento: FocusEvent) => {
      const de = evento.relatedTarget;
      if (de instanceof Node && !capa.contains(de) && corpo.scrollTop > 0) voltarAoTopo();
    };
    capa.addEventListener("focusin", aoFocar);
    // O robô flutuante, no Início, volta ao palco: o foco no título e o topo.
    const desfazerVolta = registrarVoltaAoPalco(() => {
      titulo.current?.focus({ preventScroll: true });
      voltarAoTopo();
    });
    aplicar();

    return () => {
      cancelAnimationFrame(quadro);
      corpo.removeEventListener("scroll", agendar);
      tamanho.disconnect();
      capa.removeEventListener("focusin", aoFocar);
      desfazerVolta();
      marcarRoboForaDoPalco(false);
      corpo.removeAttribute("data-no-resumo");
    };
  }, [palco, cena, titulo, aoSumir]);
}
