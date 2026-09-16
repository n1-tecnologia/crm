---
phase: 01-o-crm-n1-ganha-persist-ncia-e-login
reviewed: 2026-09-16T20:03:40Z
depth: standard
files_reviewed: 64
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
  - apps/api/src/rotas/esquemas-de-argumentos.test.ts
  - apps/api/src/rotas/esquemas-de-argumentos.ts
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
  critical: 1
  warning: 11
  info: 11
  total: 23
status: issues_found
---

# Fase 01: Relatório de Revisão de Código (re-revisão após fechamento de lacunas)

**Revisado em:** 2026-09-16T20:03:40Z
**Profundidade:** standard
**Arquivos revisados:** 64
**Status:** issues_found

## Sumário

Re-revisão da Fase 1 depois dos Plans 01-10 (CR-01) e 01-11 (CR-02). A linha de base é o `01-REVIEW.md` anterior (`git show 3ba8b86:...`). `git diff --stat 3ba8b86..HEAD` confirma que **só 8 arquivos mudaram** (`members.ts`, `members-reconvite.test.ts`, `convidar-membro.test.ts`, `esquemas-de-argumentos.ts` + `.test.ts`, `operacoes.ts` + `.test.ts`, `rotas/CONTEXT.md`); os outros 56 são byte-idênticos ao que foi revisado — as constatações sobre eles são carregadas com o mesmo ID e o mesmo status, sem re-argumentar. O esforço foi gasto no delta.

**O que fechou.** CR-01 fechou no cenário reportado: `inviteMember` agora casa `existing` por `porUserId ?? porEmail` (`members.ts:346-349`), e o caso "pendente por `invitedIdentity` → conta criada no Auth → reconvite" recusa com "Já existe um convite pendente" em vez de criar um segundo Membro — provado no domínio (`members-reconvite.test.ts` (g)) e contra o Postgres pelo serviço (`convidar-membro.test.ts` (e)). O efeito 1 de CR-02 (500 por `TypeError`) fechou por inteiro: schema por operação para as 23 que a Fase 1 usa (`esquemas-de-argumentos.ts`, `satisfies Esquemas` sobre a assinatura real de `OPERACOES`), fallback estrutural para as demais, `TypeError` dentro da operação mapeado para 400 com rollback garantido pelo `catch` de `executar()` (`unidade-de-trabalho.ts:79-81`, que relança sem embrulhar — `erro instanceof ErroDeEntrada` funciona, como (q) prova). As 23 formas conferem campo a campo com `CreateTaskInput`, `UpdateTaskInput`, `ReceivableSeriesInput`, `TaskDate`, `ActorRef`, `FieldValue["value"]` e as assinaturas posicionais; `opcional()` mapeia o `null` que `JSON.stringify([id, undefined])` produz de volta para `undefined`; `z.date()` recusa `Invalid Date`. Verifiquei ainda que o zod 4.6.5 recria objetos (`z.object().strict()` e `z.record` via `Reflect.ownKeys`, pulando `__proto__`), então o dado que chega ao domínio tem protótipo limpo mesmo quando o `reviver` (IN-02) o troca no objeto intermediário.

**O que não fechou.** (1) O efeito 2 de CR-02 — persistir JSON malformado no `jsonb` que todos os Membros hidratam — continua aberto para as ~109 operações sem schema próprio: `ARGUMENTOS_GENERICOS` barra profundidade > 6 e funções, mas não tipo por campo. Provado nesta revisão: `createGoal` com `kind: 42` e `anchor: { type, id, lixo: {...} }` passa a validação e o domínio grava; `saveView` com `kind: "x"` e `filters: { qualquer: { coisa: true } }` idem. Todas alcançáveis por qualquer Membro autenticado, com ou sem tela na Fase 1. (2) A correção de CR-01 (que era a sugerida por esta revisão) deixa um caso descoberto: quando `porUserId` acha um `removido` e `porEmail` acha um `pendente` vivo, o `??` escolhe o `removido`, reativa-o e o `pendente` continua lá — dois Membros vivos para o mesmo e-mail (reproduzido: `mem_tiago` + `mem_0000ae`). O mesmo caminho por `porEmail` sobrescreve `existing.userId` sem conferir se já havia outro `userId` no registro. (3) Duas lacunas novas na rota: `reviverArgumentos` é recursivo sem limite e roda **antes** do zod, então um corpo de 400 KB de `[[[[...]]]]` estoura a pilha e vira 500 "Erro interno." com log `error` (reproduzido via `app.inject`); e o mapeamento `TypeError → 400` é aplicado também às 23 operações com schema, onde um `TypeError` depois da validação só pode ser bug — que passa a ser registrado como `warn` de entrada inválida. Os avisos WR-01..WR-08 e as informações IN-01, IN-03, IN-05..IN-09 continuam abertos nos arquivos inalterados; IN-04 fechou só em `rotas/CONTEXT.md`.

