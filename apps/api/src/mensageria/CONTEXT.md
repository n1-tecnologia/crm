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
  (o tradutor diz por que descartou: grupo, sem número, reação, edição). A Mensagem digitada no celular do Canal
  (`digitadaNoAparelho`, Sessão 4, 4.4.2) é um evento `mensagem` como os outros, com o Contato como `remetente`.
- `ResultadoDoEnvio` separa `transitorio` de permanente e marca `ambiguo` quando o provedor pode ter enviado
  (timeout, resposta perdida): quem chama nunca reenvia sozinho um ambíguo.
- `CanalParaProvedor` junta o Canal, o segredo do webhook e a credencial já decifrada. Só existe dentro do
  `apps/api`, vive o tempo de uma chamada e nunca vai a log, a resposta nem a mensagem de erro.
- `baixarMidia` de qualquer implementação só fala com o host fixo do provedor (a das Sessões 7 e 8 recebe
  URL da Meta e confere o host). O provedor de teste não faz rede.
- `resolverRemetente` (opcional, Sessão 8): para o provedor cujo webhook só traz um id opaco de quem escreveu (o
  IGSID do Instagram). O processador de entrada o chama antes de `receberMensagem`, fora da transação, como a mídia,
  e ele devolve a recebida com o remetente que o Contato tem (o @). Uma exceção é transitória. Sem ele, o remetente
  de `interpretarChamada` já é o do Contato (o provedor de teste e a Evolution).

## O registro (`registro.ts`) e a regra D-16-03

`provedorDoCanal(canal)` devolve o provedor de teste SÓ quando `conexaoSimulada = true`. Um Canal real sem
implementação registrada lança `ErroDeProvedor("PROVEDOR_INDISPONIVEL")`: nunca cai no de teste, para o
atendente jamais ver "enviada" numa Mensagem que não saiu para o WhatsApp (MSG-05). Um Canal que deixa de ser
simulado perde o provedor de teste na hora.

**O Canal real não volta a simulado pela tela (CR-01, 16-17).** `POST /canais/:id/simular-conexao` num Canal com
credencial ATIVA do próprio provedor no cofre (`tipo` = o provedor do Canal, `revogado_em is null`, o que
`canal:ligar-evolution` guarda) responde 409 `TRANSICAO_INVALIDA` e não muda `conexao` nem `conexao_simulada`; a
ficha do Canal (`GET /canais/:id` devolve `ligadoAoProvedor`) esconde o botão "Simular conexão" e diz como
reconectar. Sem isso, "Desconectar" e "Simular conexão" levariam o Canal real ao provedor de teste: a saída
responderia "Enviada" sem sair e a entrada da Evolution seria descartada. O fato é lido por existência, depois do
`for update` do Canal e na mesma transação (o repositório não decifra nada). Reconectar o Canal real é o
"Conectar" com QR (Sessão 4) ou `canal:ligar-evolution`. O Canal de demonstração, sem essa credencial (só com o
segredo de teste do webhook, ou sem nada no cofre), simula como antes (D-16-03). Desde a Sessão 4 a simulação só
existe onde `PERMITIR_CONEXAO_SIMULADA=true` (4.3.4): em produção a rota nem é registrada.

`canalParaProvedor(cliente, chaves, workspaceId, canal)` lê do cofre (`servicos/cofre.ts`) o segredo do
webhook (`donoTipo: "canal"`, `tipo: "webhook_segredo"`) e, para Canal real, a credencial cujo `tipo` é o nome
do provedor. `chaves` é opcional: sem ela, a chave mestra é lida do ambiente aqui, e `rotas/` nunca importa
`servicos/cofre` (a rota só repassa a injeção dos testes).

