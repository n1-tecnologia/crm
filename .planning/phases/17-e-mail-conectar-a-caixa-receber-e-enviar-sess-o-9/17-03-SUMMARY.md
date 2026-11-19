---
phase: 17-e-mail-conectar-a-caixa-receber-e-enviar-sess-o-9
plan: 03
subsystem: mensageria
tags: [email, imap, smtp, ssrf, guarda-de-rede, tls, starttls, imapflow, nodemailer, tdd]

requires:
  - phase: 17-e-mail-conectar-a-caixa-receber-e-enviar-sess-o-9
    provides: "17-02: imapflow, nodemailer e os dublês de IMAP e SMTP por TLS; 17-04: AutenticacaoDoEmail (credencial.ts)"
provides:
  - "rede.ts: ServicoDeEmail, PORTAS_DO_EMAIL, TabelaDePortas, Resolvedor, PoliticaDeRede, POLITICA_DE_PRODUCAO, criarPoliticaDeRede, DestinoConferido, conferirDestino, RecusaDeRede"
  - "fabrica-de-conexao.ts: UsoDaConexao, TemposDeConexao, TEMPOS_PADRAO, FabricaDeConexao, criarFabricaDeConexao (abrirImap, abrirSmtp, verificarImap, verificarSmtp)"
  - "erros.ts: FalhaDeConexao, FRASES_DE_CONEXAO, classificarErroDeConexao (com `segredos` opcional)"
affects: [17-05, 17-08, 17-09, 17-10, 17-12, 17-13]

actuals:
  tokens: 14000
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Política de rede e tabela de portas são VALORES injetados na fábrica; a produção usa POLITICA_DE_PRODUCAO e PORTAS_DO_EMAIL, e nada lê o ambiente"
    - "Conecta-se ao IP já conferido (host = IP) e o nome digitado vai só ao servername do TLS: uma resolução por abertura"
    - "Erro de conexão classificado em frases fixas; o texto do servidor só existe em recusou_login, filtrado"
    - "Teste de 'servidor sem STARTTLS' monta o próprio servidor (SMTPServer com STARTTLS desligado, node:net que só saúda): os dublês de 17-02 falam só TLS direto"

key-files:
  created:
    - apps/api/src/mensageria/provedores/email/rede.ts
    - apps/api/src/mensageria/provedores/email/rede.test.ts
    - apps/api/src/mensageria/provedores/email/fabrica-de-conexao.ts
    - apps/api/src/mensageria/provedores/email/fabrica-de-conexao.test.ts
    - apps/api/src/mensageria/provedores/email/erros.ts
    - apps/api/src/mensageria/provedores/email/erros.test.ts
  modified:
    - apps/api/src/testes/servidor-de-email-falso.ts
    - apps/api/src/testes/CONTEXT.md

key-decisions:
  - "Host com `/`, `?`, `#` ou `@` é recusado ANTES do domainToASCII (que lê o host como URL e cortaria `a/b` em `a`); rótulos LDH estritos"
  - "Nome cujo último rótulo é só número ou hexadecimal (`127.1`, `0x7f.1`, `2130706433`) é host inválido: o getaddrinfo o leria como IPv4"
  - "Faixas extras além do A2: ::/96 (IPv4 compatível), 64:ff9b:1::/48, 2001::/32 (Teredo) e 2001:db8::/32; sempre para recusar mais"
  - "O erro do nodemailer vem como ESOCKET com `originalCode`: a classificação olha originalCode e code, e o certificado vence o resto"
  - "ETLS do nodemailer com 'upgrading connection with STARTTLS' (servidor sem STARTTLS no 587) é protocolo, não certificado"
  - "classificarErroDeConexao ganhou um terceiro argumento opcional `segredos`, tirado da frase do servidor (o contrato do plano tem dois; o terceiro é compatível)"
  - "sem_endereco da guarda vira nao_conectou (não permanente); host_invalido, porta e rede_interna viram rede_recusada (permanente)"

patterns-established:
  - "Nenhum arquivo desta pasta lê o ambiente do processo nem desliga a verificação do certificado; a CA extra só entra por `opcoes.ca`"

requirements-completed: [EML-06, EML-01]

duration: 40min
completed: 2026-11-19
status: complete
plan_head_before: 32d731ae193c4211567fbf222247310271fccc72
plan_head_after: a1d78d776cf85ed9db47dc303af0b61267cde7b7
commits: 5

