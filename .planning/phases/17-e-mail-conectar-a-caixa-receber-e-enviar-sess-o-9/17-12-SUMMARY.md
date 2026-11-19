---
phase: 17-e-mail-conectar-a-caixa-receber-e-enviar-sess-o-9
plan: 12
subsystem: mensageria
tags: [email, oauth, microsoft, xoauth2, pkce, state, refresh-token, cofre, rotas, tdd]

requires:
  - phase: 17-e-mail-conectar-a-caixa-receber-e-enviar-sess-o-9
    provides: "17-03: criarFabricaDeConexao (verificarImap/verificarSmtp com auth oauth); 17-04: porta AcessoDoEmail, credencial v: 1, gravarConta, gravarCursor; 17-05: o nucleo da conexao por senha, configuracao.ts, queda.ts e rotasDoEmail"
provides:
  - "estado.ts: assinarEstadoDoEmail, emitirEstadoDoEmail, lerEstadoDoEmail, verificadorPkce, desafioPkce (state HMAC por servico, 10 min, PKCE S256 derivado do segredo do servidor)"
  - "oauth/comum.ts: ServicoDeLogin, TokensDoLogin, ClienteOauthDoEmail, ErroDoLogin, lerIdToken"
  - "oauth/microsoft.ts: criarClienteMicrosoft (URL do login, troca do codigo, renovacao com rotacao), ENDERECOS_DA_MICROSOFT, ESCOPOS_MICROSOFT"
  - "token.ts: renovadoresDoAmbiente, FabricasDeClienteOauth, CLIENTES_DE_PRODUCAO"
  - "conexao.ts: ServicoDeConexaoDoEmail.autorizar e .concluir; o nucleo gravarEConectar da senha e do login"
  - "rotas: POST /canais/:id/email/oauth/:servico/autorizar e POST /canais/email/oauth/concluir"
  - "credencial.ts: renovacao serializada por Canal, frase de produto da recusa permanente e acessoDoEmailDoAmbiente com os renovadores do ambiente"
affects: [17-13, 17-14, 17-15, 17-16]

actuals:
  tokens: 33900
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "state assinado sem tabela com a chave do segredo do CLIENTE do servico; o servico (s) vai sob a assinatura e escolhe o segredo na leitura"
    - "PKCE sem tabela: verificador = base64url(HMAC(segredo, 'pkce:' + nonce)), recalculado no concluir depois de o state conferir"
    - "A prova da caixa e o login XOAUTH2 com user = endereco do Canal; o id_token so pre-confere a frase"
    - "Fabrica de cliente OAuth injetavel (FabricasDeClienteOauth): o teste troca os enderecos pelo servidor de login falso, nunca por variavel"
    - "Renovacao de token serializada por Canal dentro do processo (Map de promessas em curso)"

key-files:
  created:
    - apps/api/src/mensageria/provedores/email/estado.ts
    - apps/api/src/mensageria/provedores/email/estado.test.ts
    - apps/api/src/mensageria/provedores/email/oauth/comum.ts
    - apps/api/src/mensageria/provedores/email/oauth/microsoft.ts
    - apps/api/src/mensageria/provedores/email/oauth/microsoft.test.ts
    - apps/api/src/mensageria/provedores/email/token.ts
    - apps/api/src/mensageria/provedores/email/token.test.ts
    - apps/api/src/mensageria/provedores/email/oauth.test.ts
    - apps/api/src/testes/login-oauth-falso.ts
  modified:
    - apps/api/src/mensageria/provedores/email/conexao.ts
    - apps/api/src/mensageria/provedores/email/credencial.ts
    - apps/api/src/mensageria/provedores/email/credencial.test.ts
    - apps/api/src/rotas/crm/email.ts
    - apps/api/src/rotas/crm/email.test.ts

