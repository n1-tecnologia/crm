# Fase 15: Unificação do CRM, telas no modelo novo e remoção do modelo antigo - Mapa de padrões

**Mapeado:** 2026-11-05
**Arquivos analisados:** 17 grupos de arquivos novos (as 72 telas a trocar são cobertas por UM análogo, ver o item 7)
**Análogos encontrados:** 16 / 17

Os análogos desta fase são todos da Fase 14 e das Fases 7 e 8. Este mapa **não repete** o que o `14-PATTERNS.md` já traz (cabeçalho e pós-condição de migração, bloco "desliga RLS", `migracao-010.test.ts` como molde do teste de migração, `servicos/crm/conversas.ts mudarSituacao`, `rotas/crm/funis.ts` como molde de rota, `regime-dos-chamadores.test.ts`). Cite-o: `.planning/phases/14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa/14-PATTERNS.md`. Aqui vão só as peças da Fase 15 sem precedente no código antigo.

Todos os análogos abaixo foram conferidos com `git ls-files` (rastreados). Nenhum é espelho `.gsd`. Número de linha conferido nos arquivos de hoje (2026-11-05).

**Camadas.** Nenhum análogo cruza a regra (dominio <- web, dominio <- api, web e api nunca se importam). Dois pontos de atenção estão em "Violações e armadilhas de camada", no fim.

## Classificação dos arquivos

| Arquivo novo ou alterado | Camada | Papel | Fluxo | Análogo mais próximo | Qualidade |
|---|---|---|---|---|---|
| `apps/api/migracoes/012-atividade-do-crm.sql` | api | migração (DDL) | batch | `apps/api/migracoes/011-crm-o-que-faltava.sql:86-98` (`contato_notas`, só inserção) e `:133-161` (tabela sem FK + RLS) | exato |
| `apps/api/src/persistencia/migracao-012.test.ts` | api | teste de migração | batch | `apps/api/src/persistencia/migracao-011.test.ts` | exato |
| `apps/api/src/testes/banco-crm.ts` (`limparEspaco` + `"crm_atividades"`) | api | utilitário de teste | CRUD | ele mesmo, lista em `:81-94` | exato |
| `apps/api/src/repositorios/crm/atividades.ts` | api | repositório | CRUD (só inserir e listar) | `repositorios/crm/notas.ts` | exato |
| `apps/api/src/servicos/crm/atividades.ts` + `.test.ts` | api | serviço | request-response | `servicos/crm/notas.ts` e `notas.test.ts` | exato |
| `apps/api/src/rotas/crm/atividades.ts` + `.test.ts` (`GET /atividades`) | api | rota REST | request-response | `rotas/crm/notas.ts` e `notas.test.ts` | exato |
| `POST /crm/nomes` (lote), `GET /contatos?comIdentificador=`, endpoint de agregados do Início/Notificações | api | rota REST | request-response | `rotas/crm/tarefas-conversacionais.ts:91` (`POST .../resumo`, lote por POST) e `repositorios/crm/tarefas-conversacionais.ts:80-140` (`unnest` em lote) | role-match |
| `/conversas` com filtros novos (`proprietarioId`, `naoLidas`) | api | rota + repositório | CRUD | `rotas/crm/conversas.ts:40-52` (`QUERY_LISTA_DE_CONVERSAS`) e `repositorios/crm/conversas.ts:191-248` (`listar`) | exato |
| Gestos gravam Atividade (mover, atribuir, lixeira, estrela, leitura, nota, consentimento) | api | serviço | CRUD | `servicos/crm/notas.ts:60-70` (`comTransacao` + repositório no mesmo `cliente`) | exato |
| Resumo estendido (Empresa, qualificação, estado, Atribuído) | api | repositório | request-response | `repositorios/crm/tarefas-conversacionais.ts:80-140` (o próprio `resumoDasTarefas`) | exato |
| `LER_DO_CRM` generalizado + `instantiateListTemplate`, e porta para criar Contato de Participante | api + dominio | rota + operação | request-response | `apps/api/src/rotas/operacoes.ts:273-312`, `servicos/crm/gesto-misto.ts`, `persistencia/unidade-de-trabalho.ts:184-202,562,680` | exato |
| `apps/api/src/migracao-crm/*` + `migrar:crm-antigo` e `bootstrap:crm-demo` em `package.json` | api | CLI + script de dados | batch | `persistencia/migrar.cli.ts` (`--seco`), `bootstrap/gestao.cli.ts` + `gestao.ts` (CLI de dado), `package.json:10-17` | role-match |
| `sem-crm-antigo.test.ts` (dominio, api, web) | dominio, api, web | teste de fonte | batch | `packages/dominio/src/sem-listas-espelho.test.ts`, `apps/api/src/sem-listas-espelho.test.ts`, `apps/web/src/sem-listas-espelho.test.ts` | exato |
| `apps/web/src/dados/crm/{conversas,mensagens,atividades}.ts` + `.test.ts` | web | hook SWR + cliente HTTP | request-response | `dados/crm/contatos.ts`, `dados/crm/notas.ts`, `contatos.test.ts` | exato |
| Reescrita das telas do store para o modelo novo (72 arquivos) | web | componente / página | request-response | `app/(shell)/crm/contatos/[contato]/page.tsx` + `features/crm/ficha-de-contato.tsx` + `notas-do-contato.tsx` | exato (um só modelo) |
| Cartão e ficha da Tarefa conversacional com Empresa/qualificação/estado/Atribuído | web | componente | request-response | `features/estrutura/cartao-conversacional.tsx` | exato |
| Fixture/`bootstrap:crm-demo` TypeScript passando pelos serviços | api | script de dados | batch | `bootstrap/gestao.ts` + `servicos/crm/*` | role-match |

