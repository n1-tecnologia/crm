---
phase: 01-o-crm-n1-ganha-persist-ncia-e-login
reviewed: 2026-09-16T00:00:00Z
depth: standard
files_reviewed: 61
files_reviewed_list:
  - apps/api/.env.example
  - apps/api/CONTEXT.md
  - apps/api/README.md
  - apps/api/migracoes/002-registros-colunas-geradas.sql
  - apps/api/package.json
  - apps/api/src/app.test.ts
  - apps/api/src/app.ts
  - apps/api/src/autenticacao/CONTEXT.md
  - apps/api/src/autenticacao/resolver-usuario.test.ts
  - apps/api/src/autenticacao/resolver-usuario.ts
  - apps/api/src/autenticacao/verificar-token.ts
  - apps/api/src/bootstrap/CONTEXT.md
  - apps/api/src/bootstrap/gestao.cli.ts
  - apps/api/src/bootstrap/gestao.test.ts
  - apps/api/src/bootstrap/gestao.ts
  - apps/api/src/e2e/CONTEXT.md
  - apps/api/src/e2e/criar-conta.test.ts
  - apps/api/src/index.ts
  - apps/api/src/persistencia/CONTEXT.md
  - apps/api/src/persistencia/colunas-geradas.test.ts
  - apps/api/src/persistencia/membros.ts
  - apps/api/src/persistencia/persistencia.test.ts
  - apps/api/src/persistencia/repositorio.ts
  - apps/api/src/persistencia/unidade-de-trabalho.ts
  - apps/api/src/plugins/CONTEXT.md
  - apps/api/src/plugins/autenticacao.test.ts
  - apps/api/src/plugins/autenticacao.ts
  - apps/api/src/rotas/CONTEXT.md
  - apps/api/src/rotas/estado.test.ts
  - apps/api/src/rotas/estado.ts
  - apps/api/src/rotas/operacoes.test.ts
  - apps/api/src/rotas/operacoes.ts
  - apps/api/src/servicos/CONTEXT.md
  - apps/api/src/servicos/convidar-membro.test.ts
  - apps/api/src/servicos/convidar-membro.ts
  - apps/web/.env.example
  - apps/web/.env.local.example
  - apps/web/CONTEXT.md
  - apps/web/src/app/(shell)/layout.tsx
  - apps/web/src/dados/estado-inicial.ts
  - apps/web/src/dados/publico-provider.tsx
  - apps/web/src/dados/sessao-provider.tsx
  - apps/web/src/dados/store.test.ts
  - apps/web/src/dados/store.ts
  - apps/web/src/dados/transporte.test.ts
  - apps/web/src/dados/transporte.ts
  - packages/dominio/CONTEXT.md
  - packages/dominio/src/bootstrap-gestao.test.ts
  - packages/dominio/src/bootstrap-gestao.ts
  - packages/dominio/src/diferenca.test.ts
  - packages/dominio/src/diferenca.ts
  - packages/dominio/src/index.ts
  - packages/dominio/src/operations/activity.ts
  - packages/dominio/src/operations/id-sequence.test.ts
  - packages/dominio/src/operations/index.ts
  - packages/dominio/src/operations/members-reconvite.test.ts
  - packages/dominio/src/operations/members.ts
  - packages/dominio/src/operations/registro.test.ts
  - packages/dominio/src/operations/registro.ts
  - packages/dominio/src/seed-contas-a-receber.ts
  - packages/dominio/src/seed-financeiro.ts
  - packages/dominio/src/seed.ts
findings:
  critical: 2
  warning: 8
  info: 9
  total: 19
status: issues_found
---

# Fase 01: Relatório de Revisão de Código

**Revisado em:** 2026-09-16
**Profundidade:** standard
**Arquivos revisados:** 61
**Status:** issues_found

## Sumário

Revisão adversarial dos 61 arquivos da Fase 1 (persistência + login): o `apps/api` (Fastify 5, hook de autenticação, Unidade de Trabalho, rotas `GET /estado` e `POST /operacoes/:nome`, serviço de convite, bootstrap), o `apps/web` (store híbrido, transporte HTTP, providers, casca) e o `packages/dominio` (registro de operações, diff, `syncIdSequence`, bootstrap de produção, reconvite).

