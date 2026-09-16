"use client";

/**
 * Monta o store da árvore já com a sessão E o estado resolvidos no servidor
 * (`carregarEstadoInicial()`, chamado pela casca), e barra quem autenticou
 * mas não pode agir aqui.
 *
 * O Membro pode não existir ou não poder agir (RN-ET-08 / A6.4): um Usuário
 * autenticado que não é Membro deste Espaço de Trabalho, ou cujo Membro foi
 * `removido`. A checagem de `state` do Membro saiu daqui e foi para o
 * `apps/api`, que é onde vira controle de acesso de verdade (Security
 * Domain V4) — esta tela só mostra o `motivo` que a API mandou (403), nunca
 * decide sozinha se alguém pode entrar.
 */

import { useMemo, type ReactNode } from "react";
import { clienteDoNavegador } from "@/autenticacao/cliente-navegador";
import { Painel } from "@/features/shell/ui";
import type { EstadoInicial } from "./estado-inicial";
import { StoreProvider } from "./store";
import { transporteHttp } from "./transporte";

export function SessaoProvider({
  userId,
  inicial,
  children,
}: {
  readonly userId: string;
  readonly inicial: Extract<EstadoInicial, { tipo: "ok" | "semAcesso" }>;
  readonly children: ReactNode;
}) {
  // `useMemo` (não `useState`): um transporte novo por render não teria por
  // que existir — ele não guarda estado próprio, só fecha sobre `apiUrl` e
  // `obterToken`, que não mudam entre renders desta árvore.
  const transporte = useMemo(
    () =>
      transporteHttp({
        apiUrl: process.env.NEXT_PUBLIC_API_URL!,
        obterToken: async () => (await clienteDoNavegador().auth.getSession()).data.session?.access_token,
      }),
    [],
  );

  if (inicial.tipo === "semAcesso") {
    return (
      <main className="grade-pontos flex min-h-screen items-center justify-center p-6">
        <Painel solido className="w-full max-w-md p-6">
          <h1 className="ed-titulo">Sem acesso</h1>
          <p className="app-base mt-2" style={{ color: "var(--texto-2)" }}>
            {inicial.motivo}
          </p>
          <form action="/sair" method="post" className="mt-6">
            <button type="submit" className="btn alvo-toque">Sair</button>
          </form>
        </Painel>
      </main>
    );
  }

  return (
    <StoreProvider sessao={{ memberId: inicial.estado.memberId, userId }} estadoInicial={inicial.estado} transporte={transporte}>
      {children}
    </StoreProvider>
  );
}
