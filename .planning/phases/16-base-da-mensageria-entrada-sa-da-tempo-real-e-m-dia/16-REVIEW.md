---
phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia
reviewed: 2026-11-10T00:00:00Z
depth: standard
files_reviewed: 55
files_reviewed_list:
  - apps/api/deploy/n1-crm-api.service
  - apps/api/deploy/provar-nginx.sh
  - apps/api/migracoes/013-mensageria.sql
  - apps/api/src/app.ts
  - apps/api/src/bootstrap/canal-ligar-evolution.cli.ts
  - apps/api/src/bootstrap/canal-ligar-evolution.ts
  - apps/api/src/bootstrap/canal-segredo-de-teste.cli.ts
  - apps/api/src/bootstrap/canal-segredo-de-teste.ts
  - apps/api/src/index.ts
  - apps/api/src/mensageria/avisar.ts
  - apps/api/src/mensageria/coleta-de-orfaos.ts
  - apps/api/src/mensageria/contrato-do-provedor.ts
  - apps/api/src/mensageria/entregar-mensagem.ts
  - apps/api/src/mensageria/fila-de-saida.ts
  - apps/api/src/mensageria/hub-de-eventos.ts
  - apps/api/src/mensageria/midia.ts
  - apps/api/src/mensageria/ouvinte-pg.ts
  - apps/api/src/mensageria/processador-de-entrada.ts
  - apps/api/src/mensageria/provar-tempo-real.cli.ts
  - apps/api/src/mensageria/provar-tempo-real.ts
  - apps/api/src/mensageria/provedor.ts
  - apps/api/src/mensageria/provedores/evolution/cliente.ts
  - apps/api/src/mensageria/provedores/evolution/provedor.ts
  - apps/api/src/mensageria/provedores/evolution/traduzir.ts
  - apps/api/src/mensageria/provedores/teste.ts
  - apps/api/src/mensageria/registro.ts
  - apps/api/src/persistencia/outbox-worker.ts
  - apps/api/src/persistencia/outbox.ts
  - apps/api/src/repositorios/crm/conversas.ts
  - apps/api/src/repositorios/crm/mensagens.ts
  - apps/api/src/rotas/crm/mensagens.ts
  - apps/api/src/rotas/eventos.ts
  - apps/api/src/rotas/webhooks-de-mensageria.ts
  - apps/api/src/servicos/armazenamento-de-anexos.ts
  - apps/api/src/servicos/crm/canais.ts
  - apps/api/src/servicos/crm/conversas.ts
  - apps/api/src/servicos/crm/mensagens.ts
  - apps/api/src/servicos/crm/recebimento.ts
  - apps/api/src/servicos/crm/resultado.ts
  - apps/api/src/servicos/storage-uploads.ts
  - apps/api/src/testes/armazenamento-falso.ts
  - apps/api/src/testes/banco-crm.ts
  - apps/web/src/dados/crm/cliente-crm.ts
  - apps/web/src/dados/crm/mensagens.ts
  - apps/web/src/dados/envio-ao-bucket.ts
  - apps/web/src/dados/store.ts
  - apps/web/src/dados/tempo-real.ts
  - apps/web/src/features/crm/anexo-da-mensagem.tsx
  - apps/web/src/features/crm/conversation-thread.tsx
  - apps/web/src/features/crm/estado-da-entrega.tsx
  - packages/dominio/src/crm/canais.ts
  - packages/dominio/src/crm/eventos.ts
  - packages/dominio/src/crm/mensagens.ts
  - packages/dominio/src/crm/midia.ts
  - packages/dominio/src/crm/recebimento.ts
findings:
  critical: 1
  warning: 8
  info: 5
  total: 14
status: issues_found
---

# Phase 16: Code Review Report

**Reviewed:** 2026-11-10
**Depth:** standard
**Files Reviewed:** 55
**Status:** issues_found

## Summary

Revisão só de leitura (nenhum teste, script, banco ou serviço remoto foi tocado). Os arquivos grandes e antigos foram
revisados pelo `git diff 83c5307..HEAD`, mais o código ao redor que o diff chama.

