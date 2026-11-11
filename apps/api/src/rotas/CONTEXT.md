# rotas

Ler primeiro: [`../../CONTEXT.md`](../../CONTEXT.md) e [`../CONTEXT.md`](../CONTEXT.md)

HTTP ↔ serviço. Um arquivo por recurso. Sem regra de negócio e sem acesso a banco: a rota lê a requisição, chama um serviço e formata a resposta.

Os arquivos deste diretório, desde o Plan 01-04 (`esquemas-de-argumentos.ts` chegou no Plan 01-11; a pasta `esquemas/` nos Plans 01-12..01-16):

- `operacoes.ts` — `POST /operacoes/:nome`, genérica sobre `OPERACOES` (o registro explícito de `@n1/dominio`, uma entrada por operação de domínio alcançável por HTTP).
- `estado.ts` — `GET /estado`, a carga inicial do Espaço de Trabalho.
- `gesto-no-crm/` — as tabelas do gesto misto de `POST /operacoes/:nome` (Fase 15, 15-01): `LER_DO_CRM` (o que a operação confere contra as tabelas do CRM antes de decidir) e `AO_CONFIRMAR` (o que grava nelas no mesmo commit), um arquivo por módulo (`estrutura.ts`, `membros.ts`, `ferramentas.ts`, `ia.ts`, `financeiro.ts`), compostas em `index.ts`, que lança se uma operação aparece em dois módulos. É o mapa de leituras do CRM: `operacoes.ts` só o consome.
- `esquemas-de-argumentos.ts` — compõe `esquemas/<modulo>.ts` (um por módulo do domínio) sob `satisfies EsquemasCompletos`: toda operação de `OPERACOES` tem schema; a rota valida antes de `executar()`, forma errada é 400, regra de negócio continua no domínio (recusa em 200).
- `esquemas/` — a FORMA dos `args` por operação (tipos espelhados da assinatura do domínio, não regras), um arquivo por módulo — ver [`esquemas/CONTEXT.md`](esquemas/CONTEXT.md).

**A resposta de `POST /operacoes/:nome` sai recortada (Fase 9, 1.1.5, F1).** Depois de `executar()` (nunca dentro do callback: o evento de outbox do Canal continua derivado do estado inteiro), a rota calcula UM `visibilidadePara` sobre o estado depois da operação e devolve `diferenca` por `recortarDiferenca`, `value` por `recortarValor` e `sequencia` do estado inteiro. O ramo de `SERVICOS` (`inviteMember`) passa pelo mesmo envio: `convidarMembro` aceita `deps.aoTerminar(state)`. Antes de validar o argumento, um Membro `suspenso` recebe 403 (`recusaDeSuspenso`, `../plugins/autenticacao.ts`, 1.2.1): ele consulta, mas toda operação do registro grava.

**A linha de medição de `POST /operacoes` (Fase 12, D-02/D-03).** Toda gravação — 200, recusa do domínio (200 `ok:false`), 409 e 500 — escreve UMA linha `request.log.info` com `msg` `"gravacao medida"`, sempre ligada, sem variável de ambiente: `{ operacao, medicao: { conexaoMs, inicioMs, travaMs, hidratarMs, operacaoMs, atualizaMs, gravarMs, eventosMs, commitMs, tentativas, linhasLidas, linhasGravadas, desfecho, recorteMs?, totalMs } }`. Os `*Ms` são milissegundos com uma casa decimal, somados entre as tentativas de `executar()` (`tentativas` diz quantas); `desfecho` é `gravou`, `recusou`, `conflito` ou `excecao`. `recorteMs` é a etapa do recorte por Membro (`visibilidadePara` + `recortarDiferenca` + `recortarValor`, SEG-01) e só existe quando a rota recortou; `totalMs` vai do começo do handler até a resposta. Os caminhos 400/403/404 não gravam e não escrevem a linha. A medição chega à rota pelo callback `aoMedir` de `executar()` (e de `convidarMembro`, para `inviteMember` em `SERVICOS`) — nunca por campo do resultado — e **nunca** sai no corpo nem em cabeçalho da resposta (`Server-Timing` incluso): `operacoes-medicao.test.ts` afirma a ausência da chave `medicao` em 200, recusa, 409, 500 e `inviteMember`. A linha só leva o nome da operação (já validado por `ehNomeDeOperacao`), números e o desfecho: nunca `args`, `value`, título, nome de Contato, e-mail ou valor financeiro. Para ler na VPS: `sudo journalctl --no-pager -u n1-crm-api.service -n 80 | grep "gravacao medida"`. O comando `gravacao:medir` (12-02) lê esta mesma linha; mudar um campo é mudar o contrato dele.

**O suspenso também não grava pelas rotas REST (Fase 9, 09-12, 1.2).** Financeiro, anexos da Tarefa e CRM registram `recusarSuspensoNaEscrita` (`../plugins/autenticacao.ts`) como hook `preValidation` na primeira linha do plugin: método fora de GET/HEAD/OPTIONS e Membro que não está `ativo` recebem 403 `SUSPENSO` antes de validar o corpo. Desde a Sessão 12 (12.1.5 B) o hook de autenticação já recusa o suspenso em toda rota, leitura também; esta conferência ficou como segunda barreira. Rota nova com JWT é coberta sozinha por `../seguranca/inventario-de-rotas.test.ts`, que ouve `onRoute`; rota nova SEM JWT precisa entrar em `ROTAS_PUBLICAS` lá, com o motivo.

**Entrada hostil e IP forjado (Fase 9, 09-15, D-14).** `app.ts` remove o parser embutido de `text/plain` do Fastify: nenhuma rota recebe esse tipo, então ele volta 415 (e não 400 depois de ler o corpo como texto). `../seguranca/entrada-hostil.test.ts` prova 413 (corpo acima de 1 MiB), 415, 400 para aninhamento além do reviver e para `__proto__`/`constructor.prototype`, sem 500 e sem tocar o banco; `../seguranca/xff-e-trust-proxy.test.ts` prova que o balde do limite por IP é o IP que o nginx anexou à direita do `X-Forwarded-For` (`TRUST_PROXY=loopback`) e que o cabeçalho é ignorado fora do loopback ou com `TRUST_PROXY` vazio; `../seguranca/segredos-publicos.test.ts` prova o 404 uniforme e o 429 com `Retry-After` nos links públicos. Rota nova que precise de `text/plain` registra o próprio parser.

A regra continua: a rota chama `executar()` da Unidade de Trabalho (`../persistencia/unidade-de-trabalho.ts`) e traduz o resultado para HTTP — nunca SQL, nunca regra de negócio aqui. Toda rota registrada depois do hook de `../plugins/autenticacao.ts` exige `Authorization: Bearer`, a menos que se marque `config: { publica: true }`.

## Convite e reenvio (Sessão 12)

| Rota | O quê | Quem |
|---|---|---|
| `POST /convites/aceitar` | `{ nome }`; roda `aceitarConvite` com o Membro da sessão (`convites.ts`) | só o Membro `pendente` com Usuário; a única rota `aceitaPendente` |
| `POST /membros/:id/convite` | reenvia o convite pelo Supabase Auth (`membros.ts`, serviço `../servicos/reenviar-convite.ts`); 409 quando a pessoa já tem conta ou já criou a senha; 429 no limite de envio | Administrador ou Proprietário ativo (`registrarReenvioDoConvite`) |

O convite (`POST /operacoes/inviteMember`, serviço `../servicos/convidar-membro.ts`) manda e-mail pelo Auth quando o e-mail ainda não tem conta. Os dois serviços ENSAIAM a regra do domínio sobre o estado lido antes de falar com o Auth: nenhum e-mail sai de um pedido que seria recusado. O Auth entra por injeção (`AuthDeConvite`, `../autenticacao/auth-de-convite.ts`, e `membros.auth` em `buildApp`); os testes passam um falso e nunca o Supabase real.

## Rotas de integração (v1)

