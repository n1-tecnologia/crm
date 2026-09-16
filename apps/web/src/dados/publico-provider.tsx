"use client";

/**
 * O store das rotas públicas — quem responde a um Formulário não é Membro,
 * não tem sessão e não passa pelo `apps/api`. Continua em memória de
 * propósito: `submitForm` não está no registro de operações
 * (`@n1/dominio/operations/registro`), então não há o que mandar por
 * `POST /operacoes/:nome` — nada persiste a partir de uma rota pública ainda.
 *
 * A sessão aqui é a do Proprietário do Espaço de Trabalho. Não é uma decisão
 * nova: era o que o singleton fazia por padrão, e este provider só a torna
 * visível. Em nome de quem uma resposta anônima age — e se `submitForm`
 * deveria ignorar essa sessão e usar o dono do Formulário — é OQ-PF-01
 * (Deferred Ideas, `01-CONTEXT.md`; Phase 2). Quando decidido, a troca é
 * este provider passar a usar `transporteHttp` com a identidade escolhida.
 */

import { useMemo, type ReactNode } from "react";
import { buildProductSeed } from "@n1/dominio/seed-produto";
import { StoreProvider } from "./store";
import { transporteEmMemoria } from "./transporte";

export function PublicoProvider({ children }: { readonly children: ReactNode }) {
  const { data, memberId } = useMemo(() => {
    const data = buildProductSeed();
    return { data, memberId: data.workspace.ownerMemberId };
  }, []);
  const transporte = useMemo(() => transporteEmMemoria(), []);

  return (
    <StoreProvider sessao={{ memberId }} estadoInicial={{ data, revisao: 0, ordens: {} }} transporte={transporte}>
      {children}
    </StoreProvider>
  );
}