## Atribuição de padrões

### 1. `apps/api/migracoes/012-atividade-do-crm.sql` (api, migração, batch)

**Moldes:** a tabela só-inserção é `contato_notas` na 011; a tabela **sem FK** (a Atividade sobrevive à eliminação do objeto, INV-ET-12) é `crm_de_para` na 011. O cabeçalho de comentário, a idempotência e a pós-condição seguem o `14-PATTERNS.md`.

**Tabela só-inserção com `*_ck` e índice** (`011-crm-o-que-faltava.sql:86-98`):
```sql
create table if not exists plataforma.contato_notas (
  id            text        not null default gen_random_uuid()::text,
  workspace_id  text        not null,
  contato_id    text        not null,
  conteudo      text        not null,
  autor_id      text        not null,
  criado_em     timestamptz not null default now(),
  primary key (workspace_id, id),
  foreign key (workspace_id, contato_id) references plataforma.contatos (workspace_id, id) on delete cascade,
  constraint contato_notas_conteudo_ck check (length(btrim(conteudo)) > 0)
);
create index if not exists contato_notas_contato_idx
  on plataforma.contato_notas (workspace_id, contato_id, criado_em desc);
```
Para a 012: copie a forma (PK `(workspace_id, id)`, `id text default gen_random_uuid()::text`, constraints `crm_atividades_<regra>_ck`, índices por `(workspace_id, objeto_tipo, objeto_id, em desc)` e `(workspace_id, em desc)`), mas **sem** a linha `foreign key`. O rascunho de colunas está na RESEARCH, "Forma recomendada da tabela (candidata 1)" (espelha `ActivityRecord` 1:1, `ator_tipo in ('member','agent','automation','integration','system')` igual a `mensagens_ator_ck` da 008).

**"Só inserção" não é constraint, é contrato do repositório.** Na 011 nenhuma regra do banco impede `update`/`delete` em `contato_notas`; o que garante é o repositório expor só `inserir` e `listar` (ver `repositorios/crm/notas.ts:1-10`). Faça igual com `crm_atividades`. Se o planejador quiser a regra no banco, é trigger `before update or delete ... raise exception` nesta 012 (decisão nova, sem precedente; a RESEARCH não a pede).

**RLS e grants (copiar literalmente do fim da 011, `:150-161`):** o `do $$ ... disable row level security ... end $$;` e o comentário "Sem `grant`" do cabeçalho (`:36-37`). A 012 não concede nada; depois de aplicar, `npm run banco:conceder` é a rede (ver `14-PATTERNS.md`).

**Armadilha:** migração aplicada é imutável; a 011 já está em produção. A 012 só adiciona. Os nomes de coluna (`objeto_tipo`, `em`, `antes`, `depois`) são proposta da RESEARCH, não valores existentes.

---

### 2. `apps/api/src/persistencia/migracao-012.test.ts` (api, teste de migração, batch)

**Análogo:** `apps/api/src/persistencia/migracao-011.test.ts` (o molde do 010 está no `14-PATTERNS.md`; use o 011 por ser o mais recente).

**Constantes e helpers a trocar** (`migracao-011.test.ts:31-90`): `ARQUIVO_012`, `TEXTO_012`, `SQL_012` (a versão sem comentários, para provar "sem `grant`" sem casar com o cabeçalho), `ate011()`, `bancoAte011()` com nome `m012_<8>`, `WS = "ws_m012"`.
```typescript
const SQL_011 = TEXTO_011.split("\n").filter((linha) => !linha.trimStart().startsWith("--")).join("\n");
const ate010 = () =>
  readdirSync(PASTA_DE_MIGRACOES).filter((f) => f.endsWith(".sql") && f < ARQUIVO_011).sort();
```
O helper `recusa(consulta)` (`:75-82`, devolve `{ code, constraint }`) serve para provar `crm_atividades_ator_ck`, `_resultado_ck`, `_delegante_ck`. Use `describeComBanco` e `afterAll(encerrar)`, nunca `describe` puro (D-15-07, o banco do `.env` é produção).

**Casos mínimos a copiar da estrutura da 011:** (a) cada `*_ck` recusa o valor ruim; (b) rodar a 012 duas vezes não muda nada (idempotência); (c) sem `grant` no `SQL_012`; (d) nenhuma linha de `plataforma.registros` muda; (e) a tabela não tem FK para o objeto (apagar o Contato não apaga a Atividade, o oposto de `contato_notas`, que some por cascata).

---

### 3. Repositório, serviço e rota de Atividade (api, CRUD de só-inserção)

**Análogo:** a pilha completa de Notas do Contato, 1:1.

**Repositório** (`repositorios/crm/notas.ts:15-80`): interface `RepositorioDeX { inserir; listar }`, `criarRepositorioDeXPg(cliente: Pool | PoolClient)`, `COLUNAS` em constante, `LinhaDoBanco` snake_case, `linhaParaX` fazendo `Date -> toISOString()`, **todo `WHERE` leva `workspace_id = $1`**, ordenação fixa, valores sempre `$n`.
```typescript
async inserir(workspaceId, contatoId, conteudo, autorId) {
  const resultado = await cliente.query<LinhaDoBanco>(
    `insert into plataforma.contato_notas (workspace_id, contato_id, conteudo, autor_id)
     values ($1, $2, $3, $4)
     returning ${COLUNAS}`,
    [workspaceId, contatoId, conteudo, autorId],
  );
  const inserida = resultado.rows[0];
  if (!inserida) throw new Error("O INSERT de Nota do Contato não devolveu a linha.");
  return linhaParaNota(inserida);
},
```
Para a Atividade devolva `ActivityRecord` (`packages/dominio/src/types/primitives.ts:267-286`), que a web já consome, não um tipo novo. O repositório tem `registrarAtividade(cliente, workspaceId, entrada)` com o **mesmo `cliente`** do gesto.

