# Phase 8: Canais de comunicação: conexão e omnichannel preparado - Context

**Gathered:** 2026-10-12
**Status:** Ready for planning

<domain>
## Phase Boundary

O campo preparado para o omnichannel, **sem integrar nenhum provedor de verdade**. Três camadas, começando pelo domínio:

1. **Domínio (`@n1/dominio`)** — o Canal ganha o **provedor** (WhatsApp oficial × não oficial, Instagram, E-mail) e passa a nascer `desconectada`, conectando em dois atos (ontologia 12.2), em vez de nascer `conectada` como hoje (C36). As Capacidades continuam do Tipo de Canal e passam a ser consultadas por (tipo, provedor) onde o provedor difere.
2. **Backend (`apps/api`)** — migração `008` com tabelas próprias de **Canal, Conversa e Mensagem** no padrão da `007` (uma tabela por entidade, `workspace_id` em tudo, FKs compostas), a Conversa apontando para o Contato relacional da `007`; rotas REST por recurso (`/canais`, `/conversas`, `/mensagens`) com isolamento por Espaço e permissão por Papel no backend. A Mensagem recebida guarda o modelo da ontologia 7.6 mais a carga bruta do provedor, para renderizar e reprocessar quando a integração chegar.
3. **Interface (`apps/web`)** — a página onde o Administrador **escolhe qual Canal conectar** (cartões por provedor) e, para cada provedor, a **página de orientação** de como conectar (passo a passo genérico + espaço reservado para QR/token + formulário real), que cria o Canal `desconectada` por REST e oferece "Simular conexão". O Espaço pode ter vários Canais, inclusive dois WhatsApps (um oficial, um não oficial). No chat, a Caixa de Entrada e o fio da Conversa mostram **por qual Canal** a Mensagem chegou e quem responde **escolhe por qual Canal** responde — hoje a aba é por TIPO, o que não distingue dois WhatsApps.

**Fora do escopo:** conectar provedor real (Cloud API da Meta, Evolution/Baileys, Graph do Instagram, IMAP/SMTP), webhook de entrada real, envio real; religar a Caixa de Entrada inteira ao REST (fica para a fase de unificação — D-11); Fila e Participante com tabela própria; Chat do site e LinkedIn como provedores conectáveis nesta fase (continuam só no modelo antigo); Grupos (documento 24).

</domain>

<decisions>
## Implementation Decisions

### Oficial × não oficial no modelo
- **D-01:** O WhatsApp não oficial **não** é um `ChannelType` novo. O Canal ganha um atributo **`provedor`** (ex.: `whatsapp-cloud`, `whatsapp-nao-oficial`, `instagram-graph`, `email-imap-smtp`); `channelType` continua `whatsapp` / `instagram` / `email`. Motivo: a ontologia (A2.4) diz que não há "Canal WhatsApp" como entidade própria, e as ~40 operações que leem `channelType` não precisam mudar. — **Reversibility:** costly — o provedor vira coluna na `008` e aparece no contrato REST; trocar para enum de tipo depois toca domínio, migração e telas.
- **D-02:** As **Capacidades continuam do Tipo** (RN-CXE-05), mas passam a ser consultadas por **(tipo, provedor)**: o provedor só sobrepõe o que difere. Concretamente, o WhatsApp **não oficial não tem janela de 24h nem exige modelo aprovado** — envio livre a qualquer hora. O oficial mantém janela de 24h e modelo fora dela.
- **D-03:** O **identificador externo** no mockup de conexão é o que a pessoa digita hoje: número com DDI para os dois WhatsApps (reaproveita `identificadorCanonico`), `@usuario` para Instagram, endereço para E-mail. O provedor real só confirma depois; IDs da Meta (Phone Number ID, WABA) **não** entram agora.
- **D-04:** Dois WhatsApps se distinguem por **nome livre + selo do provedor** ("Comercial" com selo "oficial"; "Suporte" com selo "não oficial") ao lado do ícone do tipo. Nome único entre Canais ativos já é regra (RN-CXE-31); o número não precisa aparecer em toda listagem.

