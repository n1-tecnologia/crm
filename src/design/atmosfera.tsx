/**
 * ATMOSFERA — o fundo do Entrar.
 *
 * A mesma da capa do Início: três orbes desfocados que derivam devagar, a
 * grade de pontos e seis estrelas. Irmã do cartão, nunca wrapper (o cartão
 * precisa do próprio `position` para a lanterna e para o `revelar`), e nunca
 * atrás de uma lista (aviso da origem: o brilho compete com o texto denso).
 * Tudo CSS (`.atmosfera`, `.capa-orbe`, `.capa-estrela`); os laços leem os
 * tokens de tempo e param em movimento reduzido.
 */

const ESTRELAS = [
  { top: "12%", left: "22%", tam: "3px", cor: "var(--estrela-forte)" },
  { top: "28%", left: "78%", tam: "2px", cor: "var(--estrela-media)" },
  { top: "66%", left: "14%", tam: "2px", cor: "var(--estrela-acento)" },
  { top: "82%", left: "70%", tam: "3px", cor: "var(--estrela-fraca)" },
  { top: "44%", left: "92%", tam: "2px", cor: "var(--estrela-info)" },
  { top: "8%", left: "56%", tam: "2px", cor: "var(--estrela-fraca)" },
];

export function Atmosfera() {
  return (
    <div className="atmosfera grade-pontos" aria-hidden="true">
      <span className="capa-orbe" style={{ top: "-25%", left: "-12%", width: "40rem", height: "40rem", background: "var(--orbe-1)" }} />
      <span className="capa-orbe" style={{ bottom: "-30%", right: "-8%", width: "34rem", height: "34rem", background: "var(--orbe-2)" }} />
      <span className="capa-orbe" style={{ top: "35%", left: "42%", width: "28rem", height: "28rem", background: "var(--orbe-3)" }} />
      {ESTRELAS.map((e, i) => (
        <span key={i} className="capa-estrela" style={{ top: e.top, left: e.left, width: e.tam, height: e.tam, background: e.cor }} />
      ))}
    </div>
  );
}
