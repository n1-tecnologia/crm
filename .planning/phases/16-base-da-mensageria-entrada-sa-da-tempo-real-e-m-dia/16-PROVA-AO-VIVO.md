# Fase 16 — Roteiro da prova ao vivo (D-16-04, D-16-05)

> **Só o dono roda este roteiro.** Nenhum agente roda estes passos por ele: eles mexem no banco de produção, na VM e na Evolution. Este arquivo foi escrito pelo plano 16-15 a partir de `16-CONTEXT.md`, `16-RESEARCH.md` (Open Questions 1 a 3, suposições A1, A6, A9 e A10), de `apps/api/deploy/CONTEXT.md` ("Mensageria (Fase 16)") e do comando `canal:ligar-evolution` do 16-13.
>
> **Regra de ouro: nenhum segredo vai para a conversa.** Chave da Evolution, token, senha, `DATABASE_URL`, `COFRE_CHAVE`, número de telefone e o token de login do CRM ficam no seu terminal. Quando o roteiro precisa de um segredo no terminal, ele manda lê-lo com `read -rs` (não aparece na tela nem no histórico). **Só voltam para a conversa** versões, contagens, milissegundos, "ok/falhou" por passo e as linhas de saída que o próprio passo diz que são seguras.
>
> **A instância `numeropvmarcos` é do Financeiro (`automation/`: extratos e avisos). É PROIBIDO usá-la aqui**, no QR, no Canal ou em qualquer comando. O comando `canal:ligar-evolution` a recusa sozinho, mas não confie só nele: escolha outro número e outra instância.
>
> Os valores entre `<…>` são seus. Nada aqui traz um valor real.

## Visão geral

| Parte | Quem | O que prova | Onde está |
|---|---|---|---|
| **Pré-voo** | dono, ainda sem publicar | que o pooler de produção entrega `LISTEN/NOTIFY` (A9), que a Evolution é a 2.3.7 (A1), que a instância devolve o token (A10) e que o número confere | passos 1 a 8 |
| **Publicação** | dono, na VM | a `013`, os workers ligados, o SSE passando pelo nginx da VM | passos 9 a 16 |
| **Prova** | dono, com o celular | texto e áudio do celular na Caixa em menos de 2 s, o áudio tocando, a resposta chegando ao celular | passos 17 a 22 |

Se o pré-voo (passos 1 a 8) mostrar algo que exige código (o pooler não entrega a notificação, a versão da Evolution é outra, a instância não devolve token, o número não confere), **pare**, cole o resultado na conversa e rode `/gsd-plan-phase 16 --gaps` antes de publicar. Não corrija no meio da prova.

Anote hora e resultado de cada passo nas linhas "Hora" e "Resultado".

---

## Pré-voo

Termina com o sinal de retomada do plano 16-15 (no fim desta seção). Nada aqui publica código nem liga worker.

### Passo 1 — Escolher o número e conectá-lo por QR na instância

1. Escolha o número de WhatsApp que será usado nos testes. **Nunca** o da instância `numeropvmarcos`.
2. Saiba o que está aceitando: a API não oficial (Baileys, dentro da Evolution) **vai contra os termos de uso do WhatsApp**, e um número pode ser bloqueado. Use um número que você aceite perder.
3. No painel `/manager` da Evolution (o endereço HTTPS dela, passo 2), crie uma instância nova (o nome é seu; **não** `numeropvmarcos`) e conecte o número lendo o QR pelo celular (WhatsApp → Aparelhos conectados).
4. Espere a instância mostrar **conectada** (`open`).

Conferir: o painel mostra a instância nova como conectada e o celular lista o aparelho.
Hora: ______  Resultado: ______

### Passo 2 — O painel está atrás de HTTPS e fechado para fora (SEG-11)

Do notebook (não precisa de chave):

```bash
# 1. HTTPS responde (esperado: 200 ou 301/302, nunca erro de certificado)
curl -sS -o /dev/null -w '%{http_code}\n' https://<dominio da Evolution>/
# 2. http redireciona para https (esperado: 301 e um endereço https)
curl -sS --max-time 8 -o /dev/null -w '%{http_code} %{redirect_url}\n' http://<dominio da Evolution>/
# 3. a porta 8080 NÃO responde de fora (esperado: 000, "Connection refused" ou tempo esgotado)
curl -sS --max-time 8 -o /dev/null -w '%{http_code}\n' http://<ip da VPS da Evolution>:8080/
```