`integracao-solicitacoes.ts` — `rotasDeIntegracaoDeSolicitacoes(app)` — as sete rotas `/v1/integrations/payment-requests/*` (Plan 02-13): o lado servidor dos sete métodos do adapter que `docs/08-migracao-financeiro/04-contrato-plataforma-v1.md` congela para `automation/`. `esquemas/integracao-solicitacoes.ts` compõe a forma de `params`/`query`/`body`/`headers` inteiramente a partir de `../contratos/v1.ts` (`EsquemasV1`), sem redefinir forma.

Por que não passam por `POST /operacoes/:nome`: o despacho genérico exige Membro humano (`request.membro`, resolvido de JWT do Supabase) e não tem idempotência HTTP. Estas sete rotas vivem sob credencial de SERVIÇO (`request.servico`, `../plugins/autenticacao-servico.ts`, Plan 02-09) e toda escrita exige `Idempotency-Key`, passando por `../servicos/idempotencia.ts::comIdempotencia` — um conceito que `/operacoes/:nome` não tem porque o cliente humano (a tela) não repete requisição por timeout do jeito que um `automation/` do outro lado de uma rede repete.

O contrato manda: mudar uma resposta destas rotas é mudar `docs/08-migracao-financeiro/04-contrato-plataforma-v1.md`, `../contratos/v1.ts` (schemas) e as fixtures de `contratos/payment-requests-v1/` (raiz do monorepo) no mesmo commit — nunca só o código da rota. Ver `../contratos/CONTEXT.md`, "Regra de mudança".

## Rotas públicas do Formulário

`formularios-publicos.ts` — `rotasDeFormulariosPublicos(app, { workspaceId })` — as três rotas SEM `Authorization: Bearer` desta instância (D-02, Plan 02-16): `GET /v1/public/forms/:secret` (o DTO sanitizado), `POST /v1/public/forms/:secret/uploads` (o ticket de upload, Plan 02-11) e `POST /v1/public/forms/:secret/submissions` (o envio atômico — Tarefa, Campos, anexos, Atividade e evento de outbox no mesmo commit). `esquemas/formularios-publicos.ts` compõe `PARAMS_SEGREDO`/`CORPO_TICKET`/`CORPO_SUBMISSAO` — a única pasta de `esquemas/` que não espelha um módulo de `packages/dominio/src/operations/`, porque a forma que valida aqui é a borda HTTP de uma superfície pública, não os `args` de uma operação.

Por que não passam por `POST /operacoes/:nome`: a rota genérica exige `request.membro` (Membro autenticado); o link público (`/f/<segredo>`) nunca tem sessão. As três rotas se isentam com `config: { publica: true }`, a mesma marca que `GET /saude` usa (`../plugins/autenticacao.ts`).

## Rotas REST do CRM (Fase 7)

`rotas/crm/` — `rotasDeCrm(app, opcoes)` — um recurso por arquivo: `contatos.ts`,
`empresas.ts` (Empresa e o vínculo Contato-Empresa), `funis.ts` (Funil,
Etapas e o padrão) e `negocios.ts` (o CRUD e as ações do quadro: mover,
ganhar, perder, reabrir). `comum.ts` tem os fragmentos zod compartilhados e
o envelope; `index.ts` monta os quatro sobre os serviços reais de
`../servicos/crm/` (ou sobre um serviço falso injetado por
`buildApp({ crm })`, nos testes sem banco). Registrado na raiz de `app.ts`,
depois de `rotasDeFinanceiro`: herda o hook de JWT e `request.membro` chega
resolvido.

**Por que não passam por `POST /operacoes/:nome` (D-03).** O CRM tem tabelas
próprias (`007-crm.sql`), não vive em `plataforma.registros` nem no
`DataState` que `GET /estado` hidrata; cada recurso é REST por caminho
(`GET`/`POST`/`PATCH`/`DELETE`, e o único `PUT`, `/funis/:id/etapas/ordem`).

**Envelope.** Sucesso de item `{ ok: true, dados }`; sucesso de lista
`{ ok: true, itens, total }`; erro `{ ok: false, error, codigo?, campo?,
bloqueios? }`. Status: **400** forma (zod, pelo `setErrorHandler` de
`app.ts`, e `VALOR_INVALIDO` com `campo` para valor mal formado que só o
serviço detecta); **403** Papel (`PERMISSAO`, D-14); **404** não existe
NESTE Espaço (`*_NAO_ENCONTRADO`); **409** regra ou integridade, com
`codigo` e, quando há quem bloqueie, `bloqueios` (D-07/D-08/D-09:
`negocios` com `total` e `itens`, `empresas`, `filiais`, `contatos`). É uma
divergência deliberada de `/operacoes`: ali a recusa do domínio viaja em
200 dentro do `OperationResult`; aqui **recusa nunca viaja em 200**.

**Forma.** Corpos `.strict()`: `workspaceId`, `criadoPor`, `estado`,
`situacao`, `padrao` e `encerradoEm` não viajam (T-07-02) — o Espaço e o
Membro vêm da sessão, o estado muda por rota própria (`/arquivar`,
`/restaurar`, `DELETE` = lixeira, `/permanente`), o padrão por
`POST /funis/:id/padrao`, a situação por `/ganhar`, `/perder`, `/reabrir`.
Tetos de tamanho de `LIMITES_CRM` (`@n1/dominio/crm/comum`). `DELETE` e
ações sem corpo **não declaram `body`**, e os corpos opcionais (`ganhar`,
`perder`, `reabrir`, `encerrar`, `restaurar` de Empresa) são `.nullish()`:
o Fastify 5 entrega `null` sem corpo e recusa `content-type: json` sem
corpo (Pitfall 4).

A regra continua a deste arquivo: a rota lê a requisição, chama o serviço e
formata a resposta. Nenhum SQL e nenhuma regra de negócio em `crm/`.

**Notas do Contato e transferência de Identificador (Fase 14, 14-06).**
Três rotas ao lado das de Contato, nas tabelas da 011:

- `GET /contatos/:id/notas` — as notas do Contato, a mais recente primeiro,
  `{ ok: true, itens, total }`. Querystring só `limite` (teto de
  `LIMITES_CRM.paginaMaxima`) e `deslocamento`; `estado` e `q` são 400.
  Qualquer Membro ativo lê (o suspenso não entra: 12.1.5 B), inclusive de Contato `mesclado` ou
  na lixeira (o histórico não some com o estado).
- `POST /contatos/:id/notas` — corpo `{ conteudo }` (`.strict()`, aparado,
  1 a 5000 caracteres), **201** com a nota. O autor é sempre o Membro da
  sessão: `autorId`, `contatoId` e `workspaceId` no corpo são 400 (T-14-13).
  Papel `editar` em `contato`: o Convidado é 403 e o Membro suspenso também.
  Recusas: 400 `VALOR_INVALIDO` (campo `conteudo`), 404
  `CONTATO_NAO_ENCONTRADO` (outro Espaço), 409 `NOTA_RECUSADA` (Contato
  `mesclado` ou na lixeira, com a frase do domínio). A nota é só texto
  (D-04). Desde a Fase 15 o fio da Caixa (15-25) e a Reunião (15-15) escrevem aqui.
- `POST /contatos/:id/identificadores/:identificadorId/transferir` — corpo
  `{ paraContatoId }` (`.strict()`: `principal` é 400, quem decide é o
  serviço), 200 com a ficha da ORIGEM. O Identificador chega ao destino como
  principal só se o destino não tem principal do tipo; na origem, se era o
  principal, o mais antigo do mesmo tipo é promovido. As Conversas e as
  Mensagens passadas ficam na origem (DO-CON-12); depois da transferência o
  detentor do número é o destino. Papel `editar` em `contato`. Recusas: 404
  `CONTATO_NAO_ENCONTRADO` (origem ou destino de outro Espaço; o destino
  traz `campo: "paraContatoId"`), 404 `IDENTIFICADOR_NAO_ENCONTRADO`, 409
  `CONTATO_MESCLADO` (origem absorvida), 409 `TRANSFERENCIA_RECUSADA` com
  `campo` (`paraContatoId`: o mesmo Contato, destino `mesclado`, destino na
  lixeira ou com Identificadores demais; `nome`: a origem ficaria sem Nome e
  sem Identificador, INV-CON-01).

