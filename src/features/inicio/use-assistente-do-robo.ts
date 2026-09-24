"use client";

/**
 * O ASSISTENTE DO ROBÔ do Início — o ciclo de vida da CAIXA, do MICROFONE, da
 * VOZ do robô, das RESPOSTAS e da CONVERSA SIMULADA. A lógica pura (detector
 * de fala, plano e síntese das vozes, a boca) está em `voz-do-robo.ts`; o
 * microfone, em `microfone.ts`; o TEXTO das respostas e o roteiro da conversa
 * simulada, em `respostas-do-robo.ts`.
 *
 * Desde 2026-09-23 ("ao pressionar o N1 no peito, quero que abra uma caixa de
 * texto pequena no centro logo abaixo… e um microfone também, ao invés do mic
 * já abrir assim que apertar no logo"):
 * - a logo abre e fecha a CAIXA — e nada mais: o microfone NÃO abre sozinho;
 * - na caixa, a pessoa DIGITA a pergunta e o robô responde, ou toca no
 *   MICROFONE e fala — o microfone só abre por um botão (o da caixa ou o botão
 *   de voz do palco, `botao-de-voz.tsx`: o mesmo interruptor, que não depende
 *   da caixa);
 * - a resposta tem TEXTO (`responderTexto`, o que o app já sabe) e VOZ: o som
 *   sintetizado "diz" o texto, uma sílaba por palavra, com a boca mexendo.
 *
 * Os MODOS ("na parte de cima, opções do robô"):
 * - SILENCIAR: a resposta sai só em texto, num balão ao lado da cabeça — sem
 *   som e sem contexto de áudio; a boca mexe com o texto aparecendo;
 * - LEGENDA: a voz sai E o texto aparece no balão, em sincronia com o som.
 * Nos dois, as respostas ficam GUARDADAS nesta aba (`sessionStorage`), com a
 * pergunta, para rolar e reler; o modo vale entre recargas (`localStorage`).
 *
 * A CONVERSA SIMULADA (fim de 2026-09-23: "quando o microfone não puder ser
 * conectado, quero que simule a fala e faça uma conversa entre o robô e a fala
 * simulada, e quando eu pressionar novamente a conversa encerra"): QUALQUER
 * falha do microfone — bloqueado, sem aparelho, ocupado, página insegura,
 * navegador sem microfone, microfone que caiu no meio — vira uma conversa: uma
 * "pessoa" simulada, com outra voz, faz as perguntas do roteiro (as ondas do
 * botão reagem à fala dela), o robô responde de verdade (o panorama do
 * Membro), e assim por diante, até o microfone ser tocado de novo. A falha não
 * fica mais "esperando" o microfone voltar sozinho: para tentar o microfone de
 * verdade, encerra-se a conversa e toca-se de novo.
 *
 * Nada de áudio é gravado, transcrito ou enviado: do microfone só se lê o
 * NÍVEL do instante (para perceber começo e fim de fala). O texto digitado é
 * lido aqui, no navegador, para reconhecer a pergunta — e não sai dele.
 *
 * Tudo fecha ao fechar a caixa e ao sair da tela; esconder a aba desliga o
 * microfone e encerra a conversa simulada (a caixa fica). Uma pergunta nova no
 * meio da resposta corta a anterior: uma voz só.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { abrirMicrofone, diagnosticoDaFalha, falhaAntesDePedir, lerPermissao, motivoDaFalha, type FalhaDoMicrofone } from "./microfone";
import { ROTEIRO_SIMULADO } from "./respostas-do-robo";
import {
  FALA_SIMULADA,
  aberturaDaBocaEm,
  criarDetectorDeFala,
  duracaoDaResposta,
  planejarSilabas,
  rms,
  silabasDaFala,
  silabasDoTexto,
  tocarFalaSimulada,
  tocarResposta,
  type RespostaTocando,
  type Silaba,
} from "./voz-do-robo";

/** O microfone de verdade: desligado, pedido ao navegador, aberto (ouvindo) ou ouvindo uma fala. */
export type EstadoDoMicrofone = "desligado" | "pedindo" | "ouvindo" | "escutando";

