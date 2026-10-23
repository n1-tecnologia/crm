# Deploy do apps/api

O backend roda numa VPS **compartilhada** com outros projetos (Auton,
ai-first, testa-ai, sdr-auton, vip-ia, dashroberth, boxia, o `automation/`
do financeiro-tria). Tudo aqui foi feito para não encostar neles: usuário,
pasta, Node, serviço, site do nginx e certificado próprios.

| Peça | Onde |
|---|---|
| Processo | serviço systemd `n1-crm-api`, usuário `n1crm`, `127.0.0.1:3020` |
| Código | `/opt/n1-crm/current` → `/opt/n1-crm/releases/<sha>` (as 5 últimas ficam) |
| Ambiente | `/opt/n1-crm/shared/api.env` (vira o `apps/api/.env` de cada versão, por link) |
| Node | `/opt/n1-crm/node` (24, só do N1 CRM — o global da máquina é 20 e é dos outros) |
| Público | `https://crm-n1-api.85.155.186.214.nip.io` — site `n1-crm-api` do nginx + Let's Encrypt |
| Interface | Vercel, que publica a web sozinha pela integração com o GitHub |

## O caminho de uma mudança

PR aberta → `check` (tipos, lint, testes) → merge na `main` → `check` de novo,
no commit da `main` → `deploy-api` (só se o `check` passou) → `publicar.sh`
→ na VPS, `instalar-release.sh`:

0. confere o `api.env` (Pitfall 9: `n1_api` em `DATABASE_URL` exige `DATABASE_URL_MIGRACAO`);
1. extrai o pacote do commit (`git archive`: só o que está commitado);
2. `npm ci` só do `@n1/api` (e do `@n1/dominio`, que ele usa);
3. `npm run migrar` — as migrações são aditivas; quase sempre "Nada a aplicar" — e `npm run banco:conceder` (as concessões do `n1_api`; sem o papel no banco, não faz nada);
4. troca o link `current` e reinicia o serviço;
5. espera `/saude` responder; se não responder em 40 s, volta o link para a
   versão anterior e reinicia de novo (o deploy fica vermelho no GitHub).

Um merge que não mexe em `apps/api`, `packages/dominio` nem no lockfile não
reinicia o backend.

## Segredos do GitHub

Em *Settings → Secrets and variables → Actions* (podem ficar no ambiente
`production`, que o workflow usa — ali dá para exigir aprovação antes de cada deploy):

| Nome | Tipo | Valor |
|---|---|---|
| `VPS_HOST` | segredo | `85.155.186.214` |
| `VPS_USER` | segredo | `n1crm` |
| `VPS_SSH_KEY` | segredo | a chave privada de deploy (feita só para isto; entra na VPS com `restrict`) |
| `VPS_KNOWN_HOSTS` | segredo | a linha do `known_hosts` da VPS — fixa a identidade do servidor |
| `API_URL_PUBLICA` | variável | `https://crm-n1-api.85.155.186.214.nip.io` (o CI confere `/saude` por ela) |

## O `api.env`

O mesmo formato do `apps/api/.env`: uma `CHAVE=valor` por linha, sem aspas e
sem valor em várias linhas (é o `carregarEnv()` que lê). Dono `n1crm`, modo 600.

**Não vão nele** — o serviço já define, e o que o serviço define vence o
arquivo: `HOST`, `PORT`, `TRUST_PROXY`, `TZ` e os três workers
(`AGENTE_CONTAS_A_PAGAR_ATIVO`, `OUTBOX_WORKER_ATIVO`, `AUTOMACOES_WORKER_ATIVO`).

**Muda em relação ao do notebook:**

- `DATABASE_CA_PATH=/opt/n1-crm/shared/supabase-ca.crt` — a CA do Supabase
  (*Project Settings → Database → SSL Configuration → Download certificate*).
  Nunca `DATABASE_SSL_INSECURE` em produção.
- `WEB_ORIGIN` — a URL da Vercel; aceita várias, separadas por vírgula
  (`https://crm-n1.vercel.app,https://crm.dominio.com.br`).
- As URLs do `automation/` (`FINANCEIRO_LEITURAS_URL`, `OUTBOX_DESTINO_URL`,
  `AGENTE_CONTAS_A_PAGAR_URL`): na VPS, `127.0.0.1:4100` é o `automation/` de
  **produção**, não o do notebook. A plataforma sobe antes do `automation/`.

Mudou o arquivo? Reinicie (como root): `systemctl restart n1-crm-api`.

## Operar

