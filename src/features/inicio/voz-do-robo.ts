/**
 * A VOZ DO ROBÔ — o assistente de voz do Início, só de REAÇÃO.
 *
 * Pedido (2026-09-23): "quando pressionar o logo em destaque no peito, quero
 * que abra a opção de pesquisa com voz / assistente virtual em voz; nesse
 * modelo, apenas habilite o microfone e reaja à fala no microfone, não
 * armazene o áudio em lugar algum, apenas reaja" — e "quando eu falar algo no
 * microfone ele deve responder e mexer a boca emitindo um som de robô".
 *
 * O que NÃO se faz, de propósito: não grava (nada de `MediaRecorder`), não
 * transcreve (nada de reconhecimento de fala), não envia nada a lugar nenhum e
 * não guarda amostra nenhuma. O microfone entra num `AnalyserNode` que só
 * expõe o nível do INSTANTE — lido e sobrescrito a cada quadro — e nem chega
 * aos alto-falantes. A "resposta" é sintetizada na hora, sem arquivo de som.
 *
 * Aqui mora a parte pura, testada ao lado (o detector de fala por nível e o
 * plano da resposta), e a síntese do som. O ciclo de vida (microfone, contexto
 * de áudio, estados) mora em `use-assistente-do-robo.ts`; o TEXTO das
 * respostas (silenciado ou com legenda), em `respostas-do-robo.ts` — a voz
 * então "diz" o texto: uma sílaba por palavra (`silabasDoTexto`).
 *
 * E a FALA SIMULADA (fim de 2026-09-23: "quando o microfone não puder ser
 * conectado, quero que simule a fala e faça uma conversa entre o robô e a fala
 * simulada"): a "pessoa" da conversa simulada tem outro timbre — mais grave,
 * macio, com vibrato e sem o anel metálico — para as duas vozes não se
 * confundirem (`FALA_SIMULADA`, `silabasDaFala`, `tocarFalaSimulada`).
 */

/** O que o detector percebe numa amostra de nível. */
export type EventoDeFala =
  | { readonly tipo: "comecou" }
  | { readonly tipo: "terminou"; readonly duracao: number }
  /** Começou, mas foi curto demais para ser fala (um clique, uma tosse). */
  | { readonly tipo: "ruido" };

/**
 * Os parâmetros do detector. Tempos em ms; níveis em RMS (0–1) do sinal do
 * microfone. Não são movimento de interface — são a paciência de quem escuta.
 */
export const ESCUTA = {
  /** O RMS de um microfone em silêncio, antes de medir o ambiente. */
  pisoInicial: 0.008,
  /** O teto do piso: num ambiente muito barulhento o piso não sobe além disto. */
  pisoMaximo: 0.08,
  /** Abaixo disto nunca é fala. */
  limiarMinimo: 0.02,
  /** Fala = este tanto de vezes o ruído de fundo. */
  fatorSobrePiso: 3,
  /** Quanto o piso anda, por amostra, em direção ao nível do silêncio. */
  adaptacaoDoPiso: 0.05,
  /** Para seguir falando, basta esta fração do limiar (histerese). */
  histerese: 0.6,
  /** Tempo acima do limiar para contar como começo. */
  confirmaInicio: 120,
  /** Tempo de silêncio para contar como fim da fala. */
  silencioParaFim: 700,
  /** Uma fala mais curta que isto é ruído. */
  duracaoMinima: 250,
  /** Nenhuma fala passa disto: um ruído constante não prende o robô ouvindo. */
  duracaoMaxima: 12_000,
} as const;

export type ParametrosDeEscuta = { readonly [K in keyof typeof ESCUTA]: number };

/**
 * O detector de fala por NÍVEL — não entende palavras, só percebe que alguém
 * começou e parou de falar. O piso de ruído se adapta ao ambiente enquanto
 * ninguém fala; o começo pede um instante acima do limiar (um estalo não
 * conta); o fim pede um silêncio. Guarda só três números e um estado.
 */
