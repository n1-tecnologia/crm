"use client";

/**
 * CENA SPLINE — uma cena 3D do Spline (a do `SplineScene` do componente
 * `splite` do 21st.dev), no palco do Início desde 2026-09-23: o robô.
 *
 * Oito diferenças do original, todas por causa do app, não de gosto:
 *
 * 1. SEM o `@splinetool/react-spline`: o canvas e o runtime são montados aqui
 *    (`Tela`), com o MOTOR FIXO no clássico (`renderer: "webgl"`). O wrapper
 *    não deixa escolher o motor, e o runtime escolhe sozinho o novo (WebGPU,
 *    o "node pipeline") onde o navegador tem WebGPU — e nele a `updateTexture`
 *    da camada matcap quebra por dentro (TypeError no runtime 2.0.56): o rosto
 *    do robô ficava branco no Chrome de verdade e roxo no teste sem GPU.
 *    Fixo, o desenho é o mesmo em toda máquina. O runtime (~1 MB) desce por
 *    `import()` só no navegador e só quando a cena monta.
 * 2. UMA FALHA DE CARGA NÃO DERRUBA A TELA (sem rede, Spline fora do ar, cena
 *    apagada): a cena some em silêncio, avisa no console uma vez, e a casca e
 *    a navegação seguem.
 * 3. MOVIMENTO REDUZIDO: a cena monta e para (`app.stop()`) — o robô fica,
 *    parado, como a regra do sistema pede para todo laço — e não ouve o
 *    ponteiro. Parada, ela redesenha um quadro a cada redimensionamento.
 * 4. A CÂMERA PODE FICAR FIXA (`camera`): a cena do robô abre com a câmera
 *    colada no rosto e, em ~4 s, recua sozinha até o corpo inteiro — uma
 *    transição de "Start" gravada na própria cena. Com `camera`, essa abertura
 *    para no carregamento e a câmera fica na pose pedida (2026-09-23: "o robô
 *    bem maior, da cintura pra cima, bem close"). Com `camera.partida`, a
 *    entrada volta, nossa: o mesmo zoom out, bem mais curto, que termina na
 *    pose pedida ("volte o efeito de entrada… fazendo com que ele fique nessa
 *    posição"). Os tempos e a curva são tokens; movimento reduzido a pula.
 * 5. AS LUZES PODEM SER RETINGIDAS (`luzes`), com a cor de um token: no robô,
 *    o contraluz da cena no roxo da marca pinta os reflexos de borda
 *    (ombros, braços, pescoço).
 * 6. OS REFLEXOS DE CROMO PODEM SER RETINGIDOS (`reflexos`): o matcap do rosto
 *    do robô vira um degradê do preto ao roxo da marca ("o reflexo branco da
 *    cara deve ser roxo também"). O canvas só aparece depois da tinta.
 * 7. UM SELO PODE SER PINTADO SOBRE UMA MALHA (`selo`): a logo da N1 no peito
 *    do robô ("com efeito de sobrepor"), em modo SOBREPOR sobre o desenho da
 *    cena e presa ao tronco — projetada pela câmera a cada quadro desenhado,
 *    ela gira junto quando o robô acompanha o cursor. Com `aoAcionar`, a
 *    camada de luz vira um BOTÃO de verdade (foco, Enter, leitor de tela).
 * 8. UMA BOCA DE PONTOS (`boca`), no padrão dos olhos, projetada sobre o
 *    rosto como o selo; abre e fecha com `abertura()` (0–1) a cada quadro
 *    desenhado — no Início, o volume da voz do robô quando ele responde.
 * 9. UMA ÂNCORA PARA UM BALÃO (`balao` + `children`): um ponto ao lado de
 *    uma malha projetado na tela a cada quadro desenhado, escrito na raiz
 *    (`--balao-x`, `--balao-y`, `data-balao-lado`) — e o que vier em
 *    `children` é montado dentro da raiz, para se pendurar nele. No Início,
 *    o balão de chat ao lado da cabeça do robô.
 *
 * Enquanto o runtime e a cena descem, um indicador de carregamento.
 *
 * É decoração: quem usa marca o contêiner com `aria-hidden`, e a cena não
 * entra na ordem de foco (o canvas nasce sem `tabindex`).
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Application, MatcapLayer } from "@splinetool/runtime";
import { Loader2 } from "lucide-react";
import { cn } from "./cn";
import { Icone } from "./icone";
import { BOCA, PONTOS_DA_BOCA, pontoDaBocaAceso } from "./boca-de-pontos";
import { bezierDe, lerDuracao, reduzido } from "./movimento";

function Carregando() {
  return (
    <div className="cena-spline-carregando">
      <Icone de={Loader2} tamanho="md" className="girando" />
    </div>
  );
}

/**
 * O canvas e o runtime. Monta o `Application` com o motor clássico, carrega a
 * cena e entrega a instância a `aoCarregar`; desmontar a descarta. No
 * desenvolvimento o StrictMode monta e desmonta uma vez antes de montar de
 * verdade: a primeira montagem é descartada antes de a cena chegar e nunca
 * chama `aoCarregar`.
 */
