/**
 * O fallback de rota do `/f/<segredo>` enquanto o Server Component acima
 * espera `transportePublico.obterFormulario` (Next.js escolhe este arquivo
 * automaticamente durante o carregamento da árvore assíncrona). UI-SPEC,
 * "Estados de carregamento": título, introdução, 6 linhas de campo e CTA —
 * nunca tela em branco.
 */

import { Esqueleto, EsqueletoDeLinhas, Painel } from "@/features/shell/ui";

export default function CarregandoFormularioPublico() {
  return (
    <main className="grade-pontos flex min-h-screen justify-center p-6 md:p-16">
      <div className="grid w-full content-start gap-4" style={{ maxWidth: "48rem" }}>
        <header className="grid gap-2">
          <Esqueleto largura="8rem" altura="0.75rem" />
          <Esqueleto largura="16rem" altura="1.5rem" />
          <Esqueleto largura="24rem" altura="1rem" />
        </header>
        <Painel solido className="grid gap-4 p-6">
          <EsqueletoDeLinhas quantidade={6} />
          <span className="flex justify-end">
            <Esqueleto largura="10rem" altura="var(--controle-h-lg)" />
          </span>
        </Painel>
      </div>
    </main>
  );
}
