# Phase 17: E-mail: conectar a caixa, receber e enviar (Sessão 9) - Context

**Gathered:** 2026-11-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Sessão 9 do cronograma (`docs/09-planejamento/TAREFAS-POR-SESSAO.md`, 9.1 a 9.4, 14 subtarefas). Quem usa a plataforma conecta, pela ficha do Canal, uma caixa de e-mail que já tem: o e-mail que chega vira Conversa no Contato do remetente, e a resposta escrita na Caixa de Entrada sai pela mesma caixa, no mesmo fio, com assunto, cópias e anexo. É o quarto e último provedor real da mensageria da Fase 16 (depois da Evolution, do Instagram e do WhatsApp oficial), e usa a mesma base: fila de entrada, `receberMensagem`, outbox, worker de saída, cofre, mídia e tempo real.

Hoje não existe nada de e-mail no código além do que já estava pronto: o provedor `email-imap-smtp` existe só como valor (`packages/dominio/src/provedores-de-canal.ts`), o Canal nasce com o endereço como identificador, a `008` já tem `assunto`, `enderecos_adicionais` e `em_resposta_a_id` em `plataforma.mensagens`, a Caixa de Entrada já mostra o campo de assunto quando o Canal tem `hasSubjectAndCopies`, e o contrato `EnvioAoProvedor` já tem `assunto`. Não há `imapflow`, `nodemailer` nem `mailparser` nas dependências, e a próxima migração livre é a `017`. A ficha do Canal de e-mail só tem um quadro reservado de texto (`apps/web/src/features/crm/conectar-canal.ts`).

**Decidido pelo dono em 2026-11-19 (não se reabre aqui):** a pessoa conecta a própria caixa pela plataforma, por três caminhos na tela: **senha ou senha de app** (qualquer servidor IMAP e SMTP), **entrar com o Google** e **entrar com a Microsoft** (OAuth, sem senha). Gmail API e Microsoft Graph ficam fora.

**Pronto quando (da fase):** (a) nos testes automáticos, com IMAP, SMTP e servidor de login falsos: a conexão por senha e a por login gravam a credencial no cofre e deixam o Canal `conectada`, uma senha errada ou um login recusado não grava nada, um e-mail novo na caixa vira Conversa em até 2 min sem repetir ao reiniciar, uma troca de três e-mails fica numa Conversa só, e a resposta sai com `In-Reply-To` e `References` certos; (b) **com caixas reais** (9.4.4, do dono): em Gmail com senha de app, Microsoft 365 com login e hospedagem comum com senha, o e-mail com anexo vira Conversa, a resposta aparece no mesmo fio no programa de e-mail do remetente e o anexo vai e volta. O login do **Google** só se prova com conta real em **modo de teste** enquanto o Google não verificar o app (ver D-17-02).

**Requisitos derivados** (ids locais da fase, como os MSG da Fase 16; o planejador os confirma):
- **EML-01** — conectar por senha ou senha de app: abre IMAP e SMTP antes de gravar, devolve qual dos dois falhou, nunca devolve nem registra a senha (9.2.1, 9.2.4).
- **EML-02** — conectar com o login do Google e da Microsoft: token de renovação no cofre, o endereço da conta tem de ser o do Canal (9.2.2, 9.2.4).
- **EML-03** — receber: o e-mail novo da caixa de entrada vira Conversa em até 2 min; reiniciar a API não repete Mensagem; o histórico anterior à conexão não é importado (9.3.1, 9.3.2).
- **EML-04** — o mesmo fio: `In-Reply-To` e `References` juntam as respostas na mesma Conversa (9.3.3).
- **EML-05** — enviar: assunto, cópias, `Message-ID` próprio, fio, anexos e cópia em Enviados (9.4.1 a 9.4.3).
- **EML-06** — segurança do servidor que o usuário digita: a API não abre conexão para dentro da rede nem em texto puro (D-17-07).
- **EML-07** — conexão que cai é avisada na ficha e deixa de ser tentada (9.2.3).