key-decisions:
  - "O state vale UMA vez por processo (Map de nonces usados), consumido depois de conferir Membro e Espaco para que um state alheio nao queime o de quem pediu; entre processos o que garante e o codigo de uso unico do servico, o PKCE e a transicao do Canal"
  - "concluir sem a configuracao inteira responde 503; autorizar do Google responde 503 ate o 17-13 trazer o cliente, em vez de inventar a URL"
  - "A frase do 503 diz os NOMES das duas variaveis do servico quando a configuracao existe sem o par; sem configuracao nenhuma, os nomes vem do ambiente (variaveisQueFaltam)"
  - "Recusa de login por XOAUTH2 (authenticationFailed) vira CONTA_DIFERENTE; qualquer outra falha de conexao (rede, tempo, certificado) fica 422 CONEXAO_RECUSADA como na senha"
  - "Erro desconhecido de renovacao e transitorio: so invalid_grant, interaction_required, consent_required e invalid_client derrubam a conexao"

patterns-established:
  - "Nada de estado.ts, oauth/*.ts, token.ts e conexao.ts chama registro, console nem serializa codigo, token ou segredo do cliente; ErroDoLogin e ErroDeRenovacao tem mensagem fixa"

requirements-completed: [EML-02, EML-07]

duration: 55min
completed: 2026-11-19
status: complete
plan_head_before: 9cec70728d3b083aea7d1431ffea89e4b162bc14
plan_head_after: fdcb94bbe523b0a61bb083ac0fdb7b0e50941d26
commits: 3

coverage:
  - id: D1
    description: "autorizar devolve a URL do login com client_id, redirect_uri, escopos (openid email profile offline_access, IMAP.AccessAsUser.All e SMTP.Send), state, code_challenge de 43 caracteres S256 e login_hint = endereco do Canal; o segredo do cliente nunca vai a URL"
    requirement: EML-02
    verification:
      - kind: integration
        ref: "apps/api/src/mensageria/provedores/email/oauth.test.ts#autorizar devolve a URL do login com o state, o PKCE S256 e o pedido de escopos"
        status: pass
    human_judgment: false
  - id: D2
    description: "concluir troca o codigo no servidor de login falso com o verificador cujo SHA-256 e o desafio da URL, prova a caixa por XOAUTH2 no IMAP e no SMTP e grava credencial oauth microsoft no cofre, conta com oid:tid, cursor no UIDNEXT e Canal conectada"
    requirement: EML-02
    verification:
      - kind: integration
        ref: "apps/api/src/mensageria/provedores/email/oauth.test.ts#concluir troca o código com o verificador do desafio, prova a caixa por XOAUTH2 e grava credencial, conta e cursor"
        status: pass
    human_judgment: false
  - id: D3
    description: "state de outro Membro, de outro Espaco, vencido (10 min), adulterado, assinado com outro segredo e ja usado respondem 400 ESTADO_INVALIDO sem gravar nada e sem chamar o login; o state de outra pessoa nao queima o de quem pediu"
    requirement: EML-02
    verification:
      - kind: integration
        ref: "apps/api/src/mensageria/provedores/email/oauth.test.ts#o state"
        status: pass
      - kind: unit
        ref: "apps/api/src/mensageria/provedores/email/estado.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "A prova da conta e o login XOAUTH2: id_token de outra conta responde 409 CONTA_DIFERENTE sem abrir a caixa; id_token com o e-mail certo mas token que a caixa recusa tambem responde 409 e nada e gravado; aud errada ignora o id_token"
    requirement: EML-02
    verification:
      - kind: integration
        ref: "apps/api/src/mensageria/provedores/email/oauth.test.ts#a prova da conta"
        status: pass
    human_judgment: false
  - id: D5
    description: "AADSTS65001 responde 409 CONSENTIMENTO_DO_ADMINISTRADOR; codigo recusado 422; servico fora 502; sem o par de variaveis da Microsoft autorizar responde 503 com os NOMES do que falta; sem cofre 503 antes do login"
    requirement: EML-02
    verification:
      - kind: integration
        ref: "apps/api/src/mensageria/provedores/email/oauth.test.ts#as recusas do serviço de login"
        status: pass
    human_judgment: false
  - id: D6
    description: "A renovacao e preguicosa (menos de 5 min), grava o refresh token NOVO e o token novo no cofre antes de descartar o antigo, nao renova na chamada seguinte, e renovacoes simultaneas do mesmo Canal fazem uma so ida ao servico"
    requirement: EML-07
    verification:
      - kind: integration
        ref: "apps/api/src/mensageria/provedores/email/token.test.ts#vencendo em 2 min: renova, o cofre passa a ter o refreshToken novo"
        status: pass
      - kind: integration
        ref: "apps/api/src/mensageria/provedores/email/token.test.ts#renovações ao mesmo tempo do mesmo Canal são serializadas"
        status: pass
    human_judgment: false
  - id: D7
    description: "invalid_grant, interaction_required, consent_required e invalid_client sao recusa permanente com a frase de produto, que leva o Canal a desconectada pelo registrarQuedaDoEmail; 503, temporarily_unavailable, 429, servidor mudo e erro desconhecido sao transitorios e nao derrubam nada"
    requirement: EML-07
    verification:
      - kind: integration
        ref: "apps/api/src/mensageria/provedores/email/token.test.ts#invalid_grant é permanente"
        status: pass
      - kind: unit
        ref: "apps/api/src/mensageria/provedores/email/oauth/microsoft.test.ts#renovar"
        status: pass
    human_judgment: false
  - id: D8
    description: "acessoDoEmailDoAmbiente(env) monta a porta com os renovadores da configuracao do ambiente: com o par da Microsoft renova, sem ele ou com URI de retorno invalida responde OAUTH_NAO_CONFIGURADO sem lancar"
    requirement: EML-07
    verification:
      - kind: integration
        ref: "apps/api/src/mensageria/provedores/email/token.test.ts#acessoDoEmailDoAmbiente(env) usa os renovadores da configuração"
        status: pass
    human_judgment: false
  - id: D9
    description: "As rotas exigem a sessao, validam o corpo (.strict, codigo ate 4096, state ate 2048, servico google|microsoft) e, com o logger de producao capturado, nenhuma resposta nem linha de log leva o codigo, os tokens ou o segredo do cliente"
    requirement: EML-02
    verification:
      - kind: integration
        ref: "apps/api/src/rotas/crm/email.test.ts#autorizar e concluir de ponta a ponta"
        status: pass
      - kind: integration
        ref: "apps/api/src/rotas/crm/email.test.ts#POST /canais/email/oauth/concluir"
        status: pass
    human_judgment: false
  - id: D10
    description: "A12 (autoridade common), A9 (sem revogacao por endpoint) e A11 ficam so como comentarios de codigo a confirmar na prova real (9.4.4); nenhum vira texto de tela"
    requirement: EML-02
    verification:
      - kind: other
        ref: "grep A12 e A9 em apps/api/src/mensageria/provedores/email/oauth/microsoft.ts"
        status: pass
    human_judgment: true
