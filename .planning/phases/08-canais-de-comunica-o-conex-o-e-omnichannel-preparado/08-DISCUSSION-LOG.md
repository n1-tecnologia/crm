# Phase 8: Canais de comunicação: conexão e omnichannel preparado - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-12
**Phase:** 08-canais-de-comunica-o-conex-o-e-omnichannel-preparado
**Areas discussed:** Oficial × não oficial no modelo, Jornada de conexão e mockup, Escopo da migração 008, Chat omnichannel

O usuário selecionou as quatro áreas propostas e, em todas as perguntas, escolheu a opção recomendada.

---

## Oficial × não oficial no modelo

| Option | Description | Selected |
|--------|-------------|----------|
| Atributo 'provedor' no Canal | `ChannelType` continua `whatsapp`; o Canal ganha `provedor`; capacidades seguem do tipo, provedor só ajusta o que difere | ✓ |
| Novo ChannelType | Acrescenta `whatsappNaoOficial` ao enum; duplica regras por tipo | |
| Você decide | | |

**User's choice:** Atributo 'provedor' no Canal

| Option | Description | Selected |
|--------|-------------|----------|
| Não: envio livre | Não oficial sem janela nem modelos; capacidades por (tipo, provedor) | ✓ |
| Sim: mesma regra do oficial | Trata os dois iguais | |
| Você decide | | |

**User's choice:** Não: envio livre

| Option | Description | Selected |
|--------|-------------|----------|
| Número digitado em todos | Número com DDI nos dois WhatsApps, @ no Instagram, endereço no E-mail | ✓ |
| Oficial pede IDs da Meta | Phone Number ID e WABA ID além do número | |
| Você decide | | |

**User's choice:** Número digitado em todos

| Option | Description | Selected |
|--------|-------------|----------|
| Nome livre + selo do provedor | Nome dado pelo usuário + selo "oficial"/"não oficial" ao lado do ícone | ✓ |
| Nome + número sempre visível | Número em toda listagem e no chat | |
| Você decide | | |

**User's choice:** Nome livre + selo do provedor

---

## Jornada de conexão e mockup

| Option | Description | Selected |
|--------|-------------|----------|
| Configurações da Caixa de Entrada | Botão "Conectar Canal" → `/crm/caixa-de-entrada/configuracoes/canais/conectar` | ✓ |
| /configuracoes/integracoes | Canais como cartões na tela de Integrações | |
| Nos dois | Página na Caixa; atalho em Integrações | |

**User's choice:** Configurações da Caixa de Entrada

| Option | Description | Selected |
|--------|-------------|----------|
| Cartões por provedor | Quatro cartões: WhatsApp oficial, WhatsApp não oficial, Instagram, E-mail | ✓ |
| Lista por tipo com sub-escolha | Três itens; WhatsApp pergunta oficial ou não | |
| Você decide | | |

**User's choice:** Cartões por provedor

| Option | Description | Selected |
|--------|-------------|----------|
| Passos + formulário mínimo | Passo a passo genérico, espaço reservado para QR/token, formulário real (nome, identificador, Fila, Origem) | ✓ |
| Só formulário + aviso 'em breve' | Sem passo a passo | |
| Você decide | | |

**User's choice:** Passos + formulário mínimo

| Option | Description | Selected |
|--------|-------------|----------|
| Cria desconectada + 'Simular conexão' | Nasce `desconectada`; botão só para admins muda para `conectada`, marcado como simulado | ✓ |
| Cria já conectada | Como hoje (C36) | |
| Cria desconectada, sem simular | Fica `desconectada` até a integração real | |

**User's choice:** Cria desconectada + 'Simular conexão'

---

## Escopo da migração 008

| Option | Description | Selected |
|--------|-------------|----------|
| Canal + Conversa + Mensagem | Três tabelas no padrão da 007; Conversa → Contato relacional; Fila/Participante como colunas/jsonb | ✓ |
| Só Canal | Conversa e Mensagem seguem em `registros` jsonb | |
| Canal + Conversa + Mensagem + Fila + Participante | Tudo de 7.2–7.7 com tabela própria | |

