# Phase 8: Canais de comunicação: conexão e omnichannel preparado - Research

**Researched:** 2026-10-12
**Domain:** Canal/Conversa/Mensagem relacionais em três camadas (`@n1/dominio` → `apps/api` Fastify/pg + migração `008` → `apps/web` Next 16), sem provedor real; chat omnichannel por Canal sobre o modelo antigo em memória
**Confidence:** HIGH no código, no SQL e nas pegadinhas (lidos e, no caso da 008, provados em Postgres 16 descartável); MEDIUM nas escolhas do Claude's Discretion; LOW só nos itens `[ASSUMED]` do log

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Oficial × não oficial no modelo**
- **D-01:** O WhatsApp não oficial **não** é um `ChannelType` novo. O Canal ganha um atributo **`provedor`** (ex.: `whatsapp-cloud`, `whatsapp-nao-oficial`, `instagram-graph`, `email-imap-smtp`); `channelType` continua `whatsapp` / `instagram` / `email`. Motivo: a ontologia (A2.4) diz que não há "Canal WhatsApp" como entidade própria, e as ~40 operações que leem `channelType` não precisam mudar. — **Reversibility:** costly — o provedor vira coluna na `008` e aparece no contrato REST; trocar para enum de tipo depois toca domínio, migração e telas.
- **D-02:** As **Capacidades continuam do Tipo** (RN-CXE-05), mas passam a ser consultadas por **(tipo, provedor)**: o provedor só sobrepõe o que difere. Concretamente, o WhatsApp **não oficial não tem janela de 24h nem exige modelo aprovado** — envio livre a qualquer hora. O oficial mantém janela de 24h e modelo fora dela.
- **D-03:** O **identificador externo** no mockup de conexão é o que a pessoa digita hoje: número com DDI para os dois WhatsApps (reaproveita `identificadorCanonico`), `@usuario` para Instagram, endereço para E-mail. O provedor real só confirma depois; IDs da Meta (Phone Number ID, WABA) **não** entram agora.
- **D-04:** Dois WhatsApps se distinguem por **nome livre + selo do provedor** ("Comercial" com selo "oficial"; "Suporte" com selo "não oficial") ao lado do ícone do tipo. Nome único entre Canais ativos já é regra (RN-CXE-31); o número não precisa aparecer em toda listagem.

**Jornada de conexão e mockup**
- **D-05:** A página de escolha mora nas **Configurações da Caixa de Entrada**: botão "Conectar Canal" na seção Canais de `/crm/caixa-de-entrada/configuracoes`, abrindo `/crm/caixa-de-entrada/configuracoes/canais/conectar`. O Canal é contido pela Caixa (ontologia 7.2); `/configuracoes/integracoes` não ganha Canais nesta fase.
- **D-06:** A tela de escolha são **quatro cartões por provedor** — WhatsApp oficial, WhatsApp não oficial, Instagram, E-mail — cada um com ícone, uma frase sobre quando usar e o botão "Conectar". Reaproveita `grade-solta` / `item-solto`.
- **D-07:** A página de orientação de cada provedor (`/crm/caixa-de-entrada/configuracoes/canais/conectar/[provedor]`) mostra **passo a passo textual genérico** (oficial: conta Meta Business, número verificado, token; não oficial: QR code; Instagram: conta profissional vinculada; E-mail: IMAP/SMTP), um **espaço reservado** para o QR/token que a integração futura preenche, e o **formulário real**: nome, identificador, Fila padrão, Origem padrão (os mesmos campos do popup atual). É o mockup que será configurado por provedor depois — o layout fica, o conteúdo troca.
- **D-08:** Sem provedor, "Conectar" **cria o Canal `desconectada`** (ontologia 12.2). Um botão secundário **"Simular conexão"**, só para quem administra o Espaço, muda para `conectada` e deixa testar o chat; a tela marca visivelmente que a conexão é simulada. Nada nasce `conectada` por padrão — C36 deixa de valer para Canais criados pela página nova.

**Escopo da migração 008**
- **D-09:** A `008` cria **Canal, Conversa e Mensagem** com tabela própria (`plataforma.canais`, `plataforma.conversas`, `plataforma.mensagens`), no padrão da `007`: `workspace_id` em tudo, PK `(workspace_id, id)`, FKs compostas, `criado_em`/`atualizado_em` com trigger. A Conversa aponta para o **Contato relacional da 007** (`plataforma.contatos`), e para o Canal, imutável (INV-CXE-04). **Fila e Participante não ganham tabela**: Fila fica como referência textual/coluna (`fila_id` sem FK, até a Fila existir relacional) e Participantes como jsonb na Conversa. — **Reversibility:** one-way depois de aplicada — migração imutável (DEC-10); correção é a `009`.
- **D-10:** A tabela de **Mensagem** guarda o **modelo completo da ontologia 7.6**: direção (`recebida`/`enviada`/`interna`), ator e ator delegante, remetente (participante/identificador por onde chegou), conteúdo, anexos (jsonb ordenado), assunto e endereços adicionais (E-mail), em resposta a, modelo usado, **identificador externo único por Canal** (INV-CXE-08), status de entrega com momento e motivo de falha, reações (jsonb), marcação de exclusão, edições externas (jsonb), momento de criação do provedor e momento de recebimento, anonimizada — **mais um jsonb `carga_bruta`** com o payload do provedor como veio, para reprocessar quando a integração chegar.
- **D-11:** **Ponte, não religação.** As rotas REST `/canais`, `/conversas`, `/mensagens` nascem e são testadas (`app.inject` + repositório contra Postgres local); a página de conexão e a ficha do Canal gravam **por REST**; os **Canais relacionais são projetados em `GET /estado`** (`state.channels`) para a Caixa de Entrada atual, o fio e as Listas conversacionais os enxergarem sem reescrita. Religar o chat inteiro (Conversas e Mensagens lidas por HTTP) fica para a fase de unificação. — **Reversibility:** reversible — a projeção é código do `apps/api`, removida quando as telas passarem a ler por REST.
- **D-12:** O **seed continua, marcado como demo**: os Canais e Conversas do seed seguem no estado hidratado para a Caixa não ficar vazia; a lista de Canais indica os que vêm da tabela nova (e os do seed como demo). A limpeza do seed fica para a unificação.

**Chat omnichannel**
- **D-13:** Cada Mensagem mostra por qual Canal chegou pelo **cabeçalho do fio** (ícone do tipo + nome do Canal + selo do provedor) e por um **separador discreto** "via Comercial (WhatsApp não oficial)" quando, na linha do tempo do Contato, Mensagens de Canais diferentes se alternam. Bolhas sem selo.
- **D-14:** As abas do fio (`ConversationThread`) passam de **por tipo** para **uma aba por Canal** ("Comercial · WhatsApp oficial", "Suporte · WhatsApp não oficial", "E-mail"). Cada aba é a Conversa daquele Canal com o Contato — respeita "uma Conversa = um Canal" (INV-CXE-04). Aba desabilitada quando o Contato não tem identificador do tipo daquele Canal (mesma regra de hoje).
- **D-15:** Quem atende escolhe por qual Canal responder num **seletor "Responder por" no compositor**, com **padrão = Canal por onde a última Mensagem recebida chegou**; o seletor oferece só Canais `conectada` cujo tipo o Contato tem identificador. Trocar o Canal abre (ou reutiliza) a Conversa daquele Canal — nunca muda o Canal de uma Conversa existente.
- **D-16:** Na lista de Conversas da Caixa de Entrada, cada item mostra **ícone do tipo + nome do Canal**; o filtro "Canal" (já existe, `?canal=`) lista cada Canal com o selo do provedor.

### Claude's Discretion
- Nome e forma exata do atributo `provedor` (enum × tabela de provedores), e onde moram as sobreposições de Capacidade por provedor.
- Estrutura interna dos repositórios, nomes de módulo e esquemas, paginação das listagens, formato dos 409 (seguir o padrão da Fase 7).
- Como a projeção de Canais relacionais entra em `GET /estado` sem colidir com ids do seed (prefixo, namespace ou tabela de ids).
- Texto exato do passo a passo de cada provedor no mockup.
- Se a `008` é aplicada no banco da plataforma dentro desta fase (após `migrar --seco` e conferência do dono, como a 007 em 07-13) ou só preparada — recomendação: aplicar, com a mesma UAT `[BLOCKING]`.
- Permissões: seguir a matriz da Fase 7 (D-14) e B35 — só `administrador`/`proprietario` conecta, configura, simula conexão, desconecta e arquiva Canal; `membro` lê.

### Deferred Ideas (OUT OF SCOPE)
- Integração real dos provedores (Cloud API da Meta, Evolution/Baileys, Instagram Graph, IMAP/SMTP), webhook de entrada e envio real — fase própria por provedor, preenchendo o mockup de D-07
- Religar Caixa de Entrada, fio, Tarefas conversacionais e Listas conversacionais ao REST de Conversas/Mensagens; aposentar o seed de Canais/Conversas e a projeção de D-11 — fase de unificação
- Fila e Participante com tabela própria; Inbox (configuração da Caixa) relacional
- Chat do site e LinkedIn como provedores conectáveis
- Grupos de WhatsApp (ontologia documento 24) sobre o Canal relacional
- IDs da Meta (Phone Number ID, WABA ID) no formulário do oficial — quando a integração real pedir
- Reconexão com a mesma conta, arquivar/reativar Canal e eliminação de Canal arquivado sem Conversas (ontologia 12.2) — a ficha ganha "desconectar" e "arquivar" se couber no planejamento; o resto fica
- Sincronização de Mensagens de modelo do provedor oficial
- Canais em `/configuracoes/integracoes` (atalho ou cartões)
</user_constraints>

<phase_requirements>
## Phase Requirements

O ROADMAP marca `Requirements: TBD` e nenhum ID está mapeado em `REQUIREMENTS.md`. Como na Fase 7 (`07-RESEARCH.md`), os IDs abaixo são **derivados** do goal e de D-01..D-16; o planner os registra em `REQUIREMENTS.md` (ou os usa só como `must_haves`) e os põe no campo `requirements` dos planos.

| ID (derivado) | Descrição | Decisões | Research Support |
|----|-----------|----------|------------------|
| CXE-D1 | `@n1/dominio`: `ProvedorDeCanal` + registro `PROVEDORES` (rótulo, selo, tipo), `Channel.provider` (e marca de origem relacional), Capacidades por (tipo, provedor) (`capacidadesDoCanal`), módulos novos `@n1/dominio/crm/{canais,conversas,mensagens}` com regras puras (Canal nasce `desconectada`, conexão em dois atos, identificador canônico, regra de envio por janela/modelo), `podeNoCrm` com `canal`/`conversa`/`mensagem` | D-01, D-02, D-03, D-04, D-08 | Standard Stack; Pattern 1, 2; Pitfall 5, 8; Code Examples 2, 3 |
| CXE-D2 | Todos os leitores de janela/modelo (`windowOpenUntil`, `sendMessage`, `responseWindowOpenUntil`, 6 telas) passam a consultar `capacidadesDoCanal`; seed e testes existentes seguem verdes (Canal sem `provider` = padrão do tipo) | D-02 | Pitfall 5; tabela "Sítios que leem Capacidade" |
| CXE-A1 | Migração `008-canais-conversas-mensagens.sql` (Canal/Conversa/Mensagem) com as invariantes no banco (INV-CXE-01/03/04/08/09/10…), idempotente, conferida por `migrar --seco` e aplicada no banco da plataforma | D-09, D-10 | Code Example 1 (SQL provado); Pitfall 1, 2, 11 |
| CXE-A2 | Repositórios + serviços + rotas REST `/canais`, `/conversas`, `/mensagens` (padrão da Fase 7: isolamento por `workspace_id`, permissão por Papel, 400/403/404/409, `.strict()`), `buildApp({ crm })` injetável | D-09, D-11 | Pattern 3, 4; Security Domain |
| CXE-A3 | Mensagem: gravação do modelo 7.6 completo + `carga_bruta`, deduplicação por Canal (`registrarRecebida` idempotente), envio com regra de janela/modelo por (tipo, provedor) e status `pendente` com Canal não conectado (B69) | D-02, D-10 | Pattern 4; Pitfall 9 |
| CXE-A4 | Ponte: Canais relacionais projetados em `state.channels` em `GET /estado` **e** na hidratação da Unidade de Trabalho, nunca gravados em `plataforma.registros`; ids sem colisão com o seed; contrato `automacao.notificar-canal.v1` intacto | D-11, D-12 | Pattern 5; Pitfall 3, 4; Code Example 4 |
| CXE-W1 | Web: botão "Conectar Canal", página de escolha (4 cartões), página de orientação por provedor (`[provedor]`: passos + espaço QR/token + formulário real), criar Canal `desconectada` por REST, "Simular conexão" (marca visível), lista/ficha do Canal com selo do provedor e origem (tabela × demo) | D-04, D-05, D-06, D-07, D-08, D-12 | Pattern 6; Pitfall 6, 7, 10 |
| CXE-W2 | Chat: cabeçalho do fio com Canal + selo (e separador "via…"), abas **por Canal**, seletor "Responder por" (padrão = Canal da última recebida), item da lista com ícone + nome do Canal e filtro `?canal=` com selo | D-13, D-14, D-15, D-16 | Pattern 7; Pitfall 6, 8, 12; Open Questions 2, 3 |
| CXE-V1 | `npm run check` verde; testes de domínio, de rota (`app.inject`), de repositório e do cenário "dois WhatsApps lado a lado" contra Postgres local; `008` aplicada no banco da plataforma depois de `--seco` e conferência do dono (UAT `[BLOCKING]`) | todas | Validation Architecture |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Fonte: `CLAUDE.md` (que inclui `CONTEXT.md` e `AGENTS.md` da raiz) e os `CONTEXT.md` de `apps/api/src/{repositorios,rotas,persistencia}`. Tratadas com a autoridade de decisões travadas.