**O que está bem.** As expectativas de segurança listadas para a fase se confirmam no código: o Membro atuante vem sempre de `request.membro` (JWT verificado por `getClaims()`), nunca do corpo; o despacho de `POST /operacoes/:nome` passa por `Object.hasOwn(OPERACOES, nome)` mais um regex no path param (`__proto__`/`constructor` nunca resolvem); `WORKSPACE_ID` é configuração do servidor; CORS é allowlist explícita com `credentials: false`; o `setErrorHandler` não vaza stack; os `.env.example` só têm placeholders; `inviteMember` descarta qualquer `userId` do cliente via `.strip()`; a chave secreta do Supabase só existe em `apps/api`. A revisão otimista (`update ... where revisao = $2 returning revisao`) está correta sob READ COMMITTED; o `rollback` em `ok:false` e em exceção está certo; `gravar()` cobre remoções (inclusive coleção esvaziada); `hidratar()` inicializa todas as coleções de `COLECOES`; `syncIdSequence` com `{6}` exato não estoura `Number`; `listUsers` tem teto de páginas.

**As preocupações.** Duas coisas devem ser corrigidas antes de considerar a fase fechada: (1) `inviteMember` com `userId` resolvido ignora um convite `pendente` já existente para o mesmo e-mail e cria um segundo Membro — a regra RN-ET-11 que PERS-09 quis fechar reabre pelo outro lado; (2) a rota genérica repassa `args: unknown[]` diretamente às ~130 operações sem nenhuma validação de forma em runtime — o domínio foi escrito para um protótipo em memória e não se defende de entrada hostil, então um Membro autenticado consegue tanto derrubar a requisição em 500 (`TypeError`) quanto persistir registros malformados no `jsonb` que todos os outros Membros vão hidratar. Os avisos cobrem a configuração de produção do status "pago" (inalcançável no bootstrap), o `today` de `runScheduledAutomations` controlado pelo cliente, a chamada à Admin API antes da checagem de permissão, o `setErrorHandler` que transforma 400/413/415 do Fastify em 500, o `carregarEnv()` com valor vazio, e três lacunas do store (`enviar` sem `catch`, diffs descartados em `run()` com mais de uma chamada, cópia defasada enquanto há `pendentes`).

## Problemas Críticos

### CR-01: `inviteMember` com `userId` não reencontra o convite `pendente` do mesmo e-mail — cria um segundo Membro

**Arquivo:** `packages/dominio/src/operations/members.ts:334-337` (e `apps/api/src/servicos/convidar-membro.ts:33-41`)
**Problema:** Quando `input.userId` está presente, a busca por `existing` é **exclusivamente** por `member.userId === input.userId`; o caminho por `invitedIdentity` só roda quando `userId` é `undefined`:

```ts
const existing =
  input.userId !== undefined
    ? state.members.find((member) => member.userId === input.userId)
    : state.members.find((member) => member.invitedIdentity?.value.toLowerCase() === email);
```

Cenário real e provável: o Administrador convida `ana@empresa.com` antes de a Ana ter conta no Auth → nasce `mem_X` `pendente` com `invitedIdentity` e **sem** `userId` (caminho (b) de `members-reconvite.test.ts`). A Ana cria a conta no Supabase (ou o `usuarios:seed` roda). O Administrador reenvia o convite → `resolverUsuarioPorEmail` agora devolve o `userId`, a busca por `userId` não acha ninguém (o `mem_X` não tem `userId`), o teste `existing && existing.state !== "removido"` não dispara, e um **segundo** Membro `pendente` para o mesmo e-mail é criado. Consequências: dois Membros contam para o limite RN-ET-23; quando o aceite (fase seguinte) gravar o `userId` nos dois, `membroPorUsuario` (`LIMIT 1` sem `ORDER BY`, ver IN-01) passa a resolver a sessão de forma não determinística. O cenário inverso também falha: um Membro `ativo` com `userId = U` e um `pendente` por `invitedIdentity` com outro e-mail do mesmo Usuário nunca se cruzam.
**Correção:** Casar pelos dois critérios, com `userId` prevalecendo:

```ts
const porUserId = input.userId !== undefined
  ? state.members.find((member) => member.userId === input.userId)
  : undefined;
const porEmail = state.members.find(
  (member) => member.invitedIdentity?.value.toLowerCase() === email,
);
const existing = porUserId ?? porEmail;
if (existing && existing.state !== "removido") { /* recusa como hoje */ }
```

