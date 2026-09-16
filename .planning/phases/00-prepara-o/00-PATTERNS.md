# Fase 0: Preparação — Mapa de Padrões

**Mapeado em:** 2026-09-16
**Arquivos analisados:** 15 (novos + modificados)
**Analogias encontradas:** 12 / 15 (3 sem analogia direta — ver seção final)

## Classificação de Arquivos

| Arquivo novo/modificado | Papel | Fluxo de dados | Analogia mais próxima | Qualidade |
|---|---|---|---|---|
| `apps/api/src/importacao/clickup/cliente.ts` | service (cliente HTTP externo) | request-response | `apps/api/src/autenticacao/resolver-usuario.ts` | papel-match |
| `apps/api/src/importacao/clickup/cliente.test.ts` | test | request-response | `apps/api/src/servicos/convidar-membro.test.ts` (padrão de teste, não conteúdo) | papel-match |
| `apps/api/src/importacao/clickup/paginacao.ts` | utility (paginação/generators) | streaming | `resolver-usuario.ts` (loop de páginas do Admin API) | parcial (mesma ideia, escopo menor) |
| `apps/api/src/importacao/clickup/paginacao.test.ts` | test | streaming | `apps/api/src/rotas/esquemas-de-argumentos.test.ts` (padrão de unit test puro, sem I/O) | papel-match |
| `apps/api/src/importacao/clickup/exportar.ts` | service (orquestração/batch) | batch/file-I/O | `apps/api/src/bootstrap/gestao.ts` | papel-match |
| `apps/api/src/importacao/clickup/exportar.cli.ts` | CLI/script | batch | `apps/api/src/bootstrap/gestao.cli.ts` e `apps/api/src/persistencia/migrar.cli.ts` | exato |
| `apps/api/src/importacao/clickup/manifesto.ts` | utility (hash/relatório) | file-I/O | `apps/api/src/persistencia/repositorio.ts` (`semear`, contagem de gravados) — parcial; sem analogia exata de "hash+contagem" | parcial |
| `apps/api/src/importacao/clickup/manifesto.test.ts` | test | file-I/O | `apps/api/src/rotas/esquemas-de-argumentos.test.ts` (unit puro, fixtures) | papel-match |
| `apps/api/src/importacao/clickup/de-para-usuarios.ts` | config/model (tabela tipada) | CRUD (leitura estática) | `packages/dominio/src/colecoes.ts` (registro tipado exaustivo) + `packages/dominio/src/bootstrap-gestao.ts` (papéis) | papel-match |
| `apps/api/src/importacao/clickup/de-para-usuarios.test.ts` | test | CRUD | `apps/api/src/rotas/esquemas-de-argumentos.test.ts` | papel-match |
| `apps/api/src/importacao/CONTEXT.md` | docs (convenção de pasta) | — | `apps/api/src/rotas/CONTEXT.md` / `apps/api/src/servicos/CONTEXT.md` | exato |
| `apps/api/src/importacao/clickup/CONTEXT.md` | docs (convenção de pasta) | — | `apps/api/src/servicos/CONTEXT.md` | exato |
| `docs/07-processos/solicitacao-de-pagamento.md` | docs (spec de processo) | — | `docs/07-processos/contas-a-pagar.md` | exato |
| `apps/api/package.json` (script `exportar:clickup`) | config | — | script `bootstrap:gestao` / `migrar` já existentes no mesmo arquivo | exato |
| `apps/api/.env.example` (`CLICKUP_API_TOKEN`) | config | — | entradas existentes (`DATABASE_URL`, `SUPABASE_*`) no mesmo arquivo | exato |
| `.gitignore` (raiz, pasta de exportação) | config | — | bloco `# env files` já existente no mesmo arquivo | exato |
| `.planning/REQUIREMENTS.md` (PREP-05 → risco aceito) | docs | — | sem analogia de código — edição de prosa | n/a |

## Atribuições de Padrão

### `apps/api/src/importacao/clickup/cliente.ts` (service, request-response)

**Analogia:** `apps/api/src/autenticacao/resolver-usuario.ts`