coverage:
  - id: D1
    description: "A fábrica abre IMAP e SMTP de verdade no IP conferido: verificarImap devolve uidNext, uidValidity em texto e a pasta \\Sent; verificarSmtp resolve; o dublê vê a conexão de 127.0.0.1 com o SNI do nome original (imap.caixa.teste, smtp.caixa.teste)"
    requirement: EML-01
    verification:
      - kind: integration
        ref: "apps/api/src/mensageria/provedores/email/fabrica-de-conexao.test.ts#a fábrica de conexão: o traçador"
        status: pass
    human_judgment: false
  - id: D2
    description: "O resolvedor é chamado uma única vez por abertura e as bibliotecas recebem o IP literal no host (rebinding)"
    requirement: EML-06
    verification:
      - kind: integration
        ref: "apps/api/src/mensageria/provedores/email/fabrica-de-conexao.test.ts#o resolvedor é chamado UMA vez por abertura"
        status: pass
      - kind: unit
        ref: "apps/api/src/mensageria/provedores/email/rede.test.ts#rebinding"
        status: pass
    human_judgment: false
  - id: D3
    description: "A guarda de produção recusa loopback, rede privada, link-local e metadados, CGNAT, multicast, IPv4 mapeado, NAT64 e 6to4, o host que mistura IP público e privado, e o IP literal privado sem consultar DNS"
    requirement: EML-06
    verification:
      - kind: unit
        ref: "apps/api/src/mensageria/provedores/email/rede.test.ts#recusa o endereço"
        status: pass
    human_judgment: false
  - id: D4
    description: "Só as portas IMAP 993/143 e SMTP 465/587 passam, cada uma com a sua segurança (143 e 587 em STARTTLS); outras portas são recusadas antes de resolver o host; host inválido e sem endereço têm motivo próprio"
    requirement: EML-06
    verification:
      - kind: unit
        ref: "apps/api/src/mensageria/provedores/email/rede.test.ts#as portas"
        status: pass
    human_judgment: false
  - id: D5
    description: "Sem a CA do dublê o certificado é recusado (IMAP e SMTP): a verificação não tem botão"
    requirement: EML-06
    verification:
      - kind: integration
        ref: "apps/api/src/mensageria/provedores/email/erros.test.ts#certificado"
        status: pass
      - kind: integration
        ref: "apps/api/src/mensageria/provedores/email/fabrica-de-conexao.test.ts#sem a CA do dublê o certificado não é aceito"
        status: pass
    human_judgment: false
  - id: D6
    description: "143 e 587 num servidor sem STARTTLS são recusados como protocolo, e o IMAP nem chega a enviar LOGIN ou a senha em texto puro"
    requirement: EML-06
    verification:
      - kind: integration
        ref: "apps/api/src/mensageria/provedores/email/erros.test.ts#protocolo"
        status: pass
    human_judgment: false
  - id: D7
    description: "A senha errada vira a frase fixa 'O servidor IMAP/SMTP recusou o usuário ou a senha.' com o texto do servidor à parte; certificado, tempo, porta fechada e rede recusada têm frase fixa sem host, porta, IP nem texto do sistema; nenhuma falha serializada contém a senha"
    requirement: EML-01
    verification:
      - kind: integration
        ref: "apps/api/src/mensageria/provedores/email/erros.test.ts#login recusado"
        status: pass
      - kind: integration
        ref: "apps/api/src/mensageria/provedores/email/erros.test.ts#tempo e conexão"
        status: pass
    human_judgment: false
  - id: D8
    description: "O filtro da frase do servidor tira o desafio XOAUTH2 (user=, auth=Bearer), tokens longos e os segredos informados, corta em 300 caracteres e em uma linha"
    requirement: EML-06
    verification:
      - kind: unit
        ref: "apps/api/src/mensageria/provedores/email/erros.test.ts#o filtro tira o desafio XOAUTH2"
        status: pass
    human_judgment: false
---

# Phase 17 Plan 03: O núcleo de rede do e-mail Summary