Não entra: importar o histórico da caixa (D-17-08); ler outras pastas além da caixa de entrada e e-mail mandado por outro programa pela mesma caixa; Gmail API e Microsoft Graph (opção C, fora por decisão do dono); aviso instantâneo de e-mail novo por push (só `IDLE` e conferência periódica); Agente na Caixa (Sessão 16); política de retenção do `corpo` das chamadas (Sessão 19); criar o app de login no Google e na Microsoft e o pedido de verificação do Google (9.1.3, é do dono e corre em paralelo); WhatsApp, Instagram e Reunião.

</domain>

<decisions>
## Implementation Decisions

Esta discussão rodou em modo automático (`--auto`): o que o dono já tinha decidido está marcado como **dono**; o resto é a opção recomendada, marcada **[auto]**, e vale até alguém mudar. As [auto] mais pesadas, para o dono conferir: D-17-07, D-17-08, D-17-10 e D-17-15.

### Decidido pelo dono (2026-11-19)
- **D-17-01 (dono):** **Senha ou senha de app e login OAuth do Google e da Microsoft entram; Gmail API e Microsoft Graph ficam fora.** Quem usa a plataforma conecta a própria caixa pela ficha do Canal; a tela oferece "Entrar com o Google", "Entrar com a Microsoft" e "Outro servidor". — **Reversibility:** costly — as rotas, a tela, a tabela da conta e as variáveis `GOOGLE_OAUTH_*` e `MICROSOFT_OAUTH_*` nascem com os dois jeitos; tirar um deles depois remove rota, tela e coluna.
- **D-17-02 (dono):** **Ordem de construção: senha primeiro, depois Microsoft, depois Google.** O código do login se escreve e testa contra um servidor de login falso, sem esperar os apps. O dono cria os apps em paralelo (9.1.3; ele começou em 19/11, sem dizer qual). A verificação do Google corre por fora: se não tiver saído quando a fase terminar, o login do Google fica provado só em modo de teste (poucas contas, conexão pode cair a cada 7 dias) e a senha de app cobre o Gmail. — **Reversibility:** reversible — é ordem de trabalho e o corte do "pronto".

### Padrão do provedor e da conexão
- **D-17-03 [auto]:** **O e-mail é um `ProvedorDeMensageria` em `apps/api/src/mensageria/provedores/email/`, registrado em `registro.ts`**, no molde do Instagram e do WhatsApp oficial (cliente, conexão, configuração, entrada, repositório, traduzir, `do-ambiente`). Só é registrado com a configuração mínima: o cofre (`COFRE_CHAVE`) para qualquer caminho, e o par `*_OAUTH_CLIENT_ID`/`*_OAUTH_CLIENT_SECRET` de cada serviço para o botão correspondente. Senha de app não pede variável própria. Sem o par, o botão do serviço não é oferecido e a rota responde 503 dizendo o que falta. As rotas são **do provedor**, não `POST /canais/:id/conectar` (que responde 409 `PROVEDOR_ERRADO` para quem não conecta por QR code): `POST /canais/:id/email/conectar` (senha), `POST /canais/:id/email/oauth/:servico/autorizar`, `POST /canais/email/oauth/concluir` e `GET /canais/:id/email/conta`. Isso **corrige** o texto da 9.2.1, que previa `conectar`. — **Reversibility:** reversible — é onde moram as rotas.
- **D-17-04 [auto]:** **O login OAuth segue o Instagram: `autorizar` devolve a URL do provedor com `state` assinado, a volta cai numa página da WEB** (`.../canais/email/retorno`), **que chama `concluir` com a sessão do Membro**, e o serviço confere que Membro e Espaço do `state` são os da sessão. Impede ligar a caixa a um Canal de outra pessoa com um link pronto. Isso **corrige** o desenho da 9.2.2, que punha a volta na API. A URI de retorno é cadastrada no Google e na Microsoft e fica numa variável (`EMAIL_OAUTH_REDIRECT_URI`), igual, letra por letra, à dos dois painéis. — **Reversibility:** costly — a URI é cadastrada nos dois painéis; mudar de lugar obriga a recadastrar nos dois.
- **D-17-05 [auto]:** **Credencial no cofre, o que não é segredo em tabela própria.** A credencial (`plataforma.credenciais`, tipo `email-imap-smtp`, cifrada, 009) guarda `{ usuario, senha }` ou, no login, `{ servico, refreshToken }`; nunca sai em rota, log ou erro, e o contrato de provedor (`descreverContratoDoProvedor`) já exige que nenhum resultado nem erro a carregue. O que não é segredo (servidor e porta e segurança de IMAP e SMTP, tipo de login, endereço da conta, estado do leitor, cursor) vai em tabelas da migração **`017`**, no molde de `instagram_contas` (014): uma por conta e uma por cursor (`cursores_de_canal` da 9.3.1) ou tudo na conta, a critério do planejador. Uma conta por Canal, e o endereço é do Canal. O token de acesso (curto, cerca de 1 h) é renovado de forma preguiçosa quando vai ser usado (padrão `token.ts` do Instagram), e o leitor reconecta com token novo quando a sessão cair. — **Reversibility:** one-way — a `017` aplicada é imutável, e o formato da credencial no cofre é lido por conexão, leitor e envio.
- **D-17-06 [auto]:** **Quem pode conectar, desconectar e ver a conta** segue a mesma regra dos outros provedores (`exigir` no serviço de Canal). Desconectar e arquivar apagam a credencial do cofre e a conta, não só revogam, e, no login, pedem ao provedor a revogação do token quando der (falha dessa revogação não impede apagar). O leitor para quando o Canal arquiva. — **Reversibility:** reversible.