Esperado: o 1 e o 2 respondem como descrito; o 3 **não conecta**. Se o 3 conectar, a Evolution está publicada em `0.0.0.0:8080` e o `docker-compose.yml` do repositório não foi o que subiu: é infra sua, corrija antes de seguir (`deploy/evolution/docker-compose.yml` publica só em `127.0.0.1:8080`).

Cole na conversa apenas: "SEG-11 ok" ou o que falhou (o código HTTP de cada um dos três).
Hora: 2026-11-09  Resultado: **SEG-11 ok** (rodado pelo assistente, a pedido do dono, só com `curl` sem chave): HTTPS `200`; http `301` para `https://`; porta 8080 por fora `000` (conexão recusada). Aviso: o campo `manager` da raiz aponta para `http://…/manager`, ou seja, o `SERVER_URL` da Evolution está em http (trocar para https).

### Passo 3 — A versão da Evolution

```bash
curl -s https://<dominio da Evolution>/
```

A resposta é um JSON curto (`status`, `message`, `version`, …). Anote **só o campo `version`**. A pesquisa leu a fonte da `2.3.7`, a mesma tag fixada no `docker-compose.yml`: se a instalação real for outra, o comportamento de `headers` no webhook e do `fetchInstances` pode ser outro (A1, A10).

Cole: a versão (esperado `2.3.7`).
Hora: 2026-11-09  Resultado: **`version` = `2.4.0`, não `2.3.7`.** `GET /license/status` devolve `active` (a 2.4.0 exige ativação de licença) e `fetchInstances` responde `200` com **0 instâncias** (o passo 1 ainda não foi feito; esta Evolution não tem a `numeropvmarcos`). As notas públicas da 2.4.0 (rc1 de 2026-05-06 e rc2 de 2026-05-17, marcadas "não para produção") não citam mudança em `/webhook/set`, `fetchInstances`, `getBase64FromMediaMessage` nem no payload de `MESSAGES_UPSERT`, e a rc2 diz que não há mudança de contrato HTTP (ausência de menção, não prova).
**Decisão do dono (2026-11-09): seguir na 2.4.0** e provar A1 e A10 no passo 8 (`--seco`, que confere o token da instância, o estado `open` e o número) e no webhook ao vivo (passos 17 a 22). Se o `--seco` ou a prova falharem por diferença de versão: `/gsd-plan-phase 16 --gaps` (ou fixar a 2.3.7 apagando o volume do Postgres da Evolution, que está vazio de instâncias).

### Passo 4 — O `evolution.env` real (Open Question 2)

Na VPS da Evolution, como root. O comando abaixo imprime **só estas três chaves de configuração** (nenhuma delas guarda segredo); **não** imprima o arquivo inteiro, porque ele tem a chave global e a senha do Postgres:

```bash
grep -E '^(DATABASE_SAVE_DATA_INSTANCE|CACHE_REDIS_SAVE_INSTANCES|AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES)=' /opt/evolution/evolution.env
```

Cole as linhas que saírem (ou "nenhuma" para a que faltar). O que cada uma decide:

| Variável | Por que importa |
|---|---|
| `DATABASE_SAVE_DATA_INSTANCE` (ou `CACHE_REDIS_SAVE_INSTANCES`) | `true` em uma delas faz a instância sobreviver a um reinício da Evolution. Sem nenhuma, reiniciar a Evolution derruba a instância e pede QR de novo. |
| `AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES` | `true` faz `fetchInstances` devolver o **token da instância**, que é o que o comando guarda no cofre (T-16-51, A10). Com `false` o comando recusa: não use a chave global no lugar sem decidir isso comigo (ela cria e apaga instâncias, inclusive a do Financeiro). |

Hora: ______  Resultado: ______

### Passo 5 — As variáveis no notebook (e a chave global só na sessão)

No `apps/api/.env` do notebook, acrescente (uma linha cada, sem aspas, sem barra no final):