---

# Phase 17 Plan 12: Entrar com a Microsoft Summary

**`autorizar` devolve a URL do login da Microsoft com `state` HMAC de 10 min e PKCE S256, `concluir` troca o código no servidor de login, PROVA a caixa abrindo IMAP e SMTP por XOAUTH2 com `user` = o endereço do Canal e só então grava o token de renovação no cofre pelo mesmo núcleo da senha; a renovação é preguiçosa, serializada por Canal e grava o refresh token novo, e a autorização retirada vira queda avisada na ficha.**

## Performance

- **Duration:** ~55 min
- **Completed:** 2026-11-19
- **Tasks:** 3 (1 traçador, 2 auto; todas TDD)
- **Files:** 9 criados, 5 alterados

## Accomplishments

- **Traçador (Task 1):** `estado.ts` (state `<dados>.<assinatura>` com Membro, Espaço, Canal, serviço, nonce, 10 min, `timingSafeEqual`, segredo do cliente do serviço) e o PKCE sem tabela (verificador derivado do segredo e do nonce). `oauth/microsoft.ts` com a URL do login, a troca do código (formulário, `client_secret`, `code_verifier`, tempo limite de 15 s) e `lerIdToken` que confere `aud`, `exp` e forma sem confiar no conteúdo. `conexao.ts` ganhou `autorizar` e `concluir` sobre o núcleo `gravarEConectar`, agora compartilhado com a senha (a gravação da senha ficou idêntica). O teste do traçador roda contra o Postgres local, o servidor de login falso e os dublês de IMAP e SMTP: o verificador enviado casa com o desafio da URL, a caixa é aberta por XOAUTH2, e ficam gravados o cofre `v: 1 oauth microsoft`, a conta (`microsoft`, `oid:tid`), o cursor e o Canal `conectada`.
- **Renovação (Task 2):** `token.ts` (`renovadoresDoAmbiente`) liga o renovador só do serviço com o par completo; `acessoDoEmailDoAmbiente(env)` o usa e, com URI de retorno inválida, desliga o login sem derrubar a senha. A porta grava o refresh token NOVO e o token novo na mesma transação que revoga o antigo; a segunda chamada não renova; renovações simultâneas do mesmo Canal fazem uma só ida. `invalid_grant`, `interaction_required`, `consent_required` e `invalid_client` são permanentes e devolvem a frase "A autorização da Microsoft venceu ou foi retirada: entre de novo com a Microsoft." que o envio passa a `registrarQuedaDoEmail`; 503, 429, `temporarily_unavailable`, servidor mudo e erro desconhecido são transitórios.
- **Rotas e recusas (Task 3):** as duas rotas, finas, com `.strict()`; as recusas com as frases exatas do plano (`ESTADO_INVALIDO`, `CONTA_DIFERENTE` nas duas formas, `CONSENTIMENTO_DO_ADMINISTRADOR`, `EMAIL_OAUTH_NAO_CONFIGURADO` com os NOMES das variáveis). Teste de ponta a ponta pelas rotas com o logger de produção capturado: nenhum código, token ou segredo do cliente no log nem nas respostas.

