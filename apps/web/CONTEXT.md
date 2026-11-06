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
guarda a sessão e dois `DataState` — `confirmado` e `data` — e expõe `run()`,
que executa uma operação do domínio e incrementa a revisão para os assinantes
recalcularem.

A troca da memória por chamadas ao backend aconteceu nesse arquivo — e só
nele: nenhum componente mudou. `store.ts` hidrata do `apps/api` (`GET
/estado`, chamado no Server Component da casca por `dados/estado-inicial.ts`)
e grava por `POST /operacoes/:nome` (`dados/transporte.ts`). `NEXT_PUBLIC_API_URL`
é a única configuração nova que a tela precisa. As rotas públicas
(`/f/<segredo>`, `/p/<segredo>`) continuam em memória, com o seed do produto,
até OQ-PF-01 decidir em nome de quem uma resposta anônima age.

**Os dois estados (Fase 12, D-13).** `confirmado` é o que o servidor já
devolveu: só ele recebe as diferenças (`aplicarDiferenca`) e é dono das
`ordens`. `data` é o que a tela mostra: o `confirmado` com, por cima, as
gravações que o servidor ainda não respondeu. `run()` é híbrido (D-05): clona
`data`, roda a operação na cópia — uma recusa do domínio aparece na hora, sem
nenhuma requisição — e, se a cópia aceita, ela vira o `data` na hora e a
chamada gravada segue para o servidor. Sem nenhuma gravação a caminho, `data` e
`confirmado` são o MESMO objeto (nenhuma cópia a mais); o clone extra só
existe enquanto sobra gravação na fila. Uma cópia que aceita sem registrar
chamada alguma não vira `data` (seria mostrar uma mudança que nunca vai ao
servidor).

**O que espera o servidor (D-13).** `src/dados/operacoes-que-esperam.ts` lista,
com o motivo de cada uma, as operações cujo resultado local não é o que o
servidor grava: segredo de link, JID, link de convite e chave pública (valor
aleatório ou de contador gerado na operação), `inviteMember` (resolução só do
servidor) e as rotinas que o agendador também roda. Um gesto com QUALQUER
chamada da lista não vira `data` na hora e só aparece quando a diferença volta,
com o valor do servidor; o resto aparece na hora. A lista é regra de tela (por
isso mora aqui, não no domínio), é um conjunto fechado por teste e tem o
levantamento em `.planning/phases/12-*/12-PROVAS.md`. Operação nova que gere um
valor desse tipo entra na lista junto com o teste.

**Um pedido por vez (D-16).** As gravações de um store saem em fila, na ordem
do clique: o primeiro pedido sai na hora, os seguintes esperam a resposta do
anterior e levam a revisão que ela devolveu. Cada resposta é aplicada em
`confirmado`; as gravações que ainda esperam são refeitas por cima, pelo
registro `OPERACOES` do domínio, para dar o novo `data`. `rehidratar()`, quando
chamado de fora (`useRehidratar`, `verificarRevisao`), entra na mesma fila:
espera o pedido em voo responder antes de buscar `GET /estado`, para não refazer
o que o servidor já gravou. `pendentes` conta as gravações na fila, e
`verificarRevisao` não pergunta nada enquanto houver uma.

**Quando o servidor diz não (D-14).** Recusa, falha, conflito (409) e erro de
corpo tiram a gravação: `data` volta a ser o `confirmado` mais o que sobrou na
fila, e o erro aparece pelo canal de sempre, `lastResult`, com a mensagem do
servidor — sem botão "Tentar de novo". Uma gravação que depende da recusada (renomear
a Lista que não chegou a existir) falha ao ser refeita, sai com o erro e nunca é
enviada. Revisão defasada ou conflito re-hidratam por `GET /estado` em vez de
aplicar diferença parcial (D-06, D-12). Quem navega para um registro recém-criado
usa o resultado de `runConfirmado(...).confirmado`, não `local.value`: o `local`
é um objeto vivo dentro do `data` e fica velho depois da reconstrução.

