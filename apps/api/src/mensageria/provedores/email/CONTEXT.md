# E-mail — o provedor `email-imap-smtp`

Ler primeiro: [`../../../../../../CONTEXT.md`](../../../../../../CONTEXT.md), [`../../CONTEXT.md`](../../CONTEXT.md) (a
mensageria), [`../../../../deploy/CONTEXT.md`](../../../../deploy/CONTEXT.md) ("E-mail (Fase 17)") e a Sessão 9 de
`docs/09-planejamento/TAREFAS-POR-SESSAO.md`.

O e-mail é o quarto provedor real da mensageria (depois da Evolution, do Instagram e do WhatsApp oficial) e o primeiro que
**busca** em vez de ser chamado: ninguém nos manda um webhook, a api lê a caixa. É um `ProvedorDeMensageria` (`provedor.ts`)
com `semWebhook: true`: o contrato exige que `verificarChamada` recuse toda chamada, inclusive a que traz o segredo certo
(T-17-17), então a rota pública `POST /webhooks/mensageria/:canalId` nunca grava nada por um Canal de e-mail. A entrada é o
**leitor**, que põe o e-mail na fila `plataforma.webhooks_recebidos` (o `corpo` é o `v: 1` de `traduzir.ts`); dali em diante é
o caminho de sempre: processador de entrada, `receberMensagem`, tempo real. A saída é o de sempre também: `POST /mensagens`
nasce `pendente`, grava `mensagem.enviar.v1` no outbox e o worker de saída chama `enviar`, que fala SMTP.

**Nada lê uma caixa sozinho em produção.** O leitor só liga com `EMAIL_LEITOR_ATIVO=true`, que a unidade
`n1-crm-api.service` fixa em `false` (D-17-09), e **só junto com `MENSAGERIA_WORKER_ATIVO=true`**: sem o processador a fila
só enche, e a coleta de órfãos apagaria anexos que ainda não viraram Mensagem (T-17-49). Sem `EMAIL_LEITOR_ATIVO`, nada
entra por e-mail; conectar e enviar seguem funcionando. A ordem de ligar e o rito da migração `017` (aplicada só pelo
`publicar.sh` do dono) estão em `deploy/CONTEXT.md`.

## Os três caminhos de conexão

Todos acabam no mesmo núcleo (`conexao.ts`, `gravarEConectar`): **abrir IMAP e depois SMTP FORA da transação, provar a
caixa, e só então gravar numa transação** a credencial no cofre, a conta (`plataforma.email_contas`), o cursor da INBOX no
`UIDNEXT` (D-17-08: o que já estava na caixa não entra), o Canal `conectada`, a revisão do Espaço, o aviso `canal.mudou` e as
`pendente` reenfileiradas (B69). Nada é gravado se alguma prova falha.

| Caminho | Rotas (em `rotas/crm/email.ts`) | Como prova a caixa |
|---|---|---|
| Senha de app (ou senha da hospedagem), com predefinição `gmail`/`outlook` por nome ou os dois servidores digitados | `POST /canais/:id/email/conectar` | login de senha no IMAP e no SMTP |
| Entrar com o Google | `POST /canais/:id/email/oauth/google/autorizar` e `POST /canais/email/oauth/concluir` | `email_verified` verdadeiro (ausente conta como não verificado) e XOAUTH2 com `user` = o endereço do Canal (`googlemail.com` = `gmail.com`) |
| Entrar com a Microsoft | `POST /canais/:id/email/oauth/microsoft/autorizar` e a mesma `.../concluir` | pré-conferência do `id_token` e XOAUTH2 com `user` = o endereço do Canal |

Mais `GET /canais/:id/email/conta` (a ficha: endereço, jeito de entrar, servidores, motivo da queda, e os botões de login
disponíveis em `servicosDisponiveis`) e `GET /mensagens/:id/corpo-html` (o HTML do e-mail recebido, já limpo). A volta do login
cai na WEB, como no Instagram: `EMAIL_OAUTH_REDIRECT_URI` é `…/crm/caixa-de-entrada/configuracoes/canais/email/retorno`, a
página chama `concluir` com o token da sessão, e o `state` (HMAC, 10 min, uso único por processo, PKCE S256 sem tabela)
amarra Membro, Espaço, Canal e serviço. A URI de retorno vem só da variável do servidor, nunca do corpo. A senha e o token de
renovação nunca saem do cofre nem aparecem em log, resposta ou frase de erro (T-17-19, T-17-54).

## O mapa dos arquivos (`provedores/email/`)

