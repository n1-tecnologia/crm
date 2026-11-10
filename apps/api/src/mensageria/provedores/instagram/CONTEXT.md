# Instagram — o provedor `instagram-graph`

Ler primeiro: [`../../../../../../CONTEXT.md`](../../../../../../CONTEXT.md), [`../../CONTEXT.md`](../../CONTEXT.md) (a
mensageria) e a Sessão 8 de `docs/09-planejamento/TAREFAS-POR-SESSAO.md`.

O Direct de uma conta profissional do Instagram entra e sai pela Caixa de Entrada como qualquer provedor da mensageria:
o Instagram é um `ProvedorDeMensageria` (`provedor.ts`), registrado em `../../registro.ts`. A entrada passa pela fila
`plataforma.webhooks_recebidos` e por `receberMensagem`; a saída, pelo outbox (`mensagem.enviar.v1`) e pelo worker de
saída. É a "API do Instagram com login do Instagram" (decisão 8.2.1, opção A): a pessoa entra com a conta do Instagram,
sem Página do Facebook. As permissões são as duas da Revisão do app: `instagram_business_basic` e
`instagram_business_manage_messages`.

## O caminho

| Passo | Quem | Onde |
|---|---|---|
| 1. Criar o Canal com o @ da conta | tela | `canais/conectar/instagram-graph` → `POST /canais` |
| 2. "Conectar com o Instagram" | tela → api | `POST /canais/:id/instagram/autorizar` devolve a URL do login, com `state` assinado (`estado.ts`) |
| 3. Login e autorização | Meta | `www.instagram.com/oauth/authorize` |
| 4. Volta | Meta → **web** | `INSTAGRAM_REDIRECT_URI` = `…/crm/caixa-de-entrada/configuracoes/canais/instagram/retorno` |
| 5. Concluir | web → api | `POST /canais/instagram/concluir` (`conexao.ts`): troca o código, token de 60 dias, lê a conta, confere o @, inscreve no webhook (`messages`) e, numa transação, guarda a credencial, a conta, `proximaConexao(canal, "conexao_confirmada")` e reenfileira as `pendente` (B69), como `canal:ligar-evolution` |
| 6. Direct chega | Meta → api | `POST /webhooks/meta/instagram` (`../../../rotas/webhook-meta.ts` → `entrada.ts`): acha o Canal pela conta, `verificarChamada`, uma linha `pendente` por evento na fila, 200, acorda o processador |
| 7. Quem escreveu | processador | `resolverRemetente` troca o IGSID pelo @ do perfil (`instagram_remetentes`), e `receberMensagem` acha ou cria o Contato por esse @, decide a Conversa (`destinoDaRecebida`, RN-CON-13) e avisa o tempo real |
| 8. Resposta | tela → outbox → Meta | `POST /mensagens` nasce `pendente` e grava `mensagem.enviar.v1`; o worker de saída chama `enviar`, que responde ao IGSID de quem tem o @ |
| 9. Lida | Meta → fila | o evento `read` vira `status` `lida` (`atualizarStatusDeEntrega`, que nunca regride) |
| 10. Desconectar/arquivar | tela → api | apaga a conta ligada, quem escreveu e a credencial (não só revoga) |
| 11. Tirou o acesso / pediu exclusão | Meta → api | `/webhooks/meta/instagram/desautorizar` e `/exclusao-de-dados` (`desautorizacao.ts`) |

A volta do login cai na WEB, não na api, de propósito: a página está logada e chama `concluir` com o token da sessão, e o
serviço confere que o Membro e o Espaço do `state` são os da sessão. Isso impede alguém de ligar a conta dele a um Canal
de outra pessoa com um link de retorno pronto.

## Por que a rota é a da Meta, e não `/webhooks/mensageria/:canalId`

A Meta chama UM endereço para todas as contas do app. Então `entrada.ts` faz, para cada `entry` do corpo, o que a rota
por Canal faz para uma chamada: acha o Canal só pela conta (`entry[].id` → `instagram_contas`, índice global; o Espaço vem
da linha do Canal), resolve o provedor pelo Canal (`provedorDoCanal`), confere a chamada INTEIRA com ele e grava cada item
(`messaging[]`, ou `changes[]` do botão "Testar" do painel) como uma linha da fila, com o `mid` como chave. Conta sem
Canal, Canal arquivado ou simulado e provedor não ligado só contam. Nada é interpretado na requisição.

