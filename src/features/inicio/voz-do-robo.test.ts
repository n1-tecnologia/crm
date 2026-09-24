import { describe, expect, it } from "vitest";
import {
  ESCUTA,
  FALA_SIMULADA,
  RESPOSTA,
  aberturaDaBocaEm,
  criarDetectorDeFala,
  duracaoDaResposta,
  planejarResposta,
  planejarSilabas,
  rms,
  silabasDaFala,
  silabasDoTexto,
  type Silaba,
} from "./voz-do-robo";

describe("a fala simulada", () => {
  it("duas sílabas por palavra, entre o mínimo e o máximo", () => {
    expect(silabasDaFala("Oi")).toBe(FALA_SIMULADA.silabasMin);
    expect(silabasDaFala("Quantas tarefas vencidas eu tenho?")).toBe(10);
    expect(silabasDaFala(Array.from({ length: 40 }, () => "palavra").join(" "))).toBe(FALA_SIMULADA.silabasMax);
  });

  it("na forma simulada, as notas ficam na faixa de uma voz falada, mais graves que as do robô", () => {
    for (const sorteio of [0, 0.5, 0.999]) {
      const plano = planejarSilabas(6, () => sorteio, FALA_SIMULADA);
      for (const silaba of plano) {
        expect(silaba.frequencia).toBeGreaterThanOrEqual(FALA_SIMULADA.notaMin);
        expect(silaba.frequencia).toBeLessThanOrEqual(FALA_SIMULADA.notaMin + FALA_SIMULADA.notaVariacao);
        expect(Math.abs(silaba.deslize)).toBeLessThanOrEqual(FALA_SIMULADA.deslizeMax * silaba.frequencia + 1e-9);
      }
    }
    expect(FALA_SIMULADA.notaMin + FALA_SIMULADA.notaVariacao).toBeLessThanOrEqual(RESPOSTA.notaMin + RESPOSTA.notaVariacao);
  });
});

describe("sílabas de um texto", () => {
  it("uma por palavra, entre o mínimo e o máximo de texto", () => {
    expect(silabasDoTexto("Olá!")).toBe(RESPOSTA.silabasMin);
    expect(silabasDoTexto("Você tem 4 tarefas abertas, 2 vencidas.")).toBe(7);
    expect(silabasDoTexto(Array.from({ length: 80 }, () => "palavra").join(" "))).toBe(RESPOSTA.silabasMaxTexto);
    expect(silabasDoTexto("   ")).toBe(RESPOSTA.silabasMin);
  });

  it("o plano tem exatamente as sílabas pedidas, em ordem, sem se sobrepor", () => {
    const plano = planejarSilabas(9, () => 0.5);
    expect(plano).toHaveLength(9);
    for (let i = 1; i < plano.length; i++) {
      const anterior = plano[i - 1]!;
      expect(plano[i]!.inicio).toBeGreaterThanOrEqual(anterior.inicio + anterior.duracao + RESPOSTA.pausaMin);
    }
  });
});

/** Alimenta o detector com um nível constante de `de` a `ate` ms, em passos de 16 ms. */
function trecho(detector: ReturnType<typeof criarDetectorDeFala>, nivel: number, de: number, ate: number) {
  const eventos: { readonly tipo: string; readonly em: number; readonly duracao?: number }[] = [];
  for (let t = de; t < ate; t += 16) {
    const e = detector.amostra(nivel, t);
    if (e) eventos.push({ ...e, em: t });
  }
  return eventos;
}

describe("detector de fala por nível", () => {
  it("silêncio não dispara nada", () => {
    const d = criarDetectorDeFala();
    expect(trecho(d, 0.005, 0, 3000)).toEqual([]);
    expect(d.falando).toBe(false);
  });

  it("uma fala começa depois do instante de confirmação e termina depois do silêncio", () => {
    const d = criarDetectorDeFala();
    trecho(d, 0.005, 0, 1000);
    const fala = trecho(d, 0.12, 1000, 2500);
    expect(fala.map((e) => e.tipo)).toEqual(["comecou"]);
    expect(fala[0]!.em - 1000).toBeGreaterThanOrEqual(ESCUTA.confirmaInicio);
    const fim = trecho(d, 0.005, 2500, 4000);
    expect(fim.map((e) => e.tipo)).toEqual(["terminou"]);
    // O silêncio conta a partir da última amostra alta (2484 ms, passos de 16).
    expect(fim[0]!.em - 2484).toBeGreaterThanOrEqual(ESCUTA.silencioParaFim);
    expect(fim[0]!.duracao).toBeGreaterThan(1200);
    expect(d.falando).toBe(false);
  });

  it("um estalo curto não conta como começo", () => {
    const d = criarDetectorDeFala();
    trecho(d, 0.005, 0, 500);
    expect(trecho(d, 0.2, 500, 560)).toEqual([]);
    expect(trecho(d, 0.005, 560, 2000)).toEqual([]);
  });

  it("uma fala curta demais sai como ruído, não como fala", () => {
    const d = criarDetectorDeFala();
    trecho(d, 0.005, 0, 500);
    trecho(d, 0.12, 500, 700);
    const fim = trecho(d, 0.005, 700, 2000);
    expect(fim.map((e) => e.tipo)).toEqual(["ruido"]);
  });

  it("uma pausa curta entre palavras não encerra a fala (histerese)", () => {
    const d = criarDetectorDeFala();
    trecho(d, 0.005, 0, 500);
    trecho(d, 0.12, 500, 1200);
    expect(trecho(d, 0.005, 1200, 1500)).toEqual([]);
    expect(trecho(d, 0.12, 1500, 2200)).toEqual([]);
    expect(d.falando).toBe(true);
  });

  it("o piso se adapta: num ambiente ruidoso o ruído constante não vira fala", () => {
    const d = criarDetectorDeFala();
    trecho(d, 0.018, 0, 4000);
    expect(d.limiar).toBeGreaterThan(0.04);
    expect(trecho(d, 0.03, 4000, 6000)).toEqual([]);
  });

  it("um ruído que não cessa não prende o robô ouvindo", () => {
    const d = criarDetectorDeFala();
    trecho(d, 0.005, 0, 500);
    const eventos = trecho(d, 0.5, 500, 500 + 3 * ESCUTA.duracaoMaxima);
    expect(eventos.map((e) => e.tipo)).toEqual(["comecou", "terminou"]);
    // Só volta a ouvir depois de um silêncio.
    trecho(d, 0.005, 40_000, 41_000);
    expect(trecho(d, 0.5, 41_000, 42_000).map((e) => e.tipo)).toEqual(["comecou"]);
  });

  it("reiniciar esquece a fala em curso", () => {
    const d = criarDetectorDeFala();
    trecho(d, 0.005, 0, 500);
    trecho(d, 0.12, 500, 1200);
    d.reiniciar();
    expect(d.falando).toBe(false);
  });
});

