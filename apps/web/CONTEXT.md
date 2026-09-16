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
guarda a sessão e o `DataState`, e expõe `run()`, que executa uma operação do
domínio e incrementa a revisão para os assinantes recalcularem.

A troca da memória por chamadas ao backend aconteceu nesse arquivo — e só
nele: nenhum componente mudou. `store.ts` hidrata do `apps/api` (`GET
/estado`, chamado no Server Component da casca por `dados/estado-inicial.ts`)
e grava por `POST /operacoes/:nome` (`dados/transporte.ts`). `run()` é
híbrido (D-05): clona o estado, roda a operação na cópia — uma recusa do
domínio aparece na hora, sem nenhuma requisição; um sucesso manda a chamada
gravada ao servidor e só muda o estado real quando o diff volta. Revisão
defasada ou conflito (409) re-hidratam por `GET /estado` em vez de aplicar
diff parcial (D-06). `NEXT_PUBLIC_API_URL` é a única configuração nova que a
tela precisa. As rotas públicas (`/f/<segredo>`, `/p/<segredo>`) continuam em
memória, com o seed do produto, até OQ-PF-01 decidir em nome de quem uma
resposta anônima age.

Componente nenhum fala com o domínio por fora de `store.ts`; manter isso
verdadeiro é o que tornou a migração um arquivo em vez de cem.

## Regras de estilo

Cor só sai de `src/estilos/tokens.css`. `npm run verificar:tokens` falha se
alguém escrever um hex direto no componente, com poucas exceções já registradas
no próprio script.
