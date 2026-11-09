# Phase 16: Base da mensageria - Pattern Map

**Mapped:** 2026-11-09
**Files analyzed:** 42 (novos e modificados)
**Analogs found:** 38 / 42 (4 sem analogo: ver o fim)

Todos os analogos abaixo foram conferidos como rastreados pelo git (`apps/`, `packages/`; nenhum espelho `.gsd`). Linhas citadas sao as de hoje (2026-11-09).

## File Classification

| Arquivo novo/modificado | Papel | Fluxo | Analogo mais proximo | Qualidade |
|---|---|---|---|---|
| `apps/api/migracoes/013-mensageria.sql` | migration | batch | `apps/api/migracoes/012-atividade-do-crm.sql` | exact |
| `apps/api/src/persistencia/migracao-013.test.ts` | test | batch | `apps/api/src/persistencia/migracao-012.test.ts` | exact |
| `packages/dominio/src/crm/recebimento.ts` (+ `.test.ts`) | domain util | transform | `packages/dominio/src/crm/mensagens.ts` (`statusInicialDeEnvio`, `validarEnvio`) | role-match |
| `packages/dominio/src/crm/midia.ts` (+ `.test.ts`) | domain util | transform | `packages/dominio/src/crm/capacidades.ts` | role-match |
| `packages/dominio/src/crm/mensagens.ts` (mod) | domain | transform | si mesmo (`AnexoDaMensagem` :61, `statusInicialDeEnvio` :192) | exact |
| `packages/dominio/src/crm/canais.ts` (mod) | domain | transform | si mesmo (`AcaoDeConexao` :129, `proximaConexao` :131) | exact |
| `apps/api/src/mensageria/provedor.ts` | interface | request-response | `rotas/webhook-meta.ts` (`CanalDeWebhook` :53) + `servicos/crm/mensagens.ts` (deps injetadas) | partial |
| `apps/api/src/mensageria/registro.ts` | service | request-response | `servicos/cofre.ts` (`lerCredencial`) + `repositorios/crm/canais.ts` | partial |
| `apps/api/src/mensageria/provedor.test.ts` (contrato) | test | request-response | `apps/api/src/testes/servidor-falso.ts` + `servicos/cofre.test.ts` | partial |
| `apps/api/src/mensageria/provedores/teste.ts` | service | request-response | `testes/servidor-falso.ts` (forma) + `rotas/webhook-meta.ts` `iguais` | partial |
| `apps/api/src/mensageria/provedores/evolution/cliente.ts` (+ test) | service | request-response | `persistencia/outbox-worker.ts` `entregar` (:230-267) + `testes/servidor-falso.ts` | role-match |
| `.../evolution/traduzir.ts` (+ test, `exemplos/`) | utility | transform | `apps/api/src/importacao/` (tradutores) - sem analogo exato | partial |
| `.../evolution/provedor.ts` (+ test) | service | request-response | `provedores/teste.ts` (mesma interface) | role-match |
| `apps/api/src/mensageria/processador-de-entrada.ts` (+ test) | worker | event-driven | `persistencia/outbox-worker.ts` | exact |
| `apps/api/src/mensageria/entregador-de-saida.ts` / `entregar-mensagem.ts` (+ test) | worker | event-driven | `persistencia/outbox-worker.ts` (`entregar`, `marcar*`) | exact |
| `apps/api/src/persistencia/outbox-worker.ts` (mod: filtro de tipos, `entregador`) | worker | event-driven | si mesmo | exact |
| `apps/api/src/persistencia/outbox.ts` (mod: `EVENTOS`) | model | event-driven | si mesmo (:33-73) | exact |
| `apps/api/src/mensageria/midia.ts` (+ test) | service | file-I/O | `servicos/storage-uploads.ts` | role-match |
| `apps/api/src/mensageria/avisar.ts` | utility | pub-sub | `persistencia/outbox.ts` `gravarEventos` (mesmo cliente da tx) | role-match |
| `apps/api/src/mensageria/ouvinte-pg.ts` + `hub-de-eventos.ts` (+ tests) | service | pub-sub / streaming | `persistencia/conexao.ts` (SSL/pool) + `outbox-worker.ts` (laco e `parar`) | partial |
| `apps/api/src/servicos/crm/recebimento.ts` (+ test) | service | CRUD (transacao) | `servicos/crm/mensagens.ts` | exact |
| `apps/api/src/servicos/crm/mensagens.ts` (mod) | service | CRUD | si mesmo (`enviar` :110-170) | exact |
| `apps/api/src/servicos/crm/conversas.ts` (mod, `abrirConversaNoCliente` :524-531) | service | CRUD | `servicos/crm/mensagens.ts` `enviar` | exact |
| `apps/api/src/repositorios/crm/mensagens.ts` (mod) | repository | CRUD | si mesmo | exact |
| `apps/api/src/rotas/webhooks-de-mensageria.ts` (+ test) | route | request-response (publica) | `rotas/webhook-meta.ts` | exact |
| `apps/api/src/rotas/eventos.ts` (+ test) | route | streaming | nenhum (padrao Pattern 4 da RESEARCH) | no analog |
| `apps/api/src/rotas/crm/mensagens.ts` (mod: anexos, reenviar) | route | request-response | `rotas/crm/mensagens.ts` + `rotas/anexos-da-tarefa.ts` | exact |
| `apps/api/src/servicos/storage-uploads.ts` (mod: `TIPOS_ACEITOS_NA_MENSAGEM`, teto 16/25 MiB) | service | file-I/O | si mesmo (:53-62, :114) | exact |
| `apps/api/src/index.ts` (mod: workers, coleta de orfaos) | config | event-driven | si mesmo (:186-202) | exact |
| `apps/api/src/bootstrap/canal-ligar-evolution.cli.ts` (+ `.ts`, test) | CLI | request-response | `bootstrap/crm-demo.cli.ts` + `crm-demo.ts` | exact |
| `apps/api/src/bootstrap/canal-segredo-de-teste.cli.ts` (+ test) | CLI | CRUD | `bootstrap/crm-demo.cli.ts` | role-match |
| `apps/api/package.json` (script `canal:ligar-evolution`) | config | - | scripts `bootstrap:crm-demo` (:15) | exact |
| `apps/api/.env.example` (`EVOLUTION_URL`, `EVOLUTION_API_KEY`, `MENSAGERIA_WORKER_ATIVO`, `COLETA_DE_ORFAOS_ATIVA`) | config | - | secao do cofre existente | role-match |
| `apps/web/src/dados/tempo-real.ts` (+ test) | hook/service | streaming | `dados/store.ts` `AcompanhanteDaRevisao` (:689) + `dados/crm/cliente-crm.ts` `chamarCrm` | role-match |
| `apps/web/src/dados/store.ts` (mod: montar o acompanhante) | provider | event-driven | si mesmo (:668, :689) | exact |
| `apps/web/src/dados/crm/cliente-crm.ts` (mod: invalidador que casa arrays) | utility | request-response | si mesmo (`invalidarCrm`) | exact |
| `apps/web/src/dados/crm/mensagens.ts` (mod: anexos, reenviar, URL) | hook | request-response | si mesmo | exact |
| `apps/web/src/dados/envio-ao-bucket.ts` (mod: lista da Mensagem) | utility | file-I/O | si mesmo | exact |
| `apps/web/src/features/crm/conversation-thread.tsx` (mod) | component | request-response | si mesmo | exact |
| `apps/api/src/mensageria/*.test.ts` (um por modulo) | test | varios | ver cada modulo | - |
| `docs/09-planejamento/dados/andamento.mjs` (mod) | doc | - | entradas existentes | role-match |
| `CONTEXT.md` (raiz) e `apps/api/src/*/CONTEXT.md` (mod) | doc | - | secoes "A partir da Fase N" | exact |

