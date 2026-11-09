# mensageria

Ler primeiro: [`../../CONTEXT.md`](../../CONTEXT.md) e [`../CONTEXT.md`](../CONTEXT.md)

A entrada e a saída de rede das mensagens, sobre o domínio. O que uma Mensagem é e as regras de recebimento
estão em `@n1/dominio/crm/` (o tipo do que entra, `RecebidaDoProvedor`, está em `crm/recebimento`) e em
`servicos/crm/recebimento.ts` (`receberMensagem`, a única porta da recebida). Aqui mora o que fala com o
provedor de fora.

## A interface (`provedor.ts`)

`ProvedorDeMensageria` é a interface única: `verificarChamada`, `interpretarChamada`, `chaveDaChamada`
(opcional), `enviar`, `baixarMidia`, `estadoDaConexao`. Tudo que fala com provedor (webhook, fila de entrada,
saída, mídia, Evolution) é construído contra ela; as Sessões 4, 7, 8 e 9 só ligam uma implementação nova.

- `EventoDoProvedor` compõe o `RecebidaDoProvedor` do domínio e acrescenta `status`, `conexao` e `ignorado`
  (o tradutor diz por que descartou: grupo, `fromMe`, sem número).
- `ResultadoDoEnvio` separa `transitorio` de permanente e marca `ambiguo` quando o provedor pode ter enviado
  (timeout, resposta perdida): quem chama nunca reenvia sozinho um ambíguo.
- `CanalParaProvedor` junta o Canal, o segredo do webhook e a credencial já decifrada. Só existe dentro do
  `apps/api`, vive o tempo de uma chamada e nunca vai a log, a resposta nem a mensagem de erro.
- `baixarMidia` de qualquer implementação só fala com o host fixo do provedor (a das Sessões 7 e 8 recebe
  URL da Meta e confere o host). O provedor de teste não faz rede.

## O registro (`registro.ts`) e a regra D-16-03

`provedorDoCanal(canal)` devolve o provedor de teste SÓ quando `conexaoSimulada = true`. Um Canal real sem
implementação registrada lança `ErroDeProvedor("PROVEDOR_INDISPONIVEL")`: nunca cai no de teste, para o
atendente jamais ver "enviada" numa Mensagem que não saiu para o WhatsApp (MSG-05). Um Canal que deixa de ser
simulado perde o provedor de teste na hora.

`canalParaProvedor(cliente, chaves, workspaceId, canal)` lê do cofre (`servicos/cofre.ts`) o segredo do
webhook (`donoTipo: "canal"`, `tipo: "webhook_segredo"`) e, para Canal real, a credencial cujo `tipo` é o nome
do provedor. `chaves` é opcional: sem ela, a chave mestra é lida do ambiente aqui, e `rotas/` nunca importa
`servicos/cofre` (a rota só repassa a injeção dos testes).

`registroPadrao()` tem o provedor de teste sempre e a Evolution (`whatsapp-nao-oficial`) **só quando `EVOLUTION_URL`
existe**: sem ela, um Canal real continua recusando com `PROVEDOR_INDISPONIVEL`. A credencial do Canal é o JSON
`{ instancia, apikey }` com o token da INSTÂNCIA (nunca a chave global da Evolution), no cofre com
`tipo = "whatsapp-nao-oficial"`. Nesta fase a Evolution só traduz `MESSAGES_UPSERT`: a mensagem que a pessoa digita
no celular (`fromMe`), o `status` de entrega e o `connection.update` não são assinados nem traduzidos (Sessão 4).

## O segredo do webhook

Um nome de cabeçalho só, `x-n1-webhook-segredo` (`CABECALHO_DO_SEGREDO`), para o provedor de teste e para a
Evolution (D-16-06). Não existe segredo fixo de teste: cada Canal simulado tem o seu no cofre, gerado por
`npm run canal:segredo-de-teste -w @n1/api -- --canal <id>` (mostrado uma vez, revoga o anterior, recusa Canal
real). O provedor de teste compara em tempo constante e recusa a chamada sem segredo ou com outro valor.