function Tela({
  cena,
  className,
  tingindo,
  desenhoDoSelo,
  acaoDoSelo,
  comBoca = false,
  aoCarregar,
  aoFalhar,
  children,
}: {
  readonly cena: string;
  readonly className?: string;
  readonly tingindo: boolean;
  /** Montado dentro da raiz, depois das camadas da cena (o balão do Início). */
  readonly children?: ReactNode;
  /** Os `d` do selo, na caixa 0–100; sem selo, nada. */
  readonly desenhoDoSelo?: readonly string[];
  /** Com isto, a camada de luz do selo é um botão. */
  readonly acaoDoSelo?: { readonly rotulo: string; readonly ativo: boolean; readonly aoAcionar: () => void };
  /** Desenha a boca de pontos (a posição e a abertura vêm do `aoCarregar`). */
  readonly comBoca?: boolean;
  readonly aoCarregar: (app: Application, raiz: HTMLDivElement) => void;
  readonly aoFalhar: (erro: unknown) => void;
}) {
  const raiz = useRef<HTMLDivElement>(null);
  const tela = useRef<HTMLCanvasElement>(null);
  const [carregada, setCarregada] = useState(false);
  // Os retornos mudam a cada render; a cena só recarrega quando muda o endereço.
  const retornos = useRef({ aoCarregar, aoFalhar });
  useEffect(() => {
    retornos.current = { aoCarregar, aoFalhar };
  });

  useEffect(() => {
    const canvas = tela.current;
    const contêiner = raiz.current;
    if (!canvas || !contêiner) return undefined;
    let montada = true;
    let app: Application | undefined;
    import("@splinetool/runtime")
      .then(async ({ Application: Runtime }) => {
        if (!montada) return;
        app = new Runtime(canvas, { renderMode: "auto", renderer: "webgl", htmlContentMode: "none" });
        await app.load(cena);
        // Saiu da tela no meio da carga: o `dispose()` da limpeza já rodou, mas
        // o runtime 2.0.56 só confere isso na ENTRADA do `start()` e termina a
        // montagem sozinho, recriando o renderer e ligando o laço num canvas
        // fora do DOM — uma cena zumbi desenhando pelo resto da sessão (achado
        // da revisão, reproduzido: 30 mil desenhos em 3 s). Um segundo
        // `dispose()` agora, antes do `setTimeout(0)` que liga o laço, a encerra.
        if (!montada) {
          app.dispose();
          return;
        }
        setCarregada(true);
        retornos.current.aoCarregar(app, contêiner);
      })
      .catch((erro: unknown) => {
        // Descartada no meio do caminho, a carga pode falhar por isso mesmo:
        // solta o que sobrou (o contexto WebGL) e não avisa nada.
        if (!montada) {
          app?.dispose();
          return;
        }
        retornos.current.aoFalhar(erro);
      });
    return () => {
      montada = false;
      app?.dispose();
    };
  }, [cena]);

  return (
    <div
      ref={raiz}
      className={cn("cena-spline", className)}
      data-carregada={carregada ? "" : undefined}
      data-tingindo={tingindo ? "" : undefined}
    >
      {carregada ? null : <Carregando />}
      <canvas ref={tela} aria-hidden="true" />
      {/* A boca, antes do selo: fica no rosto, e o selo no peito — não se cruzam. */}
      {comBoca ? (
        <svg className="cena-spline-boca" viewBox="0 0 100 100" aria-hidden="true">
          {PONTOS_DA_BOCA.map(({ coluna, linha }) => (
            <circle
              key={`${coluna}:${linha}`}
              cx={50 + coluna * BOCA.passo}
              cy={50 + linha * BOCA.passo}
              r={BOCA.raio}
              data-coluna={coluna}
              data-linha={linha}
            />
          ))}
        </svg>
      ) : null}
      {/* O selo em DUAS camadas de Sobrepor: uma só mal se lê sobre o carbono
          quase preto (sobrepor em cima do escuro quase não clareia). Cada
          camada é irmã do canvas e leva o próprio transform — um pai com
          transform isolaria a mescla e ela deixaria de ver a cena. A TERCEIRA
          é a luz: invisível, acende com o ponteiro em cima da logo. */}
      {desenhoDoSelo
        ? ["sobrepor", "sobrepor", "luz"].map((papel, i) => {
            const desenho = (
              <svg
                key={i}
                className={papel === "luz" && !acaoDoSelo ? "cena-spline-selo cena-spline-selo-luz" : papel === "luz" ? undefined : "cena-spline-selo"}
                viewBox="0 0 100 100"
                aria-hidden="true"
              >
                {desenhoDoSelo.map((d) => (
                  <path key={d} d={d} />
                ))}
              </svg>
            );
            if (papel !== "luz" || !acaoDoSelo) return desenho;
            // A luz acionável: um botão com o desenho dentro — ele leva o
            // transform e a mescla, e o foco o acende como o hover.
            return (
              <button
                key={i}
                type="button"
                className="cena-spline-selo cena-spline-selo-luz"
                aria-label={acaoDoSelo.rotulo}
                aria-pressed={acaoDoSelo.ativo}
                onClick={acaoDoSelo.aoAcionar}
              >
                {desenho}
              </button>
            );
          })
        : null}
      {children}
    </div>
  );
}

