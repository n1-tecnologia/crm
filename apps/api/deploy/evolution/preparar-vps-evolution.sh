#!/usr/bin/env bash
# Prepara a VPS NOVA da Evolution API (D-12, 1.7.5) — uma vez, como root.
# Idempotente: rodar de novo não regera chave, não reescreve o evolution.env e
# não desfaz o TLS que o certbot já pôs.
#
#   scp -r apps/api/deploy/evolution root@VPS:/tmp/evolution
#   ssh root@VPS 'bash /tmp/evolution/preparar-vps-evolution.sh <domínio>'
#
# `--conferir` (último argumento; não pede root e não muda nada) imprime o
# plano e o site do nginx já renderizado.
#
# Esta VPS é só da Evolution (D-12): por isso o script LIGA o firewall `ufw`
# com só SSH, 80 e 443. Conectar o número de WhatsApp é a Sessão 4, não isto.
#
# Pré-requisitos que o script NÃO instala (não baixa instalador de terceiros):
# Docker com o plugin compose, vindos do repositório oficial do Docker; e
# nginx, certbot (com o plugin nginx) e ufw, pelo gerenciador de pacotes.
set -euo pipefail

AQUI="$(cd "$(dirname "$0")" && pwd)"
CONFERIR=0
ARGS=()
for arg in "$@"; do
  if [ "$arg" = "--conferir" ]; then CONFERIR=1; else ARGS+=("$arg"); fi
done
DOMINIO="${ARGS[0]:?uso: preparar-vps-evolution.sh <domínio da Evolution> [--conferir]}"
case "$DOMINIO" in
  *[!A-Za-z0-9.-]*|.*|*.|"") echo "domínio inválido: $DOMINIO" >&2; exit 1 ;;
esac

BASE=/opt/evolution
SITE=evolution-api
ARQUIVO_DO_SITE="/etc/nginx/sites-available/$SITE"

renderizar_site() {
  sed "s/__DOMINIO__/$DOMINIO/g" "$AQUI/nginx-evolution.conf"
}

if [ "$CONFERIR" = 1 ]; then
  echo "DOMINIO=$DOMINIO"
  echo "BASE=$BASE"
  echo "SITE=$ARQUIVO_DO_SITE"
  echo
  echo "== plano (nada será alterado)"
  echo "1. exige: docker compose, nginx, certbot, ufw"
  echo "2. ufw: default deny incoming; allow <porta do ssh, 22 por padrão>/tcp; allow 80,443/tcp; enable"
  echo "3. copia docker-compose.yml para $BASE (os contêineres não publicam porta fora de 127.0.0.1:8080)"
  echo "4. cria $BASE/evolution.env (modo 600) a partir do exemplo SÓ se não existir,"
  echo "   com AUTHENTICATION_API_KEY e POSTGRES_PASSWORD gerados por openssl rand -hex 32"
  echo "5. docker compose --env-file evolution.env up -d"
  echo "6. instala o site abaixo, nginx -t, recarrega, certbot --nginx -d $DOMINIO --redirect"
  echo
  echo "== $ARQUIVO_DO_SITE"
  renderizar_site
  exit 0
fi

[ "$(id -u)" = 0 ] || { echo "rode como root" >&2; exit 1; }

echo "== pré-requisitos"
if ! docker compose version >/dev/null 2>&1; then
  echo "falta o Docker com o plugin compose." >&2
  echo "Instale pelo repositório oficial do Docker: https://docs.docker.com/engine/install/ e rode de novo." >&2
  exit 1
fi
faltam=()
for b in nginx certbot ufw openssl; do
  command -v "$b" >/dev/null 2>&1 || faltam+=("$b")
done
if [ "${#faltam[@]}" -gt 0 ]; then
  echo "faltam no PATH: ${faltam[*]}" >&2
  echo "instale pelo gerenciador de pacotes (nginx, certbot, python3-certbot-nginx, ufw) e rode de novo." >&2
  exit 1
fi

echo "== firewall (ufw): só ssh, 80 e 443"
# Se o sshd não escuta na 22, liberar a 22 trancaria o dono para fora.
PORTA_SSH="$(sshd -T 2>/dev/null | awk '$1 == "port" { print $2; exit }' || true)"
PORTA_SSH="${PORTA_SSH:-22}"
ufw default deny incoming
ufw default allow outgoing
ufw allow "$PORTA_SSH/tcp"
ufw allow 80,443/tcp
ufw --force enable

echo "== arquivos em $BASE"
install -d -o root -g root -m 750 "$BASE"
install -o root -g root -m 640 "$AQUI/docker-compose.yml" "$BASE/docker-compose.yml"
if [ ! -f "$BASE/evolution.env" ]; then
  (
    umask 077
    sed "s/__DOMINIO__/$DOMINIO/g" "$AQUI/evolution.env.example" > "$BASE/evolution.env"
  )
  chmod 600 "$BASE/evolution.env"
  chave_api="$(openssl rand -hex 32)"
  senha_banco="$(openssl rand -hex 32)"
  # hex não tem caractere especial: o sed é seguro.
  sed -i "s/^AUTHENTICATION_API_KEY=\$/AUTHENTICATION_API_KEY=$chave_api/; s/^POSTGRES_PASSWORD=\$/POSTGRES_PASSWORD=$senha_banco/" "$BASE/evolution.env"
  unset chave_api senha_banco
  echo "criado $BASE/evolution.env (modo 600) com chaves novas"
else
  echo "$BASE/evolution.env já existe; não foi tocado"
fi
for chave in AUTHENTICATION_API_KEY POSTGRES_PASSWORD; do
  grep -Eq "^$chave=.+" "$BASE/evolution.env" \
    || { echo "$BASE/evolution.env está sem $chave: preencha e rode de novo" >&2; exit 1; }
done

echo "== docker compose up"
(cd "$BASE" && docker compose --env-file evolution.env up -d)

echo "== nginx: site $SITE para $DOMINIO"
if [ ! -f "$ARQUIVO_DO_SITE" ]; then
  renderizar_site > "$ARQUIVO_DO_SITE"
fi
ln -sfn "$ARQUIVO_DO_SITE" "/etc/nginx/sites-enabled/$SITE"
if ! nginx -t; then
  rm -f "/etc/nginx/sites-enabled/$SITE"
  echo "nginx -t falhou: o site $SITE saiu e o nginx não foi recarregado" >&2
  exit 1
fi
systemctl reload nginx

echo "== TLS (Let's Encrypt)"
if [ ! -d "/etc/letsencrypt/live/$DOMINIO" ]; then
  certbot --nginx -d "$DOMINIO" --non-interactive --redirect
fi
nginx -t

echo
echo "Pronto. A Evolution está de pé em https://$DOMINIO (api presa em 127.0.0.1:8080)."
echo "A chave de API está em $BASE/evolution.env (AUTHENTICATION_API_KEY), modo 600 — o script nunca a imprime."
echo "Ela vai para o cofre do CRM na Sessão 4 (conectar número); não a copie para o repositório."