**Serviço** (`servicos/crm/notas.ts:42-70`): a ordem é fixa e vale copiar. Primeiro `exigir(deps.acesso, membro, "ler"|"editar", recurso)`, depois validar, depois `comTransacao(deps.pool, async (cliente) => ...)`. Retorno `ResultadoCrm<T>` via `sucesso(...)` e `recusa(status, frase, { codigo })`, nunca exceção.
```typescript
const negado = await exigir(deps.acesso, membro, "editar", "contato");
if (negado) return { ok: false, ...negado };
...
return comTransacao(deps.pool, async (cliente: PoolClient) => {
  const contato = await criarRepositorioDeContatosPg(cliente).obter(membro.workspaceId, contatoId, { travar: true });
  if (!contato) return contatoNaoEncontrado();
  ...
```
O Espaço e o autor saem **sempre** de `membro` (a sessão), nunca do corpo (T-14-13). Para os gestos de 15-05 (mover, atribuir, lixeira, restaurar, estrela, leitura, nota, transferir, consentimento): chame `registrarAtividade(cliente, ...)` dentro do `comTransacao` do serviço que já existe, logo depois da escrita. Estrela e leitura só gravam quando o valor muda (Pitfall 5 da RESEARCH).

**Rota** (`rotas/crm/notas.ts:26-52`): um `*_STRICT` zod por rota, `app.withTypeProvider<ZodTypeProvider>()`, `PARAMS_ID`, `responder` e `responderLista` de `./comum`, `LIMITES_CRM.paginaMaxima`.
```typescript
const QUERY_DE_NOTAS = z
  .object({
    limite: z.coerce.number().int().min(1).max(LIMITES_CRM.paginaMaxima).default(LIMITES_CRM.paginaPadrao),
    deslocamento: z.coerce.number().int().min(0).default(0),
  })
  .strict();
```
Para `GET /atividades?objetoTipo=&objetoId=&limite=&ate=` mantenha `.strict()`, `objetoTipo` como `z.enum`, cursor por tempo (`ate`) em vez de `deslocamento` para a Auditoria sem objeto.

**Registro** (`rotas/crm/index.ts:57-103`): três linhas por recurso novo. (1) import do `criarServicoDeX` e do `rotasDeX`; (2) campo `readonly x?: ServicoDeX` em `OpcoesDeCrm` com o comentário "Injeção só para teste"; (3) `const x = opcoes.x ?? criarServicoDeX({ pool: obterPool, acesso }); await app.register(rotasDeX, { servico: x });`. O hook `recusarSuspensoNaEscrita` (`:90`) herda sozinho.

**Teste de rota, sem banco** (`rotas/crm/notas.test.ts:15-60`): `buildApp({ ...opcoesDeAutenticacao("ws_falso"), crm: { notas: servico } })`, serviço falso que registra `chamadas`, `it.each` de 400 (limite acima do teto, limite zero, deslocamento negativo, parâmetro que o recurso não tem) provando "não chega ao serviço", e o 401 sem `Authorization`.

**Teste de serviço e vazamento entre Espaços (T-14-14)** (`servicos/crm/notas.test.ts:30-70,120`): `describeComBanco`, dois Espaços (`novoEspacoDeTeste("svcnotas")` e `"svcnotasb"`), `semearMembro` nos dois, `afterAll` com `limparEspaco` de ambos e `encerrar()`, e o caso "(f) objeto de outro Espaço é 404".

> `testes/espaco-de-vazamento.ts` **não é o molde** para as rotas do CRM novo. Ele monta o vazamento de `GET /estado` entre dois **Membros** do mesmo Espaço (Sessão de Chat, pasta, Execução) com `buildApp` + `semear` de um `DataState`, e é parte da Fase 9. O teste de vazamento **entre Espaços** das rotas do CRM é o caso `(f)` de `servicos/crm/notas.test.ts`: dois `workspaceId`, um recurso semeado no outro, 404 na leitura e na escrita. Copie esse. Só use `espaco-de-vazamento.ts` se o planejador quiser provar que `GET /estado` deixou de carregar o CRM.

---

### 4. `POST /crm/nomes`, `GET /contatos?comIdentificador=`, agregados do Início/Notificações, filtros de `/conversas` (api)

**Lote por POST e SQL em lote com `unnest`:** análogo `rotas/crm/tarefas-conversacionais.ts:91` e `repositorios/crm/tarefas-conversacionais.ts:80-140`. O lote vai em POST porque "os Vínculos (até 200 trios de ids) não cabem numa query" (`:19`). Copie: `RESUMO_MAXIMO` (200) como teto no esquema zod e o `unnest($2::text[], $3::text[], ...) with ordinality as e(...)` com `order by e.ordem` para devolver na ordem pedida; lista vazia não consulta o banco.
```typescript
rotas.post("/tarefas-conversacionais/resumo", { schema: { body: RESUMO_DE_TAREFAS } }, async (request, reply) => {
  const resultado = await servico.resumo(request.membro, request.body.vinculos);
```
```sql
from unnest($2::text[], $3::text[], $4::text[], $5::text[])
       with ordinality as e(task_id, contato_id, conversa_id, negocio_id, ordem)
left join plataforma.contatos c on c.workspace_id = $1 and c.id = e.contato_id
```
`POST /crm/nomes` é isso aplicado a `{ contatos: [], empresas: [], negocios: [], canais: [] }` com um teto por lista. **Estenda o resumo** (D-15-05) nesse mesmo SQL: um `left join plataforma.empresas`, `ef.qualificacao`, `cv.situacao`/`cv.estado`, `cv.atribuido_id`; os WR-05 (`and ef.estado <> 'na_lixeira'`, `and cv.estado = 'ativo'`) entram nos mesmos `join` (o `14-PATTERNS` e a RESEARCH, D-15-07, dão o texto).

