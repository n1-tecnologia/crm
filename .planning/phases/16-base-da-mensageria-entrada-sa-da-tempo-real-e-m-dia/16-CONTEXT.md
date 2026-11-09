# Phase 16: Base da mensageria: entrada, saída, tempo real e mídia - Context

**Gathered:** 2026-11-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Sessão 3 do cronograma, parte C (3.6 a 3.9, 18 subtarefas). A Fase 15 deixou o CRM novo como único no código: Contato, Conversa e Mensagem vivem em `plataforma.contatos`, `conversas` e `mensagens`, e nenhuma tela lê o modelo antigo. Falta o que faz a mensagem **entrar, sair, aparecer sozinha e carregar mídia**, construído uma vez só para os quatro provedores (Sessões 4, 7, 8 e 9). Hoje `registrarRecebida` não tem rota, só grava numa Conversa já aberta, o envio só grava e não sai para lugar nenhum, a tela pergunta a cada 5 s se a revisão do Espaço mudou (as tabelas do CRM não mexem nela) e o anexo da Mensagem é uma referência externa sem arquivo.

Esta fase entrega:

1. **Porta de entrada** (3.6.1 a 3.6.5): interface do provedor, recebimento completo (acha ou cria Contato, abre, reabre ou reaproveita a Conversa, grava a Mensagem), rota de webhook por Canal, fila de entrada com worker, status de entrega.
2. **Porta de saída** (3.7.1 a 3.7.3): envio enfileirado no outbox na mesma transação da Mensagem, entrega pelo provedor do Canal, tentar de novo e mostrar a entrega no fio.
3. **Tempo real** (3.8.2 a 3.8.4; a decisão 3.8.1 está fechada em D-16-01): eventos do CRM no banco, rota SSE e escuta na tela.
4. **Mídia** (3.9.1 a 3.9.6): anexo ligado a arquivo guardado, áudio e vídeo aceitos, upload e download, baixar do provedor, tocar no fio, limpeza de órfãos.
5. **Um adaptador mínimo da Evolution e a prova ao vivo** (D-16-04, D-16-05): decisão desta discussão, **não estava no ROADMAP**. O dono já tem uma instância da Evolution provisionada; a fase a liga ao Canal por um comando de linha e prova o fluxo com WhatsApp real. O provedor de teste continua sendo o dos testes automáticos.

**Pronto quando (da fase):** (a) nos testes automáticos, com o provedor de teste: uma chamada ao webhook de um Canal cria (ou acha) o Contato, abre ou reabre a Conversa, e a resposta escrita na tela passa pela fila e chega ao provedor de teste; (b) **ao vivo, com a Evolution do dono**: uma mensagem de texto e um áudio mandados de um celular aparecem na Caixa de Entrada de outra aba em menos de 2 s, com o áudio tocando, e a resposta escrita na Caixa chega ao celular.

Não entra (fica para a Sessão 4, salvo o que D-16-04 puxa): QR code na ficha do Canal, `CONNECTION_UPDATE` e a conferência periódica da conexão, tiques, reações, edições e mensagens apagadas vindos da Evolution (`MESSAGES_UPDATE`, `MESSAGES_DELETE`), o nono dígito do número brasileiro (4.4.3), vários números, tirar "Simular conexão" da produção. Também não entram: WhatsApp oficial e modelos (Sessão 7), Instagram (Sessão 8), E-mail (Sessão 9), Grupos (Sessão 6), Agente na Caixa (Sessão 16), política de retenção do `corpo` das chamadas (Sessão 19), gravar áudio pelo microfone da Caixa.

