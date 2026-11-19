---
phase: 17-e-mail-conectar-a-caixa-receber-e-enviar-sess-o-9
plan: 05
subsystem: mensageria
tags: [email, conexao, imap, smtp, senha-de-app, predefinicoes, queda, esquecimento, rotas, tdd]

requires:
  - phase: 17-e-mail-conectar-a-caixa-receber-e-enviar-sess-o-9
    provides: "17-03: criarFabricaDeConexao (verificarImap, verificarSmtp), RecusaDeRede, classificarErroDeConexao; 17-04: guardarCredencialDoEmail, gravarConta, contaDoCanal, gravarCursor, marcarQueda, limparQueda, esquecerContaDoEmail"
provides:
  - "configuracao.ts: PREDEFINICOES_DE_SERVIDOR (gmail, outlook), ConfiguracaoDoOauth, lerConfiguracaoDoOauth, servicosDisponiveis, servicosDaConfiguracao, variaveisQueFaltam"
  - "conexao.ts: criarServicoDeConexaoDoEmail (conectarPorSenha, conta), EntradaDeSenha, ContaParaAFichaDoEmail, ServicoDeConexaoDoEmail, DependenciasDoEmail"
  - "queda.ts: registrarQuedaDoEmail(pool, alvo, motivo) -> { mudou }"
  - "rotas/crm/email.ts: POST /canais/:id/email/conectar e GET /canais/:id/email/conta; opcao de teste crm.email"
  - "servicos/crm/canais.ts: desconectar e arquivar o Canal de e-mail apagam conta, cursor e credencial na mesma transacao"
affects: [17-07, 17-08, 17-10, 17-12, 17-13, 17-14, 17-16]

actuals:
  tokens: 26900
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Conectar = verificar fora da transacao (IMAP primeiro, SMTP so se o IMAP passou), depois gravar tudo numa transacao com a linha do Espaco antes da do Canal"
    - "O cofre e checado ANTES da rede: sem COFRE_CHAVE nao se abre conexao a toa"
    - "Predefinicao e um NOME: o host e a porta vem da tabela do servidor, e o corpo nao os troca"
    - "A recusa de conexao e 422 CONEXAO_RECUSADA com campo imap ou smtp e a frase fixa de classificarErroDeConexao"
    - "A queda do e-mail vai a desconectada (D-17-20), nao a com_erro como o Instagram; conta e credencial ficam para reconectar"

key-files:
  created:
    - apps/api/src/mensageria/provedores/email/configuracao.ts
    - apps/api/src/mensageria/provedores/email/conexao.ts
    - apps/api/src/mensageria/provedores/email/conexao.test.ts
    - apps/api/src/mensageria/provedores/email/queda.ts
    - apps/api/src/mensageria/provedores/email/queda.test.ts
    - apps/api/src/rotas/crm/email.ts
    - apps/api/src/rotas/crm/email.test.ts
    - apps/api/src/servicos/crm/canais-email.test.ts
  modified:
    - apps/api/src/rotas/crm/index.ts
    - apps/api/src/servicos/crm/canais.ts

key-decisions:
  - "A recusa de conexao e 422 CONEXAO_RECUSADA com campo imap ou smtp; so quando a conexao chegou a autenticar a frase ganha 'O servidor respondeu: <fraseDoServidor>' (filtrada em erros.ts)"
  - "O IMAP e testado primeiro; se ele falha o SMTP nem e tentado"
  - "O corpo do conectar aceita predefinicao OU imap e smtp juntos; a lista de portas permitidas e so da guarda de rede (PORTAS_DO_EMAIL), a rota so confere 1 a 65535"
  - "A senha nao e aparada (pode comecar ou terminar com espaco); o usuario e"
  - "GET conta devolve so endereco, tipoDeLogin, servidores, conectadaEm, motivoDaQueda e caiuEm: sem usuario, sem contaExternaId, sem conectadaPor"
  - "Limite de tentativas proprio da rota segue adiado (CONTEXT, Deferred); T-17-22 aceita"

patterns-established:
  - "Nada de configuracao.ts, conexao.ts e queda.ts chama registro, console nem serializa a senha"

requirements-completed: [EML-01, EML-06, EML-07]

duration: 25min
completed: 2026-11-19
status: complete
plan_head_before: 6067b385cd20b384696a1f81d33f047a168ca231
plan_head_after: fe7cb207141485bae5b5308746d05c7d66f1c002
commits: 2