## O provedor de teste (`provedores/teste.ts`)

Serve ao CI e à demonstração da Caixa num Canal simulado. Corpo aceito: `{ eventos: [...] }` com três formas
(`mensagem`, `status`, `conexao`), validado por zod `.strict()`. `enviar` grava em memória e devolve
`idExterno = "teste-<uuid>"` (ou o próximo resultado programado) e recusa Canal real; `baixarMidia` lê só do
depósito em memória.

## O conjunto de contrato (`contrato-do-provedor.ts`)

`descreverContratoDoProvedor(nome, fabrica)` registra os casos que valem para qualquer implementação (segredo,
tradução de texto, corpo inválido sem exceção, envio, teto de mídia, nenhum segredo em resultado ou erro).
`provedor.test.ts` o roda contra o de teste; a Evolution (16-12) e os provedores das Sessões 4, 7, 8 e 9 rodam o
mesmo contra o seu.

## A entrada (`processador-de-entrada.ts`)

A rota pública `POST /webhooks/mensageria/:canalId` (ver `../rotas/CONTEXT.md`) só verifica e guarda a chamada em
`plataforma.webhooks_recebidos` (a `013`); quem a esvazia é o processador, ligado por `MENSAGERIA_WORKER_ATIVO=true`.
Reivindica por `for update skip locked` (duas instâncias nunca pegam a mesma linha), devolve a trava vencida a
`pendente` (ou a `falhou/TRAVA_VENCIDA` ao esgotar as tentativas), recusa de vez a regra violada (4xx do serviço) e
tenta de novo a exceção, na escada de `backoff()`, até a 8ª. `acordar()` faz um ciclo só (a rota o chama depois do
200; os 10 s do laço são a reserva).

Cada evento do provedor tem um destino: `mensagem` vai a `receberMensagem`; `status` muda a Mensagem por
`atualizarStatusDeEntrega` (sem regredir: `lida` seguida de `entregue` atrasado continua `lida`) e só avisa a tela se
mudou; `conexao` só muda Canal real (o simulado é `ignorado:conexao_simulada`), sobe a revisão do Espaço e, quando o
Canal fica `conectada`, reenfileira as Mensagens `pendente` dele. O `resultado` da linha diz o que aconteceu:
`ignorado:<motivo>` do tradutor, `ignorado:status_atrasado`, `ignorado:status_sem_mensagem`,
`ignorado:conexao_simulada`, `ignorado:canal_nao_encontrado`, `ignorado:canal_arquivado`, `midia_pendente` (a mídia
falhou de forma que pede nova passada), `midia_indisponivel` (a terceira passada desistiu) e
`sem_tratamento:<tipo>`, que só existe como rede de segurança para um tipo de evento que o código ainda não conhece.

O `corpo` da chamada é dado pessoal: só o banco o guarda (com a chave do provedor retirada do topo antes do
`insert`), nunca log. A política de retenção dele é da Sessão 19.

## A saída (`entregar-mensagem.ts`, `fila-de-saida.ts`)

A Mensagem `enviada` nasce `pendente`. Num Canal `conectada`, `enfileirarEnvio` grava `mensagem.enviar.v1` (só ids)
no outbox, pelo mesmo `PoolClient` da Mensagem, nos três pontos que gravam Mensagem enviada. O worker de saída é um
`OutboxWorker` com `tiposDeEvento: ["mensagem.enviar.v1"]` e `entregador` próprio (o worker antigo do `automation/`
ignora `mensagem.%`): `criarWorkerDeSaida`, id `${MENSAGERIA_WORKER_ID}-saida`, ligado pela MESMA
`MENSAGERIA_WORKER_ATIVO` que o processador de entrada. Entrega por `provedorDoCanal(canal).enviar` e a Mensagem vai
de `pendente` a `enviada` (com `id_externo`) ou `falhou` (com `motivoFalha` em frase de produto).
`recuperarTravasVencidasMs` devolve a linha travada (só dos tipos do worker) e `acordar()` faz uma volta única: o
ouvinte do tempo real o chama a cada `mensagem.nova`/`mensagem.status`, e o processador de entrada, depois do commit
(`acordarSaida`).