**Pendente, "salvando" e a guarda (D-15).** O que aparece antes de gravado tem um
id que o servidor ainda não confirmou, e esse id pode não ser o que ele vai dar.
"Pendente" é DERIVADO, nunca guardado: o id que está em `data` e ainda não está em
`confirmado` (`idsNaoConfirmados`; com `data === confirmado` é o conjunto vazio,
sem varrer nada; `useIdsNaoConfirmados` é a versão para componente). Nenhum lugar
leva a um id pendente: a árvore desenha o Espaço, a Pasta e a Lista novos como
linha "salvando" (sem link, `aria-busy`, sem "+", "⋯" nem arrastar), `openTask`
ignora id pendente, a linha da Tarefa e a Subtarefa novas não abrem, e o diálogo
de criação só navega pelo id que `runConfirmado` devolve. Para o resto das telas,
sem editar nenhuma, a **guarda de navegação** (`dados/guarda-de-navegacao.ts`,
instalada por `StoreProvider`) cancela, na captura do `document`, o clique, o
clique do meio, o cmd/ctrl+clique e o Enter numa âncora cujo endereço carrega um
id pendente — por igualdade inteira de segmento ou de valor de parâmetro, só na
mesma origem —, marca a âncora com `aria-busy` e a solta quando o id é
confirmado. Fora dessa janela ela não toca em nada. Um `router.push` direto para
um id recém-criado não passa por ela: ele precisa usar o id de `runConfirmado`.
E o que espera o servidor (`dados/operacoes-que-esperam.ts`, acima) nem aparece
antes de confirmado, então não chega a ser pendente.

**Fechar a aba com gravação pendente.** Com `pendentes > 0`, o `beforeunload`
(`deveAvisarAoSair`) pede confirmação ao fechar a aba, recarregar ou sair para
outro site; sem pendentes a aba fecha sem perguntar. Navegar dentro do app pelo
App Router não descarrega a página e não dispara o aviso.

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

**A ficha nova de Contato (Fase 14).** `features/crm/ficha-de-contato.tsx` ganhou
as seções Notas (`notas-do-contato.tsx`, de `GET`/`POST /contatos/:id/notas`) e
Consentimentos (`consentimentos-do-contato.tsx`, de `.../consentimentos`), cada
uma com o cliente próprio em `dados/crm/` (`notas.ts`, `consentimentos.ts`) e a
chave SWR `/contatos/<id>/notas` ou `/consentimentos`, revalidada só para aquele
Contato. O vigente por finalidade e tipo de Canal a tela calcula com
`consentimentoVigente` do domínio sobre o histórico que a api devolve (o
histórico é só inserção: revogar é registrar um `revogado`); as finalidades do
formulário são os itens `finalidadeConsentimento` do Catálogo, a única leitura
do store nessas seções (o Catálogo continua em `registros`, OQ7). "Mesclar com…"
(`mesclar-contato-dialog.tsx`, `mesclarContatos(sobrevivente, absorvido)`: o
Contato da ficha é o sobrevivente) e "Transferir" por Identificador
(`transferir-identificador-dialog.tsx`) são as versões sobre a api dos diálogos
antigos, que leem o store antigo e ficam para a ficha antiga até o corte; a
recusa 409 da api aparece dentro do diálogo, que continua aberto, e as duas
ações ficam desligadas pelo Papel (`usePodeNoCrm`) e, a mesclagem, também pela
lixeira. Nenhuma tela antiga muda: a ficha nova é a única tela da Fase 14 (OQ8).

