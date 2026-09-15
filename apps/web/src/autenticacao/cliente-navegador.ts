/**
 * O cliente Supabase do navegador. Só para o que precisa acontecer no cliente
 * — hoje, nada além de reagir a mudanças de sessão. Login e logout passam
 * pelo servidor (`entrar/actions.ts`, `sair/route.ts`), onde o cookie é escrito.
 */

import { createBrowserClient } from "@supabase/ssr";

export function clienteDoNavegador() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