- **O ambíguo nunca é reenviado sozinho.** Tempo esgotado, resposta perdida, 500 e 2xx sem id são `ambiguo`: a
  Mensagem vira `falhou` com a frase "Sem confirmação do provedor…", e só a pessoa reenvia, por "Tentar de novo".
  `transitorio` (conexão recusada, 429, 502, 503, 504) volta à fila até 5 tentativas. Se o provedor JÁ aceitou e o
  banco falha ao gravar o aceite, o entregador tenta gravar de novo e, se nada resolver, a linha desiste com
  `ENVIADO_SEM_REGISTRO` em vez de voltar à fila (repetir reenviaria ao cliente).
- Canal fora de `conectada` não tenta: a Mensagem fica `pendente` e a linha `failed` com `CANAL_DESCONECTADO`.
- `reenfileirarEnvio` reabre a linha única da Mensagem (a `013` tem índice único por Espaço, agregado e evento) e só
  toca `failed`/`delivered`, nunca `pending`/`delivering`; zera tentativas e trava. `reenfileirarPendentesDoCanal`
  varre as `pendente` do Canal na ordem de escrita, e roda na mesma transação de "Simular conexão", de
  `conexao` real e de `canal:ligar-evolution`.
- Anexo: o entregador assina uma URL nova de cada anexo (documento com `download`) e a põe em
  `EnvioAoProvedor.anexos`. Anexo `baixado: false` numa Mensagem enviada falha com "O arquivo desta Mensagem não está
  disponível."; falha do bucket ao assinar volta à fila sem enviar.

## O tempo real (`avisar.ts`, `ouvinte-pg.ts`, `hub-de-eventos.ts`)

- **`avisarCrm(cliente, evento)`** valida o `EventoDoCrm` pelo domínio e faz `pg_notify('crm_eventos', …)` no cliente
  da transação: nada chega antes do `commit`, nada depois do `rollback`. É o único `pg_notify` do `apps/api`. O
  evento só carrega `{ tipo, conversaId, mensagemId? }` mais o Espaço, nunca texto nem telefone (limite de 8 KB do
  NOTIFY).
- **O ouvinte** (`criarOuvinteDoCrm`) é uma conexão `LISTEN` por processo, FORA do pool (`keepAlive`, sem
  `query_timeout`, mesmo TLS do pool): soma 1 à contagem de conexões do processo. Cair desliga o hub (`aoCair`), que
  encerra os fluxos, e reconecta com espera de 1 s a 30 s; com `DATABASE_SSL_INSECURE` ou sem CA o `construirSsl`
  lança ao subir e o hub fica indisponível. `TEMPO_REAL_ATIVO=false` não sobe o ouvinte e `GET /eventos` responde 503.
- **O hub** (`criarHubDeEventos`) filtra por `workspaceId`, reconfere o Papel de cada Membro a cada 60 s, aceita no
  máximo 5 fluxos por Membro e `encerrarTodos` roda antes do `app.close()`. Não existe evento "ressincronizar": a
  tela relê tudo ao reconectar.
- Avisam: a recebida, `enviar`, abrir Conversa, o entregador (enviada e falhou, cada um em transação própria), o
  `status` do provedor (só se mudou), "Tentar de novo" e os seis gestos da Conversa. **Sem aviso** (a tela cobre pela
  releitura de 5 s da revisão): mesclar Contato, sucessão do Membro, marcação (estrela e leitura), troca de Canal e
  vínculo de Negócio da Tarefa conversacional e "Simular conexão".