### Segurança do servidor que o usuário digita (o plano não tinha)
- **D-17-07 [auto]:** **"Outro servidor" deixa a pessoa digitar host e porta, o que faz o `apps/api` abrir conexão para onde ela mandar** (varredura de portas e acesso à rede interna da VM, como o Postgres em `127.0.0.1`). Regras: só as portas 993 (IMAP com TLS), 143 (IMAP com STARTTLS obrigatório), 465 (SMTP com TLS) e 587 (SMTP com STARTTLS obrigatório); nunca em texto puro; certificado sempre válido, sem opção de aceitar inválido; o servidor resolve o host e **recusa se qualquer IP for de loopback, rede privada, link-local ou metadados de nuvem** (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `::1`, `fc00::/7`, `fe80::/10`), e a conexão vai ao IP já conferido (sem reconsultar o DNS, para o rebinding não passar); tempo limite de conexão e de resposta. O erro devolvido à tela é **classificado** (não conectou, certificado inválido, tempo esgotado, usuário ou senha recusados) e só repete a frase do servidor quando a conexão chegou a autenticar, para o endpoint não servir de sonda de rede. As predefinições de Gmail e Outlook ficam no servidor, não vêm do cliente. — **Reversibility:** reversible — é uma guarda no cliente de conexão; afrouxar é trocar a lista.

