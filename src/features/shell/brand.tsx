import { useId } from "react";

/**
 * Marca N1 Digital.
 *
 * O monograma funde o N ao 1 num traço só: a haste esquerda sobe e vira, pelo
 * ombro arredondado, na diagonal que desce até a haste do 1; o 1 traz a
 * bandeira descendo à esquerda, com a base reta, e o pé direito volta em curva
 * para a base. O contraforma entre a bandeira e a diagonal é parte do desenho,
 * não sobra — e é por isso que a marca é UM caminho fechado, não quatro traços
 * encostados.
 *
 * O gradiente (#2C0263 → #9601C5) é a versão preferencial, escuro no alto à
 * esquerda e claro à direita, como na arte. Sobre fundo escuro o manual usa a
 * versão em branco, e sobre claro a versão em preto — por isso o `tone`
 * existe: um logo colorido sobre fundo errado é uso indevido.
 *
 * MEDIDO DA ARTE (2026-09-22). Houve aqui, até esta data, um monograma
 * RECONSTRUÍDO das páginas do manual: tinha a ideia certa e a forma errada, e o
 * usuário mandou o arquivo da logo ("esta é a logo correta da N1"). O desenho
 * atual saiu da arte, não de interpretação: a silhueta foi extraída linha a
 * linha do arquivo, as retas ajustadas e os dois arredondamentos (ombro e pé)
 * aproximados por Bézier quadrática — o polígono cobre 99,5 % dos pixels da
 * arte original, com 0,6 % de erro concentrado nas bordas de um pixel.
 */

/**
 * O monograma (viewBox 0 0 100 100), a fonte única da forma da marca: o
 * `BrandMark` desenha a partir daqui, e quem precisar da mesma forma fora de um
 * SVG (uma máscara de canvas, por exemplo) lê daqui também.
 *
 * A arte é mais larga que alta (291 × 255), e a caixa aqui é quadrada porque é
 * assim que `size` é usado no app: a marca ocupa a largura inteira e fica
 * centrada na vertical, com 6,19 de folga em cima e embaixo.
 */
export const MONOGRAMA = [
  "M0 6.19L12.37 6.19Q25.09 6.19 35.74 17.18L77.32 60.14L77.32 27.15L54.3 27.15L71.48 6.19L100 6.19L100 93.81Q78.69 93.81 70.79 85.91L24.05 38.49L24.05 93.81L0 93.81Z",
] as const;

export function BrandMark({
  size = 28,
  tone = "gradiente",
  title = "N1 Digital",
}: {
  readonly size?: number;
  readonly tone?: "gradiente" | "claro" | "escuro" | "atual";
  readonly title?: string;
}) {
  // Um id por instância: com dois monogramas em gradiente na mesma página (o
  // do trilho e a face da marca 3D), `url(#…)` resolveria sempre para o
  // primeiro do documento — e id repetido nem é HTML válido.
  const idDoGradiente = `n1-gradiente-${useId().replace(/:/g, "")}`;
  const fill =
    tone === "gradiente"
      ? `url(#${idDoGradiente})`
      : tone === "claro"
        ? "#ffffff"
        : tone === "escuro"
          ? "#000000"
          : "currentColor";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={title}
      className="shrink-0"
    >
      {tone === "gradiente" ? (
        <defs>
          {/* A direção é a da arte: o escuro no alto à esquerda, o claro à
              direita — não no pé, como uma diagonal de 45° faria. */}
          <linearGradient id={idDoGradiente} x1="0" y1="0" x2="1" y2="0.5">
            <stop offset="0%" stopColor="#2C0263" />
            <stop offset="100%" stopColor="#9601C5" />
          </linearGradient>
        </defs>
      ) : null}
      <g fill={fill}>
        {MONOGRAMA.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  );
}

/**
 * Marca completa: monograma sobre a palavra, como no manual — ou, na
 * horizontal, monograma e "N1 DIGITAL" lado a lado, para os tamanhos pequenos
 * (a versão vertical a 22px deixaria a palavra com 6px, ilegível).

 */
export function BrandLockup({
  size = 28,
  tone = "gradiente",
  orientacao = "vertical",
}: {
  readonly size?: number;
  readonly tone?: "gradiente" | "claro" | "escuro" | "atual";
  readonly orientacao?: "vertical" | "horizontal";
}) {
  if (orientacao === "horizontal") {
    return (
      <span className="inline-flex items-center gap-2">
        <BrandMark size={size} tone={tone} />
        <span
          aria-hidden="true"
          className="app-sm"
          style={{ letterSpacing: "var(--tr-rotulo)", fontWeight: 600, color: "var(--texto)" }}
        >
          N1 DIGITAL
        </span>
      </span>
    );
  }
  return (
    <span className="inline-flex flex-col items-center gap-0.5">
      <BrandMark size={size} tone={tone} />
      <span
        aria-hidden="true"
        className="text-[length:var(--texto-xs)] font-[var(--peso-forte)] tracking-[0.35em] text-[var(--cor-tinta)]"
        style={{ fontSize: Math.max(6, size * 0.19) }}
      >
        DIGITAL
      </span>
    </span>
  );
}
