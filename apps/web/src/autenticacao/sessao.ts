import "server-only";

/**
 * Quem está autenticado — a Camada de Acesso a Dados da sessão, no sentido do
 * guia do Next: toda leitura de "quem sou" passa por aqui, e é aqui que se
 * verifica, não em layout (que não re-renderiza a cada navegação).
 *
 * `getUser()` e não `getSession()`: o segundo devolve o que está no cookie
 * sem conferir com o servidor; o primeiro valida o token. É a diferença entre
 * acreditar no cliente e verificar.
 */

import { cache } from "react";
import { clienteDoServidor } from "./cliente-servidor";

export interface Usuario {
  readonly id: string;
  readonly email: string | undefined;
}

/** O Usuário autenticado, ou `null`. Memoizado por requisição. */
export const usuarioAtual = cache(async (): Promise<Usuario | null> => {
  const supabase = await clienteDoServidor();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email };
});