`registroPadrao()` tem o provedor de teste sempre, a Evolution (`whatsapp-nao-oficial`) **só quando `EVOLUTION_URL`
existe** e o Instagram (`instagram-graph`, Sessão 8) **só com `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET` e
`INSTAGRAM_REDIRECT_URI`** (`provedores/instagram/do-ambiente.ts`): sem elas, um Canal real continua recusando com
`PROVEDOR_INDISPONIVEL`. A credencial do Canal é o JSON
`{ instancia, apikey }` com o token da INSTÂNCIA (nunca a chave global da Evolution), no cofre com
`tipo = "whatsapp-nao-oficial"`. A Evolution traduz `MESSAGES_UPSERT` e, desde a Sessão 4, `connection.update` e a mensagem que a pessoa digita no
celular (`fromMe`, 4.4.2, abaixo); desde a 4.4.5, o tique, a Mensagem apagada, a editada e a Reação (ver "O que muda uma
Mensagem que já existe").

## A Mensagem digitada no celular (Sessão 4, 4.4.2)

O webhook que o "Conectar" configura já assina `MESSAGES_UPSERT`, e o que a pessoa digita no WhatsApp do celular chega ali
com `key.fromMe` verdadeiro. O tradutor o entrega como `digitadaNoAparelho` e `receberMensagem` o grava como `enviada`
pelo Canal (Ator `integration`, status `enviada` no instante do provedor, sem `remetente_externo` nem `identificador_id`,
como uma `enviada` do CRM). O que difere da `recebida`:

- **Nunca reabre** uma Conversa resolvida, **nunca acorda** uma pendente e não mexe na lixeira (`destinoDaDigitadaNoAparelho`
  no domínio): usa a aberta ou pendente do par; sem ela, a última resolvida (fora da lixeira) dentro da janela de `inbox`, no
  estado em que está; senão abre uma Conversa nova (a pessoa puxou assunto pelo celular). Suposição minha, a confirmar com o
  dono: a resposta "até logo" depois de resolver não deve reabrir o atendimento.
- **Não reativa** o Contato arquivado ou na lixeira (quem escreveu foi a pessoa, não o Contato); o mesclado continua recusado.
- **Não é `recebida`**: não conta para a janela de 24 h nem escolhe por onde responder.
- **A corrida com o envio do CRM:** o socket da Evolution tem `emitOwnEvents: false`, então o que o CRM envia não deveria voltar
  como `fromMe`. Se voltar ANTES de `gravarEnvio` registrar o aceite, a cópia ficaria com o `id_externo` e o aceite quebraria no
  índice único; por isso `gravarEnvio` apaga, na mesma transação, a `enviada` do Canal como Integração que tem esse id externo
  (só quando a Mensagem do CRM ainda está `pendente`) e a do CRM fica com o id. Se voltar depois, a repetida é descartada.
- **Ainda não:** os tiques dessas Mensagens (4.4.5) e a mídia que o dono manda do celular, que nunca foi vista na Evolution
  real (o pipeline é o da `recebida`).

## O que muda uma Mensagem que já existe (Sessão 4, 4.4.5)

A Evolution manda quatro tipos de evento que não criam Mensagem, e o tradutor (`provedores/evolution/traduzir.ts`) os traduz pelos
formatos que conferi no código da 2.4.0-rc2 (**nunca vistos numa Evolution real**: a primeira conferência é a do dono, ver abaixo):

| Evento da Evolution | Vira | Detalhes |
|---|---|---|
| `messages.update` `{ keyId, remoteJid, fromMe, status }` | `status` | `SERVER_ACK` → `enviada`, `DELIVERY_ACK` → `entregue`, `READ` e `PLAYED` → `lida`, `ERROR` → `falhou`; `PENDING` é ignorado. `fromMe: false` é o recibo de uma Mensagem do Contato e é ignorado. O corpo não traz instante: vale o da chegada. A edição também chega aqui, com um `status` de enfeite e `message.editedMessage`: é descartada (`edicao_no_status`). Só a Mensagem do CRM (ou a digitada no celular) tem status, e ele só avança (`proximoStatusDeEntrega`) |
| `messages.delete` `{ remoteJid, fromMe, id, status: "DELETED" }` | `exclusao` | `fromMe` é de QUEM apagou: falso → `remetente_externo` (o Contato), verdadeiro → `celular_do_canal`. Só "apagar para todos"; apagar só para si NÃO é encaminhado pela Evolution |
| `messages.edited` (o `ProtocolMessage` cru `{ key: { id }, type, editedMessage, timestampMs }`) | `edicao` | `key.id` é a Mensagem ORIGINAL; o texto novo é `editedMessage.conversation` ou `extendedTextMessage.text`. A revogação (`type` `REVOKE`/0) também chega por aqui e é descartada (`revogacao`): quem a trata é `messages.delete`. Edição sem texto (legenda de mídia) é ignorada |
| `messages.upsert` com `message.reactionMessage { key: { id }, text }` | `reacao` | `key.id` é a Mensagem REAGIDA (não o id do evento); `text` vazio é a reação removida; o autor é o Contato, ou o `canal` quando o `key.fromMe` de fora é verdadeiro (a reação dada no celular conectado) |

O processador (`aplicarAlteracao`) aplica cada um numa transação própria, com `for update` na Mensagem de (Canal, id externo), e só
avisa as abas (`mensagem.status`: a tela relê o fio) quando algo mudou. Nunca cria Mensagem, Contato nem Conversa. O `resultado` da
linha ganha `ignorado:<reacao|exclusao|edicao>_sem_mensagem` (o CRM não tem essa Mensagem: o evento chegou antes dela, ou é de
antes da plataforma) e `ignorado:<...>_sem_efeito` (repetida, ou que não muda nada).

- **Reação** (ontologia 7.6): o registro é de ACRÉSCIMO (`proximasReacoes`); trocar o símbolo acrescenta, remover é um registro com
  símbolo vazio, e vale a última de cada autor (`reacoesVigentes`). A que chega mais velha que a vigente do mesmo autor é ignorada.
- **Exclusão** (RN-CXE-16): terminal; a primeira vale. O conteúdo e os anexos **continuam guardados** e a tela nunca os mostra
  (`MensagemApagada`; nem a citação de outra Mensagem a mostra). Se o produto passar a exigir apagar de verdade, é decisão do dono.
- **Edição** (RN-CXE-16): só a `recebida` ainda não apagada; o conteúdo passa a ser o novo e o anterior vai para
  `edicoes_externas`. A `enviada` (do CRM ou do celular) nunca é editada: "corrige-se enviando outra".
- **A chave de deduplicação do webhook** (`chaveDaChamada`) agora só existe para `messages.upsert`: o tique da mesma Mensagem
  (entregue, depois lida) repete o id e seria descartado como repetido pelo índice único de `webhooks_recebidos`.
- **A citação** (`contextInfo.stanzaId`, achado em `extendedTextMessage`, na mídia ou no topo do corpo) vira `emRespostaAIdExterno`
  e o recebimento a liga à Mensagem do mesmo Canal e da MESMA Conversa (INV-CXE-10); a citada que não existe aqui ou é de outra
  Conversa deixa a Mensagem sem ligação, sem erro. **Risco conhecido:** na 2.4.0-rc, a Evolution achata o `extendedTextMessage` em
  `conversation` e descarta o `contextInfo` do TEXTO que cita (a mídia mantém); se for assim na VM, a resposta de texto do Contato
  chega sem a citação. Só uma resposta real capturada confirma.
- **A resposta escrita na Caixa cita** (4.4.4): o entregador manda `emRespostaAIdExterno` e `emRespostaADetalhes` (se a citada foi
  do Canal e o texto, ou "📎 Anexo") e a Evolution recebe `quoted: { key: { id, remoteJid, fromMe }, message: { conversation } }` no
  topo do corpo, em texto, mídia e áudio. Sem `message`, a Evolution procuraria no banco dela e mandaria a resposta SEM citação e sem
  erro. A tela só oferece "Responder" no WhatsApp não oficial e em Mensagem com id do provedor.
- **Os eventos assinados** (`EVENTOS_DO_WEBHOOK`) são `MESSAGES_UPSERT`, `CONNECTION_UPDATE`, `MESSAGES_UPDATE`, `MESSAGES_DELETE` e
  `MESSAGES_EDITED`. Uma instância que já estava conectada guarda a lista de quando foi ligada: depois de publicar, rode
  `npm run canal:atualizar-webhook-evolution` (em "Ligar um Canal real") para reaplicá-la, sem novo QR code e sem trocar o segredo.
- **Não cobre:** reação, edição e apagada em grupo (Sessão 6); a Reação que um Membro dá pela tela (a tela só mostra); apagar "só para
  mim"; o Instagram (o tradutor dele ainda ignora `is_echo` e reações).

## O nono dígito do celular brasileiro (Sessão 4, 4.4.3)

O WhatsApp antigo entrega muitos celulares sem o nono dígito (`551187654321`) e o mesmo Contato pode estar cadastrado com ele
(`+5511987654321`): sem juntar as duas formas, a mesma pessoa virava dois Contatos. `variantesDoNumeroBrasileiro`
(`@n1/dominio/crm/normalizacao`) devolve `[com o 9, sem o 9]` do celular brasileiro (`55` + DDD + 8 dígitos que começam em 6 a 9,
com ou sem o `9` na frente) e só dele: fixo, número de fora e comprimento estranho têm uma forma só.

- **Entrada (`servicos/crm/recebimento.ts`).** O Contato é procurado pela forma que chegou primeiro e depois pela outra; o que
  tem uma das duas recebe a Mensagem (a `recebida` e a digitada no celular). Contato novo grava o Identificador na forma COM
  o 9 (o título da Conversa e o nome sem `pushName` usam essa forma), e `remetente_externo` da Mensagem guarda o número como
  chegou. Só vale para o tipo `whatsapp`; nada casa por semelhança além dessa troca do 9 (T-16-03). Se o Espaço já tem dois
  Contatos, um com cada forma, a forma que chegou vence: juntá-los é o "Mesclar" da ficha, não desta rota.
- **Saída (`entregar-mensagem.ts`).** O destino continua sendo o Identificador que `identificadorDeResposta` escolhe, e para o
  WhatsApp a resposta sai pelo número como o WhatsApp o conhece: o `remetente_externo` da última `recebida`
  (`remetenteExternoDaUltimaRecebida`), SÓ se for o mesmo celular do Identificador (`numeroParaResponderNoWhatsapp`). Qualquer
  outro valor é ignorado e a resposta sai pelo Identificador: nunca por um número que o Contato não tem.
- **Não muda nada para quem já tem Contato** com a forma que o WhatsApp entrega. Contatos duplicados que já existem não são
  mesclados sozinhos.

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
mesmo contra o seu. Quem não tem segredo por Canal nem telefone (o Instagram: a Meta assina com a chave do app, e quem
escreve é um IGSID) passa na `fabrica` as chamadas que devem ser recusadas (`chamadasRecusadas`), a forma do remetente
(`remetenteValido`), o destino do envio e os segredos extras; o cabeçalho ausente continua obrigatório para todos.

## A entrada (`processador-de-entrada.ts`)

A rota pública `POST /webhooks/mensageria/:canalId` (ver `../rotas/CONTEXT.md`) só verifica e guarda a chamada em
`plataforma.webhooks_recebidos` (a `013`); quem a esvazia é o processador, ligado por `MENSAGERIA_WORKER_ATIVO=true`.
Reivindica por `for update skip locked` (duas instâncias nunca pegam a mesma linha), devolve a trava vencida a
`pendente` (ou a `falhou/TRAVA_VENCIDA` ao esgotar as tentativas), recusa de vez a regra violada (4xx do serviço) e
tenta de novo a exceção, na escada de `backoff()`, até a 8ª. `acordar()` faz um ciclo só (a rota o chama depois do
200; os 10 s do laço são a reserva).

Cada evento do provedor tem um destino: `mensagem` vai a `receberMensagem`; `reacao`, `exclusao` e `edicao` mudam a Mensagem
existente (4.4.5, abaixo); `status` muda a Mensagem por
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
  `transitorio` (conexão recusada, 429, 502, 503, 504) volta à fila até 5 tentativas.
- **A linha que volta sem desfecho também nunca reenvia (WR-01, 16-20).** A trava vencida volta a `pending` com
  `last_error_code = 'TRAVA_VENCIDA'` (o worker, em `recuperarTravasVencidas`), e a exceção que escapa do entregador
  volta com `ERRO_DO_ENTREGADOR`: nos dois casos o processo pode ter morrido DEPOIS do aceite do provedor. Na
  reivindicação seguinte o entregador refaz as conferências e, antes do `enviar`, marca a Mensagem `falhou` com a frase
  "Sem confirmação…" e a linha `failed/ENVIO_SEM_DESFECHO`; quem reenvia é a pessoa, por "Tentar de novo". Sem marca
  de "envio iniciado" nem migração: a linha que cai entre reivindicar e chamar o provedor também vira "sem
  confirmação" (falso alarme de milissegundos, só em queda). O que falha ANTES do `enviar` (leituras do banco, recusas
  que gravam) é de quem certamente não enviou: `ERRO_ANTES_DO_ENVIO`, volta à fila na escada de `backoff()`, então
  `ERRO_DO_ENTREGADOR` só sobra para a exceção depois do `enviar`. Resíduo aceito: a linha que esgota as 5 tentativas
  em travas vencidas vai a `failed/TRAVA_VENCIDA` sem passar pelo entregador, e a Mensagem fica `pendente`.
