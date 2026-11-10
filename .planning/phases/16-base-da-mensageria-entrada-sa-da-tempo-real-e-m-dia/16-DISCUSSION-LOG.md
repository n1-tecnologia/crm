# Phase 16: Base da mensageria: entrada, saída, tempo real e mídia - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-09
**Phase:** 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia
**Areas discussed:** Tempo real (3.8.1), Provedor de teste e como funciona, Webhook novo × Meta que já existe, Mídia (limites, guarda e gravação)

---

## Tempo real (3.8.1)

### Como mandar as novidades para a tela

| Option | Description | Selected |
|--------|-------------|----------|
| (B) Canal próprio SSE + LISTEN/NOTIFY (Recomendado) | ~1 dia; regra de acesso no `apps/api`; 1 conexão fixa a mais no pooler em modo sessão; `X-Accel-Buffering: no` | ✓ |
| (A) Supabase Realtime | Vem com o banco, mas expõe o schema `plataforma` com regras por linha, o contrário do que a Fase 9 fechou | |

**User's choice:** (B) Canal próprio SSE + LISTEN/NOTIFY.

### Mensagem numa Conversa que o Membro não está olhando

| Option | Description | Selected |
|--------|-------------|----------|
| Só atualiza as listas (Recomendado) | Caixa, contador de não lidas e resumo das Tarefas se atualizam; sem toast nem som | ✓ |
| Atualiza e mostra um aviso na tela | Toast "Nova mensagem de [Contato]" com link | |
| Atualiza, avisa e toca som | Toast, som e título da aba piscando; pede permissão e preferências por Membro | |

**User's choice:** Só atualiza as listas.

---

## Provedor de teste e como funciona

### Onde o provedor de teste pode existir (primeira pergunta)

| Option | Description | Selected |
|--------|-------------|----------|
| Só em Canal simulado | Segredo por Canal no cofre; funciona em produção para demonstração | |
| Só em dev e CI | Não carrega em produção | |
| Segredo fixo, sem restrição | Como a 3.6.1 descreve; qualquer um que saiba o id injeta mensagem | |

**User's choice:** Resposta livre: "já tenho uma instância da Evolution API (whatsapp não oficial) provisionada, podemos seguir com ela".
**Notes:** Mudou o desenho da fase; a pergunta seguinte fixou até onde a Evolution entra.

### Até onde a Evolution entra na Fase 16

| Option | Description | Selected |
|--------|-------------|----------|
| Adaptador mínimo + prova ao vivo (Recomendado) | Provedor de teste nos testes automáticos; adaptador mínimo da Evolution; o dono conecta o número na própria Evolution; 2 a 3 dias a mais | ✓ |
| Só provedor de teste; Evolution na Sessão 4 | A fase como o ROADMAP descreve | |
| Antecipar a Sessão 4 inteira | Funde a Sessão 4 (cerca de 40 subtarefas) | |

**User's choice:** Adaptador mínimo + prova ao vivo.

### O provedor de teste pode existir em produção?

| Option | Description | Selected |
|--------|-------------|----------|
| Só em Canal simulado, segredo por Canal (Recomendado) | `conexao_simulada = true` e segredo próprio no cofre | ✓ |
| Só em dev e CI | Não carrega em produção | |

**User's choice:** Só em Canal simulado, segredo por Canal.

### Como o Canal passa a apontar para o número conectado na Evolution (sem QR)

| Option | Description | Selected |
|--------|-------------|----------|
| Comando de linha, uma vez por Canal (Recomendado) | `canal:ligar-evolution`: cofre, segredo, webhook, número, marca `conectada` | ✓ |
| Formulário temporário na ficha do Canal | Tela que a Sessão 4 joga fora; chave passa pelo navegador | |
| Dono configura o webhook à mão na Evolution | Menos código, mais passos manuais | |

**User's choice:** Comando de linha.

---

## Webhook novo × Meta que já existe

### Onde vai o segredo do webhook da Evolution

| Option | Description | Selected |
|--------|-------------|----------|
| Cabeçalho próprio configurado no webhook (Recomendado) | URL `/webhooks/mensageria/<canalId>`; segredo nunca em log de acesso | ✓ |
| Segredo na URL (como a 4.4.1 descreve) | Cai no `access_log` do nginx até `/webhooks/` ganhar mascaramento manual | |

**User's choice:** Cabeçalho próprio.
**Notes:** A confirmação de que a Evolution v2 aceita `headers` no webhook ficou como item a conferir na versão instalada; o fallback é o segredo na URL com mascaramento no nginx.

### O que fazer com `webhook-meta.ts`

| Option | Description | Selected |
|--------|-------------|----------|
| Deixar como está até as Sessões 7 e 8 (Recomendado) | Continua só escutando | ✓ |
| Deixar, mas parar de gravar o corpo no log | Tira dado pessoal do log | |
| Encaixar a Meta já na rota por Canal | Antecipa parte das Sessões 7 e 8 | |

**User's choice:** Deixar como está.

---

## Mídia: limites, guarda e gravação

### Teto de tamanho

| Option | Description | Selected |
|--------|-------------|----------|
| 16 MiB áudio/vídeo, 25 MiB o resto (Recomendado) | Limite prático do WhatsApp; nginx não muda | ✓ |
| 25 MiB para tudo | Um teto só | |
| Teto maior para vídeo (ex.: 64 MiB) | Exige tratar a mídia em fluxo, não em base64 | |

**User's choice:** 16 MiB áudio/vídeo, 25 MiB o resto.

### Documentos de escritório

| Option | Description | Selected |
|--------|-------------|----------|
| Aceitar documentos de escritório comuns (Recomendado) | docx, xlsx, pptx, csv, txt, zip só em Mensagem; sempre baixados como anexo | ✓ |
| Só a lista do plano | O resto vira anexo `baixado: false` com "tipo não suportado" | |

**User's choice:** Aceitar documentos de escritório comuns.

### Enviar áudio pela Caixa

| Option | Description | Selected |
|--------|-------------|----------|
| Só anexar arquivo (Recomendado) | Fiel à 3.9.5 | ✓ |
| Gravar pelo microfone já nesta fase | ~1,5 dia; WebM do Chrome precisa virar OGG/Opus | |

**User's choice:** Só anexar arquivo.

---

## Claude's Discretion

- Ordem e corte em planos; nomes de eventos, rotas e hooks.
- Em que borda a rota de webhook tem limite de taxa (nginx à mão ou teto na API).
- `X-Accel-Buffering: no` no SSE, a provar com `provar-nginx.sh`.
- Tratamento de `fromMe` no adaptador mínimo da Evolution (não duplicar a Mensagem enviada pelo sistema).
- Conferir `@lid` na versão instalada da Evolution.
- Bucket `solicitacoes` ou bucket próprio de conversas.
- Dono e Fila do Contato criado por mensagem de número desconhecido; tentativas e prazo da fila de saída; textos de erro.
- Não foram discutidos (o dono escolheu "pronto para o contexto"): tentativas e prazo da fila de saída; dono e Fila do Contato novo; dado real de cliente entrando com as pendências de infra da Fase 9 (backup diário desligado, homologação inexistente).

## Deferred Ideas

- Aviso de mensagem nova com toast ou som.
- Gravar áudio pelo microfone da Caixa.
- QR, estado da conexão, tiques, reações, nono dígito, vários números (Sessão 4).
- Meta na rota por Canal (Sessões 7 e 8).
- Avisos do Financeiro por Canal daqui (4.5.2).
- Retenção do `corpo` das chamadas e da mídia (Sessão 19).
- Homologação e backup diário (infra do dono).
