---
phase: "16"
slug: "base-da-mensageria-entrada-sa-da-tempo-real-e-m-dia"
status: open
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 1
asvs_level: 1
block_on: high
register_authored_at_plan_time: true
created: "2026-11-10"
---

# Phase 16 — Security

> Contrato de segurança da fase: registro de ameaças, riscos aceitos e trilha de auditoria.
> Verificação retroativa (`/gsd-secure-phase 16`) sobre o código em HEAD, com a prova ao vivo de `16-PROVAS.md`
> (API em `74554ab`). Só leitura de código e documentos: nenhum teste foi executado e nada foi tocado em produção.

**Veredito: OPEN_THREATS.** 62 ameaças (T-16-01 a T-16-61 mais T-16-SC, que se repete em todos os planos): 60 fechadas,
2 abertas. **Uma é bloqueante** (severidade `high`, `threats_open: 1`): T-16-55 (rotação da chave global da Evolution),
de processo, nenhuma de código. A outra, T-16-28 (`medium`), é um defeito de código abaixo do limiar e não bloqueia.
T-16-58 estava aberta na auditoria de 2026-11-10 e foi fechada por aceite do dono no mesmo dia (R-16-04).

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| evento do provedor → `receberMensagem` | dado de terceiro entra no CRM | número, nome, texto de cliente |
| internet → `POST /webhooks/mensageria/:canalId` | rota pública; só o segredo do Canal autentica | corpo do webhook, pessoal |
| `webhooks_recebidos.corpo` | corpo cru guardado até a retenção da Sessão 19 | dado pessoal de terceiro |
| chamada de fora → provedor de teste; operador → `canal:segredo-de-teste` | só o segredo do Canal autentica; o comando usa `COFRE_CHAVE` | segredo do webhook |
| Mensagem → `integration_outbox` | o evento sai por outro processo | ids (sem texto) |
| `apps/api` → provedor / Evolution | a Mensagem e a chave da instância saem para a rede | texto, mídia, chave da instância |
| `apps/api` → aba (SSE); banco → ouvinte `LISTEN` | fluxo longo autenticado só na abertura; NOTIFY de todos os Espaços | tipo e ids do evento |
| navegador → `GET /eventos` | o token do Supabase viaja num pedido longo | JWT |
| navegador → bucket (URL assinada); api → navegador (URL de download) | bytes sem passar pela api; URL dá acesso enquanto vale | arquivos de cliente |
| provedor → `apps/api` (mídia); coleta → bucket | bytes de terceiro; a coleta apaga objetos | mídia, objetos do bucket |
| dado do cliente (nome do arquivo, legenda) → fio | texto de terceiro desenhado na tela do atendente | texto não confiável |
| operador → `canal:ligar-evolution`; `apps/api` → Evolution | usa a chave global e a `COFRE_CHAVE`; muda o webhook de uma instância de produção | chave global, token da instância |
| repositório → quem lê a documentação | `.env.example` e `CONTEXT.md` são públicos para quem tem o repositório | variáveis, exemplos |
| notebook do dono / dono → produção e Evolution | pré-voo, migração, publicação, drop-in e webhook | credenciais, dado pessoal real |

---

## Threat Register

