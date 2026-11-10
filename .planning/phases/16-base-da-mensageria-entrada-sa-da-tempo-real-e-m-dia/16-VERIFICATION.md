---
phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia
verified: 2026-11-10T17:05:00Z
status: gaps_found
score: 6/10 must-haves verified
covered_files:
  - apps/api/migracoes/013-mensageria.sql
  - apps/api/src/index.ts
  - apps/api/src/mensageria/entregar-mensagem.ts
  - apps/api/src/mensageria/hub-de-eventos.ts
  - apps/api/src/mensageria/processador-de-entrada.ts
  - apps/api/src/mensageria/registro.ts
  - apps/api/src/persistencia/outbox-worker.ts
  - apps/api/src/rotas/eventos.ts
  - apps/api/src/rotas/webhooks-de-mensageria.ts
  - apps/api/src/servicos/crm/canais.ts
  - apps/api/src/servicos/crm/mensagens.ts
  - apps/api/src/servicos/crm/recebimento.ts
  - apps/web/src/dados/tempo-real.ts
  - apps/web/src/features/crm/anexo-da-mensagem.tsx
  - apps/web/src/features/crm/estado-da-entrega.tsx
  - packages/dominio/src/crm/canais.ts
covered_digest: "v3:sha256:ba81e70d597f7314d7c060c420889ed48b2a5d48985d41c323d30530445a3b72"
behavior_unverified: 3
overrides_applied: 0
gaps:
  - truth: "MSG-05 / D-16-03: o provedor de teste só serve a Canal simulado, e uma Mensagem nunca aparece como \"Enviada\" sem ter saído para o provedor real (CR-01)"
    status: failed
    reason: "A regra do registro vale na letra (`provedorDoCanal` só devolve o de teste com `conexaoSimulada = true`), mas o domínio deixa um Canal REAL virar simulado por um caminho da própria tela: Desconectar zera `conexao_simulada`, e \"Simular conexão\" (o único botão de reconectar) o religa como `conectada` com `conexaoSimulada: true`. Daí em diante a saída vai ao provedor de teste (devolve `teste-<uuid>` e a tela mostra \"Enviada\" sem nada sair para o WhatsApp) e a entrada da Evolution passa a ser descartada como `ignorado:formato_invalido`, depois de a rota já ter respondido 200. É o resultado que `registro.ts` e T-16-04 dizem proibir. Nenhum teste cobre Canal real desconectado seguido de `simular_conexao`."
    artifacts:
      - path: "packages/dominio/src/crm/canais.ts"
        issue: "`proximaConexao(canal, \"simular_conexao\")` só recusa Canal arquivado ou já `conectada`; não olha se o Canal já foi real (linhas 141-146)"
      - path: "apps/api/src/servicos/crm/canais.ts"
        issue: "`mudarConexao` grava a transição sem checar provedor registrado nem credencial do provedor no cofre (linhas 178-188)"
      - path: "apps/web/src/app/(shell)/crm/caixa-de-entrada/configuracoes/canais/[canal]/page.tsx"
        issue: "o botão \"Simular conexão\" aparece para qualquer Canal ativo que não esteja `conectada`, sem condição de provedor (linha 277)"
    missing:
      - "`mudarConexao` recusar `simular_conexao` (409 `TRANSICAO_INVALIDA`) quando o provedor do Canal tem adaptador registrado ou existe credencial do provedor no cofre para o Canal, ou marcar de forma persistente o Canal que já foi real"
      - "a ficha do Canal esconder \"Simular conexão\" para Canal que já foi real"
      - "teste: Canal real desconectado + `simular_conexao` dá 409 e não muda `conexao_simulada`"
  - truth: "T-16-28 / 16-07: o desligamento do serviço não pendura (os fluxos SSE fecham antes do `app.close()`)"
    status: partial
    reason: "A parte testada vale: `hub.encerrarTodos()` seguido de `app.close()` fecha em menos de 1 s. Mas o ouvinte de SIGTERM de produção (`aoEncerrar`, `index.ts:143-151`) só chama `parar()` de cada worker e do hub; nada chama `app.close()`, `encerrar()` do pool nem `process.exit()` nesse caminho (isso só existe em `registroGlobal[CHAVE_DA_DESMONTAGEM]`, usado na recarga do `--watch`). O `restart` de 2026-11-10 estourou o `TimeoutStopSec=20` e levou SIGKILL (16-PROVAS.md). O ouvinte de SIGTERM é anterior à fase (Fase 2/9); o que a Fase 16 acrescenta é um worker de saída que agora pode ser cortado em voo (ver WR-01). O 16-07-SUMMARY e a 16-VALIDATION marcam T-16-28 como coberto: a evidência de produção os contradiz. A causa exata não foi reproduzida."
    artifacts:
      - path: "apps/api/src/index.ts"
        issue: "o SIGTERM não fecha o servidor, não encerra o pool e não sai do processo (linhas 139-151, 336-346)"
    missing:
      - "um tratador único de SIGTERM/SIGINT: `hub.encerrarTodos()`, `app.close()`, `Promise.all(paradas)`, `encerrar()` do pool e `process.exit(0)`, com teto próprio abaixo de 20 s"
      - "teste do caminho do SIGTERM (não só de `encerrarTodos()` + `close()`)"