**Padrão de comentário de cabeçalho** (linhas 1-21) — explica o PORQUÊ antes do código, cita a fonte verificada (versão de lib, arquivo `.d.ts`) e o risco mitigado:
```typescript
/**
 * Resolve "que Usuário do Supabase Auth tem este e-mail?" — a ponte que
 * PERS-09 precisa para reconvidar um Membro `removido` pelo mesmo `userId`
 * (RN-ET-11)...
 *
 * Teto de 10 páginas × 1000 (T-1-05, Denial of Service): a plataforma tem
 * dezenas de Usuários hoje, não milhares — um teto documentado é melhor do
 * que uma paginação sem fim...
 */
```
Aplicar o mesmo molde ao cabeçalho de `cliente.ts`: por que `fetch` nativo (não SDK), por que backoff só em 429 com `X-RateLimit-Reset` (não retry genérico), e citar a fonte (`developer.clickup.com/docs/authentication` — sem prefixo `Bearer`).

**Núcleo do padrão — loop com teto e chamada HTTP tipada por retorno** (linhas 23-38):
```typescript
export type ResolverUsuario = (email: string) => Promise<string | undefined>;

const TETO_DE_PAGINAS = 10;
const POR_PAGINA = 1000;

export const resolverUsuarioPorEmail: ResolverUsuario = async (email) => {
  const alvo = email.trim().toLowerCase();

  for (let page = 1; page <= TETO_DE_PAGINAS; page += 1) {
    const { data, error } = await clienteAdmin().auth.admin.listUsers({ page, perPage: POR_PAGINA });
    if (error) throw error;

    const achado = data.users.find((usuario) => usuario.email?.toLowerCase() === alvo);
    if (achado) return achado.id;

    if (!data.nextPage) break;
  }
  return undefined;
};
```
Copiar a forma: uma função exportada com tipo de retorno explícito (`export type X = (...) => Promise<...>`), loop com condição de parada dupla (indicador da API OU teto de segurança), erro que sobe (`throw`) sem tentar decorar. Para `clienteClickUp`, o teto equivalente é o backoff em 429 (RESEARCH.md Pattern 3/Code Examples — usar `resposta.text()` cru, nunca `JSON.stringify(await .json())`, para hash estável do manifesto).

**Erro nunca vaza detalhe sensível** (comentário linha 36-37):
```typescript
// Erro da Admin API sobe ao `setErrorHandler` de `app.ts` — 500 genérico,
// detalhe só no log (T-1-06); nunca vaza para a resposta.
```
Aplicar a mesma disciplina ao cliente ClickUp: nunca logar o header `Authorization` nem o token em mensagens de erro (RESEARCH.md, Security Domain — vazamento de `CLICKUP_API_TOKEN`).

---

### `apps/api/src/importacao/clickup/exportar.cli.ts` (CLI/script, batch)

**Analogia:** `apps/api/src/bootstrap/gestao.cli.ts` (exato) e `apps/api/src/persistencia/migrar.cli.ts`

**Padrão completo — CLI fino, só composição** (`gestao.cli.ts`, arquivo inteiro):
```typescript
/**
 * `npm run bootstrap:gestao -w @n1/api`
 *
 * Roda uma vez, depois de `npm run migrar` e de `npm run usuarios:seed`
 * (apps/api/CONTEXT.md) — cria o Espaço "Gestão" › Pasta "Financeiro" de
 * produção, com a Maryane como única Membro, Proprietária.
 */

import { carregarEnv, encerrar, pool } from "../persistencia/conexao";
import { bootstrapGestao } from "./gestao";

carregarEnv();
const workspaceId = process.env.WORKSPACE_ID ?? "ws_n1";

const cliente = await pool().connect();
let resultado;
try {
  resultado = await bootstrapGestao(cliente, { workspaceId });
} finally {
  cliente.release();
}

if (resultado.criado) {
  console.log(`criado   Espaço "${workspaceId}" · ${resultado.gravados} registros gravados`);
} else {
  console.log(`pulado   ${resultado.motivo}`);
}
await encerrar();
```

**Padrão mais simples — `migrar.cli.ts` inteiro** (sem `pool().connect()` explícito, quando a função já encapsula):
```typescript
/** `npm run migrar -w @n1/api` */

import { encerrar } from "./conexao";
import { migrar } from "./migrar";

const aplicadas = await migrar();
if (aplicadas.length === 0) {
  console.log("Nada a aplicar: o banco já está em dia.");
} else {
  for (const { nome, ms } of aplicadas) console.log(`aplicada  ${nome}  (${ms} ms)`);
}
await encerrar();
```