**Consentimento do Contato (Fase 14, 14-08, 3.2.4).** Duas rotas ao lado das de
Contato, sobre `plataforma.contato_consentimentos` (011), que é SÓ INSERÇÃO:

- `GET /contatos/:id/consentimentos` — o histórico do Contato, o mais recente
  (por `em`) primeiro, `{ ok: true, itens, total }`, sem paginação. A tela
  calcula o vigente por finalidade e tipo de Canal com `consentimentoVigente`
  do domínio. Qualquer Membro ativo lê (o suspenso não entra: 12.1.5 B), inclusive de Contato
  `mesclado` ou na lixeira.
- `POST /contatos/:id/consentimentos` — corpo `{ finalidadeId, tipoDeCanal,
  decisao, origem, em?, evidenciaMensagemId? }` (`.strict()`), **201** com a
  linha. Os três vocabulários são os do domínio (cópia da 011). Revogar é um
  `POST` com `decisao: "revogado"`: a linha anterior continua, e não há
  `PUT`, `PATCH` nem `DELETE` (o repositório também não tem `update` nem
  `delete`). `registradoPor`, `registradoEm`, `contatoId` e `workspaceId` no
  corpo são 400 (T-14-19): o registrador é o Membro da sessão e `registrado_em`
  é do banco. Papel `editar` em `contato`: o Convidado é 403.
  Recusas: 400 `VALOR_INVALIDO` com `campo` `finalidadeId` (não é item ativo
  `finalidadeConsentimento` do Catálogo DESTE Espaço), `evidenciaMensagemId`
  (não é Mensagem de uma Conversa deste Contato neste Espaço) ou `em` (no
  futuro); 404 `CONTATO_NAO_ENCONTRADO` (outro Espaço); 409
  `CONSENTIMENTO_RECUSADO` (Contato `mesclado` ou na lixeira; o arquivado
  aceita). Não grava Registro de Atividade nem avança a revisão do Espaço, e
  nada de consentimento entra em `GET /estado`.

**Mesclar Contatos (Fase 14, 14-09, 3.2.2).** Uma rota ao lado das de Contato:

- `POST /contatos/:id/mesclar` — corpo `{ absorvidoId }` (`.strict()`). O
  sobrevivente é o `:id` da rota, nunca um campo do corpo (`sobreviventeId` e
  `workspaceId` no corpo são 400). **200** com o Contato sobrevivente
  detalhado `{ contato, identificadores, vinculos }`; nada de `registros` volta
  no corpo. É **irreversível** e grava nas DUAS bases pelo gesto misto
  (`servicos/crm/gesto-misto.ts`): Identificadores, Conversas, Negócios,
  vínculos com Empresa, Endereços (sem principal) e notas passam ao
  sobrevivente, os consentimentos são copiados (o histórico é só inserção), o
  absorvido fica `mesclado`, e em `registros` todo Vínculo que tocava o
  absorvido passa a tocar o sobrevivente, tudo no mesmo commit. Papel `editar`
  em `contato`: o Convidado é 403.
  Recusas: 404 `CONTATO_NAO_ENCONTRADO` (um dos dois não existe NESTE Espaço);
  409 `MESCLAGEM_RECUSADA` com `campo` (`absorvidoId` ou `sobreviventeId`: o
  mesmo Contato dos dois lados, ou um lado na lixeira ou já `mesclado`).
  Duas mesclagens cruzadas ao mesmo tempo não dão deadlock: uma vence, a outra
  recebe 409.
  Fica de fora: restaurar cópia de um Contato mesclado e marcar dois Contatos
  como distintos (só a ficha antiga os oferece).

**Sucessão do Membro removido (Fase 14, 14-10, 3.2.8).** Duas peças, uma de cada
lado do mesmo gesto:

- `POST /operacoes/removeMember` ganhou um `aoConfirmar` (mapa `AO_CONFIRMAR` em
  `gesto-no-crm/membros.ts`, composto em `gesto-no-crm/index.ts`): no MESMO commit da remoção, depois do
  `ok` do domínio, `passarAoSucessor` (`repositorios/crm/sucessao.ts`) muda
  `proprietario_id` de Contatos, Empresas e Negócios do Membro para o Sucessor
  (RN-ET-09 a) e passa ao Sucessor as Conversas atribuídas a ele
  (`atribuido_id` = Sucessor; `atribuido_tipo` continua `membro`; a Conversa
  atribuída a Agente não muda). RN-ET-09 e RN-CXE-24 foram emendadas por B28-a
  (D-15-08): a Conversa muda de Atribuído, não de Proprietário (DO-CXE-02). Repetir
  a remoção não passa nada de novo: o `update` só pega `atribuido_id` = removido.
  Recusa do domínio (quem pede não é Administrador nem Proprietário
  ativo, Sucessor inválido) não roda o `aoConfirmar`: as tabelas ficam iguais. O
  domínio só valida o Sucessor quando o Membro ainda não tinha saído, então o
  `aoConfirmar` exige que ele seja Membro ATIVO do Espaço, senão nada passa.
  Todos os estados dos registros entram (inclusive arquivado e na lixeira) e
  nada de outro Espaço muda (`workspace_id` em todo `WHERE`). Gesto com
  `aoConfirmar` sai do caminho de duas idas da Fase 13 e paga mais idas ao banco:
  aceito, é raro. Grava um Registro de Atividade por Contato, Empresa, Negócio e
  Conversa passados (15-09, `insert ... select` por tabela antes do `update`, no mesmo
  commit): ator é quem removeu (a sessão), `depois` é o nome do Sucessor; repetir não
  grava de novo. Não muda o modelo antigo: o diálogo de remoção das Configurações
  segue com os números antigos até o 15-36.
- `GET /membros/:id/sucessao-no-crm` — as contagens `{ contatos, empresas,
  negocios, conversasPassadas }` (tipo `SucessaoNoCrm`, de `@n1/dominio/crm/sucessao`) que o `aoConfirmar` vai mover, em
  `{ ok: true, dados }`. Só Administrador ou Proprietário ATIVO (403
  `PERMISSAO`, conferido ANTES de olhar o Membro pedido, então quem não pode não
  descobre quem é Membro); 404 `MEMBRO_NAO_ENCONTRADO` para Membro de outro
  Espaço ou inexistente. Não lê nem escreve `registros`.

**Canais da Lista conferidos na tabela (Fase 14, 14-12, 3.3.7).**
`POST /operacoes/definirCanaisDaLista` e `POST /operacoes/createList` leem
`plataforma.canais` NA transação, pela opção `lerDoCrm` de `executar()` (mapa
`LER_DO_CRM` de `gesto-no-crm/`, no arquivo de `estrutura.ts`: a posição do argumento e o leitor), e entregam
ao domínio o `Canal[]` do Espaço, em qualquer estado, como último argumento
(`[listId, ids, canais]` e `[input, canais]`). O `canais` que o navegador manda
nessa posição só existe para a execução local do `run()`: o schema
(`CANAIS_DO_NAVEGADOR`, até 100 itens com `id`) valida a forma e o tamanho, e a
rota o DESCARTA, trocando a posição pelo que `lerDoCrm` leu (Pitfall 12,
T-14-29). Um Canal forjado no corpo nunca vale. Desde o 15-33 não existe mais o ramo
antigo em `state.channels`: o domínio confere só o `Canal[]` que a tabela deu. Estas duas operações
pagam uma ida a mais ao banco (a leitura de `plataforma.canais`); são gestos
raros. Não gravam nas tabelas do CRM nem avançam a revisão do Espaço por fora de
`executar()`.