| Arquivo | O que é |
|---|---|
| `rede.ts` | a **guarda de rede** (D-17-07): só as portas IMAP 993/143 e SMTP 465/587 (143 e 587 em STARTTLS obrigatório); resolve o nome UMA vez e recusa se QUALQUER endereço é de faixa interna, de nuvem ou de metadados (`REDES_IPV4`, `REDES_IPV6`); a conexão vai ao IP já conferido |
| `fabrica-de-conexao.ts` | `criarFabricaDeConexao`: abre IMAP e SMTP no IP conferido com o nome original no certificado (`servername`), TLS 1.2+, verificação do certificado sempre ligada, `logger: false` |
| `erros.ts` | `classificarErroDeConexao`: frases fixas de produto; o texto do servidor só existe em `recusou_login`, filtrado (uma linha, 300 caracteres, sem token) |
| `credencial.ts` | a credencial `v: 1` no cofre (`tipo = 'email-imap-smtp'`, senha ou OAuth google/microsoft) e a porta `AcessoDoEmail`, que renova o token só abaixo de 5 min do vencimento e grava o novo antes de descartar o antigo |
| `repositorio.ts` | conta e cursor (`email_contas`, `cursores_de_canal`), `esquecerContaDoEmail`, `marcarQueda`/`limparQueda`; toda consulta filtra `workspace_id` |
| `configuracao.ts` | as predefinições Gmail e Outlook, `lerConfiguracaoDoOauth` e o que falta (`variaveisQueFaltam`) |
| `conexao.ts` | os três caminhos de conexão e o conector que revoga o token do Google ao desconectar |
| `queda.ts` | `registrarQuedaDoEmail` (D-17-20): leva `conectada` a `desconectada` com o motivo e o instante, avança a revisão e avisa |
| `estado.ts`, `oauth/comum.ts`, `oauth/google.ts`, `oauth/microsoft.ts`, `token.ts` | o login: `state` e PKCE, um cliente por serviço, os renovadores do ambiente |
| `traduzir.ts` | `prepararEmailRecebido`: interpreta o MIME com o `mailparser`, filtra, guarda arquivos e HTML pelo bucket e devolve o corpo `v: 1`; `eventosDoCorpo` o traduz no evento de `receberMensagem` |
| `entrada.ts` | `enfileirarEmailEAvancar`: o `insert ... on conflict do nothing` na fila e o cursor, na mesma transação |
| `leitor.ts` | o supervisor e a sessão IMAP em IDLE por Canal (abaixo) |
| `envio.ts`, `provedor.ts`, `do-ambiente.ts` | o envio SMTP, o provedor `email-imap-smtp` e o registro (só com `COFRE_CHAVE`) |
| `html.ts` | `limparHtmlDoEmail` (`sanitize-html`, lista curta) |
| `exemplos/` | sete `.eml` sintéticos (`example.*`, `.test`), sem dado real |

## O formato `v: 1`

A credencial do cofre e o `corpo` da fila são JSON versionado com `v: 1`; um formato novo entra como `v: 2` lido ao lado,
sem migração. O `corpo` leva o e-mail já interpretado (nunca o MIME cru, o HTML nem base64): texto (cortado em 200 000
caracteres, com o inteiro como arquivo), assunto, `Message-ID`, `In-Reply-To`, `References` (até 50 ids), `Para` e `Cópia`
(até 100 endereços cada), os anexos guardados e o HTML como `corpoHtml` (`{ objectKey, tamanhoBytes }`, nunca em `anexos`).
O que não vira Conversa entra como `ignorado:<motivo>` (próprio Canal, não entrega, resposta automática, lista, `ilegivel`,
`sem_conteudo`, `grande_demais`), para o leitor não repeti-lo.

## O leitor (`leitor.ts`, `EMAIL_LEITOR_ATIVO`)

