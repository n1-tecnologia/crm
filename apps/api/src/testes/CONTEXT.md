# testes — harness, não produção

Ler primeiro: [`../../CONTEXT.md`](../../CONTEXT.md) e [`../CONTEXT.md`](../CONTEXT.md)

## O que mora aqui

Só peças consumidas por teste: `criarServidorFalso` (um servidor HTTP real
que injeta timeout, resposta perdida, atraso e fila vazia) e `relogioFixo`/
`relogioDoSistema` (a fonte de instante que o código sob teste lê).
`outbox-worker.ts` importa `Relogio`/`relogioDoSistema` daqui — é a exceção
prevista desde o Plan 02-01 (para os Planos 02-10, 02-17 e 02-24): o worker
precisa de um relógio injetável em produção, não só no teste, e
`relogioDoSistema` é a implementação real desse contrato, não um duplo de
teste.

`processo-que-encerra.ts` (Fase 16, 16-18) é um processo, não uma biblioteca: `encerramento.test.ts` o sobe como filho com
o mesmo `vite-node` da unidade systemd e manda SIGTERM de verdade. Sobe um Fastify com um fluxo SSE longo, em porta
escolhida pelo sistema, imprime `PRONTO <porta>` e roda em três modos: o tratador novo (`criarEncerramento`), `MODO=antigo`
(só um ouvinte de SIGTERM que para o worker, o comportamento que levava ao SIGKILL) e `TRAVAR_PARADA=1` com `TETO_MS`
(a parada nunca resolve, o teto corta). Ele **não usa o `index.ts`** de propósito: a subida do `index.ts` carrega o arquivo
de ambiente da api, que aponta para produção. O filho recebe só `PATH`, `HOME` e as variáveis do modo, e não abre conexão
com banco. A ligação do `index.ts` ao tratador é conferida por `tsc` e pela publicação, não por este processo.

## Por que o servidor é real, não um mock de `fetch`

O worker de outbox e o adapter do financeiro chamam `fetch` de verdade. Um
mock de `fetch` intercepta a chamada antes que qualquer coisa sobre o
transporte aconteça — e é exatamente o transporte (timeout, socket
derrubado, corpo perdido) que os planos de outbox (02-10), fila (02-17) e
fallback de 90 dias (02-24) precisam provar falhando de verdade. Por isso
`servidor-falso.ts` sobe em `node:http` numa porta efêmera (`listen(0)`) e
fecha por `fechar()`.

## A regra do `Relogio`

`Relogio` é sempre injetado — por parâmetro ou por opção de fábrica — nunca
por variável global nem por `new Date()` direto no caminho de produção. Um
código que decide a janela de 90 dias ou o backoff do outbox chamando
`new Date()` diretamente não tem como ser testado sem esperar tempo real;
recebendo um `Relogio`, o teste avança o tempo com `avancar(ms)` ou pula
direto para um instante com `definir(instante)`.

## O armazenamento falso (`armazenamento-falso.ts`, Fase 16)

`criarArmazenamentoFalso()` é a mesma porta `ArmazenamentoDeAnexos` (`servicos/armazenamento-de-anexos.ts`) que o
bucket do Supabase, em memória, para os testes de rota, de mídia e e2e da mensageria rodarem sem rede e sem a
service role. Nunca chama o Storage real. Confere o que o real confere (o objeto pertence à sessão, existe, respeita
o teto do tipo e a assinatura do conteúdo bate com o tipo reservado, pela mesma função pura de `storage-uploads.ts`);
a única diferença de propósito é que a sessão consumida vive em memória e não volta atrás num `rollback`. Os métodos
depois de `listar` são só do teste (`colocarBytes` faz o papel do navegador subindo o arquivo pelo ticket). Por isso
**nada da Fase 16 foi provado contra o Storage real**: `storage-uploads.test.ts` é o único teste que o toca, e só
roda com as chaves do Supabase.

## Dublês de e-mail (Fase 17, 17-02)

