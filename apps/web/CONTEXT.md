# Web — a interface

Ler primeiro: [`../../CONTEXT.md`](../../CONTEXT.md)

## O que entra

`@n1/dominio` — tipos, operações e leituras derivadas. E mais nada de outra
camada: `apps/api/` não é importado daqui.

## O que sai

As telas. Next.js 16 com App Router, tudo sob `src/app/(shell)/`.

## Como está organizada

| Pasta | O que é |
|---|---|
| `src/app/` | Rotas. Uma pasta por segmento de URL. |
| `src/features/` | Os blocos de cada área do produto (crm, estrutura, ia, configuracoes, shell). |
| `src/dados/` | O adaptador entre o domínio e o React: o store zustand e os hooks de leitura. |
| `src/design/` | Tokens e primitivas visuais. |
| `src/estilos/` | CSS global. `tokens.css` é a fonte canônica de cor. |
| `scripts/` | `verificar-tokens.mjs`, que barra cor crua fora do arquivo canônico. |

## A fronteira que importa

`src/dados/store.ts` é o único ponto onde o domínio vira estado de tela. Ele
monta o seed, guarda a sessão e expõe `run()`, que executa uma operação do
domínio e incrementa a revisão para os assinantes recalcularem.

É nesse arquivo — e só nele — que a troca da memória por chamadas ao backend vai
acontecer. Componente nenhum fala com o domínio por fora dele; manter isso
verdadeiro é o que torna a migração um arquivo em vez de cem.

## Regras de estilo

Cor só sai de `src/estilos/tokens.css`. `npm run verificar:tokens` falha se
alguém escrever um hex direto no componente, com poucas exceções já registradas
no próprio script.