```
EVOLUTION_URL=https://<dominio da Evolution>
API_URL_PUBLICA=https://<dominio publico da API na VM>
```

**A chave global da Evolution (`AUTHENTICATION_API_KEY`) NÃO vai para o `.env` nem para o `api.env`.** Este é um desvio consciente do texto do plano 16-15 (que a listava no `.env`): o 16-13 e o 16-14 decidiram, e o código do comando exige, que ela só exista na linha de comando daquela execução (o cofre guarda o token da instância, nunca a global). Quando um passo pedir, leia-a assim, sem eco, e apague-a da sessão depois:

```bash
read -rs EVOLUTION_API_KEY; export EVOLUTION_API_KEY     # cole a chave e tecle Enter (nada aparece na tela)
# ... rode o comando que a usa ...
unset EVOLUTION_API_KEY
```

Também confira que o `COFRE_CHAVE` do notebook é o **mesmo** da produção, sem imprimi-lo (o comando do passo 8 e o do passo 15 gravam no cofre com ele; uma chave diferente grava um segredo que a VM não consegue ler). Compare só os 8 primeiros caracteres do hash:

```bash
# no notebook, na raiz do repositório
grep '^COFRE_CHAVE=' apps/api/.env | cut -d= -f2- | tr -d ' \r\n' | shasum -a 256 | cut -c1-8
# na VM, como root
grep '^COFRE_CHAVE=' /opt/n1-crm/shared/api.env | cut -d= -f2- | tr -d ' \r\n' | sha256sum | cut -c1-8
```

Os dois números têm de ser iguais. Se não forem, **pare**: ou o `.env` do notebook não é o de produção, ou a chave mudou.

Conferir: as duas linhas no `.env`; os dois hashes iguais.
Hora: ______  Resultado: ______

### Passo 6 — `tempo-real:provar` pelo pooler de produção (A9)

É a prova de que o pooler do Supabase em modo sessão (porta 5432), com o papel **`n1_api`** (o mesmo `DATABASE_URL` do `api.env` da VM), entrega `LISTEN/NOTIFY`. O comando não grava nada (só `LISTEN` e `pg_notify` num canal de prova) e **não imprime a URL, o host nem a senha**.

Se o `DATABASE_URL` do `apps/api/.env` do notebook **não** for o do papel `n1_api` do pooler, leia o da VM só nesta sessão:

```bash
read -rs DATABASE_URL; export DATABASE_URL          # cole a URL do papel n1_api (a do api.env da VM)
export DATABASE_CA_PATH=<caminho do supabase-ca.crt no notebook>   # a CA do Supabase, como no api.env
npm run tempo-real:provar -w @n1/api
unset DATABASE_URL
```

Esperado, uma linha:

```
papel=n1_api porta=5432 recebido_em_ms=<n>
```

Cole **a linha inteira**. Leitura:

| Saída | Significa |
|---|---|
| `papel=n1_api porta=5432 recebido_em_ms=<n>` com `n` de dezenas ou poucas centenas | o pooler entrega: o tempo real funciona em produção |
| `A notificação não chegou em 10 s.` (código 1) | o pooler conecta mas **não entrega** `LISTEN/NOTIFY` (A9 falhou). A tela continua correta pela releitura de 5 s, mas sem tempo real. **Pare**: `/gsd-plan-phase 16 --gaps` |
| `papel=` diferente de `n1_api` | a URL não é a do papel de runtime: refaça com a URL certa |
| `Não foi possível conectar ao banco (<código>)` | URL, rede ou senha: o código (`ECONNREFUSED`, `28P01`…) diz qual; nunca cole a URL |
| `A conexão remota precisa de DATABASE_CA_PATH…` (código 2) | falta a CA do Supabase |

Hora: ______  Resultado: ______

### Passo 7 — Criar o Canal WhatsApp não oficial na tela de produção

1. Abra o CRM de produção em `/crm/caixa-de-entrada/configuracoes/canais/conectar`.
2. Escolha o provedor **WhatsApp não oficial** e informe o número do passo 1 (o mesmo que a instância conectou, com o código do país).
3. Crie o Canal. Ele nasce `desconectada`.
4. Anote o **id do Canal** (está na URL da ficha dele). O id não é segredo; o número **não** volta para a conversa.

