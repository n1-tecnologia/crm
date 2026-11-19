---
phase: 17-e-mail-conectar-a-caixa-receber-e-enviar-sess-o-9
plan: 02
subsystem: testes
tags: [email, imap, smtp, imapflow, nodemailer, imapkit, smtp-server, tls, vitest, tdd]

requires:
  - phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia
    provides: criarServidorFalso (o molde de dublê com servidor de verdade, nunca mock)
provides:
  - "dependências do e-mail em apps/api, versões exatas: imapflow, nodemailer, mailparser, sanitize-html (dependencies); @types/sanitize-html, imapkit, smtp-server (devDependencies)"
  - "certificado-de-teste.ts: gerarCertificadoDeTeste (par efêmero, SAN localhost/imap.caixa.teste/smtp.caixa.teste/127.0.0.1, cacheado por processo)"
  - "servidor-de-email-falso.ts: iniciarServidorDeEmailFalso (IMAP + SMTP em 127.0.0.1, porta efêmera, TLS de teste, XOAUTH2, IDLE, \\Sent, UIDVALIDITY trocável, falhas de SMTP programáveis)"
affects: [17-03, 17-05, 17-08, 17-09, 17-10, 17-12, 17-13]

actuals:
  tokens: 7000
  tasks: 3
  commits: 5

tech-stack:
  added: [imapflow@2.12.1, nodemailer@10.6.0, mailparser@3.14.5, sanitize-html@2.18.2, "@types/sanitize-html@2.16.2", imapkit@5.3.2, smtp-server@3.21.6]
  patterns:
    - "Dublê de e-mail é servidor de verdade (TLS, porta efêmera), nunca mock do cliente; a CA de teste só chega ao cliente por injeção"
    - "Certificado gerado na hora do teste pelo openssl, no diretório temporário, nunca commitado"

key-files:
  created:
    - apps/api/src/testes/certificado-de-teste.ts
    - apps/api/src/testes/servidor-de-email-falso.ts
    - apps/api/src/testes/servidor-de-email-falso.test.ts
  modified:
    - apps/api/package.json
    - package-lock.json
    - apps/api/src/testes/CONTEXT.md

key-decisions:
  - "O imapkit serviu como dublê do IMAP (pressuposto A1 confirmado): sem fallback à mão"
  - "Os três @types proibidos ficam de fora: imapflow, nodemailer, mailparser, smtp-server e imapkit trazem os próprios tipos"
  - "O imapkit tem uma árvore de caixas só por servidor: vários usuarios autenticam, mas veem as mesmas pastas (o argumento usuario das APIs de controle não separa nada)"
  - "checkAccessToken do imapkit é sobrescrito na instância para aceitar a lista de tokens do usuário, não só um"
  - "Uma regra de programarSmtp vale para a próxima transação MAIL FROM (recusarAuth: o próximo login) e some"

patterns-established:
  - "A pasta de enviados do dublê se chama Enviados de propósito: o código sob teste tem de achá-la por SPECIAL-USE (\\Sent)"

requirements-completed: []

duration: 25min
completed: 2026-11-19
status: complete
plan_head_before: 783719ee27b9666667a57a0bab752390756f82dc
plan_head_after: 73beeea78c714970fab70d38aa521281c55886a0
commits: 5

coverage:
  - id: D1
    description: "O imapflow entra no IMAP falso por TLS com a CA de teste (SNI registrado), abre a INBOX com uidNext e uidValidity; sem a CA o connect rejeita por certificado"
    requirement: EML-01
    verification:
      - kind: unit
        ref: "apps/api/src/testes/servidor-de-email-falso.test.ts#IMAP falso"
        status: pass
    human_judgment: false
  - id: D2
    description: "Senha errada e token XOAUTH2 errado são recusados (authenticationFailed); XOAUTH2 certo entra"
    requirement: EML-01
    verification:
      - kind: unit
        ref: "apps/api/src/testes/servidor-de-email-falso.test.ts#IMAP falso"
        status: pass
    human_judgment: false
  - id: D3
    description: "IDLE avisa mensagem nova em menos de 2 s, o MIME inserido volta no fetch; recriarCaixa troca o uidValidity; a pasta \\Sent é achada por SPECIAL-USE e guarda o append"
    requirement: EML-03
    verification:
      - kind: unit
        ref: "apps/api/src/testes/servidor-de-email-falso.test.ts#IMAP falso"
        status: pass
    human_judgment: false
  - id: D4
    description: "O SMTP falso guarda envelope (to e cc) e o DATA cru; XOAUTH2 certo entra e o errado dá EAUTH; recusarAuth recusa o login"
    requirement: EML-05
    verification:
      - kind: unit
        ref: "apps/api/src/testes/servidor-de-email-falso.test.ts#SMTP falso"
        status: pass
    human_judgment: false
  - id: D5
    description: "recusarRcpt 550 (command RCPT TO), recusarData 451 e mudoNoData (sem responseCode, DATA registrado) reproduzem as falhas de envio; a regra some depois do primeiro uso"
    requirement: EML-06
    verification:
      - kind: unit
        ref: "apps/api/src/testes/servidor-de-email-falso.test.ts#SMTP falso"
        status: pass
    human_judgment: false
  - id: D6
    description: "O certificado de teste vale para os nomes e o IP usados e nunca é commitado (nenhum .pem/.key/.crt rastreado)"
    verification:
      - kind: unit
        ref: "apps/api/src/testes/servidor-de-email-falso.test.ts#certificado de teste"
        status: pass
      - kind: other
        ref: "git ls-files -- 'apps/api/src/testes/*.pem' '*.key' '*.crt' (vazio)"
        status: pass
    human_judgment: false
