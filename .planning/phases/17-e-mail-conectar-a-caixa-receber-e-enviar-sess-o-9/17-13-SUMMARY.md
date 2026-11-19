---
phase: 17-e-mail-conectar-a-caixa-receber-e-enviar-sess-o-9
plan: 13
subsystem: mensageria
tags: [email, oauth, google, xoauth2, pkce, refresh-token, revogacao, email_verified, tdd]

requires:
  - phase: 17-e-mail-conectar-a-caixa-receber-e-enviar-sess-o-9
    provides: "17-05: configuracao.ts (PREDEFINICOES_DE_SERVIDOR.gmail), o nucleo gravarEConectar e esquecerContaDoEmail em desconectar/arquivar; 17-12: estado.ts, oauth/comum.ts, oauth/microsoft.ts (molde), token.ts, autorizar/concluir e o servidor de login falso"
provides:
  - "oauth/google.ts: criarClienteGoogle (urlDeAutorizacao, trocarCodigo, renovar, revogar), ENDERECOS_DO_GOOGLE, ESCOPOS_GOOGLE, FRASE_GOOGLE_RENOVACAO_PERMANENTE"
  - "conexao.ts: o Google em autorizar e concluir (email_verified obrigatorio, googlemail = gmail, sub em conta_externa_id), ConectorDoEmail e criarConectorDoEmail"
  - "token.ts: o Google nas fabricas de producao e nos renovadores do ambiente"
  - "canais.ts: ConectoresDeCanal.email e a revogacao em desligarDoProvedor, antes da transacao"
affects: [17-14, 17-15, 17-16]

actuals:
  tokens: 15600
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Cliente OAuth por servico atras de ClienteOauthDoEmail: o Google entra sem tocar autorizar/concluir alem da regra de e-mail verificado"
    - "Conector opcional de revogacao no servico de Canais, no molde do whatsappNaoOficial: melhor esforco, a falha vira so uma contagem"

key-files:
  created:
    - apps/api/src/mensageria/provedores/email/oauth/google.ts
    - apps/api/src/mensageria/provedores/email/oauth/google.test.ts
  modified:
    - apps/api/src/mensageria/provedores/email/conexao.ts
    - apps/api/src/mensageria/provedores/email/oauth.test.ts
    - apps/api/src/mensageria/provedores/email/oauth/comum.ts
    - apps/api/src/mensageria/provedores/email/token.ts
    - apps/api/src/mensageria/provedores/email/token.test.ts
    - apps/api/src/servicos/crm/canais.ts
    - apps/api/src/servicos/crm/canais-email.test.ts
    - apps/api/src/rotas/crm/index.ts

key-decisions:
  - "Para o Google, a ausencia de email_verified conta como nao verificado (EML-02): so email_verified verdadeiro (booleano ou a palavra true) deixa o e-mail do id_token valer; o que o id_token nao traz fica por conta da prova XOAUTH2, como na Microsoft"
  - "So invalid_grant derruba a conexao do Google; invalid_client (segredo trocado no painel) e erro desconhecido ficam transitorios, porque entrar de novo nao os resolve"
  - "A comparacao googlemail.com = gmail.com mora em conexao.ts (so para o Google), sem mexer em packages/dominio"
  - "O conector de revogacao usa o par do Google do ambiente para montar o cliente; sem ele nao ha o que revogar (so a contagem sobe) e a conta e a credencial locais saem do mesmo jeito"
  - "A revogacao e o refresh token (o Google derruba os de acesso derivados); o Canal com credencial por senha ou da Microsoft nao pede nada a rede (A9)"

patterns-established:
  - "oauth/google.ts nao chama registro nem console: o erro de revogacao e uma frase fixa, e a causa (que pode carregar o token e a URL) nunca sai"

requirements-completed: [EML-02, EML-07]

duration: 12min
completed: 2026-11-19
status: complete
plan_head_before: fcb229c7204054b745174b02237fe473c7e332bb
plan_head_after: 609c52ecd3253726c04258881d777ed700653bba
commits: 3

