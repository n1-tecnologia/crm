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

**A segunda fronteira (Fase 7): o CRM não passa por `store.ts`.** Contatos,
Empresas, Funis e Negócios têm tabelas próprias na api e não entram no
`DataState` nem em `GET /estado`. `src/dados/crm/` é o adaptador deles:
`cliente-crm.ts` (`chamarCrm`, o `fetch` com o JWT do Supabase contra as
rotas REST de `NEXT_PUBLIC_API_URL`; `ErroDeApi` com `status`, `codigo`,
`campo` e `bloqueios`; `invalidarCrm`) e um módulo por recurso
(`contatos.ts`, `empresas.ts`, `funis.ts`, `negocios.ts`) com os hooks de
leitura por SWR (`useContatos`/`useContato`…, chave = o caminho da rota com
a query) e as mutações (`criarContato`, `moverNegocio`…). Depois de cada
escrita bem-sucedida a mutação **invalida por prefixo de chave**
(`invalidarCrm("/negocios")` revalida toda chave que começa por
`/negocios`; mover Negócio invalida também `/funis`, migrar Funil invalida
`/negocios`); uma recusa não invalida nada. Não há `run()` nem revisão
otimista aqui: a api é a autoridade, e a tela reage ao 409 com a frase e os
`bloqueios` que ele traz. O store continua sendo a fonte de **Membros e
Papéis**: `src/dados/crm/sessao.ts` (`useMembrosAtivos`, `useNomeDoMembro`,
`usePodeNoCrm`) lê `state.members`/`state.roles` do `DataState` para
nomear o Proprietário e para esconder o que o Papel não alcança — a mesma
`podeNoCrm` de `@n1/dominio/crm/permissoes` que o backend aplica.

## Quem vê o quê na tela

`GET /estado` hidrata o Espaço de Trabalho **inteiro**, sem filtro de
visibilidade — o navegador de um Convidado recebe tudo, inclusive o que a
tela não deve mostrar. Não é otimização: **toda tela que enumere uma coleção
do estado tem que perguntar antes de desenhar**, porque o dado já está no
cliente de qualquer forma.

| Superfície | Pergunta a `@n1/dominio/derive` |
|---|---|
| Página da Lista (`estrutura/listas/[lista]`) | `memberReachesContainer` — alcance do contêiner |
| Página e popup da Tarefa | `memberSeesTask` |
| "Compartilhadas comigo" (trilho, `shell/compartilhadas-comigo.tsx`) | `memberSeesTask && !memberReachesContainer` — só o que a árvore não dá |
| Busca global (`/buscar`) | `memberSeesTask` nas Tarefas, `memberReachesContainer` nas Listas |
| "Minhas Tarefas" / "Todas que eu vejo" (`estrutura/tarefas`) | `memberSeesTask` |

A visibilidade da Tarefa é **derivada**, nunca lida de `state.grants` à mão
por um componente: `List.sharedWithDefinitionIds` declara, como dado na
Lista, quais Campos do tipo `person` nomeiam quem enxerga (03-05) — é assim
que a Pessoa de uma conta a pagar vê a própria conta sem que ninguém tenha
escrito uma Grant. Um componente que filtra `state.grants` diretamente
reintroduz o bug que 03-15 fechou: a regra muda no domínio e a tela para de
saber, em silêncio.

**O CRM é filtrado no servidor, não no cliente (Fase 7, D-10/D-14).** As
telas de `app/(shell)/crm/{contatos,empresas,funis,negocios}` nunca
enumeram uma coleção do `DataState`: cada lista e cada ficha vem de uma
chamada à api, que já aplicou o Espaço de Trabalho (o `workspace_id` da
sessão, resolvido do JWT — um registro de outro Espaço é 404) e a
permissão do Papel (403). `usePodeNoCrm` só decide o que **mostrar** —
botões desabilitados com o motivo, nunca escondidos de quem lê; a recusa
de verdade é a do backend. O escopo "próprios" (vendedor vê só os seus
Negócios) e a visibilidade de Funil privado ficaram para uma fase futura:
`privado` é gravado e exibido, mas nenhuma regra o consulta.