behavior_unverified_items:
  - truth: "Pronto quando (b) da fase: texto e áudio do celular aparecem na Caixa de outra aba em menos de 2 s, com o áudio tocando, e a resposta escrita na Caixa chega ao celular"
    test: "Com DevTools aberto na aba EventStream de `/eventos`, mandar um texto e um áudio de voz do celular e cronometrar até aparecerem na outra aba; conferir que o evento chega pelo SSE e não pela releitura de 5 s"
    expected: "texto abaixo de 2 s; áudio abaixo de 3 s (decisão do dono, 2026-11-10); o evento aparece no EventStream"
    why_human: "Depende de WhatsApp real. O servidor mediu 1,04 a 1,09 s (texto) e 2,28 s (áudio) de `recebido_em` a `processado_em`; o ponta a ponta é estimativa. O dono relatou que tudo funcionou, mas não cronometrou, e a releitura de 5 s da tela esconde a diferença"
  - truth: "MSG-03: em produção, atrás do nginx da VM, o evento chega à aba sem ficar preso no buffer e a batida de 25 s segura a conexão abaixo do `proxy_read_timeout` de 120 s"
    test: "Abrir a Caixa em produção, DevTools, Rede, filtro `eventos`, aba EventStream: ver `: aberto` na hora e `: batida` a cada 25 s (passo 15 de `16-PROVA-AO-VIVO.md`)"
    expected: "o fluxo abre sem buffer e fica aberto além de 25 s"
    why_human: "Exige o token de login do dono. Só o ensaio `provar-nginx.sh` em Docker foi feito; em produção há apenas o indício do ouvinte conectado e dos 52 ms de `tempo-real:provar`"
  - truth: "MSG-04: o áudio de voz do WhatsApp (`audio/ogg` Opus) toca no navegador do atendente, inclusive Safari"
    test: "Abrir a Caixa no Safari e tocar um áudio recebido"
    expected: "o áudio toca; se não tocar, reabrir `convertToMp4` (OPT-OUT em `COVERAGE.md`)"
    why_human: "jsdom não toca mídia. Só o Chrome foi usado (relato do dono)"
human_verification:
  - test: "Cronometrar texto e áudio do celular na outra aba pelo EventStream (G-02, passos 17 e 18)"
    expected: "texto abaixo de 2 s, áudio abaixo de 3 s, evento visto no EventStream"
    why_human: "WhatsApp real e cronômetro na tela"
  - test: "Conferir `/eventos` atrás do nginx de produção (G-01, passo 15)"
    expected: "`: aberto` na hora, `: batida` a cada 25 s"
    why_human: "token de login do dono"
  - test: "Tocar um áudio recebido no Safari (G-03)"
    expected: "toca"
    why_human: "navegador real"
  - test: "Storage real do Supabase: baixar um documento recebido e ler `Content-Disposition: attachment`; esperar a primeira coleta de órfãos (24 h depois do boot) e ler a linha do log (G-04)"
    expected: "documento sai como anexo; a coleta lista objetos com `created_at` e registra só contagens"
    why_human: "os testes usam o armazenamento falso; o real exige `SUPABASE_*` de produção. Imagem e áudio funcionaram ponta a ponta; documento não foi exercido"
  - test: "Rotacionar a chave global da Evolution (T-16-55), reiniciar a Evolution e registrar a data em `16-SECURITY.md`"
    expected: "a chave colada na conversa deixa de valer"
    why_human: "só o dono opera a Evolution"
  - test: "Fazer o backup do schema `plataforma` agora, ou registrar o risco aceito no Accepted Risks Log de `16-SECURITY.md` (T-16-58)"
    expected: "backup guardado, ou aceite de risco assinado pelo dono"
    why_human: "decisão e ação do dono sobre produção; a `013` não tem desfazer e dado pessoal real já entra em `webhooks_recebidos` e `mensagens`"