**Ferramentas do Canal conferem Canal e Contato nas tabelas (Fase 15, 15-07, 3.4.8, UCR-08).**
As 28 operações de Grupo, Comunidade e Flow que conferem Canal ou Contato
(`criarGrupo`, `adicionarParticipantes`, `criarComunidade`, `publicarVersao`,
`enviarFlow` e as demais de `gesto-no-crm/ferramentas.ts`) recebem do servidor,
como ÚLTIMO argumento, o `crm` (`CrmDasFerramentas`, de `@n1/dominio`): os Canais
de `plataforma.canais` em qualquer estado e os Contatos de `plataforma.contatos`
que os `args` citam (`resumidosPorIds`, do Espaço da sessão, teto de 500 ids).
O `crm` que o navegador manda ali só serve à execução local: o esquema
(`CRM_DO_NAVEGADOR`, em `esquemas/fragmentos.ts`, até 200 itens por lista) valida
a forma e o tamanho, e a rota o DESCARTA, trocando a posição pelo que leu (T-15-20).
Grupo e Flow continuam gravando a Conversa de Grupo e o envio de Flow em
`state.conversations` (F14-D-05); só a conferência de Canal e de Contato vem das
tabelas.

**O Contato do Participante de Grupo nasce em `plataforma.contatos` (Fase 15, 15-17, 3.4.8, UCR-08).**
`importarGruposDoCanal` (e, quando ganharem rota, os eventos do provedor: Pedido de Entrada, entrada no
Grupo, clique de Captação) precisa do Contato de cada número de WhatsApp do Grupo. A leitura
(`leituraDaImportacaoDeGrupos`) pede os números a `numerosAResolver` (a mesma função que a operação usa),
procura cada um por Identificador `whatsapp` em `contato_identificadores` (`resolverContatosPorWhatsapp`;
mesclado resolve ao sobrevivente) e GERA com `randomUUID()` o id dos que faltam (`contatosACriar`) — nunca
vem do navegador (T-15-42). A operação pura só usa o id; o `aoConfirmar` insere, no mesmo commit
(`inserirContatosDeParticipantes`), só os Contatos que o estado de depois usa em Participação ou Pedido de
Entrada, com `modo_criacao = 'automatico_automacao'`, sem nome (o de exibição é o número), Proprietário
pela cadeia Canal → Fila → Caixa → Proprietário do Espaço (DO-CXE-05, `padroesDoContatoCriado`) e Origem
padrão do Canal pelo nome. A corrida entre duas importações do mesmo Grupo é resolvida pela trava do
Espaço em `executar()`; `contato_identificadores_unico` derruba a transação inteira se ainda assim o
Identificador colidir. O número de telefone nunca vai para log nem para erro (T-15-44). A Atividade
"Contato criado por Participação em Grupo" segue em `plataforma.registros` (não em `crm_atividades`).

**Chat e Agentes nomeiam a Âncora pelas tabelas e soltam as Conversas do Agente nelas (Fase 15, 15-08, 3.4.9, UCR-08).**
`createChatSession`, `configureChatSession` e `ensaiarAgente` recebem do servidor, como ÚLTIMO
argumento, o `nomes` (`NomesDasAncoras`, de `@n1/dominio`): o nome do Negócio, Contato, Empresa ou
Conversa citado pela Âncora, lido de `plataforma.negocios`, `contatos`, `empresas` e `conversas` do
Espaço da sessão por `LER_DO_CRM_IA` (`gesto-no-crm/ia.ts`) e só se o Membro pode `ler` o recurso
(`podeNoCrm`; sem permissão a leitura devolve `{}` e a operação recusa sem revelar o nome). O
`nomes` que o navegador manda só serve à execução local: `NOMES_DO_NAVEGADOR`
(`esquemas/fragmentos.ts`, até 200 ids, 300 caracteres por nome) valida a forma e a rota o DESCARTA
(T-15-24). `LeituraDoCrm.ler` recebe o Membro da sessão como 5º parâmetro. `arquivarAgente` e
`enviarAgenteALixeira` soltam, no mesmo commit (`AO_CONFIRMAR_IA` -> `liberarDoAgente`,
`repositorios/crm/liberacao-do-agente.ts`), as Conversas de `plataforma.conversas` atribuídas ao
Agente; o domínio solta as Tarefas e as Conversas de Grupo que ainda moram em `registros`.

**O escopo Funil da Automação confere o Funil na tabela (Fase 15, 15-39, 3.4.9, UCR-08).**
`criarAutomacao(input, funis)` recebe do servidor, como 2º argumento, os Funis que o escopo cita:
`leituraDoFunilDaAutomacao` (`gesto-no-crm/ia.ts`) lê só o Funil de `input.scopeId`, em
`plataforma.funis` do Espaço da sessão e em qualquer estado, e o domínio (`escopoExiste`) recusa o
que está na lixeira ou não existe (ativo e arquivado valem). O `funis` do navegador só serve à
execução local: `FUNIS_DO_NAVEGADOR` (`esquemas/fragmentos.ts`, até 200) valida a forma e a rota o
DESCARTA (T-15-92); um Funil de outro Espaço nem aparece na leitura (T-15-93). `editarAutomacao`
não muda de escopo, então não lê Funil.

**O cliente de Contas a receber vem das tabelas (Fase 15, 15-19, 3.4.10, UCR-08).**
`createReceivableSeries(input, clientes)` recebe do servidor, como 2º argumento, o cliente que
`input.contactId` cita: `leituraDoClienteDaSerie` (`gesto-no-crm/financeiro.ts`) lê só esse Contato em
`plataforma.contatos` do Espaço da sessão (id, nome de exibição, estado e Proprietário, por
`clientesPorIds`), e o domínio recusa com "Cliente não encontrado." o que não existe, está na lixeira
ou arquivado. A leitura só roda se o Membro pode `ler` Contato (`podeNoCrm`; sem permissão devolve
vazio e a operação recusa sem revelar o nome, que vai para o título das contas). O `clientes` do
navegador só serve à execução local: `CLIENTES_DO_NAVEGADOR` (`esquemas/financeiro.ts`) valida a forma
e a rota o DESCARTA (T-15-48). A importação do ClickUp monta o catálogo de clientes de
`plataforma.contatos` e `plataforma.empresas` ativos (`importacao/clickup/importar-contas-a-receber.ts`)
e a operação de importação só aceita o `clienteRef` que está nele.

**Tarefa conversacional nas tabelas (Fase 14, 14-13 e 14-14, 3.3.1 e 3.3.3 a 3.3.6).**
`rotas/crm/tarefas-conversacionais.ts` tem cinco rotas (criar e resumo no 14-13;
trocar o Canal e ligar ou criar o Negócio no 14-14):
- `POST /tarefas-conversacionais` — corpo `.strict()` `{ listId, contatoId,
  canalId, mensagem?, negocioId?, title?, statusId?, assignees?, priority?,
  dueDate?, taskTypeId? }`; 201 `{ ok: true, dados }`. É um **gesto misto**
  (`executarGestoMisto`): a Tarefa e os Vínculos nascem em `plataforma.registros`
  e a Conversa em `plataforma.conversas`, no mesmo commit. `lerDoCrm` trava o
  Contato e lê Canal, Identificador do tipo do Canal, Conversa aberta do par e
  Negócio NA transação; o corpo nunca carrega referência "conferida" (`alvoConferido`,
  `referencias`, `workspaceId` dão 400). **D-07:** sem Conversa aberta no par, a
  primeira Mensagem é obrigatória (400 `VALOR_INVALIDO`, `campo: "mensagem"`); com
  uma aberta ela é reaproveitada e a `mensagem` do corpo é ignorada. A Mensagem vai
  para `plataforma.mensagens`, nunca para `registros`. `dados` é o corpo de
  `POST /operacoes` (`ok`, `value: { task }`, `diferenca`, `revisao`,
  `revisaoAnterior`, `sequencia`, já pelo recorte por Membro, `recortarResposta`)
  mais `conversa: { id, aberta }` (`aberta: false` = a Conversa já existia).
  Recusas: 409 `RECUSA_DO_DOMINIO` com `campo` (`lista`, `canal`) para Lista
  operacional, Canal fora da Lista ou desconectado; 409 `CONTATO_MESCLADO`,
  `CONTATO_INATIVO`, `CANAL_ARQUIVADO`, `CONTATO_SEM_IDENTIFICADOR_DO_CANAL`,
  `NEGOCIO_DE_OUTRO_CONTATO` (`campo: "negocioId"`; vale para Negócio de outro
  Contato, de outro Espaço e fora de `ativo`); 404 `CONTATO_NAO_ENCONTRADO`,
  `CANAL_NAO_ENCONTRADO`; 403 `PERMISSAO` (Convidado). Uma recusa nunca deixa
  Tarefa, Conversa nem Mensagem. Não cutuca a ponte do Agente.