coverage:
  - id: D1
    description: "autorizar(.., google) devolve a URL do login com escopo openid email https://mail.google.com/, access_type=offline, prompt=consent, login_hint = endereco do Canal, state e PKCE S256; o segredo do cliente nunca vai a URL"
    requirement: EML-02
    verification:
      - kind: integration
        ref: "apps/api/src/mensageria/provedores/email/oauth.test.ts#Google: autorizar devolve a URL do login com os escopos, access_type=offline, prompt=consent, login_hint, state e PKCE S256"
        status: pass
      - kind: unit
        ref: "apps/api/src/mensageria/provedores/email/oauth/google.test.ts#a URL do login leva offline, consent, state, PKCE S256, login_hint e a URI de retorno, e nunca o segredo do cliente"
        status: pass
    human_judgment: false
  - id: D2
    description: "concluir pelo Google com id_token verificado de pessoa@gmail.com num Canal pessoa@googlemail.com prova a caixa por XOAUTH2 (dubles de IMAP e SMTP no lugar de imap.gmail.com e smtp.gmail.com), grava credencial oauth google no cofre, tipo_de_login google, conta_externa_id = sub e Canal conectada"
    requirement: EML-02
    verification:
      - kind: integration
        ref: "apps/api/src/mensageria/provedores/email/oauth.test.ts#Google: concluir com e-mail verificado (googlemail x gmail) prova a caixa por XOAUTH2 e deixa o Canal conectado, com o sub como conta externa"
        status: pass
    human_judgment: false
  - id: D3
    description: "email_verified falso ou ausente e e-mail verificado de outra caixa respondem 409 CONTA_DIFERENTE sem abrir a caixa e sem gravar nada; o id_token verificado nao basta se a caixa recusa o token; state do Google com o segredo da Microsoft e recusado"
    requirement: EML-02
    verification:
      - kind: integration
        ref: "apps/api/src/mensageria/provedores/email/oauth.test.ts#o login do Google (17-13)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A renovacao do Google devolve so o token de acesso (o cofre fica com o mesmo refresh token) e, se vier um novo, o repassa; invalid_grant e recusa permanente com a frase de produto e leva o Canal a desconectada; 500, 503, 429, servidor mudo e erro desconhecido sao transitorios"
    requirement: EML-07
    verification:
      - kind: unit
        ref: "apps/api/src/mensageria/provedores/email/oauth/google.test.ts#renovar"
        status: pass
      - kind: integration
        ref: "apps/api/src/mensageria/provedores/email/token.test.ts#Google: renova sem girar o token (o cofre fica com o mesmo refreshToken) e a recusa invalid_grant vira queda com a frase do Google"
        status: pass
    human_judgment: false
  - id: D5
    description: "revogar manda um POST de formulario em /revoke so com o token; 400, 5xx e tempo esgotado rejeitam com frase fixa sem o token nem o segredo"
    requirement: EML-07
    verification:
      - kind: unit
        ref: "apps/api/src/mensageria/provedores/email/oauth/google.test.ts#revogar"
        status: pass
    human_judgment: false
  - id: D6
    description: "desconectar e arquivar um Canal conectado pelo Google revogam o refresh token ANTES da transacao (o Canal ainda esta conectada e a credencial ainda esta no cofre quando o conector e chamado) e depois esquecem a conta, o cursor e a credencial"
    requirement: EML-07
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/canais-email.test.ts#desconectar um Canal do Google pede a revogação do refresh token ANTES da transação e depois esquece a caixa"
        status: pass
      - kind: integration
        ref: "apps/api/src/servicos/crm/canais-email.test.ts#arquivar um Canal do Google pede a mesma revogação antes e esquece a caixa"
        status: pass
    human_judgment: false
  - id: D7
    description: "revogar que falha (Google recusa, servidor mudo, conector que lanca, par do Google ausente) nunca impede desconectar: o Canal desconecta e esquece do mesmo jeito, so a contagem sobe e o token nao aparece em resposta nenhuma; Canal por senha ou pela Microsoft nao faz pedido de rede"
    requirement: EML-07
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/canais-email.test.ts#revogar que falha não impede desconectar"
        status: pass
      - kind: integration
        ref: "apps/api/src/servicos/crm/canais-email.test.ts#Canal por senha ou pela Microsoft: nenhum pedido de revogação sai (o conector real não faz rede)"
        status: pass
    human_judgment: false
  - id: D8
    description: "Os pressupostos do Google (escopo restrito e modo de teste de 100 usuarios, refresh token de 7 dias, ausencia de rotacao, endpoint de revogacao, googlemail) ficam so como comentario de codigo a confirmar na prova real (9.4.4); nenhum vira texto de tela"
    requirement: EML-02
    verification:
      - kind: other
        ref: "grep '9.4.4' apps/api/src/mensageria/provedores/email/oauth/google.ts"
        status: pass
    human_judgment: true