Caminhos relativos a `apps/api/src/` salvo indicação (`dominio/` = `packages/dominio/src/`, `web/` = `apps/web/src/`).

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-16-01 | Tampering | Espaço da Mensagem recebida | high | mitigate | Espaço vem do Canal de quem chama, nunca do corpo (`servicos/crm/recebimento.ts:157`, `dominio/crm/recebimento.ts:33`); `workspace_id = $1` em `repositorios/crm/{canais,contatos,mensagens}.ts`; teste de outro Espaço dá 404 (`recebimento.test.ts:177`) | closed |
| T-16-02 | Information Disclosure | `conteudo`, telefone e `cargaBruta` em log | medium | mitigate | zero `console`/`log` em `servicos/crm/recebimento.ts` e `dominio/crm/recebimento.ts`; cabeçalho "este módulo não loga" | closed |
| T-16-03 | Tampering | Mensagem no Contato errado | high | mitigate | só `detentorDoIdentificador` com valor normalizado, igualdade exata (`recebimento.ts:198`, `repositorios/crm/contatos.ts:444`); sem tolerância de variante (`dominio/crm/normalizacao.ts:57`) | closed |
| T-16-04 | Spoofing | provedor de teste usado por Canal real | high | mitigate | `mensageria/registro.ts:43` só o devolve com `conexaoSimulada`; `enviar` recusa Canal real (`provedores/teste.ts:131`) | closed |
| T-16-05 | Information Disclosure | segredo do webhook ou credencial em log ou resposta | high | mitigate | segredo só no `stdout`, uma vez (`bootstrap/canal-segredo-de-teste.ts:147`); contrato (f) procura o segredo em resultados e erros (`mensageria/contrato-do-provedor.ts:115`); logs da rota só com `canalId`/desfecho | closed |
| T-16-06 | Spoofing | segredo fixo de teste | high | mitigate | sem constante de segredo (`randomBytes(32)`); o provedor recusa sem `segredoDoWebhook`; `timingSafeEqual` sobre SHA-256 (`provedores/teste.ts:85`) | closed |
| T-16-07 | Spoofing | webhook forjado injeta mensagem | high | mitigate | segredo do cofre por `canalParaProvedor`, provedor resolvido só pelo Canal, comparação em tempo constante (`rotas/webhooks-de-mensageria.ts:138`; `webhooks-de-mensageria.test.ts:92`) | closed |
| T-16-08 | Information Disclosure | enumeração de Canais pela resposta ou pelo tempo | medium | mitigate | a mesma 401 para as seis causas, sem `www-authenticate`, Canal ambíguo vira 401 (`webhooks-de-mensageria.ts:60,124`); ver risco residual 3 (tempo no ramo do cofre) | closed |
| T-16-09 | Denial of Service | enxurrada no webhook | high | mitigate | limite por IP antes do banco (429), `bodyLimit` 2 MiB (413), um `insert` por chamada (`webhooks-de-mensageria.ts:58,63,154`); `TRUST_PROXY` na unidade systemd | closed |
| T-16-10 | Information Disclosure | `corpo`, `apikey` ou segredo em log ou guardado | high | mitigate | `semApikey` antes do `insert` (`webhooks-de-mensageria.ts:71,158`); sem log de corpo/cabeçalho; `ultimo_erro` por `sanitizarErro` (`processador-de-entrada.ts:350`) | closed |
| T-16-11 | Tampering | retentativa do provedor ou do worker duplica | medium | mitigate | `webhooks_recebidos_chave_uq` (`migracoes/013-mensageria.sql:63`) + `on conflict do nothing`; `receberMensagem` idempotente; trava vencida volta uma vez (`processador-de-entrada.ts:150`) | closed |
| T-16-12 | Elevation of Privilege | rota pública herdando ou furando o JWT | high | mitigate | plugin irmão fora de `rotasDeCrm` (`app.ts:283`); `publica: true` só em `webhooks-de-mensageria.ts:105`; inventário de rotas exige o motivo (`seguranca/inventario-de-rotas.test.ts:54,194`) | closed |
| T-16-13 | Tampering | worker antigo consome `mensagem.enviar.v1` e a marca `failed` | high | mitigate | padrão exclui `mensagem.%` (`persistencia/outbox-worker.ts:219,365`); teste com as duas linhas (`outbox-worker.test.ts:277`) | closed |
| T-16-14 | Information Disclosure | texto ou telefone no payload do outbox | medium | mitigate | schema `.strict()` com três ids (`persistencia/outbox.ts:76`), `parse` antes do `insert`; teste de chaves exatas (`servicos/crm/mensagens.test.ts:157`) | closed |
| T-16-15 | Repudiation | Mensagem sem evento ou evento sem Mensagem | high | mitigate | `enfileirarEnvio`/`reenfileirarEnvio` recebem o `PoolClient` da transação (`mensageria/fila-de-saida.ts:35`); teste de rollback (`mensagens.test.ts:176`) | closed |
| T-16-16 | Tampering | reenvio automático duplica a Mensagem ao cliente | high | mitigate | ambíguo e exceção em `enviar` viram `falhou` sem reenvio (`mensageria/entregar-mensagem.ts:210,221`); Evolution classifica timeout como `ambiguo` (`evolution/provedor.ts:79`); testes `entregar-mensagem.test.ts:124,140`; ver risco residual 1 (falha do banco logo após o ambíguo) | closed |
| T-16-17 | Information Disclosure | `apikey` ou corpo do provedor em `last_error_summary`/`motivo_falha` | high | mitigate | `sanitizarErro` com padrão `apikey` (`persistencia/outbox-worker.ts:99,113`); frases fixas; testes `outbox-worker.test.ts:54`, `entregar-mensagem.test.ts:224` | closed |
| T-16-18 | Denial of Service | linha presa em `delivering` depois de queda | medium | mitigate | `recuperarTravasVencidasMs` de 2 min (`entregar-mensagem.ts:248`, `outbox-worker.ts:353`); testes `outbox-worker.test.ts:402`, `entregar-mensagem.test.ts:201` | closed |
| T-16-19 | Tampering | envio para o Identificador de outro Contato | high | mitigate | destino lido por `workspace_id` + `contato_id` da Conversa (`entregar-mensagem.ts:142,162`, `servicos/crm/conversas.ts:469`); `e2e/mensageria.test.ts:118` | closed |
| T-16-20 | Elevation of Privilege | reenviar Mensagem de outro Espaço ou sem poder `enviar` | high | mitigate | `exigir(..., "enviar", "mensagem")` antes de tudo e `workspace_id` da sessão (`servicos/crm/mensagens.ts:311,318`); testes 401/403/404 em `rotas/crm/mensagens.test.ts:157,455-499` | closed |
| T-16-21 | Denial of Service | `23505` no reenfileiramento derruba o "Tentar de novo" | medium | mitigate | `on conflict ... do update` repetindo o predicado do índice parcial (`fila-de-saida.ts:83`, `013:77`); `e2e/mensageria.test.ts:179` | closed |
| T-16-22 | Tampering | status atrasado faz a Mensagem regredir | low | mitigate | `proximoStatusDeEntrega` só avança (`dominio/crm/mensagens.ts:256`), `for update` (`repositorios/crm/mensagens.ts:335`); testes de domínio e `processador-de-entrada.test.ts:364` | closed |
| T-16-23 | Spoofing | evento `conexao` forjado liga um Canal simulado | medium | mitigate | Canal simulado vira `ignorado:conexao_simulada` (`processador-de-entrada.ts:244`); evento só chega por webhook verificado; teste `:351` | closed |
| T-16-24 | Information Disclosure | evento de um Espaço chegando a outro | high | mitigate | `hub.publicar` entrega só ao `workspaceId` do evento (`mensageria/hub-de-eventos.ts:121`); testes com dois Espaços (`hub-de-eventos.test.ts:25`, `e2e/mensageria-tempo-real.test.ts:299`) | closed |
| T-16-25 | Elevation of Privilege | Membro removido ou token vencido mantém o fluxo | high | mitigate | Papel reconferido a cada 60 s (`hub-de-eventos.ts:51,80`), fluxo fecha em 45 min e 403 na abertura (`rotas/eventos.ts:34,43,56`); testes `hub-de-eventos.test.ts:73`, `rotas/eventos.test.ts:61,100` | closed |
| T-16-26 | Denial of Service | abas esquecidas, ouvinte travado, fila de NOTIFY cheia | medium | mitigate | 5 fluxos por Membro (`hub-de-eventos.ts:50,112`), handler do ouvinte sem I/O (`ouvinte-pg.ts:75`), batida de 25 s e corte acima de 64 KiB (`rotas/eventos.ts:33,82`) | closed |
| T-16-27 | Information Disclosure | texto, nome ou telefone no NOTIFY ou no SSE | high | mitigate | `lerEventoDoCrm` só aceita tipo e ids (`dominio/crm/eventos.ts:54`); `avisar.ts:23` é o único `pg_notify`; `workspaceId` não sai para a aba | closed |
| T-16-28 | Denial of Service | desligamento pendurado pelo fluxo aberto (SIGKILL aos 20 s) | medium | mitigate | `hub.encerrarTodos()` registrado em `aoEncerrar` (`index.ts:176`) e rodado antes do `app.close()` só na desmontagem da recarga (`index.ts:338`); **falta o SIGTERM de produção**: o ouvinte (`index.ts:144`) só chama `parar()` de cada worker, nunca `app.close()`, `encerrar()` do pool nem sai do processo. O `restart` de 2026-11-10 estourou o `TimeoutStopSec=20` e levou SIGKILL (`16-PROVAS.md:49,99`; `deferred-items.md`) | open — below high threshold (non-blocking) |
| T-16-29 | Information Disclosure | token na URL ou em log | medium | mitigate | token só no cabeçalho (`web/dados/tempo-real.ts:179`), sem `console`; log da api censura `authorization` (`observabilidade/log.ts:27`); teste `tempo-real.test.ts:137` | closed |
| T-16-30 | Denial of Service | tempestade de releituras por rajada de eventos | low | mitigate | agrupamento de 300 ms e chaves unidas (`tempo-real.ts:33,152`); teste `tempo-real.test.ts:284` | closed |
| T-16-31 | Tampering | MIME falso ou arquivo renomeado | high | mitigate | assinatura conferida no conteúdo (`servicos/storage-uploads.ts:228,451`, `mensageria/midia.ts:96`); teste "texto como .ogg recusado" (`storage-uploads.test.ts:153`) | closed |
| T-16-32 | Denial of Service | zip-bomb ou arquivo enorme | high | mitigate | ZIP lido só pelo diretório central, ZIP64 recusado (`storage-uploads.ts:184-219`); teto 16/25 MiB no ticket e na confirmação (`servicos/crm/mensagens.ts:371`, `storage-uploads.ts:445`); testes `:182-254` | closed |
| T-16-33 | Elevation of Privilege | anexo de sessão de outra Conversa ou Espaço | high | mitigate | corpo `.strict()` sem chave (`rotas/crm/mensagens.ts:44`); chave montada no servidor, sessão `conversa-<id>` do mesmo Espaço (`servicos/crm/mensagens.ts:241,381`); testes `rotas/crm/mensagens.test.ts:632,644,659` | closed |
| T-16-34 | Information Disclosure | download por quem não lê a Conversa | high | mitigate | `exigir(..., "ler", "mensagem")` e Mensagem do Espaço da sessão (`servicos/crm/mensagens.ts:390,395,404`); URL nova a cada pedido, TTL 5 min (`storage-uploads.ts:486`); testes `mensagens.test.ts:831,840,862` | closed |
| T-16-35 | Tampering | documento aberto no navegador (HTML/SVG/XML ativo) | medium | mitigate | documento sempre com `download` (`servicos/crm/mensagens.ts:408`, `storage-uploads.ts:486`), web usa link com `download` (`web/features/crm/anexo-da-mensagem.tsx:103`); testes `mensagens.test.ts:807,818`; ver risco residual 8 | closed |
| T-16-36 | Elevation of Privilege | Formulário público alargado por engano | medium | mitigate | `TIPOS_ACEITOS` intocado (`storage-uploads.ts:71`), lista da Mensagem separada; `formularios-publicos.test.ts:149` recusa áudio, vídeo e zip | closed |
| T-16-37 | Denial of Service | mídia enorme do provedor estoura a memória | high | mitigate | teto passado a `baixarMidia` e reconferido (`mensageria/midia.ts:90,96`); leitura em fluxo com corte (`evolution/cliente.ts:285`); testes `midia.test.ts:80`, `cliente.test.ts:149,154` | closed |
| T-16-38 | Tampering | SSRF por URL de mídia vinda no corpo | high | mitigate | `midia.ts` sem `fetch(`; o único HTTP de saída de `mensageria/` é `evolution/cliente.ts:162`, host fixo de `EVOLUTION_URL` | closed |
| T-16-39 | Tampering | coleta apaga objeto em uso | high | mitigate | só `entrada/` com mais de 1 h e não citado por Mensagem; sessões só expiradas; trava consultiva (`mensageria/coleta-de-orfaos.ts:69,98-114,126`); testes `coleta-de-orfaos.test.ts:84-163` | closed |
| T-16-40 | Information Disclosure | dado pessoal no log de etapas | medium | mitigate | `mensageria.etapas` só com id e números (`processador-de-entrada.ts:398`); teste proíbe telefone, nome e referência (`:567`) | closed |
| T-16-41 | Tampering | XSS por nome de arquivo ou legenda | high | mitigate | zero `dangerouslySetInnerHTML`/`innerHTML` nos componentes do fio; só texto do React; só URL http(s) vira `src`/`href` (`anexo-da-mensagem.tsx:34`); testes com nome hostil (`anexo-da-mensagem.test.tsx:123`, `conversation-thread.test.tsx:438`) | closed |
| T-16-42 | Tampering | tipo ou tamanho conferido só na tela | medium | mitigate | a tela só pré-confere (`web/dados/envio-ao-bucket.ts:28`); a api decide: tipo, Canal, teto, assinatura (`servicos/crm/mensagens.ts:243,264,364`); testes da api `mensagens.test.ts:694-735` | closed |
| T-16-43 | Spoofing | chamada com o segredo certo e a instância de outro Canal | high | mitigate | `verificarChamada` exige `instance` igual à da credencial (`evolution/provedor.ts:124`); segunda camada em `traduzir.ts:118`; testes `provedor.test.ts:74`, `e2e/mensageria-evolution.test.ts:159` | closed |
| T-16-44 | Information Disclosure | `apikey` em erro, log, `cargaBruta` ou `last_error_summary` | high | mitigate | `ErroDaEvolution` sem chave nem corpo (`evolution/cliente.ts:22`), `semApikey` na `cargaBruta` (`traduzir.ts:27,145`), `sanitizarErro`; testes em que o servidor ecoa a chave (`cliente.test.ts:342`) | closed |
| T-16-45 | Tampering | `fromMe`, grupo ou status virando Contato e Conversa fantasma | medium | mitigate | lista de permitidos e motivos de ignorar (`traduzir.ts:124-174`); evento `ignorado` só anota o resultado (`processador-de-entrada.ts:302`); `exemplos/ignorados.json` (8 casos) | closed |
| T-16-46 | Denial of Service | base64 de mídia enorme na memória | high | mitigate | leitura em fluxo com corte em `teto × 4/3 + 64 KiB` e `leitor.cancel()` (`evolution/cliente.ts:285-318`); testes `cliente.test.ts:149,154` | closed |
| T-16-47 | Tampering | SSRF pela `url` da mídia do WhatsApp | medium | mitigate | ponto único de `fetch` com `EVOLUTION_URL` fixo; `traduzir.ts` nunca lê `url`; instância com `encodeURIComponent`; ver risco residual 5 (sem teste de regressão com `url` hostil) | closed |
| T-16-48 | Tampering | ligar a instância reservada do Financeiro e quebrá-lo | high | mitigate | recusa em `lerArgumentos` antes de qualquer I/O, sem diferença de caixa e espaço, e de novo em `ligarCanalAEvolution` (`bootstrap/canal-ligar-evolution.ts:40,80,114,205`); testes `canal-ligar-evolution.test.ts:55,250,280` | closed |
| T-16-49 | Spoofing | instância conectada a outro número ligada ao Canal | high | mitigate | `conferirNumeroConectado` antes do `webhook/set` (`dominio/crm/canais.ts:187`, `canal-ligar-evolution.ts:230`); testes `canal-ligar-evolution.test.ts:371`, `dominio/crm/canais.test.ts:150` | closed |
| T-16-50 | Information Disclosure | chave global, token ou segredo na saída do comando | high | mitigate | resumo só com nome, Espaço, instância e final do número (`canal-ligar-evolution.ts:143,320`); testes procuram chave global, token e 64 hex na saída (`canal-ligar-evolution.test.ts:186,403`) | closed |
| T-16-51 | Elevation of Privilege | chave global guardada por Canal | high | mitigate | só o token da instância vai ao cofre; sem token, recusa (`canal-ligar-evolution.ts:219,278`); testes `canal-ligar-evolution.test.ts:208,217,359` | closed |
| T-16-52 | Tampering | Canal `conectada` sem webhook (falha no meio) | medium | mitigate | `webhook/set` antes da transação; falha nele não grava nada; banco fora depois vira `FalhaDepoisDoWebhook` (`canal-ligar-evolution.ts:55,248-294`); testes `:403,418,441` | closed |
| T-16-53 | Information Disclosure | segredo, chave ou telefone real em documento | high | mitigate | varredura de HEAD nos documentos e modelos da fase (`.env.example`, `CONTEXT.md` das camadas, `deploy/`, roteiro e provas): sem telefone, `apikey`, JWT nem cadeia de 64 hex; só placeholders e o exemplo fictício antigo do seed (`dominio/CONTEXT.md:53`) | closed |
| T-16-54 | Elevation of Privilege | worker ligado em produção sem decisão do dono | medium | mitigate | a unidade fixa `MENSAGERIA_WORKER_ATIVO=false` e `COLETA_DE_ORFAOS_ATIVA=false` (`apps/api/deploy/n1-crm-api.service:42-43`); só um drop-in como root liga, e foi o dono quem o criou (`16-PROVAS.md:20`) | closed |
| T-16-55 | Information Disclosure | chave, token, senha ou telefone colados na conversa ou no roteiro | high | mitigate | os controles de código existem (comandos não imprimem segredo, T-16-50; roteiro só pede versões, contagens e ms; varredura limpa). **Mas o controle humano falhou**: a chave global da Evolution foi colada na conversa (`16-PROVAS.md:96`, `deferred-items.md`), e a rotação segue pendente. Falta: rotacionar `AUTHENTICATION_API_KEY` da Evolution, reiniciá-la e registrar a data aqui | open |
| T-16-56 | Elevation of Privilege | painel da Evolution aberto para fora (SEG-11) | high | transfer | conferência do dono no pré-voo, provada em 2026-11-09: HTTPS 200, http 301 para https, porta 8080 por fora recusada (`16-PROVAS.md:34`; `16-PROVA-AO-VIVO.md:57`). Infra do dono; resta trocar o `SERVER_URL` para https | closed (transferred) |
| T-16-57 | Denial of Service | evento preso no buffer do nginx | medium | mitigate | `x-accel-buffering: no` na resposta do SSE (`rotas/eventos.ts:56`); caminho provado no nginx de Docker (`apps/api/deploy/provar-nginx.sh`). A repetição na VM (passo 15) não foi conferida diretamente (`16-PROVAS.md:50`), e a releitura de 5 s da tela é a reserva | closed |
| T-16-58 | Tampering / Denial of Service | mudança em produção sem volta | high | mitigate | feitos: `migrar --seco` antes (`16-PROVAS.md:45`), seção "Se algo falhar" no roteiro, voltar a API a `20b4d01` possível. **Não feito: o backup manual do schema `plataforma` antes da `013`**, recusado pelo dono ("sem backup", `16-PROVAS.md:25`, `16-16-SUMMARY.md:100`); a `013` não tem desfazer. Dado pessoal real já entra em `webhooks_recebidos` e `mensagens`. Falta: backup agora do schema `plataforma` **ou** o dono registrar o risco no Accepted Risks Log. **O dono aceitou o risco em 2026-11-10 (R-16-04).** | closed (accepted) |
| T-16-59 | Tampering | executor agindo em produção | high | mitigate | desvio documentado: o assistente publicou, configurou e ligou o Canal em produção por pedido escrito do dono, que fez sozinho o que exigia root e o Canal na tela (`16-PROVAS.md:10-23`; `16-15-SUMMARY.md:130`; `16-16-SUMMARY.md:98`). Risco aceito pelo dono, ver R-16-01 | closed (accepted) |
| T-16-60 | Information Disclosure | `corpo` com dado pessoal guardado sem prazo | medium | accept | retenção é da Sessão 19 (`16-CONTEXT.md:21,145,166`); ver R-16-02 | closed (accepted) |
| T-16-61 | Denial of Service | número bloqueado pelo WhatsApp (API não oficial) | medium | accept | aviso do roteiro (`16-PROVA-AO-VIVO.md:34`): o dono escolhe o número que aceita perder, nunca o da instância do Financeiro; ver R-16-03 | closed (accepted) |
| T-16-SC | Tampering | instalação de pacote (repetida nos 16 planos) | low | mitigate | `git diff` de `fb6cb94^..HEAD`: `package.json` da raiz, de `apps/web` e de `packages/dominio` sem mudança; `apps/api/package.json` só ganhou três scripts (`canal:segredo-de-teste`, `canal:ligar-evolution`, `tempo-real:provar`), nenhuma dependência; `package-lock.json` sem diferença | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — só as ameaças abertas em `high` ou acima contam para `threats_open`*
*Disposition: mitigate (implementação necessária) · accept (risco documentado) · transfer (terceiro)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-16-01 | T-16-59 | O dono pediu por escrito que a API fosse publicada e testada em produção pelo assistente, com o acesso de deploy da VM; as ações que exigiam root e o Canal na tela ficaram com ele (`16-PROVAS.md`, "Como a prova foi feita") | dono (pedido escrito, registrado em `16-15-SUMMARY.md` e `16-PROVAS.md`) | 2026-11-09 |
| R-16-02 | T-16-60 | `webhooks_recebidos.corpo` guarda dado pessoal de terceiro até a política de retenção da Sessão 19; o backup diário não está ligado (`16-CONTEXT.md`) | dono (decisão de escopo, `16-CONTEXT.md`) | 2026-11-09 |
| R-16-03 | T-16-61 | A API não oficial (Baileys) contraria os termos do WhatsApp e o número pode ser bloqueado; o roteiro avisa e o dono escolheu o número de teste | dono (roteiro, passo 4.1.1) | 2026-11-09 |
| R-16-04 | T-16-58 | O dono recusou o backup manual do schema `plataforma` antes da `013` ("sem backup") e, perguntado em 2026-11-10 se queria registrar o risco como aceito ou fazer o backup, escolheu **aceitar**. Sabendo que: a `013` é aditiva e não tem desfazer (só uma `014`), voltar a API ao `20b4d01` é possível mas a `013` não volta, e dado pessoal real de WhatsApp já entra em `webhooks_recebidos` e `mensagens` sem backup anterior ao corte | dono (resposta direta na sessão de 2026-11-10; recusa original em `16-PROVAS.md`) | 2026-11-10 |

