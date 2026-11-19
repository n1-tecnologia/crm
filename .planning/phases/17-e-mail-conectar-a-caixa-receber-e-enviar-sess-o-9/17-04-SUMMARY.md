---
phase: 17-e-mail-conectar-a-caixa-receber-e-enviar-sess-o-9
plan: 04
subsystem: persistencia
tags: [email, migracao-017, cofre, credencial, cursor-imap, coleta-de-orfaos, postgres, tdd]

requires:
  - phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia
    provides: webhooks_recebidos (013), a coleta de órfãos, o cofre (009) e o molde do Instagram (014)
provides:
  - "017-email.sql: plataforma.email_contas, plataforma.cursores_de_canal e plataforma.mensagens.corpo_html (a porta de mão única, não aplicada fora do Postgres de teste)"
  - "repositorio.ts: ContaDeEmail, CursorDaCaixa, gravarConta, contaDoCanal, contasParaLer, lerCursor, gravarCursor, marcarQueda, limparQueda, esquecerContaDoEmail"
  - "credencial.ts: TIPO_DA_CREDENCIAL, CredencialDoEmail v1, lerCredencialDoEmail, guardarCredencialDoEmail, AutenticacaoDoEmail, AcessoParaUsar, ErroDeRenovacao, RenovadorDeToken, AcessoDoEmail, criarAcessoDoEmail, acessoDoEmailDoAmbiente"
  - "coleta de órfãos que poupa objectKey de corpo_html e de linha pendente da fila (F6)"
affects: [17-05, 17-08, 17-09, 17-10, 17-12, 17-13, 17-14, 17-16]

actuals:
  tokens: 20700
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Credencial no cofre como JSON versionado (v: 1); um formato novo entra como v: 2 lido ao lado, sem migração"
    - "Porta AcessoDoEmail com renovadores injetados por serviço: leitor e envio nunca mudam quando o login Google/Microsoft chegar"
    - "Cursor IMAP com uidvalidity em texto (bigint no imapflow) e proximo_uid = UIDNEXT, gravado no cliente da transação de quem chama"

key-files:
  created:
    - apps/api/migracoes/017-email.sql
    - apps/api/src/persistencia/migracao-017.test.ts
    - apps/api/src/mensageria/provedores/email/repositorio.ts
    - apps/api/src/mensageria/provedores/email/repositorio.test.ts
    - apps/api/src/mensageria/provedores/email/credencial.ts
    - apps/api/src/mensageria/provedores/email/credencial.test.ts
    - .planning/phases/17-e-mail-conectar-a-caixa-receber-e-enviar-sess-o-9/deferred-items.md
  modified:
    - apps/api/src/mensageria/coleta-de-orfaos.ts
    - apps/api/src/mensageria/coleta-de-orfaos.test.ts
    - apps/api/src/mensageria/CONTEXT.md

key-decisions:
  - "D-17-05 (porta de mão única): opção duas-tabelas, escolhida pelo dono em 2026-11-19"
  - "A coleta considera em uso só linha de webhooks_recebidos em pendente ou processando; processado e falhou são finais e a Mensagem que geraram cita o objeto por conta própria"
  - "Falha ao gravar a credencial renovada (corrida em credenciais_ativa_unica ou cofre fora) não derruba o uso: devolve-se o accessToken que acabou de chegar, e a próxima chamada grava"
  - "email_contas ganhou email_contas_queda_ck: motivo_da_queda e caiu_em andam juntos (nulos ou preenchidos)"
  - "gravarConta de uma conta existente (reconectar) zera motivo_da_queda e caiu_em e renova conectada_em"

patterns-established:
  - "Nenhum arquivo de credencial.ts chama registro, console nem serializa segredo; as recusas são frases fixas e ErroDeRenovacao tem mensagem fixa"

requirements-completed: [EML-01, EML-02, EML-03]

duration: 40min
completed: 2026-11-19
status: complete
plan_head_before: 006eaf27ec174ae0a33903fe29ccb6923d7b8902
plan_head_after: 72bfcca5b7023aeb46f3aea3ab2d9900c566bb5b
commits: 2