NAO modificar: `apps/api/src/rotas/webhook-meta.ts` (D-16-07). Ele so serve de molde.

## Pattern Assignments

### `apps/api/migracoes/013-mensageria.sql` (migration)

**Analogo:** `apps/api/migracoes/012-atividade-do-crm.sql` (imutavel; criar a 013 nova, `create ... if not exists`, sem `grant`). Copiar o bloco final de "desligar RLS" (linhas finais da 012):

```sql
do $$
declare
  t record;
begin
  for t in
    select c.relname
      from pg_class c
     where c.relnamespace = 'plataforma'::regnamespace
       and c.relkind in ('r', 'p')
       and c.relrowsecurity
  loop
    execute format('alter table plataforma.%I disable row level security', t.relname);
  end loop;
end $$;
```

Mais: `create table if not exists plataforma.webhooks_recebidos (...)` com indice parcial `(disponivel_em, id) where estado = 'pendente'`, e o indice unico do `mensagem.enviar.v1` (RESEARCH Pattern 3, desenho do indice `integration_outbox_notificar_canal_uniq` da 006). Os indices da 012 usam `create index if not exists ... on plataforma.crm_atividades (workspace_id, ...)`.

### `apps/api/src/persistencia/migracao-013.test.ts` (test, batch)

**Analogo:** `migracao-012.test.ts` linhas 1-60. Copiar: `describeComBanco`, `poolDoDono` de `../testes/banco-crm`, `encerrar` de `./conexao`, `migrar` de `./migrar`, `PASTA_DE_MIGRACOES`, `TEXTO_NNN`/`SQL_NNN` (sem comentarios), `ateNNN()` (arquivos `< ARQUIVO_013`), `urlDoBanco(nome)` com banco descartavel `m013_<8>`. Casos a replicar: (a) restricoes com nome, (b) idempotencia (rodar texto 2x), (c) `migrar()` interrompida nao deixa rastro, (d) sem RLS, (e) SQL sem comentario nao concede privilegio, (g) nenhuma linha de `registros` muda.

