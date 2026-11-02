# Fase 12: Clone ClickUp: gravação mais rápida - Mapa de padrões

**Mapeado:** 2026-10-30
**Arquivos analisados:** 25 (7 novos de código/teste, 18 modificados)
**Analogs encontrados:** 25 / 25 (todos tracked em git; `git ls-files` conferido nos modificados e nos moldes)

Camadas: só `apps/api` e `apps/web`. `packages/dominio` não é tocado. web e api nunca se importam.
Todos os caminhos abaixo são relativos à raiz do repositório.

## Classificação dos arquivos

| Arquivo novo/modificado | Papel | Fluxo de dados | Analog mais próximo | Qualidade |
|---|---|---|---|---|
| `apps/api/src/observabilidade/medicao-da-gravacao.ts` (+ `.test.ts`) | utilitário puro | transform | `observabilidade/reconciliacao.ts` + `previa.ts` (`formatarPrevia`) | role-match |
| `apps/api/src/observabilidade/medir-gravacao.cli.ts` (script `gravacao:medir`) | CLI | batch / request-response (inject) | `observabilidade/reconciliacao.cli.ts`, `automacoes/previa.cli.ts` | exact (formato) |
| `apps/api/src/rotas/operacoes-medicao.test.ts` | teste de rota | request-response | `observabilidade/log.test.ts` (logger capturado) + `rotas/operacoes.test.ts` | exact |
| `apps/api/src/persistencia/unidade-de-trabalho-concorrencia.test.ts` | teste com banco | CRUD concorrente | `testes/banco-crm.ts` (`describeComBanco`) + `automacoes/previa.test.ts` | role-match |
| `apps/api/src/persistencia/unidade-de-trabalho.ts` | serviço (UoW) | CRUD transacional | ele mesmo (regime atual) | exact |
| `apps/api/src/persistencia/repositorio.ts` | repositório | CRUD | ele mesmo (`linhas?` opcional em `EstadoHidratado`) | exact |
| `apps/api/src/rotas/operacoes.ts` | rota | request-response | ele mesmo | exact |
| `apps/api/src/rotas/anexos-da-tarefa.ts` | rota | request-response | `rotas/operacoes.ts` | role-match |
| 4 importadores (`importar-contas-a-pagar.ts`, `importar-contas-a-receber.ts`, `financeiro/importar.ts`, `corrigir-data-de-pagamento-cr.ts`) | serviço batch | batch | eles mesmos (`opcoesDeExecucao`) | exact |
| `apps/web/src/dados/operacoes-que-esperam.ts` (+ `.test.ts`) | utilitário (config) | transform | `apps/api/.../esquemas-de-argumentos.test.ts` (teste "toda chave passa") para o teste; sem analog de dado | partial |
| `apps/web/src/dados/store.ts` (+ `store.test.ts`) | store | event-driven / otimista | ele mesmo | exact |
| `apps/web/src/dados/transporte.ts` (+ `transporte.test.ts`) | cliente HTTP | request-response | ele mesmo | exact |
| `apps/web/src/features/shell/app-shell.tsx`, `linha-da-arvore.tsx` | componente | render | ele mesmos (`href` ausente em `TreeRow`) | exact |
| 4 `CONTEXT.md` (persistencia, rotas, observabilidade, web) | doc | — | eles mesmos | — |

## Atribuições de padrão

### `persistencia/unidade-de-trabalho.ts` (serviço, CRUD transacional)

**Analog:** o próprio arquivo, `apps/api/src/persistencia/unidade-de-trabalho.ts`.

**Início da transação e `55P03`** (linhas 101-114): a trava no começo herda `inicioDaTransacao()`.
```typescript
export function inicioDaTransacao(env: NodeJS.ProcessEnv = process.env): string { ...
  return `begin; set local idle_in_transaction_session_timeout = ${prazo}; set local statement_timeout = ${instrucao}; set local lock_timeout = ${trava}`;
}
const TRAVA_ESGOTADA = "55P03";
function sqlstateDe(erro: unknown): unknown { ... }
```

**Laço de tentativas a refatorar** (linhas 121-128): hoje `const tentativas = opcoes.tentativas ?? 3; for (n...) { const cliente = await pool().connect(); ... await cliente.query(inicioDaTransacao()); const antes = await hidratar(cliente, workspaceId);`. A trava (`select revisao from plataforma.workspaces where workspace_id = $1 for update`) entra entre `inicioDaTransacao()` e `hidratar`, como instrução separada (RESEARCH, Pattern 1). Travado: 1 tentativa; otimista: `tentativas ?? 3`.

