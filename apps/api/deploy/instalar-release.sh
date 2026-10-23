#!/usr/bin/env bash
# Instala uma versão do apps/api na VPS e a põe no ar — roda como o usuário do
# ambiente (n1crm ou n1crm-hml), chamado por publicar.sh (que antes envia
# <pasta do ambiente>/releases/<sha>.tar.gz).
#
#   instalar-release.sh <sha> [producao|homologacao]     (padrão: producao)
#
# Ordem: confere o api.env → extrai → instala as dependências → migra o banco
# → concede o que o papel n1_api precisa → troca o link `current` → reinicia →
# espera /saude. Se /saude não responder, volta o link para a versão anterior
# e reinicia de novo (a migração não volta: as migrações são aditivas, a
# versão anterior roda sobre o banco novo). Um deploy interrompido antes do
# fim não troca o `current`: o link só muda depois de migrar e conceder.
#
# Pitfall 9 (Fase 9): se o `DATABASE_URL` do api.env é o papel n1_api e falta
# `DATABASE_URL_MIGRACAO`, o `migrar` rodaria como n1_api e falharia em DDL —
# as duas linhas mudam juntas. O script para antes de instalar qualquer coisa.
#
# Conferência sem efeito: INSTALAR_SO_CONFERIR=1 imprime BASE e SERVICO, roda só
# essa checagem do api.env e sai (0 se passa, 1 se falha); API_ENV=<arquivo>
# troca o api.env lido (padrão: <pasta do ambiente>/shared/api.env).
set -euo pipefail

SHA="${1:?uso: instalar-release.sh <sha> [producao|homologacao]}"
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "sha inválido: $SHA" >&2; exit 2; }
AMBIENTE="${2:-producao}"
case "$AMBIENTE" in
  producao)    BASE=/opt/n1-crm;     SERVICO=n1-crm-api.service ;;
  homologacao) BASE=/opt/n1-crm-hml; SERVICO=n1-crm-api-hml.service ;;
  *) echo "ambiente deve ser producao ou homologacao (veio: $AMBIENTE)" >&2; exit 2 ;;
esac
API_ENV="${API_ENV:-$BASE/shared/api.env}"
REL="$BASE/releases/$SHA"
PACOTE="$BASE/releases/$SHA.tar.gz"
MANTER=5
export PATH="$BASE/node/bin:$PATH"

[ -f "$API_ENV" ] || { echo "falta $API_ENV — ver apps/api/deploy/CONTEXT.md" >&2; exit 1; }

# Pitfall 9: n1_api em DATABASE_URL sem DATABASE_URL_MIGRACAO.
if grep -Eq '^DATABASE_URL=postgres(ql)?://n1_api[.:]' "$API_ENV" && ! grep -Eq '^DATABASE_URL_MIGRACAO=' "$API_ENV"; then
  echo "o api.env usa n1_api em DATABASE_URL mas não tem DATABASE_URL_MIGRACAO — as duas linhas mudam juntas (Pitfall 9); nada foi instalado" >&2
  exit 1
fi
if [ "${INSTALAR_SO_CONFERIR:-}" = "1" ]; then
  echo "BASE=$BASE"
  echo "SERVICO=$SERVICO"
  echo "api.env conferido: $API_ENV"
  exit 0
fi

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
ln -s "$API_ENV" "$REL.novo/apps/api/.env"
echo "$SHA" > "$REL.novo/REVISION"

echo "== dependências (só @n1/api e o que ela usa)"
(cd "$REL.novo" && npm ci --workspace @n1/api --no-audit --no-fund)

echo "== migrações"
(cd "$REL.novo" && TZ=America/Sao_Paulo npm run --silent migrar -w @n1/api)

# A cada deploy: barato, idempotente e cobre o papel n1_api criado depois da 009.
# Se falhar, aborta antes de trocar o `current`.
echo "== concessões do n1_api"
(cd "$REL.novo" && TZ=America/Sao_Paulo npm run --silent banco:conceder -w @n1/api)

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
