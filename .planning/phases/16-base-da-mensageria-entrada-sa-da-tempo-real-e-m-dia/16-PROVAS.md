# Fase 16 — Provas (pré-voo e prova ao vivo)

Registro de 16-15 e 16-16. Sem telefone, nome, texto de mensagem, chave, token nem endereço real: só versões, horários,
estados, contagens e milissegundos. O roteiro que foi seguido está em `16-PROVA-AO-VIVO.md`.

**SHA publicado:** `74554ab` (API na VM, `REVISION` conferida, e `main` do `n1-tecnologia/crm`, deploy da Vercel verde),
em 2026-11-10. Antes dele a API esteve em `b7ffeea` (2026-11-09); o `74554ab` só corrige um teste que quebrava o `check`
do CI sem banco.

## Como a prova foi feita (desvios do plano 16-16)

O plano 16-16 (D-16-04, D-16-05) diz que a publicação e a prova são só do dono e que o executor não roda nada contra
produção. **Não foi assim**, por pedido escrito do dono ("deploya no VM a API e de um deploy lá no github no branch main
... que eu vou testar em prod direto"), e depois com o acesso que ele deu ao usuário de deploy da VM:

| Ação | Quem fez |
|---|---|
| `publicar.sh` da API (que roda `migrar` e `banco:conceder` na VM) e `git push` da `main` da web | assistente, a pedido do dono |
| `EVOLUTION_URL` e `API_URL_PUBLICA` no `api.env` da VM (usuário de deploy, dono do arquivo) | assistente |
| drop-in `mensageria.conf` (`MENSAGERIA_WORKER_ATIVO=true`, `COLETA_DE_ORFAOS_ATIVA=true`), `daemon-reload`, `restart` | **dono**, como root |
| criar o Canal "WhatsApp não oficial" na tela de produção | **dono** |
| `canal:ligar-evolution` (`--seco` e depois real), na VM, com a chave global lida da entrada padrão | assistente, a pedido do dono |
| mensagens do celular, conferência no aparelho | **dono** |

O backup manual do schema `plataforma` antes da `013` (passo 9, T-16-58) **foi recusado pelo dono** ("sem backup"). A `013`
é aditiva e entrou sem backup; voltar a API ao `20b4d01` é possível, voltar a `013` não (seria uma `014`).

## Pré-voo

| Item | Resultado |
|---|---|
| Versão da Evolution | `2.4.0` (o adaptador foi lido da `2.3.7`). Licença `active`. Decisão do dono (2026-11-09): seguir na `2.4.0` |
| Instância de teste | `igor-dev`, Baileys, `open`, número de teste do dono. Nunca a `numeropvmarcos` |
| SEG-11 (painel atrás de HTTPS, porta 8080 fechada) | HTTPS `200`, http `301` para https, porta 8080 por fora recusada. Aviso: o `SERVER_URL` da Evolution está em http |
| `evolution.env` | `DATABASE_SAVE_DATA_INSTANCE=true` (a instância sobrevive a reinício); `AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES=false`, mas na `2.4.0` o `fetchInstances` por nome devolve o token da instância mesmo assim, e o token autentica |
| `tempo-real:provar` pelo pooler de produção (A9) | **provado em 2026-11-10**: papel `n1_api`, porta 5432, `recebido_em_ms` = 52, 53, 52 (três voltas). O pooler em modo sessão entrega `LISTEN/NOTIFY` |
| `canal:ligar-evolution --seco` | ok: Evolution `2.4.0`, instância `open`, número confere (tolera o nono dígito), webhook montado no endereço público da API |
| A10 (`2.4.0` aceita o `webhook/set` e o `connectionState` que o adaptador usa) | provado: o `--seco` e o comando real fecharam sem erro |

## Prova ao vivo

| Passo do roteiro | Resultado |
|---|---|
| 9 backup do schema | **não feito** (recusado pelo dono) |
| 10 `migrar --seco` | listou só a `013` pendente (a primeira tentativa deu tempo esgotado e a segunda respondeu) |
| 11 `migrar` e `banco:conceder` | aplicados pelo `publicar.sh` na VM ("Nada a aplicar" na segunda publicação, em `74554ab`) |
| 12 variáveis no `api.env` | `EVOLUTION_URL` e `API_URL_PUBLICA` presentes (contagem 2, sem duplicata, modo `600`) |
| 13 publicar a API | `74554ab` no ar em `127.0.0.1:3020`; `/saude` público `ok` |
| 14 drop-in e workers | o journal do boot mostra, às 16:30 UTC: "ouvinte do tempo real ativo" e "conectado", "processador de entrada da mensageria ativo", "worker de saída da mensageria ativo" e "coleta de órfãos ativa". O `restart` estourou o `TimeoutStopSec=20` e o systemd matou o processo antigo com SIGKILL (as conexões do fluxo de eventos seguram o desligamento); o serviço subiu limpo |
| 15 SSE atrás do nginx (`: aberto` na hora) | **não conferido diretamente** (exige o token de login do dono). Indício: o ouvinte conectou e a prova de 52 ms passa; a tela ainda tem a releitura de 5 s como reserva, então "a Mensagem apareceu" não distingue as duas vias |
| 16 web e Canal | web em `74554ab` (Vercel verde); Canal "Igor Business" ligado à `igor-dev` (webhook apontado, segredo e token no cofre, fila com 0 pendentes) |
| 17 duas abas | **o dono não cronometrou nem relatou separadamente**; relato geral: "testei imagem, áudios e textos, tudo funcionando" |
| 18 texto do celular | **funcionou** (Mensagem e Contato criados sozinhos, Conversa aberta). Tempo até as abas: **não medido**. Processamento no servidor: ver abaixo |
| 19 áudio de voz | **funcionou** (relato do dono; o navegador da captura foi o Chrome; Safari não testado). Tempo até as abas: não medido. Processamento no servidor: 2,28 s |
| 20 `mensageria.etapas` | **não coletado**: o `sudoers` do usuário de deploy só deixa ler as últimas 80 linhas do journal, que a releitura da tela enche. No lugar, o tempo de `recebido_em` a `processado_em` de cada webhook, direto da tabela |
| 21 responder pela Caixa | texto: **chegou ao celular** (dono confirmou) e saiu como "Enviada"; imagem: **chegou** (relato do dono) |
| 22 chamadas ignoradas | **nenhuma `ignorado:sem_numero` e nenhuma `falhou`**: 5 webhooks, todos `processado`, 1 tentativa cada. A Evolution `2.4.0` mandou o número normal, não `@lid` |

### Tempos medidos no servidor (de `recebido_em` a `processado_em`)

| Tipo (`messages.upsert`) | Processar | Atraso da Evolution até a API |
|---|---|---|
| texto | 1,09 s | ≤ 1 s (o carimbo da Evolution tem resolução de 1 s) |
| áudio | **2,28 s** | ≤ 1 s |
| texto | 1,04 s | ≤ 1 s |
| imagem | 1,80 s | ≤ 1 s |
| figurinha | 1,72 s | ≤ 1 s |

Ponta a ponta (do toque no celular à aba) soma a isso o atraso da Evolution e o tempo real (abaixo de 1 s): o texto fica
perto de 2 s e o áudio perto de 3 s. **Esses números são estimativa a partir do servidor, não cronômetro na tela.** Boa
parte do 1 s do texto é ida e volta ao banco, com a API na VM longe do Supabase (Fase 13, passo 3, ainda aberto).

Nenhum eco `fromMe` apareceu em `webhooks_recebidos` para o que o dono enviou pela Caixa: o status "Enviada" é o do CRM
(o 201 do envio), não o tique de entrega, que é da Sessão 4.

## Decisão do áudio

Open Question 1 do plano 16-16 (Task 2). O áudio passou de 2 s no servidor (2,28 s, contra 1,04 a 1,09 s do texto), e a
estimativa ponta a ponta é de cerca de 3 s. **Decisão do dono (2026-11-10): `aceitar-audio-ate-3s`.** Sem código novo e sem
nova publicação; a ordem "baixar antes da transação" (D-16-08) continua como está. O motivo: o ganho de reabri-la é de
cerca de 1 s só no áudio, e o custo dominante é a distância da API ao banco, que a Fase 13 (passo 3) ataca para texto,
imagem e áudio de uma vez. O critério de 2 s da fase vale para o texto; para o áudio vale até 3 s.

## O que fica para a Sessão 4

Tudo marcado `OPT-OUT` na `COVERAGE.md` segue com a Sessão 4: o botão "Conectar" e o QR code na tela (hoje a instância é
criada e conectada na própria Evolution e o Canal é ligado por `canal:ligar-evolution`), a mensagem digitada no celular
(`fromMe`), o status de entrega e leitura (`MESSAGES_UPDATE`), o evento de conexão e a conferência periódica, o nono
dígito no recebimento, o tratamento de `@lid` sem número, reações, edições, revogações, mensagem citada, vários números e
grupos (Sessão 6). Esta prova viu a figurinha ser processada sem erro, mas ela não estava no escopo de D-16-04.

## O que continua aberto (do dono ou de depois)

- **Prova formal dos 2 s nas duas abas** (passo 17 e 18 com cronômetro) e do **fluxo `/eventos` atrás do nginx** (passo 15):
  o relato "tudo funcionando" não as separa da releitura de 5 s. A verificação da fase fica `human_needed` por isso.
- **Rotacionar a chave global da Evolution** (`AUTHENTICATION_API_KEY`): foi colada na conversa. Reiniciar a Evolution é seguro.
- Trocar o `SERVER_URL` da Evolution para https.
- O `deploy-api` do GitHub segue vermelho por `VPS_HOST` vazio (conhecido; aborta antes de qualquer SSH).
- O desligamento do serviço leva SIGKILL por causa das conexões do fluxo de eventos abertas (`TimeoutStopSec=20`).
- `DATABASE_SSL_INSECURE=true` e o papel `postgres.<projeto>` no `.env` do notebook; o login por senha de root na VM.
- Sem backup do schema `plataforma` antes da `013`.