O que está bem feito e foi conferido: a rota pública do webhook acha o Canal só pelo `id` da URL, o Espaço vem da linha do
Canal, toda recusa devolve a mesma 401, a comparação do segredo é em tempo constante, o limite por IP roda antes de
qualquer consulta, o corpo tem teto, a `apikey` do topo não vai ao banco, o SQL é todo parametrizado, o log não leva
corpo nem segredo. O download de mídia nunca segue URL do corpo (só `getBase64FromMediaMessage` na `EVOLUTION_URL`),
a chave do objeto nasce no servidor (`workspace/<ws>/entrada/<canal>/<uuid>`, sem nome vindo de fora), documento sai
sempre como anexo para baixar, o hub SSE filtra por Espaço e o evento leva só ids. A fila de entrada usa
`for update skip locked` e a recepção é idempotente por (Canal, `idExterno`). `testes/banco-crm.ts` recusa banco não local.

Os problemas reais estão em outro lugar: uma regra de conexão que deixa um Canal real cair no provedor de teste (o que a
D-16-03/MSG-05 diz proibir), duas janelas de duplicação de envio, a desmontagem do serviço, e alguns defeitos de
robustez. Um achado (WR-03) contradiz o diagnóstico do item conhecido (c), e um (WR-05) piora o provedor de teste em
produção.

## Critical Issues

### CR-01: "Simular conexão" num Canal real troca o provedor por o de teste: Mensagem dada como enviada sem sair e entrada descartada

**File:** `packages/dominio/src/crm/canais.ts:141-146`, `apps/api/src/mensageria/registro.ts:43`, `apps/web/src/app/(shell)/crm/caixa-de-entrada/configuracoes/canais/[canal]/page.tsx:277-285`, `apps/api/src/servicos/crm/canais.ts:178-188`
**Issue:** `proximaConexao(canal, "simular_conexao")` só recusa Canal arquivado ou já `conectada`; não olha se o Canal é real
(`conexaoSimulada = false`, com credencial da Evolution no cofre). A ficha do Canal mostra o botão "Simular conexão" para
qualquer Canal ativo que não esteja `conectada` (`page.tsx:277`, sem condição de provedor). `provedorDoCanal` devolve o
provedor de teste sempre que `conexaoSimulada = true` (`registro.ts:43`).
Cenário concreto (Canal já ligado por `canal:ligar-evolution`): o administrador clica "Desconectar" (permitido a partir de
`conectada`) e, para reconectar, clica "Simular conexão" (hoje não existe outro botão, o "Conectar" com QR é da Sessão 4).
O Canal vira `conectada` com `conexaoSimulada = true`. Efeitos: (1) `reenfileirarPendentesDoCanal` roda na mesma transação
e o worker de saída entrega tudo pelo provedor de teste, que devolve `idExterno = "teste-<uuid>"`: o atendente vê "Enviada"
em Mensagens que nunca saíram para o WhatsApp (exatamente o que MSG-05/D-16-03 proíbem); (2) o webhook da Evolution
continua passando na verificação, porque o provedor de teste confere o mesmo segredo `webhook_segredo` do cofre, mas o
corpo da Evolution não é `{ eventos: [...] }`: `interpretarChamada` devolve `ignorado:formato_invalido`, a rota já
respondeu 200 e nenhuma Mensagem de cliente entra mais (o corpo fica só em `webhooks_recebidos`, com
`resultado = ignorado:formato_invalido`). Confiança alta na lógica (lida nos três pontos); a única parte não exercida é o
clique.
**Fix:** a transição de conexão não pode transformar em simulado um Canal que já foi real. Opções, da mais barata à mais
robusta: (a) `mudarConexao` recusa `simular_conexao` quando o provedor do Canal tem adaptador registrado
(`registroPadrao().porProvedor[canal.provedor]`) ou quando existe credencial do provedor no cofre para o Canal;
(b) a ficha só mostra "Simular conexão" para Canal que nunca foi confirmado (coluna ou marca persistente "já foi real");
(c) fazer `desconectar` de um Canal real exigir o mesmo caminho de volta (`conexao_confirmada` por provedor). Seja qual for,
cobrir com teste: Canal real desconectado + `simular_conexao` deve dar 409 e não mudar `conexao_simulada`.