### Receber
- **D-17-08 [auto]:** **Sem importar o histórico.** Ao conectar, o cursor começa no `UIDNEXT` da caixa de entrada naquele momento: só entra e-mail que chegar depois. Importar o passado fica como ideia adiada. Motivo: uma caixa com milhares de e-mails viraria milhares de Conversas, Contatos e Tarefas conversacionais de uma vez. O plano não dizia isso. Se o `UIDVALIDITY` mudar, o leitor recomeça do `UIDNEXT` novo e registra o fato, sem reimportar; a idempotência por Message-ID (D-17-10) impede duplicar o que já entrou. — **Reversibility:** reversible — é o valor inicial do cursor.
- **D-17-09 [auto]:** **Só a caixa de entrada (`INBOX`), lida por um processo dentro do `apps/api`:** uma sessão IMAP por Canal conectado, escutando por `IDLE` e conferindo a cada 2 min como reserva, ligada por `EMAIL_LEITOR_ATIVO` (desligada no ambiente local e fixada em `false` na unidade de produção até o dono ligar, como a `MENSAGERIA_WORKER_ATIVO`). Cada Canal é lido por um processo por vez (`pg_try_advisory_lock` por Canal, o padrão da coleta de órfãos). Reconexão com espera crescente em queda de rede. Sem a variável, nada entra, e o `CONTEXT.md` da mensageria precisa dizer isso. — **Reversibility:** reversible — é onde o leitor sobe.
- **D-17-10 [auto]:** **O leitor entrega à fila `plataforma.webhooks_recebidos`; quem cria Contato, Conversa e Mensagem é o `processador-de-entrada` que já existe**, por `receberMensagem`. A linha tem o provedor `email-imap-smtp` e `chave` igual ao `Message-ID` (o índice único `(workspace_id, canal_id, chave)` da `013` dá a idempotência). O `corpo` leva o e-mail já interpretado (remetente, destinatários, assunto, cabeçalhos de fio, texto, referências aos arquivos), **nunca o MIME cru**; anexos e HTML são guardados no bucket pela mídia da Fase 16 **antes** de entrar na fila (como a mídia da Evolution), e a falha grava o e-mail com anexo `baixado: false`, sem derrubar a Mensagem (D-16-08). O contrato `ProvedorDeMensageria` foi desenhado para webhook (`verificarChamada`, `interpretarChamada`): o e-mail é o primeiro provedor que **busca** em vez de ser chamado, então o planejador decide como o contrato o acomoda (campo opcional, ou um `verificarChamada` que sempre recusa chamada externa), sem quebrar o conjunto de contrato. — **Reversibility:** costly — o formato do `corpo` é lido pelo processador e pelo tradutor; mudar depois mexe nos dois e nos testes de contrato.
- **D-17-11 [auto]:** **O que não vira Conversa:** resposta automática (`Auto-Submitted` diferente de `no`), aviso de não entrega (`multipart/report`, remetente `MAILER-DAEMON`), lista e promoção (`Precedence: bulk`, `list` ou `junk`) e e-mail cujo `From` é o próprio endereço do Canal (evita laço). Cada um entra na fila como `ignorado:<motivo>`, como nas outras fontes, para dar para auditar. Descartar por `List-Unsubscribe` fica para a pesquisa, porque pode jogar fora e-mail legítimo de cliente que usa ferramenta de envio em massa. — **Reversibility:** reversible.
- **D-17-12 [auto]:** **O Contato é o endereço do `From`**: minúsculas, sem o nome (`normalizarIdentificadorDeContato`, tipo `email`); Contato desconhecido nasce `automatico_mensagem` com o nome do cabeçalho, se vier; Contato arquivado ou na lixeira volta a `ativo` (RN-CON-13), como nos outros Canais. A mesma Conversa 1:1 do par Contato e Canal vale quando não há cabeçalho de fio. — **Reversibility:** reversible.
- **D-17-13 [auto]:** **O HTML do e-mail** fica guardado como anexo `text/html` no bucket e **só é limpo na hora de mostrar**: sem script, sem `<iframe>`, `<object>` ou `<form>`, sem imagem remota carregando sozinha (rastreamento), links com `rel="noopener noreferrer"` abrindo em outra aba; o texto puro vai para `conteudo`. A biblioteca de limpeza e se a limpeza é no servidor ao servir ou na tela ficam para a pesquisa. O download de qualquer anexo sai sempre como anexo, nunca aberto no navegador (D-16-09). — **Reversibility:** reversible.
- **D-17-14 [auto]:** **O fio.** Função pura no domínio, `mensagemRespondida(cabecalhos, buscarPorIdExterno)`, procura o `In-Reply-To` e, se não achar, cada id de `References`, do último para o primeiro, entre as Mensagens do Canal. Achou: a Mensagem nova vai para a Conversa daquela (reabrindo se estiver resolvida) e grava `em_resposta_a_id`. Não achou: a regra de sempre (Conversa aberta do par, ou nova). Assunto começando com "Re:" **sem** cabeçalho não junta sozinho. — **Reversibility:** reversible.
- **D-17-15 [auto]:** **Resposta de outra pessoa no mesmo fio** (um colega que estava em cópia responde): junta na mesma Conversa pelo cabeçalho, grava o `remetenteExterno` verdadeiro na Mensagem e **não troca o Contato da Conversa** nem abre outra. Um Contato novo só nasce se o remetente for desconhecido, como sempre. É a opção mais simples; o dono deve confirmar se prefere separar por remetente. — **Reversibility:** costly — mexe em `receberMensagem` e na regra de qual Conversa recebe a Mensagem, que as Sessões 5 e 16 usam.