## Status das constatações anteriores

| ID | Status | Evidência |
|---|---|---|
| CR-01 | **RESOLVIDO** (cenário reportado) | `members.ts:346-349`; `members-reconvite.test.ts` (g)/(h)/(i); `convidar-membro.test.ts` (e). Resíduo novo em WR-09. |
| CR-02 | **PARCIALMENTE RESOLVIDO** | Efeito 1 (500) fechado; efeito 2 (jsonb malformado) fechado para 23 operações, aberto para ~109. Mantido abaixo. |
| WR-01 | STILL OPEN | `seed-financeiro.ts` / `bootstrap-gestao.ts` inalterados. |
| WR-02 | STILL OPEN | `runScheduledAutomations: z.tuple([ID, z.date()])` valida a forma, mas o `today` continua vindo do cliente; `Invalid Date` agora é 400 (parte (b) da correção sugerida fechou). |
| WR-03 | STILL OPEN | `convidar-membro.ts:33-34` resolve no Auth antes de `executar`; `ENTRADA_INVITE_MEMBER` (`operacoes.ts:82`) segue `z.string()` sem `.email()`. |
| WR-04 | STILL OPEN | `app.ts:65-77` inalterado. |
| WR-05 | STILL OPEN | `conexao.ts` inalterado. |
| WR-06 | STILL OPEN | `store.ts` inalterado. |
| WR-07 | STILL OPEN | `transporte.ts` / `store.ts` inalterados. |
| WR-08 | STILL OPEN | `store.ts` inalterado. |
| IN-01 | STILL OPEN | `membros.ts` inalterado; WR-09 mostra um caminho novo para a duplicata que o torna relevante. |
| IN-02 | PARCIALMENTE (mitigado) | `registro.ts:457-466` inalterado; o zod recria o objeto, mas `z.object().strict()` lê `input.description` **herdado** e o materializa como próprio (reproduzido: `{"__proto__":{"description":"hijack"},"title":"ok"}` → `data[1].description === "hijack"`). Equivale a mandar o campo direto — sem impacto, mas a linha de defesa continua sendo o zod, não o `reviver`. |
| IN-03 | STILL OPEN | `bootstrap/gestao.ts` inalterado. |
| IN-04 | PARCIALMENTE RESOLVIDO | `rotas/CONTEXT.md` atualizado; `apps/api/CONTEXT.md:28-29, 40` ("Hoje só `GET /saude`", `src/repositorios/`) e `apps/api/package.json:5` ("A camada HTTP ainda não foi escolhida") continuam errados. |
| IN-05 | STILL OPEN | `.env.example` / `persistencia/CONTEXT.md` inalterados. |
| IN-06 | STILL OPEN | `sessao-provider.tsx` / `estado-inicial.ts` inalterados. |
| IN-07 | STILL OPEN | `activity.ts` inalterado. |
| IN-08 | STILL OPEN | `seed.ts` / `bootstrap-gestao.ts` inalterados. |
| IN-09 | STILL OPEN | `transporte.ts` / `store.ts` inalterados. |

## Problemas Críticos

### CR-02: `POST /operacoes/:nome` — efeito 2 (JSON malformado persistido no `jsonb` compartilhado) continua aberto para as ~109 operações sem schema próprio — PARCIALMENTE RESOLVIDO

**Arquivo:** `apps/api/src/rotas/esquemas-de-argumentos.ts:163-173` (`ARGUMENTOS_GENERICOS`), `apps/api/src/rotas/operacoes.ts:125-134`
**Problema:** O que fechou: o efeito 1 (500 por `TypeError`) está resolvido — schema por operação para 23, `TypeError` dentro da operação mapeado para 400, rollback confirmado (`unidade-de-trabalho.ts:79-81`). O que **não** fechou: para toda operação fora de `ESQUEMAS`, `ARGUMENTOS_GENERICOS` só garante "JSON com profundidade ≤ 6, sem funções, `Date` válido" — não garante tipo por campo, valor de enum nem chaves conhecidas em objetos aninhados (`z.record(z.string(), …)` aceita qualquer chave). Reproduzido nesta revisão, a partir de `buildSeed()` com o Proprietário:

```ts
ARGUMENTOS_GENERICOS.safeParse([{ name: "Meta", anchor: { type: "list", id: "lst_ativacao", lixo: { a: [1, 2] } }, kind: 42, target: 10 }]).success // true
createGoal(state, me, ...data) // ok: true — state.goals[...] = { kind: 42, anchor: { …, lixo: {…} } }
saveView(state, me, { listId, name: "V", kind: "x", filters: { qualquer: { coisa: true } } }) // ok: true, kind "x" e filters arbitrário gravados
```

`createGoal` (`scale.ts:208-235`) só valida `name`, `target`, `measure` e `dueDate`; `kind` e `anchor` vão direto ao registro; `saveView` (`scale.ts:74-97`) copia `filters` e `kind` sem olhar. Pela Unidade de Trabalho isso vira `jsonb` em `plataforma.registros` e **todos** os Membros hidratam em `GET /estado` — uma tela que faça `goal.kind === "metrica" ? … : …` ou itere `view.filters` com a forma que o tipo promete quebra para o Espaço inteiro, plantada por um Membro comum com acesso a uma Lista. O comentário do arquivo (`:20-25`) reconhece que o estrutural é "conservador o bastante para barrar objeto onde o domínio espera escalar" — o oposto (escalar/enum errado onde o domínio espera outro, objeto com chaves a mais) continua passando. A rota não distingue "operação que a Fase 1 usa" de "operação alcançável": qualquer nome de `OPERACOES` é despachado.
**Correção:** A opção (a) da revisão anterior custa zero funcionalidade na Fase 1, dado que — pelo próprio comentário de `esquemas-de-argumentos.ts:20-22` — o Espaço "Gestão" usa exatamente as 23 cobertas:

```ts
// operacoes.ts — depois do 404 por nome
const schema = ESQUEMAS[nome as keyof typeof ESQUEMAS];
if (!schema) {
  return reply.code(404).send({ ok: false, error: `Operação "${nome}" ainda não exposta.` });
}
```

(mantendo `ARGUMENTOS_GENERICOS` só como camada extra dentro de cada schema, ou removendo-o). Se a decisão for manter as 109 alcançáveis, então cada uma precisa de schema antes de sair da fase — e o teste (j) de `esquemas-de-argumentos.test.ts` deve passar a exigir `Object.keys(ESQUEMAS).length === Object.keys(OPERACOES).length` em vez de `23`, para que o drift apareça como teste vermelho e não como registro malformado em produção. Em qualquer dos dois caminhos, registrar em `operacoes.test.ts`: `createGoal` com `kind: 42` → 400 (hoje seria 200 e gravado).

## Avisos

### WR-01: No bootstrap de produção, o status "pago" tem `entryAllowedMemberIds` apontando para Membros que nunca vão existir — ninguém consegue fechar uma Conta — STILL OPEN

**Arquivo:** `packages/dominio/src/seed-financeiro.ts:110` (via `packages/dominio/src/bootstrap-gestao.ts:190`)
**Problema:** Inalterado desde a revisão anterior. Com `{ fixtures: false }`, `entryAllowedMemberIds: [CP.aprovadorId, CP.aprovadorKonqId]` referencia `mem_marcos`/`mem_walter`, ids de fixture que um convite real (`nextId("mem")`) nunca produz; `changeTaskStatus` recusa para todo Membro, inclusive a Proprietária; a mensagem exibe ids crus.
**Correção:** `entryAllowedMemberIds: opcoes.fixtures ? [CP.aprovadorId, CP.aprovadorKonqId] : undefined` em `applyContasAPagar`; ajustar `bootstrap-gestao.test.ts:97-101` para provar que a Proprietária consegue fechar como pago; documentar em `bootstrap/CONTEXT.md` que RN-CP-04 é religada por `updateStatus`.

### WR-02: `runScheduledAutomations` aceita `today` do cliente — o relógio das Automações temporais é do navegador, não do servidor — STILL OPEN