**Filtros novos de `GET /conversas`:** acrescente em `QUERY_LISTA_DE_CONVERSAS` (`rotas/crm/conversas.ts:40-52`) e em `listar` (`repositorios/crm/conversas.ts:191-205`). O padrão do filtro é este e nenhum valor do cliente entra no SQL:
```typescript
const somar = (fragmento: (n: number) => string, valor: unknown) => {
  valores.push(valor);
  condicoes.push(fragmento(valores.length));
};
if (filtro.atribuidoId !== undefined) somar((n) => `c.atribuido_id = $${n}`, filtro.atribuidoId);
if (filtro.comEstrela !== undefined) somar((n) => `coalesce(mc.estrela, false) = $${n}`, filtro.comEstrela);
```
`naoLidas` já existe como **coluna** do resultado (`nao_lidas`, subselect em `:228-231`); virar filtro exige `HAVING`/subselect no `where`, sem análogo exato. `comEstrela` mostra como entra o booleano de query (`z.enum(["true","false"]).transform(...)`, `:46`). A lista de Conversas por Membro usa `$3` = `membroId` para o `left join conversa_marcacoes`; não reutilize `$3` para outro valor.

**Agregado do Início/Notificações:** sem análogo (ver "Sem análogo"). O que copiar é o regime: um `GET` com `.strict()` zod, serviço com `exigir(...)`, várias `select count(*)::int` em **uma** consulta e um objeto fechado como resposta (modelo: `contarDoMembro` em `repositorios/crm/sucessao.ts:35-50`, um `select (select count(*) ...)::text as x, (select ...)` e `Number(...)`). Não some listas paginadas no navegador: `paginaMaxima` é 200 (Pitfall 4 da RESEARCH).

---

### 5. `LER_DO_CRM` generalizado, `instantiateListTemplate` e a porta para criar Contato (api + dominio, gesto misto)

**Análogos:** `apps/api/src/rotas/operacoes.ts:273-312` (`AO_CONFIRMAR`, `LER_DO_CRM`, `comLidoDoCrm`), `servicos/crm/gesto-misto.ts:60-118`, `persistencia/unidade-de-trabalho.ts:184-202,558-562,680`.

**Forma de hoje** (`operacoes.ts:297-312`):
```typescript
const LER_DO_CRM: Partial<
  Record<NomeDeOperacao, { readonly posicao: number; readonly ler: (cliente: PoolClient, workspaceId: string) => Promise<readonly Canal[]> }>
> = {
  definirCanaisDaLista: { posicao: 2, ler: (cliente, workspaceId) => criarRepositorioDeCanaisPg(cliente).todos(workspaceId) },
  createList: { posicao: 1, ler: (cliente, workspaceId) => criarRepositorioDeCanaisPg(cliente).todos(workspaceId) },
};

function comLidoDoCrm(args: readonly unknown[], posicao: number, lido: unknown): unknown[] {
  const copia = args.slice(0, posicao);
  while (copia.length < posicao) copia.push(undefined);
  return [...copia, lido];
}
```
O que o navegador mandou naquela `posicao` é **descartado** e sobrescrito com o que o servidor leu (Pitfall 12 / T-14-29). Mantenha isso ao generalizar.

**Generalização (UCR-01, uma vez):** troque o tipo de retorno de `ler` de `Promise<readonly Canal[]>` por um objeto (`{ canais?, contatos?, empresas? }`) e mantenha `posicao`. Para `instantiateListTemplate` a posição é `2` (os `args` são `[templateId, input, canais]`; o esquema ganha `opcional(CANAIS_DO_NAVEGADOR)` como em `rotas/esquemas/estrutura.ts:106`). A leitura roda em `lerDoCrm` do `executar()` (`unidade-de-trabalho.ts:202`: `(cliente, state) => Promise<L>`) e chega à operação como o 1º argumento do callback, `lidoDoCrm` (`operacoes.ts:408`).

**`aoConfirmar` hoje não recebe o que `lerDoCrm` leu** pelo chamador de `operacoes.ts`: o fechamento passa `(cliente, args, request.membro, state)` e ignora o 4º argumento de `executar()` (`unidade-de-trabalho.ts:184` define `aoConfirmar(cliente, valor, state, lido)`). Para a porta de criar Contato de Participante (Ferramentas, `resolverOuCriarContato`) o `aoConfirmar` precisa ver os ids pré-gerados, então:
1. `lerDoCrm` acha os Contatos por Identificador `whatsapp` e **gera o id** (`randomUUID`) dos que faltam, devolvendo `{ existentes, aCriar: [{ id, ... }] }`;
2. a operação pura usa esses ids (sem inserir);
3. o `aoConfirmar` do `AO_CONFIRMAR[nome]` passa a receber `lido` (4º parâmetro) e faz o `insert into plataforma.contatos` das linhas `aCriar` com `modo_criacao = 'automatico_automacao'` (os valores aceitos por `contatos_modo_criacao_ck` estão na RESEARCH, "Mapeamento").

