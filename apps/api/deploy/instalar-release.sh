#!/usr/bin/env bash
# Instala uma versão do apps/api na VPS e a põe no ar — roda como n1crm,
# chamado por publicar.sh (que antes envia /opt/n1-crm/releases/<sha>.tar.gz).
#
# Ordem: extrai → instala as dependências → migra o banco → troca o link
# `current` → reinicia → espera /saude. Se /saude não responder, volta o
# link para a versão anterior e reinicia de novo (a migração não volta:
# as migrações são aditivas, a versão anterior roda sobre o banco novo).
set -euo pipefail

SHA="${1:?uso: instalar-release.sh <sha>}"
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "sha inválido: $SHA" >&2; exit 2; }
BASE=/opt/n1-crm
SERVICO=n1-crm-api.service
REL="$BASE/releases/$SHA"
PACOTE="$BASE/releases/$SHA.tar.gz"
MANTER=5
export PATH="$BASE/node/bin:$PATH"

[ -f "$BASE/shared/api.env" ] || { echo "falta $BASE/shared/api.env — ver apps/api/deploy/CONTEXT.md" >&2; exit 1; }
[ -f "$PACOTE" ] || { echo "falta $PACOTE" >&2; exit 1; }
PORTA="$(systemctl show -p Environment --value "$SERVICO" | tr ' ' '\n' | sed -n 's/^PORT=//p')"
[ -n "$PORTA" ] || { echo "o $SERVICO não define PORT — rode preparar-vps.sh" >&2; exit 1; }
ANTERIOR="$(readlink -f "$BASE/current" 2>/dev/null || true)"
if [ "$ANTERIOR" = "$REL" ]; then
  echo "$SHA já é a versão no ar"
  rm -f "$PACOTE"
  exit 0
fi

echo "== extraindo $SHA"
rm -rf "$REL.novo" && mkdir -p "$REL.novo"
tar -xzf "$PACOTE" -C "$REL.novo"
# O mesmo arquivo para o serviço e para a migração: carregarEnv() lê apps/api/.env.
ln -s "$BASE/shared/api.env" "$REL.novo/apps/api/.env"
echo "$SHA" > "$REL.novo/REVISION"

echo "== dependências (só @n1/api e o que ela usa)"
(cd "$REL.novo" && npm ci --workspace @n1/api --no-audit --no-fund)

echo "== migrações"
(cd "$REL.novo" && TZ=America/Sao_Paulo npm run --silent migrar -w @n1/api)

rm -rf "$REL" && mv "$REL.novo" "$REL"
trocar_para() { ln -sfn "$1" "$BASE/current.novo" && mv -T "$BASE/current.novo" "$BASE/current"; }
no_ar() {
  for _ in $(seq 1 40); do
    curl -fsS -m 2 "http://127.0.0.1:$PORTA/saude" >/dev/null 2>&1 && return 0
    sleep 1
  done
  return 1
}

echo "== no ar"
trocar_para "$REL"
sudo -n /usr/bin/systemctl restart "$SERVICO"
if ! no_ar; then
  echo "!! /saude não respondeu em 40 s — últimas linhas do serviço:" >&2
  sudo -n /usr/bin/journalctl --no-pager -u "$SERVICO" -n 80 >&2 || true
  if [ -n "$ANTERIOR" ] && [ -d "$ANTERIOR" ]; then
    trocar_para "$ANTERIOR"
    sudo -n /usr/bin/systemctl restart "$SERVICO"
    if no_ar; then echo "!! voltou para $(basename "$ANTERIOR")" >&2; else echo "!! a anterior também não subiu" >&2; fi
  fi
  exit 1
fi
rm -f "$PACOTE"
echo "$SHA no ar em 127.0.0.1:$PORTA"

# As $MANTER versões mais novas ficam (para voltar atrás); a atual nunca sai.
atual="$(readlink -f "$BASE/current")"
find "$BASE/releases" -mindepth 1 -maxdepth 1 -type d -name '*.novo' -mmin +60 -exec rm -rf {} +
ls -1dt "$BASE"/releases/*/ | sed 's:/$::' | grep -v '\.novo$' | tail -n +$((MANTER + 1)) | while read -r velha; do
  [ "$velha" = "$atual" ] || rm -rf "$velha"
done || true
