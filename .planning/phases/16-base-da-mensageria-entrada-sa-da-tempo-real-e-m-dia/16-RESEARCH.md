# Phase 16: Base da mensageria: entrada, saída, tempo real e mídia - Research

**Researched:** 2026-11-09
**Domain:** mensageria sobre Fastify 5 + Postgres (LISTEN/NOTIFY, SSE, outbox, Supabase Storage) e adaptador mínimo da Evolution API v2.3.7
**Confidence:** HIGH no que vem do repositório e da fonte da Evolution 2.3.7 e nos experimentos locais; MEDIUM no que depende da instância real do dono (marcado `[ASSUMED]`)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Já decidido nas subtarefas 3.6 a 3.9 (vale aqui, não foi reaberto)
- A interface do provedor mora em `apps/api/src/mensageria/provedor.ts` (entrada e saída de rede), com os tipos do domínio; `registro.ts` devolve o provedor do Canal; sem implementação, `PROVEDOR_INDISPONIVEL` (3.6.1).
- O recebimento é `receberMensagem(workspaceId, canalId, evento)` numa transação: repetida volta `repetida: true` sem tocar em nada; Contato achado por `detentorDoIdentificador` ou criado com `modo_criacao = 'automatico_mensagem'`; Conversa aberta reaproveitada, resolvida dentro de `inbox.reopenWindowHours` reabre, senão abre outra (RN-CXE-09); Contato arquivado ou na lixeira volta a `ativo` (RN-CON-13) (3.6.2). `registrarRecebida` vira o último passo.
- Webhook `POST /webhooks/mensageria/:canalId`, fora do hook de JWT, corpo cru preservado, Canal inexistente, arquivado ou chamada não verificada recebem a mesma 401 sem dizer o motivo; verificada grava em `plataforma.webhooks_recebidos` e responde 200 na hora, sem processar dentro da requisição (3.6.3).
- Fila de entrada: tabela `webhooks_recebidos` e worker `processador-de-entrada.ts` com `for update skip locked`, backoff, `locked_at` vencido volta a `pendente`, ligado por `MENSAGERIA_WORKER_ATIVO` (3.6.4). `proximoStatusDeEntrega` só avança (3.6.5).
- Saída: evento `mensagem.enviar.v1` no outbox, `statusInicialDeEnvio` sempre `pendente` (só o provedor diz que saiu), índice único por Mensagem, Mensagens `pendente` reenfileiradas quando o Canal volta a `conectada` (3.7.1); segundo worker só com esse evento, entregador pelo provedor, aceito grava `id_externo` e `enviada`, recusa permanente grava `falhou` com `motivo_falha` (3.7.2); `POST /mensagens/:id/reenviar` e os estados no fio (3.7.3).
- Tempo real: `avisarCrm` faz `pg_notify('crm_eventos', json)` no mesmo cliente da transação, payload só com ids; `GET /eventos` com uma conexão `LISTEN` por processo, filtro por Espaço e por poder `ler` `conversa`, batida a cada 25 s; a web usa `fetch` com `Authorization` e leitura em fluxo, reconecta com espera crescente e, sem conexão, volta à releitura de 5 s (3.8.2 a 3.8.4).
- Mídia: `AnexoDaMensagem` ganha `objectKey`, `tamanhoBytes` e `baixado`; lista própria de tipos da Mensagem sem alargar a do Formulário público; `POST /mensagens/anexos`, `POST /mensagens` com anexos confirmados e `GET /mensagens/:id/anexos/:indice` com a chave `workspace/<ws>/conversas/<conversaId>/<uuid>`; a mídia do provedor é baixada antes da transação, e a falha grava a Mensagem com `baixado: false` e tenta de novo na próxima passada; `coletarOrfaos` ligado por `COLETA_DE_ORFAOS_ATIVA` com `pg_try_advisory_lock` (3.9.1 a 3.9.6).

#### Tempo real (3.8.1)
- **D-16-01:** **O servidor avisa a tela por um canal próprio no `apps/api` (SSE), alimentado por `LISTEN/NOTIFY` do Postgres** (escolha B da 3.8.1, a recomendada). A regra de acesso continua no `apps/api`: cada aba só recebe eventos do próprio Espaço e de Conversas que o Membro pode ler. Descartado: Supabase Realtime (A), porque exigiria expor o schema `plataforma` ao Realtime com regras por linha, o contrário do que a Fase 9 fechou (a `009` está aplicada em produção e o `apps/api` conecta como `n1_api`). Custa uma conexão fixa a mais no pooler em modo sessão (porta 5432), que é o que produção já usa. — **Reversibility:** costly — `avisarCrm` fica espalhado pelos serviços de Conversa e Mensagem e `tempo-real.ts` na web; trocar de mecanismo depois mexe nos dois lados.
- **D-16-02:** **Mensagem que chega numa Conversa que o Membro não está olhando só atualiza as listas** (Caixa de Entrada, contador de não lidas e resumo das Tarefas conversacionais, por `mutate` das chaves). Sem toast, sem som, sem título da aba piscando. — **Reversibility:** reversible — é interface sobre o mesmo evento.

#### Provedor de teste e a Evolution
- **D-16-03:** **O provedor de teste só é devolvido para Canal com `conexao_simulada = true`, e cada Canal simulado tem o segredo do webhook próprio, no cofre** (`plataforma.credenciais`, a `009`). Não existe segredo fixo de teste. Isso **corrige** o item 8 da 3.6.1 ("aceita o segredo fixo de teste"). Em produção dá para simular um Canal no `ws_n1` e demonstrar a Caixa sem WhatsApp real; ninguém injeta mensagem sem o segredo daquele Canal. O conjunto de testes de contrato do provedor (3.6.1) continua rodando contra ele no CI. — **Reversibility:** reversible — é a regra de `provedorDoCanal` e a origem do segredo.
- **D-16-04:** **A Fase 16 inclui um adaptador mínimo da Evolution e uma prova ao vivo com a instância que o dono já provisionou.** Entra: o cliente da Evolution (parte de 4.2.2: o que `enviar` e `baixarMidia` usam, com tempo limite e `apikey`), a verificação do webhook por segredo (D-16-06), traduzir `MESSAGES_UPSERT` de texto, imagem, áudio, vídeo e documento para o evento de mensagem (parte de 4.4.2), `enviar` de texto e de mídia, `baixarMidia`. O dono conecta o número na própria Evolution, fora da plataforma. **Fica na Sessão 4:** QR code e "Conectar" na ficha, `CONNECTION_UPDATE` e `QRCODE_UPDATED`, a conferência periódica, `MESSAGES_UPDATE` (tiques), reações, edições, `MESSAGES_DELETE`, o nono dígito (4.4.3), vários números, tirar "Simular conexão" da produção. Consequência aceita para a prova: sem a tradução de `MESSAGES_UPDATE` não há tique de lida vindo do celular, e um número brasileiro sem o nono dígito pode virar Contato repetido. Descartado: só provedor de teste e a Evolution na Sessão 4 (o dono só veria mensagem de verdade depois); antecipar a Sessão 4 inteira (cerca de 40 subtarefas e a Sessão 4 deixaria de existir no cronograma). — **Reversibility:** costly — a Sessão 4 passa a herdar o adaptador desta fase e o cronograma (`docs/09-planejamento/`) precisa registrar que 4.2.2, 4.4.1, 4.4.2 e 4.4.4 foram parcialmente adiantados.
- **D-16-05:** **O Canal é ligado à instância por um comando de linha, uma vez por Canal:** `npm run canal:ligar-evolution -w @n1/api -- --canal <id> --instancia <nome>`. Ele guarda a chave da instância no cofre, gera o segredo do webhook, aponta o webhook da Evolution para a rota desta fase com o segredo no cabeçalho (D-16-06), lê o número conectado e marca o Canal `conectada` com `conexao_simulada = false`. Sem tela nova; a Sessão 4 troca o comando pelo botão "Conectar" com QR. **O comando recusa a instância `numeropvmarcos`**: ela é do `automation/` (extratos e avisos do Financeiro) e apontar o webhook dela para cá quebraria isso (4.1.1 e 4.5.2). Marcar `conectada` de verdade pede que o domínio entenda `conexao_confirmada` e `conferirNumeroConectado` (parte de 4.2.1: hoje `AcaoDeConexao` só tem `simular_conexao` e `desconectar`); o planejador decide se puxa só essas duas e deixa `conectar` e `conexao_perdida` para a Sessão 4. — **Reversibility:** reversible — é script e uma ação de domínio; a Sessão 4 substitui.

#### Webhook
- **D-16-06:** **O segredo do webhook da Evolution vai num cabeçalho próprio configurado no webhook da instância, não na URL.** A rota fica `POST /webhooks/mensageria/:canalId` e `verificarChamada` confere o cabeçalho em tempo constante contra o segredo do Canal no cofre; a chamada também confere que o `instance` do corpo é a instância daquele Canal. Motivo: o nginx da VM só mascara segredo de URL em `/v1/public/`, então um segredo na URL (como a 4.4.1 descreve) cairia no `access_log`. **Precisa ser conferido na versão instalada:** a Evolution v2 aceita `headers` ao configurar o webhook (`POST /webhook/set/{instancia}`)? Se não aceitar, o fallback é o segredo na URL e o mascaramento de `/webhooks/` no nginx, edição manual que só o dono faz. Isso **substitui** o desenho de URL com segredo da 4.4.1; a Sessão 4 herda o cabeçalho. — **Reversibility:** reversible — é onde o segredo viaja; troca-se na rota e no comando.
- **D-16-07:** **`apps/api/src/rotas/webhook-meta.ts` (`/webhooks/meta/whatsapp` e `/instagram`) fica como está** até as Sessões 7 e 8: continua só escutando, sem gravar nada. A Meta chama por app, não por Canal, e exige o aperto de mão GET; o encaixe depende de resolver `phone_number_id` ou página para um Canal, e é trabalho dessas duas sessões. A interface de provedor desta fase já deixa `verificarChamada` e `interpretarChamada` prontos para elas. — **Reversibility:** reversible — a rota nova não toca a antiga.

#### Mídia
- **D-16-08:** **Teto de 16 MiB para áudio e vídeo e 25 MiB para os demais tipos**, configuráveis por variável de ambiente como `UPLOAD_MAX_BYTES`. Mídia recebida acima do teto, ou cujo download falhe, grava a Mensagem assim mesmo com o anexo `baixado: false`, nome e a referência do provedor; nunca derruba a Mensagem. O `client_max_body_size` do nginx (26M) não muda. — **Reversibility:** reversible — são variáveis de ambiente.
- **D-16-09:** **A lista de tipos da Mensagem (`TIPOS_ACEITOS_NA_MENSAGEM`) ganha docx, xlsx, pptx, csv, txt e zip**, além de PDF, XML, JPEG, PNG, WebP, `audio/ogg`, `audio/mpeg`, `audio/mp4`, `audio/aac`, `video/mp4` e `video/3gpp` da 3.9.2. Só para Mensagem: o Formulário público segue com a lista de hoje e continua recusando áudio. A assinatura é conferida como nos outros tipos (`assinaturaConfereComTipo`): docx, xlsx, pptx e zip começam todos com `PK`, então a conferência só prova que o arquivo é da família ZIP, e o planejador decide se vai além disso (por exemplo, olhar o nome interno do pacote); csv e txt não têm assinatura e só valem se o conteúdo for texto. O download de documento sai sempre como anexo, nunca aberto no navegador. Motivo: cliente manda esses arquivos por WhatsApp o tempo todo, e sem eles o atendente perde o arquivo se o link do provedor expirar. — **Reversibility:** reversible — é uma lista e as assinaturas.
- **D-16-10:** **Enviar áudio pela Caixa é só anexar um arquivo de áudio.** Gravar pelo microfone na tela fica fora (ideia adiada, abaixo). — **Reversibility:** reversible.

### Claude's Discretion
- A ordem e o corte em planos, respeitando: domínio antes de api antes de tela; a migração nova (`013`: `webhooks_recebidos` e o índice único do `mensagem.enviar.v1`; a 3.6.4 a chama "migração nova da 3.1", que na prática é a próxima depois da `012`) antes dos serviços que a usam; a interface do provedor e o provedor de teste antes de tudo que fala com provedor; o adaptador da Evolution (D-16-04) depois de a porta de entrada e a de saída passarem com o provedor de teste; a prova ao vivo por último.
- O nome e a forma dos eventos (`mensagem.nova`, `mensagem.status`, `conversa.mudou`), os nomes de rotas e hooks, e como o `useConversas` e o resumo das Tarefas conversacionais se invalidam.
- **Em que borda a rota de webhook tem limite de taxa.** A 3.6.3 pede limite de taxa, mas `apps/api` não tem limitador próprio: o `limit_req` só existe no nginx e só para `/v1/public/` (`apps/api/deploy/nginx-n1-crm-api.conf`, `n1-crm-limites.conf`). O planejador decide entre um bloco `/webhooks/` no nginx (edição manual do dono, como a 09-20) e um teto na própria API.
- **SSE atrás do nginx:** a API deve mandar `X-Accel-Buffering: no` na resposta de `/eventos` para o nginx não segurar o fluxo; a batida de 25 s já cabe no `proxy_read_timeout` de 120 s. Provar com `apps/api/deploy/provar-nginx.sh` antes de depender disso.
- **Mensagem enviada pela plataforma que volta como `MESSAGES_UPSERT` com `fromMe`:** o `id_externo` só é gravado depois de o provedor responder, e o webhook pode chegar antes. O adaptador mínimo não pode duplicar a Mensagem enviada pelo próprio sistema; o planejador escolhe entre ignorar `fromMe` nesta fase (a mensagem digitada direto no celular não aparece até a Sessão 4) e tratar como a 4.4.2 item 3.
- **`@lid`:** conferir, com a versão instalada, se a Evolution entrega o remetente como `@lid` (sem número) em vez do número, antes da prova ao vivo (a "Atenção" da 4.4.2).
- Se o bucket é o `solicitacoes` de hoje (a 3.9.3 usa a chave `workspace/<ws>/conversas/...` no mesmo bucket, e `SUPABASE_STORAGE_BUCKET` é uma variável só) ou um bucket próprio de conversas; a recomendação do plano é o mesmo bucket.
- Quem fica de dono do Contato criado por mensagem de número desconhecido e em qual Fila cai a Conversa: o plano da 3.6.2 já define (`canal.proprietario_padrao_id`, senão `canal.configurado_por`, e `fila_padrao_id` do Canal); só reabrir se a prova ao vivo mostrar algo estranho.
- Quantas tentativas e por quanto tempo a fila de saída insiste antes de marcar `falhou` (o backoff de hoje do outbox como ponto de partida).
- O texto de erro de "Tentar de novo" e do estado de entrega no fio, em português de produto.