- `POST /tarefas-conversacionais/resumo` — corpo `{ vinculos: [{ taskId,
  contatoId?, conversaId?, negocioId? }] }` (até 200, `.strict()`); 200
  `{ ok: true, itens, total }`, um item por Vínculo na ordem pedida: `contato`
  (seguindo `mesclado_em_id`), `canal` (o da Conversa vinculada), `ultimaMensagem`
  (a mais recente que não é `interna` entre as Conversas `ativas` do Contato no
  Canal da Tarefa, trecho de 140 caracteres) e `negocio` (com a Etapa; o da
  lixeira não aparece). É POST só porque os ids não cabem numa query string:
  é leitura. Uma consulta SQL para o lote inteiro (`unnest ... with ordinality`),
  todo `join` com `workspace_id`: id de outro Espaço volta com os quatro campos
  `null`, nunca 404. Convidado lê.
- `POST /tarefas-conversacionais/:taskId/canal` — corpo `.strict()` `{ canalId,
  mensagem? }`; 200 `{ ok: true, dados }` com o corpo recortado de `POST
  /operacoes` (`value: { task, mudou }`) mais `conversa: { id, aberta }`. Gesto
  misto: o Contato vem do Vínculo da Tarefa lido no servidor (o sobrevivente, se
  o do Vínculo foi mesclado), nunca do corpo (`contatoId` e `conversaId` dão 400).
  Reaproveita a Conversa aberta do Contato no Canal novo ou abre uma em
  `plataforma.conversas` (a Mensagem vai para `plataforma.mensagens`); a operação
  pura só troca o Vínculo "conversa da Tarefa". A Conversa anterior continua
  `aberta` e `ativo` na Caixa. D-07: `mensagem` só é exigida sem Conversa aberta
  no Canal novo (400 `VALOR_INVALIDO`, `campo: "mensagem"`). Trocar para o Canal
  da Conversa atual é 200 com `mudou: false` e nada gravado. Recusas: 409
  `RECUSA_DO_DOMINIO` com `campo: "canal"` (Canal fora da Lista ou desconectado)
  e sem `campo` (Tarefa inexistente, sem Contato, que o Membro não escreve);
  409 `CONTATO_INATIVO`, `CANAL_ARQUIVADO`, `CONTATO_SEM_IDENTIFICADOR_DO_CANAL`;
  404 `CANAL_NAO_ENCONTRADO`; 403 `PERMISSAO` (Convidado). Nada novo em
  `registros` na coleção `conversations`.
- `POST /tarefas-conversacionais/:taskId/negocio` — corpo `.strict()`
  `{ negocioId: string | null }`; 200. Liga o Negócio ao Contato da Tarefa, ou o
  desliga com `null`. O Negócio é conferido em `plataforma.negocios` com
  `workspace_id` e `contato_id` = Contato do Vínculo: de outro Contato, de outro
  Espaço, arquivado, na lixeira ou inexistente é 409 `NEGOCIO_DE_OUTRO_CONTATO`
  (`campo: "negocioId"`, T-14-35). Também é gesto misto (a conferência do Negócio
  e o Vínculo na mesma transação), mesmo sem escrita no CRM. Convidado: 409
  `RECUSA_DO_DOMINIO` (o domínio não o deixa alterar Tarefa). Nada em `registros`
  na coleção `deals`.
- `POST /tarefas-conversacionais/:taskId/negocio/novo` — corpo `.strict()`
  `{ funilId, titulo?, valor? }` (`valor` é texto decimal como em `POST
  /negocios`; Contato, Etapa e Proprietário não vêm do corpo); 201 com o mesmo
  corpo mais `negocio: { id, titulo }`. Cria o Negócio na 1ª Etapa do Funil pelo
  mesmo `criarNegocioNoCliente` de `POST /negocios`, do Contato da Tarefa, com o
  título da Tarefa se `titulo` não vier, e liga a Tarefa a ele no mesmo commit. Se
  a Tarefa já tem Negócio (409 "Esta Tarefa já tem Negócio vinculado.") o Negócio
  NÃO fica: ele só é inserido depois que a operação aceita. As recusas de Funil e
  Etapa (404 `FUNIL_NAO_ENCONTRADO`, 409 `FUNIL_INATIVO`, `SEM_FUNIL_PADRAO`) são
  pré-checadas e voltam como valor; Contato `arquivado` ou na lixeira é 409
  `CONTATO_INATIVO`; Convidado é 403.

**Atividades do CRM novo (Fase 15, 15-37).** `rotas/crm/atividades.ts` tem UMA rota,
só de leitura:

- `GET /atividades?objetoTipo=&objetoId=&limite=&ate=&ateId=` — `{ ok: true, itens }` com
  `ActivityRecord` do Espaço da sessão, da mais recente para a mais antiga; sem
  `total`, a paginação é por cursor: `ate` (ISO, a `at` da última linha recebida) é
  exclusivo sozinho; com `ateId` (o `id` dessa linha, 15-09) o cursor é composto
  `(em, id)` e as linhas gravadas no mesmo instante não somem na fronteira da página
  (uma sucessão grava várias no mesmo commit). `ateId` sem `ate` é 400. Querystring `.strict()`: ator, ação, `workspaceId` e qualquer outro
  campo são 400. `objetoTipo` é um de `TIPOS_DE_OBJETO_DO_CRM` e vem junto com
  `objetoId` ou nenhum dos dois (`validarFiltroDeAtividades`, 400 antes do serviço);
  `limite` vai de 1 a `LIMITES_DE_ATIVIDADE.paginaMaxima` (padrão 50). O Papel decide
  por tipo: com objeto exige `ler` no recurso daquele tipo (403 `PERMISSAO`); sem
  objeto só saem os tipos que o Papel pode ler, e sem nenhum é 403. Não existe
  POST, PATCH nem DELETE: a Atividade é gravada por cada gesto na transação dele.

**Nomes do CRM novo em lote (Fase 15, 15-10, 3.4.9 e 3.4.10, UCR-08).** `rotas/crm/nomes.ts`
tem UMA rota, de leitura:

- `POST /crm/nomes` com `{ alvos: [{ tipo, id }] }` — `{ ok: true, itens, total }`, um item
  `{ tipo, id, nome }` por alvo, NA ORDEM pedida. É POST porque até 200 pares não cabem numa
  query string (como `POST /tarefas-conversacionais/resumo`); não grava nada nem sobe a
  revisão do Espaço. Corpo `.strict()` com `alvos` de no máximo `NOMES_MAXIMO` (200) e `tipo`
  em `TIPOS_DE_OBJETO_DO_CRM`: o excesso e o campo a mais são 400 antes do serviço. O Espaço é
  sempre o da sessão (`workspace_id = $1` em toda consulta, uma por tipo presente). O Papel
  decide por tipo com `podeNoCrm(…, "ler", recurso)`: tipo que ele não lê, id desconhecido e id
  de outro Espaço voltam IGUAIS, com `nome: null` (nunca 403 por item, e a resposta não revela
  qual das três causas). O que está na lixeira ou arquivado ainda tem nome. Lista vazia
  responde `[]` sem ler Papel nem banco. Por ser POST, a rota herda `recusarSuspensoNaEscrita`:
  o Membro `suspenso` recebe 403 aqui também (WR-03 segue aberto, D-15-07).