### Jornada de conexão e mockup
- **D-05:** A página de escolha mora nas **Configurações da Caixa de Entrada**: botão "Conectar Canal" na seção Canais de `/crm/caixa-de-entrada/configuracoes`, abrindo `/crm/caixa-de-entrada/configuracoes/canais/conectar`. O Canal é contido pela Caixa (ontologia 7.2); `/configuracoes/integracoes` não ganha Canais nesta fase.
- **D-06:** A tela de escolha são **quatro cartões por provedor** — WhatsApp oficial, WhatsApp não oficial, Instagram, E-mail — cada um com ícone, uma frase sobre quando usar e o botão "Conectar". Reaproveita `grade-solta` / `item-solto`.
- **D-07:** A página de orientação de cada provedor (`/crm/caixa-de-entrada/configuracoes/canais/conectar/[provedor]`) mostra **passo a passo textual genérico** (oficial: conta Meta Business, número verificado, token; não oficial: QR code; Instagram: conta profissional vinculada; E-mail: IMAP/SMTP), um **espaço reservado** para o QR/token que a integração futura preenche, e o **formulário real**: nome, identificador, Fila padrão, Origem padrão (os mesmos campos do popup atual). É o mockup que será configurado por provedor depois — o layout fica, o conteúdo troca.
- **D-08:** Sem provedor, "Conectar" **cria o Canal `desconectada`** (ontologia 12.2). Um botão secundário **"Simular conexão"**, só para quem administra o Espaço, muda para `conectada` e deixa testar o chat; a tela marca visivelmente que a conexão é simulada. Nada nasce `conectada` por padrão — C36 deixa de valer para Canais criados pela página nova.

### Escopo da migração 008
- **D-09:** A `008` cria **Canal, Conversa e Mensagem** com tabela própria (`plataforma.canais`, `plataforma.conversas`, `plataforma.mensagens`), no padrão da `007`: `workspace_id` em tudo, PK `(workspace_id, id)`, FKs compostas, `criado_em`/`atualizado_em` com trigger. A Conversa aponta para o **Contato relacional da 007** (`plataforma.contatos`), e para o Canal, imutável (INV-CXE-04). **Fila e Participante não ganham tabela**: Fila fica como referência textual/coluna (`fila_id` sem FK, até a Fila existir relacional) e Participantes como jsonb na Conversa. — **Reversibility:** one-way depois de aplicada — migração imutável (DEC-10); correção é a `009`.
- **D-10:** A tabela de **Mensagem** guarda o **modelo completo da ontologia 7.6**: direção (`recebida`/`enviada`/`interna`), ator e ator delegante, remetente (participante/identificador por onde chegou), conteúdo, anexos (jsonb ordenado), assunto e endereços adicionais (E-mail), em resposta a, modelo usado, **identificador externo único por Canal** (INV-CXE-08), status de entrega com momento e motivo de falha, reações (jsonb), marcação de exclusão, edições externas (jsonb), momento de criação do provedor e momento de recebimento, anonimizada — **mais um jsonb `carga_bruta`** com o payload do provedor como veio, para reprocessar quando a integração chegar.
- **D-11:** **Ponte, não religação.** As rotas REST `/canais`, `/conversas`, `/mensagens` nascem e são testadas (`app.inject` + repositório contra Postgres local); a página de conexão e a ficha do Canal gravam **por REST**; os **Canais relacionais são projetados em `GET /estado`** (`state.channels`) para a Caixa de Entrada atual, o fio e as Listas conversacionais os enxergarem sem reescrita. Religar o chat inteiro (Conversas e Mensagens lidas por HTTP) fica para a fase de unificação. — **Reversibility:** reversible — a projeção é código do `apps/api`, removida quando as telas passarem a ler por REST.
- **D-12:** O **seed continua, marcado como demo**: os Canais e Conversas do seed seguem no estado hidratado para a Caixa não ficar vazia; a lista de Canais indica os que vêm da tabela nova (e os do seed como demo). A limpeza do seed fica para a unificação.

### Chat omnichannel
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Camadas e regras de dependência
- `CONTEXT.md` — mapa das camadas; web e api nunca dependem uma da outra; onde uma mudança nasce
- `AGENTS.md` — Next.js desta versão tem breaking changes; ler `node_modules/next/dist/docs/` antes de codar
- `apps/api/src/repositorios/CONTEXT.md`, `apps/api/src/rotas/CONTEXT.md`, `apps/api/src/persistencia/CONTEXT.md` — convenções da api, regra das migrações (imutáveis), Unidade de Trabalho