**Requisitos derivados** (o ROADMAP mandava derivá-los aqui; os ids são locais da fase, como os UNI das Fases 14 e 15, e o planejador os confirma):
- **MSG-01** — porta de entrada: um evento de mensagem do provedor vira Contato, Conversa e Mensagem nas tabelas, e a mesma chamada repetida não grava nada novo (3.6.1 a 3.6.5).
- **MSG-02** — porta de saída: a Mensagem escrita na Caixa entra no outbox na mesma transação, sai pelo provedor do Canal, tenta de novo no erro transitório e mostra o estado da entrega com "Tentar de novo" (3.7.1 a 3.7.3).
- **MSG-03** — tempo real: a Mensagem que chega aparece nas duas abas da mesma Conversa em menos de 2 s, sem vazar evento para outro Espaço nem para quem não pode ler a Conversa (3.8.2 a 3.8.4).
- **MSG-04** — mídia: áudio, imagem, vídeo e documento vão e vêm guardados no bucket e tocam depois de o link do provedor expirar (3.9.1 a 3.9.6).
- **MSG-05** — o provedor de teste só existe para Canal simulado, com segredo próprio por Canal (D-16-03).
- **MSG-06** — a Evolution do dono, ligada a um Canal por `canal:ligar-evolution`, recebe e envia texto e mídia pela mesma base (D-16-04 a D-16-06).

</domain>

<decisions>
## Implementation Decisions

### Já decidido nas subtarefas 3.6 a 3.9 (vale aqui, não foi reaberto)
- A interface do provedor mora em `apps/api/src/mensageria/provedor.ts` (entrada e saída de rede), com os tipos do domínio; `registro.ts` devolve o provedor do Canal; sem implementação, `PROVEDOR_INDISPONIVEL` (3.6.1).
- O recebimento é `receberMensagem(workspaceId, canalId, evento)` numa transação: repetida volta `repetida: true` sem tocar em nada; Contato achado por `detentorDoIdentificador` ou criado com `modo_criacao = 'automatico_mensagem'`; Conversa aberta reaproveitada, resolvida dentro de `inbox.reopenWindowHours` reabre, senão abre outra (RN-CXE-09); Contato arquivado ou na lixeira volta a `ativo` (RN-CON-13) (3.6.2). `registrarRecebida` vira o último passo.
- Webhook `POST /webhooks/mensageria/:canalId`, fora do hook de JWT, corpo cru preservado, Canal inexistente, arquivado ou chamada não verificada recebem a mesma 401 sem dizer o motivo; verificada grava em `plataforma.webhooks_recebidos` e responde 200 na hora, sem processar dentro da requisição (3.6.3).
- Fila de entrada: tabela `webhooks_recebidos` e worker `processador-de-entrada.ts` com `for update skip locked`, backoff, `locked_at` vencido volta a `pendente`, ligado por `MENSAGERIA_WORKER_ATIVO` (3.6.4). `proximoStatusDeEntrega` só avança (3.6.5).
- Saída: evento `mensagem.enviar.v1` no outbox, `statusInicialDeEnvio` sempre `pendente` (só o provedor diz que saiu), índice único por Mensagem, Mensagens `pendente` reenfileiradas quando o Canal volta a `conectada` (3.7.1); segundo worker só com esse evento, entregador pelo provedor, aceito grava `id_externo` e `enviada`, recusa permanente grava `falhou` com `motivo_falha` (3.7.2); `POST /mensagens/:id/reenviar` e os estados no fio (3.7.3).
- Tempo real: `avisarCrm` faz `pg_notify('crm_eventos', json)` no mesmo cliente da transação, payload só com ids; `GET /eventos` com uma conexão `LISTEN` por processo, filtro por Espaço e por poder `ler` `conversa`, batida a cada 25 s; a web usa `fetch` com `Authorization` e leitura em fluxo, reconecta com espera crescente e, sem conexão, volta à releitura de 5 s (3.8.2 a 3.8.4).
- Mídia: `AnexoDaMensagem` ganha `objectKey`, `tamanhoBytes` e `baixado`; lista própria de tipos da Mensagem sem alargar a do Formulário público; `POST /mensagens/anexos`, `POST /mensagens` com anexos confirmados e `GET /mensagens/:id/anexos/:indice` com a chave `workspace/<ws>/conversas/<conversaId>/<uuid>`; a mídia do provedor é baixada antes da transação, e a falha grava a Mensagem com `baixado: false` e tenta de novo na próxima passada; `coletarOrfaos` ligado por `COLETA_DE_ORFAOS_ATIVA` com `pg_try_advisory_lock` (3.9.1 a 3.9.6).