`verificarChamada` confere a assinatura da Meta sobre o corpo cru (`X-Hub-Signature-256`, com `INSTAGRAM_APP_SECRET` ou,
se existir, `META_APP_SECRET`) E que o corpo tem um `entry` da conta DESTE Canal: a assinatura certa com a conta de outro
Canal recebe a mesma recusa (o equivalente da instância da Evolution, T-16-43). Não há segredo por Canal: a chave é do app.

## Quem escreveu: `resolverRemetente` (o único passo novo na interface)

O webhook do Instagram nunca traz o @, só o IGSID (um id de quem escreveu, próprio de cada conta conectada). O tradutor
(`traduzir.ts`) entrega o remetente como `igsid:<IGSID>`; o processador de entrada chama `resolverRemetente` antes de
`receberMensagem`, fora da transação, como a mídia. Ele lê o perfil (`/{igsid}?fields=name,username,profile_pic`) e
guarda o @ (forma canônica, `normalizarInstagram`) e o nome em `instagram_remetentes`, relido depois de 24 h. Com a Meta
fora do ar, vale o guardado; sem nada guardado, lança, e a linha volta à fila na escada de `backoff()` (até a 8ª). O
prefixo `igsid:` tem `:`, que `normalizarInstagram` recusa: um IGSID que escapasse da troca seria recusado, nunca viraria
o @ de alguém.

Decisão 8.3.1: o plano oferecia guardar o IGSID num tipo novo de Identificador (A) ou no próprio tipo `instagram` (B).
Ficou uma terceira forma: a tabela do provedor. O Contato recebe o Identificador `instagram` normal, com o @, por
`receberMensagem`; o check de tipos da 007, `TIPO_DE_IDENTIFICADOR_DO_CANAL` e as telas do Contato não mudaram.

## A saída: `enviar`

O entregador escolhe o destino (`identificadorDeResposta`: o @ por onde o Contato escreveu). O provedor acha o IGSID de
quem tem esse @ nesta conta e chama `POST /{conta}/messages`. Os desfechos seguem a regra da Fase 16:

| A Meta | Resultado |
|---|---|
| `message_id` | `ok`, `enviada` com o id |
| conexão recusada, 429, códigos de limite (4, 17, 32, 613), 502, 503, 504, falha antes do pedido | `transitorio`: volta à fila |
| tempo esgotado, resposta perdida, 500, aceite sem `message_id` | `ambiguo`: `falhou` "Sem confirmação…", só a pessoa reenvia |
| 190 (token) | recusa: conectar de novo |
| 10 / 2018278 (fora da janela) | recusa com `fraseDaJanelaBloqueada(24)` |
| sem IGSID para o @ | recusa com `FRASE_SEM_IGSID` |

Um anexo (imagem, vídeo ou áudio; `sendableMediaTypes` do Instagram) sai pela URL assinada do bucket, que a Meta baixa.
Com texto junto, saem duas mensagens; o texto que não se confirma depois do arquivo é `ambiguo`. Documento é recusado.

## A mídia recebida: `baixarMidia`

`image`, `video`, `audio` e `file` do webhook viram anexo com a URL da Meta como referência. `midia.ts` só segue `https`
nos hosts da Meta (`*.fbsbx.com`, `*.cdninstagram.com`, `*.fbcdn.net`), confere cada redirecionamento de novo, corta no
teto (no `content-length` e em fluxo) e nunca manda o token para a CDN. A guarda de mídia (`../../midia.ts`) confere o
tipo e a assinatura do arquivo e sobe para o bucket, como para a Evolution.

## Onde mora cada coisa

| Dado | Onde |
|---|---|
| A credencial `{ contaId, token, expiraEm, obtidoEm }` | `plataforma.credenciais`, `tipo = "instagram-graph"`, cifrada (009). É o que `canalParaProvedor` decifra e `ligadoAoProvedor` (CR-01) enxerga. Nunca em log, erro ou resposta |
| A conta ligada ao Canal | `plataforma.instagram_contas` (014). `conta_id` é o `entry[].id` do webhook; o índice é GLOBAL: uma conta, um Canal |
| IGSID → @ e nome | `plataforma.instagram_remetentes` (014) |
| O @ de quem escreveu | o Identificador `instagram` do Contato, como qualquer @ digitado |
| A chamada da Meta | `plataforma.webhooks_recebidos` (013), um item por linha |