/** Um ponto no mundo do Spline; o eixo omitido fica como está. */
type Ponto = { readonly x?: number; readonly y?: number; readonly z?: number };

/** Uma pose FIXA para a câmera da cena, em unidades do mundo do Spline. */
export type PoseDaCamera = Ponto & {
  /** O nome do objeto câmera na cena (o do painel de objetos do Spline). */
  readonly nome: string;
  /**
   * A ENTRADA: a câmera nasce nesta pose, segura `--dur-cena-espera` e viaja
   * até a final em `--dur-cena-entrada`, na curva `--easing-cena-entrada`.
   * Omitida — ou com movimento reduzido — a câmera já nasce na final.
   */
  readonly partida?: Ponto;
};

/**
 * Uma luz da cena retingida com a cor de um TOKEN do sistema (nenhuma cor crua
 * no TSX): `luz` é o nome do objeto luz no Spline, `token` a custom property
 * que dá a cor — lida já resolvida (`var()` substituído) do `:root`.
 */
export type TintaDeLuz = {
  readonly luz: string;
  readonly token: `--${string}`;
};

/** Pinta as luzes pedidas; uma luz que a cena não tem, ou um token vazio, fica como veio. */
function tingirLuzes(app: Application, luzes: readonly TintaDeLuz[]) {
  const raiz = getComputedStyle(document.documentElement);
  let pintou = false;
  for (const { luz, token } of luzes) {
    const objeto = app.findObjectByName(luz);
    const cor = raiz.getPropertyValue(token).trim();
    if (!objeto || !cor) continue;
    objeto.color = cor;
    pintou = true;
  }
  if (pintou) app.requestRender();
}

/**
 * Um SELO pintado sobre uma malha da cena: um desenho SVG (caixa 0–100)
 * centrado em `ponto` e com `largura`, os dois no espaço LOCAL da malha (o da
 * caixa de limites dela), de frente para +z. A cor é a do CSS
 * (`.cena-spline-selo`, token `--selo-robo`).
 */
export type SeloNaCena = {
  readonly objeto: string;
  readonly ponto: readonly [number, number, number];
  readonly largura: number;
  readonly desenho: readonly string[];
  /** Torna a logo um botão: o rótulo para leitor de tela, se está ligado e o que faz. */
  readonly acao?: { readonly rotulo: string; readonly ativo: boolean; readonly aoAcionar: () => void };
};

/**
 * Uma BOCA de pontos presa a uma malha, no padrão gráfico dos olhos do robô
 * (pontos brancos numa elipse). `abertura()` (0–1) é lida a cada quadro
 * desenhado: 0 é a boca fechada, uma linha de pontos; 1, a elipse aberta.
 */
export type BocaNaCena = {
  readonly objeto: string;
  readonly ponto: readonly [number, number, number];
  readonly largura: number;
  readonly abertura: () => number;
  /**
   * Enquanto verdadeira, a boca é redesenhada a CADA QUADRO por um laço
   * próprio. O quadro da cena não basta: com `renderMode: "auto"` o Spline
   * para de desenhar quando nada muda nela (numa GPU de verdade, com o cursor
   * parado), e a boca ficava imóvel enquanto o robô falava — o teste sem GPU
   * não mostrava, porque lá a cena desenha sem parar.
   */
  readonly ativa?: boolean;
};


/** Troca `data-aceso` só nos pontos que mudaram. */
function desenharBoca(pontos: readonly SVGCircleElement[], acesos: boolean[], a: number) {
  pontos.forEach((ponto, i) => {
    const aceso = pontoDaBocaAceso(Number(ponto.dataset.coluna), Number(ponto.dataset.linha), a);
    if (acesos[i] === aceso) return;
    acesos[i] = aceso;
    ponto.dataset.aceso = aceso ? "" : "nao";
  });
}