Conferir: o Canal aparece na lista como desconectado.
Hora: ______  Resultado: ______

### Passo 8 — `canal:ligar-evolution --seco`

O `--seco` percorre o mesmo caminho do comando de verdade até a conferência do número e **para**: não escreve na Evolution nem no banco. Ele lê a instância com a chave global (só leitura), exige `connectionState` `open` e compara o número conectado com o do Canal.

```bash
read -rs EVOLUTION_API_KEY; export EVOLUTION_API_KEY
npm run canal:ligar-evolution -w @n1/api -- --canal <id do Canal> --instancia <nome da instancia> --seco
unset EVOLUTION_API_KEY
```

Esperado (a saída já não traz chave, token, segredo nem o número, só os 4 últimos dígitos):

```
Simulação (--seco): nada foi escrito, nem na Evolution nem no banco.
  Canal       <nome> (<id>)
  Espaço      <id do Espaço>
  Instância   <nome> (open)
  Número      final <4 dígitos>, confere com o do Canal
  Webhook     https://<API_URL_PUBLICA>/webhooks/mensageria/<id do Canal>
  (e a versão da Evolution)
```

Cole a saída inteira. Se aparecer uma recusa (código 2), ela diz o motivo: instância não conectada, número que não confere, Canal de outro provedor, ou a instância sem token (A10). **Em qualquer recusa, pare.**

Hora: ______  Resultado: ______

### Sinal de retomada do pré-voo (o plano 16-15 espera isto)

Cole na conversa, sem segredo:

> a versão, a linha do `tempo-real:provar`, a saída do `--seco` (sem token), as respostas do `evolution.env` e "SEG-11 ok" ou o que falta; ou "parei no passo N" com o erro.

O executor só confere o que você colar: versão `2.3.7` (ou registra a diferença), `papel=n1_api porta=5432 recebido_em_ms=<n>` (ou a falha), o `--seco` com "confere com o do Canal" e a URL do webhook, e as respostas dos passos 2 e 4. Se algo falhar, ele registra e recomenda `/gsd-plan-phase 16 --gaps` antes de qualquer publicação (16-16).

---

## Publicação

**Só depois de o pré-voo passar e de o 16-16 mandar.** Esta seção é o roteiro que o 16-16 executa com você. Nada aqui foi rodado contra produção pelo agente.

### Passo 9 — Backup manual do schema `plataforma`

O backup diário não está ligado. Antes da `013`, como no corte da Fase 15 (`15-CORTE.md`, passo 2): `pg_dump -Fc --schema=plataforma --no-owner --no-acl`, restaurado num Postgres descartável de Docker (porta 55790), com as contagens de `plataforma.registros`, `plataforma.workspaces` e `plataforma.migracoes` conferidas contra as de produção. O backup tem dado pessoal: guarde fora do repositório. Se não restaurar, refaça antes de continuar.

Hora: ______  Resultado: ______

### Passo 10 — O que a migração faria

```bash
npm run migrar -w @n1/api -- --seco
```

Esperado: cada arquivo como `aplicada` ou `pendente`, e **só a `013-mensageria.sql` `pendente`**. Qualquer outra pendente: pare e cole a lista.

Hora: ______  Resultado: ______

### Passo 11 — Aplicar a `013` e as concessões

```bash
npm run migrar -w @n1/api
npm run banco:conceder -w @n1/api
```

A `013` cria `plataforma.webhooks_recebidos` e o índice do `mensagem.enviar.v1`; é aditiva e **a API antiga continua funcionando com ela**. `banco:conceder` dá ao `n1_api` o que ele precisa sobre a tabela nova. O `publicar.sh` do passo 13 roda os dois de novo e deve dizer "Nada a aplicar".

Hora: ______  Resultado: ______

### Passo 12 — As variáveis no `api.env` da VM

Como root, na VM, acrescente ao `/opt/n1-crm/shared/api.env` as duas linhas do passo 5 (`EVOLUTION_URL` e `API_URL_PUBLICA`, mesmos valores). **Sem** `EVOLUTION_API_KEY` e **sem** `MENSAGERIA_WORKER_ATIVO`/`COLETA_DE_ORFAOS_ATIVA` (a unidade e o drop-in do passo 14 as definem; o que o serviço define vence o arquivo). Confira sem imprimir valores:

