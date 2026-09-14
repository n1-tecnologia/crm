/**
 * Ícones de marca, desenhados aqui.
 *
 * O lucide removeu os ícones de marca das versões recentes, e o substituto
 * óbvio engana: a arroba não é o Instagram, é o símbolo de menção que qualquer
 * rede usa. Um ícone errado na aba faz a pessoa clicar no Canal errado.
 *
 * Os dois seguem o traço do lucide: `viewBox` de 24, contorno de 2 no que é
 * contorno, para não destoarem dos ícones ao lado.
 */

export function InstagramIcon({ className }: { readonly className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

/** O "in" é maciço na marca, então este é preenchido e não contornado. */
export function LinkedinIcon({ className }: { readonly className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.5h4v11H3v-11Zm6.5 0h3.8v1.5h.06c.53-.95 1.82-1.95 3.74-1.95 4 0 4.74 2.5 4.74 5.76v5.69h-4v-5.05c0-1.2-.02-2.75-1.7-2.75-1.7 0-1.96 1.31-1.96 2.66v5.14h-3.98v-11Z" />
    </svg>
  );
}

/** A nota musical do TikTok, maciça como a marca. */
export function TikTokIcon({ className }: { readonly className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M16.5 2h-3v13.2a2.7 2.7 0 1 1-2.2-2.65V9.5a5.8 5.8 0 1 0 5.2 5.77V8.9a6.6 6.6 0 0 0 3.8 1.2V7.05a3.8 3.8 0 0 1-3.8-3.8V2Z" />
    </svg>
  );
}
