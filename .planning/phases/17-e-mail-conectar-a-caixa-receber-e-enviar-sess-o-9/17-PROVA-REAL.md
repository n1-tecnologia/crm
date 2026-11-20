# Fase 17: roteiro da prova com caixas reais (9.4.4, D-17-02)

> **Só o dono roda este roteiro.** Ele publica código, aplica a `017` no banco de produção, liga o leitor na VM, conecta caixas
> de verdade e troca e-mails. Nenhum agente roda estes passos por ele. Este arquivo foi escrito pelo plano 17-16 a partir de
> `17-CONTEXT.md`, `17-RESEARCH.md` (suposições A1 a A15), dos `17-NN-SUMMARY.md` e de `apps/api/deploy/CONTEXT.md` ("E-mail
> (Fase 17)"). O molde é o `16-PROVA-AO-VIVO.md`.
>
> **Regra de ouro: nenhum segredo vai para a conversa.** Senha de app, senha da hospedagem, chave do cliente do Google ou da
> Microsoft, token, `COFRE_CHAVE`, `DATABASE_URL`, endereço de e-mail real e o conteúdo de qualquer e-mail ficam com você. As
> variáveis vão direto ao `api.env` do servidor, pelo seu terminal. **Só voltam para a conversa** resultados: sim ou não por
> passo, minutos, contagens, versões e o nome do erro (nunca o texto que traz endereço ou conteúdo).
>
> Use caixas de TESTE, que você aceite desconectar e apagar: o roteiro conecta cada uma ao CRM e manda e-mails de verdade.

## Visão geral

| Parte | O que prova | Passos |
|---|---|---|
| **Pré-voo** | a `017` aplicada com backup, as variáveis no lugar, o bucket aceitando `text/html`, o leitor ligado na ordem certa | P1 a P7 |
| **Bloco A: Gmail com senha de app** | conectar por senha, receber, responder no mesmo fio, anexo nos dois sentidos, Enviados (A4) | A1 a A12 |
| **Bloco B: Google com login (modo de teste)** | o login, a queda aos 7 dias, `email_verified`, a revogação | B1 a B9 |
| **Bloco C: Microsoft 365 com login** | o login, a troca de token após 1 h, Enviados (A5), alias | C1 a C10 |
| **Bloco D: hospedagem comum com senha** | um servidor que não é Gmail nem Microsoft, a cópia em Enviados por `APPEND` | D1 a D8 |
| **Perguntas ao dono** | as decisões `[auto]` e os pressupostos | Q1 a Q14 |

Se um passo mostrar algo que exige código, **pare**, cole só o resultado na conversa e rode `/gsd-plan-phase 17 --gaps`. Não
corrija no meio da prova. Anote "sim", "não" ou o número pedido em cada linha "Resultado".

---

## Pré-voo

### P1: O backup e o `--seco` da `017`

1. Backup manual do schema `plataforma` (`pg_dump -Fc --schema=plataforma --no-owner --no-acl`), restaurado num Postgres
   descartável para conferir as contagens (o rito de `apps/api/deploy/CONTEXT.md`, "E-mail (Fase 17)").
2. `npm run migrar -w @n1/api -- --seco`: só a `017-email.sql` deve aparecer `pendente`.

Resultado (sim/não, e quantas migrações pendentes): ______

### P2: Publicar

`publicar.sh` do dono (ele roda o `migrar`, que aplica a `017`, e o `banco:conceder`). Confira que a api voltou (`/saude`) e que
o `journalctl` não mostra erro de subida.

Resultado (sim/não; a `017` aparece como aplicada?): ______

### P3: As variáveis no `api.env` (só os nomes aqui)

No `api.env` do servidor (modo 600, pelo seu terminal, nunca pela conversa): `EMAIL_OAUTH_REDIRECT_URI` (a URI do passo P4),
`GOOGLE_OAUTH_CLIENT_ID` e `GOOGLE_OAUTH_CLIENT_SECRET`, `MICROSOFT_OAUTH_CLIENT_ID` e `MICROSOFT_OAUTH_CLIENT_SECRET`. `COFRE_CHAVE`
já existe. Reinicie: `systemctl restart n1-crm-api`.

Resultado (sim/não; a ficha de um Canal de e-mail mostra os botões "Entrar com o Google" e "Entrar com a Microsoft"?): ______

### P4: Os apps de login (9.1.3), nos painéis

- **Google Cloud Console:** tela de consentimento externa, escopo `https://mail.google.com/`, seus usuários de teste, e a URI de
  retorno do cliente da Web **igual, letra por letra**, a `EMAIL_OAUTH_REDIRECT_URI`
  (`https://<web>/crm/caixa-de-entrada/configuracoes/canais/email/retorno`). O app fica em **modo de teste**.
- **Microsoft Entra:** o registro de aplicativo com as permissões delegadas `IMAP.AccessAsUser.All`, `SMTP.Send` e
  `offline_access` (recurso Office 365 Exchange Online), a URI de retorno da Web igual a `EMAIL_OAUTH_REDIRECT_URI`, e o tipo de
  conta que aceita contas pessoais e de trabalho (A12).

Resultado (sim/não por painel): Google ______ Microsoft ______

### P5: O bucket aceita `text/html` (D-17-10)

Como `n1crm`: `cd /opt/n1-crm/current && npm run storage:conferir -w @n1/api`.

Resultado (a saída diz que o bucket está certo? ele tem lista de tipos aceitos, e `text/html` está nela? sim/não): ______

### P6: Ligar a mensageria e DEPOIS o leitor

Nesta ordem, como root na VM (o rito de `deploy/CONTEXT.md`): `MENSAGERIA_WORKER_ATIVO=true` (`mensageria.conf`) e só depois
`EMAIL_LEITOR_ATIVO=true` (`email.conf`), com `systemctl daemon-reload && systemctl restart n1-crm-api`.

Resultado (o `journalctl` mostra "leitor de e-mail ativo"? sim/não): ______

### P7: Uma caixa de apoio

Tenha um segundo endereço seu, de OUTRO provedor, para mandar e receber (o "remetente" dos blocos abaixo), e um PDF pequeno
(algumas centenas de KB) para anexar.

Resultado (sim/não): ______

---

## Bloco A: Gmail com senha de app

Gerar a senha de app: na conta Google de teste, com a verificação em duas etapas ligada, "Senhas de app". A senha fica só no seu
teclado.

### A1: Criar o Canal e conectar

No CRM, crie um Canal de e-mail e, na ficha, "Conectar" > "Outro servidor" (predefinição Gmail). Informe o endereço e a senha de
app.

Resultado (a ficha mostra "Conectada" com o jeito de entrar "senha"? sim/não): ______

### A2: Mandar um e-mail com PDF, de outro endereço

Do endereço de apoio, mande um e-mail para a caixa conectada, com assunto "Prova 17 A" e o PDF anexado.

Resultado (minutos até a Conversa aparecer na Caixa de Entrada; o limite do projeto é 2): ______

### A3: Conferir a Conversa

Abra a Conversa. Confira o assunto, o texto e que o PDF aparece como anexo.

Resultado (assunto certo? anexo aparece? sim/não por item): ______

### A4: Baixar o PDF recebido

Baixe o anexo pela tela e abra.

Resultado (abriu? sim/não): ______

### A5: Responder pela Caixa, com cópia e um arquivo

Responda pela Caixa de Entrada, com um texto, uma cópia (um terceiro endereço seu) e um arquivo pequeno.

Resultado (a Mensagem ficou "enviada" sem erro? sim/não): ______

### A6: A resposta no mesmo fio, no programa do remetente

No programa de e-mail do endereço de apoio, olhe a resposta. Ela deve estar na mesma conversa (mesmo fio) do e-mail original, com
o assunto "Re: Prova 17 A" e o arquivo.

Resultado (mesmo fio? sim/não; o arquivo abriu? sim/não; a cópia chegou ao terceiro endereço? sim/não): ______

### A7: Responder de volta e ver a mesma Conversa

Do endereço de apoio, responda a resposta. Aguarde.

Resultado (minutos até chegar; ficou na MESMA Conversa do CRM, com três e-mails num fio só? sim/não; quantas Conversas novas
nasceram: 0 ou 1): ______

### A8: Enviados (decide A4 e `append_enviados`)

Olhe a pasta Enviados da caixa Gmail conectada, para a resposta do passo A5.

Resultado (a resposta aparece em Enviados: UMA vez, DUAS vezes ou NENHUMA?): ______

### A9: Cópia oculta

Responda de novo pela Caixa com uma cópia OCULTA (um quarto endereço seu) e um destinatário em cópia comum.

Resultado (o endereço oculto recebeu? sim/não; o destinatário comum, no cabeçalho do que ele recebeu, NÃO vê o endereço oculto? sim/não; o endereço de apoio não vê o oculto? sim/não): ______

### A10: E-mail formatado no navegador (julgamento humano)

Do endereço de apoio, mande um e-mail formatado (HTML, com negrito, uma imagem inline e um link). Na Conversa, clique em "Ver
e-mail formatado".

Resultado (a moldura mostra o texto formatado? a imagem inline aparece? sim/não; um link abre? sim/não, e o esperado é NÃO; o
console do navegador mostra pedido de rede externo ao abrir? sim/não): ______

### A11: Só assunto (D-17-10 / a frase `(sem texto)`)

Mande um e-mail só com assunto, sem corpo, e outro só com HTML (sem texto simples, se o seu programa permitir).

Resultado (o que a Caixa mostra como texto de cada um: o assunto, a frase "(sem texto)" ou outra coisa?): ______

### A12: A senha mudou (a queda)

Troque a senha de app (gere uma nova e apague a antiga). Espere até 5 min.

Resultado (a ficha passa a "Desconectada" com o motivo escrito e "Entrar de novo"? sim/não; em quantos minutos): ______

Depois, "Entrar de novo" com a senha nova.

Resultado (voltou a "Conectada" e o motivo sumiu? sim/não): ______

---

## Bloco B: Google com login (MODO DE TESTE)

> **O app do Google fica em modo de teste** enquanto o Google não verificar o escopo restrito: a autorização **cai a cada 7
> dias** e a conexão passa a "Desconectada". Isso é esperado; este bloco só anota a data da conexão para conferir depois.

### B1: Conectar pelo Google

Crie outro Canal de e-mail (com o endereço Gmail de teste que está na lista de usuários de teste) e, na ficha, "Conectar" >
"Entrar com o Google". Autorize.

Resultado (voltou à ficha com "Conectada" e o jeito de entrar "Google"? sim/não; apareceu algum aviso de "app não verificado" na
tela do Google, e o que o botão de continuar exigiu?): ______

### B2: A data da conexão

Anote a data de hoje como a data da conexão (para o limite de 7 dias).

Resultado (a data: dia/mês): ______

### B3 a B6: Repetir A2 a A8 por este Canal

Receba um e-mail com PDF, responda pela Caixa com cópia, confira o mesmo fio, responda de volta e confira Enviados.

Resultado (receber em quantos minutos; mesmo fio: sim/não; PDF abriu nos dois lados: sim/não; Enviados: UMA, DUAS ou NENHUMA vez): ______

### B7: Endereço `googlemail.com` (se você tiver)

Se tiver uma conta cujo endereço seja `googlemail.com`, repita B1 com ela.

Resultado (conectou? sim/não/não tenho): ______

### B8: Desconectar revoga

Na ficha, "Desconectar". Depois, na conta Google (Segurança > Acesso de terceiros), veja se o acesso do app sumiu.

Resultado (o app aparece ainda na lista? sim/não): ______

### B9: Passados 7 dias (anotar depois)

Sete dias depois de B2, olhe a ficha do Canal (se ainda estiver conectado).

Resultado (a ficha mostra "Desconectada" com o motivo da autorização vencida? sim/não; em que dia): ______

---

## Bloco C: Microsoft 365 com login

### C1: Conectar pela Microsoft

Crie um Canal de e-mail com o endereço Microsoft 365 de teste e, na ficha, "Conectar" > "Entrar com a Microsoft". Autorize.

Resultado (voltou com "Conectada" e o jeito "Microsoft"? sim/não; se pediu aprovação do administrador, o texto era a frase do
CRM sobre o administrador? sim/não): ______

### C2 a C5: Repetir A2 a A8 por este Canal

Receber com PDF, responder pela Caixa com cópia, mesmo fio no programa do remetente, responder de volta, Enviados.

Resultado (receber em quantos minutos; mesmo fio: sim/não; PDF dos dois lados: sim/não; Enviados da resposta (A5): UMA, DUAS ou
NENHUMA vez): ______

### C6: A sessão passa de 1 hora (troca de token)

Deixe o Canal conectado por mais de 1 hora (o token de acesso vence), sem mexer. Depois mande um e-mail de apoio para a caixa e
responda pela Caixa.

Resultado (chegou e saiu depois de 1 h sem pedir para entrar de novo? sim/não; a ficha continua "Conectada"? sim/não): ______

### C7: Alias ou endereço diferente do principal (A12 e o `id_token`)

Se você tiver um Canal cujo endereço é um ALIAS (ou um UPN diferente do endereço principal da conta Microsoft), tente conectá-lo
pelo login.

Resultado (conectou? ou a ficha recusou com a frase de "outra conta"? sim/não/não tenho alias): ______

### C8: Conta pessoal (outlook.com ou hotmail.com), se tiver

Resultado (conectou? sim/não/não tenho): ______

### C9: O SMTP com senha no Microsoft 365 (A11)

Se quiser, tente conectar a mesma caixa pelo caminho "Outro servidor" com a predefinição Outlook e uma senha de app.

Resultado (conectou? sim/não/recusou; o texto era o do servidor recusando usuário ou senha? sim/não/não tentei): ______

### C10: Desconectar

Na ficha, "Desconectar". Em seguida, no painel da Microsoft ("Aplicativos e permissões"), confira se a concessão ainda aparece.

Resultado (a concessão do app ainda aparece? sim/não; é o esperado por A9, porque a Microsoft não revoga por token): ______

---

## Bloco D: Hospedagem comum com senha

Uma caixa de e-mail de uma hospedagem (cPanel, Locaweb, Zoho ou parecida) que você controle, com IMAP e SMTP por senha, nas portas
993 (IMAP) e 465 ou 587 (SMTP).

### D1: Conectar com os servidores digitados

Na ficha, "Conectar" > "Outro servidor", sem predefinição: usuário, senha, servidor e porta do IMAP e do SMTP.

Resultado (conectou? sim/não; se recusou, em qual campo, `imap` ou `smtp`, e o nome do erro): ______

### D2 a D5: Repetir A2 a A8 por este Canal

Receber com PDF, responder com cópia, mesmo fio, responder de volta, Enviados.

Resultado (receber em quantos minutos; mesmo fio: sim/não; PDF dos dois lados: sim/não; Enviados: UMA, DUAS ou NENHUMA vez): ______

### D6: A cópia em Enviados por `APPEND`

Para uma caixa fora de Gmail e de Microsoft, o CRM copia a resposta para a pasta de Enviados. Olhe a pasta de Enviados do programa
de e-mail da hospedagem.

Resultado (a resposta aparece em Enviados uma vez? sim/não; o nome da pasta onde apareceu era a de Enviados de verdade, ou outra?): ______

### D7: Um servidor com certificado que não confere (opcional)

Se tiver um servidor de teste com certificado autoassinado, tente conectar.

Resultado (recusou com a frase do certificado? sim/não/não tenho): ______

### D8: O servidor na rede interna (a guarda de rede)

Tente conectar um Canal a um servidor cujo nome resolva para um endereço interno ou da sua rede local (se você tiver), ou a uma
porta que não seja 993, 143, 465 ou 587.

Resultado (recusou antes de abrir conexão? sim/não/não tenho): ______

---

## Perguntas ao dono

As decisões marcadas `[auto]` foram tomadas pelo planejador sem a sua confirmação. Responda **sim** (manter) ou **trocar** (e o
que preferir). Uma troca vira `/gsd-plan-phase 17 --gaps`.

**Q1. D-17-07 (a guarda de rede) e A2.** O CRM recusa conectar a qualquer servidor cujo endereço seja interno, de nuvem ou de
metadados (loopback, redes privadas, link-local, CGNAT, multicast e outras), e só aceita as portas 993/143 (IMAP) e 465/587
(SMTP). Alguma caixa sua foi recusada por isso sem dever? Se sim, qual faixa (afrouxar é editar `REDES_IPV4`/`REDES_IPV6` em
`rede.ts`). Resposta: ______

**Q2. D-17-08 (sem histórico e sem recuperar o que chegou com o Canal caído).** A conexão grava o cursor no fim da caixa, então
um e-mail que chega enquanto o Canal está caído NÃO é importado quando a pessoa reconecta. Isso é aceitável? A alternativa é
retomar do cursor antigo quando a caixa (UIDVALIDITY) for a mesma. Resposta (aceito / trocar): ______

**Q3. D-17-10 (o HTML no bucket).** O resultado de P5 (o bucket aceita `text/html`?) e do passo A10 (a moldura mostrou o
formatado) mantêm a decisão de guardar o HTML? Resposta (manter / trocar): ______

**Q4. D-17-15 (a resposta de outra pessoa no fio).** Quando um colega do Contato responde no fio, o e-mail entra na Conversa do
Contato original e a Conversa não muda de Contato; a sua resposta pela Caixa sai para o Contato da Conversa. Concorda? Se você
testou (um terceiro respondendo no fio), o resultado foi o esperado? Resposta (manter / trocar; resultado do teste, se fez): ______

**Q5. A frase `(sem texto)`.** Um e-mail recebido só com assunto, ou só com HTML, aparece com o assunto, ou com a frase fixa
`(sem texto)`, porque a regra do banco (migração 008) exige texto ou anexo. A frase serve, ou você quer uma migração `018` que
relaxe essa regra? Resposta (a frase serve / quero a `018`): ______

**Q6. Começar um e-mail novo com assunto e cópias.** Hoje o assunto e as cópias só aparecem numa Conversa que já existe;
abrir uma Conversa de e-mail do zero pela plataforma não leva assunto nem cópias (`POST /conversas` não os aceita). Aceita isso
na Sessão 9, ou quer um plano 17-17 para isso? Resposta (aceito / quero o 17-17): ______

**Q7. Os links do e-mail formatado.** Dentro de "Ver e-mail formatado", os links não abrem (o `sandbox` vazio bloqueia a
navegação). É aceitável? Resposta (aceito / quero que os links abram): ______

**Q8. A4 e A5 (Enviados).** Pelos passos A8, B3 a B6, C2 a C5 e D2 a D5: no Gmail e no Microsoft 365 a resposta ficou em Enviados
uma vez só? Em caso de DUAS ou NENHUMA, anote a caixa (o ajuste é `append_enviados` da conta, sem código novo, ou a regra do
`auto`). Resposta (por caixa: uma / duas / nenhuma): ______

**Q9. A9 (revogação da Microsoft).** Pelo passo C10: o acesso do app continua na conta Microsoft depois de desconectar. É
aceitável (o token fica só apagado do CRM)? Resposta (aceito / trocar): ______

**Q10. A11 e a retirada do login básico no SMTP.** O passo C9 mostrou o que o servidor do Microsoft 365 aceita hoje com senha?
Resposta (aceita / recusa / não testei): ______

**Q11. A12 (a autoridade `common`) e o alias.** O passo C1 e C8 conectaram contas pessoais e de trabalho? O passo C7 (alias)
conectou ou foi recusado como "outra conta"? Resposta (resultado): ______

**Q12. O Google em modo de teste.** Você aceita operar com a conexão caindo a cada 7 dias até o Google verificar o app (a ficha
mostra a queda e o botão de entrar de novo)? Quando pretende pedir a verificação? Resposta (aceito / outro caminho): ______

**Q13. O envio com resposta ambígua.** Se, alguma vez, o envio mostrou "confira em Enviados" (resposta sem confirmação do
servidor), a Mensagem NUNCA é reenviada sozinha. Isso apareceu no teste? Resposta (apareceu? sim/não): ______

**Q14. A trava de um leitor só por Canal atrás do pooler.** Com a api rodando na VM, o `journalctl` mostrou algum aviso do
leitor sobre a trava ou a conexão dedicada (por exemplo, a conexão que cai e o supervisor refazendo)? Resposta (sim/não; o nome do
aviso): ______

---

## Como entregar o resultado

Cole na conversa as linhas "Resultado" de cada bloco e as respostas Q1 a Q14, ou "parei no passo N" com o nome do erro. **Sem senha,
token, chave, endereço de e-mail real nem o conteúdo de nenhum e-mail.** O que voltar com "não" vira item de
`/gsd-plan-phase 17 --gaps`; o que voltar com "sim" fecha o 9.4.4 e vai para o `17-16-SUMMARY.md`.

Depois de provar, o cronograma (`docs/09-planejamento/dados/andamento.mjs`) só é atualizado por você, porque marcar a Sessão 9
como feita depende deste resultado.