type Vetor3 = {
  x: number;
  y: number;
  z: number;
  set(x: number, y: number, z: number): Vetor3;
  clone(): Vetor3;
  project(camera: unknown): Vetor3;
};
type Objeto3 = { readonly position: Vetor3; localToWorld(v: Vetor3): Vetor3 };

/** Um ponto no espaço LOCAL de uma malha levado à tela, em px do canvas. */
type NaTela = (x: number, y: number, z: number) => readonly [number, number];

/**
 * O projetor de uma malha: leva pontos do espaço local dela ao canvas, pela
 * malha e pela câmera do three.js DENTRO do runtime. NÃO HÁ API pública para a
 * posição de um ponto na tela. Sem elas (forma interna nova), devolve undefined
 * e quem depende disso não aparece — nada quebra.
 */
function projetorDaMalha(app: Application, objeto: string): NaTela | undefined {
  try {
    const contexto = (
      app.eventManager as
        | { handlers?: { Spline?: { eventContext?: { scene?: { getObjectByName?: (nome: string) => unknown }; getCamera?: () => unknown } } } }
        | undefined
    )?.handlers?.Spline?.eventContext;
    const malha = contexto?.scene?.getObjectByName?.(objeto) as Objeto3 | undefined;
    const camera = contexto?.getCamera?.();
    if (!malha || !camera || typeof malha.localToWorld !== "function" || typeof malha.position?.clone !== "function") {
      return undefined;
    }
    const v = malha.position.clone();
    return (x, y, z) => {
      v.set(x, y, z);
      malha.localToWorld(v);
      v.project(camera);
      return [((v.x + 1) / 2) * app.canvas.clientWidth, ((1 - v.y) / 2) * app.canvas.clientHeight];
    };
  } catch {
    return undefined;
  }
}

/**
 * O projetor do selo: a cada chamada, leva três pontos da malha (o centro, meia
 * largura à direita, meia largura acima) do mundo 3D à tela e escreve a matriz
 * afim que põe a caixa 0–100 do SVG sobre eles (`--selo-matriz` na raiz).
 */
function projetorDoSelo(
  app: Application,
  raiz: HTMLElement,
  selo: Pick<SeloNaCena, "objeto" | "ponto" | "largura">,
  propriedade: `--${string}` = "--selo-matriz",
  marca = "selo",
): (() => void) | undefined {
  const naTela = projetorDaMalha(app, selo.objeto);
  if (!naTela) return undefined;
  const [px, py, pz] = selo.ponto;
  const meia = selo.largura / 2;
  return () => {
    const [cx, cy] = naTela(px, py, pz);
    const [dx, dy] = naTela(px + meia, py, pz);
    const [ax, ay] = naTela(px, py + meia, pz);
    // Colunas da matriz: o eixo x do SVG vai para a direita da malha; o y
    // do SVG (para baixo) é o contrário do "acima" dela. 50 = meia caixa.
    const a = (dx - cx) / 50;
    const b = (dy - cy) / 50;
    const c = (cx - ax) / 50;
    const d = (cy - ay) / 50;
    raiz.style.setProperty(propriedade, `matrix(${a}, ${b}, ${c}, ${d}, ${cx - 50 * a - 50 * c}, ${cy - 50 * b - 50 * d})`);
    raiz.dataset[marca] = "";
  };
}

/**
 * Uma ÂNCORA ao lado de uma malha, para pendurar um balão: `ponto` é o lugar
 * à direita dela (espaço local), `espelho` o mesmo lugar à esquerda. O balão
 * fica à direita, salvo quando sobram menos de `minimo` px até a borda do
 * canvas e à esquerda cabe — aí espelha.
 */
export type AncoraNaCena = {
  readonly objeto: string;
  readonly ponto: readonly [number, number, number];
  readonly espelho: readonly [number, number, number];
  readonly minimo: number;
};

/**
 * O projetor do balão: escreve na raiz o ponto na tela (`--balao-x`,
 * `--balao-y`, em px do canvas) e o lado (`data-balao-lado`), só quando mudam.
 */
function projetorDoBalao(app: Application, raiz: HTMLElement, ancora: AncoraNaCena): (() => void) | undefined {
  const naTela = projetorDaMalha(app, ancora.objeto);
  if (!naTela) return undefined;
  const [dx, dy, dz] = ancora.ponto;
  const [ex, ey, ez] = ancora.espelho;
  let ultimo = "";
  return () => {
    let [x, y] = naTela(dx, dy, dz);
    let lado = "direita";
    if (app.canvas.clientWidth - x < ancora.minimo) {
      const [xe, ye] = naTela(ex, ey, ez);
      if (xe >= ancora.minimo) {
        lado = "esquerda";
        x = xe;
        y = ye;
      }
    }
    const chave = `${Math.round(x)}:${Math.round(y)}:${lado}`;
    if (chave === ultimo) return;
    ultimo = chave;
    raiz.style.setProperty("--balao-x", `${Math.round(x)}px`);
    raiz.style.setProperty("--balao-y", `${Math.round(y)}px`);
    raiz.dataset.balaoLado = lado;
    raiz.dataset.balao = "";
  };
}