**Limitação aceita (D-15).** Busca global (`/buscar`), Lixeira
(`/configuracoes/lixeira`), Notificações, `/crm/meus-negocios` e Caixa de
Entrada continuam lendo o modelo antigo do CRM (`state.contacts`,
`state.companies`, `state.deals`, `state.pipelines` do `DataState`) e **não
mostram os registros da api nova**. As fichas de Contato
(`/crm/contatos/[contato]`), Empresa (`/crm/empresas/[empresa]`) e Negócio
(`/crm/negocios/[negocio]`) tentam a api primeiro e, num 404 cujo id existe
no `DataState`, **abrem a tela antiga** (`features/crm/legado/*`,
`DealScreen`) para os ids do modelo antigo. Isso fica assim até a fase de
unificação, que aposenta o modelo em inglês e religa essas superfícies.

**A terceira fronteira (Fase 8): o Canal relacional também fala REST.** O
chat — Caixa de Entrada, fio da Conversa, Listas — segue no store (D-11); só
a conexão e a ficha do Canal falam REST. `src/dados/crm/canais.ts` é o cliente
HTTP de Canais (mesmo `chamarCrm` da Fase 7: `/canais`, simular conexão,
desconectar, arquivar, configurar). O Canal novo nasce `desconectada` pela
página `conectar/page.tsx` (os quatro cartões de provedor) e
`conectar/[provedor]/page.tsx`, um Server Component que só valida o slug do
provedor e entrega a `features/crm/conectar-provedor.tsx` (orientação passo a
passo, espaço reservado do QR/token e o formulário real). A ficha do Canal
grava por REST quando o Canal é relacional (vem de `GET /estado` com
`relational: true`) e pela operação antiga quando é do seed (demo); o botão
"Simular conexão" só aparece para quem administra. Três peças visuais novas
em `features/crm/`: `selo-do-provedor.tsx` (oficial/não oficial/cadastrado/
demo/conexão simulada), `seletor-de-canal.tsx` ("Responder por", que troca a
aba sem mover uma Conversa existente de Canal) e `separador-de-canal.tsx` (o
"via …"). `ConversationThread` tem uma aba por Canal ativo, não por tipo, e a
lista da Caixa de Entrada mostra ícone e nome do Canal em cada item, com o
filtro `?canal=` pelo rótulo "nome · provedor". Nenhum componente do chat ou
das páginas de Canal renderiza HTML cru.

## Monitoramento de erros (Fase 9)

`@sentry/nextjs` (versão exata, a mesma do `@sentry/node` da api) registra o
erro de render e de servidor, e só ele. `src/instrumentation.ts` inicia o SDK
no servidor do Next (`register()`, só no ramo `nodejs`, só com `SENTRY_DSN`) e
entrega `onRequestError`; `src/instrumentation-client.ts` faz o mesmo no
navegador (só com `NEXT_PUBLIC_SENTRY_DSN`); `src/app/global-error.tsx` é a
fronteira de erro do root layout e captura o erro uma vez. Sem DSN o SDK nem
inicia e a web roda como sempre rodou.

Tudo que o Sentry recebe passa por `features/observabilidade/limpar-evento.ts`:
nada de corpo, cabeçalho (nem `Referer`), cookie, query nem e-mail do usuário, e
o segredo de `/f/<segredo>` e `/p/<segredo>` vira `***` com
`mascararSegredoDeUrl` do domínio (a mesma regra do log e do Sentry da api,
que não se importam). Sem tracing, sem Session Replay. O `next.config.ts` usa
`withSentryConfig` de `@sentry/nextjs/config` com `telemetry: false` e
`sourcemaps: { disable: true }`: o build não usa rede nem token; ligar source
maps é outro passo, com `SENTRY_AUTH_TOKEN` na Vercel.

## Regras de estilo

Cor só sai de `src/estilos/tokens.css`. `npm run verificar:tokens` falha se
alguém escrever um hex direto no componente, com poucas exceções já registradas
no próprio script.
