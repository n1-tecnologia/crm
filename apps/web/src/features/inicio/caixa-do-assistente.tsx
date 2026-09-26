"use client";

/**
 * A CAIXA DO ASSISTENTE — pequena, no centro, no pé do palco (2026-09-23:
 * "quero que abra uma caixa de texto pequena no centro logo abaixo… para o
 * user digitar o que ele quer saber e o robô responde; quero um microfone
 * também…"). Desde 2026-09-24, FIXA ("quero que a opção de chat seja fixa na
 * tela, ao invés de depender da interação na logo do peito"): sempre à vista,
 * sem X e sem Esc; a logo do peito voltou a ser só decoração.
 *
 * (O microfone também liga pelo botão de voz grande do palco,
 * `botao-de-voz.tsx` — é o mesmo interruptor; sem microfone, a conversa segue
 * simulada e o botão dele a encerra.) Em cima, as OPÇÕES DO ROBÔ
 * ("na parte de cima, opções do robô"): Silenciar —
 * as respostas viram texto, num balão ao lado da cabeça dele (`balao-do-robo.tsx`)
 * — e Legenda — a voz sai e o texto aparece junto. Depois, um campo para
 * digitar a pergunta (Enter ou o botão envia; o robô responde com a voz dele e
 * a boca mexendo) e o botão do MICROFONE (só ele abre o microfone). Embaixo, o estado em palavras — anunciado a leitor de tela — e,
 * com o microfone aberto, um medidor que reage à fala e o lembrete de que nada
 * é gravado. O ciclo de vida está em `useAssistenteDoRobo`.
 */

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { ArrowUp, AudioLines, Captions, Loader2, Mic, Volume2, VolumeX } from "lucide-react";
import { Icone } from "@/design/icone";
import { reduzido } from "@/design/movimento";
import { useHidratado } from "@/features/shell/hidratado";
import { ATALHO_DO_WINDOWS, PELO_SISTEMA, comoResolver, estadoEmPalavras } from "./frases-do-microfone";
import { sistemaAtual } from "./microfone";
import { MICROFONE_ABERTO, type AssistenteDoRobo } from "./use-assistente-do-robo";

/** As barras do medidor e o peso de cada uma (o meio sobe mais). */
const BARRAS = [0.55, 0.8, 1, 0.8, 0.55] as const;