- **Pressuposto A9 ainda sem prova:** que o pooler de sessão (5432) com o `n1_api` entrega `LISTEN/NOTIFY`, e que o
  nginx não segura o SSE (`X-Accel-Buffering: no`). Só o dono prova, ao vivo: `npm run tempo-real:provar -w @n1/api`
  mede uma volta de `LISTEN/NOTIFY` pelo pooler (não grava nada e não imprime URL, host nem senha; 16-15) e o SSE
  pelo nginx da VM fecha em 16-16.

## A mídia (`midia.ts`, `coleta-de-orfaos.ts`)

- **`criarGuardaDeMidia`** (`guardarAnexosRecebidos`): baixa pelo provedor com o teto do tipo (leitura em fluxo,
  aborta no teto), confere o tipo devolvido, confere a assinatura contra o conteúdo inteiro e sobe pela porta
  `ArmazenamentoDeAnexos` em `workspace/<ws>/entrada/<canalId>/<uuid>`. A falha é transitória (rede, provedor,
  bucket) ou permanente (teto, tipo, assinatura, `MIDIA_INDISPONIVEL`).
- O processador baixa ANTES da transação e grava a Mensagem mesmo quando a mídia falhou (`baixado: false` com
  `referenciaExterna`): a linha volta a `pendente` com `midia_pendente` e a passada seguinte COMPLETA a mesma Mensagem
  (`completarAnexos`, só em `recebida`, e avisa `mensagem.status`); na terceira passada fecha `processado` com
  `midia_indisponivel`. Nunca derruba a Mensagem (D-16-08).
- **Log `mensageria.etapas`**: uma linha por chamada com `webhookId`, `esperaMs`, `baixarMs`, `subirMs`,
  `transacaoMs`, `totalMs` e `anexos`; é a medição da prova ao vivo. O `totalMs` é a espera na fila mais o trabalho
  da passada, sem o tempo do webhook até a fila nem a entrega do SSE à aba.
- **`criarColetaDeOrfaos`**: uma vez por dia, sob `pg_try_advisory_lock`, apaga as sessões de upload expiradas que
  ainda têm objeto e os objetos de `entrada/` com mais de 1 h que nenhuma Mensagem do Canal cita. Log só com três
  contagens. Desligada por padrão: `COLETA_DE_ORFAOS_ATIVA=true`. Limites abertos (`../../../../.planning/phases/16-*/deferred-items.md`):
  só enxerga os 500 primeiros objetos de cada pasta de Canal e a primeira coleta só roda 24 h depois do boot.

## A Evolution (`provedores/evolution/`)

Adaptador mínimo da Evolution v2 para o Canal `whatsapp-nao-oficial` (D-16-04 a D-16-06):

- `cliente.ts` (`criarClienteDaEvolution`): `versao`, `buscarInstancia` (devolve `ownerJid` e `token`, nulos se a
  Evolution não os trouxer), `estadoDaConexao`, `configurarWebhook`, `enviarTexto`, `enviarMidia`, `enviarAudio` e
  `baixarMidia` (leitura em fluxo, corte em `ceil(teto × 4/3) + 64 KiB`, base64 conferido). Tempo limite de 15 s.
  Falta, para a Sessão 4: criar instância, QR code, sair e apagar.
- `traduzir.ts`: texto, imagem, áudio, vídeo, documento (inclusive com legenda) e figurinha (`image/webp`) viram
  mensagem; `fromMe`, grupo, `status@broadcast`, `@lid` sem número, reação, edição e localização, contato e enquete
  viram `ignorado` com motivo. O instante vem só de `messageTimestamp`; a chave da instância é retirada da carga bruta
  em qualquer nível. `exemplos/` guarda os corpos de teste, sem dado real.
