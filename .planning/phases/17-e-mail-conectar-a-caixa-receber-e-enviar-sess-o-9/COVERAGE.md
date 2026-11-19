# API Coverage — E-mail (IMAP, SMTP, login do Google e da Microsoft)

> Full coverage by default. Opt-outs are explicit, reasoned decisions.
>
> Fronteira decidida pelo dono em D-17-01 (17-CONTEXT.md): IMAP e SMTP com senha ou senha de app, e login OAuth do Google e
> da Microsoft por XOAUTH2; Gmail API e Microsoft Graph ficam fora. O que é ideia adiada (importar histórico, outras pastas,
> e-mail mandado por outro programa, push, mais de uma caixa por Canal) está em "Deferred Ideas" do CONTEXT. Fonte da
> superfície: `17-RESEARCH.md` (Patterns 1 a 7, "Google OAuth", "Microsoft OAuth").
> Planos que integram: 17-02 (pacotes e dublês), 17-03 (guarda, fábrica, erros), 17-04 (credencial), 17-05 (conectar por
> senha), 17-08 (interpretar o MIME), 17-09 (enviar, `APPEND`, provedor), 17-10 (leitor), 17-12 (Microsoft), 17-13 (Google),
> 17-16 (prova real com caixas do dono).

## IMAP (cliente `imapflow`)

| capability | decision | reason |
|---|---|---|
| conexão TLS implícita na porta 993 (17-03) | INTEGRATE | |
| STARTTLS obrigatório na porta 143 (17-03) | INTEGRATE | |
| IMAP em texto puro (143 sem STARTTLS) ou outra porta | OPT-OUT | proibido por D-17-07: a api nunca fala em texto puro nem fora de 993/143 |
| `LOGIN` com usuário e senha / senha de app (17-03, 17-05) | INTEGRATE | |
| `AUTHENTICATE XOAUTH2` (17-12, 17-13) | INTEGRATE | |
| `AUTHENTICATE OAUTHBEARER` | OPT-OUT | not needed: Google e Exchange aceitam XOAUTH2, que o `imapflow` usa |
| `CAPABILITY` e `LIST` com `SPECIAL-USE` para achar `\Sent` (17-03, 17-05) | INTEGRATE | |
| `SELECT INBOX` com `UIDVALIDITY` e `UIDNEXT` (cursor, 17-05, 17-10) | INTEGRATE | |
| `UID FETCH` de tamanho, `INTERNALDATE`, envelope e corpo inteiro (17-10) | INTEGRATE | |
| `UID FETCH` de uma mensagem para reler um anexo (`baixarMidia`, 17-09) | INTEGRATE | |
| `IDLE` com reemissão a cada 5 min (17-10) | INTEGRATE | |
| conferência periódica de 2 min sem `IDLE` (17-10) | INTEGRATE | |
| `APPEND` na pasta `\Sent` com `\Seen` (17-09) | INTEGRATE | |
| fechamento antes de o token vencer (`sessionExpires`, Exchange, 17-10) | INTEGRATE | |
| ler o histórico anterior à conexão | OPT-OUT | explicitly out of scope: D-17-08 e "Importar o histórico" em Deferred Ideas |
| `SELECT` de outras pastas (Enviados, Arquivo, rótulos) | OPT-OUT | explicitly out of scope: "Outras pastas" em Deferred Ideas (D-17-09: só INBOX) |
| ler Enviados para mostrar o e-mail mandado por outro programa | OPT-OUT | explicitly out of scope: "E-mail mandado por outro programa" em Deferred Ideas |
| `STORE` de flags na caixa (marcar lido no servidor) | OPT-OUT | not needed: a leitura é do CRM (marcações por Membro); o leitor não altera a caixa do cliente além do `APPEND` |
| `EXPUNGE`, `MOVE`, `COPY` e apagar mensagens | OPT-OUT | not needed: o leitor nunca apaga nem move e-mail da caixa do cliente |
| `SEARCH` | OPT-OUT | not needed: o cursor por UID (`n:*`) basta |
| `CONDSTORE`/`QRESYNC` | OPT-OUT | not needed: cursor por UID e `UIDVALIDITY` cobrem o "sem repetir" |
| `COMPRESS`, `ID`, `NAMESPACE`, `QUOTA` | OPT-OUT | not needed: nenhum caso da Sessão 9 os usa |
| POP3 | OPT-OUT | not needed: IMAP escolhido em 9.1.2 (POP não tem `IDLE` nem pasta) |

## SMTP (cliente `nodemailer`)