---

# Phase 17 Plan 13: Entrar com o Google Summary

**O Google é o terceiro caminho de conexão do e-mail: `autorizar` e `concluir` reaproveitam o núcleo da Microsoft com `access_type=offline`, `prompt=consent` e PKCE, só aceitam `email_verified` verdadeiro e o endereço da caixa (`googlemail` = `gmail`), e continuam provando a caixa por XOAUTH2; a renovação não gira o token e `invalid_grant` (os 7 dias do modo de teste) vira queda avisada; desconectar e arquivar revogam o refresh token no Google antes da transação, sem nunca travar a desconexão.**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-11-19
- **Tasks:** 3 (1 traçador, 2 auto; todas TDD)
- **Files:** 2 criados, 8 alterados

## Accomplishments

- **Traçador (Task 1):** `oauth/google.ts` com a URL do login (`openid email https://mail.google.com/`, `access_type=offline`, `prompt=consent`, `login_hint`, `state`, PKCE S256), a troca do código (lê `email`, `email_verified` e `sub` do `id_token`) e `renovar`. `comum.ts` passou a ler `email_verified` (booleano ou a palavra `true`). `conexao.ts` recusa o Google com `email_verified` falso ou ausente (409 `CONTA_DIFERENTE`, sem abrir a caixa) e compara o endereço tratando `googlemail.com` como `gmail.com`; o `sub` vai a `conta_externa_id`. Servidores: `PREDEFINICOES_DE_SERVIDOR.gmail` por padrão e, nos testes, os dublês de IMAP e SMTP injetados. Provado de ponta a ponta contra o Postgres local, o login falso e os dublês de XOAUTH2.
- **Renovação (Task 2):** `renovar` devolve só `{ accessToken, expiraEm }` (o Google não roda o refresh token) e repassa um novo se vier; `invalid_grant` vira `ErroDeRenovacao` permanente com "A autorização do Google venceu ou foi retirada: entre de novo com o Google.", que a porta passa ao `registrarQuedaDoEmail` (Canal `desconectada`, provado no Postgres local); 500, 503, 429, tempo esgotado e erro desconhecido são transitórios. `token.ts` ganhou o Google em `CLIENTES_DE_PRODUCAO`, então `renovadoresDoAmbiente` o inclui quando o par está configurado.
- **Revogação (Task 3):** `criarConectorDoEmail({ pool, chaves?, clientes?, configuracaoDoOauth? })` lê a credencial do cofre e, só para `oauth` `google`, chama `revogar(refreshToken)` do cliente (tempo limite de 5 s); qualquer erro é engolido e conta em `falhasDeRevogacao()`. `desligarDoProvedor` chama `conectores.email.revogar` antes da transação para o Canal `email-imap-smtp` que pode desconectar ou arquivar, dentro de um `try` que nunca recusa. `rotas/crm/index.ts` monta o conector padrão junto do da Evolution. Senha e Microsoft não fazem pedido de rede.

## Task Commits

1. **Task 1 (traçador):** `3533e33` feat(17-13): entrar com o Google: autorizar e concluir provam a caixa por XOAUTH2 e exigem e-mail verificado
2. **Task 2 (testes da renovação e da queda):** `512212a` test(17-13): a renovacao do Google nao gira o token e invalid_grant (os 7 dias do modo de teste) vira queda avisada
3. **Task 3 (revogação):** `609c52e` feat(17-13): desconectar e arquivar um Canal do Google revogam o token antes de apagar a caixa

