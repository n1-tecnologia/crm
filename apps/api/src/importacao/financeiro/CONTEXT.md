# importacao/financeiro

Ler primeiro: [`../../CONTEXT.md`](../../CONTEXT.md) e [`../CONTEXT.md`](../CONTEXT.md)

SOL-09 inteira mora aqui, em duas metades. Plan 02-22: leitura
somente-leitura de `public.solicitacoes_pagamentos` (Supabase do
`financeiro-tria`), a classificação de cada linha (`solicitacoes.ts`) e o
de-para de autoria (`de-para.ts`). Plan 02-25, em cima disso: a orquestração
por lotes com ledger transacional (`importar.ts`), os anexos históricos
(`anexos.ts`), o manifesto sanitizado (`manifesto.ts`) e o CLI
(`importar.cli.ts`) que de fato chama `importarSolicitacaoHistorica`
(`@n1/dominio/operations/importacao`) e grava Tarefa.

## D-24 — a fonte

A fonte das ~1.110 Solicitações históricas é `public.solicitacoes_pagamentos`
no Supabase do `financeiro-tria` — **não** as 19 Tarefas retidas na Lista do
ClickUp (essas 19 são o que sobrou; o histórico de verdade só existe nesta
tabela). Cada linha vira Tarefa fechada em `aprovado` ou `não aprovado`
conforme o dado demonstrável; `comentario` vira o Comentário do RESUMO.

## A allowlist de colunas (D-25), não denylist

`COLUNAS` em `solicitacoes.ts` é o único ponto de contato com o schema
legado: uma coluna nova na origem nunca aparece por omissão. Nunca entram
`app_key`, `app_secret` (credenciais Omie gravadas por linha) nem
`banco_de_categorias` (o banco vetorial citado em D-25) — as três ficam de
fora da allowlist, documentadas só em comentário.

**Hipótese não confirmada:** `valor`, `documento` e `created_at` estão na
allowlist como candidatas — nenhuma das duas migrações do inventário
(`../financeiro-tria/supabase/migrations/20260511130000_rls_solicitacoes_pagamentos.sql`
e `20260526130000_add_empresa_solicitacoes.sql`) pôde ser lida neste
ambiente: o repositório `financeiro-tria` não está clonado ao lado deste
worktree, e não há `DATABASE_URL`/credencial de leitura no `.env`. Quem
rodar o `--apply` do Plan 02-25 confirma os três nomes contra o schema real
antes da primeira execução contra dado de produção — se um nome estiver
errado, a consulta falha com "coluna inexistente", nunca silenciosamente.

## Nunca abrir este banco fora do CLI de importação