*Accepted risks do not resurface in future audit runs.*

**Não aceito, e por isso aberto:** T-16-55 (chave global colada na conversa, sem rotação). T-16-58 (sem backup antes da
`013`) foi aceita pelo dono em 2026-11-10 (R-16-04) e fechou.

---

## Riscos residuais (fora do registro)

Achados dos auditores que não são ameaças do registro e não mudam nenhum status acima. Nenhum tem prova de exploração.

1. **T-16-16, falha composta** (`mensageria/entregar-mensagem.ts:216,223`): `recusarEnvio` não tem a proteção que `gravarOAceite` tem. Se o banco falhar justamente ao gravar `falhou` depois de uma resposta ambígua, a exceção vira `tentar_de_novo` (`persistencia/outbox-worker.ts:336`), a Mensagem segue `pendente` e é reenviada. Estreito, mas fura a promessa "ambíguo nunca reenvia". O mesmo vale, por desenho, para a trava vencida (T-16-18): morrer entre o aceite do provedor e `gravarEnvio` reenvia (`entregar-mensagem.test.ts:201`). Também 429/502/503/504 contam como transitório (`evolution/provedor.ts:88`), e um 504 de proxy pode ter sido processado.
2. **T-16-28, causa:** o SIGTERM de produção não fecha o servidor. A correção é a mesma sequência da desmontagem (`Promise.all(paradas)`, `app.close()`, `encerrar()` do pool e saída do processo) mais um teste do SIGTERM, não só de `encerrarTodos()` + `close()`.
3. **T-16-08, tempo:** o ramo `catch` de provedor indisponível ou cofre que não decifra (`rotas/webhooks-de-mensageria.ts:147`) não roda a comparação de sombra; "Canal inexistente" e "Canal existente com segredo errado" ainda se distinguem pelo tempo. Corpo e status são idênticos.
4. **T-16-09, camadas:** o `limit_req` do nginx cobre só `/v1/public/` (`deploy/nginx-n1-crm-api.conf:32`); o teto de 300/min por IP em `/webhooks/mensageria` é em memória e por processo, e o nginx aceita corpo de até 26 MiB antes de a api recusar aos 2 MiB.
5. **Evolution, cliente HTTP:** `evolution/cliente.ts:162` não passa `redirect: "error"`, então um 3xx para outra origem levaria o cabeçalho `apikey`; nada obriga https em `EVOLUTION_URL` (`registro.ts:32`) e o `SERVER_URL` da Evolution está em http; `semApikey` na rota só limpa o topo do JSON; faltam testes de regressão de T-16-47 (`url` hostil no corpo) e do caso negativo de T-16-03 (variante do nono dígito gera Contato novo).
6. **Tempo real e deploy ao vivo:** `/eventos` atrás do nginx e as duas abas com cronômetro continuam sem prova direta (`16-PROVAS.md:94`); T-16-24 e T-16-25 foram provadas só por código e testes locais.
7. **Mídia:** a coleta de `entrada/` depende de a listagem do bucket trazer `created_at` (A12, sem conferência registrada); sem isso ela falha para o lado seguro e não apaga nada. `Content-Disposition: attachment` só foi provado com o armazenamento falso e pela leitura do `storage-js`; vale um `curl -I` numa URL assinada de PDF.
8. **Rota pública do Formulário (anterior à fase):** `emitirTicket` aceita o `submissionId` do cliente sem conferir que a sessão pertence ao Formulário que chamou; o id não é adivinhável e a lista de tipos continua a do Formulário.
9. **Infra do dono (já listada em `16-PROVAS.md`):** `DATABASE_SSL_INSECURE=true` e o papel `postgres.<projeto>` no `.env` do notebook; login por senha de root na VM; `deploy-api` do GitHub vermelho por `VPS_HOST` vazio.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-10 | 62 | 59 | 3 (2 bloqueantes, 1 abaixo do limiar) | `/gsd-secure-phase 16`: 4 `gsd-security-auditor` em paralelo (T-16-01 a 15, 16 a 30, 31 a 42, 43 a 52) e o orquestrador (T-16-53 a 61 e T-16-SC) |
| 2026-11-10 (depois do aceite R-16-04) | 62 | 60 | 2 (1 bloqueante: T-16-55; 1 abaixo do limiar: T-16-28) | orquestrador, a pedido do dono (aceite de T-16-58 registrado; sem nova varredura do código) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [ ] `threats_open: 0` confirmed (hoje `threats_open: 1`: T-16-55, a rotação da chave global da Evolution)
- [ ] `status: verified` set in frontmatter

**Approval:** pending (2026-11-10, aberta por T-16-55; T-16-28 entra no plano de lacunas `/gsd-plan-phase 16 --gaps`)