**A guarda que decide para onde o `apps/api` pode abrir conexão de e-mail (quatro portas, resolução única, recusa a qualquer faixa interna), a fábrica que entrega ao `imapflow` e ao `nodemailer` o IP já conferido com o nome original no certificado, e a classificação do erro em frases de produto que não servem de sonda nem vazam a senha.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-11-19
- **Tasks:** 3 (1 tracer, 2 auto; todas TDD)
- **Files:** 6 criados, 2 alterados (o dublê de 17-02 e o `CONTEXT.md` dos testes)

## Accomplishments

- **Traçador (Task 1):** `criarFabricaDeConexao` sempre chama `conferirDestino` e lança `RecusaDeRede` se recusar; monta o `ImapFlow` e o transporte do `nodemailer` com `host` = IP conferido e `servername` = o nome digitado, TLS 1.2 ou mais, verificação do certificado sempre ligada, `logger: false` nas duas (e `debug: false`, `disableFileAccess`, `disableUrlAccess` no `nodemailer`), 143 com `doSTARTTLS: true` e 587 com `requireTLS: true`. Contra os dublês de 17-02: `verificarImap` devolve `uidNext`, `uidValidity` em texto e `\Sent`; `verificarSmtp` resolve; o dublê registra `127.0.0.1` com SNI `imap.caixa.teste`/`smtp.caixa.teste`; o resolvedor é chamado uma vez por abertura.
- **Guarda de produção (Task 2):** `rede.ts` com `BlockList` (IPv4: 14 faixas + `168.63.129.16`; IPv6: 13 faixas), IPv4 mapeado casando a regra IPv4, e recusa se QUALQUER endereço devolvido é proibido. 43 testes sem rede: 22 endereços recusados, mistura público e privado, IP literal sem consulta, host inválido (13 formas), portas (IMAP 25, 110, 8080, 465; SMTP 993, 25...), segurança por porta, IDN e rebinding.
- **Erros (Task 3):** `classificarErroDeConexao(erro, servico, segredos?)` devolve `{ tipo, servico, frase, fraseDoServidor?, permanente }`. Só `recusou_login` repete o texto do servidor, filtrado (uma linha, até 300 caracteres, sem `user=`/`auth=Bearer`, sem sequências de 32 caracteres ou mais de base64, sem os segredos dados). Provado contra o `imapflow` e o `nodemailer` de verdade: senha errada, sem CA, nome que não confere com o certificado, servidor mudo (300 ms), porta fechada, 587 e 143 sem STARTTLS.

## Task Commits

1. **Task 1: Traçador** (TDD): RED `7d2ea88` (test, verificado falhando por módulo ausente), GREEN `a36ce99` (feat)
2. **Task 2: Guarda de produção** (TDD): `2205b97` (test + ajustes de `rede.ts`)
3. **Task 3: Erros** (TDD): `a1d78d7` (feat + test)
4. **Deviation (Rule 3):** `62ec54a` fix(17-02) no `fechar()` do dublê

**Plan metadata:** commit `docs(17-03)` seguinte a este arquivo.

**Tracer feedback gate:** modo interativo, `human_verify_mode` `end-of-phase` e `<verify>` só automatizado: o `<verify>` do traçador foi re-executado verde (5 testes, `tsc` 0) antes da expansão.

## Decisions Made

Ver `key-decisions` no cabeçalho. As de maior efeito para os planos seguintes: a fábrica não lê o ambiente (política, portas, CA e tempos entram por `opcoes`); `abrirImap` devolve o cliente já conectado, com um ouvinte vazio de `error` (sem ele um erro de socket derruba o processo), e quem o recebe deve fechá-lo; `abrirSmtp` devolve o transporte sem abrir socket (a conexão nasce no primeiro envio) e quem o recebe deve chamar `close()`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] `fechar()` do dublê de e-mail derrubava o Node com SIGSEGV**
- **Found during:** Task 3 (teste "sem a CA" no SMTP)
- **Issue:** `ServidorDeEmailFalso.fechar()` (17-02) destruía o socket cru de um handshake TLS que o cliente acabara de recusar por certificado inválido; no Node 24.14 isso mata o processo do worker (`SIGSEGV`), derrubando o arquivo de teste inteiro. Reproduzido isoladamente (`smtp-server` com `secure: true`, `nodemailer` sem a CA, `destroy()` imediato do socket cru; com 200 ms de espera ou sem `destroy()` não ocorre).
- **Fix:** `fechar()` espera 50 ms e só destrói o que ainda não está destruído. Estável em 5 execuções seguidas do arquivo, junto com os 15 testes do próprio dublê.
- **Files modified:** `apps/api/src/testes/servidor-de-email-falso.ts`, `apps/api/src/testes/CONTEXT.md` (aviso para quem usar o dublê)
- **Commit:** `62ec54a`