**Agregado do Início (Fase 15, 15-18, 3.4.7, UCR-07).** `rotas/crm/inicio.ts` tem TRÊS rotas, todas
de leitura, que somam no banco o que o Início somava sobre o store:

- `GET /crm/inicio/panorama` — `{ ok: true, dados }` com `contatosRecentes` (5, id e nome),
  `contatosTotal`, `negociosAbertos` (`quantidade`, `valorPonderado` e `moeda`) e `conversasAbertas`.
  Numa consulta só (uma fotografia). O valor ponderado é `valor × probabilidade / 100` (a do Negócio,
  senão a padrão da Etapa); com mais de uma moeda entre os Negócios abertos com Valor, `valorPonderado`
  e `moeda` são `null` (moedas não se somam). Conversa "aberta" é a ativa (fora da lixeira) que não está
  resolvida, `pendente` incluída. Cada bloco vem `null` quando o Papel não lê o recurso dele.
- `GET /crm/inicio/leads-a-atender?qualificacao=<id>` (repetível, até 20) — `{ ok: true, itens, total }`,
  os Contatos ativos de que o Membro da SESSÃO é Proprietário, com Qualificação na lista, sem nenhuma
  Mensagem externa (`semContato`, desde a criação do Contato; a nota `interna` não conta) ou com Conversa
  `aberta` cuja última Mensagem externa é `recebida` (`aguardandoResposta`, desde essa Mensagem; com várias
  Conversas vale a que espera há mais tempo). Quem espera há mais tempo primeiro, até 50.
- `GET /crm/inicio/estatisticas?desde=&ate=&fuso=` — `{ ok: true, dados }` com três séries por dia
  (`YYYY-MM-DD` cortado no `fuso`, instantes ISO com fuso): Mensagens `enviada` do Membro (Ator) em Conversa
  fora da lixeira, Conversas `resolvida` de que o Membro é o Atribuído (o modelo novo não guarda quem
  clicou em resolver) e Negócios `ganho` do Membro por dia e moeda. Janela de no máximo 400 dias, `desde`
  não depois de `ate` e fuso IANA conhecido: tudo 400, conferido no domínio (`conferirJanelaDeEstatisticas`)
  antes do serviço. O fuso viaja como `$n` no SQL.

O Espaço e o Membro ("meus") são SEMPRE os da sessão: o `querystring` é `.strict()` e um `membroId` ou
`workspaceId` é 400 antes do serviço. Nenhuma das três grava nada nem sobe a revisão do Espaço; repetir
devolve o mesmo, e leituras concorrentes veem uma fotografia consistente. Sem `ler` num recurso o bloco ou
a série dele volta `null`; um Membro sem Papel algum recebe 403.

**Atenção (3.3.6):** o Negócio cujo dono é a Empresa do Contato não aparece para
ligar. A 007 dá um dono por Negócio (`negocios_dono_ck`), então a conferência é
só por `contato_id`; trazer os Negócios da Empresa é decisão à parte.

O diálogo de criar da Lista, o botão do fio e a ficha da Tarefa chamam estas
rotas desde os planos 14-15 e 14-16, que sobem com o corte da Fase 15 (`15-CORTE.md`).
No mesmo deploy, o 14-17 tirou de `POST /operacoes/:nome` as quatro operações antigas (`criarTarefaConversacional` e
as outras três): daí em diante a Tarefa conversacional só nasce e muda por estas rotas
e `POST /operacoes/criarTarefaConversacional` responde 404.

## Rotas REST da Caixa de Entrada (Fase 8)