/**
 * Para as transições de "Start" que a cena dispara sobre um objeto. NÃO HÁ API
 * pública para isso (nem `state`, nem `transition` desfazem uma que já corre —
 * testado): lê o gerenciador de eventos do runtime com cautela. Devolve
 * `"desconhecido"` se a forma interna mudou numa versão nova do runtime — aí a
 * cena segue como veio, a câmera recua, e nada quebra.
 */
function pararAberturaDe(app: Application, nome: string): "parou" | "nada" | "desconhecido" {
  try {
    const porObjeto: unknown = (app.eventManager as { handlers?: { Start?: { eventsPerObject?: unknown } } } | undefined)
      ?.handlers?.Start?.eventsPerObject;
    if (!(porObjeto instanceof Map)) return "desconhecido";
    let parou = false;
    for (const [objeto, eventos] of porObjeto as Map<{ name?: unknown } | null, unknown>) {
      if (objeto?.name !== nome || !Array.isArray(eventos)) continue;
      for (const evento of eventos as { actions?: { Transition?: unknown } }[]) {
        const transicoes = evento.actions?.Transition;
        if (!Array.isArray(transicoes)) continue;
        for (const transicao of transicoes as { stop?: unknown }[]) {
          if (typeof transicao.stop !== "function") return "desconhecido";
          (transicao.stop as () => void).call(transicao);
          parou = true;
        }
      }
    }
    return parou ? "parou" : "nada";
  } catch {
    return "desconhecido";
  }
}

/**
 * Um reflexo da cena retingido: o MATCAP de um objeto (a textura que desenha
 * os reflexos de cromo, como os brancos no rosto do robô) vira um degradê do
 * preto a `cor` e, no brilho mais forte, a `brilho` — as duas de token.
 */
export type TintaDeReflexo = {
  /** O nome da malha no Spline (a do rosto do robô é "Head 2"). */
  readonly objeto: string;
  readonly cor: `--${string}`;
  readonly brilho: `--${string}`;
};

/** A partir de que luminância do matcap o reflexo passa da cor ao brilho. */
const LIMIAR_DO_BRILHO = 0.7;
/** O maior lado do matcap retingido: o rosto nunca ocupa mais que isso na tela, e o custo cai 4× em relação ao original de 2000 px. */
const LADO_MAX_DO_MATCAP = 1024;

/**
 * Uma cor CSS qualquer (lida de um token) em [r, g, b], pelo próprio canvas: ele
 * normaliza toda cor opaca para `#rrggbb`. Parte do `transparent` — que vira
 * `rgba(…)` —, então uma cor inválida (ignorada pelo canvas) não casa e dá null.
 */
function rgbDe(contexto: CanvasRenderingContext2D, cor: string): [number, number, number] | null {
  contexto.fillStyle = "transparent";
  contexto.fillStyle = cor;
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(contexto.fillStyle);
  return m ? [parseInt(m[1]!, 16), parseInt(m[2]!, 16), parseInt(m[3]!, 16)] : null;
}

/** Os bytes (ou o endereço) de uma imagem da cena, decodificados num `<img>`. */
async function decodificar(dado: string | Uint8Array): Promise<{ readonly imagem: HTMLImageElement; readonly soltar: () => void }> {
  let url: string;
  let soltar = () => {};
  if (typeof dado === "string") {
    url = dado;
  } else {
    // Cópia: o array da cena pode ser uma vista sobre um buffer maior, e o
    // `createImageBitmap` direto nele não decodifica (testado).
    const copia = new Uint8Array(dado.length);
    copia.set(dado);
    url = URL.createObjectURL(new Blob([copia], { type: "image/png" }));
    soltar = () => URL.revokeObjectURL(url);
  }
  const imagem = new Image();
  imagem.crossOrigin = "anonymous";
  imagem.src = url;
  await imagem.decode();
  return { imagem, soltar };
}

/**
 * Retinge os matcaps pedidos. Pela API pública do runtime: a camada `matcap`
 * do material expõe a textura (`texture.image.data`, os bytes do PNG) e
 * `updateTexture` — o resto do material não se edita (é um retrato). Cada
 * objeto tem o SEU matcap: pintar o do rosto não pinta o corpo. Falhou
 * (formato novo, imagem que não decodifica), o reflexo fica como veio.
 */
