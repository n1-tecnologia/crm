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

A partir da Fase 7, o CRM (Contatos, Empresas, Funis com Etapas e Negócios)
é o primeiro módulo com tabelas próprias — `apps/api/migracoes/007-crm.sql`,
uma tabela por entidade, fora de `plataforma.registros` — e com rotas REST
por recurso em `apps/api` (`/contatos`, `/empresas`, `/funis`, `/negocios`),
fora de `POST /operacoes/:nome` e de `GET /estado`. As telas de
`apps/web/src/app/(shell)/crm/` falam com essas rotas por HTTP
(`src/dados/crm/`), enquanto o resto do app continua hidratando o Espaço
inteiro por `GET /estado`. O modelo antigo do CRM em inglês (`Contact`,
`Company`, `Deal`, `Pipeline`) continua vivo ao lado, porque Caixa de
Entrada e Conversas ainda dependem dele: os dois convivem até a fase de
unificação. Antes de aplicar a 007 num banco, `npm run migrar -w @n1/api --
--seco` lista o que `migrar` faria sem escrever nada.

A partir da Fase 8, o que faltava da Caixa de Entrada ganha tabelas próprias:
`apps/api/migracoes/008-canais-conversas-mensagens.sql` dá a Canal, Conversa
e Mensagem as tabelas `plataforma.canais`, `plataforma.conversas` e
`plataforma.mensagens`, com rotas REST `/canais`, `/conversas` e `/mensagens`
ao lado das do CRM. O Canal passa a ter `provedor` (WhatsApp oficial e não
oficial, Instagram, E-mail — a tabela está em
`@n1/dominio/provedores-de-canal`), e o que um Canal pode fazer (janela de
24 h, modelo, envio livre) é lido por (tipo, provedor) em `capacidadesDoCanal`,
não só pelo tipo. O Canal criado pela página nova de conexão
(`/crm/caixa-de-entrada/configuracoes/canais/conectar`) nasce `desconectada`
e só conecta por "Simular conexão", sempre marcada, enquanto não há provedor
real; o popup de adicionar Canal das Listas é o caminho legado e segue
nascendo `conectada` em `plataforma.registros`. O chat continua no modelo
antigo e enxerga os Canais da tabela por uma projeção — em `GET /estado` e em
`executar()`, nunca em `hidratar()` (ver `apps/api/src/persistencia/CONTEXT.md`)
— até a fase de unificação. O fio da Conversa tem uma aba por Canal e
"Responder por"; o seed continua, marcado como demo. A 008 já está aplicada no
banco da plataforma e é imutável: qualquer ajuste de schema daqui em diante é
a `009`.

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