**A Tarefa conversacional sobre as tabelas (Fase 14, 14-15 e 14-16, só no deploy da
Fase 15).** `dados/crm/tarefas-conversacionais.ts` fala com
`/tarefas-conversacionais` em duas metades. Leitura: `useResumoDasTarefas`,
`ProvedorDoResumoDasTarefas` e `useResumoDaTarefa` pedem Contato, Canal, última
Mensagem e Negócio de toda a Lista numa chamada só (lotes de 200); a chave SWR é
um array com os ids de cada Tarefa, então `invalidarCrm` não a alcança. Escrita:
`criarTarefaConversacional`, `trocarCanalDaTarefa`, `vincularNegocioATarefa`,
`criarNegocioDaTarefa` e `conversaAbertaDoPar` (com o hook
`useConversaAbertaDoPar`), que mandam só ids e a primeira Mensagem. A tela chama
`rehidratar()` do store DEPOIS de cada sucesso (A5): o `GET /estado` traz a Tarefa
nova ou alterada e nada é aplicado à mão no store; a recusa da api sobe como
`ErroDeApi` e fica dentro do diálogo. D-07: o campo "Primeira Mensagem" do
diálogo de nova Tarefa e do diálogo de trocar o Canal só aparece quando o Contato
não tem Conversa aberta no Canal. Os chamadores são o diálogo da Lista
(`nova-tarefa-conversacional-dialog.tsx`), o botão "Criar Tarefa" do fio
(`conversation-thread.tsx`) e os três gestos da ficha (`tarefa-completa.tsx`);
nenhum chama mais as operações antigas. O fio e o layout de três colunas da ficha
ainda leem o Contato e o Canal do modelo antigo até a Caixa nova (Fase 15). Como
as Tarefas e as Conversas de hoje ainda apontam para ids antigos, estas telas só
vão ao ar junto com o script de migração da Fase 15. A prévia da remoção de um
Membro (`dados/crm/sucessao.ts`, `useSucessaoNoCrm`) lê Contatos, Empresas,
Negócios e Conversas de `GET /membros/:id/sucessao-no-crm`, com o tipo
`SucessaoNoCrm` de `@n1/dominio/crm/sucessao` (a web não declara a forma por
conta própria). Desde a D-15-08 as Conversas que ele atendia não são liberadas:
`conversasPassadas` passa ao Sucessor como Atribuído, e a contagem fica no grupo
"Passa ao Sucessor" do diálogo. Agentes, Automações e o resto continuam de
`previewSuccession`; o que fica sem Responsável são só Tarefas e itens de
Checklist. A linha do tempo do CRM novo (15-37, D-15-09) é lida por
`dados/crm/atividades.ts`: `useAtividades({ tipo, id })` junta `state.activity` do
objeto (modelo antigo, já hidratado) com `GET /atividades` e ordena por `at`
decrescente, sem repetir id; `useAtividadesDoCrm(filtro)` lê só a rota, sem
objeto, para a Auditoria. Só leitura: quem grava a Atividade é cada gesto, no
servidor. `src/sem-listas-espelho.test.ts`
(D-06) congela os dois arquivos da web que ainda citam as Listas espelho e proíbe
um terceiro.

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
| Busca global (`/buscar`) | `memberSeesTask` nas Tarefas, `memberReachesContainer` nas Listas; Contatos, Empresas, Negócios e Conversas vêm da api (`?q=`, 15-14) |
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