async function tingirReflexos(app: Application, reflexos: readonly TintaDeReflexo[]): Promise<void> {
  const raiz = getComputedStyle(document.documentElement);
  await Promise.all(
    reflexos.map(async ({ objeto, cor, brilho }) => {
      const material = app.findObjectByName(objeto)?.material;
      const camada =
        material && "layers" in material
          ? material.layers.find((l): l is MatcapLayer => l.type === "matcap")
          : undefined;
      if (!camada || typeof camada.updateTexture !== "function") return;
      const tela = document.createElement("canvas");
      const contexto = tela.getContext("2d", { willReadFrequently: true });
      if (!contexto) return;
      const escuro = rgbDe(contexto, raiz.getPropertyValue(cor).trim());
      const claro = rgbDe(contexto, raiz.getPropertyValue(brilho).trim());
      if (!escuro || !claro) return;
      const { imagem, soltar } = await decodificar(camada.texture.image.data);
      try {
        const escala = Math.min(1, LADO_MAX_DO_MATCAP / Math.max(imagem.naturalWidth, imagem.naturalHeight));
        tela.width = Math.max(1, Math.round(imagem.naturalWidth * escala));
        tela.height = Math.max(1, Math.round(imagem.naturalHeight * escala));
        contexto.drawImage(imagem, 0, 0, tela.width, tela.height);
      } finally {
        soltar();
      }
      const pixels = contexto.getImageData(0, 0, tela.width, tela.height);
      const d = pixels.data;
      for (let i = 0; i < d.length; i += 4) {
        const l = (0.2126 * d[i]! + 0.7152 * d[i + 1]! + 0.0722 * d[i + 2]!) / 255;
        // Até o limiar, do preto à cor; dali ao branco, da cor ao brilho.
        const [de, ate, k] =
          l < LIMIAR_DO_BRILHO
            ? [[0, 0, 0] as const, escuro, l / LIMIAR_DO_BRILHO]
            : [escuro, claro, (l - LIMIAR_DO_BRILHO) / (1 - LIMIAR_DO_BRILHO)];
        d[i] = de[0] + (ate[0] - de[0]) * k;
        d[i + 1] = de[1] + (ate[1] - de[1]) * k;
        d[i + 2] = de[2] + (ate[2] - de[2]) * k;
      }
      contexto.putImageData(pixels, 0, 0);
      const png = await new Promise<Blob | null>((resolver) => tela.toBlob(resolver, "image/png"));
      if (!png) return;
      await camada.updateTexture(new Uint8Array(await png.arrayBuffer()));
    }),
  );
  app.requestRender();
}

/**
 * Com a cena PARADA (movimento reduzido), um redimensionamento — a janela, o
 * menu recolhido, o zoom — limpa o canvas, e o laço que redesenharia está
 * desligado: o robô sumia (achado da revisão, reproduzido). Desenha UM quadro
 * a cada mudança de tamanho do canvas: o runtime troca `width`/`height` dele
 * no próprio redimensionamento, e o `MutationObserver` responde logo depois.
 * `render` é interno ao runtime (desenha mesmo pausado); sem ele, nada muda.
 */
function redesenharAoRedimensionar(app: Application): () => void {
  const desenhar: unknown = (app as unknown as { render?: unknown }).render;
  if (typeof desenhar !== "function") return () => {};
  const observador = new MutationObserver(() => (desenhar as (agora: number) => void).call(app, performance.now()));
  observador.observe(app.canvas, { attributes: true, attributeFilter: ["width", "height"] });
  return () => observador.disconnect();
}

/**
 * A câmera na pose pedida, sem a abertura da cena por cima — e, com
 * `partida`, a NOSSA entrada no lugar da dela: o mesmo zoom out, só que bem
 * mais curto, terminando na pose final. A abertura da cena para NA HORA (ela
 * recuaria sozinha); a nossa entrada só começa quando `quando` resolve — o
 * robô à mostra. Devolve como cancelar a entrada.
 */
