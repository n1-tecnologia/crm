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

## `contas-a-pagar.ts` (Plan 03-10 — PAG-01)

A metade "ler e entender" da importação histórica da Lista de Contas a pagar
(`901107637383`). `classificarTarefaLegada` é pura (sem I/O) e traduz UMA
Tarefa+histórico do export para `EntradaDeContaAPagarHistorica`
(`@n1/dominio/operations/importacao-contas-a-pagar`) — a regra de
importação inteira é do domínio; aqui só se traduz vocabulário. `de-para`
fechados e exportados: `DE_PARA_DE_STATUS` (8 nomes), `DE_PARA_DE_CAMPOS`
(21 dos 24 Campos — `L-Data Vencimento` vai para o vencimento nativo,
`Y-Produto`/`W-Equipe` sem destino), `DE_PARA_DE_TAGS` (as 8 Tags do seed).

**Decisão de precedência do vencimento (D3-04, obrigação 3), com a
evidência que a sustenta:** o vencimento sai SEMPRE de `due_date` (o campo
nativo do ClickUp), nunca do Campo `L-Data Vencimento`. Das 117 contas
ainda em `para pagar` no export, 83 têm os dois preenchidos e **82
divergem** — `L` está, em média, 26,3 dias mais cedo (uma volta de
recorrência atrás). Todo `L` é subconjunto do nativo (1.007 Tarefas contra
2.830), então usar `L` não acrescentaria uma única Tarefa nova e poria 82
contas vivas com vencimento no passado — o gatilho de A5/A6/A7. A
divergência vira a lacuna `vencimento_l_diverge_do_nativo`, nunca uma
escolha silenciosa; quem reverter esta decisão precisa ver este número
primeiro.

**Vocabulário de lacunas** (nunca o valor problemático — D-25, T-3-25):
`vencimento_l_diverge_do_nativo`, `vencimento_ausente`, `tag_sem_equivalente`,
`campo_sem_destino`, `opcao_fora_do_dominio`, `anexo_nao_importado`,
`centro_de_custo_ausente`, `pessoa_nao_resolvida`, `autoria_nao_resolvida`,
`responsavel_nao_resolvido`, `observador_nao_resolvido`,
`transicao_sem_instante`, `tempo_acumulado_maior_que_o_intervalo`,
`tarefa_arquivada_na_origem`.

**Exclusões declaradas, não omissões:** os 4.266 Comentários do export não
entram (D3-04 nomeia `date_created`/`date_closed`/histórico de status, não
Comentário). Os três Campos de anexo (`J-Anexo`, `R-Boleto`, `S-QR Code`,
1.505 anexos baixados) têm destino em `DE_PARA_DE_CAMPOS` mas nunca
produzem valor — cada Tarefa afetada ganha `anexo_nao_importado`; o molde
para preenchê-los depois (sem reimportar) já existe em
`../financeiro/anexos.ts` (Plan 02-25).

`lerTarefasDoExport`/`verificarIntegridadeDoExport` fazem a leitura e a
conferência de `sha256` contra `MANIFESTO.json` (T-3-27), usando
`hashDoArquivo` de `./manifesto.ts`.

## `importar-contas-a-pagar.ts` (Plan 03-10)

A orquestração: `importarLote` roda um lote sob `executar()` e grava a linha
de `plataforma.importacao_ledger` (origem `clickup:901107637383`, a mesma
constante `ORIGEM_CONTAS_A_PAGAR` de `@n1/dominio`) em `aoConfirmar` — MESMA
transação da Tarefa; ledger de `003`, nenhuma tabela nova. `importarTudo`
compõe: confere integridade do export, lê e classifica em fluxo, agrupa em
lotes (padrão 250) e agrega contagens.

**Decisão de tamanho de transação: lote de 250, não uma `executar()` por
conta nem uma só para tudo.** Uma chamada por conta (2.861×) é quadrática —
cada hidratação carrega o Espaço inteiro, que cresce a cada conta. Uma
chamada para tudo segura `plataforma.workspaces` durante a importação
inteira e não é retomável (a falha da conta 1.500 desfaz as 1.499
anteriores). O lote de 250 é o meio-termo: 12 hidratações para as 2.861
Tarefas, lock por lote em segundos, e uma falha que desfaz no máximo 250 —
as anteriores já estão no ledger e a retomada parte dali (`contaAPagarJaImportada`
antes de cada conta torna o lote idempotente contra reexecução por conflito
de revisão).

