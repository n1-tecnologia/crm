# Phase 17: E-mail: conectar a caixa, receber e enviar (Sessão 9) - Research

**Researched:** 2026-11-19
**Domain:** provedor de mensageria real por IMAP/SMTP (senha e OAuth Google/Microsoft) sobre a base da Fase 16, em Fastify 5 / Node 24 / TypeScript ESM
**Confidence:** MEDIUM-HIGH (código do repositório, fontes das bibliotecas e páginas oficiais do Google e da Microsoft lidos nesta sessão; o que depende de caixa real está listado em "Não verificado")

<user_constraints>
## User Constraints (from CONTEXT.md)

O texto integral e vinculante está em `17-CONTEXT.md` (linhas 30-74). Em caso de divergência, vale o CONTEXT.md. Cópia literal das decisões (o trecho em negrito de cada uma) e das seções de discrição e adiadas:

### Locked Decisions
- **D-17-01 (dono):** **Senha ou senha de app e login OAuth do Google e da Microsoft entram; Gmail API e Microsoft Graph ficam fora.**
- **D-17-02 (dono):** **Ordem de construção: senha primeiro, depois Microsoft, depois Google.**
- **D-17-03 [auto]:** **O e-mail é um `ProvedorDeMensageria` em `apps/api/src/mensageria/provedores/email/`, registrado em `registro.ts`** (rotas: `POST /canais/:id/email/conectar`, `POST /canais/:id/email/oauth/:servico/autorizar`, `POST /canais/email/oauth/concluir`, `GET /canais/:id/email/conta`).
- **D-17-04 [auto]:** **O login OAuth segue o Instagram: `autorizar` devolve a URL do provedor com `state` assinado, a volta cai numa página da WEB** (`.../canais/email/retorno`), **que chama `concluir` com a sessão do Membro**; URI de retorno em `EMAIL_OAUTH_REDIRECT_URI`.
- **D-17-05 [auto]:** **Credencial no cofre, o que não é segredo em tabela própria** (migração `017`; `plataforma.credenciais`, tipo `email-imap-smtp`).
- **D-17-06 [auto]:** **Quem pode conectar, desconectar e ver a conta** segue a regra dos outros provedores; desconectar e arquivar apagam a credencial e a conta e, no login, pedem a revogação ao provedor quando der.
- **D-17-07 [auto]:** **"Outro servidor" deixa a pessoa digitar host e porta, o que faz o `apps/api` abrir conexão para onde ela mandar** — portas 993/143(STARTTLS obrigatório)/465/587(STARTTLS obrigatório), nunca texto puro, certificado sempre válido, recusa de IP loopback/privado/link-local/metadados, conexão ao IP já conferido, tempos limite, erro classificado.
- **D-17-08 [auto]:** **Sem importar o histórico.** Cursor começa no `UIDNEXT`; `UIDVALIDITY` mudou: recomeça do `UIDNEXT` novo.
- **D-17-09 [auto]:** **Só a caixa de entrada (`INBOX`), lida por um processo dentro do `apps/api`:** uma sessão IMAP por Canal, `IDLE` + conferência a cada 2 min, `EMAIL_LEITOR_ATIVO`, um leitor por Canal com `pg_try_advisory_lock`.
- **D-17-10 [auto]:** **O leitor entrega à fila `plataforma.webhooks_recebidos`; quem cria Contato, Conversa e Mensagem é o `processador-de-entrada` que já existe**, por `receberMensagem`; `chave` = `Message-ID`; `corpo` leva o e-mail interpretado, nunca o MIME cru.
- **D-17-11 [auto]:** **O que não vira Conversa:** resposta automática, aviso de não entrega, lista e promoção (`Precedence`), e `From` igual ao endereço do Canal; entra na fila como `ignorado:<motivo>`.
- **D-17-12 [auto]:** **O Contato é o endereço do `From`** (minúsculas, `normalizarIdentificadorDeContato`, tipo `email`).
- **D-17-13 [auto]:** **O HTML do e-mail** fica guardado como anexo `text/html` no bucket e **só é limpo na hora de mostrar**.
- **D-17-14 [auto]:** **O fio.** Função pura no domínio, `mensagemRespondida(cabecalhos, buscarPorIdExterno)`.
- **D-17-15 [auto]:** **Resposta de outra pessoa no mesmo fio** junta na mesma Conversa pelo cabeçalho e **não troca o Contato da Conversa** (o dono deve confirmar).
- **D-17-16 [auto]:** **A saída é a da Fase 16:** a resposta nasce `pendente`, outbox `mensagem.enviar.v1`, worker de saída, `nodemailer`; `Message-ID` gerado por nós; resposta ambígua nunca é reenviada sozinha.
- **D-17-17 [auto]:** **Cópia em Enviados:** `APPEND` na pasta `\Sent` só quando o servidor não guarda sozinho (Gmail guarda; Microsoft 365 se confere na prova real; "Outro servidor", `APPEND`).
- **D-17-18 [auto]:** **Anexos** entram e saem pela mídia da Fase 16; teto de 20 MB por e-mail enviado; `cid:` vira anexo.
- **D-17-19 [auto]:** **A tela leva o assunto e as cópias ao servidor** (`NovaMensagem` e `NOVA_MENSAGEM` ganham `assunto` e `enderecosAdicionais`, só com `hasSubjectAndCopies`).
- **D-17-20 [auto]:** **Conexão que cai** passa o Canal a `desconectada` com o motivo e o leitor para; falha transitória reconecta com espera crescente sem mudar o estado.

### Claude's Discretion
- A ordem e o corte em planos (domínio antes de api antes de tela; `017` antes do que a usa; núcleo da conexão por senha com a guarda de D-17-07 antes do leitor e do envio; login com servidor falso depois; tela por último; prova real ao fim).
- Os dublês de teste de IMAP, SMTP e login.
- A biblioteca de limpeza do HTML (D-17-13); o escopo mínimo do Google; a rotação do token de renovação da Microsoft; o tamanho máximo do texto no `corpo` da fila; o limite de sessões IMAP simultâneas por processo e o intervalo do `IDLE`; como o contrato de provedor acomoda o provedor que busca (D-17-10); o tratamento de `UIDVALIDITY`; descartar por `List-Unsubscribe`; se o leitor e o processador de entrada sobem pela mesma flag.
- O texto, em português de produto, dos erros de conexão e dos estados da ficha.
- Quem fica de dono do Contato criado por e-mail de endereço desconhecido e em qual Fila cai a Conversa (vale o da Fase 16).

### Deferred Ideas (OUT OF SCOPE)
- Importar o histórico da caixa; e-mail mandado por outro programa pela mesma caixa (pasta de enviados); outras pastas e regras por rótulo; aviso instantâneo por push (Gmail API/Pub/Sub, Graph/subscription); mais de uma caixa por Canal e assinatura configurável; renovação do token por rotina; limite de taxa próprio do endpoint de conexão por senha.
</user_constraints>

<phase_requirements>
## Phase Requirements

IDs locais da fase (definidos em `17-CONTEXT.md`, `<domain>`; não existem em REQUIREMENTS.md).

| ID | Description | Research Support |
|----|-------------|------------------|
| EML-01 | Conectar por senha ou senha de app: abre IMAP e SMTP antes de gravar, diz qual falhou, nunca devolve nem registra a senha | Guarda de rede e fábrica de conexão (seção "Guarda de rede"), `verifyOnly` do imapflow, `verify()` do nodemailer, classificação de erros, `canalParaProvedor` lê o cofre pelo tipo do provedor |
| EML-02 | Login Google/Microsoft: token de renovação no cofre, endereço da conta = endereço do Canal | Seções OAuth Google e Microsoft: escopos, `state` + PKCE derivado, `id_token`, prova definitiva pelo login XOAUTH2 com `user=<endereço do Canal>` |
| EML-03 | Receber em até 2 min, sem repetir ao reiniciar, sem importar histórico | Desenho do leitor: cursor `UIDNEXT`/`UIDVALIDITY`, `IDLE`, idempotência pelo índice `webhooks_recebidos_chave_uq`, contrato do provedor que busca |
| EML-04 | `In-Reply-To`/`References` juntam respostas na mesma Conversa | `mensagemRespondida` pura no domínio; ponto de inserção em `receberMensagem` (`recebimento.ts:266-317`); RFC 5322 §3.6.4 |
| EML-05 | Enviar com assunto, cópias, `Message-ID` próprio, fio, anexos, cópia em Enviados | Lacunas de `entregar-mensagem.ts` (não passa assunto, cópias nem fio), nodemailer, ambiguidade de SMTP, política de `APPEND` |
| EML-06 | A API não abre conexão para dentro da rede nem em texto puro | `net.BlockList`, resolução única e conexão ao IP, `servername`, `requireTLS`/`doSTARTTLS`, tempos limite, reaplicar a guarda em toda reconexão |
| EML-07 | Conexão que cai é avisada na ficha e deixa de ser tentada | `aplicarConexaoAoCanal`, classificação de falha permanente x transitória, `sessionExpires` do imapflow para Exchange |
</phase_requirements>

## Summary

A base da Fase 16 acomoda o e-mail com poucas mudanças de contrato, mas **cinco pontos do plano atual não funcionam como estão escritos** e precisam entrar nos planos (detalhe em "Achados que mexem nos planos"): (1) o `entregar-mensagem.ts` hoje **não passa** `assunto`, endereços adicionais nem a cadeia de `References` ao provedor; (2) o conjunto de contrato (`contrato-do-provedor.ts:73-75`) exige que `verificarChamada` **aceite** uma chamada válida, o que um provedor que busca não tem; (3) a mídia da entrada passa sempre por `provedor.baixarMidia`, então o leitor, que já tem os bytes do MIME, precisa de um caminho para anexos já guardados; (4) `pg_try_advisory_lock` por Canal prende **uma conexão do pool por leitor** (o pool tem `max` 10, `conexao.ts:171`); (5) a coleta de órfãos apaga em 1 h o que o leitor subiu e a fila ainda não consumiu.

As bibliotecas são as da própria discussão e todas têm licença permissiva: `imapflow` 2.12.1 (MIT), `nodemailer` 10.6.0 (MIT-0), `mailparser` 3.14.5 (MIT), `sanitize-html` 2.18.2 (MIT); os três primeiros já trazem tipos e exportam ESM e CJS. Para a guarda de rede (D-17-07) as duas bibliotecas aceitam o mesmo truque, **`host` = IP já conferido + `servername` = nome original**, e nenhuma refaz DNS quando recebe um IP literal (confirmado no código-fonte de ambas). Para os testes, o achado mais útil é o **`imapkit`** (ex-`hoodiecrow-imap`, mesmos autores do imapflow): servidor IMAP em memória, estrito, com XOAUTH2, IDLE e um provedor de login OAuth de teste; o SMTP falso é o `smtp-server` do nodemailer.

Sobre o Google, as páginas oficiais **confirmam** o que o CONTEXT.md marcava como "só de terceiros": `https://mail.google.com/` está na lista de escopos restritos, app que guarda dado restrito em servidor exige avaliação de segurança (CASA) e reverificação a cada 12 meses; em modo "Testing" valem 100 usuários de teste e refresh token de 7 dias. Para a Microsoft, o refresh token é **trocado a cada uso, mas o antigo não é revogado** (sem corrida entre o leitor e o envio), e `email`/`preferred_username` do `id_token` são mutáveis e "não garantidos": a prova de que a conta é a do Canal tem de ser o login XOAUTH2 com `user=<endereço do Canal>`.

**Primary recommendation:** construir um núcleo `criarFabricaDeConexao` (guarda de rede + TLS + tempos limite + classificação de erro) usado por conexão, leitor, envio e `APPEND`; usar `imapflow` + `nodemailer` + `mailparser` + `sanitize-html` (no servidor, ao servir) e testar com `imapkit` + `smtp-server` + `criarServidorFalso`; ajustar o contrato com **campos opcionais** (provedor sem webhook e anexos já guardados), nunca com um `verificarChamada` que mente.

## Achados que mexem nos planos (com evidência)