export function criarDetectorDeFala(parametros: ParametrosDeEscuta = ESCUTA) {
  let piso = parametros.pisoInicial;
  let acimaDesde: number | null = null;
  let falando = false;
  let comecou = 0;
  let ultimoSom = 0;
  // Depois de uma fala cortada por longa demais, só volta a ouvir depois de um
  // silêncio: um ruído alto e constante não dispara o robô de 12 em 12 s.
  let esperandoSilencio = false;
  const limiar = () => Math.max(parametros.limiarMinimo, piso * parametros.fatorSobrePiso);

  return {
    get falando() {
      return falando;
    },
    get limiar() {
      return limiar();
    },
    /** Uma amostra de nível no instante `agora` (ms). */
    amostra(nivel: number, agora: number): EventoDeFala | null {
      const corte = limiar();
      if (!falando) {
        if (esperandoSilencio) {
          if (nivel < corte * parametros.histerese) esperandoSilencio = false;
          return null;
        }
        if (nivel >= corte) {
          acimaDesde ??= agora;
          if (agora - acimaDesde >= parametros.confirmaInicio) {
            falando = true;
            comecou = acimaDesde;
            ultimoSom = agora;
            acimaDesde = null;
            return { tipo: "comecou" };
          }
        } else {
          acimaDesde = null;
          piso = Math.min(parametros.pisoMaximo, piso + (nivel - piso) * parametros.adaptacaoDoPiso);
        }
        return null;
      }
      if (nivel >= corte * parametros.histerese) ultimoSom = agora;
      const longaDemais = agora - comecou >= parametros.duracaoMaxima;
      if (!longaDemais && agora - ultimoSom < parametros.silencioParaFim) return null;
      falando = false;
      // Um ruído que não cessa vira o novo piso: o robô não fica preso ouvindo.
      if (longaDemais) {
        piso = Math.min(parametros.pisoMaximo, Math.max(piso, nivel));
        esperandoSilencio = true;
      }
      const duracao = Math.max(0, ultimoSom - comecou);
      return duracao >= parametros.duracaoMinima ? { tipo: "terminou", duracao } : { tipo: "ruido" };
    },
    /** Esquece a fala em curso (o piso do ambiente fica). */
    reiniciar() {
      falando = false;
      acimaDesde = null;
    },
  };
}

/** Uma sílaba da resposta do robô. Tempos em segundos, a partir do começo. */
export type Silaba = {
  readonly inicio: number;
  readonly duracao: number;
  /** A nota da sílaba (Hz). */
  readonly frequencia: number;
  /** Quanto a nota escorrega até o fim da sílaba (Hz, pode ser negativo). */
  readonly deslize: number;
  /** 0–1, relativo ao volume da voz. */
  readonly volume: number;
};

/** A forma da resposta: o robô "fala" mais quando ouviu mais. */
export const RESPOSTA = {
  silabasMin: 3,
  silabasMax: 12,
  /** Uma sílaba de resposta a cada tanto de fala ouvida (ms). */
  falaPorSilaba: 220,
  /** "Dizendo" um texto, uma sílaba por palavra — até este tanto (uma resposta longa dura ~7 s). */
  silabasMaxTexto: 40,
  duracaoMin: 0.07,
  duracaoVariacao: 0.11,
  pausaMin: 0.025,
  pausaVariacao: 0.06,
  /** A faixa das notas (Hz): a entoação grave e metálica de um robô. */
  notaMin: 180,
  notaVariacao: 320,
  /** O deslize máximo, em fração da nota, para cima ou para baixo. */
  deslizeMax: 0.3,
  volumeMin: 0.7,
} as const;

/** A forma de uma fala: a duração e a pausa das sílabas, a faixa das notas, o deslize e o volume mínimo. */
export type FormaDaFala = {
  readonly duracaoMin: number;
  readonly duracaoVariacao: number;
  readonly pausaMin: number;
  readonly pausaVariacao: number;
  readonly notaMin: number;
  readonly notaVariacao: number;
  readonly deslizeMax: number;
  readonly volumeMin: number;
};