Copiar para `exportar.cli.ts`: comentário de cabeçalho de uma linha com o comando `npm run` real; `carregarEnv()` primeiro (via `../persistencia/conexao`, D-01); toda a lógica em `exportar.ts` (função pura/orquestradora), o `.cli.ts` só chama, formata `console.log` de resultado com um verbo alinhado (`criado`/`pulado`/`aplicada`) e encerra recursos no fim. **Diferença aqui:** este CLI não usa `pool()` (a exportação não toca o Postgres — RESEARCH.md Architectural Responsibility Map) — só `carregarEnv()` para ler `CLICKUP_API_TOKEN`, sem `encerrar()` de pool.

**Script no `package.json`** (padrão a seguir, `apps/api/package.json`):
```json
"scripts": {
  "migrar": "vite-node src/persistencia/migrar.cli.ts",
  "usuarios:seed": "vite-node src/autenticacao/criar-usuarios-do-seed.ts",
  "bootstrap:gestao": "vite-node src/bootstrap/gestao.cli.ts"
}
```
Adicionar `"exportar:clickup": "vite-node src/importacao/clickup/exportar.cli.ts"` na mesma lista, mesmo formato `vite-node <caminho>`.

---

### `apps/api/src/importacao/clickup/exportar.ts` (service, orquestração/batch)

**Analogia:** `apps/api/src/bootstrap/gestao.ts`

**Padrão — comentário de intenção + guarda de idempotência + resultado tipado** (arquivo inteiro):
```typescript
/**
 * Materializa o dado inicial de produção da Fase 1 (PERS-06): o `DataState`
 * de `buildGestaoBootstrap()` — só a configuração do Financeiro, a Maryane
 * Proprietária — gravado num Espaço de Trabalho vazio, uma vez.
 *
 * Guarda de "Espaço vazio": rodar duas vezes não duplica nem apaga nada...
 */

export interface ResultadoDoBootstrap {
  readonly criado: boolean;
  readonly gravados: number;
  readonly motivo?: string;
}

export async function bootstrapGestao(
  cliente: PoolClient,
  opcoes: { readonly workspaceId: string; readonly agora?: string },
): Promise<ResultadoDoBootstrap> {
  const { workspaceId, agora } = opcoes;
  const { rows } = await cliente.query(...);
  const n = rows[0]?.n ?? 0;
  if (n > 0) {
    return { criado: false, gravados: 0, motivo: `...` };
  }
  await cliente.query("begin");
  try {
    const gravados = await semear(cliente, workspaceId, buildGestaoBootstrap({ workspaceId, agora }));
    await cliente.query("commit");
    return { criado: true, gravados };
  } catch (erro) {
    await cliente.query("rollback");
    throw erro;
  }
}
```

Copiar a forma para `exportar.ts`: uma interface `ResultadoDaExportacao` (contagens por recurso, lista de user ids vistos, avisos de `time_in_status` indisponível — RESEARCH.md Pitfall 2), uma função `exportarClickUp(opcoes)` que decide **pular** trabalho já feito (aqui: pular gravação se o arquivo de página já existe no disco — RESEARCH.md Pitfall 4 "o próprio filesystem é o checkpoint" — equivalente à guarda `if (n > 0)` do bootstrap), e nunca deixar o processo morto sem sinalizar o motivo (`motivo?: string` opcional, populado só no caminho "pulado").

---

### `apps/api/src/importacao/clickup/de-para-usuarios.ts` (config/model, tabela tipada)

**Analogia:** `packages/dominio/src/colecoes.ts` (exaustividade tipada) + `packages/dominio/src/bootstrap-gestao.ts` (papéis reais)

**Padrão — tipo que força exaustividade via `Record`** (`colecoes.ts`, linhas 12-19 + 22-24):
```typescript
export type ChaveDeColecao = {
  [K in keyof DataState]-?: DataState[K] extends readonly unknown[] ? K : never;
}[keyof DataState];

const TODAS: Record<ChaveDeColecao, true> = {
  models: true,
  tools: true,
  members: true,
  // ...
};
```
Comentário que justifica a exaustividade (linhas 1-10):
```typescript
/**
 * As coleções de `DataState`, declaradas pelo próprio domínio.
 *
 * Quem persiste o estado precisa saber quais chaves existem — uma coleção
 * vazia não deixa rastro no banco...
 *
 * O tipo `Record<ChaveDeColecao, true>` é o que mantém a lista honesta:
 * acrescentar uma coleção a `DataState` sem acrescentá-la aqui não compila.
 */
```