**Ordem de trava (não inverta):** o gesto trava o **Espaço primeiro**; qualquer `for update` do CRM vem depois, e em ordem de id (`gesto-misto.ts:7-12`; `persistencia/CONTEXT.md`, "A ordem das travas"). É o motivo do WR-02.

**Recusa é valor, não exceção** (`gesto-misto.ts:40-46`): uma exceção destrói a conexão do pool. `traduzirErroDePg` mapeia `23505/23503/23514` para 409 com frase fixa, **sem o nome do constraint** (T-07-06); a RESEARCH acrescenta `40P01 -> 409` transitório em `comTransacao` (`servicos/crm/transacao.ts:23`).

**Imutáveis de contrato:** quem usa `executarGestoMisto` já tem o padrão pronto (`lerDoCrm` devolve `ResultadoCrm<L>`; `operacao(state, lido)`; `gravarNoCrm(cliente, valor, lido)`). Para o **script de dados**, a RESEARCH propõe usar `executar()` direto (não `executarGestoMisto`), no regime `travado` padrão: `regime-dos-chamadores.test.ts` só admite `otimista` nas quatro importações longas, então **não passe `regime`**.

---

### 6. `apps/api/src/migracao-crm/*` e os scripts `migrar:crm-antigo` e `bootstrap:crm-demo` (api, CLI de dado, batch)

**Análogos:** forma do CLI e do `--seco` em `persistencia/migrar.cli.ts`; CLI que escreve dado de produção em `bootstrap/gestao.cli.ts` + `bootstrap/gestao.ts`; registro em `package.json`. A pasta `importacao/` **não serve**: o `CONTEXT.md` dela diz "Nenhuma rota HTTP, nenhuma regra de negócio, nenhum SQL" (a RESEARCH já decide por `apps/api/src/migracao-crm/`).

**`--seco` que não escreve** (`migrar.cli.ts:11-25`): lê, imprime `aplicada`/`pendente` e termina com "nada foi aplicado (--seco)". Imprima só ids e contagens.
```typescript
if (process.argv.includes("--seco")) {
  const { aplicadas, pendentes } = await migracoesPendentes();
  ...
  console.log(`${pendentes.length} pendente(s); nada foi aplicado (--seco).`);
} else {
  const aplicadas = await migrar();
  ...
}
await encerrar();
```
Para o relatório do `migrar:crm-antigo --seco`, o desenho da RESEARCH (seção "Code Examples", `begin read only` + `hidratar` + `rollback`) é o que estende isto; o `14-ENSAIO.md` provou o `default_transaction_read_only = on`.

**CLI de dado** (`bootstrap/gestao.cli.ts:9-30`): `carregarEnv()`, `workspaceId` por argumento/ambiente, `pool().connect()` com `try/finally { cliente.release() }`, mensagens `criado`/`pulado` sem segredo, `await encerrar()` no fim. Adapte:
```typescript
carregarEnv();
const cliente = await pool().connect();
let resultado;
try {
  resultado = await bootstrapGestao(cliente, { workspaceId });
} finally {
  cliente.release();
}
...
await encerrar();
```
**Divergência do molde:** `bootstrapGestao` abre `begin/commit` à mão (`gestao.ts:41-51`) e recusa em Espaço não vazio. O script `migrar:crm-antigo` **não** deve copiar essa transação à mão: use `executar()` (trava do Espaço, `revisao + 1`, `begin` com prazos, `rollback`), senão um navegador aberto no `ws_n1` grava por cima. A guarda de pré-condição ("o Espaço já tem N registros, pulo") do `gestao.ts:26-37` serve de modelo para `--espaco` obrigatório e validado contra `^ws_[a-z0-9_]+$` e contra `plataforma.workspaces`.

**Entrada em `apps/api/package.json`** (modelo: linhas 10-17, todas `vite-node src/.../<nome>.cli.ts`):
```json
"migrar": "vite-node src/persistencia/migrar.cli.ts",
"bootstrap:gestao": "vite-node src/bootstrap/gestao.cli.ts",
```
Novas linhas: `"migrar:crm-antigo": "vite-node src/migracao-crm/migrar.cli.ts"` e `"bootstrap:crm-demo": "vite-node src/migracao-crm/demo.cli.ts"` (ou em `bootstrap/`). Os nomes de arquivo são proposta.

**Tipos locais, não do domínio.** O script não pode importar `Contact`, `Deal`, etc. de `@n1/dominio` depois que a 3.5.4 os apagar. A RESEARCH manda um `formatos-antigos.ts` estrutural na própria pasta e um fixture JSON congelado do `buildSeed()` de antes da 3.5.3 (Pitfall 1). Não há análogo no código; o precedente de "dados congelados num teste" é `apps/api/src/testes/fixtures-da-ponte.ts`.

**Tabelas de destino do script** (já criadas pela 011, não repetir DDL): `plataforma.registros_crm_antigo (workspace_id, colecao, id, dados jsonb, ordem, copiado_em)` e `plataforma.crm_de_para (workspace_id, colecao_antiga, id_antigo, tabela_nova, id_novo, migrado_em)`, `011-crm-o-que-faltava.sql:133-148`. A cópia é `insert ... select ... from plataforma.registros ... on conflict do nothing` e `count(origem) = count(cópia)` antes de apagar.

**Teste do script** com `describeComBanco`, `novoEspacoDeTeste`, `limparEspaco` (que já limpa `crm_de_para` e `registros_crm_antigo`), contra o fixture congelado. Teste de pureza: o mapeador (função pura) roda sem banco.

---

### 7. As telas reescritas (web, CRUD por HTTP) — UM análogo canônico

**Escolha:** a ficha de Contato já migrada. Três arquivos compõem o molde.