---

# Fase 16: Base da mensageria (entrada, saída, tempo real e mídia) — Relatório de verificação

**Objetivo da fase:** Construir uma vez só o que os quatro provedores de Canal (Sessões 4, 7, 8 e 9) usam: porta de entrada, porta de saída, tempo real e mídia das mensagens. Sessão 3 do cronograma, parte C (tarefas 3.6 a 3.9).
**Verificado em:** 2026-11-10
**Status:** `gaps_found`
**Reverificação:** Não, verificação inicial

## Resumo

A base existe, está ligada e foi provada ao vivo em produção (SHA `74554ab`): o webhook por Canal, a fila de entrada, a saída enfileirada na mesma transação, o hub SSE por Espaço, a mídia guardada no bucket e o adaptador mínimo da Evolution estão no código, com testes verdes e com texto, áudio e imagem passando de um celular real pela Caixa. A fase não fecha por dois defeitos de código, ambos confirmados por leitura nesta verificação, e por provas que só o dono pode dar:

1. **CR-01 (lacuna de código, MSG-05).** Um Canal real vira simulado pela própria tela. É o que a fase prometeu impedir.
2. **T-16-28 / WR-03 (lacuna de código, parcial).** O SIGTERM de produção não encerra o processo; o `restart` levou SIGKILL.
3. **Provas do dono.** Cronômetro de 2 s pelo SSE, `/eventos` atrás do nginx, áudio no Safari e Storage real não foram dados. Ficam em `human_verification`.

Sobre a precedência: a árvore de decisão põe `gaps_found` acima de `human_needed`. As duas listas coexistem neste relatório; nada do que o dono precisa provar se perde.

## O que cada nível de prova cobre

| Nível | O que cobre | Onde está |
|---|---|---|
| (a) Teste automatizado | MSG-01 a MSG-06 no que é automatizável: 66 de 85 entregáveis com teste verde; suíte inteira num Postgres 16 de Docker no plano 16-14 (api 217 arquivos e 2877 testes, web 1366, domínio 2452); `check` do CI verde em `74554ab` (o CI roda sem banco) | `16-VALIDATION.md` |
| (b) Prova ao vivo | texto, áudio e imagem do celular entraram sozinhos (5 webhooks `processado`, nenhum `falhou`, nenhum `ignorado:sem_numero`); a resposta de texto e a imagem chegaram ao celular; áudio tocou no Chrome; `LISTEN/NOTIFY` pelo pooler de produção em 52, 53 e 52 ms | `16-PROVAS.md` |
| (c) Não provado, só o dono prova | cronômetro de 2 s nas duas abas pelo SSE; `/eventos` atrás do nginx; áudio no Safari; Storage real (download de documento e coleta de órfãos) | seção "Verificação humana" |

Reexecutado nesta verificação, sem banco e sem `DATABASE_URL` (a variável foi removida do ambiente de cada comando):

- `apps/api`: `hub-de-eventos`, `provedor`, `midia`, `evolution/traduzir`, `evolution/cliente` e `configuracao-de-producao`: 6 arquivos, 100 testes verdes.
- `packages/dominio`: `recebimento`, `mensagens`, `midia`, `canais`, `eventos`: 116 testes verdes.
- `apps/web`: `tempo-real`, `estado-da-entrega`, `anexo-da-mensagem`: 39 testes verdes.
- `tsc --noEmit` em `apps/api`: limpo.

Não rodei `npm test`, `npm run check` nem teste com banco, por regra do pedido (o `.env` da api aponta para produção). A cobertura dos testes de banco repousa no registro do 16-14, não em reexecução minha.

## Verdades observáveis

As verdades vêm do contrato do ROADMAP (Pronto quando, partes (a) e (b)) e dos `must_haves` dos 16 planos. Os IDs MSG-01 a MSG-06 são locais da fase e agrupam os `must_haves` por requisito. Os `must_haves` marcados `verification: backstop` (nginx, duas abas, Safari, pooler, prova ao vivo) abstêm sem evidência explícita: presença e ligação nunca bastam.