- **Regra de dependência (inegociável):** `packages/dominio` não conhece ninguém; `apps/web` e `apps/api` importam só `@n1/dominio` e **nunca um ao outro**. Quando a mudança toca as três camadas, **começa pelo domínio e desce**. [VERIFIED: `CONTEXT.md` raiz, "A regra de dependência" e "Onde uma mudança nasce"]
- **Next.js 16.3.4 tem breaking changes** — ler `node_modules/next/dist/docs/` antes de codar web. Feito aqui: `params` de página é `Promise` e Client Component usa `use(params)`; param inválido → `notFound()`. [VERIFIED: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md` (seções sobre `params: Promise<{ slug: string }>` e `notFound`); `node_modules/next/package.json` → `"version": "16.3.4"`]
- **Migrações numeradas e imutáveis** depois de aplicadas; correção é a seguinte. `npm run migrar -w @n1/api -- --seco` antes de aplicar. A 007 já está aplicada no banco da plataforma (07-13) — nada de editá-la. [VERIFIED: `apps/api/src/persistencia/CONTEXT.md` "A regra das migrações"; `07-13-SUMMARY.md`]
- **`apps/api`:** direção `rotas → servicos → repositorios`; rota sem regra e sem SQL; `workspace_id = $1` em todo `WHERE`; valores sempre `$n`; datas `::text`, `numeric` como texto, `count(*)::int`; quem abre a transação é o serviço (`comTransacao`). [VERIFIED: `apps/api/src/repositorios/CONTEXT.md`, `rotas/CONTEXT.md`]
- **Recusa de regra nunca viaja em 200 nas rotas REST do CRM** (diferente de `/operacoes`): 400 forma, 403 Papel, 404 não existe NESTE Espaço, 409 regra/integridade, envelope `{ ok:false, error, codigo?, campo?, bloqueios? }`. [VERIFIED: `rotas/CONTEXT.md` "Rotas REST do CRM (Fase 7)"]
- **Erros em pt-BR**; `OperationResult`/`fail(error, field?)` é o idioma do domínio. TS estrito (`strict`, `noUncheckedIndexedAccess`; `exactOptionalPropertyTypes: false`). [VERIFIED: `tsconfig.base.json`]
- **Web:** cor só via `src/estilos/tokens.css` (`npm run verificar:tokens` barra hex cru); alias `@/*`; teste de componente declara `// @vitest-environment jsdom` na 1ª linha. [CITED: `apps/web/CONTEXT.md`, `07-RESEARCH.md`]
- **Testes do api rodam em série** (`fileParallelism: false`) e os de banco só contra Postgres **local** (`testes/banco-crm.ts`); nunca contra o Supabase do `.env`. [VERIFIED: `apps/api/vitest.config.mts`; `apps/api/src/testes/banco-crm.ts:1-20`]
- **Docs vivos:** o `CONTEXT.md` da raiz ("Estado atual"), `apps/api/src/{rotas,repositorios,persistencia}/CONTEXT.md` e `apps/web/CONTEXT.md` descrevem o que existe — atualizar no mesmo plano que muda o fato (008, rotas novas, projeção).
- Nenhum `.claude/skills/` nem `.agents/skills/` no repo. [VERIFIED: ls]

## Summary

A Fase 8 é a Fase 7 repetida para Canal/Conversa/Mensagem, **com três diferenças que mudam o plano**. (1) Não existe "religar as telas": o chat inteiro continua no modelo antigo (`state.channels/conversations` hidratados por `GET /estado` e gravados por `POST /operacoes/:nome`); só a **página de conexão e a ficha do Canal** falam REST, e os Canais relacionais entram no estado antigo por **projeção**. (2) A projeção é a parte perigosa: `gravar()` persiste em `plataforma.registros` **qualquer registro de `state.channels` que não esteja no `original` hidratado** — um Canal projetado seria copiado para `registros` na primeira operação de qualquer tela, criando duas fontes de verdade. E se a projeção ficar só no handler de `GET /estado`, as operações rodadas no servidor (`startConversation`, `sendMessage`) não encontram o Canal relacional ("Canal não encontrado"), porque a Unidade de Trabalho hidrata sem ela. A solução prescrita é projetar em **dois lugares** (`GET /estado` e `executar()`), nunca dentro de `hidratar()`, e **tirar os Canais projetados de `state.channels` antes de `gravar()`**. (3) O fio (`ConversationThread`) é chaveado por `ChannelType` em ~20 pontos e tem 4 chamadores; passar para "uma aba por Canal" (`channelId`) é uma reescrita contida do componente, não um ajuste.

O backend segue a Fase 7 quase literalmente: `repositorios/crm/` → `servicos/crm/` → `rotas/crm/` registrados em `rotasDeCrm`, `comTransacao`, `FRASES` de SQLSTATE→409, permissão por `podeNoCrm` (estendida com `canal`/`conversa`/`mensagem`), testes `app.inject` com serviço falso + repositório contra Postgres local. A `008` proposta (Code Example 1) foi **aplicada e provada** num Postgres 16 descartável depois de `001..007` pelo `migrar` real: idempotente (2ª execução sem erro), com 17 cenários de integridade (dois WhatsApps lado a lado passam; mesmo número em oficial e não oficial é barrado por INV-CXE-01; Mensagem em Canal diferente do da Conversa é barrada pela FK composta; `em resposta a` de outra Conversa é barrado; id externo duplicado no mesmo Canal é barrado e em outro Canal passa; cascata Conversa→Mensagens funciona inclusive com `em resposta a`).

Cinco achados que o planner não pode perder: **(a)** a FK `conversas → contatos` faz o `DELETE permanente` de Contato (Fase 7) devolver `23503` com o nome `conversas_workspace_id_contato_id_fkey`, que **não está** em `FRASES` de `servicos/crm/contatos.ts` → hoje viraria 500; precisa de frase + pré-check; **(b)** o código da projeção consulta `plataforma.canais` em toda requisição `GET /estado`/`executar` — se rodar num banco sem a 008 (os testes do api usam o `.env` remoto quando não há banco local), tudo quebra com `42P01`; a projeção precisa de guarda `to_regclass` e a 008 tem de ser aplicada antes do código da projeção chegar a esse banco; **(c)** a ontologia INV-CXE-01 é por (tipo, identificador): o **mesmo número não pode ser conectado como oficial e como não oficial** ao mesmo tempo (o cenário de teste "dois WhatsApps" precisa de dois números); **(d)** D-13 (separador "via…" quando Canais se alternam) **não tem onde morar** depois de D-14: cada aba é a Conversa de um Canal só e não existe linha do tempo mista no código; **(e)** `criarCanal` (operação antiga) é chamado também pelos popups de criação/configuração de Lista — decidir se continua nascendo `conectada` (recomendado: sim, intocado) ou muda.

**Primary recommendation:** Execute em ondas domínio → 008 (+`--seco`) → repositórios/serviços/rotas → ponte (`/estado` + `executar` + `gravar` sem Canais projetados) → páginas de conexão → chat por Canal → e2e "dois WhatsApps" + aplicação da 008 + UAT. Reuse integralmente o esqueleto da Fase 7; não crie rotas web→api fora de `apps/web/src/dados/crm/`; nenhum pacote novo (`swr@2.5.1` já está em `apps/web/package.json`).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Provedor, Capacidades por (tipo, provedor), identificador canônico, nascer `desconectada`, regra de envio (janela/modelo) | Domínio (`@n1/dominio`) | API (aplica), Web (pré-valida o formulário) | "O que a coisa é": a tela e o endpoint precisam aplicar a MESMA regra (CONTEXT raiz) |
| Permissão de gerir Canal (B35) | Domínio (`podeNoCrm` + `recusaDeGerirCanais`) | API (lê Papel do banco e aplica) | Regra que só a tela conhece é aparência (comentário de `crm/permissoes.ts`) |
| Persistência, unicidade (INV-CXE-01/03/08), FKs compostas, coerência Mensagem↔Canal da Conversa | Banco (`008`) | API/repositórios traduzem SQLSTATE→409 | Corrida só o banco resolve |
| Isolamento por Espaço | API (`request.membro.workspaceId`) | Banco (FKs compostas) | `workspaceId` nunca vem do cliente |
| Casos de uso transacionais (criar Conversa + 1ª Mensagem, registrar recebida idempotente, simular conexão) | API (`servicos/crm/`) | Repositórios | "A transação começa e termina aqui" |
| Projeção dos Canais relacionais no `DataState` | API (`persistencia/`, módulo novo) | — | D-11: código do `apps/api`, removido na unificação |
| Páginas de conexão/ficha do Canal (escrita) | Web → HTTP (`dados/crm/canais.ts`) | — | D-11: grava por REST |
| Chat (abas por Canal, "Responder por", lista) | Web (store antigo) | Domínio (derivações puras) | Chat segue em `state.*` até a unificação |
| Ícone/rótulo/selo do provedor | Domínio (`PROVEDORES`) como fonte única; Web renderiza (`Pilula`) | — | O rótulo de tipo já é fonte única em `ROTULO_DO_TIPO_DE_CANAL` |

## Standard Stack

### Core (já no repositório — nenhuma instalação)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fastify | ^5.12.5 | HTTP | Transporte do `apps/api` [VERIFIED: `apps/api/package.json`] |
| @fastify/type-provider-zod + zod | ^1.0.0 / ^4.6.5 (api), ^4.6.1 (dominio) | Esquemas `.strict()` por rota | Padrão de `rotas/crm/*.ts` [VERIFIED: `rotas/crm/funis.ts:28-30,108`] |
| pg | ^8.23.0 | Postgres | `pool()` singleton; repositórios recebem `Pool \| PoolClient` [VERIFIED: `repositorios/CONTEXT.md`] |
| @fastify/cors | ^11.3.0 | CORS | Já libera `GET, POST, PATCH, PUT, DELETE` — **nada a mudar** [VERIFIED: `apps/api/src/app.ts:168`: `methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],`] |
| vitest | ^5.0.0 | Testes nos 3 workspaces | [VERIFIED: package.json dos workspaces] |
| next / react | 16.3.4 / 19.2.8 | Web | [VERIFIED: `apps/web/package.json`] |
| swr | 2.5.1 | Cache de leitura no cliente HTTP do CRM | **já instalado** na Fase 7 [VERIFIED: `apps/web/package.json:28` `"swr": "2.5.1"`] |
| lucide-react | (instalado) | Ícones das telas novas (cartões) | Usado em `conversation-thread.tsx` [VERIFIED: import em `conversation-thread.tsx:20-37`] |

### Supporting (reuso interno — não são pacotes)
| Módulo | Onde | Para quê |
|--------|------|----------|
| `identificadorCanonico`, `FORMA_DO_IDENTIFICADOR`, `ROTULO_DO_TIPO_DE_CANAL`, `TIPOS_DE_ATENDIMENTO` | `packages/dominio/src/operations/canais.ts:37,41,56,80` | Formulário (D-07) e validação do servidor (D-03) |
| `comTransacao`, `traduzirErroDePg`, `FrasesDeRestricao` | `apps/api/src/servicos/crm/transacao.ts` | Transação e 409 por constraint |
| `exigir`, `resolverProprietario`, `AcessoAoCrm` | `apps/api/src/servicos/crm/acesso.ts` | Permissão por Papel lida do banco |
| `responder`, `responderLista`, `PARAMS_ID`, `TEXTO_CURTO` | `apps/api/src/rotas/crm/comum.ts` | Envelope e fragmentos zod |
| `describeComBanco`, `novoEspacoDeTeste`, `prepararBancoCrm`, `semearMembro`, `limparEspaco` | `apps/api/src/testes/banco-crm.ts` | Testes contra Postgres local |
| `chamarCrm`, `ErroDeApi`, `invalidarCrm` | `apps/web/src/dados/crm/cliente-crm.ts` | Cliente HTTP único (token só no header; `content-type` só com corpo) |
| `Pilula` (`tom`: `neutro \| acento \| sucesso \| info \| aviso \| erro`), `StateSeal`, `ConditionMarker`, `Field`, `Select`, `TextInput`, `grade-solta`/`item-solto` | `apps/web/src/design/basicos.tsx:191`; `features/shell/ui.tsx`; `estilos/componentes.css:157` | Selo do provedor (D-04), cartões (D-06) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `provedor` como coluna `text` + `CHECK` (recomendado) | tabela `provedores_de_canal` | A tabela daria FK, mas o provedor carrega comportamento (Capacidades, passos do mockup) que mora no **domínio** em código; uma tabela duplicaria a fonte. Trocar o `CHECK` por outro é a `009` |
| Projeção em `executar` + `/estado` com remoção antes do `gravar` (recomendado) | Projetar dentro de `hidratar()` | `hidratar()` também é chamado por 9+ bootstraps/métricas que depois podem `gravar()` — vazaria a projeção para `registros`. Rejeitado |
| Projeção só em `GET /estado` | idem (ficaria mais simples) | `startConversation`/`sendMessage` no servidor falham ("Canal não encontrado") para Canal relacional. Rejeitado |
| `criarCanal` (op antiga) também criando relacional | — | Seria religar o chat; D-11 diz ponte. Rejeitado |

**Installation:** nenhuma. `npm install` não é necessário nesta fase. **Version verification:** `swr` confirmado em `apps/web/package.json` (2.5.1); nenhuma dependência nova em `apps/api` nem em `packages/dominio`. [VERIFIED: leitura dos três `package.json`]

## Package Legitimacy Audit

Nenhum pacote externo é instalado nesta fase; portanto o `package-legitimacy check` não se aplica.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (nenhum novo) | — | — | — | — | — | `swr@2.5.1` já aprovado e instalado na Fase 7 (`07-RESEARCH.md`, Package Legitimacy Audit: OK) |

**Packages removed due to [SLOP] verdict:** nenhum.
**Packages flagged as suspicious [SUS]:** nenhum.

## Architecture Patterns

### System Architecture Diagram

```
 Navegador (Client Components)
   │
   ├─ Páginas de conexão / ficha do Canal ───► HTTP REST (JWT Supabase em Authorization)
   │      apps/web/src/dados/crm/canais.ts          │  POST /canais · PATCH /canais/:id
   │      (chamarCrm + SWR)                         │  POST /canais/:id/simular-conexao | /desconectar | /arquivar
   │      depois de gravar → store.rehidratar()     ▼
   │                                       apps/api (Fastify 5)
   │                                        ├─ hook onRequest: JWT → request.membro {id, workspaceId, state}
   │                                        ├─ rotas/crm/{canais,conversas,mensagens}.ts   (zod .strict(); sem regra, sem SQL)
   │                                        ├─ servicos/crm/{canais,conversas,mensagens}.ts (exigir() → podeNoCrm; comTransacao;
   │                                        │     regras puras de @n1/dominio/crm/*; 409 com FRASES)
   │                                        └─ repositorios/crm/{canais,conversas,mensagens}.ts (SQL $n, workspace_id=$1)
   │                                                     ▼
   │                                           Postgres schema plataforma
   │                                             canais ◄── conversas ◄── mensagens   (008)
   │                                             └─ conversas.contato_id ──► contatos (007)
   │
   └─ Chat (Caixa, fio, Listas) ── GET /estado ─────────────────────────────────────────────┐
         useData(state.channels / conversations …)   POST /operacoes/:nome                   │
                                                          │                                  │
                         rotas/estado.ts ──hidratar()──► [registros]                         │
                         persistencia/unidade-de-trabalho.executar() ──hidratar()──► [registros]
                                   │                                                         │
                                   └─► acrescentarCanaisProjetados(state)  ◄── SELECT plataforma.canais
                                        (guarda to_regclass; Channel{provider, relational:true})
                                   │
                                   └─► operação pura (startConversation, sendMessage…)
                                   └─► REMOVE projetados de state.channels ──► gravar(registros)  ◄─ nunca grava Canal da tabela
```

### Recommended Project Structure
```
packages/dominio/src/
├── types/crm.ts                  # + ProvedorDeCanal; Channel.provider?, Channel.relational?, Channel.simulatedConnection?
├── provedores-de-canal.ts        # PROVEDORES (rótulo, selo, tipo, sobreposição de Capacidade) — folha, sem import de operations
├── operations/conversations.ts   # + capacidadesDoCanal(canal) ao lado de CHANNEL_CAPABILITIES (uma só fonte)
├── derive-conversacional.ts      # + canaisQueAlcancam(state, contact), canalPadraoDeResposta(...)
└── crm/
    ├── canais.ts                 # tipos Canal(pt-BR)+DTOs, validarNovoCanal, transições de conexão, rótulo "Comercial · WhatsApp oficial"
    ├── conversas.ts              # tipos Conversa, validarNovaConversa, transições situacao
    ├── mensagens.ts              # tipos Mensagem, validarEnvio (janela/modelo), regras de status
    └── permissoes.ts             # RecursoCrm += "canal" | "conversa" | "mensagem"; AcaoCrm += "conectar"…
apps/api/
├── migracoes/008-canais-conversas-mensagens.sql
└── src/
    ├── persistencia/canais-projetados.ts   # carregar + acrescentar + remover antes do gravar (único módulo da ponte)
    ├── repositorios/crm/{canais,conversas,mensagens,referencias}.ts   # referencias.ts = Fila/Origem/legados lidos de registros
    ├── servicos/crm/{canais,conversas,mensagens}.ts
    ├── rotas/crm/{canais,conversas,mensagens}.ts  (+ registro em rotas/crm/index.ts e OpcoesDeCrm)
    └── e2e/canais-fluxo.test.ts            # "dois WhatsApps lado a lado" por app.inject
apps/web/src/
├── dados/crm/canais.ts                     # useCanais/useCanal + criar/editar/simular/desconectar/arquivar
├── app/(shell)/crm/caixa-de-entrada/configuracoes/canais/conectar/page.tsx            # escolha (4 cartões)
├── app/(shell)/crm/caixa-de-entrada/configuracoes/canais/conectar/[provedor]/page.tsx # orientação + formulário
└── features/crm/                           # seletor-de-canal, selo-do-provedor, conversation-thread (reescrito por canal)
```

### Pattern 1: Provedor como dado do domínio, folha sem dependência
**What:** um arquivo folha `packages/dominio/src/provedores-de-canal.ts` com `PROVEDORES_DE_CANAL = ["whatsapp-cloud","whatsapp-nao-oficial","instagram-graph","email-imap-smtp"] as const`, `type ProvedorDeCanal`, e `PROVEDORES: Record<ProvedorDeCanal, { tipo: ChannelType; rotulo: string; selo: string; … }>`. O `CHECK` de `canais.provedor` na 008 e o `z.enum` da rota espelham essa lista (mesmo contrato "cópia literal" da `comum.ts` da Fase 7, com `satisfies`).
**Why:** D-01 é "costly" — o nome entra na coluna, no REST e na URL `[provedor]`. Usar exatamente os quatro slugs de D-01 (URL-safe) evita um mapa slug↔valor. `[ASSUMED]` que o dono aceita esses slugs como definitivos (A1).
**Sobreposição de Capacidade (D-02):** em `operations/conversations.ts`, ao lado de `CHANNEL_CAPABILITIES`, **uma** função:
```typescript
// Esboço — fonte única; todo leitor de janela/modelo passa por ela.
export function capacidadesDoCanal(canal: { channelType: ChannelType; provider?: ProvedorDeCanal }): ChannelCapabilities {
  const base = CHANNEL_CAPABILITIES[canal.channelType];
  const provedor = canal.provider ?? PROVEDOR_PADRAO_DO_TIPO[canal.channelType]; // seed/legado: whatsapp → whatsapp-cloud
  if (provedor === "whatsapp-nao-oficial") {
    const { responseWindowHours: _semJanela, ...resto } = base;       // sem janela de 24h
    return { ...resto, requiresTemplateOutsideWindow: false };        // sem modelo aprovado
  }
  return base;
}
```
`exactOptionalPropertyTypes` é `false`, então remover a chave por desestruturação é limpo. Canal sem `provider` (seed, `criarCanal` antigo) mantém exatamente o comportamento de hoje (WhatsApp = oficial).

### Pattern 2: Módulos novos `crm/{canais,conversas,mensagens}.ts` (padrão D-01 da Fase 7)
Tipos em português espelhando a 008 (`snake_case` → `camelCase`), regras puras `(entrada) → OperationResult`, sem barril (`@n1/dominio/crm/canais`; o `package.json` do domínio exporta `"./*": "./src/*.ts"`, então `crm/canais` resolve). [VERIFIED: `packages/dominio/package.json` exports; `src/crm/` já existe com `comum`, `contatos`, `funis`…]. Funções mínimas: `validarNovoCanal` (provedor→tipo, `identificadorCanonico`, nome não vazio), `proximaConexao`, `rotuloDoCanal(canal)` ("Comercial · WhatsApp oficial"), `validarEnvio({capacidades, ultimaRecebidaEm, agora, modeloId})` (RN-CXE-19 — a mesma que `sendMessage` aplica hoje, agora por (tipo, provedor)). Reuse `identificadorCanonico`/`FORMA_DO_IDENTIFICADOR` de `operations/canais.ts` (import interno do pacote — permitido).

### Pattern 3: Repositório → serviço → rota (cópia da Fase 7)
- Repositório: interface + `criarRepositorioDeCanaisPg(cliente: Pool | PoolClient)`; `workspace_id = $1` em todo `WHERE`; lista com `count(*) over()` ou `count(*)::int`; datas `::text`; **`timestamptz` volta como `Date` → converter para ISO** (`linhaParaFunil` faz isso). [VERIFIED: `repositorios/crm/funis.ts:132` `linhaParaFunil`]
- Serviço: `criarServicoDeCanais({ pool, acesso })`; `exigir(acesso, membro, acao, "canal")` **antes** de abrir a transação; `comTransacao(pool, fn, FRASES)`; recusa é valor (`recusa(409, …)`).
- Rota: `rotasDeCanais(app, { servico })` com `app.withTypeProvider<ZodTypeProvider>()`; corpos `.strict()`; `DELETE`/ações sem corpo **não declaram `body`**; registro em `rotas/crm/index.ts` + `OpcoesDeCrm.canais?` para injetar serviço falso em `buildApp({ crm })`. [VERIFIED: `rotas/crm/index.ts:27-53`]
- **Contrato REST proposto** (Claude's Discretion; o planner ajusta nomes):

| Verbo + rota | Efeito | Papel |
|---|---|---|
| `GET /canais?estado=&tipo=&provedor=&conexao=&q=&limite=&deslocamento=` | lista `{ itens, total }` (default `estado=ativo`; `QUERY_LISTA` da Fase 7 **não serve**: aceita `na_lixeira`, e Canal só tem `ativo`/`arquivado`) | ler: todos os Membros ativos/suspensos |
| `GET /canais/:id` | ficha | ler |
| `POST /canais` `{ provedor, nome, identificador, filaPadraoId?, origemPadraoId? }` → 201 | cria **`desconectada`**; o servidor deriva `tipo` do `provedor` e o identificador canônico; `conexao`/`estado`/`configuradoPor`/`tipo` **fora do corpo** | `administrador`/`proprietario` |
| `PATCH /canais/:id` `{ nome?, filaPadraoId?\|null, origemPadraoId?\|null }` | configura (INV-CXE-02: tipo e identificador imutáveis) | idem |
| `POST /canais/:id/simular-conexao` | `desconectada → conectada` com `conexao_simulada=true`, `conectada_em=now()` | idem |
| `POST /canais/:id/desconectar` | `conectada/com_erro → desconectada`, zera `conexao_simulada` | idem |
| `POST /canais/:id/arquivar` | exige/forca `desconectada` (11.1) — **opcional** (CONTEXT: "se couber") | idem |
| *(sem `DELETE`)* | DO-CXE-03: Canal não tem lixeira nem eliminação individual | — |
| `GET /conversas?canalId=&contatoId=&situacao=&estado=` · `GET /conversas/:id` | leitura (com `participantes`) | ler |
| `POST /conversas` `{ canalId, contatoId, mensagem: { conteudo } }` → 201 | **atômico**: Conversa + 1ª Mensagem (INV-CXE-05); 409 `CONVERSA_JA_ABERTA` devolvendo o id da existente (INV-CXE-03; ontologia 12.4); 409 se Canal arquivado; exige identificador do Contato do tipo que o Canal resolve (RN-CXE-21) | `membro`+ |
| `POST /conversas/:id/resolver` · `/reabrir` | transições `situacao` (A4.5) | `membro`+ |
| `GET /mensagens?conversaId=&limite=&deslocamento=` | ordem `criado_em, seq` | ler |
| `POST /mensagens` `{ conversaId, direcao: "enviada"\|"interna", conteudo, modeloId?, emRespostaAId? }` | aplica `validarEnvio` por (tipo, provedor); `status_entrega` = `pendente` se o Canal não está `conectada` (B69), senão `enviada` | `membro`+ |
| *(sem rota de `recebida`)* | a Mensagem recebida entra por `servico.registrarRecebida(...)` (idempotente pelo id externo, usado pelos testes e pelo webhook futuro) — **não** por um endpoint humano | — |

### Pattern 4: Mensagem recebida idempotente e `carga_bruta`
`registrarRecebida` faz `insert … on conflict (workspace_id, canal_id, id_externo) where id_externo is not null do nothing returning …` (INV-CXE-08, RN-CXE-17) e devolve a existente quando repetida. `carga_bruta` entra **como veio** (jsonb) e **não sai** nas listagens por padrão (só no `GET` de uma Mensagem se necessário): contém dado pessoal. A anonimização do Contato (ontologia documento 10, 12.5) tem de zerar `carga_bruta` junto com o conteúdo — registrar como requisito da fase de anonimização, e já proibir a coluna em `SELECT` de lista. `[ASSUMED]` que o dono quer isso (A9).

### Pattern 5: A ponte de projeção (D-11) — o ponto mais delicado
**Fatos lidos:**
- `GET /estado` chama `hidratar(cliente, ws)` e devolve `state` (`rotas/estado.ts`, handler `app.get("/estado")`). [VERIFIED: leitura]
- `executar()` chama `hidratar` (`unidade-de-trabalho.ts:128`), roda a operação e chama `gravar(cliente, workspaceId, antes.state, antes)` (`unidade-de-trabalho.ts:173`). [VERIFIED]
- `gravar()` (`repositorio.ts:161`) percorre `Object.entries(depois)` e faz `upserts.push(...)` (`repositorio.ts:195`) para todo registro cujo JSON canônico difere de `antes.original` — **inclusive registros que a operação nem tocou, se não estiverem no `original`**. [VERIFIED]
- `hidratar()` também é chamado por `observabilidade/metricas.ts:242` e `bootstrap/*.ts` (≥8 sítios), que podem `gravar` depois. [VERIFIED: grep]
- A web roda a operação numa cópia local e manda `nome+args` ao servidor, que **reexecuta** sobre o estado hidratado dele (`store.ts` cabeçalho; `transporte.ts: gravarUma`). [VERIFIED]

**Prescrição:** módulo único `persistencia/canais-projetados.ts` com
1. `carregarCanaisProjetados(cliente, workspaceId): Promise<Channel[]>` — `select … from plataforma.canais where workspace_id = $1` após `select to_regclass('plataforma.canais')` (guarda; cache só do resultado positivo); mapeia `conexao 'com_erro' → 'comErro'`, `estado → lifecycle`, `criado_em → createdAt (ISO)`, `createdBy = { kind: "member", id: criado_por }`, `configuredByMemberId = configurado_por`, `defaultQueueId = fila_padrao_id`, `defaultOriginId = origem_padrao_id`, `messageTemplates: []`, `groupsEnabled`, **`provider`, `relational: true`, `simulatedConnection`**;
2. `acrescentarCanaisProjetados(state, canais)` — `state.channels.push(...)`; **não** entra em `hidratar`;
3. `retirarCanaisProjetados(state, ids)` — filtra `state.channels` antes de `gravar()`; se algum projetado foi **modificado** pela operação (compare `canonico()` antes/depois), lançar erro explícito em vez de descartar em silêncio.

`rotas/estado.ts` e `unidade-de-trabalho.executar` chamam (1)+(2) logo após `hidratar`; `executar` chama (3) antes de `gravar`. `ordensComoObjeto(ordem)` não terá entrada para os projetados — `aplicarDiferenca` trata vizinho de ordem desconhecida ("ficam ao fim"). [VERIFIED: `diferenca.ts:84` comentário "Varredura linear … Um vizinho de ordem desconhecida é pulado"]. No domínio, `configurarCanal` deve **recusar** Canal `relational` com frase clara ("Este Canal se configura pela ficha do Canal") — defesa em profundidade.

**Ids sem colisão (Claude's Discretion):** usar o `id` cru da tabela (`gen_random_uuid()::text`). O seed usa `chn_…` (`seed.ts:1516-1520`: `"chn_wpp"`, `"chn_insta"`, `"chn_mail"`, `"chn_site"`, `"chn_linkedin"`) e `nextId()` produz `<prefixo>_<6 chars>`; um UUID não casa com `PADRAO_ID = /^[a-z]+_([0-9a-z]{6})$/` de `syncIdSequence`, então não perturba o contador. [VERIFIED: `activity.ts:31`]. Não é preciso prefixo nem tabela de ids.

**Outbox `automacao.notificar-canal.v1`:** o payload carrega `canal: pedido.canal` e `pedido.canal` é o literal `"whatsapp"` (tipo), não id de Canal (`eventos-de-canal.ts:65`; `automations.ts:840,872`). O `aggregateId` é `${executionId}:${indicePasso}` (`eventos-de-canal.ts:60`). Portanto a projeção **não toca o contrato**; o teste `notificar-canal.contrato.test.ts` continua verde sem mudança. [VERIFIED]. Cuidado análogo: `ferramentas/automacoes.ts:105` escolhe "o primeiro Canal `whatsapp` ativo" — com dois WhatsApps o escolhido passa a depender da ordem de `state.channels` (Open Question 4).

**Revisão do Espaço:** escrita REST em `plataforma.canais` não incrementa `plataforma.workspaces.revisao`; `verificarRevisao` do cliente não notaria. Recomendação (Claude's Discretion, `[ASSUMED]` A4): as rotas de **escrita de Canal** fazem `update plataforma.workspaces set revisao = revisao + 1` na mesma transação, porque o estado hidratado de fato mudou; o chamador local, de todo modo, chama `rehidratar()` depois do POST.

### Pattern 6: Páginas de conexão (web)
- Rotas: `configuracoes/canais/conectar/page.tsx` (4 cartões, `grade-solta`/`item-solto`, `Link`) e `conectar/[provedor]/page.tsx` (`params: Promise<{ provedor: string }>`, `use(params)`, `notFound()` se o slug não está em `PROVEDORES_DE_CANAL`). Estático convive com dinâmico: `configuracoes/` já é estático ao lado de `[conversa]` em `crm/caixa-de-entrada/`. [VERIFIED: `rotas.ts:32` regex com `(?!configuracoes…)` e árvore `find`]
- `rotas.ts`: `formaDe("/crm/caixa-de-entrada/configuracoes/canais/conectar/whatsapp-cloud")` já cai em `tabela` (a regra `caixa` exclui `/configuracoes`) e `chaveDeChegada` não colapsa `configuracoes` — **nenhuma mudança em `rotas.ts`**, só acrescentar asserções em `rotas.test.ts`. [VERIFIED: `rotas.ts:18,32`]
- O formulário reaproveita `FORMA_DO_IDENTIFICADOR[tipo]` + `identificadorCanonico` para pré-validar (como `adicionar-canal-dialog.tsx:71`); Fila/Origem: `state.queues` e `state.catalog` (`kind === "origem"`, `lifecycle === "ativo"`) continuam vindo do store. [VERIFIED: `adicionar-canal-dialog.tsx:85-86`]
- Depois do `POST /canais`: `invalidarCrm("/canais")` **e** `useStore().rehidratar()` (o store é a fonte do chat), depois `router.push` para a ficha. A ficha do Canal (`canais/[canal]/page.tsx`) hoje lê `state.channels` e grava por `configurarCanal` via `run()`: para Canal `relational` passa a gravar por `PATCH /canais/:id` (e `rehidratar()`); para o do seed (demo) continua igual. Os botões "Simular conexão"/"Desconectar" só para quem `usePodeNoCrm("simular_conexao","canal")`.
- "Origem" na lista (D-12): `channel.relational ? "tabela" : "demo"` numa `Pilula` ou no `meta`.
- **Documentos a atualizar:** `apps/web/CONTEXT.md`.

### Pattern 7: Chat por Canal (web)
Mudanças concretas no `conversation-thread.tsx` (1409 linhas, sem testes hoje):
1. `channelsOf(contact): ChannelType[]` (`:191`) e `ORDEM_DOS_CANAIS` (`:114`) → derivação **por Canal**: `canaisQueAlcancam(state, contact): Channel[]` (Canais `ativo` cujo tipo o Contato tem Identificador; ordem estável: tipo da plataforma, depois `createdAt`). Mover para função pura em `derive-conversacional.ts` (já tem `canaisDaListaQueAlcancam`, `:154`) para ser testável sem jsdom.
2. `canalSelecionado`/`onCanalChange`/`canalAtivo`/`canal` (`:348`) de `ChannelType` → `Id` (`channelId`). **Chamadores a atualizar** (4): `[conversa]/page.tsx:431`, `deal-screen.tsx:658`, `legado/ficha-de-contato-legado.tsx:254`, `estrutura/tarefa-completa.tsx:2124`; mais `legado/ficha-de-empresa-legado.tsx:257` (sem prop) e quem importa `channelsOf` (`ficha-de-empresa-legado.tsx:121`, `ficha-de-contato-legado.tsx:138`).
3. As abas (`:522`, `ORDEM_DOS_CANAIS.map`) viram uma por Canal (D-14): ícone do tipo + `rotuloDoCanal` + contador; desabilitada quando o Contato não tem o Identificador do tipo (a regra de hoje). Hoje a fileira mostra **todos os tipos sempre**, "desligados dizendo por quê" — com N Canais, mostrar **todos os Canais ativos do Espaço** mantém a mesma ideia.
4. `canalAtivoId()` (`:393`) — "o primeiro Canal ativo do tipo" — é exatamente o que D-15 elimina: passa a ser `canal.id` da aba/seletor.
5. "Responder por" (D-15): `Select` no compositor com padrão = `channelId` da Conversa da **última Mensagem `recebida`** do Contato (derivação pura `canalPadraoDeResposta`); oferece Canais `connection === "conectada"` com Identificador do Contato. Trocar → `startConversation(data, me, channelId, contact.id)` (que já devolve a Conversa existente do par — `conversations.ts:706-713`, `if (existente) return ok(existente);`) e muda a aba; nunca altera `Conversation.channelId`. [VERIFIED: `conversations.ts:672-713`]
6. `capacidades` (`:362`) e `responseWindowOpenUntil(..., (tipo) => CHANNEL_CAPABILITIES[tipo])` (`:364-368`) → por Canal via `capacidadesDoCanal`.
7. Cabeçalho (D-13): barra já existente "`{channel.name} · janela …`" (`:~590`) ganha ícone do tipo + selo do provedor. `[conversa]/page.tsx` (`:114`, `:221`) idem.
8. Lista (D-16): `inbox-columns.tsx:282-283` (`channel?.channelType` → ícone) ganha o nome do Canal; filtro `:470-475` (`${c.name} · ${CHANNEL_TYPE_LABEL[c.channelType]}`) ganha o selo; `isOutsideWindow` (`:527`) → `capacidadesDoCanal`.
- **D-13 separador:** ver Open Question 2 — não há host.

### Anti-Patterns to Avoid
- **Projetar Canal dentro de `hidratar()`** — vaza para bootstraps/métricas e, depois, para `registros` via `gravar`.
- **Importar `apps/api` no web (ou vice-versa)** — erro de arquitetura.
- **Passar Canal/Conversa/Mensagem por `POST /operacoes/:nome`** para o modelo relacional — contraria D-09/D-11.
- **Aceitar `workspaceId`, `tipo`, `conexao`, `estado`, `configuradoPor`, `conexaoSimulada` no corpo** — mass assignment; só `provedor`, `nome`, `identificador`, `filaPadraoId`, `origemPadraoId`.
- **Mexer em Fila/Participante relacionais** — fora de escopo (D-09).
- **`ON DELETE SET NULL` composto para `identificador_id` da Mensagem** — pondo `workspace_id` em `NULL` a FK falha; a 008 proposta deixa `identificador_id` sem FK (ver Pitfall 2).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unicidade de Canal (nome e conta), uma Conversa não resolvida por (Contato, Canal), id externo por Canal, Mensagem no Canal da Conversa, `em resposta a` na mesma Conversa | Checagem só em código | **Constraints/índices da 008** + tradução de SQLSTATE em `FRASES` | Corridas só o banco resolve; o serviço pré-checa só para a mensagem rica |
| Forma canônica do identificador (+55…, e-mail minúsculo, `@usuario`) | regex nova | `identificadorCanonico` / `FORMA_DO_IDENTIFICADOR` (`operations/canais.ts:56,80`) | Já é a forma do seed; mudar quebra INV-CXE-01 |
| `atualizado_em` | `set atualizado_em = now()` | trigger `plataforma.crm_toque_atualizado_em()` da 007 (`007-crm.sql:32`) | Já existe e é reaproveitável |
| UUID de registro | gerador no código | `default gen_random_uuid()::text` | Padrão da 007 |
| Cache de leitura no cliente | `useEffect`+estado | `swr` via `useSWR` + `invalidarCrm` | Padrão da Fase 7 |
| Permissão por Papel | `if (papel === …)` na rota | `podeNoCrm` estendido + `exigir()` | A mesma regra na tela e no endpoint |
| Dedupe de entrega repetida do provedor | `select` + `insert` | `insert … on conflict … do nothing` no índice parcial de `id_externo` | Atomicidade |
| Garantir "toda Conversa tem ≥1 Mensagem" (INV-CXE-05) | só convenção | criar Conversa + Mensagem na mesma `comTransacao`; **opcional**: constraint trigger deferido como o da 007 (`crm_exige_admin_na_empresa`) | O padrão já existe no repo |

**Key insight:** a 008 codifica a maior parte da integridade (provada); o trabalho do serviço é montar a transação certa e dar a mensagem útil — não reimplementar o que o banco garante.

## Common Pitfalls

### Pitfall 1: Código da projeção rodando num banco sem a 008 derruba `/estado` e `/operacoes`
**What goes wrong:** `GET /estado` e `executar()` passam a consultar `plataforma.canais`. Em qualquer banco sem a 008 (o remoto, até o dono aplicá-la; e os testes do api que usam `Boolean(process.env.DATABASE_URL)` sem exigir host local — p.ex. `rotas/estado.test.ts`, `unidade-de-trabalho*.test.ts`), toda requisição falha com `42P01` e, dentro da transação, aborta-a.
**Why it happens:** `carregarEnv()` só preenche variáveis ausentes; testes sem `describeComBanco` rodam contra o `.env`. [VERIFIED: `07-RESEARCH.md` Pitfall 11; `rotas/estado.test.ts` `temBanco = Boolean(process.env.DATABASE_URL)`]
**How to avoid:** (a) `select to_regclass('plataforma.canais')` antes (e só consultar se existir; cachear apenas o positivo); (b) ordem das ondas: a 008 é **aplicada** (`--seco` → dono → `migrar`) antes de o código da projeção ser mesclado; (c) teste que prova a guarda (banco só com 001..007 ⇒ `GET /estado` ainda 200).
**Warning signs:** `relation "plataforma.canais" does not exist` em testes antigos de `rotas/` e `persistencia/`.

### Pitfall 2: Chaves estrangeiras novas quebram os fluxos da Fase 7 (Contato) e o `limparEspaco`
**What goes wrong:** (i) `conversas.contato_id` referencia `contatos` sem `ON DELETE`; apagar Contato com Conversa dá `23503` `conversas_workspace_id_contato_id_fkey` (provado na 008 de teste). `servicos/crm/contatos.ts` só conhece `negocios_workspace_id_contato_id_fkey` em `FRASES` (`:72-86`) → o `excluirPermanentemente` (`:419-440`) e o envio à lixeira com pré-check (`:405-411`) viram **500 genérico**. (ii) `testes/banco-crm.ts:60-68` apaga `negocios … contatos, funis` sem as tabelas novas ⇒ `limparEspaco` falha com FK.
**How to avoid:** acrescentar a frase `CONTATO_COM_CONVERSAS` em `FRASES` e um pré-check (`conversasDoContato`) no `excluirPermanentemente` com `bloqueios` (estender `BloqueiosCrm` com `conversas`); acrescentar `mensagens`, `conversas`, `canais` **antes** de `contatos` em `limparEspaco`. Pela mesma razão, `mensagens.identificador_id` fica **sem FK** (apagar um Identificador de Contato, hoje permitido, não pode ser barrado por Mensagem) e guarda também `remetente_externo` (o valor como o provedor mandou).
**Warning signs:** `DELETE /contatos/:id/permanente` retornando 500 num Contato com Conversa; `limparEspaco` lançando `23503`.

### Pitfall 3: `gravar()` copia Canais projetados para `plataforma.registros`
**What goes wrong:** `state.channels` com um Canal que não veio do `original` ⇒ `upserts.push` em `repositorio.ts:195`. Na primeira operação de qualquer tela, o Canal relacional vira também registro `channels` (duas fontes de verdade, divergindo na primeira edição).
**How to avoid:** Pattern 5 (retirar antes de `gravar`; teste que roda uma operação qualquer e prova `select count(*) from plataforma.registros where colecao = 'channels'` inalterado). Não é preciso mudar a assinatura de `gravar`.

### Pitfall 4: Projeção só no `GET /estado` ⇒ operação do servidor não acha o Canal
**What goes wrong:** o cliente tem o Canal projetado e roda `startConversation(channelId=<uuid>)` localmente com sucesso; o servidor reexecuta sobre `hidratar()` sem a projeção ⇒ `Canal não encontrado.` (`conversations.ts:686`) e o cliente re-hidrata, desfazendo o gesto.
**How to avoid:** projetar também em `executar()` (Pattern 5). Teste de integração: `POST /operacoes/iniciarConversa`/`startConversation` num Canal relacional ⇒ 200 e Conversa gravada em `registros` com `channelId` do UUID.

### Pitfall 5: ~10 sítios leem `CHANNEL_CAPABILITIES[channelType]` para janela/modelo
Para o WhatsApp não oficial ficar "sem janela", **todos** precisam passar por `capacidadesDoCanal`. Inventário lido:

| Camada | Sítio | Lê |
|---|---|---|
| domínio | `operations/conversations.ts:108` (`windowOpenUntil`), `:158` (`sendMessage` janela/modelo) | `responseWindowHours`, `requiresTemplateOutsideWindow` |
| domínio | `derive.ts:347` — `responseWindowOpenUntil(state, conversation, capabilities: (type: string) => …)` recebe uma **função por tipo** | `responseWindowHours` → trocar o callback para receber o Canal |
| domínio | `operations/conversations.ts:389` (`receiveMessage`), `:696` (`startConversation`), `derive-conversacional.ts:154` | `resolvesIdentifierTypes` — **não muda** por provedor |
| domínio | `operations/ferramentas/flows.ts:859` | `sendableMediaTypes.includes("flow")` — ver Open Question 4 |
| web | `configuracoes/page.tsx:76`, `canais/[canal]/page.tsx:70`, `[conversa]/page.tsx:114`, `inbox-columns.tsx:527`, `contact-card.tsx:163`, `conversation-thread.tsx:362,367`, `ferramentas/flow-popup.tsx:447` | janela/capacidades exibidas |
Os dois chamadores web de `responseWindowOpenUntil` (`conversation-thread.tsx:364`, `flow-popup.tsx:447`) mudam junto com o callback. Não há teste de `derive.responseWindowOpenUntil` hoje [VERIFIED: grep em `*.test.ts*`], então ele ganha teste novo.

### Pitfall 6: `ConversationThread` não tem teste e tem 4 chamadores
Reescrever abas/seleção sem rede é arriscado. **Extrair a lógica para funções puras no domínio** (`canaisQueAlcancam`, `canalPadraoDeResposta`, `rotuloDoCanal`) com testes, e só então ligar no componente; adicionar um teste de componente mínimo (jsdom, store com 2 WhatsApps) para o seletor "Responder por". `apps/web/src/features/crm/` não tem `conversation-thread.test.tsx` nem `inbox-columns.test.tsx`. [VERIFIED: ls]

### Pitfall 7: Next 16 — `[provedor]` é `Promise`; slug inválido
`params: Promise<{ provedor: string }>` + `use(params)`; slug fora da lista ⇒ `notFound()` (a doc diz para validar param de conjunto fixo em runtime). Nunca usar `provedor` direto em `PROVEDORES[provedor]` sem o guarda (com `noUncheckedIndexedAccess` o TS já força `undefined`). [CITED: `node_modules/next/dist/docs/.../dynamic-routes.md`, trecho "isValidLocale … notFound()"]

### Pitfall 8: Dois Contatos, dois mundos
O chat usa `state.contacts` (modelo **antigo**, identificadores `identidadeDeWhatsApp`…); a Conversa relacional aponta para `plataforma.contatos` (007, tipos `telefone/email/whatsapp/instagram`). Contatos criados pela Fase 7 **não aparecem** no chat e vice-versa (limitação D-15 da Fase 7, mantida). Consequência para esta fase: `POST /conversas` só é exercitado por REST/teste; a UI de chat não cria Conversa relacional. Mapeamento relacional tipo→identificador: `whatsapp→'whatsapp'`, `instagram→'instagram'`, `email→'email'` (`telefone` é distinto de `whatsapp`, ver cabeçalho do bloco de identificadores em `007-crm.sql`; CHECK em `007-crm.sql:113`).

### Pitfall 9: `Message.createdAt` (provedor) × recebimento
Para `recebida`, `criado_em` é o momento do **provedor**; `registrado_em` é o da plataforma (7.6). Ordenar por `(criado_em, seq)`; `seq` (identity) desempata e dá estabilidade à paginação. A janela de resposta usa `criado_em` da última `recebida` (como `windowOpenUntil`). Não usar `now()` como default de `criado_em` no código de ingestão.

### Pitfall 10: `QUERY_LISTA` e `ESTADO` da Fase 7 não servem a Canal/Conversa
`comum.ts` define `ESTADO = z.enum(ESTADOS_CRM)` com `na_lixeira`; Canal só tem `ativo|arquivado` (DO-CXE-03) e Conversa tem `ativo|na_lixeira` (sem `arquivado`). Criar `QUERY_LISTA_DE_CANAIS` e `QUERY_LISTA_DE_CONVERSAS` próprias; não reusar o enum de 3 valores (aceitaria `estado=na_lixeira` para Canal e devolveria lista vazia sem erro).

### Pitfall 11: Ordem e idempotência da 008
O arquivo usa `create … if not exists`, `drop trigger if exists`, `create index if not exists` — como a 007 — e **reaproveita** `plataforma.crm_toque_atualizado_em()`. A função só existe depois da 007; a 008 depende dela (a ordem alfabética do `migrar` garante). Nada pode ser editado na 007 (aplicada em 2026-10-11).

### Pitfall 12: INV-CXE-01 × "dois WhatsApps"
O índice `canais_conta_uq (workspace_id, tipo, identificador_externo) where estado = 'ativo'` impede o mesmo número em oficial e em não oficial ao mesmo tempo (provado: erro `canais_conta_uq`). O caso de teste da fase (CONTEXT `<specifics>`) tem que usar **dois números distintos**. Se o dono quiser o mesmo número nos dois provedores, é decisão de produto que contradiz a ontologia (INV-CXE-01) — Open Question 3.

### Pitfall 13: `Simular conexão` mente se sobrar em produção
Uma Mensagem `enviada` num Canal simulado fica `enviada` sem sair de lugar nenhum. O marcador visível (D-08) é obrigatório; e quando o primeiro provedor real chegar, o botão deve sumir para aquele provedor (`conexao_simulada` existe para permitir isso). Registrar como pendência na Open Question 7.

## Code Examples

### 1. `008-canais-conversas-mensagens.sql` (aplicada e provada em Postgres 16 sobre `001..007` pelo `migrar` real; 2ª execução sem erro)
```sql
-- Modelagem relacional de Canal, Conversa e Mensagem (Caixa de Entrada).
-- Fonte: ontologia/03-crm/caixa-de-entrada-e-mensageria.md (7.2, 7.5, 7.6, 11.1, 12.2, 14).
--
-- No padrao da 007: uma tabela por entidade, `workspace_id` em tudo, PK
-- (workspace_id, id), toda FK entre elas composta. O trigger de
-- `atualizado_em` reaproveita `plataforma.crm_toque_atualizado_em()` da 007.
--
-- Decisoes do produto que SOBREPOEM ou PRECISAM a ontologia (Fase 8):
--   * D-01: o Canal ganha `provedor`; `tipo` continua whatsapp/instagram/email.
--   * D-08: o Canal nasce `desconectada` (12.2); `conexao_simulada` marca a
--     conexao feita pelo botao "Simular conexao", enquanto nao ha provedor real.
--   * D-09: Fila e Participante NAO ganham tabela: `fila_id` e texto sem FK;
--     Participantes sao jsonb na Conversa.
--   * D-10: a Mensagem guarda o modelo completo de 7.6 mais `carga_bruta`.
--
-- Fora desta migracao, de proposito: credenciais do Canal (so entram com o
-- provedor real, com a decisao de como guardar segredo), Mensagens de modelo,
-- Grupos, Tags/Valores de Campo/Rascunho/Adiamento por Membro da Conversa.

create schema if not exists plataforma;

create table if not exists plataforma.canais (
  id                      text        not null default gen_random_uuid()::text,
  workspace_id            text        not null,
  nome                    text        not null,
  tipo                    text        not null,
  provedor                text        not null,
  identificador_externo   text        not null,
  conexao                 text        not null default 'desconectada',
  conexao_simulada        boolean     not null default false,
  conectada_em            timestamptz,
  estado                  text        not null default 'ativo',
  arquivado_em            timestamptz,
  configurado_por         text        not null,
  fila_padrao_id          text,
  proprietario_padrao_id  text,
  origem_padrao_id        text,
  grupos_habilitados      boolean     not null default false,
  criado_por              text        not null,
  criado_em               timestamptz not null default now(),
  atualizado_em           timestamptz not null default now(),
  primary key (workspace_id, id),
  constraint canais_nome_ck check (length(btrim(nome)) > 0),
  constraint canais_identificador_ck check (length(btrim(identificador_externo)) > 0),
  constraint canais_tipo_ck check (tipo in ('whatsapp', 'instagram', 'email')),
  constraint canais_provedor_ck check (provedor in
    ('whatsapp-cloud', 'whatsapp-nao-oficial', 'instagram-graph', 'email-imap-smtp')),
  -- O provedor pertence a um tipo so (D-01): nao existe "email" com provedor de WhatsApp.
  constraint canais_provedor_tipo_ck check (
    (tipo = 'whatsapp'  and provedor in ('whatsapp-cloud', 'whatsapp-nao-oficial'))
 or (tipo = 'instagram' and provedor = 'instagram-graph')
 or (tipo = 'email'     and provedor = 'email-imap-smtp')),
  constraint canais_conexao_ck check (conexao in ('conectada', 'desconectada', 'com_erro')),
  constraint canais_estado_ck check (estado in ('ativo', 'arquivado')),
  -- 11.1: Canal arquivado e sempre desconectado.
  constraint canais_arquivado_desconectado_ck check (estado <> 'arquivado' or conexao = 'desconectada'),
  -- A simulacao so existe enquanto o Canal esta conectado.
  constraint canais_simulada_ck check (not conexao_simulada or conexao = 'conectada'),
  constraint canais_arquivamento_ck check ((estado = 'arquivado') = (arquivado_em is not null))
);

-- RN-CXE-31: nome unico entre Canais ativos, sem distinguir caixa nem espacos nas pontas.
create unique index if not exists canais_nome_uq
  on plataforma.canais (workspace_id, lower(btrim(nome))) where estado = 'ativo';
-- INV-CXE-01: a mesma conta (tipo, identificador) nao e conectada duas vezes entre Canais ativos.
create unique index if not exists canais_conta_uq
  on plataforma.canais (workspace_id, tipo, identificador_externo) where estado = 'ativo';
create index if not exists canais_estado_idx on plataforma.canais (workspace_id, estado);

drop trigger if exists canais_atualizado_em on plataforma.canais;
create trigger canais_atualizado_em before update on plataforma.canais
  for each row execute function plataforma.crm_toque_atualizado_em();

create table if not exists plataforma.conversas (
  id                  text        not null default gen_random_uuid()::text,
  workspace_id        text        not null,
  canal_id            text        not null,
  contato_id          text        not null,
  titulo              text        not null,
  titulo_editado      boolean     not null default false,
  situacao            text        not null default 'aberta',
  estado              text        not null default 'ativo',
  fila_id             text,
  atribuido_tipo      text,
  atribuido_id        text,
  adiada_ate          timestamptz,
  adiamento_motivo    text,
  participantes       jsonb       not null default '[]'::jsonb,
  resolvida_em        timestamptz,
  reaberta_em         timestamptz,
  reaberturas         integer     not null default 0,
  criado_por_tipo     text        not null,
  criado_por_id       text        not null,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),
  primary key (workspace_id, id),
  foreign key (workspace_id, canal_id) references plataforma.canais (workspace_id, id),
  foreign key (workspace_id, contato_id) references plataforma.contatos (workspace_id, id),
  -- Habilita a FK composta (conversa, canal) da Mensagem: o banco garante que a
  -- Mensagem esta no mesmo Canal da Conversa.
  constraint conversas_canal_id_uq unique (workspace_id, id, canal_id),
  constraint conversas_titulo_ck check (length(btrim(titulo)) > 0),
  constraint conversas_situacao_ck check (situacao in ('aberta', 'pendente', 'resolvida')),
  constraint conversas_estado_ck check (estado in ('ativo', 'na_lixeira')),
  constraint conversas_participantes_ck check (jsonb_typeof(participantes) = 'array'),
  constraint conversas_atribuido_ck check (
    (atribuido_tipo is null) = (atribuido_id is null)
    and (atribuido_tipo is null or atribuido_tipo in ('membro', 'agente'))),
  -- INV-CXE-11: Adiamento so em Conversa pendente.
  constraint conversas_adiamento_ck check (adiada_ate is null or situacao = 'pendente'),
  -- INV-CXE-13: Conversa na lixeira nao esta aberta nem pendente.
  constraint conversas_lixeira_ck check (estado <> 'na_lixeira' or situacao = 'resolvida'),
  constraint conversas_reaberturas_ck check (reaberturas >= 0)
);

-- INV-CXE-03: no maximo uma Conversa aberta/pendente por (Contato, Canal).
create unique index if not exists conversas_nao_resolvida_uq
  on plataforma.conversas (workspace_id, contato_id, canal_id)
  where situacao in ('aberta', 'pendente') and estado = 'ativo';
create index if not exists conversas_canal_idx on plataforma.conversas (workspace_id, canal_id);
create index if not exists conversas_contato_idx on plataforma.conversas (workspace_id, contato_id);
create index if not exists conversas_situacao_idx on plataforma.conversas (workspace_id, situacao, estado);

drop trigger if exists conversas_atualizado_em on plataforma.conversas;
create trigger conversas_atualizado_em before update on plataforma.conversas
  for each row execute function plataforma.crm_toque_atualizado_em();

-- Mensagem: imutavel depois de gravada, salvo marcacao de exclusao e status de
-- entrega (RN-CXE-16) — por isso nao ha `atualizado_em`. `canal_id` repete o da
-- Conversa: e a chave de INV-CXE-08 e a FK composta garante que nao diverge.
-- `carga_bruta` contem dado pessoal: a anonimizacao do Contato precisa zera-la.
create table if not exists plataforma.mensagens (
  id                       text        not null default gen_random_uuid()::text,
  workspace_id             text        not null,
  conversa_id              text        not null,
  canal_id                 text        not null,
  seq                      bigint      generated always as identity,
  direcao                  text        not null,
  ator_tipo                text        not null,
  ator_id                  text        not null,
  delegante_tipo           text,
  delegante_id             text,
  remetente_participante_id text,
  identificador_id         text,
  remetente_externo        text,
  conteudo                 text,
  anexos                   jsonb       not null default '[]'::jsonb,
  assunto                  text,
  enderecos_adicionais     jsonb       not null default '[]'::jsonb,
  em_resposta_a_id         text,
  modelo_usado             jsonb,
  id_externo               text,
  status_entrega           text,
  status_entrega_em        timestamptz,
  motivo_falha             text,
  leituras_internas        jsonb       not null default '[]'::jsonb,
  reacoes                  jsonb       not null default '[]'::jsonb,
  marcacao_exclusao        jsonb,
  edicoes_externas         jsonb       not null default '[]'::jsonb,
  anonimizada              boolean     not null default false,
  carga_bruta              jsonb,
  criado_em                timestamptz not null default now(),
  registrado_em            timestamptz not null default now(),
  primary key (workspace_id, id),
  foreign key (workspace_id, conversa_id, canal_id)
    references plataforma.conversas (workspace_id, id, canal_id) on delete cascade,
  -- Habilita a FK composta de "em resposta a" (INV-CXE-10: mesma Conversa).
  constraint mensagens_conversa_id_uq unique (workspace_id, conversa_id, id),
  foreign key (workspace_id, conversa_id, em_resposta_a_id)
    references plataforma.mensagens (workspace_id, conversa_id, id),
  constraint mensagens_direcao_ck check (direcao in ('recebida', 'enviada', 'interna')),
  constraint mensagens_ator_ck check (ator_tipo in ('member', 'agent', 'automation', 'integration', 'system')),
  constraint mensagens_delegante_ck check ((delegante_tipo is null) = (delegante_id is null)),
  constraint mensagens_anexos_ck check (jsonb_typeof(anexos) = 'array'),
  constraint mensagens_enderecos_ck check (jsonb_typeof(enderecos_adicionais) = 'array'),
  constraint mensagens_leituras_ck check (jsonb_typeof(leituras_internas) = 'array'),
  constraint mensagens_reacoes_ck check (jsonb_typeof(reacoes) = 'array'),
  constraint mensagens_edicoes_ck check (jsonb_typeof(edicoes_externas) = 'array'),
  constraint mensagens_status_ck check (status_entrega is null or status_entrega in
    ('pendente', 'enviada', 'entregue', 'lida', 'falhou')),
  -- INV-CXE-09: toda `enviada` tem exatamente um status; `recebida` e `interna` nao tem.
  constraint mensagens_status_direcao_ck check ((direcao = 'enviada') = (status_entrega is not null)),
  constraint mensagens_motivo_falha_ck check (motivo_falha is null or status_entrega = 'falhou'),
  -- 7.6: id externo obrigatorio em `recebida`, ausente em `interna`.
  constraint mensagens_id_externo_ck check (
    (direcao <> 'recebida' or id_externo is not null) and (direcao <> 'interna' or id_externo is null)),
  -- INV-CXE-07: conteudo ou anexo, salvo anonimizada ou com marcacao de exclusao.
  constraint mensagens_conteudo_ck check (
    anonimizada or marcacao_exclusao is not null
    or length(btrim(coalesce(conteudo, ''))) > 0 or jsonb_array_length(anexos) > 0)
);

-- INV-CXE-08: dentro de um Canal, nao ha duas Mensagens com o mesmo identificador externo.
create unique index if not exists mensagens_id_externo_uq
  on plataforma.mensagens (workspace_id, canal_id, id_externo) where id_externo is not null;
create index if not exists mensagens_conversa_idx
  on plataforma.mensagens (workspace_id, conversa_id, criado_em, seq);
```
**Provas executadas** (`psql` num container `postgres:16`, `ws1`/`ws2`): dois WhatsApps (cloud + não oficial, números distintos) **passam**; mesmo número em não oficial **barrado** (`canais_conta_uq`); nome `"  comercial "` **barrado** (`canais_nome_uq`); `email` com `whatsapp-cloud` **barrado** (`canais_provedor_tipo_ck`); `conexao_simulada` com `desconectada` **barrado** (`canais_simulada_ck`); arquivar conectada **barrado** (`canais_arquivado_desconectado_ck`), arquivar desconectando **passa**, e o mesmo número em Canal novo depois de arquivar **passa**; Conversa em Canal de outro workspace **barrada** (FK composta); 2ª Conversa aberta do par **barrada** (`conversas_nao_resolvida_uq`), mesma pessoa em **outro Canal do mesmo tipo passa** (ontologia 20.6); Mensagem com `canal_id` diferente do da Conversa **barrada**; id externo repetido no mesmo Canal **barrado**, em outro Canal **passa**; `recebida` sem id externo, `enviada` sem status, `recebida` com status e Mensagem vazia **barradas**; `em resposta a` de outra Conversa **barrado**, da mesma **passa**; apagar Canal ou Contato com Conversa **barrado** (restrict); apagar Conversa **leva as Mensagens** (inclusive com `em resposta a`); trigger de `atualizado_em` funciona. [VERIFIED: execução nesta sessão; script em `.../scratchpad/prova-008.sql`]
**Decisões de coluna além da lista literal de D-10 (Claude's Discretion, `[ASSUMED]` A6):** `seq` (desempate de ordem), `leituras_internas` (o modelo antigo tem `internalReads` e a Caixa conta "não lidas" por ele), `registrado_em`, `conexao_simulada`/`conectada_em` no Canal (necessárias para D-08: "a tela marca visivelmente que a conexão é simulada"). Fora de propósito: credenciais, Mensagens de modelo, Grupos, `proveniencia`, `flow/respostaDeFlow`.

### 2. Valores discretos lidos no código (citação verbatim — fonte para tipos e `satisfies`)
```text
packages/dominio/src/types/crm.ts:329-339   export type ChannelType = | "whatsapp" | "instagram" | "linkedin" | "email" | "chatDoSite";
packages/dominio/src/types/crm.ts:379-392   lifecycle: "ativo" | "arquivado";  ...  connection: "conectada" | "desconectada" | "comErro";
packages/dominio/src/types/crm.ts:413-417   export type ConversationState = "aberta" | "pendente" | "resolvida";
                                            export type MessageDirection = "recebida" | "enviada" | "interna";
                                            export type MessageDeliveryStatus = "pendente" | "enviada" | "entregue" | "lida" | "falhou";
packages/dominio/src/types/primitives.ts:36 export type ActorKind = "member" | "agent" | "automation" | "integration" | "system";
packages/dominio/src/operations/canais.ts:37 export const TIPOS_DE_ATENDIMENTO = ["whatsapp", "email", "instagram", "linkedin"] as const;
packages/dominio/src/crm/permissoes.ts:27   export type RecursoCrm = "contato" | "empresa" | "funil" | "negocio";
apps/api/migracoes/007-crm.sql:113          constraint contato_identificadores_tipo_ck check (tipo in ('telefone', 'email', 'whatsapp', 'instagram')),
apps/api/migracoes/007-crm.sql:32           create or replace function plataforma.crm_toque_atualizado_em() returns trigger
apps/api/src/app.ts:168                     methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
```
`Conversation.lifecycle` é `"ativo" | "naLixeira"` no modelo antigo (`crm.ts:491`); a coluna `conversas.estado` usa `'na_lixeira'` (snake_case, como `contatos_estado_ck`).

### 3. Esquema zod do `POST /canais` (molde de `rotas/crm/funis.ts`)
```typescript
// rotas/crm/canais.ts (esboço) — sem tipo/conexao/estado/configuradoPor no corpo
const NOVO_CANAL = z
  .object({
    provedor: z.enum(PROVEDORES_DE_CANAL),
    nome: TEXTO_CURTO.min(1),
    identificador: TEXTO_CURTO.min(1),
    filaPadraoId: z.string().min(1).max(64).optional(),
    origemPadraoId: z.string().min(1).max(64).optional(),
  })
  .strict();
rotas.post("/canais", { schema: { body: NOVO_CANAL } }, async (request, reply) =>
  responder(reply, await servico.criar(request.membro, request.body), 201),
);
```
No serviço: `exigir(acesso, membro, "criar", "canal")` → `validarNovoCanal` (400 `VALOR_INVALIDO` com `campo`) → Fila/Origem existem e estão `ativo` em `registros` (colecoes `queues` e `catalog` com `kind: "origem"`, como `filaValida`/`origemValida` em `operations/canais.ts:163-173`) → insert; `23505` em `canais_nome_uq`/`canais_conta_uq` → `FRASES` (`CANAL_NOME_EM_USO`, `CANAL_CONTA_EM_USO`), devolvendo o Canal detentor (ontologia 12.2) quando possível. **Guarda entre acervos (recomendada, A5):** antes de inserir, conferir se um Canal **antigo** ativo (`registros`, `colecao='channels'`) já usa o mesmo nome ou (tipo, identificador) — sem isso, "Comercial SP" do seed e um relacional homônimo convivem em `state.channels`.

### 4. Projeção dentro de `executar` (esboço)
```typescript
// unidade-de-trabalho.ts, no laço de tentativas, logo depois de `hidratar` (linha ~128)
const antes = await hidratar(cliente, workspaceId);
const projetados = await carregarCanaisProjetados(cliente, workspaceId);   // guarda to_regclass dentro
const idsProjetados = new Set(projetados.map((c) => c.id));
const jsonAntes = new Map(projetados.map((c) => [c.id, canonico(c)]));
acrescentarCanaisProjetados(antes.state, projetados);
// … syncIdSequence, operação pura, rollback se !ok …
retirarCanaisProjetados(antes.state, idsProjetados, jsonAntes);            // lança se a operação alterou um projetado
const diferenca = await gravar(cliente, workspaceId, antes.state, antes);  // linha ~173
```
`rotas/estado.ts`: `acrescentarCanaisProjetados` após `hidratar` e **não** retira (o corpo precisa dos Canais).

### 5. Teste de rota com serviço falso (molde `rotas/crm/funis.test.ts:1-60`)
`buildApp({ logger:false, workspaceId, verificarToken, resolverMembro, crm: { canais: servicoFalso, acesso: acessoFalso } })` + `app.inject`. Casos obrigatórios: 401 sem token; 400 por campo proibido (`conexao`, `tipo`, `workspaceId`); `DELETE`/ações sem corpo sem `content-type`; 403 para `membro` em `POST /canais`; 404 de Canal de outro Espaço; 409 com `codigo`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Canal nasce `conectada` (protótipo simula o provedor, C36) | Nasce `desconectada`; conecta em dois atos; "Simular conexão" marca `conexao_simulada` | Fase 8 (D-08) | `criarCanal` antigo e os 2 popups de Lista **não** mudam (Open Question 1) |
| Capacidade só do `ChannelType` | `capacidadesDoCanal(canal)` por (tipo, provedor) | Fase 8 (D-02) | ~10 sítios migram |
| Abas do fio por tipo | Abas por Canal; "Responder por" | Fase 8 (D-14/15) | reescrita contida de `conversation-thread.tsx` |
| Canal/Conversa/Mensagem só em `plataforma.registros` (jsonb) | Tabelas próprias (008) + projeção de Canal no estado antigo | Fase 8 (D-09/11) | dois acervos até a unificação |
| `params` síncrono | `params: Promise<…>` + `use(params)` | Next 15/16 | páginas novas seguem o padrão já usado nas fichas |

**Deprecated/outdated (nesta fase):** nada é removido; seed e modelo inglês convivem (D-12).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Os quatro slugs de provedor de D-01 (`whatsapp-cloud`, `whatsapp-nao-oficial`, `instagram-graph`, `email-imap-smtp`) são os nomes definitivos (viram `CHECK`, REST e URL) | Pattern 1, Code Ex. 1 | Renomear depois = `009` + REST + URL (D-01 "costly") |
| A2 | Aceitável que o mesmo número não seja conectável em oficial e não oficial ao mesmo tempo (INV-CXE-01 por tipo) | Pitfall 12 | Se o dono quiser o mesmo número nos dois, o índice `canais_conta_uq` precisa incluir `provedor` — contradiz a ontologia |
| A3 | `criarCanal` (op antiga) e os popups de Lista seguem nascendo `conectada` | Summary, Open Q 1 | Se o dono quiser tudo `desconectada`, os 2 popups viram redirecionamento para a nova página e `canais.test.ts:221-251` muda |
| A4 | As rotas de escrita de Canal incrementam `plataforma.workspaces.revisao` | Pattern 5 | Sem isso, outros navegadores só veem o Canal novo ao recarregar; com isso, 1 retry a mais em `executar` concorrente |
| A5 | Vale uma guarda de nome/(tipo, identificador) contra Canais antigos em `registros` | Code Ex. 3 | Custo: 1 consulta; sem ela, homônimos em `state.channels` |
| A6 | Colunas além de D-10: `seq`, `leituras_internas`, `registrado_em`, `conexao_simulada`, `conectada_em`, `grupos_habilitados`, `proprietario_padrao_id` | Code Ex. 1 | Excesso inofensivo (nullable/default); falta de `conexao_simulada` impossibilitaria D-08 |
| A7 | Matriz de permissão: `administrador`/`proprietario` escrevem Canal; `membro` cria Conversa e envia Mensagem; `convidado` só lê | Pattern 3 | O dono pode querer restringir envio por Fila (escopo `próprios` segue adiado, como na Fase 7 D-10) |
| A8 | Container de teste por plano: `crm-n1-pg-08NN`, porta `555NN` (extensão da convenção `554NN` da Fase 7) | Validation | Só convenção; qualquer porta livre serve |
| A9 | A anonimização de Contato (fase futura) deve zerar `carga_bruta`; listagens não devolvem `carga_bruta` | Pattern 4 | Risco LGPD se esquecido; ontologia 12.5 manda anonimizar Mensagens |
| A10 | Overrides do WhatsApp não oficial limitam-se a janela e modelo (D-02); `sendableMediaTypes` (inclui `"flow"`), Grupos e Flows não mudam | Pitfall 5, Open Q 4 | WhatsApp Flows existem só na Cloud API (conhecimento de treino, não verificado aqui): a lista de Flows mostraria o não oficial |

## Open Questions

1. **`criarCanal` (op antiga) e os dois popups de Lista**
   - What we know: `AdicionarCanalDialog` é usado por `estrutura/create-container-dialog.tsx:446` e `estrutura/container-settings.tsx:410`, chama `criarCanal` (`canais.ts:192`), que nasce `conectada` (`:228`) e devolve o Canal para marcá-lo na Lista. O Phase Boundary diz "passa a nascer `desconectada`… em vez de nascer `conectada` como hoje"; D-08 diz "C36 deixa de valer para Canais criados pela **página nova**".
   - What's unclear: se o popup antigo também muda. Se mudar, o Canal criado ali nasce desconectado, a Lista o aceita (`validarCanaisDeAtendimento` não olha conexão, `canais.ts:132-146`), mas abrir conversa é recusado por `tarefas-conversacionais.ts:177,270`.
   - Recommendation: **não mexer** em `criarCanal` nem nos popups (A3); documentar no `CONTEXT.md` que são o caminho legado; `provider` opcional no tipo. Confirmar com o dono antes de planejar.

2. **D-13 (separador "via …") sem host depois de D-14**
   - What we know: cada aba é a Conversa de **um** Canal; `Message` não tem `channelId` (só via `Conversation.channelId`); não existe linha do tempo mista (grep de `flatMap(… messages)` só acha `conversation-thread.tsx:342`, que calcula a aba mais recente).
   - What's unclear: onde o separador aparece. Implementá-lo sem host é código morto.
   - Recommendation: implementar a derivação pura `marcadoresDeCanal(mensagens com canal)` + componente e cobri-lo por teste, **sem** criar visão mista nova; perguntar ao dono se quer uma aba "Todas as Conversas" (escopo novo, não decidido). O requisito CXE-W2 cobre o cabeçalho com Canal+selo (que existe).

3. **Mesmo número em oficial e não oficial** — ver Pitfall 12/A2. Recomendação: manter INV-CXE-01; o teste usa números distintos.

4. **Efeito colateral de dois WhatsApps nas Ferramentas** — `aba-flows/aba-grupos/aba-comunidades/criar-*-dialog/flow-popup/grupo-popup` filtram `channelType === "whatsapp"`; `ferramentas/automacoes.ts:105` pega o primeiro WhatsApp ativo. Com o não oficial, aparecerá em Flows (que só existem no oficial) e a automação "enviar ao contato" pode escolher qualquer um. Recomendação: fora de escopo (D-02 só fala de janela/modelo), mas registrar no `CONTEXT.md` e, no mínimo, fazer `mensagem.enviarAoContato` preferir `spec.channelId`; perguntar se quer filtrar Flows por `whatsapp-cloud`.

5. **Revisão do Espaço nas escritas REST de Canal** — ver A4.

6. **Aplicar a 008 no banco da plataforma nesta fase** — CONTEXT recomenda aplicar com UAT `[BLOCKING]`. A 008 tem de existir **antes** de o código da projeção rodar contra aquele banco (Pitfall 1). Recomendação: um plano dedicado no meio da fase (depois de repositórios/serviços/rotas, antes da ponte), com o mesmo ritual de 07-13 (`--seco` pelo dono → `migrar` → `--seco`).

7. **Guarda de produção para "Simular conexão"** (Pitfall 13) — confirmar com o dono que a simulação pode existir no Espaço de produção ("Gestão") ou só em demo; `conexao_simulada` já permite desligar por provedor depois.

8. **`/gsd-ui-phase 8`** — `config.ui_phase` é `true`; há duas páginas novas, o redesenho do fio e dois selos novos. Um `08-UI-SPEC.md` (como o da Fase 7) antes do plano reduz retrabalho no `conversation-thread.tsx`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | tudo | ✓ | v24.14.0 | — |
| npm | workspaces | ✓ | 11.9.0 | — |
| Docker | Postgres descartável (testes de repositório/serviço/e2e) | ✓ | 29.3.1; imagem `postgres:16` local | usar Postgres local já instalado |
| psql | inspeção/provas de SQL | ✓ | 18.3 | `docker exec … psql` |
| Postgres local em :5432 | — | ✗ (não necessário) | — | `docker run -d --rm --name crm-n1-pg-08NN -e POSTGRES_PASSWORD=x -p 555NN:5432 postgres:16` — **provado nesta sessão**: `DATABASE_URL=postgres://postgres:x@localhost:55480/postgres npx vite-node src/persistencia/migrar.cli.ts` aplicou `001`…`007` |
| `DATABASE_URL` remoto (`apps/api/.env`) | testes antigos que usam `Boolean(DATABASE_URL)` | não inspecionado | — | ver Pitfall 1 |
| Supabase/JWT | UAT no navegador | depende do `.env` do web | — | testes injetam `verificarToken`/`resolverMembro` |

**Missing dependencies with no fallback:** nenhuma.
**Missing dependencies with fallback:** Postgres local → container Docker (provado).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 5.0.0 nos 3 workspaces [VERIFIED: package.json] |
| Config file | `packages/dominio/vitest.config.mts` (node), `apps/api/vitest.config.mts` (node, `fileParallelism: false`, timeouts 180 s), `apps/web/vitest.config.mts` (node; `// @vitest-environment jsdom` por arquivo `.tsx`) |
| Quick run command | `cd packages/dominio && npx vitest run src/crm` · `cd apps/api && DATABASE_URL=postgres://postgres:x@localhost:555NN/postgres npx vitest run src/rotas/crm/canais.test.ts` · `cd apps/web && npx vitest run src/dados/crm src/features/crm` |
| Full suite command | `npm run check` (typecheck + lint + verificar:tokens + verificar:contratos + test, 3 workspaces) |

`npm run test -w @n1/api` completo leva ~554 s (série); rodar só os arquivos tocados por tarefa. Baseline conhecido: o portão tinha **2 falhas pré-existentes fora do CRM** (`e2e/lote-contas-a-pagar.test.ts`, `rotas/formularios-publicos.test.ts`) — `deferred-items.md` da Fase 7; não são desta fase. [VERIFIED: `07-.../deferred-items.md`]

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CXE-D1 | `PROVEDORES` (provedor→tipo coerente), `validarNovoCanal` (identificador canônico por provedor, nome), `proximaConexao` (desconectada→conectada, simulada, desconectar), `rotuloDoCanal`, `validarEnvio` (janela 24h oficial × livre não oficial), `canaisQueAlcancam`/`canalPadraoDeResposta`, `podeNoCrm` com `canal/conversa/mensagem` | unit (puro) | `cd packages/dominio && npx vitest run src/crm/canais.test.ts src/crm/conversas.test.ts src/crm/mensagens.test.ts src/crm/permissoes.test.ts src/derive-conversacional` | ❌ Wave 0 (`permissoes.test.ts` ✅ estender) |
| CXE-D2 | `capacidadesDoCanal`: oficial = 24h + modelo; não oficial = sem janela, sem modelo; Canal sem `provider` = comportamento atual; `sendMessage`/`responseWindowOpenUntil` por Canal; suíte atual de conversas segue verde | unit | `cd packages/dominio && npx vitest run src/operations/operations.test.ts src/operations/canais.test.ts src/derive-resumo.test.ts` + novo teste | ❌ novo teste; ✅ suítes |
| CXE-A1 | 008 aplica sobre 001..007 sem erro, 2ª vez sem erro; 17 invariantes (dois WhatsApps; INV-CXE-01/03/04/08/09/10; cascata) | integração SQL | `cd apps/api && DATABASE_URL=…555NN… npx vitest run src/repositorios/crm/canais-008.test.ts src/persistencia/migrar-seco.test.ts` | ❌ Wave 0 (`migrar-seco.test.ts` ✅ conferir que lista a 008 como pendente) |
| CXE-A2 | 401 sem token; 403 Membro/Convidado escreve Canal; 404 de outro Espaço; 400 campo proibido; 409 nome/conta em uso; `POST /conversas` atômico (Conversa+1ª Mensagem) e 409 `CONVERSA_JA_ABERTA`; `POST /mensagens` status por conexão | route (`app.inject`, serviço falso) + integração (serviço real) | `cd apps/api && DATABASE_URL=… npx vitest run src/rotas/crm/canais.test.ts src/rotas/crm/conversas.test.ts src/rotas/crm/mensagens.test.ts src/servicos/crm` | ❌ Wave 0 |
| CXE-A2 | Contato com Conversa: `DELETE …/permanente` → 409 (não 500) | integração | `cd apps/api && DATABASE_URL=… npx vitest run src/servicos/crm/contatos.test.ts` | ✅ estender |
| CXE-A3 | `registrarRecebida` idempotente por (Canal, id externo); mesmo id em outro Canal grava; `carga_bruta` preservada e ausente das listagens; `interna` sem id externo | integração | `cd apps/api && DATABASE_URL=… npx vitest run src/repositorios/crm/mensagens.test.ts src/servicos/crm/mensagens.test.ts` | ❌ Wave 0 |
| CXE-A4 | `GET /estado` inclui Canal relacional com `provider/relational`; sem 008 (banco 001..007) ainda 200; operação do domínio (`startConversation`) num Canal relacional grava a Conversa e **não** cria `colecao='channels'` em `registros`; operação que altera Canal projetado é recusada; `notificar-canal.contrato.test.ts` segue verde | integração | `cd apps/api && DATABASE_URL=… npx vitest run src/persistencia/canais-projetados.test.ts src/rotas/estado.test.ts src/persistencia/unidade-de-trabalho.test.ts src/contratos/notificar-canal.contrato.test.ts` | ❌ Wave 0 (demais ✅) |
| CXE-W1 | cliente HTTP (`/canais`; sem `content-type` em ação sem corpo; 409 → `ErroDeApi`); página de escolha (4 cartões, link por provedor); `[provedor]` inválido → `notFound`; formulário pré-valida e chama a rota certa; "Simular conexão" só para administrador; marca "simulada"; `rotas.test.ts` com as rotas novas | unit + componente (jsdom, `fetch` falso, `SWRConfig provider: () => new Map()`) | `cd apps/web && npx vitest run src/dados/crm/canais.test.ts src/features/crm/conectar-canal src/features/shell/rotas.test.ts` | ❌ Wave 0 (`rotas.test.ts` ✅ estender) |
| CXE-W2 | abas por Canal (2 WhatsApps ⇒ 2 abas, rótulos com selo); aba desabilitada sem Identificador; "Responder por" padrão = Canal da última recebida e só `conectada`; trocar abre/reutiliza Conversa e não muda `channelId`; item da lista com ícone+nome; filtro `?canal=` com selo | componente (jsdom) + unit puro | `cd apps/web && npx vitest run src/features/crm/conversation-thread.test.tsx src/features/crm/inbox-columns.test.tsx` | ❌ Wave 0 (nenhum dos dois existe) |
| CXE-V1 | cenário e2e "Comercial (oficial) e Suporte (não oficial) lado a lado, mesmo Contato, uma Conversa em cada" por `app.inject` sobre `buildApp()` real; isolamento de Espaço; `npm run check` e `npm run build` | e2e + portão | `cd apps/api && DATABASE_URL=… npx vitest run src/e2e/canais-fluxo.test.ts` · `npm run check` · `npm run build` | ❌ Wave 0 |
| CXE-V1/A1 | `--seco` antes (1 pendente: `008`), aplicação pelo dono, `--seco` depois (0 pendentes); UAT no navegador | manual (dono) | `npm run migrar -w @n1/api -- --seco` (dono) | ❌ UAT (`08-PROVAS.md`) |

### Sampling Rate
- **Por commit de tarefa:** o `-- <filtro>` do workspace tocado + `npm run typecheck -w <ws>`.
- **Por merge de onda:** `npm run typecheck && npm run test -w @n1/dominio && npm run test -w @n1/web` + arquivos de Canal do api contra o container da onda.
- **Gate da fase:** `npm run check` (+ `npm run build`) verde antes de `/gsd-verify-work`, com as 2 falhas pré-existentes explicitadas.

### Wave 0 Gaps
- [ ] `packages/dominio/src/crm/{canais,conversas,mensagens}.test.ts` e estender `permissoes.test.ts`.
- [ ] Teste novo de `capacidadesDoCanal` e de `responseWindowOpenUntil` (hoje sem teste).
- [ ] `apps/api/src/testes/banco-crm.ts`: `limparEspaco` deve apagar `mensagens`, `conversas`, `canais` **antes** de `contatos` (Pitfall 2) e, se preciso, `semearCanal`/`semearConversa` helpers.
- [ ] Fakes em memória dos serviços de Canal/Conversa/Mensagem para `buildApp({ crm })` (sem banco).
- [ ] `apps/web`: `conversation-thread.test.tsx` e `inbox-columns.test.tsx` (não existem); helper de store com 2 WhatsApps; `fetch` falso e `SWRConfig` isolado.
- [ ] Container por plano: `docker run -d --rm --name crm-n1-pg-08NN -e POSTGRES_PASSWORD=x -p 555NN:5432 postgres:16`.

## Security Domain

`security_enforcement` habilitado (ASVS nível 1, `security_block_on: high` em `.planning/config.json`).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | herdado | JWT Supabase no hook `onRequest`; rotas novas **não** se marcam `publica` |
| V3 Session Management | herdado | token de `getSession()` no cliente; sem cookie próprio |
| V4 Access Control | **sim (núcleo)** | `workspaceId` só de `request.membro`; `podeNoCrm` (Canal só administração); 404 (não 403) para id de outro Espaço; FKs compostas como 2ª barreira; teste IDOR |
| V5 Input Validation | **sim** | zod `.strict()` em params/query/body; `provedor` enum; identificador canônico; limites de tamanho; `limite ≤ 200` |
| V6 Cryptography | não nesta fase | **sem credenciais**: nenhuma coluna guarda token/segredo (entram com o provedor real, decisão própria) |
| V7 Error handling/logging | sim | 500 genérico; `FRASES` sem nome de constraint (T-07-06); nunca logar corpo de Mensagem nem `carga_bruta` |
| V8 Data protection | sim | `carga_bruta` e `conteudo` são dado pessoal: fora das listagens; anonimização futura zera `carga_bruta` (A9) |

### Known Threat Patterns for Fastify + pg + Next client
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR entre Espaços (Canal/Conversa/Mensagem de outro `workspace_id`) | Information disclosure | `WHERE workspace_id = $1 AND id = $2` em toda consulta; FKs compostas; teste "Membro do WS A não lê/edita recurso do WS B" |
| Mass assignment (`tipo`, `conexao`, `estado`, `conexaoSimulada`, `configuradoPor`, `direcao: recebida`) | Tampering | corpos `.strict()` próprios por rota; `recebida` não existe em `POST /mensagens` |
| Escalada por Papel (Membro/Convidado cria ou simula Canal) | Elevation of privilege | `exigir(…,"canal")` no serviço antes da transação; teste por Papel; UI só esconde |
| Forjar mensagem "recebida" pela API humana | Spoofing/Repudiation | sem rota humana de `recebida`; só `registrarRecebida` interno (webhook autenticado por credencial de serviço, fase futura) |
| Injeção de SQL (ordenação/filtro dinâmicos) | Tampering | `$n` sempre; `ORDER BY` fixo; `ILIKE` com `escaparIlike` (`repositorios/crm/sql.ts`) |
| JSONB abusivo (`carga_bruta`, `anexos`, `participantes`) | DoS | `bodyLimit` do Fastify; schemas com tetos; `carga_bruta` só pelo caminho interno |
| XSS por conteúdo de Mensagem | Tampering | React escapa; nunca `dangerouslySetInnerHTML` com `conteudo`/`assunto` |
| "Simular conexão" usada para fingir entrega | Repudiation | marcador visível (D-08), só administração, `conexao_simulada` auditável |
| Vazamento de erro do Postgres (nome de constraint) | Information disclosure | traduzir SQLSTATE conhecido em frase pt-BR; desconhecido → 500 genérico |

## Sources

### Primary (HIGH confidence) — código e docs lidos nesta sessão
- `08-CONTEXT.md` (todo); `07-RESEARCH.md`, `07-PATTERNS.md` (início), `07-VALIDATION.md`, `07-13-SUMMARY.md`, `deferred-items.md`; `CLAUDE.md`/`CONTEXT.md`/`AGENTS.md`.
- `apps/api/migracoes/001-plataforma.sql`, `004-…`, `006-…`, `007-crm.sql` (inteiro); `apps/api/src/persistencia/{CONTEXT.md,repositorio.ts,unidade-de-trabalho.ts,eventos-de-canal.ts,migrar.ts,migrar.cli.ts}`; `rotas/{CONTEXT.md,estado.ts,estado.test.ts}`, `rotas/crm/{comum,index,funis}.ts`, `rotas/crm/funis.test.ts`, `rotas/esquemas/canais.ts` e `.test.ts`; `servicos/crm/{acesso,transacao,resultado}.ts`, `servicos/crm/contatos.ts` (FRASES/excluir), `servicos/crm/funis.ts` (início); `repositorios/{CONTEXT.md,crm/membros.ts,crm/sql.ts,crm/funis.ts}`; `testes/banco-crm.ts`; `e2e/crm-fluxo.test.ts` (início); `app.ts` (CORS).
- `packages/dominio/src/types/{crm.ts,primitives.ts}`, `operations/{canais.ts,canais.test.ts,conversations.ts,activity.ts}`, `crm/{permissoes.ts,comum.ts}`, `derive.ts`, `diferenca.ts`, `colecoes.ts`, `seed.ts` (canais), `operations/automations.ts` (`pedidosDeNotificacaoPorCanal`), `operations/ferramentas/{automacoes,participacoes}.ts`, `package.json`.
- `apps/web/src/dados/{transporte.ts,store.ts}`, `dados/crm/{cliente-crm,funis,sessao}.ts`, `app/(shell)/crm/caixa-de-entrada/{[conversa]/page.tsx,configuracoes/page.tsx,configuracoes/canais/[canal]/page.tsx}`, `features/crm/{adicionar-canal-dialog,conversation-thread,inbox-columns,contact-card}.tsx`, `features/shell/{rotas.ts,rotas.test.ts}`, `design/basicos.tsx` (`Pilula`), `estilos/componentes.css`.
- `ontologia/03-crm/caixa-de-entrada-e-mensageria.md` §7.1, 7.2, 7.5, 7.6, 7.7, 11.1, 11.4, 12.2, 12.4–12.6, 14, 20.6, 20.20; `ontologia/DECISOES-E-PENDENCIAS.md` C36.
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md` e `04-functions/not-found.md`.
- Experimentos: container `postgres:16` — `migrar` real aplicou `001..007`; 008 proposta aplicada duas vezes e provada com 17 cenários (script `prova-008.sql`); cascata com auto-referência; container removido ao final.

### Secondary (MEDIUM confidence)
- `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md` (formato dos IDs derivados da Fase 7: `CRM-D1…CRM-V1`).

### Tertiary (LOW confidence)
- Itens `[ASSUMED]` do Assumptions Log (A1–A10), em particular o comportamento real dos provedores (WhatsApp Flows só na Cloud API) e o que "Chatwoot/Blip/Zenvia" fazem (citado em CONTEXT `<specifics>`; não verificado).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — tudo já no repo; nenhum pacote novo.
- Architecture: HIGH nas camadas, na ponte e na 008 (lidas e provadas); MEDIUM no contrato REST exato (Claude's Discretion).
- Pitfalls: HIGH — 1, 2, 3, 4, 5, 10, 11, 12 por leitura direta + prova em banco; 6–9, 13 por leitura do código.

**Research date:** 2026-10-12
**Valid until:** 2026-11-11 (30 dias; reavaliar se a 007/008 mudarem, se `conversation-thread.tsx` for refatorado antes, ou se Next/Fastify subirem de major)