### Tempo real (3.8.1)
- **D-16-01:** **O servidor avisa a tela por um canal próprio no `apps/api` (SSE), alimentado por `LISTEN/NOTIFY` do Postgres** (escolha B da 3.8.1, a recomendada). A regra de acesso continua no `apps/api`: cada aba só recebe eventos do próprio Espaço e de Conversas que o Membro pode ler. Descartado: Supabase Realtime (A), porque exigiria expor o schema `plataforma` ao Realtime com regras por linha, o contrário do que a Fase 9 fechou (a `009` está aplicada em produção e o `apps/api` conecta como `n1_api`). Custa uma conexão fixa a mais no pooler em modo sessão (porta 5432), que é o que produção já usa. — **Reversibility:** costly — `avisarCrm` fica espalhado pelos serviços de Conversa e Mensagem e `tempo-real.ts` na web; trocar de mecanismo depois mexe nos dois lados.
- **D-16-02:** **Mensagem que chega numa Conversa que o Membro não está olhando só atualiza as listas** (Caixa de Entrada, contador de não lidas e resumo das Tarefas conversacionais, por `mutate` das chaves). Sem toast, sem som, sem título da aba piscando. — **Reversibility:** reversible — é interface sobre o mesmo evento.

### Provedor de teste e a Evolution
- **D-16-03:** **O provedor de teste só é devolvido para Canal com `conexao_simulada = true`, e cada Canal simulado tem o segredo do webhook próprio, no cofre** (`plataforma.credenciais`, a `009`). Não existe segredo fixo de teste. Isso **corrige** o item 8 da 3.6.1 ("aceita o segredo fixo de teste"). Em produção dá para simular um Canal no `ws_n1` e demonstrar a Caixa sem WhatsApp real; ninguém injeta mensagem sem o segredo daquele Canal. O conjunto de testes de contrato do provedor (3.6.1) continua rodando contra ele no CI. — **Reversibility:** reversible — é a regra de `provedorDoCanal` e a origem do segredo.
- **D-16-04:** **A Fase 16 inclui um adaptador mínimo da Evolution e uma prova ao vivo com a instância que o dono já provisionou.** Entra: o cliente da Evolution (parte de 4.2.2: o que `enviar` e `baixarMidia` usam, com tempo limite e `apikey`), a verificação do webhook por segredo (D-16-06), traduzir `MESSAGES_UPSERT` de texto, imagem, áudio, vídeo e documento para o evento de mensagem (parte de 4.4.2), `enviar` de texto e de mídia, `baixarMidia`. O dono conecta o número na própria Evolution, fora da plataforma. **Fica na Sessão 4:** QR code e "Conectar" na ficha, `CONNECTION_UPDATE` e `QRCODE_UPDATED`, a conferência periódica, `MESSAGES_UPDATE` (tiques), reações, edições, `MESSAGES_DELETE`, o nono dígito (4.4.3), vários números, tirar "Simular conexão" da produção. Consequência aceita para a prova: sem a tradução de `MESSAGES_UPDATE` não há tique de lida vindo do celular, e um número brasileiro sem o nono dígito pode virar Contato repetido. Descartado: só provedor de teste e a Evolution na Sessão 4 (o dono só veria mensagem de verdade depois); antecipar a Sessão 4 inteira (cerca de 40 subtarefas e a Sessão 4 deixaria de existir no cronograma). — **Reversibility:** costly — a Sessão 4 passa a herdar o adaptador desta fase e o cronograma (`docs/09-planejamento/`) precisa registrar que 4.2.2, 4.4.1, 4.4.2 e 4.4.4 foram parcialmente adiantados.
- **D-16-05:** **O Canal é ligado à instância por um comando de linha, uma vez por Canal:** `npm run canal:ligar-evolution -w @n1/api -- --canal <id> --instancia <nome>`. Ele guarda a chave da instância no cofre, gera o segredo do webhook, aponta o webhook da Evolution para a rota desta fase com o segredo no cabeçalho (D-16-06), lê o número conectado e marca o Canal `conectada` com `conexao_simulada = false`. Sem tela nova; a Sessão 4 troca o comando pelo botão "Conectar" com QR. **O comando recusa a instância `numeropvmarcos`**: ela é do `automation/` (extratos e avisos do Financeiro) e apontar o webhook dela para cá quebraria isso (4.1.1 e 4.5.2). Marcar `conectada` de verdade pede que o domínio entenda `conexao_confirmada` e `conferirNumeroConectado` (parte de 4.2.1: hoje `AcaoDeConexao` só tem `simular_conexao` e `desconectar`); o planejador decide se puxa só essas duas e deixa `conectar` e `conexao_perdida` para a Sessão 4. — **Reversibility:** reversible — é script e uma ação de domínio; a Sessão 4 substitui.