## Task Commits

1. **Tasks 1, 2 e 3 (implementação e o teste do traçador):** `881a7a7` feat(17-12): entrar com a Microsoft: autorizar e concluir provam a caixa por XOAUTH2 e gravam o token de renovacao
2. **Task 2 (testes) e a cobertura do `state`:** `1cdfa04` test(17-12): a renovacao do token da Microsoft e o state sao provados contra o login falso
3. **Task 3 (testes de rota):** `fdcb94b` test(17-12): as rotas do login recusam state alheio, outra conta e servico sem configuracao sem vazar token

**Tracer feedback gate:** modo interativo, `human_verify_mode` `end-of-phase` e `<verify>` só automatizado: o teste do traçador (`oauth.test.ts`) foi re-executado verde, junto com `tsc`, antes de escrever as Tasks 2 e 3.

## Decisions Made

Ver `key-decisions`. D-17-04 segue como no plano (decisão `[auto]`: a URI de retorno fica cadastrada no painel da Microsoft); A9, A11 e A12 seguem não travados e só se confirmam com o app real.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Segurança] `state` de uso único**
- **Found during:** Task 1 (exigência de segurança da execução: o `state` é de uso único)
- **Issue:** o plano descreve o `state` como assinado e com validade, mas sem uso único; sem tabela, um segundo `concluir` com o mesmo `state` ainda passaria da conferência.
- **Fix:** `conexao.ts` guarda os nonces usados num `Map` até vencerem e recusa o segundo uso com a mesma `ESTADO_INVALIDO`. É consumido DEPOIS de conferir Membro e Espaço (um `state` alheio não queima o de quem pediu) e ANTES de trocar o código. Provado por dois testes.
- **Limite honesto:** vale por processo. Entre processos o que impede o replay é o código de autorização, de uso único no serviço, o PKCE (que amarra o código a este servidor) e o fato de o Canal já conectado não mudar de novo.
- **Files modified:** `conexao.ts`, `oauth.test.ts`
- **Commit:** 881a7a7

**2. [Rule 2 - Segurança] Renovações do mesmo Canal serializadas**
- **Found during:** Task 2
- **Issue:** o leitor e o envio pedem o acesso ao mesmo tempo; duas renovações simultâneas girariam o refresh token duas vezes e a segunda gravação esbarraria em `credenciais_ativa_unica`.
- **Fix:** `credencial.ts` junta as renovações em curso por Canal numa promessa só. O refresh token novo é gravado na mesma transação que revoga o antigo.
- **Files modified:** `credencial.ts`, `credencial.test.ts`, `token.test.ts`
- **Commit:** 881a7a7, 1cdfa04