| # | Achado | Evidência | Efeito no plano |
|---|--------|-----------|-----------------|
| F1 | A saída não leva `assunto`, cópias nem fio ao provedor | `entregar-mensagem.ts:221-243` monta `EnvioAoProvedor` só com `mensagemId`, `destino`, `conteudo`, `modelo`, `emRespostaAIdExterno`/`Detalhes`; `provedor.ts:84` tem `assunto?` mas ninguém o preenche | Plano de envio: ler `mensagem.assunto` e `mensagem.enderecosAdicionais`, e a cadeia de `id_externo` da Conversa, e estender `EnvioAoProvedor` (`enderecosAdicionais?`, `referencias?`) |
| F2 | Frases de falha da saída falam de WhatsApp | `entregar-mensagem.ts:70-76`: `semConfirmacao: "Sem confirmação do provedor: confira no WhatsApp antes de tentar de novo."` | Generalizar a frase por tipo de Canal (e-mail: "confira em Enviados") |
| F3 | Contrato exige `verificarChamada` verdadeiro | `contrato-do-provedor.ts:73-75`: `expect(f.provedor.verificarChamada(valida, f.canal)).toBe(true)` e `:93-102` exige `chamadaDeTexto()` | `FabricaDoContrato` ganha `semWebhook?: true` (pula os dois casos e exige `verificarChamada` sempre `false`); `chamadaDeTexto()` vira o `corpo` que o leitor enfileira |
| F4 | Mídia de entrada só entra por `provedor.baixarMidia` | `processador-de-entrada.ts:306-309` chama `guardaDeMidia.guardarAnexosRecebidos` com `provedor.baixarMidia` (`midia.ts:91`) | Ver "Contrato do provedor que busca": campo opcional de anexos já guardados em `RecebidaDoProvedor`; o leitor reaproveita `criarGuardaDeMidia` com um provedor-adaptador em memória |
| F5 | Pool de 10 e trava por sessão | `persistencia/conexao.ts:171` `criarPool(connectionString, 10)`; `coleta-de-orfaos.ts:124-139` segura a trava num cliente do pool até o `unlock` | Um leitor por Canal NÃO pode reter conexão do pool; ver "Um leitor por Canal" |
| F6 | Coleta de órfãos apaga `entrada/` com mais de 1 h sem Mensagem | `coleta-de-orfaos.ts:96-120` (`idadeMinimaMs` 1 h, só poupa o que uma Mensagem cita) | Anexo subido pelo leitor cuja linha da fila ainda não virou Mensagem (processador desligado, fila parada) seria apagado. Mitigar: poupar também chaves citadas em `webhooks_recebidos.corpo` pendente, ou só subir o anexo quando o processador está ligado |
| F7 | `receberMensagem` grava `enderecosAdicionais: []` e `assunto` só do evento | `recebimento.ts:329-330` | Receber precisa levar `para`/`cc` (`RecebidaDoProvedor.enderecosAdicionais?`) e `emRespostaAIdExterno` passa a vir de `mensagemRespondida` |
| F8 | O Canal real sem provedor registrado nunca cai no de teste | `registro.ts:57-67` lança `PROVEDOR_INDISPONIVEL` | Registrar `email-imap-smtp` só com `COFRE_CHAVE`; sem ele a Mensagem não é dada como enviada (MSG-05) |
| F9 | Pontos de gancho para apagar a credencial | `servicos/crm/canais.ts:234` (desconectar) e `:386` (arquivar) chamam `esquecerConta` do Instagram | Mesmo gancho para o e-mail, com a revogação no provedor **antes** da transação (como a Evolution) |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Regra do fio (`mensagemRespondida`), `NovaMensagem` com assunto/cópias, filtros D-17-11 como função pura | `packages/dominio` | — | As mesmas regras valem na tela e na API; domínio não conhece ninguém (`CONTEXT.md` raiz) |
| Guarda de rede, fábrica de conexão IMAP/SMTP, classificação de erro | `apps/api` | — | Só o backend abre conexão com o servidor do usuário |
| Credencial, tabelas `017`, leitor IMAP, envio SMTP, OAuth (`autorizar`/`concluir`/renovação) | `apps/api` | Postgres (cofre + `017`) | Segredo nunca sai do backend |
| Limpeza do HTML do e-mail | `apps/api` (ao servir) | `apps/web` (iframe `sandbox`) | `sanitize-html` roda em Node sem DOM; a web não tem sanitizador hoje (nenhum `dangerouslySetInnerHTML` em uso) |
| Escolha dos três caminhos de conexão, campos de assunto/cópia, página de retorno OAuth, estado `desconectada` com motivo | `apps/web` | `apps/api` (dados) | Só aparência e navegação |
| Tempo real da Mensagem nova | `apps/api` (SSE da Fase 16) | `apps/web` | Já existe; o leitor só passa por `receberMensagem` que chama `avisarCrm` |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `imapflow` | 2.12.1 (publicada 2026-11-15) | Cliente IMAP: `verifyOnly`, `IDLE`, XOAUTH2 (`auth.accessToken`), `APPEND`, `sessionExpires` | MIT, `node >=20`, ESM+CJS (`exports` com `import`/`require`), tipos próprios (`types: ./dist/cjs/imap-flow.d.ts`) `[VERIFIED: npm registry; fonte lida em dist/esm/imap-flow.js]` |
| `nodemailer` | 10.6.0 (2026-11-15) | Envio SMTP, XOAUTH2 (`auth.type: 'OAuth2'`), `verify()`, composição MIME | MIT-0, `node >=20`, ESM+CJS, tipos próprios, sem dependências `[VERIFIED: npm registry; fonte lida]` |
| `mailparser` | 3.14.5 (2026-11-16) | `simpleParser`: `messageId`, `inReplyTo`, `references`, `headers`, `attachments`, `html`, `text` | MIT; depende de `@zone-eu/mailsplit` 5.4.31 (licença dupla `MIT OR EUPL-1.1+`: adotar a MIT) `[VERIFIED: npm registry]` |
| `sanitize-html` | 2.18.2 (2026-11-11) | Limpeza do HTML do e-mail no servidor | MIT, `node >=22.12.0` (API roda em Node 24), sem DOM `[VERIFIED: npm registry; README lido]` |

### Supporting (somente `devDependencies`, testes)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `imapkit` | 5.3.2 (2026-11-15; antes `hoodiecrow-imap` até 3.3.1) | Servidor IMAP em memória, estrito, XOAUTH2/OAUTHBEARER, IDLE, SPECIAL-USE, UIDPLUS, regras de falha (`close: 'reset'`), IdP OAuth de teste | Testes do leitor, da conexão e da renovação `[ASSUMED: nome descoberto por npm search; README lido; mesmos mantenedores do imapflow]` |
| `smtp-server` | 3.21.6 (2026-11-16) | SMTP falso programável (`onAuth` com `auth.accessToken`, `onRcptTo`, `onData`) | Testes de envio, `verify()`, falha ambígua `[ASSUMED: nome citado no README do imapkit]` |

Tipos: `imapflow`, `nodemailer`, `mailparser` e `smtp-server` já declaram `types` no `package.json`; **não instalar** `@types/nodemailer` (8.0.2) nem `@types/mailparser`/`@types/smtp-server`, que são do tempo em que os pacotes não traziam tipos. `@types/sanitize-html` 2.16.2 é necessário (o pacote não declara tipos) `[VERIFIED: npm registry, campo types/typings]`.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `sanitize-html` no servidor | `dompurify` (`MPL-2.0 OR Apache-2.0`) + `jsdom` | O `jsdom` 31.0.1 exige `node ^22.22.2 \|\| ^24.15.0 \|\| >=26`, e a máquina local está em v24.14.0 `[VERIFIED: npm registry + node --version]`; DOM no servidor é peso e superfície à toa. Só faria sentido no navegador, e a web não tem sanitizador |
| `mailparser` | `postal-mime` 4.2.1 (MIT-0) | Mesmo autor, sem dependências, mas `mailparser` já trata `cid:`, `textAsHtml` e conversão HTML→texto; ficar com `mailparser` |
| `imapkit` | `wildduck` (EUPL-1.2), `imap-core` 1.0.0 (2016), GreenMail em Docker | `wildduck` é EUPL; `imap-core` está parado; GreenMail (Apache-2.0, 3143/3993) não tem XOAUTH2 confirmado `[CITED: github greenmail via busca]` e exige Docker |
| Servidor IMAP escrito à mão | — | Só se o `imapkit` falhar no spike (ver Wave 0); o parser de FETCH do imapflow é exigente |

**Installation (para o planejador; só depois do checkpoint abaixo):**
```bash
npm install -w @n1/api imapflow nodemailer mailparser sanitize-html
npm install -w @n1/api -D @types/sanitize-html imapkit smtp-server
```

**Version verification:** `npm view <pkg> version time.modified license engines` rodado nesta sessão (valores na tabela). Fixar versões exatas e deixar o `package-lock.json` decidir o resto.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| imapflow | npm | anos; última publicação 2026-11-15 | ~5,0 M/sem | github.com/postalsys/imapflow | SUS (`too-new`: só a data da última versão) | Aprovado com checkpoint `human-verify` |
| nodemailer | npm | anos; última 2026-11-15 | ~40,4 M/sem | github.com/nodemailer/nodemailer | SUS (`too-new`) | Aprovado com checkpoint |
| mailparser | npm | anos; última 2026-11-16 | ~9,3 M/sem | github.com/nodemailer/mailparser | SUS (`too-new`) | Aprovado com checkpoint |
| smtp-server | npm | anos; última 2026-11-16 | ~1,3 M/sem | github.com/nodemailer/smtp-server | SUS (`too-new`) | Dev; checkpoint |
| sanitize-html | npm | anos; última 2026-11-11 | ~19,0 M/sem | github.com/apostrophecms/apostrophe | SUS (`too-new`) | Aprovado com checkpoint |
| imapkit | npm | criado 2026-10-07 (renome de `hoodiecrow-imap`) | ~9 k/sem | github.com/postalsys/imapkit | SUS (`too-new`) | Dev; checkpoint obrigatório |

**Packages removed due to [SLOP] verdict:** nenhum.
**Packages flagged as suspicious [SUS]:** todos acima, pelo mesmo motivo (`too-new` = data da versão mais recente, não idade do pacote; nenhum tem `postinstall` `[VERIFIED: gsd-tools package-legitimacy check, signals.postinstall = null]`). O planejador insere **um** `checkpoint:human-verify` antes do primeiro `npm install`, e fixa versões exatas. Cada versão listada saiu há menos de 15 dias (imapflow 2.12.0/2.12.1 em 15/11, nodemailer 10.6.0 em 15/11): vale o humano decidir se prefere uma versão mais velha (por exemplo imapflow 2.11.0, de 06/11). **Se fixar versão mais velha, reler `sessionExpires` e `transport` no imapflow**, que a pesquisa conferiu só na 2.12.1. `imapkit` e `smtp-server` entram como `[ASSUMED]` pela regra de proveniência de nomes (descobertos por busca/README, não por documentação oficial do projeto).

Instalação de teste em diretório isolado foi negada pelo ambiente; a análise de licenças das dependências diretas vem de `npm view` (`libmime`, `libqp`, `libbase64`, `html-to-text`: MIT; `@zone-eu/mailsplit`: `MIT OR EUPL-1.1+`). A árvore transitiva completa **não foi auditada**: rodar `npx license-checker`-equivalente no CI depois do install.

## Architecture Patterns

### System Architecture Diagram

```
                        ┌───────────────────── apps/web ─────────────────────┐
 pessoa ── ficha do Canal ──► 3 caminhos: Google | Microsoft | Outro servidor │
                        └──┬───────────────┬──────────────────────┬──────────┘
          POST /canais/:id/email/conectar   │ POST .../oauth/:servico/autorizar → URL (state assinado + PKCE)
                           │                │ navegador → Google/Microsoft → volta em /canais/email/retorno (WEB)
                           │                └──► POST /canais/email/oauth/concluir (sessão do Membro)
                           ▼
              ┌──── servico de conexão (apps/api) ────┐
              │ exigir(conectar,canal) → guardaDeRede  │──► resolve DNS UMA vez, confere TODOS os IPs
              │ → IMAP verifyOnly + SMTP verify()      │──► conecta no IP, servername = host
              │ → cofre.guardarCredencial + 017 + Canal conectada (mesma transação)
              └────────────────────┬──────────────────┘
                                   │ (Canal conectada)
   ┌──────────── leitor (EMAIL_LEITOR_ATIVO) ───────────┐        ┌── worker de saída (MENSAGERIA_WORKER_ATIVO) ──┐
   │ supervisor: 1 conexão pg dedicada, trava por Canal │        │ outbox mensagem.enviar.v1 → entregar-mensagem │
   │ por Canal: ImapFlow(INBOX) IDLE + conferência 2min │        │  → provedor.enviar: nodemailer (XOAUTH2/senha)│
   │ UID ≥ cursor → mailparser → filtros D-17-11        │        │  Message-ID próprio, In-Reply-To/References   │
   │ → anexos+HTML ao bucket (criarGuardaDeMidia)       │        │  → ambíguo? nunca reenvia  → APPEND \Sent?    │
   │ → INSERT webhooks_recebidos (chave = Message-ID)   │        └──────────────────────────────────────────────┘
   │ → avança cursor                                    │
   └───────────────────────┬────────────────────────────┘
                           ▼
        processador-de-entrada ─► provedor.interpretarChamada(corpo) ─► receberMensagem
              (mensagemRespondida → Conversa do fio | regra do par) ─► Contato/Conversa/Mensagem ─► SSE ─► web
   leitura do HTML:  GET /mensagens/:id/corpo-html ─► sanitize-html ─► web <iframe sandbox srcDoc>
```