### Webhook
- **D-16-06:** **O segredo do webhook da Evolution vai num cabeçalho próprio configurado no webhook da instância, não na URL.** A rota fica `POST /webhooks/mensageria/:canalId` e `verificarChamada` confere o cabeçalho em tempo constante contra o segredo do Canal no cofre; a chamada também confere que o `instance` do corpo é a instância daquele Canal. Motivo: o nginx da VM só mascara segredo de URL em `/v1/public/`, então um segredo na URL (como a 4.4.1 descreve) cairia no `access_log`. **Precisa ser conferido na versão instalada:** a Evolution v2 aceita `headers` ao configurar o webhook (`POST /webhook/set/{instancia}`)? Se não aceitar, o fallback é o segredo na URL e o mascaramento de `/webhooks/` no nginx, edição manual que só o dono faz. Isso **substitui** o desenho de URL com segredo da 4.4.1; a Sessão 4 herda o cabeçalho. — **Reversibility:** reversible — é onde o segredo viaja; troca-se na rota e no comando.
- **D-16-07:** **`apps/api/src/rotas/webhook-meta.ts` (`/webhooks/meta/whatsapp` e `/instagram`) fica como está** até as Sessões 7 e 8: continua só escutando, sem gravar nada. A Meta chama por app, não por Canal, e exige o aperto de mão GET; o encaixe depende de resolver `phone_number_id` ou página para um Canal, e é trabalho dessas duas sessões. A interface de provedor desta fase já deixa `verificarChamada` e `interpretarChamada` prontos para elas. — **Reversibility:** reversible — a rota nova não toca a antiga.

### Mídia
- **D-16-08:** **Teto de 16 MiB para áudio e vídeo e 25 MiB para os demais tipos**, configuráveis por variável de ambiente como `UPLOAD_MAX_BYTES`. Mídia recebida acima do teto, ou cujo download falhe, grava a Mensagem assim mesmo com o anexo `baixado: false`, nome e a referência do provedor; nunca derruba a Mensagem. O `client_max_body_size` do nginx (26M) não muda. — **Reversibility:** reversible — são variáveis de ambiente.
- **D-16-09:** **A lista de tipos da Mensagem (`TIPOS_ACEITOS_NA_MENSAGEM`) ganha docx, xlsx, pptx, csv, txt e zip**, além de PDF, XML, JPEG, PNG, WebP, `audio/ogg`, `audio/mpeg`, `audio/mp4`, `audio/aac`, `video/mp4` e `video/3gpp` da 3.9.2. Só para Mensagem: o Formulário público segue com a lista de hoje e continua recusando áudio. A assinatura é conferida como nos outros tipos (`assinaturaConfereComTipo`): docx, xlsx, pptx e zip começam todos com `PK`, então a conferência só prova que o arquivo é da família ZIP, e o planejador decide se vai além disso (por exemplo, olhar o nome interno do pacote); csv e txt não têm assinatura e só valem se o conteúdo for texto. O download de documento sai sempre como anexo, nunca aberto no navegador. Motivo: cliente manda esses arquivos por WhatsApp o tempo todo, e sem eles o atendente perde o arquivo se o link do provedor expirar. — **Reversibility:** reversible — é uma lista e as assinaturas.
- **D-16-10:** **Enviar áudio pela Caixa é só anexar um arquivo de áudio.** Gravar pelo microfone na tela fica fora (ideia adiada, abaixo). — **Reversibility:** reversible.