**Conversão de `55P03` em conflito (valor, não exceção)** (linhas 166-181), para reutilizar na trava inicial:
```typescript
} catch (erro) {
  if (sqlstateDe(erro) !== TRAVA_ESGOTADA) throw erro;
  await cliente.query("rollback");
  ultimo = { ok: false, conflito: true, error: "Outra alteração entrou antes desta. Tente de novo." };
  continue;   // no regime travado: return, sem repetir (D-09)
}
```

**Update que deixa de conferir a revisão no regime travado** (linhas 162-163): hoje `... where workspace_id = $1 and revisao = $2 returning revisao`; travado perde o `and revisao = $2`.

**Finally/descarte de conexão** (linhas 213-221): `falhou = true; rollback.catch; release(falhou)`. Manter. `aoMedir` entra no `finally` (sucesso, recusa, conflito e exceção).

**Pontos para `performance.now()`:** `pool().connect()` (conexaoMs), trava, `hidratar` (hidratarMs; `linhasLidas` com `?.`, as fakes devolvem `{ state, revisao }` sem `original`), `carregarCanaisProjetados` (canaisMs), `operacao(...)` (operacaoMs), `update` (atualizaMs), `gravar` (gravarMs), `gravarEventos` (eventosMs), `commit` (commitMs). `travaMs` = mesmo significado antes/depois (RESEARCH Pattern 2).

**Teste:** `persistencia/unidade-de-trabalho-trava.test.ts` linhas 18-60 (pool/repositório/outbox falsos via `vi.hoisted` + `vi.mock`). O fake do pool só responde ao `update`; a nova `select ... for update` cai no `{ rowCount: 0 }` e acionaria o "Espaço não existe": o fake precisa devolver `rowCount: 1` para o `select`. (RESEARCH Pitfall 5.)

### `rotas/operacoes.ts` (rota, request-response)

**Analog:** o próprio arquivo.

**Chamada de `executar` e `SERVICOS`** (linhas 308-350): `opcoes` hoje `{ eventos: (valor, state) => eventosDeSaidaDaOperacao(...) }`. Acrescentar `aoMedir: (m) => { medicao = m; }` e cronometrar o handler (`totalMs`).

**Ponto de vazamento (D-03)** (linhas 384-393): `return reply.code(200).send({ ...resultado, diferenca: ..., sequencia: ... })`, e na linha 359 `reply.code(409).send(resultado)` e 393 `send(resultado)`. Com callback `aoMedir` não há campo em `ResultadoTransacao`, então não vaza por construção; o teste de corpo continua obrigatório. Etapa `recorteMs` = o bloco 385-391 (`visibilidadePara` + `recortarDiferenca` + `recortarValor`). Log: `request.log.info({ operacao: nome, regime, medicao }, "gravacao medida")` antes de cada `send`, incluindo o 409; não logar `args`/`valor`. Referência de `request.log.warn({ operacao: nome, membro: request.membro.id, ... })` na linha 299 para o formato de campos.

