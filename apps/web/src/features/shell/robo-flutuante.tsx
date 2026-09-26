"use client";

/**
 * O ROBÔ FLUTUANTE (2026-09-24: "quando o user mudar de tela, quero que o robô
 * passe a ser um botão flutuante no canto inferior direito; o robô deve estar
 * dentro de um círculo pequeno e, quando clicar nele, o user volta para a tela
 * de início").
 *
 * Fora do Início, o robô vira um círculo pequeno no canto inferior direito —
 * um link para "/". O rosto é uma IMAGEM tirada da própria cena do Início
 * (`public/inicio/robo.webp`, 256 px, a cabeça de frente sobre o preto do
 * palco), não uma segunda cena 3D: a cena custa ~1,3 MB e um contexto WebGL, e
 * num círculo de 56 px ninguém veria a diferença.
 *
 * Mora na casca (irmão de `<main>`), então fica montado de uma tela para a
 * outra: o "pop" de chegada só toca quando se sai do Início, não a cada troca
 * de tela. No Início ele não existe ENQUANTO o robô de verdade está no palco;
 * desde 2026-09-24 o Início rola, e com o robô do palco fora da vista (ele sai
 * pela rolagem — `features/inicio/saida-do-palco.ts`) o flutuante aparece no
 * canto também ali: tocá-lo não navega, VOLTA ao palco (rola ao topo e leva
 * o foco ao título — `palco-do-inicio.ts`).
 *
 * O CANTO É DELE — e nada que se usa fica por baixo:
 *  - uma DOCA (a barra de escrever colada no pé da tela — a da Conversa, a
 *    dos comentários da Tarefa, a do teste do Agente) declara
 *    `.doca-do-robo`; quando ela chega ao canto, o robô escreve nela
 *    `--robo-flutuante-recuo` e o conteúdo dela termina ANTES dele: o robô
 *    fica ao lado do enviar, não em cima. Subir o robô acima da barra o
 *    poria sobre a última mensagem enviada (que se alinha à direita).
 *    Uma doca ESTREITA (a coluna dos comentários da Tarefa, ~300 px), que o
 *    recuo espremeria, declara `data-robo="acima"`: o robô sobe acima dela
 *    (`--robo-flutuante-elevacao`, nele mesmo), e o que rola sob ele na
 *    nova altura ganha a reserva do item de baixo.
 *  - o que ROLA sob o robô (quase sempre o `.corpo-de-tela`; às vezes o
 *    próprio `<main>`) ganha, no fim, a reserva do robô
 *    (`data-reserva-do-robo`): o último controle da tela (o "Mostrar mais"
 *    de uma tabela) sobe acima dele. Acha-se o rolador pelo que está sob o
 *    centro do robô, subindo pelos ancestrais. O que não rola não ganha nada
 *    — senão uma tela de altura cheia passaria a rolar.
 *  - com um diálogo por cima do robô (o véu o cobre), a medida não roda:
 *    nada muda por baixo do véu.
 * A medida roda num quadro de animação quando o `<main>` muda (mutação ou
 * tamanho), quando uma doca muda de tamanho e quando a janela muda.
 *
 * Só depois da hidratação, junto com o miolo da tela (antes, o esqueleto).
 */

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useHidratado } from "./hidratado";
import { marcarSeMuda } from "./navegacao";
import { useRoboForaDoPalco, voltarAoPalco } from "./palco-do-inicio";

/** O rosto do robô, tirado da cena do Início. */
const ROSTO_DO_ROBO = "/inicio/robo.webp";
/** O lado da imagem em px CSS (o círculo mede `--robo-flutuante-tam`). */
const LADO = 56;
/** A folga entre o robô e o que ele afasta, em px — o `--e-3` do sistema. */
const FOLGA = 12;
const RECUO = "--robo-flutuante-recuo";
const ELEVACAO = "--robo-flutuante-elevacao";
const RESERVA = "data-reserva-do-robo";

/**
 * O rolador sob o robô: o primeiro ancestral (inclusive) que rola na vertical
 * — ou que já tem a reserva (rolava antes dela). Até o `<main>`, nunca acima.
 */
function roladorSob(el: Element | null): HTMLElement | null {
  for (let atual = el; atual instanceof HTMLElement; atual = atual.parentElement) {
    if (atual.hasAttribute(RESERVA)) return atual;
    const rola = /(auto|scroll)/.test(getComputedStyle(atual).overflowY) && atual.scrollHeight > atual.clientHeight + 1;
    if (rola) return atual;
    if (atual.tagName === "MAIN") return null;
  }
  return null;
}