### Deferred Ideas (OUT OF SCOPE)
- Aviso de mensagem nova na tela (toast, som, título da aba piscando, preferências por Membro) — só as listas se atualizam nesta fase (D-16-02).
- Gravar áudio pelo microfone na Caixa de Entrada — só anexar arquivo agora (D-16-10); precisa de permissão do navegador e de converter para um formato que o WhatsApp toque como mensagem de voz (o Chrome grava WebM, não OGG).
- QR code e "Conectar" na ficha do Canal, `CONNECTION_UPDATE` e conferência periódica, tiques e reações vindos da Evolution, edições e mensagens apagadas, o nono dígito do número brasileiro, vários números e tirar "Simular conexão" da produção — Sessão 4.
- Encaixar os webhooks da Meta (WhatsApp oficial e Instagram) na rota por Canal e na fila de entrada, com o aperto de mão GET — Sessões 7 e 8 (D-16-07).
- Os avisos do Financeiro passarem a sair por um Canal daqui em vez do `automation/` — decisão 4.5.2, Sessão 4.
- Política de retenção do `corpo` de `webhooks_recebidos` e da mídia guardada — Sessão 19.
- Montar a homologação e ligar o backup diário do banco (1.7.2 e 1.7.3) — decisão de infra do dono, fora desta fase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MSG-01 | Porta de entrada: evento do provedor vira Contato, Conversa e Mensagem; a mesma chamada repetida não grava nada novo (3.6.1 a 3.6.5) | §1 (payload da Evolution), §3 (webhook cru + fila), §5 (fila de entrada, `013`), Pitfalls 3, 7, 11, 16 |
| MSG-02 | Porta de saída: Mensagem entra no outbox na mesma transação, sai pelo provedor, tenta de novo no transitório, mostra a entrega com "Tentar de novo" (3.7.1 a 3.7.3) | §5 (worker de saída, índice único, reenfileirar), §1 (endpoints de envio), Pitfalls 1, 2, 12, 13, 15 |
| MSG-03 | Tempo real: Mensagem aparece nas duas abas em < 2 s, sem vazar para outro Espaço nem para quem não pode ler (3.8.2 a 3.8.4) | §2 (LISTEN/NOTIFY + SSE, experimentos), §6 (chaves SWR), Pitfalls 3, 4, 5, 6 |
| MSG-04 | Mídia: áudio, imagem, vídeo e documento vão e vêm guardados no bucket e tocam depois de o link do provedor expirar (3.9.1 a 3.9.6) | §4 (mídia), §1 (`getBase64FromMediaMessage`), Pitfalls 8, 17, 21, 22 |
| MSG-05 | O provedor de teste só existe para Canal simulado, com segredo próprio por Canal (D-16-03) | §3 (segredo no cofre, CLI de segredo de teste), §7 |
| MSG-06 | A Evolution do dono, ligada por `canal:ligar-evolution`, recebe e envia texto e mídia pela mesma base (D-16-04 a D-16-06) | §1 (toda a seção), Open Questions, Environment Availability |
</phase_requirements>

## Summary

A fase é viável sem nenhum pacote novo: Fastify 5.12.5, `pg` 8.23.0, `@supabase/supabase-js` 2.116.0 e o vitest 5.0.1 já instalados cobrem entrada, saída, SSE e mídia. A pesquisa rodou quatro experimentos locais (resultados abaixo) e leu a fonte da Evolution na tag `2.3.7`, a mesma versão fixada em `apps/api/deploy/evolution/docker-compose.yml`. O resultado que mais pesa nos planos: **a D-16-06 está confirmada** (a v2.3.7 aceita `headers` em `POST /webhook/set/{instancia}` e os repassa em toda chamada, sem fallback), e **o eco da mensagem enviada pela API não existe** (o socket do Baileys é criado com `emitOwnEvents: false`), então ignorar `fromMe` nesta fase é seguro e é o que recomendo.

Cinco achados mudam o desenho das subtarefas. (1) O worker atual do outbox **não tem filtro por tipo de evento** (`reivindicar` em `outbox-worker.ts:157-175` só filtra `status = 'pending'`): ao entrar `mensagem.enviar.v1` na mesma tabela, o worker velho a pegaria e a marcaria `failed` com POST a `/webhooks/plataforma/desconhecido` (`:231`). `tiposDeEvento` e `entregador` que a 3.7.2 chama de "injetáveis" **ainda não existem**. (2) A chave SWR do resumo das Tarefas conversacionais é um **array** e `invalidarCrm` só casa chave `string` (`cliente-crm.ts`), então o tempo real precisa de um invalidador que também case arrays. (3) O polling padrão dos workers é de 5 s, incompatível com "menos de 2 s": o processador de entrada precisa ser acordado pela própria rota do webhook. (4) Há **três** pontos que gravam Mensagem `enviada` (`servicos/crm/mensagens.ts:157`, `servicos/crm/conversas.ts:524-531`, que a Tarefa conversacional reusa), e `statusInicialDeEnvio` ainda devolve `enviada` para Canal conectado (`packages/dominio/src/crm/mensagens.ts:192-194`). (5) `getBase64FromMediaMessage` da Evolution cai no banco dela quando recebe só `key.id`, e `DATABASE_SAVE_DATA_NEW_MESSAGE` é `false` por padrão e não está no `evolution.env.example`: o adaptador deve mandar o `message` inteiro que veio no webhook.

O risco real do critério ao vivo é o relógio do áudio: baixar da Evolution, subir ao bucket e gravar a transação, com cada ida ao banco custando cerca de 52 ms (medido na Fase 13), pode passar de 2 s. O texto passa folgado. Registrei o orçamento em §4 e uma pergunta ao dono em Open Questions.

**Primary recommendation:** Construa nesta ordem: `013` (webhooks_recebidos + índice único do outbox) → domínio (recebimento, status, anexos, conexão confirmada) → `mensageria/` com provedor de teste e testes de contrato → processador de entrada acordado pela rota → saída (filtro de tipos no worker velho + segundo worker) → `avisarCrm`/`LISTEN`/`GET /eventos` → mídia → web → adaptador da Evolution → prova ao vivo; use `reply.send(PassThrough)` para o SSE (testado), ignore `fromMe` e grupos, e mande o `message` do webhook ao `getBase64FromMediaMessage`.

## Project Constraints (from CLAUDE.md)

- `CLAUDE.md` importa `CONTEXT.md` (mapa das camadas) e `AGENTS.md`. **Regra de dependência:** `packages/dominio` não conhece ninguém; `apps/web` e `apps/api` conhecem o domínio e **nunca um ao outro**. Mudou "o que a coisa é" → domínio; "como aparece" → web; "como se guarda ou se serve" → api. Quando for as três, começar pelo domínio e descer. `[VERIFIED: CONTEXT.md da raiz, "A regra de dependência" e "Onde uma mudança nasce"]`
- `AGENTS.md`: este Next.js (16.3.4, `[VERIFIED: node_modules/next/package.json:3]`) tem mudanças de ruptura; ler `node_modules/next/dist/docs/` antes de afirmar algo sobre a web. Esta pesquisa só afirma sobre a web o que é API do navegador (`fetch` + `ReadableStream`) e o padrão já usado no repositório (`"use client"`, SWR, `chamarCrm`); `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` confirma a diretiva `'use client'` para componentes de cliente. O SSE vai direto do navegador à API (`NEXT_PUBLIC_API_URL`), sem passar pelo Next.
- Migrações numeradas e imutáveis; `013` é a próxima; `npm run migrar -w @n1/api -- --seco` lista sem escrever. Backup manual do schema `plataforma` antes de aplicar a `013` em produção (o backup diário não está ligado).
- Deploy da API é manual na VM (`publicar.sh`), só quando o dono mandar; a unidade systemd fixa `OUTBOX_WORKER_ATIVO=false` e outras duas e ganha do `api.env`: ligar `MENSAGERIA_WORKER_ATIVO` pede um drop-in como root. `[CITED: memória do projeto deploy-da-api-e-manual-na-vm; apps/api/deploy/n1-crm-api.service, linhas "Environment=OUTBOX_WORKER_ATIVO=false"]`
- Gate: `npm run check` em Docker (13–17 min no remoto; ~3 min no Postgres local). Flakes de baseline: `outbox-worker.test.ts` h–k e `colunas-geradas.test.ts`. `[CITED: memória gsd-gate-de-testes-baseline]`
- `workflow.nyquist_validation` ausente/true e `security_enforcement: true`, `security_asvs_level: 1`, `security_block_on: high` em `.planning/config.json` → seções Validation Architecture e Security Domain obrigatórias.
- Escrever só a prosa em português de produto na tela; `CONTEXT.md` da raiz deve ser atualizado ao fim da fase (nasce `apps/api/src/mensageria/`, a `013`, `GET /eventos`).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Regras do recebimento (reabrir ou abrir, RN-CON-13), próximo status, validar anexo, `conexao_confirmada` | Domínio (`packages/dominio`) | — | Tela e endpoint aplicam a mesma função; "o que a coisa é" |
| Webhook por Canal, verificação do segredo, limite de taxa | API (`apps/api`) | nginx (opcional) | Autenticação de rota pública e dado de terceiros |
| Fila de entrada (`webhooks_recebidos`) e processador | API + Banco | — | `for update skip locked` no Postgres |
| Fila de saída (outbox) e entregador | API + Banco | — | Mesma transação da Mensagem (`gravarEventos`) |
| Cliente e tradutor da Evolution | API | — | Entrada e saída de rede, nunca no domínio |
| Cofre (segredo do webhook, chave da instância) | API + Banco | — | `plataforma.credenciais`, AES-256-GCM, nenhuma rota devolve segredo |
| `pg_notify`, `LISTEN`, SSE e filtro por Espaço/Papel | API | Banco | Regra de acesso fica no `apps/api` (D-16-01) |
| Ouvir eventos, invalidar SWR, reconectar | Navegador (`apps/web`) | — | `fetch` com `Authorization` e leitura em fluxo |
| Anexar, tocar áudio/vídeo/imagem, "Tentar de novo" | Navegador | API (URL assinada) | Bytes sobem direto ao bucket por URL assinada |
| Guardar e baixar mídia | Storage (Supabase) | API | Bucket privado; API confere tipo, tamanho e assinatura |
| Comando `canal:ligar-evolution` | API (CLI) | — | Script de operação, sem tela |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fastify | 5.12.5 | Rotas de webhook, `GET /eventos` (SSE por stream), parser de corpo cru | Já é o servidor; `reply.send(Readable)` entrega SSE sem plugin `[VERIFIED: apps/api/package.json "fastify": "^5.12.5"; node_modules/fastify/package.json:3 "version": "5.12.5"; experimento local]` |
| pg | 8.23.0 | `Client` avulso para `LISTEN` fora do pool, `pg_notify` | Já é o driver `[VERIFIED: node_modules/pg/package.json:3 "version": "8.23.0"; experimento local de LISTEN/NOTIFY]` |
| @supabase/supabase-js (storage-js 2.116.0) | 2.116.0 | `upload`, `createSignedUrl(..., { download })`, `remove` | Já usado por `storage-uploads.ts` `[VERIFIED: node_modules/@supabase/storage-js/dist/index.d.mts:1025 e :1348-1353 "download?: string \| boolean;"]` |
| zod | ^4.6.5 | Esquemas de rota e do payload do evento (`.strict()`) | Padrão do outbox e das rotas |
| vitest | 5.0.1 | Testes (api, domínio, web) | `[VERIFIED: node_modules/vitest/package.json]` |
| Evolution API (imagem) | v2.3.7 | Provedor de WhatsApp não oficial do dono | Tag fixa no compose; existe no Docker Hub (push 2025-12-05) `[VERIFIED: apps/api/deploy/evolution/docker-compose.yml "image: evoapicloud/evolution-api:v2.3.7"; hub.docker.com/v2/repositories/evoapicloud/evolution-api/tags/v2.3.7]` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `servicos/limite-de-taxa.ts` (`criarLimiteDeTaxa`) | do repositório | Teto por IP e por Canal na própria API | Webhook público (recomendação do item 3) |
| `servicos/cofre.ts` (`guardarCredencial`, `lerCredencial`) | do repositório | Segredo do webhook, chave da instância | Provedor de teste e Evolution |
| `persistencia/outbox-worker.ts` (`backoff`, `sanitizarErro`) | do repositório | Backoff com jitter e saneamento de erro | Os dois workers novos |
| `testes/servidor-falso.ts` | do repositório | Servidor HTTP real para testar o cliente da Evolution | Testes do cliente |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `reply.send(PassThrough)` | `@fastify/sse` ou `reply.hijack()` + `reply.raw` | Plugin novo (dependência a mais); `hijack` perde os cabeçalhos do CORS (precisa copiar `reply.getHeaders()`). O stream nativo mantém o CORS e foi provado |
| Limite de taxa na própria API | `limit_req` no nginx | nginx exige edição manual do dono e a zona por IP derrubaria rajadas legítimas da Evolution (um IP só); API não exige ação do dono |
| Conferir ZIP lendo o diretório central | `jszip`/`fflate`/`yauzl`/`file-type` | Pacote novo e superfície de zip-bomb; ler só os nomes do diretório central não descomprime nada |
| Acordar o worker pela rota | `LISTEN` num segundo canal, ou polling de 500 ms | `LISTEN` só vale com mais de uma instância; polling rápido custa uma consulta por segundo, o dia todo, a ~52 ms cada |

**Installation:** nenhum pacote novo.

**Version verification:** as versões acima foram lidas dos `package.json` instalados nesta sessão. A tag `v2.3.7` da imagem foi confirmada na API pública do Docker Hub (a mais recente estável; `2.4.0-rc1/rc2` e `homolog` são pré-lançamentos) `[VERIFIED: hub.docker.com tags API, 2026-11-09]`.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (nenhum pacote externo novo) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** nenhum (nada foi proposto).
**Packages flagged as suspicious [SUS]:** nenhum.