coverage:
  - id: D1
    description: "A 017 aplicada num Postgres 16 limpo (migrar lista 017-email.sql); antes dela o --seco a mostra pendente, depois nada pendente; idempotente por duas execuções do texto"
    requirement: EML-01
    verification:
      - kind: integration
        ref: "apps/api/src/persistencia/migracao-017.test.ts#(c) e (d)"
        status: pass
      - kind: integration
        ref: "apps/api/src/persistencia/migrar-seco.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "email_contas recusa porta 0 e 70000, tipo de login 'outro', endereço vazio e queda pela metade; some com o Canal; cursores_de_canal tem a chave (Espaço, Canal, pasta), recusa proximo_uid 0 e uidvalidity não numérico, e some com a conta; corpo_html aceita nulo e { objectKey, tamanhoBytes } e recusa o que não tem objectKey"
    requirement: EML-01
    verification:
      - kind: integration
        ref: "apps/api/src/persistencia/migracao-017.test.ts#(a) e (b)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Nenhuma coluna das tabelas novas guarda segredo; a credencial fica só no cofre"
    requirement: EML-02
    verification:
      - kind: integration
        ref: "apps/api/src/persistencia/migracao-017.test.ts#(f)"
        status: pass
      - kind: integration
        ref: "apps/api/src/mensageria/provedores/email/credencial.test.ts#guardarCredencialDoEmail cifra no cofre"
        status: pass
    human_judgment: false
  - id: D4
    description: "O repositório faz upsert da conta, guarda uidValidity como texto (9007199254740993 volta igual), lê só Canal de e-mail ativo, conectado, real e com conta, marca e limpa a queda, e filtra por Espaço"
    requirement: EML-03
    verification:
      - kind: integration
        ref: "apps/api/src/mensageria/provedores/email/repositorio.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "esquecerContaDoEmail apaga conta, cursor e a credencial do e-mail do Canal (não só revoga), sem tocar na de outro Canal nem no segredo do webhook"
    requirement: EML-03
    verification:
      - kind: integration
        ref: "apps/api/src/mensageria/provedores/email/repositorio.test.ts#esquecerContaDoEmail apaga conta, cursor e a credencial"
        status: pass
    human_judgment: false
  - id: D6
    description: "lerCredencialDoEmail só aceita v: 1; a porta devolve a autenticação da senha, renova o OAuth só abaixo de 5 min gravando a credencial nova, e classifica o erro do renovador (permanente, transitório, sem renovador)"
    requirement: EML-02
    verification:
      - kind: unit
        ref: "apps/api/src/mensageria/provedores/email/credencial.test.ts#lerCredencialDoEmail e criarAcessoDoEmail"
        status: pass
      - kind: integration
        ref: "apps/api/src/mensageria/provedores/email/credencial.test.ts#a renovação grava no cofre"
        status: pass
    human_judgment: false
  - id: D7
    description: "Nenhum resultado, erro ou frase da porta carrega a senha, o refreshToken ou o accessToken"
    requirement: EML-02
    verification:
      - kind: unit
        ref: "apps/api/src/mensageria/provedores/email/credencial.test.ts#nenhum resultado carrega a senha nem o token"
        status: pass
    human_judgment: false
  - id: D8
    description: "A coleta de órfãos poupa o objeto de entrada/ citado em mensagens.corpo_html e em qualquer profundidade do corpo de linha pendente ou processando; só linha processada ou falhou, e a fila de outro Canal ou Espaço, não protegem"
    requirement: EML-03
    verification:
      - kind: integration
        ref: "apps/api/src/mensageria/coleta-de-orfaos.test.ts#F6"
        status: pass
    human_judgment: false
---

# Phase 17 Plan 04: O que o e-mail guarda Summary

**A migração 017 (conta de e-mail, cursor IMAP e `mensagens.corpo_html`), a credencial `v: 1` no cofre com uma porta de acesso que renova o OAuth sem vazar segredo, o repositório da conta e do cursor, e a coleta de órfãos que poupa o que o leitor subiu e a fila ainda não consumiu.**

## Decisão da porta de mão única (D-17-05)

Task 1 (`checkpoint:decision`, `gate="blocking-human"`) **respondida pelo dono em 2026-11-19, com o sinal literal `duas-tabelas`**, sem ajuste de nome de tabela nem de coluna. É a opção recomendada do plano: `plataforma.email_contas` + `plataforma.cursores_de_canal` + `plataforma.mensagens.corpo_html`, e a credencial no cofre (`tipo = 'email-imap-smtp'`, `dono_tipo = 'canal'`) como JSON versionado `v: 1`. As opções `tudo-na-conta` e `html-como-anexo` não foram implementadas. Antes da resposta nenhum arquivo de `apps/api/migracoes/` tinha mudado (a última era a 016); o executor não parou nem perguntou de novo.

