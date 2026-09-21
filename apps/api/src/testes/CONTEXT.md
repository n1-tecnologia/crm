# testes — harness, não produção

Ler primeiro: [`../../CONTEXT.md`](../../CONTEXT.md) e [`../CONTEXT.md`](../CONTEXT.md)

## O que mora aqui

Só peças consumidas por teste: `criarServidorFalso` (um servidor HTTP real
que injeta timeout, resposta perdida, atraso e fila vazia) e `relogioFixo`/
`relogioDoSistema` (a fonte de instante que o código sob teste lê).
`outbox-worker.ts` importa `Relogio`/`relogioDoSistema` daqui — é a exceção
prevista desde o Plan 02-01 (para os Planos 02-10, 02-17 e 02-24): o worker
precisa de um relógio injetável em produção, não só no teste, e
`relogioDoSistema` é a implementação real desse contrato, não um duplo de
teste.

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