coverage:
  - id: D1
    description: "POST /canais/:id/email/conectar com a senha certa abre IMAP e SMTP pela fabrica e grava, numa transacao, a credencial v: 1 no cofre, a conta (tipo senha, pasta \\Sent), o cursor da INBOX no UIDNEXT daquele momento e o Canal conectada nao simulado; as mensagens antigas ficam para tras"
    requirement: EML-01
    verification:
      - kind: integration
        ref: "apps/api/src/mensageria/provedores/email/conexao.test.ts#o traçador: a senha certa deixa o Canal conectado"
        status: pass
    human_judgment: false
  - id: D2
    description: "A Mensagem pendente do Canal ganha a linha mensagem.enviar.v1 no mesmo commit da conexao (B69), e o aviso canal.mudou e a revisao do Espaco acompanham"
    requirement: EML-01
    verification:
      - kind: integration
        ref: "apps/api/src/mensageria/provedores/email/conexao.test.ts#a Mensagem pendente do Canal antes de conectar ganha a linha mensagem.enviar.v1"
        status: pass
    human_judgment: false
  - id: D3
    description: "Senha errada no IMAP: 422 com a frase fixa e campo imap, nada gravado (cofre, conta, cursor, Canal) e o SMTP nem foi tentado; IMAP certo e SMTP recusado: 422 com campo smtp e nada gravado"
    requirement: EML-01
    verification:
      - kind: integration
        ref: "apps/api/src/mensageria/provedores/email/conexao.test.ts#o que recusa não grava nada"
        status: pass
    human_judgment: false
  - id: D4
    description: "Host que a producao resolve para 10.0.0.5 e porta 25 sao recusados antes de qualquer conexao (os dubles nao registram nenhuma) com a frase de rede sem host nem IP; predefinicao gmail e outlook passam so o host da tabela do servidor, mesmo com host do cliente no corpo"
    requirement: EML-06
    verification:
      - kind: integration
        ref: "apps/api/src/mensageria/provedores/email/conexao.test.ts#o que recusa não grava nada"
        status: pass
      - kind: integration
        ref: "apps/api/src/mensageria/provedores/email/conexao.test.ts#as predefinições são do servidor"
        status: pass
    human_judgment: false
  - id: D5
    description: "Canal de WhatsApp responde 409 PROVEDOR_ERRADO, Canal de outro Espaco 404, Membro sem permissao de conectar 403, sem COFRE_CHAVE 503, e nenhuma dessas abre conexao"
    requirement: EML-01
    verification:
      - kind: integration
        ref: "apps/api/src/mensageria/provedores/email/conexao.test.ts"
        status: pass
    human_judgment: false
  - id: D6
    description: "A senha nao aparece no log de producao capturado da requisicao nem em nenhuma resposta (com a senha certa, a errada e a ficha), nem na mensagem de erro"
    requirement: EML-01
    verification:
      - kind: integration
        ref: "apps/api/src/rotas/crm/email.test.ts#a senha não aparece no log nem na resposta, com a senha certa e com a errada"
        status: pass
    human_judgment: false
  - id: D7
    description: "A rota exige a sessao e valida o corpo (.strict, predefinicao OU os dois servidores, portas de 1 a 65535, senha sem trim); GET conta devolve a conta sem segredo e servicosDisponiveis (Microsoft so com o par de variaveis e a URI)"
    requirement: EML-01
    verification:
      - kind: integration
        ref: "apps/api/src/rotas/crm/email.test.ts"
        status: pass
    human_judgment: false
  - id: D8
    description: "Desconectar e arquivar o Canal de e-mail apagam conta, cursor e credencial do cofre na mesma transacao; a de outro Canal e o segredo do webhook ficam; arquivar um Canal que ja tinha caido tambem esquece"
    requirement: EML-07
    verification:
      - kind: integration
        ref: "apps/api/src/servicos/crm/canais-email.test.ts"
        status: pass
    human_judgment: false
  - id: D9
    description: "registrarQuedaDoEmail leva conectada a desconectada com motivo e instante, avanca a revisao do Espaco e avisa canal.mudou; conta e credencial ficam; repetir, Canal simulado, arquivado, ja desconectado, de outro Espaco ou inexistente nao muda nada; reconectar com a senha nova limpa o motivo"
    requirement: EML-07
    verification:
      - kind: integration
        ref: "apps/api/src/mensageria/provedores/email/queda.test.ts"
        status: pass
    human_judgment: false
---

# Phase 17 Plan 05: Conectar a caixa por senha Summary

**`POST /canais/:id/email/conectar` abre IMAP e SMTP pela fábrica guardada e só então grava credencial, conta, cursor da INBOX no `UIDNEXT` e o Canal `conectada`; senha errada, SMTP recusado, servidor interno e porta 25 são recusados sem gravar nada, desconectar e arquivar esquecem a caixa, e a queda deixa o Canal `desconectada` com o motivo.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-11-19
- **Tasks:** 3 (1 tracer, 2 auto; todas TDD)
- **Files:** 8 criados, 2 alterados

## Accomplishments