A 017 **não foi aplicada em produção nem em projeto Supabase**: só no Postgres 16 descartável do plano (container `crm-n1-pg-1704`, porta 55731, removido no fim). Quem a aplica é o `apps/api/deploy/publicar.sh` do dono.

## O que foi feito

- **`017-email.sql`** (molde da 014, cabeçalho em pt-BR sem acento): `email_contas` (uma por Canal, FK composta com `canais` em cascata, checks de endereço, hosts, portas 1–65535, tipo de login e `append_enviados`, trigger `crm_toque_atualizado_em`), `cursores_de_canal` (PK `(workspace_id, canal_id, pasta)`, FK em cascata para a conta, `uidvalidity` em texto numérico, `proximo_uid >= 1`), `mensagens.corpo_html jsonb` com check `objectKey`, e o bloco de RLS da 014. Sem `grant`, sem coluna de segredo.
- **`repositorio.ts`**: todas as consultas filtram `workspace_id` (T-17-13); `gravarCursor` recebe o cliente de quem chama, para o leitor gravar o cursor na mesma transação do `insert` da fila (D-17-08).
- **`credencial.ts`**: `lerCredencialDoEmail` só aceita `v: 1` (senha ou OAuth google/microsoft, com `accessToken` e `expiraEm` juntos ou ausentes); `criarAcessoDoEmail` devolve a senha pronta, o `accessToken` guardado se vence em mais de 5 min, ou renova pelo renovador do serviço e grava a credencial nova numa transação própria (corrida em `credenciais_ativa_unica` desfaz e segue com o token recebido); sem renovador, `OAUTH_NAO_CONFIGURADO` transitório (17-12 e 17-13 os ligam em `acessoDoEmailDoAmbiente`).
- **`coleta-de-orfaos.ts`**: além de `anexos`, considera em uso `mensagens.corpo_html->>'objectKey'` e qualquer `objectKey` (`jsonb_path_query(corpo, 'lax $.**.objectKey')`) do corpo de `webhooks_recebidos` em `pendente` ou `processando` do mesmo Espaço e Canal. JSDoc e `apps/api/src/mensageria/CONTEXT.md` atualizados.

## TDD

Task 2: testes escritos primeiro e vistos falhar (arquivo da 017 e `repositorio.ts` removidos do caminho: "Cannot find module" / `readFileSync` ENOENT) antes de voltar o código. Task 3: o teste F6 da coleta foi visto falhar contra a coleta antiga (1 falha, 6 passam) antes de aplicar a nova. O `credencial.test.ts` não teve vermelho observado separado (o `credencial.ts` foi escrito antes dos testes). Cada task foi um commit só (teste e código juntos): sem commits separados de RED/GREEN.

## Verificação

- Task 2 (`<automated>`): container 55731 limpo, `npm run --silent migrar` imprime `aplicada  017-email.sql`; `migracao-017.test.ts`, `migrar-seco.test.ts` e `repositorio.test.ts` passam (17 testes). Rodei os comandos do plano por partes (o `docker run ... && ... && vitest` inteiro numa linha só não foi executado literalmente; as mesmas etapas, na mesma ordem e portas).
- Task 3 (`<automated>`): container limpo de novo, `migrar`, e `credencial.test.ts`, `coleta-de-orfaos.test.ts`, `repositorio.test.ts`, `migracao-017.test.ts`, `migrar-seco.test.ts`: 5 arquivos, 36 testes passam; o teste "nenhum resultado carrega a senha nem o token" está entre os passados.
- `npm run typecheck -w @n1/api` (`tsc --noEmit`): limpo.
- Regressão: `npx vitest run src/persistencia src/mensageria` no mesmo Postgres: 52 de 53 arquivos passam, 773 de 774 testes. A única falha é pré-existente e fora do plano (ver "Itens adiados"). Não rodei o `npm test` completo da api (13 a 17 min, o plano não pede).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug no critério] O grep de aceite "nenhuma linha que não seja comentário fala de senha ou token" acha 1 linha**
- **Found during:** Task 2
- **Issue:** `grep -vE '^\s*--' apps/api/migracoes/017-email.sql | grep -ciE 'senha|token'` devolve 1, não 0: a linha `check (tipo_de_login in ('senha', 'google', 'microsoft'))`. O próprio plano manda esse conjunto de valores para `tipo_de_login`, e as tarefas seguintes (17-05, 17-14) gravam e leem `tipoDeLogin: "senha"`. É o RÓTULO do jeito de entrar, não coluna de segredo.
- **Fix:** mantive o valor `'senha'` (renomear quebraria o contrato de 17-05 e 17-14). A intenção do critério (nenhuma coluna de senha ou token) está provada de outra forma: o teste `(f)` de `migracao-017.test.ts` lê `information_schema.columns` das tabelas novas e da coluna nova e exige que nenhuma tenha nome de segredo (`senha|token|segredo|secret|password|refresh|credencial`). Um verificador que rode o grep literal verá 1 linha e deve ler esta nota.
- **Files modified:** nenhum além do já previsto
- **Commit:** 810e218