| Para | Comando (na VPS, como root) |
|---|---|
| Ver se está de pé | `systemctl status n1-crm-api` · `curl -s 127.0.0.1:3020/saude` |
| Ler o log | `journalctl -u n1-crm-api -f` |
| Conferir o bucket de anexos (PIPE-07) | como `n1crm`: `cd /opt/n1-crm/current && npm run storage:conferir -w @n1/api` — variáveis, bucket privado e ticket de envio, sem subir arquivo |
| Qual versão está no ar | `cat /opt/n1-crm/current/REVISION` |
| Voltar uma versão | `ln -sfn /opt/n1-crm/releases/<sha> /opt/n1-crm/current && systemctl restart n1-crm-api` |
| Ligar os workers | `systemctl edit n1-crm-api` → `[Service]` + `Environment=OUTBOX_WORKER_ATIVO=true` (e desligar no notebook: dois processando o mesmo outbox duplicam envio) |

Publicar à mão, da raiz do repositório (o mesmo passo do CI):

```bash
VPS_HOST=85.155.186.214 VPS_USER=n1crm SSH_KEY=~/.ssh/n1_crm_deploy_ci \
  apps/api/deploy/publicar.sh [commit]      # FORCAR=1 publica mesmo sem mudança
```

Preparar uma VPS do zero (como root, uma vez; rodar de novo não estraga nada):

```bash
scp -r apps/api/deploy root@VPS:/tmp/n1-crm-deploy
ssh root@VPS 'bash /tmp/n1-crm-deploy/preparar-vps.sh crm-n1-api.<ip>.nip.io /tmp/n1-crm-deploy/chave.pub'
```

## Limite e máscara no nginx (Fase 9)

Dois arquivos, e só `/v1/public/` (rotas sem login: Formulário e Tarefa por
link) é limitado na borda:

| Arquivo (repositório) | Onde fica na VPS | O que tem |
|---|---|---|
| `deploy/n1-crm-limites.conf` | `/etc/nginx/conf.d/n1-crm-limites.conf` (contexto `http`) | as zonas `n1_publico` (`POST`) e `n1_publico_leitura` (`GET`/`HEAD`), o `map $n1_uri_mascarada` e o `log_format n1_mascarado` |
| `deploy/nginx-n1-crm-api.conf` | `/etc/nginx/sites-available/n1-crm-api` | o `access_log … n1_mascarado` e o `location /v1/public/` |

- **`POST` por IP, `GET` com teto próprio (D-20).** Uploads e submissões vêm do
  navegador de quem preenche, com o IP do visitante: 30 por minuto, burst 10
  (o primeiro `429` é a 12ª chamada seguida). O `GET` de `/f/` e `/p/` é feito
  pelo servidor da Vercel, duas vezes por visita (`generateMetadata` e a
  página), por um IP só: com 30/min todos os visitantes dividiriam um balde de
  umas 15 visitas por minuto. Por isso o `GET`/`HEAD` tem zona própria a
  120/min, burst 60, acima dos limites em memória do `apps/api` — o nginx só
  corta enxurrada antes do Node.
- **Segredo fora dos logs (D-18).** O `log_format` troca o segmento depois de
  `/v1/public/forms/` e `/v1/public/tasks/` por `***` e não usa `$request` nem
  `$http_referer`. Mascarar o `access_log` não basta: com `limit_req` ativo o
  `error_log` grava a linha do pedido (com o segredo) a cada `429`. Por isso o
  `location /v1/public/` tem `limit_req_log_level info` **e** `error_log
  …publico.error.log crit`. **Custo:** um erro de proxy dessas rotas (502,
  timeout) não aparece no log do nginx; a api registra os dela
  (`journalctl -u n1-crm-api`).
- **O arquivo da VPS é a fonte.** Depois da primeira emissão do certificado o
  `preparar-vps.sh` não reescreve o site. Ele instala `n1-crm-limites.conf` só
  se ainda não existir (se existir e diferir, avisa e não sobrescreve) e, se o
  `nginx -t` falhar, tira o que essa rodada pôs e não recarrega.

**Prova local, antes de ir à VPS** (precisa de Docker; sobe um `nginx:stable-alpine`
com os arquivos do repositório, roda as provas e remove tudo):

```bash
bash apps/api/deploy/provar-nginx.sh      # PORTA_DE_PROVA=18609 por padrão
```

Saem três linhas `ok`: 50 `POST` seguidos (39 `429`, o primeiro na 12ª
chamada), 50 `GET` sem nenhum `429`, e nenhum log com o segredo.

**Roteiro à mão na VPS de produção** (como root; cada passo que muda o nginx
só segue se o `nginx -t` passar — um `reload` com configuração inválida não
deve ser tentado):