```bash
grep -cE '^(EVOLUTION_URL|API_URL_PUBLICA)=.+' /opt/n1-crm/shared/api.env     # esperado: 2
```

Sem `EVOLUTION_URL`, o provedor `whatsapp-nao-oficial` não é registrado e o envio recusa.

Hora: ______  Resultado: ______

### Passo 13 — Publicar a API

Da raiz do repositório, no commit que vai subir (o mesmo comando do CI, `deploy/CONTEXT.md`):

```bash
VPS_HOST=<ip da VM> VPS_USER=n1crm SSH_KEY=~/.ssh/n1_crm_deploy_ci apps/api/deploy/publicar.sh [commit]
```

(`ssh-add -l` deve listar a chave; se não, `ssh-add ~/.ssh/n1_crm_deploy_ci`.) Esperado: o `instalar-release.sh` termina sem erro e `/saude` responde; se não responder em 40 s ele volta o link `current` sozinho e o comando falha. Os dois workers da mensageria ainda estão **desligados**, porque a unidade fixa `false`.

Hora: ______  Resultado: ______

### Passo 14 — Ligar os workers (drop-in `mensageria.conf`)

Como root, na VM. O drop-in não mexe no arquivo da unidade, então um `publicar.sh` depois não o desfaz:

```bash
install -d /etc/systemd/system/n1-crm-api.service.d
printf '[Service]\nEnvironment=MENSAGERIA_WORKER_ATIVO=true\nEnvironment=COLETA_DE_ORFAOS_ATIVA=true\n' \
  > /etc/systemd/system/n1-crm-api.service.d/mensageria.conf
systemctl daemon-reload && systemctl restart n1-crm-api
journalctl -u n1-crm-api -n 60 --no-pager | grep -E 'processador de entrada da mensageria ativo|worker de saída da mensageria ativo|coleta de órfãos ativa'
```

Esperado: **as três** linhas ("processador de entrada da mensageria ativo", "worker de saída da mensageria ativo", "coleta de órfãos ativa"). A coleta só faz sentido com o bucket configurado (`npm run storage:conferir -w @n1/api`, como `n1crm` em `/opt/n1-crm/current`). Se o `.env` de um notebook estiver ligado ao **mesmo** banco com `MENSAGERIA_WORKER_ATIVO=true`, desligue-o: ele competiria com a VM.

Hora: ______  Resultado: ______

### Passo 15 — O SSE atrás do nginx da VM (T-16-57)

O `GET /eventos` é o fluxo do tempo real e precisa chegar ao navegador sem ficar preso no buffer do nginx. A prova de Docker (`provar-nginx.sh`, prova 4) já passou com o `location /` do repositório; aqui você repete na VM, com o site real.

**Jeito sem terminal (recomendado):** abra a Caixa de Entrada logada, DevTools → Rede, filtre por `eventos`. A requisição fica **pendente** (é o fluxo) e a aba "EventStream" (ou "Resposta") mostra `: aberto` **na hora**, e depois `: batida` a cada ~25 s.

**Jeito de terminal:** o token de login do CRM vem do DevTools (cabeçalho `Authorization` de qualquer chamada à API). **É um segredo: cole-o só no seu terminal, nunca na conversa.**

```bash
read -rs TOKEN_DO_CRM; export TOKEN_DO_CRM
curl -sN --max-time 8 -H "authorization: Bearer $TOKEN_DO_CRM" <API_URL_PUBLICA>/eventos
unset TOKEN_DO_CRM
```

Esperado: `: aberto` aparece **imediatamente** (e não só aos 8 s, quando o `curl` desiste). Se só aparecer no fim, o nginx está segurando o fluxo: pare e cole o tempo.

Hora: ______  Resultado: ______

### Passo 16 — Publicar a web e ligar o Canal de verdade

