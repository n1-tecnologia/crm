"use client";

/**
 * O store das rotas públicas — quem responde a um Formulário não é Membro e
 * não tem sessão.
 *
 * A sessão aqui é a do Proprietário do Espaço de Trabalho. Não é uma decisão
 * nova: era o que o singleton fazia por padrão, e este provider só a torna
 * visível. A pergunta que ela deixa — em nome de quem uma resposta anônima
 * age, e se `submitForm` deveria ignorar a sessão e usar o dono do Formulário
 * — está registrada em PENDENCIAS-FRONTEND e não é resolvida aqui.
 */

import { useMemo, type ReactNode } from "react";
import { buildProductSeed } from "@n1/dominio/seed-produto";
import { StoreProvider } from "./store";

export function PublicoProvider({ children }: { readonly children: ReactNode }) {
  const memberId = useMemo(() => buildProductSeed().workspace.ownerMemberId, []);
  return <StoreProvider sessao={{ memberId }}>{children}</StoreProvider>;
}