**Arquivo:** `apps/api/src/rotas/esquemas-de-argumentos.ts:152` e `apps/api/src/rotas/operacoes.ts:125-144`
**Problema:** A parte (b) da correção sugerida fechou (`z.date()` recusa `Invalid Date`, teste (n)). A parte principal não: `z.tuple([ID, z.date()])` valida que é uma data, não **qual** data — `{ $tipo: "Date", iso: "2030-01-01T00:00:00Z" }` continua fazendo todas as Contas entrarem em cobrança/escalonarem agora.
**Correção:** Fixar o argumento no servidor, numa entrada em `SERVICOS` ou num mapa de "argumentos fixados": `runScheduledAutomations: (membro, args) => executar(membro.workspaceId, (state) => runScheduledAutomations(state, membro.id, String(args[0]), new Date()))`, e reduzir o schema a `z.tuple([ID])` (ou `z.tuple([ID, z.date()])` ignorando o segundo).

### WR-03: `convidarMembro` chama a Admin API (até 10 páginas × 1000 usuários) antes de qualquer checagem de permissão ou de formato do e-mail — STILL OPEN

**Arquivo:** `apps/api/src/servicos/convidar-membro.ts:33-34`, `apps/api/src/autenticacao/resolver-usuario.ts:34-35`, `apps/api/src/rotas/operacoes.ts:82, 98-107`
**Problema:** Inalterado. `inviteMember` ficou de propósito fora de `ESQUEMAS` (comentário em `esquemas-de-argumentos.ts:27-31`), então `args[0]` passa pelo estrutural e por `ENTRADA_INVITE_MEMBER = z.object({ email: z.string(), roleId: z.string() }).strip()` — sem `.email()`, sem `.max()`. Qualquer Membro `ativo`/`suspenso`, inclusive Convidado, dispara até 10 `listUsers` por requisição antes de RN-ET-24 ser conferida.
**Correção:** `ENTRADA_INVITE_MEMBER = z.object({ email: z.string().trim().email().max(254), roleId: z.string().min(1) }).strip()`; pré-voo barato da permissão (predicado puro `podeConvidar(state, actingMemberId)` exportado do domínio, rodado numa hidratação prévia, ou `executar` sem `userId` como ensaio) antes de tocar o Auth.

### WR-04: `setErrorHandler` devolve 500 "Erro interno." para erros de transporte 4xx do próprio Fastify — STILL OPEN

**Arquivo:** `apps/api/src/app.ts:65-77`
**Problema:** Inalterado. `FST_ERR_CTP_INVALID_JSON_BODY` (400), `FST_ERR_CTP_BODY_TOO_LARGE` (413), `FST_ERR_CTP_INVALID_MEDIA_TYPE` (415) chegam com `statusCode` definido e saem como 500 com log `error`.
**Correção:** Antes do `request.log.error`, `const status = typeof erro.statusCode === "number" ? erro.statusCode : 500; if (status >= 400 && status < 500) { reply.status(status).send({ ok: false, error: "Entrada inválida." }); return; }`. Teste em `app.test.ts` com `payload: "{"`.

### WR-05: `carregarEnv()` grava valor vazio (`CHAVE=`) e os consumidores usam `??` — `PORT=` vira porta 0, `HOST=` vira "todas as interfaces" — STILL OPEN

**Arquivo:** `apps/api/src/persistencia/conexao.ts:16-21`; consumidores em `apps/api/src/index.ts:20-21`, `apps/api/src/app.ts:44-45`, `apps/api/src/bootstrap/gestao.cli.ts:13`
**Problema:** Inalterado. `""` não é nullish; `Number("")` é 0; `listen({ host: "" })` vira bind em todas as interfaces; `WEB_ORIGIN=` bloqueia todo CORS silenciosamente; `WORKSPACE_ID=` dá 403 a todos.
**Correção:** `if (valor === "") continue;` e remoção de aspas envolventes em `carregarEnv`; `Number(process.env.PORT || 3002)` com validação de inteiro positivo; `process.env.HOST || "127.0.0.1"`. Teste unitário de `carregarEnv`.

### WR-06: `enviar()` no store não tem `catch` — exceção do transporte vira rejeição não tratada e o usuário nunca recebe feedback — STILL OPEN

**Arquivo:** `apps/web/src/dados/store.ts:97-158, 198`
**Problema:** Inalterado. `resposta.json()` em 200 sem JSON válido, ou exceção em `rehidratar()`/`aplicarDiferenca`, escapa do `try/finally`; `lastResult` fica com o `ok:true` otimista.
**Correção:** `catch (erro) { set(estado => ({ lastResult: { ok: false, error: "Não foi possível gravar. Recarregue a página.", at: Date.now() }, revision: estado.revision + 1 })); console.error(erro); }` e `try/catch` nos `resposta.json()` do transporte devolvendo `{ tipo: "falha", erro: "Resposta inválida do servidor." }`.