`SERVICOS` (ex.: `inviteMember`, `convidarMembro`) chama `executar` por dentro de `deps`; o callback precisa atravessar o serviço ou essa operação fica sem medição (RESEARCH, tabela de chamadores #2).

### `rotas/operacoes-medicao.test.ts` (teste, request-response)

**Analog:** `apps/api/src/observabilidade/log.test.ts` linhas 15-26 (logger capturado por `destino`) e `rotas/operacoes.test.ts` (montagem do app e do Membro).
```typescript
const linhas: string[] = [];
const destino = { write: (linha: string) => void linhas.push(linha) };
const app = buildApp({
  logger: opcoesDoLogger(env, destino),
  workspaceId: "ws_log_teste",
  verificarToken: async () => null, ...
});
```
Afirmar: (1) `JSON.parse(resposta.body)` não tem `medicao`; (2) existe linha com `"gravacao medida"` e as etapas; (3) a linha não contém `args`/nomes de Tarefa.

### `observabilidade/medir-gravacao.cli.ts` (CLI)

**Analogs:** `apps/api/src/observabilidade/reconciliacao.cli.ts` (estrutura) e `apps/api/src/automacoes/previa.cli.ts` (script `npm run`, "só lê, imprime tabela, lógica em módulo à parte").

**Estrutura a copiar** (`reconciliacao.cli.ts` 33-49, 102-114):
```typescript
import { carregarEnv, encerrar } from "../persistencia/conexao";
class SairComCodigo extends Error { constructor(readonly codigo: number) { super(`saída ${codigo}`); } }
const argv = process.argv.slice(2);
function valorDe(chave: string) { const p = `--${chave}=`; return argv.find((a) => a.startsWith(p))?.slice(p.length); }
async function rodar() { carregarEnv(); const workspaceId = valorDe("workspace") ?? process.env.WORKSPACE_ID ?? "ws_n1"; ... }
try { await rodar(); } catch (erro) {
  if (erro instanceof SairComCodigo) { await encerrar(); process.exit(erro.codigo); }
  console.error(erro instanceof Error ? erro.message : String(erro));
  await encerrar(); process.exit(1);
}
await encerrar();
```
Cabeçalho JSDoc com a linha `npm run gravacao:medir -w @n1/api -- ...`, como as duas. `package.json` (linhas 25 e 34): `"automacoes:previa": "vite-node src/automacoes/previa.cli.ts"`, `"reconciliar": "vite-node src/observabilidade/reconciliacao.cli.ts"`, então `"gravacao:medir": "vite-node src/observabilidade/medir-gravacao.cli.ts"`.

**D-17 (app próprio em loopback):** `buildApp({ logger: opcoesDoLogger(env, destino), verificarToken: <stub só neste arquivo>, ... })` (`app.ts` linhas 18, 56-57 aceitam `verificarToken?: VerificarToken`; `opcoesDoLogger(env, destino)` em `observabilidade/log.ts` linha 32 aceita `destino`). Chamar com `app.inject(...)` ou `listen({ host: "127.0.0.1", port: 0 })`. O stub não é exportado e `app.ts`/`index.ts` não o importam. A resolução do Membro precisa de um Membro real do `ws_n1` (ver `persistencia/membros.ts` e `credenciais-de-servico.ts`); conferir como `resolverMembro` default funciona antes de decidir.

### `observabilidade/medicao-da-gravacao.ts` (utilitário puro)

**Analog:** `automacoes/previa.ts` (`formatarPrevia`, `formatarAgenda`): lógica pura em módulo, o CLI só imprime, testável sem banco. Conteúdo: mediana, pior caso, `formatarTabela`, parser da linha de log. Sem analog de estatística: escrever do zero (mediana por ordenação).

### `persistencia/unidade-de-trabalho-concorrencia.test.ts` (teste com banco)

**Analog:** `apps/api/src/testes/banco-crm.ts` linhas 1-47 e 60-... (`describeComBanco`, `prepararBancoCrm`, `poolDoDono`) e usos em `automacoes/previa.test.ts` e `rotas/estado.test.ts`.
```typescript
export const temBancoCrm = hostEhLocal(process.env.DATABASE_URL);
export const describeComBanco = temBancoCrm ? describe : describe.skip;
```
NÃO copiar de `persistencia.test.ts` (usa `Boolean(process.env.DATABASE_URL)`, não exige host local). Convenção de container do `banco-crm.ts`: `crm-n1-pg-12NN`, `DATABASE_URL=postgres://postgres:x@localhost:<porta>/postgres`, e `DATABASE_URL_MIGRACAO` explícito. Nunca contra o `.env`.

### 4 importadores (otimista)

**Analog:** eles mesmos. `importar-contas-a-pagar.ts` linha 215:
```typescript
const opcoesDeExecucao: OpcoesExecucao<readonly ResultadoPorConta[]> = { aoConfirmar, semEventosDeSaida: true };
```
Passa a `{ aoConfirmar, semEventosDeSaida: true, regime: "otimista" }`. Mesma edição nas linhas equivalentes: `importar-contas-a-receber.ts:201`, `importacao/financeiro/importar.ts:477`, `corrigir-data-de-pagamento-cr.ts:237` (esta sem `aoConfirmar`: `{ semEventosDeSaida: true }`). Nenhum chamador de produção passa `tentativas`. O restante dos ~30 chamadores não muda (padrão `"travado"`), exceto passar `aoMedir` onde fizer sentido (opcional). Teste de conferência sugerido: todo chamador com `semEventosDeSaida` passa `regime: "otimista"`.

### `rotas/anexos-da-tarefa.ts` (rota)

**Analog:** `rotas/operacoes.ts`. Chamada em `anexos-da-tarefa.ts:144` `executar(membro.workspaceId, (state) => {...}, { aoConfirmar: consumirSessao })`: só herda o regime travado. O `consumirSessao ... for update` roda dentro de `aoConfirmar`; vigiar o `55P03` ali (Pitfall 4 do RESEARCH). O `send(resultado)` dos dois pontos de resposta não leva `medicao` se for callback.

### `apps/web/src/dados/store.ts` (store, otimista)

**Analog:** o próprio arquivo.

**`enviar` atual** (linhas 123-195): `switch (resposta.tipo)` com `"diferenca" | "estado" | "conflito" | "falha"`; `finally { set((e) => ({ pendentes: e.pendentes - 1 })) }`. Pontos a mudar:
- `aplicarDiferenca(get().data, get().ordens, resposta.diferenca)` (linha 143) passa a aplicar em `confirmado`, e `data` = replay das pendentes restantes sobre cópia de `confirmado`.
- `await get().rehidratar()` (linhas 134, 177): tirar a pendente antes, `confirmado = r.data`, `data` = replay do resto.
- `case "estado"` (linhas 164-172): `data` e `confirmado` recebem `resposta.estado.data`.
- `catch` (linhas 188-193) e `case "falha"`: mesma mensagem e canal `lastResult` (D-14).

**`rodarNaCopia`** (linhas 202-229): o `structuredClone(data)` + `syncIdSequence(copia, get().sequenciaDoServidor)` + `gravarChamadas(() => operation(copia, session.memberId))` já existe; hoje descarta `copia` após aceitar. Passa a `set({ data: copia })` (exceto operações em `operacoes-que-esperam` e `chamadas.length === 0`), e a pendente guarda `{ chamadas, resolver, otimista }`. No replay, chamar `syncIdSequence` antes e `OPERACOES[chamada.nome](copia, memberId, ...chamada.args)`.

**Fila (D-16):** disparar `enviar` de forma síncrona se ocioso (o teste (b) existente afirma `gravarMock` chamado 1 vez logo após `run()`), encadear se ocupado.

**`runConfirmado`** (linhas ~255-259) e `verificarRevisao` (já se cala com `pendentes > 0`): sem mudança de contrato.

**`beforeunload`:** dentro de `AcompanhanteDaRevisao` (linhas ~312-330), mesmo padrão `useEffect` com `addEventListener`/`removeEventListener` no cleanup:
```typescript
useEffect(() => {
  ...
  window.addEventListener("focus", verificar);
  return () => { ...; window.removeEventListener("focus", verificar); };
}, [store]);
```
Extrair `deveAvisarAoSair(pendentes)` como função pura para testar em ambiente `node`.

**Teste:** `store.test.ts` linhas 1-60: `transporteFalso()` com `gravarMock`/`hidratarMock` (`vi.fn<Transporte["gravar"]>()`, defaults herméticos `mockResolvedValue({ tipo: "falha", ... })`), `ordensDeTodasAsColecoes`, `criarStore({ sessao, estadoInicial, transporte })`. Para o "transporte lento", `gravarMock.mockImplementation(() => new Promise(...))` com resolução manual.

### `apps/web/src/dados/transporte.ts` (cliente HTTP)

**Analog:** o próprio arquivo, `gravar` do `transporteHttp` (linhas ~154-175 do trecho lido):
```typescript
let ultima: RespostaDeGravacao = { tipo: "falha", erro: "Nenhuma chamada foi gravada." };
for (const chamada of pedido.chamadas) {
  ultima = await gravarUma(apiUrl, obterToken, chamada, pedido.revisao);
  if (ultima.tipo !== "diferenca") break;
}
return ultima;
```
Passa a acumular `respostas: RespostaDeGravacao[]` (para na primeira que não for `diferenca`) e a interface `Transporte.gravar` devolve a lista (ou um tipo `{ respostas }`). Mantém o ramo `chamadas.length === 0 -> falha`. `transporteEmMemoria().gravar` (que devolve `tipo: "estado"`) passa a devolver lista de um elemento. Atenção: `gravarUma` hoje recebe `pedido.revisao` para todas; verificar se a segunda chamada precisa da revisão devolvida pela primeira (a `revisaoAnterior` do servidor é quem decide no cliente, D-11). Ajustar `transporte.test.ts` e os `gravarMock` do `store.test.ts`.

### `features/shell/app-shell.tsx` e `linha-da-arvore.tsx` ("salvando", D-15)

**Analog:** `TreeRow` em `linha-da-arvore.tsx` (props `href?`, `archived`, `privateContainer`; renderiza `<span aria-disabled="true">` quando não há `href`; o `title` atual é do Convidado e não serve) e `TreeSpace` em `app-shell.tsx` (~linha 859: `href={inert ? undefined : \`/estrutura/espacos/${space.id}\`}`). `TreeList` (~1030) não usa `inert`; usar `const href = enderecos.lista(list)` condicionado a "não pendente". Padrão de props opcionais de `TreeRow` (linhas 20-66): acrescentar `readonly salvando?: boolean` (aria-busy + opacidade discreta, sem texto longo), igual a `archived`/`active`. "Pendente" derivado: id em `data` e fora de `confirmado` (selector no store; `confirmado` fica interno).

## Padrões compartilhados

### Estilo do repositório
Comentários e mensagens em português, com id da decisão no comentário (`D-09`, `06-13`, `CR-05`); identificadores em português. Conferir em cada arquivo tocado.

### Conflito como valor
`ResultadoTransacao` devolve `{ ok: false, conflito: true, error: "Outra alteração entrou antes desta. Tente de novo." }` (`unidade-de-trabalho.ts` 174/179) e a rota responde 409 (`operacoes.ts` 358-360). Manter exatamente essa mensagem.

### Logger com destino capturável
`observabilidade/log.ts:32` `opcoesDoLogger(env, destino?)`; padrão de teste em `observabilidade/log.test.ts:15-26`. Serve ao teste da rota e ao CLI (D-17).

### Banco só local nos testes
`testes/banco-crm.ts` (`describeComBanco`, `poolDoDono`); nunca `.env`.

### Teste sem banco com UoW falsa
`persistencia/unidade-de-trabalho-trava.test.ts:18-60`.

### CLI
`reconciliacao.cli.ts` (`carregarEnv`, `encerrar`, `SairComCodigo`, `valorDe`), sem `process.exit` direto antes de `encerrar()`.

### CONTEXT.md a atualizar
`apps/api/src/persistencia/CONTEXT.md` (seção "Os prazos do servidor e a trava esgotada (06-13)" e a linha da tabela de `unidade-de-trabalho.ts`, hoje "revisão otimista (3 tentativas)"), `apps/api/src/observabilidade/CONTEXT.md` (novo comando), `apps/api/src/rotas/CONTEXT.md` (linha de medição), `apps/web/CONTEXT.md` (parágrafo de `store.ts`). Raiz só se o "Estado atual" ficar mentindo.

## Sem analog direto

| Arquivo | Papel | Fluxo | Motivo |
|---|---|---|---|
| `apps/web/src/dados/operacoes-que-esperam.ts` | config | transform | Não há mapa "nome de operação -> motivo" no web. Usar a forma `ReadonlyMap<NomeDeOperacao, string>` da RESEARCH (seção "Lista de exceções de D-13", candidatos com arquivo:linha) e `ehNomeDeOperacao` de `@n1/dominio` no teste. |
| Mediana/pior caso por etapa | utilitário | transform | Sem estatística existente em `observabilidade/`; escrever do zero. |
| Fila serial de pedidos do store | store | event-driven | Nenhum outro store com fila; desenho na RESEARCH (Pattern 3). |

## Metadados

**Escopo da busca de analogs:** `apps/api/src/{observabilidade,persistencia,rotas,automacoes,importacao,testes}`, `apps/web/src/{dados,features/shell}`.
**Leituras diretas:** `unidade-de-trabalho.ts` (80-225), `reconciliacao.cli.ts`, `previa.cli.ts`, `banco-crm.ts`, `log.ts`/`log.test.ts`, `operacoes.ts` (296-396), `unidade-de-trabalho-trava.test.ts`, `store.ts`, `transporte.ts`, `linha-da-arvore.tsx`, `store.test.ts`.
**Limite:** a RESEARCH foi lida até a linha 335 (o resto, 336-684, não foi lido por este mapeamento; ele cobre "O 'salvando' na árvore", comando de medição, pitfalls e validação). O planejador deve lê-lo junto.
**Data de extração:** 2026-10-30