### Claude's Discretion
- A ordem e o corte em planos, respeitando: domínio antes de api antes de tela; a migração nova (`013`: `webhooks_recebidos` e o índice único do `mensagem.enviar.v1`; a 3.6.4 a chama "migração nova da 3.1", que na prática é a próxima depois da `012`) antes dos serviços que a usam; a interface do provedor e o provedor de teste antes de tudo que fala com provedor; o adaptador da Evolution (D-16-04) depois de a porta de entrada e a de saída passarem com o provedor de teste; a prova ao vivo por último.
- O nome e a forma dos eventos (`mensagem.nova`, `mensagem.status`, `conversa.mudou`), os nomes de rotas e hooks, e como o `useConversas` e o resumo das Tarefas conversacionais se invalidam.
- **Em que borda a rota de webhook tem limite de taxa.** A 3.6.3 pede limite de taxa, mas `apps/api` não tem limitador próprio: o `limit_req` só existe no nginx e só para `/v1/public/` (`apps/api/deploy/nginx-n1-crm-api.conf`, `n1-crm-limites.conf`). O planejador decide entre um bloco `/webhooks/` no nginx (edição manual do dono, como a 09-20) e um teto na própria API.
- **SSE atrás do nginx:** a API deve mandar `X-Accel-Buffering: no` na resposta de `/eventos` para o nginx não segurar o fluxo; a batida de 25 s já cabe no `proxy_read_timeout` de 120 s. Provar com `apps/api/deploy/provar-nginx.sh` antes de depender disso.
- **Mensagem enviada pela plataforma que volta como `MESSAGES_UPSERT` com `fromMe`:** o `id_externo` só é gravado depois de o provedor responder, e o webhook pode chegar antes. O adaptador mínimo não pode duplicar a Mensagem enviada pelo próprio sistema; o planejador escolhe entre ignorar `fromMe` nesta fase (a mensagem digitada direto no celular não aparece até a Sessão 4) e tratar como a 4.4.2 item 3.
- **`@lid`:** conferir, com a versão instalada, se a Evolution entrega o remetente como `@lid` (sem número) em vez do número, antes da prova ao vivo (a "Atenção" da 4.4.2).
- Se o bucket é o `solicitacoes` de hoje (a 3.9.3 usa a chave `workspace/<ws>/conversas/...` no mesmo bucket, e `SUPABASE_STORAGE_BUCKET` é uma variável só) ou um bucket próprio de conversas; a recomendação do plano é o mesmo bucket.
- Quem fica de dono do Contato criado por mensagem de número desconhecido e em qual Fila cai a Conversa: o plano da 3.6.2 já define (`canal.proprietario_padrao_id`, senão `canal.configurado_por`, e `fila_padrao_id` do Canal); só reabrir se a prova ao vivo mostrar algo estranho.
- Quantas tentativas e por quanto tempo a fila de saída insiste antes de marcar `falhou` (o backoff de hoje do outbox como ponto de partida).
- O texto de erro de "Tentar de novo" e do estado de entrega no fio, em português de produto.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### O plano desta fase
- `docs/09-planejamento/TAREFAS-POR-SESSAO.md` — Sessão 3, tarefas 3.6 (linha ~1098), 3.7 (~1153), 3.8 (~1184) e 3.9 (~1220): cada subtarefa com "Hoje / O que fazer / Pronto quando". Os números de linha do código citados ali deslocaram com as Fases 9 a 15 (`AcompanhanteDaRevisao` está hoje em `apps/web/src/dados/store.ts:689`, não em `:319`): procurar de novo antes de planejar. Sessão 4 (linha ~1269), 4.1 a 4.5: o que **fica** para lá, e os trechos 4.2.1, 4.2.2, 4.4.1, 4.4.2 e 4.4.4 que D-16-04 a D-16-06 adiantam em parte.
- `docs/09-planejamento/dados/` — fonte dos dados do cronograma (o `.md` e o `.html` são gerados por `gerar.mjs`, nunca editados à mão); `andamento.mjs` registra o que está feito e o que D-16-04 adianta da Sessão 4 precisa ser registrado ali.
- `.planning/ROADMAP.md` — "Phase 16" (o "Pronto quando" da fase muda com D-16-04) e "Phase 15".