A fase não instala dependência. `@fastify/rate-limit` e `@fastify/sse` foram avaliados e **rejeitados** (a lista de `node_modules/@fastify` tem apenas `cors`, `type-provider-zod` e utilitários internos do Fastify `[VERIFIED: ls node_modules/@fastify]`). Se o planejador mudar de ideia e instalar qualquer um, deve rodar `package-legitimacy check` e pôr um `checkpoint:human-verify` antes.

## Architecture Patterns

### System Architecture Diagram

```
  ENTRADA                                                       SAÍDA
  celular ──WhatsApp──> Evolution v2.3.7 (VPS própria)           Caixa (aba) ──POST /mensagens──> apps/api
                           │ POST webhook (headers próprios)                                         │ comTransacao
                           │  event=messages.upsert                                   ┌──────────────┴───────────────┐
                           ▼                                                          │ insert mensagens (pendente)  │
   nginx ──> apps/api  POST /webhooks/mensageria/:canalId   (fora do JWT)             │ gravarEventos(mensagem.enviar.v1)
        1. limite de taxa por IP (memória)                                             │ avisarCrm → pg_notify        │
        2. Canal por id (não achou/arquivado → 401)                                    └──────────────┬───────────────┘
        3. segredo do cofre; compara header (tempo constante) + `instance`                           commit
        4. insert webhooks_recebidos(pendente) → 200 → acordar()                                     ▼
                           │                                                  worker de saída (só mensagem.enviar.v1)
                           ▼                                                   reivindica ─> provedorDoCanal(canal).enviar
        processador-de-entrada (skip locked, acordado + poll de reserva)          │ aceito  → id_externo + enviada (+ avisarCrm)
          interpretarChamada → [evento]                                            │ transitório → pending + backoff
          ├ ignorar: fromMe, @g.us, status@broadcast, tipos sem suporte            └ permanente → falhou + motivo_falha
          └ mensagem: baixarMidia (ANTES da tx; teto 16/25 MiB; falha → baixado:false)
                ▼ tx: receberMensagem
                  repetida? → sai | Contato (detentor ou cria) | Conversa (usar/reabrir/abrir)
                  inserirRecebida | avisarCrm(mensagem.nova)  ── commit ──> pg_notify('crm_eventos')

  TEMPO REAL
  pg Client avulso (LISTEN crm_eventos, fora do pool; reconecta; após reconectar emite "ressincronizar")
        └─> hub em memória ─ filtra: Espaço do evento == Espaço da aba; Papel pode `ler conversa`
              └─> GET /eventos (text/event-stream, batida 25 s, X-Accel-Buffering: no, fecha em 45 min)
                    └─> web: fetch + getReader() ─> mutate das chaves (/conversas*, /mensagens?conversaId=, resumo [array])
                         sem conexão: reconecta com espera crescente e relê a cada 5 s
```

### Recommended Project Structure

```
packages/dominio/src/crm/
├── recebimento.ts        # destinoDaRecebida, contatoDaRecebida (3.6.2)  [novo]
├── mensagens.ts          # + proximoStatusDeEntrega, AnexoDaMensagem(objectKey,tamanhoBytes,baixado), statusInicialDeEnvio → 'pendente'
├── canais.ts             # + AcaoDeConexao 'conexao_confirmada', conferirNumeroConectado
└── midia.ts              # categoriaDaMidia(mime) → Attachment["mediaType"] (para sendableMediaTypes)  [novo]
apps/api/migracoes/013-mensageria.sql                 # webhooks_recebidos + índice único mensagem.enviar.v1 + bloco "desligar RLS"
apps/api/src/mensageria/
├── provedor.ts, registro.ts, provedor.test.ts        # interface, provedorDoCanal, testes de contrato (3.6.1)
├── provedores/teste.ts                               # só Canal conexao_simulada (D-16-03)
├── provedores/evolution/{cliente,traduzir,provedor}.ts (+ .test.ts, exemplos/)
├── processador-de-entrada.ts                         # worker (acordar() + poll de reserva)
├── entregar-mensagem.ts                              # entregador do segundo worker
├── midia.ts                                          # baixar do provedor → validar → subir ao bucket
├── avisar.ts                                         # avisarCrm(cliente, evento)
├── ouvinte-pg.ts + hub-de-eventos.ts                 # LISTEN com reconexão; assinantes SSE
apps/api/src/servicos/crm/recebimento.ts              # receberMensagem (3.6.2)
apps/api/src/rotas/webhooks-de-mensageria.ts          # POST /webhooks/mensageria/:canalId
apps/api/src/rotas/eventos.ts                         # GET /eventos
apps/api/src/rotas/crm/mensagens.ts                   # + /mensagens/anexos, /:id/reenviar, /:id/anexos/:indice
apps/api/src/bootstrap/canal-ligar-evolution.cli.ts   # D-16-05 ; canal-segredo-de-teste.cli.ts (D-16-03)
apps/web/src/dados/tempo-real.ts                      # leitor SSE + invalidação
```

### Pattern 1: Webhook público com corpo cru e segredo em cabeçalho
**What:** parser de `application/json` por `buffer` **encapsulado no plugin da rota** (como `webhook-meta.ts:145`), `config: { publica: true }`, e comparação por hash + `timingSafeEqual` (como `iguais` em `webhook-meta.ts:63-68`).
**When to use:** `POST /webhooks/mensageria/:canalId`. O corpo cru só é necessário a provedores que assinam o corpo (Meta, Sessões 7/8); a Evolution usa cabeçalho, mas a interface `verificarChamada({ cabecalhos, corpoCru })` já os serve.
**Example:**
```typescript
// Source: padrão de apps/api/src/rotas/webhook-meta.ts (parser encapsulado + iguais()); nomes novos são proposta de design
import { createHash, timingSafeEqual } from "node:crypto";

export const CABECALHO_DO_SEGREDO = "x-n1-webhook-segredo"; // um só nome para Evolution e provedor de teste

const iguais = (a: string, b: string) =>
  timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());

export async function rotasDeWebhooksDeMensageria(app: FastifyInstance, deps: Deps): Promise<void> {
  // Encapsulado: registrar o mesmo content-type parser duas vezes na MESMA instância é erro do Fastify.
  app.addContentTypeParser("application/json", { parseAs: "buffer", bodyLimit: 2 * 1024 * 1024 }, (_req, bruto, feito) => {
    try { feito(null, { bruto: bruto as Buffer, json: (bruto as Buffer).length ? JSON.parse((bruto as Buffer).toString("utf8")) : null }); }
    catch { feito(Object.assign(new Error("JSON inválido."), { statusCode: 400 }), undefined); }
  });
  app.post("/webhooks/mensageria/:canalId", { config: { publica: true } }, async (request, reply) => {
    // 1) limite por IP (memória) ANTES de tocar o banco; 2) Canal por id; 3) cofre; 4) iguais(); tudo que falha = a MESMA 401
    // 5) insert em webhooks_recebidos; 6) reply 200; 7) deps.acordarProcessador()  (nunca processar aqui dentro)
  });
}
```

### Pattern 2: Fila de entrada com recuperação de trava vencida
**What:** o molde de `reivindicar` (`outbox-worker.ts:157-175`) **mais** o que o worker velho não tem: devolver a `pendente` as linhas `processando` com `locked_at` vencido.
**Example:**
```sql
-- Source: molde de outbox-worker.ts:157-175; colunas conforme 3.6.4 (proposta para a 013)
update plataforma.webhooks_recebidos
   set estado = 'pendente', locked_at = null, locked_by = null
 where estado = 'processando' and locked_at < now() - interval '2 minutes';

update plataforma.webhooks_recebidos
   set estado = 'processando', locked_at = now(), locked_by = $1, tentativas = tentativas + 1
 where id = (
   select id from plataforma.webhooks_recebidos
    where estado = 'pendente' and disponivel_em <= now()
    order by disponivel_em, id
    limit 1
      for update skip locked)
returning *;
```

### Pattern 3: Enfileirar e reenfileirar `mensagem.enviar.v1` sem violar o índice único
**What:** `gravarEventos` (`outbox.ts`) faz `insert` simples: a segunda inserção da mesma Mensagem viola o índice único da 3.7.1 e desfaz a transação. "Tentar de novo" e a reenfileirada por Canal que volta a `conectada` precisam de função própria com `on conflict ... do update`, que **repete o predicado do índice parcial**.
**Example:**
```sql
-- 013: o mesmo desenho do índice da 006 (integration_outbox_notificar_canal_uniq), para o novo evento
create unique index if not exists integration_outbox_mensagem_enviar_uniq
  on plataforma.integration_outbox (workspace_id, aggregate_type, aggregate_id, event_type)
  where event_type = 'mensagem.enviar.v1';

-- reenfileirar (tentar de novo / Canal voltou): reusa a linha, zera a contagem
insert into plataforma.integration_outbox (workspace_id, aggregate_type, aggregate_id, event_type, payload)
values ($1, 'mensagem', $2, 'mensagem.enviar.v1', $3::jsonb)
on conflict (workspace_id, aggregate_type, aggregate_id, event_type) where event_type = 'mensagem.enviar.v1'
do update set status = 'pending', attempts = 0, available_at = now(), locked_at = null, locked_by = null,
              last_error_code = null, last_error_summary = null;
```

### Pattern 4: SSE com `reply.send(PassThrough)` (provado)
**What:** devolver um `PassThrough` faz o Fastify aplicar os cabeçalhos já definidos (inclusive os do `@fastify/cors`) e o `request.raw.on("close")` limpa o assinante.
**Example:**
```typescript
// Source: experimento local (scratchpad/sse/teste-sse.mjs) com fastify 5.12.5 + @fastify/cors; nomes de rota/hub são proposta
app.get("/eventos", async (request, reply) => {
  const membro = request.membro; // o hook de JWT (onRequest) já rodou
  const fluxo = new PassThrough();
  reply
    .header("content-type", "text/event-stream; charset=utf-8")
    .header("cache-control", "no-cache, no-transform")
    .header("x-accel-buffering", "no");
  fluxo.write(": aberto\n\n");
  const batida = setInterval(() => fluxo.write(": batida\n\n"), 25_000);
  const sair = hub.assinar({ workspaceId: membro.workspaceId, membroId: membro.id, enviar: (e) => fluxo.write(`data: ${JSON.stringify(e)}\n\n`) });
  const encerrar = () => { clearInterval(batida); sair(); fluxo.end(); };
  request.raw.on("close", encerrar);
  setTimeout(encerrar, 45 * 60_000).unref(); // o JWT do Supabase vale ~1 h: a aba reconecta com token novo
  return reply.send(fluxo);
});
```

### Pattern 5: Ouvinte `LISTEN` com reconexão e "ressincronizar"
**What:** `pg.Client` avulso com o mesmo TLS do pool (`construirSsl`, `persistencia/conexao.ts`), sem `query_timeout`, com `keepAlive`. Ao cair, o cliente emite `error` e depois `end` (provado). Depois de reconectar e refazer o `LISTEN`, avisar todos os assinantes com `{ tipo: "ressincronizar" }`: notificações do intervalo se perderam.
**Example:**
```typescript
// Source: experimento local (teste-notify.mjs): "error:terminating connection due to administrator command", "error:Connection terminated unexpectedly", "end"
async function ouvir(url: string, aoEvento: (payload: string) => void, aoRessincronizar: () => void) {
  let espera = 1_000;
  for (;;) {
    const c = new Client({ connectionString: url, keepAlive: true, ssl: construirSsl({ connectionString: url }) });
    const caiu = new Promise<void>((r) => { c.on("error", () => r()); c.on("end", () => r()); });
    try {
      await c.connect();
      c.on("notification", (m) => m.payload && aoEvento(m.payload));
      await c.query("LISTEN crm_eventos");
      aoRessincronizar();           // também na PRIMEIRA vez: barato, e cobre o intervalo entre "abrir a aba" e "ouvir"
      espera = 1_000;
      await caiu;
    } catch { /* cai no backoff abaixo */ }
    await c.end().catch(() => undefined);
    await new Promise((r) => setTimeout(r, espera)); espera = Math.min(espera * 2, 30_000);
  }
}
```