---

# Phase 17 Plan 02: Pacotes do e-mail e dublês de IMAP e SMTP Summary

**Sete pacotes de e-mail em versão exata, aprovados pelo dono, e um IMAP (`imapkit`) e um SMTP (`smtp-server`) falsos por TLS com certificado gerado na hora, onde o `imapflow` e o `nodemailer` de verdade entram, leem, esperam por IDLE e enviam, inclusive nas falhas.**

## Portão de legitimidade dos pacotes

Task 1 (`checkpoint:human-verify`, `gate="blocking-human"`) **respondida pelo dono em 2026-11-19, com o sinal literal `aprovado`**: as sete versões do plano, sem versão mais velha pedida e sem pacote recusado. O orquestrador conferiu antes, só por leitura (`npm view`): licenças MIT / MIT-0, nenhum script `preinstall`/`install`/`postinstall`, nenhum deprecated, repositórios os esperados, versões publicadas entre 2026-09-28 e 2026-11-16. Nenhum `package.json` nem `package-lock.json` mudou antes da resposta; o executor não parou nem perguntou de novo.

| Pacote | Versão | Onde |
|---|---|---|
| `imapflow` | 2.12.1 | dependencies |
| `nodemailer` | 10.6.0 | dependencies |
| `mailparser` | 3.14.5 | dependencies |
| `sanitize-html` | 2.18.2 | dependencies |
| `@types/sanitize-html` | 2.16.2 | devDependencies |
| `imapkit` | 5.3.2 | devDependencies |
| `smtp-server` | 3.21.6 | devDependencies |

Instalados com `--save-exact` (nenhum `^` nem `~`). `@types/nodemailer`, `@types/mailparser` e `@types/smtp-server` não entraram (os pacotes trazem os próprios tipos). A instalação acrescentou 51 pacotes ao `package-lock.json` (42 das dependências e 9 das de desenvolvimento), nenhum com `hasInstallScript`. A única licença composta é a de `@zone-eu/mailsplit` 5.4.31 (`MIT OR EUPL-1.1+`, dependência do `mailparser`), da qual se adota a MIT. A árvore transitiva fica para a auditoria de licenças do CI (T-17-SC). O `npm audit` aponta vulnerabilidades, mas nenhuma é de pacote novo (são `next`, `vite`, `zod`, `fastify` e outros já existentes). Os avisos `EBADENGINE` vêm de `jsdom`, também anterior.

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-11-19
- **Tasks:** 3 (1 checkpoint já respondido, 1 tracer e 1 auto, as duas TDD)
- **Files modified:** 6 (3 criados, 3 alterados)

## Accomplishments

- **Spike do imapkit (A1) confirmado:** o `imapkit` 5.3.2, como módulo, dá TLS direto na porta principal (`secureConnection` + `credentials`), AUTHENTICATE XOAUTH2 que o `imapflow` aceita, IDLE com aviso de mensagem nova, inserção por API de controle (`addMessage`), troca de UIDVALIDITY (`resetUidValidity`) e SPECIAL-USE. Não foi preciso o dublê escrito à mão, e o `imapkit` ficou no `package.json`.
- **Traçador:** o `imapflow` conecta por TLS com a CA de teste injetada (SNI `imap.caixa.teste` registrado), abre a INBOX com `uidNext` numérico e `uidValidity` em `bigint`, recusa senha e token errados com `authenticationFailed`, recebe o `exists` em menos de 2 s em IDLE, lista `\Sent` por SPECIAL-USE e rejeita o certificado quando a CA não é injetada.
- **SMTP:** o `smtp-server` guarda envelope e `DATA` cru de cada envio, aceita PLAIN, LOGIN e XOAUTH2 pela mesma lista de usuários do IMAP e se programa para recusar `RCPT` (550, `command: "RCPT TO"`), recusar o `DATA` (451), ficar mudo depois do `DATA` (o `nodemailer` rejeita por `socketTimeout` sem `responseCode`, e a entrega fica registrada) e recusar o login. Cada regra vale uma vez.
- **Certificado:** gerado por `openssl` no diretório temporário e apagado em seguida, só em memória, cacheado por processo; nada commitado (T-17-04) e nenhum desvio de TLS no código de produção (T-17-05).
- **Documentação:** seção "Dublês de e-mail (Fase 17, 17-02)" em `apps/api/src/testes/CONTEXT.md`, com o resultado do spike e o limite da caixa única.