### `apps/api/src/persistencia/outbox-worker.ts` (mod) e `outbox.ts` (mod)

**Pontos exatos** (Pitfall 1 da RESEARCH): `reivindicar` (:157-178) so filtra `status = 'pending'`; `CAMINHO_POR_EVENTO: Record<NomeDeEvento, string>` (:63) exige chave nova; `entregar` (:230-267) cai em `/webhooks/plataforma/desconhecido`; `OpcoesOutboxWorker` (:116-137) nao tem `tiposDeEvento` nem `entregador`.

```typescript
// outbox-worker.ts:164-176 - onde entra o filtro de tipo (inclusivo no worker novo, `not like 'mensagem.%'` no velho)
const r = await cliente.query<LinhaOutbox>(
  `update plataforma.integration_outbox
      set status = 'delivering', locked_at = now(), locked_by = $1, attempts = attempts + 1
    where id = (
      select id from plataforma.integration_outbox
       where status = 'pending' and available_at <= now() ${filtroWorkspace}
       order by available_at, id
       limit 1
         for update skip locked
    )
    returning *`, parametros);
```

```typescript
// outbox.ts:33-41 - forma do catalogo; o novo evento entra aqui, payload so ids, .strict()
export const EVENTOS = {
  "solicitacao.criada.v1": z.object({ taskId: z.string(), ... }).strict(),
  // + "mensagem.enviar.v1": z.object({ mensagemId, conversaId, canalId }).strict()
} as const;
export type NomeDeEvento = keyof typeof EVENTOS;
```

`gravarEventos(cliente, workspaceId, eventos)` (:107-125) faz insert simples no cliente da transacao e usa `schema.parse` (derruba a tx se invalido). Reenfileirar usa `on conflict ... do update` proprio (RESEARCH Pattern 3). `backoff()` (:84) e `sanitizarErro()` (:108) sao exportados: reusar; acrescentar `/apikey[=:]\s*\S+/gi` em `PADROES_SENSIVEIS` (:92-101). Cuidado: `outbox-worker.test.ts` casos h-k sao flake de baseline.

### `apps/api/src/mensageria/processador-de-entrada.ts` e `entregar-mensagem.ts` (worker, event-driven)

**Analogo:** `persistencia/outbox-worker.ts`. Copiar:
- cabecalho/contrato: `criarXWorker(opcoes)` devolvendo `{ iniciar, parar, processarUm }` (:139-155), com `relogio` injetavel (`../testes/relogio`) e `workerId`;
- laco com `emVoo` e `parar()` que espera a volta (:282-309);
- ciclo de vida: `const cliente = await pool().connect(); try { ... } finally { cliente.release(); }` (:269-280);
- `marcarPendente` com `backoff(tentativa)` + `marcarFalha` (:199-228); classificacao transitorio x permanente (:255-266).