O token é renovado de forma preguiçosa (`token.ts`): quem o usa renova quando faltam 7 dias e grava a credencial nova
numa transação própria. Canal parado por 60 dias perde a autorização; a ficha (`conta`) o deixa `com_erro`.

## A regra da janela (8.3.4)

`ChannelCapabilities.foraDaJanela` substituiu o booleano `requiresTemplateOutsideWindow`: `livre`, `soModelo` (WhatsApp
oficial) e `bloqueado` (Instagram). No `bloqueado`, antes da primeira mensagem do Contato ou depois de 24 h, nada sai, e
a frase diz que só ele reabre (`FRASE_SO_RESPONDE`, `fraseDaJanelaBloqueada`). Abrir Conversa do Instagram pela
plataforma é recusado (`CANAL_SO_RESPONDE`): ela nasce quando o Contato escreve.

## Variáveis do `api.env`

| Variável | O quê |
|---|---|
| `INSTAGRAM_APP_ID` | "ID do app do Instagram" (painel › Instagram › Configuração da API com login do Instagram) |
| `INSTAGRAM_APP_SECRET` | "Chave secreta do app do Instagram". Também confere a assinatura do webhook e dos avisos |
| `INSTAGRAM_REDIRECT_URI` | a página de retorno da web, igual, letra por letra, à cadastrada no painel |
| `INSTAGRAM_GRAPH_VERSAO` | opcional; padrão `v24.0` |
| `META_WEBHOOK_VERIFY_TOKEN` | o token de verificação do webhook (já existia) |
| `COFRE_CHAVE`, `COFRE_CHAVE_VERSAO` | o cofre (009): sem eles, `concluir` responde 503 e não conecta |
| `MENSAGERIA_WORKER_ATIVO=true` | **sem ela, nada entra nem sai**: é a variável que liga o processador de entrada e o worker de saída (Fase 16) |

Sem as três primeiras, o provedor não é registrado: o botão responde 503 dizendo o que falta, o webhook só escuta, e um
Canal real `instagram-graph` não tem provedor (a Mensagem não é dada como enviada, MSG-05).

## No painel do app da Meta

Em Instagram › Configuração da API com login do Instagram:

1. **Login empresarial** › URIs de redirecionamento do OAuth: o mesmo valor de `INSTAGRAM_REDIRECT_URI`.
2. **URL de cancelamento da autorização**: `https://<api>/webhooks/meta/instagram/desautorizar`.
3. **URL de solicitação de exclusão de dados**: `https://<api>/webhooks/meta/instagram/exclusao-de-dados`.
4. **Webhooks**: URL `https://<api>/webhooks/meta/instagram`, token = `META_WEBHOOK_VERIFY_TOKEN`; assinar o campo `messages`.
5. A conta de teste precisa ter, no aplicativo do Instagram, o acesso de ferramentas conectadas às mensagens ligado.

`<api>` é o endereço público do `apps/api` (hoje `crm-n1-api.85.155.186.214.nip.io`).

## O que ainda não faz

- **O que a conta manda pelo aplicativo do Instagram** (o eco, `is_echo`) é `ignorado:eco`, como o `fromMe` da
  Evolution: a resposta dada pelo celular não aparece no fio. Gravar a enviada que vem do provedor é uma porta nova
  da mensageria, da Sessão 4.
- **Reações, edições, postback e referral** chegam e ficam `ignorado:<motivo>` na fila.
- **Perfil que a Meta não entrega** (sem @): a linha tenta até a 8ª vez e fica `falhou`; a Mensagem não entra.
- **Renovação do token por rotina.** É preguiçosa (ver acima).
- **Etiqueta `HUMAN_AGENT`** (responder até 7 dias depois): fora desta sessão.
- **Nada rodou contra a Meta real**: os testes usam o servidor falso e um cliente falso.

## Testes

- `provedor.test.ts`: o conjunto de contrato (`descreverContratoDoProvedor`) e o que só o Instagram tem, contra o
  servidor falso (Graph e CDN). Sem banco.
- `instagram.test.ts`: o roteiro inteiro contra o Postgres local (conectar, webhook → fila → processador, outbox →
  worker de saída, leitura, desconectar e desautorização), com a Meta trocada por um cliente falso.
- `cliente.test.ts`: o HTTP de cada pedido contra o servidor falso.