### Herança direta
- `.planning/phases/15-unifica-o-do-crm-telas-no-modelo-novo-e-remo-o-do-modelo-ant/15-CONTEXT.md` — o CRM novo como único no código, `plataforma.canais`, `conversas` e `mensagens`, "Simular conexão" como único caminho de conexão (D-15-12), padrão de corte e de deploy manual.
- `.planning/phases/14-unifica-o-do-crm-o-modelo-novo-ganha-o-que-falta-e-a-tarefa/14-CONTEXT.md` — F14-D-07 e a Tarefa conversacional, que a Sessão 5 liga a esta base.
- `CONTEXT.md` (raiz) — "Estado atual", Fases 7, 8, 14 e 15; **atualizar** ao fim da fase (nasce `apps/api/src/mensageria/`, a `013`, `GET /eventos`).

### Modelo do CRM (o destino das mensagens)
- `apps/api/migracoes/008-canais-conversas-mensagens.sql` — `canais` (`provedor`, `conexao`, `conexao_simulada`, `proprietario_padrao_id`, `fila_padrao_id`, `origem_padrao_id`), `conversas`, `mensagens` (`status_entrega`, `motivo_falha`, `anexos` jsonb, índice `mensagens_id_externo_uq`); imutável. `011` e `012` também aplicadas e imutáveis; a próxima migração é a `013`.
- `packages/dominio/src/crm/` — `canais.ts` (`proximaConexao`, `AcaoDeConexao`), `mensagens.ts` (`AnexoDaMensagem`, `validarNovaMensagem`, `statusInicialDeEnvio`), `conversas.ts` (`TIPO_DE_IDENTIFICADOR_DO_CANAL`), `capacidades.ts` (`ProvedorDeCanal`, `sendableMediaTypes`), `normalizacao.ts` (`normalizarIdentificadorDeContato`, `normalizarWhatsapp`), `permissoes.ts` (`exigir`, `AcaoCrm`).
- `apps/api/src/servicos/crm/mensagens.ts` (`enviar`, `registrarRecebida`), `servicos/crm/conversas.ts`, `servicos/crm/canais.ts`, `servicos/crm/acesso.ts` (`exigir`) e `servicos/crm/transacao.ts` (`comTransacao`).
- `apps/api/src/repositorios/crm/mensagens.ts` (`obterPorIdExterno`, `inserirRecebida`), `repositorios/crm/contatos.ts` (`detentorDoIdentificador`), `repositorios/crm/canais.ts` (`definirConexao`), `repositorios/crm/referencias.ts` (`avancarRevisaoDoEspaco`).
- `apps/api/src/rotas/crm/canais.ts` — `POST /canais/:id/simular-conexao`, a única conexão de hoje.
- `ontologia/03-crm/caixa-de-entrada-e-mensageria.md` — contrato da Caixa: RN-CXE-09 (reabertura), RN-CON-13 (Contato arquivado volta a `ativo`), INV-CXE-05 e INV-CXE-07.

### Fila, workers, cofre e mídia (os moldes)
- `apps/api/src/persistencia/outbox-worker.ts` e `outbox.ts` — o molde de reivindicar com `for update skip locked`, backoff e `EVENTOS` (o novo evento `mensagem.enviar.v1` entra aqui); `apps/api/src/index.ts` — onde os workers sobem por variável de ambiente.
- `apps/api/migracoes/009-seguranca-e-cofre.sql` — `plataforma.credenciais` (AES-256-GCM, `COFRE_CHAVE`) para o segredo do webhook e a chave da instância; o cofre nunca devolve segredo por rota.
- `apps/api/src/servicos/storage-uploads.ts` (`TIPOS_ACEITOS`, `assinaturaConfereComTipo`, `abrirSessaoDeUpload`, `confirmarObjeto`, `coletarOrfaos`, `urlDeDownload`) e `apps/api/src/rotas/anexos-da-tarefa.ts` — o molde do upload em duas fases para Mensagem; `apps/api/src/rotas/formularios-publicos.ts` — o Formulário continua com a lista de hoje.
- `apps/api/src/testes/servidor-falso.ts` — o servidor falso para testar o cliente da Evolution sem rede.