Diferencas a acrescentar (RESEARCH Pattern 2): antes de reivindicar, devolver a `pendente` as linhas `processando` com `locked_at` vencido (o worker velho nao tem isso); metodo `acordar()` chamado pela rota do webhook (polling de 5 s nao cumpre "menos de 2 s"); `entregador?: (linha) => Promise<ResultadoDeEntrega>` onde `ResultadoDeEntrega = { ok: true, idExterno } | { ok: false, transitorio, motivo }`. Nao logar `corpo`/`payload`.

### `apps/api/src/index.ts` (mod)

**Analogo:** o proprio bloco do outbox (:186-202). Copiar a forma para `MENSAGERIA_WORKER_ATIVO` e `COLETA_DE_ORFAOS_ATIVA`:

```typescript
if (process.env.OUTBOX_WORKER_ATIVO === "true") {
  ...
  const worker = criarOutboxWorker({ destinoUrl, token, workerId: process.env.OUTBOX_WORKER_ID ?? `apps-api-${process.pid}` });
  worker.iniciar();
  aoEncerrar(() => worker.parar());
  app.log.info("outbox worker ativo");
}
```

Tudo que sobe (workers, ouvinte `LISTEN`) deve registrar `aoEncerrar(...)` (Pitfall 20). O SSE em aberto pendura o desligamento: fechar os assinantes em `aoEncerrar`.

### `apps/api/src/rotas/webhooks-de-mensageria.ts` (route, publica)

**Analogo:** `rotas/webhook-meta.ts` (somente leitura; nao tocar). Copiar:

```typescript
// :62-67 comparacao em tempo constante
function iguais(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}
// :103 rota publica fora do JWT
app.post(canal.caminho, { config: { publica: true } }, async (request: FastifyRequest, reply) => {
  const corpo = request.body as CorpoDoWebhook | undefined;   // { bruto: Buffer, json: unknown }
// :145-153 parser de corpo cru ENCAPSULADO no plugin (registrar 2x na mesma instancia e erro)
app.addContentTypeParser("application/json", { parseAs: "buffer" }, (_request, bruto, feito) => {
  const buffer = bruto as Buffer;
  try {
    const json: unknown = buffer.length === 0 ? null : JSON.parse(buffer.toString("utf8"));
    feito(null, { bruto: buffer, json } satisfies CorpoDoWebhook);
  } catch {
    feito(Object.assign(new Error("JSON inválido."), { statusCode: 400 }), undefined);
  }
});
```

NAO copiar: o log com `payload: corpo?.json` (:128) e o `else` que aceita sem segredo (:120-125): aqui tudo que falha (Canal inexistente, arquivado, segredo errado) e a mesma 401. Limite de taxa por IP em memoria antes de tocar o banco: `criarLimiteDeTaxa({ janelaMs, maximo })` e `.consumir(chave)` de `servicos/limite-de-taxa.ts` (:23-60). Segredo lido por `lerCredencial(cliente, chaves, dono)` de `servicos/cofre.ts` (:158). Apos o insert em `webhooks_recebidos`: `reply.code(200)` e depois `acordar()`.

### `apps/api/src/rotas/eventos.ts` (route, streaming) - sem analogo no repo

Usar RESEARCH Pattern 4 (`reply.send(PassThrough)`, `x-accel-buffering: no`, batida de 25 s, fecha em 45 min, limpar em `request.raw.on("close")`). A rota fica DENTRO do hook de JWT (usa `request.membro`), diferente do webhook. Filtro: Espaco do evento == Espaco do Membro e poder `ler` `conversa` via `exigir` de `servicos/crm/acesso.ts`.

### `apps/api/src/servicos/crm/recebimento.ts` (service, transacao)

**Analogo:** `servicos/crm/mensagens.ts`. Copiar:

```typescript
// :39-53 imports e camadas
import type { Pool, PoolClient } from "pg";
import { criarRepositorioDeCanaisPg } from "../../repositorios/crm/canais";
import { criarRepositorioDeConversasPg } from "../../repositorios/crm/conversas";
import { criarRepositorioDeMensagensPg } from "../../repositorios/crm/mensagens";
import { recusa, sucesso, type ResultadoCrm } from "./resultado";
import { comTransacao, type FrasesDeRestricao } from "./transacao";
// :88-98 fabrica com deps injetadas
export function criarServicoDeMensagens(deps: { readonly pool: () => Pool; ... }): ServicoDeMensagens {
// :117-121 transacao
return comTransacao(deps.pool, async (cliente: PoolClient) => { const conversa = await criarRepositorioDeConversasPg(cliente).obter(...); ... }, FRASES);
```

