---
phase: 17-e-mail-conectar-a-caixa-receber-e-enviar-sess-o-9
plan: 10
subsystem: mensageria
tags: [email, imap, imapflow, idle, advisory-lock, leitor, fila-de-entrada, cursor, uidvalidity, vitest]

requires:
  - phase: 17-e-mail-conectar-a-caixa-receber-e-enviar-sess-o-9
    provides: "17-02 dublês de IMAP e SMTP; 17-03 fábrica de conexão e guarda de rede; 17-04 repositório (contasParaLer, lerCursor, gravarCursor) e porta de acesso à credencial; 17-05 registrarQuedaDoEmail; 17-08 prepararEmailRecebido e enfileirarEmailEAvancar; 17-09 provedor email-imap-smtp e a saída; 17-12 renovação do token OAuth"
provides:
  - "leitor.ts: criarLeitorDeEmail (supervisor com a trava por Canal numa conexão pg.Client dedicada, uma sessão IMAP em IDLE por Canal, conferência de reserva), deveIniciarOLeitorDeEmail, FRASE_DA_SENHA_RECUSADA_NA_LEITURA"
  - "index.ts: o leitor sobe por EMAIL_LEITOR_ATIVO, só junto com MENSAGERIA_WORKER_ATIVO, e para pelo aoEncerrar"
  - "e2e/email-entrada.test.ts: e-mail novo vira Conversa; a troca de três e-mails fica numa Conversa só"
  - "testes/bancada-de-email.ts: a montagem comum dos testes do leitor"
affects: [17-13, 17-14, 17-15, 17-16]

tech-stack:
  added: []
  patterns:
    - "A trava consultiva de um recurso por processo mora numa conexão pg.Client dedicada, fora do pool, com hashtextextended (64 bits); se a conexão cai, todas as sessões param na hora e o supervisor refaz as travas"
    - "Sinal: esperas que se registram e se tiram sozinhas, em vez de .then repetido numa promessa que nunca resolve"
    - "A sessão IMAP é recriada (nova ImapFlow) a cada reconexão, e a fábrica reaplica a guarda de rede em toda abertura"

key-files:
  created:
    - apps/api/src/mensageria/provedores/email/leitor.ts
    - apps/api/src/mensageria/provedores/email/leitor.test.ts
    - apps/api/src/e2e/email-entrada.test.ts
    - apps/api/src/testes/bancada-de-email.ts
  modified:
    - apps/api/src/index.ts
    - apps/api/src/mensageria/provedores/email/fabrica-de-conexao.ts
    - apps/api/src/mensageria/provedores/email/traduzir.ts
    - apps/api/src/testes/servidor-de-email-falso.ts
    - apps/api/src/testes/servidor-de-email-falso.test.ts
    - apps/api/src/testes/CONTEXT.md

key-decisions:
  - "A trava por Canal usa pg_try_advisory_lock(hashtextextended(texto, 0)), 64 bits, e não o hashtext de 32 bits do plano: dois Canais nunca colidem e um deles deixaria de ser lido sem aviso"
  - "A sessão que dura 2 min zera a espera de reconexão (5 s, dobra até 5 min); senha recusada (recusou_login) e acesso permanente derrubam o Canal e param a sessão, qualquer outra falha só reconecta com espera crescente e não muda o Canal"
  - "O anexo transitório segura o cursor até 3 passadas (espera de 10 s entre elas) antes de o e-mail entrar com baixado: false; o tradutor que lança 3 vezes seguidas deixa o e-mail entrar como ignorado:ilegivel para não prender a caixa"
  - "O processador de entrada é acordado pelo leitor (aoEnfileirar = acordadores.entrada) no mesmo processo; sem MENSAGERIA_WORKER_ATIVO o leitor não liga e o index.ts avisa o motivo"

patterns-established:
  - "O leitor lista as contas de TODOS os Espaços: o teste que divide o Postgres com outros arquivos limita cada leitor ao Canal do cenário (filtrarContas), senão ele tenta abrir os Canais dos cenários anteriores"

requirements-completed: [EML-03, EML-04, EML-07]

duration: 50min
completed: 2026-11-19
status: complete
plan_head_before: 803a3d75f0fbde7f96a7ee9e17b28345c474820e
plan_head_after: e3bcd6e8c92c0991d056776ff5624da394658fd4
commits: 3

actuals:
  tokens: 22700
  tasks: 3
  commits: 3
---

# Phase 17 Plan 10: O leitor da caixa de entrada do e-mail Summary

**O `apps/api` ganha, atrás de `EMAIL_LEITOR_ATIVO` (e só junto com `MENSAGERIA_WORKER_ATIVO`), uma sessão IMAP em IDLE por Canal de e-mail conectado, com a trava de um processo só por Canal numa conexão `pg.Client` dedicada fora do pool: o e-mail novo entra na fila com o cursor na mesma transação, o processador o faz Conversa, e a caixa que recusa a senha cai e deixa de ser tentada.**