| # | Verdade | Status | Evidência |
|---|---|---|---|
| 1 | **Pronto quando (a):** com o provedor de teste, uma chamada ao webhook de um Canal cria ou acha o Contato, abre ou reabre a Conversa, e a resposta escrita passa pela fila e chega ao provedor de teste | ✓ VERIFIED | `e2e/mensageria-entrada.test.ts`, `e2e/mensageria.test.ts`, `servicos/crm/recebimento.test.ts` (registrados verdes no 16-14); rota registrada em `app.ts:283`, processador chama `receberMensagem`, a saída enfileira em `servicos/crm/mensagens.ts:301` e `conversas.ts:553` |
| 2 | **Pronto quando (b):** ao vivo, texto e áudio do celular aparecem na outra aba em menos de 2 s, o áudio toca, a resposta chega ao celular | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Entrada, áudio tocando no Chrome e resposta ao celular provados (`16-PROVAS.md`). O tempo nas abas não foi cronometrado; servidor: 1,04 a 1,09 s (texto) e 2,28 s (áudio); o dono aceitou áudio até 3 s. Ver `human_verification` |
| 3 | **MSG-01** porta de entrada: evento do provedor vira Contato, Conversa e Mensagem; a mesma chamada repetida não grava nada novo; mesma 401 para toda recusa; `for update skip locked`; trava vencida volta | ✓ VERIFIED | `013-mensageria.sql` (`webhooks_recebidos`, índice único da chave); `rotas/webhooks-de-mensageria.ts` (`publica: true`, `webhook-meta.ts` sem mudança em `git diff`); testes `recebimento`, `processador-de-entrada`, `webhooks-de-mensageria`, `migracao-013`. `registrarRecebida` só resta como menção em comentário de `webhook-meta.ts` |
| 4 | **MSG-02** porta de saída: `pendente` + `mensagem.enviar.v1` só com ids na mesma transação; sai pelo provedor do Canal; transitório tenta de novo, ambíguo vira `falhou` sem reenvio; "Tentar de novo"; status só avança | ✓ VERIFIED (com avisos WR-01, WR-02) | `fila-de-saida.ts`, `entregar-mensagem.ts`, `outbox-worker.ts` (`not like 'mensagem.%'` no worker antigo); `e2e/mensageria.test.ts`, `entregar-mensagem.test.ts`; web `estado-da-entrega` verde nesta verificação. Os dois avisos são janelas de duplicação, ver "Achados" |
| 5 | **MSG-03** tempo real: `pg_notify` no mesmo cliente da transação; `GET /eventos` filtra por Espaço e por poder `ler`; 503 sem ouvinte; releitura de 5 s de reserva; sem toast, som ou título (D-16-02) | ✓ VERIFIED | `avisar.ts`, `hub-de-eventos.ts`, `rotas/eventos.ts` (`X-Accel-Buffering`, batida de 25 s), `AcompanhanteDoTempoReal` montado em `store.ts:678`; `hub-de-eventos.test.ts` e `tempo-real.test.ts` verdes aqui; e2e: webhook até duas abas em menos de 1 s localmente; `tempo-real:provar` em produção: 52, 53, 52 ms |
| 6 | **MSG-03 (backstop):** em produção, `/eventos` atravessa o nginx sem buffer e a batida segura a conexão; duas abas em menos de 2 s pelo SSE | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Só o ensaio `provar-nginx.sh` em Docker e o ouvinte conectado no journal. Produção não conferida (G-01, G-02) |
| 7 | **MSG-04** mídia: anexo ligado a arquivo guardado; imagem, áudio, vídeo e documento com assinatura conferida e teto de 16/25 MiB; a mídia recebida é baixada e toca depois de o link do provedor expirar; falha grava `baixado: false` sem derrubar a Mensagem; documento sai sempre como anexo | ✓ VERIFIED | `midia.ts`, `armazenamento-de-anexos.ts`, `rotas/crm/mensagens.ts` (ticket, `POST /mensagens` com anexos, download); `midia.test.ts` verde aqui, `e2e/mensageria-midia.test.ts`, `coleta-de-orfaos.test.ts` (banco, registrados verdes); áudio e imagem exercidos ao vivo |
| 8 | **MSG-04 (backstop):** o áudio Opus toca no Safari | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Só Chrome (G-03) |
| 9 | **MSG-05** o provedor de teste só existe para Canal simulado, com segredo próprio por Canal no cofre | ✗ FAILED (parcial) | A letra vale: `registro.ts:43`, `provedores/teste.ts:131`, `registro.test.ts`, `canal-segredo-de-teste.test.ts`; não há segredo fixo. Mas CR-01 deixa um Canal real virar simulado e entregar "Enviada" sem sair (ver lacuna 1) |
| 10 | **MSG-06** a Evolution do dono, ligada por `canal:ligar-evolution`, recebe e envia texto e mídia; recusa `numeropvmarcos`; segredo no cabeçalho, não na URL | ✓ VERIFIED | `evolution/{cliente,provedor,traduzir}.ts`, `bootstrap/canal-ligar-evolution.ts`; testes do cliente e do tradutor verdes aqui, `e2e/mensageria-evolution.test.ts` e `canal-ligar-evolution.test.ts` registrados; ao vivo: `--seco` e comando real fecharam sem erro, 5 de 5 webhooks processados, a Evolution `2.4.0` mandou o número normal, não `@lid` |