### Enviar
- **D-17-16 [auto]:** **A saída é a da Fase 16:** a resposta nasce `pendente`, grava `mensagem.enviar.v1` no outbox na mesma transação e sai pelo worker de saída, que chama `enviar` do provedor (`nodemailer` com a credencial do cofre; senha, ou token por XOAUTH2). `Message-ID` gerado por nós, com o domínio do endereço do Canal, e gravado em `id_externo` **antes** de enviar; `In-Reply-To` e `References` com a Mensagem respondida e as anteriores do fio; resposta sem assunto usa "Re: " mais o assunto da última recebida; corpo em texto e em HTML simples. Resposta ambígua (tempo esgotado depois de o servidor aceitar o `DATA`) **nunca é reenviada sozinha**, como nas outras fontes. Sem caminho de envio paralelo. — **Reversibility:** reversible.
- **D-17-17 [auto]:** **Cópia em Enviados:** gravar por IMAP (`APPEND`) na pasta marcada como `\Sent` só quando o servidor não guarda sozinho. O Gmail guarda (pular o `APPEND`, senão aparece duas vezes); no Microsoft 365 o envio por SMTP autenticado também costuma guardar, mas **isso se confere na prova real (9.4.4)** antes de decidir se o `APPEND` fica. Em "Outro servidor", `APPEND`. Falha do `APPEND` **não** faz a Mensagem falhar (ela já saiu): registra e segue. — **Reversibility:** reversible.
- **D-17-18 [auto]:** **Anexos** entram e saem pela mídia da Fase 16. Teto de 20 MB no total por e-mail enviado, com a frase "O e-mail passa de 20 MB: muitos servidores recusam."; na entrada vale o D-16-08 (acima do teto, ou download que falha, grava `baixado: false` com nome e tipo, nunca derruba a Mensagem). Imagens embutidas (`cid:`) viram anexo e o HTML limpo as referencia. Tipo fora da lista `TIPOS_ACEITOS_NA_MENSAGEM` (D-16-09) nunca é servido ao navegador: fica `baixado: false` com nome e tipo visíveis, e o planejador decide se a lista cresce para o que o e-mail costuma trazer (por exemplo `message/rfc822` e `text/calendar`). — **Reversibility:** reversible.
- **D-17-19 [auto]:** **A tela leva o assunto e as cópias ao servidor.** `NovaMensagem` e o esquema `NOVA_MENSAGEM` (`strict`) ganham `assunto` e `enderecosAdicionais` (para, cópia e cópia oculta), aceitos **só** quando o Canal tem `hasSubjectAndCopies` (`validarNovaMensagem` recusa nos outros), e a tela ganha os campos de cópia e cópia oculta. O campo de assunto que a tela mostra hoje não chega ao servidor. — **Reversibility:** reversible.

### Queda da conexão
- **D-17-20 [auto]:** **Conexão que cai** (senha trocada, acesso revogado, renovação recusada, ou os 7 dias do modo de teste do Google): o Canal passa a `desconectada` com o motivo, o leitor **para de tentar** (sem laço contra o servidor do cliente), a ficha mostra o motivo e o botão para entrar de novo, e as Mensagens `pendente` ficam e são reenfileiradas quando o Canal voltar a `conectada` (B69, como o Instagram). Falha transitória (rede, servidor fora) reconecta com espera crescente e **não** muda o estado do Canal. — **Reversibility:** reversible.

