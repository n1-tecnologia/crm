# API — o backend

Ler primeiro: [`../../CONTEXT.md`](../../CONTEXT.md)

## Estado: servidor HTTP no ar

**Transporte:** Fastify 5 (D-01). `src/app.ts` monta o app inteiro — CORS,
validação/serialização por `zod`, tratamento de erro, rotas — sem chamar
`listen()`; `src/index.ts` é o único lugar que escuta. Essa separação é o
que permite testar com `app.inject()`, sem socket nem banco.

**Autenticação:** JWT do Supabase em `Authorization: Bearer` (D-02),
verificado no hook `onRequest` de `src/plugins/autenticacao.ts` — todo
Membro é resolvido por `userId === sub` dentro do `WORKSPACE_ID`
configurado, nunca por um id que o cliente mande. Uma rota se isenta
marcando `config: { publica: true }`.

**Persistência:** `src/persistencia/` (já existia antes deste transporte) —
`pool()` + tabela genérica `plataforma.registros`.

## O que entra

`@n1/dominio`. As regras de negócio já estão escritas e testadas lá; este
workspace não as reescreve.

## O que sai

Uma API HTTP sobre o domínio. `GET /saude` (pública), as rotas por operação
(`POST /operacoes/:nome`, `GET /estado`, Plan 01-04) e, desde a Fase 7, as
rotas REST do CRM — `/contatos`, `/empresas`, `/funis` (com `/etapas`) e
`/negocios`, GET/POST/PATCH/PUT/DELETE em `src/rotas/crm/` — que não passam
pelo despacho genérico por operação nem pelo estado hidratado: cada recurso
tem tabela própria em `apps/api/migracoes/007-crm.sql`, serviço transacional
em `src/servicos/crm/` e repositório em `src/repositorios/crm/`. Recusa de
regra nunca viaja em 200 ali (400 forma, 403 Papel, 404 fora do Espaço, 409
regra) — ver `src/rotas/CONTEXT.md`.

Antes do primeiro `npm run migrar -w @n1/api` com uma migração nova, a
conferência é `npm run migrar -w @n1/api -- --seco`: lista cada arquivo de
`migracoes/` como `aplicada` ou `pendente` segundo `plataforma.migracoes` e
não escreve nada — nem o schema nasce num banco vazio (D-12 da Fase 7).

## Como está organizada

| Pasta | O contrato |
|---|---|
| `src/index.ts` | Ponto de composição: `carregarEnv()` + `buildApp()` + `listen()`. |
| `src/app.ts` | Monta o Fastify (CORS, autenticação, rotas, erro) sem escutar — o que permite `app.inject()` nos testes. |
| `src/plugins/` | Hooks transversais registrados na raiz, antes de qualquer rota — hoje só `autenticacao.ts`. |
| `src/rotas/` | Um arquivo por recurso. Só traduz HTTP ↔ serviço: sem regra de negócio, sem SQL. `rotas/crm/` (Fase 7): as rotas REST do CRM, um recurso por arquivo, registradas por `rotasDeCrm`. |
| `src/servicos/` | Casos de uso. Compõem operações do domínio e falam com repositórios. É aqui que mora a transação. `servicos/crm/` (Fase 7): um serviço por recurso sobre `comTransacao`, com a permissão do Papel (`acesso.ts`) antes de qualquer escrita. |
| `src/repositorios/` | Persistência. Uma interface por agregado, e a implementação atrás dela. `repositorios/crm/` (Fase 7) inaugura o padrão — ver o `CONTEXT.md` de lá. |
| `src/testes/` | Apoio de teste. `banco-crm.ts`: o Postgres LOCAL descartável dos testes do CRM (`describeComBanco`, `prepararBancoCrm`, `semearMembro`, `limparEspaco`) — contra qualquer host que não seja `localhost` os blocos pulam, e `migrar()` nunca roda contra o banco remoto por um teste. |
| `src/e2e/` | Cenários ponta a ponta por `app.inject()`. `crm-fluxo.test.ts` percorre o CRM inteiro pelo HTTP contra o Postgres local. |
| `src/bootstrap/` | Script idempotente que materializa a configuração de um Espaço (Plan 01-05). |

A direção é sempre `rotas → servicos → repositorios`. Uma rota que chama
repositório pula a camada onde a regra deveria estar, e é assim que a lógica
começa a se espalhar.

## O que já foi decidido

As três decisões que este arquivo antes deixava em aberto de propósito estão
travadas em `01-CONTEXT.md` (D-01, D-02) e materializadas no código: **transporte**
é Fastify, processo próprio; **persistência** é `pg` sobre a tabela genérica
`plataforma.registros`; **autenticação** é o JWT do Supabase Auth, verificado
no servidor — não mais um `memberId` que a interface escolhe.

## O caminho de migração

O protótipo roda em memória. A ordem que menos dói:

1. Um repositório de verdade atrás da interface, para um agregado só.
2. Um endpoint que exponha as operações do domínio para esse agregado.
3. `apps/web/src/dados/store.ts` passa a chamar esse endpoint em vez do seed —
   **um arquivo**, porque nenhum componente fala com o domínio por fora dele.
4. Repetir por agregado.
