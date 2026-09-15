import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

/**
 * SF Pro Display é a tipografia da marca e vem do sistema nos aparelhos Apple.
 * Fora deles a Inter assume — mesma métrica geométrica, mesmo peso visual — e é
 * ela que `next/font` carrega aqui, exposta como `--font-sans` para a pilha em
 * `estilos/tokens.css`. A monoespaçada é para o Identificador legível.
 */
const sans = Inter({ variable: "--font-sans", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "N1 Digital",
  description:
    "Plataforma de trabalho, CRM e IA — protótipo navegável construído sobre a ontologia v1.0.",
};

/**
 * `themeColor` é metadado lido antes de qualquer CSS: `var(--page)` não resolve
 * aqui. É o único valor de cor mantido à mão fora de `tokens.css` — se `--page`
 * mudar lá, muda aqui.
 */
export const viewport: Viewport = {
  themeColor: "#0f0f10",
};

/**
 * The explicit prop type is written by hand on purpose: `LayoutProps<'/'>` only
 * exists after `next typegen`, and the root layout must typecheck on a clean
 * checkout, before any build has run.
 */
export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="pt-BR" className={`${sans.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
