/**
 * A linha do tempo do vídeo, a partir do `roteiro.json` da gravação — puro,
 * sem React. O vídeo não é a gravação em 1×: os trechos entre as marcas
 * (página carregando, digitação, cursor andando) passam acelerados, e as
 * marcas (o que se lê) quase no tempo real.
 */

export interface Caixa {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface Marca {
  readonly inicio: number;
  readonly fim: number;
  readonly titulo: string;
  readonly texto: string;
  readonly foco?: Caixa;
}

export interface Roteiro {
  readonly largura: number;
  readonly altura: number;
  readonly escala: number;
  readonly quadros: ReadonlyArray<{ readonly t: number; readonly arquivo: string }>;
  readonly cursor: ReadonlyArray<{ readonly t: number; readonly x: number; readonly y: number }>;
  readonly cliques: ReadonlyArray<{ readonly t: number; readonly x: number; readonly y: number }>;
  readonly marcas: readonly Marca[];
  readonly duracao: number;
}

export const FPS = 30;
export const ABERTURA = 3.2;
export const FECHAMENTO = 4;
/** Fora das marcas: a gravação anda mais rápido que o real. */
export const VELOCIDADE_FORA = 1.8;
/** Nas marcas: um pouco acima do real (a legenda é curta). */
export const VELOCIDADE_NA_MARCA = 1.2;
/** Tela parada fora das marcas (esperando a página, pausa entre ações): cada trecho vira só isto. */
const PARADA_NO_VIDEO = 0.15;
const PARADA_MINIMA = 0.6;

interface Trecho {
  readonly de: number; // tempo do vídeo (s), desde o fim da abertura
  readonly ate: number;
  readonly gravacaoDe: number;
  readonly gravacaoAte: number;
}

/** Trechos em que nada mudou na tela nem no cursor, fora das marcas. */
function paradas(roteiro: Roteiro, marcas: readonly Marca[]): [number, number][] {
  const emMarca = (t: number) => marcas.some((m) => t >= m.inicio && t <= m.fim);
  const eventos = [...roteiro.quadros.map((q) => q.t), ...roteiro.cursor.map((c) => c.t), ...marcas.flatMap((m) => [m.inicio, m.fim])].sort((a, b) => a - b);
  const lista: [number, number][] = [];
  for (let i = 1; i < eventos.length; i += 1) {
    const a = eventos[i - 1]!;
    const b = eventos[i]!;
    if (b - a > PARADA_MINIMA && !emMarca((a + b) / 2)) lista.push([a, b]);
  }
  return lista;
}

export function trechos(roteiro: Roteiro): Trecho[] {
  const marcas = [...roteiro.marcas].sort((a, b) => a.inicio - b.inicio);
  const pontos: { de: number; ate: number; velocidade: number }[] = [
    ...marcas.map((m) => ({ de: m.inicio, ate: Math.min(m.fim, roteiro.duracao), velocidade: VELOCIDADE_NA_MARCA })),
    ...paradas(roteiro, marcas).map(([de, ate]) => ({ de, ate, velocidade: (ate - de) / PARADA_NO_VIDEO })),
  ].sort((a, b) => a.de - b.de);
  const lista: Trecho[] = [];
  let gravacao = 0;
  let video = 0;
  const empurrar = (ate: number, velocidade: number) => {
    if (ate <= gravacao) return;
    const duracao = (ate - gravacao) / velocidade;
    lista.push({ de: video, ate: video + duracao, gravacaoDe: gravacao, gravacaoAte: ate });
    video += duracao;
    gravacao = ate;
  };
  for (const ponto of pontos) {
    empurrar(ponto.de, VELOCIDADE_FORA);
    empurrar(ponto.ate, ponto.velocidade);
  }
  empurrar(roteiro.duracao, VELOCIDADE_FORA);
  return lista;
}

export function duracaoDoVideo(roteiro: Roteiro): number {
  const lista = trechos(roteiro);
  return ABERTURA + (lista.at(-1)?.ate ?? 0) + FECHAMENTO;
}

/** O instante da GRAVAÇÃO que aparece no instante `t` do vídeo (contado desde o fim da abertura). */
export function instanteDaGravacao(lista: readonly Trecho[], t: number): number {
  if (lista.length === 0) return 0;
  if (t <= 0) return 0;
  for (const trecho of lista) {
    if (t <= trecho.ate) {
      const k = (t - trecho.de) / Math.max(trecho.ate - trecho.de, 1e-6);
      return trecho.gravacaoDe + k * (trecho.gravacaoAte - trecho.gravacaoDe);
    }
  }
  return lista.at(-1)!.gravacaoAte;
}

/** O último quadro capturado até `t` (busca binária). */
export function quadroEm(roteiro: Roteiro, t: number): string | undefined {
  const q = roteiro.quadros;
  let lo = 0;
  let hi = q.length - 1;
  let achado = -1;
  while (lo <= hi) {
    const meio = (lo + hi) >> 1;
    if (q[meio]!.t <= t) {
      achado = meio;
      lo = meio + 1;
    } else hi = meio - 1;
  }
  return q[Math.max(achado, 0)]?.arquivo;
}

export function cursorEm(roteiro: Roteiro, t: number): { x: number; y: number } {
  const c = roteiro.cursor;
  if (c.length === 0) return { x: roteiro.largura / 2, y: roteiro.altura / 2 };
  if (t <= c[0]!.t) return { x: c[0]!.x, y: c[0]!.y };
  for (let i = 1; i < c.length; i += 1) {
    const b = c[i]!;
    if (t <= b.t) {
      const a = c[i - 1]!;
      const k = (t - a.t) / Math.max(b.t - a.t, 1e-6);
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    }
  }
  const ultimo = c.at(-1)!;
  return { x: ultimo.x, y: ultimo.y };
}

export interface Camera {
  readonly escala: number;
  readonly cx: number; // centro, em px da página
  readonly cy: number;
}

const suave = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);