**User's choice:** Canal + Conversa + Mensagem

| Option | Description | Selected |
|--------|-------------|----------|
| Modelo da ontologia 7.6 + carga bruta | Modelo completo + jsonb `carga_bruta` com o payload do provedor | ✓ |
| Mínimo renderizável | Direção, conteúdo, anexos, id externo, status, criado em | |
| Você decide | | |

**User's choice:** Modelo da ontologia 7.6 + carga bruta

| Option | Description | Selected |
|--------|-------------|----------|
| Ponte | Rotas REST nascem e são testadas; página de conexão grava por REST; Canais relacionais projetados em `GET /estado`; religar o chat fica para a unificação | ✓ |
| Religar tudo à api agora | Caixa, fio, filtros e ações por HTTP como o CRM da Fase 7 | |
| Você decide | | |

**User's choice:** Ponte

| Option | Description | Selected |
|--------|-------------|----------|
| Seed continua, marcado como demo | Canais do seed seguem no estado hidratado; lista indica os relacionais | ✓ |
| Seed de Canais sai | Só Canais relacionais; Caixa começa vazia | |
| Você decide | | |

**User's choice:** Seed continua, marcado como demo

---

## Chat omnichannel

| Option | Description | Selected |
|--------|-------------|----------|
| Cabeçalho + separador quando muda | Cabeçalho com ícone + nome + selo; separador "via <Canal>" quando o Canal muda na linha do tempo | ✓ |
| Selo em cada bolha | Ícone + nome em toda bolha | |
| Você decide | | |

**User's choice:** Cabeçalho + separador quando muda

| Option | Description | Selected |
|--------|-------------|----------|
| Uma aba por Canal | "Comercial · WhatsApp oficial", "Suporte · WhatsApp não oficial", "E-mail" | ✓ |
| Aba por tipo + seletor de Canal dentro | Mantém abas de hoje; seletor dentro da aba WhatsApp | |
| Você decide | | |

**User's choice:** Uma aba por Canal

| Option | Description | Selected |
|--------|-------------|----------|
| Seletor no compositor, padrão = Canal da Mensagem | "Responder por: [Canal]" com o Canal da última Mensagem recebida; só Canais conectados com identificador do Contato | ✓ |
| Só pela aba | Responder sempre pelo Canal da aba ativa | |
| Você decide | | |

**User's choice:** Seletor no compositor, padrão = Canal da Mensagem

| Option | Description | Selected |
|--------|-------------|----------|
| Ícone do tipo + nome do Canal + filtro por Canal | Item mostra ícone e nome; filtro lista cada Canal com selo | ✓ |
| Só ícone do tipo | Como hoje | |
| Você decide | | |

**User's choice:** Ícone do tipo + nome do Canal + filtro por Canal

---

## Claude's Discretion

- Forma exata do atributo `provedor` e onde moram as sobreposições de Capacidade por provedor
- Estrutura dos repositórios, esquemas, paginação, formato dos 409
- Como a projeção de Canais relacionais entra em `GET /estado` sem colidir com ids do seed
- Texto do passo a passo de cada provedor
- Aplicar a 008 no banco da plataforma dentro da fase (recomendado, com UAT `[BLOCKING]`)
- Permissões das rotas (matriz da Fase 7 + B35)

## Deferred Ideas

- Integração real dos provedores, webhook de entrada e envio real
- Religar a Caixa de Entrada inteira ao REST; aposentar seed e projeção
- Fila, Participante e Inbox relacionais
- Chat do site e LinkedIn conectáveis; Grupos (doc 24)
- IDs da Meta no formulário do oficial
- Reconexão, arquivar/reativar, eliminar Canal arquivado sem Conversas
- Sincronização de Mensagens de modelo
- Canais em `/configuracoes/integracoes`