E, no reconvite de um `removido` reencontrado por e-mail, gravar o `userId` resolvido (a linha `if (input.userId !== undefined) existing.userId = input.userId;` já faz isso). Acrescentar em `members-reconvite.test.ts` o caso "pendente por invitedIdentity + userId resolvido depois → recusa 'Já existe um convite pendente', não cria segundo Membro".

### CR-02: `POST /operacoes/:nome` repassa `args: unknown[]` às operações sem validação de forma — 500 por `TypeError` e persistência de JSON arbitrário

**Arquivo:** `apps/api/src/rotas/operacoes.ts:36-43, 103, 110-113`
**Problema:** O schema do corpo é `args: z.array(z.unknown()).max(32)`; depois de `reviverArgumentos`, os argumentos são espalhados direto na função do domínio (`operacao(state, request.membro.id, ...args)`). As operações de `packages/dominio` foram escritas para um protótipo em memória e confiam nos tipos do TypeScript, que não existem em runtime. Dois efeitos verificáveis:

1. **Crash em 500.** `updateTask(state, actor, id, { title: 123 })` → `input.title.trim()` (`tasks.ts:1078`) lança `TypeError` → cai no `setErrorHandler` como "Erro interno." com log de erro, quando é entrada inválida (400). `runScheduledAutomations(..., today: "2026-01-01")` → `today.getFullYear` idem. Qualquer Membro autenticado consegue encher o log de erros do processo com entradas triviais.
2. **Persistência de registros malformados.** `updateTask(..., { description: { a: 1 } })` passa (`tasks.ts:1085` só compara `!==`), a Unidade de Trabalho grava `description` como objeto no `jsonb`, e **todos** os Membros hidratam esse registro na próxima carga. O mesmo vale para `dueDate`, `fieldValues`, `assignees` e qualquer campo que uma operação atribua sem checar o tipo. É integridade do Espaço inteiro comprometida por um único Membro com direito de edição — a "verdade do servidor" (D-03) passa a conter o que o cliente quiser.

A allowlist protege o **nome** da operação (T-1-04), mas não o **conteúdo** dos argumentos; o comentário da rota fala em "runtime seguro" só quanto à assinatura.
**Correção:** Duas camadas, ambas no `apps/api` (a regra continua no domínio; aqui é validação de transporte):

```ts
// operacoes.ts — schema por operação, com fallback estrito para as que ainda não têm
const SCHEMAS: Partial<Record<NomeDeOperacao, z.ZodTypeAny>> = {
  createTask: z.tuple([z.object({ listId: z.string(), title: z.string(), /* ... */ }).strict()]),
  updateTask: z.tuple([z.string(), z.object({ title: z.string().optional(), description: z.string().optional(), /* ... */ }).strict()]),
  runScheduledAutomations: z.tuple([z.string(), z.date()]),
  // ...
};
const schema = SCHEMAS[nome];
if (!schema) return reply.code(404).send({ ok: false, error: `Operação "${nome}" ainda não exposta.` });
const parsed = schema.safeParse(args);
if (!parsed.success) return reply.code(400).send({ ok: false, error: "Entrada inválida para a operação." });
```

Enquanto os schemas não cobrem o registro inteiro, ao menos: (a) tratar `TypeError` lançado **dentro** de `operacao(...)` como 400, não 500 (envolver a chamada e mapear); (b) restringir `args` a um schema estrutural conservador (`z.union([z.string(), z.number(), z.boolean(), z.null(), z.record(z.string(), escalarOuLista)])`, profundidade limitada) para barrar objetos aninhados onde o domínio espera escalar. Registrar um teste em `operacoes.test.ts`: `updateTask` com `title: 123` → 400, e `description: {}` → 400, nunca gravado.

## Avisos

### WR-01: No bootstrap de produção, o status "pago" tem `entryAllowedMemberIds` apontando para Membros que nunca vão existir — ninguém consegue fechar uma Conta

