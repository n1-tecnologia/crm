import type { ReactNode } from "react";
import { PublicoProvider } from "@/dados/publico-provider";

/**
 * As rotas que se alcançam sem sessão: o Formulário público (`/f/<segredo>`)
 * e a Página com segredo (`/p/<segredo>`). O grupo de rotas não muda a URL;
 * existe para as duas dividirem este layout e o `proxy.ts` as reconhecer
 * pelo prefixo.
 */
export default function PublicoLayout({ children }: { readonly children: ReactNode }) {
  return <PublicoProvider>{children}</PublicoProvider>;
}