function fixarCamera(app: Application, pose: PoseDaCamera, quando: Promise<void>): (() => void) | undefined {
  const camera = app.findObjectByName(pose.nome);
  // Sem a câmera: a cena mudou de nome — segue como veio.
  if (!camera) return undefined;
  if (pararAberturaDe(app, pose.nome) === "desconhecido") {
    console.warn(`CenaSpline: não deu para parar a abertura de “${pose.nome}” — a câmera segue a da cena.`);
    return undefined;
  }
  const { x, y, z } = camera.position;
  const ate = { x: pose.x ?? x, y: pose.y ?? y, z: pose.z ?? z };
  // `lerDuracao` devolve 0 com movimento reduzido: a câmera nasce na final.
  const duracao = pose.partida ? lerDuracao("--dur-cena-entrada") : 0;
  if (!pose.partida || duracao <= 0) {
    Object.assign(camera.position, ate);
    app.requestRender();
    return undefined;
  }
  const de = { x: pose.partida.x ?? x, y: pose.partida.y ?? y, z: pose.partida.z ?? z };
  const curva = bezierDe("--easing-cena-entrada");
  Object.assign(camera.position, de);
  app.requestRender();
  let cancelada = false;
  let quadro = 0;
  void quando.then(() => {
    if (cancelada) return;
    const inicio = performance.now() + lerDuracao("--dur-cena-espera");
    quadro = requestAnimationFrame(function passo(agora: number) {
      const t = Math.min(1, Math.max(0, (agora - inicio) / duracao));
      const k = curva(t);
      camera.position.x = de.x + (ate.x - de.x) * k;
      camera.position.y = de.y + (ate.y - de.y) * k;
      camera.position.z = de.z + (ate.z - de.z) * k;
      app.requestRender();
      if (t < 1) quadro = requestAnimationFrame(passo);
    });
  });
  return () => {
    cancelada = true;
    cancelAnimationFrame(quadro);
  };
}