**a) A página (Server/Client boundary do Next 16)** — `apps/web/src/app/(shell)/crm/contatos/[contato]/page.tsx:1-70`:
```typescript
"use client";
import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ErroDeApi } from "@/dados/crm/cliente-crm";
import { useContato } from "@/dados/crm/contatos";
import { CorpoDeTela, EmptyState, EsqueletoDeLinhas, PageHeader } from "@/features/shell/ui";

export default function ContatoPage({ params }: { params: Promise<{ contato: string }> }) {
  const { contato } = use(params);
  const { data, error } = useContato(contato);
  ...
  if (error instanceof ErroDeApi && error.status === 404) { /* EmptyState "Contato não encontrado." */ }
  if (data) return <FichaDeContato contatoId={contato} detalhado={data} />;
  if (error) { /* EmptyState com "Não foi possível abrir ..." */ }
  return <EsqueletoDeLinhas ... />;  // carregando
}
```
**O que a Fase 15 remove deste molde:** a linha `const noModeloAntigo = useData((estado) => estado.contacts.some(...))` e o ramo `if (noModeloAntigo) return <FichaDeContatoLegado .../>` (3.4.4: tirar o recuo; o 404 passa a ser "não encontrado"). Os quatro estados (404, carregando, dado, erro) e `use(params)` ficam.

**Next 16.** `params` é `Promise` e a página client o lê com `use(params)`. A pasta de docs do Next **não está em `apps/web/node_modules/next/dist/docs/`** (não existe); está na raiz: `/Users/igorvboas/Library/Developer/TRIA/CRM/crm-n1/node_modules/next/dist/docs/` (`01-app`, `02-pages`, `03-architecture`, `04-community`). Mande o executor ler ali o guia de rotas e de `params` antes de tocar qualquer `page.tsx`. A fase não deve introduzir API nova do Next: só remover páginas (`crm/meus-negocios/**`) e reescrever client components.

**b) A seção de ficha com leitura + gravação por HTTP** — `apps/web/src/features/crm/notas-do-contato.tsx:1-55`: lê por `useNotasDoContato`, grava por `adicionarNotaAoContato`, **pré-valida com a MESMA função do domínio que a api aplica** (`validarNovaNota`), mostra a recusa da api (`MensagemDeRecusa`, `comoErroDeApi`), nome do Membro por `useNomeDoMembro`, formatação por `useFormat()`, e `motivo` só desliga o botão (quem barra é o backend). Texto da api é renderizado como texto React.

**c) O cartão da Tarefa conversacional** — `apps/web/src/features/estrutura/cartao-conversacional.tsx` é o análogo da D-15-05 (Empresa, qualificação, estado, Atribuído). Leia o `resumo` em lote (`POST /tarefas-conversacionais/resumo`) por `dados/crm/tarefas-conversacionais.ts`, não do store. Atenção ao conflito de posse da RESEARCH: `tarefa-completa.tsx` é do UCR-04 primeiro, do 3.4.2 depois.

**Regra de troca por tela (valha para as 72):** trocar `useData(s => s.contacts...)` por `useContato`/`useContatos`/`useConversas` etc.; trocar operação do store (`toggleConversationStar`, `assignConversation`, `trashConversation`, `moveConversationToContact`) pela função do hook HTTP (`gravar(...)` com `invalidarCrm(prefixo)`), nunca por `executar` do store. A página nunca chama `api` por import (a web não importa o workspace da api); o contrato é o JSON e os tipos de `@n1/dominio/crm/*`.

---

### 8. `apps/web/src/dados/crm/{conversas,mensagens,atividades}.ts` e testes (web, SWR + cliente HTTP)

**Análogos:** `dados/crm/contatos.ts` (lista com filtro e mutações) e `dados/crm/notas.ts` (sub-recurso, a leitura e uma mutação). Já existem `conversas`-relacionados? **Não:** `ls dados/crm` não tem `conversas.ts` nem `mensagens.ts`; é isso que 15-06 cria.

**Imports e cabeçalho** (`contatos.ts:1-30`): `"use client"`, comentário "lidos e gravados só por HTTP (D-04)", `import useSWR from "swr"`, `LIMITES_CRM` e tipos de `@n1/dominio/crm/*`, `chamarCrm, ErroDeApi, invalidarCrm` de `./cliente-crm`.

**Chave de SWR estável e compartilhada com a invalidação** (`contatos.ts:41-50`): a mesma função monta a chave para a lista e para `invalidarCrm`. Todas as chaves começam pelo prefixo do recurso (`/conversas`, `/mensagens`) para uma invalidação alcançar lista e ficha.
```typescript
export function chaveDeContatos(filtro: FiltroDeContatos): string {
  const parametros = new URLSearchParams();
  parametros.set("estado", filtro.estado ?? "ativo");
  ...
  parametros.set("limite", String(filtro.limite ?? LIMITES_CRM.paginaPadrao));
  parametros.set("deslocamento", String(filtro.deslocamento ?? 0));
  return `/contatos?${parametros.toString()}`;
}

export function useContatos(filtro: FiltroDeContatos) {
  const chave = chaveDeContatos(filtro);
  return useSWR<RespostaDaListaDeContatos, Error>(chave, (k: string) => chamarCrm<RespostaDaListaDeContatos>(k), {
    keepPreviousData: true,
  });
}
```
**Repetição só em rede e 5xx** (`contatos.ts:62-65`; igual em `notas.ts:30-33`): `valeRepetir(erro)` e `shouldRetryOnError: valeRepetir`. Copie a função (cada arquivo tem a sua).