### Claude's Discretion
- A ordem e o corte em planos, respeitando: domínio antes de api antes de tela (`mensagemRespondida` e `NovaMensagem` no domínio; a migração `017` antes do que a usa; o núcleo da conexão por senha, **com a guarda de D-17-07**, antes do leitor e do envio; o login com servidor falso depois; a tela por último; a prova real com as caixas do dono ao fim). O OAuth e a tela dele só dependem dos apps na prova final, não para escrever.
- Os **dublês de teste** de IMAP, SMTP e login: o molde é `apps/api/src/testes/servidor-falso.ts`; a pesquisa escolhe entre `smtp-server` do nodemailer mais um IMAP mínimo e um servidor de e-mail de teste em Docker, só nos testes que já exigem o Postgres local.
- A biblioteca de limpeza do HTML (D-17-13); o escopo mínimo do Google (`https://mail.google.com/` é o único de IMAP e SMTP) e se o app aceita só o necessário; a rotação do token de renovação da Microsoft; o tamanho máximo do texto no `corpo` da fila; o limite de sessões IMAP simultâneas por processo e o intervalo do `IDLE` (as sessões caem se ficarem mudas); como o contrato de provedor acomoda o provedor que busca (D-17-10); o tratamento de `UIDVALIDITY`; descartar por `List-Unsubscribe`; se o leitor e o processador de entrada sobem pela mesma flag.
- O texto, em português de produto, dos erros de conexão (o plano dá "O servidor IMAP recusou o usuário ou a senha." como exemplo) e dos estados da ficha.
- Quem fica de dono do Contato criado por e-mail de endereço desconhecido e em qual Fila cai a Conversa: vale o que a Fase 16 definiu (`canal.proprietario_padrao_id`, senão `canal.configurado_por`, e `fila_padrao_id` do Canal).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### O plano desta fase
- `docs/09-planejamento/TAREFAS-POR-SESSAO.md` — Sessão 9 (linha ~2036), 9.1 a 9.4, atualizada em 19/11: 9.1.2 decidida (A e B), 9.1.3, 9.2.2 e 9.2.3 novas. **Os números de linha e alguns caminhos citados ali envelheceram** (as capacidades do e-mail estão em `packages/dominio/src/crm/capacidades.ts`, não em `operations/conversations.ts`; `NovaMensagem` está hoje em `packages/dominio/src/crm/mensagens.ts:135` e `EnderecoAdicional` em `:75`; o provedor mora em `apps/api/src/mensageria/provedores/email/`): procurar de novo antes de planejar. Onde a 9.2.1 e a 9.2.2 divergem de D-17-03 e D-17-04, valem as decisões.
- `docs/09-planejamento/PLANO-DE-IMPLEMENTACAO.md` — Sessão 9 e o risco da verificação do Google. `docs/09-planejamento/dados/` (`parte-d.mjs`, `andamento.mjs`) — fonte do cronograma; o `.md` e o `.html` são gerados por `gerar.mjs`, nunca editados à mão; o `andamento.mjs` registra o que está feito.
- `.planning/ROADMAP.md` — "Phase 17".

### A mensageria e os moldes de provedor
- `apps/api/src/mensageria/CONTEXT.md` — a mensageria inteira (fila, processador, saída, tempo real, mídia, flags).
- `apps/api/src/mensageria/provedores/instagram/CONTEXT.md` — **o molde do login OAuth**: `autorizar` com `state` assinado (`estado.ts`), volta na web, `concluir` com a sessão, token renovado de forma preguiçosa (`token.ts`), tabelas próprias (014), desconectar apaga, reenfileira as `pendente`.
- `apps/api/src/mensageria/provedores/whatsapp-cloud/CONTEXT.md` — o molde de "conectar por formulário" (credencial só no corpo, vai ao cofre, nunca volta).
- `apps/api/src/mensageria/provedor.ts` (contrato `ProvedorDeMensageria`, `EnvioAoProvedor.assunto`, `ErroDeProvedor`), `registro.ts` (`registroPadrao`, `provedorDoCanal`, `canalParaProvedor`), `contrato-do-provedor.ts` (`descreverContratoDoProvedor`), `processador-de-entrada.ts`, `entregar-mensagem.ts`, `fila-de-saida.ts`, `midia.ts`, `avisar.ts`.
- `apps/api/migracoes/008-canais-conversas-mensagens.sql` (colunas `assunto`, `enderecos_adicionais`, `em_resposta_a_id`), `009-seguranca-e-cofre.sql` (`plataforma.credenciais`), `013-mensageria.sql` (`webhooks_recebidos`, índice `(workspace_id, canal_id, chave)`), `014-instagram.sql` (molde de `instagram_contas`). Todas aplicadas e imutáveis; a próxima é a `017`.
- `apps/api/src/rotas/crm/instagram.ts` e `rotas/crm/whatsapp-oficial.ts` — o molde das rotas por provedor; `rotas/crm/canais.ts` (`POST /canais/:id/conectar` responde 409 para quem não conecta por QR).
- `apps/api/src/servicos/crm/mensagens.ts` (`enviar`) e `rotas/crm/mensagens.ts` (esquema `NOVA_MENSAGEM`, `strict`).