### WR-07: `run()` com mais de uma chamada descarta os diffs de todas menos a última e sempre força re-hidratação — STILL OPEN

**Arquivo:** `apps/web/src/dados/transporte.ts:157-162`, `apps/web/src/dados/store.ts:103-112`
**Problema:** Inalterado. Só a última resposta é devolvida; `revisaoAnterior` da segunda nunca casa com a local; se o `GET /estado` de re-hidratação falhar, o cliente fica sem o que o servidor já gravou.
**Correção:** Acumular `diferencas: Diferenca[]` e aplicar em sequência comparando a `revisaoAnterior` da **primeira**; ou mandar as N chamadas num único `POST` na mesma Unidade de Trabalho.

### WR-08: Enquanto há `pendentes > 0`, a cópia de `run()` é feita sobre um `data` que ainda não tem o resultado do `run()` anterior — ids repetidos e recusas falsas em ações encadeadas — STILL OPEN

**Arquivo:** `apps/web/src/dados/store.ts:173-185, 198`
**Problema:** Inalterado. Dois `run()` rápidos clonam o mesmo `data`; `syncIdSequence` gera o mesmo id nos dois; ação sobre registro recém-criado é recusada localmente sem ir à rede.
**Correção:** Serializar `run()` enquanto `pendentes > 0`, ou clonar a última cópia aceita; expor `pendentes` para as telas.

### WR-09: `porUserId ?? porEmail` escolhe um `removido` sobre um `pendente` vivo — dois Membros vivos para o mesmo e-mail; e a reativação por e-mail sobrescreve um `userId` já gravado (novo — resíduo da correção de CR-01)

**Arquivo:** `packages/dominio/src/operations/members.ts:346-357, 370-378`
**Problema:** A correção de CR-01 (a sugerida pela revisão anterior) resolve o cenário reportado, mas a precedência por `??` só olha um dos dois achados. Reproduzido nesta revisão a partir de `buildSeed()`:

```ts
inviteMember(state, "mem_thiago", { email: "x@empresa.com.br", roleId });                       // pendente mem_0000ae, sem userId
inviteMember(state, "mem_thiago", { email: "x@empresa.com.br", roleId, userId: USUARIOS_DO_SEED.mem_tiago }); // mem_tiago está removido
// → ok: true, value.id === "mem_tiago" (reativado); mem_0000ae continua pendente com o mesmo e-mail
// vivos: 11 → 12
```

`porUserId` acha `mem_tiago` (`removido`), `porEmail` acha `mem_0000ae` (`pendente`); `existing = porUserId` passa pelo `state !== "removido"` e é reativado; o `pendente` nunca é conferido. Resultado: dois Membros não-removidos para o mesmo e-mail — o mesmo efeito que CR-01 queria impedir (RN-ET-11/INV-ET-04, dois na contagem RN-ET-23, e IN-01 volta a ser relevante quando o aceite gravar o `userId` nos dois). O caso (i) de `members-reconvite.test.ts` só cobre `porUserId` **ativo**. No mundo real o gatilho é um e-mail trocado no Auth (o Usuário `U` muda seu e-mail para o de um convite pendente sem conta) — improvável, mas é exatamente o tipo de estado que o domínio existe para não deixar nascer.

Segundo ponto, na mesma função: quando `existing` vem de `porEmail` (um `pendente`/`removido` nascido com `invitedIdentity`) e já tinha `userId = V` (caminho (d): convite com conta conhecida), a linha `if (input.userId !== undefined) existing.userId = input.userId;` (`:378`) troca `V` por `U` sem conferir — o registro `mem_X` (com seu histórico de Atividade) passa a pertencer a outro Usuário. O gatilho é o mesmo (e-mail reatribuído no Auth).
**Correção:** Conferir os dois achados e recusar quando divergem, e nunca trocar um `userId` já gravado:

```ts
const vivoPorEmail = porEmail && porEmail.state !== "removido" ? porEmail : undefined;
const vivoPorUserId = porUserId && porUserId.state !== "removido" ? porUserId : undefined;
const vivo = vivoPorUserId ?? vivoPorEmail;
if (vivo) return fail(vivo.state === "pendente" ? "Já existe um convite pendente para este e-mail." : "Este e-mail já pertence a um Membro deste Espaço de Trabalho.", "email");
const existing = porUserId ?? porEmail; // ambos removidos (ou um só achado): reativar
if (existing && input.userId !== undefined && existing.userId !== undefined && existing.userId !== input.userId) {
  return fail("Este convite corresponde a outra conta. Remova o Membro antigo antes de convidar de novo.", "email");
}
```

Acrescentar em `members-reconvite.test.ts`: (j) `porUserId` removido + `porEmail` pendente vivo → recusa, `state.members` inalterado; (k) `porEmail` removido com `userId = V` + `input.userId = U` → recusa (ou, se a decisão for reatribuir, que seja explícita e registrada em Atividade).

### WR-10: `reviverArgumentos` é recursivo sem limite e roda antes do zod — corpo de 400 KB de arrays aninhados estoura a pilha e vira 500 "Erro interno." com log `error` (novo)

**Arquivo:** `apps/api/src/rotas/operacoes.ts:125-126`; `packages/dominio/src/operations/registro.ts:457-468`
**Problema:** A ordem é `reviverArgumentos(request.body.args)` → `esquemaDeArgumentos(nome).safeParse(revividos)`. O limite de profundidade (`PROFUNDIDADE_MAXIMA = 6`) só existe no zod, que roda depois; `reviver` desce a árvore inteira por recursão direta. Reproduzido via `app.inject` com Membro autenticado:

```ts
const n = 200000;
payload: `{"args":[${"[".repeat(n)}${"]".repeat(n)}]}`   // 400 011 bytes, abaixo do bodyLimit padrão (1 MiB)
// → 500 {"ok":false,"error":"Erro interno."}
// isolado: reviverArgumentos(args) lança RangeError: Maximum call stack size exceeded; ARGUMENTOS_GENERICOS.safeParse(args) devolve success:false sem lançar
```

`JSON.parse` do Node é iterativo e aceita; o `reviver` não. O `RangeError` sobe ao `setErrorHandler` → 500 + `request.log.error` — o mesmo efeito 1 de CR-02 (qualquer Membro autenticado enche o log de erros do processo com entrada trivial), só que por outro caminho. O comentário em `operacoes.ts:150-152` diz que `RangeError` "já não é sinal de entrada" — aqui é.
**Correção:** Validar **antes** de reviver, ou limitar a profundidade no `reviver`. A menor mudança na rota:

```ts
let revividos: unknown[];
try {
  revividos = reviverArgumentos(request.body.args);
} catch (erro) {
  if (erro instanceof RangeError) return reply.code(400).send({ ok: false, error: mensagemDeEntradaInvalida(nome) });
  throw erro;
}
```

Melhor: `reviver(valor, nivel)` com `if (nivel > PROFUNDIDADE_MAXIMA) throw new ErroDeEntrada(...)` (ou devolver o valor intocado e deixar o zod recusar), e um teste em `operacoes.test.ts` com `n = 10000` → 400. Também `serializar`/`reviver` poderiam ser iterativos, mas o limite é suficiente.

### WR-11: `TypeError → 400` também é aplicado às 23 operações com schema, onde um `TypeError` depois da validação só pode ser bug — registrado como `warn` de "entrada inválida" (novo)

**Arquivo:** `apps/api/src/rotas/operacoes.ts:143-161`
**Problema:** O mapeamento é indiscriminado: `if (erro instanceof TypeError)` vale para qualquer `nome`. Para uma operação em `ESQUEMAS`, os `args` já têm exatamente a forma da assinatura quando chegam ao domínio — um `TypeError` ali vem de um estado hidratado inconsistente (`jsonb` malformado por CR-02, uma coluna gerada fora de sincronia, um `find()` que devolveu `undefined` onde o domínio assumia registro) ou de um bug no domínio. A rota devolve 400 "Entrada inválida para `updateTask`" ao cliente e grava `warn`, não `error`: o `apps/web` mostra "entrada inválida" para um clique legítimo, o operador não vê nada no nível de alerta, e o bug fica escondido atrás de um código de cliente. O comentário em `:146-149` diz "para quem não tem schema próprio, um `TypeError` é o sinal de forma errada" — o código não faz essa distinção.
**Correção:**