- **O aceite que não grava (WR-02, 16-20).** Se o provedor JÁ aceitou e o banco falha ao gravar o aceite, o entregador
  tenta 3 vezes, com espera de 250 ms e 1 s (`ESPERAS_PARA_GRAVAR_O_ACEITE_MS`, `esperar` injetável). Se nada resolver,
  a Mensagem fica `falhou` com "O provedor aceitou a Mensagem, mas não deu para registrar o envio: confira no
  WhatsApp…" (a tela sai de "Enviando…" e mostra "Tentar de novo") e a linha desiste com `ENVIADO_SEM_REGISTRO`; se
  nem isso grava, a exceção sobe e a guarda acima fecha a linha como ambígua na volta seguinte.
- **O destino é por onde o Contato escreveu (WR-04, 16-21).** A resposta sai para o Identificador da última Mensagem
  `recebida` da Conversa (`identificadorDaUltimaRecebida`, o `identificador_id` que a recepção gravou), desde que ele
  ainda seja do Contato da Conversa e do tipo do Canal; sem recebida, ou com aquele Identificador transferido a outro
  Contato ou removido, sai para o principal do tipo (ou o primeiro). A regra é `identificadorDeResposta`, do domínio:
  o id de quem escreveu só ESCOLHE dentro da lista que o entregador leu com `workspace_id` e o `contato_id` da
  Conversa, então nunca sai para um número de outro Contato (T-16-19). Abrir Conversa e criar Tarefa conversacional
  usam a mesma função sem o id (`identificadorDoCanal`): continuam indo ao principal.
