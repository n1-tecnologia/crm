/**
 * Marca N1 Digital.
 *
 * O monograma funde o N ao 1: o N é o novo, o 1 é a liderança, e a fusão é a
 * assinatura de posicionamento do manual. O 1 nasce da haste direita do N, com
 * a bandeira descendo à esquerda; o contraforma triangular entre a bandeira e a
 * diagonal é parte do desenho, não sobra.
 *
 * O gradiente (#2C0263 → #9601C5) é a versão preferencial. Sobre fundo escuro o
 * manual usa a versão em branco, e sobre claro a versão em preto — por isso o
 * `tone` existe: um logo colorido sobre fundo errado é uso indevido.
 *
 * RECONSTRUÇÃO: desenhado a partir das páginas do manual, não do arquivo
 * vetorial original. Trocar pelo `.svg` oficial é substituir os `path` daqui.
 */

export function BrandMark({
  size = 28,
  tone = "gradiente",
  title = "N1 Digital",
}: {
  readonly size?: number;
  readonly tone?: "gradiente" | "claro" | "escuro" | "atual";
  readonly title?: string;
}) {
  const fill =
    tone === "gradiente"
      ? "url(#n1-gradiente)"
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
          <linearGradient id="n1-gradiente" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#2C0263" />
            <stop offset="100%" stopColor="#9601C5" />
          </linearGradient>
        </defs>
      ) : null}
      <g fill={fill}>
        {/* haste esquerda do N */}
        <path d="M8 6h22v88H8z" />
        {/* diagonal: desce da esquerda para a haste direita */}
        <path d="M8 6h22l62 66v22H70L8 28z" />
        {/* haste direita, que é também a haste do 1 */}
        <path d="M70 6h22v88H70z" />
        {/* bandeira do 1: desce da ponta para a esquerda */}
        <path d="M70 6v30L52 22z" />
      </g>
    </svg>
  );
}

/** Marca completa: monograma sobre a palavra, como no manual. */
export function BrandLockup({
  size = 28,
  tone = "gradiente",
}: {
  readonly size?: number;
  readonly tone?: "gradiente" | "claro" | "escuro" | "atual";
}) {
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
