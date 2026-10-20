# rotas

Ler primeiro: [`../../CONTEXT.md`](../../CONTEXT.md) e [`../CONTEXT.md`](../CONTEXT.md)

HTTP ↔ serviço. Um arquivo por recurso. Sem regra de negócio e sem acesso a banco: a rota lê a requisição, chama um serviço e formata a resposta.

Os arquivos deste diretório, desde o Plan 01-04 (`esquemas-de-argumentos.ts` chegou no Plan 01-11; a pasta `esquemas/` nos Plans 01-12..01-16):

- `operacoes.ts` — `POST /operacoes/:nome`, genérica sobre `OPERACOES` (o registro explícito de `@n1/dominio`, uma entrada por operação de domínio alcançável por HTTP).
- `estado.ts` — `GET /estado`, a carga inicial do Espaço de Trabalho.
- `esquemas-de-argumentos.ts` — compõe `esquemas/<modulo>.ts` (um por módulo do domínio) sob `satisfies EsquemasCompletos`: toda operação de `OPERACOES` tem schema; a rota valida antes de `executar()`, forma errada é 400, regra de negócio continua no domínio (recusa em 200).
- `esquemas/` — a FORMA dos `args` por operação (tipos espelhados da assinatura do domínio, não regras), um arquivo por módulo — ver [`esquemas/CONTEXT.md`](esquemas/CONTEXT.md).

A regra continua: a rota chama `executar()` da Unidade de Trabalho (`../persistencia/unidade-de-trabalho.ts`) e traduz o resultado para HTTP — nunca SQL, nunca regra de negócio aqui. Toda rota registrada depois do hook de `../plugins/autenticacao.ts` exige `Authorization: Bearer`, a menos que se marque `config: { publica: true }`.

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

## Rotas REST da Caixa de Entrada (Fase 8)

`rotas/crm/canais.ts`, `conversas.ts` e `mensagens.ts` entram no mesmo `rotasDeCrm`
da Fase 7 (mesmo envelope, mesmos status, mesma regra "a rota não tem SQL nem
regra"). As tabelas são as da `008-canais-conversas-mensagens.sql`
(`plataforma.canais`, `conversas`, `mensagens`); o Espaço vem da sessão e o corpo
é `.strict()` (T-08-02, T-08-14, T-08-44).

| Verbo e rota | Efeito | Papel |
|---|---|---|
| `GET /canais` | lista, filtros `estado` (`ativo`/`arquivado`, sem lixeira), `tipo`, `provedor`, `conexao`, `q` | todo Papel ativo ou suspenso |
| `GET /canais/:id` | a ficha | idem |
| `POST /canais` | cria um Canal `desconectada` (201): `provedor`, `nome`, `identificador`; o `tipo` sai do provedor | Administrador/Proprietário (B35) |
| `PATCH /canais/:id` | só `nome`, `filaPadraoId` e `origemPadraoId` (INV-CXE-02) | Administrador/Proprietário |
| `POST /canais/:id/simular-conexao` | conecta sem provedor, marcando `conexaoSimulada` (D-08) | Administrador/Proprietário |
| `POST /canais/:id/desconectar` | volta a `desconectada` | Administrador/Proprietário |
| `POST /canais/:id/arquivar` | arquiva e desconecta na mesma escrita | Administrador/Proprietário |
| `GET /conversas`, `GET /conversas/:id` | lista (filtros `canalId`, `contatoId`, `situacao`, `estado`) e ficha com o resumo do Canal | quem lê Conversa |
| `POST /conversas` | abre a Conversa com a 1ª Mensagem `enviada` (201) | quem envia Mensagem |
| `POST /conversas/:id/resolver`, `/reabrir` | muda a situação, sem corpo | idem |
| `GET /mensagens?conversaId=` | o fio, por `(criado_em, seq)` | quem lê Mensagem |
| `POST /mensagens` | envia (`enviada`) ou anota (`interna`) — 201 | quem envia Mensagem |

Não há `DELETE` em `/canais`: Canal não tem lixeira (DO-CXE-03), arquivar é o
fim de uso. As ações sem corpo (`simular-conexao`, `desconectar`, `arquivar`,
`resolver`, `reabrir`) não declaram `body` (Fastify 5, Pitfall 4).

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
- **409:** `CANAL_NOME_EM_USO` e `CANAL_CONTA_EM_USO` (com o detentor em `bloqueios.canais`; a conta é única entre provedores — INV-CXE-01), `CANAL_ARQUIVADO`, `FILA_INVALIDA`, `ORIGEM_INVALIDA`, `TRANSICAO_INVALIDA`, `CONVERSA_JA_ABERTA`, `CONVERSA_NA_LIXEIRA`, `CONTATO_INATIVO`, `CONTATO_SEM_IDENTIFICADOR_DO_CANAL`, `RESPOSTA_DE_OUTRA_CONVERSA` e `JANELA_EXPIRADA` (WhatsApp oficial, texto livre fora das 24 h; o não oficial nunca é recusado — D-02).
- **400:** forma (zod) e `VALOR_INVALIDO`. **403:** `PERMISSAO`.

**A ponte.** `GET /estado` (e `executar()` em `/operacoes`) projeta os Canais de
`plataforma.canais` como Canais relacionais (`relational: true`, `provider`,
`simulatedConnection`) ao lado dos do seed, sem gravá-los em
`plataforma.registros` (D-11, D-12); ver `persistencia/CONTEXT.md`. O cenário
que prova isso por HTTP é `e2e/canais-fluxo.test.ts`.

## Webhook da Meta — WhatsApp oficial (só escuta)

`webhook-meta.ts` — `rotasDeWebhookMeta(app, opcoes)` — `GET` e `POST` em
`/webhooks/meta/whatsapp`, sem `Authorization: Bearer` (`config: { publica: true }`).
O `GET` é o aperto de mão da Meta ao cadastrar a URL: devolve `hub.challenge` em
`text/plain` se `hub.verify_token` for `META_WEBHOOK_VERIFY_TOKEN` (sem a variável,
403 sempre). O `POST` registra o corpo no log e responde 200; com `META_APP_SECRET`
definido exige `X-Hub-Signature-256` (HMAC-SHA256 do corpo CRU — o parser JSON
deste plugin guarda os bytes, encapsulado, e não vaza para as outras rotas); sem
ele aceita e avisa no log.

**Não grava nada e não cria Mensagem.** O formato do payload ainda será validado;
quando for, a porta é `registrarRecebida` do serviço de Mensagens (idempotente por
Canal + id externo). O log leva o corpo inteiro — número e texto de quem escreveu —
e deve ser reduzido quando o formato estiver conhecido.