- **Traçador (Task 1):** `conectarPorSenha` confere a permissão (`exigir(conectar, canal)`), o provedor (`PROVEDOR_ERRADO`) e a transição do domínio, escolhe os servidores (predefinição do servidor ou os digitados), checa o cofre, abre IMAP e depois SMTP FORA da transação e grava tudo numa só (linha do Espaço antes da do Canal): credencial `v: 1`, conta, `limparQueda`, cursor `INBOX` no `uidNext`, `definirConexao`, revisão do Espaço, `canal.mudou` e `reenfileirarPendentesDoCanal`. A rota é fina, com corpo `.strict()`; registrada em `rotas/crm/index.ts` com a opção `crm.email` para teste.
- **Recusas e ficha (Task 2):** a falha vira 422 `CONEXAO_RECUSADA` com `campo: "imap" | "smtp"` e a frase de `classificarErroDeConexao` (o texto do servidor só depois de autenticar). Provado contra os dublês de 17-02: senha errada, `recusarAuth` no SMTP, host que o resolvedor de produção manda para `10.0.0.5` e porta 25 (os dublês não registram conexão), Canal de WhatsApp, outro Espaço, Membro sem permissão, sem cofre. `GET .../conta` devolve só os campos da ficha e os botões de login disponíveis. Um teste liga o logger de produção (`opcoesDoLogger`) num vetor e prova que a senha não está no log nem em nenhuma resposta.
- **Esquecimento e queda (Task 3):** `esquecerContaDoEmail` entra em `mudarConexao` (desconectar) e em `arquivar`, na mesma transação. `registrarQuedaDoEmail` copia a ordem de travas de `marcarComErro` do Instagram, mas grava `desconectada` (D-17-20), o motivo e o instante, avança a revisão e avisa; conta e credencial ficam.

## Task Commits

1. **Tasks 1 e 2 (traçador e recusas):** `7f49f54` feat(17-05): conectar a caixa de e-mail por senha e ler a conta pela api
2. **Task 3 (esquecimento e queda):** `fe7cb20` feat(17-05): desconectar e arquivar esquecem a caixa; a queda passa o Canal a desconectada

**Tracer feedback gate:** modo interativo, `human_verify_mode` `end-of-phase` e `<verify>` só automatizado: o `<verify>` do traçador (3 testes no Postgres local, `tsc` 0) foi re-executado verde antes da expansão.

## Decisions Made

Ver `key-decisions`. Ficam como o plano as decisões `[auto]` D-17-07 (a guarda) e D-17-20 (queda para `desconectada`); o dono ainda não as confirmou.

## Deviations from Plan

### Auto-fixed Issues

Nenhum bug do plano nem de código existente precisou de correção (Rules 1 a 3 não foram acionadas).

### Ajustes de execução (não são desvios de escopo)

- **Porta do Postgres de teste:** o plano diz `55732`; por regra do projeto usei o container próprio `crm-n1-pg-1705` na porta `55745`, migrado com `npm run --silent migrar`, e o removi no fim. Os comandos `<automated>` foram rodados por partes (container, `migrar`, `vitest`, `tsc`), com as mesmas etapas e a ordem do plano, não o `&&` inteiro numa linha.
- **O cofre é checado antes da rede,** não depois como o Instagram: sem `COFRE_CHAVE` a conexão responde 503 sem abrir IMAP nem SMTP (o teste prova `conexoesImap()` vazio). O plano só dizia que a falta do cofre dá 503.
- **Tasks 1 e 2 num só commit:** `conexao.ts`, `email.ts` e os dois arquivos de teste atravessam as duas tarefas e não se separam sem commits quebrados; o traçador foi verificado verde antes de os testes da Task 2 serem escritos, mas os dois saíram em `7f49f54`. Não há commit RED isolado (testes e código nasceram juntos, no mesmo commit, como em 17-03 e 17-04); os testes da Task 2 passaram de primeira porque o `conectarPorSenha` do traçador já nasceu com as recusas.
- **`conta` não devolve `usuario`:** o plano diz "sem campo `senha`, `usuario` nem token"; `ContaParaAFichaDoEmail` leva só `endereco`, `tipoDeLogin`, `imap`, `smtp`, `conectadaEm`, `motivoDaQueda` e `caiuEm` (um teste fixa a lista de chaves).
- **Teste de canal arquivado:** `canais_arquivamento_ck` (008) exige `arquivado_em` junto com `estado = 'arquivado'`; o teste de `queda.test.ts` grava os dois. Erro do teste, não do código.

## Auth gates

Nenhum.

## Issues Encountered

- `apps/api/src/mensageria/provedores/whatsapp-cloud/whatsapp-cloud.test.ts` > "sem a integração configurada, 503 dizendo o que falta" segue falhando: é a pré-existente já registrada em `deferred-items.md` (17-04). Não é deste plano e não foi tocada. É a única falha das suítes rodadas.
- O `eslint` não tem configuração em `apps/api`; não foi aplicado.