**Pontuação:** 6/10 verdades verificadas, 1 falha, 3 presentes mas sem prova de comportamento. As 3 PRESENT_BEHAVIOR_UNVERIFIED não entram na contagem (regra do Passo 9).

## Artefatos e ligações (nível 1 a 3)

| Artefato | Esperado | Status | Detalhe |
|---|---|---|---|
| `apps/api/migracoes/013-mensageria.sql` | `webhooks_recebidos` e índice único do `mensagem.enviar.v1` | ✓ VERIFIED | aplicada em produção pelo `publicar.sh` ("Nada a aplicar" na segunda publicação); `migracao-013.test.ts` |
| `apps/api/src/mensageria/` | `provedor`, `registro`, `processador-de-entrada`, `fila-de-saida`, `entregar-mensagem`, `hub-de-eventos`, `ouvinte-pg`, `midia`, `coleta-de-orfaos`, `provedores/{teste,evolution}` | ✓ VERIFIED | todos presentes e com corpo; sem `TBD`, `FIXME`, `XXX`, `TODO` nem `HACK` nos 54 arquivos de produção do diff `83c5307..HEAD` |
| `rotas/webhooks-de-mensageria.ts`, `rotas/eventos.ts` | rotas ligadas em `app.ts` | ✓ WIRED | `app.ts:269` e `:283` |
| `index.ts` | workers e ouvinte ligados por ambiente | ✓ WIRED | `MENSAGERIA_WORKER_ATIVO`, `COLETA_DE_ORFAOS_ATIVA`, `TEMPO_REAL_ATIVO`; o desligamento é a lacuna 2 |
| `apps/web/src/dados/tempo-real.ts`, `features/crm/{anexo-da-mensagem,estado-da-entrega}.tsx` | escuta SSE e fio com mídia e estado | ✓ WIRED | `store.ts:65,678`; testes verdes aqui |
| Saída enfileirada | os três pontos que gravam Mensagem `enviada` passam por `enfileirarEnvio` | ✓ WIRED | `servicos/crm/mensagens.ts:301`, `servicos/crm/conversas.ts:553` (Conversa nova e Tarefa conversacional usam essa função) |
| Worker antigo do outbox | nunca reivindica `mensagem.%` | ✓ WIRED | `outbox-worker.ts:219` e `:365` |

**Nível 4 (dados reais):** o fio lê Mensagens de `GET /mensagens`; a entrada vem do corpo do provedor para `plataforma.mensagens`; as linhas de prova ao vivo (5 webhooks processados, Contato e Conversa criados) mostram o fluxo ponta a ponta com dado real. Nenhum retorno estático encontrado no caminho.

## Cobertura de requisitos

Os IDs `MSG-01` a `MSG-06` são locais da fase, definidos em `16-CONTEXT.md` `<domain>`. **`REQUIREMENTS.md` não os contém** (`grep -c "MSG-"` devolve 0): isso é como a fase foi desenhada e o ROADMAP já o diz ("IDs locais da fase"), não uma lacuna do código. Cada ID está declarado em ao menos um PLAN e tem SUMMARY correspondente.