- Canal fora de `conectada` não tenta: a Mensagem fica `pendente` e a linha `failed` com `CANAL_DESCONECTADO`
  (`CODIGO_DO_CANAL_DESCONECTADO`, exportado por `fila-de-saida.ts`).
- `reenfileirarEnvio` reabre a linha única da Mensagem (a `013` tem índice único por Espaço, agregado e evento) e só
  toca `failed`/`delivered`, nunca `pending`/`delivering`; zera tentativas, código e trava. O parâmetro `motivo` decide
  quanto: "Tentar de novo" (`tentar_de_novo`, o padrão) reabre qualquer `failed`/`delivered`; a volta do Canal
  (`canal_voltou`) SÓ reabre `failed/CANAL_DESCONECTADO`, para nunca reenviar sozinha o que o cliente pode ter
  recebido (`ENVIADO_SEM_REGISTRO`, `ENVIO_SEM_DESFECHO`, ambíguo) nem o `delivered`. `reenfileirarPendentesDoCanal`
  varre as `pendente` do Canal na ordem de escrita (cria a linha que falta), e roda na mesma transação de "Simular
  conexão", de `conexao` real e de `canal:ligar-evolution`.
- Anexo: o entregador assina uma URL nova de cada anexo (documento com `download`) e a põe em
  `EnvioAoProvedor.anexos`. Anexo `baixado: false` numa Mensagem enviada falha com "O arquivo desta Mensagem não está
  disponível."; falha do bucket ao assinar volta à fila sem enviar.