**2. [Rule 1 - Bug] `domainToASCII` cortava o host como URL (`a/b` virava `a`)**
- **Found during:** Task 2 (teste do host `a/b`)
- **Fix:** o texto é conferido antes (só `[a-z0-9.-]` ou IDN) e os rótulos são LDH estritos; nomes com último rótulo numérico ou `0x…` são recusados (IPv4 disfarçado).
- **Files modified:** `rede.ts` · **Commit:** `2205b97`

**3. [Rule 1 - Bug] O erro de TLS do `nodemailer` chega como `ESOCKET`, não como o código do Node**
- **Found during:** Task 3
- **Fix:** a classificação olha `originalCode` além de `code`, com o certificado antes de tudo; `ETLS` de STARTTLS recusado vira protocolo.
- **Files modified:** `erros.ts` · **Commit:** `a1d78d7`

### Observações (não são desvios)

- O traçador da Task 1 e o `rede.ts` da Task 2 saíram juntos no commit GREEN do traçador, porque o plano pôs `rede.ts` na Task 1; a Task 2 só os endureceu e acrescentou a bateria. A Task 3 não teve commit RED separado (teste e implementação nasceram juntos); só o traçador tem RED isolado e verificado.
- `classificarErroDeConexao` ganhou o 3º argumento opcional `segredos`; é compatível com a assinatura do plano.

## Issues Encountered

- O `npx tsc --noEmit` do plano passa limpo. O linter do repositório (`eslint`) não tem configuração em `apps/api`, então não foi aplicado aos arquivos novos.
- O 17-04 já registrou em `deferred-items.md` a falha pré-existente de `whatsapp-cloud.test.ts` ("sem a integração configurada, 503..."): não é deste plano e não foi tocada.

## Known Stubs

Nenhum.

## Threat Flags

Nenhum: o plano só fecha superfície (T-17-06 a T-17-10 mitigados; T-17-SC sem pacote novo). Observação para o dono: a lista de faixas é a D-17-07 mais o pressuposto A2, ainda sem confirmação (afrouxar é trocar `REDES_IPV4`/`REDES_IPV6` em `rede.ts`).

## Verificação

- `cd apps/api && DATABASE_URL= DATABASE_URL_MIGRACAO= npx vitest run src/mensageria/provedores/email/erros.test.ts src/mensageria/provedores/email/rede.test.ts src/mensageria/provedores/email/fabrica-de-conexao.test.ts`: 62 passam (14 + 43 + 5), rodado 5 vezes seguidas, estável.
- `cd apps/api && DATABASE_URL= DATABASE_URL_MIGRACAO= npx vitest run src/mensageria/provedores/email/ src/testes/servidor-de-email-falso.test.ts`: 87 passam, 9 pulam (os testes de banco de 17-04, sem `DATABASE_URL`).
- `cd apps/api && npx tsc --noEmit`: sai com 0.
- Aceites: `conferirDestino` na fábrica = 3; `rejectUnauthorized: false` = 0; `disableUrlAccess: true` = 1; `logger: false` = 2; o ambiente do processo não é lido em `rede.ts` nem na fábrica (0 e 0); `169.254.0.0` = 2, `fc00::` = 2, `BlockList` = 5, `rede_interna` no teste = 6; as duas frases de senha recusada e `fraseDoServidor` presentes em `erros.ts`.
- Nenhuma rede externa: resolvedores falsos, IPs literais e `127.0.0.1`; nenhum DNS real; nenhum Postgres usado.
- Não rodado: o `npm test` completo da api (13 a 17 min, exige Postgres), por instrução; os testes de banco de 17-04.

## Self-Check: PASSED

- Arquivos: `rede.ts`, `rede.test.ts`, `fabrica-de-conexao.ts`, `fabrica-de-conexao.test.ts`, `erros.ts`, `erros.test.ts` existem.
- Commits `7d2ea88`, `a36ce99`, `2205b97`, `62ec54a` e `a1d78d7` são ancestrais de HEAD.
