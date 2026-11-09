# API Coverage — Evolution API v2.3.7 (WhatsApp não oficial)

> Full coverage by default. Opt-outs are explicit, reasoned decisions.
>
> Fronteira decidida em D-16-04 (16-CONTEXT.md): esta fase liga um adaptador mínimo da Evolution
> (`apps/api/src/mensageria/provedores/evolution/`) para a prova ao vivo; o resto da superfície é da
> Sessão 4 do cronograma (`docs/09-planejamento/TAREFAS-POR-SESSAO.md`, 4.1 a 4.5). Fonte da superfície:
> `16-RESEARCH.md`, "Respostas ao foco da pesquisa" §1 (fonte da Evolution na tag `2.3.7`).
> Planos que integram: 16-11 (cliente, tradutor, provedor), 16-12 (`canal:ligar-evolution`), 16-15 e 16-16 (prova ao vivo).

| capability | decision | reason |
|---|---|---|
| `POST /webhook/set` com `headers` (segredo no cabeçalho, D-16-06) | INTEGRATE | |
| `POST /webhook/set` com `byEvents: false` e `events: ["MESSAGES_UPSERT"]` | INTEGRATE | |
| `GET /webhook/find/{instancia}` | OPT-OUT | não usado: o comando confere o 201 do `webhook/set`; Sessão 4 se precisar reconferir |
| `MESSAGES_UPSERT` de texto (`conversation`, `extendedTextMessage`) | INTEGRATE | |
| evento `MESSAGES_UPSERT` de imagem (`imageMessage`, com `caption`) | INTEGRATE | |
| `MESSAGES_UPSERT` de áudio (`audioMessage`, PTT, `audio/ogg`) | INTEGRATE | |
| evento `MESSAGES_UPSERT` de vídeo (`videoMessage`) | INTEGRATE | |
| `MESSAGES_UPSERT` de documento (`documentMessage` e com legenda) | INTEGRATE | |
| evento `MESSAGES_UPSERT` de figurinha (`stickerMessage` como `image/webp`) | INTEGRATE | |
| `@lid` com `remoteJidAlt` (a Evolution já troca o `remoteJid` pelo número) | INTEGRATE | |
| `@lid` sem `remoteJidAlt` (sem número) | OPT-OUT | sem número não há Contato: marcado `ignorado:sem_numero`; tratamento é da Sessão 4 (4.4.2 "Atenção") |
| `MESSAGES_UPSERT` com `key.fromMe = true` (digitada no celular) | OPT-OUT | Sessão 4 (4.4.2 item 3); o socket tem `emitOwnEvents:false`, então ignorar não duplica nada |
| `MESSAGES_UPSERT` de grupo (`@g.us`) | OPT-OUT | Sessão 6 (Grupos) |
| `MESSAGES_UPSERT` de `status@broadcast` | OPT-OUT | não é conversa com Contato; ignorado sempre |
| reações (`reactionMessage`) | OPT-OUT | Sessão 4 (4.4.5) |
| edições e revogações (`protocolMessage`, `editedMessage`) | OPT-OUT | Sessão 4 (4.4.5) |
| localização, contato, enquete, botões e listas | OPT-OUT | fora de D-16-04; ignorados com motivo e registrados em `andamento.mjs` (Open Question 3) |
| mensagem citada recebida (`contextInfo.stanzaId` → `emRespostaAId`) | OPT-OUT | Sessão 4 (4.4.2 item 2) |
| evento `MESSAGES_UPDATE` (tiques entregue/lida) | OPT-OUT | Sessão 4 (4.4.5); consequência aceita em D-16-04 |
| evento `MESSAGES_DELETE` | OPT-OUT | Sessão 4 (4.4.5) |
| evento `SEND_MESSAGE` | OPT-OUT | não assinado: o 201 do envio já devolve o `key.id` |
| evento `CONNECTION_UPDATE` e a conferência periódica | OPT-OUT | Sessão 4 (4.3.1 e 4.3.2) |
| evento `QRCODE_UPDATED` | OPT-OUT | Sessão 4 (4.2.4) |
| `POST /message/sendText/{instancia}` | INTEGRATE | |
| `POST /message/sendMedia` (imagem, vídeo, documento por URL assinada) | INTEGRATE | |
| `POST /message/sendWhatsAppAudio/{instancia}` (sai como mensagem de voz) | INTEGRATE | |
| envio com citação (`quoted`) | OPT-OUT | Sessão 4 (4.4.4 item 2) |
| envio com `delay` (simula digitação) | OPT-OUT | alonga a resposta e não acrescenta nada ao critério de 2 s |
| `POST /chat/getBase64FromMediaMessage` com o `message` do webhook | INTEGRATE | |
| `convertToMp4: true` no download de áudio | OPT-OUT | desligado por padrão pelo orçamento de 2 s; reabre se o áudio não tocar no Safari (A5) |
| `webhook.base64: true` (mídia dentro do corpo do webhook) | OPT-OUT | estoura o `bodyLimit` de 2 MiB e engorda `webhooks_recebidos.corpo` |
| `GET /instance/fetchInstances` (`ownerJid`, `token`, `connectionStatus`) | INTEGRATE | |
| `GET /instance/connectionState/{instancia}` | INTEGRATE | |
| `GET /` (versão da Evolution, conferida no `--seco`) | INTEGRATE | |
| `POST /instance/create` | OPT-OUT | Sessão 4 (4.2.2 e 4.2.3); nesta fase o dono cria a instância na própria Evolution |
| `GET /instance/connect/{instancia}` (QR code e código de pareamento) | OPT-OUT | Sessão 4 (4.2.3 e 4.2.4) |
| `DELETE /instance/logout/{instancia}` | OPT-OUT | Sessão 4 (4.3.3) |
| `DELETE /instance/delete/{instancia}` | OPT-OUT | Sessão 4 (4.3.3) |
| vários números (várias instâncias) ao mesmo tempo | OPT-OUT | Sessão 4 (4.5) |
| nono dígito do número brasileiro no recebimento (4.4.3) | OPT-OUT | Sessão 4; só `conferirNumeroConectado` tolera a diferença para não recusar o número certo |
| `POST /chat/whatsappNumbers/{instancia}` (checar se o número tem WhatsApp) | OPT-OUT | o 400 do envio já diz "Este número não tem WhatsApp" |
| `POST /chat/markMessageAsRead/{instancia}` | OPT-OUT | marcar como lida no celular não é desta fase |
| `chat/findMessages`, `chat/findChats`, `chat/findContacts` | OPT-OUT | histórico do WhatsApp não é importado |
| `group/*` | OPT-OUT | Sessão 6 (Grupos) |
| `settings/set`, `chat/sendPresence`, perfil | OPT-OUT | não usados pela Caixa |
| integrações embutidas (Typebot, Chatwoot, OpenAI, RabbitMQ, SQS, WebSocket) | OPT-OUT | a plataforma é a integração; nenhuma é ligada |