**Mutação com invalidação só no sucesso** (`contatos.ts:75-85` e `notas.ts:46-52`): `chamarCrm(...)` primeiro, `await invalidarCrm(<prefixo>)` depois, retornar `resposta.dados`. Numa recusa, a `ErroDeApi` sobe com `codigo`, `campo`, `bloqueios` e **nada** é invalidado.

**Envelope** (`cliente-crm.ts:1-18`): item `{ ok: true, dados }`, lista `{ ok: true, itens, total }`, erro `{ ok: false, error, codigo?, campo?, bloqueios? }`.

**`atividades.ts`** tem uma diferença de fusão: `useAtividades({ tipo, id })` concatena `state.activity.filter((a) => a.objectId === id)` (já hidratado, via `useData`) com a resposta de `GET /atividades`, e ordena por `at` decrescente (RESEARCH, "Como a linha do tempo junta as duas fontes"). Ids não colidem (`act_...` contra UUID). `estrela`/`leitura`: `PUT /conversas/:id/marcacao` é chamado ao abrir a Conversa, então a mutação de leitura **não** deve invalidar a lista inteira a cada abertura.

**Cache SWR não vê a revisão do Espaço** (Pitfall 6): quem grava no CRM e em `registros` (gesto misto) chama `rehidratar()` além de `invalidarCrm`.

**Teste** (`contatos.test.ts:1-50`): `// @vitest-environment jsdom`; `vi.hoisted` + `vi.mock("@/autenticacao/cliente-navegador", ...)` para a sessão; `vi.mock("./cliente-crm", ...)` mantendo `chamarCrm`/`ErroDeApi` reais e espiando só `invalidarCrm`; `fetch` falso; `StoreProvider` de verdade com o `buildSeed()`; `renderHook` + `waitFor`. Prove: rota/verbo certos, `invalidarCrm` só no sucesso, `usePodeNoCrm` esconde o que o Papel não alcança com a MESMA função do domínio (D-14).
```typescript
vi.mock("./cliente-crm", async (original) => {
  const real = await original<typeof import("./cliente-crm")>();
  return { ...real, invalidarCrm: vi.fn(async () => undefined) };
});
```

---

### 9. `sem-crm-antigo.test.ts` nas três camadas (teste de fonte, batch)

**Análogos:** `packages/dominio/src/sem-listas-espelho.test.ts`, `apps/api/src/sem-listas-espelho.test.ts` e `apps/web/src/sem-listas-espelho.test.ts`. As três têm a mesma estrutura; copie uma por camada, na raiz de `src` de cada uma.

**Estrutura** (`packages/dominio/src/sem-listas-espelho.test.ts:21-60`): `CONGELADOS` (lista de arquivos), um regex, `arquivosDeProducao(pasta)` recursivo (exclui `*.test.ts`; na web `ehDeProducao` aceita `.tsx` também), `RAIZ = fileURLToPath(new URL(".", import.meta.url))`, e **dois** testes:
1. "o teste não passa por não ver nada": `producao.length > 50` e contém um arquivo-sentinela conhecido;
2. "só a lista congelada cita": `novos` (citam e não estão em `CONGELADOS`) deve ser `[]` **e** `sumidos` (estão em `CONGELADOS` e não citam mais) deve ser `[]`. A segunda metade é o que faz a lista **só encolher**; cada plano de tela tira os seus arquivos.
```typescript
const citam = producao.filter((f) => CITA_AS_LISTAS_ESPELHO.test(f.texto)).map((f) => f.arquivo).sort();
const novos = citam.filter((arquivo) => !(CONGELADOS as readonly string[]).includes(arquivo));
const sumidos = CONGELADOS.filter((arquivo) => !citam.includes(arquivo));
expect(novos, `... Arquivo(s) novo(s) que as citam: ${novos.join(", ")}`).toEqual([]);
expect(sumidos, `A lista congelada está desatualizada: ${sumidos.join(", ")} ...`).toEqual([]);
```
**Regex da fase** (RESEARCH, "Code Examples"): `/\b(state|data|estado)\.(contacts|companies|deals|funnels|channels|contactCompanyLinks|companyCompanyLinks|distinctFromLinks)\b/`. Cuidado: `state.conversations` **não entra** no regex (Grupo e Flow o usam, D-05) e o texto inteiro conta, comentário inclusive (o regex acima acusa citação em comentário; reescreva o comentário, não o regex).

**Atenção:** as três guardas de D-06 **continuam**; a Fase 15 não as apaga. Quando a 3.5.4 remove `iniciar-conversa`, `CONGELADOS` de D-06 esvazia e o `expect(producao.map(...)).toContain("operations/iniciar-conversa.ts")` do teste "achou os arquivos" **quebra**: troque o arquivo-sentinela por outro que exista, na mesma edição.

---

## Padrões compartilhados

### Todo `WHERE` leva o Espaço da sessão
**Fonte:** `repositorios/crm/notas.ts:1-10,52-79`; vale para repositórios novos (Atividade, agregados, `/crm/nomes`).
O Espaço vem do serviço, que o tira da sessão (`membro.workspaceId`); nenhum repositório o deduz de outro lugar; valores só como `$n`; SQL e ordenação constantes.

### Permissão antes de validar, validar antes de ler
**Fonte:** `servicos/crm/notas.ts:42-70`. `exigir(deps.acesso, membro, "ler"|"editar", recurso)` primeiro (um Convidado nunca descobre se o corpo era válido); depois a validação pura do domínio (`validarNovaNota`); depois `comTransacao` com `obter(..., { travar: true })`.

