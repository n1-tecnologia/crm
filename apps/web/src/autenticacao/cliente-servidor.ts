import "server-only";

/**
 * O cliente Supabase do servidor, com a sessão lida e escrita nos cookies da
 * requisição. Serve a Server Components, Server Actions e Route Handlers.
 *
 * `setAll` pode falhar quando chamado de um Server Component (que não pode
 * escrever cookie): é esperado, e o `proxy.ts` — que roda antes e pode —
 * já terá renovado a sessão. Por isso o `catch` vazio não esconde erro.
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function clienteDoServidor() {
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (lista) => {
          try {
            for (const { name, value, options } of lista) jar.set(name, value, options);
          } catch {
            /* Server Component: o proxy já renovou. */
          }
        },
      },
    },
  );
}