### Ontologia da Caixa de Entrada
- `ontologia/03-crm/caixa-de-entrada-e-mensageria.md` — §7.1 Tipo de Canal e Capacidades; §7.2 Canal (atributos, identificador externo, INV-CXE-01); §7.3 Mensagens de modelo; §7.5 Conversa; §7.6 Mensagem (modelo da tabela — D-10); §7.7 Participante; §11.1 estados do Canal (conexão × ciclo de vida); §12.2 ciclo de vida do Canal (conexão em dois atos — D-08); §20.20 mesmo número em novo Canal; §20.6 Contato com Conversa em dois Canais
- `ontologia/03-crm/contatos.md` — Identificadores de Contato (DO-CON-03) resolvidos pelo Canal
- `ontologia/DECISOES-E-PENDENCIAS.md` — A1.3, A2.4, A4.1, B13, B35, B66–B70, C36 (o protótipo simula o provedor — superado por D-08), DO-CXE-02/03/08/11/12
- `ontologia/GLOSSARIO.md`, `ontologia/MATRIZ-DE-RELACOES.md`

### Modelo relacional e padrão da 007
- `apps/api/migracoes/007-crm.sql` — padrão a seguir na 008 (cabeçalho com decisões, `workspace_id`, FKs compostas, trigger de `atualizado_em`, checks de estado); `plataforma.contatos` é o alvo da FK da Conversa
- `apps/api/migracoes/001-plataforma.sql` — `plataforma.registros` (onde Canal/Conversa/Mensagem vivem hoje como jsonb) e `plataforma.workspaces`
- `.planning/phases/07-crm-contatos-empresas-funis-e-negocios/07-CONTEXT.md` — D-01 (modelos convivem), D-03 (REST por recurso), D-04 (web só por HTTP), D-10/D-14 (isolamento e Papel no backend), D-12 (migração aplicada só após `--seco` e conferência)
- `.planning/phases/07-crm-contatos-empresas-funis-e-negocios/07-PATTERNS.md`, `07-RESEARCH.md` — padrões de repositório, rota e teste já estabelecidos

### Código existente do domínio e das telas
- `packages/dominio/src/types/crm.ts` §329–530 — `ChannelType`, `ChannelCapabilities`, `Channel`, `Queue`, `Message`, `Conversation`, `Inbox` (modelo antigo em memória, que convive)
- `packages/dominio/src/operations/canais.ts` — `criarCanal` (nasce `conectada` — muda por D-08), `configurarCanal`, `FORMA_DO_IDENTIFICADOR`, `identificadorCanonico`, `ROTULO_DO_TIPO_DE_CANAL`, `recusaDeGerirCanais`
- `packages/dominio/src/operations/conversations.ts` — `CHANNEL_CAPABILITIES` (por tipo — passa a (tipo, provedor) por D-02), `sendMessage`, `receiveMessage`, `startConversation`
- `apps/web/src/app/(shell)/crm/caixa-de-entrada/configuracoes/page.tsx` — lista de Canais e Filas (ganha "Conectar Canal" — D-05)
- `apps/web/src/app/(shell)/crm/caixa-de-entrada/configuracoes/canais/[canal]/page.tsx` — ficha do Canal (ganha provedor, estado de conexão, "Simular conexão")
- `apps/web/src/features/crm/adicionar-canal-dialog.tsx` — popup atual de adicionar conta (campos reaproveitados em D-07)
- `apps/web/src/features/crm/conversation-thread.tsx` §330–360, §520–560 — abas por tipo (viram por Canal — D-14) e compositor (ganha "Responder por" — D-15)
- `apps/web/src/features/crm/inbox-columns.tsx` — lista de Conversas e filtro `?canal=` (D-16)
- `apps/web/src/app/(shell)/crm/caixa-de-entrada/[conversa]/page.tsx` — página da Conversa (cabeçalho com Canal — D-13)
- `apps/web/src/dados/crm/` — cliente HTTP do CRM da Fase 7 (padrão para `/canais`)