`servidor-de-email-falso.ts` sobe, num só `iniciarServidorDeEmailFalso`, um IMAP e um SMTP de verdade em `127.0.0.1`, em
porta efêmera, com TLS. É o mesmo princípio do `criarServidorFalso`: o `imapflow` e o `nodemailer` conversam com ele pelo
socket, nunca por mock, porque o que os planos de conexão, leitura e envio têm de provar é o transporte (certificado,
SNI, autenticação, queda, silêncio).

- **IMAP** (`imapkit`, usado como módulo): LOGIN, PLAIN e XOAUTH2 (a lista de tokens de cada usuário, não só um), IDLE
  com aviso de mensagem nova (`adicionarMensagem`), `recriarCaixa` (UIDVALIDITY novo; as mensagens ficam renumeradas e
  as sessões abertas recebem `BYE`), pasta de enviados marcada `\Sent` por SPECIAL-USE (de nome `Enviados`, de propósito:
  o código tem de achá-la pelo atributo, não pelo nome), `mensagensDaPasta`, `conexoesImap()` (endereço remoto e SNI),
  `derrubarConexoes()` e `fechar()`.
- **SMTP** (`smtp-server`): guarda o envelope e o `DATA` cru de cada envio em `entregues`, aceita PLAIN, LOGIN e
  XOAUTH2 e se programa por `programarSmtp` para recusar `RCPT` (`recusarRcpt`), recusar o `DATA` (`recusarData`),
  ficar mudo depois do `DATA` (`mudoNoData`, o caso ambíguo: a entrega fica registrada e o cliente não recebe resposta)
  ou recusar o login (`recusarAuth`). Uma regra vale para o próximo envio (o próximo login, no `recusarAuth`) e some.
- **O certificado** (`certificado-de-teste.ts`) é gerado na hora pelo binário `openssl` (SAN `localhost`,
  `imap.caixa.teste`, `smtp.caixa.teste` e `127.0.0.1`), num diretório temporário apagado em seguida, e fica só na
  memória do processo. Nunca é commitado (T-17-04) e só chega ao cliente como `ca` injetada pelo teste (T-17-05): o
  código de produção não ganha nenhum desvio de TLS. **Exige `openssl` no PATH**; sem ele o teste falha alto.
- **Nenhum teste fala com caixa real**, Google ou Microsoft.
- **`fechar()` espera 50 ms antes de derrubar os sockets** (17-03): destruir, no mesmo instante, o socket cru de um
  handshake TLS que o cliente acabou de recusar (certificado inválido) derruba o processo do Node com `SIGSEGV` (Node
  24.14). Quem testa "sem a CA" não precisa fazer nada; só não troque o respiro por um `destroy()` imediato.
- **143 e 587 (STARTTLS) não têm dublê próprio:** o IMAP e o SMTP falsos só falam TLS direto. O que um teste precisa de
  um servidor SEM STARTTLS (para provar que a plataforma o recusa) monta ele mesmo, um `SMTPServer` com
  `disabledCommands: ["STARTTLS"]` ou um `node:net` que só saúda (ver `provedores/email/erros.test.ts`).

**Resultado do spike (pressuposto A1): o `imapkit` 5.3.2 serviu.** Não foi preciso o dublê escrito à mão. Entrega TLS
programático (`secureConnection` + `credentials`), XOAUTH2 que o `imapflow` aceita, inserção por API de controle,
troca de UIDVALIDITY (`resetUidValidity`) e SPECIAL-USE. Um limite dele, que vale para quem usar o dublê: a árvore de
caixas é **uma só por servidor** ("single user, multiple connection"). Vários `usuarios` autenticam com credenciais
próprias, mas veem as mesmas pastas e mensagens; o argumento `usuario` de `adicionarMensagem`, `recriarCaixa` e
`mensagensDaPasta` não separa nada. Um teste que precisa de duas caixas distintas sobe dois servidores. O `smtp-server`
e o `imapkit` trazem os próprios tipos; por isso os três `@types` (nodemailer, mailparser, smtp-server) ficam de fora.
