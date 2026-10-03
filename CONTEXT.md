# Mapa das camadas

**Leia este arquivo antes de abrir o `CONTEXT.md` de qualquer camada.** Ele diz
o que existe, quem pode depender de quem, e onde uma mudança deve nascer.

## As três camadas

| Pasta | O que é | Depende de |
|---|---|---|
| `packages/dominio/` | O contrato: tipos, operações, leituras derivadas e seed. As regras de negócio. | nada |
| `apps/web/` | A interface. Next.js 16, App Router. | `@n1/dominio` |
| `apps/api/` | O backend. Fastify sobre `@n1/dominio`, persistência no Postgres da plataforma. | `@n1/dominio` |

## A regra de dependência

O domínio não conhece ninguém. A interface e o backend conhecem o domínio, e
**nunca um ao outro**. Uma seta de `web` para `api`, ou de `dominio` para
qualquer um dos dois, é um erro de arquitetura, não um atalho.

O motivo é o que torna a separação útil: as mesmas regras precisam valer nos
dois lados. Se a validação de um Negócio mora no domínio, a tela e o endpoint
aplicam a mesma, e não duas que divergem na primeira mudança.

## Onde uma mudança nasce

- Mudou **o que a coisa é** (um campo novo, uma regra, um status) → `packages/dominio/`
- Mudou **como aparece** (layout, texto, navegação) → `apps/web/`
- Mudou **como se guarda ou se serve** (persistência, endpoint, auth) → `apps/api/`

Quando a resposta for "as três", comece pelo domínio e desça. O contrário custa
retrabalho: a tela feita antes do tipo é a tela refeita depois dele.

## Estado atual

A partir da Fase 1, `apps/api` é um servidor Fastify de verdade: sobe em
processo próprio, verifica o JWT do Supabase em `Authorization: Bearer` e
resolve o Membro por `userId` dentro do Espaço de Trabalho — o backend
aplica a regra de acesso, não só a tela. `apps/web/src/dados/store.ts`
ainda monta o seed e hidrata em memória (isso muda no Plan 01-07): a partir
dele, o store passa a hidratar do `apps/api` por `GET /estado` e gravar por
`POST /operacoes/:nome`.

`apps/api/` existe para que o backend tenha onde nascer sem que a interface
precise ser reescrita: o domínio já está fora do frontend, num pacote que os
dois lados importam.

## Comandos

Todos rodam da raiz:

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe web (3001) e api (3002) juntos, com prefixo de log por processo |
| `npm run dev:web` | Só a interface (aceita `-- -p 3001`) |
| `npm run build` | Compila a interface |
| `npm run check` | Tipos, lint, tokens e testes — os três workspaces |
| `npm run test` | Só os testes |

## Material de apoio

`docs/`, `ontologia/` e o `PRD-FRONTEND-NAVEGAVEL.md` ficam na raiz: valem para
todas as camadas e não pertencem a nenhuma.

`ferramentas/video-do-financeiro/` grava a tela real do `apps/web` e monta,
com Remotion, o vídeo que o Guia do Financeiro toca (ver o `CONTEXT.md` de
lá). Fica fora dos workspaces: nenhuma camada a importa e o CI não a instala.

O plano de migração do Financeiro Tria para cá — inventário do sistema atual,
comparativo e fases — está em `docs/08-migracao-financeiro/`. É o roteiro do
primeiro módulo que `apps/api` vai receber.