Idempotencia ja existe em `registrarRecebida` (:172-200): `inserirRecebida` com `on conflict do nothing`, depois `obterPorIdExterno` e `{ mensagem, repetida: true }`. Em `receberMensagem`, isso vira o ultimo passo e a checagem de `repetida` sobe para o inicio. Contato: `detentorDoIdentificador` (`repositorios/crm/contatos.ts`) + `normalizarIdentificadorDeContato` (domain). NAO chamar `avancarRevisaoDoEspaco` (Anti-Pattern: trava a linha do Espaco a cada mensagem). `inbox.reopenWindowHours` le-se de `plataforma.registros` (colecao `inbox`), nao de tabela propria. `validarRecebida` (:80-86) e o molde para validar o evento do provedor.

### `apps/api/src/servicos/crm/mensagens.ts` (mod) e `conversas.ts` (mod)

Tres pontos gravam `enviada` (Pitfall 13): `mensagens.ts:157-165`, `conversas.ts:524-531` (`abrirConversaNoCliente`, reusada por `POST /conversas` e `tarefas-conversacionais.ts` :346, :409). O passo comum "enfileirar `mensagem.enviar.v1` + `avisarCrm`" deve ser uma funcao so, chamada nos tres. Trecho a alterar:

```typescript
// mensagens.ts:157-165
const mensagem = await mensagens.inserir(membro.workspaceId, {
  conversaId: conversa.id, canalId: canal.id, direcao: entrada.direcao,
  ator: { tipo: "member", id: membro.id }, conteudo: entrada.conteudo,
  statusEntrega: entrada.direcao === "enviada" ? statusInicialDeEnvio(canal.conexao) : null,
  ...
});
// depois: await gravarEventos(cliente, membro.workspaceId, [{ type: "mensagem.enviar.v1", ... }]); await avisarCrm(cliente, ...)
```

Remover `registrarRecebida` da interface `ServicoDeMensagens` (:55-62). `statusInicialDeEnvio` (domain :192-194) passa a devolver sempre `pendente`: grep e ajustar testes que esperam `enviada`.

### `apps/api/src/rotas/crm/mensagens.ts` (mod) e upload em duas fases

**Analogos:** o proprio arquivo (rota REST com zod + `ZodTypeProvider`, :33-60) e `rotas/anexos-da-tarefa.ts`.

```typescript
// rotas/crm/mensagens.ts:35-60
export const NOVA_MENSAGEM = z.object({ conversaId: ID, direcao: z.enum(DIRECOES_DE_ENVIO), conteudo: TEXTO_LONGO.min(1), emRespostaAId: ID.optional() }).strict();
rotas.post("/mensagens", { schema: { body: NOVA_MENSAGEM } }, async (request, reply) =>
  responder(reply, await servico.enviar(request.membro, request.body), 201));
```

```typescript
// anexos-da-tarefa.ts:131-133 e :135-150: ticket (fase 1) e confirmacao (fase 2)
app.addHook("preValidation", recusarSuspensoNaEscrita);
const sessao = await abrirSessaoDeUpload({ workspaceId: membro.workspaceId, formId: formIdDaTarefa(taskId) });
const ticket = await emitirTicket({ submissionId: sessao.submissionId, displayName: corpo.data.nome, mediaType: corpo.data.mime });
return reply.code(200).send({ ok: true, submissionId: sessao.submissionId, objectId: ticket.objectId, uploadUrl: ticket.uploadUrl });
// :153-176 confirmar: recusaDaSessaoDaTarefa(...) -> confirmarObjeto({ submissionId, objectId }) -> 422 com mensagemDaRecusaDoArquivo
// consumirSessao(cliente, submissionId) dentro de `aoConfirmar` do executar(): na Mensagem, dentro do comTransacao da propria Mensagem
```