/**
 * A forma da FALA SIMULADA — a "pessoa" da conversa simulada: sílabas curtas
 * e rápidas (duas por palavra, como a fala de gente), notas na faixa de uma
 * voz falada (150–230 Hz), deslize pequeno — a entoação, não o canto do robô.
 */
export const FALA_SIMULADA = {
  silabasPorPalavra: 2,
  silabasMin: 3,
  silabasMax: 36,
  duracaoMin: 0.07,
  duracaoVariacao: 0.08,
  pausaMin: 0.015,
  pausaVariacao: 0.035,
  notaMin: 150,
  notaVariacao: 80,
  deslizeMax: 0.12,
  volumeMin: 0.55,
} as const;

/** Quantas sílabas para a fala simulada "dizer" uma pergunta: duas por palavra, entre o mínimo e o máximo. */
export function silabasDaFala(texto: string): number {
  const palavras = texto.trim().split(/\s+/).filter(Boolean).length;
  return Math.min(FALA_SIMULADA.silabasMax, Math.max(FALA_SIMULADA.silabasMin, palavras * FALA_SIMULADA.silabasPorPalavra));
}

/** O plano da resposta a uma fala de `duracaoFala` ms. `aleatorio` é injetável para teste. */
export function planejarResposta(duracaoFala: number, aleatorio: () => number = Math.random): readonly Silaba[] {
  const quantas = Math.round(
    Math.min(RESPOSTA.silabasMax, Math.max(RESPOSTA.silabasMin, duracaoFala / RESPOSTA.falaPorSilaba)),
  );
  return planejarSilabas(quantas, aleatorio);
}

/** Quantas sílabas para "dizer" um texto: uma por palavra, entre o mínimo e `silabasMaxTexto`. */
export function silabasDoTexto(texto: string): number {
  const palavras = texto.trim().split(/\s+/).filter(Boolean).length;
  return Math.min(RESPOSTA.silabasMaxTexto, Math.max(RESPOSTA.silabasMin, palavras));
}

/**
 * Um plano de `quantas` sílabas, cada uma com nota, deslize, volume e pausa
 * sorteados na `forma` (a do robô, por padrão; `FALA_SIMULADA` para a pessoa).
 */
export function planejarSilabas(quantas: number, aleatorio: () => number = Math.random, forma: FormaDaFala = RESPOSTA): readonly Silaba[] {
  const silabas: Silaba[] = [];
  let t = 0;
  for (let i = 0; i < quantas; i++) {
    const duracao = forma.duracaoMin + aleatorio() * forma.duracaoVariacao;
    const frequencia = forma.notaMin + aleatorio() * forma.notaVariacao;
    const deslize = (aleatorio() * 2 - 1) * forma.deslizeMax * frequencia;
    const volume = forma.volumeMin + aleatorio() * (1 - forma.volumeMin);
    silabas.push({ inicio: t, duracao, frequencia, deslize, volume });
    t += duracao + forma.pausaMin + aleatorio() * forma.pausaVariacao;
  }
  return silabas;
}

/** A duração total de um plano, em segundos. */
export function duracaoDaResposta(silabas: readonly Silaba[]): number {
  const ultima = silabas.at(-1);
  return ultima ? ultima.inicio + ultima.duracao : 0;
}

/** O timbre: a modulação em anel por uma senoide grave — o som clássico de robô. */
const TIMBRE = {
  anel: 55,
  seco: 0.35,
  corte: 2400,
  ataque: 0.012,
  soltura: 0.03,
  folga: 0.05,
} as const;

/**
 * Toca um plano em `saida`, a partir de agora. Tudo sintetizado: osciladores
 * quadrados por sílaba, envelope curto, metade modulada em anel por uma senoide
 * grave e metade seca, por um passa-baixa. Devolve a duração em segundos.
 */
/**
 * A ABERTURA DA BOCA (0–1) no instante `t` (s, desde o começo do plano): o
 * mesmo envelope que o som toca — sobe no ataque, fica, cai na soltura — vezes
 * o peso da sílaba (as mais fortes abrem mais). Calculada do PLANO e do relógio
 * do áudio, não do volume medido: fica em sincronia com o som em qualquer taxa
 * de quadros (medir a saída em quadros esparsos pegava os silêncios entre as
 * sílabas, e a boca mal mexia). Zero antes, depois e entre as sílabas.
 */
