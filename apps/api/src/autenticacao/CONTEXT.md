# autenticacao

Ler primeiro: [`../../CONTEXT.md`](../../CONTEXT.md) e [`../CONTEXT.md`](../CONTEXT.md)

Toda fala com o Supabase Auth (Admin API) passa por aqui — `SUPABASE_SECRET_KEY` nunca sai deste processo, nunca aparece em log nem em resposta HTTP.

## `verificar-token.ts`

`verificarTokenDoSupabase(token)` — verifica a assinatura de um access token contra o JWKS do projeto (`supabase.auth.getClaims()`) e devolve `{ sub, email }` ou `null`. Usado pelo hook de autenticação (`plugins/autenticacao.ts`) em toda requisição.

`clienteAdmin()` — fábrica lazy, uma instância por processo, do client Supabase criado com `SUPABASE_SECRET_KEY`. Todo arquivo desta pasta que precisa da Admin API reutiliza esta instância em vez de instanciar outro `createClient`.

## `criar-usuarios-do-seed.ts`

Script standalone (`npm run usuarios:seed -w @n1/api`) que cria, no Supabase Auth, um Usuário para cada Membro do seed — com o mesmo id que `Member.userId` carrega. Idempotente; senha de desenvolvimento única para todos.

## `resolver-usuario.ts`

`resolverUsuarioPorEmail(email)` — resolve "que Usuário do Auth tem este e-mail?" paginando `admin.listUsers()` (a Admin API não tem filtro por e-mail — ver comentário no arquivo) e comparando em memória, case-insensitive. É a peça que fecha PERS-09: `apps/api/src/servicos/convidar-membro.ts` usa o `userId` resolvido aqui para que `inviteMember` (domínio puro) reative o mesmo Membro `removido` em vez de criar um segundo (RN-ET-11).