- **Uma sessão IMAP em IDLE por Canal conectado**, mais uma conferência de reserva a cada 2 min (que sozinha garante o "até
  2 min" de D-17-09). O supervisor relê a lista de contas a cada 30 s e abre ou fecha a sessão de quem apareceu ou sumiu.
- **A trava por Canal** é `pg_try_advisory_lock(hashtextextended(...))` (64 bits) numa conexão `pg.Client` **dedicada, fora do
  pool**: a trava é de sessão, e segurá-la num cliente do pool prenderia uma das 10 conexões por Canal. Se a conexão cai, todas
  as sessões param na hora e o supervisor refaz. Orçamento: **pool 10 + ouvinte do tempo real 1 + leitor 1**. O teto é de 50
  sessões por processo.
- **Sem histórico (D-17-08):** lê só `UID >= cursor`; o que estava na caixa antes de conectar não entra. A faixa `n:*` que
  devolve a última mensagem abaixo do cursor é descartada. O cursor avança na mesma transação que grava a fila (nunca duas
  vezes o mesmo e-mail: `chave` única). Cada leitura pega até 100 e-mails.
- **`UIDVALIDITY` novo:** o cursor recomeça do `UIDNEXT` novo, registra "uidvalidity mudou" com o id do Canal e não reimporta.
- **Anexo que falhou no bucket** segura o cursor até 3 passadas (10 s entre elas); na terceira o e-mail entra com
  `baixado: false`. O tradutor que lança 3 vezes no mesmo UID deixa o e-mail entrar como `ignorado:ilegivel`.
- **Tetos:** 50 MiB por e-mail antes do parser (acima disso nem baixa o `source`), 5 MiB de HTML guardado, 50 arquivos.
- **A fila e a coleta:** o leitor acorda o processador de entrada no mesmo processo; a coleta de órfãos poupa o `objectKey` do
  HTML (`mensagens.corpo_html`) e o de qualquer linha da fila ainda `pendente` ou `processando` (F6).

## A saída (`envio.ts`)

- O MIME é montado uma vez (`MailComposer`) e vai como `raw` com o **envelope dito à parte**: a **cópia oculta só existe no
  envelope**, nunca em cabeçalho, no `DATA` nem na cópia de Enviados. O nodemailer 10.6.0 nem escreve `Bcc`; o envelope
  explícito é a segunda barreira.
- **O fio:** `Message-ID` = `n1.<id>@<domínio do Canal>`, `In-Reply-To` e `References` (até 20 ids: o primeiro e os 19 últimos)
  no mesmo fio; o assunto vira `Re: ...` sem empilhar. O `Message-ID` é gravado como `id_externo` ANTES de a mensagem sair
  (`idExternoDoEnvio`), então a resposta do destinatário acha a Conversa mesmo depois de um envio ambíguo.
- **Anexos e tetos:** até 10 arquivos e 20 MB no total, vindos do bucket pela chave (`armazenamento.baixar`, nunca por URL);
  a soma é conferida antes de qualquer conexão (`EMAIL_GRANDE_DEMAIS`).
- **Destino:** só um Identificador de e-mail do Contato da Conversa; o colega que escreveu por último entra no fio, nunca como
  destinatário (A15, D-17-15). Endereço, nome, assunto, nome de arquivo e tipo de mídia são conferidos de novo antes do MIME
  (defesa em profundidade contra CRLF).
- **O desfecho do SMTP** é decidido por quem responde: o servidor que respondeu com código é recusa limpa (4xx e 503
  transitórios, 5xx permanentes, frase fixa só com o número); DNS, conexão recusada, certificado e tempo de conexão são falha
  antes do envio; **sem código e com a sessão de pé é `ambiguo`** (inclusive um desfecho SMTP sem código reconhecido) e **nunca
  é reenviado**: a Mensagem fica `falhou` com a frase "confira em Enviados". Errar para esse lado custa um clique; errar para o
  outro custa um e-mail duplicado ao cliente.
- **Cópia em Enviados (A4/A5):** `deveGuardarEmEnviados` decide, com `append_enviados` da conta (`auto`, `sim`, `nao`): no
  `auto`, o Gmail e o Microsoft 365 (e o login Google ou Microsoft) não copiam, porque o servidor já guarda. Outros servidores
  recebem um `APPEND` do mesmo MIME com `\Seen`, na pasta `\Sent` (SPECIAL-USE); sem `\Sent` conhecido pula; falha do `APPEND`
  só registra o tipo. **A4 e A5 são pressupostos** até a prova real.

## A queda (D-17-20)

Senha recusada (`recusou_login`), autorização retirada ou `invalid_grant` (inclusive os 7 dias do modo de teste do Google)
levam o Canal a `desconectada` com o motivo em frase de produto e o instante (`registrarQuedaDoEmail`); a conta e a credencial
ficam, e a ficha mostra "Desconectada" com o motivo e "Entrar de novo". A sessão do leitor para (nenhum login a mais) e a
Mensagem de saída fica `pendente` até o Canal voltar (então reabre e envia). Reconectar zera o motivo. Erro desconhecido de
renovação, 5xx e 429 são transitórios e não derrubam nada. Desconectar e arquivar apagam conta, cursor e credencial do cofre
na mesma transação; no Google, o refresh token é **revogado antes** da transação, em melhor esforço (a falha vira só uma
contagem e nunca impede desconectar). Microsoft e senha não fazem pedido de rede (A9: a Microsoft não tem endpoint de
revogação por token).

## O HTML do e-mail

O HTML recebido sobe ao bucket como `text/html` em `workspace/<ws>/entrada/<canal>/<uuid>` e `GET /mensagens/:id/corpo-html`
o devolve em `{ html }`, **limpo** por `sanitize-html` (sem `script`, `style`, `iframe`, formulário, `svg`; imagem só
`data:` raster, nunca remota; link só `http`, `https`, `mailto`, `tel`, com `rel="noopener noreferrer"` e `target="_blank"`),
com `Cache-Control: no-store` e só a quem pode ler a Mensagem no Espaço da sessão. A tela mostra o HTML só numa moldura
`<iframe sandbox="">` (nenhuma permissão) com `srcDoc`, `referrerPolicy="no-referrer"` e a CSP `default-src 'none'` como
primeira coisa do documento (`apps/web/src/features/crm/corpo-do-email.tsx`). Nenhum HTML de e-mail entra no DOM da aplicação.

## O que não faz (e o que ainda não está provado)

**O que não faz:**

- **Começar um e-mail NOVO, com assunto e cópias, não existe nesta tela.** `POST /conversas` é `strict` e não leva `assunto`
  nem `enderecosAdicionais`, então os campos de assunto, cópia e cópia oculta só aparecem numa Conversa que já existe. Responder
  funciona com assunto, cópias e arquivos. É uma lacuna aberta para o dono decidir (aceitar na Sessão 9 ou um plano 17-17).
- **Um e-mail que chega com o Canal caído NÃO é importado quando a pessoa reconecta**, porque a conexão regrava o cursor no
  `UIDNEXT` (D-17-08, `[auto]`). A alternativa seria retomar do cursor antigo quando a caixa e o `UIDVALIDITY` forem os mesmos.
- **O e-mail só com assunto ou só com HTML** é gravado com `conteudo` = o assunto, ou a frase fixa `(sem texto)` (constante em
  `servicos/crm/recebimento.ts`), porque `mensagens_conteudo_ck` (008, imutável) exige texto ou anexo. Uma `018` poderia
  relaxar a restrição.
- **Links dentro de "Ver e-mail formatado" não abrem** (o `sandbox` vazio bloqueia a navegação).
- **Sem histórico:** o que estava na caixa antes de conectar não entra, e uma pasta que não seja a INBOX não é lida.
- O `state` do login vale uma vez **por processo**: um reinício da api no meio de um login só pede um novo clique.

**O que segue sem prova real** (o dono, pelo `17-PROVA-REAL.md`): tudo foi provado contra dublês de IMAP, SMTP e login
(servidores de verdade com TLS de teste), **nunca contra Gmail, Microsoft 365 ou uma hospedagem real**. Falta ver:
IDLE e `INTERNALDATE` dos servidores reais; a cópia em Enviados (A4 e A5); o `maxIdleTime` de 5 min; a trava consultiva atrás
do pooler de produção; o login do Google em modo de teste (cai a cada 7 dias até o Google verificar o app) e `email_verified`
ausente; a Microsoft (autoridade `common`, A12; revogação, A9; a retirada anunciada do login básico no SMTP, A11) e a
pré-conferência do `id_token` com um alias ou UPN diferente do endereço principal (a conta seria recusada como
`CONTA_DIFERENTE`); a guarda de rede (a lista de faixas é a D-17-07 mais o A2, sem confirmação do dono; afrouxar é editar
`REDES_IPV4`/`REDES_IPV6` em `rede.ts`); se o bucket real aceita `text/html` (D-17-10, `npm run storage:conferir`); e a moldura
do e-mail formatado num navegador de verdade (o jsdom não executa o `srcDoc`). As decisões `[auto]` D-17-07, D-17-08, D-17-10
e D-17-15 aguardam a confirmação do dono.

## Regra de log

Nada aqui loga endereço, assunto, corpo, senha, token, código de login nem texto de servidor. Os registros levam contagens, o
id do Canal e o nome do tipo da falha.

## Testes

Os dublês são servidores de verdade (`../../../testes/servidor-de-email-falso.ts`: IMAP com `imapkit`, SMTP com `smtp-server`,
TLS com certificado gerado na hora, XOAUTH2, IDLE, `\Sent`, `UIDVALIDITY` trocável, falhas de SMTP programáveis) e o login
falso (`../../../testes/login-oauth-falso.ts`). A conta, o cursor, a fila e a saída rodam contra um Postgres local. Nenhum
teste fala com a rede externa.