**Os `roleId` reais que o de-para deve referenciar** (`bootstrap-gestao.ts`, linhas 113-116):
```typescript
{ id: "role_prop", workspaceId, name: "Proprietário do Espaço de Trabalho", system: true, base: "proprietario", permissions: [] },
{ id: "role_adm", workspaceId, name: "Administrador", system: true, base: "administrador", permissions: [] },
{ id: "role_mem", workspaceId, name: "Membro", system: true, base: "membro", permissions: [] },
{ id: "role_conv", workspaceId, name: "Convidado", system: true, base: "convidado", permissions: [] },
```

**Forma de entrada exigida por `inviteMember`** (`packages/dominio/src/operations/members.ts`, linhas 299-303):
```typescript
export function inviteMember(
  state: DataState,
  actingMemberId: Id,
  input: { readonly email: string; readonly roleId: Id; readonly userId?: Id },
): OperationResult<Member> {
```

Copiar para `de-para-usuarios.ts`: `export interface EntradaDeParaUsuario { readonly clickupUserId: string; readonly email: string; readonly roleIdEsperado: "role_prop" | "role_adm" | "role_mem" | "role_conv"; readonly memberIdConhecido?: string }` (forma já esboçada em RESEARCH.md, seção "Forma do de-para"), mais um comentário de cabeçalho no molde de `colecoes.ts`/`bootstrap-gestao.ts` — por que a tabela existe, o que quebra se um `roleIdEsperado` não bater com os 4 reais, e a nota sobre a colisão Financeiro/`mem_maryane` (RESEARCH.md Open Question 3).

---

### `apps/api/src/importacao/clickup/*.test.ts` (unit, sem I/O)

**Analogia:** `apps/api/src/rotas/esquemas-de-argumentos.test.ts`

**Padrão — describe temático + casos rotulados por letra, cabeçalho explicando o que o arquivo prova E o que não prova** (linhas 1-19):
```typescript
/**
 * `esquemas-de-argumentos.ts` — testes puros, sem banco, sem `buildApp`: só a
 * FORMA dos argumentos, nunca regra de negócio. Provam duas coisas: (1) as
 * formas hostis que motivaram CR-02 caem (...); (2) as formas LITERAIS que
 * `apps/web` manda hoje continuam passando — a rede de regressão contra
 * falso positivo de drift.
 */

import { describe, expect, it } from "vitest";
import { ehNomeDeOperacao } from "@n1/dominio/operations/registro";
import { ARGUMENTOS_GENERICOS, ESQUEMAS, esquemaDeArgumentos } from "./esquemas-de-argumentos";

describe("esquemas-de-argumentos — a forma dos args, não a regra", () => {
  it("(a) updateTask recusa title fora do tipo, description fora do tipo e chave desconhecida", () => {
    expect(ESQUEMAS.updateTask.safeParse(["t1", { title: 123 }]).success).toBe(false);
    ...
  });
```
Copiar: `describe` nomeando o arquivo + a alegação central; casos `it("(a) ...")`, `it("(b) ...")` narrando o comportamento em prosa pt-BR antes do `expect`; nenhum mock de rede — para `paginacao.test.ts`, `manifesto.test.ts` e `de-para-usuarios.test.ts`, usar fixtures literais no próprio teste (JSON copiado da documentação oficial do ClickUp, nunca de dados reais — RESEARCH.md Wave 0 Gaps).

---

### Testes de integração que pulam sem variável de ambiente

**Analogia:** `apps/api/src/persistencia/persistencia.test.ts` + `apps/api/src/servicos/convidar-membro.test.ts`

**Padrão — `describe.skip` condicional por variável de ambiente** (`persistencia.test.ts`, linhas 1-27):
```typescript
/**
 * ...
 * Precisa de um Postgres em DATABASE_URL — da variável de ambiente ou de
 * `apps/api/.env`. Sem ele, os testes são pulados em vez de falhar, para
 * `npm run check` não depender de infraestrutura.
 */

import { carregarEnv, encerrar, pool } from "./conexao";

carregarEnv();
const temBanco = Boolean(process.env.DATABASE_URL);
const d = temBanco ? describe : describe.skip;

d("persistência do DataState", () => {
  ...
});
```