```ts
} catch (erro) {
  const temSchemaProprio = Object.hasOwn(ESQUEMAS, nome);
  if (erro instanceof TypeError && !temSchemaProprio) {
    request.log.warn({ operacao: nome, membro: request.membro.id, causa: erro.message }, "TypeError dentro da operação — tratado como entrada inválida");
    throw new ErroDeEntrada(mensagemDeEntradaInvalida(nome));
  }
  throw erro; // 500 + log error: é bug, não entrada
}
```

(importando `ESQUEMAS` de `esquemas-de-argumentos.ts`). Se CR-02 for fechado pela opção (a) — 404 para operações sem schema — o mapeamento de `TypeError` pode ser removido por inteiro, o que é o desfecho mais limpo.

## Informações

### IN-01: `membroPorUsuario` usa `LIMIT 1` sem `ORDER BY` — resolução de sessão não determinística se houver dois Membros com o mesmo `userId` — STILL OPEN

**Arquivo:** `apps/api/src/persistencia/membros.ts:18-26`
**Problema:** Inalterado. WR-09 mostra um caminho novo (dois vivos para o mesmo e-mail) que, no aceite, produz exatamente a duplicata.
**Correção:** `order by (dados->>'state') = 'ativo' desc, atualizado_em desc limit 1` e índice único parcial em migração `003`.

### IN-02: `reviver()` copia a chave `__proto__` por atribuição — PARCIALMENTE (mitigado pelo zod, não pelo `reviver`)

**Arquivo:** `packages/dominio/src/operations/registro.ts:457-466`
**Problema:** Inalterado. Verificado nesta revisão: com `[{"__proto__":{"title":"hijack"},"name":"x"}]`, o objeto revivido tem `title` herdado; `ARGUMENTOS_GENERICOS` recria via `Reflect.ownKeys` (limpo, `title` some); `ESQUEMAS.updateTask.safeParse(["t", {"__proto__":{"description":"hijack"},"title":"ok"}])` **lê** `input.description` herdado e o materializa como próprio na saída (`data[1].description === "hijack"`, protótipo limpo). Não é bypass — o valor passa pelo mesmo `z.string()` que passaria se enviado direto —, mas prova que a defesa é o zod e que o `reviver` continua produzindo objetos com protótipo escolhido pelo cliente.
**Correção:** `if (chave === "__proto__" || chave === "constructor" || chave === "prototype") continue;` no `reviver` (e em `serializar`).

### IN-03: `bootstrapGestao` confere "Espaço vazio" fora da transação (TOCTOU) — STILL OPEN

**Arquivo:** `apps/api/src/bootstrap/gestao.ts:29-42`
**Problema:** Inalterado.
**Correção:** `count` dentro do `begin` com `select ... for update` na linha de `plataforma.workspaces`.

### IN-04: Documentação desatualizada em relação ao código entregue — PARCIALMENTE RESOLVIDO

**Arquivo:** `apps/api/CONTEXT.md:28-29, 40`; `apps/api/package.json:5`
**Problema:** `rotas/CONTEXT.md` foi atualizado (lista os três arquivos, "Nasce vazia" saiu). `apps/api/CONTEXT.md` ainda diz "Hoje só `GET /saude` (pública); as rotas por operação … chegam no Plan 01-04" e lista `src/repositorios/` (a pasta é `src/persistencia/`); `package.json` ainda descreve "Esqueleto do backend. A camada HTTP ainda não foi escolhida".
**Correção:** Atualizar as duas frases e o nome da pasta; descrever o pacote como "Backend HTTP (Fastify) sobre `@n1/dominio`".

### IN-05: Referência do projeto Supabase em arquivo de exemplo e em documentação versionada — STILL OPEN

**Arquivo:** `apps/api/.env.example:26`; `apps/api/src/persistencia/CONTEXT.md:7`
**Problema:** Inalterado.
**Correção:** Remover o `ref` do comentário e da tabela.

### IN-06: `NEXT_PUBLIC_API_URL!` com asserção não nula e mensagem de erro que não cita `API_URL` — STILL OPEN

**Arquivo:** `apps/web/src/dados/sessao-provider.tsx:38`; `apps/web/src/dados/estado-inicial.ts:43-44`
**Problema:** Inalterado.
**Correção:** Checagem explícita com mensagem que nomeia a variável e o arquivo `.env.local`.

### IN-07: `syncIdSequence` é empurrado por ids literais de 6 caracteres — STILL OPEN