`formId` sintetico: `conversa-<conversaId>` (sem `:`), como `formIdDaTarefa`. Respostas de erro em palavras de produto, nunca a chave do objeto; logar so o codigo (`erro.message.split(":")[0]`, :146). Chave do objeto `workspace/<ws>/conversas/<conversaId>/<uuid>`: `gerarObjectKey` (`storage-uploads.ts:85`). `GET /mensagens/:id/anexos/:indice` usa `urlDeDownload(objectKey)` (:289) e `createSignedUrl(..., { download })` para documento sempre como anexo.

### `apps/api/src/servicos/storage-uploads.ts` (mod)

```typescript
// :53-62 lista atual (Formulario publico: NAO alargar)
export const TIPOS_ACEITOS = ["application/pdf","application/xml","text/xml","image/jpeg","image/png","image/webp"] as const;
export function tipoAceito(mediaType: string): mediaType is TipoAceito { ... }   // :68
export function assinaturaConfereComTipo(primeirosBytes: Uint8Array, mediaType: string): boolean   // :114
```

Criar `TIPOS_ACEITOS_NA_MENSAGEM` ao lado (nova constante + `tipoAceitoNaMensagem`), estendendo `assinaturaConfereComTipo` para os tipos novos (`audio/ogg; codecs=opus` nao bate com a lista: normalizar antes, Pitfall 8). Teto: `MAX_BYTES_POR_ARQUIVO` (:46, `UPLOAD_MAX_BYTES`, padrao 25 MiB); acrescentar teto 16 MiB para audio/video. `confirmarObjeto` (:246-277) chama `tipoAceito(tipoDeclarado)` na :263: parametrizar a lista. `coletarOrfaos({ limite })` (:305) ja existe; falta ligar por `COLETA_DE_ORFAOS_ATIVA` com `pg_try_advisory_lock`.

### `apps/api/src/mensageria/provedores/evolution/cliente.ts` (service)

**Analogo:** `outbox-worker.ts` `entregar` (:230-248) para o `fetch` com `AbortSignal.timeout` e classificacao; testes com `criarServidorFalso()` (`testes/servidor-falso.ts`).

```typescript
resposta = await fetchImpl(url, { method: "POST", headers: { "content-type": "application/json", apikey }, body: JSON.stringify(...), signal: AbortSignal.timeout(timeoutMs) });
```

```typescript
// servidor-falso.ts:19-35: respostas programadas FIFO; sem fila -> 500 SEM_RESPOSTA_PROGRAMADA
export type RespostaProgramada = { kind: "ok"; status; corpo?; cabecalhos? } | { kind: "atraso"; ms; status; corpo? } | { kind: "respostaPerdida" } | { kind: "timeout" };
export interface ServidorFalso { url; enfileirar(r); recebidas: ReadonlyArray<RequisicaoRecebida>; fechar(): Promise<void>; }
```

Politica de erro (RESEARCH): so retentar o certamente nao processado (conexao recusada, DNS, 502/503/504, 429); timeout/reset ambiguo = `falhou` com "Sem confirmacao do provedor"; 400/401/403/404 permanentes. `apikey` nunca em log nem em `ultimo_erro`.

### `apps/api/src/bootstrap/canal-ligar-evolution.cli.ts` (CLI)

**Analogo:** `bootstrap/crm-demo.cli.ts` + `crm-demo.ts` (arquivo `.ts` com a logica e `RecusaDoDemo`, `.cli.ts` fino, `.test.ts`). Copiar a estrutura: `USO` (array `join("\n")`), `lerArgumentos(argv)` que lanca erro de recusa e valida `--canal`/`--instancia` (aceitar `--x valor` e `--x=valor`, recusar duplicado e desconhecido), `principal(argv): Promise<number>` que NAO chama `process.exit` (codigos 0/2/1), `carregarEnv, encerrar, pool` de `../persistencia/conexao`. Recusar `numeropvmarcos` em `lerArgumentos`. Segredo e chave da instancia por `guardarCredencial` (`servicos/cofre.ts:123`). Registrar o script em `apps/api/package.json` junto de `"bootstrap:crm-demo": "vite-node src/bootstrap/crm-demo.cli.ts"` (:15): `"canal:ligar-evolution": "vite-node src/bootstrap/canal-ligar-evolution.cli.ts"`.

### `apps/web/src/dados/tempo-real.ts` e `store.ts`