| Requisito | Planos (frontmatter) | SUMMARY | Status | Evidência |
|---|---|---|---|---|
| MSG-01 | 16-01, 16-03, 16-14 | sim | ✓ SATISFIED | verdade 3 |
| MSG-02 | 16-04, 16-05, 16-06, 16-11, 16-14 | sim | ✓ SATISFIED (avisos WR-01/WR-02) | verdade 4 |
| MSG-03 | 16-07, 16-08, 16-14, 16-15, 16-16 | sim | ✓ SATISFIED no automatizável; ? NEEDS HUMAN no cronômetro e no nginx | verdades 5 e 6 |
| MSG-04 | 16-09, 16-10, 16-11, 16-14, 16-16 | sim | ✓ SATISFIED no automatizável; ? NEEDS HUMAN em Safari e Storage real | verdades 7 e 8 |
| MSG-05 | 16-02, 16-03, 16-14 | sim | ✗ BLOCKED (parcial) | verdade 9, CR-01 |
| MSG-06 | 16-12, 16-13, 16-14, 16-15, 16-16 | sim | ✓ SATISFIED | verdade 10 |

Requisitos órfãos (no ROADMAP e sem plano): nenhum. O ROADMAP lista `MSG-01 a MSG-06` e todos aparecem nos PLAN.md.

## Anti-padrões

| Arquivo | Linha | Padrão | Severidade | Impacto |
|---|---|---|---|---|
| `packages/dominio/src/crm/canais.ts` | 141-146 | transição `simular_conexao` não distingue Canal que já foi real | 🛑 Blocker | CR-01 |
| `apps/api/src/index.ts` | 143-151 | ouvinte de SIGTERM só para workers, não fecha servidor nem sai | ⚠️ Warning | T-16-28 / WR-03 (lacuna parcial) |
| `apps/api/src/persistencia/outbox-worker.ts` | 353-376 | trava vencida devolve `delivering` a `pending` sem saber se o provedor aceitou | ⚠️ Warning | WR-01 |
| `apps/api/src/mensageria/entregar-mensagem.ts` | 114-129 | `ENVIADO_SEM_REGISTRO` deixa a Mensagem `pendente` e a reconexão a reenvia | ⚠️ Warning | WR-02 |

Marcadores de dívida (`TBD`, `FIXME`, `XXX`): nenhum nos arquivos de produção da fase.

## Achados que não mudam o status por si

Vêm de `16-REVIEW.md` e foram relidos no código quando citados. Seguem `open` em `16-REVIEW-DISPOSITION.md`.

- **WR-01** (duplicata ao cliente): a recuperação de trava vencida (2 min) devolve a `pending` uma linha que pode já ter sido aceita pelo provedor; o entregador só confere `statusEntrega === "pendente"`. A janela é de milissegundos, mas o SIGKILL do item T-16-28 a aumenta a cada publicação com envio em voo. Tensão com o `must_have` do 16-05 ("ambíguo nunca reenvia sozinho"): vale para a resposta ambígua do provedor, não para a queda do processo.
- **WR-02**: depois de três falhas imediatas ao gravar o aceite, a Mensagem fica "Enviando…" para sempre e uma reconexão do Canal a reenvia ao cliente.
- **WR-04**: a resposta sai para o Identificador principal do Contato, não para o que escreveu; com Contato de dois números a Mensagem pode ir ao número errado, agora que a Evolution envia de verdade.
- **WR-05**: o provedor de teste guarda em memória, sem limite, o que enviou (texto, telefone, URL assinada) em Canal simulado de produção.
- **WR-06**: a confirmação do anexo roda dentro da transação do envio e prende uma segunda conexão do pool.
- **WR-07**: a chave de deduplicação da fila de entrada usa o `idExterno` do primeiro evento; latente para `MESSAGES_UPDATE` na Sessão 4.
- **WR-08**: o cliente SSE não detecta fluxo parado em silêncio e, nesse estado, a releitura de 5 s está desligada.
- **IN-01 a IN-05**: sombra do webhook não esconde a existência do Canal pelo tempo; referência de mídia que não baixou guarda a mensagem inteira da Evolution; coleta de órfãos para na primeira pasta que falha; mapa do limite de taxa nunca remove chaves; ouvinte de "fechou" do SSE ligado depois de uma ida ao banco.

