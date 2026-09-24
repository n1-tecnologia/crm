"use client";

/**
 * O BOTÃO DE VOZ — no centro à esquerda do palco, um microfone grande que
 * INICIA O BATE-PAPO POR VOZ com o robô (2026-09-23: "no centro à esquerda
 * quero um botão de microfone relativamente grande… quando ativo, quero que
 * ele reaja à captura sonora do microfone com ondas em torno do ícone e então
 * o robô responde").
 *
 * Pressionado, abre o microfone (o mesmo da caixa: um só estado, `useAssistenteDoRobo`);
 * aberto, três ONDAS em volta do ícone crescem com o nível do som captado —
 * lido a cada quadro, com subida na hora e queda lenta —, o robô percebe o
 * fim da fala e responde (com a voz e, silenciado ou com legenda, no balão).
 * Pressionado de novo, desliga.
 *
 * Sem microfone (fim de 2026-09-23: "quando o microfone não puder ser
 * conectado, quero que simule a fala e faça uma conversa entre o robô e a fala
 * simulada, e quando eu pressionar novamente a conversa encerra"): a conversa
 * segue SIMULADA — uma fala com outra voz faz as perguntas, as ondas reagem a
 * ela e o robô responde —, o ícone vira uma onda sonora, e pressionar de novo
 * encerra. Embaixo, o estado em palavras: o motivo curto e o ponto da conversa
 * (o caminho para resolver o microfone fica na dica e no leitor de tela).
 * Não precisa da caixa. Com movimento reduzido as ondas ficam paradas e o
 * texto diz o estado.
 */

import { useEffect, useId, useRef, type CSSProperties } from "react";
import { AudioLines, Loader2, Mic } from "lucide-react";
import { Icone } from "@/design/icone";
import { reduzido } from "@/design/movimento";
import { comoResolver, estadoEmPalavras } from "./frases-do-microfone";
import { sistemaAtual } from "./microfone";
import { MICROFONE_ABERTO, type AssistenteDoRobo } from "./use-assistente-do-robo";

/** O alcance de cada onda: quanto cresce, em fração do botão, com o nível cheio. */
const ONDAS = [0.35, 0.7, 1.05] as const;

/** A queda do nível por quadro: sobe na hora, desce devagar — as ondas respiram, não tremem. */
const DECAIMENTO = 0.88;

export function BotaoDeVoz({ assistente }: { readonly assistente: AssistenteDoRobo }) {
  const { aberto, microfone, simulacao, conversando, alternarMicrofone, respondendo, lerEntrada } = assistente;
  const sistema = sistemaAtual();
  const botao = useRef<HTMLButtonElement>(null);
  const idComoResolver = useId();
  // As ondas: com o microfone aberto, ou com a fala simulada no lugar dele.
  const comOndas = MICROFONE_ABERTO.has(microfone) || simulacao !== null;

  // As ondas leem o nível a cada quadro, só com elas à mostra e sem
  // movimento reduzido (aí ficam paradas e o texto diz o estado).
  useEffect(() => {
    const alvo = botao.current;
    if (!alvo || !comOndas || reduzido()) return undefined;
    let nivel = 0;
    let quadro = 0;
    const passo = () => {
      nivel = Math.max(lerEntrada(), nivel * DECAIMENTO);
      alvo.style.setProperty("--nivel-voz", nivel.toFixed(3));
      quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => {
      cancelAnimationFrame(quadro);
      alvo.style.removeProperty("--nivel-voz");
    };
  }, [comOndas, lerEntrada]);

  const pedindo = microfone === "pedindo";
  const { aviso, agora } = estadoEmPalavras({ microfone, respondendo, simulacao });
  // O anunciado: na conversa simulada, só o aviso (uma vez); senão, o agora.
  const anunciado = simulacao ? aviso : agora;
  const soAVista = simulacao ? agora : "";
  const resolver = simulacao ? comoResolver(sistema, simulacao.motivo) : "";
  const rotulo = simulacao ? "Encerrar a conversa simulada" : conversando ? "Parar de falar com o robô" : "Falar com o robô";

  return (
    <div className="botao-de-voz-area">
      <button
        ref={botao}
        type="button"
        className="botao-de-voz"
        data-simulando={simulacao ? "" : undefined}
        aria-pressed={conversando}
        aria-label={rotulo}
        aria-describedby={simulacao ? idComoResolver : undefined}
        title={simulacao ? `${rotulo}. ${resolver}` : rotulo}
        onClick={alternarMicrofone}
      >
        {comOndas
          ? ONDAS.map((alcance) => (
              <span key={alcance} className="botao-de-voz-onda" aria-hidden="true" style={{ "--alcance": alcance } as CSSProperties} />
            ))
          : null}
        {/* O ícone maior que os tamanhos do sistema: o `Icone` grava a medida
            inline, então a medida do botão entra por `style` (o token). */}
        <Icone
          de={pedindo ? Loader2 : simulacao ? AudioLines : Mic}
          tamanho="md"
          className={pedindo ? "botao-de-voz-icone girando" : "botao-de-voz-icone"}
          style={{ width: "var(--botao-voz-icone)", height: "var(--botao-voz-icone)" }}
        />
      </button>
      {/* O estado em palavras, num véu próprio (legível sobre o ombro
          iluminado do robô). A região viva existe sempre; com a caixa aberta
          é ela quem anuncia (a mesma frase) e esta fica muda. Na conversa
          simulada, o ponto da conversa fica só à vista. */}
      <div className="botao-de-voz-estado">
        <div className="botao-de-voz-legenda" data-vazio={anunciado || soAVista ? undefined : ""}>
          <p
            className={simulacao ? "app-xs botao-de-voz-aviso" : "app-xs botao-de-voz-agora"}
            role="status"
            aria-live={aberto ? "off" : "polite"}
          >
            {anunciado}
          </p>
          {soAVista ? <p className="app-xs botao-de-voz-agora">{soAVista}</p> : null}
        </div>
      </div>
      <span id={idComoResolver} hidden>
        {resolver}
      </span>
    </div>
  );
}