## Warnings

### WR-01: Trava vencida do worker de saída reenvia ao cliente uma Mensagem que pode já ter saído

**File:** `apps/api/src/persistencia/outbox-worker.ts:353-376` (`recuperarTravasVencidas`), `apps/api/src/mensageria/entregar-mensagem.ts:145-148`
**Issue:** a política de saída promete que "o ambíguo nunca é reenviado sozinho", mas a recuperação de trava devolve
`delivering` com `locked_at` velho a `pending` (se `attempts < max`) sem saber se o provedor já aceitou. O entregador só
confere `mensagem.statusEntrega === "pendente"`; não existe marca de "tentativa de envio iniciada". Cenário: o worker chama
`provedor.enviar`, o provedor aceita, e o processo morre (SIGKILL do restart, OOM, queda do banco) antes de `gravarOAceite`
commitar. A linha fica `delivering`, volta a `pending` em 2 min, a Mensagem ainda está `pendente`, e o worker a envia de
novo: o cliente recebe duas vezes. O SIGKILL do item conhecido (c) aumenta a chance a cada publicação com envio em voo.
A janela é curta (ms), mas o dano (duplicata a cliente) é o que o desenho diz evitar.
**Fix:** antes de chamar `enviar`, gravar a tentativa de forma durável (por exemplo `status_entrega_em`/uma coluna de
"envio iniciado em", ou marcar a linha do outbox como `ambiguo` em transação própria). Na recuperação de trava (ou na
primeira linha do entregador), se a Mensagem tem a marca de "envio iniciado" e ainda não tem `id_externo`, tratar como
ambígua: marcar `falhou` com `FRASES_DA_SAIDA.semConfirmacao` em vez de reenviar.

### WR-02: `ENVIADO_SEM_REGISTRO` deixa a Mensagem `pendente` com a linha `failed`, e a reconexão do Canal a reenvia

**File:** `apps/api/src/mensageria/entregar-mensagem.ts:114-129`, `apps/api/src/mensageria/fila-de-saida.ts:88-103`
**Issue:** quando o provedor aceitou e as três tentativas de gravar o aceite falham, a linha do outbox desiste
(`ENVIADO_SEM_REGISTRO`, `failed`) mas a Mensagem continua `pendente`, sem `id_externo`. `reenfileirarPendentesDoCanal`
seleciona toda Mensagem `enviada`+`pendente` do Canal e `reenfileirarEnvio` reabre qualquer linha `failed`. Na próxima
vez que um evento `conexao` chegar, o Membro usar "Simular conexão", ou `canal:ligar-evolution` rodar de novo, essa Mensagem
(que o cliente já recebeu) é reenviada. Além disso, até lá a tela mostra "Enviando…" para sempre e a pessoa nem tem o
botão "Tentar de novo" (só existe em `falhou`). Os três retries são imediatos, sem espera, então uma queda curta do banco
os consome todos.
**Fix:** em vez de só desistir, marcar a Mensagem como `falhou` com a frase de "sem confirmação" (ou `enviada` com
`idExterno` pendente de conciliação) quando o banco voltar; no mínimo, que `reenfileirarPendentesDoCanal` só reabra linhas
`failed` com `last_error_code = 'CANAL_DESCONECTADO'` (a única razão legítima de "pendente + failed"). Colocar uma pequena
espera crescente entre as três tentativas de `gravarOAceite`.

### WR-03: O SIGTERM não fecha o servidor nem encerra o processo; o item (c) provavelmente não é causado pelas conexões SSE