/** Os estados em que o microfone está aberto. */
export const MICROFONE_ABERTO: ReadonlySet<EstadoDoMicrofone> = new Set(["ouvindo", "escutando"]);

/** Por que a conversa é simulada: a falha do microfone, ou ele ter caído no meio. */
export type MotivoDaSimulacao = FalhaDoMicrofone | "perdido";

/**
 * A conversa simulada em curso: por quê, e em que ponto — a "pessoa" simulada
 * `falando` a `pergunta`, ou `esperando` (o robô responde, ou a próxima vez).
 */
export type Simulacao = {
  readonly motivo: MotivoDaSimulacao;
  readonly fase: "esperando" | "falando";
  readonly pergunta: string;
};

/** Como o robô responde: com a voz (padrão), só em texto (silenciado) ou os dois (legenda). */
export type ModoDoRobo = { readonly silenciado: boolean; readonly legenda: boolean };
const MODO_PADRAO: ModoDoRobo = { silenciado: false, legenda: false };

/**
 * Uma resposta guardada na sessão: a pergunta (null = veio pelo microfone), o
 * texto do robô, e se a pergunta foi da conversa simulada.
 */
export type RespostaDoRobo = {
  readonly id: number;
  readonly pergunta: string | null;
  readonly texto: string;
  readonly simulada?: boolean;
};

/** O modo vale entre recargas; as respostas, só nesta aba (fechou a aba, foram). */
const CHAVE_MODO = "n1:assistente:modo";
const CHAVE_RESPOSTAS = "n1:assistente:respostas";
/** Quantas respostas ficam guardadas: as mais antigas saem. */
const MAXIMO_DE_RESPOSTAS = 50;

const NIVEIS = {
  /** O RMS que enche o medidor de entrada. */
  entradaCheia: 0.15,
  /** O volume da voz do robô. */
  volume: 0.16,
  /** Depois de responder, o microfone segue surdo por este tanto (s): o robô não se ouve. */
  resfriamento: 0.35,
} as const;

/**
 * O ritmo da conversa simulada, em segundos — a paciência de quem conversa,
 * não movimento de interface.
 */
const CONVERSA_SIMULADA = {
  /** Da falha até a primeira fala simulada. */
  antesDeFalar: 0.9,
  /** O silêncio depois da fala simulada, antes de o robô responder (o fim de fala que o detector esperaria). */
  depoisDeFalar: 0.5,
  /** Entre o fim da resposta do robô e a próxima fala simulada. */
  entreTurnos: 1.4,
  /** Com o robô ainda falando (uma pergunta digitada no meio), a vez espera e confere de novo. */
  espera: 0.3,
} as const;

/** A voz do robô: o contexto de áudio e a saída até os alto-falantes. */
type Voz = { contexto: AudioContext; saida: GainNode };

/**
 * Uma fala em curso — pelo som ou só pelo texto: o plano (a boca, as ondas e a
 * legenda leem dele), a duração, o relógio dela (s desde o começo) e como
 * interromper.
 */
type Fala = {
  readonly id: number;
  readonly silabas: readonly Silaba[];
  readonly duracao: number;
  readonly decorrido: () => number;
  readonly parar: () => void;
};

/** O microfone aberto: a trilha, o analisador, o detector e o laço de leitura. */
type Sessao = {
  readonly id: number;
  stream?: MediaStream;
  entrada?: AnalyserNode;
  readonly detector: ReturnType<typeof criarDetectorDeFala>;
  quadro: number;
};

function lerGuardado<T>(area: Storage, chave: string): T | null {
  try {
    const bruto = area.getItem(chave);
    return bruto ? (JSON.parse(bruto) as T) : null;
  } catch {
    return null;
  }
}

function guardar(area: Storage, chave: string, valor: unknown) {
  try {
    area.setItem(chave, JSON.stringify(valor));
  } catch {
    // Sem armazenamento (modo privado cheio, bloqueado): a sessão segue só em memória.
  }
}

