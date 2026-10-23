"use client";

/**
 * Fronteira de erro global (D-13, SEG-10; UI-SPEC S5). Antes dela, um erro de
 * render no root layout simplesmente sumia: não havia `error.tsx` nem
 * `global-error.tsx` e nada era registrado.
 *
 * Substitui o root layout enquanto ativa, então traz o próprio documento
 * (`<html>` e `<body>`) e os próprios estilos (`./globals.css`); as variáveis de
 * fonte do `layout.tsx` não chegam aqui, e a tela cai na pilha de sistema de
 * `tokens.css`. De propósito NÃO importa o barril de `@/features/shell/ui` nem o
 * store: uma fronteira de erro que depende de código pesado pode falhar pelo
 * mesmo motivo que a acionou. A marcação repete a do estado de falha de
 * `(publico)/p/[segredo]/page.tsx` (`Painel`, `EmptyState` e `Icone`), só com as
 * classes do sistema.
 *
 * O texto é fixo. Nunca mostra `error.message`, `error.digest`, pilha, URL nem
 * nome de rota: podem carregar o segredo de `/f/` e `/p/` (T-09-82). O Sentry
 * recebe o erro já limpo por `limparEvento` (`features/observabilidade`).
 *
 * `retry` é a nova tentativa estável da 16.3: busca e renderiza de novo os
 * filhos da fronteira (o `reset` só limpa o estado, sem buscar).
 */

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { TriangleAlert } from "lucide-react";
import "./globals.css";

export default function GlobalError({ error, retry }: { readonly error: Error & { digest?: string }; readonly retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full">
        <title>Algo deu errado · N1 Digital</title>
        <main className="grade-pontos flex min-h-screen items-center justify-center p-6">
          <div className="w-full max-w-lg">
            <div className="painel-solido p-6">
              <div className="estado-vazio flex flex-col items-center justify-center gap-2 py-12 text-center">
                <span aria-hidden style={{ color: "var(--texto-4)", opacity: 0.6 }}>
                  <TriangleAlert aria-hidden strokeWidth={1.5} className="shrink-0" style={{ width: "var(--icone-lg)", height: "var(--icone-lg)" }} />
                </span>
                <p className="app-md" style={{ color: "var(--texto-1)" }}>
                  Algo deu errado.
                </p>
                <p className="app-meta" style={{ maxWidth: "28rem" }}>
                  O erro foi registrado.
                </p>
                <div className="mt-2">
                  <button type="button" className="btn alvo-toque" onClick={() => retry()}>
                    Tentar de novo
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
