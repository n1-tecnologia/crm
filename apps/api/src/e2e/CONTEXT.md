# e2e — o cenário ponta a ponta, sem navegador

Ler primeiro: [`../../CONTEXT.md`](../../CONTEXT.md) e [`../CONTEXT.md`](../CONTEXT.md)

## O que é

Um teste e2e aqui percorre o caminho real do critério 1 do ROADMAP — Membro
real → `POST /operacoes/:nome` → Postgres → `GET /estado` — inteiro por
`app.inject()` (Fastify, sem abrir socket) contra o Supabase do projeto. Não
é e2e de navegador: quem prova o clique, o F5 e a percepção de latência é a
UAT humana do fim da fase (`01-VALIDATION.md`, "Manual-Only
Verifications"). Este teste prova a composição do lado do servidor — que a
mesma sequência hidratar → operação → diff → revisão que a tela dispara
chega ao banco e volta idêntica numa "recarga" (um `buildApp()` novo,
simulando outra requisição de casca) — e que dois processos (contador de
ids zerado) não colidem.

## Por que fica em pasta própria

Cada teste em `rotas/`, `bootstrap/`, `servicos/` prova uma peça isolada
(uma rota, o bootstrap, um serviço). Um teste e2e não é unidade nem
integração de um módulo: é um **cenário** — vários passos sequenciais que
compartilham estado (`it` dependentes, na ordem, dentro do mesmo
`describe`) e provam a composição de peças já testadas individualmente em
outro lugar. Misturar isso em `rotas/operacoes.test.ts` obscureceria o que
cada teste prova; uma pasta própria deixa explícito "isto aqui é o
critério de aceitação da fase, não uma unidade".

## Pré-condição

`DATABASE_URL` (`apps/api/.env` ou variável de ambiente) com
`npm run migrar -w @n1/api` já aplicada — o teste usa o mesmo Postgres que
`bootstrap/gestao.test.ts` e `rotas/*.test.ts` usam, num Espaço de Trabalho
próprio (`ws_e2e_teste`) que nasce por `bootstrapGestao()` e morre no
`afterAll` de cada execução. Sem `DATABASE_URL`, o arquivo pula inteiro
(`temBanco ? describe : describe.skip`, D-DEC-09) — não precisa de
`SUPABASE_*`, porque `bootstrapGestao()` só grava no Postgres, nunca fala
com o Auth.

## E2E entre serviços — `dois-servicos.test.ts` (Plan 02-26)

O gate pré-paralelo de `02-VALIDATION.md` ("E2E entre processos"): o
único teste desta pasta que sobe DOIS processos — Fastify da plataforma
(`buildApp().listen()`, servidor HTTP real, não só `.inject()`) e Express
do `automation/` (repositório irmão `../financeiro-tria`, importado por
caminho relativo dinâmico, nunca estático — ver `importarAutomation` no
próprio arquivo) — e prova a jornada completa: `POST
/v1/public/forms/:secret/submissions` → outbox real → webhook
`/webhooks/plataforma/*` → `PaymentRequestAdapter` real (HTTP de verdade)
→ `solicitarAprovacao`/`decideProcessApproval` → outbox de novo → webhook
de decisão → o `automation/` retoma.

**Como pula.** Dois gates independentes, cada um `describe.skip` a
suíte inteira:

- `DATABASE_URL` ausente (D-DEC-09, mesmo padrão do resto da pasta).
- `FINANCEIRO_TRIA_DIR` (padrão `../financeiro-tria`, resolvido a partir
  da raiz deste monorepo) sem `automation/src/` dentro — sem o
  repositório irmão clonado ao lado, não há como montar o lado
  `automation/`. Nunca falha "módulo não encontrado": o import é sempre
  dinâmico, por especificador NÃO LITERAL, para o TypeScript nunca tentar
  resolver o módulo em `npm run typecheck` num ambiente sem o repositório
  irmão.

**Nenhum dado ou credencial de produção entra aqui.** `PaymentService` é
FALSO (nunca `PaymentAutomationService` real — esse fala com o Supabase
de PRODUÇÃO do `financeiro-tria` e com o Omie real); o receipt idempotente
(`platform_event_receipts`) é um cliente FALSO em memória; nenhuma
migração é aplicada; nenhuma credencial do `.env` do `automation/` é lida.
O classificador do fallback por comentário usa a fiação real só até a IA
(stub, nunca a OpenAI real).

**Três achados reais, confirmados por execução, não corrigidos aqui**
(fora de `packages/dominio`/`rotas/operacoes.ts`/`financeiro-tria`, fora
de `files_modified` deste plano — ver `02-26-SUMMARY.md`):

1. O Convidado "Agente do pipeline" (§9) só tem `editar restrito a Status`
   por Papel — comentar numa Tarefa específica exige uma concessão DIRETA
   nela, que o evolver não cria. O teste concede isso via SQL de fixture
   (`concederComentarNaTarefa`), nunca em produção.
2. `POST /operacoes/decideProcessApproval` e `POST /operacoes/addTaskComment`
   (a rota GENÉRICA, `rotas/operacoes.ts`) não passam `opcoes.eventos` —
   diferente de `classificacoes.ts`/`formularios-publicos.ts`/
   `integracao-solicitacoes.ts`, que constroem o evento explicitamente. Uma
   decisão por CLIQUE, ou uma resposta de aprovador pela própria tela do
   CRM N1, hoje NÃO notifica o `automation/` por outbox. O teste grava o
   evento manualmente com a função de produção `gravarEventos` para provar
   a metade RECEPTORA do webhook mesmo com esse gap na emissão.
3. `eventIdDoComentario` (`financeiro-tria/automation/src/tenants/tria/classificador-de-aprovacao.ts`)
   deriva um "uuid" de um sha256 fatiado 8-4-4-4-12 sem fixar os nibbles de
   versão/variante do RFC 4122 — `z.uuid()` do contrato v1 rejeita a
   maioria dos hashes resultantes. O teste usa um classificador de
   substituição (mesma fiação HTTP real, `randomUUID()` no lugar do hash
   quebrado) para não depender do bug.

## Fault-Injection Matrix — `falhas-injetadas.test.ts` (Plan 02-26)

As nove linhas da Fault-Injection Matrix (`02-VALIDATION.md`), NO CONTEXTO
ENTRE PROCESSOS — os Planos 02-10 (`outbox.test.ts`/`outbox-worker.test.ts`)
e 02-17 (`platform-adapter-queue.test.ts`) já provaram cada peça ISOLADA;
aqui o valor é a composição, reaproveitando os helpers exportados de
`dois-servicos.test.ts` (`importarAutomation`, `criarClienteDeReceiptsFalso`,
`criarServicoFalso`, `subirAutomationDeTeste`, `temBanco`,
`temFinanceiroTria`, `ChamadaRegistrada`) — nunca duplicados, cada arquivo
com seu próprio Espaço de Trabalho e `beforeAll`/`afterAll` independentes.

Casos (a)–(h) são reais; (i) é `it.todo` nomeado — depende de
`apps/api/src/importacao/financeiro/importar.ts` (Plan 02-25), que não
existe nesta branch.

**Dois casos usam substituição documentada, nunca fabricação:**

- **(f)** usa um fake genérico em memória do client `postgrest`-like que
  `platform-adapter-queue.ts` consome (`ClienteSupabaseDeComandos`) — a
  MESMA `criarFilaDeComandos` de produção roda por cima dele, só a
  persistência é falsa.
- **(g)** chama `paraDtoV1` (`servicos/dto-solicitacao.ts`) direto, com
  `urlDeDownload` injetado — este ambiente não tem
  `SUPABASE_STORAGE_BUCKET`/`SUPABASE_URL`/`SUPABASE_SECRET_KEY`
  configurados (mesmo gate de `storage-uploads.test.ts`), então não há como
  subir um objeto real; a injeção de dependência já existe em produção
  (D-04), então isto não é um stub inventado para o teste.

## O segundo cenário — PAG-05, critério 5 (lote de 61)

`lote-contas-a-pagar.test.ts` é o segundo cenário desta pasta, num Espaço
próprio (`ws_lote_teste`). É o único teste do repositório que mede **tempo
de lock por Espaço** contra DEC-06: uma transação de lote não é "uma
transação grande", é uma hidratação mais o diff do fechamento, e o teste
prova isso comparando o custo do lote (`tLote`) contra o piso de uma escrita
mínima no mesmo Espaço (`t1`) e contra o teto de 61 transações individuais
(`tN`). A medida só significa alguma coisa contra um Espaço do tamanho do
real — por isso o número de referência que fecha DEC-06 de fato vem do
checkpoint da Task 4 de `03-12-PLAN.md`, contra `ws_n1` com o volume que
03-10 importou, não daqui.
