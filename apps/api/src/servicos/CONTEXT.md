# servicos

Ler primeiro: [`../../CONTEXT.md`](../../CONTEXT.md) e [`../CONTEXT.md`](../CONTEXT.md)

Os casos de uso. Compõem operações de `@n1/dominio` e falam com os repositórios. A transação começa e termina aqui.

Um serviço existe quando a operação precisa de I/O ANTES de entrar na Unidade de Trabalho — a rota compõe (`rotas/operacoes.ts` → `servicos/*.ts` → `persistencia/unidade-de-trabalho.ts`). Se a operação não precisa de I/O prévio, a rota chama `executar()` direto: a Unidade de Trabalho já cobre esse caso sozinha, sem passar por aqui.

## `convidar-membro.ts`

`convidarMembro(pedido, deps?)` — o exemplo do contrato. Antes de `executar()`: resolve o e-mail do convite contra o Supabase Auth (`resolverUsuarioPorEmail`, `apps/api/src/autenticacao/resolver-usuario.ts`). Dentro de `executar()`: `inviteMember` (domínio puro) recebe o `userId` já resolvido e reativa o mesmo Membro `removido` se houver um (RN-ET-11, PERS-09). `deps.resolverUsuario` existe só para teste — produção usa o resolvedor real.