- `provedor.ts` (`criarProvedorEvolution`): `verificarChamada` confere o cabeçalho `x-n1-webhook-segredo` em tempo
  constante E que o `instance` do corpo é o da credencial do Canal (o segredo certo com a instância de outro Canal
  recebe a mesma 401, T-16-43). A base da URL é sempre `EVOLUTION_URL`: nenhuma URL vinda do corpo é seguida.
  `chaveDaChamada` é o `key.id`, o que basta enquanto só `MESSAGES_UPSERT` é assinado.
- `enviar` nunca reenvia o que pode ter saído (ver "A saída"); áudio com texto sai como duas mensagens e a Mensagem
  leva um anexo só.
- O `e2e/mensageria-evolution.test.ts` prova a ida e a volta contra o servidor falso (`../testes/servidor-falso.ts`).
  **Nada rodou contra a Evolution real**: os pressupostos A1 a A4 e A10 são da prova ao vivo (16-15 e 16-16).

## Ligar um Canal real: `canal:ligar-evolution`

`npm run canal:ligar-evolution -w @n1/api -- --canal <id> --instancia <nome> [--seco]`
(`../bootstrap/canal-ligar-evolution.ts`, ver o `CONTEXT.md` de lá) é o único caminho, nesta fase, para um Canal
`whatsapp-nao-oficial` deixar de ser simulado: lê a instância com a chave GLOBAL da Evolution (`EVOLUTION_API_KEY`,
só na linha de comando, o cofre nunca a guarda), guarda no cofre o token da instância e um segredo novo de webhook,
aponta o webhook da instância para `<API_URL_PUBLICA>/webhooks/mensageria/<canalId>` com o segredo no cabeçalho e,
numa transação, marca o Canal `conectada` (`conexao_confirmada`, `conexao_simulada = false`) e reenfileira as
`pendente`. Recusa a instância `numeropvmarcos` (é do `automation/`). `--seco` é um ensaio que recusa como o comando
real e não escreve. Rodar de novo troca o segredo e revoga o anterior. A Sessão 4 troca o comando pelo botão
"Conectar" com QR.

## Regra de log

Nada aqui loga corpo, texto de Mensagem, telefone, segredo, credencial nem `apikey`. Log de erro leva o
código e o id interno, nunca o conteúdo. As únicas linhas de dado são as contagens da coleta de órfãos e o
`mensageria.etapas`, que só leva tempos e contagens.

## Mapa dos arquivos

| Arquivo | Plano | O que é |
|---|---|---|
| `provedor.ts`, `registro.ts`, `provedores/teste.ts`, `contrato-do-provedor.ts` | 16-02 | a interface, o registro, o provedor de teste, o contrato |
| `processador-de-entrada.ts` | 16-03, 16-06, 16-10 | a fila de entrada e quem a esvazia (mensagem, status, conexão, mídia) |
| `fila-de-saida.ts` | 16-04, 16-06 | `enfileirarEnvio`, `reenfileirarEnvio`, `reenfileirarPendentesDoCanal` |
| `entregar-mensagem.ts` | 16-05, 16-10 | o entregador e o worker de saída (`mensagem.enviar.v1`) |
| `avisar.ts`, `ouvinte-pg.ts`, `hub-de-eventos.ts` | 16-07 | o tempo real: NOTIFY, `LISTEN` fora do pool, hub do SSE |
| `midia.ts`, `coleta-de-orfaos.ts` | 16-10 | baixar e guardar a mídia recebida; a coleta diária de órfãos |
| `provedores/evolution/` (`cliente.ts`, `traduzir.ts`, `provedor.ts`, `exemplos/`) | 16-12 | a Evolution |
| `../bootstrap/canal-ligar-evolution.ts`, `canal-segredo-de-teste.ts` | 16-13, 16-02 | os dois comandos de linha da mensageria |
| `provar-tempo-real.ts`, `provar-tempo-real.cli.ts` | 16-15 | `npm run tempo-real:provar`: uma volta de `LISTEN/NOTIFY` pelo pooler, para o dono provar a A9 |
