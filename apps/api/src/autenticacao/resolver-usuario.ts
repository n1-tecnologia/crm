/**
 * Resolve "que Usuário do Supabase Auth tem este e-mail?" — a ponte que
 * PERS-09 precisa para reconvidar um Membro `removido` pelo mesmo `userId`
 * (RN-ET-11): o domínio (`inviteMember`, `packages/dominio`) é puro e não
 * tem como, só com o e-mail digitado, achar de volta um Membro que já foi
 * `ativo` — depois do aceite, o e-mail some do `DataState` (B27 apaga
 * `invitedIdentity`). Só o Auth sabe.
 *
 * Verificado nesta versão instalada (`@supabase/auth-js` via
 * `@supabase/supabase-js` 2.116.0,
 * `node_modules/@supabase/auth-js/dist/module/GoTrueAdminApi.d.ts` e
 * `lib/types.d.ts`): `admin.listUsers(params?: PageParams)` só aceita
 * `page`/`perPage` — não há filtro por e-mail (Assumption A1 do
 * RESEARCH.md, agora confirmada). A única forma é paginar e comparar em
 * memória, case-insensitive. Quando a Admin API ganhar um filtro nativo,
 * este é o único arquivo a mudar.
 *
 * Teto de 10 páginas × 1000 (T-1-05, Denial of Service): a plataforma tem
 * dezenas de Usuários hoje, não milhares — um teto documentado é melhor do
 * que uma paginação sem fim numa rota só alcançável por Membro de
 * governança (RN-ET-24, conferido em `inviteMember`).
 */

import { clienteAdmin } from "./verificar-token";

export type ResolverUsuario = (email: string) => Promise<string | undefined>;

const TETO_DE_PAGINAS = 10;
const POR_PAGINA = 1000;

export const resolverUsuarioPorEmail: ResolverUsuario = async (email) => {
  const alvo = email.trim().toLowerCase();

  for (let page = 1; page <= TETO_DE_PAGINAS; page += 1) {
    const { data, error } = await clienteAdmin().auth.admin.listUsers({ page, perPage: POR_PAGINA });
    // Erro da Admin API sobe ao `setErrorHandler` de `app.ts` — 500 genérico,
    // detalhe só no log (T-1-06); nunca vaza para a resposta.
    if (error) throw error;

    const achado = data.users.find((usuario) => usuario.email?.toLowerCase() === alvo);
    if (achado) return achado.id;

    if (!data.nextPage) break;
  }
  return undefined;
};