## O tempo real (`avisar.ts`, `ouvinte-pg.ts`, `hub-de-eventos.ts`)

- **`avisarCrm(cliente, evento)`** valida o `EventoDoCrm` pelo domínio e faz `pg_notify('crm_eventos', …)` no cliente
  da transação: nada chega antes do `commit`, nada depois do `rollback`. É o único `pg_notify` do `apps/api`. O
  evento só carrega `{ tipo, conversaId, mensagemId? }` mais o Espaço, nunca texto nem telefone (limite de 8 KB do
  NOTIFY). O de Canal (`canal.mudou`, Sessão 4) leva só `{ tipo, canalId }`: ver "Quando o WhatsApp é desconectado".
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
  Sessão 4: `criarInstancia` (a chave GLOBAL; o token da instância é escolhido pelo CRM e vai no `create`, para não
  depender do formato da resposta), `pedirQrCode` (o QR só chega à tela se for base64 bem formado, `imagemDoQrCode`),
  `sairDaSessao` e `apagarInstancia` (idempotentes). `criarInstancia` e `apagarInstancia` RECUSAM qualquer nome que não
  seja `n1-...` (`ambiente.ts`): a chave global apaga a `numeropvmarcos` do Financeiro, e esta é a trava.
- `traduzir.ts`: texto, imagem, áudio, vídeo, documento (inclusive com legenda) e figurinha (`image/webp`) viram
  mensagem (com `emRespostaAIdExterno` quando citam); grupo, `status@broadcast`, `@lid` sem número, edição dentro do upsert e
  localização, contato e enquete viram `ignorado` com motivo. A reação, o tique, a apagada e a editada viram `reacao`, `status`,
  `exclusao` e `edicao` (ver "O que muda uma Mensagem que já existe"). `fromMe` (a pessoa digitou no celular) entra como `digitadaNoAparelho`, com o `remoteJid` como
  `remetente` e SEM `nomeExibido` (o `pushName` dela é o do dono do número); o que o dono manda em grupo ou no status
  continua ignorado. O instante vem só de `messageTimestamp`; a chave da instância é retirada da carga bruta
  em qualquer nível. `exemplos/` guarda os corpos de teste, sem dado real.
