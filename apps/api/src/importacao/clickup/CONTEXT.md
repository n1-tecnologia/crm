# importacao/clickup

Ler primeiro: [`../CONTEXT.md`](../CONTEXT.md)

O exportador da API do ClickUp v2 (PREP-02) e o de-para de usuários
(PREP-04) — os dois insumos que a Fase 2 precisa antes de importar a Lista
de Solicitação de pagamento para a plataforma.

## `cliente.ts`

`criarClienteClickUp({ token, fetch?, dormir?, agora? })` — `fetch` fino
sobre `BASE_URL`. Header `Authorization: <token>` sem `Bearer` (token
pessoal); backoff em 429 por `X-RateLimit-Reset`; pacing por
`X-RateLimit-Remaining`; `get` devolve o corpo cru (`corpoCru`) e o JSON
parseado; `baixar` recusa qualquer host fora de `HOSTS_PERMITIDOS` antes de
chamar `fetch` (SSRF). Nunca chama `console.*` — o token não pode aparecer
em nenhuma saída deste arquivo.

## `paginacao.ts`

`paginarPorPagina` (Tarefas, Campos, Membros: `page` + booleano de última
página) e `paginarPorCursor` (Comentários: `start`/`start_id`, 25 por
página, mais novo primeiro) — dois generators independentes, cada um com
teto (`TETO_DE_PAGINAS`) contra loop sem fim. `paginarPorCursor` deduplica
por `id` porque a API é inclusiva (repete o item-cursor na página seguinte).

## `exportar.ts`

`exportarClickUp(opcoes)` — orquestra, por Lista: Lista → Campos → Membros →
Tarefas (abertas + arquivadas, duas passadas) → detalhe por Tarefa →
Comentários → `time_in_status` (smoke-testado por execução: a primeira falha
4xx desliga o recurso para toda a chamada) → anexos (allowlist de host,
teto de tamanho). Grava um arquivo por recurso/página em
`apps/api/exportacoes/clickup/`, sempre atômico (`.tmp` + `rename`); antes
de qualquer chamada de rede, confere se o arquivo já existe e é válido — o
próprio filesystem é o checkpoint da retomada, sem mecanismo separado. Não
transforma o JSON da API (D-03): grava o `corpoCru` exato, nunca
reserializado. Devolve `ResultadoDaExportacao` (contagens por Lista, user
ids vistos com contagem, avisos, requisições feitas nesta execução).

## `exportar.cli.ts`

`npm run exportar:clickup -w @n1/api [-- flags]` — CLI fino, só composição:
`carregarEnv()` → `criarClienteClickUp` → `exportarClickUp` →
`gerarManifesto` → `escreverManifesto`; nunca toca o Postgres. Flags:
`--lista=<id>` (repetível), `--amostra=<n>` (limita Tarefas por Lista,
manifesto sai com `amostra: true`), `--sem-anexos`, `--sem-time-in-status`,
`--pasta=<dir>` (default `apps/api/exportacoes/clickup/`), `--so-manifesto`
(pula a exportação, só regenera `MANIFESTO.*` do que já está em disco). Sem
`CLICKUP_API_TOKEN`, sai com `exit 1` apontando `apps/api/.env.example`
(exceto com `--so-manifesto`, que não precisa de token). Loga em
`exportacao.log`, dentro da pasta de destino — nunca o token, nunca corpo de
Tarefa/Comentário.

## `manifesto.ts`

`gerarManifesto({ pastaExportada, exportadoEm, commit })` — sha256 por
arquivo (`hashDoArquivo`, streaming) + `hashAgregado` determinístico;
contagens por Lista e por recurso SEMPRE recontadas do disco
(`contarRecursos`), nunca confiadas na memória de uma execução anterior;
`usuariosVistos` vem de `usuarios-vistos.json` sem o campo `nome` (D-02).
`manifestoEmMarkdown` resume por Lista, nunca lista arquivo a arquivo (isso
é só o `.json`). `escreverManifesto` grava os dois em
`apps/api/exportacoes/` — fora da pasta ignorada, a prova de paridade
(CON-09) sem expor dado pessoal.

## `de-para-usuarios.ts` (chega no Plan 00-02)

`DE_PARA_USUARIOS: readonly EntradaDeParaUsuario[]` — os 6 ClickUp IDs
conhecidos → e-mail + `roleIdEsperado`, mais `CATALOGO_CLICKUP` com as 38
variáveis `CLICKUP_*` do `automation/`. `entradaPorClickupId` é a busca
tipada. Não chama `inviteMember` — só descreve o de-para; quem resolve é a
importação (Fases 2/3, D-09).

## `usuarios.cli.ts` (chega no Plan 00-02)

`npm run clickup:usuarios -w @n1/api` — lista os user ids vistos numa
exportação (Tarefas, Comentários, histórico) com contagem, cruzando com
`DE_PARA_USUARIOS` para apontar quem ainda não tem entrada.

## O que este módulo não faz

- Não transforma o JSON da API — grava exatamente como a API devolve, um
  arquivo por recurso/página (D-03). O mapper (equivalente ao
  `clickup-payment-mapper.ts` do `automation/`) nasce na importação, não
  aqui.
- Não grava no Postgres. A escrita no schema `plataforma` é da importação
  (Fases 2/3), em cima do formato que este módulo produz.
- Não cria Membros. O de-para só descreve a correspondência ClickUp ID →
  e-mail; quem chama `inviteMember` é a importação, nunca este módulo
  (D-09).

## Segurança

- **T-0-01** — `CLICKUP_API_TOKEN` só em `apps/api/.env`, lido por
  `carregarEnv()` (`../persistencia/conexao.ts`); nunca logado, nunca em
  mensagem de erro, nunca em fixture de teste.
- **T-0-11** — é um token pessoal e herda todas as permissões de quem o
  gerou (não um token de app com escopo reduzido); usar só para leitura.
- **T-0-03** — os dados exportados ficam em `apps/api/exportacoes/clickup/`,
  ignorada pelo git (ver [`../../exportacoes/CONTEXT.md`](../../exportacoes/CONTEXT.md)).
- **T-0-07** — o token só viaja para hosts `*.clickup.com` e
  `*.clickup-attachments.com` (`hostPermitido`, `cliente.ts`); qualquer
  outro host recebe recusa antes do `fetch`.

## Histórico de status

A API pública do ClickUp não expõe histórico cronológico de mudança de
status — não existe endpoint equivalente a um audit log de transições
(RESEARCH.md, Pitfall 1, citado da página oficial de feedback do ClickUp).
`GET /task/{id}/time_in_status` é o único proxy disponível: tempo acumulado
por status (se o ClickApp "Total time in Status" estiver ligado), não uma
lista de eventos com timestamp exato — uma aproximação, tratada como
best-effort na exportação (Plan 00-03), nunca como trilha de auditoria
completa na spec (PREP-03).