### Pattern 6: Leitor SSE na web
**What:** `fetch` com `Authorization`, `getReader()` e `TextDecoder`; reconexão com espera crescente; sem conexão, relê as chaves a cada 5 s. O `EventSource` não manda cabeçalho (decisão já tomada).
```typescript
// Source: API do navegador (fetch + ReadableStream); padrão de chamarCrm (apps/web/src/dados/crm/cliente-crm.ts)
const resposta = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/eventos`, { headers: { authorization: `Bearer ${token}` }, signal });
const leitor = resposta.body!.getReader(); const dec = new TextDecoder(); let resto = "";
for (;;) {
  const { value, done } = await leitor.read(); if (done) break;
  resto += dec.decode(value, { stream: true });
  for (let i; (i = resto.indexOf("\n\n")) >= 0; ) {
    const quadro = resto.slice(0, i); resto = resto.slice(i + 2);
    for (const linha of quadro.split("\n")) if (linha.startsWith("data: ")) aoEvento(JSON.parse(linha.slice(6)));
  }
}
```

### Anti-Patterns to Avoid
- **Processar dentro da requisição do webhook:** a Evolution aguarda a resposta (timeout padrão de 30 s) e retenta; grave, responda 200 e acorde o worker.
- **Subir a revisão do Espaço (`avancarRevisaoDoEspaco`) em `receberMensagem`:** travaria a linha do Espaço a cada mensagem recebida e faria toda aba reidratar o Espaço inteiro (o `AcompanhanteDaRevisao` relê quando a revisão muda). As tabelas do CRM não mexem na revisão; o SSE é o aviso.
- **Logar `corpo`/`payload` do webhook:** `webhook-meta.ts:128` loga `payload: corpo?.json`; **não copiar** esse log (dado pessoal). Logar só ids e contagens.
- **Seguir a `url` que vem no payload de mídia:** é o CDN cifrado do WhatsApp; use `getBase64FromMediaMessage`.
- **Registrar o parser de corpo cru no plugin de `rotasDeCrm`:** ele herdaria o hook `recusarSuspensoNaEscrita` e o JWT; o webhook é plugin próprio, irmão.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Comparação de segredo | `===` | `timingSafeEqual` sobre sha-256 (`iguais`, `webhook-meta.ts:63`) | Tempo constante e tamanhos iguais |
| Backoff e saneamento de erro | Escada nova | `backoff()` e `sanitizarErro()` de `outbox-worker.ts` (acrescentar o padrão `apikey`) | Já testados (n, m); `sanitizarErro` hoje não conhece `apikey` |
| Limite de taxa | Contador novo | `criarLimiteDeTaxa` (`servicos/limite-de-taxa.ts`) | Janela deslizante em memória já provada |
| Segredo/chave de provedor | Coluna em texto | `guardarCredencial`/`lerCredencial` (`servicos/cofre.ts`) | AES-256-GCM com AAD; nenhuma rota devolve segredo |
| Upload do navegador | Rota que recebe bytes | `abrirSessaoDeUpload` + `emitirTicket` + `envio-ao-bucket.ts` | Bytes vão direto ao bucket por URL assinada |
| Acha-ou-cria Contato | Busca nova | `detentorDoIdentificador` + `normalizarIdentificadorDeContato` | Já seguem a mescla (o Identificador do mesclado vive no sobrevivente) |
| Transação do CRM | `begin/commit` à mão | `comTransacao` (`servicos/crm/transacao.ts`) | Traduz SQLSTATE e devolve o cliente ao pool |
| Descompactar Office para validar | `jszip`/`unzip` | Ler só o diretório central (EOCD + nomes) | Sem descompressão não há zip-bomb |

**Key insight:** quase tudo que a fase precisa já existe como peça pequena (cofre, outbox, sessão de upload, limitador, servidor falso). O trabalho novo é a *costura*: filtrar tipo de evento no worker velho, três pontos de gravação de `enviada`, e a invalidação SWR de chave array.

## Respostas ao foco da pesquisa

### 1. Evolution API v2.3.7

**Versão.** `image: evoapicloud/evolution-api:v2.3.7` `[VERIFIED: apps/api/deploy/evolution/docker-compose.yml, serviço evolution-api]`; a tag existe no Docker Hub (push 2025-12-05) e é a última estável (`[VERIFIED: hub.docker.com tags API]`). Usa `baileys` `7.0.0-rc.9` `[CITED: raw.githubusercontent.com/EvolutionAPI/evolution-api/2.3.7/package.json:80]`. A versão realmente rodando na VPS do dono é `[ASSUMED]` igual à do compose: `GET /` da instância devolve `version` (`[CITED: src/api/routes/index.router.ts@2.3.7:196-204]`); o dono confere num `curl`.

**`headers` no webhook (D-16-06): SIM, aceito.** `[CITED: src/api/integrations/event/webhook/webhook.schema.ts@2.3.7]` e `webhook.controller.ts@2.3.7`. Corpo (embrulhado em `webhook`, obrigatórios `enabled` e `url`):
```json
POST {EVOLUTION_URL}/webhook/set/{instancia}      header: apikey
{ "webhook": { "enabled": true,
               "url": "https://<api-publica>/webhooks/mensageria/<canalId>",
               "headers": { "x-n1-webhook-segredo": "<hex 32 bytes>" },
               "byEvents": false, "base64": false,
               "events": ["MESSAGES_UPSERT"] } }
→ 201 com a linha salva (url, headers, events, webhookByEvents, webhookBase64)
```
O controlador faz `axios.create({ baseURL, headers: webhookHeaders, timeout: ... 30000 })`, então o cabeçalho vai em **toda** chamada. `byEvents: true` anexaria `/messages-upsert` à URL: manter `false`. `events` usa o nome em maiúsculas com sublinhado; o campo `event` do corpo chega em minúsculas com ponto (`messages.upsert`) `[CITED: wa.types.ts@2.3.7 "MESSAGES_UPSERT = 'messages.upsert'"]`. `Webhook.url` é `VarChar(500)`. **Não há fallback a desenhar.**

**Comportamento de entrega (importa para a idempotência).** Até 10 tentativas, espera inicial 5 s dobrando até 300 s com jitter, e **não retenta** 400/401/403/404/422 `[CITED: webhook.controller.ts@2.3.7 retryWebhookRequest]`. Consequência: a 401 do nosso webhook não é reenviada (bom), e um 5xx nosso por alguns minutos é recuperado pela Evolution; passou de ~20 min, perde-se. **O `insert` em `webhooks_recebidos` é o ponto de não retorno.**

**Formato do corpo do webhook.** `{ event, instance, data, destination, date_time, sender, server_url, apikey }`. `sender` é o JID do número conectado; `apikey` é o token da instância **só se** `AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES=true` (o exemplo do repositório tem `false`, logo `null`); `date_time` é a hora local com sufixo `Z` (**não usar**: use `data.messageTimestamp`, segundos Unix) `[CITED: channel.service.ts@2.3.7:435-464]`.

**`MESSAGES_UPSERT` (`data`).** Montado por `prepareMessage` `[CITED: whatsapp.baileys.service.ts@2.3.7:4652-4710]`:
`key { remoteJid, fromMe, id, participant?, remoteJidAlt?, addressingMode? }`, `pushName`, `status`, `message`, `contextInfo`, `messageType`, `messageTimestamp`, `instanceId`, `source`.
- **Texto:** `message.conversation` (o `extendedTextMessage` é achatado para `conversation`; `messageType` vira `"conversation"`).
- **Imagem/vídeo:** `message.imageMessage` / `videoMessage` com `caption`, `mimetype`.
- **Áudio (PTT):** `message.audioMessage` com `mimetype` (`audio/ogg; codecs=opus`, **com parâmetro**), `seconds`, `ptt`.
- **Documento:** `message.documentMessage` (o `documentWithCaptionMessage` é achatado) com `fileName`, `mimetype`, `caption`.
- `url` dentro de cada mídia é o CDN **cifrado** do WhatsApp: inútil para baixar direto.
- `pushName` cai em `'Você'` (fromMe), em `participant`, no pedaço antes do `@` do `key.participant`, ou `null`: sem nome, usar o número.
- O handler também emite grupos (`@g.us`), `status@broadcast`, `protocolMessage` (edição/revogação), reações e enquetes como `MESSAGES_UPSERT`; o tradutor deve ignorá-los com motivo explícito.

**Mídia: precisa de chamada extra.** `WEBHOOK_BASE64`/`base64: true` colocaria `message.base64` no corpo (`:1360-1388`), mas isso estoura o `bodyLimit` de 1 MiB do Fastify (não configurado em `app.ts`) e o `client_max_body_size 26M` do nginx para arquivos de 25 MiB e engorda `webhooks_recebidos.corpo`. **Use `base64: false` e `POST /chat/getBase64FromMediaMessage/{instancia}`** `[CITED: chat.router.ts@2.3.7:113-123; whatsapp.baileys.service.ts:3837-3979]`:
```json
{ "message": { "key": { "id": "...", "remoteJid": "...", "fromMe": false }, "message": { "audioMessage": { "...": "o objeto message vindo do webhook" } } },
  "convertToMp4": false }
→ 201 { "mediaType": "audioMessage", "fileName": "<id>.ogg", "caption": null, "size": { "fileLength": ..., "height": ..., "width": ... },
        "mimetype": "audio/ogg; codecs=opus", "base64": "..." }
```
Se o corpo mandar só `key.id`, a Evolution procura a mensagem **no banco dela** (`getMessage`, `:523-535`), que só tem linha se `DATABASE_SAVE_DATA_NEW_MESSAGE=true` (`env.config.ts:491`: `=== 'true'`, padrão falso, e a chave **não está** em `evolution.env.example`). Por isso o adaptador deve mandar o `message` do webhook (o `message.message` é usado direto quando existe, `:3842`). Que a ida e volta do `mediaKey` serializado funcione na instância real é `[ASSUMED]` (A2): o spike da prova ao vivo confirma. `convertToMp4: true` só vale para áudio e converte para `audio/mp4` com ffmpeg (a imagem traz ffmpeg `[CITED: Dockerfile@2.3.7 linhas 4 e 36]`); é a saída para Safari antigo (item 4).

**Envio.** Todos `POST {EVOLUTION_URL}/message/<rota>/{instancia}` com `apikey`, resposta **201** com a mensagem enviada (`key.id` é o `id_externo`) `[CITED: sendMessage.router.ts@2.3.7; whatsapp.baileys.service.ts:2425-2543]`:

| Rota | Corpo mínimo | Observação |
|------|--------------|------------|
| `sendText` | `{ "number": "<dígitos>", "text": "..." }` | texto vazio → 400 |
| `sendMedia` | `{ "number", "mediatype": "image\|video\|document\|audio", "media": "<URL ou base64>", "mimetype"?, "fileName"?, "caption"? }` | documento em base64 exige `fileName`; aceita URL (a assinada do bucket) |
| `sendWhatsAppAudio` | `{ "number", "audio": "<URL ou base64>" }` | `encoding` padrão `true`: ffmpeg converte para ogg/opus e sai como **mensagem de voz** |

Resposta (de `prepareMessage`): `{ "key": { "remoteJid": "...", "fromMe": true, "id": "3EB0..." }, "status": "...", "message": {...}, "messageType": "...", "messageTimestamp": ..., "instanceId": "...", "source": "..." }`. Número que não está no WhatsApp → **400** (`sendMessageWithTyping`: `if (!isWA.exists ...) throw new BadRequestException(isWA)`): classificar como **permanente** ("Este número não tem WhatsApp"). Não mande `delay` (simula digitação e alonga a resposta). O formato de `number` (só dígitos, sem `+`) é `[ASSUMED]` (A3): a prova ao vivo confirma.

**`@lid`.** O handler faz `if (messageRaw.key.remoteJid?.includes('@lid') && messageRaw.key.remoteJidAlt) { messageRaw.key.remoteJid = messageRaw.key.remoteJidAlt; }` antes de emitir o webhook `[CITED: whatsapp.baileys.service.ts@2.3.7:1478-1480]`. Então, com `remoteJidAlt` presente, o `remoteJid` do webhook **já é** o número (`<dígitos>@s.whatsapp.net`). Sem `remoteJidAlt` o `remoteJid` continua `…@lid` e **não há número** (campo `senderPn` não existe nesta versão: só `remoteJidAlt` e `participantAlt` aparecem na fonte). Regra do tradutor: se não sair um número, **não criar Contato**: marcar o webhook `processado` com motivo `sem_numero` e logar o id. Se o número do dono cair nesse caso é `[ASSUMED]` (A4) e só a prova ao vivo diz.

**`fromMe` e eco (a decisão em aberto): recomendo IGNORAR `fromMe` nesta fase.** Evidência: o socket é criado com `emitOwnEvents: false` `[CITED: whatsapp.baileys.service.ts@2.3.7:658]`, então o que a plataforma envia pela API **não** volta como `MESSAGES_UPSERT`; a Evolution emite só `SEND_MESSAGE` (que não será assinado). Um `fromMe: true` em `MESSAGES_UPSERT` é, portanto, mensagem digitada no celular ou em outro aparelho vinculado, ou histórico `append` na reconexão. Tratá-la como a 4.4.2 item 3 criaria `enviada` com Contato novo vindo de histórico antigo; ignorar não duplica nada e custa só a mensagem digitada no celular, que a decisão D-16-04 já aceita adiar. Defesa em profundidade: o índice `mensagens_id_externo_uq` (008:194-195) já descartaria uma `id` igual.

**Número conectado, `apikey` e estado.**
- `GET /instance/fetchInstances?instanceName=<nome>` com a **chave global** devolve a lista de linhas `Instance` do banco da Evolution, com `ownerJid` (`<dígitos>@s.whatsapp.net`), `number`, `connectionStatus` e `token` (a chave da instância) `[CITED: instance.controller.ts@2.3.7:402-430; monitor.service.ts:86-130; schema.prisma model Instance]`. `ownerJid` é gravado incondicionalmente ao abrir a conexão (`whatsapp.baileys.service.ts:493`).
- `GET /instance/connectionState/{instancia}` → `{ "instance": { "instanceName", "state": "open" | "close" | "connecting" } }` `[CITED: instance.controller.ts:393-400]`.
- `apikey` aceita a **global** (`AUTHENTICATION_API_KEY`) **ou** o `token` da instância nas rotas com `{instancia}` `[CITED: auth.guard.ts@2.3.7]`. **Recomendo:** o comando usa `EVOLUTION_API_KEY` (global) só para descobrir `ownerJid` e `token`, e **guarda no cofre o token da instância**, não a global: a global cria e apaga instâncias, inclusive a `numeropvmarcos`. Se `token` vier nulo, é o único caso em que se guardaria a global (decisão do dono).
- Conferência do número: `ownerJid` → `+<dígitos>` contra `canal.identificadorExterno` (forma `+55…`, `identificadorCanonico`, `packages/dominio/src/operations/canais.ts:66-71`); com 12/13 dígitos brasileiros comparar com e sem o nono dígito (a 4.4.3 é da Sessão 4, mas a conferência não pode recusar o número certo).

### 2. LISTEN/NOTIFY + SSE (D-16-01)

Provado em Postgres 16 de Docker com o `pg` 8.23.0 (experimento `scratchpad/sse/teste-notify.mjs`):
- antes do `commit`: nada chega; depois: chega; depois de `rollback`: nada;
- duas chamadas com o **mesmo** canal e payload dentro de uma transação viram **uma** (`["igual","outro"]`); payloads distintos chegam todos;
- payload de 8000 bytes: `22023 payload string too long`; 7999: ok (`[CITED: postgresql.org/docs/16/sql-notify.html: "must be shorter than 8000 bytes"]`);
- ao matar o backend do `LISTEN`: o `Client` emite `error` (duas vezes) e `end`.

Outros fatos `[CITED: postgresql.org/docs/16/sql-notify.html]`: a fila de notificações tem 8 GB e, **cheia, os commits que chamam `NOTIFY` falham**; um ouvinte parado que não consome a segura. O ouvinte precisa consumir sempre (nunca bloquear dentro do handler).

**Pooler.** Supabase documenta a porta 5432 (Supavisor, modo sessão) como a que suporta `LISTEN/NOTIFY` e a 6543 (transação) como a que não suporta `[CITED: supabase.com/docs/guides/self-hosting/accessing-postgres]`. A produção já usa 5432 (`apps/api/.env.example`). Falta só provar no pooler real com o papel `n1_api` (A9): um spike de 10 linhas na Onda 0 (`LISTEN` + `NOTIFY` por `DATABASE_URL`). O orçamento de conexões: pool de 10 (`conexao.ts` `criarPool(…, 10)`) + 1 do ouvinte.

**SSE no Fastify 5.12.5 (provado).** `reply.header(...)` + `reply.send(PassThrough)` entrega o fluxo, mantém `Access-Control-Allow-Origin` do `@fastify/cors` e `request.raw.on("close")` dispara ao abortar o cliente (`teste-sse.mjs`: `acao http://localhost:3001`, `xab no`, `request.raw close: true stream closed: true`). `reply.hijack()` + `reply.raw` **não** traz os cabeçalhos do CORS sozinho (copiar `reply.getHeaders()`).
- **Interação com o hook de JWT:** `GET /eventos` registrado na raiz (ou em plugin filho) herda o `onRequest` que verifica o token e preenche `request.membro`; **não** marcar `publica`. O Membro suspenso passa (`METODOS_DE_LEITURA` inclui GET), como na leitura do CRM.
- **CORS:** `Authorization` não é cabeçalho simples, então o navegador faz preflight; `allowedHeaders` já inclui `authorization` e `methods` inclui `GET` (`app.ts:199-203`). Nada a mudar.
- **Desligamento (provado):** com um SSE aberto, `app.close()` **fica pendurado** (4 s sem terminar, mesmo com `end()` no hook `onClose`), e a unidade systemd mata em 20 s (`TimeoutStopSec=20`). O que funciona: **encerrar todos os streams antes de `app.close()`** (`fechou 1 ms`) ou `forceCloseConnections: true` (aborta também requisições comuns em voo). Recomendo o primeiro: `hub.encerrarTodos()` registrado em `aoEncerrar` de `index.ts`, que roda antes do `app.close()` da desmontagem.
- **nginx:** o `location /` de `nginx-n1-crm-api.conf` já usa HTTP/1.1 e `proxy_read_timeout 120s`; a batida de 25 s cabe. `X-Accel-Buffering: no` na resposta desliga o buffer do nginx para aquela resposta (`[ASSUMED]` A6, a prova é o `provar-nginx.sh`).
- **JWT longo:** o token é conferido só ao abrir. O servidor fecha o fluxo em 45 min (o JWT do Supabase vale cerca de 1 h) e a aba reabre com `getSession()` já renovado. Reconferir o Papel do Membro a cada ~60 s (`exigir(..., "ler", "conversa")` lê o Papel do banco a cada chamada, `acesso.ts`) para uma remoção/suspensão cortar o fluxo.
- **"Conversas que o Membro pode ler":** `podeNoCrm(..., "ler", ...)` é por Papel e estado (`ativo`/`suspenso`), **sem ACL por Conversa** `[VERIFIED: packages/dominio/src/crm/permissoes.ts:66-67 "if (estado === \"ativo\" || estado === \"suspenso\") return undefined;"]`. O filtro do hub é, portanto: `evento.workspaceId === membro.workspaceId` e Papel que pode `ler` `conversa`.
- **Limite por Membro:** limitar a ~5 fluxos simultâneos por Membro (aba esquecida) e derrubar o mais antigo.