- `provedor.ts` (`criarProvedorEvolution`): `verificarChamada` confere o cabeçalho `x-n1-webhook-segredo` em tempo
  constante E que o `instance` do corpo é o da credencial do Canal (o segredo certo com a instância de outro Canal
  recebe a mesma 401, T-16-43). A base da URL é sempre `EVOLUTION_URL`: nenhuma URL vinda do corpo é seguida.
  `chaveDaChamada` é o `key.id` do `messages.upsert` e nada para os outros eventos (4.4.5: o tique repete o id).
- `enviar` nunca reenvia o que pode ter saído (ver "A saída"); áudio com texto sai como duas mensagens e a Mensagem
  leva um anexo só.
- O `e2e/mensageria-evolution.test.ts` prova a ida e a volta contra o servidor falso (`../testes/servidor-falso.ts`).
  **Nada rodou contra a Evolution real**: os pressupostos A1 a A4 e A10 são da prova ao vivo (16-15 e 16-16).

## O Instagram (`provedores/instagram/`)

O `ProvedorDeMensageria` do Canal `instagram-graph` (Sessão 8), ligado pelo login do Instagram (OAuth) e não por linha
de comando. A Meta chama UM endereço para todas as contas do app, então a entrada não é a rota por Canal: a rota da Meta
(`../rotas/webhook-meta.ts`) confere a assinatura e entrega a chamada a `provedores/instagram/entrada.ts`, que acha o
Canal de cada conta, confere com `verificarChamada` e grava um item por linha em `webhooks_recebidos`. Dali em diante é
o caminho de sempre: o processador (com `resolverRemetente` trocando o IGSID pelo @), `receberMensagem`, o outbox e o
worker de saída. Tudo em [`provedores/instagram/CONTEXT.md`](provedores/instagram/CONTEXT.md).

## Ligar um Canal real: `canal:ligar-evolution`