**File:** `apps/api/src/index.ts:139-151` e `:336-346`
**Issue:** `aoEncerrar` registra `process.on("SIGTERM", () => void parar())` para cada worker. Com qualquer ouvinte de
SIGTERM instalado o Node deixa de encerrar sozinho, e nenhum desses ouvintes chama `app.close()`, `encerrar()` ou
`process.exit()` (isso só existe em `registroGlobal[CHAVE_DA_DESMONTAGEM]`, usado na recarga do `--watch`). Como
`fecharSentry` já era registrado sempre, o ouvinte existe desde antes da fase. O ouvinte novo do tempo real já faz
`hub.encerrarTodos()` no SIGTERM, ou seja, os fluxos SSE já são fechados quando o sinal chega, e mesmo assim o restart
estourou o `TimeoutStopSec=20`: o que segura o processo é o servidor que continua ouvindo, não as abas. Consequência:
(1) o diagnóstico de `deferred-items.md` ("fechar os fluxos SSE no SIGTERM") não resolve; (2) entre o SIGTERM e o SIGKILL
o processo antigo segue aceitando webhooks e requisições com os workers e o hub já parados, e o SIGKILL corta no meio
qualquer requisição ou entrega em voo (alimenta WR-01). Confiança média: não verifiquei se o `vite-node` instala um
tratador próprio de SIGTERM que saia do processo; se instalasse, o SIGKILL observado não ocorreria.
**Fix:** um tratador único de SIGTERM/SIGINT: parar o aceite (`app.close()`, que já espera as requisições em curso, depois de
`hub.encerrarTodos()`), esperar `Promise.all(paradas)`, `encerrar()` do pool e só então sair com `process.exit(0)`, com um
teto próprio (menor que 20 s) que force a saída.

### WR-04: A resposta sai para o Identificador principal do Contato, não para o que escreveu

**File:** `apps/api/src/mensageria/entregar-mensagem.ts:160-163`, `apps/api/src/servicos/crm/conversas.ts:469-483` (`identificadorDoCanal`)
**Issue:** `identificadorDoCanal` escolhe o Identificador `principal` do tipo do Canal (ou o primeiro). A recepção, porém,
acha o Contato pelo valor exato que escreveu (`detentorDoIdentificador`), que pode ser um Identificador secundário
(Contatos mesclados ou com dois números trazem vários). Cenário: Contato com WhatsApp A (principal) e B; o cliente escreve de
B; a Mensagem recebida guarda `identificador_id` de B; o atendente responde e a Mensagem sai para A, o número errado
(possivelmente de outra pessoa), com a Evolution real agora enviando de verdade.
**Fix:** no entregador, preferir o `identificador_id` da última Mensagem `recebida` da Conversa (já gravado em
`mensagens.identificador_id`) quando ele é do tipo do Canal e pertence ao Contato; cair no principal só se não houver
recebida. Cobrir com teste de dois Identificadores.

### WR-05: O provedor de teste acumula em memória, sem limite, tudo que enviou em produção (texto, telefone, URLs assinadas)

**File:** `apps/api/src/mensageria/provedores/teste.ts:92,139` (`enviados.push(envio)`)
**Issue:** `provedorDeTeste` é uma instância de módulo servida a todo Canal simulado, inclusive em produção (Canal de
demonstração com "Simular conexão" mais `MENSAGERIA_WORKER_ATIVO=true`). `enviar` empilha cada `EnvioAoProvedor` (conteúdo,
telefone do destino, URL assinada do anexo) num array que nunca é esvaziado fora dos testes (`limpar()`). É vazamento de
memória lento (o serviço tem `MemoryMax=1536M`) e retenção de dado pessoal no heap (visível num dump). O mapa `midias` tem o
mesmo perfil, só alimentado por teste.
**Fix:** só registrar em `enviados` quando o provedor foi criado em modo de teste (por exemplo, `criarProvedorDeTeste({ gravarEnvios: true })` nos testes e `false` no `provedorDeTeste` do registro), ou limitar o array a um anel de poucas dezenas.

### WR-06: A confirmação do anexo (download do bucket de até 25 MiB) roda dentro da transação do envio e usa uma segunda conexão do pool