export function CaixaDoAssistente({ assistente }: { readonly assistente: AssistenteDoRobo }) {
  const {
    microfone,
    simulacao,
    conversando,
    alternarMicrofone,
    respondendo,
    perguntar,
    lerEntrada,
    modo,
    alternarSilencio,
    alternarLegenda,
  } = assistente;
  const sistema = sistemaAtual();
  const raiz = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const medidor = useRef<HTMLSpanElement>(null);
  // O foco está dentro da caixa? Um nó focado que DESMONTA (o link do Windows
  // quando o robô tenta o microfone de novo) largaria o foco no <body> sem
  // avisar — o navegador não dispara blur ao remover; aí o campo o recolhe.
  const focoDentro = useRef(false);
  const [texto, setTexto] = useState("");
  const idCampo = useId();
  const idMotivoEnviar = useId();
  const idComoResolver = useId();
  const idMotivoLegenda = useId();
  const idOpcoes = useId();
  // O modo (Silenciar/Legenda) vem do armazenamento do navegador: a caixa só
  // desenha depois da hidratação, para o HTML do servidor bater.
  const hidratado = useHidratado();
  const ouvindo = MICROFONE_ABERTO.has(microfone);
  // O medidor: com o microfone aberto, ou com a fala simulada no lugar dele.
  const comMedidor = ouvindo || simulacao !== null;

  // Fixa, a caixa não rouba o foco ao chegar na tela (o foco fica onde a
  // navegação o deixou; um clique ou Tab chega ao campo).
  useLayoutEffect(() => {
    if (!focoDentro.current) return;
    const dentro = raiz.current;
    if (dentro && !dentro.contains(document.activeElement)) campo.current?.focus();
  });

  // O medidor lê o nível a cada quadro, só à mostra e sem movimento
  // reduzido (aí as barras ficam paradas e o texto diz o estado). Depende de
  // `hidratado`: antes dele a caixa não desenha, e o medidor não existe.
  useEffect(() => {
    const alvo = medidor.current;
    if (!alvo || !comMedidor || reduzido()) return undefined;
    let quadro = 0;
    const passo = () => {
      alvo.style.setProperty("--nivel-voz", String(lerEntrada()));
      quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => {
      cancelAnimationFrame(quadro);
      alvo.style.removeProperty("--nivel-voz");
    };
  }, [hidratado, comMedidor, lerEntrada]);

  if (!hidratado) return null;

  const vazio = texto.trim() === "";
  const pedindo = microfone === "pedindo";
  const { aviso, agora } = estadoEmPalavras({ microfone, respondendo, simulacao });
  // O anunciado: na conversa simulada, só o aviso (uma vez); senão, o agora.
  const anunciado = simulacao ? aviso : agora;
  const soAVista = simulacao ? agora : "";
  const resolver = simulacao ? comoResolver(sistema, simulacao.motivo) : "";
  const rotuloDoMicrofone = simulacao ? "Encerrar a conversa simulada" : conversando ? "Desligar o microfone" : "Falar pelo microfone";
  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    if (vazio) return;
    if (perguntar(texto)) setTexto("");
  };

  return (
    <div
      ref={raiz}
      className="caixa-do-assistente surgir"
      data-microfone={microfone}
      data-respondendo={respondendo ? "" : undefined}
      onFocus={() => {
        focoDentro.current = true;
      }}
      onBlur={(evento) => {
        if (!raiz.current?.contains(evento.relatedTarget as Node | null)) focoDentro.current = false;
      }}
    >
      {/* As opções do robô: botões de alternar (aria-pressed), não chaves —
          mudam agora, e o rótulo fica o mesmo ligado ou desligado. */}
      <div className="caixa-do-assistente-opcoes" role="group" aria-labelledby={idOpcoes}>
        <span id={idOpcoes} className="sr-only">
          Opções do robô
        </span>
        <button
          type="button"
          className="caixa-do-assistente-opcao"
          aria-pressed={modo.silenciado}
          title="As respostas saem só em texto, num balão ao lado da cabeça do robô"
          onClick={alternarSilencio}
        >
          <Icone de={modo.silenciado ? VolumeX : Volume2} tamanho="xs" />
          Silenciar
        </button>
        {/* §11 — silenciado, a legenda já está implícita: o botão fica
            pressionado e desligado, com o motivo (aria-describedby). */}
        <button
          type="button"
          className="caixa-do-assistente-opcao"
          aria-pressed={modo.silenciado || modo.legenda}
          aria-disabled={modo.silenciado || undefined}
          aria-describedby={modo.silenciado ? idMotivoLegenda : undefined}
          title={modo.silenciado ? "Silenciado, as respostas já saem em texto." : "A voz sai e a resposta aparece em texto, no balão"}
          onClick={modo.silenciado ? undefined : alternarLegenda}
        >
          <Icone de={Captions} tamanho="xs" />
          Legenda
        </button>
        <span id={idMotivoLegenda} hidden>
          Silenciado, as respostas já saem em texto.
        </span>
      </div>
      <form className="caixa-do-assistente-linha" onSubmit={enviar}>
        <label className="sr-only" htmlFor={idCampo}>
          Pergunte ao robô
        </label>
        <input
          id={idCampo}
          ref={campo}
          value={texto}
          onChange={(evento) => setTexto(evento.target.value)}
          placeholder="Pergunte ao robô…"
          autoComplete="off"
          className="app-base caixa-do-assistente-campo campo-sem-anel"
        />
        {comMedidor ? (
          <span ref={medidor} className="caixa-do-assistente-medidor" aria-hidden="true">
            {BARRAS.map((peso, i) => (
              <span key={i} style={{ "--peso": peso } as CSSProperties} />
            ))}
          </span>
        ) : null}
        {/* Nunca desligado: sem microfone, tocar começa a conversa simulada
            (e, com ela em curso, encerra). Na simulação, o caminho para
            resolver o microfone vai na dica e no describedby. */}
        <button
          type="button"
          className="btn-icone btn-icone-nu caixa-do-assistente-microfone"
          aria-pressed={conversando}
          aria-describedby={simulacao ? idComoResolver : undefined}
          aria-label={rotuloDoMicrofone}
          title={simulacao ? `${rotuloDoMicrofone}. ${resolver}` : undefined}
          onClick={alternarMicrofone}
        >
          <Icone de={pedindo ? Loader2 : simulacao ? AudioLines : Mic} tamanho="sm" className={pedindo ? "girando" : undefined} />
        </button>
        <button
          type="submit"
          className="btn-icone btn-icone-enviar caixa-do-assistente-enviar"
          aria-label="Enviar a pergunta"
          aria-disabled={vazio || undefined}
          aria-describedby={vazio ? idMotivoEnviar : undefined}
          title={vazio ? "Escreva a pergunta primeiro." : undefined}
        >
          <Icone de={ArrowUp} tamanho="xs" />
        </button>
        {/* `hidden`, não `sr-only`: um nó display:none continua lido pelo aria-describedby. */}
        <span id={idMotivoEnviar} hidden>
          Escreva a pergunta primeiro.
        </span>
        <span id={idComoResolver} hidden>
          {resolver}
        </span>
      </form>
      {/* A região viva existe SEMPRE, vazia inclusive (o CSS recolhe o
          parágrafo sem tirá-la da árvore): um leitor de tela só anuncia o que
          muda numa região que já estava lá. Ao lado dela, só à vista, o ponto
          da conversa simulada. */}
      <p className="app-xs caixa-do-assistente-status" data-vazio={anunciado || soAVista ? undefined : ""}>
        <span role="status" aria-live="polite">
          {anunciado}
        </span>
        {soAVista ? <span className="caixa-do-assistente-agora"> {soAVista}</span> : null}
      </p>
      {simulacao && PELO_SISTEMA.has(simulacao.motivo) && sistema === "windows" ? (
        <p className="app-xs">
          <a className="caixa-do-assistente-atalho" href={ATALHO_DO_WINDOWS}>
            Abrir as configurações de microfone do Windows
          </a>
        </p>
      ) : null}
      {ouvindo ? <p className="app-xs caixa-do-assistente-nota">Nada é gravado nem enviado: o robô só reage ao som.</p> : null}
    </div>
  );
}