`npm run canal:ligar-evolution -w @n1/api -- --canal <id> --instancia <nome> [--seco]`
(`../bootstrap/canal-ligar-evolution.ts`, ver o `CONTEXT.md` de lá) é o único caminho, nesta fase, para um Canal
`whatsapp-nao-oficial` deixar de ser simulado: lê a instância com a chave GLOBAL da Evolution (`EVOLUTION_API_KEY`,
só na linha de comando, o cofre nunca a guarda), guarda no cofre o token da instância e um segredo novo de webhook,
aponta o webhook da instância para `<API_URL_PUBLICA>/webhooks/mensageria/<canalId>` com o segredo no cabeçalho e,
numa transação, marca o Canal `conectada` (`conexao_confirmada`, `conexao_simulada = false`) e reenfileira as
`pendente`. Recusa a instância `numeropvmarcos` (é do `automation/`). `--seco` é um ensaio que recusa como o comando
real e não escreve. Rodar de novo troca o segredo e revoga o anterior. Desde a Sessão 4 o "Conectar" com QR é o
caminho pela tela; o comando segue valendo para ligar uma instância que o dono criou à mão.

## Quando o WhatsApp é desconectado (Sessão 4)

O que o app mostra quando a instância cai, por quem a derrubou:

| O que aconteceu | Como o CRM fica sabendo | O que a tela mostra |
|---|---|---|
| O aparelho foi removido no celular ("Aparelhos conectados"), ou o logout foi pelo painel da Evolution | `connection.update` `close` com `statusReason` 401 → `desconectada` | "WhatsApp desconectado", o envio bloqueado e o link "Reconectar" (ficha do Canal) |
| A sessão caiu por outra razão (Evolution reiniciada, rede) | `connection.update` `close` com outra razão → `com_erro`; o `open` seguinte volta a `conectada` depois da conferência na fonte | "Canal com erro de conexão" e o envio bloqueado |
| A instância foi **apagada** no painel da Evolution | **nenhum webhook** (a configuração some junto): só a conferência de 5 min percebe (`instancia_inexistente` → `com_erro`) | como acima, até 5 min depois |
| O webhook se perdeu (API fora do ar, Evolution sem alcançar a API) | só a conferência de 5 min | como acima, até 5 min depois |

A conferência (`EVOLUTION_CONFERENCIA_ATIVA=true`) é a rede dos dois últimos casos; **sem ela só o webhook atualiza o estado**.
Toda mudança de conexão passa por `aplicarConexaoAoCanal`, que grava, sobe a revisão do Espaço e **avisa as abas** com
`canal.mudou` (só o id do Canal, no mesmo commit): a tela relê `/canais` e mostra o estado novo sem recarregar. As ações dos
Membros (criar, conectar, desconectar, editar, arquivar), o Instagram (conectar, erro, desautorização) e `canal:ligar-evolution`
também avisam. Repetir a conexão que o Canal já tem não avisa. Com o fluxo de eventos fora do ar a tela relê `/canais` a cada 5 s
e a cada reconexão, então um aviso perdido não deixa o WhatsApp "conectado" na tela.

## Conectar pelo CRM (Sessão 4)

`provedores/evolution/conexao.ts` (`criarConectorDaEvolution`) é o que o serviço de Canais chama. Quatro regras:

1. **Nada ali grava `conectada`.** Quem diz que conectou é a Evolution, pelo webhook `connection.update`; o processador de
   entrada, ao ver `open`, chama `conferirConexao` do provedor (`provedor.ts`): pergunta à Evolution se a instância está
   aberta e QUEM é o dono do número (`fetchInstances`, com a chave global quando há) e só então grava. Número de outro
   celular: o aparelho sai da sessão e o Canal vira `com_erro`; sem o número a linha volta à fila, nunca `conectada` às
   cegas. A única exceção é a instância que já estava aberta quando alguém clicou em "Conectar": a mesma conferência roda
   na hora.
2. **A Evolution é chamada FORA da transação.** As escritas de Canal seguram a linha do Espaço e a do Canal; segurá-las
   durante 15 s de rede travaria o Espaço. Desconectar e arquivar saem da sessão ANTES de abrir a transação (a permissão
   vem antes de tudo, então um Membro sem ela nunca dispara rede); se a Evolution falha, 502 e nada é gravado. Credencial
   recusada (401/403) ou instância que já não existe (404) NÃO travam o Canal.