/** O modo guardado, ou o padrão — só no navegador (o servidor não tem armazenamento). */
function lerModoGuardado(): ModoDoRobo {
  if (typeof window === "undefined") return MODO_PADRAO;
  const lido = lerGuardado<Partial<ModoDoRobo>>(window.localStorage, CHAVE_MODO);
  return lido ? { silenciado: lido.silenciado === true, legenda: lido.legenda === true } : MODO_PADRAO;
}

/** As respostas guardadas nesta aba (as últimas `MAXIMO_DE_RESPOSTAS`). */
function lerRespostasGuardadas(): readonly RespostaDoRobo[] {
  if (typeof window === "undefined") return [];
  return respostasValidas(lerGuardado(window.sessionStorage, CHAVE_RESPOSTAS)).slice(-MAXIMO_DE_RESPOSTAS);
}

function respostasValidas(bruto: unknown): RespostaDoRobo[] {
  if (!Array.isArray(bruto)) return [];
  return bruto.filter(
    (r): r is RespostaDoRobo =>
      typeof r === "object" &&
      r !== null &&
      typeof (r as RespostaDoRobo).id === "number" &&
      typeof (r as RespostaDoRobo).texto === "string" &&
      ((r as RespostaDoRobo).pergunta === null || typeof (r as RespostaDoRobo).pergunta === "string") &&
      ((r as RespostaDoRobo).simulada === undefined || typeof (r as RespostaDoRobo).simulada === "boolean"),
  );
}

function criarVoz(contexto: AudioContext, volume: number): Voz {
  const saida = contexto.createGain();
  saida.gain.value = volume;
  saida.connect(contexto.destination);
  return { contexto, saida };
}

/** Taxas comuns de microfone, para quando o navegador não diz a do aparelho. */
const TAXAS_COMUNS = [48_000, 44_100, 32_000, 24_000, 22_050, 16_000, 8_000, 96_000] as const;

/**
 * Liga o microfone SÓ a um analisador. Se o navegador se recusa a converter a
 * taxa de amostragem do microfone para a do contexto ("different sample-rate" —
 * o Firefox, e o Chrome com alguns fones Bluetooth no Windows), o contexto da
 * voz é refeito NA TAXA DO MICROFONE (a informada, ou as comuns, uma a uma).
 */
function ligarEntrada(voz: Voz, stream: MediaStream): AnalyserNode {
  const conectar = () => {
    const entrada = voz.contexto.createAnalyser();
    entrada.fftSize = 1024;
    voz.contexto.createMediaStreamSource(stream).connect(entrada);
    return entrada;
  };
  try {
    return conectar();
  } catch (erro) {
    if (!(erro instanceof DOMException && erro.name === "NotSupportedError")) throw erro;
    const informada = stream.getAudioTracks()[0]?.getSettings().sampleRate;
    const taxas = [...new Set([informada, ...TAXAS_COMUNS])].filter(
      (taxa): taxa is number => typeof taxa === "number" && taxa !== voz.contexto.sampleRate,
    );
    const volume = voz.saida.gain.value;
    for (const taxa of taxas) {
      void voz.contexto.close().catch(() => {});
      Object.assign(voz, criarVoz(new AudioContext({ sampleRate: taxa }), volume));
      void voz.contexto.resume().catch(() => {});
      try {
        return conectar();
      } catch (outro) {
        if (!(outro instanceof DOMException && outro.name === "NotSupportedError")) throw outro;
      }
    }
    throw erro;
  }
}

function encerrarMicrofone(sessao: Sessao | null) {
  if (!sessao) return;
  cancelAnimationFrame(sessao.quadro);
  sessao.stream?.getTracks().forEach((trilha) => trilha.stop());
}

/** A aba está à vista? O microfone só abre com ela visível. */
function visivel(): boolean {
  return typeof document === "undefined" || document.visibilityState === "visible";
}

/**
 * @param responderTexto o texto da resposta a uma pergunta digitada (ou `null`,
 * uma fala pelo microfone) — `useRespostaDoRobo()`, o que o app já sabe.
 */