### Recommended Project Structure
```
packages/dominio/src/crm/
├── fio-de-email.ts          # mensagemRespondida, filtros de D-17-11 (puros)
└── mensagens.ts             # NovaMensagem + assunto/enderecosAdicionais; validarNovaMensagem
apps/api/migracoes/017-email.sql
apps/api/src/mensageria/provedores/email/
├── CONTEXT.md
├── rede.ts                  # guarda de rede (BlockList, resolução, classificação de IP)
├── fabrica-de-conexao.ts    # opções do ImapFlow e do nodemailer a partir do IP conferido
├── erros.ts                 # classificação (não conectou | certificado | tempo | recusou o login)
├── conexao.ts               # conectar por senha, autorizar/concluir OAuth, conta, desconectar
├── oauth/{google,microsoft}.ts, estado.ts (HMAC + PKCE derivado), token.ts (renovação preguiçosa)
├── repositorio.ts           # email_contas (e cursor), esquecerConta
├── leitor.ts                # supervisor + sessão por Canal
├── traduzir.ts              # MIME interpretado → corpo da fila ↔ RecebidaDoProvedor
├── entrada.ts               # INSERT em webhooks_recebidos (molde de instagram/entrada.ts:89)
├── provedor.ts, do-ambiente.ts, html.ts (sanitize-html)
apps/api/src/rotas/crm/email.ts
apps/web/src/app/(shell)/crm/caixa-de-entrada/configuracoes/canais/email/retorno/page.tsx
```

### Pattern 1: Guarda de rede e conexão ao IP já conferido (D-17-07)
**What:** resolver o nome **uma vez**, classificar **todos** os endereços, escolher um, e entregar às duas bibliotecas `host: <IP>` + `servername: <nome original>`.
**Evidência de que as bibliotecas não refazem DNS e validam o certificado pelo nome:**
- imapflow: `this.servername = this.options.servername ? this.options.servername : !isIpLiteral(this.host) ? this.host : false` (`dist/esm/imap-flow.js:210`) e `opts = Object.assign({ host: this.host, port: this.port }, this.tlsServername(), this.options.tls || {})` (`:2291-2295`), repassado a `tls.connect`/`net.connect` (`:2290`, `:2418`, `:2440`). No STARTTLS o `opts` repete `host`, `port`, `servername` (`:1615-1634`), com o comentário do próprio autor: sem `host`, a conexão a um IP literal verifica o certificado contra `"localhost"`. `[VERIFIED: fonte imapflow 2.12.1]`
- nodemailer: `this.servername = this.options.servername ? this.options.servername : !net.isIP(this.host) ? this.host : false` (`smtp-connection/index.js:139`); `resolveHostname` devolve direto quando `net.isIP(options.host)` (`shared/index.js:93-105`), ou seja, **não consulta DNS para IP literal**; `servername` é aplicado no TLS direto (`:283-286`) e no STARTTLS (`:1085-1087`). `[VERIFIED: fonte nodemailer 10.6.0]`
- Sem IP literal, o nodemailer resolve sozinho (`resolveHostname` com `dns.resolve4/6` e cache de processo, `shared/index.js:91-250`): **nunca passar o nome ao nodemailer**, senão o DNS é consultado fora da guarda (rebinding).
**Classificação de IP:** usar `node:net` (`BlockList` + `isIP`), sem dependência. A documentação do Node mostra que `check('::ffff:7b7b:7b7b','ipv6')` e `check('::ffff:123.123.123.123','ipv6')` casam uma regra IPv4 (mapeado) `[CITED: nodejs.org/api/net.html#class-netblocklist]`.
```typescript
// Source: nodejs.org/api/net.html (BlockList) + fontes de imapflow/nodemailer lidas nesta sessão
import { BlockList, isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { domainToASCII } from "node:url";

const proibidos = new BlockList();
for (const [rede, bits] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) proibidos.addSubnet(rede, bits, "ipv4");
proibidos.addAddress("168.63.129.16", "ipv4"); // IP público de plataforma do Azure
for (const [rede, bits] of [
  ["::", 128], ["::1", 128], ["64:ff9b::", 96], ["100::", 64], ["2001:db8::", 32],
  ["2002::", 16], ["fc00::", 7], ["fe80::", 10], ["fec0::", 10], ["ff00::", 8],
] as const) proibidos.addSubnet(rede, bits, "ipv6");

export async function resolverEConferir(hostBruto: string, resolver = lookup) {
  const host = domainToASCII(hostBruto.trim().toLowerCase().replace(/\.$/, ""));
  if (host === "" || host.length > 253 || /[^a-z0-9.\-:\[\]]/.test(host)) return { ok: false as const, motivo: "host_invalido" };
  const literais = isIP(host) ? [{ address: host, family: isIP(host) }] : await resolver(host, { all: true, verbatim: true });
  if (literais.length === 0) return { ok: false as const, motivo: "sem_endereco" };
  for (const { address, family } of literais) {
    if (proibidos.check(address, family === 6 ? "ipv6" : "ipv4")) return { ok: false as const, motivo: "rede_interna" };
  }
  return { ok: true as const, host, ip: literais[0]!.address }; // conectar a ESTE ip
}
// ImapFlow: { host: ip, servername: host, secure: porta===993, doSTARTTLS: porta===143 ? true : undefined,
//             tls: { rejectUnauthorized: true, minVersion: "TLSv1.2" }, connectionTimeout, greetingTimeout, socketTimeout, logger: false }
// nodemailer: { host: ip, servername: host, port, secure: porta===465, requireTLS: porta===587,
//             tls: { rejectUnauthorized: true, minVersion: "TLSv1.2" }, connectionTimeout, greetingTimeout, socketTimeout, dnsTimeout, logger: false }
```
**Regras adicionais:** (a) a faixa extra (CGNAT `100.64/10`, `192.0.0.0/24`, documentação, multicast, NAT64 `64:ff9b::/96`, 6to4 `2002::/16`, `168.63.129.16`) é o registro IANA de uso especial e as metadatas de nuvem comuns `[ASSUMED]`; confirmar com o dono; para `64:ff9b::/96` e `2002::/16` é mais seguro **recusar** do que extrair o IPv4 embutido. (b) `AWS fd00:ec2::254` já cai em `fc00::/7`. (c) Reaplicar a guarda em **toda** conexão (conectar, leitor a cada reconexão, envio, `APPEND`): o DNS do domínio pode mudar depois do cadastro. (d) Predefinições Gmail/Outlook ficam no servidor (`CONTEXT.md` D-17-07); a guarda vale para elas também. (e) A opção `proxy` e a `transport` do imapflow ficam **fora**: `transport` é pensada para runtimes sem `node:net` (Cloudflare) e `proxy` desvia a rota.
**Tempos limite (D-17-07):** imapflow `connectionTimeout` (90 s por padrão, cobre DNS+TCP+TLS), `greetingTimeout` (16 s), `socketTimeout` (300 s) `[CITED: imapflow.com/docs/api/imapflow-client]`; nodemailer `connectionTimeout`, `greetingTimeout` (30 s), `socketTimeout` (10 min), `dnsTimeout` `[VERIFIED: smtp-connection/index.js:14-15,98-110]`. Para a **conexão de teste** usar 10 s/10 s/15 s; para o leitor, `socketTimeout` maior que `maxIdleTime`.
**Log:** `logger: false` no imapflow (padrão é `pino`) e `logger: false, debug: false` no nodemailer; o imapflow mascara quadros de credencial em `logRaw`, mas a regra do repositório é nunca logar (ver Security).

### Pattern 2: Conectar por senha e por login com o mesmo núcleo (EML-01/02)
1. `verifyOnly: true` no imapflow: autentica e encerra com `LOGOUT` (`imap-flow.js:1375`, `:2650`); com `includeMailboxes` lista as caixas, útil para achar a pasta `\Sent`. `[VERIFIED: fonte]`
2. `transporter.verify()` no nodemailer (`smtp-transport/index.js` expõe `verify`, `:248` na conexão).
3. Só se os dois passarem: transação única (linha do Espaço antes da do Canal, como `instagram/conexao.ts:213-241`): `guardarCredencial` + `gravarConta` + `definirConexao` (`proximaConexao(canal,"conexao_confirmada")`) + `avancarRevisaoDoEspaco` + `avisarCrm` + `reenfileirarPendentesDoCanal`. Todo pedido de rede acontece **antes** da transação.
4. Cursor inicial: depois do `verifyOnly`, uma segunda abertura curta lê `mailbox.uidNext`/`uidValidity` da `INBOX` (`MailboxObject` traz `uidValidity: bigint`, `uidNext: number`, `types.d.ts:237-239`) e grava na `017` dentro da mesma transação. `uidValidity` é **`bigint`**: gravar como `text`/`numeric` e comparar como texto; `JSON.stringify` e o driver `pg` falham com `bigint`.
5. Erro da tela classificado (D-17-07): usar `err.authenticationFailed` (`errors.d.ts:91,140`) e `err.code` (`CONNECT_TIMEOUT`, `GREETING_TIMEOUT`, `ECONNREFUSED`, `ENOTFOUND`, códigos de TLS do Node como `CERT_HAS_EXPIRED`, `ERR_TLS_CERT_ALTNAME_INVALID`, `DEPTH_ZERO_SELF_SIGNED_CERT`, `UNABLE_TO_VERIFY_LEAF_SIGNATURE`); nodemailer: `err.code` ∈ `ECONNECTION`, `ETIMEDOUT`, `ESOCKET`, `EAUTH`, `ETLS`, `EDNS`, `EENVELOPE`, `EMESSAGE`, mais `err.command`, `err.responseCode`, `err.permanent` (`smtp-connection/index.js:927-955`). Só `authenticationFailed`/`EAUTH` (a conexão **chegou a autenticar**) pode repetir `responseText`/`response`; o resto vira frase fixa.