**File:** `apps/api/src/servicos/crm/mensagens.ts:236-262` (dentro do `comTransacao` de `enviar`), `apps/api/src/persistencia/sessoes-de-upload.ts:90` (`obterSessao` sem cliente)
**Issue:** `armazenamento.sessao(...)` e `confirmarObjeto(...)` falam com o bucket (download inteiro, soma de verificação,
conferência de assinatura) enquanto a conexão da transação do `enviar` está aberta, e ambos pegam OUTRA conexão do
`pool()` do módulo (nenhum recebe o `cliente` da transação). Cada envio com arquivo prende 2 das 10 conexões do pool durante
a E/S de rede. Com poucos envios simultâneos o pool esgota; cada espera estoura em 10 s (`connectionTimeoutMillis`) e o
envio falha com 500, e as leituras e os workers disputam as mesmas 10 conexões. Confiança alta nos fatos; a probabilidade
depende de concorrência, que hoje é baixa.
**Fix:** conferir o arquivo (sessão, `confirmarObjeto`) ANTES de abrir a transação (a sessão só é consumida dentro dela,
por `consumirSessao(cliente, ...)`, o que já é correto), de modo que a transação só faça as escritas.

### WR-07: A chave de deduplicação da fila de entrada é o `idExterno` do PRIMEIRO evento, então a segunda chamada do mesmo id é descartada em silêncio

**File:** `apps/api/src/mensageria/provedores/teste.ts:122-128`, `apps/api/src/rotas/webhooks-de-mensageria.ts:154-159`, `apps/api/src/mensageria/provedores/evolution/provedor.ts:143-149`
**Issue:** `chaveDaChamada` do provedor de teste devolve o `idExterno` do primeiro evento qualquer, inclusive de `status`.
O índice `webhooks_recebidos_chave_uq` faz `on conflict ... do nothing` e a rota responde 200 do mesmo jeito. Cenário no
Canal simulado: a chamada de `status entregue` da Mensagem `X` e depois a de `status lida` da mesma Mensagem têm a mesma
chave; a segunda nunca entra na fila (a Mensagem fica em "Entregue"). Do mesmo jeito, um `status` com o id de uma
Mensagem recebida colide com a chamada que a trouxe. Para a Evolution isso é latente: o comentário de `provedor.ts` diz que
`key.id` "basta enquanto só `MESSAGES_UPSERT` é assinado"; quando a Sessão 4 assinar `MESSAGES_UPDATE`, o status de uma
Mensagem e a própria Mensagem partilham o `key.id` e o status seria descartado. Também, chamada com vários eventos só
deduplica pelo primeiro.
**Fix:** compor a chave com o tipo do evento (`mensagem:<id>`, `status:<id>:<status>`) e, para chamada com vários eventos,
deduplicar por evento ou deixar `chave` nula. Registrar uma nota na Sessão 4 para a chave dos eventos de atualização.

### WR-08: O cliente SSE da tela não detecta fluxo parado em silêncio

**File:** `apps/web/src/dados/tempo-real.ts:171-210` (`conectar`) e `:122-149`
**Issue:** a leitura fica em `await leitor.read()` sem prazo. O servidor manda `: batida` a cada 25 s, mas o cliente não
usa isso: se a conexão morre sem FIN (notebook que dormiu, troca de rede, NAT que derrubou), `read()` fica pendente e o
cliente acredita estar conectado. Nesse estado a releitura de 5 s do cliente está desligada (`desligarReleitura()` em
`abrir()`; só liga em `cair()`), e a recepção de Mensagem NÃO sobe a revisão do Espaço (`recebimento.ts` diz que não),
então a releitura por revisão não cobre Mensagem nova: a aba só mostra Mensagem recebida depois de recarregar ou de uma
ação que revalide a lista. Confiança média (os navegadores costumam falhar o `fetch` em parte dos casos, não em todos).
Também: `abrir()` zera `tentativas` ao primeiro byte; um servidor que abre e fecha logo em seguida produz reconexão a cada
1 s, sem crescimento da espera.
**Fix:** relógio de inatividade (por exemplo, 60 s sem nenhum byte, batida incluída, aborta o `fetch` e chama `cair()`);
zerar `tentativas` só depois de uma conexão que durou algum tempo, ou limitar a taxa de reconexão.

## Info

### IN-01: A "sombra" do webhook não esconde a existência do Canal pelo tempo