**Arquivo:** `packages/dominio/src/seed-financeiro.ts:110` (via `packages/dominio/src/bootstrap-gestao.ts:190`)
**Problema:** Com `{ fixtures: false }`, a definição de Status continua sendo `{ id: S.pago, ..., entryAllowedMemberIds: [CP.aprovadorId, CP.aprovadorKonqId] }`. Esses ids (`mem_marcos`/`mem_walter`, fixtures) não existem no Espaço "Gestão" e **não podem passar a existir**: um convite real gera `nextId("mem")`, nunca um id literal. `changeTaskStatus` (`tasks.ts:203`) recusa para todo Membro, inclusive a Proprietária. O teste `bootstrap-gestao.test.ts:97-101` celebra essa recusa como "processo configurado de verdade", mas o que ela prova é que o processo de Contas a pagar em produção nasce sem estado terminal. A mensagem de recusa ainda mostra os ids crus (`state.members.find(...)?.displayName ?? id`) — "Só mem_marcos, mem_walter move para pago". O comentário em `bootstrap-gestao.ts:53-58` aceita referências a `CP.aprovadorId` em **payloads de Automação** (JSON opaco), mas `entryAllowedMemberIds` é referência estrutural, aplicada pelo domínio.
**Correção:** Em `applyContasAPagar`, condicionar a restrição às fixtures — `entryAllowedMemberIds: opcoes.fixtures ? [CP.aprovadorId, CP.aprovadorKonqId] : undefined` — e documentar em `bootstrap/CONTEXT.md` que RN-CP-04 é religada por `updateStatus` quando o Aprovador for convidado. Ajustar o teste para provar que a Proprietária **consegue** fechar como pago no bootstrap (ou que a recusa vem do requisito de saída de "para pagar", não de uma lista de ids fantasma). Aplicar a mesma varredura a `seed-contas-a-receber.ts` (o `mentionMemberId: CP.aprovadorId` de R5 está na categoria "payload", aceita).

### WR-02: `runScheduledAutomations` aceita `today` do cliente — o relógio das Automações temporais é do navegador, não do servidor

**Arquivo:** `packages/dominio/src/operations/registro.ts:341` e `apps/api/src/rotas/operacoes.ts:103, 110-113` (assinatura em `packages/dominio/src/operations/automations.ts:316-329`)
**Problema:** O único argumento `Date` do registro é exatamente o que define "hoje" para R2/R4/R5 (D+1, D+30, D+60 do vencimento) — e ele viaja no corpo como `{ $tipo: "Date", iso }`. Um Membro que administre a Lista pode mandar `iso: "2030-01-01"` e fazer todas as Contas entrarem em cobrança/escalonar à Diretoria agora, ou `iso: "garbage"` (vira `Invalid Date`, `NaN` em todas as comparações, e as Automações silenciosamente não rodam). O servidor é a verdade (D-03), mas delega ao cliente a variável que decide o efeito temporal.
**Correção:** No `apps/api`, sobrescrever o argumento no despacho — por exemplo, uma entrada em `SERVICOS` (ou um mapa de "argumentos fixados pelo servidor"):

```ts
runScheduledAutomations: (membro, args) =>
  executar(membro.workspaceId, (state) =>
    runScheduledAutomations(state, membro.id, String(args[0]), new Date()),
  ),
```

e, em `reviver`, rejeitar `iso` que não parse (`Number.isNaN(data.getTime())` → lançar `ErroDeEntrada`/400).

### WR-03: `convidarMembro` chama a Admin API (até 10 páginas × 1000 usuários) antes de qualquer checagem de permissão ou de formato do e-mail

**Arquivo:** `apps/api/src/servicos/convidar-membro.ts:33-34`, `apps/api/src/autenticacao/resolver-usuario.ts:34-35`, `apps/api/src/rotas/operacoes.ts:65`
**Problema:** A ordem é resolver e-mail → `executar` → `inviteMember` (que só então verifica RN-ET-24 e o regex de e-mail). Qualquer Membro `ativo`/`suspenso` — inclusive um Convidado sem direito de convidar — dispara `POST /operacoes/inviteMember` com `{ email: "x", roleId: "y" }` e provoca até 10 chamadas a `auth.admin.listUsers` por requisição, em loop, sem custo para ele. O comentário em `resolver-usuario.ts:18-21` justifica o teto com "rota só alcançável por Membro de governança", mas essa premissa é falsa: a governança é conferida **depois**. `ENTRADA_INVITE_MEMBER` usa `z.string()` sem `.email()`, então nem a forma do e-mail barra a chamada.
**Correção:** (1) `ENTRADA_INVITE_MEMBER = z.object({ email: z.string().trim().email().max(254), roleId: z.string().min(1) }).strip()`. (2) Antes de resolver, uma checagem barata da permissão sem duplicar a regra: exportar do domínio um predicado puro (`podeConvidar(state, actingMemberId): string | null`, extraído das três primeiras linhas de `inviteMember`) e rodá-lo numa hidratação prévia — ou, mais simples, rodar `executar` uma vez **sem** `userId` como pré-voo (recusa → devolve sem tocar o Auth; aceite → `rollback` e só então resolver e executar de verdade). (3) Registrar a defasagem: se a Admin API ficar indisponível, hoje o erro sobe como 500 genérico — aceitável, mas vale um teste.

