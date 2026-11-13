# provedores/whatsapp-cloud

O `ProvedorDeMensageria` do Canal `whatsapp-cloud` (WhatsApp oficial, a Cloud API da Meta), Sessão 7, itens 7.2 e 7.3 (modelos
de mensagem). Segue o desenho do Instagram (`../instagram/`): o mesmo contrato, a mesma fila de entrada e o
mesmo outbox de saída. **Só as leituras falaram com a Meta real**: em 2026-11-13 a fumaça (abaixo) leu o número e a lista de modelos do número de
teste da Meta (Graph v26.0) e os dois vieram no formato assumido. Todo o resto (enviar, o webhook, a mídia, o aviso de modelo) foi
provado contra um servidor falso e um cliente falso, e os nomes dos campos e os códigos de erro seguem a documentação da Cloud API.

## O caminho de uma mensagem

| Passo | Quem | O que faz |
|---|---|---|
| 1. Conectar | `conexao.ts` (`POST /canais/:id/whatsapp-oficial/conectar`) | recebe `{ phoneNumberId, wabaId, token }`, lê o número na Meta (`dadosDoNumero`), confere que é o do Canal (`conferirNumeroConectado`), inscreve o app na conta (`subscribed_apps`), guarda a credencial cifrada e liga o número, tudo numa transação que também deixa o Canal `conectada` |
| 2. Mensagem chega | Meta → api | `POST /webhooks/meta/whatsapp` (`../../../rotas/webhook-meta.ts` → `entrada.ts`): acha o Canal pelo `metadata.phone_number_id`, `verificarChamada`, uma linha `pendente` por mensagem ou status na fila, 200, acorda o processador |
| 3. Vira Mensagem | processador de entrada | `interpretarChamada` (`traduzir.ts`) e `receberMensagem`; o status vira `enviada`/`entregue`/`lida`/`falhou` por `proximoStatusDeEntrega` |
| 4. Resposta | tela → outbox → Meta | `POST /mensagens` nasce `pendente` e grava `mensagem.enviar.v1`; o worker de saída chama `enviar`, que responde ao número do Contato |

## A credencial e o número

A credencial do Canal é o JSON `{ phoneNumberId, wabaId, token }` no cofre, com `tipo = "whatsapp-cloud"` (o nome do
provedor: é o que `canalParaProvedor` decifra e o que esconde "Simular conexão"). O token é permanente (usuário do
sistema): não há renovação. `plataforma.whatsapp_cloud_numeros` (migração `015`) liga o `phone_number_id` ao Canal com
índice único GLOBAL, porque a Meta chama um endereço só e o webhook não conhece o Espaço. Desconectar e arquivar apagam a
linha e a credencial do cofre.

**O token nunca volta da api**, não vai a log, a erro nem a resposta. Chega uma vez no corpo do `conectar` e vai ao cofre.

## O webhook

A Meta assina o corpo CRU com a chave secreta do app (`X-Hub-Signature-256`, `META_APP_SECRET`); não há segredo por
Canal. `verificarChamada` exige a assinatura certa **e** o número deste Canal no corpo: o corpo do número de outro Canal
recebe a mesma recusa. A rota **não loga o corpo** (tem número de telefone e texto de terceiros) nem quando só escuta.
Só o campo `messages` entra na fila; `message_template_status_update` e `template_category_update` disparam a sincronização
dos modelos da conta (7.3.2), não viram Mensagem.

O tradutor (`traduzir.ts`, puro) entende texto, imagem, áudio, vídeo, documento, figurinha, localização, contato
compartilhado, resposta de botão e de lista, citação (`context.id`) e reação. A mídia chega por ID, não por URL: o ID é a
`referenciaNoProvedor`, e `baixarMidia` troca o ID pelo endereço temporário com o token do Canal (o token vai SÓ no
primeiro pedido, nunca no redirecionamento para a CDN; ver `../instagram/midia.ts`). A resposta de um Flow (`nfm_reply`)
fica `ignorado` até a 7.4.

## O envio

Texto, imagem, vídeo, áudio e documento (por URL assinada do bucket) e Mensagem de modelo (`EnvioAoProvedor.modelo`, que
leva o `nome` do modelo na Meta, o idioma e as variáveis do corpo). O áudio não leva legenda: com texto junto, saem duas
mensagens, e o texto que não se confirma depois do áudio é `ambiguo` (nunca reenvia o áudio). O desfecho de cada erro da
Meta:

- certamente não saiu → `transitorio` (volta à fila): conexão recusada, os limites (`4`, `17`, `32`, `613`, `80007`,
  `130429`, `131056`, HTTP 429) e 502, 503, 504;
- pode ter saído → `ambiguo` (nunca reenviado sozinho): tempo esgotado, resposta perdida, aceite sem id e 500;
- recusa definitiva: token vencido (`190`), fora da janela de 24 h (`131047`, a frase diz que só modelo aprovado sai),
  número fora da lista da conta de teste (`131030`), número sem WhatsApp (`131026`) e modelo recusado (`132000`...).

## A regra da janela (7.2.6) e os modelos (7.3)