### Recusa é valor, não exceção
**Fonte:** `servicos/crm/resultado.ts` (`recusa`, `sucesso`, `ResultadoCrm`) e `servicos/crm/gesto-misto.ts:40-46`. Exceção destrói a conexão do pool. Erro de regra nunca viaja em 200: 400/403/404/409 no envelope de `rotas/crm/comum.ts`.

### Teste de banco só em Postgres local
**Fonte:** `apps/api/src/testes/banco-crm.ts:37-40` (`temBancoCrm = hostEhLocal(process.env.DATABASE_URL)`, `describeComBanco`). **Todo teste novo da fase usa `describeComBanco`** (D-15-07); `describe` puro com `carregarEnv()` abre o banco do `.env`, que é produção. Novos Espaços via `novoEspacoDeTeste(rotulo)`, limpeza em `afterAll` com `limparEspaco` e `encerrar()`.

### `limparEspaco` e tabelas novas
**Fonte:** `testes/banco-crm.ts:81-94`. Tabela do CRM **sem FK** entra na lista fixa (como `crm_de_para`); a com FK em cascata sai com o pai (como `contato_notas`). `crm_atividades` não tem FK: acrescente `"crm_atividades"` à lista.

### Não logar dado pessoal
**Fonte:** `servicos/crm/notas.ts:12-14` ("O `conteudo` da nota é dado pessoal e nunca é logado", T-14-15). Vale para o relatório do `--seco`: só ids e contagens, nunca nome, telefone, e-mail ou texto de Mensagem.

---

## Sem análogo

| Arquivo | Papel | Fluxo | Motivo |
|---|---|---|---|
| Endpoint de agregados do Início/Notificações | rota REST | request-response | Nenhuma rota de `rotas/crm/` devolve contagens agregadas de vários recursos. Use `contarDoMembro` (`repositorios/crm/sucessao.ts:35-50`) como molde de SQL e o desenho de rota de `notas.ts`; o planejador decide a forma da resposta (RESEARCH, Pitfall 4). |
| Filtro `naoLidas` de `GET /conversas` | repositório | CRUD | Hoje `nao_lidas` é só coluna calculada (`repositorios/crm/conversas.ts:228-231`); virar filtro exige subselect no `where` sem precedente. |
| Constraint/trigger "só inserção" no banco | migração | batch | Nem `contato_notas` nem `contato_consentimentos` o impõem; é regra do repositório. Se a 012 quiser trigger, é decisão nova. |
| Mapeador antigo -> novo (puro) e relatório de não migrados | domínio puro + api | transform | Nenhum mapeador de formato antigo para tabelas existe; o desenho está só na RESEARCH (ordem de FKs, constraints, `crm_de_para`). O teste "função pura sem banco" segue os testes de `packages/dominio/src/crm/*.test.ts`. |

## Violações e armadilhas de camada

1. **`apps/web/src/dados/crm/contatos.ts` e `notas.ts` NÃO importam `apps/api`**, e é isso que os mantém válidos como analogia. Os tipos vêm de `@n1/dominio/crm/*`. Para os hooks novos, **toda forma de resposta** (`ConversaNaLista`, `ResumoDaTarefaConversacional`, `ActivityRecord`) precisa estar no domínio (`@n1/dominio/crm/...`), não em `apps/api/src/repositorios/...`. Hoje `ConversaNaLista` e `Pagina` já vêm do domínio? Conferir antes de copiar (`import type { Pagina } from "@n1/dominio/crm/comum"` está em `repositorios/crm/notas.ts:12`; `ConversaNaLista` é importado em `repositorios/crm/conversas.ts:53` de algum módulo: se for do próprio repositório, mova o tipo para o domínio no mesmo plano).
2. **Os CLIs em `apps/api/src/bootstrap/*` importam `@n1/dominio/bootstrap-gestao`, `@n1/dominio/seed`**: correto (api -> dominio). Mas o `bootstrap:crm-demo`, se gerado "a partir do seed antigo" (15-18), não pode depender de `Contact` etc. depois da 3.5.4; use o fixture JSON congelado + `formatos-antigos.ts` local, nunca o tipo do domínio que será apagado.
3. **`testes/espaco-de-vazamento.ts` importa `buildSeed` e `setTaskFieldValue`** do domínio: aceitável para teste; é só um aviso de que ele depende do CRM antigo do seed. Quando 15-18 tirar o CRM do seed, os ~25 testes que o usam precisam ser reescritos; não use esse arquivo como molde de teste novo.

## Metadados

**Escopo de busca dos análogos:** `apps/api/{migracoes,src/persistencia,src/rotas,src/servicos/crm,src/repositorios/crm,src/testes,src/bootstrap}`, `apps/web/src/{dados/crm,features/crm,features/estrutura,app/(shell)/crm}`, `packages/dominio/src`.
**Arquivos lidos:** 15-CONTEXT.md, 15-RESEARCH.md (parcial), 14-PATTERNS.md (parcial), 011-crm-o-que-faltava.sql, migracao-011.test.ts (parcial), repositorios/crm/{notas,conversas (parcial),tarefas-conversacionais (parcial),sucessao (parcial)}.ts, servicos/crm/{notas,notas.test (parcial),gesto-misto}.ts, rotas/crm/{notas,notas.test (parcial),index,conversas (parcial)}.ts, rotas/operacoes.ts (parcial), persistencia/migrar.cli.ts, bootstrap/gestao.{cli,}.ts, testes/{banco-crm,espaco-de-vazamento}.ts (parcial), dados/crm/{contatos,notas,cliente-crm,contatos.test}.ts (parcial), app/(shell)/crm/contatos/[contato]/page.tsx, features/crm/notas-do-contato.tsx (parcial), três `sem-listas-espelho.test.ts`.
**Data da extração:** 2026-11-05