### 3. Webhook cru e limite de taxa (3.6.3)

**Corpo cru.** O Fastify instalado aceita `addContentTypeParser("application/json", { parseAs: "buffer" }, ...)` dentro de um plugin encapsulado, que é o que `webhook-meta.ts:145-153` faz hoje `[VERIFIED: apps/api/src/rotas/webhook-meta.ts:145]`. O novo webhook deve ser **outro plugin irmão** (registrar o mesmo parser duas vezes na mesma instância é erro; o comentário de `webhook-meta.ts` já avisa). O app remove `text/plain` globalmente (`app.ts:137`). `bodyLimit` por rota: o padrão de 1 MiB basta para texto; fixar `2 MiB` na rota e **não** ligar `base64`.

**Rate limit: existe?** Não. `node_modules/@fastify` não tem `rate-limit` `[VERIFIED: ls node_modules/@fastify → cors, type-provider-zod, ...]`. **Recomendo teto na própria API** com `criarLimiteDeTaxa` (já existe, janela deslizante em memória, `servicos/limite-de-taxa.ts`), em duas camadas:
1. **antes** de qualquer consulta, por `request.ip` (`TRUST_PROXY=loopback` já faz o IP ser o real): generoso, na ordem de 300/min, porque a Evolution chama de **um IP só** e em rajadas (histórico, vários eventos) e **429 é retentado** por ela; o objetivo é cortar enxurrada antes do cofre e do banco, não limitar uso legítimo;
2. nenhum teto por Canal depois da autenticação além do `bodyLimit` (o Canal já é verificado e o custo é um `insert`).
Custo de cada opção: **nginx** exigiria edição manual do dono (como a 09-20), uma zona `limit_req` nova e a mesma rajada legítima da Evolution cairia no balde por IP; **API** não exige ação do dono, perde se houver mais de uma instância (a restrição já documentada em `limite-de-taxa.ts`) e protege só depois de o Node aceitar a conexão. O nginx de `/v1/public/` não cobre `/webhooks/` e ninguém precisa mascarar log: com o segredo em cabeçalho, a URL só tem o `canalId`.

**Mesma 401.** Canal inexistente/arquivado, segredo errado e `instance` diferente voltam a mesma resposta. Para não deixar o tempo revelar a existência do Canal, rodar sempre uma comparação (contra um valor fixo quando não há Canal). `plataforma.canais` tem PK `(workspace_id, id)` (008): buscar por `id` e exigir **exatamente uma** linha ativa; zero ou duas → 401.

**Segredo do Canal simulado (D-16-03).** Para um Canal `conexao_simulada = true`, o segredo vive no cofre (`donoTipo: "canal"`, tipo próprio, `guardarCredencial`). Quem gera e mostra? Recomendo um comando `npm run canal:segredo-de-teste -w @n1/api -- --canal <id>` (recusa Canal que não seja simulado; imprime o segredo **uma vez**, como `credencial emitir`), em vez de `simularConexao` mexer no cofre: mantém o serviço de Canais sem cofre. Nos testes, o segredo vem de `guardarCredencial` direto.

### 4. Mídia (3.9)

**Reaproveitamento de `storage-uploads.ts`.** Hoje `TIPOS_ACEITOS` tem seis tipos `[VERIFIED: apps/api/src/servicos/storage-uploads.ts:53-60 "\"application/pdf\", \"application/xml\", \"text/xml\", \"image/jpeg\", \"image/png\", \"image/webp\""]`, e três funções usam **a constante direta**: `emitirTicket` (`tipoAceito`), `confirmarObjeto` (`tipoAceito(tipoDeclarado)`) e a rota do Formulário. Para a lista própria da Mensagem (D-16-09) sem alargar o Formulário: parametrizar `tipoAceito(mediaType, lista = TIPOS_ACEITOS)`, `emitirTicket` e `confirmarObjeto` por uma lista recebida (padrão = a atual) e `gerarObjectKey` por um prefixo recebido. `assinaturaConfereComTipo` ganha casos novos (`OggS`, `ID3`/`0xFF 0xFB`, `ftyp` no byte 4, `PK\x03\x04`).
- `confirmarObjeto` baixa o objeto **inteiro** para a memória (`armazenamento().download`) e confere `subarray(0, 4096)`; com teto de 25 MiB é aceitável, e é o que permite ler o diretório central do ZIP sem outra ida ao bucket. `TETO_SHA256_BYTES` (padrão 10 MiB) só decide o hash.
- Tetos (D-16-08): `MAX_BYTES_POR_ARQUIVO` hoje é um número só (`UPLOAD_MAX_BYTES`, 25 MiB); acrescentar `UPLOAD_MAX_BYTES_MIDIA` (16 MiB) escolhido pelo prefixo do tipo (`audio/`, `video/`). O `tamanhoAceito` precisa receber o tipo.

**Como a lista da Mensagem convive com a do Formulário.** A do Formulário continua em `TIPOS_ACEITOS` (usada por `formularios-publicos.ts` e `anexos-da-tarefa.ts`); a nova `TIPOS_ACEITOS_NA_MENSAGEM` é outra constante. **Na web**, `TIPOS_DE_ARQUIVO_ACEITOS`, `ACEITAR_NO_SELETOR` e `COPY_FORMATOS_ACEITOS` de `envio-ao-bucket.ts` são os do Formulário e da Tarefa: o compositor precisa de lista própria, derivada de `sendableMediaTypes` do Canal, para não alargar o Formulário por engano.

**docx/xlsx/pptx/zip além de `PK`.** Recomendo uma função pura `familiaDoZip(bytes)` que acha o *End of Central Directory* no fim do arquivo, lê só os **nomes** das entradas do diretório central e confere: `[Content_Types].xml` presente e prefixo `word/` (docx), `xl/` (xlsx) ou `ppt/` (pptx); `application/zip` genérico só pede `PK` e um diretório central consistente. Nada é descomprimido. A estrutura do ZIP e o que o Office grava são `[ASSUMED]` (A7, especificação PKWARE de memória): o teste usa arquivos reais gerados na própria suíte. Sem pacote novo.

**csv/txt "só se for texto".** Sem assinatura: conferir os primeiros 4096 bytes sem `NUL` e sem controles C0 além de `\t \n \r \f`. **Não** exigir UTF-8 estrito: CSV exportado de Excel brasileiro costuma sair em Windows-1252 com `;` `[ASSUMED]` (A7).

**Baixar mídia do provedor.** O adaptador chama a **Evolution** (URL fixa `EVOLUTION_URL`) e recebe base64: não há URL do provedor para seguir, logo não há SSRF de saída nesta fase. Regras: `AbortSignal.timeout` na chamada; limite de bytes **lendo o corpo em fluxo** e abortando ao passar de `ceil(teto × 4/3) + folga` (a Evolution responde o arquivo inteiro em base64); rejeitar `base64` que não decodifique; conferir assinatura contra o tipo **decodificado**, não o declarado; normalizar o `mimetype` tirando parâmetros (`audio/ogg; codecs=opus` → `audio/ogg`). A interface `baixarMidia` das Sessões 7 e 8 (Meta devolve URL) precisa documentar que a implementação só segue hosts fixos do provedor.

**Chave do objeto e órfãos.** A D-16 fixa `workspace/<ws>/conversas/<conversaId>/<uuid>`, mas na entrada o download acontece **antes** da transação, quando a Conversa pode ainda não existir (Contato novo). Recomendo, só para a mídia **recebida**, a chave `workspace/<ws>/entrada/<canalId>/<uuid>` e autorizar o download pela **linha da Mensagem** (Espaço e Conversa legível), nunca pelo prefixo da chave; o prefixo `conversas/…` fica para o envio pela Caixa (a Conversa existe). Órfão da entrada (objeto subido e transação que falhou): `coletarOrfaos` só conhece sessões de upload; para a entrada, listar o prefixo `entrada/` e remover o que tem mais de 1 h **e** não está em nenhum `mensagens.anexos->>'objectKey'`. `[ASSUMED]` que a listagem do bucket traz `created_at` (confirmar no spike).

**Download como anexo.** `createSignedUrl(path, ttl, { download: nome })` força `Content-Disposition: attachment` `[VERIFIED: node_modules/@supabase/storage-js/dist/index.d.mts:1348-1353]`. Usar sempre para documento e `application/zip`/`xml`; áudio, vídeo e imagem usam a URL normal para o `<audio>/<video>/<img>`.

**Tocar no navegador.** `audio/ogg` (Opus) toca em Chrome, Firefox e Edge; no Safari o suporte a Ogg/Opus é recente e o relato é de comportamento irregular mesmo no 18.4 `[CITED: pesquisa web 2026-11-09: frequal.com "OggOpusStillNotWorkingInSafari18_4"; MDN PR 39592]`, então é `[ASSUMED]` (A5) que o áudio de voz do WhatsApp toque no Safari. Saída barata e já suportada: pedir `convertToMp4: true` no `getBase64FromMediaMessage` para `audioMessage` (vira `audio/mp4`, que está na lista), com recuo para o original se a conversão falhar. `video/3gpp` raramente toca no `<video>` (codec 3GP); mostrar link de download como recuo `[ASSUMED]` (A12). Vídeo do WhatsApp é `video/mp4` (H.264).

**Orçamento do critério "< 2 s" com áudio (risco R1).** Cada ida ao banco custa ~52 ms `[CITED: apps/api/src/persistencia/CONTEXT.md, "Idas ao banco"]`. Texto: webhook (insert 1 ida) → acordar → reivindicar (1) → `receberMensagem` (~8–10 idas ≈ 0,5 s) → `pg_notify` → SSE → refetch da web: ordem de 1–1,5 s `[ASSUMED]` (A8). Áudio soma `getBase64` (rede + ffmpeg se `convertToMp4`) e o upload ao bucket (centenas de ms): pode chegar a 2–3 s. Mitigações dentro das decisões: **não** converter por padrão; manter o upload e o download em paralelo com nada mais; agrupar as instruções da transação de entrada (técnica das duas idas, Fase 13); medir com um log por etapa. Se ainda estourar, ver Open Questions.

### 5. Filas (3.6.4, 3.7)

**Como o outbox é hoje.** `[VERIFIED: apps/api/src/persistencia/outbox-worker.ts]`: `reivindicar(cliente, workerId, workspaceId?)` faz `update ... set status='delivering' ... where status = 'pending' and available_at <= now()` com `for update skip locked` (`:157-175`); **sem filtro de `event_type`**. `CAMINHO_POR_EVENTO` (`:63`) mapeia os quatro eventos do `automation/` e cai em `"/webhooks/plataforma/desconhecido"` para qualquer outro (`:231`). `OpcoesOutboxWorker` **não tem** `tiposDeEvento` nem `entregador` (grep sem resultado em `apps/api/src`). `ESCADA_MS = [5_000, 30_000, 120_000, 600_000, 1_800_000]` (`:76`), `maxTentativas ?? 10`, `intervaloMs ?? 5_000`, `timeoutMs ?? 10_000`. **Não há recuperação de `delivering` com `locked_at` vencido**: uma queda no meio deixa a linha presa.

**O que muda:**
1. `OpcoesOutboxWorker` ganha `tiposDeEvento` (inclusivo) **e** o worker velho passa a **excluir** `mensagem.%`: sem isso, com `OUTBOX_WORKER_ATIVO=true` (dev e qualquer dia ligado em produção) o worker velho pega `mensagem.enviar.v1` e a marca `failed` ao receber 404 do `automation/`. Teste novo: com os dois workers vivos, só o segundo toca a linha.
2. `entregador?: (linha) => Promise<ResultadoDeEntrega>` substitui o `fetch` quando presente; `ResultadoDeEntrega = { ok: true, idExterno } | { ok: false, transitorio: boolean, motivo }`.
3. O segundo worker reivindica **e recupera** `delivering` vencido (recomendo 2 min; o envio tem timeout de ~30 s).
4. `EVENTOS` ganha `"mensagem.enviar.v1": z.object({ mensagemId, conversaId, canalId }).strict()` e `NomeDeEvento` (e o `Record` de `CAMINHO_POR_EVENTO`) precisa de entrada ou o tipo deixa de fechar (o Record exige todas as chaves).
5. `gravarEventos` continua para a primeira gravação; **reenfileirar** usa o SQL do Pattern 3.