1. Copie o arquivo novo: `install -m 644 n1-crm-limites.conf /etc/nginx/conf.d/n1-crm-limites.conf`.
2. No site que o certbot já reescreveu (`/etc/nginx/sites-available/n1-crm-api`):
   troque o `access_log` para `/var/log/nginx/n1-crm-api.access.log n1_mascarado;`
   e acrescente o `location /v1/public/` do modelo (`nginx-n1-crm-api.conf`)
   **antes** do `location /`, trocando `__SITE__` por `n1-crm-api` e `__PORTA__`
   por `3020`. Se o certbot abriu um bloco `443`, o `location` vai nele também.
3. `nginx -t` — se falhar, **pare** e cole a saída; não recarregue.
4. `systemctl reload nginx`.
5. Do notebook, o laço de 50 chamadas (use um segredo qualquer, ele não precisa existir):
   `for i in $(seq 1 50); do curl -s -o /dev/null -w '%{http_code}\n' -X POST https://crm-n1-api.85.155.186.214.nip.io/v1/public/forms/teste123/submissions; done | sort | uniq -c`
   — esperado: `429` em 30 ou mais, o primeiro na 11ª–20ª chamada. Repita com `GET` (sem `-X POST`): nenhum `429`.
6. `grep -c teste123 /var/log/nginx/n1-crm-api*.log` — esperado: `0` em todos —
   e `grep '/v1/public/forms/' /var/log/nginx/n1-crm-api.access.log | tail -3` mostra `***`.

**Pendência do dono (Pitfall 8).** O limite em memória por IP do `apps/api`
(`limite-de-taxa.ts`: 30/min no Formulário, 60/min na Tarefa pública) também
junta num balde só todos os visitantes de `/f/` e `/p/` que vêm da Vercel, e
cada visita chama a api duas vezes. A Fase 9 não mudou esse limite (D-19 o
mantém): para o tráfego da Vercel é ele que manda, não o nginx. Decisão para
uma sessão futura: subir o teto por IP do `GET` em memória, ou contar por
segredo em vez de por IP.

## Homologação (Fase 9)

Um segundo ambiente na **mesma VPS**, com a api ligada a um **segundo projeto
Supabase** (D-08), para testar antes da `main`. Os mesmos scripts montam os
dois, escolhidos por `AMBIENTE` (`producao`, o padrão, ou `homologacao`); nada
é compartilhado além da máquina (D-09, D-23):

| Peça | Produção | Homologação |
|---|---|---|
| Usuário de sistema | `n1crm` | `n1crm-hml` |
| Pasta | `/opt/n1-crm` | `/opt/n1-crm-hml` |
| Porta | `127.0.0.1:3020` | `127.0.0.1:3021` |
| Serviço systemd | `n1-crm-api` | `n1-crm-api-hml` |
| Site do nginx | `n1-crm-api` | `n1-crm-api-hml` |
| Domínio | `crm-n1-api.85.155.186.214.nip.io` | `crm-n1-api-hml.85.155.186.214.nip.io` |
| `sudoers` | `/etc/sudoers.d/n1-crm-api` | `/etc/sudoers.d/n1-crm-api-hml` (só reinicia e lê o próprio serviço) |
| Chave de deploy | a de produção | **outra**, só da homologação (entra no `authorized_keys` do `n1crm-hml`, com `restrict`) |
| Branch que publica | `main` | `homologacao` |

Quem comprometer a homologação (o ambiente da passada exploratória, de login
mais frouxo) não lê o `api.env` de produção: usuário, pasta (750/700), `sudoers`
e chave são outros, e o `api.env` de cada ambiente é de dono e modo próprios.

**Preparar a VPS** (como root, uma vez; é o roteiro de 09-17 e é do dono).
Antes de rodar de verdade, **confira** — `--conferir` não pede root e não muda
nada, só imprime o usuário, a pasta, a porta, o serviço e o site, e o serviço e
o site já renderizados:

```bash
AMBIENTE=homologacao bash apps/api/deploy/preparar-vps.sh crm-n1-api-hml.85.155.186.214.nip.io --conferir
# conferido:
scp -r apps/api/deploy root@VPS:/tmp/n1-crm-deploy
ssh root@VPS 'AMBIENTE=homologacao bash /tmp/n1-crm-deploy/preparar-vps.sh crm-n1-api-hml.85.155.186.214.nip.io /tmp/n1-crm-deploy/chave-hml.pub'
```

**Segredos do GitHub.** No ambiente `homologacao` (Settings → Environments),
com os mesmos nomes dos de produção e valores próprios: `VPS_HOST`, `VPS_USER`
(`n1crm-hml`), `VPS_SSH_KEY` (a chave de homologação), `VPS_KNOWN_HOSTS` e a
variável `API_URL_PUBLICA` (`https://crm-n1-api-hml.85.155.186.214.nip.io`).