export function useAssistenteDoRobo(responderTexto: (pergunta: string | null) => string) {
  const [aberto, setAberto] = useState(false);
  const [microfone, setMicrofone] = useState<EstadoDoMicrofone>("desligado");
  const [respondendo, setRespondendo] = useState(false);
  const [simulacao, setSimulacao] = useState<Simulacao | null>(null);
  // O guardado — o modo (entre recargas) e as respostas desta aba — entra no
  // estado inicial: no servidor não há armazenamento e vem o padrão, e nada
  // disto aparece antes de a caixa abrir, então a tela nasce igual nos dois
  // lados.
  const [modo, setModo] = useState<ModoDoRobo>(lerModoGuardado);
  const [respostas, setRespostas] = useState<readonly RespostaDoRobo[]>(lerRespostasGuardadas);

  const voz = useRef<Voz | null>(null);
  const fala = useRef<Fala | null>(null);
  const sessao = useRef<Sessao | null>(null);
  const contador = useRef(0);
  const contadorDeRespostas = useRef(respostas.reduce((maior, r) => Math.max(maior, r.id), 0));
  const nivelDeEntrada = useRef(0);
  const microfoneAtual = useRef<EstadoDoMicrofone>("desligado");
  const abertoAtual = useRef(false);
  const respondendoAtual = useRef(false);
  const modoAtual = useRef<ModoDoRobo>(modo);
  const fimDaResposta = useRef(0);
  // A conversa simulada: o estado, a fala da "pessoa" em curso, o relógio da
  // próxima vez, a rodada (uma conversa encerrada não continua) e a próxima
  // pergunta do roteiro (a conversa seguinte continua de onde parou).
  const simulacaoAtual = useRef<Simulacao | null>(null);
  const falaSimulada = useRef<Fala | null>(null);
  const relogioDaSimulacao = useRef(0);
  const rodadaDaSimulacao = useRef(0);
  const contadorDeRodadas = useRef(0);
  const proximaPergunta = useRef(0);
  const retomarSimulacao = useRef<((segundos: number) => void) | null>(null);
  // A tela ainda está aí? O que chega DEPOIS de sair do Início (uma permissão,
  // um microfone) tem de ser solto na hora.
  const montado = useRef(true);
  const responderAtual = useRef(responderTexto);
  useEffect(() => {
    responderAtual.current = responderTexto;
  });

  const mudarMicrofone = useCallback((novo: EstadoDoMicrofone) => {
    microfoneAtual.current = novo;
    setMicrofone(novo);
  }, []);

  const mudarSimulacao = useCallback((nova: Simulacao | null) => {
    simulacaoAtual.current = nova;
    setSimulacao(nova);
  }, []);

  const mudarModo = useCallback((novo: ModoDoRobo) => {
    modoAtual.current = novo;
    setModo(novo);
    guardar(window.localStorage, CHAVE_MODO, novo);
    // Silenciado no meio da fala: as vozes calam na hora (a boca segue o texto).
    if (voz.current) voz.current.saida.gain.value = novo.silenciado ? 0 : NIVEIS.volume;
  }, []);

  /** A voz do robô, criada na primeira vez (dentro de um gesto, ou depois de um: a página já foi tocada). */
  const garantirVoz = useCallback((): Voz | null => {
    if (voz.current && voz.current.contexto.state !== "closed") return voz.current;
    if (typeof window === "undefined" || !window.AudioContext) return null;
    voz.current = criarVoz(new window.AudioContext(), modoAtual.current.silenciado ? 0 : NIVEIS.volume);
    void voz.current.contexto.resume().catch(() => {});
    return voz.current;
  }, []);

  /**
   * Uma fala — do robô ou da "pessoa" simulada — pelo som (`tocar`) ou,
   * silenciado (ou sem áudio no navegador), só pelo relógio da página: a boca,
   * as ondas e o texto andam no ritmo em que a voz falaria. Devolve a fala e
   * quanto falta para ela acabar (s).
   */
  const falar = useCallback(
    (
      id: number,
      silabas: readonly Silaba[],
      tocar: (contexto: AudioContext, silabas: readonly Silaba[], saida: AudioNode) => RespostaTocando,
    ): { readonly fala: Fala; readonly restante: number } => {
      const duracao = duracaoDaResposta(silabas);
      const atual = modoAtual.current.silenciado ? null : garantirVoz();
      if (atual) {
        void atual.contexto.resume().catch(() => {});
        const tocando = tocar(atual.contexto, silabas, atual.saida);
        return {
          fala: { id, silabas, duracao, decorrido: () => atual.contexto.currentTime - tocando.inicio, parar: tocando.parar },
          restante: tocando.fim - atual.contexto.currentTime,
        };
      }
      const inicio = performance.now();
      return { fala: { id, silabas, duracao, decorrido: () => (performance.now() - inicio) / 1000, parar: () => {} }, restante: duracao };
    },
    [garantirVoz],
  );

  /**
   * O robô responde a `pergunta` (null: uma fala pelo microfone): o texto
   * entra no registro, e a voz "diz" o texto com a boca mexendo. Uma resposta
   * em curso é cortada. Devolve quanto falta para a voz acabar (s).
   */
  const responder = useCallback(
    (pergunta: string | null, simulada = false): number => {
      const texto = responderAtual.current(pergunta);
      const id = ++contadorDeRespostas.current;
      setRespostas((lista) => {
        const nova = [...lista, { id, pergunta, texto, ...(simulada ? { simulada: true } : {}) }].slice(-MAXIMO_DE_RESPOSTAS);
        guardar(window.sessionStorage, CHAVE_RESPOSTAS, nova);
        return nova;
      });
      fala.current?.parar();
      const { fala: nova, restante } = falar(id, planejarSilabas(silabasDoTexto(texto)), tocarResposta);
      fala.current = nova;
      respondendoAtual.current = true;
      setRespondendo(true);
      window.clearTimeout(fimDaResposta.current);
      fimDaResposta.current = window.setTimeout(
        () => {
          if (fala.current?.id === id) fala.current = null;
          respondendoAtual.current = false;
          setRespondendo(false);
          sessao.current?.detector.reiniciar();
          if (microfoneAtual.current === "escutando") mudarMicrofone("ouvindo");
        },
        Math.max(0, restante + NIVEIS.resfriamento) * 1000,
      );
      return restante;
    },
    [falar, mudarMicrofone],
  );

  /** O robô cala: a resposta em curso para (o texto dela já está no registro). */
  const calar = useCallback(() => {
    window.clearTimeout(fimDaResposta.current);
    fala.current?.parar();
    fala.current = null;
    respondendoAtual.current = false;
    setRespondendo(false);
  }, []);

  /** Encerra a conversa simulada: a fala da "pessoa", a vez marcada e a resposta do robô. */
  const encerrarSimulacao = useCallback(() => {
    if (!simulacaoAtual.current) return;
    rodadaDaSimulacao.current = 0;
    window.clearTimeout(relogioDaSimulacao.current);
    retomarSimulacao.current = null;
    falaSimulada.current?.parar();
    falaSimulada.current = null;
    mudarSimulacao(null);
    calar();
  }, [calar, mudarSimulacao]);

  /**
   * Começa a conversa simulada: a "pessoa" pergunta (o roteiro, na ordem), o
   * robô responde com o que o app sabe, e de novo — até ser encerrada.
   */
  const iniciarSimulacao = useCallback(
    (motivo: MotivoDaSimulacao) => {
      window.clearTimeout(relogioDaSimulacao.current);
      falaSimulada.current?.parar();
      falaSimulada.current = null;
      const rodada = ++contadorDeRodadas.current;
      rodadaDaSimulacao.current = rodada;
      const vale = () => montado.current && rodadaDaSimulacao.current === rodada;
      const marcar = (passo: () => void, segundos: number) => {
        window.clearTimeout(relogioDaSimulacao.current);
        relogioDaSimulacao.current = window.setTimeout(passo, Math.max(0, segundos) * 1000);
      };
      function falarPergunta() {
        if (!vale()) return;
        // A vez da "pessoa" só começa com o robô calado.
        if (respondendoAtual.current) {
          marcar(falarPergunta, CONVERSA_SIMULADA.espera);
          return;
        }
        const pergunta = ROTEIRO_SIMULADO[proximaPergunta.current % ROTEIRO_SIMULADO.length] ?? "";
        proximaPergunta.current += 1;
        const { fala: nova, restante } = falar(-1, planejarSilabas(silabasDaFala(pergunta), Math.random, FALA_SIMULADA), tocarFalaSimulada);
        falaSimulada.current = nova;
        mudarSimulacao({ motivo, fase: "falando", pergunta });
        marcar(() => responderPergunta(pergunta), restante + CONVERSA_SIMULADA.depoisDeFalar);
      }
      function responderPergunta(pergunta: string) {
        if (!vale()) return;
        falaSimulada.current = null;
        mudarSimulacao({ motivo, fase: "esperando", pergunta });
        const restante = responder(pergunta, true);
        marcar(falarPergunta, restante + NIVEIS.resfriamento + CONVERSA_SIMULADA.entreTurnos);
      }
      retomarSimulacao.current = (segundos) => {
        if (vale()) marcar(falarPergunta, segundos);
      };
      mudarSimulacao({ motivo, fase: "esperando", pergunta: "" });
      // Com som, a voz nasce já (numa falha imediata ainda estamos no clique).
      if (!modoAtual.current.silenciado) garantirVoz();
      marcar(falarPergunta, CONVERSA_SIMULADA.antesDeFalar);
    },
    [falar, garantirVoz, mudarSimulacao, responder],
  );

  /** O microfone não pôde ser usado: a conversa segue, simulada. */
  const falhar = useCallback(
    (motivo: MotivoDaSimulacao) => {
      mudarMicrofone("desligado");
      iniciarSimulacao(motivo);
    },
    [iniciarSimulacao, mudarMicrofone],
  );

  const desligarMicrofone = useCallback(() => {
    encerrarMicrofone(sessao.current);
    sessao.current = null;
    nivelDeEntrada.current = 0;
    mudarMicrofone("desligado");
  }, [mudarMicrofone]);

  const ligarMicrofone = useCallback(async () => {
    // Com a aba escondida o microfone não abre (achado da revisão: a
    // permissão liberada em outra aba abria o microfone numa aba que ninguém via).
    if (sessao.current || !visivel()) return;
    const antes = falhaAntesDePedir();
    if (antes) {
      falhar(antes);
      return;
    }
    const atualVoz = garantirVoz();
    if (!atualVoz) {
      falhar("indisponivel");
      return;
    }
    const atual: Sessao = { id: ++contador.current, detector: criarDetectorDeFala(), quadro: 0 };
    sessao.current = atual;
    mudarMicrofone("pedindo");
    const vale = () => montado.current && visivel() && sessao.current?.id === atual.id;

    let stream: MediaStream;
    try {
      stream = await abrirMicrofone(vale);
    } catch (erro) {
      if (montado.current && sessao.current?.id === atual.id) {
        sessao.current = null;
        const motivo = await motivoDaFalha(erro);
        console.warn(`Assistente do robô: o microfone não abriu (${motivo}) — a conversa segue simulada.`, await diagnosticoDaFalha(erro));
        if (montado.current && !sessao.current && microfoneAtual.current === "pedindo") falhar(motivo);
      }
      return;
    }
    // Desligou, fechou a caixa, escondeu a aba ou saiu da tela enquanto o
    // navegador perguntava.
    if (!vale()) {
      stream.getTracks().forEach((trilha) => trilha.stop());
      if (sessao.current?.id === atual.id) {
        sessao.current = null;
        if (montado.current) mudarMicrofone("desligado");
      }
      return;
    }
    atual.stream = stream;
    // O microfone caiu no meio: encerra e a conversa segue simulada, em vez
    // de "ouvir" um silêncio eterno.
    stream.getAudioTracks().forEach((trilha) =>
      trilha.addEventListener("ended", () => {
        if (sessao.current?.id !== atual.id) return;
        encerrarMicrofone(atual);
        sessao.current = null;
        void lerPermissao().then((permissao) => {
          if (montado.current && !sessao.current && !simulacaoAtual.current) falhar(permissao === "denied" ? "negado" : "perdido");
        });
      }),
    );
    // O microfone vai SÓ ao analisador — nunca aos alto-falantes nem a um
    // gravador. Um erro daqui em diante fecha o microfone.
    let entrada: AnalyserNode;
    try {
      entrada = ligarEntrada(voz.current ?? atualVoz, stream);
    } catch (erro) {
      stream.getTracks().forEach((trilha) => trilha.stop());
      if (sessao.current?.id === atual.id) sessao.current = null;
      console.warn("Assistente do robô: o microfone abriu, mas não deu para ouvi-lo — a conversa segue simulada.", await diagnosticoDaFalha(erro));
      if (montado.current && !sessao.current && microfoneAtual.current === "pedindo") falhar("erro");
      return;
    }
    atual.entrada = entrada;
    mudarMicrofone("ouvindo");

    // Janela de leitura reaproveitada: cada quadro sobrescreve a anterior.
    const janela = new Float32Array(entrada.fftSize);
    const passo = () => {
      if (sessao.current?.id !== atual.id) return;
      entrada.getFloatTimeDomainData(janela);
      const nivel = rms(janela);
      nivelDeEntrada.current = Math.min(1, nivel / NIVEIS.entradaCheia);
      // Enquanto o robô responde, o microfone fica surdo: ele não se ouve.
      if (!respondendoAtual.current) {
        const evento = atual.detector.amostra(nivel, performance.now());
        if (evento?.tipo === "comecou") mudarMicrofone("escutando");
        else if (evento?.tipo === "ruido") mudarMicrofone("ouvindo");
        else if (evento?.tipo === "terminou") {
          mudarMicrofone("ouvindo");
          responder(null);
        }
      }
      atual.quadro = requestAnimationFrame(passo);
    };
    atual.quadro = requestAnimationFrame(passo);
  }, [falhar, garantirVoz, mudarMicrofone, responder]);

  /**
   * O botão do microfone (o do palco e o da caixa): com a conversa simulada
   * em curso, encerra-a; com o microfone pedido ou aberto, desliga; desligado,
   * liga — e, se ele não puder ser usado, a conversa começa simulada.
   */
  const alternarMicrofone = useCallback(() => {
    if (simulacaoAtual.current) {
      encerrarSimulacao();
      return;
    }
    const agora = microfoneAtual.current;
    if (sessao.current || agora === "pedindo" || MICROFONE_ABERTO.has(agora)) desligarMicrofone();
    else void ligarMicrofone();
  }, [desligarMicrofone, encerrarSimulacao, ligarMicrofone]);

  /**
   * Uma pergunta digitada: o robô responde. Numa conversa simulada, a
   * "pessoa" cala e só volta depois da resposta. Devolve false só com o texto
   * vazio.
   */
  const perguntar = useCallback(
    (texto: string) => {
      const limpo = texto.trim();
      if (!limpo) return false;
      const restante = responder(limpo);
      const emCurso = simulacaoAtual.current;
      if (emCurso) {
        falaSimulada.current?.parar();
        falaSimulada.current = null;
        mudarSimulacao({ ...emCurso, fase: "esperando" });
        retomarSimulacao.current?.(restante + NIVEIS.resfriamento + CONVERSA_SIMULADA.entreTurnos);
      }
      return true;
    },
    [mudarSimulacao, responder],
  );

  /** Silenciar: só texto, no balão. Vale entre recargas. */
  const alternarSilencio = useCallback(() => {
    mudarModo({ ...modoAtual.current, silenciado: !modoAtual.current.silenciado });
  }, [mudarModo]);

  /** Legenda: a voz E o texto. Silenciado, não há o que alternar (o texto já sai). */
  const alternarLegenda = useCallback(() => {
    if (modoAtual.current.silenciado) return;
    mudarModo({ ...modoAtual.current, legenda: !modoAtual.current.legenda });
  }, [mudarModo]);

  const abrir = useCallback(() => {
    abertoAtual.current = true;
    setAberto(true);
  }, []);

  /** Fecha a caixa: o microfone, a conversa simulada, a voz e a resposta em curso (as respostas guardadas ficam). */
  const fechar = useCallback(() => {
    abertoAtual.current = false;
    setAberto(false);
    encerrarSimulacao();
    encerrarMicrofone(sessao.current);
    sessao.current = null;
    nivelDeEntrada.current = 0;
    mudarMicrofone("desligado");
    calar();
    void voz.current?.contexto.close().catch(() => {});
    voz.current = null;
  }, [calar, encerrarSimulacao, mudarMicrofone]);

  /** A logo do peito: abre e fecha a caixa. */
  const alternarCaixa = useCallback(() => {
    if (abertoAtual.current) fechar();
    else abrir();
  }, [abrir, fechar]);

  // Sair da tela fecha tudo — e marca que saiu, para o que ainda está a caminho.
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
      encerrarMicrofone(sessao.current);
      sessao.current = null;
      window.clearTimeout(fimDaResposta.current);
      window.clearTimeout(relogioDaSimulacao.current);
      fala.current?.parar();
      fala.current = null;
      falaSimulada.current?.parar();
      falaSimulada.current = null;
      void voz.current?.contexto.close().catch(() => {});
      voz.current = null;
    };
  }, []);

  // Esconder a aba desliga o MICROFONE e encerra a conversa simulada (a caixa
  // fica) — conferido também ao assinar, para o que comece com a aba já
  // escondida: numa aba escondida os relógios andam aos solavancos e a
  // conversa falaria sozinha, fora da vista.
  const microfoneEmUso = microfone === "pedindo" || MICROFONE_ABERTO.has(microfone);
  const simulando = simulacao !== null;
  useEffect(() => {
    if (!microfoneEmUso && !simulando) return undefined;
    const aoEsconder = () => {
      if (!document.hidden) return;
      if (microfoneEmUso) desligarMicrofone();
      if (simulando) encerrarSimulacao();
    };
    aoEsconder();
    document.addEventListener("visibilitychange", aoEsconder);
    return () => document.removeEventListener("visibilitychange", aoEsconder);
  }, [microfoneEmUso, simulando, desligarMicrofone, encerrarSimulacao]);

  /**
   * O nível do que entra agora (0–1), para as ondas e o medidor: o microfone —
   * ou, na conversa simulada, o envelope da fala simulada, pelo relógio dela.
   */
  const lerEntrada = useCallback(() => {
    const simulada = falaSimulada.current;
    if (simulada) return aberturaDaBocaEm(simulada.silabas, simulada.decorrido());
    return nivelDeEntrada.current;
  }, []);
  /** A abertura da boca agora (0–1): o envelope da fala do robô em curso, pelo relógio dela. */
  const lerBoca = useCallback(() => {
    const atual = fala.current;
    if (!atual) return 0;
    return aberturaDaBocaEm(atual.silabas, atual.decorrido());
  }, []);
  /** A fala do robô em curso, para a legenda: qual resposta e quanto dela já foi dita (0–1). */
  const lerFala = useCallback((): { readonly id: number; readonly fracao: number } | null => {
    const atual = fala.current;
    if (!atual) return null;
    return { id: atual.id, fracao: atual.duracao > 0 ? Math.max(0, Math.min(1, atual.decorrido() / atual.duracao)) : 1 };
  }, []);

  return {
    aberto,
    abrir,
    fechar,
    alternarCaixa,
    microfone,
    /** O microfone pedido ou aberto. */
    microfoneLigado: microfoneEmUso,
    /** A conversa simulada em curso (o microfone não pôde ser usado), ou null. */
    simulacao,
    /** Uma conversa por voz em curso: o microfone ligado ou a conversa simulada. */
    conversando: microfoneEmUso || simulando,
    alternarMicrofone,
    desligarMicrofone,
    respondendo,
    perguntar,
    modo,
    /** As respostas saem em texto, no balão (silenciado ou com legenda). */
    mostrarTexto: modo.silenciado || modo.legenda,
    alternarSilencio,
    alternarLegenda,
    respostas,
    lerEntrada,
    lerBoca,
    lerFala,
  };
}

export type AssistenteDoRobo = ReturnType<typeof useAssistenteDoRobo>;
