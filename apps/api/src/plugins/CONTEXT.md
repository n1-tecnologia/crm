# plugins

Ler primeiro: [`../../CONTEXT.md`](../../CONTEXT.md) e [`../CONTEXT.md`](../CONTEXT.md)

Hooks transversais registrados na instância raiz do Fastify, antes de qualquer rota — não são "middleware" de uma rota, são regra que vale para todo o `apps/api`.

## `autenticacao.ts`

`registrarAutenticacao(app, opcoes)` decora `request.membro` a partir do `Authorization: Bearer`: verifica a assinatura do JWT do Supabase (`verificarToken`, injetável — produção usa `verificarTokenDoSupabase`, que chama `supabase.auth.getClaims()`), e resolve o Membro por `userId === sub` dentro do `workspaceId` configurado (`resolverMembro`, produção usa `membroPorUsuario`).

Uma rota se isenta marcando `config: { publica: true }` — hoje só `GET /saude`. Todas as outras exigem token e Membro `ativo`/`suspenso`.

**A regra de acesso é a mesma do front, mas aqui é de verdade.** `apps/web/src/dados/sessao-provider.tsx` já barra `state !== "ativo" && state !== "suspenso"` na tela — mas isso é só UX: nada impedia hoje um `fetch` direto contra o backend com o Membro `removido`. Este hook é o controle de acesso que passa a valer de fato (Security Domain V4).

Nunca confiar em `memberId`/`workspaceId` vindo do cliente: a resolução é sempre "este `sub` do JWT dentro DESTE `workspaceId` de configuração" (T-1-02).