### Pattern 3: O leitor (EML-03, D-17-08..D-17-11)
- **Sessão:** `new ImapFlow({...fábrica, auth: {user, pass} | {user, accessToken}})` → `connect()` → `getMailboxLock("INBOX")` para ler (o lock é liberado em seguida, e o imapflow entra em `IDLE` sozinho após `autoIdleDelay` de 15 s `[CITED: imapflow.com]`). O evento `exists` dispara a leitura; `close` não reconecta sozinho (`"There is no auto-reconnect, so create a new client to reconnect"`), então o supervisor cria outro `ImapFlow`.
- **`IDLE`:** `maxIdleTime` entre 5 e 10 min (o imapflow reinicia o `IDLE` a cada `maxIdleTime`); a RFC 2177 manda reemitir "pelo menos a cada 29 minutos" e diz que o servidor pode desconectar o cliente inativo `[CITED: rfc-editor.org/rfc/rfc2177]`. A conferência de 2 min de D-17-09 é um `timer` que, sem sair do `IDLE` à força, chama a mesma rotina de leitura sob o lock (o imapflow encerra o `IDLE` ao rodar outro comando).
- **Cursor:** guardar `uidvalidity` (texto) e `proximo_uid`. Ler `uid >= proximo_uid` com `fetch(`${proximo}:*`, {uid, envelope, flags, size, source}, {uid:true})` e **descartar no código `uid < proximo_uid`**: a faixa `n:*` devolve ao menos a última mensagem mesmo quando o maior UID é menor que `n` `[ASSUMED: comportamento padrão do IMAP, RFC 3501 §9 seq-range; cobrir com teste no imapkit]`. `UIDVALIDITY` diferente do guardado: gravar o fato, recomeçar de `mailbox.uidNext` atual (D-17-08), sem reimportar.
- **Ordem que dá "pelo menos uma vez" sem repetir:** `INSERT ... on conflict (workspace_id, canal_id, chave) where chave is not null do nothing` (índice `webhooks_recebidos_chave_uq`, `013`) e **só depois** avançar o cursor, na mesma transação do `INSERT` quando possível. Reiniciar entre as duas coisas repete a leitura e o índice absorve. Molde do `INSERT`: `instagram/entrada.ts:89` e `whatsapp-cloud/entrada.ts:89`.
- **`chave`:** `Message-ID` sem os `< >`, em minúsculas só no domínio? **Não normalizar além de remover os colchetes e espaços** (o local-part é sensível a maiúsculas pela RFC); sem `Message-ID`, `sem-id:` + `sha256(from|date|subject|size)`. A mesma chave é o `idExterno` da Mensagem.
- **Tamanho:** ler primeiro `size` (e `bodyStructure`); acima do teto total (sugestão 50 MiB `[ASSUMED]`) gravar a linha como `ignorado:grande_demais` e avançar o cursor. O `source` inteiro vai ao `mailparser` na memória; `download(..., { maxBytes })` existe (`types.d.ts:697`).
- **Filtros (D-17-11), funções puras no domínio:** `Auto-Submitted` ≠ `no` (RFC 3834: `auto-generated`, `auto-replied`), `Precedence` ∈ {`bulk`,`list`,`junk`}, `Content-Type: multipart/report` ou `From` `MAILER-DAEMON`/`postmaster`, e `From` = endereço do Canal. **Recomendação sobre `List-Unsubscribe`: não descartar** (concorda com o texto do CONTEXT.md: o cabeçalho aparece em e-mail legítimo de ferramenta de envio); registrar `lista: true` no `corpo` para a tela poder marcar. Cabeçalhos além de RFC 3834 (`X-Auto-Response-Suppress`) `[ASSUMED]`.
- **Spoof de `From`:** `From` não é autenticado. Guardar no `corpo` o `Authentication-Results` do servidor receptor (Gmail e Exchange o acrescentam `[ASSUMED]`) para auditoria; não bloquear (fora do escopo), mas registrar na `cargaBruta`.
- **Um leitor por Canal (F5):** `pg_try_advisory_lock` é de **sessão**: segurar a trava num cliente do pool, como a coleta de órfãos faz por minutos, prenderia uma das 10 conexões por Canal. Recomendado: **um supervisor com UMA conexão `pg.Client` fora do pool**, como o `ouvinte-pg.ts` ("UMA conexão por processo, FORA do pool"), que segura `pg_try_advisory_lock(hashtext('n1:email-leitor:'||canal_id))` para cada Canal que lê, solta ao parar o leitor e, se a conexão cair, todas as travas somem e o supervisor refaz. A produção entrega `LISTEN/NOTIFY` pelo pooler (prova A9 no `CONTEXT.md` raiz), ou seja, o pooler é de sessão, o que sustenta a trava. Alternativa sem conexão dedicada: coluna `leitor_ate timestamptz` + `leitor_dono` na `017`, renovada a cada ciclo (`update ... where leitor_ate < now()`). `[ASSUMED: escolha de projeto]`
- **Limite de sessões:** um `ImapFlow` por Canal conectado; teto por processo configurável (sugestão 50, e Gmail permite várias conexões por conta mas cobra banda `[CITED: knowledge.workspace.google.com/admin/gmail/gmail-bandwidth-limits: 2500 MB/dia de download IMAP, 500 MB/dia de upload]`); o limite de conexões simultâneas por conta **não está nessa página** e não foi verificado.
- **Reconexão:** espera 5 s → 5 min (dobra), zera depois de conexão estável de 2 min. `authenticationFailed` (senha trocada) ou renovação OAuth recusada: parar e `aplicarConexaoAoCanal(..., "com_erro"/desconectada)` com motivo (D-17-20); rede/servidor fora: só reconectar.
- **Exchange Online e o token:** o imapflow documenta no código que o Exchange Online encerra a sessão IMAP quando o token de acesso expira (`BYE Session invalidated - AccessTokenExpired`) e oferece `sessionExpires`/`sessionExpiryLead` (padrão 5 min) para fechar num momento livre (`session-expiry.js` linhas 1-7; `types.d.ts:115-129`). **Passar `sessionExpires = expiraEm do token` sempre que a sessão for por OAuth**, e reabrir com token renovado ao receber o `close` com `closedByClient` `[VERIFIED: fonte imapflow 2.12.1]`. Para o Google o comportamento do `IMAP` ao expirar o token **não está documentado** nas páginas lidas: aplicar o mesmo cuidado `[ASSUMED]`.
- **Gmail:** `INBOX` é o rótulo Inbox (arquivado e spam ficam fora; e-mail enviado a si mesmo aparece) `[ASSUMED]`. **Exchange:** `IDLE` anunciado em `CAPABILITY` `[ASSUMED]`; conferir no 9.4.4.

### Pattern 4: Contrato do provedor que busca (D-17-10)
Recomendação: **campos opcionais**, nenhum `verificarChamada` que finja aceitar.
- `ProvedorDeMensageria.verificarChamada` do e-mail **sempre devolve `false`** (a rota pública `POST /webhooks/mensageria/:canalId` responde a mesma 401 de qualquer recusa, `webhooks-de-mensageria.ts:135-148`), e `interpretarChamada(corpo, canal)` interpreta o `corpo` que o próprio leitor enfileirou. `chaveDaChamada` devolve o `Message-ID`. `provedor.ts` ganha `readonly semWebhook?: true` (documentação e teste de contrato).
- `FabricaDoContrato` ganha `semWebhook?: true`: pula o primeiro caso e exige `verificarChamada` falso para a chamada de `chamadaDeTexto()`; `remetenteValido` = regex de e-mail; `destinoDoEnvio` = `{ tipo: "email", valor: "pessoa@exemplo.com" }`; `segredos` inclui a senha e o refresh token (o contrato já testa que nenhum resultado nem erro os carrega, `contrato-do-provedor.ts:140-166`).
- **Anexos já guardados (F4):** o leitor chama `criarGuardaDeMidia().guardarAnexosRecebidos({ ..., provedor: adaptadorEmMemoria })`, onde o adaptador só implementa `baixarMidia` devolvendo os bytes que o `mailparser` já tem (chave de referência = índice do anexo). Todas as conferências da Fase 16 (tipo na lista, teto, assinatura) valem. O resultado (`AnexoDaMensagem[]`, com `objectKey`) vai no `corpo`. No domínio, `RecebidaDoProvedor` ganha `anexosGuardados?: readonly AnexoDaMensagem[]` e o processador passa a usá-los em vez de baixar (`processador-de-entrada.ts:306-318` → `recebimento.receberMensagem(..., { anexos })`). O ramo que completa anexo `baixado:false` numa repetida (`recebimento.ts:113-127`) continua valendo, mas a "nova passada" da Fase 16 **não** acontece para e-mail (a linha fica `processado`): anexo que falhou por erro transitório de bucket deve fazer o **leitor** repetir a linha antes de avançar o cursor, ou a Mensagem entra com `baixado:false` (D-16-08) e fica assim.
- **Lista de tipos (D-17-18):** `TIPOS_ACEITOS_NA_MENSAGEM` (`midia.ts:20-38`) tem `application/pdf`, `application/xml`, `image/jpeg|png|webp`, `audio/ogg|mpeg|mp4|aac`, `video/mp4|3gpp`, docx/xlsx/pptx, `text/csv`, `text/plain`, `application/zip`; **não tem** `text/html`, `image/gif`, `message/rfc822`, `text/calendar`, `application/msword`, `.xls`. Recomendação: o corpo HTML **não entra em `anexos`** (não é arquivo a baixar); guardar como objeto à parte referenciado por um campo próprio da Mensagem, ou como anexo com tipo `text/html` marcado `interno: true` que nenhuma rota serve por URL assinada. `image/gif` e `text/calendar` podem entrar na lista (a assinatura é conferida por `assinaturaConfereComTipo`); `message/rfc822` e tipos de script/executável **não**.
- **Tamanho do `corpo` (jsonb):** o texto interpretado vai a `conteudo` da Mensagem; recomendado teto de 200 KB de texto no `corpo` (`[ASSUMED]`), com `truncado: true` e o texto completo como objeto `text/plain` no bucket se passar; `References` no máximo 50 ids; `To/Cc` no máximo 100 endereços; **nenhum** HTML nem base64 no `corpo`. A `cargaBruta` da Mensagem (`recebimento.ts:334`) deve levar só `{ messageId, uid, uidValidity }`.
- **Código que muda:** `provedor.ts` (+`semWebhook`, +`enderecosAdicionais`/`referencias` em `EnvioAoProvedor`), `recebimento.ts` domínio (+`anexosGuardados`, +`enderecosAdicionais`, +`referencias`/`emRespostaAIdsExternos`), `processador-de-entrada.ts` (usar `anexosGuardados`), `contrato-do-provedor.ts` (+`semWebhook`), `registro.ts` (+provedor), `index.ts` (+leitor).

### Pattern 5: O fio e a Conversa (EML-04, D-17-14/15)
- `mensagemRespondida(cabecalhos, buscarPorIdExterno)` async no domínio (a busca é injetada): tenta `In-Reply-To` (um ou mais ids) e depois cada id de `References` do último ao primeiro. Devolve `{ mensagemId, conversaId }` ou `undefined`.
- **Onde entra:** em `recebimento.ts`, **antes** de `abertaDoPar` (`:266-274`): se achou, a Conversa é a daquela Mensagem; se ela está `resolvida`, reabrir (`definirSituacao(..., "aberta")`, como `:290-292`) e marcar `conversaReaberta`; se está `na_lixeira`, **não** reabrir (regra existente: `destinoDaRecebida` "Uma Conversa na lixeira nunca reabre") e cair na regra do par. `emRespostaAId` passa a vir da busca (hoje só de `emRespostaAIdExterno` e só se a citada é da mesma Conversa, `:313-317`).
- **D-17-15 (outra pessoa responde no fio):** `inserirRecebida` recebe o `identificadorId` do **remetente** (`:332`), mas a Conversa é de outro Contato; o envio usa `identificadorDeResposta(identificadoresDoContato, canal, idDeQuemEscreveu)` com `identificadorDaUltimaRecebida` (`entregar-mensagem.ts:204-206`) e o comentário WR-04 diz que um identificador de outro Contato "some da lista" e a resposta volta ao principal. O comportamento é coerente, mas **precisa de teste explícito**: a resposta ao colega em cópia sai para o Contato principal, não para o colega. Um Contato novo nasce para o colega (D-17-15) com `modo_criacao = 'automatico_mensagem'`.
- `Message-ID` próprio **imprevisível**: `<n1.<uuid da Mensagem>@dominio-do-endereço-do-Canal>`. Um atacante não adivinha o id, então não consegue forjar `In-Reply-To` para entrar em outra Conversa `[ASSUMED: modelo de ameaça]`. Gravar em `id_externo` **sem** os colchetes.
- **`References` na saída (RFC 5322 §3.6.4):** conteúdo do `References` do pai + `Message-ID` do pai; se o pai não tem `References` mas tem um único `In-Reply-To`, usa-se esse mais o `Message-ID` do pai `[CITED: rfc-editor.org/rfc/rfc5322 §3.6.4]`. O repositório não guarda o `References` recebido; reconstruir da Conversa: `id_externo` das Mensagens ordenadas por `seq` (primeira + últimas 19) é suficiente e determinístico. O `In-Reply-To` é o `id_externo` da última Mensagem **recebida** (ou da citada, `emRespostaAIdExterno`).