## Accomplishments

- `leitor.ts`: o supervisor (a cada 30 s relê `contasParaLer`, abre a sessão do Canal novo que ganha `pg_try_advisory_lock` na conexão dedicada, fecha e solta a do que sumiu) e a sessão por Canal (`abrirImap` pela fábrica com `uso: "leitor"`, leitura de `UID >= cursor` sob `getMailboxLock("INBOX")`, `prepararEmailRecebido` com o `INTERNALDATE` em `recebidoEm`, `enfileirarEmailEAvancar`, `aoEnfileirar`). `exists` do IDLE e um temporizador de 2 min agendam a leitura (uma por vez, sem se sobrepor).
- Garantias provadas por teste, com o dublê de IMAP e o meu Postgres: o histórico anterior à conexão não entra; reiniciar não repete linha nem Mensagem; a faixa `n:*` que devolve a última mensagem abaixo do cursor é descartada; UIDVALIDITY novo recomeça do `UIDNEXT` novo, registra "uidvalidity mudou" com o id do Canal e não reimporta; sem IDLE a conferência pega; dois leitores na mesma base leem o Canal um de cada vez e o outro assume quando o primeiro para; a conexão das travas cair (`pg_terminate_backend`) para todas as sessões na hora e as refaz; uma conexão dedicada por processo qualquer que seja o número de Canais; teto de sessões; Canal que sai de `conectada` perde a sessão.
- Reconexão: o `derrubarConexoes` reabre a sessão pela fábrica e pelo resolvedor de novo (a guarda de rede de D-17-07 vale em toda abertura, T-17-48), e um DNS que passa a devolver endereço interno é recusado sem tocar o Canal; a espera cresce (20, 40, 80, 100, 100 no teste) e é zerada por uma sessão estável.
- D-17-20: a senha trocada derruba o Canal a `desconectada` com "O servidor IMAP recusou o usuário ou a senha: conecte a caixa de novo.", a sessão para, e o servidor não recebe nenhum login a mais em 2,5 s; `AUTORIZACAO_RECUSADA` da porta de acesso é a mesma queda com o motivo dela e uma chamada só; `OAUTH_NAO_CONFIGURADO` só espera; `conectarPorSenha` com a senha nova faz o leitor voltar e o e-mail seguinte entra.
- OAuth: a sessão leva `sessaoExpiraEm`; a biblioteca fecha a sessão no vencimento, a reconexão cai dentro da margem de 5 min, renova (1 chamada ao renovador) e segue sem queda.
- Anexo no bucket: falhando duas vezes e passando na terceira, o e-mail entra uma vez só com o anexo `baixado: true` e o cursor só avança depois; sem o bucket voltar, entra na terceira com `baixado: false`.
- EML-04, e2e: o e-mail A entra, a resposta B escrita na Caixa sai pelo outbox e pelo SMTP do dublê com `Message-ID: n1.<id>@caixa.teste`, `In-Reply-To: <A>` e `References: <A>`, o cliente responde C (`In-Reply-To: <B>`, `References: <A> <B>`) e C entra na mesma Conversa com `em_resposta_a_id` = B; uma Conversa, três Mensagens.
- `index.ts`: `deveIniciarOLeitorDeEmail(process.env)`; com as duas flags cria o leitor com `aoEnfileirar: () => acordadores.entrada()`, `iniciar()` e `aoEncerrar(() => leitor.parar())`; com só a primeira, `app.log.warn` com o motivo; sem a primeira, nada acontece.

## Task Commits

1. **Task 1 (tracer): o e-mail novo da sessão IMAP vira Conversa** - `d2aff4a` (feat)
2. **Task 2: sem repetir, sem histórico, UIDVALIDITY, reconexão, uma instância por Canal e a troca de três e-mails** - `bc710fa` (test)
3. **Task 3: a caixa que recusa a senha cai e para; o leitor sobe por `EMAIL_LEITOR_ATIVO`** - `e3bcd6e` (feat)

**Portão do tracer:** o `<verify>` do tracer (`e2e/email-entrada.test.ts` e `tsc`) passou antes de expandir. O `leitor.ts` nasceu na Task 1 já com a sessão, a queda por senha e `deveIniciarOLeitorDeEmail`; as Tasks 2 e 3 trouxeram as provas, a opção `filtrarContas` e o `index.ts`.

## Verification Results

Postgres 16 próprio (container `crm-n1-pg-1710`, porta 55757, migrado até a 017 com `npm run --silent migrar`; nenhum container `supabase_*` tocado).