### O domínio
- `packages/dominio/src/provedores-de-canal.ts` (`email-imap-smtp`), `crm/capacidades.ts` (capacidades do `email`, `sendableMediaTypes`, `foraDaJanela`), `crm/mensagens.ts` (`NovaMensagem`, `EnderecoAdicional`, `validarNovaMensagem`, `statusInicialDeEnvio`), `crm/canais.ts` (`proximaConexao`, `conferirNumeroConectado`), `crm/conversas.ts` (`TIPO_DE_IDENTIFICADOR_DO_CANAL`, `destinoDaRecebida`), `crm/normalizacao.ts` (`normalizarIdentificadorDeContato`, e-mail em minúsculas).
- `ontologia/03-crm/caixa-de-entrada-e-mensageria.md` — RN-CXE-09 (reabertura), RN-CON-13 (Contato arquivado volta a `ativo`).

### A tela
- `apps/web/src/features/crm/conectar-canal.ts` (o quadro reservado "Servidores IMAP e SMTP"), `conectar-provedor.tsx`, `ficha-do-canal.test.tsx`, `conversation-thread.tsx` (campo de assunto com `hasSubjectAndCopies`, ~1182-1190); a página de retorno do login do Instagram em `apps/web/src/app/(shell)/crm/caixa-de-entrada/configuracoes/canais/instagram/retorno` é o molde da do e-mail.

### Fases anteriores
- `.planning/phases/16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia/16-CONTEXT.md` — D-16-01 a D-16-10 (SSE, fila, saída, mídia, tetos, tipos aceitos).
- `.planning/phases/15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant/15-CONTEXT.md` — o CRM novo como único no código.
- `CONTEXT.md` (raiz) — "Estado atual"; **atualizar** ao fim da fase (nasce o provedor de e-mail, a `017` e a flag `EMAIL_LEITOR_ATIVO`).