### WR-04: `setErrorHandler` devolve 500 "Erro interno." para erros de transporte 4xx do próprio Fastify (JSON malformado, corpo grande, media type errado)

**Arquivo:** `apps/api/src/app.ts:65-77`
**Problema:** Só `hasZodFastifySchemaValidationErrors(erro)` vira 400; todo o resto é logado como `error` e devolvido como 500. O parser JSON do Fastify lança `FST_ERR_CTP_INVALID_JSON_BODY`/`FST_ERR_CTP_EMPTY_JSON_BODY` (statusCode 400), `FST_ERR_CTP_BODY_TOO_LARGE` (413) e `FST_ERR_CTP_INVALID_MEDIA_TYPE` (415) — todos com `statusCode` já definido. Um `curl` com corpo `{` recebe 500, e o log do processo registra como bug interno o que é cliente errado. Também esconde do `apps/web` a distinção "meu pedido está errado" vs. "o servidor caiu".
**Correção:**

```ts
app.setErrorHandler((erro, request, reply) => {
  if (hasZodFastifySchemaValidationErrors(erro)) { /* 400 como hoje */ return; }
  const status = typeof erro.statusCode === "number" ? erro.statusCode : 500;
  if (status >= 400 && status < 500) {
    reply.status(status).send({ ok: false, error: "Entrada inválida." }); // sem erro.message
    return;
  }
  request.log.error(erro);
  reply.status(500).send({ ok: false, error: "Erro interno." });
});
```

Teste em `app.test.ts`: `POST /operacoes/createTask` com `payload: "{"` e `content-type: application/json` → 400.

### WR-05: `carregarEnv()` grava valor vazio (`CHAVE=`) e os consumidores usam `??` — `PORT=` vira porta 0, `HOST=` vira "todas as interfaces"

**Arquivo:** `apps/api/src/persistencia/conexao.ts:16-21`; consumidores em `apps/api/src/index.ts:20-21`, `apps/api/src/app.ts:44-45`, `apps/api/src/bootstrap/gestao.cli.ts:13`
**Problema:** Uma linha `PORT=` (comum quando alguém copia o `.env.example` e apaga o valor) faz `process.env.PORT = ""`. `""` não é nullish, então `Number(process.env.PORT ?? 3002)` = `Number("")` = **0** → o Fastify escuta numa porta efêmera aleatória. `HOST=` → `""` chega intacto a `listen({ host: "" })`; o Fastify 5 só substitui `host == null` (`lib/server.js:70-72`), e o Node trata host vazio como "sem host" → **bind em `::`/todas as interfaces**, exatamente o que o README (§5) diz que nunca deve acontecer sem proxy. `WEB_ORIGIN=` → CORS com `[""]` (bloqueia tudo, silenciosamente). `WORKSPACE_ID=` → todo Membro recebe 403. `carregarEnv` também não trata aspas (`KEY="v"` guarda as aspas) nem `export KEY=`.
**Correção:** Em `carregarEnv`, ignorar valores vazios (`if (valor === "") continue;`) e remover aspas simples/duplas envolventes; nos consumidores, usar `||` com validação: `const porta = Number(process.env.PORT || 3002); if (!Number.isInteger(porta) || porta <= 0) throw new Error("PORT inválida.");` e `const host = process.env.HOST || "127.0.0.1";`. Um teste unitário para `carregarEnv(caminhoTemporario)` com `PORT=`, `HOST=""`, `# comentário = x`.

### WR-06: `enviar()` no store não tem `catch` — exceção do transporte vira rejeição não tratada e o usuário nunca recebe feedback