export function aberturaDaBocaEm(silabas: readonly Silaba[], t: number): number {
  for (const silaba of silabas) {
    if (t < silaba.inicio) return 0;
    const fim = silaba.inicio + silaba.duracao;
    if (t > fim) continue;
    const subida = Math.min(1, (t - silaba.inicio) / TIMBRE.ataque);
    const descida = Math.min(1, (fim - t) / TIMBRE.soltura);
    const peso = 0.5 + 0.5 * ((silaba.volume - RESPOSTA.volumeMin) / (1 - RESPOSTA.volumeMin));
    return Math.max(0, Math.min(1, Math.min(subida, descida) * peso));
  }
  return 0;
}

/**
 * O som que começou a tocar: o relógio do contexto (s) em que o plano começa e
 * acaba, e como PARAR — uma pergunta nova no meio da resposta corta a anterior
 * (achado da revisão: sem isso, duas vozes se sobrepunham).
 */
export type RespostaTocando = { readonly silabas: readonly Silaba[]; readonly inicio: number; readonly fim: number; readonly parar: () => void };

export function tocarResposta(contexto: AudioContext, silabas: readonly Silaba[], saida: AudioNode): RespostaTocando {
  const t0 = contexto.currentTime + TIMBRE.folga;
  const total = duracaoDaResposta(silabas);

  const filtro = contexto.createBiquadFilter();
  filtro.type = "lowpass";
  filtro.frequency.value = TIMBRE.corte;
  filtro.connect(saida);

  // Anel: o ganho do nó É a senoide (−1…1), então o sinal sai multiplicado por ela.
  const anel = contexto.createGain();
  anel.gain.value = 0;
  const modulador = contexto.createOscillator();
  modulador.frequency.value = TIMBRE.anel;
  modulador.connect(anel.gain);
  anel.connect(filtro);

  const seco = contexto.createGain();
  seco.gain.value = TIMBRE.seco;
  seco.connect(filtro);

  const vozes: OscillatorNode[] = [];
  for (const silaba of silabas) {
    const inicio = t0 + silaba.inicio;
    const fim = inicio + silaba.duracao;
    const voz = contexto.createOscillator();
    vozes.push(voz);
    voz.type = "square";
    voz.frequency.setValueAtTime(silaba.frequencia, inicio);
    voz.frequency.linearRampToValueAtTime(silaba.frequencia + silaba.deslize, fim);
    const envelope = contexto.createGain();
    envelope.gain.setValueAtTime(0, inicio);
    envelope.gain.linearRampToValueAtTime(silaba.volume, inicio + TIMBRE.ataque);
    envelope.gain.setValueAtTime(silaba.volume, Math.max(inicio + TIMBRE.ataque, fim - TIMBRE.soltura));
    envelope.gain.linearRampToValueAtTime(0, fim);
    voz.connect(envelope);
    envelope.connect(anel);
    envelope.connect(seco);
    voz.start(inicio);
    voz.stop(fim + TIMBRE.folga);
  }
  modulador.start(t0);
  modulador.stop(t0 + total + TIMBRE.folga);
  // Acabou a resposta: solta os nós dela da saída, para uma conversa longa não
  // ir acumulando filtros e ganhos pendurados no grafo.
  modulador.onended = () => {
    anel.disconnect();
    seco.disconnect();
    filtro.disconnect();
  };
  // Parar antecipa o fim de todos os osciladores (o `onended` do modulador
  // solta os nós); uma sílaba ainda não começada simplesmente não toca.
  const parar = () => {
    const agora = contexto.currentTime;
    for (const voz of vozes) {
      try {
        voz.stop(agora);
      } catch {
        // já parou
      }
    }
    try {
      modulador.stop(agora);
    } catch {
      // já parou
    }
  };
  return { silabas, inicio: t0, fim: t0 + total, parar };
}