### Webhooks existentes e borda de produção
- `apps/api/src/rotas/webhook-meta.ts` — fica como está (D-16-07); mostra o molde de rota pública (`config: { publica: true }`) e de conferência de assinatura em tempo constante.
- `apps/api/deploy/nginx-n1-crm-api.conf`, `n1-crm-limites.conf`, `provar-nginx.sh` e `deploy/CONTEXT.md` — limite de taxa e mascaramento só em `/v1/public/`; o arquivo da VM é a fonte depois do certbot e as mudanças vão à mão.
- `apps/api/deploy/evolution/` (`docker-compose.yml`, `evolution.env.example`, `nginx-evolution.conf`, `preparar-vps-evolution.sh`) e `apps/api/.env.example` (seção do cofre, `COFRE_CHAVE`); `EVOLUTION_URL` e `EVOLUTION_API_KEY` entram no `.env.example` como a 4.1.2 prevê.

### Interface (o que a tela já tem)
- `apps/web/src/dados/store.ts` (`AcompanhanteDaRevisao`, `INTERVALO_DA_REVISAO_MS`) — onde o canal SSE se monta; `apps/web/src/dados/crm/conversas.ts`, `mensagens.ts` (`useMensagens`, `enviarMensagem`), `tarefas-conversacionais.ts` — as chaves que o tempo real invalida.
- `apps/web/src/features/crm/conversation-thread.tsx` — o fio e o compositor; `apps/web/src/dados/envio-ao-bucket.ts` — o upload por URL assinada que a 3.9.5 reaproveita.

### Operação de produção
- Memória `deploy-da-api-e-manual-na-vm` e `apps/api/deploy/publicar.sh` — a API é publicada à mão na VM; a unidade systemd fixa `OUTBOX_WORKER_ATIVO=false` e outras três variáveis e ganha do `api.env`: ligar `MENSAGERIA_WORKER_ATIVO` pede um drop-in como root. O nginx da VM e o `api.env` só o dono edita.
- `docs/09-planejamento/dados/andamento.mjs` — entradas 1.7.2, 1.7.3 e 1.7.5: sem homologação, sem backup diário ligado e o servidor da Evolution na VPS aberto à época da Fase 9.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `reivindicar`, `backoff` e o laço do `outbox-worker.ts`: o molde do `processador-de-entrada.ts` e do segundo worker da saída (`tiposDeEvento` e `entregador` injetáveis).
- `obterPorIdExterno` e o índice `mensagens_id_externo_uq` em `(workspace_id, canal_id, id_externo)`: a idempotência do recebimento já existe no banco.
- `detentorDoIdentificador` e `normalizarIdentificadorDeContato`: achar o Contato pelo Identificador, sem código novo de busca.
- `abrirSessaoDeUpload`, `confirmarObjeto` e `urlDeDownload` de `storage-uploads.ts`, mais `envio-ao-bucket.ts` na web: o upload em duas fases para a Mensagem.
- `executarGestoMisto` e `comTransacao`: gravar a Mensagem e o evento de outbox no mesmo cliente.
- O cofre (`plataforma.credenciais`, `COFRE_CHAVE`) e `criarServidorFalso` para os testes do cliente da Evolution.
- O botão "Simular conexão" e `POST /canais/:id/simular-conexao`: marcam o Canal simulado que o provedor de teste usa (D-16-03).