### Pattern 6: Enviar (EML-05, D-17-16..18)
- `nodemailer.createTransport({ ...fábrica, auth: senha → { user, pass } | OAuth2 → { type: "OAuth2", user, accessToken, expires } })`. Opções fixas: `disableFileAccess: true`, `disableUrlAccess: true` (o `mime-node` as honra, `mime-node/index.js:106-107`), `logger:false`.
- Mensagem: `messageId`, `inReplyTo`, `references`, `subject`, `to/cc/bcc`, `text` **e** `html` (HTML simples gerado do texto, com escape), `attachments: [{ filename, content: Buffer, contentType }]` com os bytes lidos do bucket por `ArmazenamentoDeAnexos` (não passar `href`: o nodemailer faria a busca HTTP sozinho). **`bcc` fica fora dos cabeçalhos** do que o nodemailer escreve `[ASSUMED: o nodemailer remove `Bcc` do MIME; cobrir com teste no `smtp-server` lendo o DATA]`.
- Validação de cabeçalho: `assunto` sem CR/LF (zod) e endereços por `normalizarEmail` (`normalizacao.ts:51`).
- **Ambíguo x recusa limpa** (para `ResultadoDoEnvio.ambiguo`): clean = erro com `err.responseCode` e `err.command` ∈ {`MAIL FROM`, `RCPT TO`, `EHLO`, `AUTH`...} **antes** do `DATA`, ou resposta final ao `DATA` com 4xx/5xx (`EMESSAGE`, `command: "DATA"`, `responseCode`) — nesses o servidor **respondeu** e não aceitou; `permanent` (`isPermanentResponseCode`) decide entre `recusa` e `transitorio`. **Ambíguo**: `ETIMEDOUT`, `ESOCKET`, `ECONNECTION` sem `responseCode` depois que a conexão passou do `RCPT TO` (ou com `command` `DATA`/`CONN` tardio), "Connection closed unexpectedly" (`:988-1003`), ou `info.response` perdida. Antes de conectar e até o fim do `MAIL FROM`/`RCPT TO`, `ECONNECTION`/`ETIMEDOUT`/`EDNS`/`EAUTH` são **transitórios** (nada saiu). Espelha `instagram/provedor.ts:68-97`.
- **Falha parcial de destinatários:** `info.rejected`/`rejectedErrors` com algum aceito = saiu: **`ok: true`** com aviso (não reenviar). Todos recusados = recusa permanente.
- **Cópia em Enviados (D-17-17):** colunas `append_enviados` (`auto|sim|nao`) e `pasta_enviados` na `017`. `auto` → Gmail: não; Microsoft: decidir no 9.4.4; outros: `APPEND` na pasta `\Sent` (special-use via `LIST`, RFC 6154). Gmail guarda sozinho: apenas fontes comunitárias (Mozilla, Thunderbird) `[CITED: busca web; sem página oficial do Google]`, tratar como `[ASSUMED]`. Microsoft: a página oficial lida **não** fala em cópia em Itens Enviados para SMTP AUTH `[VERIFIED: ausência na página lida; não é prova de comportamento]`. `APPEND` usa a mesma mensagem MIME: `nodemailer`'s `MailComposer` (`mail-composer`) gera o bruto, ou `streamTransport`/`buffer: true`, e o mesmo bruto vai ao SMTP e ao `append(path, content, ["\\Seen"], data)`.
- **Falha do `APPEND`** não derruba a Mensagem (D-17-17): registrar `registrar("warn", ...)` sem endereço.

### Pattern 7: OAuth (D-17-04) — `state` e PKCE sem tabela
Copiar `instagram/estado.ts` (HMAC-SHA256 com prefixo próprio, `timingSafeEqual`, validade de 10 min, nonce de 9 bytes) com chave **por serviço** (segredo do cliente OAuth do serviço) e prefixo `n1/email/<servico>/estado:`; acrescentar `s` (serviço). **PKCE sem armazenar o verifier:** `code_verifier = base64url(HMAC-SHA256(segredo, "pkce:" + nonce))` (43 caracteres), `code_challenge = base64url(sha256(code_verifier))`, `S256`. O verifier é recalculado em `concluir` a partir do `state` já verificado `[ASSUMED: desenho; a segurança vem do segredo do servidor]`. Conferir `membroId`/`workspaceId` do `state` com a sessão (`instagram/conexao.ts:159-161`). A URI de retorno é exata (`EMAIL_OAUTH_REDIRECT_URI`), a mesma letra por letra nos dois painéis `[CITED: Microsoft Learn v2-oauth2-auth-code-flow: "must exactly match"]`.

### Anti-Patterns to Avoid
- **Passar o nome do host ao nodemailer ou ao imapflow depois de conferir o IP** (refaz o DNS, abre o rebinding).
- **`rejectUnauthorized: false` em qualquer caminho de produção**; a única injeção de CA é por dependência de teste (`ca` do certificado de fixture), nunca por variável de ambiente nem por campo da requisição.
- **Reter conexão do pool por Canal** para a trava consultiva.
- **Aceitar `email`/`preferred_username` do Microsoft como prova de identidade** (ver OAuth Microsoft).
- **Servir o HTML original ao navegador** ou limpar só na web sem `sandbox`.
- **Reenviar após `ETIMEDOUT` depois do `DATA`.**

## Google OAuth para IMAP/SMTP (item 4)

| Fato | Fonte |
|------|-------|
| Escopo de IMAP, POP e SMTP: `https://mail.google.com/`. Para delegação de domínio do Workspace existe `gmail.imap_admin`, só para esse caso | `[CITED: developers.google.com/workspace/gmail/imap/xoauth2-protocol]` |
| `https://mail.google.com/` está listado em **"Restricted scopes"**: "Read, compose, send, and permanently delete all your email from Gmail"; restritos "require restricted scope OAuth App Verification" e "If you store restricted scope data on servers (or transmit), then you must go through a security assessment" | `[CITED: developers.google.com/workspace/gmail/api/auth/scopes]` |
| Quem acessa dado restrito por servidor de terceiro "must go through a security assessment from Google-empanelled security assessors"; Google usa a CASA; reverificação "at least every 12 months after your assessor's Letter of Assessment (LOA) approval date"; exceções: uso pessoal (só você ou poucos usuários que você conhece), uso interno (só pessoas da própria organização Workspace), desenvolvimento/teste | `[CITED: developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification]` |
| **Veredito sobre a alegação do EmailEngine:** confirmada pelas páginas oficiais acima. Um CRM multi-cliente que guarda token e e-mail em servidor próprio é "app público": exige verificação + CASA + renovação anual. Custo e prazo da CASA **não estão nessas páginas** e não foram verificados | — |
| Status "Testing": até **100 usuários de teste** listados na tela de consentimento; "Authorizations by a test user will expire seven days from the time of consent" e o refresh token emitido "will also expire" (exceção só para apps que pedem apenas nome, e-mail e perfil) | `[CITED: support.google.com/cloud/answer/15549945 e developers.google.com/identity/protocols/oauth2#expiration]` |
| App em produção sem verificação: tela de "app não verificado" e teto de 100 novos usuários que "cannot be reset or changed" | `[CITED: support.google.com/cloud/answer/15549945]` |
| Refresh token deixa de valer por revogação, 6 meses sem uso, **troca de senha quando o token tem escopo do Gmail**, excesso de tokens ativos (100 por conta e por client ID), política de sessão do admin | `[CITED: developers.google.com/identity/protocols/oauth2]` |
| Endpoints: autorização `https://accounts.google.com/o/oauth2/v2/auth`, token `https://oauth2.googleapis.com/token` (POST form), revogação `POST https://oauth2.googleapis.com/revoke` | `[CITED: developers.google.com/identity/protocols/oauth2/web-server]` |
| `access_type=offline` para refresh token; "The `refresh_token` is only returned on the first authorization" ⇒ usar também `prompt=consent` para garantir o token quando a pessoa reconecta | `[CITED: web-server]` |
| `id_token`: pedir `openid email`; `email` só vem com o escopo `email`; `email_verified`; a página manda usar **`sub`** como identificador estável ("may not be unique ... and could change over time" para `email`); recebido direto do endpoint de token por HTTPS, a autenticidade está garantida, mas conferir `iss`, `aud` e `exp` mesmo assim | `[CITED: developers.google.com/identity/openid-connect/openid-connect]` |
| Sequência XOAUTH2: `base64("user=" {User} "^Aauth=Bearer " {Access Token} "^A^A")`; na falha o servidor manda um desafio JSON `{status, schemes, scope}` e o cliente "must send an empty response" (linha vazia) | `[CITED: xoauth2-protocol]` |
| Cota de banda IMAP: Workspace 2500 MB/dia de download e 500 MB/dia de upload, "may change without notice" | `[CITED: knowledge.workspace.google.com/admin/gmail/gmail-bandwidth-limits]` |

**Recomendação:** pedir **`openid email https://mail.google.com/`** (o último é o único escopo de IMAP/SMTP; não há escopo menor para esses protocolos), `access_type=offline`, `prompt=consent`, `login_hint=<endereço do Canal>`, `code_challenge` S256 e `state`. Guardar `sub` além do `email`. Conferir `email_verified === true` e `email` igual ao do Canal (comparação em minúsculas, **também** `googlemail.com` ≡ `gmail.com`, domínio já tratado em `normalizacao.ts:28`). Revogar no desconectar com `POST /revoke` (falha não impede apagar). Verificar o desafio de erro XOAUTH2 do Gmail e a renovação em `invalid_grant` ⇒ conexão perdida.
**Plano de verificação do Google (9.1.3, do dono):** como a CASA é exigida para uso público e demora, o corte "Pronto quando" já aceita só modo de teste (D-17-02). Pedir ao dono para confirmar com o Google o prazo e o custo da CASA; **a pesquisa não consegue**.

## Microsoft OAuth para IMAP/SMTP (item 5)

| Fato | Fonte |
|------|-------|
| Escopos de IMAP e SMTP AUTH: `https://outlook.office.com/IMAP.AccessAsUser.All`, `https://outlook.office.com/SMTP.Send`; `offline_access` para refresh token; "OAuth2 support for IMAP, POP, and SMTP ... is available for both Microsoft 365 ... and Outlook.com users" | `[CITED: learn.microsoft.com/.../how-to-authenticate-an-imap-pop-smtp-application-by-using-oauth]` |
| `https://outlook.office365.com/.default` aparece **só** no fluxo de credenciais de cliente (aplicação) e na autorização de administrador de SMTP; para o fluxo delegado a página usa `outlook.office.com`. **Não há mudança recente documentada** nessa página (atualizada 2025-10-17) | `[CITED: mesma página]` |
| `tenant` válido: `common`, `organizations`, `consumers` ou id; `scope` de `/token` "must all be from a single resource, along with OIDC scopes (`profile`, `openid`, `email`)": IMAP e SMTP são do mesmo recurso, mais `openid email offline_access` | `[CITED: learn.microsoft.com/entra/identity-platform/v2-oauth2-auth-code-flow]` |
| Para contas pessoais **e** de trabalho: autoridade `common` e registro do app como "contas em qualquer diretório organizacional e contas Microsoft pessoais" `[ASSUMED: opção do portal]` | — |
| PKCE "now recommended for all application types"; `state` recomendado; `redirect_uri` igual ao registrado; confidencial usa `client_secret` | `[CITED: auth-code-flow]` |
| **Refresh token:** "replace themselves with a fresh token upon every use. The Microsoft identity platform doesn't revoke old refresh tokens when used to fetch new access tokens. Securely delete the old refresh token after acquiring a new one"; vida padrão 90 dias | `[CITED: learn.microsoft.com/entra/identity-platform/refresh-tokens]` |
| Revogação do refresh: troca de senha mantém vivo o token de **cliente confidencial**; reset de senha pelo admin (Entra ou M365 admin center), revogação pelo usuário ou pelo admin matam | `[CITED: refresh-tokens]` |
| `id_token`: `email` "isn't guaranteed to be correct and is mutable... Never use it for authorization or to save data for a user"; `preferred_username` é mutável e exige o escopo `profile`; identificador estável: `oid` + `tid` (ou `sub`, par-a-par por app) | `[CITED: learn.microsoft.com/entra/identity-platform/id-token-claims-reference]` |
| "Don't attempt to validate or read tokens for any API you don't own" (o token de acesso do Outlook não é um JWT para ler); só o `id_token` (audiência = o app) se decodifica | `[CITED: auth-code-flow, aviso]` |
| SMTP AUTH: desligado por padrão em organizações novas é **recomendação** da Microsoft ("we highly recommend that you disable SMTP AUTH ... and enable it only for the accounts that still require it"); configuração por caixa `Set-CASMailbox -SmtpClientAuthenticationDisabled $false` prevalece sobre a do tenant; com *security defaults* ligado SMTP AUTH já vem desligado | `[CITED: learn.microsoft.com/exchange/clients-and-mobile-in-exchange-online/authenticated-client-smtp-submission]` |
| Basic auth no SMTP AUTH: prazo de desligamento padrão no **fim de dezembro de 2026**, remoção final a anunciar no 2º semestre de 2027; vi isso só num espelho do Message Center (MC786329), não na Microsoft Learn | `[ASSUMED: fonte de terceiros mc.merill.net]` |
| XOAUTH2 do Exchange: `base64("user=" + userName + "^Aauth=Bearer " + accessToken + "^A^A")`; para caixa compartilhada o `userName` é o endereço da caixa compartilhada | `[CITED: how-to-authenticate-...]` |
| Revogação de refresh token por endpoint (equivalente ao `revoke` do Google): **não encontrei** documentação de endpoint por token na v2.0 | `[ASSUMED]`: no desconectar da Microsoft, apenas apagar localmente |