**O `api.env` de homologação** (`/opt/n1-crm-hml/shared/api.env`, dono
`n1crm-hml`, modo 600): as mesmas chaves do de produção, com valores próprios.

- `DATABASE_URL` — o papel `n1_api.<ref-hml>` do projeto de homologação, e
  `DATABASE_URL_MIGRACAO` — o dono do banco, que migra. **As duas linhas mudam
  juntas** (Pitfall 9): com `n1_api` em `DATABASE_URL` e sem
  `DATABASE_URL_MIGRACAO`, o `migrar` rodaria como `n1_api` e falharia em DDL.
  O `instalar-release.sh` agora confere isso **antes de extrair** e para com
  "nada foi instalado". Para conferir à mão: `INSTALAR_SO_CONFERIR=1
  API_ENV=<arquivo> bash instalar-release.sh <sha> homologacao` (sai 0 se
  passa, 1 se falha).
- `COFRE_CHAVE` — **própria** da homologação, nunca a de produção.
- `WORKSPACE_ID` e os `SUPABASE_*` do projeto de homologação.
- `WEB_ORIGIN` — a URL de **Preview** da Vercel da branch `homologacao`. O CORS
  é por allowlist: sem essa URL aqui, a interface de Preview não consegue chamar
  a api.
- `DATABASE_CA_PATH=/opt/n1-crm-hml/shared/supabase-ca.crt` — a CA do Supabase.
- Não vão nele o que o serviço já define (`HOST`, `PORT`, `TRUST_PROXY`, `TZ` e
  os três workers, que ficam desligados).

**A Vercel.** As três `NEXT_PUBLIC_*` do ambiente **Preview** apontam para a
homologação (api e projeto Supabase de homologação); as de Production seguem
em produção.

**Nenhum dado de produção vai para a homologação (D-21).** CPF e dados
bancários do Financeiro são reais; a homologação é onde se faz a passada
exploratória. A restauração de backup é provada no Mac do dono (09-18), nunca
no projeto de homologação.

**Como publica.** Push na branch `homologacao` → `check` → job `homologacao` do
`deploy-api.yml` (`environment: homologacao`) → `AMBIENTE=homologacao
publicar.sh` → `instalar-release.sh <sha> homologacao`. A cada deploy, depois do
`migrar`, roda `npm run banco:conceder -w @n1/api` (barato e idempotente; cobre
o papel `n1_api` criado depois da `009`; aborta antes de trocar o `current`).
Cada ambiente tem o seu grupo de concorrência (`deploy-api-producao`,
`deploy-api-homologacao`, sem cancelar): um deploy de homologação pendente
nunca cancela um de produção pendente. À mão:

```bash
AMBIENTE=homologacao VPS_HOST=85.155.186.214 VPS_USER=n1crm-hml SSH_KEY=~/.ssh/n1_crm_deploy_hml \
  apps/api/deploy/publicar.sh [commit]
```

Voltar uma versão na homologação: o mesmo da produção, trocando a pasta e o
serviço (`ln -sfn /opt/n1-crm-hml/releases/<sha> /opt/n1-crm-hml/current &&
systemctl restart n1-crm-api-hml`).

## Por que assim

- **systemd, não pm2.** O pm2 da VPS é do root e de todos os projetos; aqui
  o processo roda como `n1crm`, com teto de memória (`MemoryMax`) para um
  vazamento não derrubar os vizinhos, e o `n1crm` só tem `sudo` para
  reiniciar e ler o próprio serviço.
- **Node privado.** `vitest`/`vite-node` pedem Node 22.12+; trocar o Node
  global quebraria os outros projetos.
- **`vite-node` em produção.** É como o processo roda desde a Fase 1 (sem
  etapa de build); o TypeScript é transpilado na subida.
- **Só `127.0.0.1`.** O firewall da VPS está desligado: uma porta em
  `0.0.0.0` estaria aberta para a internet sem passar pelo nginx.
- **`TRUST_PROXY=loopback`.** Sem ele, atrás do nginx todo `request.ip` é
  127.0.0.1 e o limite de taxa do Formulário público vira um balde só.
- **Todas as rotas passam pelo nginx.** O desenho da Fase 2 bloqueava
  `/estado` e `/operacoes` na borda, pensando numa interface servida pela
  mesma máquina; com a interface na Vercel, é o navegador que chama essas
  rotas. Quem barra é o JWT do Supabase, e o CORS por allowlist.
