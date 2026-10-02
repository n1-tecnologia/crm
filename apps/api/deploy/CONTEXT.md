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

1. extrai o pacote do commit (`git archive`: só o que está commitado);
2. `npm ci` só do `@n1/api` (e do `@n1/dominio`, que ele usa);
3. `npm run migrar` — as migrações são aditivas; quase sempre "Nada a aplicar";
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