**Recomendação:** `https://login.microsoftonline.com/common/oauth2/v2.0/{authorize,token}`; escopos `openid email profile offline_access https://outlook.office.com/IMAP.AccessAsUser.All https://outlook.office.com/SMTP.Send`; `prompt=select_account` (ou `consent` quando o administrador negar), `login_hint`, PKCE, `state`. Guardar `oid`+`tid` e `preferred_username`. **A prova de que a conta é a do Canal**: o `id_token` só serve de **pré-conferência** para a mensagem de erro; a regra é o **login XOAUTH2 com `user=<endereço do Canal>`** que o próprio fluxo de conexão faz antes de gravar (IMAP e SMTP): se o token é de outra caixa, o servidor recusa e nada é gravado. Persistir o refresh token **novo** a cada renovação (rotação), com a escrita do cofre em transação própria (molde `token.ts:99-116`, que já trata a corrida por `credenciais_ativa_unica`); como o antigo continua válido, duas renovações concorrentes não se anulam. Erros de consentimento de administrador (`AADSTS...`, "need admin approval") voltam à página de retorno como frase fixa.
Mudança recente relevante: **SMTP AUTH por senha em Microsoft 365 está a caminho de ser desligado** (item acima); o caminho "senha" para `smtp.office365.com` deve avisar na tela, e o login OAuth é o recomendado.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Protocolo IMAP/SMTP, STARTTLS, XOAUTH2 | sockets e `AUTH` à mão | `imapflow`, `nodemailer` | Injeção pós-STARTTLS, `IDLE`, literais, códigos de resposta |
| MIME (RFC 2047, charsets, multipart, `cid`) | parser próprio | `mailparser` (`simpleParser`) | Codificações e aninhamento; já limita HTML (`maxHtmlLengthToParse`) |
| Composição do e-mail (`References`, anexos, folding de cabeçalho) | montar MIME à mão | `nodemailer` | Folding a 998 caracteres, `Bcc`, boundary |
| Classificar IP (mapeado v4-em-v6, CIDR) | regex de IP | `node:net` `BlockList` + `isIP` | Casa `::ffff:a.b.c.d` (documentado) |
| Limpar HTML | regex/`replace` | `sanitize-html` | Vetores de XSS e `style` |
| Assinar o `state` | JWT próprio | o `estado.ts` do Instagram (HMAC + `timingSafeEqual`) | Já testado (`estado.test.ts`) |
| Cifrar a credencial | cripto própria | `servicos/cofre.ts` | Já existe (`guardarCredencial`/`lerCredencial`) |
| Trava de leitor | flag em memória | `pg_try_advisory_lock` (conexão dedicada) ou lease em tabela | Duas instâncias da API |

**Key insight:** o risco do e-mail não está no protocolo e sim na superfície que ele abre (servidor escolhido pelo usuário, HTML hostil, `From` forjado, credencial de longa vida).

## Runtime State Inventory

Não se aplica: fase de funcionalidade nova (não é rename/refactor/migração). Há um ponto de estado em produção a registrar: a migração `017` é nova e imutável depois de aplicada (`013`, `014` seguem o mesmo rito: backup do schema `plataforma` e `npm run migrar -w @n1/api -- --seco` antes), e `COFRE_CHAVE` precisa existir no `api.env` (já existe para o Instagram).

## Common Pitfalls

### Pitfall 1: `n:*` devolve a última mensagem mesmo abaixo do cursor
**What goes wrong:** sem filtro, a mesma mensagem reentra a cada ciclo. **How to avoid:** descartar `uid < proximo_uid` no código; teste no `imapkit` com caixa vazia depois do cursor. **Warning signs:** linha da fila repetida (`on conflict do nothing` esconde o erro; contar inserções).

### Pitfall 2: `uidValidity` é `bigint`
**What goes wrong:** `JSON.stringify`/`pg` quebram ou perdem precisão. **How to avoid:** `uidValidity.toString()` e coluna `text`/`numeric`.

### Pitfall 3: `Message-ID` com colchetes inconsistentes
**What goes wrong:** `id_externo` guardado com `<...>` não casa com `In-Reply-To` sem eles. **How to avoid:** uma só função `idLimpo()` no domínio, usada na chave, em `id_externo`, na busca do fio e ao montar cabeçalhos.

### Pitfall 4: `mailparser` troca `cid:` por `data:` sozinho
**What goes wrong:** o HTML cresce até 20 MB (`maxInlinedImagesSize`) e a imagem some da lista de anexos se for só embutida. **How to avoid:** decidir: manter o padrão e permitir `data:image/(png|jpeg|gif|webp)` só em `img` na limpeza (sem SVG), ou `skipImageLinks: true` e tratar `cid` à mão `[CITED: README do mailparser]`. Em ambos, guardar a imagem como anexo (D-17-18).

### Pitfall 5: expiração do token no meio do `IDLE` (Exchange)
**What goes wrong:** `BYE Session invalidated - AccessTokenExpired` e o primeiro comando falha. **How to avoid:** `sessionExpires`; tratar `close` como reconexão, **não** como senha errada (só `authenticationFailed` conta como falha permanente).

### Pitfall 6: falha de renovação OAuth transitória x permanente
**What goes wrong:** `invalid_grant` (permanente) confundido com 5xx/rede (transitório) marca o Canal como `desconectada` por um soluço, ou o contrário. **How to avoid:** `invalid_grant`/`invalid_client`/`interaction_required`/`consent_required` = permanente; rede, 5xx, `temporarily_unavailable` = transitório `[CITED: Microsoft auth-code-flow, tabela de erros; Google: "invalid_grant" ⇒ reautenticar]`.

### Pitfall 7: anexo do leitor órfão (F6)
**How to avoid:** ver F6; teste com relógio injetado (`idadeMinimaMs`).

### Pitfall 8: o leitor sobe sem o processador
**What goes wrong:** `EMAIL_LEITOR_ATIVO=true` com `MENSAGERIA_WORKER_ATIVO=false` enche a fila e apaga anexos. **How to avoid:** o leitor só inicia se o processador de entrada está ativo (recusar com mensagem no log), ou usar a mesma flag; recomendação abaixo.

### Pitfall 9: quadros de log com credencial
`ImapFlow` usa `pino` por padrão; `logger: false`. Erros do nodemailer trazem `err.response` do servidor e, em XOAUTH2 falho, o desafio JSON: passar por `sanitizarErro` e **nunca** logar `err.response` antes de autenticar.

### Pitfall 10: `FRASES_DA_SAIDA` e `rotuloDoCanal`
O texto de "sem confirmação" cita WhatsApp (F2); `rotuloDoCanal` já tem `email` (`entregar-mensagem.ts:79`).

### Pitfall 11: o campo de assunto da tela hoje não é enviado
`conversation-thread.tsx` mostra o campo (`hasSubjectAndCopies`, ~1437-1450); `setAssunto` não chega a `NOVA_MENSAGEM` (`rotas/crm/mensagens.ts:49-59`, `strict`) `[VERIFIED: leitura]`. Sem os dois lados mudados no mesmo plano, a tela promete o que não envia.

## Code Examples

### Cursor e leitura (esboço)
```typescript
// Source: imapflow 2.12.1 (types.d.ts, imap-flow.js) lido nesta sessão
const lock = await client.getMailboxLock("INBOX");
try {
  const { uidValidity, uidNext } = client.mailbox as { uidValidity: bigint; uidNext: number };
  if (cursor.uidValidity !== uidValidity.toString()) { /* gravar o fato; recomeçar de uidNext, sem importar */ }
  for await (const m of client.fetch(`${cursor.proximoUid}:*`, { uid: true, size: true, source: true }, { uid: true })) {
    if (m.uid < cursor.proximoUid) continue;          // "n:*" sempre devolve a última
    // mailparser -> filtros -> bucket -> INSERT webhooks_recebidos (on conflict do nothing) -> avançar cursor
  }
} finally { lock.release(); }
```
Não executar outros comandos IMAP dentro do `for await` (a documentação avisa que trava; usar `fetchAll`) `[CITED: imapflow.com]`.