### Planejamento
- `.planning/ROADMAP.md` (Phase 8), `.planning/STATE.md`, `.planning/REQUIREMENTS.md` (Requirements da fase: TBD — derivar em `08-RESEARCH.md` como na Fase 7)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `adicionar-canal-dialog.tsx` + `FORMA_DO_IDENTIFICADOR` / `identificadorCanonico`: rótulo, exemplo, dica e forma canônica por tipo — vão para o formulário da página de orientação (D-07).
- `CHANNEL_CAPABILITIES`, `CHANNEL_ICON`, `ROTULO_DO_TIPO_DE_CANAL`, `StateSeal`, `ConditionMarker`, `Pilula`: rótulos, ícones e selos já existem; o selo do provedor (D-04) é uma `Pilula` nova.
- `grade-solta` / `item-solto` (cartões das Configurações da Caixa): a grade dos quatro cartões (D-06).
- `apps/api/src/repositorios/crm/*`, `apps/api/src/rotas/crm/*`, `apps/web/src/dados/crm/*`: padrão completo de repositório → serviço → rota → cliente HTTP → tela da Fase 7, a copiar para Canais.
- `inbox-columns.tsx` já filtra por `conversation.channelId` e lista `${c.name} · ${tipo}` no filtro — base de D-16.
- `conversation-thread.tsx` já calcula a aba pela última Mensagem e já desabilita a aba sem identificador — a troca é da chave `ChannelType` para `channelId` (D-14).

### Established Patterns
- Rotas Fastify validam com esquemas em `rotas/esquemas/` e delegam regras ao `@n1/dominio`; testes `*.test.ts` ao lado; repositório provado contra Postgres local (pulam sem `DATABASE_URL`).
- Migrações numeradas e imutáveis; `npm run migrar -w @n1/api -- --seco` antes de aplicar.
- Web fala com a api só por HTTP; o resto do app hidrata o Espaço por `GET /estado` e grava por `POST /operacoes/:nome` — a ponte de D-11 vive nesse `GET /estado`.
- Permissão: `recusaDeGerirCanais` (B35) no domínio; no backend, Membro pelo JWT + Papel (Fase 7 D-10/D-14).

### Integration Points
- `GET /estado` (`apps/api/src/rotas/estado.ts`): projeção dos Canais relacionais em `state.channels` (D-11).
- Navegação: `app-shell.tsx` já tem "Caixa de Entrada"; `rotas.ts` trata `/crm/caixa-de-entrada/configuracoes/*` como tabela — as rotas novas `…/canais/conectar` e `…/canais/conectar/[provedor]` entram aí.
- `Conversation.channelId` (imutável) e `Message.viaIdentifierId` já ligam Mensagem → Canal no modelo antigo; a `008` leva o mesmo para colunas.
- Outbox `automacao.notificar-canal.v1` (`persistencia/eventos-de-canal.ts`, migrações 004/006): a notificação por Canal da Fase 5 continua apontando para `state.channels` — a projeção de D-11 precisa manter esse contrato.

</code_context>

<specifics>
## Specific Ideas

- "Um esquema tradicional de omnichannel, sem inventar muito a roda": cartões de provedor, orientação por provedor, seletor de Canal no compositor, nome do Canal na lista — o que Chatwoot/Blip/Zenvia fazem.
- A página de orientação é um **mockup por provedor** que será configurado depois: o layout (passos + espaço do QR/token + formulário) é fixo; o conteúdo troca quando a integração chegar.
- Dois WhatsApps lado a lado é o caso de teste da fase: um oficial e um não oficial, com nomes diferentes, na mesma Caixa, e o Contato com Conversa em cada um.

</specifics>

<deferred>
## Deferred Ideas

- Integração real dos provedores (Cloud API da Meta, Evolution/Baileys, Instagram Graph, IMAP/SMTP), webhook de entrada e envio real — fase própria por provedor, preenchendo o mockup de D-07
- Religar Caixa de Entrada, fio, Tarefas conversacionais e Listas conversacionais ao REST de Conversas/Mensagens; aposentar o seed de Canais/Conversas e a projeção de D-11 — fase de unificação
- Fila e Participante com tabela própria; Inbox (configuração da Caixa) relacional
- Chat do site e LinkedIn como provedores conectáveis
- Grupos de WhatsApp (ontologia documento 24) sobre o Canal relacional
- IDs da Meta (Phone Number ID, WABA ID) no formulário do oficial — quando a integração real pedir
- Reconexão com a mesma conta, arquivar/reativar Canal e eliminação de Canal arquivado sem Conversas (ontologia 12.2) — a ficha ganha "desconectar" e "arquivar" se couber no planejamento; o resto fica
- Sincronização de Mensagens de modelo do provedor oficial
- Canais em `/configuracoes/integracoes` (atalho ou cartões)

</deferred>

---

*Phase: 08-canais-de-comunica-o-conex-o-e-omnichannel-preparado*
*Context gathered: 2026-10-12*