**Política de erro para não duplicar mensagem ao cliente.** A Evolution **não** deduplica envio (não há id de cliente no `sendText`): um timeout depois de a mensagem ter saído e uma nova tentativa mandam duas. Recomendo: retentar automaticamente só o que certamente **não** foi processado (conexão recusada, DNS, 502/503/504 do nginx, 429); no **timeout/reset ambíguo** gravar `falhou` com o motivo "Sem confirmação do provedor: confira no WhatsApp antes de tentar de novo" e deixar "Tentar de novo" para a pessoa. 400 (inclusive "número sem WhatsApp") e 401/403/404 são permanentes. `[ASSUMED]` (A13): é decisão de produto dentro do "Claude's Discretion" sobre tentativas; o planejador confirma.

**O que a `013` precisa criar.** Próxima livre depois da `012` `[VERIFIED: ls apps/api/migracoes → último arquivo 012-atividade-do-crm.sql]`:
- `plataforma.webhooks_recebidos` (`id`, `workspace_id`, `canal_id`, `provedor`, `corpo jsonb`, `recebido_em`, `estado` `pendente|processando|processado|falhou`, `tentativas`, `disponivel_em`, `locked_at`, `locked_by`, `ultimo_erro`, mais `resultado text` para `ignorado:fromMe`, `sem_numero`…) com índice parcial `(disponivel_em, id) where estado = 'pendente'`;
- o índice único do Pattern 3;
- o bloco "desligar RLS" copiado da 012 `[VERIFIED: apps/api/migracoes/012-atividade-do-crm.sql, final do arquivo]`;
- nada de `grant` (a 009 concede por `alter default privileges`; `banco:conceder` é a rede) e **teste de migração** no molde de `migracao-012.test.ts` (banco descartável, migração interrompida não deixa rastro);
- opcional: índice único `(workspace_id, canal_id, chave)` onde `chave` é `key.id` do evento, para a retentativa da Evolution não empilhar linhas iguais.

### 6. Pontos de integração reais agora

| Arquivo | O que existe | O que falta |
|---------|--------------|-------------|
| `servicos/crm/mensagens.ts` | `enviar` (insere em `:157`, `statusInicialDeEnvio` em `:163`); `registrarRecebida(workspaceId, entrada)` exige `conversaId` e não muda situação | `enviar` grava `mensagem.enviar.v1` no mesmo cliente se o Canal está `conectada` e chama `avisarCrm`; `registrarRecebida` vira o passo 4 de `receberMensagem` (sai da interface) |
| `servicos/crm/conversas.ts` | `abrirConversaNoCliente` insere a primeira Mensagem (`:524-531`, `statusInicialDeEnvio` em `:530`); reusado por `POST /conversas` e por `tarefas-conversacionais.ts` (`:346`, `:409`) | o **mesmo** passo "enfileirar + avisar" aqui, senão a primeira Mensagem e a da Tarefa conversacional nunca saem |
| `servicos/crm/transacao.ts` | `comTransacao(pool, fn, frases)` | nada (o cliente que ela dá é o do `gravarEventos`) |
| `servicos/crm/gesto-misto.ts` | `executarGestoMisto`: `gravarNoCrm` roda em `aoConfirmar` antes do `commit` | `avisarCrm` e `gravarEventos` dentro de `gravarNoCrm` valem (mesmo cliente) |
| `repositorios/crm/mensagens.ts` | `inserir`, `inserirRecebida` (`on conflict (workspace_id, canal_id, id_externo) ... do nothing`), `obterPorIdExterno`, `listar`; `COLUNAS_DE_MENSAGEM` sem `carga_bruta` | `atualizarStatusDeEntrega`, `gravarEnvio(id_externo, status)`, listar `pendente` do Canal, `anexos` com `objectKey` |
| `packages/dominio/src/crm/mensagens.ts` | `STATUS_DE_ENTREGA`, `AnexoDaMensagem {tipoDeMidia, nome, referenciaExterna?}`, `validarNovaMensagem` (exige texto), `statusInicialDeEnvio` devolve `enviada` se `conectada` (`:192-194`) | `proximoStatusDeEntrega`, anexo novo, validar anexo contra `sendableMediaTypes`, `statusInicialDeEnvio` → `pendente` (testes que esperam `enviada` quebram: grep antes) |
| `packages/dominio/src/crm/canais.ts` | `AcaoDeConexao = "simular_conexao" \| "desconectar"` | `conexao_confirmada` e `conferirNumeroConectado` |
| `inbox.reopenWindowHours` | vive em `plataforma.registros`, coleção singular `inbox` `[VERIFIED: packages/dominio/src/colecoes.ts:20 "SINGULARES = [\"workspace\", \"inbox\"]"; persistencia/repositorio.ts:134-135 "if (SINGULARES.has(linha.colecao)) { state[linha.colecao] = linha.dados;"]` | ler com `select dados->>'reopenWindowHours' from plataforma.registros where workspace_id = $1 and colecao = 'inbox'` (padrão 72 h no seed) |
| `apps/web/src/dados/store.ts` | `INTERVALO_DA_REVISAO_MS = 5_000` (`:682`), `AcompanhanteDaRevisao` (`:689`), montado em `StoreProvider` (`:668`) | montar um `AcompanhanteDoTempoReal` ao lado, via `createElement` como o atual |
| `apps/web/src/dados/crm/mensagens.ts` | `useMensagens`, `chaveDasMensagens` (`/mensagens?conversaId=…&limite=…&deslocamento=…`), `enviarMensagem` (invalida `/mensagens` e `/conversas`) | anexos, reenviar, URL de anexo |
| `features/crm/conversation-thread.tsx` | fio com `mensagem.conteudo`, mostra `statusEntrega` cru (` · pendente`); o "anexo" do compositor é só um alternador de tipo, sem arquivo (`:216`, `:1284-1298`) | `<audio>/<video>/<img>`/link, "Tentar de novo", anexar de verdade |
| `apps/web/src/dados/envio-ao-bucket.ts` | `enviarBytesAoBucket`, lista de tipos do Formulário | lista própria da Mensagem |

**Chaves SWR que o tempo real precisa invalidar** `[VERIFIED: apps/web/src/dados/crm/{conversas,mensagens,tarefas-conversacionais}.ts]`:
- `string` `/conversas?…` (lista, filtros, `naoLidas`) e `/conversas/<id>` e `/conversas/aberta-do-par?…`: todas começam por `/conversas` → `invalidarCrm("/conversas")`. O sino de notificações e o contador de não lidas leem `useConversas` (`use-notificacoes.ts:31-32`), então saem de graça;
- `string` `/mensagens?conversaId=<id>&limite=…&deslocamento=…` → invalidar por `/mensagens?conversaId=<id>` (só a Conversa do evento);
- **array** `["/tarefas-conversacionais/resumo", ...assinaturas]` (`tarefas-conversacionais.ts:94`): `invalidarCrm` filtra `typeof chave === "string"` e **não casa**. Criar `invalidarCrmComArrays(prefixo)` (casar também `Array.isArray(chave) && chave[0]` string com o prefixo) ou invalidar essa chave por filtro explícito;
- agrupar eventos (debounce de ~300 ms) para uma rajada não disparar dez refetches.
Fora do escopo por D-16-02: toast, som, título. As chaves `/crm/inicio/*` e `/atividades` não são invalidadas (por desenho dos hooks).

### 7. Segurança (ASVS 1)

Ver `## Security Domain`. Pontos específicos: SSRF só aparece quando o provedor devolve URL (Meta, depois); aqui o adaptador chama host fixo. O `corpo` guardado pode conter o `apikey` do webhook se o dono ligar `AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES`: **tirar `apikey` antes de gravar**. `sanitizarErro` precisa ganhar o padrão `apikey`.

### 8. Testes

- **Sem rede:** `criarServidorFalso` (`testes/servidor-falso.ts`) é um `node:http` real com fila FIFO de respostas (`ok`, `atraso`, `respostaPerdida`, `timeout`) e 500 `SEM_RESPOSTA_PROGRAMADA` quando esvazia. Serve ao cliente da Evolution: um teste por função (`fetchInstances`, `webhook/set`, `sendText`, `sendMedia`, `sendWhatsAppAudio`, `getBase64FromMediaMessage`), 401, 400 "sem WhatsApp", timeout, resposta perdida.
- **Provedor de teste e contrato:** `provedor.test.ts` recebe uma implementação e roda contra o provedor de teste no CI; as Sessões 4, 7, 8 e 9 rodam o mesmo conjunto.
- **Banco:** Postgres 16 de Docker local (`describeComBanco`, `prepararBancoCrm`, `novoEspacoDeTeste`); `vitest.config.mts` roda **um arquivo por vez** (`fileParallelism: false`) e `testTimeout: 180_000`. Convenção de contêiner `crm-n1-pg-<fase><NN>` (a desta fase seria `crm-n1-pg-16NN`, porta `557NN` `[ASSUMED]`).
- **Flakes de baseline:** `outbox-worker.test.ts` casos h–k (e a `colunas-geradas.test.ts` "ordena como dueDate.value" / "planejador escolhe o índice") falham sob a suíte cheia e passam isolados em banco novo; **tocar `outbox-worker.ts` (filtro de tipos, entregador) pode se confundir com o flake**: rodar o arquivo isolado e, se passar, é baseline. Comparar `docker exec <c> date` com `date` antes de culpar o código. `[CITED: memória gsd-gate-de-testes-baseline]`
- **Guarda de regime:** `persistencia/regime-dos-chamadores.test.ts` lê o código-fonte e falha se outro arquivo passar `regime: "otimista"`; não usar `otimista` aqui. `sem-crm-antigo.test.ts` e `sem-listas-espelho.test.ts` são guardas por grep: não reintroduzir `state.contacts` etc.
- **Custo do gate:** `npm run check` ~3 min no Postgres local de Docker (domínio 2125, web 797, API 1625 testes na Fase 10), 13–17 min contra o remoto. Rodar sempre com `DATABASE_URL` e `DATABASE_URL_MIGRACAO` locais; rodar `npm run migrar -w @n1/api` antes no contêiner novo.

## Runtime State Inventory

Não se aplica: a fase não renomeia nem migra identificadores existentes (nasce a `013` e o diretório `mensageria/`). Único estado de runtime novo a registrar: `plataforma.webhooks_recebidos` (dado pessoal no `corpo`, retenção na Sessão 19) e credenciais do cofre por Canal.

## Common Pitfalls

### Pitfall 1: O worker velho do outbox pega `mensagem.enviar.v1`
**What goes wrong:** a mensagem do cliente vira `failed` com 404 do `automation/` e nunca sai.
**Why it happens:** `reivindicar` só filtra `status='pending'` (`outbox-worker.ts:169`) e `entregar` cai em `/webhooks/plataforma/desconhecido` (`:231`).
**How to avoid:** o worker velho exclui `mensagem.%` e o novo inclui só `mensagem.enviar.v1`; teste com os dois vivos. Em produção `OUTBOX_WORKER_ATIVO=false` mascara o bug, mas o dev e o dia em que o dono ligar o outbox não.
**Warning signs:** linhas `failed` com `last_error_code = HTTP_404` e `event_type like 'mensagem.%'`.

### Pitfall 2: "Tentar de novo" viola o índice único
**What goes wrong:** `gravarEventos` lança `23505` e desfaz a transação do reenvio.
**How to avoid:** `on conflict ... where event_type = 'mensagem.enviar.v1' do update` (Pattern 3). O mesmo para a reenfileirada quando o Canal volta a `conectada`.

### Pitfall 3: Polling de 5 s não cumpre "< 2 s"
**What goes wrong:** o texto aparece em 5–7 s.
**Why it happens:** `intervaloMs` padrão dos workers é 5 s.
**How to avoid:** a rota do webhook chama `acordarProcessador()` depois de responder 200; o `setInterval` fica só como reserva (5–10 s) e para recuperar `locked_at` vencido. O worker de saída é acordado pela rota `POST /mensagens` do mesmo modo.

### Pitfall 4: `invalidarCrm` não casa a chave array do resumo das Tarefas
**What goes wrong:** o cartão da Tarefa conversacional não atualiza a última Mensagem.
**How to avoid:** invalidador que também casa arrays (§6). Teste web: emitir evento e conferir que a chave array revalida.

### Pitfall 5: SSE pendura o desligamento e perde o CORS
**What goes wrong:** `app.close()` não termina com fluxo aberto (SIGKILL aos 20 s do systemd); com `hijack` o navegador recusa por falta de `Access-Control-Allow-Origin`; o nginx segura o fluxo se faltar `X-Accel-Buffering: no`.
**How to avoid:** `reply.send(PassThrough)`; `hub.encerrarTodos()` antes de `app.close()`; cabeçalho `x-accel-buffering`; provar no `provar-nginx.sh`.

### Pitfall 6: Notificação perdida e payload repetido
**What goes wrong:** depois de a conexão `LISTEN` cair, as abas ficam desatualizadas sem saber; dois `pg_notify` iguais na mesma transação viram um.
**How to avoid:** `ressincronizar` após reconectar; o payload sempre leva `mensagemId` (distinto); ouvinte que nunca bloqueia (fila de 8 GB cheia derruba commits).

### Pitfall 7: `MESSAGES_UPSERT` traz coisas que não são mensagem
**What goes wrong:** grupos, `status@broadcast`, reações, edições (`protocolMessage`), enquetes e histórico `append` criam Contatos e Conversas fantasma.
**How to avoid:** tradutor com lista de **permitidos** (`conversation`, `imageMessage`, `videoMessage`, `audioMessage`, `documentMessage`, e `stickerMessage` como `image/webp`); tudo mais vira `processado` com `resultado = ignorado:<motivo>`. `fromMe: true` ignorado.

### Pitfall 8: `audio/ogg; codecs=opus` não bate com a lista
**What goes wrong:** o áudio de voz é recusado ou grava `baixado: false`.
**How to avoid:** normalizar o MIME (sem parâmetros, minúsculo) antes de conferir a lista e a assinatura; guardar o original em `nome`/metadado se precisar.

