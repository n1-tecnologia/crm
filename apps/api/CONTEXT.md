# API — o backend

Ler primeiro: [`../../CONTEXT.md`](../../CONTEXT.md)

## Estado: esqueleto

Existem as pastas, o `tsconfig` e o ponto de composição. Não existe servidor.
**A camada HTTP ainda não foi escolhida** — essa decisão é sua, e está em aberto
de propósito.

## O que entra

`@n1/dominio`. As regras de negócio já estão escritas e testadas lá; este
workspace não as reescreve.

## O que sai

Uma API sobre o domínio. Quando existir.

## Como está organizada

| Pasta | O contrato |
|---|---|
| `src/index.ts` | Ponto de composição: lê config, monta repositórios, injeta nos serviços, entrega ao transporte. |
| `src/rotas/` | Um arquivo por recurso. Só traduz HTTP ↔ serviço: sem regra de negócio, sem SQL. |
| `src/servicos/` | Casos de uso. Compõem operações do domínio e falam com repositórios. É aqui que mora a transação. |
| `src/repositorios/` | Persistência. Uma interface por agregado, e a implementação atrás dela. |

A direção é sempre `rotas → servicos → repositorios`. Uma rota que chama
repositório pula a camada onde a regra deveria estar, e é assim que a lógica
começa a se espalhar.

## O que decidir antes da primeira linha

1. **Transporte** — Fastify, Hono, Nest, ou route handlers do próprio Next.
   Muda o que entra em `src/index.ts` e nada mais.
2. **Persistência** — qual banco, e com qual acesso (Prisma, Drizzle, SQL cru).
   Fica atrás das interfaces de `src/repositorios/`.
3. **Autenticação** — hoje a sessão é um `memberId` escolhido na interface
   (`apps/web/src/dados/store.ts`). Virar identidade de verdade é trabalho desta
   camada.

Nenhuma das três está decidida no código. Quando a primeira for, o script `dev`
deste workspace entra no `package.json` da raiz.

## O caminho de migração

O protótipo roda em memória. A ordem que menos dói:

1. Um repositório de verdade atrás da interface, para um agregado só.
2. Um endpoint que exponha as operações do domínio para esse agregado.
3. `apps/web/src/dados/store.ts` passa a chamar esse endpoint em vez do seed —
   **um arquivo**, porque nenhum componente fala com o domínio por fora dele.
4. Repetir por agregado.
