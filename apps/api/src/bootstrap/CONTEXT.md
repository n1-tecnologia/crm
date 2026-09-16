# Bootstrap — o dado inicial de produção

Ler primeiro: [`../../CONTEXT.md`](../../CONTEXT.md)

## O que é

`bootstrapGestao()` grava, num Espaço de Trabalho vazio, o `DataState` de
`@n1/dominio/bootstrap-gestao` (`buildGestaoBootstrap()`): o Espaço "Gestão"
› Pasta "Financeiro" › Listas "Contas a pagar" e "Contas a receber",
configuradas conforme os SPECs de processo — Status, Campos, Tags, Papéis,
Agente de lançamento, Automações — e a Maryane como única Membro,
Proprietária (D-07, D-08, D-09).

Não é seed de teste. `packages/dominio/src/seed.ts` (`buildSeed()`) é o
protótipo em memória do `apps/web`, com ~900 registros de CRM, IA e Tarefas
fictícias; este bootstrap é o oposto — só o que o Financeiro de verdade vai
usar, sem nenhuma Tarefa, Contato, Negócio ou Registro de Atividade
inventado.

## Quando rodar

Uma vez, depois de `npm run migrar -w @n1/api` (schema aplicado) e de
`npm run usuarios:seed -w @n1/api` (a conta `maryane@n1.teste` existe no
Supabase Auth):

```
npm run bootstrap:gestao -w @n1/api
```

## O que NÃO faz

Não reaplica configuração por cima de dado real, e não apaga nada.
`bootstrapGestao()` só grava em Espaço de Trabalho vazio (`0` registros em
`plataforma.registros`); a segunda execução encontra registros e devolve
`{ criado: false, motivo }` sem tocar o banco. Reaplicar configuração sobre
Tarefas reais (por exemplo, uma Automação nova) é trabalho futuro — o lugar
certo é filtrar `gravar()` por coleção, não este arquivo.

## Onde mora o conteúdo

`@n1/dominio/bootstrap-gestao` — `buildGestaoBootstrap()` é puro, sem banco,
e tem os próprios testes. Este módulo só grava o que ele monta, com
`semear()` (`../persistencia/repositorio.ts`), a mesma escrita que qualquer
importação usaria.