**Arquivo:** `apps/web/src/dados/store.ts:97-158` (try/finally sem catch; disparo com `void` em `:198`)
**Problema:** `transporte.gravar` pode lançar fora do que está mapeado para `"falha"`: `resposta.json()` em um 200 sem JSON válido (`transporte.ts:117`), `resposta.json()` no `hidratar` (`:179`), ou uma exceção dentro de `rehidratar()`/`aplicarDiferenca`. O `finally` decrementa `pendentes`, mas `lastResult` fica com o `ok:true` otimista que `run()` já gravou — a tela mostra sucesso para algo que nunca persistiu, e o console recebe um `Unhandled promise rejection`. O `run()` promete "o cliente nunca fica com um estado que o servidor não tem"; neste caminho ele fica com um **feedback** que o servidor não deu.
**Correção:**

```ts
} catch (erro) {
  set((estado) => ({
    lastResult: { ok: false, error: "Não foi possível gravar. Recarregue a página.", at: Date.now() },
    revision: estado.revision + 1,
  }));
  console.error(erro);
} finally { ... }
```

E em `transporte.ts`, envolver os `resposta.json()` de sucesso em try/catch devolvendo `{ tipo: "falha", erro: "Resposta inválida do servidor." }`. Teste em `store.test.ts`: `gravarMock.mockRejectedValueOnce(new Error("x"))` → `lastResult.ok === false` e `pendentes === 0`.

### WR-07: `run()` com mais de uma chamada descarta os diffs de todas menos a última e sempre força re-hidratação

**Arquivo:** `apps/web/src/dados/transporte.ts:157-162` e `apps/web/src/dados/store.ts:103-112`
**Problema:** Para `chamadas = [createChatSession, sendChatMessage]`, `transporteHttp.gravar` faz dois `POST` em sequência e devolve só a **última** resposta. O diff da primeira (a Sessão de Chat criada) é jogado fora. Depois, em `enviar`, `resposta.revisaoAnterior` da segunda chamada é `revisaoDoServidor + 1` (o servidor já incrementou na primeira), nunca igual a `get().revisaoDoServidor` → cai sempre em `rehidratar()`. Ou seja, o caminho "mais de uma chamada" nunca aplica diff: depende de um `GET /estado` de ~475 KB para cada clique desse tipo, e se esse `GET` falhar (rede), o cliente fica sem a Sessão de Chat que o servidor já tem. O teste `transporte.test.ts (g)` só confere que dois `fetch` saíram; `store.test.ts (h)` só confere a ordem das chamadas gravadas — nenhum cobre a aplicação do resultado.
**Correção:** Acumular os diffs e devolver o conjunto: `gravar` devolve `{ tipo: "diferenca", diferencas: Diferenca[], revisaoAnterior: primeira.revisaoAnterior, revisao: ultima.revisao }`; `enviar` compara `revisaoAnterior` da **primeira** com a local e aplica `aplicarDiferenca` em sequência. Alternativa menor: mandar as N chamadas num único `POST` (`{ chamadas: [...] }`) executadas na mesma Unidade de Trabalho — que é também o único jeito de a segunda chamada ver a primeira no mesmo `state` sem depender de o servidor processar em ordem.

### WR-08: Enquanto há `pendentes > 0`, a cópia de `run()` é feita sobre um `data` que ainda não tem o resultado do `run()` anterior — ids repetidos e recusas falsas em ações encadeadas

**Arquivo:** `apps/web/src/dados/store.ts:173-185, 198`
**Problema:** `run()` clona `get().data`, que só muda quando o diff volta. Dois cliques rápidos ("criar Tarefa" duas vezes) produzem duas cópias a partir do **mesmo** estado; `syncIdSequence(copia)` em cada uma gera o **mesmo** `resultado.value.id` para as duas (o servidor gera dois ids distintos). A tela que navega por `resultado.value.id` — a justificativa do comentário em `:176-181` — vai para o registro errado no segundo clique. Pior: uma ação sobre o registro recém-criado (comentar na Tarefa que acabou de nascer, mandar mensagem na Sessão de Chat recém-aberta em outro `run()`) é **recusada localmente** ("Tarefa não encontrada") sem ir à rede, mesmo que o servidor a aceitasse. O modelo D-05 só é coerente com `pendentes === 0`; o store não impõe isso nem sinaliza à tela.
**Correção:** Serializar: enfileirar `run()` enquanto `pendentes > 0` (a operação roda quando o diff anterior chegar, sobre o estado já atualizado), ou expor `pendentes` na API pública para as telas desabilitarem ações encadeadas. No mínimo, quando `pendentes > 0`, clonar a **última cópia aceita** (mantida no store) em vez de `data`, e documentar que `resultado.value.id` só é confiável com `pendentes === 0`.

