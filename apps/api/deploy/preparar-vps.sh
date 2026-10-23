#!/usr/bin/env bash
# Prepara a VPS para o apps/api — uma vez, como root. Idempotente: rodar de
# novo não duplica nada nem desfaz o TLS que o certbot já pôs.
#
#   scp -r apps/api/deploy root@VPS:/tmp/n1-crm-deploy
#   ssh root@VPS 'bash /tmp/n1-crm-deploy/preparar-vps.sh <domínio> [chave-de-deploy.pub]'
#
# A VPS é compartilhada: este script só cria o que é do N1 CRM (usuário
# n1crm, /opt/n1-crm, o serviço n1-crm-api, o site n1-crm-api do nginx e o
# certificado do domínio). O Node global, o pm2 e os sites dos outros
# projetos ficam como estão; se o `nginx -t` falhar, o site sai e nada recarrega.
set -euo pipefail

DOMINIO="${1:?uso: preparar-vps.sh <domínio público da api> [chave-de-deploy.pub]}"
CHAVE_DE_DEPLOY="${2:-}"
AQUI="$(cd "$(dirname "$0")" && pwd)"
USUARIO=n1crm
BASE=/opt/n1-crm
PORTA=3020
NODE_MAJOR=24
SERVICO=n1-crm-api
SITE=/etc/nginx/sites-available/n1-crm-api
LIMITES=/etc/nginx/conf.d/n1-crm-limites.conf

[ "$(id -u)" = 0 ] || { echo "rode como root" >&2; exit 1; }

echo "== usuário $USUARIO e $BASE"
if ! id "$USUARIO" >/dev/null 2>&1; then
  useradd --system --create-home --home-dir "$BASE" --shell /bin/bash "$USUARIO"
fi
# Sem senha que sirva (só chave), mas sem a trava `!` que barra o login por chave.
usermod -p '*' "$USUARIO"
install -d -o "$USUARIO" -g "$USUARIO" -m 750 "$BASE" "$BASE/releases"
install -d -o "$USUARIO" -g "$USUARIO" -m 700 "$BASE/shared" "$BASE/.ssh"
install -o "$USUARIO" -g "$USUARIO" -m 600 /dev/null "$BASE/.ssh/authorized_keys.novo"
[ -f "$BASE/.ssh/authorized_keys" ] && cat "$BASE/.ssh/authorized_keys" > "$BASE/.ssh/authorized_keys.novo"
if [ -n "$CHAVE_DE_DEPLOY" ]; then
  chave="$(cat "$CHAVE_DE_DEPLOY")"
  # `restrict`: a chave do CI roda comando e copia arquivo, mais nada (sem túnel, sem agente).
  grep -qF "$chave" "$BASE/.ssh/authorized_keys.novo" || echo "restrict $chave" >> "$BASE/.ssh/authorized_keys.novo"
fi
mv "$BASE/.ssh/authorized_keys.novo" "$BASE/.ssh/authorized_keys"

echo "== Node $NODE_MAJOR só do N1 CRM, em $BASE/node"
if ! "$BASE/node/bin/node" -v 2>/dev/null | grep -q "^v$NODE_MAJOR\."; then
  tmp="$(mktemp -d)"
  url="https://nodejs.org/dist/latest-v$NODE_MAJOR.x"
  curl -fsSL "$url/SHASUMS256.txt" -o "$tmp/SHASUMS256.txt"
  arquivo="$(grep -oE "node-v$NODE_MAJOR\.[0-9]+\.[0-9]+-linux-x64\.tar\.xz" "$tmp/SHASUMS256.txt" | head -1)"
  curl -fsSL "$url/$arquivo" -o "$tmp/$arquivo"
  (cd "$tmp" && grep " $arquivo\$" SHASUMS256.txt | sha256sum -c -)
  rm -rf "$BASE/node.novo" && mkdir "$BASE/node.novo"
  tar -xJf "$tmp/$arquivo" -C "$BASE/node.novo" --strip-components=1
  # Do root: o processo do serviço não reescreve o próprio runtime.
  chown -R root:root "$BASE/node.novo"
  rm -rf "$BASE/node" && mv "$BASE/node.novo" "$BASE/node"
  rm -rf "$tmp"
fi
"$BASE/node/bin/node" -v

echo "== porta $PORTA"
if ss -ltnH "sport = :$PORTA" | grep -q . && ! systemctl is-active --quiet "$SERVICO"; then
  echo "a porta $PORTA já é de outro processo — escolha outra em PORTA" >&2
  exit 1
fi

echo "== serviço $SERVICO"
sed "s/__PORTA__/$PORTA/g" "$AQUI/n1-crm-api.service" > "/etc/systemd/system/$SERVICO.service"
systemctl daemon-reload
# Sobe sozinho no boot; o primeiro start é do primeiro deploy (instalar-release.sh).
systemctl enable "$SERVICO.service"

echo "== sudo do $USUARIO: só reiniciar e ler o próprio serviço"
cat > "/etc/sudoers.d/$SERVICO.novo" <<EOF
$USUARIO ALL=(root) NOPASSWD: /usr/bin/systemctl restart $SERVICO.service, /usr/bin/journalctl --no-pager -u $SERVICO.service -n 80
EOF
chmod 440 "/etc/sudoers.d/$SERVICO.novo"
visudo -cf "/etc/sudoers.d/$SERVICO.novo"
mv "/etc/sudoers.d/$SERVICO.novo" "/etc/sudoers.d/$SERVICO"

echo "== nginx: limites e máscara (conf.d) e site n1-crm-api para $DOMINIO"
# Zonas, map e log_format do contexto http — o site abaixo os usa, então este
# arquivo entra antes dele. Só nasce se não existir: se já existe e difere do
# repositório, a VPS é a fonte (o dono pode ter ajustado) e nada é sobrescrito.
LIMITES_NOVO=0
if [ ! -f "$LIMITES" ]; then
  LIMITES_NOVO=1
  install -m 644 "$AQUI/n1-crm-limites.conf" "$LIMITES"
elif ! cmp -s "$AQUI/n1-crm-limites.conf" "$LIMITES"; then
  echo "aviso: $LIMITES difere do repositório — a VPS é a fonte; compare à mão e não foi sobrescrito" >&2
fi
if [ ! -f "$SITE" ]; then
  sed "s/__DOMINIO__/$DOMINIO/g; s/__PORTA__/$PORTA/g; s/__SITE__/$SERVICO/g" "$AQUI/nginx-n1-crm-api.conf" > "$SITE"
fi
ln -sfn "$SITE" /etc/nginx/sites-enabled/n1-crm-api
if ! nginx -t; then
  rm -f /etc/nginx/sites-enabled/n1-crm-api
  # Um conf.d inválido derrubaria o nginx de todos os projetos: sai o que esta rodada pôs.
  [ "$LIMITES_NOVO" = 1 ] && rm -f "$LIMITES"
  echo "nginx -t falhou: o site n1-crm-api saiu e o nginx não foi recarregado" >&2
  exit 1
fi
systemctl reload nginx

echo "== TLS (Let's Encrypt, a mesma conta e renovação dos outros sites)"
if [ ! -d "/etc/letsencrypt/live/$DOMINIO" ]; then
  certbot --nginx -d "$DOMINIO" --non-interactive --redirect
fi
nginx -t

echo
echo "Pronto. Falta, antes do primeiro deploy:"
echo "  - $BASE/shared/api.env (dono $USUARIO, modo 600) — ver apps/api/deploy/CONTEXT.md"
echo "  - a CA do Supabase em $BASE/shared/supabase-ca.crt (DATABASE_CA_PATH)"