**File:** `apps/api/src/rotas/webhooks-de-mensageria.ts:88-122`
**Issue:** o comentário diz que a comparação contra a sombra evita que a existência do Canal apareça no tempo, mas o caminho
de Canal inexistente faz 1 consulta e sai, e o de Canal existente com segredo errado faz mais 2 consultas e a leitura e
decifragem do cofre antes de recusar. A diferença de tempo é muito maior que o custo de um `timingSafeEqual`. O risco é
baixo (o `id` do Canal não é adivinhável e o 401 é uniforme), mas o comentário promete algo que o código não entrega.
**Fix:** ajustar o comentário (e o CONTEXT) para não prometer, ou aceitar o custo de rodar o caminho completo com um Canal
de mentira. Também: o teto de 300/min por IP conta todos os Canais atrás do mesmo IP (a Evolution da VM) e é aplicado antes
da autenticação; uma rajada legítima acima de 5 chamadas por segundo recebe 429, o que a Evolution não repete por padrão.

### IN-02: A referência da mídia que não baixou guarda a mensagem inteira da Evolution e volta para a tela

**File:** `apps/api/src/mensageria/provedores/evolution/traduzir.ts:163-167`, `apps/api/src/mensageria/midia.ts:81`
**Issue:** `referenciaNoProvedor = JSON.stringify({ key, message })` leva o objeto de mensagem completo (campos de mídia com
chave de decifragem, caminho no CDN e miniatura em base64). Quando o download falha, `AnexoDaMensagem.referenciaExterna`
grava esse texto em `plataforma.mensagens.anexos`, e `Mensagem.anexos` é devolvido por `GET /mensagens` ao navegador. Dá
inchaço do jsonb e entrega a qualquer Membro com leitura material que só o servidor precisa. Baixo risco (mesmo Espaço,
mesma Conversa), mas é dado a mais do que a tela usa.
**Fix:** guardar só `{ key }` e os campos mínimos de `message` que o `getBase64FromMediaMessage` exige, ou deixar
`referenciaExterna` fora da forma pública da Mensagem (a tela só usa `baixado`).

### IN-03: A coleta de órfãos para na primeira pasta de Canal que falha

**File:** `apps/api/src/mensageria/coleta-de-orfaos.ts:100-118`
**Issue:** `armazenamento.listar` e `remover` não têm `try/catch` por Canal. Um erro no bucket para um Canal (pasta
inexistente, permissão, tempo esgotado) aborta a rodada inteira: os Canais seguintes não são coletados, o log de contagens
não sai e a próxima tentativa só acontece 24 h depois, sempre parando no mesmo Canal. Soma-se ao limite de 500 objetos já
conhecido (b).
**Fix:** `try/catch` por Canal, com `registrar("warn", ...)` só com contagem, seguindo para o próximo.

### IN-04: O mapa do limite de taxa nunca remove chaves

**File:** `apps/api/src/servicos/limite-de-taxa.ts:55-80` (usado em `webhooks-de-mensageria.ts:87`)
**Issue:** `marcasPorChave` guarda uma entrada por IP para sempre; só filtra as marcas, nunca apaga a chave vazia. Numa rota
pública nova, quem rotaciona IPs (um /64 de IPv6) cresce o mapa sem limite. É um utilitário antigo, mas a fase o expõe numa
rota anônima nova.
**Fix:** apagar a chave quando `marcas` fica vazia e/ou varrer o mapa de tempos em tempos.

### IN-05: A abertura do SSE só liga o ouvinte de "fechou" depois de uma ida ao banco

**File:** `apps/api/src/rotas/eventos.ts:44,76-87`
**Issue:** `hub.podeLer` (consulta ao banco) acontece antes de `request.raw.on("close", encerrar)`. Se a aba cancela nesse
intervalo (reconexões em rajada), o `close` já foi emitido e o ouvinte nunca dispara; a assinatura e o temporizador de
batida ficam até o limite de 45 min (ocupando uma das 5 vagas por Membro). Confiança baixa: depende de como o Fastify trata
um `reply.send(stream)` numa resposta já destruída.
**Fix:** registrar o `close` antes do `await`, ou checar `request.raw.destroyed` logo após o `podeLer` e sair sem assinar.

---

_Reviewed: 2026-11-10_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
