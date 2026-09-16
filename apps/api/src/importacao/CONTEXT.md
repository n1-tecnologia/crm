# importacao

Ler primeiro: [`../../CONTEXT.md`](../../CONTEXT.md) e [`../CONTEXT.md`](../CONTEXT.md)

Os insumos de importação do legado: exportadores da API do ClickUp, o
de-para de usuários (ClickUp ID → e-mail + Papel) e, nas Fases 2/3, o
importador que grava no schema `plataforma` via `semear()`.

## O que não é

Nenhuma rota HTTP, nenhuma regra de negócio, nenhum SQL (D-01). Esta pasta
lê a API do ClickUp e escreve JSON em disco — quem grava no Postgres é o
importador das Fases 2/3, em cima do mesmo formato. O `automation/` do
financeiro-tria não muda por causa desta pasta (D-DEC-11).

## Regra de dependência

Importa `@n1/dominio` (tipos, `inviteMember`) e `../persistencia`
(`carregarEnv`). Nunca `../rotas`, nunca `apps/web` — a regra de dependência
da raiz vale aqui como em qualquer outra pasta de `apps/api`.

## Onde ficam os dados

Os dados exportados vivem em `apps/api/exportacoes/clickup/`, fora do git
(D-02, LGPD) — ver [`../../exportacoes/CONTEXT.md`](../../exportacoes/CONTEXT.md).

## Pastas

| Pasta | O que é |
|---|---|
| `clickup/` | Cliente HTTP, paginação, exportador e de-para de usuários do ClickUp. |