### Pitfall 9: `@lid` sem número
**What goes wrong:** vira Contato com identificador que não é telefone, e o envio de resposta falha.
**How to avoid:** só `remoteJid` terminado em `@s.whatsapp.net` (depois da troca pelo Alt) vira Contato; senão `sem_numero` e log.

### Pitfall 10: Retentativa da Evolution empilha o mesmo evento
**What goes wrong:** resposta lenta nossa → a Evolution reenvia → duas linhas em `webhooks_recebidos`.
**How to avoid:** `receberMensagem` já é idempotente (índice 008:194); opcionalmente chave de deduplicação na fila. Responder rápido: um `insert` e fim.

### Pitfall 11: Corrida ao criar o Contato (e a Conversa)
**What goes wrong:** dois eventos do mesmo número novo: `23505` em `contato_identificadores_unico` ou em `conversas_nao_resolvida_uq`.
**How to avoid:** `for update` no Contato (`contatos.obter(..., { travar: true })` já existe) e, no `catch` de `23505` dessas duas, **refazer a transação uma vez** (agora o detentor existe). O processador reivindica um por vez por processo, mas dois processos ou o recebimento de eventos do mesmo número em sequência rápida expõem a corrida.

### Pitfall 12: `statusInicialDeEnvio` muda e quebra testes
**What goes wrong:** testes de serviço, rota e web que esperam `enviada` para Canal conectado falham em cascata.
**How to avoid:** `grep -rn "statusInicialDeEnvio\|\"enviada\"" apps packages` no início do plano de domínio e atualizar juntos.

### Pitfall 13: Três pontos gravam `enviada`
**What goes wrong:** só `POST /mensagens` enfileira; a primeira Mensagem da Conversa e a da Tarefa conversacional ficam `pendente` para sempre.
**How to avoid:** uma função (`registrarEnvio`) usada por `mensagens.enviar` e `abrirConversaNoCliente`.

### Pitfall 14: Tabela nova sem o bloco de RLS e sem teste de privilégio
**What goes wrong:** num projeto com o event trigger `ensure_rls`, `n1_api` enxerga zero linhas.
**How to avoid:** copiar o bloco da 012; conferir `seguranca/banco-n1-api.test.ts`.

### Pitfall 15: Reenvio automático duplica a mensagem ao cliente
**What goes wrong:** timeout depois de a Evolution ter enviado → nova tentativa → cliente recebe duas.
**How to avoid:** política do §5 (só retentar o que certamente não saiu).

### Pitfall 16: Evolution manda `date_time` local com `Z`, `pushName` nulo e `messageTimestamp` em segundos
**How to avoid:** `criadoEm = new Date(messageTimestamp * 1000)`; nome do Contato = `pushName` ou o número; nunca `date_time`.

### Pitfall 17: Corpo de webhook grande e `base64`
**What goes wrong:** 413 do Fastify (1 MiB) ou do nginx (26M), e a Evolution reenvia 10 vezes (413 não está na lista de não retentáveis).
**How to avoid:** `base64: false`; `bodyLimit` da rota em 2 MiB.

### Pitfall 18: O `evolution.env.example` não diz tudo
**What goes wrong:** `DATABASE_SAVE_DATA_NEW_MESSAGE` e `DATABASE_SAVE_DATA_INSTANCE` ausentes: sem o primeiro, `getBase64FromMediaMessage` por `key.id` falha; sem o segundo (e sem Redis `SAVE_INSTANCES`), a sessão do WhatsApp pode não sobreviver a reinício.
**How to avoid:** mandar o `message` do webhook; o dono confere o `evolution.env` real (Open Questions).

### Pitfall 19: Segredo vazando em log ou no corpo guardado
**How to avoid:** não logar corpo/payload; remover `apikey` do `corpo` antes do `insert`; `sanitizarErro` com padrão `apikey`; nunca devolver o segredo do cofre por rota.

### Pitfall 20: Worker e ouvinte no `index.ts` sem desmontagem
**What goes wrong:** a recarga do `vite-node --watch` empilha ouvintes `LISTEN` e workers.
**How to avoid:** registrar tudo em `aoEncerrar` (workers, ouvinte, hub); o `index.ts` já desmonta a instância anterior antes de subir a nova.

## Code Examples

### Registrar o webhook da instância (cliente da Evolution)
```typescript
// Source: corpo conforme webhook.schema.ts@2.3.7 (embrulhado em "webhook"); funções/nomes do cliente são proposta de design
async function configurarWebhook(cfg: { url: string; apikey: string; instancia: string }, webhook: { url: string; segredo: string }) {
  const r = await fetch(`${cfg.url}/webhook/set/${encodeURIComponent(cfg.instancia)}`, {
    method: "POST",
    headers: { apikey: cfg.apikey, "content-type": "application/json" },
    body: JSON.stringify({ webhook: { enabled: true, url: webhook.url, headers: { "x-n1-webhook-segredo": webhook.segredo },
                                       byEvents: false, base64: false, events: ["MESSAGES_UPSERT"] } }),
    signal: AbortSignal.timeout(15_000),
  });
  if (r.status !== 201) throw new Error(`webhook/set respondeu ${r.status}`); // nunca incluir o corpo (ecoa headers)
}
```

### Traduzir `MESSAGES_UPSERT`
```typescript
// Source: forma de prepareMessage@2.3.7:4652-4710 e o handler messages.upsert@2.3.7:1166-1480
function interpretar(corpo: any, canal: { instancia: string }): readonly EventoDoProvedor[] {
  if (corpo?.event !== "messages.upsert" || corpo?.instance !== canal.instancia) return [];
  const d = corpo.data, k = d?.key;
  if (!k || k.fromMe === true) return [{ tipo: "ignorado", motivo: "fromMe" }];
  if (/@g\.us$|^status@broadcast$/.test(k.remoteJid ?? "")) return [{ tipo: "ignorado", motivo: "grupo_ou_status" }];
  const jid: string = k.remoteJid ?? "";
  if (!jid.endsWith("@s.whatsapp.net")) return [{ tipo: "ignorado", motivo: "sem_numero" }]; // @lid sem remoteJidAlt
  const numero = `+${jid.split("@")[0]}`;
  const m = d.message ?? {};
  const midia = m.imageMessage ?? m.videoMessage ?? m.audioMessage ?? m.documentMessage ?? m.stickerMessage;
  const conteudo = m.conversation ?? midia?.caption ?? undefined;
  if (conteudo === undefined && !midia) return [{ tipo: "ignorado", motivo: `tipo:${d.messageType}` }];
  return [{ tipo: "mensagem", idExterno: k.id, criadoEm: new Date(d.messageTimestamp * 1000).toISOString(),
            remetente: { tipo: "whatsapp", valor: numero, nomeExibido: d.pushName || undefined },
            ...(conteudo !== undefined ? { conteudo } : {}), /* anexos[] a partir de `midia` e do `message` inteiro como referenciaNoProvedor */
            cargaBruta: semApikey(corpo) }];
}
```

### Ligar o Canal (esqueleto do comando D-16-05)
```typescript
// Source: D-16-05/D-16-06 + endpoints verificados em instance.controller.ts@2.3.7; ordem proposta
// 1 recusar `numeropvmarcos`; 2 fetchInstances?instanceName= (global) → ownerJid, token; 3 connectionState === "open"
// 4 conferirNumeroConectado(canal, ownerJid); 5 guardarCredencial(cliente, chaves, {donoTipo:"canal", tipo:"evolution", segredo: JSON.stringify({instancia, apikey: token})})
// 6 guardarCredencial(..., tipo:"webhook_segredo", segredo: randomBytes(32).toString("hex"))
// 7 POST webhook/set; 8 na MESMA transação: confirmar conexão (conexao='conectada', conexao_simulada=false, conectada_em) + avancarRevisaoDoEspaco
//   + enfileirar as Mensagens `pendente` do Canal. Falha em 7 antes de 8 não deixa Canal "conectada" sem webhook.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@lid`/`senderPn` do Baileys 6 | `remoteJidAlt`/`participantAlt` (Baileys 7 rc) e a Evolution 2.3.7 troca `remoteJid` pelo Alt quando há | Evolution 2.3.x / Baileys 7.0.0-rc.9 | O número vem no `remoteJid` na maioria dos casos; sem Alt não há número |
| URL com segredo no webhook | `headers` por webhook na Evolution v2 | v2 | O segredo sai do `access_log` do nginx |
| `EventSource` para SSE | `fetch` + `ReadableStream` | — | Permite `Authorization`; já decidido |
| Supabase Realtime | `LISTEN/NOTIFY` + SSE próprio | D-16-01 | Mantém o schema `plataforma` fechado |

**Deprecated/outdated:** a 4.4.1 da Sessão 4 (URL com segredo) fica substituída pela D-16-06; `webhook_by_events` (v1) vira `byEvents` na v2; Evolution `2.4.0-rc*` não é estável: não subir.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A Evolution do dono roda a v2.3.7 do compose | Resp. 1 | Formatos e `emitOwnEvents` podem diferir; `GET /` mostra a versão |
| A2 | `getBase64FromMediaMessage` funciona só com o `message` do webhook, sem `DATABASE_SAVE_DATA_NEW_MESSAGE` | Resp. 1, Pitfall 18 | Sem mídia baixada; plano B: o dono liga a variável |
| A3 | `number` do envio vai só com dígitos, sem `+` | Resp. 1 | 400 no envio; o spike confirma |
| A4 | O número do dono pode vir como `@lid` sem Alt | Resp. 1, Pitfall 9 | Mensagens ignoradas na prova; só o ao vivo mostra |
| A5 | O áudio ogg/opus do WhatsApp pode não tocar no Safari | Resp. 4 | Atendente no Safari não ouve; `convertToMp4` resolve |
| A6 | O nginx respeita `X-Accel-Buffering: no` nesta configuração | Resp. 2 | Eventos presos no buffer; `provar-nginx.sh` |
| A7 | Estrutura do ZIP/Office e CSV de Excel BR em Windows-1252 | Resp. 4 | Recusa documento válido ou aceita falso; teste com arquivos reais |
| A8 | Orçamento de 1–1,5 s para texto e 2–3 s para áudio | Resp. 4 | A prova ao vivo reprova o áudio; Open Question 1 |
| A9 | O pooler real (5432) com `n1_api` entrega `LISTEN/NOTIFY` | Resp. 2 | Tempo real não funciona em produção; spike na Onda 0 |
| A10 | `fetchInstances` devolve `token` e `ownerJid` na instância real | Resp. 1 | O comando guarda a global; ver fonte e confirmar |
| A11 | `video/3gpp` não toca no `<video>`; link de download como recuo | Resp. 4 | Vídeo 3GP sem preview |
| A12 | Listagem do bucket traz `created_at` para a coleta de órfãos da entrada | Resp. 4 | Coleta por prefixo precisa outra chave de idade |
| A13 | Política de retentativa de envio (só o que certamente não saiu) é aceita | Resp. 5 | Mais "falhou" manual; ou duplicidade se for liberal |
| A14 | Convenção de contêiner de teste `crm-n1-pg-16NN` porta `557NN` | Resp. 8 | Só conveniência |

## Open Questions

1. **O áudio fecha em menos de 2 s na prova ao vivo?**
   - What we know: texto estima 1–1,5 s; áudio soma `getBase64`, upload ao bucket e a transação (~52 ms por ida ao banco).
   - What's unclear: o tempo real do `getBase64` na VPS da Evolution e do upload ao Supabase.
   - Recommendation: medir com um log por etapa na Onda do adaptador; se passar de 2 s, o dono decide entre aceitar 2–3 s para áudio (texto continua <2 s) ou reabrir a ordem "baixar antes da transação" (D-16-08), gravando a Mensagem `baixado: false` primeiro.
2. **O `evolution.env` real da VPS tem `DATABASE_SAVE_DATA_INSTANCE` ou Redis `SAVE_INSTANCES`, e qual `AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES`?**
   - What we know: o `evolution.env.example` do repositório não tem as duas primeiras e põe a terceira em `false`.
   - What's unclear: o que o dono realmente subiu (o arquivo real é modo 600 e fora do repositório).
   - Recommendation: o dono confere (checkpoint humano antes da prova) e confirma a versão por `GET /`.
3. **Mensagem que não é texto nem mídia (localização, contato, enquete) deve aparecer?**
   - What we know: o tradutor ignora com motivo; D-16-04 só traduz texto, imagem, áudio, vídeo e documento.
   - What's unclear: se o atendente aceita que "localização do cliente" não apareça até a Sessão 4/12.
   - Recommendation: ignorar nesta fase e registrar no `andamento.mjs`; só reabrir se o dono estranhar na prova.

(O resto que parecia aberto está resolvido pela pesquisa: `headers` no webhook, eco de `fromMe`, `@lid`, nginx x API e a chave do objeto de entrada.)

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | todo o `apps/api` e os testes | ✓ | v24.14.0 | — |
| Docker | Postgres local dos testes | ✓ | 29.3.1 (imagens `postgres:16` e `postgres:17` já baixadas) | — |
| psql | conferência manual | ✓ | `/opt/homebrew/bin/psql` | — |
| Postgres 16 local | testes de banco, `LISTEN/NOTIFY` | ✓ (subiu `postgres:16` em 55616 e foi parado) | 16 | — |
| Evolution do dono | prova ao vivo | não verificável daqui | v2.3.7 (compose) `[ASSUMED]` instalada | provedor de teste cobre CI e demo |
| `EVOLUTION_URL`, `EVOLUTION_API_KEY` | comando e cliente | não verificável (o `.env` real não é lido) | — | o dono fornece no checkpoint |
| nginx da VM / drop-in systemd | `MENSAGERIA_WORKER_ATIVO` em produção | edição só do dono | — | não bloqueia código nem testes |
| Pooler Supabase 5432 com `n1_api` | `LISTEN` em produção | não testado daqui | — | spike na Onda 0; sem ele, SSE só funciona com conexão direta |