`lerSolicitacoesLegadas` é a única função deste repositório que abre uma
conexão com o banco do `financeiro-tria` — e só é chamada pelo CLI da
importação (Plan 02-25), nunca por uma rota HTTP nem por qualquer caminho
do runtime normal do `apps/api`. Abrir esse banco fora do CLI é erro de
arquitetura: os dois bancos nunca devem se tocar no runtime (ver
`04-contrato-plataforma-v1.md` §1 — "Nenhum serviço faz SQL no banco do
outro", DEC-08/D-17).

A conexão é somente-leitura em duas camadas: o papel/credencial do
Postgres (fora deste repositório) e `SOMENTE_LEITURA`
(`set session characteristics as transaction read only`), executado no
início de toda sessão aberta por `lerSolicitacoesLegadas`.

## Lacuna em vez de invenção (D-25)

`classificarLinha` nunca reconstrói dado ausente — nem data, nem autoria,
nem valor. Quando um dado não é demonstrável, a categoria certa entra em
`lacunas` (ex.: `"valor_ausente"`, `"data_de_criacao_ausente"`,
`"documento_ausente"`) e o Campo correspondente fica de fora de `campos` —
nunca um zero, uma string vazia ou uma data de hoje fingindo ser a
original. `id`, vencimento (`Data_previsao`) e posição física nunca são
fonte de data de criação.

`Aprovado` nulo ou fora do domínio (`true`/`false`) nunca é inferido: vira
`ambigua`, motivo `aprovado_ambiguo` — nunca palpite.

## Autoria (`de-para.ts`)

Reaproveita `DE_PARA_USUARIOS` (`../clickup/de-para-usuarios.ts`, Plan
00-02) em vez de um segundo de-para. Só conta como "autoria demonstrável"
quando a entrada já tem `memberIdConhecido` — um Membro que já existe de
fato no `DataState` (hoje só a Maryane). As demais entradas do de-para têm
e-mail resolvido mas ainda não são Membro: `resolverAutoriaLegada` nunca
chama `inviteMember` para criar um, e nunca inventa e-mail. Sem
`memberIdConhecido`, a importação usa o Ator de importação
(`importActor`, `@n1/dominio/operations/importacao`) — nunca um Membro
inventado.

## Esta importação não dispara o pipeline

`importarSolicitacaoHistorica` não produz nenhum efeito de saída para o
`automation/`: ~1.110 pagamentos antigos não podem ser reprocessados pelo
pipeline de aprovação. Ver o cabeçalho de
`packages/dominio/src/operations/importacao.ts` para o desenho completo.

## Os três comandos (Plan 02-25)

Todos rodam da raiz, sempre com `-w @n1/api` — e sempre `--`  antes de uma
flag (`npm run <script> -w @n1/api -- --flag=valor`), senão o npm engole a
flag:

| Comando | O que faz |
|---|---|
| `solicitacoes:importar` (sem flag de modo) | `--dry-run` — classifica, resolve anexo, roda a criação da Tarefa em memória; **nunca grava** (D-25) |
| `solicitacoes:importar -- --apply [--batch-size=50] [--resume=<run-id>]` | Grava Tarefa+ledger por lote, na mesma transação; `--resume` reusa o `run_id` e recomeça da primeira página — a idempotência que evita duplicar é o próprio ledger `(origem, legacy_task_id)`, não um cursor persistido |
| `solicitacoes:reconciliar -- --run=<run-id>` | Só lê (ledger + contagem de Tarefas com a proveniência certa); nunca importa |

Nenhum dos três aceita uma flag de origem: `origem` do ledger é sempre a
constante `ORIGEM_SOLICITACOES_HISTORICAS` (`"clickup"`) — só
`importar.test.ts` passa um valor diferente, por dentro, nunca por flag.

## A regra do manifesto sanitizado (V02-09B)

`gerarManifestoDeImportacao` (`manifesto.ts`) lê **o ledger**, nunca as
linhas de origem nem `plataforma.registros`: `MANIFESTO.md`/`.json`
(`apps/api/exportacoes/importacao/<runId>/`, versionados) só têm contagens e
categorias — nenhum `TaskID`, nome, documento, valor, banco, chave Pix ou
comentário. `lidas`/`duplicadas`/`anexosLigados`/`anexosAusentes` só saem
corretos quando o CLI gera o manifesto na hora (`resumoDaExecucao`, a soma em
memória de todas as chamadas de `importarLote`); rodando só
`--reconciliar`/regerando depois, esses quatro números saem `0` — o ledger
sozinho não os reconstrói (ver o cabeçalho de `manifesto.ts`).

## Anexo histórico (D-26, `anexos.ts`)

`ligarAnexoHistorico` localiza o anexo pelo `MANIFESTO.json` da exportação
(Plan 00-04/00-05) — que trunca o nome do arquivo, então achar o real em
disco exige listar a pasta e casar por prefixo `<attId>-`, não montar o
caminho direto — confere o sha256 contra o arquivo de verdade, e só sobe ao
bucket privado quando o vínculo é inequívoco. Ambiguidade/ausência nunca
aborta o lote: vira lacuna (`anexo_ausente`, `anexo_hash_divergente`,
`anexo_multiplos_candidatos`), a mesma categoria que `classificarLinha` usa
para dado ausente. O `WorkspaceFile`/`Attachment` são construídos em
`importar.ts`, não em `packages/dominio` — decisão de execução documentada
no cabeçalho daquele arquivo (o contrato de `importarSolicitacaoHistorica`
não aceita anexo, e estendê-lo é mudança de domínio fora do `files_modified`
do Plan 02-25).

## O que esta pasta não faz

- Não chama `inviteMember` nem cria Membro.
- Não transforma texto livre (`comentario`, `comentario_aprovacao`) em
  Campo estruturado — `comentario` vira o Comentário do RESUMO, preservado
  byte a byte; `comentario_aprovacao` fica fora do escopo desta leitura.
- Não emite evento de outbox — `importar.ts` chama `executar()` sempre com
  `semEventosDeSaida: true`, e uma asserção em runtime falha alto se algum
  dia alguém acrescentar `opcoes.eventos` à chamada.