O WhatsApp oficial é `foraDaJanela: "soModelo"`: fora das 24 h, **e antes da primeira mensagem do Contato**, só sai
Mensagem de modelo aprovada. `validarEnvio` (domínio) aplica isso a uma Mensagem em Conversa que já existe
(`servicos/crm/mensagens.ts`), e `abrirConversaNoCliente` aplica a mesma regra a uma Conversa NOVA pela plataforma
(`conversas.criar`, a primeira mensagem da Tarefa conversacional). Os dois escolhem o modelo pelo mesmo auxiliar
(`servicos/crm/modelo-do-envio.ts`). Sem modelo escolhido a recusa é 409 `JANELA_EXPIRADA`, campo `modelo`, ANTES de gravar, e
traz `modelos`: os que dá para escolher (aprovados e enviáveis). Um modelo que não é do Canal, não está aprovado ou o CRM ainda
não sabe preencher é 409 `MODELO_INDISPONIVEL`; variáveis erradas são 400 no campo `variaveis`; o de marketing exige o
consentimento do Contato (3.2.4), também ao abrir. A Conversa que já existe vence: abrir de novo é `CONVERSA_JA_ABERTA`.

## Os modelos de mensagem (7.3)

O modelo é criado e aprovado na Meta (Gerenciador do WhatsApp); o CRM o **sincroniza** (decisão 7.3.3, opção A: criar
pela plataforma, opção B, ainda não existe). `plataforma.modelos_de_mensagem` (migração `016`) guarda uma linha por
(Canal, nome, idioma), com os `componentes` no formato da Meta e o estado traduzido (`aprovado`, `pendente`, `rejeitado`,
`pausado`, `desativado`). As regras puras (variáveis `{{n}}`, o que o CRM sabe preencher, o texto final) são do domínio
(`@n1/dominio/crm/modelos`): **só se envia** corpo com variáveis de texto, cabeçalho de texto sem variável, rodapé e botões
fixos; cabeçalho de mídia, variável em botão ou no cabeçalho, autenticação e os formatos novos ficam na lista com o motivo.

| Quando sincroniza | Quem |
|---|---|
| ao conectar | `conexao.ts`, depois da transação, sem derrubar a conexão se a Meta falhar |
| botão "Sincronizar" da ficha | `POST /canais/:id/modelos/sincronizar` (só quem conecta o Canal) |
| a Meta avisa (`message_template_status_update`, `template_category_update`) | `rotas/webhook-meta.ts` → `sincronizacao.ts` (`daConta`); só com a assinatura conferida, e a resposta nunca espera |
| de hora em hora | `sincronizacao.ts` (`deTodos`), só com `WHATSAPP_MODELOS_SINCRONIZACAO_ATIVA=true`, com trava consultiva |

A sincronização lê ANTES de gravar: se a Meta falha, nada é apagado. Ela deixa o Canal com exatamente o que a Meta tem
(cria, atualiza por nome e idioma mantendo o `id`, apaga o que sumiu). Desconectar o número NÃO apaga os modelos (são da
conta do WhatsApp Business). A Mensagem de modelo grava o texto já preenchido em `conteudo` e `modelo_usado` com o id, o nome,
o idioma e as variáveis; a entrega os lê para montar `EnvioAoProvedor.modelo`. Lista: `GET /canais/:id/modelos`.

## O que falta (ver o plano, Sessão 7)

Cliente `subirMidia` (o envio de mídia usa link, não upload), `marcarComoLida` ligado a algo, modelo com cabeçalho de mídia
ou variável em botão (hoje listado, não enviável), criar modelo pela plataforma (7.3.3 opção B), a tabela de respostas de Flow
e os Flows (7.4, dependem da Sessão 6) e o Embedded Signup (7.2.1 opção B). O time decidiu em 2026-11-13: token colado à mão e só
sincronizar modelos, então a 7.2.1 opção B e a 7.3.3 opção B só voltam se isso mudar.

## A fumaça da primeira conexão

`npm run whatsapp-oficial:fumaca -w @n1/api` (`src/bootstrap/whatsapp-oficial-fumaca.ts`) é a prova que falta: com o token de verdade,
lê o número e a lista de modelos da Graph API (só leitura; `--inscrever` liga o único passo que escreve) e diz, em fatos curtos,
se a Meta respondeu como o código assume. **Falha se um modelo vier sem corpo** (o formato dos componentes não é o assumido). A
saída nunca leva o token, os IDs, o número inteiro nem o texto de um modelo. O roteiro da primeira conexão está em
`apps/api/deploy/CONTEXT.md`.

## Mapa dos arquivos

| Arquivo | O que é |
|---|---|
| `configuracao.ts` | `META_APP_SECRET` (obrigatória) e `META_GRAPH_VERSAO` (opcional, `v26.0`, a versão do app) |
| `cliente.ts` | a Graph API: enviar texto, mídia e modelo, marcar como lida, dados do número, inscrever o app, ler mídia |
| `traduzir.ts` | o webhook em `EventoDoProvedor`, puro; `corpoDeUmItem` e `chaveDoItem` para a fila |
| `provedor.ts` | `criarProvedorWhatsAppCloud`: `verificarChamada`, `interpretarChamada`, `enviar`, `baixarMidia`, `estadoDaConexao` |
| `entrada.ts` | a entrada na fila: o Canal pelo número, a conferência e uma linha por item |
| `conexao.ts` | conectar pelo token, ler o número para a ficha, listar e sincronizar os modelos |
| `modelos.ts` | a tradução do modelo da Meta para o do CRM e `sincronizarModelos` |
| `sincronizacao.ts` | quem e quando sincroniza: o aviso da Meta e a rodada de hora em hora |
| `repositorio.ts` | o número conectado, a credencial do cofre e `esquecerNumero` |
| `do-ambiente.ts` | o provedor montado com o ambiente (`registroPadrao()` o liga só com `META_APP_SECRET`) |