## Known Stubs

Nenhum.

## Threat Flags

Nenhuma superfície nova além do `<threat_model>`: T-17-19 (senha em log, resposta e erro) provado por teste de log de produção e de respostas; T-17-20 (IDOR) por `exigir` e Canal lido por `(workspace_id, id)` da sessão, com teste de outro Espaço (404) e de outro provedor (409); T-17-21 (sonda de rede) pela fábrica, com host privado e porta 25 sem conexão registrada; T-17-23 pelos tempos `teste` da fábrica e a rede fora da transação; T-17-24 por `esquecerContaDoEmail` na mesma transação. T-17-22 (força bruta pela rota) aceita, como no plano; T-17-SC sem pacote novo.

## Verificação

Todos contra um Postgres 16 local descartável (`crm-n1-pg-1705`, porta 55745, removido no fim), com `DATABASE_URL` e `DATABASE_URL_MIGRACAO` apontados a ele; nenhum deploy, nenhum projeto Supabase, nenhum servidor de e-mail real.

- Traçador: `npx vitest run src/mensageria/provedores/email/conexao.test.ts` (3 testes) e `tsc --noEmit` sobre `apps/api`: passam.
- Task 2: `conexao.test.ts` (13), `rotas/crm/email.test.ts` (22), `seguranca/inventario-de-rotas.test.ts`: passam; o teste "a senha não aparece no log nem na resposta" está entre os passados e as rotas novas entraram no inventário sem edição dele.
- Task 3: `queda.test.ts` e `servicos/crm/canais-email.test.ts` (12) e `canais.test.ts`: passam.
- Regressão dos Canais (compartilham `canais.ts` e as rotas): `src/mensageria/provedores/email`, `src/servicos/crm/canais*` (`canais.test.ts`, `canais-conectar.test.ts`, `canais-aviso.test.ts`, `canais-email.test.ts`), `src/rotas/crm/canais*`, `src/rotas/crm/email.test.ts`, `src/seguranca/inventario-de-rotas.test.ts`, `src/mensageria/provedores/instagram`, `src/mensageria/provedores/evolution`, `src/mensageria/aplicar-conexao.test.ts`: 26 arquivos, 491 testes, todos passam.
- Mais amplo: `src/rotas/crm`, `src/mensageria/provedores/whatsapp-cloud` e `src/seguranca`: 34 de 35 arquivos passam; a única falha é a pré-existente do WhatsApp oficial (acima).
- `npx tsc --noEmit` (`apps/api`): sai com 0.
- Aceites: `/canais/:id/email/conectar` em `email.ts` 2, `rotasDoEmail` em `index.ts` 2, `reenfileirarPendentesDoCanal` em `conexao.ts` 2, `imap.gmail.com` 1, `smtp.office365.com` 1, import de `pg` ou de `servicos` em `email.ts` 0, `CONEXAO_RECUSADA` 1, `/canais/:id/email/conta` 2, `servicosDisponiveis` em `conexao.ts` 3, `esquecerContaDoEmail` em `canais.ts` 3 (import, desconectar, arquivar), `marcarQueda` em `queda.ts` 2, `D-17-20` em `queda.ts` 2.
- Não rodado: o `npm test` completo da api (13 a 17 min), por instrução; nenhuma prova contra Gmail, Outlook ou servidor real.

## Para os próximos planos

- 17-12 e 17-13 (login Google e Microsoft) reaproveitam o núcleo: `lerConfiguracaoDoOauth` / `servicosDaConfiguracao` já dizem os botões, e a gravação é a mesma transação de `conectarPorSenha` (credencial `oauth`, `gravarConta` com `tipoDeLogin` do serviço, cursor, `definirConexao`, B69).
- 17-08, 17-10 e o envio chamam `registrarQuedaDoEmail(pool, { workspaceId, canalId }, motivo)` quando o servidor recusa o login e repetir não adianta; devolve `{ mudou }`.
- 17-14 e 17-16 (tela e CONTEXT): a ficha lê `GET /canais/:id/email/conta`; a recusa de conexão chega com `campo` `imap` ou `smtp`, e o motivo da queda em `motivoDaQueda`.

## Self-Check: PASSED

- Arquivos: `configuracao.ts`, `conexao.ts`, `conexao.test.ts`, `queda.ts`, `queda.test.ts`, `rotas/crm/email.ts`, `rotas/crm/email.test.ts` e `servicos/crm/canais-email.test.ts` existem.
- Commits `7f49f54` e `fe7cb20` são ancestrais de HEAD; `commits: 2` medido do ledger (`6067b38..HEAD`).