1. Publique a web como no corte da Fase 15 (`15-CORTE.md`): push da `main` para o `n1-tecnologia/crm` (a Vercel publica sozinha). Espere o deploy da Vercel terminar.
2. Ligue o Canal. É o mesmo comando do passo 8, **sem `--seco`**, e agora ele escreve: aponta o webhook da instância para a API com o segredo no cabeçalho `x-n1-webhook-segredo`, guarda o segredo e o token da instância no cofre, marca o Canal `conectada` e reenfileira as Mensagens pendentes. Rode-o **com o `DATABASE_URL` e o `COFRE_CHAVE` de produção** (os do `.env` do notebook, conferidos no passo 5):

```bash
read -rs EVOLUTION_API_KEY; export EVOLUTION_API_KEY
npm run canal:ligar-evolution -w @n1/api -- --canal <id do Canal> --instancia <nome da instancia>
unset EVOLUTION_API_KEY
```

Esperado: a mesma saída do passo 8 sem a linha de simulação, e o Canal aparecendo **conectado** na ficha. Se o comando falhar depois do `webhook/set`, ele diz: a instância já aponta para um segredo que o banco não tem, e as chamadas dela recebem 401 até você rodar o comando de novo.

Hora: ______  Resultado: ______

---

## Prova

O critério (D-16-04): do celular, **texto e áudio de voz aparecem na Caixa de Entrada, em outra aba, em menos de 2 s, sem recarregar**; o áudio **toca**; e a resposta pela Caixa **chega ao celular**. Se o áudio passar de 2 s mas o texto não, a Open Question 1 diz o que decidir (passo 22).

### Passo 17 — Duas abas na Caixa do Canal

Abra a Caixa de Entrada do CRM de produção em **duas abas** (ou duas janelas), as duas na lista de Conversas do Canal novo. Deixe-as abertas, sem mexer.

### Passo 18 — Texto do celular, cronometrado

Do **celular de um terceiro** (outro número que não seja o da instância), mande uma mensagem de texto curta para o número da instância. Cronometre do toque em "enviar" até a Conversa aparecer **nas duas abas**. Esperado: menos de 2 s, sem recarregar nenhuma. Repita 3 vezes e anote o maior tempo.

Hora: ______  Resultado: ______ (maior tempo: ____ s)

### Passo 19 — Áudio de voz do celular

Mande uma **mensagem de voz** (a de segurar o microfone). Esperado: ela aparece na Conversa, nas duas abas, e **toca** (play funciona) no **Chrome**. Se você usa Safari, repita nele e anote: o formato `ogg/opus` do WhatsApp não toca em todo navegador, e isso muda o que a Sessão 4 faz. Cronometre como no passo 18.

Hora: ______  Resultado: ______ (tempo do áudio: ____ s; toca no Chrome: sim/não; Safari: sim/não/não testei)

### Passo 20 — Os tempos por etapa (só ids e milissegundos)

Na VM, como root:

```bash
journalctl -u n1-crm-api --since "15 min ago" --no-pager | grep 'mensageria.etapas'
```

Cada chamada vira uma linha `mensageria.etapas` com `webhookId`, `esperaMs`, `baixarMs`, `subirMs`, `transacaoMs`, `totalMs` e `anexos`. Cole **só esses campos** de cada linha (o `webhookId` é um id interno; a linha não traz telefone, texto nem nome de arquivo). É o que separa "a Evolution demorou" (`baixarMs`) de "o upload demorou" (`subirMs`) de "o banco demorou" (`transacaoMs`).

Hora: ______  Resultado: ______

### Passo 21 — Responder pela Caixa

1. Na Caixa, responda a Conversa com **um texto**. Esperado: chega ao celular em poucos segundos e a Mensagem deixa de ficar `pendente`.
2. Responda com **um arquivo de imagem**. Esperado: chega ao celular como imagem.

Se alguma ficar `falhou`, a Mensagem mostra o motivo; **cole só o motivo**, nunca o número nem o conteúdo.

Hora: ______  Resultado: ______

### Passo 22 — Nenhuma chamada ignorada por falta de número

Com `psql` e a URL do papel de runtime lida sem eco (`read -rs DATABASE_URL; export DATABASE_URL`, como no passo 6):