`rotas/crm/canais.ts`, `conversas.ts` e `mensagens.ts` entram no mesmo `rotasDeCrm`
da Fase 7 (mesmo envelope, mesmos status, mesma regra "a rota não tem SQL nem
regra"). As tabelas são as da `008-canais-conversas-mensagens.sql`
(`plataforma.canais`, `conversas`, `mensagens`); o Espaço vem da sessão e o corpo
é `.strict()` (T-08-02, T-08-14, T-08-44).

| Verbo e rota | Efeito | Papel |
|---|---|---|
| `GET /canais` | lista, filtros `estado` (`ativo`/`arquivado`, sem lixeira), `tipo`, `provedor`, `conexao`, `q` | todo Papel ativo (o suspenso para no hook desde a 12.1.5 B) |
| `GET /canais/:id` | a ficha | idem |
| `POST /canais` | cria um Canal `desconectada` (201): `provedor`, `nome`, `identificador`; o `tipo` sai do provedor | Administrador/Proprietário (B35) |
| `PATCH /canais/:id` | só `nome`, `filaPadraoId` e `origemPadraoId` (INV-CXE-02) | Administrador/Proprietário |
| `POST /canais/:id/conectar` | Sessão 4: pede o QR code (WhatsApp não oficial). Devolve `{ situacao: "qrcode" \| "aguardando" \| "conectada", ... }`; NUNCA grava `conectada` por QR lido (é do webhook). 409 `PROVEDOR_ERRADO`/`TRANSICAO_INVALIDA`, 503 `EVOLUTION_NAO_CONFIGURADA`/`EVOLUTION_CHAVE_RECUSADA`/`COFRE_NAO_CONFIGURADO`, 502 `EVOLUTION_INDISPONIVEL` | Administrador/Proprietário |
| `POST /canais/:id/simular-conexao` | conecta sem provedor, marcando `conexaoSimulada` (D-08). **SÓ é registrada com `PERMITIR_CONEXAO_SIMULADA=true`** (4.3.4): em produção responde 404 | Administrador/Proprietário |
| `POST /canais/:id/desconectar` | volta a `desconectada`; no WhatsApp não oficial real tira antes o aparelho da sessão (Evolution fora do ar: 502 e nada é gravado) | Administrador/Proprietário |
| `POST /canais/:id/arquivar` | arquiva e desconecta na mesma escrita; no WhatsApp não oficial sai da sessão, apaga a instância do CRM e a credencial do cofre | Administrador/Proprietário |
| `GET /conversas`, `GET /conversas/:id` | lista (filtros `canalId`, `contatoId`, `situacao`, `estado`, `atribuidoId`, `filaId`, `comEstrela`, `naoLidas`, `q`) e ficha com o resumo do Canal; cada item da lista traz `contatoNome`, `estrela` e `naoLidas` do Membro da sessão, e `ultimaRecebidaEm` (a `recebida` mais recente, na mesma consulta) | quem lê Conversa |
| `POST /conversas` | abre a Conversa com a 1ª Mensagem `enviada` (201) | quem envia Mensagem |
| `POST /conversas/:id/resolver`, `/reabrir` | muda a situação, sem corpo | idem |
| `POST /conversas/:id/mover` | troca o Contato da Conversa (3.2.5): `{ contatoId, resolverExistente? }`; o Canal e as Mensagens ficam | ação `mover` em `conversa` |
| `POST /conversas/:id/atribuir` | atribui (3.2.6): `{ atribuido: { tipo: "membro" \| "agente", id } \| null }`; `null` tira a atribuição | ação `editar` em `conversa` |
| `POST /conversas/:id/lixeira`, `/restaurar` | manda a Conversa `resolvida` para a lixeira guardando `naLixeiraEm`; volta para `ativo` e zera a data (3.2.6); sem corpo | ações `enviar_para_lixeira` e `restaurar` em `conversa` |
| `PUT /conversas/:id/marcacao` | estrela e leitura do PRÓPRIO Membro: `{ estrela?, lidaAte? }` (ao menos um); devolve `{ estrela, lidaAte }` | ação `editar` em `conversa` |
| `GET /mensagens?conversaId=` | o fio, por `(criado_em, seq)` | quem lê Mensagem |
| `POST /mensagens` | envia (`enviada`) ou anota (`interna`) — 201; com `anexos: [{ submissionId, objectId }]` e `conteudo` vazio, confirma o arquivo e consome a sessão no mesmo `comTransacao` (Fase 16) | quem envia Mensagem |
| `POST /mensagens/anexos` | o ticket para subir um arquivo ao bucket (a chave nasce no servidor, sessão `conversa-<id>`) — 200 | quem envia Mensagem |
| `GET /mensagens/:id/anexos/:indice` | uma URL assinada NOVA do anexo (TTL 5 min; documento só baixa) — 200 | quem lê Mensagem |
| `POST /mensagens/:id/reenviar` | "Tentar de novo": só a `enviada` com `falhou` volta a `pendente` e à fila — 200 com a Mensagem | quem envia Mensagem |

Não há `DELETE` em `/canais`: Canal não tem lixeira (DO-CXE-03), arquivar é o
fim de uso. As ações sem corpo (`conectar`, `simular-conexao`, `desconectar`, `arquivar`,
`resolver`, `reabrir`) não declaram `body` (Fastify 5, Pitfall 4).

**Mover e atribuir (Fase 14).** Os dois corpos são `.strict()` (`workspaceId`,
`estado`, `situacao` ou qualquer campo a mais é 400, T-14-11), o Papel é
exigido antes de ler e o Membro atuante é sempre `request.membro`; não há ação
nova em `AcaoCrm`. `mover` recusa com 409: `CONVERSA_JA_ABERTA` quando o
destino já tem Conversa aberta ou pendente no mesmo Canal (a que ocupa o par
vem em `bloqueios.conversas`; com `resolverExistente: true` ela fica `resolvida`,
sem adiamento, na mesma transação e a movida vai), e `MOVER_INVALIDO`, com
`campo: "contatoId"`, para destino arquivado, na lixeira ou mesclado, mesmo
Contato, ou Conversa na lixeira. Contato de outro Espaço é 404
`CONTATO_NAO_ENCONTRADO`. `atribuir` recusa com 409 `ATRIBUIDO_INVALIDO`
(`campo: "atribuido"`) o Membro que não é ativo neste Espaço e o Agente que não
existe ativo aqui, e com `TRANSICAO_INVALIDA` a Conversa na lixeira. Nenhuma das
duas grava Registro de Atividade nesta fase. A Caixa antiga continua no diálogo
de mover do modelo antigo até o 15-24, que trocou a Caixa por estas rotas.

**Lixeira, restaurar e marcação (Fase 14, 14-07).** `lixeira` e `restaurar`
não declaram `body`. `lixeira` recusa com 409 `TRANSICAO_INVALIDA` a Conversa
que não está `resolvida` ("Resolva a Conversa antes de mandá-la para a
lixeira.") e a que já está lá; `restaurar` recusa a que não está na lixeira e
a de Contato na lixeira ("Restaure o Contato antes"), na mesma ordem de trava
de `mover` (Contato, depois Conversa). A marcação é SEMPRE do Membro da sessão:
o corpo é `.strict()` e não tem campo de Membro (T-14-17), então `membroId` ou
`workspaceId` no corpo é 400; `{}` e `lidaAte` que não é data ISO com hora
também. Mandar só um campo não apaga o outro. A Conversa precisa existir neste
Espaço (404). Os filtros novos de `GET /conversas`: `atribuidoId` e `filaId`
são ids; `comEstrela=true` traz só as que o Membro da sessão marcou e `false`
só as que ele não marcou (sem o parâmetro, as duas); `q` é um trecho do
título, sem diferenciar maiúscula, e é literal (`%` e `_` não são curingas).
`naoLidas` conta as Mensagens `recebida` depois do `lidaAte` do Membro (sem
marcação, todas as recebidas). Como filtro (Fase 15, 15-06), `naoLidas=true` traz
só as Conversas com ao menos uma dessas e `false` só as sem nenhuma, sempre para
o Membro da sessão (nunca um id do cliente); o `total` conta o filtrado. Nada disso avança a
revisão do Espaço. Desde o 15-09 (D-15-09), `mover`, `atribuir` (e tirar o Atribuído), `lixeira`,
`restaurar`, a estrela e a leitura gravam um Registro de Atividade no mesmo commit do gesto
(`crm_atividades`, ator = Membro da sessão, nome = título da Conversa); a estrela só grava
quando troca e a leitura só quando o `lidaAte` avança por cima de Mensagem recebida (repetir o
mesmo valor não grava; a leitura do valor anterior é serializada por trava consultiva por
Conversa e Membro). Gesto recusado não grava. `transferirIdentificador` e o consentimento
também gravam, no Contato: a transferência com o nome do destino e só o TIPO do Identificador
em `detalhe`; o consentimento com finalidade, tipo de Canal e decisão, sem a evidência.
Criar, editar, ganhar, perder e reabrir Negócio, criar Contato/Empresa e mandar Contato/Empresa
à lixeira pelo CRM novo NÃO gravam Atividade nesta fase. O fio da Caixa lê e grava pelas rotas desde o 15-20
(`leituras_internas` da 008 segue sem escritor aqui).

**Consentimento no envio (Fase 14, 14-08).** `ServicoDeMensagens.enviar` recusa
com 409 `SEM_CONSENTIMENTO` (`campo: "modelo"`) a Mensagem `enviada` cujo modelo é
de marketing quando o consentimento vigente de marketing do Contato, para o tipo
do Canal, não é `concedido` (`recusaPorFaltaDeConsentimento` do domínio; sem a
finalidade Marketing no Catálogo também recusa). A regra está PRONTA e testada,
mas SEM caminho HTTP até a Sessão 7: `POST /mensagens` não manda modelo
(`NOVA_MENSAGEM` é `.strict()` e não tem esse campo), e quem diz a categoria é
`deps.categoriaDoModelo` do serviço, que hoje ninguém passa. A Mensagem
`interna` não passa pela regra, e a janela de 24 h (`JANELA_EXPIRADA`) é
conferida antes.

**Não há rota humana de Mensagem `recebida`.** `NOVA_MENSAGEM.direcao` é
`z.enum(DIRECOES_DE_ENVIO)`: uma pessoa só envia ou anota. A recebida entra por
`registrarRecebida` do serviço de Mensagens (a porta da integração, idempotente
por Canal + id externo): hoje chamada direto pelos testes; o webhook autenticado
por credencial de serviço vem com o provedor, em fase própria.

**Nenhuma resposta leva `carga_bruta`** (A9, T-08-45): o repositório nem a
seleciona nas leituras (`COLUNAS_DE_MENSAGEM`), então a rota não tem como
devolvê-la. O e2e `canais-fluxo.test.ts` confere a string crua da resposta.

**Códigos de recusa desta fase.**
- **404** (não existe NESTE Espaço): `CANAL_NAO_ENCONTRADO`, `CONVERSA_NAO_ENCONTRADA`, `CONTATO_NAO_ENCONTRADO`.
- **409:** `CANAL_NOME_EM_USO` e `CANAL_CONTA_EM_USO` (com o detentor em `bloqueios.canais`; a conta é única entre provedores — INV-CXE-01), `CANAL_ARQUIVADO`, `FILA_INVALIDA`, `ORIGEM_INVALIDA`, `TRANSICAO_INVALIDA`, `CONVERSA_JA_ABERTA`, `CONVERSA_NA_LIXEIRA`, `MOVER_INVALIDO`, `ATRIBUIDO_INVALIDO`, `CONTATO_INATIVO`, `CONTATO_SEM_IDENTIFICADOR_DO_CANAL`, `RESPOSTA_DE_OUTRA_CONVERSA`, `SEM_CONSENTIMENTO` e `JANELA_EXPIRADA` (WhatsApp oficial, texto livre fora das 24 h; o não oficial nunca é recusado — D-02).
- **400:** forma (zod) e `VALOR_INVALIDO`. **403:** `PERMISSAO`.

**Sem ponte (Fase 15, 15-33).** `GET /estado` e `executar()` em `/operacoes` não projetam mais os Canais de
`plataforma.canais` em `state.channels`: o Canal só chega à tela por `GET /canais`. Para Grupo, Flow e Automação, o
servidor lê o Canal da tabela como `crm.canais` e o passa como argumento (nada é gravado em `plataforma.registros`);
ver `persistencia/CONTEXT.md`. O cenário que prova isso por HTTP é `e2e/canais-fluxo.test.ts`.

## Webhooks da Meta — WhatsApp oficial (só escuta) e Instagram (fila de entrada)

`webhook-meta.ts` — `rotasDeWebhookMeta(app, opcoes)` — `GET` e `POST` em
`/webhooks/meta/whatsapp` e em `/webhooks/meta/instagram`, sem `Authorization: Bearer`
(`config: { publica: true }`). Os dois canais compartilham o plugin (e portanto o parser
de corpo cru, que só pode ser registrado uma vez por plugin), o token de verificação
(`META_WEBHOOK_VERIFY_TOKEN`) e o formato do log; o que muda é o segredo da assinatura:
o WhatsApp confere só contra `META_APP_SECRET`; o Instagram aceita `INSTAGRAM_APP_SECRET`
(a chave do app do Instagram) **ou** `META_APP_SECRET`, enquanto não se confirmar qual a
Meta usa — o log do POST aceito traz `segredo` com o nome do que bateu. Um canal nunca
aceita o segredo exclusivo do outro.

**Sessão 8: o Instagram entra pela mensageria.** A Meta chama UM endereço para todas as
contas do app, então a rota não é a por Canal (`/webhooks/mensageria/:canalId`): com a
assinatura conferida, `enfileirarInstagram` (`mensageria/provedores/instagram/entrada.ts`,
ligado em `app.ts`) acha o Canal de cada conta do corpo (`entry[].id` →
`instagram_contas`), confere a chamada pelo provedor do Canal (`verificarChamada`) e
guarda cada item como uma linha `pendente` de `plataforma.webhooks_recebidos` (chave = o
`mid`). A rota responde 200 e acorda o processador de entrada, o mesmo da rota por Canal;
quem troca o IGSID pelo @ e chama `receberMensagem` é ele. Sem segredo configurado, evento
sem assinatura nunca vira dado; falha do banco responde 500 para a Meta reenviar. O log do
Instagram leva só contagens, nunca o corpo.
Também do Instagram, públicas e conferidas pelo `signed_request`
(`mensageria/provedores/meta/assinatura.ts`): `POST /webhooks/meta/instagram/desautorizar`,
`POST /webhooks/meta/instagram/exclusao-de-dados` e a situação
`GET /webhooks/meta/instagram/exclusao-de-dados/:codigo`. A conexão da conta
(OAuth) é autenticada e mora em `rotas/crm/instagram.ts`. Tudo em
`mensageria/provedores/instagram/CONTEXT.md`.

A descrição abaixo vale para os dois canais.
O `GET` é o aperto de mão da Meta ao cadastrar a URL: devolve `hub.challenge` em
`text/plain` se `hub.verify_token` for `META_WEBHOOK_VERIFY_TOKEN` (sem a variável,
403 sempre). O `POST` registra o corpo no log e responde 200; com `META_APP_SECRET`
definido exige `X-Hub-Signature-256` (HMAC-SHA256 do corpo CRU — o parser JSON
deste plugin guarda os bytes, encapsulado, e não vaza para as outras rotas); sem
ele aceita e avisa no log.

**O WhatsApp oficial ainda não grava nada e não cria Mensagem** (Sessão 7). Quando
gravar, a porta é `receberMensagem` (`servicos/crm/recebimento.ts`; o gesto
`registrarRecebida` saiu na Fase 16), pela fila de entrada abaixo, como o Instagram.
O log dele leva o corpo inteiro — número e texto de quem escreveu — e deve ser
reduzido quando o formato estiver conhecido. O do Instagram já leva só contagens.

## Webhook de mensageria por Canal e tempo real (Fase 16)

**`POST /webhooks/mensageria/:canalId`** (`webhooks-de-mensageria.ts`, `rotasDeWebhooksDeMensageria`): o endereço
que um provedor chama para entregar o que chegou. É **pública** (`config: { publica: true }`), sem `Authorization:
Bearer`: a confiança é o segredo do Canal no cabeçalho `x-n1-webhook-segredo`, guardado no cofre e conferido pelo
provedor do Canal (`verificarChamada`). Plugin próprio, irmão do de Meta (parser de corpo cru encapsulado), fora de
`rotasDeCrm`. A rota acha o Canal só pelo `id` da URL (o Espaço vem da linha do Canal, nunca do cliente), resolve o
provedor pelo Canal, verifica e grava UMA linha `pendente` em `plataforma.webhooks_recebidos` (a `chave` deduplica o
reenvio), responde 200 e acorda o processador de entrada; nada é processado dentro da requisição.

- **A mesma 401 para toda recusa** (`{ ok: false, error: "Não autorizado." }`): Canal inexistente, ambíguo entre
  Espaços, arquivado, sem segredo, sem provedor ou com segredo errado (inclusive o segredo certo com a instância de
  outro Canal). Toda recusa roda uma comparação em tempo constante contra um valor de sombra. Falha de banco é 500
  (o provedor reenvia), não 401.
- Teto por IP de 300 por minuto no `onRequest` (429, antes de ler corpo ou consultar), corpo de até 2 MiB (413), JSON
  inválido 400. A chave `apikey` do topo do corpo é retirada antes do `insert`. Nada loga corpo, cabeçalho ou segredo.
- A rota **nunca importa `servicos/cofre`** (o `cofre.test.ts` impede): a chave mestra é lida por
  `mensageria/registro.ts`.

**`GET /eventos`** (`eventos.ts`, `rotasDeEventos`): o fluxo SSE (`text/event-stream`) do tempo real, entregue por
`reply.send(PassThrough)` para o CORS do Fastify valer. **Exige JWT** (`Authorization: Bearer`, por `fetch`, não
`EventSource`): 401 sem token, 403 `PERMISSAO` quando o Papel não lê Conversa, 503 `TEMPO_REAL_INDISPONIVEL` sem o
ouvinte `LISTEN` de pé (ou com `TEMPO_REAL_ATIVO=false`). Abre com `: aberto`, bate `: batida` a cada 25 s (abaixo do
`proxy_read_timeout` de 120 s do nginx; `X-Accel-Buffering: no` desliga o buffer dele), fecha sozinho em 45 min (o JWT
só é conferido ao abrir; a aba reconecta com o token renovado) e a aba lenta cai ao passar de 64 KiB pendentes. Cada
quadro é `data: {"tipo","conversaId","mensagemId?"}` (ids e tipo, nunca texto): a tela busca o resto pelas rotas que
conferem o acesso. No máximo 5 fluxos por Membro; o hub reconfere o Papel a cada 60 s.

**Os 422 e 404 dos anexos** (`POST /mensagens` e `POST /mensagens/anexos`): `ANEXO_DE_OUTRA_CONVERSA`,
`ANEXO_NAO_ENCONTRADO`, `ARQUIVO_GRANDE_DEMAIS`, `TIPO_NAO_ACEITO`, `TIPO_NAO_ENVIADO_PELO_CANAL`,
`ARQUIVO_NAO_CONFERE` e `ARQUIVO_AUSENTE` respondem 422; `ANEXO_JA_USADO` responde 409; `ARQUIVO_INDISPONIVEL` (404) é
o anexo recebido que o provedor não entregou (`baixado: false`).

**`POST /mensagens/:id/reenviar`**: 409 `NAO_FALHOU` (a Mensagem não está `falhou`, com a frase de produto),
409 `CONVERSA_NA_LIXEIRA`, 409 `CANAL_ARQUIVADO`, 404 para Mensagem ausente ou de outro Espaço e 403 para quem não
envia ou está suspenso. Canal fora do ar só devolve a Mensagem a `pendente` (a fila espera a reconexão).
