/**
 * O vídeo "Como funciona o Financeiro": a gravação da tela real, com câmera
 * que aproxima do ponto explicado, o cursor desenhado por cima (com a onda do
 * clique) e a legenda de cada marca. Abertura e fechamento em cartões.
 */

import { AbsoluteFill, Easing, Img, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import {
  ABERTURA,
  ALTURA_DA_LEGENDA,
  FECHAMENTO,
  FPS,
  cameraEm,
  cursorEm,
  instanteDaGravacao,
  quadroEm,
  trechos,
  type Marca,
  type Roteiro,
} from "./linha-do-tempo";

const COR = {
  fundo: "#0d0d0f",
  cartao: "rgba(20, 20, 24, 0.92)",
  linha: "rgba(255, 255, 255, 0.10)",
  texto: "#f4f4f5",
  texto2: "#a1a1aa",
  acento: "#a855f7",
};
const FONTE = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const PRESO = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export interface PropsDoVideo {
  readonly roteiro: Roteiro;
}

function Cartaz({ eyebrow, titulo, texto, quadros }: { eyebrow: string; titulo: string; texto: string; quadros: number }) {
  const q = useCurrentFrame();
  const entrada = interpolate(q, [0, 18], [0, 1], { ...PRESO, easing: Easing.out(Easing.cubic) });
  const saida = interpolate(q, [quadros - 12, quadros], [1, 0], PRESO);
  return (
    <AbsoluteFill style={{ background: COR.fundo, justifyContent: "center", alignItems: "center", fontFamily: FONTE, opacity: saida }}>
      <div style={{ textAlign: "center", transform: `translateY(${(1 - entrada) * 18}px)`, opacity: entrada, maxWidth: 1000 }}>
        <div style={{ color: COR.acento, fontSize: 22, fontWeight: 600, letterSpacing: 1 }}>{eyebrow}</div>
        <div style={{ color: COR.texto, fontSize: 64, fontWeight: 700, marginTop: 14, lineHeight: 1.1 }}>{titulo}</div>
        <div style={{ color: COR.texto2, fontSize: 28, marginTop: 20, lineHeight: 1.35 }}>{texto}</div>
      </div>
    </AbsoluteFill>
  );
}

function Seta({ x, y }: { x: number; y: number }) {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" style={{ position: "absolute", left: x - 4, top: y - 2, filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.6))" }}>
      <path d="M4 2 L4 19 L8.5 14.8 L11.6 21.6 L14.6 20.3 L11.6 13.6 L18 13.6 Z" fill="#ffffff" stroke="#111" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

function Legenda({ marca, t, emCima }: { marca: Marca; t: number; emCima: boolean }) {
  // `t` em segundos da gravação; a marca roda quase em tempo real.
  const dentro = interpolate(t, [marca.inicio, marca.inicio + 0.35], [0, 1], PRESO);
  const fora = interpolate(t, [marca.fim - 0.35, marca.fim], [1, 0], PRESO);
  const k = Math.min(dentro, fora);
  return (
    <div
      style={{
        position: "absolute",
        left: 48,
        right: 48,
        ...(emCima ? { top: 36 } : { bottom: 40 }),
        display: "flex",
        justifyContent: "center",
        opacity: k,
        transform: `translateY(${(1 - k) * 14}px)`,
      }}
    >
      <div
        style={{
          background: COR.cartao,
          border: `1px solid ${COR.linha}`,
          borderLeft: `4px solid ${COR.acento}`,
          borderRadius: 16,
          padding: "16px 24px",
          maxWidth: 1080,
          fontFamily: FONTE,
          boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
          backdropFilter: "blur(6px)",
        }}
      >
        <div style={{ color: COR.texto, fontSize: 26, fontWeight: 700 }}>{marca.titulo}</div>
        <div style={{ color: "#d4d4d8", fontSize: 21, marginTop: 6, lineHeight: 1.35 }}>{marca.texto}</div>
      </div>
    </div>
  );
}