/** A faixa de baixo onde a legenda mora; o foco é enquadrado acima dela. */
export const ALTURA_DA_LEGENDA = 170;

/** A câmera que enquadra a caixa em foco acima da legenda, sem mostrar nada fora da página. */
export function cameraPara(roteiro: Roteiro, foco: Caixa | undefined): Camera {
  const W = roteiro.largura;
  const H = roteiro.altura;
  if (!foco) return { escala: 1, cx: W / 2, cy: H / 2 };
  const util = H - ALTURA_DA_LEGENDA;
  const escala = Math.max(1, Math.min(1.6, (W * 0.86) / foco.w, (util * 0.9) / foco.h));
  const meiaL = W / (2 * escala);
  const meiaA = H / (2 * escala);
  // Na tela, o centro do foco vai para o meio da área acima da legenda.
  const cx = Math.min(Math.max(foco.x + foco.w / 2, meiaL), W - meiaL);
  const cy = Math.min(Math.max(foco.y + foco.h / 2 + (H / 2 - util / 2) / escala, meiaA), H - meiaA);
  return { escala, cx, cy };
}

/** A câmera no instante `t` da gravação: transições suaves de 0,7 s entre enquadramentos. */
export function cameraEm(roteiro: Roteiro, t: number): Camera {
  const TRANSICAO = 0.7;
  const marcas = [...roteiro.marcas].sort((a, b) => a.inicio - b.inicio);
  const estados: { de: number; camera: Camera }[] = [{ de: 0, camera: cameraPara(roteiro, undefined) }];
  for (const marca of marcas) {
    estados.push({ de: marca.inicio, camera: cameraPara(roteiro, marca.foco) });
    estados.push({ de: marca.fim, camera: cameraPara(roteiro, undefined) });
  }
  estados.sort((a, b) => a.de - b.de);
  let i = 0;
  while (i + 1 < estados.length && estados[i + 1]!.de <= t) i += 1;
  const atual = estados[i]!;
  const anterior = estados[i - 1];
  if (!anterior || t - atual.de >= TRANSICAO) return atual.camera;
  const k = suave((t - atual.de) / TRANSICAO);
  return {
    escala: anterior.camera.escala + (atual.camera.escala - anterior.camera.escala) * k,
    cx: anterior.camera.cx + (atual.camera.cx - anterior.camera.cx) * k,
    cy: anterior.camera.cy + (atual.camera.cy - anterior.camera.cy) * k,
  };
}