### Limpeza do HTML ao servir (D-17-13)
```typescript
// Source: README do sanitize-html (github.com/apostrophecms/apostrophe/.../sanitize-html) lido nesta sessão
import sanitizeHtml from "sanitize-html";
export const limparHtml = (html: string) =>
  sanitizeHtml(html, {
    allowedTags: ["p","br","div","span","b","strong","i","em","u","s","blockquote","ul","ol","li","pre","code","h1","h2","h3","h4","table","thead","tbody","tr","td","th","a","img","hr"],
    allowedAttributes: { a: ["href", "title"], img: ["src", "alt", "width", "height"], td: ["colspan", "rowspan"], th: ["colspan", "rowspan"] },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["data"] },          // remoto bloqueado; data: só imagem (conferir o MIME no filtro)
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    nestingLimit: 20,
    transformTags: { a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }) },
    exclusiveFilter: (f) => f.tag === "img" && !/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(f.attribs.src ?? ""),
  });
```
Sem `style` nem `<style>`/`<script>` (a documentação avisa que permitir `script` ou `style` abre XSS). Servir por rota própria (`GET /mensagens/:id/corpo-html`, `exigir(ler)`, `Cache-Control: no-store`) e exibir na web em `<iframe sandbox="" srcDoc=... referrerPolicy="no-referrer">` (sem `allow-scripts` e sem `allow-same-origin`), com `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">` no `srcDoc`. A web de hoje **não define CSP** (`apps/web/next.config.ts` lido: só `redirects()` e Sentry) e **não usa** `dangerouslySetInnerHTML`, o que evita adicionar sanitizador na web. O guia do Next 16 de CSP (`node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`) trata de `nonce` por `proxy`; **li só o início**: nada nele é necessário para o iframe `sandbox`, mas o planejador de `apps/web` deve ler o guia completo antes de acrescentar cabeçalhos globais.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@types/nodemailer`, `@types/mailparser`, `@types/smtp-server` | tipos dentro dos pacotes | nodemailer 10.x, imapflow 2.x | Não instalar os `@types` |
| `hoodiecrow-imap` | `imapkit` (mesma base, TypeScript, IdP OAuth) | 2026-10 | Dublê de IMAP maduro e estrito |
| IMAP com senha em Microsoft 365 | só OAuth (XOAUTH2); SMTP AUTH básico em retirada | Basic auth SMTP: fim de 12/2026 `[ASSUMED: espelho]` | O caminho "senha" não serve a M365 |
| Gmail com "acesso a app menos seguro" | senha de app (exige verificação em duas etapas) ou OAuth | — | Texto da tela "Outro servidor" (já no CONTEXT.md) |

**Deprecated/outdated:** `imap` e `imap-simple` (sem manutenção, não pesquisados em profundidade); `wildduck`/`imap-core` como dublê.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `imapkit` e `smtp-server` são legítimos e atendem (nome descoberto por busca e README) | Standard Stack | Spike do Wave 0 falha; cair para dublê escrito à mão |
| A2 | Faixas extras além de D-17-07 (CGNAT, `192.0.0.0/24`, documentação, multicast, NAT64, 6to4, `168.63.129.16`) | Pattern 1 | Falso positivo recusa servidor real raro (CGNAT) ou falso negativo |
| A3 | `n:*` devolve a última mensagem abaixo do cursor | Pattern 3 | Repetição já absorvida pelo índice; só desperdício |
| A4 | Gmail guarda em Enviados sozinho para SMTP autenticado | Pattern 6 | Mensagem duplicada ou ausente em Enviados; D-17-17 já manda conferir |
| A5 | Exchange Online guarda cópia em Itens Enviados ao enviar por SMTP AUTH | Pattern 6 | Idem; decidir no 9.4.4 |
| A6 | O nodemailer não escreve `Bcc` no MIME | Pattern 6 | Vazamento de cópia oculta: **testar no `smtp-server`** |
| A7 | Gmail `INBOX` = rótulo Inbox; Exchange anuncia `IDLE` | Pattern 3 | Mensagem arquivada some/entra; reduzir a conferência de 2 min |
| A8 | PKCE com verifier derivado por HMAC do `state` | Pattern 7 | Verifier previsível se o segredo vazar |
| A9 | Não há endpoint de revogação por refresh token na Microsoft v2.0 | Microsoft | Token continua vivo 90 dias depois de desconectar |
| A10 | Sugestões de tetos: 50 MiB por e-mail recebido, 200 KB de texto no `corpo`, 50 ids de `References`, 100 endereços, 50 sessões por processo | Pattern 3/4 | Tetos baixos demais ignoram e-mails legítimos |
| A11 | Prazo de retirada do Basic auth em SMTP AUTH (fim de 12/2026) | Microsoft | Texto da tela errado |
| A12 | Registrar o app Microsoft como "qualquer diretório + contas pessoais" para usar `common` | Microsoft | Contas pessoais recusadas |
| A13 | `Authentication-Results` existe nos e-mails de Gmail e Exchange | Pattern 3 | Campo vazio, sem efeito |
| A14 | Um atacante não adivinha `Message-ID` baseado em UUID | Pattern 5 | Injeção em Conversa alheia com `In-Reply-To` forjado |
| A15 | Cabeçalho `Authentication-Results`/`X-Auto-Response-Suppress` como sinais extras | Pattern 3 | Nenhum |

**A1, A4, A5, A6, A9, A11 e A12 precisam de confirmação do dono ou da prova real (9.4.4) antes de virar decisão travada.**

## Open Questions

1. **Uma flag ou duas para o leitor e o processador?** Recomendação: `EMAIL_LEITOR_ATIVO` **exige** `MENSAGERIA_WORKER_ATIVO=true` (o leitor se recusa a iniciar sem o processador, com aviso no log): o leitor sem processador enche a fila e a coleta apaga anexo (F6).
2. **Credenciais de OAuth da Microsoft e do Google em um só par de variáveis por serviço?** Sim, como D-17-03; o `state` usa o segredo do próprio serviço.
3. **A pasta `\Sent` quando o servidor não anuncia special-use:** sem `\Sent`, pular o `APPEND` e registrar (recomendado) ou tentar "Sent"/"Enviados"/"Sent Items" (arriscado). Decisão do planejador.
4. **Mesclar D-17-15:** o dono ainda deve confirmar (já marcado no CONTEXT.md); este documento mostra o efeito no envio (resposta sai ao Contato principal).
5. **Quando a CASA do Google passa a ser necessária?** Antes do primeiro cliente fora do time N1 em produção. Prazo/custo: **desconhecido**.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | API, testes | ✓ | v24.14.0 (CI: 24) | — |
| npm | instalação | ✓ | 11.9.0 | — |
| Docker | Postgres local e gate de testes | CLI ✓ (`docker` 29.3.1); daemon não confirmado nesta sessão | — | Postgres local existente (porta 55718 nos testes) |
| Postgres 16 local | testes de persistência | não sondado | — | testes de banco pulam sem `DATABASE_URL` |
| Caixas reais (Gmail com senha de app, Microsoft 365, hospedagem comum, conta Google em teste) | 9.4.4 | ✗ (do dono, 9.1.1/9.1.3) | — | Prova só com dublês até o dono fornecer |
| Apps OAuth do Google e da Microsoft | prova real do login | ✗ (dono criando) | — | Servidor de login falso (D-17-02) |

**Missing dependencies with no fallback:** nenhuma que bloqueie a escrita do código.
**Missing dependencies with fallback:** caixas e apps reais (prova final do dono).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (`apps/api/package.json`: `"test": "vitest run"`, `vitest ^5.0.0`) |
| Config file | do workspace `apps/api` (existente) |
| Quick run command | `npm test -w @n1/api -- src/mensageria/provedores/email` |
| Full suite command | `npm run check` (raiz; no CI os testes de banco são pulados; o gate local com Postgres leva 13-17 min, conforme a memória do projeto) |

### Dublês (molde `testes/servidor-falso.ts`: servidor real em porta efêmera, nunca mock de `fetch`)
| Peça | Dublê | Como programar falha |
|------|-------|----------------------|
| IMAP | `imapkit` em `127.0.0.1` porta 0 (usuários, XOAUTH2 com token `testtoken` por padrão, IDLE, UIDPLUS, SPECIAL-USE) | regras de falha (`close: 'reset'`), `control.addUser`, adicionar mensagem por API de controle, mudar `UIDVALIDITY` recriando a caixa `[CITED: README do imapkit]` |
| SMTP | `smtp-server` com `onAuth` (PLAIN/LOGIN/XOAUTH2), `onRcptTo`, `onData` | recusa 5xx em `RCPT`; `onData` que nunca chama o callback + `socketTimeout` curto = ambíguo `[ASSUMED]` |
| Token endpoints Google/Microsoft | `criarServidorFalso()` (`servidor-falso.ts`, tipos `ok`, `atraso`, `respostaPerdida`, `timeout`) com `invalid_grant`, 5xx, `id_token` programado; endpoints injetados por `ConfiguracaoDoEmail.oauth.endpoints` | — |
| IdP completo | o OAuth embutido do `imapkit` (opcional; PKCE S256, códigos de uso único) | opcional |
| DNS e IP | resolvedor injetado `resolver(host) → [{address,family}]`; testes da guarda sem rede | — |
| Bucket | `testes/armazenamento-falso.ts` | — |
| TLS | certificado de fixture (SAN `localhost`, `127.0.0.1`) injetado como `ca` **só** pela dependência de teste da fábrica; produção não tem essa porta | — |
| Relógio | `testes/relogio.ts` | — |

**A guarda e os dublês convivem assim:** os testes funcionais usam `criarFabricaDeConexao({ resolver, politica })` com `politica` que **permite** `127.0.0.1` (só por injeção); um arquivo à parte (`rede.test.ts`) roda a guarda de produção com um resolvedor falso: IPv4 privado, loopback, link-local, `169.254.169.254`, `::1`, `::ffff:127.0.0.1`, `::ffff:7f00:1`, `fe80::1`, `fc00::1`, `0.0.0.0`, host que devolve **um** IP público e **um** privado (recusa), IP literal no host, host com `@`/espaço/barra, porta 25/110/8080 recusada e `143` sem STARTTLS recusada. Prova de "conecta ao IP conferido": o dublê de IMAP registra o `remoteAddress` e o `SNI`; o resolvedor falso devolve um IP na primeira chamada e `127.0.0.1` na segunda e o teste mostra que a segunda nunca ocorre (uma única resolução por conexão).

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EML-01 | Senha certa: credencial no cofre + Canal `conectada` + cursor no `UIDNEXT`; senha errada: nada gravado, frase "O servidor IMAP recusou o usuário ou a senha."; SMTP recusa: diz qual falhou; resposta/log/erro sem a senha | integração (imapkit + smtp-server + Postgres) | `npm test -w @n1/api -- src/mensageria/provedores/email/conexao` | ❌ Wave 0 |
| EML-02 | Servidor de login falso: `state` de outro Membro/Espaço recusado; endereço diferente do Canal recusado sem gravar; certo: refresh token no cofre, `conectada`; nenhum token em log | integração | `... -- email/oauth` | ❌ Wave 0 |
| EML-03 | E-mail novo vira Conversa em ≤ 2 min (relógio e conferência acelerados); reiniciar não repete; histórico não importado; `UIDVALIDITY` novo não reimporta; `n:*` não repete a última; filtros D-17-11 viram `ignorado:*` | integração | `... -- email/leitor` | ❌ Wave 0 |
| EML-04 | Troca de 3 e-mails numa Conversa; `References` sem `In-Reply-To`; Conversa resolvida reabre, na lixeira não; D-17-15 | unitário (domínio) + integração | `npm test -w @n1/dominio -- fio-de-email` e `... -- email/entrada` | ❌ Wave 0 |
| EML-05 | `In-Reply-To`/`References` certos no DATA lido pelo `smtp-server`; sem `Bcc` no cabeçalho; anexo vai e volta; ambíguo (`onData` mudo) nunca reenvia; falha parcial de destinatário = `ok`; `APPEND` conforme `append_enviados` e falha do `APPEND` não falha a Mensagem | integração | `... -- email/provedor` | ❌ Wave 0 |
| EML-06 | `rede.test.ts` acima + `143` sem STARTTLS e certificado inválido (CA ausente) recusados | unitário + integração | `... -- email/rede` | ❌ Wave 0 |
| EML-07 | Renovação `invalid_grant` ⇒ `desconectada` com motivo e leitor parado; rede/5xx ⇒ reconecta e estado igual; senha trocada (`authenticationFailed`) ⇒ para; `pendente` reenfileirada ao voltar | integração | `... -- email/queda` | ❌ Wave 0 |
| Contrato | `descreverContratoDoProvedor("e-mail", ...)` com `semWebhook` | contrato | `... -- email/provedor.contrato` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -w @n1/api -- src/mensageria/provedores/email` (e `-w @n1/dominio` quando tocar o domínio)
- **Per wave merge:** `npm run check`
- **Phase gate:** `npm run check` verde no gate local com Postgres antes de `/gsd-verify-work`

### Wave 0 Gaps
- [ ] **Spike do `imapkit` em módulo**: confirmar a opção programática de TLS (o README mostra `--tls-port`), XOAUTH2 aceito pelo `imapflow`, API para inserir mensagem e recriar a caixa com outro `UIDVALIDITY`, e a regra de falha de IDLE. Se o spike falhar, escrever o dublê mínimo à mão (só `CAPABILITY`, `AUTHENTICATE`, `SELECT`, `FETCH`, `IDLE`, `APPEND`, `LOGOUT`).
- [ ] Fixture de certificado TLS (SAN `localhost`, `127.0.0.1`) para os testes de TLS.
- [ ] `testes/servidor-de-email-falso.ts` com `iniciar()` que sobe IMAP+SMTP e devolve `{imap, smtp, adicionarMensagem, entregues, fechar}`.
- [ ] Arquivos `*.test.ts` das linhas da tabela; `fio-de-email.test.ts` no domínio.
- [ ] Ajuste do `contrato-do-provedor.ts` (`semWebhook`) e do `processador-de-entrada.test.ts` para `anexosGuardados`.
- [ ] Framework: nenhuma instalação nova de runner; só `imapkit` e `smtp-server` (`-D`).

**Só se prova com caixa real (9.4.4, do dono):** Gmail com senha de app (INBOX, cópia em Enviados, limites), Microsoft 365 com login (XOAUTH2 do Exchange, `sessionExpires`, `IDLE`, cópia em Enviados, SMTP AUTH por caixa), hospedagem comum, o login do Google em modo de teste (7 dias), o anexo que "vai e volta", a resposta no mesmo fio no programa do remetente, e o `APPEND` no `\Sent`.

## Security Domain