## Informações

### IN-01: `membroPorUsuario` usa `LIMIT 1` sem `ORDER BY` — resolução de sessão não determinística se houver dois Membros com o mesmo `userId`

**Arquivo:** `apps/api/src/persistencia/membros.ts:18-26`
**Problema:** Combinado com CR-01 (duplicata por e-mail que, no aceite, receberá o mesmo `userId`), a sessão pode cair ora no `removido`, ora no `ativo`. Nada no schema impede a duplicata (o índice `registros_members_user_id_idx` não é `unique`).
**Correção:** `order by (dados->>'state') = 'ativo' desc, atualizado_em desc limit 1` e, em migração `003`, um índice único parcial `(workspace_id, (dados->>'userId')) where colecao = 'members' and dados->>'userId' is not null and dados->>'state' <> 'removido'`.

### IN-02: `reviver()` copia a chave `__proto__` por atribuição — o objeto revivido herda campos que o cliente escolheu

**Arquivo:** `packages/dominio/src/operations/registro.ts:457-466` (e `serializar`, `:433-445`)
**Problema:** `resultado[chave] = reviver(v)` com `chave === "__proto__"` (que `JSON.parse` produz como propriedade própria) troca o protótipo de `resultado`. Não polui `Object.prototype` (verificado: só o objeto local), e `canonico()`/`structuredClone` usam chaves próprias, então nada herdado persiste — mas leituras `input.campo` no domínio passam a enxergar valores herdados que não aparecem em `Object.keys`. É um vetor estranho que custa uma linha para fechar.
**Correção:** `if (chave === "__proto__" || chave === "constructor" || chave === "prototype") continue;` ou construir com `Object.defineProperty`/`Object.create(null)` e converter no fim.

### IN-03: `bootstrapGestao` confere "Espaço vazio" fora da transação (TOCTOU)

**Arquivo:** `apps/api/src/bootstrap/gestao.ts:29-42`
**Problema:** O `count(*)` roda antes do `begin`; duas execuções simultâneas do CLI passam as duas pela guarda. `semear` → `gravar` faz `on conflict do update`, então o resultado é sobrescrever com o mesmo conteúdo — hoje inofensivo, mas a garantia documentada ("só grava em Espaço vazio") não é atômica.
**Correção:** Mover o `count` para dentro do `begin` com `select ... for update` na linha de `plataforma.workspaces` (inserindo-a antes com `on conflict do nothing`), ou `lock table plataforma.registros in share row exclusive mode`.

### IN-04: Documentação desatualizada em relação ao código entregue

**Arquivo:** `apps/api/CONTEXT.md:28-29, 40-41`; `apps/api/package.json:5`
**Problema:** `CONTEXT.md` ainda diz "Hoje só `GET /saude` (pública); as rotas por operação chegam no Plan 01-04" e lista `src/repositorios/` (a pasta real é `src/persistencia/`); `package.json` descreve o pacote como "Esqueleto do backend. A camada HTTP ainda não foi escolhida". `rotas/CONTEXT.md:7` diz "Nasce vazia". O projeto pede que os `CONTEXT.md` sejam lidos antes do código — estar errado é pior que não existir.
**Correção:** Atualizar as três frases; trocar `src/repositorios/` por `src/persistencia/`; descrever o pacote como "Backend HTTP (Fastify) sobre `@n1/dominio`".

### IN-05: Referência do projeto Supabase em arquivo de exemplo e em documentação versionada

**Arquivo:** `apps/api/.env.example:26`; `apps/api/src/persistencia/CONTEXT.md:7`
**Problema:** O `ref` `epomplsskqpluxuujpxl` identifica o projeto de produção. Não é segredo (aparece na URL pública), mas é informação de alvo que não precisa estar num arquivo de exemplo destinado a ser copiado — e o próprio `.env.example` já usa `SEU-PROJETO` na URL logo abaixo, contradizendo-se.
**Correção:** Remover o `ref` do comentário (deixar "Projeto Supabase da plataforma") e da tabela do `CONTEXT.md`.