export function RoboFlutuante() {
  const pathname = usePathname();
  const hidratado = useHidratado();
  const foraDoPalco = useRoboForaDoPalco();
  const noInicio = pathname === "/";
  const visivel = hidratado && (!noInicio || foraDoPalco);
  const rotulo = noInicio ? "Voltar ao robô" : "Voltar ao Início";
  const robo = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const botao = robo.current;
    const main = document.querySelector("main");
    if (!visivel || !botao || !main) return;
    let quadro = 0;
    const tamanhos = new ResizeObserver(() => agendar());
    const docas = () => Array.from(document.querySelectorAll<HTMLElement>(".doca-do-robo"));

    function medir() {
      quadro = 0;
      if (!botao || !main) return;
      const raiz = document.documentElement;
      const largura = raiz.clientWidth;
      const altura = raiz.clientHeight;
      const lado = botao.offsetWidth;
      // A margem é a mesma nos dois cantos (`--robo-flutuante-margem`): lida
      // no `right`, porque o `bottom` já traz a elevação.
      const margem = parseFloat(getComputedStyle(botao).right) || 0;
      // O canto EM REPOUSO, com a folga (medir pela posição elevada faria a
      // doca "acima" sair do canto e o robô descer e subir sem parar).
      const esquerda = largura - margem - lado - FOLGA;
      const topo = altura - margem - lado - FOLGA;
      // As docas que chegam ao canto: a comum encolhe (recuo); a "acima" levanta o robô.
      let elevacao = 0;
      const recuos = new Map<HTMLElement, number>();
      for (const doca of docas()) {
        tamanhos.observe(doca);
        const caixa = doca.getBoundingClientRect();
        const alcanca = caixa.width > 0 && caixa.bottom > topo && caixa.top < altura && caixa.right > esquerda;
        if (!alcanca) continue;
        if (doca.dataset.robo === "acima") elevacao = Math.max(elevacao, Math.ceil(altura - caixa.top + FOLGA - margem));
        else recuos.set(doca, Math.ceil(caixa.right - esquerda));
      }
      // O que está sob o centro do robô, onde ele VAI ficar. Um diálogo por
      // cima (o véu antes dele na pilha): a medida não roda, e nada muda por
      // baixo do véu. A caminho da nova altura, o robô ainda não está no
      // ponto: segue.
      const pilha = document.elementsFromPoint(largura - margem - lado / 2, altura - margem - elevacao - lado / 2);
      if (pilha.findIndex((el) => botao.contains(el)) > 0) return;
      for (const doca of docas()) {
        const recuo = recuos.get(doca);
        if (recuo === undefined) doca.style.removeProperty(RECUO);
        else doca.style.setProperty(RECUO, `${recuo}px`);
      }
      if (elevacao > 0) botao.style.setProperty(ELEVACAO, `${elevacao}px`);
      else botao.style.removeProperty(ELEVACAO);
      // A reserva no fim do que rola sob o robô — só se ele rola SEM ela.
      const rolador = roladorSob(pilha.find((el) => !botao.contains(el)) ?? null);
      for (const antigo of document.querySelectorAll<HTMLElement>(`[${RESERVA}]`)) {
        if (antigo !== rolador) antigo.removeAttribute(RESERVA);
      }
      if (rolador) {
        if (rolador.firstElementChild) tamanhos.observe(rolador.firstElementChild);
        const reservaAtual = rolador.hasAttribute(RESERVA) ? parseFloat(getComputedStyle(rolador, "::after").height) || 0 : 0;
        rolador.toggleAttribute(RESERVA, rolador.scrollHeight - reservaAtual > rolador.clientHeight + 1);
      }
    }
    function agendar() {
      if (!quadro) quadro = requestAnimationFrame(medir);
    }

    const mudancas = new MutationObserver(agendar);
    mudancas.observe(main, { childList: true, subtree: true });
    tamanhos.observe(main);
    window.addEventListener("resize", agendar);
    agendar();
    return () => {
      cancelAnimationFrame(quadro);
      mudancas.disconnect();
      tamanhos.disconnect();
      window.removeEventListener("resize", agendar);
      for (const doca of docas()) doca.style.removeProperty(RECUO);
      for (const marcado of document.querySelectorAll(`[${RESERVA}]`)) marcado.removeAttribute(RESERVA);
    };
  }, [visivel]);

  if (!visivel) return null;
  return (
    <Link
      ref={robo}
      href="/"
      onNavigate={() => marcarSeMuda("/")}
      // No Início, o robô volta ao palco em vez de navegar para a mesma rota.
      onClick={(evento) => {
        if (noInicio && voltarAoPalco()) evento.preventDefault();
      }}
      aria-label={rotulo}
      title={rotulo}
      className="robo-flutuante"
    >
      {/* Sem o otimizador: a fonte já é um WebP de 7 KB em 256 px, e o
          navegador reduz melhor que um 64 px recodificado a 75 % (os olhos são
          uma grade de pontos que o reencode borra). */}
      <Image src={ROSTO_DO_ROBO} alt="" width={LADO} height={LADO} unoptimized className="robo-flutuante-rosto" />
    </Link>
  );
}