Recomendação: CR-01 e T-16-28 entram no plano de lacuna. WR-01, WR-02, WR-04 e WR-08 merecem o mesmo plano, por tocarem a saída e o tempo real que a fase entrega; os demais podem esperar a Sessão 4.

## Segurança e processo (de `16-SECURITY.md`, fora das verdades de código)

- **T-16-55** (aberta, alta): a chave global da Evolution foi colada na conversa; a rotação segue pendente. Não é defeito de código.
- **T-16-58** (aberta, alta): a `013` entrou em produção **sem backup** do schema `plataforma`, por recusa do dono (`16-PROVAS.md`), e sem aceite de risco registrado. O `must_have` do plano 16-16 dizia "A `013` entra em produção só com backup manual". Esse `must_have` não foi cumprido e a divergência está documentada.
- **Desvio de processo do 16-16:** o plano dizia que o executor não rodaria nada contra produção; a publicação, o `canal:ligar-evolution` e as variáveis do `api.env` foram feitos pelo assistente por pedido escrito do dono. Está declarado em `16-PROVAS.md`. Não afeta o objetivo.

Sugestão de override, se o dono quiser aceitar o desvio do backup, depois de registrar o risco em `16-SECURITY.md`. Não foi aplicado: não cabe a esta verificação aceitar risco por ele.

```yaml
overrides:
  - must_have: "A 013 entra em produção só com backup manual do schema plataforma antes"
    reason: "backup recusado pelo dono; 013 aditiva; volta da API ao 20b4d01 possível, volta da 013 só por uma 014"
    accepted_by: "{dono}"
    accepted_at: "{ISO timestamp}"
```

## Verificação humana

1. **Cronômetro de texto e áudio na outra aba (G-02).** Passos 17 e 18 de `16-PROVA-AO-VIVO.md`, com a aba EventStream aberta. Esperado: texto abaixo de 2 s, áudio abaixo de 3 s, evento visto no fluxo. Por que humano: WhatsApp real; a releitura de 5 s esconde a diferença.
2. **`/eventos` atrás do nginx de produção (G-01).** Passo 15. Esperado: `: aberto` na hora, `: batida` a cada 25 s. Por que humano: token de login do dono.
3. **Áudio Opus no Safari (G-03).** Esperado: toca; se não, reabre `convertToMp4`.
4. **Storage real (G-04).** Baixar um documento recebido (`Content-Disposition: attachment`) e ler a linha da primeira coleta de órfãos. Os testes usam o armazenamento falso.
5. **Rotacionar a chave global da Evolution (T-16-55).**
6. **Backup do schema `plataforma` ou aceite de risco registrado (T-16-58).**

Lacunas de teste que não bloqueiam e ficam registradas em `16-VALIDATION.md`: G-05 (o encerramento não tem teste do caminho real; é a lacuna 2), G-06 (os testes de banco não rodam no CI; o SHA em produção não teve nova rodada completa com banco depois do gate do 16-14), G-07 (fixtures da Evolution sintéticas, da `2.3.7`, contra a `2.4.0` em produção). `nyquist_compliant` segue `false`.

## Resumo das lacunas

Dois defeitos de código impedem fechar a fase, e a correção de ambos é pequena:

1. **CR-01.** O domínio e a ficha do Canal deixam um Canal real virar simulado depois de "Desconectar" + "Simular conexão". A saída passa a "enviar" pelo provedor de teste e a entrada da Evolution é descartada. Corrigir a transição no domínio ou no serviço, esconder o botão para Canal que já foi real e cobrir com o teste que falta. Nenhuma fase posterior do ROADMAP cobre isso: o item "tirar Simular conexão da produção" é da Sessão 4 e não está no ROADMAP como fase, então a lacuna não foi adiada.
2. **SIGTERM.** Um tratador único que feche o hub, o servidor e o pool e saia, com teste do caminho do sinal. O diagnóstico "conexões SSE" de `16-PROVAS.md` não se sustenta (WR-03); a causa provável é o servidor que continua ouvindo.

Depois disso, o que resta é prova do dono (itens 1 a 4 acima) e a decisão sobre T-16-55 e T-16-58. A reverificação deve rodar CR-01 e o SIGTERM com teste e reavaliar o status: sem lacunas, o resultado é `human_needed` até o dono fechar as provas.

---

_Verificado: 2026-11-10_
_Verificador: Claude (gsd-verifier)_