### Established Patterns
- Domínio primeiro, depois a api, depois a tela; o domínio não conhece ninguém e a web e a api nunca se importam.
- Migrações numeradas e imutáveis; `npm run migrar -w @n1/api -- --seco` lista o que faria sem escrever. A `013` só entra em produção por publicação manual, quando o dono mandar.
- Testes de persistência pulam sem `DATABASE_URL` e rodam contra Postgres 16 em Docker local; o gate é `npm run check` em Docker (memória `gsd-gate-de-testes-baseline`). Flakes de baseline: `outbox-worker.test.ts` h a k e `colunas-geradas.test.ts`.
- Rotas públicas marcam `config: { publica: true }` e conferem a origem em tempo constante (`webhook-meta.ts`); o evento de outbox tem payload pobre, só ids, validado por zod `strict`.
- O payload de `avisarCrm` e do `mensagem.enviar.v1` não leva texto nem telefone, como os outros eventos.

### Integration Points
- `ServicoDeMensagens.enviar` ganha o `gravarEventos` no mesmo cliente; `registrarRecebida` sai da interface e vira o passo 4 de `receberMensagem`.
- `GET /estado/revisao` e o `AcompanhanteDaRevisao` seguem como o recurso quando o SSE cai; o SSE soma ao lado, não os substitui.
- `index.ts` ganha o worker de entrada e o de saída (`MENSAGERIA_WORKER_ATIVO`) e a coleta de órfãos (`COLETA_DE_ORFAOS_ATIVA`).
- A Sessão 5 (Tarefa conversacional) e a Sessão 16 (Agente) usam o retorno de `receberMensagem` (`contatoNovo`, `conversaNova`, `conversaReaberta`, `repetida`).
- O `corpo` de `webhooks_recebidos` tem dado pessoal real a partir da prova ao vivo; as linhas `processado` só são apagadas pela retenção da Sessão 19, e o backup diário **não está ligado** (09-18 pulado): fazer backup manual antes de aplicar a `013` em produção.

</code_context>

<specifics>
## Specific Ideas

- A prova que o dono quer ver é com a Evolution dele: mandar texto e áudio de um celular e vê-los aparecer na Caixa de outra aba em menos de 2 s, o áudio tocando, e responder pela Caixa e receber no celular. O provedor de teste serve ao CI e à demonstração em Canal simulado; não é o critério de aceite do dono.
- **Ação do dono antes da prova ao vivo** (para o plano nomear como checkpoint humano): escolher o número a conectar (não o `numeropvmarcos`; a API não oficial vai contra os termos do WhatsApp e um número pode ser bloqueado), conectar esse número na instância da Evolution, e passar `EVOLUTION_URL` e `EVOLUTION_API_KEY`. Confirmar que o painel da Evolution está atrás de HTTPS e fechado para fora (SEG-11, que a Fase 9 deixou aberto).
- Decisões em linguagem de produto: o que se vê na tela e o que muda para quem usa; o código só nos detalhes técnicos.

</specifics>

<deferred>
## Deferred Ideas

- Aviso de mensagem nova na tela (toast, som, título da aba piscando, preferências por Membro) — só as listas se atualizam nesta fase (D-16-02).
- Gravar áudio pelo microfone na Caixa de Entrada — só anexar arquivo agora (D-16-10); precisa de permissão do navegador e de converter para um formato que o WhatsApp toque como mensagem de voz (o Chrome grava WebM, não OGG).
- QR code e "Conectar" na ficha do Canal, `CONNECTION_UPDATE` e conferência periódica, tiques e reações vindos da Evolution, edições e mensagens apagadas, o nono dígito do número brasileiro, vários números e tirar "Simular conexão" da produção — Sessão 4.
- Encaixar os webhooks da Meta (WhatsApp oficial e Instagram) na rota por Canal e na fila de entrada, com o aperto de mão GET — Sessões 7 e 8 (D-16-07).
- Os avisos do Financeiro passarem a sair por um Canal daqui em vez do `automation/` — decisão 4.5.2, Sessão 4.
- Política de retenção do `corpo` de `webhooks_recebidos` e da mídia guardada — Sessão 19.
- Montar a homologação e ligar o backup diário do banco (1.7.2 e 1.7.3) — decisão de infra do dono, fora desta fase.

</deferred>

---

*Phase: 16-base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia*
*Context gathered: 2026-11-09*