3. **É idempotente.** O painel pede um QR novo a cada ~25 s chamando `conectar` de novo: instância e credencial
   existentes são reaproveitadas, e o segredo do webhook só se refaz se sumiu do cofre (um evento em voo com o segredo
   antigo levaria 401). Um resto de tentativa que parou no meio (a instância existe e o cofre não a conhece) é apagado e
   recriado, só se for do CRM. Duas abas criando juntas: o `create` que perde (403) responde "aguardando".
4. **A chave global só vive no ambiente** (`EVOLUTION_API_KEY`) e o CRM só cria/apaga `n1-<espaço>-<canal>`. Uma instância
   que o dono ligou à mão só ganha "sair da sessão" e nunca é apagada. O arquivamento apaga do cofre a credencial e o
   segredo do webhook (`repositorio.ts`); desconectar os mantém (reconectar só pede outro QR).

**O `connection.update`** (`traduzir.ts`): `open` é um aviso; `close` com a razão 401 (`DisconnectReason.loggedOut`, o
aparelho removido no celular) é `desconectada`; qualquer outra razão é queda (`com_erro`); `connecting` não muda nada. Um
`close` por queda num Canal já `desconectada` é ignorado (`conexao_perdida` do domínio); uma tentativa de conexão que
FALHOU (número errado, credencial recusada) leva até um Canal `desconectada` a `com_erro` (`tentativaFalhada` em
`aplicar-conexao.ts`, que o processador e a conferência compartilham). O significado dos `statusReason` (401 =
`DisconnectReason.loggedOut` do Baileys) e o formato exato do corpo do webhook **não foram confirmados contra a Evolution 2.4.0
instalada**: a documentação oficial não abriu e o tratador de `connection.update` do 2.3.7 não foi localizado. Por isso o
evento é só o gatilho e a verdade é a consulta à Evolution.

**A conferência de 5 min** (`conferencia.ts`, `EVOLUTION_CONFERENCIA_ATIVA=true`): para cada Canal real e ativo com
credencial, pergunta o estado da instância e corrige o banco quando diverge (celular desligado e o banco diz `conectada`:
`com_erro`; instância aberta e o banco diz `com_erro`: confere o número e volta a `conectada`). Evolution sem resposta:
NADA muda. Trava consultiva (`pg_try_advisory_lock`), uma rodada por vez, primeira rodada 30 s depois do boot, só
contagens no log.

**A fumaça** (`bootstrap/evolution-fumaca.ts`, `npm run evolution:fumaca -w @n1/api`): contra a Evolution REAL, cria uma
instância `n1-fumaca-<aleatório>` sem número, confere cada chamada do "Conectar" e a apaga. É o que fecha a dúvida do
formato real das respostas, que os testes (servidor falso) não fecham. Cada passo é independente e a limpeza roda sempre;
a saída nunca leva chave, token, QR nem corpo de resposta. Na Evolution 2.4.0 real (2026-11-11) todos os passos conferiram; a
exclusão da instância só aparece na lista ~1 s depois do `DELETE`, então o último passo repete a conferência por ~10 s. A
fumaça não escaneia QR: o `connection.update` e o `ownerJid` de uma instância aberta seguem sem prova real.

**Limite conhecido do painel:** um Canal que já está `com_erro` e falha de novo para `com_erro` não muda de estado, então a
tela não tem o que observar e continua mostrando o QR (renovado). A frase de "QR lido por outro número" só aparece quando o
estado muda depois de o painel pedir o QR.

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
| `provedores/instagram/` (`provedor.ts`, `traduzir.ts`, `entrada.ts`, `conexao.ts`, `midia.ts`, `token.ts`, `repositorio.ts`) | Sessão 8 | o Instagram, com a conexão pelo login e a desautorização da Meta |
| `provedores/meta/assinatura.ts` | Sessão 8 | a assinatura da Meta (`X-Hub-Signature-256`) e o `signed_request` |
| `../bootstrap/canal-ligar-evolution.ts`, `canal-segredo-de-teste.ts` | 16-13, 16-02 | os dois comandos de linha da mensageria |
| `provar-tempo-real.ts`, `provar-tempo-real.cli.ts` | 16-15 | `npm run tempo-real:provar`: uma volta de `LISTEN/NOTIFY` pelo pooler, para o dono provar a A9 |