### IN-06: `NEXT_PUBLIC_API_URL!` com asserção não nula e mensagem de erro que não cita `API_URL`

**Arquivo:** `apps/web/src/dados/sessao-provider.tsx:38`; `apps/web/src/dados/estado-inicial.ts:43-44`
**Problema:** Se `NEXT_PUBLIC_API_URL` faltar no navegador, o `fetch` vai para `undefined/operacoes/...` e a falha aparece como "Sem conexão com o servidor" — diagnóstico enganoso. No servidor, o erro diz "NEXT_PUBLIC_API_URL não definida" mesmo quando o que se lê primeiro é `API_URL`.
**Correção:** No provider, `const apiUrl = process.env.NEXT_PUBLIC_API_URL; if (!apiUrl) throw new Error("NEXT_PUBLIC_API_URL não definida (apps/web/.env.local).");` na criação do transporte; no `estado-inicial.ts`, "API_URL/NEXT_PUBLIC_API_URL não definidas".

### IN-07: `syncIdSequence` é empurrado por ids literais de 6 caracteres — o contador nasce em ~1,95 bilhão e os ids gerados ficam parecidos com os escritos à mão

**Arquivo:** `packages/dominio/src/operations/activity.ts:31, 52-74`
**Problema:** No seed, `mem_walter` (`parseInt("walter", 36)` = 1 952 731 683) casa o padrão; no bootstrap, `agt_padrao` (≈1,55 bi). O primeiro id gerado vira `tsk_walteu`, `act_waltev`… — visualmente indistinguível de um id hand-authored, o que confunde depuração e a regra "prefixo + 6 dígitos" do comentário. Sobram ~224 milhões de ids antes de `36^6`; passado esse ponto, `nextId` produz 7 caracteres, o regex `{6}` deixa de reconhecê-los e a sincronização seguinte voltaria o contador para baixo (colisão). Não é alcançável na prática desta fase, mas é uma invariante frágil escondida num regex.
**Correção:** Excluir do casamento sufixos com letra (`^[a-z]+_([0-9]{6})$` não serve porque a base é 36); a alternativa robusta é reservar um formato distinto para ids gerados (por exemplo, prefixo + `_g` + base36) ou persistir o contador em `plataforma.workspaces` e sincronizar dali, não varrendo o estado.

### IN-08: `MODELOS_DA_PLATAFORMA` e `TOOLS` são compartilhados por referência entre todos os `DataState` montados no mesmo processo

**Arquivo:** `packages/dominio/src/seed.ts:1898, 2391-2392`; `packages/dominio/src/bootstrap-gestao.ts:49`
**Problema:** `buildSeed()` e `buildGestaoBootstrap()` colocam o **mesmo** array de módulo em `state.models`/`state.tools`. `aplicarDiferenca` muta arrays em lugar (`push`/`splice`), então um diff que toque `models` num store (`PublicoProvider` usa `buildProductSeed()`) altera a constante para todos os stores da mesma aba e para o próximo `buildSeed()`. Hoje nenhuma operação grava `models`/`tools`, então não há efeito observável — mas o `readonly` do tipo dá uma falsa sensação de imutabilidade.
**Correção:** `models: [...MODELOS_DA_PLATAFORMA]`, `tools: [...TOOLS]` (ou `Object.freeze` nas constantes para o erro aparecer cedo).

### IN-09: `sessaoExpirada: true` é produzido pelo transporte mas ignorado pelo store — o usuário continua clicando com sessão morta

**Arquivo:** `apps/web/src/dados/transporte.ts:93, 111`; `apps/web/src/dados/store.ts:147-153`
**Problema:** O tipo `RespostaDeGravacao` carrega o sinal, o `case "falha"` do store descarta-o. Cada `run()` seguinte repete o `fetch` com 401 e a mesma mensagem, sem redirecionar para `/entrar`.
**Correção:** No `case "falha"`, `if (resposta.sessaoExpirada) window.location.assign("/entrar");` (ou expor um callback `aoExpirarSessao` nas opções do `criarStore` para o provider decidir).

---

_Revisado em: 2026-09-16_
_Revisor: Claude (gsd-code-reviewer)_
_Profundidade: standard_