**Tracer feedback gate:** modo interativo, `human_verify_mode` `end-of-phase` e `<verify>` só automatizado: o teste do traçador (`oauth.test.ts`, 32 testes) e `tsc` foram re-executados verdes antes de escrever as Tasks 2 e 3.

## Decisions Made

Ver `key-decisions`. D-17-01 e D-17-02 seguem como no plano: o Google é o último caminho construído e, até o app passar pela verificação do Google, a prova real só vale em modo de teste (17-16), com a senha de app cobrindo o Gmail.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Bloqueio] `comum.ts` precisou ler `email_verified`**
- **Found during:** Task 1
- **Issue:** `lerIdToken` (17-12) só devolvia `email`, `sub`, `oid` e `tid`; sem `email_verified` o plano ("o `id_token` só vale com `email_verified` verdadeiro") não tinha como ser aplicado.
- **Fix:** `DadosDoIdToken.emailVerificado` e `ContaDoLogin.emailVerificado`, ambos opcionais, só preenchidos quando o `id_token` traz o campo; a Microsoft não os usa e segue igual.
- **Files modified:** `oauth/comum.ts` (não estava na lista do plano)
- **Commit:** 3533e33

**2. [Rule 1 - Teste obsoleto] Duas afirmações do 17-12 diziam que o Google ainda não tinha cliente**
- **Found during:** Tasks 1 e 2
- **Issue:** `oauth.test.ts` ("o Google ainda não tem cliente (17-13): autorizar responde 503") e `token.test.ts` ("o Google ainda não tem cliente: não há renovador") descreviam o estado do 17-12, que este plano justamente muda.
- **Fix:** o primeiro foi substituído pelos testes do Google; o segundo passou a afirmar que o Google tem renovador com o par configurado.
- **Files modified:** `oauth.test.ts`, `token.test.ts`
- **Commit:** 3533e33, 512212a

### Ajustes de execução (não são desvios de escopo)

- **`googlemail.com` no `conexao.ts`, não no domínio.** `contaDoProvedorConfere` (domínio) só põe o endereço em minúsculas; o `normalizarEmail` do domínio também não mapeia `googlemail`. A equivalência (só para o Google) ficou numa função local de `conexao.ts`, sem tocar `packages/dominio`.
- **A Task 2 e a Task 1 nasceram do mesmo arquivo.** `renovar` completo e `revogar` foram escritos junto de `google.ts` na Task 1 (um arquivo coerente só), e a Task 2 entrou como os testes (`google.test.ts`, o teste de queda em `token.test.ts`). Não há commit RED isolado; é o mesmo ajuste que o 17-12 já registrou.
- **`falhasDeRevogacao()`** na devolução de `criarConectorDoEmail`: a "contagem" que o plano pede sem dizer onde mora. O tipo `ConectorDoEmail` continua só com `revogar`, como no plano.
- **`revogarNoGoogle` sem par configurado.** A revogação do Google não usa o segredo do app, mas o conector monta o cliente como os outros; se o ambiente perdeu `GOOGLE_OAUTH_CLIENT_ID`/`SECRET`, nada é revogado (conta como falha). Limite aceito: o operador que configurou o Google em algum momento mantém as variáveis.
- **Porta do Postgres de teste:** o plano diz `55740`; por regra do projeto usei o container próprio `crm-n1-pg-1713` na porta `55759`, migrado com `npm run --silent migrar` (017 aplicada), removido no fim. Os `<automated>` foram rodados por partes (container, `migrar`, `vitest`, `tsc`), não o `&&` inteiro numa linha.
- **Uma leitura de Canal a mais ao desconectar/arquivar** quando só o conector do e-mail existe (antes `desligarDoProvedor` voltava cedo sem o conector da Evolution): em produção os dois existem, então nada muda lá; nos testes sem conectores nada muda.

## Auth gates

Nenhum.

## Issues Encountered