**Missing dependencies with no fallback:** nenhuma para o código e os testes.
**Missing dependencies with fallback:** instância da Evolution e as duas variáveis (a prova ao vivo é o último plano e é checkpoint humano; o resto da fase se prova com o provedor de teste).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 5.0.1 (api, domínio, web) + Testing Library na web |
| Config file | `apps/api/vitest.config.mts` (um arquivo por vez, timeout 180 s); `apps/web` e `packages/dominio` com `vitest run` |
| Quick run command | `cd apps/api && DATABASE_URL=postgres://postgres:x@localhost:557NN/postgres DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:557NN/postgres npx vitest run src/mensageria` |
| Full suite command | `DATABASE_URL=… DATABASE_URL_MIGRACAO=… npm run check` (raiz, Postgres local de Docker; rodar `npm run migrar -w @n1/api` antes no contêiner novo) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MSG-01 | webhook com segredo grava `webhooks_recebidos` e responde 200; sem/errado → 401 e nada gravado | rota (banco) | `npx vitest run src/rotas/webhooks-de-mensageria.test.ts` | ❌ Wave 0 |
| MSG-01 | processador cria/acha Contato, abre/reabre/reaproveita Conversa; repetida não grava | serviço (banco) | `npx vitest run src/servicos/crm/recebimento.test.ts` | ❌ Wave 0 |
| MSG-01 | `locked_at` vencido volta a `pendente` e processa uma vez | worker (banco) | `npx vitest run src/mensageria/processador-de-entrada.test.ts` | ❌ Wave 0 |
| MSG-01 | `destinoDaRecebida`, RN-CON-13, `proximoStatusDeEntrega` | unit (domínio) | `npx vitest run src/crm/recebimento.test.ts src/crm/mensagens.test.ts` em `packages/dominio` | ❌ Wave 0 (`mensagens.test.ts` existe) |
| MSG-02 | enviar grava Mensagem `pendente` + linha `mensagem.enviar.v1`; falha do evento desfaz a Mensagem | serviço (banco) | `npx vitest run src/servicos/crm/mensagens.test.ts` | ✅ (estender) |
| MSG-02 | worker velho ignora `mensagem.%`; segundo worker entrega, grava `id_externo`/`enviada`; transitório 2× e a 3ª entrega; permanente → `falhou` | worker (banco + servidor falso) | `npx vitest run src/mensageria/entregar-mensagem.test.ts src/persistencia/outbox-worker.test.ts` | ❌ Wave 0 / ✅ (estender) |
| MSG-02 | `POST /mensagens/:id/reenviar` só para `falhou`; reenfileira sem `23505` | rota (banco) | `npx vitest run src/rotas/crm/mensagens.test.ts` | ✅ (estender) |
| MSG-02 | primeira Mensagem da Conversa e da Tarefa conversacional também enfileiram | serviço (banco) | `npx vitest run src/servicos/crm/conversas.test.ts src/servicos/crm/tarefas-conversacionais.test.ts` | ✅ (estender) |
| MSG-03 | `LISTEN` recebe depois do `commit` e nada depois do `rollback`; payload só com ids | banco | `npx vitest run src/mensageria/avisar.test.ts` | ❌ Wave 0 |
| MSG-03 | `GET /eventos`: sem token 401; outro Espaço não recebe; Papel sem `ler` não recebe; batida; `ressincronizar` ao reconectar; `app.close()` não pendura | rota + hub | `npx vitest run src/rotas/eventos.test.ts` | ❌ Wave 0 |
| MSG-03 | latência webhook→evento SSE < 1 s no provedor de teste local (proxy automático do critério de 2 s) | e2e | `npx vitest run src/e2e/mensageria.test.ts` | ❌ Wave 0 |
| MSG-03 | web: evento revalida `/conversas*`, `/mensagens?conversaId=`, chave array do resumo; reconecta; cai para 5 s | web | `npx vitest run src/dados/tempo-real.test.ts` (em `apps/web`) | ❌ Wave 0 |
| MSG-04 | tipos novos: OGG/MP3/MP4/3GP/ZIP/Office/csv/txt aceitos; texto renomeado `.ogg` recusado; Formulário continua recusando áudio | unit + rota | `npx vitest run src/servicos/storage-uploads.test.ts src/rotas/formularios-publicos.test.ts` | ✅ (estender) |
| MSG-04 | baixar da Evolution com teto e timeout; falha → `baixado:false`; anexo abre depois de o link do provedor sumir | serviço (banco + servidor falso) | `npx vitest run src/mensageria/midia.test.ts` | ❌ Wave 0 |
| MSG-04 | download de outro Espaço/Conversa 403/404; documento sai com `download` | rota (banco) | `npx vitest run src/rotas/crm/mensagens.test.ts` | ✅ (estender) |
| MSG-05 | `provedorDoCanal` só devolve o de teste com `conexao_simulada = true`; segredo por Canal; Canal sem segredo → 401 | serviço + rota | `npx vitest run src/mensageria/registro.test.ts` | ❌ Wave 0 |
| MSG-05 | conjunto de contrato do provedor roda contra o de teste | contrato | `npx vitest run src/mensageria/provedor.test.ts` | ❌ Wave 0 |
| MSG-06 | cliente da Evolution: cada rota, 401, 400 "sem WhatsApp", timeout, resposta perdida | unit (servidor falso) | `npx vitest run src/mensageria/provedores/evolution/cliente.test.ts` | ❌ Wave 0 |
| MSG-06 | tradutor: texto, imagem, áudio, vídeo, documento, `fromMe`, grupo, `@lid` sem Alt, status | unit | `npx vitest run src/mensageria/provedores/evolution/traduzir.test.ts` | ❌ Wave 0 |
| MSG-06 | `canal:ligar-evolution` recusa `numeropvmarcos`, confere número, guarda cofre, aponta webhook, marca `conectada` | CLI/serviço (banco + servidor falso) | `npx vitest run src/bootstrap/canal-ligar-evolution.test.ts` | ❌ Wave 0 |
| MSG-06 | texto e áudio do celular na Caixa < 2 s, áudio toca, resposta chega ao celular | **manual (UAT)** com a Evolution do dono | — (checkpoint humano; roteiro no plano final) | manual-only: depende de WhatsApp real |

### Sampling Rate
- **Per task commit:** o arquivo de teste do módulo tocado (`npx vitest run <arquivo>`), < 30 s com o Postgres local.
- **Per wave merge:** `npx vitest run` de `src/mensageria src/servicos/crm src/rotas src/persistencia/outbox*` em `apps/api` + `npm run test -w @n1/dominio`.
- **Phase gate:** `npm run check` completo em Docker; falhas só do conjunto de baseline (`outbox-worker` h–k, `colunas-geradas`) se repetem isoladas em banco novo antes de serem tratadas como regressão.

### Wave 0 Gaps
- [ ] `apps/api/migracoes/013-mensageria.sql` + `apps/api/src/persistencia/migracao-013.test.ts` — modelo: `migracao-012.test.ts`
- [ ] `apps/api/src/mensageria/provedor.test.ts` e fixtures de `provedores/teste.ts` — conjunto de contrato reutilizável
- [ ] Spike do pooler: `LISTEN/NOTIFY` pela `DATABASE_URL` real com o papel `n1_api` (manual, antes de depender do SSE em produção)
- [ ] Fixtures da Evolution em `provedores/evolution/exemplos/` — sintéticas, derivadas de `prepareMessage@2.3.7` agora; trocadas por capturas reais (sem dado de cliente) na prova ao vivo
- [ ] `apps/web/src/dados/tempo-real.test.ts` — leitor SSE com `ReadableStream` falso
- [ ] Framework: nada a instalar (vitest já presente)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | sim (webhook público e SSE) | Segredo por Canal em cabeçalho, `timingSafeEqual`; JWT do Supabase no `/eventos` (hook `onRequest`) |
| V3 Session Management | sim (SSE longo) | Fluxo fecha em 45 min; Papel reconferido a cada ~60 s; teto de fluxos por Membro |
| V4 Access Control | sim | Espaço da sessão filtra o evento; `exigir(..., "ler", "conversa")`; download de anexo confere a Conversa; Canal de outro Espaço nunca casa (`workspace_id` em toda consulta) |
| V5 Input Validation | sim | zod `.strict()` nas rotas; `interpretarChamada` com lista de permitidos; payload do outbox `.strict()`; tipo/tamanho/assinatura do anexo |
| V6 Cryptography | sim | Cofre AES-256-GCM (`COFRE_CHAVE`); segredo do webhook `randomBytes(32)`; nunca hand-roll |
| V8 Data Protection | sim | `corpo` e texto fora do log; `apikey` removido do corpo guardado; payload de `pg_notify` e do outbox só com ids |
| V12 Files and Resources | sim | MIME + assinatura + tamanho; chave aleatória (nunca o nome do arquivo); `Content-Disposition: attachment` em documento; ZIP lido sem descompressão |
| V13 API and Web Service | sim | Webhook com `bodyLimit`, limite de taxa, mesma 401; sem SSRF (host fixo `EVOLUTION_URL`) |
| V14 Configuration | sim | Segredos só em `api.env`/cofre; `numeropvmarcos` recusada; painel da Evolution fechado para fora (SEG-11, do dono) |

### Known Threat Patterns for Fastify + Evolution + Postgres + Storage

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Webhook forjado injeta mensagem | Spoofing | Segredo por Canal no cofre, cabeçalho comparado em tempo constante, `instance` do corpo igual à do Canal, Canal arquivado/inexistente = mesma 401 |
| Enumeração de Canais pela resposta ou pelo tempo | Information disclosure | Mesma 401 e comparação sempre executada |
| Enxurrada no webhook público | Denial of service | Limite por IP antes do banco; `bodyLimit` 2 MiB; `base64: false` |
| Vazamento de evento entre Espaços ou para quem não lê | Information disclosure | Filtro por `workspaceId` da sessão no hub + Papel; testes com dois Espaços (`espaco-de-vazamento.ts`) |
| Aba esquecida / token expirado mantém o fluxo | Elevation of privilege | Fechar em 45 min, reconferir Papel, teto por Membro |
| Mídia enorme ou maliciosa (memória, zip-bomb, MIME falso) | DoS / Tampering | Teto 16/25 MiB lido em fluxo, timeout, assinatura contra o tipo decodificado, ZIP só pelo diretório central, texto sem NUL |
| XSS por nome/MIME de arquivo ou HTML baixado | Tampering | Texto como texto do React (já é: `conversation-thread.tsx`), `Content-Disposition: attachment`, nunca servir do domínio da API |
| SSRF ao baixar mídia do provedor | Tampering | Só `EVOLUTION_URL` fixo; interface `baixarMidia` das Sessões 7/8 exige host fixo do provedor |
| Segredo ou dado pessoal em log/erro | Information disclosure | Não logar corpo; `sanitizarErro` com `apikey`; erro do cliente sem o corpo da resposta; `carga_bruta` nunca sai por rota (A9 do repositório) |
| Retentativa do provedor ou do worker duplica | Tampering / Repudiation | Índice `mensagens_id_externo_uq`; `receberMensagem` idempotente; política de retentativa de envio do §5 |
| Mesma Mensagem entra duas vezes na fila de saída | Tampering | Índice único parcial da `013`; reenfileirar por `on conflict ... do update` |
| Instância errada ligada ao Canal (apontar a `numeropvmarcos` para cá) | Tampering | O comando recusa `numeropvmarcos`; chave guardada é a da instância, não a global |

## Sources

### Primary (HIGH confidence)
- Repositório (lido nesta sessão): `apps/api/src/persistencia/outbox-worker.ts`, `outbox.ts`, `unidade-de-trabalho.ts`, `conexao.ts`, `CONTEXT.md`; `servicos/crm/{mensagens,conversas,transacao,gesto-misto,acesso,canais}.ts`; `repositorios/crm/mensagens.ts`; `servicos/{storage-uploads,cofre,limite-de-taxa}.ts`; `rotas/{webhook-meta,anexos-da-tarefa}.ts`, `rotas/crm/{index,mensagens}.ts`; `app.ts`, `index.ts`, `plugins/autenticacao.ts`; migrações `003`, `008`, `009`, `012`; `deploy/{nginx-n1-crm-api.conf,n1-crm-limites.conf,n1-crm-api.service,evolution/*}`; `packages/dominio/src/crm/{mensagens,canais,capacidades,permissoes,conversas,normalizacao}.ts`, `colecoes.ts`; `apps/web/src/dados/{store.ts,envio-ao-bucket.ts,crm/*}`, `features/crm/conversation-thread.tsx`; `docs/09-planejamento/TAREFAS-POR-SESSAO.md` §3.6–3.9 e 4.2–4.4.
- Fonte da Evolution API na tag `2.3.7` (`raw.githubusercontent.com/EvolutionAPI/evolution-api/2.3.7/...`): `webhook.{router,schema,controller}.ts`, `event.controller.ts`, `auth.guard.ts`, `whatsapp.baileys.service.ts` (linhas 523-535, 658, 1166-1480, 2300-2543, 3035-3247, 3837-3979, 4613-4710), `channel.service.ts`, `instance.controller.ts`, `monitor.service.ts`, `sendMessage.controller.ts`, `chat.router.ts`, `env.config.ts`, `prisma/postgresql-schema.prisma`, `Dockerfile`, `package.json`.
- Experimentos locais (scratchpad): SSE com `reply.send(PassThrough)` + CORS + fechamento; desligamento com fluxo aberto; `LISTEN/NOTIFY` em Postgres 16 com `pg` 8.23.0.
- postgresql.org/docs/16/sql-notify.html (entrega no commit, 8000 bytes, deduplicação, fila de 8 GB).
- `node_modules/@supabase/storage-js/dist/index.d.mts` (`upload`, `createSignedUrl` com `download`).
- hub.docker.com API: tags de `evoapicloud/evolution-api`.

### Secondary (MEDIUM confidence)
- supabase.com/docs/guides/self-hosting/accessing-postgres (5432 sessão suporta `LISTEN/NOTIFY`; 6543 transação não), via busca.
- Busca web sobre Ogg/Opus no Safari 18.4 (frequal.com, MDN PR 39592).
- Busca web sobre SSE com `reply.hijack`/CORS no Fastify.

### Tertiary (LOW confidence)
- Orçamento de latência (A8) e estruturas de ZIP/CSV (A7): estimativas, a validar nos testes e na prova ao vivo.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, nenhum pacote novo; versões lidas dos `package.json` instalados.
- Architecture: HIGH, os pontos de integração foram lidos no código e o SSE/LISTEN foram provados localmente.
- Evolution: HIGH para o que a fonte 2.3.7 mostra; MEDIUM para o que depende da instância real (A1, A2, A3, A4, A10).
- Pitfalls: HIGH para os de repositório (1, 2, 4, 12, 13, 14); MEDIUM para os de latência e Safari.

**Research date:** 2026-11-09
**Valid until:** 2026-12-09 (Evolution e Baileys mudam rápido; reconferir se o dono subir outra tag)
