"use client";

/**
 * Monta o store da árvore já com a sessão resolvida no servidor, e barra quem
 * autenticou mas não pode agir aqui.
 *
 * O Membro pode não existir ou não poder agir (RN-ET-08 / A6.4): um Usuário
 * autenticado que não é Membro deste Espaço de Trabalho, ou cujo Membro foi
 * `removido`. Nesses casos a casca não sobe — sobe uma explicação e a saída.
 * A checagem lê o seed direto, e não o store, porque acontece *antes* de
 * decidir se o store deve existir.
 */

import { useMemo, type ReactNode } from "react";
import { buildProductSeed } from "@n1/dominio/seed-produto";
import { StoreProvider } from "./store";
import { Painel } from "@/features/shell/ui";

export function SessaoProvider({
  userId,
  memberId,
  children,
}: {
  readonly userId: string;
  readonly memberId: string | undefined;
  readonly children: ReactNode;
}) {
  const member = useMemo(
    () => (memberId ? buildProductSeed().members.find((m) => m.id === memberId) : undefined),
    [memberId],
  );
  const podeAgir = member !== undefined && (member.state === "ativo" || member.state === "suspenso");

  if (!podeAgir || memberId === undefined) {
    const motivo =
      member === undefined
        ? "Sua conta existe, mas não é Membro deste Espaço de Trabalho. Peça um convite a um Administrador."
        : member.state === "pendente"
          ? "Seu convite ainda não foi aceito."
          : "Sua participação neste Espaço de Trabalho foi encerrada. A autoria histórica permanece.";
    return (
      <main className="grade-pontos flex min-h-screen items-center justify-center p-6">
        <Painel solido className="w-full max-w-md p-6">
          <h1 className="ed-titulo">Sem acesso</h1>
          <p className="app-base mt-2" style={{ color: "var(--texto-2)" }}>{motivo}</p>
          <form action="/sair" method="post" className="mt-6">
            <button type="submit" className="btn alvo-toque">Sair</button>
          </form>
        </Painel>
      </main>
    );
  }

  return <StoreProvider sessao={{ memberId, userId }}>{children}</StoreProvider>;
}