`security_enforcement` ligado, ASVS nível 1 (`.planning/config.json`).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | sim | Senha de app/OAuth do **usuário** nunca em log/resposta/erro; XOAUTH2 só por TLS; `exigir(conectar,canal)` no serviço |
| V3 Session Management | sim (sessão do Membro no `concluir`) | `state` assinado, validade 10 min, conferência de Membro+Espaço (molde `estado.ts`); `timingSafeEqual` |
| V4 Access Control | sim | `exigir` do serviço de Canal; `ler` para `GET .../conta`; leitor lê só o Canal do Espaço da linha; `workspace_id` em toda consulta |
| V5 Input Validation | sim | `zod` strict: host (regex + `domainToASCII` + guarda), porta ∈ {993,143,465,587}, e-mail por `normalizarEmail`, `assunto` sem CR/LF, endereços limitados; HTML por `sanitize-html` |
| V6 Cryptography | sim | Cofre existente (cifrado); HMAC-SHA256 e PKCE S256 com `node:crypto`; nunca cripto própria |
| V7 Error Handling and Logging | sim | `logger:false` nas bibliotecas; `sanitizarErro`; log só com ids e contagens (padrão `mensageria.etapas`) |
| V9 Communications | sim | TLS ≥ 1.2, `rejectUnauthorized: true`, `requireTLS`/`doSTARTTLS`, sem opção de aceitar certificado inválido |
| V12 Files and Resources | sim | Anexos pela guarda de mídia (tipo, teto, assinatura); download sempre como anexo |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SSRF / varredura de portas pela conexão "Outro servidor" | Information Disclosure / Elevation | Guarda de rede, portas fixas, resolução única, IP conferido, erro classificado, **reaplicada a cada reconexão** |
| DNS rebinding entre a conferência e a conexão | Spoofing | `host` = IP literal nas duas bibliotecas (verificado nas fontes) |
| Credencial do usuário em log/erro | Information Disclosure | `logger:false`, `sanitizarErro`, teste de contrato "nenhum resultado nem erro carrega a credencial" |
| CSRF/forja de login OAuth (ligar a caixa de outra pessoa) | Spoofing | `state` HMAC amarrado a Membro+Espaço+Canal; URI de retorno exata; PKCE |
| XSS/rastreamento por HTML de e-mail | Tampering / Information Disclosure | `sanitize-html` no servidor + iframe `sandbox` sem scripts + CSP no `srcDoc`; imagens remotas bloqueadas |
| Injeção de cabeçalho (CRLF) em `assunto`/endereços | Tampering | Validação `zod` + nodemailer |
| Vazamento de Bcc | Information Disclosure | `bcc` só no envelope; teste que lê o DATA no `smtp-server` |
| `From` forjado entra na Conversa de um Contato existente | Spoofing | Aceito pelo desenho (D-17-12); registrar `Authentication-Results` para auditoria; `Message-ID` imprevisível contra forja de fio |
| Bomba de MIME/arquivo grande, aninhamento profundo | Denial of Service | Teto de tamanho antes do `source`; teto de anexos; `mailparser` limita HTML (`maxHtmlLengthToParse`, 1000 níveis `[CITED: README]`) |
| Laço de e-mail (resposta automática) | Denial of Service | Filtros D-17-11 (a resposta humana da Caixa não leva `Auto-Submitted`) |
| Token de longa vida roubado do cofre | Information Disclosure | Cofre cifrado; apagar (não só revogar) ao desconectar/arquivar; revogar no Google |
| Sondagem de credenciais pelo endpoint de conexão (força bruta) | Spoofing | Limite de taxa próprio foi adiado (CONTEXT.md); mínimo recomendado: uma verificação por vez por Membro e teto de 10 tentativas por hora em memória `[ASSUMED]` |

## Reuse Map (item 10)

| Peça | Arquivo e função (lidos nesta sessão) | Uso no e-mail |
|------|----------------------------------------|---------------|
| Contrato do provedor | `mensageria/provedor.ts:110-137` (`ProvedorDeMensageria`), `:67-91` (`EnvioAoProvedor`), `:94-102` (`ResultadoDoEnvio`), `:152-160` (`ErroDeProvedor`) | Implementar; estender |
| Registro | `mensageria/registro.ts:39-55` (`registroPadrao`), `:57-67` (`provedorDoCanal`), `:75-91` (`canalParaProvedor`: credencial por `tipo = canal.provedor`) | Registrar `email-imap-smtp`; credencial de `tipo "email-imap-smtp"` |
| Contrato de teste | `mensageria/contrato-do-provedor.ts:30-52` (`FabricaDoContrato`), `:61-167` | Estender com `semWebhook` |
| Processador de entrada | `processador-de-entrada.ts:283-372` (`processar`), `:306-318` (mídia + `receberMensagem`), `:359-362` (evento `conexao`) | Interpretar o `corpo`; `anexosGuardados` |
| Recebimento | `servicos/crm/recebimento.ts:161-345` (`processar`): `:180` (tipo do Identificador), `:183` (`normalizarIdentificadorDeContato`), `:266-274` (destino), `:313-317` (citação), `:319-336` (`inserirRecebida`) | Inserir `mensagemRespondida`; levar `enderecosAdicionais` |
| Domínio do recebimento | `packages/dominio/src/crm/recebimento.ts:33-50` (`RecebidaDoProvedor`), `:71-81` (`destinoDaRecebida`) | Ganha campos; `mensagemRespondida` ao lado |
| Fila | `rotas/webhooks-de-mensageria.ts:155-160`, `instagram/entrada.ts:89`, `whatsapp-cloud/entrada.ts:89` (`INSERT ... on conflict (workspace_id, canal_id, chave) where chave is not null do nothing`) | Molde do `INSERT` do leitor |
| Mídia | `mensageria/midia.ts:66-120` (`criarGuardaDeMidia`) | Reuso com adaptador em memória |
| Saída | `entregar-mensagem.ts:105-329` (`criarEntregadorDeMensagens`), `:221-243` (monta o envio), `:318-327` (desfechos) | Preencher assunto/cópias/fio; frases |
| Reenfileirar pendentes | `fila-de-saida.ts:104` (`reenfileirarPendentesDoCanal`) | Ao conectar |
| Conexão/estado do Canal | `aplicar-conexao.ts` (`aplicarConexaoAoCanal`), `instagram/conexao.ts:139-244` (`iniciar`/`concluir`), `:124-137` (`marcarComErro`) | Moldes de conectar e de queda |
| `state` | `instagram/estado.ts:34-75` (`assinarEstado`, `lerEstado`) | Copiar com chave por serviço e `s` |
| Renovação preguiçosa | `instagram/token.ts:69-148` (`TokenParaUsar`, `criarTokensPg`, `gravarRenovada`) | Mesmo desenho, com `refreshToken` |
| Repositório da conta | `instagram/repositorio.ts:72-96` (`gravarConta`, `esquecerConta`) | Molde da `017` e do apagar |
| Migração | `014-instagram.sql` (PK `(workspace_id, canal_id)`, FK `on delete cascade`, trigger `crm_toque_atualizado_em`, bloco que desliga RLS) | Molde da `017` |
| Gancho de desconectar/arquivar | `servicos/crm/canais.ts:234` e `:386` | Adicionar o e-mail |
| Rotas por provedor | `rotas/crm/instagram.ts` (3 rotas, `PARAMS_ID`, `responder`) | Molde de `rotas/crm/email.ts` |
| Trava consultiva | `coleta-de-orfaos.ts:122-144` (`pg_try_advisory_lock(hashtext($1))`) e `evolution/conferencia.ts:157` | Padrão; atenção à conexão (F5) |
| Flags no `index.ts` | `index.ts:300-338` (`MENSAGERIA_WORKER_ATIVO`, `COLETA_DE_ORFAOS_ATIVA`), `aoEncerrar` `:157` | `EMAIL_LEITOR_ATIVO` |
| Normalização | `packages/dominio/src/crm/normalizacao.ts:51` (`normalizarEmail`), `:154-155` (`case "email"`), `:28` (`googlemail.com`) | Contato e comparação de conta |
| Capacidades | `packages/dominio/src/crm/capacidades.ts:132-146` (`email`: `foraDaJanela: "livre"`, `hasSubjectAndCopies: true`, `sendableMediaTypes` incluindo `spreadsheet` e `other`, `richText: true`) | Já pronto |
| Conversa por tipo | `packages/dominio/src/crm/conversas.ts:143` (`TIPO_DE_IDENTIFICADOR_DO_CANAL`) | Já cobre `email` |
| Tela de retorno | `apps/web/.../canais/instagram/retorno/page.tsx` (lê o `state` com `canalDoState`, `useRehidratar`, `concluirConexaoDoInstagram`) | Molde |
| Quadro reservado | `apps/web/src/features/crm/conectar-canal.ts` (`"email-imap-smtp"`, `espacoReservado`) | Trocar |

**Caminhos do `TAREFAS-POR-SESSAO.md` conferidos (linhas hoje):** `capacidades.ts:132` ✓; `mensagens.ts:75` (`EnderecoAdicional`) ✓ e `:135` (`NovaMensagem`) ✓; `provedores-de-canal.ts:33` ✓; `NOVA_MENSAGEM` está em `rotas/crm/mensagens.ts:49` (o plano diz 40-47: envelheceu); `abertaDoPar` está em `repositorios/crm/conversas.ts:182` (plano: 138: envelheceu; a interface em `:50`); `identificadorCanonico` mora em `packages/dominio/src/operations/canais.ts` (importado em `crm/canais.ts:23`; o plano cita `operations/canais.ts:88-91`, linhas não conferidas); o campo de assunto da tela está em `conversation-thread.tsx` por volta de `:1437-1450` (plano: 1182-1190, envelheceu); o quadro reservado está em `conectar-canal.ts` por volta de `:68-71`. O texto do plano que manda o leitor em `provedores/email/leitor.ts` e a migração `017` coincide com o estado do repositório (a última migração é a `016`).

## Sources

### Primary (HIGH confidence)
- Código do repositório lido nesta sessão: `mensageria/{provedor,registro,contrato-do-provedor,processador-de-entrada,entregar-mensagem,midia,coleta-de-orfaos}.ts`, `provedores/instagram/{provedor,conexao,estado,token,repositorio,do-ambiente}.ts`, `servicos/crm/recebimento.ts`, `rotas/crm/instagram.ts`, `testes/servidor-falso.ts`, `migracoes/013`, `014`, `packages/dominio/src/crm/{recebimento,mensagens,midia,capacidades}.ts`, `apps/web/next.config.ts`
- Fonte de `imapflow` 2.12.1 e de `nodemailer` 10.6.0 (tarballs do registro npm, lidos em `dist/esm`)
- `npm view` e `gsd-tools query package-legitimacy check` (registro npm)
- Google: `developers.google.com/workspace/gmail/imap/xoauth2-protocol`, `.../gmail/api/auth/scopes`, `.../identity/protocols/oauth2/production-readiness/restricted-scope-verification`, `.../identity/protocols/oauth2`, `.../oauth2/web-server`, `.../openid-connect/openid-connect`, `support.google.com/cloud/answer/15549945`, `knowledge.workspace.google.com/admin/gmail/gmail-bandwidth-limits`
- Microsoft Learn: `how-to-authenticate-an-imap-pop-smtp-application-by-using-oauth`, `v2-oauth2-auth-code-flow`, `refresh-tokens`, `id-token-claims-reference`, `authenticated-client-smtp-submission`
- Node: `nodejs.org/api/net.html` (BlockList, `autoSelectFamily`, `lookup`); RFC 2177, RFC 5322 §3.6.4 (`rfc-editor.org`); `imapflow.com/docs/api/imapflow-client`

### Secondary (MEDIUM confidence)
- README do `imapkit` e do `mailparser` (via `npm view readme`); README do `sanitize-html` (GitHub)
- Busca: mensagem MC786329 (espelho `mc.merill.net`) sobre SMTP AUTH; GreenMail (Apache-2.0)

### Tertiary (LOW confidence)
- Comportamento do Gmail de salvar em Enviados (fóruns/Thunderbird); `INBOX` do Gmail; `IDLE` do Exchange (conhecimento prévio)

## Não verificado (explícito)
- Custo, prazo e escopo exatos da CASA do Google; se um CRM multi-cliente poderia usar a exceção de "uso interno".
- Qualquer comportamento contra Gmail, Exchange Online ou hospedagem real (`IDLE`, limite de conexões simultâneas, expiração de token no Gmail, cópia em Enviados, mensagens de erro do `AUTH`).
- Opção programática de TLS e API de controle do `imapkit`, e a programação de falha de `DATA` no `smtp-server` (lidos só pelo README).
- Licenças e `postinstall` da árvore **transitiva** completa (o `npm install` de teste foi negado); verificadas só as dependências diretas.
- Se o nodemailer remove `Bcc` do MIME; se `n:*` devolve a última mensagem (marcados `[ASSUMED]`, ambos com teste previsto).
- O guia completo de CSP do Next 16 (li só o início); nada na recomendação do iframe `sandbox` depende dele.
- Endpoint de revogação de refresh token na Microsoft.
- Data de retirada do SMTP AUTH básico (só espelho de terceiro).
- Se `docker` está com o daemon ativo e o Postgres local de testes no ar.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH para as quatro bibliotecas (registro + fonte); MEDIUM para `imapkit`/`smtp-server` (nomes por busca, README, spike pendente)
- Architecture: HIGH nos pontos de código (linhas conferidas); MEDIUM no desenho do leitor e da trava (decisão de projeto)
- OAuth Google e Microsoft: HIGH nas páginas oficiais citadas; LOW nos pontos marcados `[ASSUMED]`
- Pitfalls: MEDIUM-HIGH

**Research date:** 2026-11-19
**Valid until:** 2026-12-03 (bibliotecas e política de SMTP AUTH da Microsoft mudam em semanas; reconferir versões e a página do Message Center antes de executar)