function Tela({ roteiro }: PropsDoVideo) {
  const quadro = useCurrentFrame();
  const lista = trechos(roteiro);
  const t = instanteDaGravacao(lista, quadro / FPS);
  const W = roteiro.largura;
  const H = roteiro.altura;
  const camera = cameraEm(roteiro, t);
  const arquivo = quadroEm(roteiro, t);
  // Página → tela: escala em torno do centro da câmera.
  const tx = W / 2 - camera.cx * camera.escala;
  const ty = H / 2 - camera.cy * camera.escala;
  const naTela = (x: number, y: number) => ({ x: x * camera.escala + tx, y: y * camera.escala + ty });
  const cursor = naTela(cursorEm(roteiro, t).x, cursorEm(roteiro, t).y);
  const marca = roteiro.marcas.find((m) => t >= m.inicio && t <= m.fim);
  const realce = marca?.foco ? interpolate(t, [marca.inicio + 0.5, marca.inicio + 0.9, marca.fim - 0.3, marca.fim], [0, 1, 1, 0], PRESO) : 0;
  return (
    <AbsoluteFill style={{ background: COR.fundo, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transformOrigin: "0 0", transform: `translate(${tx}px, ${ty}px) scale(${camera.escala})` }}>
        {arquivo ? <Img src={staticFile(`gravacao/quadros/${arquivo}`)} style={{ width: W, height: H, display: "block" }} /> : null}
        {marca?.foco && realce > 0 ? (
          <div
            style={{
              position: "absolute",
              left: marca.foco.x,
              top: marca.foco.y,
              width: marca.foco.w,
              height: marca.foco.h,
              border: `${2 / camera.escala}px solid ${COR.acento}`,
              borderRadius: 12 / camera.escala,
              boxShadow: `0 0 0 ${4000}px rgba(0,0,0,${0.32 * realce})`,
              opacity: realce,
            }}
          />
        ) : null}
      </div>
      {roteiro.cliques
        .filter((c) => t >= c.t && t <= c.t + 0.5)
        .map((c) => {
          const p = naTela(c.x, c.y);
          const k = (t - c.t) / 0.5;
          return (
            <div
              key={c.t}
              style={{
                position: "absolute",
                left: p.x - 26 * k - 6,
                top: p.y - 26 * k - 6,
                width: 12 + 52 * k,
                height: 12 + 52 * k,
                borderRadius: "50%",
                border: `3px solid ${COR.acento}`,
                opacity: 1 - k,
              }}
            />
          );
        })}
      <Seta x={cursor.x} y={cursor.y} />
      {marca ? <Legenda marca={marca} t={t} emCima={marca.foco ? naTela(0, marca.foco.y + marca.foco.h).y > H - ALTURA_DA_LEGENDA + 10 : false} /> : null}
    </AbsoluteFill>
  );
}

export function GuiaDoFinanceiro({ roteiro }: PropsDoVideo) {
  const lista = trechos(roteiro);
  const meio = Math.round((lista.at(-1)?.ate ?? 0) * FPS);
  const abertura = Math.round(ABERTURA * FPS);
  const fechamento = Math.round(FECHAMENTO * FPS);
  return (
    <AbsoluteFill style={{ background: COR.fundo }}>
      <Sequence durationInFrames={abertura}>
        <Cartaz eyebrow="N1 · Financeiro" titulo="Como funciona o Financeiro" texto="Um passeio pela tela: do pedido de pagamento à conferência e ao Omie." quadros={abertura} />
      </Sequence>
      <Sequence from={abertura} durationInFrames={meio}>
        <Tela roteiro={roteiro} />
      </Sequence>
      <Sequence from={abertura + meio} durationInFrames={fechamento}>
        <Cartaz eyebrow="Pronto" titulo="Agora é com você" texto="Para rever: menu ⋯ de uma Lista do Financeiro › Guia do Financeiro." quadros={fechamento} />
      </Sequence>
    </AbsoluteFill>
  );
}

