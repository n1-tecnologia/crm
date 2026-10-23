#!/usr/bin/env bash
# Prepara a VPS para o apps/api — uma vez, como root. Idempotente: rodar de
# novo não duplica nada nem desfaz o TLS que o certbot já pôs.
#
#   scp -r apps/api/deploy root@VPS:/tmp/n1-crm-deploy
#   ssh root@VPS 'bash /tmp/n1-crm-deploy/preparar-vps.sh <domínio> [chave-de-deploy.pub]'
#
# Homologação (Fase 9, D-09/D-23): o mesmo script, com `AMBIENTE=homologacao`,
# monta um segundo ambiente ao lado — outro usuário, outra pasta, outra porta,
# outro serviço e outro site, com sudoers e chave de deploy próprios:
#
#   ssh root@VPS 'AMBIENTE=homologacao bash /tmp/n1-crm-deploy/preparar-vps.sh \
#     crm-n1-api-hml.<ip>.nip.io /tmp/n1-crm-deploy/chave-hml.pub'
#
#   AMBIENTE      usuário     pasta              porta  serviço            site
#   producao      n1crm       /opt/n1-crm        3020   n1-crm-api         n1-crm-api      (padrão)
#   homologacao   n1crm-hml   /opt/n1-crm-hml    3021   n1-crm-api-hml     n1-crm-api-hml
#
# O `api.env` de cada ambiente é de dono e modo próprios ($USUARIO, 600): quem
# comprometer a homologação não lê o `api.env` de produção.
#
# `--conferir` (último argumento; não pede root e não muda nada) imprime as
# variáveis do ambiente e o serviço e o site já renderizados, para conferir
# antes de rodar de verdade.
#
# A VPS é compartilhada: este script só cria o que é do N1 CRM (usuário, pasta,
# o serviço, o site do nginx e o certificado do domínio). O Node global, o pm2
# e os sites dos outros projetos ficam como estão; se o `nginx -t` falhar, o
# site sai e nada recarrega.
set -euo pipefail

AQUI="$(cd "$(dirname "$0")" && pwd)"
CONFERIR=0
ARGS=()
for arg in "$@"; do
  if [ "$arg" = "--conferir" ]; then CONFERIR=1; else ARGS+=("$arg"); fi
done
DOMINIO="${ARGS[0]:?uso: [AMBIENTE=homologacao] preparar-vps.sh <domínio público da api> [chave-de-deploy.pub] [--conferir]}"
CHAVE_DE_DEPLOY="${ARGS[1]:-}"

AMBIENTE="${AMBIENTE:-producao}"
case "$AMBIENTE" in
  producao)
    USUARIO=n1crm; BASE=/opt/n1-crm; PORTA=3020; SERVICO=n1-crm-api; SITE=n1-crm-api ;;
  homologacao)
    USUARIO=n1crm-hml; BASE=/opt/n1-crm-hml; PORTA=3021; SERVICO=n1-crm-api-hml; SITE=n1-crm-api-hml ;;
  *)
    echo "AMBIENTE deve ser producao ou homologacao (veio: $AMBIENTE)" >&2; exit 1 ;;
esac
NODE_MAJOR=24
ARQUIVO_DO_SITE="/etc/nginx/sites-available/$SITE"
LIMITES=/etc/nginx/conf.d/n1-crm-limites.conf

# Os dois modelos renderizados — o mesmo `sed` serve ao --conferir e ao de verdade.
renderizar_servico() {
  sed "s/__USUARIO__/$USUARIO/g; s/__BASE__/${BASE//\//\\/}/g; s/__PORTA__/$PORTA/g" "$AQUI/n1-crm-api.service"
}
renderizar_site() {
  sed "s/__DOMINIO__/$DOMINIO/g; s/__PORTA__/$PORTA/g; s/__SITE__/$SERVICO/g" "$AQUI/nginx-n1-crm-api.conf"
}

if [ "$CONFERIR" = 1 ]; then
  echo "AMBIENTE=$AMBIENTE"
  echo "USUARIO=$USUARIO"
  echo "BASE=$BASE"
  echo "PORTA=$PORTA"
  echo "SERVICO=$SERVICO"
  echo "SITE=$SITE"
  echo "DOMINIO=$DOMINIO"
  echo "SUDOERS=/etc/sudoers.d/$SERVICO"
  echo
  echo "== /etc/systemd/system/$SERVICO.service"
  renderizar_servico
  echo
  echo "== $ARQUIVO_DO_SITE"
  renderizar_site
  exit 0
fi

[ "$(id -u)" = 0 ] || { echo "rode como root" >&2; exit 1; }

echo "== ambiente $AMBIENTE: usuário $USUARIO e $BASE"
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
renderizar_servico > "/etc/systemd/system/$SERVICO.service"
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

echo "== nginx: limites e máscara (conf.d) e site $SITE para $DOMINIO"
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
if [ ! -f "$ARQUIVO_DO_SITE" ]; then
  renderizar_site > "$ARQUIVO_DO_SITE"
fi
ln -sfn "$ARQUIVO_DO_SITE" "/etc/nginx/sites-enabled/$SITE"
if ! nginx -t; then
  rm -f "/etc/nginx/sites-enabled/$SITE"
  # Um conf.d inválido derrubaria o nginx de todos os projetos: sai o que esta rodada pôs.
  [ "$LIMITES_NOVO" = 1 ] && rm -f "$LIMITES"
  echo "nginx -t falhou: o site $SITE saiu e o nginx não foi recarregado" >&2
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
