# plugins

Ler primeiro: [`../../CONTEXT.md`](../../CONTEXT.md) e [`../CONTEXT.md`](../CONTEXT.md)

Hooks transversais registrados na instância raiz do Fastify, antes de qualquer rota — não são "middleware" de uma rota, são regra que vale para todo o `apps/api`.

## `autenticacao.ts`

`registrarAutenticacao(app, opcoes)` decora `request.membro` a partir do `Authorization: Bearer`: verifica a assinatura do JWT do Supabase (`verificarToken`, injetável — produção usa `verificarTokenDoSupabase`, que chama `supabase.auth.getClaims()`), e resolve o Membro por `userId === sub` dentro do `workspaceId` configurado (`resolverMembro`, produção usa `membroPorUsuario`).

Uma rota se isenta marcando `config: { publica: true }` — hoje só `GET /saude`. Todas as outras exigem token e Membro `ativo`/`suspenso`.

**A regra de acesso é a mesma do front, mas aqui é de verdade.** `apps/web/src/dados/sessao-provider.tsx` já barra `state !== "ativo" && state !== "suspenso"` na tela — mas isso é só UX: nada impedia hoje um `fetch` direto contra o backend com o Membro `removido`. Este hook é o controle de acesso que passa a valer de fato (Security Domain V4).

Nunca confiar em `memberId`/`workspaceId` vindo do cliente: a resolução é sempre "este `sub` do JWT dentro DESTE `workspaceId` de configuração" (T-1-02).

## `autenticacao-servico.ts`

`registrarAutenticacaoDeServico(app, opcoes)` decora `request.servico` a partir do `Authorization: Bearer <id>.<segredo>`: separa os dois pelo primeiro `.`, resolve contra `plataforma.service_credentials` por hash (`resolverCredencial`, injetável — produção usa o de `persistencia/credenciais-de-servico.ts`), e nunca aceita `state = 'revogada'`.

Registrado em `app.ts` como plugin encapsulado com `prefix: PREFIXO_ROTAS_DE_SERVICO` (`/v1/integrations`) — futuras rotas desse prefixo (Fase 4, D-22/OQ-SYN-01) precisam nascer DENTRO desse mesmo plugin para herdar o hook, não soltas na raiz.

Uma rota se isenta marcando `config: { publica: true }` — mesma simetria do hook humano, embora nenhuma rota de integração seja pública hoje. Uma rota exige escopo marcando `config: { escopo: "payment-requests:write" }`; sem escopo insuficiente `credencial.scopes` cobrir, `403 ESCOPO_INSUFICIENTE`.

## Duas autenticações, dois atores

| | JWT do Supabase (`autenticacao.ts`) | Credencial de serviço (`autenticacao-servico.ts`) |
|---|---|---|
| Prefixo | tudo, exceto `PREFIXO_ROTAS_DE_SERVICO` e `config.publica` | só `PREFIXO_ROTAS_DE_SERVICO` |
| Identidade resolvida | Membro humano, por `userId === sub` do JWT | Membro `Agente do pipeline`, por `member_id` da credencial |
| Decorator | `request.membro` | `request.servico` |
| Envelope de erro | `{ ok: false, error: "..." }` | `erroDoContrato(...)` do contrato v1 |

Nenhum dos dois hooks aceita id vindo do corpo da requisição — a identidade é sempre resolvida contra o token, nunca contra `memberId`/`actingMemberId` que o cliente mande (T-1-02/T-02-12).

**Por que o hook humano precisa saber do prefixo de serviço:** ele está registrado direto na raiz do Fastify (`registrarAutenticacao(app, ...)`, sem `app.register`) — e um hook na raiz cascateia para TODO filho, inclusive o plugin encapsulado de `/v1/integrations`. Sem um corte explícito por URL nesse hook, ele chegaria lá primeiro e rejeitaria uma credencial de serviço válida (que não é um JWT) antes do hook de serviço ter a chance de rodar. É por isso que `plugins/autenticacao.ts` importa `PREFIXO_ROTAS_DE_SERVICO` de `autenticacao-servico.ts` e sai cedo quando `request.url` começa por ele — a única forma, dado o modelo de encapsulamento do Fastify (hooks da raiz sempre cascateiam para baixo; não há como um filho "optar por não herdar"), de garantir que os dois caminhos nunca se cruzem (T-02-03) sem reestruturar `registrarAutenticacao` para sair da raiz — o que quebraria `autenticacao.test.ts`, que registra rotas de teste direto na instância que `buildApp()` devolve.

Este é o caminho que a Fase 4 reutiliza para as leituras do `automation/` (D-22, OQ-SYN-01): nenhuma tela é portada agora, só a identidade.
