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
