# testes — harness, não produção

Ler primeiro: [`../../CONTEXT.md`](../../CONTEXT.md) e [`../CONTEXT.md`](../CONTEXT.md)

## O que mora aqui

Só peças consumidas por teste: `criarServidorFalso` (um servidor HTTP real
que injeta timeout, resposta perdida, atraso e fila vazia) e `relogioFixo`/
`relogioDoSistema` (a fonte de instante que o código sob teste lê). Nenhum
arquivo de produção importa esta pasta — é o que o critério de aceite deste
plano prova por `grep`.

## Por que o servidor é real, não um mock de `fetch`

O worker de outbox e o adapter do financeiro chamam `fetch` de verdade. Um
mock de `fetch` intercepta a chamada antes que qualquer coisa sobre o
transporte aconteça — e é exatamente o transporte (timeout, socket
derrubado, corpo perdido) que os planos de outbox (02-10), fila (02-17) e
fallback de 90 dias (02-24) precisam provar falhando de verdade. Por isso
`servidor-falso.ts` sobe em `node:http` numa porta efêmera (`listen(0)`) e
fecha por `fechar()`.

## A regra do `Relogio`

`Relogio` é sempre injetado — por parâmetro ou por opção de fábrica — nunca
por variável global nem por `new Date()` direto no caminho de produção. Um
código que decide a janela de 90 dias ou o backoff do outbox chamando
`new Date()` diretamente não tem como ser testado sem esperar tempo real;
recebendo um `Relogio`, o teste avança o tempo com `avancar(ms)` ou pula
direto para um instante com `definir(instante)`.