## Task Commits

1. **Task 1: Portão de legitimidade** — respondida pelo dono (sem commit)
2. **Task 2: Traçador do IMAP falso** (TDD)
   - `79dd94c` chore: dependências com versões exatas (`apps/api/package.json`, `package-lock.json`)
   - RED `4c732f1` (test), GREEN `b8148ad` (feat)
3. **Task 3: SMTP falso e documentação** (TDD)
   - RED `90d7140` (test), GREEN `73beeea` (feat)

Nenhum REFACTOR. **Plan metadata:** commit `docs(17-02)` seguinte a este arquivo.

## Files Created/Modified

- `apps/api/src/testes/certificado-de-teste.ts` - `gerarCertificadoDeTeste` (openssl, SAN, cache por processo)
- `apps/api/src/testes/servidor-de-email-falso.ts` - `iniciarServidorDeEmailFalso`, `ServidorDeEmailFalso`, `EntregaSmtp`, `RegraSmtp`, `PASTA_DE_ENVIADOS_FALSA`
- `apps/api/src/testes/servidor-de-email-falso.test.ts` - 15 testes (1 certificado, 7 IMAP, 7 SMTP)
- `apps/api/src/testes/CONTEXT.md` - seção dos dublês de e-mail
- `apps/api/package.json`, `package-lock.json` - as sete dependências

## Decisions Made

- O dublê é um arquivo só para IMAP e SMTP, com uma função de início que devolve os dois, como o plano decidiu.
- Os tokens XOAUTH2 do IMAP são uma lista por usuário: a `checkAccessToken` do `imapkit` (um token por usuário) é sobrescrita na instância, para um teste poder simular o token novo depois de um refresh.
- A regra programada de SMTP é amarrada à transação (`MAIL FROM`), não ao `RCPT`: assim `recusarRcpt` recusa todos os destinatários do envio (com um só recusado, o `nodemailer` entregaria aos demais).
- `recusarData` não guarda a entrega (o servidor de verdade não guarda o que recusa); `mudoNoData` guarda (o servidor recebeu e não respondeu).

## Deviations from Plan

None - plan executed exactly as written. (A seção `Self-Check` e o limite da caixa única abaixo são observações, não desvios.)

## Observação para os planos seguintes

**A caixa de IMAP é uma só por servidor.** Quem precisar de duas caixas separadas (por exemplo dois Canais de e-mail com mensagens diferentes) tem de subir dois servidores com `iniciarServidorDeEmailFalso`. O argumento `usuario` de `adicionarMensagem`, `recriarCaixa` e `mensagensDaPasta` existe pelo contrato do plano, mas não separa nada. `recriarCaixa` mantém as mensagens e as renumera de 1 a n (o `UIDVALIDITY` novo é o que importa), e as sessões abertas recebem `BYE`.

## Known Stubs

Nenhum.

## Threat Flags

Nenhum (só código de teste e dependências; os T-17-04, T-17-05 e T-17-SC do plano estão mitigados).

## Verificação

- `cd apps/api && DATABASE_URL= DATABASE_URL_MIGRACAO= npx vitest run src/testes/servidor-de-email-falso.test.ts`: 15 passam (rodado 4 vezes, estável, 2 s cada).
- `cd apps/api && npx tsc --noEmit`: sai com 0.
- Aceites do plano: `imapflow` e `nodemailer` em versão exata (1 e 1); `@types/(nodemailer|mailparser|smtp-server)` = 0; `git ls-files` de `.pem/.key/.crt` em `testes/` vazio; `logger: false` no teste (1); `programarSmtp` (2), `mudoNoData` (3) e "Dublês de e-mail" (1) presentes.
- `git diff --stat` do plano: só `package.json`, `package-lock.json` e os arquivos de `apps/api/src/testes/`.
- Não rodado: o `npm test` completo da api (13 a 17 min, exige Postgres); este plano não toca código de produção nem banco.

## Self-Check: PASSED

- Arquivos: `certificado-de-teste.ts`, `servidor-de-email-falso.ts`, `servidor-de-email-falso.test.ts` e a seção do `CONTEXT.md` existem.
- Commits `79dd94c`, `4c732f1`, `b8148ad`, `90d7140` e `73beeea` são ancestrais de HEAD.