**O que acontece quando uma conta falha no meio do lote:** recusa do
domínio (`ok: false`) vira ledger `rejeitada`, o lote segue; exceção/erro do
Postgres desfaz o lote inteiro (nem Tarefa, nem ledger) — os lotes
anteriores continuam commitados. Nenhum caminho deixa Tarefa sem ledger ou
ledger sem Tarefa.

`reconciliar` compara o ledger de um `run_id` com a contagem de Tarefas do
Espaço — a prova de que reaplicar não duplica. `relatorioSanitizado` grava
o agregado versionado (`apps/api/exportacoes/importacao-contas-a-pagar/<runId>/`);
o detalhe por linha (`legacyTaskId` + categoria, nunca valor de Campo) fica
em `apps/api/exportacoes/clickup/901107637383/importacao/<runId>/rejeicoes.log`,
dentro da árvore já ignorada pelo git por LGPD.

## `marco-zero.ts` (Plan 03-10)

A primeira das duas barreiras contra o agendador de Automações (Plan 03-08)
alcançar o passado importado. `marcarMarcoZero` grava uma linha
`concluido`/`last_error_code = MARCO_ZERO` (o código de
`../automacoes/scheduler-worker.ts::CODIGOS_DA_AGENDA`) em
`plataforma.automacao_agenda` para `(workspaceId, listId)` — idempotente em
dois graus: no MESMO dia civil (`on conflict`) e entre dias civis
DIFERENTES (pré-checagem por `last_error_code`), então só existe UMA marca
por Lista, nunca uma por dia em que o CLI rodou.

**Por que a marca nasce DEPOIS da importação, fora da transação do
lote:** a importação não tem uma transação só (decisão de lote acima), e a
marca significa "terminou" — escrevê-la antes abriria a agenda com contas
ainda entrando. O risco do processo morrer entre o último commit e a marca
é coberto por três coisas: escrita idempotente, o CLI sai com código 1
quando `MARCO_ZERO` não foi gravada e também não existia, e `--so-marco-zero`
grava só ela.

**As duas barreiras, e por que nenhuma é confiada sozinha:** `MARCO_ZERO`
limita QUAIS dias civis nascem na agenda (via `diasCiveisPendentes`, 03-08,
que passa a contar de `max(dia_civil)`); o ensaio da primeira volta
(`ENSAIO_PRIMEIRA_VOLTA`, também 03-08) limita SE algo dispara — mede dentro
da transação e desfaz até `npm run automacoes:liberar` ser rodado. As 51
contas em `para pagar` com vencimento no passado (de 117 nesse Status) só
alcançam A5/A6/A7 depois de as duas barreiras serem passadas por um ato
humano.

## `importar-contas-a-pagar.cli.ts` (Plan 03-10)

`npm run contas-a-pagar:importar -w @n1/api [-- flags]` — sem flag roda em
`--dry-run` (nunca grava); `--apply` importa de verdade e grava
`MARCO_ZERO` ao final, imprimindo o próximo passo
(`npm run automacoes:liberar -w @n1/api -- <workspaceId> lst_contas_a_pagar`).
`--lote=<n>`, `--pasta=<dir>`, `--resume`, `--run=<uuid>`,
`--reconciliar --run=<uuid>` (só relata), `--so-marco-zero` (grava só a
marca), `--sem-verificacao-de-hash` (recusado junto com `--apply`, T-3-27).
Nunca expõe uma flag de origem — a origem do ledger é sempre
`clickup:901107637383`, e só o teste a substitui, por dentro.

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

**O número medido (Plan 03-10):** o proxy guarda um `since` por Status
DISTINTO, não um por transição — uma Tarefa que voltou ao mesmo Status
(reentrada) aparece nele uma vez só, com o tempo das duas passagens somado.
**630 das 2.861 Tarefas da Lista de Contas a pagar** (22%) dão esse sinal:
o intervalo entre o `since` de uma entrada e o `since` da entrada seguinte
(ou o instante da exportação, para a última) é menor que o `by_minute`
acumulado. `classificarTarefaLegada` (`./contas-a-pagar.ts`) mede isso e
marca cada uma com a lacuna `tempo_acumulado_maior_que_o_intervalo` — nunca
uma métrica de "tempo em Status" silenciosamente errada.