**3. [Rule 1 - Ajuste] `ErroDeRenovacao` ganhou a `frase` de produto**
- **Found during:** Task 2 (o plano mandava conferir de onde vem o `motivo`)
- **Issue:** `credencial.ts` devolvia sempre a frase fixa genérica na recusa permanente; a frase da Microsoft não chegava a `motivo_da_queda`.
- **Fix:** `new ErroDeRenovacao(permanente, frase?)`: a `message` continua fixa; a porta usa `erro.frase ?? FRASE_AUTORIZACAO_RECUSADA` como `motivo`. Os testes anteriores seguem verdes.
- **Commit:** 881a7a7

### Ajustes de execução (não são desvios de escopo)

- **`renovadoresDoAmbiente` sem parâmetro padrão.** O plano mostra `configuracao = lerConfiguracaoDoOauth()`; com valor padrão, um `undefined` explícito (ambiente sem login) releria `process.env`. Ficou `configuracao?: ConfiguracaoDoOauth`, e `undefined` significa "nenhum renovador".
- **`autorizar` do Google responde 503** `EMAIL_OAUTH_NAO_CONFIGURADO` ("O login com o Google ainda não está disponível neste servidor.") até o 17-13 trazer o cliente em `CLIENTES_DE_PRODUCAO`; a rota já aceita `google`.
- **Um commit de implementação para as três tarefas:** `conexao.ts`, `credencial.ts` e as rotas atravessam as Tasks 1 a 3 e não se separam sem commits quebrados; os testes das Tasks 2 e 3 vieram em commits próprios depois. Não há commit RED isolado (código e teste do traçador nasceram juntos).
- **Arquivo novo fora da lista do plano:** `apps/api/src/testes/login-oauth-falso.ts` (`idTokenDeTeste`, `camposDoPedido`), usado por quatro arquivos de teste.
- **Porta do Postgres de teste:** o plano diz `55739`; por regra do projeto usei o container próprio `crm-n1-pg-1712` na porta `55755`, migrado com `npm run --silent migrar`, removido no fim. Os comandos `<automated>` foram rodados por partes (container, `migrar`, `vitest`, `tsc`), na ordem do plano, não o `&&` inteiro numa linha.
- **O teste de `acessoDoEmailDoAmbiente` com Microsoft troca o `fetch` global** por um dublê (`vi.stubGlobal`): nenhum pedido sai da máquina; o dublê só registra que o endereço terminou em `/oauth2/v2.0/token`.

## Auth gates

Nenhum.

## Issues Encountered

- A falha pré-existente de `whatsapp-cloud.test.ts` ("sem a integração configurada, 503 dizendo o que falta", em `deferred-items.md`) não foi tocada nem rodada: nenhuma das suítes abaixo a inclui.
- O `eslint` não tem configuração em `apps/api`; não foi aplicado.

## Known Stubs

Nenhum. (O Google ainda sem cliente é lacuna declarada do 17-13, com resposta 503 explícita, não um stub que finja funcionar.)

## Threat Flags

Nenhuma superfície nova além do `<threat_model>`. T-17-51 (CSRF e link pronto) por `state` HMAC com Membro, Espaço, Canal e serviço, `timingSafeEqual` e `concluir` só com a sessão (testes de `state` alheio, vencido, adulterado, de outro serviço e já usado); T-17-52 pelo PKCE S256 e a URI vinda só da variável do servidor; T-17-53 pela prova XOAUTH2 com `user` = endereço do Canal (o `id_token` só pré-confere); T-17-54 por mensagens fixas em `ErroDoLogin` e `ErroDeRenovacao` e pelo teste com o log capturado; T-17-55 por a URI não vir do corpo; T-17-56 aceita (a Microsoft não revoga o antigo; o cofre fica com o mais novo); T-17-SC sem pacote novo.