### Referências externas (conferir antes de depender)
- [XOAUTH2 do Gmail (Google)](https://developers.google.com/workspace/gmail/imap/xoauth2-protocol) — o escopo de IMAP e SMTP é `https://mail.google.com/`.
- [OAuth para IMAP e SMTP no Exchange Online (Microsoft)](https://learn.microsoft.com/en-us/exchange/client-developer/legacy-protocols/how-to-authenticate-an-imap-pop-smtp-application-by-using-oauth) — escopos `IMAP.AccessAsUser.All`, `SMTP.Send` e `offline_access`, do recurso `https://outlook.office.com/`.
- [EmailEngine e Gmail](https://docs.emailengine.app/emailengine-and-gmail) — **fonte de terceiros**: classifica o escopo do Google como restrito e fala em avaliação de segurança (CASA) para app público. **Não foi conferido na página oficial do Google**; conferir antes de pedir a verificação (9.1.3).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- A fila de entrada (`webhooks_recebidos`, `processador-de-entrada.ts`) e `receberMensagem`: o leitor só precisa enfileirar; Contato, Conversa, Mensagem, tempo real e Tarefa conversacional já saem de lá.
- `descreverContratoDoProvedor` (`contrato-do-provedor.ts`): o conjunto de testes de contrato que todo provedor roda, inclusive "nenhum resultado nem erro carrega a credencial".
- O outbox e o worker de saída (`mensagem.enviar.v1`, `entregar-mensagem.ts`): o envio já é assíncrono, com tentativa e "Tentar de novo".
- A mídia (`midia.ts`, `storage-uploads.ts`): guarda anexo recebido no bucket, confere tipo e assinatura, serve por URL assinada; o teto de D-16-08.
- O cofre (`plataforma.credenciais`, `COFRE_CHAVE`) e o molde de `token.ts`, `estado.ts` e `conexao.ts` do Instagram para o login.
- `normalizarIdentificadorDeContato` (e-mail em minúsculas) e `detentorDoIdentificador`: achar o Contato pelo endereço sem código novo.
- `pg_try_advisory_lock`, como em `coletarOrfaos`: um leitor por Canal.
- `criarServidorFalso` (`apps/api/src/testes/servidor-falso.ts`): o molde dos dublês de teste.

### Established Patterns
- Domínio primeiro, depois a api, depois a tela; o domínio não conhece ninguém, e a web e a api nunca se importam.
- Provedor real = pasta em `mensageria/provedores/<nome>/` com `CONTEXT.md`, registrado só com a configuração mínima; rota própria por provedor; credencial no cofre, parte pública em tabela própria; migração numerada e imutável.
- Rota pública marca `config: { publica: true }`; o login do Instagram **não** é público: `autorizar` e `concluir` rodam com a sessão do Membro.
- Resposta ambígua nunca é reenviada sozinha; recusa permanente grava `falhou` com `motivo_falha`; falha transitória volta à fila na escada de `backoff()`.
- Testes de persistência pulam sem `DATABASE_URL` e rodam contra Postgres 16 em Docker local; o gate é `npm run check` em Docker (memória `gsd-gate-de-testes-baseline`); o `check` do CI pula os de banco.
- Flags de worker: `MENSAGERIA_WORKER_ATIVO` e `COLETA_DE_ORFAOS_ATIVA` sobem em `apps/api/src/index.ts`; a unidade de produção fixa algumas em `false` e ligar pede um drop-in como root (só o dono).

### Integration Points
- `registro.ts` (`registroPadrao`) ganha o provedor `email-imap-smtp`; `index.ts` ganha o leitor por `EMAIL_LEITOR_ATIVO`.
- `receberMensagem` ganha o passo de `mensagemRespondida` antes de decidir a Conversa (D-17-14, D-17-15), e as Sessões 5 e 16 usam o retorno dele (`contatoNovo`, `conversaNova`, `conversaReaberta`, `repetida`).
- `ServicoDeMensagens.enviar` e o esquema `NOVA_MENSAGEM` ganham assunto e cópias (D-17-19).
- A ficha do Canal de e-mail troca o quadro reservado pelos três caminhos de conexão; o estado `desconectada` com motivo aparece nela.
- `apps/api/deploy/CONTEXT.md` e o `api.env`: as variáveis novas (`EMAIL_LEITOR_ATIVO`, `EMAIL_OAUTH_REDIRECT_URI`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `MICROSOFT_OAUTH_CLIENT_ID`, `MICROSOFT_OAUTH_CLIENT_SECRET`) só o dono põe, direto no arquivo, nunca por conversa.

</code_context>

<specifics>
## Specific Ideas

- O dono quer que **o próprio usuário conecte a caixa pela plataforma**, sem ajuda: a tela é o produto, não um script de linha de comando como foi o `canal:ligar-evolution`.
- A frase de erro do plano para a senha errada é "O servidor IMAP recusou o usuário ou a senha."; a do teto é "O e-mail passa de 20 MB: muitos servidores recusam."
- Predefinições da tela "Outro servidor": Gmail `imap.gmail.com` 993 e `smtp.gmail.com` 465; Outlook `outlook.office365.com` 993 e `smtp.office365.com` 587.
- A tela de "Outro servidor" explica onde criar a senha de app no Gmail (exige verificação em duas etapas) e, no Microsoft 365, que o SMTP autenticado pode estar desligado na caixa.

</specifics>

<deferred>
## Deferred Ideas

- **Importar o histórico da caixa** (D-17-08): uma tela "importar os últimos N dias" com limite e fila, se alguém pedir.
- **E-mail mandado por outro programa pela mesma caixa** (a pessoa responde pelo Gmail em vez de pela Caixa): ler a pasta de enviados e mostrar no fio, como a Evolution faz com `digitadaNoAparelho`.
- **Outras pastas** além da caixa de entrada, e regras por rótulo.
- **Aviso instantâneo por push** (Gmail API com Pub/Sub, ou Microsoft Graph com subscription): é a opção C, fora por decisão do dono.
- **Mais de uma caixa por Canal** e **assinatura de e-mail** configurável por Canal.
- **Renovação do token por rotina** em vez de só quando alguém usa (o Instagram deixou igual).
- **Limite de taxa próprio** do endpoint de conexão por senha, se a guarda de D-17-07 não bastar.

### Reviewed Todos (not folded)
Nenhum todo casou com a fase.

</deferred>

---

*Phase: 17-e-mail-conectar-a-caixa-receber-e-enviar-sess-o-9*
*Context gathered: 2026-11-19*