- A falha pré-existente de `whatsapp-cloud.test.ts` ("sem a integração configurada, 503 dizendo o que falta", em `deferred-items.md`) não foi tocada nem rodada: nenhuma das suítes abaixo a inclui.
- O `eslint` não tem configuração em `apps/api`; não foi aplicado.

## Known Stubs

Nenhum.

## Threat Flags

Nenhuma superfície nova além do `<threat_model>`. T-17-57 (e-mail não verificado) por `email_verified` obrigatório e XOAUTH2 com o endereço do Canal antes de gravar; T-17-58 (token vivo depois de desconectar) pela revogação antes da transação e pelo apagamento do cofre, com a falha só como contagem; T-17-59 (`googlemail` x `gmail`) pela comparação normalizada e pela prova XOAUTH2; T-17-60 (token em log ou erro) por frases fixas em `ErroDoLogin`, `ErroDeRenovacao` e no erro de revogação, e pelo teste de sigilo das respostas do Google (nenhum código, token ou segredo); T-17-SC sem pacote novo.

## Verificação

Todos contra um Postgres 16 local descartável (`crm-n1-pg-1713`, porta 55759), servidor de login falso e dublês de IMAP e SMTP; nenhum deploy, nenhum projeto Supabase, nenhuma chamada a host do Google.

- Task 1 (traçador): `oauth.test.ts` e `tsc --noEmit`: passam (32 testes).
- Task 2: `oauth/google.test.ts` (16 testes, sem banco, com `DATABASE_URL` vazio), `token.test.ts` e `oauth/` : passam.
- Task 3: `canais-email.test.ts`, `canais.test.ts`, `canais-conectar.test.ts`: 55 testes, todos passam; "revogar que falha não impede desconectar" está entre os passados.
- Regressão: `npx vitest run src/mensageria/provedores/email src/rotas/crm/email.test.ts src/seguranca/inventario-de-rotas.test.ts src/servicos/crm/canais src/rotas/crm/canais src/mensageria/provedores/instagram src/mensageria/provedores/evolution src/mensageria/aplicar-conexao.test.ts src/mensageria/coleta-de-orfaos.test.ts src/persistencia/migracao-017.test.ts`: 39 arquivos, 785 testes, todos passam.
- `npx tsc --noEmit` (`apps/api`): sai com 0.
- Aceites: `https://mail.google.com/` em `google.ts` 3, `prompt` e `access_type` presentes, `email_verified` em `conexao.ts` 1, a frase do Google em `google.ts` 1, `criarClienteGoogle` em `token.ts` 2, `conectores?.email` em `canais.ts` 1, `export function criarConectorDoEmail` 1, `criarConectorDoEmail` em `rotas/crm/index.ts` 2.
- Não rodado: o `npm test` completo da api (13 a 17 min), por instrução; `whatsapp-cloud.test.ts` (falha conhecida); nenhuma prova contra o Google real.

## Para os próximos planos

- 17-14 e 17-15 (web): o botão "Entrar com o Google" usa as mesmas duas rotas da Microsoft (`POST /canais/:id/email/oauth/google/autorizar` e `POST /canais/email/oauth/concluir`); a recusa de e-mail não confirmado vem pronta como `CONTA_DIFERENTE`.
- 17-16 (prova real, 9.4.4), pressupostos do Google só como comentário em `google.ts`: o escopo `https://mail.google.com/` é restrito (modo de teste, 100 usuários, refresh token de 7 dias, a avaliação CASA corre por fora); o XOAUTH2 com `user` = endereço do Canal em `imap.gmail.com`/`smtp.gmail.com` (inclusive com Canal `googlemail.com`); o `invalid_grant` com a queda na ficha; a revogação por `/revoke` do refresh token.

## Self-Check: PASSED

- Arquivos: `oauth/google.ts`, `oauth/google.test.ts`, `conexao.ts`, `oauth.test.ts`, `oauth/comum.ts`, `token.ts`, `token.test.ts`, `canais.ts`, `canais-email.test.ts` e `rotas/crm/index.ts` existem.
- Commits `3533e33`, `512212a` e `609c52e` são ancestrais de HEAD; `commits: 3` medido do ledger (`fcb229c..HEAD`).