- `leitor.test.ts` (25 testes, 3 do `deveIniciarOLeitorDeEmail` sem banco) e `e2e/email-entrada.test.ts` (2 testes): passam. Rodados **3 vezes seguidas**: 27 de 27 nas três, cerca de 38 s cada, sem falha intermitente. Os testes têm esperas reais (sessões, reconexão, 2,5 s sem login depois da queda); nada com relógio simulado.
- `npx tsc --noEmit` em `apps/api`: limpo.
- Regressão no meu Postgres: `src/mensageria` inteiro, `src/persistencia`, `src/testes`, `e2e/email-saida`, `e2e/mensageria`, `-entrada`, `-midia`, `-tempo-real`, `e2e/lista-conversacional-entrada` e `encerramento.test.ts`: 78 arquivos, 1169 de 1170 testes passam. A única falha é a já registrada em `deferred-items.md` (`whatsapp-cloud.test.ts`, "sem a integração configurada, 503 dizendo o que falta"), que não é deste plano e não foi tocada.
- Não rodei o `npm test` completo da api, nem `tsc` do domínio e da web (nenhum dos dois foi tocado). O `index.ts` não tem teste próprio: a ligação é conferida por `tsc` e pelo teste do leitor com o mesmo `acordar`; a subida real com as flags só vale na publicação.
- Os `<automated>` não foram rodados literalmente: a porta é a 55757 pedida pelo orquestrador (não a 55737) e os passos foram separados; são os mesmos comandos e arquivos.
- Teste com dentes: troquei temporariamente (um de cada vez, voltando o código em seguida) o descarte do UID abaixo do cursor, a comparação de UIDVALIDITY e a queda por `recusou_login`; os testes "sem mensagem nova depois do cursor", "caixa recriada antes de ler" e "a senha mudou" falharam, respectivamente.
- Acceptance: `pg_try_advisory_lock` no `leitor.ts` 2; `new Client` 1; `pool().connect()` 0; `enfileirarEmailEAvancar` 4; `uidvalidity mudou` 1; `abrirImap` 3; `In-Reply-To` no e2e 4; `EMAIL_LEITOR_ATIVO` no `index.ts` 1 e `criarLeitorDeEmail` 2; `registrarQuedaDoEmail` no leitor 3; `export function deveIniciarOLeitorDeEmail` 1.

## TDD

A implementação foi escrita inteira antes dos testes (como em 17-08 e 17-09): não há fase RED observada nem commit RED separado. Os testes passaram quase todos na primeira rodada; a única falha real foi de teste (o leitor listava os Canais de cenários anteriores do mesmo Espaço, abaixo). A prova de que pegam defeito são as três trocas temporárias descritas acima. O plano é `type: execute`, sem gate de pares RED/GREEN.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] A fábrica não deixava o leitor escolher o `maxIdleTime`**
- **Found during:** Task 1
- **Issue:** o comentário de 17-03 diz que o `socketMs` do leitor tem de ser maior que o `maxIdleTime` e que "o 17-10 escolhe", mas `EntradaDeImap` não tinha como passá-lo ao `imapflow`.
- **Fix:** campo opcional `maxIdleTimeMs` em `EntradaDeImap`, repassado como `maxIdleTime`; `EntradaDeVerificacaoImap` o omite. Padrão do leitor: 5 min (o `socketMs` do leitor é 15 min).
- **Files modified:** `fabrica-de-conexao.ts`
- **Commit:** `d2aff4a`

**2. [Rule 3 - Blocking] `chaveDePosicao` era privada**
- **Found during:** Task 1
- **Issue:** o e-mail acima de 50 MiB não pode ser baixado (T-17-47), então o leitor não passa os bytes a `prepararEmailRecebido`, mas precisa da mesma chave de posição que o tradutor daria.
- **Fix:** `chaveDePosicao` passou a ser exportada (corpo intacto).
- **Files modified:** `traduzir.ts`
- **Commit:** `d2aff4a`

**3. [Rule 3 - Blocking] O dublê não sabia fazer o que os testes pedem**
- **Found during:** Task 1 e 2
- **Issue:** "a senha mudou", "IDLE desligado" e "o dublê não tem conexão aberta depois" não tinham como ser programados.
- **Fix:** `semIdle`, `trocarSenha(usuario, nova)` (IMAP e SMTP) e `conexoesAbertas()` em `servidor-de-email-falso.ts`, com três testes novos no `servidor-de-email-falso.test.ts`.
- **Files modified:** `testes/servidor-de-email-falso.ts`, `testes/servidor-de-email-falso.test.ts`
- **Commit:** `d2aff4a`

**4. [Rule 2 - Missing critical] E-mail que faz o tradutor lançar prenderia a caixa**
- **Found during:** Task 1
- **Issue:** `prepararEmailRecebido` não lança por causa do conteúdo, mas se lançar por algo fora do e-mail, o leitor ficaria no mesmo UID para sempre.
- **Fix:** três lançamentos seguidos no mesmo UID e o e-mail entra como `ignorado:ilegivel`; antes disso, o cursor fica e a leitura se repete depois de 10 s.
- **Files modified:** `leitor.ts`
- **Commit:** `d2aff4a`