**Padrão — combinar duas variáveis, um `it.skip` isolado dentro do bloco** (`convidar-membro.test.ts`, linhas 55-58 e 155-175):
```typescript
carregarEnv();
const temBanco = Boolean(process.env.DATABASE_URL);
const temAuth = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
const d = temBanco ? describe : describe.skip;
...
const rodar = temAuth ? it : it.skip;
const titulo = temAuth
  ? "(c) userId forjado no corpo é ignorado — a rota resolve pelo Auth real e reativa mem_tiago"
  : "(c) pulado: sem SUPABASE_URL/SUPABASE_SECRET_KEY para resolver o e-mail contra o Auth real";
rodar(titulo, async () => { ... });
```

Copiar para o teste de integração do exportador (`exportar.integration.test.ts` ou nome equivalente, mencionado em RESEARCH.md Test Map): `carregarEnv()` no topo, `const temToken = Boolean(process.env.CLICKUP_API_TOKEN)`, `const d = temToken ? describe : describe.skip`, e — se o smoke-test de `time_in_status` (Open Question 2 do RESEARCH.md) precisar rodar isolado — o padrão `it.skip` com título explicando por que pulou, igual ao caso (c).

---

## Padrões Compartilhados

### Carregamento de variável de ambiente
**Fonte:** `apps/api/src/persistencia/conexao.ts`, linhas 8-22
```typescript
/** Lê apps/api/.env sem depender de dotenv — só as chaves que faltam. */
export function carregarEnv(caminho = new URL("../../.env", import.meta.url)): void {
  let texto: string;
  try {
    texto = readFileSync(caminho, "utf8");
  } catch {
    return;
  }
  for (const linha of texto.split("\n")) {
    const corte = linha.indexOf("=");
    if (corte <= 0 || linha.trimStart().startsWith("#")) continue;
    const chave = linha.slice(0, corte).trim();
    if (process.env[chave] === undefined) process.env[chave] = linha.slice(corte + 1).trim();
  }
}
```
**Aplicar a:** `exportar.cli.ts` e ao teste de integração — sempre `carregarEnv()` antes de ler `process.env.CLICKUP_API_TOKEN`; nunca ler `process.env` direto sem essa chamada primeiro (D-01 do CONTEXT.md exige "só no `.env` do `apps/api`, via `carregarEnv()`").

### Convenção de `CONTEXT.md` por pasta nova
**Fonte:** `apps/api/src/servicos/CONTEXT.md` (arquivo inteiro) e `apps/api/src/rotas/CONTEXT.md`
```markdown
# servicos

Ler primeiro: [`../../CONTEXT.md`](../../CONTEXT.md) e [`../CONTEXT.md`](../CONTEXT.md)

Os casos de uso. Compõem operações de `@n1/dominio` e falam com os repositórios. A transação começa e termina aqui.

Um serviço existe quando a operação precisa de I/O ANTES de entrar na Unidade de Trabalho...

## `convidar-membro.ts`

`convidarMembro(pedido, deps?)` — o exemplo do contrato. Antes de `executar()`: ...
```
**Aplicar a:** `apps/api/src/importacao/CONTEXT.md` (nível pasta-mãe: o que a pasta é e não é — só insumo, nada de rota/regra de negócio, D-01) e `apps/api/src/importacao/clickup/CONTEXT.md` (nível módulo: um parágrafo por arquivo, no mesmo formato "## `nome-do-arquivo.ts`" seguido de uma frase-resumo do contrato). Sempre abrir com o link relativo para o(s) `CONTEXT.md` acima, na mesma ordem (repo → workspace → pasta).

### Script `vite-node` no `package.json`
**Fonte:** `apps/api/package.json`, bloco `scripts`
```json
"migrar": "vite-node src/persistencia/migrar.cli.ts",
"usuarios:seed": "vite-node src/autenticacao/criar-usuarios-do-seed.ts",
"bootstrap:gestao": "vite-node src/bootstrap/gestao.cli.ts"
```
**Aplicar a:** adicionar `"exportar:clickup": "vite-node src/importacao/clickup/exportar.cli.ts"` na mesma lista — mesmo verbo curto sem espaço (`exportar:clickup`, no padrão `bootstrap:gestao`/`usuarios:seed`), mesmo formato de valor.