/**
 * O timbre da FALA SIMULADA: dente de serra (o zumbido de uma voz) com vibrato,
 * uma ressonância de vogal (pico em ~700 Hz) e um passa-baixa que tira o
 * brilho — macio e grave ao lado do robô, que é quadrado e metálico.
 */
const TIMBRE_SIMULADO = {
  vibrato: 5.5,
  vibratoProfundidade: 3,
  vogal: 700,
  vogalQ: 1.2,
  vogalGanho: 9,
  corte: 1800,
  ganho: 0.9,
  ataque: 0.025,
  soltura: 0.05,
  folga: 0.05,
} as const;

/** Toca a fala simulada em `saida`, a partir de agora — como `tocarResposta`, noutro timbre. */
export function tocarFalaSimulada(contexto: AudioContext, silabas: readonly Silaba[], saida: AudioNode): RespostaTocando {
  const t0 = contexto.currentTime + TIMBRE_SIMULADO.folga;
  const total = duracaoDaResposta(silabas);

  const passaBaixa = contexto.createBiquadFilter();
  passaBaixa.type = "lowpass";
  passaBaixa.frequency.value = TIMBRE_SIMULADO.corte;
  const vogal = contexto.createBiquadFilter();
  vogal.type = "peaking";
  vogal.frequency.value = TIMBRE_SIMULADO.vogal;
  vogal.Q.value = TIMBRE_SIMULADO.vogalQ;
  vogal.gain.value = TIMBRE_SIMULADO.vogalGanho;
  const ganho = contexto.createGain();
  ganho.gain.value = TIMBRE_SIMULADO.ganho;
  vogal.connect(passaBaixa);
  passaBaixa.connect(ganho);
  ganho.connect(saida);

  // O vibrato: uma senoide lenta somada à frequência de cada sílaba.
  const vibrato = contexto.createOscillator();
  vibrato.frequency.value = TIMBRE_SIMULADO.vibrato;
  const profundidade = contexto.createGain();
  profundidade.gain.value = TIMBRE_SIMULADO.vibratoProfundidade;
  vibrato.connect(profundidade);

  const vozes: OscillatorNode[] = [];
  for (const silaba of silabas) {
    const inicio = t0 + silaba.inicio;
    const fim = inicio + silaba.duracao;
    const voz = contexto.createOscillator();
    voz.type = "sawtooth";
    voz.frequency.setValueAtTime(silaba.frequencia, inicio);
    voz.frequency.linearRampToValueAtTime(silaba.frequencia + silaba.deslize, fim);
    profundidade.connect(voz.frequency);
    vozes.push(voz);
    const envelope = contexto.createGain();
    envelope.gain.setValueAtTime(0, inicio);
    envelope.gain.linearRampToValueAtTime(silaba.volume, inicio + TIMBRE_SIMULADO.ataque);
    envelope.gain.setValueAtTime(silaba.volume, Math.max(inicio + TIMBRE_SIMULADO.ataque, fim - TIMBRE_SIMULADO.soltura));
    envelope.gain.linearRampToValueAtTime(0, fim);
    voz.connect(envelope);
    envelope.connect(vogal);
    voz.start(inicio);
    voz.stop(fim + TIMBRE_SIMULADO.folga);
  }
  vibrato.start(t0);
  vibrato.stop(t0 + total + TIMBRE_SIMULADO.folga);
  vibrato.onended = () => {
    profundidade.disconnect();
    vogal.disconnect();
    passaBaixa.disconnect();
    ganho.disconnect();
  };
  const parar = () => {
    const agora = contexto.currentTime;
    for (const voz of vozes) {
      try {
        voz.stop(agora);
      } catch {
        // já parou
      }
    }
    try {
      vibrato.stop(agora);
    } catch {
      // já parou
    }
  };
  return { silabas, inicio: t0, fim: t0 + total, parar };
}

/** O RMS de um trecho de sinal (−1…1). */
export function rms(amostras: Float32Array): number {
  let soma = 0;
  for (let i = 0; i < amostras.length; i++) soma += amostras[i]! * amostras[i]!;
  return Math.sqrt(soma / Math.max(1, amostras.length));
}