**Arquivo:** `packages/dominio/src/operations/activity.ts:31, 52-74`
**Problema:** Inalterado.
**Correção:** Formato distinto para ids gerados, ou contador persistido em `plataforma.workspaces`.

### IN-08: `MODELOS_DA_PLATAFORMA` e `TOOLS` são compartilhados por referência entre todos os `DataState` — STILL OPEN

**Arquivo:** `packages/dominio/src/seed.ts:1898, 2391-2392`; `packages/dominio/src/bootstrap-gestao.ts:49`
**Problema:** Inalterado.
**Correção:** `models: [...MODELOS_DA_PLATAFORMA]`, `tools: [...TOOLS]` ou `Object.freeze`.

### IN-09: `sessaoExpirada: true` é produzido pelo transporte mas ignorado pelo store — STILL OPEN

**Arquivo:** `apps/web/src/dados/transporte.ts:93, 111`; `apps/web/src/dados/store.ts:147-153`
**Problema:** Inalterado.
**Correção:** No `case "falha"`, redirecionar para `/entrar` ou expor `aoExpirarSessao`.

### IN-10: O "portão de drift" `satisfies Esquemas` só prende numa direção — um schema mais estrito que a assinatura compila e vira 400 falso para o `apps/web` (novo)

**Arquivo:** `apps/api/src/rotas/esquemas-de-argumentos.ts:42, 121-156`
**Problema:** `z.ZodType<ArgumentosDe<N>>` confere que a **saída** do schema é atribuível ao tipo da assinatura. É o que barra `updateTask: z.tuple([ID, z.object({ title: z.number() })])` (o exemplo do comentário). Mas o inverso passa sem erro: `createTask` com `parentTaskId: ID` (obrigatório em vez de opcional) tem saída `{ …, parentTaskId: string }`, atribuível a `CreateTaskInput` — compila, e toda criação de Tarefa raiz pelo `apps/web` (`listas/[lista]/page.tsx:247`, sem `parentTaskId`) passaria a receber 400. O mesmo para `moveTask: z.tuple([ID, ID])` (sem o terceiro elemento opcional) ou para um `.strict()` que esqueça uma chave que o web manda. Hoje as 23 conferem campo a campo (verificado contra `CreateTaskInput`, `UpdateTaskInput`, `ReceivableSeriesInput`, `addTaskComment`, `ActorRef`, `TaskDate`, `FieldValue["value"]`), então não há bug — mas o comentário promete uma garantia que o tipo não dá, e a rede real contra esse drift são os testes (b)/(d)/(e)/(f) com as formas literais do web, que cobrem só parte das 23.
**Correção:** Ou documentar a assimetria no comentário ("um schema mais estrito compila; a proteção contra isso são os testes com as formas literais do web"), ou completar a rede: um teste por operação em `ESQUEMAS` com a forma **mínima** que o web envia (sem opcionais) e a forma **máxima**, geradas a partir dos call sites. Uma checagem de tipo bidirecional (`[A] extends [B] ? [B] extends [A] ? …`) não fecha por causa de `readonly` e `?:` vs `| undefined`, então não vale o esforço.

### IN-11: A mensagem de 400 ecoa chaves de objeto fornecidas pelo cliente (`path.join(".")`), sem limite de tamanho (novo)

**Arquivo:** `apps/api/src/rotas/operacoes.ts:77-80, 132`
**Problema:** Para operações no fallback, `z.record(z.string(), …)` produz `issues[0].path` com o nome da chave que o cliente enviou (por exemplo, no estouro de profundidade: `["0", "<chave de 300 KB>", …]`). `mensagemDeEntradaInvalida` concatena isso no corpo da resposta: `Entrada inválida para "createChatFolder" em 0.<chave>…`. É JSON e o `apps/web` renderiza `lastResult.error` como texto em React, então não é XSS — mas é conteúdo do cliente refletido e potencialmente enorme numa mensagem que existe para ser curta. Os `problemas` completos já vão ao `request.log.warn`.
**Correção:** Limitar o caminho aos elementos numéricos/declarados, ou truncar: `problema.path.slice(0, 4).map(p => String(p).slice(0, 40)).join(".")`; ou devolver só o índice do argumento (`em args[1]`) e deixar o detalhe no log.

---

_Revisado em: 2026-09-16T20:03:40Z_
_Revisor: Claude (gsd-code-reviewer)_
_Profundidade: standard_