```bash
psql "$DATABASE_URL" -At -c "select estado, coalesce(resultado,'-') as resultado, count(*) from plataforma.webhooks_recebidos where recebido_em > now() - interval '1 hour' group by 1,2 order by 1,2"
unset DATABASE_URL
```

Esperado: linhas `processado | -` (e talvez `processado | ignorado:fromMe`, o eco do que você enviou), **nenhuma `ignorado:sem_numero`** e nenhuma `falhou`. Um `ignorado:sem_numero` quer dizer que a Evolution mandou um identificador (`@lid`) em vez do número: cole a contagem e o código da Evolution (`version`) e abra `/gsd-plan-phase 16 --gaps`. A saída só tem estados e contagens.

Se o áudio passou de 2 s mas o texto ficou abaixo: é a Open Question 1 da pesquisa. A decisão é sua: aceitar 2 a 3 s para áudio (o texto continua abaixo de 2 s), ou reabrir a ordem "baixar antes da transação" (D-16-08), gravando a Mensagem sem o arquivo primeiro. Diga qual ao colar os tempos.

Hora: ______  Resultado: ______

---

## Se algo falhar

Nada abaixo apaga dado. A `013` **fica**: é aditiva e a API antiga ignora a tabela nova.

| O que fazer | Como |
|---|---|
| **Parar a mensageria** (as duas pontas: entrada e saída) | Na VM, como root: troque `true` por `false` nas duas linhas de `/etc/systemd/system/n1-crm-api.service.d/mensageria.conf` (ou apague o arquivo) e `systemctl daemon-reload && systemctl restart n1-crm-api`. A unidade volta a fixar `false`. |
| **Parar de receber do WhatsApp** | No painel `/manager` da Evolution, desligue o webhook da instância (ou rode a Evolution sem ele). Sem isso a Evolution continua chamando a API, que responde e guarda na fila sem processar. |
| **Voltar o Canal a desconectado** | Na ficha do Canal, "Desconectar". Ele volta a `desconectada`; a chave e o segredo ficam no cofre e são regravados pelo próximo `canal:ligar-evolution`. |
| **Desligar só o tempo real** | `TEMPO_REAL_ATIVO=false` no drop-in (acrescente `Environment=TEMPO_REAL_ATIVO=false`) e `restart`: `GET /eventos` passa a responder 503 e a tela relê a cada 5 s. As mensagens continuam chegando. |
| **Voltar a versão da API** | `ln -sfn /opt/n1-crm/releases/<sha anterior> /opt/n1-crm/current && systemctl restart n1-crm-api` (`deploy/CONTEXT.md`, "Operar"). |
| **Webhook com 401 na Evolution** | O segredo da instância não bate com o do cofre (o comando do passo 16 falhou no meio): rode `canal:ligar-evolution` de novo. |

Qualquer falha que não seja "a instância não está conectada" ou "o número não confere" é um achado: cole-o e use `/gsd-plan-phase 16 --gaps`.

---

## O que colar de volta

Só isto, por passo. Nada de URL de banco, chave, token, telefone, texto de mensagem ou nome de arquivo.

| Passo | O que voltar |
|---|---|
| 2 | "SEG-11 ok", ou os três códigos HTTP |
| 3 | a `version` da Evolution |
| 4 | as linhas do `grep` do `evolution.env` (ou "nenhuma") |
| 5 | "hashes do COFRE_CHAVE iguais" ou "diferentes" |
| 6 | a linha `papel=… porta=… recebido_em_ms=…` (ou a frase de erro) |
| 8 | a saída do `--seco` inteira |
| 10, 11, 13, 14 | "ok" ou "falhou" + a mensagem de erro; no 14, as três linhas do `journalctl` |
| 15 | "`: aberto` na hora" ou o tempo que levou |
| 16 | "Canal conectado" ou o erro |
| 18, 19 | o maior tempo em segundos, "toca no Chrome" e "toca no Safari" |
| 20 | os campos `esperaMs`, `baixarMs`, `subirMs`, `transacaoMs`, `totalMs` e `anexos` de cada linha |
| 21 | "texto chegou", "imagem chegou", ou o motivo do `falhou` |
| 22 | as linhas `estado | resultado | contagem` |
| qualquer um | "parei no passo N" + o erro |