describe("plano da resposta do robô", () => {
  const semente = (valores: readonly number[]) => {
    let i = 0;
    return () => valores[i++ % valores.length]!;
  };

  it("fala mais quando ouviu mais, dentro dos limites", () => {
    expect(planejarResposta(100, semente([0.5]))).toHaveLength(RESPOSTA.silabasMin);
    expect(planejarResposta(1100, semente([0.5]))).toHaveLength(5);
    expect(planejarResposta(60_000, semente([0.5]))).toHaveLength(RESPOSTA.silabasMax);
  });

  it("as sílabas vêm em ordem, sem se sobrepor, com notas e volumes na faixa", () => {
    const plano = planejarResposta(2000, semente([0.1, 0.9, 0.4, 0.7, 0.2]));
    for (let i = 0; i < plano.length; i++) {
      const s = plano[i]!;
      expect(s.frequencia).toBeGreaterThanOrEqual(RESPOSTA.notaMin);
      expect(s.frequencia).toBeLessThanOrEqual(RESPOSTA.notaMin + RESPOSTA.notaVariacao);
      expect(Math.abs(s.deslize)).toBeLessThanOrEqual(RESPOSTA.deslizeMax * s.frequencia + 1e-9);
      expect(s.volume).toBeGreaterThanOrEqual(RESPOSTA.volumeMin);
      expect(s.volume).toBeLessThanOrEqual(1);
      if (i > 0) expect(s.inicio).toBeGreaterThan(plano[i - 1]!.inicio + plano[i - 1]!.duracao);
    }
    expect(duracaoDaResposta(plano)).toBeCloseTo(plano.at(-1)!.inicio + plano.at(-1)!.duracao);
  });

  it("um plano vazio dura zero", () => {
    expect(duracaoDaResposta([])).toBe(0);
  });
});

describe("abertura da boca pelo plano", () => {
  const plano: readonly Silaba[] = [
    { inicio: 0, duracao: 0.1, frequencia: 300, deslize: 0, volume: 1 },
    { inicio: 0.2, duracao: 0.1, frequencia: 300, deslize: 0, volume: RESPOSTA.volumeMin },
  ];

  it("fechada antes, entre e depois das sílabas", () => {
    expect(aberturaDaBocaEm(plano, -0.01)).toBe(0);
    expect(aberturaDaBocaEm(plano, 0.15)).toBe(0);
    expect(aberturaDaBocaEm(plano, 0.4)).toBe(0);
  });

  it("abre no meio da sílaba, mais na forte que na fraca", () => {
    expect(aberturaDaBocaEm(plano, 0.05)).toBe(1);
    expect(aberturaDaBocaEm(plano, 0.25)).toBeCloseTo(0.5);
  });

  it("sobe no ataque e cai na soltura, sem saltos", () => {
    expect(aberturaDaBocaEm(plano, 0)).toBe(0);
    expect(aberturaDaBocaEm(plano, 0.006)).toBeGreaterThan(0);
    expect(aberturaDaBocaEm(plano, 0.006)).toBeLessThan(1);
    expect(aberturaDaBocaEm(plano, 0.1)).toBe(0);
    expect(aberturaDaBocaEm(plano, 0.09)).toBeGreaterThan(0);
    expect(aberturaDaBocaEm(plano, 0.09)).toBeLessThan(1);
  });
});

describe("rms", () => {
  it("mede a energia do sinal", () => {
    expect(rms(new Float32Array([0, 0, 0, 0]))).toBe(0);
    expect(rms(new Float32Array([0.5, -0.5, 0.5, -0.5]))).toBeCloseTo(0.5);
  });
});