**Limitação aceita (D-15).** `/crm/meus-negocios` e a Caixa de Entrada ainda
leem o modelo antigo do CRM (`state.contacts`, `state.companies`, `state.deals`,
`state.pipelines` do `DataState`) e **não mostram os registros da api nova**. A
Busca global (`/buscar`), a Lixeira (`/configuracoes/lixeira`) e as Notificações
(inclusive o selo da barra e do trilho) saíram desse grupo no plano 15-14
(UCR-07): Contatos, Empresas, Negócios e Conversas vêm das rotas REST
(`useContatos`/`useEmpresas`/`useNegocios`/`useConversas`, com `?q=` na Busca e
`estado=na_lixeira` na Lixeira; restaurar é `POST /<recurso>/:id/restaurar`), e o
hook `features/shell/use-notificacoes.ts` (`useNotificacoesDoMembro`) soma o
`total` de `GET /conversas?atribuidoId=<Membro>&situacao=aberta|pendente` ao que
`notificacoesDoMembro` deriva do store. A Busca de Conversa é pelo título (a rota
não olha o texto das Mensagens). As fichas de Contato
(`/crm/contatos/[contato]`), Empresa (`/crm/empresas/[empresa]`) e Negócio
(`/crm/negocios/[negocio]`) **não têm mais recuo** (Fase 15, plano 15-13,
UCR-06): um 404 da api mostra "Contato/Empresa/Negócio não encontrado(a)." mesmo
quando o id existe no `DataState`, e não há ponte de id antigo para id novo. Com
a migração, que preserva os ids, o mesmo endereço passa a abrir a ficha nova.
`features/crm/legado/` deixou de existir; `deal-screen.tsx` segue só porque a
Lista conversacional ainda a embute e sai no plano 15-40.

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

**A lista da Caixa pelo CRM novo (Fase 15, 15-11).** `InboxColumns` não lê mais
Contato nem Canal do `DataState`: a lista vem de `useConversas`
(`GET /conversas`, `plataforma.conversas`) e o Canal de `useCanais`. O escopo
Minhas é `atribuidoId` do Membro; a aba Não lidos é `naoLidas=true` e
Marcados `comEstrela=true`; estado, Canal e Fila viram `situacao`, `canalId` e
`filaId`. Sem Atribuído, Sem Fila e Adiadas a api ainda não filtra: a tela pede
a página inteira (200) e recorta (o total desses recortes é o da página). Os
contadores são o `total` da api. A estrela é `marcarConversa`
(`PUT /conversas/:id/marcacao`), uma gravação por vez por Conversa, e a recusa
desfaz o que a tela mostrava. A janela de resposta sai de
`capacidadesDoCanal` e de `ConversaNaLista.ultimaRecebidaEm`. A Conversa de
Grupo segue em `state.conversations` (F14-D-05): entra na lista e na contagem
do topo, e a estrela dela ainda é a operação antiga.

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

**Configurações da Caixa, Fila, Canal e o popup das Listas pelo CRM novo (Fase 15,
15-12).** A ficha do Canal (`configuracoes/canais/[canal]`) lê `GET /canais/:id`
por `useCanal` e salva por `PATCH /canais/:id` (`editarCanal`); um id que a api
não conhece (404) é "Canal não encontrado.", e o Canal do seed (demo) já não tem
ficha nem a operação antiga `configurarCanal`. A seção "Mensagens de modelo" da
ficha fica sempre vazia: a tabela `plataforma.canais` não guarda modelos
(só o seed os tinha). O número de Conversas do Canal é o `total` de
`GET /conversas?canalId=`. A página da Fila lista as Conversas por
`useConversas({ filaId })` e mostra o `total`, nunca o tamanho da página; a carga
de cada Membro elegível é `useConversas({ filaId, atribuidoId, situacao: "aberta",
limite: 1 })`; os Canais da Fila são os de `useCanais` com `filaPadraoId` igual.
As Configurações da Caixa listam Canais ativos e arquivados de `GET /canais` e
contam as Conversas de cada Fila pelo `total`. A Caixa e a Fila (elegíveis,
distribuição, horário) seguem no store: são configuração do Espaço. O popup
"Adicionar Canal" das Listas conversacionais (`features/crm/adicionar-canal-dialog.tsx`)
não cria Canal (D-15-12): lista os Canais ativos de `useCanais` que a Lista ainda
não usa, devolve o id escolhido em `onEscolher` e tem o link "Conectar um Canal
novo" para a página de conectar, o único caminho que cria Canal (nasce
`desconectada`); a seção de Canais de atendimento (`canais-de-atendimento.tsx`)
também lê `useCanais`.