### Escolhas dentro da lacuna do plano

- A trava usa `hashtextextended(texto, 0)` (64 bits) em vez de `hashtext` (32 bits): um colisão de 32 bits calaria um Canal sem ninguém ver.
- Opções só de teste, documentadas no código: `filtrarContas` (o Postgres de teste é compartilhado e a lista atravessa os Espaços), `nomeDaAplicacao` (a produção não manda `application_name`: o pooler pode recusá-lo) e `chaves` (as chaves do cofre do teste). `esperaDoAnexoMs`, `estavelMs` e `maxPorLeitura` também são injetáveis.
- Cada leitura lê no máximo 100 e-mails (`maxPorLeitura`); o resto vem na volta seguinte, sem esperar o intervalo.
- A queda por login recusado vale também para a sessão OAuth (token revogado), como pede a regra de D-17-20; o `recusou_login` da fábrica é a única falha de conexão que derruba o Canal.
- O leitor reconhece "Canal fora de uso" (arquivado, simulado, desconectado, de outro provedor) como fim da sessão sem queda: quem o tira da lista é a própria consulta do supervisor.
- `testes/bancada-de-email.ts` é novo e não estava na lista do plano: evita repetir a montagem em dois arquivos de teste.

**Total deviations:** 4 auto-fixed (3 Rule 3, 1 Rule 2); nenhuma exigiu decisão do dono.

## Notas para a revisão

- **O que NÃO foi provado contra um servidor real:** IDLE do Gmail e do Outlook (o `maxIdleTime` de 5 min foi escolhido pelo padrão da biblioteca, sem ter sido medido contra eles), o formato de `INTERNALDATE` e do `n:*` dos servidores reais (provados só no `imapkit`) e a trava consultiva atrás do pooler de produção (a prova A9 do `CONTEXT.md` da raiz é do `LISTEN/NOTIFY`, não da trava de sessão). Tudo isso é da prova real do 17-16 (9.4.4).
- Cada passada de um e-mail com anexo que falhou no bucket sobe de novo os arquivos que tinham subido: sobram objetos em `entrada/` que a coleta de órfãos remove depois do tempo mínimo (só enquanto `COLETA_DE_ORFAOS_ATIVA=true`).
- O `canaisLidos()` ainda lista por até um ciclo do supervisor (30 s em produção) uma sessão que acabou sozinha (queda registrada): o supervisor a recolhe e solta a trava na volta seguinte.
- Janela de milissegundos já conhecida da biblioteca: o `imapflow` fecha a sessão OAuth a 5 min do vencimento, e a porta de acesso só renova com menos de 5 min; se o temporizador disparar um instante antes, a primeira reconexão reabre com o mesmo token e fecha de novo, e a segunda (5 s depois) já renova. Sem queda, só uma espera a mais.
- O e-mail que chega enquanto o Canal está caído não entra: `conectarPorSenha` regrava o cursor no `UIDNEXT` da reconexão (D-17-08, `[auto]`, para o dono conferir).
- A produção segue com o leitor desligado: nada foi publicado, e a unidade systemd (`EMAIL_LEITOR_ATIVO=false`) e o `.env.example` são do 17-16.

## Auth gates

Nenhum.

## Known Stubs

Nenhum.

## Threat Flags

Nenhuma superfície nova além do `<threat_model>`. T-17-45 (trava na conexão dedicada, fora do pool: provado com `pg_stat_activity` e o critério contra `pool().connect()`), T-17-46 (a sessão para depois da senha recusada, sem login a mais), T-17-47 (sem histórico, teto de 50 sessões e de 50 MiB por e-mail sem baixar o `source`, 100 e-mails por leitura), T-17-48 (o resolvedor é consultado de novo na reconexão e um endereço interno é recusado), T-17-49 (o leitor só liga com o processador) e T-17-50 (o registro só leva contagens, o id do Canal e o nome do tipo da falha: provado com e-mail, assunto, corpo e senha de busca no JSON do registro) estão mitigados e provados.

## Self-Check: PASSED

- Os arquivos criados e alterados existem (`leitor.ts`, `leitor.test.ts`, `e2e/email-entrada.test.ts`, `testes/bancada-de-email.ts`, `index.ts` e os demais acima) e os commits `d2aff4a`, `bc710fa` e `e3bcd6e` são ancestrais de `HEAD`; `commits: 3` medido do ledger (`803a3d7..HEAD`).
- Container `crm-n1-pg-1710` removido.

---
*Phase: 17-e-mail-conectar-a-caixa-receber-e-enviar-sess-o-9*
*Completed: 2026-11-19*