**Analogos:** `AcompanhanteDaRevisao` (`store.ts:689-737`, componente `null` com `useEffect` e limpeza) montado por `createElement` em `StoreProvider` (:668):

```typescript
return createElement(StoreContext.Provider, { value: store }, createElement(AcompanhanteDaRevisao, { store }), children);
```

Montar `AcompanhanteDoTempoReal` ao lado dele (nao substitui; o SSE soma, e `INTERVALO_DA_REVISAO_MS = 5_000` segue como reserva). Token e `fetch` de `chamarCrm` (`cliente-crm.ts`):

```typescript
const token = (await clienteDoNavegador().auth.getSession()).data.session?.access_token;
if (!token) throw new ErroDeApi(401, "Sua sessão expirou. Entre de novo.");
resposta = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${caminho}`, { headers: { authorization: `Bearer ${token}` } });
```

Leitor de fluxo: RESEARCH Pattern 6. Invalidacao: `invalidarCrm(prefixo)` so casa chave `string` (`typeof chave === "string" && chave.startsWith(prefixo)`), mas o resumo das Tarefas conversacionais usa chave ARRAY (`tarefas-conversacionais.ts:94`): criar invalidador que case tambem `Array.isArray(chave) && typeof chave[0] === "string"`. Chaves: `/conversas`, `/mensagens?conversaId=<id>`, `/tarefas-conversacionais/resumo` (D-16-02: so listas, sem toast). Debounce ~300 ms. Antes de mexer no Next, AGENTS.md manda ler `node_modules/next/dist/docs/`; aqui so ha `"use client"` e API de navegador.

### `apps/web/src/dados/crm/mensagens.ts` (mod)

```typescript
// :53-58 chave e leitura SWR; :61-65 envio com invalidacao so no sucesso
export async function enviarMensagem(entrada: NovaMensagem): Promise<Mensagem> {
  const resposta = await chamarCrm<{ ok: true; dados: Mensagem }>("/mensagens", { method: "POST", corpo: entrada });
  await Promise.all([invalidarCrm("/mensagens"), invalidarCrm("/conversas")]);
  return resposta.dados;
}
```

`reenviarMensagem(id)` e `pedirTicketDeAnexo` seguem esta forma (`POST /mensagens/:id/reenviar`, `POST /mensagens/anexos`). Upload: `enviarBytesAoBucket(uploadUrl, file, aoProgredir)` em `dados/envio-ao-bucket.ts` (XHR com `FormData`, `cacheControl`, arquivo sob chave vazia): reusar; a lista `TIPOS_DE_ARQUIVO_ACEITOS` (:13) e do Formulario, criar lista propria da Mensagem.

### `apps/web/src/features/crm/conversation-thread.tsx` (mod)

Hoje mostra `statusEntrega` cru (` · pendente`) e o "anexo" do compositor so alterna tipo (`:216`, `:1284-1298`). Acrescentar `<audio>/<video>/<img>`/link e "Tentar de novo". Nao reabri-lo inteiro: ler so essas faixas.

### Testes novos (um por modulo)

| Teste | Molde |
|---|---|
| `mensageria/provedor.test.ts` (contrato, roda contra o provedor de teste) | funcoes puras de `servicos/storage-uploads.test.ts` + `cofre.test.ts` |
| `evolution/cliente.test.ts` | `criarServidorFalso` (`testes/servidor-falso.ts`), como `outbox-worker.test.ts` |
| `processador-de-entrada.test.ts`, entregador | `persistencia/outbox-worker.test.ts` (casos de Fault-Injection; flake h-k conhecido) |
| `recebimento.test.ts`, repositorio | `repositorios/crm/mensagens.test.ts`, `rotas/crm/mensagens.test.ts` (`describeComBanco`, `prepararBancoCrm`, `novoEspacoDeTeste`) |
| `webhooks-de-mensageria.test.ts` | `rotas/webhook-meta.test.ts` |
| `migracao-013.test.ts` | `migracao-012.test.ts` |
| web: `tempo-real.test.ts` | `dados/crm/mensagens.test.ts`, `cliente-crm.test.ts` |

Guardas por grep a respeitar: `regime-dos-chamadores.test.ts` (nao usar `regime: "otimista"`), `sem-crm-antigo.test.ts`, `sem-listas-espelho.test.ts`. Banco de teste: Postgres 16 local; `vitest.config.mts` roda um arquivo por vez.

## Shared Patterns

### Rota publica verificada em tempo constante
**Fonte:** `apps/api/src/rotas/webhook-meta.ts:62-67, :103, :145-153`. **Aplicar a:** `webhooks-de-mensageria.ts`, `provedores/teste.ts` e `provedores/evolution/provedor.ts` (`verificarChamada`).

### Cofre (segredo do webhook, chave da instancia)
**Fonte:** `apps/api/src/servicos/cofre.ts` `guardarCredencial` (:123, revoga a ativa e insere no cliente da transacao, devolve so o `id`) e `lerCredencial` (:158, so servicos, nunca rota). `DonoDaCredencial` = `{ workspaceId, donoTipo, donoId, tipo }`. **Aplicar a:** registro de provedor, CLI de ligar, CLI de segredo de teste.

### Transacao e resultado
**Fonte:** `servicos/crm/transacao.ts` `comTransacao(pool, fn, FRASES)` e `servicos/crm/resultado.ts` (`recusa`, `sucesso`). **Aplicar a:** `receberMensagem`, "tentar de novo", reenfileirar. Evento de outbox e `pg_notify` vao no MESMO `PoolClient` da transacao (`gravarEventos`, `avisarCrm`), nunca em conexao propria.

### Backoff e saneamento de erro
**Fonte:** `outbox-worker.ts:84` `backoff`, `:108` `sanitizarErro`. **Aplicar a:** os dois workers novos e o cliente da Evolution; todo `ultimo_erro`/`motivo_falha`/log passa por `sanitizarErro`.

### Privacidade em log
`conteudo`, `cargaBruta`, `corpo` do webhook, telefone e `apikey` nunca em log (comentario `servicos/crm/mensagens.ts:36`, T-08-46). Payload de `avisarCrm` e de `mensagem.enviar.v1` so com ids.

### Acesso
**Fonte:** `servicos/crm/acesso.ts` `exigir(deps.acesso, membro, "enviar", "mensagem")` antes de qualquer leitura/transacao (`mensagens.ts:111`). **Aplicar a:** novas rotas de Mensagem e ao filtro do `GET /eventos`.

### Regra de dependencia
Regra de recebimento, proximo status, validacao de anexo e `conexao_confirmada` nascem em `packages/dominio` (sem importar nada); `apps/web` e `apps/api` nunca se importam. Dominio antes de api antes de web.

## No Analog Found

| Arquivo | Papel | Fluxo | Motivo |
|---|---|---|---|
| `apps/api/src/rotas/eventos.ts` | route | streaming (SSE) | Nenhuma rota SSE existe; usar RESEARCH Pattern 4 (provado em experimento local) |
| `apps/api/src/mensageria/ouvinte-pg.ts` + `hub-de-eventos.ts` | service | pub-sub (`LISTEN`) | So ha `pool()`; nenhum `pg.Client` avulso com `LISTEN`; RESEARCH Pattern 5 e `construirSsl` de `persistencia/conexao.ts` |
| `.../evolution/traduzir.ts` | utility | transform | Nenhum tradutor de payload de provedor; usar RESEARCH "Traduzir `MESSAGES_UPSERT`" e fixtures em `exemplos/` |
| `apps/web` leitor SSE (`tempo-real.ts`, parte `fetch` + `getReader`) | service | streaming | So ha polling; RESEARCH Pattern 6 |

## Metadata

**Escopo da busca:** `apps/api/src/{persistencia,rotas,rotas/crm,servicos,servicos/crm,repositorios/crm,bootstrap,testes}`, `apps/web/src/dados`, `packages/dominio/src/crm`, `apps/api/migracoes`.
**Arquivos lidos:** outbox-worker, outbox, webhook-meta, servicos/crm/mensagens, rotas/crm/mensagens, anexos-da-tarefa, storage-uploads (trechos), cofre (trechos), servidor-falso, migracao-012.test, 012.sql (fim), crm-demo.cli, store.ts (trecho), cliente-crm, dados/crm/mensagens, envio-ao-bucket, index.ts (trecho).
**Data:** 2026-11-09