| capability | decision | reason |
|---|---|---|
| TLS implícito na porta 465 (17-03, 17-09) | INTEGRATE | |
| STARTTLS obrigatório na porta 587 (`requireTLS`, 17-03, 17-09) | INTEGRATE | |
| SMTP em texto puro ou porta 25 | OPT-OUT | proibido por D-17-07 |
| `AUTH PLAIN`/`LOGIN` com senha (17-05, 17-09) | INTEGRATE | |
| `AUTH XOAUTH2` (17-12, 17-13, envio em 17-09 pela porta de acesso) | INTEGRATE | |
| `verify()` (EHLO + AUTH) antes de gravar a conexão (17-03, 17-05) | INTEGRATE | |
| envelope: `MAIL FROM` do Canal, `RCPT TO` com cópias e cópia oculta (17-09) | INTEGRATE | |
| `DATA`: MIME com texto, HTML, `Message-ID`, fio, assunto e anexos (17-09) | INTEGRATE | |
| recusa por destinatário (aceite parcial) e códigos 4xx/5xx (17-09) | INTEGRATE | |
| pedido de DSN (`NOTIFY=SUCCESS,FAILURE`) | OPT-OUT | not needed: o e-mail só reporta "enviada" (`reportedDeliveryStatuses` do `email`); o aviso de não entrega que chega é ignorado com motivo (D-17-11) |
| confirmação de leitura (`Disposition-Notification-To`) | OPT-OUT | not needed: o Canal de e-mail não reporta "lida" |
| envio pela Gmail API ou pela Microsoft Graph (`sendMail`) | OPT-OUT | explicitly out of scope: opção C fora por decisão do dono (D-17-01) |

## Login do Google (OAuth 2.0 + OpenID Connect)

| capability | decision | reason |
|---|---|---|
| autorização com PKCE, `state`, `access_type=offline`, `prompt=consent` (17-13) | INTEGRATE | |
| escopos `openid email https://mail.google.com/` (17-13) | INTEGRATE | |
| troca do código no endpoint de token (17-13) | INTEGRATE | |
| renovação por `refresh_token` e `invalid_grant` como queda (17-13) | INTEGRATE | |
| revogação (`/revoke`) ao desconectar e arquivar (17-13) | INTEGRATE | |
| `id_token` (`email`, `email_verified`, `sub`) como pré-conferência (17-13) | INTEGRATE | |
| XOAUTH2 em `imap.gmail.com` e `smtp.gmail.com` como prova da caixa (17-13) | INTEGRATE | |
| escopo `gmail.imap_admin` (delegação de domínio do Workspace) | OPT-OUT | not needed: cada pessoa conecta a própria caixa; delegação de domínio não é desta fase |
| endpoint `userinfo` | OPT-OUT | not needed: o `id_token` traz `email`, `email_verified` e `sub` |
| autorização incremental | OPT-OUT | not needed: um conjunto de escopos só |
| Gmail API (`users.messages`, `history`, `watch` com Pub/Sub) | OPT-OUT | explicitly out of scope: D-17-01 (opção C) e "Aviso instantâneo por push" em Deferred Ideas |
| verificação do app e avaliação CASA no Google | OPT-OUT | not code: tarefa do dono (9.1.3), corre por fora; até sair, a prova real é em modo de teste (D-17-02, 17-16) |

## Login da Microsoft (identity platform v2.0)

| capability | decision | reason |
|---|---|---|
| `/authorize` com PKCE, `state` e autoridade `common` (A12) (17-12) | INTEGRATE | |
| escopos `offline_access`, `IMAP.AccessAsUser.All` e `SMTP.Send` (17-12) | INTEGRATE | |
| troca do código no `/token` (17-12) | INTEGRATE | |
| renovação com troca do refresh token a cada uso (17-12) | INTEGRATE | |
| `id_token` (`oid`, `tid`, `preferred_username`) como pré-conferência (17-12) | INTEGRATE | |
| consentimento do administrador (`AADSTS65001`) como frase (17-12) | INTEGRATE | |
| XOAUTH2 no IMAP e no SMTP do Microsoft 365 como prova da caixa (17-12) | INTEGRATE | |
| fluxo de credenciais de cliente (app-only, `.default`) | OPT-OUT | not needed: o acesso é delegado, pessoa por pessoa; app-only exige configurar a caixa no Exchange pelo administrador |
| endpoint de consentimento do administrador (`/adminconsent`) | OPT-OUT | not needed yet: o administrador da organização consente no Entra; a tela só explica (CONSENTIMENTO_DO_ADMINISTRADOR) |
| revogação do refresh token por endpoint | OPT-OUT | not documented in v2.0 (pressuposto A9, a confirmar na prova real): desconectar apaga a credencial do cofre |
| caixa compartilhada (XOAUTH2 com o endereço da caixa compartilhada) | OPT-OUT | not needed yet: o Canal é a caixa da própria conta; caixa compartilhada não é testada nesta fase |
| Microsoft Graph (`/me/messages`, `sendMail`, assinaturas de mudança) | OPT-OUT | explicitly out of scope: D-17-01 (opção C) e "Aviso instantâneo por push" em Deferred Ideas |