### `.gitignore` — bloco de exceção por padrão, não por arquivo solto
**Fonte:** `.gitignore` (raiz), bloco `# env files`
```
# env files (can opt-in for committing if needed)
.env*
# ...exceto os exemplos: só placeholder, servem de documentação para quem clona.
!.env.example
!.env.local.example
```
**Aplicar a:** novo bloco `# exportação do ClickUp (PREP-02/D-02) — dados fora do git, LGPD` com `apps/api/exportacoes/clickup/` ignorado. Seguir a recomendação de segurança do RESEARCH.md (Threat Patterns): manter `MANIFESTO.md` **fora** do padrão ignorado desde o início (ex.: `apps/api/exportacoes/MANIFESTO.md` sem estar dentro de `apps/api/exportacoes/clickup/`), em vez de usar uma exceção `!` — mais simples e sem risco de erro de glob, ao contrário do padrão de exceção usado para `.env.example` acima (que é aceitável ali porque é um arquivo único, não um subdiretório inteiro).

### Molde de spec de processo (`docs/07-processos/`)
**Fonte:** `docs/07-processos/contas-a-pagar.md` — cabeçalhos reais (extraídos via grep):
```
# Contas a pagar — processo do Financeiro
## 1. O que o processo faz
## 2. Estrutura
## 3. Conjunto de Status
### Transições observadas no histórico
## 4. Definições de Campo Personalizado
### 4.1 Classificação (quem paga, para quê)
### 4.2 Fornecedor (a quem se paga)
### 4.3 Documento e datas
### 4.4 Pagamento (como se paga)
### 4.5 Controle
## 5. Tags
## 6. O fluxo, passo a passo
### 6.1 Abertura (D-30)
### 6.2 Cobrança da nota fiscal (D-5 a D-2)
### 6.3 Lançamento no ERP (D-1)
### 6.4 Remessa e autorização (D0)
### 6.5 Pagamento (D0 a D+1)
## 7. Recorrência
## 8. Automações a construir
## 9. Agente de lançamento
## 10. Permissões
## 11. Regras que a plataforma deve validar
## 12. O que não foi verificado e precisa de decisão
```
**Aplicar a:** `docs/07-processos/solicitacao-de-pagamento.md` — copiar exatamente a numeração §1–§12 e os subtítulos de mesma função (§3 "Transições observadas" com a ressalva de granularidade aproximada, RESEARCH.md Pitfall 1; §4 organiza Campos por grupo temático, não por ordem alfabética; §12 é onde toda lacuna que a exportação não resolve — CPF/CNPJ, `Cartão`/`Link de pagamento`, `em revisão` — vai parar, por D-08).

## Sem Analogia Encontrada

| Arquivo | Papel | Fluxo de dados | Motivo |
|---|---|---|---|
| `apps/api/src/importacao/clickup/paginacao.ts` | utility | streaming (dois padrões distintos: `page`/`last_page` e `start`/`start_id`) | Nenhum código existente pagina por dois esquemas diferentes no mesmo módulo; `resolver-usuario.ts` só cobre o padrão `page`/`perPage`. Usar o Pattern 1/2 do RESEARCH.md como fonte primária, `resolver-usuario.ts` como referência de estilo de loop. |
| `apps/api/src/importacao/clickup/manifesto.ts` | utility (hash + relatório) | file-I/O | Não existe hoje nenhum gerador de manifesto/checksum no repositório; `node:crypto` nunca foi usado em `apps/api`. Seguir o Pattern 4 e o Code Example do RESEARCH.md ("Manifesto como prova de paridade") como fonte primária. |
| `.planning/REQUIREMENTS.md` (edição PREP-05 → risco aceito) | docs | — | Edição de prosa existente, não um padrão de código; seguir a redação exata sugerida em CONTEXT.md D-13 e RESEARCH.md Open Question 4 ("risco aceito pelo dono (D-13)"). |

## Metadados

**Escopo da busca de analogias:** `apps/api/src/{bootstrap,persistencia,autenticacao,servicos,rotas}`, `packages/dominio/src/{colecoes.ts,bootstrap-gestao.ts,operations/members.ts}`, `docs/07-processos/`, `.gitignore`, `apps/api/package.json`.
**Arquivos lidos:** `gestao.cli.ts`, `gestao.ts`, `migrar.cli.ts`, `conexao.ts`, `resolver-usuario.ts`, `persistencia.test.ts`, `convidar-membro.test.ts`, `esquemas-de-argumentos.ts` + `.test.ts`, `rotas/CONTEXT.md`, `servicos/CONTEXT.md`, `colecoes.ts`, `bootstrap-gestao.ts` (trecho de papéis), `operations/members.ts` (`inviteMember`), `apps/api/package.json`, `.gitignore` (raiz), `apps/api/CONTEXT.md`, `docs/07-processos/contas-a-pagar.md` (cabeçalhos).
**Data da extração:** 2026-09-16