**2. [Rule 2 - Correção] `email_contas_queda_ck`**
- **Found during:** Task 2
- **Issue:** `motivo_da_queda` e `caiu_em` são gravados juntos por `marcarQueda`; nada impedia uma linha com um sem o outro.
- **Fix:** check `(motivo_da_queda is null) = (caiu_em is null)`, coberto em `migracao-017.test.ts`.
- **Commit:** 810e218

**3. [Rule 2 - Documentação do contrato] `apps/api/src/mensageria/CONTEXT.md`**
- Fora da lista `files_modified`: a frase sobre a coleta ("nenhuma Mensagem do Canal cita") ficaria errada com a mudança; atualizada na mesma commit da coleta (72bfcca).

**Total:** 3 desvios, nenhum com impacto no escopo; nenhum precisou de decisão do dono.

## Auth gates

Nenhum.

## Itens adiados

- `apps/api/src/mensageria/provedores/whatsapp-cloud/whatsapp-cloud.test.ts` > "sem a integração configurada, 503 dizendo o que falta" falha no ambiente do executor: a mensagem devolvida não contém `META_APP_SECRET`. Arquivo da Sessão 7, não tocado por este plano, não investigado. Registrado em `deferred-items.md` da fase.

## Known Stubs

Nenhum.

## Threat Flags

Nenhuma superfície nova além das do `<threat_model>` do plano (cofre, coleta, Espaço, 017 fora do rito). T-17-11 (nenhuma coluna de segredo, `credencial.ts` sem log, teste de serialização), T-17-12 (coleta poupa fila pendente), T-17-13 (todo SQL filtra `workspace_id`) e T-17-14 (017 só no Postgres de teste) estão mitigados e provados.

## Para os próximos planos

- 17-05 usa `gravarConta` (sem `queda`; reconectar já zera a queda), `gravarCursor` em transação própria, `esquecerContaDoEmail` em desconectar e arquivar, `marcarQueda`/`limparQueda`.
- 17-08 grava o cursor com o cliente da transação do `insert` da fila (`gravarCursor(cliente, ws, canal, { pasta, uidValidity: string, proximoUid: number })`).
- 17-10 lê `contasParaLer(pool())`, que devolve `ContaDeEmail[]` atravessando os Espaços.
- `limparEspaco` (`testes/banco-crm.ts`) não precisou mudar: `email_contas` e `cursores_de_canal` saem pela cascata do Canal.

## Self-Check: PASSED

- Arquivos: `017-email.sql`, `migracao-017.test.ts`, `repositorio.ts`, `repositorio.test.ts`, `credencial.ts`, `credencial.test.ts`, `coleta-de-orfaos.ts`, `coleta-de-orfaos.test.ts` e `deferred-items.md` existem.
- Commits `810e218` (Task 2) e `72bfcca` (Task 3) são ancestrais de HEAD; `commits: 2` medido do ledger (`006eaf2..HEAD`).
- Acceptance: `create table if not exists plataforma.email_contas` e `...cursores_de_canal` 1 cada; `on delete cascade` 2; `esquecerContaDoEmail` no repositório 1; `TIPO_DA_CREDENCIAL = "email-imap-smtp"` 1; `export function acessoDoEmailDoAmbiente` 1; `corpo_html` e `webhooks_recebidos` na coleta; `console.|registrar(` em `credencial.ts` 0. Exceção declarada: o grep de `senha|token` sobre a 017 (Desvio 1).
