# observabilidade

Ler primeiro: [`../../CONTEXT.md`](../../CONTEXT.md) e [`../CONTEXT.md`](../CONTEXT.md)

O instrumento do ensaio de duas semanas (Plan 02-27, ROADMAP critério 4): as métricas
mínimas de `02-RESEARCH.md` e a reconciliação diária por origem que prova — ou não —
que o Omie nunca recebeu a mesma obrigação duas vezes.

## O que é medido

- `metricas.ts` (`coletarMetricas`) — outbox (`pending`/idade da mais antiga/`failed`/tentativas
  de entrega), aprovações por clique/comentário e a razão (D-10, reaproveita `metricaDeOrigem`
  de `../servicos/janela-de-fallback.ts`), importação histórica (`lidos`/`importados`/`rejeitados`/
  `avisados`, do ledger do Plan 02-25) e latência local p50/p95/p99 (`select 1` repetido).
- `reconciliacao.ts` (`reconciliarDia`) — agrupa por origem (`plataforma`/`clickup`) entradas,
  aprovações, RESUMOs publicados, tentativas e resultados Omie; cruza `codigo_lancamento_integracao`
  entre as duas coortes e afirma **zero interseção** (D-27, T-02-23); soma falhas não tratadas
  (outbox `failed` local + comandos `failed` do adapter).

## Por que nada aqui carrega payload

`EVENTOS` (`../persistencia/outbox.ts`) já mantém o payload do outbox pobre por desenho — só ids e
metadados. Este módulo herda a mesma disciplina no sentido inverso: as saídas de `coletarMetricas`/
`reconciliarDia`/`reconciliacao.cli.ts` nunca incluem valor monetário, documento, chave Pix, nome de
fornecedor, título de Tarefa ou trecho de comentário/RESUMO — só contagens, idades em segundos, uma
razão, e (a única lista de valores que existe) `codigosDuplicados`, que são
`codigo_lancamento_integracao` — já um id técnico, nunca dado financeiro (T-02-14). O caso (d) de
`reconciliacao.test.ts` varre a saída do CLI contra uma fixture com nome/documento/valor para provar
isso, não só declarar.

## Por que `automation`/`porOrigem` do financeiro-tria chegam por parâmetro, não por leitura

Decisão do Plan 02-27 (Task 2): os comandos do adapter, os runs e as tentativas/resultados Omie por
origem vivem inteiramente no Supabase do `financeiro-tria` — e nenhuma tabela de lá persiste hoje um
histórico consultável dessas contagens por dia (`solicitacoes_pagamentos` guarda o estado ATUAL da
Solicitação, não uma linha por tentativa; não existe uma tabela de runs/comandos agregável). Escrever
uma leitura SQL contra um schema que este módulo não pode verificar em produção arriscaria devolver
um número ERRADO com aparência de medido — pior que declarar a lacuna. Por isso:

- `coletarMetricas`/`reconciliarDia` aceitam `deps.amostra`/`opcoes.amostra` — quando presente
  (teste, ou o CLI com `--resumo=<json>`), essas contagens entram de verdade.
- Ausente, as métricas do `automation/` saem **zero** (métricas) ou a chave **nem aparece**
  (`Metricas.automation` fica `undefined`, nunca um objeto de zeros que pareça medição real) — e o
  CLI imprime um aviso explícito, nunca um silêncio que parece sucesso.
- O que É deste processo (outbox local, aprovações via `hidratar()`, ledger de importação) é sempre
  lido de verdade, sem depender de `amostra`.

Quem operar o ensaio de duas semanas (Task 3, `docs/08-migracao-financeiro/06-ensaio-e-coortes.md`)
precisa decidir como produzir o `--resumo=<json>` diário — não é código deste plano.

## Replay

Nenhum caminho de replay novo nasce nesta pasta (Plan 02-17/02-20 já têm `reenfileirar`). A regra
vale igual aqui: a interface de replay usa **ids e resumo mascarado**, e toda repetição registra
**quem/quando/motivo** — nunca o payload original solto num log ou numa tela.

## Log sem segredo (Fase 9)

`log.ts` (`opcoesDoLogger`) é o que `index.ts` entrega ao Fastify no boot
(`buildApp({ logger: opcoesDoLogger() })`, antes `logger: true`). Testes seguem
com `logger: false`; `log.test.ts` usa o segundo argumento (`destino`) para ler
as linhas num array, sem banco e sem `.env`.

- **URL mascarada.** O serializador de `req` troca por `***` o segmento depois
  de `/v1/public/forms/` e `/v1/public/tasks/` (D-18). Sem isto a linha de
  entrada de `GET /v1/public/forms/<segredo>` gravava o segredo de link no
  journald.
- **Onde mora a regra.** `mascararSegredoDeUrl` em `@n1/dominio/url-segura`,
  não aqui: o Sentry da api (09-13) e o da web (09-16) usam a mesma, e api e
  web não podem se importar. Cobre também `/f/<s>` e `/p/<s>`, os caminhos que
  a web serve. O `access_log` do nginx tem a sua própria máscara (09-06), que
  espelha o trecho `/v1/public/` à mão: mudou a regra, mude os dois.
- **Campos censurados** com `"[oculto]"`: `req.headers.authorization`,
  `req.headers.cookie` e os campos `segredo`, `secret`, `token`, `senha` — no
  topo do objeto logado e um nível abaixo (o curinga `*.token` do pino não casa
  o topo, por isso cada campo entra duas vezes).
- **`LOG_LEVEL`** passa a ser lido (padrão `info`); antes o nível era fixo.
- Continua valendo a regra do módulo: nenhuma rota loga corpo, valor ou nome
  de fornecedor. O `redact` é a segunda barreira, não a primeira.