export function CenaSpline({
  cena,
  className,
  eventosGlobais = false,
  camera,
  luzes,
  reflexos,
  selo,
  boca,
  balao,
  children,
}: {
  /** O endereço `.splinecode` da cena publicada no Spline. */
  readonly cena: string;
  readonly className?: string;
  /**
   * A cena ouve o ponteiro na JANELA, não só no canvas: é o que faz o robô do
   * Início seguir o cursor em qualquer ponto da tela, menu lateral incluído.
   */
  readonly eventosGlobais?: boolean;
  /** A câmera fica NESTA pose: a abertura que a cena grava sobre ela não roda. */
  readonly camera?: PoseDaCamera;
  /** Luzes da cena retingidas com a cor de um token (os reflexos roxos das bordas). */
  readonly luzes?: readonly TintaDeLuz[];
  /** Matcaps retingidos com cores de token (o reflexo roxo do rosto). */
  readonly reflexos?: readonly TintaDeReflexo[];
  /** Um selo preso a uma malha, em modo Sobrepor (a logo da N1 no peito). */
  readonly selo?: SeloNaCena;
  /** Uma boca de pontos presa a uma malha (a do robô, que mexe quando ele responde). */
  readonly boca?: BocaNaCena;
  /** Uma âncora ao lado de uma malha, para o balão em `children` (o de chat, ao lado da cabeça). */
  readonly balao?: AncoraNaCena;
  /** Montado dentro da raiz da cena: lê `--balao-x`/`--balao-y` e `data-balao-lado`. */
  readonly children?: ReactNode;
}) {
  // A entrada da câmera em curso e o redesenho da cena parada: sair da tela
  // cancela os dois.
  const cancelarEntrada = useRef<(() => void) | undefined>(undefined);
  const soltarRedesenho = useRef<(() => void) | undefined>(undefined);
  // Desenha a boca com a abertura de agora (montado no `aoCarregar`).
  const redesenharBoca = useRef<(() => void) | undefined>(undefined);
  // O laço próprio da boca: roda com ela ativa (a voz ligada) — INCLUSIVE com
  // movimento reduzido. A boca é a fala do robô: só mexe enquanto ele responde,
  // numa resposta curta que a própria pessoa pediu, e parada ela deixava o
  // robô "falando" de boca fechada (2026-09-23: "o robô faz o som mas a boca
  // não faz nada" — o Windows com "Efeitos de animação" desligado liga o
  // movimento reduzido). Ao parar, desenha uma última vez (fechada).
  const bocaAtiva = Boolean(boca?.ativa);
  useEffect(() => {
    if (!bocaAtiva) {
      redesenharBoca.current?.();
      return undefined;
    }
    let quadro = requestAnimationFrame(function passo() {
      redesenharBoca.current?.();
      quadro = requestAnimationFrame(passo);
    });
    return () => {
      cancelAnimationFrame(quadro);
      redesenharBoca.current?.();
    };
  }, [bocaAtiva]);
  useEffect(
    () => () => {
      cancelarEntrada.current?.();
      soltarRedesenho.current?.();
    },
    [],
  );
  // Com reflexos a retingir, o canvas nasce invisível e só aparece pronto: o
  // rosto nunca pisca branco antes de ficar roxo.
  const [tingindo, setTingindo] = useState(() => (reflexos?.length ?? 0) > 0);
  // Uma cena que não carrega some, e o resto da tela segue.
  const [falhou, setFalhou] = useState(false);
  const aoFalhar = (erro: unknown) => {
    console.warn("CenaSpline: a cena não carregou — ela some e o resto da tela segue.", erro);
    setFalhou(true);
  };

  const aoCarregar = (app: Application, raiz: HTMLDivElement) => {
    const quieta = reduzido();
    // O selo acompanha a malha a cada quadro DESENHADO — inclusive o que a
    // cena parada desenha ao redimensionar —, então anda com o tronco e com a
    // entrada da câmera, sem laço próprio.
    const atualizarSelo = selo ? projetorDoSelo(app, raiz, selo) : undefined;
    if (atualizarSelo) {
      app.addEventListener("rendered", atualizarSelo);
      atualizarSelo();
    } else if (selo) {
      console.warn(`CenaSpline: não deu para prender o selo em “${selo.objeto}” — ele não aparece.`);
    }
    // A boca: a mesma projeção, e a abertura lida a cada quadro desenhado. Com
    // movimento reduzido a cena para e a boca fica como está — fechada.
    const posicionarBoca = boca ? projetorDoSelo(app, raiz, boca, "--boca-matriz", "boca") : undefined;
    if (boca && posicionarBoca) {
      const pontos = Array.from(raiz.querySelectorAll<SVGCircleElement>(".cena-spline-boca circle"));
      const acesos: boolean[] = [];
      // A abertura vem sempre de `abertura()` — que é 0 fora da fala: com a voz
      // desligada, ou entre as sílabas, a boca fecha sozinha em qualquer modo.
      redesenharBoca.current = () => desenharBoca(pontos, acesos, boca.abertura());
      const aoDesenhar = () => {
        posicionarBoca();
        redesenharBoca.current?.();
      };
      app.addEventListener("rendered", aoDesenhar);
      aoDesenhar();
    } else if (boca) {
      console.warn(`CenaSpline: não deu para prender a boca em “${boca.objeto}” — ela não aparece.`);
    }
    // A âncora do balão: o mesmo projetor, a cada quadro desenhado.
    const posicionarBalao = balao ? projetorDoBalao(app, raiz, balao) : undefined;
    if (posicionarBalao) {
      app.addEventListener("rendered", posicionarBalao);
      posicionarBalao();
    } else if (balao) {
      console.warn(`CenaSpline: não deu para ancorar o balão em “${balao.objeto}” — ele não aparece.`);
    }
    // Movimento reduzido: a cena não ouve o ponteiro na janela — a cabeça não
    // segue o cursor nem nos segundos antes de parar (o CSS tira também os
    // eventos do próprio canvas).
    if (eventosGlobais && !quieta) app.setGlobalEvents(true);
    if (luzes) tingirLuzes(app, luzes);

    // PRONTA: os reflexos retingidos — ou o prazo `--dur-cena-assenta`, se a
    // tinta travar. Falhou, o reflexo fica como veio, e a cena aparece igual.
    const prazo = lerDuracao("--dur-cena-assenta", { medidor: true });
    const pronta: Promise<void> =
      reflexos && reflexos.length > 0
        ? Promise.race([
            tingirReflexos(app, reflexos).catch((erro: unknown) => {
              console.warn("CenaSpline: os reflexos não foram retingidos — seguem os da cena.", erro);
            }),
            new Promise<void>((resolver) => setTimeout(resolver, prazo)),
          ])
        : Promise.resolve();
    void pronta.then(() => setTingindo(false));

    if (camera) {
      cancelarEntrada.current?.();
      cancelarEntrada.current = fixarCamera(app, camera, pronta);
    }
    // Movimento reduzido: a cena fica, sem laço — o robô parado. Mas só depois
    // de MONTAR: parar no `onLoad` congelava um canvas preto, e parar no
    // primeiro quadro, um robô sem cabeça — o runtime ainda descomprime as
    // malhas depois de carregar. Para no primeiro quadro desenhado passado o
    // `--dur-cena-assenta` (prazo, não movimento: `medidor`) DEPOIS de pronta —
    // parar antes da tinta congelaria o rosto ainda branco.
    if (quieta) {
      void pronta.then(() => {
        const inicio = performance.now();
        const parar = () => {
          if (performance.now() - inicio < prazo) return;
          app.removeEventListener("rendered", parar);
          app.stop();
          soltarRedesenho.current?.();
          soltarRedesenho.current = redesenharAoRedimensionar(app);
        };
        app.addEventListener("rendered", parar);
        app.requestRender();
      });
    }
  };

  if (falhou) return null;
  return (
    <Tela
      cena={cena}
      className={className}
      tingindo={tingindo}
      desenhoDoSelo={selo?.desenho}
      acaoDoSelo={selo?.acao}
      comBoca={Boolean(boca)}
      aoCarregar={aoCarregar}
      aoFalhar={aoFalhar}
    >
      {children}
    </Tela>
  );
}
