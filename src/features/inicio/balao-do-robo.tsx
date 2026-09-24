"use client";

/**
 * O BALÃO DO ROBÔ — as respostas em texto, num balão de chat AO LADO DA CABEÇA
 * dele (2026-09-23: "silenciar… as respostas do robô se tornem texto e deve
 * aparecer ao lado da cabeça dele em um balão de chat; as respostas dele devem
 * ficar salvas permitindo o user rolar e ver todas elas da sessão atual").
 *
 * Aparece em modo silenciado ou com legenda, quando há resposta — com a
 * caixa aberta, com o microfone ligado pelo botão de voz do palco, na
 * conversa simulada (sem microfone) e enquanto o robô responde. Cada troca traz a pergunta (ou "pelo microfone") e o texto do robô;
 * a resposta em curso aparece LETRA A LETRA no ritmo da fala dele (a fração
 * vem de `lerFala`: com voz, pelo relógio do som; silenciado, pelo da página),
 * e o leitor de tela recebe o texto inteiro de uma vez (`role=log`). A lista
 * rola: a nova troca leva ao fim; durante a fala, só se a pessoa já estava lá.
 *
 * O lugar vem da cena (`--balao-x`, `--balao-y` e `data-balao-lado` na raiz
 * da cena, `CenaSpline` com `balao`): a projeção de um ponto ao lado da cabeça,
 * a cada quadro desenhado — o balão anda com ela.
 */

import { useEffect, useRef, useState } from "react";
import type { AssistenteDoRobo } from "./use-assistente-do-robo";

/** Quão perto do fim a lista tem de estar para seguir a fala sozinha (px). */
const PERTO_DO_FIM = 24;

export function BalaoDoRobo({
  assistente,
  focoAoFechar,
}: {
  readonly assistente: AssistenteDoRobo;
  /** Para onde o foco vai quando o balão some com o foco dentro dele (a logo). */
  readonly focoAoFechar?: () => HTMLElement | null;
}) {
  const { aberto, microfone, simulacao, mostrarTexto, respostas, respondendo, lerFala } = assistente;
  const lista = useRef<HTMLOListElement>(null);
  const focoDentro = useRef(false);
  const focoAoFecharRef = useRef(focoAoFechar);
  useEffect(() => {
    focoAoFecharRef.current = focoAoFechar;
  });
  // A resposta em curso e quantas letras dela já foram ditas.
  const [revelacao, setRevelacao] = useState<{ readonly id: number; readonly letras: number } | null>(null);
  const visivel = mostrarTexto && respostas.length > 0 && (aberto || microfone !== "desligado" || simulacao !== null || respondendo);

  // O laço da legenda: a cada quadro, quantas letras da resposta em curso já
  // saíram — também com movimento reduzido: é a fala, não decoração.
  useEffect(() => {
    if (!visivel || !respondendo) {
      setRevelacao(null);
      return undefined;
    }
    let quadro = requestAnimationFrame(function passo() {
      const fala = lerFala();
      if (fala) {
        const texto = respostas.find((r) => r.id === fala.id)?.texto ?? "";
        const letras = Math.round(fala.fracao * texto.length);
        setRevelacao((antes) => (antes?.id === fala.id && antes.letras === letras ? antes : { id: fala.id, letras }));
      }
      quadro = requestAnimationFrame(passo);
    });
    return () => cancelAnimationFrame(quadro);
  }, [visivel, respondendo, respostas, lerFala]);

  // Uma troca nova leva a lista ao fim.
  const quantas = respostas.length;
  useEffect(() => {
    const alvo = lista.current;
    if (alvo) alvo.scrollTop = alvo.scrollHeight;
  }, [quantas, visivel]);
  // A fala em curso segue no fim — só se a pessoa já estava lá (rolou para
  // reler uma resposta antiga? fica onde está).
  const letras = revelacao?.letras ?? 0;
  useEffect(() => {
    const alvo = lista.current;
    if (!alvo) return;
    const distancia = alvo.scrollHeight - alvo.scrollTop - alvo.clientHeight;
    if (distancia <= PERTO_DO_FIM) alvo.scrollTop = alvo.scrollHeight;
  }, [letras]);

  // Sumiu com o foco dentro (a lista rolável tem foco): vai para a logo.
  useEffect(() => {
    if (!visivel) return undefined;
    return () => {
      if (focoDentro.current) focoAoFecharRef.current?.()?.focus();
      focoDentro.current = false;
    };
  }, [visivel]);

  if (!visivel) return null;

  return (
    <section className="balao-do-robo surgir" aria-label="Respostas do robô">
      {/* A lista é rolável, então recebe foco (teclado) e é um `log`: cada
          troca nova é anunciada inteira — o texto revelado letra a letra fica
          fora da leitura. */}
      <ol
        ref={lista}
        className="balao-do-robo-lista"
        role="log"
        aria-live="polite"
        aria-label="Respostas desta sessão"
        tabIndex={0}
        onFocus={() => {
          focoDentro.current = true;
        }}
        onBlur={() => {
          focoDentro.current = false;
        }}
      >
        {respostas.map((resposta) => {
          const emCurso = revelacao?.id === resposta.id;
          const visto = emCurso ? resposta.texto.slice(0, revelacao.letras) : resposta.texto;
          return (
            <li key={resposta.id} className="balao-do-robo-troca" data-em-curso={emCurso ? "" : undefined}>
              <p className="app-xs balao-do-robo-pergunta">
                {resposta.pergunta === null
                  ? "Você, pelo microfone"
                  : resposta.simulada
                    ? `Fala simulada: ${resposta.pergunta}`
                    : `Você: ${resposta.pergunta}`}
              </p>
              <p className="app-sm balao-do-robo-resposta">
                <span aria-hidden="true">{visto}</span>
                <span className="sr-only">{resposta.texto}</span>
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