## Verificação

Todos contra um Postgres 16 local descartável (`crm-n1-pg-1712`, porta 55755), servidor de login falso e dublês de IMAP e SMTP; nenhum deploy, nenhum projeto Supabase, nenhuma chamada a host da Microsoft.

- Task 1 (traçador): `oauth.test.ts` e `tsc --noEmit`: passam (22 testes).
- Task 2: `token.test.ts`, `oauth/microsoft.test.ts`, `credencial.test.ts`: passam.
- Task 3: `oauth.test.ts`, `estado.test.ts`, `rotas/crm/email.test.ts`, `seguranca/inventario-de-rotas.test.ts`: passam; o teste "autorizar e concluir de ponta a ponta" (sem token no log nem nas respostas) está entre os passados e as rotas novas entraram no inventário sem edição dele.
- `npx vitest run src/mensageria/provedores/email src/rotas/crm/email.test.ts src/seguranca/inventario-de-rotas.test.ts`: 18 arquivos, 351 testes, todos passam.
- Regressão dos Canais: `src/servicos/crm/canais*`, `src/rotas/crm/canais*`, `src/mensageria/provedores/instagram`, `src/mensageria/provedores/evolution`, `src/mensageria/aplicar-conexao.test.ts`, `src/mensageria/coleta-de-orfaos.test.ts`, `src/persistencia/migracao-017.test.ts`: 19 arquivos, 372 testes, todos passam.
- `npx tsc --noEmit` (`apps/api`): sai com 0.
- Aceites: `IMAP.AccessAsUser.All` 1, `offline_access` 3, `code_challenge_method` 1, `timingSafeEqual` em `estado.ts` 3, `A12` 2, `export function renovadoresDoAmbiente` 1, `renovadoresDoAmbiente` em `credencial.ts` 3, `invalid_grant` 1, `/canais/email/oauth/concluir` 2, `/canais/:id/email/oauth/:servico/autorizar` 2, `CONTA_DIFERENTE` 2, `ESTADO_INVALIDO` 1, `CONSENTIMENTO_DO_ADMINISTRADOR` 2.
- Não rodado: o `npm test` completo da api (13 a 17 min), por instrução; `whatsapp-cloud.test.ts` (falha conhecida); nenhuma prova contra a Microsoft real.

## Para os próximos planos

- 17-13 (Google): acrescenta o cliente em `CLIENTES_DE_PRODUCAO` (`token.ts`) e o `ServicoDeLogin` `google` já passa por `autorizar`, `concluir`, `estado.ts` e `renovadoresDoAmbiente`; o `revogar` do Google entra no cliente (`ClienteOauthDoEmail.revogar?`), e o desconectar o chama.
- 17-14 e 17-15 (web): a página de retorno lê `code` e `state` da URI cadastrada em `EMAIL_OAUTH_REDIRECT_URI` e chama `POST /canais/email/oauth/concluir`; as frases de recusa vêm prontas no `error`, com `codigo` (`ESTADO_INVALIDO`, `CONTA_DIFERENTE`, `CONSENTIMENTO_DO_ADMINISTRADOR`, `LOGIN_RECUSADO`, `SERVICO_DE_LOGIN_FORA`, `EMAIL_OAUTH_NAO_CONFIGURADO`).
- Prova real (9.4.4): conferir A12 (autoridade `common`), A9 (sem revogação), A11 (XOAUTH2 com `user` = o endereço do Canal quando o UPN difere do endereço principal; a pré-conferência do `id_token` hoje recusa por endereço diferente) e o corpo exato do erro de consentimento do administrador.

## Self-Check: PASSED

- Arquivos: `estado.ts`, `estado.test.ts`, `oauth/comum.ts`, `oauth/microsoft.ts`, `oauth/microsoft.test.ts`, `token.ts`, `token.test.ts`, `oauth.test.ts` e `testes/login-oauth-falso.ts` existem.
- Commits `881a7a7`, `1cdfa04` e `fdcb94b` são ancestrais de HEAD; `commits: 3` medido do ledger (`9cec707..HEAD`).
