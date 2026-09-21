"use client";

/**
 * O store de `/p/<segredo>` (compartilhamento público de Tarefa,
 * `apps/web/src/app/(publico)/p/[segredo]/page.tsx`) — quem abre esse link
 * não é Membro, não tem sessão e não passa pelo `apps/api`. Continua em
 * memória de propósito: a leitura pública de uma Tarefa nunca foi promovida
 * a uma rota do `apps/api` nesta fase, então não há o que hidratar por
 * `GET /estado`.
 *
 * Não serve mais o Formulário público: a partir do Plan 02-20, `/f/<segredo>`
 * fala direto com `transportePublico` (`apps/web/src/dados/transporte-publico.ts`)
 * e `apps/web/src/features/formulario-publico/formulario.tsx`, sem este
 * provider e sem `buildProductSeed()` no caminho — a dívida que este arquivo
 * documentava para o Formulário está paga (D-02). `p/[segredo]/layout.tsx` é
 * quem monta este provider agora; `(publico)/layout.tsx` deixou de fazê-lo
 * para os dois caminhos.
 *
 * A sessão aqui é a do Proprietário do Espaço de Trabalho. Não é uma decisão
 * nova: era o que o singleton fazia por padrão, e este provider só a torna
 * visível.
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
